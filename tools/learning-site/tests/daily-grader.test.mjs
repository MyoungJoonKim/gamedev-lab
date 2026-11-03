import {test} from 'node:test';
import assert from 'node:assert/strict';
import {grade,getTestCode} from '../tooling/grader.mjs';
import {dailySpec,dailyTestNames} from '../site/lib/daily-problems.js';
import {validateReport} from '../site/lib/model.js';
// Independent C# reference implementations exercise every daily mechanic through the real runner.
const bodies=[
 [k=>`int n=0;foreach(int v in a)if(v>=${k})n++;return new[]{n};`,k=>`var r=new int[a.Length];for(int i=0;i<a.Length;i++)r[i]=System.Math.Clamp(a[i],0,${k});return r;`,k=>`for(int i=0;i<a.Length;i++)if(a[i]>=0&&a[i]<=${k})return new[]{i};return new[]{-1};`],
 [k=>`int n=0,b=0;foreach(int v in a){n=v>=${k}?n+1:0;if(n>b)b=n;}return new[]{b};`,()=>`var r=new System.Collections.Generic.List<int>();foreach(int v in a)if(v>=0&&!r.Contains(v))r.Add(v);return r.ToArray();`,()=>`var r=new System.Collections.Generic.List<int>();for(int i=0;i<a.Length;i++)if(i==0||a[i]!=a[i-1])r.Add(a[i]);return r.ToArray();`],
 [k=>`if(a.Length<${k})return new[]{-1,0};int index=0,b=int.MinValue;for(int i=0;i<=a.Length-${k};i++){int sum=0;for(int j=i;j<i+${k};j++)sum+=a[j];if(sum>b){b=sum;index=i;}}return new[]{index,b};`,k=>`for(int j=1;j<a.Length;j++)for(int i=0;i<j;i++)if(a[i]+a[j]==${k})return new[]{i,j};return new[]{-1,-1};`,k=>`return System.Linq.Enumerable.ToArray(System.Linq.Enumerable.Take(System.Linq.Enumerable.Select(System.Linq.Enumerable.ThenBy(System.Linq.Enumerable.OrderByDescending(System.Linq.Enumerable.GroupBy(a,x=>x),g=>System.Linq.Enumerable.Count(g)),g=>g.Key),g=>g.Key),${k}));`]
];
for(const day of ['2026-11-01','2026-11-02','2026-11-03'])for(let tier=0;tier<3;tier++)test('actual daily C# '+day+' tier '+tier,async()=>{const id=`daily-v1-${day}-${tier}`,spec=dailySpec(id);const source=`public class DailyPractice {public int[] Solve(int[] values){var a=values??new int[0];${bodies[tier][spec.variant](spec.k)}}}`;const result=await grade(id,source);assert.ok(!result.error,JSON.stringify(result));validateReport(result.report,id);assert.deepEqual(result.report.tests.map(t=>t.name),dailyTestNames(id));assert.ok(result.report.tests.every(t=>t.status==='passed'),JSON.stringify(result.report.tests));});
test('daily wrong output fails and invalid IDs cannot run',async()=>{const result=await grade('daily-v1-2026-11-03-0','public class DailyPractice {public int[] Solve(int[] values){return new int[0];}}');assert.ok(result.report.tests.some(t=>t.status==='failed'));assert.equal(getTestCode('daily-v1-2026-02-30-0'),null);});
