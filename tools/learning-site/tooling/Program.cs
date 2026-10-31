using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Text.Json;
class TestRunner {
 static int Main(string[] args) {
  var tests = new List<object>(); bool failed=false;
  void Check(string name, Func<(bool,string)> test) {
   try { var (ok,actual)=test(); failed|=!ok; tests.Add(new {name,status=ok?"passed":"failed",actual}); }
   catch(Exception e) { failed=true; tests.Add(new {name,status="failed",actual=e.GetType().Name+": "+e.Message}); }
  }
  // TESTS
  var report=new {schemaVersion=1,problemId=args[2],runner="GameDev Lab .NET v1",source=File.ReadAllText(args[1]),tests};
  File.WriteAllText(args[0],JsonSerializer.Serialize(report));
  return failed?1:0;
 }
}
