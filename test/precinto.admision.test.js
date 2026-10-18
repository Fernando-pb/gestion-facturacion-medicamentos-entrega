import { describe, expect, it } from 'vitest';
import { evaluarAdmisionMedicamento } from '../src/entregas/precinto.admision.js';

const entradaValida = (cambios = {}) => ({
  medicamento: { estado: 'ACTIVO', situacion_comercial: 'ALTA', tipo_facturacion: 'TD' },
  tipo_lista_medicamentos: 'GENERAL',
  pertenece_lista_especifica: false,
  ...cambios,
});

describe('evaluación pura de admisión de medicamento TD', () => {
  it('clasifica medicamento ausente como desconocido', () => {
    expect(evaluarAdmisionMedicamento(entradaValida({ medicamento: null }))).toEqual({
      resultado: 'INCIDENCIA', motivo: 'MEDICAMENTO_DESCONOCIDO',
    });
  });

  it.each(['ALTA', 'BAJA'])('INACTIVO en %s tiene prioridad sobre autorización específica y BAJA', (situacion_comercial) => {
    expect(evaluarAdmisionMedicamento(entradaValida({
      medicamento: { estado: 'INACTIVO', situacion_comercial, tipo_facturacion: 'TD' },
      tipo_lista_medicamentos: 'ESPECIFICA', pertenece_lista_especifica: false,
    }))).toEqual({ resultado: 'INCIDENCIA', motivo: 'MEDICAMENTO_INACTIVO' });
  });

  it('GENERAL admite ACTIVO/ALTA e ignora la pertenencia específica', () => {
    for (const pertenece_lista_especifica of [false, true]) {
      expect(evaluarAdmisionMedicamento(entradaValida({ pertenece_lista_especifica })))
        .toEqual({ resultado: 'ADMITIDO' });
    }
  });

  it('ESPECIFICA admite ACTIVO/ALTA con pertenencia', () => {
    expect(evaluarAdmisionMedicamento(entradaValida({
      tipo_lista_medicamentos: 'ESPECIFICA', pertenece_lista_especifica: true,
    }))).toEqual({ resultado: 'ADMITIDO' });
  });

  it.each(['ALTA', 'BAJA'])('ESPECIFICA sin pertenencia rechaza %s antes de decidir por BAJA', (situacion_comercial) => {
    expect(evaluarAdmisionMedicamento(entradaValida({
      medicamento: { estado: 'ACTIVO', situacion_comercial, tipo_facturacion: 'TD' },
      tipo_lista_medicamentos: 'ESPECIFICA', pertenece_lista_especifica: false,
    }))).toEqual({ resultado: 'INCIDENCIA', motivo: 'MEDICAMENTO_NO_AUTORIZADO' });
  });

  it.each([
    ['GENERAL', false], ['ESPECIFICA', true],
  ])('%s autorizado y BAJA devuelve solo decisión pendiente', (tipo_lista_medicamentos, pertenece_lista_especifica) => {
    expect(evaluarAdmisionMedicamento(entradaValida({
      medicamento: { estado: 'ACTIVO', situacion_comercial: 'BAJA', tipo_facturacion: 'TD' },
      tipo_lista_medicamentos, pertenece_lista_especifica,
    }))).toEqual({ resultado: 'PENDIENTE_DECISION_BAJA' });
  });

  it.each([
    ['argumento ausente', undefined],
    ['argumento nulo', null],
    ['argumento textual', 'ACTIVO'],
    ['argumento array', []],
    ['campos omitidos', {}],
    ['medicamento omitido', { tipo_lista_medicamentos: 'GENERAL', pertenece_lista_especifica: false }],
    ['modalidad omitida', { medicamento: null, pertenece_lista_especifica: false }],
    ['pertenencia omitida', { medicamento: null, tipo_lista_medicamentos: 'GENERAL' }],
    ['medicamento mal tipado', entradaValida({ medicamento: false })],
    ['medicamento incompleto', entradaValida({ medicamento: { estado: 'ACTIVO' } })],
    ['modalidad inválida', entradaValida({ tipo_lista_medicamentos: 'OTRA' })],
    ['pertenencia textual', entradaValida({ pertenece_lista_especifica: 'false' })],
    ['pertenencia numérica', entradaValida({ pertenece_lista_especifica: 1 })],
    ['pertenencia nula', entradaValida({ pertenece_lista_especifica: null })],
    ['ausente con pertenencia contradictoria', entradaValida({ medicamento: null, pertenece_lista_especifica: true })],
    ['autorizado opaco adicional', { ...entradaValida(), autorizado: true }],
    ['campo desconocido del medicamento', entradaValida({ medicamento: {
      estado: 'ACTIVO', situacion_comercial: 'ALTA', tipo_facturacion: 'TD', autorizado: true,
    } })],
  ])('trata %s como error de entrada sin motivo de incidencia', (_nombre, entrada) => {
    expect(() => evaluarAdmisionMedicamento(entrada)).toThrow(TypeError);
  });

  it.each([
    ['estado', 'BAJA'], ['estado', 'activo'], ['situacion_comercial', 'ACTIVO'],
    ['tipo_facturacion', 'VACUNA'], ['tipo_facturacion', null],
  ])('rechaza categoría inválida %s=%s antes de aplicar reglas de negocio', (campo, valor) => {
    const entrada = entradaValida();
    entrada.medicamento[campo] = valor;
    expect(() => evaluarAdmisionMedicamento(entrada)).toThrow(TypeError);
  });

  it('no oculta un tipo no soportado tras la prioridad de INACTIVO', () => {
    const entrada = entradaValida({ medicamento: {
      estado: 'INACTIVO', situacion_comercial: 'BAJA', tipo_facturacion: 'VACUNA',
    } });
    expect(() => evaluarAdmisionMedicamento(entrada)).toThrow(TypeError);
  });

  it.each([
    entradaValida(),
    entradaValida({ medicamento: null }),
    entradaValida({ tipo_lista_medicamentos: 'ESPECIFICA', pertenece_lista_especifica: false }),
    entradaValida({ medicamento: { estado: 'ACTIVO', situacion_comercial: 'BAJA', tipo_facturacion: 'TD' } }),
  ])('no modifica los argumentos en ninguna clase de resultado', (entrada) => {
    const copia = structuredClone(entrada);
    if (entrada.medicamento !== null) Object.freeze(entrada.medicamento);
    Object.freeze(entrada);
    evaluarAdmisionMedicamento(entrada);
    expect(entrada).toEqual(copia);
  });
});
