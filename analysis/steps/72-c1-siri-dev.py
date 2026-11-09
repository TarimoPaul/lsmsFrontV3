"""Hatua 72 (mmiliki 03/11 ci): release ya C1 kwenye PC — siri za dev zihamie Lsms\\config\\application.properties,
kisha backend ya release/2.4.0 iwake local ikisoma siri hizo tu.

Inaendeshwa KABLA ya merge ya release/2.4.0 -> main. Sababu: faili la zamani (src\\main\\resources\\application.properties)
ni IGNORED kwenye main; git huchukulia faili ignored kama "expendable" na merge ingeliandika juu yake KIMYA (siri za dev zingepotea).

Hatua:  KAGUA (kusoma tu) -> STOP "HAMISHA" -> nakala nje ya repo + config\\application.properties + ukaguzi -> kufuta la zamani
        -> STOP "ANZA" -> mvnw package (release) -> java -jar, cwd = Lsms, bila env za siri -> "Started" + POST /api/auth/login (401)
Haichapishi thamani yoyote ya siri: majina ya funguo na sha256 fupi tu.
Env za majaribio: LSMS72_MAIN, LSMS72_RELEASE, LSMS72_BACKUP, LSMS72_LOG, LSMS72_PORT, LSMS72_MVNW, LSMS72_ARGS (args za ziada za java, majaribio tu).
"""
import hashlib, os, re, shutil, socket, subprocess, sys, time, urllib.request, urllib.error
from datetime import datetime

ROOT = r'D:\MY PROJECT\DUKA PROJECT\Lsms'
MAIN = os.environ.get('LSMS72_MAIN', os.path.join(ROOT, 'Lsms'))
RELEASE = os.environ.get('LSMS72_RELEASE', os.path.join(ROOT, 'Lsms-release-240'))
BACKUP_DIR = os.environ.get('LSMS72_BACKUP', ROOT)
LOG = os.environ.get('LSMS72_LOG', os.path.join(os.path.dirname(os.path.abspath(__file__)), '72-c1-siri-dev.log'))
PORT = int(os.environ.get('LSMS72_PORT', '18096'))
MVNW = os.environ.get('LSMS72_MVNW', 'mvnw.cmd')
EXTRA = [a for a in os.environ.get('LSMS72_ARGS', '').split('|') if a]
REL_BRANCH = 'release/2.4.0'
OLD_REL = os.path.join('src', 'main', 'resources', 'application.properties')
NEW_REL = os.path.join('config', 'application.properties')
SECRET_ENV = ['DB_PASSWORD', 'JWT_SECRET', 'DB_URL', 'DB_USERNAME', 'ROOT_PASSWORD', 'SPRING_PROFILES_ACTIVE',
              'SPRING_DATASOURCE_URL', 'SPRING_DATASOURCE_USERNAME', 'SPRING_DATASOURCE_PASSWORD', 'JWT_EXPIRATION',
              'SPRING_CONFIG_IMPORT', 'SPRING_CONFIG_LOCATION', 'SPRING_CONFIG_ADDITIONAL_LOCATION']

logf = open(LOG, 'a', encoding='utf-8')


def say(*a):
    s = ' '.join(str(x) for x in a)
    print(s, flush=True)
    logf.write(s + '\n'); logf.flush()


def fail(msg):
    say('KOSA:', msg)
    say('---IMESHINDWA---')
    sys.exit(1)


def ask(word):
    say('STOP: andika %s kuendelea (kingine chochote = simama):' % word)
    try:
        ans = input().strip()
    except EOF_ERRORS:
        ans = ''
    say('jibu:', 'NDIYO' if ans == word else 'HAPANA')
    if ans != word:
        say('Umesimamisha. Hakuna kilichobadilika baada ya hatua hii.')
        say('---IMESIMAMISHWA---')
        sys.exit(2)


EOF_ERRORS = (EOFError, KeyboardInterrupt)


def git(*args, cwd=MAIN, check=True):
    r = subprocess.run(['git', '-C', cwd] + list(args), capture_output=True, text=True, encoding='utf-8')
    if check and r.returncode != 0:
        fail('git %s: %s' % (' '.join(args), r.stderr.strip()))
    return r.stdout


def jparse_text(raw):
    """java.util.Properties: key ends at first unescaped '=', ':' or whitespace; values kept raw (escapes preserved)."""
    raw = raw.replace('\r\n', '\n').replace('\r', '\n')
    logical, buf = [], ''
    for line in raw.split('\n'):
        s = line.lstrip(' \t\f')
        if not buf and (not s or s[0] in '#!'):
            continue
        bs = len(s) - len(s.rstrip('\\'))
        if bs % 2 == 1:
            buf += s[:-1]
            continue
        logical.append(buf + s)
        buf = ''
    out = {}
    for s in logical:
        i, n = 0, len(s)
        while i < n:
            if s[i] == '\\':
                i += 2
                continue
            if s[i] in '=: \t\f':
                break
            i += 1
        k, j = s[:i], i
        while j < n and s[j] in ' \t\f':
            j += 1
        if j < n and s[j] in '=:':
            j += 1
            while j < n and s[j] in ' \t\f':
                j += 1
        out[k] = s[j:]
    return out


def jdk_major(home):
    """Toleo kuu la JDK kwenye <home> (0 = si JDK). Kama Get-JdkMajor ya deploy-backend.ps1: faili 'release' kwanza."""
    exe = os.path.join(home or '', 'bin', 'java.exe' if os.name == 'nt' else 'java')
    if not home or not os.path.isfile(exe):
        return 0
    txt = ''
    rel_f = os.path.join(home, 'release')
    if os.path.isfile(rel_f):
        for line in open(rel_f, encoding='utf-8', errors='replace'):
            if line.startswith('JAVA_VERSION='):
                txt = line
                break
    if not txt:
        r = subprocess.run([exe, '-version'], capture_output=True, text=True, errors='replace')
        txt = ((r.stderr or r.stdout).splitlines() or [''])[0]
    m = re.search(r'"(\d+)', txt)
    return int(m.group(1)) if m else 0


def find_jdk21():
    """(dd) JDK 21 kama Find-Jdk21 ya deploy-backend.ps1: JAVA_HOME_21 -> JAVA_HOME (ikiwa 21) -> ~/.jdks -> Program Files."""
    cands = [os.environ.get('JAVA_HOME_21'), os.environ.get('JAVA_HOME')]
    test_roots = os.environ.get('LSMS72_JDK_ROOTS')  # majaribio tu: mizizi iliyotenganishwa kwa ';'
    if test_roots is not None:
        roots = [r for r in test_roots.split(';') if r]
    else:
        pf = r'C:\Program Files'
        roots = [os.path.join(os.path.expanduser('~'), '.jdks')] + [os.path.join(pf, d) for d in (
            'Java', 'Eclipse Adoptium', 'Microsoft', 'Zulu', 'Amazon Corretto', 'BellSoft')]
    for root in roots:
        if os.path.isdir(root):
            cands += [os.path.join(root, d) for d in sorted(os.listdir(root), reverse=True)
                      if os.path.isdir(os.path.join(root, d))]
    for c in cands:
        if c and jdk_major(c) == 21:
            return c.rstrip('\\/')
    return None


def h(b):
    return hashlib.sha256(b).hexdigest()[:12]


def port_free(p):
    with socket.socket() as so:
        return so.connect_ex(('127.0.0.1', p)) != 0


say('=' * 70)
say('72-c1-siri-dev', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
say('MAIN   ', MAIN)
say('RELEASE', RELEASE)

# ---------------- KAGUA (kusoma tu) ----------------
old = os.path.join(MAIN, OLD_REL)
new = os.path.join(MAIN, NEW_REL)
branch = git('rev-parse', '--abbrev-ref', 'HEAD').strip()
say('MAIN tawi', branch, git('rev-parse', '--short', 'HEAD').strip())
if branch != 'main':
    fail('worktree ya MAIN haiko kwenye main')
rel_head = git('rev-parse', '--short', REL_BRANCH).strip()
say('release/2.4.0', rel_head)
if subprocess.run(['git', '-C', MAIN, 'merge-base', '--is-ancestor', REL_BRANCH, 'HEAD']).returncode == 0:
    fail('main tayari ina release/2.4.0 (merge imeshafanyika) - hatua hii ni ya KABLA ya merge')
rel_props = git('show', '%s:src/main/resources/application.properties' % REL_BRANCH)
rel_gitignore = git('show', '%s:.gitignore' % REL_BRANCH)
if '/config/application.properties' not in rel_gitignore.split('\n'):
    fail('.gitignore ya release haina /config/application.properties')
if git('ls-tree', '-r', '--name-only', REL_BRANCH, '--', 'config').strip():
    fail('release ina faili chini ya config/ - zingegongana')
rel = jparse_text(rel_props)

if not os.path.exists(old):
    if os.path.exists(new):
        say('TAYARI: faili la zamani halipo na config\\application.properties ipo (hatua ilishafanyika?) - ruka kwenda ANZA')
        moved = True
    else:
        fail('hakuna faili la zamani wala jipya - siri za dev hazipo')
else:
    moved = False
    if git('ls-files', '--', OLD_REL.replace(os.sep, '/')).strip():
        fail('faili la zamani linafuatiliwa na git kwenye main (lilitarajiwa kuwa ignored)')
    if os.path.exists(new):
        fail('config\\application.properties tayari ipo PAMOJA na la zamani - simama, kagua kwa mkono')
    old_bytes = open(old, 'rb').read()
    oldp = jparse_text(old_bytes.decode('latin-1'))
    say('faili la zamani: funguo %d, sha256 %s' % (len(oldp), h(old_bytes)))
    only_rel = sorted(k for k in rel if k not in oldp)
    diff = sorted(k for k in oldp if rel.get(k) != oldp[k])
    say('funguo zitakazohamia config (tofauti na release):', len(diff))
    for k in diff:
        say('   ', k, '| release:', 'ipo' if k in rel else 'haipo')
    if only_rel:
        say('funguo za release ambazo dev haina (zitatoka release):', ', '.join(only_rel))
    for k in ('spring.datasource.password', 'jwt.secret'):
        v = oldp.get(k, '')
        # (db) 09/11: dev ina ${DB_PASSWORD:<default>} / ${JWT_SECRET:<default>}; env hizo hazipo kwenye Windows,
        # kwa hiyo thamani halisi ni default. Mstari unahamishwa KAMA ULIVYO (tabia ya dev haibadiliki).
        m = re.fullmatch(r'\$\{([A-Za-z0-9_.]+):(.+)\}', v)
        if m:
            src = 'default ya ${%s:...} (urefu %d)' % (m.group(1), len(m.group(2)))
            if os.environ.get(m.group(1)):
                src += '; ONYO: env %s ipo kwenye mazingira haya na ingetumika badala ya default' % m.group(1)
            say('   %s: %s' % (k, src))
        elif not v or '${' in v:
            fail('%s ya dev haina thamani halisi (wala ${JINA:default})' % k)
        if k not in diff:
            fail('%s haimo kwenye orodha ya kuhamisha' % k)
    say('KAGUA SAWA. Hakuna kilichobadilika mpaka sasa.')

    # ---------------- HAMISHA ----------------
    ask('HAMISHA')
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    bak = os.path.join(BACKUP_DIR, 'c1-kabla-application.properties-' + ts)
    if os.path.commonpath([os.path.abspath(bak), os.path.abspath(MAIN)]) == os.path.abspath(MAIN):
        fail('nakala lazima iwe NJE ya repo')
    shutil.copy2(old, bak)
    if open(bak, 'rb').read() != old_bytes:
        fail('nakala hailingani')
    say('nakala (nje ya repo):', bak, 'sha256', h(old_bytes))
    raw_lines = old_bytes.decode('latin-1').replace('\r\n', '\n').split('\n')
    body = ['# Siri za dev (hatua 72, %s). Faili hili liko kwenye .gitignore na halimo kwenye jar.' % ts,
            '# Spring Boot inalisoma kutoka <cwd>/config/ (location ya kawaida). Usilicommit.']
    for k in diff:
        body.append('%s=%s' % (k, oldp[k]))
    os.makedirs(os.path.dirname(new), exist_ok=True)
    data = ('\n'.join(body) + '\n').encode('latin-1')
    with open(new, 'wb') as f:
        f.write(data)
    newp = jparse_text(open(new, 'rb').read().decode('latin-1'))
    eff = dict(rel); eff.update(newp)
    bad = sorted(k for k in set(oldp) | set(eff) if oldp.get(k) != eff.get(k) and k not in only_rel)
    if bad:
        os.remove(new)
        fail('release + config != faili la zamani kwa funguo: %s (config imefutwa, la zamani lipo)' % ', '.join(bad))
    say('ukaguzi: release + config\\application.properties = faili la zamani (funguo %d, zote SAWA)' % len(oldp))
    os.remove(old)
    if os.path.exists(old):
        fail('faili la zamani halikufutika')
    say('faili la zamani limefutwa:', OLD_REL)
    moved = True

st = git('status', '--porcelain', '--ignored', '--', OLD_REL.replace(os.sep, '/'), 'config')
say('git status (la zamani + config):', st.strip().replace('\n', ' ; ') or '(hakuna)')

# ---------------- ANZA: backend inawaka local ----------------
say('ANZA itajenga jar ya release/2.4.0 (%s) na kuiwasha kutoka MAIN kwenye port %d.' % (rel_head, PORT))
say('Inatumia DB ya dev ya config (ddl-auto=update na initializers kama run ya kawaida ya dev; schedulers zimezimwa).')
ask('ANZA')
if not port_free(PORT):
    fail('port %d inatumika' % PORT)
if git('status', '--porcelain', cwd=RELEASE).strip():
    fail('worktree ya release ina mabadiliko yasiyocommitiwa')
if git('rev-parse', '--short', 'HEAD', cwd=RELEASE).strip() != rel_head:
    fail('worktree ya release haiko kwenye release/2.4.0 HEAD')
jdk21 = find_jdk21()
if not jdk21:
    jh = os.environ.get('JAVA_HOME')
    say('JAVA_HOME ya sasa: %s (Java %s)' % (jh or 'haijawekwa', jdk_major(jh) if jh else '-'))
    say('Weka JAVA_HOME_21 ielekeze kwenye JDK 21, mfano:  setx JAVA_HOME_21 "%USERPROFILE%\\.jdks\\openjdk-21.0.2"')
    say('kisha fungua CMD mpya na uendeshe 72 tena. Hakuna kilichojengwa.')
    fail('JDK 21 haipatikani (JAVA_HOME_21, JAVA_HOME, ~\\.jdks, Program Files)')
if os.environ.get('JAVA_HOME_21') and jdk_major(os.environ['JAVA_HOME_21']) != 21:
    say('ONYO: JAVA_HOME_21 = %s si JDK 21 - imepuuzwa' % os.environ['JAVA_HOME_21'])
say('JDK 21:', jdk21, '(JAVA_HOME + PATH kwa run hii tu; CMD yako haibadiliki)')
JAVA = os.path.join(jdk21, 'bin', 'java')
say('mvnw package (bila majaribio)...')
env_b = {k: v for k, v in os.environ.items() if k != 'MSYS_NO_PATHCONV'}
env_b['JAVA_HOME'] = jdk21
env_b['PATH'] = os.path.join(jdk21, 'bin') + os.pathsep + env_b.get('PATH', '')
r = subprocess.run([os.path.join(RELEASE, MVNW) if not os.path.isabs(MVNW) else MVNW, '-q', '-DskipTests', 'package'],
                   cwd=RELEASE, env=env_b, capture_output=True, text=True, encoding='utf-8', errors='replace', shell=False)
if r.returncode != 0:
    say(r.stdout[-2000:]); say(r.stderr[-2000:])
    fail('mvnw package imeshindwa')
jar = os.path.join(RELEASE, 'target', 'Lsms-0.0.1-SNAPSHOT.jar')
if not os.path.exists(jar):
    fail('jar haipo: ' + jar)
say('jar', jar, 'sha256', h(open(jar, 'rb').read()))

env = {k: v for k, v in os.environ.items() if k.upper() not in SECRET_ENV}
for k in SECRET_ENV:
    if k in os.environ:
        say('env %s imeondolewa kwa run hii (siri zitoke config tu)' % k)
cmd = [JAVA, '-jar', jar, '--server.port=%d' % PORT, '--server.address=127.0.0.1', '--app.schedulers.enabled=false'] + EXTRA
bootlog = LOG.replace('.log', '-boot.log')
say('java -jar ... cwd =', MAIN, '| log ya boot:', bootlog)
p = subprocess.Popen(cmd, cwd=MAIN, env=env, stdout=open(bootlog, 'w', encoding='utf-8', errors='replace'),
                     stderr=subprocess.STDOUT)
started, deadline = False, time.time() + 300
try:
    while time.time() < deadline:
        time.sleep(2)
        txt = open(bootlog, encoding='utf-8', errors='replace').read()
        if re.search(r'Started \w+ in [0-9.]+ seconds', txt):
            started = True
            break
        if p.poll() is not None or 'APPLICATION FAILED TO START' in txt:
            break
    txt = open(bootlog, encoding='utf-8', errors='replace').read()
    m = re.search(r'Started \w+ in [0-9.]+ seconds', txt)
    say('BOOT:', m.group(0) if m else 'HAIJAWAKA')
    for pat in ('Could not resolve placeholder', 'password authentication failed', 'APPLICATION FAILED TO START',
                'Connection to .* refused', 'HikariPool-\\d+ - Start completed', 'The following \\d+ profiles? (?:is|are) active',
                'No active profile set'):
        mm = re.findall(pat, txt)
        if mm:
            say('   log: %-45s x%d' % (pat[:45], len(mm)))
    if not started:
        tail = [l for l in txt.split('\n') if 'ERROR' in l or 'Caused by' in l][-8:]
        for l in tail:
            say('   ', l[:300])
        fail('backend haikuwaka')
    req = urllib.request.Request('http://127.0.0.1:%d/api/auth/login' % PORT, method='POST',
                                 data=b'{"email":"hatua72-hayupo@example.invalid","password":"si-sahihi-72"}',
                                 headers={'Content-Type': 'application/json'})
    try:
        code = urllib.request.urlopen(req, timeout=30).status
    except urllib.error.HTTPError as e:
        code = e.code
    say('POST /api/auth/login (mtumiaji asiyekuwepo) ->', code)
    if code != 401:
        fail('nilitarajia 401 (DB inasomwa, login inakataa); nimepata %s' % code)
finally:
    if p.poll() is None:
        p.terminate()
        try:
            p.wait(20)
        except subprocess.TimeoutExpired:
            p.kill()
    say('backend imezimwa (port %d %s)' % (PORT, 'iko wazi' if port_free(PORT) else 'BADO INATUMIKA'))

say('MATOKEO: siri za dev ziko %s; backend ya release/2.4.0 %s imewaka ikisoma config tu; login inajibu 401.' % (NEW_REL, rel_head))
say('Sasa merge ya release/2.4.0 -> main haitagusa siri (config\\application.properties ni gitignored kwenye release).')
say('---OK---')
