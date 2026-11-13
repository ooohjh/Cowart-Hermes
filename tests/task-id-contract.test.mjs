import test from 'node:test';
import assert from 'node:assert/strict';
import {requestPayload,requestHash} from '../creation-service.mjs';

test('Cowart task payload excludes lifecycle metadata and has stable hash',()=>{
 const job={id:'e3042f86-4380-45d9-b6a6-cb67d2042da4',mode:'edit',prompt:'fixture',provider_alias:'test',model:'model',size:'1024x1024',referencePaths:['C:/a','C:/b'],sessionId:'session',status:'pending'};
 assert.deepEqual(requestPayload(job),{prompt:'fixture',provider_alias:'test',model:'model',size:'1024x1024',referencePaths:['C:/a','C:/b']});
 assert.equal(requestHash(job),requestHash({...job,anchor:{x:1,y:2},status:'submitted'}));
});

test('text Cowart task payload never includes references',()=>{
 const job={mode:'text',prompt:'fixture',provider_alias:'test',model:'model',size:'1024x1024',referencePaths:['must-not-send']};
 assert.deepEqual(requestPayload(job),{prompt:'fixture',provider_alias:'test',model:'model',size:'1024x1024'});
});