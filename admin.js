import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm';
import {products} from './catalogo-admin.js';

const el = id => document.getElementById(id);
const money = n => new Intl.NumberFormat('es-CO', {style: 'currency', currency: 'COP', maximumFractionDigits: 0}).format(n);
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
  const date = new Date(el('ends').value + ':00-05:00');
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
async function load() {
  if (!administrator || writing) return;
  el('reload').disabled = true;
  try {
    const {data, error} = await client.from('radi_promotion').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    if (!data) { defaults(); return; }
    const index = products.findIndex(p => p.name === data.product_name);
    if (index < 0) throw new Error('catalogue_changed');
    el('product').value = String(index);
    el('name').value = data.name;
    el('price').value = data.price;
    el('ends').value = colombianInput(data.ends_at);
    el('active').checked = data.active;
    preview();
  } catch (error) {
    notify(error.message === 'catalogue_changed' ? 'El servicio guardado no está en este catálogo. Selecciona uno y revisa todos los datos antes de guardar.' : 'No se pudo cargar la promoción. Revisa la conexión y los permisos de tu usuario.', true);
  } finally { el('reload').disabled = false; }
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
    setView('editor'); await load();
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
    administrator = false; setView('login-section'); defaults(); notify('Sesión cerrada.');
  });
  el('promotion-form').addEventListener('submit', async event => {
    event.preventDefault(); if (!administrator || writing) return;
    const product = selected(), price = Number(el('price').value), name = el('name').value.trim();
    const date = new Date(el('ends').value + ':00-05:00'), active = el('active').checked;
    if (!name || name.length > 140 || !Number.isInteger(price) || price <= 0 || price >= product.price || !Number.isFinite(date.getTime()) || (active && date <= new Date())) {
      notify('Revisa el nombre, el precio (menor que el habitual) y la fecha futura de la promoción activa.', true); return;
    }
    writing = true; el('save').disabled = true; el('reload').disabled = true;
    try {
      const {error} = await client.from('radi_promotion').upsert({id: 1, product_name: product.name, name, regular_price: product.price, price, ends_at: date.toISOString(), active, updated_at: new Date().toISOString()}, {onConflict: 'id'}).select('id').single();
      if (error) throw error;
      notify(active ? 'Promoción guardada. Aparecerá al abrir tu tienda o en su próxima actualización, dentro de un minuto.' : 'Promoción desactivada. Se ocultará al abrir tu tienda o en su próxima actualización, dentro de un minuto.');
    } catch (_) { notify('No se pudo guardar. Los cambios no se han publicado. Revisa tu conexión y los permisos.', true); }
    finally { writing = false; el('save').disabled = false; el('reload').disabled = false; }
  });
  client.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') { administrator = false; setView('login-section'); }
  });
  await authorize();
}
el('product').addEventListener('change', defaults);
for (const id of ['name', 'price', 'ends', 'active']) el(id).addEventListener('input', preview);
el('reload').addEventListener('click', load);
setInterval(preview, 1000);
