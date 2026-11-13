// Bind Hermes MCP calls to this installation's canvas, never its working directory.
import {readFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {McpClient} from './mcp-client.mjs';
const cfg=JSON.parse(readFileSync(new URL('./config.json',import.meta.url),'utf8'));
const raw=new McpClient(cfg.upstreamRoot);
await raw.start();
const {storageMcp}=await import('./storage-mcp.mjs');
const client=await storageMcp(raw,cfg);
process.on('exit',()=>client.close());
const lines=createInterface({input:process.stdin});
lines.on('close',()=>{client.close();process.exit(0)});
lines.on('line',async line=>{let msg;try{msg=JSON.parse(line);if(msg.id===undefined)return;
if(msg.method==='tools/call')msg.params.arguments={...msg.params.arguments,projectDir:undefined,canvasDir:cfg.canvasDir};
const result=await client.request(msg.method,msg.params||{});process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:msg.id,result})+'\n');
}catch(e){if(msg?.id!==undefined)process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:msg.id,error:{code:-32603,message:e.message}})+'\n')}});
