# MUUNDO C3 — chanzo cha malipo ya msambazaji (03/11/2026) — UNASUBIRI UAMUZI

Agizo (be): "C3 Chanzo cha malipo ya msambazaji: chaguo linaloonekana (droo/benki/mmiliki)."
Hakuna code iliyoandikwa bado. Kipengele hiki kinagusa GL na reco ya droo, kwa hiyo kwanza muundo + maswali 4.

## 1. Hali ya leo (code ya release/2.4.0 5abe484 + dump 29/10, nakala ya Docker-local, kusoma tu)

**A. Malipo ya msambazaji** (Wasambazaji → "Lipa"; `SupplierPaymentService.recordPayment` → `PostingEngine.postSupplierPayment`):
- Journal: Dr 2000 / Cr akaunti inayotokana na **`paymentMethod` peke yake** (`AccountMapper.getCashAccountCode`).
- V3 inauliza Njia (CASH / BANK_TRANSFER / MOBILE_MONEY), na "Mtoa huduma" kama **maandishi huru** ("CRDB, NMB…").
  GL haisomi maandishi hayo, kwa hiyo:
  - BANK_TRANSFER → **1020 CRDB daima**, hata kama yalitoka NMB (1021), NBC (1022), Selcom (1023) au PCB (1024);
  - MOBILE_MONEY → **1030 Vodacom daima**;
  - CASH → **1000**, lakini reco ya droo **haiyaoni**: si sehemu ya `purchasesTotal` wala `expensesTotal`. Kama pesa ilitoka droo,
    reco ya siku ile inaonyesha upungufu. Kama ilitoka mfukoni mwa mmiliki, 1000 inapungua bila pesa kutoka dukani.
- Hakuna chaguo la "mmiliki alilipa kwa pesa yake".
- Dump 29/10: malipo 13 (CASH 11 = 7,034,443; BANK_TRANSFER 2 = 264,664). Kati ya hayo, 8 ni Oktoba = 6,817,443.

**B. Malipo wakati wa kununua** (`purchases.amount_paid`, `PostingEngine.postPurchase`):
- Journal: Dr 1200 / **Cr 1000 daima** kwa kiasi kilicholipwa, Cr 2000 kwa kilichobaki. Hakuna njia wala chanzo kinachoulizwa.
- Dump 29/10, ununuzi wenye msambazaji na amount_paid > 0: 875 = 97,648,679. Ununuzi bila msambazaji (umelipwa wote papo hapo): 1,318 = 156,793,507.
- Reco ya droo ina tab yake ya "Ununuzi" (`reconciliation_purchases`, 60 = 6,693,500), lakini **0 kati ya hizo zimeunganishwa na purchase halisi**
  (`purchase_uid` tupu). Kwa hiyo hazihusiani na journal ya ununuzi.

## 2. Pendekezo
Kila malipo kwa msambazaji yanakuwa na **CHANZO cha lazima, bila default**. Mtumiaji lazima achague, na chaguo linaonekana kwenye risiti/taarifa:

| Chanzo | Inauliza pia | Journal (malipo ya deni: Dr 2000; ununuzi: Dr 1200) | Reco ya droo |
|---|---|---|---|
| **DROO** (pesa ya mauzo kwenye droo) | — | Cr **1000** | **Inaingia** kwenye reco ya siku hiyo kama mstari wa auto "Malipo kwa msambazaji (droo)" na inapunguza pesa inayotarajiwa, kama mikopo ya POS inavyoingia. Reco ya siku hiyo ikiwa imeshaidhinishwa → **inakataliwa** (kanuni ileile ya kufuta sale). |
| **BENKI / SIMU** | akaunti halisi (orodha: CRDB 1020, NMB 1021, NBC 1022, Selcom 1023, PCB 1024, Vodacom 1030, Tigo 1031, Halopesa 1032, Airtel 1033) | Cr **akaunti hiyo hasa** | haiingii |
| **MMILIKI** (pesa ya mfukoni mwa mmiliki) | — | Cr **3000 Mtaji wa Mmiliki** (mchango wa mmiliki) | haiingii |

- Rekodi za zamani hazibadilishwi (forward-only, hakuna backfill). Ripoti ya rekodi za zamani zenye BANK_TRANSFER/CASH inabaki kama ilivyo.
- Migration 1: `source` (+ `source_account`) kwenye `supplier_payments` na `purchases`, nullable kwa rekodi za zamani. API mpya inazihitaji.
- V3: kwenye fomu ya "Lipa" na fomu ya ununuzi, vitufe 3 vikubwa (Droo / Benki-Simu / Mmiliki), na dropdown ya akaunti kwa Benki.
  Chanzo kinaonekana kwenye orodha na taarifa ya msambazaji.
- Majaribio: journal kwa kila chanzo = akaunti sahihi; DROO inapunguza expectedCash ya reco ya siku hiyo; DROO kwenye reco iliyoidhinishwa
  inakataliwa; kufuta malipo kunarudisha GL na mstari wa reco; bila chanzo → 400; mutation; E2E ya fomu.

## 3. Maswali kwa mmiliki
1. **Upeo:** C3 iguse (a) malipo ya msambazaji **na** malipo wakati wa kununua, au (b) malipo ya msambazaji tu?
   **Napendekeza (a).** 254M ya ununuzi inaandikwa Cr 1000 bila kuuliza chanzo, wakati malipo ya msambazaji ni 7.3M tu.
   (a) ni kubwa zaidi: makadirio 1.25 → takriban 2.5 siku.
2. **DROO na reco:** (a) mstari wa auto kwenye reco ya siku (napendekeza), au (b) GL tu bila reco? Kwa (b), reco itaendelea kuonyesha upungufu.
3. **MMILIKI:** Cr 3000 Mtaji (mchango, haurudishwi; napendekeza), au deni kwa mmiliki (akaunti mpya ya 2xxx, linalipwa baadaye)?
4. **Bahasha ya akiba ya mkopo** (BAADA-YA-BATCH §1, 1010): iwe chanzo cha 4 sasa, au isubiri §1?
   **Napendekeza isubiri §1**, kwa sababu 1010 bado haina journal ya kila siku.
