function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function flash(btn,label){const t=btn.dataset.label||btn.textContent;btn.dataset.label=t;btn.classList.add('ok');btn.textContent=label;setTimeout(()=>{btn.classList.remove('ok');btn.textContent=t;},1400);}
function copyFrom(btn){
  const id=btn.getAttribute('data-copy');const el=id?document.getElementById(id):null;if(!el)return;
  const text=el.textContent;
  const fallback=()=>{el.hidden=false;const r=document.createRange();r.selectNodeContents(el);const s=window.getSelection();s.removeAllRanges();s.addRange(r);btn.textContent='Selected, copy it';};
  try{navigator.clipboard.writeText(text).then(()=>flash(btn,'Copied'),fallback);}catch(e){fallback();}
}
let TASKS=[], OUT=[], DAYS=[], PULSE=null, KEYS={version:1,items:[]}, KEYS_KEY=null, KEYS_READY=false, FILTER='to_send', TASK_AREA='all', CREATOR_LIMIT=5;
const nowISO=()=>new Date().toISOString();
const fmt=v=>v==null||v===''?'–':Number(v).toLocaleString('en-US');

function renderMission(){
  const latest=DAYS[DAYS.length-1]||{};
  const privateDays=DAYS.filter(r=>r.wishlists_outstanding!=null&&r.wishlists_outstanding!=='');
  const last=privateDays[privateDays.length-1]||latest, prev=privateDays[privateDays.length-2]||{};
  const p=PULSE||{}, rv=p.demo_reviews||{}, dc=p.discord||null, fl=p.followers||{};
  const delta=(a,b)=>{if(a==null||b==null||a===''||b==='')return '';const d=Number(a)-Number(b);if(!d)return '';return `<span class="d ${d>0?'good':'bad'}">${d>0?'+':''}${d.toLocaleString('en-US')}</span>`;};
  const line=(label,val,extra='')=>`<div class="line"><span>${label}</span><span><span class="v">${val}</span>${extra}</span></div>`;
  const leadRows=[
    line('Wishlists',fmt(last.wishlists_outstanding),delta(last.wishlists_outstanding,prev.wishlists_outstanding)),
    line('Demo claims',fmt(last.demo_licenses_total),delta(last.demo_licenses_total,prev.demo_licenses_total)),
    line('Playing right now',fmt(p.demo_players_now)),
    line('Reviews',`<span class="good">${fmt(rv.positive)} up</span> / <span class="${rv.negative?'bad':''}">${fmt(rv.negative)} down</span>`),
    line('TikTok studio',fmt(fl.tiktok_studio!=null?fl.tiktok_studio:last.tiktok_studio_followers)),
    line('TikTok dev',fmt(fl.tiktok_dev!=null?fl.tiktok_dev:last.tiktok_dev_followers)),
  ];
  const moreRows=[
    line('Demo players, all time',fmt(last.demo_unique_users_total)),
    line('Bug thread posts',fmt(p.bug_thread_posts)),
    line('Looking-for-players posts',fmt(p.lfg_thread_posts)),
    line('Discord',dc?`${fmt(dc.members)} <span class="d">${fmt(dc.online)} online</span>`:'add invite in More → Settings'),
    line('YouTube',fmt(fl.youtube!=null?fl.youtube:last.youtube_subscribers)),
    line('X',fmt(fl.x!=null?fl.x:last.x_followers)),
    line('Instagram',fmt(fl.instagram!=null?fl.instagram:last.instagram_followers)),
    line('External visits, 7 days',fmt(last.external_visits_7d)),
  ];
  document.getElementById('ledger').innerHTML=leadRows.join('');
  const more=document.getElementById('ledger-more');if(more)more.innerHTML=moreRows.join('');
  document.getElementById('pulse-stamp').textContent=`Steamworks numbers last read ${last.date||'–'}; public numbers ${p.updated_at?('refreshed '+new Date(p.updated_at).toLocaleString()):'not refreshed yet'}.`;
  const revs=rv.latest||[];
  document.getElementById('review-list').innerHTML=revs.length?revs.map(r=>`<li><span class="meta"><b class="${r.up?'good':'bad'}">${r.up?'Recommended':'Not recommended'}</b>, ${esc(r.author)}, ${esc(r.date)}, ${fmt(r.minutes)} min played${r.dev_replied?', you replied':', <b class="bad">no reply yet</b>'}</span><span>${esc(r.text)}</span></li>`).join(''):'<li class="meta">No reviews yet.</li>';
  if(privateDays.length){
    const max=Math.max(1,...privateDays.map(r=>Number(r.wishlists_outstanding)||0));const lastN=privateDays.slice(-14);
    document.getElementById('days-chart').innerHTML=`<div class="bars" role="img" aria-label="Outstanding wishlists by day">${lastN.map(r=>{const v=Number(r.wishlists_outstanding)||0;return `<div class="bar"><span>${v}</span><i style="height:${Math.max(4,Math.round(v/max*90))}px"></i></div>`}).join('')}</div><div class="barlabels">${lastN.map(r=>`<span>${esc(String(r.date).slice(5))}</span>`).join('')}</div>`;
    document.getElementById('days-body').innerHTML=DAYS.map(r=>`<tr><td class="num">${esc(r.date)}</td><td class="num">${fmt(r.wishlists_outstanding)}</td><td class="num">${fmt(r.wishlist_adds)}</td><td class="num">${fmt(r.demo_licenses_total)}</td><td class="num">${fmt(r.demo_unique_users_total)}</td><td class="num">${fmt(r.demo_reviews_positive)}/${fmt(r.demo_reviews_negative)}</td><td class="num">${fmt(r.tiktok_studio_followers)}</td><td class="num">${fmt(r.tiktok_dev_followers)}</td><td>${esc(r.notes||'')}</td></tr>`).join('');
  }
}

function taskCard(d){
  const links=(d.links||[]).map(l=>`<a class="go" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('');
  const copies=(d.copy||[]).map((c,i)=>`<div class="copyrow"><pre class="copytext" id="cp-${esc(d.id)}-${i}">${esc(c.text)}</pre><button class="copy" data-copy="cp-${esc(d.id)}-${i}" type="button">${esc(c.label||'Copy')}</button></div>`).join('');
  const due=d.due?`<span class="tag due">by ${esc(d.due)}</span>`:'';
  const area=d.area?`<span class="tag">${esc(d.area)}</span>`:'';
  const btn=d.who==='james'?`<button type="button" class="done-btn" data-act="done" data-id="${esc(d.id)}">Done</button>`:'';
  return `<li class="task ${d.who==='agent'?'agent':''} ${d.focus?'focus':''}">
    <div class="top"><h3>${esc(d.title)}</h3><div class="row">${due}${area}</div></div>
    ${d.note?`<p><b class="bad">${esc(d.note)}</b></p>`:''}
    ${d.why?`<p>${esc(d.why)}</p>`:''}
    ${d.steps?`<p class="steps">${esc(d.steps)}</p>`:''}
    ${copies}
    ${(links||btn)?`<div class="row">${links}${btn}</div>`:''}
  </li>`;
}
function renderTasks(){
  const open=TASKS.filter(t=>t.status!=='done');
  const order=(a,b)=>(Number(b.focus)-Number(a.focus))||(a.focus_order||99)-(b.focus_order||99)||(a.priority||3)-(b.priority||3)||String(a.due||'9').localeCompare(String(b.due||'9'))||String(a.title).localeCompare(String(b.title));
  const mine=open.filter(t=>t.who==='james').sort(order);
  let focus=mine.filter(t=>t.focus).slice(0,4);
  if(!focus.length)focus=mine.slice(0,4);
  const focusIds=new Set(focus.map(t=>t.id));
  const later=mine.filter(t=>!focusIds.has(t.id)&&(TASK_AREA==='all'||t.area===TASK_AREA));
  const ag=open.filter(t=>t.who==='agent');
  const done=TASKS.filter(t=>t.status==='done').sort((a,b)=>String(b.done_at||'').localeCompare(String(a.done_at||'')));
  document.getElementById('focus-list').innerHTML=focus.length?focus.map(taskCard).join(''):'<li class="empty">Nothing urgent. Go make the game.</li>';
  document.getElementById('focus-count').textContent=focus.length?`${focus.length} actions`:'';
  document.getElementById('later-summary').textContent=`Later (${mine.length-focus.length})`;
  document.getElementById('task-list').innerHTML=later.length?later.map(taskCard).join(''):'<li class="empty">Nothing in this group.</li>';
  document.querySelectorAll('#task-filters button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.area===TASK_AREA)));
  document.getElementById('agent-list').innerHTML=ag.length?ag.map(taskCard).join(''):'<li class="empty">No agent tasks open.</li>';
  document.getElementById('done-list').innerHTML=done.length?done.slice(0,50).map(t=>`<li><span>${esc(t.title)} <span class="meta">${esc((t.done_at||'').slice(0,10))} ${esc(t.done_by||'')}${t.verified?', checked live':''}</span></span><button type="button" data-act="undo" data-id="${esc(t.id)}">Undo</button></li>`).join(''):'<li class="meta">Nothing done yet.</li>';
  renderCounts();
}
function lowerFirst(s){s=String(s||'').trim();return s?s.charAt(0).toLowerCase()+s.slice(1):s;}
function utmFor(c){const src=String(c.handle||c.name||'creator').toLowerCase().replace(/^@/,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');return 'https://store.steampowered.com/app/4995150/Bad_Shrooms/?utm_source='+src+'&utm_medium=creator&utm_campaign=demo_week';}
function dmFor(c){const hook=c.hook?' '+lowerFirst(c.hook).replace(/\.?$/,'.'):'';return 'Hey '+c.name+','+hook+' I made a free party game demo on Steam for 2 to 4 players: bowling with guns, a floor-is-lava round where you shoot your friends into it, and a liminal bathroom maze with an alien chasing you. Felt like your crew\'s kind of mess. '+utmFor(c)+' No strings, just wanted you to have it. James';}
function emailFor(c){return 'Subject: Free demo for your group: bowling with guns\n\nHey '+c.name+',\n\n'+(c.hook?String(c.hook).trim()+'\n\n':'')+'I\'m James, and I make Bad Shrooms on my own. It\'s a first-person party game for 2 to 4 players, on one couch or online through Steam, set in the apartment of an alien named Randy after your group buys bad mushrooms from a guy in a trenchcoat.\n\nThe free demo has Monkey Bowls, which is bowling with guns and trick combos, Hot Boys, where the floor turns to lava and you shoot your friends into it, and The Bathrooms, a liminal maze where Randy hunts you down. It ends in a boss fight with him.\n\nFree demo: '+utmFor(c)+'\n\nNo strings and nothing to sign. If you play it, send me the clip. If anything breaks I\'ll fix it fast; the first patch went out the morning after launch.\n\nJames\nCrunchRock Games\nhello@crunchrock.games';}
const assignedKeys=id=>(KEYS.items||[]).filter(k=>k.outreach_id===id&&k.status!=='available'&&k.status!=='revoked');
function creatorCard(c){
  const st=c.status||'to_send';
  const follow = st==='sent' && c.sent_at ? (()=>{const d=new Date(c.sent_at);d.setDate(d.getDate()+6);return `<span class="meta">follow up ${d.toISOString().slice(0,10)}</span>`})() : '';
  const hasEmail=!!(c.email&&/@.+\./.test(c.email));
  const route=hasEmail?c.email:(c.route||'');
  const id=esc(c.id);
  const assigned=assignedKeys(c.id), keyCount=assigned.length;
  const keyText=assigned.map(k=>k.key).join('\n');
  return `<article class="creator">
    <div class="who"><b>${esc(c.name)}</b><span class="state ${esc(st)}">${esc(st.replace('_',' '))}</span></div>
    <p class="meta">${esc(c.platform)} ${esc(c.handle)}, ${esc(c.followers)}${c.tier?`, tier ${esc(c.tier)}`:''}</p>
    ${route?`<p class="meta">${hasEmail?'Email':'Route'}: ${esc(route)}</p>`:''}
    ${c.recent_url?`<p class="meta"><a href="${esc(c.recent_url)}" target="_blank" rel="noopener">${esc(c.recent_title||'recent video')}</a> ${c.recent_date?`(${esc(c.recent_date)})`:''}</p>`:''}
    <pre class="copytext" hidden id="ch-${id}">${esc(String(c.handle||c.name).replace(/^@/,''))}</pre>
    <pre class="copytext" hidden id="cd-${id}">${esc(dmFor(c))}</pre>
    <pre class="copytext" hidden id="cm-${id}">${esc(emailFor(c))}</pre>
    <pre class="copytext" hidden id="ce-${id}">${esc(route)}</pre>
    <pre class="copytext" hidden id="ck-${id}">${esc(keyText)}</pre>
    <div class="row">
      ${c.url?`<a class="go" href="${esc(c.url)}" target="_blank" rel="noopener">Channel</a>`:''}
      <button class="copy" data-copy="ch-${id}" type="button">Copy handle</button>
      <button class="copy" data-copy="cd-${id}" type="button">Copy DM</button>
      ${hasEmail?`<button class="copy" data-copy="ce-${id}" type="button">Copy address</button><button class="copy" data-copy="cm-${id}" type="button">Copy email</button>`:(route?`<button class="copy" data-copy="ce-${id}" type="button">Copy route</button>`:'')}
    </div>
    <div class="keyrow">
      ${keyCount?`<span class="keycount">${keyCount} key${keyCount===1?'':'s'} assigned</span><button class="copy" data-copy="ck-${id}" type="button">Copy keys</button>${keyCount<8?`<label class="meta" for="kn-${id}">Total</label><select id="kn-${id}" data-key-count="${id}" aria-label="Total keys to assign">${Array.from({length:8-keyCount},(_,i)=>`<option value="${keyCount+i+1}">${keyCount+i+1}</option>`).join('')}</select><button type="button" data-act="keys" data-id="${id}">Add + copy</button>`:''}`:`<label class="meta" for="kn-${id}">Alpha keys</label><select id="kn-${id}" data-key-count="${id}" aria-label="Keys to assign">${Array.from({length:8},(_,i)=>`<option value="${i+1}"${i===3?' selected':''}>${i+1}</option>`).join('')}</select><button type="button" data-act="keys" data-id="${id}">Assign + copy</button>`}
    </div>
    <div class="row">
      <button type="button" data-act="cstate" data-id="${id}" data-s="sent">Sent</button>
      <button type="button" data-act="cstate" data-id="${id}" data-s="replied">Replied</button>
      <button type="button" data-act="cstate" data-id="${id}" data-s="posted">Posted</button>
      <button type="button" data-act="cstate" data-id="${id}" data-s="pass">Pass</button>
      ${follow}</div>
  </article>`;
}
function renderCreators(){
  const list=OUT.filter(c=>(c.status||'to_send')===FILTER).sort((a,b)=>(a.rank||999)-(b.rank||999)||String(a.tier||'Z').localeCompare(String(b.tier||'Z'))||String(a.name).localeCompare(String(b.name)));
  document.getElementById('creator-list').innerHTML=list.length?list.slice(0,CREATOR_LIMIT).map(creatorCard).join(''):'<div class="empty">No creators here.</div>';
  const more=document.getElementById('creator-more');if(more){more.hidden=list.length<=CREATOR_LIMIT;more.textContent=`Show five more (${list.length-CREATOR_LIMIT} left)`;}
  document.querySelectorAll('#filters button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.f===FILTER)));
  renderKeyPool();
  renderCounts();
}
function renderKeyPool(){
  const el=document.getElementById('key-pool');if(!el)return;
  if(!KEYS_READY){el.innerHTML='<span>Key pool unavailable.</span>';return;}
  const counts=(KEYS.items||[]).reduce((o,k)=>(o[k.status||'available']=(o[k.status||'available']||0)+1,o),{});
  const available=counts.available||0, assigned=(counts.assigned||0)+(counts.sent||0);
  el.innerHTML=`<span><b>${available}</b> available</span><span>${assigned} assigned</span>${available<24?'<span class="bad">Request/import more soon</span>':''}`;
}
function renderCounts(){
  const mine=TASKS.filter(t=>t.status!=='done'&&t.who==='james').length;
  const focus=TASKS.filter(t=>t.status!=='done'&&t.who==='james'&&t.focus).length;
  const done=TASKS.filter(t=>t.status==='done').length;
  const by=s=>OUT.filter(c=>(c.status||'to_send')===s).length;
  document.getElementById('counts').innerHTML=`<span class="chip you">${focus||Math.min(mine,4)} do now</span><span class="chip">${mine} total open</span><span class="chip">${by('sent')} pitched</span><span class="chip">${by('replied')} replied</span>`;
}

function setView(name){
  if(!['today','numbers','creators','more'].includes(name))name='today';
  document.querySelectorAll('[data-panel]').forEach(p=>{p.hidden=p.dataset.panel!==name;});
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));
  try{history.replaceState(null,'','#'+name);}catch(e){}
  window.scrollTo(0,0);
}
function renderGuide(rows){
  rows=rows.slice().sort((a,b)=>(a.priority||3)-(b.priority||3)||String(b.updated||'').localeCompare(String(a.updated||'')));
  document.getElementById('guide-list').innerHTML=rows.length?rows.map(g=>`<article class="advice"><span class="kind">${esc(g.kind||'note')}${g.updated?', '+esc(String(g.updated).slice(0,10)):''}</span><h3>${esc(g.title)}</h3><p class="body">${esc(g.body)}</p></article>`).join(''):'<div class="empty">No strategy notes yet.</div>';
}
function renderPosts(rows){
  rows=rows.slice().sort((a,b)=>String(b.posted_at||'').localeCompare(String(a.posted_at||'')));
  document.getElementById('post-body').innerHTML=rows.length?rows.map(p=>{const rate=p.views?((Number(p.likes)||0)/p.views*100).toFixed(1)+'%':'–';return `<tr><td class="num">${esc(String(p.posted_at||'').slice(5,16).replace('T',' '))}</td><td>${esc(p.account)}</td><td>${p.url?`<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.caption)}</a>`:esc(p.caption)}<br><span class="meta">${esc(p.format||'')}</span></td><td class="num">${fmt(p.views)}</td><td class="num">${fmt(p.likes)}</td><td class="num">${rate}</td><td class="num">${fmt(p.saves)}</td><td>${esc(p.verdict||'')}${p.fix?`<br><b>Next time:</b> ${esc(p.fix)}`:''}</td></tr>`;}).join(''):'<tr><td colspan="8"><div class="empty">No posts logged yet.</div></td></tr>';
}
/* ---------- data layer: the private repo crunchrock/badshrooms-desk-data through the GitHub contents API ---------- */
const REPO='crunchrock/badshrooms-desk-data';
const FILES=['tasks','outreach','days','guidance','posts','pulse','settings'];
const LS={
  get(k,d){try{const v=localStorage.getItem('bsd.'+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},
  set(k,v){try{localStorage.setItem('bsd.'+k,JSON.stringify(v));}catch(e){}},
  del(k){try{localStorage.removeItem('bsd.'+k);}catch(e){}}
};
let TOKEN='';
let RAW={};                 // file name -> parsed JSON as last fetched
let QUEUE=LS.get('queue',[]); // taps not yet saved: {file,id,patch,message}
let flushing=false, refreshing=false, lastOk=0;

const $=id=>document.getElementById(id);
const b64ToStr=b=>new TextDecoder().decode(Uint8Array.from(atob(String(b).replace(/\s/g,'')),c=>c.charCodeAt(0)));
const strToB64=s=>{const u=new TextEncoder().encode(s);let t='';for(let i=0;i<u.length;i+=0x8000)t+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(t);};
const sortKeys=v=>Array.isArray(v)?v.map(sortKeys):(v&&typeof v==='object'?Object.keys(v).sort().reduce((o,k)=>(o[k]=sortKeys(v[k]),o),{}):v);
const pretty=o=>JSON.stringify(sortKeys(o),null,1)+'\n';

function gh(method,path,body){
  return fetch(`https://api.github.com/repos/${REPO}/contents/${path}`+(method==='GET'?'?ref=main':''),{
    method,cache:'no-store',body:body?JSON.stringify(body):undefined,
    headers:{Authorization:`Bearer ${TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}
  });
}
class ApiError extends Error{constructor(status,msg){super(msg);this.status=status;}}
function explain(r){
  if(r.status===401)return 'GitHub refused the saved access. Lock the app in Settings; the owner may need to renew it.';
  if(r.status===403)return 'GitHub said no (403). The token may lack Contents: Read and write, or you are rate limited.';
  if(r.status===404)return 'Could not find the desk data.';
  return 'GitHub answered '+r.status+'.';
}
async function getFile(name){
  const r=await gh('GET',`data/${name}.json`);
  if(!r.ok)throw new ApiError(r.status,explain(r));
  const j=await r.json();
  return {sha:j.sha,data:JSON.parse(b64ToStr(j.content||'')||'{}')};
}

function setErr(msg){const e=$('err');if(!e)return;e.textContent=msg||'';e.hidden=!msg;}
function stamp(){const s=$('sync-stamp');if(!s)return;const q=QUEUE.length?`${QUEUE.length} tap${QUEUE.length>1?'s':''} waiting to save. `:'';s.textContent=q+(lastOk?'Updated '+new Date(lastOk).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'Not loaded yet');}

function applyPatch(doc,op){
  if(op.id==null){Object.assign(doc,op.patch);return true;}
  if(!doc[op.id]){if(op.create){doc[op.id]=Object.assign({},op.patch);return true;}return false;}
  Object.assign(doc[op.id],op.patch);return true;
}
const docsOf=o=>Object.keys(o||{}).map(id=>Object.assign({id},o[id]));

function project(){
  // RAW plus any taps still queued, so a tap stays visible until it is saved
  const view={};
  FILES.forEach(f=>{view[f]=RAW[f]==null?null:JSON.parse(JSON.stringify(RAW[f]));});
  QUEUE.forEach(op=>{if(view[op.file])applyPatch(view[op.file],op);});
  if(view.tasks){TASKS=docsOf(view.tasks);renderTasks();}
  if(view.outreach){OUT=docsOf(view.outreach);renderCreators();}
  if(view.days){DAYS=Object.values(view.days).filter(r=>r&&r.date).sort((a,b)=>String(a.date).localeCompare(String(b.date)));}
  if(view.pulse)PULSE=view.pulse;
  if(view.days||view.pulse)renderMission();
  if(view.guidance)renderGuide(Object.values(view.guidance));
  if(view.posts)renderPosts(Object.values(view.posts));
  if(view.settings){const inp=$('discord-invite');if(inp&&!inp.value)inp.value=view.settings.discord_invite||'';const sheet=$('key-sheet');if(sheet&&view.settings.key_intake_sheet)sheet.href=view.settings.key_intake_sheet;}
  stamp();
}

async function refresh(){
  if(!TOKEN||refreshing||flushing)return;
  refreshing=true;let keyError='';
  try{
    const got=await Promise.all(FILES.map(f=>getFile(f).then(x=>[f,x.data])));
    got.forEach(([f,d])=>{RAW[f]=d;});
    if(KEYS_KEY){try{const pool=await getKeyPool();KEYS=pool.data;KEYS_READY=true;}catch(e){KEYS_READY=false;keyError='The creator key pool could not load. Other desk data is still available.';}}
    lastOk=Date.now();
    if(!QUEUE.length)setErr(keyError);
    project();
  }catch(e){
    setErr(e instanceof ApiError?e.message:'Could not reach GitHub. Showing what was loaded last.');
    stamp();
  }finally{refreshing=false;}
  if(QUEUE.length)flush();
}

async function saveOp(op){
  let lastStatus=0;
  for(let attempt=0;attempt<3;attempt++){
    const cur=await getFile(op.file);
    if(!applyPatch(cur.data,op))return 'missing';
    const r=await gh('PUT',`data/${op.file}.json`,{message:op.message,content:strToB64(pretty(cur.data)),sha:cur.sha,branch:'main'});
    if(r.ok){RAW[op.file]=cur.data;return 'ok';}
    lastStatus=r.status;
    if(r.status===409||r.status===422)continue; // sha moved under us: refetch, reapply, retry
    throw new ApiError(r.status,explain(r));
  }
  throw new ApiError(lastStatus,'GitHub kept reporting a conflict. Your tap is saved on this phone and will retry.');
}
async function flush(){
  if(flushing||!TOKEN)return;
  flushing=true;
  try{
    while(QUEUE.length){
      const op=QUEUE[0];
      const res=await saveOp(op);
      QUEUE.shift();LS.set('queue',QUEUE);
      if(res==='missing')setErr('One change was skipped because that item no longer exists.');
      else lastOk=Date.now();
    }
    if(!QUEUE.length&&$('err').textContent.indexOf('skipped')<0)setErr('');
  }catch(e){
    setErr((e instanceof ApiError?e.message:'Could not reach GitHub.')+' The tap is kept and will retry.');
  }finally{flushing=false;project();}
}
function enqueue(op){
  QUEUE.push(op);LS.set('queue',QUEUE);
  project();
  flush();
}

function titleOf(id){const t=TASKS.find(x=>x.id===id);return t?t.title:id;}
function nameOf(id){const c=OUT.find(x=>x.id===id);return c?c.name:id;}

document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.classList.contains('copy')){copyFrom(b);return;}
  if(b.dataset.view){setView(b.dataset.view);return;}
  if(b.dataset.area){TASK_AREA=b.dataset.area;renderTasks();return;}
  if(b.dataset.f){FILTER=b.dataset.f;CREATOR_LIMIT=5;renderCreators();return;}
  const act=b.dataset.act, id=b.dataset.id;
  if(!act)return;
  if(act==='done')enqueue({file:'tasks',id,patch:{status:'done',done_at:nowISO(),done_by:'james',verified:false},message:'Done: '+titleOf(id)});
  else if(act==='undo')enqueue({file:'tasks',id,patch:{status:'open',done_at:null,done_by:null,verified:false},message:'Undo: '+titleOf(id)});
  else if(act==='cstate'){const s=b.dataset.s;const patch={status:s};patch[s+'_at']=nowISO();enqueue({file:'outreach',id,patch,message:nameOf(id)+': '+s.replace('_',' ')});updateCreatorKeyState(id,s).catch(x=>setErr(x.message));}
  else if(act==='keys'){const select=document.querySelector(`[data-key-count="${CSS.escape(id)}"]`);assignCreatorKeys(b,id,Number(select&&select.value||1)).catch(x=>setErr(x.message));}
});
$('creator-more').addEventListener('click',()=>{CREATOR_LIMIT+=5;renderCreators();});
$('add-inbound').addEventListener('click',()=>{
  const name=$('inbound-name').value.trim(), handle=$('inbound-handle').value.trim(), platform=$('inbound-platform').value, route=$('inbound-route').value.trim(), status=$('inbound-status');
  if(!name){status.textContent='Add a name first.';return;}
  const slug=(handle||name).toLowerCase().replace(/^@/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'creator', id='inbound-'+slug+'-'+Date.now().toString(36);
  enqueue({file:'outreach',id,create:true,patch:{name,platform,handle,url:'',followers:'',email:platform==='Email'?route:'',route,tier:'inbound',rank:0,hook:'',recent_title:'',recent_url:'',recent_date:'',why:'Inbound DM',status:'to_send',sent_at:null,replied_at:null,posted_at:null,note:'Added from the Command Center',created:nowISO()},message:'Add inbound creator: '+name});
  $('inbound-name').value='';$('inbound-handle').value='';$('inbound-route').value='';status.textContent='Added. Their card is first in To send.';FILTER='to_send';CREATOR_LIMIT=5;renderCreators();
});
$('refresh').addEventListener('click',()=>{setErr('');refresh();});
$('save-discord').addEventListener('click',e=>{
  const val=$('discord-invite').value.trim(), st=$('discord-status');
  if(!/^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+\/?$/.test(val)){st.textContent='Paste a link that starts with https://discord.gg/ or https://discord.com/invite/.';return;}
  enqueue({file:'settings',id:null,patch:{discord_invite:val},message:'Discord invite'});
  st.textContent='Saving. The next pulse shows your member count.';
});
$('forget').addEventListener('click',()=>{
  if(QUEUE.length&&!confirm('Some taps have not saved yet. Lock the app anyway?'))return;
  forgetDeviceKey();LS.del('queue');TOKEN='';KEYS_KEY=null;KEYS_READY=false;QUEUE=[];RAW={};showGate();
});

/* ---------- unlock: a password opens vault.json, which holds the GitHub token ---------- */
const b64ToBytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const bytesToB64=u=>{let t='';u.forEach(c=>t+=String.fromCharCode(c));return btoa(t);};
const DEVICE_DB='badshrooms-desk', DEVICE_STORE='private';
function deviceDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DEVICE_DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(DEVICE_STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function deviceGet(k){try{const db=await deviceDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(DEVICE_STORE,'readonly'),r=tx.objectStore(DEVICE_STORE).get(k);r.onsuccess=()=>resolve(r.result||'');r.onerror=()=>reject(r.error);});}catch(e){return '';}}
async function deviceSet(k,v){try{const db=await deviceDb();await new Promise((resolve,reject)=>{const tx=db.transaction(DEVICE_STORE,'readwrite');tx.objectStore(DEVICE_STORE).put(v,k);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch(e){}}
async function deviceDel(k){try{const db=await deviceDb();await new Promise((resolve,reject)=>{const tx=db.transaction(DEVICE_STORE,'readwrite');tx.objectStore(DEVICE_STORE).delete(k);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch(e){}}
async function rememberDeviceKey(k){LS.set('key',k);await deviceSet('vault-key',k);try{if(navigator.storage&&navigator.storage.persist)await navigator.storage.persist();}catch(e){}}
async function recalledDeviceKey(){return LS.get('key','')||await deviceGet('vault-key');}
function forgetDeviceKey(){LS.del('key');deviceDel('vault-key');LS.del('vault');}
async function getVault(){
  try{const r=await fetch('vault.json',{cache:'no-store'});if(!r.ok)throw new Error('vault');const v=await r.json();LS.set('vault',v);return v;}catch(e){const cached=LS.get('vault',null);if(cached)return cached;throw e;}
}
async function openVault(v,key){
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(v.iv)},key,b64ToBytes(v.ct));
  const o=JSON.parse(new TextDecoder().decode(pt));
  if(!o.token)throw new Error('vault');
  return o;
}
async function unlockWithPassword(pw){
  const v=await getVault();
  const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64ToBytes(v.salt),iterations:v.iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},true,['decrypt']);
  const o=await openVault(v,key);
  await rememberDeviceKey(bytesToB64(new Uint8Array(await crypto.subtle.exportKey('raw',key))));
  TOKEN=o.token;
  KEYS_KEY=await crypto.subtle.importKey('raw',b64ToBytes(o.keys_key),'AES-GCM',false,['encrypt','decrypt']);
}
async function unlockWithStoredKey(){
  const k=await recalledDeviceKey();if(!k)return false;
  try{
    const key=await crypto.subtle.importKey('raw',b64ToBytes(k),'AES-GCM',false,['decrypt']);
    const o=await openVault(await getVault(),key);TOKEN=o.token;KEYS_KEY=await crypto.subtle.importKey('raw',b64ToBytes(o.keys_key),'AES-GCM',false,['encrypt','decrypt']);await rememberDeviceKey(k);return true;
  }catch(e){
    // A transient fetch uses the cached vault. Only a real decrypt mismatch forgets this phone.
    if(e&&e.name==='OperationError')forgetDeviceKey();return false;
  }
}

async function decodeKeyPool(envelope){const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(envelope.iv)},KEYS_KEY,b64ToBytes(envelope.ct));return JSON.parse(new TextDecoder().decode(pt));}
async function encodeKeyPool(data){const iv=crypto.getRandomValues(new Uint8Array(12)),pt=new TextEncoder().encode(JSON.stringify(data)),ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},KEYS_KEY,pt);return {v:1,iv:bytesToB64(iv),ct:bytesToB64(new Uint8Array(ct))};}
async function getKeyPool(){const r=await gh('GET','data/keys.enc.json');if(!r.ok)throw new ApiError(r.status,explain(r));const j=await r.json(),envelope=JSON.parse(b64ToStr(j.content||''));return {sha:j.sha,data:await decodeKeyPool(envelope)};}
async function saveKeyPool(change,message){let status=0;for(let attempt=0;attempt<3;attempt++){const cur=await getKeyPool();change(cur.data);cur.data.updated_at=nowISO();const envelope=await encodeKeyPool(cur.data);const r=await gh('PUT','data/keys.enc.json',{message,content:strToB64(pretty(envelope)),sha:cur.sha,branch:'main'});if(r.ok){KEYS=cur.data;KEYS_READY=true;renderCreators();return;}status=r.status;if(status===409||status===422)continue;throw new ApiError(status,explain(r));}throw new ApiError(status,'The key pool kept changing. Try once more.');}
async function copyPlain(btn,text){try{await navigator.clipboard.writeText(text);flash(btn,'Copied');}catch(e){setErr('The keys were assigned, but the browser blocked Copy. Tap Copy keys on the card.');}}
async function assignCreatorKeys(btn,id,count){if(!KEYS_READY)throw new Error('Key pool is not loaded yet.');btn.disabled=true;try{let copied=[];await saveKeyPool(data=>{const existing=data.items.filter(k=>k.outreach_id===id&&k.status!=='available'&&k.status!=='revoked');const need=Math.max(0,count-existing.length),available=data.items.filter(k=>(k.status||'available')==='available');if(need>available.length)throw new Error(`Only ${available.length} keys are available.`);const c=OUT.find(x=>x.id===id);available.slice(0,need).forEach(k=>Object.assign(k,{status:'assigned',outreach_id:id,assigned_to:c?c.name:id,assigned_at:nowISO()}));copied=data.items.filter(k=>k.outreach_id===id&&k.status!=='available'&&k.status!=='revoked').map(k=>k.key);},`Assign ${count} key${count===1?'':'s'} to ${nameOf(id)}`);enqueue({file:'outreach',id,patch:{key_count:copied.length,keys_assigned_at:nowISO()},message:nameOf(id)+': keys assigned'});await copyPlain(btn,copied.join('\n'));}finally{btn.disabled=false;}}
async function updateCreatorKeyState(id,state){if(!KEYS_READY)return;if(state==='sent')await saveKeyPool(data=>data.items.filter(k=>k.outreach_id===id&&k.status==='assigned').forEach(k=>{k.status='sent';k.sent_at=nowISO();}),`Mark ${nameOf(id)} keys sent`);else if(state==='pass')await saveKeyPool(data=>data.items.filter(k=>k.outreach_id===id&&k.status==='assigned').forEach(k=>{k.status='available';k.outreach_id=null;k.assigned_to=null;k.assigned_at=null;}),`Return unused ${nameOf(id)} keys`);}
$('unlock-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const er=$('setup-err'), pw=$('pw-input').value, btn=$('unlock-btn');
  if(!pw){er.textContent='Type the password.';er.hidden=false;return;}
  btn.disabled=true;er.hidden=true;
  try{
    await unlockWithPassword(pw);
    $('pw-input').value='';showGate();
  }catch(err){
    er.textContent=err&&err.message==='vault'?'Could not load the app data. Try again.':"That's not it.";
    er.hidden=false;
  }finally{btn.disabled=false;}
});

function showGate(){
  const has=!!TOKEN;
  $('setup').hidden=has;$('app').hidden=!has;
  if(has)refresh();
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});
setInterval(()=>{if(document.visibilityState==='visible')refresh();},60000);
setView(location.hash.slice(1)||'today');
(async()=>{await unlockWithStoredKey();showGate();})();
