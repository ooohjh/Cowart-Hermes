import {readFile} from 'node:fs/promises';
const [,,base,id,imagePath,width,height,sessionId] = process.argv;
if(!base||!id) throw Error('用法: node complete-job.mjs <bridge-url> <job-id> <absolute-image-path> <width> <height> <session-id> 或 --failed <code> <message> <session-id>');
const token=(await readFile(new URL('./bridge-token.txt',import.meta.url),'utf8')).trim();
const failed=imagePath==='--failed';
const before=await fetch(`${base}/v2/jobs/${encodeURIComponent(id)}`,{headers:{'x-cowart-bridge-token':token}});if(!before.ok)throw Error('Task not found');const job=await before.json();if(!sessionId||sessionId!==job.sessionId)throw Error('Explicit matching session required');const proof={sessionId,requestHash:job.requestHash};
const body=failed?JSON.stringify({...proof,code:width||'generation_failed',message:height||'生成失败'}):JSON.stringify({...proof,imagePath,width:Number(width),height:Number(height)});
const r=await fetch(`${base}/v2/jobs/${encodeURIComponent(id)}/${failed?'fail':'complete'}`,{method:'POST',headers:{'content-type':'application/json','x-cowart-bridge-token':token},body});
const data=await r.json();if(!r.ok||(!failed&&data.status==='failed'))throw Error(data.error||data.message||'Cowart回填失败');const checked=await fetch(`${base}/v2/jobs/${encodeURIComponent(id)}`,{headers:{'x-cowart-bridge-token':token}});const verified=await checked.json();if(!checked.ok||verified.status!==data.status)throw Error('Callback readback mismatch');console.log(JSON.stringify({ok:true,job:verified,sessionId}));
