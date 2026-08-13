# 004 — MNB FX Rate GitHub Action

**Blocking:** 005  
**Blocked by:** 001

## Context
Read `AGENTS.md` (MNB FX pipeline section) for the exact spec.

## Goal
Create the GitHub Actions workflow that fetches daily MNB exchange rates and commits them as static JSON files in `data/`.

## Deliverables

### `.github/workflows/mnb-fx-fetch.yml`

- **Schedule:** `cron: '0 18 * * 1-5'` (18:00 UTC Mon–Fri)
- **Also triggerable:** `workflow_dispatch` (manual run)
- **Permissions:** `contents: write`
- **Steps:**
  1. Checkout repo
  2. Run a Python script (inline or as a file) that:
     - Calls the MNB SOAP endpoint: `http://www.mnb.hu/arfolyamok.asmx`
     - SOAP action: `GetExchangeRates`
     - Request body fetches USD, EUR, GBP for the current date
     - Parses the XML response
     - Reads the existing `data/mnb_fx_{YEAR}.json` if it exists
     - Merges today's rates: `{ "YYYY-MM-DD": { "USD": ..., "EUR": ..., "GBP": ... } }`
     - Writes the updated file back
  3. If the file changed: `git config`, `git add`, `git commit -m "chore: update MNB FX rates [skip ci]"`, `git push`

### MNB SOAP request format
```xml
POST http://www.mnb.hu/arfolyamok.asmx HTTP/1.1
Content-Type: text/xml; charset=utf-8
SOAPAction: "http://www.mnb.hu/webservices/MNBArfolyamServiceSoap/GetExchangeRates"

<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetExchangeRates xmlns="http://www.mnb.hu/webservices/">
      <startDate>{YYYY-MM-DD}</startDate>
      <endDate>{YYYY-MM-DD}</endDate>
      <currencyNames>USD,EUR,GBP</currencyNames>
    </GetExchangeRates>
  </soap:Body>
</soap:Envelope>
```

### `.github/workflows/deploy.yml`
- Trigger: `push` to `main`
- Copies repo contents to `gh-pages` branch (use `peaceiris/actions-gh-pages@v3` or equivalent — check license: MIT ✅)
- No build step required

### Done conditions
- [ ] Workflow file is valid YAML (run `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/mnb-fx-fetch.yml'))"`)
- [ ] Python fetch script handles the case where MNB returns no data for today (weekend) gracefully — logs a message and exits 0
- [ ] Output JSON format matches: `{ "2026-08-13": { "USD": 370.5, "EUR": 398.2, "GBP": 468.1 } }`
