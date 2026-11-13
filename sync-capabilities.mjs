import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const canonical=v=>JSON.stringify(sort(v));
function sort(v){return Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v}
export const digest=v=>createHash('sha256').update(canonical(v)).digest('hex');
export async function verifyBinding(registryPath,bindingPath){
 const binding=JSON.parse(await readFile(bindingPath,'utf8'));
 for(const file of [registryPath,binding.source,binding.target]){const r=JSON.parse(await readFile(file,'utf8'));if(r.version!==binding.version||digest(r)!==binding.sha256)throw Error('能力表漂移；请运行 sync-capabilities.mjs，禁止付费发送');}
 return binding;
}
async function atomic(file,value){await writeFile(file+'.tmp',JSON.stringify(value,null,2)+'\n');await rename(file+'.tmp',file)}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
 const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];
 if(!args.includes('--target'))throw Error('Usage: node sync-capabilities.mjs --target <Hermes source> [--check] [--source <registry>]');
 const source=path.resolve(args.includes('--source')?value('--source'):fileURLToPath(new URL('./model-capabilities.json',import.meta.url)));
 const target=path.resolve(value('--target'),'tools','image_generation_capabilities.json');
 const code=await readFile(path.join(path.dirname(target),'image_generation_explicit.py'),'utf8');
 if(!/CAPABILITY_SCHEMA\s*=\s*6\b/.test(code))throw Error('Hermes core incompatible: operation-aware schema 6 required; adapter-only installation cannot patch core');
 const registry=JSON.parse(await readFile(source,'utf8'));
 if(registry.version!==6)throw Error('Authority must be schema/version 6');
 const binding={version:registry.version,sha256:digest(registry),source,target};
 const sourceBinding=path.join(path.dirname(source),'capability-binding.local.json'),targetBinding=path.join(path.dirname(target),'image_generation_capability_binding.local.json');
 if(args.includes('--check')){await verifyBinding(source,sourceBinding);await verifyBinding(target,targetBinding);if(digest(JSON.parse(await readFile(target,'utf8')))!==binding.sha256)throw Error('Capability drift');}
 else{await atomic(target,registry);await atomic(targetBinding,binding);await atomic(sourceBinding,binding);await verifyBinding(target,targetBinding);}
 console.log(JSON.stringify({ok:true,version:binding.version,sha256:binding.sha256,check:args.includes('--check')}));
 }catch(e){console.error(e.message);process.exitCode=1}
}
