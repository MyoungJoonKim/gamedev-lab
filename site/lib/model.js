import {problems,quiz} from './data.js';
export const requiredTests={pocket:['first-pickup','full-pocket','repeated-pickup'],slots:['empty','fill-existing','overflow','zero','negative','independent']};
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function validateReport(value,id){
 if(!value||value.schemaVersion!==1||value.problemId!==id||typeof value.source!=='string'||!value.source.trim()||!Array.isArray(value.tests)||!value.tests.length||value.tests.length>1000)throw Error('현재 문제의 코드 원문과 테스트가 포함된 v1 보고서가 필요합니다.');
 const seen=new Set();
 for(const t of value.tests){if(typeof t.name!=='string'||!t.name.trim()||seen.has(t.name)||!['passed','failed','skipped'].includes(t.status))throw Error('테스트 이름은 중복 없이, 상태는 passed/failed/skipped로 작성하세요.');seen.add(t.name);}
 if(requiredTests[id]&&!requiredTests[id].every(name=>value.tests.some(t=>t.name===name&&t.status!=='skipped')))throw Error('문제의 필수 테스트를 모두 실행해야 합니다.');
 return {schemaVersion:1,problemId:id,source:value.source,runner:String(value.runner||'외부 테스트'),tests:value.tests.map(t=>({name:t.name,status:t.status,actual:String(t.actual??'')}))};
}
export function status(d){
 if(!d?.report)return '미검증';
 if(d.code!==d.report.source)return '재검증 필요';
 if(d.report.tests.some(t=>t.status==='failed'))return '실패';
 if(d.report.tests.some(t=>t.status==='skipped'))return '일부 미실행';
 return '통과';
}
export function markdown(p,d){
 const fence='`'.repeat(Math.max(3,...(d.code.match(/`+/g)||[]).map(x=>x.length+1)));
 return `# ${p.title}\n\n날짜: ${today()} · GameDev Lab\n\n## 문제와 요구사항\n${p.text}\n${p.requirements.map(x=>'- '+x).join('\n')}\n\n## 첫 접근과 가설\n${d.approach||'미작성'}\n\n## 풀이 코드\n${fence}csharp\n${d.code}\n${fence}\n\n## 재현 · 근거 · 수정 · 회귀 검증\n${d.notes||'미작성'}\n\n## 테스트 결과\n상태: ${status(d)}\n출처: ${d.origin==='server'?'서버 격리 C# 실행':d.origin==='local'?'로컬 .NET 실제 실행':'사용자 제공 외부 증거 (독립적으로 인증하지 않음)'}\n${d.report?d.report.tests.map(t=>'- '+t.name+': '+t.status+' / '+t.actual).join('\n'):'코드 실행 결과 없음'}\n\n## 성능 비교와 선택 이유\n${d.performance||'미측정'}\n\n## 검토 제안 (실측 결과 아님)\n${p.feedback}\n\n## AI 도움을 받은 범위\n${d.ai||'미작성'}\n\n## 다음 실험\n${d.next||'미작성'}\n`;
}
export function validateBackup(b){
 if(!b||b.version!==1||!b.drafts||typeof b.drafts!=='object'||Array.isArray(b.drafts)||!Array.isArray(b.history)||b.history.length>5000)throw Error('유효한 GameDev Lab 백업이 아닙니다.');
 const checkDraft=(d,id)=>{if(!problems.some(p=>p.id===id)||!d||typeof d.code!=='string')throw Error('풀이 데이터가 올바르지 않습니다.');for(const key of ['approach','notes','performance','ai','next'])if(d[key]!==undefined&&typeof d[key]!=='string')throw Error('분석 노트 형식을 확인하세요.');if(d.report)validateReport(d.report,id);};
 for(const [id,d]of Object.entries(b.drafts))checkDraft(d,id);
 for(const h of b.history){if(typeof h.id!=='string'||!Number.isFinite(Date.parse(h.date)))throw Error('이력 날짜와 ID를 확인하세요.');checkDraft(h.draft,h.problemId);}
 if(b.diagnosis&&(!Array.isArray(b.diagnosis.answers)||b.diagnosis.answers.length!==quiz.length||!b.diagnosis.answers.every((v,i)=>Number.isInteger(v)&&v>=0&&v<quiz[i].options.length)))throw Error('진단 답변을 확인하세요.');
 return b;
}
