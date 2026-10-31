import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
test('local Git endpoints require a current nonce and same-origin writes; no Git command runs for rejected requests',async()=>{
 let calls=0;const fake={context:async()=>{calls++;return {branch:'main'};},prepare:async()=>{calls++;return {days:[]};},publish:async()=>{calls++;return {pushed:true};}};
 const server=createApp({env:{},gitPublisher:fake});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await fetch(base+'/api/git/status')).status,403);assert.equal(calls,0);
  const session=await(await fetch(base+'/api/session')).json();const headers={'X-CSRF-Token':session.csrf,'Content-Type':'application/json',Origin:base};
  assert.equal((await fetch(base+'/api/git/publish',{method:'POST',headers:{...headers,Origin:'https://other.test'},body:'{}'})).status,403);assert.equal(calls,0);
  assert.equal((await fetch(base+'/api/git/status',{headers})).status,200);
  assert.equal((await fetch(base+'/api/git/prepare',{method:'POST',headers,body:'{"records":[]}'})).status,200);
  assert.equal((await fetch(base+'/api/git/publish',{method:'POST',headers,body:'{}'})).status,200);assert.equal(calls,3);
 }finally{await new Promise(r=>server.close(r));}
});
