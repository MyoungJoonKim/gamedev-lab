import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {sandboxProgram,parseOutput,reportMarker,judge0Grade} from '../backend/isolated-grader.mjs';
import {execute} from '../tooling/grader.mjs';
const source='public class PocketPractice { int n=4; public int WoodCount=>n; public bool TryPickUpWood(){if(n>=5)return false;n++;return true;} }';
const mockReport={schemaVersion:1,problemId:'pocket',source,tests:['first-pickup','full-pocket','repeated-pickup'].map(name=>({name,status:'passed',actual:'fixture'}))};
const stdout=reportMarker+Buffer.from(JSON.stringify(mockReport)).toString('base64');
test('generated isolated harness really compiles and tests boundary behavior',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'gdl-harness-'));const dotnet=fileURLToPath(new URL('../../../../.tools/dotnet/dotnet',import.meta.url));
 try{
  await writeFile(path.join(dir,'Practice.csproj'),'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><ImplicitUsings>disable</ImplicitUsings></PropertyGroup></Project>');
  await writeFile(path.join(dir,'NuGet.Config'),'<configuration><packageSources><clear /></packageSources></configuration>');
  for(const input of [source,source.replace('n>=5','n>5')]){
   await writeFile(path.join(dir,'Program.cs'),sandboxProgram('pocket',input));
   const result=await execute(dotnet,['run','--project',path.join(dir,'Practice.csproj'),'-c','Release','-p:UseSharedCompilation=false'],{env:{...process.env,DOTNET_CLI_HOME:fileURLToPath(new URL('../../../../.tools/dotnet-home',import.meta.url)),DOTNET_CLI_TELEMETRY_OPTOUT:'1'},timeout:60000});
   assert.equal(result.code,0,result.log);const report=parseOutput(result.log,'pocket',input);assert.equal(report.tests.every(t=>t.status==='passed'),input===source);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('remote adapter uses configured C# runtime, disables network, hides credentials from program and parses result',async()=>{
 const calls=[],env={JUDGE0_URL:'https://judge.test',JUDGE0_LANGUAGE_ID:'51',JUDGE0_AUTH_TOKEN:'test-placeholder'};
 const fetcher=async(url,options)=>{calls.push({url,options});if(url.endsWith('/languages'))return Response.json([{id:51,name:'C# (Mono)'}]);if(options.method==='POST')return Response.json({token:'fixture-job'});return Response.json({status:{id:3},stdout:Buffer.from(stdout).toString('base64')});};
 const result=await judge0Grade('pocket',source,env,{fetcher,sleep:async()=>{}});assert.equal(result.report.tests.length,3);
 const payload=JSON.parse(calls[1].options.body);assert.equal(payload.enable_network,false);assert.equal(payload.language_id,51);assert.ok(!Buffer.from(payload.source_code,'base64').toString().includes(env.JUDGE0_AUTH_TOKEN));assert.equal(calls[0].options.headers['X-Auth-Token'],'test-placeholder');
});
test('remote compiler error is not a passing report; wrong runtime and source are rejected',async()=>{
 const env={JUDGE0_URL:'https://judge.test',JUDGE0_LANGUAGE_ID:'51'};
 const fetcher=async(url,options)=>url.endsWith('/languages')?Response.json([{id:51,name:'C#'}]):options.method==='POST'?Response.json({token:'job'}):Response.json({status:{id:6,description:'Compilation Error'},compile_output:Buffer.from('syntax failure').toString('base64')});
 const result=await judge0Grade('pocket',source,env,{fetcher});assert.ok(result.error);assert.ok(!result.report);assert.ok(result.log.includes('syntax failure'));
 await assert.rejects(()=>judge0Grade('pocket',source,env,{fetcher:async()=>Response.json([{id:51,name:'Python'}])}));assert.throws(()=>parseOutput(stdout,'pocket','wrong source'));assert.throws(()=>parseOutput('no report','pocket',source));
});
test('remote queue is polled and unfinished or rejected jobs never pass',async()=>{
 const env={JUDGE0_URL:'https://judge.test',JUDGE0_LANGUAGE_ID:'51'};let polls=0,sleeps=0;
 const fetcher=async(url,options)=>url.endsWith('/languages')?Response.json([{id:51,name:'C#'}]):options.method==='POST'?Response.json({token:'queued-job'}):++polls===1?Response.json({status:{id:2}}):Response.json({status:{id:3},stdout:Buffer.from(stdout).toString('base64')});
 const result=await judge0Grade('pocket',source,env,{fetcher,sleep:async()=>{sleeps++;}});assert.equal(result.report.tests.length,3);assert.equal(polls,2);assert.equal(sleeps,1);
 await assert.rejects(()=>judge0Grade('pocket',source,env,{fetcher:async()=>new Response('',{status:403})}),/HTTP 403/);
});
