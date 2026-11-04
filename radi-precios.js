export function normalize(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
export function validRate(rate) { return Number.isFinite(rate) && rate >= 1 && rate <= 1000000; }
export function usdCents(cop, rate) {
  if (!Number.isSafeInteger(cop) || cop < 0 || !validRate(rate)) throw new Error('invalid_conversion');
  // Tasa con cuatro decimales; redondeo exacto hacia arriba en pasos de 50 centavos.
  return Math.ceil((cop * 20000) / Math.round(rate * 10000)) * 50;
}
export function amount(cop, currency, rate) { return currency === 'USD' ? usdCents(cop, rate) / 100 : cop; }
export function money(cop, currency = 'COP', rate = null) {
  return new Intl.NumberFormat('es-CO', {style:'currency', currency, minimumFractionDigits:currency==='USD'?2:0, maximumFractionDigits:currency==='USD'?2:0}).format(amount(cop,currency,rate));
}
