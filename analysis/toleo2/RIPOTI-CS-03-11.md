# RIPOTI (cs) — 03/11/2026 — C3 toleo dogo: chanzo cha malipo kwa msambazaji

nimesoma hadi (cs).

**Imekamilika, lango kamili limepita, na imeunganishwa (fast-forward):**
- backend `release/2.4.0` = **c558a3c**;
- V3 `release/3.2.0` = **c12dd10**.

## Muda (kadirio upya)
Ulikuwa umekadiria 1.25 siku kwa toleo kamili; toleo dogo limechukua **chini ya siku 1**, leo. Kilichobaki si code:
staging ya kifurushi (script moja), na sehemu ya pili (reco), ambayo sasa iko BAADA-YA-BATCH §8.

## Kilichojengwa
**Chanzo cha lazima, bila default:** Droo / Benki (CRDB 1020, NMB 1021, NBC 1022, Selcom 1023, PCB 1024) / Simu (M-Pesa 1030,
Tigo 1031, Halopesa 1032, Airtel 1033) / Mmiliki. Benki na Simu zinachaguliwa kwenye orodha; hakuna maandishi tena.

| | kabla ya `gl_config.bank_cutover_date` (au haijawekwa) | kuanzia D |
|---|---|---|
| DROO | Cr 1000 | Cr 1000 |
| BENKI / SIMU | Cr 1000 (chanzo + akaunti vinahifadhiwa) | Cr akaunti halisi |
| MMILIKI | Cr **2300** "Deni kwa mmiliki - Paul" | Cr **2300** (kamwe si 3000) |

- **Inahitajika wapi:**
  - "Lipa" msambazaji;
  - ununuzi unaolipwa sasa (bila msambazaji aliyesajiliwa = ununuzi wote; vinginevyo kiasi cha "Umelipa sasa");
  - kuhariri ununuzi, ambapo inakaguliwa kabla entity haijaguswa;
  - agizo la "Nunua tena" (chanzo kimoja kwa agizo lote).
- **Migration ndani ya V138** (bado haijaenda prod):
  - `payment_source` + `source_account` kwenye `supplier_payments` na `purchases`, zote nullable;
  - akaunti **2300** (pia kwenye GlChartInitializer);
  - imejaribiwa kwenye dump ya prod 29/10: V134 → V138, 0 zilizoshindwa, TB 0.
- **Rekodi za zamani hazibadilishwi.** Safu bila chanzo zinaandikwa GL kwa njia ya zamani: CASH 1000, BANK_TRANSFER 1020, n.k.
- **Reco haiguswi.** Macheda anaandika manunuzi ya droo kwenye reco kama leo.
- Taarifa ya msambazaji na maelezo ya ununuzi zinaonyesha chanzo ("Benki · NMB", "Mmiliki").

## Mambo 2 yaliyogunduliwa njiani
1. **Kiasi cha "Umelipa sasa" kwenye fomu ya ununuzi kilikuwa kinapotea.** `createPurchaseEntity` haikunakili `amountPaid`.
   - Tangu Julai hakuna ununuzi wenye msambazaji na amount_paid > 0 (2–6 kwa mwezi), kwa hiyo deni (AP) lilibaki lote.
   - Nimerekebisha kwa sababu ni sehemu ya "malipo wakati wa kununua"; ina test yake.
2. **Karibu ununuzi wote wa sasa hauna msambazaji aliyesajiliwa** (~300 kwa mwezi, 36M Oktoba), kwa hiyo GL inauhesabu umelipwa wote sasa.
   - Agizo la "Nunua tena" linatuma jina la msambazaji tu, bila uid.
   - Ndiyo sababu chanzo kinahitajika kwenye agizo hilo pia.

## Majaribio
| Jaribio | Matokeo |
|---|---|
| `PaymentSourceTest` (lazima, orodha, D pande zote, 2300) | 5/0 |
| `SupplierPaymentSourceTest` (lipa: bila chanzo hakuna save/GL; chanzo kinahifadhiwa; ununuzi unaolipwa sasa; amountPaid inabaki) | 7/0 |
| `C3SourcePgCheck` (PG halisi, PostingEngine: kabla/kwenye/baada ya D, D haijawekwa, MMILIKI, rekodi za zamani; ndani ya pg-checks.sh) | 6/0 |
| ↳ control: PostingEngine inapuuza chanzo | 3 zimekamatwa |
| Suite ya backend | 588/0/1 |
| pg-checks all | 8/8 |
| c2-check | 2/2 |
| `payment-source.spec` (V3) | 3/3 |
| `c3_e2e` (UI "Lipa", ununuzi bila msambazaji, agizo la Nunua tena, API pande zote za D, usafi hata baada ya crash) | 22/0 |
| ↳ control: backend ya kabla ya C3 | inashindwa |
| run-all (11, pamoja na onyo + onyo_fomu, sasa zinachagua Droo) | E2E_OK 11/11 |

Kumbuka: pg-checks na c2-check ziliendeshwa kwa faili la prefix la kubuni (`LSMS_KINGA_HASH`), kwa sababu hatua 73 bado haijaendeshwa.

## BAADA-YA-BATCH
- §8 (mpya): mstari wa auto wa droo kwenye reco + kuondoa uandishi wa mkono, bila kuhesabu mara mbili.
- 1010: BAADA (§1).
