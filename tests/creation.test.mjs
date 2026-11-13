import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../creation-core.mjs';
test('four exact aliases never inherit legacy size allowlist',()=>{
 assert.equal(core.MODELS.length,4);
 for(const m of core.MODELS){assert.ok(core.sizeOptions(m.alias,m.model).length>=1);for(const ratio of core.ASPECTS)for(const res of ['1K','1.5K','2K','2.5K','4K'])if(!m.sizes.some(s=>s.aspect===ratio&&s.resolution===res))assert.throws(()=>core.resolveDimensions(ratio,res,null,m.alias,m.model),/未核实/);assert.throws(()=>core.validateProviderSize({width:777,height:777},m.alias,m.model),/未核实/)}
 assert.equal(core.MODELS[3].model,'gpt-image-2.6-flare');
 assert.throws(()=>core.modelFor('ai-guo-image','gpt-image-2'));
 assert.throws(()=>core.assertDefined({paths:['undefined']}));
});
test('verified fixture uses per-model capabilities, not model name',()=>{
 const models=[{alias:'fixture',model:'4k-name',operation:'images.generate',status:'verified',evidence:'TEST ONLY',sizes:[{aspect:'1:1',resolution:'1K',width:1024,height:1024}]}];
 assert.equal(core.resolveDimensions('1:1','1K',null,'fixture','4k-name',models).width,1024);
 assert.throws(()=>core.resolveDimensions('1:1','4K',null,'fixture','4k-name',models));
});
test('references sorted once by top,left,id and IME never submits',()=>{
 assert.equal(typeof core.orderImages,'function');
 assert.deepEqual(core.orderImages([{id:'b',x:1,y:0,type:'image'},{id:'a',x:0,y:0,type:'image'}]).map(s=>s.id),['a','b']);
 assert.equal(core.shouldSubmit({key:'Enter',isComposing:true}),false);
 assert.equal(core.shouldSubmit({key:'Enter',shiftKey:true}),false);
 assert.equal(core.shouldSubmit({key:'Enter',keyCode:229}),false);
 assert.equal(core.shouldSubmit({key:'Enter'}),true);
});
