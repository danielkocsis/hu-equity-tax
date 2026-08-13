# 014 — App Bootstrap, Mode Toggle, and Disclaimer

**Blocking:** none  
**Blocked by:** 001, 002, 007, 008, 009, 010, 011, 012

## Context
Read `SPEC.md §6.1` (page structure), `§6.2` (modes), `§6.10` (disclaimer), `§6.11` (data management).  
Read `AGENTS.md` (app.js bootstrap, Modes section, defensive design).

## Goal
Wire up the full application: app bootstrap, current-year vs önellenőrzés mode toggle, disclaimer, and clear-data button.

## Deliverables

### `js/app.js`
- On DOMContentLoaded:
  1. `loadLang()` → `renderAll()` (i18n)
  2. `restore()` (ledger — happens automatically on import)
  3. Determine mode: read `localStorage` key `hu_equity_tax_mode`; default `"current"`
  4. Set default tax year: `new Date().getFullYear()`
  5. In `"current"` mode: show `#advance` section, hide `#self-audit`
  6. In `"onellenorzes"` mode: show year dropdown (2021–2025), show `#self-audit`, hide `#advance`
  7. Initialise all UI modules: lang-toggle, transaction-form, ledger-table, results-panel, advance-panel or self-audit-panel, payment-guide
  8. Wire `#mode-toggle` button
  9. Wire "Clear all data" button (calls `ledger.clear()`, reloads page)

### Mode toggle behaviour
- Current year: label `data-i18n="mode.current"` / `"mode.onellenorzes"`
- Switching mode: saves to `localStorage` key `hu_equity_tax_mode`; re-renders relevant sections
- In önellenőrzés mode: show a year selector (2021–2025); selected year drives all calculations

### Disclaimer banner
- Rendered in `<header>`; never removable
- HU text: from `locales/hu.json` key `"disclaimer"`
- EN text: from `locales/en.json` key `"disclaimer"`
- Both texts shown simultaneously (not toggled with language — show both for maximum clarity), or shown in the active language with a persistent style that makes it unmissable

### Clear data button (in `<footer>`)
- Shows `confirm()` dialog with bilingual text before clearing
- On confirm: calls `ledger.clear()`, clears `hu_equity_tax_adoid` from localStorage, reloads page

### Done conditions
- [ ] Default mode is current year; default tax year is the current calendar year
- [ ] Toggling to önellenőrzés shows the year selector and the self-audit panel
- [ ] Mode persists across page refresh
- [ ] Disclaimer is always visible regardless of scroll position or language
- [ ] "Clear all data" with confirmation clears everything and reloads
- [ ] Cancel on the confirmation dialog does nothing
