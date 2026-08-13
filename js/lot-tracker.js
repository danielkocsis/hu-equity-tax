/**
 * Lot tracker module — FIFO cost basis calculation for ETÜ share sales.
 * Rules: TAX-ANALYSIS.md §3.6
 */

/**
 * Applies FIFO to consume sell_quantity from lots (sorted by vest_date ascending, oldest first).
 * Partial consumption of a lot is permitted.
 *
 * @param {Array<{vest_date: string, quantity: number, currency: string, fmv_at_vest_foreign: number, mnb_rate_at_vest: number}>} lots
 * @param {number} sell_quantity - Total shares being sold
 * @param {number} sale_proceeds_huf - Total HUF proceeds from the sale
 * @param {number} broker_fee_huf - Broker fee in HUF (may be 0)
 * @returns {{
 *   consumed_lots: Array<{vest_date: string, quantity_consumed: number, cost_basis_huf: number}>,
 *   remaining_lots: Array<Object>,
 *   total_cost_basis_huf: number,
 *   gain_huf: number
 * }}
 */
export function applyFifo(lots, sell_quantity, sale_proceeds_huf, broker_fee_huf = 0) {
  const sorted = [...lots].sort((a, b) => a.vest_date.localeCompare(b.vest_date));

  const consumed_lots = [];
  const remaining_lots = [];
  let qty_left = sell_quantity;
  let total_cost_basis_huf = 0;

  for (const lot of sorted) {
    if (qty_left <= 0) {
      remaining_lots.push({ ...lot });
      continue;
    }

    const qty_consumed = Math.min(lot.quantity, qty_left);
    const lot_cost_basis = lot.fmv_at_vest_foreign * qty_consumed * lot.mnb_rate_at_vest;
    total_cost_basis_huf += lot_cost_basis;

    consumed_lots.push({
      vest_date: lot.vest_date,
      quantity_consumed: qty_consumed,
      cost_basis_huf: Math.round(lot_cost_basis),
    });

    qty_left -= qty_consumed;

    const qty_remaining = lot.quantity - qty_consumed;
    if (qty_remaining > 0) {
      remaining_lots.push({ ...lot, quantity: qty_remaining });
    }
  }

  if (qty_left > 0) {
    console.warn(`[lot-tracker] Not enough lots to cover sell_quantity (${sell_quantity}); ${qty_left} shares unaccounted for.`);
  }

  total_cost_basis_huf = Math.round(total_cost_basis_huf);
  const gain_huf = Math.round(sale_proceeds_huf - total_cost_basis_huf - broker_fee_huf);

  return { consumed_lots, remaining_lots, total_cost_basis_huf, gain_huf };
}
