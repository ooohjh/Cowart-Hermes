import {readFile,writeFile,mkdir,readdir,open,rename,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export const hash=b=>createHash('sha256').update(b).digest('hex');
export function imageType(b){
 if(b.length>=24&&b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))return {ext:'png',mimeType:'image/png'};
 if(b.length>=4&&b[0]===255&&b[1]===216&&b[2]===255)return {ext:'jpg',mimeType:'image/jpeg'};
 if(b.length>=16&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return {ext:'webp',mimeType:'image/webp'};
 if(b.length>=10&&/^GIF8[79]a$/.test(b.toString('ascii',0,6)))return {ext:'gif',mimeType:'image/gif'};
 throw Error('Unsupported or invalid image bytes');
}
export function localDate(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function createImageStorage(cfg,{clock=()=>new Date()}={}){
 const output=path.resolve(cfg.imageOutputDir||path.join(cfg.canvasDir,'images'));
 const input=path.resolve(cfg.imageInputDir||path.join(output,'input'));
 async function store(bytes,kind='input',key=hash(bytes)){
  const type=imageType(bytes),dir=kind==='output'?output:input,prefix=kind==='output'?'Hermes cowart':'cowart input';
  // Explicit drive roots must exist; never silently redirect or create another drive.
  await realpath(path.parse(dir).root);await mkdir(dir,{recursive:true});
  const indexDir=path.join(dir,'.cowart-index');await mkdir(indexDir,{recursive:true});
  const identity=hash(Buffer.from(kind+':'+key)),index=path.join(indexDir,identity+'.json'),lock=index+'.lock';let handle;
  for(let i=0;i<200;i++){try{handle=await open(lock,'wx');break}catch(e){if(e.code!=='EEXIST')throw e;await new Promise(r=>setTimeout(r,25))}}
  if(!handle)throw Error('Image storage identity is locked; inspect stale .lock before retry');
  try{
   try{const old=JSON.parse(await readFile(index,'utf8'));if(path.dirname(old.assetPath)!==dir||hash(await readFile(old.assetPath))!==hash(bytes))throw Error('Stored image identity/hash mismatch');return old}catch(e){if(e.code!=='ENOENT')throw e}
   const date=localDate(clock()),base=prefix+date;let n=0;
   for(const name of await readdir(dir)){if(!name.startsWith(base))continue;const m=/^(\d{2,})\.(png|jpg|webp|gif)$/.exec(name.slice(base.length));if(m)n=Math.max(n,Number(m[1]))}
   let fileName,assetPath,f;
   // Exclusive per-sequence reservation also prevents cross-extension races.
   while(true){n++;const reserve=path.join(indexDir,hash(Buffer.from(base))+'.'+n+'.reserve');try{const r=await open(reserve,'wx');await r.close()}catch(e){if(e.code==='EEXIST')continue;throw e}fileName=base+String(n).padStart(2,'0')+'.'+type.ext;assetPath=path.join(dir,fileName);try{f=await open(assetPath,'wx');break}catch(e){if(e.code!=='EEXIST')throw e}}
   await f.writeFile(bytes);await f.sync();await f.close();if(hash(await readFile(assetPath))!==hash(bytes))throw Error('Image write hash verification failed');
   const result={assetPath,fileName,...type,fileSize:bytes.length,sha256:hash(bytes)};
   const temp=index+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(result));await rename(temp,index);return result;
  }finally{await handle.close();const {unlink}=await import('node:fs/promises');await unlink(lock)}
 }
 return {store,input,output};
}
