# Toleo 2 (2.3.0) — orodha D (26/10/2026)

Orodha tu. Hakuna code iliyobadilishwa.

## D1. `last_login_at` haiandikwi kamwe

**Ushahidi.** Root ilipata HTTP 200 tarehe 22/10, lakini `last_login_at` bado ni null. Hivyo ndivyo hali-root na 53 zilivyoonyesha kwa akaunti zote.

**Chanzo:**
- `src/main/java/com/Lsms/uaa/entity/User.java:319` ina `updateLastLogin()`. Inaweka `lastLoginAt = now()` **na** `updatedAt = now()`.
- Hakuna mahali inapoitwa. `grep -rn updateLastLogin` inaonyesha ufafanuzi wake tu.
- `src/main/java/com/Lsms/uaa/Controller/AuthController.java:123` ni `loginAttemptService.loginSucceeded(...)`. Kisha mstari 126 unasoma user, na mstari 130 unakagua `user.canLogin()`. Login iliyofanikiwa haiandiki chochote kwenye `users`.
- Login zilizofanikiwa haziandikwi hata kwenye log ya backend. `AuthController.java:197` inaandika zilizoshindwa tu.

**Pendekezo la 2.3.0:**
- Baada ya `canLogin()` kupita, andika `last_login_at` peke yake. Tumia `UPDATE users SET last_login_at = now() WHERE id = ?` (`@Modifying`), si `updateLastLogin()`.
- **Sababu:** `updateLastLogin()` inabadilisha pia `updated_at`. Hiyo ingeifanya hali-root (inayolinganisha `updated_at`) iseme IMEBADILIKA kila mtu akiingia kati ya KABLA na BAADA.
- Ongeza mstari mmoja wa log ya INFO kwa login iliyofanikiwa (email + IP halisi kutoka X-Forwarded-For). Ushahidi wa aina ya 56 usitegemee nginx peke yake.
- **Majaribio:** login 200 → `last_login_at` imewekwa na `updated_at` haijabadilika. Login 401 → hakuna kinachobadilika.

## D2. `backup_20260930_journal_entry` ndani ya DB ya prod

**Ilivyo:**
- Ni nakala ya journals 3,790 za injini ya zamani (22/06 → 30/09), iliyotengenezwa kwa mkono 30/09 kabla GL haijajengwa upya. Haina FK.
- Marejeo yake 25 kwa `admin@admin.com` (`posted_by`) yanaruhusiwa na 55.

**Code (imethibitishwa 26/10):**
- Hakuna marejeo ya jedwali hili kwenye backend: java, sql, migration, xml, properties, yml. Pia hakuna kwenye V3 `src/`.
- Linatajwa tu kwenye `analysis/` (RIPOTI.md, NAKALA.md, 01-gl-config-vipindi.sql na 55).

**Bado kuthibitisha kwenye DB ya prod (KUSOMA TU, kwenye hatua ya kusoma ya 2.3.0):**
- view, materialized view, function au trigger inayolitegemea: `pg_depend` / `pg_rewrite` / `pg_views.definition` / `pg_matviews.definition` / `pg_proc.prosrc`;
- ukubwa wake (`pg_total_relation_size`) na idadi ya safu.

**Mpango (baada ya uthibitisho, kwa hatua za staging kwanza):**
1. `pg_dump --data-only -t public.backup_20260930_journal_entry` kwenda `~/backups/backup_20260930_journal_entry-<saa>.sql` (chmod 600). Kisha sha256 na idadi ya `COPY`, ziandikwe kwenye `analysis/gl-audit/NAKALA.md`, na nakala ipelekwe B2 pamoja na dump ya usiku.
2. Restore ya majaribio ya faili hilo kwenye DB ya muda. Idadi ya safu lazima iwe sawa (3,790).
3. Hatua ya kuandika, yenye kinga: kama hakuna kitu kinacholitegemea (`pg_depend` = 0), `DROP TABLE public.backup_20260930_journal_entry;` ndani ya transaction. Inafanyika baada ya 55, kwa sababu 55 inalitaja kama rejeo linaloruhusiwa.
4. Hili si migration ya Flyway. Jedwali halikuundwa na Flyway, kwa hiyo linaondolewa kwa hatua ya mmiliki, si kwa toleo.

**Kanuni:** kanuni ya kusimama kabla ya kitu kisichorudishwa inatumika. Kabla ya DROP, mmiliki athibitishe tena kwamba nakala (hatua 1–2) ipo na imerudishwa kwa mafanikio.
