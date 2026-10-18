import { describe, expect, it } from 'vitest';
import { interpretarCodigoPrecinto } from '../src/entregas/precinto.validation.js';

describe('interpretación del código de precinto', () => {
  it.each([
    ['8470006772911', '677291'],
    ['677291', '677291'],
    ['8470000012345', '001234'],
    ['001234', '001234'],
    ['8470000000000', '000000'],
    ['000000', '000000'],
  ])('conserva %s y obtiene el código nacional %s', (entrada, nacional) => {
    expect(interpretarCodigoPrecinto(entrada)).toEqual({
      codigo_barras_original: entrada, codigo_nacional: nacional,
    });
  });

  it.each([
    undefined, null, 677291, 8470006772911, 0, true, false, NaN, Infinity,
    {}, [], ['677291'], new String('677291'),
    '', 'abc', 'ABCDEF', '67729a', '847000677291a',
    '67729', '6772911', '847000677291', '84700067729111',
    '8460006772911', '9470006772911', '0000006772911',
    ' 677291', '677291 ', '677 291', ' 8470006772911', '8470006772911 ',
    '847000677 2911', '677291\n', '677291\r', '677291\r\n', '8470006772911\n',
    '67729\n', '847000677291\n', '\t677291', '677\t291', '677291\0',
    '+677291', '６７７２９１', '٦٧٧٢٩١',
  ])('rechaza entrada inválida %s sin normalizarla', (entrada) => {
    expect(() => interpretarCodigoPrecinto(entrada)).toThrow(TypeError);
    expect(() => interpretarCodigoPrecinto(entrada)).toThrow(/Entrada de precinto no válida/);
  });

  it.each(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])(
    'admite cualquier último dígito %s sin validar el control EAN-13', (ultimo) => {
      const entrada = `847000677291${ultimo}`;
      expect(interpretarCodigoPrecinto(entrada)).toEqual({
        codigo_barras_original: entrada, codigo_nacional: '677291',
      });
    },
  );

  it.each(['677291', '8470006772911'])('no detecta duplicados en llamadas sucesivas con %s', (entrada) => {
    const primera = interpretarCodigoPrecinto(entrada);
    expect(interpretarCodigoPrecinto(entrada)).toEqual(primera);
    expect(interpretarCodigoPrecinto(entrada)).toEqual(primera);
  });
});
