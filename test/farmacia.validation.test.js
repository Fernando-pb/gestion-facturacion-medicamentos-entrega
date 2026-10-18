import { describe, expect, it } from 'vitest';

import {
  farmaciaCreateSchema,
  farmaciaIdSchema,
  farmaciaUpdateSchema,
} from '../src/farmacias/farmacia.validation.js';

const farmaciaValida = {
  soe: 'SOE-001',
  cif_nif: 'TEST-CIF-0009',
  denominacion: 'Farmacia de Prueba',
  direccion: 'Calle de Prueba, 1',
  codigo_postal: '28001',
  localidad: 'Localidad de Prueba',
  provincia: 'Provincia de Prueba',
  ayuntamiento_id: 1,
};

describe('validación de Farmacias', () => {
  it('acepta datos de alta completos y datos bancarios opcionales omitidos', () => {
    expect(farmaciaCreateSchema.safeParse(farmaciaValida).success).toBe(true);
  });

  it('rechaza la ausencia de campos obligatorios', () => {
    for (const campo of ['soe', 'cif_nif', 'denominacion', 'direccion', 'codigo_postal', 'localidad', 'provincia', 'ayuntamiento_id']) {
      const data = { ...farmaciaValida };
      delete data[campo];
      expect(farmaciaCreateSchema.safeParse(data).success).toBe(false);
    }
  });

  it('rechaza cadenas obligatorias vacías o solo con espacios', () => {
    expect(farmaciaCreateSchema.safeParse({ ...farmaciaValida, denominacion: '   ' }).success).toBe(false);
    expect(farmaciaCreateSchema.safeParse({ ...farmaciaValida, soe: '' }).success).toBe(false);
  });

  it('acepta campos opcionales nulos y rechaza tipos distintos de texto', () => {
    expect(farmaciaCreateSchema.safeParse({ ...farmaciaValida, telefono: null }).success).toBe(true);
    expect(farmaciaCreateSchema.safeParse({ ...farmaciaValida, telefono: 123 }).success).toBe(false);
  });

  it('requiere referencia positiva y compatible con INTEGER al crear', () => {
    for (const ayuntamiento_id of [null, 0, -1, 1.5, '1', 2147483648]) {
      expect(farmaciaCreateSchema.safeParse({ ...farmaciaValida, ayuntamiento_id }).success).toBe(false);
    }
  });

  it('rechaza ayuntamiento_id y cualquier campo desconocido durante la edición', () => {
    expect(farmaciaUpdateSchema.safeParse({ ...farmaciaValida, ayuntamiento_id: 2 }).success).toBe(false);
    expect(farmaciaUpdateSchema.safeParse({ ...farmaciaValida, ayuntamiento_id: null }).success).toBe(false);
    const { ayuntamiento_id, ...editable } = farmaciaValida;
    expect(farmaciaUpdateSchema.safeParse({ ...editable, campo_extra: 'no' }).success).toBe(false);
  });

  it('valida IDs de ruta como enteros positivos de PostgreSQL', () => {
    expect(farmaciaIdSchema.parse('23')).toBe(23);
    for (const id of ['0', '-1', '1.5', 'abc', '2147483648']) {
      expect(farmaciaIdSchema.safeParse(id).success).toBe(false);
    }
  });
});
