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
const ADOID_KEY = 'hu_equity_tax_adoid';

/** @type {'current'|'onellenorzes'} */
let currentMode = 'current';
/** @type {number} */
let currentYear = new Date().getFullYear();

/**
 * Returns the selected tax year based on current mode.
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
 * Switches to a new mode, persists it, and re-renders relevant sections.
 * @param {'current'|'onellenorzes'} mode
 */
function applyMode(mode) {
  currentMode = mode;
  localStorage.setItem(MODE_KEY, mode);

  const advanceSection = document.getElementById('advance');
  const selfAuditSection = document.getElementById('self-audit');
  const onellenorzesWrap = document.getElementById('onellenorzes-year-wrap');
  const currentYearIndicator = document.getElementById('current-year-indicator');
  const modeToggleBtn = document.getElementById('mode-toggle');

  if (mode === 'current') {
    currentYear = new Date().getFullYear();
    advanceSection?.classList.remove('hidden');
    selfAuditSection?.classList.add('hidden');
    onellenorzesWrap?.classList.add('hidden');
    if (currentYearIndicator) {
      currentYearIndicator.textContent = `${currentYear}`;
    }
    modeToggleBtn?.setAttribute('aria-pressed', 'false');
  } else {
    // önellenőrzés: read selected year from dropdown
    const select = document.getElementById('onellenorzes-year-select');
    if (select) {
      currentYear = parseInt(select.value, 10);
    }
    advanceSection?.classList.add('hidden');
    selfAuditSection?.classList.remove('hidden');
    onellenorzesWrap?.classList.remove('hidden');
    if (currentYearIndicator) {
      currentYearIndicator.textContent = '';
    }
    modeToggleBtn?.setAttribute('aria-pressed', 'true');
  }

  // Dispatch event so UI panels can re-render
  document.dispatchEvent(new CustomEvent('mode:changed', { detail: { mode, year: currentYear } }));
  document.dispatchEvent(new CustomEvent('ledger:changed'));
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
  });
}

/**
 * Wires the önellenőrzés year selector.
 */
function initYearSelector() {
  const select = document.getElementById('onellenorzes-year-select');
  if (!select) return;

  select.addEventListener('change', () => {
    currentYear = parseInt(select.value, 10);
    document.dispatchEvent(new CustomEvent('mode:changed', { detail: { mode: currentMode, year: currentYear } }));
    document.dispatchEvent(new CustomEvent('ledger:changed'));
  });
}

/**
 * Wires the "Clear all data" button in the footer.
 * Uses a two-step in-page confirmation to avoid confirm() (blocked by AGENTS.md).
 * First click: reveals an inline warning + confirm button.
 * Second click (confirm): clears all data and reloads.
 */
function initClearData() {
  const btn = document.getElementById('clear-data-btn');
  if (!btn) return;

  // Build inline confirm UI (hidden by default)
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

  /** Renders confirm strip in the current language. */
  function renderConfirmStrip() {
    const hu = getLang() === 'hu';
    confirmMsg.textContent = hu
      ? 'Biztosan törli az összes adatot?'
      : 'Delete all saved data?';
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
    window.location.reload();
  });

  cancelBtn.addEventListener('click', () => {
    confirmEl.style.display = 'none';
    btn.style.display = '';
  });

  // Re-render confirm text when language switches
  document.addEventListener('lang:changed', () => {
    if (confirmEl.style.display !== 'none') renderConfirmStrip();
  });
}

/**
 * Main bootstrap — called on DOMContentLoaded.
 */
async function init() {
  // 1. Load language (restores from localStorage automatically in i18n.js)
  const lang = localStorage.getItem('hu_equity_tax_lang') ?? 'hu';
  await loadLang(lang);
  renderAll();

  // 2. Initialise language toggle
  initLangToggle();

  // 3. Restore mode from localStorage
  const savedMode = localStorage.getItem(MODE_KEY);
  if (savedMode === 'onellenorzes') {
    applyMode('onellenorzes');
  } else {
    applyMode('current');
  }

  // 4. Initialise UI controls
  initModeToggle();
  initYearSelector();
  initClearData();

  // 5. Lazily initialise UI modules (they register their own event listeners)
  // These imports are deferred so scaffold + i18n work without UI modules present
  const uiModules = await Promise.allSettled([
    import('./ui/transaction-form.js').then(m => m.initTransactionForm?.()),
    import('./ui/ledger-table.js').then(m => m.initLedgerTable?.()),
    import('./ui/results-panel.js').then(m => m.initResultsPanel?.()),
    import('./ui/advance-panel.js').then(m => m.initAdvancePanel?.()),
    import('./ui/self-audit-panel.js').then(m => m.initSelfAuditPanel?.()),
    import('./ui/payment-guide.js').then(m => m.initPaymentGuide?.()),
  ]);

  // Log any module failures (non-fatal in scaffold stage)
  uiModules.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.warn(`[app] UI module ${i} failed to load:`, result.reason);
    }
  });

  // 6. Trigger initial render — deferred so dynamic imports finish registering listeners first.
  setTimeout(() => document.dispatchEvent(new CustomEvent('ledger:changed')), 0);
}

document.addEventListener('DOMContentLoaded', init);
