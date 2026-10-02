# Uhakiki dhidi ya production (live) — 01/10/2026

**Hali:** **SIMAMISHWA kwenye pre-flight.** Hakuna query yoyote iliyoendeshwa kwenye database ya production.
- Sehemu A (safu ya "live") na sehemu B **hazijafanyika**.
- Sehemu C imefanyika kikamilifu hapa, kwa sababu kipindi chote (20/08 hadi 29/09) kimo ndani ya backup, na git history iko hapa.

Uhakika: [Uhakika] / (Inawezekana) / (Kubahatisha).

---

## 0. Pre-flight (amri za kusoma tu, kupitia SSH; hakuna kilichobadilishwa)

| Kipimo | Thamani | Sharti | Matokeo |
|---|---|---|---|
| Saa ya server | **18:44 EAT**, Alhamisi 01/10/2026 (15:44 UTC) | Duka liwe limefungwa | **Haijatimia.** Mauzo mengi huingizwa saa 20–23, kwa hiyo huenda duka liko wazi. Sijui saa zenu za kufunga. |
| RAM jumla | **914 MB** | — | Si 2 GB kama ilivyoelezwa. Ukubwa huu ni wa t3.micro, si t3.small. [Uhakika] |
| RAM inayopatikana (`available`) | **173 MB** | > 400 MB | **Haijatimia** [Uhakika] |
| Swap inayotumika | 465 MB kati ya 2,047 | — | Tayari inatumika [Uhakika] |
| Load average | 0.00 / 0.00 / 0.00 | — | Server imetulia kwa CPU. Uptime ni saa 11:43. |

`docker stats --no-stream`:

| Container | RAM | % |
|---|---|---|
| lsms-deployment-backend-1 | 291.2 MiB | 31.9% |
| lsms-deployment-postgres-1 | 78.2 MiB | 8.6% |
| lsms-deployment-nginx-1 | 2.4 MiB | 0.3% |
| lsms-deployment-frontend-1 | 1.8 MiB | 0.2% |

**Uamuzi:** masharti mawili yameshindwa (RAM < 400 MB, na huenda duka liko wazi). Kwa mujibu wa sheria namba 3 na 4, **nimesimama**.
- Sikufungua psql.
- Sikufanya restart, wala sikubadilisha chochote.

---

## A. Backup dhidi ya live (02/07 hadi 29/09)

Safu ya "live" iko wazi kwa sababu pre-flight imeshindwa.

| Kipimo | Backup (30/09 10:26) | Live | Tofauti |
|---|---|---|---|
| Mauzo (STANDARD, bila yaliyofutwa) | 99,195,850 | — | — |
| Faida ghafi | 9,049,346 | — | — |
| Asilimia ya faida ghafi | 9.12% | — | — |
| Gharama za kila siku (tarehe ya recon) | 1,997,300 | — | — |
| Gharama za mwezi (pango na TRA kila mwezi; Azam ya Sept imetolewa) | 1,507,777 | — | — |
| Upotevu halisi wa stock (counting ya kwanza dhidi ya ya mwisho, 07/07 hadi 29/09) | −865,887 | — | — |
| Madeni yanayodaiwa, POS | 153,000 (mauzo 6) | — | — |
| Madeni yanayodaiwa, MANUAL_RETAIL | 1,802,500 (mauzo 106) | — | — |

Maelezo ya madeni: `payments.outstanding_balance > 0` kwa mauzo yenye mstari kwenye `reconciliation_retail_debts`. Ripoti ya awali ilisema ~1.90M; hapa jumla ni 1,955,500.

**Ninachotarajia nikiendesha kwenye live** (Inawezekana):
- Mauzo, faida ghafi na gharama za kipindi hiki ziwe **sawa au karibu sawa**, kwa sababu kipindi kiliisha kabla ya backup.
- Tofauti ndogo zinaweza kutokana na:
  - recon za tarehe za Septemba zilizoingizwa au ku-approve baada ya 30/09 10:26;
  - mauzo ya zamani yaliyofutwa au kuhaririwa baadaye;
  - malipo ya madeni baada ya backup.
- Madeni (salio la leo) **yatabadilika**, kwa sababu malipo yanaendelea kila siku.

---

## B. Data mpya tangu backup (30/09 10:26 hadi sasa)

**Haijafanyika**, kwa sababu pre-flight imeshindwa.

---

## C. Mkopo wa POS dhidi ya MANUAL_RETAIL (data ya backup, hapa)

### C1. Kwa siku, 20/08 hadi 29/09 [Uhakika]
Chanzo ni `reconciliation_retail_debts` kwa tarehe ya mauzo (`sale_date`). POS = `reference_type IS NULL`.

| Kipindi | Mikopo ya POS | Madeni ya MANUAL_RETAIL |
|---|---|---|
| 20/08 | 1 × 68,000 | 5 × 77,000 |
| 21/08 hadi 05/09 | **0** | 12 × 384,500 (26/08, 28/08, 29/08, 30/08, 04/09) |
| **06/09** | **1 × 101,000** (ililipwa siku iliyofuata) | 0 |
| 07/09 hadi 29/09 | **0** | 37 × 1,148,500 (karibu kila siku, 1 hadi 6 kwa siku) |

Jedwali kamili la kila siku liko kwenye output ya query C1 (sehemu ya mwisho ya ripoti).

### C2. Kwa wiki, tangu mwanzo [Uhakika]
| Wiki inaanza | POS (idadi / kiasi) | MANUAL_RETAIL (idadi / kiasi) |
|---|---|---|
| 08/06 | 12 / 246,500 | 0 |
| 15/06 | **92 / 7,602,000** | 0 |
| 22/06 | 68 / 6,039,500 | 19 / 369,000 (madeni ya kwanza ya mkono: 23/06) |
| 29/06 | 35 / 3,252,000 | 11 / 543,000 |
| **06/07** | **4 / 368,000** | 34 / 1,135,500 |
| 13/07 | 13 / 1,157,500 | 23 / 364,000 |
| 20/07 hadi 17/08 | 1–3 kwa wiki (54k–402k) | 11–23 kwa wiki (142k–338k) |
| 24/08 hadi 28/09 | 0, isipokuwa 06/09 (1 / 101,000) | 2–17 kwa wiki (44k–527k) |

Kwa mwezi, mikopo ya POS ni [Uhakika]:

| Mwezi | Idadi | Kiasi | Wateja | Zilizolipwa ndani ya siku 1 |
|---|---|---|---|---|
| Juni | 185 | 14.8M | 42 | 114 (62%) |
| Julai | 43 | 4.3M | 16 | 11 |
| Agosti | 7 | 0.30M | 5 | 0 |
| Septemba | 1 | 0.10M | 1 | 1 |

### C3. Code (git ya backend `Lsms/Lsms` na Flutter `lsms_frontend`, imesomwa hapa)
- **Karibu na 06/09** (30/08 hadi 10/09) kuna commit 1 ya backend (08/09, "..") na 2 za Flutter (06/09 "....", 08/09 "adding"). Hakuna hata moja yenye mabadiliko yanayohusu mkopo au madeni kwenye diff (credit, mkopo, MANUAL, creditLimit). [Uhakika]
- **Karibu na mwisho wa Juni / mwanzo wa Julai** kuna mabadiliko ya **kuonyesha** madeni tu, si ya kuunda mkopo [Uhakika]:
  - 29/06, Flutter 0e827b1 / 3a008af: recon inatenganisha "Mauzo ya Mkopo (POS)" na "Madeni ya Mkono (walk-in)".
  - 01/07, edd9d9b / f5c8dfe: ripoti mpya zenye safu ya "Mkopo".
  - 15/07: recon summary inatenganisha POS na madeni ya mkono.
- Commit za Flutter zinazogusa `lib/modules/sales` (23/06 hadi 29/06) ni:
  - lebo ya 'outstanding';
  - kubadilisha muonekano wa swichi ya "partial payment" (281c2ae, 28/06).
  Sikukuta badiliko la sheria ya kuuza kwa mkopo kwenye POS. (Inawezekana, kwa sababu commit nyingi zina ujumbe tupu "....", na nilizitafuta kwa maneno muhimu tu.)
- Sikukuta commit inayozuia mkopo wa POS. Kiwango cha mkopo bado kinaonya tu, hakizuii (kama ilivyoonekana kwenye uchambuzi wa awali).

### C4. Hitimisho la C
1. **Hakuna mabadiliko yoyote karibu na 06/09** [Uhakika].
   - Tarehe 06/09 ni mkopo **wa mwisho** wa POS, na ni mmoja tu (101,000, ulilipwa siku iliyofuata).
   - Kabla yake, Agosti ilikuwa na mikopo 7 tu ya POS.
   - Madeni ya MANUAL_RETAIL hayaonyeshi mruko wowote karibu na tarehe hiyo.
2. **Mabadiliko halisi yalitokea mwisho wa Juni / wiki ya 06/07** [Uhakika]:
   - Mikopo ya POS ilishuka kutoka 92 kwa wiki hadi 4.
   - Wakati huohuo madeni ya MANUAL_RETAIL yalianza (23/06) na kupanda.
3. **Je, mkopo ulihama kutoka POS kwenda MANUAL_RETAIL?**
   - Kwa **namna ya kurekodi**: ndiyo, kwa sehemu (Inawezekana).
     - MANUAL_RETAIL ilianza wiki ileile POS ilipoanza kushuka.
     - Leo 92% ya madeni yanayodaiwa (1.80M kati ya 1.96M) ni MANUAL_RETAIL.
   - Kwa **kiasi**: hapana (Inawezekana).
     - Juni POS ilikuwa 14.8M. MANUAL_RETAIL ya 06/07 hadi 28/09 ni ~4.2M tu.
     - 62% ya mikopo ya POS ya Juni ililipwa ndani ya siku 1. Inaonekana mingi ilikuwa **malipo yaliyochelewa kwa siku moja**, si madeni ya kweli.
     - Mtindo huo umeisha, haukuhamia MANUAL_RETAIL.
4. **Sababu ya mabadiliko** haionekani kwenye code (Kubahatisha, haijathibitishwa).
   - Muda unalingana na kuanza kwa madeni ya mkono kwenye recon (23/06 hadi 29/06), kwa hiyo huenda ni **uamuzi wa utendaji**: mkopo mpya uandikwe kwenye recon badala ya POS.
   - Hili linahitaji uthibitisho wako au wa cashier.

---

## Kinachohitajika ili kumaliza A na B
1. Nithibitishie **saa za kufunga na kufungua duka**.
2. Wakati huo, RAM inayopatikana lazima iwe > 400 MB. Sasa ni 173 MB kwenye server ya 914 MB, na swap tayari ina 465 MB.
   - Siruhusiwi kufanya restart, kwa hiyo huenda hata usiku hali isiwe nzuri.
   - Kama RAM bado iko chini, nitasimama tena na kukujulisha.
3. **Kumbuka:** server ina ~1 GB, si 2 GB. Hii inaeleza kwa nini swap thrashing imewahi kutokea.

Queries za C (zimeendeshwa kwenye backup, hapa):
```sql
-- C1 daily POS credit vs MANUAL_RETAIL, 2026-08-20..2026-09-29
with d as (select g::date dt from generate_series('2026-08-20'::date,'2026-09-29','1 day') g),
r as (select sale_date::date dt, coalesce(reference_type,'POS') src, count(*) n, sum(amount) amt
      from reconciliation_retail_debts where not is_deleted group by 1,2)
select d.dt, coalesce(p.n,0) pos_n, coalesce(p.amt,0) pos_amt, coalesce(m.n,0) mr_n, coalesce(m.amt,0) mr_amt
from d left join r p on p.dt=d.dt and p.src='POS' left join r m on m.dt=d.dt and m.src='MANUAL_RETAIL' order by 1;
-- C2 weekly trend
select date_trunc('week',sale_date)::date wk,
       count(*) filter (where reference_type is null) pos_n, sum(amount) filter (where reference_type is null) pos_amt,
       count(*) filter (where reference_type='MANUAL_RETAIL') mr_n, sum(amount) filter (where reference_type='MANUAL_RETAIL') mr_amt
from reconciliation_retail_debts where not is_deleted group by 1 order by 1;
-- C2b POS credit payback speed (last recon collection date - sale date)
with pos as (select sale_uid, sale_date::date sd, amount from reconciliation_retail_debts where not is_deleted and reference_type is null),
col as (select c.sale_uid, max(dr.reconciliation_date) last_col from reconciliation_debt_collections c
        join daily_reconciliation dr on dr.uid=c.reconciliation_uid where not c.is_deleted and not dr.is_deleted group by 1)
select date_trunc('month',sd)::date m, count(*), sum(amount), count(*) filter (where last_col - sd <= 1) paid_by_next_day
from pos left join col using(sale_uid) group by 1 order by 1;
-- A receivables split (balance truth = payments.outstanding_balance)
select coalesce(d.reference_type,'POS') src, count(distinct d.sale_uid), sum(p.outstanding_balance)
from (select distinct sale_uid, reference_type from reconciliation_retail_debts where not is_deleted) d
join payments p on p.sale_uid=d.sale_uid and p.is_active and not p.is_deleted
join sales s on s.uid=d.sale_uid and not s.is_deleted
where p.outstanding_balance>0 group by 1;
```
