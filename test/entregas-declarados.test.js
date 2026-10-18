import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import pool from '../src/db.js';

let ids;
const tablas = ['reapertura_facturacion', 'facturacion', 'medicamento', 'periodo', 'farmacia', 'ayuntamiento'];
const insertar = async (tabla, sql, valores = [], client = pool) => {
  const row = (await client.query(sql, valores)).rows[0];
  ids[tabla].push(row.id);
  return row;
};
const municipio = () => insertar('ayuntamiento', `INSERT INTO ayuntamiento
  (cif, denominacion, direccion, codigo_postal, localidad, provincia, estado, tipo_lista_medicamentos)
  VALUES ($1, 'Ayuntamiento prueba declarados', 'Calle', '28001', 'Villa', 'Madrid', 'ACTIVO', 'GENERAL')
  RETURNING *;`, [`TEST-DECLARADOS-${randomUUID()}`]);
const farmacia = (town) => insertar('farmacia', `INSERT INTO farmacia
  (soe, cif_nif, denominacion, direccion, codigo_postal, localidad, provincia, ayuntamiento_id)
  VALUES ($1, 'TEST-CIF-0001', 'Farmacia prueba declarados', 'Calle', '28001', 'Villa', 'Madrid', $2)
  RETURNING *;`, [`TEST-DECLARADOS-${randomUUID()}`, town]);
const periodo = () => insertar('periodo', 'INSERT INTO periodo (mes, anio) VALUES (9, $1) RETURNING *;',
  [randomInt(100000, 2000000000)]);
const facturar = (town, mes, client = pool) => insertar('facturacion', `INSERT INTO facturacion
  (ayuntamiento_id, periodo_id, tipo_facturacion, fecha_factura, estado)
  VALUES ($1, $2, 'TD', '2026-09-30', 'EMITIDA') RETURNING *;`, [town, mes], client);
const crear = (body) => request(app).post('/entregas').send(body);
const consultar = (body) => request(app).get('/entregas').query(body);
const editar = (id, datos = { precintos_informados: 7, importe_informado: '12.34' }) =>
  request(app).put(`/entregas/${id}/declarados`).send(datos);
const preparar = async (conEntrega = true) => {
  const town = await municipio();
  const farm = await farmacia(town.id);
  const mes = await periodo();
  const body = { farmacia_id: farm.id, periodo_id: mes.id };
  const entrega = conEntrega ? await crear(body) : null;
  if (conEntrega) expect(entrega.status).toBe(201);
  return { town, farm, mes, body, entrega: entrega?.body };
};
const leerEntrega = async (id) => (await pool.query('SELECT * FROM entrega_farmacia_periodo WHERE id = $1;', [id])).rows[0];
const esperarBloqueo = async (pid) => {
  let bloqueado;
  await vi.waitFor(async () => {
    const filas = (await pool.query('SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid));', [pid])).rows;
    expect(filas.length).toBeGreaterThan(0);
    bloqueado = filas[0].pid;
  }, { timeout: 4000, interval: 20 });
  return bloqueado;
};

beforeAll(async () => {
  if (process.env.DB_NAME !== 'gestion_facturacion_medicamentos_test') throw new Error('Se requiere la base dedicada de pruebas.');
  if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST ?? 'localhost')) throw new Error('Se requiere PostgreSQL local.');
  expect((await pool.query('SELECT current_database() AS nombre;')).rows[0].nombre)
    .toBe('gestion_facturacion_medicamentos_test');
});
beforeEach(() => { ids = Object.fromEntries(tablas.map((tabla) => [tabla, []])); });
afterEach(async () => {
  for (const tabla of ['incidencia', 'precinto']) {
    await pool.query(`DELETE FROM ${tabla} WHERE entrega_id IN (
      SELECT id FROM entrega_farmacia_periodo WHERE farmacia_id = ANY($1::int[])
    );`, [ids.farmacia]);
  }
  await pool.query('DELETE FROM entrega_farmacia_periodo WHERE farmacia_id = ANY($1::int[]);', [ids.farmacia]);
  for (const tabla of tablas) {
    for (const id of ids[tabla]) await pool.query(`DELETE FROM ${tabla} WHERE id = $1;`, [id]);
  }
});
afterAll(async () => pool.end());

describe('declarados y criterio provisional de facturación', () => {
  it.each([
    { precintos_informados: 9, importe_informado: '123.45' },
    { precintos_informados: 0, importe_informado: '0' },
    { precintos_informados: null, importe_informado: null },
    { precintos_informados: 2147483647, importe_informado: '9999999999.99' },
    { precintos_informados: null, importe_informado: ' 00012.3 ' },
    { precintos_informados: 0, importe_informado: null },
  ])('reemplaza ambos declarados, incluidos NULL y cero: %j', async (datos) => {
    const { entrega } = await preparar();
    const respuesta = await editar(entrega.id, datos);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.precintos_informados).toBe(datos.precintos_informados);
    const importe = datos.importe_informado === null ? null : Number(datos.importe_informado).toFixed(2);
    expect(respuesta.body.importe_informado).toBe(importe);
    expect(await leerEntrega(entrega.id)).toEqual({
      id: entrega.id, farmacia_id: entrega.farmacia_id, periodo_id: entrega.periodo_id,
      denominacion_farmacia: entrega.denominacion_farmacia, cif_nif_farmacia: entrega.cif_nif_farmacia,
      precintos_informados: datos.precintos_informados, importe_informado: importe,
    });
  });

  it.each([
    {}, { precintos_informados: 1 }, { importe_informado: '1' },
    { precintos_informados: -1, importe_informado: '1' },
    { precintos_informados: 1.1, importe_informado: '1' },
    { precintos_informados: 2147483648, importe_informado: '1' },
    { precintos_informados: '1', importe_informado: '1' },
    { precintos_informados: true, importe_informado: '1' },
    ...['-1', '10000000000', '1.234', '1,23', '1e2', '', ' ', 'Infinity'].map((importe_informado) =>
      ({ precintos_informados: 1, importe_informado })),
    { precintos_informados: 1, importe_informado: 1 },
    ...['id', 'farmacia_id', 'periodo_id', 'denominacion_farmacia', 'cif_nif_farmacia', 'ayuntamiento_id']
      .map((campo) => ({ precintos_informados: 1, importe_informado: '1', [campo]: 1 })),
  ])('rechaza omisiones, valores inválidos y propiedades no editables: %j', async (datos) => {
    const { entrega } = await preparar();
    const antes = await leerEntrega(entrega.id);
    expect((await editar(entrega.id, datos)).status).toBe(400);
    expect(await leerEntrega(entrega.id)).toEqual(antes);
  });

  it.each(['0', '-1', '1.5', 'no', '2147483648'])('rechaza identificador %s', async (id) => {
    expect((await editar(id)).status).toBe(400);
  });
  it('devuelve 404 para entrega inexistente', async () => {
    expect((await editar(2147483647)).status).toBe(404);
  });

  it('conserva identidad, snapshots, precintos, incidencias y precio aplicado', async () => {
    const { farm, entrega } = await preparar();
    const medicamento = await insertar('medicamento', `INSERT INTO medicamento
      (codigo_nacional, descripcion, precio, estado, situacion_comercial, tipo_facturacion)
      VALUES ($1, 'Medicamento ficticio', 9.99, 'ACTIVO', 'ALTA', 'TD') RETURNING *;`, [`TEST-DECLARADOS-${randomUUID()}`]);
    const precinto = (await pool.query(`INSERT INTO precinto
      (entrega_id, numero_paquete, posicion_paquete, codigo_barras_original, codigo_nacional, medicamento_id, precio_aplicado, precio_referencia)
      VALUES ($1, 1, 1, 'FICTICIO', $2, $3, 2.34, 2.34) RETURNING *;`, [entrega.id, medicamento.codigo_nacional, medicamento.id])).rows[0];
    const incidencia = (await pool.query(`INSERT INTO incidencia (entrega_id, codigo_barras_original, motivo)
      VALUES ($1, 'FICTICIO', 'MEDICAMENTO_DESCONOCIDO') RETURNING *;`, [entrega.id])).rows[0];
    const antes = await leerEntrega(entrega.id);
    await pool.query("UPDATE farmacia SET denominacion = 'Nombre nuevo', cif_nif = 'TEST-CIF-0014' WHERE id = $1;", [farm.id]);
    expect((await editar(entrega.id)).status).toBe(200);
    expect(await leerEntrega(entrega.id)).toEqual({ ...antes, precintos_informados: 7, importe_informado: '12.34' });
    expect((await pool.query('SELECT * FROM precinto WHERE id = $1;', [precinto.id])).rows[0]).toEqual(precinto);
    expect((await pool.query('SELECT * FROM incidencia WHERE id = $1;', [incidencia.id])).rows[0]).toEqual(incidencia);
    expect((await pool.query('SELECT * FROM medicamento WHERE id = $1;', [medicamento.id])).rows[0]).toEqual(medicamento);
  });

  it.each([false, true])('facturación bloquea escritura, incluso con reapertura histórica=%s; consultas disponibles', async (reabrir) => {
    const { town, farm, mes, body, entrega } = await preparar();
    const otraFarmacia = await farmacia(town.id);
    const antes = await leerEntrega(entrega.id);
    const facturacion = await facturar(town.id, mes.id);
    if (reabrir) await insertar('reapertura_facturacion', `INSERT INTO reapertura_facturacion
      (facturacion_id, motivo) VALUES ($1, 'Reapertura ficticia histórica') RETURNING *;`, [facturacion.id]);
    for (const respuesta of [await editar(entrega.id), await crear({ farmacia_id: otraFarmacia.id, periodo_id: mes.id })]) {
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error).toMatch(/existe facturación/i);
    }
    expect(await leerEntrega(entrega.id)).toEqual(antes);
    expect((await crear(body)).body).toEqual(entrega);
    expect((await crear(body)).status).toBe(200);
    expect((await consultar(body)).body).toEqual(entrega);
    expect((await consultar(body)).status).toBe(200);
    expect((await pool.query('SELECT count(*)::int AS n FROM entrega_farmacia_periodo WHERE farmacia_id = $1;', [otraFarmacia.id])).rows[0].n).toBe(0);
    expect((await pool.query('SELECT ayuntamiento_id FROM farmacia WHERE id = $1;', [farm.id])).rows[0].ayuntamiento_id).toBe(town.id);
  });

  it.each(['ayuntamiento', 'periodo'])('facturación de otro %s no bloquea', async (otro) => {
    const { town, mes, entrega } = await preparar();
    const destino = otro === 'ayuntamiento' ? await municipio() : town;
    const periodoFactura = otro === 'periodo' ? await periodo() : mes;
    await facturar(destino.id, periodoFactura.id);
    expect((await editar(entrega.id)).status).toBe(200);
    const farm = await farmacia(town.id);
    expect((await crear({ farmacia_id: farm.id, periodo_id: mes.id })).status).toBe(201);
  });
});

describe('cierre simulado con protocolo común de Ayuntamiento', () => {
  it.each(['crear', 'editar'])('si el cierre obtiene primero el bloqueo, rechaza %s después del commit', async (operacion) => {
    const { town, farm, mes, body, entrega } = await preparar(operacion === 'editar');
    const antes = entrega ? await leerEntrega(entrega.id) : null;
    const client = await pool.connect();
    let pendiente;
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const pid = (await client.query('SELECT pg_backend_pid() AS pid;')).rows[0].pid;
      await client.query('SELECT id FROM ayuntamiento WHERE id = $1 FOR UPDATE;', [town.id]);
      // Solo fixture: representa la existencia que la regla provisional bloquea.
      await facturar(town.id, mes.id, client);
      pendiente = (operacion === 'crear' ? crear(body) : editar(entrega.id)).then((r) => r);
      await esperarBloqueo(pid);
      await client.query('COMMIT');
      expect((await pendiente).status).toBe(409);
      if (entrega) expect(await leerEntrega(entrega.id)).toEqual(antes);
      else expect((await pool.query('SELECT count(*)::int AS n FROM entrega_farmacia_periodo WHERE farmacia_id = $1;', [farm.id])).rows[0].n).toBe(0);
    } finally {
      await client.query('ROLLBACK');
      if (pendiente) await pendiente;
      client.release();
    }
  }, 10000);

  it.each(['crear', 'editar'])('si %s obtiene primero el bloqueo, el cierre espera y ve la escritura confirmada', async (operacion) => {
    const { town, mes, body, entrega } = await preparar(operacion === 'editar');
    const barrera = await pool.connect();
    const cierre = await pool.connect();
    let escritura;
    let cierrePendiente;
    try {
      await barrera.query('BEGIN');
      const pidBarrera = (await barrera.query('SELECT pg_backend_pid() AS pid;')).rows[0].pid;
      if (entrega) await barrera.query('SELECT id FROM entrega_farmacia_periodo WHERE id = $1 FOR UPDATE;', [entrega.id]);
      else await barrera.query('SELECT id FROM periodo WHERE id = $1 FOR UPDATE;', [mes.id]);
      escritura = (operacion === 'crear' ? crear(body) : editar(entrega.id)).then((r) => r);
      const pidEscritura = await esperarBloqueo(pidBarrera);
      await cierre.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      cierrePendiente = cierre.query('SELECT id FROM ayuntamiento WHERE id = $1 FOR UPDATE;', [town.id]);
      await esperarBloqueo(pidEscritura);
      await barrera.query('COMMIT');
      const respuesta = await escritura;
      expect(respuesta.status).toBe(operacion === 'crear' ? 201 : 200);
      await cierrePendiente;
      // Lectura posterior al bloqueo, como deberá hacer el futuro cierre.
      const vista = (await cierre.query(`SELECT id, precintos_informados, importe_informado
        FROM entrega_farmacia_periodo WHERE farmacia_id = $1 AND periodo_id = $2;`,
      [body.farmacia_id, body.periodo_id])).rows[0];
      expect(vista).toEqual({ id: respuesta.body.id,
        precintos_informados: respuesta.body.precintos_informados, importe_informado: respuesta.body.importe_informado });
      await facturar(town.id, mes.id, cierre);
      await cierre.query('COMMIT');
      expect((await editar(respuesta.body.id)).status).toBe(409);
      const otraFarmacia = await farmacia(town.id);
      expect((await crear({ farmacia_id: otraFarmacia.id, periodo_id: mes.id })).status).toBe(409);
      expect((await crear(body)).status).toBe(200);
      expect((await consultar(body)).status).toBe(200);
    } finally {
      await barrera.query('ROLLBACK');
      if (escritura) await escritura;
      if (cierrePendiente) await cierrePendiente;
      await cierre.query('ROLLBACK');
      barrera.release();
      cierre.release();
    }
  }, 10000);
});
