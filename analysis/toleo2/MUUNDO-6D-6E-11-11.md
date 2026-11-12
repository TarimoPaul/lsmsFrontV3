# 6d (1010 akiba ya mkopo/pango) na 6e (droo kwenye reco) — MUUNDO, kabla ya code (mmiliki 11/11 fa; BAADA §1, §8)

Hali: **muundo + maswali**. Hakuna code bado: BAADA §1 na §8 zinasema "kabla ya code: muundo", na maamuzi yaliyo hapa chini ni ya
Chief (yanagusa pesa ya droo na reco ya kila siku). Data: nakala ya local (dump 29/10), kusoma tu.

## Ugunduzi unaohusu zote mbili (kusoma tu)

| Okt 2026 (01–28) | TZS |
|---|---:|
| Ununuzi wote kwenye mfumo (GL Dr 1200 / **Cr 1000** karibu wote — ununuzi bila msambazaji ni "umelipwa leo") | 36,445,452 |
| Ununuzi ulioandikwa kwa mkono kwenye reco ("Ununuzi", pesa iliyotoka droo) | 2,616,500 |
| Mistari ya reco "Ununuzi" iliyounganishwa na purchase (purchase_uid) | 0 kati ya 18 |

Maana: GL inasema 36.4M zilitoka 1000 (droo/mkononi), lakini reco inaonyesha 2.6M tu zilitoka droo. Tofauti (~33.8M) ililipwa na
nani/vipi? (Takawedo kwa mkopo? mmiliki? benki?) — hili ndilo swali la 6b (AP-WASAMBAZAJI-6B-11-11.md) na linaathiri 6d/6e:
**hadi lijibiwe, 1000 ya GL si "droo"**. Kwa hiyo 6e ikiunganishwa leo, reco ingeanza kutoa ununuzi 36.4M kutoka pesa inayotarajiwa
ya droo — ingeharibu reco. 6e lazima ifuate jibu la Q6b-1 (nani analipa ununuzi wa Takawedo, na kutoka wapi).

## 6e — droo kwenye reco (pendekezo)

1. Mstari wa auto kwenye reco ya siku = malipo / ununuzi wenye chanzo **DROO** tu (C3, tangu 2.4.0), wa mtumiaji aliyeurekodi
   (`created_by`), tarehe ya malipo. Ununuzi bila chanzo (kabla ya C3) hauingii.
2. Mstari wa auto unapunguza "pesa inayotarajiwa" kama mstari wa mkono wa "Ununuzi" unavyofanya leo; unaonekana (hauhaririki).
3. Reco ya siku hiyo ikiwa APPROVED/CLOSED: malipo mapya ya DROO ya siku hiyo yanakataliwa (kanuni ileile ya kubadilisha sale,
   SaleChangeGuard). Reco ikiwa haijaundwa: mstari unaingia reco inapoundwa (inasomwa, haihifadhiwi mara mbili).
4. Mstari wa mkono wa "Ununuzi" unaondolewa kwenye fomu **kuanzia tarehe ya deploy** tu; mistari ya zamani (60 = 6,693,500 kwenye
   dump) haiguswi. Kinga ya kuhesabu mara mbili: siku moja haiwezi kuwa na mstari wa mkono NA wa auto.
5. GL haibadiliki (DROO tayari Cr 1000 wakati wa malipo); reco haiandiki GL.

Maswali: **Q6e-1** mtumiaji: aliyerekodi (pendekezo) au aliyeidhinisha? **Q6e-2** tarehe ya kuanza (siku ya deploy ya toleo 2)?
**Q6e-3** ununuzi wa Takawedo usio na chanzo — Macheda ataendelea kuuweka DROO? (tazama Q6b-1).

## 6d — 1010 akiba ya mkopo / pango (pendekezo)

1. Akaunti **1010 "Akiba ya mkopo na pango"** (ASSET, bahasha tofauti na droo).
2. Kila reco ya siku ina mstari "Akiba iliyowekwa leo" (kiasi kilichopendekezwa = memo ya leo: principal ÷ siku za mkopo
   A 10,869.57 + B 19,047.62 + pango 2.4M ÷ 365 ≈ 6,575; mtumiaji anaandika kiasi halisi kilichowekwa bahashani).
   Reco ikiidhinishwa -> journal Dr 1010 / Cr 1000 kwa kiasi hicho (si kabla ya kuidhinishwa).
3. Siku isiyo na reco: hakuna akiba (inaonekana kwenye ripoti kama pungufu ya akiba vs memo); hakuna kujaza kwa nguvu.
4. Malipo ya mkopo / pango yanaweza kuchagua chanzo **AKIBA** (C3 + chaguo jipya) -> Cr 1010. Ikiwa 1010 haitoshi -> kataa
   (au sehemu kutoka DROO — swali).
5. Ufunguzi (hatua 60 / cutover D): salio la bahasha ya akiba siku ya kukata = journal ya ufunguzi Dr 1010 / Cr 1000.

Maswali: **Q6d-1** akiba ni bahasha moja (mkopo + pango) au mbili (1010 mkopo, 1011 pango)? **Q6d-2** kiasi cha kila siku: kama memo
(pendekezo) au kiasi kimoja kilichowekwa na Chief? **Q6d-3** pango la 2027 linalipwa kutoka akiba (2.4M mwaka)? **Q6d-4** 1010
haitoshi siku ya malipo: kataa, au sehemu kutoka droo?

Mpango: code ya 6d na 6e itaanza mara tu Q6b-1, Q6e-1..3 na Q6d-1..4 zikijibiwa (tawi feature/t2-pesa).
