import { nitCheckDigit } from './einvoicing.service';

describe('Facturación electrónica · dígito de verificación (igual al backend)', () => {
  it('calcula el DV de NIT reales', () => {
    expect(nitCheckDigit('800197268')).toBe(4); // DIAN
    expect(nitCheckDigit('890.903.938')).toBe(8); // Bancolombia
    expect(nitCheckDigit('')).toBeNull();
  });
});
