// FeeScope engine tests. Run: node test-fees.mjs
import assert from 'node:assert';
import { computeFees, MARKETPLACES, defaultConfig, DEFAULT_INPUT } from './fees.js';

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed++;
}
function close(actual, expected, tol, name) {
  assert.ok(Math.abs(actual - expected) <= tol,
    `${name}: got ${actual}, want ${expected}\u00b1${tol}`);
  passed++;
}

const ETSY = { marketplace: 'etsy', salePrice: 25, shippingCharged: 0, shippingCost: 4, itemCost: 8, quantity: 1 };

// ── Etsy ─────────────────────────────────────────────────────────────────────
const e = computeFees(ETSY);
close(e.grossRevenue, 25, 1e-9, 'etsy gross revenue');
close(e.totalFees, 2.825, 1e-9, 'etsy total fees = 0.20 + 6.5% + 3% + 0.25');
close(e.netProceeds, 22.175, 1e-9, 'etsy net proceeds');
close(e.profit, 10.175, 1e-9, 'etsy profit');
close(e.marginPct, 40.7, 1e-9, 'etsy margin %');
close(e.roiOnCost, 127.1875, 1e-9, 'etsy ROI on item cost');
close(e.breakEvenPrice, 12.45 / 0.905, 1e-6, 'etsy break-even price');

// Fee itemization must be exact and sum correctly
const eByKey = Object.fromEntries(e.fees.map(f => [f.key, f.amount]));
close(eByKey.listingFee, 0.20, 1e-9, 'etsy listing fee');
close(eByKey.transactionFee, 1.625, 1e-9, 'etsy transaction fee');
close(eByKey.paymentProcessing, 1.00, 1e-9, 'etsy payment processing');
close(e.totalFees, e.fees.reduce((s, f) => s + f.amount, 0), 1e-9, 'etsy fees sum to total');
close(e.netProceeds, e.grossRevenue - e.totalFees, 1e-9, 'etsy net proceeds identity');
close(e.profit, e.netProceeds - e.cogs - e.shippingCost, 1e-9, 'etsy profit identity');

// ── eBay ─────────────────────────────────────────────────────────────────────
const b = computeFees({ ...ETSY, marketplace: 'ebay' });
close(b.totalFees, 3.6125, 1e-9, 'ebay total fees = 13.25% + 0.30');
close(b.profit, 9.3875, 1e-9, 'ebay profit');
close(b.breakEvenPrice, 12.30 / 0.8675, 1e-6, 'ebay break-even price');

// ── Amazon FBA ───────────────────────────────────────────────────────────────
const a = computeFees({ ...ETSY, marketplace: 'amazon' });
close(a.totalFees, 7.35, 1e-9, 'amazon total fees = 15% + fulfillment + storage');
close(a.profit, 5.65, 1e-9, 'amazon profit');
close(a.breakEvenPrice, 15.6 / 0.85, 1e-6, 'amazon break-even price');
const aMin = computeFees({ marketplace: 'amazon', salePrice: 1, shippingCharged: 0, itemCost: 0, shippingCost: 0, quantity: 1 });
const aMinRef = aMin.fees.find(f => f.key === 'referralFee').amount;
close(aMinRef, 0.30, 1e-9, 'amazon $0.30 referral minimum applies on tiny sales');

// ── Custom marketplace ───────────────────────────────────────────────────────
const c = computeFees({ ...ETSY, marketplace: 'custom' });
close(c.totalFees, 2.80, 1e-9, 'custom total fees = 10% + 0.30');
close(c.profit, 10.20, 1e-9, 'custom profit');
close(c.breakEvenPrice, 12.30 / 0.90, 1e-6, 'custom break-even price');

// ── Poshmark: 20% of item price at/above $15, flat $2.95 below ────────────────
const p = computeFees({ ...ETSY, marketplace: 'poshmark' });
close(p.totalFees, 5.00, 1e-9, 'poshmark commission = 20% of item price');
close(p.profit, 8.00, 1e-9, 'poshmark profit');
close(p.breakEvenPrice, 14.95, 1e-6, 'poshmark break-even price (flat $2.95 tier applies below $15)');
close(p.fees.find(f => f.key === 'commission').amount, 5.00, 1e-9, 'poshmark commission line');
const pSmall = computeFees({ ...ETSY, marketplace: 'poshmark', salePrice: 10 });
close(pSmall.fees.find(f => f.key === 'commission').amount, 2.95, 1e-9, 'poshmark flat $2.95 under $15');
// Poshmark commission ignores shipping (buyer pays it separately)
const pShip = computeFees({ ...ETSY, marketplace: 'poshmark', shippingCharged: 8 });
close(pShip.fees.find(f => f.key === 'commission').amount, 5.00, 1e-9, 'poshmark commission is on item price, not shipping');

// ── Depop: 10% selling fee + ~3.3% + $0.45 processing ────────────────────────
const d = computeFees({ ...ETSY, marketplace: 'depop' });
close(d.totalFees, 3.775, 1e-9, 'depop total fees = 10% + 3.3% + 0.45');
close(d.profit, 9.225, 1e-9, 'depop profit');
close(d.breakEvenPrice, 12.45 / 0.867, 1e-6, 'depop break-even price');

// ── Shopify: payment processing ~2.9% + $0.30, optional gateway fee ──────────
const s = computeFees({ ...ETSY, marketplace: 'shopify' });
close(s.totalFees, 1.025, 1e-9, 'shopify processing = 2.9% + 0.30');
close(s.profit, 11.975, 1e-9, 'shopify profit');
close(s.breakEvenPrice, 12.30 / 0.971, 1e-6, 'shopify break-even price');
const sTp = computeFees({ ...ETSY, marketplace: 'shopify', config: { thirdPartyPct: 2 } });
close(sTp.totalFees, 1.525, 1e-9, 'shopify third-party gateway fee adds 2%');

// ── Shipping charged raises revenue and percentage fees ─────────────────────
const ship = computeFees({ ...ETSY, shippingCharged: 5 });
close(ship.grossRevenue, 30, 1e-9, 'shipping charged added to revenue');
close(ship.totalFees, 3.30, 1e-9, 'percentage fees apply to item + shipping');
close(ship.profit, 14.70, 1e-9, 'shipping charged flows through to profit');

// ── Ad rate (e.g. 12% Etsy offsite ads) ──────────────────────────────────────
const ad = computeFees({ ...ETSY, adRate: 12 });
const adFee = ad.fees.find(f => f.key === 'adFee').amount;
close(adFee, 3.00, 1e-9, 'ad fee = 12% of revenue');
close(ad.profit, 7.175, 1e-9, 'ad rate reduces profit');

// ── Optional income tax ──────────────────────────────────────────────────────
const taxed = computeFees({ ...ETSY, taxRate: 25 });
close(taxed.tax, 10.175 * 0.25, 1e-9, 'tax applied to positive profit');
close(taxed.profitAfterTax, 10.175 - 10.175 * 0.25, 1e-9, 'after-tax profit');
const noTax = computeFees({ ...ETSY, taxRate: 25, salePrice: 1 });
close(noTax.tax, 0, 1e-9, 'no tax on a loss');

// ── Quantity scaling is linear (fixed fees are per unit) ─────────────────────
const q3 = computeFees({ ...ETSY, quantity: 3 });
close(q3.grossRevenue, 75, 1e-9, 'quantity scales revenue');
close(q3.totalFees, 2.825 * 3, 1e-9, 'quantity scales fees');
close(q3.profit, 10.175 * 3, 1e-9, 'quantity scales profit');
close(q3.breakEvenPrice, e.breakEvenPrice, 1e-6, 'break-even price is quantity-independent');
close(q3.perUnit.profit, 10.175, 1e-9, 'per-unit profit');
close(q3.perUnit.totalFees, 2.825, 1e-9, 'per-unit fees');
ok('per-unit fee list matches unit count', q3.perUnit.fees.length === e.fees.length);

// ── Break-even definition: profit is ~0 at the reported price ────────────────
for (const [name, base] of [['etsy', ETSY], ['ebay', { ...ETSY, marketplace: 'ebay' }], ['amazon', { ...ETSY, marketplace: 'amazon' }]]) {
  const r = computeFees(base);
  const at = computeFees({ ...base, salePrice: r.breakEvenPrice });
  close(at.profit, 0, 1e-6, `${name} break-even yields zero profit`);
}

// ── Config overrides are honored and isolated ────────────────────────────────
const override = computeFees({ ...ETSY, config: { transactionPct: 10 } });
close(override.fees.find(f => f.key === 'transactionFee').amount, 2.50, 1e-9, 'config override transaction %');
const d1 = defaultConfig('etsy');
d1.paymentFixed = 99;
ok('defaultConfig returns an isolated copy', defaultConfig('etsy').paymentFixed === 0.25);
ok('all marketplace defaults are present',
  Object.keys(MARKETPLACES).every(k => defaultConfig(k) && Object.keys(defaultConfig(k)).length > 0));
ok('all built-in marketplaces compute', ['etsy', 'ebay', 'amazon', 'poshmark', 'depop', 'shopify', 'custom']
  .every(m => Number.isFinite(computeFees({ ...ETSY, marketplace: m }).profit)));
ok('unknown marketplace falls back to custom', computeFees({ ...ETSY, marketplace: 'nope' }).marketplace === 'custom');

// ── Edge cases ───────────────────────────────────────────────────────────────
const zero = computeFees({ ...ETSY, quantity: 0 });
ok('zero quantity -> null per-unit breakdown', zero.perUnit === null);
ok('zero quantity -> null break-even', zero.breakEvenPrice === null);
close(zero.profit, 0, 1e-9, 'zero quantity -> zero profit');
const loss = computeFees({ marketplace: 'amazon', salePrice: 5, shippingCharged: 0, itemCost: 6, shippingCost: 2, quantity: 1 });
ok('unprofitable sale has negative profit', loss.profit < 0);
ok('unprofitable sale has negative margin', loss.marginPct < 0);

// ── Sanity of the default input ──────────────────────────────────────────────
ok('DEFAULT_INPUT has a valid marketplace', !!MARKETPLACES[DEFAULT_INPUT.marketplace]);
ok('computeFees accepts no argument', Number.isFinite(computeFees().profit));

console.log(`\nFeeScope engine tests: ${passed} assertions passed.`);
