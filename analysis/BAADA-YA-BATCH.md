# Orodha ya BAADA ya batch (2.4.0 / 3.2.0)

Vitu vilivyoamuliwa na mmiliki kufanyika baada ya batch ya 16/11/2026. Havimo kwenye kifurushi. Kila kimoja kinaanza kwa muundo
na majibu ya mmiliki kabla ya code.

## 0. KIPAUMBELE CHA JUU: punguzo linaloifanya sale kuwa chini ya gharama (mmiliki 02/11 bs)
- Sababu: sale zote 3 za 2026 zenye punguzo ziliuzwa chini ya gharama (hasara −103,841.22; 101026-2209 punguzo 100,000 kwa
  114,500). Sale 2 zilizofutwa zilikuwa na punguzo la 280,000 na 135,000. Ripoti: analysis/toleo2/RIPOTI-BS-02-11.md.
- Kanuni (backend, siyo V3 tu): ikiwa total ya sale baada ya punguzo < gharama ya mistari yake (cost_per_piece × idadi,
  bei ileile inayotumika kwa COGS) → sale inakataliwa isipokuwa mtumiaji ana ruhusa ya CEO (ruhusa mpya, kama
  SALE_DELETE_REVIEW) NA ametoa sababu (lazima, ≥ 10 herufi).
- Inahusu kila njia: sale mpya, edit ya sale, na punguzo linaloongezwa baadaye. Inarekodiwa (nani, sababu, gharama, total)
  kama audit ya A6, na CEO anapata notification.
- V3: POS ionyeshe "chini ya gharama kwa X" kabla ya kuhifadhi; mtumiaji asiye na ruhusa haoni kitufe cha kuendelea.
- Majaribio: punguzo ndani ya margin → inaruhusiwa; chini ya gharama bila ruhusa → 403; CEO bila sababu → 400;
  CEO + sababu → inaruhusiwa na kurekodiwa; mutation.

## 1. Akiba ya mkopo kama akaunti halisi 1010 (mmiliki 01/11 bj)

> "Akiba ya mkopo: akaunti 1010, Dr 1010/Cr 1000 kila siku kupitia reco, repayment kutoka 1010".

- Leo (2.3.0): "akiba ya mkopo" ni memo ya ripoti tu (principal ÷ siku za mkopo, mf. A 10,869.57 na B 19,047.62 kwa siku);
  hakuna journal, na pesa ya akiba iko ndani ya 1000 (bahasha ya mkononi).
- Lengo: akiba ya kila siku iwe journal Dr 1010 / Cr 1000 inayoandikwa kupitia reco ya siku, na malipo ya mkopo yatoke 1010
  (Dr 2100 / Cr 1010), ili 1000 ionyeshe pesa ya droo tu.
- Kabla ya code: muundo (reco inaandikaje akiba; siku ambayo reco haikufanyika; akiba iliyozidi/pungufu; uhusiano na tarehe ya
  kukata D ya benki na hatua 60, ambayo sasa inauliza bahasha ya akiba kwenye cash count ya ufunguzi).

## 2. Hesabu ya stock (mmiliki 01/11 bn)

Chanzo: analysis/toleo2/UCHUNGUZI-BM-STOCK-01-11.md (NO_ACTION haihifadhiwi, stock haibadiliki, tofauti ileile inarudi kila siku).

- **Tofauti inayojirudia hesabu 2 mfululizo haiwezi kuwa NO_ACTION tena**: bidhaa ileile yenye tofauti ileile siku ya pili
  inalazimika kuwa ADJUST / CHARGE_TO_CASHIER au recount. Inahitaji kuhifadhi uamuzi wa kila mstari (leo NO_ACTION haiachi alama).
- **Ziada > 50,000 kwa bidhaa: recount na mtu wa pili kabla ya approve.** Mfano: JAGGER MASTER 13/10 (+265,000, hakuna recount).
- **Bidhaa za "kupima": upotevu wa kupima uandikwe kama gharama (5100), siyo NO_ACTION.** Mfano: Moon Light / Golden King /
  Gilbeys Kupima −36,000 kila siku kwa siku 28.

## 3. Manunuzi: kifurushi kilichoingizwa kama kipande (uchunguzi (bn) f, nakala ya 29/10)

- JAGGER MASTER (kifurushi = chupa 6): 07/09 na 22/09 kifurushi 1 kwa 53,000 → 8,833.33 kwa chupa (sahihi). 11/10 kilekile
  kiliingizwa PER_PIECE → 53,000 kwa CHUPA, stock +1 badala ya +6. Hesabu ya 12–13/10 ilipata 6 → +5 × 53,000 = 265,000
  (thamani halisi ya chupa 6 ni 53,000). 1200 imezidi kwa takriban 265,000. Hatua 62 (f) itathibitisha kwenye prod.
- Kinga inayopendekezwa: bidhaa yenye pieces_per_package > 1 inaponunuliwa PER_PIECE kwa bei iliyo karibu na bei ya kifurushi
  (mf. ≥ 80% ya gharama ya mwisho ya kifurushi) → onyo/kukataliwa mpaka ithibitishwe.

## 4. Malipo ya mwaka kama prepaid 1160 (mmiliki 01/11 br) - KIPAUMBELE: kabla ya 31/12/2026
- Malipo yanayolipwa kwa mwaka mzima (pango, TRA, n.k.): Dr 1160 (prepaid) / Cr akaunti ya pesa siku ya malipo,
  kisha kila mwezi Dr akaunti ya gharama / Cr 1160 = sehemu ya mwezi (amortization).
- Scheduler ya kila mwezi kama ile ya riba (1150 → 6600): kipindi, kiasi kwa mwezi, siku ya kuanza, salio la 1160 kwa kila
  malipo; isiandike mara mbili (kinga ya replay) na isiandike kwenye kipindi kilichofungwa.
- 2026 ISIGUSWE: malipo ya 2026 yanabaki kama yalivyoandikwa. Inaanza na malipo ya kwanza ya 2027.
- Ripoti ya uendeshaji: "gharama za mwezi" isome amortization hiyo, ili daraja na GL lisipate tofauti ya timing.
