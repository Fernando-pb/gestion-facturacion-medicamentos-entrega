import { cuentaBancariaTest } from './fixtures/datos-test.js';
import { randomInt, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import pool from '../src/db.js';

const TEST_DATABASE = 'gestion_facturacion_medicamentos_test';
const esquemaSql = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');

const esperarRestriccion = async (client, sql, valores, constraint, codigo = '23505') => {
  await client.query('SAVEPOINT comprobacion_facturacion');
  let error;
  try {
    await client.query(sql, valores);
  } catch (e) {
    error = e;
  }
  expect(error?.code).toBe(codigo);
  expect(error?.constraint).toBe(constraint);
  await client.query('ROLLBACK TO SAVEPOINT comprobacion_facturacion');
  await client.query('RELEASE SAVEPOINT comprobacion_facturacion');
};

beforeAll(async () => {
  if (process.env.DB_NAME !== TEST_DATABASE) {
    throw new Error(`Estas pruebas requieren DB_NAME=${TEST_DATABASE}.`);
  }
  expect((await pool.query('SELECT current_database() AS nombre;')).rows[0].nombre)
    .toBe(TEST_DATABASE);
});
afterAll(async () => pool.end());

describe('esquema físico de facturación municipal', () => {
  it('relaciona participación y pago y aplica unicidad dentro de cada serie', async () => {
    const client = await pool.connect();
    const schema = `test_facturacion_${randomUUID().replaceAll('-', '')}`;
    try {
      await client.query('BEGIN');
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET LOCAL search_path TO ${schema}`);
      await client.query(esquemaSql);

      const token = randomUUID();
      const ayuntamiento = (await client.query(`
        INSERT INTO ayuntamiento
          (cif, denominacion, direccion, codigo_postal, localidad, provincia, estado, tipo_lista_medicamentos)
        VALUES ($1, 'Ayuntamiento ficticio', 'Calle', '28001', 'Villa', 'Madrid', 'ACTIVO', 'GENERAL')
        RETURNING id;
      `, [`TEST-FACT-${token}`])).rows[0];
      const farmaciaIds = [];
      for (const n of [1, 2]) {
        farmaciaIds.push((await client.query(`
          INSERT INTO farmacia
            (soe, cif_nif, denominacion, direccion, codigo_postal, localidad, provincia, ayuntamiento_id)
          VALUES ($1, 'TEST-CIF-0001', 'Farmacia ficticia', 'Calle', '28001', 'Villa', 'Madrid', $2)
          RETURNING id;
        `, [`TEST-FACT-${token}-${n}`, ayuntamiento.id])).rows[0].id);
      }
      const periodos = [];
      for (const anio of [randomInt(100000, 900000), randomInt(1000000, 2000000)]) {
        periodos.push((await client.query('INSERT INTO periodo (mes, anio) VALUES (1, $1) RETURNING id;', [anio])).rows[0].id);
      }
      const entregas = [];
      for (let i = 0; i < 2; i += 1) {
        entregas.push((await client.query(`
          INSERT INTO entrega_farmacia_periodo
            (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia)
          VALUES ($1, $2, 'Farmacia ficticia snapshot A', 'TEST-CIF-0008') RETURNING id;
        `, [farmaciaIds[i], periodos[0]])).rows[0].id);
      }
      const entregaSinParticipacion = (await client.query(`
        INSERT INTO entrega_farmacia_periodo
          (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia)
        VALUES ($1, $2, 'Farmacia ficticia segundo periodo', 'TEST-CIF-0008') RETURNING id;
      `, [farmaciaIds[0], periodos[1]])).rows[0].id;
      const facturaciones = [];
      for (const periodoId of periodos) {
        facturaciones.push((await client.query(`
          INSERT INTO facturacion (ayuntamiento_id, periodo_id, tipo_facturacion, fecha_factura)
          VALUES ($1, $2, 'TD', CURRENT_DATE) RETURNING id;
        `, [ayuntamiento.id, periodoId])).rows[0].id);
      }
      const configuracion = (await client.query(`
        INSERT INTO configuracion_facturacion (porcentaje_comision, porcentaje_iva, fecha_inicio)
        VALUES (2.7, 21, CURRENT_DATE) RETURNING id;
      `)).rows[0].id;

      const facturaPrecintos = `INSERT INTO factura
        (facturacion_id, tipo, numero_factura, numero_precintos, importe_total)
        VALUES ($1, 'PRECINTOS', $2, 3, 30.00);`;
      const facturaComision = `INSERT INTO factura
        (facturacion_id, tipo, numero_factura, importe_total, base_calculo, porcentaje_comision,
         importe_comision, porcentaje_iva, importe_iva, configuracion_facturacion_id)
        VALUES ($1, 'COMISION', $2, 0.98, 30.00, 2.7, 0.81, 21, 0.17, $3);`;
      await client.query(facturaPrecintos, [facturaciones[0], 'OF-001']);
      await client.query(facturaComision, [facturaciones[0], 'OF-001', configuracion]);
      await esperarRestriccion(client, facturaPrecintos, [facturaciones[1], 'OF-001'], 'uq_factura_tipo_numero_factura');

      const crearParticipacion = `INSERT INTO participacion_facturacion
        (facturacion_id, entrega_id, soe_b, denominacion_b, cif_b, importe_precintos)
        VALUES ($1, $2, 'SOE-B', 'Titular TEST B', 'TEST-CIF-0010', 30.00) RETURNING id;`;
      const participacion = (await client.query(crearParticipacion, [facturaciones[0], entregas[0]])).rows[0].id;
      const participacionDos = (await client.query(crearParticipacion, [facturaciones[0], entregas[1]])).rows[0].id;
      await esperarRestriccion(client, crearParticipacion, [facturaciones[1], entregas[0]], 'uq_participacion_facturacion_entrega');
      await esperarRestriccion(client, crearParticipacion, [2147483647, entregaSinParticipacion],
        'fk_participacion_facturacion_facturacion', '23503');

      const pago = (await client.query(`
        INSERT INTO pago_farmacias (facturacion_id, fecha_pago) VALUES ($1, CURRENT_DATE) RETURNING id;
      `, [facturaciones[0]])).rows[0].id;
      // Este caso SQL comprueba relaciones/unicidad, no los controles bancarios del servicio.
      const cuentaTest = cuentaBancariaTest().cuenta_bancaria;
      const detalle = `INSERT INTO detalle_pago_farmacia
        (pago_farmacias_id, participacion_facturacion_id, soe, denominacion_farmacia, cif_nif,
         importe, pais_control_iban, entidad_bancaria, sucursal_bancaria, digito_control_bancario, cuenta_bancaria)
        VALUES ($1, $2, $3, 'Titular TEST C', 'TEST-CIF-0015', 30.00, 'ES00', 'Entidad', 'Sucursal', '00', $4);`;
      await client.query(detalle, [pago, participacion, 'SOE-C-1', cuentaTest]);
      await client.query(detalle, [pago, participacionDos, 'SOE-C-2', cuentaTest]);
      await esperarRestriccion(client, detalle, [pago, participacion, 'SOE-DUPLICADO', cuentaTest], 'uq_detalle_pago_farmacia_participacion');

      const datos = await client.query(`
        SELECT p.soe_b, p.denominacion_b, p.cif_b, p.importe_precintos::text AS importe,
          d.soe, d.denominacion_farmacia, d.cif_nif, d.cuenta_bancaria
        FROM participacion_facturacion p
        JOIN detalle_pago_farmacia d ON d.participacion_facturacion_id = p.id
        WHERE p.id = $1;
      `, [participacion]);
      expect(datos.rows[0]).toMatchObject({ soe_b: 'SOE-B', denominacion_b: 'Titular TEST B', cif_b: 'TEST-CIF-0010', importe: '30.00',
        soe: 'SOE-C-1', denominacion_farmacia: 'Titular TEST C', cif_nif: 'TEST-CIF-0015', cuenta_bancaria: cuentaBancariaTest().cuenta_bancaria });
      await client.query('ROLLBACK');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
});
