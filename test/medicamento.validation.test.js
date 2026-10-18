import { describe, expect, it } from 'vitest';

import {
  medicamentoCreateSchema,
  medicamentoIdSchema,
  medicamentoUpdateSchema,
} from '../src/medicamentos/medicamento.validation.js';

const medicamentoValido = {
  codigo_nacional: '0012345678901',
  descripcion: 'Medicamento ficticio',
  precio: '123.45',
  estado: 'ACTIVO',
  situacion_comercial: 'ALTA',
  tipo_facturacion: 'TD',
};
const opcionales = ['grupo_terapeutico', 'codigo_laboratorio', 'gtatc', 'nombre_grupo', 'anexo'];

describe('validación de Medicamentos', () => {
  it('recorta texto preservando ceros iniciales y capitalización del código nacional', () => {
    const resultado = medicamentoCreateSchema.parse({
      ...medicamentoValido,
      codigo_nacional: '  00AbC  ',
      descripcion: '  Producto  ',
      grupo_terapeutico: '   ',
    });
    expect(resultado.codigo_nacional).toBe('00AbC');
    expect(resultado.descripcion).toBe('Producto');
    expect(resultado.grupo_terapeutico).toBeNull();
  });

  it.each(['codigo_nacional', 'descripcion', 'precio', 'estado', 'situacion_comercial', 'tipo_facturacion'])(
    'requiere %s en POST', (campo) => {
      const cuerpo = { ...medicamentoValido };
      delete cuerpo[campo];
      expect(medicamentoCreateSchema.safeParse(cuerpo).success).toBe(false);
    },
  );

  it.each(opcionales)('permite omitir o enviar null en POST para %s', (campo) => {
    expect(medicamentoCreateSchema.safeParse(medicamentoValido).success).toBe(true);
    expect(medicamentoCreateSchema.safeParse({ ...medicamentoValido, [campo]: null }).success).toBe(true);
  });

  it.each(opcionales)('exige presencia del opcional %s en PUT', (campo) => {
    const cuerpo = { ...medicamentoValido, ...Object.fromEntries(opcionales.map((nombre) => [nombre, null])) };
    delete cuerpo[campo];
    expect(medicamentoUpdateSchema.safeParse(cuerpo).success).toBe(false);
  });

  it('rechaza campos desconocidos y el id en el cuerpo', () => {
    expect(medicamentoCreateSchema.safeParse({ ...medicamentoValido, id: 2 }).success).toBe(false);
    expect(medicamentoUpdateSchema.safeParse({
      ...medicamentoValido,
      ...Object.fromEntries(opcionales.map((nombre) => [nombre, null])),
      extra: true,
    }).success).toBe(false);
  });

  it.each([
    ['estado', 'activo'],
    ['situacion_comercial', 'alta'],
    ['tipo_facturacion', 'td'],
    ['tipo_facturacion', 'VACUNA'],
  ])('rechaza el valor no permitido de %s', (campo, valor) => {
    expect(medicamentoCreateSchema.safeParse({ ...medicamentoValido, [campo]: valor }).success).toBe(false);
  });

  it.each([
    '0', '0.0', '0.00', '000001.2', '9999999999', '9999999999.9', '9999999999.99',
  ])('acepta el precio decimal %s', (valor) => {
    expect(medicamentoCreateSchema.safeParse({ ...medicamentoValido, precio: valor }).success).toBe(true);
  });

  it.each(['-0.01', '10000000000', '9999999999.999', '1,25', '1.', '.25', 'abc', 1.25])(
    'rechaza el precio fuera de formato o rango %s', (valor) => {
      expect(medicamentoCreateSchema.safeParse({ ...medicamentoValido, precio: valor }).success).toBe(false);
    },
  );

  it('acepta IDs positivos compatibles con INTEGER y rechaza los inválidos', () => {
    expect(medicamentoIdSchema.parse('00042')).toBe(42);
    expect(medicamentoIdSchema.parse('2147483647')).toBe(2147483647);
    for (const id of ['texto', '0', '-1', '1.2', '2147483648']) {
      expect(medicamentoIdSchema.safeParse(id).success).toBe(false);
    }
  });
});
