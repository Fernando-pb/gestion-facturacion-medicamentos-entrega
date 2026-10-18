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
  const schema = `test_lecturas_${randomUUID().replaceAll('-', '')}`;
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

describe('003 operación de lectura sin backfill', () => {
  it('el esquema inicial crea la definición vigente verificada por 004', async () => {
    await conEsquemaPropio(async (client, sql, entrega, schema) => {
      // El esquema inicial vigente incorpora 004; 003 se prueba como versión histórica.
      sql = (await readFile(new URL('../db/updates/004-claves-retiradas.sql', import.meta.url), 'utf8'))
        .replace(/^BEGIN;\r?\n/m, '').replace(/^COMMIT;\r?$/m, '')
        .replaceAll('public.', `${schema}.`).replaceAll("'public'", `'${schema}'`);
      await client.query(sql);
      expect((await client.query('SELECT * FROM operacion_lectura')).rows).toEqual([]);
    }, true);
  });
  it('migra datos anteriores intactos y verifica una aplicación repetida', async () => {
    await conEsquemaPropio(async (client, sql, entrega) => {
      const antes = (await client.query('SELECT * FROM precinto; SELECT * FROM incidencia;')).map((r) => r.rows);
      await client.query(sql);
      await client.query(sql);
      expect((await client.query('SELECT * FROM entrega_farmacia_periodo')).rows).toEqual([entrega]);
      expect((await client.query('SELECT * FROM precinto; SELECT * FROM incidencia;')).map((r) => r.rows)).toEqual(antes);
      expect((await client.query('SELECT * FROM operacion_lectura')).rows).toEqual([]);
    });
  });

  it.each(['columnas', 'restricciones'])('aborta y revierte ante %s incompatibles', async (caso) => {
    await conEsquemaPropio(async (client, sql) => {
      await client.query(sql);
      if (caso === 'columnas') await client.query('ALTER TABLE operacion_lectura ADD COLUMN inesperada TEXT');
      else await client.query('ALTER TABLE operacion_lectura DROP CONSTRAINT ck_operacion_lectura_destino');
      await client.query('SAVEPOINT migracion_incompatible');
      await expect(client.query(sql)).rejects.toThrow(/incompatibles/);
      await client.query('ROLLBACK TO SAVEPOINT migracion_incompatible');
      expect((await client.query('SELECT count(*)::int AS n FROM precinto')).rows[0].n).toBe(1);
    });
  });

  it('protege unicidad, pertenencia, exactamente una lectura y elimina el recibo con ella', async () => {
    await conEsquemaPropio(async (client, sql) => {
      await client.query(sql);
      const clave = randomUUID();
      const insertar = 'INSERT INTO operacion_lectura (entrega_id,clave,solicitud,precinto_id,incidencia_id) VALUES ($1,$2,$3,$4,$5)';
      const rechazar = async (valores, codigo) => {
        await client.query('SAVEPOINT restriccion');
        await expect(client.query(insertar, valores)).rejects.toMatchObject({ code: codigo });
        await client.query('ROLLBACK TO SAVEPOINT restriccion');
      };
      await rechazar([1, clave, {}, null, null], '23514');
      await rechazar([1, clave, {}, 1, 1], '23514');
      await rechazar([1, clave, '[]', 1, null], '23514');
      await rechazar([1, clave, {}, 2147483647, null], '23503');
      await client.query(`INSERT INTO periodo (mes,anio) VALUES (11,2026);
        INSERT INTO entrega_farmacia_periodo (farmacia_id,periodo_id,denominacion_farmacia,cif_nif_farmacia)
        VALUES (1,2,'Farmacia','TEST-CIF-0001');`);
      await rechazar([2, clave, {}, 1, null], '23503');
      await client.query(insertar, [1, clave, {}, 1, null]);
      await rechazar([1, clave, {}, null, 1], '23505');
      await rechazar([1, randomUUID(), {}, 1, null], '23505');
      await client.query('DELETE FROM precinto WHERE id = 1');
      expect((await client.query('SELECT * FROM operacion_lectura')).rows).toEqual([]);
      await client.query(insertar, [1, clave, {}, null, 1]);
      await client.query('DELETE FROM incidencia WHERE id = 1');
      expect((await client.query('SELECT * FROM operacion_lectura')).rows).toEqual([]);
    });
  });
});
