"""Read-only: flyway_schema_history from a prod dump (COPY text) vs the migrations of a source tree.
Flyway checksum = CRC32 over each line (readLine, no terminators, BOM stripped), as a signed int."""
import sys, os, re, zlib

def rows(path):
    out, on = [], False
    for line in open(path, encoding='utf-8'):
        if line.startswith('COPY '):
            on = True; continue
        if line.startswith('\\.'):
            on = False; continue
        if on:
            f = [None if x == '\\N' else x for x in line.rstrip('\n').split('\t')]
            out.append(dict(rank=int(f[0]), version=f[1], desc=f[2], type=f[3], script=f[4],
                            checksum=None if f[5] is None else int(f[5]), on=f[7], success=f[9]))
    return out

def vkey(v):
    return tuple(int(p) for p in re.split(r'[._]', v))

def checksum(path):
    data = open(path, 'rb').read()
    if data.startswith(b'\xef\xbb\xbf'):
        data = data[3:]
    text = data.decode('utf-8')
    crc = 0
    for line in re.split(r'\r\n|\r|\n', text)[:-1] if re.search(r'(\r\n|\r|\n)$', text) else re.split(r'\r\n|\r|\n', text):
        crc = zlib.crc32(line.encode('utf-8'), crc)
    return crc - (1 << 32) if crc >= (1 << 31) else crc

hist = rows(sys.argv[1])
mig_dir = sys.argv[2]
src = {}
for name in os.listdir(mig_dir):
    m = re.match(r'V([0-9._]+)__(.+)\.sql$', name)
    if m:
        src[m.group(1).replace('_', '.')] = (name, checksum(os.path.join(mig_dir, name)))

print('safu', len(hist), '| zilizoshindwa', sum(1 for r in hist if r['success'] != 't'))
print('aina', sorted({r['type'] for r in hist}))
mx, ooo = None, []
for r in sorted(hist, key=lambda r: r['rank']):
    if r['version'] is None:
        continue
    k = vkey(r['version'])
    if mx is not None and k < mx[0]:
        ooo.append((r, mx[1]))
    if mx is None or k > mx[0]:
        mx = (k, r['version'])
print('version ya juu', mx[1])
print('NJE YA MPANGILIO (out-of-order):', len(ooo))
for r, after in ooo:
    print('  rank %3d V%-8s %-45s %s (baada ya V%s)' % (r['rank'], r['version'], r['desc'][:45], r['on'][:16], after))
applied = {r['version']: r for r in hist if r['version'] is not None}
missing = [v for v in applied if v not in src and applied[v]['type'] == 'SQL']
print('ZILIZOTUMIKA LAKINI HAZIPO KWENYE CODE (missing):', len(missing), sorted(missing, key=vkey))
bad = [(v, applied[v]['checksum'], src[v][1]) for v in applied if v in src and applied[v]['type'] == 'SQL'
       and applied[v]['checksum'] != src[v][1]]
print('CHECKSUM ZISIZOLINGANA:', len(bad))
for v, a, b in sorted(bad, key=lambda x: vkey(x[0])):
    print('  V%-8s historia %d  code %d  %s' % (v, a, b, src[v][0]))
top = vkey(mx[1])
base = vkey(next(r['version'] for r in hist if r['type'] == 'BASELINE'))
below = sorted([v for v in src if v not in applied and vkey(v) <= base], key=vkey)
print('CHINI YA BASELINE (Flyway inazipuuza, si pending):', len(below), 'V%s..V%s' % (below[0], below[-1]))
pend = sorted([v for v in src if v not in applied and vkey(v) > base], key=vkey)
print('ZINAZOSUBIRI (pending):', len(pend), ['V' + v for v in pend])
print('  zinazosubiri CHINI ya V%s (zingekataliwa na out-of-order=false):' % mx[1],
      ['V' + v for v in pend if vkey(v) < top])
print('BASELINE rows:', [(r['rank'], r['version'], r['desc']) for r in hist if r['type'] == 'BASELINE'])
