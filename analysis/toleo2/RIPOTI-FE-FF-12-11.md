# Ripoti (fe)(ff) 12/11 — makadirio ya toleo 2 na D, hatua 60 mpya, ulinganisho wa benki, uhamisho wenye ada

nimesoma hadi (ff)

Mpangilio wa (ff): 4 → 3 → 2 → 1 → 5.

## 4. Makadirio ya siku zilizobaki → tarehe ya prod na D

Siku = siku za kazi (Jumatatu–Ijumaa) za code + majaribio (Docker-local, suite, PG, E2E), kuanzia Ijumaa 13/11. Hazihesabu muda wa kusubiri majibu.

| Kipengele | Kilichobaki | Siku | Kinasubiri Chief? | Pendekezo |
|---|---|---:|---|---|
| C4 marejesho (kazi 8) | jaribio la UI (dirisha la marejesho) + reco ya pesa iliyorudishwa siku nyingine; swichi inabaki OFF | 1.0 | Hapana (Q8-1 ni ya kuwasha tu) | toleo 2 |
| 6e droo kwenye reco | mstari wa auto = malipo/manunuzi ya chanzo DROO tu (fc: droo hulipa mara chache) | 1.5 | Q6e-1..3 | toleo 2 |
| 6d akiba 1010 | akaunti + mstari wa reco + chanzo AKIBA + ufunguzi | 2.0 | Q6d-1..4 | **BAADA** (si kosa la pesa; ni kipengele kipya. Bahasha inabaki ndani ya 1000, hatua 60 inaiuliza) |
| SKU za Jagger (kazi 7) | majina/saizi + pieces_per_package (hatua ya data) | 0.5 | Q7-1 | toleo 2 |
| Vidogo vya toleo 2 | §15 payment_status ya zamani (data, 0.5), §10 benki zisizotumika → is_active=false (0.25), memo > herufi 100 (0.25), footer F1 (0.1) | 1.1 | §15 orodha, §10 orodha, F1 tahajia | toleo 2 |
| §14 maelezo ya malipo ya msambazaji, §16 audit ya capex | PATCH notes; historia ya kuidhinisha | 0.8 | Hapana | **BAADA** (si pesa) |
| Usafi (kazi 9) | C7 njia 26 + M1 + docker-compose.aws.yml (1.0), C6 DROP backup + view 4 (0.5), §17 DISPOSED (0.5), Flyway V039/outOfOrder (0.5), config (0.1), log ya build UTF-16 (0.1) | 2.7 | M1 (a)/(b), C6 nakala B2, ruhusa ya `flyway repair` V039, Q9-1 (Flutter) | toleo 2; sehemu ya Flutter ya C7 → BAADA kama 90 haijaendeshwa kufikia 18/11 |
| Hatua 60 (ufunguzi) | **imekamilika leo** (sehemu 3 hapa chini) | 0 | Siku ya D: salio la taarifa + hesabu ya pesa taslimu | — |
| Ulinganisho wa benki wa mwezi | tazama sehemu 2 | 2.0 | Hapana | **BAADA** (Januari) |
| Kazi 10: release | merge ya matawi 3 (backend na V3) 0.75, lango kamili 1.0, script ya deploy (kama 76) + mpangilio wa hatua za data 1.0, staging + rollback halisi 0.5, prod 0.5 | 3.75 | Chief anaendesha staging/prod | toleo 2 |

| Hesabu | Siku | +15% akiba | Prod inawezekana | D |
|---|---:|---:|---|---|
| Kila kitu (pamoja na 6d, §14/§16, ulinganisho wa benki) | 15.4 | 17.7 | ~Jumanne 08/12 | inakosa 07/12 → **04/01** |
| **Pendekezo** (6d, §14, §16, ulinganisho wa benki → BAADA) | 10.6 | 12.2 | **Jumatano 02/12** (akiba: hadi Ijumaa 04/12) | **Jumatatu 07/12** |
| D 30/11 (prod Ijumaa 27/11 = siku 11) | 10.6 | — | hakuna akiba hata siku moja | **haipendekezwi** |

**Pendekezo: toleo 2 prod Jumatano 02/12, D = Jumatatu 07/12.**

| Tarehe | Kazi |
|---|---|
| 13/11 – 25/11 | C4 iliyobaki → 6e → Jagger → vidogo → usafi (C7 → C6 → §17 → V039 → config → UTF-16) |
| Alh 26/11 | merge: backend `release/2.5.0` = t2-cutover + t2-marejesho + t2-afya; V3 `release/3.3.0` vivyo hivyo |
| Ijm 27/11 | lango kamili kwenye nakala safi (suite, PG, c2, run-all, Flyway 134→149+) |
| Jtt 30/11 | script ya deploy (kama 76) + mpangilio wa hatua za data |
| Jnn 01/12 | staging + rollback halisi (Chief) |
| **Jtn 02/12** | **prod** (Chief); baada yake: 89 (inahitaji V145), 74, §10 benki zisizotumika, 85 (baada ya Chief kuhesabu) |
| 03–04/12 | akiba |
| Jpl 06/12 jioni | salio la taarifa: NMB, Selcom, M-Pesa, Tigo |
| **Jtt 07/12 asubuhi** | **D**: `60-ufunguzi.cmd kagua` → soma → `andika` (kabla ya duka kufunguliwa) |

Kanuni ya (fd): prod ikichelewa kupita Ijumaa 04/12, toleo 2 na D vinahamia Januari (D 04/01). Hapo malipo ya 01/01/27 (2400 600,000, 2200 65,000)
na malipo ya mwaka ya 2027 yafanyike kwa "Journal ya mkono", kama ilivyopangwa (dn/dt).

**Majibu yanahitajika kufikia Jumatano 18/11.** Kipengele kisichojibiwa kinahamia BAADA, bila kuchelewesha toleo:
Q6e-1..3, Q7-1, Q9-1 (endesha 90), M1 (a)/(b), V039 `flyway repair` (ndiyo/hapana), C6 (nakala B2), §10 (orodha ya benki zinazotumika), §15 (orodha), F1 (tahajia).

## 3. Hatua 60 — ufunguzi + D (IMEANDALIWA, imejaribiwa local)

Faili mpya: `steps/60-ufunguzi.{sh,ps1,cmd}`. `60-prod-bank-cutover.cmd` **imestaafu**: inakataa na inaelekeza kwenye 60-ufunguzi. Haiwezekani tena kuweka D bila ufunguzi.
`60-bank-cutover.sql` inabaki kama ilivyo, na 60-ufunguzi inaitumia kuweka D pamoja na kinga zake zote.

- **Inauliza:** salio la taarifa la NMB, Selcom, M-Pesa na Tigo (jioni ya jana); pesa taslimu YOTE (droo + sefu + bahasha); bahasha (taarifa tu).
  Kwenye `andika` inauliza pia uamuzi wa tofauti. D = tarehe ya leo: journal haiwezi kuwa ya baadaye, na D ya zamani ingeacha reco za katikati bila kuhamishwa.
- **Journal ya ufunguzi** (`UFUNGUZI-60`, tarehe D, kupitia API ya journal ya mkono, CEO): kila akaunti **inawekwa sawa na salio halisi**, yaani tofauti tu ndiyo inaandikwa, na kiasi hicho kinatoka 1000.
  Mfano: 1030 tayari ina 163,000 (prod), kwa hiyo journal ni salio halisi − 163,000, si kuongeza juu yake.
  Ni uhamisho tu, kwa hiyo TB haibadiliki.
- **Tofauti ya ufunguzi** = pesa taslimu halisi − 1000 baada ya journal. Inaonyeshwa kwenye KAGUA kama `TOFAUTI_YA_UFUNGUZI`.
  - Kama si 0, ANDIKA inakataa mpaka Chief aamue: `acha` (haiandikwi; inaonekana kwenye log) au namba ya akaunti (k.m. 3900 "Opening Balance Equity").
  - Ukitaja akaunti, inaandikwa journal ya pili, wazi (`UFUNGUZI-60-TOFAUTI`).
  - Akaunti ya pesa (1000/102x/103x) inakataliwa.
- **Kinga:**
  - akaunti nyingine za benki/simu (1020/1022/1024/1032/1033) lazima ziwe 0;
  - hakuna journal ya pesa isiyo ya mauzo yenye tarehe D au baadaye (ingeandikwa kwa kanuni ya kabla ya D);
  - D iliyowekwa tofauti haibadilishwi, na mwezi wa D usiwe umefungwa;
  - baada ya journal, kila akaunti (kabla ya D + ufunguzi) = salio halisi na TB haijabadilika, kisha ndipo D inawekwa (kinga za 60-bank-cutover.sql).
  - Ukiendesha mara ya pili: ufunguzi uliopo unarukwa, na D ileile inaonyesha CUTOVER_TAYARI.
  - Kosa likitokea baada ya journal: D haiwekwi, log inasema hivyo, na kuendesha tena kunamalizia.
- **Ugunduzi kwenye nakala ya 29/10:**
  - 1021 NMB tayari ina **1,186,000** kabla ya D: mkopo (LOAN_RECEIVED 04/10) uliingia NMB moja kwa moja.
  - 1030 ina 166,000: madeni ya wateja yaliyolipwa kwa M-Pesa.
  - Ufunguzi unaziweka zote sawa na salio halisi, kwa hiyo hazihesabiwi mara mbili.
  - 1000 ya vitabu (13.7M kwenye nakala) haitalingana na droo halisi. Tofauti hiyo kubwa ndiyo Chief ataamua siku ya D.
- **Jaribio** `toleo2/60-majaribio/t60.sh` kwenye nakala safi ya dump 29/10 (image local-d9498e1, Flyway 134→149): **15/0**.
  - K1–K2: KAGUA inaonyesha hesabu sahihi.
  - A1–A6 zinasimama bila kuandika chochote: tofauti bila uamuzi, D si leo, password mbaya, kiasi si halali, tofauti kwenda akaunti ya pesa, journal ya pesa ya siku D.
  - W1–W4: ufunguzi, akaunti = halisi, TB ileile, D = leo, mara ya pili haiandiki kitu.
  - W5 (fe): Selcom 300k → NMB ada 2k kupitia uhamisho = 1023 0, 1021 1,798,000, TB 0.
  - W6: tofauti → 3900, na 1000 = pesa taslimu halisi.
  - W7: maandishi ni ASCII.
  - Log: `60-majaribio/t60.log`.

## 2. Ulinganisho wa benki wa mwezi — makadirio: **siku 2, BAADA (Januari)**

- Muundo:
  - jedwali (V150) la salio la taarifa: akaunti, mwezi, kiasi, nani/lini, maelezo; Chief anaingiza.
  - API inarudisha kwa kila akaunti 1021/1023/103x: salio la GL mwisho wa mwezi, salio la taarifa, tofauti (H1-style, **bila kizingiti**: tofauti yoyote ≠ 0 inaonekana).
  - Ukurasa wa V3 chini ya GL.
  - Hakuna journal ya moja kwa moja. Kurekebisha tofauti ni kwa "Correct"/true-up iliyopo (CEO) au journal ya mkono.
- Makadirio: backend 0.75 + V3 0.75 + majaribio 0.5 = **siku 2**.
- Kwa nini BAADA:
  - mwezi wa kwanza baada ya D 07/12 unaisha 31/12, ndani ya wiki iliyokatazwa (14–31/12), kwa hiyo ulinganisho wa kwanza ni wa Desemba, mwanzoni mwa Januari;
  - si kosa la pesa;
  - kuuongeza sasa kungesogeza prod kupita 04/12.
- Hadi hapo: salio la akaunti kwenye GL (V3) linalinganishwa kwa mkono na taarifa.

## 1. (fe) uhamisho wenye ada — IMEKAMILIKA

- Backend `feature/t2-cutover` **d9498e1**:
  - `/api/v1/gl/transfers` ina **ada**, inayokwenda 6130 "Ada za benki na simu" (V149);
  - **sababu inahitajika** (A6) na ndiyo audit (nani, lini, kwenye journal);
  - inakataa uhamisho wa benki/simu **kabla ya D**, kwa sababu hapo bado ni sehemu ya 1000;
  - ruhusa: FINANCE_WRITE.
- V3 `feature/t2-cutover` **61a618e**: dirisha la "Transfer" la GL lina ada, linaonyesha "kinachofika", na sababu ni ya lazima.
- Jaribio lako: amana Selcom 500k → uhamisho NMB 500k ada 2k → **1023 = 0, 1021 = 498k, 6130 = 2k, TB 0**.
  - `cutover_api_e2e` **10/0**: T7 ndilo hili; T8 kabla ya D inakataliwa; T9 bila sababu inakataliwa. Imeendeshwa tena leo, kabla ya kubadilisha nakala.
  - t60 W5 inarudia hili baada ya ufunguzi.
- Hatua 60: salio la ufunguzi la 1023 = salio halisi la Selcom siku ya D (sehemu 3).

## 5. Commit
- analysis: MAAGIZO (fe)(ff), 89 + t89 (2939F6DE, kutoka ez), MPANGO, hatua 74, hatua 60 mpya + t60, ripoti hii. Commit kwenye `main` ya V3 (analysis).
- 58b-prod-schedulers-soma.cmd: haijaguswa (CRLF tu, ex).

## Jedwali la origin — matawi ya t2-* (12/11 asubuhi)

Backend (`Lsms`). Mpangilio ni mnyororo mmoja (gharama → kupima → tozo → ripoti → hesabu → pesa). Juu ya pesa kuna matawi mawili ndugu: cutover (V149) na marejesho (V148).
afya (V139) iko peke yake. Release = cutover + marejesho + afya ⇒ V139–V149 bila pengo.

| Tawi | Local | origin | Hali | Migration ya juu | Kazi |
|---|---|---|---|---|---|
| feature/t2-afya | 2a64f7e | 2a64f7e | sawa | V139 | H1 afya ya GL |
| feature/t2-gharama | 9c496b8 | 9c496b8 | sawa | V142 | kazi 1–3 (G1–G6, chini ya gharama) |
| feature/t2-kupima | d5b35f5 | d5b35f5 | sawa | V143 | KUPIMA |
| feature/t2-tozo | 55b1d26 | 5b4a07b | **mbele 4** | V144 | kazi 4, Q4-3 |
| feature/t2-ripoti | d92da83 | — | **haijapushwa** | V145 | exclude_from_ops_report |
| feature/t2-hesabu | dfbfc4d | — | **haijapushwa** | V146 | kazi 5 |
| feature/t2-pesa | 1d8abb3 | — | **haijapushwa** | V147 | 6c Jess 2310, 7 avg |
| feature/t2-marejesho | 7db84a3 | — | **haijapushwa** | V148 | C4 (swichi OFF) |
| feature/t2-cutover | d9498e1 | — | **haijapushwa** | V149 | (fc) reco/sefu → 102x/103x, (fe) ada |
| main | 9b6678a | 9b6678a | sawa | V138 | = prod 2.4.0 |

V3 (`lsmsFrontV3`):

| Tawi | Local | origin | Hali | Kazi |
|---|---|---|---|---|
| feature/t2-afya | e70d2ba | e70d2ba | sawa | H1 |
| feature/t2-gharama | 6c34ca7 | 6c34ca7 | sawa | kazi 1–3 |
| feature/t2-kupima | f0f8667 | 539ae39 | **mbele 1** | KUPIMA |
| feature/t2-tozo | af82b73 | 3d66773 | **mbele 3** | kazi 4 |
| feature/t2-ripoti | 80407f7 | — | **haijapushwa** | exclude_from_ops_report |
| feature/t2-hesabu | bddc178 | — | **haijapushwa** | kazi 5 |
| feature/t2-pesa | 959cad4 | — | **haijapushwa** | 6c |
| feature/t2-marejesho | cb4e895 | — | **haijapushwa** | C4 UI (4f45964) + e2e ya cutover (cb4e895) |
| feature/t2-cutover | 61a618e | — | **haijapushwa** | (fe) dirisha la uhamisho + e2e T7–T9 |
| main | 7e28c9b (+ commit ya leo) | 0758609 | **mbele 4+** | analysis |

Kupush ni kazi yako (`push-yote`). Sijapush kitu.

| Agizo | Kazi | Mahali | Commit |
|---|---|---|---|
| (fe) | uhamisho wenye ada, sababu, kinga ya kabla ya D | backend t2-cutover / V3 t2-cutover | d9498e1 / 61a618e |
| (fe) | jaribio Selcom → NMB 500k ada 2k | V3 deploy/local/e2e/cutover_api_e2e.cjs (10/0) | 61a618e |
| (fd)(fe)(ff) 3 | hatua 60 ufunguzi + D; 60-prod-bank-cutover imestaafu | steps/60-ufunguzi.*, toleo2/60-majaribio/ | (analysis, leo) |
| (fe)(ff) 2 | ulinganisho wa benki: makadirio siku 2 → BAADA | ripoti hii | — |
| (ff) 4 | makadirio: prod 02/12, D 07/12 | ripoti hii | — |

## Maswali kwa Chief (kufikia Jumatano 18/11)
- **Qff-1** Unakubali mpango: prod 02/12, D 07/12, na 6d (1010), §14, §16 na ulinganisho wa benki kwenda BAADA?
- **Qff-2** Tofauti ya ufunguzi siku ya D: unapendelea `acha` (uamuzi baadaye) au akaunti 3900 "Opening Balance Equity" moja kwa moja?
- **Qff-3** (§10) Benki/simu zinazotumika ni NMB, Selcom, M-Pesa, Tigo tu? Kama ndiyo, CRDB/NBC/PCB/Halopesa/Airtel → is_active=false baada ya prod, kabla ya D.
  (CRDB 1020 ina historia ya 24/08: uhamisho 264,664 = malipo 2. Salio 0, kwa hiyo hakuna kizuizi.)
- Bado yanasubiri: Q6e-1..3, Q6d-1..4 (ikiwa 6d itabaki toleo 2), Q7-1, Q9-1, Q8-1, M1 (a)/(b), V039, C6 B2, §15, F1.
