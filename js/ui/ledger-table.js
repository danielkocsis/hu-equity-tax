/**
 * Ledger Table UI — transaction list with edit/delete, grouped by tax year.
 * Ticket 009 — Ledger Table UI
 * SPEC.md §6.4, AGENTS.md (ledger-table.js contract)
 *
 * Renders into <section id="ledger"> via #ledger-table-mount.
 * Listens for 'ledger:changed' and re-renders on every change.
 * Groups transactions by tax_year (descending), then by date (descending).
 * Computes SZJA and SZOCHO live via calculateEvent().
 */

import { getAll, remove as ledgerRemove } from '../ledger.js';
import { calculateEvent } from '../tax-engine.js';
import { t } from '../i18n.js';
import { escapeHtml } from '../utils.js';

/** @type {Object|null} Cached tax rules per year */
const rulesCache = {};

/**
 * Loads tax-rules.json if not already cached.
 * @returns {Promise<Object>}
 */
async function loadRules() {
  if (rulesCache._all) return rulesCache._all;
  const resp = await fetch('data/tax-rules.json');
  if (!resp.ok) throw new Error('[ledger-table] Failed to load tax-rules.json');
  rulesCache._all = await resp.json();
  return rulesCache._all;
}

/**
 * Returns the i18n label for an event type.
 * @param {string} type
 * @returns {string}
 */
function typeLabel(type) {
  const keyMap = {
    RSU_VEST:       'form.event_type.rsu_vest',
    ESOP_EXERCISE:  'form.event_type.esop_exercise',
    ESPP_PURCHASE:  'form.event_type.espp_purchase',
    SHARE_AWARD:    'form.event_type.share_award',
    SHARE_SALE:     'form.event_type.share_sale',
    DIVIDEND:       'form.event_type.dividend',
  };
  return t(keyMap[type] ?? type);
}

/**
 * Returns the i18n label for a source country code.
 * @param {string} country
 * @returns {string}
 */
function countryLabel(country) {
  const keyMap = {
    US:    'form.source_country.us',
    UK:    'form.source_country.uk',
    EU:    'form.source_country.eu',
    OTHER: 'form.source_country.other',
  };
  return t(keyMap[country] ?? country);
}

/**
 * Formats a number as a HUF integer string.
 * @param {number} n
 * @returns {string}
 */
function huf(n) {
  return Math.round(n).toLocaleString('hu-HU') + ' HUF';
}

/**
 * Renders the full ledger table into the mount element.
 * @param {HTMLElement} mount
 */
async function render(mount) {
  const all = getAll();
  const section = document.getElementById('ledger');

  if (all.length === 0) {
    if (section) section.classList.add('hidden');
    mount.innerHTML = `<p class="ledger-empty" data-i18n="ledger.empty">${t('ledger.empty')}</p>`;
    return;
  }

  if (section) section.classList.remove('hidden');

  let allRules;
  try {
    allRules = await loadRules();
  } catch {
    mount.innerHTML = `<p class="rate-warning">${t('error.fetch_failed')}</p>`;
    return;
  }

  // Group by tax_year descending
  const byYear = {};
  for (const tx of all) {
    const yr = tx.tax_year ?? parseInt((tx.date ?? '').slice(0, 4), 10);
    if (!byYear[yr]) byYear[yr] = [];
    byYear[yr].push(tx);
  }

  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  const frag = document.createDocumentFragment();

  for (const year of years) {
    const txs = byYear[year].slice().sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    const rules = allRules[String(year)];

    const yearHeading = document.createElement('h3');
    yearHeading.className = 'ledger-year-heading';
    yearHeading.textContent = t('ledger.year_group').replace('{year}', String(year));
    frag.appendChild(yearHeading);

    const table = document.createElement('table');
    table.className = 'ledger-table';

    table.innerHTML = `
      <thead>
        <tr>
          <th>${t('ledger.col.date')}</th>
          <th>${t('ledger.col.type')}</th>
          <th>${t('ledger.col.country')}</th>
          <th>${t('ledger.col.currency')}</th>
          <th class="num">${t('ledger.col.foreign_amount')}</th>
          <th class="num">${t('ledger.col.mnb_rate')}</th>
          <th class="num">${t('ledger.col.huf_gross')}</th>
          <th class="num">${t('ledger.col.szja')}</th>
          <th class="num">${t('ledger.col.szocho')}</th>
          <th>${t('ledger.col.actions')}</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    for (const tx of txs) {
      let szja = '—';
      let szocho = '—';

      if (rules) {
        try {
          const calc = calculateEvent(tx, rules);
          szja   = huf(calc.szja_huf);
          szocho = huf(calc.szocho_huf);
        } catch {
          // Leave as —
        }
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(tx.date)}</td>
        <td>${escapeHtml(typeLabel(tx.type))}</td>
        <td>${escapeHtml(countryLabel(tx.source_country))}</td>
        <td>${escapeHtml(tx.currency)}</td>
        <td class="num">${(tx.gross_foreign_amount ?? 0).toLocaleString('hu-HU', { maximumFractionDigits: 4 })}</td>
        <td class="num">${(tx.mnb_rate_used ?? 0).toLocaleString('hu-HU', { maximumFractionDigits: 4 })}</td>
        <td class="num">${huf(tx.gross_huf ?? 0)}</td>
        <td class="num">${szja}</td>
        <td class="num">${szocho}</td>
        <td class="ledger-actions"></td>
      `;

      const actions = tr.querySelector('.ledger-actions');

      // Edit button
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-ghost btn-sm';
      editBtn.textContent = t('ledger.btn.edit');
      editBtn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('ledger:edit', { detail: tx }));
      });
      actions.appendChild(editBtn);

      // Delete button
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-danger btn-sm';
      delBtn.textContent = t('ledger.btn.delete');

      // Two-step confirm inline (no confirm() — AGENTS.md constraint)
      let confirmPending = false;
      delBtn.addEventListener('click', () => {
        if (!confirmPending) {
          confirmPending = true;
          delBtn.textContent = '✓ ' + t('ledger.btn.delete') + '?';
          delBtn.classList.add('btn-danger-confirm');
          setTimeout(() => {
            confirmPending = false;
            delBtn.textContent = t('ledger.btn.delete');
            delBtn.classList.remove('btn-danger-confirm');
          }, 2500);
        } else {
          ledgerRemove(tx.id);
          document.dispatchEvent(new CustomEvent('ledger:changed'));
        }
      });
      actions.appendChild(delBtn);

      tbody.appendChild(tr);
    }

    frag.appendChild(table);
  }

  mount.innerHTML = '';
  mount.appendChild(frag);
}

/**
 * Initialises the ledger table UI.
 * Called once by app.js bootstrap.
 */
export function initLedgerTable() {
  const mount = document.getElementById('ledger-table-mount');
  if (!mount) return;

  const refresh = () => render(mount);

  document.addEventListener('ledger:changed', refresh);
  document.addEventListener('lang:changed', refresh);

  refresh();
}
