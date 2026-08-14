/**
 * Transaction Form UI — Add Event form for collecting equity transactions.
 * Ticket 008 — Transaction Form UI
 * SPEC.md §6.3, AGENTS.md (transaction-form.js contract, defensive design §3)
 *
 * Renders into <section id="add-event"> via #transaction-form-mount.
 * Handles all 6 event types with conditional field visibility.
 * MNB rate auto-fill with full defensive UX (verify link, liability note, override always visible).
 * FMV lookup via stock-lookup.js (user-triggered only, never automatic).
 * On submit: calls ledger.add(), dispatches 'ledger:changed', resets form.
 * On 'ledger:edit' event: repopulates form for editing.
 */

import { getRate, setManualRate } from '../fx-engine.js';
import { add as ledgerAdd, update as ledgerUpdate } from '../ledger.js';
import { t } from '../i18n.js';
import { lookupPrice } from '../stock-lookup.js';
import { initLotForm, getLots, resetLots, setLots, updateLotCurrency } from './lot-form.js';

const INCOME_TYPES = ['RSU_VEST', 'ESOP_EXERCISE', 'ESPP_PURCHASE', 'SHARE_AWARD'];

/** @type {string|null} ID of transaction currently being edited, or null for new */
let editingId = null;

/** @type {boolean} Whether the MNB rate has been manually overridden for the current form state */
let mnbRateOverridden = false;

/**
 * Initialises the transaction form.
 * Called once by app.js bootstrap.
 */
export function initTransactionForm() {
  const mount = document.getElementById('transaction-form-mount');
  if (!mount) return;

  mount.innerHTML = buildFormHTML();

  const form = mount.querySelector('#event-form');

  wireEventTypeToggle(form);
  wireDateCurrencyChange(form);
  wireFmvLookup(form);
  wireAdvancedToggle(form);
  wireSubmit(form, mount);
  wireCancel(form);

  // Listen for edit requests from ledger-table
  document.addEventListener('ledger:edit', e => {
    populateFormForEdit(form, e.detail);
  });

  // Re-render i18n strings on language change
  document.addEventListener('lang:changed', () => {
    mount.innerHTML = buildFormHTML();
    const newForm = mount.querySelector('#event-form');
    wireEventTypeToggle(newForm);
    wireDateCurrencyChange(newForm);
    wireFmvLookup(newForm);
    wireAdvancedToggle(newForm);
    wireSubmit(newForm, mount);
    wireCancel(newForm);
    document.addEventListener('ledger:edit', ev => {
      populateFormForEdit(newForm, ev.detail);
    }, { once: false });
  });
}

/**
 * Builds the full form HTML string.
 * @returns {string}
 */
function buildFormHTML() {
  const types = [
    ['RSU_VEST', t('form.event_type.rsu_vest')],
    ['ESOP_EXERCISE', t('form.event_type.esop_exercise')],
    ['ESPP_PURCHASE', t('form.event_type.espp_purchase')],
    ['SHARE_AWARD', t('form.event_type.share_award')],
    ['SHARE_SALE', t('form.event_type.share_sale')],
    ['DIVIDEND', t('form.event_type.dividend')],
  ];

  const countries = [
    ['US', t('form.source_country.us')],
    ['UK', t('form.source_country.uk')],
    ['EU', t('form.source_country.eu')],
    ['OTHER', t('form.source_country.other')],
  ];

  const currencies = [
    ['USD', t('form.currency.usd')],
    ['EUR', t('form.currency.eur')],
    ['GBP', t('form.currency.gbp')],
  ];

  return `
    <form id="event-form" novalidate>
      <div class="form-grid">

        <!-- Event type -->
        <div class="field-group">
          <label class="field-label" for="f-type">${t('form.event_type.label')}</label>
          <select id="f-type" name="type" class="input" required>
            ${types.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </div>

        <!-- Source country -->
        <div class="field-group">
          <label class="field-label" for="f-country">${t('form.source_country.label')}</label>
          <select id="f-country" name="source_country" class="input" required>
            ${countries.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </div>

        <!-- Date -->
        <div class="field-group">
          <label class="field-label" for="f-date">${t('form.date.label')}</label>
          <input type="date" id="f-date" name="date" class="input" required>
          <span class="field-error" id="f-date-error" hidden></span>
          <span class="date-future-warning" id="f-date-future" hidden>${t('form.date.future_warning')}</span>
        </div>

        <!-- Currency -->
        <div class="field-group">
          <label class="field-label" for="f-currency">${t('form.currency.label')}</label>
          <select id="f-currency" name="currency" class="input" required>
            ${currencies.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </div>

        <!-- Gross amount (label changes per event type) -->
        <div class="field-group">
          <label class="field-label" for="f-gross" id="f-gross-label">${t('form.gross_amount.label')}</label>
          <input type="number" id="f-gross" name="gross_foreign_amount" class="input" min="0" step="any" required>
          <span class="field-error" id="f-gross-error" hidden></span>
        </div>

        <!-- Strike price (ESOP only) -->
        <div class="field-group" id="f-strike-group" hidden>
          <label class="field-label" for="f-strike">${t('form.strike_price.label')}</label>
          <input type="number" id="f-strike" name="strike_price" class="input" min="0" step="any">
        </div>

        <!-- Quantity (ESOP / ESPP / SHARE_AWARD / SHARE_SALE) -->
        <div class="field-group" id="f-quantity-group" hidden>
          <label class="field-label" for="f-quantity">${t('form.quantity.label')}</label>
          <input type="number" id="f-quantity" name="quantity" class="input" min="0.0001" step="any">
        </div>

        <!-- FMV (ESPP / SHARE_AWARD) -->
        <div class="field-group" id="f-fmv-group" hidden>
          <label class="field-label" for="f-fmv-ticker">Ticker symbol</label>
          <input type="text" id="f-fmv-ticker" class="input" placeholder="e.g. TSCO.L, AAPL">
          <label class="field-label" for="f-fmv">${t('form.fmv.label')}</label>
          <div class="input-with-btn">
            <input type="number" id="f-fmv" name="fmv" class="input" min="0.0001" step="any">
            <button type="button" id="f-fmv-lookup" class="btn btn-secondary btn-sm">${t('form.fmv.lookup_btn')}</button>
          </div>
          <div class="fmv-lookup-status" id="f-fmv-status"></div>
          <a class="mnb-verify-link" href="#" target="_blank" rel="noopener noreferrer" id="f-fmv-verify-link" hidden>${t('form.fmv.verify_link')}</a>
          <p class="liability-note">${t('form.fmv.liability_note')}</p>
        </div>

        <!-- EGT flag (DIVIDEND only) -->
        <div class="field-group" id="f-egt-group" hidden>
          <label class="checkbox-label">
            <input type="checkbox" id="f-egt" name="is_egt">
            ${t('form.is_egt.label')}
          </label>
        </div>

        <!-- MNB rate widget — always visible, always has override input -->
        <div class="field-group mnb-rate-widget" id="f-mnb-widget">
          <label class="field-label" for="f-mnb-override">${t('form.mnb_rate.label')}</label>
          <span class="rate-status" id="f-mnb-status"></span>
          <a class="mnb-verify-link" href="https://www.mnb.hu/arfolyam-lekerdezes" target="_blank" rel="noopener noreferrer">${t('form.mnb_rate.verify_link')}</a>
          <p class="liability-note">${t('form.mnb_rate.liability_note')}</p>
          <input type="number" id="f-mnb-override" name="mnb_rate_override" class="input" min="0.0001" step="any" placeholder="${t('form.mnb_rate.override_label')}">
          <span class="field-error" id="f-mnb-error" hidden></span>
        </div>

        <!-- Broker fee -->
        <div class="field-group">
          <label class="field-label" for="f-fee">${t('form.broker_fee.label')}</label>
          <input type="number" id="f-fee" name="broker_fee_huf" class="input" min="0" step="1" value="0">
        </div>

        <!-- Notes -->
        <div class="field-group field-group--full">
          <label class="field-label" for="f-notes">${t('form.notes.label')}</label>
          <input type="text" id="f-notes" name="notes" class="input">
        </div>

        <!-- SHARE_SALE lot sub-form -->
        <div class="field-group--full" id="f-lot-mount" hidden></div>

        <!-- Advanced section -->
        <div class="field-group--full" id="f-advanced-section">
          <button type="button" class="btn btn-ghost btn-sm advanced-toggle" id="f-advanced-toggle"
            aria-expanded="false" aria-controls="f-advanced-body">
            ${t('form.advanced.toggle')}
          </button>
          <div id="f-advanced-body" hidden>
            <label class="checkbox-label" title="${t('form.tb_applies.tooltip')}">
              <input type="checkbox" id="f-tb" name="tb_applies">
              ${t('form.tb_applies.label')}
            </label>
          </div>
        </div>

      </div><!-- /form-grid -->

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" id="f-submit">${t('form.submit')}</button>
        <button type="button" class="btn btn-ghost" id="f-cancel" hidden>${t('form.cancel_edit')}</button>
      </div>
    </form>
  `;
}

// ─── Gross amount label map ────────────────────────────────────────────────────

const GROSS_LABEL_KEYS = {
  RSU_VEST:       'form.gross_amount.rsu_vest',
  ESOP_EXERCISE:  'form.gross_amount.esop_exercise',
  ESPP_PURCHASE:  'form.gross_amount.espp_purchase',
  SHARE_AWARD:    'form.gross_amount.share_award',
  SHARE_SALE:     'form.gross_amount.share_sale',
  DIVIDEND:       'form.gross_amount.dividend',
};

// ─── Field visibility ──────────────────────────────────────────────────────────

/**
 * Shows/hides conditional form fields based on the selected event type.
 * Also initialises the lot sub-form when SHARE_SALE is selected.
 * @param {HTMLFormElement} form
 * @param {string} type - Event type value
 */
function applyTypeVisibility(form, type) {
  const isEsop    = type === 'ESOP_EXERCISE';
  const isSale    = type === 'SHARE_SALE';
  const isDividend = type === 'DIVIDEND';
  const hasFmv    = ['ESPP_PURCHASE', 'SHARE_AWARD'].includes(type);
  const hasQty    = ['ESOP_EXERCISE', 'ESPP_PURCHASE', 'SHARE_AWARD', 'SHARE_SALE'].includes(type);

  setHidden(form, 'f-strike-group', !isEsop);
  setHidden(form, 'f-quantity-group', !hasQty);
  setHidden(form, 'f-fmv-group', !hasFmv);
  setHidden(form, 'f-egt-group', !isDividend);

  // Gross label
  const grossLabel = form.querySelector('#f-gross-label');
  if (grossLabel) grossLabel.textContent = t(GROSS_LABEL_KEYS[type] ?? 'form.gross_amount.label');

  // Lot sub-form
  const lotMount = form.querySelector('#f-lot-mount');
  if (lotMount) {
    if (isSale) {
      lotMount.hidden = false;
      const currency = form.querySelector('#f-currency')?.value ?? 'USD';
      initLotForm(lotMount, currency);
    } else {
      lotMount.hidden = true;
      resetLots();
    }
  }
}

function setHidden(form, id, hidden) {
  const el = form.querySelector(`#${id}`);
  if (el) el.hidden = hidden;
}

// ─── Wiring ───────────────────────────────────────────────────────────────────

function wireEventTypeToggle(form) {
  const typeSelect = form.querySelector('#f-type');
  if (!typeSelect) return;

  typeSelect.addEventListener('change', () => {
    applyTypeVisibility(form, typeSelect.value);
  });

  // Apply initial state
  applyTypeVisibility(form, typeSelect.value);
}

function wireDateCurrencyChange(form) {
  const dateInput    = form.querySelector('#f-date');
  const currencySelect = form.querySelector('#f-currency');
  const overrideInput  = form.querySelector('#f-mnb-override');

  const triggerFetch = () => {
    const date     = dateInput?.value;
    const currency = currencySelect?.value;
    if (!date || !currency) return;

    // Future date warning
    const futureBanner = form.querySelector('#f-date-future');
    if (futureBanner) futureBanner.hidden = date <= new Date().toISOString().slice(0, 10);

    mnbRateOverridden = false;
    fetchAndDisplayMnbRate(form, currency, date);

    // Also update lot form currency
    updateLotCurrency(currency);
  };

  dateInput?.addEventListener('change', triggerFetch);
  currencySelect?.addEventListener('change', () => {
    triggerFetch();
    // Propagate currency to lot sub-form
    const currency = currencySelect.value;
    updateLotCurrency(currency);
  });

  overrideInput?.addEventListener('change', () => {
    const val = parseFloat(overrideInput.value);
    if (val > 0) {
      mnbRateOverridden = true;
      const date     = dateInput?.value;
      const currency = currencySelect?.value;
      if (date && currency) setManualRate(currency, date, val);
    }
  });
}

/**
 * Fetches and displays the MNB rate in the form's rate widget.
 * @param {HTMLFormElement} form
 * @param {string} currency
 * @param {string} date
 */
async function fetchAndDisplayMnbRate(form, currency, date) {
  const statusEl     = form.querySelector('#f-mnb-status');
  const overrideInput = form.querySelector('#f-mnb-override');

  if (statusEl) {
    statusEl.textContent = '…';
    statusEl.className = 'rate-status';
  }

  try {
    const result = await getRate(currency, date);

    if (result.requires_manual) {
      if (statusEl) {
        statusEl.textContent = t('form.mnb_rate.manual_required');
        statusEl.className = 'rate-status rate-warning';
      }
    } else if (result.rate != null) {
      if (!mnbRateOverridden) {
        if (overrideInput) overrideInput.value = result.rate;
      }
      if (statusEl) {
        const msg = result.is_fallback
          ? t('form.mnb_rate.fallback')
            .replace('{date_used}', result.date_used)
            .replace('{date}', date)
          : t('form.mnb_rate.auto_filled').replace('{date}', result.date_used);
        statusEl.textContent = msg;
        statusEl.className = result.is_fallback ? 'rate-status rate-warning' : 'rate-status rate-ok';
      }
    }
  } catch {
    if (statusEl) {
      statusEl.textContent = t('error.mnb_unavailable');
      statusEl.className = 'rate-status rate-warning';
    }
  }
}

function wireFmvLookup(form) {
  const lookupBtn  = form.querySelector('#f-fmv-lookup');
  const fmvInput   = form.querySelector('#f-fmv');
  const statusEl   = form.querySelector('#f-fmv-status');
  const verifyLink = form.querySelector('#f-fmv-verify-link');
  const tickerInput = form.querySelector('#f-fmv-ticker');

  if (!lookupBtn) return;

  // Update verify link href + visibility as user types the ticker
  tickerInput?.addEventListener('input', () => {
    const ticker = tickerInput.value.trim();
    if (ticker && verifyLink) {
      verifyLink.href = `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}/history/`;
      verifyLink.hidden = false;
    } else if (verifyLink) {
      verifyLink.href = '#';
      verifyLink.hidden = true;
    }
  });

  lookupBtn.addEventListener('click', async () => {
    const dateInput = form.querySelector('#f-date');
    const date = dateInput?.value;
    const resolvedTicker = tickerInput?.value?.trim();

    if (!resolvedTicker || !date) {
      if (statusEl) {
        statusEl.textContent = t('error.yahoo_failed');
        statusEl.className = 'rate-status rate-warning';
      }
      return;
    }

    lookupBtn.disabled = true;
    if (statusEl) statusEl.textContent = '…';

    try {
      const result = await lookupPrice(resolvedTicker, date);
      if (fmvInput && result?.price != null) {
        fmvInput.value = result.price;
        fmvInput.dispatchEvent(new Event('input'));
      }
      if (statusEl) {
        statusEl.textContent = `${result.price} ${result.currency} (${result.source_date}${result.is_exact ? '' : ' — nearest'})`;
        statusEl.className = 'rate-status rate-ok';
      }
      if (verifyLink) {
        verifyLink.href = `https://finance.yahoo.com/quote/${encodeURIComponent(resolvedTicker)}/history/`;
        verifyLink.hidden = false;
      }
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = t('error.yahoo_failed');
        statusEl.className = 'rate-status rate-warning';
      }
      // Still surface the verify link so the user can look it up manually
      if (verifyLink && resolvedTicker) {
        verifyLink.href = `https://finance.yahoo.com/quote/${encodeURIComponent(resolvedTicker)}/history/`;
        verifyLink.hidden = false;
      }
    } finally {
      lookupBtn.disabled = false;
    }
  });
}

function wireAdvancedToggle(form) {
  const toggle = form.querySelector('#f-advanced-toggle');
  const body   = form.querySelector('#f-advanced-body');
  if (!toggle || !body) return;

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    body.hidden = expanded;
  });
}

// ─── Submit / validation ───────────────────────────────────────────────────────

function wireSubmit(form, mount) {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors(form);

    if (!validateForm(form)) return;

    const tx = buildTransaction(form);
    if (!tx) return;

    if (editingId) {
      ledgerUpdate(editingId, tx);
      editingId = null;
    } else {
      ledgerAdd(tx);
    }

    form.reset();
    resetLots();
    mnbRateOverridden = false;
    applyTypeVisibility(form, 'RSU_VEST');
    form.querySelector('#f-type').value = 'RSU_VEST';
    setHidden(form, 'f-cancel', true);
    clearErrors(form);

    const statusEl = form.querySelector('#f-mnb-status');
    if (statusEl) statusEl.textContent = '';

    document.dispatchEvent(new CustomEvent('ledger:changed'));
  });
}

function wireCancel(form) {
  const cancelBtn = form.querySelector('#f-cancel');
  if (!cancelBtn) return;

  cancelBtn.addEventListener('click', () => {
    editingId = null;
    form.reset();
    resetLots();
    mnbRateOverridden = false;
    applyTypeVisibility(form, 'RSU_VEST');
    cancelBtn.hidden = true;
    clearErrors(form);
  });
}

/**
 * Validates required fields and shows inline errors.
 * @param {HTMLFormElement} form
 * @returns {boolean}
 */
function validateForm(form) {
  let valid = true;
  const type = form.querySelector('#f-type')?.value;

  // Date required
  const date = form.querySelector('#f-date')?.value;
  if (!date) {
    showError(form, 'f-date-error', t('form.validation.required'));
    valid = false;
  }

  // Gross amount required and positive
  const gross = parseFloat(form.querySelector('#f-gross')?.value);
  if (isNaN(gross) || gross <= 0) {
    showError(form, 'f-gross-error', t('form.validation.positive'));
    valid = false;
  }

  // MNB rate required (override or auto-filled)
  const mnbRate = parseFloat(form.querySelector('#f-mnb-override')?.value);
  if (isNaN(mnbRate) || mnbRate <= 0) {
    showError(form, 'f-mnb-error', t('form.validation.required'));
    valid = false;
  }

  return valid;
}

function showError(form, id, message) {
  const el = form.querySelector(`#${id}`);
  if (el) {
    el.textContent = message;
    el.hidden = false;
  }
}

function clearErrors(form) {
  form.querySelectorAll('.field-error').forEach(el => {
    el.textContent = '';
    el.hidden = true;
  });
}

/**
 * Builds a transaction object from the form values.
 * @param {HTMLFormElement} form
 * @returns {Object}
 */
function buildTransaction(form) {
  const type     = form.querySelector('#f-type').value;
  const date     = form.querySelector('#f-date').value;
  const country  = form.querySelector('#f-country').value;
  const currency = form.querySelector('#f-currency').value;
  const gross    = parseFloat(form.querySelector('#f-gross').value);
  const mnbRate  = parseFloat(form.querySelector('#f-mnb-override').value);
  const fee      = parseFloat(form.querySelector('#f-fee').value) || 0;
  const notes    = form.querySelector('#f-notes')?.value ?? '';
  const tbApplies = form.querySelector('#f-tb')?.checked ?? false;
  const isEgt    = form.querySelector('#f-egt')?.checked ?? false;
  const qty      = parseFloat(form.querySelector('#f-quantity')?.value) || undefined;

  const taxYear = parseInt(date.slice(0, 4), 10);
  const grossHuf = Math.round(gross * mnbRate);

  const tx = {
    type,
    date,
    tax_year: taxYear,
    source_country: country,
    currency,
    gross_foreign_amount: gross,
    mnb_rate_used: mnbRate,
    mnb_rate_overridden: mnbRateOverridden,
    gross_huf: grossHuf,
    broker_fee_huf: fee,
    tb_applies: tbApplies,
    is_egt: isEgt,
    notes,
  };

  if (qty !== undefined) tx.quantity = qty;

  if (type === 'SHARE_SALE') {
    tx.lots = getLots();
    if (!tx.quantity) {
      // Default to sum of lot quantities if not separately specified
      tx.quantity = tx.lots.reduce((s, l) => s + l.quantity, 0);
    }
  }

  return tx;
}

/**
 * Populates the form for editing an existing transaction.
 * @param {HTMLFormElement} form
 * @param {Object} tx - Transaction object from ledger
 */
function populateFormForEdit(form, tx) {
  editingId = tx.id;

  form.querySelector('#f-type').value     = tx.type ?? 'RSU_VEST';
  form.querySelector('#f-country').value  = tx.source_country ?? 'US';
  form.querySelector('#f-date').value     = tx.date ?? '';
  form.querySelector('#f-currency').value = tx.currency ?? 'USD';
  form.querySelector('#f-gross').value    = tx.gross_foreign_amount ?? '';
  form.querySelector('#f-mnb-override').value = tx.mnb_rate_used ?? '';
  form.querySelector('#f-fee').value      = tx.broker_fee_huf ?? 0;
  form.querySelector('#f-notes').value    = tx.notes ?? '';

  const tbCheck = form.querySelector('#f-tb');
  if (tbCheck) tbCheck.checked = tx.tb_applies ?? false;

  const egtCheck = form.querySelector('#f-egt');
  if (egtCheck) egtCheck.checked = tx.is_egt ?? false;

  if (tx.quantity != null) {
    const qtyInput = form.querySelector('#f-quantity');
    if (qtyInput) qtyInput.value = tx.quantity;
  }

  mnbRateOverridden = tx.mnb_rate_overridden ?? false;

  applyTypeVisibility(form, tx.type);

  if (tx.type === 'SHARE_SALE' && tx.lots?.length) {
    setLots(tx.lots);
  }

  const mnbStatus = form.querySelector('#f-mnb-status');
  if (mnbStatus) {
    mnbStatus.textContent = tx.mnb_rate_overridden
      ? t('form.mnb_rate.override_label')
      : t('form.mnb_rate.auto_filled').replace('{date}', tx.date ?? '');
  }

  const cancelBtn = form.querySelector('#f-cancel');
  if (cancelBtn) cancelBtn.hidden = false;

  // Scroll to form
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
