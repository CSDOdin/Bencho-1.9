/* Conversión informativa: el importe base se conserva siempre en COP. */
(function () {
  'use strict';
  const defaultMethods = [
    { id: 'pago-movil', name: 'Pago Móvil' },
    { id: 'zelle', name: 'Zelle' },
    { id: 'efectivo-usd', name: 'Efectivo USD' },
    { id: 'efectivo-cop', name: 'Efectivo COP' }
  ];
  function divider(value) {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 && n <= 1e9 ? n : null;
  }
  function moneyCOP(value) {
    return `${Math.round(Number(value) || 0).toLocaleString('es-CO')} COP`;
  }
  function equivalents(value, config) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return [];
    const rates = config?.exchangeDivisors || {};
    const output = [];
    const usd = divider(rates.usd);
    const bs = divider(rates.bs);
    if (usd) output.push({ currency: 'USD', value: amount / usd });
    if (bs) output.push({ currency: 'Bs', value: amount / bs });
    return output;
  }
  function estimatesText(value, config) {
    return equivalents(value, config).map(({ currency, value }) => {
      const digits = currency === 'USD' ? 2 : 2;
      const formatted = value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: digits });
      return `≈ ${formatted} ${currency}`;
    }).join(' · ');
  }
  function legacyDivisors(rates) {
    const src = rates && typeof rates === 'object' ? rates : {};
    const usd = divider(src.copPerUsd);
    const copPerBs = divider(src.copPerBs);
    const bsPerUsd = divider(src.bsPerUsd);
    return {
      usd,
      bs: copPerBs || (usd && bsPerUsd ? divider(usd / bsPerUsd) : null)
    };
  }
  function paymentMethods(config) {
    const raw = config?.paymentMethods;
    if (!Array.isArray(raw)) return defaultMethods.map(method => ({ ...method }));
    return raw.filter(method => method && typeof method.id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(method.id) && typeof method.name === 'string' && method.name.trim().length > 0 && method.name.trim().length <= 60)
      .map(method => ({ id: method.id, name: method.name.trim() }));
  }
  globalThis.BenchoMoney = Object.freeze({ divider, moneyCOP, equivalents, estimatesText, paymentMethods, legacyDivisors });
})();

