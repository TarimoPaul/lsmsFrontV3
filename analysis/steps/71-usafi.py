"""HATUA 71 - USAFI (mmiliki 29/10 al, am, ao). Injini ya 71-usafi.cmd; inasoma 71-orodha.txt PEKE YAKE.

  python -I -X utf8 71-usafi.py andaa <folda>                 zip + orodha ya ndani + sha256 + kufungua na kulinganisha
  python -I -X utf8 71-usafi.py muhtasari <folda>             kinachoondolewa (KUSOMA TU) - kwa kituo cha SAFISHA
  python -I -X utf8 71-usafi.py ondoa <folda> SAFISHA <b2sha> kuondoa, BAADA ya zip kuthibitishwa D + B2

andaa haiondoi chochote. Zip ikiwepo tayari (pamoja na .sha256 na .txt), inathibitishwa tu, haiundwi upya.
ondoa: kila chanzo kinalinganishwa na sha256 yake ya wakati wa zip; kilichobadilika HAKIGUSWI (BADILIKA).
Hakuna commit: faili za git zinaondolewa kwa `git rm`, commit ni ya mmiliki.
"""
import hashlib, os, re, shutil, stat, subprocess, sys, tempfile, time, zipfile

HAPA = os.path.dirname(os.path.abspath(__file__))
ORODHA = os.environ.get('LSMS71_ORODHA') or os.path.join(HAPA, '71-orodha.txt')
JINA = 'analysis-archive-2026-10'
# Kuondoa kunaruhusiwa ndani ya mizizi hii tu (majaribio yanaweza kuibadilisha kwa LSMS71_RUHUSA).
RUHUSA = [p for p in (os.environ.get('LSMS71_RUHUSA') or ';'.join([
    r'D:\MY PROJECT\DUKA PROJECT',
    r'C:\Users\chief\AppData\Local\Temp\claude\D--MY-PROJECT-DUKA-PROJECT-LsmsVersion3-lsmsFrontV3',
    os.path.join(os.environ.get('APPDATA', ''), r'Microsoft\Windows\Start Menu\Programs\Startup')])).split(';') if p]
LINDA_BRANCH = {'main', 'ops/logs-flutter', 'feature/sales-returns'}
GIT = ['git', '-c', 'color.ui=never', '-c', 'core.quotepath=off', '--no-pager']


def toka(msg, rc=1):
    print(msg)
    sys.exit(rc)


def h256(b):
    return hashlib.sha256(b).hexdigest()


def hfile(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()


def ndefu(p):
    """Njia ndefu za Windows (scratchpads za ndani sana)."""
    p = os.path.abspath(p)
    return '\\\\?\\' + p if os.name == 'nt' and not p.startswith('\\\\?\\') else p


# ---------------------------------------------------------------- orodha
def soma_orodha():
    if not os.path.isfile(ORODHA):
        toka(f'SIYO: orodha {ORODHA} haipo')
    raw = open(ORODHA, 'rb').read()
    o = {'sha': h256(raw), 'REPO': {}, 'ZIP': [], 'FUTA': [], 'FUTA_FOLDA': [], 'GIT': [], 'FICHA_ROOT': None,
         'FICHA_FUNGUO': []}
    ndani = set()
    for i, line in enumerate(raw.decode('utf-8').splitlines(), 1):
        if not line.strip() or line.startswith('#'):
            continue
        c = [x.strip() for x in line.split(' | ')]
        k = c[0]
        if k == 'REPO' and len(c) == 3:
            o['REPO'][c[1]] = c[2]
        elif k == 'ZIP' and len(c) == 4 and (c[3] in ('FUTA', 'FOLDA', 'BAKI') or c[3].startswith('GITRM:')):
            if c[2] in ndani:
                toka(f'SIYO: orodha mstari {i}: "{c[2]}" imerudiwa')
            ndani.add(c[2])
            o['ZIP'].append({'chanzo': c[1], 'ndani': c[2], 'baada': c[3]})
        elif k == 'FUTA' and len(c) == 4:
            o['FUTA'].append({'njia': c[1], 'git': c[2], 'sababu': c[3]})
        elif k == 'FUTA_FOLDA' and len(c) == 3:
            o['FUTA_FOLDA'].append({'njia': c[1], 'sababu': c[2]})
        elif k in ('WORKTREE', 'TAG', 'TAG_PUSH', 'BRANCH', 'ORIGIN'):
            o['GIT'].append(c)
        elif k == 'FICHA_ROOT' and len(c) == 2:
            o['FICHA_ROOT'] = c[1]
        elif k == 'FICHA_FUNGUO' and len(c) == 2:
            o['FICHA_FUNGUO'].append(c[1])
        else:
            toka(f'SIYO: orodha mstari {i} haueleweki: {line[:120]}')
    return o


def ndani_ya_ruhusa(p):
    a = os.path.normcase(os.path.abspath(p))
    for r in RUHUSA:
        r = os.path.normcase(os.path.abspath(r))
        if a != r and a.startswith(r.rstrip('\\/') + os.sep):
            return True
    return False


# ---------------------------------------------------------------- ficha
def thamani_ya_root(o):
    p = o['FICHA_ROOT']
    if not p or not os.path.isfile(p):
        toka(f'SIYO: faili la FICHA_ROOT ({p}) halipo - haiwezekani kuficha default ya zamani ya root; zip haikuundwa')
    v = sorted(set(re.findall(r'root\.password:([^}\s]+)\}', open(p, encoding='utf-8', errors='replace').read())))
    if len(v) != 1 or len(v[0]) < 6:
        toka(f'SIYO: FICHA_ROOT ina thamani {len(v)} badala ya 1')
    return v[0].encode()


def ficha(data, root, funguo):
    alama = []
    if root and root in data:
        data = data.replace(root, b'*' * len(root))  # urefu uleule: .tar n.k. zinabaki halali
        alama.append('root')
    for k in funguo:
        rx = re.compile(rb'(?m)^([ \t]*' + re.escape(k.encode()) + rb':[ \t]*)(?![ \t]*(?:\*\*\*)?[ \t]*\r?$)[^\r\n]*')
        if rx.search(data):
            data = rx.sub(rb'\1***', data)
            alama.append(k)
    return data, ','.join(alama) or '-'


def bado_ina_siri(data, root, funguo):
    if root and root in data:
        return 'root'
    for k in funguo:
        if re.search(rb'(?m)^[ \t]*' + re.escape(k.encode()) + rb':[ \t]*(?!\*\*\*[ \t]*\r?$)[^\s]', data):
            return k
    return ''


# ---------------------------------------------------------------- manifest
def njia(folda):
    return (os.path.join(folda, JINA + '.zip'), os.path.join(folda, JINA + '.zip.sha256'), os.path.join(folda, JINA + '.txt'))


def soma_manifest(mf):
    head, rows = {}, []
    for line in open(mf, encoding='utf-8'):
        line = line.rstrip('\r\n')
        if line.startswith('# '):
            k, _, v = line[2:].partition(': ')
            head[k] = v
        elif line and not line.startswith('#'):
            s, size, sc, fl, nd, ch = line.split('\t')
            rows.append({'sha': s, 'size': int(size), 'sha_chanzo': sc, 'ficha': fl, 'ndani': nd, 'chanzo': ch})
    return head, rows


def thibitisha_zip(z, sf, mf, o):
    """sha256 ya zip = .sha256; orodha haijabadilika; kufungua kwenye folda ya muda: kila faili = manifest."""
    if not (os.path.isfile(z) and os.path.isfile(sf) and os.path.isfile(mf)):
        toka('SIYO: zip, .sha256 au .txt haipo')
    hz = hfile(z)
    hs = open(sf, encoding='ascii').read().split()[0]
    if hz != hs:
        toka(f'SIYO: sha256 ya zip {hz} si sawa na .sha256 {hs}')
    print(f'ZIP_SHA256 {hz}')
    print('ZIP_SHA256_SAWA')
    head, rows = soma_manifest(mf)
    if head.get('orodha_sha256') != o['sha']:
        toka('SIYO: 71-orodha.txt imebadilika baada ya zip kuundwa (manifest ina orodha nyingine). Hakuna kilichoguswa.')
    if head.get('zip_sha256', hz) != hz:
        toka('SIYO: manifest inataja zip nyingine')
    tmp = tempfile.mkdtemp(prefix='lsms71-')
    try:
        with zipfile.ZipFile(z) as zf:
            bad = zf.testzip()
            if bad:
                toka(f'SIYO: zip ina faili lililoharibika: {bad}')
            names = zf.namelist()
            if len(names) != len(rows) or set(names) != {r['ndani'] for r in rows}:
                toka(f'SIYO: zip ina faili {len(names)}, manifest {len(rows)}')
            zf.extractall(ndefu(tmp))
        tofauti = 0
        for r in rows:
            p = ndefu(os.path.join(tmp, *r['ndani'].split('/')))
            if not os.path.isfile(p) or hfile(p) != r['sha'] or os.path.getsize(p) != r['size']:
                tofauti += 1
                print(f'TOFAUTI {r["ndani"]}')
        if tofauti:
            toka(f'SIYO: faili {tofauti} zilizofunguliwa si sawa na manifest')
    finally:
        shutil.rmtree(ndefu(tmp), ignore_errors=True)
    print(f'ZIP_IMEFUNGULIWA faili {len(rows)} = manifest')
    print('ZIP_IMEFUNGULIWA_SAWA')
    return hz, head, rows


# ---------------------------------------------------------------- andaa
def andaa(folda):
    o = soma_orodha()
    print(f'ORODHA {ORODHA} sha256 {o["sha"]} ZIP {len(o["ZIP"])} FUTA {len(o["FUTA"])} FUTA_FOLDA {len(o["FUTA_FOLDA"])} GIT {len(o["GIT"])}')
    z, sf, mf = njia(folda)
    if os.path.isfile(z) and os.path.isfile(sf) and os.path.isfile(mf):
        print('ZIP_ILIKUWEPO - inathibitishwa tu, haiundwi upya')
        thibitisha_zip(z, sf, mf, o)
        print('FICHA_SAWA (iliangaliwa wakati zip inaundwa)')
        print('---ANDAA_MWISHO---')
        return
    kosa = [e['chanzo'] for e in o['ZIP'] if not os.path.isfile(e['chanzo'])]
    if kosa:
        for k in kosa[:20]:
            print(f'HAIPO {k}')
        toka(f'SIYO: vyanzo {len(kosa)} vya ZIP havipo - orodha si ya hali ya sasa; hakuna zip')
    root = thamani_ya_root(o)
    os.makedirs(folda, exist_ok=True)
    for p in (z, sf, mf):
        if os.path.exists(p):
            os.remove(p)  # mabaki ya mwendesho ulioshindwa (bila .sha256 hakuna kilichothibitishwa)
    tz = z + '.tmp'
    rows, nficha, anza = [], 0, time.time()
    with zipfile.ZipFile(tz, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for e in o['ZIP']:
            raw = open(ndefu(e['chanzo']), 'rb').read()
            data, fl = ficha(raw, root, o['FICHA_FUNGUO'])
            nficha += fl != '-'
            zi = zipfile.ZipInfo(e['ndani'], time.localtime(max(os.path.getmtime(ndefu(e['chanzo'])), 315532800))[:6])
            zi.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(zi, data)
            rows.append((h256(data), len(data), h256(raw), fl, e['ndani'], e['chanzo']))
    with zipfile.ZipFile(tz) as zf:
        for n in zf.namelist():
            s = bado_ina_siri(zf.read(n), root, o['FICHA_FUNGUO'])
            if s:
                os.remove(tz)
                toka(f'SIYO: {n} bado ina {s} baada ya kuficha - zip imefutwa')
    print(f'FICHA_SAWA faili {nficha} zimefichwa; hakuna default ya zamani ya root wala {",".join(o["FICHA_FUNGUO"])} kwenye zip')
    os.replace(tz, z)
    hz = hfile(z)
    with open(mf, 'w', encoding='utf-8', newline='\n') as f:
        f.write(f'# hatua: 71 (mmiliki 29/10 al, am, ao)\n# zip: {JINA}.zip\n# zip_sha256: {hz}\n'
                f'# orodha_sha256: {o["sha"]}\n# imeundwa: {time.strftime("%Y-%m-%d %H:%M:%S")}\n'
                f'# imeanza_epoch: {anza:.3f}\n# faili: {len(rows)}\n'
                '# sha256_ndani\tukubwa\tsha256_chanzo\tficha\tndani_ya_zip\tchanzo\n')
        for r in rows:
            f.write('\t'.join(map(str, r)) + '\n')
    with open(sf, 'w', encoding='ascii', newline='\n') as f:
        f.write(f'{hz}  {JINA}.zip\n')
    print(f'ZIP_IMEUNDWA {z} bytes {os.path.getsize(z)} faili {len(rows)}')
    thibitisha_zip(z, sf, mf, o)
    print('---ANDAA_MWISHO---')


# ---------------------------------------------------------------- git
def g(repo, *a, data=False):
    r = subprocess.run(GIT + ['-C', repo, *a], capture_output=True)
    out = r.stdout if data else r.stdout.decode('utf-8', 'replace').rstrip()  # rstrip: ' M x' ya status ibaki
    return r.returncode, out, r.stderr.decode('utf-8', 'replace').strip()


def commit_ya(repo, ref):
    rc, out, _ = g(repo, 'rev-parse', '--verify', '-q', ref + '^{commit}')
    return out if rc == 0 else ''


def worktrees(repo):
    rc, out, err = g(repo, 'worktree', 'list', '--porcelain')
    w, cur = {}, None
    for line in out.splitlines():
        if line.startswith('worktree '):
            cur = os.path.normcase(os.path.abspath(line[9:]))
            w[cur] = {}
        elif cur and ' ' in line:
            k, v = line.split(' ', 1)
            w[cur][k] = v
    return w


class Hesabu:
    def __init__(self):
        self.ok = self.tayari = 0
        self.badilika, self.kosa = [], []

    def OK(self, m):
        self.ok += 1
        print(f'OK {m}')

    def TAYARI(self, m):
        self.tayari += 1
        print(f'TAYARI {m}')

    def BADILIKA(self, m):
        self.badilika.append(m)
        print(f'BADILIKA {m}')

    def KOSA(self, m):
        self.kosa.append(m)
        print(f'KOSA {m}')


def fanya_git(o, rows, H):
    R = o['REPO']
    sha_chanzo = {r['ndani']: r['sha_chanzo'] for r in rows}
    fetched = set()
    for c in o['GIT']:
        k, key = c[0], c[1]
        repo = R.get(key)
        if not repo:
            H.KOSA(f'{" ".join(c)}: repo {key} haijulikani'); continue
        if k in ('TAG_PUSH', 'ORIGIN') and key not in fetched:
            rc, _, err = g(repo, 'fetch', 'origin', '--prune', '--tags')
            if rc:
                H.KOSA(f'git fetch {key}: {err[:200]}'); return
            rc, out, _ = g(repo, 'ls-remote', '--symref', 'origin', 'HEAD')
            if 'ref: refs/heads/main\tHEAD' not in out:
                H.KOSA(f'default ya origin ya {key} si main ({out[:80]}) - hakuna push/delete'); return
            fetched.add(key)
        if k == 'WORKTREE':
            _, _, path, br, sha, aina = c
            w = worktrees(repo).get(os.path.normcase(os.path.abspath(path)))
            if w is None:
                if os.path.exists(path):
                    H.KOSA(f'worktree {path}: folda ipo lakini si worktree ya {key}')
                else:
                    H.TAYARI(f'worktree {path} imeshaondolewa')
                continue
            if w.get('branch') != 'refs/heads/' + br or w.get('HEAD') != sha:
                H.BADILIKA(f'worktree {path}: {w.get("branch")} {w.get("HEAD", "")[:7]} si {br} {sha[:7]}'); continue
            rc, st, _ = g(path, 'status', '--porcelain', '--untracked-files=all')
            if aina == 'SAFI':
                if st:
                    H.BADILIKA(f'worktree {path} si safi ({len(st.splitlines())} mabadiliko)'); continue
                args = ['worktree', 'remove', path]
            elif aina.startswith('DIFF:'):
                nd = aina[5:]
                if any(not l.startswith(' M ') for l in st.splitlines()):
                    H.BADILIKA(f'worktree {path}: ina faili mpya/zisizo " M " - diff ya zip haitoshi'); continue
                rc, d, _ = g(path, 'diff', data=True)
                if rc or h256(d) != sha_chanzo.get(nd):
                    H.BADILIKA(f'worktree {path}: git diff si sawa na {nd} ya zip'); continue
                args = ['worktree', 'remove', '--force', path]
            else:
                H.KOSA(f'worktree {path}: aina {aina}'); continue
            rc, _, err = g(repo, *args)
            if rc or os.path.exists(path):
                H.KOSA(f'git {" ".join(args)}: rc {rc} {err[:200]}' + (' (folda bado ipo)' if os.path.exists(path) else ''))
            else:
                H.OK(f'worktree {path} imeondolewa ({aina.split(":")[0]})')
        elif k == 'TAG':
            _, _, tag, sha = c
            cur = commit_ya(repo, 'refs/tags/' + tag)
            if cur:
                (H.TAYARI if cur == sha else H.KOSA)(f'tag {tag} ipo -> {cur[:7]} (inatarajiwa {sha[:7]})'); continue
            if not commit_ya(repo, sha):
                H.KOSA(f'tag {tag}: commit {sha[:7]} haipo'); continue
            rc, _, err = g(repo, 'tag', '-a', tag, sha, '-m', f'archive: usafi 29/10 (mmiliki ao), {tag}')
            (H.OK if rc == 0 else H.KOSA)(f'tag {tag} -> {sha[:7]}' + (f' {err[:200]}' if rc else ''))
        elif k == 'TAG_PUSH':
            _, _, tag = c
            loc = commit_ya(repo, 'refs/tags/' + tag)
            if not loc:
                H.KOSA(f'push tag {tag}: haipo local'); continue
            rem = remote_tag(repo, tag)
            if rem:
                (H.TAYARI if rem == loc else H.KOSA)(f'tag {tag} ipo origin -> {rem[:7]}'); continue
            rc, _, err = g(repo, 'push', 'origin', 'refs/tags/' + tag)
            rem = remote_tag(repo, tag)
            (H.OK if rc == 0 and rem == loc else H.KOSA)(f'push tag {tag} -> origin {rem[:7]}' + (f' {err[:200]}' if rc else ''))
        elif k == 'BRANCH':
            _, _, br, sha, sharti = c
            if br in LINDA_BRANCH:
                H.KOSA(f'branch {br} inalindwa - haiguswi'); continue
            cur = commit_ya(repo, 'refs/heads/' + br)
            if not cur:
                H.TAYARI(f'branch {key} {br} haipo tena'); continue
            if any(w.get('branch') == 'refs/heads/' + br for w in worktrees(repo).values()):
                H.BADILIKA(f'branch {key} {br} bado iko kwenye worktree - haifutwi'); continue
            if cur != sha:
                H.BADILIKA(f'branch {key} {br} -> {cur[:7]} si {sha[:7]}'); continue
            if sharti == 'MERGED':
                rc, _, _ = g(repo, 'merge-base', '--is-ancestor', sha, 'refs/heads/main')
                if rc:
                    H.BADILIKA(f'branch {key} {br} haijamergiwa main'); continue
                args = ['branch', '-d', br]
            elif sharti.startswith('TAG:'):
                if commit_ya(repo, 'refs/tags/' + sharti[4:]) != sha or remote_tag(repo, sharti[4:]) != sha:
                    H.KOSA(f'branch {key} {br}: {sharti[4:]} haipo local+origin kwa {sha[:7]}'); continue
                args = ['branch', '-D', br]
            else:
                H.KOSA(f'branch {br}: sharti {sharti}'); continue
            rc, _, err = g(repo, *args)
            (H.OK if rc == 0 else H.KOSA)(f'branch {key} {br} imefutwa local ({args[1]})' + (f' {err[:200]}' if rc else ''))
        elif k == 'ORIGIN':
            _, _, br, sha, sharti = c
            if br in LINDA_BRANCH:
                H.KOSA(f'origin {br} inalindwa'); continue
            rc, out, err = g(repo, 'ls-remote', 'origin', 'refs/heads/' + br)
            if rc:
                H.KOSA(f'ls-remote {br}: {err[:200]}'); continue
            rem = out.split('\t')[0] if out else ''
            if not rem:
                H.TAYARI(f'origin/{br} haipo tena'); continue
            if rem != sha:
                H.BADILIKA(f'origin/{br} -> {rem[:7]} si {sha[:7]}'); continue
            if sharti == 'MERGED':
                rc, _, _ = g(repo, 'merge-base', '--is-ancestor', sha, 'refs/remotes/origin/main')
                if rc:
                    H.BADILIKA(f'origin/{br} haijamergiwa origin/main'); continue
            elif not (sharti.startswith('TAG:') and remote_tag(repo, sharti[4:]) == sha):
                H.KOSA(f'origin/{br}: {sharti} haipo origin kwa {sha[:7]}'); continue
            rc, _, err = g(repo, 'push', 'origin', '--delete', br)
            (H.OK if rc == 0 else H.KOSA)(f'origin/{br} imefutwa' + (f' {err[:200]}' if rc else ''))


def remote_tag(repo, tag):
    rc, out, _ = g(repo, 'ls-remote', 'origin', f'refs/tags/{tag}', f'refs/tags/{tag}^{{}}')
    m = {l.split('\t')[1]: l.split('\t')[0] for l in out.splitlines() if '\t' in l}
    return m.get(f'refs/tags/{tag}^{{}}') or m.get(f'refs/tags/{tag}', '')


# ---------------------------------------------------------------- faili
def futa_faili(p):
    try:
        os.chmod(ndefu(p), stat.S_IWRITE)
    except OSError:
        pass
    os.remove(ndefu(p))


def futa_folda(p):
    def kosa(fn, path, _):
        os.chmod(path, stat.S_IWRITE)
        fn(path)
    shutil.rmtree(ndefu(p), onerror=kosa)


def git_rm(repo, rels, H):
    for i in range(0, len(rels), 100):
        sehemu = rels[i:i + 100]
        rc, _, err = g(repo, 'rm', '-q', '-f', '--', *sehemu)
        if rc:
            for r in sehemu:  # moja moja, ili kosa lionekane
                rc1, _, err1 = g(repo, 'rm', '-q', '-f', '--', r)
                (H.OK if rc1 == 0 else H.KOSA)(f'git rm {r}' + (f' {err1[:160]}' if rc1 else ''))
        else:
            for r in sehemu:
                H.OK(f'git rm {r}')


def fanya_faili(o, rows, H, zip_saa):
    R = o['REPO']
    by = {r['ndani']: r for r in rows}
    sio_salama = set()  # folda zenye chanzo kilichobadilika au faili jipya: hazifutwi
    gitrm = {}
    for e in o['ZIP']:
        p, r = e['chanzo'], by.get(e['ndani'])
        if r is None:
            H.KOSA(f'{e["ndani"]} haiko kwenye manifest'); sio_salama.add(os.path.dirname(p)); continue
        if not os.path.exists(ndefu(p)):
            H.TAYARI(f'{p} haipo tena'); continue
        if not ndani_ya_ruhusa(p):
            H.KOSA(f'{p} iko nje ya mizizi inayoruhusiwa'); continue
        if hfile(ndefu(p)) != r['sha_chanzo']:
            H.BADILIKA(f'{p} imebadilika baada ya zip - HAIGUSWI'); sio_salama.add(os.path.dirname(p)); continue
        b = e['baada']
        if b.startswith('GITRM:'):
            repo = R[b[6:]]
            gitrm.setdefault(repo, []).append(os.path.relpath(p, repo).replace(os.sep, '/'))
        elif b == 'FUTA':
            try:
                futa_faili(p); H.OK(f'futa {p}')
            except OSError as x:
                H.KOSA(f'futa {p}: {x}')
    for f in o['FUTA']:
        p = f['njia']
        if not os.path.lexists(ndefu(p)):
            H.TAYARI(f'{p} haipo tena'); continue
        if not ndani_ya_ruhusa(p) or os.path.isdir(p):
            H.KOSA(f'FUTA {p}: nje ya mizizi au ni folda'); continue
        if f['git'] != '-':
            repo = R[f['git']]
            gitrm.setdefault(repo, []).append(os.path.relpath(p, repo).replace(os.sep, '/'))
        else:
            try:
                futa_faili(p); H.OK(f'futa {p}')
            except OSError as x:
                H.KOSA(f'futa {p}: {x} (kama ni ~$ ya editor: funga editor kisha endesha 71 tena)')
    for repo, rels in gitrm.items():
        git_rm(repo, rels, H)
    ndani_zip = {os.path.normcase(os.path.abspath(e['chanzo'])) for e in o['ZIP']}
    for f in o['FUTA_FOLDA']:
        d = f['njia']
        if not os.path.exists(ndefu(d)):
            H.TAYARI(f'folda {d} haipo tena'); continue
        if not ndani_ya_ruhusa(d) or not os.path.isdir(d) or any(
                os.path.normcase(os.path.abspath(v)) == os.path.normcase(os.path.abspath(d)) for v in R.values()):
            H.KOSA(f'FUTA_FOLDA {d}: si folda inayoruhusiwa'); continue
        dn = os.path.normcase(os.path.abspath(d))
        if any(s and (os.path.normcase(os.path.abspath(s)) + os.sep).startswith(dn + os.sep) for s in sio_salama):
            H.BADILIKA(f'folda {d}: ina chanzo kilichobadilika - HAIFUTWI'); continue
        mpya = []
        for dp, _, fn in os.walk(ndefu(d)):
            for n in fn:
                q = os.path.join(dp, n)
                try:
                    if os.path.getmtime(q) > zip_saa and os.path.normcase(q.replace('\\\\?\\', '')) not in ndani_zip:
                        mpya.append(q)
                except OSError:
                    pass
        if mpya:
            H.BADILIKA(f'folda {d}: faili {len(mpya)} mpya baada ya zip (mf. {mpya[0][-90:]}) - HAIFUTWI'); continue
        try:
            futa_folda(d)
            (H.KOSA if os.path.exists(ndefu(d)) else H.OK)(f'folda {d} imeondolewa')
        except OSError as x:
            H.KOSA(f'folda {d}: {x}')
    # folda tupu zilizobaki ndani ya analysis/ (si analysis yenyewe)
    an = os.path.join(R['V3'], 'analysis') if 'V3' in R else None
    if an and os.path.isdir(an):
        for dp, dn_, fn in sorted(os.walk(an), key=lambda t: -len(t[0])):
            if dp != an and not os.listdir(dp):
                os.rmdir(dp); print(f'folda tupu imeondolewa {dp}')


# ---------------------------------------------------------------- muhtasari / ondoa
def muhtasari(folda):
    o = soma_orodha()
    z, sf, mf = njia(folda)
    print('=== KINACHOONDOLEWA (71-orodha.txt) ===')
    c = {}
    for e in o['ZIP']:
        c[e['baada'].split(':')[0]] = c.get(e['baada'].split(':')[0], 0) + 1
    print(f'Kwenye zip: faili {len(o["ZIP"])} (git rm {c.get("GITRM", 0)}, futa {c.get("FUTA", 0)}, '
          f'pamoja na folda {c.get("FOLDA", 0)}, baki {c.get("BAKI", 0)})')
    print(f'FUTA bila zip: faili {len(o["FUTA"])}')
    for f in o['FUTA']:
        print(f'   {f["njia"]}')
    print(f'Folda zinazoondolewa: {len(o["FUTA_FOLDA"])}')
    for f in o['FUTA_FOLDA']:
        print(f'   {f["njia"]}')
    print('Git:')
    for c_ in o['GIT']:
        print('   ' + ' '.join(x if len(x) != 40 else x[:7] for x in c_))
    if os.path.isfile(mf):
        _, rows = soma_manifest(mf)
        by = {r['ndani']: r for r in rows}
        b = [e['chanzo'] for e in o['ZIP'] if os.path.exists(ndefu(e['chanzo'])) and e['ndani'] in by
             and hfile(ndefu(e['chanzo'])) != by[e['ndani']]['sha_chanzo']]
        print(f'Vyanzo vilivyobadilika baada ya zip (havitaguswa): {len(b)}')
        for x in b[:20]:
            print(f'   {x}')
    print('HAVIGUSWI: dumps za backups\\, Flutter source, Lsms\\.git ya nje, DB za PG, main/ops/logs-flutter/feature/sales-returns.')


def ondoa(folda, neno, b2):
    if neno != 'SAFISHA':
        toka('IMEKATALIWA: neno si SAFISHA - hakuna kilichoondolewa', 3)
    o = soma_orodha()
    z, sf, mf = njia(folda)
    hz, head, rows = thibitisha_zip(z, sf, mf, o)
    if b2 != hz:
        toka(f'IMEKATALIWA: sha256 ya B2 ({b2[:12]}) si ya zip ({hz[:12]}) - hakuna kilichoondolewa', 3)
    print('ZIP_D_NA_B2_SAWA')
    zip_saa = float(head['imeanza_epoch'])  # faili lenye mtime baada ya hapa = jipya, halimo kwenye zip
    H = Hesabu()
    print('---GIT---')
    fanya_git(o, rows, H)
    print('---FAILI---')
    fanya_faili(o, rows, H, zip_saa)
    print('---MATOKEO---')
    print(f'OK {H.ok}  TAYARI {H.tayari}  BADILIKA {len(H.badilika)}  KOSA {len(H.kosa)}')
    for m in H.badilika + H.kosa:
        print(f'  ! {m}')
    for key, repo in o['REPO'].items():
        _, st, _ = g(repo, 'status', '--porcelain')
        n = sum(1 for l in st.splitlines() if l.startswith('D '))
        print(f'GIT_{key}: faili {n} zimeondolewa kwa git rm (staged) - commit ni yako')
    if H.kosa or H.badilika:
        print('USAFI_HAUJAKAMILIKA')
        sys.exit(2)
    print('USAFI_SAWA')


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) == 2 and a[0] == 'andaa':
        andaa(a[1])
    elif len(a) == 2 and a[0] == 'muhtasari':
        muhtasari(a[1])
    elif len(a) == 4 and a[0] == 'ondoa':
        ondoa(a[1], a[2], a[3].strip())
    else:
        toka(__doc__)
