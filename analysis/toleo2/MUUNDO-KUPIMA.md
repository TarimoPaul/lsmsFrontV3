# MUUNDO wa KUPIMA (ef, ei, ej): jinsi utakavyojengwa
**Matawi:** `feature/t2-kupima` kwenye backend na V3. Yanaanzia `feature/t2-gharama`, kwa sababu kanuni ya kazi 3 (chini ya gharama → sababu + Kagua) inatumika kwenye mauzo ya kipimo.

## Data (V143)
- **products** inaongezewa:
  - `selling_mode` (KAWAIDA | KUPIMA, default KAWAIDA);
  - `container_name` (chupa, dumu, …);
  - `container_ml`;
  - `parent_product_uid` (chupa nzima kwenye store).
- **pour_measure:** product_uid, ml, price, active. Kuna mistari mingi kwa bidhaa: 30/60, 70/80, ….
- **pour_settings_history:** nani, lini, kipi (ml/bei/chombo/mzazi), zamani → mpya. Haibadilishwi wala kufutwa (kanuni 4).
- **open_container:** product_uid, parent_product_uid, container_ml, ml_left, cost_per_ml (avg ya mzazi wakati wa kufungua ÷ ujazo), status (OPEN | CLOSED), opened_by/at, closed_by/at, ml_lost, loss_cost.
  - Index ya kipekee: **chombo KIMOJA tu OPEN kwa bidhaa**.
- **sales_details** inaongezewa `pour_measure_uid`, `pour_ml` na `container_uid` (NULL kwa mauzo ya kawaida).
- **Ruhusa mpya KUPIMA_SETTINGS:** CEO na Executive CEO. Ni ruhusa peke yake, haiunganishwi na ruhusa za bidhaa. Kuuza, kufungua na "chombo kimeisha" vinatumia ruhusa za mauzo za kawaida.

## Mtiririko
1. **Mipangilio** (KUPIMA_SETTINGS tu):
   - aina, chombo, ujazo, mzazi, vipimo {ml, bei};
   - onyo kama bei < gharama (avg ya mzazi ÷ ujazo × ml);
   - kila badiliko linaandikwa kwenye historia na linatumika kwa mauzo yajayo tu.
2. **Fungua chombo:** mzazi −1 kwenye store (movement inayotaja chombo), na bar = ujazo. Hakuna GL, kwa sababu chupa bado ni mali (1200).
   - Kufungua kwa mkono kunaruhusiwa tu kama hakuna chombo wazi (kanuni: chombo kimoja).
3. **Kuuza kipimo** (POS):
   - vipimo vilivyosajiliwa tu, kwa bei iliyosajiliwa; hakuna kipimo maalum;
   - ml zikitosha: bar −ml;
   - gharama ya mstari = cost_per_ml × ml, na GL ya mauzo inaandika Dr 5000 / Cr 1200 kama kawaida;
   - ml zisipotosha (ek), mfumo unauliza na haufungi chochote wenyewe:
     - (i) "Tumia ml zilizobaki + fungua kipya": kipimo kinagawanywa. Cha zamani kinafika 0 bila upotevu, na kinachobaki kinatoka kwenye chombo kipya (mzazi −1).
     - (ii) "Chombo kimeisha kweli": ml zilizobaki ni upotevu (Dr 5100 / Cr 1200), kisha chombo kipya kinafunguliwa na kipimo chote kinatoka humo.
     - Uamuzi unatumwa pamoja na sale na unafanyika ndani ya transaction ileile.
   - bei < gharama: kazi 3 (sababu + Kagua).
4. **Chombo kimeisha:** ml zilizobaki ni upotevu: **Dr 5100 / Cr 1200** kwa gharama, bila tozo. Rekodi ina aliyefungua, aliyefunga, tarehe, ml zilizopotea, na sawa na vipimo vingapi vya kipimo kidogo.
5. **Chupa nzima:** inauzwa kutoka kwa mzazi moja kwa moja, kama leo.
6. **Kufuta au kubadilisha sale ya kipimo:** ml zinarudi kwenye chombo kama bado kiko wazi. Kama kimeshafungwa, zinaingia kwenye **upotevu wa chombo hicho**. Kilichojengwa ni Dr 5100 / Cr 1200, si Dr 1200 / Cr 5100 ya (ek). **UAMUZI (en, 10/11): Dr 5100 / Cr 1200 ni sahihi, inabaki** (mfano hapa chini ndio ushahidi).
   - Mfano, chupa ya 750 (gharama 1 kwa ml): imeuzwa 30ml (COGS 30), kisha chombo kimeisha na 720 ni upotevu. Sale ya 30ml ikifutwa, reversal ya sale inarudisha Dr 1200 30 / Cr 5000 30.
   - Na Dr 1200 / Cr 5100 juu yake: 1200 ingebaki +60 bila chupa yoyote, na upotevu ungekuwa 690. Hii si kweli, kwa sababu chupa yote (750) ilitoka.
   - Na Dr 5100 / Cr 1200 (kilichojengwa): 1200 ni 0, upotevu ni 750, COGS ni 0. Gharama inahamia kwenye upotevu, kwa sababu ml hizo hazikuuzwa bali zilikuwa kwenye chupa iliyoisha.
7. **Hesabu ya wiki:** vyombo vilivyofungwa (idadi ya mzazi), pamoja na kilicho wazi kwa kiwango (1, ¾, ½, ¼) dhidi ya bar.
8. **Ripoti:**
   - upotevu kwa chombo/kinywaji;
   - faida ya kupima dhidi ya kuuza chombo kizima, kwa chupa: mapato ya vipimo ÷ vyombo vilivyotumika dhidi ya bei ya chupa nzima.

## Vipimo vinavyojulikana (ei, ej)
| Kinywaji | Chombo | Vipimo |
|---|---|---|
| Konyagi | chupa 750ml | 30ml = 1,000 |
| Moon Light | chupa 750ml | 50ml = 2,000 |
| Wine | dumu 5,000ml | 70ml = 2,000; 80ml = 3,000 |
| Golden King, Gilbeys, Camino | chupa 750ml | Chief atataja kabla ya uhamisho |

"Wine 500" ya data ya zamani ni gharama ya kubuni ya kipande, si bei.

## Uhamisho (hatua tofauti, BAADA ya Chief kuhesabu na kujaza mipangilio)
Hatua ni KAGUA → ANDIKA:
- bidhaa za vipimo za zamani zinakuwa KUPIMA;
- stock ya "vipande" inafutwa, kwa (B) ya KUPIMA-GL-EG: Cr 1200 kiasi kilichoko GL / Dr 3900;
- chombo kilicho wazi kinaanzishwa kwa ml zilizohesabiwa, **bila kupunguza mzazi tena**.

## Majaribio
- **Unit:** gharama ya kipimo, bar haitoshi, chombo kimoja, upotevu, historia, ruhusa.
- **PG:** V143 kwenye dump halisi.
- **E2E (POS):**
  - kuuza 30 na 60;
  - bar inapungua;
  - kufungua chombo (mzazi −1);
  - chombo kimeisha (Dr 5100);
  - bei chini ya gharama → sababu;
  - asiye na KUPIMA_SETTINGS anapata 403 kwenye mipangilio.

## Wazazi wengi na bei kwa mzazi ((es) + (eu), 10/11)
- **Wazazi wengi:** bidhaa ya KUPIMA ina wazazi kadhaa wanaoruhusiwa (`pour_parent`, ndani ya V143; bado haijaenda staging wala prod). Mfano: WINE ZA KUPIMA ← GREPA WINE (dumu 5L) + MA-LOT BOX WINE.
- **"Fungua chombo"** (kwa mkono, au kwenye POS chombo kisipotosha):
  - mtumiaji anachagua mzazi; mzazi huyo −1;
  - chombo kinakumbuka mzazi wake (`pour_container.parent_product_uid`);
  - gharama kwa ml = avg ya mzazi huyo ÷ ujazo.
- **Mzazi asipochaguliwa:** akiwa mmoja tu, anachukuliwa yeye. Wakiwa zaidi ya mmoja, jibu ni 422 `KUPIMA_PARENT` likiwa na orodha ya wazazi.
- **Bei:** bei za MSINGI ni `pour_measure`. Kila mzazi anaweza kuwa na bei zake kwa kipimo cha msingi (`pour_parent_price`, hiari).
  - Chombo kinauza kwa bei za mzazi wake; asipokuwa nazo, kwa za msingi.
  - POS inaonyesha bei za chombo kilicho wazi.
  - Sale inayogawanya kipimo kati ya vyombo viwili (SPLIT) inalipwa kwa bei ya chombo kilichokuwa wazi, kama POS ilivyoonyesha.
  - Hakuna chombo wazi, na mzazi aliyechaguliwa ana bei zake: POS inabadilisha bei kwenye kikapu na kuomba kuhakiki jumla kabla ya kuhifadhi, ili malipo yasiwe pungufu.
- **Mabadiliko ya mipangilio:** KUPIMA_SETTINGS tu. Historia inaandikwa kwa msingi ("KIPIMO 70ml") na kwa kila mzazi ("MZAZI", "BEI <mzazi> 70ml"). Yanatumika kwa mauzo yajayo tu.
- **Dumu zima** linauzwa kama bidhaa ya kawaida (mzazi).
- **Majaribio:**
  - kupima_api_e2e 45/0 (W1–W12: chaguo la mzazi, MA-LOT 2,500 dhidi ya GREPA 2,000, mapato kwa chombo, historia);
  - kupima_e2e 20/0 (W1–W6: dialog ya wazazi + bei, POS inauliza mzazi, kikapu 2,500);
  - hatua 85: t85-eq 21/0;
  - run-all 18/18 na suite 648/0/1 kwenye t2-tozo.
