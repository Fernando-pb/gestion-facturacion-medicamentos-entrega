import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import pool from '../src/db.js';

let ids, verificada = false;
const tablas = ['cobro', 'reapertura_facturacion', 'factura', 'participacion_facturacion', 'facturacion',
  'operacion_lectura', 'precinto', 'incidencia', 'entrega_farmacia_periodo', 'farmacia', 'ayuntamiento', 'periodo', 'medicamento', 'configuracion_facturacion'];
const insertar = async (tabla, sql, valores = []) => {
  const row = (await pool.query(sql, valores)).rows[0]; ids[tabla].push(row.id); return row;
};
const preparar = async (precios = ['100.00'], mesExistente = null) => {
  const town = await insertar('ayuntamiento', `INSERT INTO ayuntamiento
    (cif, denominacion, direccion, codigo_postal, localidad, provincia, estado, tipo_lista_medicamentos)
    VALUES ($1, 'Municipio ficticio emisión', 'Calle', '28001', 'Villa', 'Madrid', 'ACTIVO', 'GENERAL') RETURNING *`, [randomUUID()]);
  const farm = await insertar('farmacia', `INSERT INTO farmacia
    (soe, denominacion, cif_nif, direccion, codigo_postal, localidad, provincia, ayuntamiento_id)
    VALUES ($1, 'Titular B emisión', 'TEST-CIF-0001', 'Calle', '28001', 'Villa', 'Madrid', $2) RETURNING *`, [randomUUID(), town.id]);
  let mes = mesExistente;
  while (!mes) {
    // Periodos ficticios anteriores a las vigencias de otros tests; sin tocar
    // configuraciones ajenas. Cada configuración propia limita ambas fechas.
    mes = (await pool.query(`INSERT INTO periodo (anio, mes) VALUES ($1, $2)
      ON CONFLICT (mes, anio) DO NOTHING RETURNING *`, [randomInt(100, 1900), randomInt(1, 13)])).rows[0];
    if (mes) ids.periodo.push(mes.id);
  }
  const entrega = await insertar('entrega_farmacia_periodo', `INSERT INTO entrega_farmacia_periodo
    (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia, precintos_informados, importe_informado)
    VALUES ($1, $2, 'Titular A entrega', 'TEST-CIF-0014', 999, 99999.99) RETURNING *`, [farm.id, mes.id]);
  let med;
  while (!med) {
    med = (await pool.query(`INSERT INTO medicamento (codigo_nacional, descripcion, precio, estado, situacion_comercial, tipo_facturacion)
      VALUES ($1, 'Medicamento ficticio emisión', 999.99, 'ACTIVO', 'ALTA', 'TD')
      ON CONFLICT (codigo_nacional) DO NOTHING RETURNING *`, [String(randomInt(0, 1000000)).padStart(6, '0')])).rows[0];
    if (med) ids.medicamento.push(med.id);
  }
  for (const [index, precio] of precios.entries()) await insertar('precinto', `INSERT INTO precinto
    (entrega_id, numero_paquete, posicion_paquete, medicamento_id, codigo_barras_original, codigo_nacional, precio_aplicado, precio_referencia)
    VALUES ($1, 1, $2, $3, $4, $4, $5, $5) RETURNING *`, [entrega.id, index + 1, med.id, med.codigo_nacional, precio]);
  const r = await request(app).post('/facturaciones/calculo').send({ ayuntamiento_id: town.id, periodo_id: mes.id });
  expect(r.status).toBe(200);
  return { town, farm, mes, entrega, med, f: r.body.facturacion_id, p: r.body.participaciones[0]?.id };
};
const configuracion = (c, comision = '2.7', iva = '21') => insertar('configuracion_facturacion', `INSERT INTO configuracion_facturacion
  (fecha_inicio, fecha_fin, porcentaje_comision, porcentaje_iva)
  SELECT fecha_factura, fecha_factura, $2, $3 FROM facturacion WHERE id = $1 RETURNING *`, [c.f, comision, iva]);
const numeros = () => ({ numero_factura_precintos: 'P-' + randomUUID(), numero_factura_comision: 'C-' + randomUUID() });
const emitir = (c, datos = numeros()) => request(app).post(`/facturaciones/${c.f}/emision`).send(datos);
const facturas = (c) => pool.query('SELECT * FROM factura WHERE facturacion_id = $1 ORDER BY tipo', [c.f]).then((r) => r.rows);
const estado = (c) => pool.query('SELECT estado FROM facturacion WHERE id=$1', [c.f]).then((r) => r.rows[0].estado);
const reabrir = (c) => request(app).post(`/facturaciones/${c.f}/reapertura`).send({ motivo: 'Corrección ficticia emisión' });
const esperar = (pid) => vi.waitFor(async () => {
  expect((await pool.query('SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))', [pid])).rowCount).toBeGreaterThan(0);
}, { timeout: 4000, interval: 20 });

beforeAll(async () => {
  if (process.env.DB_NAME !== 'gestion_facturacion_medicamentos_test'
    || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST ?? 'localhost')) throw new Error('Base dedicada local obligatoria.');
  expect((await pool.query('SELECT current_database() AS db')).rows[0].db).toBe('gestion_facturacion_medicamentos_test'); verificada = true;
});
beforeEach(() => { ids = Object.fromEntries(tablas.map((t) => [t, []])); });
afterEach(async () => {
  if (!verificada) return;
  const procesos = (await pool.query('SELECT id FROM facturacion WHERE ayuntamiento_id = ANY($1::int[])', [ids.ayuntamiento])).rows.map((r) => r.id);
  for (const tabla of ['cobro']) await pool.query(`DELETE FROM ${tabla} WHERE factura_id IN (SELECT id FROM factura WHERE facturacion_id = ANY($1::int[]))`, [procesos]);
  for (const tabla of ['reapertura_facturacion', 'factura', 'participacion_facturacion']) await pool.query(`DELETE FROM ${tabla} WHERE facturacion_id = ANY($1::int[])`, [procesos]);
  ids.facturacion = procesos;
  for (const tabla of ['operacion_lectura', 'precinto', 'incidencia']) await pool.query(`DELETE FROM ${tabla} WHERE entrega_id = ANY($1::int[])`, [ids.entrega_farmacia_periodo]);
  for (const tabla of tablas) await pool.query(`DELETE FROM ${tabla} WHERE id = ANY($1::int[])`, [ids[tabla]]);
});
afterAll(() => pool.end());


const prepararEmitida = async (precios) => {
  const c = await preparar(precios); await configuracion(c);
  const r = await emitir(c); expect(r.status).toBe(201);
  c.facturas = r.body.facturas; return c;
};
const datosCobro = (f, cambios = {}) => ({ fecha_cobro: '2026-10-11', importe_cobrado: f.importe_total, ...cambios });
const cobrar = (c, f = c.facturas.find((fila) => fila.tipo === 'PRECINTOS'), cambios = {}) =>
  request(app).post(`/facturaciones/${c.f}/facturas/${f.id}/cobro`).send(datosCobro(f, cambios));
const cobros = (c) => pool.query(`SELECT c.* FROM cobro c JOIN factura f ON f.id=c.factura_id
  WHERE f.facturacion_id=$1 ORDER BY c.id`, [c.f]).then((r) => r.rows);

describe('registro de cobros municipales', () => {
  it('registra importe completo, fecha y referencia y permite recuperarlos sin modificar las facturas', async () => {
    const c = await prepararEmitida(), anteriores = await facturas(c);
    const r = await cobrar(c, undefined, { justificante: '  REF banco ficticia  ' });
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ id: expect.any(Number), factura_id: c.facturas.find((f) => f.tipo === 'PRECINTOS').id,
      fecha_cobro: '2026-10-11', importe_cobrado: '100.00', justificante: 'REF banco ficticia' });
    expect((await request(app).get(`/facturaciones/${c.f}`)).body.cobros).toEqual([r.body]);
    expect(await facturas(c)).toEqual(anteriores);
  });

  it.each(['PRECINTOS', 'COMISION'])('permite cobrar %s primero y bloquea reapertura desde ese primer cobro', async (tipo) => {
    const c = await prepararEmitida(), primera = c.facturas.find((f) => f.tipo === tipo);
    expect((await cobrar(c, primera)).status).toBe(201);
    expect(await cobros(c)).toHaveLength(1);
    expect((await request(app).get('/facturaciones/emitidas')).body.find(f => f.facturacion_id === c.f).tiene_cobros).toBe(true);
    expect((await reabrir(c)).status).toBe(409); expect(await estado(c)).toBe('EMITIDA');
    expect((await pool.query('SELECT id FROM reapertura_facturacion WHERE facturacion_id=$1', [c.f])).rowCount).toBe(0);
    expect((await cobrar(c, c.facturas.find((f) => f.id !== primera.id), { justificante: null })).status).toBe(201);
    expect(await cobros(c)).toHaveLength(2);
    expect((await reabrir(c)).status).toBe(409);
  });

  it.each(['99.99', '100.01', '0', '9999999999.99'])('rechaza importe %s sin guardar ni bloquear la reapertura', async (importe_cobrado) => {
    const c = await prepararEmitida(); const r = await cobrar(c, undefined, { importe_cobrado });
    expect(r.status).toBe(409); expect(r.body.error).toMatch(/importe total/);
    expect(await cobros(c)).toEqual([]); expect((await reabrir(c)).status).toBe(200);
  });

  it('rechaza cobro duplicado, incluido el simultáneo, preservando el original', async () => {
    const c = await prepararEmitida();
    const rs = await Promise.all([cobrar(c, undefined, { justificante: 'Uno' }), cobrar(c, undefined, { justificante: 'Dos' })]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    const original = await cobros(c);
    expect((await cobrar(c, undefined, { fecha_cobro: '2026-10-12', justificante: 'Sustitución' })).status).toBe(409);
    expect(await cobros(c)).toEqual(original); expect(original).toHaveLength(1);
  });

  it('cobra ambos importes cero y acepta formato monetario equivalente sin redondear', async () => {
    const c = await prepararEmitida(['0.00']);
    for (const f of c.facturas) expect((await cobrar(c, f, { importe_cobrado: '0' })).status).toBe(201);
    expect(await cobros(c)).toHaveLength(2);
    expect((await reabrir(c)).status).toBe(409);
  });

  it('rechaza cobrar durante reapertura y permite hacerlo después de reemitir por el nuevo importe', async () => {
    const c = await prepararEmitida(); expect((await reabrir(c)).status).toBe(200);
    expect((await cobrar(c)).status).toBe(409); expect(await cobros(c)).toEqual([]);
    await pool.query('UPDATE precinto SET precio_aplicado=200.00 WHERE entrega_id=$1', [c.entrega.id]);
    const r = await emitir(c, {}); expect(r.status).toBe(200);
    expect((await cobrar(c)).status).toBe(409);
    c.facturas = r.body.facturas;
    expect((await cobrar(c)).status).toBe(201);
    expect((await reabrir(c)).status).toBe(409);
  });

  it('rechaza facturación/factura inexistente y factura perteneciente a otro proceso', async () => {
    const a = await prepararEmitida(), b = await prepararEmitida();
    expect((await cobrar(a, b.facturas[0])).status).toBe(404);
    expect((await cobrar(a, { id: 2147483647, importe_total: '100.00' })).status).toBe(404);
    expect((await cobrar({ f: 2147483647, facturas: a.facturas })).status).toBe(404);
    const revision = await preparar();
    expect((await cobrar(revision, a.facturas[0])).status).toBe(404);
    expect(await cobros(a)).toEqual([]); expect(await cobros(b)).toEqual([]);
  });

  it.each([
    { fecha_cobro: '2026-02-30' }, { fecha_cobro: '2026-13-01' }, { fecha_cobro: '0000-01-01' },
    { fecha_cobro: '11/10/2026' }, { fecha_cobro: null }, { importe_cobrado: 100 },
    { importe_cobrado: '100.001' }, { importe_cobrado: '1e2' }, { importe_cobrado: '-100' },
    { importe_cobrado: '100,00' }, { importe_cobrado: '10000000000' }, { justificante: '' },
    { justificante: '  ' }, { justificante: 123 }, { desconocido: true },
  ])('rechaza datos inválidos %j sin escribir', async (datos) => {
    const c = await prepararEmitida(); expect((await cobrar(c, undefined, datos)).status).toBe(400);
    expect(await cobros(c)).toEqual([]);
  });

  it('valida IDs, cuerpo requerido y query; admite fecha bisiesta y justificante omitido', async () => {
    const c = await prepararEmitida(), f = c.facturas[0];
    for (const path of [`/facturaciones/0/facturas/${f.id}/cobro`, `/facturaciones/${c.f}/facturas/x/cobro`,
      `/facturaciones/${c.f}/facturas/${f.id}/cobro?extra=1`]) {
      expect((await request(app).post(path).send(datosCobro(f))).status).toBe(400);
    }
    expect((await request(app).post(`/facturaciones/${c.f}/facturas/${f.id}/cobro`).send({})).status).toBe(400);
    const r = await cobrar(c, f, { fecha_cobro: '2024-02-29' });
    expect(r.status).toBe(201); expect(r.body.fecha_cobro).toBe('2024-02-29'); expect(r.body.justificante).toBeNull();
  });

  it.each(['cobro', 'reapertura'])('serializa dos solicitudes reales cuando gana %s', async (primera) => {
    const c = await prepararEmitida(), actor = await pool.connect(); let p1, p2;
    try {
      await actor.query('BEGIN');
      await actor.query('SELECT id FROM ayuntamiento WHERE id=$1 FOR UPDATE', [c.town.id]);
      const pid = (await actor.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      p1 = (primera === 'cobro' ? cobrar(c) : reabrir(c)).then((r) => r);
      await esperar(pid);
      const primero = (await pool.query(`SELECT pid FROM pg_stat_activity
        WHERE $1 = ANY(pg_blocking_pids(pid)) AND query LIKE 'SELECT id FROM ayuntamiento%'`, [pid])).rows[0].pid;
      p2 = (primera === 'cobro' ? reabrir(c) : cobrar(c)).then((r) => r);
      // El segundo espera detrás del primero: no basta con lanzar Promise.all.
      await esperar(primero);
      await actor.query('COMMIT');
      expect((await p1).status).toBe(primera === 'cobro' ? 201 : 200);
      expect((await p2).status).toBe(409);
    } finally {
      await actor.query('ROLLBACK'); actor.release();
      await Promise.all([p1, p2].filter(Boolean));
    }
    expect(await estado(c)).toBe(primera === 'cobro' ? 'EMITIDA' : 'REABIERTA');
    expect(await cobros(c)).toHaveLength(primera === 'cobro' ? 1 : 0);
    expect((await pool.query('SELECT id FROM reapertura_facturacion WHERE facturacion_id=$1', [c.f])).rowCount)
      .toBe(primera === 'cobro' ? 0 : 1);
  });
});
