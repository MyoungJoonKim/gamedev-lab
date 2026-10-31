"""Daily quota, individual deletion and per-day publication UI (Git writes mocked)."""
import json
from pathlib import Path
from datetime import date,timedelta
from playwright.sync_api import sync_playwright,expect

sources={
'pocket':'public class PocketPractice {int n=4; public int WoodCount=>n; public bool TryPickUpWood(){if(n>=5)return false;n++;return true;}}',
'slots':'public class SlotPractice {int[] c=new int[4];public int GetCount(int i)=>c[i];public int AddWood(int n){if(n<=0)return 0;for(int i=0;i<4;i++){int a=System.Math.Min(5-c[i],n);c[i]+=a;n-=a;}return n;}}',
'health':'public class HealthPractice {int h=80;public int Health=>h;public void ApplyDamage(int n){if(n>0)h=System.Math.Max(0,h-n);}}'
}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1100})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:3000/#daily')
    expect(page.locator('.daily-problem')).to_have_count(3)
    today=page.locator('#daily-date').input_value()
    for index,(problem,source) in enumerate(sources.items()):
        page.goto('http://127.0.0.1:3000/#practice/'+problem)
        expect(page.locator('#code')).to_be_visible()
        page.locator('#code').fill(source)
        page.locator('[data-field=approach]').fill('PRIVATE_ANALYSIS_NOT_FOR_MARKDOWN')
        page.locator('#run').click()
        expect(page.locator('.status-badge')).to_have_text('통과',timeout=75000)
        page.locator('#submit').click()
        page.goto('http://127.0.0.1:3000/#daily')
        expect(page.locator('.daily-heading')).to_contain_text(str(index+1)+' / 3 완료')
    expect(page.locator('.daily-success')).to_contain_text('할당량 달성')
    expect(page.locator('.calendar-day.complete')).to_have_count(1)
    page.reload()
    expect(page.locator('.daily-heading')).to_contain_text('3 / 3 완료')
    page.goto('http://127.0.0.1:3000/#practice/pocket')
    page.locator('#run').click()
    expect(page.locator('.status-badge')).to_have_text('통과',timeout=75000)
    page.locator('#submit').click()
    page.goto('http://127.0.0.1:3000/#records')
    expect(page.locator('.record-row')).to_have_count(4)
    page.on('dialog',lambda d:d.accept())
    page.locator('[data-delete-record]').first.click()
    expect(page.locator('.record-row')).to_have_count(3)
    page.goto('http://127.0.0.1:3000/#daily')
    expect(page.locator('.daily-success')).to_be_visible()
    # Fixture records in this isolated browser exercise two dates, not the real repository.
    saved=page.evaluate("JSON.parse(localStorage.getItem('gamedev-lab-v1'))")
    yesterday=(date.fromisoformat(today)-timedelta(days=1)).isoformat()
    fixture=json.loads(json.dumps(saved['history'][0]));fixture['id']='fixture-previous-day';fixture['date']=yesterday+'T10:00:00+09:00';saved['history'].append(fixture)
    page.evaluate("(state)=>localStorage.setItem('gamedev-lab-v1',JSON.stringify(state))",saved)
    page.reload()
    page.goto('http://127.0.0.1:3000/#records')
    expect(page.locator('.record-row')).to_have_count(4)
    plans=page.evaluate("async records=>(await import('/lib/portfolio.js')).dailyPublicationPlans(records).days",saved['history'])
    context={'head':'a'*40,'branch':'main','repository':'fixture/repo','authorConfigured':True,'otherStagedFiles':1}
    page.route('**/api/git/prepare',lambda r:r.fulfill(status=200,content_type='application/json',body=json.dumps({'context':context,'days':plans})))
    requests=[]
    def publish(route):
        body=route.request.post_data_json;requests.append(body)
        results=[{'date':d['date'],'folder':plans[i]['folder'],'commit':str(i+1)*40,'changed':True} for i,d in enumerate(body['days'])]
        route.fulfill(status=200,content_type='application/json',body=json.dumps({'pushed':True,'results':results,'head':'b'*40,'branch':'main','repository':'fixture/repo'}))
    page.route('**/api/git/publish',publish)
    page.locator('#compose-commits').click()
    expect(page.locator('.day-commit-plan')).to_have_count(2)
    expect(page.locator('.publish-target')).to_contain_text('fixture/repo')
    for preview in page.locator('.day-file-preview pre').all():
        text=preview.text_content();assert '## 문제' in text and '## 내 풀이 코드' in text
        assert 'PRIVATE_ANALYSIS_NOT_FOR_MARKDOWN' not in text and '테스트 결과' not in text
    first=page.locator('[data-summary="0"]');first.fill('docs(learning): '+plans[0]['date']+' 직접 수정한 요약')
    page.locator('#publish-record').click()
    expect(page.locator('.publish-result')).to_contain_text('업로드 완료')
    assert len(requests)==1 and len(requests[0]['days'])==2
    assert requests[0]['days'][0]['summary'].endswith('직접 수정한 요약')
    page.locator('[data-close]').click()
    page.goto('http://127.0.0.1:3000/#daily')
    page.locator('#daily-date').fill(yesterday)
    page.locator('#daily-date').dispatch_event('change')
    expect(page.locator('.daily-layout')).to_contain_text('할당 기록이 없습니다')
    for width in [390,768,1440]:
        page.set_viewport_size({'width':width,'height':950})
        for route in ['dashboard','daily','records','problems','practice/health']:
            page.goto('http://127.0.0.1:3000/#'+route)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,route)
    page.goto('http://127.0.0.1:3000/#daily')
    page.locator('#go-today').click()
    page.screenshot(path='/tmp/gamedev-daily.png',full_page=True)
    assert not errors,errors
    browser.close()
    print('PASS: real 3-problem quota, repeat dedup, persistence, calendar, delete preserves quota, per-day edited commit drafts, problem/code-only Markdown and responsive routes. Git writes mocked; bare-remote integration tested separately.')
