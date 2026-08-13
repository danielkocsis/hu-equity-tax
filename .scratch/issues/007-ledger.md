# 007 — Ledger

**Blocking:** 008, 009  
**Blocked by:** 001, 003

## Context
Read `AGENTS.md` (ledger.js module contract and Transaction object schema).  
Read `SPEC.md §6.11` (localStorage keys).

## Goal
Implement `js/ledger.js` — the in-memory + localStorage transaction store.

## Deliverables

### `js/ledger.js`

```js
// localStorage key: "hu_equity_tax_ledger"

/** Add a transaction. Assigns a uuid-v4 id. Returns the added transaction. */
export function add(tx) { ... }

/** Remove a transaction by id. Returns true if found, false if not. */
export function remove(id) { ... }

/** Replace a transaction by id. Returns the updated transaction or null. */
export function update(id, patch) { ... }

/** Returns all transactions sorted by date descending. */
export function getAll() { ... }

/** Returns transactions for a specific tax year. */
export function getByYear(year) { ... }

/** Returns all distinct tax years present in the ledger, sorted ascending. */
export function getYears() { ... }

/** Clears all transactions and clears localStorage. */
export function clear() { ... }

/** Persists current state to localStorage. Called internally after every mutation. */
function persist() { ... }

/** Loads state from localStorage on module init. */
function restore() { ... }
```

**UUID generation:** Use `crypto.randomUUID()` (available in all modern browsers, no library needed).

**localStorage format:** JSON array of transaction objects.

**Auto-restore:** Call `restore()` immediately when the module is first imported.

### Done conditions
- [ ] `add({type:"RSU_VEST", date:"2024-03-15", tax_year:2024, ...})` returns transaction with `id` set
- [ ] `getByYear(2024)` returns only 2024 transactions
- [ ] After page refresh, `getAll()` returns the same transactions (localStorage persistence)
- [ ] `clear()` empties the in-memory array and removes from localStorage
- [ ] `update(id, {notes:"test"})` merges the patch without overwriting other fields
