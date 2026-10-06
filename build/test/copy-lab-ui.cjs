// Runs the actual app against a local synthetic API. No sign-in, vault or live data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.join(__dirname,'../..'),out=path.join(root,'../qa/copy-lab');fs.mkdirSync(out,{recursive:true});
const allowed=new Set(['index.html','app.js','copy-lab.js','command-center.js','version.json','styles.css','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png']);
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if(!allowed.has(name)){res.writeHead(404);res.end();return;}
  const f=path.join(root,'docs',name);if(!fs.existsSync(f)){res.writeHead(404);res.end();return;}
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
  res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));
});
const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/\t/g,'\\t');
const header='id\tcurrent\treplacement\tverdict\tkind\tgroup\tcontext\tswappable\tsource\tblocked_reason\torphan\tfrozen\toperation\tencoding';
const source=header+'\n'+Array.from({length:31},(_,i)=>[
  `line/FIXTURE_${String(i).padStart(3,'0')}#0`,'Original <b>{name}</b>.','','','Line','Fixture group','Synthetic fixture trigger; never game copy.',i===30?'false':'true',
  'Assets/Fixture.asset | Assets/SyntheticCallsite.cs',i===30?'Hardcoded fixture: requires a source change.':'','false','false','','escaped-v2'
].map(esc).join('\t')).join('\n')+'\n';
const id='line/FIXTURE_000#0';let ledger=null,sha=1,failPut=false,delayPut=false,writes=0,metadataOnly=false,rawReads=0,heldRead=null;
const errors=[];let browser;
async function start(page,url){
  await page.goto(url);await page.waitForFunction(()=>typeof setupCopyLab==='function');
  await page.evaluate(async()=>{TOKEN='fixture-no-account';KEYS_KEY=null;await refresh();showGate();setView('copy');});
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/`;
  browser=await playwright.chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  await context.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(u.hostname==='127.0.0.1')return route.continue();
    if(u.hostname!=='api.github.com')return route.abort();
    const name=u.pathname.split('/').pop();
    if(req.method()==='PUT'){
      assert.equal(name,'copy.json','Only synthetic copy data may be written');writes++;
      if(failPut)return route.abort();
      if(delayPut)await new Promise(resolve=>setTimeout(resolve,350));
      const b=req.postDataJSON();if(ledger&&b.sha!==String(sha))return route.fulfill({status:409,body:'{}'});
      ledger=JSON.parse(Buffer.from(b.content,'base64'));sha++;return route.fulfill({status:200,body:'{}'});
    }
    if(name==='copy.json'&&!ledger)return route.fulfill({status:404,body:'{}'});
    if(name==='copy.json'&&heldRead){const wait=heldRead;heldRead=null;const snapshot=structuredClone(ledger),snapSha=sha;wait.started();await wait.promise;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sha:String(snapSha),content:Buffer.from(JSON.stringify(snapshot)).toString('base64')})});}
    if(name==='copy.json'&&metadataOnly){
      if((req.headers().accept||'').includes('.raw+json')){rawReads++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(ledger)});}
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sha:String(sha),content:'',encoding:'none'})});
    }
    const doc=name==='copy.json'?ledger:{};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sha:String(sha),content:Buffer.from(JSON.stringify(doc)).toString('base64')})});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await start(page,url);
  await page.locator('#copy-import').setInputFiles({name:'fixture.tsv',mimeType:'text/tab-separated-values',buffer:Buffer.from(source)});
  await page.waitForFunction(()=>COPY.length===31);assert.equal(await page.locator('.copy-entry').count(),25);
  await page.locator('#copy-more').click();assert.equal(await page.locator('.copy-entry').count(),31);
  await page.locator('#copy-search').fill('FIXTURE_000');assert.equal(await page.locator('.copy-entry').count(),1);
  const field=page.locator('[data-copy-candidate]').first(),draft=page.locator('[data-copy-act="draft"]').first(),approve=page.locator('[data-copy-act="approve"]').first();
  await field.fill('Candidate <b>{name}</b>.');assert.ok((await page.locator('.copy-save-status').innerText()).includes('not synced'));
  await draft.click();await page.waitForFunction(()=>COPY[0].status==='draft');assert.equal(ledger[id].candidate_text,'Candidate <b>{name}</b>.');
  await field.fill('Missing token');assert.equal(await approve.isDisabled(),true);
  await field.fill('Candidate <b>{name}</b>.');assert.equal(await approve.isDisabled(),false);await approve.click();await page.waitForFunction(()=>COPY[0].status==='approved');
  const download=page.waitForEvent('download');await page.locator('#copy-export').click();const d=await download,exported=fs.readFileSync(await d.path(),'utf8');
  assert.ok(exported.includes('Candidate <b>{name}</b>.\tReplace\treplace\tescaped-v2'));assert.equal(exported.trim().split('\n').length,2);
  await field.fill('Phone draft <b>{name}</b>.');ledger[id]={...ledger[id],candidate_text:'Remote draft <b>{name}</b>.',revision:'remote-v2'};sha++;
  await page.locator('#copy-refresh').click();await page.waitForFunction(()=>COPY[0].revision==='remote-v2');
  assert.equal(await field.inputValue(),'Phone draft <b>{name}</b>.');assert.equal(await approve.isDisabled(),true);assert.equal(await draft.isDisabled(),true);
  assert.ok((await page.locator('.copy-validation').innerText()).includes('older draft'));await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'mobile-conflict.png'),fullPage:true});
  await page.locator('[data-copy-act="rebase"]').click();await page.waitForFunction(()=>COPY[0].candidate_text.startsWith('Phone draft'));assert.equal(ledger[id].status,'draft');
  await field.fill('Submitted <b>{name}</b>.');delayPut=true;await draft.click();await field.fill('Still typing <b>{name}</b>.');
  await page.waitForFunction(()=>COPY[0].candidate_text.startsWith('Submitted'));delayPut=false;
  assert.equal(await field.inputValue(),'Still typing <b>{name}</b>.');assert.ok((await page.locator('.copy-save-status').innerText()).includes('not synced'));
  failPut=true;await draft.click();await page.waitForFunction(()=>!document.getElementById('err').hidden);assert.equal(await field.inputValue(),'Still typing <b>{name}</b>.');failPut=false;
  await start(page,url);await page.locator('#copy-search').fill('FIXTURE_000');assert.equal(await field.inputValue(),'Still typing <b>{name}</b>.');
  await draft.click();await page.waitForFunction(()=>COPY[0].candidate_text.startsWith('Still typing'));await approve.click();await page.waitForFunction(()=>COPY[0].status==='approved');
  metadataOnly=true;await page.locator('#copy-refresh').click();await page.waitForFunction(()=>COPY.length===31);await page.evaluate(()=>getFile('copy'));assert.ok(rawReads>0);metadataOnly=false;
  let release,started;const startedPromise=new Promise(resolve=>started=resolve);heldRead={started,promise:new Promise(resolve=>release=resolve)};
  const refreshing=page.evaluate(()=>refresh());await startedPromise;
  await field.fill('Newest save <b>{name}</b>.');await draft.click();await page.waitForFunction(()=>COPY[0].candidate_text.startsWith('Newest save'));release();await refreshing;
  assert.equal(await field.inputValue(),'Newest save <b>{name}</b>.');assert.equal(await page.evaluate(()=>COPY[0].status),'draft');
  let releaseOld,oldStarted;const oldStartedPromise=new Promise(resolve=>oldStarted=resolve);heldRead={started:oldStarted,promise:new Promise(resolve=>releaseOld=resolve)};
  await page.locator('#copy-refresh').click();await oldStartedPromise;ledger[id]={...ledger[id],candidate_text:'Latest remote <b>{name}</b>.',revision:'remote-final'};sha++;
  await page.locator('#copy-refresh').click();await page.waitForFunction(()=>COPY[0].revision==='remote-final');releaseOld();await page.waitForTimeout(100);assert.equal(await field.inputValue(),'Latest remote <b>{name}</b>.');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:900});await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);assert.ok(writes>0);console.log('Copy Lab UI passed: upload, paging, search, draft/approve, download, conflict, save-in-flight, offline/reload, large-file raw read, save-vs-refresh and out-of-order refresh, mobile/desktop overflow; no page errors.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
