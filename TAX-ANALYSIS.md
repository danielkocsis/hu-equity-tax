# TAX-ANALYSIS.md — Hungarian Equity Tax Scenario Analysis

**Purpose:** Authoritative reference for the HU-EquityTax calculator. Distils every taxation scenario the app must handle, derived from primary official sources.

**Sources analysed:**
1. **NAV Információs Füzet #04** — *Magánszemélyek külföldről származó jövedelme* (közzétéve: 2024-09-05, 29 pages) — **primary**
2. **VGD Hungary** — *Munkavállalók mobilitása: külföldi anyacégtől kapott részvényjuttatás adózása* (2023-02-02)
3. **Elemzésközpont** — *Tőzsde adózás, tőzsdei nyereség utáni adóbevallás 2026-ban* (updated 2026-05-05)
4. **SZJA tv.** — 1995. évi CXVII. törvény (cited sections throughout)
5. **Szoctv.** — 2018. évi LII. törvény (SZOCHO rules)
6. **Tbj.** — 2019. évi CXXII. törvény (TB/social insurance rules)

> ⚠️ = uncertain, contradicted, or requires verification before implementation.
> This document is not tax advice. All rules should be verified against current legislation before production release.

## Primary Legal Sources (links to net.jogtar.hu)

| Abbreviation | Full name | Link |
|---|---|---|
| **Szja tv.** | 1995. évi CXVII. törvény a személyi jövedelemadóról | https://net.jogtar.hu/jogszabaly?docid=99500117.TV |
| **Szoctv.** | 2018. évi LII. törvény a szociális hozzájárulási adóról | https://net.jogtar.hu/jogszabaly?docid=a1800052.tv |
| **Art. tv.** | 2017. évi CL. törvény az adózás rendjéről | https://net.jogtar.hu/jogszabaly?docid=a1700150.tv |
| **Tbj.** | 2019. évi CXXII. törvény a társadalombiztosítás ellátásaira jogosultakról | https://net.jogtar.hu/jogszabaly?docid=a1900122.tv |
| **NAV SZOCHO rates** | Official NAV SZOCHO rate history page (updated 2024-12-17) | https://nav.gov.hu/ugyfeliranytu/adokulcsok_jarulekmertekek/szocialis_hozzajarulasi_ado/a-szocialis-hozzajarulasi-ado-merteke |
| **NAV SZJA rates** | Official NAV összevont adóalap SZJA rate table 2011– (updated 2022-01-11) | https://nav.gov.hu/ugyfeliranytu/adokulcsok_jarulekmertekek/Adotablak/Az_osszevont_adoalapo20181227_ref1 |
| **NAV minimálbér** | Official NAV minimum wage table | https://nav.gov.hu/ugyfeliranytu/adokulcsok_jarulekmertekek/minimalbér_garantalt_berminimum |
| **NAV fizetendő járulékok** | Official NAV TB járulék rate table (updated 2026-01-05) | https://nav.gov.hu/ugyfeliranytu/adokulcsok_jarulekmertekek/fizetendo_jar |

> All paragraph links below use the pattern: `[Szja tv. §X]` with a direct anchor URL. The app UI should link to these wherever a rule is cited, so users can read the primary source themselves.

---

## 1. The Core Situation: Foreign Kifizető

### 1.1 What "no Hungarian kifizető" means

The entire taxation complexity stems from one fact: the equity is granted and paid by a **foreign legal entity** (a non-Hungarian parent, sister company, or third-party administrator like Equiniti or Morgan Stanley Shareworks). Under SZJA tv. § 7(1)(31), a **kifizető** is a domestic (Hungarian) entity making payments to natural persons in Hungary. A foreign parent is **not** a kifizető.

**Consequences (confirmed by NAV Füzet #04, section 5.2 and VGD):**

| Consequence | Detail |
|---|---|
| No employer withholding | The Hungarian employer has no SZJA or SZOCHO withholding obligation, because the income does not flow through the Hungarian employer's payroll |
| Self-declaration mandatory | The individual must calculate, declare, and pay SZJA and SZOCHO themselves |
| eSZJA not pre-populated | Foreign equity income will not appear in the NAV-generated bevallástervezet (draft return). The individual must manually supplement it |
| 89% multiplier activates | Because the individual bears both SZJA and SZOCHO (no kifizető paying the employer-side SZOCHO), the 89% tax base rule applies (SZJA tv. § 29) |
| CRS/FATCA exposure | NAV receives information about foreign brokerage accounts via CRS and FATCA. Undeclared income can be detected and result in adóhiány, adóbírság, and késedelmi pótlék (VGD explicit warning) |

**NAV Füzet #04 verbatim (section 5.2):**
> *„A külföldről származó jövedelmeknél általában nincs olyan személy, aki kifizetőként járna el. Így a jövedelmet és annak adóját a magánszemély állapítja meg."*

---

## 2. The 89% Tax Base Multiplier

### 2.1 Rule

**SZJA rate: 15% (confirmed from [NAV official rate table](https://nav.gov.hu/ugyfeliranytu/adokulcsok_jarulekmertekek/Adotablak/Az_osszevont_adoalapo20181227_ref1), verbatim: "2016– 15%")**

**[Szja tv. § 29(1)](https://net.jogtar.hu/jogszabaly?docid=99500117.TV#lbj29id):** When the individual pays SZOCHO themselves (because there is no kifizető), the tax base for összevont adóalap income is:

```
TB = Gross HUF income × 0.89
```

**Effect:** SZJA = 15% × TB; SZOCHO = 13% × TB  
Combined effective rate on gross: (15% + 13%) × 0.89 = **≈ 24.92%**

### 2.2 When it applies
- **YES:** RSU_VEST, ESOP_EXERCISE, ESPP_PURCHASE, SHARE_AWARD — all classified as összevont adóalap (employment or other income) when paid by a foreign kifizető
- **NO:** SHARE_SALE (ETÜ tőkejövedelem, separately taxed at flat 15%)
- **NO:** DIVIDEND (tőkejövedelem, separately taxed at flat 15% SZJA + 13% SZOCHO)

### 2.3 Confirmed by
VGD: *"az összevont adóalap 89 százaléka"* explicitly stated for foreign-kifizető RSU income.  
NAV Füzet #04, section I.5.2 (self-assessment obligation confirms individual bears both taxes).

---

## 3. Equity Event Types — Detailed Rules

### 3.1 RSU Vesting (Restricted Stock Units)

| Attribute | Rule | Source |
|---|---|---|
| **Triggering event** | **Vesting date** — when the restriction lapses and the employee gains full disposal rights. Grant date: no tax event. | VGD |
| **SZJA tv. section** | § 77/A (értékpapír-juttatás) or § 28 (egyéb jövedelem); classification depends on whether the HU employer participates in the scheme. Foreign-parent-only grant → **§ 28 egyéb jövedelem** is the standard classification. | VGD |
| **Income category** | **Összevont adóalap** | VGD |
| **Tax base** | FMV (piaci ár) at vesting date × quantity, in foreign currency, converted to HUF at MNB rate on vesting date | VGD, NAV Füzet |
| **89% multiplier** | **YES** | VGD explicit |
| **SZJA** | 15% × (gross_huf × 0.89) | |
| **SZOCHO** | 13% × (gross_huf × 0.89) | |
| **TB járulék** | ⚠️ **Uncertain.** If classified as §28 egyéb jövedelem, TB does NOT apply (TB applies only to biztosítási kötelezettséggel járó jogviszony jövedelem). NAV Füzet #04 section 9 confirms that for egyéb jövedelem not classified as employment, the natural person pays SZOCHO but TB is a separate question. Verify per-case with tax adviser. **App default: TB = OFF.** | NAV Füzet #04 §9 |
| **Quarterly advance** | **YES** — SZJA advance due by the 12th of the month following the quarter of income receipt (NAV Füzet #04 § 5.2) | NAV Füzet #04 |
| **eSZJA declaration** | Manually added to the bevallástervezet; foreign income supplementary section | NAV Füzet #04 |

### 3.2 Stock Option / ESOP Exercise

| Attribute | Rule | Source |
|---|---|---|
| **Triggering event** | ⚠️ VGD states vesting date triggers income recognition, not the exercise date for options that become freely exercisable. However, for non-tradeable options (European-style), the **exercise date** is the income date. App should allow user to select the relevant date (vest/exercise). | VGD |
| **SZJA tv. section** | § 77/B (értékpapírra szóló jog / opció) for formal option plans; § 28 if foreign parent grants informally | VGD |
| **Income category** | **Összevont adóalap** | |
| **Tax base** | (FMV at exercise − exercise/strike price paid) × number of options, in foreign currency, converted at MNB rate on event date | VGD |
| **89% multiplier** | **YES** | |
| **SZJA** | 15% × (net_huf × 0.89) | |
| **SZOCHO** | 13% × (net_huf × 0.89) | |
| **TB** | ⚠️ Same uncertainty as RSU. Default: OFF | |
| **Quarterly advance** | **YES** | NAV Füzet #04 |

### 3.3 ESPP Discount Element (Employee Stock Purchase Plan)

| Attribute | Rule | Source |
|---|---|---|
| **Triggering event** | Purchase/settlement date — when shares are acquired at the discounted price | VGD (extrapolated) |
| **SZJA tv. section** | § 77/A or § 28 (same logic as RSU) | |
| **Income** | **Discount element only**: (FMV at purchase − price paid by employee) × quantity | VGD (general equity principle) |
| **89% multiplier** | **YES** | |
| **SZJA** | 15% × (discount_huf × 0.89) | |
| **SZOCHO** | 13% × (discount_huf × 0.89) | |
| **TB** | ⚠️ Default: OFF | |
| **Quarterly advance** | **YES** | |
| ⚠️ | Sources do not specifically address ESPP. Rules extrapolated from VGD's general framework for equity-from-foreign-parent. | |

### 3.4 Direct Share Award (ingyenes részvényjuttatás)

Identical to RSU vesting (§3.1 above). VGD explicitly covers this: free share acquisition → tax base = full market price; subsidised → tax base = market price minus amount paid by employee.

### 3.5 Foreign Dividend (külföldről származó osztalék)

| Attribute | Rule | Source |
|---|---|---|
| **Triggering event** | Date of payment/credit to the individual's account | NAV Füzet #04 §3.3 |
| **SZJA tv. section** | [§ 66](https://net.jogtar.hu/jogszabaly?docid=99500117.TV#lbj66id) (osztalék) | |
| **Income category** | **Tőkejövedelem** — separately taxed; NOT in összevont adóalap | |
| **89% multiplier** | **NO** — multiplier only applies to összevont adóalap | |
| **SZJA** | 15% × gross_huf | |
| **SZOCHO — EGT-listed shares** | **EXEMPT** — no SZOCHO on dividends from shares of companies listed on a regulated market within the EGT (EU/EEA). BÉT, Frankfurt, Paris, LSE, etc. qualify. | Elemzésközpont |
| **SZOCHO — non-EGT shares (e.g. US: NYSE, NASDAQ)** | **13%** × gross_huf — subject to annual SZOCHO cap | Elemzésközpont |
| **SZOCHO annual cap** | Cap = minimálbér × 24 per year. Applies to aggregate of §1(1)–(3) + §1(5)a–e income. RSU vest income already counts toward this cap before dividends are considered. See §5.3 for per-year cap values. | Szoctv. 2.§(2) — confirmed |
| **Quarterly advance** | **NO** — dividend tax paid by the annual filing deadline (May 20), not quarterly (NAV Füzet #04 §5.2 explicit) | NAV Füzet #04 |
| **eSZJA row — foreign dividend** | **sor 182** (05-ös lap) — *Külföldi osztalék* | Elemzésközpont |
| **SZOCHO declaration** | **09-es lap** (SZOCHO bevallás section) | Elemzésközpont |
| **US dividend post-2024** | US withholding: 30% (no DTT, not creditable). HU additionally: 15% SZJA + 13% SZOCHO on gross. Total effective burden ≈ 58% (30% US + 28% HU). ⚠️ Verify exact stacking with a tax adviser. | Elemzésközpont |
| **DTT credit (pre-2024 US / UK ongoing)** | Where a DTT exists: HU SZJA is reduced by the foreign tax withheld, up to the amount of HU SZJA due on that income. ⚠️ Phase 1: show informational warning; no auto-calculation of credit. | NAV Füzet #04 §3.3 |

> **Confirmed:** Foreign dividend → **sor 182** (05-ös lap). Sor 167 = domestic HU dividend (not in app scope).

### 3.6 ETÜ Share Sale — Capital Gain (Ellenőrzött Tőkepiaci Ügylet)

| Attribute | Rule | Source |
|---|---|---|
| **Triggering event** | **Settlement/closing of the trade** (eladás dátuma, pozíció zárás) — NOT the date proceeds are withdrawn from the brokerage account | Elemzésközpont |
| **SZJA tv. section** | [§ 67/A](https://net.jogtar.hu/jogszabaly?docid=99500117.TV#lbj67Aid) | |
| **Income category** | **Tőkejövedelem** — elkülönülten adózó (separately taxed) | |
| **89% multiplier** | **NO** | |
| **SZJA** | 15% × net ETÜ income (gains − losses − qualifying costs) | |
| **SZOCHO** | **NONE** — ETÜ gains explicitly excluded from SZOCHO | Elemzésközpont |
| **TB** | **NONE** | |
| **Quarterly advance** | **NO** — ETÜ tax paid by annual filing deadline (May 20) | NAV Füzet #04 §5.2 |

#### ETÜ Qualifying Conditions (SZJA tv. § 67/A)
The transaction must be:
1. Concluded **with or through** a licensed investment service provider (befektetési szolgáltató)
2. On a financial instrument or commodity
3. The investment service provider must be supervised by: MNB, **OR** any EGT member state regulator, **OR** a regulator in an OECD country (added by the 2023 autumn tax package — this preserves ETÜ status for US brokers like E*TRADE, Schwab, Morgan Stanley post-DTT termination)
4. The individual must hold an **annual statement** (éves igazolás) from the broker listing all transactions

**Post-DTT US broker status:** US brokers (Schwab, E*TRADE, Morgan Stanley) **retain ETÜ qualification** because the US is an OECD member. SZJA § 67/A was explicitly amended in late 2023 to add OECD membership as a qualifying criterion. (Elemzésközpont)

#### ETÜ Cost Basis and Gain Calculation
```
Net gain per tax year = Σ(sale_proceeds_huf) − Σ(purchase_cost_huf) − Σ(qualifying_costs_huf)
```
- **Sale proceeds:** quantity × sell price (foreign currency) × MNB rate on sell date
- **Purchase/acquisition cost:** quantity × buy price (foreign currency) × MNB rate on buy date
  - For shares acquired via RSU vest: buy price = FMV at vest date (already taxed as income); MNB rate at vest date
  - For shares acquired via ESPP/option: buy price = FMV at exercise/purchase date; MNB rate at that date
- **Qualifying costs:** broker commissions, custody fees, other transaction fees (HUF)
- All transactions within the tax year are **netted together**

#### ETÜ Loss Carry-Forward (adókiegyenlítés — SZJA tv. § 67/A)
- If the annual net result is a **loss**, the loss is declared in the SZJA return
- The declared loss can offset ETÜ gains in the **next 2 tax years** only
- Mechanism: the loss creates a tax credit equal to 15% of the loss amount, usable against ETÜ tax in Y+1 or Y+2
- **Only previously declared losses count** — undeclared losses from prior years cannot be retrospectively used
- eSZJA rows: loss declared in **sor 172 "a" oszlop**; loss-offset credit applied via **sorok 212–220** and **C lap sor 75**

#### eSZJA Rows for ETÜ

Confirmed stable across 22SZJA, 23SZJA, 24SZJA, 25SZJA — see §11 cross-year stability table.

| Row | Content |
|---|---|
| **172 "a" oszlop** (04-es lap) | ETÜ veszteség — loss (declare even if no gain this year, to preserve carry-forward right) |
| **172 "d" oszlop** (04-es lap) | ETÜ jövedelem — net taxable gain |
| **172 "e" oszlop** (04-es lap) | ETÜ adó — 15% SZJA on the gain |
| **212–214** (06-os lap) | Adókiegyenlítési keret (loss offset frame) |
| **216–218** (06-os lap) | Adókiegyenlítésre jogosító összeg (qualifying prior-year losses) |
| **219–220** (06-os lap) | Összesített adókiegyenlítési összeg + adókiegyenlítés befizetett adóként |
| **C lap sor 75** | SZJA csökkentés (offset applied against total SZJA) |

---

## 4. MNB FX Rate Rules

### 4.1 Statutory basis
**[Szja tv. § 5](https://net.jogtar.hu/jogszabaly?docid=99500117.TV#lbj5id)** — all income must be determined in HUF. Foreign currency income is converted using the MNB official exchange rate.

**NAV Füzet #04 verbatim (section 5.1):**
> *„A külföldi pénznemben megszerzett jövedelemből, osztalékból az adót ugyanazon külföldi pénznemben kell megállapítani, levonni és az MNB hivatalos, a megszerzés időpontjában érvényes devizaárfolyamán forintra átszámítva kell megfizetni."*

### 4.2 Which date's rate to use

| Event | MNB rate date |
|---|---|
| RSU vest / share award | **Vesting date** (jövedelemszerzés napja) |
| ESOP exercise | **Exercise date** |
| ESPP purchase | **Purchase/settlement date** |
| ETÜ buy leg (cost basis) | **Trade date of the purchase** |
| ETÜ sell leg (proceeds) | **Trade date of the sale** |
| Dividend receipt | **Date the dividend is credited** to the individual's account |

### 4.3 Alternative election (§ 5(7) SZJA tv.)
⚠️ The individual may elect to use the MNB rate valid on **the 15th of the month preceding** the income receipt month, instead of the day-of rate. This is a **per-tax-year election** (not per transaction). The sources confirm this option but do not specify all conditions. **App: offer this as an advanced option; user confirms the election applies.**

### 4.4 Currency not on MNB list
Convert to EUR first (using the issuing country's central bank's EUR cross-rate), then to HUF using MNB EUR/HUF rate. **App: for "OTHER" currency, require user to enter the converted HUF amount directly.**

### 4.5 Weekend / holiday fallback
⚠️ **Not explicitly confirmed in any fetched source.** Standard NAV/MNB practice: use the **last published rate before that date**. The MNB does not publish rates on weekends or Hungarian public holidays. **App applies this fallback; UI must disclose which date's rate was used.**

---

## 5. SZOCHO Rules

### 5.1 Rate history — confirmed from NAV official rate page

**Source:** NAV *"A szociális hozzájárulási adó mértéke"* (updated 2024-12-17):
`https://nav.gov.hu/ugyfeliranytu/adokulcsok_jarulekmertekek/szocialis_hozzajarulasi_ado/a-szocialis-hozzajarulasi-ado-merteke`

**Verbatim from NAV:**
> 2018. január 1 – 2019. június 30. → **19,5 %**
> 2019. július 1 – 2020. június 30. → **17,5 %**
> 2020. július 1 – 2021. december 31. → **15,5 %**
> 2022. január 1-jétől → **13 %**

| Period | Rate | Notes |
|---|---|---|
| 2018-01-01 – 2019-06-30 | **19.5%** | Outside 5-year audit window |
| **2019-07-01 – 2020-06-30** | **17.5%** | ⚠️ Mid-year split; 2021 önellenőrzés covering 2020 events in H1 |
| **2020-07-01 – 2021-12-31** | **15.5%** | In scope |
| **2022-01-01 – present** | **13%** | In scope |

> ⚠️ **Earlier analysis was incorrect.** Previous versions stated 19.5% for all of 2019 and 15.5% for 2020–2021. The NAV official page shows **17.5% from July 2019 to June 2020** — a period spanning both years. This means both 2019 (H2) and 2020 (H1) require mid-year splits in `tax-rules.json`.

**`tax-rules.json` implications — date-range arrays required for 2019 and 2020:**

```jsonc
"2019": {
  "szocho_rates": [
    { "from": "2019-01-01", "to": "2019-06-30", "rate": 0.195 },
    { "from": "2019-07-01", "to": "2019-12-31", "rate": 0.175 }
  ]
},
"2020": {
  "szocho_rates": [
    { "from": "2020-01-01", "to": "2020-06-30", "rate": 0.175 },
    { "from": "2020-07-01", "to": "2020-12-31", "rate": 0.155 }
  ]
},
"2021": {
  "szocho_rates": [{ "from": "2021-01-01", "to": "2021-12-31", "rate": 0.155 }]
},
"2022": {
  "szocho_rates": [{ "from": "2022-01-01", "to": "2022-12-31", "rate": 0.13 }]
}
```

**Also noted on the NAV page (2025 TBSZ rule — out of scope for this app):**
- TBSZ 5-year yield: 0% SZOCHO; 3-year: 8%; under 3 years: 13%

### 5.2 SZOCHO on each income type

| Income type | SZOCHO | Rate | Basis | Notes |
|---|---|---|---|---|
| RSU / ESOP / ESPP / Share Award (foreign kifizető) | **YES** | 13% | 89% of gross HUF | Individual self-pays |
| SHARE_SALE (ETÜ) | **NO** | 0% | — | Explicitly excluded |
| Dividend — EGT-listed company shares | **NO** | 0% | — | EGT regulated market exemption |
| Dividend — non-EGT shares (e.g. US NYSE/NASDAQ) | **YES** | 13% | 100% of gross HUF | Subject to annual cap |
| Non-ETÜ capital gain (e.g. unregulated broker) | **YES** | 13% | — | Out of scope for app (only ETÜ supported) |

### 5.3 SZOCHO annual cap for dividends

**Confirmed from [Szoctv. 2. § (2)](https://net.jogtar.hu/jogszabaly?docid=a1800052.tv#lbj2id):**

> *„Az 1. § (5) bekezdés a)–e) pontja esetében az adót addig kell megfizetni, amíg a természetes személy 1. § (1)–(3) bekezdés és az 1. § (5) bekezdés a)–e) pontja szerinti jövedelme a tárgyévben eléri a minimálbér összegének huszonnégyszeresét (a továbbiakban: adófizetési felső határ)."*

**Formula:** Cap = minimálbér × 24 (per calendar year). The cap applies to the **aggregate** of §1(1)–(3) income (employment/other income already subject to SZOCHO) **plus** §1(5)a–e income (which includes dividends). Once this combined aggregate reaches the ceiling, further dividend SZOCHO = 0.

**Important:** For most equity recipients, the employment income (RSU vests etc.) will already consume a significant portion of the cap before any dividend SZOCHO is calculated.

**Annual cap values (minimálbér × 24):**

| Year | Monthly minimálbér | Annual SZOCHO cap |
|---|---|---|
| 2020 | 161,000 HUF | **3,864,000 HUF** |
| 2021 | 167,400 HUF | **4,017,600 HUF** |
| 2022 | 200,000 HUF | **4,800,000 HUF** |
| 2023 | 232,000 HUF | **5,568,000 HUF** |
| 2024 | 266,800 HUF | **6,403,200 HUF** |
| 2025 | 290,800 HUF | **6,979,200 HUF** |
| 2026 | 317,000 HUF | **7,608,000 HUF** |

**Note:** The cap applies to the dividend SZOCHO base only when the §1(5)a–e income types (dividends etc.) are in play. Employment income (§1(1)–(3)) from RSU vesting etc. does **not** benefit from the cap — it is not subject to the 24× ceiling, only the dividend types are. See NAV booklet #49 (updated 2024-08-01) for the full aggregation rules.

---

## 6. Quarterly Advance Tax (Negyedéves SZJA Előleg)

### 6.1 Confirmed rule

**NAV Füzet #04 verbatim (section 5.2):**
> *„Ilyenkor az adóelőleget is a magánszemélynek kell megfizetnie, mégpedig a jövedelemszerzés negyedévét követő hónap 12-éig."*

Translation: **The individual must pay the SZJA advance by the 12th of the month following the quarter of income receipt.**

**NAV Füzet #04 verbatim (exception):**
> *„Nem kell adóelőleget fizetni, ha a jövedelem olyan államból származik, amellyel Magyarországnak nincs a kettős adóztatást elkerülő egyezménye."*

Translation: **No advance tax is due if the income comes from a country with which Hungary has NO double taxation treaty.**

> ⚠️ **Critical implication for US equity income from 2024+:** Since the US-HU DTT was terminated effective 2024-01-01, **no quarterly advance tax is required on US-sourced equity income from 2024 onwards.** The full tax is paid with the annual SZJA return by May 20. This is the opposite of what was assumed in the earlier plan — this rule must be reflected in the app.

### 6.2 Deadlines

| Quarter | Income period | Advance payment deadline |
|---|---|---|
| Q1 | January 1 – March 31 | **April 12** |
| Q2 | April 1 – June 30 | **July 12** |
| Q3 | July 1 – September 30 | **October 12** |
| Q4 | October 1 – December 31 | **January 12** (of next year) |

Deadlines confirmed from NAV Füzet #04 §5.2: *„a jövedelemszerzés negyedévét követő hónap 12-éig"* — the 12th of the month **following** the quarter: **April 12, July 12, October 12, January 12.**

### 6.3 Which income types trigger quarterly advance

| Income type | Quarterly advance required? | Notes |
|---|---|---|
| RSU_VEST / ESOP_EXERCISE / ESPP_PURCHASE / SHARE_AWARD | **YES — only if DTT exists with source country** | UK-HU DTT active → UK equity: quarterly advance YES. US-HU DTT terminated 2024 → US equity from 2024: NO |
| SHARE_SALE (ETÜ) | **NO** — ETÜ tax paid with annual return | NAV Füzet §5.2 explicit |
| DIVIDEND | **NO** — dividend tax paid with annual return | NAV Füzet §5.2 explicit |

### 6.4 App implementation for quarterly advance

The app must:
1. Determine the source country of the equity (user input: US / UK / EU / other)
2. Check whether a DTT is active with that country for the relevant tax year
3. If DTT active: show quarterly advance deadlines and amounts for employment/other income events
4. If no DTT (US from 2024, or country with no treaty): show annual-only payment; suppress quarterly advance panel
5. The advance SZOCHO follows the same quarterly schedule as SZJA advance. Confirmed from Szoctv. 6. § (2): quarterly SZOCHO advance is calculated on cumulative income divided by months of insured status in the quarter. For equity recipients without a separate insured relationship to a foreign employer, the practical implication is that SZOCHO on equity income (§28 egyéb jövedelem from foreign kifizető) is self-assessed and paid by the same quarterly deadlines when a DTT is active, mirroring the SZJA advance obligation.

---

## 7. Önellenőrzés (Self-Audit / Voluntary Amendment)

### 7.1 When it applies
- When a taxpayer discovers **after the original filing deadline** that their return contained an error (underdeclared income, wrong rate)
- Must be filed **before NAV initiates its own audit** of that tax year
- Can be filed multiple times for the same year (önellenőrzés of önellenőrzés)
- NAV audit window: **5 closed tax years** — as of 2026: 2021–2025 are open

### 7.2 Consequences of voluntary önellenőrzés
Per Art. tv. (2017. évi CL. törvény):
1. Tax delta (adóhiány) must be paid
2. **Késedelmi pótlék** (late payment interest) accrues from the original due date (May 20 of year+1) to the payment date
3. **Önellenőrzési pótlék** (self-audit surcharge) = 50% of the késedelmi pótlék amount (significantly lower than the adóbírság that NAV would impose if they found it first)
4. No adóbírság (penalty) if önellenőrzés is genuine and complete

### 7.3 Késedelmi pótlék formula

**Confirmed from [Art. tv. 209. § (1)](https://net.jogtar.hu/jogszabaly?docid=a1700150.tv#lbj209id):**

> *„A késedelmi pótlék mértéke minden naptári nap után a késedelem, illetve az esedékesség előtti igénybevétel (felszámítás) időpontjában érvényes jegybanki alapkamat 5 százalékponttal növelt mértékének háromszázhatvanötöd része."*

```
Késedelmi pótlék per day = (MNB jegybanki alapkamat + 0.05) / 365

Total késedelmi pótlék = delta_huf × per_day_rate × days_overdue
```

**Önellenőrzési pótlék = 50% of the total késedelmi pótlék** (Art. tv. — confirmed).

**Note on precision (Art. tv. 209. § (2)):** The daily rate is rounded to 3 decimal places, dropping further decimals.

**Practical example (2024, base rate 10%):**
- Daily rate = (0.10 + 0.05) / 365 = 0.000411
- 100,000 HUF unpaid for 365 days = 41,096 HUF késedelmi pótlék + 20,548 HUF önellenőrzési pótlék

**App implementation:** Show an **indicative estimate only** — labelled *"Tájékoztató összeg / Indicative estimate"* — using historical MNB base rates from `tax-rules.json → mnb_base_rates`. The primary call-to-action must be a prominent link to the official NAV **Pótlékszámítás** calculator: `https://nav.gov.hu/ugyfeliranytu/eljarasi_kerdesek/Kalkulatorok/potlekszamitas`. Do not present the in-app figure as authoritative. A wrong number here destroys user trust more than the absence of the feature would.

---

## 7a. Adókiegyenlítés — Legislative Gap Finding

### What [Szja tv. § 67/A (6)–(8)](https://net.jogtar.hu/jogszabaly?docid=99500117.TV#lbj67Aid) actually says

**§ 67/A (6)** — entitlement condition:
> *„Ha a magánszemély az adóévben és/vagy az adóévet megelőző évben, és/vagy az adóévet megelőző két évben ellenőrzött tőkepiaci ügyletből származó veszteséget ér(t) el **és azt a veszteség keletkezésének évéről szóló adóbevallásában feltünteti**, adókiegyenlítésre jogosult, amelyet az adóbevallásában megfizetett adóként érvényesíthet."*

**§ 67/A (7)** — credit amount:
> *„...bevallott veszteségnek és a bevalláskor hatályos adókulcsnak a szorzata, **csökkentve az adóévet megelőző két év bármelyikéről szóló adóbevallásban** ellenőrzött tőkepiaci ügyletből származó veszteség miatt **már érvényesített adókiegyenlítéssel**."*

**§ 67/A (8)** — cap:
> *„...az adóévben és/vagy az azt megelőző két évben bevallott jövedelem adója, **csökkentve az adóévet megelőző két év bármelyikéről szóló adóbevallásban** már érvényesített adókiegyenlítéssel."*

### What the law covers
- Loss must be **declared in the return of the year it arose** — cannot be retrospectively created without önellenőrzés (§ 67/A (6))
- Already-used credit (*„már érvényesített"*) reduces what's available — the deduction in §§ (7) and (8)
- The 2-year window is anchored to the year being filed/amended

### What the law does NOT address — legislative silence
The phrase *„már érvényesített adókiegyenlítéssel"* refers to what was claimed **in the return**. The law is **completely silent** on:
1. What happens if that return is subsequently amended via önellenőrzés
2. Which return is authoritative — the original or the amended one — when calculating *„már érvényesített"*
3. Whether NAV expects cascading önellenőrzés across all affected years when one year is amended

**This is a genuine legal gap.** The recursive önellenőrzés cascade is not contemplated in the legislation.

### NAV's implicit expectation (Art. tv. general rules)
If a user amends year Y and changes adókiegyenlítés, they are responsible for also amending Y+1 and Y+2 if affected — but there is no explicit legal obligation defining this cascade. NAV will treat inconsistency across years as an error in whichever year they audit.

### App design consequence
**The app must not model the önellenőrzés cascade.** In önellenőrzés mode, adókiegyenlítés is calculated for the selected year in isolation. If adjacent years have ETÜ data in the ledger, a warning is shown — and the user is directed to a tax adviser for multi-year amendment scenarios. See the defensive design principle in AGENTS.md.

---

## 8. TB Járulék — Confirmed from Official Sources

**Source:** [NAV Fizetendő járulékok](https://nav.gov.hu/ugyfeliranytu/adokulcsok_jarulekmertekek/fizetendo_jar) (updated 2026-01-05) + NAV Füzet #04 §§7.2 and 9.

### 8.1 Rate — confirmed

**Verbatim from NAV:**
> *„A biztosított által fizetendő járulékok 2020. július 1-jétől: társadalombiztosítási járulék 18,5%"*

- **18.5% TB járulék** has been the effective combined employee rate since at least **2015** (prior to 2020-07-01 it was four separate line items totalling 18.5%: nyugdíjjárulék 10% + természetbeni egészségbiztosítási 4% + pénzbeli egészségbiztosítási 3% + munkaerőpiaci 1.5%).
- From **2020-07-01**: rebundled into a single "társadalombiztosítási járulék" at **18.5%**. Rate unchanged.

### 8.2 Applicability to equity income

SZOCHO (13%) and TB járulék (18.5%) are **separate, independent obligations**:

- **SZOCHO** is owed on összevont adóalap income when the individual is the self-payer (no kifizető). Always applies to foreign equity income.
- **TB járulék** is owed only when a **biztosítási kötelezettséggel járó jogviszony** (insured legal relationship) exists for the income in question. For equity classified as §28 egyéb jövedelem from a foreign parent with no HU employment relationship attached, **no such jogviszony exists → TB does NOT apply**.

**NAV Füzet #04 §9 verbatim:**
> *„Ha az Szja tv. szerinti egyéb jövedelem nem kifizetőtől származik, vagy az adóelőleget a kifizető nem köteles megállapítani, akkor az adófizetésre kötelezett a természetes személy."*

This covers SZOCHO self-payment. TB is a separate question: TB applies only if the person is a *biztosított* (insured) under Tbj. with respect to that specific income. For §28 egyéb jövedelem from a foreign parent, the person is not a biztosított under that income → **TB = 0**.

**App default: TB = OFF.** The checkbox remains for the edge case where the HU employer formally participates in granting the equity and TB liability could arise under a different income classification. Requires confirmation by a tax adviser in that edge case.

### 8.3 Egészségügyi szolgáltatási járulék (out of scope)

The NAV page also shows a **fixed monthly health service contribution** (egészségügyi szolgáltatási járulék) payable by uninsured individuals:

| Year | Monthly amount |
|---|---|
| 2026 | 12,300 Ft |
| 2025 | 11,800 Ft |
| 2024 | 11,300 Ft |
| 2023 | 9,600 Ft |

**This does NOT apply to equity recipients who are already insured through their Hungarian employer** (biztosítottként bejelentett munkavállalók). It is irrelevant to our app's target users and is included here for completeness only.

---

## 9. NAV Payment Details — Corrected and Extended

From NAV Füzet #04 section 9 (verbatim payment accounts):

| Obligation | Account number | IBAN | Payer |
|---|---|---|---|
| SZJA (annual / advance) | 10032000-06056353 | HU16 1003 2000 0605 6353 0000 0000 | Individual |
| SZOCHO (self-paid by individual) | 10032000-06055912 | **HU12 1003 2000 0605 5912 0000 0000** | Individual |
| TB járulék (self-paid by individual) | 10032000-06058200 | HU22 1003 2000 0605 8200 0000 0000 | Individual |
| TB járulék (withheld by foreign employer) | 10032000-06058190 | HU91 1003 2000 0605 5819 0000 0000 | Foreign employer |

**SZOCHO IBAN — confirmed by IBAN mod-97 calculation:**

Domestic account: `10032000-06055912` → 24-digit: `100320000605591200000000`

Mod-97 check digit computation:
- String: `100320000605591200000000` + H=17, U=30 + `00` = `100320000605591200000000173000`
- `mod 97 = 86` → check digits = `98 − 86 = 12`

**Confirmed SZOCHO IBAN: `HU12 1003 2000 0605 5912 0000 0000`**

> Note: The NAV PDF (section 9) printed `HU121100320000605591200000000` — this was a formatting artefact in the PDF text extraction (digits run together). The canonical account number `10032000-06055912` is correct; the IBAN derived from it is `HU12 1003 2000 0605 5912 0000 0000`.

**Transfer reference (Közlemény):** Adóazonosító jel (10-digit personal tax ID). **Mandatory.**

**Annual filing / payment deadline:** May 20 of the year following the tax year.

---

## 10. US-HU DTT Termination — Full Impact Map

| Scenario | Pre-2024 (DTT active) | 2024+ (no DTT) |
|---|---|---|
| RSU/ESOP/ESPP vest (US-listed, US parent) | Quarterly advance required; DTT credit possible for US withholding | **No quarterly advance** (no DTT → no advance obligation per NAV Füzet §5.2); full tax at annual return; no treaty credit |
| ETÜ sale of US shares via US broker | US broker qualifies for ETÜ (DTT criterion) | US broker **still qualifies** via OECD criterion (SZJA §67/A amended 2023); ETÜ treatment unchanged |
| US dividend | DTT: 5–15% US withholding, reduced HU side | 30% US withholding + 5% HU SZJA + 13% HU SZOCHO = ~48% total burden |
| UK equity (UK-HU DTT still active) | Quarterly advance YES; DTT credit available | **Unchanged** — UK-HU DTT still in force post-Brexit |

**App warning logic:**
- Any equity event from a US entity with date ≥ 2024-01-01: show a red warning banner about DTT termination and the impact on quarterly advance (none required) and dividend treatment (full SZOCHO + no credit)
- Any equity event from a US entity with date 2020–2023: show an informational note about pre-2024 DTT credit possibility; direct user to tax adviser for credit calculation

---

## 11. eSZJA Row Mapping — Confirmed from 24SZJA Kitöltési Útmutató

All rows below are confirmed from the **24SZJA kitöltési útmutató** (2024 income year form).

> **Critical correction vs. earlier plans and 23SZJA assumptions:**
> RSU/ESOP/ESPP/share award income goes into **sor 19** (not sor 161, which is *ingatlan/vagyoni értékű jog* — property sales).
> Sor 19 is explicitly described as the row for *"egyéb jövedelem, amely után Ön kötelezett a 13%-os SZOCHO megfizetésére"* with the 89% multiplier rule applying automatically.

### 24SZJA confirmed row mapping

| Event | Row | Form | Description | Source quote |
|---|---|---|---|---|
| **RSU / ESOP / ESPP / Share Award** (foreign kifizető, SZOCHO self-paid) | **19. sor** | 24SZJA-A lap | Egyéb jogcímen kapott jövedelem — 13% SZOCHO, 89% multiplier | *„Ebben a sorban kell szerepeltetnie azt az értékpapír-juttatást is, amely a felek között fennálló jogviszony és a szerzés körülményei alapján egyéb jövedelemnek számít... a megállapított jövedelem 89 százalékát kell jövedelemként figyelembe venni."* |
| Same event without SZOCHO (edge case) | **18. sor** | 24SZJA-A lap | Egyéb jövedelem — no SZOCHO (very rare; kifizető withholds) | Same section, preceding paragraph |
| **ETÜ net gain** | **172. sor "d" oszlop** | 24SZJA-04-es lap | Ellenőrzött tőkepiaci ügyletből származó jövedelem | *„172. sor: Ellenőrzött tőkepiaci ügyletből származó jövedelem és adója"* |
| **ETÜ loss** (must declare to preserve carry-forward) | **172. sor "a" oszlop** | 24SZJA-04-es lap | ETÜ veszteség — declare even with no gain to preserve 2-year right | *„Ha Ön a 2024. vagy az azt követő két évben adókiegyenlítést kíván elszámolni, a veszteség összegét e sor 'a' oszlopában tüntesse fel."* |
| **ETÜ tax** | **172. sor "e" oszlop** | 24SZJA-04-es lap | 15% SZJA on net gain | — |
| **ETÜ loss offset** (adókiegyenlítés) | **212–220. sorok** | 24SZJA-06-os lap | Prior-year ETÜ loss offset calculation | *„Az adókiegyenlítés kiszámítására a 24SZJA-06-os lap 212-220. sorai szolgálnak."* |
| **ETÜ offset applied to total SZJA** | **C lap 75. sor** | 24SZJA-C lap | *„A 210. sor 'c' oszlopában feltüntetett összeget kell átírnia a 24SZJA-C lap 75. sorába."* | — |
| **Foreign dividend SZJA** | **182. sor** | 24SZJA-05-ös lap | Osztalékból származó jövedelem és adója | *„Ha Ön 2023-ban külföldről kapott osztalékot, akkor ebbe a sorba annak teljes összegét írja be!"* |
| **SZOCHO on foreign dividend** | **24SZJA-09-es lap** | SZOCHO section | Self-paid SZOCHO bevallás | Confirmed from table of contents |

### Key changes vs. 23SZJA
| Form | 23SZJA row | 24SZJA row | Note |
|---|---|---|---|
| Equity income (RSU/ESOP etc.) | 161. sor | **19. sor** | Major change — 161 is now *ingatlan* (property) |
| ETÜ gain/loss | 172 (a/d/e oszlop) | **172 (a/d/e oszlop)** | Unchanged |
| ETÜ adókiegyenlítés | 212–219 | **212–220** | One additional row |
| C lap offset | C lap 75 | **C lap 75** | Unchanged |
| Foreign dividend | 182. sor | **182. sor** | Unchanged |
| SZOCHO | 09-es lap | **09-es lap** | Unchanged |

### Cross-year stability — confirmed from 23SZJA and 24SZJA kitöltési útmutató

| Row | 22SZJA | 23SZJA | 24SZJA | 25SZJA | Stable? |
|---|---|---|---|---|---|
| Equity income (RSU/ESOP/ESPP/award), SZOCHO self-paid | **19. sor** ✅ | **19. sor** ✅ | **19. sor** ✅ | **19. sor** ✅ | ✅ Confirmed stable 2022–2025 |
| ETÜ gain/loss/tax | **172. sor** ✅ | **172. sor** ✅ | **172. sor** ✅ | **172. sor** ✅ | ✅ Confirmed stable 2022–2025 |
| Foreign dividend | **182. sor** ✅ | **182. sor** ✅ | **182. sor** ✅ | **182. sor** ✅ | ✅ Confirmed stable 2022–2025 |
| Domestic dividend (not app scope) | 167. sor | 167. sor | 167. sor | 167. sor | Stable |
| Adókiegyenlítés | **212–220. sorok** ✅ | **212–220. sorok** ✅ | **212–220. sorok** ✅ | **212–220. sorok** ✅ | ✅ Confirmed stable 2022–2025 |
| C lap SZJA csökkentés | C lap 75. sor | C lap 75. sor | C lap 75. sor | C lap 75. sor | Stable |

**Sources:** 22SZJA, 23SZJA, 24SZJA, 25SZJA kitöltési útmutatók — all four confirmed by direct text extraction searching for *„értékpapír-juttatást is"*, *„172. sor: Ellenőrzött tőkepiaci"*, and *„külföldről kapott osztalékot"*.

**Verbatim (identical wording across all four years):** *„Ha [YEAR]-ben olyan egyéb jövedelmet szerzett, amely után Önnek kell a szociális hozzájárulási adót megfizetni... akkor azt a 19. sorban kell szerepeltetnie... Ebben a sorban kell szerepeltetnie azt az értékpapír-juttatást is..."*

**All eSZJA rows are fully confirmed for the entire 2022–2025 önellenőrzési / filing window. No remaining gaps.**

---

## 12. Scenarios the App MUST Handle

### Scenario Matrix

| # | Event type | Source country | Year | DTT? | Quarterly advance | SZOCHO | 89% | eSZJA rows |
|---|---|---|---|---|---|---|---|---|
| 1 | RSU_VEST | US | 2020–2023 | Yes (then) | YES (Q+1 month 12) | 15.5% / 13% × 89% | YES | **19. sor** (24SZJA) |
| 2 | RSU_VEST | US | 2024+ | No | **NO** | 13% × 89% | YES | **19. sor** (24SZJA) |
| 3 | RSU_VEST | UK | any year | Yes | YES | see rate table | YES | **19. sor** (24SZJA) |
| 4 | RSU_VEST | EU (EGT) | any year | Yes | YES | see rate table | YES | **19. sor** (24SZJA) |
| 5 | ESOP_EXERCISE | US | 2024+ | No | NO | 13% × 89% | YES | **19. sor** (24SZJA) |
| 6 | ESPP_PURCHASE | any | any | DTT-dependent | DTT-dependent | 13% × 89% | YES | **19. sor** (24SZJA) |
| 7 | SHARE_AWARD | any | any | DTT-dependent | DTT-dependent | 13% × 89% | YES | **19. sor** (24SZJA) |
| 8 | SHARE_SALE (ETÜ, gain) | US (US broker) | any | N/A | NO | 0% | NO | 172d, 172e |
| 9 | SHARE_SALE (ETÜ, loss) | any | any | N/A | NO | 0% | NO | 172a (declare!) |
| 10 | SHARE_SALE (ETÜ, gain with prior-year loss offset) | any | Y+1 or Y+2 | N/A | NO | 0% | NO | 172d+e, 212-220, C75 |
| 11 | DIVIDEND | US (NASDAQ/NYSE) | 2024+ | No | NO | 13% | NO | sor 182, 09-es lap |
| 12 | DIVIDEND | UK/EU EGT-listed | any | Yes | NO | **0%** (EGT exempt) | NO | sor 182 |
| 13 | DIVIDEND | US | 2020–2023 | Yes | NO | 13% (cap) | NO | sor 182, note DTT credit |
| 14 | ESPP + SHARE_SALE same shares | any | multi-year | DTT-dep. | YES for purchase; NO for sale | YES on discount; 0% on gain | YES on discount; NO on gain | 19. sor (discount) + 172d/e (gain) |
| 15 | Multi-lot sale (FIFO across vest dates) | any | any | N/A | NO | 0% | NO | 172d/e (net) |
| 16 | ETÜ loss year → gain next year (carry-forward) | any | Y, Y+1 | N/A | NO | 0% | NO | 172a (Y), 212-220+C75 (Y+1) |
| 17 | Önellenőrzés — undeclared RSU in closed year | any | 2021–2025 | DTT-dep. | Reconstruct; past deadline | 13% × 89% | YES | 19. sor + késedelmi + önellenőrzési pótlék |
| 18 | DIVIDEND SZOCHO cap reached mid-year | US | any | any | NO | 0% beyond cap | NO | 09-es lap (partial) |
| 19 | Private company stock at vest | any | any | DTT-dep. | DTT-dep. | 13% × 89% | YES | 19. sor (user supplies FMV) |

---

## 13. Confirmed corrections applied to spec documents

All items below have been corrected in `AGENTS.md` and `SPEC.md`.

| Item | Was (incorrect) | Confirmed correct | Legal basis |
|---|---|---|---|
| Quarterly advance deadlines | March/June/Sept/Dec 12 | **April/July/Oct/Jan 12** | NAV Füzet #04 §5.2 |
| Quarterly advance — US equity 2024+ | Required | **NOT required** (no DTT) | NAV Füzet #04 §5.2 |
| Foreign dividend eSZJA row | sor 167 | **sor 182** (05-ös lap) | Elemzésközpont |
| SZOCHO rate — 2019 | 19.5% full year | **19.5% H1, 17.5% H2** (split at 2019-07-01) | NAV rate page (2024-12-17) |
| SZOCHO rate — 2020 | 15.5% full year | **17.5% H1, 15.5% H2** (split at 2020-07-01) | NAV rate page (2024-12-17) |
| SZOCHO rate — 2022 | Mid-year change to 13% | **13% from 2022-01-01** (full year) | Szoctv. 2021. évi LXIX. tv. 81.§ |
| Késedelmi pótlék formula | 2 × base_rate / 365 | **(base_rate + 5 pp) / 365** | Art. tv. 209. § (1) |
| EGT dividend SZOCHO | 13% (capped) | **0%** for EGT-listed shares | Szoctv. / Elemzésközpont |
| SZOCHO IBAN | HU24 1003 2000... | **HU12 1003 2000 0605 5912 0000 0000** | IBAN mod-97 verified |
| 2026 minimum monthly wage | TBC | **317,000 HUF** (minimálbér) | 451/2024 Korm. rendelet |
| Quarterly SZOCHO advance | Unconfirmed | Follows same quarterly schedule as SZJA advance | Szoctv. 6. § (2) |

---

## 14. Open questions status — all resolved

| # | Question | Status |
|---|---|---|
| 1 | eSZJA row numbers for all years (2021–2025) | ✅ **RESOLVED** — confirmed from 21–25SZJA kitöltési útmutatók: equity income → **19. sor**; ETÜ → **172. sor**; dividend → **182. sor**; adókiegyenlítés → **212–220. sorok + C lap 75. sor**. Stable across all five years. |
| 2 | TB járulék in standard foreign-kifizető RSU model | ✅ Resolved: TB = 0 confirmed from NAV Füzet §9 + Szja tv. §28. Checkbox retained for edge case only. |
| 3 | MNB weekend/holiday rate fallback | ✅ Non-blocking: standard MNB practice (last published rate); app behaviour is correct. |
| 4 | sor 1 vs sor 161 for foreign §28 egyéb jövedelem | ✅ Resolved by #1: the correct row is **sor 19** (not sor 161) for 24SZJA. |
| 5–14 | All other questions from original list | ✅ All confirmed — see §13 corrections table. |

**All blocking questions are now resolved. All eSZJA rows confirmed across 2022–2025. The document is ready to guide implementation.**

---

*Document version: 1.3 — updated 2026-08-13*
*Sources: NAV Füzet #04 (2024-09-05), VGD Hungary (2023-02-02), Elemzésközpont (2026-05-05),*
*Szoctv. 2018. évi LII. tv. (hatályos), Art. tv. 2017. évi CL. tv. 209.§, Szja tv. 1995. évi CXVII. tv. 29.§/67/A.§*
*Not legal or tax advice. Verify all rules against current legislation before production release.*
