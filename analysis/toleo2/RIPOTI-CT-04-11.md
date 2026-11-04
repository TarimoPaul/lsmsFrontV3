# RIPOTI (ct) — 04/11/2026 — Freeze + orodha ya C5/C8

nimesoma hadi (ct). Herufi tangu ripoti iliyopita (cs): (ct) tu.

## 1. Freeze (ct) imeandikwa
- MAAGIZO.md: (ct) imeongezwa neno kwa neno.
- MATAWI.md: kanuni ya freeze, (1) data isiyo sahihi kwenye prod au (2) kizuizi cha deploy, na mpangilio
  C5/C8 → C6 → C7 → C9 → script ya staging → script ya prod.
- BAADA-YA-BATCH: §9 hatua 74 ("Umelipa sasa" ya zamani), §10 benki/simu zilizowashwa (kabla ya D), §11 wasambazaji wa mkopo,
  §12 deni kwa mmiliki kwa Jess.

## 2. Orodha ya C5/C8 (code ya release/2.4.0 c558a3c, V3 release/3.2.0 c12dd10, data ya nakala ya 29/10)

| # | Kipengele | Hali leo | (1)/(2)? | Uamuzi kwa freeze |
|---|---|---|---|---|
| C5a | Movements za reco → benki/simu/sefu (Toleo 2 §2.2) | Hazijajengwa | Hapana. Ni hali ya zamani; reco haisomi GL; inahitaji D | **BAADA §13** (siku 3–4) |
| C5b | Kusafisha purchases zisizo PAID (2.af) | Haijafanyika | Rekodi za zamani: hapana. Rekodi MPYA: **ndiyo (1)**, tazama §3 | Za zamani: **BAADA §15**. Mpya: **batch** |
| C5c | Maelezo ya supplier payment (M-9, 2.ae) | Hakuna endpoint (GET/POST/DELETE tu) | Hapana | **BAADA §14** (saa 2–3) |
| C5d | Cache ya status (2.ak) | **IMEKAMILIKA** kwenye A2: token_version, kwa hiyo kuzima / kufuta / password / role → token ya zamani 401 mara moja; /auth/refresh na /validate pia | — | Hakuna kazi |
| (2.12) | Password ya root bila default | **IMEKAMILIKA**: `${ROOT_PASSWORD:}` kwenye properties zote mbili na `@Value("${root.password:}")` | — | Hakuna kazi |
| C8a | Cash-declaration guard kwenye submit ya reco | **IPO**: `checkZeroCashGuard` kwenye submit NA review (cash 0 + formula > 1,000 → sababu lazima). V3 inatuma `zeroCashReason` | — | Hakuna kazi |
| C8b | Variance tab rework | **IPO** kwenye V3 (`recon-variance-tab.ts`, port ya VarianceTrackingTab: kwa mhudumu, kizingiti, sababu) | — | Hakuna kazi, isipokuwa ukitaja kinachokosekana |
| C8c | Audit ya kuidhinisha capex | Approver anatoka kwenye session (si client), kuna maker-checker, na approved_by/at + reason viko kwenye safu. Hakuna historia ya audit_trails | Hapana | **BAADA §16** |
| C8d | Recos za zamani zenye variance bila maelezo | Hakuna status REVIEWED kwenye nakala (APPROVED 142, DRAFT 3). APPROVED zenye variance ≠ 0 bila maelezo: **9, jumla ya \|variance\| 5,550** (19/06–23/09), zote ndogo. **DRAFT 16/06: 460,000 bila maelezo** | Hapana | Hakuna code. 16/06 ni uamuzi wako; haiko kwenye batch |

**Matokeo:** kwenye C5/C8 hakuna code ya kujenga, isipokuwa kosa jipya la §3.

## 3. Kosa jipya: ununuzi bila msambazaji unaandikwa UNPAID — linatimiza (1)
- `Purchase` (prePersist/preUpdate) inaweka `payment_status` kutoka `amount_paid`. Ununuzi bila msambazaji hautumi `amountPaid`,
  kwa hiyo unahifadhiwa **UNPAID / amount_paid 0**. Lakini GL inauandika kama umelipwa wote (Cr 1000, au chanzo cha C3).
- Nakala ya 29/10: Oktoba **298 / 36,379,452** ziko hivyo, na zinaongezeka ~300 kwa mwezi. C3 haikubadilisha hili.
- Athari leo: hakuna skrini inayosoma safu hiyo kwa ununuzi bila msambazaji (AP inachuja `supplier_uid IS NOT NULL`; V3 haionyeshi
  paymentStatus ya ununuzi). Lakini ni data isiyo sahihi inayoandikwa kila siku kwenye prod, kwa hiyo inatimiza (1).
- Rekebisho (batch, kadirio saa 1–2): ununuzi bila msambazaji → `amount_paid` = jumla, `payment_status` PAID wakati wa kuunda,
  kama GL inavyouandika. Edit ya rekodi ya zamani haibadilishi hali yake. Majaribio: unit + PG check + suite.
- Rekodi za zamani hazibadilishwi (§15).
- **Hatua inayofuata:** rekebisho hili, kisha C6. Ukisema BAADA, nitaruka moja kwa moja kwenda C6.
