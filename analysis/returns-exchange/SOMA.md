# Marejesho na Kubadilisha bidhaa (Returns + Exchange) — 22/10/2026

Hali: **imeandikwa na kujaribiwa kwenye PC, HAIJACOMMITIWA.** Hakuna kilichoguswa staging wala prod.
Diffs: `backend.diff` (repo ya Lsms — faili za kazi hii tu) na `frontend.diff` (V3).
Mabadiliko mengine ambayo hayajacommitiwa ya backend (DataInitializer / UserRepository / deploy-backend.ps1 ya hotfix 2.2.72) **si sehemu ya kazi hii** na hayakuguswa.

## Backend
| # | Tatizo lililokuwepo | Marekebisho |
|---|---|---|
| B1 | `DAMAGED_RETURN` ilirudishwa stoo (`returnToStock=true` kila mara) | Zilizoharibika `DAMAGED`, hazirudi stoo, GL haiweki inventory. Kila mstari unaweza kuwekwa "imeharibika". |
| B2 | Exchange ilipuuzwa wakati wa kuidhinisha | Ombi la `EXCHANGE` linabeba `exchangeLines`; idhini inaunda mauzo mapya (bei ya kawaida ya mauzo) kwenye transaction moja. Kama stoo haitoshi, au mteja wa kawaida anaacha deni, idhini yote inarudishwa nyuma. |
| B3 | `POST /sales/exchanges` ilifanya kazi nje ya idhini na bila GL | Imezimwa (inajibu Error yenye maelezo). |
| B4 | Bidhaa moja kwenye mistari miwili ilivunja ombi | Ombi linataja `saleDetailUid`; bila hilo, vipande vinagawanywa kwenye mistari ya bidhaa hiyo. Kikomo ni kilichobaki baada ya marejesho ya awali au yanayosubiri. |
| B5 | Thamani yote ilirudishwa kama CASH, hata kwa mauzo ya mkopo, na GL ilitoa pesa ambayo haikutoka | Thamani inapunguza deni la mauzo kwanza; pesa inarudishwa tu kwa kiasi kilicholipwa. Meneja anachagua njia (`refundMethod`) na GL inatumia akaunti ya njia hiyo. |
| B6 | Recon ilitoa `refundAmount` ya tarehe ya ombi, kwa muuzaji wa mauzo ya awali (marejesho ya siku hiyohiyo yalihesabiwa mara mbili) | Inatoa CASH iliyorudishwa kweli, siku ya idhini, kwa aliyeomba, na kwa mauzo ya siku za nyuma tu. |
| B7 | Sale DTO ilitumia `Optional` → mauzo yenye marejesho 2+ yalionekana "hayana marejesho"; full return iligawanya kwa 0 | Flags zinatoka kwenye marejesho yote; sehemu mpya `returnType`, `hasExchange`, `returnCount`. |
| B8 | `requestedBy` ilikuwa tupu kila mara | Inajazwa na mtumiaji aliyeingia. Majina ya walioomba/kuidhinisha yanaonyeshwa. |
| — | Dirisha la siku 30 lilikuwa ushauri tu | Sasa linazuia pia wakati wa kuunda ombi. |

Migration: **V135** (safu 4 zinazoweza kuwa null kwenye `sales_returns`; additive, `IF NOT EXISTS`).
Prod (nakala ya 15/10) ina marejesho 1 tu ya zamani, kwa hiyo hakuna data ya zamani ya kurekebisha.

## V3
- Menyu ya mstari kwenye orodha ya mauzo: Rudisha bidhaa, Badilisha bidhaa, Angalia / Idhinisha / Kataa.
- Dialog ya ombi: aina 4, mstari mmoja kwa kila mstari wa mauzo (na kilichobaki), "Imeharibika" kwa kila mstari, bidhaa mpya za exchange (bei ya mauzo, ukaguzi wa stoo), na muhtasari: deni linalopunguzwa, pesa ya kurudisha, kiasi cha kuongeza au chenji.
- Dialog ya idhini: hesabu ya pesa kwa wakati huo, njia ya refund, nyongeza ya exchange, na kitufe cha kufungua mauzo mapya.
- Vichujio "Zinasubiri idhini" na "Zilizobadilishwa", pamoja na muhtasari wa marejesho kwenye orodha.
- Malipo ya refund hayahesabiwi tena kama malipo (taarifa za mauzo, risiti, ripoti ya njia za malipo).
- Profit panel ilitoa marejesho mara mbili; imerekebishwa.

## Majaribio (PC, DB `lsms_returns_scratch` = nakala ya `lsms_audit_20261015_0200`)
- Backend E2E 54/54: refund kamili, mkopo, lipwa-sehemu (VODACOM), damaged, mistari miwili, exchange ghali/rahisi, exchange ya walk-in yenye deni inarudishwa nyuma, siku 30, `/exchanges` imezimwa, flags, recon.
- Unit tests (Sales, GL, Recon): 202, hakuna kilichoshindwa.
- UI E2E 23/23 (desktop + simu, hakuna console errors).
- Flyway: V134 → V135 zilipita kwenye nakala.

## Hatua zinazofuata (zako)
1. Soma diffs, kisha commit kwenye `main` (backend + V3).
2. Staging: backend toleo jipya lenye V135 (baada ya 2.2.72), refresh DB ya staging kutoka dump ya leo, na jaribio la exchange moja + return moja. Nikiruhusiwa nitaandaa step files.
3. Prod: backend kwanza, V3 baadaye.
