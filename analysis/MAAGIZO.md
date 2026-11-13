# MAAGIZO ya mmiliki

Kila ujumbe wa mmiliki wenye kichwa "## 2026-…" unahifadhiwa hapa KWANZA, kama ulivyo, kabla ya kufanyiwa kazi (mmiliki 28/10 y).
Kila ripoti inaanza kwa "nimesoma hadi (<herufi ya mwisho>)".

## 2026-10-28 (w) — ukaguzi wa diff ya 2.3.0
1. Mkopo A baada ya V900: principal=amount (1,186,000), riba 0, start_date=transaction_date, hakuna installments.
   Marekebisho ya A (POST /loans/{uid}/corrections) lazima, kwa transaction MOJA: journal Dr 2100 28,000 + Dr 1150 158,000 /
   Cr 1021 186,000 tarehe 04/10/2026; masharti principal 1,000,000, riba 158,000, start 04/10/2026, end 04/01/2027, MONTHLY;
   installments 3 × 386,000 (04/11, 04/12, 04/01); kisha riba ya kufidia kuanzia 04/10. Thibitisha kwa jaribio linalotumia
   data halisi ya A na B kutoka log ya 58 (journal zao za asili). Mkopo B: ONCE, 1,200,000, due 28/11, riba 0 — ikiwa
   journal yake ya asili si Dr 1200, pendekeza marekebisho.
2. Kinga: LOAN_RECEIVED ya mkopo wenye marekebisho hai isipostiwe upya (retry/backfill/replay) — vinginevyo 1150/2100
   zinahesabiwa mara mbili. Jaribio.
3. LoanInterestScheduler ni @ConditionalOnProperty app.schedulers.enabled (matchIfMissing=false): thibitisha thamani yake
   kwenye prod (env/properties) na ya CapitalExpenditureScheduler. Ikiwa haipo → riba haiandikwi kimya. Staging ithibitishe
   kwamba job ya 00:05 inaendeshwa (log + journal LOANINT).
4. Malipo yaliyoingizwa kabla ya 2.3.0 (mf. 04/11 kwa njia ya sasa): yagawanywe FIFO kwenye installment ya kwanza wakati
   wa marekebisho/migration. Jaribio. Na jibu (u).
5. Niletee mmiliki S-A…S-D kama maandishi.

## 2026-10-28 (x) — majibu S-A…S-D (2.3.0)
S-A: bank_cutover_date = hatua ya script yenye namba (SQL), si endpoint. Kinga: D ≥ tarehe ya malipo ya mwisho ya mkopo
     yaliyokwisha andikwa; log ya hatua = rekodi. Itaendeshwa siku ya kukata pamoja na journal ya ufunguzi. Andaa tu.
S-B: ZUIA njia ya CapitalExpenditure LOAN_PAYMENT (postLoanPayment, Dr 6600) kwa mikopo YOTE; ujumbe uelekeze
     POST /loans/{uid}/repay. Kwanza, KUSOMA TU kwenye prod: je, kuna malipo yaliyowahi kuingizwa kwa njia hiyo
     (idadi, tarehe, kiasi, journal)? Jaribio la kuzuia.
S-C: akiba ya ripoti ISIMAME siku ambayo 2100 ya mkopo inafika 0; riba (1150→6600) inaendelea kwa ratiba. Jaribio (23.m).
S-D: mikopo iliyohamishiwa mtaji = CLOSED kwenye migration — IMEKUBALIWA.
Kumbuka: (w) bado inasubiri majibu yako (marekebisho ya A yaweke masharti + awamu + start 04/10 kwa transaction moja;
kinga ya replay ya LOAN_RECEIVED; app.schedulers.enabled kwenye prod; malipo ya kabla ya 2.3.0 → FIFO; jibu la (u)).
Anza ripoti yako kwa "nimesoma hadi (x)".

## 2026-10-28 (y)
1. UNDA analysis/MAAGIZO.md sasa. Bandika humo (w) na (x) na hii (y) kama zilivyo. Kuanzia sasa: kila ujumbe wa mmiliki
   wenye kichwa "## 2026-…" uuhifadhi humo KWANZA kabla ya kuufanyia kazi; anza kila ripoti kwa "nimesoma hadi (<herufi>)".
2. Mkopo B: pendekezo lako (journal ya asili Dr 1000 ibaki; masharti tu: ONCE, 28/11, riba 0) — IMEKUBALIWA.
3. Staging ya 2.3.0: APP_SCHEDULERS_ENABLED=false kwenye staging inazuia LoanInterestScheduler hata ukibadilisha saa.
   Kwa jaribio la riba, washa scheduler ya riba PEKE YAKE (setting tofauti), au thibitisha njia nyingine — si schedulers zote.
4. Mkopo wa tatu INJ-7a64c10a (244,985, umelipwa 11/06): mmiliki atathibitisha; usiubadilishe.
5. Faili RIPOTI-KAZI-28-10.md lilikuwa "busy" (liko wazi kwenye editor) — usilazimishe kuliandika.
Kisha subiri log ya 58.

## 2026-10-28 (z)
58 imeshindwa kwenye D2 (kusoma tu, hakuna kilichobadilika):
  ERROR: operator is not unique: text || "char"  →  ... || '|' || d.deptype ...
Rekebisha: d.deptype::text (na safu nyingine yoyote ya aina "char" kwenye SQL za 58). Jaribu SQL nzima ya 58 kwenye PG16
ya kutupwa (si sehemu iliyobadilika tu) kabla ya kunipa amri. Kisha eleza kwenye ripoti:
 - 2100 tarehe 10/10 = 3,386,000 → 11/10 = 2,386,000 (1021 pia −1,000,000): ni reversal ya usajili wa kwanza wa A
   (PUT ya zamani)? Onyesha journal husika.
Hifadhi (y) na (z) kwenye analysis/MAAGIZO.md kama bado hujafanya.

## 2026-10-28 (aa)
58 OK. Hitimisho: reversal ya 11/10 = PUT ya zamani (imeelezwa); B = Dr 1000 (ibaki); mkopo wa 3 = MKOPO WA BANK, umefungwa;
S-B = 0; D2 inategemewa na index yake tu.
SWALI KUBWA: SCHED_JOURNAL_MWISHO = 2026-10-05 00:10, jumla 23 — hakuna journal ya scheduler kwa siku 23.
1. Andaa 58b (KUSOMA TU), nitaiendesha kesho 29/10 baada ya 00:15: log ya backend (container ya sasa, tangu 28/10 09:41) —
   kila mstari wa "[Scheduler]" / "⏰" / CapitalExpenditureScheduler / depreciation / recurring, saa zake; na thamani ya
   app.schedulers.enabled kama backend inavyoiona (kutoka log ya boot au actuator ikiwa ipo, bila kubadilisha config).
   Hitimisho: SCHEDULERS_ZINAENDESHA (zimeandika log saa 00:05/00:10) au HAZIENDESHI.
2. Eleza kutoka code kwa nini scheduler isiandike journal kati ya 05/10 na leo (hakuna recurring/due capex?) — soma DB
   (KUSOMA TU): recurring expenses zilizopaswa kuzalishwa tangu 05/10, capex APPROVED zenye due_date ≤ leo bila journal.
3. Kama HAZIENDESHI: 2.3.0 haiendi prod mpaka zirekebishwe (riba ingekuwa kimya). Pia depreciation ya 01/11 iko hatarini.
4. Endelea na maandalizi ya staging ya 2.3.0 (hatua 61-… — usitumie 58/59/60), pamoja na jaribio la riba (scheduler ya riba
   iwashwe peke yake kwenye staging).

## 2026-10-28 (ab)
Staging ya 2.3.0: njia C (2.3.0-rc1 kutoka worktree ya mikopo; hatua za prod zikatae tag yenye -rc; script ya deploy
haibadilishwi), NA:
 1. Migration ipewe namba ya mwisho SASA: V135__Loans_Interest_Schedule.sql (si V900) — mikopo inafika prod kwanza;
    sales returns itapewa namba mpya wakati wa merge yake (MATAWI.md). Rekebisha majaribio/hatua zinazotaja V900.
    Kinga ya Assert-ReleaseBranch itakataa V135 kwa sababu main haina — sawa kwa rc (hatua ya staging peke yake).
 2. Mpangilio kamili: rc1 → staging (61–66, majaribio yote) → merge feature/mikopo-2.3.0 → main → build 2.3.0 kutoka main
    → staging tena kwa ukaguzi mfupi (digest, Flyway 103/135, hali-root, riba ya siku moja) → prod kwa digest ileile.
    Andika hatua hiyo ya mwisho ya staging kama sehemu ya mpango.
 3. Jaribio la riba staging: APP_LOANS_INTEREST_SCHEDULER_ENABLED=true + APP_SCHEDULERS_ENABLED=false — sawa.
 4. Kabla ya rc1 kufika staging: staging irudishwe kutoka dump mpya ya prod (kama 45b), ili marekebisho ya A yajaribiwe
    kwenye data ya leo (journal halisi za 58). Andaa hatua hiyo.
Andika 61–66 na ujaribu kwa fakes. 58b nitaiendesha kesho baada ya 00:15.

## 2026-10-28 (ac)
61–66: IMEIDHINISHWA. Rudia kesi 3 zilizobaki (65 bila mzunguko wa cron, 66 bila backup, digest isiyo halali) baada ya
marekebisho ya 63, kabla ya kesho asubuhi — mmiliki atafunga programu nyingine ili RAM itoshe.
62/63 zitaendeshwa kesho asubuhi baada ya reco (staging iko server moja na prod). 61 inaweza kuendeshwa leo.

## 2026-10-28 (ad)
Mmiliki: 61–66 LEO, sasa (prod inatumika — 57c ilionyesha restart ya staging haigusi prod). Kabla 66 haijafika,
rudia kesi 3 zilizobaki kwa fakes (65 bila cron, 66 bila backup, digest isiyo halali). Mmiliki ataendesha 61 sasa.
Nisaidie hatua kwa hatua; usibadilishe script inayoendeshwa.

## 2026-10-28 (ae)
64 kwenye staging (rc1): FAIL 16. Chanzo: SQL ya LoanLedger inaunganishwa bila nafasi → "WHERENOT COALESCE(j.is_deleted…".
Kila endpoint ya mikopo inayosoma salio inashindwa (GET /loans, dryRun, corrections, repay, PUT). Hakuna kilichoandikwa
(2100 2,386,000; journal 3→3, 1→1; TB 0). Log imeambatishwa.
1. Rekebisha. Kagua KILA SQL ya native/JPQL iliyojengwa kwa kuunganisha string kwenye code yote ya 2.3.0 (LoanLedger,
   GlPnlService, n.k.) kwa kosa la aina hiyo.
2. Jaribio linalokamata hili: SQL halisi inayojengwa na Java wakati wa kuendesha (si nakala ya maandishi ya faili)
   iendeshwe dhidi ya PG16 — mf. jaribio linaloita method halisi za LoanLedger/GlPnlService kwa DataSource ya PG ya kutupwa,
   au kunasa string kutoka kwenye query ya runtime. Mutation: ondoa nafasi → jaribio lazima lishindwe.
3. Build 2.3.0-rc2 (tag mpya, rc1 isitumike tena), kisha 63 (rc2) → 64. Staging tayari ina V135 — thibitisha 63 inakubali hilo.
4. Kwa nini "SQL_SAWA|103 38" kwenye 0-sql-na-flyway-135 (nilitarajia 103/135)? Eleza au rekebisha ukaguzi.
5. Usiendeshe 66 mpaka 64 ipite.

## 2026-10-29 (af)
61b imesimama kwenye LOAN-SQL-PG16: LoanSqlPgCheck:77 expected 115065.25 but was 113347.86. Code ni sahihi (26 × 1,717.39
hadi leo 29/10); jaribio limeandikwa kwa tarehe 28/10. Rekebisha: jaribio litumie saa iliyowekwa (Clock / today supplier =
tarehe ya kudumu, mf. 2026-10-28) AU lihesabu matarajio kutoka tarehe hiyo — lisitegemee LocalDate.now(). Hakikisha majaribio
mengine ya 2.3.0 (23.p n.k.) hayana tegemeo hilo hilo. Thibitisha pia kwamba mistari ya "[Scheduler] … Kipindi 2026-09
kimefungwa" na "result is null" kwenye log ya 61b ni ya majaribio mengine ndani ya mazingira ya test, si ya prod.
Kisha nitaendesha 61b tena.

## 2026-10-29 (ag)
58b: log ina "SCHED_LOG 2026-10-29 00:05:00 … [Scheduler] Starting daily recurring expense processing..." lakini hitimisho
lilisema SCHEDULERS_HAZIENDESHI. Kwa ushahidi huo, schedulers za prod ZINAENDESHA. Rekebisha kiainishi cha 58b
(emoji ⏰ imeharibika kuwa "ΓÅ░" kwenye encoding; na/au ulinganisho wa tarehe UTC/EAT) — linganisha kwa maandishi ya ASCII
"[Scheduler] Starting daily recurring expense processing" na tarehe ya EAT. Jaribio kwa mstari huu halisi.
Si kizuizi tena: 2.3.0 inaweza kuendelea (baada ya (af), 61b, 63b, 64, 65, 66).

## 2026-10-29 (ah)
Staging ya 2.3.0 imekamilika: 61b (rc2 sha256:b196d1b17f591399aea756d1f8e5bd6205347611041b39228198666b05eabc51), 63b, 64
(PASS 20/0/1: 2100 2,358,000; riba 26 × 1,717.39 = 44,652.14; awamu 3; malipo → 772,000), 65, 66 — zote ---OK---.
1. Merge feature/mikopo-2.3.0 → main (ina V135), push. Tag v2.3.0 baada ya prod tu.
2. Andaa 67 (build 2.3.0 kutoka main: Assert-ReleaseBranch + LoanSqlPgCheck), 68 (staging fupi: digest ya 67, Flyway 103/135,
   hali-root, riba ya siku moja), 69 (prod: dirisha la leo/jana, digest ya 67 ileile, rollback; HAIRUHUSU tag yenye -rc).
   69 ifanye marekebisho ya A na masharti ya B (kama 64) ndani ya hatua hiyo hiyo, ikiwa na dryRun 🛑 kwanza ambayo
   mmiliki ataniletea kabla ya kuandika.
3. Lender: sehemu ya mkopeshaji inaonyesha notes (kutoka migration). 69 iulize majina sahihi na kuyaweka kwa PUT (maelezo tu).
4. Kiainishi cha 58b kilichorekebishwa (ag): endesha kwa 58b tena wakati wowote ili log ya hatua ionyeshe ZINAENDESHA.

## 2026-10-29 (ai) — DEPLOY YA 2.3.0 LEO
Mmiliki: merge na deploy LEO. Macheda anamaliza ~09:30. Dirisha la prod 06:00–11:00; 69 lazima ianze ≤ 10:45,
vinginevyo kesho.
Mpangilio (fanya kwa haraka, lakini usiruke majaribio ya fakes ya 69):
1. Merge feature/mikopo-2.3.0 → main, push (sasa).
2. 67: build 2.3.0 kutoka main (Assert-ReleaseBranch + LoanSqlPgCheck). Mmiliki ataiendesha mara ikiwa tayari.
3. 68: staging fupi — digest ya 67, Flyway 103/135, hali-root, riba ya siku moja (tumia 63b/65 kama kiolezo).
4. 69: prod — tumia 59 + dirisha-leo-jana kama kiolezo; reco ya jana (28/10) APPROVED; digest ya 67; Flyway 102/134 → 103/135;
   hali-root; rollback. Kisha marekebisho ya A + masharti ya B kwa dryRun 🛑 kwanza (mmiliki ananiletea), kisha kuandika.
   Lender: PUT ya majina (maelezo tu) — mmiliki atayaandika.
   Rollback ya 2.3.0 ina V135 — eleza wazi: 2.2.72 inaendesha juu ya V135? (safu mpya zinaongezwa tu, kwa hiyo likely ndiyo)
   — ithibitishe kwenye staging kabla ya 69.
Toa amri ya 67 mara tu merge ikiisha; andika 68/69 wakati 67 inajenga.

## 2026-10-29 (aj)
69 ---OK--- (PASS 15/0): 2.3.0 iko prod (digest 8de8a556…bbe, V135), marekebisho ya A + masharti ya B yameandikwa,
riba 26 × 1,717.39, TB 0. Weka tag v2.3.0 kwenye c98fa07 na upush. Kisha nipe orodha fupi ya kilichobaki kwa 2.3.0
(V3: kadi ya mkopo + ripoti ya faida ya mistari miwili; majina ya wakopeshaji kupitia PUT) — usianze code bado.

## 2026-10-29 (al) — USAFI (kabla ya #1 na #2)
Lengo la mmiliki: folda safi. Kanuni: ARCHIVE, si kufuta, isipokuwa ni takataka kweli. Hatua ya kwanza ni KUSOMA TU.
1. Orodha (andika analysis/USAFI-ORODHA.md) ya kila faili/folda kwenye:
   lsmsFrontV3\analysis\ (steps, toleo2, faili za juu), worktrees zote (Lsms-hotfix-2272, Lsms-mikopo-230, Lsms-ops-logs,
   lsmsFrontV3-ops-logs), nakala za muda (nakala-application.properties-*, analysis\steps\backup-2026-10-26, scratchpad),
   branches za git (backend + V3, local + origin).
   Kila kipengele: ukubwa, tarehe ya mwisho, kama kiko kwenye git, kama kina siri (password/token/.env), kama kinatumiwa na
   hatua au script hai (grep ya majina), na pendekezo moja: BAKI (hai) | ARCHIVE | FUTA (takataka/siri isiyohitajika) | SIJUI.
   BAKI lazima ijumuishe: 45-lib.mjs, hali-root.sh, ficha.awk, tunnel*.cmd/.ps1, 45-bg.sh, 45-maandishi.sh, 46-reco-kinga.mjs,
   dirisha-leo-jana.cmd, 58b, 60 (haijaendeshwa), MAAGIZO.md, MATAWI.md, MUUNDO-*.md, ops/logs-flutter, feature/sales-returns,
   na kila log ya hatua iliyobadilisha prod (ARCHIVE, si FUTA).
2. Mpango wa archive: zip moja (analysis-archive-2026-10.zip) + sha256 + orodha ya ndani; nakala nje ya PC (B2 au diski nyingine);
   thibitisha zip inafunguka na sha256 inalingana KABLA ya kuondoa chochote. Faili zenye siri: zifutwe baada ya kuthibitisha
   kwamba hazihitajiki (si kwenye zip).
3. Git: worktrees za hotfix-2272 na mikopo-230 (zimemergiwa, tags v2.2.72/v2.3.0 zipo) → git worktree remove; branches zilizomergiwa
   → zifutwe local na origin BAADA ya kuthibitisha `git branch --merged main`. Usiguse ops/logs-flutter wala feature/sales-returns.
4. Code iliyokufa (SaleReturnService, folda ya Flutter, n.k.): ORODHESHA tu kwenye sehemu tofauti — itaondolewa kwa toleo la kawaida.
Usiondoe wala kuhamisha chochote mpaka mmiliki aidhinishe orodha. Kisha #2 (ops) na #1 (V3).

[(ak) bado haijafika kwenye kikao hiki - mmiliki ataituma; itaongezwa hapa juu ya (am) ikifika.]

## 2026-10-29 (am) — majibu ya §7 + upanuzi
Kumbuka: (ak) itatumwa sasa hivi na mmiliki — iongeze kwenye MAAGIZO.md kabla ya (am).
Majibu: 1) ondoa worktrees za asset-counting (diff zimehifadhiwa). 2) master na lsmsVersion01: tag archive/<jina>-20261029,
push tag, kisha futa branch local+origin. 3) .qodo FUTA; repo ya nje D:\…\Lsms\.git: kusoma tu kwanza — remote? commits ambazo
hazipo kwenye repo nyingine? Ripoti kabla ya kuigusa. 4) zip: B2 (prefix archive/, si backups za kila siku) NA diski nyingine
ya PC. 5) Flutter source: BAADA ya #2 na kuondolewa kwa container ya prod. 6) ndiyo, ficha default ya zamani ya root ndani ya zip.
nakala-application.properties-*: FUTA (baada ya kuthibitisha 67 ilijenga kwa faili la sasa).
UPANUZI (mmiliki: "na faili zilizopo local pia"): ongeza kwenye USAFI-ORODHA.md folda NZIMA ya D:\MY PROJECT\DUKA PROJECT\
(si analysis/ tu): kila *.dump, *.sql, *.backup, nakala za .env, folda za zamani za mradi, build/target/node_modules zisizohitajika,
log za zamani. Dumps za prod zina data ya wateja: pendekeza kubaki na 2 za karibuni zilizothibitishwa (restore test), nyingine FUTA.
Kusoma tu; niletee orodha iliyopanuliwa (sehemu mpya tu) kabla ya kuondoa kitu chochote.

## 2026-10-29 (ao) — majibu ya mwisho ya usafi
Q-3: zip kwa sasa kwenye diski D (mmiliki atahamishia flash/HDD baadaye) + B2 (archive/). Q-4: lsms-print-agent HAITUMIKI → ARCHIVE
(target/ isiingie zip; log zake ziende zip, zina data ya risiti) kisha futa PC.
DB za PG ya local — LSMS PEKE YAKE (USIGUSE 2psDante, _2ps-*, DHMS/dhms, PHMS, SDMS, SmartChakula):
 - BAKI: lsms_audit_20261015_0200, lsms_returns_scratch, na DB moja ya dev — thibitisha kwa kusoma spring.datasource.url ya
   properties za local (backend + worktrees) ni ipi kati ya LocalLsms / LsmsAngular.
 - FUTA (DROP): lsms_audit, lsms_audit_1004, lsms_test_reco, lsms_toleo1_scratch, na ile ya dev isiyotumika.
 - Kabla: onyesha ukubwa wa kila DB, na grep kwamba hakuna properties/script/hatua inayotaja majina yanayofutwa.
 - Andaa amri za DROP kwenye faili (mmiliki ataziendesha kwa password yake), si kuziendesha wewe.
Sasa andaa mpango wa mwisho (zip → sha256 → B2 + D → uthibitisho → kuondoa) kama hatua moja yenye namba (71-usafi.cmd),
yenye orodha ya mwisho iliyoidhinishwa, na kituo 🛑 kabla ya kuondoa chochote. Mmiliki ataidhinisha kwa kuandika SAFISHA.
Kumbuka: (ak) inasubiri mmiliki aitume.

## 2026-10-29 (as) — MPANGO MMOJA: kazi zote local, kisha staging moja + prod moja
Inachukua nafasi ya (ak), (aq), (ar) ambazo hazikufika. Ihifadhi kwenye MAAGIZO.md kabla ya kazi.

0. USAFI (malizia): 71 imekamilika (KOSA 0). (a) commit ya git rm ya V3 (faili 439) baada ya kuthibitisha hakuna faili la BAKI
   ndani yake (linganisha 71-orodha.txt); push. (b) Lifecycle ya B2: "Failed to backend: … doesn't support backend commands" —
   thibitisha lifecycleRules kwa njia nyingine (KUSOMA TU); ikiwa inaweza kufuta archive/, pendekeza suluhisho. (c) 71-db: ongeza
   pg_dump -Fc ya LocalLsms, LsmsAngular, Lsms → D:\LSMS-ARCHIVE\db\ + pg_restore --list, kisha DROP pamoja na lsms_audit,
   lsms_audit_1004, lsms_toleo1_scratch; BAKI lsms_test_reco (dev), lsms_audit_20261015_0200, lsms_returns_scratch. Mmiliki ataendesha.
   (d) Lsms\.git ya nje → futa. (e) Print-agent: KUSOMA TU prod — device-email ya application.yml ipo kwenye users? Ikiwa ipo →
   iwe sehemu ya kifurushi (hatua ya kuizima). (f) Dumps: Q-1 (30/09 → B2 archive/evidence/, futa PC); Q-2 (pakua 2 mpya kutoka B2,
   restore test, kisha futa 14/10 na 15/10).

KIFURUSHI (local kwanza, kila kipengele kwenye branch yake, kisha kimoja kimoja kinamergiwa ~~main~~ **release/2.4.0** (backend,
kutoka c98fa07) / release ya V3 baada ya majaribio yake; rc ya staging inajengwa kutoka release; main inapata merge MOJA kabla ya
build ya prod — main = prod) [imerekebishwa 29/10 kwa agizo la (au)]:
 A. Backend 2.4.0 (~~main~~ release/2.4.0 → main kabla ya prod [(au)]):
   A1 ops: rebase ops/logs-flutter juu ya c98fa07; logs /app/logs (siku 30, 1GB) + volume; uid 10001 (orodhesha na jaribu kila
      mahali backend inaandika/kusoma diski: /tmp, uploads/profiles, exports); health check isitegemee Flutter.
   A2 JWT: kumzima/kufuta mtumiaji, kubadilisha password au ruhusa kunafuta token zake mara moja (token version / denylist
      kwenye DB). Majaribio: user INACTIVE → token ya zamani 401 mara moja.
   A3 Login audit: muundo MUUNDO-LOGIN-AUDIT.md + S-1…S-7 (yameamuliwa). Kwanza S-1: hatua ya KUSOMA TU kwenye prod kuthibitisha
      CF-Connecting-IP/XFF inafika backend. last_login_at irekebishwe. Retention: login_audit siku 180, audit za fedha hazifutwi.
   A4 Print-agent (ikiwa ipo prod): akaunti yake izimwe kwa hatua.
   Migrations zote za A zipate namba mfululizo baada ya 135 (V136…), kwenye branch moja ya release.
 B. V3 3.2.0: kadi ya mkopo; "Lipa mkopo" bila riba, CASH kabla ya D; PUT ya maelezo (mkopeshaji/notes/tarehe za awamu);
    ripoti ya faida (gl-pnl) yenye mistari miwili na nyekundu < 0; ukurasa wa login audit (CEO/root); vitufe vya kuandika
    kwa FINANCE_WRITE tu.
 C. Baada ya A kuwa prod (ndani ya dirisha lile lile): kuondoa Flutter — kusoma nginx kwanza, redirect / → /v3/, kuondoa container
    frontend 2.2.53 kwenye compose.

STAGING MOJA (hatua 72-…): dump mpya ya prod → backend 2.4.0 rc → V3 rc → majaribio ya kila kipengele (A1–A4, B) kwa mpangilio,
 kila kimoja na kipimo chake + rollback juu ya migrations mpya → staging inarudi.
PROD MOJA (dirisha la asubuhi): backend 2.4.0 (digest ya staging) → kipimo → V3 3.2.0 → kipimo → C (Flutter) → kipimo.
 Kila hatua ina rollback yake; hatua ikishindwa, zinazofuata hazianzi, na vilivyokwisha pita vinabaki.
Ripoti baada ya kila kipengele kukamilika local (si mwisho tu). Anza na 0, kisha A1, A2, A3, B.

## 2026-10-29 (at)
Swali la dumps: NDIYO — dumps zote za PC ambazo huenda ndizo nakala pekee (04/10, 29/09, 27/09, dump-Lsms-202607171654.sql,
BACKUPS AWS\) ziende B2 archive/evidence/ (--immutable + kupakua tena na kulinganisha sha256), KISHA zifutwe PC. Ongeza kwenye 71c.
71c isiendeshwe mpaka 71b iseme B2_LIFECYCLE_SALAMA kwa archive/ (kanuni ya siku 30 ya daily isiguse archive/).
Endelea na A1 sasa (rebase ops/logs-flutter juu ya c98fa07, logs, uid 10001, health check) wakati mmiliki anaendesha 71b/71-db/71c.

## 2026-10-29 (au)
Merge: release/2.4.0 kutoka c98fa07 — IMEKUBALIWA. A1–A4 zinamergiwa humo; rc ya staging inajengwa kutoka humo; main inapata
merge moja kabla ya build ya prod (main = prod). Rekebisha maneno ya (as) kwenye MAAGIZO.md ipasavyo.
Hitilafu za pembeni (payments/export/csv 500; SalesAnalysisService ERROR ya cast): ikiwa marekebisho ni madogo na yana jaribio,
yaingie release/2.4.0 kama A5; vinginevyo orodha ya baadaye. Niambie ni ipi.
Endelea na B (V3 3.2.0) kwenye branch yake (feature/mikopo-v3), itaingia release ya V3 kwa kanuni ileile.

## 2026-10-29 (aw)
71c: imethibitishwa — lsms_20261029_0200.dump ni nzima (restore OK, majedwali 88, users 8, sales 2761, TB 0), ila FLYWAY 102 134
(kabla ya deploy ya 2.3.0). Rekebisha kipimo: Flyway ≥ 134 na kila migration iliyopo success (FLYWAY_ZILIZOSHINDWA 0), si "135" kamili.
Print-agent: PA_USER uid d89760f8-56d3-4b52-9131-53eef5778890 ACTIVE, role printer, branches 1. Mmiliki ataizima kupitia V3 Users
sasa. A4 kwenye release/2.4.0: (a) thibitisha imezimwa (hali-root-style read), (b) kazi 19 za print_jobs PRINTING tangu 22/06 →
CANCELLED/FAILED kwa sababu, kwa hatua yenye dryRun, (c) ikiwa role "printer" haina mtumiaji mwingine na hakuna code inayoitumia —
pendekeza kuiondoa (orodha tu).
71-db: DB "Lsms" haipo → ruka kama HAIPO (kama (av)).

## 2026-10-29 (ax)
A5: imekubaliwa. Uchunguzi wa mifumo 154 ya ":x IS NULL" + mbinu 20 za Object[] UPEWE KIPAUMBELE mara baada ya 2.4.0
(ripoti nyingine huenda zinaonyesha 0/namba za uongo kimya) — andaa mpango + jaribio la kugundua kwa wingi (si kurekebisha sasa).
A4: hatua ya ziada (data tu, baada ya 71e): ondoa PRINT_JOB_MANAGE kwenye role zote na futa role "printer" — dryRun + nakala ya
role_permissions kabla + KITUO. Kisha thibitisha hakuna endpoint inayovunjika kwa CEO/SALES.
(av) haikufika — maudhui yake yamo kwenye (aw). Endelea na A3, kisha B.

## 2026-10-29 (ay)
71c imeshindwa EVIDENCE-B2 (exit -1) baada ya muda mrefu: mwendesho wa pili ulipakia TENA evidence 6 kwenda Contabo ingawa
ziko B2 tayari (zilithibitishwa mwendesho wa kwanza). Ssh ilikatika wakati wa upload. Hakuna kilichofutwa.
Rekebisha: kwa kila evidence, kwanza soma sha256 ya B2 (bila kupakia) — ikiwa = sha256 ya PC → TAYARI, ruka upload.
Pakia tu zisizopo/zisizolingana. Pia: restore test ya dumps mpya ikiwa imeshapita leo (log/hali) → TAYARI, isirudiwe.
Ongeza ssh keepalive (ServerAliveInterval) kwa upload kubwa ikiwa bado inahitajika. Jaribio: mwendesho wa pili haupakii kitu.

[(az) na (ba) hazikufika kikao hiki; maudhui yake yamo ndani ya (be) hapa chini. (bd) pia imo ndani ya (be).]

## 2026-10-31 (bb)
RAM: mmiliki ameifungua — endelea M4–M9, kisha suite nzima, commit A3, merge release/2.4.0.
Login audit: CEO peke yake, kama muundo ulivyosema. Executive CEO HAPATI ukurasa huu.
action-menu.ts (V3 main, uncommitted, 29/10 19:12): usiifute. Ihamishie kwenye branch mpya
"wip/action-menu-standalone" na uicommit huko, ili main ya V3 ibaki safi. Mmiliki ataamua baadaye kama inahitajika.
Kisha B (V3 3.2.0) kwa mpangilio wa (az); tumia Docker-local ya (ba) kwa majaribio.

## 2026-10-31 (be) — inajumuisha (az) + (ba) + (bd) ambazo hazikufika, na uamuzi wa A6
Ihifadhi kwenye MAAGIZO.md kabla ya kazi. Anza ripoti kwa "nimesoma hadi (be)".

KANUNI YA KIFURUSHI (az): hakuna staging/prod mpaka kazi ZOTE zikamilike local. Tarehe ya kufunga: 16/11/2026 — kisichokamilika
na kujaribiwa hadi hapo kinahamia toleo linalofuata. Branches: release/2.4.0 (backend), release/3.2.0 (V3).

KANUNI YA MAJARIBIO (ba), andika kwenye MATAWI.md:
- "Local" = Docker ya PC inayofanana na prod: image ileile (digest) itakayoenda prod; PostgreSQL 15 (si 16/17); docker compose
  yenye mipangilio/env ya prod bila siri; dump ya prod ya karibuni (iliyopita restore test). Andaa kiolezo kimoja kitumike kila toleo.
- V3 tu bila mabadiliko ya API → local → prod.
- Backend bila migration, isiyogusa data ya fedha/stock → Docker-local → prod (digest ileile).
- Migrations au data ya Capital/Store/GL/stock/sales/payments/reco/counting → Docker-local → Contabo staging → prod.
- Infra (compose, nginx, uid, env, volumes) → Contabo staging → prod.
- Kifurushi hiki kina migrations + infra → Docker-local kwa kila kipengele, kisha staging MOJA (script moja), kisha prod MOJA.
- Majaribio ya SQL ya native yaendeshwe pia kwenye PG15.

ORODHA YA KIFURUSHI (✔ = imekamilika local):
 ✔ A1 ops  ✔ A2 JWT  ✔ A3 login audit  ✔ A4 printer (data)  ✔ A5 CSV + profitability
 A6 Ukaguzi wa kufuta/kubadilisha mauzo:
    - kila delete/void/edit ya sale irekodi user halisi (journal ya reversal posted_by = mtumiaji, si "System"), saa, SABABU
      (lazima), sale number, kiasi, njia ya malipo, hali ya reco ya siku hiyo; migration mfululizo.
    - notification SALE_DELETED kwa wenye ruhusa mpya SALE_DELETE_REVIEW (CEO tu); banner ya V3 kila login mpaka "Nimeona" + maelezo;
      muhtasari (idadi, jumla, nani, sababu) + orodha; anayefuta anaona uthibitisho kwamba imerekodiwa.
    - UAMUZI WA MMILIKI: kufuta/kubadilisha sale ya siku ambayo reco imeshaidhinishwa → INAKATALIWA isipokuwa VYOTE VIWILI:
      (a) reco ya siku hiyo imefunguliwa upya, NA (b) mtumiaji ana ruhusa ya CEO. Si setting — ni kanuni.
    - majaribio: bila sababu → kukataliwa; reco APPROVED → kukataliwa; reco imefunguliwa lakini si CEO → kukataliwa; CEO + reco
      wazi → inaruhusiwa na inarekodiwa; posted_by sahihi; notification; banner inaondoka baada ya ack tu; mutation.
 B  V3 3.2.0: kadi ya mkopo; "Lipa mkopo" (bila riba, CASH kabla ya D, lazima ifanye kazi kwa malipo ya 04/11); PUT ya maelezo;
    ripoti ya faida yenye mistari miwili (nyekundu < 0); ukurasa wa login audit (CEO); banner ya A6; vitufe vya kuandika kwa
    FINANCE_WRITE tu.
 C1 Usanidi kwenye git: mipangilio isiyo siri ya application.properties (profiles group prod→pro, Flyway outOfOrder/validate,
    logging) kwenye faili zinazofuatiliwa; siri kupitia env tu. Mpango wa kuzima outOfOrder.
 C2 Mifumo 154 ":x IS NULL" + mbinu 20 Object[]: gundua kwa beans halisi + PG15 yenye data, kisha rekebisha zilizovunjika.
 C3 Chanzo cha malipo ya msambazaji: chaguo linaloonekana (droo/benki/mmiliki).
 C4 Sales returns (feature/sales-returns): maliza + majaribio; migration mfululizo; nyuma ya feature flag (default OFF).
 C5 Orodha ya Toleo 2 iliyobaki (movements, kusafisha purchases, maelezo ya supplier payments, cache ya status): niletee orodha
    kwanza (inahitajika? ukubwa?), kisha fanya zilizoidhinishwa.
 C6 backup_20260930_journal_entry: nakala B2 archive/evidence/, kisha DROP (migration).
 C7 Code iliyokufa (SaleReturnService); kuondoa Flutter kwenye prod = hatua ya mwisho ya prod.
 C8 Thibitisha hali kwa kusoma code: cash-declaration guard kwenye submit ya reco; variance tab rework; audit logging ya capex
    approval; recos za zamani REVIEWED zenye variance bila maelezo. Ripoti, kisha fanya zinazohitajika.
 C9 deploy-v3.ps1 ipate ssh -n.
Mpangilio: A6 → B → C1 → C2 → C3 → C5/C8 (orodha kwanza) → C4 → C6 → C7 → C9.
Mzunguko: script MOJA ya staging na MOJA ya prod kwa kifurushi (vipengele kwa mpangilio, kila kimoja na kipimo + rollback,
vituo 🛑 vichache). Ripoti baada ya kila kipengele.
tunnel.cmd kwenye V3 main (uncommitted): niambie ni badiliko gani; ikiwa ni port ya LSMS_TUNNEL_PORT, commit kwenye main.

## 2026-10-31 (bf)
Restore ya sale iliyofutwa: ZIMA (kama permanent delete). Endpoint irudishe ujumbe wazi: "Tengeneza sale mpya; taja namba ya
iliyofutwa kwenye maelezo." V3: ondoa kitufe cha restore; kwenye sale iliyofutwa onyesha "Tengeneza upya" → fomu ya sale mpya
yenye rejea ya namba ya zamani (sehemu ya maelezo). Jaribio: restore → kukataliwa bila kubadilisha kitu.
Kanuni ya A6 imekubaliwa kama ulivyoitekeleza (APPROVED → hakuna mtu; reopened → CEO/root tu).
MATAWI.md: commit kwenye main ya V3 (mabadiliko ya (ba)).
Kumbuka kwenye mpango wa prod: 2.4.0 na 3.2.0 zinaenda dirisha moja (3.1.11 haitumi sababu → 2.4.0 ingekataa kufuta).
Endelea na B.

## 2026-10-31 (bg)
RAM: usirudishe ng serve. Jaribu B kwa production build: ng build → hudumia dist (nginx container ya
deploy/local au http-server) dhidi ya backend ya Docker-local. Hii ndiyo njia ya kawaida ya majaribio ya V3 kuanzia sasa.
Majaribio ya Playwright: endesha YOTE upya (siyo 3 yaliyobaki tu) kwenye build hiyo.
Banner: lazima ifuate RUHUSA ya audit, siyo role CEO. Thibitisha kwenye code. Majaribio ya ziada:
  MANAGER bila ruhusa → haoni; MANAGER akipewa ruhusa → anaona; "Nimeona" ya mtu mmoja haifichi kwa mwingine.
Tengeneza upya: ongeza sales.replaces_sale_uid (nullable) NDANI YA V138 (bado haijaenda prod; usitengeneze V139).
  "Kagua" ionyeshe "imerudishwa → #X" / "haijarudishwa". Maelezo "Badala ya <risiti>" yabaki pia.
  Bei ikitofautiana na ya sale ya zamani: onyesha bei ya zamani pembeni kwenye kikapu.
feature/v3-a6 → merge release/3.2.0 baada ya majaribio yote kupita tu. Kisha endelea B2 (login audit page).

## 2026-10-31 (bh)
KWANZA (kabla ya B3): 04/11 Chief analipa Loan A 386,000 CASH, lakini 3.2.0 haifiki prod kabla ya 16/11.
  Jibu: prod ya leo (2.3.0 + 3.1.11) ina njia ya kurekodi repayment? (endpoint, payload, Cr 1000, ratiba inasasishwa?)
  - Kama ipo: andaa hatua 61-lipa-mkopo.cmd (kibali, preview → 🛑 → POST, ukaguzi: deni 772,000, installment 1 PAID, journal).
  - Kama haipo: sema wazi; tutarekodi baada ya deploy kwa tarehe 04/11 (thibitisha kwamba backend inakubali tarehe ya nyuma
    ndani ya kipindi wazi). Hakuna journal ya mkono kwa mkopo.
  Majaribio: suite bado 542, ingawa backend imebadilika (replaces_sale_uid, deleted-items query, "not found" bug).
    Weka majaribio hayo kwenye mvn test (PG test kama LoanSqlPgCheck). Ripoti namba mpya.
  Ripoti ya B1 ilikatika baada ya "dhidi ya backend Docker-local". Tuma sehemu iliyokosekana.
  Thibitisha "Executive CEO" ni role ya nani, na kwamba LOGIN_AUDIT_VIEW iko kwa CEO (Chief) peke yake.
  Mpango wa staging: ongeza ukaguzi wa DB-IP halisi (IP moja ya Cloudflare, Vodacom/Airtel, na datacenter moja).
  Kisha B3.

## 2026-11-01 (bi)
61-lipa-mkopo: endesha KAGUA 02/11 au 03/11 (siyo kusubiri 04/11) ili kosa lionekane mapema.
Swali kwa reco: hesabu ya "cash inayotarajiwa" ya day-close inasoma mwendo wa GL 1000 (k.m. Cr 1000 ya repayment)
  au mauzo/matumizi tu? Jibu kwa code + jaribio dhidi ya Docker-local: repayment ya 386,000 tarehe X → reco ya X inaonyesha nini.
  Kama inaonyesha upungufu: pendekeza suluhisho (k.m. repayment ionekane kama "pesa iliyotoka kwa mkopo" kwenye reco),
  lakini USIBADILISHE prod kabla ya 04/11. Kwa 04/11 tutaandika maelezo kwenye reco kwa mkono.
Lango la staging: LoanSqlPgCheck + SaleChangePgCheck + Playwright yote (build ya mwisho) = lazima yapite kabla ya prod.
lsms-a6-pg: futa (RAM). Script iitengeneze upya inapohitajika.
Kisha B3.

## 2026-11-01 (bj) — ilipotea, hii hapa
Mabango "Malipo ya deni": ingiza kwenye B. Upeo 3 kwa wakati mmoja, mengine "+N zaidi" kwenye kengele,
  notification za zaidi ya saa 24 zisiwe toast. Jaribio: notification 50 → toast ≤3, vitufe vya chini kulia vinabofyeka.
  Thibitisha kama 3.1.11 ina tatizo hili.
Orodha ya BAADA ya batch: "Akiba ya mkopo: akaunti 1010, Dr 1010/Cr 1000 kila siku kupitia reco, repayment kutoka 1010".
Hatua 60 (cutover D): ongeza "hesabu bahasha ya akiba ya mkopo" kwenye cash count ya ufunguzi.
MATAWI.md: commit. Kanuni: hakuna faili lisilocommitiwa mwisho wa kila ripoti.

## 2026-11-01 (bk) — ilipotea, hii hapa. KWANZA, kabla ya B4.
Prod, kusoma tu (hatua 62-kagua-ufutaji.cmd, dirisha la kawaida, ficha):
  a) Sale 311026-2139 (146,500): ilifutwa lini, reversal ina tarehe gani na kwa nini 01/11
     (kipindi cha Okt kimefungwa? reco ya 31/10 iko hali gani?). Kuna sale mpya mahali pake?
  b) Reco za Oktoba: variance kwa siku. Kuna upungufu unaojirudia wa ~12,587 au ~31,634?
  c) gl_posting_failure tangu 31/10 18:00.
  d) Jumla ya depreciation ya 31/10.

## 2026-11-01 (bl) — B3
Geuza kuwa mtaji: onyesha journal. Lazima iwe Dr 2100 (deni lililobaki) / Cr 1150 (riba isiyoiva iliyobaki) / Cr 3xxx (tofauti).
  PG test: baada ya kugeuza, 1150 ya mkopo huo = 0, 2100 = 0, 3xxx = mtaji uliobaki tu.
Lipa mkopo "benki" kabla ya cutover D: backend iandike Cr 1000 bila kujali chaguo. Jaribio.
Mkopo mpya "moja kwa moja kwenye mzigo": PG test ya journal (Dr mzigo + Dr 1150 / Cr 2100, TB 0).
E2E b3: ianze kwenye nakala safi au ifute mkopo wake mwishoni. Jina la kipekee kwa kila mwendesho.
Mwanzoni mwa kila ripoti: orodhesha herufi zote ulizoziona tangu ripoti iliyopita (siyo ya mwisho tu).
Kisha B4.

## 2026-11-01 (bm) — B4 imepanuliwa kidogo
Ripoti ya uendeshaji na gl-pnl ZIBAKI mbili. Ongeza kadi "Daraja na GL" kwenye ripoti ya uendeshaji (kipindi kilekile):
  Net (uendeshaji) → − riba (6600) → ± kila tofauti inayojulikana kwa jina (stock counts posted vs zisizoandikwa,
  matumizi ya reco isiyoidhinishwa, mauzo yaliyofutwa yenye reversal kipindi kingine, n.k.) → = Net ya GL.
  "Tofauti isiyoelezeka" ionyeshwe wazi, nyekundu ≠ 0. Backend: endpoint moja inayorudisha mistari ya daraja.
  Jaribio: Oktoba kwenye nakala ya 29/10 — orodhesha tofauti zote zilizopatikana kwenye ripoti.
Uchunguzi (kusoma tu, prod au nakala): hesabu ya stock ya 13/10 iliyoleta ziada 262,501 — bidhaa zipi, nani,
  kwa nini. Na muhtasari wa mistari 210 isiyoandikwa: jumla ya ziada, jumla ya upungufu, tarehe.
  Usiandike chochote — tutaamua baada ya kuona.
Kama daraja linavuka 16/11: niambie mapema, tutaamua kipi kitoke kwenye batch.

## 2026-11-01 (bn)
Hatua 62: ni kusoma tu → hakuna dirisha linalohitajika, sawa. Iongezee:
  e) Mikopo yote iliyofungwa (pamoja na MKOPO WA BANK): ilifungwaje (geuza/kulipwa), journal yake,
     salio la 1150 kwa kila mkopo, na kama LoanInterestScheduler bado inaandika riba kwa mkopo usio ACTIVE
     (LOANINT za tarehe baada ya closed_at).
  f) Jagger Master: manunuzi/receipts/matumizi ya reco yanayotaja Jagger 01/10–13/10, na bei ya gharama kwa unit (chupa au carton).
Kisha nitaiendesha; ripoti log.
Ongeza BAADA-YA-BATCH.md:
  - Hesabu ya stock: tofauti inayojirudia hesabu 2 mfululizo haiwezi kuwa NO_ACTION tena (post au recount).
  - Ziada > 50,000 kwa bidhaa: recount na mtu wa pili kabla ya approve.
  - Bidhaa za "kupima": upotevu wa kupima uandikwe kama gharama (5100), siyo NO_ACTION.
Push: andaa push-yote.cmd (release/2.4.0, release/3.2.0, V3 main → origin, bila force, ripoti hash). 🛑 kabla ya push.
Kisha B4 + daraja.

## 2026-11-01 (bo)
Jagger: andaa hatua 63-rekebisha-jagger.cmd (preview → 🛑 → andika). Isiendeshwe kabla ya log ya 62.
  - unit cost Jagger → 8,833.33; COGS za mauzo ya Jagger tangu 13/10: orodhesha (siku, chupa, COGS iliyotumika).
  - Journal moja tarehe 01/11 (au siku ya kwanza wazi): Dr 5100 / Cr 1200 = ziada iliyobaki kwenye 1200,
    maelezo "Marekebisho ya Oktoba: Jagger carton kama chupa (11/10)". Hesabu kiasi kutoka data, siyo 265,000 ya kudhani.
  - Ukaguzi: thamani ya stock ya Jagger = chupa zilizopo × 8,833.33; TB 0.
Hatua 62 ongeza (g): manunuzi yote 2026 ambapo unit cost > 3× au < ⅓ ya wastani wa bidhaa hiyo (bidhaa, tarehe, qty, cost).
  Pia: hali ya kipindi cha Oktoba (OPEN/CLOSED).
Onyo la manunuzi (cost > 3× ya mwisho → "carton au chupa?"): kadiria muda. < nusu siku → batch (B). Vinginevyo BAADA §3.
Kisha B4 + daraja.

## 2026-11-01 (bp)
63: tarehe ya journal inategemea hali ya Oktoba kwenye PROD (kutoka 62):
  - Oktoba OPEN → journal 2:
      J1 31/10: Dr 5100 / Cr 1200 = ziada ya 1200 tarehe 31/10 (265,000 − COGS ya ziada ya mauzo ya Jagger ya Okt)
      J2 01/11 (ikiwa tu kuna mauzo ya Jagger ≥ 01/11): Dr 1200 / Cr akaunti ya COGS = chupa × (53,000 − 8,833.33)
      Ukaguzi: J1 − J2 = A = B. Maelezo yote mawili yataje "Jagger carton kama chupa (11/10)".
  - Oktoba CLOSED → kama ulivyoandika (journal moja 01/11 = A).
  Uendelezaji (resume) uzingatie J1 na J2 kila moja peke yake.
  Gharama ibadilishwe kwa SQL: andika mstari wa audit (nani, lini, 53,000 → 8,833.33, sababu).
Usifunge Oktoba kabla ya 63 ANDIKA. Kisha B4 + daraja.

## 2026-11-01 (bq)
63 J1: debit akaunti ILEILE iliyopewa credit na count adjustment ya 13/10 (soma kutoka journal yake kwenye prod
  wakati wa KAGUA), siyo 5100 kwa kudhani. KAGUA ionyeshe: "13/10 Cr <akaunti> 265,000 → J1 Dr <akaunti>".
Hakuna kingine. B4 + daraja.

## 2026-11-01 (br)
Punguzo 4010 (133,500): chukua sale moja yenye punguzo (Oktoba) — onyesha: total ya sale, pesa iliyopokelewa,
  mistari ya GL yake, na thamani yake kwenye ripoti ya uendeshaji. Sema ripoti ipi imekosea; rekebisha hiyo (batch) + PG test.
4900 (57,486.54): orodhesha journal zote za Okt kwa chanzo (reference prefix, jumla). Usibadilishe kitu.
Ripoti ya uendeshaji: ongeza mistari ya 6700 (droo), 6120 (madeni yaliyosamehewa), DMG (upotevu nje ya hesabu)
  na riba 6600 kwenye "How net profit is reached", ili daraja libaki na timing tu. Ikiwa > nusu siku → niambie.
BAADA-YA-BATCH, kipaumbele "kabla ya 31/12": malipo ya mwaka (pango, TRA) → 1160 prepaid + amortization ya kila mwezi
  (scheduler kama 1150). 2026 isiguswe.
Kisha onyo la manunuzi, kisha B5.

## 2026-11-02 (bs)
1120: salio la kila mfanyakazi, makusanyo yake 2026 (nani, lini, kiasi), na kama mshahara wa Oktoba ulikatwa.
  Kusoma tu, ripoti fupi.
Punguzo: orodha ya sale zote 2026 zenye punguzo — tarehe, cashier (jina, siyo uid), mteja, punguzo, gharama, margin.
  Weka alama kwa zilizo chini ya gharama.
BAADA-YA-BATCH, kipaumbele cha juu: punguzo linaloifanya sale kuwa chini ya gharama → linahitaji ruhusa ya CEO + sababu.
Kisha onyo la manunuzi, kisha B5. Usisubiri logs zangu — endelea.

## 2026-11-02 (bt)
1120 macheda (1,000,301.88): uchambuzi kwa chanzo, kusoma tu:
  - kwa mwezi; kwa aina (stock count shortage / droo / nyingine);
  - kwa bidhaa: kiasi kwa bei ya kuuza na kwa gharama;
  - sehemu inayotokana na: bidhaa za kupima, bidhaa zenye NO_ACTION inayojirudia, bidhaa zenye unit-cost isiyo ya kawaida (62 g).
  - Jumla ya 4900 iliyotokana na tozo hizi 2026.
15/10 (55,500): kwa kila malipo — reco ya siku hiyo ilihesabu ziada hiyo? Je, 1000 imeongezeka mara mbili? Onyesha journal zote mbili.
BAADA-YA-BATCH §0: tozo ya mfanyakazi kwa GHARAMA (Dr 1120 / Cr 1200), bila 4900; tofauti ya bei ya kuuza iandikwe tu ikilipwa
  (au kwa makubaliano ya maandishi).
Kisha onyo la manunuzi, kisha B5.

## 2026-11-02 (bila herufi, baada ya (bt)) — ujumbe haukuwa na kichwa; umehifadhiwa kama ulivyo
Bidhaa za kupima: hakuna tozo kwa mtu (uamuzi wa Chief, hadi vipimo halisi). Lakini BAADA-YA-BATCH §2:
  hesabu ya wiki kwa chupa nzima → tofauti Dr 5100 / Cr 1200 kwa gharama, bila 1120. Na sasa (kusoma tu):
  jumla ya tofauti ya kupima isiyoandikwa kwa gharama, leo.

## 2026-11-02 (bu)
Kwanza: tozo ya mfanyakazi (count shortage → 1120) inapunguza stock ya mfumo? Onyesha kwa code + mfano mmoja wa prod-copy
  (stock kabla/baada ya tozo). Kama HAIPUNGUZI: hesabu ni tozo ngapi za 1M zinarudia chupa ileile (kiasi). Kama inapunguza: sema hivyo.
  Chunguza zile 5 za Oktoba (16,000) kwa mtazamo huo.
PEPSI & MIRINDA, CASTLE LITE: kwa kila tozo — unit ya manunuzi (kreti/chupa), unit ya mauzo, na kama hesabu inaruhusu "empties".
  Kuna mauzo ya kreti yaliyoandikwa kama chupa?
Andaa hatua 64-rekebisha-15-10.cmd (preview → 🛑 → andika), Oktoba iko wazi → tarehe 15/10:
  J1: Dr 6700 / Cr 1000 = 28,500 (maelezo: rejea JE-...6802 na JE-...7163).
  J2: Dr 1120 / Cr 4000 = 17,000 — NA SWALI: iandikwe tu nikisema "J2 ndiyo"; vinginevyo ruka.
  Inaendeshwa baada ya 63.
Kisha onyo la manunuzi, kisha B5.

## 2026-11-02 (bw)
Jagger 886dc1ed — Chief amethibitisha: CHUPA moja = 53,000 (TAKAWEDO), bei ya kuuza 60,000, dukani ipo 1.
  Kosa ni hesabu ya 13/10 (6 badala ya 1), siyo gharama. Njia "CARTON" ya 63 IFUTWE.
63 mpya:
  - Gharama BAKI 53,000 (hakuna UPDATE ya cost, hakuna price_history).
  - Idadi 6 → 1 kupitia stock movement halisi (ADJUSTMENT −5, bei 53,000, rejea ya COUNT-ADJ-ba9c1a62..., sababu
    "Hesabu ya 13/10 ilikosewa: 6 badala ya 1 (Chief, 02/11)") + audit_trails.
  - Journal tarehe 31/10 (Okt OPEN): Dr <akaunti iliyopewa credit 13/10> / Cr 1200 = 265,000 (kutoka data), maelezo hayo hayo.
  - KAGUA ithibitishe: stock ya mfumo bado 6, hakuna mauzo ya 886dc1ed tangu 13/10, gharama 53,000. Vinginevyo simama.
  - Baada: stock 1, thamani 53,000, TB 0, journal mara moja.
BAADA-YA-BATCH §3: SKU 4 za Jagger (JAGER/JAGGER MASTER) — majina yaonyeshe saizi; unganisha au badilisha majina.
Mpangilio unabaki: (bu), (bv) sehemu ya sale zilizofutwa + A6 reasons, kisha onyo la manunuzi, kisha B5.

## 2026-11-02 (bv) — ilipotea, hii hapa (sehemu ya 63 imeondolewa, (bw) inatawala)
Sale zilizofutwa tangu 30/10 (zote 6: 301026-2245/2251/2253, 311026-0831, 311026-2139, 011126-0720): kwa kila moja —
  bidhaa, je ziliingizwa upya (sale ipi, lini, kiasi), na kama bidhaa hizo zilionekana upungufu kwenye hesabu iliyofuata na
  zikatozwa 1120. Kusoma tu.
A6: sababu ikatae herufi moja inayojirudia na sababu zenye herufi tofauti < 4 ("6666666666", "rrrrrrrrrr"). Batch + jaribio.
  Hiyo hiyo kwa sababu za reco (variance reason, unsubmit reason).
Compose: ROOT_PASSWORD warning → ${ROOT_PASSWORD:-} (C1).

## 2026-11-02 (bx)
63 ANDIKA iongeze: bidhaa 886dc1ed → chupa_kwa_kifurushi = 1 (au null), bei_kifurushi = 0, pamoja na audit. KAGUA ionyeshe kabla/baada.
Pepsi: andaa 65-futa-tozo-pepsi.cmd (KAGUA → 🛑 → ANDIKA), isiendeshwe bila "ndiyo" yangu:
  tozo 14/07 (56,533) na 10/10 (78,400) → Cr 1120 / Dr 1200 tarehe 02/11 (Jul imefungwa), daftari la madai lisasishwe ndani ya transaction
  moja + audit, maelezo "Tozo isiyo sahihi: ziada ilifuata". Idadi ya stock ya Pepsi isiguswe — hesabu ijayo itaiweka.
  Onyesha pia: hali ya stock ya Pepsi leo (mfumo dhidi ya hesabu ya mwisho).
Kisha onyo la manunuzi, kisha B5.

## 2026-11-02 (bz)
63 ANDIKA imekamilika prod (PASS 21/0): MJ:fc0e0320…, Jagger stock 1 @ 53,000, kifurushi 1/1/0, 1200 4,578,975.35.
Uchunguzi mpya (kusoma tu, hatua 66): 1200 ya GL (4,578,975.35 baada ya 63) dhidi ya thamani ya daftari la stock
  (Σ stock × current_average_cost) leo. Tofauti kwa: bidhaa kumi kubwa, na chanzo — movements zisizo na journal
  (aina, jumla), stock ya mwanzo, purchases bila journal, tofauti ya average vs last cost. Pia: ripoti ya uendeshaji
  inatumia gharama ipi kwa "Stock value"? Hii lazima ijulikane kabla ya cutover D (hatua 60).
Kisha (bv), onyo la manunuzi, B5.

## 2026-11-02 (by) — ilifika baada ya (bz), hii hapa
Pepsi: hakuna hatua 65 — tozo zilikuwa halisi (Chief amekubali marekebisho yako).
BAADA-YA-BATCH §2: manunuzi ya siku yaandikwe kabla ya hesabu, au mzigo usioandikwa utengwe nje ya hesabu;
  hesabu iwe na swali "kuna mzigo uliofika leo ambao haujaandikwa?".
BAADA-YA-BATCH: kipimo kimoja cha thamani ya stock = avg (ripoti ya uendeshaji + ukurasa wa Store; Store isitoe 0 kwa bidhaa iliyopo).
Endelea na (bv).

## 2026-11-02 (cb)
64: imekamilika prod (J1 28,500; J2 imerukwa). Chief ataamua J2 baadaye — 64 ibaki inaweza kuandika J2 peke yake.
Kanuni ya sababu: itumike kwa maandishi MAPYA tu. Submit/approve/close ya rekodi yenye sababu ya zamani "takataka" isizuiwe.
  Jaribio: reco ya zamani yenye "nnnn" → approve inapita; reopen mpya yenye "rrrrrrrrrr" → inakataliwa.
558 vs 559: tayari umeeleza kwenye (br) (559 ilikuwa na hesabu ya ziada). Funga.
Oktoba: usipendekeze kufunga mpaka reco ya 31/10 iidhinishwe na 65 ikaguliwe.
Kisha onyo la manunuzi, B5.

## 2026-11-02 (ca)
66 prod: GL 1200 4,458,775.51 = daftari 4,458,766.74 (−8.77). Hakuna uchunguzi zaidi wa 1200; cutover D itumie Σ stock×avg.
Ukurasa wa Store: "Thamani ya mzigo" = Σ stock × current_average_cost (siyo wastani wa miezi 6; isitoe 0 kwa bidhaa iliyopo).
  Kadiria: ≤ saa 1 → batch (B), vinginevyo BAADA. Jaribio: jumla ya ukurasa = daftari.
HENNESY ce1fd75d: kwa nini stockValueAt inaona 2 wakati current_stock 0? Onyesha mwendo wake; ikiwa ni tarehe ya mwendo, rekebisha stockValueAt (batch).
65: imekaguliwa — hakuna hatua ya ziada. Kisha onyo la manunuzi, B5.

## 2026-11-02 (cc)
Saa: HENNESY purchase 18:34 → movement 21:33 (≈ +3h = UTC/EAT). Chunguza (kusoma tu, prod-copy):
  - kwa stock_movements zote 2026: movement_date − created_at; histogram ya tofauti; ngapi ≈ +3h / −3h; kwa aina na njia ya kuingiza
    (fomu ya manunuzi, repurchase invoice, n.k.).
  - Hiyo hiyo kwa purchases.purchase_date na sales.sale_date dhidi ya created_at.
  - Ngapi zimeangukia siku nyingine kwa sababu hiyo.
  Rekebisha CHANZO (batch) + PG test: tarehe iliyoingizwa ihifadhiwe kama EAT bila kuhamishwa. stockValueAt ibaki na id-order kama kinga.
E2E b1 D3/D4: endesha mara 10 mfululizo kwenye build ya mwisho. Kushindwa ≥ 1 → tafuta chanzo (test au app race) kabla ya freeze.
  Kanuni ya lango: E2E lazima ipite mwendesho wa KWANZA.
MATAWI.md: PG 4/4.
Kisha onyo la manunuzi, B5.

## 2026-11-02 (cd)
b1×10: acha imalizike, lakini haijibu swali (kosa lilikuwa run ya kwanza baada ya nakala safi).
Soma log ya run iliyoshindwa kwenye (ca), D3/D4: ni timeout au assertion ya thamani? Nukuu mstari wa kosa.
  - Timeout → ongeza warm-up (login + GET moja) kwenye run-all kabla ya b1; hakuna kingine.
  - Thamani → rejesha nakala safi ×3, run moja baada ya kila rejesho; tafuta chanzo kwenye app.
Kisha (cc) uchunguzi wa saa, onyo la manunuzi, B5.

## 2026-11-02 (ce)
Chaguo 1: rekebisha jaribio (subiri maudhui halisi: li ya S1 kwenye Kagua; maandishi ya kanuni kwenye dialogi ya sababu).
Pamoja na hilo, app: "Nimeona" (na kitufe chochote cha kuthibitisha kwenye Kagua/banner) kiwe disabled mpaka /pending ijibu.
  Jaribio: kuchelewesha /pending (route delay) → "Nimeona" haibofyeki mpaka orodha ionekane.
Lango: b1×10 = 10/10, pamoja na run moja ya kwanza kwenye nakala mpya.
Kisha (cc).

## 2026-11-02 (cf)
Kikao kingine cha 19:01: Chief anakifunga. Wewe pekee ndiye unafanya kazi backend + V3 kuanzia sasa.
  Kagua diff yote isiyocommitiwa (yako + ya kikao kile), orodhesha faili, commit kwa ujumbe unaotaja asili yake.
Kisha: mvnw test (suite), PG gate, run-all E2E — zote kwenye build hiyo. Ripoti namba.
Tarehe ya client > dakika 15 mbele ya saa ya server: USIKATAE. Weka saa ya server + audit WARN (tarehe ya client, saa ya server, mtumiaji).
  Jaribio: tarehe +1h → imehifadhiwa kama saa ya server, audit ipo; tarehe ya nyuma halali → inabaki.
Push: andaa ili Chief aendeshe push-yote mara moja baada ya commit.
Kisha onyo la manunuzi, B5.

## 2026-11-02 (cg)
Onyo la manunuzi: ulisema njia 3 za kuingiza manunuzi. Orodhesha zote; zile 2 zisizo Repurchase zipate onyo lilelile + e2e.
  Kama njia ya 07/09 na 22/09 (Jagger) inajulikana, itaje.
C2 na C4: kadiria muda SASA (siku), kabla ya kuanza C1. Ikiwa jumla ya kilichobaki > siku 12, pendekeza kipi kitoke kwenye batch.
Kisha C1.

## 2026-11-02 (ch)
C1 = config kwenye git BILA kubadilisha thamani. outOfOrder ibaki kama ilivyo prod sasa.
  Kuzima outOfOrder → BAADA-YA-BATCH, na kipimo chake ni flyway_schema_history ya DUMP YA PROD (29/10), siyo nakala mpya.
  Diff ya C1: onyesha kila thamani iliyobadilika dhidi ya .env/properties za prod (zilizofichwa). Lazima iwe 0 isipokuwa ${ROOT_PASSWORD:-}.
.gitattributes: *.properties eol=lf (onyo la CRLF).
(cg): makadirio ya C2 + C4 yalikuja? Kama bado, yatoe kwenye ripoti hii.

## 2026-11-03 (ci)
1. C4: IMETOKA kwenye batch → BAADA-YA-BATCH. Rekebisha MATAWI.md na mpango wa kifurushi.
2. Kanuni ya pili ya onyo la manunuzi: ieleze kwa mstari mmoja (nini, kwa nini, gharama) — nitaamua.
3. Hatua ya release ya C1: ndiyo — andaa (kuhamisha siri za dev kwenda Lsms\config\application.properties, kukagua backend inawaka local).
4. V039: BAADA. Lakini script ya staging LAZIMA itumie dump ya prod ya karibuni (siyo nakala safi) na ikague Flyway: V135→V138 zinaingia,
   hakuna validate error, V039/V056 hazibadilishwi.
Kisha C2.

## 2026-11-03 (cj-a) [ujumbe bila kichwa; kichwa kimewekwa na Claude]
wakati tunaendelea na maboresho soma module ya product ukishakuwa familia nayo ongeza column ya buying price.. per pieces ambayo utaipata kwenye module ya purchases

## 2026-11-03 (cj)
Loan A awamu 1 (386,000) ILILIPWA LEO 03/11 kutoka bahasha ya akiba (siyo droo).
  Rekebisha 61: transaction_date = 2026-11-03T12:00:00 (au isomwe kama kigezo: tarehe ya leo), notes "(03/11/2026)".
  KAGUA ikubali tarehe ≤ leo. Niambie ikiwa tayari; Chief ataiendesha LEO.
J2 = HAPANA (uamuzi wa mwisho). 64 imekamilika; usipendekeze J2 tena.
Reco 31/10: IMEIDHINISHWA. Chief anafunga Oktoba sasa.
Push: imekamilika (376a31d / 28afa80 / c875238). Repo ni private.
(ci) bado inatumika. Kisha C2.

## 2026-11-03 (ck)
61 KAGUA prod: malipo YAMESHAANDIKWA (deni 772,000, LOAN_REPAYMENT 1, awamu 1 PAID). Kinga imefanya kazi — LIPA haitaendeshwa.
Ongeza 61 hali ya "THIBITISHA" (kusoma tu) inayoonyesha malipo yaliyopo: tarehe ya journal, mistari yote (akaunti, Dr/Cr),
  interest_amount, payment_method, posted_by, reference, created_at. PASS ikiwa: tarehe 2026-11-03, Dr 2100 / Cr 1000 386,000 tu,
  riba 0, hakuna mstari wa 6600/1150. Vinginevyo eleza marekebisho (bila kuandika).
Chief ataiendesha na kuniletea log. Kisha C2.

## 2026-11-03 (cl)
Agent mwingine (C2) amekatwa. Wewe pekee ndiye agent kuanzia sasa.
1. KWANZA: kagua worktree zote na matawi yote (backend + V3) kwa mabadiliko yasiyocommitiwa au matawi mapya ya leo
   yaliyoachwa na agent wa C2. Orodhesha: tawi/worktree, faili, hali. USIYAUNGANISHE wala kuyafuta — niletee orodha.
2. (ck): IMEFUNGWA — Chief amethibitisha kwenye GL (03/11, Dr 2100 / Cr 1000 386,000, bila riba).
   THIBITISHA: maliza jaribio la .cmd, kisha commit .mjs + .cmd + MAAGIZO (ck, cl). Log za Chief zicommitiwe kama zilivyo.
3. Kisha C2 — ukianzia pale agent wa C2 alipoishia kama kazi yake ni salama, au upya. Niambie ulichagua lipi na kwa nini.

## 2026-11-03 (cm)
C2 — nyongeza kwenye harness kabla ya "0":
  - Kwa kila njia HAI iliyorekebishwa: assertion ya USAHIHI, siyo "haitupi kosa" tu. Tarehe imewekwa → idadi ya safu = SQL ya mkono
    yenye kichujio kilekile kwenye dump; tarehe null → kichujio kimeondolewa kweli. Angalau kesi moja kwa kila njia.
  - Tofautisha JPQL (cast(:d as LocalDateTime)) na native (CAST(:d AS timestamp)); harness ionyeshe aina ya kila njia.
  - Mpangilio: njia zinazogusa pesa/GL/stock/reco kwanza.
Push ya feature/c2-null-params mwisho wa siku (push-yote iongeze tawi hili au itumie git push -u).

## 2026-11-03 (cn)
1. Njia 25 zilizokufa → C7.
2. getInventoryValueSummary: rekebisha → Σ stock × current_average_cost (chanzo kilekile cha ukurasa wa Store/daftari). PG test: = daftari.
3. CapEx: approvedCount/assetCount zirudishe idadi halisi; min/max ziwe sehemu zenye majina sahihi ikiwa V3 inazitumia. Jaribio.
Kisha unganisha feature/c2-null-params → release/2.4.0 baada ya lango kamili: suite + pg-checks + c2-check + run-all E2E kwenye build hiyo.
  Sihitaji kusoma diff; nipe muhtasari: faili ngapi, njia ngapi, na orodha ya skrini ambazo namba zake zitabadilika baada ya deploy
  (ili Chief awaambie watumiaji).
Kisha C3.

## 2026-11-03 (co) — kama hujaipokea
Prod iko Contabo (siyo EC2) na inafanya kazi 24h — schedulers za 00:05 na 02:00 zinaendeshwa (log ya 62). Kwa hiyo
"Muhtasari wa Mauzo" ITATUMWA kila usiku baada ya deploy. Orodhesha nani ataipokea (SALES_READ, kwa jina) kwenye mpango wa deploy.
Sahihisha MATAWI/ripoti zinazotaja EC2 kuzimwa.

## 2026-11-03 (cp)
pg-checks.sh / c2-check.sh: zipakie secret za MAJARIBIO zenyewe (faili maalum, gitignored). Faili likikosekana → kataa kwa ujumbe wazi.
  Kinga: ikiona JWT secret au DB password inayolingana na hash ya prod → kataa.
Kisha C3.

## 2026-11-03 (cq)
Notification "Muhtasari wa Mauzo": wapokeaji = SALES_READ + status ACTIVE + si locked. Jaribio.
  Chief ataamua kama MANAGER (macheda) apate sehemu ya FAIDA — andaa chaguo: faida kwa wenye CEO/Executive CEO tu, wengine mauzo tu.
Hatua 73 / kinga: hifadhi PREFIX ya hash tu (hex 8 za kwanza), siyo hash nzima. Kinga ilinganishe prefix. Rekebisha kabla Chief hajaendesha 73.
Kisha C3.

## 2026-11-03 (cr)
Mpango wa deploy: DAILY_SALES_PROFIT_ROLES=CEO,Executive CEO (default ya prod — Chief anaweza kuongeza MANAGER baadaye).
  Andika onyo: env inatumia JINA la role; ukibadilisha jina la role, sasisha env.
Kisha C3.

## 2026-11-03 (cs)
C3 toleo dogo (malipo ya msambazaji + malipo wakati wa kununua):
  - Chanzo cha lazima, bila default: DROO / BENKI (orodha ya akaunti halisi, siyo maandishi) / SIMU (orodha) / MMILIKI.
  - Kanuni ya cutover: kabla ya gl_config.bank_cutover_date → GL Cr 1000 kwa DROO/BENKI/SIMU (chanzo kihifadhiwe kwenye rekodi);
    baada ya D → Cr akaunti halisi. Sawa na repayment ya mkopo. PG test pande zote mbili za D.
  - MMILIKI → Cr akaunti mpya ya madeni "Deni kwa mmiliki – Paul" (kundi 2xxx), SIYO 3000. Migration ya akaunti ndani ya V138
    ikiwezekana (bado haijaenda prod), vinginevyo V139.
  - Reco HAIGUSWI. Macheda anaendelea kuandika manunuzi ya droo kwenye reco kama leo.
BAADA-YA-BATCH: mstari wa auto wa droo kwenye reco + kuondoa uandishi wa mkono wa manunuzi (bila kuhesabu mara mbili).
1010: BAADA.
Rekodi za zamani: hazibadilishwi.
Kadiria upya muda wa toleo hili dogo.

## 2026-11-04 (ct)
FREEZE YA VIPENGELE kuanzia leo. Kitu kipya kinaingia batch IKIWA TU: (1) kinaandika pesa/stock/data isiyo sahihi kwenye prod,
au (2) kinazuia deploy. Vinginevyo → BAADA-YA-BATCH bila kuuliza. Hii inatumika pia kwa mapendekezo yangu.
BAADA: hatua 74 ("Umelipa sasa" ya zamani), orodha ya benki zilizowashwa (kabla ya cutover D), wasambazaji wa mkopo, deni kwa mmiliki kwa Jess.
Batch iliyobaki: C5/C8 → C6 → C7 → C9 → script ya staging → script ya prod. Kisha staging.
Ukigundua kosa jipya: liandike, sema kama linatimiza (1) au (2), na uendelee.

## 2026-11-04 (ct) [herufi ileile mara ya pili; Claude anaiita (ct-2)]
Uamuzi wa Chief: kazi ZOTE — batch iliyobaki (C5/C8, C6, C7, C9, script za staging/prod) PAMOJA NA BAADA-YA-BATCH yote — zinamalizika kabla ya staging.
ORODHA IMEFUNGWA LEO 04/11: kosa jipya litakalogunduliwa → liandike tu; liingie ikiwa linaandika pesa/stock/data isiyo sahihi kwenye prod. Hakuna vipengele vipya vingine.
Kwanza (kabla ya code): jedwali la kila kipengele cha BAADA — jina, makadirio (siku), kinategemea uamuzi/data ya Chief (ndiyo/hapana, nini).
  Pendekeza mpangilio (pesa/GL kwanza) na tarehe mpya ya freeze. Kisha endelea kwa mpangilio huo.

## 2026-11-04 (cu)
Uamuzi wa Chief: STAGING + PROD JUMATATU 09/11 (dirisha la TANESCO — duka limesimama).
Toleo la 1 = release/2.4.0 + release/3.2.0 kama zilivyo IJUMAA 06/11 jioni (code freeze), pamoja na K0–K2 zikipita lango.
Mpangilio hadi Ijumaa:
  1. pg-checks + c2-check za K1 (Chief anafunga programu kwa RAM) → unganisha K0+K1 → K2.
  2. Script ya STAGING (Jumamosi/Jumapili 07–08/11 kwenye ~/lsms-staging, dump ya prod ya karibuni, Flyway V135→V138).
  3. Script ya PROD: backup (pg_dump + B2) → 2.4.0 + 3.2.0 dirisha moja → ukaguzi → rollback ya 2.3.0/3.1.11 iliyoandikwa.
     LAZIMA iweze kuendelea baada ya kukatika (umeme/mtandao wa Chief) — kila hatua idempotent, na hali yake ihifadhiwe.
     Env mpya (DAILY_SALES_PROFIT_ROLES, ROOT_PASSWORD:-) ndani ya script.
  4. C9 (deploy-v3 -n).
NJE ya Jumatatu: C6 (DROP), C7 (Flutter/dead code), na BAADA yote → toleo la 2 (matawi mapya baada ya freeze ya Ijumaa).
Lango la staging linahitaji hatua 73 — Chief ataiendesha kabla ya Jumamosi.

## 2026-11-04 (cu-a) [ujumbe bila kichwa, baada ya (cu); kichwa kimewekwa na Claude]
sasa hivi hatumii kabisa E@E tunatumia contabo hiyo iinode kabisa na usitumie tena

## 2026-11-09 (cy)
LEO ni staging + prod (TANESCO 08:00–16:00; prod lazima ianze kabla ya 11:00; rollback ya mwisho 14:00).
Ripoti ya UTAYARI mara moja, kabla ya kitu kingine:
  - (cx) 1–5: kila kimoja ✅/❌ (K2, ADMIN_PASSWORD, DOCKERHUB token, script ya staging, script ya prod, C9).
  - Hash za mwisho: backend release/2.4.0, V3 release/3.2.0; origin = local?
  - Lango kwenye build hiyo: suite, pg-checks (hash halisi), c2-check, run-all E2E.
  - Script ya prod: hatua kwa hatua na muda; rollback imejaribiwa wapi?
  - Amri ya kuendesha staging (moja), na inachohitaji kutoka kwa Chief (password, token).
Ikiwa kimoja ni ❌ kinachozuia: sema wazi "HAKUNA PROD LEO" na sababu.

## 2026-11-09 (cz) — inachukua nafasi ya (cv)(cw)(cx) zilizopotea
Endelea. Mpangilio:
 1. Hatua 72 (C1 siri za dev) → unganisha release/2.4.0 → main na release/3.2.0 → main (image zinajengwa kutoka main).
 2. Lango kwa hash HALISI (73): suite, pg-checks, c2-check. E2E run-all INARUDI kama lango la mwisho (local, build ya mwisho);
    V3 pia ikaguliwe kwa mkono kwenye staging.
 3. ADMIN_PASSWORD: grep 2.3.0 + release/2.4.0 — kinachoisoma? Ikiwa hakuna → script ya prod iiondoe kwenye .env (backup kwanza).
    DOCKERHUB: token MBILI — (a) ya kupush kwenye PC (read/write, Chief anaingiza kwa siri wakati wa hatua); (b) ya server READ-ONLY
    (docker login --password-stdin), DOCKERHUB_PASSWORD iondolewe kwenye .env.
 4. Script ya STAGING = script ileile ya prod (pamoja na rollback). Iendeshwe LEO kwenye ~/lsms-staging na dump ya prod ya leo.
 5. Script ya PROD: backup (pg_dump + B2 + sha256) → deploy 2.4.0+3.2.0 → smoke → rollback iliyoandikwa; inaendelea baada ya kukatika;
    muda kwa kila hatua (lengo ≤ saa 2). Env mpya: DAILY_SALES_PROFIT_ROLES=CEO,Executive CEO.
 6. Image: baki na MBILI tu (mpya + iliyotangulia) kwenye server na PC; za zamani zaidi zifutwe. Iliyotangulia ifutwe baada ya siku 7
    bila tatizo au kwenye deploy inayofuata. KAMWE usifute iliyotangulia siku ya deploy.
Prod: Jumatano 11/11, 08:30–11:30 (baada ya reco; wafanyakazi wanaanza 12:00). Uamuzi wa rollback: 11:30.
Ripoti baada ya kila hatua 1–5.

## 2026-11-09 (da)
Chief anataka prod LEO kama lango linaruhusu. Fuata (cz) 1–6 kwa haraka, kwa masharti haya:
  - 13:30 = uamuzi: staging (pamoja na rollback iliyojaribiwa) imepita → prod 13:30–15:00; vinginevyo prod KESHO 10/11 08:30–11:30.
  - 15:00 = rollback ya mwisho (mauzo ya karatasi yanaanza 16:00).
  - Usiruke lango lolote ili kuwahi muda. Ukiona hutafika 13:30, sema mapema (11:30) na endelea na maandalizi ya kesho.
Kipaumbele cha script: rollback kwanza (2.3.0 + 3.1.11 zibaki), kisha deploy, kisha smoke. Image iliyotangulia HAIFUTWI leo.

## 2026-11-09 (db)
72 imeshindwa 10:47: "spring.datasource.password ya dev haina thamani halisi". Tafuta dev inapata password wapi (env var ya Windows?
  faili jingine? docker-compose ya local?). Rekebisha 72 ishughulikie hali hiyo (au iulize password kwa siri) — usiweke password kwenye git.
  Jaribu kwenye nakala kabla Chief hajaendesha tena.

## 2026-11-09 (dd)
72 ANZA: Maven ilitumia JDK 23 kwenye CMD ya Chief. Script zote zinazojenga (72, staging, prod) zitafute JDK 21 zenyewe
kama deploy-backend.ps1 (JAVA_HOME_21 → ~\.jdks → Program Files) na zisimame kwa ujumbe wazi zisipoipata.

## 2026-11-09 (de)
Kutoka 75:
- Script ya deploy (prod + staging): ondoa ADMIN_EMAIL/ADMIN_PASSWORD kwenye compose (aws.yml:37, yml:36; staging yml:49) na .env (backup kwanza).
- DOCKERHUB: docker logout → docker login --password-stdin (token read-only) → ondoa DOCKERHUB_USERNAME/PASSWORD kwenye .env. Prod na staging.
- Staging: pakia dump ya LEO (lsms_20261109_0200 au pg_dump mpya) kabla ya deploy ya majaribio.
- Image: SIKU YA DEPLOY usifute chochote. Baada ya prod kuthibitishwa (siku 7 au deploy inayofuata): futa 2.2.58–2.2.71, 2.3.0-rc1, 2.3.0-rc2;
  baki na 2.3.0 (iliyotangulia) + 2.4.0. Sasisha .backend.prev=2.3.0 na .frontend-v3.prev=3.1.11 wakati wa deploy.
- Toleo la 2 (C7): Flutter 2.2.53 + docker-compose.aws.yml.
Diski: 183G wazi — nafasi siyo kizuizi.
Endelea: merge main → lango (hash halisi) → script → staging.

## 2026-11-09 (df)
Endelea. Majina: 2.4.0 na 3.2.0 (sawa na mpango wako).
Rollback — kabla ya script: orodhesha kila safu iliyoongezwa na V136–V138 kwenye jedwali LILILOKUWEPO, na NOT NULL/default yake.
  Safu yoyote NOT NULL bila default ambayo 2.3.0 haiijui = rollback itavunjika → iwe nullable au na default (bado haijaenda prod).
Staging, baada ya rollback kwenda 2.3.0 + 3.1.11, thibitisha KAZI halisi (siyo boot tu): login, sale (cash), kufuta sale,
  ununuzi + malipo ya msambazaji, reco entry, GL journal ya sale. Kisha deploy 2.4.0 tena na kurudia smoke.
Push: baada ya kujenga image, Chief ataendesha push-yote (backend main + V3 main).

## 2026-11-09 (di)
76 staging refresh-db: "pg_restore: input file is too short (read 0, expected 5)" kwenye lsms_20261109_0200.dump (9,714,806 bytes).
1. Thibitisha dump ni nzima: pg_restore --list kwa njia sahihi (docker exec -i ... < file, au nakili ndani ya container). Ripoti idadi ya entries.
   Fanya hivyo pia kwa lsms_20261108_0200.dump. Ikiwa mbovu → SIMAMA, niambie (tatizo la backup za kila usiku).
2. Rekebisha 76 (refresh-db NA K2 ya prod — njia ileile) + jaribio kwenye server ya kuigiza linalotumia faili halisi la .dump.
3. Thibitisha DB ya staging haikuguswa.
Kisha Chief ataendesha refresh-db tena.

## 2026-11-09 (dj)
Staging deploy SAWA (74s). Thibitisha kama refresh-db ilipita kabla (data ya leo?); kama siyo → refresh-db + deploy tena.
Kisha: rollback → 76-kazi kwenye 2.3.0 → deploy → 76-kazi kwenye 2.4.0. Nipe amri za Chief kwa mpangilio.
(dg) K6 ya prod: ongeza smoke ya API ya kusoma tu kabla ya kesho.

## 2026-11-09 (dk)
76 staging kazi 2.3.0: PASS 14 / FAIL 1 — reco: "Hakuna mauzo yaliyorekodiwa kwa tarehe hii" (sale ya jaribio ilifutwa kabla ya reco;
staging haina mauzo ya leo). Rekebisha mpangilio: sale ya pili ya jaribio IBAKI mpaka reco (create + expense + kufuta expense) ikamilike,
kisha ifutwe. Jaribu local. Kisha Chief: kazi tena kwenye 2.3.0 → deploy → kazi kwenye 2.4.0 → smoke.

## 2026-11-09 (dl)
PROD 2.4.0 + 3.2.0 IMEKAMILIKA (Chief amekagua browser: mikopo, login audit n.k. SAWA). Hifadhi log zote za prod + staging.
Kesho asubuhi: hatua ya kusoma tu (prod): gl_posting_failure tangu deploy, LOANINT ya 10/11, notification za "Muhtasari wa Mauzo"
  (nani, ina faida au la), login_audit ya saa 24 za kwanza, ERROR kwenye log ya backend.
Kisha: toleo la 2 — MPANGO-CT2 kwa mpangilio wake (pesa/GL kwanza). Usafi wa image tarehe 16/11 (hatua tofauti).

## 2026-11-09 (dn)
Uamuzi wa Chief: 2a kwa njia ya DATA bila deploy (benki zisizotumika → is_active=false kwa hatua; prepaid 2027 → journal za mkono).
Viporo vyote vinamalizika kwanza, kisha deploy moja ya toleo la 2.

KIPAUMBELE CHA KWANZA — gharama za mwezi (Capital → Expenses / Monthly budgets). Hatua 79 (prod, KUSOMA TU):
  a) OPE-MON zenye tarehe > leo: idadi, jumla, kwa budget, na journal zake (tarehe, akaunti). Kwa nini "malipo ya wafanyakazi" ina 14 created (hadi 11/2027)?
  b) Budget zilizo STOPPED: gharama zilizoundwa kabla na baada ya stop; zilizo kwenye mwezi wa sasa.
  c) Nakala: zaidi ya gharama moja kwa (jina linalofanana, mwezi) — Azam, TTCL, Frame, TRA.
  d) "Malipo Ya TRA" 250,000×11 tangu 01/2026: zimeundwa lini (backfill?), journal zake zimeangukia kipindi gani (vilivyofungwa → siku ya kwanza wazi?).
  e) Kodi ya Frame: 2.4M ya mwaka (01/01) + budget 200,000/mwezi — mwingiliano.
  f) Jumla ya athari kwenye GL kwa mwezi (2026 na 2027).
  Hakuna kuandika. Kisha pendekeza hatua ya marekebisho (KAGUA → ANDIKA), kwa kanuni za vipindi vilivyofungwa.
Code (toleo la 2, kosa la pesa):
  - Scheduler isiunde gharama za mwezi ujao kabla ya mwezi huo (au ieleze kwa nini 12 mbele). Hakuna backfill kwenye vipindi vilivyofungwa bila uamuzi wa CEO.
  - Stop: iulize "na gharama ya mwezi huu ambayo bado haijalipwa?" → ikatwe (reversal) kwa uthibitisho.
  - Kinga ya nakala: budget mpya yenye jina/kiasi kinachofanana na iliyopo → onyo.
  - Capital: gharama za mwaka zionekane pamoja na za mwezi; orodha ionekane bila kuandika tena (bug ya skrini).
Footer "© 2026 Elikom Group Company Limited": iwe jina la biashara lililosajiliwa (Chief atalitaja) mpaka kampuni isajiliwe; liwe la kubadilika (config).

## 2026-11-09 (dp)
Chief: Flutter HAITUMIKI tena. Gharama za mwaka: soma jinsi Flutter ilivyofanya (skrini, sehemu, API, mtiririko) na uhamishie V3 —
  UI/mtiririko kama ulivyo Flutter, LAKINI uandishi wa GL uwe mpya: Dr 1160 prepaid / Cr chanzo (C3) → 1/12 kwa mwezi kwenda gharama.
  Onyesha kwenye ripoti kwa Chief: Flutter iliandika nini kwenye GL (kwa mfano Frame 2.4M 01/01) dhidi ya muundo mpya.
Kabla ya C7: orodha ya kila kitu Flutter inacho ambacho V3 haina — Chief ataamua kipi kihamishwe.

## 2026-11-09 (dm) [ilifika baada ya (dp)]
Tag: v2.4.0 → commit ya backend iliyojenga image (9b6678a), v3.2.0 → commit ya V3 iliyojenga image (922c3ac).
  Annotated, digest ya image ndani ya ujumbe. push-yote izipushe (bila force).
"2a" = chaguo la kufanya prepaid 1160 + orodha ya benki kabla ya Desemba; Chief amechagua njia ya DATA bila deploy (dn).
G4 (Capital): gharama ya mwezi ujao isiandikwe "Approved · in the books" — iwe "Imepangwa" mpaka journal iandikwe.
G1: backfill ya budget mpya kwenye kipindi kilichofungwa → KATAA (siyo kuhamishia siku ya kwanza wazi), isipokuwa kwa uamuzi wa CEO.

## 2026-11-09 (dq)
Kutoka 79 — hatua 80 (KAGUA → 🛑 → ANDIKA), mpangilio:
 1. HARAKA (leo, kabla ya postDue ijayo): futa (soft-delete + audit) watoto 11 walioidhinishwa BILA journal:
    TAX-MON 2026-01..2026-10 (10×250,000) + REN-MON-20261001-...-F4B73208 (200,000). Hakuna GL inayoguswa. KAGUA ithibitishe journal = 0 kwa kila mmoja.
    Sema postDue inaendeshwa saa ngapi, na 2.4.0 ingefanya nini nazo (gl_posting_failure au kuhamia Nov?).
 2. Novemba (wazi) — reversal kwa uthibitisho: Azam 2 kati ya 3 (baki ya budget hai 1F69FDCB ikiwa ndiyo ya Nov iliyo hai — onyesha unayoibakiza),
    TTCL 1 kati ya 2 (baki Kifurushi C1B0BA4D; reverse Malipo Ya Bando A4A2EBD8). Nakala za Desemba za budget zilizosimamishwa: thibitisha zimefutwa.
 3. TRA: jumla ya 2026 = 250,000 → marekebisho ya Novemba −20,833.33 (Nov ibaki 229,166.67). Akaunti: ileile ya TAX-MON Nov (6800).
 4. Frame: SUBIRI majibu ya Chief (lini, kipindi, chanzo). Andaa chaguo: (a) 2.0M Novemba, (b) 200k/mwezi Nov–Des + 1.6M Novemba, ukionyesha athari.
 G4: gharama za mbele zionyeshwe "Imepangwa". G1: backfill ya vipindi vilivyofungwa → kataa. G4: orodha ionekane baada ya kuhifadhi (chanzo cha nakala za 04/11).

## 2026-11-09 (dr)
Majibu ya Chief:
 - Frame 2,400,000/mwaka (Jan–Des 2026). Jan–Sep (1,800,000) ALILIPA CHIEF KUTOKA MFUKONI → 2300 Deni kwa mmiliki – Paul.
   Okt–Des (600,000) HAIJALIPWA → italipwa ~01/01/27 kutoka akiba ya kila siku (~7k).
 - TRA 250,000/mwaka; 65,000 bado haijalipwa. (Chief atasema 185,000 ililipwa lini/kutoka wapi.)
 - Azam = 1 (TV), TTCL = 1 (bando), zote kila mwezi → nakala za Nov: reverse Azam ×2, TTCL ×1.
Hatua 80 (KAGUA → 🛑 → ANDIKA), marekebisho yote Novemba (kipindi cha kwanza wazi), maelezo "Marekebisho ya 2026 …":
 a) Futa watoto 11 bila journal (dq-1) — KWANZA.
 b) Pango: GL ya 2026 iwe 2,400,000 gharama; Cr 2300 1,800,000; Cr akaunti ya madeni ya gharama zinazodaiwa (tafuta iliyopo kwenye chart, vinginevyo ongeza kwa hatua) 600,000 kufikia Desemba;
    rekebisha Cr 1000 za 01/01 (200k) na Nov (200k) kwani hazikutoka kwenye biashara. Desemba: accrual 200k (siyo Cr 1000).
 c) TRA: gharama 2026 = 250,000; 65,000 → inayodaiwa; 185,000 → chanzo kitathibitishwa na Chief (subiri kabla ya ANDIKA ya sehemu hii).
 d) Azam ×2, TTCL ×1 reversal (dq-2).
 KAGUA ionyeshe: kila journal, na salio la 1000/2300/inayodaiwa/6xxx kabla na baada; TB 0. Malipo ya 01/01/27 (600k) yatafanyika kwa "Lipa" ya kawaida.
Budget ya pango: usiifungue tena kwa Cr 1000 — Desemba inashughulikiwa na accrual ya (b).

## 2026-11-09 (ds)
TRA 185,000 ILILIPWA KUTOKA BIASHARA. Kwa hiyo hatua 80 (marekebisho ya Novemba):
 Pango: Dr 1000 400,000 + Dr <gharama ya pango> 1,800,000 / Cr 2300 1,800,000 + Cr <pango linalodaiwa> 400,000.
        Desemba (01/12, accrual): Dr <gharama ya pango> 200,000 / Cr <pango linalodaiwa> 200,000. Hakuna Cr 1000.
 TRA:   Dr 1000 85,833.33 / Cr <gharama ya TRA, 6800> 20,833.33 + Cr <TRA inayodaiwa> 65,000.
 Azam ×2 + TTCL ×1: reversal (Dr 1000 111,000 / Cr gharama).
 Akaunti ya pango: Jan ilitumia 6200, Nov 6000 — chagua moja (ya "Rent"), na marekebisho yaende hiyo.
 Akaunti za madeni (pango linalodaiwa, TRA inayodaiwa): tumia zilizopo kwenye chart ikiwa zipo; vinginevyo ziongeze kwa hatua hiyo hiyo.
 KAGUA: kila journal + salio la 1000, 2300, madeni, gharama ya pango 2026 (=2.4M baada ya Des), TRA 2026 (=250k); TB 0.
 Mpangilio: (dq-1) futa watoto 11 → (ds) → (dq) nyingine.

## 2026-11-09 (dt)
80 a–d IMEKAMILIKA prod: 1000 14,199,464.87 | 2200 −65,000 | 2300 −1,800,000 | 2400 −400,000 | 6000 2,200,000 | 6800 250,000 | 6200 6,048,300 | TB 0.
e = 01/12 (Chief). Malipo ya 2400 (600k ~01/01/27) na 2200 (65k) lazima yatumie njia inayopunguza deni (siyo gharama mpya) —
  hakikisha V3 ina njia hiyo (Lipa deni la gharama / kodi), au andaa hatua; ingiza kwenye toleo la 2 ikiwa haipo.
Kisha: endelea na viporo vya toleo la 2 kwa mpangilio (G1–G5 kwanza, kwa sababu ndivyo vilivyosababisha makosa haya).

## 2026-11-09 (du)
Health: 1200 GL 6,288,769 vs daftari 6,290,186 → tofauti 1,417 (02/11 ilikuwa −8.77). Ongeza kwenye hatua 78 (kesho):
  tofauti kwa bidhaa (zile zenye tofauti > 0) na tangu lini; mwendo wa stock tangu 02/11 unaohusika (ununuzi uliofutwa/K2, rounding ya avg).
  Pendekeza: kizingiti cha onyo (k.m. < 5,000 = taarifa tu, siyo "books need correcting"), na kama ni bug ya K2.
Chief asibofye "Correct" mpaka ripoti hii.

## 2026-11-09 (dv)
H1: kizingiti = max(5,000, 0.1% ya thamani ya stock). Chini yake → "taarifa" (siyo onyo jekundu) + mwelekeo wa siku 7 (tofauti kila siku).
  Ikiongezeka siku 3 mfululizo → onyo hata kama iko chini ya kizingiti. "Correct" ibaki kwa CEO (inapendekezwa mwisho wa mwezi).
push-yote: ongeza kila tawi la feature/* la toleo 2 linalotumika (kwa sasa feature/t2-gharama), au utaratibu wa kuongeza matawi mapya kiotomatiki.

## 2026-11-10 (dw)
78: GL failure 0, LOANINT SAWA, muhtasari SAWA (macheda mauzo tu), backup SAWA, stock −1,417.02 (sawa na jana → rounding; Correct 30/11).
TATIZO: MaterializedViewScheduler "Failed to refresh materialized views: Executing an update/delete query" kila saa 2 tangu deploy.
  1. Je, lilikuwepo 2.3.0? (logs za kabla ya 09/11 13:55, au code ya v2.3.0 dhidi ya v2.4.0 — C2 iligusa query hiyo?)
  2. View zipi, nani anazisoma (ripoti/dashboard zipi zinaonyesha data ya zamani sasa), zilisasishwa mara ya mwisho lini.
  3. Ikiwa ni regression ya 2.4.0 → hotfix 2.4.1 (tawi hotfix/2.4.1 kutoka v2.4.0), jaribio la PG linalothibitisha refresh inafanya kazi,
     kisha 76 staging → prod. Ikiwa ilikuwepo kabla → toleo la 2.
"SELLING BELOW RECOMMENDED PRICE" ni ERROR kwenye log — ni tukio la biashara, siyo kosa la mfumo: liwe WARN + audit (toleo 2, pamoja na kanuni ya punguzo).

## 2026-11-10 (dx)
M1 = (b): ondoa MaterializedViewScheduler + refresh (sehemu ya C7); DROP ya view 4 ni hatua tofauti (kama C6). Hatua 81 HAIENDESHWI (hakuna msomaji).
L1: SELLING BELOW → WARN + audit, pamoja na 0.1.
Mpangilio wa kazi kuanzia sasa (moja baada ya nyingine; ripoti fupi + jedwali la origin kila moja ikiisha):
 1. G1–G5 (gharama za mwezi/mwaka; G5 prepaid 1160, V140).
 2. Njia ya kulipa madeni ya gharama 2400 / 2200 (Dr deni / Cr chanzo C3), bila gharama mpya.
 3. Punguzo chini ya gharama → CEO + sababu (+ L1).
 4. Tozo ya mfanyakazi kwa gharama (bila 4900).
 5. Kanuni za hesabu ya stock + bidhaa za kupima (BAADA §2).
 6. 1010 akiba; droo kwenye reco (§8); hatua 74 (§9); wasambazaji wa mkopo; deni kwa mmiliki – Jess.
 7. SKU za Jagger; ripoti ya uendeshaji kwa avg.
 8. C4 marejesho ya mauzo.
 9. ORODHA-FLUTTER-V3 → C7 (pamoja na M1; Flutter mwisho) → C6 (+ DROP view 4) → Flyway V039/outOfOrder → config.
Kipengele kikihitaji uamuzi au data ya Chief: kiweke kando, endelea na kinachofuata, na uniorodheshee maswali kwenye ripoti.
Kosa jipya: liingie tu ikiwa linaandika pesa/stock/data isiyo sahihi kwenye prod.

## 2026-11-10 (dy)
Kanuni: V3 main = prod (v3.2.0 + analysis/ tu). Code ya toleo 2 ya V3 iende feature/t2-* kama backend.
  Hamisha commit za app (G2–G5 n.k.) kutoka V3 main → feature/t2-gharama (V3); main irudi kwenye code ya v3.2.0 (analysis/ ibaki).
  Thibitisha: diff ya main dhidi ya tag v3.2.0 nje ya analysis/ = 0. Hotfix yoyote ya V3: tawi hotfix/* kutoka tag v3.2.0.
G5 idhini: Chief ndiye pekee mwenye FINANCE_WRITE. Pendekeza: CEO anaweza kuidhinisha yake mwenyewe kwa sababu ya lazima + audit
  (au ruhusa ya "idhini tu" kwa Executive CEO). Niletee chaguo — usijenge mpaka Chief aamue.
E2E ya G2–G5 sasa (Playwright, local, build ya feature/t2-gharama + backend ya tawi hilo): Stop yenye swali, onyo la nakala,
  "Imepangwa", gharama ya mwaka (1160 → 1/12). Kisha kazi 2.

## 2026-11-10 (dz)
G5 idhini = (a): CEO anaweza kuidhinisha gharama ya mwaka aliyoiingiza yeye mwenyewe, kwa sharti:
  - sababu ya lazima (kanuni ya ubora wa sababu ya A6: ≥10, siyo herufi moja inayojirudia);
  - audit: nani aliingiza, nani aliidhinisha, sababu, kiasi, chanzo (C3), muda;
  - "kujiidhinisha" ionekane wazi kwa wenye ruhusa ya kukagua (Executive CEO anaona orodha ya gharama zilizojiidhinisha — kusoma tu).
  Mtumiaji mwingine yeyote (si CEO) bado anahitaji mtu wa pili. Jaribio: CEO bila sababu → kataa; CEO na sababu → SAWA + audit;
  MANAGER kujiidhinisha → kataa.
Pamoja na (dy): hamisha code ya V3 kutoka main → feature/t2-gharama; E2E ya G2–G5; kisha kazi 2.

## 2026-11-10 (ujumbe bila herufi, baada ya dz)
E2E NI AWS AHTUTUMI TENA ELEWA HIYO SASA HIVI TUNATUMIA CONTABO

## 2026-11-10 (ujumbe bila herufi, unafuta uliotangulia)
hapana endelea kutumia e2e nilikosea kusoma na kuelewa

## 2026-11-10 (ea)
Chief: Executive CEO (Jess) AKUSUDIWA kuwa na CAPITAL_WRITE + CAPITAL_APPROVE (mtu wa pili wa kuidhinisha). Usiziondoe.
Kanuni inabaki: hakuna anayejiidhinisha isipokuwa CEO kwa sababu + audit. Kisha kazi 2.

## 2026-11-10 (eb)
Andaa hatua 82 ya dharura (data path, KAGUA → ANDIKA): kulipa 2400/2200 (Dr deni / Cr chanzo, kanuni ya cutover), bila gharama mpya.
Itumike TU ikiwa malipo ya pango (600k ~01/01/27) au TRA (65k) yatatokea kabla toleo 2 halijaenda prod.
KUPIMA uhamisho: 46,000 ya 29/10 HAIANDIKWI sasa — hesabu halisi ya siku ya uhamisho ndiyo itaandikwa.
Manunuzi ya vipimo 159,000: hatua ya uhamisho iwe na chaguo zote mbili (yalilipwa kweli / hayakulipwa) — Chief atajibu.

## 2026-11-10 (ec)
Kazi 3 = (b): sale chini ya gharama INARUHUSIWA kwa sababu ya lazima (kanuni ya A6), na inaingia kwenye banner/Kagua ya mabadiliko
  ya mauzo mpaka CEO "Nimeona" (kama A6). L1: "SELLING BELOW" → WARN + audit. Hakuna kuzuia sale.
Footer: "Babuu Liquor Store" (config; Chief atathibitisha tahajia kwa cheti).
Kupima: Chief bado anakusanya data (vipimo kwa chupa, bei). Kwa sasa (kusoma tu, prod-copy): eleza jinsi kupima inavyofanya kazi leo —
  bidhaa za kupima zina uhusiano gani na chupa (conversion?), mauzo ya kipimo yanapunguza stock kwa kiasi gani, na kwa nini
  mfumo unaonyesha 9–10 kwa kila bidhaa. Pendekeza muundo wa "Fungua chupa" (chupa → vipimo N, gharama ÷ N, tofauti mwishoni → 5100,
  hesabu ya wiki kwa chupa + kiwango cha zilizo wazi), bila kujenga mpaka Chief alete N.

## 2026-11-10 (ed)
Muundo wa KUPIMA (Chief + Claude) — andika MUUNDO-KUPIMA.md, USIJENGE mpaka Chief alete N na bei:
 - Bidhaa: "Aina ya kuuza" = KAWAIDA | KUPIMA. KUPIMA ina: bidhaa_mzazi (chupa nzima kwenye store), vipimo_kwa_chupa (N), bei_ya_kipimo.
 - Mauzo (V3 POS): bidhaa ya KUPIMA inaonyesha progress bar ya chupa iliyo wazi (vipimo vilivyobaki / N).
   Kuuza kipimo → −1 kwenye chupa iliyo wazi; gharama ya kipimo = avg ya mzazi ÷ N.
   Bar = 0 → "Fungua chupa mpya?" → mzazi −1 kwenye store, bar = N. Chupa MOJA tu wazi kwa bidhaa.
 - "Chupa imeisha": vipimo vilivyobaki kwenye bar → upotevu wa kumwagika (Dr 5100 / Cr 1200, kwa gharama), bila tozo kwa mfanyakazi;
   ripoti ya upotevu kwa chupa (bidhaa, tarehe, aliyefungua/kufunga, vipimo vilivyopotea).
 - Kuuza chupa nzima: kutoka mzazi moja kwa moja.
 - Hesabu ya wiki: chupa zilizofungwa (idadi) + chupa iliyo wazi kwa kiwango (1, ¾, ½, ¼) dhidi ya bar.
 - Uhamisho wa data ya sasa: hali ya leo (9–10 "wazi" kwa bidhaa) → hatua ya mara moja baada ya hesabu halisi.
Pamoja na (ec): eleza jinsi kupima inavyofanya kazi leo kabla ya muundo huu.

## 2026-11-10 (ee)
Sahihisho la (ed): KUPIMA inapimwa kwa ML, siyo idadi ya vipimo.
 - Bidhaa ya KUPIMA: bidhaa_mzazi, ujazo_wa_chupa_ml, na ORODHA ya vipimo {ml, bei} (k.m. Konyagi 750ml: 30ml=1,000; 60ml=2,000).
   Bei inatofautiana kwa kinywaji.
 - Progress bar: ml zilizobaki / ujazo. Kuuza kipimo → −ml yake. Gharama ya kipimo = avg ya mzazi ÷ ujazo × ml.
 - "Chupa imeisha": ml zilizobaki → upotevu (5100) kwa gharama. Ripoti kwa chupa: ml zilizopotea na sawa na vipimo vingapi vya 30ml.
 - Ripoti ya faida kwa kinywaji: mapato ya kupima kwa chupa dhidi ya bei ya kuuza chupa nzima.
Mengine ya (ed) yanabaki. Usijenge mpaka Chief ajaze jedwali (ujazo + vipimo + bei kwa kila kinywaji).

## 2026-11-10 (ef) — muundo wa KUPIMA (unachukua nafasi ya (ed) na (ee))
Kanuni (zimeamuliwa na Chief):
 1. Ruhusa MPYA peke yake, k.m. KUPIMA_SETTINGS: ndiye pekee anayeweza kuunda/kubadilisha mipangilio ya kupima (ml, bei, chombo, mzazi).
    Isiunganishwe na ruhusa ya jumla ya bidhaa. Mpewa wa kwanza: CEO + Executive CEO. Kuuza / kufungua / "chombo kimeisha" = ruhusa za mauzo za kawaida.
 2. Hakuna kipimo maalum wakati wa kuuza — vipimo vilivyosajiliwa tu.
 3. Bei ya kipimo < gharama yake (avg ya mzazi ÷ ujazo × ml): onyo wakati wa kusajili; wakati wa kuuza → kanuni ya kazi 3 (b): inaruhusiwa kwa sababu + banner.
 4. Mabadiliko ya bei/ml: yanatumika kwa mauzo yajayo tu; historia (nani, lini, zamani → mpya).
Muundo:
 - Bidhaa: "Aina ya kuuza" = KAWAIDA | KUPIMA. KUPIMA: jina la chombo (chupa/dumu/…), ujazo_ml (yoyote: 250, 750, 5000…),
   bidhaa_mzazi (store), ORODHA ya vipimo {ml, bei} — mistari mingi (30/60, 50, 60/70, …).
 - POS (V3): progress bar ya chombo kilicho wazi (ml zilizobaki / ujazo) + vitufe vya kila kipimo na bei yake.
   Kuuza → −ml; gharama ya kipimo = avg ya mzazi ÷ ujazo × ml. Bar haitoshi kwa kipimo → "Fungua chombo kipya?" → mzazi −1, bar = ujazo.
   Chombo KIMOJA tu wazi kwa bidhaa.
 - "Chombo kimeisha": ml zilizobaki → upotevu (Dr 5100 / Cr 1200, kwa gharama), bila tozo; rekodi: aliyefungua, aliyefunga, tarehe, ml zilizopotea.
 - Kuuza chombo kizima: kutoka mzazi moja kwa moja.
 - Hesabu ya wiki: vyombo vilivyofungwa (idadi) + kilicho wazi kwa kiwango (1, ¾, ½, ¼) dhidi ya bar.
 - Ripoti: upotevu kwa chombo/kinywaji; faida ya kupima dhidi ya kuuza chombo kizima.
 - Uhamisho wa data ya leo (9–10 "wazi" kwa bidhaa): hatua ya mara moja (KAGUA → ANDIKA) BAADA ya Chief kuhesabu na kuweka mipangilio.
Jenga kwenye feature/t2-kupima (backend + V3), na majaribio: unit + PG + E2E (POS: kuuza 30/60, kufungua, kuisha, ruhusa).
Mpangilio: baada ya kazi 3. Kwanza eleza jinsi kupima inavyofanya kazi leo (ec).

## 2026-11-10 (eg)
Footer: "Babuu Liquor Store" — imethibitishwa, weka.
KUPIMA — majibu ya Chief:
 - Manunuzi ya vipimo (159,000, 20/02–17/08) HAYAKULIPWA — yaliingizwa ili kupata stock tu.
 - Kila chupa iliyopelekwa kupima ILIPUNGUZWA MANUAL kwenye store ya mzazi.
 - Vipimo vya leo: Konyagi 30ml = 1,000 (chupa 750ml); Moon Light 50ml = 2,000; Wine 70ml = 500 kutoka dumu 5L (5,000ml).
   Golden King / Gilbeys / Camino / ujazo wa Moon Light: Chief atataja kabla ya uhamisho.
Hatua ya uhamisho (sehemu ya KUPIMA): chambua GL kwanza (kusoma tu) — kwa kila manunuzi ya vipimo na kila upunguzaji wa manual
  wa mzazi: journal zake (tarehe, akaunti), na kama true-up ya 30/09 ilifunika upande wa 1200. Kisha pendekeza marekebisho
  (Dr 1000 159,000 / Cr <akaunti sahihi kwa ushahidi>) bila kuandika. Lengo: cash isiwe na malipo ya uongo, na gharama ya kinywaji
  ihesabiwe mara MOJA.
Endelea kujenga KUPIMA (ef) kwenye feature/t2-kupima.

## 2026-11-10 (eh)
(A) MAPEMA, hatua tofauti (83), kabla ya cutover D: Dr 1000 159,000 / Cr 3900, tarehe ya kuandika (Novemba, wazi),
  maelezo "Marekebisho: manunuzi ya vipimo 20/02–17/08 hayakulipwa (Chief 10/11)". KAGUA → 🛑 → ANDIKA; salio 1000/3900 kabla/baada; TB 0;
  inakataa ikiwa journal ya 83 ipo tayari.
(B) inabaki kwenye hatua ya uhamisho ya KUPIMA (toleo 2).
Endelea kujenga KUPIMA (ef).

## 2026-11-10 (ei)
Ujazo: Konyagi, Moon Light, Golden King, Gilbeys, Camino = chupa 750ml. Wine = dumu 5,000ml.
Vipimo/bei vya Golden King, Gilbeys, Camino: Chief atataja kabla ya uhamisho.

## 2026-11-10 (ej)
Wine = dumu 5,000ml; vipimo: 70ml = 2,000 na 80ml = 3,000 (Chief amechagua 80ml; hakuna 90ml).
"Wine 500" ya data ya zamani ni gharama ya kubuni ya kipande, siyo bei.

## 2026-11-10 (ek)
KUPIMA uamuzi wa 1 — BADILISHA: chombo kisipotosha kipimo → mfumo uulize:
  (i) "Tumia ml zilizobaki + fungua kipya" → kipimo kinagawanywa (ml za zamani hadi 0, zilizobaki kutoka kipya); HAKUNA upotevu.
  (ii) "Chombo kimeisha kweli" → ml zilizobaki = upotevu (5100), kisha fungua kipya.
  Hakuna kufunga kiotomatiki. Jaribio la E2E kwa njia zote mbili.
Uamuzi wa 2 — SAWA; ikiwa chombo kimeshafungwa, ml zirudishwe kama marekebisho ya upotevu wa chombo hicho (Dr 1200 / Cr 5100), siyo kupotea.

## 2026-11-10 (el)
Uhamisho wa KUPIMA = KUBADILISHA bidhaa zilizopo (siyo kufuta/kusajili upya), ili historia ya mauzo ibaki.
Hatua ya uhamisho (toleo 2): aina → KUPIMA; mzazi; ujazo + vipimo; (B) futa vipande vya bandia; fungua chombo kwa ml zilizohesabiwa
  (BILA kupunguza mzazi). Andaa sasa (kusoma tu): orodha ya kila bidhaa ya kupima na mzazi wake anayependekezwa kwenye store
  (Konyagi/Moon Light/Golden King/Gilbeys/Camino 750ml; Wine dumu 5L) — yupi hayupo.

## 2026-11-10 (em)
83 IMEKAMILIKA prod: JE-2026-1992140042634199, 1000 = 13,772,864.87, 3900 = −1,214,841.53, TB 0.
Thibitisha maelezo yake kwenye DB (– au mojibake); ikiwa mojibake → hatua zijazo zitumie ASCII "-" tu.
Endelea: KUPIMA (ef + ek + el).

## 2026-11-10 (eo)
Vipimo vimekamilika: Golden King, Gilbeys, Camino = chupa 750ml, 50ml = 3,000.
(Konyagi 30ml=1,000; Moon Light 50ml=2,000; Wine dumu 5,000ml 70ml=2,000 / 80ml=3,000.)
Andaa hatua ya uhamisho ya KUPIMA (toleo 2): mipangilio hii + (B) + kufungua vyombo kwa ml zilizohesabiwa (Chief atahesabu siku hiyo).

## 2026-11-10 (en) — ilipotea, hii hapa
KUPIMA §6: njia YAKO (Dr 5100 / Cr 1200) ni sahihi — mfano wako umethibitisha. Ibaki.
83 imeshaendeshwa prod — usiiorodheshe kama "tayari". 82 ni ya dharura tu.

## 2026-11-10 (ep)
Wazazi: Chief atasajili Gilbeys 750ml, Camino 750ml, Wine dumu 5L; Moon Light → aina ya spirits; Golden King mzazi = (Chief atathibitisha, 64?).
Swali la data (kusoma tu, prod-copy): Gilbeys/Camino/Wine zilinunuliwa vipi bila mzazi — reco "manunuzi", gharama nyingine, au hazikuandikwa?
  Kiasi na tarehe. Hii inaathiri faida ya vinywaji hivi; ripoti tu, usirekebishe.
Kisha kazi 4.

## 2026-11-10 (eq)
Wine mzazi = GREPA WINE (59) → jina "GREPA WINE 5L" (Chief au hatua). Usisajili dumu jipya.
Hatua 85: wazazi kwa ORODHA YA UID wazi (siyo kutafuta kwa jina), KAGUA ionyeshe orodha hiyo kwa Chief kuthibitisha. Badilisha SQL ya 85 hivyo.
Grepa 02/10 (75,000) UNPAID lakini imelipwa droo → ongeza kwenye orodha ya hatua 74 (§9).
Majibu ya Chief (dumu zima, Gilbeys/Camino chanzo, MA-LOT, Golden King 64) yanakuja — usisubiri; endelea na kazi 4.

## 2026-11-10 (es)
KUPIMA — badiliko: bidhaa ya KUPIMA inaweza kuwa na WAZAZI WENGI wanaoruhusiwa (k.m. Wine za kupima ← GREPA WINE 5L, MA-LOT, …).
  "Fungua chombo" → mtumiaji ANACHAGUA mzazi kutoka orodha → mzazi huyo −1; chombo kinakumbuka mzazi wake; gharama ya kipimo = avg ya mzazi
  wa chombo ÷ ujazo × ml. Bei za vipimo ni za bidhaa ya kupima (zilezile kwa wazazi wote). Dumu zima linauzwa kama bidhaa ya kawaida.
  Rekebisha V143/huduma/POS/E2E; hatua 85 iweke orodha ya wazazi.
Mauzo ya dumu zima (8, kutoka KUPIMA-WAZAZI-EP): orodha kwa Chief — tarehe, sale, mteja/deni, cash/mkopo, bei, mtumiaji, deni lililobaki leo.
  Chief ataweka alama "kupima" / "halisi". Kisha hatua 86 (KAGUA → ANDIKA, Novemba): kwa "kupima" — ondoa deni la mteja + mapato
  (Dr 4000 / Cr deni la mteja, na daftari la madeni), COGS ibaki. "Halisi" hazigusiwi. Usiandike kabla ya alama za Chief.

[(et) haijafika kikao hiki - (eu) inaitaja.]

## 2026-11-10 (eu)
KUPIMA bei kwa mzazi: bidhaa ya KUPIMA ina BEI ZA MSINGI {ml, bei}; kila mzazi anayeruhusiwa anaweza kuwa na BEI ZAKE (override, hiari).
  Chombo kinapofunguliwa: kinatumia bei za mzazi wake (au za msingi ikiwa hana). POS inaonyesha bei za chombo kilicho wazi.
  Zote zinawekwa na KUPIMA_SETTINGS tu; historia ya mabadiliko kwa msingi na kwa kila mzazi; zinatumika kwa mauzo yajayo.
  Jaribio: Grepa (msingi) vs MA-LOT (override) — POS na faida ya chombo zinatumia bei sahihi.
Pamoja na (es) na (et).

## 2026-11-11 (er) — ilipotea
Kazi 4: Q4-1 = ndiyo (madeni ya zamani yabaki). Q4-2 = ndiyo (msamaha: tofauti kwanza, kisha gharama).
Q4-3 = ndiyo: tozo ya mali → Dr 1120 / Cr akaunti ya mali kwa NBV (+ kuondoa mali/depreciation), ziada juu ya NBV → 4900 inapolipwa
  au kwa makubaliano tu. Jaribio.
H1: control ya 1120 ilinganishe GL na (sehemu ya gharama + tofauti iliyokubaliwa) ya daftari — siyo bei ya kuuza kamili.
  Jaribio: tozo mpya → H1 SAWA; malipo / makubaliano / msamaha → SAWA.

## 2026-11-11 (et) — ilipotea
KUPIMA faida kwa chombo: chombo kinahifadhi GHARAMA YAKE siku kinapofunguliwa (avg ya mzazi wakati huo); gharama ya kipimo = hiyo ÷ ujazo × ml,
  haibadiliki avg ikibadilika baadaye. Ripoti ya chombo: gharama, mapato, FAIDA, mapato ya juu kabisa, upotevu (ml + TZS), aliyefungua/kufunga.
  Jumla kwa kinywaji na kwa mwezi; kadi ya faida ya wiki. Jaribio: avg ikibadilika baada ya kufungua → gharama ya kipimo haibadiliki.

## 2026-11-11 (ev)
Mauzo 8 ya dumu = (a): hakuna journal, hakuna alama zinazohitajika. Hatua 86 haihitajiki.
Bei za MA-LOT: Chief ataweka kwenye V3 baada ya toleo 2. Kisha kazi 5.

## 2026-11-11 (ew)
Ripoti ya uendeshaji Nov inaonyesha mara mbili: Frame (share ya mwaka 200k + REN-MON Nov 200k) na TRA (share 20,833 + TAX-MON Nov 250k) = +450,000.
GL ni sahihi (hatua 80). Usifute/kubatilisha rows hizo (ingevuruga GL ya 80).
Toleo 2: alama kwenye capex row "exclude_from_ops_report" (sababu + audit, CEO/KUPIMA? → CAPITAL_APPROVE), ripoti ya uendeshaji iiheshimu.
  Hatua ya data (baada ya toleo 2): weka alama kwa REN-MON-20261101-...-5D9DD844 na TAX-MON-20261101-...-B4F8EA66, sababu "zimeshughulikiwa na hatua 80".
  Daraja: mstari "Marekebisho ya 2026 (hatua 80)" ili GL vs ripoti ielezeke.
  Jaribio: ripoti ya Nov = share za mwaka tu kwa Frame/TRA; GL haibadiliki.
Kagua pia: kuna rows nyingine 2026 zenye mwingiliano huo (share ya mwaka + mtoto wa mwezi wa kitu kilekile)? Orodhesha tu.

## 2026-11-11 (ex)
Q-ew1 = CAPITAL_APPROVE, kwa sababu ya lazima + audit + orodha ya "zilizoondolewa kwenye ripoti" inayoonekana kwa wakaguzi.
Q-er1 = ndiyo (mali isiyo kwenye vitabu → GL wakati wa malipo tu).
58b-prod-schedulers-soma.cmd (worktree t2-kupima): onyesha diff, tarehe ya mabadiliko, na kama inahusiana na kazi yoyote yako. Usiigusa.
OPE-MON-20260101-…-2939F6DE: Chief anaendesha 87; ikiwa ni share nyingine ya Frame yenye journal (Cr 1000) — pendekeza marekebisho
  (KAGUA → ANDIKA, Novemba) yanayolingana na 80b. Kisha exclude_from_ops_report, kisha kazi 5.

## 2026-11-11 (ey)
87: OPE-MON-20260101-…-2939F6DE ("2400000", 200,000, Jan) — onyesha journal yake (tarehe, akaunti, POSTED?) na nani/lini aliiunda.
  Chief atasema ni nini. Ikiwa ni Frame mara ya 3 yenye Cr 1000 → andaa marekebisho (KAGUA → ANDIKA, Novemba): Dr 1000 200,000 / Cr <akaunti yake>,
  ili pango 2026 = 2.4M. Usiandike kabla ya jibu.
Septemba: OPE-MON-…-06AC14BB na …-4B6D0F55 (150k kila moja, "wafanyakazi") — journal zao; Chief atathibitisha kama ni nakala.
Kisha exclude_from_ops_report, kisha kazi 5.

## 2026-11-11 (ez)
Chief amethibitisha: OPE-MON-…-2939F6DE ("2400000") = Frame mara ya 2 (30/04) → hatua 88 ANDIKA. Septemba 06AC14BB + 4B6D0F55 = watu wawili, sahihi (haiguswi).
Baada ya 88: pango 2026 = 6000 2.2M (+ 80e 01/12 = 2.4M); 6200 haina pango. Kisha kazi 5.

## 2026-11-11 (fa) — malizia toleo 2
Endelea bila kusimama kati ya kazi (ripoti fupi + jedwali la origin kila moja ikiisha). Mpangilio:
 5. Kanuni za hesabu ya stock (BAADA §2): recount ya mtu wa pili kwa ziada > 50,000; NO_ACTION isijirudie (post au recount);
    swali "kuna mzigo uliofika leo ambao haujaandikwa?"; KUPIMA nje ya hesabu ya kila siku (hesabu ya wiki ya vyombo ipo).
 6. Pesa/GL zilizobaki:
    a. hatua 74 (§9): "Umelipa sasa" iliyopotea + Grepa 02/10 (75,000) → PAID bila journal mpya;
    b. wasambazaji wa mkopo: tathmini ya AP inayokosekana (kusoma tu + pendekezo);
    c. "Deni kwa mmiliki" kwa Jess (akaunti + chanzo C3);
    d. 1010 akiba ya mkopo/pango (§1);
    e. droo kwenye reco (§8) bila kuhesabu mara mbili.
 7. SKU za Jagger (majina yaonyeshe saizi; Chief atataja); ripoti ya uendeshaji itumie avg kwa thamani ya stock.
 8. C4 marejesho ya mauzo.
 9. Usafi: ORODHA-FLUTTER-V3 (Chief achague) → C7 (dead code 26, M1 MV scheduler, docker-compose.aws.yml; Flutter MWISHO)
    → C6 (DROP backup table + view 4) → BAADA §17 (DISPOSED) → Flyway V039/outOfOrder → config (mistari ya takataka) → log ya build UTF-16.
10. Toleo 2 la kutolewa: unganisha matawi yote ya feature/t2-* kwenye release/2.5.0 (backend) na release/3.3.0 (V3); lango kamili
    (suite + PG + c2 + run-all E2E kwenye nakala safi, Flyway 134→145); script ya deploy (kama 76) yenye hatua za data 85 (KUPIMA) na 89 (ripoti)
    baada ya deploy; staging + rollback halisi. Niambie tarehe inayopendekezwa (si wiki ya 14–31/12).
Kipengele kikihitaji Chief: kiweke kando, endelea, orodhesha maswali mwishoni mwa ripoti.
Kosa jipya: liingie tu ikiwa linaandika pesa/stock/data isiyo sahihi kwenye prod.

## 2026-11-11 (fc)
Majibu ya Chief (6a/6b):
 - Wasambazaji wote wanalipwa SIKU HIYO HIYO kupitia NMB (cash ya mauzo → amana NMB → kesho yake malipo). Cash ya droo mara chache sana. HAKUNA mkopo wa wasambazaji.
 - "Vyote ni vya bwana" (12.56M) = pesa ya BIASHARA (siyo 2300).
 - Manunuzi 17 UNPAID (≈0.7M) = yalilipwa siku hiyo hiyo → hatua 74: PAID bila journal mpya (pamoja na Grepa 02/10).
 Hitimisho: kabla ya cutover, Cr 1000 ya manunuzi ni sahihi (NMB ni sehemu ya 1000). Hakuna marekebisho ya GL kwa 6b. Andika hivyo kwenye AP-WASAMBAZAJI-6B.
KABLA YA CUTOVER D (kipaumbele): thibitisha (code + jaribio kwenye nakala, D ikiwa imewekwa):
 - reco BANK_DEPOSIT → Dr 102x NMB / Cr 1000 (uhamisho), MOBILE (M-Pesa/Tigo/…) → Dr 103x / Cr 4000/1000 sahihi;
 - malipo ya msambazaji "Benki · NMB" baada ya D → Cr 102x NMB.
 Kama hakuna → ni kosa la pesa (kanuni ya ct-2) → ingiza toleo 2 au hatua ya data. Ripoti kabla ya kuchagua tarehe ya D.
6e: kwa kuwa droo hulipa mara chache, mstari wa auto wa droo kwenye reco (manunuzi chanzo DROO) — endelea na muundo; Q6d/Q6e nitakuletea majibu.

## 2026-11-11 (fd)
Qfc-1: D = Jumatatu ya kwanza baada ya toleo 2 prod. Lengo: toleo 2 prod mwisho wa Nov → D 30/11 au 07/12.
  Toleo 2 likichelewa kupita 07/12 → toleo + D Januari (04/01). Cutover D ni sehemu ya mpango wa kutoa toleo 2 (kazi 10).
  Kadiria sasa: siku za kazi zilizobaki (C4, 6d/6e, Jagger, usafi, release, staging) → tarehe halisi inayowezekana.
Qfc-2: Chief atasema kama Selcom ni benki au huduma ya malipo.
Hatua 60 (ufunguzi) isasishwe: salio halisi la NMB/Selcom/M-Pesa/Tigo (Dr 102x/103x / Cr 1000), droo halisi, bahasha; 1030 ya kabla ya D
  (163,000) iwekwe kwenye salio halisi, si kuongezwa. TB 0; tofauti yoyote → mstari wazi "tofauti ya ufunguzi" kwa uamuzi wa Chief.

## 2026-11-11 (fe)
Selcom = BENKI (1023). Mtiririko: amana Selcom/NMB/M-Pesa/Tigo → ZOTE zinahamishiwa NMB → NMB inalipa wasambazaji.
Baada ya D lazima kuwe na njia rahisi ya kuandika uhamisho: chanzo (1023/103x) → NMB (1021), kiasi, ADA (gharama ya benki/simu), tarehe.
  Kagua kitufe "Transfer" cha GL kama kinatosha (ruhusa, ada, sababu, audit); kama hakitoshi → toleo 2.
  Jaribio: amana Selcom 500k → uhamisho kwenda NMB 500k ada 2k → 1023 = 0, 1021 = 498k, gharama ya benki 2k, TB 0.
Toleo 2 (au BAADA, niambie makadirio): ulinganisho wa benki wa mwezi — salio la 1021/1023/103x dhidi ya salio la taarifa (Chief anaingiza),
  tofauti inaonyeshwa (H1-style, bila kizingiti).
Hatua 60: salio la ufunguzi la 1023 = salio halisi la Selcom siku ya D.

## 2026-11-12 (ff)
Ndiyo, endelea — mpangilio: 4 → 3 → 2 → 1 → 5.
 4 kwanza: makadirio ya siku za kazi zilizobaki kwa toleo 2 (C4, 6d/6e, Jagger, usafi wa 9, release + lango + staging + rollback, hatua 60)
   → tarehe halisi ya prod, na D (30/11, 07/12, au Januari 04/01).
Utaratibu: ripoti kwa Kiswahili, ianze "nimesoma hadi (herufi)", na imalizike na jedwali la origin (matawi yote ya t2-*, ikiwemo t2-cutover, t2-hesabu).
Baada ya 1–5: endelea na (fa) iliyobaki — C4, 6d/6e, usafi wa 9, kazi 10.

## 2026-11-12 (fg)
Qff-1 = NDIYO: toleo 2 prod Jumatano 02/12; D Jumatatu 07/12; 6d (1010), §14, §16, ulinganisho wa benki → BAADA.
Qff-2 = akaunti ya muda "Tofauti ya ufunguzi" (siyo 1000, siyo 3900 moja kwa moja). Siku 30: chambua; kinachoelezeka → mahali sahihi;
  kisichoelezeka → 3900 kwa uamuzi wa CEO + taarifa kwa Executive CEO. Hatua 60 iandike hivyo; jaribio.
Qff-3 = Chief atajibu (orodha ya akaunti zinazotumika).
04/12: Loan A awamu 2 italipwa kwenye app (kabla ya D, Cr 1000) — hakuna kazi.
Endelea C4 → 6e → Jagger → usafi 9 → kazi 10.

## 2026-11-12 (fi)
Kanuni mpya: KABLA ya kuuliza Chief swali lolote — thibitisha kwa data (prod kusoma tu, git ls-remote, MAAGIZO).
Swali lililojibiwa au kazi iliyofanyika halirudiwi.
Majibu yaliyokwisha tolewa (usiulize tena):
 - Akaunti za pesa zinazotumika: NMB (1021), Selcom (1023), M-Pesa, Tigo — nyingine zote zizimwe kabla ya D.
 - Jagger: Chief amebadilisha majina mwenyewe kwenye V3 — thibitisha kwenye prod (kusoma tu) na funga kipengele.
 - Push: Chief ameshapush — thibitisha kwa git ls-remote.
KAZI SASA — ukaguzi wa mwisho wa toleo 2 (MUHTASARI-TOLEO2.md), jedwali moja:
 kila kipengele (G1–G5, kazi 2–5, 6a/6c/6e, KUPIMA, tozo, ripoti/exclude, H1, cutover/uhamisho, C4, usafi 9) →
 tawi, commit, majaribio (namba), hali (IMEKAMILIKA / BADO / BAADA), na hatua za data za baada ya deploy (74, 85, 89, 60).
 Vilivyobaki "BADO": vimalize kwanza.
 Kisha: unganisha t2-* zote → release/2.5.0 (backend) na release/3.3.0 (V3); lango kamili kwenye nakala safi
 (suite + PG + c2 + run-all E2E, Flyway 134→150); script ya deploy (kama 76) + rollback; staging; prod 02/12.
Ripoti ifuate muundo: nimesoma hadi (fi) → muhtasari → jedwali la origin.

## 2026-11-12 (fj)
Sahihisho la (fi): Chief — NJIA ZOTE ZA MALIPO ZIBAKI WAZI (benki zote, mitandao yote). Usizime akaunti yoyote.
Sababu: msambazaji anaweza kudai kulipwa kupitia CRDB n.k.; mtumiaji anachagua chanzo halisi.
Kinga badala ya kuzima:
 1. Hatua 60: kila akaunti ya benki/simu iliyo wazi inapata salio la ufunguzi (0 ikiwa haitumiki) — ripoti inaorodhesha zote.
 2. Orodha ya chanzo (C3, reco, Transfer): zinazotumika zaidi siku 30 juu (NMB, Selcom, M-Pesa, Tigo kwa sasa).
 3. Akaunti isiyotumika > siku 60: dialog ya uthibitisho "haijatumika tangu <tarehe> — una uhakika?".
 4. Ukurasa rahisi wa "Salio kwa akaunti" (mwisho wa mwezi) kwa Chief kulinganisha kwa macho na taarifa — ikiwa ≤ nusu siku; vinginevyo BAADA.
Endelea na MUHTASARI-TOLEO2 (fi).

## 2026-11-12 (fk)
Yaliyokwisha amuliwa — usiorodheshe kama "yanasubiri":
 M1 = (b) (dx): ondoa MaterializedViewScheduler (C7) + DROP view 4 (C6).
 F1 = "Babuu Liquor Store" (eg).
 Q6e-1 = RECO YA DROO ya siku ya malipo, SIYO aliyerekodi (fh). Q6e-2 = kuanzia deploy (02/12). Q6e-3 = chanzo halisi (Takawedo NMB; Pepsi/Coca pale pale DROO).
 V039 repair = BAADA (haiguswi toleo 2).
 C6 B2 = ndiyo: andaa hatua (KAGUA → ANDIKA) ya kuhifadhi backup_20260930_journal_entry kwenye B2 (sha256) kisha DROP — baada ya deploy.
SASA (kabla ya 6e): thibitisha sale yenye malipo "Benki · NMB" baada ya D inaandika Dr 1021 (na M-Pesa → 103x) kwenye journal ya sale.
 Jaribio la E2E lenye D imewekwa, nakala safi, image ya clean build. Ikiwa haiandiki → kosa la pesa, rekebisha.
Kisha 6e (kwa majibu hapo juu), usafi 9, kazi 10.

## 2026-11-12 (fl)
V151 (check ya payment method): hakuna hotfix — inaingia toleo 2 (02/12). Mpaka hapo:
 Andika mwongozo mfupi kwa Macheda (Kiswahili, analysis/): njia 8 zinazokubalika LEO kwenye prod, na kwa kila njia isiyokubalika
 (Selcom, PCB, Airtel, BANK_TRANSFER/MOBILE_MONEY kwa madeni) achague ipi badala yake ili reco ibaki sahihi (siyo Taslimu ikiwa pesa haikuingia droo).
Kusoma tu (prod, ndani ya hatua 91 au 92): sale/madeni tangu 01/10 yaliyolipwa kwa njia ambayo huenda ilibadilishwa — ishara: reco yenye upungufu
 + amana ya Selcom siku hiyo. Ripoti tu.
Kisha 6e, usafi 9, kazi 10.

## 2026-11-12 (fn)
Jagger: saizi ZIPO kwenye sehemu ya ujazo (350, 750ml, 1LT, 200ml) — ukaguzi wa 91 uliangalia jina tu. FUNGA kipengele cha Jagger.
  Rekebisha 91 (na ukaguzi wowote wa saizi) usome sehemu ya ujazo, si jina.
Taarifa kwa Chief tu: 886dc1ed (1LT) imerudi "6 pcs/pkg, 330,000" tarehe 03/11 baada ya hatua 63 — Chief ataamua.
Kategoria za Jagger hazilingani (VODKA/Beer/WISKY) — Chief atazirekebisha; usiguse.
Kisha 6e, usafi 9, kazi 10.

## 2026-11-12 (fo)
Jagger 1LT/750ml: "6 pcs/pkg" ni SAHIHI (box = 6; wananunua kwa kipande). Usiguse. Kinga ni onyo la manunuzi. Kipengele kimefungwa.

## 2026-11-12 (fq)
91-5 (fl): HAKUNA athari — CHECK_ILIKATAA 0; POS inaandika karibu yote CASH (693/701), simu/benki zinaingia kupitia reco.
  Upungufu wa siku za Selcom (2,500–9,500) ni wa kawaida, si wa njia ya malipo. Funga (fl).
  Mwongozo wa Macheda: ongeza kwamba utaratibu wa sasa (POS = CASH, simu/benki kwenye reco) unaendelea kufanya kazi baada ya D.
Thibitisha kwenye jaribio la cutover: siku yenye POS yote CASH + reco ya simu/benki → Dr 102x/103x / Cr 1000 kwa kiasi cha reco tu (hakuna mara mbili).
Endelea na 6e.

## 2026-11-12 (fr)
Uthabiti: mwongozo §5 ("ukichagua simu kwenye POS, usiiandike tena kwenye reco") dhidi ya muundo wa (fc)
  ("uhamisho wa simu = reco ya simu − sehemu ya mauzo ya POS iliyolipwa kwa simu"). Zote mbili zikitumika → M-Pesa inapungua mara mbili.
  Jaribio T11: sale 10,000 POS=M-Pesa + reco ya simu 0 (kama mwongozo) → 1030 lazima iwe +10,000 tu (kutoka sale), uhamisho 0.
  Na T12: sale 10,000 POS=M-Pesa + reco ya simu 10,000 → 1030 +10,000 tu (siyo 20,000).
  Rekebisha muundo AU mwongozo ili Macheda awe na KANUNI MOJA rahisi. Ripoti matokeo ya T11/T12.
Kisha 6e.

## 2026-11-12 (fs)
(fr) SAWA. Mwongozo wa Macheda: kanuni iseme wazi "jumla ya SIKU kwa kila mtandao/benki, kama inavyoonekana kwenye simu / taarifa
  (ikiwemo malipo ya POS na madeni)" — siyo sehemu. Ongeza mfano mmoja wa namba.
Kisha 6e.

## 2026-11-12 (fu)
FUTA (ft) kama uliipokea — ilikosea. Kanuni sahihi (Chief):
Reco ya muuzaji = pesa WATEJA walilipa LEO kwa kila njia (sale/deni), kama alivyopokea.
  Mf: NMB 200,000 · lipa namba 30,000 · Selcom 10,000 · CRDB 30,000 · Taslimu = iliyokabidhiwa.
  SI salio wala taarifa ya benki. Muuzaji HAANDIKI: uhamisho kati ya akaunti, cash→benki, mikopo, pesa ya mmiliki.
Mwongozo §njia: andika hivyo + mfano huo. Ongeza: CEO/mnunuzi anahakiki kwa mkono fedha zipo kabla ya kuidhinisha;
  manunuzi yanaandikwa chanzo halisi (benki X / lipa namba / cash).
Hakiki kwa data (usimuulize Chief): "lipa namba" inaenda akaunti gani ya GL? Ripoti.
Pengo baada ya D: uhamisho wa nje ya mfumo (Selcom→NMB, droo→NMB) hauonekani GL → 1023 inapanda, 1021 inashuka/hasi.
  Jaribio staging (D imewekwa): reco Selcom 10,000 + nunua NMB 50,000 bila Transfer → onyesha salio 1021/1023;
  kisha na Transfer Selcom→NMB → salio sahihi. Ongeza §CEO kwenye mwongozo: "kila uhamisho halisi baada ya D = Transfer ya GL".
Kisha 6e.

## 2026-11-12 (fv)
Data yako ya amana 132 (cash ya mauzo) inabadilisha (fu). Mwongozo:
  Muuzaji, mstari wa benki = wateja waliolipa moja kwa moja benki LEO + cash YEYE aliyoipeleka benki LEO.
  USIBADILISHE tabia ya Macheda baada ya D — reco amana = Dr 102x / Cr 1000 ni sahihi na mara moja.
Kanuni: kila pesa droo→benki inaandikwa MARA MOJA na aliyeipeleka (Macheda → reco; sefu → amana ya sefu).
  Transfer ya CEO = TU harakati ambazo hakuna aliyeziandika: Selcom→NMB, lipa namba (1030)→benki, CRDB→NMB n.k.
  Ondoa "kazi inahamia kwa CEO kupitia Transfer 1000→1021".
Kinga (ndogo, onyo si kizuizi): CEO akiunda Transfer 1000→102x yenye kiasi sawa na amana ya reco/sefu ya siku
  hiyo hiyo kwa akaunti ile ile → onyo "Huenda imeshaandikwa kwenye reco ya [tarehe]". Jaribio: onyo linaonekana;
  Transfer 1023→1021 haipati onyo.
Staging rerun ya pengo_d: HAPANA (kazi 10 inatosha).
Kisha 6e.

## 2026-11-12 (fw)
Chief: lipa namba (1030) huhamishwa KWA MKONO kwenda benki mbalimbali → kila uhamisho = Transfer 1030→102x na CEO,
  siku ile ile; kiasi = kilichotoka 1030, makato → 6130 (mf: 100,000 → NMB 98,500 + 6130 1,500). Weka mfano huu kwenye §CEO.
Hakiki Transfer ya GL inaruhusu chanzo 1030 + makato (jaribio: salio 1030 linashuka 100,000, 1021 +98,500, 6130 +1,500).
§CEO ongeza: ukaguzi wa wiki — salio GL 1030/1021/1023 vs salio halisi (simu/benki); tofauti → Transfer iliyosahaulika.
Kisha 6e.

## 2026-11-12 (fx)
1. Endesha suite KAMILI ya backend kwenye 1fe2ee7 (mwisho ilikuwa 674/0/1 kwenye 6f987e8). Ripoti idadi.
2. Onyo la Transfer: dirisha = tarehe ya Transfer ±1 siku (Macheda hupeleka cash ya jana asubuhi). Jaribio: amana
   reco ya jana 300,000 + Transfer leo 1000→1021 300,000 → onyo; siku 2 nyuma → hakuna onyo.
3. Kisha 6e. Lengo: 6e + usafishaji 9 viishe ~20/11 ili kazi 10 ipate siku 3–4 kabla ya 25/11.

## 2026-11-12 (fy)
Vigezo vya kukubali 6e (weka majaribio haya kabla ya ripoti):
1. Kwanza hakiki kwa data: leo malipo ya supplier kutoka droo (Pepsi/Coca) yanaonekanaje kwenye reco — gharama
   iliyoandikwa, makato ya cash, au hayaonekani? Ripoti mifano 3 halisi. Mstari wa AUTO usirudie kilichopo.
2. Manunuzi yaliyolipwa Taslimu siku X → mstari 1 wa AUTO kwenye reco ya droo ya siku X; GL Cr 1000 mara MOJA.
3. Manunuzi yaliyolipwa NMB/Selcom/lipa namba → HAYAGUSI reco ya droo; Cr 102x/1030 tu.
4. Macheda akiandika pia malipo hayo kwa mkono → onyo (si kizuizi), kama Transfer.
5. Inaanza 02/12 tu: reco za kabla ya 02/12 hazibadiliki (jaribio kwenye nakala safi: jumla ya reco zote za zamani sawa kabla/baada).
6. Manunuzi yakibadilishwa chanzo (Taslimu → NMB) baada ya reco kuidhinishwa → nini kinatokea? Eleza na ujaribu.
Kisha usafi 9.

## 2026-11-12 (fz)
BADILISHA (fy): Chief — reco tayari ina sehemu ya purchase; Macheda huandika malipo ya droo hapo. USIJENGE mstari wa AUTO.
Hakiki kwa data (ripoti kabla ya kujenga chochote):
1. Sehemu ya purchase ya reco: inaandika GL? (Cr 1000 / Dr nini?) Imeunganishwa na purchase_id au ni kiasi huru?
2. Moduli ya manunuzi PAID Taslimu: inaandika GL? Kwa siku 3 halisi zenye Pepsi/Coca kutoka droo, onyesha journal
   zote za malipo hayo — ni moja au mbili?
3. Kama ni MBILI: kiasi cha jumla tangu 06/2026 + je kinahusiana na 2900 (−742,500)? Hili ni kosa la pesa → batch.
4. Kama ni MOJA: 6e = onyo tu — jumla purchase ya reco siku X ≠ manunuzi Taslimu siku X → "Linganisha manunuzi".
   Inaanza 02/12; reco za zamani hazibadiliki.
Vigezo 3 (NMB/Selcom/lipa namba haziguse reco ya droo) na 6 (kubadilisha chanzo baada ya reco kuidhinishwa) vinabaki.

## 2026-11-12 (ga)
BADILISHA (fy)/(fz). Chief: sehemu ya purchase ya reco = USHAHIDI TU, haiandiki GL. GL inaandikwa na mnunuzi
kwenye moduli ya manunuzi (Taslimu → Cr 1000) mara moja. Hakiki kwa kusoma code kwamba reco-purchase haiandiki
journal yoyote; ripoti mstari 1.
6e = ONYO TU (hakuna mstari wa AUTO, hakuna GL mpya):
  Jumla purchase ya reco siku X vs manunuzi yaliyolipwa Taslimu siku X±1. Tofauti → onyo kwa CEO/mnunuzi:
  "Reco ya [tarehe] inaonyesha manunuzi ya droo [kiasi]; yaliyoandikwa [kiasi]". Inaanza 02/12.
Jaribio: reco Pepsi 200,000 bila manunuzi → onyo; manunuzi Taslimu 200,000 kesho → onyo linaondoka;
  manunuzi NMB 200,000 → onyo linabaki (chanzo si droo).
Kisha usafi 9.

## 2026-11-12 (gb)
6e: imekubaliwa.
1. KOSA LA PESA (batch): baada ya D, manunuzi BILA msambazaji yaliyolipwa NMB/Selcom/lipa namba → akaunti gani?
   Kama PostingEngine inaandika Cr 1000 bila kujali chanzo → rekebisha: chanzo kilichochaguliwa ndicho kinapewa Cr
   (1000/102x/103x). Chanzo kiwe LAZIMA kwenye manunuzi yasiyo na msambazaji kuanzia 02/12.
   Jaribio (D imewekwa): bila msambazaji + NMB 500,000 → Cr 1021; + Taslimu → Cr 1000; bila chanzo → kukataliwa.
2. Manunuzi 307 UNPAID (37.6M): Chief alishajibu (6b) — yalilipwa siku ile ile. Panua hatua 74 (au hatua mpya):
   yote yasiyo na msambazaji + UNPAID hadi leo → PAID, BILA journal. KAGUA: idadi, jumla, tarehe ya kwanza/mwisho,
   na kama yapo baada ya 28/10. 🛑 kabla ya ANDIKA.
3. Hakiki: Takawedo na Pepsi zipo kama wasambazaji waliosajiliwa? Ripoti tu, usisajili.
Kisha usafi 9.

## 2026-11-12 (gc)
(gb) imekubaliwa: kipengele 1 sawa, 74b sawa.
1. Eleza V3 9ec5bd9 kwenye t2-cutover (mbele 8 → 9) — mafaili gani, kwa nini, jaribio gani. Kama ni la bahati mbaya, ripoti; usirudishe nyuma bila mimi.
2. Wasambazaji marudio (Takawedo ×3, Serengeti ×3) + manunuzi 241 ya jina tu: ANDIKA kwenye MUHTASARI kama
   "Desemba, baada ya D" — usijenge sasa.
Kisha usafi 9.

## 2026-11-12 (gd)
(gc) imekubaliwa. Usafi 9 — vigezo:
1. GAWANYA: 2.5.0 = ondoa scheduler (M1) TU. View 4 + backup table ya C6 HAZIFUTWI kwenye 2.5.0.
   DROP iwe migration/hatua tofauti, "siku 7 baada ya prod 02/12 bila rollback" (~09/12), na C6 baada ya kuthibitisha
   dump ya B2 ina backup table. Weka kwenye MUHTASARI.
2. Jaribio la rollback: DB yenye migrations zote za 2.5.0 → endesha image 2.4.0 → inawaka, scheduler ya zamani
   inafanya REFRESH bila kosa, Flyway haikatai (migrations za mbele). Ripoti log.
3. F1 footer, config junk, C9 ssh -n, UTF-16 log: kila moja na ushahidi mfupi (diff/log).
4. Suite kamili ya backend + ng mwisho wa usafi 9.
Kisha kazi 10.

## 2026-11-12 (ge)
Usafi 9 umekubaliwa. Kazi 10 — vigezo vya lango:
1. Lango kwenye DUMP YA PROD YA KARIBUNI (B2, Flyway 138), si 29/10 peke yake. Kabla ya migrate: hesabu thamani zote
   za payment_method kwenye data mpya (tangu 29/10) dhidi ya check ya V151 — ripoti yoyote isiyokubalika.
   Kisha migrate 138 → 151 + majaribio yote (cutover, malipo_d, pengo_d, manunuzi_*, marejesho, uhamisho_onyo, ng).
   Kumbuka: dump ni ya kusoma tu kwenye kompyuta yako; usiguse prod.
2. Flyway: orodhesha V139–V151 baada ya kuunganisha — namba za kipekee, hakuna pengo/mgongano kati ya matawi.
3. Rollback kwa KUANDIKA: 2.4.0 juu ya schema 151 → sale mpya (Taslimu), reco moja hadi kuidhinishwa, manunuzi moja,
   malipo ya deni. Zote zinaandikwa bila kosa. Orodhesha column za NOT NULL zilizoongezwa V139–V151 na default zake.
4. Kisha script ya deploy + staging.

## 2026-11-12 (gg)
BADILISHA (gf) kipengele 2 — uamuzi wa Chief: code zote → main → staging kutoka main → prod.
1. KABLA ya kuunganisha main: thibitisha tag v2.4.0 = 9b6678a (backend) na v3.2.0 = commit ya prod (V3) zipo
   na zimepushwa; kama hazipo, ziunde (push ni ya Chief). Hotfix yoyote kabla ya 02/12 = hotfix/* kutoka tag hizo.
2. Kipengele 1 cha (gf) kinabaki: is-ancestor kwa KILA feature/t2-* dhidi ya main iliyounganishwa (repo zote mbili).
3. 93-deploy-250: ijenge kwa commit/tag iliyotajwa (iandikwe kwenye log), si "main ya sasa". Baada ya prod: tag v2.5.0/v3.3.0.
4. Lango (ruhusa imetolewa, kama (gf) 3) liendeshwe kwenye main iliyounganishwa, dump mpya ya 92.
5. (gf) 4 kinabaki (A6 ina jaribio lake).

## 2026-11-12 (gh)
Uamuzi wa mwisho wa Chief: main ndiyo chanzo pekee — local → main → staging → production. Hakuna release/* ya kudumu;
release/2.5.0 na release/3.3.0 ziunganishwe main kisha zisitumike tena. Fuata (gg) 1–5.
(Kumbuka ya Claude: maandishi ya (gf) yenyewe hayakunifikia; nimefuata (gg)/(gh) kama yalivyoandikwa.)

## 2026-11-12 (gi)
(gf) 4 maana yake: baada ya kuhamisha majaribio kwa muuzaji wa E2E, ONYESHA jaribio linalothibitisha kinga A6
  (reco IMEIDHINISHWA → kubadilisha sale ya siku hiyo kunakataliwa). Jina la jaribio + matokeo. Kama halipo, liongeze.
Matawi: futa release/2.5.0 na release/3.3.0 (local) sasa. feature/t2-* ZISIFUTWE hadi baada ya prod 02/12 (~09/12);
  weka kwenye MUHTASARI. Tag hazifutwi kamwe.
Push ya main: baada ya lango kupita.
Lango: endelea Chief akishafunga PID na 92 kukamilika.

## 2026-11-12 (gk)
BADILISHA (gj) kipengele 1 — Chief: njia ipo (CEO anafungua reco upya → marekebisho → kuidhinisha tena). Usichunguze.
Ongeza A8 tu kwenye a6_api_e2e: CEO afungua reco iliyoidhinishwa (kwa sababu) → badiliko la sale linaruhusiwa →
  audit imeandikwa → idhinisha tena → TB=0, GL ya siku sawa na badiliko. Muuzaji hawezi kufungua (kukataliwa).
release/2.4.0 / 3.2.0 na image ya main: kama (gj).
(Kumbuka ya Claude: maandishi ya (gj) hayakunifikia.)

## 2026-11-12 (gl)
Uamuzi A8e: badiliko/ufutaji wa sale ndani ya reco ILIYOFUNGULIWA UPYA → reversal/journal mpya kwa TAREHE YA SALE
  (siku ya reco), ikiwa mwezi wake uko wazi; mwezi umefungwa → siku ya kwanza iliyo wazi (tabia ya sasa).
  WIGO: njia hiyo tu. Reversal nyingine (marejesho, manunuzi, n.k.) hazibadiliki.
  A8e iwe PASS/FAIL: GL ya 10/11 = reco ya 10/11 baada ya kuidhinisha tena; 12/11 haina mstari wowote.
  Jaribio la unit: mwezi uliofungwa → siku ya kwanza iliyo wazi.
(gj) — maandishi yake:
  1. release/2.4.0 na release/3.2.0: futa (local + origin ni ya Chief) kama SHA = tag v2.4.0/v3.2.0; vinginevyo ripoti tofauti.
  2. Lango liendeshwe kwenye image ya commit za main zilizotajwa (3b6bf61 + V3 ya mwisho), si image nyingine.

## 2026-11-12 (gm)
92 pakua: ssh/orodha sawa (dump 11/11 + 12/11, sha256 zimeonyeshwa), lakini scp lsms_20261111_0200.dump ilishindwa
  baada ya dakika 19 (MB 9.8). Soma log kamili ya 92 na script: scp inatumia key/chaguo zile zile za ssh (-i, BatchMode=yes,
  ConnectTimeout)? Njia lengwa yenye nafasi ("MY PROJECT") imenukuliwa? Rekebisha ili ikwame → ishindwe ndani ya sekunde 30,
  si dakika 19. Usiguse server zaidi ya kusoma.

## 2026-11-12 (gn)
92 imekubaliwa. 1. Backend main 3b6bf61 → e1b1a53: commit zipi, mafaili gani, kwa nini? Kama ni (gl): ripoti A8e PASS/FAIL, unit ya
   mwezi uliofungwa, na wigo. 2. (gj): release/2.4.0 / 3.2.0 — SHA = tag? Imefutwa local? 3. Kasi ~4 KB/s: 93 build/push inapakia
   kiasi gani (MB backend + V3)? Je, 93 ina kuendelea/kurudia push ikikatika?

## 2026-11-12 (go)
92_OK: lsms_20261112_0200.dump (sha 00a19c8a…2947) na 20261111 (676df065…2356) ziko backups\, sha = server.
Lango sasa (ruhusa imetolewa), kwenye dump ya 12/11: 1. RAM huru, container zote zimefungwa. 2. Suite peke yake kwenye backend main.
  3. Build image za commit za main; LANGO_RUKA_SUITE=1 lango.sh <dump 12/11>. 4. Ripoti: payment_method dhidi ya V151, Flyway 138→151,
  awamu A, B, rollback — zote, pamoja na A8e. Usihariri lango.sh likiendeshwa. Kabla ya lango, jibu (gn) 1–3 kwa ufupi.


## 2026-11-12 (gp)
Lango likiisha (A, B, rollback), chunguza makosa 7 kwa mpangilio huu:
1. KWANZA cutover_api T13/T14 — inahusu pesa. Thibitisha kwa data: code au jaribio? Kama ni code → simama, ripoti kabla ya kurekebisha.
2. Mengine: kila jaribio linalotegemea data ya 29/10 lijitengenezee data yake (kama A6 na muuzaji wa E2E).
   MARUFUKU kulegeza/kuondoa assertion bila kuiorodhesha kwenye ripoti (jaribio | assertion | kwa nini).
3. Jedwali la mwisho: jaribio | sababu (code/data) | ushahidi | rekebisho. Kisha lango zima tena kwenye dump 12/11.
4. version.json ya V3 inaonyesha 3.0.0: build ya 3.3.0 inaandika version sahihi? Kuna kitu kinasoma version.json
   (taarifa ya toleo jipya / cache)? Rekebisha kama haiandiki.
5. Dockerfile: COPY --chown=lsms:lsms badala ya RUN chown (Chief amekubali). Jaribio: container inawaka kama lsms,
   inaandika log; ukubwa wa layer mpya ripoti.
6. release/2.4.0 na release/3.2.0: futa local (origin ni ya Chief kupitia push-yote/amri utakayoniandikia).
(Kumbuka ya Claude: (gp) ilinifikia 13/11 pamoja na (gq).)

## 2026-11-13 (gq)
Lango: uchambuzi wa makosa 7 umekubaliwa. Kabla ya kuendelea: (gp) ilikufikia? Kama hapana, vipengele vyake vimo humu.
1. Rekebisha majaribio 6 kwa kanuni moja: data ya jaribio inajitengeneza kutokana na hali ya DB — tarehe HURU
   zinachaguliwa BAADA ya kuhesabu mali ya mwisho (soma tarehe hiyo kwa query, usiibandike), muuzaji wa E2E,
   mali/role za jaribio zinaundwa na jaribio lenyewe. Hakuna tarehe za kudumu ndani ya code ya jaribio.
2. ops: token tupu = FAIL ya wazi, KAMWE si fallback kwenda token ya CEO — fallback hiyo ilificha ukaguzi wa ruhusa.
   Role ya printer: jaribio liunde role/user wake wa muda au liruke kwa ujumbe wa SKIP unaoonekana, si kupita kimya.
3. MARUFUKU kulegeza/kuondoa assertion bila kuiorodhesha: jaribio | assertion | kwa nini. cutover T11–T14 zibaki
   zinapima kanuni ya max na sehemu ya POS kwenye benki — zihamishe tarehe, si vipimo.
4. Kisha lango ZIMA tena kwenye nakala safi ya dump ya 12/11, ikiwemo A8e. Jedwali: jaribio | chanzo | rekebisho | matokeo.
5. (gp)4: version.json ya V3 inaonyesha 3.0.0 — build ya 3.3.0 inaandika version sahihi? Kuna kinachoisoma (cache/taarifa ya toleo)? Rekebisha.
6. (gp)5: Dockerfile COPY --chown=lsms:lsms badala ya RUN chown (nimekubali). Jaribio: container inawaka kama lsms, inaandika log; ripoti ukubwa wa layer.
7. (gp)6: futa release/2.4.0 na release/3.2.0 local (SHA zinatofautiana na tag kwa version/gitignore tu — hakuna code inayopotea).

## 2026-11-13 (gr)
(gq) imekubaliwa.
1. lango.sh — kinga ya RAM mwanzoni: RAM huru < 3 GB → simama mara moja na ujumbe "funga programu; huru X GB".
   (Hariri KABLA ya kuendesha, si wakati linaendesha.)
2. Ruhusa: endesha lango ZIMA tena kwenye nakala safi ya dump 12/11 (backend 7c9ce11, V3 a1caafc), PAMOJA na ng test.
   Lango limepita = awamu zote + A8e + b1/sababu + kupima_e2e ndani ya lango + ng 104/104.
3. MUHTASARI (Desemba, usijenge sasa): tarehe zilizobandikwa (manunuzi_onyo, b3/b4, akaunti CRDB 24/08, kupima_api);
   tozo kuunda mali yake kupitia manunuzi ya Capital; cache ya sekunde 60 ya kinga ya kuhesabu;
   worktree za feature/t2-* — ondoa kiungo cha node_modules kabla ya kuzifuta ~09/12.
4. Lango likipita: ripoti fupi + amri ya 93 (build 7c9ce11 a1caafc). Push ni ya Chief.

## 2026-11-13 (gs)
LANGO_OK imekubaliwa.
1. Ushahidi kabla ya build: git diff --stat 7c9ce11 a86fbcf — faili zote ziwe deploy/local/ tu. Ripoti matokeo.
2. Lango la zamani: muda (timestamp) wa kuliua vs muda wa restore ya nakala mpya — kuliua kulikuwa KABLA ya restore? Ripoti mistari ya log.
3. MUHTASARI: baada ya staging kupita → main IMEFUNGWA hadi 02/12 (code ya app); badiliko lolote = lango + staging upya. Hotfix = kutoka tag.
4. Andaa orodha ya staging (93): refresh-db → deploy → kazi → rollback → deploy, na nini cha kusoma kwenye kila log (K1–K6, smoke, Flyway 151, D HAIJAWEKWA).

## 2026-11-13 (gt)
(gs) imekubaliwa. Kabla ya hatua 2 ya staging (deploy 2.5.0 juu ya data ya prod):
1. Orodhesha kila kitu kinachotuma NJE kwenye 2.5.0: arifa ya mauzo ya kila siku (Macheda), SMS/WhatsApp/email,
   scheduler zozote, webhooks. Kwa kila kimoja: staging inakizuia vipi (env/config)? Thibitisha kwa .env ya staging
   (kusoma tu, ficha siri).
2. Kama chochote hakijazuiwa → ongeza kwenye K4/K6 ya staging: "ARIFA_ZIMEZIMWA" au simama. Staging isimtumie
   Macheda wala mtu yeyote ujumbe halisi.
3. Ongeza mstari huo kwenye ORODHA-STAGING-93.md hatua 2.

## 2026-11-13 (gu)
(gt) imekubaliwa.
KABLA ya push-yote: ce77a9f ina 92-pakua.log na push-yote.log. Kagua log zote za analysis/ zilizo kwenye commit
ambazo hazijapushwa: token, password, ghp_/github_pat_, https://<kitu>@, Bearer, funguo za .env, IP + user wa SSH.
Tumia pia kinga ya hash prefix ya hatua 73. Ripoti: faili | imesafishwa? Ikiwa kuna siri: ondoa kwenye historia ya
commit ambazo HAZIJAPUSHWA (amend/rebase ya local), na ongeza *.log ya steps kwenye .gitignore au ficha.awk kabla
ya kuandika. Usipushe — niambie.

## 2026-11-13 (gv)
Staging deploy: K1–K6 SAWA, DEPLOY_OK 2.5.0+3.3.0, Flyway 151, D HAIJAWEKWA, .prev 2.4.0/3.2.0.
Swali (soma code/config, ripoti tu): defaults za jar kwa
  APP_FEATURES_SALES_RETURNS_ENABLED na LSMS_PURCHASE_CHECK_FROM (lsms.purchase-check.from) — thamani gani?
  Prod 02/12 bila kuziweka → marejesho ON/OFF? onyo la manunuzi linaanza lini?
Kama marejesho yanatakiwa ON prod: ni mstari gani wa .env, na staging iuweke kwanza (jaribio la UI la marejesho kwenye staging).

## 2026-11-13 (gy)
UAMUZI WA CHIEF: prod inasogezwa kutoka 02/12 → mara baada ya staging kupita (14 au 15/11). Marejesho (APP_FEATURES_
SALES_RETURNS_ENABLED) = ON kuanzia deploy hiyo. Inachukua nafasi ya (gw)3 na (gx).
1. Staging: maliza kazi → rollback → kazi → deploy → smoke. Kisha ongeza marejesho=true kwenye .env ya staging (hatua
   KAGUA→🛑→ANDIKA), deploy, jaribio la UI la marejesho (mteja anarudisha, siku nyingine inaidhinishwa → mauzo ya siku ya
   awali hayabadiliki — C4). K4 ionyeshe "=true".
2. (gw)1–2 bado zinahitajika: default ya jar, na C4 inafanya kazi swichi OFF/ON.
3. LSMS_PURCHASE_CHECK_FROM: pendekeza kuanzia tarehe ya deploy (si 02/12) — eleza athari, Chief ataamua.
4. 93 prod: K1 iongeze ukaguzi wa payment_method dhidi ya V151 (kusoma tu) KABLA ya K5; isipopita → simama.
   Mstari wa marejesho uwekwe na 93 prod kwa KAGUA→🛑→ANDIKA; K4 "=true".
5. Mwongozo wa Macheda: badilisha kila "mpaka 02/12" kuwa tarehe ya deploy; ongeza sehemu fupi ya marejesho (hatua 4–5 + mfano).
6. MUHTASARI na kalenda: cutoff 25/11 inaondoka; main imefungwa kuanzia staging kupita; hotfix baada ya prod = kutoka tag v2.5.0/v3.3.0;
   74b kagua/andika siku ya deploy; D 07/12 haibadiliki; DROP-MV + C6 = siku 7 baada ya prod.
(Kumbuka ya Claude: maandishi ya (gw) na (gx) hayakunifikia.)

## 2026-11-13 (ha)
93 staging kazi: KAZI_OK 20/20 (401 ya kwanza = kosa la kuandika password).
Hakiki (kusoma tu, data ya prod/staging): kazi ilionyesha ununuzi wa "grepa" GL 1000:-100,1200:100 NA malipo
1000:-100,2000:100 → 1000 −200 kwa mzigo wa 100.
1. Jaribio la kazi liliandika ununuzi BILA msambazaji (unalipwa papo hapo) kisha malipo kwa grepa? Kama ndiyo → kasoro
   ya jaribio; rekebisha kazi93 (ununuzi wenye supplier_uid, UNPAID → malipo).
2. Data halisi: ununuzi wenye supplier_uid (Takawedo 778) → GL ni Cr 2000 au Cr 1000? Kuna malipo ya msambazaji
   yaliyoandikwa juu ya ununuzi uliokwisha kuandika Cr 1000? Hesabu idadi + jumla kama yapo. Hili likiwa kweli = kosa la pesa → simama.
3. Mstari wa audit unasema "DELETE/ALLOWED (2.4.0)" ingawa backend ni 2.5.0 — ni lebo ya script tu?

## 2026-11-13 (hb)
(gy) imekubaliwa. (gw)/(gx) hazihitajiki tena. Kama (ha) haijakufikia, iko hapa chini — ni ya kwanza.
(ha) [kama juu] 1. kasoro ya jaribio -> rekebisha kazi93. 2. data halisi: Cr 2000 au Cr 1000; malipo juu ya ununuzi wa Cr 1000
  -> idadi + jumla; likiwa kweli = kosa la pesa -> simama, prod haiendi. 3. "DELETE/ALLOWED (2.4.0)" - lebo ya script tu?
Mpya:
  4. Kwenye 2.5.0: ununuzi WENYE msambazaji unalazimika kuwa na chanzo (Droo/benki/simu/deni)? Kama hapana, onyo la 6e
     litakuwa la uongo kila siku. Ripoti kwa code + jaribio; usijenge.
  5. LSMS_PURCHASE_CHECK_FROM: subiri uamuzi wa Chief baada ya 1–4.

## 2026-11-13 (hc)
(hb) imekubaliwa: hakuna kosa la pesa; kazi93 mpya sawa.
1. LSMS_PURCHASE_CHECK_FROM = tarehe ya deploy (Chief amekubali). Ongeza kwenye hatua ya KAGUA→STOP→ANDIKA
   pamoja na marejesho (staging kwanza, kisha prod). K4 ionyeshe thamani.
2. MUHTASARI — Desemba (usijenge sasa, main imefungwa):
   a. malipo yenye purchaseUid hayabadilishi payment_status/amount_paid (lebo tu, GL sawa) — hadi hapo, 74 kila mwezi;
   b. "Nunua tena" haipokei msambazaji/deni — muhimu tu Chief akianza kununua kwa mkopo.

## 2026-11-13 (hd)
(hc) imekubaliwa. Badiliko moja: `marejesho` ipokee tarehe kama hoja:
  93-deploy-250.cmd <staging|prod> marejesho [YYYY-MM-DD]
  - bila hoja → tarehe ya leo (EAT), kama sasa;
  - na hoja → tarehe hiyo; ikatae tarehe ya nyuma (< leo) na tarehe zaidi ya siku 2 mbele.
  Sababu: prod ikideployiwa usiku, onyo lianze KESHO (reco ya leo ni ya 2.4.0 bila "Droo" → onyo la uongo siku ya kwanza).
  ORODHA sehemu 7: "deploy usiku → tarehe ya kesho; deploy alfajiri → leo".
Jaribio: hoja ya kesho → KAGUA lengo = kesho; hoja ya jana → inakataliwa.
