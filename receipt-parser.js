/* Receipt text is untrusted; all suggestions remain editable. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReceiptParser=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function money(value){
 let s=String(value).trim().replace(/[\s\u00a0']/g,'').replace(/[,.]-$/,'.00');
 if(!/^-?\d[\d.,]*$/.test(s))return '';
 const last=Math.max(s.lastIndexOf(','),s.lastIndexOf('.'));
 if(last>=0){const tail=s.length-last-1;if(tail===1||tail===2)s=s.slice(0,last).replace(/[,.]/g,'')+'.'+s.slice(last+1);else if(tail===3&&/^-?\d{1,3}([.,]\d{3})+$/.test(s))s=s.replace(/[,.]/g,'');else return '';}
 const n=Number(s);return Number.isFinite(n)&&Math.abs(n)<100000000?n.toFixed(2):'';
}
function dateValue(y,m,d){y=Number(y);m=Number(m);d=Number(d);if(y<100)y+=2000;const v=new Date(Date.UTC(y,m-1,d));if(y<2000||y>2099||v.getUTCFullYear()!==y||v.getUTCMonth()!==m-1||v.getUTCDate()!==d)return '';return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
function extractDate(lines,order){
 for(const line of lines){
  if(/expiry|expires|valid until|best before|udl.b|holdbar/i.test(line))continue;
  let m=line.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if(m){const value=dateValue(m[1],m[2],m[3]);if(value)return {value,ambiguous:false};}
  m=line.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/);
  if(m){const md=order==='mdy';const value=dateValue(m[3],md?m[1]:m[2],md?m[2]:m[1]);if(value)return {value,ambiguous:Number(m[1])<=12&&Number(m[2])<=12&&m[1]!==m[2]};}
  const months='(jan(?:uary|uar)?|feb(?:ruary|ruar)?|mar(?:ch|ts)?|apr(?:il)?|may|maj|jun(?:e|i)?|jul(?:y|i)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  m=line.match(new RegExp('\\b(\\d{1,2})[ .-]+'+months+'[ ,.-]+(20\\d{2})\\b','i'));
  if(!m){const r=line.match(new RegExp('\\b'+months+'[ .-]+(\\d{1,2})[ ,.-]+(20\\d{2})\\b','i'));if(r)m=[r[0],r[2],r[1],r[3]];}
  if(m){const names=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];const name=m[2].toLowerCase().slice(0,3).replace('maj','may').replace('okt','oct');const value=dateValue(m[3],names.indexOf(name)+1,m[1]);if(value)return {value,ambiguous:false};}
 }
 return {value:'',ambiguous:false};
}
const numberPattern=/-?\d+(?:[ '\u00a0]\d{3})*(?:[.,]\d{3})*(?:[.,](?:\d{1,2}|-))?/g;
function lastAmount(line){const matches=[...line.matchAll(numberPattern)];if(!matches.length)return '';const m=matches.at(-1);if(/\d[:/-]$/.test(line.slice(0,m.index))||/[:/%]/.test(line.slice(m.index+m[0].length)))return '';return money(m[0]);}
function currency(text){
 const codes=[...new Set(text.toUpperCase().match(/\b(?:DKK|EUR|USD|GBP|SEK|NOK|CHF|CAD|AUD|PLN|JPY|ISK)\b/g)||[])];
 if(codes.length===1)return codes[0];if(codes.length>1)return '';
 if(/€/.test(text))return 'EUR';if(/£/.test(text))return 'GBP';if(/US\s*\$/i.test(text))return 'USD';if(/CA\s*\$|C\$/i.test(text))return 'CAD';if(/AU\s*\$|A\$/i.test(text))return 'AUD';return '';
}
function parse(text,order='dmy'){
 const lines=String(text).split(/\r?\n/).map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean),warnings=[],totals=[];
 lines.forEach((line,i)=>{
  if(/sub[ -]?total|moms|\bvat\b|tax|change|bytte|rabat|discount|cash|kontant|tender|savings|sparet/i.test(line))return;
  let score=0;if(/\b(grand total|amount due|total due|balance due|at betale|til betaling|i alt)\b/i.test(line))score=100;else if(/\b(total|summa|gesamt|summe|bel.b)\b/i.test(line))score=80;else if(/\b(visa|mastercard|dankort|card payment|paid)\b/i.test(line)&&/[.,]\d{2}\b/.test(line))score=30;
  if(!score)return;let amount=lastAmount(line),amountLine=line;
  if(!amount&&lines[i+1]&&/^[-\d\s.,€£$]+(?:\s*(?:DKK|EUR|USD|GBP|SEK|NOK|kr\.?))?$/i.test(lines[i+1])){amountLine+=' '+lines[i+1];amount=lastAmount(lines[i+1]);}
  if(amount)totals.push({amount,score,line:amountLine,index:i});
 });
 totals.sort((a,b)=>b.score-a.score||b.index-a.index);const total=totals[0];
 if(total&&total.score<80)warnings.push('Amount comes from the payment line; check it against the total.');
 if(total&&totals.some(t=>t.score===total.score&&t.amount!==total.amount))warnings.push('More than one total was found; check the suggested amount.');
 const curr=currency(total?.line||'')||currency(lines.join('\n'));
 if(!curr&&/\$|\bkr\.?\b/i.test(text))warnings.push('The currency symbol is ambiguous. Choose the currency.');
 const date=extractDate(lines,order);if(date.ambiguous)warnings.push(`Numeric date interpreted as ${order==='mdy'?'month/day/year':'day/month/year'}; please check it.`);
 const store=lines.slice(0,12).find(line=>{const letters=(line.match(/\p{L}/gu)||[]).length;return letters>=3&&line.length<=65&&letters>=line.length*.45&&!/receipt|kvittering|kassebon|welcome|velkommen|thank|tak for|customer|kunde|invoice|faktura|\bcvr\b|\bvat\b|\btel\b|phone|www\.|https:|@|\btotal\b|\bdato\b|\bdate\b|\btime\b|\bterminal\b|\btable\b|\bcashier\b|\bkopi\b|\bcopy\b/i.test(line)&&!/^\d|\d{1,2}[:/.]\d{1,2}/.test(line);})||'';
 return {store,amount:total?.amount||'',currency:curr,date:date.value,warnings};
}
return {parse,money,dateValue};
});

