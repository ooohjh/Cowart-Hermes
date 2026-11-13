import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('composer submits only the minimal image payload and keeps ordered edit refs',async()=>{
 const source=await readFile(new URL('../plugin.template.js',import.meta.url),'utf8');
 const start=source.indexOf('   try{'),end=source.indexOf("    setStatus('请求已发送",start);
 const code=source.slice(start+7,end);
 const base={id:'12345678-abcd',status:'pending',provider:'openai',alias:'ai-guo-image',provider_alias:'ai-guo-image',model:'gpt-image-2.5-flare-2k',size:'1024x1024',aspect:'1:1',resolution:'1K',dimensions:{width:1024,height:1024},pageId:'page:test',anchor:{x:1,y:2},sessionId:'session:test',referencePaths:['C:/refs/b.png','C:/refs/a.png','C:/refs/e.png','C:/refs/c.png','C:/refs/d.png'],prompt:'fixture'};
 let sent; const run=t=>vm.runInNewContext('(async()=>{'+code+'})()', {structuredClone,d:{type:'followUp',message:{type:'cowartImageTask',jobId:t.id,task:t}},CONFIG:{origin:'http://127.0.0.1:43189'},host:{state:{activeSessionId:{get:()=>base.sessionId}},composer:{submit:(session,text)=>{sent={session,text};return true}}}});
 await run({...base,mode:'edit'});const sentPayload=JSON.parse(sent.text.split('\n',2)[1]);assert.deepEqual(sentPayload,{prompt:base.prompt,provider_alias:base.provider_alias,model:base.model,size:base.size,referencePaths:base.referencePaths});assert.match(sent.text,/^COWART_TASK_ID=12345678-abcd\n/);
 for(const key of ['id','pageId','anchor','sessionId','targetIds','annotationIds','dimensions','referenceIds','createdAt','status','provider','job'])assert.equal(Object.hasOwn(sentPayload,key),false,key);
 await run({...base,mode:'text',referencePaths:[]});assert.deepEqual(JSON.parse(sent.text.split('\n',2)[1]),{prompt:base.prompt,provider_alias:base.provider_alias,model:base.model,size:base.size});assert.match(sent.text,/^COWART_TASK_ID=12345678-abcd\n/);
 for(const value of [undefined,null,'','undefined','null'])await assert.rejects(run({...base,provider_alias:value}));await assert.rejects(run({...base,provider_alias:'mismatch'}));
 await assert.rejects(run({...base,sessionId:'other'}));await assert.rejects(run({...base,size:undefined}));await assert.rejects(run({...base,referencePaths:['undefined']}));
});
