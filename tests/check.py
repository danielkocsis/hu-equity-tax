"""
HU-EquityTax -- static verification suite
Run from the repo root:  python3 tests/check.py
"""

import json, pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).parent.parent

GREEN = "\033[32m"
RED   = "\033[31m"
RESET = "\033[0m"
TICK  = GREEN + "v" + RESET
CROSS = RED   + "x" + RESET

failures = []

def ok(msg):   print("  " + TICK  + " " + msg)
def fail(msg): failures.append(msg); print("  " + CROSS + " " + msg)
def section(title): print(""); print(title); print("-" * len(title))

# ── 1. JSON validity ─────────────────────────────────────────────────────────

section("1 . JSON validity")

json_files = sorted(f for f in ROOT.rglob("*.json") if ".git" not in str(f))
for f in json_files:
    try:
        json.loads(f.read_text(encoding="utf-8"))
        ok(str(f.relative_to(ROOT)))
    except json.JSONDecodeError as e:
        fail(str(f.relative_to(ROOT)) + ": " + str(e))

# ── 2. Tax-rules integrity ────────────────────────────────────────────────────

section("2 . Tax-rules integrity")

REQUIRED = [
    "szja_rate", "szocho_rates", "tb_rate", "tax_base_multiplier",
    "szocho_dividend_cap_multiplier", "min_monthly_wage_huf",
    "us_hu_dtt_active", "uk_hu_dtt_active", "etü_loss_carryforward_years",
    "quarterly_advance_deadlines", "quarterly_advance_threshold_huf",
    "late_interest_surcharge", "mnb_base_rates", "late_interest_formula",
]

rules = json.loads((ROOT / "data" / "tax-rules.json").read_text(encoding="utf-8"))
rules_ok = True

for year, r in rules.items():
    yr = int(year)
    for field in REQUIRED:
        if field not in r:
            fail(year + ": missing field '" + field + "'"); rules_ok = False
    if r.get("szja_rate") != 0.15:
        fail(year + ": szja_rate should be 0.15, got " + str(r.get("szja_rate"))); rules_ok = False
    if r.get("tax_base_multiplier") != 0.89:
        fail(year + ": tax_base_multiplier should be 0.89, got " + str(r.get("tax_base_multiplier"))); rules_ok = False
    for rng in r.get("szocho_rates", []):
        rate = rng.get("rate", -1)
        if not (0 < rate <= 0.25):
            fail(year + ": szocho rate " + str(rate) + " outside plausible range (0, 0.25]"); rules_ok = False
    if yr >= 2024 and r.get("us_hu_dtt_active") is not False:
        fail(year + ": us_hu_dtt_active must be false for 2024+"); rules_ok = False
    if yr < 2024 and r.get("us_hu_dtt_active") is not True:
        fail(year + ": us_hu_dtt_active must be true for pre-2024"); rules_ok = False
    if r.get("szocho_dividend_cap_multiplier") != 24:
        fail(year + ": szocho_dividend_cap_multiplier must be 24"); rules_ok = False
    if r.get("min_monthly_wage_huf", 0) <= 0:
        fail(year + ": min_monthly_wage_huf must be positive"); rules_ok = False
    if len(r.get("quarterly_advance_deadlines", [])) != 4:
        fail(year + ": quarterly_advance_deadlines must have 4 entries"); rules_ok = False
    if r.get("late_interest_formula") != "base_rate_plus_5pp":
        fail(year + ": late_interest_formula must be 'base_rate_plus_5pp'"); rules_ok = False
    if not r.get("mnb_base_rates"):
        fail(year + ": mnb_base_rates must be a non-empty list"); rules_ok = False

for yr_str in ("2019", "2020"):
    n = len(rules.get(yr_str, {}).get("szocho_rates", []))
    if n != 2:
        fail(yr_str + ": expected 2 szocho_rates (mid-year transition), got " + str(n)); rules_ok = False

if rules_ok:
    ok(str(len(rules)) + " tax years validated")

# ── 3. eszja-schema ───────────────────────────────────────────────────────────

section("3 . eszja-schema integrity")

REQUIRED_YEARS = ["2021", "2022", "2023", "2024", "2025"]
REQUIRED_ROWS  = ["equity_income_row", "etü_gain_row", "etü_loss_row",
                  "etü_tax_row", "dividend_row", "szocho_dividend_row"]
ROW_FIELDS = ["id", "form", "label_hu", "label_en"]

schema = json.loads((ROOT / "data" / "eszja-schema.json").read_text(encoding="utf-8"))
schema_ok = True
for year in REQUIRED_YEARS:
    if year not in schema:
        fail("year " + year + " missing from eszja-schema.json"); schema_ok = False; continue
    for row in REQUIRED_ROWS:
        if row not in schema[year]:
            fail(year + ": missing row '" + row + "'"); schema_ok = False; continue
        for field in ROW_FIELDS:
            if field not in schema[year][row]:
                fail(year + "/" + row + ": missing field '" + field + "'"); schema_ok = False

if schema_ok:
    ok("years " + ", ".join(REQUIRED_YEARS) + " -- all rows and fields present")

# ── 4. Locale parity ──────────────────────────────────────────────────────────

section("4 . Locale parity (hu <-> en)")

hu = json.loads((ROOT / "locales" / "hu.json").read_text(encoding="utf-8"))
en = json.loads((ROOT / "locales" / "en.json").read_text(encoding="utf-8"))
hu_keys, en_keys = set(hu.keys()), set(en.keys())
for k in sorted(hu_keys - en_keys): fail("'" + k + "' in hu.json but missing from en.json")
for k in sorted(en_keys - hu_keys): fail("'" + k + "' in en.json but missing from hu.json")
if hu_keys == en_keys:
    ok(str(len(hu_keys)) + " keys -- perfectly symmetrical")

# ── 5. JS syntax ──────────────────────────────────────────────────────────────

section("5 . JavaScript syntax (node --check)")

js_files = sorted((ROOT / "js").rglob("*.js"))
for f in js_files:
    res = subprocess.run(["node", "--check", str(f)], capture_output=True)
    if res.returncode != 0:
        fail(str(f.relative_to(ROOT)) + ": " + res.stderr.decode().strip().splitlines()[0])
    else:
        ok(str(f.relative_to(ROOT)))

# ── 6. AGENTS.md constraints ──────────────────────────────────────────────────

section("6 . AGENTS.md constraints")

FORBIDDEN_JS = [
    (r"\bvar\s+",          "var declaration (use const/let)"),
    (r"\balert\s*\(",      "alert() -- use inline UI instead"),
    (r"\bconfirm\s*\(",    "confirm() -- use inline confirm UI"),
    (r"\bprompt\s*\(",     "prompt() is forbidden"),
    (r"require\s*\(",       "CommonJS require() -- use ES import"),
    (r"fonts\.googleapis",   "Google Fonts CDN (zero-external-calls rule)"),
    (r"unpkg\.com",          "unpkg CDN (zero-external-calls rule)"),
    (r"jsdelivr\.net",       "jsDelivr CDN (zero-external-calls rule)"),
]

c_failures = []
for f in js_files:
    lines = f.read_text(encoding="utf-8").splitlines()
    for lineno, line in enumerate(lines, start=1):
        s = line.strip()
        if s.startswith("//") or s.startswith("*"): continue
        for pat, lbl in FORBIDDEN_JS:
            if re.search(pat, line):
                c_failures.append(str(f.relative_to(ROOT)) + ":" + str(lineno) + ": " + lbl)

css = (ROOT / "css" / "style.css").read_text(encoding="utf-8")
css_no_data = re.sub(r"url\s*\(\s*[\x22\x27]?data:[^)]+\)", "", css)
for url in re.findall(r"url\s*\(\s*[\x22\x27]?(https?://[^\s)\x22\x27]+)", css_no_data):
    c_failures.append("css/style.css: external network URL -- " + url)

for msg in c_failures: fail(msg)
if not c_failures:
    ok(str(len(js_files)) + " JS files and CSS -- no constraint violations")

# ── 7. HTML integrity ─────────────────────────────────────────────────────────

section("7 . HTML integrity")

html = (ROOT / "index.html").read_text(encoding="utf-8")
if 'type="module"' not in html: fail("Missing type=\"module\" on script tag")
else: ok('type="module" present')

handlers = re.findall(r"\bon\w+\s*=\s*[\x22\x27]", html)
if handlers:
    for h in handlers: fail("Inline event handler: " + h)
else:
    ok("No inline event handlers")

KEYS = ["nav.title", "disclaimer", "section.add_event", "section.ledger",
        "footer.copyright", "banner.closed_year"]
keys_ok = True
for key in KEYS:
    if ('data-i18n="' + key + '"') not in html:
        fail('Missing data-i18n="' + key + '" in index.html'); keys_ok = False
if keys_ok: ok(str(len(KEYS)) + " required data-i18n keys present")

cdn_ok = True
for pat in [r"cdn\.", r"unpkg\.com", r"jsdelivr", r"fonts\.googleapis"]:
    if re.search(pat, html): fail("External CDN reference matches: " + pat); cdn_ok = False
if cdn_ok: ok("No external CDN references")

# ── Summary ───────────────────────────────────────────────────────────────────

print("")
if failures:
    print(RED + "=" * 50 + RESET)
    print("  FAILED -- " + str(len(failures)) + " problem(s)")
    print(RED + "=" * 50 + RESET)
    sys.exit(1)
else:
    print(GREEN + "=" * 50 + RESET)
    print("  All checks passed")
    print(GREEN + "=" * 50 + RESET)
