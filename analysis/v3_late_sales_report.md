# LSMS V3 — Mauzo yanayoingizwa kuchelewa (kusoma tu)

**Tarehe:** 2026-10-05
**Dump:** `lsms_20261004_0200.dump` (ileile ya backtest; SHA-256 ilithibitishwa 04/10), imerejeshwa kwenye container ya local `lsms_order_bt`. Prod na staging hazikuguswa.
**Dirisha:** 2026-08-05 hadi 2026-10-03 (siku 60). Mwelekeo wa miezi unatumia historia yote.
**SQL:** `analysis/v3_late_sales_queries.sql` (SELECT pekee, L1–L9).
**Maana ya "kuchelewa":** `sales.created_at` (muda wa kuingiza) iko siku ya baadaye kuliko `sales.sale_date` (siku ya mauzo). Ni mauzo ya `STANDARD` yasiyofutwa, kama kwenye P&L.

---

## 1. Jibu fupi

1. **Mauzo 100 kati ya 619 (16.2%) yaliingizwa siku iliyofuata; thamani 8,054,800 kati ya 66,757,450 (12.1%).** Yalitokea siku 35 kati ya 60.
2. **Yote yaliingizwa kati ya saa 07:37 na 10:31 asubuhi inayofuata.** Hakuna hata moja kabla ya saa 07:00. Kwa hiyo **toleo la oda la saa 06:00 halinasi chochote**: saa 06:00 mauzo ya jana ya kuchelewa bado hayajaingizwa.
3. **Tarehe ya sale ni ya siku ya KUUZA, si ya kuingiza.** Kila moja ya mauzo 100 lina `sale_date` ya siku ya mauzo saa 00:00:00, na limechelewa siku 1 kamili. Kwa hiyo **P&L ya kila siku haihamishi mauzo kwenda siku isiyo yake.**
4. **Athari iliyopo ni ya muda tu:** P&L ya siku D haijakamilika hadi mauzo yake yaingizwe asubuhi ya D+1 (kufikia 10:31). Ukiiangalia usiku wa D au mapema asubuhi, inakosa wastani wa 230,137 kwa siku yenye kuchelewa.
5. **Tatizo linapungua lenyewe:** Agosti 21.2% ya thamani, Septemba 8.8%, Oktoba 1–3 ni 0%.

---

## 2. Kwa siku ya mauzo (siku 35 zenye mauzo ya kuchelewa)

"Saa baada ya siku kuisha" = kutoka 00:00 ya siku inayofuata hadi sale ya mwisho ya kuchelewa kuingizwa.

| Siku ya mauzo | Siku | Mauzo ya kuchelewa | Mauzo yote ya siku | Thamani iliyochelewa | Thamani ya siku | % ya siku | Ya kwanza | Ya mwisho | Saa baada ya siku kuisha |
|---|---|---|---|---|---|---|---|---|---|
| 07/08 | Ijm | 2 | 9 | 60,500 | 723,250 | 8.4% | 08:23 | 08:51 | 8.9 |
| 08/08 | Jms | 14 | 14 | 1,197,000 | 1,197,000 | 100.0% | 09:24 | 10:31 | 10.5 |
| 10/08 | Jtt | 3 | 12 | 108,500 | 937,500 | 11.6% | 09:09 | 09:47 | 9.8 |
| 11/08 | Jnn | 2 | 4 | 131,500 | 191,500 | 68.7% | 08:54 | 09:22 | 9.4 |
| 12/08 | Jtn | 8 | 8 | 853,000 | 853,000 | 100.0% | 08:50 | 09:38 | 9.6 |
| 13/08 | Alh | 1 | 7 | 15,500 | 862,500 | 1.8% | 09:35 | 09:35 | 9.6 |
| 15/08 | Jms | 4 | 11 | 435,000 | 1,092,000 | 39.8% | 08:48 | 09:09 | 9.2 |
| 16/08 | Jpl | 5 | 13 | 205,500 | 954,000 | 21.5% | 09:42 | 10:31 | 10.5 |
| 17/08 | Jtt | 4 | 4 | 381,500 | 381,500 | 100.0% | 08:59 | 09:06 | 9.1 |
| 18/08 | Jnn | 4 | 11 | 183,500 | 982,000 | 18.7% | 09:31 | 09:54 | 9.9 |
| 19/08 | Jtn | 3 | 6 | 186,000 | 336,000 | 55.4% | 08:35 | 09:09 | 9.2 |
| 20/08 | Alh | 3 | 11 | 148,000 | 1,017,500 | 14.5% | 08:32 | 08:48 | 8.8 |
| 21/08 | Ijm | 2 | 9 | 141,000 | 1,041,500 | 13.5% | 09:29 | 09:55 | 9.9 |
| 22/08 | Jms | 4 | 12 | 143,000 | 940,000 | 15.2% | 09:51 | 10:13 | 10.2 |
| 23/08 | Jpl | 1 | 11 | 103,500 | 1,231,500 | 8.4% | 08:46 | 08:46 | 8.8 |
| 24/08 | Jtt | 1 | 15 | 17,500 | 1,555,500 | 1.1% | 09:02 | 09:02 | 9.0 |
| 25/08 | Jnn | 2 | 14 | 27,000 | 1,355,500 | 2.0% | 08:52 | 09:24 | 9.4 |
| 27/08 | Alh | 3 | 16 | 152,000 | 1,186,000 | 12.8% | 08:33 | 09:08 | 9.1 |
| 28/08 | Ijm | 4 | 9 | 385,500 | 1,251,000 | 30.8% | 09:42 | 09:56 | 9.9 |
| 04/09 | Ijm | 3 | 11 | 510,500 | 2,046,500 | 24.9% | 08:41 | 08:46 | 8.8 |
| 05/09 | Jms | 1 | 8 | 84,000 | 836,000 | 10.0% | 09:38 | 09:38 | 9.6 |
| 06/09 | Jpl | 1 | 12 | 5,000 | 1,360,500 | 0.4% | 08:29 | 08:29 | 8.5 |
| 09/09 | Jtn | 1 | 7 | 11,000 | 959,500 | 1.1% | 09:29 | 09:29 | 9.5 |
| 10/09 | Alh | 3 | 11 | 55,000 | 1,066,500 | 5.2% | 08:52 | 09:10 | 9.2 |
| 12/09 | Jms | 1 | 12 | 6,000 | 1,129,500 | 0.5% | 09:28 | 09:28 | 9.5 |
| 13/09 | Jpl | 1 | 11 | 10,000 | 961,500 | 1.0% | 08:41 | 08:41 | 8.7 |
| 15/09 | Jnn | 2 | 6 | 249,900 | 682,400 | 36.6% | 08:46 | 08:48 | 8.8 |
| 16/09 | Jtn | 1 | 11 | 50,500 | 1,315,500 | 3.8% | 08:13 | 08:13 | 8.2 |
| 17/09 | Alh | 1 | 13 | 153,500 | 1,373,900 | 11.2% | 08:57 | 08:57 | 9.0 |
| 19/09 | Jms | 7 | 9 | 1,087,900 | 1,117,900 | 97.3% | 08:33 | 08:59 | 9.0 |
| 20/09 | Jpl | 1 | 15 | 148,000 | 1,720,100 | 8.6% | 07:58 | 07:58 | 8.0 |
| 23/09 | Jtn | 1 | 7 | 67,000 | 593,000 | 11.3% | 07:59 | 07:59 | 8.0 |
| 25/09 | Ijm | 4 | 17 | 423,500 | 1,396,000 | 30.3% | 07:51 | 08:15 | 8.3 |
| 27/09 | Jpl | 1 | 10 | 215,000 | 1,555,000 | 13.8% | 07:37 | 07:37 | 7.6 |
| 29/09 | Jnn | 1 | 15 | 103,000 | 1,382,500 | 7.5% | 08:02 | 08:02 | 8.0 |
| **Jumla** | | **100** | | **8,054,800** | | | | | |

Siku 6 kati ya 35 zaidi ya nusu ya mauzo ya siku iliingizwa kesho yake (08/08, 11/08, 12/08, 17/08, 19/08, 19/09); siku tatu ni 100%. Siku kubwa zaidi: 08/08 (1,197,000).

### Kwa siku ya wiki
| Siku | Siku zenye kuchelewa / zote | Mauzo ya kuchelewa / yote | Thamani iliyochelewa | % ya thamani |
|---|---|---|---|---|
| Jumatatu | 3 / 8 | 8 / 78 | 507,500 | 6.1% |
| Jumanne | 5 / 8 | 11 / 74 | 694,900 | 9.0% |
| Jumatano | 5 / 9 | 14 / 84 | 1,167,500 | 13.3% |
| Alhamisi | 5 / 9 | 11 / 100 | 524,000 | 5.7% |
| Ijumaa | 5 / 9 | 15 / 96 | 1,521,000 | 13.4% |
| **Jumamosi** | 6 / 9 | 31 / 97 | **2,952,900** | **25.3%** |
| Jumapili | 6 / 8 | 10 / 90 | 687,000 | 7.1% |

---

## 3. Kwa saa ya kuingiza (asubuhi inayofuata)

| Saa | Mauzo | Thamani | Siku |
|---|---|---|---|
| 07:00–07:59 | 4 | 592,000 | 4 |
| 08:00–08:59 | 40 | 4,241,300 | 20 |
| 09:00–09:59 | 48 | 2,944,000 | 20 |
| 10:00–10:59 | 8 | 277,500 | 3 |

**Ni kiasi gani kimeshaingizwa kufikia saa fulani:**

| Kufikia saa | Mauzo | Thamani | % ya thamani iliyochelewa |
|---|---|---|---|
| 06:00 | 0 | 0 | 0.0% |
| 07:00 | 0 | 0 | 0.0% |
| 08:00 | 4 | 592,000 | 7.3% |
| 08:30 | 11 | 1,068,500 | 13.3% |
| 09:00 | 44 | 4,833,300 | 60.0% |
| 09:30 | 65 | 5,903,300 | 73.3% |
| 10:00 | 92 | 7,777,300 | 96.6% |
| 10:30 | 98 | 8,044,300 | 99.9% |
| 11:00 | 100 | 8,054,800 | 100.0% |

**Muda baada ya siku kuisha (kutoka 00:00):** mfupi zaidi saa 7.6, wa kati saa 9.1, asilimia 90 ndani ya saa 9.9, mrefu zaidi saa 10.5.

Nje ya dirisha (tangu 01/07, mauzo 231 ya kuchelewa): 9 yaliingizwa kabla ya 07:00 (la mapema zaidi 06:40) na 10 yalichelewa zaidi ya siku moja. Ndani ya siku 60 za mwisho hakuna hata moja la aina hizo.

---

## 4. Tarehe ya sale: siku ya kuuza au ya kuingiza? P&L inaathirika?

| Kitabu | Sale ya kuchelewa inawekwa siku gani | Imepimwa |
|---|---|---|
| `sales.sale_date` | **siku ya kuuza** (00:00:00) | 100 / 100 |
| P&L ya kila siku (`/api/reports/daily-pnl`) | siku ya kuuza (inatumia `sale_date`) | kwa muundo wa query |
| GL (`journal_entry.entry_date`) | **siku ya kuuza** | 100 / 100 |
| Recon (`auto_total_sales`) | siku ya kuuza; inalingana na mauzo ya `sale_date` | siku 35 / 35 |
| Stock (`store.movement_date`) | **siku ya kuingiza** | mistari 445 / 445 |

**Hitimisho:**
- **P&L ya kila siku haiathiriki kwa namba za mwisho.** Mauzo, gharama ya bidhaa na faida ghafi vinaangukia siku ya kuuza. GL nayo iko sahihi.
- **Recon haiathiriki:** siku zote 35 `auto_total_sales` inajumuisha mauzo ya kuchelewa, na hakuna recon iliyowasilishwa kabla mauzo hayo hayajaingizwa.
- **Kinachoathirika ni stock ya mfumo kwa saa chache.** Kutoka 00:00 hadi mauzo yaingizwe (07:37–10:31), stock ya mfumo iko juu kwa vipande vilivyouzwa jana ambavyo havijaingizwa: vipande 4,687 kwenye mistari 441 ndani ya siku 60. Ripoti ya P&L tayari inarekebisha hili kwenye thamani ya stock (inahamisha mauzo ya nyuma kwenye siku yake). Oda ya usiku hairekebishi; ndiyo sababu ya sehemu 5.
- **Kisichoweza kuthibitishwa:** mauzo 10 (775,000, siku 8) yaliingizwa kabla ya saa 11:00 yakiwa na tarehe ya siku ileile. Yanaweza kuwa mauzo ya asubuhi hiyo, au ya jana yaliyoingizwa bila kurudisha tarehe nyuma. Kama ni ya jana, P&L imeyaweka siku isiyo yake. Data haiwezi kutofautisha; ni 1.2% ya thamani ya dirisha. Mawili kati yake (05/09 saa 09:09 na 30/09 saa 09:37) yaliingizwa asubuhi ileile ambayo mauzo ya jana yalikuwa yanaingizwa.

---

## 5. Maana yake kwa toleo la pili la oda (uamuzi wako wa saa 06:00)

Umeamua toleo la pili saa 06:00 ili kunasa mauzo ya jana yaliyoingizwa baada ya 00:00. Data inaonyesha saa hiyo ni mapema mno:

| Saa ya toleo la pili | Thamani ya kuchelewa iliyonaswa |
|---|---|
| 06:00 (uamuzi wako) | 0% |
| 09:00 | 60% |
| 10:00 | 97% |
| 10:30 | 99.9% |
| 11:00 | 100% |

**Uamuzi wa mmiliki (05/10, baada ya ripoti hii):** pendekezo lifuatalo limekubaliwa na toleo la 06:00 limeondolewa; pia ratiba imesahihishwa: kuondoka kununua ni 10:00 na mzigo unafika ~12:00, si saa 7 mchana. Kufikia 10:00 ni 96.6% ya thamani ya kuchelewa iliyoingizwa.

**Pendekezo la awali:** badala ya saa maalum, oda ijisasishe **kila sale lenye tarehe ya jana linapohifadhiwa** (baada ya commit, bila kuzuia chochote, kama masasisho ya counting na recon). Hivyo inanasa 100% bila kujali ni saa ngapi, na siku zisizo na kuchelewa haifanyi kazi yoyote. Kama unapendelea saa maalum, **10:30** inanasa 99.9%; mzigo hufika saa 7 mchana, kwa hiyo bado kuna muda.

Counting ya asubuhi inaendelea kurekebisha stock kama ilivyopangwa: hesabu halisi haitegemei mauzo yameingizwa au la. Toleo la pili linahitajika zaidi siku ambazo counting haifanyiki au inachelewa.

---

## 6. Mwelekeo kwa mwezi

| Mwezi | Mauzo | Ya kuchelewa | Thamani | Thamani iliyochelewa | % |
|---|---|---|---|---|---|
| Feb | 44 | 40 | 21,369,200 | 20,800,100 | 97.3% |
| Mac | 37 | 37 | 23,185,400 | 23,185,400 | 100.0% |
| Apr | 147 | 80 | 25,034,500 | 18,928,700 | 75.6% |
| Mei | 254 | 129 | 32,130,600 | 14,393,800 | 44.8% |
| Jun | 389 | 288 | 38,342,700 | 27,123,300 | 70.7% |
| Jul | 371 | 117 | 35,091,900 | 10,751,600 | 30.6% |
| Ago | 313 | 84 | 30,052,450 | 6,373,500 | 21.2% |
| Sep | 321 | 30 | 36,150,500 | 3,179,800 | 8.8% |
| Okt 1–3 | 26 | 0 | 4,188,000 | 0 | 0.0% |

Ndani ya dirisha: 05/08–03/09 mauzo 70 ya kuchelewa (4,875,000, siku 19); 04/09–03/10 mauzo 30 (3,179,800, siku 16). Duka linazidi kuingiza mauzo siku ileile.

---

## 7. Mipaka ya ripoti hii

- Dump ni ya 04/10 saa 02:00, kwa hiyo mauzo ya 03/10 ambayo yangeingizwa asubuhi ya 04/10 hayamo. Namba za 03/10 zinaweza kuwa pungufu.
- `created_at` ni muda wa kuingiza, si muda wa kuuza. Ripoti hii inapima kuchelewa kwa siku nzima tu; sale lililouzwa mchana na kuingizwa usiku wa siku ileile halihesabiwi kama la kuchelewa.
- Mauzo yaliyofutwa na madeni ya walk-in (`RECONCILIATION_MANUAL`) hayamo.
