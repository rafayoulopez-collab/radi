(() => {
  const config = window.RADI_CONFIG;
  const notice = document.getElementById('radi-promo-notice');
  if (!notice || !config || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl) || !config.publishableKey) return;
  const money = n => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n);
  const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  const cards = Array.from(document.querySelectorAll('.product-card'));
  let applied = new Map(), busy = false;
  function restore(key) {
    const item=applied.get(key); if(!item)return;
    const {card,price,buy,oldPrice,oldHref,oldText,badge,timer,was}=item;
    price.textContent=oldPrice;buy.href=oldHref;buy.textContent=oldText;
    badge.remove();timer.remove();was.remove();card.classList.remove('radi-offer');applied.delete(key);
  }
  function visibility(){notice.hidden=applied.size===0;}
  function tick(){
    for(const [key,item] of applied){
      const seconds=Math.max(0,Math.floor((Date.parse(item.row.ends_at)-Date.now())/1000));
      if(!seconds){restore(key);continue;}
      const days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60),secs=seconds%60;
      item.timer.querySelector('b').textContent=(days?days+' días · ':'')+[hours,minutes,secs].map(n=>String(n).padStart(2,'0')).join(':');
    }visibility();
  }
  function render(rows){
    const offers=new Map();
    for(const row of rows){
      if(!row || !row.active || typeof row.product_name!=='string' || typeof row.name!=='string' || !Number.isInteger(row.price) || !Number.isInteger(row.regular_price) || row.price<=0 || row.price>=row.regular_price || !(Date.parse(row.ends_at)>Date.now()))continue;
      const key=normalize(row.product_name),previous=offers.get(key);
      if(!previous || row.price<previous.price)offers.set(key,row);
    }
    for(const key of applied.keys())if(!offers.has(key))restore(key);
    for(const [key,row] of offers){
      const card=cards.find(c=>normalize(c.querySelector('h3')?.textContent||'')===key);
      if(!card)continue;
      const price=card.querySelector('.published-price strong'),buy=card.querySelector('a.buy'),info=card.querySelector('.product-info');
      if(!price||!buy||!info)continue;
      if(applied.has(key)&&JSON.stringify(applied.get(key).row)===JSON.stringify(row))continue;
      restore(key);
      const badge=document.createElement('span');badge.className='radi-offer-label';badge.textContent='PROMOCIÓN';
      const was=document.createElement('div');was.className='radi-offer-was';const del=document.createElement('del');del.textContent=money(row.regular_price);was.append(del);
      const percent=document.createElement('span');percent.className='radi-discount-percent';
      const discount=Math.max(1,Math.min(99,Math.round((row.regular_price-row.price)/row.regular_price*100)));
      percent.textContent='−'+discount+'%';percent.setAttribute('aria-label',discount+'% de descuento');was.append(percent);
      const timer=document.createElement('div');timer.className='radi-card-timer';timer.innerHTML='<small>Tiempo restante</small><b role="timer" aria-label="Tiempo restante de la promoción"></b><small class="radi-stock">O hasta agotar existencias</small>';
      applied.set(key,{card,price,buy,row,oldPrice:price.textContent,oldHref:buy.href,oldText:buy.textContent,badge,timer,was});
      card.classList.add('radi-offer');info.prepend(badge);price.parentNode.before(was);was.before(timer);
      price.textContent=money(row.price);buy.href='https://wa.me/573127220795?text='+encodeURIComponent('Hola, quiero la promoción '+row.name+' ('+row.product_name+') por '+money(row.price)+' COP. ¿Está disponible?');
    }tick();
  }
  async function refresh(){
    if(busy||document.hidden)return;busy=true;
    try{
      const r=await fetch(config.supabaseUrl.replace(/\/$/,'')+'/rest/v1/radi_promotion?select=id,name,product_name,regular_price,price,ends_at,active&order=id.asc',{headers:{apikey:config.publishableKey},cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!r.ok)throw Error('fetch');const rows=await r.json();render(Array.isArray(rows)?rows:[]);
    }catch(_){render([]);}finally{busy=false;}
  }
  refresh();setInterval(refresh,60000);setInterval(tick,1000);document.addEventListener('visibilitychange',refresh);
})();
