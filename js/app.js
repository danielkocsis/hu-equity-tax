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
 */
function initClearData() {
  const btn = document.getElementById('clear-data-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const lang = getLang();
    const msg = lang === 'hu'
      ? 'Biztosan törli az összes mentett adatot? Ez a művelet nem vonható vissza.'
      : 'Are you sure you want to clear all saved data? This cannot be undone.';

    if (!confirm(msg)) return;

    clearLedger();
    clearOverrides();
    localStorage.removeItem(ADOID_KEY);
    localStorage.removeItem(MODE_KEY);
    // Reload to reset all UI state
    window.location.reload();
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

  // 6. Trigger initial render
  document.dispatchEvent(new CustomEvent('ledger:changed'));
}

document.addEventListener('DOMContentLoaded', init);
