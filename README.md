# FeeScope — free reseller fee & profit calculator

**Live: https://lowlune.github.io/feescope/**

FeeScope estimates the fees a marketplace charges and what you actually keep. Enter a sale
price and cost, pick a marketplace, and see itemized fees, net proceeds, profit, margin, ROI,
and the break-even price.

- No signup, no tracking, no server — all math runs in your browser.
- Shareable URLs: every input is saved in the query string.
- CSV export of the itemized results.
- Every rate is configurable, so you can update a marketplace's schedule when it changes.

## Supported marketplaces

Etsy · eBay · Amazon FBA · Poshmark · Depop · Shopify · custom

## Free calculators

- [Reseller fee & profit calculator](https://lowlune.github.io/feescope/) — all marketplaces
- [Etsy fee calculator](https://lowlune.github.io/feescope/etsy-fee-calculator.html)
- [eBay fee calculator](https://lowlune.github.io/feescope/ebay-fee-calculator.html)
- [Amazon FBA calculator](https://lowlune.github.io/feescope/amazon-fba-calculator.html)
- [Print-on-demand profit calculator](https://lowlune.github.io/feescope/print-on-demand-profit-calculator.html)
- [Poshmark fee calculator](https://lowlune.github.io/feescope/poshmark-fee-calculator.html)
- [Depop fee calculator](https://lowlune.github.io/feescope/depop-fee-calculator.html)
- [Shopify fee calculator](https://lowlune.github.io/feescope/shopify-fee-calculator.html)

Each landing page's worked example is computed at build time by the same tested engine.

## Accuracy & testing

```bash
node test-fees.mjs   # 66 assertions over the fee engine (all marketplaces + custom)
node check-ids.mjs   # verifies every element id the UI expects is present
```

Marketplace fee schedules change over time; every rate is editable in the app and the defaults
are documented with their simplifications in `fees.js`.

## Develop

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Files

- `index.html` — the free calculator app
- `fees.js` — pure, tested fee engine (marketplace profiles + custom)
- `app.js` — UI wiring, itemized results, CSV export
- `*-calculator.html` — SEO landing pages with build-time worked examples
- `styles.css`

## FeeScope Pro

FeeScope Pro is an offline, self-contained HTML batch console: import a CSV catalog, compute
itemized fees, profit, margin and ROI per row, solve the break-even price per SKU, and price to
a target profit or margin across all supported marketplaces with a sortable comparison table.
It is a separate paid download; this repository contains only the free web tool.

## Related

- [RentScope](https://lowlune.github.io/rentscope/) — free rental property calculator.

## Disclaimer

Educational estimation only — marketplace rates are approximate and configurable; not tax or
accounting advice.

MIT licensed (free web tool only).
