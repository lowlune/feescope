// FeeScope — reseller fee & profit engine.
// Pure ESM. Importable in the browser and in Node (for tests).
// All monetary values are in USD. Percentages are stored as percent numbers (6.5 = 6.5%).
//
// ============================================================================
// ASSUMPTIONS — READ THIS. Fee schedules change frequently and vary by country,
// category, seller plan, store tier and buyer location. The defaults below are
// U.S. approximations captured for 2026 and are deliberately configurable. ALWAYS
// confirm current fees with the marketplace before relying on the numbers.
//
//  • Etsy:     $0.20 listing fee per item listed/renewed; 6.5% transaction fee on
//              the item price + shipping charged; payment processing ~3% + $0.25
//              per order (Etsy Payments varies by country, e.g. ~4% + fixed in some
//              regions). Offsite ads add 12–15% on attributed orders — set "ad rate".
//  • eBay:     ~13.25% final value fee on item + shipping for most categories
//              (many categories differ, e.g. ~6–15%); $0.30 per-order fee; an
//              optional store subscription can be allocated per order.
//  • Amazon FBA: 15% referral fee on the total sales price (with a $0.30 per-item
//              minimum for most categories); a per-unit FBA fulfillment fee and a
//              per-unit storage fee. Both vary by size, weight and season.
//  • Custom:   any percentage + fixed fee, for other marketplaces or processors.
//
// SIMPLIFICATIONS (documented so the output is honest):
//  • "quantity" is treated as the number of units sold, each as its OWN order. This
//    makes per-order fixed fees apply per unit — the conservative default for a
//    reseller shipping individual items. A single multi-unit order would cost less.
//  • The ad rate is applied to item price + shipping as an approximation of ad or
//    offsite-ad cost (real ad spend is often per-click, not per-sale).
//  • The optional tax rate is applied only to positive pre-tax profit. It is a flat
//    income-tax approximation, not a full tax calculation.
// ============================================================================

export const MARKETPLACES = {
  etsy: {
    id: 'etsy',
    label: 'Etsy',
    config: {
      listingFee: 0.20,
      transactionPct: 6.5,
      paymentPct: 3,
      paymentFixed: 0.25,
    },
  },
  ebay: {
    id: 'ebay',
    label: 'eBay',
    config: {
      finalValuePct: 13.25,
      fixedPerOrder: 0.30,
      storeFeePerOrder: 0,
    },
  },
  amazon: {
    id: 'amazon',
    label: 'Amazon FBA',
    config: {
      referralPct: 15,
      referralMin: 0.30,
      fulfillmentPerUnit: 3.50,
      storagePerUnit: 0.10,
    },
  },
  custom: {
    id: 'custom',
    label: 'Custom / other',
    config: {
      customPct: 10,
      customFixed: 0.30,
    },
  },
};

export const DEFAULT_INPUT = {
  marketplace: 'etsy',
  salePrice: 25,
  shippingCharged: 0,
  shippingCost: 4,
  itemCost: 8,
  quantity: 1,
  adRate: 0,
  taxRate: 0,
};

/** Fresh copy of the default fee configuration for a marketplace. */
export function defaultConfig(marketplace) {
  const m = MARKETPLACES[marketplace] || MARKETPLACES.custom;
  return { ...m.config };
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function normalize(input) {
  const raw = input || {};
  const i = { ...DEFAULT_INPUT, ...raw };
  for (const k of ['salePrice', 'shippingCharged', 'shippingCost', 'itemCost', 'quantity', 'adRate', 'taxRate']) {
    i[k] = num(i[k]);
  }
  if (!MARKETPLACES[i.marketplace]) i.marketplace = 'custom';
  const base = defaultConfig(i.marketplace);
  const overrides = raw.config || {};
  const cfg = {};
  for (const k of Object.keys(base)) cfg[k] = num(overrides[k] === undefined ? base[k] : overrides[k]);
  i.config = cfg;
  return i;
}

// Core math on already-normalized input. Does not compute break-even.
function core(i) {
  const q = i.quantity;
  const c = i.config;
  const revenuePerUnit = i.salePrice + i.shippingCharged;
  const grossRevenue = revenuePerUnit * q;
  const cogs = i.itemCost * q;
  const shippingCost = i.shippingCost * q;

  const fees = [];
  const add = (key, label, amount, note) => fees.push({ key, label, amount, note });

  switch (i.marketplace) {
    case 'etsy': {
      add('listingFee', 'Listing fee', c.listingFee * q,
        `$${c.listingFee.toFixed(2)} per listing/item`);
      add('transactionFee', 'Transaction fee', c.transactionPct / 100 * grossRevenue,
        `${c.transactionPct}% of item + shipping`);
      add('paymentProcessing', 'Payment processing',
        c.paymentPct / 100 * grossRevenue + c.paymentFixed * q,
        `${c.paymentPct}% + $${c.paymentFixed.toFixed(2)} per order`);
      break;
    }
    case 'ebay': {
      add('finalValueFee', 'Final value fee', c.finalValuePct / 100 * grossRevenue,
        `${c.finalValuePct}% of item + shipping`);
      add('perOrderFee', 'Per-order fee', c.fixedPerOrder * q,
        `$${c.fixedPerOrder.toFixed(2)} per order`);
      if (c.storeFeePerOrder > 0) {
        add('storeFee', 'Store subscription (allocated)', c.storeFeePerOrder * q,
          `$${c.storeFeePerOrder.toFixed(2)} per order`);
      }
      break;
    }
    case 'amazon': {
      let referral = c.referralPct / 100 * grossRevenue;
      const minReferral = c.referralMin * q;
      if (referral < minReferral) referral = minReferral;
      add('referralFee', 'Referral fee', referral,
        `${c.referralPct}% of total sales price (min $${c.referralMin.toFixed(2)}/unit)`);
      add('fulfillmentFee', 'FBA fulfillment', c.fulfillmentPerUnit * q,
        `$${c.fulfillmentPerUnit.toFixed(2)} per unit`);
      add('storageFee', 'FBA storage', c.storagePerUnit * q,
        `$${c.storagePerUnit.toFixed(2)} per unit`);
      break;
    }
    default: {
      add('percentFee', 'Percentage fee', c.customPct / 100 * grossRevenue,
        `${c.customPct}% of item + shipping`);
      add('fixedFee', 'Fixed fee', c.customFixed * q,
        `$${c.customFixed.toFixed(2)} per order`);
    }
  }

  const adFee = i.adRate / 100 * grossRevenue;
  add('adFee', 'Ad / offsite ad fee', adFee, `${i.adRate}% of item + shipping`);

  const totalFees = fees.reduce((s, f) => s + f.amount, 0);
  const netProceeds = grossRevenue - totalFees;
  const profit = netProceeds - cogs - shippingCost;
  const tax = profit > 0 ? profit * i.taxRate / 100 : 0;
  const profitAfterTax = profit - tax;
  const marginPct = grossRevenue > 0 ? profit / grossRevenue * 100 : 0;
  const totalCost = cogs + shippingCost + totalFees;
  const roiOnCost = i.itemCost > 0 ? profit / (i.itemCost * q) * 100 : null;
  const roiOnTotalCost = totalCost > 0 ? profit / totalCost * 100 : null;

  const perUnit = q > 0 ? {
    salePrice: i.salePrice,
    shippingCharged: i.shippingCharged,
    revenue: revenuePerUnit,
    itemCost: i.itemCost,
    shippingCost: i.shippingCost,
    fees: fees.map(f => ({ ...f, amount: f.amount / q })),
    totalFees: totalFees / q,
    netProceeds: netProceeds / q,
    profit: profit / q,
  } : null;

  return {
    inputs: i,
    marketplace: i.marketplace,
    quantity: q,
    grossRevenue,
    cogs,
    shippingCost,
    fees,
    totalFees,
    netProceeds,
    profit,
    tax,
    profitAfterTax,
    marginPct,
    roiOnCost,
    roiOnTotalCost,
    breakEvenPrice: null,
    perUnit,
  };
}

function profitAtPrice(normalized, price) {
  return core({ ...normalized, salePrice: price }).profit;
}

// Numeric break-even: the per-unit sale price at which profit = 0, holding all
// other inputs fixed. Profit is non-decreasing in price, so bisection is reliable.
function solveBreakEven(i) {
  if (i.quantity <= 0) return null;
  let hi = Math.max(i.salePrice * 2, 10);
  let guard = 0;
  while (profitAtPrice(i, hi) < 0 && guard++ < 60) hi *= 2;
  if (profitAtPrice(i, hi) < 0) return null;
  let lo = 0;
  for (let n = 0; n < 200; n++) {
    const mid = (lo + hi) / 2;
    if (profitAtPrice(i, mid) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Compute the full fee/profit breakdown for a sale or batch.
 * @param {object} input  salePrice, shippingCharged, shippingCost, itemCost,
 *                        quantity, marketplace, adRate, taxRate, config
 * @param {object} [opts] solveBreakEven=false skips the numeric solve (faster for
 *                        batch work; breakEvenPrice is null). Defaults to true.
 * @returns {object} itemized fees, totals, profit, margin, ROI, break-even, per-unit.
 */
export function computeFees(input, opts = {}) {
  const i = normalize(input);
  const r = core(i);
  r.breakEvenPrice = opts.solveBreakEven === false ? null : solveBreakEven(i);
  return r;
}
