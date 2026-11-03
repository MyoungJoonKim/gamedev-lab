import {getProblem} from './problem-catalog.js';
import {markdown,status,validateBackup} from './model.js';
import {dayKey,validDay} from './daily.js';
const labels={pocket:'집기',slots:'인벤토리',health:'체력',fuel:'연료',cooldown:'쿨타임',nearest:'대상탐색',unique:'아이템종류',materials:'제작재료',queue:'요청대기열',stack:'실행취소',durability:'내구도',score:'점수',breakpoint:'집기디버깅',raycast:'상호작용',events:'체력UI',async:'비동기로딩',trace:'UI디버깅',profiler:'탐색최적화',ngo:'아이템동기화'};
export const manifestPath='solutions/.learning-days.json';
export const emptyManifest=()=>({version:1,days:{}});
export function validateManifest(value){
 if(!value||value.version!==1||!value.days||typeof value.days!=='object'||Array.isArray(value.days))throw Error('학습 폴더 정보 파일을 확인하세요.');
 const folders=new Set();
 for(const [day,entry]of Object.entries(value.days)){
  if(!validDay(day)||!entry||!/^\d{2,5}_[\p{L}\p{N}_-]+$/u.test(entry.folder)||folders.has(entry.folder)||!entry.files||typeof entry.files!=='object'||Array.isArray(entry.files))throw Error('학습 폴더 날짜·번호를 확인하세요.');folders.add(entry.folder);
  const names=new Set();for(const [id,file]of Object.entries(entry.files)){if(!getProblem(id)||!file||!/^\d{2,5}_[\p{L}\p{N}_-]+\.md$/u.test(file.name)||names.has(file.name)||(file.hash!==null&&!/^[a-f0-9]{64}$/.test(file.hash)))throw Error('학습 문제 파일 정보를 확인하세요.');names.add(file.name);}
 }
 return value;
}
export function validateCommitMessage(summary,description,date){
 if(typeof summary!=='string'||summary.length>140||/[\r\n\0]/.test(summary)||!/^(feat|fix|refactor|test|docs|perf|chore)(\([a-z0-9-]+\))?: \S/.test(summary)||!summary.split(': ')[1]?.startsWith(date+' '))throw Error('summary는 종류(범위): 날짜 변경 내용 형식의 한 줄로 작성하세요.');
 if(typeof description!=='string'||description.length>20000||description.includes('\0')||!['이유:','변경:','검증:'].every(label=>description.includes(label)))throw Error('description에 이유·변경·검증을 포함하세요.');
 return summary.trim()+'\n\n'+description.trim()+'\n';
}
export function dailyPublicationPlans(records,existing=emptyManifest()){
 validateBackup({version:1,drafts:{},history:records});validateManifest(existing);
 const manifest=structuredClone(existing),groups={};
 for(const record of records){const day=dayKey(record.date);(groups[day]||=[]).push(record);}
 let number=Math.max(0,...Object.values(manifest.days).map(d=>Number(d.folder.split('_')[0])));
 const days=Object.keys(groups).sort().map(date=>{
  const latest=new Map(),first=new Map();
  // Preserve initial problem order; update each problem to its last record of the day.
  for(const r of [...groups[date]].reverse().sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))){if(!first.has(r.problemId))first.set(r.problemId,r.date);latest.set(r.problemId,r);}
  const chosen=[...latest.values()].sort((a,b)=>Date.parse(first.get(a.problemId))-Date.parse(first.get(b.problemId))||a.problemId.localeCompare(b.problemId));
  const features=chosen.slice(0,3).map(r=>labels[r.problemId]||r.problemId);
  if(!manifest.days[date])manifest.days[date]={folder:String(++number).padStart(2,'0')+'_'+features.join('_')+(chosen.length>3?'_외':''),files:{}};
  const entry=manifest.days[date];let fileNumber=Math.max(0,...Object.values(entry.files).map(f=>Number(f.name.split('_')[0])));
  const files=chosen.map(record=>{
   const p=getProblem(record.problemId);
   if(!entry.files[p.id])entry.files[p.id]={name:String(++fileNumber).padStart(2,'0')+'_'+(labels[p.id]||p.id)+'.md',hash:null};
   return {problemId:p.id,title:p.title,recordId:record.id,relativePath:`solutions/${entry.folder}/${entry.files[p.id].name}`,content:markdown(p,record.draft,{date})};
  });
  const verification=chosen.map(r=>{const d=r.draft,tests=d.report?.tests||[],passed=tests.filter(t=>t.status==='passed').length;return '- '+getProblem(r.problemId).title+': '+status(d)+(tests.length?' · '+passed+'/'+tests.length+' 테스트 통과':' · 실제 테스트 미실행');});
  return {date,folder:entry.folder,recordCount:groups[date].length,problemCount:chosen.length,files,
   summary:`docs(learning): ${date} ${features.join('·')}${chosen.length>3?' 외':''} 풀이 정리`,
   description:`이유: ${date} 게임 기능 학습 내용을 일자별로 정리\n\n변경:\n${files.map(f=>'- '+f.title+' 문제와 당일 마지막 풀이 코드 작성').join('\n')}\n\n검증:\n${verification.join('\n')}`};
 });
 return {days,manifest};
}
