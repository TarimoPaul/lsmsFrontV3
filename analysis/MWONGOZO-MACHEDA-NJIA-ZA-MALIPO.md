# Mwongozo: malipo ya wateja, reco na uhamisho (fl, fq, fr, fs, fu — 12/11/2026)

## 1. Kwa muuzaji (Macheda): kanuni ya reco

> **Reco ya muuzaji = pesa WATEJA walizolipa LEO kwa kila njia (sale au deni), kama ulivyozipokea.**

Mfano:

| Njia | Kiasi |
|---|---|
| NMB | 200,000 |
| Lipa namba | 30,000 |
| Selcom | 10,000 |
| CRDB | 30,000 |
| Taslimu | kiasi ulichokabidhi |

- **Si salio, na si taarifa ya benki.** Ni malipo ya wateja wa leo tu, kwa njia waliyolipa.
- **Muuzaji HAANDIKI:**
  - uhamisho kati ya akaunti (k.m. Selcom → NMB);
  - pesa ya droo iliyopelekwa benki (cash → benki);
  - mikopo;
  - pesa ya mmiliki.
  
  Hayo ni kazi ya CEO (sehemu 3).
- **POS:** chagua Fedha Taslimu kama unavyofanya sasa, na utangaze malipo ya simu au benki kwenye reco. Kuanzia 02/12 ukichagua M-Pesa kwenye POS, reco inaonyesha mstari wa AUTO. Mfumo hauuhesabu mara mbili, kwa hiyo andika malipo ya wateja wa siku kama kawaida.
- **Lipa namba** inaandikwa kama **M-Pesa (VODACOM)**. Ndivyo duka linavyofanya tayari ("LIPA VODA", "lipa no v"). Kuanzia D inaenda akaunti 1030.

### Mpaka 02/12 (prod ya sasa inakubali njia 8 tu)

| Inakubalika | Haikubaliki (sale/deni linakataliwa, halihifadhiwi) |
|---|---|
| Fedha Taslimu, M-Pesa, Tigo Pesa, Halo Pesa, CRDB, NMB, NBC, Mkopo | Selcom, PCB, Airtel Money, Uhamisho wa benki, Pesa ya simu |

- Usichague njia isiyokubalika kwenye POS. Airtel Money iko kwenye safu ya kwanza. Chagua Fedha Taslimu na utangaze malipo kwenye reco.
- Mpaka 02/12, usichague M-Pesa, Tigo au Halo kwenye POS. Prod ya sasa ingehesabu mstari wa AUTO pamoja na ulichoandika.
- Usiandike sale kwenye karatasi, na usichague Mkopo kwa sale iliyolipwa.

## 2. Kwa CEO / mnunuzi: kabla ya kuidhinisha

- **Hakiki kwa mkono kwamba fedha zipo** kabla ya kuidhinisha reco: NMB 200,000 iko NMB, Selcom 10,000 iko Selcom, n.k.
- **Manunuzi na malipo ya wasambazaji** yaandikwe kwa **chanzo halisi**: benki X, lipa namba, au Taslimu (droo).

## 3. Kwa CEO: kila uhamisho halisi baada ya D = Transfer ya GL

Kuanzia D (07/12), **kila pesa inayohamishwa nje ya mfumo lazima iandikwe kama Transfer ya GL** (Hesabu → Uhamisho), siku ile ile. Mifano:
- Selcom → NMB;
- droo (Taslimu) → NMB;
- lipa namba → benki.

Usipoiandika, vitabu vinaenda kombo. Jaribio `pengo_d_api` (nakala ya prod, D imewekwa) linaonyesha hivi:

| Hatua | 1023 Selcom | 1021 NMB | Hali halisi |
|---|---|---|---|
| Reco: mteja amelipa Selcom 10,000 | +10,000 | — | Selcom +10,000 |
| CEO amehamisha Selcom → NMB, kisha amelipa msambazaji 50,000 kutoka NMB, **bila Transfer** | **+10,000** | **−50,000** | Selcom 0, NMB −40,000 |
| **Na Transfer** Selcom → NMB 10,000 | **0** | **−40,000** | sawa ✅ |

Bila Transfer, 1023 inapanda bila kushuka, na 1021 inashuka na inaweza kuwa hasi.

**Isipokuwa amana ya sefu:** amana ya sefu → benki iliyothibitishwa kwenye mfumo tayari imeandikwa (Dr benki / Cr 1000). **Usiiandikie Transfer tena.**
