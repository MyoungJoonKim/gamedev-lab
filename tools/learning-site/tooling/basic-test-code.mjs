export const basicTestCode={
 health:`
  Check("normal",()=>{var p=new HealthPractice();p.ApplyDamage(20);return(p.Health==60,$"health={p.Health}");});
  Check("lethal",()=>{var p=new HealthPractice();p.ApplyDamage(100);return(p.Health==0,$"health={p.Health}");});
  Check("nonpositive",()=>{var p=new HealthPractice();p.ApplyDamage(0);p.ApplyDamage(-10);return(p.Health==80,$"health={p.Health}");});
  Check("repeated",()=>{var p=new HealthPractice();for(int i=0;i<100;i++)p.ApplyDamage(1);return(p.Health==0,$"health={p.Health}");});`,
 fuel:`
  Check("normal",()=>{var p=new FuelPractice();bool ok=p.TryConsume(3);return(ok&&p.Fuel==7,$"success={ok}, fuel={p.Fuel}");});
  Check("exact",()=>{var p=new FuelPractice();bool ok=p.TryConsume(10);return(ok&&p.Fuel==0,$"success={ok}, fuel={p.Fuel}");});
  Check("rejected",()=>{var p=new FuelPractice();bool a=p.TryConsume(11);bool b=p.TryConsume(3);bool c=p.TryConsume(8);return(!a&&b&&!c&&p.Fuel==7,$"fuel={p.Fuel}, insufficient={a}, repeated={c}");});
  Check("invalid",()=>{var p=new FuelPractice();bool a=p.TryConsume(0),b=p.TryConsume(-1);return(!a&&!b&&p.Fuel==10,$"zero={a}, negative={b}, fuel={p.Fuel}");});`,
 cooldown:`
  Check("first",()=>{var p=new CooldownPractice();bool ok=p.TryUse(0);return(ok,$"first={ok}");});
  Check("boundary",()=>{var p=new CooldownPractice();bool a=p.TryUse(0),b=p.TryUse(1.9f),c=p.TryUse(2f);return(a&&!b&&c,$"first={a}, early={b}, boundary={c}");});
  Check("rejected-does-not-delay",()=>{var p=new CooldownPractice();bool a=p.TryUse(10f),b=p.TryUse(11f),c=p.TryUse(12f);return(a&&!b&&c,$"first={a}, rejected={b}, next={c}");});
  Check("negative",()=>{var p=new CooldownPractice();bool a=p.TryUse(-1f),b=p.TryUse(0);return(!a&&b,$"negative={a}, first={b}");});`,
 nearest:`
  Check("empty",()=>{int n=new NearestPractice().FindNearest(new int[0]);return(n==-1,$"index={n}");});
  Check("null",()=>{int n=new NearestPractice().FindNearest(null);return(n==-1,$"index={n}");});
  Check("minimum",()=>{int n=new NearestPractice().FindNearest(new[]{8,2,5});return(n==1,$"index={n}");});
  Check("tie",()=>{int n=new NearestPractice().FindNearest(new[]{3,1,1});return(n==1,$"index={n}");});
  Check("invalid",()=>{var p=new NearestPractice();int a=p.FindNearest(new[]{-1,-3}),b=p.FindNearest(new[]{-1,0,2});return(a==-1&&b==1,$"invalid={a}, valid={b}");});`,
 unique:`
  Check("empty",()=>{int n=new UniquePractice().CountUnique(new int[0]);return(n==0,$"count={n}");});
  Check("null",()=>{int n=new UniquePractice().CountUnique(null);return(n==0,$"count={n}");});
  Check("duplicates",()=>{int n=new UniquePractice().CountUnique(new[]{2,2,5,2});return(n==2,$"count={n}");});
  Check("values",()=>{int n=new UniquePractice().CountUnique(new[]{-1,0,1,-1});return(n==3,$"count={n}");});`,
 materials:`
  Check("exact",()=>{bool ok=new MaterialPractice().CanCraft(3,2);return(ok,$"canCraft={ok}");});
  Check("extra",()=>{bool ok=new MaterialPractice().CanCraft(5,8);return(ok,$"canCraft={ok}");});
  Check("wood",()=>{bool ok=new MaterialPractice().CanCraft(2,10);return(!ok,$"canCraft={ok}");});
  Check("stone",()=>{bool ok=new MaterialPractice().CanCraft(10,1);return(!ok,$"canCraft={ok}");});
  Check("negative",()=>{var p=new MaterialPractice();bool a=p.CanCraft(-1,5),b=p.CanCraft(5,-1);return(!a&&!b,$"negativeWood={a}, negativeStone={b}");});`,
 queue:`
  Check("fifo",()=>{var p=new QueuePractice();p.Enqueue(4);p.Enqueue(7);p.Enqueue(2);int a=p.TakeNext(),b=p.TakeNext(),c=p.TakeNext(),d=p.TakeNext();return(a==4&&b==7&&c==2&&d==-1,$"order={a},{b},{c}, empty={d}");});
  Check("empty",()=>{int n=new QueuePractice().TakeNext();return(n==-1,$"empty={n}");});
  Check("negative",()=>{var p=new QueuePractice();p.Enqueue(-1);p.Enqueue(0);int a=p.TakeNext(),b=p.TakeNext();return(a==0&&b==-1,$"first={a}, empty={b}");});
  Check("independent",()=>{var a=new QueuePractice();a.Enqueue(9);int n=new QueuePractice().TakeNext();return(n==-1,$"new instance={n}");});`,
 stack:`
  Check("lifo",()=>{var p=new StackPractice();p.Push(4);p.Push(7);p.Push(2);int a=p.Undo(),b=p.Undo(),c=p.Undo(),d=p.Undo();return(a==2&&b==7&&c==4&&d==-1,$"order={a},{b},{c}, empty={d}");});
  Check("empty",()=>{int n=new StackPractice().Undo();return(n==-1,$"empty={n}");});
  Check("negative",()=>{var p=new StackPractice();p.Push(-1);p.Push(0);int a=p.Undo(),b=p.Undo();return(a==0&&b==-1,$"first={a}, empty={b}");});
  Check("independent",()=>{var a=new StackPractice();a.Push(9);int n=new StackPractice().Undo();return(n==-1,$"new instance={n}");});`,
 durability:`
  Check("normal",()=>{var p=new DurabilityPractice();int n=p.Repair(10);return(n==10&&p.Durability==50,$"added={n}, durability={p.Durability}");});
  Check("clamp",()=>{var p=new DurabilityPractice();int n=p.Repair(100);return(n==60&&p.Durability==100,$"added={n}, durability={p.Durability}");});
  Check("nonpositive",()=>{var p=new DurabilityPractice();int a=p.Repair(0),b=p.Repair(-5);return(a==0&&b==0&&p.Durability==40,$"zero={a}, negative={b}, durability={p.Durability}");});
  Check("already-full",()=>{var p=new DurabilityPractice();p.Repair(60);int n=p.Repair(1);return(n==0&&p.Durability==100,$"added={n}, durability={p.Durability}");});`,
 score:`
  Check("sum",()=>{int n=new ScorePractice().Calculate(new[]{10,-3,0,5});return(n==15,$"score={n}");});
  Check("empty",()=>{int n=new ScorePractice().Calculate(new int[0]);return(n==0,$"score={n}");});
  Check("null",()=>{int n=new ScorePractice().Calculate(null);return(n==0,$"score={n}");});
  Check("no-mutation",()=>{int[] a={-2,9,4};int n=new ScorePractice().Calculate(a);return(n==13&&Enumerable.SequenceEqual(a,new[]{-2,9,4}),$"score={n}, input={string.Join(",",a)}");});`
};
