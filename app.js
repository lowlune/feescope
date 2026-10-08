import { computeFees, MARKETPLACES, defaultConfig } from './fees.js';

// ── Replace with the real Gumroad product URL once the listing exists. ──
export const GUMROAD_URL = '#pro'; // TODO(listing): set to https://<store>.gumroad.com/l/feescope-pro

const $ = (id) => document.getElementById(id);
const FIELDS = ['marketplace', 'salePrice', 'shippingCharged', 'shippingCost', 'itemCost', 'quantity', 'adRate', 'taxRate'];

// Which fee inputs to expose per marketplace. Defaults come from fees.js.
const CONFIG_FIELDS = {
  etsy: [
    { key: 'listingFee', label: 'Listing fee / item', unit: '$', step: 0.01 },
    { key: 'transactionPct', label: 'Transaction fee', unit: '%', step: 0.1 },
    { key: 'paymentPct', label: 'Payment processing', unit: '%', step: 0.1 },
    { key: 'paymentFixed', label: 'Processing fixed / order', unit: '$', step: 0.01 },
  ],
  ebay: [
    { key: 'finalValuePct', label: 'Final value fee', unit: '%', step: 0.1 },
    { key: 'fixedPerOrder', label: 'Fixed fee / order', unit: '$', step: 0.01 },
    { key: 'storeFeePerOrder', label: 'Store fee / order (allocated)', unit: '$', step: 0.01 },
  ],
  amazon: [
    { key: 'referralPct', label: 'Referral fee', unit: '%', step: 0.1 },
    { key: 'referralMin', label: 'Referral minimum / unit', unit: '$', step: 0.01 },
    { key: 'fulfillmentPerUnit', label: 'FBA fulfillment / unit', unit: '$', step: 0.01 },
    { key: 'storagePerUnit', label: 'FBA storage / unit', unit: '$', step: 0.01 },
  ],
  custom: [
    { key: 'customPct', label: 'Percentage fee', unit: '%', step: 0.1 },
    { key: 'customFixed', label: 'Fixed fee / order', unit: '$', step: 0.01 },
  ],
};

// Per-marketplace fee settings, editable and preserved while you switch platforms.
const configState = {};
for (const id of Object.keys(MARKETPLACES)) configState[id] = defaultConfig(id);

const money = (n, d = 2) => {
  if (n == null || Number.isNaN(n)) return '—';
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};
const pct = (n, d = 2) => (n == null || Number.isNaN(n) ? '—' : n.toFixed(d) + '%');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const round2 = (n) => (n == null ? '' : Math.round(n * 100) / 100);

function currentMarket() {
  const v = $('marketplace').value;
  return MARKETPLACES[v] ? v : 'custom';
}

function readInputs() {
  const o = {};
  for (const f of FIELDS) {
    const el = $(f);
    o[f] = el ? parseFloat(el.value) : 0;
  }
  const market = currentMarket();
  o.marketplace = market;
  o.config = { ...configState[market] };
  return o;
}

function renderConfigFields() {
  const market = currentMarket();
  const fields = CONFIG_FIELDS[market] || [];
  $('configFields').innerHTML = fields.map((f) => {
    const val = configState[market][f.key];
    const before = f.unit === '$' ? '<span class="unit">$</span>' : '';
    const after = f.unit === '%' ? '<span class="unit">%</span>' : '';
    return `<div class="field"><label for="cfg_${f.key}">${esc(f.label)}</label><div class="in">${before}` +
      `<input id="cfg_${f.key}" data-cfg="${f.key}" type="number" min="0" step="${f.step}" value="${val}">${after}</div></div>`;
  }).join('');
  $('configNote').textContent =
    `Defaults for ${MARKETPLACES[market].label} are approximate 2026 U.S. rates and vary by category, country and plan. Edit them to match your account.`;
}

function metricHTML(r) {
  const feeShare = r.grossRevenue > 0 ? r.totalFees / r.grossRevenue * 100 : 0;
  const cards = [
    ['Total fees', money(r.totalFees), '', `${pct(feeShare, 1)} of revenue`],
    ['Net proceeds', money(r.netProceeds), '', 'After marketplace fees'],
    ['Profit', money(r.profit), r.profit >= 0 ? 'pos' : 'neg', `${r.quantity} unit${r.quantity === 1 ? '' : 's'}`],
    ['Margin', pct(r.marginPct, 1), r.marginPct >= 0 ? 'pos' : 'neg', 'Profit ÷ revenue'],
    ['ROI on item cost', r.roiOnCost == null ? '—' : pct(r.roiOnCost, 0), (r.roiOnCost ?? 0) >= 0 ? 'pos' : 'neg', 'Profit ÷ item cost'],
    ['Break-even price', r.breakEvenPrice == null ? '—' : money(r.breakEvenPrice), '', 'Per-unit price for $0 profit'],
  ];
  return cards.map(([k, v, c, s]) =>
    `<div class="metric"><div class="k">${k}</div><div class="v ${c}">${v}</div><div class="sub">${s}</div></div>`).join('');
}

function tableHTML(r) {
  const feeRows = r.fees.map((f) =>
    `<tr><td>${esc(f.label)}</td><td class="note" style="text-align:left">${esc(f.note)}</td><td>${money(f.amount)}</td></tr>`).join('');
  const summary = [
    ['Gross revenue', r.grossRevenue],
    ['Total fees', -r.totalFees],
    ['Net proceeds', r.netProceeds],
    ['Item cost', -r.cogs],
    ['Shipping cost', -r.shippingCost],
    ['Profit', r.profit],
  ].map(([k, v]) =>
    `<tr><td>${k}</td><td></td><td class="${v >= 0 ? 'pos' : 'neg'}">${money(v)}</td></tr>`).join('');
  return `<div class="tbl-wrap"><table><thead><tr><th>Item</th><th style="text-align:left">Basis</th><th>Amount (batch)</th></tr></thead>` +
    `<tbody>${feeRows}${summary}</tbody></table></div>`;
}

function perUnitHTML(r) {
  if (!r.perUnit) return '<p class="note">Enter a quantity of at least 1 to see the per-unit breakdown.</p>';
  const rows = r.perUnit.fees.map((f) => `<tr><td>${esc(f.label)}</td><td>${money(f.amount)}</td></tr>`).join('');
  return `<h3>Per unit</h3><div class="tbl-wrap"><table><tbody>` +
    `<tr><td>Sale price</td><td>${money(r.perUnit.salePrice)}</td></tr>` +
    `<tr><td>Shipping charged</td><td>${money(r.perUnit.shippingCharged)}</td></tr>` +
    `<tr><td>Revenue</td><td>${money(r.perUnit.revenue)}</td></tr>` +
    rows +
    `<tr><td><b>Total fees</b></td><td><b>${money(r.perUnit.totalFees)}</b></td></tr>` +
    `<tr><td>Net proceeds</td><td>${money(r.perUnit.netProceeds)}</td></tr>` +
    `<tr><td>Item cost</td><td>${money(r.perUnit.itemCost)}</td></tr>` +
    `<tr><td>Shipping cost</td><td>${money(r.perUnit.shippingCost)}</td></tr>` +
    `<tr><td><b>Profit / unit</b></td><td class="${r.perUnit.profit >= 0 ? 'pos' : 'neg'}"><b>${money(r.perUnit.profit)}</b></td></tr>` +
    `</tbody></table></div>`;
}

function drawChart(r) {
  const c = $('chart');
  if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth || 600;
  const h = c.clientHeight || 230;
  c.width = w * dpr;
  c.height = h * dpr;
  const x = c.getContext('2d');
  if (!x) return;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, w, h);

  const segs = [
    { label: 'Fees', value: r.totalFees, color: '#ffcf5c' },
    { label: 'Item cost', value: r.cogs, color: '#7a8bb0' },
    { label: 'Shipping', value: r.shippingCost, color: '#4aa8ff' },
    r.profit >= 0
      ? { label: 'Profit', value: r.profit, color: '#3ddc97' }
      : { label: 'Loss', value: -r.profit, color: '#ff6b6b' },
  ].filter((s) => s.value > 0);
  const total = segs.reduce((a, s) => a + s.value, 0) || 1;

  const pad = 24;
  const barY = 56;
  const barH = 58;
  const barW = w - pad * 2;
  x.fillStyle = '#93a2bd';
  x.font = '12px sans-serif';
  x.fillText('Where each dollar of cost + profit goes (batch totals)', pad, 26);

  let cx = pad;
  x.font = 'bold 12px sans-serif';
  for (const s of segs) {
    const sw = s.value / total * barW;
    x.fillStyle = s.color;
    x.fillRect(cx, barY, sw, barH);
    if (sw > 46) {
      x.fillStyle = '#0b1220';
      x.fillText(`${(s.value / total * 100).toFixed(0)}%`, cx + 8, barY + barH / 2 + 4);
    }
    cx += sw;
  }

  // legend
  let lx = pad;
  const ly = barY + barH + 30;
  x.font = '12px sans-serif';
  for (const s of segs) {
    x.fillStyle = s.color;
    x.fillRect(lx, ly - 9, 10, 10);
    x.fillStyle = '#93a2bd';
    const txt = `${s.label} ${money(s.value)}`;
    if (lx + 18 + x.measureText(txt).width > w - pad) break;
    x.fillText(txt, lx + 15, ly);
    lx += x.measureText(txt).width + 34;
  }
}

function serialize() {
  const o = readInputs();
  const p = new URLSearchParams();
  for (const f of FIELDS) {
    const v = o[f];
    if (v !== undefined && v !== null && v !== '') p.set(f, v);
  }
  for (const [k, v] of Object.entries(o.config)) p.set('c_' + k, v);
  return p;
}

function syncURL() {
  history.replaceState(null, '', location.pathname + '?' + serialize().toString());
}

function loadFromURL() {
  const p = new URLSearchParams(location.search);
  for (const f of FIELDS) {
    if (f === 'marketplace') continue;
    if (p.has(f)) {
      const v = parseFloat(p.get(f));
      if (!Number.isNaN(v)) $(f).value = v;
    }
  }
  if (p.has('marketplace') && MARKETPLACES[p.get('marketplace')]) {
    $('marketplace').value = p.get('marketplace');
  }
  const market = currentMarket();
  for (const field of (CONFIG_FIELDS[market] || [])) {
    const key = 'c_' + field.key;
    if (p.has(key)) {
      const v = parseFloat(p.get(key));
      if (!Number.isNaN(v)) configState[market][field.key] = v;
    }
  }
}

export function render() {
  const o = readInputs();
  const r = computeFees(o);
  $('metrics').innerHTML = metricHTML(r);
  $('feesTable').innerHTML = tableHTML(r);
  $('perUnit').innerHTML = perUnitHTML(r);
  drawChart(r);
  syncURL();
  window.__feescope = r; // for debugging
  return r;
}

function csv() {
  const r = window.__feescope || render();
  const lines = [];
  lines.push(['FeeScope export'].join(','));
  lines.push(['Marketplace', r.marketplace].join(','));
  for (const k of ['salePrice', 'shippingCharged', 'shippingCost', 'itemCost', 'quantity', 'adRate', 'taxRate']) {
    lines.push([k, round2(r.inputs[k])].join(','));
  }
  lines.push('');
  lines.push(['Fee', 'Basis', 'Amount (batch)'].join(','));
  for (const f of r.fees) lines.push([f.label, `"${String(f.note).replace(/"/g, "'")}"`, round2(f.amount)].join(','));
  lines.push('');
  for (const [k, v] of Object.entries({
    GrossRevenue: r.grossRevenue, TotalFees: r.totalFees, NetProceeds: r.netProceeds,
    ItemCost: r.cogs, ShippingCost: r.shippingCost, Profit: r.profit, ProfitAfterTax: r.profitAfterTax,
    MarginPct: r.marginPct, ROIonCostPct: r.roiOnCost, BreakEvenPrice: r.breakEvenPrice,
  })) lines.push([k, round2(v)].join(','));
  if (r.perUnit) {
    lines.push('');
    lines.push(['Per unit', '', ''].join(','));
    for (const f of r.perUnit.fees) lines.push([f.label, '', round2(f.amount)].join(','));
    lines.push(['TotalFeesPerUnit', '', round2(r.perUnit.totalFees)].join(','));
    lines.push(['ProfitPerUnit', '', round2(r.perUnit.profit)].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'feescope-profit.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

window.addEventListener('DOMContentLoaded', () => {
  loadFromURL();
  renderConfigFields();
  for (const f of FIELDS) {
    const el = $(f);
    if (!el) continue;
    el.addEventListener('input', render);
    el.addEventListener('change', () => {
      if (f === 'marketplace') {
        renderConfigFields();
        render();
      }
    });
  }
  $('configFields')?.addEventListener('input', (ev) => {
    const el = ev.target.closest('[data-cfg]');
    if (!el) return;
    configState[currentMarket()][el.dataset.cfg] = parseFloat(el.value) || 0;
    render();
  });
  $('reset')?.addEventListener('click', () => { location.href = location.pathname; });
  $('csv')?.addEventListener('click', csv);
  $('share')?.addEventListener('click', async () => {
    const btn = $('share');
    try {
      await navigator.clipboard.writeText(location.href);
      btn.textContent = 'Link copied!';
    } catch {
      btn.textContent = 'Copy the URL above';
    }
    setTimeout(() => { btn.textContent = 'Copy share link'; }, 1600);
  });
  document.querySelectorAll('[data-gumroad]').forEach((a) => {
    if (GUMROAD_URL !== '#pro') a.href = GUMROAD_URL;
  });
  window.addEventListener('resize', () => drawChart(window.__feescope || render()));
  render();
});
