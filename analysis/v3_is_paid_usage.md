# `is_paid`: matumizi yake na marekebisho yaliyofanyika (2026-10-03)

## Kanuni mbili (zimehakikiwa kwenye backup ya prod ya 30/09)

1. **`reconciliation_retail_debts.is_paid`** inamaanisha **"lililipwa kufikia mwisho wa siku ya recon hii"**.
   - Imeundwa hivyo kwa makusudi (marekebisho ya 2026-07-19, "paidAsOf").
   - Deni la POS lina safu moja kwenye kila recon ambayo bado halijalipwa (safu 236 kwa sales 203), na kila safu ina hali yake ya siku hiyo.
   - Kwa hesabu za recon ya siku D (makato, uhakiki), `is_paid` ni **sahihi na ibaki**.
2. **"Je, linadaiwa sasa?"**: tumia **`sales.outstanding_balance`**.
   - Ndiyo `/api/reports/ar` (`v_accounts_receivable`) inatumia, na GL pia.
   - Kwa **sales zote 416** zenye deni, `sales.outstanding_balance` = jumla − Σ `payments.amount_paid` − marekebisho yaliyoidhinishwa. Hakuna hata moja inayotofautiana.

### ⚠️ Sahihisho la nilichoandika awali
Niliandika kwamba "`payments.outstanding_balance` ndiyo ukweli". **Hiyo si sahihi.**
- Malipo ya deni yanayopokelewa baadaye yanaongeza **safu mpya ya payment** (PAID, salio 0). Safu ya awali ya UNPAID (salio kamili) inabaki kama ilivyokuwa.
- Kwa hiyo `SUM(payments.outstanding_balance)` inaonyesha madeni yaliyolipwa kama bado yanadaiwa.
- Prod 30/09: sales 11, **+345,500**: 1,955,500 badala ya 1,610,000. Sales 8 kati ya hizo ni walk-in zilizolipwa kati ya 24 na 29/09, na moja ni deni la 3,000 lililofutwa kwa CORRECTION.

**Matokeo kwa uchambuzi wa zamani:** ripoti za 30/09 na 01/10 (`v3_ordering_findings.md`), pamoja na mpango wa faida, zilitaja AR ya ~1.90M ambapo walk-in ni 92%. Kipimo sahihi:
- AR tarehe 29/09 ni **1,646,000** (ripoti ya AR);
- walk-in ni **1,455,500 (88%)**.

## Mahali `is_paid` inatumika, na hatua iliyochukuliwa

| # | Mahali | Maana inayohitajika | Hatua |
|---|---|---|---|
| 1 | `DailyReconciliation.recalculateTotals` (`retailDebtsTotal`, `pos/manualDebtsTotal`) | Hali ya siku D | Imebaki |
| 2 | `ReconciliationService.firstUnverifiedSection` | Hali ya siku D | Imebaki |
| 3–6 | `ReconciliationService` `autoPopulateCreditDebts` (POS, walk-in, sweep), `addRetailDebt` | Hizi ndizo zinazoandika thamani | Zimebaki |
| 7 | `ReconciliationService.toDebtDto` → `settledAfterDay` ("Imelipwa baadaye") | Siku D + hali ya sasa | **Imebaki kwenye `sales.outstanding_balance`** (ilikuwa sahihi tayari). Nimeongeza onyo kwenye `fetchSaleInfo` lisibadilishwe kwenda jumla ya payments. |
| 8 | `CustomerService.getCustomerActivity` → tukio `RECON_DEBT` | Hali ya sasa | **Imerekebishwa** (maelezo hapa chini) |
| 9 | `ReconciliationRetailDebtRepository.findUnpaidByReconciliation` | — | **Imefutwa** (haikutumika popote) |
| 10 | Migrations V097, V098, V112 | — | Hazijaguswa |
| 11–14 | V3: `reconciliation.models.ts`, `recon-approval-tab.ts`, `recon-debt-dialog.ts` | Hali ya siku D | Zimebaki |
| — | V3: haikuwa inasoma `settledAfterDay` | | **Imeongezwa** (maelezo hapa chini) |

### #8 Historia ya mteja (`GET /api/v1/customers/{uid}/activity`)
Mabadiliko matatu:
- **Tukio moja kwa kila sale.** Linatumia safu ya kwanza, yaani kiasi kama lilivyotolewa. Zamani kila safu ya recon ilikuwa tukio lake.
- **Hali inatoka `sales.outstanding_balance`:** PAID / PARTIAL_PAYMENT / UNPAID. Safu za zamani zisizo na sale zinabaki kutumia `is_paid`.
- **Malipo yanaonyeshwa mara moja**, si mara moja kwa kila safu ya recon.

Pia kosa la null-parameter limerekebishwa: wateja wasio na namba ya simu walikuwa wanapata kosa, na madeni yao yalikuwa yanapotea kimya kimya.

Jaribio kwenye nakala, sale 830fceb2 yenye safu mbili za recon:
- zamani: matukio 2 ("PAID" 134,000 na "UNPAID" 79,000);
- sasa: tukio 1 (134,000 PAID) na malipo 1.

**Kumbuka:** kwenye data ya prod hakuna mteja hai mwenye madeni yanayolingana kwa simu tu. Kwa hiyo njia hii haionekani mara nyingi. Ilijaribiwa kwa kumrejesha mteja aliyefutwa, kwenye nakala ya muda tu.

### V3: beji "Imelipwa baadaye"
- Iko kwenye tab ya **Idhini → Thibitisha kila kipengele**, kwa madeni yasiyolipwa siku ya recon ambayo mteja amelipa baadaye.
- Ni taarifa tu, na makato ya siku hiyo hayabadiliki.
- E2E `paidlater-e2e.mjs` 6/6 (recon 0a16900f ya 31/07: madeni 3, 2 yamelipwa baadaye).

### Endpoint ya faida (`/api/reports/daily-pnl`)
- Ilikuwa inatumia `SUM(payments.outstanding_balance)`. **Sasa inatumia `sales.outstanding_balance`.**
- Imeongezewa sales 2 za Mei (36,000) zilizotangulia rekodi za madeni kwenye recon. Kwa hiyo AR yake = ripoti ya AR.
- E2E `profit-e2e.mjs` 25/25, ikiwemo ukaguzi wa `arNow = /api/reports/ar`.
