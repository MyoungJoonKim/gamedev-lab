import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const testCode={
 pocket:`
  Check("first-pickup",()=>{var p=new PocketPractice();bool ok=p.TryPickUpWood();return (ok&&p.WoodCount==5,$"count={p.WoodCount}, return={ok}");});
  Check("full-pocket",()=>{var p=new PocketPractice();p.TryPickUpWood();bool ok=p.TryPickUpWood();return (!ok&&p.WoodCount==5,$"count={p.WoodCount}, return={ok}");});
  Check("repeated-pickup",()=>{var p=new PocketPractice();int n=0;bool valid=true;for(int i=0;i<100;i++){if(p.TryPickUpWood())n++;valid&=p.WoodCount<=5;}return (valid&&n==1&&p.WoodCount==5,$"count={p.WoodCount}, successes={n}");});`,
 slots:`
  Check("empty",()=>{var p=new SlotPractice();var a=Enumerable.Range(0,4).Select(p.GetCount).ToArray();return(a.All(x=>x==0),string.Join(",",a));});
  Check("fill-existing",()=>{var p=new SlotPractice();int a=p.AddWood(4),b=p.AddWood(3);return(a==0&&b==0&&p.GetCount(0)==5&&p.GetCount(1)==2&&p.GetCount(2)==0&&p.GetCount(3)==0,$"{p.GetCount(0)},{p.GetCount(1)},{p.GetCount(2)},{p.GetCount(3)} remaining={b}");});
  Check("overflow",()=>{var p=new SlotPractice();int n=p.AddWood(23);return(n==3&&Enumerable.Range(0,4).All(i=>p.GetCount(i)==5),$"remaining={n}");});
  Check("zero",()=>{var p=new SlotPractice();p.AddWood(2);int n=p.AddWood(0);return(n==0&&p.GetCount(0)==2&&Enumerable.Range(1,3).All(i=>p.GetCount(i)==0),$"remaining={n}, count={p.GetCount(0)}");});
  Check("negative",()=>{var p=new SlotPractice();p.AddWood(2);int n=p.AddWood(-1);return(n==0&&p.GetCount(0)==2&&Enumerable.Range(1,3).All(i=>p.GetCount(i)==0),$"remaining={n}, count={p.GetCount(0)}");});
  Check("independent",()=>{var a=new SlotPractice();var b=new SlotPractice();a.AddWood(7);return(Enumerable.Range(0,4).All(i=>b.GetCount(i)==0),$"new instance first slot={b.GetCount(0)}");});`
};
export function execute(command,args,{cwd,env,timeout=60000,maxOutput=100000}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd,env,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});let log='',reason='';
  const stop=()=>{try{if(process.platform==='win32')child.kill();else process.kill(-child.pid,'SIGKILL');}catch{}};
  const timer=setTimeout(()=>{reason='실행 제한 시간을 초과했습니다.';stop();},timeout);
  function collect(chunk){log+=chunk.toString();if(log.length>maxOutput){log=log.slice(0,maxOutput);reason='실행 출력 한도를 초과했습니다.';stop();}}
  child.stdout.on('data',collect);child.stderr.on('data',collect);
  child.once('error',e=>{clearTimeout(timer);reject(e);});
  child.once('close',code=>{clearTimeout(timer);resolve({code,log,reason});});
 });
}
export async function grade(id,source){
 if(!Object.hasOwn(testCode,id))throw Error('자동 채점을 지원하지 않는 문제입니다.');
 const sdkDir=process.env.GAMEDEV_DOTNET_DIR||path.resolve(root,'../.tools/dotnet');
 const env={...process.env,PATH:sdkDir+path.delimiter+process.env.PATH,DOTNET_CLI_HOME:path.resolve(root,'../.tools/dotnet-home'),DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_NOLOGO:'1',DOTNET_SKIP_FIRST_TIME_EXPERIENCE:'1'};
 let version;try{version=await execute('dotnet',['--version'],{env,timeout:10000});}catch{throw Error('.NET SDK 8 이상이 필요합니다. README의 설치 안내를 확인하세요.');}
 const major=Number(version.log.trim().split('.')[0]);if(version.code!==0||!Number.isInteger(major)||major<8)throw Error('.NET SDK 8 이상을 설치하세요.');
 const dir=await mkdtemp(path.join(os.tmpdir(),'gamedev-lab-'));
 try{
  const harness=(await readFile(path.join(root,'tooling/Program.cs'),'utf8')).replace('// TESTS',testCode[id]);
  await writeFile(path.join(dir,'Program.cs'),harness);await writeFile(path.join(dir,'Solution.cs'),source);
  await writeFile(path.join(dir,'Practice.csproj'),`<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net${major}.0</TargetFramework><ImplicitUsings>disable</ImplicitUsings><Nullable>disable</Nullable><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="Program.cs"/><Compile Include="Solution.cs"/></ItemGroup></Project>`);
  await writeFile(path.join(dir,'NuGet.Config'),'<configuration><packageSources><clear /></packageSources></configuration>');
  const output=path.join(dir,'report.json');
  const result=await execute('dotnet',['run','--project',path.join(dir,'Practice.csproj'),'-c','Release','-p:UseSharedCompilation=false','--',output,path.join(dir,'Solution.cs'),id],{cwd:dir,env});
  if(result.reason)return {error:result.reason,log:result.log};
  let report;try{report=JSON.parse(await readFile(output,'utf8'));}catch{return {error:'컴파일 또는 실행에 실패했습니다.',log:result.log};}
  if(report.source!==source||report.problemId!==id)throw Error('실행 보고서가 제출 코드와 일치하지 않습니다.');
  return {report,log:result.log};
 }finally{await rm(dir,{recursive:true,force:true});}
}
