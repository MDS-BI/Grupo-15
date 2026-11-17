import { describe, it, expect } from 'vitest';
import { decimalInput, parseDecimal } from '../../src/components/numeric-field.js';

describe('parseDecimal', () => {
  it('acepta punto y coma decimal', () => {
    expect(parseDecimal('1.5')).toBe(1.5);
    expect(parseDecimal('1,5')).toBe(1.5);
  });

  it('respeta obligatoriedad, precisión y rangos', () => {
    expect(parseDecimal('', { required: false })).toBeNull();
    expect(() => parseDecimal('', { required: true, label: 'El valor' })).toThrow(/obligatorio/);
    expect(() => parseDecimal('1,234')).toThrow(/2 decimales/);
    expect(() => parseDecimal('abc')).toThrow(/número válido/);
    expect(() => parseDecimal('0', { min: 0.01, label: 'El valor' })).toThrow(/al menos/);
    expect(() => parseDecimal('2', { max: 1, label: 'El valor' })).toThrow(/superar/);
  });

  it('normaliza valores con separadores de miles', () => {
    expect(parseDecimal('1.234,56')).toBe(1234.56);
    expect(parseDecimal('1,234.56')).toBe(1234.56);
  });
});

describe('decimalInput', () => {
  it('renderiza un campo de texto decimal sin flechas nativas', () => {
    const html = decimalInput({
      name: 'minutes',
      placeholder: 'Minutos',
      required: true,
      min: 0,
      label: 'Los minutos',
    });
    expect(html).toContain('type="text"');
    expect(html).toContain('inputmode="decimal"');
    expect(html).not.toContain('type="number"');
    expect(html).not.toContain('step=');
    expect(html).toContain('data-min="0"');
    expect(html).toContain('aria-required="true"');
    expect(html).not.toContain(' required');
  });
});
