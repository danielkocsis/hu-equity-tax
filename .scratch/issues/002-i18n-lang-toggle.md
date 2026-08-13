# 002 — i18n and Language Toggle

**Blocking:** 003, 004, 005, 006, 007, 008, 009, 010, 011, 012  
**Blocked by:** 001

## Context
Read `AGENTS.md` (i18n conventions section) and `SPEC.md §6.10` before starting.

## Goal
Implement the full i18n system so that all `data-i18n` attributes in the DOM are driven by locale JSON files, and the HU/EN toggle works without page reload.

## Deliverables

### `locales/en.json` and `locales/hu.json`
Populate with ALL UI strings required by `SPEC.md`. Key structure: flat dot-separated keys. Examples:
```json
{
  "nav.title.hu": "Részvényadó Kalkulátor",
  "nav.title.en": "Equity Tax Calculator",
  "nav.subtitle.hu": "Segítség a külföldi részvényjuttatások magyar adózásához",
  "nav.subtitle.en": "Help with Hungarian taxation of foreign equity awards",
  "disclaimer.hu": "Ez az eszköz ingyenes, nyílt forráskódú számológép, nem adótanácsadás...",
  "disclaimer.en": "This tool is a free, open-source calculator, not professional tax advice...",
  "form.event_type.label": "...",
  "form.event_type.rsu_vest.hu": "RSU juttatás (vesting)",
  "form.event_type.rsu_vest.en": "RSU Vesting",
  ...
}
```

### `js/i18n.js`
- `loadLang(code)` — fetches `locales/{code}.json`, caches in module-level Map
- `t(key)` — returns the string for the current language, falls back to the key if missing
- `setLang(code)` — sets current lang, saves to `localStorage` key `hu_equity_tax_lang`, calls `renderAll()`
- `renderAll()` — iterates all `[data-i18n]` elements, sets `textContent = t(element.dataset.i18n)`
- On module load: reads `localStorage` for saved language; defaults to `"hu"`

### `js/ui/lang-toggle.js`
- Wires `#lang-toggle` button click to call `setLang()` toggling between `"hu"` and `"en"`
- Updates button label to show the OTHER language (i.e. shows "EN" when HU is active)

### `js/app.js`
- Calls `loadLang()` then `renderAll()` on DOMContentLoaded
- Initialises lang-toggle

### Done conditions
- [ ] Clicking the toggle switches ALL `data-i18n` text on the page without reload
- [ ] Language choice persists across page refreshes (localStorage)
- [ ] `t("missing.key")` returns `"missing.key"` (no crash)
- [ ] No hardcoded visible strings in any JS or HTML file
