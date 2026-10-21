# Nakala za data ya prod kwenye PC

Folda: `D:\MY PROJECT\DUKA PROJECT\backups\`. Hashes zimepimwa 2026-10-15 kwa `sha256sum`. Uhalali wa kila dump umethibitishwa kwa `pg_restore --list` (exit 0).

## Faili za .dump (zisifutwe)

| Faili | Ukubwa (bytes) | sha256 | pg_restore --list | Database ya PC iliyotoka kwake |
|---|---|---|---|---|
| `prod_Lsms_20260927_2146.dump` | 6,125,045 | `3c2356157230e9fa1e2f4f67e03a15d103485f7c293568532a286069d8c01082` | entries 1,014, OK | `lsms_prod_20260927` (imefutwa 15/10) |
| `prod_Lsms_20260929_2252.dump` | 6,201,579 | `a761e3bc5aa145168d0d44c5316df450b3487e7d0a76919f1b7bb3f8f717329f` | entries 1,014, OK | `lsms_prod_20260929` (imefutwa 15/10) |
| `prod_Lsms_20260930_1026_before_gl.dump` | 6,212,652 | `a294c8ccd2206c871ee7af22815ffdc7d9959cdfac6624b728e58686938e3935` | — | hakuna |
| `lsms_20261004_0200.dump` | 7,870,299 | `e2f9a706675b734aa01fa812ab983cdfccd3f6eb0c00c17cef6ceaa1f5c0f97c` | — | `lsms_audit_1004` (haiguswi) |
| `lsms_20261014_0200.dump` | 8,429,699 | `fb09666d36951e6275b10e136e37862f8c9037d0d89bb37b42b583ccb4b04d0f` (= Contabo = B2, hatua 33) | — | `lsms_audit` (haiguswi, RIPOTI.md inairejelea) |
| `lsms_20261015_0200.dump` | 8,477,442 | `52e34fe4c52f1597b9fcb49452a9786f0dae4dc17f6cf83322b4a37d14cbd6d2` (= Contabo = B2, hatua 35) | entries 1,125, OK | `lsms_audit_20261015_0200`, iliyorejeshwa 2026-10-15 13:53 kwa `pg_restore -j 1 --no-owner --no-privileges`. **Database ya kazi ya Capital/GL** |

## Database za kufutwa (DROP DATABASE)

| Database | Ukubwa | Hali kabla ya kufuta | Dump inaweza kuirudisha? |
|---|---|---|---|
| `lsms_prod_20260927` | 74 MB | Flyway 121 (ya mwisho 2026-09-08); journal_entry 4,540; ilitumika kwa data fix + GL rebuild ya 27/09 | **Hapana, si kamili.** Dump inarudisha hali ya prod ya 27/09 21:46, si marekebisho yaliyofanywa juu yake |
| `lsms_prod_20260929` | 78 MB | Flyway 122 (2026-09-28); journal_entry 4,585; ina `backup_20260929_capex`, `backup_20260929_injections`, `backup_20260929_purchases` (hazimo kwenye dump); ilitumika kwa rehearsal ya GL ya 30/09 | **Hapana, si kamili**, kwa sababu ileile |

Rehearsal hizo zilikwisha kazi yake: GL ya prod ilijengwa upya 30/09 10:26. Hali ya kabla ya hapo iko kwenye `prod_Lsms_20260930_1026_before_gl.dump` na kwenye majedwali ya `backup_20260930_*` ya prod.

| Database | Ilifutwa lini | Na nani |
|---|---|---|
| `lsms_prod_20260927` | 2026-10-15 13:29:32 (EAT), `DROP DATABASE` | Claude, kwa idhini ya mmiliki (15/10) |
| `lsms_prod_20260929` | 2026-10-15 13:29:32 (EAT), `DROP DATABASE` | Claude, kwa idhini ya mmiliki (15/10) |

## Haziguswi

`lsms_audit` (14/10), `lsms_audit_1004` (04/10). `lsms_audit_20261015_0200` inatumika kwa kusoma tu.
