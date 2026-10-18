import { isDeepStrictEqual } from 'node:util';
import pool from '../db.js';
import { interpretarCodigoPrecinto } from './precinto.validation.js';
import { evaluarAdmisionMedicamento } from './precinto.admision.js';
import { prepararEscritura } from './entrega.service.js';
import { consultarIdentidadEntrega, bloquearPeriodoEntrega, existeFacturacionEntrega,
  consultarEvaluacionEntrega, consultarBloqueoEliminacionEntrega } from './entrega.repository.js';
import { buscarOperacion, bloquearMedicamentoCodigo, siguientePosicion,
  insertarLectura, insertarOperacion, consultarPrecintos, consultarIncidencias, consultarResumen, eliminarEntrada } from './lectura.repository.js';

const consultas = { precintos: consultarPrecintos, incidencias: consultarIncidencias, resumen: consultarResumen };
export const consultarLecturasEntrega = async (entregaId, recurso) => {
  const datos = await consultas[recurso](pool, entregaId);
  return datos === null ? { estadoHttp: 404, datos: { error: 'Entrega no encontrada.' } }
    : { estadoHttp: 200, datos };
};

const operacionRetirada = (operacion, estadoHttp = 409) => ({ estadoHttp,
  datos: { resultado: 'OPERACION_RETIRADA', ...operacion.datos } });
const repeticion = (operacion, solicitud) => operacion.retirada ? operacionRetirada(operacion)
  : isDeepStrictEqual(operacion.solicitud, solicitud)
  ? { estadoHttp: 200, datos: { resultado: 'RECUPERADO', ...operacion.datos } }
  : { estadoHttp: 409, datos: { error: 'La clave ya identifica otro contenido o decisión.', resultado: 'CONFLICTO_CLAVE' } };

export const consultarOperacionLectura = async (entregaId, clave) => {
  const operacion = await buscarOperacion(pool, entregaId, clave);
  if (operacion?.retirada) return operacionRetirada(operacion, 410);
  if (operacion) return { estadoHttp: 200, datos: { resultado: 'RECUPERADO', ...operacion.datos } };
  const entrega = await consultarIdentidadEntrega(pool, entregaId);
  return { estadoHttp: 404, datos: { error: entrega ? 'Operación no encontrada.' : 'Entrega no encontrada.' } };
};

export const eliminarLecturaEntrega = async (entregaId, lecturaId, tipo) => {
  const client = await pool.connect();
  const rechazar = async (estadoHttp, error) => {
    await client.query('ROLLBACK');
    return { estadoHttp, datos: { error } };
  };
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const observada = await consultarIdentidadEntrega(client, entregaId);
    if (!observada) return await rechazar(404, 'Entrega no encontrada.');
    const preparada = await prepararEscritura(client, observada.farmacia_id);
    if (preparada.error) return await rechazar(preparada.estadoHttp, preparada.error);
    if (!await bloquearPeriodoEntrega(client, observada.periodo_id)) return await rechazar(404, 'Periodo no encontrado.');
    const entrega = await consultarIdentidadEntrega(client, entregaId, true);
    if (!entrega) return await rechazar(404, 'Entrega no encontrada.');
    if (entrega.farmacia_id !== observada.farmacia_id || entrega.periodo_id !== observada.periodo_id) {
      return await rechazar(409, 'La identidad de la entrega ha cambiado.');
    }
    const bloqueo = await consultarBloqueoEliminacionEntrega(client, preparada.farmacia.ayuntamiento_id, entrega.periodo_id);
    if (bloqueo.tiene_cobros) {
      return await rechazar(409, 'No se puede eliminar: existe al menos un cobro en la facturación. No se puede modificar la lectura ni reabrir la facturación.');
    }
    if (bloqueo.emitida) {
      return await rechazar(409, 'No se puede eliminar: la facturación está EMITIDA y no tiene cobros. Reábrela de forma controlada antes de modificar la lectura.');
    }
    if (!await eliminarEntrada(client, entregaId, lecturaId, tipo)) return await rechazar(404, 'Lectura no encontrada en la entrega.');
    await client.query('COMMIT');
    return { estadoHttp: 204 };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};

export const guardarLectura = async (entregaId, solicitud) => {
  let codigos;
  try { codigos = interpretarCodigoPrecinto(solicitud.codigo_barras_original); }
  catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return { estadoHttp: 400, datos: { error: error.message } };
  }
  const client = await pool.connect();
  const finalizar = async (resultado, guardar = false) => {
    await client.query(guardar ? 'COMMIT' : 'ROLLBACK');
    return resultado;
  };
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    // Recuperar una operación completada nunca comprueba condiciones actuales.
    let operacion = await buscarOperacion(client, entregaId, solicitud.clave_operacion);
    if (operacion) return await finalizar(repeticion(operacion, solicitud));
    const observada = await consultarIdentidadEntrega(client, entregaId);
    if (!observada) return await finalizar({ estadoHttp: 404, datos: { error: 'Entrega no encontrada.' } });
    const preparada = await prepararEscritura(client, observada.farmacia_id);
    if (preparada.error) return await finalizar({ estadoHttp: preparada.estadoHttp, datos: { error: preparada.error } });
    if (!await bloquearPeriodoEntrega(client, observada.periodo_id)) {
      return await finalizar({ estadoHttp: 404, datos: { error: 'Periodo no encontrado.' } });
    }
    const entrega = await consultarIdentidadEntrega(client, entregaId, true);
    if (!entrega) return await finalizar({ estadoHttp: 404, datos: { error: 'Entrega no encontrada.' } });
    if (entrega.farmacia_id !== observada.farmacia_id || entrega.periodo_id !== observada.periodo_id) {
      return await finalizar({ estadoHttp: 409, datos: { error: 'La identidad de la entrega ha cambiado.' } });
    }
    // Relectura tras esperar al lock: cubre dos peticiones simultáneas y cierre posterior.
    operacion = await buscarOperacion(client, entregaId, solicitud.clave_operacion);
    if (operacion) return await finalizar(repeticion(operacion, solicitud));
    if (await existeFacturacionEntrega(client, preparada.farmacia.ayuntamiento_id, entrega.periodo_id)) {
      return await finalizar({ estadoHttp: 409, datos: { resultado: 'BLOQUEADA_FACTURACION',
        error: 'No se puede escribir: existe facturación para el Ayuntamiento, periodo y tipo TD.' } });
    }
    // Ayuntamiento bloqueado estabiliza modalidad/listas. SHARE impide cambiar
    // precio/estado/código; se reconsulta si apareció un medicamento antes del SELECT coherente.
    let contexto;
    for (;;) {
      const medicamentoId = await bloquearMedicamentoCodigo(client, codigos.codigo_nacional);
      contexto = await consultarEvaluacionEntrega(client, entregaId, codigos.codigo_nacional);
      if (contexto.id === medicamentoId) break;
    }
    const admision = evaluarAdmisionMedicamento({
      medicamento: contexto.id === null ? null : { estado: contexto.estado,
        situacion_comercial: contexto.situacion_comercial, tipo_facturacion: contexto.tipo_facturacion },
      tipo_lista_medicamentos: contexto.tipo_lista_medicamentos,
      pertenece_lista_especifica: contexto.pertenece_lista_especifica,
    });
    const decision = solicitud.decision;
    const aplicable = decision === null
      || (admision.resultado === 'INCIDENCIA' && decision.tipo === 'CONFIRMAR_INCIDENCIA' && decision.motivo === admision.motivo)
      || (admision.resultado === 'PENDIENTE_DECISION_BAJA' && ['ACEPTAR_BAJA', 'APARTAR_BAJA'].includes(decision.tipo));
    if (!aplicable) return await finalizar({ estadoHttp: 409, datos: { resultado: 'CONFLICTO_CONDICIONES',
      error: 'La decisión no corresponde a las condiciones actuales. Evalúa de nuevo.', evaluacion: { ...codigos, ...admision } } });
    if (admision.resultado !== 'ADMITIDO' && decision === null) {
      return await finalizar({ estadoHttp: 200, datos: { resultado: 'DECISION_PENDIENTE', evaluacion: { ...codigos, ...admision } } });
    }
    const motivo = admision.resultado === 'INCIDENCIA' ? admision.motivo
      : decision?.tipo === 'APARTAR_BAJA' ? 'BAJA_COMERCIAL_RECHAZADA_USUARIO' : null;
    const posicion = motivo ? null : await siguientePosicion(client, entregaId, solicitud.nuevo_paquete);
    const lectura = await insertarLectura(client, entregaId, codigos, contexto, motivo, posicion);
    await insertarOperacion(client, entregaId, solicitud, lectura.id, Boolean(motivo));
    const guardada = await buscarOperacion(client, entregaId, solicitud.clave_operacion);
    return await finalizar({ estadoHttp: 201, datos: { resultado: 'GUARDADO', ...guardada.datos } }, true);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
};
