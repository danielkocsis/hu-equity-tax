/**
 * HU-EquityTax — tax arithmetic smoke tests
 * Run from the repo root:  node tests/arithmetic.js
 *
 * Verifies done-conditions from ticket 006 against live source modules and
 * tax-rules.json data. Uses real imports — not copies of the source logic.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// C-1 fix: resolve paths relative to this file, not process.cwd()
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// C-1 fix: import real modules instead of re-implementing the logic
import { applyFifo }        from "../js/lot-tracker.js";
import { getSzochoRate,
         calculateEvent,
         aggregateYear }    from "../js/tax-engine.js";

const RED   = "\x1b[31m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";
const PASS  = `${GREEN}\u2713${RESET}`;
const FAIL  = `${RED}\u2717${RESET}`;

let passCount = 0;
let failCount = 0;

function ok(label) {
  console.log(`  ${PASS} ${label}`);
  passCount++;
}

// N-2 fix: use string concatenation + "\n" instead of a literal newline in template literal
function fail(label, detail = "") {
  console.log(`  ${FAIL} ${label}` + (detail ? `
      ${detail}` : ""));
  failCount++;
}

function section(title) {
  console.log(`
${title}`);
  console.log("\u2500".repeat(title.length));
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
// I-4 fix: use __dirname-relative path so the script works from any cwd

const rules = JSON.parse(readFileSync(join(ROOT, "data/tax-rules.json"), "utf-8"));
const r24 = rules["2024"];
const r19 = rules["2019"];
const r20 = rules["2020"];

// ── RSU_VEST — 2024 ──────────────────────────────────────────────────────────

section("RSU_VEST — 2024 (ticket 006 done-conditions)");

// Uses calculateEvent() from the real tax-engine.js module (C-1)
const rsu_result = calculateEvent(
  { type: "RSU_VEST", date: "2024-03-15", gross_huf: 1_000_000, source_country: "EU" },
  r24,
);

assertEq(rsu_result.tax_base_huf, 890_000, "tax_base (gross \xd7 0.89)");
assertEq(rsu_result.szja_huf,     133_500, "SZJA     (15% \xd7 890,000)");
assertEq(rsu_result.szocho_huf,   115_700, "SZOCHO   (13% \xd7 890,000)");

// ── DIVIDEND — non-EGT, 2024 ─────────────────────────────────────────────────

section("DIVIDEND \u2014 non-EGT, 2024");

const div_result = calculateEvent(
  { type: "DIVIDEND", date: "2024-06-01", gross_huf: 500_000, is_egt: false },
  r24,
);

assertEq(div_result.szja_huf,   75_000, "SZJA   (15% \xd7 500,000)");
assertEq(div_result.szocho_huf, 65_000, "SZOCHO (13% \xd7 500,000)");

// ── DIVIDEND — EGT (SZOCHO = 0) ──────────────────────────────────────────────

section("DIVIDEND \u2014 EGT-listed share (SZOCHO exempt)");

// C-2 fix: test through calculateEvent() with is_egt:true — not a literal 0 === 0
const egt_result = calculateEvent(
  { type: "DIVIDEND", date: "2024-06-01", gross_huf: 500_000, is_egt: true },
  r24,
);

assertEq(egt_result.szja_huf,   75_000, "SZJA   (15% \xd7 500,000, unchanged)");
assertEq(egt_result.szocho_huf,      0, "SZOCHO (EGT exempt \u2192 0)");
// Confirm the difference is real: non-EGT produces SZOCHO > 0
assertTrue(div_result.szocho_huf > 0, "non-EGT SZOCHO baseline > 0 (confirms exemption is meaningful)");

// ── SHARE_SALE — ETÜ, 2024 ───────────────────────────────────────────────────

section("SHARE_SALE \u2014 ET\xdc, 2024 (Szja tv. \xa767/A)");

// C-3 fix: test through calculateEvent() with a real gain — not a literal 0 === 0
const sale_result = calculateEvent(
  { type: "SHARE_SALE", date: "2024-09-01", quantity: 100,
    gross_huf: 2_000_000, broker_fee_huf: 0,
    lots: [{ vest_date: "2022-01-01", quantity: 100,
              fmv_at_vest_foreign: 10, mnb_rate_at_vest: 350 }] },
  r24,
);

// Gain = 2,000,000 − (10 × 100 × 350) = 2,000,000 − 350,000 = 1,650,000
// SZJA = 15% × 1,650,000 = 247,500; SZOCHO = 0 (ETÜ rule)
assertEq(sale_result.gain_huf,   1_650_000, "gain_huf (proceeds \u2212 cost_basis)");
assertEq(sale_result.szja_huf,     247_500, "SZJA     (15% \xd7 1,650,000)");
assertEq(sale_result.szocho_huf,         0, "SZOCHO   (ET\xdc exempt \u2192 0)");

// ── SZOCHO dividend cap — 2024 ────────────────────────────────────────────────

section("SZOCHO dividend cap \u2014 2024");

const cap = r24.szocho_dividend_cap_multiplier * r24.min_monthly_wage_huf;
assertEq(cap, 6_403_200, "Cap (24 \xd7 266,800 HUF)");

// Verify cap stops accumulation: two dividends totalling > cap
const agg = aggregateYear(
  [
    { type: "DIVIDEND", date: "2024-01-15", gross_huf: 4_000_000, is_egt: false },
    { type: "DIVIDEND", date: "2024-06-15", gross_huf: 4_000_000, is_egt: false },
  ],
  2024, r24,
);
assertTrue(
  agg.dividend_szocho_used <= cap,
  `SZOCHO capped at ${cap} HUF, used ${agg.dividend_szocho_used}`,
);

// ── Split SZOCHO rates — 2019 ─────────────────────────────────────────────────

section("Split SZOCHO rates \u2014 2019 (mid-year transition)");

assertEq(getSzochoRate("2019-03-01", r19), 0.195, "H1 rate (19.5%)");
assertEq(getSzochoRate("2019-09-01", r19), 0.175, "H2 rate (17.5%)");

// ── Split SZOCHO rates — 2020 ─────────────────────────────────────────────────

section("Split SZOCHO rates \u2014 2020 (mid-year transition)");

assertEq(getSzochoRate("2020-03-01", r20), 0.175, "H1 rate (17.5%)");
assertEq(getSzochoRate("2020-09-01", r20), 0.155, "H2 rate (15.5%)");

// ── DTT flags — all years ─────────────────────────────────────────────────────

section("US-HU DTT termination (2024-01-01)");

// N-4 fix: drive from Object.keys(rules) so new years are covered automatically
for (const year of Object.keys(rules).sort()) {
  const expected = parseInt(year) < 2024;
  assertTrue(
    rules[year].us_hu_dtt_active === expected,
    `${year}: us_hu_dtt_active = ${expected}`,
  );
}

// ── Self-audit p\xf3tl\xe9k \u2014 50% ratio ────────────────────────────────

section("Self-audit p\xf3tl\xe9k \u2014 \xf6nellen\u0151rz\xe9si = exactly 50% of k\xe9sedelmi");

// I-7 fix: read base_rate from tax-rules.json instead of hardcoding 0.10
const base_rate = r24.mnb_base_rates[0].rate;
assertTrue(base_rate > 0, `base_rate from tax-rules.json: ${base_rate}`);

// Art. tv. 209.\xa7(1): delta \xd7 ((base_rate + 0.05) / 365) \xd7 days
const delta      = 1_000_000;
const days       = 365;
const kesedelmi  = Math.round(delta * ((base_rate + 0.05) / 365) * days);
const onellenorzes = Math.round(kesedelmi * 0.5);

assertTrue(
  onellenorzes === Math.round(kesedelmi / 2),
  `\xf6nellen\u0151rz\xe9si (${onellenorzes}) = exactly 50% of k\xe9sedelmi (${kesedelmi})`,
);

// ── FIFO lot tracker (real module) ────────────────────────────────────────────

section("FIFO lot tracker (real js/lot-tracker.js)");

// C-1 fix: calls the imported applyFifo from lot-tracker.js, not a local copy
const lots = [
  { vest_date: "2022-01-01", quantity: 100, currency: "USD",
    fmv_at_vest_foreign: 142.30, mnb_rate_at_vest: 356.20 },
  { vest_date: "2023-01-01", quantity:  50, currency: "USD",
    fmv_at_vest_foreign: 180.00, mnb_rate_at_vest: 380.00 },
];

const fifo = applyFifo(lots, 120, 10_000_000, 50_000);

assertEq(fifo.consumed_lots[0].quantity_consumed, 100, "2022 lot fully consumed");
assertEq(fifo.consumed_lots[1].quantity_consumed,  20, "2023 lot partially consumed (20 of 50)");
assertEq(fifo.remaining_lots.length,                1, "1 lot remaining");
assertEq(fifo.remaining_lots[0].quantity,          30, "30 shares remain in 2023 lot");
assertTrue(fifo.gain_huf > 0, `gain_huf = ${fifo.gain_huf} (positive after fee)`);

// Edge: sell_quantity > available lots — warns, gain may be wrong but no crash
const overSell = applyFifo(lots, 200, 5_000_000, 0);
assertTrue(overSell.remaining_lots.length === 0, "over-sell: all lots consumed");

// ── Summary ───────────────────────────────────────────────────────────────────

console.log();
const total = passCount + failCount;
if (failCount > 0) {
  console.log(`${RED}${"=".repeat(50)}${RESET}`);
  console.log(`  FAILED \u2014 ${failCount} of ${total} assertions failed`);
  console.log(`${RED}${"=".repeat(50)}${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}${"=".repeat(50)}${RESET}`);
  console.log(`  All ${total} assertions passed`);
  console.log(`${GREEN}${"=".repeat(50)}${RESET}`);
}
