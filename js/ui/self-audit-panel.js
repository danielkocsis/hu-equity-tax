/**
 * Self-Audit Panel UI — önellenőrzés delta and indicative pótlék estimator.
 * Ticket 012 — Payment Guide and Önellenőrzés Panel
 * SPEC.md §6.8, AGENTS.md (self-audit.js contract, defensive design §2)
 *
 * Renders into <section id="self-audit"> (önellenőrzés mode only).
 * Shows: should-have-paid, delta, indicative késedelmi pótlék, indicative önellenőrzési pótlék.
 * All amounts labelled "Tájékoztató összeg / Indicative estimate".
 * Primary CTA: NAV pótlékszámítás link (AGENTS.md §2).
 */

import { getAll, getYears } from '../ledger.js';
import { aggregateYear } from '../tax-engine.js';
import { estimatePotlek } from '../self-audit.js';
import { t } from '../i18n.js';

/** @type {Object|null} */
let allRules = null;

/** @type {{mode: string, year: number}} */
let currentModeState = { mode: 'current', year: new Date().getFullYear() };

const NAV_POTLEK_URL = 'https://nav.gov.hu/ugyfeliranytu/eljarasi_kerdesek/Kalkulatorok/potlekszamitas';

/**
 * Loads tax-rules.json if not already cached.
 * @returns {Promise<Object>}
 */
async function loadRules() {
  if (allRules) return allRules;
  const resp = await fetch('data/tax-rules.json');
  if (!resp.ok) throw new Error('[self-audit-panel] Failed to load tax-rules.json');
  allRules = await resp.json();
  return allRules;
}

/**
 * Formats a HUF integer.
 * @param {number} n
 * @returns {string}
 */
function huf(n) {
  return Math.round(n).toLocaleString('hu-HU') + ' HUF';
}

/**
 * Renders the self-audit panel.
 * @param {HTMLElement} mount
 */
async function render(mount) {
  if (currentModeState.mode !== 'onellenorzes') {
    mount.innerHTML = '';
    return;
  }

  const { year } = currentModeState;
  const allTx = getAll();

  let rules;
  try {
    rules = await loadRules();
  } catch {
    mount.innerHTML = `<p class="rate-warning">${t('error.fetch_failed')}</p>`;
    return;
  }

  const yearRules = rules[String(year)];
  if (!yearRules) {
    mount.innerHTML = '';
    return;
  }

  const yearTx = allTx.filter(tx => tx.tax_year === year);
  const agg = aggregateYear(yearTx, year, yearRules, 0);
  const shouldHavePaid = agg.szja_total;

  // Original deadline for this year: May 20 of year+1
  const originalDeadline = `${year + 1}-05-20`;
  const todayDate = new Date().toISOString().slice(0, 10);

  // Check for adjacent ETÜ years
  const allYears = getYears();
  const hasAdjacentEtü = allYears.some(yr =>
    Math.abs(yr - year) === 1 && allTx.some(tx => tx.tax_year === yr && tx.type === 'SHARE_SALE'),
  );

  // Build panel HTML
  const panel = document.createElement('div');
  panel.className = 'self-audit-panel';

  // Adjacent ETÜ warning
  if (hasAdjacentEtü) {
    const adjWarn = document.createElement('p');
    adjWarn.className = 'result-warning';
    adjWarn.textContent = t('self_audit.adjacent_warning');
    panel.appendChild(adjWarn);
  }

  // Summary: should-have-paid
  const summaryDl = document.createElement('dl');
  summaryDl.className = 'result-summary';

  const addRow = (labelKey, value) => {
    const dt = document.createElement('dt');
    dt.textContent = t(labelKey);
    const dd = document.createElement('dd');
    dd.textContent = value;
    summaryDl.appendChild(dt);
    summaryDl.appendChild(dd);
  };

  addRow('self_audit.should_have_paid', huf(shouldHavePaid));
  panel.appendChild(summaryDl);

  // Declared amount input
  const inputGroup = document.createElement('div');
  inputGroup.className = 'field-group';
  const inputLabel = document.createElement('label');
  inputLabel.className = 'field-label';
  inputLabel.setAttribute('for', 'sa-declared');
  inputLabel.textContent = t('self_audit.declared_label');
  const declaredInput = document.createElement('input');
  declaredInput.type = 'number';
  declaredInput.id = 'sa-declared';
  declaredInput.className = 'input';
  declaredInput.min = '0';
  declaredInput.step = '1';
  declaredInput.placeholder = '0';
  inputGroup.appendChild(inputLabel);
  inputGroup.appendChild(declaredInput);
  panel.appendChild(inputGroup);

  // Results area (filled in by computeAndRender)
  const resultsArea = document.createElement('div');
  resultsArea.className = 'self-audit-results';
  panel.appendChild(resultsArea);

  // Payment date input
  const dateGroup = document.createElement('div');
  dateGroup.className = 'field-group';
  const dateLabel = document.createElement('label');
  dateLabel.className = 'field-label';
  dateLabel.setAttribute('for', 'sa-payment-date');
  dateLabel.textContent = 'Befizetés időpontja / Payment date';
  const paymentDateInput = document.createElement('input');
  paymentDateInput.type = 'date';
  paymentDateInput.id = 'sa-payment-date';
  paymentDateInput.className = 'input';
  paymentDateInput.value = todayDate;
  dateGroup.appendChild(dateLabel);
  dateGroup.appendChild(paymentDateInput);
  panel.appendChild(dateGroup);

  // NAV primary CTA — always prominent
  const navBtn = document.createElement('a');
  navBtn.className = 'btn btn-primary nav-potlek-link';
  navBtn.href = NAV_POTLEK_URL;
  navBtn.target = '_blank';
  navBtn.rel = 'noopener noreferrer';
  navBtn.textContent = t('self_audit.nav_link');
  panel.appendChild(navBtn);

  // Indicative label
  const indicative = document.createElement('p');
  indicative.className = 'indicative-note';
  indicative.textContent = t('self_audit.indicative_label');
  panel.appendChild(indicative);

  /**
   * Updates the results area with computed pótlék values.
   */
  function computeAndRender() {
    const declared = parseFloat(declaredInput.value) || 0;
    const paymentDate = paymentDateInput.value || todayDate;
    const delta = Math.max(0, shouldHavePaid - declared);

    const potlek = estimatePotlek({
      delta_huf: delta,
      original_deadline: originalDeadline,
      payment_date: paymentDate,
      mnb_base_rates: yearRules.mnb_base_rates ?? [],
    });

    resultsArea.innerHTML = '';
    const dl = document.createElement('dl');
    dl.className = 'result-summary';

    const addResultRow = (labelKey, value) => {
      const dt = document.createElement('dt');
      dt.textContent = t(labelKey);
      const dd = document.createElement('dd');
      dd.textContent = value;
      dl.appendChild(dt);
      dl.appendChild(dd);
    };

    addResultRow('self_audit.delta', huf(delta));
    addResultRow('self_audit.kesedelmi', huf(potlek.kesedelmi_huf));
    addResultRow('self_audit.onellenorzes_potlek', huf(potlek.onellenorzes_huf));

    resultsArea.appendChild(dl);
  }

  declaredInput.addEventListener('input', computeAndRender);
  paymentDateInput.addEventListener('change', computeAndRender);
  computeAndRender();

  mount.innerHTML = '';
  mount.appendChild(panel);
}

/**
 * Initialises the self-audit panel UI.
 * Called once by app.js bootstrap.
 */
export function initSelfAuditPanel() {
  const mount = document.getElementById('self-audit-panel-mount');
  if (!mount) return;

  const refresh = () => render(mount);

  document.addEventListener('ledger:changed', refresh);
  document.addEventListener('lang:changed', refresh);
  document.addEventListener('mode:changed', e => {
    currentModeState = { mode: e.detail.mode, year: e.detail.year };
    refresh();
  });

  refresh();
}
