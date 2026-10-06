import { packSize, packUnit, productDetail, productLabel, productTitle } from './product-label';

describe('product label', () => {
  it('title = NAME UNIT, the unit is not repeated when the name already has it', () => {
    expect(productTitle('CUCA', '200ML')).toBe('CUCA 200ML');
    expect(productTitle(' COCA & FANTA AWAY ', ' 750ML ')).toBe('COCA & FANTA AWAY 750ML');
    expect(productTitle('SAFARI LAGER', null)).toBe('SAFARI LAGER');
    expect(productTitle('PEPSI && MIRINDA 250ML', '250 ML')).toBe('PEPSI && MIRINDA 250ML');
    expect(productTitle('Castle Lite Can 330ML', '330ml')).toBe('Castle Lite Can 330ML');
  });

  it('package unit = the abbreviation in lower case, else the fallback word', () => {
    expect(packUnit('CRT')).toBe('crt');
    expect(packUnit(' ctn ')).toBe('ctn');
    expect(packUnit(null)).toBe('pkg');
    expect(packUnit('', 'pkt')).toBe('pkt');
  });

  it('pack size is shown only above one piece per package', () => {
    expect(packSize(30, 'ctn')).toBe('30 pcs/ctn');
    expect(packSize(12, null, { pkg: 'pkt' })).toBe('12 pcs/pkt');
    expect(packSize(1, 'ctn')).toBe('');
    expect(packSize(null, 'ctn')).toBe('');
  });

  it('one line: NAME UNIT · category · N pcs/abbr', () => {
    expect(productLabel({ name: 'CUCA', unit: '200ML', category: 'SPIRIT', piecesPerPackage: 30, abbreviation: 'ctn' })).toBe('CUCA 200ML · SPIRIT · 30 pcs/ctn');
    expect(productLabel({ name: 'SAFARI LAGER', unit: '375ML', category: 'Beer', piecesPerPackage: 20, abbreviation: 'crt' })).toBe('SAFARI LAGER 375ML · Beer · 20 pcs/crt');
    // No measure: the name stays, the package falls back to "pkg".
    expect(productLabel({ name: 'AFYA MAJI 600ML', category: 'MAJI', piecesPerPackage: 12 })).toBe('AFYA MAJI 600ML · MAJI · 12 pcs/pkg');
    // Sold by measure (no package): name and category only.
    expect(productLabel({ name: 'WINE ZA KUPIMA', category: 'Wines', piecesPerPackage: null })).toBe('WINE ZA KUPIMA · Wines');
    expect(productLabel({ name: 'X' })).toBe('X');
  });

  it('detail = the label without the name', () => {
    expect(productDetail({ category: 'Beer', piecesPerPackage: 24, abbreviation: 'CTN' })).toBe('Beer · 24 pcs/ctn');
    expect(productDetail({ category: null, piecesPerPackage: 24, abbreviation: 'ctn' })).toBe('24 pcs/ctn');
    expect(productDetail({ category: 'Beer', piecesPerPackage: 1 })).toBe('Beer');
  });
});
