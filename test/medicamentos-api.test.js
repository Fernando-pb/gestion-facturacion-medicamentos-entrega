import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import pool from '../src/db.js';

const TEST_DATABASE = 'gestion_facturacion_medicamentos_test';
const opcionales = ['grupo_terapeutico', 'codigo_laboratorio', 'gtatc', 'nombre_grupo', 'anexo'];
let idsCreados;
let precintoIds;
let entregaIds;
let periodoIds;
let farmaciaIds;
let ayuntamientoIds;

const crearDatosMedicamento = (cambios = {}) => ({
  codigo_nacional: `TEST-${randomUUID()}`,
  descripcion: 'Medicamento ficticio',
  precio: '123.45',
  estado: 'ACTIVO',
  situacion_comercial: 'ALTA',
  tipo_facturacion: 'TD',
  ...Object.fromEntries(opcionales.map((campo) => [campo, null])),
  ...cambios,
});

const crearPorApi = async (datos = crearDatosMedicamento()) => {
  const respuesta = await request(app).post('/medicamentos').send(datos);
  if (Number.isInteger(respuesta.body?.id)) idsCreados.add(respuesta.body.id);
  return respuesta;
};

beforeAll(async () => {
  if (!process.env.DB_NAME?.endsWith('_test')) {
    throw new Error('Pruebas detenidas: DB_NAME debe terminar en _test.');
  }
  const resultado = await pool.query('SELECT current_database() AS nombre;');
  if (resultado.rows[0]?.nombre !== TEST_DATABASE) {
    throw new Error(`Pruebas detenidas: la base activa no es ${TEST_DATABASE}.`);
  }
});

beforeEach(() => {
  idsCreados = new Set();
  precintoIds = new Set();
  entregaIds = new Set();
  periodoIds = new Set();
  farmaciaIds = new Set();
  ayuntamientoIds = new Set();
});

afterEach(async () => {
  try {
    for (const id of precintoIds) await pool.query('DELETE FROM precinto WHERE id = $1;', [id]);
    for (const id of entregaIds) await pool.query('DELETE FROM entrega_farmacia_periodo WHERE id = $1;', [id]);
    for (const id of periodoIds) await pool.query('DELETE FROM periodo WHERE id = $1;', [id]);
    for (const id of farmaciaIds) await pool.query('DELETE FROM farmacia WHERE id = $1;', [id]);
    for (const id of ayuntamientoIds) await pool.query('DELETE FROM ayuntamiento WHERE id = $1;', [id]);
    for (const id of idsCreados) await pool.query('DELETE FROM medicamento WHERE id = $1;', [id]);
  } finally {
    idsCreados.clear();
    precintoIds.clear();
    entregaIds.clear();
    periodoIds.clear();
    farmaciaIds.clear();
    ayuntamientoIds.clear();
  }
});

afterAll(async () => pool.end());

describe('API de Medicamentos', () => {
  it('crea el medicamento y devuelve id, opcionales null y precio como cadena', async () => {
    const datos = crearDatosMedicamento({ codigo_nacional: `  00${randomUUID()}  `, descripcion: '  Medicamento  ' });
    const respuesta = await crearPorApi(datos);
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({
      ...datos,
      id: expect.any(Number),
      codigo_nacional: datos.codigo_nacional.trim(),
      descripcion: 'Medicamento',
      precio: '123.45',
    });
    expect(typeof respuesta.body.precio).toBe('string');
  });

  it.each(['codigo_nacional', 'descripcion', 'precio', 'estado', 'situacion_comercial', 'tipo_facturacion'])(
    'rechaza POST sin %s', async (campo) => {
      const datos = crearDatosMedicamento();
      delete datos[campo];
      expect((await crearPorApi(datos)).status).toBe(400);
    },
  );

  it('rechaza POST con campos desconocidos, precio inválido o enums con otra capitalización', async () => {
    expect((await crearPorApi({ ...crearDatosMedicamento(), id: 5 })).status).toBe(400);
    expect((await crearPorApi(crearDatosMedicamento({ precio: '1.239' }))).status).toBe(400);
    expect((await crearPorApi(crearDatosMedicamento({ estado: 'activo' }))).status).toBe(400);
    expect((await crearPorApi(crearDatosMedicamento({ situacion_comercial: 'BAJA', tipo_facturacion: 'TD ' }))).status).toBe(201);
  });

  it('responde 400 en JSON si el cuerpo no se puede analizar', async () => {
    const respuesta = await request(app)
      .post('/medicamentos')
      .set('Content-Type', 'application/json')
      .send('{"codigo_nacional":');
    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({ error: expect.any(String) });
  });

  it('recorta opcionales y convierte texto vacío a null', async () => {
    const respuesta = await crearPorApi(crearDatosMedicamento({
      grupo_terapeutico: ' Grupo ', codigo_laboratorio: '  ', anexo: '',
    }));
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.grupo_terapeutico).toBe('Grupo');
    expect(respuesta.body.codigo_laboratorio).toBeNull();
    expect(respuesta.body.anexo).toBeNull();
  });

  it('devuelve 409 por codigo_nacional duplicado', async () => {
    const datos = crearDatosMedicamento();
    expect((await crearPorApi(datos)).status).toBe(201);
    const duplicado = await crearPorApi({ ...datos });
    expect(duplicado.status).toBe(409);
    expect(duplicado.body).toEqual({ error: expect.any(String) });
  });

  it('lista medicamentos por id ascendente y devuelve [] cuando no hay registros de prueba propios', async () => {
    const primero = await crearPorApi();
    const segundo = await crearPorApi();
    expect(primero.status).toBe(201);
    expect(segundo.status).toBe(201);
    const listado = await request(app).get('/medicamentos');
    expect(listado.status).toBe(200);
    expect(Array.isArray(listado.body)).toBe(true);
    const idsPropios = listado.body.filter((item) => idsCreados.has(item.id)).map((item) => item.id);
    expect(idsPropios).toEqual([...idsPropios].sort((a, b) => a - b));
  });

  it('consulta por id y distingue identificador inválido e inexistente', async () => {
    const creado = await crearPorApi();
    expect((await request(app).get(`/medicamentos/${creado.body.id}`)).body).toEqual(creado.body);
    expect((await request(app).get('/medicamentos/no-id')).status).toBe(400);
    const inexistente = await request(app).get('/medicamentos/2147483647');
    expect(inexistente.status).toBe(404);
    expect(inexistente.body).toEqual({ error: expect.any(String) });
  });

  it('reemplaza todos los campos, permite cambiar codigo_nacional y conserva independiente ambos estados', async () => {
    const creado = await crearPorApi();
    const actualizado = crearDatosMedicamento({
      codigo_nacional: `NUEVO-${randomUUID()}`,
      descripcion: 'Descripción actualizada',
      precio: '0.5',
      estado: 'INACTIVO',
      situacion_comercial: 'BAJA',
      anexo: ' Anexo A ',
    });
    const respuesta = await request(app).put(`/medicamentos/${creado.body.id}`).send(actualizado);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.id).toBe(creado.body.id);
    expect(respuesta.body.codigo_nacional).toBe(actualizado.codigo_nacional);
    expect(respuesta.body.estado).toBe('INACTIVO');
    expect(respuesta.body.situacion_comercial).toBe('BAJA');
    expect(respuesta.body.precio).toBe('0.50');
    expect(respuesta.body.anexo).toBe('Anexo A');
    expect((await request(app).get(`/medicamentos/${creado.body.id}`)).body).toEqual(respuesta.body);
  });

  it.each(opcionales)('exige el campo opcional %s en PUT', async (campo) => {
    const creado = await crearPorApi();
    const datos = crearDatosMedicamento();
    delete datos[campo];
    expect((await request(app).put(`/medicamentos/${creado.body.id}`).send(datos)).status).toBe(400);
  });

  it('devuelve 400 y 404 para los IDs de PUT inválido e inexistente', async () => {
    const datos = crearDatosMedicamento();
    expect((await request(app).put('/medicamentos/invalid').send(datos)).status).toBe(400);
    expect((await request(app).put('/medicamentos/2147483647').send(datos)).status).toBe(404);
  });

  it('devuelve 409 al cambiar a un codigo_nacional ya utilizado y conserva el registro', async () => {
    const primero = await crearPorApi();
    const segundo = await crearPorApi();
    const datos = crearDatosMedicamento({ codigo_nacional: primero.body.codigo_nacional });
    const respuesta = await request(app).put(`/medicamentos/${segundo.body.id}`).send(datos);
    expect(respuesta.status).toBe(409);
    expect((await request(app).get(`/medicamentos/${segundo.body.id}`)).body.codigo_nacional)
      .toBe(segundo.body.codigo_nacional);
  });

  it('no cambia precio_aplicado de un precinto al editar el precio actual del medicamento', async () => {
    const creado = await crearPorApi();
    const town = await pool.query(`
      INSERT INTO ayuntamiento (
        cif, denominacion, direccion, codigo_postal, localidad, provincia,
        estado, tipo_lista_medicamentos
      ) VALUES ($1, 'Ayuntamiento de prueba', 'Calle 1', '28001', 'Villa', 'Provincia', 'ACTIVO', 'GENERAL')
      RETURNING id;
    `, [`TEST-${randomUUID()}`]);
    const townId = town.rows[0].id;
    ayuntamientoIds.add(townId);

    const pharmacy = await pool.query(`
      INSERT INTO farmacia (
        soe, cif_nif, denominacion, direccion, codigo_postal, localidad,
        provincia, ayuntamiento_id
      ) VALUES ($1, 'TEST-CIF-0009', 'Farmacia de prueba', 'Calle 2', '28002', 'Villa', 'Provincia', $2)
      RETURNING id;
    `, [`TEST-${randomUUID()}`, townId]);
    const pharmacyId = pharmacy.rows[0].id;
    farmaciaIds.add(pharmacyId);

    const period = await pool.query(`
      INSERT INTO periodo (mes, anio) VALUES (1, $1) RETURNING id;
    `, [10000 + Math.floor(Math.random() * 1000000000)]);
    const periodId = period.rows[0].id;
    periodoIds.add(periodId);

    const delivery = await pool.query(`
      INSERT INTO entrega_farmacia_periodo (
        farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia
      ) VALUES ($1, $2, 'Farmacia de prueba', 'TEST-CIF-0009') RETURNING id;
    `, [pharmacyId, periodId]);
    const deliveryId = delivery.rows[0].id;
    entregaIds.add(deliveryId);

    const precioHistorico = creado.body.precio;
    const seal = await pool.query(`
      INSERT INTO precinto (
        entrega_id, numero_paquete, posicion_paquete, codigo_barras_original,
        codigo_nacional, medicamento_id, precio_aplicado, precio_referencia
      ) VALUES ($1, 1, 1, 'LECTURA-PRUEBA', $2, $3, $4, $4) RETURNING id;
    `, [deliveryId, creado.body.codigo_nacional, creado.body.id, precioHistorico]);
    precintoIds.add(seal.rows[0].id);

    const updated = await request(app).put(`/medicamentos/${creado.body.id}`)
      .send(crearDatosMedicamento({ precio: '456.78' }));
    expect(updated.status).toBe(200);
    expect(updated.body.precio).toBe('456.78');
    const snapshot = await pool.query(
      'SELECT precio_aplicado::text AS precio FROM precinto WHERE id = $1;',
      [seal.rows[0].id],
    );
    expect(snapshot.rows[0].precio).toBe(precioHistorico);
  });

  it('no expone métodos PATCH o DELETE', async () => {
    const creado = await crearPorApi();
    expect((await request(app).patch(`/medicamentos/${creado.body.id}`).send({})).status).toBe(404);
    expect((await request(app).delete(`/medicamentos/${creado.body.id}`)).status).toBe(404);
  });

  it('confirma en PostgreSQL NOT NULL, ausencia de default y CHECKs del esquema aprobado', async () => {
    const columna = await pool.query(`
      SELECT is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'medicamento'
        AND column_name = 'situacion_comercial';
    `);
    expect(columna.rows).toEqual([{ is_nullable: 'NO', column_default: null }]);

    const base = crearDatosMedicamento();
    const insertar = (situacion) => pool.query(`
      INSERT INTO medicamento (
        codigo_nacional, descripcion, precio, estado, situacion_comercial,
        tipo_facturacion
      ) VALUES ($1, $2, $3, $4, ${situacion}, $5);
    `, [base.codigo_nacional, base.descripcion, base.precio, base.estado, base.tipo_facturacion]);
    await expect(insertar("'OTRA'")).rejects.toMatchObject({ code: '23514' });
    await expect(insertar('NULL')).rejects.toMatchObject({ code: '23502' });
    await expect(pool.query(`
      INSERT INTO medicamento (codigo_nacional, descripcion, precio, estado, tipo_facturacion)
      VALUES ($1, $2, $3, $4, $5);
    `, [base.codigo_nacional, base.descripcion, base.precio, base.estado, base.tipo_facturacion]))
      .rejects.toMatchObject({ code: '23502' });
  });
});
