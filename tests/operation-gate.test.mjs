import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRequest} from '../creation-service.mjs';
const request=()=>({version:2,id:crypto.randomUUID(),prompt:'OFFLINE ONLY',sessionId:'fixture',pageId:'page:fixture',anchor:{x:0,y:0},provider_alias:'ai-guo-image',model:'gpt-image-2.5-flare-2k',mode:'text',aspect:'2:3',resolution:'2K',dimensions:{width:1360,height:2048},references:[]});
test('no refs edit and forged or unknown operation rejected',()=>{
 assert.throws(()=>validateRequest({...request(),mode:'edit'}),/真实参考图/);
 assert.throws(()=>validateRequest({...request(),operation:'unknown'}),/操作/);
 assert.throws(()=>validateRequest({...request(),requestSize:'688x1024'}),/冻结字段/);
 assert.throws(()=>validateRequest({...request(),provider_alias:'wrong'}),/alias/);
});
test('1360x2048 generate preserved but edit evidence must not be inherited',()=>{
 assert.equal(validateRequest(request()).requestSize,'1360x2048');
 assert.throws(()=>validateRequest({...request(),mode:'edit',operation:'images.generate',references:[{label:'image1',dataUrl:'data:image/png;base64,YQ=='}]}),/图片编辑未验证/);
});
