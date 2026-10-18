import { randomInt, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pool from '../src/db.js';

const esperarRestriccion = async (client, sql, valores, codigo, constraint) => {
  await client.query('SAVEPOINT comprobacion_esquema');
  let error;
  try {
    await client.query(sql, valores);
  } catch (e) {
    error = e;
  }
  expect(error?.code).toBe(codigo);
  if (constraint) expect(error.constraint).toBe(constraint);
  await client.query('ROLLBACK TO SAVEPOINT comprobacion_esquema');
  await client.query('RELEASE SAVEPOINT comprobacion_esquema');
};

beforeAll(async () => {
  if (process.env.DB_NAME !== 'gestion_facturacion_medicamentos_test') {
    throw new Error('Estas pruebas requieren DB_NAME=gestion_facturacion_medicamentos_test.');
  }
  expect((await pool.query('SELECT current_database() AS nombre;')).rows[0].nombre)
    .toBe('gestion_facturacion_medicamentos_test');
});
afterAll(async () => pool.end());

describe('esquema de Entregas y precintos', () => {
  it('protege snapshots, motivos, relaciones, unicidad y checks existentes', async () => {
    const client = await pool.connect();
    const token = randomUUID();
    try {
      await client.query('BEGIN');

      const columnas = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'entrega_farmacia_periodo'
          AND column_name IN ('denominacion_farmacia', 'cif_nif_farmacia')
        ORDER BY column_name;
      `);
      expect(columnas.rows).toEqual([
        { column_name: 'cif_nif_farmacia', data_type: 'text', is_nullable: 'NO', column_default: null },
        { column_name: 'denominacion_farmacia', data_type: 'text', is_nullable: 'NO', column_default: null },
      ]);

      const ayuntamiento = (await client.query(`
        INSERT INTO ayuntamiento
          (cif, denominacion, direccion, codigo_postal, localidad, provincia, estado, tipo_lista_medicamentos)
        VALUES ($1, 'Ayuntamiento de prueba de esquema', 'Calle', '28001', 'Villa', 'Madrid', 'ACTIVO', 'GENERAL')
        RETURNING id;
      `, [`TEST-ESQUEMA-${token}`])).rows[0];
      const farmacia = (await client.query(`
        INSERT INTO farmacia
          (soe, cif_nif, denominacion, direccion, codigo_postal, localidad, provincia, ayuntamiento_id)
        VALUES ($1, 'TEST-CIF-0001', 'Farmacia de prueba de esquema', 'Calle', '28001', 'Villa', 'Madrid', $2)
        RETURNING id;
      `, [`TEST-ESQUEMA-${token}`, ayuntamiento.id])).rows[0];
      const periodo = (await client.query(`
        INSERT INTO periodo (mes, anio) VALUES (1, $1) RETURNING id;
      `, [randomInt(100000, 2000000000)])).rows[0];

      await esperarRestriccion(client, `
        INSERT INTO entrega_farmacia_periodo (farmacia_id, periodo_id)
        VALUES ($1, $2);
      `, [farmacia.id, periodo.id], '23502');

      const entrega = (await client.query(`
        INSERT INTO entrega_farmacia_periodo
          (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia)
        VALUES ($1, $2, 'Farmacia de prueba de esquema', 'TEST-CIF-0001')
        RETURNING id;
      `, [farmacia.id, periodo.id])).rows[0];

      await esperarRestriccion(client, `
        INSERT INTO entrega_farmacia_periodo
          (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia)
        VALUES ($1, $2, 'Duplicada', 'TEST-CIF-0002');
      `, [farmacia.id, periodo.id], '23505', 'uq_entrega_farmacia_periodo');
      await esperarRestriccion(client, `
        INSERT INTO entrega_farmacia_periodo
          (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia)
        VALUES (2147483647, $1, 'FK inválida', 'TEST-CIF-0003');
      `, [periodo.id], '23503', 'fk_entrega_farmacia');
      await esperarRestriccion(client, `
        INSERT INTO entrega_farmacia_periodo
          (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia)
        VALUES ($1, 2147483647, 'FK inválida', 'TEST-CIF-0004');
      `, [farmacia.id], '23503', 'fk_entrega_periodo');
      await esperarRestriccion(client, `
        INSERT INTO entrega_farmacia_periodo
          (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia, precintos_informados)
        VALUES ($1, $2, 'Cantidad negativa', 'TEST-CIF-0005', -1);
      `, [farmacia.id, periodo.id], '23514', 'ck_entrega_precintos_informados');
      await esperarRestriccion(client, `
        INSERT INTO entrega_farmacia_periodo
          (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia, importe_informado)
        VALUES ($1, $2, 'Importe negativo', 'TEST-CIF-0006', -1);
      `, [farmacia.id, periodo.id], '23514', 'ck_entrega_importe_informado');

      for (const motivo of [
        'MEDICAMENTO_DESCONOCIDO',
        'MEDICAMENTO_NO_AUTORIZADO',
        'MEDICAMENTO_INACTIVO',
        'BAJA_COMERCIAL_RECHAZADA_USUARIO',
      ]) {
        await client.query(`
          INSERT INTO incidencia (entrega_id, codigo_barras_original, motivo)
          VALUES ($1, $2, $3);
        `, [entrega.id, `ORIGINAL-${motivo}`, motivo]);
      }
      await esperarRestriccion(client, `
        INSERT INTO incidencia (entrega_id, codigo_barras_original, motivo)
        VALUES ($1, 'ORIGINAL-INVALIDO', 'MOTIVO_NO_APROBADO');
      `, [entrega.id], '23514', 'ck_incidencia_motivo');

      const conteos = await client.query(`
        SELECT
          (SELECT count(*)::int FROM entrega_farmacia_periodo WHERE id = $1) AS entrega,
          (SELECT count(*)::int FROM incidencia WHERE entrega_id = $1) AS incidencias;
      `, [entrega.id]);
      expect(conteos.rows[0]).toEqual({ entrega: 1, incidencias: 4 });
      await client.query('ROLLBACK');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
});
