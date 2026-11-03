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
