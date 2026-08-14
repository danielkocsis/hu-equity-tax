/**
 * Advance Panel UI — quarterly SZJA/SZOCHO advance schedule.
 * Ticket 011 — Quarterly Advance Tax Panel
 * SPEC.md §6.7, AGENTS.md (advance-tax.js contract)
 * TAX-ANALYSIS.md §6
 *
 * Renders into <section id="advance"> (current-year mode only).
 * Listens for 'ledger:changed' and 'mode:changed'; re-renders.
 * Shows quarterly advance table with DTT-aware filtering.
 */

import { getAll } from '../ledger.js';
import { getAdvanceSchedule } from '../advance-tax.js';
import { t } from '../i18n.js';

/** @type {Object|null} */
let allRules = null;

/** @type {{mode: string, year: number}} */
let currentModeState = { mode: 'current', year: new Date().getFullYear() };

/**
 * Loads tax-rules.json if not already cached.
 * @returns {Promise<Object>}
 */
async function loadRules() {
  if (allRules) return allRules;
  const resp = await fetch('data/tax-rules.json');
  if (!resp.ok) throw new Error('[advance-panel] Failed to load tax-rules.json');
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
 * Renders the advance panel.
 * @param {HTMLElement} mount
 */
async function render(mount) {
  if (currentModeState.mode !== 'current') {
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
    mount.innerHTML = `<p class="rate-warning">${t('advance.no_dtt')}</p>`;
    return;
  }

  const schedule = getAdvanceSchedule(allTx, year, yearRules);

  const frag = document.createDocumentFragment();

  // Check for US events in 2024+ — show DTT termination note
  const hasUsTx = allTx.some(tx =>
    tx.tax_year === year &&
    tx.source_country === 'US' &&
    ['RSU_VEST', 'ESOP_EXERCISE', 'ESPP_PURCHASE', 'SHARE_AWARD'].includes(tx.type),
  );

  if (hasUsTx && !yearRules.us_hu_dtt_active) {
    const note = document.createElement('p');
    note.className = 'advance-dtt-note rate-warning';
    note.textContent = t('advance.us_no_dtt');
    frag.appendChild(note);
  }

  if (schedule.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'advance-empty';
    msg.textContent = t('advance.below_threshold');
    frag.appendChild(msg);
  } else {
    const table = document.createElement('table');
    table.className = 'advance-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>${t('advance.col.quarter')}</th>
          <th>${t('advance.col.period')}</th>
          <th>${t('advance.col.deadline')}</th>
          <th class="num">${t('advance.col.szja')}</th>
          <th class="num">${t('advance.col.szocho')}</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    for (const entry of schedule) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${entry.quarter}</td>
        <td>${entry.period_label}</td>
        <td>${entry.deadline_iso}</td>
        <td class="num">${huf(entry.szja_due)}</td>
        <td class="num">${huf(entry.szocho_due)}</td>
      `;
      tbody.appendChild(tr);
    }

    frag.appendChild(table);
  }

  // Footer with account numbers
  const footer = document.createElement('p');
  footer.className = 'advance-footer';
  footer.textContent = t('advance.footer.accounts');
  frag.appendChild(footer);

  mount.innerHTML = '';
  mount.appendChild(frag);
}

/**
 * Initialises the advance panel UI.
 * Called once by app.js bootstrap.
 */
export function initAdvancePanel() {
  const mount = document.getElementById('advance-panel-mount');
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
