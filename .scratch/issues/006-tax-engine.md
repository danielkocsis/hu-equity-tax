# 006 — Tax Engine

**Blocking:** 009, 010  
**Blocked by:** 001, 003, 005

## Context
Read `AGENTS.md` (tax-engine.js module contract and Tax engine rules section).  
Read `TAX-ANALYSIS.md §3` (event rules), `§5.1` (SZOCHO rates), `§5.2` (SZOCHO by income type), `§5.3` (dividend cap), `§10` (US DTT).  
`data/tax-rules.json` must be populated (ticket 003) before testing.

## Goal
Implement `js/tax-engine.js` — the core calculation module. All tax math lives here and nowhere else.

## Deliverables

### `js/tax-engine.js`

**`getSzochoRate(dateStr, rules)`**  
- Iterates `rules.szocho_rates` array
- Returns the rate whose `from`–`to` range includes `dateStr`
- Throws if no matching range found (data error)

**`calculateEvent(tx, rules)`**  
Returns `{ szja_huf, szocho_huf, tb_huf, tax_base_huf, warnings }` where `warnings` is a string array.

Rules per event type (from `TAX-ANALYSIS.md §3` and `AGENTS.md`):

| type | tax_base_huf | SZJA | SZOCHO | TB |
|---|---|---|---|---|
| RSU_VEST, ESOP_EXERCISE, ESPP_PURCHASE, SHARE_AWARD | gross_huf × 0.89 | 15% × tax_base | getSzochoRate(date) × tax_base | tb_applies ? 18.5% × gross_huf : 0 |
| SHARE_SALE | net_gain (from lot-tracker) | 15% × max(gain,0) | 0 | 0 |
| DIVIDEND (EGT source) | gross_huf | 15% × gross | 0 (EGT exempt) | 0 |
| DIVIDEND (non-EGT, e.g. US) | gross_huf | 15% × gross | 13% × gross (subject to cap) | 0 |

Warnings to generate:
- US equity event with date ≥ 2024-01-01 and `!rules.us_hu_dtt_active` → `"US-HU DTT terminated 2024. No quarterly advance required. Full HU taxes apply."`
- US equity event with date < 2024-01-01 → `"US-HU DTT was active. A foreign tax credit may be available — consult a tax adviser."`
- UK equity event → `"UK-HU DTT applies. A foreign tax credit may be available — consult a tax adviser."`
- Any pre-2016 date → `"MNB rate not available in automated data. Manual entry required."`

**`aggregateYear(txList, year, rules, priorYearLosses)`**  
Returns `{ szja_total, szocho_total, tb_total, etü_net_gain, etü_loss_declared, dividend_szocho_used, dividend_szocho_cap, warnings }`.

- Sum all events for the year
- Apply SZOCHO dividend cap: `rules.szocho_dividend_cap_multiplier × rules.min_monthly_wage_huf`; stop accumulating dividend SZOCHO once cap is reached
- ETÜ: net = Σgains − Σlosses − Σfees; SZOCHO = 0
- Prior-year ETÜ loss offset: see adókiegyenlítés rules in `TAX-ANALYSIS.md §7a`; calculate credit = min(etü_tax_paid_frame, loss_credit_entitlement); but do NOT apply it automatically — return it as `etü_loss_credit_available` for the UI to display

### Done conditions
- [ ] RSU_VEST: gross 1,000,000 HUF, 2024, non-UK/US → tax_base = 890,000; SZJA = 133,500; SZOCHO = 115,700
- [ ] DIVIDEND non-EGT: 500,000 HUF → SZJA = 75,000; SZOCHO = 65,000 (if cap not reached)
- [ ] DIVIDEND EGT: 500,000 HUF → SZJA = 75,000; SZOCHO = 0
- [ ] SHARE_SALE gain 200,000 HUF → SZJA = 30,000; SZOCHO = 0
- [ ] SZOCHO dividend cap stops accumulation correctly at 24 × min_monthly_wage_huf
- [ ] US event ≥ 2024 generates the DTT termination warning
