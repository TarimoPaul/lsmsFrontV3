# Ripoti (bw) — 02/11/2026

nimesoma hadi (bw). Herufi tangu ripoti iliyopita (bu): (bw) tu.

**(bv) HAIPO** kwenye MAAGIZO.md wala kwenye kikao hiki. (bw) inaitaja ("(bv) sehemu ya sale zilizofutwa + A6 reasons"), lakini
sijaipokea. Tafadhali itume. Mpaka ifike, siwezi kuanza kazi yake.

## 1. Hatua 63 v3 — Jagger 886dc1ed (njia ya CARTON imefutwa)

Faili:
- analysis/steps/63-rekebisha-jagger.cmd (maelezo ya juu tu yamebadilika; mantiki ya cmd ni ileile)
- analysis/steps/63-rekebisha-jagger.mjs (imeandikwa upya)
- analysis/steps/63-jagger-kagua.sql (imeandikwa upya)

63 ilikuwa bado haijaendeshwa (hakuna log), kwa hiyo kubadilisha faili hakukugusa mwendesho wowote.

**KAGUA** (inasimama ikiwa yoyote si sawa):
- stock ya mfumo bado 6;
- gharama 53,000 (wastani na ya mwisho);
- hakuna mauzo ya 886dc1ed tangu 13/10;
- hakuna mwendo wowote wa stock tangu 13/10;
- hesabu ya 13/10 = +5 kwa 53,000 (1 → 6) = 265,000;
- journal ya 13/10 ilipa credit akaunti MOJA (kwenye nakala: **5100**, JE-2026-997155843737872) kiasi hichohicho;
- Oktoba OPEN;
- TB 0.

Kisha 🛑 SIMAMA-PREVIEW.

**ANDIKA** (CEO, si root):
1. Journal **31/10**: Dr <akaunti ya 13/10, kutoka data> / Cr 1200 = 265,000 (kutoka data). Maelezo: "Hesabu ya 13/10 ilikosewa: 6 badala ya 1 (Chief, 02/11)", pamoja na rejea ya journal ya 13/10.
2. SQL ya transaction moja:
   - stock movement ADJUSTMENT **−5** (6 → 1), bei 53,000, rejea `MAREKEBISHO-COUNT-ADJ-ba9c1a62-…`, sababu ileile;
   - `audit_trails` (STOCK_COUNT_CORRECTION);
   - inaandikwa tu ikiwa stock bado ni 6, gharama 53,000 na hakuna mwendo tangu 13/10;
   - products.current_stock inafuata kupitia trigger, na inakaguliwa ndani ya transaction (lazima iwe 1).
3. **Hakuna** UPDATE ya gharama na **hakuna** price_history.
4. Ukaguzi baada: stock 1, gharama 53,000, thamani 53,000, journal mara moja, movement na audit mara moja, delta ya TB (5100 +265,000 / 1200 −265,000), TB 0.

**Majaribio (Docker-local, nakala ya 29/10):**
- kagua 10/0;
- andika 18/0;
- kurudia 18/0 (yote yanarukwa);
- resume pande zote mbili, 18/0 kila moja:
  - movement ipo, journal haipo → journal tu;
  - journal ipo, movement haipo → SQL tu.
- Controls 4/4 zimekamatwa, na hakuna kilichoandikwa:
  - mauzo baada ya 13/10;
  - gharama imebadilika;
  - Oktoba CLOSED;
  - data imebadilika baada ya preview.
- Njia ya server (bash + ficha.awk): kagua 10/0.
- cmd fakes 8/8:
  - bila log ya 62 → IMEKATALIWA;
  - KAGUA → SIMAMA-PREVIEW;
  - simama;
  - root;
  - password tupu;
  - ANDIKA → ---OK---;
  - kurudia;
  - KAGUA upya.
- Nakala ya local imerudishwa (stock 6). Hakuna `*-kagua-prod.json` iliyobaki kwenye folda ya steps.

**Mpangilio wa prod:** 63 KAGUA → nitumie log → 63 ANDIKA → 64 KAGUA → nitumie log → 64 ANDIKA. Usifunge Oktoba kabla ya hapo.

## 2. Matokeo ya uamuzi wa Chief kwa historia (kusoma tu, sijabadilisha kitu)

Ikiwa chupa moja ni 53,000, basi kosa la kwanza lilikuwa **septemba**, si 13/10 peke yake:
- Manunuzi ya 07/09 na 22/09 yaliingizwa kama kifurushi 1 = chupa 6, kwa 8,833.33 kila chupa. Kila moja liliongeza chupa 5 za uongo.
- Hesabu za 13/09 (−4, 35,333.32) na 03/10 (−5, 44,166.65) ziliandika upotevu (5100) wa chupa hizo zisizokuwepo.
- Mauzo ya 30/09 yalipata COGS 8,833.33 badala ya 53,000.

Jumla ya faida haibadiliki, kwa sababu 53,000 kwa chupa ilienda kwenye gharama kwa njia zote mbili. Ila mgawanyo kati ya COGS na upotevu si sahihi.

Bidhaa bado ina pieces_per_package 6 na bei ya kifurushi 336,000. Yameandikwa kwenye BAADA-YA-BATCH §3.

## 3. BAADA-YA-BATCH §3

Imeandikwa upya:
- uamuzi wa Chief;
- matokeo ya kihistoria hapo juu;
- **SKU 4 za Jagger**: 886dc1ed JAGGER MASTER 53,000; 4d727520 JAGER MASTER 42,000; 4453f20a JAGER MASTER 29,000; 6dc452f6 JAGGER MASTER 20,000.
  Majina yaonyeshe saizi; zenye saizi moja ziunganishwe, nyingine zibadilishwe majina. Orodha ya saizi halisi itoke kwa Chief kwanza.
- Maelezo ya zamani ("kifurushi cha 6 sahihi") yamefutwa.

**Inayofuata:** (bv) ikifika. Vinginevyo onyo la manunuzi, kisha B5.
