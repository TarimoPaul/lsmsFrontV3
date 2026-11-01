# Ripoti (bh) — 01/11/2026

nimesoma hadi (bh)

## 1. Malipo ya Loan A 04/11 kwenye prod ya leo (2.3.0 + 3.1.11): NJIA IPO

- **Endpoint:** `POST /api/v1/capital-monitoring/loans/INJ-0c98b69e-67de-4e66-98c3-8bf6ace52637/repay`, ruhusa `FINANCE_WRITE`.
- **Payload:** `{ amount: 386000, principal_amount: 386000, interest_amount: 0, payment_method: "CASH", transaction_date: "2026-11-04T12:00:00", notes }`.
  `interest_amount > 0` inakataliwa (M-15). `principal_amount` tofauti na `amount` pia inakataliwa.
- **Journal:** Dr 2100 / Cr **1000**. `gl_config.bank_cutover_date` bado haijawekwa (hatua 60 haijaendeshwa), kwa hiyo `LoanService.repaymentAccount` inarudisha 1000.
- **Ratiba inasasishwa:** `allocate()` inagawa malipo FIFO kwenye awamu. Awamu 1 (04/11, 386,000) inakuwa `PAID`; awamu 2 na 3 zinabaki `UNPAID`.
  Deni (2100) linashuka 1,158,000 → 772,000. Riba (1150 → 6600) inaendelea kwa ratiba. Mkopo unabaki ACTIVE.
- **Tarehe ya nyuma:** backend inakataa tarehe ya **baadaye** tu ("haiwezi kuwa ya baadaye"); tarehe ya nyuma inakubaliwa.
  - **Tahadhari (kosa la kimya):** kipindi kikiwa CLOSED, `PostingEngine.firstOpenDate` **inahamisha** journal kwenda siku ya kwanza iliyo wazi, bila kukataa. Kwa hiyo hatua 61 inakagua kwamba Novemba ni OPEN kabla ya POST.
- **V3 3.1.11 pia inaweza** (Mtaji → Mikopo → Lipa): principal 386,000, riba tupu, CASH. Lakini haina preview, haina kinga ya kurudia, na kitufe kinaonekana kwa CAPITAL_WRITE ingawa backend inataka FINANCE_WRITE. **Pendekezo: tumia hatua 61.**
- **Hakuna journal ya mkono.**

### Hatua 61 — `analysis\steps\61-lipa-mkopo.cmd` (+ `61-lipa-mkopo.mjs`)

Ni API tu: hakuna ssh na hakuna DB ya prod. Akaunti ni ya CEO (`tarimo@gmail.com`), kwa sababu ndiyo pekee yenye FINANCE_WRITE. Root inakataliwa.

1. **Mwendesho wa 1 → KAGUA** (haiandiki). Inathibitisha:
   - A iko ACTIVE, deni 1,158,000, repaid 0;
   - awamu 3 zote UNPAID; hakuna malipo wala journal ya LOAN_REPAYMENT;
   - Novemba OPEN; TB = 0.
   Kisha inaonyesha POST itakayotumwa na kuishia `---SIMAMA-PREVIEW---` 🛑. Nitumie log.
2. **Mwendesho wa 2** (tarehe 04/11 au baadaye, KAGUA ya siku hiyo hiyo) → andika `LIPA`. Inafanya hivi:
   - inathibitisha tena kwamba hali = ya kagua;
   - inatuma POST **moja**;
   - inakagua: deni 772,000, repaid 386,000, awamu `1 PAID / 2-3 UNPAID`, journal ya 04/11 `2100 Dr 386,000 / 1000 Cr 386,000`, 2100 +386,000, TB 0;
   - inaishia `---OK---`.
3. **Kinga:**
   - Ikiendeshwa tena baada ya malipo, **hailipi tena** (inakagua tu).
   - Ikiwa POST ilianza lakini malipo hayaonekani, inasimama ("usijaribu tena").
   - Kabla ya 04/11 inakataa.
4. **Majaribio** (fake API inayofuata `LoanService.repay` ya v2.3.0):
   - mjs **15/0**;
   - cmd yenyewe **14/0** (nakala yenye password bandia);
   - control/mutations **4/4 zimekamatwa**: POST mara mbili, tarehe ya baadaye, hali iliyobadilika, Novemba CLOSED.
   - Mutations m1–m3 ziliendeshwa kabla ya ukaguzi wa Novemba kuongezwa; m4 iliendeshwa baada yake.
5. **Fedha:** 386,000 zinatoka 1000 (CASH ya biashara). Zikitoka kwenye droo ya siku, reco ya 04/11 itaonyesha upungufu. Ni uamuzi wako zitoke wapi.

## 2. Majaribio ya A6 kwenye mvn test

- **`SaleChangePgCheck`** (gated `-Dsale.change.pg.check=true`, kama LoanSqlPgCheck): **PG15** tupu, beans halisi, na HTTP kwa login/ruhusa halisi. Inaendesha V138 mara mbili. Matokeo **4/0**:
  - `replaces_sale_uid` na ukaguzi wa "Tengeneza upya": iliyofutwa = sawa; hai = kukataliwa; haipo = kukataliwa (hii ndiyo bug ya "not found");
  - orodha ya deleted inarudisha mistari ya mauzo (`findDeletedByUidsWithDetails`);
  - Nimeona kwa kila mkaguzi: pending, ack mara moja tu, REFUSED haiwezi ku-ack-iwa, `seen_by`, `remade_as`, summary;
  - SALE_DELETE_REVIEW ni ya CEO tu; Executive CEO 403; MANAGER bila ruhusa 403; `isCeo()`.
- **Mutations 7/7 zimekamatwa:** Optional.map; mistari ya deleted; isActive; ack kwa kila mkaguzi; isCeo LIKE; V138 LIKE '%CEO%'; remade_as. Baseline na mwisho ni 4/0.
- **`SaleReplacesCheckTest`** (unit, kwenye suite ya kawaida): 4 tests; control ya bug imekamatwa.
- **Namba mpya:** release/2.4.0 = **4c614d6**, `mvnw test` = **546/0, skip 1** (542 + 4). PG check kwenye 4c614d6 = 4/0.
  PG checks zinahitaji DB ya kutupwa, kwa hiyo haziko kwenye 546, sawa na LoanSqlPgCheck. DB ya majaribio ni container `lsms-a6-pg` (:55439); niambie niifute.

## 3. Sehemu ya ripoti ya B1 iliyokatika (baada ya "dhidi ya backend Docker-local")

… (release/2.4.0 c2050a4, PG15, nakala ya prod ya 29/10). Hii ndiyo sehemu iliyokosekana; namba ni za 31/10 na sikurudia mwendesho leo.

- **Majaribio (b1_e2e.cjs, Playwright kwenye production build `deploy/local/v3-local.sh`, 127.0.0.1:4300/v3): 27/0.**
  - A1–A5 — kufuta kunahitaji sababu: dialogi inaeleza kanuni; sababu fupi inazima kitufe; toast inaonyesha `#audit`; DB `deleted_by` = MANAGER halisi (si "System").
  - B1–B2 — reco APPROVED: kukataliwa na ujumbe wa upatanisho; mauzo yanabaki hai.
  - C1–C6 — hakuna Restore. "Tengeneza upya" inajaza POS na kuonyesha "Badala ya <risiti>" na bei ya zamani pembeni. Mauzo mapya yana `replaces_sale_uid` na maelezo "Badala ya mauzo yaliyofutwa: …".
  - D1–D8 — banner ya mkaguzi haina kitufe cha kufunga. Kagua inaonyesha mauzo/mtumiaji/sababu na "Imerudishwa → #X" / "Haijarudishwa". Nimeona inahitaji maelezo; banner inaondoka baada ya Nimeona.
  - E1–E5 — banner inafuata RUHUSA: MANAGER bila ruhusa haioni; akipewa SALE_DELETE_REVIEW kupitia API ya roles anaiona; Nimeona ya CEO haimfichii MANAGER; CEO hana banner tena.
  - Z — hakuna JS error.
- **Maandalizi ya majaribio** yaligusa nakala ya local tu: password za majaribio, tarehe ya counting kurudishwa nyuma, na bei moja kubadilishwa.
- **Merge:** feature/v3-a6 (cc00f08 → cbe0103 → 961d326) → release/3.2.0 **d800cd8** baada ya majaribio yote kupita. Faili 22, +698/−68: sale-reason, remake.store, sale-changes-banner/dialog/service, deleted-sales-dialog, pos-page, deploy/local (V3 Docker-local).
- **Bado:** B1 lazima iende prod pamoja na 2.4.0 katika dirisha moja. 3.1.11 haitumi sababu, kwa hiyo 2.4.0 ingekataa kufuta.

## 4. "Executive CEO" na LOGIN_AUDIT_VIEW

Nakala ya Docker-local ya dump ya prod ya 29/10, Flyway 138; nimesoma tu.

| Role | Mtumiaji |
|---|---|
| CEO | **Paul Tarimo** — tarimo@gmail.com |
| Executive CEO | **Jess Saimon** — jess@elikom.co.tz |
| MANAGER, SALES | macheda@gmail.com |
| printer | printer@elikom.co.tz (dump ni ya kabla ya 71e kuizima) |

- **LOGIN_AUDIT_VIEW, SALE_DELETE_REVIEW na FINANCE_WRITE:** role ya **CEO peke yake**, yaani mtumiaji mmoja: tarimo@gmail.com. Executive CEO haina hata moja kati ya hizo.
- Root (root@system.com) inapita kila ukaguzi kwa is_root, kama muundo unavyosema.
- **Swali:** "Chief" = Paul Tarimo (tarimo@gmail.com)? Kama ni mtu mwingine, hana role ya CEO kwenye prod.

## 5. Staging: DB-IP halisi

Nimeongeza kipengele **8.n** kwenye `analysis/toleo2/MUUNDO-LOGIN-AUDIT.md`.

- **PC:** `GeoIpRealDbCheck` inaendesha GeoIpService/ClientIpResolver halisi juu ya faili halisi za DB-IP Lite. Matarajio:
  - Cloudflare AS13335 → VPN;
  - Vodacom TZ AS36908 na Airtel TZ AS37133 → TZ, NORMAL (IP zinachukuliwa kutoka log ya nginx ya prod; ripoti inaonyesha /24 tu);
  - Contabo AS51167 na Scaleway AS12876 → DATACENTER;
  - edge ya CF + CF-Connecting-IP → IP ya mteja; bila edge → DIRECT.
- **Staging:** faili zenye sha256 ileile ya PC, log ya boot inaonyesha zimesomwa, login moja kupitia tunnel, hali-root kabla na baada. Kikishindwa, prod haianzi.
- `GeoIpRealDbCheck` bado haijaandikwa. Itaandikwa pamoja na script ya staging.

## Kinachofuata

B3 (kadi ya mkopo + Lipa mkopo + PUT ya maelezo).
