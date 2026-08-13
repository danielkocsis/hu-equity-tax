# 003 — Tax Rules JSON and eSZJA Schema Data Files

**Blocking:** 006, 007, 008, 010  
**Blocked by:** 001

## Context
Read `TAX-ANALYSIS.md` in full — it is the ONLY authoritative source for all values in this ticket. Do NOT use any other source.  
Read `AGENTS.md` (Data schemas section) for the expected JSON shape.

## Goal
Populate `data/tax-rules.json` and `data/eszja-schema.json` with confirmed, sourced data for tax years 2019–2026.

## `data/tax-rules.json`

Populate entries for years **2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026**.

Each entry must follow the schema in `AGENTS.md`. Key values from `TAX-ANALYSIS.md`:

**SZOCHO rates (date-range arrays — mandatory for 2019 and 2020):**
- 2019: `[{from:"2019-01-01",to:"2019-06-30",rate:0.195},{from:"2019-07-01",to:"2019-12-31",rate:0.175}]`
- 2020: `[{from:"2020-01-01",to:"2020-06-30",rate:0.175},{from:"2020-07-01",to:"2020-12-31",rate:0.155}]`
- 2021: `[{from:"2021-01-01",to:"2021-12-31",rate:0.155}]`
- 2022–present: `[{from:"YYYY-01-01",to:"YYYY-12-31",rate:0.13}]`

**Min monthly wage (minimálbér):**
- 2019: 149,000; 2020: 161,000; 2021: 167,400; 2022: 200,000; 2023: 232,000; 2024: 266,800; 2025: 290,800; 2026: 317,000

**DTT flags:**
- `us_hu_dtt_active`: true for 2019–2023; false from 2024
- `uk_hu_dtt_active`: true for all years

**Quarterly advance deadlines:** `["04-12","07-12","10-12","01-12"]` (all years)

**MNB base rates** (for késedelmi pótlék estimation — use approximate known values):
- 2019: ~0.09; 2020: ~0.006; 2021: ~0.006; 2022: 0.04 to 0.13 (use date ranges); 2023: 0.13; 2024: ~0.10; 2025: ~0.065

**Other constants (same for all years):**
- `szja_rate`: 0.15
- `tb_rate`: 0.185
- `tax_base_multiplier`: 0.89
- `szocho_dividend_cap_multiplier`: 24
- `etü_loss_carryforward_years`: 2
- `quarterly_advance_threshold_huf`: 10000
- `late_interest_surcharge`: 0.05

## `data/eszja-schema.json`

Populate entries for years **2021, 2022, 2023, 2024, 2025**.

All years are identical (confirmed from 21–25SZJA kitöltési útmutatók — see `TAX-ANALYSIS.md §11`):

```jsonc
{
  "2024": {
    "equity_income_row": { "id": "19. sor", "form": "SZJA-A lap", "label_hu": "Egyéb jogcímen kapott jövedelem (13% SZOCHO, 89% adóalap)", "label_en": "Other income — equity award (13% SZOCHO, 89% tax base)" },
    "equity_income_row_no_szocho": { "id": "18. sor", "form": "SZJA-A lap", "label_hu": "Egyéb jogcímen kapott jövedelem (SZOCHO nélkül)", "label_en": "Other income — equity award (no SZOCHO)" },
    "etü_gain_row": { "id": "172. sor d oszlop", "form": "SZJA-04-es lap", "label_hu": "ETÜ jövedelem (nettó nyereség)", "label_en": "Controlled capital market gain (net)" },
    "etü_loss_row": { "id": "172. sor a oszlop", "form": "SZJA-04-es lap", "label_hu": "ETÜ veszteség (deklarálandó!)", "label_en": "ETÜ loss (must declare to preserve carry-forward)" },
    "etü_tax_row": { "id": "172. sor e oszlop", "form": "SZJA-04-es lap", "label_hu": "ETÜ adó (15% SZJA)", "label_en": "ETÜ tax (15% SZJA)" },
    "etü_offset_rows": { "ids": ["212","213","214","216","217","218","219","220","C75"], "form": "SZJA-06-os lap + C lap", "label_hu": "Adókiegyenlítés (korábbi ETÜ veszteség levonása)", "label_en": "Loss offset credit from prior ETÜ years" },
    "dividend_row": { "id": "182. sor", "form": "SZJA-05-ös lap", "label_hu": "Külföldről kapott osztalék", "label_en": "Foreign dividend income" },
    "szocho_dividend_row": { "id": "09-es lap", "form": "09-es lap", "label_hu": "SZOCHO bevallás (nem EGT részvény osztaléka után)", "label_en": "SZOCHO declaration (non-EGT dividend)" }
  }
}
```

## Done conditions
- [ ] `JSON.parse(fs.readFileSync('data/tax-rules.json'))` succeeds with no errors
- [ ] All 8 tax years present (2019–2026) in tax-rules.json
- [ ] All 5 schema years present (2021–2025) in eszja-schema.json
- [ ] 2019 and 2020 szocho_rates have 2 entries each; all other years have 1 entry
- [ ] `us_hu_dtt_active` is `false` for 2024 and 2025; `true` for 2019–2023
