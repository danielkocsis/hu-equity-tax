# 001 — Project Scaffold

**Blocking:** nothing  
**Blocked by this:** 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 014

## Context
Read `AGENTS.md` and `SPEC.md` before starting. This ticket sets up the bare repository structure that all subsequent tickets build on.

## Goal
Create the skeleton directory layout and entry-point files with no logic — just structure, wiring, and empty module stubs.

## Deliverables

### Directory structure
```
hu-equity-tax/
├── index.html
├── css/style.css
├── js/
│   ├── app.js
│   ├── i18n.js
│   ├── tax-engine.js
│   ├── fx-engine.js
│   ├── ledger.js
│   ├── lot-tracker.js
│   ├── advance-tax.js
│   ├── self-audit.js
│   ├── eszja-mapper.js
│   ├── payment-guide.js
│   ├── stock-lookup.js
│   └── ui/
│       ├── transaction-form.js
│       ├── lot-form.js
│       ├── ledger-table.js
│       ├── results-panel.js
│       ├── advance-panel.js
│       ├── self-audit-panel.js
│       └── lang-toggle.js
├── data/
│   ├── tax-rules.json        (empty object `{}` for now)
│   ├── eszja-schema.json     (empty object `{}` for now)
├── locales/
│   ├── en.json               (empty object `{}` for now)
│   └── hu.json               (empty object `{}` for now)
└── .github/workflows/        (empty dir, workflows come in ticket 013)
```

### `index.html`
- Single HTML5 page with semantic sections: `<header>`, `<main>`, `<footer>`
- All section IDs as anchors: `#year-selector`, `#add-event`, `#ledger`, `#results`, `#eszja-map`, `#advance`, `#payment`
- `<script type="module" src="js/app.js"></script>` at end of body
- `data-i18n` attributes on all visible text nodes (use placeholder key strings)
- Permanent disclaimer banner inside `<header>` with `data-i18n="disclaimer"` on both HU and EN spans
- Language toggle button `<button id="lang-toggle">`
- Mode toggle `<button id="mode-toggle">` (Current Year / Önellenőrzés)

### `css/style.css`
- CSS custom properties (variables) for: `--color-primary`, `--color-warning`, `--color-danger`, `--color-text`, `--color-bg`, `--color-surface`, `--spacing-sm`, `--spacing-md`, `--spacing-lg`, `--font-size-base`, `--border-radius`
- Reset: `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`
- Responsive single-column layout with `max-width: 900px; margin: 0 auto; padding: var(--spacing-md)`
- Basic section styling, card style for `.card` class
- Print media query stub

### JS stub files
Each JS file exports an empty named function or object matching its contract from `AGENTS.md`:
- `app.js`: `export function init() {}` — will bootstrap everything
- `i18n.js`: `export function t(key) { return key; }` `export function setLang(code) {}`
- All other JS files: export their named functions as empty stubs returning `null`

### Done conditions
- [ ] `index.html` opens in a browser without errors (empty page is fine)
- [ ] All JS files importable as ES modules without syntax errors
- [ ] No external dependencies introduced
