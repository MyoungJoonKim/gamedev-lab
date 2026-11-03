import {dailySpec} from '../site/lib/daily-problems.js';
const array=a=>'new int[]{'+a.join(',')+'}';
export function generatedTestCode(id){
 const spec=dailySpec(id);if(!spec)return null;
 const checks=spec.cases.map(c=>`Check("${c.name}",()=>{var a=${array(c.input)};var result=new DailyPractice().Solve(a);return(result!=null&&result.SequenceEqual(${array(c.expected)}),result==null?"null":string.Join(",",result));});`);
 checks.push('Check("daily-null",()=>{var r=new DailyPractice().Solve(null);return(r!=null&&r.SequenceEqual('+array(spec.cases[0].expected)+'),"null input");});');
 checks.push('Check("daily-input-unchanged",()=>{var a='+array(spec.cases[5].input)+';var before=(int[])a.Clone();new DailyPractice().Solve(a);return(a.SequenceEqual(before),"input preserved");});');
 checks.push('Check("daily-repeat",()=>{var p=new DailyPractice();var a='+array(spec.cases[5].input)+';var before=(int[])a.Clone();p.Solve(a);p.Solve('+array(spec.cases[2].input)+');var r=p.Solve(a);return(a.SequenceEqual(before)&&r!=null&&r.SequenceEqual('+array(spec.cases[5].expected)+'),"same instance, repeated input");});');
 return checks.join('\n');
}
