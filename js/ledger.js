/**
 * Ledger module — in-memory + localStorage transaction store.
 * Auto-restores from localStorage on module import.
 */

const STORAGE_KEY = 'hu_equity_tax_ledger';

/** @type {Array<Object>} */
let transactions = [];

/**
 * Persists current state to localStorage.
 * @private
 */
function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

/**
 * Loads state from localStorage. Called on module init.
 * @private
 */
function restore() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      transactions = parsed;
    }
  } catch {
    console.warn('[ledger] Failed to parse localStorage data — starting fresh.');
    transactions = [];
  }
}

/**
 * Adds a transaction to the ledger.
 * Assigns a uuid-v4 id automatically.
 * @param {Object} tx - Transaction object (without id)
 * @returns {Object} The added transaction with id set
 */
export function add(tx) {
  const withId = { ...tx, id: crypto.randomUUID() };
  transactions.push(withId);
  persist();
  return withId;
}

/**
 * Removes a transaction by id.
 * @param {string} id - Transaction id
 * @returns {boolean} True if found and removed, false otherwise
 */
export function remove(id) {
  const before = transactions.length;
  transactions = transactions.filter(tx => tx.id !== id);
  if (transactions.length < before) {
    persist();
    return true;
  }
  return false;
}

/**
 * Merges a patch into a transaction by id.
 * Does not overwrite fields not present in patch.
 * @param {string} id - Transaction id
 * @param {Object} patch - Partial transaction fields to merge
 * @returns {Object|null} Updated transaction or null if not found
 */
export function update(id, patch) {
  const idx = transactions.findIndex(tx => tx.id === id);
  if (idx === -1) return null;
  transactions[idx] = { ...transactions[idx], ...patch };
  persist();
  return transactions[idx];
}

/**
 * Returns all transactions sorted by date descending.
 * @returns {Array<Object>}
 */
export function getAll() {
  return [...transactions].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Returns all transactions for a specific tax year.
 * @param {number} year - Tax year (e.g. 2024)
 * @returns {Array<Object>}
 */
export function getByYear(year) {
  return transactions.filter(tx => tx.tax_year === year);
}

/**
 * Returns all distinct tax years present in the ledger, sorted ascending.
 * @returns {Array<number>}
 */
export function getYears() {
  const years = new Set(transactions.map(tx => tx.tax_year));
  return [...years].sort((a, b) => a - b);
}

/**
 * Clears all transactions and removes the localStorage entry.
 */
export function clear() {
  transactions = [];
  localStorage.removeItem(STORAGE_KEY);
}

// Auto-restore on module import
restore();
