// Versioned deterministic daily variants. Keep v1 stable so saved work remains reproducible.
const levels=['입문','초급','중급'];
const themes=['우주 정거장','던전 원정대','해적선','로봇 공장','농장','레이싱 팀','성 수비대'];
const templates=[
 [
  ['경보 센서 집계','센서 값 중 기준 이상인 값의 개수를 반환하세요.',(a,k)=>[a.filter(n=>n>=k).length],'순회하면서 조건을 만족하는 항목만 세어 보세요.'],
  ['이동 명령 제한','각 이동 명령을 0 이상 기준 이하로 제한한 배열을 반환하세요.',(a,k)=>a.map(n=>Math.max(0,Math.min(k,n))),'각 원소의 하한과 상한을 따로 생각하세요.'],
  ['안전 경로 찾기','0 이상 기준 이하인 첫 값의 인덱스를 반환하세요. 없으면 -1입니다.',(a,k)=>[a.findIndex(n=>n>=0&&n<=k)],'조건을 처음 만족했을 때 탐색을 끝낼 수 있습니다.']
 ],
 [
  ['연속 경보 분석','기준 이상인 값이 연속해서 나타나는 최대 길이를 반환하세요.',(a,k)=>{let best=0,n=0;for(const v of a){n=v>=k?n+1:0;best=Math.max(best,n);}return [best];},'현재 연속 길이와 지금까지의 최대 길이는 다른 상태입니다.'],
  ['보급 중복 제거','0 이상인 ID만 첫 등장 순서대로 한 번씩 반환하세요. 기준 값은 사용하지 않습니다.',a=>[...new Set(a.filter(n=>n>=0))],'존재 여부와 출력 순서를 함께 관리하세요.'],
  ['동일 신호 압축','인접한 같은 값들을 하나로 압축한 배열을 반환하세요. 음수도 유효하며 기준 값은 사용하지 않습니다.',a=>a.filter((n,i)=>i===0||n!==a[i-1]),'이미 처리한 직전 값과 현재 값을 비교하세요.']
 ],
 [
  ['구역 최대 부하','길이가 기준인 연속 구간 중 합이 최대인 구간의 [시작 인덱스, 합]을 반환하세요. 동률이면 앞 구간이며 길이가 부족하면 [-1, 0]입니다.',(a,k)=>{if(a.length<k)return [-1,0];let sum=a.slice(0,k).reduce((x,y)=>x+y,0),best=sum,index=0;for(let i=k;i<a.length;i++){sum+=a[i]-a[i-k];if(sum>best){best=sum;index=i-k+1;}}return [index,best];},'구간을 한 칸 옮길 때 빠지는 값과 들어오는 값에 주목하세요.'],
  ['목표 합 보급쌍','합이 기준인 서로 다른 두 인덱스 [i, j]를 찾으세요(i < j). j가 가장 작고, 동률이면 i가 가장 작은 쌍이며 없으면 [-1, -1]입니다.',(a,k)=>{const seen=new Map();for(let j=0;j<a.length;j++){if(seen.has(k-a[j]))return [seen.get(k-a[j]),j];if(!seen.has(a[j]))seen.set(a[j],j);}return [-1,-1];},'현재 값에 필요한 짝을 앞에서 본 적이 있는지 확인하세요.'],
  ['신호 빈도 순위','각 값을 빈도 내림차순, 빈도가 같으면 값 오름차순으로 정렬하고 상위 기준 개의 서로 다른 값을 반환하세요. 음수도 유효합니다.',(a,k)=>{const counts=new Map();for(const n of a)counts.set(n,(counts.get(n)||0)+1);return [...counts].sort((x,y)=>y[1]-x[1]||x[0]-y[0]).slice(0,k).map(x=>x[0]);},'빈도를 모으는 단계와 정렬 기준을 적용하는 단계를 나눠 보세요.']
 ]
];
export function dailySpec(id){
 const match=/^daily-v1-(\d{4}-\d{2}-\d{2})-([012])$/.exec(id||'');if(!match)return null;
 const [,day,tierText]=match,date=new Date(day+'T00:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==day)return null;
 const serial=Math.floor(date.getTime()/86400000),tier=Number(tierText),variant=((serial%3)+3)%3,k=2+((serial+tier)%5+5)%5;
 const [name,rule,solve,hint]=templates[tier][variant],theme=themes[((Math.floor(serial/3)%themes.length)+themes.length)%themes.length];
 const inputs=[[],[k],[k-1,k,k+1,-1,0,k],[-3,-3,-1,-1],Array(9).fill(k),[1,2,1,3,2,4,1,0,2],[k-1,1,k-1,1,0,k],Array.from({length:18},(_,i)=>(i*7+serial)%13-4)];
 const cases=inputs.map((input,i)=>({name:'daily-case-'+i,input,expected:solve(input,k)}));
 return {id,day,tier,k,variant,cases,problem:{id,feature:name.replaceAll(' ',''),daily:true,level:levels[tier],stage:tier===0?0:tier===1?3:6,minutes:[20,35,50][tier],runner:true,title:theme+' · '+name+' ('+day+')',sub:levels[tier]+' · 별도 일일 생성 문제',tags:['C#','일일 문제',['조건·순회','컬렉션·상태','탐색·정렬'][tier]],text:theme+'의 '+name+' 기능을 구현합니다. 오늘의 기준 값은 '+k+'입니다. '+rule,requirements:[rule,'public int[] Solve(int[] values)를 구현하세요. 결과가 단일 값이어도 길이 1의 배열로 반환합니다.','null은 빈 배열과 동일하게 처리하고 입력 배열은 변경하지 않습니다.','같은 인스턴스에서 여러 번 호출해도 이전 호출의 결과에 영향을 받지 않아야 합니다.','입력 길이 0~1000, 각 값 -1000~1000 범위입니다.'],cases:cases.slice(0,3).map(c=>['예제',JSON.stringify(c.input),JSON.stringify(c.expected)]),code:'public class DailyPractice\n{\n    public int[] Solve(int[] values)\n    {\n        // 기준 값: '+k+'\n        // 요구사항을 읽고 직접 구현하세요.\n        return new int[0];\n    }\n}\n',hint,feedback:tier===2?'정확성을 먼저 확인한 뒤 반복 탐색과 정렬 비용을 비교하세요. 이 설명은 실제 성능 측정 결과가 아닙니다.':'입력 변경과 인스턴스 상태 누수를 확인하세요. 자료구조는 요구사항과 데이터 크기에 맞춰 선택하세요.'}};
}
export const dailyId=(day,tier)=>`daily-v1-${day}-${tier}`;
export const generatedProblem=id=>dailySpec(id)?.problem;
export const dailyTestNames=id=>dailySpec(id)?[...Array.from({length:8},(_,i)=>'daily-case-'+i),'daily-null','daily-input-unchanged','daily-repeat']:null;
