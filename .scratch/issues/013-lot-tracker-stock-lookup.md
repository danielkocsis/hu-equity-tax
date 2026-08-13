# 013 — Lot Tracker and Stock Lookup

**Blocking:** 006, 008  
**Blocked by:** 001

## Context
Read `AGENTS.md` (lot-tracker.js and stock-lookup.js module contracts).  
Read `TAX-ANALYSIS.md §3.6` (ETÜ FIFO cost basis rules).  
Read `AGENTS.md` defensive design — stock lookup is a hint only; always show verify link and liability note.

## Goal
Implement FIFO lot tracking for ETÜ cost basis and the Yahoo Finance price hint lookup.

## Deliverables

### `js/lot-tracker.js`

```js
/**
 * Applies FIFO to consume sell_quantity from lots (sorted by vest_date ascending).
 * Returns { consumed_lots, remaining_lots, total_cost_basis_huf, gain_huf }
 * gain_huf = sale_proceeds_huf - total_cost_basis_huf - broker_fee_huf
 */
export function applyFifo(lots, sell_quantity, sale_proceeds_huf, broker_fee_huf) { ... }
```

- Sorts `lots` by `vest_date` ascending (oldest first)
- Consumes quantity from oldest lots; partial consumption of a lot is allowed
- `total_cost_basis_huf` = sum of `fmv_at_vest_foreign × quantity_consumed × mnb_rate_at_vest` per lot
- Returns `gain_huf` which can be negative (a loss)

### `js/stock-lookup.js`

```js
/**
 * Looks up the historical closing price for a ticker on or near a given date.
 * Uses Yahoo Finance unofficial API — convenience only, not authoritative.
 * Returns { price, currency, source_date, is_exact } or throws on failure.
 * NEVER call this automatically — only call on explicit user action.
 */
export async function lookupPrice(ticker, dateStr) { ... }
```

**Endpoint:**
`https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}?interval=1d&period1={unix}&period2={unix+3days}`

**On failure:** throw with a message that includes the Yahoo Finance direct URL:
`https://finance.yahoo.com/quote/{TICKER}/history/`

**UI contract (enforced by the calling component, not this module):**
- Result shown as pre-filled hint only
- "Verify on Yahoo Finance →" link always shown
- Bilingual liability note always shown
- Field always editable

### Done conditions
- [ ] `applyFifo([{vest_date:"2022-01-01", quantity:100, ...}, {vest_date:"2023-01-01", quantity:50, ...}], 120, ...)` consumes all 100 from 2022 lot and 20 from 2023 lot
- [ ] Gain = proceeds - cost_basis - broker_fee (can be negative)
- [ ] `lookupPrice("TSCO.L", "2024-08-13")` returns an object with `price` and `source_date`
- [ ] `lookupPrice("INVALID_TICKER_XYZ123", "2024-08-13")` throws with the Yahoo Finance URL in the message
