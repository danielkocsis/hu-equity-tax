/**
 * Advance Tax module — quarterly SZJA/SZOCHO advance schedule calculator.
 * Rules: TAX-ANALYSIS.md §6, AGENTS.md (advance-tax.js contract)
 * SPEC.md §6.7
 */

import { calculateEvent } from './tax-engine.js';

const INCOME_TYPES = ['RSU_VEST', 'ESOP_EXERCISE', 'ESPP_PURCHASE', 'SHARE_AWARD'];

const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4'];
const QUARTER_PERIODS = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'];

/**
 * Determines the quarter index (0-based) for a given ISO date string.
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {number} 0=Q1, 1=Q2, 2=Q3, 3=Q4
 * @private
 */
function getQuarter(dateStr) {
  const month = parseInt(dateStr.slice(5, 7), 10);
  return Math.floor((month - 1) / 3);
}

/**
 * Checks whether a DTT is active for a given source country and rules.
 * @param {string} source_country
 * @param {Object} rules
 * @returns {boolean}
 * @private
 */
function isDttActive(source_country, rules) {
  if (source_country === 'US') return rules.us_hu_dtt_active;
  if (source_country === 'UK') return rules.uk_hu_dtt_active;
  // EU / OTHER — treat as DTT active (OECD network or equivalent)
  return true;
}

/**
 * Returns the quarterly SZJA and SZOCHO advance schedule for the given year.
 * Only processes RSU_VEST, ESOP_EXERCISE, ESPP_PURCHASE, SHARE_AWARD types.
 * Returns an empty array if no DTT is active for any event's source country.
 *
 * @param {Array<Object>} txList - All transactions (any year; filtered internally by year)
 * @param {number} year - Tax year to compute advances for
 * @param {Object} rules - Tax rules for this year from tax-rules.json
 * @returns {Array<{
 *   quarter: string,
 *   period_label: string,
 *   deadline_iso: string,
 *   szja_due: number,
 *   szocho_due: number
 * }>}
 */
export function getAdvanceSchedule(txList, year, rules) {
  const quarters = [
    { szja: 0, szocho: 0 },
    { szja: 0, szocho: 0 },
    { szja: 0, szocho: 0 },
    { szja: 0, szocho: 0 },
  ];

  const yearTx = txList.filter(
    tx => tx.tax_year === year && INCOME_TYPES.includes(tx.type),
  );

  for (const tx of yearTx) {
    if (!isDttActive(tx.source_country, rules)) continue;

    const qi = getQuarter(tx.date);
    const calc = calculateEvent(tx, rules);
    quarters[qi].szja += calc.szja_huf;
    quarters[qi].szocho += calc.szocho_huf;
  }

  const result = [];
  const deadlines = rules.quarterly_advance_deadlines; // ["04-12", "07-12", "10-12", "01-12"]
  const threshold = rules.quarterly_advance_threshold_huf;

  for (let i = 0; i < 4; i++) {
    const szja_due = Math.round(quarters[i].szja);
    const szocho_due = Math.round(quarters[i].szocho);

    // Only emit if SZJA exceeds threshold
    if (szja_due < threshold) continue;

    // Q4 deadline is January 12 of the FOLLOWING year
    const deadlineMMDD = deadlines[i];
    const deadlineYear = i === 3 ? year + 1 : year;
    const deadline_iso = `${deadlineYear}-${deadlineMMDD}`;

    result.push({
      quarter: QUARTER_LABELS[i],
      period_label: QUARTER_PERIODS[i],
      deadline_iso,
      szja_due,
      szocho_due,
    });
  }

  return result;
}
