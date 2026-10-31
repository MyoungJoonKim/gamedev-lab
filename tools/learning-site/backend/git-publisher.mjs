import path from 'node:path';
import os from 'node:os';
import {readFile,writeFile,mkdir,mkdtemp,rm,lstat,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {execute} from '../tooling/grader.mjs';
import {dailyPublicationPlans,validateCommitMessage,emptyManifest,validateManifest,manifestPath} from '../site/lib/portfolio.js';
import {createHash} from 'node:crypto';
const repositoryRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
export class PublicationError extends Error {constructor(message,status=409){super(message);this.status=status;}}
function redact(value){return String(value).replace(/(?:https?|ssh):\/\/[^\s'"<>]+/gi,raw=>{try{const url=new URL(raw);return url.protocol+'//'+url.hostname+url.pathname;}catch{return '[원격 주소 숨김]';}}).replace(/\b(?:gh[pousr]_[\w]+|github_pat_[\w]+)\b/g,'[인증정보 숨김]').slice(0,12000);}
export function githubIdentity(remote) {
 let host,pathname;
 try{const url=new URL(remote);if(!['https:','ssh:'].includes(url.protocol)||url.search||url.hash)throw new PublicationError('HTTPS 또는 SSH GitHub 원격 주소를 사용하세요.');host=url.hostname;pathname=url.pathname;}catch(e){if(e instanceof PublicationError)throw e;const match=/^(?:[^@\s]+@)?([^:\s]+):(.+)$/.exec(remote);if(match){host=match[1];pathname=match[2];}}
 if(host!=='github.com')throw new PublicationError('origin의 GitHub 저장소 주소를 확인하세요.');
 const name=(pathname||'').replace(/^\/+|\/+$/g,'').replace(/\.git$/,'');
 if(!/^[\w.-]+\/[\w.-]+$/.test(name))throw new PublicationError('GitHub 저장소 식별자를 확인하세요.');return name;
}
export class GitPublisher {
 constructor({root=repositoryRoot,identity=githubIdentity}={}){this.root=root;this.identity=identity;this.busy=false;}
 async git(args,{timeout=30000,allowFailure=false}={}){
  let result;try{result=await execute('git',['-c','core.quotepath=false',...args],{cwd:this.root,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'},timeout,maxOutput:50000});}catch{throw new PublicationError('Git을 실행할 수 없습니다. Git 설치 후 PowerShell과 사이트를 다시 시작하세요.',503);}
  if(!allowFailure&&(result.code!==0||result.reason))throw new PublicationError(redact(result.log||result.reason||'Git 명령이 실패했습니다.')+'\n필요하면 PowerShell에서 Git 작성자·로그인·원격 브랜치 상태를 확인하세요.',502);
  return {...result,errorLog:result.log,log:result.stdout};
 }
 async context(){
  const actual=(await this.git(['rev-parse','--show-toplevel'])).log.trim();if(await realpath(actual)!==await realpath(this.root))throw new PublicationError('사이트가 있는 Git 저장소에서만 실행할 수 있습니다.');
  const branch=(await this.git(['symbolic-ref','--quiet','--short','HEAD'],{allowFailure:true})).log.trim();if(!branch)throw new PublicationError('이름 있는 브랜치로 전환한 뒤 이용하세요.');
  const push=(await this.git(['remote','get-url','--all','--push','origin'])).log.trim().split(/\r?\n/),fetch=(await this.git(['remote','get-url','--all','origin'])).log.trim().split(/\r?\n/);
  if(push.length!==1||fetch.length!==1)throw new PublicationError('origin에 하나의 가져오기·푸시 주소만 설정되어 있어야 합니다.');
  const repository=this.identity(push[0]);if(this.identity(fetch[0])!==repository)throw new PublicationError('가져오기 주소와 푸시 대상이 다릅니다.');
  const head=(await this.git(['rev-parse','HEAD'])).log.trim();
  const name=await this.git(['config','--get','user.name'],{allowFailure:true}),email=await this.git(['config','--get','user.email'],{allowFailure:true});
  const staged=(await this.git(['diff','--cached','--name-only'])).log.trim().split(/\r?\n/).filter(Boolean);
  return {branch,head,repository,authorConfigured:!!(name.log.trim()&&email.log.trim()),otherStagedFiles:staged.length};
 }
 async remoteHead(branch){
  const result=await this.git(['ls-remote','--exit-code','origin','refs/heads/'+branch],{timeout:30000,allowFailure:true});
  if(result.code!==0)throw new PublicationError('원격 브랜치를 읽지 못했습니다. 인터넷·Git 로그인·origin/'+branch+' 존재 여부를 확인하세요.\n'+redact(result.errorLog||result.log),502);
  const sha=result.log.trim().split(/\s/)[0];if(!/^[a-f0-9]{40,64}$/.test(sha))throw new PublicationError('원격 커밋을 확인하지 못했습니다.');return sha;
 }
 async safePath(relative){
  const root=await realpath(this.root),parts=relative.split('/');let cursor=root;
  for(let i=0;i<parts.length;i++){
   cursor=path.join(cursor,parts[i]);if(!cursor.startsWith(root+path.sep))throw new PublicationError('저장 경로를 확인하세요.');
   try{const info=await lstat(cursor);if(info.isSymbolicLink())throw new PublicationError('학습 기록 경로에 심볼릭 링크를 사용할 수 없습니다.');if(i<parts.length-1&&!info.isDirectory())throw new PublicationError('학습 기록의 상위 경로가 폴더가 아닙니다.');if(i===parts.length-1&&!info.isFile())throw new PublicationError('학습 기록 파일 경로를 확인하세요.');}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  return cursor;
 }
 async manifest(){
  const file=await this.safePath(manifestPath);let content;
  try{content=await readFile(file,'utf8');}catch(e){if(e.code==='ENOENT')return emptyManifest();throw e;}
  return validateManifest(JSON.parse(content));
 }
 async prepare(records){const context=await this.context(),plan=dailyPublicationPlans(records,await this.manifest());return {context,days:plan.days};}
 async publish({records,days,expected}){
  if(this.busy)throw new PublicationError('다른 커밋·푸시가 실행 중입니다.',429);this.busy=true;
  const results=[];let repoContext;
  const hash=text=>createHash('sha256').update(text).digest('hex');
  try{
   if(!Array.isArray(days)||!days.length||days.length>366)throw new PublicationError('커밋할 날짜를 선택하세요.');
   const context=await this.context();repoContext=context;
   if(!expected||expected.branch!==context.branch||expected.head!==context.head||expected.repository!==context.repository)throw new PublicationError('검토 이후 Git 상태가 변경되었습니다. 자동 작성 창을 다시 열어 확인하세요.');
   if(!context.authorConfigured)throw new PublicationError('Git user.name과 user.email을 먼저 설정하세요.');
   const originalManifest=await this.manifest(),plan=dailyPublicationPlans(records,originalManifest),requested=new Map();
   for(const day of days){if(requested.has(day.date)||!plan.days.some(d=>d.date===day.date))throw new PublicationError('날짜별 커밋 목록을 확인하세요.');validateCommitMessage(day.summary,day.description,day.date);requested.set(day.date,day);}
   const selected=plan.days.filter(d=>requested.has(d.date));
   const manifestFile=await this.safePath(manifestPath),manifestStatus=(await this.git(['status','--porcelain','--',manifestPath])).log.trim();
   if(manifestStatus)throw new PublicationError('학습 폴더 정보 파일의 기존 변경·스테이징을 먼저 정리하세요.');
   const remote=await this.remoteHead(context.branch);let head=context.head;
   if(remote!==head){
    const ancestor=await this.git(['merge-base','--is-ancestor',remote,head],{allowFailure:true});if(ancestor.code!==0)throw new PublicationError('원격 브랜치가 변경되었습니다. PowerShell에서 먼저 pull 상태를 정리하세요.');
    const pending=(await this.git(['rev-list','--reverse',remote+'..'+head])).log.trim().split(/\r?\n/).filter(Boolean);
    if(pending.length>366)throw new PublicationError('미업로드 커밋이 너무 많습니다. Git 상태를 먼저 정리하세요.');
    for(const commit of pending){
     const message=(await this.git(['show','-s','--format=%s',commit])).log.trim(),match=/^(?:feat|fix|refactor|test|docs|perf|chore)(?:\([a-z0-9-]+\))?: (\d{4}-\d{2}-\d{2}) /.exec(message);
     const day=match&&selected.find(d=>d.date===match[1]),files=(await this.git(['diff-tree','--no-commit-id','--name-only','-r',commit])).log.trim().split(/\r?\n/).filter(Boolean);
     if(!day||!files.length||files.some(file=>file!==manifestPath&&!file.startsWith('solutions/'+day.folder+'/')))throw new PublicationError('선택한 날짜의 학습 커밋 외에 미업로드 커밋이 있습니다. 다른 작업은 자동으로 푸시하지 않습니다. PowerShell에서 먼저 상태를 정리하세요.');
    }
   }
   const manifest=plan.manifest;
   for(const day of selected){
    const currentHead=(await this.git(['rev-parse','HEAD'])).log.trim();if(currentHead!==head)throw new PublicationError('다른 Git 작업으로 브랜치가 변경되었습니다.');
    const edits=[];
    for(const file of day.files){
     const filename=await this.safePath(file.relativePath);let content=null;try{content=await readFile(filename,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
     const tracked=await this.git(['show',head+':'+file.relativePath],{allowFailure:true}),prior=originalManifest.days[day.date]?.files[file.problemId];
     const status=(await this.git(['status','--porcelain','--',file.relativePath])).log.trim();
     if(status)throw new PublicationError('학습 파일에 기존 변경·스테이징이 있습니다: '+file.relativePath);
     if(tracked.code===0){if(!prior?.hash||hash(tracked.log)!==prior.hash)throw new PublicationError('직접 수정한 학습 파일이 있어 자동 덮어쓰기를 중단했습니다: '+file.relativePath);}
     else if(content!==null)throw new PublicationError('같은 경로에 기존 파일이 있습니다: '+file.relativePath);
     if(content!==file.content)edits.push({path:file.relativePath,filename,before:content,after:file.content});
     manifest.days[day.date].files[file.problemId].hash=hash(file.content);
    }
    // A day with identical question/code content does not need an empty commit.
    if(!edits.length){const commit=(await this.git(['log','-1','--format=%H','--','solutions/'+day.folder],{allowFailure:true})).log.trim();results.push({date:day.date,folder:day.folder,commit,changed:false});continue;}
    let oldManifest=null;try{oldManifest=await readFile(manifestFile,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
    edits.push({path:manifestPath,filename:manifestFile,before:oldManifest,after:JSON.stringify(manifest,null,2)+'\n'});
    const paths=edits.map(e=>e.path),temp=await mkdtemp(path.join(os.tmpdir(),'gdl-day-commit-'));
    try{
     for(const edit of edits){await mkdir(path.dirname(edit.filename),{recursive:true});await writeFile(edit.filename,edit.after);}
     await writeFile(path.join(temp,'message.txt'),validateCommitMessage(requested.get(day.date).summary,requested.get(day.date).description,day.date),'utf8');
     await this.git(['add','--',...paths]);await this.git(['commit','--only','--file',path.join(temp,'message.txt'),'--',...paths]);
    }catch(e){
     const afterHead=(await this.git(['rev-parse','HEAD'])).log.trim();
     if(afterHead===head){
      await this.git(['reset','-q','HEAD','--',...paths],{allowFailure:true});
      for(const edit of edits){let now;try{now=await readFile(edit.filename,'utf8');}catch{continue;}if(now!==edit.after)continue;if(edit.before===null)await rm(edit.filename);else await writeFile(edit.filename,edit.before);}
     }
     throw e;
    }finally{await rm(temp,{recursive:true,force:true});}
    const next=(await this.git(['rev-parse','HEAD'])).log.trim(),parent=(await this.git(['rev-parse',next+'^'])).log.trim(),changed=(await this.git(['diff-tree','--no-commit-id','--name-only','-r',next])).log.trim().split(/\r?\n/).filter(Boolean);
    if(parent!==head||changed.some(file=>!paths.includes(file)))throw new PublicationError('커밋에 예상하지 않은 변경이 있습니다. 로컬 커밋은 유지하고 푸시를 중단했습니다.');
    head=next;results.push({date:day.date,folder:day.folder,commit:head,changed:true});
   }
   try{await this.git(['push','--porcelain','origin',head+':refs/heads/'+context.branch],{timeout:60000});}
   catch(e){return {pushed:false,results,branch:context.branch,repository:context.repository,head,error:e.message};}
   return {pushed:true,results,branch:context.branch,repository:context.repository,head};
  }catch(e){if(results.some(r=>r.changed))return {pushed:false,results,branch:repoContext?.branch,repository:repoContext?.repository,error:e.message,head:(await this.git(['rev-parse','HEAD'])).log.trim()};throw e;}
  finally{this.busy=false;}
 }
}
