importScripts('./ocr-assets.js');
const CACHE='receipt-pocket-app-v2-1';
const ASSETS=['./','./index.html','./style.css','./app.js','./receipt-parser.js','./ocr-assets.js','./ocr.js','./vendor/tesseract.min.js','./vendor/worker.min.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k==='receipt-pocket-v1'||(k.startsWith('receipt-pocket-app-')&&k!==CACHE)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(ReceiptOCRAssets.urls.includes(url.href)){
  event.respondWith(caches.open(ReceiptOCRAssets.cache).then(async cache=>{const hit=await cache.match(event.request.url);if(hit)return hit;const response=await fetch(event.request);if(response.ok){try{await cache.put(event.request.url,response.clone());}catch{}}return response;}));return;
 }
 if(url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  return (await cache.match(event.request)) || (event.request.mode === 'navigate' ? fetch(event.request).catch(() => cache.match('./index.html')) : fetch(event.request));
 }));
});

