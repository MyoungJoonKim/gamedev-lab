import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planKeyEdit } from '../site/lib/editor-actions.js';
function state(marked) { const start=marked.indexOf('|'); assert.ok(start>=0); return {value:marked.slice(0,start)+marked.slice(start+1),start,end:start}; }
function result(marked,key,options={}) {
    const input=state(marked),plan=planKeyEdit(input,key,options);
    assert.ok(plan,`No plan for ${key} in ${marked}`);
    const value=plan.text===undefined?input.value:input.value.slice(0,plan.from)+plan.text+input.value.slice(plan.to);
    return value.slice(0,plan.start)+'|'+value.slice(plan.start);
}
test('parentheses, brackets and quotes close automatically with caret inside',()=>{
    assert.equal(result('    if |','('),'    if (|)');
    assert.equal(result('items|','['),'items[|]');
    assert.equal(result('var s = |','"'),'var s = "|"');
    assert.equal(result('char c = |',"'"),"char c = '|'" );
});
test('typing an existing closing delimiter moves over it without duplication',()=>{
    assert.equal(result('if (ready|)',')'),'if (ready)|');
    assert.equal(result('items[0|]',']'),'items[0]|');
    assert.equal(result('var s = "text|"','"'),'var s = "text"|');
});
test('opening braces prepare the next closing line and Enter creates an indented body',()=>{
    assert.equal(result('    |','{'),'    {|\n    }');
    assert.equal(result('    {|\n    }','Enter'),'    {\n        |\n    }');
    assert.equal(result('    {|}','Enter'),'    {\n        |\n    }');
    assert.equal(result('    { | }','Enter'),'    { \n        |\n    }');
});
test('Enter preserves existing indentation and nested blocks align independently',()=>{
    assert.equal(result('    if (ready)|','Enter'),'    if (ready)\n    |');
    assert.equal(result('        return true;|','Enter'),'        return true;\n        |');
    assert.equal(result('\t\tDoWork();|','Enter'),'\t\tDoWork();\n\t\t|');
    assert.equal(result('    {\n        if (ready)\n        {|\n        }\n    }','Enter'),'    {\n        if (ready)\n        {\n            |\n        }\n    }');
});
test('a manually typed closing brace outdents to the matching opening brace',()=>{
    assert.equal(result('    {\n        |','}'),'    {\n    }|');
    assert.equal(result('    {\n        |}','}'),'    {\n    }|');
    assert.equal(result('    {\n        |\n    }','}'),'    {\n    }|');
    assert.equal(result('    {\n        {\n            |','}'),'    {\n        {\n        }|');
});
test('Backspace removes empty generated pairs/blocks and indentation stops',()=>{
    assert.equal(result('if (|)','Backspace'),'if |');
    assert.equal(result('var s="|"','Backspace'),'var s=|');
    assert.equal(result('    {|\n    }','Backspace'),'    |');
    assert.equal(result('        |','Backspace'),'    |');
    assert.equal(result('      |','Backspace'),'    |');
});
test('comments and string contents are not treated as code; escaped quotes are preserved',()=>{
    for(const marked of ['// text |','/* comment | */','var s = "text |";','var s = @"text |";','var s = """raw | text""";'])assert.equal(planKeyEdit(state(marked),'('),null,marked);
    assert.equal(planKeyEdit(state('var s="(|)";'),'Backspace'),null);
    assert.equal(planKeyEdit(state('var s="text |)";'),')'),null);
    assert.equal(planKeyEdit(state("var s=\"don|'t\";"),"'"),null);
    assert.equal(planKeyEdit(state('var s="text\\|";'),'"'),null);
    assert.equal(result('var s="done"; |','('),'var s="done"; (|)');
});
test('Tab uses indentation stops and Shift+Tab removes one leading level',()=>{
    assert.equal(result('  |','Tab'),'    |');
    assert.equal(result('    |','Tab'),'        |');
    assert.equal(result('    value|','Tab',{shiftKey:true}),'value|');
});
test('multiline indentation preserves selected code and excludes a final unselected line',()=>{
    const original='    one\n    two\nthree';
    const input={value:original,start:4,end:15,direction:'backward'};
    const plan=planKeyEdit(input,'Tab');
    const changed=original.slice(0,plan.from)+plan.text+original.slice(plan.to);
    assert.equal(changed,'        one\n        two\nthree');assert.equal(plan.direction,'backward');
    const back=planKeyEdit({value:changed,start:plan.start,end:plan.end,direction:plan.direction},'Tab',{shiftKey:true});
    assert.equal(changed.slice(0,back.from)+back.text+changed.slice(back.to),original);
    assert.equal(back.start,input.start);assert.equal(back.end,input.end);
    const single=planKeyEdit({value:'one\ntwo',start:0,end:4},'Tab');assert.equal(single.text,'    one');
});
test('selected text is surrounded without replacing its content',()=>{
    const plan=planKeyEdit({value:'count',start:0,end:5,direction:'forward'},'(');
    assert.equal(plan.text,'(count)');assert.equal(plan.start,1);assert.equal(plan.end,6);
});
test('IME, modifier shortcuts and ordinary typing use native handling',()=>{
    for(const options of [{isComposing:true},{ctrlKey:true},{metaKey:true},{altKey:true}])assert.equal(planKeyEdit(state('if |'),'(',options),null);
    assert.equal(planKeyEdit(state('var x|'),'a'),null);
    assert.equal(planKeyEdit(state('|word'),'('),null);
});
