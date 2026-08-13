# AGENTS.md — HU-EquityTax

> Primary instruction set for any AI coding agent working on this repository.
> Read this file AND `TAX-ANALYSIS.md` fully before touching any file.
> This file takes precedence over all agent defaults.

---

## Project in one sentence

A free, 100% client-side static SPA (GitHub Pages) that helps Hungarian tax subjects calculate and self-declare SZJA and SZOCHO on equity compensation received from a foreign "kifizető", guides quarterly advance payments, and supports self-audit (önellenőrzés) for closed years.

---

## Defensive Design Principle

> **The app is a calculation aid, not a tax solution. It must never overstate its own authority.**

This principle governs every feature decision:

1. **Cite the law, not just the result.** Every tax rule shown to the user must link to the relevant Szja tv. / Szoctv. / Art. tv. paragraph on net.jogtar.hu. Users must be able to read the primary source themselves. See `TAX-ANALYSIS.md` for the canonical paragraph references.

2. **Prefer useful and correct over comprehensive and risky.** If a scenario is too complex to model correctly (e.g. multi-year önellenőrzés adókiegyenlítés cascade), show a clear explanation of what the app can calculate and direct the user to a tax adviser. Do not guess or approximate silently.

3. **Show your working.** Every computed number must be decomposable — the user can see the formula, the inputs, and the legal basis. No black-box results.

4. **Warn early, not late.** If a transaction has characteristics that affect correctness (US equity post-2024, EGT vs non-EGT dividend, önellenőrzés with adjacent ETÜ years), surface the warning at input time, not only on the results page.

5. **Önellenőrzés scope.** In önellenőrzés mode, each year is calculated independently. The app does NOT model cascading amendments across years. If the user has ETÜ data in adjacent years, a banner explains that consistency across multiple amended returns is their responsibility and recommends a tax adviser.

6. **No stored personal data beyond the session.** The adóazonosító jel is stored only in `localStorage` as a convenience pre-fill and is never transmitted. No analytics. No telemetry.

7. **Defer to official NAV calculators rather than reimplement them.** If NAV provides an official online calculator for a value (e.g. késedelmi pótlék, önellenőrzési pótlék), the app must **link to it rather than replace it**. A clearly labelled link is always preferable to an in-app approximation that could diverge from NAV's own computation and destroy user trust. The app may show an indicative estimate with a prominent "estimate only" label, but the call-to-action must always be the official NAV tool. Known NAV calculators:
   - **Pótlékszámítás** (késedelmi pótlék + önellenőrzési pótlék): `https://nav.gov.hu/ugyfeliranytu/eljarasi_kerdesek/Kalkulatorok/potlekszamitas`
   - **Ingatlanértékesítés kalkulátor**: not in scope
   - **Általános adónaptár**: `https://nav.gov.hu/ugyfeliranytu/adonaptar` (for deadline confirmation)

---

## Authoritative sources

| File | Role |
|---|---|
| `TAX-ANALYSIS.md` | **Single source of truth for all tax rules, rates, formulas, eSZJA rows, and NAV payment details.** Always read this before implementing any tax logic. |
| `SPEC.md` | Product specification: scope, UX layout, personas, roadmap, branding, glossary. |
| `AGENTS.md` | This file: stack constraints, repo layout, coding conventions, data schemas, module contracts. |

Do not rely on tax rule data from any other file, conversation history, or general knowledge. `TAX-ANALYSIS.md` is the authority.

---

## Stack — hard constraints

| Constraint | Rule |
|---|---|
| **Framework** | None. Vanilla HTML5 + CSS3 + ES Modules only. No React, Vue, Svelte, Angular. No bundler. |
| **CSS** | Vanilla CSS with custom properties. No Tailwind, no Bootstrap, no external CSS. |
| **Dependencies** | Zero npm runtime dependencies. |
| **No GPL libraries** | Do not introduce any GPL or LGPL licensed library. |
| **No paid APIs** | All external data sources must be free and key-free at runtime. |
| **Module format** | ES Modules (`type="module"`). No CommonJS. No `window.*` pollution. |
| **No build step** | The app must deploy by copying the repo to GitHub Pages as-is. No compilation required. |

---

## Repository layout

```
hu-equity-tax/
├── index.html                    # Single entry point; all sections in one scrolling page
├── css/
│   └── style.css                 # All styles; CSS custom properties for theming
├── js/
│   ├── app.js                    # Bootstrap: init i18n, restore localStorage, wire events
│   ├── i18n.js                   # t(key), setLang(code), localStorage language persistence
│   ├── tax-engine.js             # calculateEvent(), aggregateYear(), getSzochoRate()
│   ├── fx-engine.js              # getRate(currency, date), setManualRate(), fallback logic
│   ├── ledger.js                 # In-memory + localStorage transaction store
│   ├── lot-tracker.js            # FIFO lot management for ETÜ cost basis
│   ├── advance-tax.js            # Quarterly advance deadline + amount calculator
│   ├── self-audit.js             # Önellenőrzés delta + késedelmi kamat estimator
│   ├── eszja-mapper.js           # Maps aggregated results → eSZJA row objects
│   ├── payment-guide.js          # NAV payment card generator
│   ├── stock-lookup.js           # Yahoo Finance unofficial API price hint (user-triggered only)
│   └── ui/
│       ├── transaction-form.js   # Main event input form
│       ├── lot-form.js           # Lot sub-form (nested in SHARE_SALE)
│       ├── ledger-table.js       # Transaction list with edit/delete
│       ├── results-panel.js      # Annual tax summary + eSZJA row table
│       ├── advance-panel.js      # Quarterly advance deadlines panel
│       ├── self-audit-panel.js   # Önellenőrzés delta + interest panel
│       └── lang-toggle.js        # HU/EN switcher
├── data/
│   ├── tax-rules.json            # Per-year tax rates and thresholds — see TAX-ANALYSIS.md §5 for values
│   ├── eszja-schema.json         # Per-year eSZJA row IDs and labels — see TAX-ANALYSIS.md §11
│   └── mnb_fx_YYYY.json          # Pre-fetched MNB FX rates; one file per year (CI-generated)
├── locales/
│   ├── en.json                   # All English UI strings
│   └── hu.json                   # All Hungarian UI strings
├── .github/
│   └── workflows/
│       ├── mnb-fx-fetch.yml      # Daily cron: fetch MNB SOAP → update data/mnb_fx_YYYY.json
│       └── deploy.yml            # On push to main: deploy to gh-pages branch
├── AGENTS.md                     # This file
├── SPEC.md                       # Product specification
├── TAX-ANALYSIS.md               # Authoritative tax rule analysis (primary source)
└── README.md
```

---

## Coding conventions

- **Indentation:** 2 spaces. No tabs.
- **Trailing whitespace:** none. Files end with a single newline.
- **Variables:** `const` by default; `let` only when reassignment is necessary. Never `var`.
- **Exports:** named exports preferred; avoid default exports for non-trivial modules.
- **Documentation:** JSDoc comment on every exported function:
  ```js
  /**
   * Returns the applicable SZOCHO rate for a given date.
   * @param {string} dateStr - ISO date string (YYYY-MM-DD)
   * @param {object} rules - Tax rules object for the relevant year from tax-rules.json
   * @returns {number} SZOCHO rate as a decimal (e.g. 0.13)
   */
  export function getSzochoRate(dateStr, rules) { ... }
  ```
- **i18n:** Every user-visible string must come from `t(key)`. Never hardcode visible strings in JS or HTML. HTML elements carry `data-i18n="dot.separated.key"`.
- **Error handling:** Never silently swallow errors. Surface a bilingual inline warning in the UI when data fetches fail. Never use `alert()`.
- **Privacy:** Zero external calls at runtime except: `data/mnb_fx_YYYY.json` (same-origin static asset) and Yahoo Finance stock price hint (user-triggered only, never automatic).

---

## Data schemas

### `data/tax-rules.json` — shape per year

> For correct values of all fields, consult `TAX-ANALYSIS.md`. Do not invent or assume rates.

```jsonc
{
  "2024": {
    "szja_rate": 0.15,
    // szocho_rates: array of date-range objects — required because rate changed between years.
    // Use date-range lookup; never a flat annual value for years with transitions.
    "szocho_rates": [
      { "from": "2024-01-01", "to": "2024-12-31", "rate": 0.13 }
    ],
    "tb_rate": 0.185,                        // Employee TB; applied only when tb_applies = true
    "tax_base_multiplier": 0.89,             // Applied to gross HUF for összevont adóalap income
    "szocho_dividend_cap_multiplier": 24,    // 24 × min_monthly_wage_huf = annual SZOCHO cap for dividends
    "min_monthly_wage_huf": 266800,          // Garantált bérminimum for this year — verify from decree
    "us_hu_dtt_active": false,               // US-HU treaty terminated from 2024-01-01
    "uk_hu_dtt_active": true,                // UK-HU DTT (1977) still in force
    "etü_loss_carryforward_years": 2,
    // quarterly_advance_deadlines: MM-DD format; these are the deadlines for each quarter
    // Deadlines = 12th of the month FOLLOWING the quarter end (Apr, Jul, Oct, Jan)
    "quarterly_advance_deadlines": ["04-12", "07-12", "10-12", "01-12"],
    // mnb_base_rates: MNB jegybanki alapkamat per period — used for késedelmi pótlék estimation
    "mnb_base_rates": [
      { "from": "2024-01-01", "to": "2024-12-31", "rate": 0.10 }
    ],
    // késedelmi pótlék = delta_huf × ((mnb_base_rate + 0.05) / 365) × days_overdue  (Art. tv. 209.§(1))
    // önellenőrzési pótlék = 50% of késedelmi pótlék  (Art. tv.)
    "late_interest_formula": "base_rate_plus_5pp"  // sentinel value — do not change
  }
}
```

### `data/eszja-schema.json` — shape per year

> Row numbers change annually. Values below are from the 23SZJA form (2023 income year).
> Always verify against the current year's NAV kitöltési útmutató before release.
> Foreign dividend is **sor 182** (05-ös lap) — NOT sor 167 (which is domestic dividend).

```jsonc
{
  // All rows confirmed identical across 21SZJA, 22SZJA, 23SZJA, 24SZJA, 25SZJA.
  // Each tax year must have its own entry keyed by income year (e.g. "2024" = income earned in 2024).
  "2024": {
    // equity_income_row: RSU/ESOP/ESPP/share award from foreign kifizető with self-paid 13% SZOCHO + 89% multiplier
    // Confirmed from 21–25SZJA kitöltési útmutatók — verbatim identical wording, stable 2021–2025
    "equity_income_row": {
      "id": "19. sor", "form": "SZJA-A lap",
      "label_hu": "Egyéb jogcímen kapott jövedelem (13% SZOCHO, 89% adóalap)",
      "label_en": "Other income — equity award (13% SZOCHO, 89% tax base)"
    },
    // equity_income_row_no_szocho: rare edge case where kifizető withholds SZOCHO (no multiplier)
    "equity_income_row_no_szocho": {
      "id": "18. sor", "form": "24SZJA-A lap",
      "label_hu": "Egyéb jogcímen kapott jövedelem (SZOCHO nélkül)",
      "label_en": "Other income — equity award (no SZOCHO)"
    },
    "etü_gain_row": {
      "id": "172. sor d oszlop", "form": "24SZJA-04-es lap",
      "label_hu": "ETÜ jövedelem (nettó nyereség)",
      "label_en": "Controlled capital market gain (net)"
    },
    "etü_loss_row": {
      "id": "172. sor a oszlop", "form": "24SZJA-04-es lap",
      "label_hu": "ETÜ veszteség (deklarálandó az adókiegyenlítéshez!)",
      "label_en": "Controlled capital market loss (must declare to preserve carry-forward)"
    },
    "etü_tax_row": {
      "id": "172. sor e oszlop", "form": "24SZJA-04-es lap",
      "label_hu": "ETÜ adó (15% SZJA)",
      "label_en": "ETÜ tax (15% SZJA)"
    },
    "etü_offset_rows": {
      "ids": ["212", "213", "214", "216", "217", "218", "219", "220", "C75"],
      "form": "24SZJA-06-os lap + C lap",
      "label_hu": "Adókiegyenlítés (korábbi ETÜ veszteség levonása)",
      "label_en": "Loss offset credit from prior ETÜ years"
    },
    "dividend_row": {
      "id": "182. sor", "form": "24SZJA-05-ös lap",
      "label_hu": "Külföldről kapott osztalék",
      "label_en": "Foreign dividend income"
    },
    "szocho_dividend_row": {
      "id": "24SZJA-09-es lap", "form": "09-es lap",
      "label_hu": "SZOCHO bevallás (nem EGT részvény osztaléka után)",
      "label_en": "SZOCHO declaration (dividend from non-EGT listed shares)"
    }
  }
}
```

### Transaction object (in-memory / localStorage)

```jsonc
{
  "id": "uuid-v4",
  // type: one of the six canonical event types
  "type": "RSU_VEST|ESOP_EXERCISE|ESPP_PURCHASE|SHARE_AWARD|SHARE_SALE|DIVIDEND",
  "date": "YYYY-MM-DD",           // Event date (vest / exercise / purchase / sale / dividend credit)
  "tax_year": 2024,
  "source_country": "US|UK|EU|OTHER", // Determines DTT status and quarterly advance logic
  "currency": "USD|EUR|GBP|OTHER",
  "gross_foreign_amount": 1000.00, // For SHARE_SALE: total sale proceeds in foreign currency
  "mnb_rate_used": 370.50,
  "mnb_rate_overridden": false,    // true if user manually set the rate
  "gross_huf": 370500,
  "broker_fee_huf": 0,
  "tb_applies": false,             // Advanced: true only when HU employer is formal grantor
  "dtt_withholding_huf": null,     // Foreign tax withheld — informational only in Phase 1
  "notes": "",
  // lots: SHARE_SALE only — source lots for FIFO cost basis
  "lots": [
    {
      "vest_date": "2022-03-15",
      "quantity": 50,
      "currency": "USD",
      "fmv_at_vest_foreign": 142.30,
      "mnb_rate_at_vest": 356.20,
      "cost_basis_huf": 2532490    // Computed: fmv_at_vest_foreign × quantity × mnb_rate_at_vest
    }
  ]
}
```

`lots` is present only on `SHARE_SALE` events. All other event types omit it.

---

## Module contracts

### `tax-engine.js`
- All tax calculation logic lives here. Do not implement tax math in UI modules.
- `getSzochoRate(dateStr, rules)` → `number` — iterates `rules.szocho_rates` date ranges; returns applicable rate.
- `calculateEvent(tx, rules)` → `{ szja_huf, szocho_huf, tb_huf, tax_base_huf, notes[] }` — computes taxes for one transaction. See `TAX-ANALYSIS.md §3 and §12` for the full rule matrix per event type.
- `aggregateYear(txList, year, rules, priorYearLosses)` → `{ szja_total, szocho_total, etü_net, etü_loss, dividend_szocho_used, warnings[] }` — nets all events, applies SZOCHO dividend cap, applies ETÜ loss carry-forward.

**Key rules (from TAX-ANALYSIS.md — do not assume, read the source):**
- 89% multiplier applies to RSU/ESOP/ESPP/SHARE_AWARD (foreign kifizető model). NOT to SHARE_SALE or DIVIDEND.
- SZOCHO = 0 on ETÜ gains. SZOCHO = 0 on dividends from EGT-listed shares.
- Quarterly advance applies ONLY to income events where a DTT is active with the source country. US income from 2024+ has NO quarterly advance (no DTT).
- Deadlines: April 12, July 12, October 12, January 12 (month following the quarter).
- Késedelmi pótlék formula: `delta × ((mnb_base_rate + 0.05) / 365) × days` (Art. tv. 209.§(1)). Önellenőrzési pótlék = 50% of that.

### `fx-engine.js`
- `getRate(currency, dateStr)` → `{ rate, date_used, is_fallback, requires_manual }` — lazy-loads `mnb_fx_YYYY.json`, walks back up to 7 days for a rate. Returns `requires_manual: true` for dates before 2016.
- `setManualRate(currency, dateStr, rate)` — stores a user-supplied override; takes precedence over file lookup.
- **Every resolved rate must be displayed with:**
  1. The exact date whose rate was used (especially if fallback to a prior day)
  2. A **"Verify on MNB website →"** link to `https://www.mnb.hu/arfolyamok` opening in a new tab
  3. A short note: *"Ez egy kényelmi funkció. A helyes árfolyam megadásáért Ön felel. / This is a convenience feature. You are responsible for entering the correct rate."*
  4. An always-visible manual override input — never hide or collapse it

### `advance-tax.js`
- `getAdvanceSchedule(txList, year, rules)` → `[{ quarter, period, deadline, szja_due, szocho_due }]`
- Only processes RSU_VEST, ESOP_EXERCISE, ESPP_PURCHASE, SHARE_AWARD.
- Returns empty array if the source country has no active DTT for that year (check `rules.us_hu_dtt_active`, `rules.uk_hu_dtt_active`).
- Both `szja_due` and `szocho_due` are paid to their respective NAV accounts (SZJA: 10032000-06056353; SZOCHO: 10032000-06055912) by the same quarterly deadline. (Szoctv. 6.§(2) confirmed)
- Deadline format: ISO date string derived from `rules.quarterly_advance_deadlines`.

### `self-audit.js`
- `estimateKesedelmiPotlek({ delta_huf, original_deadline, payment_date, mnb_base_rates })` → `{ kesedelmi_huf, onellenorzes_huf, days_late, breakdown[] }`
- Formula: `delta × ((base_rate + 0.05) / 365) × days` per period (Art. tv. 209.§(1)). Önellenőrzési pótlék = 50% of késedelmi.

### `lot-tracker.js`
- `applyFifo(lots, sell_quantity)` → `{ consumed_lots[], remaining_lots[], total_cost_basis_huf }`
- Sorts lots by `vest_date` ascending; consumes oldest first.

### `eszja-mapper.js`
- Loads `eszja-schema.json` for the relevant tax year.
- `mapResults(aggregated, year, schema)` → `[{ row_id, form, label_hu, label_en, value_huf }]`
- Only emits a row if its value is non-zero (except ETÜ loss — always emit if declared).

### `stock-lookup.js`
- `lookupPrice(ticker, dateStr)` → `{ price, currency, source_date, is_exact }` or throws.
- Endpoint: `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&period1={ts}&period2={ts_plus_3days}`
- **Never called automatically.** Only on explicit user button press.
- **Every resolved price must be displayed with:**
  1. The exact date the price was sourced from
  2. A **"Verify on Yahoo Finance →"** link to `https://finance.yahoo.com/quote/{TICKER}/history/` opening in a new tab
  3. A prominent note: *"Ez egy kényelmi funkció, nem hivatalos adat. A helyes részvényárfolyam megadásáért Ön felel — a bróker igazolása az irányadó. / This is a convenience feature, not official data. You are responsible for the correct share price — your broker statement is authoritative."*
  4. The FMV input field remains fully editable; the looked-up value is pre-filled, not locked
- On failure: return null; UI shows the Yahoo Finance direct URL for manual lookup.

---

## MNB FX pipeline

- **Action:** `.github/workflows/mnb-fx-fetch.yml`
- **Schedule:** `0 18 * * 1-5` UTC (MNB publishes ~16:00 CET on business days)
- **SOAP endpoint:** `http://www.mnb.hu/arfolyamok.asmx`, method `GetExchangeRates`
- **Currencies fetched:** USD, EUR, GBP
- **Output:** `data/mnb_fx_YYYY.json` → `{ "YYYY-MM-DD": { "USD": 370.50, "EUR": 398.20, "GBP": 468.10 } }`
- **Range:** 2016–present. Years 2016–(current−1) are committed as complete static files. Current year file is appended daily.
- **Stale fallback:** `fx-engine.js` walks back up to 7 calendar days. Always exposes `date_used` and `is_fallback` in the result. UI always shows which date's rate was used.
- **Pre-2016:** `getRate()` returns `{ requires_manual: true }`. UI shows MNB historical lookup link: `https://www.mnb.hu/arfolyamok`.

---

## NAV payment accounts

> Verify these annually against the current NAV website. Source: NAV Füzet #04 (2024-09-05).

| Obligation | Account | IBAN | Payer | Közlemény |
|---|---|---|---|---|
| SZJA (annual + quarterly advance) | 10032000-06056353 | HU16 1003 2000 0605 6353 0000 0000 | Individual | adóazonosító jel |
| SZOCHO (self-paid) | 10032000-06055912 | HU12 1003 2000 0605 5912 0000 0000 | Individual | adóazonosító jel |
| TB járulék (self-paid, rare) | 10032000-06058200 | HU22 1003 2000 0605 8200 0000 0000 | Individual | adóazonosító jel |

Annual filing + payment deadline: **May 20** of the year following the tax year.
Quarterly SZJA advance: same account as SZJA; deadline from `tax-rules.json → quarterly_advance_deadlines`.

---

## Modes

### Current year (default)
`new Date().getFullYear()`. Shows the quarterly advance panel (for events where DTT is active with source country).

### Önellenőrzés (closed years, 2021–2025 as of 2026)
User explicitly selects a past tax year. Shows delta + késedelmi kamat panel instead of quarterly advance.

---

## Out of scope (do not implement without explicit instruction)

- §77/A preferential share award scheme
- Automatic DTT credit calculation
- Broker CSV/PDF import parser
- PDF / print export
- Dark mode
- Any server-side component
- Any analytics or telemetry
- Any npm runtime dependency
