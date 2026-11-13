import { host, Button } from '@hermes/plugin-sdk';
import { useEffect, useRef, useState } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
const CONFIG = __CONFIG__;
function Canvas(){
 const frame=useRef(null);const [revision,setRevision]=useState(0);const [status,setStatus]=useState('正在连接本地画布…');
 useEffect(()=>{
  const listener=async e=>{
   const d=e.data;if(e.source!==frame.current?.contentWindow||e.origin!==CONFIG.origin||d?.channel!=='cowart-hermes/v1'||d.token!==CONFIG.token)return;
   try{
    if(d.type!=='followUp')throw Error('不支持的桥接操作');
    const session=host.state.focusedSessionId?.get()||host.state.activeSessionId.get();
    if(!session)throw Error('请先打开一个 Hermes 聊天会话，再发送生成请求');
    const m=d.message;
    if(m?.type==='cowartSession'){e.source.postMessage({channel:d.channel,token:CONFIG.token,id:d.id,result:{ok:true,sessionId:session}},CONFIG.origin);return}
    let text;
    if(m?.type==='cowartImageTask'){
     if(!/^[a-zA-Z0-9-]{8,80}$/.test(m.jobId||''))throw Error('无效任务ID');
     const task=structuredClone(m.task);
     if(!task||task.id!==m.jobId)throw Error('冻结任务不一致');
     const valid=v=>typeof v==='string'&&v.trim()&&!['undefined','null'].includes(v.trim());
     for(const key of ['provider_alias','alias'])if(Object.hasOwn(task,key)&&!valid(task[key]))throw Error('无效 '+key);
     task.provider_alias??=task.alias;if(!valid(task.provider_alias)||!valid(task.model)||!valid(task.size))throw Error('缺少图像参数');
     if(task.alias!==undefined&&task.alias!==task.provider_alias)throw Error('provider_alias / alias 不一致');task.alias=task.provider_alias;
     const defined=v=>{if(v===undefined||v==='undefined')throw Error('任务含 undefined');if(Array.isArray(v))v.forEach(defined);else if(v&&typeof v==='object')Object.values(v).forEach(defined)};defined(task);
     if(task.sessionId!==session||task.status!=='pending')throw Error('任务会话不一致或已提交');
     for(const key of ['id','alias','model','size','aspect','resolution','dimensions','pageId','anchor','sessionId','referencePaths'])if(task[key]==null||task[key]==='undefined')throw Error('任务字段缺失：'+key);
     if(!Array.isArray(task.referencePaths)||task.referencePaths.some(p=>typeof p!=='string'||!p||p==='undefined'))throw Error('参考路径无效');
     if(!valid(task.prompt)||!['text','edit'].includes(task.mode))throw Error('缺少提示词或生成模式');
     if(task.mode==='text'&&task.referencePaths.length)throw Error('文字生图禁止参考图');
     const payload={prompt:task.prompt,provider_alias:task.provider_alias,model:task.model,size:task.size};
     if(task.mode==='edit'&&task.referencePaths.length)payload.referencePaths=[...task.referencePaths];
     text=`COWART_TASK_ID=${task.id}\n`+JSON.stringify(payload);
    }else text=typeof m==='string'?m:m?.prompt;
    if(!text||typeof text!=='string'||text.length>200000)throw Error('请求中没有有效文本');
    if(!host.composer?.submit(session,text))throw Error('聊天输入框未打开；请保持聊天与画布并排显示');
    setStatus('请求已发送至 Hermes；生成结果由当前会话处理');
    e.source.postMessage({channel:d.channel,token:CONFIG.token,id:d.id,result:{ok:true,sessionId:session}},CONFIG.origin);
   }catch(err){setStatus(err.message);e.source.postMessage({channel:d.channel,token:CONFIG.token,id:d.id,error:err.message},CONFIG.origin)}
  };
  window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener);
 },[]);
 return jsxs('div',{style:{height:'100%',display:'flex',flexDirection:'column',minHeight:0},children:[
  jsxs('div',{style:{padding:'6px 10px',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid var(--ui-stroke-secondary)',fontSize:12},children:[jsx('strong',{children:'Cowart 画布'}),jsx('span',{style:{flex:1,color:'var(--ui-text-secondary)'},children:status}),jsx(Button,{onClick:()=>{setStatus('正在重新连接…');setRevision(x=>x+1)},children:'重新连接'})]}),
  jsx('iframe',{ref:frame,key:revision,title:'Cowart 可视化画布',src:CONFIG.origin+'/widget?token='+CONFIG.token,style:{flex:1,width:'100%',border:0,minHeight:0},sandbox:'allow-scripts allow-same-origin allow-downloads allow-modals',allow:'clipboard-write',referrerPolicy:'no-referrer',onLoad:()=>setStatus('本地画布 · 创作 API v2')})]});
}
export default {id:'cowart-hermes',name:'Cowart 可视化画布',register(ctx){ctx.register({id:'canvas',area:'panes',title:'Cowart 画布',data:{placement:'right',dock:{pane:'workspace',pos:'right'},width:'60%'},render:()=>jsx(Canvas,{})});}};
