# G5 — Gharama za mwaka: Flutter → V3, na GL mpya (mmiliki 09/11 dp)

Hali: **muundo (rasimu)**, hakuna code iliyoandikwa. Takwimu halisi za prod zitatoka hatua 79 (sehemu e/f).

## 1. Flutter ilifanyaje (njia MBILI)

### Njia A — wizard ya "Malipo ya Mwezi" (`simple_monthly_payment_wizard.dart`), chaguo **"Kwa Mwaka"**
Skrini: Capital → Expenses → "Malipo ya mwezi" → kitufe cha juu `Kwa Mwezi | Kwa Mwaka`.
Sehemu (Kwa Mwaka): maelezo (mf. "Leseni, Bima, Kodi ya Mwaka"), **Kiasi cha Mwaka Mzima**, mwaka; muhtasari "Jumla ya Mwaka" + kwa mwezi (÷12).
Inahifadhi **ROW MOJA** (`POST /api/v1/capital-expenditure`):
- `amount = jumla ÷ 12` (mf. Frame 2,400,000 → **200,000**), `expenditureType=MONTHLY_EXPENSE`, `allocatedMonth=0` ("mwaka mzima"),
  `transactionDate = 01/01/<mwaka>`, `status=APPROVED`, maelezo + " (Mwaka mzima - jumla: TZS 2,400,000)".
- GL (backend `postApprovedCapexToGl` → `postExpense`): **Dr 6200 200,000 / Cr 1000 200,000 tarehe 01/01** — MARA MOJA tu.
- Faida ya kila siku (daily-profit) inasoma `allocated_month=0` kama "kila mwezi" → inakata 200,000 kila mwezi (2.4M kwa mwaka).

**Matokeo kwa Frame 2.4M (mfano, nakala ya local):** `OPE-MON-20260101-…-F7C9E331` "KODI YA FRAME (Mwaka mzima - jumla: TZS 2,400,000)", 200,000, journal 2026-01-01 [1000:-200000, 6200:200000].
→ GL ina gharama 200,000 tu badala ya 2,400,000 (**pungufu 2,200,000**), na pesa iliyotoka (1000) ni 200,000 badala ya 2,400,000.
   Ripoti ya daily-profit na GL hazilingani kwa 2.2M kwa mwaka.

### Njia B — fomu "Matumizi ya Mwaka" (`annual_expense_form.dart`)
Sehemu: maelezo, kiasi cha mwaka, mwaka, **mwezi wa kuanza** (mf. bima iliyonunuliwa Julai), muhtasari kwa mwezi (÷12) na kwa siku (÷365), dialogi ya kuthibitisha.
API: `POST /api/v1/capital-expenditure/annual-expense?totalAmount&description&year&startMonth`.
Backend (`CapitalExpenditure.createAnnualExpenseWithMonthlyAllocation`): parent `ANNUAL_EXPENSE` (jumla, **haijaidhinishwa**) + watoto 12
`MONTHLY_EXPENSE` (÷12, tarehe ya 1 ya kila mwezi, APPROVED na SYSTEM_AUTO).
- GL: kila mtoto, tarehe yake ikifika (job ya `postDueApprovedCapex`): **Dr 6200 ÷12 / Cr 1000 ÷12** kila mwezi.
  Kosa: pesa ilitoka YOTE siku ya malipo, lakini GL inaonyesha pesa ikitoka kidogo kidogo kila mwezi (1000 inakuwa juu kuliko ukweli).
  Parent (jumla) ikiidhinishwa kwa mkono baadaye → `postExpense` ingeandika jumla TENA (**mara mbili**).
  Mtoto ambaye tarehe yake iko kwenye kipindi kilichofungwa → `firstOpenDate` inamhamisha kimya kwenda siku ya kwanza wazi.

**Njia A kwenye nakala ya local (dump ya prod ~04/11) — hatua 79-e2:**

| Gharama | Jumla ya mwaka | Row (kiasi) | GL iliyoandikwa | GL ingepaswa (mwaka) | Tofauti ya gharama |
|---|---:|---:|---|---:|---:|
| KODI YA FRAME 2026 | 2,400,000 | 200,000 | 01/01: Dr 6200 200,000 / Cr 1000 200,000 | 2,400,000 | −2,200,000 |
| Malipo ya Kodi TRA 2026 | 250,000 | 20,833.33 | 01/01: Dr 6200 20,833 / Cr 1000 20,833 | 250,000 | −229,167 |

(Prod halisi: 79-e2 itaonyesha orodha kamili.)

**V3 leo:** hakuna gharama za mwaka kabisa (hakuna fomu, hakuna `annual-expense`, hakuna ANNUAL_EXPENSE kwenye `features/capital`).

## 2. Muundo mpya (G5)

### UI (kama Flutter, kwenye V3 Capital → Expenses)
- Kitufe kimoja "Gharama mpya" → `Kwa Mwezi | Kwa Mwaka` (kama wizard ya Flutter).
- Kwa Mwaka: maelezo, kiasi cha mwaka, mwaka, **mwezi wa kuanza** (kutoka fomu B), **tarehe ya malipo**, **chanzo cha malipo (C3:
  DROO / BENKI orodha / SIMU orodha / MMILIKI, bila default)**; muhtasari: kwa mwezi (÷12, mwezi wa mwisho unachukua senti zilizobaki),
  kwa siku (÷365); jedwali la miezi 12 (mwezi → kiasi → "Imepangwa"/"Kwenye vitabu"); dialogi ya kuthibitisha.
- Orodha: gharama za mwaka zionekane pamoja na za mwezi (G4), kila moja na hali ya miezi yake 12.

### GL (MPYA)
| Tukio | Journal | Tarehe |
|---|---|---|
| Kulipa (kuhifadhi) | **Dr 1160 Prepaid expenses / Cr chanzo** (C3: kabla ya cutover D → 1000; baada → akaunti halisi; MMILIKI → 2300) — JUMLA | tarehe ya malipo |
| Kila mwezi (×12) | **Dr 6200 (au akaunti ya aina) / Cr 1160** — ÷12 (wa mwisho = salio) | siku ya 1 ya mwezi husika, si kabla ya mwezi kufika |
- Mwisho wa miezi 12: 1160 ya gharama hii = 0 (ukaguzi).
- Mwezi ulio kwenye kipindi KILICHOFUNGWA: **kataa** wakati wa kuhifadhi (G1, dm) isipokuwa uamuzi wa CEO — si `firstOpenDate`.
- Hakuna parent inayoandika jumla kama gharama (kosa la njia B linaondoka).
- Faida ya kila siku: watoto 12 wanabaki rows za `MONTHLY_EXPENSE` (÷12) → wasomaji wa sasa hawabadiliki; ni journal zao tu zinazobadilika (Cr 1160 badala ya Cr pesa).

### Akaunti 1160
**Haipo** kwenye gl_account (ipo 1150 "Riba ya mkopo isiyogawanywa"). Inahitajika: `1160 Prepaid Expenses / Gharama Zilizolipwa Mapema`, ASSET, DEBIT.
Njia ya DATA (dn, bila deploy): row ya gl_account kwa hatua yenye KAGUA → ANDIKA; toleo 2 linaiweka pia kwenye migration (idempotent, ON CONFLICT).

## 3. Kurekebisha data ya Flutter (pendekezo — baada ya log ya 79)
Kwa kila gharama ya mwaka ya njia A (`allocated_month=0`, "Mwaka mzima"):
1. Chief athibitishe: tarehe halisi ya malipo, chanzo, na jumla.
2. Journal ya marekebisho (mkono, hatua yenye KAGUA → ANDIKA):
   - pesa iliyotoka: Dr 1160 jumla / Cr chanzo jumla, **ukiondoa** 200,000 iliyokwisha andikwa (Dr 6200 / Cr 1000 ya 01/01);
   - gharama ya miezi iliyopita: Dr 6200 / Cr 1160 kwa miezi iliyofika.
   Miezi ya 2026 Jan–Sep ni CLOSED → kwa kanuni: marekebisho yanaandikwa kwenye kipindi cha kwanza wazi **kwa maelezo wazi** ("marekebisho ya
   Kodi ya Frame Jan–Okt"), au CEO afungue vipindi — uamuzi wa Chief.
3. Prepaid ya 2027 (dn): journal za mkono Dr 1160 / Cr chanzo, kisha 1/12 kila mwezi wa 2027.
Takwimu kamili (kila gharama, kiasi, journal zilizopo) zitajazwa kutoka hatua 79-e/f.

## 4. Maswali kwa Chief
1. Frame 2.4M: ililipwa lini na kutoka wapi (droo/benki/mmiliki)? Ni ya 01/2026–12/2026?
2. Kuna gharama nyingine za mwaka (leseni, bima, TRA)? (79 itaorodhesha `allocated_month=0` zote.)
3. Marekebisho ya miezi iliyofungwa: kipindi cha kwanza wazi, au kufungua vipindi?
