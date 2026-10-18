import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import pool from '../src/db.js';

let propios;
let verificada = false;
const tablas = ['cobro', 'factura', 'reapertura_facturacion', 'participacion_facturacion', 'facturacion',
  'operacion_lectura', 'precinto', 'incidencia', 'entrega_farmacia_periodo', 'medicamento', 'periodo', 'farmacia', 'ayuntamiento'];
const insertar = async (tabla, sql, valores = []) => {
  const fila = (await pool.query(sql, valores)).rows[0];
  propios[tabla].push(fila.id);
  return fila;
};
const municipio = () => insertar('ayuntamiento', `INSERT INTO ayuntamiento
  (cif, denominacion, direccion, codigo_postal, localidad, provincia, estado, tipo_lista_medicamentos)
  VALUES ($1, 'Municipio ficticio participaciones', 'Calle', '28001', 'Villa', 'Madrid', 'ACTIVO', 'GENERAL') RETURNING *;`, [randomUUID()]);
const farmacia = (town) => insertar('farmacia', `INSERT INTO farmacia
  (soe, cif_nif, denominacion, direccion, codigo_postal, localidad, provincia, ayuntamiento_id)
  VALUES ($1, 'TEST-CIF-0001', 'Titular A', 'Calle', '28001', 'Villa', 'Madrid', $2) RETURNING *;`, [randomUUID(), town]);
const periodo = () => insertar('periodo', 'INSERT INTO periodo (mes, anio) VALUES (2, $1) RETURNING *;', [randomInt(20000, 200000)]);
const entrega = (farm, mes) => insertar('entrega_farmacia_periodo', `INSERT INTO entrega_farmacia_periodo
  (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia, precintos_informados, importe_informado)
  VALUES ($1, $2, $3, $4, 999, 123456.78) RETURNING *;`, [farm.id, mes, farm.denominacion, farm.cif_nif]);
const preparar = async () => {
  const town = await municipio(), farm = await farmacia(town.id), mes = await periodo();
  return { town, farm, mes, entrega: await entrega(farm, mes.id) };
};
const medicamento = async () => {
  for (;;) {
    const filas = (await pool.query(`INSERT INTO medicamento
      (codigo_nacional, descripcion, precio, estado, situacion_comercial, tipo_facturacion)
      VALUES ($1, 'Medicamento ficticio participación', 50.00, 'ACTIVO', 'ALTA', 'TD')
      ON CONFLICT (codigo_nacional) DO NOTHING RETURNING *;`, [String(randomInt(0, 1000000)).padStart(6, '0')])).rows;
    if (filas.length) { propios.medicamento.push(filas[0].id); return filas[0]; }
  }
};
const precinto = (entregaId, med, precio, posicion = 1) => insertar('precinto', `INSERT INTO precinto
  (entrega_id, numero_paquete, posicion_paquete, codigo_barras_original, codigo_nacional, medicamento_id, precio_aplicado, precio_referencia)
  VALUES ($1, 1, $2, $3, $3, $4, $5, $5) RETURNING *;`, [entregaId, posicion, med.codigo_nacional, med.id, precio]);
const incidencia = (entregaId) => insertar('incidencia', `INSERT INTO incidencia
  (entrega_id, codigo_barras_original, motivo) VALUES ($1, '000000', 'MEDICAMENTO_DESCONOCIDO') RETURNING *;`, [entregaId]);
const calcular = (c) => request(app).post('/facturaciones/calculo').send({ ayuntamiento_id: c.town.id, periodo_id: c.mes.id });
const consultar = (id) => request(app).get(`/facturaciones/${id}`);
const identidad = { soe_b: 'SOE ficticio confirmado', denominacion_b: 'Titular B revisado', cif_b: 'TEST-CIF-0008' };
const editarB = (id, p, datos = identidad) => request(app).put(`/facturaciones/${id}/participaciones/${p}/b`).send(datos);
const reabrir = (id, motivo = 'Corrección ficticia de lecturas') => request(app).post(`/facturaciones/${id}/reapertura`).send({ motivo });
const emitirFixture = (id, client = pool) => client.query("UPDATE facturacion SET estado = 'EMITIDA' WHERE id = $1;", [id]);
const declarados = (id) => request(app).put(`/entregas/${id}/declarados`).send({ precintos_informados: 1, importe_informado: '0.01' });
const lectura = (e, med) => request(app).post(`/entregas/${e}/lecturas`).send({ codigo_barras_original: med.codigo_nacional, clave_operacion: randomUUID() });
const borrar = (e, p) => request(app).delete(`/entregas/${e}/precintos/${p}`);
const conParticipacion = async () => {
  const c = await preparar(), med = await medicamento();
  const pr = await precinto(c.entrega.id, med, '0.10');
  const r = await calcular(c);
  expect(r.status).toBe(200);
  return { ...c, med, pr, f: r.body.facturacion_id, p: r.body.participaciones[0].id };
};
const facturas = async (id) => {
  const config = (await pool.query(`INSERT INTO configuracion_facturacion (porcentaje_comision, porcentaje_iva, fecha_inicio)
    VALUES (2.7, 21, '2026-01-01') RETURNING id;`)).rows[0];
  // Configuración propia también se limpia; no se toca ninguna configuración ajena.
  propios.configuracion_facturacion.push(config.id);
  const a = await insertar('factura', `INSERT INTO factura (facturacion_id, tipo, numero_factura, numero_precintos, importe_total)
    VALUES ($1, 'PRECINTOS', $2, 1, 0.10) RETURNING *;`, [id, randomUUID()]);
  const b = await insertar('factura', `INSERT INTO factura (facturacion_id, tipo, numero_factura, importe_total,
    base_calculo, porcentaje_comision, importe_comision, porcentaje_iva, importe_iva, configuracion_facturacion_id)
    VALUES ($1, 'COMISION', $2, 0.00, 0.10, 2.7, 0.00, 21, 0.00, $3) RETURNING *;`, [id, randomUUID(), config.id]);
  return { PRECINTOS: a, COMISION: b };
};

beforeAll(async () => {
  if (process.env.DB_NAME !== 'gestion_facturacion_medicamentos_test'
    || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST ?? 'localhost')) throw new Error('Se requiere la base dedicada local de pruebas.');
  expect((await pool.query('SELECT current_database() AS nombre;')).rows[0].nombre).toBe('gestion_facturacion_medicamentos_test');
  verificada = true;
});
beforeEach(() => { propios = Object.fromEntries([...tablas, 'configuracion_facturacion'].map((t) => [t, []])); });
afterEach(async () => {
  if (!verificada) return;
  const entregas = propios.entrega_farmacia_periodo;
  const procesos = (await pool.query('SELECT id FROM facturacion WHERE ayuntamiento_id = ANY($1::int[]);', [propios.ayuntamiento])).rows.map((f) => f.id);
  await pool.query('DELETE FROM reapertura_facturacion WHERE facturacion_id = ANY($1::int[]);', [procesos]);
  await pool.query('DELETE FROM participacion_facturacion WHERE facturacion_id = ANY($1::int[]);', [procesos]);
  for (const tabla of ['operacion_lectura', 'precinto', 'incidencia']) await pool.query(`DELETE FROM ${tabla} WHERE entrega_id = ANY($1::int[]);`, [entregas]);
  propios.facturacion = procesos;
  for (const tabla of [...tablas, 'configuracion_facturacion']) await pool.query(`DELETE FROM ${tabla} WHERE id = ANY($1::int[]);`, [propios[tabla]]);
});
afterAll(() => pool.end());

describe('cálculo y revisión persistidos de participaciones', () => {
  it('lista parejas pendientes con aptos, continúa la misma cabecera y excluye emitidas y cualquier cobro', async () => {
    const c = await preparar(), med = await medicamento();
    const pendientes = async () => {
      const r = await request(app).get('/facturaciones/pendientes'); expect(r.status).toBe(200);
      return r.body.filter(f => f.ayuntamiento_id === c.town.id);
    };
    // Entrega sin aptos, declarados e incidencias no habilitan facturación.
    await incidencia(c.entrega.id); expect(await pendientes()).toEqual([]);
    await precinto(c.entrega.id, med, '0.00');
    expect(await pendientes()).toEqual([expect.objectContaining({ periodo_id: c.mes.id, estado: 'SIN_FACTURAR', facturacion_id: null })]);
    const primera = await calcular(c), segunda = await calcular(c);
    expect(segunda.body.facturacion_id).toBe(primera.body.facturacion_id);
    expect(segunda.body.participaciones).toEqual(primera.body.participaciones);
    expect(await pendientes()).toEqual([expect.objectContaining({ estado: 'REVISION', facturacion_id: primera.body.facturacion_id })]);
    expect((await pool.query('SELECT id FROM factura WHERE facturacion_id=$1', [primera.body.facturacion_id])).rowCount).toBe(0);
    await emitirFixture(primera.body.facturacion_id); const docs = await facturas(primera.body.facturacion_id);
    expect(await pendientes()).toEqual([]);
    // Tener números oficiales no bloquea la reapertura: no hay estado de envío a Contabilidad en el modelo.
    expect(docs.PRECINTOS.numero_factura).toBeTruthy(); expect(docs.COMISION.numero_factura).toBeTruthy();
    expect((await reabrir(primera.body.facturacion_id)).status).toBe(200);
    expect(await pendientes()).toEqual([expect.objectContaining({ estado: 'REABIERTA', facturacion_id: primera.body.facturacion_id })]);
    expect((await calcular(c)).body.facturacion_id).toBe(primera.body.facturacion_id);
    await insertar('cobro', 'INSERT INTO cobro (factura_id, fecha_cobro, importe_cobrado) VALUES ($1, CURRENT_DATE, $2) RETURNING *', [docs.COMISION.id, docs.COMISION.importe_total]);
    expect(await pendientes()).toEqual([]);
    expect((await calcular(c)).status).toBe(409);
    expect((await pool.query('SELECT id FROM facturacion WHERE ayuntamiento_id=$1 AND periodo_id=$2', [c.town.id, c.mes.id])).rowCount).toBe(1);
  });

  it('rechaza query o cuerpo en la consulta de pendientes', async () => {
    expect((await request(app).get('/facturaciones/pendientes?estado=EMITIDA')).status).toBe(400);
    expect((await request(app).get('/facturaciones/pendientes').send({})).status).toBe(400);
  });
  it('suma cada precinto una vez, códigos repetidos y cero; excluye incidencias, declarados, otros municipios/periodos y catálogo actual', async () => {
    const c = await preparar(), med = await medicamento();
    for (const [i, precio] of ['0.10', '0.20', '0.00'].entries()) await precinto(c.entrega.id, med, precio, i + 1);
    await incidencia(c.entrega.id); await incidencia(c.entrega.id);
    const farm2 = await farmacia(c.town.id), e2 = await entrega(farm2, c.mes.id);
    await precinto(e2.id, med, '1.23');
    const vacia = await farmacia(c.town.id); await entrega(vacia, c.mes.id);
    const soloIncidencias = await farmacia(c.town.id), ei = await entrega(soloIncidencias, c.mes.id); await incidencia(ei.id);
    const fuera = await preparar(); await precinto(fuera.entrega.id, med, '999.99');
    const otroPeriodo = await periodo(), ep = await entrega(c.farm, otroPeriodo.id); await precinto(ep.id, med, '999.99');
    await pool.query("UPDATE medicamento SET precio = 999.99, estado = 'INACTIVO', situacion_comercial = 'BAJA' WHERE id = $1", [med.id]);
    await pool.query("UPDATE ayuntamiento SET tipo_lista_medicamentos = 'ESPECIFICA' WHERE id = $1", [c.town.id]);
    const r = await calcular(c);
    expect(r.status).toBe(200); expect(r.body.estado).toBe('REVISION');
    expect(r.body.importe_total).toBe('1.53'); expect(r.body.cantidad_precintos).toBe(4);
    expect(r.body.participaciones).toHaveLength(2);
    expect(r.body.participaciones.find((p) => p.entrega_id === c.entrega.id)).toMatchObject({ cantidad_precintos: 3, importe_precintos: '0.30' });
    expect((await pool.query('SELECT * FROM factura WHERE facturacion_id = $1', [r.body.facturacion_id])).rows).toHaveLength(0);
    const segunda = await calcular(c); expect(segunda.body).toEqual(r.body);
    const guardada = await consultar(r.body.facturacion_id); expect(guardada.body).toEqual(r.body);
    expect(r.body).not.toHaveProperty('cuenta_bancaria');
  });

  it('mantiene exactitud en importes grandes y en el total superior a un importe individual', async () => {
    const c = await preparar(), med = await medicamento();
    await precinto(c.entrega.id, med, '9999999999.98'); await precinto(c.entrega.id, med, '0.01', 2);
    const otra = await farmacia(c.town.id), e = await entrega(otra, c.mes.id); await precinto(e.id, med, '0.02');
    const r = await calcular(c); expect(r.status).toBe(200); expect(r.body.importe_total).toBe('10000000000.01');
    expect(r.body.participaciones.find((p) => p.entrega_id === c.entrega.id).importe_precintos).toBe('9999999999.99');
  });

  it('un precinto apto de precio cero sí genera participación y cuenta en el total', async () => {
    const c = await preparar(), med = await medicamento(); await precinto(c.entrega.id, med, '0.00');
    const r = await calcular(c); expect(r.status).toBe(200);
    expect(r.body.cantidad_precintos).toBe(1); expect(r.body.importe_total).toBe('0.00');
    expect(r.body.participaciones).toHaveLength(1); expect(r.body).not.toHaveProperty('advertencia');
  });

  it('advierte sin crear cabecera, participaciones ni facturas cuando solo hay incidencias/declarados', async () => {
    const c = await preparar(); await incidencia(c.entrega.id);
    const r = await calcular(c); expect(r.status).toBe(200); expect(r.body).toMatchObject({ facturacion_id: null, participaciones: [], importe_total: '0.00', cantidad_precintos: 0 });
    expect(r.body.advertencia).toMatch(/No hay precintos aptos/);
    expect((await pool.query('SELECT id FROM facturacion WHERE ayuntamiento_id = $1', [c.town.id])).rows).toEqual([]);
  });

  it('B parte del catálogo actual, conserva A y la corrección manual de B al recalcular', async () => {
    const c = await preparar(), med = await medicamento(); await precinto(c.entrega.id, med, '0.10');
    await pool.query("UPDATE farmacia SET denominacion = 'Titular inicial B', cif_nif = 'TEST-CIF-0010' WHERE id = $1", [c.farm.id]);
    const r = await calcular(c), p = r.body.participaciones[0];
    expect(p.denominacion_b).toBe('Titular inicial B');
    expect((await editarB(r.body.facturacion_id, p.id)).status).toBe(200);
    await pool.query("UPDATE farmacia SET denominacion = 'Titular C' WHERE id = $1", [c.farm.id]);
    const actualizado = await calcular(c);
    expect(actualizado.body.participaciones[0]).toMatchObject({ id: p.id, ...identidad });
    expect((await pool.query('SELECT denominacion_farmacia FROM entrega_farmacia_periodo WHERE id=$1', [c.entrega.id])).rows[0].denominacion_farmacia).toBe('Titular A');
  });

  it('permite declarados, nuevas lecturas y borrado durante revisión; consulta señala necesidad de recalcular y actualiza la misma participación', async () => {
    const c = await conParticipacion();
    expect((await declarados(c.entrega.id)).status).toBe(200);
    expect((await lectura(c.entrega.id, c.med)).status).toBe(201);
    expect((await borrar(c.entrega.id, c.pr.id)).status).toBe(204);
    const consulta = await consultar(c.f); expect(consulta.body.requiere_recalculo).toBe(true);
    expect(consulta.body.importe_actual).toBe('50.00');
    const r = await calcular(c); expect(r.body.importe_total).toBe('50.00');
    expect(r.body.participaciones[0].id).toBe(c.p); expect(r.body.requiere_recalculo).toBe(false);
    const otra = await farmacia(c.town.id);
    const e = await entrega(otra, c.mes.id); await precinto(e.id, c.med, '1.00');
    expect((await consultar(c.f)).body.requiere_recalculo).toBe(true);
    expect((await calcular(c)).body.participaciones).toHaveLength(2);
  });

  it('retira solo la participación en revisión que deja de tener aptos y avisa si no queda ninguna', async () => {
    const c = await conParticipacion(); expect((await borrar(c.entrega.id, c.pr.id)).status).toBe(204);
    const r = await calcular(c); expect(r.body.participaciones).toEqual([]); expect(r.body.advertencia).toBeTruthy();
    expect((await pool.query('SELECT id FROM participacion_facturacion WHERE facturacion_id=$1', [c.f])).rows).toEqual([]);
  });

  it('revierte por completo si un importe individual excede NUMERIC(12,2)', async () => {
    const c = await preparar(), med = await medicamento();
    await precinto(c.entrega.id, med, '9999999999.99'); await precinto(c.entrega.id, med, '0.01', 2);
    expect((await calcular(c)).status).toBe(409);
    expect((await pool.query('SELECT id FROM facturacion WHERE ayuntamiento_id=$1', [c.town.id])).rows).toEqual([]);
  });

  it('dos cálculos concurrentes conservan una cabecera y una participación por entrega', async () => {
    const c = await preparar(), med = await medicamento(); await precinto(c.entrega.id, med, '0.10');
    const [a, b] = await Promise.all([calcular(c), calcular(c)]);
    expect(a.status).toBe(200); expect(b.status).toBe(200); expect(a.body).toEqual(b.body);
    expect((await pool.query('SELECT id FROM participacion_facturacion WHERE facturacion_id=$1', [a.body.facturacion_id])).rows).toHaveLength(1);
  });

  it('el cálculo que espera al bloqueo municipal incluye las lecturas confirmadas por el escritor anterior', async () => {
    const c = await conParticipacion(), escritor = await pool.connect();
    let pendiente;
    try {
      await escritor.query('BEGIN'); await escritor.query('SELECT id FROM ayuntamiento WHERE id=$1 FOR UPDATE', [c.town.id]);
      const pid = (await escritor.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await escritor.query(`INSERT INTO precinto (entrega_id, numero_paquete, posicion_paquete,
        codigo_barras_original, codigo_nacional, medicamento_id, precio_aplicado, precio_referencia)
        VALUES ($1, 1, 2, $2, $2, $3, 0.20, 0.20);`, [c.entrega.id, c.med.codigo_nacional, c.med.id]);
      pendiente = calcular(c).then((r) => r);
      await vi.waitFor(async () => {
        expect((await pool.query('SELECT pid FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))', [pid])).rowCount).toBeGreaterThan(0);
      }, { timeout: 4000, interval: 20 });
      await escritor.query('COMMIT');
      const r = await pendiente; expect(r.status).toBe(200); expect(r.body.importe_total).toBe('0.30');
      expect(r.body.cantidad_precintos).toBe(2); expect(r.body.participaciones[0].id).toBe(c.p);
    } finally { await escritor.query('ROLLBACK'); escritor.release(); if (pendiente) await pendiente; }
  });
});

describe('estado emitido y reapertura correctiva (emisión/cobros solo en fixtures SQL)', () => {
  it('emitida bloquea B, cálculo, declarados, registro, borrado y creación de otra entrega; las consultas siguen disponibles', async () => {
    const c = await conParticipacion(); await emitirFixture(c.f);
    expect((await editarB(c.f, c.p)).status).toBe(409); expect((await calcular(c)).status).toBe(409);
    expect((await declarados(c.entrega.id)).status).toBe(409); expect((await lectura(c.entrega.id, c.med)).status).toBe(409);
    expect((await borrar(c.entrega.id, c.pr.id)).status).toBe(409);
    const otra = await farmacia(c.town.id);
    expect((await request(app).post('/entregas').send({ farmacia_id: otra.id, periodo_id: c.mes.id })).status).toBe(409);
    expect((await consultar(c.f)).status).toBe(200);
  });

  it('reabre sin cobros con fecha/motivo, permite correcciones, conserva B y la participación incluso con cero aptos', async () => {
    const c = await conParticipacion(); await editarB(c.f, c.p); await emitirFixture(c.f);
    const r = await reabrir(c.f); expect(r.status).toBe(200); expect(r.body.estado).toBe('REABIERTA');
    const historial = (await pool.query('SELECT fecha_reapertura, motivo FROM reapertura_facturacion WHERE facturacion_id=$1', [c.f])).rows;
    expect(historial).toHaveLength(1); expect(historial[0].fecha_reapertura).toBeInstanceOf(Date);
    expect(historial[0].motivo).toBe('Corrección ficticia de lecturas');
    expect((await declarados(c.entrega.id)).status).toBe(200); expect((await lectura(c.entrega.id, c.med)).status).toBe(201);
    expect((await editarB(c.f, c.p)).status).toBe(409);
    await pool.query("UPDATE farmacia SET denominacion='Titular posterior' WHERE id=$1", [c.farm.id]);
    const actualizado = await calcular(c); expect(actualizado.body.importe_total).toBe('50.10');
    expect(actualizado.body.participaciones[0]).toMatchObject({ id: c.p, ...identidad });
    const registrados = (await pool.query('SELECT id FROM precinto WHERE entrega_id=$1', [c.entrega.id])).rows;
    for (const pr of registrados) expect((await borrar(c.entrega.id, pr.id)).status).toBe(204);
    const vacio = await calcular(c); expect(vacio.body.importe_total).toBe('0.00'); expect(vacio.body.advertencia).toBeTruthy();
    expect(vacio.body.participaciones[0]).toMatchObject({ id: c.p, ...identidad, cantidad_precintos: 0 });
    expect((await reabrir(c.f)).status).toBe(409);
  });

  it.each(['PRECINTOS', 'COMISION'])('cualquier cobro (%s) bloquea reapertura y todas las escrituras, conservando datos', async (tipo) => {
    const c = await conParticipacion(); await emitirFixture(c.f);
    const fs = await facturas(c.f);
    await insertar('cobro', `INSERT INTO cobro (factura_id, fecha_cobro, importe_cobrado) VALUES ($1, CURRENT_DATE, $2) RETURNING *;`, [fs[tipo].id, fs[tipo].importe_total]);
    expect((await reabrir(c.f)).status).toBe(409);
    expect((await pool.query('SELECT id FROM reapertura_facturacion WHERE facturacion_id=$1', [c.f])).rows).toEqual([]);
    // Defensa adicional ante un estado incoherente preparado por SQL externo.
    await pool.query("UPDATE facturacion SET estado='REABIERTA' WHERE id=$1", [c.f]);
    expect((await calcular(c)).status).toBe(409); expect((await editarB(c.f, c.p)).status).toBe(409);
    expect((await declarados(c.entrega.id)).status).toBe(409); expect((await borrar(c.entrega.id, c.pr.id)).status).toBe(409);
    expect((await lectura(c.entrega.id, c.med)).status).toBe(409);
  });

  it('reapertura rechaza nuevos participantes y no altera las participaciones históricas existentes', async () => {
    const c = await conParticipacion(); await editarB(c.f, c.p); await emitirFixture(c.f); await reabrir(c.f);
    const nueva = await farmacia(c.town.id), e = await entrega(nueva, c.mes.id); await precinto(e.id, c.med, '1.00');
    expect((await calcular(c)).status).toBe(409);
    const filas = (await pool.query('SELECT id, soe_b, denominacion_b, cif_b, importe_precintos FROM participacion_facturacion WHERE facturacion_id=$1', [c.f])).rows;
    expect(filas).toEqual([{ id: c.p, ...identidad, importe_precintos: '0.10' }]);
  });

  it('B que espera al bloqueo municipal comprueba de nuevo la emisión antes de escribir', async () => {
    const c = await conParticipacion(), cierre = await pool.connect();
    let pendiente;
    try {
      await cierre.query('BEGIN'); await cierre.query('SELECT id FROM ayuntamiento WHERE id=$1 FOR UPDATE', [c.town.id]);
      const pid = (await cierre.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      pendiente = editarB(c.f, c.p).then((r) => r);
      await vi.waitFor(async () => {
        expect((await pool.query('SELECT pid FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))', [pid])).rowCount).toBeGreaterThan(0);
      }, { timeout: 4000, interval: 20 });
      await emitirFixture(c.f, cierre); await cierre.query('COMMIT');
      expect((await pendiente).status).toBe(409);
    } finally { await cierre.query('ROLLBACK'); cierre.release(); if (pendiente) await pendiente; }
    expect((await consultar(c.f)).body.participaciones[0].denominacion_b).toBe('Titular A');
  });
});

describe('validación y destinos', () => {
  it.each([{}, { ayuntamiento_id: true, periodo_id: 1 }, { ayuntamiento_id: '1', periodo_id: 1 },
    { ayuntamiento_id: 1, periodo_id: 2147483648 }, { ayuntamiento_id: 1, periodo_id: 1, estado: 'EMITIDA' }])('rechaza cálculo inválido %j', async (body) => {
    expect((await request(app).post('/facturaciones/calculo').send(body)).status).toBe(400);
  });
  it('devuelve 404 para recursos inexistentes y no mezcla participaciones de otros procesos', async () => {
    const c = await conParticipacion(), otro = await conParticipacion();
    expect((await editarB(c.f, otro.p)).status).toBe(404);
    expect((await consultar(2147483647)).status).toBe(404); expect((await reabrir(2147483647)).status).toBe(404);
    expect((await calcular({ town: { id: 2147483647 }, mes: c.mes })).status).toBe(404);
    expect((await calcular({ town: c.town, mes: { id: 2147483647 } })).status).toBe(404);
  });
  it('valida B, motivo, IDs y queries; revisión inicial no puede reabrirse', async () => {
    const c = await conParticipacion();
    expect((await editarB(c.f, c.p, { ...identidad, cif_b: ' ' })).status).toBe(400);
    expect((await editarB(c.f, c.p, { ...identidad, importe_precintos: '0.00' })).status).toBe(400);
    expect((await reabrir(c.f, ' ')).status).toBe(400); expect((await reabrir(c.f)).status).toBe(409);
    expect((await request(app).get(`/facturaciones/${c.f}?extra=1`)).status).toBe(400);
    expect((await consultar('1e2')).status).toBe(400);
    await expect(pool.query("UPDATE facturacion SET estado='OTRO' WHERE id=$1", [c.f])).rejects.toMatchObject({ code: '23514', constraint: 'ck_facturacion_estado' });
  });
});
