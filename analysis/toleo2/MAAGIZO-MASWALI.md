# MAAGIZO: maswali ya 2.3.0 (mikopo), YOTE YAMEJIBIWA (26/10/2026)

Muundo kamili, ukiwa na majibu haya ndani yake, uko `analysis/toleo2/MUUNDO-2.3.0.md`.
**Code haianzi mpaka 2.2.72 iwe imepita staging** (57a–d `---OK---`).

| # | Swali | Jibu la mmiliki | Lini | Ndani ya MUUNDO |
|---|---|---|---|---|
| M-10 | Akiba ya mkopo: memo, au akaunti 1025 ("Weka akiba", M-6)? | **YAMEJIBIWA.** Memo. 1025 haimo kwenye 2.3.0. | 26/10 c | §2.2, §2.5 |
| M-11 | Riba: 1150 (iliyolipwa mapema, ndani ya 2100), au 2110 (inayodaiwa, M-4)? | **YAMEJIBIWA.** 1150. 2100 = jumla ya mkataba; 1150 → 6600 kila siku. 2110 haitumiki. | 26/10 c | §2.1–2.3 |
| M-12 | Siku za riba: siku ya kuanza na ya mwisho zinahesabiwaje? | **YAMEJIBIWA.** Siku ya kuanza inahesabiwa, ya mwisho haihesabiwi. Mkopo A: 04/10/2026 → 03/01/2027 = siku 92. 158,000 ÷ 92 kwa siku; siku ya mwisho (03/01) inabeba salio la kujumlisha, kwa hiyo jumla = 158,000 sawasawa. | 26/10 d | §2.3, 23.a |
| M-13 | Cr ya malipo ya mkopo? | **YAMEJIBIWA.** Kabla ya tarehe ya kukata D: **1000** (sawa na M-7, 19/10). Baada ya D: akaunti halisi ya benki (102x) iliyochaguliwa wakati wa kulipa. **1021 haitumiki kabla ya D.** | 26/10 d | §2.4, 23.e, 23.e2 |
| M-14 | Ripoti ya faida ya siku/mwezi iwe kwa tarehe gani? | **YAMEJIBIWA.** Kwa tarehe ya journal (`entry_date`). Late entries zinaonyeshwa na alama ya `event_date` yao. Miezi iliyofungwa haibadiliki kwenye ripoti. | 26/10 d | §3, 23.q |
| M-15 | Kulipa mapema / zaidi | **YAMEJIBIWA.** Malipo yanapunguza 2100 tu; ratiba ya riba (1150 → 6600) haibadiliki, kwa sababu riba ni ya mkataba. Punguzo la mkopeshaji ni marekebisho ya mkono kupitia `POST /loans/{uid}/corrections`. Mkopo unafungwa wakati 2100 = 0 **na** 1150 = 0. | 26/10 d | §2.4, §4, §6, 23.f, 23.m, 23.m2 |
| M-16 | Marekebisho ya A: njia ipi? | **YAMEJIBIWA.** Journal ndani ya Oktoba: Dr 2100 28,000 + Dr 1150 158,000 / Cr 1021 186,000; kisha riba ya kufidia 04/10 → siku ya kuwasha. | 26/10 c | §0.4, 23.o |
| M-17 | Mpangilio wa merge / namba za migration | **YAMEJIBIWA.** Si "returns kwanza". Toleo linalofika prod kwanza linachukua namba inayofuata; migration ambayo haijafika prod inapewa namba mpya wakati wa merge. | 26/10 c | §5, `analysis/MATAWI.md` |
| M-18 | Tarehe ya journal ya marekebisho ya A | **YAMEJIBIWA.** 04/10/2026. Riba ya kufidia: kila siku kuanzia 04/10 hadi siku ya kuwasha, kila journal na `event_date` yake halisi. | 26/10 d | §0.4, §2.3, 23.p |

**Tafsiri moja ya kuthibitisha unaposoma MUUNDO (si swali jipya):**
- M-15 inamaanisha kwamba `PUT /loans/{uid}` inabadilisha **maelezo tu** (mkopeshaji, notes, tarehe za awamu zisizobadilisha jumla).
- Mabadiliko ya kiasi, riba au tarehe yanakataliwa pale, na yanaelekezwa `/corrections` (§6, 23.j).

**Kumbuka:** marekebisho ya A yanapunguza **NMB (1021) kwa 186,000**. Hii ni journal ya marekebisho ya usajili wa 04/10, si malipo, kwa hiyo M-13 haihusiki. 2100 inapungua 28,000 (2,386,000 → 2,358,000).
