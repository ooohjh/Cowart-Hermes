(() => {
 const {token, canvasDir} = window.__COWART_HERMES_BRIDGE__;
 const pending = new Map(); let seq=0;
 const callServerTool = async ({name,arguments:args={}}) => {
  if(name==='track_cowart_analytics_event')return {structuredContent:{ok:true,disabled:true}};
  const r=await fetch('/v1/tool',{method:'POST',headers:{'content-type':'application/json','x-cowart-bridge-token':token},body:JSON.stringify({name,arguments:args})});
  const result=await r.json();if(!r.ok)throw Error(result.error);return result;
 };
 const sendFollowUpMessage = message => new Promise((resolve,reject)=>{
  const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('Hermes 会话桥接超时，请检查聊天面板'))},15000);
  pending.set(id,{resolve,reject,timer});parent.postMessage({channel:'cowart-hermes/v1',token,id,type:'followUp',message},'*');
 });
 addEventListener('message', e=>{if(e.source!==parent||e.data?.channel!=='cowart-hermes/v1'||e.data.token!==token)return;const p=pending.get(e.data.id);if(!p)return;pending.delete(e.data.id);clearTimeout(p.timer);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.result)});
 window.cowartMcp={callServerTool,sendFollowUpMessage,getHostCapabilities:()=>({message:{text:true,image:false}})};
 window.openai={toolOutput:{canvasDir},displayMode:'fullscreen',locale:'zh-CN',theme:'light',callTool:(name,args)=>callServerTool({name,arguments:args}),sendFollowUpMessage,widgetState:null,setWidgetState(state){this.widgetState=state},requestDisplayMode:async()=>({mode:'fullscreen'})};
 window.__COWART_INITIAL_DISPLAY_MODE__='fullscreen';
 document.documentElement.lang='zh-CN';
})();
