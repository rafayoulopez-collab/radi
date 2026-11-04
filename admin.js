import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm';
import {products as originalProducts} from './catalogo-admin.js';
import {validRate, money as displayMoney} from './radi-precios.js?v=radi-monedas-20261104-v1';
const products=originalProducts.map(product=>({...product}));
let fxRate=null;

const el = id => document.getElementById(id);
const money = n => new Intl.NumberFormat('es-CO', {style: 'currency', currency: 'COP', maximumFractionDigits: 0}).format(n);
let currentId = null, savedRows = [];
let client, administrator = false, loading = false, writing = false;
const config = window.RADI_CONFIG;
function notify(message, error = false) {
  el('status').textContent = message;
  el('status').classList.toggle('error', error);
  el('status').hidden = false;
}
function setView(view) {
  for (const id of ['setup', 'login-section', 'editor']) el(id).hidden = id !== view;
  el('session-controls').hidden = !administrator;
}
function selected() { return products[Number(el('product').value)]; }
function colombianInput(iso) {
  return new Date(Date.parse(iso) - 5 * 3600000).toISOString().slice(0, 16);
}
function preview() {
  const product = selected(); if (!product) return;
  const name = el('name').value.trim(), price = Number(el('price').value);
  const date = new Date(el('ends').value ? el('ends').value + ':00-05:00' : NaN);
  const validDate = Number.isFinite(date.getTime());
  const remaining = validDate ? Math.max(0, Math.floor((date - Date.now()) / 1000)) : 0;
  const active = el('active').checked;
  el('preview-name').textContent = name || 'Tu promoción';
  el('preview-regular').textContent = money(product.price);
  el('preview-price').textContent = price > 0 ? money(price) : '—';
  el('preview-badge').textContent = !active ? 'DESACTIVADA' : validDate && !remaining ? 'FINALIZADA' : 'VISTA PREVIA';
  el('clock').textContent = validDate ? `${Math.floor(remaining / 86400)} días · ${String(Math.floor(remaining % 86400 / 3600)).padStart(2, '0')}:${String(Math.floor(remaining % 3600 / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}` : 'Selecciona la fecha de cierre';
  el('preview-date').textContent = validDate ? new Intl.DateTimeFormat('es-CO', {timeZone: 'America/Bogota', dateStyle: 'long', timeStyle: 'short'}).format(date) + ' · Colombia' : '';
  const buy = el('preview-buy');
  buy.hidden = !active || !remaining || !(price > 0 && price < product.price) || !name;
  buy.href = 'https://wa.me/573127220795?text=' + encodeURIComponent('Hola, quiero la promoción ' + name + ' (' + product.name + ') por ' + money(price) + ' COP. ¿Está disponible?');
}
function defaults() {
  const product = selected();
  el('name').value = product.name;
  el('price').value = '';
  el('ends').value = '';
  el('active').checked = false;
  preview();
}
function fillPromotion(row) {
  currentId = row ? row.id : null;
  el('saved-promotions').value = row ? String(row.id) : '';
  if (!row) { defaults(); return; }
  const index = products.findIndex(p => p.name === row.product_name);
  if (index < 0) { notify('Este servicio ya no está en el catálogo. Selecciona uno antes de guardar.', true); return; }
  el('product').value = String(index);
  el('name').value = row.name;
  el('price').value = row.price;
  el('ends').value = colombianInput(row.ends_at);
  el('active').checked = row.active;
  preview();
}
async function load() {
  if (!administrator || writing) return;
  el('reload').disabled = true;
  try {
    const {data, error} = await client.from('radi_promotion').select('*').order('id');
    if (error) throw error;
    savedRows = data || [];
    const picker = el('saved-promotions');
    picker.replaceChildren();
    const fresh = document.createElement('option'); fresh.value = ''; fresh.textContent = 'Nueva promoción'; picker.append(fresh);
    for (const row of savedRows) {
      const option = document.createElement('option'); option.value = String(row.id);
      const state = !row.active ? 'Desactivada' : Date.parse(row.ends_at) <= Date.now() ? 'Finalizada' : 'Activa';
      option.textContent = row.name + ' · ' + state; picker.append(option);
    }
    fillPromotion(savedRows.find(row => row.id === currentId) || null);
  } catch (_) { notify('No se pudieron cargar las promociones. Revisa tu conexión y los permisos.', true); }
  finally { el('reload').disabled = false; }
}
async function authorize() {
  if (loading) return;
  loading = true;
  administrator = false; setView('login-section');
  try {
    const {data: {session}, error} = await client.auth.getSession();
    if (error || !session) return;
    const {data, error: permissionError} = await client.from('radi_admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
    if (permissionError || !data) {
      await client.auth.signOut();
      notify('Este usuario no tiene permiso para administrar Radi. Habilítalo con el archivo 02 de configuración.', true); return;
    }
    administrator = true; el('account').textContent = session.user.email || '';
    setView('editor'); await loadPricing(); await load();
  } finally { loading = false; }
}
for (const [index, product] of products.entries()) {
  const option = document.createElement('option'); option.value = String(index); option.textContent = product.name; el('product').append(option);
}
defaults();
if (!config || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl) || !config.publishableKey || config.publishableKey.startsWith('sb_secret_')) {
  setView('setup');
} else {
  client = createClient(config.supabaseUrl, config.publishableKey, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: false}});
  el('login-form').addEventListener('submit', async event => {
    event.preventDefault(); el('login').disabled = true; el('status').hidden = true;
    try {
      const {error} = await client.auth.signInWithPassword({email: el('email').value.trim(), password: el('password').value});
      el('password').value = '';
      if (error) { notify('No se pudo iniciar sesión. Revisa el correo y la contraseña.', true); return; }
      await authorize();
    } catch (_) { notify('No se pudo conectar con el servicio. Inténtalo de nuevo.', true); }
    finally { el('login').disabled = false; }
  });
  el('logout').addEventListener('click', async () => {
    const {error} = await client.auth.signOut();
    if (error) { notify('No se pudo cerrar la sesión. Inténtalo de nuevo.', true); return; }
    administrator = false; currentId = null; savedRows = []; setView('login-section'); defaults(); notify('Sesión cerrada.');
  });
  el('promotion-form').addEventListener('submit', async event => {
    event.preventDefault(); if (!administrator || writing) return;
    const product = selected(), price = Number(el('price').value), name = el('name').value.trim();
    const date = new Date(el('ends').value ? el('ends').value + ':00-05:00' : NaN), active = el('active').checked;
    if (!name || name.length > 140 || !Number.isInteger(price) || price <= 0 || price >= product.price || !Number.isFinite(date.getTime()) || (active && date <= new Date())) {
      notify('Revisa el nombre, el precio (menor que el habitual) y la fecha futura de la promoción activa.', true); return;
    }
    if (active && savedRows.some(row => row.id !== currentId && row.product_name === product.name && row.active && Date.parse(row.ends_at) > Date.now())) { notify('Este servicio ya tiene una promoción activa. Selecciónala en Promociones guardadas para editarla o desactivarla.', true); return; }
    writing = true; el('save').disabled = true; el('reload').disabled = true; el('new-promotion').disabled = true; el('saved-promotions').disabled = true;
    try {
      const payload = {product_name: product.name, name, regular_price: product.price, price, ends_at: date.toISOString(), active, updated_at: new Date().toISOString()};
      const query = currentId === null ? client.from('radi_promotion').insert(payload) : client.from('radi_promotion').update(payload).eq('id', currentId);
      const {data, error} = await query.select('id').single();
      if (error) throw error;
      currentId = data.id;
      writing = false;
      await load();
      notify(active ? 'Promoción guardada. Aparecerá al abrir tu tienda o en su próxima actualización, dentro de un minuto.' : 'Promoción desactivada. Se ocultará al abrir tu tienda o en su próxima actualización, dentro de un minuto.');
    } catch (_) { notify('No se pudo guardar. Los cambios no se han publicado. Revisa tu conexión y los permisos.', true); }
    finally { writing = false; el('save').disabled = false; el('reload').disabled = false; el('new-promotion').disabled = false; el('saved-promotions').disabled = false; }
  });
  client.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') { administrator = false; setView('login-section'); }
  });
}
el('product').addEventListener('change', defaults);
for (const id of ['name', 'price', 'ends', 'active']) el(id).addEventListener('input', preview);
el('reload').addEventListener('click', load);
setInterval(preview, 1000);

el('new-promotion').addEventListener('click', () => { if (!writing) fillPromotion(null); });
el('saved-promotions').addEventListener('change', () => { if (!writing) fillPromotion(savedRows.find(row => String(row.id) === el('saved-promotions').value) || null); });

function pricingPreview(){
 const raw=el('fx-rate').value;const rate=Number(raw);const index=Number(el('catalog-product').value),price=Number(el('catalog-price').value);
 el('rate-example').textContent=validRate(rate)?'Ejemplo: '+displayMoney(12000,'COP')+' → '+displayMoney(12000,'USD',rate)+' USD · Redondeo hacia arriba cada US$0,50':'La tienda redondea los dólares hacia arriba en pasos de US$0,50';
 el('catalog-usd').textContent=Number.isInteger(price)&&price>0&&validRate(fxRate)?'Precio en dólares: '+displayMoney(price,'USD',fxRate)+' USD':'Guarda el valor del dólar para ver la conversión';
}
function priceSelection(){const product=products[Number(el('catalog-product').value)];if(product)el('catalog-price').value=product.price;pricingPreview();}
async function loadPricing(){
 try{
  const [settings,prices]=await Promise.all([client.from('radi_store_settings').select('cop_per_usd').eq('id',1).maybeSingle(),client.from('radi_catalog_prices').select('product_name,price_cop')]);
  if(settings.error||prices.error)throw Error('missing');
  const rate=Number(settings.data?.cop_per_usd);fxRate=validRate(rate)?rate:null;el('fx-rate').value=fxRate??'';
  for(const product of products){product.price=originalProducts.find(p=>p.name===product.name).price;const row=(prices.data||[]).find(p=>p.product_name===product.name);if(row)product.price=row.price_cop;}
  priceSelection();preview();
 }catch(_){notify('Falta habilitar los precios y la tasa. Ejecuta el SQL incluido en esta actualización en Supabase.',true);}
}
for(const [index,product] of products.entries()){const option=document.createElement('option');option.value=String(index);option.textContent=product.name;el('catalog-product').append(option);}
priceSelection();
el('catalog-product').addEventListener('change',priceSelection);
el('catalog-price').addEventListener('input',pricingPreview);
el('fx-rate').addEventListener('input',pricingPreview);
el('rate-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!administrator)return;const rate=Number(el('fx-rate').value);
 if(!validRate(rate)){notify('Escribe una tasa válida: cuántos pesos equivalen a 1 USD.',true);return;}
 el('save-rate').disabled=true;
 try{const {error}=await client.from('radi_store_settings').upsert({id:1,cop_per_usd:rate,updated_at:new Date().toISOString()},{onConflict:'id'});if(error)throw error;fxRate=rate;pricingPreview();notify('Valor del dólar guardado. La tienda usará la nueva tasa al abrirse o en un minuto.');}
 catch(_){notify('No se guardó la tasa. Revisa la conexión y que hayas ejecutado el SQL de esta actualización.',true);}
 finally{el('save-rate').disabled=false;}
});
el('catalog-price-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!administrator)return;const product=products[Number(el('catalog-product').value)],price=Number(el('catalog-price').value);
 if(!product||!Number.isInteger(price)||price<1||price>100000000){notify('Escribe un precio entero en pesos mayor que cero.',true);return;}
 el('save-catalog-price').disabled=true;
 try{const {error}=await client.from('radi_catalog_prices').upsert({product_name:product.name,price_cop:price,updated_at:new Date().toISOString()},{onConflict:'product_name'});if(error)throw error;product.price=price;preview();pricingPreview();notify('Precio en pesos guardado. Los dólares se calcularán automáticamente con tu tasa. La tienda se actualiza al abrirse o en un minuto.');}
 catch(_){notify('No se guardó el precio. Revisa tu conexión y los permisos.',true);}
 finally{el('save-catalog-price').disabled=false;}
});

if(client) await authorize();
