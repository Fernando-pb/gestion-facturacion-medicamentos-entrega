import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pool from '../src/db.js';

beforeAll(async () => {
  if (process.env.DB_NAME !== 'gestion_facturacion_medicamentos_test'
    || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST ?? 'localhost')) throw new Error('Base dedicada local obligatoria.');
  expect((await pool.query('SELECT current_database() AS db')).rows[0].db).toBe('gestion_facturacion_medicamentos_test');
});
afterAll(() => pool.end());
const conEsquema = async (prueba, inicial = false) => {
  const client = await pool.connect(), schema = 'test_precio_' + randomUUID().replaceAll('-', '');
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema}, public;`);
    await client.query(inicial ? await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')
      : 'CREATE TABLE precinto (id INTEGER PRIMARY KEY, precio_aplicado NUMERIC(12,2) NOT NULL); INSERT INTO precinto VALUES (1,1.23),(2,0.00);');
    const sql = (await readFile(new URL('../db/updates/005-precio-referencia.sql', import.meta.url), 'utf8'))
      .replace(/^BEGIN;\r?\n/m, '').replace(/^COMMIT;\r?$/m, '')
      .replaceAll('public.', `${schema}.`).replaceAll("'public'", `'${schema}'`);
    await prueba(client, sql);
  } finally { await client.query('ROLLBACK'); client.release(); }
};
describe('005 referencia conservada al migrar', () => {
  it('cubre todas las lecturas sin modificar aplicado y la repetición no reemplaza la referencia tras corregir', async () => {
    await conEsquema(async (c, sql) => {
      await c.query(sql);
      expect((await c.query('SELECT * FROM precinto ORDER BY id')).rows).toEqual([
        { id: 1, precio_aplicado: '1.23', precio_referencia: '1.23' }, { id: 2, precio_aplicado: '0.00', precio_referencia: '0.00' }]);
      await c.query('UPDATE precinto SET precio_aplicado=9.99 WHERE id=1'); await c.query(sql);
      expect((await c.query('SELECT * FROM precinto WHERE id=1')).rows[0]).toEqual({ id: 1, precio_aplicado: '9.99', precio_referencia: '1.23' });
      await c.query('SAVEPOINT entrada');
      await expect(c.query('INSERT INTO precinto (id,precio_aplicado) VALUES (3,1)')).rejects.toMatchObject({ code: '23502' });
      await c.query('ROLLBACK TO SAVEPOINT entrada');
      await expect(c.query('UPDATE precinto SET precio_referencia=-1 WHERE id=1')).rejects.toMatchObject({ code: '23514' });
      await c.query('ROLLBACK TO SAVEPOINT entrada');
    });
  });
  it('completa solo los nulos de una adaptación parcial y conserva referencias existentes distintas del aplicado', async () => {
    await conEsquema(async (c, sql) => {
      await c.query('ALTER TABLE precinto ADD COLUMN precio_referencia NUMERIC(12,2); UPDATE precinto SET precio_referencia=4.56 WHERE id=1;');
      await c.query(sql);
      expect((await c.query('SELECT precio_referencia FROM precinto ORDER BY id')).rows).toEqual([{ precio_referencia: '4.56' }, { precio_referencia: '0.00' }]);
    });
  });
  it.each(['tipo', 'check', 'negativo'])('rechaza y revierte incompatibilidad de %s', async (caso) => {
    await conEsquema(async (c, sql) => {
      await c.query(`ALTER TABLE precinto ADD COLUMN precio_referencia ${caso === 'tipo' ? 'TEXT' : 'NUMERIC(12,2)'}`);
      if (caso === 'check') await c.query('ALTER TABLE precinto ADD CONSTRAINT ck_precinto_precio_referencia CHECK (precio_referencia > 0)');
      if (caso === 'negativo') await c.query('UPDATE precinto SET precio_referencia=-1 WHERE id=1');
      const antes = (await c.query('SELECT * FROM precinto ORDER BY id')).rows;
      await c.query('SAVEPOINT incompatible'); await expect(c.query(sql)).rejects.toThrow();
      await c.query('ROLLBACK TO SAVEPOINT incompatible');
      expect((await c.query('SELECT * FROM precinto ORDER BY id')).rows).toEqual(antes);
    });
  });
  it('verifica sin cambios el esquema de una instalación nueva', async () => {
    await conEsquema(async (c, sql) => { await c.query(sql); await c.query(sql); }, true);
  });
});
