"""
HU-EquityTax -- static verification suite
Run from the repo root:  python3 tests/check.py

Checks:
  1. JSON validity          -- all *.json files parse
  2. Tax-rules integrity    -- required fields, correct rates and DTT flags
  3. eszja-schema           -- required years and row types present
  4. Locale parity          -- hu.json and en.json have identical key sets
  5. JS syntax              -- all js/**/*.js pass `node --check`
  6. AGENTS.md constraints  -- no var/alert/confirm/require/CDN in JS or CSS
  7. HTML integrity         -- type=module, no inline handlers, data-i18n keys present
"""

import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).parent.parent

GREEN = "\033[32m"
RED   = "\033[31m"
RESET = "\033[0m"

# N-1 fix: use proper Unicode checkmark/cross, not ASCII v/x
TICK  = GREEN + "\u2713" + RESET
CROSS = RED   + "\u2717" + RESET

failures = []


# N-3 fix: proper blank lines around function definitions (PEP 8)
def ok(msg):
    print("  " + TICK + " " + msg)


def fail(msg):
    failures.append(msg)
    print("  " + CROSS + " " + msg)


def section(title):
    print("")
    print(title)
    print("-" * len(title))


def failures_before():
    """Return the current failure count, for use as a section baseline."""
    return len(failures)


def section_passed(baseline):
    """True if no new failures were added since baseline."""
    return len(failures) == baseline


# ---------------------------------------------------------------------------
# 1. JSON validity
# ---------------------------------------------------------------------------

section("1 . JSON validity")

json_files = sorted(f for f in ROOT.rglob("*.json") if ".git" not in str(f))

for f in json_files:
    try:
        json.loads(f.read_text(encoding="utf-8"))
        ok(str(f.relative_to(ROOT)))
    except json.JSONDecodeError as e:
        fail(str(f.relative_to(ROOT)) + ": " + str(e))

# ---------------------------------------------------------------------------
# 2. Tax-rules integrity
# ---------------------------------------------------------------------------

section("2 . Tax-rules integrity")

REQUIRED = [
    "szja_rate", "szocho_rates", "tb_rate", "tax_base_multiplier",
    "szocho_dividend_cap_multiplier", "min_monthly_wage_huf",
    "us_hu_dtt_active", "uk_hu_dtt_active", "etü_loss_carryforward_years",
    "quarterly_advance_deadlines", "quarterly_advance_threshold_huf",
    "late_interest_surcharge", "mnb_base_rates", "late_interest_formula",
]

# I-3 fix: guard against JSONDecodeError so subsequent sections don't crash
try:
    rules = json.loads((ROOT / "data" / "tax-rules.json").read_text(encoding="utf-8"))
except json.JSONDecodeError as e:
    fail("data/tax-rules.json: cannot parse -- " + str(e))
    rules = {}

baseline = failures_before()

for year, r in rules.items():
    yr = int(year)

    for field in REQUIRED:
        if field not in r:
            fail(year + ": missing field '" + field + "'")

    if r.get("szja_rate") != 0.15:
        fail(year + ": szja_rate should be 0.15, got " + str(r.get("szja_rate")))

    if r.get("tax_base_multiplier") != 0.89:
        fail(year + ": tax_base_multiplier should be 0.89, got "
             + str(r.get("tax_base_multiplier")))

    for rng in r.get("szocho_rates", []):
        rate = rng.get("rate", -1)
        if not (0 < rate <= 0.25):
            fail(year + ": szocho rate " + str(rate) + " outside plausible range (0, 0.25]")

    if yr >= 2024 and r.get("us_hu_dtt_active") is not False:
        fail(year + ": us_hu_dtt_active must be false for 2024+")
    if yr < 2024 and r.get("us_hu_dtt_active") is not True:
        fail(year + ": us_hu_dtt_active must be true for pre-2024")

    if r.get("szocho_dividend_cap_multiplier") != 24:
        fail(year + ": szocho_dividend_cap_multiplier must be 24")

    if r.get("min_monthly_wage_huf", 0) <= 0:
        fail(year + ": min_monthly_wage_huf must be positive")

    if len(r.get("quarterly_advance_deadlines", [])) != 4:
        fail(year + ": quarterly_advance_deadlines must have exactly 4 entries")

    if r.get("late_interest_formula") != "base_rate_plus_5pp":
        fail(year + ": late_interest_formula must be 'base_rate_plus_5pp'")

    if not r.get("mnb_base_rates"):
        fail(year + ": mnb_base_rates must be a non-empty list")

# 2019 and 2020 have mid-year rate transitions -- exactly 2 szocho_rates entries
for yr_str in ("2019", "2020"):
    n = len(rules.get(yr_str, {}).get("szocho_rates", []))
    if n != 2:
        fail(yr_str + ": expected 2 szocho_rates (mid-year transition), got " + str(n))

# I-1/I-5 fix: use baseline pattern instead of a separate rules_ok variable
if section_passed(baseline):
    ok(str(len(rules)) + " tax years validated")

# ---------------------------------------------------------------------------
# 3. eszja-schema integrity
# ---------------------------------------------------------------------------

section("3 . eszja-schema integrity")

REQUIRED_YEARS = ["2021", "2022", "2023", "2024", "2025"]
REQUIRED_ROWS  = [
    "equity_income_row", "et\u00fc_gain_row", "et\u00fc_loss_row",
    "et\u00fc_tax_row", "dividend_row", "szocho_dividend_row",
]
ROW_FIELDS = ["id", "form", "label_hu", "label_en"]

# I-3 fix: guard against JSONDecodeError
try:
    schema = json.loads((ROOT / "data" / "eszja-schema.json").read_text(encoding="utf-8"))
except json.JSONDecodeError as e:
    fail("data/eszja-schema.json: cannot parse -- " + str(e))
    schema = {}

baseline = failures_before()

for year in REQUIRED_YEARS:
    if year not in schema:
        fail("year " + year + " missing from eszja-schema.json")
        continue
    for row in REQUIRED_ROWS:
        if row not in schema[year]:
            fail(year + ": missing row '" + row + "'")
            continue
        for field in ROW_FIELDS:
            if field not in schema[year][row]:
                fail(year + "/" + row + ": missing field '" + field + "'")

if section_passed(baseline):
    ok("years " + ", ".join(REQUIRED_YEARS) + " -- all rows and fields present")

# ---------------------------------------------------------------------------
# 4. Locale parity
# ---------------------------------------------------------------------------

section("4 . Locale parity (hu <-> en)")

# I-3 fix: guard both locale files
try:
    hu = json.loads((ROOT / "locales" / "hu.json").read_text(encoding="utf-8"))
except json.JSONDecodeError as e:
    fail("locales/hu.json: cannot parse -- " + str(e))
    hu = {}

try:
    en = json.loads((ROOT / "locales" / "en.json").read_text(encoding="utf-8"))
except json.JSONDecodeError as e:
    fail("locales/en.json: cannot parse -- " + str(e))
    en = {}

baseline = failures_before()
hu_keys, en_keys = set(hu.keys()), set(en.keys())

for k in sorted(hu_keys - en_keys):
    fail("'" + k + "' in hu.json but missing from en.json")
for k in sorted(en_keys - hu_keys):
    fail("'" + k + "' in en.json but missing from hu.json")

if section_passed(baseline):
    ok(str(len(hu_keys)) + " keys -- perfectly symmetrical")

# ---------------------------------------------------------------------------
# 5. JS syntax
# ---------------------------------------------------------------------------

section("5 . JavaScript syntax (node --check)")

js_files = sorted((ROOT / "js").rglob("*.js"))

for f in js_files:
    res = subprocess.run(["node", "--check", str(f)], capture_output=True)
    if res.returncode != 0:
        first_line = res.stderr.decode().strip().splitlines()[0]
        fail(str(f.relative_to(ROOT)) + ": " + first_line)
    else:
        ok(str(f.relative_to(ROOT)))

# ---------------------------------------------------------------------------
# 6. AGENTS.md constraints
# ---------------------------------------------------------------------------

section("6 . AGENTS.md constraints")

FORBIDDEN_JS = [
    (r"\bvar\s+",          "var declaration (use const/let)"),
    (r"\balert\s*\(",      "alert() -- use inline UI instead"),
    (r"\bconfirm\s*\(",    "confirm() -- use inline confirm UI"),
    (r"\bprompt\s*\(",     "prompt() is forbidden"),
    (r"require\s*\(",      "CommonJS require() -- use ES import"),
    (r"fonts\.googleapis", "Google Fonts CDN (zero-external-calls rule)"),
    (r"unpkg\.com",        "unpkg CDN (zero-external-calls rule)"),
    (r"jsdelivr\.net",     "jsDelivr CDN (zero-external-calls rule)"),
]

baseline = failures_before()

for f in js_files:
    lines = f.read_text(encoding="utf-8").splitlines()
    for lineno, line in enumerate(lines, start=1):
        s = line.strip()
        # I-2 note: skips // and JSDoc * lines. Does not track /* */ block
        # comment state -- acceptable since this codebase uses JSDoc style only.
        if s.startswith("//") or s.startswith("*"):
            continue
        for pat, lbl in FORBIDDEN_JS:
            if re.search(pat, line):
                fail(str(f.relative_to(ROOT)) + ":" + str(lineno) + ": " + lbl
                     + "\n    " + s[:100])

# CSS: no external network URLs (data: URIs are safe inline assets)
css_src = (ROOT / "css" / "style.css").read_text(encoding="utf-8")
css_no_data = re.sub(r"url\s*\(\s*[\x22\x27]?data:[^)]+\)", "", css_src)
for url in re.findall(r"url\s*\(\s*[\x22\x27]?(https?://[^\s)\x22\x27]+)", css_no_data):
    fail("css/style.css: external network URL -- " + url)

if section_passed(baseline):
    ok(str(len(js_files)) + " JS files and CSS -- no constraint violations")

# ---------------------------------------------------------------------------
# 7. HTML integrity
# ---------------------------------------------------------------------------

section("7 . HTML integrity")

html = (ROOT / "index.html").read_text(encoding="utf-8")
baseline = failures_before()

if 'type="module"' not in html:
    fail('Missing type="module" on the <script> tag')
else:
    ok('type="module" present')

handlers = re.findall(r"\bon\w+\s*=\s*[\x22\x27]", html)
if handlers:
    for h in handlers:
        fail("Inline event handler: " + h)
else:
    ok("No inline event handlers")

REQUIRED_I18N = [
    "nav.title", "disclaimer", "section.add_event", "section.ledger",
    "footer.copyright", "banner.closed_year",
]
for key in REQUIRED_I18N:
    if ('data-i18n="' + key + '"') not in html:
        fail('Missing data-i18n="' + key + '" in index.html')

for pat in [r"cdn\.", r"unpkg\.com", r"jsdelivr", r"fonts\.googleapis"]:
    if re.search(pat, html):
        fail("External CDN reference in HTML matches: " + pat)

if section_passed(baseline):
    ok(str(len(REQUIRED_I18N)) + " required data-i18n keys present, no CDN refs")

# ---------------------------------------------------------------------------
# 8. Vercel artefact constraints
# ---------------------------------------------------------------------------

section("8 . Vercel artefact constraints")

baseline = failures_before()

# --- api/stock.js ---
api_file = ROOT / "api" / "stock.js"

if not api_file.exists():
    fail("api/stock.js: file not found")
else:
    api_src = api_file.read_text(encoding="utf-8")

    api_has_require = any(
        re.search(r"\brequire\s*\(", line)
        for line in api_src.splitlines()
        if not line.strip().startswith("//") and not line.strip().startswith("*")
    )
    if api_has_require:
        fail("api/stock.js: uses require() — only Node built-ins allowed (no npm packages)")
    else:
        ok("api/stock.js: no require() calls")

    if "export default" not in api_src:
        fail("api/stock.js: missing 'export default' (Vercel function contract)")
    else:
        ok("api/stock.js: export default present")

    if not re.search(r"TICKER_RE", api_src):
        fail("api/stock.js: missing TICKER_RE ticker validation (security guard)")
    else:
        ok("api/stock.js: TICKER_RE ticker validation present")

    if not re.search(r"OPTIONS", api_src):
        fail("api/stock.js: missing OPTIONS preflight handling")
    else:
        ok("api/stock.js: OPTIONS preflight handling present")

# --- vercel.json ---
vercel_file = ROOT / "vercel.json"

if not vercel_file.exists():
    fail("vercel.json: file not found")
else:
    try:
        vercel_cfg = json.loads(vercel_file.read_text(encoding="utf-8"))
        ok("vercel.json: valid JSON")

        # Check that the SPA catch-all rewrite is present
        rewrites = vercel_cfg.get("rewrites", [])
        catchall_found = any(
            r.get("source", "") == "/((?!api/).*)" and
            r.get("destination", "") == "/index.html"
            for r in rewrites
        )
        if not catchall_found:
            fail("vercel.json: missing SPA catch-all rewrite '/((?!api/).*)'  → '/index.html'")
        else:
            ok("vercel.json: SPA catch-all rewrite present")

    except json.JSONDecodeError as e:
        fail("vercel.json: invalid JSON — " + str(e))

if section_passed(baseline):
    ok("Vercel artefacts — all constraints satisfied")

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

print("")
if failures:
    print(RED + "=" * 50 + RESET)
    print("  FAILED -- " + str(len(failures)) + " problem(s) found")
    print(RED + "=" * 50 + RESET)
    sys.exit(1)
else:
    print(GREEN + "=" * 50 + RESET)
    print("  All checks passed")
    print(GREEN + "=" * 50 + RESET)
