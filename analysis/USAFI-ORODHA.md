# USAFI-ORODHA - orodha ya kusoma tu (mmiliki 29/10 al)

Imeandaliwa 29/10/2026. **Hakuna kilichoondolewa, kuhamishwa wala kubadilishwa.** Kila kitu kinasubiri idhini ya mmiliki.

Pendekezo: **BAKI** (hai) · **ARCHIVE** (kwenye zip, kisha kuondolewa kwenye folda) · **FUTA** (takataka kweli) · **SIJUI** (mmiliki aamue).
Git: `git` = iko kwenye git ya lsmsFrontV3 (historia inaihifadhi hata ikiondolewa); `git+M` = imebadilishwa bila commit; `hapana` = haiko kwenye git (zip ndiyo nakala pekee).
"Inatumiwa na" = majina ya faili HAI (BAKI) yanayolitaja faili hili kwa jina (grep).

**Kumbuka:** ujumbe (ak) haupo kwenye MAAGIZO.md - baada ya (aj) unafuata (al).

## 0. Muhtasari

| Pendekezo | Faili | Ukubwa |
|---|---:|---:|
| BAKI | 23 | 122 KB |
| ARCHIVE | 487 | 10,835 KB |
| FUTA | 13 | 0 KB |
| SIJUI | 0 | 0 KB |
| **Jumla analysis/** | **523** | **10,958 KB** |

**Siri:** kila mechi ya "password/token/.env" ndani ya analysis/ ilikaguliwa kwa mkono (thamani zimefichwa). **Hakuna siri hai.**
- Mechi zote ni `process.env.…`, `${ROOT_PASSWORD:}`, password za PG ya kutupwa (`qa`, `QaRoot-…`), au neno "inaulizwa".
- Faili 4 zinataja **default ya zamani ya root** (iliyoondolewa na 2.2.72; root ilibadilishwa 20/10). 45-root-ukaguzi.mjs inaitumia kuthibitisha kwamba HAIFANYI kazi. Si siri hai, lakini inaweza kufichwa (`***`) ndani ya zip ukipenda.
- `.env.backend` kwenye historia ya git ya backend ina `BACKEND_VERSION=` pekee - si siri.

**Logs za hatua zilizobadilisha PROD** (ARCHIVE, si FUTA): hatua 12, 14, 24, 26, 43, 45d, 45h, 46b, 47, 52c, 55, 59, 69 - pamoja na `.awali` zao na `*-hali.txt`.

## 1. Worktrees (git)

| Worktree | Branch / HEAD | Ukubwa | Tarehe | Mabadiliko yasiyo commit | Imemergiwa main? | Pendekezo |
|---|---|---:|---|---|---|---|
| `D:\…\Lsms\Lsms` | main c98fa07 (= origin/main, tag v2.3.0) | - | 29/10 | 0 | - | **BAKI** (repo kuu) |
| `D:\…\Lsms\Lsms-hotfix-2272` | hotfix/2.2.72 dd198ea | 112 MB | 26/10 | 0 | ndiyo (tag v2.2.72) | **ONDOA** `git worktree remove` |
| `D:\…\Lsms\Lsms-mikopo-230` | feature/mikopo-2.3.0 c98fa07 | 113 MB | 29/10 | 0 | ndiyo (tag v2.3.0) | **ONDOA** `git worktree remove` |
| `D:\…\Lsms\Lsms-ops-logs` | ops/logs-flutter 6127e90 | 107 MB | 28/10 | 0 | HAPANA | **BAKI** (kazi #2 ops) |
| `D:\…\Lsms\Lsms-asset-counting` | feature/asset-counting 5c5ef33 | 24 MB | 08/10 | **4 faili** (deploy-backend.ps1, remote-deploy-backend.sh, DEPLOY_BACKEND.md, .gitignore) | branch ndiyo; mabadiliko HAPANA | **SIJUI** - tazama chini |
| `D:\…\LsmsVersion3\lsmsFrontV3` | main 3abf792 (= origin/main) | - | 26/10 | analysis/ tu | - | **BAKI** (repo kuu) |
| `D:\…\LsmsVersion3\lsmsFrontV3-ops-logs` | ops/logs-flutter e7e993a | 15 MB | 28/10 | 0 | HAPANA | **BAKI** (kazi #2 ops) |
| `D:\…\LsmsVersion3\lsmsFrontV3-asset-counting` | feature/asset-counting ab92fd4 | 8.8 MB | 08/10 | **4 faili** (deploy-v3.ps1, remote-deploy-v3.sh, DEPLOY_V3.md, .gitignore) | branch ndiyo; mabadiliko HAPANA | **SIJUI** - tazama chini |

**Asset-counting (hazikuwa kwenye orodha yako):** mabadiliko yake ni kazi ya 08/10 ya "modes" za deploy script, ambayo haikuwahi kuingia main.
- Nimethibitisha kwamba `git diff` ya kila worktree ni **sawa kabisa** na `analysis\steps\deploy-scripts-backend.diff` na `deploy-scripts-v3.diff`, kwa hiyo kuziondoa hakupotezi kitu kama diff hizo ziko kwenye zip.
- Lakini deploy-backend.ps1 ya main imebadilika sana tangu hapo (Assert-ReleaseBranch n.k.: tofauti ya mistari 684).
- Pendekezo: **ARCHIVE diff + ONDOA worktree** (`git worktree remove --force`, kwa sababu ya mabadiliko) - **kwa idhini yako tu**. Branch `feature/asset-counting` imemergiwa (tazama 3).

## 2. Nakala za muda na faili nje ya analysis/

| Kitu | Ukubwa | Tarehe | Git | Siri | Pendekezo | Sababu |
|---|---:|---|---|---|---|---|
| `D:\…\Lsms\nakala-application.properties-20261028-kabla-129` | 5.3 KB | 28/10 | hapana | **NDIYO**: thamani za default za `spring.datasource.password`, `jwt.secret`, `root.password` | **FUTA** (si kwenye zip) | backup ya kabla ya kubadilisha mstari 129. Build 67 ilitumia toleo jipya na properties zililinganishwa na rc2 (PROPERTIES_ZILEZILE_KAMA_RC2), kwa hiyo haihitajiki |
| `analysis\steps\backup-2026-10-26\` (faili 8) | ndogo | 26/10 | git | default ya zamani tu | **ARCHIVE** | nakala ya mabadiliko ya "old-scope" yaliyorudishwa 26/10 (iko kwenye jedwali la 8) |
| `D:\…\Lsms\hs_err_pid24980.log`, `replay_pid24980.log` | 74 KB + 968 KB | 31/01 | repo ya nje (staged) | hapana | **FUTA** | log za JVM iliyoanguka Januari |
| `D:\…\Lsms\pending-migrations\V120__Create_Debt_Adjustment_And_Bad_Debt_Accounts.sql` | ndogo | 10/08 | repo ya nje | hapana | **FUTA** | nakala **sawa kabisa** (cmp) na V120 iliyoko main |
| `D:\…\Lsms\.git` + `.qodo\` (repo ya NJE kwenye folda mama, branch master, "AM Lsms") | - | - | - | hapana | **SIJUI** | repo ya zamani inayozunguka worktrees zote. Usiiguse mpaka uamue |
| `D:\…\LsmsVersion3\ngbuild.log` | 4.1 KB | 27/09 | hapana | hapana | **FUTA** | log ya zamani ya `ng build` |
| `D:\MY PROJECT\lsms_frontend\` (Flutter source) | 1.1 GB | - | (repo yake) | haijakaguliwa | **SIJUI** | Flutter imestaafu 15/10. Tazama 4 (code iliyokufa) |

## 2b. Scratchpads za vikao vya Claude

Folda: `C:\Users\chief\AppData\Local\Temp\claude\D--MY-PROJECT-DUKA-PROJECT-LsmsVersion3-lsmsFrontV3\` - **353 MB**, vikao 24.

| Kikao (kifupi) | Ukubwa | Tarehe | Ndani | Pendekezo |
|---|---:|---|---|---|
| 2c5b39c5 | 140 MB | 22/10 | be/ (nakala ya backend), screenshots za returns | **FUTA** (build/nakala) |
| 253e7ca1 | 105 MB | 28/10 | 58/58b `.kabla`, PG dumps za majaribio | **ARCHIVE** faili za .sh/.sql/.py; **FUTA** dumps/build |
| e3c58ae3 | 51 MB | 22/10 | 45a `.kabla`, 52c-del.sql, 52c-tomb.sql, bak-1140/ | **ARCHIVE** .sh/.sql (52c = tukio la admin); **FUTA** zilizobaki |
| 99dc5da6 | 48 MB | 22/10 | e2e/, pgt (PG ya majaribio) | **ARCHIVE** e2e/*.mjs; **FUTA** pgt |
| 2ea43923 | 2.2 MB | 22/10 | bak-asubuhi/jioni/mstari/prod/**siri**, __pycache__ | **ARCHIVE** generators (mstari.py, gen_steps.py) na bak-*; `bak-siri/` ni **tupu**; __pycache__ → FUTA |
| 830e5246, 9d9c9f31, cbe76908, e918f0c8 | ~4.5 MB | 22/10 | be-build/, be-test/, rel2259 | **FUTA** (build) |
| c8f65257 | 1.7 MB | 28/10 | check-*.txt (mutation za LoanLedger) | **ARCHIVE** (ushahidi wa (ae)) |
| e1f0829d, 6fc365c3, 15bd40bb | ~0.9 MB | 26-28/10 | t57c, t59 (fakes), .bak | **ARCHIVE** (harness za majaribio) |
| 65dd7bee (kikao hiki) | 0.2 MB | 29/10 | t58b, t67, t69, t69m, t69c, usafi/ | **ARCHIVE** (fakes za 58b/67/69) |
| 3d97a9be, a5dbff39, b52d2f7c | <0.3 MB | 22-24/10 | e2e mobile, serve-dist | **ARCHIVE** |
| tupu (0-4 KB): 4033452b, 3845fa33, 9fb47cd4, d6c36565, db160e39, 2df81a4e, 6c1b4d0b | 0 | - | - | **FUTA** |

Kumbuka: Windows inaweza kufuta `Temp` yenyewe, kwa hiyo kilicho na thamani kiende kwenye zip.

## 3. Branches za git

### Backend (`TarimoPaul/lsmsBackend`, default = main)

| Branch | Tarehe ya mwisho | Imemergiwa main? | Ipo origin? | Pendekezo |
|---|---|---|---|---|
| main | 29/10 | - | ndiyo | **BAKI** |
| feature/mikopo-2.3.0 | 29/10 | ndiyo (= c98fa07, tag v2.3.0) | hapana | **FUTA local** (baada ya kuondoa worktree) |
| hotfix/2.2.72 | 26/10 | ndiyo (tag v2.2.72) | hapana | **FUTA local** (baada ya kuondoa worktree) |
| feature/asset-counting | 08/10 | ndiyo | hapana | **FUTA local** baada ya uamuzi wa worktree (1) |
| feature/counting-module | 05/07 | ndiyo | hapana | **FUTA local** |
| feature/customer-debt-history-freshness | 11/07 | ndiyo | hapana | **FUTA local** |
| feature/payment-status-integrity-audit | 10/07 | ndiyo | hapana | **FUTA local** |
| fix/recon-summary-phase2-labels-and-split | 15/07 | ndiyo | hapana | **FUTA local** |
| fix/recon-debt-settlement-mirror-baseline | 15/07 | ndiyo | **ndiyo** | **FUTA local + origin** |
| developBackV2 | 15/06 | ndiyo | **ndiyo** | **FUTA local + origin** |
| master | local 18/05 (f290406), origin 17/05 (c38c763) | ndiyo (zote mbili) | **ndiyo** | **SIJUI**: imemergiwa, si default; lakini ni jina la kihistoria. Napendekeza FUTA local + origin, kwa idhini yako |
| lsmsVersion01 | 21/05 | **HAPANA** (commit 1: `.backend-version` + `.env.backend` = BACKEND_VERSION tu, si siri) | **ndiyo** | **SIJUI**: commit ya toleo tu. ARCHIVE kama tag `archive/lsmsVersion01` kisha ifute, au iache |
| feature/sales-returns | 26/10 | HAPANA | hapana | **BAKI** (usiguse) |
| ops/logs-flutter | 28/10 | HAPANA | hapana | **BAKI** (usiguse) |

### V3 (`TarimoPaul/lsmsFrontV3`, default = main)

| Branch | Tarehe | Imemergiwa? | origin? | Pendekezo |
|---|---|---|---|---|
| main | 26/10 | - | ndiyo | **BAKI** |
| feature/asset-counting | 08/10 | ndiyo | hapana | **FUTA local** baada ya uamuzi wa worktree |
| feature/sales-returns | 26/10 | HAPANA | hapana | **BAKI** |
| ops/logs-flutter | 28/10 | HAPANA | hapana | **BAKI** |

Tags zilizopo: v2.2.72, v2.3.0 (backend). Kabla ya kufuta branch yoyote, uthibitisho utarudiwa siku hiyo hiyo kwa `git branch --merged main` (local na `-r`).

## 4. Code iliyokufa (ORODHA tu - itaondolewa kwa toleo la kawaida)

| Kipengele | Wapi | Ushahidi | Hatari ya kuondoa |
|---|---|---|---|
| `SaleReturnService` (mistari 1,830, `@Service`) | backend `Sales/Services/SaleReturnService.java` | Inatajwa kwenye **maoni** (comments) tu (CustomerService:1531, SalesRepository:505, SalePaymentService:33), na **haidungwi (inject) popote**. Returns za sasa zinapita njia nyingine | Ndogo kwa main; feature/sales-returns (V135→V136) lazima ikaguliwe kwanza, kwa sababu huenda inaitegemea |
| Maoni yanayotaja SaleReturnService | faili 3 juu | maoni ya zamani | yasasishwe pamoja na kuondoa service |
| Flutter source `D:\MY PROJECT\lsms_frontend\` | PC, 1.1 GB | V3 ilichukua nafasi yake (15/10) | Bado ni "rejea" ya tabia za zamani. ARCHIVE (zip au diski nyingine) kabla ya kufuta |
| Flutter inayohudumiwa na nginx kwenye prod (`/`, container frontend 2.2.53) + health check ya `remote-deploy-backend.sh` inayohitaji `/index.html` = 200 | server | ops/logs-flutter inaibadilisha kuwa `site_root_ok` | Ni kazi #2 (ops). Isiondolewe kabla health check haijabadilishwa |

## 5. Mpango wa ARCHIVE (haujaendeshwa)

1. **Zip moja:** `analysis-archive-2026-10.zip`, yenye:
   - kila faili lenye pendekezo ARCHIVE kwenye jedwali la 8, likihifadhi njia yake (`analysis/...`);
   - faili za ARCHIVE za scratchpads (2b) chini ya `scratchpads/<kikao>/`;
   - `deploy-scripts-*.diff` (tayari ziko analysis/steps).
   - **Hakuna** faili la FUTA wala lenye siri (nakala-application.properties).
2. **Orodha ya ndani:** `analysis-archive-2026-10.txt` = njia + ukubwa + sha256 ya kila faili, na `analysis-archive-2026-10.zip.sha256`.
3. **Uthibitisho kwenye PC:** fungua zip kwenye folda ya muda, linganisha sha256 ya kila faili na orodha (0 tofauti), na hesabu ya faili = orodha.
4. **Nakala nje ya PC:** B2 (`b2:elikom-lsms-backups/archive/`, rclone, kupitia Contabo kama 62) **au** diski nyingine - chaguo ni lako. Pakua tena, na sha256 ya nakala = ya zip.
5. **Hapo tu** ndipo kuondoa kunaruhusiwa:
   - faili za ARCHIVE ambazo **haziko git** (`hapana`): zinafutwa;
   - faili za ARCHIVE zilizo **kwenye git**: `git rm`, kisha **commit yako** (historia ya git inazihifadhi pia);
   - faili za `git+M` (hatua 36-59 zilizobadilishwa 28/10 kwa LSMS_TUNNEL_PORT): commit kwanza au ziende kwenye zip kama zilivyo.
6. **FUTA** (si kwenye zip): faili 13 za muda (`*-tunnel.txt`, `69-digest.txt`, lock `~$POTI-…` baada ya kufunga editor), `nakala-application.properties-*`, log za JVM, `ngbuild.log`, scratchpads tupu/build.

Ukubwa wa zip unaotarajiwa: ~11 MB (analysis) + scratchpads zilizochaguliwa.

## 6. Mpango wa git (haujaendeshwa)

1. `git worktree remove` kwa `Lsms-hotfix-2272` na `Lsms-mikopo-230` (zote safi, zimemergiwa, tags zipo).
2. Asset-counting (backend + V3): kwa idhini tu, baada ya diff kuwa kwenye zip, `git worktree remove --force`.
3. Uthibitisho siku hiyo: `git branch --merged main` na `git branch -r --merged main`. Kisha:
   - `git branch -d` (si `-D`) kwa branch zilizomergiwa za jedwali la 3;
   - `git push origin --delete` kwa developBackV2 na fix/recon-debt-settlement-mirror-baseline (na master/lsmsVersion01 ukiamua).
4. **Haziguswi:** main, ops/logs-flutter, feature/sales-returns, tags.

## 7. Maswali kwa mmiliki

1. Asset-counting worktrees (backend + V3): ARCHIVE diff + ondoa?
2. `master` (local + origin) na `lsmsVersion01` (commit ya toleo tu): futa, tag ya archive, au acha?
3. Repo ya nje `D:\…\Lsms\.git` (master, inayozunguka worktrees) na `.qodo\`: nini kifanyike? (`pending-migrations\V120` = nakala ya main, FUTA)
4. Nakala ya zip nje ya PC: B2 au diski nyingine?
5. Flutter source (1.1 GB): ARCHIVE sasa, au baada ya kazi #2 (ops)?
6. Default ya zamani ya root ndani ya faili 4: ifichwe (`***`) ndani ya zip?

Orodha ya code iliyokufa hapo juu ni ya awali; uchunguzi kamili (huduma zisizodungwa popote, endpoints zisizoitwa na V3) haujafanywa.

## 8. Kiambatisho: analysis/ - kila faili

### analysis/ (faili za juu) (28 faili, 437 KB - ARCHIVE 25, BAKI 3)

| Faili | KB | Tarehe | Git | Siri | Inatumiwa na (hai) | Pendekezo | Sababu |
|---|---:|---|---|---|---|---|---|
| `MAAGIZO.md` | 13 | 2026-10-29 | hapana | - | - | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `MATAWI.md` | 5.9 | 2026-10-26 | git | - | MAAGIZO-MASWALI.md, MAAGIZO.md, MUUNDO-2.3.0.md … | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `USAFI-ORODHA.md` | 0.0 | 2026-10-29 | hapana | - | - | **BAKI** | orodha hii |
| `measure-data-cleanup.csv` | 37 | 2026-10-06 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `measure-stats-staging.csv` | 5.4 | 2026-10-06 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `measure-stats.sql` | 5.5 | 2026-10-06 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `measure_cleanup_build.py` | 6.8 | 2026-10-06 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `prod-flyway-status.txt` | 1.2 | 2026-10-06 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `staging-2264.txt` | 4.0 | 2026-10-07 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `staging-deploy.txt` | 15 | 2026-10-06 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3_count_vs_late_sales_queries.sql` | 7.1 | 2026-10-05 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3_count_vs_late_sales_report.md` | 4.6 | 2026-10-05 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3_daily_pnl_plan.md` | 14 | 2026-10-03 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3_daily_pnl_queries.sql` | 10 | 2026-10-03 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3_debt_recount.md` | 6.3 | 2026-10-03 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3_debt_recount_queries.sql` | 7.0 | 2026-10-03 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3_is_paid_usage.md` | 4.4 | 2026-10-03 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3_late_sales_queries.sql` | 9.5 | 2026-10-05 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3_late_sales_report.md` | 10 | 2026-10-05 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3_live_verification.md` | 9.5 | 2026-10-01 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3_net_profit_check.md` | 17 | 2026-10-01 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3_net_profit_queries.sql` | 18 | 2026-10-01 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3_order_backtest.py` | 60 | 2026-10-05 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3_order_backtest.sql` | 8.6 | 2026-10-04 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3_order_phase2_plan.md` | 30 | 2026-10-05 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3_order_plan.md` | 27 | 2026-10-04 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3_ordering_findings.md` | 43 | 2026-10-03 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3_queries.sql` | 52 | 2026-09-30 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |

### analysis/toleo2/ (16 faili, 322 KB - ARCHIVE 12, BAKI 3, FUTA 1)

| Faili | KB | Tarehe | Git | Siri | Inatumiwa na (hai) | Pendekezo | Sababu |
|---|---:|---|---|---|---|---|---|
| `MAAGIZO-MASWALI.md` | 2.9 | 2026-10-26 | git | - | MUUNDO-2.3.0.md | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `MUUNDO-2.3.0.md` | 25 | 2026-10-26 | git | - | MAAGIZO-MASWALI.md, MATAWI.md | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `MUUNDO-LOGIN-AUDIT.md` | 13 | 2026-10-26 | git | - | - | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `ORODHA-D.md` | 3.2 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `RIPOTI-AA-28-10.md` | 6.9 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `RIPOTI-AB-28-10.md` | 7.4 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `RIPOTI-AC-28-10.md` | 1.0 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `RIPOTI-AE-28-10.md` | 6.2 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `RIPOTI-KAZI-28-10.md` | 18 | 2026-10-28 | hapana | - | MAAGIZO.md | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `RIPOTI-V-28-10.md` | 5.9 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `RIPOTI-WX-28-10.md` | 9.6 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `RIPOTI-Y-28-10.md` | 2.0 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `RIPOTI-Z-28-10.md` | 4.4 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `mikopo-230-backend.diff` | 208 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `mikopo-230-rc2.diff` | 7.4 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `~$POTI-KAZI-28-10.md` | 0.2 | 2026-10-28 | hapana | - | - | **FUTA** | faili la "lock" la editor - futa baada ya kufunga RIPOTI-KAZI-28-10.md kwenye editor |

### analysis/steps/ (356 faili, 6,611 KB - ARCHIVE 327, BAKI 17, FUTA 12)

| Faili | KB | Tarehe | Git | Siri | Inatumiwa na (hai) | Pendekezo | Sababu |
|---|---:|---|---|---|---|---|---|
| `01-soma-staging.cmd` | 2.5 | 2026-10-07 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `01-soma-staging.log` | 7.3 | 2026-10-07 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `02-pakua-dump.cmd` | 1.7 | 2026-10-07 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `02-pakua-dump.log` | 0.4 | 2026-10-07 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `03-restore-staging.cmd` | 3.9 | 2026-10-07 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `03-restore-staging.log` | 3.7 | 2026-10-07 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `03b-hesabu-rows.cmd` | 0.9 | 2026-10-07 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `03b-rows-prod.log` | 2.1 | 2026-10-07 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `03b-rows-staging.log` | 2.1 | 2026-10-07 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `04-staging-2265.cmd` | 2.0 | 2026-10-07 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `04-staging-2265.log` | 0.8 | 2026-10-07 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `05-thibitisha.cmd` | 2.2 | 2026-10-07 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `05-thibitisha.log` | 2.9 | 2026-10-07 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `06-alama.log` | 0.2 | 2026-10-08 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `06-kabla-a.cmd` | 1.7 | 2026-10-08 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `06-kabla-a.log` | 4.0 | 2026-10-08 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `07-build-2266.cmd` | 2.4 | 2026-10-08 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `07-build-2266.log` | 212 | 2026-10-08 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `08-staging-2266.cmd` | 2.8 | 2026-10-08 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `08-staging-2266.log` | 1.0 | 2026-10-08 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `09-alama.log` | 0.2 | 2026-10-08 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `09-thibitisha-a.cmd` | 3.1 | 2026-10-08 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `09-thibitisha-a.log` | 5.8 | 2026-10-08 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `10-alama-prod.log` | 0.2 | 2026-10-08 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `10-prod-kabla.cmd` | 2.0 | 2026-10-08 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `10-prod-kabla.log` | 4.3 | 2026-10-08 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `11-prod-preflight.cmd` | 3.2 | 2026-10-08 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `11-prod-preflight.log` | 1.1 | 2026-10-08 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `12-prod-deploy-2266.cmd` | 1.5 | 2026-10-08 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `13-alama-prod.log` | 0.2 | 2026-10-08 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `13-prod-thibitisha.cmd` | 3.0 | 2026-10-08 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `13-prod-thibitisha.log` | 4.8 | 2026-10-08 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `14-prod-v3.cmd` | 1.5 | 2026-10-08 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `15-backend-hali.cmd` | 1.7 | 2026-10-11 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `16-safebox-kabla.cmd` | 2.7 | 2026-10-12 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `16-safebox-kabla.log` | 10 | 2026-10-12 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `17-safebox-build.cmd` | 2.6 | 2026-10-12 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `17-safebox-build.log` | 191 | 2026-10-12 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `17a-safebox-pakua-dump.cmd` | 3.5 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `17a-safebox-pakua-dump.log` | 2.0 | 2026-10-13 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `17b-safebox-restore-staging.cmd` | 4.0 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `17b-safebox-restore-staging.log` | 3.4 | 2026-10-13 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `17c-rows-prod.log` | 2.2 | 2026-10-13 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `17c-rows-staging.log` | 2.2 | 2026-10-13 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `17c-safebox-rows.cmd` | 1.9 | 2026-10-12 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `17c-safebox-rows.log` | 3.1 | 2026-10-13 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `18-safebox-staging.cmd` | 3.3 | 2026-10-12 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `18-safebox-staging.log` | 1.0 | 2026-10-13 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `19-safebox-thibitisha.cmd` | 2.8 | 2026-10-12 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `19-safebox-thibitisha.log` | 3.1 | 2026-10-13 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `19a-safebox-pending.cmd` | 1.0 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `19a-safebox-pending.log` | 0.3 | 2026-10-13 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `20-safebox-api-soma.cmd` | 0.7 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `20-safebox-api-soma.log` | 6.0 | 2026-10-13 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `21-safebox-jaribu.cmd` | 1.2 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `21-safebox-jaribu.log` | 5.2 | 2026-10-13 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `22-safebox-prod-kabla.cmd` | 1.9 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `22-safebox-prod-kabla.log` | 2.6 | 2026-10-14 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `23-safebox-prod-preflight.cmd` | 3.2 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `23-safebox-prod-preflight.log` | 1.1 | 2026-10-14 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `24-safebox-prod-deploy.cmd` | 1.7 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `25-safebox-prod-thibitisha.cmd` | 2.9 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `25-safebox-prod-thibitisha.log` | 2.8 | 2026-10-14 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `26-safebox-prod-v3.cmd` | 1.5 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `27-safebox-mmiliki.cmd` | 1.5 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `27-safebox-mmiliki.log` | 10 | 2026-10-14 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `27b-safebox-kawaida.cmd` | 1.1 | 2026-10-14 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `28-safebox-build-2270.cmd` | 3.3 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `28-safebox-build-2270.log` | 209 | 2026-10-13 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `29-safebox-staging-2270.cmd` | 5.3 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `29-safebox-staging-2270.log` | 3.9 | 2026-10-14 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `30-safebox-si-mmiliki.cmd` | 1.1 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `30-safebox-si-mmiliki.log` | 1.5 | 2026-10-13 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `30a-safebox-si-mmiliki-uthibitisho.cmd` | 1.2 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `30a-safebox-si-mmiliki-uthibitisho.log` | 1.7 | 2026-10-13 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `31-safebox-roles.cmd` | 1.2 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `31-safebox-roles.log` | 1.7 | 2026-10-13 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `32-safebox-bado-kukabidhiwa.cmd` | 1.5 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `32-safebox-bado-kukabidhiwa.log` | 0.8 | 2026-10-13 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `33-gl-audit-pakua-dump.cmd` | 1.8 | 2026-10-14 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `33-gl-audit-pakua-dump.log` | 0.6 | 2026-10-15 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `34-gl-audit-postsale-log.cmd` | 2.7 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `35-pakua-dump-20261015.cmd` | 3.5 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `35-pakua-dump-20261015.log` | 0.9 | 2026-10-15 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `35a0-soma-backup-script.cmd` | 5.2 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `36-0-staging-db.cmd` | 4.0 | 2026-10-19 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `36-0-staging-db.log` | 7.6 | 2026-10-20 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `36-0-staging-db.sql` | 0.5 | 2026-10-19 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `36-1-staging-washa.cmd` | 3.3 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `36-1-staging-washa.log` | 3.2 | 2026-10-20 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `36-1-staging-washa.sh` | 4.3 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `36-h2-baada.sql` | 2.0 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `36-h2-data.txt` | 0.3 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `36-h2-kabla.sql` | 1.3 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `36-h2-staging.cmd` | 8.2 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `36-h2-staging.log` | 4.7 | 2026-10-20 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `36-h2-staging.mjs` | 5.0 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `36-h2-tunnel.txt` | 0.0 | 2026-10-20 | git | - | - | **FUTA** | faili la muda la hatua (linaandikwa upya kila mwendesho) |
| `36b-pos-muda-kabla-tunnel.txt` | 0.0 | 2026-10-20 | git | - | - | **FUTA** | faili la muda la hatua (linaandikwa upya kila mwendesho) |
| `36b-pos-muda-kabla.cmd` | 6.0 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `36b-pos-muda-kabla.log` | 3.0 | 2026-10-20 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `37-toleo1-build-2271.cmd` | 3.7 | 2026-10-16 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `37-toleo1-build-2271.log` | 202 | 2026-10-20 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `37v-thibitisha-3111.log` | 0.7 | 2026-10-21 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `37v-thibitisha.cmd` | 5.8 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `37v-transcript.txt` | 9.8 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `37v-v3-build-3111.cmd` | 6.5 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `37v-v3-build-3111.log` | 0.2 | 2026-10-21 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `38-thibitisha-134.sql` | 2.2 | 2026-10-19 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `38a-toleo1-pakua-dump.cmd` | 7.3 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `38a-toleo1-pakua-dump.log` | 2.2 | 2026-10-20 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `38b-toleo1-restore-staging.cmd` | 8.1 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `38b-toleo1-restore-staging.log` | 2.6 | 2026-10-20 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `38c-toleo1-staging-2271.cmd` | 10 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `38c-toleo1-staging-2271.log` | 3.3 | 2026-10-20 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `38d-pos-muda-baada-tunnel.txt` | 0.0 | 2026-10-20 | git | - | - | **FUTA** | faili la muda la hatua (linaandikwa upya kila mwendesho) |
| `38d-pos-muda-baada.cmd` | 7.6 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `38d-pos-muda-baada.log` | 3.0 | 2026-10-20 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `38e-staging-v3-3111.cmd` | 9.2 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `38e-staging-v3-3111.log` | 1.8 | 2026-10-21 | git | - | 45a-prod-preflight.cmd | **ARCHIVE** | log ya hatua (rekodi) |
| `39-dryrun-q9.json` | 53 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `39-dryrun.json` | 53 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `39-toleo1-baada.sql` | 4.3 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `39-toleo1-data.txt` | 1.2 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `39-toleo1-jaribu-a.cmd` | 7.3 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `39-toleo1-jaribu-a.log` | 9.0 | 2026-10-20 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `39-toleo1-jaribu.mjs` | 26 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `39-toleo1-kabla.sql` | 4.9 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `39-tunnel.txt` | 0.0 | 2026-10-20 | git | - | - | **FUTA** | faili la muda la hatua (linaandikwa upya kila mwendesho) |
| `40-dryrun-ya-pili.json` | 86 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `40-m7-journals.json` | 1.8 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `40-marekebisho-baada-ya-reopen.json` | 85 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `40-marekebisho-halisi.json` | 117 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `40-toleo1-jaribu-b.cmd` | 7.4 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `40-toleo1-jaribu-b.log` | 9.0 | 2026-10-20 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `40-tunnel.txt` | 0.0 | 2026-10-20 | git | - | - | **FUTA** | faili la muda la hatua (linaandikwa upya kila mwendesho) |
| `41-kosa-ondoa.sql` | 0.3 | 2026-10-16 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `41-kosa-weka.sql` | 0.5 | 2026-10-16 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `41-risiti.txt` | 0.0 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `41-toleo1-kosa-la-gl.cmd` | 8.4 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `41-toleo1-kosa-la-gl.log` | 3.0 | 2026-10-20 | git | - | 45a-prod-preflight.cmd | **ARCHIVE** | log ya hatua (rekodi) |
| `41-tunnel.txt` | 0.0 | 2026-10-20 | git | - | - | **FUTA** | faili la muda la hatua (linaandikwa upya kila mwendesho) |
| `42-finance-write-ukaguzi.sql` | 2.3 | 2026-10-19 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `43-m7-prod.cmd` | 14 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `43-m7-prod.json` | 3.9 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `43-m7-prod.log` | 11 | 2026-10-22 | git | - | - | **ARCHIVE** | log ya hatua iliyobadilisha PROD - ARCHIVE (si FUTA) |
| `43-m7-prod.mjs` | 10 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `43-m7-staging.json` | 1.7 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `43-prod-hali-2026-10-22.json` | 0.1 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `44-jwt-secret-prod.cmd` | 10 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `44-jwt-secret-prod.log` | 2.8 | 2026-10-21 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `44-jwt-secret-prod.sh` | 4.7 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `44-jwt-toleo1-hali.txt` | 0.3 | 2026-10-21 | git | - | - | **ARCHIVE** | hali ya mwisho ya kazi ya nyuma (rekodi ya prod) |
| `45-bg.sh` | 2.5 | 2026-10-21 | git | - | MAAGIZO.md | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `45-deploy.ps1` | 1.7 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `45-kabla.sql` | 3.1 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `45-lib.mjs` | 9.4 | 2026-10-21 | git | - | 45-root-ukaguzi.mjs, 46-reco-kinga.mjs, MAAGIZO.md | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `45-maandishi.sh` | 11 | 2026-10-21 | git | - | 45-lib.mjs, 45a-prod-preflight.sh, MAAGIZO.md | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `45-root-ukaguzi.mjs` | 4.8 | 2026-10-21 | git | default ya zamani ya root (haifanyi kazi tangu 20/10) | 45-lib.mjs | **ARCHIVE** | hatua ya mara moja (inatajwa tu kwenye maoni ya faili hai) |
| `45-toleo-faili.ps1` | 1.3 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `45a-prod-preflight.cmd` | 11 | 2026-10-21 | git | - | 45a-prod-preflight.sh | **ARCHIVE** | hatua ya mara moja (inatajwa tu kwenye maoni ya faili hai) |
| `45a-prod-preflight.log` | 6.3 | 2026-10-21 | git | - | 45a-prod-preflight.cmd | **ARCHIVE** | log ya hatua (rekodi) |
| `45a-prod-preflight.sh` | 19 | 2026-10-21 | git | - | 45-maandishi.sh, 45a-prod-preflight.cmd | **ARCHIVE** | hatua ya mara moja (inatajwa tu kwenye maoni ya faili hai) |
| `45b-staging-mazoezi-db.cmd` | 14 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `45b-staging-mazoezi-db.log` | 4.8 | 2026-10-21 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `45c-staging-mazoezi.cmd` | 9.0 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `45c-staging-mazoezi.log` | 9.8 | 2026-10-21 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `45c-tunnel.txt` | 0.0 | 2026-10-21 | git | - | - | **FUTA** | faili la muda la hatua (linaandikwa upya kila mwendesho) |
| `45d-backend-2.2.71-hali.txt` | 0.2 | 2026-10-21 | git | - | - | **ARCHIVE** | hali ya mwisho ya kazi ya nyuma (rekodi ya prod) |
| `45d-prod-deploy.cmd` | 15 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `45d-prod-deploy.log` | 42 | 2026-10-21 | git | - | - | **ARCHIVE** | log ya hatua iliyobadilisha PROD - ARCHIVE (si FUTA) |
| `45e-prod-baada-ya-deploy.cmd` | 8.7 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `45e-prod-baada-ya-deploy.log` | 1.5 | 2026-10-21 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `45f-prod-root-a.cmd` | 4.9 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `45f-prod-root-a.log` | 0.4 | 2026-10-21 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `45g-admin-ushahidi.sh` | 2.3 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `45g-prod-b2-c-d.cmd` | 9.6 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `45g-prod-b2-c-d.log` | 4.9 | 2026-10-21 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `45g-prod-b2-c-d.log.awali` | 0.6 | 2026-10-21 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `45h-prod-v3-3111.cmd` | 12 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `45h-prod-v3-3111.log` | 2.2 | 2026-10-21 | git | - | - | **ARCHIVE** | log ya hatua iliyobadilisha PROD - ARCHIVE (si FUTA) |
| `45h-v3-3.1.11-hali.txt` | 0.2 | 2026-10-21 | git | - | - | **ARCHIVE** | hali ya mwisho ya kazi ya nyuma (rekodi ya prod) |
| `45i-env-root-hali.txt` | 0.3 | 2026-10-22 | git | - | - | **ARCHIVE** | hali ya mwisho ya kazi ya nyuma (rekodi ya prod) |
| `45i-pc-imeshindwa.txt` | 0.1 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `45i-prod-env-root.cmd` | 19 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `45i-prod-env-root.log` | 4.4 | 2026-10-22 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `45i-prod-env-root.log.awali` | 0.3 | 2026-10-22 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `45i-prod-env-root.sh` | 8.6 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `45i-thibitisha.mjs` | 2.6 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `45k-nginx-kujiendesha.cmd` | 4.9 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `45k-nginx-kujiendesha.log` | 2.7 | 2026-10-21 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `45k-nginx-kujiendesha.sh` | 3.7 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `46-marekebisho.mjs` | 24 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `46-prod-andika.json` | 126 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `46-prod-dryrun.json` | 54 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `46-prod-hali-2026-10-22.json` | 0.4 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `46-prod-kagua.json` | 59 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `46-reco-kinga.mjs` | 2.2 | 2026-10-21 | git | - | MAAGIZO.md, dirisha-leo-jana.cmd | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `46-staging-andika.json` | 121 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `46-staging-dryrun.json` | 53 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `46a-prod-marekebisho-kagua.cmd` | 11 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `46a-prod-marekebisho-kagua.log` | 8.5 | 2026-10-22 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `46a-prod-marekebisho-kagua.log.fail-1806` | 7.5 | 2026-10-22 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `46b-prod-marekebisho-andika.cmd` | 14 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `46b-prod-marekebisho-andika.log` | 16 | 2026-10-22 | git | - | - | **ARCHIVE** | log ya hatua iliyobadilisha PROD - ARCHIVE (si FUTA) |
| `47-funga-jan-sep.mjs` | 5.8 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `47-prod-funga-jan-sep.cmd` | 14 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `47-prod-funga-jan-sep.log` | 9.5 | 2026-10-22 | git | - | - | **ARCHIVE** | log ya hatua iliyobadilisha PROD - ARCHIVE (si FUTA) |
| `47-prod-funga.json` | 1.9 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `47-prod-hali-2026-10-22.json` | 0.5 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `47-staging-funga.json` | 1.9 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `48-ukaguzi-wa-ruhusa-42.cmd` | 11 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `49-staging-simamisha.cmd` | 6.4 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `50-rollback-sale.mjs` | 2.7 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `50-staging-rollback-2270.cmd` | 15 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `50-staging-rollback-2270.log` | 3.1 | 2026-10-21 | git | - | 45a-prod-preflight.cmd | **ARCHIVE** | log ya hatua (rekodi) |
| `50-tunnel.txt` | 0.0 | 2026-10-21 | git | - | - | **FUTA** | faili la muda la hatua (linaandikwa upya kila mwendesho) |
| `51-prod-rudi-2270.cmd` | 10 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `52b-admin-marejeo.cmd` | 7.0 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `52b-admin-marejeo.sql` | 5.0 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `52c-admin-ondoa.sh` | 7.5 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `52c-prod-admin-ondoa.cmd` | 12 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `53-admin-login.mjs` | 1.5 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `53-admin-ushahidi.sh` | 6.5 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `53-prod-admin-ushahidi.cmd` | 6.1 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `53-prod-admin-ushahidi.log` | 7.5 | 2026-10-22 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `54-admin-marejeo.sh` | 1.5 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `54-prod-admin-marejeo.cmd` | 4.7 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `54-prod-admin-marejeo.log` | 2.9 | 2026-10-26 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `55-admin-futa.sh` | 6.1 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `55-admin-futa.sql` | 7.9 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `55-prod-admin-futa.cmd` | 12 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `55-prod-admin-futa.log` | 7.3 | 2026-10-26 | git | - | - | **ARCHIVE** | log ya hatua iliyobadilisha PROD - ARCHIVE (si FUTA) |
| `55-root-login.mjs` | 1.3 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `55-uamuzi.txt` | 0.0 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `56-admin-tukio.sh` | 15 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `56-prod-admin-tukio.cmd` | 4.8 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `56-prod-admin-tukio.log` | 9.9 | 2026-10-26 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `56b-admin-tukio-ufafanuzi.sh` | 14 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `56b-prod-admin-tukio-ufafanuzi.cmd` | 4.6 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `56b-prod-admin-tukio-ufafanuzi.log` | 438 | 2026-10-26 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `56b-prod-admin-tukio-ufafanuzi.log.awali` | 438 | 2026-10-26 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `57a-hotfix-2272-build.cmd` | 4.0 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `57a-hotfix-2272-build.log` | 254 | 2026-10-26 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `57b-staging-env.cmd` | 4.1 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `57b-staging-env.log` | 1.1 | 2026-10-26 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `57b-staging-env.sh` | 3.2 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `57c-staging-2272.cmd` | 4.7 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `57c-staging-2272.log` | 4.0 | 2026-10-26 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `57c-staging-2272.sh` | 9.3 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `57d-gl-vipindi.mjs` | 15 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `57d-staging-gl-vipindi.cmd` | 6.8 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `57d-staging-gl-vipindi.log` | 4.0 | 2026-10-26 | git+M | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `57d-staging-gl-vipindi.log.awali` | 3.9 | 2026-10-26 | git | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `57d-tunnel.txt` | 0.0 | 2026-10-26 | git | - | - | **FUTA** | faili la muda la hatua (linaandikwa upya kila mwendesho) |
| `58-mikopo-soma.sh` | 1.5 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `58-mikopo-soma.sql` | 8.1 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `58-prod-mikopo-soma.cmd` | 4.1 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `58-prod-mikopo-soma.log` | 6.3 | 2026-10-28 | hapana | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `58-prod-mikopo-soma.log.awali` | 5.0 | 2026-10-28 | hapana | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `58b-prod-schedulers-soma.cmd` | 4.2 | 2026-10-28 | hapana | - | - | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `58b-prod-schedulers-soma.log` | 25 | 2026-10-29 | hapana | - | 58b-prod-schedulers-soma.cmd | **ARCHIVE** | hatua ya mara moja (inatajwa tu kwenye maoni ya faili hai) |
| `58b-schedulers-soma.sh` | 4.3 | 2026-10-29 | hapana | - | 58b-prod-schedulers-soma.cmd | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `58b-schedulers-soma.sql` | 5.3 | 2026-10-28 | hapana | - | 58b-prod-schedulers-soma.cmd, 58b-schedulers-soma.sh | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `59-prod-2272-hali.txt` | 0.2 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hali ya mwisho ya kazi ya nyuma (rekodi ya prod) |
| `59-prod-2272.cmd` | 14 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `59-prod-2272.log` | 17 | 2026-10-28 | hapana | - | - | **ARCHIVE** | log ya hatua iliyobadilisha PROD - ARCHIVE (si FUTA) |
| `59-prod-2272.log.awali` | 1.3 | 2026-10-28 | hapana | - | - | **ARCHIVE** | log ya hatua iliyobadilisha PROD - ARCHIVE (si FUTA) |
| `59-prod-2272.sh` | 11 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `60-bank-cutover.sh` | 1.2 | 2026-10-28 | hapana | - | 60-prod-bank-cutover.cmd | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `60-bank-cutover.sql` | 2.9 | 2026-10-28 | hapana | - | 60-bank-cutover.sh, 60-prod-bank-cutover.cmd | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `60-prod-bank-cutover.cmd` | 4.3 | 2026-10-28 | hapana | - | - | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `61-rc1-build.cmd` | 5.7 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `61-rc1-build.log` | 270 | 2026-10-28 | hapana | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `61-rc1-build.log.awali` | 274 | 2026-10-28 | hapana | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `61b-rc2-build.cmd` | 8.0 | 2026-10-29 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `61b-rc2-build.log` | 328 | 2026-10-29 | hapana | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `61b-rc2-build.log.awali` | 328 | 2026-10-29 | hapana | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `62-staging-db-leo.cmd` | 4.3 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `62-staging-db-leo.log` | 3.2 | 2026-10-28 | hapana | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `62-staging-db-leo.sh` | 7.1 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `63-staging-rc1.cmd` | 5.0 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `63-staging-rc1.log` | 3.5 | 2026-10-28 | hapana | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `63-staging-rc1.sh` | 7.6 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `63b-staging-rc2.cmd` | 5.2 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `63b-staging-rc2.log` | 3.6 | 2026-10-29 | hapana | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `63b-staging-rc2.sh` | 7.9 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `64-mikopo-staging.cmd` | 5.7 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `64-mikopo-staging.log` | 2.9 | 2026-10-29 | hapana | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `64-mikopo-staging.log.awali` | 5.5 | 2026-10-28 | hapana | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `64-mikopo-staging.mjs` | 12 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `64-tunnel.txt` | 0.0 | 2026-10-29 | hapana | - | - | **FUTA** | faili la muda la hatua (linaandikwa upya kila mwendesho) |
| `65-staging-riba-mzunguko.cmd` | 4.2 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `65-staging-riba-mzunguko.log` | 2.6 | 2026-10-29 | hapana | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `65-staging-riba-mzunguko.sh` | 5.3 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `66-staging-rudisha.cmd` | 4.1 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `66-staging-rudisha.log` | 2.3 | 2026-10-29 | hapana | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `66-staging-rudisha.log.awali` | 0.2 | 2026-10-29 | hapana | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `66-staging-rudisha.sh` | 4.2 | 2026-10-28 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `67-230-build.cmd` | 8.9 | 2026-10-29 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `67-230-build.log` | 328 | 2026-10-29 | hapana | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `67-kinga-za-deploy.ps1` | 2.0 | 2026-10-29 | hapana | - | - | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `68-mazoezi.json` | 0.6 | 2026-10-29 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `68-mikopo-staging.mjs` | 10.0 | 2026-10-29 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `68-staging-230.cmd` | 7.9 | 2026-10-29 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `68-staging-230.log` | 11 | 2026-10-29 | hapana | - | - | **ARCHIVE** | log ya hatua (rekodi) |
| `68-staging-230.sh` | 13 | 2026-10-29 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `68-tunnel.txt` | 0.0 | 2026-10-29 | hapana | - | - | **FUTA** | faili la muda la hatua (linaandikwa upya kila mwendesho) |
| `69-digest.txt` | 0.1 | 2026-10-29 | hapana | - | - | **FUTA** | faili la muda la hatua (linaandikwa upya kila mwendesho) |
| `69-mikopo-kagua.json` | 2.2 | 2026-10-29 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `69-mikopo-prod.mjs` | 12 | 2026-10-29 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `69-prod-230-hali.txt` | 0.2 | 2026-10-29 | hapana | - | - | **ARCHIVE** | hali ya mwisho ya kazi ya nyuma (rekodi ya prod) |
| `69-prod-230.cmd` | 19 | 2026-10-29 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `69-prod-230.log` | 12 | 2026-10-29 | hapana | - | - | **ARCHIVE** | log ya hatua iliyobadilisha PROD - ARCHIVE (si FUTA) |
| `69-prod-230.log.awali` | 21 | 2026-10-29 | hapana | - | - | **ARCHIVE** | log ya hatua iliyobadilisha PROD - ARCHIVE (si FUTA) |
| `69-prod-230.sh` | 12 | 2026-10-29 | hapana | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `alama-madeni.sql` | 1.0 | 2026-10-08 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `deploy-scripts-backend.diff` | 80 | 2026-10-08 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `deploy-scripts-v3.diff` | 44 | 2026-10-08 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `dirisha-leo-jana.cmd` | 2.8 | 2026-10-28 | hapana | - | MAAGIZO.md | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `ficha.awk` | 2.4 | 2026-10-15 | git | - | 45a-prod-preflight.cmd, 45a-prod-preflight.sh, 58b-prod-schedulers-soma.cmd … | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `gl-audit-credit-sales.sql` | 1.0 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `hali-root.sh` | 3.0 | 2026-10-26 | git | - | MAAGIZO.md | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `hotfix-2272-backend.diff` | 82 | 2026-10-26 | git | default ya zamani ya root (haifanyi kazi tangu 20/10) | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `hotfix-2272-build-kinga.diff` | 3.4 | 2026-10-26 | git | - | MATAWI.md | **ARCHIVE** | hatua ya mara moja (inatajwa tu kwenye maoni ya faili hai) |
| `kabla-a.sql` | 2.2 | 2026-10-08 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `m7-njia-b.diff` | 12 | 2026-10-19 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `m7-redate-backend.diff` | 23 | 2026-10-19 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `pos-muda-baada.json` | 3.4 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `pos-muda-kabla.json` | 3.4 | 2026-10-20 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `pos-muda.mjs` | 6.2 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `rows.sql` | 1.5 | 2026-10-07 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `safebox-api-soma.mjs` | 1.3 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `safebox-backend.diff` | 15 | 2026-10-12 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `safebox-bado-kukabidhiwa.sql` | 2.6 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `safebox-frontend.diff` | 32 | 2026-10-12 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `safebox-jaribu-staging.mjs` | 9.2 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `safebox-kabla.sql` | 1.0 | 2026-10-12 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `safebox-mmiliki-staging.mjs` | 3.7 | 2026-10-28 | git+M | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `safebox-owner-backend.diff` | 41 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `safebox-owner-frontend.diff` | 10 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `safebox-pending.sql` | 1.9 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `safebox-roles.sql` | 2.6 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `safebox-si-mmiliki-uthibitisho.sql` | 2.3 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `safebox-si-mmiliki.sql` | 1.9 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `safebox-thibitisha-133.sql` | 1.9 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `safebox-thibitisha.sql` | 3.1 | 2026-10-12 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `thibitisha-a.sql` | 2.9 | 2026-10-08 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `thibitisha.sql` | 1.4 | 2026-10-07 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `toleo-a-frontend.diff` | 104 | 2026-10-08 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `toleo-a.diff` | 93 | 2026-10-08 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `toleo1-backend.diff` | 186 | 2026-10-19 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `toleo1-frontend.diff` | 30 | 2026-10-19 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `tunnel-port.cmd` | 1.1 | 2026-10-28 | hapana | - | tunnel-port.ps1, tunnel.cmd | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `tunnel-port.ps1` | 1.6 | 2026-10-28 | hapana | - | tunnel-port.cmd | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |
| `tunnel.cmd` | 1.0 | 2026-10-28 | git+M | - | tunnel-port.cmd | **BAKI** | hai (orodha ya mmiliki au inaitwa na hatua hai) |

### analysis/capital-funding/ (24 faili, 220 KB - ARCHIVE 24)

| Faili | KB | Tarehe | Git | Siri | Inatumiwa na (hai) | Pendekezo | Sababu |
|---|---:|---|---|---|---|---|---|
| `01-salio-pesa-1310.out` | 0.4 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `01-salio-pesa-1310.sql` | 0.7 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `02-mtiririko-1000-kwa-mwezi.out` | 2.5 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `02-mtiririko-1000-kwa-mwezi.sql` | 0.4 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `03-pesa-inakokwenda.out` | 1.4 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `03-pesa-inakokwenda.sql` | 1.0 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `04-pengo-kwa-mwezi.out` | 0.9 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `04-pengo-kwa-mwezi.sql` | 1.7 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `05-reco-inafunika-siku.out` | 0.9 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `05-reco-inafunika-siku.sql` | 1.3 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `19-toleo1-dryrun-utabiri.out` | 4.5 | 2026-10-16 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `19-toleo1-dryrun-utabiri.sql` | 7.8 | 2026-10-16 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `20-toleo1-h2-utabiri.out` | 0.7 | 2026-10-16 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `20-toleo1-h2-utabiri.sql` | 2.0 | 2026-10-16 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `21-tofauti-13900.out` | 2.0 | 2026-10-16 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `21-tofauti-13900.sql` | 2.6 | 2026-10-16 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `MPANGO-PAMOJA.md` | 74 | 2026-10-20 | git | default ya zamani ya root (haifanyi kazi tangu 20/10) | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `MPANGO.md` | 23 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `m7-malipo-wasambazaji.md` | 9.8 | 2026-10-19 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `m7-malipo-wasambazaji.out` | 30 | 2026-10-19 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `m7-malipo-wasambazaji.sql` | 13 | 2026-10-19 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `mkopo-athari.md` | 14 | 2026-10-19 | git | - | MUUNDO-2.3.0.md | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `mkopo-athari.out` | 12 | 2026-10-19 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `mkopo-athari.sql` | 10 | 2026-10-19 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |

### analysis/gl-audit/ (63 faili, 279 KB - ARCHIVE 63)

| Faili | KB | Tarehe | Git | Siri | Inatumiwa na (hai) | Pendekezo | Sababu |
|---|---:|---|---|---|---|---|---|
| `00-uthibitisho.out` | 0.8 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `00-uthibitisho.sql` | 0.5 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `01-gl-config-vipindi.out` | 6.5 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `01-gl-config-vipindi.sql` | 1.3 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `02-double-entry.out` | 4.2 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `02-double-entry.sql` | 2.7 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `02a-sales-bila-journal.out` | 1.1 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `02a-sales-bila-journal.sql` | 1.2 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `03-gl-account.out` | 8.1 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `03-gl-account.sql` | 0.2 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `04-matukio-yasiyogusa-gl.out` | 3.0 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `04-matukio-yasiyogusa-gl.sql` | 7.6 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `04b-recon-reopen-variance.out` | 5.1 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `04b-recon-reopen-variance.sql` | 2.0 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `05-capital.out` | 22 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `05-capital.sql` | 4.0 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `05b-capex-bila-journal.out` | 6.5 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `05b-capex-bila-journal.sql` | 3.2 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `05c-kodi-mwaka.out` | 2.0 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `05c-kodi-mwaka.sql` | 0.9 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `06-ar-0109.out` | 4.9 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `06-ar-0109.sql` | 2.4 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `06b-ar-0109-chanzo.out` | 1.1 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `06b-ar-0109-chanzo.sql` | 1.8 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `06c-pnl-ar-opening-0109.out` | 0.4 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `06c-pnl-ar-opening-0109.sql` | 4.0 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `07-control-vs-subledger.out` | 3.2 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `07-control-vs-subledger.sql` | 4.5 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `07b-pnl-ar-kwa-tarehe.out` | 0.3 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `07b-pnl-ar-kwa-tarehe.sql` | 4.0 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `08-day-close-sign-20261015.out` | 0.5 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `08-day-close-sign.out` | 2.0 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `08-day-close-sign.sql` | 1.8 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `09-ukamilifu-ufuatiliaji-vipindi.out` | 9.3 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `09-ukamilifu-ufuatiliaji-vipindi.sql` | 7.7 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `10-ziada-siku.out` | 4.4 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `10-ziada-siku.sql` | 3.8 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `10b-ziada-madeni.out` | 4.2 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `10b-ziada-madeni.sql` | 2.0 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `10c-ziada-makusanyo.out` | 4.4 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `10c-ziada-makusanyo.sql` | 3.2 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `10d-ziada-pesa-ya-jana.out` | 3.3 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `10d-ziada-pesa-ya-jana.sql` | 2.9 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `11-sales-kuchelewa.out` | 2.3 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `11-sales-kuchelewa.sql` | 3.2 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `12-debt-payments-sifuri.out` | 2.7 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `12-debt-payments-sifuri.sql` | 3.6 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `13-kodi-mwaka-chanzo.out` | 7.7 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `13-kodi-mwaka-chanzo.sql` | 3.0 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `14-salio-pesa.out` | 3.0 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `14-salio-pesa.sql` | 3.5 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `15-pengo-handover-purchases.out` | 1.9 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `15-pengo-handover-purchases.sql` | 1.9 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `15b-pengo-jumla-tangu-reco.out` | 0.5 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `15b-pengo-jumla-tangu-reco.sql` | 1.9 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `16-ramani-mapengo.out` | 4.4 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `16-ramani-mapengo.sql` | 7.4 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `17-pnl-dhidi-ya-gl-gharama.out` | 4.7 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `17-pnl-dhidi-ya-gl-gharama.sql` | 6.2 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `18-ukamilifu-kwa-chanzo.out` | 2.4 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `18-ukamilifu-kwa-chanzo.sql` | 5.2 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `NAKALA.md` | 2.7 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `RIPOTI.md` | 51 | 2026-10-15 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |

### analysis/order-screenshots/ (5 faili, 1,350 KB - ARCHIVE 5)

| Faili | KB | Tarehe | Git | Siri | Inatumiwa na (hai) | Pendekezo | Sababu |
|---|---:|---|---|---|---|---|---|
| `1-no-count-en.png` | 275 | 2026-10-06 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `2-edited-en.png` | 277 | 2026-10-06 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `3-no-count-sw.png` | 268 | 2026-10-06 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `4-counted-en.png` | 269 | 2026-10-06 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `5-all-in-en.png` | 259 | 2026-10-06 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |

### analysis/recon-expenses/ (2 faili, 362 KB - ARCHIVE 2)

| Faili | KB | Tarehe | Git | Siri | Inatumiwa na (hai) | Pendekezo | Sababu |
|---|---:|---|---|---|---|---|---|
| `simu-baada.png` | 178 | 2026-10-07 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `simu-kabla.png` | 184 | 2026-10-07 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |

### analysis/returns-exchange/ (3 faili, 161 KB - ARCHIVE 3)

| Faili | KB | Tarehe | Git | Siri | Inatumiwa na (hai) | Pendekezo | Sababu |
|---|---:|---|---|---|---|---|---|
| `SOMA.md` | 3.9 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `backend.diff` | 64 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `frontend.diff` | 93 | 2026-10-22 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |

### analysis/steps/45-mazoezi/ (7 faili, 181 KB - ARCHIVE 7)

| Faili | KB | Tarehe | Git | Siri | Inatumiwa na (hai) | Pendekezo | Sababu |
|---|---:|---|---|---|---|---|---|
| `data.txt` | 1.3 | 2026-10-21 | git | - | 45-lib.mjs | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `funga-andika.json` | 0.0 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `funga-kagua.json` | 0.2 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `m7-andika.json` | 0.1 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `m7-kagua.json` | 0.3 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `marekebisho-andika.json` | 121 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `marekebisho-kagua.json` | 58 | 2026-10-21 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |

### analysis/steps/backup-2026-10-26/ (8 faili, 254 KB - ARCHIVE 8)

| Faili | KB | Tarehe | Git | Siri | Inatumiwa na (hai) | Pendekezo | Sababu |
|---|---:|---|---|---|---|---|---|
| `hotfix-kabla-ff.diff` | 70 | 2026-10-26 | git | default ya zamani ya root (haifanyi kazi tangu 20/10) | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `main-deploy-backend-ssh-n.diff` | 2.0 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `main-untracked-kabla.tar` | 10 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `main-upeo-zamani-uaa.diff` | 4.7 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `main-yote-kabla.diff` | 68 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `test-uaa-zamani/entity/DataInitializerRootUserTest.java` | 4.5 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3-main-src-kabla.diff` | 93 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `v3-main-src-kabla.stat` | 0.8 | 2026-10-26 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |

### analysis/steps/safebox-shots/ (3 faili, 711 KB - ARCHIVE 3)

| Faili | KB | Tarehe | Git | Siri | Inatumiwa na (hai) | Pendekezo | Sababu |
|---|---:|---|---|---|---|---|---|
| `1-banner.png` | 306 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `2-safebox-tab.png` | 329 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `3-mobile.png` | 75 | 2026-10-13 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |

### analysis/v3_order_backtest_out/ (8 faili, 63 KB - ARCHIVE 8)

| Faili | KB | Tarehe | Git | Siri | Inatumiwa na (hai) | Pendekezo | Sababu |
|---|---:|---|---|---|---|---|---|
| `classes.csv` | 20 | 2026-10-04 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `daily_decided.csv` | 7.3 | 2026-10-04 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `daily_decided_measured.csv` | 7.3 | 2026-10-04 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `grid.csv` | 12 | 2026-10-04 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `products_decided.csv` | 3.8 | 2026-10-04 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `products_decided_measured.csv` | 4.0 | 2026-10-04 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `slow_movers.csv` | 6.9 | 2026-10-04 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |
| `soda_policies.csv` | 1.5 | 2026-10-04 | git | - | - | **ARCHIVE** | hatua/ripoti iliyokwisha tumika |


## 9. UPANUZI (mmiliki 29/10 am): folda nzima `D:\MY PROJECT\DUKA PROJECT\`

Kusoma tu (29/10). Nilitumia skana ya Python: node_modules/target/dist zilipimwa bila kuorodhesha ndani yake, na migrations zilizo git hazijaorodheshwa. Thamani za siri hazikusomwa wala kuchapishwa; majina ya funguo tu. Hakuna kilichoondolewa.

### 9.1 Ukubwa wa folda za juu

| Folda | Ukubwa | Faili | Maelezo |
|---|---:|---:|---|
| `LsmsVersion3\` | 604 MB | 52,789 | lsmsFrontV3 + worktrees 2 za V3; **550 MB ni node_modules** (2 × 275 MB) |
| `Lsms\` | 450 MB | 11,652 | backend + worktrees 4; **~406 MB ni target/** (zinahesabiwa ndani) |
| `backups\` | 41 MB | 6 | dumps za prod (data ya wateja) |
| `lsms-print-agent\` | 32 MB | 45 | mradi wa print agent (Jul 2026) |
| `doc lsms\` | 21 KB | 1 | `sql script za ku add bidhaa.txt` (Jun 2025) |
| `BACKUPS AWS\` | 3 KB | 1 | dump ndogo ya AWS (Feb 2026) |
| Faili za juu | 3.4 MB | 3 | `dump-Lsms-202607171654.sql`, `Lsms.zip`, `download-backups.ps1` |

### 9.2 Dumps za database (data ya wateja)

| Faili | Ukubwa | Tarehe | Imethibitishwa? | Pendekezo |
|---|---:|---|---|---|
| `backups\lsms_20261015_0200.dump` | 8.1 MB | 15/10 | ndiyo: ilirejeshwa kama `lsms_audit_20261015_0200` (ukaguzi wa GL) | **BAKI** (1 kati ya 2) - baada ya restore test mpya ya kutupwa |
| `backups\lsms_20261014_0200.dump` | 8.0 MB | 14/10 | **haijathibitishwa** | **BAKI** (2 kati ya 2) - restore test kwanza; ikishindwa → 04/10 |
| `backups\lsms_20261004_0200.dump` | 7.5 MB | 04/10 | haijathibitishwa | **FUTA** |
| `backups\prod_Lsms_20260930_1026_before_gl.dump` | 5.9 MB | 30/09 | haijulikani | **FUTA** (rekodi ya "kabla ya GL" - tazama swali Q-1) |
| `backups\prod_Lsms_20260929_2252.dump` | 5.9 MB | 29/09 | ilirejeshwa zamani | **FUTA** |
| `backups\prod_Lsms_20260927_2146.dump` | 5.8 MB | 27/09 | ilirejeshwa zamani | **FUTA** |
| `dump-Lsms-202607171654.sql` (plain SQL, PG 15.15, COPY 68) | 3.3 MB | 17/07 | - | **FUTA** (ya zamani, data ya wateja) |
| `BACKUPS AWS\backup_20260205_053622.sql` (COPY 1) | 3 KB | 05/02 | - | **FUTA** (AWS imestaafu) |

**Restore test (pendekezo, haijaendeshwa):** kwa kila dump inayobaki:
1. `docker run postgres:16-alpine` ya kutupwa;
2. `pg_restore --list`, kisha `pg_restore --exit-on-error`;
3. hesabu za jedwali + Flyway version;
4. `docker rm`. Hakuna DB ya kudumu inayoguswa.

**Kumbuka:** dumps hizi 2 ni za 14-15/10. Nakala mpya zaidi ziko kwenye server (`~/backups/daily`) na B2 (backup ya kila usiku). Ikiwa unataka dumps 2 za local ziwe za karibu na leo, nitaandaa hatua ya kupakua kutoka B2 kwa sha256 (kama 62). Uamuzi ni wako.

**Nje ya folda hii, lakini ni data ya wateja kwenye PC hii:** database za PostgreSQL ya local zenye nakala za prod. Kutoka kumbukumbu: `lsms_audit_20261015_0200`, `lsms_audit` (imegandishwa), `lsms_test_reco` (dev); huenda kuna nyingine za `lsms_prod_*`. Sikuziorodhesha, kwa sababu password ya PG ya local siitumii. Zinaweza kuorodheshwa kwa `psql -l` ukiendesha wewe.

### 9.3 Nakala za `.env` na faili za siri

| Faili | Git | Funguo (si thamani) | Pendekezo |
|---|---|---|---|
| `Lsms\Lsms\.env.backend` | ignored | `BACKEND_VERSION` tu | **BAKI** (si siri) |
| `Lsms\Lsms\.env.example` | ignored | DB_URL, DB_USERNAME, DB_PASSWORD, JWT_SECRET... thamani ni **mifano** ("your_…") | **BAKI** |
| `Lsms\nakala-application.properties-20261028-kabla-129` | hapana | defaults za `spring.datasource.password`, `jwt.secret`, `root.password` | **FUTA** (umeidhinisha). 67 ilijenga kwa faili la sasa: log ya 67 ina `PROPERTIES_ZILEZILE_KAMA_RC2` na `ROOT_PASSWORD_PROPERTY_SAWA` |
| `Lsms\Lsms\src\main\resources\application.properties` (gitignored, faili HAI la build) | ignored | bado lina defaults za DB/JWT | **BAKI**. Si takataka; kuondoa defaults ni kazi ya Toleo 2 §2.12, si usafi |

Hakuna `.env` ya prod/staging kwenye PC (ziko server tu). Hakuna `*.pem`, `*.key`, `*.jks` wala `*.p12`.

### 9.4 Folda za build (zinaundwa upya na `npm ci` / `mvn package`)

| Folda | Ukubwa | Tarehe | Pendekezo |
|---|---:|---|---|
| `LsmsVersion3\lsmsFrontV3-asset-counting\node_modules` | 275 MB | 06/10 | **FUTA** (inaondoka pamoja na worktree, jibu 1) |
| `Lsms\Lsms-hotfix-2272\target` | 99 MB | 26/10 | **FUTA** (pamoja na worktree) |
| `Lsms\Lsms-mikopo-230\target` | 100 MB | 29/10 | **FUTA** (pamoja na worktree) |
| `Lsms\Lsms-asset-counting\target` | 12 MB | 08/10 | **FUTA** (pamoja na worktree) |
| `LsmsVersion3\lsmsFrontV3-asset-counting\.angular` | 1 MB | 08/10 | **FUTA** (pamoja na worktree) |
| `LsmsVersion3\lsmsFrontV3\node_modules` | 275 MB | 06/10 | **BAKI** (inatumika) |
| `Lsms\Lsms\target` | 100 MB | 29/10 | **BAKI** (build ya 67; `mvn clean` inaisafisha yenyewe) |
| `Lsms\Lsms-ops-logs\target` | 95 MB | 28/10 | **BAKI** (kazi #2) - au FUTA, inaundwa upya |
| `LsmsVersion3\lsmsFrontV3\.angular` (cache) | 10 MB | 22/09 | **FUTA** (cache, inaundwa upya) |
| `LsmsVersion3\lsmsFrontV3\dist` | 0 | 22/09 | **FUTA** (tupu) |
| `lsms-print-agent\target` | 13 MB | 04/07 | **SIJUI** (inategemea kama print agent bado inajengwa) |

Kuondoa worktrees kunaokoa **~490 MB**. Cache/dist ni ~10 MB.

### 9.5 Log za zamani

| Faili | Ukubwa | Tarehe | Git | Pendekezo |
|---|---:|---|---|---|
| `Lsms\hs_err_pid24980.log`, `Lsms\replay_pid24980.log` | 73 + 967 KB | 31/01 | repo ya nje (staged) | **FUTA** |
| `Lsms\Lsms\hs_err_pid2972.log`, `hs_err_pid40712.log`, `replay_pid44020.log` | 69 + 87 + 916 KB | 22/09 | ignored | **FUTA** (JVM iliyoanguka 22/09) |
| `Lsms\Lsms\boot-run.log` | 68 KB | 02/06 | ignored | **FUTA** |
| `LsmsVersion3\ngbuild.log` | 4 KB | 27/09 | hapana | **FUTA** |
| `lsms-print-agent\logs\print-agent.*.log` (8) + `run_test.log` | 4.7 MB | 11/07-19/10 | (ya mradi) | **SIJUI**: huenda zina data ya risiti/wateja. Pendekezo: bakiza log ya mwisho (19/10), zilizobaki FUTA |

### 9.6 Faili/folda nyingine za zamani

| Kitu | Ukubwa | Tarehe | Pendekezo | Sababu |
|---|---:|---|---|---|
| `Lsms.zip` (faili 23: pom.xml, mvnw... - mradi wa awali) | 13 KB | 26/11/2024 | **ARCHIVE** (kwenye zip, kisha futa) | mwanzo wa mradi; historia |
| `download-backups.ps1` | 0.5 KB | 03/10 | **FUTA** | kichwa chake kinasema DEPRECATED (AWS), na `exit 1` |
| `doc lsms\sql script za ku add bidhaa.txt` | 21 KB | 11/06/2025 | **ARCHIVE** | script ya zamani ya kuongeza bidhaa |
| `Lsms\pending-migrations\V120__…sql` | 5 KB | 02/08 | **FUTA** | nakala sawa kabisa ya V120 ya main |
| `Lsms\.qodo\` | ndogo | 31/01 | **FUTA** (umeidhinisha) | |
| `lsms-print-agent\` (mradi) | 32 MB | 28/07 | **SIJUI** | bado inatumika dukani? Haijaguswa na kazi ya sasa |

### 9.7 Repo ya nje `D:\MY PROJECT\DUKA PROJECT\Lsms\.git` (kusoma tu, jibu 3)

- **Remote:** HAKUNA.
- **Commits:** 0. **Branches:** hakuna. Haijawahi kufanyiwa commit.
- **Index:** vitu 3 vilivyo "staged": `Lsms` (gitlink kwenda repo ya ndani), `hs_err_pid24980.log` na `replay_pid24980.log`. Folda nyingine zote (worktrees, nakala) ni untracked.
- **Hitimisho:** hakuna commit wala kazi ambayo haipo kwenye repo nyingine. Repo ya ndani `Lsms\Lsms\.git` (backend halisi, origin GitHub) inajitegemea, na worktrees zote zinaelekeza kwake, si kwa hii.
- **Pendekezo: FUTA** `Lsms\.git` ya nje, kwa idhini yako. Haigusi `Lsms\Lsms\.git`. Nitathibitisha `git -C Lsms\Lsms worktree list` kabla na baada.

### 9.8 Majibu ya §7 yaliyopokelewa (am) - yataingia kwenye mpango wa kutekeleza

1. Worktrees za asset-counting (backend + V3): **ondoa** (diff ziko kwenye zip).
2. `master` na `lsmsVersion01` (backend): tag `archive/master-20261029` na `archive/lsmsVersion01-20261029`, push tags, kisha futa branch local + origin. (master: local f290406 ≠ origin c38c763. Kila moja itapata tag yake, `archive/master-20261029` na `archive/master-origin-20261029`, ili zote mbili zibaki. Nithibitishie.)
3. `.qodo` **FUTA**; repo ya nje: tazama 9.7.
4. Zip: **B2** `archive/` (si `daily/`) **NA** diski nyingine ya PC. Ni diski gani? (njia/herufi ya diski)
5. Flutter source: baada ya #2 na kuondolewa kwa container ya prod.
6. Default ya zamani ya root: **ifichwe** (`***`) ndani ya zip.

### 9.9 Maswali mapya

- **Q-1:** `prod_Lsms_20260930_1026_before_gl.dump` ni hali ya kabla ya GL kujengwa upya (ushahidi wa ukaguzi wa mtaji/GL). FUTA kama ulivyosema, au iingie kwenye archive ya B2 (si PC)?
- **Q-2:** dumps 2 za kubaki: 14 na 15/10 (zilizopo), au nipakue 2 mpya kutoka B2?
- **Q-3:** diski nyingine ya PC kwa nakala ya zip: njia ipi?
- **Q-4:** `lsms-print-agent` bado inatumika? (inaamua target/ na log zake)
- **Q-5:** tag ya `master`: tag 2 (local + origin) sawa?

## 10. Mpango wa mwisho (mmiliki 29/10 ao) - hatua 71 (haijaendeshwa)

- **Orodha ya mwisho:** `steps\71-orodha.txt` (faili 1,378 kwenye zip; FUTA bila zip 23; folda 30; git 26). Injini `steps\71-usafi.py`, server `steps\71-usafi-b2.sh`.
- **Mpangilio wa 71-usafi.cmd:** zip -> sha256 -> kufungua kwenye folda ya muda na kulinganisha kila faili -> `D:\LSMS-ARCHIVE\` -> B2 `archive/2026-10/` (--immutable, kupakua tena, sha256) -> **KITUO: SAFISHA** -> kuondoa. Chanzo kilichobadilika baada ya zip hakiguswi. Hakuna commit (git rm tu).
- **Marekebisho ya orodha ya awali:**
  - default ya zamani ya root iko kwenye faili 11 za analysis/ (si 4) na scratchpads 10. Inafichwa (urefu uleule, `********`) kwenye kila faili la zip, na zip inakaguliwa kuwa haina.
  - `58b-prod-schedulers-soma.log` = BAKI (al).
  - scratchpads: `scratchpad\` tu ya kila kikao inaondolewa. `tasks\` (inayotumiwa na Claude Code) inabaki.
  - lsms-print-agent: print-agent.jar (build, 14.6 MB) haiingii zip. `device-password` imefichwa. **Shortcut ya Startup ya Windows** (inaiwasha kila login) inaingia zip, kisha inaondolewa.
- **Haviko kwenye 71 (vinasubiri jibu):** dumps (Q-1, Q-2), `Lsms\.git` ya nje (9.7), Flutter source (baada ya #2).
- **DB za local: `steps\71-db.cmd`** (password yako). Inaanza kwa kusoma (ukubwa + miunganisho), kisha KITUO SAFISHA, kisha DROP **tatu tu**: lsms_audit, lsms_audit_1004, lsms_toleo1_scratch.
  - **Ugunduzi:** spring.datasource.url ya properties ZOTE za local (Lsms, Lsms-hotfix-2272, Lsms-mikopo-230) ni `lsms_test_reco`, si LocalLsms wala LsmsAngular.
  - IntelliJ inataja `Lsms`.
  - Kwa hiyo lsms_test_reco / LocalLsms / LsmsAngular / Lsms zimewekwa SUBIRI-UAMUZI.
- **Grep ya majina yanayofutwa:** hakuna properties, script wala hatua hai inayotaja lsms_audit, lsms_audit_1004 au lsms_toleo1_scratch. Yanatajwa tu kwenye ripoti za zamani (gl-audit, capital-funding, returns-exchange/SOMA.md), ambazo zinaingia zip.
