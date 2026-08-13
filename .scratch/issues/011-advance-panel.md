# 011 — Quarterly Advance Tax Panel

**Blocking:** 012  
**Blocked by:** 001, 002, 006, 007, 008, 009, 010

## Context
Read `SPEC.md §6.7` (Quarterly advance panel spec).  
Read `AGENTS.md` (advance-tax.js contract).  
Read `TAX-ANALYSIS.md §6` (quarterly advance rules — especially the DTT condition and the correct deadlines).

## Goal
Implement the quarterly advance tax panel shown in current-year mode.

## Deliverables

### `js/advance-tax.js`

```js
/**
 * Returns the quarterly SZJA and SZOCHO advance schedule for the given year.
 * Only processes employment/other income event types.
 * Returns empty array if no DTT is active for the source country.
 * @returns Array<{ quarter, period_label, deadline_iso, szja_due, szocho_due }>
 */
export function getAdvanceSchedule(txList, year, rules) { ... }
```

**Logic:**
1. Filter `txList` to current year and types: RSU_VEST, ESOP_EXERCISE, ESPP_PURCHASE, SHARE_AWARD
2. For each event, check DTT status for `tx.source_country`:
   - `"US"` + year ≥ 2024 + `!rules.us_hu_dtt_active` → exclude from advance (no DTT)
   - `"UK"` + `rules.uk_hu_dtt_active` → include
   - `"EU"` or `"OTHER"` → include (assume DTT or equivalent)
3. Group included events by quarter (Q1: Jan–Mar, Q2: Apr–Jun, Q3: Jul–Sep, Q4: Oct–Dec)
4. Per quarter: sum SZJA and SZOCHO from `calculateEvent()`
5. Only emit a quarter if its cumulative SZJA > `rules.quarterly_advance_threshold_huf` (10,000 HUF)
6. Deadline: `rules.quarterly_advance_deadlines[i]` = `"04-12"` etc., formatted as `{year}-04-12` (Q4 deadline is next year)

### `js/ui/advance-panel.js`
- Renders into `<section id="advance">` (shown only in current-year mode)
- Listens for `ledger:changed`
- Shows a table: Quarter | Period | Deadline | SZJA advance | SZOCHO advance
- If no events qualify (no DTT, or all amounts below threshold): shows an info message instead
- For US events from 2024+: shows a specific note: *"No quarterly advance required for US-source income (US-HU DTT terminated 2024-01-01)"*
- Footer note with both NAV account numbers (SZJA and SZOCHO) and adóazonosító reminder

### Done conditions
- [ ] UK RSU vest of 1M HUF in Q1 generates April 12 deadline with correct SZJA and SZOCHO amounts
- [ ] US RSU vest in 2024 generates NO quarterly advance entry; shows the DTT termination note
- [ ] Amounts below 10,000 HUF threshold do not generate an advance entry
- [ ] Q4 deadline correctly uses January 12 of the FOLLOWING year
