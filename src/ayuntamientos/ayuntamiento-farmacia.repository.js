import { construirPatronLiteral } from '../busqueda.js';
import pool from '../db.js';

// Proyección compartida por consultas y mutaciones municipales. No expone datos bancarios completos.
const seleccionFarmaciaVisible = `
  SELECT farmacia.id AS farmacia_id, farmacia.soe, farmacia.denominacion, farmacia.localidad,
    farmacia.ayuntamiento_id, ayuntamiento.denominacion AS ayuntamiento_denominacion,
    CASE
      WHEN farmacia.cuenta_bancaria IS NULL THEN NULL
      WHEN length(regexp_replace(farmacia.cuenta_bancaria, '[^0-9]', '', 'g')) > 4
        THEN '•••• ' || right(regexp_replace(farmacia.cuenta_bancaria, '[^0-9]', '', 'g'), 4)
      ELSE '••••'
    END AS cuenta_bancaria_enmascarada
  FROM farmacia
  LEFT JOIN ayuntamiento ON ayuntamiento.id = farmacia.ayuntamiento_id
`;

export const bloquearAyuntamiento = async (client, id) => {
  const resultado = await client.query('SELECT id FROM ayuntamiento WHERE id = $1 FOR KEY SHARE;', [id]);
  return resultado.rows[0] ?? null;
};

export const bloquearFarmacia = async (client, id) => {
  const resultado = await client.query(
    'SELECT id, ayuntamiento_id FROM farmacia WHERE id = $1 FOR UPDATE;', [id],
  );
  return resultado.rows[0] ?? null;
};

export const consultarActividad = async (client, farmaciaId) => {
  const resultado = await client.query(`
    SELECT
      EXISTS (SELECT 1 FROM entrega_farmacia_periodo WHERE farmacia_id = $1) AS tiene_entregas,
      EXISTS (
        SELECT 1 FROM precinto
        JOIN entrega_farmacia_periodo ON entrega_farmacia_periodo.id = precinto.entrega_id
        WHERE entrega_farmacia_periodo.farmacia_id = $1
      ) AS tiene_precintos;
  `, [farmaciaId]);
  return resultado.rows[0];
};

export const actualizarAsignacion = async (client, farmaciaId, ayuntamientoId) => {
  await client.query('UPDATE farmacia SET ayuntamiento_id = $1 WHERE id = $2;', [ayuntamientoId, farmaciaId]);
};

export const consultarAsignacionVisible = async (client, farmaciaId) => {
  const resultado = await client.query(`
    ${seleccionFarmaciaVisible}
    WHERE farmacia.id = $1;
  `, [farmaciaId]);
  return resultado.rows[0];
};

export const listarFarmaciasAsociadas = async (ayuntamientoId) => {
  const resultado = await pool.query(`
    ${seleccionFarmaciaVisible}
    WHERE farmacia.ayuntamiento_id = $1
    ORDER BY farmacia.id ASC;
  `, [ayuntamientoId]);
  return resultado.rows;
};

export const buscarFarmaciasExistentes = async ({ campo, modo, q }) => {
  // Identificadores SQL escogidos solo de constantes internas, nunca de texto del usuario.
  const columnas = { soe: 'farmacia.soe', denominacion: 'farmacia.denominacion' };
  const columna = columnas[campo];
  const patron = construirPatronLiteral(q, modo);
  const resultado = await pool.query(`
    ${seleccionFarmaciaVisible}
    WHERE ${columna} ILIKE $1 ESCAPE '!'
    ORDER BY ${columna} ASC, farmacia.id ASC;
  `, [patron]);
  return resultado.rows;
};
