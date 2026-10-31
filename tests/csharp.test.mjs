import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tokenizeCSharp,highlightCSharp} from '../site/lib/csharp.js';
const sample=`public class PocketPractice
{
    private int woodCount = 4;
    private const int MaxWoodCount = 5;
    public bool TryPickUpWood()
    {
        // 최대 수량에서 거부
        if (woodCount >= MaxWoodCount) return false;
        woodCount += 1;
        return true;
    }
}`;
test('C# colors distinguish types, methods, variables, constants, keywords and control flow',()=>{
 const tokens=tokenizeCSharp(sample);const kinds=word=>tokens.filter(t=>t.text===word).map(t=>t.kind);
 assert.deepEqual(kinds('PocketPractice'),['type']);assert.deepEqual(kinds('TryPickUpWood'),['function']);
 assert.ok(kinds('woodCount').every(k=>k==='variable'));assert.ok(kinds('MaxWoodCount').every(k=>k==='constant'));
 assert.deepEqual(kinds('int'),['keyword','keyword']);assert.deepEqual(kinds('if'),['flow']);assert.ok(kinds('return').every(k=>k==='flow'));
});
test('quoted and commented words are not colored as executable code; interpolation highlights expressions',()=>{
 const tokens=tokenizeCSharp(String.raw`// public BadMethod()
/* class Fake {} */
var text = "return Fake() <img>";
var path = @"C:\new\""folder""";
var label = $"count={{literal}} {woodCount + GetCount()}";`);
 assert.ok(!tokens.some(t=>t.text==='Fake'&&t.kind==='type'));assert.ok(!tokens.some(t=>t.text==='BadMethod'&&t.kind==='function'));
 assert.ok(tokens.some(t=>t.text==='woodCount'&&t.kind==='variable'));assert.ok(tokens.some(t=>t.text==='GetCount'&&t.kind==='function'));
 assert.ok(tokens.some(t=>t.kind==='string'&&t.text.includes('C:\\new')));
});
test('editing unfinished strings/comments, raw strings, Unicode and trailing newlines never changes source',()=>{
 for(const source of ['',sample,'\n\n','""',String.raw`"quote \\"`,String.raw`@"double ""quote`, '$"unfinished {count', '/* unfinished <script>', '#if UNITY_EDITOR\n#endif\n', 'string s = """raw // comment <tag>""";\n','int 나무수 = 1; 나무수++;\n', '$"nested {Get($"inner {count}")} end"']){
  assert.equal(tokenizeCSharp(source).map(t=>t.text).join(''),source,source);
 }
});
test('generic methods, method groups and custom parameter types are distinguished',()=>{
 const tokens=tokenizeCSharp('void Handle(Player player) { player.GetComponent<Rigidbody>(); changed += Handle; }');
 assert.ok(tokens.filter(t=>t.text==='Handle').every(t=>t.kind==='function'));assert.ok(tokens.some(t=>t.text==='GetComponent'&&t.kind==='function'));
 assert.ok(tokens.some(t=>t.text==='Player'&&t.kind==='type'));assert.ok(tokens.some(t=>t.text==='player'&&t.kind==='variable'));
});
test('HTML-like source is escaped; source cannot create executable DOM markup',()=>{
 const html=highlightCSharp('string s = "<img src=x onerror=alert(1)>"; // </code><script>alert(1)</script>');
 assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script'));assert.ok(!html.includes('</code>'));
 assert.ok(html.includes('&lt;img'));assert.ok(html.includes('cs-string'));assert.ok(html.includes('cs-comment'));
});
