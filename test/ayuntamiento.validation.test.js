import { describe, expect, it } from 'vitest';

import {
  ayuntamientoBodySchema,
  ayuntamientoIdSchema,
} from '../src/ayuntamientos/ayuntamiento.validation.js';

const ayuntamientoValido = {
  cif: 'TEST-CIF-0018',
  denominacion: 'Ayuntamiento de Prueba',
  direccion: 'Calle Mayor, 1',
  codigo_postal: '28001',
  localidad: 'Villa de Prueba',
  provincia: 'Madrid',
  estado: 'ACTIVO',
  tipo_lista_medicamentos: 'GENERAL',
};

const camposObligatorios = [
  'cif',
  'denominacion',
  'direccion',
  'codigo_postal',
  'localidad',
  'provincia',
  'estado',
  'tipo_lista_medicamentos',
];

describe('ayuntamientoBodySchema', () => {
  it('normaliza el CIF y recorta las cadenas obligatorias', () => {
    const resultado = ayuntamientoBodySchema.parse({
      ...ayuntamientoValido,
      cif: '  test-cif-0018  ',
      denominacion: '  Ayuntamiento de Prueba  ',
    });

    expect(resultado.cif).toBe('TEST-CIF-0018');
    expect(resultado.denominacion).toBe('Ayuntamiento de Prueba');
  });

  it.each(camposObligatorios)(
    'rechaza la ausencia del campo obligatorio %s',
    (campo) => {
      const cuerpoIncompleto = { ...ayuntamientoValido };
      delete cuerpoIncompleto[campo];

      expect(ayuntamientoBodySchema.safeParse(cuerpoIncompleto).success).toBe(
        false,
      );
    },
  );

  it('rechaza una cadena obligatoria vacia', () => {
    const resultado = ayuntamientoBodySchema.safeParse({
      ...ayuntamientoValido,
      denominacion: '',
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza una cadena obligatoria formada solo por espacios', () => {
    const resultado = ayuntamientoBodySchema.safeParse({
      ...ayuntamientoValido,
      direccion: '   ',
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza un estado no permitido', () => {
    const resultado = ayuntamientoBodySchema.safeParse({
      ...ayuntamientoValido,
      estado: 'PENDIENTE',
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza un tipo de lista de medicamentos no permitido', () => {
    const resultado = ayuntamientoBodySchema.safeParse({
      ...ayuntamientoValido,
      tipo_lista_medicamentos: 'OTRA',
    });

    expect(resultado.success).toBe(false);
  });

  it('acepta que los campos opcionales se omitan', () => {
    expect(ayuntamientoBodySchema.safeParse(ayuntamientoValido).success).toBe(
      true,
    );
  });

  it('acepta los campos opcionales con valor null', () => {
    const resultado = ayuntamientoBodySchema.safeParse({
      ...ayuntamientoValido,
      telefono: null,
      movil: null,
      persona_responsable: null,
      persona_contacto: null,
      alcalde: null,
    });

    expect(resultado.success).toBe(true);
  });

  it('rechaza tipos de datos incorrectos', () => {
    const obligatorioIncorrecto = ayuntamientoBodySchema.safeParse({
      ...ayuntamientoValido,
      codigo_postal: 28001,
    });
    const opcionalIncorrecto = ayuntamientoBodySchema.safeParse({
      ...ayuntamientoValido,
      telefono: 123,
    });

    expect(obligatorioIncorrecto.success).toBe(false);
    expect(opcionalIncorrecto.success).toBe(false);
  });

  it('rechaza campos desconocidos', () => {
    const resultado = ayuntamientoBodySchema.safeParse({
      ...ayuntamientoValido,
      id: 1,
    });

    expect(resultado.success).toBe(false);
  });
});

describe('ayuntamientoIdSchema', () => {
  it('acepta un entero positivo recibido como string y lo convierte a numero', () => {
    expect(ayuntamientoIdSchema.parse('42')).toBe(42);
  });

  it('acepta ceros iniciales y devuelve el valor numerico', () => {
    expect(ayuntamientoIdSchema.parse('01')).toBe(1);
  });

  it('acepta el maximo de PostgreSQL INTEGER', () => {
    expect(ayuntamientoIdSchema.parse('2147483647')).toBe(2147483647);
  });

  it('rechaza valores superiores al maximo de PostgreSQL INTEGER', () => {
    expect(ayuntamientoIdSchema.safeParse('2147483648').success).toBe(false);
  });

  it('rechaza identificadores con formato invalido', () => {
    for (const id of ['', 'abc', '1.5', ' 1 ']) {
      expect(ayuntamientoIdSchema.safeParse(id).success).toBe(false);
    }
  });

  it('rechaza cero y valores negativos', () => {
    expect(ayuntamientoIdSchema.safeParse('0').success).toBe(false);
    expect(ayuntamientoIdSchema.safeParse('-1').success).toBe(false);
  });
});
