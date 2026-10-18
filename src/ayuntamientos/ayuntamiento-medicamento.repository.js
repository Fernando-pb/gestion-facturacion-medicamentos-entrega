import pool from '../db.js';

// Los estados y la modalidad son datos actuales, no un histórico de autorización.
const seleccionAsociacion = `
  SELECT relacion.id, relacion.ayuntamiento_id, relacion.medicamento_id,
    medicamento.codigo_nacional, medicamento.descripcion,
    medicamento.estado, medicamento.situacion_comercial,
    ayuntamiento.tipo_lista_medicamentos,
    (ayuntamiento.tipo_lista_medicamentos = 'ESPECIFICA') AS lista_especifica_aplicable,
    CASE WHEN ayuntamiento.tipo_lista_medicamentos = 'GENERAL'
      THEN 'No se aplica mientras se utiliza la lista general' ELSE NULL END AS aviso
  FROM ayuntamiento_medicamento AS relacion
  JOIN medicamento ON medicamento.id = relacion.medicamento_id
  JOIN ayuntamiento ON ayuntamiento.id = relacion.ayuntamiento_id
`;
export const listarMedicamentosAsociados = async (ayuntamientoId) => {
  const resultado = await pool.query(`${seleccionAsociacion}
    WHERE relacion.ayuntamiento_id = $1 ORDER BY relacion.id ASC;`, [ayuntamientoId]);
  return resultado.rows;
};
export const bloquearAyuntamiento = async (client, id) => {
  const resultado = await client.query('SELECT id FROM ayuntamiento WHERE id = $1 FOR KEY SHARE;', [id]);
  return resultado.rows[0] ?? null;
};
export const bloquearMedicamento = async (client, id) => {
  const resultado = await client.query('SELECT id FROM medicamento WHERE id = $1 FOR KEY SHARE;', [id]);
  return resultado.rows[0] ?? null;
};
export const crearAsociacion = async (client, ayuntamientoId, medicamentoId) => {
  const resultado = await client.query(`
    INSERT INTO ayuntamiento_medicamento (ayuntamiento_id, medicamento_id) VALUES ($1, $2)
    ON CONFLICT ON CONSTRAINT uq_ayuntamiento_medicamento DO NOTHING RETURNING id;`,
  [ayuntamientoId, medicamentoId]);
  return resultado.rows[0] ?? null;
};
export const consultarAsociacion = async (client, id) => {
  const resultado = await client.query(`${seleccionAsociacion} WHERE relacion.id = $1;`, [id]);
  return resultado.rows[0];
};
export const eliminarAsociacion = async (client, ayuntamientoId, medicamentoId) => {
  const resultado = await client.query(`
    DELETE FROM ayuntamiento_medicamento WHERE ayuntamiento_id = $1 AND medicamento_id = $2
    RETURNING id;`, [ayuntamientoId, medicamentoId]);
  return resultado.rows[0] ?? null;
};
