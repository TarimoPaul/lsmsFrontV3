# RIPOTI (cg) — 02/11/2026

nimesoma hadi (cg).

Sahihisho: kwenye (cf) sikuandika "njia 3 za manunuzi". "Kila njia" ya §2 ilihusu **tarehe** (kuunda, kuhariri, upatanisho, exchange, bulk). Hata hivyo njia za manunuzi ni kweli 3, na zote sasa zina onyo.

## 1. Njia zote za kuingiza manunuzi (V3 → backend)

| # | njia ya V3 | endpoint | kipimo cha onyo | hali |
|---|---|---|---|---|
| 1 | Repurchase (`/purchases/repurchase`; pia "Repurchase" ya upatanisho na "Nunua tena") | `POST /purchases/repurchase/bulk` | gharama/kipande ya ununuzi wa mwisho | ilikuwepo (f515abb) |
| 2 | "Manunuzi mapya" (ununuzi wa kwanza wa bidhaa) | `POST /purchases` | ununuzi wa mwisho; usipokuwepo, wastani wa gharama Stoo | **mpya** |
| 3 | "Hariri" (ununuzi PENDING) | `PUT /purchases/{uid}` | ununuzi wa mwisho (template) | **mpya** |

- Endpoints nyingine za backend (`POST /repurchase/create`, `PUT /purchases/bulk`) hazitumiwi na V3. Flutter (iliyozimwa 15/10) ilitumia `/repurchase/bulk`.
- Onyo ni lilelile kwenye njia zote:
  - mstari wa onyo kwenye fomu au kapu;
  - dialogi "Kreti au chupa?" kabla ya kutuma (maandishi ya pamoja, `cost-jump-confirm.ts`);
  - **Rekebisha** au **Bei ni sahihi — tuma**. Haikatai.
- **Kikomo:** kwenye nakala kuna bidhaa 3 tu ambazo hazijawahi kununuliwa, na hakuna hata moja yenye wastani wa gharama. Kwa hiyo ununuzi wa kwanza halisi hauna kitu cha kulinganisha, na onyo halitatokea.

**Majaribio:**
- vitest `cost-jump.spec` 5/0.
- `onyo_fomu_e2e` **16/0 mara mbili**:
  - Kuhariri: gharama halisi ya mwisho. PENDING moja inaundwa kwenye nakala ya kutupwa na kufutwa mwishoni; PUT inazuiwa.
  - Ununuzi mpya: wastani wa Stoo umewekwa kwa route mock kwa bidhaa moja; POST inazuiwa.
  - DB haibadiliki.
- Baseline kwenye af56318: H2/H3 FAIL.
- `onyo_e2e` (Repurchase) 10/0 baada ya kuhamisha dialogi kwenye msaada wa pamoja.
- release/3.2.0 = 7849e6a: vitest 13 files 87/87. run-all ya kwanza kwenye nakala mpya: **onyo_fomu 14/2** (H3, N3).
  - Chanzo: race ya jaribio. Dialogi ilikuwepo, lakini maandishi yake yalisomwa kabla hayajaonyeshwa (aina ileile ya (cd)). App haina kosa.
  - Marekebisho: jaribio linasubiri maandishi "Kreti au chupa?" yenyewe (pia O3 ya onyo_e2e).
  - Kisha onyo_fomu 10/10 (16/0) na onyo 5/5 (10/0) → `0df2ffe`, release/3.2.0 = **28afa80**.

## 2. Jagger 07/09 na 22/09 — njia inajulikana

- **Njia:** Repurchase ya Flutter, `POST /purchases/repurchase/bulk` → `createPurchaseFromTemplate`.
  - Ushahidi: `purchase_notes` = "Re-purchase with custom values (based on purchase: …)".
  - Ankara kwenye `repurchase_invoice_items` sekunde 3 baadaye ("Jumla" = WHOLE_PACKAGE).
  - Mtumiaji: tarimo@gmail.com, kwenye kapu moja na Jagger nyingine 3 (07/09 14:51:41).
- JAGGER MASTER 1L ilirekodiwa **kreti ya 6** tangu ununuzi wake wa kwanza:

| tarehe | aina | bei | gharama/kipande |
|---|---|---:|---:|
| 22/06 (×2) | WHOLE_PACKAGE | 51,000 | 8,500 |
| 07/09 | WHOLE_PACKAGE | 53,000 | 8,833.33 |
| 22/09 | WHOLE_PACKAGE | 53,000 | 8,833.33 |
| 11/10 | INDIVIDUAL_PIECES | 53,000 | 53,000 |

- **Kanuni ya ×3 ya mwisho isingekamata 07/09 wala 22/09** (×1.04 ya mwisho, kwa sababu kosa lilikuwepo tangu mwanzo). Ingekamata 11/10 tu (×6).
- **Pendekezo (linahitaji uamuzi):** kanuni ya pili, gharama/kipande dhidi ya **bei ya kuuza kipande**.
  - Mfano: gharama < ⅓ ya bei ya kuuza (faida > 67%), au gharama > bei ya kuuza, inaleta onyo lilelile.
  - Jagger 1L: 8,833 dhidi ya bei ya kuuza 60,000 (faida 85%) ingekamatwa tangu 22/06.
  - Kadirio: saa 2–3 pamoja na e2e. Sijaifanya.

## 3. Makadirio (siku za kazi, majaribio yakiwemo)

**C2 — 2.5 hadi 3.5 siku.**
- Kwenye msimbo wa sasa kuna mifumo 147 ya `:x IS NULL` kwenye faili 21.
- Mbinu za repository zinazorudisha `Object[]`: 163 kwa grep pana. Zile 20 za orodha ya awali ni sehemu yake.
- Kazi:
  - Harness inayoita kila query kwa beans halisi kwenye PG15 ya Docker-local (data ya prod), kwa param null na zisizo null: siku 1.
  - Marekebisho ya zitakazovunjika (idadi haijulikani kabla ya harness): siku 1–2.
  - PG check kwenye gate: nusu siku.

**C4 — 3 hadi 4 siku.**
- Backend `feature/sales-returns` (9425223) iko juu ya 2.2.71: faili 20, +628. release/2.4.0 imeenda mbali tangu hapo (faili 119, +10.7k).
- Faili 6 zinagongana: SaleService, ReconciliationService, PostingEngine, SalesController, SalesDto, SaleServiceDeletionTest.
- V3 `feature/sales-returns` (e199712) iko juu ya 3.1.11: faili 12, +834.
- Kazi:
  - Kuhamisha juu ya release: siku 1.
  - Migration V135 → namba mpya.
  - Feature flag (backend + V3, default OFF): nusu siku.
  - Majaribio upya (54 backend + 23 UI e2e kwenye Docker-local, pamoja na PG check): siku 1.5–2.

**Kilichobaki chote mpaka 16/11** (leo 02/11, siku 14 za kalenda):

| kipengele | siku |
|---|---:|
| C1 usanidi kwenye git | 0.75 |
| C2 | 3 |
| C3 chanzo cha malipo ya msambazaji | 1.25 |
| C5/C8 orodha kwanza, kisha zilizoidhinishwa | 2 (haijulikani hadi orodha) |
| C4 | 3.5 |
| C6 backup_20260930_journal_entry → B2 + DROP | 0.5 |
| C7 code iliyokufa + mpango wa kuondoa Flutter | 1 |
| C9 ssh -n | 0.1 |
| skripti moja ya staging + moja ya prod kwa kifurushi chote, pamoja na staging | 2 |
| **jumla** | **≈ 14** |

**Jumla ni > siku 12. Pendekezo: C4 itoke kwenye batch.**
- Hata ikikamilika, ingekuwa nyuma ya flag OFF, kwa hiyo haileti thamani kwenye toleo hili.
- Ina hatari kubwa zaidi: migongano kwenye SaleService, upatanisho na PostingEngine, na inagusa GL.
- C7 (SaleReturnService iliyokufa) inabaki.
- Bila C4: ≈ siku 10.5, ikiacha nafasi ya siku 1.5 kwa C5/C8.

## 4. C1 — usanidi kwenye git (IMEKAMILIKA, release/2.4.0 = **baf4e31**, feature/c1-usanidi 087a490)

**Kabla:** `application.properties` ilikuwa kwenye `.gitignore`. Image ya prod ilijengwa na nakala isiyofuatiliwa ya worktree ya main, kwa hiyo Flyway `out-of-order=true`, `validate-on-migrate=false`, `baseline-version=38`, `profiles.group.prod=pro`, Jackson, hikari na logging hazikuwa kwenye git. Flyway inawashwa na env `SPRING_FLYWAY_ENABLED=true`.

**Sasa:**
- `application.properties` inafuatiliwa.
- Siri zinatoka env tu, bila default: `${DB_PASSWORD}`, `${JWT_SECRET}`, `${ROOT_PASSWORD:}`. URL ya DB ni `${DB_URL:…localhost…}`.
- Dev inapata siri kutoka `./application-local.properties`: iko kwenye `.gitignore`, ni faili la diski (haiko ndani ya jar), na inaingizwa kwa `spring.config.import=optional:file:…`.
  - Thamani za dev (password ya DB, herufi 4; jwt.secret, herufi 88) zimehamishiwa humo bila kuchapishwa.
  - Nimehakikisha hazimo kwenye faili lolote linalofuatiliwa.
- `application-pro.properties`: mstari `git spring.jpa.show-sql=false` umerekebishwa.
- `application.properties`: mstari `git211` umeondolewa.
- `.gitignore`: mistari 2 ya properties imeondolewa, `application-local.properties` imeongezwa.

**Usanidi kamili wa prod (base + pro), kabla dhidi ya baada** — tofauti 3 tu, zote zimekusudiwa:
- `git`: imeondoka;
- `git211`: imeondoka;
- `spring.config.import`: imeongezwa (optional, haipo kwenye prod).
- Funguo 98 → 97.

**Majaribio:**
- `ConfigHygieneTest` 3/0: siri bila default, hakuna mistari ya "git", faili la ndani haliko kwenye classpath, Flyway na profile ya prod zimo. Mutation (default ya jwt imerudishwa): 2/1.
- Suite **568/0/1**, PG_CHECKS_OK **5/5**.
- Image `lsms-backend:local-baf4e31` (sha256:ee891a18…): jar ina `application.properties` na `application-pro.properties` tu.
- Nakala mpya: Flyway 138, 0 zilizoshindwa. Profile ya prod na siri za env zinafanya kazi.
- run-all **E2E_OK 9/9** (b1 29, b2 22, b3 38, b4 11, b5 11, mabango 10, onyo 10, onyo_fomu 16, sababu 20) pamoja na V3 28afa80, **run ya kwanza**.

**Hatua ya release (ya mmiliki, kabla ya merge kwenye main):** worktree ya main (`Lsms`) ina `application.properties` isiyofuatiliwa yenye siri za dev. Git itakataa merge kwa sababu faili hilo sasa linafuatiliwa. Kwa hiyo:
1. Hamisha thamani 2 za siri kwenda `Lsmspplication-local.properties`.
2. Futa faili la zamani.
3. Merge.

Nitaiandaa kama hatua ya faili ikiwa unataka.

**Mpango wa kuzima outOfOrder** (nakala ya 29/10, Flyway 138):
- `flyway_schema_history`: rekodi 106 zenye version, 0 zilizoshindwa. Rekodi **5 tu** ziko nje ya mpangilio: 038.1–038.5, zote 15/06, baada ya baseline 38. Hakuna tangu hapo.
1. 2.4.0 iende prod kama ilivyo (out-of-order=true), ili V136–V138 ziingie.
2. Kwenye staging ya baada ya 2.4.0: backend ianze na `SPRING_FLYWAY_VALIDATE_ON_MIGRATE=true` na `SPRING_FLYWAY_OUT_OF_ORDER=false` (env, bila build mpya).
   - Ikianza, checksum zote zinalingana na hakuna migration inayosubiri nje ya mpangilio.
   - Ikishindwa, inaonyesha migration ipi (kusoma tu).
3. Toleo linalofuata (2.4.1): `out-of-order=false` na `validate-on-migrate=true` kwenye faili.
   - Kanuni ya namba (MATAWI.md) inabaki: namba inapatikana wakati wa merge kwenye main.
   - Migration yenye namba ndogo kuliko iliyo prod itakataliwa na Flyway yenyewe.

## 5. Inayofuata

- **C2**: harness kwanza.
- Inasubiri uamuzi wako:
  - C4 itoke kwenye batch? (pendekezo §3)
  - Kanuni ya pili ya onyo (gharama dhidi ya bei ya kuuza, §2)?
  - Hatua ya faili ya release ya C1?

## origin dhidi ya local

| repo | tawi | local | origin | hali |
|---|---|---|---|---|
| Backend | release/2.4.0 | baf4e31 | 0d1ee71 | TOFAUTI, FF, commit 12 mpya |
| Backend | main | c98fa07 | c98fa07 | SAWA |
| V3 | release/3.2.0 | 28afa80 | c540ab8 | TOFAUTI, FF, commit 11 mpya |
| V3 | main (kabla ya commit ya jedwali hili) | 1773399 | 998dad6 | TOFAUTI, FF, commit 17 mpya |

push-yote bado haijaendeshwa: matawi yote ni FF.
