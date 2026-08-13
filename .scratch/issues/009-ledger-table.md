# 009 — Ledger Table UI

**Blocking:** 011  
**Blocked by:** 001, 002, 006, 007

## Context
Read `SPEC.md §6.4` (Ledger table spec).  
Read `AGENTS.md` (ledger-table.js contract).

## Goal
Implement the transaction ledger table, grouped by tax year, with edit/delete actions.

## Deliverables

### `js/ui/ledger-table.js`
- Renders into `<section id="ledger">`
- Listens for `ledger:changed` custom event on document; re-renders on change
- Groups transactions by `tax_year`, sorted descending (most recent year first)
- Within each year group: transactions sorted by `date` descending
- Columns: Date | Event type (i18n label) | Source country | Currency | Foreign amount | MNB rate | HUF gross | SZJA | SZOCHO
- SZJA and SZOCHO are computed live by calling `calculateEvent(tx, rules)` for each row — import from `tax-engine.js`
- **Edit button**: emits `ledger:edit` custom event with the transaction as detail; `transaction-form.js` listens and repopulates
- **Delete button**: calls `ledger.remove(id)`, emits `ledger:changed`
- If ledger is empty: show a `data-i18n="ledger.empty"` placeholder message

### Done conditions
- [ ] Adding a transaction via the form causes the table to re-render automatically
- [ ] Transactions are correctly grouped by tax year with year headings
- [ ] Clicking Edit repopulates the form with correct values
- [ ] SZJA and SZOCHO columns show correct computed values
- [ ] Empty ledger shows the placeholder text (bilingual)
