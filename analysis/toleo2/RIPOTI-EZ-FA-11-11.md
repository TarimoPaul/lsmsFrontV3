# Ripoti (ez)(fa) 11/11 — 88, 89, kazi 5, 6, 7

nimesoma hadi (fa)

## (ez) hatua 88 — imeshafanyika
- 88 ANDIKA iliendeshwa 11/11 09:51 (log `steps/88-andika.log`, ANDIKA-88): JE-2026-2061655622230469, Dr 1000 200,000 / Cr 6200 200,000, POSTED, TB 0.
- Salio baada: **6000 2026 = 2,200,000** (+80e 01/12 = 2,400,000); **6200 ya Frame = 0** (F7C9E331 +200k − 80B 200k + 2939F6DE +200k − 88 200k).
- Kasoro ndogo: maelezo ya journal yanasema "mara ya **3**" (yaliandikwa kabla ya jibu lako "mara ya 2"; script ilirekebishwa 09:52, baada ya kuandika). Kiasi na akaunti ni sahihi; sijaigusa journal.
- Septemba 06AC14BB + 4B6D0F55: haziguswi.

## (ew/ex) hatua 89 — 2939F6DE imeongezwa
- 89 sasa inaweka alama "nje ya ripoti" kwa rows 3: REN-MON Nov 5D9DD844 + TAX-MON Nov B4F8EA66 (sababu "zimeshughulikiwa na hatua 80")
  na **OPE-MON Jan 2939F6DE** (sababu "imeshughulikiwa na hatua 88 (Frame Jan 2026 mara ya 2)"). GL haiguswi.
- t89 (Docker-local, V145): **7/0** (K1 inaona 2939F6DE, W1b sababu ya 88, W2 hakuna log mpya, W3 TB).
- Inaendeshwa BAADA ya toleo 2 kufika prod (inahitaji V145).
- (ex) 58b-prod-schedulers-soma.cmd: diff ni **mwisho wa mistari (CRLF) tu** (`git diff --ignore-cr-at-eol` = tupu); commit ya mwisho ef1ae20 01/11; haihusiani na kazi yoyote. Sijaigusa.

## Kazi 5 — kanuni za hesabu ya stock (IMEKAMILIKA, local)
Matawi: backend `feature/t2-hesabu` **dfbfc4d** (V146), V3 `feature/t2-hesabu` **bddc178** (yote juu ya t2-ripoti).
- **Swali la mzigo** ni la lazima wakati wa kuanza: HAPANA → hesabu kawaida; NDIYO → "andika manunuzi kwanza", au chagua bidhaa za mzigo huo:
  hazihesabiwi leo (hakuna mstari, hakuna tofauti); zoezi linakumbuka bidhaa + maelezo na zinaonekana kwenye dirisha la uthibitisho.
- **KUPIMA nje ya hesabu ya kila siku**: bidhaa yenye pour_product hai haiingii kwenye orodha; CHARGE_TO_CASHIER kwa bidhaa ya kupima inakataliwa.
- **Ziada > 50,000 (gharama)**: uthibitisho unakataliwa mpaka **mtu wa pili** (si aliyeanzisha, si aliyehesabu kwanza) ahesabu tena.
  Mara moja tu kwa mstari; inalinganishwa na stock ya WAKATI huo (mauzo ya baada ya kuhesabu yanazingatiwa). Kitufe kiko kwenye dirisha la uthibitisho.
- **NO_ACTION haijirudii**: bidhaa ileile + tofauti ileile iliyoachwa NO_ACTION kwenye hesabu iliyothibitishwa iliyopita → inakataliwa
  ("iandike au ihesabiwe na mtu wa pili"). Uamuzi wa kila mstari sasa unahifadhiwa (V146); mistari ya zamani imejazwa
  (nakala 29/10: ADJUST 125, CHARGE 246, NO_ACTION 720).
- Majaribio: unit 5 mpya (Counting 79/0), suite **661/0/1**, ng test **102/102**, hesabu_api_e2e **22/0**, hesabu_e2e (UI) **9/0**.
- Kumbuka: Flutter ikianza hesabu (haitumi jibu la swali) itakataliwa kwa ujumbe "Jibu swali kwanza" — haiandiki data mbaya.

## Kazi 6
- **6a hatua 74** — `steps/74-umelipa-sasa.{sh,ps1,cmd}`: Grepa 02/10 → PAID, amount_paid 75,000, **bila journal** (GL tayari Cr 1000);
  capex PENDING inabaki (ni kawaida — rows 311 za ununuzi ziko PENDING). Kinga: row lazima iwe kama ilivyotarajiwa, GL (TB/1000/1200/2000/idadi ya journal)
  haibadiliki. Local: A1 SAWA, A2 inarukwa, A3 row tofauti inakataliwa. KAGUA pia inaorodhesha ununuzi 17 wenye msambazaji (Cr 2000) UNPAID bila
  malipo yaliyounganishwa — **haviandikwi** bila ushahidi (Q6a-1).
- **6b AP ya wasambazaji** (kusoma tu): `toleo2/AP-WASAMBAZAJI-6B-11-11.md`. Tangu Julai 98% ya ununuzi hauna msambazaji (uid) — Takawedo peke yake
  747 / 98.1M Jul–Okt — kwa hiyo GL inaandika Cr 1000 siku ya mzigo. Ununuzi UNPAID bila uid = **hadi 36.9M** ya deni linalowezekana (si lililothibitishwa).
  Pia: reco ya Okt ina ununuzi wa droo 2.6M tu dhidi ya 36.4M kwenye GL Cr 1000. Pendekezo P1–P4 + maswali.
- **6c Deni kwa mmiliki — Jess** (IMEKAMILIKA, local): V147 akaunti **2310 "Deni kwa mmiliki - Jess"**; chanzo MMILIKI sasa kinachagua
  Paul (2300) au Jess (2310), lazima. Rekodi za zamani za MMILIKI = 2300. Backend `feature/t2-pesa` bf697a4, V3 e97f817; unit + C3SourcePgCheck (Jess) + c3_e2e.
- **6d 1010 / 6e droo kwenye reco**: muundo + maswali `toleo2/MUUNDO-6D-6E-11-11.md`. **Imewekwa kando** — inategemea jibu la Q6b-1
  (6e ikiunganishwa leo ingetoa 36.4M ya ununuzi kutoka pesa ya droo inayotarajiwa).

## Kazi 7
- **Ripoti ya uendeshaji kwa avg** (IMEKAMILIKA, local): `DailyPnlService.stockValueAt` sasa = stock ya siku × `current_average_cost`
  (bei ya manunuzi ya mwisho ni fallback tu). Ukurasa wa Store ulikuwa tayari unatumia avg (tangu 30/09). Hakuna historia ya avg,
  kwa hiyo kila siku inathaminiwa kwa avg ya leo. StockValuePgCheck mpya.
- **SKU za Jagger**: inasubiri majina/saizi kutoka kwa Chief (Q7-1).

## Lango (nakala safi ya dump 29/10, Flyway 134→147)
- PG checks **6/6** (LoanSql + PnlBridge zilikuwa zinashindwa kwa sababu ya t2-ripoti: safu ya V145 haikuwa kwenye entity — imerekebishwa, prod haiathiriki).
- Image `lsms-backend:local-bf697a4`, nakala mpya: pg_restore 0, Flyway 134→147, 0 zilizoshindwa.
- Suite: 661/1/1 kwenye bf697a4 — jaribio la zamani lilitarajia MMILIKI bila mmiliki; limesasishwa (1d8abb3), SupplierPaymentSourceTest 8/0.
- ng test 18 files / 102 tests SAWA.
- run-all: **21/22 SAWA** kwenye nakala safi; c3_e2e ilishindwa kwenye hesabu ya usafi tu (malipo 5 sasa, sio 4) → imerekebishwa (V3 959cad4), c3 **24/0**.
- Bado: kurudia suite kamili na run-all kwenye nakala safi kwa commits za mwisho (1d8abb3 / 959cad4) — itafanyika kwenye lango la kazi 10.

## Kazi 8 — C4 marejesho ya mauzo (IMEKAMILIKA local, swichi IMEZIMWA kwa default)
- Backend `feature/t2-marejesho` **7db84a3** (merge ya sales-returns 9425223 + t2-pesa; V135 → **V148**), V3 `feature/t2-marejesho` **4f45964** (UI e199712).
- **Swichi** `app.features.sales-returns.enabled` = **false** (kama prod): ombi jipya na kuidhinisha vinakataliwa ("bado hayajawashwa");
  kukataa ombi lililopo kunaruhusiwa; V3 inaficha "Rudisha bidhaa / Badilisha bidhaa" (GET /sales/returns/enabled). Kuiwasha = uamuzi wako (Q8-1).
- Kinga mpya kwa toleo 2: mstari wa **KUPIMA** (kipimo kutoka chombo) haurudishwi kupitia C4, na exchange haitoi bidhaa ya KUPIMA.
- GL (imethibitishwa kwenye nakala safi, swichi ON): Dr 4020 bei ya kuuza / Cr akaunti ya kurudisha (CASH 1000, M-Pesa 1030 — mapper ileile ya malipo ya mauzo);
  bidhaa nzima inarudi stock: Dr 1200 / Cr 5000 kwa gharama ya mstari; iliyoharibika: hakuna 1200 (gharama inabaki 5000). TB 0.
- Majaribio: SalesReturnSwitchTest (OFF), suite kamili ya tawi **663/0/1** (pamoja na swichi), marejesho_api_e2e **11/0** (ON) na F1 (OFF), ng test 103/103.
- Haijafanyika: jaribio la UI (Playwright) la dirisha la marejesho, na reco ya pesa iliyorudishwa siku nyingine (mstari wa reco uliobadilishwa na WIP) — kabla ya kuiwasha.

## Kazi 9 — usafi (IMEANZA)
- **ORODHA-FLUTTER-V3** `toleo2/ORODHA-FLUTTER-V3-11-11.md`: endpoints 413 kati ya 724 za backend ambazo V3 haiziti (kwa controller) — Chief achague.
  Chanzo cha Flutter hakipo kwenye PC hii; kwa hiyo hatua **90** (`steps/90-flutter-matumizi.*`, kusoma tu) inaonyesha prod: logins za Flutter
  (user agent Dart) na watumiaji wake kwa siku 30 (login_audit, V137), na matukio ya audit_trails kwa aina ya mteja. Imejaribiwa local.
- Bado: C7 (njia 26 + M1 MV scheduler + docker-compose.aws.yml; Flutter mwisho) → C6 → §17 DISPOSED → Flyway V039/outOfOrder → config → log ya build UTF-16.

## Kazi 10 — HAIJAANZA.

## Jedwali la origin

| Agizo | Kazi | Mahali | Commit |
|---|---|---|---|
| (ez) | 88 imeshaandikwa; pango 2026 = 6000 2.2M, 6200 0 | steps/88-andika.log | — (prod 09:51) |
| (ew)(ex)(ez) | 89 + 2939F6DE | steps/89-nje-ya-ripoti.*, toleo2/89-majaribio/t89.sh | (faili za analysis) |
| (fa) 5 | swali la mzigo, KUPIMA nje, mtu wa pili > 50k, NO_ACTION, V146 | backend t2-hesabu / V3 t2-hesabu | dfbfc4d / bddc178 |
| (fa) 6a | hatua 74 Grepa → PAID | steps/74-umelipa-sasa.* | (faili za analysis) |
| (fa) 6b | tathmini ya AP | toleo2/AP-WASAMBAZAJI-6B-11-11.md | — |
| (fa) 6c | 2310 Jess, MMILIKI → mmiliki | backend t2-pesa / V3 t2-pesa | bf697a4 / e97f817 |
| (fa) 6d, 6e | muundo + maswali | toleo2/MUUNDO-6D-6E-11-11.md | — |
| (fa) 7 | ripoti kwa avg; lango: safu ya V145 kwenye entity | backend t2-pesa | bf697a4 |
| (fa) 8 | C4 merge + V148 + swichi OFF + kinga za KUPIMA + e2e | backend t2-marejesho / V3 t2-marejesho | 7db84a3 / 4f45964 |
| (fa) 9 | ORODHA-FLUTTER-V3 + hatua 90 | toleo2/ORODHA-FLUTTER-V3-11-11.md, steps/90-flutter-matumizi.* | — |

## Maswali kwa Chief
- **Q6a-1** Ununuzi 17 wenye msambazaji (Jun–Okt, ~0.7M) UNPAID: ulilipwa siku ileile kwa droo? (daftari la Macheda) — bila hilo havibadilishwi.
- **Q6b-1** Takawedo / Pepsi wanakopesha au wanalipwa siku ya mzigo, na kutoka wapi (droo, benki, mmiliki)?
- **Q6b-2** Deni halisi la leo kwa Takawedo / Pepsi (daftari lao)?
- **Q6b-3** "vyote ni vya bwana" (12.56M) = Paul alilipa kwa pesa yake? Zirekebishwe kwenda 2300?
- **Q6b-4** Malipo ya 04/10 kwa takawedo 6,258,126 yalikuwa ya ununuzi gani?
- **Q6e-1..3, Q6d-1..4** — kwenye MUUNDO-6D-6E-11-11.md.
- **Q8-1** C4: lini kuwasha marejesho (swichi)? Pendekezo: baada ya jaribio la UI + reco, staging kwanza.
- **Q9-1** Endesha `90-flutter-matumizi.cmd kagua` (kusoma tu) na nitumie 90-kagua.log; kisha chagua kwenye ORODHA-FLUTTER-V3 kipi kihamie V3.
- **Q7-1** SKU za Jagger: majina na saizi unazotaka (k.m. "JAGGER MASTER 1L", "… 700ML", "… 350ML")?
