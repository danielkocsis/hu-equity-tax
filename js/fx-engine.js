/**
 * FX Engine — resolves MNB exchange rates from static JSON files.
 * Data files: data/mnb_fx_YYYY.json
 * Rules: AGENTS.md (fx-engine.js contract and MNB FX pipeline sections)
 * SPEC.md §4.1 (FX scope)
 *
 * UI requirements (enforced by calling component):
 *  1. Show the resolved rate value
 *  2. Show the exact date_used (especially if fallback)
 *  3. Show "Verify on MNB →" link to https://www.mnb.hu/arfolyamok (target="_blank", rel="noopener")
 *  4. Show the bilingual liability note
 *  5. Always show an override input — never hide or collapse it
 */

const MIN_AUTO_YEAR = 2016;
const MAX_FALLBACK_DAYS = 7;

/** @type {Map<number, Record<string, Record<string, number>>>} Cache by year */
const rateCache = new Map();

/** @type {Map<string, number>} Key: "CURRENCY:YYYY-MM-DD" */
const overrides = new Map();

/**
 * Lazy-loads the MNB FX JSON for a given year.
 * @param {number} year
 * @returns {Promise<Record<string, Record<string, number>>|null>}
 * @private
 */
async function loadYear(year) {
  if (rateCache.has(year)) return rateCache.get(year);

  let resp;
  try {
    resp = await fetch(`data/mnb_fx_${year}.json`);
  } catch {
    // Transient network error — do NOT cache null so the next call can retry.
    return null;
  }

  if (!resp.ok) {
    // File is genuinely absent (e.g. future year not yet generated) — safe to cache.
    rateCache.set(year, null);
    return null;
  }

  try {
    const data = await resp.json();
    rateCache.set(year, data);
    return data;
  } catch {
    // Malformed JSON — do not cache, surface as missing so UI shows manual override.
    console.warn(`[fx-engine] Malformed JSON in mnb_fx_${year}.json`);
    return null;
  }
}

/**
 * Subtracts one day from an ISO date string.
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string} YYYY-MM-DD of the previous day
 * @private
 */
function prevDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the MNB rate for a currency on a given date.
 * If the exact date has no rate, walks back up to 7 days to find the last published rate.
 *
 * @param {string} currency - e.g. 'USD', 'EUR', 'GBP'
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @returns {Promise<{
 *   rate: number|null,
 *   date_used: string|null,
 *   is_fallback: boolean,
 *   is_overridden: boolean,
 *   requires_manual: boolean
 * }>}
 */
export async function getRate(currency, dateStr) {
  const overrideKey = `${currency}:${dateStr}`;
  if (overrides.has(overrideKey)) {
    return {
      rate: overrides.get(overrideKey),
      date_used: dateStr,
      is_fallback: false,
      is_overridden: true,
      requires_manual: false,
    };
  }

  const year = parseInt(dateStr.slice(0, 4), 10);

  if (year < MIN_AUTO_YEAR) {
    return { rate: null, date_used: null, is_fallback: false, is_overridden: false, requires_manual: true };
  }

  let currentDate = dateStr;

  for (let attempt = 0; attempt <= MAX_FALLBACK_DAYS; attempt++) {
    const currentYear = parseInt(currentDate.slice(0, 4), 10);
    if (currentYear < MIN_AUTO_YEAR) {
      return { rate: null, date_used: null, is_fallback: false, is_overridden: false, requires_manual: true };
    }

    const data = await loadYear(currentYear);
    if (data && data[currentDate] && data[currentDate][currency] != null) {
      const is_fallback = currentDate !== dateStr;
      return {
        rate: data[currentDate][currency],
        date_used: currentDate,
        is_fallback,
        is_overridden: false,
        requires_manual: false,
      };
    }

    currentDate = prevDay(currentDate);
  }

  // Still not found after 7 days
  return { rate: null, date_used: null, is_fallback: false, is_overridden: false, requires_manual: true };
}

/**
 * Stores a user-supplied manual override for a specific currency and date.
 * Overrides take precedence over all file lookups.
 *
 * @param {string} currency - e.g. 'USD'
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @param {number} rate - HUF per foreign currency unit
 */
export function setManualRate(currency, dateStr, rate) {
  overrides.set(`${currency}:${dateStr}`, rate);
}

/**
 * Clears all manual overrides (called on ledger clear).
 */
export function clearOverrides() {
  overrides.clear();
}
