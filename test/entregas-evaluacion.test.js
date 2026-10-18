import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import pool from '../src/db.js';

const tablas = ['incidencia', 'precinto', 'facturacion', 'entrega_farmacia_periodo',
  'ayuntamiento_medicamento', 'medicamento', 'periodo', 'farmacia', 'ayuntamiento'];
let ids;
let baseVerificada = false;
const insertar = async (tabla, sql, valores) => {
  const fila = (await pool.query(sql, valores)).rows[0];
  ids[tabla].push(fila.id);
  return fila;
};
const preparar = async (modalidad = 'GENERAL') => {
  const ayuntamiento = await insertar('ayuntamiento', `INSERT INTO ayuntamiento
    (cif, denominacion, direccion, codigo_postal, localidad, provincia, estado, tipo_lista_medicamentos)
    VALUES ($1, 'Municipio ficticio evaluación', 'Calle', '28001', 'Villa', 'Madrid', 'ACTIVO', $2)
    RETURNING *;`, [`TEST-EVALUACION-${randomUUID()}`, modalidad]);
  const farmacia = await insertar('farmacia', `INSERT INTO farmacia
    (soe, cif_nif, denominacion, direccion, codigo_postal, localidad, provincia, ayuntamiento_id, cuenta_bancaria)
    VALUES ($1, 'TEST-CIF-0001', 'Farmacia ficticia evaluación', 'Calle', '28001', 'Villa', 'Madrid', $2, '1234567890')
    RETURNING *;`, [`TEST-EVALUACION-${randomUUID()}`, ayuntamiento.id]);
  const periodo = await insertar('periodo', 'INSERT INTO periodo (mes, anio) VALUES (10, $1) RETURNING *;',
    [randomInt(100000, 2000000000)]);
  const entrega = await insertar('entrega_farmacia_periodo', `INSERT INTO entrega_farmacia_periodo
    (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia, precintos_informados, importe_informado)
    VALUES ($1, $2, $3, $4, 7, 15.25) RETURNING *;`,
  [farmacia.id, periodo.id, farmacia.denominacion, farmacia.cif_nif]);
  return { ayuntamiento, farmacia, periodo, entrega };
};
const medicamento = async (estado = 'ACTIVO', situacion = 'ALTA') => {
  // Códigos válidos con ceros iniciales; no reutilizar un código ajeno existente.
  for (;;) {
    const codigo = randomInt(0, 100000).toString().padStart(6, '0');
    const resultado = await pool.query(`INSERT INTO medicamento
      (codigo_nacional, descripcion, precio, estado, situacion_comercial, tipo_facturacion)
      VALUES ($1, $2, 12.34, $3, $4, 'TD') ON CONFLICT (codigo_nacional) DO NOTHING RETURNING *;`,
    [codigo, `TEST-EVALUACION-${randomUUID()}`, estado, situacion]);
    if (resultado.rows.length) {
      ids.medicamento.push(resultado.rows[0].id);
      return resultado.rows[0];
    }
  }
};
const asociar = (town, med) => insertar('ayuntamiento_medicamento', `INSERT INTO ayuntamiento_medicamento
  (ayuntamiento_id, medicamento_id) VALUES ($1, $2) RETURNING *;`, [town.id, med.id]);
const evaluar = (id, codigo) => request(app).post(`/entregas/${id}/evaluacion`)
  .send({ codigo_barras_original: codigo });
const datosMed = (med) => ({ id: med.id, descripcion: med.descripcion, precio: med.precio,
  estado: med.estado, situacion_comercial: med.situacion_comercial, tipo_facturacion: med.tipo_facturacion });
const contenidoEntrega = async (id) => {
  const entrega = (await pool.query('SELECT * FROM entrega_farmacia_periodo WHERE id = $1;', [id])).rows;
  const precintos = (await pool.query('SELECT * FROM precinto WHERE entrega_id = $1 ORDER BY id;', [id])).rows;
  const incidencias = (await pool.query('SELECT * FROM incidencia WHERE entrega_id = $1 ORDER BY id;', [id])).rows;
  return { entrega, precintos, incidencias };
};

beforeAll(async () => {
  if (process.env.DB_NAME !== 'gestion_facturacion_medicamentos_test'
    || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST ?? 'localhost')) {
    throw new Error('Estas pruebas requieren la base dedicada local gestion_facturacion_medicamentos_test.');
  }
  const nombre = (await pool.query('SELECT current_database() AS nombre;')).rows[0].nombre;
  expect(nombre).toBe('gestion_facturacion_medicamentos_test');
  baseVerificada = true;
});
beforeEach(() => { ids = Object.fromEntries(tablas.map((tabla) => [tabla, []])); });
afterEach(async () => {
  if (!baseVerificada) return;
  // También recoge un registro inesperado del endpoint, siempre dentro de entregas propias.
  for (const tabla of ['incidencia', 'precinto']) {
    await pool.query(`DELETE FROM ${tabla} WHERE entrega_id = ANY($1::int[]);`, [ids.entrega_farmacia_periodo]);
  }
  for (const tabla of tablas) {
    await pool.query(`DELETE FROM ${tabla} WHERE id = ANY($1::int[]);`, [ids[tabla]]);
  }
});
afterAll(async () => pool.end());

describe('evaluación informativa de códigos en Entregas', () => {
  it('evalúa barras y manual, conserva ceros y expone solo los datos mínimos con precio decimal', async () => {
    const { entrega } = await preparar();
    const med = await medicamento();
    for (const codigo of [`847000${med.codigo_nacional}9`, med.codigo_nacional]) {
      const respuesta = await evaluar(entrega.id, codigo);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({ codigo_barras_original: codigo, codigo_nacional: med.codigo_nacional,
        resultado: 'ADMITIDO', medicamento: datosMed(med) });
      expect(respuesta.body.medicamento.precio).toBe('12.34');
      expect(JSON.stringify(respuesta.body)).not.toMatch(/cuenta_bancaria|cif_nif|farmacia_id|ayuntamiento_id/);
    }
  });

  it('devuelve 404 para una entrega inexistente', async () => {
    expect((await evaluar(2147483647, '677291')).status).toBe(404);
  });

  it.each(['0', '-1', '1.5', 'abc', '2147483648'])('rechaza identificador inválido %s', async (id) => {
    expect((await evaluar(id, '677291')).status).toBe(400);
  });

  it.each([{}, null, [], { codigo_barras_original: 677291 }, { codigo_barras_original: null },
    { codigo_barras_original: '677291', otro: true }, { codigo_barras_original: '' },
    { codigo_barras_original: 'ABCDEF' }, { codigo_barras_original: '677291 ' },
    { codigo_barras_original: '67 7291' }, { codigo_barras_original: '67729' },
    { codigo_barras_original: '9470006772911' }, { codigo_barras_original: '8470006772911\n' },
  ])('rechaza cuerpo o formato inválido %j', async (body) => {
    expect((await request(app).post('/entregas/1/evaluacion').send(body)).status).toBe(400);
  });

  it('devuelve medicamento null para desconocido, incluso en lista específica vacía', async () => {
    const { entrega } = await preparar('ESPECIFICA');
    const med = await medicamento();
    await pool.query('DELETE FROM medicamento WHERE id = $1;', [med.id]);
    const antes = await contenidoEntrega(entrega.id);
    const respuesta = await evaluar(entrega.id, med.codigo_nacional);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ codigo_barras_original: med.codigo_nacional,
      codigo_nacional: med.codigo_nacional, resultado: 'INCIDENCIA',
      motivo: 'MEDICAMENTO_DESCONOCIDO', medicamento: null });
    expect(await contenidoEntrega(entrega.id)).toEqual(antes);
  });

  it.each(['ALTA', 'BAJA'])('INACTIVO en %s tiene prioridad ante falta de autorización y decisión', async (situacion) => {
    const { entrega } = await preparar('ESPECIFICA');
    const med = await medicamento('INACTIVO', situacion);
    const respuesta = await evaluar(entrega.id, med.codigo_nacional);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ resultado: 'INCIDENCIA', motivo: 'MEDICAMENTO_INACTIVO',
      medicamento: datosMed(med) });
  });

  it('GENERAL ignora asociaciones conservadas y su retirada', async () => {
    const { entrega, ayuntamiento } = await preparar();
    const med = await medicamento();
    const asociacion = await asociar(ayuntamiento, med);
    const conLista = await evaluar(entrega.id, med.codigo_nacional);
    await pool.query('DELETE FROM ayuntamiento_medicamento WHERE id = $1;', [asociacion.id]);
    const sinLista = await evaluar(entrega.id, med.codigo_nacional);
    expect(conLista.status).toBe(200);
    expect(sinLista.status).toBe(200);
    expect(conLista.body.resultado).toBe('ADMITIDO');
    expect(sinLista.body).toEqual(conLista.body);
  });

  it.each(['ALTA', 'BAJA'])('ESPECIFICA aplica pertenencia antes de resolver %s', async (situacion) => {
    const { entrega, ayuntamiento } = await preparar('ESPECIFICA');
    const med = await medicamento('ACTIVO', situacion);
    const sinLista = await evaluar(entrega.id, med.codigo_nacional);
    expect(sinLista.status).toBe(200);
    expect(sinLista.body).toMatchObject({ resultado: 'INCIDENCIA', motivo: 'MEDICAMENTO_NO_AUTORIZADO' });
    await asociar(ayuntamiento, med);
    const conLista = await evaluar(entrega.id, med.codigo_nacional);
    expect(conLista.status).toBe(200);
    expect(conLista.body.resultado).toBe(situacion === 'ALTA' ? 'ADMITIDO' : 'PENDIENTE_DECISION_BAJA');
    expect(conLista.body).not.toHaveProperty('motivo');
  });

  it('GENERAL autorizado BAJA requiere decisión', async () => {
    const { entrega } = await preparar();
    const med = await medicamento('ACTIVO', 'BAJA');
    const antes = await contenidoEntrega(entrega.id);
    const respuesta = await evaluar(entrega.id, med.codigo_nacional);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.resultado).toBe('PENDIENTE_DECISION_BAJA');
    expect(await contenidoEntrega(entrega.id)).toEqual(antes);
  });

  it('la pertenencia en otro Ayuntamiento no autoriza la entrega', async () => {
    const origen = await preparar('ESPECIFICA');
    const otro = await preparar('ESPECIFICA');
    const med = await medicamento();
    await asociar(otro.ayuntamiento, med);
    expect((await evaluar(origen.entrega.id, med.codigo_nacional)).body.motivo)
      .toBe('MEDICAMENTO_NO_AUTORIZADO');
  });

  it('puede consultar con facturación y repetir sin alterar entregas, precintos ni incidencias', async () => {
    const { entrega, ayuntamiento, periodo, farmacia } = await preparar();
    const med = await medicamento();
    await insertar('facturacion', `INSERT INTO facturacion
      (ayuntamiento_id, periodo_id, tipo_facturacion, fecha_factura, estado) VALUES ($1, $2, 'TD', CURRENT_DATE, 'EMITIDA')
      RETURNING *;`, [ayuntamiento.id, periodo.id]);
    await insertar('precinto', `INSERT INTO precinto
      (entrega_id, numero_paquete, posicion_paquete, codigo_barras_original, codigo_nacional, medicamento_id, precio_aplicado, precio_referencia)
      VALUES ($1, 1, 1, $2, $2, $3, 5.67, 5.67) RETURNING *;`, [entrega.id, med.codigo_nacional, med.id]);
    await insertar('incidencia', `INSERT INTO incidencia (entrega_id, codigo_barras_original, motivo)
      VALUES ($1, '000000', 'MEDICAMENTO_DESCONOCIDO') RETURNING *;`, [entrega.id]);
    const antes = await contenidoEntrega(entrega.id);
    for (const estado of ['ACTIVO', 'INACTIVO']) {
      await pool.query('UPDATE medicamento SET estado = $1 WHERE id = $2;', [estado, med.id]);
      const primera = await evaluar(entrega.id, med.codigo_nacional);
      const segunda = await evaluar(entrega.id, med.codigo_nacional);
      expect(primera.status).toBe(200);
      expect(segunda.status).toBe(200);
      expect(segunda.body).toEqual(primera.body);
      expect(primera.body.resultado).toBe(estado === 'ACTIVO' ? 'ADMITIDO' : 'INCIDENCIA');
      expect(await contenidoEntrega(entrega.id)).toEqual(antes);
    }
    expect((await pool.query('SELECT id FROM entrega_farmacia_periodo WHERE farmacia_id = $1;', [farmacia.id])).rows)
      .toEqual([{ id: entrega.id }]);
  });

  it('una evaluación nueva refleja cambios de catálogo y modalidad, sin reservar precio', async () => {
    const { entrega, ayuntamiento } = await preparar();
    const med = await medicamento();
    expect((await evaluar(entrega.id, med.codigo_nacional)).body.medicamento.precio).toBe('12.34');
    await pool.query("UPDATE medicamento SET precio = 99.87, descripcion = 'Descripción nueva', situacion_comercial = 'BAJA' WHERE id = $1;", [med.id]);
    const nueva = await evaluar(entrega.id, med.codigo_nacional);
    expect(nueva.status).toBe(200);
    expect(nueva.body).toMatchObject({ resultado: 'PENDIENTE_DECISION_BAJA',
      medicamento: { precio: '99.87', descripcion: 'Descripción nueva', situacion_comercial: 'BAJA' } });
    await pool.query("UPDATE ayuntamiento SET tipo_lista_medicamentos = 'ESPECIFICA' WHERE id = $1;", [ayuntamiento.id]);
    expect((await evaluar(entrega.id, med.codigo_nacional)).body.motivo).toBe('MEDICAMENTO_NO_AUTORIZADO');
  });

  it('no confunde una entrega existente sin asignación municipal con una inexistente', async () => {
    const { entrega, farmacia } = await preparar();
    await pool.query('UPDATE farmacia SET ayuntamiento_id = NULL WHERE id = $1;', [farmacia.id]);
    expect((await evaluar(entrega.id, '677291')).status).toBe(409);
  });
});
