(() => {
  const box = document.getElementById('radi-live-promotion');
  const config = window.RADI_CONFIG;
  if (!box || !config || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl) || !config.publishableKey) return;
  const get = id => document.getElementById(id);
  const money = value => new Intl.NumberFormat('es-CO', {style: 'currency', currency: 'COP', maximumFractionDigits: 0}).format(value);
  let current = null, busy = false;
  function tick() {
    if (!current) return;
    const seconds = Math.max(0, Math.floor((Date.parse(current.ends_at) - Date.now()) / 1000));
    const values = [Math.floor(seconds / 86400), Math.floor(seconds % 86400 / 3600), Math.floor(seconds % 3600 / 60), seconds % 60];
    ['days', 'hours', 'minutes', 'seconds'].forEach((key, i) => get('radi-promo-' + key).textContent = String(values[i]).padStart(2, '0'));
    get('radi-promo-badge').textContent = seconds > 0 ? 'PROMOCIÓN ESPECIAL' : 'PROMOCIÓN FINALIZADA';
    get('radi-promo-link').hidden = seconds === 0;
    if (!seconds) get('radi-promo-link').removeAttribute('href');
  }
  async function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const response = await fetch(config.supabaseUrl.replace(/\/$/, '') + '/rest/v1/radi_promotion?select=name,product_name,regular_price,price,ends_at,active&id=eq.1', {
        headers: {apikey: config.publishableKey}, cache: 'no-store', signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error('No se pudo consultar la promoción');
      const rows = await response.json();
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row || !row.active || !Number.isInteger(row.price) || row.price <= 0 || row.price >= row.regular_price || !Number.isFinite(Date.parse(row.ends_at))) {
        current = null; box.hidden = true; return;
      }
      current = row;
      get('radi-promo-name').textContent = row.name;
      get('radi-promo-was').textContent = money(row.regular_price);
      get('radi-promo-price').textContent = money(row.price);
      get('radi-promo-deadline').textContent = 'Hasta el ' + new Intl.DateTimeFormat('es-CO', {timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit'}).format(new Date(row.ends_at)) + ' · Colombia';
      const message = 'Hola, quiero la promoción ' + row.name + ' (' + row.product_name + ') por ' + money(row.price) + ' COP. ¿Está disponible?';
      get('radi-promo-link').href = 'https://wa.me/573127220795?text=' + encodeURIComponent(message);
      tick(); box.hidden = false;
    } catch (_) {
      current = null; box.hidden = true;
    } finally { busy = false; }
  }
  refresh(); setInterval(refresh, 60000); setInterval(tick, 1000);
  document.addEventListener('visibilitychange', refresh);
})();
