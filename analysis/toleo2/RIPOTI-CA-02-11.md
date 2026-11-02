# RIPOTI (ca) — 02/11/2026

nimesoma hadi (ca). (ca) ilifika baada ya (cb), na sasa iko kwenye MAAGIZO.md. Herufi tangu ripoti iliyopita: (ca).

## 1. HENNESY ce1fd75d — kwa nini ripoti iliona 2 wakati current_stock ni 0

Mwendo wake wote (nakala 29/10; ni data ya Julai, sawa na prod):

| id | aina | idadi | kabla → baada | movement_date | iliandikwa (created_at) |
|---:|---|---:|---|---|---|
| 2349 | ADJUSTMENT | +1 | 0 → 1 | 29/03 21:14 | 29/03 21:14 |
| 9123 | PURCHASE | +1 | 1 → **2** | **01/07 21:33** | 01/07 18:34 |
| 9124 | ADJUSTMENT | −1 | 2 → 1 | 01/07 18:36 | 01/07 18:36 |
| 9125 | SALE | 1 | 1 → **0** | 01/07 18:42 | 01/07 18:42 |

**Chanzo: ni tarehe ya mwendo.**
- Ununuzi uliandikwa 18:34, lakini `movement_date` yake ni 21:33. Mwendo uliofuata (−1, kisha mauzo) una tarehe za mapema zaidi.
- `stock_after` ni mnyororo kwa mpangilio wa kuandikwa (id). `stockValueAt` ilipanga kwa `movement_date`, kwa hiyo ilichukua 2 ya ununuzi badala ya 0 ya mauzo.

**Marekebisho (batch):** backend feature/stock-value-order → release/2.4.0 **68fe8b2**.
- Kwa kila bidhaa, chukua mwendo wa mwisho **kwa id** wenye tarehe ≤ siku hiyo.
- Kisha toa mwendo wowote ulioandikwa mapema zaidi (id ndogo) lakini wenye tarehe baada ya siku hiyo.
- Marekebisho ya mauzo ya tarehe ya nyuma (`corr`) hayajaguswa. Gharama bado ni ile ile ya ripoti (last purchase cost); kuhamia avg ni BAADA §2a.

Majaribio:

| Jaribio | Matokeo |
|---|---|
| Nakala, siku ya leo, bidhaa zote | Njia ya zamani: bidhaa 1 (HENNESY) ≠ `current_stock`, tofauti 70,000. Njia mpya: **0** |
| `StockValuePgCheck` mpya (PG15 tupu) | HENNESY: 30/06 = 1, 01/07 = 0. Bidhaa F (ununuzi umeandikwa mapema, tarehe ya baadaye): 15/07 = 3, 25/07 = 6. **PASS** |
| Control: `stockValueAt` ya zamani | **FAIL** (inakamatwa) |
| Gate | Sasa **PG_CHECKS_OK 4/4** (check imeongezwa kwenye `pg-checks.sh`) |

MATAWI.md bado inasema 3/3; nitairekebisha nikigusa faili hilo.

## 2. Ukurasa wa Store "Thamani ya mzigo" — MAREKEBISHO ya dai langu la (bz)

**Ukurasa tayari unatumia Σ stock × current_average_cost.** Hauhitaji badiliko.
- `/api/store/display/stock/summary` inapata gharama kutoka `batchLoadValuationCost` (tangu 30/09): `current_average_cost`, kisha wastani wa miezi 6 kama mbadala tu.
- Kwenye (bz) niliandika kwamba ukurasa unatumia wastani wa miezi 6 na unatoa 0. **Hilo lilikuwa kosa.**
  - Nilisoma `createProductStockSummary(product, stock)` (StoreService:2829), njia ambayo ukurasa hautumii.
  - Kwa hiyo namba "ukurasa wa Store 4,353,175.26" ya (bz), na mstari wa ukurasa wa Store kwenye log ya 66, hazikuwa namba za ukurasa.

Jaribio uliloomba (Docker-local, dump 29/10):
- Jumla ya ukurasa, kama V3 inavyojumlisha (Σ max(0, stock) × averageCostPrice), ni **5,385,695.35**. Daftari ni **5,385,695.35**. Tofauti **0.00**.
- Bidhaa zilizopo zenye thamani 0: **0**.
- Hakuna bidhaa isiyo active yenye stock.
- Matokeo ni yaleyale kwenye image ya zamani 7c469e8, kwa sababu ukurasa ulikuwa sahihi tayari.

Nilianza kubadilisha StoreService kabla ya kugundua hili. Badiliko hilo limeondolewa (revert); halikufika release/2.4.0.

## 3. Mengine

- **66 / 1200:** sawa. Hakuna uchunguzi zaidi. Cutover D itafunguliwa kwa Σ stock × avg.
- **65:** imefungwa; hakuna hatua ya ziada.
- **Gate kwenye release/2.4.0 68fe8b2:**

| Sehemu | Matokeo |
|---|---|
| Suite | 560/0/1 |
| PG_CHECKS_OK | 4/4 |
| Image local-68fe8b2: ukurasa = daftari | 2/0 |
| E2E | **6/6** kwenye mzunguko wa pili |

  Mzunguko wa kwanza wa E2E ulikuwa na b1 D3/D4 FAIL (kagua la mauzo yaliyofutwa, mara ya kwanza baada ya nakala safi). Nilirudia bila kubadilisha chochote, ikapita 27/0. Jaribio hili linaonekana kubadilika-badilika; nitalifuatilia likijirudia.
- **Docker-local** sasa ni nakala safi + local-68fe8b2, pamoja na data ya e2e.

Inayofuata: onyo la manunuzi ("kreti au chupa?"), kisha B5.
