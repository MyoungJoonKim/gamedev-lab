import {test} from 'node:test';
import assert from 'node:assert/strict';
import {grade,execute} from '../tooling/grader.mjs';
export const pocket='public class PocketPractice { private int count=4; public int WoodCount=>count; public bool TryPickUpWood(){if(count>=5)return false; count++; return true;} }';
export const slots='public class SlotPractice { private readonly int[] c=new int[4]; public int GetCount(int i)=>c[i]; public int AddWood(int n){if(n<=0)return 0;for(int i=0;i<4&&n>0;i++){int add=System.Math.Min(5-c[i],n);c[i]+=add;n-=add;}return n;} }';
test('actual C# pocket passes normal/full/repeated tests',async()=>{const r=await grade('pocket',pocket);assert.ok(!r.error,JSON.stringify(r));assert.equal(r.report.tests.length,3);assert.ok(r.report.tests.every(t=>t.status==='passed'));assert.equal(r.report.source,pocket);});
test('actual C# boundary defect fails',async()=>{const r=await grade('pocket',pocket.replace('count>=5','count>5'));assert.ok(r.report.tests.some(t=>t.status==='failed'));});
test('actual C# slot implementation passes six cases',async()=>{const r=await grade('slots',slots);assert.ok(!r.error,JSON.stringify(r));assert.equal(r.report.tests.length,6);assert.ok(r.report.tests.every(t=>t.status==='passed'));});
test('slot reset bug fails persistence test',async()=>{const r=await grade('slots',slots.replace('if(n<=0)return 0;','System.Array.Clear(c,0,4);if(n<=0)return 0;'));assert.ok(r.report.tests.some(t=>t.name==='fill-existing'&&t.status==='failed'));});
test('compiler errors produce no report',async()=>{const r=await grade('pocket','invalid C# code');assert.ok(r.error);assert.ok(!r.report);assert.ok(r.log.includes('error'));});
test('hung child is terminated with timeout outcome',async()=>{const r=await execute(process.execPath,['-e','setInterval(()=>{},1000)'],{timeout:100});assert.ok(r.reason.includes('제한 시간'));});

test('repeated-pickup actually reaches the 100th call and reports success/rejection counts',async()=>{
 const ok=await grade('pocket',pocket);const repeated=ok.report.tests.find(t=>t.name==='repeated-pickup');
 assert.ok(repeated.actual.includes('총 호출=100회'));assert.ok(repeated.actual.includes('성공=1회'));assert.ok(repeated.actual.includes('거부=99회'));
 const failOn100=pocket.replace('private int count=4;','private int count=4; private int calls=0;').replace('if(count>=5)return false;','calls++; if(calls==100){count=6;return false;} if(count>=5)return false;');
 const result=await grade('pocket',failOn100);
 assert.equal(result.report.tests.find(t=>t.name==='first-pickup').status,'passed');
 assert.equal(result.report.tests.find(t=>t.name==='full-pocket').status,'passed');
 assert.equal(result.report.tests.find(t=>t.name==='repeated-pickup').status,'failed');
});
