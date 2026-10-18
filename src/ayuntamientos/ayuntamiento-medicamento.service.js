import pool from '../db.js';
import {
  bloquearAyuntamiento, bloquearMedicamento, consultarAsociacion, crearAsociacion, eliminarAsociacion,
} from './ayuntamiento-medicamento.repository.js';

export const cambiarAsociacionMedicamento = async ({ ayuntamientoId, medicamentoId, retirar = false }) => {
  const client = await pool.connect();
  const rechazar = async (estadoHttp, error) => {
    await client.query('ROLLBACK');
    return { estadoHttp, datos: { error } };
  };
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    // Proteger existencia de los maestros sin impedir otras asociaciones simultáneas.
    if (await bloquearAyuntamiento(client, ayuntamientoId) === null) {
      return await rechazar(404, 'Ayuntamiento no encontrado.');
    }
    if (await bloquearMedicamento(client, medicamentoId) === null) {
      return await rechazar(404, 'Medicamento no encontrado.');
    }
    if (retirar) {
      const eliminado = await eliminarAsociacion(client, ayuntamientoId, medicamentoId);
      if (eliminado === null) return await rechazar(404, 'El medicamento no está asociado al Ayuntamiento indicado.');
      await client.query('COMMIT');
      return { estadoHttp: 204 };
    }
    // UNIQUE decide también tras esperar un INSERT concurrente de la misma pareja.
    const relacion = await crearAsociacion(client, ayuntamientoId, medicamentoId);
    if (relacion === null) return await rechazar(409, 'El medicamento ya está asociado a este Ayuntamiento.');
    const datos = await consultarAsociacion(client, relacion.id);
    await client.query('COMMIT');
    return { estadoHttp: 201, datos };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
