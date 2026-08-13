# Részvényadó Kalkulátor · Equity Tax Calculator

> 🇭🇺 Free, privacy-first calculator for Hungarian employees taxing foreign equity awards — SZJA + SZOCHO, MNB FX rates, eSZJA row mapper, NAV payment guide. 100% client-side. No server. No data leaves your browser.

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)

---

## What it does

If you work at a multinational company in Hungary and receive RSUs, stock options, ESPP, or dividends from a foreign parent entity, you are responsible for calculating and declaring SZJA and SZOCHO yourself — NAV does not pre-fill these in your eSZJA return and your employer will not withhold tax for you.

This app helps you:

- Convert foreign currency amounts using official **MNB exchange rates**
- Calculate **SZJA (15%)** and **SZOCHO** for each equity event
- Apply the **89% tax base multiplier** correctly
- Track **ETÜ (capital gains)** with FIFO lot management and 2-year loss carry-forward
- Identify the correct **eSZJA row IDs** to fill (sor 19, sor 172, sor 182...)
- Generate **NAV payment cards** with account numbers, IBANs, and deadlines
- Review **quarterly advance tax** deadlines where applicable
- Estimate **késedelmi pótlék** for önellenőrzés (self-audit) of past years

**Supported equity types:** RSU vesting · Stock option exercise · ESPP discount · Share award · ETÜ share sale · Foreign dividend

---

## Privacy

- **100% client-side** — no server, no backend, no database
- All calculations happen in your browser
- Data is saved in `localStorage` only — it never leaves your device
- No analytics, no tracking, no cookies

---

## Disclaimer

This is a free, open-source calculator, **not professional tax advice**. Accuracy depends entirely on the data you enter. You remain solely responsible for your tax return and payments. Verify results with a qualified accountant before filing.

---

## Tax law coverage

Tax rules are sourced from Hungarian primary legislation and official NAV publications.

Key legal bases:
- [Szja tv. (1995. évi CXVII. tv.)](https://net.jogtar.hu/jogszabaly?docid=99500117.TV) — personal income tax
- [Szoctv. (2018. évi LII. tv.)](https://net.jogtar.hu/jogszabaly?docid=a1800052.tv) — social contribution tax
- [Art. tv. (2017. évi CL. tv.)](https://net.jogtar.hu/jogszabaly?docid=a1700150.tv) — tax administration
- [NAV official rate tables](https://nav.gov.hu/ugyfeliranytu/adokulcsok_jarulekmertekek)

Covered tax years: **2021–2025** (the 5 open audit years as of 2026). Current year (2026) supported for real-time tracking.

---

## Use it

**→ [danielkocsis.github.io/hu-equity-tax](https://danielkocsis.github.io/hu-equity-tax)**

No installation, no login, no account. Open the link and start entering your equity events.

MNB exchange rates are updated automatically every business day.

---

## Contributing

The app is pure HTML + CSS + ES Modules — no build step, no npm, no bundler.

```bash
git clone https://github.com/danielkocsis/hu-equity-tax.git
cd hu-equity-tax
open index.html   # or double-click it in Finder / Explorer
```

---

## License

**Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**

Free to use for personal tax calculation. Commercial use, embedding in paid products, and commercial redistribution require the author's explicit consent.
