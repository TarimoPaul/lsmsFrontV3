# Ripoti (fc) 11/11 — 6a/6b, na ukaguzi wa kabla ya cutover D

nimesoma hadi (fc)

## 6a / 6b
- **AP-WASAMBAZAJI-6B** imeandikwa hitimisho lako: hakuna mkopo wa wasambazaji, Cr 1000 ya manunuzi ni sahihi kabla ya D, "vyote ni vya bwana" = pesa ya biashara, **hakuna marekebisho ya GL**.
- **Hatua 74** sasa ina ununuzi **18**: Grepa 02/10 (75,000, GL Cr 1000) + 17 wenye msambazaji Jun–Okt (743,464, GL Cr 2000 — AP hiyo ililipwa na malipo yasiyounganishwa; 2000 = 0).
  Wote → PAID, amount_paid = jumla, **bila journal**. Kinga kwa kila row (hali, kiasi, journal moja yenye akaunti sahihi); GL haibadiliki.
  Local: KAGUA 18 SAWA; ANDIKA 18; mara ya pili inarukwa; row iliyobadilika → inasimama bila kuandika chochote.
  `steps/74-umelipa-sasa.cmd kagua` → `andika` (ANDIKA-74), baada ya toleo 2.

## Kabla ya D — matokeo: **KOSA LA PESA LIMEPATIKANA** (kanuni ya ct-2) → limeingizwa toleo 2

| Jambo | Hali kabla ya rekebisho | Baada ya D ingekuwa |
|---|---|---|
| reco BANK_DEPOSIT (droo → NMB/Selcom) | **hakuna GL kabisa** (reco haiandiki GL) | Okt: NMB 14.39M + Selcom 1.84M zingebaki 1000 |
| reco mobile (mauzo ya CASH yaliyolipwa kwa simu) | hakuna GL | Okt: M-Pesa 5.49M + Tigo 1.70M zingebaki 1000 |
| Sefu → NMB (Safe Box BANK_DEPOSIT) | hakuna GL | Jul–Okt NMB 14.17M + Selcom 1.14M |
| Malipo ya msambazaji "Benki · NMB" | Cr 1021 (sahihi) | ~36M/mwezi Cr 1021 |

Bila rekebisho: baada ya D, 1021 ingeshuka hasi kwa mamilioni kila mwezi na 1000 ingezidi kwa kiasi hicho.

**Rekebisho** (backend `feature/t2-cutover` 8dd0a2d + 2be5211, juu ya t2-pesa): `RecoBankTransferService`
- **Kabla ya D: hakuna kinachoandikwa** (NMB/simu ni sehemu ya 1000 — kama ulivyosema).
- Kuanzia D, reco ikiidhinishwa → journal moja FUNDS_TRANSFER (RECO-TRF:uid), tarehe ya reco:
  - BANK_DEPOSIT → **Dr 102x** ya benki hiyo (NMB 1021, CRDB 1020, NBC 1022, Selcom 1023, PCB 1024);
  - mobile → **Dr 103x** (M-Pesa 1030, Tigo 1031, Halopesa 1032, Airtel 1033) **ukiondoa** mauzo ya muuzaji huyo siku hiyo yaliyolipwa
    kwa njia hiyo (hayo tayari ni Dr 103x wakati wa mauzo), na mistari iliyotokana na malipo (source_payment_uid) inarukwa — hakuna mara mbili;
  - **Cr 1000** jumla.
- Reco ikifunguliwa upya → journal inarudishwa (tarehe ya siku ile); ikiidhinishwa tena → inaandikwa tena, mara moja.
- Sefu → benki (Safe Box BANK_DEPOSIT iliyothibitishwa) kuanzia D → Dr 102x / Cr 1000 (SAFE-TRF:uid).
- Jina la benki/mtandao lisilojulikana (k.m. "CHAKULA") halibahatishwi: linaachwa na kuwekwa kwenye gl_posting_failure.
- Mauzo yaliyolipwa kwa M-Pesa (njia VODACOM) tayari ni **Dr 1030 / Cr mapato** (zamani na sasa) — sahihi.

**Majaribio** (nakala safi ya dump 29/10, **D imewekwa** = 27/10):
- unit RecoBankTransferPlanTest 4/0; suite kamili ya tawi **666/0/1**;
- `cutover_api_e2e` **7/0**: T1 reco kabla ya D → hakuna; T2 reco ya D → Dr 1021 600,000 / Dr 1030 129,000 / Dr 1031 35,000 / Cr 1000 764,000;
  T3 kufungua → imerudishwa; T4 kuidhinisha tena → mara moja, kurudisha kwa tarehe ya siku ile; T5 msambazaji "Benki · NMB" baada ya D → **Cr 1021**;
  T6 sefu → NMB → Dr 1021 / Cr 1000; TB 0.

## Kinachohitajika SIKU YA D (script ya ufunguzi, S-A)
- Journal ya ufunguzi: salio halisi la NMB / Selcom / M-Pesa / Tigo siku ya D (taarifa za benki/simu) → Dr 102x/103x / Cr 1000.
  **1030 tayari ina 163,000** (mauzo ya M-Pesa ya kabla ya D) — ufunguzi uweke 1030 = salio halisi la M-Pesa (marekebisho ya tofauti tu).
- Akaunti zilizowashwa (BAADA §10) ziwekwe kabla ya D.
- Reco za siku za kabla ya D zikifunguliwa baada ya D: hazihamishi chochote (tarehe ya reco < D) — sahihi.

## 6e (muundo unaendelea)
- Kwa kuwa droo hulipa mara chache: mstari wa auto kwenye reco = malipo/manunuzi yenye chanzo **DROO** tu; mengine (NMB) hayagusi reco.
  Muundo uliobaki uko MUUNDO-6D-6E (unasubiri majibu ya Q6d/Q6e).

## Jedwali la origin
| Agizo | Kazi | Mahali | Commit |
|---|---|---|---|
| (fc) 6a | hatua 74 = 18 PAID bila journal | steps/74-umelipa-sasa.* | (analysis) |
| (fc) 6b | hitimisho: hakuna marekebisho ya GL | toleo2/AP-WASAMBAZAJI-6B-11-11.md | — |
| (fc) D | reco/sefu → 102x/103x kuanzia D | backend feature/t2-cutover | 8dd0a2d, 2be5211 |
| (fc) D | e2e cutover (D imewekwa) | V3 deploy/local/e2e/cutover_api_e2e.cjs | cb4e895 |

## Maswali
- **Qfc-1** Tarehe ya D: script ya ufunguzi inahitaji salio la NMB / Selcom / M-Pesa / Tigo la asubuhi ya D. Pendekezo: D = siku ya kwanza baada ya
  toleo 2 kufika prod (si 14–31/12), siku ya Jumatatu, na salio la benki la jioni ya Jumapili.
- **Qfc-2** Selcom: ni benki (1023) au mtandao wa malipo? Reco inaiandika kama BANK_DEPOSIT — nimeiweka 1023.
