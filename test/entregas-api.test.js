import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import pool from '../src/db.js';

let ids, fechas;
const tablas = ['facturacion', 'periodo', 'farmacia', 'ayuntamiento'];
const insertar = async (tabla, sql, valores) => {
  const row = (await pool.query(sql, valores)).rows[0];
  ids[tabla].push(row.id);
  return row;
};
const municipio = () => insertar('ayuntamiento', `INSERT INTO ayuntamiento
  (cif, denominacion, direccion, codigo_postal, localidad, provincia, estado, tipo_lista_medicamentos)
  VALUES ($1, 'Ayuntamiento de prueba entregas', 'Calle', '28001', 'Villa', 'Madrid', 'ACTIVO', 'GENERAL')
  RETURNING *;`, [`TEST-ENTREGA-${randomUUID()}`]);
const farmacia = (town = null) => insertar('farmacia', `INSERT INTO farmacia
  (soe, cif_nif, denominacion, direccion, codigo_postal, localidad, provincia, ayuntamiento_id, cuenta_bancaria)
  VALUES ($1, 'TEST-CIF-0001', 'Farmacia ficticia entregas', 'Calle', '28001', 'Villa', 'Madrid', $2, '1234567890')
  RETURNING *;`, [`TEST-ENTREGA-${randomUUID()}`, town]);
const periodo = () => insertar('periodo', 'INSERT INTO periodo (mes, anio) VALUES (9, $1) RETURNING *;',
  [randomInt(100000, 2000000000)]);
const preparar = async () => {
  const town = await municipio();
  const farm = await farmacia(town.id);
  const mes = await periodo();
  return { town, farm, mes, body: { farmacia_id: farm.id, periodo_id: mes.id } };
};
const crear = (body) => request(app).post('/entregas').send(body);
const recuperar = (body) => request(app).get('/entregas').query(body);
const entregas = async (farmId) => (await pool.query(
  'SELECT * FROM entrega_farmacia_periodo WHERE farmacia_id = $1 ORDER BY id;', [farmId],
)).rows;
const esperarBloqueo = async (pid) => {
  let bloqueado;
  await vi.waitFor(async () => {
    const resultado = await pool.query(
      'SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid));', [pid],
    );
    expect(resultado.rows.length).toBeGreaterThan(0);
    bloqueado = resultado.rows[0].pid;
  }, { timeout: 4000, interval: 20 });
  return bloqueado;
};

beforeAll(async () => {
  if (process.env.DB_NAME !== 'gestion_facturacion_medicamentos_test') {
    throw new Error('Estas pruebas requieren DB_NAME=gestion_facturacion_medicamentos_test.');
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST ?? 'localhost')) {
    throw new Error('Estas pruebas requieren la base dedicada local.');
  }
  expect((await pool.query('SELECT current_database() AS nombre;')).rows[0].nombre)
    .toBe('gestion_facturacion_medicamentos_test');
});
beforeEach(() => { ids = Object.fromEntries(tablas.map((tabla) => [tabla, []])); fechas = []; });
afterEach(async () => {
  // Incluye entregas creadas por la API aunque falle una aserción de respuesta.
  await pool.query('DELETE FROM entrega_farmacia_periodo WHERE farmacia_id = ANY($1::int[]);', [ids.farmacia]);
  for (const tabla of tablas) {
    for (const id of ids[tabla]) await pool.query(`DELETE FROM ${tabla} WHERE id = $1;`, [id]);
  }
  for (const fecha of fechas) await pool.query('DELETE FROM periodo WHERE mes = $1 AND anio = $2;', [fecha.mes, fecha.anio]);
});
afterAll(async () => pool.end());

const fechaNueva = async () => {
  let fecha;
  do { fecha = { mes: 10, anio: randomInt(2000000000, 2147483647) }; }
  while ((await pool.query('SELECT id FROM periodo WHERE mes = $1 AND anio = $2;', [fecha.mes, fecha.anio])).rowCount);
  fechas.push(fecha); return fecha;
};
const periodosFecha = async (fecha) => (await pool.query('SELECT * FROM periodo WHERE mes = $1 AND anio = $2;', [fecha.mes, fecha.anio])).rows;

describe('apertura por mes y año', () => {
  it('búsqueda global reutiliza filtros, conserva SOE textual y devuelve solo información de selección', async () => {
    const farm = await farmacia((await municipio()).id);
    const soe = `000A-${randomUUID()}`;
    await pool.query('UPDATE farmacia SET soe = $1 WHERE id = $2;', [soe, farm.id]);
    const respuesta = await request(app).get('/farmacias/busqueda').query({ campo: 'soe', modo: 'exacto', q: soe });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual([{ id: farm.id, soe, denominacion: farm.denominacion, localidad: farm.localidad,
      ayuntamiento_id: farm.ayuntamiento_id, ayuntamiento_denominacion: 'Ayuntamiento de prueba entregas' }]);
    const nombre = await request(app).get('/farmacias/busqueda').query({ campo: 'denominacion', modo: 'contiene', q: 'ficticia entregas' });
    expect(nombre.status).toBe(200); expect(nombre.body.some((f) => f.id === farm.id)).toBe(true);
    for (const row of nombre.body) expect(Object.keys(row).sort()).toEqual(['ayuntamiento_denominacion', 'ayuntamiento_id', 'denominacion', 'id', 'localidad', 'soe']);
  });
  it.each([{}, { campo: 'soe', modo: 'exacto', q: '' }, { campo: 'otro', modo: 'contiene', q: 'x' },
    { campo: 'soe', modo: 'otro', q: 'x' }, { campo: 'soe', modo: 'exacto', q: 'x', extra: 'x' }])('búsqueda global rechaza %j', async (query) => {
    expect((await request(app).get('/farmacias/busqueda').query(query)).status).toBe(400);
  });
  it('crea periodo y entrega en una transacción y GET consulta sin crear', async () => {
    const farm = await farmacia((await municipio()).id), fecha = await fechaNueva();
    const body = { farmacia_id: farm.id, ...fecha };
    expect((await recuperar(body)).status).toBe(404); expect(await periodosFecha(fecha)).toEqual([]);
    const nueva = await crear(body); expect(nueva.status).toBe(201);
    expect(nueva.body).toMatchObject({ ...fecha, farmacia_id: farm.id });
    expect(await periodosFecha(fecha)).toHaveLength(1);
    expect((await recuperar(body)).body).toEqual(nueva.body);
  });
  it('reutiliza periodo y recupera entrega preservando históricos y declarados', async () => {
    const { farm, mes, body } = await preparar();
    const nueva = await crear(body);
    await pool.query('UPDATE entrega_farmacia_periodo SET precintos_informados = 80, importe_informado = 12.34 WHERE id = $1;', [nueva.body.id]);
    await pool.query("UPDATE farmacia SET denominacion = 'Maestro cambiado' WHERE id = $1;", [farm.id]);
    const respuesta = await crear({ farmacia_id: farm.id, mes: mes.mes, anio: mes.anio });
    expect(respuesta.status).toBe(200); expect(respuesta.body).toEqual({ ...nueva.body, precintos_informados: 80, importe_informado: '12.34' });
    expect(await periodosFecha(mes)).toHaveLength(1);
  });
  it.each([
    { mes: 0, anio: 2026 }, { mes: 13, anio: 2026 }, { mes: 1.5, anio: 2026 }, { mes: '1', anio: 2026 },
    { mes: 1, anio: 0 }, { mes: 1, anio: -1 }, { mes: 1, anio: 1.5 }, { mes: 1, anio: 2147483648 },
    { mes: 1, anio: '2026' }, { mes: 1 }, { anio: 2026 }, { mes: 1, anio: 2026, periodo_id: 1 },
  ])('rechaza fecha inválida o ambigua %j', async (data) => {
    expect((await crear({ farmacia_id: 1, ...data })).status).toBe(400);
  });
  it.each([{ mes: 0, anio: 2026 }, { mes: 1, anio: 0 }, { mes: 1, anio: 2026, periodo_id: 1 }, { mes: 1 }])('GET rechaza fechas inválidas/ambiguas %j', async (data) => {
    expect((await recuperar({ farmacia_id: 1, ...data })).status).toBe(400);
  });
  it.each(['inexistente', 'sin-ayuntamiento'])('farmacia %s no deja periodo nuevo', async (tipo) => {
    const fecha = await fechaNueva(); const id = tipo === 'inexistente' ? 2147483647 : (await farmacia()).id;
    expect((await crear({ farmacia_id: id, ...fecha })).status).toBe(tipo === 'inexistente' ? 404 : 409);
    expect(await periodosFecha(fecha)).toEqual([]);
  });
  it('fallo del INSERT entrega revierte también el periodo', async () => {
    const farm = await farmacia((await municipio()).id), fecha = await fechaNueva();
    const conectar = pool.connect.bind(pool); let consulta;
    const spy = vi.spyOn(pool, 'connect').mockImplementationOnce(async () => {
      const client = await conectar(), query = client.query.bind(client);
      consulta = vi.spyOn(client, 'query').mockImplementation((sql, ...args) => {
        if (typeof sql === 'string' && /INSERT INTO entrega_farmacia_periodo/.test(sql)) return Promise.reject(new Error('Fallo ficticio de INSERT entrega'));
        return query(sql, ...args);
      }); return client;
    });
    try { expect((await crear({ farmacia_id: farm.id, ...fecha })).status).toBe(500); }
    finally { consulta?.mockRestore(); spy.mockRestore(); }
    expect(await periodosFecha(fecha)).toEqual([]); expect(await entregas(farm.id)).toEqual([]);
  });
  it.each(['misma', 'mismo-ayuntamiento', 'distinto-ayuntamiento'])('aperturas concurrentes con farmacia %s comparten un periodo', async (tipo) => {
    const town = await municipio(), primera = await farmacia(town.id), fecha = await fechaNueva();
    const segunda = tipo === 'misma' ? primera : await farmacia(tipo === 'mismo-ayuntamiento' ? town.id : (await municipio()).id);
    const respuestas = await Promise.all([crear({ farmacia_id: primera.id, ...fecha }), crear({ farmacia_id: segunda.id, ...fecha })]);
    expect(respuestas.map((r) => r.status).sort()).toEqual(tipo === 'misma' ? [200, 201] : [201, 201]);
    expect(respuestas[0].body.periodo_id).toBe(respuestas[1].body.periodo_id); expect(await periodosFecha(fecha)).toHaveLength(1);
    expect(await entregas(primera.id)).toHaveLength(1);
  });
  it('facturación bloquea creación por fecha y permite recuperar/consultar una entrega anterior', async () => {
    const { town, farm, mes, body } = await preparar();
    await insertar('facturacion', `INSERT INTO facturacion (ayuntamiento_id, periodo_id, tipo_facturacion, fecha_factura, estado)
      VALUES ($1, $2, 'TD', '2026-09-30', 'EMITIDA') RETURNING *;`, [town.id, mes.id]);
    const fechaBody = { farmacia_id: farm.id, mes: mes.mes, anio: mes.anio };
    expect((await crear(fechaBody)).status).toBe(409);
    const registrada = (await pool.query(`INSERT INTO entrega_farmacia_periodo
      (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia) VALUES ($1, $2, 'Historia', 'TEST-CIF-0001') RETURNING *;`, [farm.id, mes.id])).rows[0];
    expect((await crear(fechaBody)).body.id).toBe(registrada.id); expect((await recuperar(fechaBody)).status).toBe(200);
    expect((await recuperar(body)).status).toBe(200);
  });
});

describe('creación y recuperación de Entregas', () => {
  it('consulta periodos existentes por mes/año sin crear datos ni exponer información ajena', async () => {
    const mes = await periodo();
    const respuesta = await request(app).get('/entregas/periodos');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toContainEqual({ id: mes.id, mes: mes.mes, anio: mes.anio });
    for (const row of respuesta.body) expect(Object.keys(row).sort()).toEqual(['anio', 'id', 'mes']);
    expect(respuesta.body).toEqual([...respuesta.body].sort((a, b) => b.anio - a.anio || b.mes - a.mes));
    expect((await pool.query('SELECT * FROM periodo WHERE id = $1;', [mes.id])).rows[0]).toEqual(mes);
  });

  it('rechaza parámetros inesperados en la consulta de periodos', async () => {
    expect((await request(app).get('/entregas/periodos').query({ estado: 'ABIERTO' })).status).toBe(400);
  });

  it('crea con Ayuntamiento derivado, periodo de imputación y snapshots del servidor', async () => {
    const { town, farm, mes, body } = await preparar();
    const respuesta = await crear(body);
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({
      id: expect.any(Number), ...body, denominacion_farmacia: farm.denominacion,
      cif_nif_farmacia: farm.cif_nif, precintos_informados: null, importe_informado: null,
      mes: 9, anio: mes.anio, ayuntamiento_id: town.id, ayuntamiento_denominacion: town.denominacion,
    });
    expect(respuesta.body).not.toHaveProperty('cuenta_bancaria');
    expect((await entregas(farm.id)).length).toBe(1);
  });

  it('recupera por GET y POST sin sobrescribir snapshots ni declarados tras editar el maestro', async () => {
    const { farm, body } = await preparar();
    const nueva = await crear(body);
    await pool.query(`UPDATE entrega_farmacia_periodo
      SET precintos_informados = 20, importe_informado = 12.34 WHERE id = $1;`, [nueva.body.id]);
    await pool.query("UPDATE farmacia SET denominacion = 'Nuevo nombre', cif_nif = 'TEST-CIF-0014' WHERE id = $1;", [farm.id]);
    for (const respuesta of [await recuperar(body), await crear(body)]) {
      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({ ...nueva.body, precintos_informados: 20, importe_informado: '12.34' });
    }
    expect((await entregas(farm.id)).length).toBe(1);
  });

  it('GET de pareja inexistente devuelve 404 y no crea entregas', async () => {
    const { farm, body } = await preparar();
    expect((await recuperar(body)).status).toBe(404);
    expect(await entregas(farm.id)).toEqual([]);
  });

  it('permite distintas parejas farmacia-periodo sin mezclarlas', async () => {
    const { town, farm, body } = await preparar();
    const otroPeriodo = await periodo();
    const otraFarmacia = await farmacia(town.id);
    const parejas = [body, { farmacia_id: farm.id, periodo_id: otroPeriodo.id },
      { farmacia_id: otraFarmacia.id, periodo_id: body.periodo_id }];
    const respuestas = [];
    for (const pareja of parejas) respuestas.push(await crear(pareja));
    expect(respuestas.map((r) => r.status)).toEqual([201, 201, 201]);
    expect(new Set(respuestas.map((r) => r.body.id)).size).toBe(3);
    for (let i = 0; i < parejas.length; i++) {
      expect((await recuperar(parejas[i])).body).toEqual(respuestas[i].body);
    }
  });

  it('rechaza farmacia sin asignación en POST y GET sin escribir', async () => {
    const farm = await farmacia();
    const mes = await periodo();
    const body = { farmacia_id: farm.id, periodo_id: mes.id };
    for (const respuesta of [await crear(body), await recuperar(body)]) {
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error).toMatch(/Ayuntamiento asociado/i);
    }
    expect(await entregas(farm.id)).toEqual([]);
  });

  it.each(['farmacia_id', 'periodo_id'])('rechaza %s inexistente sin crear entregas', async (campo) => {
    const { farm, body } = await preparar();
    const invalido = { ...body, [campo]: 2147483647 };
    expect((await crear(invalido)).status).toBe(404);
    expect((await recuperar(invalido)).status).toBe(404);
    expect(await entregas(farm.id)).toEqual([]);
  });

  it.each([
    {}, { farmacia_id: 1 }, { periodo_id: 1 }, { farmacia_id: '1', periodo_id: 1 },
    { farmacia_id: 1, periodo_id: null }, { farmacia_id: 0, periodo_id: 1 },
    { farmacia_id: 1, periodo_id: -1 }, { farmacia_id: 1.5, periodo_id: 1 },
    { farmacia_id: 1, periodo_id: 2147483648 }, { farmacia_id: 1, periodo_id: true },
    { farmacia_id: 1, periodo_id: 1, denominacion_farmacia: 'Falso snapshot' },
    { farmacia_id: 1, periodo_id: 1, cif_nif_farmacia: 'Falso CIF' },
    { farmacia_id: 1, periodo_id: 1, ayuntamiento_id: 1 },
    { farmacia_id: 1, periodo_id: 1, precintos_informados: 10 },
  ])('rechaza cuerpo inválido o campos fuera de alcance %j', async (body) => {
    expect((await crear(body)).status).toBe(400);
  });

  it.each([
    {}, { farmacia_id: '1' }, { farmacia_id: '-1', periodo_id: '1' },
    { farmacia_id: '1', periodo_id: '1.5' }, { farmacia_id: '2147483648', periodo_id: '1' },
    { farmacia_id: '1', periodo_id: '1', otro: 'x' }, { farmacia_id: ['1', '2'], periodo_id: '1' },
  ])('rechaza consulta inválida %j', async (query) => {
    expect((await recuperar(query)).status).toBe(400);
  });

  it('una entrega vacía creada por API impide trasladar o retirar la asignación', async () => {
    const { town, farm, body } = await preparar();
    const destino = await municipio();
    const nueva = await crear(body);
    expect((await request(app).post(`/ayuntamientos/${destino.id}/farmacias`)
      .send({ farmacia_id: farm.id, ayuntamiento_origen_id: town.id })).status).toBe(409);
    expect((await request(app).delete(`/ayuntamientos/${town.id}/farmacias/${farm.id}`)).status).toBe(409);
    expect((await recuperar(body)).body).toEqual(nueva.body);
  });
});

describe('concurrencia PostgreSQL de Entregas', () => {
  it('dos POST simultáneos crean una sola entrega y devuelven el mismo snapshot', async () => {
    const { farm, body } = await preparar();
    const respuestas = await Promise.all([crear(body), crear(body)]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(respuestas[0].body).toEqual(respuestas[1].body);
    expect((await entregas(farm.id)).length).toBe(1);
  });

  it.each([false, true])('espera una creación pendiente; rollback=%s', async (revertir) => {
    const { farm, mes, body } = await preparar();
    const client = await pool.connect();
    let pendiente;
    try {
      await client.query('BEGIN');
      const pid = (await client.query('SELECT pg_backend_pid() AS pid;')).rows[0].pid;
      const row = (await client.query(`INSERT INTO entrega_farmacia_periodo
        (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia)
        VALUES ($1, $2, 'Snapshot pendiente', 'TEST-CIF-0008') RETURNING id;`, [farm.id, mes.id])).rows[0];
      pendiente = crear(body).then((r) => r);
      await esperarBloqueo(pid);
      await client.query(revertir ? 'ROLLBACK' : 'COMMIT');
      const respuesta = await pendiente;
      expect(respuesta.status).toBe(revertir ? 201 : 200);
      expect(respuesta.body.denominacion_farmacia).toBe(revertir ? farm.denominacion : 'Snapshot pendiente');
      if (!revertir) expect(respuesta.body.id).toBe(row.id);
      expect((await entregas(farm.id)).length).toBe(1);
    } finally {
      await client.query('ROLLBACK');
      if (pendiente) await pendiente;
      client.release();
    }
  }, 10000);

  it.each(['retirada', 'traslado', 'maestro'])('espera al FOR UPDATE y valida los datos confirmados: %s', async (cambio) => {
    const { farm, body } = await preparar();
    const destino = await municipio();
    const client = await pool.connect();
    let pendiente;
    try {
      await client.query('BEGIN');
      const pid = (await client.query('SELECT pg_backend_pid() AS pid;')).rows[0].pid;
      await client.query('SELECT id FROM farmacia WHERE id = $1 FOR UPDATE;', [farm.id]);
      if (cambio === 'maestro') {
        await client.query("UPDATE farmacia SET denominacion = 'Nombre confirmado', cif_nif = 'TEST-CIF-0010' WHERE id = $1;", [farm.id]);
      } else {
        await client.query('UPDATE farmacia SET ayuntamiento_id = $1 WHERE id = $2;',
          [cambio === 'retirada' ? null : destino.id, farm.id]);
      }
      pendiente = crear(body).then((r) => r);
      await esperarBloqueo(pid);
      await client.query('COMMIT');
      const respuesta = await pendiente;
      expect(respuesta.status).toBe(cambio === 'maestro' ? 201 : 409);
      if (cambio !== 'maestro') {
        expect(await entregas(farm.id)).toEqual([]);
        expect(respuesta.body.error).toMatch(/asignación municipal ha cambiado/i);
        if (cambio === 'traslado') {
          // Nueva petición obtiene el destino vigente y su bloqueo municipal.
          const nueva = await crear(body);
          expect(nueva.status).toBe(201);
          expect(nueva.body.ayuntamiento_id).toBe(destino.id);
        }
      }
      if (cambio === 'maestro') {
        expect(respuesta.body.denominacion_farmacia).toBe('Nombre confirmado');
        expect(respuesta.body.cif_nif_farmacia).toBe('TEST-CIF-0010');
      }
    } finally {
      await client.query('ROLLBACK');
      if (pendiente) await pendiente;
      client.release();
    }
  }, 10000);

  it.each(['retirada', 'traslado'])('el registro mantiene FOR SHARE hasta commit y bloquea la mutación municipal: %s', async (cambio) => {
    const { town, farm, mes, body } = await preparar();
    const destino = await municipio();
    const client = await pool.connect();
    let registro;
    let mutacion;
    try {
      await client.query('BEGIN');
      const pid = (await client.query('SELECT pg_backend_pid() AS pid;')).rows[0].pid;
      // Detiene la API después del lock de Farmacia, antes de insertar.
      await client.query('SELECT id FROM periodo WHERE id = $1 FOR UPDATE;', [mes.id]);
      registro = crear(body).then((r) => r);
      const pidRegistro = await esperarBloqueo(pid);
      mutacion = (cambio === 'retirada'
        ? request(app).delete(`/ayuntamientos/${town.id}/farmacias/${farm.id}`)
        : request(app).post(`/ayuntamientos/${destino.id}/farmacias`)
          .send({ farmacia_id: farm.id, ayuntamiento_origen_id: town.id })).then((r) => r);
      await esperarBloqueo(pidRegistro);
      await client.query('COMMIT');
      expect((await registro).status).toBe(201);
      expect((await mutacion).status).toBe(409);
      expect((await recuperar(body)).body.ayuntamiento_id).toBe(town.id);
    } finally {
      await client.query('ROLLBACK');
      if (registro) await registro;
      if (mutacion) await mutacion;
      client.release();
    }
  }, 10000);
});
