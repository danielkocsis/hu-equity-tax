/**
 * Results Panel UI — annual tax summary and eSZJA filing guide.
 * Ticket 010 — eSZJA Mapper and Results Panel
 * SPEC.md §6.5, §6.6, AGENTS.md (results-panel.js contract, defensive design §1)
 *
 * Renders into <section id="results"> and <section id="eszja-map">.
 * Listens for 'ledger:changed'; re-renders.
 * Per-year tax cards with totals, ETÜ status, dividend cap, warning banners.
 * eSZJA mapper sub-section: table with row ID, form, description, HUF amount, copy button.
 * Legal citations required for every result row (AGENTS.md §1).
 */

import { getAll, getYears } from '../ledger.js';
import { aggregateYear } from '../tax-engine.js';
import { mapResults } from '../eszja-mapper.js';
import { t } from '../i18n.js';

/** @type {Object|null} */
let allRules = null;

const LEGAL_LINKS = {
  'eszja.legal.equity':   'https://net.jogtar.hu/jogszabaly?docid=99500117.TV',
  'eszja.legal.etü':      'https://net.jogtar.hu/jogszabaly?docid=99500117.TV',
  'eszja.legal.dividend': 'https://net.jogtar.hu/jogszabaly?docid=99500117.TV',
  'eszja.legal.szocho':   'https://net.jogtar.hu/jogszabaly?docid=a1800052.tv',
};

const WARNING_KEY_MAP = {
  US_DTT_TERMINATED_2024: 'results.warning.us_2024',
  US_DTT_WAS_ACTIVE:      'results.warning.us_pre_2024',
  UK_DTT_ACTIVE:          'results.warning.uk',
  PRE_2016_DATE:          'results.warning.pre_2016',
  ETÜ_LOSS_DECLARED:      'results.warning.etü_loss',
};

/**
 * Loads tax-rules.json if not already cached.
 * @returns {Promise<Object>}
 */
async function loadRules() {
  if (allRules) return allRules;
  const resp = await fetch('data/tax-rules.json');
  if (!resp.ok) throw new Error('[results-panel] Failed to load tax-rules.json');
  allRules = await resp.json();
  return allRules;
}

/**
 * Formats a number as a HUF integer.
 * @param {number} n
 * @returns {string}
 */
function huf(n) {
  return Math.round(n).toLocaleString('hu-HU') + ' HUF';
}

/**
 * Creates a copy button that writes text to clipboard and shows "✓ Copied" for 2s.
 * @param {string} text - Text to copy
 * @returns {HTMLElement}
 */
function makeCopyBtn(text) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-ghost btn-sm copy-btn';
  btn.textContent = t('eszja.copy_btn');
  btn.addEventListener('click', () => {
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = t('eszja.copied');
      setTimeout(() => { btn.textContent = t('eszja.copy_btn'); }, 2000);
    }).catch(() => {
      btn.textContent = '!';
    });
  });
  return btn;
}

/**
 * Renders warning banners for an aggregated result.
 * @param {string[]} warnings
 * @returns {HTMLElement}
 */
function renderWarnings(warnings) {
  const frag = document.createDocumentFragment();
  const uniqueWarnings = new Set(warnings);

  for (const code of uniqueWarnings) {
    const key = WARNING_KEY_MAP[code];
    if (!key) continue;
    const p = document.createElement('p');
    p.className = 'result-warning';
    p.textContent = t(key);
    frag.appendChild(p);
  }

  return frag;
}

/**
 * Builds one per-year tax summary card.
 * @param {number} year
 * @param {Object} agg - Result from aggregateYear()
 * @returns {HTMLElement}
 */
function buildYearCard(year, agg) {
  const card = document.createElement('div');
  card.className = 'result-card';

  const heading = document.createElement('h3');
  heading.className = 'result-card-heading';
  heading.textContent = t('results.heading').replace('{year}', String(year));
  card.appendChild(heading);

  // Warning banners
  if (agg.warnings?.length) {
    card.appendChild(renderWarnings(agg.warnings));
  }

  // Check for adjacent-year ETÜ (informational)
  const allYears = getYears();
  const hasAdjacentEtü = allYears.some(yr =>
    Math.abs(yr - year) === 1 && getAll().some(tx => tx.tax_year === yr && tx.type === 'SHARE_SALE'),
  );
  if (hasAdjacentEtü) {
    const adjWarn = document.createElement('p');
    adjWarn.className = 'result-warning';
    adjWarn.textContent = t('results.warning.etü_adjacent');
    card.appendChild(adjWarn);
  }

  // Summary rows
  const dl = document.createElement('dl');
  dl.className = 'result-summary';

  const addRow = (labelKey, value, highlight = false) => {
    const dt = document.createElement('dt');
    dt.textContent = t(labelKey);
    const dd = document.createElement('dd');
    dd.textContent = value;
    if (highlight) dd.className = 'result-highlight';
    dl.appendChild(dt);
    dl.appendChild(dd);
  };

  addRow('results.szja_total', huf(agg.szja_total), agg.szja_total > 0);
  addRow('results.szocho_total', huf(agg.szocho_total), agg.szocho_total > 0);

  if (agg.tb_total > 0) {
    addRow('results.tb_total', huf(agg.tb_total));
  }

  if (agg.etü_net_gain !== 0 || agg.etü_loss_declared > 0) {
    addRow('results.etü_net', huf(agg.etü_net_gain));
  }

  if (agg.etü_loss_declared > 0) {
    addRow('results.etü_carryforward', huf(agg.etü_loss_declared));
  }

  if (agg.has_dividends) {
    const capDt = document.createElement('dt');
    capDt.textContent = t('results.dividend_cap.label');
    const capDd = document.createElement('dd');
    capDd.textContent = t('results.dividend_cap.used')
      .replace('{used}', Math.round(agg.dividend_szocho_used).toLocaleString('hu-HU'))
      .replace('{cap}', Math.round(agg.dividend_szocho_cap).toLocaleString('hu-HU'));
    dl.appendChild(capDt);
    dl.appendChild(capDd);
  }

  card.appendChild(dl);

  return card;
}

/**
 * Builds the eSZJA mapper table for a year.
 * @param {number} year
 * @param {Array<Object>} rows - Output of mapResults()
 * @returns {HTMLElement}
 */
function buildEszjaTable(year, rows) {
  const section = document.createElement('div');
  section.className = 'eszja-year-section';

  const heading = document.createElement('h3');
  heading.className = 'eszja-year-heading';
  heading.textContent = `${year}`;
  section.appendChild(heading);

  if (rows.length === 0) return section;

  const table = document.createElement('table');
  table.className = 'eszja-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>${t('eszja.col.row_id')}</th>
        <th>${t('eszja.col.form')}</th>
        <th>${t('eszja.col.description')}</th>
        <th class="num">${t('eszja.col.amount')}</th>
        <th>${t('eszja.col.copy')}</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');

  for (const row of rows) {
    const tr = document.createElement('tr');

    // Description cell (bilingual + legal citation)
    const descCell = document.createElement('td');
    descCell.className = 'eszja-desc';
    const descHu = document.createElement('span');
    descHu.className = 'eszja-label-hu';
    descHu.textContent = row.label_hu;
    const descEn = document.createElement('span');
    descEn.className = 'eszja-label-en';
    descEn.textContent = row.label_en;

    // Legal citation link
    const legalLink = document.createElement('a');
    legalLink.className = 'legal-citation';
    legalLink.href = LEGAL_LINKS[row.legal_key] ?? '#';
    legalLink.target = '_blank';
    legalLink.rel = 'noopener noreferrer';
    legalLink.textContent = t(row.legal_key ?? 'eszja.legal.equity');

    descCell.appendChild(descHu);
    descCell.appendChild(document.createElement('br'));
    descCell.appendChild(descEn);
    descCell.appendChild(document.createElement('br'));
    descCell.appendChild(legalLink);

    // Amount cell
    const amtCell = document.createElement('td');
    amtCell.className = 'num';
    amtCell.textContent = huf(row.value_huf);

    // Copy button cell
    const copyCell = document.createElement('td');
    copyCell.appendChild(makeCopyBtn(row.copy_text));

    tr.innerHTML = `
      <td>${row.row_id}</td>
      <td>${row.form}</td>
    `;
    tr.appendChild(descCell);
    tr.appendChild(amtCell);
    tr.appendChild(copyCell);

    tbody.appendChild(tr);
  }

  section.appendChild(table);
  return section;
}

/**
 * Renders results and eSZJA map panels.
 * @param {HTMLElement} resultsMount
 * @param {HTMLElement} eszjaMount
 */
async function render(resultsMount, eszjaMount) {
  const years = getYears();
  const allTx  = getAll();

  const resultsSection = document.getElementById('results');
  const eszjaSection   = document.getElementById('eszja-map');

  if (years.length === 0) {
    if (resultsSection) resultsSection.classList.add('hidden');
    if (eszjaSection)   eszjaSection.classList.add('hidden');
    resultsMount.innerHTML = '';
    eszjaMount.innerHTML   = '';
    return;
  }

  let rules;
  try {
    rules = await loadRules();
  } catch {
    resultsMount.innerHTML = `<p class="rate-warning">${t('error.fetch_failed')}</p>`;
    return;
  }

  if (resultsSection) resultsSection.classList.remove('hidden');
  if (eszjaSection)   eszjaSection.classList.remove('hidden');

  const resultsFrag = document.createDocumentFragment();
  const eszjaFrag   = document.createDocumentFragment();

  const sortedYears = [...years].sort((a, b) => b - a);

  for (const year of sortedYears) {
    const yearRules = rules[String(year)];
    if (!yearRules) continue;

    const yearTx = allTx.filter(tx => tx.tax_year === year);

    // Compute prior-year ETÜ losses (simplified: sum loss from immediately prior year)
    const priorYearTx = allTx.filter(tx => tx.tax_year === year - 1 && tx.type === 'SHARE_SALE');
    const priorRules  = rules[String(year - 1)];
    let priorLosses = 0;
    if (priorYearTx.length && priorRules) {
      const priorAgg = aggregateYear(priorYearTx, year - 1, priorRules, 0);
      priorLosses = priorAgg.etü_loss_declared;
    }

    const agg = aggregateYear(yearTx, year, yearRules, priorLosses);

    resultsFrag.appendChild(buildYearCard(year, agg));

    // eSZJA mapper rows
    let eszjaRows = [];
    try {
      eszjaRows = await mapResults(agg, year);
    } catch {
      // Skip eSZJA section if schema unavailable for this year
    }

    if (eszjaRows.length > 0) {
      eszjaFrag.appendChild(buildEszjaTable(year, eszjaRows));
    }
  }

  resultsMount.innerHTML = '';
  resultsMount.appendChild(resultsFrag);

  eszjaMount.innerHTML = '';
  eszjaMount.appendChild(eszjaFrag);

  if (!eszjaMount.hasChildNodes()) {
    if (eszjaSection) eszjaSection.classList.add('hidden');
  }
}

/**
 * Initialises the results panel and eSZJA mapper UI.
 * Called once by app.js bootstrap.
 */
export function initResultsPanel() {
  const resultsMount = document.getElementById('results-panel-mount');
  const eszjaMount   = document.getElementById('eszja-map-mount');
  if (!resultsMount || !eszjaMount) return;

  const refresh = () => render(resultsMount, eszjaMount);

  document.addEventListener('ledger:changed', refresh);
  document.addEventListener('lang:changed', refresh);

  refresh();
}
