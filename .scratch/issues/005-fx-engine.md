# 005 — FX Engine

**Blocking:** 006, 007, 009  
**Blocked by:** 001, 004

## Context
Read `AGENTS.md` (fx-engine.js module contract and MNB FX pipeline sections).  
Read `SPEC.md §4.1` (FX scope) and the verification link requirements.

## Goal
Implement `js/fx-engine.js` — the module that resolves MNB exchange rates from static JSON files, with weekend fallback and manual override.

## Deliverables

### `js/fx-engine.js`

```js
// Module-level cache: Map<year, { "YYYY-MM-DD": { USD, EUR, GBP } }>
// Module-level overrides: Map<"CURRENCY:YYYY-MM-DD", number>

/**
 * Returns the MNB rate for a currency on a given date.
 * If the exact date has no rate, walks back up to 7 days to find the last published rate.
 * Returns { rate, date_used, is_fallback, is_overridden, requires_manual }
 * requires_manual = true for dates before 2016 (no data file available).
 */
export async function getRate(currency, dateStr) { ... }

/**
 * Stores a user-supplied manual override for a specific currency and date.
 * Overrides take precedence over file lookup.
 */
export function setManualRate(currency, dateStr, rate) { ... }

/**
 * Clears all manual overrides (called on ledger clear).
 */
export function clearOverrides() { ... }
```

**Implementation notes:**
- Lazy-load: only fetch `data/mnb_fx_{YEAR}.json` when a rate for that year is first requested; cache in module Map
- Walk-back: if `dateStr` not in data, try `dateStr - 1 day`, `- 2 days`... up to 7 days; if still not found after 7 days, return `{ requires_manual: true }`
- Dates before 2016: immediately return `{ requires_manual: true }` without fetching

**UI requirement (from AGENTS.md):** The calling UI component must display:
1. The resolved rate value
2. The exact `date_used` (especially if fallback)
3. A "Verify on MNB →" link to `https://www.mnb.hu/arfolyamok` (target="_blank", rel="noopener")
4. The bilingual liability note
5. An always-visible override input

### Done conditions
- [ ] `getRate("USD", "2024-08-10")` (Saturday) returns the rate from 2024-08-09 (Friday) with `is_fallback: true`
- [ ] `setManualRate("USD", "2024-08-10", 370.5)` causes subsequent `getRate` to return `{ rate: 370.5, is_overridden: true }`
- [ ] Pre-2016 date returns `{ requires_manual: true }`
- [ ] Year file is only fetched once per year (cached)
