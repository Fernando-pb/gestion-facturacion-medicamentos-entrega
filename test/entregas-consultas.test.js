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
    RETURNING *;`, [`TEST-CONSULTAS-${randomUUID()}`, modalidad]);
  const farmacia = await insertar('farmacia', `INSERT INTO farmacia
    (soe, cif_nif, denominacion, direccion, codigo_postal, localidad, provincia, ayuntamiento_id, cuenta_bancaria)
    VALUES ($1, 'TEST-CIF-0001', 'Farmacia ficticia evaluación', 'Calle', '28001', 'Villa', 'Madrid', $2, '1234567890')
    RETURNING *;`, [`TEST-CONSULTAS-${randomUUID()}`, ayuntamiento.id]);
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
    [codigo, `TEST-CONSULTAS-${randomUUID()}`, estado, situacion]);
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
  // Las claves retiradas ya no hacen cascada desde la lectura: limpiar solo
  // operaciones de las entregas ficticias de esta prueba antes de su entrega.
  await pool.query('DELETE FROM operacion_lectura WHERE entrega_id = ANY($1::int[]);', [ids.entrega_farmacia_periodo]);
  // También recoge un registro inesperado del endpoint, siempre dentro de entregas propias.
  for (const tabla of ['incidencia', 'precinto']) {
    await pool.query(`DELETE FROM ${tabla} WHERE entrega_id = ANY($1::int[]);`, [ids.entrega_farmacia_periodo]);
  }
  for (const tabla of tablas) {
    await pool.query(`DELETE FROM ${tabla} WHERE id = ANY($1::int[]);`, [ids[tabla]]);
  }
});
afterAll(async () => pool.end());

const consultar = (id, recurso = 'resumen') => request(app).get(`/entregas/${id}/${recurso}`);

describe('listado neutral de entregas registradas', () => {
  it('ordena por Ayuntamiento/SOE textual, filtra periodo y conserva snapshots sin clasificar facturación', async () => {
    const a = await preparar(), b = await preparar(), c = await preparar();
    await pool.query('UPDATE ayuntamiento SET denominacion=$1 WHERE id=$2', ['AA-' + randomUUID(), a.ayuntamiento.id]);
    await pool.query('UPDATE ayuntamiento SET denominacion=$1 WHERE id=$2', ['ZZ-' + randomUUID(), b.ayuntamiento.id]);
    await pool.query('UPDATE farmacia SET soe=$1, ayuntamiento_id=$2, denominacion=$3 WHERE id=$4', ['001-' + randomUUID(), a.ayuntamiento.id, 'Titular actual distinto', c.farmacia.id]);
    await pool.query('UPDATE farmacia SET soe=$1 WHERE id=$2', ['002-' + randomUUID(), a.farmacia.id]);
    await pool.query('UPDATE entrega_farmacia_periodo SET periodo_id=$1 WHERE id=ANY($2::int[])', [a.periodo.id, [b.entrega.id, c.entrega.id]]);
    await facturar(a);
    const respuesta = await request(app).get('/entregas/registradas').query({ periodo_id: a.periodo.id });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.map((e) => e.id)).toEqual([c.entrega.id, a.entrega.id, b.entrega.id]);
    for (const e of respuesta.body) {
      expect(e.admitidos).toBe(0); expect(e.subtotal_facturable).toBe('0.00');
      expect(e.denominacion_farmacia).toBe('Farmacia ficticia evaluación');
      expect(e).not.toHaveProperty('estado'); expect(e).not.toHaveProperty('facturada'); expect(e).not.toHaveProperty('cuenta_bancaria');
    }
    expect((await request(app).get('/entregas/registradas').query({ periodo_id: b.periodo.id })).body).toEqual([]);
    const todas = await request(app).get('/entregas/registradas');
    expect(todas.status).toBe(200); expect(todas.body.filter((e) => [a.entrega.id, b.entrega.id, c.entrega.id].includes(e.id))).toHaveLength(3);
  });
  it('suma precios aplicados exactos sin incidencias ni declarados ni precio actual, y no modifica registros', async () => {
    const contexto = await prepararLecturas();
    await pool.query('UPDATE medicamento SET precio=99.99 WHERE id=$1', [contexto.med.id]);
    const incidencia = await insertar('incidencia', `INSERT INTO incidencia (entrega_id,codigo_barras_original,codigo_nacional,motivo)
      VALUES ($1,'000000','000000','MEDICAMENTO_DESCONOCIDO') RETURNING id`, [contexto.entrega.id]);
    expect(incidencia.id).toBeGreaterThan(0);
    const antes = await contenidoEntrega(contexto.entrega.id);
    const r = await request(app).get('/entregas/registradas').query({ periodo_id: contexto.periodo.id });
    expect(r.status).toBe(200); expect(r.body[0].admitidos).toBe(4); expect(r.body[0].subtotal_facturable).toBe('49.36');
    expect(await contenidoEntrega(contexto.entrega.id)).toEqual(antes);
  });
  it.each(['periodo_id=0', 'periodo_id=-1', 'periodo_id=1.2', 'periodo_id=2147483648', 'periodo_id=', 'periodo_id=1&periodo_id=2', 'estado=PENDIENTE'])('rechaza filtro inválido %s', async (query) => {
    expect((await request(app).get(`/entregas/registradas?${query}`)).status).toBe(400);
  });
});
const guardar = (id, codigo, opciones = {}) => request(app).post(`/entregas/${id}/lecturas`)
  .send({ codigo_barras_original: codigo, clave_operacion: randomUUID(), ...opciones });
const borrar = (id, lectura, recurso = 'precintos') => request(app).delete(`/entregas/${id}/${recurso}/${lectura}`);
const prepararLecturas = async () => {
  const contexto = await preparar();
  const med = await medicamento();
  const lecturas = [];
  for (let i = 0; i < 3; i++) {
    const r = await guardar(contexto.entrega.id, med.codigo_nacional);
    expect(r.status).toBe(201);
    lecturas.push(r.body);
  }
  const otro = await guardar(contexto.entrega.id, med.codigo_nacional, { nuevo_paquete: true });
  expect(otro.status).toBe(201);
  return { ...contexto, med, lecturas, otro: otro.body };
};
const retirar = async (entregaId, lecturaId) => {
  const r = await borrar(entregaId, lecturaId);
  expect(r.status).toBe(204);
};
const operacion = (id, clave) => request(app).get(`/entregas/${id}/operaciones/${clave}`);
const repetir = (id, guardada) => request(app).post(`/entregas/${id}/lecturas`).send({
  codigo_barras_original: guardada.lectura.codigo_barras_original, clave_operacion: guardada.clave_operacion,
});
const esperarBloqueo = async (pid) => {
  let bloqueado;
  await vi.waitFor(async () => {
    const filas = (await pool.query('SELECT pid FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))', [pid])).rows;
    expect(filas.length).toBeGreaterThan(0);
    bloqueado = filas[0].pid;
  }, { timeout: 4000, interval: 20 });
  return bloqueado;
};
const facturar = async (contexto, client = pool) => {
  const row = (await client.query(`INSERT INTO facturacion (ayuntamiento_id,periodo_id,tipo_facturacion,fecha_factura,estado)
    VALUES ($1,$2,'TD',CURRENT_DATE,'EMITIDA') RETURNING id`, [contexto.ayuntamiento.id, contexto.periodo.id])).rows[0];
  ids.facturacion.push(row.id);
};

describe('consultas históricas y resumen exacto', () => {
  it('entrega vacía: listas vacías, cero monetario y diferencias NULL/cero', async () => {
    const { entrega } = await preparar();
    await pool.query('UPDATE entrega_farmacia_periodo SET precintos_informados=NULL,importe_informado=NULL WHERE id=$1', [entrega.id]);
    for (const recurso of ['precintos', 'incidencias']) expect((await consultar(entrega.id, recurso)).body).toEqual([]);
    const r = await consultar(entrega.id);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ entrega_id: entrega.id, precintos_informados: null, importe_informado: null,
      admitidos: 0, incidencias: 0, total_registrado: 0, subtotal_facturable: '0.00',
      diferencia_cantidad: null, diferencia_importe: null, paquetes: [] });
    await pool.query('UPDATE entrega_farmacia_periodo SET precintos_informados=0,importe_informado=0 WHERE id=$1', [entrega.id]);
    expect((await consultar(entrega.id)).body).toMatchObject({ diferencia_cantidad: 0, diferencia_importe: '0.00' });
  });

  it('ordena lecturas por paquete/posición y separa incidencias sin multiplicar sumas', async () => {
    const { entrega, med, lecturas, otro } = await prepararLecturas();
    await pool.query('UPDATE medicamento SET precio=99.99,descripcion=$1 WHERE id=$2', ['Descripción actual distinta', med.id]);
    for (let i = 0; i < 2; i++) await insertar('incidencia', `INSERT INTO incidencia
      (entrega_id,codigo_barras_original,codigo_nacional,motivo) VALUES ($1,'000000',NULL,'MEDICAMENTO_DESCONOCIDO') RETURNING *`, [entrega.id]);
    const precintos = await consultar(entrega.id, 'precintos');
    expect(precintos.status).toBe(200);
    expect(precintos.body).toEqual([...lecturas, otro].map((r) => r.lectura));
    expect(precintos.body.every((r) => r.precio_aplicado === '12.34' && !('descripcion' in r))).toBe(true);
    const incidencias = await consultar(entrega.id, 'incidencias');
    expect(incidencias.body.length).toBe(2);
    expect(incidencias.body.map((r) => r.id)).toEqual([...ids.incidencia].sort((a, b) => a - b));
    expect(incidencias.body.every((r) => !('precio_aplicado' in r) && !('numero_paquete' in r))).toBe(true);
    expect((await consultar(entrega.id)).body).toMatchObject({ admitidos: 4, incidencias: 2, total_registrado: 6,
      subtotal_facturable: '49.36', diferencia_cantidad: -1, diferencia_importe: '34.11',
      paquetes: [{ numero_paquete: 1, precintos: 3, subtotal_facturable: '37.02' },
        { numero_paquete: 2, precintos: 1, subtotal_facturable: '12.34' }] });
  });

  it('exactitud decimal y diferencias positivas/negativas, sin redondear en JavaScript', async () => {
    const { entrega } = await preparar();
    const med = await medicamento();
    for (const precio of ['0.10', '0.20']) {
      await pool.query('UPDATE medicamento SET precio=$1 WHERE id=$2', [precio, med.id]);
      expect((await guardar(entrega.id, med.codigo_nacional)).status).toBe(201);
    }
    for (const [cantidad, importe, esperadoCantidad, esperadoImporte] of [
      [0, '0.00', 2, '0.30'], [3, '0.31', -1, '-0.01'], [2, '0.30', 0, '0.00'],
    ]) {
      await pool.query('UPDATE entrega_farmacia_periodo SET precintos_informados=$1,importe_informado=$2 WHERE id=$3', [cantidad, importe, entrega.id]);
      expect((await consultar(entrega.id)).body).toMatchObject({ subtotal_facturable: '0.30',
        diferencia_cantidad: esperadoCantidad, diferencia_importe: esperadoImporte });
    }
  });

  it.each(['precintos', 'incidencias', 'resumen'])('rechaza IDs/query inválidos y entrega inexistente en %s', async (recurso) => {
    expect((await consultar('abc', recurso)).status).toBe(400);
    expect((await consultar(0, recurso)).status).toBe(400);
    expect((await consultar(2147483648, recurso)).status).toBe(400);
    expect((await consultar(2147483647, recurso)).status).toBe(404);
    expect((await consultar(1, recurso).query({ otro: true })).status).toBe(400);
  });

  it('consultas disponibles con facturación, sin modificar registros ni exponer datos bancarios', async () => {
    const contexto = await prepararLecturas();
    await facturar(contexto);
    const antes = await contenidoEntrega(contexto.entrega.id);
    for (const recurso of ['precintos', 'incidencias', 'resumen']) {
      const r = await consultar(contexto.entrega.id, recurso);
      expect(r.status).toBe(200);
      expect(JSON.stringify(r.body)).not.toMatch(/cuenta_bancaria|cif_nif|solicitud/);
    }
    expect(await contenidoEntrega(contexto.entrega.id)).toEqual(antes);
  });
});

describe('eliminación física, renumeración local y claves retiradas aprobadas', () => {
  it.each([0, 1, 2])('elimina posición %i conservando IDs y otros paquetes; recibos reflejan posición actual', async (indice) => {
    const { entrega, lecturas, otro } = await prepararLecturas();
    await retirar(entrega.id, lecturas[indice].lectura.id);
    const restantes = lecturas.filter((_, i) => i !== indice).map((r, i) => ({ ...r.lectura, posicion_paquete: i + 1 }));
    expect((await consultar(entrega.id, 'precintos')).body).toEqual([...restantes, otro.lectura]);
    for (const lectura of restantes) {
      const original = lecturas.find((r) => r.lectura.id === lectura.id);
      expect((await repetir(entrega.id, original)).body.lectura).toEqual(lectura);
      expect((await operacion(entrega.id, original.clave_operacion)).body.lectura).toEqual(lectura);
    }
    expect((await consultar(entrega.id)).body).toMatchObject({ admitidos: 3, subtotal_facturable: '37.02' });
  });

  it('la clave retirada carece de contenido y rechaza cualquier repetición tardía', async () => {
    const { entrega, lecturas } = await prepararLecturas();
    const original = lecturas[0];
    await retirar(entrega.id, original.lectura.id);
    const fila = (await pool.query('SELECT * FROM operacion_lectura WHERE entrega_id=$1 AND clave=$2', [entrega.id, original.clave_operacion])).rows[0];
    expect(fila).toEqual({ id: expect.any(Number), entrega_id: entrega.id, clave: original.clave_operacion,
      retirada: true, solicitud: null, precinto_id: null, incidencia_id: null });
    const tardia = await repetir(entrega.id, original);
    expect(tardia.status).toBe(409);
    expect(tardia.body).toEqual({ resultado: 'OPERACION_RETIRADA', clave_operacion: original.clave_operacion });
    const consulta = await operacion(entrega.id, original.clave_operacion);
    expect(consulta.status).toBe(410);
    expect(consulta.body).toEqual(tardia.body);
    expect((await consultar(entrega.id)).body.admitidos).toBe(3);
    expect((await repetir(entrega.id, { ...original, lectura: { codigo_barras_original: '000000' } })).status).toBe(409);
  });

  it('desaparece paquete vaciado y el próximo expreso usa MAX+1 o 1 si no hay', async () => {
    const { entrega, med, lecturas, otro } = await prepararLecturas();
    for (const lectura of lecturas) await retirar(entrega.id, lectura.lectura.id);
    expect((await consultar(entrega.id)).body.paquetes).toEqual([{ numero_paquete: 2, precintos: 1, subtotal_facturable: '12.34' }]);
    const nueva = await guardar(entrega.id, med.codigo_nacional, { nuevo_paquete: true });
    expect(nueva.body.lectura.numero_paquete).toBe(3);
    await retirar(entrega.id, otro.lectura.id);
    await retirar(entrega.id, nueva.body.lectura.id);
    expect((await consultar(entrega.id)).body.paquetes).toEqual([]);
    expect((await guardar(entrega.id, med.codigo_nacional)).body.lectura).toMatchObject({ numero_paquete: 1, posicion_paquete: 1 });
  });

  it('eliminar incidencia actualiza totales sin tocar posiciones y retira su clave', async () => {
    const { entrega, med } = await prepararLecturas();
    await pool.query("UPDATE medicamento SET estado='INACTIVO' WHERE id=$1", [med.id]);
    const incidencia = await guardar(entrega.id, med.codigo_nacional, { decision: { tipo: 'CONFIRMAR_INCIDENCIA', motivo: 'MEDICAMENTO_INACTIVO' } });
    expect(incidencia.status).toBe(201);
    const antes = (await consultar(entrega.id, 'precintos')).body;
    expect((await borrar(entrega.id, incidencia.body.lectura.id, 'incidencias')).status).toBe(204);
    expect((await consultar(entrega.id, 'precintos')).body).toEqual(antes);
    expect((await consultar(entrega.id)).body).toMatchObject({ admitidos: 4, incidencias: 0, total_registrado: 4 });
    expect((await operacion(entrega.id, incidencia.body.clave_operacion)).status).toBe(410);
  });

  it('pertenencia incorrecta, ID inexistente/inválido y propiedades adicionales no borran', async () => {
    const a = await prepararLecturas();
    const b = await preparar();
    const id = a.lecturas[0].lectura.id;
    expect((await borrar(b.entrega.id, id)).status).toBe(404);
    expect((await borrar(2147483647, id)).status).toBe(404);
    expect((await borrar(a.entrega.id, 2147483647)).status).toBe(404);
    expect((await borrar(a.entrega.id, 'abc')).status).toBe(400);
    expect((await borrar('0', id)).status).toBe(400);
    expect((await borrar(a.entrega.id, id).query({ extra: true })).status).toBe(400);
    expect((await borrar(a.entrega.id, id).send({ clave_operacion: randomUUID() })).status).toBe(400);
    expect((await consultar(a.entrega.id)).body.admitidos).toBe(4);
  });

  it('facturación bloquea ambos borrados y preserva contenido/protección', async () => {
    const contexto = await prepararLecturas();
    const incidencia = await insertar('incidencia', `INSERT INTO incidencia (entrega_id,codigo_barras_original,motivo)
      VALUES ($1,'000000','MEDICAMENTO_DESCONOCIDO') RETURNING *`, [contexto.entrega.id]);
    const antes = await contenidoEntrega(contexto.entrega.id);
    await facturar(contexto);
    expect((await borrar(contexto.entrega.id, contexto.lecturas[0].lectura.id)).status).toBe(409);
    expect((await borrar(contexto.entrega.id, incidencia.id, 'incidencias')).status).toBe(409);
    expect(await contenidoEntrega(contexto.entrega.id)).toEqual(antes);
    expect((await operacion(contexto.entrega.id, contexto.lecturas[0].clave_operacion)).status).toBe(200);
  });

  it('rollback después de borrar evita purga o renumeración parcial', async () => {
    const { entrega, lecturas } = await prepararLecturas();
    const antes = await contenidoEntrega(entrega.id);
    const connect = pool.connect.bind(pool);
    const espia = vi.spyOn(pool, 'connect').mockImplementationOnce(async () => {
      const client = await connect();
      const query = client.query.bind(client);
      const original = client.query;
      const release = client.release.bind(client);
      client.query = (sql, ...args) => /^UPDATE precinto SET posicion_paquete/.test(sql)
        ? Promise.reject(new Error('Fallo ficticio renumeración')) : query(sql, ...args);
      client.release = (...args) => { client.query = original; release(...args); };
      return client;
    });
    try { expect((await borrar(entrega.id, lecturas[0].lectura.id)).status).toBe(500); }
    finally { espia.mockRestore(); }
    expect(await contenidoEntrega(entrega.id)).toEqual(antes);
    expect((await operacion(entrega.id, lecturas[0].clave_operacion)).status).toBe(200);
  });
});

describe('consultas y eliminación concurrentes con protocolo común', () => {
  it('guardado primero hace esperar al borrado, que conserva la nueva lectura y renumera solo su paquete', async () => {
    const { entrega, med, lecturas } = await prepararLecturas();
    const barrera = await pool.connect();
    let escritura;
    let eliminacion;
    try {
      await barrera.query('BEGIN');
      const pid = (await barrera.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await barrera.query('SELECT id FROM entrega_farmacia_periodo WHERE id=$1 FOR UPDATE', [entrega.id]);
      escritura = guardar(entrega.id, med.codigo_nacional).then((r) => r);
      const pidEscritura = await esperarBloqueo(pid);
      eliminacion = borrar(entrega.id, lecturas[0].lectura.id).then((r) => r);
      await esperarBloqueo(pidEscritura);
      await barrera.query('COMMIT');
      const nueva = await escritura;
      expect(nueva.status).toBe(201);
      expect((await eliminacion).status).toBe(204);
      const filas = (await consultar(entrega.id, 'precintos')).body;
      expect(filas.find((r) => r.id === nueva.body.lectura.id)).toEqual(nueva.body.lectura);
      expect(filas.filter((r) => r.numero_paquete === 1).map((r) => r.posicion_paquete)).toEqual([1, 2]);
    } finally { await barrera.query('ROLLBACK'); if (escritura) await escritura; if (eliminacion) await eliminacion; barrera.release(); }
  });

  it('dos borrados de entradas del mismo paquete serializan la renumeración', async () => {
    const { entrega, lecturas } = await prepararLecturas();
    const barrera = await pool.connect();
    let primera;
    let segunda;
    try {
      await barrera.query('BEGIN');
      const pid = (await barrera.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await barrera.query('SELECT id FROM entrega_farmacia_periodo WHERE id=$1 FOR UPDATE', [entrega.id]);
      primera = borrar(entrega.id, lecturas[0].lectura.id).then((r) => r);
      const pidPrimera = await esperarBloqueo(pid);
      segunda = borrar(entrega.id, lecturas[1].lectura.id).then((r) => r);
      await esperarBloqueo(pidPrimera);
      await barrera.query('COMMIT');
      expect((await primera).status).toBe(204);
      expect((await segunda).status).toBe(204);
      expect((await consultar(entrega.id, 'precintos')).body.filter((r) => r.numero_paquete === 1))
        .toEqual([{ ...lecturas[2].lectura, posicion_paquete: 1 }]);
    } finally { await barrera.query('ROLLBACK'); if (primera) await primera; if (segunda) await segunda; barrera.release(); }
  });

  it('resumen ve un único snapshot antes y después de un guardado sin commit', async () => {
    const { entrega } = await preparar();
    const med = await medicamento();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM ayuntamiento WHERE id=$1 FOR UPDATE', [(await pool.query('SELECT ayuntamiento_id FROM farmacia WHERE id=$1', [entrega.farmacia_id])).rows[0].ayuntamiento_id]);
      await client.query(`INSERT INTO precinto (entrega_id,numero_paquete,posicion_paquete,codigo_barras_original,codigo_nacional,medicamento_id,precio_aplicado, precio_referencia)
        VALUES ($1,1,1,$2,$2,$3,0.10, 0.10)`, [entrega.id, med.codigo_nacional, med.id]);
      await client.query(`INSERT INTO incidencia (entrega_id,codigo_barras_original,motivo) VALUES ($1,'000000','MEDICAMENTO_DESCONOCIDO')`, [entrega.id]);
      expect((await consultar(entrega.id)).body).toMatchObject({ admitidos: 0, incidencias: 0, total_registrado: 0, subtotal_facturable: '0.00' });
      await client.query('COMMIT');
      expect((await consultar(entrega.id)).body).toMatchObject({ admitidos: 1, incidencias: 1, total_registrado: 2, subtotal_facturable: '0.10' });
    } finally { await client.query('ROLLBACK'); client.release(); }
  });

  it('eliminación primero serializa guardado y repetición tardía, sin posiciones repetidas', async () => {
    const { entrega, med, lecturas } = await prepararLecturas();
    const barrera = await pool.connect();
    let eliminacion;
    let escritura;
    let tardia;
    try {
      await barrera.query('BEGIN');
      const pid = (await barrera.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await barrera.query('SELECT id FROM entrega_farmacia_periodo WHERE id=$1 FOR UPDATE', [entrega.id]);
      eliminacion = borrar(entrega.id, lecturas[1].lectura.id).then((r) => r);
      const pidEliminar = await esperarBloqueo(pid);
      escritura = guardar(entrega.id, med.codigo_nacional).then((r) => r);
      await esperarBloqueo(pidEliminar);
      await barrera.query('COMMIT');
      expect((await eliminacion).status).toBe(204);
      expect((await escritura).status).toBe(201);
      tardia = await repetir(entrega.id, lecturas[1]);
      expect(tardia.status).toBe(409);
      const filas = (await consultar(entrega.id, 'precintos')).body;
      expect(new Set(filas.map((r) => `${r.numero_paquete}/${r.posicion_paquete}`)).size).toBe(filas.length);
      expect(filas.filter((r) => r.numero_paquete === 1).map((r) => r.posicion_paquete)).toEqual([1, 2]);
    } finally { await barrera.query('ROLLBACK'); if (eliminacion) await eliminacion; if (escritura) await escritura; barrera.release(); }
  });

  it.each([true, false])('cierre simulado y borrado respetan el orden común: cierre primero=%s', async (cierrePrimero) => {
    const contexto = await prepararLecturas();
    const cierre = await pool.connect();
    const barrera = await pool.connect();
    let eliminacion;
    let cierrePendiente;
    try {
      await cierre.query('BEGIN');
      if (cierrePrimero) {
        const pid = (await cierre.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await cierre.query('SELECT id FROM ayuntamiento WHERE id=$1 FOR UPDATE', [contexto.ayuntamiento.id]);
        await facturar(contexto, cierre);
        eliminacion = borrar(contexto.entrega.id, contexto.lecturas[0].lectura.id).then((r) => r);
        await esperarBloqueo(pid);
        await cierre.query('COMMIT');
        expect((await eliminacion).status).toBe(409);
      } else {
        await barrera.query('BEGIN');
        const pid = (await barrera.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await barrera.query('SELECT id FROM entrega_farmacia_periodo WHERE id=$1 FOR UPDATE', [contexto.entrega.id]);
        eliminacion = borrar(contexto.entrega.id, contexto.lecturas[0].lectura.id).then((r) => r);
        const pidEliminar = await esperarBloqueo(pid);
        cierrePendiente = cierre.query('SELECT id FROM ayuntamiento WHERE id=$1 FOR UPDATE', [contexto.ayuntamiento.id]);
        await esperarBloqueo(pidEliminar);
        await barrera.query('COMMIT');
        expect((await eliminacion).status).toBe(204);
        await cierrePendiente;
        expect((await cierre.query('SELECT count(*)::int AS n FROM precinto WHERE entrega_id=$1', [contexto.entrega.id])).rows[0].n).toBe(3);
        await facturar(contexto, cierre);
        await cierre.query('COMMIT');
      }
      expect((await consultar(contexto.entrega.id)).status).toBe(200);
      expect((await borrar(contexto.entrega.id, contexto.otro.lectura.id)).status).toBe(409);
    } finally {
      await barrera.query('ROLLBACK'); if (eliminacion) await eliminacion;
      await cierre.query('ROLLBACK'); if (cierrePendiente) await cierrePendiente;
      barrera.release(); cierre.release();
    }
  });
});
