# Hatua 85: majaribio ya local (10/11)
Nakala ya 29/10 (PG15), backend `feature/t2-kupima` f69e42d (V143).
- **Mazingira:** `L85_DIR=<Lsms-t2-kupima>/deploy/local L85_PROJ=lsms-local L85_BASE=http://127.0.0.1:18090`.
- **Wazazi wa kujaribu:** GILBEYS = bidhaa 58, WINE = 102. CAMINO iliachwa bila mzazi ili kujaribu njia ya kuruka.
- **KAGUA:** V143 IPO. Jumla ya GL ya kufuta ni 36,000.00, sawa na KUPIMA-GL-EG.
- **ANDIKA** (KONYAGI=375 MOONLIGHT=750 GOLDENKING=188 GILBEYS=0 CAMINO=0 WINE=2500): zimehamishwa 5, zimerukwa 1 (CAMINO, mzazi hayupo).
  - Vipande vyote → 0.
  - GL: Dr 3900 / Cr 1200, yaani 18,000 + 9,000 + 9,000.
  - Vyombo vimefunguliwa kwa ml zilizotolewa.
  - Wazazi hawajaguswa (33:9, 58:5, 64:8, 102:2, 105:2 kabla na baada).
  - Mistari ya mauzo 121 → 121. TB 0.
- **Mara ya pili:** zote zimerukwa ("imeshahamishwa"); CAMINO bado haina mzazi.
- **ml si namba:** inasimama kabla ya kuandika chochote.

## (eq) 10/11: wazazi kwa orodha ya UID
- 85 haitafuti tena mzazi kwa jina. Kila kinywaji kina uid ya mzazi ndani ya LIST:
  - KONYAGI 33, MOON LIGHT 105, GOLDEN KING 64, WINE = GREPA WINE 59;
  - GILBEYS na CAMINO ni "-" mpaka Chief asajili.
- KAGUA inaanza na "ORODHA YA WAZAZI" (uid, id, jina, aina, stock, avg, hali) ili Chief aithibitishe. Hali zinazowezekana:
  - SAWA;
  - HAIJAWEKWA;
  - UID HAIPO KWENYE DB;
  - IMEFUTWA;
  - NI BIDHAA YA KUPIMA - SI SAHIHI.
- Override ya L85_PARENT_* imeondolewa.
- Harness: `t85-eq.sh` kwenye nakala safi ya 29/10 (`local.sh up lsms-backend:local-f69e42d`, Flyway 143).
  - Matokeo: **19/0**.
  - Control (85 ya HEAD 945b124, `L85_STEP=`): **7/12**. Inashindwa kwa sababu inatafuta kwa jina, WINE haipati mzazi, na hakuna orodha.
- ANDIKA (KONYAGI=375 MOONLIGHT=750 GOLDENKING=188 GILBEYS=0 CAMINO=0 WINE=2500) kwenye nakala iliyowekwa GILBEYS=58 na CAMINO=uid ya bidhaa ya kupima 52:
  - zimehamishwa 5;
  - CAMINO imerukwa kwa sababu ni "SI SAHIHI";
  - mzazi wa WINE kwenye DB ni GREPA WINE;
  - wazazi hawajaguswa (33:9, 58:5, 59:1, 64:8, 105:2);
  - mistari ya mauzo na TB 0 havijabadilika.
- Mara ya pili: 5 "imeshahamishwa", 0 mpya.
- **Uid zinatoka kwenye nakala ya 29/10.** Uid hazibadiliki, lakini KAGUA ya prod ndiyo uthibitisho. Chief akisajili Gilbeys na Camino, uid zao zinawekwa kwenye LIST kabla ya ANDIKA.
- Jina "GREPA WINE 5L" linabadilishwa na Chief kwenye V3 (Bidhaa → hariri). 85 haibadilishi jina.

## (es) 10/11: wazazi wengi
- Safu ya wazazi ya 85 sasa ni orodha ya uid, zikitenganishwa kwa koma. WINE = GREPA WINE (59) + MA-LOT BOX WINE (102).
- Mzazi wa KWANZA ndiye wa chombo kilicho wazi kwa ml zilizohesabiwa (migrate `parentProductUid`).
- Bei za wazazi (eu) zinawekwa baadaye kwenye V3. 85 inaweka bei za msingi tu.
- t85-eq.sh ni 21/0 (T1h MA-LOT SAWA, T3e wazazi 2, T3i chombo kutoka GREPA) kwenye backend t2-kupima 1bf9df4, nakala safi ya 29/10.
