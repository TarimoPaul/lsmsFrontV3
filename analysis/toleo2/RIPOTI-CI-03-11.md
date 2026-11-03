# RIPOTI (ci) — 03/11/2026

nimesoma hadi (ci). Herufi tangu ripoti iliyopita (ch): **(ci)** tu.

## 1. C4 imetoka kwenye batch
- BAADA-YA-BATCH §7: C4 (backend feature/sales-returns 9425223, V3 e199712), kazi iliyokadiriwa, njia ya majaribio.
- MATAWI.md:
  - jedwali la matawi: feature/sales-returns (backend + V3) "nje ya kifurushi (ci)";
  - orodha ya kifurushi: ✔ A1–A6, ✔ B, ✔ C1 → C2 → C3 → C5/C8 → C6 → C7 → C9;
  - mstari wa zamani "build inahitaji application.properties ya main" umesasishwa (C1 imeiweka kwenye git).
- C7 (SaleReturnService iliyokufa) inabaki; ina marejeo kwenye CustomerService, SalesRepository, SalePaymentService — C7 itaonyesha
  kilicho kweli kimekufa kabla ya kuondoa.
- Makadirio yaliyobaki (03/11 → 16/11): ≈ siku 9.9.

## 2. Kanuni ya pili ya onyo la manunuzi (kwa uamuzi wako)
**Nini:** onyo lilelile "Kreti au chupa?" pia pale gharama/kipande ya ununuzi ni **< ⅓ ya bei ya kuuza kipande, au > bei ya kuuza**
(haikatai). **Kwa nini:** kanuni ya ×3-ya-mwisho haioni kosa lililokuwepo tangu ununuzi wa kwanza (Jagger 1L "kreti" tangu 22/06:
8,833 dhidi ya bei 60,000). **Gharama:** saa 2–3, V3 tu (njia 3 za manunuzi + e2e).

Kipimo kwenye nakala ya 29/10 (manunuzi 2026: 2,210): ingeonya **13** (bidhaa 3), hakuna "> bei ya kuuza":
- JAGGER MASTER ×4 (8,500–8,833 dhidi ya 60,000) — kosa linalojulikana;
- GORDONS ×1 (17/03: 3,483 dhidi ya 40,000, kifurushi 12) — inaonekana kosa lilelile (chupa 1 kama kreti ya 12), haijachunguzwa;
- SINGSUNG MAJI ×8 (350–367 dhidi ya 1,200) — huenda ni faida halisi ya maji; hapa onyo lingekuwa kelele.

## 3. Hatua 72 — release ya C1 kwenye PC (IMEANDALIWA, HAIJAENDESHWA)
`analysis\steps\72-c1-siri-dev.cmd` (+ `.py`). **Iendeshwe KABLA ya merge ya release/2.4.0 → main.**

Kwa nini kabla: kwenye main, faili la siri za dev (`src\main\resources\application.properties`) ni **ignored**. Git inachukulia
faili ignored kama "expendable": merge ingeliandika juu yake **kimya**, na siri za dev zingepotea bila onyo.

Mtiririko:
1. **KAGUA** (kusoma tu): main iko kwenye `main` na haina release bado; la zamani halifuatiliwi; `config\application.properties`
   haipo; .gitignore ya release ina `/config/application.properties`. Inaorodhesha **majina** ya funguo zitakazohamia (kwenye PC yako
   ni 3: `jwt.secret`, `spring.datasource.password`, `spring.datasource.url`).
2. 🛑 **HAMISHA**: nakala ya faili la zamani NJE ya repo (`D:\MY PROJECT\DUKA PROJECT\Lsms\c1-kabla-application.properties-<saa>`,
   sha256 inalinganishwa) → `Lsms\config\application.properties` (funguo hizo tu) → ukaguzi: release + config = faili la zamani kwa
   kila funguo → kisha la zamani linafutwa.
3. 🛑 **ANZA**: `mvnw package` kwenye worktree ya release (lazima iwe safi na kwenye HEAD) → `java -jar` kutoka `Lsms` (cwd), env za
   siri zote zimeondolewa (DB_PASSWORD, JWT_SECRET, SPRING_DATASOURCE_*, …), port 18096 → inasubiri "Started" → `POST /api/auth/login`
   ya mtumiaji asiyekuwepo lazima ijibu **401** (DB inasomwa) → backend inazimwa.
   - Inatumia DB yako ya dev kama run ya kawaida ya dev (ddl-auto=update + initializers; schedulers zimezimwa).
- Haichapishi thamani ya siri yoyote: majina ya funguo na sha256 fupi tu. Rerun baada ya HAMISHA → "TAYARI" → ANZA tu.

**Majaribio** (repo bandia = clone ya Lsms main c98fa07 + release/2.4.0 376a31d; DB = Docker-local; Lsms halisi na DB ya dev
hazikuguswa):
| # | kesi | matokeo |
|---|---|---|
| T1 | njia kamili kupitia `.cmd` (HAMISHA → ANZA), env DB_PASSWORD/JWT_SECRET za uongo zikiwa zimewekwa | 9/9: ---OK---, la zamani limefutwa, config funguo 3, nakala nje ya repo = la zamani, **Started LsmsApplication in 17 s**, login **401**, env zimeondolewa, hakuna siri kwenye output/log, merge ya release baada ya hatua inapita na config haiguswi |
| T2 | rerun baada ya HAMISHA | TAYARI → ANZA → ---OK--- |
| T3 | jibu "hapana" kwenye HAMISHA | exit 2, hakuna kilichobadilika, hakuna nakala; KAGUA inaorodhesha funguo 3; hakuna siri |
| T4 | main tayari ina release (merge imefanyika) | IMESHINDWA kabla ya kubadilisha kitu |
| T5 | **udhibiti:** password mbaya kwenye faili, password SAHIHI kwenye env (DB_PASSWORD + SPRING_DATASOURCE_PASSWORD) | backend HAIJAWAKA → ---IMESHINDWA---, port iko wazi baada. Inathibitisha kwamba env inaondolewa na siri zinatoka config tu |
| T6 | config ipo PAMOJA na la zamani | IMESHINDWA, config haiguswi |
| — | log halisi `analysis\steps\72-c1-siri-dev.log` | haikuandikwa na majaribio |

Jumla: **19/19**. Udhibiti wa ziada usiopangwa: mwendesho wa kwanza wa T1 ulitumia jwt bandia ya base64-URL (`_`); hatua ilikamata
(`jwtUtils: Illegal base64 character 5f` → HAIJAWAKA → IMESHINDWA). Hilo lilikuwa kosa la harness; baada ya kurekebisha harness, T1/T2
zimepita. Harness: scratchpad `t72\t72.py`.
Athari: Docker-local imeguswa na ddl-auto=update + initializers za boot hizo (nakala ya kutupwa).

## 4. V039 → BAADA; kanuni ya skripti ya staging
MATAWI.md sasa ina kanuni (ci): skripti ya staging ya kifurushi **inarudisha staging kutoka dump ya prod ya karibuni** (siyo nakala
safi) na inakagua Flyway: V135→V138 `success`, hakuna validate error kwenye log ya boot, safu za V039 na V056 kwenye
`flyway_schema_history` sawa kabla na baada (version, description, checksum, installed_on). Skripti yenyewe inaandikwa mwisho wa
kifurushi.

## 5. Inayofuata
**C2** (harness ya `:x IS NULL` + `Object[]` kwa beans halisi kwenye PG15 yenye data).

Inasubiri uamuzi wako: kanuni ya pili ya onyo (§2). Hatua 72 ni yako kuendesha (kabla ya merge).

## origin dhidi ya local
| repo | tawi | local | origin | hali |
|---|---|---|---|---|
| Backend | release/2.4.0 | 376a31d | 376a31d | SAWA |
| Backend | main | c98fa07 | c98fa07 | SAWA |
| V3 | release/3.2.0 | 28afa80 | 28afa80 | SAWA |
| V3 | main (kabla ya commit ya ripoti hii) | c875238 | c875238 | SAWA |

push-yote 13:11 ---OK--- (release/2.4.0 0d1ee71..376a31d, release/3.2.0 c540ab8..28afa80). Log yake imecommitiwa na ripoti hii.
