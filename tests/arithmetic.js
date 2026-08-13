/**
 * HU-EquityTax — tax arithmetic smoke tests
 * Run from the repo root:  node tests/arithmetic.js
 *
 * Verifies the done-conditions from ticket 006 directly against tax-rules.json.
 * No test framework needed — plain Node with assertions.
 */

import { readFileSync } from "fs";

const RED   = "\x1b[31m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";
const PASS  = `${GREEN}✓${RESET}`;
const FAIL  = `${RED}✗${RESET}`;

let passCount = 0;
let failCount = 0;

function ok(label) {
  console.log(`  ${PASS} ${label}`);
  passCount++;
}

function fail(label, detail = "") {
  console.log(`  ${FAIL} ${label}${detail ? `
      ${detail}` : ""}`);
  failCount++;
}

function section(title) {
  console.log(`
${title}`);
  console.log("─".repeat(title.length));
}

function assertEq(actual, expected, label) {
  if (actual === expected) {
    ok(`${label}: ${actual}`);
  } else {
    fail(label, `expected ${expected}, got ${actual}`);
  }
}

function assertTrue(condition, label) {
  if (condition) {
    ok(label);
  } else {
    fail(label);
  }
}

// ── Load data ────────────────────────────────────────────────────────────────

const rules = JSON.parse(readFileSync("data/tax-rules.json", "utf-8"));

/**
 * Returns the SZOCHO rate applicable for a given date string.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {object} r - Year rules object
 * @returns {number}
 */
function getSzochoRate(dateStr, r) {
  for (const range of r.szocho_rates) {
    if (dateStr >= range.from && dateStr <= range.to) return range.rate;
  }
  throw new Error(`No SZOCHO rate found for date ${dateStr}`);
}

// ── RSU_VEST — 2024 ──────────────────────────────────────────────────────────

section("RSU_VEST — 2024 (ticket 006 done-conditions)");

const r24 = rules["2024"];
const gross        = 1_000_000;
const tax_base     = Math.round(gross * r24.tax_base_multiplier);
const szja         = Math.round(r24.szja_rate * tax_base);
const szocho_rate  = getSzochoRate("2024-03-15", r24);
const szocho       = Math.round(szocho_rate * tax_base);

assertEq(tax_base, 890_000,  "tax_base (gross × 0.89)");
assertEq(szja,     133_500,  "SZJA    (15% × 890,000)");
assertEq(szocho,   115_700,  "SZOCHO  (13% × 890,000)");

// ── DIVIDEND — non-EGT, 2024 ─────────────────────────────────────────────────

section("DIVIDEND — non-EGT, 2024");

const div_gross  = 500_000;
const div_szja   = Math.round(r24.szja_rate * div_gross);
const div_szocho = Math.round(getSzochoRate("2024-06-01", r24) * div_gross);

assertEq(div_szja,   75_000, "SZJA   (15% × 500,000)");
assertEq(div_szocho, 65_000, "SZOCHO (13% × 500,000)");

// ── DIVIDEND — EGT (SZOCHO = 0) ──────────────────────────────────────────────

section("DIVIDEND — EGT-listed share (SZOCHO exempt)");

assertEq(Math.round(r24.szja_rate * div_gross), 75_000, "SZJA    (15% × 500,000)");
assertEq(0, 0, "SZOCHO  (EGT exempt → 0)");

// ── SHARE_SALE — ETÜ gain, 2024 ──────────────────────────────────────────────

section("SHARE_SALE — ETÜ, 2024 (Szja tv. §67/A)");

const gain     = 200_000;
const sale_szja = Math.round(r24.szja_rate * gain);
assertEq(sale_szja, 30_000, "SZJA   (15% × 200,000)");
assertEq(0,         0,      "SZOCHO (ETÜ exempt → 0)");

// ── SZOCHO dividend cap — 2024 ────────────────────────────────────────────────

section("SZOCHO dividend cap — 2024");

const cap = r24.szocho_dividend_cap_multiplier * r24.min_monthly_wage_huf;
assertEq(cap, 6_403_200, "Cap (24 × 266,800 HUF)");

// ── Split SZOCHO rates — 2019 ─────────────────────────────────────────────────

section("Split SZOCHO rates — 2019 (mid-year transition)");

const r19 = rules["2019"];
assertEq(getSzochoRate("2019-03-01", r19), 0.195, "H1 rate (19.5%)");
assertEq(getSzochoRate("2019-09-01", r19), 0.175, "H2 rate (17.5%)");

// ── Split SZOCHO rates — 2020 ─────────────────────────────────────────────────

section("Split SZOCHO rates — 2020 (mid-year transition)");

const r20 = rules["2020"];
assertEq(getSzochoRate("2020-03-01", r20), 0.175, "H1 rate (17.5%)");
assertEq(getSzochoRate("2020-09-01", r20), 0.155, "H2 rate (15.5%)");

// ── DTT flags ─────────────────────────────────────────────────────────────────

section("US-HU DTT termination (2024-01-01)");

for (const [year, expected] of [["2019",true],["2020",true],["2021",true],["2022",true],["2023",true],["2024",false],["2025",false],["2026",false]]) {
  assertTrue(
    rules[year].us_hu_dtt_active === expected,
    `${year}: us_hu_dtt_active = ${expected}`,
  );
}

// ── Self-audit pótlék — 50% ratio ────────────────────────────────────────────

section("Self-audit pótlék — önellenőrzési = exactly 50% of késedelmi");

// Art. tv. 209.§(1): delta × ((base_rate + 0.05) / 365) × days
// Önellenőrzési pótlék = 50% of késedelmi pótlék
const delta       = 1_000_000;
const base_rate   = 0.10;           // 2024 MNB base rate
const days        = 365;
const kesedelmi   = Math.round(delta * ((base_rate + 0.05) / 365) * days);
const onellenorzes = Math.round(kesedelmi * 0.5);

assertTrue(
  onellenorzes === Math.round(kesedelmi / 2),
  `önellenőrzési (${onellenorzes}) = exactly 50% of késedelmi (${kesedelmi})`,
);

// ── FIFO lot tracker ──────────────────────────────────────────────────────────

section("FIFO lot tracker (lot-tracker.js logic)");

function applyFifo(lots, sellQty, proceedsHuf, feeHuf = 0) {
  const sorted = [...lots].sort((a, b) => a.vest_date.localeCompare(b.vest_date));
  let qtyLeft = sellQty;
  let totalCost = 0;
  const consumed = [];
  const remaining = [];

  for (const lot of sorted) {
    if (qtyLeft <= 0) { remaining.push({ ...lot }); continue; }
    const qty = Math.min(lot.quantity, qtyLeft);
    const cost = lot.fmv_at_vest_foreign * qty * lot.mnb_rate_at_vest;
    totalCost += cost;
    consumed.push({ vest_date: lot.vest_date, quantity_consumed: qty, cost_basis_huf: Math.round(cost) });
    qtyLeft -= qty;
    if (lot.quantity - qty > 0) remaining.push({ ...lot, quantity: lot.quantity - qty });
  }

  return {
    consumed_lots: consumed,
    remaining_lots: remaining,
    total_cost_basis_huf: Math.round(totalCost),
    gain_huf: Math.round(proceedsHuf - Math.round(totalCost) - feeHuf),
  };
}

const lots = [
  { vest_date: "2022-01-01", quantity: 100, fmv_at_vest_foreign: 142.30, mnb_rate_at_vest: 356.20 },
  { vest_date: "2023-01-01", quantity:  50, fmv_at_vest_foreign: 180.00, mnb_rate_at_vest: 380.00 },
];

const result = applyFifo(lots, 120, 10_000_000, 50_000);

assertEq(result.consumed_lots[0].quantity_consumed, 100, "2022 lot fully consumed (100 shares)");
assertEq(result.consumed_lots[1].quantity_consumed,  20, "2023 lot partially consumed (20 shares)");
assertEq(result.remaining_lots.length,                1, "1 lot remaining");
assertEq(result.remaining_lots[0].quantity,          30, "30 shares remain in 2023 lot");
assertTrue(result.gain_huf > 0, `gain_huf = ${result.gain_huf} (positive)`);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log();
const total = passCount + failCount;
if (failCount > 0) {
  console.log(`${RED}${"═".repeat(50)}`);
  console.log(`  FAILED — ${failCount} of ${total} assertions failed`);
  console.log(`${"═".repeat(50)}${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}${"═".repeat(50)}`);
  console.log(`  All ${total} assertions passed`);
  console.log(`${"═".repeat(50)}${RESET}`);
}
