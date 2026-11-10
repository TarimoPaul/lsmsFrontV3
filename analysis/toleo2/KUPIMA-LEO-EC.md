# Kupima inavyofanya kazi leo (ec, ombi la (ef)): 10/11/2026

Vyanzo:
- code ya backend `feature/t2-gharama`;
- nakala ya Docker-local ya dump ya 29/10 (kusoma tu);
- POS ya V3.

Hakuna kilichobadilishwa.

## 1. Hakuna "kupima" kwenye mfumo
- Hakuna aina ya kuuza, ml, chombo, wala kiungo na chupa mzazi.
- `item_measure` ni jina la kifurushi tu (chupa, katoni…), si kipimo cha ujazo.
- Sehemu za bei (whole, half, quarter, piece) ni sehemu za KATONI, si za chupa.
- POS ya V3 haina kitu maalum cha kupima.

## 2. Badala yake: kila kinywaji cha kupima ni BIDHAA TOFAUTI
Bidhaa hizi ni CAMINO KUPIMA, GILBEYS KUPIMA, GOLDEN KING KUPIMA, KONYAGI YA KUPIMA, Moon Light Kupima, na WINE ZA KUPIMA.
- **Kuingiza stock:** kunafanyika kama **manunuzi kutoka kwa msambazaji**. "Kipande" kimoja ni kipimo kimoja, na gharama yake ni sawa na bei ya kuuza (1,000; Moon Light 2,000; Wine 500).
  - Kuna manunuzi 9 kati ya 20/02 na 17/08, jumla **159,000**.
  - Yote yameandikwa **PAID**, na GL ni **Dr 1200 / Cr 1000** (pesa imetoka droo).
  - Wasambazaji walioandikwa ni Babuu, Serengeti na TAKAWEDO, lakini hakuna msambazaji anayeuza vipimo.
- **Chupa mzazi:** chupa inayofunguliwa **haipungui popote**. Hakuna kiungo kati ya "KONYAGI YA KUPIMA" na "KONYAGI 750ML".
- **Kuuza:** muuzaji anachagua kipande 1 na **anaandika bei mwenyewe**. Mistari ya Konyagi ya kupima ina bei 1,000, 2,000, 3,000, 4,000, 5,000, 8,000 na 13,000. Hivyo kipimo maalum kinaingizwa kila siku, na gharama inabaki 1,000 kwa kila "kipande".
- **Jumla ya mauzo (Feb–Okt):**
  - Mapato 409,000.
  - Gharama iliyoandikwa 209,500.
  - Faida iliyoandikwa 199,500.
  - Faida hii si halisi, kwa sababu gharama ya kipimo haitokani na gharama ya chupa.
- **Hesabu:** kila hesabu inapata 0 kwa bidhaa hizi. Hali ya 29/10:
  - Moon Light −9, Konyagi −10, Golden King −9, Gilbeys −9;
  - jumla **46,000 kwa gharama, haijaandikwa**;
  - hakuna stock_adjustment yoyote ya kupima (BAADA §2).
- **Tozo:** hakuna (uamuzi wa Chief, 02/11).

## 2b. Maswali ya (ec), jibu moja moja
- **Kuna uhusiano na chupa (conversion)?** HAPANA. Bidhaa ya kupima haina kiungo chochote na chupa. Hakuna conversion ya chupa 1 = vipimo N.
- **Kipimo kimoja kinapunguza stock kiasi gani?** Kila mstari wa mauzo unapunguza "kipande" 1 cha bidhaa ya kupima, bila kujali bei iliyoandikwa:
  - mstari wa 5,000 bado ni −1;
  - chupa mzazi inabaki 0 (haiguswi).
- **Kwa nini 9–10?** Ni salio la "manunuzi" bandia ukitoa mauzo yaliyoandikwa:

  | Bidhaa | Manunuzi | Mauzo | Marekebisho / marejesho | Salio la mfumo | Mauzo ya mwisho yaliyoandikwa |
  |---|---|---|---|---|---|
  | Golden King Kupima | 20 | −11 | 0 | **9** | 09/05 |
  | Gilbeys Kupima | 20 | −11 | 0 | **9** | 18/07 |
  | Moon Light Kupima | 20 | −13 | +1, +1 | **9** | 17/08 |
  | Konyagi ya kupima | 34 | −101 | +70, +7 | **10** | 12/10 |
  | Camino / Wine | 20 / 50 | −22 / −77 | +2 / +27 | 0 / 0 | 01/06 / 11/10 |

  Vipimo hivi havipo kwenye kabati. Hesabu inapata 0 kwa sababu kipimo hakiwezi kuhesabiwa kwa macho. Hiyo ndiyo tofauti ya 46,000 inayorudi kila siku.

## 3. Matatizo yanayotokana na hali ya leo (yanajibiwa na muundo wa (ef))
| Leo | (ef) |
|---|---|
| Kipimo "kinanunuliwa" kwa Cr 1000, na chupa mzazi haipungui | Kufungua chombo: mzazi −1, bar = ujazo; hakuna manunuzi bandia |
| Gharama ya kipimo ni ya kubuni (= bei) | avg ya mzazi ÷ ujazo × ml |
| Bei inaandikwa na muuzaji | Vipimo vilivyosajiliwa tu (kanuni 2) |
| Hesabu inapata 0 kila siku | Hesabu ya wiki: vyombo vilivyofungwa + kilicho wazi (1, ¾, ½, ¼) |
| Kilichobaki kwenye chupa kinapotea bila rekodi | "Chombo kimeisha": Dr 5100 / Cr 1200, aliyefungua na aliyefunga |

## 4. Mambo ya Chief kabla ya uhamisho wa data (hatua KAGUA → ANDIKA)
- Kipande cha leo (k.m. Konyagi 1,000) kinalingana na ml ngapi?
- 159,000 za "manunuzi" ya vipimo: je, pesa ilitoka droo kweli? Kama haikutoka, GL ina Cr 1000 isiyo halisi pamoja na stock ya 1200 isiyokuwepo.
- 46,000 za 29/10 (BAADA §2) ziandikwe kwenye hatua hiyo hiyo.
