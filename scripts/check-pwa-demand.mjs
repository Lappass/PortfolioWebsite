// Real worker checks: small installation, lazy caching, integrity and updates.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
const root=resolve('dist'), metadata=JSON.parse(await readFile(resolve(root,'pwa-build.json'),'utf8'));
const font=metadata.onDemandFiles.find(path=>path.endsWith('.woff2'));
let revision=1, broken=false, corrupt=false;
const requests=[];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ogg':'audio/ogg'};
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname;requests.push(path);
 if(path==='/cache-test.html'){res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><title>Cache test</title>');return;}
 if(broken&&path==='/icons/icon-192.png'){res.writeHead(503).end();return;}
 const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+sep))throw Error('path');
 let body=await readFile(file);
 if(path==='/sw.js'&&revision>1)body=Buffer.from(body.toString().replace(metadata.version,metadata.version+'-test-'+revision));
 if(corrupt&&path==='/audio/pulse.ogg')body=Buffer.from('different release');
 res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'}).end(body);
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(5193,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext(),page=await context.newPage();
const wait=async predicate=>{for(let i=0;i<300;i++){if(await page.evaluate(predicate))return;await new Promise(r=>setTimeout(r,100));}throw Error('Worker state timed out');};
try {
 assert.equal(metadata.files.length,10);assert.ok(!metadata.files.some(f=>/^(fonts|audio)\//.test(f)));
 await page.goto('http://127.0.0.1:5193/cache-test.html');
 // Seed an old full cache: unchanged font migrates without an HTTP request;
 // modified stable-name music must not be copied into the current release.
 await page.evaluate(async font=>{
   const cache=await caches.open('rhine-lab:/:legacy');
   await cache.put('/'+font,await fetch('/'+font));
   await cache.put('/audio/pulse.ogg',new Response('obsolete audio'));
   await caches.open('unrelated-app');localStorage.setItem('rhine-saved','["X-001"]');
 },font);
 requests.length=0;
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 assert.ok(!requests.some(p=>p.startsWith('/fonts/')||p.startsWith('/audio/')));
 const keys=await page.evaluate(async()=>{const name=(await caches.keys()).find(k=>k.startsWith('rhine-lab:'));return (await(await caches.open(name)).keys()).map(r=>new URL(r.url).pathname);});
 assert.equal(keys.length,11);assert.ok(keys.includes('/'+font));assert.ok(!keys.includes('/audio/pulse.ogg'));
 const fetchSize=path=>page.evaluate(async path=>(await(await fetch(path)).arrayBuffer()).byteLength,path);
 assert.ok(await fetchSize('/audio/motif.ogg')>100000);
 const before=requests.length;assert.ok(await fetchSize('/audio/motif.ogg')>100000);assert.equal(requests.length,before);
 corrupt=true;
 assert.equal(await page.evaluate(async()=>{try{await fetch('/audio/pulse.ogg');return false;}catch{return true;}}),true);
 corrupt=false;
 await context.setOffline(true);
 assert.ok(await fetchSize('/audio/motif.ogg')>100000);assert.ok(await fetchSize('/'+font)>100);
 assert.ok(await fetchSize('/index.html')>100); // Cached core navigation response.
 assert.equal(await page.evaluate(async()=>{try{await fetch('/audio/atmosphere.ogg');return false;}catch{return true;}}),true);
 await context.setOffline(false);revision=2;
 await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
 await wait(async()=>{const r=await navigator.serviceWorker.getRegistration();window.testWaiting=r.waiting;return Boolean(window.testWaiting);});
 const start=requests.length;
 await page.evaluate(async()=>{window.testChanged=false;navigator.serviceWorker.addEventListener('controllerchange',()=>window.testChanged=true,{once:true});window.testWaiting.postMessage({type:'RHINE_APPLY_UPDATE'});});
 await wait(async()=>{const keys=await caches.keys();return keys.some(k=>k.endsWith('-test-2'))&&!keys.some(k=>k.endsWith(':legacy'));});
 await wait(()=>window.testChanged);
 await wait(async()=>{const r=await navigator.serviceWorker.getRegistration();return r.active?.state==='activated'&&(await caches.keys()).filter(k=>k.startsWith('rhine-lab:')).length===1;});
 assert.ok(await fetchSize('/audio/motif.ogg')>100000);assert.ok(!requests.slice(start).includes('/audio/motif.ogg'));
 revision=3;broken=true;
 await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
 await wait(async()=>{const r=await navigator.serviceWorker.getRegistration();return !r.installing&&!r.waiting;});
 const finalKeys=await page.evaluate(()=>caches.keys());assert.ok(finalKeys.includes('unrelated-app'));assert.equal(finalKeys.filter(k=>k.startsWith('rhine-lab:')).length,1);assert.ok(finalKeys.some(k=>k.endsWith('-test-2')));
 await context.setOffline(true);assert.ok(await fetchSize('/index.html')>100);assert.ok(await fetchSize('/audio/motif.ogg')>100000);
 assert.equal(await page.evaluate(()=>localStorage.getItem('rhine-saved')),'["X-001"]');
 broken=false;revision=1;requests.length=0;
 const visitor=await browser.newContext({viewport:{width:1600,height:900}});
 await visitor.addInitScript(()=>localStorage.setItem('rhine-settings',JSON.stringify({sound:false,music:false,reduced:true})));
 const app=await visitor.newPage(),appErrors=[];app.on('pageerror',e=>appErrors.push(e.message));
 await app.goto('http://127.0.0.1:5193/?scene=archive');
 await app.waitForFunction(()=>window.rhine?.stats().ready&&navigator.serviceWorker.controller);
 for(let i=0;i<300;i++) {
   if(await app.evaluate(async()=>{const name=(await caches.keys()).find(k=>k.startsWith('rhine-lab:'));return Boolean(await(await caches.open(name)).match('/assets/game-case.glb'));}))break;
   await new Promise(r=>setTimeout(r,100));
 }
 const fontRequests=requests.filter(p=>p.startsWith('/fonts/')).length,initialRequests=requests.length;
 assert.ok(fontRequests<100,`Unexpected font requests: ${fontRequests}`);
 await visitor.setOffline(true);await app.reload();await app.waitForFunction(()=>window.rhine?.stats().ready,null,{timeout:30000});
 assert.deepEqual(appErrors,[]);await visitor.close();
 console.log(JSON.stringify({precacheFiles:metadata.files.length,precacheBytes:metadata.bytes,initialRequests,fontRequests,checks:['no font/audio install requests','verified legacy cache migration','lazy cache and repeat hit','reject mismatched resource','offline core and used resources','unvisited resources require network','explicit update and lazy cache reuse','failed update preserves previous cache and bookmarks','real portfolio first load and offline reload']},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
