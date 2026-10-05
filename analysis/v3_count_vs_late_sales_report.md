# LSMS V3 — Counting ya asubuhi dhidi ya mauzo ya jana yaliyochelewa kuingizwa (ripoti fupi)

**Tarehe:** 2026-10-05
**Dump:** `lsms_20261004_0200.dump`, container ya local `lsms_order_bt` (kusoma tu; prod na staging hazikuguswa).
**Dirisha:** counting za 2026-08-06 hadi 2026-10-03 (siku 59); ukaguzi wa ziada kwa historia yote ya counting (tangu 05/07).
**SQL:** `analysis/v3_count_vs_late_sales_queries.sql` (C1–C6).

---

## 1. Jibu

**Swali halina siku za kulinganisha: ndani ya siku 60, counting haijawahi kuanza kabla mauzo ya jana kuingizwa.**

| Siku zenye mauzo ya jana yaliyochelewa (zenye counting) | 35 |
|---|---|
| Counting ilianza kabla ya sale la kwanza la kuchelewa | 0 |
| Counting ilianza wakati mauzo yanaingizwa | 0 |
| **Counting ilianza baada ya sale la mwisho la kuchelewa** | **35** |

Duka tayari linafuata kanuni hii: muda wa kati kutoka sale la mwisho la jana kuingizwa hadi counting kuanza ni **dakika 24**. Kwa historia yote ya counting (siku 60 zenye mauzo ya kuchelewa tangu 05/07) kuna siku **moja tu** iliyokiuka: 13/07, sale moja la 13,000 (vipande 6) liliingizwa saa 19:55 wakati counting ilianza 08:46.

Kwa hiyo siwezi kupima "variance ni kubwa kiasi gani siku hizo" kutoka data: siku hizo hazipo. Kanuni inabaki sahihi kwa sababu ya jinsi mfumo unavyofanya kazi (sehemu 3), si kwa sababu data imeonyesha hasara.

---

## 2. Kilichoweza kupimwa: siku zenye mauzo ya kuchelewa dhidi ya zisizo nayo

Zote mbili ni siku ambazo mauzo yalikuwa yameingizwa kabla ya counting.

| Kundi | Siku | Variance ya wastani (thamani kamili) | Ya kati (median) | Mistari yenye variance | Soda: vipande (kamili) | Soda: vipande (halisi) | Soda: thamani (kamili) |
|---|---|---|---|---|---|---|---|
| Hakuna mauzo ya kuchelewa | 24 | 176,080 | 115,713 | 9.8 | 96.2 | +64.5 | 51,284 |
| Mauzo ya jana yaliingizwa kabla ya counting | 35 | 223,014 | 98,554 | 8.0 | 90.9 | +54.5 | 49,933 |

- **Soda hazina tofauti:** vipande 90.9 dhidi ya 96.2 kwa siku. Variance kubwa ya soda (~vipande 90 kila siku, na ziada ya +55 hadi +65) ipo siku zote, kwa hiyo **haitokani na mauzo ya kuchelewa**. Chanzo chake ni kingine (bado hakijachunguzwa).
- **Bidhaa zote:** wastani uko juu kidogo siku zenye kuchelewa (223k dhidi ya 176k) lakini median iko chini (99k dhidi ya 116k) na mistari yenye variance ni michache zaidi. Tofauti ya wastani inatokana na siku chache kubwa, si mwelekeo. Hakuna ushahidi kwamba kuingiza mauzo asubuhi (kabla ya counting) kunaharibu hesabu.

---

## 3. Kwa nini kanuni bado ni ya lazima

`system_qty_snapshot` ya kila mstari wa counting inachukuliwa **counting inapoanza** (mistari 7,692 kati ya 7,928 inalingana na stock ya mfumo ya wakati huo; mistari 5 ambayo stock ilibadilika kati ya kuanza na kuhesabiwa yote inalingana na ya KUANZA). Stock ya sale la kuchelewa inatoka kwenye mfumo pale linapoingizwa.

Kwa hiyo sale la jana likiingizwa **baada** ya counting kuanza:
- vipande vyake bado vimo kwenye snapshot lakini havipo rafuni → mstari unaonyesha **upungufu wa uongo** wa vipande hivyo;
- upungufu huo ukipostiwa, kisha sale likaingizwa, stock inakatwa **mara mbili** → kesho yake inaonekana ziada.

Siku pekee ya ukiukaji (13/07) inaendana na hili, ingawa ni siku moja tu na haitoshi kuwa ushahidi:

| Bidhaa | Vipande vilivyoingizwa baada ya counting | Variance ya mstari |
|---|---|---|
| AFYA MAJI 600ML (id 11) | 1 | −2 |
| FLY FISH LEMON 330ML (id 27) | 1 | −1 |
| SERENGETI LITE (id 69) | 4 | −5 |

Ukubwa wa hatari kama kanuni ingeacha kufuatwa: siku yenye mauzo ya kuchelewa ina wastani wa 230,137 (vipande ~134) ambavyo vingeonekana kama upungufu.

---

## 4. Jambo jipya lililojitokeza: counting na kuondoka saa 4 asubuhi

Umesema mnaondoka kwenda kununua saa 4 asubuhi (10:00). Counting mara nyingi haijaisha saa hiyo:

| Siku 60 (05/08–03/10) | Siku |
|---|---|
| Counting ilianza kabla ya 10:00 | 39 |
| **Counting ilikamilika kabla ya 10:00** | **30** |
| Counting iliidhinishwa kabla ya 10:00 | 1 |

Counting inaanza kwa kawaida 09:38 na kukamilika 09:58 (median). Siku 30 za mwisho: ilikamilika kabla ya 10:00 siku 16 kati ya 30.

**Maana yake kwa oda:** takriban nusu ya siku, Macheda ataondoka na toleo linalotumia **stock ya mfumo** (la usiku + masasisho ya mauzo ya jana), si lile la counting. Hii inakubalika kwa bia kuu (stock ya mfumo inalingana na hesabu kwa 97% ya siku-bidhaa, mpango sehemu 3), lakini:
- mauzo ya jana yanapaswa kuwa yameingizwa kabla ya 10:00 (leo ni 96.6% ya thamani; yaliyobaki huingia hadi 10:31);
- kama unataka oda itumie hesabu halisi kila siku, counting inapaswa kukamilika kabla ya ~09:45.

**Mpangilio wa asubuhi unaopendekezwa (kanuni ya duka):** ingiza mauzo ya jana → counting → oda inajisasisha → ondoka 10:00.
