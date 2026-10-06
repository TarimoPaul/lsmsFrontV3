"""Builds analysis/measure-data-cleanup.csv from analysis/measure-stats-staging.csv (stdlib only).

One row per fix the owner does by hand in the UI after the deploy: product (or measure),
the problem, and the step on the Item Measure / Products screen. Class A (the 14 products
the order depends on, from v3_order_backtest_out/classes.csv) comes first.
"""
import csv
import io
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))


def sections(path):
    out, name, buf = {}, None, []
    for line in io.open(path, encoding='utf-8-sig'):
        if line.startswith('### '):
            if name:
                out[name] = list(csv.DictReader(buf))
            name, buf = line[4:].strip(), []
        else:
            buf.append(line)
    if name:
        out[name] = list(csv.DictReader(buf))
    return out


S = sections(os.path.join(HERE, 'measure-stats-staging.csv'))
CLASS_A = {r['id'] for r in csv.DictReader(io.open(os.path.join(HERE, 'v3_order_backtest_out', 'classes.csv'), encoding='utf-8')) if r['cls'] == 'A'}

# Package measures that already exist (carton / crate), by normalised size.
norm = lambda u: re.sub(r'\s+', '', u.upper()).replace('LTR', 'LT')
packs = {}
for m in S['measures']:
    kind = m['package_type'].strip().lower()
    if kind.startswith('cat') or kind.startswith('car') or kind.startswith('cr'):
        size = norm(m['unit_type'])
        if size.isdigit():
            size += 'ML'
        packs.setdefault(size, []).append('%s %s (%s)' % (m['package_type'], m['unit_type'], m['abbreviation']))


def size_in(name):
    m = re.search(r'(\d+(?:\.\d+)?)\s*(ML|OML|LT|L)\b', name.upper())
    if not m:
        return None
    unit = {'OML': 'ML', 'L': 'LT'}.get(m.group(2), m.group(2))
    num = m.group(1) + ('0' if m.group(2) == 'OML' else '')
    return num + unit


def pack_for(size):
    if not size:
        return None
    have = packs.get(size)
    if have:
        return 'chagua kipimo ' + ' au '.join('"%s"' % h for h in have) + ('' if len(have) == 1 else ' (katoni au kreti, kulingana na inavyonunuliwa)')
    return 'kipimo cha katoni/kreti cha %s hakipo: kiunde kwanza kwenye Item Measure (mf. Caton %s, ctn), kisha kichague' % (size, size)


rows = []


def add(group, pid, product, problem, step, screen):
    rows.append({
        'kipaumbele': 0, 'daraja': 'A' if pid in CLASS_A else '', 'kundi': group, 'id': pid, 'bidhaa': product,
        'tatizo': problem, 'hatua': step, 'skrini': screen,
    })


for p in S['no_measure']:
    name, kupima = p['product_name'], 'KUPIMA' in p['product_name'].upper()
    size = size_in(name)
    if kupima:
        step = 'Inauzwa kwa kupima, haina kifurushi: hakuna cha kufanya (lebo itaonesha jina na kategoria tu).'
    elif size:
        step = 'Products > Hariri > Kipimo: %s. Jina libaki lilivyo (lebo mpya hairudii ukubwa uliomo kwenye jina).' % pack_for(size)
    else:
        step = 'Thibitisha ukubwa wa bidhaa (ML/LT) na inavyonunuliwa (katoni/kreti), kisha Products > Hariri > Kipimo: chagua kipimo hicho (kiunde kwenye Item Measure kama hakipo).'
    add('1. Bila kipimo', p['id'], name, 'Haina kipimo: lebo inaonesha "pkg" na ukubwa hauongezwi kwenye jina (pcs/pkg = %s).' % (p['pieces_per_package'] or 'tupu'), step, 'Products')

for p in S['bottle_measure_with_pack']:
    cur = '%s %s (%s)' % (p['package_type'], p['unit_type'], p['abbreviation'])
    size = norm(p['unit_type'])
    if size.isdigit():
        size += 'ML'
    add('2. Kipimo cha chupa, inanunuliwa kwa kifurushi', p['id'], p['product_name'],
        'Kipimo ni "%s" lakini kifurushi kina vipande %s: lebo inasema "%s pcs/%s" badala ya katoni/kreti.' % (cur, p['pieces_per_package'], p['pieces_per_package'], p['abbreviation']),
        'Products > Hariri > Kipimo: badilisha kutoka "%s"; %s.' % (cur, pack_for(size)), 'Products')

for p in S['no_pieces_per_package']:
    kupima = 'KUPIMA' in p['product_name'].upper()
    add('3. Bila vipande kwa kifurushi', p['id'], p['product_name'],
        'Vipande kwa kifurushi = %s (kipimo: %s): hakuna "N pcs/kifurushi" kwenye lebo, na manunuzi ya kifurushi kizima hayawezi kuhesabiwa.' % (p['pieces_per_package'] or 'tupu', p['measures'] or 'hakuna'),
        'Inauzwa kwa kupima: acha ilivyo.' if kupima else 'Products > Hariri > "Vipande kwenye paketi nzima": jaza idadi halisi ya katoni/kreti (mf. 12 kwa 750ML, 24 kwa 200ML). Kama hainunuliwi kwa kifurushi kamwe, weka 1.',
        'Products')

seen = set()
for p in S['more_than_one_measure']:
    if p['id'] in seen:
        continue
    seen.add(p['id'])
    both = ' + '.join('%s %s (%s, id %s)' % (x['package_type'], x['unit_type'], x['abbreviation'], x['measure_id']) for x in S['more_than_one_measure'] if x['id'] == p['id'])
    add('4. Vipimo zaidi ya kimoja', p['id'], p['product_name'], 'Ina vipimo viwili: %s. Mfumo sasa utachagua cha kifurushi kwanza, kisha id ndogo.' % both,
        'Products > Hariri > Kipimo: acha kimoja tu (cha katoni), ondoa cha chupa.', 'Products')

# Measures themselves: spelling, case, unused.
PKG = {'botle': 'Bottle', 'create': 'Create', 'crete': 'Create', 'caton': 'Carton', 'box': 'Box', 'dumu': 'Dumu', 'champainge': 'Bottle'}
ABBR = {'bt': 'btl', 'BT': 'btl'}
for m in S['measures']:
    fixes = []
    pkg, unit, ab = m['package_type'], m['unit_type'], m['abbreviation']
    want = PKG.get(pkg.strip().lower())
    if want and want != pkg:
        fixes.append('aina ya kifurushi "%s" > "%s"' % (pkg, want))
    u = norm(unit)
    if u.isdigit():
        u += 'ML'
    if u == '750BT':
        u = '750ML'
    if u != unit:
        fixes.append('kipimo "%s" > "%s"' % (unit, u))
    a = ABBR.get(ab, ab.lower())
    if a != ab:
        fixes.append('kifupi "%s" > "%s"' % (ab, a))
    label = '%s %s (%s)' % (pkg, unit, ab)
    if m['products'] == '0':
        add('6. Kipimo kisichotumika', '', 'KIPIMO id %s: %s' % (m['id'], label), 'Hakitumiwi na bidhaa yoyote.', 'Item Measure > Futa (au kiache kama utakihitaji kwa bidhaa za sehemu ya 2).', 'Item Measure')
    elif fixes:
        add('5. Tahajia ya kipimo', '', 'KIPIMO id %s: %s' % (m['id'], label), 'Tahajia / herufi hazilingani na vipimo vingine (kinatumiwa na bidhaa %s).' % m['products'],
            'Item Measure > Hariri: ' + '; '.join(fixes) + '. (Inawezekana BAADA ya deploy ya toleo jipya tu.)', 'Item Measure')

rows.sort(key=lambda r: (r['daraja'] != 'A', r['kundi'], r['bidhaa'].upper()))
for i, r in enumerate(rows, 1):
    r['kipaumbele'] = i

out = os.path.join(HERE, 'measure-data-cleanup.csv')
with io.open(out, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['kipaumbele', 'daraja', 'kundi', 'id', 'bidhaa', 'tatizo', 'hatua', 'skrini'])
    w.writeheader()
    w.writerows(rows)

print('rows', len(rows))
for g in sorted({r['kundi'] for r in rows}):
    grp = [r for r in rows if r['kundi'] == g]
    print(' ', g, len(grp), '| daraja A:', ', '.join(r['bidhaa'] for r in grp if r['daraja'] == 'A') or '-')
print('class A ids in backtest:', len(CLASS_A))
