import { describe, expect, it } from 'vitest';
import { normalizarDecimal, formatoMonetario, configurarCampoMonetario } from '../public/js/decimales.js';

describe('decimales en cadena', () => {
  it.each([['12,34', '12.34'], ['12.34', '12.34'], ['0000,01', '0000.01'],
    ['0', '0'], ['9999999999,99', '9999999999.99']])('normaliza %s sin perder precisión', (entrada, salida) => {
    expect(normalizarDecimal(entrada)).toBe(salida);
  });
  it.each(['', ' ', '1,234', '1.234', '1.234,56', '1,234.56', '1 234', '12€',
    '1.', ',5', '-1', '+1', '1e3', 'NaN', '10000000000', 1, null])('rechaza %j sin redondear', (valor) => {
    expect(() => normalizarDecimal(valor)).toThrow();
  });
  it('distingue vacío nullable, cero e importe obligatorio, y recorte explícito', () => {
    expect(normalizarDecimal('', { nullable: true })).toBeNull();
    expect(normalizarDecimal('0', { nullable: true })).toBe('0');
    expect(() => normalizarDecimal('')).toThrow();
    expect(normalizarDecimal(' 1,20 ', { recortar: true })).toBe('1.20');
  });
  it('respeta otra precisión sin añadir ceros ni unidades', () => {
    expect(normalizarDecimal('001,234', { decimales: 3 })).toBe('001.234');
    expect(normalizarDecimal('1,2', { decimales: 3 })).toBe('1.2');
    expect(() => normalizarDecimal('1,2345', { decimales: 3 })).toThrow();
  });
  it.each([['0', '0,00'], ['12.3', '12,30'], ['9999999999.99', '9999999999,99'],
    [null, ''], ['', '']])('presenta moneda %j con dos decimales y sin símbolo', (entrada, salida) => {
    expect(formatoMonetario(entrada)).toBe(salida);
  });
  it('blur conserva inválidos y vacío, y recupera estado al corregir', () => {
    let blur;
    const input = { value: '1,234', attributes: {}, addEventListener: (_, fn) => { blur = fn; },
      setAttribute(nombre, valor) { this.attributes[nombre] = valor; } };
    configurarCampoMonetario(input, { nullable: true }); blur();
    expect(input.value).toBe('1,234'); expect(input.attributes['aria-invalid']).toBe('true');
    input.value = ''; blur(); expect(input.value).toBe('');
    input.value = '12.3'; blur(); expect(input.value).toBe('12,30');
    expect(input.attributes['aria-invalid']).toBe('false'); expect(input.attributes.title).toBe('');
  });
});
