import {orderImages,resolveDimensions,shouldSubmit,MODELS,sizeOptions,freezeSelection} from '/creation-core.mjs';
const cfg=window.__COWART_HERMES_BRIDGE__;
const api=async(route,body)=>{const r=await fetch('/v2/'+route,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json','x-cowart-bridge-token':cfg.token},body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.message||d.error);return d};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
// Only replace the upstream IMAGE prompt, never the shared HTML/film/slides panels.
// Install before waiting for the editor: React can mount a selected holder immediately.
const style=document.createElement('style');style.textContent=`
.cowart-ai-generation-overlay > form.cowart-ai-generation-panel[aria-label="AI 图片生成"]{display:none!important}
#cowart-create{position:fixed;z-index:1000;width:420px;max-width:calc(100vw - 24px);background:white;color:#252525;border:1px solid #e5e5e5;border-radius:16px;box-shadow:0 10px 35px #0002;padding:12px;font:13px system-ui;box-sizing:border-box}
#cowart-create *{box-sizing:border-box}#cowart-create select,#cowart-create button{font:inherit;border:1px solid #eee;border-radius:7px;background:#f7f7f7;color:#333;padding:5px 8px;cursor:pointer}#cowart-create textarea{font:14px/1.5 system-ui;width:100%;height:88px;border:0;background:white;color:#222;resize:vertical;outline:none;margin:10px 0}#cowart-refs{display:flex;gap:7px;overflow:auto;margin-top:10px}#cowart-refs figure{margin:0;flex:none;font-size:11px}#cowart-refs img{width:52px;height:45px;object-fit:cover;border-radius:6px}#cowart-create footer{display:flex;align-items:center;gap:8px;color:#888;font-size:11px}#cowart-send:disabled{opacity:.45;cursor:not-allowed}#cowart-send{margin-left:auto;background:#246bfe!important;color:white!important}#cowart-status{font-size:11px;margin-top:8px;max-height:48px;overflow:auto;color:#777}#cowart-anchor{position:fixed;z-index:999;width:20px;height:20px;border:1px dashed #2675ff;border-radius:50%;box-sizing:border-box;cursor:move;touch-action:none;background:transparent;padding:0}#cowart-anchor:after{content:'';position:absolute;inset:4px;border:1.5px solid #2675ff;border-radius:50%}#cowart-anchor-menu{position:fixed;z-index:99999;background:white;border:1px solid #ddd;border-radius:7px;padding:9px;color:#222;cursor:pointer}
`;document.head.append(style);
while(!window.__cowartEditor)await delay(250);
const editor=window.__cowartEditor;
const card=document.createElement('section');card.id='cowart-create';card.hidden=true;card.setAttribute('aria-label','图片创作');card.innerHTML=`<div style="display:flex;gap:8px;flex-wrap:wrap"><select id="cowart-mode" aria-label="生成模式"><option value="edit">编辑图片</option><option value="text">文字生图</option></select><select aria-label="比例" id="cowart-aspect">${['auto','1:1','2:3','3:2','3:4','4:3','9:16','16:9'].map(x=>`<option value="${x}">${x==='auto'?'自动':x}</option>`).join('')}</select><select aria-label="尺寸" id="cowart-resolution">${['1K','1.5K','2K','2.5K','4K'].map(x=>`<option value="${x}">${x}</option>`).join('')}</select><button id="cowart-link" title="固定当前目标，再选择外围参考图片">＋ 关联参考</button><button id="cowart-clear" title="清除关联，不删除画布内容">清除关联</button></div><div id="cowart-refs"></div><textarea id="cowart-prompt" placeholder="让我们开始今天的创作\nEnter 发送 · Shift+Enter 换行" aria-label="创作提示词"></textarea><footer><select id="cowart-model" aria-label="图片模型" style="min-width:0;max-width:290px">${MODELS.map(m=>`<option value="${m.model}">${m.model}</option>`).join('')}</select><button id="cowart-send" aria-label="发送生成请求">↑ 发送</button></footer><pre id="cowart-parameters" aria-label="冻结图像参数" style="white-space:pre-wrap;user-select:text;font:11px/1.5 monospace;margin:8px 0"></pre><div id="cowart-status" role="status"></div>`;document.body.append(card);
const anchor=document.createElement('button');anchor.id='cowart-anchor';anchor.title='生成落点 · 拖拽移动';document.body.append(anchor);
const $=id=>card.querySelector('#cowart-'+id),prompt=$('prompt'),status=$('status');let busy=false,composing=false,refs=[],pinned=[],targetIds=[],lastSignature='',state=await api('state'),dragging=false;
const anchorForPage=()=>{const p=editor.getCurrentPageId();return state.anchors[p]||{x:editor.getViewportPageBounds().center.x,y:editor.getViewportPageBounds().center.y}};
const saveAnchor=async(p)=>{state=await api('anchor',{pageId:editor.getCurrentPageId(),...p});render()};
for(const event of ['pointerdown','pointerup','keydown','keyup','wheel'])card.addEventListener(event,e=>e.stopPropagation());
card.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.isComposing){e.preventDefault();editor.selectNone();render();prompt.blur()}});
prompt.addEventListener('compositionstart',()=>composing=true);prompt.addEventListener('compositionend',()=>composing=false);prompt.addEventListener('keydown',e=>{if(!composing&&shouldSubmit(e)){e.preventDefault();submit()}});
$('send').onclick=submit;
$('mode').onchange=()=>{lastSignature='';render()};
const selectedModel=()=>MODELS.find(m=>m.model===$('model').value);
const operation=()=>$('mode').value==='edit'?'images.edit':'images.generate';
function syncSizes(){
 const m=selectedModel();if(!m){$('send').disabled=true;$('parameters').textContent='参数无效，禁止提交';return}const options=sizeOptions(m.alias,m.model,MODELS,operation(),true);
 const source=(targetIds[0]?editor.getShape(targetIds[0]):null)||refs[0];
 for(const o of $('aspect').options){o.disabled=o.value!=='auto'&&!options.some(x=>x.aspect===o.value);o.textContent=(o.value==='auto'?'自动':o.value)+(o.disabled?'（未核实）':'')}
 let match;
 for(const o of $('resolution').options){try{const d=resolveDimensions($('aspect').value,o.value,source?.props,m.alias,m.model,MODELS,operation(),true);o.disabled=false;if(o.value===$('resolution').value)match=d}catch{o.disabled=true}o.textContent=o.value+(o.disabled?'（未核实）':'')}
 $('send').disabled=busy||!match;
 if(operation()==='images.edit'&&!options.length){if(!busy){$('parameters').textContent='operation=images.edit；图片编辑未验证';status.textContent='图片编辑未验证；文生图证据不适用于编辑，禁止付费发送'}return;}
 if(!busy)$('parameters').textContent=match?`provider_alias=${m.alias}\nmodel=${m.model}\nsize=${match.width}x${match.height}`:'参数未核实，禁止提交';
 if(!busy)status.textContent=match?`${m.model}：${match.width} × ${match.height}（请求 ${match.aspect}；API size=${sizeOptions(m.alias,m.model,MODELS,operation(),true).find(s=>s.width===match.width&&s.height===match.height).requestSize}）`:`${m.model}：API 尺寸/比例未核实，禁止付费发送`;
}
$('model').value='gpt-image-2.5-flare-2k';
$('model').onchange=()=>{const m=selectedModel(),s=sizeOptions(m.alias,m.model,MODELS,operation(),true)[0];if(s){$('aspect').value=s.aspect;$('resolution').value=s.resolution}syncSizes()};$('aspect').onchange=syncSizes;$('resolution').onchange=syncSizes;
$('link').onclick=()=>{targetIds=editor.getSelectedShapeIds();pinned=refs.map(s=>s.id);status.textContent='目标已固定：现在选择画布外围参考图；编号顺序即模型接收顺序';lastSignature=''};
$('clear').onclick=()=>{pinned=[];targetIds=[];lastSignature=''};
async function imageData(s){const a=editor.getAsset(s.props.assetId);let src=a?.props?.src;if(!src)throw Error('参考图素材缺失');if(src.startsWith('/page-assets/')){const r=await window.cowartMcp.callServerTool({name:'read_cowart_page_asset',arguments:{assetUrl:src}});src=r.structuredContent?.dataBase64?`data:${r.structuredContent.mimeType};base64,${r.structuredContent.dataBase64}`:r.structuredContent?.dataUrl||src}const url=src.startsWith('data:')?src:await editor.getAssetUrl?.(a.id,{shouldResolveToOriginal:true})||src;const response=await fetch(url);if(!response.ok)throw Error('参考图读取失败');const b=await response.blob();return await new Promise((ok,no)=>{const f=new FileReader();f.onload=()=>ok(f.result);f.onerror=no;f.readAsDataURL(b)});}
async function submit(){
 if(busy||$('send').disabled||!prompt.value.trim())return;busy=true;$('send').disabled=true;const text=prompt.value;const mode=$('mode').value;const selected=mode==='edit'?structuredClone(refs):[];let jobId,proof;
 try{
  const source=(targetIds[0]?editor.getShape(targetIds[0]):null)||selected[0];const aspect=$('aspect').value,resolution=$('resolution').value;const parameters=freezeSelection({model:$('model').value,aspect,resolution,source:source?.props,operation:operation(),userInitiated:true});$('parameters').textContent=`provider_alias=${parameters.provider_alias}\nmodel=${parameters.model}\nsize=${parameters.size}`;const frozen={...parameters,mode,pageId:editor.getCurrentPageId(),anchor:{...anchorForPage()},targetIds:[...targetIds]};const frozenIds=[...new Set([...targetIds,...editor.getSelectedShapeIds()])];const session=await window.cowartMcp.sendFollowUpMessage({type:'cowartSession'});if(!session?.sessionId)throw Error('缺少当前会话');
  status.textContent='正在读取全部参考图…';
  const references=[];for(const [i,s] of selected.entries())references.push({label:`image${i+1}`,shapeId:s.id,dataUrl:await imageData(s)});
  const ids=mode==='edit'?frozenIds:[];const annotations=ids.map(id=>editor.getShape(id)).filter(s=>s&&s.type!=='image');
  if(annotations.length){const exported=await editor.toImageDataUrl(ids,{format:'png',background:true});references.push({label:'annotation',shapeId:'annotation',dataUrl:exported.url});}
  const result=await api('jobs',{userInitiated:true,approvalMode:'user_confirmed',version:2,id:crypto.randomUUID(),prompt:text,...frozen,sessionId:session.sessionId,source:source?.props?{w:source.props.w,h:source.props.h}:null,references,annotationIds:annotations.map(s=>s.id)});
  jobId=result.id;proof={sessionId:result.sessionId,requestHash:result.requestHash};status.textContent='正在提交当前Hermes会话…';const ack=await window.cowartMcp.sendFollowUpMessage({type:'cowartImageTask',jobId:result.id,task:await api('jobs/'+result.id)});if(!ack?.ok)throw Error(ack?.error||'Hermes会话未确认提交');await api('jobs/'+result.id+'/submit',{sessionId:ack.sessionId});status.textContent='已提交当前Hermes会话，等待生成结果…';let job=result;while(['pending','submitted','running'].includes(job.status)){await delay(1500);job=await api('jobs/'+job.id)}
  if(job.status!=='completed')throw Error(job.error?.message||job.error||'生成失败');
  state=await api('state');render();prompt.value='';status.textContent=`已完成 ${job.width} × ${job.height}`;
 }catch(e){if(jobId)try{await api('jobs/'+jobId+'/fail',{...proof,code:'submission_failed',message:e.message})}catch{}prompt.value=text;busy=false;syncSizes();status.textContent=e.message;return}finally{busy=false;const message=status.textContent;syncSizes();status.textContent=message}
}
anchor.onpointerdown=e=>{e.stopPropagation();e.preventDefault();dragging=true;anchor.setPointerCapture(e.pointerId)};
anchor.onpointermove=e=>{if(!dragging)return;const p=editor.screenToPage({x:e.clientX,y:e.clientY});state.anchors[editor.getCurrentPageId()]={x:p.x,y:p.y};render()};
anchor.onpointerup=async e=>{e.stopPropagation();dragging=false;try{await saveAnchor(anchorForPage())}catch(err){status.textContent=err.message}};
const menu=document.createElement('button');menu.id='cowart-anchor-menu';menu.textContent='在此放置生成锚点';menu.hidden=true;document.body.append(menu);let menuPoint;
document.addEventListener('contextmenu',e=>{if(card.contains(e.target))return;e.preventDefault();e.stopImmediatePropagation();menuPoint=editor.screenToPage({x:e.clientX,y:e.clientY});menu.style.left=Math.min(e.clientX,innerWidth-180)+'px';menu.style.top=Math.min(e.clientY,innerHeight-45)+'px';menu.hidden=false},true);
menu.onclick=async e=>{e.stopPropagation();menu.hidden=true;try{await saveAnchor(menuPoint)}catch(err){status.textContent=err.message}};
document.addEventListener('pointerdown',e=>{if(e.target!==menu)menu.hidden=true});
function render(){
 const selection=editor.getSelectedShapes();const linked=pinned.map(id=>editor.getShape(id)).filter(Boolean);const candidates=[...new Map([...linked,...selection].map(s=>[s.id,s])).values()].filter(s=>s.type==='image');const sameSet=candidates.length===refs.length&&candidates.every(s=>refs.some(r=>r.id===s.id));refs=sameSet?refs.map(r=>editor.getShape(r.id)).filter(Boolean):orderImages(candidates);
 syncSizes();
 // Visibility follows live selection only, never pinned references or generation mode.
 card.hidden=!selection.some(s=>s.type==='image'||(s.type==='frame'&&(s.meta?.cowartAiImageHolder===true||s.meta?.cowartTool==='ai-image-holder')));
 const bounds=editor.getSelectionPageBounds();if(bounds){const p=editor.pageToScreen({x:bounds.center.x,y:bounds.maxY});card.style.left=Math.max(12,Math.min(innerWidth-card.offsetWidth-12,p.x-card.offsetWidth/2))+'px';card.style.top=Math.max(12,Math.min(innerHeight-card.offsetHeight-16,p.y+18))+'px'}
 const displayRefs=$('mode').value==='edit'?refs:[];const signature=$('mode').value+displayRefs.map(s=>s.id).join('|');if(signature!==lastSignature){lastSignature=signature;$('refs').replaceChildren();displayRefs.forEach((s,i)=>{const fig=document.createElement('figure'),img=document.createElement('img'),label=document.createElement('figcaption');label.textContent=`image${i+1}`;fig.title=s.id;fig.append(img,label);$('refs').append(fig);imageData(s).then(src=>img.src=src).catch(()=>img.alt='读取失败')})}
 const p=editor.pageToScreen(anchorForPage());anchor.style.left=p.x-10+'px';anchor.style.top=p.y-10+'px';
}
editor.store.listen(render,{scope:'all'});addEventListener('resize',render);render();
window.__cowartCreation={version:2,render,getState:()=>({busy,referenceIds:refs.map(s=>s.id),targetIds,anchor:anchorForPage()})};
