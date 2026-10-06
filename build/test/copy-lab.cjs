// Synthetic fixtures only. No vault, key pool, or recipient data is opened.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({crypto:require('node:crypto').webcrypto,nowISO:()=> '2026-10-06T00:00:00Z',RAW:{},COPY:[],COPY_WRITE_REVISION:0,
  LS:{set(){}},project(){},pretty:JSON.stringify,strToB64:s=>Buffer.from(s).toString('base64'),
  ApiError:class extends Error{},explain:r=>`HTTP ${r.status}`});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../../docs/copy-lab.js'),'utf8'),ctx);
const call=(s,args={})=>{Object.assign(ctx,args);return vm.runInContext(s,ctx);};
const plain=v=>JSON.parse(JSON.stringify(v));
const row=(id='line/TEST#0',source='Hello {name}.')=>({id,source_text:source,candidate_text:source,kind:id.startsWith('line/')?'Line':'Copy',group:'Fixture',context:'Synthetic test only',swappable:true,source_ref:'fixture.asset',blocked_reason:'',source_orphan:false,frozen:false});
const record=(id='line/TEST#0')=>({...row(id),status:'draft',revision:'r1',updated_at:'2026-10-05T12:00:00Z',candidate_text:'Candidate {name}.',stale:false,orphan:false,history:[]});
function tsv(rows){
  const h=['id','current','replacement','verdict','kind','group','context','swappable','source','blocked_reason','orphan','frozen','operation','encoding'];
  return h.join('\t')+'\n'+rows.map(r=>[r.id,r.source_text,'','',r.kind,r.group,r.context,String(r.swappable),r.source_ref,r.blocked_reason,String(r.source_orphan),String(r.frozen),'','escaped-v2'].map(v=>call('copyTsvCell(v)',{v})).join('\t')).join('\n')+'\n';
}
function backend(initial,{conflict,fail}={}){
  let doc=structuredClone(initial),sha=1,puts=0;
  ctx.getFile=async()=>({sha:String(sha),data:structuredClone(doc)});
  ctx.gh=async(method,p,b)=>{
    assert.equal(method,'PUT');assert.equal(p,'data/copy.json');puts++;
    if(fail)throw new Error('offline');
    if(conflict&&puts===1){doc=conflict(doc);sha++;return {ok:false,status:409};}
    if(b.sha&&b.sha!==String(sha))return {ok:false,status:409};
    doc=JSON.parse(Buffer.from(b.content,'base64'));sha++;return {ok:true,status:200};
  };
  return {read:()=>doc,puts:()=>puts};
}
let count=0;const test=async(name,fn)=>{await fn();console.log(`ok ${++count} - ${name}`);};
(async()=>{
  await test('full TSV preserves literal escapes and whitespace',()=>{
    const r=row('copy/TEST','slash\\n newline\n tab\t return\r <b>{name}</b>');
    assert.deepEqual(plain(call('parseCopyTsv(input)',{input:tsv([r])})),[r]);
  });
  await test('duplicate IDs/headers and malformed rows are rejected',()=>{
    const t=tsv([row()]);
    for(const [input,re] of [[tsv([row(),row()]),/Duplicate stable/],[t.replace('current','id'),/Duplicate TSV header/],[t.replace('\tescaped-v2\n','\n'),/missing or extra/],[t.replace('\tLine\t','\tCopy\t'),/inconsistent/],[t.replace('escaped-v2','future'),/unsupported TSV encoding/]])assert.throws(()=>call('parseCopyTsv(input)',{input}),re);
  });
  await test('source reimport retains candidate, approval and history',()=>{
    const a={...record(),status:'approved',history:[{candidate_text:'Older {name}.'}]};
    const out=plain(call('mergeCopySource(doc,rows)',{doc:{[a.id]:a},rows:[row()]}))[a.id];
    assert.equal(out.candidate_text,a.candidate_text);assert.equal(out.status,'approved');assert.deepEqual(out.history,a.history);assert.equal(out.revision,a.revision);
  });
  await test('changed source stays stale through repeated imports',()=>{
    const a=record(),rows=[row(a.id,'New source {name}.')];
    const first=plain(call('mergeCopySource(doc,rows)',{doc:{[a.id]:a},rows}));
    const next=plain(call('mergeCopySource(doc,rows)',{doc:first,rows}));
    assert.equal(next[a.id].stale,true);assert.equal(next[a.id].candidate_text,a.candidate_text);assert.equal(next[a.id].revision,first[a.id].revision);
  });
  await test('fresh source matching approval verifies application',()=>{
    const a={...record(),status:'approved'},args={doc:{[a.id]:a},rows:[row(a.id,a.candidate_text)]};
    const out=call('mergeCopySource(doc,rows)',args)[a.id];assert.equal(out.status,'applied');assert.equal(out.stale,false);assert.ok(out.applied_at);
    args.doc[a.id].status='draft';assert.equal(call('mergeCopySource(doc,rows)',args)[a.id].status,'draft');
  });
  await test('removed stable IDs retain their wording as orphans',()=>{
    const a=record(),b=row('line/OTHER#0'),out=call('mergeCopySource(doc,rows)',{doc:{[a.id]:a},rows:[b]});
    assert.equal(out[a.id].orphan,true);assert.equal(out[a.id].candidate_text,a.candidate_text);assert.equal(out[b.id].status,'unreviewed');
  });
  await test('placeholder reordering allowed; missing/duplicate tokens and changed markup blocked',()=>{
    const rec=row('line/TEST#0','<b>{a} then {b}</b>');assert.equal(call('copyValidation(rec,text)',{rec,text:'<b>{b} then {a}</b>'}),'');
    for(const text of ['<b>{a}</b>','<b>{a}{a}{b}</b>','<i>{a}{b}</i>'])assert.ok(call('copyValidation(rec,text)',{rec,text}));
  });
  await test('approved export excludes unsafe states and explicitly supports empty replacements',()=>{
    const a={...record(),source_text:'Clear me',candidate_text:'',status:'approved'};
    const rows=[a,{...record('line/STALE#0'),status:'approved',stale:true},{...record('line/BLOCKED#0'),status:'approved',swappable:false},{...record('line/ORPHAN#0'),status:'approved',orphan:true},record('line/DRAFT#0')];
    const out=call('buildApprovedCopyTsv(rows)',{rows});assert.equal(out.count,1);assert.equal(out.blocked,1);assert.ok(out.text.includes('Clear me\t\tReplace\treplace\tescaped-v2'));
  });
  await test('unrelated concurrent save is retained across SHA retry',async()=>{
    const a=record(),b=record('line/OTHER#0'),s=backend({[a.id]:a,[b.id]:b},{conflict:d=>({...d,[b.id]:{...b,candidate_text:'Other edit {name}.',revision:'r2'}})});
    await call('saveCopyEntry(id,patch,"r1")',{id:a.id,patch:{candidate_text:'New candidate {name}.',status:'approved'}});
    assert.equal(s.puts(),2);assert.equal(s.read()[b.id].candidate_text,'Other edit {name}.');assert.equal(s.read()[a.id].history[0].candidate_text,a.candidate_text);
  });
  await test('same-row conflict retains local and remote wording',async()=>{
    const a=record(),s=backend({[a.id]:a},{conflict:d=>({...d,[a.id]:{...a,candidate_text:'Remote {name}.',revision:'r2'}})});
    call('COPY_BUFFERS[id]={text:"Device {name}.",base:"r1"}',{id:a.id});
    await assert.rejects(call('saveCopyEntry(id,patch,"r1")',{id:a.id,patch:{candidate_text:'Device {name}.',status:'draft'}}),/Another device/);
    assert.equal(s.read()[a.id].candidate_text,'Remote {name}.');assert.equal(call('COPY_BUFFERS[id].text',{id:a.id}),'Device {name}.');
    call('COPY=Object.values(doc)',{doc:s.read()});assert.equal(call('copyBuffer(COPY[0]).base'),'r1');
  });
  await test('offline saves retain the device draft',async()=>{
    const a=record();backend({[a.id]:a},{fail:true});call('COPY_BUFFERS[id]={text:"Device {name}.",base:"r1"}',{id:a.id});
    await assert.rejects(call('saveCopyEntry(id,patch,"r1")',{id:a.id,patch:{candidate_text:'Device {name}.',status:'draft'}}),/offline/);
    assert.equal(call('COPY_BUFFERS[id].text',{id:a.id}),'Device {name}.');
  });
  await test('invalid approval produces no write',async()=>{
    const a=record(),s=backend({[a.id]:a});await assert.rejects(call('saveCopyEntry(id,patch,"r1")',{id:a.id,patch:{candidate_text:'Missing token',status:'approved'}}),/Preserve/);assert.equal(s.puts(),0);
  });
  await test('import retry preserves concurrently saved wording',async()=>{
    const a=record(),s=backend({[a.id]:a},{conflict:d=>({...d,[a.id]:{...a,candidate_text:'Concurrent {name}.',revision:'r2'}})});
    await call('importCopyTsv(rows)',{rows:[row()]});assert.equal(s.puts(),2);assert.equal(s.read()[a.id].candidate_text,'Concurrent {name}.');
  });
  await test('revert pops only the most recent history item',async()=>{
    const a={...record(),history:[{candidate_text:'First {name}.'},{candidate_text:'Second {name}.'}]},s=backend({[a.id]:a});
    await call('saveCopyEntry(id,patch,"r1",true)',{id:a.id,patch:{candidate_text:'Second {name}.',status:'draft',history:[a.history[0]]}});assert.equal(s.read()[a.id].candidate_text,'Second {name}.');assert.equal(s.read()[a.id].history.length,1);
  });
  await test('typing during a save retains the newer device draft against the saved revision',async()=>{
    const a=record(),s=backend({[a.id]:a}),put=ctx.gh;
    call('COPY_BUFFERS[id]={text:"Submitted {name}.",base:"r1"}',{id:a.id});
    ctx.gh=async(...args)=>{call('COPY_BUFFERS[id]={text:"Still typing {name}.",base:"r1"}',{id:a.id});return put(...args);};
    await call('saveCopyEntry(id,patch,"r1")',{id:a.id,patch:{candidate_text:'Submitted {name}.',status:'draft'}});
    assert.equal(s.read()[a.id].candidate_text,'Submitted {name}.');assert.equal(call('COPY_BUFFERS[id].text',{id:a.id}),'Still typing {name}.');assert.equal(call('COPY_BUFFERS[id].base',{id:a.id}),s.read()[a.id].revision);
  });
  console.log(`Copy Lab: ${count} synthetic invariant checks passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
