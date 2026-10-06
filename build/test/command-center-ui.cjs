// Local Chrome fixtures only. No sign-in, vault access or live writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.join(__dirname,'../..'),out=path.join(root,'../qa/command-center');fs.mkdirSync(out,{recursive:true});
const assetRoot=process.env.ASSET_ROOT||path.join(root,'docs');
const baseline=process.env.BASELINE_PATH||path.join(root,'../qa/live-entry');
const allowed=new Set(['index.html','app.js','copy-lab.js','command-center.js','version.json','styles.css','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png']);
let version='2026.10.06.1',versionFails=false,writes=0,checks=0;const errors=[];
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost'),before=u.pathname.startsWith('/before/');
  const name=(before?u.pathname.slice(8):u.pathname.slice(1))||'index.html';
  if(!allowed.has(name)){res.writeHead(404);res.end();return;}
  if(name==='version.json'){checks++;res.setHeader('Content-Type','application/json');res.writeHead(versionFails?503:200);res.end(JSON.stringify({version}));return;}
  const f=path.join(before?baseline:assetRoot,name);
  if(!fs.existsSync(f)){res.writeHead(404);res.end();return;}
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json'};
  res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));
});
const task={fixture:{title:'Fixture marketing task',who:'james',status:'open',focus:true,priority:1,area:'social',steps:'Synthetic fixture only.'}};
const draft={'line/FIXTURE#0':{text:'Phone fixture draft',base:'r1'}},queue=[{file:'tasks',id:'fixture',patch:{note:'Fixture pending tap'},message:'Synthetic fixture'}];
let browser;
async function open(page,url){
  await page.goto(url);await page.waitForFunction(()=>typeof setView==='function');
  await page.evaluate(async()=>{TOKEN='fixture-no-account';KEYS_KEY=null;await refresh();showGate();});
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/`;
  browser=await playwright.chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());if(u.hostname==='127.0.0.1')return route.continue();
    if(u.hostname!=='api.github.com')return route.abort();
    if(req.method()!=='GET'){writes++;return route.abort();}
    const name=u.pathname.split('/').pop(),doc=name==='tasks.json'?task:{};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sha:'fixture-sha',content:Buffer.from(JSON.stringify(doc)).toString('base64')})});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  if(fs.existsSync(path.join(baseline,'index.html'))){
    await open(page,url+'before/');assert.equal(await page.locator('#today').isVisible(),true);assert.equal(await page.locator('header h1').innerText(),'Marketing desk');
    assert.equal(await page.locator('[data-view="copy"]').count(),1);assert.equal(await page.locator('[data-panel="home"]').count(),0);
    assert.equal(await page.evaluate(async()=>('serviceWorker' in navigator?(await navigator.serviceWorker.getRegistrations()).length:0)),0);
    await page.screenshot({path:path.join(out,'before-root.png'),fullPage:true});
    console.log('Reproduced deployed root: Marketing desk / Do now; Copy Lab is a tab; no hub or registered worker in this test context.');
  }
  await open(page,url);assert.equal(await page.locator('#home').isVisible(),true);assert.equal(await page.locator('#today').isVisible(),false);
  assert.equal(await page.locator('.app-card').count(),2);assert.equal(await page.locator('.app-nav a[aria-current="page"]').innerText(),'Home');
  assert.ok((await page.locator('#app-version').innerText()).includes('2026.10.06.1'));
  await page.screenshot({path:path.join(out,'hub-mobile.png'),fullPage:true});
  await page.locator('.app-card[href="#today"]').click();await page.waitForFunction(()=>!document.getElementById('today').hidden);
  assert.equal(await page.locator('[aria-label="Marketing views"]').isVisible(),true);assert.equal(await page.locator('.task').filter({hasText:'Fixture marketing task'}).count(),1);
  for(const name of ['numbers','creators','more','today']){await page.locator(`[data-view="${name}"]`).click();assert.equal(await page.locator(`[data-panel="${name}"]`).isVisible(),true);}
  await page.locator('.app-nav [data-app="copy"]').click();await page.waitForFunction(()=>!document.getElementById('copy').hidden);
  assert.equal(await page.locator('[aria-label="Marketing views"]').isVisible(),false);assert.equal(await page.locator('.app-nav [data-app="copy"]').getAttribute('aria-current'),'page');
  await page.locator('.app-nav [data-app="home"]').click();await page.waitForFunction(()=>!document.getElementById('home').hidden);
  await page.goBack();await page.waitForFunction(()=>!document.getElementById('copy').hidden);
  await open(page,url+'#creators');assert.equal(await page.locator('#creators').isVisible(),true);assert.equal(await page.locator('.app-nav [data-app="marketing"]').getAttribute('aria-current'),'page');
  await open(page,url+'#marketing');assert.equal(await page.locator('#today').isVisible(),true);
  const manifest=JSON.parse(fs.readFileSync(path.join(assetRoot,'manifest.webmanifest'),'utf8'));
  assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.name,'Bad Shrooms Command Center');
  await open(page,new URL(manifest.start_url,url).href);assert.equal(await page.locator('#home').isVisible(),true);
  await page.evaluate(({draft,queue})=>{localStorage.setItem('bsd.copy-drafts',JSON.stringify(draft));localStorage.setItem('bsd.queue',JSON.stringify(queue));localStorage.setItem('bsd.key',btoa(String.fromCharCode(...new Uint8Array(32))));},{draft,queue});
  await page.locator('#app-updates summary').click();
  await page.locator('#check-update').click();await page.waitForFunction(()=>document.getElementById('update-status').textContent.includes('current version'));
  version='2026.10.06.2';await page.locator('#check-update').click();await page.waitForFunction(()=>document.getElementById('reload-app').textContent==='Reload update');
  assert.ok((await page.locator('#update-status').innerText()).includes(version));versionFails=true;
  await page.locator('#check-update').click();await page.waitForFunction(()=>document.getElementById('update-status').textContent.includes('Could not check'));versionFails=false;
  await page.evaluate(()=>{ACTIVE_WRITES=1;});const previous=page.url();await page.locator('#reload-app').click();assert.equal(page.url(),previous);assert.ok((await page.locator('#update-status').innerText()).includes('save is still running'));await page.evaluate(()=>{ACTIVE_WRITES=0;});
  await page.locator('.app-nav [data-app="copy"]').click();await page.waitForFunction(()=>location.hash==='#copy');
  await Promise.all([page.waitForURL(u=>u.searchParams.get('release')==='2026.10.06.2'),page.locator('#reload-app').click()]);
  assert.equal(new URL(page.url()).pathname,'/');assert.equal(new URL(page.url()).hash,'#copy');assert.ok(new URL(page.url()).searchParams.get('_reload'));
  const kept=await page.evaluate(()=>({draft:JSON.parse(localStorage.getItem('bsd.copy-drafts')),queue:JSON.parse(localStorage.getItem('bsd.queue')),key:localStorage.getItem('bsd.key')}));
  assert.deepEqual(kept.draft,draft);assert.deepEqual(kept.queue,queue);assert.ok(kept.key);
  // Remove the synthetic queued fixture after verifying it survived the reload. Opening
  // the real desk normally retries queued taps; navigation itself has created none.
  await page.evaluate(()=>{localStorage.removeItem('bsd.queue');QUEUE=[];});
  await open(page,url);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(out,'hub-mobile.png'),fullPage:true});await page.setViewportSize({width:1280,height:900});await page.screenshot({path:path.join(out,'hub-desktop.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);assert.equal(writes,0);assert.ok(checks>=3);
  console.log('Command Center UI passed: root/shortcut hub, two apps, Marketing views, legacy links, browser Back, update current/new/offline, busy-save guard, same-path reload retaining drafts/queue/device key, mobile/desktop overflow; zero data writes.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
