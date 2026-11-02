# RIPOTI (cf) — 02/11/2026

nimesoma hadi (cf).

**Marekebisho ya ripoti (cd/ce):** mabadiliko ya kikao cha 19:01 hayakuwa kwenye `release/2.4.0` kama nilivyoandika. Yalikuwa kwenye tawi **`feature/tarehe-eat`** (worktree Lsms-release-240), juu ya 68fe8b2.

## 1. Diff isiyocommitiwa → commit (asili imetajwa kwenye kila ujumbe)

| repo / tawi | commit | faili | asili |
|---|---|---|---|
| backend feature/tarehe-eat | `bd554c9` | deploy/local/pg-checks.sh, uaa/config/WebConfig.java, uaa/config/EatLocalDateTimeDeserializer.java (mpya), test uaa/config/EatLocalDateTimeDeserializerTest.java (mpya), test uaa/config/TarehePgCheck.java (mpya) | kikao kingine 19:01–19:06 (kimefungwa); kimekaguliwa hapa |
| backend feature/tarehe-eat | `3af0a18` | uaa/config/ClientDateGuard.java (mpya), Sales/Entity/Sales.java, Purchase/Entity/Purchase.java, test ClientDateGuardTest.java (mpya), TarehePgCheck.java | kikao hiki, (cf) |
| backend release/2.4.0 | **`0d8463c`** | merge --no-ff ya feature/tarehe-eat | |
| V3 release/3.2.0 | `ed5544e` | deploy/local/e2e/b1_e2e.cjs, features/sales/sale-changes-dialog.ts | kikao hiki, (ce) |
| V3 feature/v3-onyo-manunuzi | `f515abb` | purchases.models.ts, cost-jump.spec.ts (mpya), repurchase-page.ts/.html/.scss, e2e/onyo_e2e.cjs (mpya) | kikao hiki, (bo/cf) |
| V3 release/3.2.0 | `9b3044e` | merge ya onyo | |
| V3 feature/v3-b5 | `7b484eb` | e2e/b5_e2e.cjs (mpya) | kikao hiki, B5 |
| V3 release/3.2.0 | **`af56318`** | merge ya B5 | |
| V3 main | (commit ya ripoti hii) | analysis/MAAGIZO.md (cd, ce, cf), toleo2/RIPOTI-CD-CE-02-11.md, toleo2/RIPOTI-CF-02-11.md | kikao hiki |

Worktree nyingine zote za backend (Lsms, -a3, -a5, -a6, -jwt, -ops-logs) na lsmsFrontV3-ops-logs: 0 mabadiliko.

## 2. Tarehe ya client > dakika 15 mbele: haikataliwi

- `ClientDateGuard.notAhead()` inaitwa kutoka setter za entity: `Sales.setSaleDate`, `Purchase.setPurchaseDate`, `Purchase.setInvoiceDate`.
  - Kwa hiyo kila njia inapita hapo: kuunda, kuhariri, upatanisho, exchange na bulk.
  - Inapita kabla mwendo wa stock haujajengwa kutoka `sale.getSaleDate()`.
  - Hibernate inatumia field access, kwa hiyo kusoma safu kutoka DB hakuiiti.
- Tarehe ikiwa > saa ya server (EAT) + dakika 15, saa ya server ndiyo inahifadhiwa, na log `AUDIT.TAREHE_YA_MBELE` inaandika WARN:
  `TAREHE_YA_MBELE field=purchases.purchase_date tarehe_ya_client=… saa_ya_server=… mtumiaji=… -> imehifadhiwa saa ya server`
- Tarehe ya nyuma, hadi +15 min, na null zinabaki kama zilivyoingizwa.
- Majaribio:
  - **ClientDateGuardTest 2/0:** +1h, +3h na +1 siku → saa ya server + WARN; −3 siku, −5h, +15 min na null → zinabaki. Mutation (kinga imezimwa): 1/1.
  - **TarehePgCheck 2/0 (PG15):** +1h kupitia mapper ya HTTP → `PurchaseDto.toEntity()` → `purchases.purchase_date` = saa ya server, pamoja na WARN. 2026-07-01 18:33:11 (nyuma) → inabaki.

## 3. Lango kwenye build ya mwisho

| | build | matokeo |
|---|---|---|
| `mvnw test` (suite nzima) | backend 0d8463c | **Tests run 565, Failures 0, Errors 0, Skipped 1**, BUILD SUCCESS |
| `pg-checks.sh` | 0d8463c | **PG_CHECKS_OK 5/5** (LoanSql 4/0, SaleChange 4/0, PnlBridge 1/0, StockValue 1/0, Tarehe 2/0) |
| image | `lsms-backend:local-0d8463c` | sha256:845172f04aa2c0cf417f201e454be8d5955f7a1d89b77c4ea02ea038cd55666f |
| run-all (nakala mpya, Flyway 138) | V3 ed5544e | **E2E_OK 6/6** (b1 29, b2 22, b3 38, b4 11, mabango 10, sababu 20) |
| vitest | V3 9b3044e | **13 files, 85/85** |
| run-all (nakala mpya) | V3 9b3044e | **E2E_OK 7/7** (+ onyo 10) |
| run-all (nakala mpya, Flyway 138) | V3 **af56318** + backend 0d8463c | **E2E_OK 8/8** (b1 29, b2 22, b3 38, b4 11, b5 11, mabango 10, onyo 10, sababu 20) |

## 4. Onyo la manunuzi (B) — release/3.2.0 9b3044e

- **Repurchase:** gharama kwa kipande ikizidi ×3, au ikiwa chini ya ⅓, ya ununuzi wa mwisho:
  - mstari unaonyesha "Bei kwa kipande ×N ya mwisho — kreti au chupa? Kagua aina na bei.";
  - "Tuma agizo" inaleta dialogi "Kreti au chupa?" yenye orodha (bidhaa, bei/kipande, ×N, bei ya mwisho);
  - **Rekebisha** = hakuna kinachotumwa; **Bei ni sahihi — tuma** = inatumwa. Haikatai.
- ⅓ ni kioo cha ×3 (bei ya chupa iliyoandikwa kama kreti), kama hatua 62(g).
- Fomu ya ununuzi wa kwanza haina bei ya mwisho, kwa hiyo haina onyo.
- Majaribio:
  - vitest `cost-jump.spec` 3/0 (Jagger kreti kama chupa ×12, chupa kama kreti ÷12, mipaka ×3 na ⅓).
  - `onyo_e2e` 10/0. Bulk inazuiwa, kwa hiyo hakuna manunuzi mapya kwenye DB.
  - Baseline kwenye build ya zamani: O2 na O3 FAIL.

## 5. B5 — vitufe vya kuandika kwa FINANCE_WRITE tu — release/3.2.0 af56318

- Ukaguzi: endpoints zote za `FINANCE_WRITE` (GLController 13, mikopo 5) zinaitwa na V3 kutoka gl-journal, gl-overview, gl-periods na loans-tab. Zote tayari ziko ndani ya `canWrite()`, kwa hiyo **hakuna msimbo wa app uliobadilishwa**.
- `b5_e2e` 11/0 kwa roles halisi za nakala:
  - CEO (READ+WRITE) anaona vitufe: journal 2, vipindi 10, muhtasari 4, mikopo 7.
  - **Executive CEO** (jess, READ tu) anaona kurasa zilezile bila kitufe chochote cha kuandika.
  - Server inatoa 403 kwa POST /gl/transfers ya Executive CEO.
- Mutation (kinga ya gl-journal imeondolewa): 10/1.

## 6. Push — tayari kwa `analysis\steps\push-yote.cmd` (haijabadilishwa)

Inapush release/2.4.0 (backend), release/3.2.0 na main (V3). Haitumii force; inakataa push isiyo fast-forward. Ukaguzi wa kusoma tu (fetch + ls-remote + is-ancestor): matawi yote 3 ni **fast-forward**. push-yote itapita bila force. Iendeshe mara moja: `analysis\steps\push-yote.cmd`, andika `push`, kisha nitumie `push-yote.log`.

Matawi ya feature (tarehe-eat, v3-onyo-manunuzi, v3-b5) hayapushwi. Yameshaunganishwa kwenye release.

## 7. Inayofuata

Kifurushi B na C kwa mpangilio wa orodha (be): C1… Nasubiri log ya push-yote.

## origin dhidi ya local

| repo | tawi | local | origin | hali |
|---|---|---|---|---|
| Backend | release/2.4.0 | 0d8463c | 0d1ee71 | TOFAUTI, FF, commit 10 mpya |
| Backend | main | c98fa07 | c98fa07 | SAWA |
| V3 | release/3.2.0 | af56318 | c540ab8 | TOFAUTI, FF, commit 7 mpya |
| V3 | main | commit ya jedwali hili (juu ya 6ebede6) | 998dad6 | TOFAUTI, FF, commit 16 mpya |
