import {readFile,writeFile,rename,mkdir,realpath,open,unlink} from 'node:fs/promises';
import path from 'node:path';
import {createImageStorage,hash} from './image-storage.mjs';
const unpack=r=>r.structuredContent||JSON.parse(r.content.find(c=>c.type==='text').text);
const pack=d=>({structuredContent:d,content:[{type:'text',text:JSON.stringify(d)}]});
export async function storageMcp(raw,cfg){
 const storage=createImageStorage(cfg),file=path.join(cfg.canvasDir,'hermes-image-assets.json');let assets={};
 try{assets=JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const reload=async()=>{try{assets=JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}};
 const persist=async()=>{await mkdir(path.dirname(file),{recursive:true});let lock;for(let i=0;i<200;i++){try{lock=await open(file+'.lock','wx');break}catch(e){if(e.code!=='EEXIST')throw e;await new Promise(r=>setTimeout(r,25))}}if(!lock)throw Error('Image mapping locked');try{const added=assets;await reload();assets={...assets,...added};await writeFile(file+'.tmp',JSON.stringify(assets));await rename(file+'.tmp',file)}finally{await lock.close();await unlink(file+'.lock')}};
 const register=async(record,pageId)=>{if(!/^page:[^/\\\0]+$/.test(pageId))throw Error('Invalid image page');const url='/page-assets/'+encodeURIComponent(pageId.slice(5))+'/hermes-external-'+hash(Buffer.from(record.assetPath))+'.'+record.ext;assets[url]=record;await persist();return {...record,assetUrl:url,ok:true,pageId,canvasDir:cfg.canvasDir}};
 const read=async url=>{const record=assets[url];if(!record)throw Error('Unknown external image');const actual=await realpath(record.assetPath),parent=path.dirname(actual);const expected=path.dirname(path.resolve(record.assetPath));if(![storage.input,storage.output].includes(expected)||parent!==await realpath(expected))throw Error('External image outside configured roots');const bytes=await readFile(actual);if(hash(bytes)!==record.sha256)throw Error('External image hash mismatch');return {...record,ok:true,assetUrl:url,dataBase64:bytes.toString('base64')}};
 let queue=Promise.resolve();
 async function request(method,params={}){
  if(method!=='tools/call')return raw.request(method,params);
  const {name}=params,args=structuredClone(params.arguments||{});
  await reload();
  if(['download_cowart_file','copy_cowart_image_to_clipboard'].includes(name)&&assets[args.assetUrl]){const asset=await read(args.assetUrl);delete args.assetUrl;delete args.dataUrl;Object.assign(args,{dataBase64:asset.dataBase64,mimeType:asset.mimeType,fileName:args.fileName||asset.fileName});}
  if(name==='read_cowart_page_asset'&&assets[args.assetUrl])return pack(await read(args.assetUrl));
  if(name==='save_cowart_reference_image'){
   const bytes=Buffer.from(args.dataUrl?args.dataUrl.split(',')[1]:args.dataBase64||'','base64');
   return pack(await register(await storage.store(bytes),args.pageId));
  }
  if(name==='save_cowart_canvas_state'&&args.snapshot?.store){
   const store=args.snapshot.store;
   for(const asset of Object.values(store))if(asset?.typeName==='asset'&&asset.type==='image'&&asset.props?.src?.startsWith('data:image/')){
    const bytes=Buffer.from(asset.props.src.split(',')[1],'base64');
    const shape=Object.values(store).find(s=>s.typeName==='shape'&&s.props?.assetId===asset.id);let parent=shape;const seen=new Set();while(parent&&parent.typeName!=='page'&&!seen.has(parent.id)){seen.add(parent.id);parent=store[parent.parentId]}
    const page=parent?.typeName==='page'?parent.id:Object.values(store).find(s=>s.typeName==='page')?.id;
    const saved=await register(await storage.store(bytes),page);Object.assign(asset.props,{src:saved.assetUrl,name:saved.fileName,mimeType:saved.mimeType,fileSize:saved.fileSize});
   }
  }
  const result=await raw.request(method,{...params,arguments:args});
  if(name==='insert_cowart_image'&&!result.isError){
   // Keep upstream insertion/layout semantics, but point the persisted asset at
   // the authoritative output rather than its compatibility copy.
   const inserted=unpack(result),image=await storage.store(await readFile(args.imagePath),'output',args.shapeMeta?.cowartCreationJob||hash(await readFile(args.imagePath)));
   const current=unpack(await raw.request('tools/call',{name:'get_cowart_canvas_state',arguments:{canvasDir:cfg.canvasDir}}));
   const shape=current.snapshot?.store[inserted.shapeId],asset=current.snapshot?.store[shape?.props?.assetId];
   if(!asset)throw Error('Inserted image asset missing');
   const saved=await register(image,shape.parentId);Object.assign(asset.props,{src:saved.assetUrl,name:saved.fileName,mimeType:saved.mimeType,fileSize:saved.fileSize});
   const updated=await raw.request('tools/call',{name:'save_cowart_canvas_state',arguments:{canvasDir:cfg.canvasDir,snapshot:current.snapshot,expectedRevision:current.revision}});
   if(updated.isError||unpack(updated).ok===false)throw Error('External output mapping save failed');
   return pack({...inserted,...saved});
  }
  return result;
 }
 return {storage,request(method,params){const next=queue.catch(()=>{}).then(()=>request(method,params));queue=next;return next},close:()=>raw.close()};
}
