# RIPOTI (cd) + (ce) + (cc) — 02/11/2026

nimesoma hadi (ce).

## 1. (cd) b1 D3/D4: aina ya kosa

**Ni assertion ya thamani, si timeout.** Hakuna `ERROR` wala TimeoutError, na run iliendelea hadi mwisho.

Mistari ya (ca) (out/b1_e2e.log iliandikwa juu; nimeipata kwenye transcript ya kikao cha (ca), `MUHTASARI b1_e2e: PASS 25, FAIL 2`):
```
FAIL D3 Kagua: mauzo, mtumiaji na sababu 
FAIL D4 Kagua: S1 "Imerudishwa → #<mpya>" 021126-…
```
b1×10 ya kwanza (nakala ileile, bila nakala safi): 8/10.
- Run 9: `FAIL D3`, `FAIL D4 … 021126-1915-2`, `FAIL D5 Kagua: S2 "Haijarudishwa"`.
- Run 10: `FAIL A1 dialogi ya sababu inaeleza kanuni ""`.

**Chanzo:**
- Kagua huonyesha skeleton (`loading=true`) mpaka `/pending` ijibu.
- Jaribio lilisoma `innerText` mara tu dialogi ilipoingizwa, kwa hiyo lilisoma skeleton.
- A1 ilikuwa na tatizo lilelile kwenye dialogi ya sababu.
- Kosa halihusiani na "run ya kwanza baada ya nakala safi": run 9 ilikuwa ya tisa kwenye nakala ileile.

## 2. (ce) Marekebisho — V3 release/3.2.0 worktree (HAYAJACOMMITIWA)

**Jaribio `deploy/local/e2e/b1_e2e.cjs`:**
- A1 inasubiri maandishi ya kanuni (`approved|imeidhinishwa`) kabla ya kusoma.
- D inasubiri `li` yenye S1 kwenye Kagua kabla ya kusoma.
- **D2a (mpya):** `/pending` imechelewa 3 s (route delay) wakati Kagua inafunguliwa. Wakati skeleton inaonekana, "Nimeona" haibofyeki.
- **D2b (mpya):** maelezo yameshaandikwa, Siku 30 → Zinasubiri, na `/pending` imechelewa 3 s. "Nimeona" bado haibofyeki mpaka orodha mpya ifike.

**App `src/app/features/sales/sale-changes-dialog.ts`:**
- "Nimeona" ni `[disabled]` wakati `loading()`.
- `ackAll()` haifanyi kitu wakati `loading()`.

Kosa la app lilikuwa halisi. Kitufe kilionekana kwa orodha ya zamani ya banner, na maelezo yakishaandikwa kingeweza kuweka "Nimeona" kabla orodha mpya haijafika. Banner ina kitufe kimoja tu ("Kagua", kinafungua dialogi), hakuna cha kuthibitisha.

**Baseline (build ya zamani 1ca9b04, jaribio jipya):** 28/1. Ni D2b peke yake iliyoshindwa: `FAIL D2b … {"loadingSeen":true,"seenLocked":false}`. Kwa hiyo jaribio linakamata kosa.

**Lango (build mpya 1ca9b04 + mabadiliko, backend local-68fe8b2):**
- Nakala mpya: `local.sh down` → `up` (dump 29/10 10:27, Flyway 138, 0 zilizoshindwa).
- Run ya kwanza kwenye nakala mpya: **29/0**.
- b1×10: **10/10**, kila run 29/0 (sekunde 35–37).
- Log: scratchpad `b1ce/` (first-fresh.log, run1..10.log, baseline-old.log).

run-all yote (b2, b3, b4, mabango, sababu) haijaendeshwa kwenye build hii. b1 peke yake ndiyo iliyoagizwa.

## 3. (cc) Saa — kusoma tu, nakala ya Docker-local (dump lsms_20261029_1027), `created_at < 2026-10-29 10:30`

**Chanzo kikuu: JVM ya prod ilikuwa UTC mpaka 17/06** (Dockerfile `TZ=Africa/Dar_es_Salaam`, d61de27, 2.1.54).

Kipimo: EC2 huzimwa 00–07 EAT, na `store.created_at` kwa wiki inaonyesha:

> **Sahihisho (co, 03/11):** prod sasa iko **Contabo na inafanya kazi saa 24**; haizimwi usiku. Hitimisho la TZ halibadiliki,
> kwa sababu linasimama juu ya kuhama kwa saa za mauzo (saa 4–6 → 21–23) tarehe 17/06, si juu ya server kuzimwa.

| wiki | saa 4–6 | saa 21–23 |
|---|---:|---:|
| 01/06 | 379 | 0 |
| 08/06 | 305 | 0 |
| 15/06 | 85 | 77 |
| 22/06 | 0 | 161 |
| 06/07 | 0 | 200 |

Siku kwa siku: 16/06 saa 05:30–07:13 tu, na 18/06 mpaka 23:08. Mabadiliko yalifanyika mchana wa 17/06.

- **Kabla ya 17/06:** kila muhuri wa server (`created_at`, `movement_date` za `now()`, `purchase_date` ya bulk repurchase) uko nyuma ya EAT kwa 3h. Tarehe zilizotumwa na client (Flutter `DateTime.now().toIso8601String()`, EAT) zilikuwa sahihi, ndiyo maana zinaonekana +3h dhidi ya `created_at`.
- **Baada ya 17/06:** kila kitu ni EAT. Kuna tukio moja tu: HENNESY 01/07, ambapo client ilituma 21:33 wakati server ilikuwa 18:34.

**Histogram 2026 (x − created_at):**

| jedwali | ~0 | ~+3h | ~−3h | nyingine |
|---|---:|---:|---:|---|
| store.movement_date | 16,743 | **1** (PURCHASE, HENNESY) | 0 | −24h..0: 43 |
| purchases.purchase_date | 2,091 | **125** (Feb 68, Mar 39, Apr 10, Mei 6, Jun 1, Jul 1) | 0 | — |
| purchases.invoice_date | 1,066 | 125 (nakala ya purchase_date, V105 04/07; null tangu 05/07) | 0 | null 1,025 |
| sales.sale_date (STANDARD) | 1,208 | **305** (Feb 4, Apr 80, Mei 159, Jun 62; mwisho 14/06) | 0 | ≤ −1 siku 920 (mauzo ya tarehe ya nyuma, kawaida) |
| sales (RECONCILIATION_MANUAL) | — | 0 | 0 | ≤ −1 siku 249 |

- Purchases zote 125 za +3h zina `invoice_date`, ziko INDIVIDUAL/WHOLE na PER_PIECE/TOTAL, approved_by root 77 na tarimo 45. Hakuna njia moja maalum: ni Flutter (saa ya client) dhidi ya `created_at` ya UTC.
- **Zilizoangukia siku nyingine:**
  - +3h ya client: 0. Hakuna iliyovuka usiku wa manane.
  - Muhuri wa server kabla ya 17/06 wenye saa 21–23 UTC (= 00–02 EAT ya siku inayofuata): **58 mwendo wa store (SALE 50, ADJUSTMENT 8)**. Zimewekwa siku iliyotangulia.
  - Sales na purchases: 0.
- Mwendo wa PURCHASE uliopangwa vibaya kwa `movement_date` (aina ya HENNESY): 1. `stockValueAt` kwa id-order (68fe8b2) unaukinga.

**Marekebisho ya chanzo, backend worktree Lsms-release-240, tawi `feature/tarehe-eat` (HAYAJACOMMITIWA; sahihisho la (cf): si release/2.4.0).** Yaliandikwa na kikao kingine leo 19:01–19:06. Nimeyasoma, sijayabadilisha, na nimeyathibitisha:
- `EatLocalDateTimeDeserializer` + `WebConfig.eatDates()`: LocalDateTime ya ombi isiyo na zone inahifadhiwa kama ilivyoingizwa (EAT). Yenye `Z` au offset inabadilishwa kuwa EAT. Kabla ya hapo Jackson ilitupa `Z` (10:00Z → 10:00) na ilikataa `+03:00`.
- **Unit `EatLocalDateTimeDeserializerTest`: 3/0.** Mutation (bila `eatDates()`): 2/1 (`expected 13:00`). WebConfig imerejeshwa (hash b40a9daf ileile).
- **`TarehePgCheck`** (JVM EAT, PG15 tupu, kupitia mapper ya HTTP ya app, kisha `purchases.purchase_date` inasomwa kama maandishi):
  - Kesi 5: isiyo na zone, .680, Z, +03:00, na Z ya kuvuka siku.
  - Imeongezwa kwenye `pg-checks.sh`. **PG_CHECKS_OK 5/5.**
- `mvnw test` (suite nzima) **haijaendeshwa** kwenye mabadiliko haya.

Kinga ambayo haijaongezwa (pendekezo, inahitaji uamuzi): kukataa tarehe ya client iliyo zaidi ya dakika 15 mbele ya saa ya server. Kinga hiyo ingezuia HENNESY.

## 4. Inayofuata

Onyo la manunuzi, kisha B5. Kabla ya kuunganisha: run-all ya V3 yote na `mvnw test` ya backend kwenye build ya mwisho.

## origin dhidi ya local

| repo | tawi | local | origin | |
|---|---|---|---|---|
| V3 | main | 4442e88 | 998dad6 | TOFAUTI (origin nyuma) |
| V3 | release/3.2.0 | 1ca9b04 (+ mabadiliko yasiyocommitiwa) | c540ab8 | TOFAUTI (origin nyuma) |
| Backend | main | c98fa07 | c98fa07 | SAWA |
| Backend | release/2.4.0 | 68fe8b2 (mabadiliko yasiyocommitiwa yako kwenye feature/tarehe-eat) | 0d1ee71 | TOFAUTI |
