# RIPOTI (co, cp) — 03/11/2026

nimesoma hadi (cp). Herufi tangu ripoti iliyopita (cn): **(co), (cp)**.

## 1. (co) "Muhtasari wa Mauzo" itatumwa kila usiku
Sahihisho limepokelewa: prod iko **Contabo, inafanya kazi saa 24**. Kwa hiyo baada ya deploy ya 2.4.0, `DailySalesNotificationScheduler`
(cron `0 0 0 * * *`, TZ Africa/Dar_es_Salaam) itatuma notification `DAILY_SALES_SUMMARY` **kila usiku saa 00:00**:
"Mauzo ya <jana>: Miamala n | Jumla TZS … | **Faida** TZS …".

**Wapokeaji** = kila mtumiaji asiyefutwa ambaye role yake ina `SALES_READ` (`UserRepository.findUsersByPermissionName`).
- Hali ACTIVE au locked **haiangaliwi**.
- Kama hakuna hata mmoja, inatumwa kwa watumiaji wote walio active.

Orodha kwenye dump ya prod 29/10 (nakala ya Docker-local, kusoma tu):

| Jina | Email | Role | PROFIT_REPORT |
|---|---|---|---|
| Jess Saimon | jess@elikom.co.tz | Executive CEO | ndiyo |
| macheda macheda | macheda@gmail.com | MANAGER, SALES | ndiyo |
| Paul Tarimo | tarimo@gmail.com | CEO | ndiyo |

Wote 3 tayari wana ruhusa ya kuona faida, kwa hiyo hakuna anayeona kitu kipya kisichomhusu.
**Siku ya deploy orodha ikaguliwe tena** kwenye nakala ya `lsms_audit_*` ya siku hiyo, kwa query hii (kusoma tu):
```sql
select u.first_name||' '||u.last_name, u.email, string_agg(distinct r.name, ',')
from users u join user_roles ur on ur.user_uid = u.uid join roles r on r.uid = ur.role_uid
join role_permissions rp on rp.role_uid = r.uid join permissions p on p.uid = rp.permission_uid
where p.name = 'SALES_READ' and p.is_active and not u.is_deleted group by 1, 2 order by 1;
```
Imeandikwa pia kwenye MATAWI → "Mpango wa deploy 2.4.0, taarifa kwa watumiaji".

**Marejeo ya EC2 yaliyosahihishwa:**
- RIPOTI-CN-03-11: mstari wa "EC2 huzimwa" umepigwa mstari na kuongezwa sahihisho.
- RIPOTI-CD-CE-02-11 §3: sahihisho limeongezwa. Hitimisho la TZ halibadiliki, kwa sababu linasimama juu ya kuhama kwa saa za mauzo
  tarehe 17/06, si juu ya server kuzimwa.
- MATAWI: halikutaja EC2.
- memory yangu: imesahihishwa.

## 2. (cp) Siri za majaribio + kinga
Backend `feature/cp-siri-majaribio` = **6694b0b**, imeunganishwa kwa fast-forward kwenye **release/2.4.0**. Ni scripts tu, hakuna `src`.
- **`deploy/local/siri-majaribio.sh`**:
  - `pg-checks.sh` na `c2-check.sh` zinaipakia zenyewe kutoka **`deploy/local/.siri-majaribio`** (gitignored).
  - Faili hilo linatengenezwa kwa `bash deploy/local/siri-majaribio.sh init` (siri za nasibu). Nimelitengeneza kwenye Lsms-c2 na Lsms-release-240.
  - Inakataa kwa ujumbe wazi kama: faili halipo, thamani haipo, au JWT si base64 ya bytes ≥ 32. Hilo ndilo lilikuwa kosa la "Illegal base64" la (cn).
  - Thamani zilizoko tayari kwenye shell hazihesabiwi.
- **Kinga:**
  - JWT, root na password ya DB zinalinganishwa na `%USERPROFILE%\.lsms-kinga\prod-siri.sha256`. Hiyo ni sha256 ya "lsms-kinga-v1:" + kila siri ya `.env` ya prod.
  - Faili la hash likikosekana → kataa. Siri yoyote ikilingana → kataa.
  - Vyote hivi vinatokea kabla container yoyote au mvn haijaanza.
- **Hatua mpya `analysis\steps\73-kinga-hash.cmd`** (+ `.sh`): PROD, **kusoma tu**.
  - Inasoma `.env` KWENYE server na kurudisha hash tu, kupitia ficha.awk.
  - Faili la hash linaandikwa nje ya git. Log ina majina ya siri na idadi tu, haina hash.
  - **HAIJAENDESHWA. Mpaka Chief aiendeshe, pg-checks na c2-check ZINAKATAA**, kwa ujumbe unaomtaja 73.

**Majaribio:**

| Jaribio | Matokeo |
|---|---|
| `siri-majaribio.sh` (faili haipo, base64 mbaya/fupi, hash haipo, safi, JWT/root/DB = prod, hash CRLF, env ya shell, hash tupu, CR, init mara 2) | 15/15 |
| ↳ control: kinga imezimwa | 4 zimekamatwa |
| ↳ control: ukaguzi wa faili la hash umezimwa | 1 imekamatwa |
| Mwisho-kwa-mwisho: pg-checks na c2-check bila faili | zote zinakataa, container 0 |
| Mwisho-kwa-mwisho: kwa faili la hash la kubuni (halilingani) | PG_CHECKS_OK 7/7, C2_OK 2/2 |
| `73-kinga-hash.sh` (`.env` ya kubuni: quotes, export, si-siri zinarukwa, thamani haitoki, `.env` haipo) | 9/9 |
| `73-kinga-hash.cmd` (ssh/scp za kubuni; ok, alama haipo, idadi 0, ssh rc, scp) | 5/5 |
| ↳ control: ukaguzi wa alama umezimwa | 1 imekamatwa |

Hitilafu 2 zilizopatikana na kurekebishwa wakati wa kujaribu:
- `openssl` ya mingw inaongeza `\r`, kwa hiyo `init` ingeweka `\r` ndani ya JWT.
- `findstr /x` haikutambua alama ya mwisho kwenye output ya ssh yenye LF tu. Sasa inatumia `:mstari_pekee` ya 71f.

## 3. Ifuatayo: C3
