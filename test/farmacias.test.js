import { randomInt, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import pool from '../src/db.js';

const app = createApp({ authConfig: null });

const TEST_DATABASE = 'gestion_facturacion_medicamentos_test';
const actualizacionSql = await readFile(new URL('../db/updates/001-farmacia-ayuntamiento-opcional.sql', import.meta.url), 'utf8');
let farmaciaIds;
let ayuntamientoIds;

const crearDatosFarmacia = (cambios = {}) => ({
  soe: `TEST-${randomUUID()}`,
  cif_nif: 'TEST-CIF-0009',
  denominacion: 'Farmacia Ficticia',
  direccion: 'Calle Ficticia, 1',
  codigo_postal: '28001',
  localidad: 'Localidad Ficticia',
  provincia: 'Provincia Ficticia',
  telefono: null,
  ayuntamiento_id: undefined,
  pais_control_iban: null,
  entidad_bancaria: null,
  sucursal_bancaria: null,
  digito_control_bancario: null,
  cuenta_bancaria: null,
  ...cambios,
});

const crearAyuntamiento = async () => {
  const resultado = await pool.query(
    `INSERT INTO ayuntamiento (
      cif, denominacion, direccion, codigo_postal, localidad, provincia,
      estado, tipo_lista_medicamentos
    ) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO', 'GENERAL') RETURNING id;`,
    [`TEST-${randomUUID()}`, 'Ayuntamiento Ficticio', 'Calle Ficticia, 1', '28001', 'Localidad Ficticia', 'Provincia Ficticia'],
  );
  const id = resultado.rows[0].id;
  ayuntamientoIds.add(id);
  return id;
};

const crearFarmaciaPorApi = async (data) => {
  const response = await request(app).post('/farmacias').send(data);
  if (Number.isInteger(response.body?.id)) farmaciaIds.add(response.body.id);
  return response;
};

beforeAll(async () => {
  const result = await pool.query('SELECT current_database() AS nombre;');
  if (result.rows[0]?.nombre !== TEST_DATABASE) {
    throw new Error(`Pruebas detenidas: la base activa no es ${TEST_DATABASE}.`);
  }
  // Solo se actualiza la base dedicada, después de comprobar su identidad.
  await pool.query(actualizacionSql);
});

beforeEach(() => {
  farmaciaIds = new Set();
  ayuntamientoIds = new Set();
});

afterEach(async () => {
  try {
    for (const id of farmaciaIds) await pool.query('DELETE FROM farmacia WHERE id = $1;', [id]);
    for (const id of ayuntamientoIds) await pool.query('DELETE FROM ayuntamiento WHERE id = $1;', [id]);
  } finally {
    farmaciaIds.clear();
    ayuntamientoIds.clear();
  }
});

afterAll(async () => pool.end());

describe('API de Farmacias', () => {
  it('conserva filas, FK e índice al repetir la actualización de una base existente', async () => {
    const ayuntamiento_id = await crearAyuntamiento();
    const created = await crearFarmaciaPorApi(crearDatosFarmacia({ ayuntamiento_id }));
    expect(created.status).toBe(201);
    const antes = await pool.query('SELECT * FROM farmacia WHERE id = $1;', [created.body.id]);
    const obtenerProtecciones = () => pool.query(`
      SELECT oid, conname AS nombre FROM pg_constraint
      WHERE conrelid = 'farmacia'::regclass AND conname = 'fk_farmacia_ayuntamiento'
      UNION ALL
      SELECT oid, relname AS nombre FROM pg_class
      WHERE oid = 'ix_farmacia_ayuntamiento_id'::regclass ORDER BY nombre;
    `);
    const protecciones = await obtenerProtecciones();
    expect(protecciones.rows).toHaveLength(2);
    await pool.query(actualizacionSql);
    await pool.query(actualizacionSql);
    expect((await pool.query('SELECT * FROM farmacia WHERE id = $1;', [created.body.id])).rows).toEqual(antes.rows);
    expect((await obtenerProtecciones()).rows).toEqual(protecciones.rows);
    const columna = await pool.query(`SELECT attnotnull FROM pg_attribute
      WHERE attrelid = 'farmacia'::regclass AND attname = 'ayuntamiento_id';`);
    expect(columna.rows[0].attnotnull).toBe(false);
  });

  it('el esquema de instalaciones nuevas acepta NULL y mantiene la FK', async () => {
    const client = await pool.connect();
    const schema = `test_farmacia_${randomUUID().replaceAll('-', '')}`;
    try {
      await client.query('BEGIN');
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET LOCAL search_path TO ${schema}`);
      await client.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
      const insertar = `INSERT INTO farmacia
        (soe, cif_nif, denominacion, direccion, codigo_postal, localidad, provincia, ayuntamiento_id)
        VALUES ('TEST-NUEVA', 'TEST-CIF-0009', 'Farmacia', 'Calle', '28001', 'Villa', 'Madrid', $1)
        RETURNING ayuntamiento_id;`;
      expect((await client.query(insertar, [null])).rows[0].ayuntamiento_id).toBeNull();
      await expect(client.query(insertar.replace('TEST-NUEVA', 'TEST-FK'), [2147483647]))
        .rejects.toMatchObject({ code: '23503', constraint: 'fk_farmacia_ayuntamiento' });
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('lee y edita un maestro sin Ayuntamiento sin excluirlo del listado ni asignarlo', async () => {
    const data = crearDatosFarmacia({ ayuntamiento_id: null });
    const result = await pool.query(`INSERT INTO farmacia
      (soe, cif_nif, denominacion, direccion, codigo_postal, localidad, provincia, ayuntamiento_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NULL) RETURNING id;`,
    [data.soe, data.cif_nif, data.denominacion, data.direccion, data.codigo_postal, data.localidad, data.provincia]);
    const id = result.rows[0].id;
    farmaciaIds.add(id);
    const relacionNula = { id, ayuntamiento_id: null, ayuntamiento_denominacion: null, ayuntamiento_cif: null };
    const detail = await request(app).get(`/farmacias/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject(relacionNula);
    const listado = await request(app).get('/farmacias');
    expect(listado.status).toBe(200);
    expect(listado.body).toEqual(expect.arrayContaining([expect.objectContaining(relacionNula)]));
    const { ayuntamiento_id, ...editable } = data;
    const edited = await request(app).put(`/farmacias/${id}`).send({ ...editable, denominacion: 'Farmacia Sin Asignación Editada' });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ ...relacionNula, denominacion: 'Farmacia Sin Asignación Editada' });
  });

  it('mantiene el Ayuntamiento obligatorio en POST y excluido de PUT, incluido NULL', async () => {
    const data = crearDatosFarmacia({ ayuntamiento_id: null });
    expect((await crearFarmaciaPorApi(data)).status).toBe(400);
    const { ayuntamiento_id, ...sinReferencia } = data;
    expect((await crearFarmaciaPorApi(sinReferencia)).status).toBe(400);
    const town = await crearAyuntamiento();
    const created = await crearFarmaciaPorApi({ ...data, ayuntamiento_id: town });
    expect(created.status).toBe(201);
    expect((await request(app).put(`/farmacias/${created.body.id}`).send(data)).status).toBe(400);
    expect((await request(app).get(`/farmacias/${created.body.id}`)).body.ayuntamiento_id).toBe(town);
  });

  it.each([false, true])('no permite cambiar ni quitar la asignación mediante PUT con entrega (precinto: %s)', async (conPrecinto) => {
    const town = await crearAyuntamiento();
    const otherTown = await crearAyuntamiento();
    const data = crearDatosFarmacia({ ayuntamiento_id: town });
    const created = await crearFarmaciaPorApi(data);
    expect(created.status).toBe(201);
    let periodoId;
    let entregaId;
    let medicamentoId;
    let precintoId;
    try {
      periodoId = (await pool.query('INSERT INTO periodo (mes, anio) VALUES (1, $1) RETURNING id;',
        [randomInt(100000, 2000000000)])).rows[0].id;
      entregaId = (await pool.query(`INSERT INTO entrega_farmacia_periodo
        (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia)
        VALUES ($1, $2, $3, $4) RETURNING id;`, [created.body.id, periodoId, data.denominacion, data.cif_nif])).rows[0].id;
      if (conPrecinto) {
        medicamentoId = (await pool.query(`INSERT INTO medicamento
          (codigo_nacional, descripcion, precio, estado, situacion_comercial, tipo_facturacion)
          VALUES ($1, 'Medicamento Ficticio', 1.25, 'ACTIVO', 'ALTA', 'TD') RETURNING id;`,
        [`TEST-${randomUUID()}`])).rows[0].id;
        precintoId = (await pool.query(`INSERT INTO precinto
          (entrega_id, numero_paquete, posicion_paquete, codigo_barras_original, codigo_nacional, medicamento_id, precio_aplicado, precio_referencia)
          VALUES ($1, 1, 1, 'FICTICIO', 'FICTICIO', $2, 1.25, 1.25) RETURNING id;`,
        [entregaId, medicamentoId])).rows[0].id;
      }
      const { ayuntamiento_id, ...editable } = data;
      for (const destino of [otherTown, null]) {
        const response = await request(app).put(`/farmacias/${created.body.id}`)
          .send({ ...editable, ayuntamiento_id: destino });
        expect(response.status).toBe(400);
      }
      const edited = await request(app).put(`/farmacias/${created.body.id}`)
        .send({ ...editable, denominacion: 'Datos Actuales Corregidos' });
      expect(edited.status).toBe(200);
      expect(edited.body.ayuntamiento_id).toBe(town);
      expect((await pool.query('SELECT farmacia_id FROM entrega_farmacia_periodo WHERE id = $1;', [entregaId]))
        .rows[0].farmacia_id).toBe(created.body.id);
      if (conPrecinto) {
        expect((await pool.query('SELECT entrega_id, precio_aplicado FROM precinto WHERE id = $1;', [precintoId]))
          .rows[0]).toEqual({ entrega_id: entregaId, precio_aplicado: '1.25' });
      }
    } finally {
      if (precintoId) await pool.query('DELETE FROM precinto WHERE id = $1;', [precintoId]);
      if (medicamentoId) await pool.query('DELETE FROM medicamento WHERE id = $1;', [medicamentoId]);
      if (entregaId) await pool.query('DELETE FROM entrega_farmacia_periodo WHERE id = $1;', [entregaId]);
      if (periodoId) await pool.query('DELETE FROM periodo WHERE id = $1;', [periodoId]);
    }
  });

  it('crea y consulta farmacia devolviendo claramente el ayuntamiento', async () => {
    const ayuntamiento_id = await crearAyuntamiento();
    const data = crearDatosFarmacia({ ayuntamiento_id });
    const created = await crearFarmaciaPorApi(data);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      ...data,
      id: expect.any(Number),
      ayuntamiento_denominacion: 'Ayuntamiento Ficticio',
      ayuntamiento_cif: expect.stringMatching(/^TEST-/),
    });

    const detail = await request(app).get(`/farmacias/${created.body.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.ayuntamiento_id).toBe(ayuntamiento_id);
    expect(detail.body.ayuntamiento_denominacion).toBe('Ayuntamiento Ficticio');
  });

  it('lista la farmacia con los datos de su ayuntamiento', async () => {
    const ayuntamiento_id = await crearAyuntamiento();
    const created = await crearFarmaciaPorApi(crearDatosFarmacia({ ayuntamiento_id }));
    const response = await request(app).get('/farmacias');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: created.body.id, ayuntamiento_id, ayuntamiento_denominacion: 'Ayuntamiento Ficticio' }),
    ]));
  });

  it('rechaza la referencia a un ayuntamiento inexistente', async () => {
    const response = await crearFarmaciaPorApi(crearDatosFarmacia({ ayuntamiento_id: 2147483647 }));
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/ayuntamiento/i);
  });

  it('devuelve 409 si el SOE ya pertenece a otra farmacia', async () => {
    const ayuntamiento_id = await crearAyuntamiento();
    const data = crearDatosFarmacia({ ayuntamiento_id });
    expect((await crearFarmaciaPorApi(data)).status).toBe(201);
    const duplicate = await crearFarmaciaPorApi(data);
    expect(duplicate.status).toBe(409);
  });

  it('actualiza datos y mantiene la relación original', async () => {
    const firstTown = await crearAyuntamiento();
    const otherTown = await crearAyuntamiento();
    const created = await crearFarmaciaPorApi(crearDatosFarmacia({ ayuntamiento_id: firstTown }));
    const update = crearDatosFarmacia({
      soe: created.body.soe,
      denominacion: 'Farmacia Modificada',
      cif_nif: created.body.cif_nif,
      direccion: created.body.direccion,
      codigo_postal: created.body.codigo_postal,
      localidad: created.body.localidad,
      provincia: created.body.provincia,
    });
    delete update.ayuntamiento_id;

    const response = await request(app).put(`/farmacias/${created.body.id}`).send(update);
    expect(response.status).toBe(200);
    expect(response.body.denominacion).toBe('Farmacia Modificada');
    expect(response.body.ayuntamiento_id).toBe(firstTown);
    expect(response.body.ayuntamiento_id).not.toBe(otherTown);

    const intentoCambio = await request(app).put(`/farmacias/${created.body.id}`).send({ ...update, ayuntamiento_id: otherTown });
    expect(intentoCambio.status).toBe(400);
    const persisted = await pool.query('SELECT ayuntamiento_id FROM farmacia WHERE id = $1;', [created.body.id]);
    expect(persisted.rows[0].ayuntamiento_id).toBe(firstTown);
  });

  it('distingue IDs inválidos e inexistentes', async () => {
    expect((await request(app).get('/farmacias/no')).status).toBe(400);
    expect((await request(app).get('/farmacias/2147483647')).status).toBe(404);
  });
});
