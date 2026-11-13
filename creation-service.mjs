import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createImageStorage} from './image-storage.mjs';
import {resolveDimensions,validateProviderSize,requestSizeFor,MODELS,modelFor,assertDefined,providerAlias,assertOperation} from './creation-core.mjs';
export function validateRequest(r,models=MODELS,userInitiated=false){
 assertDefined(r);if(!r)throw Error('无效生成请求');const alias=providerAlias(r);r={...r,alias,provider_alias:alias};modelFor(alias,r.model,models);
 if(typeof r.sessionId!=='string'||!r.sessionId.trim())throw Error('缺少当前会话');
 if(!r||r.version!==2||! /^[a-zA-Z0-9-]{8,80}$/.test(r.id||'')||typeof r.prompt!=='string'||!r.prompt.trim()||r.prompt.length>20000)throw Error('无效生成请求');
 if(typeof r.pageId!=='string'||!r.pageId.startsWith('page:')||![r.anchor?.x,r.anchor?.y].every(Number.isFinite))throw Error('无效页面或锚点');
 if(r.mode!==undefined&&!['text','edit'].includes(r.mode))throw Error('无效生成模式');
 if(r.mode==='text'&&r.references?.length)throw Error('文字生图禁止参考图');
 if(!Array.isArray(r.references)||r.references.length>16)throw Error('参考图最多16张（含标注图）');
 r.references.forEach((ref,i)=>{if(ref.label!==(i===r.references.length-1&&ref.label==='annotation'?'annotation':`image${i+1}`)||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(ref.dataUrl||''))throw Error('无效参考图或编号');});
 if(r.mode==='edit'&&!r.references.length)throw Error('图片编辑需要至少一张真实参考图');
 const operation=r.references.length?'images.edit':'images.generate';
 assertOperation(alias,r.model,operation,models,userInitiated);
 if(r.operation!==undefined&&r.operation!==operation)throw Error('图像操作与参考图不一致');
 r={...r,operation};
 const d=resolveDimensions(r.aspect,r.resolution,r.source,r.alias,r.model,models,operation,userInitiated);
 if(d.width!==r.dimensions?.width||d.height!==r.dimensions?.height)throw Error('尺寸校验不一致');
 const size=validateProviderSize(d,r.alias,r.model,models,operation,userInitiated),requestSize=requestSizeFor(d,r.alias,r.model,models,operation,userInitiated);
 for(const [key,value] of Object.entries({size,requestSize,ratio:d.aspect}))if(Object.hasOwn(r,key)&&r[key]!==value)throw Error('冻结字段不一致：'+key);
 return {...r,dimensions:d,ratio:d.aspect,requestSize,size};
}
export function requestPayload(r){const p={prompt:r.prompt,provider_alias:r.provider_alias,model:r.model,size:r.size};if(r.mode==='edit'&&r.referencePaths?.length)p.referencePaths=[...r.referencePaths];return p}
export function requestHash(r){return createHash('sha256').update(JSON.stringify(requestPayload(r))).digest('hex')}
export async function createCreationService({cfg,mcp,models=MODELS}){
 const storage=createImageStorage(cfg);
 const file=path.join(cfg.canvasDir,'hermes-creation-state.json');let state={version:2,anchors:{},jobs:{}};
 try{state=JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 for(const j of Object.values(state.jobs))if(['pending','submitted','queued','running'].includes(j.status)){j.status='failed';j.error='服务重启，请核对Hermes会话结果后重新提交；未自动重试'}
 let writes=Promise.resolve();const persist=()=>{const data=JSON.stringify(state);writes=writes.then(async()=>{await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',data);await rename(file+'.tmp',file)});return writes};await persist();
 const call=async(name,args)=>{const r=await mcp.request('tools/call',{name,arguments:{...args,canvasDir:cfg.canvasDir}});if(r.isError)throw Error('画布操作失败');const d=r.structuredContent||JSON.parse(r.content.find(c=>c.type==='text').text);if(d.ok===false)throw Error(d.message||'画布保存冲突');return d};
 const authorize=(id,proof)=>{const j=state.jobs[id];if(!j||proof?.sessionId!==j.sessionId||proof?.requestHash!==j.requestHash||requestHash(j)!==j.requestHash)throw Error('会话或冻结请求hash不匹配');return j};
 const locks=new Map();
 const serial=(id,fn)=>{const next=(locks.get(id)||Promise.resolve()).catch(()=>{}).then(fn);locks.set(id,next);next.finally(()=>{if(locks.get(id)===next)locks.delete(id)}).catch(()=>{});return next};
 const claim=async(id,proof)=>{const j=authorize(id,proof);if(!['pending','submitted'].includes(j.status))return {...j,claimed:false};j.status='running';await persist();return {...j,claimed:true}};
 const fail=async(id,error={})=>{const job=state.jobs[id];if(!job)throw Error('任务不存在');if(job.status==='completed')return job;if(job.status==='failed'){if(job.error&&typeof job.error==='object')return job;Object.assign(job,{error:{code:String(error.code||'generation_failed'),message:String(error.message||job.error||'生成失败'),retryAfter:error.retryAfter==null?null:Number(error.retryAfter)}});await persist();return job}if(!['pending','submitted','queued','running'].includes(job.status))return job;Object.assign(job,{status:'failed',error:{code:String(error.code||'generation_failed'),message:String(error.message||'生成失败'),retryAfter:error.retryAfter==null?null:Number(error.retryAfter)}});await persist();return job};
 const complete=async(id,result)=>{const job=state.jobs[id];if(!job)throw Error('任务不存在');if(job.status==='completed'||job.status==='failed')return job;if(!['submitted','running'].includes(job.status))return fail(id,{code:'not_submitted',message:'任务尚未提交到Hermes会话'});try{
  if(!result||!path.isAbsolute(result.imagePath))throw Error('Hermes返回的图片路径不是本机绝对路径');if(result.width!==job.dimensions.width||result.height!==job.dimensions.height)throw Error('生成尺寸不符，未插入画布');
  const output=await storage.store(await readFile(result.imagePath),'output',id);Object.assign(job,{outputPath:output.assetPath,outputName:output.fileName,outputSha256:output.sha256});result={...result,imagePath:output.assetPath};await persist();
  const inserted=await call('insert_cowart_image',{imagePath:result.imagePath,pageId:job.pageId,anchorShapeId:'',matchAnchor:false,replaceAiImageHolder:false,displayWidth:Math.min(result.width,512),displayHeight:Math.min(result.width,512)*result.height/result.width,shapeMeta:{cowartCreationJob:id,referenceShapeIds:job.referenceIds,annotationIds:job.annotationIds,targetIds:job.targetIds},altText:job.prompt});
  job.shapeId=inserted.shapeId;job.imagePath=result.imagePath;await persist();
  // Merge only our inserted shape into a freshly read revision. Never overwrite user content.
  let saved=false;
  for(let i=0;i<3&&!saved;i++){const current=await call('get_cowart_canvas_state',{});const shape=current.snapshot.store[inserted.shapeId];if(!shape)throw Error('插入图片未读回');shape.x=job.anchor.x;shape.y=job.anchor.y;shape.parentId=job.pageId;
   try{await call('save_cowart_canvas_state',{snapshot:current.snapshot,expectedRevision:current.revision});saved=true}catch(e){if(i===2)throw e}}
  const verified=await call('get_cowart_canvas_state',{});const shape=verified.snapshot.store[inserted.shapeId];if(shape?.x!==job.anchor.x||shape?.y!==job.anchor.y)throw Error('图片落点读回校验失败');
  state.anchors[job.pageId]={x:shape.x+shape.props.w+20,y:shape.y+shape.props.h/2};Object.assign(job,{status:'completed',width:result.width,height:result.height});
 }catch(e){return fail(id,{code:e.code||'generation_failed',message:e.message})}await persist();return job};
 return {getState:()=>({version:2,anchors:state.anchors,jobs:Object.values(state.jobs)}),async anchor(p){if(typeof p.pageId!=='string'||!p.pageId.startsWith('page:')||![p.x,p.y].every(Number.isFinite))throw Error('无效锚点');state.anchors[p.pageId]={x:p.x,y:p.y};await persist();return this.getState()},getJob:id=>structuredClone(state.jobs[id]),async submit(input,{userInitiated=false}={}){if(state.jobs[input?.id]){const existing=state.jobs[input.id];if(existing.sessionId!==input.sessionId||existing.prompt!==input.prompt||existing.model!==input.model||existing.provider_alias!==providerAlias(input))throw Error('任务ID冲突');return structuredClone(existing)}const r=structuredClone(validateRequest({...input,id:input?.id||randomUUID()},models,userInitiated));const referencePaths=[];for(const ref of r.references){const saved=await storage.store(Buffer.from(ref.dataUrl.split(',',2)[1],'base64'));referencePaths.push(saved.assetPath)}const job={userInitiated,approvalMode:userInitiated?"user_confirmed":"approval_required",id:r.id,mode:r.mode||(referencePaths.length?'edit':'text'),status:'pending',createdAt:new Date().toISOString(),provider_alias:r.provider_alias,alias:r.alias,ratio:r.ratio,provider:'openai',model:r.model,size:r.size,requestSize:r.requestSize,pageId:r.pageId,prompt:r.prompt,aspect:r.aspect,resolution:r.resolution,dimensions:r.dimensions,referenceIds:r.references.map(x=>x.shapeId),referencePaths,targetIds:r.targetIds||[],annotationIds:r.annotationIds||[],sessionId:r.sessionId,anchor:r.anchor,requestHash:requestHash({...r,mode:r.mode||(referencePaths.length?'edit':'text'),referencePaths})};state.jobs[r.id]=job;await persist();return job},async markSubmitted(id,sessionId){const j=state.jobs[id];if(!j)throw Error('任务不存在');if(j.status==='completed'||j.status==='failed')return j;if(!['pending','submitted'].includes(j.status))return j;if(sessionId!==j.sessionId)throw Error('会话已改变，拒绝重路由');Object.assign(j,{status:'submitted'});await persist();return j},claim,authorize,complete:(id,result)=>serial(id,()=>{authorize(id,result);return complete(id,result)}),fail:(id,error)=>serial(id,()=>{authorize(id,error);return fail(id,error)})};
}
