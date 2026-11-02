# Ripoti (br) — 02/11/2026

nimesoma hadi (br). Herufi tangu ripoti iliyopita (B4 + daraja): (br) tu.

Data zote hapa zinatoka nakala ya Docker-local (dump lsms_20261029_1027, PG15), kusoma tu. Prod haikuguswa.

## 1. Punguzo 4010 (133,500) — sale moja ya mfano

Oktoba ina sale 3 zenye punguzo, jumla 133,500 (= 4010 ya GL).

**Sale 061026-1933 (06/10, CASH, PAID):**

| | Kiasi |
|---|---:|
| Mistari (subtotal) | 300,000.00 |
| Punguzo la sale | 20,000.00 |
| Total ya sale | 280,000.00 |
| Pesa iliyopokelewa (payments, CASH 06/10) | 280,000.00 |
| Gharama (COGS, mistari 6) | 283,391.56 |

Mistari ya GL (SALE_CASH, 06/10):

| Akaunti | Dr | Cr |
|---|---:|---:|
| 1000 Cash | 280,000.00 | |
| 4010 Punguzo | 20,000.00 | |
| 4000 Mauzo | | 300,000.00 |
| 5000 COGS | 283,391.56 | |
| 1200 Stock | | 283,391.56 |

- **Ripoti ya uendeshaji (kabla ya br):** mauzo = 300,000, kwa sababu ilijumlisha mistari tu na kusahau punguzo la sale.
  **Ilikuwa imekosea**, kwa 20,000 kwenye sale hii na 133,500 kwa Oktoba nzima.
- **GL:** mauzo halisi = 4000 − 4010 = 280,000. **Iko sahihi.**
- **Marekebisho (batch):** ripoti ya uendeshaji sasa inahesabu mauzo = mistari − punguzo la sale. Hii inatumika pia kwa
  margin ya mwezi na faida ndani ya madeni.
  - Commits: 045d91f + e0f423c, release/2.4.0.
  - PG test: PnlBridgePgCheck. Sale D yenye punguzo 4,000 inatoa mauzo 21,000, na isiyoelezeka ni 0.
  - Mutation: kuondoa punguzo kunakamatwa.

**Angalia (sijabadilisha kitu):** sale zote 3 zenye punguzo ziliuzwa **chini ya gharama**. Jumla ya hasara ni −103,841.22.

| Risiti | Mistari | Punguzo | Total | Gharama | Faida |
|---|---:|---:|---:|---:|---:|
| 061026-1933 | 300,000 | 20,000 | 280,000 | 283,391.56 | −3,391.56 |
| 101026-2202 | 68,000 | 13,500 | 54,500 | 63,899.76 | −9,399.76 |
| 101026-2209 | 114,500 | **100,000** | 14,500 | 105,549.90 | **−91,049.90** |

Sale 101026-2209 ina punguzo la 87%. Huenda kiasi kiliandikwa kama punguzo badala ya deni au malipo ya sehemu. Mmiliki athibitishe.

## 2. 4900 (57,486.54) — journal za Oktoba kwa chanzo

| Chanzo (reference_type / prefix) | Idadi | Jumla |
|---|---:|---:|
| STAFF_LIABILITY_CHARGE / `COUNT:` | 37 | 57,486.54 |

- Chanzo ni kimoja tu: upungufu wa hesabu ya stock uliotozwa wafanyakazi, kati ya 12/10 na 29/10.
- Journal hizo 37 kwa pamoja zinaandika:
  - Dr 1120 (madai kwa wafanyakazi) 572,767.61, ambayo ni bei ya kuuza;
  - Cr 1200 (stock) 515,281.07, ambayo ni gharama;
  - Cr 4900 57,486.54, ambayo ni tofauti kati ya hizo mbili (margin).
- Sijabadilisha kitu.
- Kwenye daraja, 4900 ni mstari MAPATO_MENGINE. Si timing, kwa sababu ripoti ya uendeshaji haihesabu madai ya wafanyakazi kama mapato.
  Ikiwa unataka iingie kwenye ripoti ya uendeshaji pia, niambie.

## 3. Ripoti ya uendeshaji: mistari ya 6700, 6110/6120, DMG, 6600 — IMEFANYIKA (chini ya nusu siku)

"Jinsi faida halisi inavyopatikana" sasa ina mistari hii kabla ya Faida halisi. Inasomwa kutoka GL kwa tarehe ya journal,
kwa masharti yaleyale ya daraja (journal za mkono hazihesabiwi; 5100 ya hesabu za stock haiingii hapa):

| Mstari | Oktoba (nakala) |
|---|---:|
| − Upungufu wa droo (6700) | 61,300.00 |
| − Madeni yaliyosamehewa (6110/6120) | 13,000.00 |
| − Upotevu nje ya hesabu (5100, DMG) | 31,500.00 |
| − Riba ya mikopo (6600) | 48,086.92 |

- Riba inaonekana tu baada ya setup ya mikopo A/B kama prod (b3/b4). Kwenye dump peke yake ni 0, kwa sababu dump ni ya kabla ya 2.3.0.
- Cash flow: riba na madeni yaliyosamehewa yanarudishwa juu kama uchakavu, kwa sababu hayakutoa pesa. Droo na DMG hazirudishwi.
- Jedwali la siku na export vina mistari hiyo pia.

**Daraja baada ya mabadiliko (Oktoba, dump peke yake):**

| | Kiasi |
|---|---:|
| Net ya uendeshaji | 1,976,148.99 |
| + Mapato mengine 4900 | 57,486.54 |
| + Uchakavu (timing: kila siku dhidi ya mwisho wa mwezi) | 146,012.42 |
| + Gharama za mwezi (timing) | 220,833.33 |
| − Reco tarehe (timing) | −18,000.00 |
| = Net ya GL | 2,382,481.28 |
| **Isiyoelezeka** | **0.00** |

- Mistari RIBA, DROO, MADENI_YALIYOSAMEHEWA na UPOTEVU_NJE_YA_HESABU imeondoka kwenye daraja.
- Daraja sasa lina timing pamoja na 4900 tu. Journal za mkono zinabaki kama mstari wake zikiwepo.

**Majaribio:**
- Backend:
  - DailyPnlCalculatorTest glChargesInNetAndCashFlow.
  - PnlBridgePgCheck (PG15): riba 700, droo 300, DMG 250 na msamaha 100 zipo kwenye ripoti ya uendeshaji. Dr 5100 ya mkono inabaki JOURNAL_ZA_MKONO, na isiyoelezeka ni 0.
  - Mutations 2/2 zimekamatwa: (1) riba haitolewi kwenye net; (2) journal za mkono zinahesabiwa kama DMG.
  - Suite: 559 run / 0 fail / 1 skip.
    - Kumbuka: "559" ya commit e0f423c ilijumuisha ripoti ya zamani ya PnlBridgePgCheck iliyobaki kwenye target. Idadi halisi ilikuwa 558.
  - PG_CHECKS_OK 3/3.
- V3 (production build, Docker-local): E2E_OK 5/5, yaani b1 27, b2 22, b3 38, b4 11, mabango 10.
  - b4 ina majaribio mapya mawili:
    - D6: mistari 4 = API.
    - D7: mistari inajumlika hadi Net, na Net hiyo = net ya daraja.
  - Control ya D6 dhidi ya build ya zamani haikuendeshwa kando. Build ya zamani haina mistari hiyo (data-test), kwa hiyo D6 ingeshindwa.

**Commits (hazijapushwa):**
- Backend:
  - feature/pnl-gl-lines d9b37ab → release/2.4.0 = **0d1ee71**.
  - Image ya local: lsms-backend:local-d9b37ab (sha256:2474ecf3…4ed8).
- V3:
  - feature/v3-pnl-gl-lines 2474add → release/3.2.0 = **c540ab8**.
  - V3 main: 12e8157 (BAADA §4) + ripoti hii.

## 4. BAADA-YA-BATCH §4 — malipo ya mwaka kama prepaid 1160, kabla ya 31/12

Imeandikwa:
- Dr 1160 siku ya malipo;
- amortization ya kila mwezi kwa scheduler kama ile ya 1150, yenye kinga ya replay na ya kipindi kilichofungwa;
- 2026 haiguswi.

## 5. Mengine

- Docker-local sasa ni nakala SAFI ya 29/10 1027 yenye image local-d9b37ab. Setup ya b3/b4 imeongezwa: mikopo A/B na mkopo
  wa jaribio wa b3.
- Container ya zamani `lsms-a2-pg` (PG16 ya majaribio ya A2/A3, ilikuwa imesimama) imeondolewa ili RAM ipatikane.
  pg-checks.sh inatengeneza container yake yenyewe.
- Push hashes mpya kwa push-yote.cmd: backend release/2.4.0 0d1ee71, V3 release/3.2.0 c540ab8, V3 main (commit ya ripoti hii).

**Inayofuata:** onyo la manunuzi "carton au chupa?" (B, saa 3–4), kisha B5 (vitufe vya FINANCE_WRITE).
