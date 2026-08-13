/**
 * App bootstrap — initialises the full application.
 * Ticket 014 — App Bootstrap, Mode Toggle, and Disclaimer
 * SPEC.md §6.1, §6.2, §6.11
 */

import { loadLang, renderAll, getLang } from './i18n.js';
import { initLangToggle } from './ui/lang-toggle.js';
import { clear as clearLedger } from './ledger.js';
import { clearOverrides } from './fx-engine.js';

const MODE_KEY = 'hu_equity_tax_mode';
const YEAR_KEY = 'hu_equity_tax_year';
const ADOID_KEY = 'hu_equity_tax_adoid';

/** @type {'current'|'onellenorzes'} */
let currentMode = 'current';

/** @type {number} — always driven by #year-select */
let currentYear = new Date().getFullYear();

/**
 * Returns the currently selected tax year.
 * @returns {number}
 */
export function getSelectedYear() {
  return currentYear;
}

/**
 * Returns the current app mode.
 * @returns {'current'|'onellenorzes'}
 */
export function getMode() {
  return currentMode;
}

/**
 * Switches app mode (current year / önellenőrzés).
 * Year is NOT changed here — it is always driven by #year-select.
 * @param {'current'|'onellenorzes'} mode
 */
function applyMode(mode) {
  currentMode = mode;
  localStorage.setItem(MODE_KEY, mode);

  const advanceSection = document.getElementById('advance');
  const selfAuditSection = document.getElementById('self-audit');
  const modeToggleBtn = document.getElementById('mode-toggle');

  if (mode === 'current') {
    advanceSection?.classList.remove('hidden');
    selfAuditSection?.classList.add('hidden');
    modeToggleBtn?.setAttribute('aria-pressed', 'false');
  } else {
    advanceSection?.classList.add('hidden');
    selfAuditSection?.classList.remove('hidden');
    modeToggleBtn?.setAttribute('aria-pressed', 'true');
  }

  document.dispatchEvent(new CustomEvent('mode:changed', { detail: { mode, year: currentYear } }));
}

/**
 * Wires the header year selector.
 * Persists the chosen year, updates currentYear, and triggers re-render.
 */
function initYearSelect() {
  const select = document.getElementById('year-select');
  if (!select) return;

  // Populate default: restore from localStorage, else current calendar year.
  const saved = parseInt(localStorage.getItem(YEAR_KEY) ?? '', 10);
  const defaultYear = !isNaN(saved) && select.querySelector(`option[value="${saved}"]`)
    ? saved
    : new Date().getFullYear();

  select.value = String(defaultYear);
  currentYear = defaultYear;

  select.addEventListener('change', () => {
    currentYear = parseInt(select.value, 10);
    localStorage.setItem(YEAR_KEY, String(currentYear));
    document.dispatchEvent(new CustomEvent('mode:changed', { detail: { mode: currentMode, year: currentYear } }));
    document.dispatchEvent(new CustomEvent('ledger:changed'));
  });
}

/**
 * Wires the mode toggle button.
 */
function initModeToggle() {
  const btn = document.getElementById('mode-toggle');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const next = currentMode === 'current' ? 'onellenorzes' : 'current';
    applyMode(next);
    renderAll();
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
    confirmBtn.textContent = hu ? 'Igen, törlés' : 'Yes, delete';
    cancelBtn.textContent = hu ? 'Mégsem' : 'Cancel';
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
    localStorage.removeItem(MODE_KEY);
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

  // 3. Year selector (must run before applyMode so currentYear is set)
  initYearSelect();

  // 4. Mode (restore persisted, default current)
  const savedMode = localStorage.getItem(MODE_KEY);
  applyMode(savedMode === 'onellenorzes' ? 'onellenorzes' : 'current');

  // 5. Other controls
  initModeToggle();
  initClearData();

  // 6. UI modules (stubs for tickets 008–012)
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

  // 7. Initial render — deferred so dynamic imports finish registering first
  setTimeout(() => document.dispatchEvent(new CustomEvent('ledger:changed')), 0);
}

document.addEventListener('DOMContentLoaded', init);
