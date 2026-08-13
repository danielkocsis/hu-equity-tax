# 010 — eSZJA Mapper and Results Panel

**Blocking:** 011  
**Blocked by:** 001, 002, 003, 006

## Context
Read `SPEC.md §6.5` (Results panel) and `§6.6` (eSZJA mapper).  
Read `AGENTS.md` (eszja-mapper.js contract).  
Read `TAX-ANALYSIS.md §11` (eSZJA row mapping).  
Read `AGENTS.md` (defensive design — every tax rule must cite its legal source with a link).

## Goal
Implement the results panel and eSZJA mapper that shows per-year tax totals and which rows to fill in the eSZJA return.

## Deliverables

### `js/eszja-mapper.js`
- Loads `data/eszja-schema.json` lazily (fetch once, cache)
- `mapResults(aggregated, year)` → `[{ row_id, form, label_hu, label_en, value_huf, copy_text }]`
- Only emits rows with non-zero values, **except** ETÜ loss — always emit if `etü_loss_declared > 0`
- `copy_text` = the HUF amount formatted as a Hungarian integer string

### `js/ui/results-panel.js`
- Renders into `<section id="results">`
- Listens for `ledger:changed`; re-renders
- For each tax year in the ledger (call `getYears()`):
  - Card heading: tax year
  - SZJA total (HUF)
  - SZOCHO total (HUF)
  - TB total (if any)
  - ETÜ net result + carry-forward status
  - Dividend SZOCHO used / cap / remaining
  - Warning banners from `aggregateYear().warnings`

**eSZJA mapper sub-section (in results panel):**
- Table: Row ID | Form section | Description (bilingual) | HUF amount | Copy button
- Each row links its legal basis: e.g. "sor 19" row shows a note citing Szja tv. §28 with a link
- "Copy" button: `navigator.clipboard.writeText(copy_text)`, shows "✓ Copied" for 2s

**Legal citation requirement (from `AGENTS.md`):**
Each result row must display the applicable law reference. Minimum:
- Equity income: `Szja tv. §28` with link to `https://net.jogtar.hu/jogszabaly?docid=99500117.TV`
- ETÜ: `Szja tv. §67/A` with link
- Dividend: `Szja tv. §66` with link
- SZOCHO: `Szoctv. §2` with link to `https://net.jogtar.hu/jogszabaly?docid=a1800052.tv`

### Done conditions
- [ ] Adding a 1,000,000 HUF RSU vest (2024, non-EGT/US) shows SZJA = 133,500, SZOCHO = 115,700
- [ ] eSZJA mapper shows sor 19 with the correct amount and a copy button
- [ ] Copy button copies the correct number
- [ ] Legal source links are present for each row
- [ ] Zero-value rows are hidden (except ETÜ loss if declared)
