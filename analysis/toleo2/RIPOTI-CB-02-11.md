# RIPOTI (cb) + 65 — 02/11/2026

nimesoma hadi (cb). Herufi tangu ripoti iliyopita: (cb). **(ca) haipo kwenye MAAGIZO.md** — kama uliituma, sijaipokea.

## 1. Hatua 65 — sale zilizofutwa tangu 30/10 (prod, kusoma tu, log 13:07 ---OK---)

Zimefutwa **8**, siyo 6: zile 6 za orodha + 291026-2218 (43,500) na 301026-0722 (9,000), zote mbili zilifutwa 30/10 asubuhi.
Jumla 487,000. Zote ni mauzo ya macheda. Aliyefuta anaonekana "System" (kosa la 2.3.0, mtu halisi hajulikani).
Sababu zote ni takataka: yyyyy, hhhhhh, tttttt, fffff, tttttt, yyyyy, 666666, rrrrr. 2.4.0 ingezikataa zote.

| Sale | Jumla | Ilifutwa | Iliingizwa upya? |
|---|---:|---|---|
| 301026-0722 (Konyagi kt 1) | 9,000 | 30/10 07:22 | **Ndiyo**: 291026-0723, sekunde 47 baadaye, 9,000, bidhaa ileile, tarehe 29/10 (imehamishwa siku ya nyuma) |
| 311026-0831 (Serengeti Lemon kreti 1) | 33,000 | 31/10 08:32 | **Ndiyo**: 301026-0832, sekunde 24 baadaye, 33,000, tarehe 30/10 (imehamishwa siku ya nyuma) |
| 291026-2218 (bidhaa 7, vipande) | 43,500 | 30/10 07:59 | Haijulikani: hakuna sale moja inayolingana (bora ni 6/7 za bidhaa, jumla tofauti) |
| 301026-2245 (kreti 2) | 68,000 | 31/10 08:10 | Haijulikani |
| 301026-2251 (kreti 3) | 83,500 | 31/10 08:24 | Haijulikani |
| 301026-2253 (kreti 4) | 135,500 | 31/10 08:26 | Haijulikani |
| 311026-2139 (kreti 2) | 75,000 | 01/11 08:22 | Haijulikani |
| 011126-0720 (Afya + Castle Lite) | 39,500 | 01/11 07:57 | Haijulikani |

Mfano wa 31/10 asubuhi:
- Kreti 9 za 30/10 usiku (2245/2251/2253 = 287,000) zilifutwa 08:10–08:26.
- Asubuhi hiyo hiyo ziliundwa sale mpya zenye tarehe ya 30/10: 0750 (164,500), 0812 (170,000), 0824 (54,500), 0832 (33,000).
- Sale hizo zina sehemu ya bidhaa zilezile. Huenda zilihamishiwa humo, lakini ulinganisho wa sale kwa sale hauwezi kuthibitisha.

**Hesabu zilizofuata (jibu kuu):**
- Kila kreti iliyofutwa ilirudisha vipande 20–24 kwenye stock ya mfumo.
- Kama mzigo ungetoka bila kuingizwa upya, hesabu inayofuata ingeonyesha upungufu wa −20 au −24. **Hakuna.**
  - Upungufu mkubwa zaidi ni −4: Pepsi 31/10 (FORCE_CLOSED, haikuandikwa) na Afya 01/11.
  - Castle Lite (kreti 4 = 80) na Serengeti Lemon hesabu zote zilikuwa 0.
- Hitimisho: hakuna ushahidi kwamba mzigo wa sale zilizofutwa ulipotea. Ama uliingizwa upya, ama haukutoka.

**Tozo za 1120 kwenye bidhaa hizo baada ya kufuta** (zote macheda, OPEN), jumla 15,000:

| Tarehe ya hesabu | Bidhaa | Upungufu | Tozo |
|---|---|---:|---:|
| 30/10 | Konyagi | −1 | 5,000 |
| 30/10 | Safari kb | −1 | 2,500 |
| 01/11 | Safari Lager | −1 | 2,500 |
| 01/11 | Afya | −4 | 4,000 |
| 02/11 | Afya | −1 | 1,000 |

- Ukubwa wake hauendani na idadi iliyofutwa (vipande 20 kwa kreti). Kwa hiyo si tozo zilizosababishwa na kufuta.
- Afya pekee inawezekana: 01/11 07:57 kreti ya 6 ilifutwa, na hesabu ya siku hiyo ikaonyesha −4. Haithibitiki kwa data hii.

**Hesabu za 31/10 ni FORCE_CLOSED.** Upungufu wake una "tozo" iliyoonyeshwa, lakini haukuandikwa 1120 wala stock_adjustment.

**Ulinganisho kwa bidhaa (si sale kwa sale):** kama unataka uthibitisho kamili kwa kila bidhaa — "idadi iliyofutwa dhidi ya idadi
iliyoingizwa upya ndani ya saa 24, kwa tarehe ileile" — ni hatua moja ya kusoma tu. Sijaiandaa; niambie.

## 2. (cb) Kanuni ya sababu = maandishi MAPYA tu

Backend: feature/reason-new-only 0223651 → release/2.4.0 **7c469e8**.

- `ReasonQuality.isNewJunk(mpya, iliyohifadhiwa)`: inakataa tu ikiwa maandishi ni takataka **na** yanatofautiana na yaliyohifadhiwa.
- **Submit:** ukaguzi wa maelezo yaliyohifadhiwa umeondolewa. Kinachobaki ni "maelezo yanahitajika" kwa tofauti > 1,000.
- **Approve:** ukaguzi wa ubora umeondolewa.
- **Edit ya maelezo:** kutuma maandishi yaleyale ya zamani kunapita; maandishi mapya ya takataka yanakataliwa.
- **Unsubmit / reopen / kufuta sale:** maandishi ni mapya kila mara, kwa hiyo yanakaguliwa kama awali.
- **V3:** haihitaji badiliko. Kisanduku cha maelezo hakijazwi na maandishi ya zamani, na kitufe cha Idhinisha hakijawahi kukagua ubora.

Majaribio:
- Suite **560/0/1** (558 + 2 mapya).
- Docker-local (dump 29/10, image local-7c469e8), jaribio uliloomba kwenye reco 28/10:

| # | Jaribio | Matokeo |
|---|---|---|
| T1 | reopen "rrrrrrrrrr" | imekataliwa (bado APPROVED) |
| T2 | reopen ya kweli | REOPENED |
| T3 | maelezo yamewekwa "nnnn" kwa SQL (ya zamani), kisha submit | **imepita** |
| T4 | approve | **imepita**, "nnnn" haijaguswa |
| T5 | reopen "rrrrrrrrrr" tena | imekataliwa |

- Jumla **10/0**.
- Control kwenye image ya zamani 88a8708: **6/4** (T3/T4 zinashindwa). Hii inathibitisha kwamba jaribio linakamata kosa.
- Gate: PG_CHECKS_OK 3/3; V3 E2E_OK 6/6 (b1 27, b2 22, b3 38, b4 11, mabango 10, sababu 20).

Jambo la pembeni, si la (cb): approve ya pili baada ya reopen ilileta "gharama za mtaji ... zimebaki PENDING" kwenye nakala.
Hii ni tabia ya zamani: capex iliyokwisha idhinishwa inajaribiwa tena. Haijabadilishwa.

## 3. Hatua 64 — J2 peke yake baadaye

Imethibitishwa kwa jaribio halisi kwenye Docker-local:

| Mzunguko | Matokeo |
|---|---|
| KAGUA | 12/0 |
| ANDIKA bila J2 | 19/0/1 (kama prod) |
| KAGUA tena | J1 "TAYARI IPO - itarukwa" |
| ANDIKA + "J2 ndiyo" | **21/0**: J1 imerukwa, J2 imeandikwa mara moja, malipo 15,000 + 2,000 yamefutwa, 1120 GL = daftari |

Chief akiamua J2, mpangilio ni huu:
1. Endesha 64.
2. Andika **KAGUA**. Ni lazima, kwa sababu preview ya 09:30 imepitwa na wakati: 1120 inabadilika kila hesabu, na a1 itasimama.
3. Nitumie log.
4. Endesha 64 tena, andika **ANDIKA**, kisha **J2 ndiyo**.

Sharti: J2 ina tarehe 15/10, kwa hiyo **Oktoba lazima iwe wazi**. Ikifungwa, 64.k2 itakataa. Hii ni sababu ya tatu ya kutofunga Oktoba,
pamoja na reco 31/10 kuidhinishwa na 65 kukaguliwa.

## 4. Mengine ya (cb)

- **558 vs 559:** imefungwa. Suite sasa ni 560 kwa sababu ya majaribio 2 mapya ya (cb).
- **Oktoba:** sipendekezi kufunga.
  - 65 imekaguliwa (§1).
  - Bado: reco 31/10 iidhinishwe, na uamuzi wa J2 ufanyike au Chief aseme J2 haitaandikwa.
- **Docker-local sasa** (local-7c469e8, dump 29/10) ina mabadiliko ya majaribio:
  - reco 28/10 ina maelezo "nnnn" na imefunguliwa/kuidhinishwa mara 1 zaidi;
  - J1 na J2 za 64 zimeandikwa.
  - Nakala safi inahitajika kabla ya jaribio lijalo la data.

Inayofuata: onyo la manunuzi ("kreti au chupa?"), kisha B5.
