import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import pool from '../src/db.js';

let ids, verificada = false;
const tablas = ['cobro', 'reapertura_facturacion', 'factura', 'participacion_facturacion', 'facturacion',
  'operacion_lectura', 'precinto', 'incidencia', 'entrega_farmacia_periodo', 'farmacia', 'ayuntamiento', 'periodo', 'medicamento', 'configuracion_facturacion'];
const insertar = async (tabla, sql, valores = []) => {
  const fila = (await pool.query(sql, valores)).rows[0]; ids[tabla].push(fila.id); return fila;
};
const farmacia = (town) => insertar('farmacia', `INSERT INTO farmacia
  (soe, denominacion, cif_nif, direccion, codigo_postal, localidad, provincia, ayuntamiento_id)
  VALUES ($1,'TEST-PRECIOS','TEST-CIF-0001','Calle','28001','Villa','Madrid',$2) RETURNING *`, [randomUUID(), town]);
const entrega = async (farm, periodo) => {
  const r = await request(app).post('/entregas').send({ farmacia_id: farm.id, periodo_id: periodo.id });
  expect(r.status).toBe(201); ids.entrega_farmacia_periodo.push(r.body.id); return r.body;
};
const medicamento = async () => {
  for (;;) {
    const r = await pool.query(`INSERT INTO medicamento (codigo_nacional,descripcion,precio,estado,situacion_comercial,tipo_facturacion)
      VALUES ($1,'TEST-PRECIOS',12.34,'ACTIVO','ALTA','TD') ON CONFLICT (codigo_nacional) DO NOTHING RETURNING *`,
    [String(randomInt(0, 1000000)).padStart(6, '0')]);
    if (r.rowCount) { ids.medicamento.push(r.rows[0].id); return r.rows[0]; }
  }
};
const leer = async (e, med, nuevo = false) => {
  const clave = randomUUID();
  const r = await request(app).post(`/entregas/${e.id}/lecturas`).send({ codigo_barras_original: med.codigo_nacional, clave_operacion: clave, nuevo_paquete: nuevo });
  expect(r.status).toBe(201); return { ...r.body.lectura, clave };
};
const calcular = (c) => request(app).post('/facturaciones/calculo').send({ ayuntamiento_id: c.town.id, periodo_id: c.periodo.id });
const preparar = async (revisar = true, cantidad = 2) => {
  const town = await insertar('ayuntamiento', `INSERT INTO ayuntamiento
    (cif,denominacion,direccion,codigo_postal,localidad,provincia,estado,tipo_lista_medicamentos)
    VALUES ($1,'TEST-PRECIOS','Calle','28001','Villa','Madrid','ACTIVO','GENERAL') RETURNING *`, [randomUUID()]);
  const farm = await farmacia(town.id);
  let periodo;
  while (!periodo) {
    periodo = (await pool.query('INSERT INTO periodo (mes,anio) VALUES ($1,$2) ON CONFLICT (mes,anio) DO NOTHING RETURNING *',
      [randomInt(1, 13), randomInt(100, 1900)])).rows[0];
    if (periodo) ids.periodo.push(periodo.id);
  }
  const e = await entrega(farm, periodo), med = await medicamento(), lecturas = [];
  for (let i = 0; i < cantidad; i++) lecturas.push(await leer(e, med, i > 0));
  const c = { town, farm, periodo, entrega: e, med, lecturas };
  if (revisar) { const r = await calcular(c); expect(r.status).toBe(200); c.f = r.body.facturacion_id; c.p = r.body.participaciones[0]?.id; }
  return c;
};
const corregir = (c, precio = '1.23', precintoId = c.lecturas[0].id) =>
  request(app).put(`/entregas/${c.entrega.id}/precintos/${precintoId}/precio`).send({ precio_aplicado: precio });
const contexto = (c) => request(app).get(`/entregas/${c.entrega.id}/precios`);
const consultar = (c) => request(app).get(`/facturaciones/${c.f}`);
const filas = (c) => pool.query('SELECT * FROM precinto WHERE entrega_id=$1 ORDER BY id', [c.entrega.id]).then((r) => r.rows);
const facturas = (c) => pool.query('SELECT * FROM factura WHERE facturacion_id=$1 ORDER BY tipo', [c.f]).then((r) => r.rows);
const reabrir = (c) => request(app).post(`/facturaciones/${c.f}/reapertura`).send({ motivo: 'Corrección excepcional ficticia de precio' });
const emitir = (c, primera = false) => request(app).post(`/facturaciones/${c.f}/emision`).send(primera
  ? { numero_factura_precintos: 'P-' + randomUUID(), numero_factura_comision: 'C-' + randomUUID() } : {});
const configurar = (c) => insertar('configuracion_facturacion', `INSERT INTO configuracion_facturacion
  (fecha_inicio,fecha_fin,porcentaje_comision,porcentaje_iva) SELECT fecha_factura,fecha_factura,2.7,21 FROM facturacion WHERE id=$1 RETURNING *`, [c.f]);
const emitida = async (c) => { await configurar(c); expect((await emitir(c, true)).status).toBe(201); };
const cobrar = (c, fa) => request(app).post(`/facturaciones/${c.f}/facturas/${fa.id}/cobro`)
  .send({ fecha_cobro: '2026-10-12', importe_cobrado: fa.importe_total, justificante: 'Prueba ficticia' });
const esperarBloqueo = async (pid) => {
  let bloqueado;
  await vi.waitFor(async () => {
    const r = await pool.query('SELECT pid FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))', [pid]);
    expect(r.rowCount).toBeGreaterThan(0); bloqueado = r.rows[0].pid;
  }, { timeout: 4000, interval: 20 });
  return bloqueado;
};

beforeAll(async () => {
  if (process.env.DB_NAME !== 'gestion_facturacion_medicamentos_test'
    || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST ?? 'localhost')) throw new Error('Base dedicada local obligatoria.');
  expect((await pool.query('SELECT current_database() AS db')).rows[0].db).toBe('gestion_facturacion_medicamentos_test'); verificada = true;
});
beforeEach(() => { ids = Object.fromEntries(tablas.map((t) => [t, []])); });
afterEach(async () => {
  if (!verificada) return;
  const procesos = (await pool.query('SELECT id FROM facturacion WHERE ayuntamiento_id=ANY($1::int[])', [ids.ayuntamiento])).rows.map((r) => r.id);
  await pool.query('DELETE FROM cobro WHERE factura_id IN (SELECT id FROM factura WHERE facturacion_id=ANY($1::int[]))', [procesos]);
  for (const t of ['reapertura_facturacion', 'factura', 'participacion_facturacion']) await pool.query(`DELETE FROM ${t} WHERE facturacion_id=ANY($1::int[])`, [procesos]);
  ids.facturacion = procesos;
  for (const t of ['operacion_lectura', 'precinto', 'incidencia']) await pool.query(`DELETE FROM ${t} WHERE entrega_id=ANY($1::int[])`, [ids.entrega_farmacia_periodo]);
  for (const t of tablas) await pool.query(`DELETE FROM ${t} WHERE id=ANY($1::int[])`, [ids[t]]);
});
afterAll(() => pool.end());

describe('corrección excepcional real', () => {
  it('REVISION cambia solo el precinto seleccionado, conserva los repetidos y recalcula exactamente', async () => {
    const c = await preparar();
    await pool.query('UPDATE medicamento SET precio=23.45 WHERE id=$1', [c.med.id]);
    const tercera = await leer(c.entrega, c.med);
    const medOtro = await medicamento(); await leer(c.entrega, medOtro);
    const farmOtra = await farmacia(c.town.id), eOtra = await entrega(farmOtra, c.periodo);
    await leer(eOtra, c.med);
    const periodoOtro = await insertar('periodo', 'INSERT INTO periodo (mes,anio) VALUES (1,$1) RETURNING *', [randomInt(100000, 1000000000)]);
    const ePeriodo = await entrega(c.farm, periodoOtro); await leer(ePeriodo, c.med);
    const otroMunicipio = await preparar();
    await calcular(c);
    const entregasControl = [eOtra.id, ePeriodo.id, otroMunicipio.entrega.id];
    const fuera = (await pool.query('SELECT * FROM precinto WHERE entrega_id=ANY($1::int[]) ORDER BY id', [entregasControl])).rows;
    const originales = await filas(c);
    const r = await corregir(c, '0.10'); expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ lecturas_actualizadas: 1, importe_precintos: '48.23', subtotal_facturable: '48.23' });
    const despues = await filas(c);
    expect(despues).toEqual(originales.map((p) => p.id === c.lecturas[0].id ? { ...p, precio_aplicado: '0.10' } : p));
    expect(despues.find((p) => p.id === tercera.id).precio_referencia).toBe('23.45');
    expect((await pool.query('SELECT precio FROM medicamento WHERE id=$1', [c.med.id])).rows[0].precio).toBe('23.45');
    expect((await pool.query('SELECT * FROM precinto WHERE entrega_id=ANY($1::int[]) ORDER BY id', [entregasControl])).rows).toEqual(fuera);
    expect((await consultar(c)).body.participaciones.find((p) => p.id === c.p)).toMatchObject({ importe_precintos: '48.23', requiere_recalculo: false });
    expect((await request(app).get(`/entregas/${c.entrega.id}/resumen`)).body.subtotal_facturable).toBe('48.23');
    expect((await request(app).get(`/entregas/${c.entrega.id}/operaciones/${c.lecturas[0].clave}`)).body.lectura).toMatchObject({ precio_aplicado: '0.10', precio_referencia: '12.34' });
    expect((await request(app).get(`/entregas/${c.entrega.id}/operaciones/${tercera.clave}`)).body.lectura).toMatchObject({ precio_aplicado: '23.45', precio_referencia: '23.45' });
    expect((await contexto(otroMunicipio)).body.estado).toBe('REVISION');
    expect((await corregir(c, '0')).status).toBe(200);
    expect((await filas(c)).find((p) => p.id === c.lecturas[0].id).precio_aplicado).toBe('0.00');
    const futura = await leer(c.entrega, c.med);
    expect(futura).toMatchObject({ precio_aplicado: '23.45', precio_referencia: '23.45' });
    expect(futura.id).toBeGreaterThan(tercera.id);
    const lista = (await request(app).get(`/entregas/${c.entrega.id}/precintos`)).body;
    expect(lista.at(-1).id).toBe(futura.id);
    expect((await request(app).get(`/entregas/${c.entrega.id}/resumen`)).body.subtotal_facturable).toBe('71.58');
  });
  it('REABIERTA conserva B/fecha/motivo/números y los documentos originales hasta reemitir con importes nuevos', async () => {
    const c = await preparar();
    await request(app).put(`/facturaciones/${c.f}/participaciones/${c.p}/b`).send({ soe_b: c.farm.soe, denominacion_b: 'B confirmado', cif_b: 'TEST-CIF-0008' });
    await emitida(c); const originales = await facturas(c);
    expect((await reabrir(c)).status).toBe(200);
    const historial = (await pool.query('SELECT * FROM reapertura_facturacion WHERE facturacion_id=$1', [c.f])).rows;
    expect(historial).toHaveLength(1); expect(historial[0].fecha_reapertura).toBeInstanceOf(Date);
    expect(historial[0].motivo).toBe('Corrección excepcional ficticia de precio');
    await pool.query("UPDATE farmacia SET denominacion='Titular posterior' WHERE id=$1", [c.farm.id]);
    expect((await contexto(c)).body).toMatchObject({ estado: 'REABIERTA', permite_correccion: true, tiene_cobros: false });
    expect((await corregir(c, '100')).status).toBe(200);
    expect((await consultar(c)).body.participaciones[0]).toMatchObject({ id: c.p, denominacion_b: 'B confirmado', importe_precintos: '112.34', requiere_recalculo: false });
    expect(await facturas(c)).toEqual(originales);
    const previa = await request(app).get(`/facturaciones/${c.f}/previsualizacion`);
    expect(previa.status).toBe(200); expect(previa.body.importe_precintos).toBe('112.34');
    expect((await emitir(c)).status).toBe(200);
    const fs = await facturas(c);
    expect(fs.map((f) => [f.id, f.numero_factura])).toEqual(originales.map((f) => [f.id, f.numero_factura]));
    expect(fs.find((f) => f.tipo === 'PRECINTOS').importe_total).toBe('112.34');
    expect(fs.find((f) => f.tipo === 'COMISION')).toMatchObject({ importe_comision: '3.03', importe_iva: '0.64', importe_total: '3.67' });
    expect((await filas(c)).every((p) => p.precio_referencia === '12.34')).toBe(true);
  });
  it('EMITIDA rechaza edición directa sin cambiar lecturas ni documentos y exige reapertura', async () => {
    const c = await preparar(); await emitida(c); const antes = await filas(c), fs = await facturas(c);
    expect((await contexto(c)).body).toMatchObject({ estado: 'EMITIDA', permite_correccion: false, tiene_cobros: false });
    const r = await corregir(c); expect(r.status).toBe(409); expect(r.body.error).toMatch(/reabrirse/);
    const nueva = await request(app).post(`/entregas/${c.entrega.id}/lecturas`).send({ codigo_barras_original: c.med.codigo_nacional, clave_operacion: randomUUID() });
    expect(nueva.status).toBe(409);
    expect(await filas(c)).toEqual(antes); expect(await facturas(c)).toEqual(fs);
  });
  it('una reapertura válida permite añadir lecturas y corregir una sola, actualizando el total', async () => {
    const c = await preparar(); await emitida(c); expect((await reabrir(c)).status).toBe(200);
    const nueva = await leer(c.entrega, c.med);
    expect(nueva).toMatchObject({ precio_aplicado: '12.34', precio_referencia: '12.34' });
    expect((await request(app).get(`/entregas/${c.entrega.id}/resumen`)).body).toMatchObject({ admitidos: 3, subtotal_facturable: '37.02' });
    expect((await corregir(c)).body.subtotal_facturable).toBe('25.91');
    expect((await filas(c)).find((p) => p.id === nueva.id).precio_aplicado).toBe('12.34');
  });
  it.each(['PRECINTOS', 'COMISION'])('cobro de %s bloquea reapertura y corrección incluso con estado incoherente', async (tipo) => {
    const c = await preparar(); await emitida(c);
    const f = (await facturas(c)).find((r) => r.tipo === tipo); expect((await cobrar(c, f)).status).toBe(201);
    const antes = await filas(c); expect((await reabrir(c)).status).toBe(409);
    await pool.query("UPDATE facturacion SET estado='REABIERTA' WHERE id=$1", [c.f]);
    const r = await corregir(c); expect(r.status).toBe(409); expect(r.body.error).toMatch(/cobro/);
    expect((await request(app).post(`/entregas/${c.entrega.id}/lecturas`).send({ codigo_barras_original: c.med.codigo_nacional, clave_operacion: randomUUID() })).status).toBe(409);
    expect((await contexto(c)).body).toMatchObject({ tiene_cobros: true, permite_correccion: false });
    expect(await filas(c)).toEqual(antes);
  });
  it('sin facturación permite corregir sin crear cabecera/participación y mantiene el permiso con revisión no preparada para esa entrega', async () => {
    const c = await preparar(false); const r = await contexto(c);
    expect(r.body).toMatchObject({ facturacion_id: null, estado: null, estado_entrega: 'SIN_FACTURAR', permite_correccion: true });
    const original = await filas(c), corregido = await corregir(c, '1');
    expect(corregido.status).toBe(200); expect(corregido.body).toMatchObject({ facturacion_id: null, importe_precintos: null, subtotal_facturable: '13.34' });
    expect(await filas(c)).toEqual(original.map((p) => p.id === c.lecturas[0].id ? { ...p, precio_aplicado: '1.00' } : p));
    expect((await pool.query('SELECT id FROM facturacion WHERE ayuntamiento_id=$1 AND periodo_id=$2', [c.town.id, c.periodo.id])).rows).toEqual([]);
    const calculo = await calcular(c); c.f = calculo.body.facturacion_id;
    expect((await contexto(c)).body).toMatchObject({ estado: 'REVISION', tiene_cobros: false, permite_correccion: true });
    await pool.query('DELETE FROM participacion_facturacion WHERE facturacion_id=$1', [c.f]);
    expect((await corregir(c)).status).toBe(200);
    expect((await contexto(c)).body.permite_correccion).toBe(true);
    expect((await pool.query('SELECT id FROM participacion_facturacion WHERE facturacion_id=$1', [c.f])).rows).toEqual([]);
  });
  it('rechaza precinto de otra entrega, inexistente y ruta antigua por código sin modificar lecturas', async () => {
    const c = await preparar(), otra = await preparar(), antes = await filas(c);
    expect((await corregir(c, '1', otra.lecturas[0].id)).status).toBe(404);
    expect((await corregir(c, '1', 2147483647)).status).toBe(404);
    expect((await request(app).put(`/entregas/${c.entrega.id}/precios/${c.med.codigo_nacional}`).send({ precio_aplicado: '1' })).status).toBe(404);
    expect((await contexto({ entrega: { id: 2147483647 } })).status).toBe(404);
    expect((await corregir({ ...c, entrega: { id: 2147483647 } })).status).toBe(404);
    expect(await filas(c)).toEqual(antes);
  });
  it('desbordamiento del subtotal revierte todas las lecturas y la participación', async () => {
    const c = await preparar(), antes = await filas(c), revision = (await consultar(c)).body;
    expect((await corregir(c, '9999999999.99')).status).toBe(409);
    expect(await filas(c)).toEqual(antes); expect((await consultar(c)).body).toEqual(revision);
  });
  it.each([-1, 1.23, null, '', '-1', '1,23', '1.234', '1e2', '10000000000', 'NaN'])('rechaza precio inválido %j sin escribir', async (precio) => {
    const c = await preparar(), antes = await filas(c);
    expect((await corregir(c, precio)).status).toBe(400); expect(await filas(c)).toEqual(antes);
  });
  it('valida campos extra, IDs y queries sin confiar en el cliente', async () => {
    const c = await preparar();
    const url = `/entregas/${c.entrega.id}/precintos/${c.lecturas[0].id}/precio`;
    expect((await request(app).put(url).send({ precio_aplicado: '1', precio_referencia: '1' })).status).toBe(400);
    expect((await request(app).put(url).send({ facturacion_id: c.f, precio_aplicado: '1' })).status).toBe(400);
    expect((await request(app).put(url + '?estado=REVISION').send({ precio_aplicado: '1' })).status).toBe(400);
    expect((await corregir(c, '1', '1e2')).status).toBe(400);
    expect((await corregir(c, '1', 0)).status).toBe(400);
    expect((await request(app).get(`/entregas/${c.entrega.id}/precios?extra=1`)).status).toBe(400);
  });
});

describe('carreras reales entre corrección y operaciones financieras', () => {
  it('la preparación inicial espera a la corrección sin cabecera y calcula el precio confirmado', async () => {
    const c = await preparar(false), gate = await pool.connect(); let a, b;
    try {
      await gate.query('BEGIN'); await gate.query('SELECT id FROM precinto WHERE entrega_id=$1 FOR UPDATE', [c.entrega.id]);
      const pid = (await gate.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      a = corregir(c).then((r) => r); const escritor = await esperarBloqueo(pid);
      b = calcular(c).then((r) => r); await esperarBloqueo(escritor);
      await gate.query('COMMIT');
      expect((await a).status).toBe(200);
      const revision = await b; expect(revision.status).toBe(200);
      expect(revision.body).toMatchObject({ estado: 'REVISION', importe_total: '13.57' });
      expect((await filas(c)).map((p) => p.precio_aplicado)).toEqual(['1.23', '12.34']);
    } finally { await gate.query('ROLLBACK'); gate.release(); await Promise.allSettled([a, b].filter(Boolean)); }
  });
  it.each(['correccion', 'emision', 'reapertura', 'cobro'])('%s toma primero el bloqueo; la operación que espera revalida el estado', async (primera) => {
    const c = await preparar(); await configurar(c);
    if (['reapertura', 'cobro'].includes(primera)) expect((await emitir(c, true)).status).toBe(201);
    const gate = await pool.connect(); let a, b;
    try {
      await gate.query('BEGIN');
      await gate.query(primera === 'correccion' ? 'SELECT id FROM precinto WHERE entrega_id=$1 FOR UPDATE' : 'SELECT id FROM facturacion WHERE id=$1 FOR UPDATE',
        [primera === 'correccion' ? c.entrega.id : c.f]);
      const pid = (await gate.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const f = primera === 'cobro' ? (await facturas(c)).find((r) => r.tipo === 'PRECINTOS') : null;
      a = (primera === 'correccion' ? corregir(c, '100') : primera === 'emision' ? emitir(c, true)
        : primera === 'reapertura' ? reabrir(c) : cobrar(c, f)).then((r) => r);
      const pidPrimera = await esperarBloqueo(pid);
      b = (primera === 'correccion' ? emitir(c, true) : corregir(c, '100')).then((r) => r);
      await esperarBloqueo(pidPrimera);
      await gate.query('COMMIT');
      const [ra, rb] = await Promise.all([a, b]);
      expect(ra.status).toBe(primera === 'emision' || primera === 'cobro' ? 201 : 200);
      expect(rb.status).toBe(primera === 'correccion' ? 201 : primera === 'reapertura' ? 200 : 409);
      if (['correccion', 'reapertura'].includes(primera)) expect(await filas(c)).toMatchObject([
        { id: c.lecturas[0].id, precio_aplicado: '100.00' }, { id: c.lecturas[1].id, precio_aplicado: '12.34' }]);
      else expect((await filas(c)).every((p) => p.precio_aplicado === '12.34')).toBe(true);
      if (primera === 'correccion') expect((await facturas(c)).find((r) => r.tipo === 'PRECINTOS').importe_total).toBe('112.34');
      if (primera === 'cobro') expect((await reabrir(c)).status).toBe(409);
    } finally { await gate.query('ROLLBACK'); gate.release(); await Promise.allSettled([a, b].filter(Boolean)); }
  });
  it('corrección en REABIERTA precede a cobro; el cobro espera y se rechaza sin afectar el precio', async () => {
    const c = await preparar(); await emitida(c); await reabrir(c);
    const f = (await facturas(c)).find((r) => r.tipo === 'COMISION'), gate = await pool.connect(); let a, b;
    try {
      await gate.query('BEGIN'); await gate.query('SELECT id FROM precinto WHERE entrega_id=$1 FOR UPDATE', [c.entrega.id]);
      const pid = (await gate.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      a = corregir(c, '100').then((r) => r); const escritor = await esperarBloqueo(pid);
      b = cobrar(c, f).then((r) => r); await esperarBloqueo(escritor);
      await gate.query('COMMIT');
      expect((await a).status).toBe(200); expect((await b).status).toBe(409);
      expect((await consultar(c)).body.cobros).toEqual([]);
    } finally { await gate.query('ROLLBACK'); gate.release(); await Promise.allSettled([a, b].filter(Boolean)); }
  });
});


describe('eliminación apta con estados financieros reales', () => {
  const borrar = (c, id = c.lecturas[0].id) => request(app).delete('/entregas/' + c.entrega.id + '/precintos/' + id);
  it.each([false, true])('sin revisión o REVISION (%s) permite borrado individual y total vigente', async (revision) => {
    const c = await preparar(revision, 1), segunda = await leer(c.entrega, c.med), tercero = await leer(c.entrega, c.med, true);
    expect((await borrar(c)).status).toBe(204);
    const lista = (await request(app).get('/entregas/' + c.entrega.id + '/precintos')).body;
    expect(lista.map(p => [p.id, p.numero_paquete, p.posicion_paquete, p.precio_aplicado, p.precio_referencia])).toEqual([[segunda.id,1,1,'12.34','12.34'],[tercero.id,2,1,'12.34','12.34']]);
    expect((await request(app).get('/entregas/' + c.entrega.id + '/resumen')).body).toMatchObject({ admitidos: 2, subtotal_facturable: '24.68' });
    expect((await pool.query('SELECT precio::text FROM medicamento WHERE id=$1',[c.med.id])).rows[0].precio).toBe('12.34');
  });
  it('EMITIDA rechaza DELETE; reapertura válida permite y documentos esperan reemisión', async () => {
    const c = await preparar(); await emitida(c); const antes = await filas(c), documentos = await facturas(c);
    const rechazo = await borrar(c); expect(rechazo.status).toBe(409);
    expect(rechazo.body.error).toContain('EMITIDA y no tiene cobros');
    expect(rechazo.body.error).toContain('Reábrela de forma controlada');
    expect(await filas(c)).toEqual(antes);
    expect((await reabrir(c)).status).toBe(200); expect((await borrar(c)).status).toBe(204);
    expect((await request(app).get('/entregas/' + c.entrega.id + '/resumen')).body).toMatchObject({ admitidos: 1, subtotal_facturable: '12.34', paquetes: [{ numero_paquete: 2, precintos: 1, subtotal_facturable: '12.34' }] });
    expect(await facturas(c)).toEqual(documentos); expect((await emitir(c)).status).toBe(200);
    expect((await facturas(c)).find(f => f.tipo === 'PRECINTOS').importe_total).toBe('12.34');
  });
  it.each(['PRECINTOS','COMISION'])('cobro de %s bloquea reapertura y borrado, también con REABIERTA incoherente', async (tipo) => {
    const c = await preparar(); await emitida(c); const fa = (await facturas(c)).find(f => f.tipo === tipo);
    await insertar('cobro','INSERT INTO cobro (factura_id,fecha_cobro,importe_cobrado) VALUES ($1,CURRENT_DATE,$2) RETURNING *',[fa.id,fa.importe_total]);
    const antes = await filas(c); expect((await reabrir(c)).status).toBe(409);
    const rechazoCobro = await borrar(c);
    expect(rechazoCobro.status).toBe(409);
    expect(rechazoCobro.body.error).toContain('existe al menos un cobro');
    expect(rechazoCobro.body.error).toContain('No se puede modificar la lectura ni reabrir');
    expect(rechazoCobro.body.error).not.toContain('Reábrela');
    await pool.query("UPDATE facturacion SET estado='REABIERTA' WHERE id=$1",[c.f]);
    expect((await borrar(c)).status).toBe(409); expect(await filas(c)).toEqual(antes);
  });
});
