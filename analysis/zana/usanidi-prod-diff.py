"""Effective config on prod (SPRING_PROFILES_ACTIVE=prod, group prod->pro): pro overrides base.
Parsing follows java.util.Properties: key ends at first unescaped '=', ':' or whitespace."""
import sys, re, hashlib
from collections import Counter

SECRET = re.compile(r'(pass|secret|token|key|credential|jwt|private)', re.I)

def jparse(path):
    raw = open(path, 'rb').read().decode('latin-1').replace('\r\n', '\n').replace('\r', '\n')
    lines, buf = [], ''
    for line in raw.split('\n'):
        s = line.lstrip(' \t\f')
        if not buf and (not s or s[0] in '#!'):
            continue
        bs = len(s) - len(s.rstrip('\\'))
        if bs % 2 == 1:
            buf += s[:-1]
            continue
        lines.append(buf + s)
        buf = ''
    out = {}
    for s in lines:
        i, n = 0, len(s)
        while i < n:
            c = s[i]
            if c == '\\':
                i += 2
                continue
            if c in '=: \t\f':
                break
            i += 1
        k = s[:i]
        j = i
        while j < n and s[j] in ' \t\f':
            j += 1
        if j < n and s[j] in '=:':
            j += 1
            while j < n and s[j] in ' \t\f':
                j += 1
        out[k] = s[j:]
    return out

def mask(k, v):
    if v is None:
        return '-'
    def rep(m):
        name, d = m.group(1), m.group(2)
        if d is None:
            return '${%s}' % name
        if d and (SECRET.search(name) or SECRET.search(k)):
            return '${%s:<siri h=%s>}' % (name, hashlib.sha256(d.encode()).hexdigest()[:8])
        return '${%s:%s}' % (name, d)
    if '${' in v:
        return re.sub(r'\$\{([^}:]+)(?::([^}]*))?\}', rep, v)
    if SECRET.search(k) or re.search(r'//[^/]*:[^/]*@', v):
        return '<siri h=%s>' % hashlib.sha256(v.encode()).hexdigest()[:8]
    return v

def eff(base, pro):
    b, p = jparse(base), jparse(pro)
    e = {k: (v, 'base') for k, v in b.items()}
    e.update({k: (v, 'pro') for k, v in p.items()})
    return e

A = eff(sys.argv[1], sys.argv[2])
B = eff(sys.argv[3], sys.argv[4])
print('| hali | key | prod 2.3.0 jar (chanzo) | %s (chanzo) |' % sys.argv[5])
print('|---|---|---|---|')
cnt = Counter()
for k in sorted(set(A) | set(B)):
    a, b = A.get(k), B.get(k)
    va, vb = (a[0] if a else None), (b[0] if b else None)
    st = 'SAWA' if va == vb else ('MPYA' if va is None else ('IMEONDOLEWA' if vb is None else 'IMEBADILIKA'))
    cnt[st] += 1
    if st != 'SAWA' or (a and b and a[1] != b[1]) or '-v' in sys.argv:
        print('| %s | `%s` | `%s` (%s) | `%s` (%s) |' % (st, k, mask(k, va), a[1] if a else '-', mask(k, vb), b[1] if b else '-'))
print()
print('JUMLA', dict(cnt), 'keys', len(set(A) | set(B)))
