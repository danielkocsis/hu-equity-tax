/**
 * Shared utility functions.
 * Kept minimal — only pure, side-effect-free helpers belong here.
 */

/**
 * Escapes a string for safe insertion into HTML content or attribute values.
 * Prevents XSS when interpolating untrusted data into innerHTML templates.
 *
 * @param {unknown} s - Value to escape (converted to string first)
 * @returns {string} HTML-escaped string
 */
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
