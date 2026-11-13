# HATUA 94 (mmiliki 13/11 gu) - KABLA ya push-yote: kagua KILA toleo la kila faili la analysis/ lililo kwenye commit
# ambazo HAZIJAPUSHWA (origin/main..main), si HEAD tu - historia ndiyo inayopushwa.
#   python analysis/steps/94-kagua-siri.py [repo] [base]     (default: repo hii, base origin/main)
# Inatafuta: token / password / secret / api key yenye thamani, ghp_ / github_pat_ / gho_ / glpat-, URL yenye user@,
#   Bearer <tokeni>, JWT (eyJ..), bcrypt ($2a$), mistari ya .env yenye thamani (majina ya siri), IP za umma,
#   user@IP / ssh -i, docker login -p, B2 / rclone keys; na KINGA YA HATUA 73: kila neno -> sha256("lsms-kinga-v1:" + neno),
#   hex 8 za kwanza zikilingana na prefix yoyote ya %USERPROFILE%\.lsms-kinga\prod-siri.sha256 = SIRI YA PROD.
# Haichapishi thamani yoyote inayoshukiwa: jina la faili, commit, mstari, aina, na herufi 3 za kwanza + urefu tu.
# Matokeo: KAGUA_SIRI_SAFI au KAGUA_SIRI_IMEPATA <n> (exit 1).
import hashlib, os, re, subprocess, sys

repo = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
base = sys.argv[2] if len(sys.argv) > 2 else 'origin/main'
scope = sys.argv[3] if len(sys.argv) > 3 else 'analysis'   # pathspec: 'analysis' (V3), '.' (repo nzima)
git = lambda *a: subprocess.run(['git', '-C', repo, *a], capture_output=True, check=True).stdout

hf = os.path.join(os.path.expanduser('~'), '.lsms-kinga', 'prod-siri.sha256')
prefixes = {}
if os.path.exists(hf):
    for l in open(hf, encoding='utf8'):
        p = l.split()
        if len(p) == 3 and p[0] == 'HASH':
            prefixes[p[2].lower()] = p[1]
print(f'KINGA_73 prefix {len(prefixes)} ({", ".join(sorted(prefixes.values())) or "HAKUNA FAILI"})')

PAT = [
    ('github-token', re.compile(r'\b(ghp_|gho_|ghu_|ghs_|github_pat_|glpat-)[A-Za-z0-9_]{10,}')),
    ('url-yenye-user', re.compile(r'\b[a-z][a-z0-9+.-]*://[^/\s:@"\'<>]+(:[^@\s"\'<>]*)?@[^\s"\']+', re.I)),
    ('bearer', re.compile(r'\bBearer\s+[A-Za-z0-9._~+/=-]{16,}')),
    ('jwt', re.compile(r'\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}')),
    ('bcrypt', re.compile(r'\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}')),
    ('env-siri', re.compile(r'\b[A-Z][A-Z0-9_]*(PASSWORD|PASS|SECRET|TOKEN|API_KEY|ACCESS_KEY|PRIVATE_KEY|ACCOUNT_ID)\s*=\s*(?!\$|\{|\*|<|"?\$)[^\s"\'*]{4,}')),
    ('neno-siri', re.compile(r'\b(password|passwd|pwd|secret|token|api[_-]?key)\b\s*[:=]\s*["\']?(?!\$|\{|\*|<|\(|null|none|true|false|undefined|haionekani|tupu)[A-Za-z0-9!@#%^&+/=._-]{6,}', re.I)),
    ('docker-login-p', re.compile(r'docker\s+login\b[^\n]*\s(-p|--password)\s+(?!-)\S+')),
    ('ssh-key-faili', re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----|\bssh -i\s+\S+')),
    ('user@ip', re.compile(r'\b[a-z_][a-z0-9_.-]*@(\d{1,3}\.){3}\d{1,3}\b', re.I)),
    ('ip-ya-umma', re.compile(r'\b(?!(?:10|127|0)\.)(?!192\.168\.)(?!172\.(?:1[6-9]|2\d|3[01])\.)(?:\d{1,3}\.){3}\d{1,3}\b')),
]
SPLIT = re.compile(r'[\s"\'`,;()\[\]{}<>|]+')


def ip_ok(m):  # versions like a.b.c.d of libraries are not IPs worth reporting when a part > 255
    return all(0 <= int(x) <= 255 for x in re.findall(r'\d+', m.group(0))[:4])


revs = git('rev-list', f'{base}..HEAD').decode().split()
blobs = {}  # (path, blob) -> first commit seen
for c in revs:
    out = git('diff-tree', '-r', '--no-commit-id', '--root', '-M', c, '--', scope).decode()
    for l in out.splitlines():
        meta, _, path = l.partition('\t')
        f = meta.split()
        if len(f) >= 5 and f[3] != '0' * 40 and f[4][0] != 'D':
            blobs.setdefault((path.split('\t')[-1], f[3]), c[:7])
print(f'COMMIT {len(revs)} ({base}..HEAD) | matoleo ya faili ({scope}) {len(blobs)} | faili {len({p for p, _ in blobs})}')

hits = []
for (path, blob), c in sorted(blobs.items()):
    data = git('cat-file', '-p', blob).decode('utf8', 'replace')
    for no, line in enumerate(data.splitlines(), 1):
        for name, rx in PAT:
            for m in rx.finditer(line):
                if name == 'ip-ya-umma' and not ip_ok(m):
                    continue
                v = m.group(0)
                hits.append((path, c, no, name, f'{v[:3]}...({len(v)})', line.strip()[:0]))
        if prefixes:
            toks = set(SPLIT.split(line))
            for t in list(toks):
                if '=' in t: toks.add(t.split('=', 1)[1])
                if ':' in t: toks.add(t.split(':', 1)[1])
            for t in toks:
                if len(t) >= 4 and hashlib.sha256(('lsms-kinga-v1:' + t).encode()).hexdigest()[:8] in prefixes:
                    hits.append((path, c, no, 'KINGA_73:' + prefixes[hashlib.sha256(('lsms-kinga-v1:' + t).encode()).hexdigest()[:8]], f'{t[:3]}...({len(t)})', ''))

for h in hits:
    print(f'IMEPATA {h[0]} | commit {h[1]} | mstari {h[2]} | {h[3]} | {h[4]}')
files = sorted({p for p, _ in blobs})
bad = {h[0] for h in hits}
for p in files:
    print(f'FAILI {p} | {"ANGALIA" if p in bad else "SAFI"}')
print(f'KAGUA_SIRI_IMEPATA {len(hits)}' if hits else 'KAGUA_SIRI_SAFI')
sys.exit(1 if hits else 0)
