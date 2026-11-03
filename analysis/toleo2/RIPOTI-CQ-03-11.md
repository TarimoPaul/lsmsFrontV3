# RIPOTI (cq) — 03/11/2026

nimesoma hadi (cq).

## 1. "Muhtasari wa Mauzo": wapokeaji
Backend release/2.4.0 = **5abe484** (fast-forward kutoka feature/cq-muhtasari).
Backend `feature/cq-muhtasari`, juu ya release/2.4.0 6694b0b. Badiliko liko kwenye `NotificationService`.
- **Wapokeaji** = role ina `SALES_READ` + status **ACTIVE** + **si locked** + si kufutwa.
- **Fallback ya "watumiaji wote walio active" imeondolewa.** Kama hakuna anayestahili, haitumwi kabisa (log WARN). Zamani ingetumwa kwa kila mtumiaji, hata wasio na `SALES_READ`.
- Kwenye dump ya prod 29/10, status na locked zimesomwa moja kwa moja kutoka faili la dump (nakala ya Docker-local imebadilishwa na E2E).
  Wapokeaji ni walewale 3: Jess Saimon, macheda, Paul Tarimo. Wote ni ACTIVE na si locked.

## 2. CHAGUO la Chief: faida kwa nani
- Env **`DAILY_SALES_PROFIT_ROLES`**, ambayo application.properties inaisoma kama `lsms.daily-sales.profit-roles`. Ni orodha ya majina ya role, kwa koma; herufi kubwa/ndogo na nafasi hazijalishi.
- **Tupu (default) = wote wanaona faida, kama leo.** Hakuna kinachobadilika mpaka Chief aamue.
- `DAILY_SALES_PROFIT_ROLES=CEO,Executive CEO`:
  - Jess na Paul wanaona faida.
  - **macheda (MANAGER, SALES) anapata mauzo tu**: "Mauzo ya <tarehe>: Miamala n | Jumla TZS …", na `totalProfit` = null. V3 tayari inaficha mstari wa faida ukiwa null, kwa hiyo hakuna mabadiliko ya V3.
- Kuwasha ni mstari kwenye `.env` ya prod, pamoja na `environment:` ya compose, kisha restart ya backend. Hakuna build.

## 3. Hatua 73 / kinga: prefix ya hex 8 tu
- `73-kinga-hash.sh` sasa inatuma **hex 8 za kwanza** tu za sha256("lsms-kinga-v1:" + thamani). Hash nzima haitoki server.
- Faili `%USERPROFILE%\.lsms-kinga\prod-siri.sha256` lina prefix tu.
- Kinga inalinganisha prefix. Faili lenye hash nzima (muundo wa zamani) linakataliwa kwa ujumbe "Endesha 73 upya".
- 73 **haikuwa imeendeshwa**: hakuna log wala faili la hash, kwa hiyo hakuna kitu cha zamani cha kufuta.
- Prefix ya bits 32: uwezekano wa siri ya majaribio kugongana na ya prod kwa bahati ni karibu 1 kwa bilioni 4 kwa kila siri. Ikitokea, kinga inakataa tu (salama upande wa kukataa); `init` mpya inatatua.

## 4. Majaribio
| Jaribio | Matokeo |
|---|---|
| `DailySalesSummaryNotificationTest` (wapokeaji, default faida kwa wote, chaguo CEO, hakuna fallback) | 4/0 |
| ↳ control: vichujio vya status/locked vimeondolewa | 2 zimekamatwa |
| `DailySalesProfitRolesPropertyTest` (env haipo → tupu; env → roles) | 2/0 |
| `siri-majaribio.sh`, pamoja na 10c "hash nzima inakataliwa" na 10d "prefix 8" | 17/17 |
| ↳ controls 3 (kinga imezimwa, faili la hash, ukaguzi wa hash nzima) | zote zimekamatwa |
| `73-kinga-hash.sh`, pamoja na "prefix 8 tu, hakuna hex ≥ 9" | 10/10 |
| ↳ control: hash nzima | imekamatwa |
| `73-kinga-hash.cmd` (fakes) | 5/5 |
| Suite (baada ya mstari wa property) | 576/0/1 |
| pg-checks (prefix ya kubuni) | 7/7 |
| c2-check (prefix ya kubuni) | C2_OK 2/2 |

## 5. Ifuatayo: C3
