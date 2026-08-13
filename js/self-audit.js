/**
 * Self-audit module — késedelmi pótlék and önellenőrzési pótlék estimator.
 * Formula: Art. tv. 209.§(1)
 * AGENTS.md: self-audit.js contract
 * SPEC.md §6.8
 *
 * IMPORTANT: All computed amounts are indicative estimates.
 * The NAV pótlékszámítás calculator is the authoritative source:
 * https://nav.gov.hu/ugyfeliranytu/eljarasi_kerdesek/Kalkulatorok/potlekszamitas
 */

/**
 * Estimates késedelmi pótlék and önellenőrzési pótlék.
 * Formula: delta × ((base_rate + 0.05) / 365) × days  [Art. tv. 209.§(1)]
 * Önellenőrzési pótlék = 50% of késedelmi pótlék.
 *
 * Handles multiple MNB base rate periods between original_deadline and payment_date.
 *
 * @param {{
 *   delta_huf: number,
 *   original_deadline: string,
 *   payment_date: string,
 *   mnb_base_rates: Array<{from: string, to: string, rate: number}>
 * }} params
 * @returns {{
 *   kesedelmi_huf: number,
 *   onellenorzes_huf: number,
 *   days_late: number,
 *   breakdown: Array<{from: string, to: string, days: number, base_rate: number, amount_huf: number}>
 * }}
 */
export function estimatePotlek({ delta_huf, original_deadline, payment_date, mnb_base_rates }) {
  if (delta_huf <= 0) {
    return { kesedelmi_huf: 0, onellenorzes_huf: 0, days_late: 0, breakdown: [] };
  }

  const start = new Date(original_deadline + 'T00:00:00Z');
  const end = new Date(payment_date + 'T00:00:00Z');
  const days_late = Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));

  if (days_late <= 0) {
    return { kesedelmi_huf: 0, onellenorzes_huf: 0, days_late: 0, breakdown: [] };
  }

  const breakdown = [];
  let total_kesedelmi = 0;

  for (const period of mnb_base_rates) {
    const periodStart = period.from > original_deadline ? period.from : original_deadline;
    const periodEnd = period.to < payment_date ? period.to : payment_date;

    if (periodStart >= payment_date || periodEnd <= original_deadline) continue;

    const pStart = new Date(periodStart + 'T00:00:00Z');
    const pEnd = new Date(periodEnd + 'T00:00:00Z');
    const days = Math.max(0, Math.round((pEnd - pStart) / (1000 * 60 * 60 * 24)));

    if (days <= 0) continue;

    const effective_rate = period.rate + 0.05;
    const amount = Math.round(delta_huf * (effective_rate / 365) * days);

    breakdown.push({
      from: periodStart,
      to: periodEnd,
      days,
      base_rate: period.rate,
      amount_huf: amount,
    });

    total_kesedelmi += amount;
  }

  // If no base rate periods covered the range (data gap), use a simple single-period calculation
  if (breakdown.length === 0 && mnb_base_rates.length > 0) {
    const last_rate = mnb_base_rates[mnb_base_rates.length - 1].rate;
    const effective_rate = last_rate + 0.05;
    const amount = Math.round(delta_huf * (effective_rate / 365) * days_late);
    breakdown.push({
      from: original_deadline,
      to: payment_date,
      days: days_late,
      base_rate: last_rate,
      amount_huf: amount,
    });
    total_kesedelmi = amount;
  }

  const kesedelmi_huf = total_kesedelmi;
  const onellenorzes_huf = Math.round(kesedelmi_huf * 0.5);

  return { kesedelmi_huf, onellenorzes_huf, days_late, breakdown };
}
