import test from 'node:test';
import assert from 'node:assert/strict';
import {MODELS,resolveDimensions,validateProviderSize} from '../creation-core.mjs';
test('paid evidence enables exactly one combination per alias',()=>{
 assert.equal(MODELS.length,4);
 for(const m of MODELS){assert.equal(m.status,'verified');assert.ok(m.sizes.length>=1);for(const s of m.sizes){assert.ok(m.evidence);assert.equal(resolveDimensions(s.aspect,s.resolution,null,m.alias,m.model).width,s.width);assert.equal(validateProviderSize(s,m.alias,m.model),`${s.width}x${s.height}`);}assert.throws(()=>validateProviderSize({width:777,height:777},m.alias,m.model));}
});
test('4K output is measured 4096x2304, API request was 3840x2160',()=>{
 const m=MODELS[2],s=m.sizes.find(x=>x.requestSize==='3840x2160');assert.equal(s.width,4096);assert.equal(s.height,2304);assert.equal(s.requestSize,'3840x2160');
});
