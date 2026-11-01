# Orodha ya BAADA ya batch (2.4.0 / 3.2.0)

Vitu vilivyoamuliwa na mmiliki kufanyika baada ya batch ya 16/11/2026. Havimo kwenye kifurushi. Kila kimoja kinaanza kwa muundo
na majibu ya mmiliki kabla ya code.

## 1. Akiba ya mkopo kama akaunti halisi 1010 (mmiliki 01/11 bj)

> "Akiba ya mkopo: akaunti 1010, Dr 1010/Cr 1000 kila siku kupitia reco, repayment kutoka 1010".

- Leo (2.3.0): "akiba ya mkopo" ni memo ya ripoti tu (principal ÷ siku za mkopo, mf. A 10,869.57 na B 19,047.62 kwa siku);
  hakuna journal, na pesa ya akiba iko ndani ya 1000 (bahasha ya mkononi).
- Lengo: akiba ya kila siku iwe journal Dr 1010 / Cr 1000 inayoandikwa kupitia reco ya siku, na malipo ya mkopo yatoke 1010
  (Dr 2100 / Cr 1010), ili 1000 ionyeshe pesa ya droo tu.
- Kabla ya code: muundo (reco inaandikaje akiba; siku ambayo reco haikufanyika; akiba iliyozidi/pungufu; uhusiano na tarehe ya
  kukata D ya benki na hatua 60, ambayo sasa inauliza bahasha ya akiba kwenye cash count ya ufunguzi).
