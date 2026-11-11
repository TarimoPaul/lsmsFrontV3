# Ripoti 11/11 — (er) (et) (ev) (ew)

nimesoma hadi (ew). (er) na (et) zilikuwa "ilipotea"; sasa ziko kwenye MAAGIZO.md pamoja na (ev) na (ew).

## (et) KUPIMA faida kwa chombo — IMEKAMILIKA
Matawi: feature/t2-kupima, backend d5b35f5 na V3 f0f8667. Yameunganishwa kwenye feature/t2-tozo.

- **Gharama ya chombo:** chombo kinahifadhi gharama yake siku kinapofunguliwa.
  - Safu mpya `parent_avg_cost` na `start_ml`. Ziliongezwa NDANI ya V143, ambayo bado haiko staging wala prod.
  - Gharama kwa ml = avg ÷ ujazo, na haibadiliki kamwe baada ya kufunguliwa.
  - Chombo cha uhamisho kinatumia `start_ml` = ml zilizohesabiwa.
- **Ripoti ya vyombo:** kwa kila chombo inaonyesha:
  - mzazi;
  - gharama ya chombo;
  - mapato;
  - gharama ya vilivyouzwa;
  - FAIDA = mapato − gharama ya vilivyouzwa − upotevu;
  - mapato ya juu kabisa = ml zote × bei bora kwa ml;
  - upotevu (ml + TZS);
  - aliyefungua na aliyefunga.
- **Kosa la zamani limerekebishwa:** mstari uliogawanywa kati ya vyombo 2 (SPLIT) ulihesabiwa mapato yake yote kwenye vyombo vyote viwili. Sasa mapato yanagawanywa kwa ml.
- **`GET /kupima/profit`:** jumla kwa kinywaji, kwa mwezi, na kwa kinywaji+mwezi, pamoja na kadi ya wiki (siku 7).
- **V3:** kichupo kipya "Faida" (kadi ya wiki, jedwali la kinywaji, jedwali la mwezi). Kadi ya kila chombo inaonyesha faida na gharama.
- **Majaribio:**
  - Kanuni ya Chief: avg ×3 baada ya kufungua → gharama ya kipimo HAIBADILIKI, kwenye mstari wa mauzo na kwenye POS.
  - kupima_api_e2e 54/0 (T1–T9).
  - kupima_e2e 22/0.
  - ng test 100/100.
  - run-all E2E_OK 16/16.

## (er) Kazi 4 — Q4-1, Q4-2, Q4-3, H1 — IMEKAMILIKA
Tawi: feature/t2-tozo. Backend 2585e25 + 55b1d26 (pamoja na merge c18cded). V3 af82b73 (pamoja na merge ad26fb9).

- **Q4-1 na Q4-2:** ndivyo ilivyojengwa tayari. Madeni ya kabla ya V144 hayaguswi; msamaha unafuta tofauti kwanza, kisha gharama.
- **Q4-3 tozo ya mali:**
  - Journal: Dr 1120 = min(tozo, NBV) / Dr 1590 = uchakavu wa sehemu hiyo / Dr 6900 = NBV isiyotozwa / Cr akaunti ya mali (1510 …) = gharama ya sehemu hiyo.
  - Ziada juu ya NBV ni "margin" ya deni. Inaingia 4900 tu inapolipwa au kwa makubaliano ya maandishi.
  - Mali isiyounganishwa na Capital haipo kwenye vitabu, kwa hiyo hakuna journal; tozo yote ni margin.
  - **Sehemu ya mali** (mf. kreti 2 kati ya 30): gharama na salvage ya Capital zinapungua kwa uwiano huo, na uchakavu ulioondoka unawekwa `removed_accumulated` (imeongezwa NDANI ya V144).
    - Hesabu ya uchakavu ya kila mwezi huhesabu upya tangu mwezi wa kwanza. Ikiwa sehemu imeondolewa, sasa inachukua 1590 kutoka GL (journal za DEP − kilichoondoka) na kugawa kilichobaki kwa miezi iliyobaki.
    - Miezi iliyokwisha andikwa haiguswi.
  - **Mali yote** (mf. Fridge 1/1): imewekwa LOST (disposal_date, thamani iliyopatikana = NBV iliyotozwa), na uchakavu unasimama. Status inabaki APPROVED, kwa sababu ya kasoro iliyo hapa chini.
  - Msamaha wa gharama ya deni la mali → Dr **6900** (hasara ya mali). Deni la stock bado → 5100.
- **H1:** control ya 1120 sasa inalinganisha GL na (gharama + tofauti iliyokubaliwa) ya madeni ya V144. Madeni ya zamani: salio lote, kama zamani.
  - Jaribio: tofauti ya control HAIBADILIKI baada ya tozo ya stock, malipo, makubaliano, msamaha, tozo ya mali na malipo yake.
- **Majaribio:**
  - AssetChargeSplitTest 4/0.
  - tozo_api_e2e 32/0 (H1, H2, D1–D5, E1–E4 mapya).
  - suite **652/0/1**.
  - run-all **E2E_OK 18/18** (backend 55b1d26, nakala safi ya 29/10, Flyway 144).

**Kasoro iliyoonekana njiani (BAADA §17, si (1)/(2)):** DB haikubali status `DISPOSED`, kwa hiyo "Ondoa mali" ya Capital haijawahi kufanya kazi. Kwenye nakala ya 29/10 hakuna mali iliyoondolewa, hivyo hakuna data mbaya.

## (ev)
Hatua 86 imefutwa kwenye mpango; hakuna journal na hakuna alama za kuweka. Bei za MA-LOT: Chief ataweka kwenye V3 baada ya toleo 2.

## (ew) Ripoti ya uendeshaji: Frame/TRA mara mbili
- Sijagusa rows hizo, wala GL.
- **Hatua 87 (KUSOMA TU), tayari, haijaendeshwa:** `analysis\steps\87-kagua-mwingiliano.cmd`. Inaorodhesha:
  - A: share za mwaka za 2026;
  - B: jozi share + mtoto mwingine wa kitu kilekile, mwezi wowote wa 2026, kwa neno au kundi linalofanana;
  - C: watoto wote wa mwezi kwa ukaguzi wa macho.
  - SQL imejaribiwa kwenye nakala ya 29/10. Hiyo ni kabla ya REN-MON/TAX-MON, kwa hiyo B ilikuwa tupu.
  - Hata hapo, C inaonyesha `OPE-MON-20260101-…-2939F6DE` "2400000" 200,000 (Jan). Huenda ni share nyingine ya Frame. Chief aangalie.
- **Kazi ya toleo 2 (bado haijajengwa):**
  - alama `exclude_from_ops_report` + sababu + audit (CAPITAL_APPROVE);
  - ripoti ya uendeshaji iiheshimu;
  - daraja "Marekebisho ya 2026 (hatua 80)";
  - hatua ya data ya kuweka alama kwa REN-MON …5D9DD844 na TAX-MON …B4F8EA66.
  - Itafanywa kabla ya kazi 5, kwa sababu inaathiri ripoti ya Nov. Chief akipenda kazi 5 kwanza, aseme.

## Maswali
- Q-ew1: alama ya `exclude_from_ops_report` iwe ruhusa ya CAPITAL_APPROVE tu (pendekezo), au CEO tu?
- Q-er1: tozo ya mali isiyounganishwa na Capital (thamani 0 kwenye vitabu) haiandiki chochote mpaka ilipwe. Sawa?

## (ex) (ey) — 11/11
- **Majibu:** Q-ew1 = CAPITAL_APPROVE (sababu ya lazima + audit + orodha ya zilizoondolewa inayoonekana kwa wakaguzi). Q-er1 = ndiyo; hivyo ndivyo ilivyojengwa.
- **58b-prod-schedulers-soma.cmd (worktree t2-kupima):** sijaigusa.
  - Maudhui hayajabadilika: `git diff --ignore-cr-at-eol` ni TUPU. Tofauti iko kwenye mwisho wa mistari tu (85 mistari, CRLF).
  - Tarehe ya faili ni 2026-11-10 13:53:31, sawa kabisa na reflog `reset: moving to HEAD` wakati worktree ya t2-kupima ilipoundwa.
  - Hivyo ilitokea wakati wa checkout: `.gitattributes` (`*.cmd text eol=crlf`) dhidi ya blob ya ef1ae20 (01/11).
  - Haihusiani na kazi yangu yoyote.
- **OPE-MON-20260101-000000-2939F6DE** (nakala ya 29/10):
  - Maelezo "2400000", 200,000, transaction 01/01/2026, APPROVED.
  - Ilisajiliwa 2026-04-30 14:01. Aliyeisajili hajulikani: `created_by`, `approved_by` na `updated_by` ni tupu, audit_trails haina rekodi kwa wakati huo, na login_audit inaanza 11/11 tu.
  - Journal: **JE-2026-12651943663716, 01/01/2026, POSTED, Dr 6200 200,000 / Cr 1000 200,000**. Iliandikwa 2026-09-30 10:31 (rebuild ya GL).
  - Frame "Mwaka mzima" F7C9E331 (Jan) ina journal sawa kabisa. **Hatua 80 ilitafuta Frame kwa jina 'frame', kwa hiyo row hii haikuonekana.**
- **Hatua 88** imeandaliwa (KAGUA → 🛑 → ANDIKA, Novemba): Dr 1000 200,000 / Cr 6200 200,000, sawa na 80b. **Usiendeshe ANDIKA kabla ya jibu la Chief.**
  - Kinga zake:
    - row na journal lazima viwe vilevile;
    - kipindi kiwe wazi;
    - kabla ya cutover D;
    - mara moja tu.
  - Maandishi ni ASCII tu.
  - Jaribio la local: t88 8/0 (`analysis/toleo2/88-majaribio/t88.sh`).
  - Row ya capex haifutwi; itawekewa alama exclude_from_ops_report.
- **Septemba "wafanyakazi":** OPE-MON-20260901-…-06AC14BB (iliundwa 08/09 08:49) na …-4B6D0F55 (08/09 09:11).
  - Kila moja ni 150,000, POSTED, Dr 6200 / Cr 1000, journal za 01/09.
  - Zilisajiliwa dakika 22 tofauti, na kila moja ina jina tofauti kidogo: "wafanyakazi" na "Wafanyakazi".
  - Agosti ilikuwa na "Mfanyakazi" 150k + "Manager" 180k, kwa hiyo huenda Septemba ni watu wawili tofauti. Chief athibitishe.
  - KAGUA ya hatua 88 inaonyesha pia hizi kwenye prod ya sasa.

## (ew) exclude_from_ops_report — IMEJENGWA (toleo 2)
Tawi jipya: **feature/t2-ripoti**, linatoka t2-tozo. Backend d92da83, V3 80407f7. Worktrees: Lsms-t2-ripoti na lsmsFrontV3-t2-ripoti.

- **V145:**
  - `capital_expenditure.exclude_from_ops_report`;
  - `capex_ops_report_exclusion_log`: EXCLUDE/INCLUDE, sababu, nani, lini. Insert tu, haibadilishwi.
- **API:** `POST /api/v1/capital-expenditure/{uid}/ops-report-exclusion`.
  - Ruhusa: CAPITAL_APPROVE tu (ex).
  - Inakubali gharama za mwezi tu.
  - Sababu lazima iwe na herufi ≥10 na isiwe takataka (A6).
  - Kuweka alama mara ya pili kunakataliwa.
  - `GET …/ops-report-exclusions` inaonyesha orodha + historia kwa wakaguzi (CAPITAL_READ).
- **Ripoti ya uendeshaji (daily P&L):** inaacha rows hizo nje.
- **Daraja:** mstari mpya **"Marekebisho ya 2026 (hatua 80): gharama zilizoondolewa kwenye ripoti ya uendeshaji, GL inazo"**. GHARAMA_ZA_MWEZI haizibebi tena, kwa hiyo GL dhidi ya ripoti bado inaelezeka.
- **V3, kichupo cha Gharama:**
  - "Ondoa kwenye ripoti" / "Rudisha kwenye ripoti" (inahitaji sababu);
  - alama "nje ya ripoti ya uendeshaji" kwenye row;
  - "Nje ya ripoti (n)" inafungua orodha na historia.
- **Kasoro ya zamani iliyorekebishwa njiani (V3):** kubonyeza Enter kwenye kisanduku cha kutafuta kulivunja orodha zote zenye `(search)="q.set($event)"`.
  - Chanzo: Chrome inatuma tukio la asili `search` lenye Event, si maandishi, na linapanda hadi kwenye kipengele.
  - Matokeo kabla ya kurekebisha: `q().trim is not a function`, na jedwali liliacha kujichora upya.
  - Sasa SearchBar inalizuia.
- **Majaribio:**
  - OpsReportExclusionTest 4/0;
  - suite **656/0/1**;
  - ng test 102/102;
  - ops_e2e 19/0. Linajumuisha jaribio la (ew): mtoto wa Frame wa Nov akiondolewa, ripoti ya Nov = share ya mwaka tu, na GL na TB hazibadiliki.
  - run-all **E2E_OK 19/19** (backend d92da83, nakala safi ya 29/10, Flyway 145).
- **Hatua 89 (baada ya toleo 2 kufika prod):** `89-nje-ya-ripoti.cmd` (KAGUA → 🛑 → ANDIKA kupitia API).
  - Inaweka alama kwa REN-MON-20261101-000000-5D9DD844 na TAX-MON-20261101-000000-B4F8EA66, sababu "zimeshughulikiwa na hatua 80".
  - Inakataa ikiwa V145 haipo prod.
  - Row zaidi zinaongezwa kwa `L89_ZAIDI`, mf. 2939F6DE baada ya jibu la 88.
  - Jaribio: t89 6/0.
- **Inayofuata:** kazi 5.
