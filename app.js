'use strict';
const $=id=>document.getElementById(id);
let db,prepared=null,latest=null,records=[],urls=[],busy=false,compressing=false,scanning=false,scanController=null,selection=0,previewURL,rawText='',destination=null;
const edited=new Set();
const detailFields=['store','amount','currency','date'];
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const clean=s=>s.normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g,'').trim().replace(/\s+/g,'-').replace(/[^\p{L}\p{N}.,-]/gu,'').slice(0,60);
function filename(){return [$('date').value||'undated',$('category').value,clean($('store').value),ReceiptParser.money($('amount').value),$('currency').value].filter(Boolean).join('_')+'.jpg';}
function namePreview(){$('filename').textContent=filename();}
function status(s){$('status').textContent=s;}
function controls(){
 $('save').disabled=!db||!prepared||busy||compressing||scanning;
 $('camera').disabled=busy;$('library').disabled=busy;
 $('skipOCR').hidden=!scanning;$('retryOCR').hidden=!prepared||scanning;
}
for(const id of [...detailFields,'category'])$(id).addEventListener('input',()=>{edited.add(id);namePreview();});
$('today').onclick=()=>{$('date').value=today();edited.add('date');namePreview();};
namePreview();
function transaction(mode,action){return new Promise((resolve,reject)=>{const tx=db.transaction('receipts',mode);action(tx.objectStore('receipts'));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Storage transaction failed'));});}
async function reload(){records=await new Promise((resolve,reject)=>{const q=db.transaction('receipts').objectStore('receipts').getAll();q.onsuccess=()=>resolve(q.result.sort((a,b)=>b.created-a.created));q.onerror=()=>reject(q.error);});render();}
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);}
function showDestination(r,target){
 destination={receipt:r,target};
 $('destinationTitle').textContent=target==='files'?'Save to iPhone Files':'Save to Google Drive';
 $('destinationHelp').textContent=target==='files'?'In the Share sheet, choose Save to Files → On My iPhone → Receipts → Save. Create a folder called Receipts using the folder menu if it does not exist. You can also choose iCloud Drive.':'In the Share sheet, choose Drive (look under More if needed), select your Google account and folder, then tap Upload. You can create a Receipts folder in Drive first.';
 $('destinationFallback').textContent=target==='files'?'You choose the folder each time. If sharing is unavailable, download the JPEG and move it to Receipts in the Files app.':'If Drive is missing, install/open the Google Drive app and sign in. Alternatively, download the JPEG, open Drive, tap + → Upload, and select the file. An internet connection is needed for upload.';
 $('shareStatus').textContent='';$('openShare').disabled=false;
 $('destinationDialog').showModal();
}
$('openShare').onclick=async()=>{
 if(!destination)return;const {receipt:r,target}=destination;
 const file=new File([r.blob],r.filename,{type:'image/jpeg'});
 if(!navigator.share||!navigator.canShare?.({files:[file]})){$('shareStatus').textContent='This browser cannot share files. Use Download JPEG and the instructions above.';return;}
 $('openShare').disabled=true;
 try{
  await navigator.share({files:[file]});
  $('destinationDialog').close();status(`Share sheet closed. Check ${target==='files'?'your Receipts folder in Files':'Google Drive'} for the saved file. Your local copy is kept.`);
 }catch(e){$('shareStatus').textContent=e.name==='AbortError'?'Sharing cancelled. Your local copy is still saved.':'Could not open sharing. Try again or download the JPEG.';}
 finally{$('openShare').disabled=false;}
};
$('downloadCopy').onclick=()=>{if(destination){download(destination.receipt.blob,destination.receipt.filename);$('shareStatus').textContent='Download requested. Check browser downloads, then move or upload the JPEG.';}};
$('closeDestination').onclick=()=>$('destinationDialog').close();
function render(){
 urls.forEach(URL.revokeObjectURL);urls=[];const list=$('receipts');list.replaceChildren();$('count').textContent=`${records.length} RECEIPT${records.length===1?'':'S'}`;
 const term=$('search').value.toLowerCase();const filtered=records.filter(r=>`${r.store} ${r.category} ${r.date} ${r.amount} ${r.currency||''}`.toLowerCase().includes(term));
 if(!filtered.length){const p=document.createElement('p');p.className='empty';p.textContent=records.length?'No matching receipts.':'Your next receipt belongs here.';list.append(p);}
 for(const r of filtered){
  const row=document.createElement('article');row.className='receipt';const img=document.createElement('img');img.alt='Saved receipt';img.loading='lazy';const u=URL.createObjectURL(r.blob);urls.push(u);img.src=u;
  const detail=document.createElement('div'),title=document.createElement('strong'),meta=document.createElement('p');title.textContent=r.store||r.category;meta.textContent=`${r.date} · ${r.category}${r.amount?' · '+r.amount+(r.currency?' '+r.currency:''):''}`;detail.append(title,meta);
  for(const [label,fn] of [['iPhone Files',()=>showDestination(r,'files')],['Google Drive',()=>showDestination(r,'drive')],['Delete',async()=>{if(confirm('Delete this receipt from local history? External file copies are kept.')){try{await transaction('readwrite',s=>s.delete(r.id));if(latest?.id===r.id){latest=null;$('savedActions').hidden=true;}await reload();}catch(e){status('Could not delete: '+e.message);}}}]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;detail.append(b);}
  row.append(img,detail);list.append(row);
 }
}
$('search').oninput=render;
$('camera').onclick=()=>$('cameraInput').click();$('library').onclick=()=>$('libraryInput').click();
function cancelScan(message){scanController?.abort();scanController=null;scanning=false;if(message)$('ocrStatus').textContent=message;controls();}
function applySuggestions(text){
 const result=ReceiptParser.parse(text,$('dateOrder').value);
 for(const id of detailFields)if(!edited.has(id))$(id).value=result[id]||'';
 namePreview();
 const missing=detailFields.filter(id=>!$(id).value).map(id=>({store:'place',amount:'total',currency:'currency',date:'date'})[id]);
 $('ocrStatus').textContent=[text.trim()?'Details suggested — check them against the photo.':'No readable text found. Try better light or enter details manually.',missing.length?'Please fill in: '+missing.join(', ')+'.':'',...result.warnings].filter(Boolean).join(' ');
}
async function readReceipt(blob,token){
 cancelScan();const controller=new AbortController();scanController=controller;scanning=true;controls();
 const timer=setTimeout(()=>{if(scanController===controller)cancelScan('Reading took too long. Try again or enter the details manually.');},120000);
 try{
  const result=await ReceiptOCR.recognize(blob,{signal:controller.signal,onProgress:s=>{if(token===selection&&!controller.signal.aborted)$('ocrStatus').textContent=s;}});
  if(token!==selection||controller.signal.aborted)return;
  rawText=result.text;$('detectedText').textContent=rawText||'No text detected.';applySuggestions(rawText);
  if(result.confidence<65)$('ocrStatus').textContent+=' The image was difficult to read; review every field carefully.';
  if(await ReceiptOCR.offlineReady())$('readerOffline').textContent='Receipt reader downloaded for offline use on this device.';
 }catch(e){if(token===selection&&!controller.signal.aborted)$('ocrStatus').textContent='Could not read the receipt. On first use, connect to the internet and try again. You can always enter details manually.';}
 finally{clearTimeout(timer);if(scanController===controller){scanController=null;scanning=false;controls();}}
}
$('skipOCR').onclick=()=>cancelScan('Automatic reading stopped. Enter or check the details below.');
$('retryOCR').onclick=()=>{if(prepared)readReceipt(prepared,selection);};
$('dateOrder').onchange=()=>{if(rawText){edited.delete('date');applySuggestions(rawText);}};
async function prepare(file){
 if(!file)return;const token=++selection;cancelScan();prepared=null;compressing=true;rawText='';edited.clear();
 for(const id of detailFields)$(id).value='';
 $('detectedText').textContent='No receipt read yet.';$('savedActions').hidden=true;$('preview').hidden=true;$('placeholder').hidden=false;$('imageInfo').textContent='Preparing image…';status('');namePreview();controls();
 $('ocrStatus').textContent='Preparing your photo…';
 try{
  if(file.size>45*1024*1024)throw new Error('Please choose an image under 45 MB.');
  const source=await new Promise((resolve,reject)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(u);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('This image could not be opened. Try a JPEG or a new camera photo.'));};img.src=u;});
  if(token!==selection)return;
  const scale=Math.min(1,2400/Math.max(source.naturalWidth,source.naturalHeight));const c=document.createElement('canvas');c.width=Math.round(source.naturalWidth*scale);c.height=Math.round(source.naturalHeight*scale);
  const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(source,0,0,c.width,c.height);
  const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('Compression failed.')),'image/jpeg',.87));
  if(token!==selection)return;prepared=blob;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(blob);$('preview').src=previewURL;$('preview').hidden=false;$('placeholder').hidden=true;$('imageInfo').textContent=`${c.width} × ${c.height} · ${Math.round(blob.size/1024)} KB JPEG · check small print`;
  compressing=false;readReceipt(blob,token);
 }catch(e){if(token===selection){$('ocrStatus').textContent=e.message;$('imageInfo').textContent='Choose another photo to try again.';}}
 finally{if(token===selection){compressing=false;controls();}}
}
for(const id of ['cameraInput','libraryInput'])$(id).onchange=e=>{prepare(e.target.files[0]);e.target.value='';};
$('form').onsubmit=async e=>{
 e.preventDefault();if(!prepared||!db||busy||scanning)return;
 const rawAmount=$('amount').value.trim(),amount=rawAmount?ReceiptParser.money(rawAmount):'';
 if(rawAmount&&!amount){status('Use an amount such as 145, 145.50 or 145,50 without a currency symbol.');return;}
 if(amount&&!$('currency').value){status('Choose the currency for this amount.');$('currency').focus();return;}
 if(!$('date').value){status('Enter the receipt date.');return;}
 busy=true;controls();
 const r={id:crypto.randomUUID(),created:Date.now(),date:$('date').value,category:$('category').value,store:$('store').value.trim(),amount,currency:$('currency').value,filename:filename(),blob:prepared};
 try{await transaction('readwrite',s=>s.add(r));latest=r;prepared=null;$('savedActions').hidden=false;status('Saved on this device. Choose iPhone Files or Google Drive below.');try{await reload();}catch{status('Receipt saved. Reopen the app to refresh history.');}navigator.storage?.persist?.().catch(()=>{});}
 catch(e){status(e.name==='QuotaExceededError'?'Device storage is full. Export existing receipts and free some space, then retry.':'Could not save: '+e.message);}
 finally{busy=false;controls();}
};
$('saveFiles').onclick=()=>latest&&showDestination(latest,'files');$('saveDrive').onclick=()=>latest&&showDestination(latest,'drive');
function csvCell(v){let s=String(v??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
$('csv').onclick=()=>{const rows=[['Date','Category','Store','Amount','Currency','Filename'],...records.map(r=>[r.date,r.category,r.store,r.amount,r.currency||'',r.filename])];download(new Blob(['\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),`receipts-${today()}.csv`);};
(async()=>{try{db=await new Promise((resolve,reject)=>{const q=indexedDB.open('receipt-pocket',1);q.onupgradeneeded=()=>q.result.createObjectStore('receipts',{keyPath:'id'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);q.onblocked=()=>status('Close other app tabs to allow storage setup.');});await reload();controls();}catch{status('Local storage is unavailable. Enable site storage and reopen the app.');}})();
let registration;
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').then(async reg=>{registration=reg;await navigator.serviceWorker.ready;$('offline').textContent='Offline app files ready. Receipt reading has a separate first-use download.';if(await ReceiptOCR.offlineReady())$('readerOffline').textContent='Receipt reader downloaded for offline use on this device.';}).catch(()=>{$('offline').textContent='Offline setup failed. Reopen online to try again.';});}else $('offline').textContent='Offline access needs a supported browser and HTTPS.';
$('checkUpdate').onclick=async()=>{try{if(!registration)throw new Error('No worker');await registration.update();$('offline').textContent='Update check requested. Finish any draft, then close and reopen the app online to load the latest version.';}catch{$('offline').textContent='Could not check for updates. Try again while online.';}};
function connection(){$('connection').textContent=navigator.onLine?'On your device':'Offline';}connection();window.addEventListener('offline',connection);window.addEventListener('online',connection);

