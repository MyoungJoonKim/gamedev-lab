"""Local editor smoke test. Requires running server, Playwright and Chromium."""
from playwright.sync_api import sync_playwright, expect

sample='''using UnityEngine;

public class PocketPractice
{
    private int woodCount = 4;
    private const int MaxWoodCount = 5;

    public bool TryPickUpWood()
    {
        // 최대 수량에서 집기를 거부합니다.
        if (woodCount >= MaxWoodCount) return false;
        woodCount += 1;
        Debug.Log($"나무 수량: {woodCount}");
        return true;
    }
}'''
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1100})
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:3000/#practice/pocket')
    editor=page.locator('#code')
    expect(editor).to_be_visible()
    editor.fill(sample)
    mirror=page.locator('.code-highlight code')
    expect(mirror.locator('.cs-type',has_text='PocketPractice')).to_have_count(1)
    expect(mirror.locator('.cs-function',has_text='TryPickUpWood')).to_have_count(1)
    assert mirror.locator('.cs-variable',has_text='woodCount').count()==4
    assert page.locator('.line-numbers').inner_text().splitlines()[-1]==str(len(sample.split('\n')))
    assert mirror.text_content().removesuffix('\u200b')==sample
    colors=page.evaluate('''() => Object.fromEntries(['keyword','flow','type','function','variable','comment','string'].map(k => [k,getComputedStyle(document.querySelector('.code-highlight .cs-'+k)).color]))''')
    assert len(set(colors.values()))==7,colors
    # Native textarea selection is never replaced by syntax rendering.
    editor.evaluate('(e) => { e.focus(); e.setSelectionRange(10, 18); }')
    editor.dispatch_event('input')
    assert editor.evaluate('(e) => [e.selectionStart,e.selectionEnd]')==[10,18]
    # Ordinary typing and native undo continue to work.
    editor.fill('int count = 1;')
    editor.press('End')
    editor.type('x')
    expect(editor).to_have_value('int count = 1;x')
    editor.press('Control+z')
    expect(editor).to_have_value('int count = 1;')
    editor.press('Control+Shift+z')
    expect(editor).to_have_value('int count = 1;x')
    editor.fill('int count = 1;')
    editor.press('End')
    page.keyboard.insert_text(' // pasted')
    expect(editor).to_have_value('int count = 1; // pasted')
    editor.press('Control+z')
    expect(editor).to_have_value('int count = 1;')
    editor.fill('int count = 1;')
    editor.press('Home')
    editor.press('Tab')
    expect(editor).to_have_value('    int count = 1;')
    page.reload()
    expect(page.locator('#code')).to_have_value('    int count = 1;')
    editor=page.locator('#code')
    # HTML-like code and comments are displayed literally, never evaluated.
    malicious='string text = "<img src=x onerror=alert(1)>"; // </code><script>alert(1)</script>'
    editor.fill(malicious)
    assert page.locator('.code-highlight img,.code-highlight script').count()==0
    assert page.locator('.code-highlight code').text_content().removesuffix('\u200b')==malicious
    # Long lines and many rows share the same scroll offsets and font metrics.
    long_code='\n'.join('// '+str(i)+' '+('long_text ' * 30) for i in range(100))+'\n'
    editor.fill(long_code)
    editor.evaluate('(e) => { e.scrollTop=800; e.scrollLeft=300; e.dispatchEvent(new Event("scroll")); }')
    page.wait_for_timeout(100)
    metrics=page.evaluate('''() => {
      const e=document.querySelector('#code'), p=document.querySelector('.code-highlight');
      return {left:e.scrollLeft,top:e.scrollTop,mirrorLeft:p.scrollLeft,mirrorTop:p.scrollTop,width:e.clientWidth,mirrorWidth:p.clientWidth,height:e.clientHeight,mirrorHeight:p.clientHeight,font:getComputedStyle(e).font,mirrorFont:getComputedStyle(p).font};
    }''')
    assert metrics['left']>0 and metrics['top']>0,metrics
    assert abs(metrics['left']-metrics['mirrorLeft'])<=1 and abs(metrics['top']-metrics['mirrorTop'])<=1,metrics
    assert metrics['font']==metrics['mirrorFont'],metrics
    assert metrics['width']==metrics['mirrorWidth'] and metrics['height']==metrics['mirrorHeight'],metrics
    editor.evaluate('(e) => e.style.height="520px"')
    page.wait_for_timeout(100)
    assert editor.evaluate('(e)=>e.clientHeight')==page.locator('.code-highlight').evaluate('(e)=>e.clientHeight')
    # Returning to the tab creates one clean editor with the saved source.
    page.get_by_role('button',name='분석 노트',exact=True).click()
    page.get_by_role('button',name='풀이 작성',exact=True).click()
    expect(page.locator('#code')).to_have_value(long_code)
    assert page.locator('.code-highlight').count()==1
    editor=page.locator('#code')
    editor.fill(sample)
    editor.evaluate('(e)=>{e.scrollTop=0;e.scrollLeft=0;}')
    page.locator('.code-editor').screenshot(path='/tmp/gamedev-csharp-editor.png')
    page.set_viewport_size({'width':390,'height':900})
    page.wait_for_timeout(150)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert page.locator('#code').evaluate('(e)=>e.clientWidth')==page.locator('.code-highlight').evaluate('(e)=>e.clientWidth')
    page.locator('.code-editor').screenshot(path='/tmp/gamedev-csharp-editor-mobile.png')
    assert not errors,errors
    browser.close()
    print('PASS: C# colors, source/selection preservation, native undo, Tab, saved draft, HTML escaping, horizontal/vertical scroll, resize, tab navigation and mobile alignment.')
