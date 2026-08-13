/**
 * eSZJA Mapper — maps aggregated tax results to eSZJA row objects.
 * Data: data/eszja-schema.json
 * Rules: TAX-ANALYSIS.md §11, AGENTS.md (eszja-mapper.js contract)
 * SPEC.md §6.6
 */

/** @type {Record<string, Object>|null} */
let schemaCache = null;

/**
 * Lazy-loads and caches the eszja-schema.json.
 * @returns {Promise<Record<string, Object>>}
 * @private
 */
async function loadSchema() {
  if (schemaCache) return schemaCache;
  const resp = await fetch('data/eszja-schema.json');
  if (!resp.ok) throw new Error('[eszja-mapper] Failed to load eszja-schema.json');
  schemaCache = await resp.json();
  return schemaCache;
}

/**
 * Formats a HUF integer as a Hungarian integer string (no decimals).
 * @param {number} amount
 * @returns {string}
 * @private
 */
function formatHuf(amount) {
  return Math.round(amount).toLocaleString('hu-HU', { maximumFractionDigits: 0 });
}

/**
 * Maps aggregated tax results for a year to a list of eSZJA row objects.
 * Only emits rows with non-zero values, EXCEPT etü_loss which is always emitted if declared.
 *
 * @param {Object} aggregated - Result from aggregateYear()
 * @param {number} year - Tax year (e.g. 2024)
 * @returns {Promise<Array<{
 *   row_id: string,
 *   form: string,
 *   label_hu: string,
 *   label_en: string,
 *   value_huf: number,
 *   copy_text: string,
 *   legal_key: string
 * }>>}
 */
export async function mapResults(aggregated, year) {
  const schema = await loadSchema();
  const yearStr = String(year);
  const yearSchema = schema[yearStr];

  if (!yearSchema) {
    console.warn(`[eszja-mapper] No schema found for year ${year}`);
    return [];
  }

  const rows = [];

  // Equity income (RSU/ESOP/ESPP/SHARE_AWARD) — összevont adóalap
  // Total SZJA includes equity SZJA + ETÜ SZJA; we need the equity portion
  const equity_szja = aggregated.szja_total - aggregated.etü_szja;
  if (equity_szja > 0) {
    const r = yearSchema.equity_income_row;
    rows.push({
      row_id: r.id,
      form: r.form,
      label_hu: r.label_hu,
      label_en: r.label_en,
      value_huf: equity_szja,
      copy_text: formatHuf(equity_szja),
      legal_key: 'eszja.legal.equity',
    });
  }

  // ETÜ gain
  if (aggregated.etü_net_gain > 0) {
    const r = yearSchema.etü_gain_row;
    rows.push({
      row_id: r.id,
      form: r.form,
      label_hu: r.label_hu,
      label_en: r.label_en,
      value_huf: aggregated.etü_net_gain,
      copy_text: formatHuf(aggregated.etü_net_gain),
      legal_key: 'eszja.legal.etü',
    });
  }

  // ETÜ tax
  if (aggregated.etü_szja > 0) {
    const r = yearSchema.etü_tax_row;
    rows.push({
      row_id: r.id,
      form: r.form,
      label_hu: r.label_hu,
      label_en: r.label_en,
      value_huf: aggregated.etü_szja,
      copy_text: formatHuf(aggregated.etü_szja),
      legal_key: 'eszja.legal.etü',
    });
  }

  // ETÜ loss — always emit if declared (needed for adókiegyenlítés)
  if (aggregated.etü_loss_declared > 0) {
    const r = yearSchema.etü_loss_row;
    rows.push({
      row_id: r.id,
      form: r.form,
      label_hu: r.label_hu,
      label_en: r.label_en,
      value_huf: aggregated.etü_loss_declared,
      copy_text: formatHuf(aggregated.etü_loss_declared),
      legal_key: 'eszja.legal.etü',
    });
  }

  // Foreign dividend
  if (aggregated.szja_total > 0 && aggregated.dividend_szocho_used >= 0) {
    // Only emit dividend row if there are dividend events
    // We approximate: if dividend_szocho_used > 0 or there are dividends in the ledger
    // A precise check requires the original txList; we expose this through aggregated.has_dividends
    if (aggregated.has_dividends) {
      const r = yearSchema.dividend_row;
      const dividend_szja = aggregated.dividend_szja ?? 0;
      if (dividend_szja > 0) {
        rows.push({
          row_id: r.id,
          form: r.form,
          label_hu: r.label_hu,
          label_en: r.label_en,
          value_huf: dividend_szja,
          copy_text: formatHuf(dividend_szja),
          legal_key: 'eszja.legal.dividend',
        });
      }
    }
  }

  // SZOCHO on dividends (non-EGT only)
  if (aggregated.dividend_szocho_used > 0) {
    const r = yearSchema.szocho_dividend_row;
    rows.push({
      row_id: r.id,
      form: r.form,
      label_hu: r.label_hu,
      label_en: r.label_en,
      value_huf: aggregated.dividend_szocho_used,
      copy_text: formatHuf(aggregated.dividend_szocho_used),
      legal_key: 'eszja.legal.szocho',
    });
  }

  return rows;
}
