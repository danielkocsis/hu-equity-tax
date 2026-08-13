# SPEC.md — HU-EquityTax Product Specification

**Status:** Approved (post-grilling + tax analysis)
**Version:** 1.1
**Target release:** Q1 2027 (ahead of 2026 tax filing season, deadline May 20 2027)

> Tax rules, rates, formulas, and eSZJA row numbers are defined in `TAX-ANALYSIS.md`.
> This document covers product scope, UX, roadmap, branding, and glossary only.

---

## 1. Problem statement

Hungarian employees at multinational companies receive equity compensation (RSUs, ESOP, ESPP, share awards, dividends) paid by a **foreign "kifizető"** — typically a foreign parent, subsidiary, or third-party equity plan administrator such as Equiniti or Morgan Stanley Shareworks. Because the paying entity is not a Hungarian entity, **no tax is withheld** and the income does not appear in the NAV-generated eSZJA draft return (bevallástervezet).

The employee is legally obligated to:
1. Calculate the HUF value of all equity events using official MNB FX rates
2. Compute SZJA (personal income tax) and SZOCHO (social contribution tax) — applying the 89% tax base multiplier where applicable
3. Pay SZJA advances quarterly **where a DTT is active with the source country** (confirmed: NAV Füzet #04 §5.2)
4. Manually amend their eSZJA return with the correct income and tax amounts
5. Transfer tax payments to the correct NAV treasury accounts by May 20

Employers typically provide only generic guidance. Hiring an accountant is costly. NAV receives CRS/FATCA data — undeclared income is detectable.

---

## 2. Vision

**Részvényadó Kalkulátor / Equity Tax Calculator** — a free, open-source, 100% client-side SPA that automates steps 1–5 above:

- **Zero-knowledge:** All computation in the browser. No personal financial data ever leaves the device.
- **Deterministic:** Open-source tax logic, fully auditable. Tax rules versioned in `tax-rules.json`.
- **Bilingual:** Native HU and EN with no page reload.
- **Zero-infrastructure:** Static site, no server, no database.

---

## 3. Target users

### Primary: Hungarian office worker at a multinational
- Tax resident in Hungary; employed by a Hungarian entity.
- Receives RSUs quarterly or ESPP bi-annually from a US/UK/EU-listed company via a foreign parent.
- No HU tax withheld; income absent from eSZJA draft.
- Needs exact HUF amounts to enter in eSZJA and wire to NAV.
- May have events across multiple tax years (NAV audits last 5 closed years).

### Secondary: Foreign expat in Hungary
- Non-Hungarian speaker; needs English interface.
- Same equity setup; may be unfamiliar with the HU tax system.

---

## 4. Scope

### 4.1 In scope — Phase 1 (MVP)

**Event types:**
| Type | Description |
|---|---|
| RSU_VEST | Restricted stock unit vesting — full FMV at vest is income |
| ESOP_EXERCISE | Stock option exercise — (FMV − strike price) × quantity is income |
| ESPP_PURCHASE | ESPP discount element — (FMV − purchase price) × quantity is income |
| SHARE_AWARD | Direct share grant — full FMV at grant is income |
| SHARE_SALE | ETÜ capital gain/loss — net of FIFO cost basis and broker fees |
| DIVIDEND | Foreign dividend — gross amount; SZOCHO exempt if EGT-listed |

**Private company stock:** Accepted with user-supplied FMV only. No auto-valuation. A clear note states that accuracy depends on the FMV provided.

**Tax calculations:**
- SZJA (15%) on all event types
- SZOCHO using date-range rate lookup (see TAX-ANALYSIS.md §5 for rates per period)
- 89% tax base multiplier for összevont adóalap events (RSU/ESOP/ESPP/awards)
- SZOCHO = 0 on ETÜ gains; SZOCHO = 0 on dividends from EGT-listed shares
- Optional TB járulék (18.5%) via advanced checkbox — default OFF; edge case only
- ETÜ capital gain/loss with FIFO lot tracking and adókiegyenlítés (2-year loss carry-forward credit per [Szja tv. § 67/A (6)–(8)](https://net.jogtar.hu/jogszabaly?docid=99500117.TV#lbj67Aid)) — calculated per year in isolation; multi-year önellenőrzés cascade is explicitly out of scope
- SZOCHO dividend cap (24 × monthly min wage) — aggregated per tax year
- Quarterly SZJA advance — **only when a DTT is active with the equity source country**
  - US equity from 2024+: NO quarterly advance (DTT terminated 2024-01-01)
  - UK equity: YES (UK-HU DTT active)
  - EU/EGT equity: YES (treaty network active)
  - Deadlines: April 12, July 12, October 12, January 12

**Önellenőrzés (self-audit) mode** for closed tax years (2021–2025 as of 2026):
- Reconstructs what should have been paid
- Computes delta vs. what user declares they paid
- Estimates késedelmi pótlék: `delta × ((MNB_base_rate + 0.05) / 365) × days_late` (Art. tv. 209.§(1))
- Estimates önellenőrzési pótlék: 50% of késedelmi pótlék
- Recommends using the NAV online calculator for exact figures

**eSZJA mapper:**
- Maps results to per-year eSZJA row IDs (from `eszja-schema.json`)
- Shows: row ID, one-line bilingual description, HUF amount, click-to-copy

**NAV payment guide:**
- Payment cards: account number, IBAN (with copy button), amount, deadline, adóazonosító jel pre-fill
- Quarterly advance deadlines shown per quarter (DTT-conditional)

**FX:**
- MNB official rates auto-fetched for 2016–present (GitHub Actions daily cron)
- Pre-2016 dates: manual entry with direct link to `https://www.mnb.hu/arfolyamok`
- Stale-data warning; manual override always visible and editable
- UI always shows the exact date used (with fallback explanation) + "Verify on MNB →" link
- Bilingual liability note always displayed: *"Kényelmi funkció. A helyes árfolyam megadásáért Ön felel."*

**Stock FMV hint:**
- "Look up price" button on FMV field — user-triggered only, never automatic
- Yahoo Finance unofficial API; result pre-fills the field but is never locked
- "Verify on Yahoo Finance →" link always shown alongside the result
- Bilingual liability note always displayed: *"Kényelmi funkció, nem hivatalos adat. A bróker igazolása az irányadó."*
- Broker statement is always the authoritative FMV source

**Data persistence:**
- `localStorage` — silently restored on next visit
- "Clear all data" button in footer (with confirm dialog)
- No export/import in Phase 1

**UI:**
- Single scrolling page with anchored sections
- Bilingual HU/EN toggle (localStorage persistent, no page reload)
- Desktop-first; basic mobile responsiveness
- Permanent disclaimer banner (header, non-dismissible)

### 4.2 Out of scope — Phase 1

- §77/A preferential share award scheme
- Pre-2024 US DTT credit auto-calculation (Phase 2; disclaimer shown in Phase 1)
- Broker CSV/PDF import (Phase 3)
- PDF/print export (Phase 3)
- Dark mode (Phase 3)
- Phantom stock / SARs / cash-settled instruments
- Any server-side component
- Any analytics or telemetry

---

## 5. Tax rule summary

> Full authoritative detail is in `TAX-ANALYSIS.md`. This section is a navigational summary only — do not use it to implement logic.

| Topic | Summary | See |
|---|---|---|
| SZJA | 15% flat since 2016 | TAX-ANALYSIS §2, §3 |
| SZOCHO rates | 19.5% (H1 2019), 17.5% (H2 2019–H1 2020), 15.5% (H2 2020–2021), 13% (2022+) — date-range lookup required; see TAX-ANALYSIS §5.1 | TAX-ANALYSIS §5.1 |
| 89% multiplier | Applies to RSU/ESOP/ESPP/awards from foreign kifizető | TAX-ANALYSIS §2 |
| TB járulék | Does NOT apply in standard foreign-kifizető model | TAX-ANALYSIS §8 |
| ETÜ | 15% SZJA, 0% SZOCHO; 2-year loss carry-forward via adókiegyenlítés | TAX-ANALYSIS §3.6 |
| EGT dividend SZOCHO | EXEMPT for shares listed on any EGT regulated market | TAX-ANALYSIS §3.5 |
| US-HU DTT | Terminated 2024-01-01; US brokers retain ETÜ status via OECD clause | TAX-ANALYSIS §10 |
| Quarterly advance | Due Q+1/month 12; only when DTT active; not for ETÜ or dividends | TAX-ANALYSIS §6 |
| eSZJA rows | Equity income: **sor 19** (24SZJA); ETÜ gain: 172d; ETÜ loss: 172a; foreign dividend: **sor 182** | TAX-ANALYSIS §11 |
| NAV payments | SZJA: 10032000-06056353; SZOCHO: 10032000-06055912; deadline May 20 | TAX-ANALYSIS §9 |
| Önellenőrzés | Késedelmi pótlék = delta × (base_rate+5pp)/365 × days (Art. tv. 209.§); önellenőrzési pótlék = 50% | TAX-ANALYSIS §7 |

---

## 6. UX specification

### 6.1 Page structure (single scroll)

```
[Header: logo | language toggle | mode toggle (Current Year / Önellenőrzés)]
[Disclaimer banner — permanent, non-dismissible]
[Section 1: Year selector + mode indicator]
[Section 2: Add Event form]
[Section 3: Transaction ledger (grouped by tax year)]
[Section 4: Results per tax year (SZJA, SZOCHO, TB totals; ETÜ status; dividend cap status)]
[Section 5: eSZJA mapper (row ID | description | HUF amount | copy button)]
[Section 6a — current year only: Quarterly advance deadlines panel]
[Section 6b — önellenőrzés only: Delta + késedelmi/önellenőrzési pótlék panel]
[Section 7: NAV payment cards]
[Footer: Clear data button | links to NAV / MNB / SZJA tv. | copyright + license note]
```

### 6.1a Defensive UX Rules

These rules apply to every screen and component:

- **Every tax rule displayed to the user must cite its legal source** with a clickable link to net.jogtar.hu. Example: *"Az adóalap 89%-a (Szja tv. [§ 29](https://net.jogtar.hu/jogszabaly?docid=99500117.TV#lbj29id))"*
- **Never show a computed number without its formula.** Results panels must include an expandable "How was this calculated?" breakdown showing inputs, formula, and legal basis.
- **Complex scenarios get a graceful boundary, not a wrong answer.** If the user's situation exceeds the app's modelling scope (e.g. multi-year önellenőrzés with adókiegyenlítés cascade), show a named boundary: *"This scenario involves multiple amended years — the interaction between them is not defined by law. Consult a tax adviser."*
- **Source country drives logic silently in the background, visibly in warnings.** The user selects source country once per transaction; the app derives DTT status, quarterly advance obligation, and SZOCHO treatment automatically — but always shows which rules were applied and why.
- **Önellenőrzés mode isolates each year.** No automatic cascade to adjacent years. If ETÜ data exists in Y-1 or Y+1, show: *"You have ETÜ data in adjacent years. Adókiegyenlítés claimed here may affect those returns — verify consistency before filing."*
- **Defer to official NAV calculators; never silently replace them.** If NAV provides an official calculator for a value, the app links to it prominently rather than computing an authoritative result. An in-app figure is labelled *"indicative estimate"* and the primary call-to-action is always the NAV tool. A wrong estimate erodes trust more than a missing feature. Known tools to link: **Pótlékszámítás** (`nav.gov.hu/ugyfeliranytu/eljarasi_kerdesek/Kalkulatorok/potlekszamitas`) for késedelmi and önellenőrzési pótlék.

### 6.2 Modes

**Current year** (default — `new Date().getFullYear()`):
- User adds events as they happen throughout the year.
- Section 6a (quarterly advance panel) is shown — only for events where a DTT is active.

**Önellenőrzés** (user explicitly selects a past year 2021–2025):
- Section 6b (delta + interest) is shown instead of 6a.
- Brief explanation: "Önellenőrzés lets you review a closed tax year that may have been underdeclared."

### 6.3 Add Event form fields

**All event types:**
- Event type dropdown: RSU Vesting / Stock Option Exercise / ESPP Purchase / Share Award / Share Sale / Dividend
- Source country: US / UK / EU-EGT / Other (determines DTT and SZOCHO logic)
- Date picker (warns if future date)
- Currency: USD / EUR / GBP / Other
- Gross foreign amount (label adapts per event type)
- MNB rate (auto-filled; shows "Rate as of [date_used]" or "⚠️ Fallback from [date_used] — no rate published on [requested_date]")
  - Always accompanied by: **"Verify on MNB website →"** link to `https://www.mnb.hu/arfolyamok` (new tab)
  - Always accompanied by: *"Kényelmi funkció. A helyes árfolyam megadásáért Ön felel. / Convenience feature. You are responsible for the correct rate."*
  - Override input always visible and editable — never collapsed or hidden
- Broker fee in HUF (optional; shown for SHARE_SALE and ESOP_EXERCISE)
- Notes (optional)

**SHARE_SALE only — lot sub-form:**
- Repeating lot entry: vest date, quantity, FMV at vest (foreign currency), MNB rate at vest (auto-filled)
- FIFO applied automatically; computed cost basis shown per lot

**ESOP_EXERCISE only:**
- Strike price (foreign currency)
- Number of options exercised

**Advanced (collapsed by default):**
- "TB járulék applies" checkbox + tooltip: "Tick only if your Hungarian employer is formally the equity grantor and you have confirmed TB liability with a tax adviser."

**FMV fields:**
- "Look up price" button → ticker input → Yahoo Finance fetch → closing price shown as pre-filled hint
- Always accompanied by: **"Verify on Yahoo Finance →"** link to `https://finance.yahoo.com/quote/{TICKER}/history/` (new tab)
- Always accompanied by: *"Kényelmi funkció, nem hivatalos adat. A helyes árfolyam megadásáért Ön felel — a bróker igazolása az irányadó. / Convenience feature, not official data. You are responsible for the correct price — your broker statement is authoritative."*
- Field remains fully editable; pre-filled value is never locked

### 6.4 Transaction ledger
- Grouped by tax year
- Columns: Date | Type | Source country | Currency | Foreign amount | MNB rate | HUF gross | SZJA | SZOCHO
- Row actions: Edit (repopulates form), Delete

### 6.5 Results panel (per tax year card)
- Total SZJA due
- Total SZOCHO due
- TB total (only if tb_applies = true on any event)
- ETÜ net gain/loss + carry-forward status (years available, amounts)
- Dividend SZOCHO cap: amount used / cap / remaining
- Warning banners:
  - 🔴 US equity event ≥ 2024-01-01: "US-Hungary tax treaty terminated. No quarterly advance required. No treaty credit on dividends. Full HU taxes apply."
  - 🟡 US equity event 2020–2023: "DTT was active — a treaty credit may reduce your SZJA. Consult a tax adviser."
  - 🟡 UK equity event (any year): "UK-HU DTT applies. A foreign tax credit may be available. Consult a tax adviser."
  - 🟡 Any pre-2016 date: "MNB rate not available in our data. Manual entry required."
  - 🟠 ETÜ loss declared: "This loss is eligible to offset ETÜ gains in the next 2 tax years. Ensure you declare it in sor 172a of your eSZJA return."

### 6.6 eSZJA mapper

Table: **Row ID** | **Form section** | **Description (bilingual)** | **HUF amount** | **Copy**

Rows emitted per TAX-ANALYSIS.md §11. Key mapping (confirmed from 24SZJA kitöltési útmutató):
- Equity income (RSU/ESOP/ESPP/award) with self-paid SZOCHO → **sor 19** (24SZJA-A lap)
- Equity income without SZOCHO (rare edge case) → sor 18
- ETÜ net gain → 172. sor d oszlop; ETÜ loss → 172. sor a oszlop; ETÜ tax → 172. sor e oszlop
- ETÜ loss offset rows → sorok 212–220 (06-os lap) and C lap sor 75 (shown if carry-forward applies)
- Foreign dividend → **sor 182** (05-ös lap)
- SZOCHO on non-EGT dividend → 24SZJA-09-es lap

Note: row numbers confirmed identical across 21SZJA–25SZJA (2021–2025 income years). The app loads the per-year schema from `eszja-schema.json`.

### 6.7 Quarterly advance panel (current year mode only)

Table: **Quarter** | **Period** | **Deadline** | **SZJA advance** | **SZOCHO advance** | **Note**

Shown only for events with an active DTT (source country). Deadlines: Apr 12, Jul 12, Oct 12, Jan 12.
Footer note: "SZJA → account 10032000-06056353. SZOCHO → account 10032000-06055912. Use your adóazonosító jel as the reference in both transfers."

For US equity events from 2024+: panel is suppressed; replaced by an informational note: "No quarterly advance required for US-source income (US-HU DTT terminated 2024)."

### 6.8 Önellenőrzés panel (self-audit mode only)

- Input: "Amount originally declared in SZJA return" (HUF; optional)
- Computed: should-have-paid HUF, delta HUF
- If delta > 0:
  - Indicative késedelmi pótlék breakdown (per MNB base rate period, days, amount) labelled **"Tájékoztató összeg / Indicative estimate"**
  - Indicative önellenőrzési pótlék (50% of the above) — same label
  - Prominent primary button: **"Calculate exact amount on NAV website →"** linking to `https://nav.gov.hu/ugyfeliranytu/eljarasi_kerdesek/Kalkulatorok/potlekszamitas`
  - The indicative figures are shown to help the user understand the approximate magnitude — the NAV calculator is the authoritative source and must be used before filing

### 6.9 NAV payment cards

One card per tax type (SZJA, SZOCHO; TB if applicable). Each card:
- Tax name (bilingual)
- HUF amount due
- Account number (copy button)
- IBAN (copy button)
- Közlemény: adóazonosító jel (pre-filled from localStorage if entered before; never transmitted)
- Deadline

### 6.10 Disclaimer banner (permanent, header)

**HU:** *„Ez az eszköz ingyenes, nyílt forráskódú számológép, nem adótanácsadás. Az eredmények pontossága kizárólag a megadott adatokon múlik. Az adóbevallásért és az adófizetésért kizárólag az adózó felel. Könyvelő megerősítése javasolt."*

**EN:** *"This tool is a free, open-source calculator, not professional tax advice. Accuracy depends entirely on the data you enter. You are solely responsible for your tax return and payments. Verification by a qualified accountant is recommended."*

### 6.11 Data management

| Key | Content | Storage |
|---|---|---|
| `hu_equity_tax_ledger` | JSON array of transaction objects | localStorage |
| `hu_equity_tax_lang` | `"hu"` or `"en"` | localStorage |
| `hu_equity_tax_adoid` | Adóazonosító jel (convenience pre-fill) | localStorage |

On load: silently restore ledger if present. Footer: "Clear all saved data" — `confirm()` dialog before deletion.

---

## 7. Branding

| Context | Value |
|---|---|
| App title (HU) | Részvényadó Kalkulátor |
| App title (EN) | Equity Tax Calculator |
| Subtitle (HU) | Segítség a külföldi részvényjuttatások magyar adózásához |
| Subtitle (EN) | Help with Hungarian taxation of foreign equity awards |
| Repo / URL | hu-equity-tax |

---

## 8. License

**Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**

Anyone may use, share, and adapt for personal or non-commercial purposes with attribution. Commercial use, embedding in paid products, and commercial redistribution require the author's explicit consent.

Footer and README note: *"Free to use for personal tax calculation. Not for commercial redistribution. © [author], CC BY-NC 4.0."*

---

## 9. Phased roadmap

### Phase 1 — MVP (this spec) — Q1 2027
All features in §4.1.

### Phase 2 — Visual mapper & enhanced guidance
- Interactive HTML visual of eSZJA form (highlighted row annotations)
- Simplified DTT credit input: "foreign tax withheld" field; credit = min(withholding, SZJA due on that income); for pre-2024 US and UK events
- Explicit lot identification mode (override FIFO)

### Phase 3 — Import & polish
- Client-side CSV parser for Morgan Stanley Shareworks, E*TRADE, Schwab (Web Worker)
- Print-friendly CSS (Ctrl+P summary)
- Dark mode

---

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| NAV renumbers eSZJA rows annually | Abstracted in `eszja-schema.json`; update JSON each year without touching code |
| SZOCHO rate change (future) | Date-range array in `szocho_rates`; engine does range lookup — no hardcoded rates |
| US-HU DTT termination unknown to user | Red warning banner on any US event ≥ 2024-01-01 |
| SZOCHO rate history | Confirmed: 19.5% (2019), 15.5% (2020–2021), 13% (2022+). No mid-year splits. See TAX-ANALYSIS §5.1 |
| Min monthly wage 2026 | Confirmed: 317,000 HUF (minimálbér). Source: 451/2024 Korm. rendelet. |
| eSZJA rows across all years | Confirmed identical across 21–25SZJA (sor 19, 172, 182). Verify 26SZJA when published (Jan 2027). |
| Yahoo Finance unofficial API breakage | Graceful fallback to manual + direct URL; feature is hint only |
| MNB SOAP API changes | GitHub Action is isolated; fallback to manual FX entry |
| Legal liability | CC BY-NC license; prominent bilingual disclaimer; no data leaves the device |

---

## 11. Glossary

| Term | Definition |
|---|---|
| Kifizető | Hungarian legal concept: the paying entity responsible for withholding. A foreign parent is NOT a kifizető — no withholding obligation. |
| SZJA | Személyi jövedelemadó — Personal Income Tax, 15% flat rate |
| SZOCHO | Szociális hozzájárulási adó — Social Contribution Tax (currently 13%) |
| TB járulék | Társadalombiztosítási járulék — Social Insurance Contribution (18.5% employee side; not applicable in standard foreign-kifizető model) |
| ETÜ | Ellenőrzött tőkepiaci ügylet — Controlled Capital Market Transaction; share sales through a regulated broker |
| Adókiegyenlítés | ETÜ loss carry-forward mechanism (up to 2 years) |
| eSZJA | Electronic personal income tax return filed via the NAV portal |
| Bevallástervezet | NAV-generated draft tax return (does not include foreign equity income) |
| MNB | Magyar Nemzeti Bank — Hungarian National Bank; publishes official FX rates |
| NAV | Nemzeti Adó- és Vámhivatal — Hungarian Tax and Customs Authority |
| Önellenőrzés | Voluntary self-audit amendment of a previously filed tax return |
| Adóazonosító jel | 10-digit personal tax identification number (mandatory in bank transfer reference / közlemény) |
| Késedelmi pótlék | Late payment interest: delta × ((MNB base rate + 5pp) / 365) × days overdue (Art. tv. 209.§(1)) |
| Önellenőrzési pótlék | Self-audit surcharge: 50% of the késedelmi pótlék |
| Negyedéves előleg | Quarterly SZJA advance payment (due Q+1 month 12; only when DTT active) |
| Összevont adóalap | Aggregated tax base — employment and other income subject to SZJA + SZOCHO together |
| EGT | Európai Gazdasági Térség (European Economic Area) — dividend SZOCHO exemption applies to EGT-listed shares |
| DTT | Double taxation treaty (kettős adóztatás elkerüléséről szóló egyezmény) |
