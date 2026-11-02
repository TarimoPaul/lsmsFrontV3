# Ripoti (bs) — 02/11/2026

nimesoma hadi (bs). Herufi tangu ripoti iliyopita (br): (bs) tu.

Kusoma tu, nakala ya Docker-local (dump lsms_20261029_1027). Data ni hadi 29/10 saa 10:27; kilichotokea baadaye hakimo.

## 1. 1120 — madai kwa wafanyakazi

**Salio:** mfanyakazi ni MMOJA tu, macheda macheda.
- Daftari la madai (staff_liability): 1,000,301.88
- GL 1120: 1,000,301.88. Yanalingana.

| Hali | Madai | Kiasi | Kilicholipwa |
|---|---:|---:|---:|
| OPEN | 72 | 605,256.40 | 0 |
| PARTIALLY_PAID | 6 | 549,135.48 | 154,090.00 |
| SETTLED | 2 | 57,779.38 | 57,779.38 |
| WAIVED | 1 | 8,625.00 | (haikuwahi kuingia GL) |

**Makusanyo 2026** (yote yaliandikwa na Paul Tarimo; CASH ni Dr 1000 / Cr 1120):

| Tarehe | Kiasi | Aina | Maelezo |
|---|---:|---|---|
| 28/07 | 45,817.00 | CASH | |
| 28/07 | 11,961.71 | CASH | |
| 28/07 | 65,590.67 | WAIVER_PARTIAL (Dr 5100) | msamaha |
| 06/08 | 33,000.00 | CASH | |
| 15/10 | 28,500.00 | CASH | "Ilizidi kwenye cash" |
| 15/10 | 15,000.00 | CASH | "Ilizidi kwenye mauzo ya 12" |
| 15/10 | 10,000.00 | CASH | "Iliuzwan sequor maji" |
| 15/10 | 2,000.00 | CASH | "Imezidi kwenye mauzo" |

- CASH jumla ni 146,278.71 na msamaha ni 65,590.67.
- Malipo ya 15/10 hayakuwa pesa mpya kutoka kwa mfanyakazi. Maelezo yanaonyesha yalikuwa ziada za droo/mauzo
  zilizotumika kufuta deni, na yaliandikwa Dr 1000.
  Ikiwa ziada hizo zilikuwa tayari ndani ya 1000 kupitia reco, basi 55,500 imehesabiwa mara mbili kwenye 1000. Hii inahitaji ukaguzi wa reco za siku hizo.

**Mshahara wa Oktoba ulikatwa? HAPANA, kwa mujibu wa mfumo hadi 29/10:**
- Hakuna malipo ya aina PAYROLL_DEDUCTION, kwa mwaka mzima.
- monthly_deduction iko tupu kwa madai yote, na staff_liability_deduction_log ina safu 0.
- Gharama ya Oktoba "malipo ya wafanyakazi" (300,000, iliyotengwa 01/10, APPROVED) ni jumla moja, haina mgawanyo kwa mtu.
- Ikiwa makato yalifanyika kwa mkono nje ya mfumo (au baada ya 29/10), hayamo kwenye data. Kuthibitisha prod baada ya
  29/10 kunahitaji hatua ya kusoma tu; sikuiandika kwa sababu umesema usisubiri logs.

## 2. Sale zote 2026 zenye punguzo

| Tarehe | Risiti | Cashier | Mteja | Mistari | Punguzo | Total | Gharama | Margin | Hali | |
|---|---|---|---|---:|---:|---:|---:|---:|---|---|
| 06/10 | 061026-1933 | macheda macheda | witty | 300,000 | 20,000 | 280,000 | 283,391.56 | −3,391.56 | PAID | **CHINI YA GHARAMA** |
| 10/10 | 101026-2202 | macheda macheda | sky | 68,000 | 13,500 | 54,500 | 63,899.76 | −9,399.76 | PARTIAL | **CHINI YA GHARAMA** |
| 10/10 | 101026-2209 | macheda macheda | Mgombani | 114,500 | 100,000 | 14,500 | 105,549.90 | −91,049.90 | PAID | **CHINI YA GHARAMA** |

- Jumla: punguzo 133,500, hasara −103,841.22.
- Hakuna punguzo kabla ya Oktoba, na hakuna punguzo la mstari (sales_details.discount_amount) mwaka mzima.
- Sale zilizofutwa zenye punguzo (hazimo kwenye jedwali):
  - 061026-1923: mistari 300,000, punguzo **280,000**, total 20,000. Inaonekana kosa la kuandika; ilirudiwa kama 1933 (punguzo 20,000).
  - 121026-2201: mistari 305,000, punguzo **135,000**, total 170,000.
  - Sale zote mbili hazina deleted_at wala sababu (ni kabla ya A6, kama 236 nyingine).

## 3. BAADA-YA-BATCH §0 (kipaumbele cha juu)

Imeongezwa: punguzo linaloifanya sale kuwa chini ya gharama linakataliwa isipokuwa mtumiaji ana ruhusa ya CEO na ametoa sababu.
- Kinga iko kwenye backend, kwa kila njia: sale mpya, edit, na punguzo la baadaye.
- Inakaguliwa (audit) kama A6, na CEO anapata notification.
- POS inaonyesha "chini ya gharama kwa X".
- Orodha ya majaribio iko kwenye faili.

**Inayofuata:** onyo la manunuzi "carton au chupa?", kisha B5.
