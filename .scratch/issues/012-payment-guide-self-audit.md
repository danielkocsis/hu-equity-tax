# 012 — Payment Guide and Önellenőrzés Panel

**Blocking:** none  
**Blocked by:** 001, 002, 006, 010, 011

## Context
Read `SPEC.md §6.8` (Önellenőrzés panel) and `§6.9` (NAV payment cards).  
Read `AGENTS.md` (payment-guide.js, self-audit.js contracts).  
Read `TAX-ANALYSIS.md §7` (késedelmi pótlék formula) and `§9` (NAV payment accounts).  
Read `AGENTS.md` defensive design rule 7 — link to NAV pótlékszámítás calculator, never replace it.

## Goal
Implement the NAV payment cards and the önellenőrzés self-audit panel.

## Deliverables

### `js/payment-guide.js`
- `generateCards(aggregated, year, adoid)` → array of card objects per tax type
- Each card: `{ tax_name_hu, tax_name_en, amount_huf, account, iban, kozlemeny, deadline_iso }`
- Account numbers from `TAX-ANALYSIS.md §9`: SZJA `10032000-06056353`, SZOCHO `10032000-06055912`
- IBANs: SZJA `HU16 1003 2000 0605 6353 0000 0000`, SZOCHO `HU12 1003 2000 0605 5912 0000 0000`
- `kozlemeny` = `adoid` (adóazonosító jel, 10 digits)
- `deadline_iso` = May 20 of year+1

### `js/ui/payment-guide.js` (the UI for the cards)
- Renders into `<section id="payment">`
- Adóazonosító input: reads/writes `localStorage` key `hu_equity_tax_adoid`; never transmitted
- Per card: tax name (bilingual), HUF amount, account number (+ copy button), IBAN (+ copy button), közlemény pre-filled (+ copy button), deadline
- Copy buttons use `navigator.clipboard.writeText()`

### `js/self-audit.js`

```js
/**
 * Estimates késedelmi pótlék and önellenőrzési pótlék.
 * Formula: delta × ((base_rate + 0.05) / 365) × days  (Art. tv. 209.§(1))
 * Returns { kesedelmi_huf, onellenorzes_huf, days_late, breakdown[] }
 * breakdown: per MNB base rate period between original_deadline and payment_date
 */
export function estimatePotlek({ delta_huf, original_deadline, payment_date, mnb_base_rates }) { ... }
```

### `js/ui/self-audit-panel.js`
- Renders into `<section id="advance">` in önellenőrzés mode (replaces advance panel)
- Input: "Amount originally declared" (HUF, optional)
- Shows: should-have-paid, delta, **indicative** késedelmi pótlék, **indicative** önellenőrzési pótlék
- All amounts labelled **"Tájékoztató összeg / Indicative estimate"**
- Primary CTA button: **"Calculate exact amount on NAV website →"** linking to `https://nav.gov.hu/ugyfeliranytu/eljarasi_kerdesek/Kalkulatorok/potlekszamitas` (target="_blank")
- The NAV link is the primary action — the in-app estimate is secondary context only

### Done conditions
- [ ] Payment cards show correct accounts and IBANs
- [ ] Copy buttons work for account, IBAN, and közlemény
- [ ] Adóazonosító persists in localStorage
- [ ] Önellenőrzési pótlék = exactly 50% of késedelmi pótlék
- [ ] NAV pótlékszámítás link is prominent and opens in a new tab
- [ ] All pótlék amounts are labelled as indicative estimates
