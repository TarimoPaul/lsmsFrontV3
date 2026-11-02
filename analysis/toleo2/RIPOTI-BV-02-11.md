# RIPOTI (by) + (bv) 02/11 — matokeo ya 66 prod, 64 ANDIKA, hatua 65, ubora wa sababu

nimesoma hadi (by). Herufi nilizoziona tangu ripoti iliyopita: (bz) mara ya pili (ilikuwa nakala ya ileile; haikuongezwa tena kwenye MAAGIZO) na (by). (by) ilifika baada ya (bz) na imehifadhiwa kwenye MAAGIZO.md kama "ilifika baada ya (bz)".

## 1. (by) imetekelezwa
- Pepsi: hatua 65 ya Pepsi HAIKUANDALIWA (uamuzi wa Chief). Kwa sababu hiyo namba 65 iko huru, na sasa ni ya sale zilizofutwa (§4).
- BAADA-YA-BATCH §2: "manunuzi ya siku kabla ya hesabu" na swali la lazima "Kuna mzigo uliofika leo ambao haujaandikwa?" vimeongezwa.
- BAADA-YA-BATCH §2a (mpya): kipimo kimoja cha thamani ya stock = avg, kwa ripoti ya uendeshaji na kwa ukurasa wa Store. Store isitoe 0 kwa bidhaa iliyopo. Jaribio la kukubali kazi limeandikwa humo.

## 2. Hatua 66 kwenye prod (12:33, ---OK---; mwendesho wa 12:37 umetoa namba zilezile)
Kila namba hapa ni ya prod: 2.3.0, Flyway 135, `read_only on`.

| Kipimo | Thamani |
|---|---|
| GL 1200 | **4,458,775.51** |
| Daftari Σ stock × avg | **4,458,766.74** |
| **Daftari − GL** | **−8.77** |
| Ripoti ya uendeshaji (`stockValueAt` leo) | 4,547,537.62 (+88,770.88 dhidi ya daftari) |
| Ukurasa wa Store wa V3 | 3,553,641.96 (−905,124.78); bidhaa 22 zenye stock hazina manunuzi ndani ya miezi 6, avg 840,333 |

- **1200 inalingana na daftari, ikiwa na tofauti ya 8.77 tu.** Hakuna mwendo wowote wa stock uliotokea baada ya true-up ya 30/09 bila journal (`TANGU_TRUE_UP_MWENDO_BILA_JOURNAL`: hakuna mstari). Manunuzi yote 2,239 yana journal, na GL = stock × gharama (tofauti ya jumla 0.82, inayotokana na kukadiria/rounding).
- Tofauti kati ya 4,578,975.35 (baada ya 63, 12:06) na 4,458,775.51 (12:33) ni −120,199.84. Hii ni shughuli ya kawaida ya leo kati ya 12:06 na 12:33: COGS ya mauzo, pamoja na hesabu ya 02/11 (STAFF_LIABILITY_CHARGE na STOCK_ADJUSTMENT za tarehe 02/11). Daftari lilibadilika kwa kiasi kilekile, kwa hiyo tofauti inabaki −8.77.
- **Bidhaa kumi kubwa** (COCA & FANTA +499k, PEPSI & MIRINDA +423k, BLACK AND WHITE +370k, SERENGETI LITE −319k …) ni historia ya KABLA ya 30/09:
  - marekebisho ya mkono `ADJ-*`: 271 kati ya 273 hayana journal (Feb–Sep, −3,417 vipande);
  - `ADJ-RESET` ya 09/04: stock hasi iliwekwa 0 (+3,277);
  - stock ya mwanzo: bidhaa 12, vipande 616;
  - mapengo ya mnyororo: bidhaa 52, mapengo 836.

  Jumla ya tofauti hizi kwa bidhaa ni +1,055,832.76. True-up mbili za 30/09 (527,068.35 + 528,773.18 = 1,055,841.53) ziliifunika kwa jumla moja, si kwa kila bidhaa, kwa hiyo jumla ni −8.77. **Hakuna cha kurekebisha kwenye 1200 kabla ya D.**
- **Ripoti ya uendeshaji +88,770.88** ina vyanzo viwili:
  - **70,000 HENNESY:** ripoti inaona stock 2, `current_stock` ni 0. Ripoti inachukua mwendo wa mwisho kwa movement_date, na mwendo wa tarehe ya nyuma unaibadilisha.
  - **18,770.88:** bei ya mwisho ni tofauti na avg (K VANT 10,005; DROSTDY OFF 4,773; TZEE GIN 3,792 …).
  - Hivi ndivyo §2a ya BAADA itavyoondoa.
- **Kwa D (hatua 60):** thamani ya ufunguzi ya stock = Σ stock × avg = GL 1200, siku hiyo. Usitumie ripoti ya uendeshaji wala ukurasa wa Store.

Mauzo yaliyofutwa yenye stock iliyorudishwa bila journal ni 3, yote ya kabla ya true-up. Moja ni RCP-20260807-270000-DCCB, ambayo reversal yake ilirudisha +152 zaidi ya kilichouzwa (250,800 kwa avg). Ni historia, lakini inaonyesha kosa la kufuta la zamani; nitaliweka kwenye orodha ya uchunguzi wa baadaye ikiwa unataka.

## 3. Hatua 64 kwenye prod
- 12:45: ANDIKA ilikataliwa kwa `LOGIN_IMESHINDWA 401` (password) kabla ya kuandika kitu chochote.
- 12:47: **PASS 19, FAIL 0, SKIP 1**:
  - J1 15/10 Dr 6700 / Cr 1000 28,500 (MJ:75a7b7ca…) imeandikwa;
  - J2 imerukwa, kwa sababu hukuandika "J2 ndiyo";
  - 1000: 14,403,341.70 → 14,374,841.70; 6700 +28,500; 1120 = daftari 1,057,301.88; TB 0.

## 4. (bv) a) Hatua 65-kagua-zilizofutwa (kusoma tu, prod) — imeandaliwa, HAIJAENDESHWA
`analysis\steps\65-kagua-zilizofutwa.cmd` (+ .sh/.sql, kiolezo cha 66). Haina password na haifanyi restart. Kwa sale 6 (na nyingine yoyote iliyofutwa tangu 30/10) inaonyesha:
- **SALE:** nani alifuta (jina limetolewa kutoka uid au email), lini, sababu, muuzaji, jumla.
- **BIDHAA:** kiasi kilichouzwa na kilichorudishwa kwenye stock (vipande, kutoka mwendo wa SALE / SALE_REVERSAL).
- **MBADALA:** sale hai zenye bidhaa ileile, zilizoundwa kati ya saa 2 kabla na saa 24 baada ya kufutwa, au zinazotaja risiti yake. Zinaonyeshwa 5 bora kwa kila sale, na tathmini IMEINGIZWA_UPYA / HUENDA / SEHEMU.
- **HESABU:** hesabu 2 za kwanza za kila bidhaa (zilizohesabiwa kweli) baada ya sale: mfumo/imehesabiwa/tofauti, tozo, na 1120 kwa jina (staff_liability_item) pamoja na stock_adjustment.
- Haitumii `replaces_sale_uid`, kwa sababu prod iko Flyway 135.

Majaribio:
- Fixture kwenye nakala ya local (rollback): sale moja iliyopewa namba 301026-2245.
  - Inaonekana na bidhaa 3, mbadala 5 (SEHEMU), na hesabu 6 zenye tofauti.
  - Sale ya e2e ya "Tengeneza upya" inatambuliwa kama IMEINGIZWA_UPYA (inataja risiti).
- Toleo la kwanza lilitoa wagombea 3,617 kwa sale za tarehe ya nyuma. Dirisha limerekebishwa (kuzunguka wakati wa kufutwa).
- `.sh` kwa docker bandia: exit 0. SQL mbovu → exit 1.
- `.cmd` fakes 4/4.

## 5. (bv) b) Ubora wa sababu — IMEKAMILIKA local
Kanuni: sababu inakataliwa ikiwa ni herufi moja inayojirudia, au ina herufi/tarakimu tofauti chini ya 4. Nafasi na alama hazihesabiwi; herufi kubwa/ndogo ni sawa. Urefu wa chini wa kila mahali unabaki kama ulivyo.

**Backend** (release/2.4.0 = **88a8708**, feature/reason-quality 2c48615):
- `ReasonQuality` (uaa.utils).
- Kufuta/kubadilisha mauzo: `REASON_JUNK` kwenye SaleChangeGuard.
- Reco:
  - maelezo ya tofauti: wakati wa submit, ndani ya lango la submit, ndani ya lango la approve, na kwenye endpoint ya kuhariri;
  - unsubmit;
  - reopen.
  - Kwenye submit, ukaguzi unafanyika KABLA maelezo hayajawekwa kwenye entity. Return ya mapema baada ya set ingehifadhiwa na Hibernate.

Majaribio ya backend:
- ReasonQualityTest 2, SaleChangeGuardTest +1 (9/0), ReconciliationReasonQualityTest 4.
- Majaribio ya zamani ya reco (unsubmit, reopen, zero-cash) yote yamepita.
- Mutations 5/5 zimekamatwa: guard, unsubmit, reopen, maelezo ya tofauti, MIN_DISTINCT = 2. Baseline ni 15/0.
- **Suite 558/0/1.** Rekodi ya (br) ilisema 559/0/1. Sijachunguza tofauti ya 1; memory ya (br) inataja hesabu iliyochanganywa na XML ya zamani ya gated check.
- Pengo: lango la submit na la approve kwa maelezo ya zamani yenye takataka halina jaribio lake. Code iko pamoja na la endpoint ya kuhariri, ambalo lina jaribio.

**V3** (release/3.2.0 = **1ca9b04**, feature/v3-reason-quality 7795083):
- ReasonDialog ina chaguo `quality`, linalotumika kwenye dialog ya kufuta/kubadilisha mauzo.
- Kichupo cha idhini ya reco: prompt ya unsubmit/reopen na kisanduku cha maelezo ya tofauti. Takataka inaonyesha maelezo mekundu, na kitufe kinazimwa.

Majaribio ya V3:
- vitest 2/0, kesi zilezile za backend.
- **sababu_e2e 20/0:**
  - UI ya kufuta mauzo kwa takataka 3;
  - API ya kufuta / unsubmit / reopen zinakataliwa, na DB haibadiliki;
  - prompt ya unsubmit kwenye UI;
  - reco ya majaribio inarudishwa APPROVED mwishoni.
- **Mwendesho wa kudhibiti** kwenye build ya release/3.2.0 ya zamani (c540ab8): FAIL 8 (A1/A2/C1/C2), kama ilivyotarajiwa.
- **run-all kwenye build ya mwisho 1ca9b04 + backend local-88a8708 (nakala mpya, Flyway 138): E2E_OK 6/6** (b1 27, b2 22, b3 38, b4 11, mabango 10, sababu 20).

## 6. (bv) c) Compose `${ROOT_PASSWORD:-}` — ni sehemu ya C1, haijafanywa
Onyo "The ROOT_PASSWORD variable is not set" linatoka kwenye `~/lsms-deployment/docker-compose.yml` ya server, ambayo haiko kwenye git. Backend yenyewe tayari inatumia `root.password=${ROOT_PASSWORD:}`, na `DataInitializer` inaruka kubadilisha root ikiwa password ni tupu. Kwa hiyo onyo hili ni kelele, si hatari.

Badiliko ni la infra (compose ya prod), kwa hiyo kwa kanuni ya (ba) linaingia kwenye script MOJA ya staging/prod ya kifurushi (C1):
1. nakala ya compose;
2. `${ROOT_PASSWORD}` → `${ROOT_PASSWORD:-}`;
3. `docker compose config -q` bila onyo;
4. diff.

Sijaligusa server.

## 7. Kinachofuata
- Endesha `analysis\steps\65-kagua-zilizofutwa.cmd` (kusoma tu) na unitumie log.
- Onyo la manunuzi ("carton au chupa?"), kisha B5.
