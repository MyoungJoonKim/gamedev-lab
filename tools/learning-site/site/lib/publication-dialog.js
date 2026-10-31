import {dailyPublicationPlans} from './portfolio.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function openPublicationDialog(records,{headers,onResults,download}){
 const dialog=document.createElement('dialog');dialog.className='publish-dialog';
 dialog.innerHTML=`<div class="dialog-head"><h3>일자별 커밋 자동 작성</h3><button class="icon-button" data-close aria-label="닫기">×</button></div><p class="publish-intro">날짜마다 하나의 커밋으로 묶었습니다. 같은 날 같은 문제는 마지막 기록의 코드를 사용합니다. Markdown에는 문제와 내 풀이 코드만 들어갑니다. summary·description을 직접 수정한 뒤 실행하세요.</p><div class="publish-target" role="status">Git 저장소와 날짜별 폴더를 확인하는 중…</div><div class="daily-commit-plans"></div><div class="publish-result" aria-live="polite"></div><div class="publish-actions"><button class="btn outline" data-download>작성 내용 JSON 백업</button><button class="btn primary" id="publish-record" disabled>선택한 날짜 커밋·푸시</button></div>`;
 document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
 const target=dialog.querySelector('.publish-target'),container=dialog.querySelector('.daily-commit-plans'),button=dialog.querySelector('#publish-record'),result=dialog.querySelector('.publish-result');let plans=dailyPublicationPlans(records).days,context,active=false;
 function renderPlans(){container.innerHTML=plans.map((day,i)=>`<section class="day-commit-plan" data-plan="${i}"><label class="day-plan-select"><input type="checkbox" data-select="${i}" checked><strong>${day.date}</strong><span>${day.problemCount}문제 · 기록 ${day.recordCount}개</span></label><code class="publish-path">solutions/${esc(day.folder)}/</code><label class="publish-label">summary<input data-summary="${i}" maxlength="140" value="${esc(day.summary)}"></label><label class="publish-label">description<textarea data-description="${i}" rows="6">${esc(day.description)}</textarea></label><details><summary>문제·풀이 Markdown 미리보기 (${day.files.length}개)</summary>${day.files.map((file,j)=>`<div class="day-file-preview"><code class="publish-path">${esc(file.relativePath)}</code><pre>${esc(file.content)}</pre><button class="btn outline" data-file="${i}:${j}">이 Markdown 다운로드</button></div>`).join('')}</details></section>`).join('');
  container.querySelectorAll('[data-file]').forEach(b=>b.onclick=()=>{const [i,j]=b.dataset.file.split(':').map(Number),file=plans[i].files[j];download(file.relativePath.split('/').at(-1),file.content);});
 }
 renderPlans();
 dialog.querySelector('[data-download]').onclick=()=>download('daily-commit-drafts.json',JSON.stringify(plans.map((p,i)=>({...p,summary:container.querySelector(`[data-summary="${i}"]`).value,description:container.querySelector(`[data-description="${i}"]`).value})),null,2),'application/json');
 dialog.addEventListener('cancel',e=>{if(active)e.preventDefault();});
 try{const response=await fetch('/api/git/prepare',{method:'POST',headers:headers(),body:JSON.stringify({records})});const data=await response.json();if(!response.ok)throw Error(data.error);context=data.context;plans=data.days;renderPlans();target.textContent=`GitHub ${context.repository} · 브랜치 ${context.branch} · 기존 스테이징 ${context.otherStagedFiles}개 유지`;
  if(!context.authorConfigured)throw Error('Git user.name과 user.email을 먼저 설정하세요.');button.disabled=false;
 }catch(e){target.textContent=e.message+' 자동 작성 내용은 수정하거나 백업할 수 있습니다.';}
 button.onclick=async()=>{
  if(active||!context)return;
  const days=plans.flatMap((p,i)=>container.querySelector(`[data-select="${i}"]`).checked?[{date:p.date,summary:container.querySelector(`[data-summary="${i}"]`).value,description:container.querySelector(`[data-description="${i}"]`).value}]:[]);
  if(!days.length){result.textContent='커밋할 날짜를 선택하세요.';return;}
  active=true;button.disabled=true;dialog.querySelector('[data-close]').disabled=true;result.textContent='날짜별 커밋을 만들고 업로드하는 중입니다. 창을 닫지 마세요.';
  try{const response=await fetch('/api/git/publish',{method:'POST',headers:headers(),body:JSON.stringify({records,days,expected:context})});const data=await response.json();if(!response.ok)throw Error(data.error||'업로드에 실패했습니다.');
   onResults(data);context={...context,head:data.head};
   result.textContent=(data.pushed?'✓ 업로드 완료':'로컬 커밋은 유지되었습니다. 푸시는 아직 완료되지 않았습니다.')+'\n'+data.results.map(r=>`${r.date} · ${r.changed?'커밋 생성':'내용 변경 없음'} · ${r.commit?.slice(0,7)||''}`).join('\n')+(data.error?'\n'+data.error:'');
   button.textContent=data.pushed?'업로드 완료':'푸시 재시도';button.disabled=data.pushed;
  }catch(e){result.textContent=e.message;button.disabled=false;}
  finally{active=false;dialog.querySelector('[data-close]').disabled=false;}
 };
}
