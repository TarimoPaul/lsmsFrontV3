# B4 + "Daraja na GL" (mmiliki 01/11 bm) — ripoti

Backend release/2.4.0 = `65d7efb` (feature/pnl-bridge `eb0f6fd`). V3 release/3.2.0 = `02e8479` (feature/v3-b4 `cf79d44`).

## Kilichojengwa

- **Backend:** `GET /api/v1/reports/pnl-bridge?from&to` (ruhusa PROFIT_REPORT, siku 93 kama daily-pnl).
  Inarudisha: Net ya uendeshaji, mistari ya tofauti zinazojulikana (kila moja na idadi ya rekodi), "tofauti isiyoelezeka",
  na Net ya GL. Ripoti mbili zinabaki mbili.
- **Kanuni ya daraja:** kila mstari unahesabiwa kutoka chanzo chake — akaunti ambayo ripoti ya uendeshaji haiitumii, au
  rekodi zilizooanishwa na journal zake. Hakuna mstari unaohesabiwa kama "kilichobaki". Kwa hiyo "isiyoelezeka" ni jibu
  halisi: ni 0 tu pale kila tofauti ina jina.
- **V3, ripoti ya uendeshaji (Ripoti → Faida):** kadi "Daraja na GL" ya kipindi kilekile. Isiyoelezeka ina desimali 2 na
  ni nyekundu ikiwa ≠ 0.
- **V3, GL → Faida na hasara (B4):** "Baada ya mikopo":
  - Faida halisi (GL);
  - − akiba ya kila mkopo (memo);
  - = Inayobaki (nyekundu < 0);
  - na siku zilizokuwa chini ya sifuri. Kipindi kinaishia leo (akiba ni ya kila siku).

## Mistari ya daraja

| Code | Maana | Chanzo |
|---|---|---|
| RIBA | Riba ya mikopo | GL 6600 |
| PUNGUZO | Punguzo na marejesho ya mauzo | GL 4010/4020 |
| MAPATO_MENGINE | Mapato mengine | GL 4xxx isipokuwa 4000/4010/4020 (mf. 4900 ya madai ya wafanyakazi) |
| DROO | Upungufu/ziada ya droo | GL 6700 |
| MADENI_YALIYOSAMEHEWA | Madeni yaliyosamehewa | GL 6110/6120 |
| UPOTEVU_NJE_YA_HESABU | Upotevu wa stock nje ya hesabu | GL 5100 isiyo ya hesabu (mf. bidhaa zilizoharibika DMG-) |
| UCHAKAVU | Uchakavu | Uendeshaji kila siku dhidi ya GL 6500 (inaandikwa mwanzo wa mwezi unaofuata) |
| GHARAMA_ZA_MWEZI | Gharama za mwezi/mwaka | Uendeshaji unagawa kila siku; GL kwa tarehe ya journal (mf. pango la mwaka liliandikwa Januari) |
| RECO_HAIJAANDIKWA | Matumizi ya reco yasiyo kwenye GL | Reco ambayo haijaidhinishwa au haijapostiwa |
| RECO_TAREHE | Matumizi ya reco, tarehe tofauti | Siku ya reco tofauti na tarehe ya journal |
| MATUMIZI_MENGINE_GL | Matumizi mengine ya GL | 6xxx yasiyo ya reco wala ya mwezi |
| HESABU_TAREHE | Marekebisho ya hesabu ya stock, tarehe tofauti | Siku ya kuidhinisha tofauti na tarehe ya journal |
| ADJ_ZA_MKONO | Marekebisho ya stock ya mkono (ADJ-*) | Thamani au siku ya uendeshaji tofauti na ya journal yake (`STOCK:<movement>`) |
| MAUZO_NJE_YA_UENDESHAJI | Mauzo kwenye GL yasiyo kwenye uendeshaji | Yaliyofutwa, ya kipindi kingine, marejesho |
| MAUZO_BILA_JOURNAL | Mauzo ya uendeshaji bila journal ya kipindi | — |
| JOURNAL_ZA_MKONO | Journal za mkono (MANUAL_ADJUSTMENT) | Mf. J1/J2 za hatua 63 |

Dokezo (si sehemu ya daraja): mistari ya hesabu isiyoandikwa haimo kwenye ripoti zote mbili.

## Jaribio: Oktoba kwenye nakala ya 29/10 (Docker-local, PG15, image ya release/2.4.0)

Mikopo A na B ikiwa na masharti kama hatua 69 ilivyofanya kwenye prod:

| Mstari | Kiasi | Rekodi |
|---|---:|---:|
| **Net ya uendeshaji** | **2,215,448.99** | |
| Riba ya mikopo (6600) | −48,086.92 | 28 |
| Punguzo la mauzo (4010) | −133,500.00 | 7 |
| Mapato mengine (4900, madai ya wafanyakazi) | +57,486.54 | 37 |
| Droo (6700) | −61,300.00 | 67 |
| Madeni yaliyosamehewa (6120) | −13,000.00 | 1 |
| Upotevu nje ya hesabu (5100 DMG-, 11/10) | −31,500.00 | 1 |
| Uchakavu (uendeshaji kila siku; GL ya Oktoba bado) | +146,012.42 | 0 |
| Gharama za mwezi/mwaka (pango la frame + TRA viliandikwa 01/01) | +220,833.33 | 2 |
| Reco tarehe (matumizi ya reco ya 30/09 yaliandikwa 01/10) | −18,000.00 | 4 |
| ADJ za mkono (thamani = ya journal) | 0.00 | 4 |
| Mauzo nje ya uendeshaji (yaliyofutwa ndani ya Oktoba) | 0.00 | 56 |
| **Tofauti isiyoelezeka** | **0.00** | |
| **Net ya GL** | **2,334,394.36** | |

Mistari 203 ya hesabu isiyoandikwa haimo kwenye ripoti zote mbili.

**Kinga:** +1,000 kwenye mstari wa 4000 wa mauzo moja (bila sababu yenye jina) → isiyoelezeka +1,000.00, nyekundu. Ilirudishwa.

## Majaribio

- **Backend:**
  - PnlBridgeCalculatorTest 2/0; suite 550/0/1.
  - PnlBridgePgCheck kwenye PG15 tupu yenye rekodi za kila aina 1/0. Imeongezwa kwenye lango la staging: `pg-checks.sh` → PG_CHECKS_OK 3/3.
  - Mutations 3/3 zimekamatwa: mauzo yaliyofutwa kuhesabiwa, sharti la reco kugeuzwa, nafasi kukosekana kwenye SQL.
- **V3:** b4_e2e 9/0 (mistari yote = API, isiyoelezeka 0 si nyekundu, kinga ya +1,000 nyekundu, akiba ya A/B, inayobaki,
  siku 24 chini ya sifuri = API). run-all E2E_OK 5/5 (b1 27, b2 22, b3 38, b4 9, mabango 10).

## Masahihisho ya ripoti iliyopita

- Nilisema marekebisho ya stock ya mkono (ADJ-*) "hayana journal". **Si kweli:** yana journal zenye `reference_uid = STOCK:<movement uid>`
  (StoreService). Nilikuwa nimeyatafuta kwa rejea isiyo sahihi. Kwenye Oktoba thamani yake ni sawa pande zote mbili.
