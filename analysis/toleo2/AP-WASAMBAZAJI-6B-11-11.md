# 6b — Wasambazaji wa mkopo: tathmini ya AP inayokosekana (KUSOMA TU, mmiliki 11/11 fa)

## HITIMISHO (Chief 11/11 fc) — hakuna marekebisho ya GL
- Wasambazaji WOTE hulipwa **siku hiyo hiyo kupitia NMB** (cash ya mauzo → amana NMB → malipo kesho yake); droo mara chache sana.
  **Hakuna mkopo wa wasambazaji** → hakuna AP inayokosekana.
- Kabla ya cutover D, NMB ni sehemu ya 1000, kwa hiyo **Cr 1000 ya manunuzi ni sahihi**. Hakuna journal ya marekebisho kwa 6b.
- "Vyote ni vya bwana" (12.56M) = pesa ya **biashara** (si 2300) → GL Cr 1000 ni sahihi.
- Manunuzi 17 UNPAID (743,464) + Grepa 02/10 (75,000) = yalilipwa siku hiyo hiyo → **hatua 74**: PAID bila journal mpya.
- Pendekezo P1 (msambazaji kwa uid) linabaki kama usafi wa data (BAADA §11); P2–P4 hayahitajiki.
- Baada ya D: malipo ya msambazaji "Benki · NMB" ni Cr 1021, na amana za reco/sefu kwenda NMB sasa zinaandikwa Dr 1021 / Cr 1000
  (toleo 2, feature/t2-cutover) — vinginevyo 1021 ingekuwa hasi (tazama RIPOTI-FC-CUTOVER).

---


Chanzo: nakala ya Docker-local (dump ya prod 29/10/2026 10:27, PG15, V146). Hakuna kilichoandikwa. Nakala inaishia 29/10.

## 1. Kinachoonekana

**Tangu Julai karibu ununuzi wote hauna msambazaji aliyesajiliwa (`supplier_uid` tupu), ingawa jina limeandikwa.**

| Mwezi | Ununuzi | Bila uid | Na uid | Thamani bila uid (TZS) |
|---|---:|---:|---:|---:|
| 2026-05 | 244 | 33 | 211 | 2,428,267 |
| 2026-06 | 284 | 153 | 131 | 18,232,600 |
| 2026-07 | 261 | 258 | 3 | 32,394,002 |
| 2026-08 | 216 | 210 | 6 | 26,460,700 |
| 2026-09 | 283 | 280 | 3 | 34,534,450 |
| 2026-10 (hadi 29) | 300 | 298 | 2 | 36,379,452 |

Majina (Jul–Okt, bila uid), kwa thamani:

| Jina lililoandikwa | Ununuzi | TZS | Hali ya malipo kwenye rekodi | Je, yupo kwenye `suppliers`? |
|---|---:|---:|---|---|
| takawedo | 747 | 98,108,150 | PAID 512 (67.06M) / UNPAID 235 (31.05M) | NDIYO (takawedo, TAKAWEDO, Takawedo — rekodi 3) |
| vyote ni vya bwana | 99 | 12,558,300 | PAID 90 / UNPAID 9 | si msambazaji — maana yake "mmiliki amelipa"? |
| (tupu) | 128 | 10,284,001 | PAID 88 / UNPAID 40 | — |
| pepsi | 24 | 5,562,400 | PAID 16 / UNPAID 8 | NDIYO |
| serengeti, agu, cocaagent, grepa, tanport, babuu | 48 | ~3.2M | | NDIYO (wengi) |

## 2. GL inavyowaandika leo

- Ununuzi **bila uid**: Dr 1200 / **Cr 1000** siku ileile (Okt: 36,379,452 yote Cr 1000). Yaani GL inasema "tumelipa
  pesa ya mkononi leo", hata kama rekodi inasema UNPAID.
- Ununuzi **na uid** (tangu Juni): Cr 1000 16.44M + **Cr 2000 (AP) 743,464**.
- Malipo kwa wasambazaji (`supplier_payments`): Dr 2000 / Cr 1000 (au 1020). Okt: 6,817,443, kubwa ni takawedo 6,258,126 (04/10).
- Salio la **2000 = 0** kwenye dump.

## 3. Hatari (pesa/GL)

1. **AP inakosekana:** ikiwa Takawedo (au mwingine) anakopesha kweli, deni lake halipo kwenye 2000, na 1000 imepunguzwa siku ya
   kupokea mzigo badala ya siku ya kulipa. Kiasi kinachoweza kuwa deni: ununuzi UNPAID bila uid Jul–Okt
   = **36.9M** (takawedo 31.05M + pepsi 1.92M + tupu 2.80M + bwana 1.12M). Hali ya UNPAID si ushahidi peke yake
   (somo la hatua 74: "Umelipa sasa" ilipotea), kwa hiyo hiki ni kikomo cha juu, si deni lililothibitishwa.
2. **Hatari ya kuhesabu mara mbili:** malipo ya 04/10 kwa takawedo 6,258,126 yaliandikwa Dr 2000 / Cr 1000. Ikiwa yalikuwa
   ya ununuzi ulioandikwa BILA uid (tayari Cr 1000), basi 1000 ilipunguzwa mara mbili kwa kiasi hicho, na 2000 ingekuwa hasi
   — lakini 2000 = 0, kwa hiyo kwa jumla yalilingana na AP ya ununuzi wenye uid. Kuthibitisha: ankara za malipo ya 04/10.
3. **"vyote ni vya bwana" 12.56M:** ikiwa maana yake ni kwamba mmiliki alilipa kwa pesa yake, GL ilipaswa kuwa Cr 2300
   (Deni kwa mmiliki) si Cr 1000. Tangu 2.4.0 (C3) chanzo MMILIKI kipo kwa ununuzi MPYA tu.

## 4. Pendekezo (code — kwenye toleo 2, hakuna data ya zamani inayobadilishwa bila uamuzi)

- (P1) Fomu ya ununuzi na "Nunua tena": msambazaji achaguliwe kwa **uid** (orodha), si jina la bure; jina linaloendana na
  msambazaji aliyesajiliwa (bila kujali herufi kubwa/ndogo) linaunganishwa naye moja kwa moja. Hii ndiyo BAADA §11.
- (P2) Msambazaji apewe sifa `gives_credit` (anakopesha: ndiyo/hapana). Kwa anayekopesha, ununuzi usio na "Umelipa sasa"
  unaandika Cr 2000; kwa asiyekopesha, Cr chanzo (droo/benki/simu/mmiliki).
- (P3) Rekodi 3 za takawedo kwenye `suppliers` ziunganishwe kuwa moja (hatua ya data, baada ya uamuzi).
- (P4) Hatua ya data (kama 74), BAADA ya majibu ya Chief: kwa ununuzi wa zamani hakuna mabadiliko ya GL isipokuwa Chief
  athibitishe deni halisi la leo kwa msambazaji (k.m. salio la daftari la Takawedo): kisha journal MOJA ya ufunguzi
  Dr 1000 / Cr 2000 kwa kiasi hicho (si mstari kwa mstari).

## 5. Maswali kwa Chief

- Q6b-1: Takawedo anakopesha (analipwa baadaye) au analipwa siku ya mzigo? Na Pepsi?
- Q6b-2: Deni halisi la leo kwa Takawedo / Pepsi (kutoka daftari lao) ni kiasi gani? Hilo ndilo litakaloingia 2000 (P4).
- Q6b-3: "vyote ni vya bwana" = mmiliki (Paul) alilipa kwa pesa yake? Ikiwa ndiyo, Chief anataka zirekebishwe kwenda 2300?
- Q6b-4: Malipo ya 04/10 takawedo 6,258,126 yalikuwa ya ununuzi gani (ankara/kipindi)?
