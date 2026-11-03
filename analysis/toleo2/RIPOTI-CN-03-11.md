# RIPOTI (cn) — 03/11/2026 — C2 imefungwa, imeunganishwa kwenye release/2.4.0

nimesoma hadi (cn).

## 1. Maagizo matatu
1. **Njia 25 zilizokufa → C7.** Hazijaguswa. `getInventoryValueSummary` imeongezwa kwenye orodha (sasa 26), kwa sababu
   caller wake hapitii tena kwake.
   - Jaribio jipya `deadMethodsHaveNoCallerInSrcMain` linathibitisha kwamba kila njia ya DEAD kweli haina caller.
   - Control: njia hai (`getProfitSummaryRaw`) iliwekwa kwa muda kwenye DEAD na **ilikamatwa**.
2. **`getInventoryValueSummary`** (`/api/v1/dashboard/inventory-value` na `/dashboard/complete`):
   - Sasa ni Σ stock × gharama ya kuthamini, kutoka chanzo kilekile cha ukurasa wa Store na daftari la 1200
     (`StoreService.batchLoadStock` + `batchLoadValuationCost`).
   - Zamani ilisoma `inventory_items`, table ambayo haipo, kwa hiyo ilishindwa kila mara.
   - `/dashboard/complete` ilikuwa ikitupa kosa kila mara, kwa sababu `Map.of` ilipewa thamani null.
   - Test `svc7`: thamani = SQL ya mkono Σ current_stock × current_average_cost = `getCurrentInventoryValue` ya ukurasa wa Store.
     Imethibitishwa pia: idadi ya bidhaa, zilizoisha, low stock (0 < stock ≤ 10) na top 10.
   - Build hai, nakala safi ya dump 29/10: endpoint = **5,385,695.35** = SQL.
3. **CapEx `getSummaryStatistics`:** query sasa inarudisha idadi halisi.
   - `approvedCount` = status APPROVED (2390); `assetCount` = is_asset (9).
   - MIN na MAX sasa zinaitwa `minAmount` na `maxAmount`.
   - V3 haizitumii, na njia hii (`getIntegratedSummaryStatistics`) haina endpoint yoyote. Hakuna mtumiaji atakayeona tofauti.
   - Test `svc4`: idadi zote mbili = SQL, ni tofauti (kwa hiyo zikibadilishana zitakamatwa), na min/max = SQL.

## 2. Lango kamili (kwenye commit 3ab2b3b)
| Jaribio | Matokeo |
|---|---|
| Suite ya backend | 570/0/1 |
| `pg-checks.sh all` | PG_CHECKS_OK 7/7 |
| `c2-check.sh` (ugunduzi + usahihi) | C2_OK 2/2 (usahihi 21/0; NOT OK 0) |
| Image `lsms-backend:local-3ab2b3b` + nakala safi ya dump 29/10 | Flyway 138, 0 zilizoshindwa |
| V3 release/3.2.0 bf38487, `run-all` | E2E_OK 10/10 (PASS 181, FAIL 0) |

Kuhusu pg-checks: jaribio la kwanza lilitoa errors kwa kila check, "Illegal base64" ya JWT.
- Sababu: secret za majaribio hazikuwa kwenye env. Si kosa la code.
- Baada ya kuexport `JWT_SECRET` na `ROOT_PASSWORD` za `.siri`: 7/7.

**Kuunganisha:** `release/2.4.0` imesogezwa kwa fast-forward hadi **3ab2b3b**, kwa hiyo build iliyojaribiwa ndiyo hasa iliyounganishwa.

## 3. Muhtasari (badala ya diff)
- **Faili 11:** 8 za code, 2 za test, na script 1 (`deploy/local/c2-check.sh`).
- **Njia hai 19** zimerekebishwa:
  - 6 za pesa: faida, muhtasari wa siku, ulinganisho, CapEx stats, thamani ya stock, takwimu za bei za repurchase;
  - 8 za stock: utafutaji 5, muhtasari kwa aina, breakdown, movement stats;
  - 3 za manunuzi: utafutaji 3;
  - 2 zinazotumikia skrini nyingine: debugProductStock na getComprehensiveDashboardStats.
- Njia 26 zilizokufa zinasubiri C7.

### Skrini ambazo namba zake zitabadilika baada ya deploy
**V3: hakuna.** V3 ilikuwa tayari inakwepa njia hizi:
- Faida inahesabiwa na profit-panel yenyewe, kwa sababu `/profit-summary` ilirudisha 0.
- Store inazunguka `display/search`.
- Ukurasa wa repurchase unasoma tarehe ya ununuzi wa mwisho tu, na hiyo haikuwa imevunjika.

API zinazobadilika, ambazo hakuna skrini ya V3 inayozitumia:
- `/api/v1/sales/profit-summary`: sasa inarudisha namba halisi, si 0.
- `/api/store/display/search`, `/api/v1/purchases/search`, `/search/advanced`, `/date-range/supplier`: zinafanya kazi, zamani zilishindwa.
- `/api/store/analytics/movement-stats/{uid}`: inarudisha namba (safu bapa ya 5).
- `/api/v1/dashboard/inventory-value` na `/complete`: zinafanya kazi.

**Chief anaweza kuwaambia watumiaji:** huenda wakaanza kupokea notification mpya ya **"Muhtasari wa Mauzo: <tarehe>"**, kwa wenye SALES_READ.
- Zamani haikutumwa kamwe.
- Cron yake ni 00:00 EAT, saa ileile EC2 huzimwa, kwa hiyo huenda isionekane hata baada ya deploy.

## 4. Push
`push-yote.cmd` ina matawi 4: release/2.4.0 (sasa 3ab2b3b), release/3.2.0, V3 main, na feature/c2-null-params.
Mimi sipushi.
