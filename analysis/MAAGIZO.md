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
