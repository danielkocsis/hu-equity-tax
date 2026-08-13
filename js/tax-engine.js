/**
 * Tax Engine — all tax calculation logic for HU equity income.
 * Sources: TAX-ANALYSIS.md (primary), AGENTS.md (module contract)
 * NEVER implement tax math outside this module.
 */

import { applyFifo } from './lot-tracker.js';

/**
 * Returns the applicable SZOCHO rate for a given date by iterating the date-range array.
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @param {Object} rules - Tax rules object for the relevant year from tax-rules.json
 * @returns {number} SZOCHO rate as a decimal (e.g. 0.13)
 * @throws {Error} If no matching range is found (data error)
 */
export function getSzochoRate(dateStr, rules) {
  for (const range of rules.szocho_rates) {
    if (dateStr >= range.from && dateStr <= range.to) {
      return range.rate;
    }
  }
  throw new Error(`[tax-engine] No SZOCHO rate found for date ${dateStr} in rules for year ${rules}`);
}

/**
 * Computes taxes for a single transaction.
 * Rules per event type from TAX-ANALYSIS.md §3 and AGENTS.md.
 *
 * @param {Object} tx - Transaction object (see AGENTS.md Transaction schema)
 * @param {Object} rules - Tax rules for the tx.tax_year from tax-rules.json
 * @returns {{
 *   szja_huf: number,
 *   szocho_huf: number,
 *   tb_huf: number,
 *   tax_base_huf: number,
 *   gain_huf: number|null,
 *   warnings: string[]
 * }}
 */
export function calculateEvent(tx, rules) {
  const warnings = [];
  let szja_huf = 0;
  let szocho_huf = 0;
  let tb_huf = 0;
  let tax_base_huf = 0;
  let gain_huf = null;

  const gross_huf = tx.gross_huf ?? 0;
  const date = tx.date;

  // Generate DTT / source country warnings
  if (tx.source_country === 'US') {
    if (!rules.us_hu_dtt_active) {
      warnings.push('US_DTT_TERMINATED_2024');
    } else {
      warnings.push('US_DTT_WAS_ACTIVE');
    }
  }
  if (tx.source_country === 'UK') {
    warnings.push('UK_DTT_ACTIVE');
  }
  if (date < '2016-01-01') {
    warnings.push('PRE_2016_DATE');
  }

  const type = tx.type;

  if (['RSU_VEST', 'ESOP_EXERCISE', 'ESPP_PURCHASE', 'SHARE_AWARD'].includes(type)) {
    // Összevont adóalap income from foreign kifizető: 89% multiplier applies
    // Szja tv. §29(1) — individual bears both SZJA and SZOCHO
    tax_base_huf = Math.round(gross_huf * rules.tax_base_multiplier);
    szja_huf = Math.round(rules.szja_rate * tax_base_huf);

    const szocho_rate = getSzochoRate(date, rules);
    szocho_huf = Math.round(szocho_rate * tax_base_huf);

    // TB járulék — only if explicitly flagged; 18.5% on gross (not tax_base)
    // Tbj. §§; advanced edge case only
    if (tx.tb_applies) {
      tb_huf = Math.round(rules.tb_rate * gross_huf);
    }

  } else if (type === 'SHARE_SALE') {
    // ETÜ — Ellenőrzött tőkepiaci ügylet (Szja tv. §67/A)
    // SZJA = 15% on net gain; SZOCHO = 0
    if (tx.lots && tx.lots.length > 0) {
      const fifo = applyFifo(
        tx.lots,
        tx.lots.reduce((sum, l) => sum + l.quantity, 0),
        gross_huf,
        tx.broker_fee_huf ?? 0,
      );
      gain_huf = fifo.gain_huf;
    } else {
      // No lots — use gross_huf as gain (fallback; form should always supply lots)
      gain_huf = gross_huf - (tx.broker_fee_huf ?? 0);
    }
    tax_base_huf = Math.max(gain_huf, 0);
    szja_huf = Math.round(rules.szja_rate * tax_base_huf);
    szocho_huf = 0; // ETÜ: SZOCHO = 0 (TAX-ANALYSIS §3.6)

  } else if (type === 'DIVIDEND') {
    // Tőkejövedelem — no 89% multiplier (Szja tv. §66)
    tax_base_huf = gross_huf;
    szja_huf = Math.round(rules.szja_rate * gross_huf);

    // SZOCHO: exempt for EGT-listed shares (TAX-ANALYSIS §3.5); else 13% on gross
    if (tx.is_egt) {
      szocho_huf = 0;
    } else {
      const szocho_rate = getSzochoRate(date, rules);
      szocho_huf = Math.round(szocho_rate * gross_huf);
    }
  }

  return { szja_huf, szocho_huf, tb_huf, tax_base_huf, gain_huf, warnings };
}

/**
 * Aggregates all events for a tax year, applies SZOCHO dividend cap and ETÜ carry-forward info.
 *
 * @param {Array<Object>} txList - All transactions for the year
 * @param {number} year - Tax year
 * @param {Object} rules - Tax rules for this year
 * @param {number} priorYearLosses - ETÜ losses from prior years eligible for adókiegyenlítés (HUF)
 * @returns {{
 *   szja_total: number,
 *   szocho_total: number,
 *   tb_total: number,
 *   etü_gross_gain: number,
 *   etü_loss_declared: number,
 *   etü_net_gain: number,
 *   etü_szja: number,
 *   etü_loss_credit_available: number,
 *   dividend_szocho_used: number,
 *   dividend_szocho_cap: number,
 *   warnings: string[]
 * }}
 */
export function aggregateYear(txList, year, rules, priorYearLosses = 0) {
  const dividend_szocho_cap = rules.szocho_dividend_cap_multiplier * rules.min_monthly_wage_huf;
  let dividend_szocho_used = 0;

  let szja_total = 0;
  let szocho_total = 0;
  let tb_total = 0;
  let etü_gross_gain = 0;
  let etü_loss_declared = 0;

  const allWarnings = new Set();

  for (const tx of txList) {
    const result = calculateEvent(tx, rules);

    result.warnings.forEach(w => allWarnings.add(w));

    if (tx.type === 'DIVIDEND') {
      // Apply SZOCHO dividend cap (Szoctv. — 24 × minimálbér/year)
      szja_total += result.szja_huf;
      const remaining_cap = dividend_szocho_cap - dividend_szocho_used;
      const capped_szocho = Math.min(result.szocho_huf, Math.max(0, remaining_cap));
      dividend_szocho_used += capped_szocho;
      szocho_total += capped_szocho;
      tb_total += result.tb_huf;

    } else if (tx.type === 'SHARE_SALE') {
      // ETÜ: accumulate separately; SZOCHO = 0
      const gain = result.gain_huf ?? 0;
      if (gain >= 0) {
        etü_gross_gain += gain;
      } else {
        etü_loss_declared += Math.abs(gain);
      }

    } else {
      szja_total += result.szja_huf;
      szocho_total += result.szocho_huf;
      tb_total += result.tb_huf;
    }
  }

  // ETÜ net gain and tax (Szja tv. §67/A)
  const etü_net_gain = etü_gross_gain - etü_loss_declared;
  const etü_szja = etü_net_gain > 0 ? Math.round(rules.szja_rate * etü_net_gain) : 0;
  szja_total += etü_szja;

  // Adókiegyenlítés — prior-year ETÜ loss credit available (informational; do not apply automatically)
  // Szja tv. §67/A(6)-(8): credit = min(etü_szja_paid_in_prior_frame, loss_amount)
  const etü_loss_credit_available = Math.min(priorYearLosses, etü_szja);

  if (etü_loss_declared > 0) {
    allWarnings.add('ETÜ_LOSS_DECLARED');
  }

  return {
    szja_total,
    szocho_total,
    tb_total,
    etü_gross_gain,
    etü_loss_declared,
    etü_net_gain,
    etü_szja,
    etü_loss_credit_available,
    dividend_szocho_used,
    dividend_szocho_cap,
    warnings: [...allWarnings],
  };
}
