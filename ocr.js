'use strict';
window.ReceiptOCR = (() => {
  const config = ReceiptOCRAssets;
  function aborted(signal) { if (signal.aborted) throw new DOMException('Reading cancelled', 'AbortError'); }
  async function cachedFetch(url, signal) {
    let cache;
    try { cache = await caches.open(config.cache); const hit = await cache.match(url); if(hit)return hit; } catch {}
    const response = await fetch(url, {mode:'cors',signal});
    if (!response.ok) throw new Error('Reader download failed');
    if(cache) { try { await cache.put(url,response.clone()); } catch {} }
    return response;
  }
  function abortable(promise, signal) {
    return new Promise((resolve,reject) => {
      const onAbort=()=>reject(new DOMException('Reading cancelled','AbortError'));
      if(signal.aborted){onAbort();return;}
      signal.addEventListener('abort',onAbort,{once:true});
      promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',onAbort));
    });
  }
  async function offlineReady() {
    if(!navigator.serviceWorker?.controller || !('caches' in window))return false;
    try { const cache=await caches.open(config.cache); return (await Promise.all(config.urls.map(u=>cache.match(u)))).every(Boolean); } catch {return false;}
  }
  async function recognize(image,{signal,onProgress}) {
    if(!window.Tesseract)throw new Error('Reader unavailable');
    let worker, active=true;
    try {
      // Download both LSTM variants so this cached reader also works after engine capability changes.
      const responses=[];
      for(let i=0;i<config.urls.length;i++){
        aborted(signal);onProgress(`Preparing receipt reader (${i+1}/${config.urls.length}). First use downloads language files…`);
        responses.push(await cachedFetch(config.urls[i],signal));
      }

      aborted(signal);
      let fail;
      const engineError = new Promise((_,reject)=>{fail=reject;});
      const starting=Tesseract.createWorker('eng+dan',1,{
        workerPath:new URL('./vendor/worker.min.js',location.href).href,
        workerBlobURL:false, corePath:config.core, langPath:config.languages, gzip:false, cacheMethod:'none',
        logger:m=>{if(active&&!signal.aborted)onProgress(m.status==='recognizing text'?`Reading receipt… ${Math.round(m.progress*100)}%`:'Starting receipt reader…');},
        errorHandler:err=>fail(new Error(String(err)))
      });
      starting.then(w=>{if(signal.aborted)w.terminate();},()=>{});
      worker=await abortable(Promise.race([starting,engineError]),signal);
      aborted(signal);
      const result=await abortable(Promise.race([worker.recognize(image,{rotateAuto:true},{text:true}),engineError]),signal);
      return {text:(result.data.text||'').slice(0,30000),confidence:result.data.confidence};
    } finally { active=false; if(worker)await worker.terminate(); }
  }
  return {recognize,offlineReady};
})();

