/**
 * Payment Guide module — generates NAV payment card data.
 * Accounts from TAX-ANALYSIS.md §9 — verify annually against nav.gov.hu.
 * AGENTS.md: payment-guide.js contract
 * SPEC.md §6.9
 */

// NAV treasury accounts — verify annually against nav.gov.hu (TAX-ANALYSIS.md §9)
const NAV_ACCOUNTS = {
  SZJA: {
    account: '10032000-06056353',
    iban: 'HU16 1003 2000 0605 6353 0000 0000',
  },
  SZOCHO: {
    account: '10032000-06055912',
    iban: 'HU12 1003 2000 0605 5912 0000 0000',
  },
  TB: {
    account: '10032000-06058200',
    iban: 'HU22 1003 2000 0605 8200 0000 0000',
  },
};

/**
 * Generates NAV payment card data for the given aggregated tax results.
 * Deadline: May 20 of year+1.
 *
 * @param {Object} aggregated - Result from aggregateYear()
 * @param {number} year - Tax year
 * @param {string} adoid - Adóazonosító jel (10 digits; used as közlemény)
 * @returns {Array<{
 *   tax_type: string,
 *   tax_name_key: string,
 *   amount_huf: number,
 *   account: string,
 *   iban: string,
 *   kozlemeny: string,
 *   deadline_iso: string
 * }>}
 */
export function generateCards(aggregated, year, adoid = '') {
  const deadline_iso = `${year + 1}-05-20`;
  const kozlemeny = adoid.trim();
  const cards = [];

  const total_szja = aggregated.szja_total ?? 0;
  if (total_szja > 0) {
    cards.push({
      tax_type: 'SZJA',
      tax_name_key: 'payment.szja.name',
      amount_huf: total_szja,
      account: NAV_ACCOUNTS.SZJA.account,
      iban: NAV_ACCOUNTS.SZJA.iban,
      kozlemeny,
      deadline_iso,
    });
  }

  // szocho_total already includes dividend SZOCHO (capped) from aggregateYear — do not add again.
  const total_szocho = aggregated.szocho_total ?? 0;
  if (total_szocho > 0) {
    cards.push({
      tax_type: 'SZOCHO',
      tax_name_key: 'payment.szocho.name',
      amount_huf: total_szocho,
      account: NAV_ACCOUNTS.SZOCHO.account,
      iban: NAV_ACCOUNTS.SZOCHO.iban,
      kozlemeny,
      deadline_iso,
    });
  }

  const total_tb = aggregated.tb_total ?? 0;
  if (total_tb > 0) {
    cards.push({
      tax_type: 'TB',
      tax_name_key: 'payment.tb.name',
      amount_huf: total_tb,
      account: NAV_ACCOUNTS.TB.account,
      iban: NAV_ACCOUNTS.TB.iban,
      kozlemeny,
      deadline_iso,
    });
  }

  return cards;
}
