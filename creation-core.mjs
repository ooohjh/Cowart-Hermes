import registry from './model-capabilities.json' with {type:'json'};
export const MODELS=Object.freeze(registry.models.map(m=>Object.freeze({...m,sizes:Object.freeze(m.sizes.map(Object.freeze))})));
export const ASPECTS=['1:1','2:3','3:2','3:4','4:3','9:16','16:9'];
export function modelFor(alias,model,models=MODELS){const m=models.find(x=>x.alias===alias&&x.model===model);if(!m)throw Error('无效 provider alias / model');return m}
export function sizeOptions(alias,model,models=MODELS,operation='images.generate',userInitiated=false){const m=modelFor(alias,model,models);const cap=m.operations?.[operation]||(m.operation===operation?m:null);if(cap?.status==='verified'&&cap.evidence)return cap.sizes;if(userInitiated)return (m.sizes?.length?m.sizes:[{width:1024,height:1024,aspect:'1:1',resolution:'1K',requestSize:'1024x1024'}]);return []}
export function assertOperation(alias,model,operation,models=MODELS,userInitiated=false){if(!['images.generate','images.edit'].includes(operation))throw Error('未知图像操作');if(!sizeOptions(alias,model,models,operation,userInitiated).length)throw Error(operation==='images.edit'?'图片编辑未验证；不发送付费请求':'文生图未验证；不发送付费请求');}
export function validateProviderSize({width,height},alias,model,models=MODELS,operation='images.generate',userInitiated=false){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<64||height<64||width>8192||height>8192)throw Error('无效尺寸');
 if(!sizeOptions(alias,model,models,operation,userInitiated).some(x=>x.width===width&&x.height===height))throw Error(`供应商模型尺寸未核实：${width}x${height}；不发送付费请求`);
 return `${width}x${height}`;
}
export function requestSizeFor(dimensions,alias,model,models=MODELS,operation='images.generate',userInitiated=false){validateProviderSize(dimensions,alias,model,models,operation,userInitiated);return sizeOptions(alias,model,models,operation,userInitiated).find(s=>s.width===dimensions.width&&s.height===dimensions.height).requestSize||`${dimensions.width}x${dimensions.height}`}
export function orderImages(shapes){return [...shapes].filter(s=>s?.type==='image').sort((a,b)=>(a.y??0)-(b.y??0)||(a.x??0)-(b.x??0)||String(a.id).localeCompare(String(b.id)))}
export function shouldSubmit(e){return e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229}
export function resolveDimensions(aspect,resolution,source,alias,model,models=MODELS,operation='images.generate',userInitiated=false){
 if(aspect==='auto'){
  if(!(source?.w>0&&source?.h>0))throw Error('自动比例需要主参考图或目标');
  const gcd=(a,b)=>b?gcd(b,a%b):a;const w=Math.round(source.w),h=Math.round(source.h),g=gcd(w,h);aspect=`${w/g}:${h/g}`;
 }else if(!ASPECTS.includes(aspect))throw Error('无效比例');
 const match=sizeOptions(alias,model,models,operation,userInitiated).find(x=>x.aspect===aspect&&x.resolution===resolution);
 if(!match)throw Error(`供应商 ${aspect} / ${resolution} 未核实；不发送付费请求`);
 return {width:match.width,height:match.height,aspect,resolution};
}
export function providerAlias(r){
 const valid=v=>typeof v==='string'&&v.trim()&&!['undefined','null'].includes(v.trim());
 for(const key of ['provider_alias','alias'])if(Object.hasOwn(r,key)&&!valid(r[key]))throw Error('无效 '+key);
 const alias=r.provider_alias??r.alias;if(!valid(alias)||!valid(r.model))throw Error('缺少 provider_alias / model');
 if(r.alias!==undefined&&r.alias!==alias)throw Error('provider_alias / alias 不一致');return alias;
}
export function freezeSelection({model,aspect,resolution,source,operation='images.generate',userInitiated=false}){
 const m=MODELS.find(m=>m.model===model);if(!m)throw Error('无效编辑框模型');
 assertOperation(m.alias,m.model,operation,MODELS,userInitiated);
 const dimensions=Object.freeze(resolveDimensions(aspect,resolution,source,m.alias,m.model,MODELS,operation,userInitiated));
 return Object.freeze({provider_alias:m.alias,alias:m.alias,model:m.model,size:validateProviderSize(dimensions,m.alias,m.model,MODELS,operation,userInitiated),requestSize:requestSizeFor(dimensions,m.alias,m.model,MODELS,operation,userInitiated),aspect,ratio:dimensions.aspect,resolution,dimensions});
}
export function assertDefined(v){if(v===undefined||v==='undefined')throw Error('任务字段不能为 undefined');if(Array.isArray(v))v.forEach(assertDefined);else if(v&&typeof v==='object')Object.values(v).forEach(assertDefined)}

