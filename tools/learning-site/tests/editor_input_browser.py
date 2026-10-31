"""Real keyboard/undo/IME/selection tests for local C# input assistance."""
from playwright.sync_api import sync_playwright,expect

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1100})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:3000/#practice/pocket')
    editor=page.locator('#code')
    expect(editor).to_be_visible()
    def set_text(text,start=None,end=None,direction='none'):
        editor.fill(text)
        pos=len(text) if start is None else start
        editor.evaluate('(e,a)=>{e.focus();e.setSelectionRange(a[0],a[1],a[2]);}',[pos,pos if end is None else end,direction])
    set_text('    if ')
    editor.press('(')
    expect(editor).to_have_value('    if ()')
    assert editor.evaluate('(e)=>e.selectionStart')==8
    editor.type('ready')
    editor.press(')')
    expect(editor).to_have_value('    if (ready)')
    editor.press('Enter')
    expect(editor).to_have_value('    if (ready)\n    ')
    editor.press('{')
    expect(editor).to_have_value('    if (ready)\n    {\n    }')
    editor.press('Enter')
    expect(editor).to_have_value('    if (ready)\n    {\n        \n    }')
    editor.type('Run();')
    editor.press('Enter')
    editor.press('}')
    expect(editor).to_have_value('    if (ready)\n    {\n        Run();\n    }')
    # An automatic pair and newline expansion are each native undoable edits.
    set_text('if ')
    editor.press('(')
    editor.press('Control+z')
    expect(editor).to_have_value('if ')
    editor.press('Control+Shift+z')
    expect(editor).to_have_value('if ()')
    set_text('    ')
    editor.press('{')
    editor.press('Enter')
    editor.press('Control+z')
    expect(editor).to_have_value('    {\n    }')
    editor.press('Control+Shift+z')
    expect(editor).to_have_value('    {\n        \n    }')
    # Pair deletion is atomic and can also be undone.
    set_text('if ()',4)
    editor.press('Backspace')
    expect(editor).to_have_value('if ')
    editor.press('Control+z')
    expect(editor).to_have_value('if ()')
    set_text('var s = ')
    editor.press('"')
    editor.type('text')
    editor.press('"')
    expect(editor).to_have_value('var s = "text"')
    set_text('// comment ')
    editor.press('(')
    expect(editor).to_have_value('// comment (')
    set_text('var s = "text";',len('var s = "'))
    editor.press('(')
    expect(editor).to_have_value('var s = "(text";')
    # Surround a selection without throwing away the selected text.
    set_text('ready',0,5)
    editor.press('(')
    expect(editor).to_have_value('(ready)')
    assert editor.evaluate('(e)=>[e.selectionStart,e.selectionEnd]')==[1,6]
    original='    one\n    two\nthree'
    set_text(original,4,15,'backward')
    editor.press('Tab')
    expect(editor).to_have_value('        one\n        two\nthree')
    editor.press('Shift+Tab')
    expect(editor).to_have_value(original)
    editor.press('Control+z')
    expect(editor).to_have_value('        one\n        two\nthree')
    # One-character beforeinput events also cover virtual keyboards without keydown.
    set_text('if ')
    editor.evaluate("(e)=>e.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertText',data:'(',bubbles:true,cancelable:true}))")
    expect(editor).to_have_value('if ()')
    # During composition, let the platform insert exactly what the IME emits.
    set_text('')
    editor.dispatch_event('compositionstart')
    editor.press('(')
    editor.dispatch_event('compositionend')
    expect(editor).to_have_value('(')
    set_text('text')
    editor.press('Escape')
    editor.press('Tab')
    assert not editor.evaluate('(e)=>document.activeElement===e')
    # Type a valid solution using the new helpers and execute that exact source.
    scaffold='''public class PocketPractice
{
    private int woodCount = 4;
    private const int MaxWoodCount = 5;
    public int WoodCount => woodCount;

    public bool TryPickUpWood()
    {
__BODY_INDENT__
    }
}
'''.replace('__BODY_INDENT__', ' '*8)
    position=scaffold.index('\n        \n')+9
    set_text(scaffold,position)
    editor.type('if ')
    editor.press('(')
    editor.type('woodCount >= MaxWoodCount')
    editor.press(')')
    editor.press('Enter')
    editor.press('{')
    editor.press('Enter')
    editor.type('return false;')
    editor.press('Enter')
    editor.press('}')
    editor.press('Enter')
    editor.type('woodCount++;')
    editor.press('Enter')
    editor.type('return true;')
    typed=editor.input_value()
    assert '        if (woodCount >= MaxWoodCount)\n        {\n            return false;\n        }\n        woodCount++;\n        return true;' in typed,typed
    page.reload()
    editor=page.locator('#code')
    expect(editor).to_have_value(typed)
    assert page.locator('.code-highlight code').text_content().removesuffix('\u200b')==typed
    page.locator('.code-editor').screenshot(path='/tmp/gamedev-smart-editing.png')
    page.locator('#run').click()
    expect(page.locator('.status-badge')).to_have_text('통과',timeout=75000)
    expect(page.locator('.test-list')).to_contain_text('총 호출=100회')
    assert not errors,errors
    browser.close()
    print('PASS: automatic pairs, aligned blocks/Enter, skip/delete closers, undo/redo, multiline indentation, selections, mobile input events, IME guard, focus escape, persistence, highlighting and actual C# grading of keyboard-authored source.')
