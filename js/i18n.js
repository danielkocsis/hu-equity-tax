/**
 * i18n module — bilingual HU/EN support via flat JSON locale files.
 * All user-visible strings must flow through t(). No hardcoded strings in JS or HTML.
 */

const STORAGE_KEY = 'hu_equity_tax_lang';
const DEFAULT_LANG = 'hu';

/** @type {Map<string, Record<string, string>>} */
const cache = new Map();

/** @type {string} */
let currentLang = DEFAULT_LANG;

/**
 * Loads a locale JSON file and caches it.
 * @param {string} code - Language code ('hu' or 'en')
 * @returns {Promise<void>}
 */
export async function loadLang(code) {
  if (!cache.has(code)) {
    const resp = await fetch(`locales/${code}.json`);
    if (!resp.ok) {
      console.error(`[i18n] Failed to load locale: ${code}`);
      cache.set(code, {});
      return;
    }
    const data = await resp.json();
    cache.set(code, data);
  }
  currentLang = code;
}

/**
 * Returns the translated string for the given key in the current language.
 * Falls back to the key itself if the key is missing (no crash).
 * @param {string} key - Dot-separated i18n key
 * @returns {string}
 */
export function t(key) {
  const strings = cache.get(currentLang) ?? {};
  return strings[key] ?? key;
}

/**
 * Returns the current active language code.
 * @returns {string}
 */
export function getLang() {
  return currentLang;
}

/**
 * Sets the active language, persists to localStorage, and re-renders all i18n elements.
 * @param {string} code - Language code ('hu' or 'en')
 * @returns {Promise<void>}
 */
export async function setLang(code) {
  await loadLang(code);
  currentLang = code;
  localStorage.setItem(STORAGE_KEY, code);
  // Keep the html[lang] attribute in sync for screen readers and browser spell-check.
  document.documentElement.lang = code;
  renderAll();
}

/**
 * Iterates all [data-i18n] DOM elements and sets their textContent to t(key).
 * Elements with data-i18n-attr also have the named attribute updated.
 */
export function renderAll() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
}

// Auto-init: read saved language on module import
const saved = localStorage.getItem(STORAGE_KEY);
if (saved && (saved === 'hu' || saved === 'en')) {
  currentLang = saved;
}
