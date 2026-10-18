import pool from '../db.js';
import { interpretarCodigoPrecinto } from './precinto.validation.js';
import { evaluarAdmisionMedicamento } from './precinto.admision.js';
import {
  bloquearFarmaciaEntrega, bloquearPeriodoEntrega, buscarEntrega, insertarEntrega,
  consultarFarmaciaEntrega, bloquearAyuntamientoEntrega, existeFacturacionEntrega,
  consultarIdentidadEntrega, actualizarDeclaradosEntrega, consultarEvaluacionEntrega,
  buscarPeriodoPorFecha, resolverPeriodoEntrega,
} from './entrega.repository.js';

const escrituraBloqueada = 'No se puede escribir: existe facturación para el Ayuntamiento, periodo y tipo TD.';

export const evaluarEntrega = async (id, entrada) => {
  let codigos;
  try {
    codigos = interpretarCodigoPrecinto(entrada);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return { estadoHttp: 400, datos: { error: error.message } };
  }
  const contexto = await consultarEvaluacionEntrega(pool, id, codigos.codigo_nacional);
  if (contexto === null) return { estadoHttp: 404, datos: { error: 'Entrega no encontrada.' } };
  if (contexto.tipo_lista_medicamentos === null) {
    return { estadoHttp: 409, datos: { error: 'La farmacia no tiene Ayuntamiento asociado.' } };
  }
  const medicamento = contexto.id === null ? null : {
    id: contexto.id, descripcion: contexto.descripcion, precio: contexto.precio,
    estado: contexto.estado, situacion_comercial: contexto.situacion_comercial,
    tipo_facturacion: contexto.tipo_facturacion,
  };
  const admision = evaluarAdmisionMedicamento({
    medicamento: medicamento === null ? null : {
      estado: medicamento.estado, situacion_comercial: medicamento.situacion_comercial,
      tipo_facturacion: medicamento.tipo_facturacion,
    },
    tipo_lista_medicamentos: contexto.tipo_lista_medicamentos,
    pertenece_lista_especifica: contexto.pertenece_lista_especifica,
  });
  return { estadoHttp: 200, datos: { ...codigos, ...admision, medicamento } };
};

// Se conoce el Ayuntamiento mediante lectura sin lock y se revalida después.
// Nunca adquirir el lock municipal reteniendo antes un lock de Farmacia.
export const prepararEscritura = async (client, farmaciaId) => {
  const observada = await consultarFarmaciaEntrega(client, farmaciaId);
  if (observada === null) return { estadoHttp: 404, error: 'Farmacia no encontrada.' };
  if (observada.ayuntamiento_id === null) {
    return { estadoHttp: 409, error: 'La farmacia no tiene Ayuntamiento asociado.' };
  }
  if (await bloquearAyuntamientoEntrega(client, observada.ayuntamiento_id) === null) {
    return { estadoHttp: 409, error: 'La asignación municipal ha cambiado. Consulta la farmacia de nuevo.' };
  }
  const farmacia = await bloquearFarmaciaEntrega(client, farmaciaId);
  if (farmacia === null) return { estadoHttp: 404, error: 'Farmacia no encontrada.' };
  if (farmacia.ayuntamiento_id !== observada.ayuntamiento_id) {
    return { estadoHttp: 409, error: 'La asignación municipal ha cambiado. Consulta la farmacia de nuevo.' };
  }
  return { farmacia };
};

export const accederEntrega = async ({ farmacia_id: farmaciaId, periodo_id: idIndicado, mes, anio }, crear = false) => {
  const client = await pool.connect();
  const rechazar = async (estadoHttp, error) => {
    await client.query('ROLLBACK');
    return { estadoHttp, datos: { error } };
  };
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    let periodoId = idIndicado ?? (await buscarPeriodoPorFecha(client, mes, anio))?.id;
    // Recuperar por POST no modifica nada ni necesita el bloqueo de escritura.
    if (crear && periodoId !== undefined) {
      const existente = await buscarEntrega(client, farmaciaId, periodoId);
      if (existente !== null) {
        await client.query('COMMIT');
        return { estadoHttp: 200, datos: existente };
      }
    }
    const preparada = crear ? await prepararEscritura(client, farmaciaId) : null;
    if (preparada?.error) return await rechazar(preparada.estadoHttp, preparada.error);
    const farmacia = crear ? preparada.farmacia : await bloquearFarmaciaEntrega(client, farmaciaId);
    if (farmacia === null) return await rechazar(404, 'Farmacia no encontrada.');
    if (farmacia.ayuntamiento_id === null) {
      return await rechazar(409, 'La farmacia no tiene Ayuntamiento asociado.');
    }
    // Nunca insertar/esperar el periodo antes de Ayuntamiento → Farmacia.
    // Solo una fecha ausente en POST puede crear; GET permanece de consulta.
    if (periodoId === undefined && crear) periodoId = await resolverPeriodoEntrega(client, mes, anio);
    if (periodoId === undefined) return await rechazar(404, 'Periodo no encontrado.');
    if (await bloquearPeriodoEntrega(client, periodoId) === null) {
      return await rechazar(404, 'Periodo no encontrado.');
    }

    let entrega = await buscarEntrega(client, farmaciaId, periodoId);
    let estadoHttp = 200;
    if (entrega === null && crear) {
      // Snapshot nuevo después del lock municipal; también cubre fila inexistente.
      if (await existeFacturacionEntrega(client, farmacia.ayuntamiento_id, periodoId)) {
        return await rechazar(409, escrituraBloqueada);
      }
      const nueva = await insertarEntrega(client, farmacia, periodoId);
      estadoHttp = nueva === null ? 200 : 201;
      // Consulta separada: READ COMMITTED ve el INSERT concurrente confirmado
      // tras la espera de UNIQUE, sin sobrescribir su snapshot.
      entrega = await buscarEntrega(client, farmaciaId, periodoId);
    }
    if (entrega === null) return await rechazar(404, 'Entrega no encontrada.');
    await client.query('COMMIT');
    return { estadoHttp, datos: entrega };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const corregirDeclarados = async (id, datos) => {
  const client = await pool.connect();
  const rechazar = async (estadoHttp, error) => {
    await client.query('ROLLBACK');
    return { estadoHttp, datos: { error } };
  };
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const observada = await consultarIdentidadEntrega(client, id);
    if (observada === null) return await rechazar(404, 'Entrega no encontrada.');
    const preparada = await prepararEscritura(client, observada.farmacia_id);
    if (preparada.error) return await rechazar(preparada.estadoHttp, preparada.error);
    if (await bloquearPeriodoEntrega(client, observada.periodo_id) === null) {
      return await rechazar(404, 'Periodo no encontrado.');
    }
    const entrega = await consultarIdentidadEntrega(client, id, true);
    if (entrega === null) return await rechazar(404, 'Entrega no encontrada.');
    if (entrega.farmacia_id !== observada.farmacia_id || entrega.periodo_id !== observada.periodo_id) {
      return await rechazar(409, 'La identidad de la entrega ha cambiado. Consulta la entrega de nuevo.');
    }
    if (await existeFacturacionEntrega(client, preparada.farmacia.ayuntamiento_id, entrega.periodo_id)) {
      return await rechazar(409, escrituraBloqueada);
    }
    await actualizarDeclaradosEntrega(client, id, datos);
    const resultado = await buscarEntrega(client, entrega.farmacia_id, entrega.periodo_id);
    await client.query('COMMIT');
    return { estadoHttp: 200, datos: resultado };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
