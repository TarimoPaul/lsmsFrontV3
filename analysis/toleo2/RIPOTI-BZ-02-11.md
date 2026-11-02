# RIPOTI (bz) 02/11 — 1200 ya GL dhidi ya daftari la stock; hatua 66

nimesoma hadi (bz). Herufi nilizoziona tangu ripoti iliyopita: (bz) tu. **(by) haipo kwenye MAAGIZO.md**: baada ya (bx) inafuata (bz) moja kwa moja. Kama (by) ilitumwa, naomba uitume tena.

63 ANDIKA imepokelewa: log ni PASS 21/0. Inaonyesha 1200 4,843,975.35 → 4,578,975.35 (−265,000), Jagger stock 1 @ 53,000, kifurushi 1/1/0.

## 1. Ripoti ya uendeshaji inatumia gharama ipi kwa "Stock value"? (jibu kutoka code, main = prod 2.3.0, haijabadilika kwenye release/2.4.0)

Kuna vipimo vinne tofauti vya thamani ya stock kwenye mfumo:

| Mahali | Idadi | Bei | Code |
|---|---|---|---|
| **GL 1200** | — | gharama iliyoandikwa wakati wa tukio (manunuzi kwa bei ya manunuzi; COGS kwa `current_average_cost` ya wakati huo) | journals |
| **Daftari (Σ stock × avg)** | `products.current_stock` | `products.current_average_cost` (WAC; inasasishwa kila manunuzi) | `PurchaseService:506` |
| **Ripoti ya uendeshaji** — "Stock value change", opening→closing | `stock_after` ya mwendo wa mwisho **kwa movement_date** ≤ siku (+ marekebisho ya mauzo ya tarehe ya nyuma) | **bei ya manunuzi ya MWISHO** (`purchases.cost_per_piece`, RECEIVED/APPROVED, ya karibuni kwa purchase_date); `current_average_cost` ikikosekana tu | `DailyPnlService.stockValueAt` (mstari 291) |
| **V3 Store "Thamani ya mzigo"** (na pendekezo la mtaji wa ufunguzi) | `current_stock` | wastani wa **miezi 6** wa `unit_price` ya mwendo wa PURCHASE; **0** kwa bidhaa isiyonunuliwa ndani ya miezi 6 | `StoreRepository.calculateWeightedAvgCostForProducts`, `StoreService:2829` |

Kwa hiyo ripoti ya uendeshaji **haitumii** `current_average_cost`, ambayo ndiyo COGS na GL zinatumia. Inatumia bei ya manunuzi ya mwisho. Kwa cutover D (hatua 60) hii ina maana:
- "Stock value change" kwenye ripoti ya uendeshaji ≠ mabadiliko ya 1200, hata kama hakuna kosa lolote. Tofauti ni Σ stock × (bei ya mwisho − avg), pamoja na tofauti ya idadi inayotokana na kupanga kwa movement_date.
- Thamani ya ukurasa wa Store iko chini zaidi: bidhaa zisizonunuliwa miezi 6 zinapata thamani 0.
- Pendekezo (si sasa, BAADA-YA-BATCH): ripoti ya uendeshaji na ukurasa wa Store zitumie `current_average_cost`, kama GL. Hapo daftari, ripoti na GL zitakuwa na kipimo kimoja. Kabla ya D, namba ya ufunguzi iwe **Σ stock × avg** (daftari), si ya ripoti wala ya ukurasa wa Store.

Mfano kwenye nakala ya Docker-local (29/10 + data za majaribio, **si prod**): GL 5,489,650.51; daftari 5,498,854.31; ripoti ya uendeshaji 5,591,415.14; ukurasa wa Store 4,353,175.26 (bidhaa 23 zenye stock hazina manunuzi ndani ya miezi 6, thamani avg 854,083). Kwenye nakala hiyo hiyo, HENNESY ina stock 2 kwenye ripoti ya uendeshaji na 0 kwenye `current_stock`, kwa sababu ya mwendo wa tarehe ya nyuma (ripoti inapanga kwa movement_date).

## 2. Hatua 66 (kusoma tu, prod) — imeandaliwa, HAIJAENDESHWA

Faili: `analysis\steps\66-kagua-1200.cmd` (+ `.sh`, `.sql`). Kiolezo ni 62: hakuna password, hakuna restart, ficha, `default_transaction_read_only=on`, timeout ya dakika 2. Ni query MOJA, kwa hiyo namba zote zinatoka snapshot moja. Kwenye PG15 ya local inachukua sekunde 14.

Inachotoa (lebo kwenye log):
- `JUMLA_*`: GL 1200 (inalinganishwa na 4,578,975.35 yako), daftari kwa avg, daftari kwa last cost, ripoti ya uendeshaji (nakala ya SQL ya `stockValueAt` ya leo), ukurasa wa Store, stock hasi, na stock bila gharama.
- `DARAJA|1…8`: daftari → − mwendo bila journal → − stock ya mwanzo → − stock isiyoelezwa na mwendo → − gharama (avg ya leo dhidi ya gharama zilizoandikwa) → + GL ya bidhaa zilizofutwa → + GL isiyo na bidhaa (true-up, journal za mkono) → = GL. `TOFAUTI_ISIYOELEZEKA` inakagua kwamba hakuna mstari uliopotea. Kwa muundo wa daraja lazima iwe 0.00; ikiwa si 0, ni kosa la query.
- `TANGU_TRUE_UP*`: tofauti ya leo, na sehemu yake inayotokana na mwendo ulioandikwa baada ya true-up ya 30/09 bila journal. Hii ndiyo namba muhimu kwa D.
- `MWENDO_KWA_AINA`, `MWENDO_BILA_JOURNAL_MWEZI`: aina, idadi, kiasi, na thamani kwa avg ya leo.
- `MAUZO_*`: mauzo yanapimwa kwa sale nzima (sale + reversal zake). Sale iliyofutwa yenye mwendo net 0 na journal net 0 haina athari.
- `STOCK_YA_MWANZO*`: stock_before ya mwendo wa kwanza, na "mapengo ya mnyororo" (stock_before ≠ stock_after ya mwendo uliotangulia, kwa mpangilio wa id).
- `MANUNUZI_*`: kwa hali; stock bila journal; journal bila stock; GL ≠ stock × gharama.
- `GL_BILA_BIDHAA`, `TRUE_UP_1200`, `BIDHAA_KUBWA` (10, pamoja na mgawanyo wa kila moja), `RIPOTI_VS_DAFTARI`, `AVG_VS_LAST`.

Jinsi GL inavyopewa bidhaa: purchase uid → product; sale → mistari ya sales_details (kwa uwiano wa total_cost); `COUNT:<stock_adjustment>`; `STOCK:<mwendo>`; capex (DAMAGE); sales_returns. Journal ya mkono inapewa bidhaa ikiwa maelezo yake yana uid8 ya bidhaa MOJA. Ndiyo maana journal ya 63 ("Jagger 886dc1ed") inapewa Jagger, na mwendo wake wa `MAREKEBISHO-…` unahesabiwa kuwa na journal.

**Majaribio**:
- Majaribio ya rollback kwenye PG15 ya local: 9/0.
  - Jagger: kesi ya 63 ilijengwa upya. Haionekani kama tofauti, na `TANGU_TRUE_UP` haibadiliki.
  - C1: journal ya manunuzi imeondolewa. Inaonekana 165,000 kwenye manunuzi, na tangu true-up pia.
  - C2: journal ya mkono bila uid8 inaonekana "bila bidhaa", na mwendo wake unaonekana "bila journal".
  - C3: current_stock imebadilishwa bila mwendo, na inakamatwa.
  - Rollback ilithibitishwa: rows za t66 = 0, Jagger bado 6.
- `.sh` kwa docker bandia dhidi ya PG15: exit 0 + `---USHAHIDI_66_UMEKAMILIKA---`. Kesi za kudhibiti: SQL mbovu → exit 1; SQL haipo → exit 1.
- `.cmd` fakes 4/4: OK, server haikumaliza, scp imeshindwa, ssh exit 1.

## 3. Mambo yaliyoonekana kwenye nakala ya local (yathibitishwe na log ya 66 ya prod)

1. **True-up mbili za 1200 tarehe 30/09**: JE-…779721 (527,068.35, 10:32, "Rebuild ya GL … marekebisho ya stock ya zamani (ADJ…)") na JE-…106059 (528,773.18, 15:34, "thamani ya stock sasa inatumia current_average_cost"), zote na Paul Tarimo. Baada yake, kwenye nakala, daftari − GL = **9,203.80** tu. Kwa hiyo hazionekani kuwa zimeandikwa mara mbili. Hata hivyo, kwenye log ya prod angalia `TANGU_TRUE_UP_JUMLA`.
2. **Mwendo wa mkono `ADJ-*`**: 271 kati ya 273 hauna journal (Feb–Sep, kiasi −3,417). `ADJ-RESET` ya 09/04 (stock hasi → 0, +3,277) haina journal pia. Zote ni KABLA ya true-up, kwa hiyo true-up imezifunika kwa jumla moja, si kwa bidhaa. Kwa sababu hiyo, "bidhaa kumi kubwa" zitaonyesha tofauti kubwa kwa kila bidhaa (COCA & FANTA +499k, PEPSI & MIRINDA +423k …), ingawa jumla iko karibu 0. Tofauti hizo za bidhaa ni historia, si kosa jipya.
3. Hesabu zote za stock (COUNT-ADJ, 371) zina journal, hata zile zenye `gl_posted=false`: zilipata journal wakati wa rebuild ya GL. NO_ACTION haibadilishi stock, kwa hiyo haileti tofauti kati ya daftari na GL.
4. Mauzo yaliyofutwa yenye stock bila journal: 3, net +152 (RCP-20260807-270000-DCCB peke yake ni +152, 250,800 kwa avg). Reversal ilirudisha stock zaidi ya iliyouzwa. Hii itaonekana kama `MAUZO_STOCK_BILA_JOURNAL` kwenye prod ikiwa ipo huko pia.
5. Mapengo ya mnyororo wa stock: 52 bidhaa, 836 mapengo, net +506, 291,818. Stock ilibadilika nje ya mwendo uliorekodiwa, hasa Pepsi Take Away (+624) na Pepsi & Mirinda (+192).

## 4. Kinachofuata
- Endesha `analysis\steps\66-kagua-1200.cmd` wakati wowote (kusoma tu) na unitumie `66-kagua-1200.log`. Nitachambua tofauti ya prod kwa vyanzo hivi.
- Kisha (bv): sale zilizofutwa 30/10–01/11 (hatua ya kusoma tu) + kanuni ya ubora wa sababu (A6 + reco) + `${ROOT_PASSWORD:-}`. Baada yake onyo la manunuzi, kisha B5.
