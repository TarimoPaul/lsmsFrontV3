# MPANGO (ct-2) — 04/11/2026 — kazi zote kabla ya staging

nimesoma hadi (ct-2). Kumbuka: ujumbe huu ulikuja na herufi **(ct)** mara ya pili, kwa hiyo kwenye MAAGIZO.md nimeuita (ct-2).

Uamuzi: batch iliyobaki pamoja na BAADA-YA-BATCH yote vinamalizika kabla ya staging. Orodha IMEFUNGWA 04/11.
Kosa jipya → linaandikwa; linaingia tu likiandika pesa/stock/data isiyo sahihi kwenye prod.

Makadirio ni siku za kazi za code + majaribio (Docker-local, suite, PG, E2E), bila kusubiri majibu.

## 1. Jedwali

| # | Kipengele (BAADA §) | Siku | Kinategemea Chief? | Nini kinahitajika kutoka kwa Chief |
|---|---|---|---|---|
| K0 | Kosa jipya (RIPOTI-CT §3): ununuzi bila msambazaji unahifadhiwa UNPAID | 0.25 | Hapana | — |
| 0.1 | Punguzo linaloifanya sale kuwa chini ya gharama: CEO + sababu | 1.5 | Hapana | — (kanuni imeshatolewa) |
| 0.2 | Tozo ya mfanyakazi kwa GHARAMA (bila 4900) | 1.5 | Ndiyo, ndogo | Tozo za zamani (4900 = 57,486.54 mwaka 2026) zibaki kama zilivyo? Pendekezo: ndiyo |
| 2a | Kipimo kimoja cha thamani ya stock = avg (ripoti ya uendeshaji) | 1 | Hapana | — (taarifa: namba za stock-closing za siku za zamani kwenye ripoti zitabadilika) |
| 12 | Deni kwa mmiliki kwa Jess | 0.5 | Ndiyo | Namba na jina la akaunti. Pendekezo: 2310 "Deni kwa mmiliki - Jess" |
| 10 | Benki/simu zilizowashwa (kabla ya D) | 0.5 | Ndiyo | Orodha ya benki na mitandao inayotumika kweli |
| 11 | Wasambazaji wa mkopo (supplier kwa uid kwenye fomu + "Nunua tena"; deni linahitaji msambazaji) | 1.5 | Ndiyo | Orodha ya wasambazaji wanaokopesha (jina, simu, siku za mkopo) |
| 8 | Droo kwenye reco (C3 sehemu ya pili) | 2.5 | Ndiyo | Maswali 4 ya §8: reco ya nani; reco iliyoidhinishwa; siku bila reco; mistari ya mkono iliyopo |
| 1 | Akiba ya mkopo 1010 kupitia reco | 2 | Ndiyo | Maswali ya §1: siku bila reco; akiba iliyozidi/pungufu; uhusiano na D |
| 13 | Movements za reco → benki/simu/sefu (Toleo 2 §2.2) | 3.5 | Ndiyo | **Tarehe D** + salio la benki/simu siku hiyo (statement); inategemea 10 na 8 |
| 4 | Prepaid 1160 (malipo ya mwaka) | 2 | Hapana | — (inaanza malipo ya kwanza ya 2027) |
| 2 | Kanuni za hesabu ya stock (4 ndani yake) | 3.5 | Ndiyo | Orodha ya bidhaa za "kupima"; kuandika 46,000 (Dr 5100) sasa au kwenye hesabu ya wiki ya kwanza |
| 7 | C4 Sales returns + exchange (nyuma ya flag, OFF) | 3.5 | Hapana | — (flag OFF; Chief anaiwasha baadaye) |
| 9 | Hatua 74: "Umelipa sasa" ya zamani | 0.5 | Ndiyo | Ushahidi wa kiasi kilicholipwa (risiti/daftari) kwa ununuzi 2–6 kwa mwezi tangu Julai |
| 15 | Kusafisha payment_status ya purchases za zamani | 0.5 | Ndiyo | Kuthibitisha orodha (nitaitoa kutoka dump ya siku hiyo) |
| 3 | SKU 4 za Jagger (majina/saizi) | 0.5 | Ndiyo | Saizi halisi za SKU 4 |
| 14 | Maelezo ya supplier payment (PATCH notes) | 0.3 | Hapana | — |
| 16 | Historia ya audit ya kuidhinisha capex | 0.5 | Hapana | — |
| 6 | Mistari ya takataka kwenye properties | 0.1 | Hapana | — |
| 5 | Kuzima Flyway outOfOrder | 0.5 | Ndiyo | V039: ruhusa ya `flyway repair` (au njia nyingine) |
| C6 | backup_20260930_journal_entry: nakala B2, kisha DROP | 0.5 | Ndiyo | Chief anaendesha hatua ya nakala B2 kabla ya migration ya DROP |
| C7 | Code iliyokufa (njia 26 + SaleReturnService) | 1 | Hapana | — (sasa C4 imerudi, kwa hiyo SaleReturnService HAITAFUTWA kama C4 inaitumia) |
| C9 | deploy-v3.ps1 `ssh -n` | 0.1 | Hapana | — |
| S | Script ya staging (kifurushi kizima, dump ya prod ya karibuni) | 1.5 | Hapana | — |
| P | Script ya prod | 1 | Hapana | — |
| | **Jumla** | **≈ 31** | | Pamoja na akiba ya 15% ≈ 35 |

## 2. Mpangilio unaopendekezwa (pesa/GL kwanza)

| Awamu | Vipengele | Siku |
|---|---|---|
| A. Pesa/GL bila majibu | K0 → 0.1 → 0.2 (kwa pendekezo "za zamani zibaki") → 2a → 4 → 14 → 16 | 7.1 |
| B. Pesa/GL zinazohitaji majibu | 12 → 10 → 11 → 8 → 1 → 13 | 11 |
| C. Stock | 2 → 3 | 4 |
| D. Mauzo | 7 (C4) | 3.5 |
| E. Hatua za data | 9 → 15 | 1 |
| F. Usafi + Flyway | 6 → C7 → C9 → C6 → 5 | 2.2 |
| G. Scripts | S → P | 2.5 |

Wakati Awamu A inaendelea (siku ~7), majibu ya Awamu B/C/E/F yanaweza kufika. Kipengele kisichokuwa na jibu kikifika zamu yake,
ninakiruka na kuendelea na kinachofuata, kisha ninakirudia.

## 3. Tarehe mpya

- **Code yote imekamilika local: 12/12/2026** (siku ~35 kuanzia 05/11, pamoja na akiba).
- Staging: 14–15/12. Prod: kabla ya 19/12, ili prepaid 1160 iwe tayari kabla ya malipo ya 2027 na Desemba ifungwe kwenye toleo jipya.
- Tarehe ya zamani (16/11) haitumiki tena.

## 4. Maswali kwa Chief (mara moja, kwa namba)
1. (0.2) Tozo za zamani zibaki kama zilivyo? (pendekezo: ndiyo)
2. (12) Akaunti ya Jess: 2310 "Deni kwa mmiliki - Jess"?
3. (10) Benki na mitandao inayotumika kweli.
4. (11) Orodha ya wasambazaji wanaokopesha.
5. (8) Majibu 4 ya §8.
6. (1) Majibu ya §1.
7. (13) Tarehe D + salio la statements siku hiyo.
8. (2) Bidhaa za kupima; 46,000 iandikwe lini.
9. (9) Ushahidi wa "Umelipa sasa" ya zamani.
10. (3) Saizi za SKU 4 za Jagger.
11. (5) Ruhusa ya `flyway repair` kwa V039.
12. (C6) Nakala ya B2 itaendeshwa na Chief (hatua nitaandaa).
