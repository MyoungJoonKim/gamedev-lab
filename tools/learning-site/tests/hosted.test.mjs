import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Store,emptyState} from '../backend/store.mjs';
import {createApp} from '../server.mjs';
import {hostedConfig,equal} from '../backend/auth.mjs';
const env={APP_MODE:'hosted',NODE_ENV:'production',PUBLIC_BASE_URL:'https://lab.example.test',DATA_DIR:'/tmp/gamedev-test',GITHUB_CLIENT_ID:'test-client',GITHUB_CLIENT_SECRET:'test-only-placeholder',ALLOWED_GITHUB_LOGIN:'MyoungJoonKim',GRADER_BACKEND:'judge0',JUDGE0_URL:'https://judge.example.test',JUDGE0_LANGUAGE_ID:'51'};
const cookiePair=value=>value.split(';')[0];
test('token comparisons reject non-ASCII and mismatched values without throwing',()=>{assert.equal(equal('é','a'),false);assert.equal(equal(null,'a'),false);assert.equal(equal('same','same'),true);});
test('hosted mode fails closed without authentication, HTTPS, identity or isolated grading config',()=>{
 for(const change of [{PUBLIC_BASE_URL:'http://example.com'},{GITHUB_CLIENT_SECRET:''},{ALLOWED_GITHUB_LOGIN:''},{GRADER_BACKEND:'local'},{JUDGE0_URL:'http://example.com'},{JUDGE0_LANGUAGE_ID:'0'}])assert.throws(()=>hostedConfig({...env,...change}));
 assert.throws(()=>createApp({env:{NODE_ENV:'production'}}));
});
test('SQLite retains records, validates input and rejects stale revisions',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'gamedev-db-')),file=path.join(dir,'test.sqlite');let store=new Store(file);
 try{const state=emptyState();state.drafts.pocket={code:'first'};assert.equal(store.save('77',0,state),1);assert.equal(store.save('77',0,emptyState()),null);assert.equal(store.load('77').state.drafts.pocket.code,'first');store.close();store=new Store(file);assert.equal(store.load('77').revision,1);assert.throws(()=>store.save('77',1,{bad:true}));assert.equal(store.load('77').revision,1);}finally{store.close();await rm(dir,{recursive:true,force:true});}
});
test('GitHub OAuth, pinned owner, secure sessions, CSRF, cross-PC storage and isolated dispatch',async()=>{
 const store=new Store(':memory:');let user={id:77,login:'MyoungJoonKim'},graded=0;
 const authFetch=async(url,options)=>{if(url.endsWith('/access_token')){assert.equal(options.body.get('client_id'),'test-client');assert.ok(options.body.get('code_verifier'));return Response.json({access_token:'not-a-real-access-token'});}assert.equal(url,'https://api.github.com/user');return Response.json(user);};
 const server=createApp({env,store,authFetch,runIsolated:async()=>{graded++;return {report:{fixture:true}};}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const request=(url,options={})=>fetch(base+url,{redirect:'manual',...options});
 async function login(){const begin=await request('/auth/github');assert.equal(begin.status,302);const location=new URL(begin.headers.get('location')),state=location.searchParams.get('state');assert.ok(location.searchParams.get('code_challenge'));const cookie=cookiePair(begin.headers.get('set-cookie'));return {state,cookie};}
 async function callback(start){return request('/auth/github/callback?state='+start.state+'&code=test-code',{headers:{Cookie:start.cookie}});}
 try{
  assert.equal((await request('/api/state')).status,401);assert.equal((await request('/api/grade',{method:'POST'})).status,401);assert.equal(graded,0);
  let start=await login();assert.equal((await request('/auth/github/callback?state=wrong&code=test',{headers:{Cookie:start.cookie}})).status,403);
  user={id:88,login:'SomeoneElse'};assert.equal((await callback(start)).status,403);assert.equal(store.owner(),undefined);
  user={id:77,login:'MyoungJoonKim'};start=await login();const auth=await callback(start);assert.equal(auth.status,302);assert.ok(auth.headers.get('set-cookie').includes('HttpOnly; Secure; SameSite=Lax'));assert.equal(store.owner(),'77');
  const cookie=cookiePair(auth.headers.getSetCookie()[0]);assert.equal((await callback(start)).status,403);
  const session=await (await request('/api/session',{headers:{Cookie:cookie}})).json();assert.equal(session.id,'77');assert.ok(session.csrf);
  const headers={Cookie:cookie,Origin:env.PUBLIC_BASE_URL,'Content-Type':'application/json','X-CSRF-Token':session.csrf};
  assert.equal((await request('/api/state',{method:'PUT',headers:{...headers,Origin:'https://evil.test'},body:'{}'})).status,403);
  assert.equal((await request('/api/state',{method:'PUT',headers:{...headers,'X-CSRF-Token':'wrong'},body:'{}'})).status,403);
  const state=emptyState();state.drafts.pocket={code:'from pc A'};
  assert.equal((await request('/api/state',{method:'PUT',headers,body:JSON.stringify({revision:0,state})})).status,200);
  assert.equal((await request('/api/state',{method:'PUT',headers,body:JSON.stringify({revision:0,state:emptyState()})})).status,409);
  user={id:77,login:'RenamedOwner'};const pcB=await callback(await login());assert.equal(pcB.status,302);const cookieB=cookiePair(pcB.headers.getSetCookie()[0]);
  const remote=await(await request('/api/state',{headers:{Cookie:cookieB}})).json();assert.equal(remote.state.drafts.pocket.code,'from pc A');
  assert.equal((await request('/api/grade',{method:'POST',headers,body:JSON.stringify({problemId:'pocket',source:'code'})})).status,200);assert.equal(graded,1);
  assert.equal((await request('/api/logout',{method:'POST',headers,body:'{}'})).status,204);assert.equal((await request('/api/state',{headers:{Cookie:cookie}})).status,401);
  user={id:88,login:'MyoungJoonKim'};assert.equal((await callback(await login())).status,403);
 }finally{await new Promise(r=>server.close(r));store.close();}
});
test('OAuth state is one-use and bounded; expired sessions are rejected',()=>{
 const store=new Store(':memory:');try{store.putOauth('state','verifier');assert.ok(store.takeOauth('state'));assert.equal(store.takeOauth('state'),null);store.putOauth('expired','v');store.db.prepare('UPDATE oauth SET expires=0').run();assert.equal(store.takeOauth('expired'),null);for(let i=0;i<100;i++)store.putOauth('state-'+i,'v');assert.throws(()=>store.putOauth('overflow','v'));store.createSession('hash','77','owner','csrf');store.db.prepare('UPDATE sessions SET expires=0').run();assert.equal(store.session('hash'),undefined);}finally{store.close();}
});
