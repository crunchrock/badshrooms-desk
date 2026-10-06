/* Owner-authored copy only. Private ledger; application to Unity is an explicit TSV import. */
let COPY_FILTER='all', COPY_SEARCH='', COPY_LIMIT=25, COPY_BUFFERS={};
const copyVersion=c=>String(c.revision||c.updated_at||'');
const copyCandidate=c=>String(c.candidate_text==null?c.source_text||'':c.candidate_text);
function copyValidation(record,text){
  const placeholders=s=>(String(s).match(/\{[^{}\r\n]+\}/g)||[]).sort();
  const markup=s=>String(s).match(/<[^<>\r\n]+>/g)||[];
  return JSON.stringify(placeholders(record.source_text||''))===JSON.stringify(placeholders(text))&&JSON.stringify(markup(record.source_text||''))===JSON.stringify(markup(text))?'':'Preserve every source placeholder and markup tag.';
}
function copyBuffer(c){
  let b=COPY_BUFFERS[c.id];
  if(typeof b==='string'){b={text:b,base:copyVersion(c)};COPY_BUFFERS[c.id]=b;}
  return b&&typeof b.text==='string'?b:null;
}
function copyWarnings(c,text,conflict){
  const source=c.orphan?'Missing from the latest source export.':c.stale?'Game source changed. Compare it with your candidate before saving.':c.source_orphan?'The Green Room has not resolved an active callsite.':'';
  const blocked=c.swappable?'':c.blocked_reason||'This row can be reviewed here; applying a replacement requires a source-code change.';
  const frozen=c.frozen?'Frozen by lore. Automatic sync and approved export skip this row; an owner-approved source change is required.':'';
  return [source,blocked,frozen,copyValidation(c,text),conflict?'This device has an older draft. Review both versions before choosing which to save.':''].filter(Boolean).join(' ');
}
function copyExportable(c){return c.swappable&&!c.frozen&&!c.orphan&&!c.source_orphan&&!c.stale&&!copyValidation(c,copyCandidate(c));}
function renderCopy(){
  const el=$('copy-list');if(!el)return;
  const q=COPY_SEARCH.trim().toLowerCase(),state=c=>c.orphan||c.source_orphan?'orphan':c.stale?'stale':c.status||'unreviewed';
  const rows=COPY.filter(c=>(COPY_FILTER==='all'||state(c)===COPY_FILTER)&&(!q||[c.id,c.group,c.context,c.source_text,copyCandidate(c),c.source_ref].some(v=>String(v||'').toLowerCase().includes(q))))
    .sort((a,b)=>String(a.group||'').localeCompare(String(b.group||''))||a.id.localeCompare(b.id,undefined,{numeric:true}));
  const count=s=>COPY.filter(c=>state(c)===s).length,blocked=COPY.filter(c=>!c.swappable).length;
  const hub=$('hub-copy-status');if(hub)hub.textContent=COPY.length?COPY.length+' lines and labels; '+count('draft')+' drafts; '+count('approved')+' approved':'Waiting for the first Green Room export.';
  $('copy-counts').textContent=`${COPY.length} entries; ${count('draft')} drafts; ${count('approved')} approved; ${count('applied')} match game source; ${blocked} read-only; ${COPY.filter(c=>c.frozen).length} frozen; ${count('orphan')} missing or unresolved.`;
  el.innerHTML=rows.length?rows.slice(0,COPY_LIMIT).map(c=>{
    const b=copyBuffer(c),saved=copyCandidate(c),candidate=b?b.text:saved,dirty=candidate!==saved,conflict=!!b&&b.base!==copyVersion(c);
    const warning=copyValidation(c,candidate),sourceIssue=c.orphan?'Missing from the latest source export.':c.stale?'Game source changed. Compare it with your candidate before saving.':c.source_orphan?'The Green Room has not resolved an active callsite.':'';
    return `<article class="copy-entry ${sourceIssue||conflict?'copy-warning':''}" data-copy-entry="${esc(c.id)}">
      <div class="copy-entry-head"><div><span class="kind">${esc(c.group||'Unsorted')}</span><h3>${esc(c.id)}</h3></div><span class="state ${esc(c.status||'unreviewed')}">${esc(state(c))}</span></div>
      <p class="copy-context">${esc(c.context||'No trigger context in source export.')}</p>
      <p class="meta">${esc(c.source_ref||'Source path unavailable')}</p>
      <p class="meta">${c.swappable?'Writable asset text':'Read-only · source change required'}${c.frozen?' · Frozen by lore':''}${c.orphan?' · Missing source':c.source_orphan?' · Unresolved callsite':''}</p>
      <details class="copy-source" ${sourceIssue||conflict?'open':''}><summary>Current game text</summary><pre>${esc(c.source_text||'')}</pre></details>
      ${conflict?`<details class="copy-source" open><summary>Candidate saved on another device</summary><pre>${esc(saved)}</pre></details>`:''}
      <label class="copy-editor-label">Jim's candidate<textarea data-copy-candidate="${esc(c.id)}" rows="3" spellcheck="true">${esc(candidate)}</textarea></label>
      <p class="copy-validation" role="status">${esc(copyWarnings(c,candidate,conflict))}</p>
      <div class="row">
        <button type="button" data-copy-act="draft" data-id="${esc(c.id)}" ${c.orphan||conflict?'disabled':''}>Save draft</button>
        <button type="button" data-copy-act="approve" data-id="${esc(c.id)}" ${c.orphan||conflict||warning?'disabled':''}>Approve wording</button>
        ${conflict?`<button type="button" data-copy-act="rebase" data-id="${esc(c.id)}">Use my draft on latest source</button><button type="button" data-copy-act="reload" data-id="${esc(c.id)}">Use saved candidate</button>`:''}
        ${(c.history||[]).length?`<button type="button" data-copy-act="revert" data-id="${esc(c.id)}">Revert last saved edit</button>`:''}
        <span class="meta copy-save-status">${dirty?'Draft kept on this device; not synced':c.updated_at?'Synced '+esc(new Date(c.updated_at).toLocaleString()):'Not saved'}</span>
      </div>
    </article>`;
  }).join(''):'<div class="empty">No copy rows match this filter.</div>';
  const more=$('copy-more');if(more){more.hidden=rows.length<=COPY_LIMIT;more.textContent=`Show ${Math.min(25,rows.length-COPY_LIMIT)} more (${rows.length-COPY_LIMIT} left)`;}
}
function copyTsvCell(s){return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/\t/g,'\\t');}
function unescapeCopyCell(s){
  const value=String(s||'');let out='';
  for(let i=0;i<value.length;i++){
    if(value[i]==='\\'&&i+1<value.length){const next=value[i+1],chars={'\\':'\\',n:'\n',r:'\r',t:'\t'};if(Object.prototype.hasOwnProperty.call(chars,next)){out+=chars[next];i++;continue;}}
    out+=value[i];
  }return out;
}
function parseCopyTsv(text){
  const rows=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());
  if(!rows.length)throw new Error('The TSV is empty.');
  const h=rows[0].split('\t').map(x=>x.trim().toLowerCase()),ix=k=>h.indexOf(k);
  if(new Set(h).size!==h.length)throw new Error('Duplicate TSV header. Nothing was imported.');
  for(const k of ['id','current','replacement','verdict','kind','group','context','swappable','source','encoding'])if(ix(k)<0)throw new Error(`Missing ${k}. Export a fresh full TSV from the updated Green Room.`);
  const out=[],seen=new Set();
  for(let n=1;n<rows.length;n++){
    const cells=rows[n].split('\t'),get=k=>ix(k)<0?'':unescapeCopyCell(cells[ix(k)]||''),id=get('id');
    if(cells.length!==h.length)throw new Error(`Row ${n+1} has missing or extra columns. Nothing was imported.`);
    if(!/^(line|copy)\/[^\u0000\r\n\t]+$/.test(id))throw new Error(`Row ${n+1} is not a Line or Copy stable ID.`);
    if(seen.has(id))throw new Error(`Duplicate stable ID on row ${n+1}. Nothing was imported.`);seen.add(id);
    if(!['true','false'].includes(get('swappable')))throw new Error(`Row ${n+1} has no reliable writable-source flag.`);
    if(get('kind')!==(id.startsWith('line/')?'Line':'Copy'))throw new Error(`Row ${n+1} has an inconsistent source kind.`);
    if(get('encoding')!=='escaped-v2')throw new Error(`Row ${n+1} has an unsupported TSV encoding.`);
    const source=get('current');
    out.push({id,source_text:source,candidate_text:source,group:get('group')||'Unsorted',context:get('context'),kind:get('kind'),swappable:get('swappable')==='true',source_ref:get('source'),blocked_reason:get('blocked_reason'),source_orphan:get('orphan')==='true',frozen:get('frozen')==='true'});
  }
  if(!out.length)throw new Error('No copy rows were found.');return out;
}
function mergeCopySource(doc,rows,now=nowISO()){
  const incoming=new Map(rows.map(r=>[r.id,r])),next=JSON.parse(JSON.stringify(doc));
  for(const [id,c] of Object.entries(next)){
    if(!c||typeof c!=='object'||Array.isArray(c))throw new Error('The private copy ledger is malformed. It was left unchanged.');
    if(!incoming.has(id)&&!c.orphan)next[id]={...c,orphan:true,revision:crypto.randomUUID(),updated_at:now};
  }
  for(const r of rows){
    const old=Object.prototype.hasOwnProperty.call(next,r.id)?next[r.id]:null;
    if(!old){next[r.id]={...r,status:'unreviewed',stale:false,orphan:false,history:[],revision:crypto.randomUUID(),updated_at:now};continue;}
    const matched=copyCandidate(old)===r.source_text&&['approved','applied'].includes(old.status),changed=String(old.source_text||'')!==r.source_text;
    const merged={...old,...r,candidate_text:copyCandidate(old),status:matched?'applied':old.status||'unreviewed',stale:matched?false:changed||!!old.stale,orphan:false};
    if(matched)merged.applied_at=old.applied_at||now;
    if(JSON.stringify(merged)!==JSON.stringify(old)){merged.revision=crypto.randomUUID();merged.updated_at=now;}
    next[r.id]=merged;
  }return next;
}
async function importCopyTsv(rows){
  for(let attempt=0;attempt<3;attempt++){
    const cur=await getFile('copy');if(!cur.data||typeof cur.data!=='object'||Array.isArray(cur.data))throw new Error('The copy ledger is malformed; it was left unchanged.');
    const doc=mergeCopySource(cur.data,rows),res=await gh('PUT','data/copy.json',{message:`Import ${rows.length} Green Room copy rows`,content:strToB64(pretty(doc)),...(cur.sha?{sha:cur.sha}:{}),branch:'main'});
    if(res.ok){RAW.copy=doc;COPY_WRITE_REVISION++;project();return;}
    if(res.status!==409&&res.status!==422)throw new ApiError(res.status,explain(res));
  }throw new Error('Copy source changed during import. Refresh and retry; existing rows were retained.');
}
async function saveCopyEntry(id,patch,expected,suppressHistory=false){
  for(let attempt=0;attempt<3;attempt++){
    const cur=await getFile('copy'),doc=cur.data,old=doc&&Object.prototype.hasOwnProperty.call(doc,id)?doc[id]:null;
    if(!old)throw new Error('This row is absent from the private ledger. Import a fresh source TSV.');
    if(copyVersion(old)!==expected)throw new Error('Another device changed this row. Your draft stays on this device. Refresh and compare both versions.');
    if(old.orphan)throw new Error('This row is missing from the latest source export.');
    const candidate=patch.candidate_text==null?copyCandidate(old):String(patch.candidate_text);
    if(patch.status==='approved'){const issue=copyValidation(old,candidate);if(issue)throw new Error(issue);}
    const history=suppressHistory?(patch.history||[]):(old.history||[]).slice();
    if(!suppressHistory&&candidate!==copyCandidate(old))history.push({candidate_text:copyCandidate(old),status:old.status,saved_at:old.updated_at});
    const next={...old,...patch,candidate_text:candidate,history:history.slice(-20),stale:false,revision:crypto.randomUUID(),updated_at:nowISO()};doc[id]=next;
    const res=await gh('PUT','data/copy.json',{message:`Copy Lab ${patch.status||'edit'}: ${id}`,content:strToB64(pretty(doc)),sha:cur.sha,branch:'main'});
    if(res.ok){
      RAW.copy=doc;COPY_WRITE_REVISION++;
      const buffer=copyBuffer(old);
      if(buffer&&buffer.text!==candidate)COPY_BUFFERS[id]={text:buffer.text,base:copyVersion(next)};
      else delete COPY_BUFFERS[id];
      LS.set('copy-drafts',COPY_BUFFERS);project();return next;
    }
    if(res.status!==409&&res.status!==422)throw new ApiError(res.status,explain(res));
  }throw new Error('Copy data kept changing. Your draft stays on this device; refresh before retrying.');
}
function buildApprovedCopyTsv(rows){
  const reviewed=rows.filter(c=>c.status==='approved'&&!c.stale&&!c.orphan),approved=reviewed.filter(copyExportable);
  const lines=['id\tcurrent\treplacement\tverdict\toperation\tencoding'];
  approved.sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true})).forEach(c=>{const changed=copyCandidate(c)!==c.source_text;lines.push([c.id,c.source_text,changed?copyCandidate(c):'',changed?'Replace':'Keep',changed?'replace':'keep','escaped-v2'].map(copyTsvCell).join('\t'));});
  return {text:lines.join('\n')+'\n',count:approved.length,blocked:reviewed.length-approved.length};
}
function downloadCopyTsv(){
  const result=buildApprovedCopyTsv(COPY);if(!result.count){$('copy-sync').textContent=`No approved writable rows to export. ${result.blocked} reviewed rows require source changes.`;return;}
  const blob=new Blob([result.text],{type:'text/tab-separated-values;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='bad-shrooms-approved-copy.tsv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('copy-sync').textContent=`Exported ${result.count} rows. Apply this file with The Green Room's “Apply TSV and save assets”, then reimport its fresh full source TSV to verify application. ${result.blocked} reviewed rows require source changes. Unsynced device drafts were excluded.`;
}
function setupCopyLab(){
  $('copy-import').addEventListener('change',async e=>{
    const file=e.target.files&&e.target.files[0];if(!file)return;e.target.disabled=true;
    try{if(file.size>10*1024*1024)throw new Error('Export a fresh full Green Room TSV under 10 MB.');const rows=parseCopyTsv(await file.text());await importCopyTsv(rows);$('copy-sync').textContent=`Imported ${rows.length} stable IDs. Saved wording and history were retained. Changed or missing sources are flagged.`;setErr('');}
    catch(err){setErr(err.message||'Could not import this TSV.');}finally{e.target.value='';e.target.disabled=false;}
  });
  $('copy-export').addEventListener('click',downloadCopyTsv);
  $('copy-refresh').addEventListener('click',async()=>{const revision=COPY_WRITE_REVISION,read=++COPY_READ_REVISION;try{const x=await getFile('copy');if(revision===COPY_WRITE_REVISION&&read===COPY_READ_REVISION)RAW.copy=x.data;project();setErr('');}catch(err){setErr(err.message||'Could not refresh copy data.');}});
  $('copy-search').addEventListener('input',e=>{COPY_SEARCH=e.target.value;COPY_LIMIT=25;renderCopy();});
  $('copy-status').addEventListener('change',e=>{COPY_FILTER=e.target.value;COPY_LIMIT=25;renderCopy();});
  $('copy-more').addEventListener('click',()=>{COPY_LIMIT+=25;renderCopy();});
  $('copy-list').addEventListener('input',e=>{
    const field=e.target.closest('[data-copy-candidate]');if(!field)return;
    const id=field.dataset.copyCandidate,c=COPY.find(x=>x.id===id);if(!c)return;
    const existing=copyBuffer(c);COPY_BUFFERS[id]={text:field.value,base:existing?existing.base:copyVersion(c)};LS.set('copy-drafts',COPY_BUFFERS);
    const card=field.closest('[data-copy-entry]'),issue=copyValidation(c,field.value),conflict=COPY_BUFFERS[id].base!==copyVersion(c);
    card.querySelector('.copy-save-status').textContent='Draft kept on this device; not synced';
    card.querySelector('[data-copy-act="approve"]').disabled=!!c.orphan||conflict||!!issue;
    card.querySelector('.copy-validation').textContent=copyWarnings(c,field.value,conflict);
  });
  $('copy-list').addEventListener('click',async e=>{
    const b=e.target.closest('button[data-copy-act]');if(!b)return;
    const id=b.dataset.id,c=COPY.find(x=>x.id===id),card=b.closest('[data-copy-entry]');if(!c||!card)return;
    const candidate=card.querySelector('[data-copy-candidate]').value,buffer=copyBuffer(c),expected=buffer?buffer.base:copyVersion(c);b.disabled=true;
    try{
      if(b.dataset.copyAct==='reload'){delete COPY_BUFFERS[id];LS.set('copy-drafts',COPY_BUFFERS);renderCopy();return;}
      if(b.dataset.copyAct==='draft'||b.dataset.copyAct==='rebase')await saveCopyEntry(id,{candidate_text:candidate,status:'draft',approved_at:null},b.dataset.copyAct==='rebase'?copyVersion(c):expected);
      else if(b.dataset.copyAct==='approve')await saveCopyEntry(id,{candidate_text:candidate,status:'approved',approved_at:nowISO()},expected);
      else if(b.dataset.copyAct==='revert'){
        if(buffer&&candidate!==copyCandidate(c)&&!confirm('Discard the device draft and restore the previous saved candidate?'))return;
        const history=(c.history||[]).slice(),previous=history.pop();if(!previous)return;
        await saveCopyEntry(id,{candidate_text:previous.candidate_text,status:'draft',approved_at:null,history},copyVersion(c),true);
      }setErr('');
    }catch(err){setErr(err.message||'Could not save this row.');}finally{b.disabled=false;}
  });
}
