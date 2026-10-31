import http from 'node:http';
import path from 'node:path';
import {readFile,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {grade} from './tooling/grader.mjs';
import {isolatedGrade} from './backend/isolated-grader.mjs';
import {createAuth,hostedConfig} from './backend/auth.mjs';
import {Store} from './backend/store.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),web=path.join(root,'site');
const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Cache-Control':'no-store'};
const json=(res,code,data)=>{res.writeHead(code,{...security,'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify(data));};
async function bodyJson(req,limit){let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>limit){const e=Error('요청 크기 제한을 초과했습니다.');e.status=413;throw e;}}try{return JSON.parse(body);}catch{const e=Error('JSON 형식을 확인하세요.');e.status=400;throw e;}}
export function createApp({env=process.env,store:providedStore,authFetch=fetch,runIsolated=isolatedGrade}={}){
 const hosted=env.APP_MODE==='hosted';if(env.NODE_ENV==='production'&&!hosted)throw Error('프로덕션에서는 APP_MODE=hosted가 필요합니다. 로컬 실행을 공개하지 않습니다.');
 const config=hosted?hostedConfig(env):null;
 if(hosted&&(!env.DATA_DIR||!path.isAbsolute(env.DATA_DIR)))throw Error('DATA_DIR에 영구 디스크의 절대 경로를 설정하세요.');
 const store=hosted?(providedStore||new Store(path.join(env.DATA_DIR,'gamedev.sqlite'))):null;
 const auth=hosted?createAuth(store,config,{fetcher:authFetch}):null;let busy=false;
 const server=http.createServer(async(req,res)=>{
  for(const [key,value]of Object.entries(security))res.setHeader(key,value);
  if(hosted)res.setHeader('Strict-Transport-Security','max-age=31536000');
  try{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/healthz'){json(res,200,{ok:true,mode:hosted?'hosted':'local'});return;}
   if(hosted&&url.pathname==='/auth/github'&&req.method==='GET'){auth.begin(res);return;}
   if(hosted&&url.pathname==='/auth/github/callback'&&req.method==='GET'){
    try{await auth.callback(req,res,url);}catch(e){res.writeHead(403,{'Content-Type':'text/plain; charset=utf-8'}).end(e.message+'\n사이트로 돌아가 다시 로그인하세요.');}return;
   }
   const session=hosted?auth.session(req):null;
   if(url.pathname==='/api/session'&&req.method==='GET'){json(res,200,{mode:hosted?'hosted':'local',authenticated:!hosted||!!session,...(session?{login:session.login,id:session.github_id,csrf:session.csrf}:{})});return;}
   if(url.pathname.startsWith('/api/')&&hosted&&!session){json(res,401,{error:'GitHub 로그인이 필요합니다.'});return;}
   if(hosted&&['POST','PUT','DELETE','PATCH'].includes(req.method)&&!auth.canWrite(req,session)){json(res,403,{error:'요청 출처 또는 로그인 토큰이 일치하지 않습니다. 다시 로그인하세요.'});return;}
   if(url.pathname==='/api/logout'&&req.method==='POST'&&hosted){auth.logout(req,res);return;}
   if(url.pathname==='/api/state'&&hosted){
    if(req.method==='GET'){json(res,200,store.load(session.github_id));return;}
    if(req.method==='PUT'){
     const data=await bodyJson(req,5e6+10000);if(!Number.isInteger(data.revision)||data.revision<0){json(res,400,{error:'저장 버전을 확인하세요.'});return;}
     let revision;try{revision=store.save(session.github_id,data.revision,data.state);}catch(e){json(res,400,{error:e.message});return;}
     if(revision===null){json(res,409,{error:'다른 탭 또는 PC에서 기록이 변경되었습니다. 현재 기록을 백업한 후 서버 기록을 불러오세요.'});return;}
     json(res,200,{revision});return;
    }json(res,405,{error:'GET 또는 PUT만 지원합니다.'});return;
   }
   if(url.pathname==='/api/project'&&req.method==='GET'){
    const version=await readFile(path.join(root,'ProjectSettings/ProjectVersion.txt'),'utf8');const manifest=JSON.parse(await readFile(path.join(root,'Packages/manifest.json'),'utf8'));
    json(res,200,{unityVersion:version.match(/m_EditorVersion: (.+)/)?.[1]||'확인 필요',mcpPackage:manifest.dependencies['com.coplaydev.unity-mcp']||null,ngoPackage:manifest.dependencies['com.unity.netcode.gameobjects']||null});return;
   }
   if(url.pathname==='/api/grade'){
    if(req.method!=='POST'){json(res,405,{error:'POST 요청만 지원합니다.'});return;}
    const host=req.headers.host||'';
    if(!hosted&&(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)||req.headers.origin!==`http://${host}`||req.headers['content-type']!=='application/json')){json(res,403,{error:'로컬 사이트에서 JSON 요청으로 본인 코드만 실행할 수 있습니다.'});return;}
    if(busy){json(res,429,{error:'이미 채점 중입니다. 완료 후 다시 시도하세요.'});return;}
    busy=true;
    try{const data=await bodyJson(req,100000);if(typeof data.source!=='string'||!data.source.trim()||!['pocket','slots'].includes(data.problemId)){json(res,400,{error:'문제 ID와 C# 원문을 확인하세요.'});return;}
     const result=hosted?await runIsolated(data.problemId,data.source,env):await grade(data.problemId,data.source);json(res,result.error?422:200,result);
    }finally{busy=false;}return;
   }
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
   const file=await realpath(path.resolve(web,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)));if(!file.startsWith(web+path.sep)){res.writeHead(403).end();return;}
   const body=await readFile(file);const types={'.js':'text/javascript; charset=utf-8','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
   res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'"}).end(req.method==='HEAD'?undefined:body);
  }catch(e){if(!res.headersSent)json(res,e.status||(e.code==='ENOENT'?404:500),{error:e.status?e.message:e.code==='ENOENT'?'파일을 찾을 수 없습니다.':'서버 요청을 완료하지 못했습니다. 배포 설정과 서버 로그를 확인하세요.'});else res.end();}
 });
 server.requestTimeout=90000;server.headersTimeout=15000;
 server.on('close',()=>{if(store&&!providedStore)store.close();});
 return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT)||3000;const server=createApp();
 server.listen(port,process.env.APP_MODE==='hosted'?'0.0.0.0':'127.0.0.1',()=>{console.log(`GameDev Lab started on port ${port} (${process.env.APP_MODE==='hosted'?'hosted':'local'})`);if(process.env.APP_MODE!=='hosted')console.log('사이트 이용 중에는 이 창을 켜 두세요. 최소화 가능 / 서버 종료: Ctrl+C');});
}
