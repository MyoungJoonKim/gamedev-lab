import {dailyTestNames,dailySpec} from './daily-problems.js';
import {getProblem} from './problem-catalog.js';
import {basicRequiredTests} from './basic-problems.js';
import {validDay,dayKey,dailyPool} from './daily.js';
import {quiz} from './data.js';
export const requiredTests={...basicRequiredTests,pocket:['first-pickup','full-pocket','repeated-pickup'],slots:['empty','fill-existing','overflow','zero','negative','independent']};
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function validateReport(value,id){
 if(!value||value.schemaVersion!==1||value.problemId!==id||typeof value.source!=='string'||!value.source.trim()||!Array.isArray(value.tests)||!value.tests.length||value.tests.length>1000)throw Error('현재 문제의 코드 원문과 테스트가 포함된 v1 보고서가 필요합니다.');
 const seen=new Set();
 for(const t of value.tests){if(typeof t.name!=='string'||!t.name.trim()||seen.has(t.name)||!['passed','failed','skipped'].includes(t.status))throw Error('테스트 이름은 중복 없이, 상태는 passed/failed/skipped로 작성하세요.');seen.add(t.name);}
 const required=requiredTests[id]||dailyTestNames(id);
 if(required&&!required.every(name=>value.tests.some(t=>t.name===name&&t.status!=='skipped')))throw Error('문제의 필수 테스트를 모두 실행해야 합니다.');
 return {schemaVersion:1,problemId:id,source:value.source,runner:String(value.runner||'외부 테스트'),tests:value.tests.map(t=>({name:t.name,status:t.status,actual:String(t.actual??'')}))};
}
export function status(d){
 if(!d?.report)return '미검증';
 if(d.code!==d.report.source)return '재검증 필요';
 if(d.report.tests.some(t=>t.status==='failed'))return '실패';
 if(d.report.tests.some(t=>t.status==='skipped'))return '일부 미실행';
 return '통과';
}
export function markdown(p,d,{date=today()}={}){
 const fence='`'.repeat(Math.max(3,...(d.code.match(/`+/g)||[]).map(x=>x.length+1)));
 return `# ${p.title}

## 문제

학습일: ${date}

${p.text}

${p.requirements.map(x=>'- '+x).join('\n')}

## 내 풀이 코드

${fence}csharp
${d.code}
${fence}
`;
}

export function validateBackup(b){
 if(!b||b.version!==1||!b.drafts||typeof b.drafts!=='object'||Array.isArray(b.drafts)||!Array.isArray(b.history)||b.history.length>5000)throw Error('유효한 GameDev Lab 백업이 아닙니다.');
 const checkDraft=(d,id)=>{if(!getProblem(id)||!d||typeof d.code!=='string')throw Error('풀이 데이터가 올바르지 않습니다.');for(const key of ['approach','notes','performance','ai','next'])if(d[key]!==undefined&&typeof d[key]!=='string')throw Error('분석 노트 형식을 확인하세요.');if(d.report)validateReport(d.report,id);};
 for(const [id,d]of Object.entries(b.drafts))checkDraft(d,id);
 for(const h of b.history){if(typeof h.id!=='string'||!Number.isFinite(Date.parse(h.date)))throw Error('이력 날짜와 ID를 확인하세요.');checkDraft(h.draft,h.problemId);}
 if(b.diagnosis&&(!Array.isArray(b.diagnosis.answers)||b.diagnosis.answers.length!==quiz.length||!b.diagnosis.answers.every((v,i)=>Number.isInteger(v)&&v>=0&&v<quiz[i].options.length)))throw Error('진단 답변을 확인하세요.');
 if(b.daily!==undefined){
  if(!b.daily||typeof b.daily!=='object'||Array.isArray(b.daily)||Object.keys(b.daily).length>10000)throw Error('일일 할당 기록을 확인하세요.');
  for(const [day,entry]of Object.entries(b.daily)){
   if(!validDay(day)||!entry||!Array.isArray(entry.problemIds)||entry.problemIds.length!==3||new Set(entry.problemIds).size!==3||!entry.problemIds.every(id=>(dailyPool.some(p=>p.id===id)||Boolean(dailySpec(id))))||!entry.completed||typeof entry.completed!=='object'||Array.isArray(entry.completed))throw Error('일일 문제 할당 형식을 확인하세요.');
   for(const [id,c]of Object.entries(entry.completed))if(!entry.problemIds.includes(id)||!c||typeof c.at!=='string'||!Number.isFinite(Date.parse(c.at))||dayKey(c.at)!==day||!Number.isInteger(c.tests)||c.tests<1)throw Error('일일 달성 기록을 확인하세요.');
  }
 }
 if(b.gitPublications!==undefined){
  if(!b.gitPublications||typeof b.gitPublications!=='object'||Array.isArray(b.gitPublications)||Object.keys(b.gitPublications).length>5000)throw Error('Git 업로드 기록을 확인하세요.');
  for(const [id,p]of Object.entries(b.gitPublications))if(!/^[\w-]{1,100}$/.test(id)||!p||! /^[a-f0-9]{40,64}$/.test(p.commit)||typeof p.branch!=='string'||typeof p.repository!=='string'||typeof p.pushed!=='boolean')throw Error('Git 업로드 기록 형식을 확인하세요.');
 }
 return b;
}
