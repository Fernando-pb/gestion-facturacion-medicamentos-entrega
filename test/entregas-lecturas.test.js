import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import pool from '../src/db.js';

const tablas = ['operacion_lectura', 'incidencia', 'precinto', 'facturacion', 'entrega_farmacia_periodo',
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
    RETURNING *;`, [`TEST-LECTURAS-${randomUUID()}`, modalidad]);
  const farmacia = await insertar('farmacia', `INSERT INTO farmacia
    (soe, cif_nif, denominacion, direccion, codigo_postal, localidad, provincia, ayuntamiento_id, cuenta_bancaria)
    VALUES ($1, 'TEST-CIF-0001', 'Farmacia ficticia evaluación', 'Calle', '28001', 'Villa', 'Madrid', $2, '1234567890')
    RETURNING *;`, [`TEST-LECTURAS-${randomUUID()}`, ayuntamiento.id]);
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
    [codigo, `TEST-LECTURAS-${randomUUID()}`, estado, situacion]);
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

const body = (codigo, opciones = {}) => ({ codigo_barras_original: codigo, clave_operacion: randomUUID(), ...opciones });
const guardar = (id, datos) => request(app).post(`/entregas/${id}/lecturas`).send(datos);
const recuperar = (id, clave) => request(app).get(`/entregas/${id}/operaciones/${clave}`);
const operaciones = async (id) => (await pool.query('SELECT * FROM operacion_lectura WHERE entrega_id = $1 ORDER BY id;', [id])).rows;
const confirmar = (motivo) => ({ tipo: 'CONFIRMAR_INCIDENCIA', motivo });
const facturar = (contexto, client = pool) => client.query(`INSERT INTO facturacion
  (ayuntamiento_id,periodo_id,tipo_facturacion,fecha_factura,estado) VALUES ($1,$2,'TD',CURRENT_DATE,'EMITIDA') RETURNING id;`,
[contexto.ayuntamiento.id, contexto.periodo.id]).then((r) => { ids.facturacion.push(r.rows[0].id); return r.rows[0]; });
const esperarBloqueo = async (pid) => {
  let bloqueado;
  await vi.waitFor(async () => {
    const filas = (await pool.query('SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid));', [pid])).rows;
    expect(filas.length).toBeGreaterThan(0);
    bloqueado = filas[0].pid;
  }, { timeout: 4000, interval: 20 });
  return bloqueado;
};

describe('guardado de lecturas y clave persistente', () => {
  it('guarda precio del servidor y datos mínimos; dos claves para un código son independientes', async () => {
    const { entrega } = await preparar();
    const med = await medicamento();
    const primera = await guardar(entrega.id, body(`847000${med.codigo_nacional}0`));
    const segunda = await guardar(entrega.id, body(med.codigo_nacional));
    expect(primera.status).toBe(201);
    expect(segunda.status).toBe(201);
    expect(primera.body).toEqual({ resultado: 'GUARDADO', clave_operacion: expect.any(String), tipo: 'PRECINTO',
      lectura: { id: expect.any(Number), entrega_id: entrega.id, codigo_barras_original: `847000${med.codigo_nacional}0`,
        codigo_nacional: med.codigo_nacional, medicamento_id: med.id, precio_aplicado: '12.34', precio_referencia: '12.34', numero_paquete: 1, posicion_paquete: 1 } });
    expect(segunda.body.lectura.posicion_paquete).toBe(2);
    expect(segunda.body.lectura.id).not.toBe(primera.body.lectura.id);
    expect(JSON.stringify(primera.body)).not.toMatch(/cuenta_bancaria|denominacion_farmacia|cif_nif/);
    expect((await operaciones(entrega.id)).length).toBe(2);
  });

  it.each(['MEDICAMENTO_DESCONOCIDO', 'MEDICAMENTO_INACTIVO', 'MEDICAMENTO_NO_AUTORIZADO'])
  ('exige confirmar %s, sin consumir clave pendiente ni ocupar paquete', async (motivo) => {
    const { entrega } = await preparar(motivo === 'MEDICAMENTO_NO_AUTORIZADO' ? 'ESPECIFICA' : 'GENERAL');
    const med = await medicamento(motivo === 'MEDICAMENTO_INACTIVO' ? 'INACTIVO' : 'ACTIVO');
    if (motivo === 'MEDICAMENTO_DESCONOCIDO') await pool.query('DELETE FROM medicamento WHERE id = $1;', [med.id]);
    const datos = body(med.codigo_nacional, { nuevo_paquete: true });
    const pendiente = await guardar(entrega.id, datos);
    expect(pendiente.status).toBe(200);
    expect(pendiente.body).toMatchObject({ resultado: 'DECISION_PENDIENTE', evaluacion: { resultado: 'INCIDENCIA', motivo } });
    expect(await operaciones(entrega.id)).toEqual([]);
    expect((await contenidoEntrega(entrega.id)).incidencias).toEqual([]);
    const confirmada = await guardar(entrega.id, { ...datos, decision: confirmar(motivo) });
    expect(confirmada.status).toBe(201);
    expect(confirmada.body).toMatchObject({ tipo: 'INCIDENCIA', lectura: { motivo } });
    expect(confirmada.body.lectura).not.toHaveProperty('numero_paquete');
    expect((await contenidoEntrega(entrega.id)).precintos).toEqual([]);
  });

  it.each(['ACEPTAR_BAJA', 'APARTAR_BAJA'])('BAJA autorizada exige y aplica %s', async (tipo) => {
    const { entrega, ayuntamiento } = await preparar('ESPECIFICA');
    const med = await medicamento('ACTIVO', 'BAJA');
    await asociar(ayuntamiento, med);
    const datos = body(med.codigo_nacional);
    expect((await guardar(entrega.id, datos)).body.resultado).toBe('DECISION_PENDIENTE');
    expect(await operaciones(entrega.id)).toEqual([]);
    const r = await guardar(entrega.id, { ...datos, decision: { tipo } });
    expect(r.status).toBe(201);
    expect(r.body.tipo).toBe(tipo === 'ACEPTAR_BAJA' ? 'PRECINTO' : 'INCIDENCIA');
    if (tipo === 'APARTAR_BAJA') expect(r.body.lectura.motivo).toBe('BAJA_COMERCIAL_RECHAZADA_USUARIO');
    else expect(r.body.lectura.precio_aplicado).toBe('12.34');
  });

  it.each(['INACTIVO', 'NO_AUTORIZADO'])('ACEPTAR_BAJA nunca elude %s', async (caso) => {
    const { entrega } = await preparar(caso === 'NO_AUTORIZADO' ? 'ESPECIFICA' : 'GENERAL');
    const med = await medicamento(caso === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO', 'BAJA');
    const r = await guardar(entrega.id, body(med.codigo_nacional, { decision: { tipo: 'ACEPTAR_BAJA' } }));
    expect(r.status).toBe(409);
    expect(r.body.resultado).toBe('CONFLICTO_CONDICIONES');
    expect(await operaciones(entrega.id)).toEqual([]);
    expect((await contenidoEntrega(entrega.id)).precintos).toEqual([]);
  });

  it('revalida precio y autorización después de evaluación, y rechaza un motivo que cambió', async () => {
    const { entrega, ayuntamiento } = await preparar();
    const med = await medicamento();
    expect((await evaluar(entrega.id, med.codigo_nacional)).body.resultado).toBe('ADMITIDO');
    await pool.query('UPDATE medicamento SET precio = 23.45 WHERE id = $1;', [med.id]);
    expect((await guardar(entrega.id, body(med.codigo_nacional))).body.lectura.precio_aplicado).toBe('23.45');
    await pool.query("UPDATE medicamento SET estado = 'INACTIVO' WHERE id = $1;", [med.id]);
    const datos = body(med.codigo_nacional, { decision: confirmar('MEDICAMENTO_INACTIVO') });
    expect((await evaluar(entrega.id, med.codigo_nacional)).body.motivo).toBe('MEDICAMENTO_INACTIVO');
    await pool.query("UPDATE medicamento SET estado = 'ACTIVO' WHERE id = $1;", [med.id]);
    await pool.query("UPDATE ayuntamiento SET tipo_lista_medicamentos = 'ESPECIFICA' WHERE id = $1;", [ayuntamiento.id]);
    const r = await guardar(entrega.id, datos);
    expect(r.status).toBe(409);
    expect(r.body.evaluacion.motivo).toBe('MEDICAMENTO_NO_AUTORIZADO');
    expect((await operaciones(entrega.id)).length).toBe(1);
  });

  it('una decisión BAJA deja de ser aplicable al pasar a ALTA', async () => {
    const { entrega } = await preparar();
    const med = await medicamento('ACTIVO', 'BAJA');
    await evaluar(entrega.id, med.codigo_nacional);
    await pool.query("UPDATE medicamento SET situacion_comercial = 'ALTA' WHERE id = $1;", [med.id]);
    expect((await guardar(entrega.id, body(med.codigo_nacional, { decision: { tipo: 'APARTAR_BAJA' } }))).status).toBe(409);
    expect(await operaciones(entrega.id)).toEqual([]);
  });

  it('recupera la misma lectura tras cambios de catálogo/facturación; nueva clave queda bloqueada', async () => {
    const contexto = await preparar();
    const med = await medicamento();
    const datos = body(med.codigo_nacional);
    const primera = await guardar(contexto.entrega.id, datos);
    await pool.query("UPDATE medicamento SET precio = 99.99, estado = 'INACTIVO' WHERE id = $1;", [med.id]);
    await facturar(contexto);
    const repetida = await guardar(contexto.entrega.id, datos);
    const consultada = await recuperar(contexto.entrega.id, datos.clave_operacion);
    expect(repetida.status).toBe(200);
    expect(consultada.status).toBe(200);
    expect(repetida.body).toEqual({ ...primera.body, resultado: 'RECUPERADO' });
    expect(consultada.body).toEqual(repetida.body);
    expect((await guardar(contexto.entrega.id, body(med.codigo_nacional))).body.resultado).toBe('BLOQUEADA_FACTURACION');
    expect((await evaluar(contexto.entrega.id, med.codigo_nacional)).status).toBe(200);
    expect((await operaciones(contexto.entrega.id)).length).toBe(1);
  });

  it.each(['codigo', 'decision', 'paquete'])('misma clave con otro %s produce conflicto sin escritura', async (caso) => {
    const { entrega } = await preparar();
    const med = await medicamento('ACTIVO', 'BAJA');
    const datos = body(med.codigo_nacional, { decision: { tipo: 'ACEPTAR_BAJA' } });
    expect((await guardar(entrega.id, datos)).status).toBe(201);
    const cambiado = { ...datos };
    if (caso === 'codigo') cambiado.codigo_barras_original = `847000${med.codigo_nacional}0`;
    if (caso === 'decision') cambiado.decision = { tipo: 'APARTAR_BAJA' };
    if (caso === 'paquete') cambiado.nuevo_paquete = true;
    const r = await guardar(entrega.id, cambiado);
    expect(r.status).toBe(409);
    expect(r.body.resultado).toBe('CONFLICTO_CLAVE');
    expect((await operaciones(entrega.id)).length).toBe(1);
  });

  it('el alcance de una clave es la entrega y normaliza mayúsculas del UUID', async () => {
    const primera = await preparar();
    const segunda = await preparar();
    const med = await medicamento();
    const datos = body(med.codigo_nacional);
    expect((await guardar(primera.entrega.id, datos)).status).toBe(201);
    expect((await guardar(segunda.entrega.id, datos)).status).toBe(201);
    expect((await guardar(primera.entrega.id, { ...datos, clave_operacion: datos.clave_operacion.toUpperCase(), decision: null, nuevo_paquete: false })).status).toBe(200);
  });

  it('serializa misma clave y distintas claves simultáneas sin duplicar ni colisionar posiciones', async () => {
    const { entrega } = await preparar();
    const med = await medicamento();
    const datos = body(med.codigo_nacional);
    const duplicadas = await Promise.all([guardar(entrega.id, datos), guardar(entrega.id, datos)]);
    expect(duplicadas.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(duplicadas[0].body.lectura).toEqual(duplicadas[1].body.lectura);
    const distintas = await Promise.all(Array.from({ length: 5 }, () => guardar(entrega.id, body(med.codigo_nacional))));
    expect(distintas.every((r) => r.status === 201)).toBe(true);
    expect(distintas.map((r) => r.body.lectura.posicion_paquete).sort()).toEqual([2, 3, 4, 5, 6]);
    expect((await operaciones(entrega.id)).length).toBe(6);
  });

  it('paquetes: inicial, posición 15 sin vacío, siguiente automático y nuevo expreso incompleto', async () => {
    const { entrega } = await preparar();
    const med = await medicamento();
    for (let posicion = 1; posicion <= 15; posicion++) {
      const r = await guardar(entrega.id, body(med.codigo_nacional));
      expect(r.status).toBe(201);
      expect(r.body.lectura).toMatchObject({ numero_paquete: 1, posicion_paquete: posicion });
    }
    expect(new Set((await contenidoEntrega(entrega.id)).precintos.map((r) => r.numero_paquete))).toEqual(new Set([1]));
    expect((await guardar(entrega.id, body(med.codigo_nacional))).body.lectura).toMatchObject({ numero_paquete: 2, posicion_paquete: 1 });
    expect((await guardar(entrega.id, body(med.codigo_nacional, { nuevo_paquete: true }))).body.lectura)
      .toMatchObject({ numero_paquete: 3, posicion_paquete: 1 });
    await pool.query("UPDATE medicamento SET estado = 'INACTIVO' WHERE id = $1;", [med.id]);
    expect((await guardar(entrega.id, body(med.codigo_nacional, { nuevo_paquete: true, decision: confirmar('MEDICAMENTO_INACTIVO') }))).status).toBe(201);
    await pool.query("UPDATE medicamento SET estado = 'ACTIVO' WHERE id = $1;", [med.id]);
    expect((await guardar(entrega.id, body(med.codigo_nacional))).body.lectura).toMatchObject({ numero_paquete: 3, posicion_paquete: 2 });
  });

  it('usa MAX de paquete sin rellenar huecos anteriores', async () => {
    const { entrega } = await preparar();
    const med = await medicamento();
    await pool.query(`INSERT INTO precinto (entrega_id,numero_paquete,posicion_paquete,codigo_barras_original,codigo_nacional,medicamento_id,precio_aplicado, precio_referencia)
      VALUES ($1, 7, 1, $2, $2, $3, 1.00, 1.00)`, [entrega.id, med.codigo_nacional, med.id]);
    expect((await guardar(entrega.id, body(med.codigo_nacional, { nuevo_paquete: true }))).body.lectura)
      .toMatchObject({ numero_paquete: 8, posicion_paquete: 1 });
  });

  it.each([{}, { codigo_barras_original: '001234' }, { codigo_barras_original: 123456, clave_operacion: randomUUID() },
    body('bad'), body('001234', { clave_operacion: 'bad' }), body('001234', { precio_aplicado: '1.00' }),
    body('001234', { nuevo_paquete: 'true' }), body('001234', { decision: { tipo: 'ACEPTAR_BAJA', motivo: 'falso' } }),
    body('001234', { decision: { tipo: 'CONFIRMAR_INCIDENCIA' } }),
  ])('rechaza datos inválidos %j', async (datos) => {
    expect((await guardar(1, datos)).status).toBe(400);
  });
  it('rechaza ID inválido, entrega u operación ausente y parámetros de consulta inesperados', async () => {
    expect((await guardar('abc', body('001234'))).status).toBe(400);
    expect((await guardar(2147483647, body('001234'))).status).toBe(404);
    expect((await recuperar(2147483647, randomUUID())).status).toBe(404);
    const { entrega } = await preparar();
    expect((await recuperar(entrega.id, randomUUID())).status).toBe(404);
    expect((await recuperar(entrega.id, 'bad')).status).toBe(400);
    expect((await recuperar('0', randomUUID())).status).toBe(400);
    expect((await recuperar(entrega.id, randomUUID()).query({ extra: true })).status).toBe(400);
  });

  it('revierte lectura si falla el recibo y permite repetir la clave sin restos', async () => {
    const { entrega } = await preparar();
    const med = await medicamento();
    const datos = body(med.codigo_nacional);
    // Inyección de fallo solo en esta llamada al cliente real, después del INSERT de lectura.
    const connect = pool.connect.bind(pool);
    const espia = vi.spyOn(pool, 'connect').mockImplementationOnce(async () => {
      const client = await connect();
      const query = client.query.bind(client);
      const original = client.query;
      const release = client.release.bind(client);
      client.query = (sql, ...args) => /INSERT INTO operacion_lectura/.test(sql)
        ? Promise.reject(new Error('Fallo ficticio de protección')) : query(sql, ...args);
      client.release = (...args) => { client.query = original; release(...args); };
      return client;
    });
    try {
      const r = await guardar(entrega.id, datos);
      expect(r.status).toBe(500);
    } finally { espia.mockRestore(); }
    expect(await operaciones(entrega.id)).toEqual([]);
    expect((await contenidoEntrega(entrega.id)).precintos).toEqual([]);
    expect((await guardar(entrega.id, datos)).status).toBe(201);
  });
});

describe('bloqueos de guardado con conexiones independientes', () => {
  it('misma clave concurrente espera y recupera el único resultado confirmado', async () => {
    const { entrega } = await preparar();
    const med = await medicamento();
    const barrera = await pool.connect();
    let primera;
    let segunda;
    try {
      await barrera.query('BEGIN');
      const pid = (await barrera.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await barrera.query('SELECT id FROM entrega_farmacia_periodo WHERE id=$1 FOR UPDATE', [entrega.id]);
      const datos = body(med.codigo_nacional);
      primera = guardar(entrega.id, datos).then((r) => r);
      const pidPrimera = await esperarBloqueo(pid);
      segunda = guardar(entrega.id, datos).then((r) => r);
      await esperarBloqueo(pidPrimera);
      await barrera.query('COMMIT');
      const a = await primera;
      const b = await segunda;
      expect(a.status).toBe(201);
      expect(b.status).toBe(200);
      expect(b.body.lectura).toEqual(a.body.lectura);
      expect((await operaciones(entrega.id)).length).toBe(1);
    } finally { await barrera.query('ROLLBACK'); if (primera) await primera; if (segunda) await segunda; barrera.release(); }
  });

  it('una retirada específica previa se confirma antes de evaluar el guardado', async () => {
    const { entrega, ayuntamiento } = await preparar('ESPECIFICA');
    const med = await medicamento();
    await asociar(ayuntamiento, med);
    const lista = await pool.connect();
    let pendiente;
    try {
      await lista.query('BEGIN');
      const pid = (await lista.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await lista.query('SELECT id FROM ayuntamiento WHERE id=$1 FOR KEY SHARE', [ayuntamiento.id]);
      await lista.query('SELECT id FROM medicamento WHERE id=$1 FOR KEY SHARE', [med.id]);
      await lista.query('DELETE FROM ayuntamiento_medicamento WHERE ayuntamiento_id=$1 AND medicamento_id=$2', [ayuntamiento.id, med.id]);
      pendiente = guardar(entrega.id, body(med.codigo_nacional)).then((r) => r);
      await esperarBloqueo(pid);
      await lista.query('COMMIT');
      expect((await pendiente).body.evaluacion.motivo).toBe('MEDICAMENTO_NO_AUTORIZADO');
      expect(await operaciones(entrega.id)).toEqual([]);
    } finally { await lista.query('ROLLBACK'); if (pendiente) await pendiente; lista.release(); }
  });

  it.each(['lista', 'asignacion'])('el guardado primero hace esperar la retirada de %s sin interbloqueo', async (caso) => {
    const { entrega, ayuntamiento, farmacia } = await preparar('ESPECIFICA');
    const med = await medicamento();
    await asociar(ayuntamiento, med);
    const barrera = await pool.connect();
    let guardado;
    let retirada;
    try {
      await barrera.query('BEGIN');
      const pid = (await barrera.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await barrera.query('SELECT id FROM entrega_farmacia_periodo WHERE id=$1 FOR UPDATE', [entrega.id]);
      guardado = guardar(entrega.id, body(med.codigo_nacional)).then((r) => r);
      const pidGuardado = await esperarBloqueo(pid);
      retirada = request(app).delete(caso === 'lista'
        ? `/ayuntamientos/${ayuntamiento.id}/medicamentos/${med.id}`
        : `/ayuntamientos/${ayuntamiento.id}/farmacias/${farmacia.id}`).then((r) => r);
      await esperarBloqueo(pidGuardado);
      await barrera.query('COMMIT');
      expect((await guardado).status).toBe(201);
      expect((await retirada).status).toBe(caso === 'lista' ? 204 : 409);
      expect((await contenidoEntrega(entrega.id)).precintos.length).toBe(1);
    } finally { await barrera.query('ROLLBACK'); if (guardado) await guardado; if (retirada) await retirada; barrera.release(); }
  });

  it('el cierre primero bloquea la nueva lectura después de esperar su commit', async () => {
    const contexto = await preparar();
    const med = await medicamento();
    const cierre = await pool.connect();
    let pendiente;
    try {
      await cierre.query('BEGIN');
      const pid = (await cierre.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await cierre.query('SELECT id FROM ayuntamiento WHERE id = $1 FOR UPDATE', [contexto.ayuntamiento.id]);
      await facturar(contexto, cierre);
      pendiente = guardar(contexto.entrega.id, body(med.codigo_nacional)).then((r) => r);
      await esperarBloqueo(pid);
      await cierre.query('COMMIT');
      expect((await pendiente).body.resultado).toBe('BLOQUEADA_FACTURACION');
      expect(await operaciones(contexto.entrega.id)).toEqual([]);
    } finally { await cierre.query('ROLLBACK'); if (pendiente) await pendiente; cierre.release(); }
  });

  it('el guardado primero hace esperar al cierre, que ve la lectura y bloquea nuevas claves', async () => {
    const contexto = await preparar();
    const med = await medicamento();
    const barrera = await pool.connect();
    const cierre = await pool.connect();
    let pendiente;
    let cierrePendiente;
    try {
      await barrera.query('BEGIN');
      const pid = (await barrera.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await barrera.query('SELECT id FROM entrega_farmacia_periodo WHERE id = $1 FOR UPDATE', [contexto.entrega.id]);
      const datos = body(med.codigo_nacional);
      pendiente = guardar(contexto.entrega.id, datos).then((r) => r);
      const pidEscritura = await esperarBloqueo(pid);
      await cierre.query('BEGIN');
      cierrePendiente = cierre.query('SELECT id FROM ayuntamiento WHERE id = $1 FOR UPDATE', [contexto.ayuntamiento.id]);
      await esperarBloqueo(pidEscritura);
      await barrera.query('COMMIT');
      expect((await pendiente).status).toBe(201);
      await cierrePendiente;
      expect((await cierre.query('SELECT count(*)::int AS n FROM precinto WHERE entrega_id = $1', [contexto.entrega.id])).rows[0].n).toBe(1);
      await facturar(contexto, cierre);
      await cierre.query('COMMIT');
      expect((await guardar(contexto.entrega.id, datos)).status).toBe(200);
      expect((await guardar(contexto.entrega.id, body(med.codigo_nacional))).status).toBe(409);
    } finally {
      await barrera.query('ROLLBACK'); if (pendiente) await pendiente;
      await cierre.query('ROLLBACK'); if (cierrePendiente) await cierrePendiente;
      barrera.release(); cierre.release();
    }
  });

  it('dos claves esperan la misma barrera y asignan posiciones distintas', async () => {
    const { entrega } = await preparar();
    const med = await medicamento();
    const barrera = await pool.connect();
    let pendientes;
    try {
      await barrera.query('BEGIN');
      const pid = (await barrera.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await barrera.query('SELECT id FROM entrega_farmacia_periodo WHERE id=$1 FOR UPDATE', [entrega.id]);
      pendientes = Promise.all([guardar(entrega.id, body(med.codigo_nacional)), guardar(entrega.id, body(med.codigo_nacional))]);
      await esperarBloqueo(pid);
      await barrera.query('COMMIT');
      const respuestas = await pendientes;
      expect(respuestas.map((r) => r.status)).toEqual([201, 201]);
      expect(respuestas.map((r) => r.body.lectura.posicion_paquete).sort()).toEqual([1, 2]);
    } finally { await barrera.query('ROLLBACK'); if (pendientes) await pendientes; barrera.release(); }
  });

  it('espera actualización de medicamento y copia el precio confirmado', async () => {
    const { entrega } = await preparar();
    const med = await medicamento();
    const catalogo = await pool.connect();
    let pendiente;
    try {
      await catalogo.query('BEGIN');
      const pid = (await catalogo.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await catalogo.query('UPDATE medicamento SET precio=45.67 WHERE id=$1', [med.id]);
      pendiente = guardar(entrega.id, body(med.codigo_nacional)).then((r) => r);
      await esperarBloqueo(pid);
      await catalogo.query('COMMIT');
      const r = await pendiente;
      expect(r.status).toBe(201);
      expect(r.body.lectura.precio_aplicado).toBe('45.67');
    } finally { await catalogo.query('ROLLBACK'); if (pendiente) await pendiente; catalogo.release(); }
  });
});
