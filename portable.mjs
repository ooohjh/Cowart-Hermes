import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const configPath=path.join(root,'config.json');
const env={...process.env,PYTHONIOENCODING:'utf-8'};
function run(exe,args,options={}){const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,env,...options});if(r.error||r.status!==0)throw Error(r.error?.message||r.stderr||r.stdout);return r.stdout;}
function discover(){
 const homes=[env.HERMES_HOME,path.join(env.LOCALAPPDATA||os.homedir(),'hermes'),path.join(os.homedir(),'.hermes')].filter(Boolean);
 const sources=[env.HERMES_SOURCE,...homes.map(h=>path.join(h,'hermes-agent'))].filter(Boolean);
 const found=spawnSync('where.exe',['hermes'],{encoding:'utf8',windowsHide:true});
 for(const file of (found.stdout||'').trim().split(/\r?\n/)){if(file)sources.push(path.resolve(path.dirname(file),'../..'));}
 const candidates=[env.COWART_PYTHON,...sources.flatMap(s=>[path.join(s,'venv/Scripts/python.exe'),path.join(s,'.venv/Scripts/python.exe')]),'python'].filter(Boolean);
 for(const python of candidates){try{
 const d=JSON.parse(run(python,['-c',`import json,sys,pathlib,hermes_constants,hermes_cli.main; from hermes_cli.profiles import get_active_profile; h=hermes_constants.get_hermes_home(); import os; p=get_active_profile(); h=h if os.environ.get('HERMES_HOME') or p=='default' else hermes_constants.get_default_hermes_root()/'profiles'/p; print(json.dumps(dict(python=sys.executable,hermesSource=str(pathlib.Path(hermes_cli.main.__file__).parent.parent),hermesHome=str(h))))`]));
 return {...d,python};
 }catch{}}
 throw Error('Hermes Python runtime not found. Set COWART_PYTHON to the Python used by your installed Hermes.');
}
function cli(cfg,args,input='Y\n'){return run(cfg.python,['-m','hermes_cli.main',...args],{cwd:cfg.hermesSource,env:{...env,HERMES_HOME:cfg.hermesHome},input});}
async function free(port){await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',()=>reject(Error(`Port ${port} is occupied; stop that instance or set COWART_PORT before installing.`)));s.listen(port,'127.0.0.1',()=>s.close(resolve));});}
const load=()=>JSON.parse(fs.readFileSync(configPath,'utf8'));
async function health(cfg){try{return await (await fetch(`http://127.0.0.1:${cfg.port}/health`,{signal:AbortSignal.timeout(1200)})).json()}catch{return null}}
async function stop(cfg){const h=await health(cfg);if(!h)return console.log('Already stopped.');if(h.instanceId!==cfg.instanceId)throw Error('Port belongs to another instance; refusing to stop.');const token=fs.readFileSync(path.join(root,'bridge-token.txt'),'utf8').trim();const r=await fetch(`http://127.0.0.1:${cfg.port}/v1/shutdown`,{method:'POST',headers:{'x-cowart-bridge-token':token}});if(!r.ok)throw Error('Shutdown rejected.');for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,200));if(!await health(cfg))return console.log('Stopped this package only.');}throw Error('Stop timed out.');}
async function main(){
 if(process.platform!=='win32')throw Error('This release supports Windows only.');
 if(Number(process.versions.node.split('.')[0])<22)throw Error('Install Node.js 22 or newer first.');
 const action=process.argv[2]||'install';
 if(action==='install'){
  if(fs.existsSync(configPath))throw Error('Already installed here. Keep this folder for rollback; install upgrades in a new folder.');
  const d=discover();
  console.log(run(d.python,[path.join(root,'core-preflight.py'),d.hermesSource]));
  const port=Number(env.COWART_PORT||43189);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid COWART_PORT');await free(port);
  const plugin=path.join(d.hermesHome,'desktop-plugins/cowart-hermes/plugin.js');
  if(fs.existsSync(plugin))throw Error('Existing Cowart plugin found. Uninstall the previous package first (data is retained).');
  const listed=cli(d,['mcp','list']);if(/\bcowart\b/.test(listed))throw Error('Existing cowart MCP found; remove it with hermes mcp remove cowart before installing.');
  console.log(run(process.execPath,[path.join(root,'sync-capabilities.mjs'),'--target',d.hermesSource]));
  console.log(run(process.execPath,[path.join(root,'sync-capabilities.mjs'),'--target',d.hermesSource,'--check']));
  const cfg={...d,apiVersion:1,creationApiVersion:2,instanceId:randomUUID(),port,upstreamRoot:path.join(root,'vendor/cowart'),canvasDir:path.resolve(env.COWART_CANVAS||path.join(d.hermesHome,'cowart-data/canvas')),outputDir:path.join(d.hermesHome,'cowart-data/generated')};
  cfg.imageOutputDir=path.resolve(env.COWART_IMAGE_OUTPUT||path.join(cfg.canvasDir,'images'));
  cfg.imageInputDir=path.resolve(env.COWART_IMAGE_INPUT||path.join(cfg.imageOutputDir,'input'));
  fs.mkdirSync(cfg.canvasDir,{recursive:true});fs.writeFileSync(configPath,JSON.stringify(cfg,null,2));
  const output=cli(cfg,['mcp','add','cowart','--command',process.execPath,'--args',path.join(root,'mcp-proxy.mjs')]);
  if(!/Saved/i.test(output)||/Failed to connect|disabled/i.test(output))throw Error('MCP registration/discovery failed (do not use this installation): '+output);
  const check=cli(cfg,['mcp','list']);if(!/cowart/.test(check))throw Error('MCP readback missing cowart');
  run(process.execPath,[path.join(root,'install.mjs')]);
  console.log(output);console.log(check);console.log('Installed. Run start.cmd, then Reload desktop plugins in Hermes Desktop. Data: '+cfg.canvasDir);return;
 }
 const cfg=load();
 if(action==='start'){
  const h=await health(cfg);if(h?.instanceId===cfg.instanceId)return console.log('Already running.');await free(cfg.port);
  const log=fs.openSync(path.join(root,'bridge.log'),'a');const child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',log,log]});child.unref();fs.closeSync(log);
  for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,250));if((await health(cfg))?.instanceId===cfg.instanceId)return console.log('Started; health verified.');}throw Error('Startup failed; inspect bridge.log');
 }
 if(action==='stop')return stop(cfg);
 if(action==='uninstall'){
  await stop(cfg);
  const plugin=path.join(cfg.hermesHome,'desktop-plugins/cowart-hermes/plugin.js');const token=fs.readFileSync(path.join(root,'bridge-token.txt'),'utf8').trim();
  if(fs.existsSync(plugin)&&!fs.readFileSync(plugin,'utf8').includes(token))throw Error('Plugin belongs to another installation; refusing removal.');
  const ownerText=fs.readFileSync(path.join(cfg.hermesHome,'config.yaml'),'utf8');const ownerArgs=ownerText.split(/\r?\n/).filter(x=>x.includes('mcp-proxy.mjs')).join(' ');if(ownerArgs&&!ownerArgs.includes(path.join(root,'mcp-proxy.mjs')))throw Error('MCP belongs to another installation; refusing removal.');
  console.log(cli(cfg,['mcp','remove','cowart']));if(/\bcowart\b/.test(cli(cfg,['mcp','list'])))throw Error('MCP removal readback failed');
  if(fs.existsSync(plugin))fs.unlinkSync(plugin);console.log('Uninstalled. User canvas and generated images retained. Keep this folder for rollback.');return;
 }
 throw Error('Use install, start, stop or uninstall');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
