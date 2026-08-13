/**
 * Language toggle UI — wires #lang-toggle button to i18n setLang().
 * Ticket 002 — i18n and language toggle
 */

import { setLang, getLang, t } from '../i18n.js';

/**
 * Initialises the language toggle button.
 * Updates button label to show the OTHER language (HU when EN is active; EN when HU is active).
 */
export function initLangToggle() {
  const btn = document.getElementById('lang-toggle');
  if (!btn) return;

  updateLabel(btn);

  btn.addEventListener('click', async () => {
    const next = getLang() === 'hu' ? 'en' : 'hu';
    await setLang(next);
    updateLabel(btn);
    // Dispatch event so other components can react if needed
    document.dispatchEvent(new CustomEvent('lang:changed', { detail: { lang: next } }));
  });
}

/**
 * Updates the toggle button label to show the language it will switch TO.
 * @param {HTMLButtonElement} btn
 * @private
 */
function updateLabel(btn) {
  btn.textContent = t('lang.toggle');
  btn.setAttribute('aria-label', getLang() === 'hu' ? 'Switch to English' : 'Váltás magyarra');
}
