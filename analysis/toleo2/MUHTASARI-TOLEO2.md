# MUHTASARI WA TOLEO 2 — ukaguzi wa mwisho (fi/fj, 12/11/2026)

nimesoma hadi (ge)

Toleo 2 = backend **release/2.5.0** (V139–V151; prod sasa Flyway 138 kwa hatua 91 ya 12/11, nakala ya 29/10 = 134) + V3 **release/3.3.0**. Prod **Jumatano 02/12**, D **Jumatatu 07/12** (Qff-1).
Push imethibitishwa kwa `git ls-remote` (12/11): matawi yote ya t2-* (backend na V3) na `main` yalikuwa sawa na origin kabla ya kazi ya (fj).

Kwa nini nimeweza kuthibitisha kwa data tu sehemu: siwezi kuingia prod (ssh: `Permission denied (publickey)`), kwa hiyo yote ya prod
yako kwenye **hatua 91** (kusoma tu) ambayo Chief anaiendesha mara moja: Jagger, Flyway, D, akaunti za pesa, mikopo + hatua 90 (Flutter).

## 1. Jedwali

Hali: **IMEKAMILIKA** = code + majaribio kwenye nakala safi ya 29/10; **BADO** = kazi yangu kabla ya release; **BAADA** = nje ya toleo 2 (uamuzi wa Chief);
**CHIEF** = inasubiri hatua/jibu la Chief (halijatolewa, si swali jipya).

| Kipengele | Tawi (backend / V3) | Commit (backend / V3) | Majaribio (namba) | Hali | Hatua ya data baada ya deploy |
|---|---|---|---|---|---|
| G1 scheduler: mwezi wa sasa tu, kipindi kilichofungwa -> kataa | t2-gharama | 1ef3b08 / 6c34ca7 | suite 605/0/1, mutation 2/2 | IMEKAMILIKA | — (watoto 12 wa 12/2026–11/2027: uamuzi wa Chief, hawadhuru GL) |
| G2 Stop + mwezi huu (reversal kwa sababu) | t2-gharama | 9c496b8 / 6c34ca7 | g25 31/0 | IMEKAMILIKA | — |
| G3 onyo la nakala | t2-gharama | 9c496b8 / 6c34ca7 | g25 31/0 | IMEKAMILIKA | — |
| G4 "Imepangwa" + orodha baada ya kuhifadhi | t2-gharama | 9c496b8 / 6c34ca7 | g25 31/0 | IMEKAMILIKA | — |
| G5 gharama za mwaka (V140, 1160; CEO kujiidhinisha kwa sababu) | t2-gharama | 9c496b8 / 6c34ca7 | g25 31/0 | IMEKAMILIKA | malipo ya 2027 kupitia G5 |
| Kazi 2 / G6 "Lipa deni" (V141, 2400/2200) | t2-gharama | 9c496b8 / 6c34ca7 | suite 626/0/1, g6 13/0, E2E 13/13 | IMEKAMILIKA | 01/01/27: 2400 600k, 2200 65k kupitia G6 |
| Kazi 3 chini ya gharama: sababu + BELOW_COST (V142) | t2-gharama | 9c496b8 / 0f405df, a1d976c | unit 5/0, mutation 3/3, suite 632/0/1, k3 20/0, E2E 14/14 | IMEKAMILIKA | — |
| KUPIMA (V143, wazazi wengi, faida kwa chombo) | t2-kupima | d5b35f5 / f0f8667 | suite 648/0/1, kupima_api 28/0, kupima 14/0, t85 21/0 | IMEKAMILIKA | **85** (uhamisho wa KUPIMA, baada ya Chief kuhesabu) |
| Kazi 4 tozo kwa gharama (V144) + Q4-3 NBV | t2-tozo | 55b1d26 / af82b73 | unit 13/0, mutation 2/2, suite 652/0/1, tozo_api 21/0, tozo 8/0 | IMEKAMILIKA | — |
| Ripoti / exclude_from_ops_report (V145) | t2-ripoti | d92da83 / 80407f7 | PG 6/6, t89 7/0 | IMEKAMILIKA | **89** (Frame/TRA Nov nje ya ripoti) |
| Kazi 5 kanuni za hesabu ya stock (V146) | t2-hesabu | dfbfc4d / bddc178 | suite 661/0/1, ng 102/102, hesabu_api 22/0, hesabu 9/0 | IMEKAMILIKA | — |
| 6a "Umelipa sasa" iliyopotea | (hatua ya data) | steps/74 | t74 (ununuzi 18 -> PAID) | IMEKAMILIKA (script) | **74** |
| 6c Jess 2310 (V147) + 7 ripoti kwa avg | t2-pesa | 1d8abb3 / 959cad4 (e97f817) | c3 + SupplierPaymentSourceTest | IMEKAMILIKA | — |
| 6e (ga) ONYO TU "Linganisha manunuzi": reco ya droo siku X vs manunuzi/malipo ya DROO X±1 (CEO kwenye reco, mnunuzi kwenye Manunuzi); hakuna mstari wa AUTO, hakuna GL mpya; kuanzia 02/12 | t2-cutover | 62a82b6 / (V3 t2-cutover) | PurchaseCheckTest 4/0, manunuzi_onyo_api 4/0, manunuzi_onyo UI 1/0, ng 104/104 | IMEKAMILIKA | — |
| (gb) manunuzi bila msambazaji baada ya D -> Cr ya chanzo kilichochaguliwa; chanzo LAZIMA (C3 tayari) | t2-cutover | (hakuna mabadiliko) / manunuzi_chanzo_api | manunuzi_chanzo_api 3/0 (NMB -> Cr 1021, Taslimu -> Cr 1000, bila chanzo -> imekataliwa) | IMEKAMILIKA | — |
| (gb) 74b: manunuzi YOTE bila msambazaji + UNPAID -> PAID bila journal (sheria, si orodha) | analysis/steps | 74b-bila-msambazaji.{sh,ps1,cmd} | t74b 4/0 (nakala 29/10: 307 / 37,600,452, 30/09-28/10, GL-SAWA 307, GL haibadiliki) | IMEKAMILIKA (script) | **74b** baada ya deploy (KAGUA -> STOP -> ANDIKA) |
| 6d 1010 akiba ya mkopo | — | — | — | BAADA (Qff-1) | — |
| H1 kizingiti cha Health (V139) | t2-afya | 2a64f7e / e70d2ba | suite + afya e2e | IMEKAMILIKA | — (mwelekeo unaanza siku ya deploy) |
| Cutover: reco -> 102x/103x baada ya D | t2-cutover | 8dd0a2d, 2be5211 / cb4e895 | cutover_api 16/0 | IMEKAMILIKA | **60** siku ya D |
| Uhamisho wenye ada (6130, V149) + sababu + kinga ya kabla ya D | t2-cutover | d9498e1 / 61a618e | cutover_api 16/0 (T7–T14) | IMEKAMILIKA | — |
| Tofauti ya ufunguzi 2910 (V150, Qff-2) | t2-cutover | 7140df4 / — | t60 14/0 | IMEKAMILIKA | **60** |
| (fj) akaunti zote wazi + kinga: zinazotumika juu, "una uhakika?" > siku 60, "Salio kwa akaunti" | t2-cutover | 710fa5a / e4b87fe | akaunti_e2e 5/0, ng 103/103, t60 14/0 (akaunti 9) | IMEKAMILIKA | **60** (akaunti zote 9 zinapata salio la ufunguzi) |
| (fk) malipo baada ya D: kila njia -> akaunti yake; V151 check ya payments/credit_payments = njia zote (Selcom/PCB/Airtel/BANK_TRANSFER/MOBILE_MONEY zilikataliwa) | t2-cutover | ca82e61 / (e2e kwenye t2-cutover) | malipo_d_api 15/0 (kabla 10/5), PaymentMethodCheckMigrationTest | IMEKAMILIKA | — |
| (fl) mpaka 02/12: mwongozo kwa Macheda (njia 8 za prod; Selcom→NBC, PCB→CRDB, Airtel→Halo Pesa) + (fq) utaratibu wa sasa (POS = CASH, simu/benki kwenye reco) unaendelea baada ya D | analysis + t2-cutover | 95856a4 / (e2e) | 91-5 prod: CHECK_ILIKATAA 0, POS CASH 693/701; cutover_api 12/0 (T10: POS yote CASH + reco -> Dr 102x/103x / Cr 1000 kiasi cha reco tu) | **IMEKAMILIKA** (fq: hakuna athari, (fl) imefungwa) | — |
| (fr) KANUNI MOJA: POS = Taslimu; reco ya simu = jumla ya siku kwa mtandao; amana = kila pesa iliyoingia benki. Fomula ya reco + uhamisho: kwa kila mtandao max(iliyoandikwa, AUTO ya POS); amana ya benki − kilicholipwa na POS kwa benki hiyo | t2-cutover | 5b198a6, 6f987e8 / (V3 chips + e2e) | MobileMoneyOneRuleTest 7/0 (mutation 4 fail), cutover_api 16/0 (T11–T14; kabla: T12/T13 reco 2P), malipo_d 15/0, ng 104/104 | IMEKAMILIKA | — |
| (fu) mwongozo: reco = malipo ya wateja ya leo kwa kila njia (si salio); muuzaji haandiki uhamisho/cash→benki/mikopo; CEO anahakiki fedha + manunuzi kwa chanzo halisi; kila uhamisho halisi baada ya D = Transfer ya GL; lipa namba = VODACOM → 1030 | analysis + t2-cutover | (mwongozo) / pengo_d_api | pengo_d_api 3/0 (bila Transfer: 1023 +10k, 1021 −50k; na Transfer: 0 / −40k) | IMEKAMILIKA | — |
| (fv/fw) droo→benki MARA MOJA na aliyeipeleka (reco/sefu); Transfer ya CEO = harakati zisizoandikwa tu (Selcom→NMB, 1030→benki + makato 6130); onyo la Transfer 1000→102x = amana ya siku ile; ukaguzi wa wiki | t2-cutover | 1fe2ee7, 4b1a727 (fx ±1 siku) / 6cde43c | suite 677/0/1 (1fe2ee7), TransferDuplicateTest 4/0, pengo_d_api 6/0 (P4 onyo, P6 ±1 siku, P5 1030→NMB 100k ada 1.5k), uhamisho_onyo UI 4/0, ng 104/104 | IMEKAMILIKA | — |
| C4 marejesho (V148), swichi OFF | t2-marejesho | a268e3f / 326a90f (kwenye t2-cutover) | marejesho_api 14/0 (ON) + 1/0 (OFF), marejesho UI 4/0 + 1/0, unit 663/0 | IMEKAMILIKA | — (Chief anawasha swichi baadaye) |
| Jagger: SKU 4 | (data, Chief) | — | hatua 91 sehemu 1 sasa inasoma UJAZO (item_measure.unit_type): 350 / 750ML / 200ml / 1L, JAGGER_BILA_UJAZO 0 | **IMEKAMILIKA** (fn/fo: saizi ziko kwenye ujazo; 1LT/750ml "6 pcs/pkg" ni sahihi; kategoria = Chief) | — |
| Usafi 9: config junk lines (BAADA §6: `git211`, `git spring.jpa.show-sql=false`) | t2-cutover | 3286f3a | suite 682/0/1; image 3286f3a inawaka (Flyway 151, ERROR 0), cutover_api 16/0 | IMEKAMILIKA | — |
| Usafi 9: C9 deploy-v3 `ssh -n` | V3 | fd67e97 (21/10) | `deploy-v3.ps1` mistari 155 na 209: `ssh -n` (ssh zote 2); iko kwenye release/3.2.0 (prod) | IMEKAMILIKA (tayari) | — |
| Usafi 9: build safi (`mvnw clean package`) | t2-cutover | 92a6e60 | V151 iliyobatilishwa ilibaki target/ -> imezuiwa | IMEKAMILIKA | — (kanuni ya release: image kutoka worktree safi + clean) |
| Usafi 9: C7 code iliyokufa (Flutter) | — | — | hatua 90 (12/11): watumiaji wa FLUTTER siku 30 = 0, lakini mteja "NYINGINE" (mtumiaji 1, audit Sales 35) | BAADA (code ya Flutter haiondolewi) | — |
| Usafi 9: C6 backup_20260930_journal_entry -> B2 (sha256) -> DROP | (hatua ya data) | — | — | **BAADA ~09/12** (gd): KAGUA -> ANDIKA, BAADA ya kuthibitisha dump ya B2 ina backup table; HAIFUTWI kwenye 2.5.0 | **C6** ~09/12 |
| Usafi 9: V039 / Flyway outOfOrder | — | — | — | BAADA (fk) | — |
| Usafi 9: M1 (dx/gd): ondoa MaterializedViewScheduler + refresh ya SaleService | t2-cutover | 116dd75 + a645cf6 | Sale* tests 0 kosa, suite 682/0/1; **rollback** (M1-mv/rollback-240.log): DB ya 2.5.0 (Flyway 151, V139/V148) + image 2.4.0 -> inawaka, Flyway onyo tu (151 > 138), ERROR 0, refresh ya 2.4.0 + REFRESH CONCURRENTLY sawa | IMEKAMILIKA | — |
| DROP view 4 (mv_daily/hourly/monthly/top_products) + initializer + repository | (migration/hatua tofauti) | — | — | **BAADA ~09/12** (gd): siku 7 baada ya prod 02/12 bila rollback; HAIFUTWI kwenye 2.5.0 (2.4.0 inaihitaji kwa rollback) | **DROP-MV** ~09/12 |
| Usafi 9: §17 DISPOSED (check ya capital_expenditure.status) | — | — | — | BAADA (Q4-3) | — |
| Usafi 9: UTF-16 build log | analysis/steps | 76-deploy-240.ps1 | 76-pc-build.log (09/11): NUL 594,542 kati ya byte 1,191,146 (Tee-Object -Append ya PS 5.1 = UTF-16LE ndani ya log ya UTF-8). Sasa `Add-Content -Encoding UTF8`; jaribio `-NoProfile`: ya zamani NUL 33, mpya NUL 0, exit code inafika (3 = 3) | IMEKAMILIKA (script ya deploy ya 2.5.0 itanakili 76) | — |
| F1 footer "Babuu Liquor Store" (eg) | V3 (config) | 6c34ca7 (10/11) | `environment.prod.ts` ownerName = 'Babuu Liquor Store' (shell footer + login); iko t2-cutover -> 3.3.0 | IMEKAMILIKA | — |
| Wasambazaji marudio (Takawedo ×3: takawedo/Takawedo/TAKAWEDO; Serengeti ×3: Serengeti/SERENGETI/NEEMA SERENGETI) + manunuzi 241 ya jina tu bila supplier_uid (Takawedo 234, Pepsi 7) | — | — | — | **BAADA — Desemba, baada ya D** (gc: usijenge sasa) | — |
| §14, §16, ulinganisho wa benki wa mwezi | — | — | — | BAADA (Qff-1); "Salio kwa akaunti" (fj 4) ni toleo rahisi lake | — |

## 2. Hatua za data (mpangilio)

| Lini | Hatua | Nini |
|---|---|---|
| Kabla ya release (sasa) | **91** kagua | prod kusoma tu: Jagger, Flyway, D (lazima HAIJAWEKWA), akaunti za pesa, mikopo, 5 (fl) + 90 (Flutter) — IMEFANYIKA 12/11; tena kabla ya deploy |
| Baada ya deploy 02/12 | **74** | ununuzi 18 -> PAID (bila journal) |
| Baada ya deploy | **74b** kagua -> andika | manunuzi yote bila msambazaji + UNPAID -> PAID (bila journal; idadi ya KAGUA inatajwa kwenye ANDIKA) |
| Baada ya deploy | **89** | Frame/TRA Nov nje ya ripoti ya uendeshaji |
| Baada ya deploy + hesabu ya Chief | **85** | uhamisho wa KUPIMA |
| ~09/12 (siku 7 bila rollback) | **DROP-MV** | migration/hatua tofauti: DROP view 4 + kuondoa initializer/repository |
| ~09/12, baada ya kuthibitisha dump ya B2 ina backup table | **C6** kagua -> andika | backup_20260930_journal_entry -> B2 (sha256) -> DROP |
| 04/12 | — | Loan A awamu 2 kwenye app (Cr 1000), hakuna kazi |
| **07/12 asubuhi (D)** | **60** kagua -> andika | salio la ufunguzi kwa akaunti ZOTE 9 za benki/simu + tofauti -> 2910 + D |
| 07/12 + siku 30 | journal ya mkono | 2910 chambua; kisichoelezeka -> 3900 (CEO + taarifa kwa Executive CEO) |

## 3. Kilichobaki kabla ya kuunganisha (kazi 10)

Ratiba (fx): 6e + usafi 9 viishe **~20/11**; kazi 10 (unganisha + lango + staging) siku 3–4 kabla ya **25/11**; prod 02/12.


1. ~~6e~~ IMEKAMILIKA (ga: onyo tu).
2. ~~Usafi 9~~ IMEKAMILIKA (gd): M1 (scheduler tu), junk lines, UTF-16; C9 na F1 tayari. DROP view 4 + C6 -> ~09/12. Suite 682/0/1, ng 104/104.
   (Flyway ya toleo 2 sasa 134 -> 151; view 4 zikidondoshwa kwa migration -> V152.)
3. **Kazi 10 (ge) — hali 12/11:**
   - Kuunganisha: backend `release/2.5.0` = t2-cutover + t2-marejesho (mgongano: compose ya local tu) + t2-afya + version 2.5.0 (b764632; zana za lango dfa054c).
     V3 `release/3.3.0` = t2-cutover + t2-afya + version 3.3.0 (4712a1a; zana 5742790). Bado hazijapushwa (push-yote).
   - Flyway V139–V151: 13, kila namba mara moja, hakuna pengo, hakuna namba iliyorudiwa kwenye folda.
   - NOT NULL kwenye jedwali ZILIZOPO (2.4.0 inaziandikia): `capital_expenditure.removed_accumulated` DEFAULT 0 (V144),
     `capital_expenditure.exclude_from_ops_report` DEFAULT FALSE (V145). Mengine yote ni jedwali mapya au safu nullable;
     check za V142/V151 ni pana zaidi; hakuna trigger.
   - Rollback kwa kuandika (2.4.0 juu ya schema 151): sale Taslimu, deni + malipo, reco hadi APPROVED, manunuzi yameidhinishwa,
     hakuna gl_posting_failure, TB 0 — rollback_kuandika 5/0; 2.5.0 inawaka tena juu ya DB ile ile.
   - Lango: `deploy/local/lango.sh <dump>` (suite + pg-checks, payment_method kabla ya migrate, Flyway -> 151, c2, E2E A/B, rollback).
     Dump ya B2 ya karibuni: **hatua 92** (Chief) -> lango -> staging (**hatua 93**: refresh-db, deploy, kazi, rollback, deploy) -> prod 02/12.
   - Lango la MAZOEZI (dump 29/10, 12/11): suite 691/0/1, pg-checks 6/6, payment_method HAIKUBALIKI 0, Flyway 134 -> 151 (zote true),
     c2 2/2, E2E awamu A 26/29. Matatu yaliyoshindwa yamechunguzwa: b2 = faili za GeoIP za majaribio hazikuwa kwenye worktree mpya
     (zimewekwa + lango linakagua sasa); k3 + kupima_api = cutover T10 iliidhinisha reco ya LEO ya Macheda (kinga A6 sahihi) -> sasa
     muuzaji wa E2E (ba74aab): cutover 16/0, k3 20/0, kupima_api 54/0. Awamu B + rollback hazikuendeshwa (script ilibadilishwa
     ikiendeshwa - kosa langu, imerekebishwa). Lango la pili lilisimamishwa na mfumo (RAM ndogo) wakati wa suite.
   - **(gg)/(gh) 12/11 — main ndiyo chanzo pekee** (local -> main -> staging -> prod; release/* hazitumiki tena):
     tag v2.4.0 -> 9b6678a na v3.2.0 -> 922c3ac zipo origin (V3 main = v3.2.0 nje ya analysis/ kabla ya kuunganisha). Hotfix kabla
     ya 02/12 = `hotfix/*` kutoka tag hizo. Imeunganishwa: backend main **983b202** (+ 3b6bf61 njia ya E2E ya lango) = tree ya
     release/2.5.0; V3 main **7b6fda2** = release/3.3.0 nje ya analysis/. is-ancestor: feature/t2-* 9 (local + origin) + release
     + tag -> zote ndani ya main, repo zote mbili. `93-deploy-250.cmd build <be> <v3>`: commit/tag lazima itajwe, iwe ndani ya main,
     code ya HEAD = code yake, tree safi; SHA kamili -> log + 93-build-commits.txt (majaribio 5/5). Baada ya prod: tag v2.5.0/v3.3.0
     kwenye SHA hizo.
   - **(gi) 12/11:** release/2.5.0 + release/3.3.0 (local) na worktree zake zimefutwa (zote zilikuwa ndani ya main; log za lango
     la mazoezi zimehifadhiwa: `toleo2/lango-mazoezi-1211/`). **feature/t2-* HAZIFUTWI hadi baada ya prod 02/12 bila rollback
     (~09/12)**, pamoja na DROP-MV/C6. **Tag hazifutwi kamwe.** Push ya main: baada ya lango kupita.
   - **Kinga A6 baada ya muuzaji wa E2E** (gf 4 / gi): `deploy/local/e2e/a6_api_e2e.cjs` (HTTP, muuzaji wa E2E, siku 2 huru baada ya
     kuhesabu mali; inaruka leo/jana na 01-08/11 za majaribio mengine) **7/0** kwenye dump 29/10 (image b764632): A1 kabla ya
     kuidhinisha badiliko linaruhusiwa (kidhibiti); A2 reco IMEIDHINISHWA; A3 muuzaji kubadilisha -> RECO_APPROVED, sale haijabadilika;
     A4 CEO pia anakataliwa; A5 kufuta kunakataliwa; A6 kuhamisha sale ya siku nyingine kwenda siku iliyoidhinishwa kunakataliwa;
     A7 Macheda halisi hajaguswa. Matrix ya unit: `SaleChangeGuardTest` (suite). Inaendeshwa na run-all (awamu A ya lango).
     (gk) A8: muuzaji hawezi kufungua (imekataliwa); CEO anafungua kwa sababu -> muuzaji bado NEEDS_CEO; CEO anafuta sale ->
     ALLOWED (audit REOPENED + sababu); imeidhinishwa tena; GL ya sale net 0, TB 0 -> **11/0**. TAARIFA A8e: reversal imeandikwa
     tarehe ya KUFUTA (12/11), si ya sale (10/11) - `PostingEngine.reverse` kwa muundo. Swali kwa Chief (wazi).
   (mpango wa awali:)  unganisha t2-* -> release/2.5.0 na release/3.3.0; lango kamili kwenye nakala safi (suite + PG + c2 + run-all E2E, Flyway 134 -> 151 kwenye nakala ya 29/10, 138 -> 151 kwenye prod);
   script ya deploy (kama 76) + rollback; staging; prod 02/12.

Kwa Chief kuendesha (si maswali): hatua 91 mara moja kabla ya deploy (D lazima HAIJAWEKWA). Mengine yote yameamuliwa (fk).
