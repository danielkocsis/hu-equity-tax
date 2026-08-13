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
 * Updates the toggle button to show the flag of the language it will switch TO.
 * HU active → show 🇬🇧 (switch to English)
 * EN active → show 🇭🇺 (switch to Hungarian)
 * @param {HTMLButtonElement} btn
 * @private
 */
function updateLabel(btn) {
  const switchingTo = getLang() === 'hu' ? 'en' : 'hu';
  btn.innerHTML = switchingTo === 'en'
    ? '<span aria-hidden="true">🇬🇧</span>'
    : '<span aria-hidden="true">🇭🇺</span>';
  btn.setAttribute(
    'aria-label',
    switchingTo === 'en' ? 'Switch to English' : 'Váltás magyarra',
  );
}
