"""HTTPS fixture test. Fake OAuth provider; real auth/session/SQLite/UI code."""
from playwright.sync_api import sync_playwright, expect
from urllib.parse import urlparse, parse_qs
import re

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    errors=[]
    def login(context):
        def oauth(route):
            # Exercise the real begin handler, but replace its external redirect.
            response=route.fetch(max_redirects=0)
            headers=dict(response.headers)
            state=parse_qs(urlparse(headers['location']).query)['state'][0]
            headers['location']='https://localhost:3443/auth/github/callback?code=fixture&state='+state
            route.fulfill(response=response,headers=headers)
        context.route('**/auth/github',oauth)
        context.route(re.compile(r'https://github\.com/.*'),lambda route:route.abort())
        page=context.new_page()
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('https://localhost:3443')
        expect(page.get_by_role('link',name='GitHub으로 로그인')).to_be_visible()
        page.get_by_role('link',name='GitHub으로 로그인').click()
        expect(page.locator('h1')).to_contain_text('대시보드')
        page.goto('https://localhost:3443/#practice/pocket')
        expect(page.locator('#code')).to_be_visible()
        return page
    # A and B have separate cookie jars and localStorage, representing different PCs.
    a=browser.new_context(ignore_https_errors=True)
    page_a=login(a)
    page_a.locator('#code').fill('// from pc A')
    expect(page_a.locator('.cloud-state')).to_have_text('서버에 저장됨')
    b=browser.new_context(ignore_https_errors=True)
    page_b=login(b)
    expect(page_b.locator('#code')).to_have_value('// from pc A')
    page_b.locator('#code').fill('// from pc B')
    expect(page_b.locator('.cloud-state')).to_have_text('서버에 저장됨')
    page_a.locator('#code').fill('// stale pc A edit')
    expect(page_a.locator('#sync-banner')).to_be_visible()
    expect(page_a.locator('#sync-banner')).to_contain_text('충돌')
    page_b.reload()
    expect(page_b.locator('#code')).to_have_value('// from pc B')
    with page_a.expect_download() as dl:page_a.locator('#sync-backup').click()
    assert dl.value.suggested_filename=='gamedev-unsent-backup.json'
    page_a.on('dialog',lambda dialog:dialog.accept())
    page_a.locator('#sync-reload').click()
    expect(page_a.locator('#code')).to_have_value('// from pc B')
    # Network failure preserves an unsent browser copy and can be retried.
    def offline(route):
        if route.request.method=='PUT':route.fulfill(status=503,content_type='application/json',body='{"error":"fixture offline"}')
        else:route.continue_()
    a.route('**/api/state',offline)
    page_a.locator('#code').fill('// retryable edit')
    expect(page_a.locator('#sync-banner')).to_contain_text('fixture offline')
    a.unroute('**/api/state',offline)
    page_a.locator('#sync-retry').click()
    expect(page_a.locator('.cloud-state')).to_have_text('서버에 저장됨')
    page_b.reload()
    expect(page_b.locator('#code')).to_have_value('// retryable edit')
    page_b.locator('#run').click()
    expect(page_b.locator('.report-origin')).to_contain_text('서버 격리 C# 실행')
    expect(page_b.locator('.cloud-state')).to_have_text('서버에 저장됨')
    page_b.locator('#submit').click()
    expect(page_b.locator('.cloud-state')).to_have_text('서버에 저장됨')
    page_b.locator('.nav-item[href="#records"]').click()
    expect(page_b.locator('.record-row')).to_have_count(1)
    page_b.locator('#logout').click()
    expect(page_b.get_by_role('link',name='GitHub으로 로그인')).to_be_visible()
    # Layout and login remain usable on a small viewport.
    page_b.set_viewport_size({'width':390,'height':900})
    assert page_b.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page_b.screenshot(path='/tmp/gamedev-login.png',full_page=True)
    assert not errors,errors
    browser.close()
    print('PASS: hosted GitHub flow (mock provider), separate-PC server sync, stale write rejection, unsent backup, recovery/retry, server grading UI, history and logout. No JS errors.')
