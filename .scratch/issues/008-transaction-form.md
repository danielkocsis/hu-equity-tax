# 008 — Transaction Form UI

**Blocking:** 011  
**Blocked by:** 001, 002, 005, 007

## Context
Read `SPEC.md §6.3` (Add Event form fields spec) and `AGENTS.md` (transaction-form.js, lot-form.js).  
Read `AGENTS.md` (defensive design principle — MNB rate field requirements).

## Goal
Implement the Add Event form that collects a transaction and adds it to the ledger.

## Deliverables

### `js/ui/transaction-form.js`
- Renders into `<section id="add-event">`
- Fields per `SPEC.md §6.3`
- On event type change: show/hide fields relevant to that type (SHARE_SALE shows lot sub-form; ESOP shows strike price)
- On date + currency change: calls `getRate()` from fx-engine; displays result per defensive UX rules:
  - Rate value and `date_used`
  - If fallback: shows "⚠️ Fallback from [date]" in warning style
  - **Always shows** "Verify on MNB →" link (`https://www.mnb.hu/arfolyamok`, target="_blank")
  - **Always shows** bilingual liability note (from i18n)
  - **Always shows** override input — never hidden
- If `requires_manual: true`: hides auto-filled rate, shows manual input only + link to MNB page
- "Look up price" button (for FMV fields): calls `stock-lookup.js`, pre-fills field as hint; always shows "Verify on Yahoo Finance →" link and bilingual liability note; field stays editable
- "Add event" button: validates required fields, calls `ledger.add()`, emits a custom event `ledger:changed` on the document, resets the form
- Advanced section (collapsed by default): TB applies checkbox with tooltip

### `js/ui/lot-form.js`
- Rendered inside the SHARE_SALE form section
- Repeater: "Add lot" button adds a row
- Each lot row: vest date, quantity (number), FMV at vest (number, foreign currency), MNB rate at vest (auto-filled from fx-engine, same defensive UX rules as main form)
- "Remove" button per row
- Computes and displays `cost_basis_huf` per lot inline: `fmv × quantity × mnb_rate`

### Done conditions
- [ ] Selecting "RSU Vesting" shows the correct fields; selecting "Share Sale" shows the lot sub-form
- [ ] MNB rate auto-fills on date change and shows "Verify on MNB" link
- [ ] Adding a transaction fires `ledger:changed` and the form resets
- [ ] Override input is always visible and its value takes precedence
- [ ] "Add event" with empty required fields shows inline validation errors (no `alert()`)
