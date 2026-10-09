import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const root=resolve('dist');
const all=await readdir(root,{recursive:true});
const files=all.map(path=>path.replaceAll('\\','/')).filter(path=>
  path==='index.html'||path==='manifest.webmanifest'||path==='favicon.svg'||
  /^(assets|icons|archives|licenses)\/[^/]+\.[^/]+$/.test(path)||
  /^fonts\/.*\.(woff2|pdf|txt|json|md)$/.test(path)||
  /^audio\/(atmosphere|motif|pulse)\.ogg$/.test(path)
).filter(path=>!/^assets\/archive-(cassette|assembly)\.glb$/.test(path)).sort();
if(!files.some(path=>/^assets\/index-.*\.js$/.test(path)))throw Error('Build the application before generating the offline cache.');
const worker=await readFile('scripts/pwa-worker.js','utf8');
const core=files.filter(path=>path==='index.html'||path==='manifest.webmanifest'||path==='favicon.svg'||path.startsWith('icons/')||/^assets\/index-.*\.(js|css)$/.test(path));
const resourceHashes={};
const hash=createHash('sha256').update(worker);let bytes=0,coreBytes=0;
for(const file of files){const content=await readFile(resolve(root,file));hash.update(file).update(content);bytes+=content.length;if(core.includes(file))coreBytes+=content.length;resourceHashes[file]=createHash('sha256').update(content).digest('hex')}
const version=hash.digest('hex').slice(0,16);
await writeFile(resolve(root,'sw.js'),worker.replace('__CACHE_VERSION__',JSON.stringify(version)).replace('__PRECACHE_FILES__',JSON.stringify(core)).replace('__RESOURCE_HASHES__',JSON.stringify(resourceHashes)));
await writeFile(resolve(root,'pwa-build.json'),JSON.stringify({version,bytes:coreBytes,files:core,onDemandFiles:files.filter(path=>!core.includes(path)),totalBytes:bytes},null,2));
console.log(`Offline core ${version}: ${core.length} files, ${(coreBytes/1024/1024).toFixed(1)} MiB; ${files.length-core.length} resources cached on demand.`);
