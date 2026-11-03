import {problems} from './data.js';
import {dailyId,dailySpec} from './daily-problems.js';
export const dailyCount=3;
export const dailyPool=problems.filter(p=>p.runner&&['입문','기초'].includes(p.level));
export function dayKey(value=new Date()) {
 const date=new Date(value);if(!Number.isFinite(date.getTime()))throw Error('날짜를 확인하세요.');
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function validDay(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
export function ensureDaily(state,day=dayKey()) {
 if(!validDay(day))throw Error('날짜를 확인하세요.');
 state.daily ||= {};
 const current=state.daily[day];
 if(current&&(day!==dayKey()||current.problemIds.some(id=>dailySpec(id))))return false;
 // Upgrade today's old foundation assignment without destroying its evidence.
 const legacyAssignment=current?structuredClone(current):null;
 const previous=Object.keys(state.daily).filter(date=>date<day).sort().at(-1);
 const prior=previous?state.daily[previous]:null;
 // Each difficulty has its own slot. Preserve the ID (and draft) until it passes.
 const ids=[0,1,2].map(tier=>{
  const id=prior?.problemIds.find(id=>dailySpec(id)?.tier===tier);
  return id&&!prior.completed?.[id]?id:dailyId(day,tier);
 });
 state.daily[day]={problemIds:ids,completed:{},...(legacyAssignment?{legacyAssignment}:{} )};
 return true;
}
export function completeDaily(state,id,report,at=new Date().toISOString()) {
 const day=dayKey(at);ensureDaily(state,day);const entry=state.daily[day];
 if(!entry.problemIds.includes(id)||!report?.tests?.length||report.tests.some(t=>t.status!=='passed'))return false;
 if(entry.completed[id])return false;
 entry.completed[id]={at,tests:report.tests.length};return true;
}
export function dailyProgress(state,day=dayKey()) {
 const entry=state.daily?.[day];const completed=entry?entry.problemIds.filter(id=>entry.completed?.[id]).length:0;
 return {entry,completed,target:dailyCount,done:completed===dailyCount};
}
export function mergeDaily(current={},incoming={}) {
 const merged=structuredClone(current);
 for(const [day,entry]of Object.entries(incoming)){
  if(!merged[day]){merged[day]=structuredClone(entry);continue;}
  for(const id of merged[day].problemIds)if(entry.completed?.[id]&&!merged[day].completed[id])merged[day].completed[id]=structuredClone(entry.completed[id]);
 }
 return merged;
}
