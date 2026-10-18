import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pool from '../src/db.js';

beforeAll(async () => {
  if (process.env.DB_NAME !== 'gestion_facturacion_medicamentos_test'
    || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST ?? 'localhost')) throw new Error('Base de pruebas local requerida');
  expect((await pool.query('SELECT current_database() AS nombre')).rows[0].nombre).toBe('gestion_facturacion_medicamentos_test');
});
afterAll(async () => pool.end());

const conEsquemaPropio = async (prueba, nuevaInstalacion = false) => {
  const client = await pool.connect();
  const schema = `test_retired_${randomUUID().replaceAll('-', '')}`;
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema}, public;`);
    const inicial = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
    // Simular la versión anterior sin alterar ninguna tabla pública.
    const anterior = inicial.replace(/^    CONSTRAINT uq_(precinto|incidencia)_id_entrega UNIQUE \(id, entrega_id\),\r?\n/gm, '')
      .replace(/-- Recibo técnico[\s\S]*?(?=CREATE TABLE facturacion)/, '');
    await client.query(nuevaInstalacion ? inicial : anterior);
    const entrega = (await client.query(`INSERT INTO ayuntamiento
      (cif, denominacion, direccion, codigo_postal, localidad, provincia, estado, tipo_lista_medicamentos)
      VALUES ('FICTICIO', 'Villa', 'Calle', '28001', 'Villa', 'Madrid', 'ACTIVO', 'GENERAL');
      INSERT INTO farmacia (soe,cif_nif,denominacion,direccion,codigo_postal,localidad,provincia,ayuntamiento_id)
      VALUES ('FICTICIO','TEST-CIF-0001','Farmacia','Calle','28001','Villa','Madrid',1);
      INSERT INTO periodo (mes,anio) VALUES (10,2026);
      INSERT INTO entrega_farmacia_periodo (farmacia_id,periodo_id,denominacion_farmacia,cif_nif_farmacia)
      VALUES (1,1,'Farmacia','TEST-CIF-0001') RETURNING *;`)).at(-1).rows[0];
    await client.query(`INSERT INTO medicamento (codigo_nacional,descripcion,precio,estado,situacion_comercial,tipo_facturacion)
      VALUES ('001234','Ficticio',1.23,'ACTIVO','ALTA','TD');
      INSERT INTO precinto (entrega_id,numero_paquete,posicion_paquete,codigo_barras_original,codigo_nacional,medicamento_id,precio_aplicado, precio_referencia)
      VALUES (1,1,1,'001234','001234',1,1.23, 1.23);
      INSERT INTO incidencia (entrega_id,codigo_barras_original,codigo_nacional,motivo)
      VALUES (1,'009999','009999','MEDICAMENTO_DESCONOCIDO');`);
    const migracion = (await readFile(new URL('../db/updates/003-operacion-lectura.sql', import.meta.url), 'utf8'))
      .replace(/^BEGIN;\r?\n/m, '').replace(/^COMMIT;\r?$/m, '')
      .replaceAll('public.', `${schema}.`).replaceAll("'public'", `'${schema}'`);
    await prueba(client, migracion, entrega, schema);
  } finally { await client.query('ROLLBACK'); client.release(); }
};

const sql004 = async (schema) => (await readFile(new URL('../db/updates/004-claves-retiradas.sql', import.meta.url), 'utf8'))
  .replace(/^BEGIN;\r?\n/m, '').replace(/^COMMIT;\r?$/m, '')
  .replaceAll('public.', `${schema}.`).replaceAll("'public'", `'${schema}'`);

describe('004 clave retirada sin contenido', () => {
  it('preserva recibos existentes, permite retirada/purga y verifica repetición', async () => {
    await conEsquemaPropio(async (client, sql003, entrega, schema) => {
      await client.query(sql003);
      const clave = randomUUID();
      const solicitud = { codigo_barras_original: '001234', decision: null, nuevo_paquete: false };
      await client.query('INSERT INTO operacion_lectura (entrega_id,clave,solicitud,precinto_id) VALUES (1,$1,$2,1)', [clave, solicitud]);
      const antes = (await client.query('SELECT * FROM precinto; SELECT * FROM incidencia')).map((r) => r.rows);
      const sql = await sql004(schema);
      await client.query(sql);
      await client.query(sql);
      expect((await client.query('SELECT * FROM operacion_lectura')).rows[0]).toMatchObject({ clave, solicitud, retirada: false, precinto_id: 1 });
      expect((await client.query('SELECT * FROM precinto; SELECT * FROM incidencia')).map((r) => r.rows)).toEqual(antes);
      await client.query('SAVEPOINT invalida');
      await expect(client.query('UPDATE operacion_lectura SET retirada=TRUE')).rejects.toMatchObject({ code: '23514' });
      await client.query('ROLLBACK TO SAVEPOINT invalida');
      await client.query('UPDATE operacion_lectura SET retirada=TRUE,solicitud=NULL,precinto_id=NULL');
      await client.query('DELETE FROM precinto WHERE id=1');
      expect((await client.query('SELECT * FROM operacion_lectura')).rows).toEqual([{ id: expect.any(Number), entrega_id: 1,
        clave, solicitud: null, retirada: true, precinto_id: null, incidencia_id: null }]);
      await client.query('SAVEPOINT contenido');
      await expect(client.query("UPDATE operacion_lectura SET solicitud='{}'::jsonb")).rejects.toMatchObject({ code: '23514' });
      await client.query('ROLLBACK TO SAVEPOINT contenido');
    });
  });

  it('nueva instalación y actualización tienen la misma definición', async () => {
    await conEsquemaPropio(async (client, sql, entrega, schema) => {
      await client.query(await sql004(schema));
    }, true);
  });

  it('aborta ante definición incompatible sin modificar filas', async () => {
    await conEsquemaPropio(async (client, sql003, entrega, schema) => {
      await client.query(sql003);
      await client.query('ALTER TABLE operacion_lectura DROP CONSTRAINT ck_operacion_lectura_destino');
      await client.query('SAVEPOINT incompatible');
      await expect(client.query(await sql004(schema))).rejects.toThrow(/incompatible/);
      await client.query('ROLLBACK TO SAVEPOINT incompatible');
      expect((await client.query('SELECT count(*)::int AS n FROM precinto')).rows[0].n).toBe(1);
      expect((await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='operacion_lectura' AND column_name='retirada'", [schema])).rows).toEqual([]);
    });
  });

  it.each(['clave', 'columna'])('rechaza una instalación actualizada con %s incompatible', async (caso) => {
    await conEsquemaPropio(async (client, sql003, entrega, schema) => {
      await client.query(sql003);
      const sql = await sql004(schema);
      await client.query(sql);
      await client.query(caso === 'clave' ? 'ALTER TABLE operacion_lectura DROP CONSTRAINT uq_operacion_lectura_clave'
        : 'ALTER TABLE operacion_lectura ADD COLUMN contenido_borrado TEXT');
      await client.query('SAVEPOINT incompatible_actual');
      await expect(client.query(sql)).rejects.toThrow(/incompatible/);
      await client.query('ROLLBACK TO SAVEPOINT incompatible_actual');
    });
  });
});
