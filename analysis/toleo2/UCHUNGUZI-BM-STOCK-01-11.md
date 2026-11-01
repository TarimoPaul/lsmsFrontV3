# Uchunguzi (bm): hesabu ya stock ya 13/10 na mistari isiyoandikwa — KUSOMA TU

Chanzo: nakala ya Docker-local (dump ya prod ya 29/10, PG15), maswali ya kusoma tu (`default_transaction_read_only=on`).
Hakuna kilichoandikwa. Nakala inaishia 29/10, kwa hiyo 30–31/10 haimo (tazama §3).

## 1. 13/10 — ziada ya 1200 = +262,501.35

- Session ya 13/10: BLIND, ilihesabiwa na **macheda** 07:12–07:42, iliidhinishwa na **Paul Tarimo** 13/10 09:48.
  Mistari 139, yenye tofauti 18.
- GL ya 13/10, journal 8 za `STOCK_ADJUSTMENT`: Dr 1200 **335,491.35** (ziada 6) − Cr 1200 **72,990.00** (upungufu 2 kwenda 5100)
  = **+262,501.35**. Hii ndiyo namba yako.
- Upungufu 4 wa `OFF_SYSTEM_SALE` (36,858.55 kwa gharama) haukwenda 5100: ulienda kwa keshia kama `STAFF_LIABILITY_CHARGE`
  (Dr 1120 kwa bei ya kuuza / Cr 1200 gharama / Cr 4900 faida). Ndiyo sababu `stock_adjustment` ya siku hiyo ni +225,642.80.

| Bidhaa | Mfumo | Kuhesabu (1 / recount) | Tofauti | Thamani | Uamuzi na sababu |
|---|---:|---|---:|---:|---|
| JAGGER MASTER | 1 | 6 | +5 | **+265,000.00** | ADJUST, COUNTING_ERROR — gharama 53,000 kwa kipande |
| SERENGETI LITE | 4 | 47 / 44 | +40 | +63,040.00 | ADJUST, COUNTING_ERROR (recount: "Error counting") |
| SAVANA 330ML | 8 | 9 | +1 | +3,343.02 | ADJUST, COUNTING_ERROR |
| KILIMANJARO LAGER | 0 | 1 | +1 | +1,925.00 | ADJUST, COUNTING_ERROR |
| CASTLE LITE | 177 | 178 | +1 | +1,650.00 | ADJUST, COUNTING_ERROR |
| COCA && FANTA | 209 | 210 | +1 | +533.33 | ADJUST, COUNTING_ERROR |
| KILIMANJARO CAN | 30 | 0 | −30 | −63,750.00 | ADJUST → 5100, COUNTING_ERROR |
| SERENGETI LAGER | 121 | 115 | −6 | −9,240.00 | ADJUST → 5100, DAMAGED |
| HEINEKEN | 26 | 18 | −8 | −25,916.88 | CHARGE_TO_CASHIER, OFF_SYSTEM_SALE (1120 28,500) |
| REDS CAN 330ML | 29 | 25 | −4 | −8,500.00 | CHARGE_TO_CASHIER, OFF_SYSTEM_SALE (1120 12,000) |
| GRAND MALTA | 28 | 27 | −1 | −2,125.00 | CHARGE_TO_CASHIER, OFF_SYSTEM_SALE (1120 3,000) |
| AFYA MAJI 600ML | 38 | 0 / 37 | −1 | −316.67 | CHARGE_TO_CASHIER, OFF_SYSTEM_SALE (1120 500) |
| PEPSI && MIRINDA | 21 | 473 | +452 | +241,065.16 | **haikuandikwa** (NO_ACTION) |
| SAFARI LAGER kb | 60 | 61 | +1 | +1,925.00 | haikuandikwa |
| SAFARI LAGER | 137 | 138 | +1 | +1,650.00 | haikuandikwa |
| GOLDEN KING KUPIMA | 9 | 0 | −9 | −9,000.00 | haikuandikwa |
| GILBEYS KUPIMA | 9 | 0 | −9 | −9,000.00 | haikuandikwa |
| Moon Light Kupima | 9 | 0 | −9 | −18,000.00 | haikuandikwa |

Kwa nini (kutoka data na code, si maoni ya mtu):
- **JAGGER MASTER peke yake (+265,000) ni zaidi ya ziada yote ya siku.** Mfumo ulikuwa na 1, ilihesabiwa 6, hakuna recount, na
  iliidhinishwa kama "kosa la kuhesabu". Swali: 53,000 ni gharama ya chupa moja, au ya katoni/kifurushi?
- SERENGETI LITE +40 na KILIMANJARO CAN −30 siku ileile, bidhaa za aina moja (makopo): huenda zilichanganywa wakati wa kuhesabu
  au kuuza. Hii ni dhana tu; haijathibitishwa.
- Sababu zote zilichaguliwa na mwidhinishaji. Hakuna mstari wenye maelezo ya keshia (cashier_reason/note tupu).

## 2. Kwa nini mistari "haiandikwi"

Code ya prod (2.3.0, `CountingApprovalService`): wakati wa kuidhinisha kila mstari unapewa uamuzi `ADJUST`,
`CHARGE_TO_CASHIER` au `NO_ACTION`. Ni hiyo miwili ya kwanza tu inayoandika `stock_adjustment` + journal. `NO_ACTION`,
na session nzima iliyo `FORCE_CLOSED`, haibadilishi stock wala GL, na uamuzi wenyewe hauhifadhiwi popote.

Matokeo: stock ya mfumo haibadiliki, kwa hiyo **tofauti ileile inarudi kwenye hesabu ya kesho**. Mfano: −36,000 kila siku
(Moon Light −18,000 + Golden King −9,000 + Gilbeys −9,000, kutoka 9 hadi 0) kwa siku 28 mfululizo. Kujumlisha mistari yote
kunahesabu tofauti moja mara nyingi.

## 3. Mistari isiyoandikwa — muhtasari

Oktoba, session APPROVED, 01–29/10 (nakala): **mistari 203** ya bidhaa 49, ndani ya siku 28 kati ya 29
(30–31/10 hazimo; "210" yako huenda inazijumuisha).

| Kipimo | Ziada | Upungufu | Jumla |
|---|---:|---:|---:|
| Mistari 203 ikijumlishwa (inarudiwa — si thamani halisi) | 7,540,383.01 | −1,737,237.61 | 5,803,145.40 |
| **Hali halisi 29/10** (tofauti ya mwisho ya kila bidhaa ambayo bado haijaandikwa) | **201,800.04** | **−46,000.00** | **+155,800.04** |

Hali halisi ya 29/10, bidhaa 6:

| Bidhaa | Mfumo | Kuhesabu | Tofauti | Thamani |
|---|---:|---:|---:|---:|
| DONE WINE | 2 | 24 | +22 | +198,000.00 |
| AFYA MAJI 600ML | 168 | 180 | +12 | +3,800.04 |
| Moon Light Kupima | 9 | 0 | −9 | −18,000.00 |
| KONYAGI YA KUPIMA | 10 | 0 | −10 | −10,000.00 |
| GOLDEN KING KUPIMA | 9 | 0 | −9 | −9,000.00 |
| GILBEYS KUPIMA | 9 | 0 | −9 | −9,000.00 |

Bidhaa zinazojirudia zaidi Oktoba (siku): Moon Light/Golden King/Gilbeys Kupima 28 kila moja, Konyagi ya kupima 14,
Wine za kupima 11, Done Wine 6, Grepa Wine 6, Safari Lager kb 5, Pepsi && Mirinda 5.
Bidhaa za "kupima" (zinazouzwa kwa kipimo) zinaonekana kama 0 kwenye hesabu kila siku: huenda hazihesabiwi kwa chupa kabisa.

Jumla ya miezi yote (nakala): APPROVED mistari 720 (07/07–29/10), FORCE_CLOSED mistari 228 (session 14).

**Hakuna kilichoandikwa.** Uamuzi ni wako (mf. kuandika hali halisi ya 29/10 au ya siku ya mwisho, sera ya bidhaa za kupima,
na kuhifadhi uamuzi wa NO_ACTION ili usionekane kama mstari mpya kila siku).
