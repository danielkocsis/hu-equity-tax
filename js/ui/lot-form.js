/**
 * Lot Form UI — FIFO lot repeater sub-form for SHARE_SALE events.
 * Ticket 008 — Transaction Form UI
 * SPEC.md §6.3, AGENTS.md (lot-form.js contract, defensive design §3)
 *
 * Renders inside the SHARE_SALE form section.
 * Each lot row: vest date, quantity, FMV at vest (foreign currency), MNB rate at vest.
 * Computes cost_basis_huf inline: fmv × quantity × mnb_rate.
 * MNB rate auto-filled via fx-engine with full defensive UX (verify link, liability note,
 * override always visible).
 */

import { getRate, setManualRate } from '../fx-engine.js';
import { t } from '../i18n.js';

/** @type {HTMLElement|null} */
let mountEl = null;

/** @type {Array<{id: number, vestDate: string, quantity: number, fmv: number, mnbRate: number}>} */
let lots = [];

let nextId = 0;

/**
 * Returns the current lots array as plain objects matching the transaction schema.
 * @param {string} currency - The sale currency (for MNB rate key)
 * @returns {Array<Object>}
 */
export function getLots() {
  return lots.map(lot => ({
    vest_date: lot.vestDate,
    quantity: lot.quantity,
    currency: lot.currency,
    fmv_at_vest_foreign: lot.fmv,
    mnb_rate_at_vest: lot.mnbRate,
    cost_basis_huf: Math.round(lot.fmv * lot.quantity * lot.mnbRate),
  }));
}

/**
 * Resets the lot form to zero rows.
 */
export function resetLots() {
  lots = [];
  nextId = 0;
  renderLots();
}

/**
 * Populates lot form from an existing transaction's lots array (edit mode).
 * @param {Array<Object>} existingLots
 */
export function setLots(existingLots) {
  lots = (existingLots ?? []).map(l => ({
    id: nextId++,
    vestDate: l.vest_date ?? '',
    quantity: l.quantity ?? 0,
    currency: l.currency ?? 'USD',
    fmv: l.fmv_at_vest_foreign ?? 0,
    mnbRate: l.mnb_rate_at_vest ?? 0,
  }));
  renderLots();
}

/**
 * Fetches and displays the MNB rate for a lot row.
 * @param {HTMLElement} row - The lot row element
 * @param {number} lotId
 * @param {string} currency
 * @param {string} dateStr
 */
async function fetchAndDisplayRate(row, lotId, currency, dateStr) {
  if (!dateStr || !currency) return;

  const statusEl = row.querySelector('.lot-rate-status');
  const overrideInput = row.querySelector('.lot-rate-override');

  if (statusEl) statusEl.textContent = '…';

  try {
    const result = await getRate(currency, dateStr);
    const lot = lots.find(l => l.id === lotId);

    if (result.requires_manual) {
      if (statusEl) {
        statusEl.textContent = t('form.mnb_rate.manual_required');
        statusEl.className = 'lot-rate-status rate-warning';
      }
    } else if (result.rate != null) {
      if (!lot?.mnbRateOverridden) {
        if (lot) lot.mnbRate = result.rate;
        overrideInput.value = result.rate;
        updateCostBasis(row, lot);
      }
      if (statusEl) {
        const msg = result.is_fallback
          ? t('form.mnb_rate.fallback').replace('{date_used}', result.date_used).replace('{date}', dateStr)
          : t('form.mnb_rate.auto_filled').replace('{date}', result.date_used);
        statusEl.textContent = msg;
        statusEl.className = result.is_fallback ? 'lot-rate-status rate-warning' : 'lot-rate-status rate-ok';
      }
    }
  } catch {
    if (statusEl) {
      statusEl.textContent = t('error.mnb_unavailable');
      statusEl.className = 'lot-rate-status rate-warning';
    }
  }
}

/**
 * Updates the inline cost basis display for a lot row.
 * @param {HTMLElement} row
 * @param {Object} lot
 */
function updateCostBasis(row, lot) {
  if (!lot) return;
  const costEl = row.querySelector('.lot-cost-basis-value');
  if (!costEl) return;
  const basis = Math.round(lot.fmv * lot.quantity * lot.mnbRate);
  costEl.textContent = isNaN(basis) ? '—' : basis.toLocaleString('hu-HU') + ' HUF';
}

/**
 * Creates a single lot row DOM element.
 * @param {Object} lot
 * @param {string} saleCurrency - currency inherited from the sale event
 * @returns {HTMLElement}
 */
function createLotRow(lot, saleCurrency) {
  const row = document.createElement('div');
  row.className = 'lot-row';
  row.dataset.lotId = String(lot.id);

  // Build lot row with DOM methods — never interpolate user/localStorage data
  // into innerHTML. el.value = is always XSS-safe; value="${...}" in innerHTML is not.
  const fields = document.createElement('div');
  fields.className = 'lot-row-fields';

  // Vest date
  const dateGroup = document.createElement('div');
  dateGroup.className = 'field-group';
  const dateLabel = document.createElement('label');
  dateLabel.className = 'field-label';
  dateLabel.textContent = t('form.lot.vest_date');
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'input lot-vest-date';
  dateInput.required = true;
  dateInput.value = lot.vestDate;
  dateGroup.appendChild(dateLabel);
  dateGroup.appendChild(dateInput);
  fields.appendChild(dateGroup);

  // Quantity
  const qtyGroup = document.createElement('div');
  qtyGroup.className = 'field-group';
  const qtyLabel = document.createElement('label');
  qtyLabel.className = 'field-label';
  qtyLabel.textContent = t('form.lot.quantity');
  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.className = 'input lot-quantity';
  qtyInput.min = '0.0001';
  qtyInput.step = 'any';
  qtyInput.required = true;
  qtyInput.value = lot.quantity || '';
  qtyGroup.appendChild(qtyLabel);
  qtyGroup.appendChild(qtyInput);
  fields.appendChild(qtyGroup);

  // Hidden currency (saleCurrency is enum-validated by ledger restore())
  const currencyHidden = document.createElement('input');
  currencyHidden.type = 'hidden';
  currencyHidden.className = 'lot-currency';
  currencyHidden.value = saleCurrency;
  fields.appendChild(currencyHidden);

  // FMV
  const fmvGroup = document.createElement('div');
  fmvGroup.className = 'field-group';
  const fmvLabel = document.createElement('label');
  fmvLabel.className = 'field-label';
  fmvLabel.textContent = `${t('form.lot.fmv_at_vest')} (${saleCurrency})`;
  const fmvInput = document.createElement('input');
  fmvInput.type = 'number';
  fmvInput.className = 'input lot-fmv';
  fmvInput.min = '0.0001';
  fmvInput.step = 'any';
  fmvInput.required = true;
  fmvInput.value = lot.fmv || '';
  fmvGroup.appendChild(fmvLabel);
  fmvGroup.appendChild(fmvInput);
  fields.appendChild(fmvGroup);

  // MNB rate
  const rateGroup = document.createElement('div');
  rateGroup.className = 'field-group lot-rate-group';
  const rateLabel = document.createElement('label');
  rateLabel.className = 'field-label';
  rateLabel.textContent = t('form.lot.mnb_rate');
  const rateStatus = document.createElement('span');
  rateStatus.className = 'lot-rate-status rate-ok';
  const rateLink = document.createElement('a');
  rateLink.className = 'mnb-verify-link';
  rateLink.href = 'https://www.mnb.hu/arfolyam-lekerdezes';
  rateLink.target = '_blank';
  rateLink.rel = 'noopener noreferrer';
  rateLink.textContent = t('form.mnb_rate.verify_link');
  const rateNote = document.createElement('p');
  rateNote.className = 'liability-note';
  rateNote.textContent = t('form.mnb_rate.liability_note');
  const rateOverride = document.createElement('input');
  rateOverride.type = 'number';
  rateOverride.className = 'input lot-rate-override';
  rateOverride.min = '0.0001';
  rateOverride.step = 'any';
  rateOverride.placeholder = t('form.mnb_rate.override_label');
  rateOverride.value = lot.mnbRate || '';
  rateGroup.appendChild(rateLabel);
  rateGroup.appendChild(rateStatus);
  rateGroup.appendChild(rateLink);
  rateGroup.appendChild(rateNote);
  rateGroup.appendChild(rateOverride);
  fields.appendChild(rateGroup);

  // Cost basis display
  const basisGroup = document.createElement('div');
  basisGroup.className = 'field-group';
  const basisLabel = document.createElement('label');
  basisLabel.className = 'field-label';
  basisLabel.textContent = t('form.lot.cost_basis');
  const basisValue = document.createElement('span');
  basisValue.className = 'lot-cost-basis-value';
  basisValue.textContent = '—';
  basisGroup.appendChild(basisLabel);
  basisGroup.appendChild(basisValue);
  fields.appendChild(basisGroup);

  row.appendChild(fields);

  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn btn-ghost btn-sm lot-remove-btn';
  removeBtn.textContent = t('form.lot.remove_btn');
  row.appendChild(removeBtn);

  // Wire: vest date change → fetch MNB rate
  const vestDateInput = row.querySelector('.lot-vest-date');
  const quantityInput = row.querySelector('.lot-quantity');
  const fmvInput = row.querySelector('.lot-fmv');
  const overrideInput = row.querySelector('.lot-rate-override');

  vestDateInput.addEventListener('change', () => {
    lot.vestDate = vestDateInput.value;
    lot.mnbRateOverridden = false;
    fetchAndDisplayRate(row, lot.id, saleCurrency, lot.vestDate);
  });

  quantityInput.addEventListener('input', () => {
    lot.quantity = parseFloat(quantityInput.value) || 0;
    updateCostBasis(row, lot);
  });

  fmvInput.addEventListener('input', () => {
    lot.fmv = parseFloat(fmvInput.value) || 0;
    updateCostBasis(row, lot);
  });

  overrideInput.addEventListener('change', () => {
    const val = parseFloat(overrideInput.value);
    if (val > 0) {
      lot.mnbRate = val;
      lot.mnbRateOverridden = true;
      setManualRate(saleCurrency, lot.vestDate, val);
      updateCostBasis(row, lot);
    }
  });

  // Wire: remove button
  row.querySelector('.lot-remove-btn').addEventListener('click', () => {
    lots = lots.filter(l => l.id !== lot.id);
    row.remove();
  });

  // Auto-fill rate if date already set (edit mode)
  if (lot.vestDate && lot.mnbRate === 0) {
    fetchAndDisplayRate(row, lot.id, saleCurrency, lot.vestDate);
  } else if (lot.mnbRate > 0) {
    updateCostBasis(row, lot);
  }

  return row;
}

/**
 * Renders all lot rows into the mount element.
 */
function renderLots() {
  if (!mountEl) return;

  const currency = mountEl.dataset.currency || 'USD';
  const container = mountEl.querySelector('.lot-rows-container');
  if (!container) return;

  container.innerHTML = '';
  for (const lot of lots) {
    container.appendChild(createLotRow(lot, currency));
  }
}

/**
 * Initialises the lot form sub-component inside a given parent element.
 * Called by transaction-form.js when SHARE_SALE is selected.
 * @param {HTMLElement} parent - The element to render the lot form into
 * @param {string} currency - The sale currency
 */
export function initLotForm(parent, currency) {
  mountEl = parent;
  mountEl.dataset.currency = currency;

  mountEl.innerHTML = `
    <fieldset class="lot-form-fieldset">
      <legend class="lot-form-legend">${t('form.lot.heading')}</legend>
      <div class="lot-rows-container"></div>
      <button type="button" class="btn btn-secondary btn-sm lot-add-btn">${t('form.lot.add_btn')}</button>
    </fieldset>
  `;

  mountEl.querySelector('.lot-add-btn').addEventListener('click', () => {
    const lot = { id: nextId++, vestDate: '', quantity: 0, currency, fmv: 0, mnbRate: 0, mnbRateOverridden: false };
    lots.push(lot);
    const container = mountEl.querySelector('.lot-rows-container');
    container.appendChild(createLotRow(lot, currency));
  });

  renderLots();
}

/**
 * Updates the currency used in lot rate lookups (called when form currency changes).
 * @param {string} currency
 */
export function updateLotCurrency(currency) {
  if (!mountEl) return;
  mountEl.dataset.currency = currency;
  // Update hidden currency inputs and labels
  mountEl.querySelectorAll('.lot-currency').forEach(el => { el.value = currency; });
  mountEl.querySelectorAll('.lot-fmv').forEach((el, i) => {
    const label = el.closest('.field-group')?.querySelector('.field-label');
    if (label) label.textContent = `${t('form.lot.fmv_at_vest')} (${currency})`;
  });
}
