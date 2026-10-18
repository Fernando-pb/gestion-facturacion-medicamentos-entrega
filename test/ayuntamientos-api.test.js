import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  listarMedicamentosAdmitidos, buscarMedicamentos, asociarMedicamento, quitarMedicamento,
  listarFarmaciasAsociadas, buscarFarmacias, asignarFarmacia, quitarFarmacia,
  actualizarAyuntamiento,
  crearAyuntamiento,
  listarAyuntamientos,
  obtenerAyuntamiento,
} from '../public/js/ayuntamientos-api.js';

let fetchSimulado;

const respuestaJson = (datos, { status = 200, ok = true } = {}) => ({
  ok,
  status,
  json: vi.fn().mockResolvedValue(datos),
});

beforeEach(() => {
  fetchSimulado = vi.fn();
  vi.stubGlobal('fetch', fetchSimulado);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cliente HTTP de Ayuntamientos', () => {
  it('lista ayuntamientos mediante GET y devuelve el JSON', async () => {
    const datos = [{ id: 7, denominacion: 'Ayuntamiento ficticio' }];
    fetchSimulado.mockResolvedValue(respuestaJson(datos));

    await expect(listarAyuntamientos()).resolves.toEqual(datos);
    expect(fetchSimulado).toHaveBeenCalledWith('/ayuntamientos', undefined);
  });

  it('consulta un ayuntamiento por ID mediante GET y devuelve el JSON', async () => {
    const datos = { id: 12, denominacion: 'Ayuntamiento ficticio' };
    fetchSimulado.mockResolvedValue(respuestaJson(datos));

    await expect(obtenerAyuntamiento(12)).resolves.toEqual(datos);
    expect(fetchSimulado).toHaveBeenCalledWith('/ayuntamientos/12', undefined);
  });

  it('crea un ayuntamiento mediante POST con JSON', async () => {
    const entrada = { cif: 'TEST-CIF-0009' };
    const creado = { id: 3, ...entrada };
    fetchSimulado.mockResolvedValue(respuestaJson(creado));

    await expect(crearAyuntamiento(entrada)).resolves.toEqual(creado);
    expect(fetchSimulado).toHaveBeenCalledWith('/ayuntamientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entrada),
    });
  });

  it('actualiza un ayuntamiento mediante PUT con el cuerpo completo en JSON', async () => {
    const entrada = { cif: 'TEST-CIF-0009', estado: 'INACTIVO' };
    const actualizado = { id: 3, ...entrada };
    fetchSimulado.mockResolvedValue(respuestaJson(actualizado));

    await expect(actualizarAyuntamiento(3, entrada)).resolves.toEqual(actualizado);
    expect(fetchSimulado).toHaveBeenCalledWith('/ayuntamientos/3', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entrada),
    });
  });

  it.each([
    [400, 'Datos de ayuntamiento no válidos.'],
    [404, 'Ayuntamiento no encontrado.'],
    [409, 'El CIF ya está registrado.'],
  ])('conserva el estado %i y el mensaje funcional del servidor', async (status, mensaje) => {
    fetchSimulado.mockResolvedValue(
      respuestaJson({ error: mensaje }, { status, ok: false }),
    );

    await expect(listarAyuntamientos()).rejects.toMatchObject({
      name: 'ApiError',
      status,
      message: mensaje,
    });
  });

  it('normaliza respuestas de error que no contienen JSON y conserva la causa', async () => {
    const causa = new SyntaxError('Unexpected token');
    fetchSimulado.mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(causa),
    });

    await expect(listarAyuntamientos()).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
      message: 'La API respondió con estado 500 y un cuerpo no JSON válido.',
      cause: causa,
    });
  });

  it('informa del error de red y conserva su causa', async () => {
    const causa = new TypeError('fetch failed');
    fetchSimulado.mockRejectedValue(causa);

    await expect(listarAyuntamientos()).rejects.toMatchObject({
      name: 'ApiError',
      status: null,
      message: 'No se pudo conectar con la API: fetch failed',
      cause: causa,
    });
  });
});

 describe('cliente municipal de Farmacias', () => {
  it('consulta solo la proyección municipal y codifica parámetros literales', async () => {
    fetchSimulado.mockResolvedValue(respuestaJson([]));
    await listarFarmaciasAsociadas(12);
    expect(fetchSimulado).toHaveBeenLastCalledWith('/ayuntamientos/12/farmacias', undefined);
    await buscarFarmacias(12,{campo:'denominacion',modo:'contiene',q:'% & _!'});
    expect(fetchSimulado).toHaveBeenLastCalledWith('/ayuntamientos/12/farmacias/busqueda?campo=denominacion&modo=contiene&q=%25+%26+_%21', undefined);
  });
  it.each([null,4])('envía ID interno y origen observado %s', async (origen) => {
    fetchSimulado.mockResolvedValue(respuestaJson({farmacia_id:2}));
    await asignarFarmacia(12,{farmacia_id:2,ayuntamiento_origen_id:origen});
    expect(fetchSimulado).toHaveBeenCalledWith('/ayuntamientos/12/farmacias', {
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({farmacia_id:2,ayuntamiento_origen_id:origen}),
    });
  });
  it('retira con DELETE y acepta 204 sin leer JSON', async () => {
    const respuesta=respuestaJson(null,{status:204}); respuesta.json.mockRejectedValue(new Error('No hay cuerpo'));
    fetchSimulado.mockResolvedValue(respuesta);
    await expect(quitarFarmacia(12,2)).resolves.toBeNull();
    expect(fetchSimulado).toHaveBeenCalledWith('/ayuntamientos/12/farmacias/2',{method:'DELETE'});
    expect(respuesta.json).not.toHaveBeenCalled();
  });
  it.each([400,404,409])('mantiene error y estado %s de operación municipal', async (status) => {
    fetchSimulado.mockResolvedValue(respuestaJson({error:'Mensaje municipal'},{status,ok:false}));
    await expect(asignarFarmacia(12,{farmacia_id:2,ayuntamiento_origen_id:null})).rejects.toMatchObject({message:'Mensaje municipal',status});
    await expect(quitarFarmacia(12,2)).rejects.toMatchObject({message:'Mensaje municipal',status});
  });
 });

 describe('cliente municipal de Medicamentos', () => {
  it('lista asociaciones y codifica búsqueda del catálogo', async () => {
    fetchSimulado.mockResolvedValue(respuestaJson([]));
    await listarMedicamentosAdmitidos(1);expect(fetchSimulado).toHaveBeenLastCalledWith('/ayuntamientos/1/medicamentos',undefined);
    await buscarMedicamentos({campo:'descripcion',modo:'contiene',q:'% &'});
    expect(fetchSimulado).toHaveBeenLastCalledWith('/medicamentos?campo=descripcion&modo=contiene&q=%25+%26',undefined);
  });
  it('añade únicamente el ID del medicamento', async () => {
    fetchSimulado.mockResolvedValue(respuestaJson({id:101,medicamento_id:11},{status:201}));
    await asociarMedicamento(1,11);expect(fetchSimulado).toHaveBeenCalledWith('/ayuntamientos/1/medicamentos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({medicamento_id:11})});
  });
  it('retira por ID del maestro y acepta 204', async () => {
    const r=respuestaJson(null,{status:204});fetchSimulado.mockResolvedValue(r);await expect(quitarMedicamento(1,11)).resolves.toBeNull();
    expect(fetchSimulado).toHaveBeenCalledWith('/ayuntamientos/1/medicamentos/11',{method:'DELETE'});expect(r.json).not.toHaveBeenCalled();
  });
  it.each([400,404,409])('mantiene error municipal %s',async(status)=>{
    fetchSimulado.mockResolvedValue(respuestaJson({error:'Error municipal'},{status,ok:false}));
    await expect(asociarMedicamento(1,11)).rejects.toMatchObject({status,message:'Error municipal'});
  });
 });
