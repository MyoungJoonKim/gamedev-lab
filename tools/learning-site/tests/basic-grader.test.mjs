import {test} from 'node:test';
import assert from 'node:assert/strict';
import {grade,testCode} from '../tooling/grader.mjs';
import {extraBasicProblems,basicRequiredTests} from '../site/lib/basic-problems.js';
import {validateReport} from '../site/lib/model.js';
const sources={
 health:'public class HealthPractice{int health=80;public int Health=>health;public void ApplyDamage(int amount){if(amount>0)health=System.Math.Max(0,health-amount);}}',
 fuel:'public class FuelPractice{int fuel=10;public int Fuel=>fuel;public bool TryConsume(int amount){if(amount<=0||amount>fuel)return false;fuel-=amount;return true;}}',
 cooldown:'public class CooldownPractice{float next;public bool TryUse(float now){if(now<0||now<next)return false;next=now+2;return true;}}',
 nearest:'public class NearestPractice{public int FindNearest(int[] distances){if(distances==null)return -1;int index=-1,best=int.MaxValue;for(int i=0;i<distances.Length;i++){int d=distances[i];if(d>=0&&(index<0||d<best)){index=i;best=d;}}return index;}}',
 unique:'public class UniquePractice{public int CountUnique(int[] ids){return ids==null?0:new System.Collections.Generic.HashSet<int>(ids).Count;}}',
 materials:'public class MaterialPractice{public bool CanCraft(int wood,int stone){return wood>=3&&stone>=2;}}',
 queue:'public class QueuePractice{System.Collections.Generic.Queue<int> q=new System.Collections.Generic.Queue<int>();public void Enqueue(int id){if(id>=0)q.Enqueue(id);}public int TakeNext(){return q.Count==0?-1:q.Dequeue();}}',
 stack:'public class StackPractice{System.Collections.Generic.Stack<int> s=new System.Collections.Generic.Stack<int>();public void Push(int id){if(id>=0)s.Push(id);}public int Undo(){return s.Count==0?-1:s.Pop();}}',
 durability:'public class DurabilityPractice{int durability=40;public int Durability=>durability;public int Repair(int amount){if(amount<=0)return 0;int n=System.Math.Min(100-durability,amount);durability+=n;return n;}}',
 score:'public class ScorePractice{public int Calculate(int[] points){int sum=0;if(points!=null)foreach(int n in points)if(n>0)sum+=n;return sum;}}'
};
for(const problem of extraBasicProblems)test('actual C# foundation grading: '+problem.id,async()=>{assert.ok(testCode[problem.id]);const result=await grade(problem.id,sources[problem.id]);assert.ok(!result.error,JSON.stringify(result));const report=validateReport(result.report,problem.id);assert.deepEqual(report.tests.map(t=>t.name),basicRequiredTests[problem.id]);assert.ok(report.tests.every(t=>t.status==='passed'),JSON.stringify(report.tests));});
