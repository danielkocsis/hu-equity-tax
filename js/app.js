/**
 * App bootstrap — initialises the full application.
 * Ticket 014 — App Bootstrap, Mode Toggle, and Disclaimer
 * SPEC.md §6.1, §6.2, §6.11
 *
 * Mode is derived automatically from the selected year:
 *   current calendar year → 'current'  (shows quarterly advance panel)
 *   any past year         → 'onellenorzes' (shows self-audit panel)
 */

import { loadLang, renderAll, getLang } from './i18n.js';
import { initLangToggle } from './ui/lang-toggle.js';
import { clear as clearLedger } from './ledger.js';
import { clearOverrides } from './fx-engine.js';

const YEAR_KEY  = 'hu_equity_tax_year';
const ADOID_KEY = 'hu_equity_tax_adoid';

const CALENDAR_YEAR = new Date().getFullYear();

/** @type {number} */
let currentYear = CALENDAR_YEAR;

/** @type {'current'|'onellenorzes'} */
let currentMode = 'current';

/**
 * Returns the currently selected tax year.
 * @returns {number}
 */
export function getSelectedYear() {
  return currentYear;
}

/**
 * Returns the current app mode, derived from the selected year.
 * @returns {'current'|'onellenorzes'}
 */
export function getMode() {
  return currentMode;
}

/**
 * Derives and applies mode from the selected year.
 * Current calendar year → 'current' (advance panel visible).
 * Any past year         → 'onellenorzes' (self-audit panel visible).
 * @param {number} year
 */
function applyYear(year) {
  currentYear = year;
  currentMode = year === CALENDAR_YEAR ? 'current' : 'onellenorzes';

  const advanceSection  = document.getElementById('advance');
  const selfAuditSection = document.getElementById('self-audit');

  if (currentMode === 'current') {
    advanceSection?.classList.remove('hidden');
    selfAuditSection?.classList.add('hidden');
  } else {
    advanceSection?.classList.add('hidden');
    selfAuditSection?.classList.remove('hidden');
  }

  document.dispatchEvent(new CustomEvent('mode:changed', { detail: { mode: currentMode, year: currentYear } }));
}

/**
 * Wires the header year selector.
 * Persists the chosen year and triggers a full re-render.
 */
function initYearSelect() {
  const select = document.getElementById('year-select');
  if (!select) return;

  // Restore persisted year, validate it exists as an option, else fall back to current year.
  const saved = parseInt(localStorage.getItem(YEAR_KEY) ?? '', 10);
  const initial = !isNaN(saved) && select.querySelector(`option[value="${saved}"]`)
    ? saved
    : CALENDAR_YEAR;

  select.value = String(initial);
  applyYear(initial);

  select.addEventListener('change', () => {
    const year = parseInt(select.value, 10);
    localStorage.setItem(YEAR_KEY, String(year));
    applyYear(year);
    document.dispatchEvent(new CustomEvent('ledger:changed'));
  });
}

/**
 * Wires the "Clear all data" footer button.
 * Two-step in-page confirmation — no confirm() (blocked by AGENTS.md).
 */
function initClearData() {
  const btn = document.getElementById('clear-data-btn');
  if (!btn) return;

  const confirmEl = document.createElement('span');
  confirmEl.id = 'clear-data-confirm';
  confirmEl.style.cssText = 'display:none;align-items:center;gap:0.5rem;margin-left:0.5rem';
  confirmEl.setAttribute('role', 'status');

  const confirmMsg = document.createElement('span');
  confirmMsg.style.cssText = 'font-size:0.8125rem;color:#9b1c1c;font-weight:500';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'btn btn-danger btn-sm';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-ghost btn-sm';

  confirmEl.append(confirmMsg, confirmBtn, cancelBtn);
  btn.after(confirmEl);

  function renderConfirmStrip() {
    const hu = getLang() === 'hu';
    confirmMsg.textContent = hu ? 'Biztosan törli az összes adatot?' : 'Delete all saved data?';
    confirmBtn.textContent  = hu ? 'Igen, törlés' : 'Yes, delete';
    cancelBtn.textContent   = hu ? 'Mégsem' : 'Cancel';
  }

  btn.addEventListener('click', () => {
    renderConfirmStrip();
    confirmEl.style.display = 'inline-flex';
    btn.style.display = 'none';
  });

  confirmBtn.addEventListener('click', () => {
    clearLedger();
    clearOverrides();
    localStorage.removeItem(ADOID_KEY);
    localStorage.removeItem(YEAR_KEY);
    window.location.reload();
  });

  cancelBtn.addEventListener('click', () => {
    confirmEl.style.display = 'none';
    btn.style.display = '';
  });

  document.addEventListener('lang:changed', () => {
    if (confirmEl.style.display !== 'none') renderConfirmStrip();
  });
}

/**
 * Main bootstrap.
 */
async function init() {
  // 1. Language
  const lang = localStorage.getItem('hu_equity_tax_lang') ?? 'hu';
  await loadLang(lang);
  renderAll();

  // 2. Lang toggle
  initLangToggle();

  // 3. Year selector (derives mode automatically)
  initYearSelect();

  // 4. Other controls
  initClearData();

  // 5. UI modules (stubs for tickets 008–012)
  const uiModules = await Promise.allSettled([
    import('./ui/transaction-form.js').then(m => m.initTransactionForm?.()),
    import('./ui/ledger-table.js').then(m => m.initLedgerTable?.()),
    import('./ui/results-panel.js').then(m => m.initResultsPanel?.()),
    import('./ui/advance-panel.js').then(m => m.initAdvancePanel?.()),
    import('./ui/self-audit-panel.js').then(m => m.initSelfAuditPanel?.()),
    import('./ui/payment-guide.js').then(m => m.initPaymentGuide?.()),
  ]);

  uiModules.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.warn(`[app] UI module ${i} failed to load:`, result.reason);
    }
  });

  // 6. Initial render — deferred so dynamic imports finish registering first
  setTimeout(() => document.dispatchEvent(new CustomEvent('ledger:changed')), 0);
}

document.addEventListener('DOMContentLoaded', init);
