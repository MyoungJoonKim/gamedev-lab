import {readFileSync} from 'node:fs';
import {testCode} from '../tooling/grader.mjs';
import {validateReport} from '../site/lib/model.js';
export const reportMarker='GAMEDEV_REPORT_V1:';
export function sandboxProgram(id,source){
 if(!Object.hasOwn(testCode,id))throw Error('지원하지 않는 문제입니다.');
 const body=testCode[id].replaceAll('Enumerable.','System.Linq.Enumerable.');
 // No provider credentials, application files or session data enter this source.
 const template=readFileSync(new URL('./Judge.cs.template',import.meta.url),'utf8');
 return source+'\n'+template.replace('/*TESTS*/',()=>body).replace('SOURCEBASE64',Buffer.from(source).toString('base64')).replace('PROBLEMID',id);
}
export function parseOutput(stdout,id,source){
 const index=stdout.lastIndexOf(reportMarker);if(index<0)throw Error('실행이 완료되지 않았거나 테스트 보고서가 없습니다.');
 const encoded=stdout.slice(index+reportMarker.length).split(/\s/)[0];
 const report=validateReport(JSON.parse(Buffer.from(encoded,'base64').toString('utf8')),id);
 if(report.source!==source)throw Error('실행 원문이 일치하지 않습니다.');return report;
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
export async function judge0Grade(id,source,env=process.env,{fetcher=fetch,sleep=pause}={}){
 const deadline=Date.now()+55000;
 const base=new URL(env.JUDGE0_URL),headers={'Content-Type':'application/json'};
 if(base.protocol!=='https:')throw Error('HTTPS 채점 API가 필요합니다.');
 if(env.JUDGE0_AUTH_TOKEN)headers['X-Auth-Token']=env.JUDGE0_AUTH_TOKEN;
 if(env.JUDGE0_RAPIDAPI_KEY){if(!base.hostname.endsWith('.p.rapidapi.com'))throw Error('RapidAPI 키의 대상 호스트를 확인하세요.');headers['X-RapidAPI-Key']=env.JUDGE0_RAPIDAPI_KEY;headers['X-RapidAPI-Host']=base.hostname;}
 async function call(route,options={}){const remaining=deadline-Date.now();if(remaining<=0)throw Error('채점 서비스 응답 제한 시간을 초과했습니다.');const res=await fetcher(base.href.replace(/\/$/,'')+route,{...options,headers,redirect:'error',signal:AbortSignal.timeout(Math.min(12000,remaining))});if(!res.ok)throw Error('격리 채점 서비스 요청 실패 (HTTP '+res.status+'). 계정·요금제·설정을 확인하세요.');return res.json();}
 const languages=await call('/languages');const language=languages.find(l=>l.id===Number(env.JUDGE0_LANGUAGE_ID));if(!language||!/C#|CSharp|\.NET/i.test(language.name))throw Error('JUDGE0_LANGUAGE_ID가 실제 C# 실행 환경인지 확인하세요.');
 const submission=await call('/submissions?base64_encoded=true&wait=false',{method:'POST',body:JSON.stringify({source_code:Buffer.from(sandboxProgram(id,source)).toString('base64'),language_id:language.id,cpu_time_limit:5,wall_time_limit:15,memory_limit:262144,max_processes_and_or_threads:128,max_file_size:1024,enable_network:false})});
 if(typeof submission.token!=='string'||!/^[\w-]{1,100}$/.test(submission.token))throw Error('채점 서비스의 작업 ID를 확인하지 못했습니다.');
 for(let i=0;i<25;i++){
  const result=await call('/submissions/'+submission.token+'?base64_encoded=true&fields=stdout,stderr,compile_output,message,status');
  if([1,2].includes(result.status?.id)){await sleep(1200);continue;}
  const decode=s=>typeof s==='string'?Buffer.from(s,'base64').toString('utf8'):'';
  const log=[result.compile_output,result.stderr,result.message].map(decode).join('\n').slice(0,100000);
  if(result.status?.id!==3)return {error:'C# 컴파일 또는 실행 실패 · '+String(result.status?.description||'확인 필요'),log};
  try{return {report:parseOutput(decode(result.stdout),id,source),log};}catch(e){return {error:e.message,log};}
 }
 return {error:'채점 대기 시간이 길어졌습니다. 잠시 후 다시 시도하세요.',log:''};
}
export async function isolatedGrade(id,source,env=process.env){if(env.GRADER_BACKEND!=='judge0')throw Error('서버 격리 채점 서비스를 설정하세요.');return judge0Grade(id,source,env);}
