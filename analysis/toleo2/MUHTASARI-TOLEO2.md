# MUHTASARI WA TOLEO 2 — ukaguzi wa mwisho (fi/fj, 12/11/2026)

nimesoma hadi (fj)

Toleo 2 = backend **release/2.5.0** (V139–V150) + V3 **release/3.3.0**. Prod **Jumatano 02/12**, D **Jumatatu 07/12** (Qff-1).
Push imethibitishwa kwa `git ls-remote` (12/11): matawi yote ya t2-* (backend na V3) na `main` yalikuwa sawa na origin kabla ya kazi ya (fj).

Kwa nini nimeweza kuthibitisha kwa data tu sehemu: siwezi kuingia prod (ssh: `Permission denied (publickey)`), kwa hiyo yote ya prod
yako kwenye **hatua 91** (kusoma tu) ambayo Chief anaiendesha mara moja: Jagger, Flyway, D, akaunti za pesa, mikopo + hatua 90 (Flutter).

## 1. Jedwali

Hali: **IMEKAMILIKA** = code + majaribio kwenye nakala safi ya 29/10; **BADO** = kazi yangu kabla ya release; **BAADA** = nje ya toleo 2 (uamuzi wa Chief);
**CHIEF** = inasubiri hatua/jibu la Chief (halijatolewa, si swali jipya).

| Kipengele | Tawi (backend / V3) | Commit (backend / V3) | Majaribio (namba) | Hali | Hatua ya data baada ya deploy |
|---|---|---|---|---|---|
| G1 scheduler: mwezi wa sasa tu, kipindi kilichofungwa -> kataa | t2-gharama | 1ef3b08 / 6c34ca7 | suite 605/0/1, mutation 2/2 | IMEKAMILIKA | — (watoto 12 wa 12/2026–11/2027: uamuzi wa Chief, hawadhuru GL) |
| G2 Stop + mwezi huu (reversal kwa sababu) | t2-gharama | 9c496b8 / 6c34ca7 | g25 31/0 | IMEKAMILIKA | — |
| G3 onyo la nakala | t2-gharama | 9c496b8 / 6c34ca7 | g25 31/0 | IMEKAMILIKA | — |
| G4 "Imepangwa" + orodha baada ya kuhifadhi | t2-gharama | 9c496b8 / 6c34ca7 | g25 31/0 | IMEKAMILIKA | — |
| G5 gharama za mwaka (V140, 1160; CEO kujiidhinisha kwa sababu) | t2-gharama | 9c496b8 / 6c34ca7 | g25 31/0 | IMEKAMILIKA | malipo ya 2027 kupitia G5 |
| Kazi 2 / G6 "Lipa deni" (V141, 2400/2200) | t2-gharama | 9c496b8 / 6c34ca7 | suite 626/0/1, g6 13/0, E2E 13/13 | IMEKAMILIKA | 01/01/27: 2400 600k, 2200 65k kupitia G6 |
| Kazi 3 chini ya gharama: sababu + BELOW_COST (V142) | t2-gharama | 9c496b8 / 0f405df, a1d976c | unit 5/0, mutation 3/3, suite 632/0/1, k3 20/0, E2E 14/14 | IMEKAMILIKA | — |
| KUPIMA (V143, wazazi wengi, faida kwa chombo) | t2-kupima | d5b35f5 / f0f8667 | suite 648/0/1, kupima_api 28/0, kupima 14/0, t85 21/0 | IMEKAMILIKA | **85** (uhamisho wa KUPIMA, baada ya Chief kuhesabu) |
| Kazi 4 tozo kwa gharama (V144) + Q4-3 NBV | t2-tozo | 55b1d26 / af82b73 | unit 13/0, mutation 2/2, suite 652/0/1, tozo_api 21/0, tozo 8/0 | IMEKAMILIKA | — |
| Ripoti / exclude_from_ops_report (V145) | t2-ripoti | d92da83 / 80407f7 | PG 6/6, t89 7/0 | IMEKAMILIKA | **89** (Frame/TRA Nov nje ya ripoti) |
| Kazi 5 kanuni za hesabu ya stock (V146) | t2-hesabu | dfbfc4d / bddc178 | suite 661/0/1, ng 102/102, hesabu_api 22/0, hesabu 9/0 | IMEKAMILIKA | — |
| 6a "Umelipa sasa" iliyopotea | (hatua ya data) | steps/74 | t74 (ununuzi 18 -> PAID) | IMEKAMILIKA (script) | **74** |
| 6c Jess 2310 (V147) + 7 ripoti kwa avg | t2-pesa | 1d8abb3 / 959cad4 (e97f817) | c3 + SupplierPaymentSourceTest | IMEKAMILIKA | — |
| 6e droo kwenye reco (mstari wa auto wa DROO) | t2-pesa -> t2-cutover | — | — | **BADO** (Q6b-1 imejibiwa na fc/fe: wasambazaji hulipwa NMB; Q6e-1/2 = pendekezo: aliyerekodi, tangu deploy) | — |
| 6d 1010 akiba ya mkopo | — | — | — | BAADA (Qff-1) | — |
| H1 kizingiti cha Health (V139) | t2-afya | 2a64f7e / e70d2ba | suite + afya e2e | IMEKAMILIKA | — (mwelekeo unaanza siku ya deploy) |
| Cutover: reco -> 102x/103x baada ya D | t2-cutover | 8dd0a2d, 2be5211 / cb4e895 | cutover_api 10/0 | IMEKAMILIKA | **60** siku ya D |
| Uhamisho wenye ada (6130, V149) + sababu + kinga ya kabla ya D | t2-cutover | d9498e1 / 61a618e | cutover_api 10/0 (T7–T9) | IMEKAMILIKA | — |
| Tofauti ya ufunguzi 2910 (V150, Qff-2) | t2-cutover | 7140df4 / — | t60 14/0 | IMEKAMILIKA | **60** |
| (fj) akaunti zote wazi + kinga: zinazotumika juu, "una uhakika?" > siku 60, "Salio kwa akaunti" | t2-cutover | 710fa5a / e4b87fe | akaunti_e2e 5/0, ng 103/103, t60 14/0 (akaunti 9) | IMEKAMILIKA | **60** (akaunti zote 9 zinapata salio la ufunguzi) |
| C4 marejesho (V148), swichi OFF | t2-marejesho | a268e3f / 326a90f (kwenye t2-cutover) | marejesho_api 14/0 (ON) + 1/0 (OFF), marejesho UI 4/0 + 1/0, unit 663/0 | IMEKAMILIKA | — (Chief anawasha swichi baadaye) |
| Jagger: majina ya SKU 4 | (data, Chief) | — | hatua 91 sehemu 1 | **CHIEF** (amebadilisha kwenye V3; 91 inathibitisha, kisha nafunga) | — |
| Usafi 9: config junk lines (§6) | t2-cutover | — | — | BADO | — |
| Usafi 9: C9 deploy-v3 `ssh -n` | V3 | — | — | BADO | — |
| Usafi 9: build safi (`mvnw clean package`) | t2-cutover | 92a6e60 | V151 iliyobatilishwa ilibaki target/ -> imezuiwa | IMEKAMILIKA | — (kanuni ya release: image kutoka worktree safi + clean) |
| Usafi 9: C7 code iliyokufa (Flutter) | — | — | hatua 90 | **CHIEF** (90 haijaendeshwa; iko ndani ya 91) | — |
| Usafi 9: C6 backup_20260930_journal_entry DROP | — | — | — | **CHIEF** (nakala B2 kwanza) -> vinginevyo BAADA | — |
| Usafi 9: V039 / Flyway outOfOrder | — | — | — | **CHIEF** (ruhusa ya `flyway repair`) -> vinginevyo BAADA | — |
| Usafi 9: M1 MaterializedViewScheduler (a/b) | — | — | MvRefreshPgCheck | **CHIEF** (a au b) -> vinginevyo BAADA (haiandiki data mbaya) | — |
| Usafi 9: §17 DISPOSED (check ya capital_expenditure.status) | — | — | — | BAADA (Q4-3) | — |
| Usafi 9: UTF-16 build log | — | — | — | BADO | — |
| F1 footer "Babuu Liquor Store" | — | — | — | **CHIEF** (tahajia kwa cheti) | — |
| §14, §16, ulinganisho wa benki wa mwezi | — | — | — | BAADA (Qff-1); "Salio kwa akaunti" (fj 4) ni toleo rahisi lake | — |

## 2. Hatua za data (mpangilio)

| Lini | Hatua | Nini |
|---|---|---|
| Kabla ya release (sasa) | **91** kagua | prod kusoma tu: Jagger, Flyway, D (lazima HAIJAWEKWA), akaunti za pesa, mikopo + 90 (Flutter) |
| Baada ya deploy 02/12 | **74** | ununuzi 18 -> PAID (bila journal) |
| Baada ya deploy | **89** | Frame/TRA Nov nje ya ripoti ya uendeshaji |
| Baada ya deploy + hesabu ya Chief | **85** | uhamisho wa KUPIMA |
| 04/12 | — | Loan A awamu 2 kwenye app (Cr 1000), hakuna kazi |
| **07/12 asubuhi (D)** | **60** kagua -> andika | salio la ufunguzi kwa akaunti ZOTE 9 za benki/simu + tofauti -> 2910 + D |
| 07/12 + siku 30 | journal ya mkono | 2910 chambua; kisichoelezeka -> 3900 (CEO + taarifa kwa Executive CEO) |

## 3. Kilichobaki kabla ya kuunganisha (kazi 10)

1. **6e** (droo kwenye reco) — code + majaribio. Siku ~1.5.
2. **Usafi 9 wa kwangu:** config junk lines, C9 `ssh -n`, UTF-16 log. Siku ~0.5.
3. **Kazi 10:** unganisha t2-* -> release/2.5.0 na release/3.3.0; lango kamili kwenye nakala safi (suite + PG + c2 + run-all E2E, Flyway 134 -> 150);
   script ya deploy (kama 76) + rollback; staging; prod 02/12.

Vya CHIEF (vimeorodheshwa, si maswali mapya): 91 iendeshwe; C6 B2, V039 repair, M1 a/b, F1 tahajia — visipofika kabla ya 25/11 vinaenda BAADA.
