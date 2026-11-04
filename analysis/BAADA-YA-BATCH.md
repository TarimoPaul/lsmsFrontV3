# Orodha ya BAADA ya batch (2.4.0 / 3.2.0)

Vitu vilivyoamuliwa na mmiliki kufanyika baada ya batch ya 16/11/2026. Havimo kwenye kifurushi. Kila kimoja kinaanza kwa muundo
na majibu ya mmiliki kabla ya code.

## 0. KIPAUMBELE CHA JUU

### 0.1 Punguzo linaloifanya sale kuwa chini ya gharama (mmiliki 02/11 bs)
- Sababu: sale zote 3 za 2026 zenye punguzo ziliuzwa chini ya gharama (hasara −103,841.22; 101026-2209 punguzo 100,000 kwa
  114,500). Sale 2 zilizofutwa zilikuwa na punguzo la 280,000 na 135,000. Ripoti: analysis/toleo2/RIPOTI-BS-02-11.md.
- Kanuni (backend, siyo V3 tu): ikiwa total ya sale baada ya punguzo < gharama ya mistari yake (cost_per_piece × idadi,
  bei ileile inayotumika kwa COGS) → sale inakataliwa isipokuwa mtumiaji ana ruhusa ya CEO (ruhusa mpya, kama
  SALE_DELETE_REVIEW) NA ametoa sababu (lazima, ≥ 10 herufi).
- Inahusu kila njia: sale mpya, edit ya sale, na punguzo linaloongezwa baadaye. Inarekodiwa (nani, sababu, gharama, total)
  kama audit ya A6, na CEO anapata notification.
- V3: POS ionyeshe "chini ya gharama kwa X" kabla ya kuhifadhi; mtumiaji asiye na ruhusa haoni kitufe cha kuendelea.
- Majaribio: punguzo ndani ya margin → inaruhusiwa; chini ya gharama bila ruhusa → 403; CEO bila sababu → 400;
  CEO + sababu → inaruhusiwa na kurekodiwa; mutation.

### 0.2 Tozo ya mfanyakazi kwa GHARAMA (mmiliki 02/11 bt)
- Leo (V130, tangu Oktoba): tozo ya hesabu = Dr 1120 bei ya kuuza / Cr 1200 gharama / Cr 4900 tofauti. 2026: 4900 yote
  (57,486.54) ni ya tozo hizi. Ripoti: analysis/toleo2/RIPOTI-BT-02-11.md.
- Kanuni mpya: tozo = Dr 1120 / Cr 1200 kwa GHARAMA tu, bila 4900. Tofauti ya bei ya kuuza inaandikwa tu inapolipwa
  (Dr 1000 / Cr 4900 juu ya sehemu ya gharama) au kwa makubaliano ya maandishi yaliyohifadhiwa (nani, lini, kiasi).
- Inagusa CountingCharge / postStaffCharge, ripoti ya madai (deni kwa gharama + "tofauti inayodaiwa" kando) na malipo
  (mgawanyo gharama → 1120 kwanza, kisha 4900).
- Majaribio: tozo → 1120 = gharama; malipo kamili → 4900 = tofauti; msamaha → 5100 kwa gharama tu; mutation.

## 1. Akiba ya mkopo kama akaunti halisi 1010 (mmiliki 01/11 bj)

> "Akiba ya mkopo: akaunti 1010, Dr 1010/Cr 1000 kila siku kupitia reco, repayment kutoka 1010".

- Leo (2.3.0): "akiba ya mkopo" ni memo ya ripoti tu (principal ÷ siku za mkopo, mf. A 10,869.57 na B 19,047.62 kwa siku);
  hakuna journal, na pesa ya akiba iko ndani ya 1000 (bahasha ya mkononi).
- Lengo: akiba ya kila siku iwe journal Dr 1010 / Cr 1000 inayoandikwa kupitia reco ya siku, na malipo ya mkopo yatoke 1010
  (Dr 2100 / Cr 1010), ili 1000 ionyeshe pesa ya droo tu.
- Kabla ya code: muundo (reco inaandikaje akiba; siku ambayo reco haikufanyika; akiba iliyozidi/pungufu; uhusiano na tarehe ya
  kukata D ya benki na hatua 60, ambayo sasa inauliza bahasha ya akiba kwenye cash count ya ufunguzi).

## 2. Hesabu ya stock (mmiliki 01/11 bn)

Chanzo: analysis/toleo2/UCHUNGUZI-BM-STOCK-01-11.md (NO_ACTION haihifadhiwi, stock haibadiliki, tofauti ileile inarudi kila siku).

- **Tofauti inayojirudia hesabu 2 mfululizo haiwezi kuwa NO_ACTION tena**: bidhaa ileile yenye tofauti ileile siku ya pili
  inalazimika kuwa ADJUST / CHARGE_TO_CASHIER au recount. Inahitaji kuhifadhi uamuzi wa kila mstari (leo NO_ACTION haiachi alama).
- **Ziada > 50,000 kwa bidhaa: recount na mtu wa pili kabla ya approve.** Mfano: JAGGER MASTER 13/10 (+265,000, hakuna recount).
- **Bidhaa za "kupima" (mmiliki 02/11, baada ya bt): HAKUNA tozo kwa mtu** (uamuzi wa Chief, mpaka kuwe na vipimo halisi).
  Badala yake: hesabu ya WIKI kwa chupa nzima; tofauti inaandikwa Dr 5100 / Cr 1200 kwa GHARAMA, bila 1120 (si NO_ACTION,
  si CHARGE_TO_CASHIER). Mfumo ukatae CHARGE_TO_CASHIER kwa bidhaa ya kupima, na hesabu ya kila siku isiilete kama mstari.
  Hali ya 29/10 (nakala, kusoma tu): Moon Light −9 (18,000), Konyagi −10 (10,000), Golden King −9 (9,000), Gilbeys −9 (9,000),
  Camino 0, Wine 0 → **46,000 kwa gharama, haijaandikwa** (kila hesabu ilipata 0; hakuna stock_adjustment hata moja ya kupima).
- **Manunuzi ya siku kabla ya hesabu (mmiliki 02/11 by):** manunuzi ya siku yaandikwe KABLA ya hesabu, au mzigo usioandikwa
  utengwe nje ya hesabu. Hesabu iwe na swali la lazima "Kuna mzigo uliofika leo ambao haujaandikwa?". Ikiwa NDIYO, hesabu
  isubiri manunuzi yaandikwe, au bidhaa hizo ziwekwe alama "mzigo haujaandikwa" na zisitoe tofauti. Chanzo: Pepsi 14/07 na
  10/10, ambapo hesabu ilifanyika kabla manunuzi hayajaandikwa (MAREKEBISHO-BU-PEPSI-02-11.md). Tozo hizo zilikuwa halisi
  kwa mfumo, kwa hiyo hakuna hatua 65 (Chief, by).

## 2a. Kipimo kimoja cha thamani ya stock = avg (mmiliki 02/11 by; uchunguzi bz)
- Leo kuna vipimo vinne (RIPOTI-BZ-02-11.md §1): GL/COGS = `current_average_cost`; ripoti ya uendeshaji
  (`DailyPnlService.stockValueAt`) = bei ya manunuzi ya MWISHO, na idadi kwa movement_date; ukurasa wa Store wa V3
  (`/display/stock/summary`) = wastani wa miezi 6 wa bei ya PURCHASE, na 0 kwa bidhaa isiyonunuliwa miezi 6.
- Badiliko: ripoti ya uendeshaji na ukurasa wa Store zitumie `products.current_average_cost` × `current_stock`
  (ripoti: stock ya siku × avg). Store isitoe 0 kwa bidhaa iliyopo. Jaribio: Σ ukurasa wa Store = Σ daftari = stock-closing
  ya ripoti ya leo, na daraja la GL halina mstari wa "tofauti ya bei".

## 3. Manunuzi na SKU za Jagger (uchunguzi (bn) f; IMEREKEBISHWA na mmiliki 02/11 bw)

- **Uamuzi wa Chief (bw):** JAGGER MASTER 886dc1ed ni CHUPA moja = 53,000 (TAKAWEDO), bei ya kuuza 60,000, dukani ipo 1.
  Kosa ni hesabu ya 13/10 (6 badala ya 1), si gharama. Hatua 63 v3 inarekebisha (stock 6 → 1, journal 31/10 Dr 5100 /
  Cr 1200 265,000). Maelezo ya zamani hapa ("kifurushi cha 6, 8,833.33 kwa chupa sahihi") YAMEFUTWA.
- **Matokeo ya uamuzi huo kwa historia (kusoma tu, hayajarekebishwa):** manunuzi ya 07/09 na 22/09 yaliingizwa kama kifurushi
  1 = chupa 6 kwa 8,833.33. Ikiwa kila moja lilikuwa chupa 1 ya 53,000, mfumo ulipata +5 za uongo kila mara. Hesabu za
  13/09 (−4, 35,333.32) na 03/10 (−5, 44,166.65) ziliandika upotevu (5100) wa chupa ambazo hazikuwahi kuwepo, na mauzo
  ya 30/09 yalipata COGS 8,833.33 badala ya 53,000. Jumla ya faida haibadiliki (53,000 kwa chupa iliingia gharama kwa njia
  zote mbili), ila mgawanyo COGS / upotevu si sahihi. Bidhaa bado ina pieces_per_package 6 na bei ya kifurushi 336,000.
- **SKU 4 za Jagger (mmiliki bw):** 886dc1ed JAGGER MASTER (53,000), 4d727520 JAGER MASTER (42,000), 4453f20a JAGER MASTER
  (29,000), 6dc452f6 JAGGER MASTER (20,000). Majina yaonyeshe saizi (mf. "JAGERMEISTER 1L / 700ML / 350ML / 200ML");
  zile zenye saizi moja ziunganishwe, nyingine zibadilishwe majina. pieces_per_package ya 886dc1ed irekebishwe ikiwa
  haiuzwi kwa kifurushi. Orodha ya saizi halisi kutoka kwa Chief kwanza.
- Kinga inayopendekezwa (onyo la manunuzi, B): bidhaa yenye pieces_per_package > 1 inaponunuliwa kwa gharama kwa kipande
  > 3× au < ⅓ ya ya mwisho → onyo "carton au chupa?" mpaka ithibitishwe.

## 4. Malipo ya mwaka kama prepaid 1160 (mmiliki 01/11 br) - KIPAUMBELE: kabla ya 31/12/2026
- Malipo yanayolipwa kwa mwaka mzima (pango, TRA, n.k.): Dr 1160 (prepaid) / Cr akaunti ya pesa siku ya malipo,
  kisha kila mwezi Dr akaunti ya gharama / Cr 1160 = sehemu ya mwezi (amortization).
- Scheduler ya kila mwezi kama ile ya riba (1150 → 6600): kipindi, kiasi kwa mwezi, siku ya kuanza, salio la 1160 kwa kila
  malipo; isiandike mara mbili (kinga ya replay) na isiandike kwenye kipindi kilichofungwa.
- 2026 ISIGUSWE: malipo ya 2026 yanabaki kama yalivyoandikwa. Inaanza na malipo ya kwanza ya 2027.
- Ripoti ya uendeshaji: "gharama za mwezi" isome amortization hiyo, ili daraja na GL lisipate tofauti ya timing.

## 5. Kuzima Flyway outOfOrder (mmiliki 02/11 ch) - IMEHAMISHWA KUTOKA C1
- 2.4.0 inaenda prod na mipangilio ya Flyway ILEILE ya prod ya sasa (out-of-order=true, validate-on-migrate=false,
  ignore-missing-migrations=true, baseline 38). C1 haibadilishi thamani yoyote.
- **Kipimo = flyway_schema_history ya DUMP YA PROD 29/10** (`backups\lsms_20261029_1027.dump`, sha256 01cae67bbcb91262…;
  0200 inatoa matokeo yaleyale), SI nakala mpya ya Docker-local. Zana: `analysis\zana\flyway-historia.py`
  (inasoma `pg_restore -a -t flyway_schema_history -f -` ya dump, inahesabu checksum kwa njia ya Flyway: CRC32 ya kila
  mstari; 100/101 zinalingana, kwa hiyo hesabu ni sahihi). Matokeo ya 03/11 dhidi ya release/2.4.0:
  - safu 102, zilizoshindwa 0, version ya juu 134 (dump ni ya kabla ya 2.3.0; V135 iliingia kwa mpangilio baadaye).
  - nje ya mpangilio: 5 (V038.1–V038.5, 15/06 16:24, baada ya V039). Za kihistoria; hazizuii kuzima.
  - zilizotumika bila faili kwenye code: 0. Chini ya baseline (V001–V038): 36, Flyway inazipuuza.
  - zinazosubiri: V135–V138, zote > 134 → sawa hata na out-of-order=false.
  - **KIZUIZI: V039.** Prod ina V039 = "Create Repurchase Invoices Tables" (24/05, checksum 484951461). Faili hilo baadaye
    lilipewa namba V056 (checksum ileile; V056 iliendeshwa tena 15/06). V039 ya code ni "Add Shrinkage Financial Fields To
    Store" (checksum −1700819509). Kwa validate-on-migrate=true backend ISINGEWAKA (description + checksum mismatch).
    Safu 2 + index 3 za V039 ya code ZIPO tayari kwenye schema ya prod (dump 29/10), kwa hiyo hakuna DDL inayokosekana.
- Masharti ya kuzima: (a) mmiliki aamue V039: `flyway repair` (inaandika description/checksum ya code kwenye safu ya V039)
  au njia nyingine — hakuna repair bila uamuzi wake (MATAWI); (b) kipimo kirudiwe kwenye dump mpya ya siku hiyo:
  mismatch 0 na "zinazosubiri chini ya max" 0; (c) staging: env `SPRING_FLYWAY_VALIDATE_ON_MIGRATE=true` +
  `SPRING_FLYWAY_OUT_OF_ORDER=false` → inawaka bila FlywayValidateException; (d) toleo linalofuata: thamani hizo kwenye faili.
- Hatua za kina za awali: MATAWI.md "Mpango wa kuzima out-of-order".

## 6. Mistari ya takataka kwenye properties (C1/ch)
- `git211` (application.properties) na `git spring.jpa.show-sql=false` (application-pro.properties; java Properties
  inaisoma kama key "git") zimeachwa kama zilivyo kwenye jar ya prod 2.3.0, ili C1 iwe 0. Hakuna code inayosoma "git".
  Kuziondoa = toleo linalofuata (show-sql inabaki false kutoka application.properties).

## 7. C4 Sales returns + exchange (mmiliki 03/11 ci) - IMETOKA kwenye kifurushi 2.4.0/3.2.0
- Backend `feature/sales-returns` 9425223 (juu ya 2.2.71, migration ya muda V135) na V3 `feature/sales-returns` e199712 (juu ya 3.1.11).
- Kazi iliyokadiriwa (cg §3): siku 3–4 — kuhamisha juu ya release (faili 6 zinagongana: SaleService, ReconciliationService,
  PostingEngine, SalesController, SalesDto, SaleServiceDeletionTest), namba mpya ya migration (baada ya V138, wakati wa merge),
  feature flag backend + V3 (default OFF), majaribio upya (54 backend + 23 UI e2e kwenye Docker-local + PG check).
- Inagusa GL na reco → njia: Docker-local → Contabo staging → prod (MATAWI kanuni ba).
- C7 (SaleReturnService iliyokufa) inabaki kwenye kifurushi; isiondoe chochote ambacho C4 itahitaji.

## 8. C3 sehemu ya pili: droo kwenye reco (mmiliki 03/11 cs)

> "BAADA-YA-BATCH: mstari wa auto wa droo kwenye reco + kuondoa uandishi wa mkono wa manunuzi (bila kuhesabu mara mbili). 1010: BAADA."

- Leo (2.4.0, C3 toleo dogo): chanzo DROO kinahifadhiwa kwenye `supplier_payments` / `purchases` na GL inaandika Cr 1000,
  lakini **reco haiguswi**. Macheda anaendelea kuandika manunuzi ya droo kwa mkono kwenye tab ya "Ununuzi" ya reco.
- Lengo:
  - malipo / manunuzi yenye chanzo DROO yaingie kwenye reco ya siku hiyo kama mstari wa auto unaopunguza pesa inayotarajiwa;
  - uandishi wa mkono wa manunuzi uondolewe;
  - hakuna kinachohesabiwa mara mbili.
- Kabla ya code (muundo): reco ya mtumiaji gani (aliyerekodi, au aliyeidhinisha); DROO kwenye reco iliyoidhinishwa
  (kataa kama kanuni ya kufuta sale); siku ambayo reco haijaundwa bado (iingie reco inapoundwa); mistari ya mkono iliyopo
  (60 = 6,693,500 kwenye dump 29/10, 0 zimeunganishwa na purchase) haibadilishwi.
- Bahasha ya akiba 1010 kama chanzo cha 5: inasubiri §1.

## 9. Hatua 74: "Umelipa sasa" ya zamani (mmiliki 04/11 ct)
- Chanzo: RIPOTI-CS, jambo 1. `createPurchaseEntity` ilikuwa inapoteza `amountPaid`. Tangu Julai, ununuzi wenye msambazaji
  ulibaki na AP kamili hata pale "Umelipa sasa" ilipojazwa. Kwa mwezi ni 2–6 tu.
- 2.4.0 inarekebisha ununuzi MPYA tu. Rekodi za zamani hazibadilishwi (cs).
- Hatua 74 (prod, baada ya batch): kwanza KAGUA ununuzi huo kwa kusoma tu (kiasi kilicholipwa hakijahifadhiwa, kwa hiyo kinahitaji
  ushahidi wa nje, kama risiti au daftari la Macheda). Kisha marekebisho kwa journal, kama mmiliki ataamua.

## 10. Orodha ya benki/simu zilizowashwa (mmiliki 04/11 ct) - kabla ya cutover D
- Leo picker ya C3 inaonyesha akaunti zote za benki na simu (CRDB 1020, NMB 1021, NBC 1022, Selcom 1023, PCB 1024, M-Pesa 1030, Tigo 1031,
  Halopesa 1032, Airtel 1033).
- Lengo: mmiliki awashe zile tu ambazo duka linatumia kweli. Ifanyike KABLA ya kuweka `gl_config.bank_cutover_date`, kwa sababu baada ya D
  Cr inakwenda kwenye akaunti hiyo hasa.

## 11. Wasambazaji wa mkopo (mmiliki 04/11 ct)
- ~300 ununuzi kwa mwezi hauna msambazaji aliyesajiliwa, kwa hiyo GL inahesabu umelipwa wote sasa (RIPOTI-CS, jambo 2).
  Agizo la "Nunua tena" linatuma jina la msambazaji tu, bila uid.
- Lengo: msambazaji anayekopesha (AP halisi) asajiliwe na achaguliwe kwa uid kwenye fomu na kwenye "Nunua tena".

## 12. Deni kwa mmiliki kwa Jess (mmiliki 04/11 ct)
- 2.4.0 ina akaunti moja tu, 2300 "Deni kwa mmiliki - Paul", kwa chanzo MMILIKI.
- Lengo: akaunti ya deni la mmiliki kwa Jess pia (kundi 2xxx), na chaguo la mmiliki gani kwenye fomu.

## 13. Movements za reco kwenda benki/simu/sefu (C5, Toleo 2 §2.2; freeze ct 04/11)
- Hazijajengwa. Leo BANK_DEPOSIT, simu na SAFE_BOX za reco hazihamishi GL 1000 kwenda 102x/103x/1040. Kwa hiyo 1000 inazidi na benki zinapungua,
  kama ilivyojulikana tangu 15/10. Reco haisomi GL, kwa hiyo hakuna skrini ya reco inayokosea.
- Inategemea cutover D, §10 (benki zilizowashwa) na §8 (droo kwenye reco). Kadirio: siku 3–4 (tukio jipya, reverse kwenye reopen,
  kukataa approval bila jina la benki, V3, staging).
- Si (1) wala (2) kwa batch hii, kwa sababu ni hali ya zamani isiyoweza kurekebishwa kabla ya D.

## 14. Maelezo ya supplier payment (C5, M-9 / jaribio 2.ae; freeze ct)
- Endpoint ya PATCH notes tu (bila journal, ikiwa na audit) na Edit kwenye V3. Kadirio: saa 2–3. Ni maelezo tu, si pesa → si (1)/(2).

## 15. Kusafisha payment_status ya purchases za ZAMANI (C5, jaribio 2.af; freeze ct)
- Kwenye nakala ya 29/10: Okt 298 bila msambazaji = UNPAID (36,379,452), ingawa GL iliziandika zimelipwa (Cr 1000). Agosti–Septemba
  zina PAID nyingi, na 11 UNPAID (Sep, 1,515,000).
- Hakuna skrini inayosoma safu hii kwa ununuzi bila msambazaji (AP inachuja `supplier_uid IS NOT NULL`), kwa hiyo ni hatua ya data,
  dryRun kwanza, baada ya mmiliki kuthibitisha orodha.
- Zenye msambazaji UNPAID (Ago 6 / 208,600, Sep 3 / 136,200, Okt 2 / 66,000) zinaonekana kama deni kwenye AP; zinaendana na §9 (hatua 74).
- Kuzuia rekodi MPYA zisiandikwe vibaya ni kosa (1), na liko kwenye batch (RIPOTI-CT).

## 16. Audit ya kuidhinisha capex (C8; freeze ct)
- Leo approver anachukuliwa kwenye session (si kutoka kwa client), kuna maker-checker, na approved_by / approved_at / status_change_reason
  ziko kwenye safu ya capex. Hakuna safu ya audit_trails ya kila badiliko. Kuongeza historia hiyo si (1)/(2).
