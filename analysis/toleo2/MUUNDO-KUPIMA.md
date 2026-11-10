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
   - Ikiwa bado kuna chombo wazi kilichobaki na ml chache, kinafungwa kwa "chombo kimeisha" kwanza (kanuni: chombo kimoja).
3. **Kuuza kipimo** (POS):
   - vipimo vilivyosajiliwa tu, kwa bei iliyosajiliwa; hakuna kipimo maalum;
   - ml zikitosha: bar −ml;
   - gharama ya mstari = cost_per_ml × ml, na GL ya mauzo inaandika Dr 5000 / Cr 1200 kama kawaida;
   - ml zisipotosha: "Fungua chombo kipya?";
   - bei < gharama: kazi 3 (sababu + Kagua).
4. **Chombo kimeisha:** ml zilizobaki ni upotevu: **Dr 5100 / Cr 1200** kwa gharama, bila tozo. Rekodi ina aliyefungua, aliyefunga, tarehe, ml zilizopotea, na sawa na vipimo vingapi vya kipimo kidogo.
5. **Chupa nzima:** inauzwa kutoka kwa mzazi moja kwa moja, kama leo.
6. **Kufuta au kubadilisha sale ya kipimo:** ml zinarudi kwenye chombo kama bado kiko wazi. Kama kimeshafungwa, upotevu wake unapungua kwa kiasi hicho.
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
