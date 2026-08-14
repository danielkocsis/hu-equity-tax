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

  row.innerHTML = `
    <div class="lot-row-fields">
      <div class="field-group">
        <label class="field-label">${t('form.lot.vest_date')}</label>
        <input type="date" class="input lot-vest-date" value="${lot.vestDate}" required>
      </div>
      <div class="field-group">
        <label class="field-label">${t('form.lot.quantity')}</label>
        <input type="number" class="input lot-quantity" min="0.0001" step="any" value="${lot.quantity || ''}" required>
      </div>
      <input type="hidden" class="lot-currency" value="${saleCurrency}">
      <div class="field-group">
        <label class="field-label">${t('form.lot.fmv_at_vest')} (${saleCurrency})</label>
        <input type="number" class="input lot-fmv" min="0.0001" step="any" value="${lot.fmv || ''}" required>
      </div>
      <div class="field-group lot-rate-group">
        <label class="field-label">${t('form.lot.mnb_rate')}</label>
        <span class="lot-rate-status rate-ok"></span>
        <a class="mnb-verify-link" href="https://www.mnb.hu/arfolyam-lekerdezes" target="_blank" rel="noopener noreferrer">${t('form.mnb_rate.verify_link')}</a>
        <p class="liability-note">${t('form.mnb_rate.liability_note')}</p>
        <input type="number" class="input lot-rate-override" min="0.0001" step="any" placeholder="${t('form.mnb_rate.override_label')}" value="${lot.mnbRate || ''}">
      </div>
      <div class="field-group">
        <label class="field-label">${t('form.lot.cost_basis')}</label>
        <span class="lot-cost-basis-value">—</span>
      </div>
    </div>
    <button type="button" class="btn btn-ghost btn-sm lot-remove-btn">${t('form.lot.remove_btn')}</button>
  `;

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
