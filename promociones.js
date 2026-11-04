(() => {
  const config = window.RADI_CONFIG;
  const notice = document.getElementById('radi-promo-notice');
  if (!notice || !config || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl) || !config.publishableKey) return;
  const money = n => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n);
  const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  let applied = null, busy = false;
  function restore() {
    notice.hidden = true;
    if (!applied) return;
    const {card,price,buy,oldPrice,oldHref,oldText,badge,timer,was,oldId} = applied;
    price.textContent=oldPrice; buy.href=oldHref; buy.textContent=oldText;
    badge.remove();timer.remove();was.remove();card.classList.remove('radi-offer');
    if (oldId) card.id=oldId; else card.removeAttribute('id');
    applied=null;
  }
  function tick() {
    if (!applied) return;
    const seconds=Math.max(0,Math.floor((Date.parse(applied.row.ends_at)-Date.now())/1000));
    if (!seconds) {restore();return;}
    const days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60),secs=seconds%60;
    applied.timer.querySelector('b').textContent=(days?days+' días · ':'')+[hours,minutes,secs].map(n=>String(n).padStart(2,'0')).join(':');
  }
  function render(row) {
    if (!row || !row.active || typeof row.product_name!=='string' || typeof row.name!=='string' || !Number.isInteger(row.price) || !Number.isInteger(row.regular_price) || row.price<=0 || row.price>=row.regular_price || !(Date.parse(row.ends_at)>Date.now())) {restore();return;}
    const card=Array.from(document.querySelectorAll('.product-card')).find(c=>normalize(c.querySelector('h3')?.textContent||'')===normalize(row.product_name));
    if (!card) {restore();return;}
    const price=card.querySelector('.published-price strong'),buy=card.querySelector('a.buy'),info=card.querySelector('.product-info');
    if (!price || !buy || !info) {restore();return;}
    if (applied && applied.card===card && JSON.stringify(applied.row)===JSON.stringify(row)) {tick();return;}
    restore();
    const badge=document.createElement('span');badge.className='radi-offer-label';badge.textContent='PROMOCIÓN';
    const was=document.createElement('div');was.className='radi-offer-was';const del=document.createElement('del');del.textContent=money(row.regular_price);was.append(del);
    const timer=document.createElement('div');timer.className='radi-card-timer';
    timer.innerHTML='<small>Tiempo restante</small><b role="timer" aria-label="Tiempo restante de la promoción"></b><small class="radi-stock">O hasta agotar existencias</small>';
    applied={card,price,buy,row,oldPrice:price.textContent,oldHref:buy.href,oldText:buy.textContent,oldId:card.id,badge,timer,was};
    card.id='radi-servicio-en-oferta';card.classList.add('radi-offer');
    info.prepend(badge);price.parentNode.before(was);was.before(timer);
    price.textContent=money(row.price);
    buy.href='https://wa.me/573127220795?text='+encodeURIComponent('Hola, quiero la promoción '+row.name+' ('+row.product_name+') por '+money(row.price)+' COP. ¿Está disponible?');
    notice.hidden=false;tick();
  }
  async function refresh(){
    if(busy||document.hidden)return;busy=true;
    try{
      const r=await fetch(config.supabaseUrl.replace(/\/$/,'')+'/rest/v1/radi_promotion?select=name,product_name,regular_price,price,ends_at,active&id=eq.1',{headers:{apikey:config.publishableKey},cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!r.ok)throw Error('fetch');const rows=await r.json();render(Array.isArray(rows)?rows[0]:null);
    }catch(_){restore();}finally{busy=false;}
  }
  refresh();setInterval(refresh,60000);setInterval(tick,1000);document.addEventListener('visibilitychange',refresh);
})();
