import {products} from './catalogo-admin.js';
import {normalize, validRate, amount, money} from './radi-precios.js?v=radi-monedas-20261104-v1';

const config=window.RADI_CONFIG;
const picker=document.getElementById('radi-currency');
const note=document.getElementById('radi-currency-note');
const notice=document.getElementById('radi-promo-notice');
let rate=null,currency='COP',overrides=new Map(),promotions=[],busy=false;
const formatValue=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency,minimumFractionDigits:currency==='USD'?2:0,maximumFractionDigits:currency==='USD'?2:0}).format(n);
const priceOf=product=>overrides.get(normalize(product.name))??product.price;
const partsByIndex={13:[0,5],14:[0,6],15:[0,7,9,5],16:[0,3],17:[0,7],18:[0,7,9],19:[0,7,9,6],20:[0,9]};
const cards=Array.from(document.querySelectorAll('.product-card')).map(card=>{
 const name=card.querySelector('h3')?.textContent.trim(),index=products.findIndex(p=>p.name===name);
 return {card,name,index,price:card.querySelector('.published-price strong'),buy:card.querySelector('a.buy'),info:card.querySelector('.product-info'),nodes:null};
}).filter(item=>item.index>=0&&item.price&&item.buy&&item.info);
try{if(localStorage.getItem('radi-currency')==='USD')currency='USD';}catch(_){}
function validOffer(row){return row&&row.active&&typeof row.name==='string'&&typeof row.product_name==='string'&&Number.isInteger(row.price)&&row.price>0&&Date.parse(row.ends_at)>Date.now();}
function clearOffer(item){if(!item.nodes)return;for(const node of Object.values(item.nodes))node.remove();item.card.classList.remove('radi-offer');item.nodes=null;}
function addOffer(item){
 if(item.nodes)return;
 const badge=document.createElement('span');badge.className='radi-offer-label';badge.textContent='PROMOCIÓN';
 const was=document.createElement('div');was.className='radi-offer-was';const del=document.createElement('del'),percent=document.createElement('span');percent.className='radi-discount-percent';was.append(del,percent);
 const timer=document.createElement('div');timer.className='radi-card-timer';timer.innerHTML='<small>Tiempo restante</small><b role="timer" aria-label="Tiempo restante de la promoción"></b><small class="radi-stock">O hasta agotar existencias</small>';
 item.info.prepend(badge);item.price.parentNode.before(was);was.before(timer);item.card.classList.add('radi-offer');item.nodes={badge,was,timer};
}
function render(){
 const selectedCurrency=currency==='USD'&&validRate(rate)?'USD':'COP';
 const savedCurrency=currency;currency=selectedCurrency;
 if(picker){picker.value=currency;picker.querySelector('option[value="USD"]').disabled=!validRate(rate);}
 if(note){note.hidden=currency!=='USD';note.textContent='1 USD = '+new Intl.NumberFormat('es-CO',{maximumFractionDigits:4}).format(rate||0)+' COP'+' · Redondeo al siguiente US$0,50';}
 const offers=new Map();
 for(const row of promotions){if(!validOffer(row))continue;const key=normalize(row.product_name),old=offers.get(key);if(!old||row.price<old.price)offers.set(key,row);}
 let active=0;
 for(const item of cards){
  const normal=priceOf(products[item.index]);let offer=offers.get(normalize(item.name));if(offer&&offer.price>=normal)offer=null;
  const current=offer?offer.price:normal;item.price.textContent=money(current,currency,rate);
  const unit=Array.from(item.price.parentNode.children).find(n=>n.tagName==='SPAN'&&!n.className);if(unit)unit.textContent=currency;
  if(offer){
   active++;addOffer(item);
   const {was,timer}=item.nodes;was.querySelector('del').textContent=money(normal,currency,rate);
   const normalAmount=amount(normal,currency,rate),saleAmount=amount(current,currency,rate);const discount=Math.round((normalAmount-saleAmount)/normalAmount*100);
   const percent=was.querySelector('.radi-discount-percent');percent.textContent='−'+discount+'%';percent.hidden=discount<=0;percent.setAttribute('aria-label',discount+'% de descuento');was.hidden=normalAmount<=saleAmount;
   const seconds=Math.max(0,Math.floor((Date.parse(offer.ends_at)-Date.now())/1000)),days=Math.floor(seconds/86400);
   timer.querySelector('b').textContent=(days?days+' días · ':'')+[Math.floor(seconds%86400/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
  }else clearOffer(item);
  const prefix=offer?'Hola, quiero la promoción '+offer.name+' ('+item.name+')':'Hola, quiero consultar disponibilidad de '+item.name;
  item.buy.href='https://wa.me/573127220795?text='+encodeURIComponent(prefix+' por '+money(current,currency,rate)+' '+currency+'. ¿Está disponible?');
  const savings=item.card.querySelector('.combo-savings');
  if(savings&&partsByIndex[item.index]){
   const separate=partsByIndex[item.index].reduce((sum,i)=>sum+amount(priceOf(products[i]),currency,rate),0),saving=separate-amount(current,currency,rate);
   const del=savings.querySelector('del'),badge=savings.querySelector('.saving-badge');if(del)del.textContent=formatValue(separate);if(badge)badge.textContent='Ahorras '+formatValue(saving);savings.hidden=saving<=0;
  }
 }
 if(notice)notice.hidden=!active;
 // Mantiene la preferencia de USD hasta que la tasa termine de cargar.
 if(savedCurrency==='USD'&&!validRate(rate))currency='USD';
}
async function readTable(table,select){
 const r=await fetch(config.supabaseUrl.replace(/\/$/,'')+'/rest/v1/'+table+'?select='+select,{headers:{apikey:config.publishableKey},cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error(table);const rows=await r.json();if(!Array.isArray(rows))throw Error('invalid');return rows;
}
async function refresh(){
 if(busy||document.hidden||!config||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl)||!config.publishableKey)return;busy=true;
 try{
  const results=await Promise.allSettled([readTable('radi_store_settings','id,cop_per_usd'),readTable('radi_catalog_prices','product_name,price_cop'),readTable('radi_promotion','id,name,product_name,price,ends_at,active')]);
  if(results[0].status==='fulfilled'){const value=Number(results[0].value.find(r=>r.id===1)?.cop_per_usd);rate=validRate(value)?value:null;}
  if(results[1].status==='fulfilled')overrides=new Map(results[1].value.filter(r=>typeof r.product_name==='string'&&Number.isInteger(r.price_cop)&&r.price_cop>0&&r.price_cop<=100000000).map(r=>[normalize(r.product_name),r.price_cop]));
  if(results[2].status==='fulfilled')promotions=results[2].value;
  render();
 }finally{busy=false;}
}
if(picker)picker.addEventListener('change',()=>{currency=picker.value==='USD'&&validRate(rate)?'USD':'COP';try{localStorage.setItem('radi-currency',currency);}catch(_){}render();});
render();refresh();setInterval(refresh,60000);setInterval(render,1000);document.addEventListener('visibilitychange',refresh);
