# RIPOTI (cm) — 03/11/2026 — C2

nimesoma hadi (cm). Herufi tangu ripoti iliyopita (cl): **(cm)** tu.

Tawi: backend `feature/c2-null-params` = **20aa370** (b8fc0e3 + 20aa370), juu ya release/2.4.0 8d6413f.
Halijaunganishwa kwenye release/2.4.0 — linasubiri usome diff.

## 1. Kilichopatikana (nakala ya Docker-local, dump ya prod 29/10, muunganisho wa kusoma tu)
Harness `C2QueryPgCheck` inasoma kila `@Query` ya repository kwa reflection na kuiita kwa beans halisi.
- **Njia 93**: 71 zenye kichujio cha null, 27 zinazorudisha `Object[]` tupu (baadhi ziko kwenye makundi yote mawili).
- **Simu 315**: kila njia imeitwa ikiwa na params zote, kila param null peke yake, na zote null.
- Ripoti kamili: `C2-ripoti-03-11.tsv` (simu kwa simu, pamoja na aina JPQL/native) na `C2-muhtasari-03-11.txt`.

**Chanzo A — tarehe:** pgjdbc inatuma `LocalDateTime`/`LocalDate` bila aina, kwa hiyo `:d IS NULL` ilishindwa
**hata tarehe ikiwa imewekwa** ("could not determine data type"). Utafutaji wote wa Store na Purchases ulikuwa ukishindwa kila mara.

**Chanzo B — maandishi:** Hibernate inatuma String iliyo null kama `bytea`, kwa hiyo `'%'||?||'%'` ikawa `lower(bytea)`.

**Chanzo C — safu moja:** Spring Data inafunga safu moja ndani ya `Object[]` nyingine (`{{...}}`).
Callers waliangalia `row.length >= n`, wakapata 1, na **kimya** wakarudisha 0 au kitu tupu:
- muhtasari wa faida (`SaleService.getProfitSummary`) → 0 kila mara;
- notification ya mauzo ya jana → "Hakuna data ya mauzo" kila siku;
- ulinganisho wa mauzo, `debugProductStock`, muhtasari wa CapEx, takwimu za bei za repurchase template, movement-stats.

## 2. Marekebisho (njia hai tu; mpangilio: pesa → stock → manunuzi)
| Njia | Aina | Marekebisho |
|---|---|---|
| SalesRepository.getProfitSummaryRaw | native | SingleRow kwenye SaleService |
| SalesRepository.getLiveDailySummary | native | SingleRow kwenye DailySalesNotificationScheduler |
| SalesRepository.getSalesComparisonData | native | SingleRow kwenye SaleService |
| CapitalExpenditureRepository.getSummaryStatistics | JPQL | SingleRow kwenye CapitalExpenditureService |
| StoreRepository.getStockBreakdownByProductUid | native | SingleRow kwenye SaleService |
| StoreRepository.getMovementStatistics | JPQL | SingleRow kwenye StoreService (API sasa inarudisha safu bapa ya 5; V3 haiitumii) |
| StoreRepository.getMovementSummaryByType | JPQL | `cast(:d as LocalDateTime) IS NULL` |
| StoreRepository.searchByTermAndDateRangePaginated, searchByTermAndTypesPaginated, searchStoreEntries, searchStoreEntriesUltraSafe | JPQL | cast ya tarehe + `coalesce(:s, '') = ''` |
| StoreRepository.searchStoreEntriesNative | native | `CAST(:d AS timestamp)`, `CAST(:s AS text)`; CONVERT_FROM imeondolewa (reference ni varchar, notes ni text) |
| PurchaseRepository.searchPurchases, advancedSearchPurchases, findPurchasesByDateRangeAndSupplier | JPQL | cast ya tarehe/BigDecimal/Boolean + `coalesce(:s, '') = ''` |
| PurchaseRepository.getPriceAnalyticsForProduct | JPQL | SingleRow kwenye PurchaseService |

`coalesce(:s, '') = ''` maana yake ni kwamba maandishi tupu `''` sasa yanachukuliwa kama "bila kichujio", sawa na null.
Zamani `''` ingeleta `LIKE '%%'`, ambayo inalingana na karibu safu zote, kwa hiyo tofauti ni ndogo.

## 3. Usahihi (cm) — `C2CorrectnessPgCheck` 20/0
Kila njia hai iliyorekebishwa inalinganishwa na **SQL ya mkono yenye kichujio kilekile**. Kwa tarehe null inathibitishwa
kwamba kichujio kimeondolewa kweli: idadi = SQL bila kichujio, na ni kubwa kuliko ya kipindi 01–14/10.
- Pesa: muhtasari wa faida (idadi, mapato, na kichujio cha mtumiaji), muhtasari wa siku, ulinganisho, CapEx.
- Stock: muhtasari kwa aina, utafutaji 5 (pamoja na native LIMIT 500), breakdown, movement stats.
- Manunuzi: njia 3 za utafutaji (tarehe, msambazaji, bei ya chini, punguzo), takwimu za bei.
- **Kiwango cha service (6):** zinaita njia halisi zilizorekebishwa, si SingleRow ya test:
  - `SaleService.getProfitSummary`, `getSalesComparisonData`, `debugProductStock`;
  - `CapitalExpenditureService.getIntegratedSummaryStatistics`;
  - `PurchaseService.getRepurchaseTemplate`;
  - `StoreService.getMovementStatistics`.

**Control** (tests zilezile kwenye release/2.4.0 bila marekebisho, worktree ya muda imeondolewa):
- usahihi: **13 kati ya 20 zinashindwa**;
- ugunduzi: **NOT OK 9**.

Tests 7 zinazopita kwenye control ni za kiwango cha repository zinazotumia SingleRow zenyewe. Ndiyo sababu ziliongezwa tests za service.

## 4. Si sehemu ya marekebisho — uamuzi wako
- **DEAD-C7: njia 25 hazina caller yeyote** (grep -w, 03/11). Zote zinashindwa au zinarudisha safu iliyofungwa.
  Napendekeza ziondolewe kwenye C7 badala ya kurekebishwa. Orodha iko kwenye `C2QueryPgCheck.DEAD` na kwenye muhtasari.
- **KNOWN:** `StoreRepositoryExtended.getInventoryValueSummary` inasoma table `inventory_items`, ambayo haipo.
  Caller ni dashboard ya CapitalExpenditureService, inayokamata kosa. **Rekebisha au ondoa?**
- **Bug nyingine niliyoiona (sijairekebisha):** `getIntegratedSummaryStatistics` inaita safu 3 "approvedCount" na safu 4 "assetCount",
  lakini query inarudisha MIN(amount) na MAX(amount) kwenye nafasi hizo. Lebo za API si sahihi.

## 5. Gate na push
- `deploy/local/c2-check.sh` (backend) → `C2_OK 2/2`.
  - Inahitaji DB yenye data (Docker-local), kwa hiyo iko kando ya `pg-checks.sh`, ambayo hutumia DB tupu.
  - Inaongezwa kwenye gate ya staging pamoja na pg-checks + suite + run-all.
- Suite: **570/0/1**.
- `push-yote.cmd`: tawi la 4 `feature/c2-null-params` (backend) limeongezwa.
  - Dry-run ya KAGUA kwenye nakala (log ya scratchpad, jibu `x`) ilionyesha matawi 4, na la 4 ni "litaundwa MPYA". Hakuna kilichopushwa.
  - Log halisi `push-yote.log` haikuguswa.
