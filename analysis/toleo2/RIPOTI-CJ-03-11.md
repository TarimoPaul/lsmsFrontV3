# RIPOTI (cj) — 03/11/2026

nimesoma hadi (cj). Herufi tangu ripoti iliyopita (ci): **(cj)** tu.

## Bei ya kununua kwa kipande kwenye orodha ya bidhaa

**Chanzo cha thamani:** `products.last_purchase_cost`. Backend huiandika kila ununuzi unapoidhinishwa, ikiwa ni gharama/kipande
ya ununuzi huo (ni ile "Gharama/kipande" ya module ya purchases).
- Kipimo kwenye nakala ya prod 29/10: inalingana na `cost_per_piece` ya ununuzi wa mwisho (APPROVED/RECEIVED) kwa bidhaa **138/138** (tofauti 0).
- Bidhaa 3 hazijawahi kununuliwa, kwa hiyo zinaonyesha "—".
- `current_average_cost` (wastani) ni tofauti kwa bidhaa 10, kwa hiyo SIYO hiyo iliyotumika.

**Kwa nini backend iliguswa:** hakuna API ya orodha iliyokuwa ikitoa thamani hii. Njia ya pili ingekuwa kupakua manunuzi yote
kwenye V3, lakini hiyo ni **4.1 MB**, kwa hiyo haikufaa.

**Backend** `feature/bei-kununua` a1a6471 → `release/2.4.0` **8d6413f**:
- `ProductDto` imeongezewa `lastPurchaseCost` + `lastPurchaseDate` (ya kusoma tu; create/update zinanakili sehemu moja moja, kwa hiyo client haiwezi kuziweka).
- `GET /products` inazipata kupitia ModelMapper; `/purchases/repurchase/products` nayo inaziweka.
- Hakuna migration. Ukubwa wa `/products`: 279 KB → 291 KB.
- Majaribio: ProductCostDtoTest 2/0; suite **570/0/1**.
- Docker-local (image local-a1a6471): API = DB kwa bidhaa 141/141.

**V3** `feature/v3-bei-kununua` 3d2cebf → `release/3.2.0` **bf38487**:
- Column **"Kununua / kip"** iko kabla ya bei ya kuuza kipande; tarehe ya ununuzi wa mwisho iko chini ya bei.
- Column inapangika (sort), na iko kwenye CSV na PDF. Kwenye simu imo kwenye mstari wa safu.
- Inaonekana kwa wenye **PURCHASE_READ / PROFIT_REPORT / FINANCE_READ** tu, kwa sababu ni data ya gharama.
  - Kwenye nakala, kila role yenye PRODUCT_READ (CEO, Executive CEO, MANAGER) ina mojawapo ya hizo. Kwa hiyo hakuna mtu anayepoteza kuiona leo.
- Shilingi kamili (kanuni 28/09): 291.67 inaonyeshwa 292, kama ukurasa wa purchases unavyoonyesha.
- Backend ikiwa ya zamani (2.3.0), column inaonyesha "—" bila kosa.

**Majaribio (build ya production + Docker-local):**
- `bei_e2e` **14/0**:
  - CEO anaona column;
  - bidhaa 4 (44,000 / 8,166 / 1,925 / 292) = DB;
  - isiyonunuliwa = "—";
  - printer akipewa PRODUCT_READ tu (kwa muda, kisha imeondolewa) haoni column;
  - hakuna page error.
- Control: backend bila sehemu hiyo (local-baf4e31) → C3 **4 FAIL**, kwa hiyo jaribio linakamata.
- `run-all` **E2E_OK 10/10** (b1 29, b2 22, b3 38, b4 11, b5 11, bei 14, mabango 10, onyo 10, onyo_fomu 16, sababu 20).

**Hali ya Docker-local:** backend sasa ni `lsms-backend:local-a1a6471` (mti = release/2.4.0 8d6413f), na V3 inahudumia build ya
worktree `lsmsFrontV3-bei`. DB ya nakala haikurudishwa upya: ni container ya backend tu iliyobadilishwa.

Kinachofuata: C2 (kama ulivyoagiza kwenye (ci)).
