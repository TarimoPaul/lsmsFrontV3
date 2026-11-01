# Ripoti (bi) — 01/11/2026

nimesoma hadi (bi)

## 1. Hatua 61: KAGUA mapema

Hatua iko tayari kwa hili, na haihitaji kubadilishwa.

1. **02/11 au 03/11:** endesha `61-lipa-mkopo.cmd`. Mara ya kwanza inaendesha KAGUA yenyewe (haiandiki chochote) na inaishia `---SIMAMA-PREVIEW---`. Niletee log.
2. **04/11:** endesha 61 tena.
   - Mwendesho huu ukiuliza, andika **KAGUA**. Sababu: LIPA inakubali kagua ya siku hiyo hiyo tu.
   - Kisha endesha 61 mara ya tatu na uandike **LIPA**.

## 2. Reco na Cr 1000 ya repayment

**Jibu kwa code:** reco ya siku **haisomi GL 1000 hata kidogo**, wala `capital_injections`. Hesabu yote iko kwenye `DailyReconciliation.recalculate`:

- `expectedCash` = mauzo − mobile − madeni − matumizi − manunuzi − marejesho − amana za benki
- `todayFormulaResult` = hayo hapo juu − cash iliyotangazwa − petty cash

Mistari hii inatoka kwenye mauzo, malipo, na entries za reco pekee. Hakuna sehemu yoyote ya Reconciliation inayotaja journal, 1000 au mikopo. Code ya Loans na Reconciliation ya 2.4.0 ni sawa kabisa na ya 2.3.0 (diff tupu).

**Jaribio kwenye Docker-local** (nakala ya prod ya 29/10, `reco_repay.mjs`): repayment ya 386,000 CASH yenye tarehe 28/10.

| | reco 28/10 (expectedCash / variance) | GL 1000 hadi 28/10 |
|---|---|---|
| Kabla | 7,600 / 7,600 (APPROVED) | 13,825,008.39 |
| Baada ya POST | 7,600 / 7,600 — haijabadilika; auto-summary nayo haijabadilika | 13,439,008.39 (−386,000) |
| Baada ya reopen + refresh (kuhesabiwa upya) | 7,600 / 7,600 — sawa na kabla | — |

**Maana yake:**

- Mfumo wenyewe hauleti upungufu kwenye reco.
- **Upungufu utaonekana tu ikiwa 386,000 zitatolewa kwenye DROO kabla muuzaji hajahesabu na kutangaza cash.** Hapo cash iliyotangazwa itapungua kwa 386,000, na `todayFormulaResult` itaonyesha upungufu wa 386,000.
- Pesa zikitoka nje ya droo (cash ya CEO, au baada ya reco kufungwa), reco haiathiriki.
- **Kwa 04/11:** ikiwa pesa zitatoka droo, andika maelezo kwenye reco kwa mkono, kama ulivyosema.

**Pendekezo** (si sasa; prod haiguswi kabla ya 04/11; liingie kwenye orodha ya C baada ya uamuzi wako):

- Kanuni ya 19/10 inasema mkopo haulipwi kutoka droo. Ikiwa kanuni hiyo inabaki, hakuna code inayohitajika.
- Ikiwa droo itatumika, ongeza kwenye reco mstari wa **"Pesa iliyotoka kwa mkopo"**:
  - unajazwa wenyewe kutoka LOAN_REPAYMENT ya siku hiyo, ikiwa na alama "kutoka droo" inayochaguliwa wakati wa kulipa;
  - unatolewa kwenye `expectedCash` kama matumizi;
  - hauna journal mpya, kwa sababu GL tayari ina Cr 1000.

## 3. Lango la staging

Limeandikwa kwenye `analysis/MATAWI.md` (sehemu ya (ba)). Mambo yote matatu lazima yapite kwenye build ya mwisho.

**Backend `deploy/local/pg-checks.sh`** (release/2.4.0 `0dfee24`)
- Inatengeneza PG15 ya kutupwa (`lsms-pgcheck`). Kila check inapata DB tupu yake: LoanSqlPgCheck + SaleChangePgCheck. Container inaondolewa mwishoni, hata hatua ikishindwa.
- Matokeo: `PASS LoanSqlPgCheck 1/0`, `PASS SaleChangePgCheck 4/0`, **PG_CHECKS_OK 2/2**. Container 0 baada ya kumaliza.
- Control (bug ya A6 imewekwa makusudi): `PG_CHECKS_IMESHINDWA SaleChangePgCheck`, exit 1.

**Suite nzima:** `mvnw test` 546/0.

**V3 `deploy/local/e2e/run-all.sh`** (release/3.2.0 `388a272`)
- b1 na b2 zimehamishwa kutoka scratchpad kwenda kwenye repo.
- Mwendesho wa kwanza ulishindwa kwa sababu ya **majaribio yenyewe, si app**. Hayakuwa yakirudiwa juu ya nakala ileile:
  - b2 ilihesabu jumla ya safu kwenye DB badala ya mabadiliko;
  - b1 ilihesabu namba "2" kamili kwenye banner;
  - dialogi, banner na orodha zilisomwa kabla hazijajaa;
  - mabango ya madeni ("+47 more") yalifunika kitufe.
- Yote yamerekebishwa. **Mara mbili mfululizo: E2E_OK 2/2 (b1 27/0, b2 22/0).**

**`lsms-a6-pg` imefutwa.** Kuanzia sasa pg-checks.sh inaitengeneza na kuiondoa yenyewe.

## 4. Kumbuka

- Docker-local sasa ina malipo ya majaribio ya 386,000 kwenye mkopo A (28/10), na reco ya 28/10 iko REOPENED. Ni nakala ya kutupwa; `local.sh up` itairudisha safi kutoka dump.
- Uchunguzi wa UX (si kosa la B1): login ya MANAGER ilionyesha mabango ~50 ya "Malipo ya deni" ya 26–28/10 yaliyofunika sehemu ya chini kulia ya skrini. Niiongeze kwenye orodha ya baadaye?

## Kinachofuata

B3.
