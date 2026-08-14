/**
 * Payment Guide UI — NAV payment cards with copy buttons.
 * Ticket 012 — Payment Guide and Önellenőrzés Panel
 * SPEC.md §6.9, AGENTS.md (payment-guide.js contract)
 *
 * Renders into <section id="payment"> via #payment-guide-mount.
 * Adóazonosító persisted in localStorage key 'hu_equity_tax_adoid'.
 * Each card: tax name (bilingual), HUF amount, account (copy), IBAN (copy),
 * közlemény pre-filled (copy), deadline.
 */

import { getAll, getYears } from '../ledger.js';
import { aggregateYear } from '../tax-engine.js';
import { generateCards } from '../payment-guide.js';
import { t } from '../i18n.js';

const ADOID_KEY = 'hu_equity_tax_adoid';

/** @type {Object|null} */
let allRules = null;

/**
 * Loads tax-rules.json if not already cached.
 * @returns {Promise<Object>}
 */
async function loadRules() {
  if (allRules) return allRules;
  const resp = await fetch('data/tax-rules.json');
  if (!resp.ok) throw new Error('[payment-guide] Failed to load tax-rules.json');
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
 * Creates a copy button for a text value.
 * @param {string} text
 * @returns {HTMLElement}
 */
function makeCopyBtn(text) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-ghost btn-sm copy-btn';
  btn.textContent = t('payment.copy_btn');
  btn.setAttribute('aria-label', `Copy: ${text}`);
  btn.addEventListener('click', () => {
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = t('payment.copied');
      setTimeout(() => { btn.textContent = t('payment.copy_btn'); }, 2000);
    }).catch(() => {
      btn.textContent = '!';
    });
  });
  return btn;
}

/**
 * Builds a payment card element.
 * @param {Object} card - Card data from generateCards()
 * @returns {HTMLElement}
 */
function buildPaymentCard(card) {
  const div = document.createElement('div');
  div.className = 'payment-card';

  // Card heading: tax name (bilingual via i18n key)
  const heading = document.createElement('h3');
  heading.className = 'payment-card-heading';
  heading.textContent = t(card.tax_name_key);
  div.appendChild(heading);

  const dl = document.createElement('dl');
  dl.className = 'payment-card-details';

  /**
   * Adds a detail row with an optional copy button.
   * @param {string} labelKey
   * @param {string} value
   * @param {boolean} [copyable=false]
   */
  const addDetail = (labelKey, value, copyable = false) => {
    const dt = document.createElement('dt');
    dt.textContent = t(labelKey);
    const dd = document.createElement('dd');
    dd.className = 'payment-detail-value';

    const valueSpan = document.createElement('span');
    valueSpan.textContent = value;
    dd.appendChild(valueSpan);

    if (copyable) {
      dd.appendChild(makeCopyBtn(value));
    }

    dl.appendChild(dt);
    dl.appendChild(dd);
  };

  addDetail('payment.card.amount', huf(card.amount_huf));
  addDetail('payment.card.account', card.account, true);
  addDetail('payment.card.iban', card.iban, true);
  addDetail('payment.card.kozlemeny', card.kozlemeny || '—', !!card.kozlemeny);
  addDetail('payment.card.deadline', card.deadline_iso);

  div.appendChild(dl);
  return div;
}

/**
 * Renders the payment guide panel.
 * @param {HTMLElement} mount
 */
async function render(mount) {
  const years = getYears();
  const paymentSection = document.getElementById('payment');

  if (years.length === 0) {
    if (paymentSection) paymentSection.classList.add('hidden');
    mount.innerHTML = '';
    return;
  }

  let rules;
  try {
    rules = await loadRules();
  } catch {
    mount.innerHTML = `<p class="rate-warning">${t('error.fetch_failed')}</p>`;
    return;
  }

  const allTx = getAll();
  const savedAdoid = localStorage.getItem(ADOID_KEY) ?? '';

  // Build panel
  const panel = document.createElement('div');
  panel.className = 'payment-guide-panel';

  // Adóazonosító input (persisted; never transmitted)
  const adoidGroup = document.createElement('div');
  adoidGroup.className = 'field-group';
  const adoidLabel = document.createElement('label');
  adoidLabel.className = 'field-label';
  adoidLabel.setAttribute('for', 'pg-adoid');
  adoidLabel.textContent = t('payment.adoid.label');
  const adoidNote = document.createElement('p');
  adoidNote.className = 'liability-note';
  adoidNote.textContent = t('payment.adoid.note');
  const adoidInput = document.createElement('input');
  adoidInput.type = 'text';
  adoidInput.id = 'pg-adoid';
  adoidInput.className = 'input';
  adoidInput.maxLength = 10;
  adoidInput.pattern = '\d{10}';
  adoidInput.value = savedAdoid;
  adoidInput.placeholder = '8000000000';
  adoidGroup.appendChild(adoidLabel);
  adoidGroup.appendChild(adoidInput);
  adoidGroup.appendChild(adoidNote);
  panel.appendChild(adoidGroup);

  // Cards container
  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'payment-cards';
  panel.appendChild(cardsContainer);

  /**
   * Re-renders all payment cards for all years using current adóazonosító.
   */
  function renderCards() {
    const adoid = adoidInput.value.trim();
    cardsContainer.innerHTML = '';

    const sortedYears = [...years].sort((a, b) => b - a);
    let anyCards = false;

    for (const year of sortedYears) {
      const yearRules = rules[String(year)];
      if (!yearRules) continue;

      const yearTx = allTx.filter(tx => tx.tax_year === year);
      if (yearTx.length === 0) continue;

      const agg = aggregateYear(yearTx, year, yearRules, 0);
      const cards = generateCards(agg, year, adoid);

      if (cards.length === 0) continue;
      anyCards = true;

      const yearHeading = document.createElement('h3');
      yearHeading.className = 'payment-year-heading';
      yearHeading.textContent = String(year);
      cardsContainer.appendChild(yearHeading);

      for (const card of cards) {
        cardsContainer.appendChild(buildPaymentCard(card));
      }
    }

    if (paymentSection) {
      paymentSection.classList.toggle('hidden', !anyCards);
    }
  }

  adoidInput.addEventListener('input', () => {
    localStorage.setItem(ADOID_KEY, adoidInput.value.trim());
    renderCards();
  });

  renderCards();
  mount.innerHTML = '';
  mount.appendChild(panel);
}

/**
 * Initialises the payment guide UI.
 * Called once by app.js bootstrap.
 */
export function initPaymentGuide() {
  const mount = document.getElementById('payment-guide-mount');
  if (!mount) return;

  const refresh = () => render(mount);

  document.addEventListener('ledger:changed', refresh);
  document.addEventListener('lang:changed', refresh);

  refresh();
}
