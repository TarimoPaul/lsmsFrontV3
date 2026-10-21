# M-7: malipo 7 ya wasambazaji ya 04/10 (6,751,443.39)

**Chanzo cha namba zote:** `lsms_audit_20261015_0200` (dump ya usiku 15/10 02:00), kusoma tu.
Query: `m7-malipo-wasambazaji.sql`, matokeo: `m7-malipo-wasambazaji.out`.
**Hakuna kilichotekelezwa.** Hatua hii imeandaliwa tu.

**Imethibitishwa na mmiliki (19/10):** malipo yote 7 ni **kufuta madeni ya zamani (Feb–Jul) yaliyokwisha kulipwa kutoka benki**. Hayakutoka droo tarehe 04/10.
- Akaunti ya Cr inabaki **1000**, kwa sababu benki haikuwa ikifuatiliwa kabla ya tarehe ya kukata D.
- Maelezo ya journal mpya: "Malipo ya zamani (Feb–Jul) kutoka benki; yalirekodiwa 04/10".
- TAKAWEDO 85,200 nalo linahamishwa (M-7a imejibiwa: yote 7).

## 1. Journals 7

Zote ziliandikwa na Paul Tarimo tarehe 04/10 saa 15:14–15:16, kwa CASH. GL: Dr 2000 / Cr 1000. Hakuna hata moja iliyogeuzwa.

| Journal | Supplier payment | Msambazaji | Kiasi | FIFO: umri wa madeni yanayolipwa |
|---|---|---|---|---|
| JE-2026-239210046785928 (`c1a69c19…`) | `ca69b152…` | takawedo | 6,258,126.33 | wastani siku 230 (05/02–22/09); 6,207,126.33 ni ya zaidi ya siku 30 |
| JE-2026-239183099772759 (`7a4c1ff4…`) | `e543124d…` | Pepsi | 245,333.33 | siku 241 (05/02) |
| JE-2026-239223143712071 (`b9714ebd…`) | `bd476735…` | TAKAWEDO | 85,200.00 | **≤ siku 30** (madeni ya Septemba) |
| JE-2026-239137266820070 (`90a63ae6…`) | `b15d8942…` | BAFANA BAFANA | 59,600.00 | siku 36 (29/08) |
| JE-2026-239120281877328 (`7313d208…`) | `78c95c9f…` | agu | 52,183.33 | siku 239 (05/02–10/02) |
| JE-2026-239197056850732 (`3c1c71b1…`) | `8b181caf…` | Takawedo | 51,000.00 | siku 241 (05/02) |
| JE-2026-239155535163862 (`c3587eae…`) | `7cc62ca4…` | NEEMA SERENGETI | 0.40 | siku 41 (24/08) |
| | | **Jumla** | **6,751,443.39** | |

**FIFO** maana yake ni kwamba deni la zamani zaidi la msambazaji hulipwa kwanza (madeni ni purchases zilizopostiwa Cr 2000). Kwa kipimo hicho, malipo 6 kati ya 7 yanalipa madeni ya siku 36–241, ambayo yanakubaliana na "madeni yaliyolipwa zamani".

**TAKAWEDO 85,200:** kwa FIFO, malipo haya yanalipa madeni ya Septemba (≤ siku 30). Mmiliki amesema yote 7 ni ya zamani, kwa hiyo nalo linahamishwa.

## 2. Athari kwa salio (hesabu, kusoma tu)

| Akaunti | Tarehe | Kabla | Baada | Tofauti |
|---|---|---|---|---|
| 1000 Droo | 30/09 | 22,816,803.99 | **16,065,360.60** | −6,751,443.39 |
| 1000 Droo | 03/10 | 23,325,651.99 | 16,574,208.60 | −6,751,443.39 |
| 1000 Droo | **31/10** | 11,173,908.52 | **11,173,908.52** | **0** |
| 2000 AP | 30/09 | 6,751,443.39 (deni) | **0** | −6,751,443.39 |
| 2000 AP | **31/10** | 0 | **0** | **0** |

Salio la 31/10 linatumia data hadi 14/10, ambayo ndiyo ya mwisho kwenye dump. **31/10 haibadiliki**, kwa sababu reversal (04/10) na repost (30/09) zote mbili ziko kabla ya 31/10.

Matokeo mengine:
- AP ya 30/09 inakuwa 0. Hilo linakubaliana na "madeni yalikwisha kulipwa".
- Droo ya GL ya 30/09 inashuka kwa 6.75M. Namba ya 22.8M ya 30/09 iliyotumika kwenye RIPOTI/MPANGO ilikuwa juu kwa kiasi hicho.
- Miezi ya Feb–Ago bado inaonyesha droo juu kuliko hali halisi, kwa sababu malipo halisi yalifanyika miezi hiyo. Mmiliki amechagua 30/09, hivyo historia ya kila mwezi kabla ya hapo haibadilishwi.

## 3. Hatua (IMEANDALIWA, HAIJATEKELEZWA)

**Wakati:** baada ya deploy ya 2.2.71 (Toleo 1) na **kabla ya kufunga Septemba** (§1.9). Kama Septemba iko CLOSED, hatua inasimama, kwa sababu repost ingehamia 01/10. Kwenye dump ya 15/10, Septemba haina safu kwenye `gl_period`, maana yake ni OPEN.

**Mlolongo:** staging kwanza (dump ya siku hiyo), kisha prod.
1. **Kabla (kusoma tu):** `m7-malipo-wasambazaji.sql` S1–S3.
   - Journals 7 ni hai na hazijageuzwa;
   - Septemba ni OPEN;
   - salio la 1000 na 2000 la 30/09 na 31/10 linaandikwa.
2. **Kuhamisha: njia B** (mmiliki 19/10; hakuna code mpya kwenye 2.2.71). Code ya njia A (endpoint ya redate) imeondolewa, na nakala yake iko `analysis\steps\m7-redate-backend.diff` kwa kumbukumbu tu.

   Journals 2 za mkono kupitia `POST /api/v1/gl/journal-entries/manual` (FINANCE_WRITE):

   | # | Tarehe | Dr | Cr | Kiasi | Maelezo |
   |---|---|---|---|---|---|
   | 1 | 04/10 | 1000 | 2000 | 6,751,443.39 | memo: "M-7: kufuta malipo 7 ya 04/10 (madeni ya Feb–Jul yalilipwa benki zamani)"; mistari inataja entry_number 7 |
   | 2 | 30/09 | 2000 | 1000 | 6,751,443.39 | memo: "M-7: malipo ya Feb–Jul kutoka benki (yalirekodiwa 04/10)" |

   Entry numbers 7: JE-2026-239210046785928, JE-2026-239183099772759, JE-2026-239223143712071, JE-2026-239137266820070, JE-2026-239120281877328, JE-2026-239197056850732, JE-2026-239155535163862.

   - `memo` ya journal ya mkono inahifadhiwa kwenye `journal_entry.reference_number`, ambayo ni **varchar(100)**. Kwa hiyo entry_number zimewekwa kwenye maelezo ya mistari (text), si kwenye memo.
   - Kiasi kinatoka kwenye jumla ya journals 7 (M7J ya `39-toleo1-kabla.sql`). Ikiwa si 7 au jumla si 6,751,443.39, hakuna kinachoandikwa.

   **Hatua:** staging = hatua 40 (awamu B ya `39-toleo1-jaribu.mjs`); prod = **hatua 43** (`43-m7-prod.cmd`, API tu, "kagua" kwanza kisha "andika"). Zote mbili zinaendesha kipande kilekile cha code.

   **Rehearsal ya njia B kwenye PC (19/10):** backend `e57e08f`/`8c83b45` kwenye nakala za kutupwa za scratch. 1000 ya 30/09 ilipungua −6,751,443.39, 2000 ya 30/09 ikawa 0, salio la leo halikubadilika, TB = 0, na journals 7 za asili zilibaki hai. Kinga za hatua 43 zimejaribiwa pia (§3 hapo juu).

3. **Baada (kusoma tu):** S2 tena. Inapita ikiwa:
   - 1000 ya 30/09 imepungua 6,751,443.39, na 2000 ya 30/09 = 0;
   - 1000 na 2000 za leo/31/10 hazijabadilika;
   - TB na mizania vinalingana.
   - Namba kamili ya 16,065,360.60 ni ya dump ya 15/10 bila marekebisho ya 1.8. Baada ya 1.8, 1000 ya 30/09 ni tofauti, kwa hiyo ukaguzi ni wa tofauti.
4. Kisha 1.9: kufunga Jan–Sep.

## 4. Supplier payments nyingine zenye tarehe mbali na purchase (kusoma tu)

Nimetumia kipimo cha FIFO cha S6, kwa sababu kipimo rahisi (S4/S5, "purchase ya mwisho ya msambazaji") kilikosea takawedo, ambaye pia ana purchases za karibuni.

| Tarehe | Msambazaji | Njia | Kiasi | Umri wa madeni |
|---|---|---|---|---|
| 04/10 | (6 kati ya 7 hapo juu) | CASH | 6,666,243.39 | siku 36–241 |
| **24/08** | takawedo | **BANK_TRANSFER** | 244,664.00 | siku 200 (05/02) |

- **Hakuna malipo mengine ya CASH** yanayolipa madeni ya zaidi ya siku 30, nje ya yale ya 04/10.
- Lipo moja la BANK_TRANSFER (24/08, 244,664 kwa takawedo, deni la 05/02). Si CASH, kwa hiyo haliko kwenye hatua hii; nimeliorodhesha ili mmiliki aone.

## 5. Maswali

| # | Swali |
|---|---|
| ~~M-7a~~ | Imejibiwa: yote 7 yanahamishwa. |
| ~~M-8~~ | Imejibiwa: njia A (reverse 04/10, repost 30/09). |
| ~~M-9~~ | Imejibiwa: `payment_date` inabaki 04/10; maelezo kwenye supplier payments yanasubiri endpoint ya Toleo 2 (hakuna njia ya UI/API leo). Swali la zamani lilikuwa: `supplier_payments.payment_date` iwe 30/09 pia? Leo endpoint inahamisha journals tu. Backfill ya kawaida haizirudishi 04/10, kwa sababu reposts zina reference ileile na zinaonekana hai. Lakini GL ikifutwa yote na kujengwa upya kutoka sub-ledger, zingerudi 04/10. |

## 6. Madeni yaliyo wazi leo kwenye 2000 (kusoma tu, 19/10)

Query ni S7–S11 kwenye `m7-malipo-wasambazaji.sql`, kwenye `lsms_audit_20261015_0200` (data hadi 14/10).

**GL: hakuna deni lolote lililo wazi.** Salio la 2000 ni **0.00**.
- Kwa kila msambazaji, madeni yaliyowahi kuandikwa Cr 2000 = malipo yaliyoandikwa Dr 2000: jumla 7,233,107.39 pande zote mbili (S8).
- Kwa FIFO, hakuna purchase yenye deni lililobaki (S7 = safu 0).
- M-7 haibadilishi hili tarehe 31/10.

**Sub-ledger (jedwali la purchases) linasema vinginevyo.** Lina purchases 236 zisizo PAID (S9, S10):

| Kundi | Purchases | "Bado" kwa sub-ledger | GL ilizipostije | Maana |
|---|---|---|---|---|
| > siku 30, PARTIAL (05/02–12/02) | 55 | 6,555,642.99 | deni (Cr 2000) | Zililipwa kwenye GL na malipo ya 04/10 (M-7) na ya zamani. `amount_paid` haikusasishwa, kwa sababu supplier payments haziunganishwi na purchase |
| > siku 30, UNPAID (22/06–29/08) | 12 | 541,264.40 | deni (Cr 2000) | Sawa: zimelipwa kwenye GL |
| ≤ siku 30, UNPAID, zenye supplier | 3 | 136,200.00 | deni (Cr 2000) | Sawa: zimelipwa kwenye GL |
| ≤ siku 30, UNPAID, **bila `supplier_uid`** | 166 | 19,503,452.06 | **cash (Cr 1000)** | Hii ni default iliyofichwa (§2.11 ya MPANGO). Purchase ina jina la msambazaji kama maandishi lakini haina `supplier_uid`, kwa hiyo GL inaiandika cash. Hali yake inabaki UNPAID kwa sababu `payment_status` ina default 'UNPAID'. Si madeni |

### Orodha ya kuthibitisha: zaidi ya siku 30 (S11)

Kwa kila msambazaji hapa chini, GL inasema deni limeshalipwa, lakini sub-ledger inasema bado. **Mmiliki athibitishe** kama kweli limelipwa.

| Msambazaji | Purchases | Tarehe | Siku | "Bado" kwa sub-ledger | Uliandikwa deni kwenye GL |
|---|---|---|---|---|---|
| takawedo | 53 | 05/02–10/08 | 65–251 | 6,502,790.33 | 6,502,790.33 |
| pepsi | 1 | 05/02 | 251 | 245,333.33 | 245,333.33 |
| neema serengeti | 2 | 24/08 | 51 | 122,000.40 | 122,000.40 |
| hil compan supply | 2 | 29/06 | 107 | 60,000.00 | 60,000.00 |
| bafana bafana | 3 | 29/08 | 46 | 59,600.00 | 59,600.00 |
| agu | 4 | 05/02–10/02 | 246–251 | 52,183.33 | 52,183.33 |
| chonjo | 1 | 01/07 | 105 | 35,000.00 | 35,000.00 |
| bafana | 1 | 25/07 | 81 | 20,000.00 | 20,000.00 |
| **Jumla** | **67** | | | **7,096,907.39** | **7,096,907.39** |

Orodha kamili, purchase moja moja, iko kwenye `m7-malipo-wasambazaji.out` (S9).

**Ikiwa mmiliki atathibitisha kwamba yote yamelipwa,** GL tayari iko sahihi, na kinachobaki ni sub-ledger (`purchases.amount_paid` / `payment_status`).
- Pendekezo kwa Toleo 2 (§2.11): supplier payment iunganishwe na purchases kwa FIFO, ikiweka `amount_paid` na `payment_status`. Kisha safu hizi 67 zinasahihishwa na hatua moja ya marekebisho (dryRun kwanza).
- **Ikiwa deni lolote bado ni la kweli,** GL inakosa deni hilo. Kuliandika kunahitaji journal (Dr 1000 au chanzo / Cr 2000) baada ya uamuzi wako.
