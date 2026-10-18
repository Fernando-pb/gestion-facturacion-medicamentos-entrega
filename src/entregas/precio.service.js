import pool from '../db.js';
import { prepararEscritura } from './entrega.service.js';
import { consultarIdentidadEntrega, bloquearPeriodoEntrega } from './entrega.repository.js';
import { consultarFacturacion } from '../facturacion/facturacion.repository.js';
import { contextoPrecioEntrega, actualizarPrecioPrecinto, recalcularParticipacionEntrega } from './precio.repository.js';
import { consultarResumen } from './lectura.repository.js';

const motivoBloqueo = (contexto) => {
  if (contexto.tiene_cobros) return 'Existe un cobro en una de las facturas. No se puede reabrir ni corregir precios.';
  if (contexto.estado === 'EMITIDA') return 'Facturación emitida. Debe reabrirse de forma controlada, con fecha y motivo, antes de corregir precios.';
  if (contexto.facturacion_id && !['REVISION', 'REABIERTA'].includes(contexto.estado)) return 'El estado de la facturación no permite corregir precios.';
  return null;
};
const describir = (contexto) => ({ ...contexto, estado_entrega: contexto.facturacion_id ? contexto.estado : 'SIN_FACTURAR',
  permite_correccion: !motivoBloqueo(contexto), motivo_bloqueo: motivoBloqueo(contexto) });
export const consultarContextoPrecios = async (entregaId) => {
  const contexto = await contextoPrecioEntrega(pool, entregaId);
  return contexto ? { estadoHttp: 200, datos: describir(contexto) }
    : { estadoHttp: 404, datos: { error: 'Entrega no encontrada.' } };
};

export const corregirPrecio = async (entregaId, precintoId, datos) => {
  const client = await pool.connect();
  const rechazar = async (estadoHttp, error) => {
    await client.query('ROLLBACK'); return { estadoHttp, datos: { error } };
  };
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const observada = await consultarIdentidadEntrega(client, entregaId);
    if (!observada) return await rechazar(404, 'Entrega no encontrada.');
    const preparada = await prepararEscritura(client, observada.farmacia_id);
    if (preparada.error) return await rechazar(preparada.estadoHttp, preparada.error);
    if (!await bloquearPeriodoEntrega(client, observada.periodo_id)) return await rechazar(404, 'Periodo no encontrado.');
    const entrega = await consultarIdentidadEntrega(client, entregaId, true);
    if (!entrega || entrega.farmacia_id !== observada.farmacia_id || entrega.periodo_id !== observada.periodo_id) {
      return await rechazar(409, 'La identidad de la entrega ha cambiado. Consulta de nuevo.');
    }
    // El cierre/reapertura/cobro adquiere primero el mismo Ayuntamiento.
    // Consultas nuevas tras esperar: no confiar en el contexto observado por la UI.
    await consultarFacturacion(client, preparada.farmacia.ayuntamiento_id, entrega.periodo_id, true);
    const contexto = await contextoPrecioEntrega(client, entregaId);
    const bloqueo = motivoBloqueo(contexto);
    if (bloqueo) return await rechazar(409, bloqueo);
    const lectura = await actualizarPrecioPrecinto(client, entregaId, precintoId, datos.precio_aplicado);
    if (!lectura) return await rechazar(404, 'Precinto no encontrado en la entrega.');
    // Sin revisión no se crea cabecera ni participación; si existe, se actualiza su suma.
    const participacion = contexto.participacion_id
      ? await recalcularParticipacionEntrega(client, entregaId, contexto.facturacion_id) : null;
    const resumen = await consultarResumen(client, entregaId);
    await client.query('COMMIT');
    return { estadoHttp: 200, datos: { entrega_id: entregaId, facturacion_id: contexto.facturacion_id,
      lectura, lecturas_actualizadas: 1, importe_precintos: participacion?.importe_precintos ?? null,
      subtotal_facturable: resumen.subtotal_facturable } };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '22003') return { estadoHttp: 409, datos: { error: 'El importe corregido supera la capacidad monetaria del esquema. No se ha guardado ningún cambio.' } };
    throw error;
  } finally { client.release(); }
};
