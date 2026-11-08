import { amountMatches, extractAmounts, extractReference } from './payment-proof-ocr';

describe('Lectura del comprobante de pago (OCR)', () => {
  it('toma la referencia junto a su etiqueta, en la misma línea o en la siguiente', () => {
    expect(extractReference('Transferencia exitosa\nReferencia: M8721 4093\nValor $ 105.910')).toBe('M8721');
    expect(extractReference('Comprobante No.\n0045821937')).toBe('0045821937');
    expect(extractReference('Gracias por tu pago')).toBeNull();
  });

  it('el comprobante debe ser por el valor esperado (sin valores leídos no se bloquea)', () => {
    expect(amountMatches([105910, 0.5], 105910)).toBeTrue();
    expect(amountMatches([60000], 105910)).toBeFalse();
    expect(amountMatches([], 105910)).toBeTrue();
    // Pago dividido: cualquiera de las partes (o su suma)
    expect(amountMatches([40000], [40000, 65910, 105910])).toBeTrue();
  });

  it('lee los valores en pesos', () => {
    expect(extractAmounts('Valor $ 105.910,00\nCosto 0 COP')).toEqual([105910]);
  });
});
