# MPANGO (ct-2) — 04/11/2026 — kazi zote kabla ya staging

nimesoma hadi (ct-2). Kumbuka: ujumbe huu ulikuja na herufi **(ct)** mara ya pili, kwa hiyo kwenye MAAGIZO.md nimeuita (ct-2).

Uamuzi: batch iliyobaki pamoja na BAADA-YA-BATCH yote vinamalizika kabla ya staging. Orodha IMEFUNGWA 04/11.
Kosa jipya → linaandikwa; linaingia tu likiandika pesa/stock/data isiyo sahihi kwenye prod.

Makadirio ni siku za kazi za code + majaribio (Docker-local, suite, PG, E2E), bila kusubiri majibu.

## 1. Jedwali

| # | Kipengele (BAADA §) | Siku | Kinategemea Chief? | Nini kinahitajika kutoka kwa Chief |
|---|---|---|---|---|
| K0 | Kosa jipya (RIPOTI-CT §3): ununuzi bila msambazaji unahifadhiwa UNPAID | 0.25 | Hapana | — |
| 0.1 | Punguzo linaloifanya sale kuwa chini ya gharama: CEO + sababu | 1.5 | Hapana | — (kanuni imeshatolewa) |
| 0.2 | Tozo ya mfanyakazi kwa GHARAMA (bila 4900) | 1.5 | Ndiyo, ndogo | Tozo za zamani (4900 = 57,486.54 mwaka 2026) zibaki kama zilivyo? Pendekezo: ndiyo |
| 2a | Kipimo kimoja cha thamani ya stock = avg (ripoti ya uendeshaji) | 1 | Hapana | — (taarifa: namba za stock-closing za siku za zamani kwenye ripoti zitabadilika) |
| 12 | Deni kwa mmiliki kwa Jess | 0.5 | Ndiyo | Namba na jina la akaunti. Pendekezo: 2310 "Deni kwa mmiliki - Jess" |
| 10 | Benki/simu zilizowashwa (kabla ya D) | 0.5 | Ndiyo | Orodha ya benki na mitandao inayotumika kweli |
| 11 | Wasambazaji wa mkopo (supplier kwa uid kwenye fomu + "Nunua tena"; deni linahitaji msambazaji) | 1.5 | Ndiyo | Orodha ya wasambazaji wanaokopesha (jina, simu, siku za mkopo) |
| 8 | Droo kwenye reco (C3 sehemu ya pili) | 2.5 | Ndiyo | Maswali 4 ya §8: reco ya nani; reco iliyoidhinishwa; siku bila reco; mistari ya mkono iliyopo |
| 1 | Akiba ya mkopo 1010 kupitia reco | 2 | Ndiyo | Maswali ya §1: siku bila reco; akiba iliyozidi/pungufu; uhusiano na D |
| 13 | Movements za reco → benki/simu/sefu (Toleo 2 §2.2) | 3.5 | Ndiyo | **Tarehe D** + salio la benki/simu siku hiyo (statement); inategemea 10 na 8 |
| 4 | Prepaid 1160 (malipo ya mwaka) | 2 | Hapana | — (inaanza malipo ya kwanza ya 2027) |
| 2 | Kanuni za hesabu ya stock (4 ndani yake) | 3.5 | Ndiyo | Orodha ya bidhaa za "kupima"; kuandika 46,000 (Dr 5100) sasa au kwenye hesabu ya wiki ya kwanza |
| 7 | C4 Sales returns + exchange (nyuma ya flag, OFF) | 3.5 | Hapana | — (flag OFF; Chief anaiwasha baadaye) |
| 9 | Hatua 74: "Umelipa sasa" ya zamani | 0.5 | Ndiyo | Ushahidi wa kiasi kilicholipwa (risiti/daftari) kwa ununuzi 2–6 kwa mwezi tangu Julai |
| 15 | Kusafisha payment_status ya purchases za zamani | 0.5 | Ndiyo | Kuthibitisha orodha (nitaitoa kutoka dump ya siku hiyo) |
| 3 | SKU 4 za Jagger (majina/saizi) | 0.5 | Ndiyo | Saizi halisi za SKU 4 |
| 14 | Maelezo ya supplier payment (PATCH notes) | 0.3 | Hapana | — |
| 16 | Historia ya audit ya kuidhinisha capex | 0.5 | Hapana | — |
| 6 | Mistari ya takataka kwenye properties | 0.1 | Hapana | — |
| 5 | Kuzima Flyway outOfOrder | 0.5 | Ndiyo | V039: ruhusa ya `flyway repair` (au njia nyingine) |
| C6 | backup_20260930_journal_entry: nakala B2, kisha DROP | 0.5 | Ndiyo | Chief anaendesha hatua ya nakala B2 kabla ya migration ya DROP |
| C7 | Code iliyokufa (njia 26 + SaleReturnService) | 1 | Hapana | — (sasa C4 imerudi, kwa hiyo SaleReturnService HAITAFUTWA kama C4 inaitumia) |
| C9 | deploy-v3.ps1 `ssh -n` | 0.1 | Hapana | — |
| S | Script ya staging (kifurushi kizima, dump ya prod ya karibuni) | 1.5 | Hapana | — |
| P | Script ya prod | 1 | Hapana | — |
| | **Jumla** | **≈ 31** | | Pamoja na akiba ya 15% ≈ 35 |

## 2. Mpangilio unaopendekezwa (pesa/GL kwanza)

| Awamu | Vipengele | Siku |
|---|---|---|
| A. Pesa/GL bila majibu | K0 → 0.1 → 0.2 (kwa pendekezo "za zamani zibaki") → 2a → 4 → 14 → 16 | 7.1 |
| B. Pesa/GL zinazohitaji majibu | 12 → 10 → 11 → 8 → 1 → 13 | 11 |
| C. Stock | 2 → 3 | 4 |
| D. Mauzo | 7 (C4) | 3.5 |
| E. Hatua za data | 9 → 15 | 1 |
| F. Usafi + Flyway | 6 → C7 → C9 → C6 → 5 | 2.2 |
| G. Scripts | S → P | 2.5 |

Wakati Awamu A inaendelea (siku ~7), majibu ya Awamu B/C/E/F yanaweza kufika. Kipengele kisichokuwa na jibu kikifika zamu yake,
ninakiruka na kuendelea na kinachofuata, kisha ninakirudia.

## 3. Tarehe mpya

- **Code yote imekamilika local: 12/12/2026** (siku ~35 kuanzia 05/11, pamoja na akiba).
- Staging: 14–15/12. Prod: kabla ya 19/12, ili prepaid 1160 iwe tayari kabla ya malipo ya 2027 na Desemba ifungwe kwenye toleo jipya.
- Tarehe ya zamani (16/11) haitumiki tena.

## 4. Maswali kwa Chief (mara moja, kwa namba)
1. (0.2) Tozo za zamani zibaki kama zilivyo? (pendekezo: ndiyo)
2. (12) Akaunti ya Jess: 2310 "Deni kwa mmiliki - Jess"?
3. (10) Benki na mitandao inayotumika kweli.
4. (11) Orodha ya wasambazaji wanaokopesha.
5. (8) Majibu 4 ya §8.
6. (1) Majibu ya §1.
7. (13) Tarehe D + salio la statements siku hiyo.
8. (2) Bidhaa za kupima; 46,000 iandikwe lini.
9. (9) Ushahidi wa "Umelipa sasa" ya zamani.
10. (3) Saizi za SKU 4 za Jagger.
11. (5) Ruhusa ya `flyway repair` kwa V039.
12. (C6) Nakala ya B2 itaendeshwa na Chief (hatua nitaandaa).

## 5. Makosa mapya ya 04/11 (orodha imefungwa: yanaingia kwa sababu yanaandika pesa/stock/data isiyo sahihi)

| # | Kosa | (1)? | Hali |
|---|---|---|---|
| K0 | Ununuzi bila msambazaji unahifadhiwa UNPAID / amount_paid 0, lakini GL inauandika umelipwa wote. Okt: 298 / 36,379,452. CashFlowService "purchasesPaid" = SUM(amount_paid) (API, haina skrini ya V3) | Ndiyo | Imejengwa: feature/k0-purchase-paid 3d220b8 |
| K1 | Kufuta (cancel) ununuzi ulioAPPROVED: stock na WAC zinarudishwa, lakini journal Dr 1200 / Cr chanzo inabaki POSTED. Kwa hiyo GL 1200 inazidi na 1000 inapungua. last_purchase_cost inabaki ya ununuzi uliofutwa. V3 inaruhusu ("Futa manunuzi" kwa yaliyoidhinishwa). Nakala ya 29/10: 0 (haijawahi kutokea) | Ndiyo | Imejengwa: b1643a7 |
| K2 | Cancel hiyo hiyo inahesabu upya current_average_cost kwa wastani wa miezi 6 wa ununuzi RECEIVED, badala ya kugeuza moving average ya approval. Avg mpya ≠ avg ya kabla ya approval, kwa hiyo COGS na daraja la 1200 (Σ stock×avg) vinahama | Ndiyo | Inafuata |

Majaribio ya K0+K1 kwenye Docker-local (nakala safi ya dump 29/10 10:27, image local-b1643a7): K0_API 9/0. Control kwenye c558a3c: 6 zimeshindwa
(B1/C2 UNPAID; D2 1000 −2000 / 1200 +2000 baada ya cancel; D3 gharama 1000 ya ununuzi uliofutwa). E2E_OK 11/11 mwendesho wa kwanza.

## (dn) 09/11 — nyongeza ya toleo 2 (kosa la pesa: gharama za mwezi) + footer
Uamuzi: 2a kwa DATA bila deploy (benki zisizotumika -> is_active=false kwa hatua; prepaid 2027 -> journal za mkono). Viporo vyote kwanza, kisha deploy MOJA ya toleo 2.
Kipaumbele cha kwanza: hatua 79 (prod, kusoma tu) -> pendekezo la marekebisho (KAGUA -> ANDIKA, kanuni za vipindi vilivyofungwa).
Code (chanzo kimeonekana 09/11):
- **G1 Scheduler mbele:** `CapitalExpenditureService.SCHEDULER_HORIZON_MONTHS = 12` -> `materializeMonthlyBudgets()` inaunda watoto hadi now+12 (11/2027);
  `createRecurringMonthlyBudget` inaunda hadi 12/<mwaka wa kuanzia> hata ukianza miezi ya nyuma (backfill). Lengo: mwezi wa sasa tu (au ujao siku ya 1),
  hakuna backfill kwenye kipindi kilichofungwa bila uamuzi wa CEO. (Journal za mwezi ujao hazijaandikwa mpaka tarehe ifike - postDueApprovedCapex -
  lakini tarehe ikiangukia kipindi kilichofungwa, `PostingEngine.firstOpenDate` inahamisha kitabu siku ya kwanza iliyo wazi.)
- **G2 Stop:** `stopRecurringMonthlyBudget` inafuta miezi > mwezi huu tu; iulize "na ya mwezi huu ambayo bado haijalipwa?" -> reversal kwa uthibitisho.
- **G3 Kinga ya nakala:** budget/gharama mpya yenye jina au kiasi kinachofanana na iliyopo (mwezi uleule, daily+monthly+annual) -> onyo.
- **G4 Capital (V3):** gharama za mwaka zionekane pamoja na za mwezi; orodha ionekane bila kuandika tena (bug ya skrini).
- **F1 Footer:** "© 2026 Elikom Group Company Limited" -> jina la biashara lililosajiliwa (Chief atalitaja), kwa config (si hard-coded).
- (dm) **G1 nyongeza:** budget mpya yenye mwezi ndani ya kipindi KILICHOFUNGWA -> **KATAA** (si firstOpenDate), isipokuwa uamuzi wa CEO.
- (dm) **G4 nyongeza:** gharama ya mwezi ujao isionyeshwe "Approved · in the books" -> "Imepangwa" mpaka journal iandikwe.
- (dp) **G5 Gharama za mwaka (Flutter -> V3):** UI/mtiririko kama Flutter; GL MPYA: Dr 1160 prepaid / Cr chanzo (C3), kisha 1/12 kila mwezi 1160 -> gharama.
  Ripoti kwa Chief: Flutter iliandika nini (mf. Frame 2.4M 01/01) dhidi ya muundo mpya. Kabla ya C7: orodha ya kila kitu Flutter inacho ambacho V3 haina.
- (dr) **2400 Accrued Expenses / Gharama Zinazodaiwa:** imeongezwa kwa data (hatua 80b); toleo 2: migration `INSERT ... ON CONFLICT (account_code) DO NOTHING` ili DB mpya zilingane.
- (80, 09/11) **Kosa dogo:** journal ya mkono yenye maelezo (memo) > herufi 100 inaanguka kwa kosa la SQL (memo -> journal_entry.reference_number varchar(100)).
  Toleo 2: kataa kwa ujumbe wazi au hifadhi memo kwenye description. Haiandiki data mbaya -> si (1)/(2).
- (80, 09/11) **Daily-profit vs GL:** row ya Flutter "KODI YA FRAME (Mwaka mzima)" `allocated_month=0` 200,000 inakatwa KILA mwezi kwenye daily-profit, na
  REN-MON Nov 200,000 pia -> Novemba daily-profit inahesabu Frame mara 2. GL inarekebishwa na 80b; daily-profit inarekebishwa na G5 (gharama za mwaka mpya).
- (dt) **G6 "Lipa deni la gharama / kodi":** V3 leo ina njia ya JUMLA tu: GL -> "Journal ya mkono" (ManualJournalDialog, FINANCE_WRITE, akaunti zote) ->
  Dr 2400 (au 2200) / Cr 1000 inafanya kazi LEO. Haina: kikomo cha salio la deni, chanzo cha C3 (droo/benki/simu + kanuni ya cutover), wala skrini ya madeni.
  Toleo 2: dialog "Lipa deni" (Capital au GL -> Madeni): chagua deni (2200 / 2300 / 2400 + salio), kiasi <= salio, chanzo (C3 picker), tarehe, maelezo
  -> backend POST /api/v1/gl/liability-payments: Dr deni / Cr chanzo (cutover rule), inakataa kiasi > salio, kipindi kilichofungwa; reco haiguswi (kama C3).
  Malipo ya 01/01/27 (2400 600,000) na 2200 (65,000) yafanyike kwa njia hii; ikichelewa, kwa "Journal ya mkono" Dr 2400 / Cr 1000.
- **G1 IMEKAMILIKA (backend feature/t2-gharama 1ef3b08, 09/11):** rows hadi mwezi wa SASA tu; kipindi kilichofungwa -> kataa. Suite 605/0/1; mutations 2/2.
  Data: watoto 12 wa "malipo ya wafanyakazi" 12/2026..11/2027 bado wapo prod (APPROVED bila journal) - hawana madhara kwenye GL (postDue inawaandika
  mwezi wao ukifika, ambao ndio ukweli); G4 itawaonyesha "Imepangwa". Kuwafuta ni uamuzi wa Chief (hatua ndogo kama 80a).
- (du) **H1 Kizingiti cha Health (inventory 1200 vs daftari):** leo TOLERANCE = 1.00 (GlReconciliationService) -> tofauti ndogo ya rounding inaonyesha
  "Vitabu vinahitaji kurekebishwa" (capital-overview). Pendekezo: |tofauti| < max(5,000, 0.1% ya thamani ya stock) = TAARIFA (rangi ya kawaida, "tofauti ndogo")
  bila onyo jekundu wala kitufe cha "Correct"; >= hapo = onyo kama leo. Uamuzi wa kiasi: Chief. Chanzo cha 1,417 kitatoka hatua 78-7 (kesho).
- (dv) **H1 IMEAMULIWA NA IMEJENGWA** (backend feature/t2-afya 2a64f7e, V3 main):
  - Ngazi: SAWA (|tofauti| <= 1.00) / TAARIFA (INVENTORY chini ya max(5,000, 0.1% ya thamani ya stock)) / ONYO (juu yake; au imeongezeka siku 3 mfululizo,
    hata ikiwa chini ya kizingiti). Akaunti nyingine (madeni ya wateja/wasambazaji/wafanyakazi, mikopo) hazina kizingiti: zaidi ya 1.00 = ONYO kama leo.
  - Mwelekeo wa siku 7: jedwali jipya gl_control_snapshot (V139) - row 1 kwa siku kwa kila ukaguzi; inaandikwa 23:55 (scheduler) na kila mtu anapofungua ukurasa leo.
    Tarehe ya zamani haiandikwi kamwe. Siku iliyokosekana inakata mfululizo. Mwelekeo unaanza kujaa kuanzia siku ya deploy (hakuna historia ya nyuma).
  - "Correct" (true-up): backend inakataa asiye CEO (root au role CEO; Executive CEO si CEO). V3 inaonyesha kitufe kwa CEO tu, na maelezo "inapendekezwa mwisho wa mwezi".
  - V3: banner ya Capital "Vitabu vinahitaji kurekebishwa" inatoka kwa ONYO tu; ripoti (fedha, stock, madeni) zinaonyesha TAARIFA kama "info", si nyekundu.
    Backend ya zamani (bila "level") -> V3 inarudi kwenye kanuni ya zamani (reconciled), kwa hiyo V3 inaweza kutangulia backend.
  - Migration: V139 = H1. G5 (1160/2400) itachukua V140+.
- (dw) **M1 MaterializedViewScheduler haifanyi kazi - SIYO regression ya 2.4.0 (imethibitishwa 10/11):**
  - Chanzo: commit c4a3659 (09/06/2026) iliondoa `@Transactional` kwenye `refreshSalesViews()` kwa dhana kwamba `REFRESH ... CONCURRENTLY` haiwezi
    ndani ya transaction (dhana si sahihi). Njia 4 za `@Modifying` kwenye MaterializedViewRepository hazina transaction -> Hibernate:
    `TransactionRequiredException: Executing an update/delete query` kila 23/01/03/05. Ipo kwenye v2.2.72, v2.3.0, v2.4.0 (faili hazijaguswa 2.3.0->2.4.0; C2 haikuzigusa).
  - Jaribio la PG (MvRefreshPgCheck, Spring halisi + PG15 ya kutupa, sale mpya -> refresh -> view): code ya v2.3.0 = kosa lilelile, daily=0 monthly=0;
    ukiweka `@Transactional` kwenye njia 4 za refresh = INFO "refreshed successfully", daily=1 monthly=1 (CONCURRENTLY inafanya kazi ndani ya transaction).
  - Athari: HAKUNA ripoti/dashboard inayosoma mv_* - `SalesRepository.getOptimized*` na `MaterializedViewRepository.find*` hazina mtumiaji (ni C2 PG test tu).
    Kwa hiyo hakuna data ya zamani inayoonyeshwa kwa mtu; gharama ni ERROR 4 kwa usiku na refresh isiyo na maana.
  - Toleo 2, uamuzi wa Chief: (a) kurekebisha (`@Transactional` x4 + MvRefreshPgCheck) au (b) kuondoa scheduler + refresh ya SaleService + repository
    (C7, code iliyokufa); DROP ya view 4 ni hatua tofauti (kama C6). Hatua 81 (prod, kusoma tu) inaonyesha data ya view iko hadi lini.
- (dw) **L1 "SELLING BELOW RECOMMENDED PRICE"** (SaleService) ni ERROR kwenye log -> iwe WARN + audit (tukio la biashara, si kosa la mfumo);
  pamoja na 0.1 (kanuni ya punguzo: CEO + sababu).
