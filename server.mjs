import http from 'node:http';
import path from 'node:path';
import {readFile,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {grade} from './tooling/grader.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),web=path.join(root,'site');
let busy=false;
const json=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(data));};
const port=Number(process.env.PORT)||3000;
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/project'&&req.method==='GET'){
   const version=await readFile(path.join(root,'ProjectSettings/ProjectVersion.txt'),'utf8');
   const manifest=JSON.parse(await readFile(path.join(root,'Packages/manifest.json'),'utf8'));
   json(res,200,{unityVersion:version.match(/m_EditorVersion: (.+)/)?.[1]||'확인 필요',mcpPackage:manifest.dependencies['com.coplaydev.unity-mcp']||null,ngoPackage:manifest.dependencies['com.unity.netcode.gameobjects']||null});return;
  }
  if(url.pathname==='/api/grade'){
   if(req.method!=='POST'){json(res,405,{error:'POST 요청만 지원합니다.'});return;}
   const host=req.headers.host||'';
   if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)||req.headers.origin!==`http://${host}`||req.headers['content-type']!=='application/json'){json(res,403,{error:'로컬 사이트에서 JSON 요청으로 본인 코드만 실행할 수 있습니다.'});return;}
   if(busy){json(res,429,{error:'이미 채점 중입니다. 완료 후 다시 시도하세요.'});return;}
   busy=true;
   try{
    let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>100000){json(res,413,{error:'코드는 100KB 이하여야 합니다.'});return;}}
    let data;try{data=JSON.parse(body);}catch{json(res,400,{error:'JSON 형식을 확인하세요.'});return;}
    if(typeof data.source!=='string'||!data.source.trim()||!['pocket','slots'].includes(data.problemId)){json(res,400,{error:'문제 ID와 C# 원문을 확인하세요.'});return;}
    const result=await grade(data.problemId,data.source);json(res,result.error?422:200,result);
   }finally{busy=false;}return;
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  const file=await realpath(path.resolve(web,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)));
  if(!file.startsWith(web+path.sep)){res.writeHead(403).end();return;}
  const body=await readFile(file);const types={'.js':'text/javascript; charset=utf-8','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'"}).end(req.method==='HEAD'?undefined:body);
 }catch(e){if(!res.headersSent)json(res,e.code==='ENOENT'?404:500,{error:e.code==='ENOENT'?'파일을 찾을 수 없습니다.':e.message});else res.end();}
});
server.listen(port,'127.0.0.1',()=>console.log(`GameDev Lab started on port ${port}`));
