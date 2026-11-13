import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
export class McpClient {
 constructor(root) {
  this.seq=0; this.pending=new Map();
  this.child=spawn(process.execPath,[root+'/scripts/start-mcp.mjs'],{cwd:root,stdio:['pipe','pipe','pipe'],windowsHide:true});
  createInterface({input:this.child.stdout}).on('line',line=>{try {const r=JSON.parse(line);const p=this.pending.get(r.id);if(p){this.pending.delete(r.id);clearTimeout(p.timer);r.error?p.reject(Error(r.error.message)):p.resolve(r.result)}}catch{}});
  this.child.stderr.on('data',()=>{});
  this.child.on('exit',()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Cowart MCP exited'))}this.pending.clear()});
 }
 request(method,params={}) {return new Promise((resolve,reject)=>{const id=++this.seq;const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('MCP timeout'))},60000);this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n')})}
 async start(){await this.request('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'cowart-hermes',version:'1.0.0'}});this.child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');return this.request('tools/list')}
 close(){this.child.kill()}
}
