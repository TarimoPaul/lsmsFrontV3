# Mwongozo: malipo ya wateja, reco na uhamisho (fl, fq, fr, fs, fu, fv, fw — 12/11/2026; gy — 13/11/2026)

> **Tarehe ya mabadiliko (gy):** toleo jipya linaingia prod **siku ya deploy (14 au 15/11)**, si 02/12 tena. Chief atataja siku kamili; kila
> "siku ya deploy" hapa chini ni siku hiyo. D (benki, 07/12) haibadiliki.

**Kanuni ya msingi:** kila harakati ya pesa inaandikwa **MARA MOJA**, na yule aliyeifanya.

## 1. Kwa muuzaji (Macheda): kanuni ya reco

> **Reco ya muuzaji = pesa WATEJA walizolipa LEO kwa kila njia (sale au deni), kama ulivyozipokea.**
> **Mstari wa benki = wateja waliolipa moja kwa moja benki LEO + Taslimu WEWE uliyoipeleka benki LEO.**

Mfano:

| Njia | Kiasi |
|---|---|
| NMB | 200,000 (wateja waliolipa NMB, pamoja na cash uliyoipeleka NMB leo) |
| Lipa namba | 30,000 |
| Selcom | 10,000 |
| CRDB | 30,000 |
| Taslimu | kiasi ulichokabidhi |

- **Si salio, na si taarifa ya benki.** Ni pesa ya leo tu, kwa njia ilivyoingia.
- **Endelea kama unavyofanya sasa**, pia baada ya D. "Cash ya mauzo" uliyoipeleka benki iandikwe kwenye reco kama amana ya benki hiyo. Kuanzia D mfumo unaihamisha mara moja (Dr benki / Cr 1000).
- **Muuzaji HAANDIKI:**
  - uhamisho kati ya akaunti (Selcom → NMB, lipa namba → benki, CRDB → NMB);
  - mikopo;
  - pesa ya mmiliki.
  
  Hayo ni kazi ya CEO (sehemu 3).
- **POS:** chagua Fedha Taslimu kama unavyofanya sasa, na utangaze malipo ya simu au benki kwenye reco. Kuanzia siku ya deploy ukichagua M-Pesa kwenye POS, reco inaonyesha mstari wa AUTO. Mfumo hauuhesabu mara mbili.
- **Lipa namba** inaandikwa kama **M-Pesa (VODACOM)**. Ndivyo duka linavyofanya tayari ("LIPA VODA", "lipa no v"). Kuanzia D inaenda akaunti 1030.

### Mpaka siku ya deploy (prod ya sasa inakubali njia 8 tu)

| Inakubalika | Haikubaliki (sale/deni linakataliwa, halihifadhiwi) |
|---|---|
| Fedha Taslimu, M-Pesa, Tigo Pesa, Halo Pesa, CRDB, NMB, NBC, Mkopo | Selcom, PCB, Airtel Money, Uhamisho wa benki, Pesa ya simu |

- Usichague njia isiyokubalika kwenye POS. Airtel Money iko kwenye safu ya kwanza. Chagua Fedha Taslimu na utangaze malipo kwenye reco.
- Mpaka siku ya deploy, usichague M-Pesa, Tigo au Halo kwenye POS. Prod ya sasa ingehesabu mstari wa AUTO pamoja na ulichoandika.
- Usiandike sale kwenye karatasi, na usichague Mkopo kwa sale iliyolipwa.

## 1b. Marejesho ya mauzo — BADO HAYAJAWASHWA (hh, 13/11)

Marejesho yatawashwa baadaye (Desemba), baada ya kurekebishwa. Mpaka hapo: **usifute sale ili "kurudisha" bidhaa**;
mteja akirudisha bidhaa, mjulishe CEO, naye ataamua jinsi ya kuiandika.

## 2. Kwa CEO / mnunuzi: kabla ya kuidhinisha

- **Hakiki kwa mkono kwamba fedha zipo** kabla ya kuidhinisha reco: NMB 200,000 iko NMB, Selcom 10,000 iko Selcom, n.k.
- **Manunuzi na malipo ya wasambazaji** yaandikwe kwa **chanzo halisi**: benki X, lipa namba, au Taslimu (droo).

## 3. Kwa CEO: Transfer ya GL = TU harakati ambazo hakuna aliyeziandika

Pesa ya droo → benki tayari imeandikwa na aliyeipeleka:
- muuzaji kwenye reco (amana);
- au amana ya sefu iliyothibitishwa.

**Usiiandikie Transfer tena.** Ukijaribu Transfer Taslimu → benki yenye kiasi, benki na siku sawa na amana hiyo, mfumo unaonyesha onyo: "Huenda imeshaandikwa kwenye reco ya [tarehe]". Ni onyo tu, si kizuizi.

Kuanzia D (07/12), **harakati nyingine zote zinazofanyika nje ya mfumo ni Transfer ya GL** (Hesabu → Uhamisho), siku ile ile:
- Selcom → NMB, CRDB → NMB n.k.;
- **lipa namba (1030) → benki:**
  - Lipa namba inahamishwa kwa mkono kwenda benki mbalimbali.
  - Kiasi cha Transfer = kilichotoka 1030; makato yaandikwe kwenye sehemu ya **Ada** (yanaenda 6130).
  - Mfano: 100,000 kutoka lipa namba → NMB inapokea 98,500 + makato 1,500. Andika Kiasi 100,000, Ada 1,500.
  - Matokeo: 1030 −100,000, 1021 +98,500, 6130 +1,500 (jaribio `pengo_d_api` P5).

Usipoiandika, vitabu vinaenda kombo. Jaribio `pengo_d_api` (nakala ya prod, D imewekwa) linaonyesha hivi:

| Hatua | 1023 Selcom | 1021 NMB | Hali halisi |
|---|---|---|---|
| Reco: mteja amelipa Selcom 10,000 | +10,000 | — | Selcom +10,000 |
| CEO amehamisha Selcom → NMB, kisha amelipa msambazaji 50,000 kutoka NMB, **bila Transfer** | **+10,000** | **−50,000** | Selcom 0, NMB −40,000 |
| **Na Transfer** Selcom → NMB 10,000 | **0** | **−40,000** | sawa ✅ |

### Ukaguzi wa kila wiki (CEO)

Kila wiki linganisha **salio la GL** la 1030 (lipa namba / M-Pesa), 1021 (NMB) na 1023 (Selcom) na **salio halisi** kwenye simu au benki. Tumia Hesabu → "Salio kwa akaunti", na andika salio halisi kwenye safu ya taarifa.
- **Tofauti = Transfer iliyosahaulika**, au makato yasiyoandikwa. Iandike (Transfer ya tarehe halisi) hadi tofauti iwe 0.
