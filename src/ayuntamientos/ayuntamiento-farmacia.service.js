import pool from '../db.js';
import {
  actualizarAsignacion, bloquearAyuntamiento, bloquearFarmacia,
  consultarActividad, consultarAsignacionVisible,
} from './ayuntamiento-farmacia.repository.js';

export const cambiarAsignacionFarmacia = async ({ ayuntamientoId, farmaciaId, origenEsperado, retirar = false }) => {
  const client = await pool.connect();
  const rechazar = async (estadoHttp, error) => {
    await client.query('ROLLBACK');
    return { estadoHttp, datos: { error } };
  };
  try {
    // La consulta de actividad necesita un snapshot nuevo después de esperar el lock.
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    if (await bloquearAyuntamiento(client, ayuntamientoId) === null) {
      return await rechazar(404, 'Ayuntamiento no encontrado.');
    }
    // FOR NO KEY UPDATE no bastaría: es compatible con el KEY SHARE de la FK de entrega.
    const farmacia = await bloquearFarmacia(client, farmaciaId);
    if (farmacia === null) return await rechazar(404, 'Farmacia no encontrada.');
    if (retirar) {
      if (farmacia.ayuntamiento_id !== ayuntamientoId) {
        return await rechazar(404, 'La farmacia no está asociada al Ayuntamiento indicado.');
      }
    } else {
      if (farmacia.ayuntamiento_id === ayuntamientoId) {
        return await rechazar(409, 'La farmacia ya está asociada a este Ayuntamiento.');
      }
      if (farmacia.ayuntamiento_id !== origenEsperado) {
        return await rechazar(409, 'La asignación de origen ha cambiado. Consulta la farmacia de nuevo antes de continuar.');
      }
    }
    const actividad = await consultarActividad(client, farmaciaId);
    if (actividad.tiene_entregas || actividad.tiene_precintos) {
      return await rechazar(409, 'No se puede cambiar ni quitar la asignación: la farmacia tiene entregas o precintos registrados.');
    }
    await actualizarAsignacion(client, farmaciaId, retirar ? null : ayuntamientoId);
    const datos = retirar ? undefined : await consultarAsignacionVisible(client, farmaciaId);
    await client.query('COMMIT');
    return { estadoHttp: retirar ? 204 : 200, datos };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
