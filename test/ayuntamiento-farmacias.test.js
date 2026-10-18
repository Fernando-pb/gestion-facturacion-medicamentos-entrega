import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import pool from '../src/db.js';

const app = createApp({ authConfig: null });

let ids;
const tablas = ['incidencia', 'precinto', 'entrega_farmacia_periodo', 'medicamento', 'factura', 'facturacion', 'periodo', 'farmacia', 'ayuntamiento'];
const guardar = (tabla, row) => { ids[tabla].push(row.id); return row; };
const insertar = async (tabla, sql, valores = []) => guardar(tabla, (await pool.query(sql, valores)).rows[0]);
const municipio = () => insertar('ayuntamiento', `INSERT INTO ayuntamiento
  (cif, denominacion, direccion, codigo_postal, localidad, provincia, estado, tipo_lista_medicamentos)
  VALUES ($1, 'Ayuntamiento Ficticio', 'Calle', '28001', 'Villa', 'Madrid', 'ACTIVO', 'GENERAL') RETURNING *;`, [`TEST-${randomUUID()}`]);
const farmacia = (town = null, cuenta = '1234567890') => insertar('farmacia', `INSERT INTO farmacia
  (soe, cif_nif, denominacion, direccion, codigo_postal, localidad, provincia, ayuntamiento_id, cuenta_bancaria)
  VALUES ($1, 'TEST-CIF-0001', 'Farmacia Ficticia', 'Calle', '28001', 'Villa', 'Madrid', $2, $3) RETURNING *;`,
[`TEST-${randomUUID()}`, town, cuenta]);
const periodo = () => insertar('periodo', 'INSERT INTO periodo (mes, anio) VALUES (1, $1) RETURNING *;', [randomInt(100000, 2000000000)]);
const asignar = (town, farm, origen) => request(app).post(`/ayuntamientos/${town}/farmacias`)
  .send({ farmacia_id: farm, ayuntamiento_origen_id: origen });
const quitar = (town, farm) => request(app).delete(`/ayuntamientos/${town}/farmacias/${farm}`);
const leerFarmacia = async (id) => (await pool.query('SELECT * FROM farmacia WHERE id = $1;', [id])).rows[0];
const esperarBloqueo = async (pid) => vi.waitFor(async () => {
  const bloqueados = await pool.query('SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid));', [pid]);
  expect(bloqueados.rows.length).toBeGreaterThan(0);
}, { timeout: 4000, interval: 20 });

beforeAll(async () => {
  if (process.env.DB_NAME !== 'gestion_facturacion_medicamentos_test') throw new Error('Estas pruebas requieren DB_NAME=gestion_facturacion_medicamentos_test.');
  expect((await pool.query('SELECT current_database() AS nombre;')).rows[0].nombre)
    .toBe('gestion_facturacion_medicamentos_test');
  expect((await pool.query(`SELECT attnotnull FROM pg_attribute
    WHERE attrelid = 'farmacia'::regclass AND attname = 'ayuntamiento_id';`)).rows[0].attnotnull).toBe(false);
});
beforeEach(() => { ids = Object.fromEntries(tablas.map((tabla) => [tabla, []])); });
afterEach(async () => {
  for (const tabla of tablas) {
    // Solo nombres de tabla de la lista interna e IDs creados por esta prueba.
    for (const id of ids[tabla]) await pool.query(`DELETE FROM ${tabla} WHERE id = $1;`, [id]);
  }
});
afterAll(async () => pool.end());

describe('asignación municipal de Farmacias', () => {
  it('asigna por ID una farmacia sin Ayuntamiento y devuelve solo los datos visibles seguros', async () => {
    const town = await municipio();
    const farm = await farmacia();
    const respuesta = await asignar(town.id, farm.id, null);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      farmacia_id: farm.id, soe: farm.soe, denominacion: farm.denominacion, localidad: farm.localidad,
      ayuntamiento_id: town.id, ayuntamiento_denominacion: town.denominacion,
      cuenta_bancaria_enmascarada: '•••• 7890',
    });
    expect(await leerFarmacia(farm.id)).toEqual({ ...farm, ayuntamiento_id: town.id });
  });

  it.each([null, '1234', '12 34 56', ''])('enmascara cuentas %s sin entregar su valor completo', async (cuenta) => {
    const town = await municipio();
    const farm = await farmacia(null, cuenta);
    const respuesta = await asignar(town.id, farm.id, null);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.cuenta_bancaria_enmascarada).toBe(cuenta === null ? null : cuenta === '12 34 56' ? '•••• 3456' : '••••');
    expect(respuesta.body).not.toHaveProperty('cuenta_bancaria');
    expect(respuesta.body).not.toHaveProperty('pais_control_iban');
  });

  it('reasigna sin actividad y retira conservando todos los datos del maestro', async () => {
    const origen = await municipio();
    const destino = await municipio();
    const farm = await farmacia(origen.id);
    expect((await asignar(destino.id, farm.id, origen.id)).status).toBe(200);
    expect(await leerFarmacia(farm.id)).toEqual({ ...farm, ayuntamiento_id: destino.id });
    const retirada = await quitar(destino.id, farm.id);
    expect(retirada.status).toBe(204);
    expect(retirada.text).toBe('');
    expect(await leerFarmacia(farm.id)).toEqual({ ...farm, ayuntamiento_id: null });
    expect((await request(app).get(`/farmacias/${farm.id}`)).body.ayuntamiento_id).toBeNull();
  });

  it('informa de duplicado sin modificar la farmacia', async () => {
    const town = await municipio();
    const farm = await farmacia(town.id);
    const respuesta = await asignar(town.id, farm.id, town.id);
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toMatch(/ya está asociada/i);
    expect(await leerFarmacia(farm.id)).toEqual(farm);
  });

  it.each(['no', '0', '-1', '1.5', '2147483648'])('rechaza el ID de ruta %s en POST y DELETE', async (id) => {
    expect((await asignar(id, 1, null)).status).toBe(400);
    expect((await quitar(id, 1)).status).toBe(400);
    expect((await quitar(1, id)).status).toBe(400);
  });

  it.each([
    {}, { farmacia_id: 1 }, { farmacia_id: null, ayuntamiento_origen_id: null },
    { farmacia_id: '1', ayuntamiento_origen_id: null }, { farmacia_id: 0, ayuntamiento_origen_id: null },
    { farmacia_id: 2147483648, ayuntamiento_origen_id: null },
    { farmacia_id: 1, ayuntamiento_origen_id: '1' }, { farmacia_id: 1, ayuntamiento_origen_id: 0 },
    { farmacia_id: 1, ayuntamiento_origen_id: null, denominacion: 'Cambio no permitido' },
  ])('rechaza cuerpo inválido %j', async (body) => {
    const respuesta = await request(app).post('/ayuntamientos/1/farmacias').send(body);
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toEqual(expect.any(String));
  });

  it('devuelve 404 para Ayuntamiento o Farmacia inexistentes y conserva las asignaciones', async () => {
    const town = await municipio();
    const farm = await farmacia(town.id);
    for (const respuesta of [await asignar(2147483647, farm.id, town.id), await asignar(town.id, 2147483647, null),
      await quitar(2147483647, farm.id), await quitar(town.id, 2147483647)]) {
      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error).toEqual(expect.any(String));
    }
    expect(await leerFarmacia(farm.id)).toEqual(farm);
  });

  it('rechaza retirada desde otro Ayuntamiento y desde ausencia de asignación', async () => {
    const town = await municipio();
    const otro = await municipio();
    const farm = await farmacia(town.id);
    expect((await quitar(otro.id, farm.id)).status).toBe(404);
    expect(await leerFarmacia(farm.id)).toEqual(farm);
    const sinAsignar = await farmacia();
    expect((await quitar(town.id, sinAsignar.id)).status).toBe(404);
    expect(await leerFarmacia(sinAsignar.id)).toEqual(sinAsignar);
  });

  it('rechaza una reasignación o asignación cuyo origen ya no coincide', async () => {
    const origen = await municipio();
    const nuevo = await municipio();
    const tercero = await municipio();
    const farm = await farmacia(origen.id);
    expect((await asignar(nuevo.id, farm.id, origen.id)).status).toBe(200);
    for (const esperado of [origen.id, null]) {
      const respuesta = await asignar(tercero.id, farm.id, esperado);
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error).toMatch(/origen ha cambiado/i);
    }
    expect(await leerFarmacia(farm.id)).toEqual({ ...farm, ayuntamiento_id: nuevo.id });
  });

  it.each(['vacia', 'precinto', 'incidencia'])('bloquea reasignar y retirar con entrega %s sin tocar ningún registro', async (tipo) => {
    const origen = await municipio();
    const destino = await municipio();
    const farm = await farmacia(origen.id);
    const mes = await periodo();
    const entrega = await insertar('entrega_farmacia_periodo', `INSERT INTO entrega_farmacia_periodo
      (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia, precintos_informados)
      VALUES ($1, $2, $3, $4, 0) RETURNING *;`, [farm.id, mes.id, farm.denominacion, farm.cif_nif]);
    let registro;
    if (tipo === 'precinto') {
      const med = await insertar('medicamento', `INSERT INTO medicamento
        (codigo_nacional, descripcion, precio, estado, situacion_comercial, tipo_facturacion)
        VALUES ($1, 'Ficticio', 2, 'ACTIVO', 'ALTA', 'TD') RETURNING *;`, [`TEST-${randomUUID()}`]);
      registro = await insertar('precinto', `INSERT INTO precinto
        (entrega_id, numero_paquete, posicion_paquete, codigo_barras_original, codigo_nacional, medicamento_id, precio_aplicado, precio_referencia)
        VALUES ($1, 1, 1, 'FICTICIO', $2, $3, 2, 2) RETURNING *;`, [entrega.id, med.codigo_nacional, med.id]);
    } else if (tipo === 'incidencia') {
      registro = await insertar('incidencia', `INSERT INTO incidencia (entrega_id, codigo_barras_original, motivo)
        VALUES ($1, 'FICTICIO', 'MEDICAMENTO_DESCONOCIDO') RETURNING *;`, [entrega.id]);
    }
    for (const respuesta of [await asignar(destino.id, farm.id, origen.id), await quitar(origen.id, farm.id)]) {
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error).toMatch(/entregas o precintos/i);
    }
    const duplicado = await asignar(origen.id, farm.id, origen.id);
    expect(duplicado.status).toBe(409);
    expect(duplicado.body.error).toMatch(/ya está asociada/i);
    expect(await leerFarmacia(farm.id)).toEqual(farm);
    expect((await pool.query('SELECT * FROM entrega_farmacia_periodo WHERE id = $1;', [entrega.id])).rows[0]).toEqual(entrega);
    if (registro) expect((await pool.query(`SELECT * FROM ${tipo} WHERE id = $1;`, [registro.id])).rows[0]).toEqual(registro);
  });

  it('también bloquea asignar una farmacia desasignada si hay una entrega preexistente', async () => {
    const town = await municipio();
    const farm = await farmacia();
    const mes = await periodo();
    await insertar('entrega_farmacia_periodo', `INSERT INTO entrega_farmacia_periodo
      (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia)
      VALUES ($1, $2, $3, $4) RETURNING *;`, [farm.id, mes.id, farm.denominacion, farm.cif_nif]);
    const respuesta = await asignar(town.id, farm.id, null);
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toMatch(/entregas o precintos/i);
    expect(await leerFarmacia(farm.id)).toEqual(farm);
  });

  it('no usa la facturación municipal como bloqueo independiente', async () => {
    const origen = await municipio();
    const destino = await municipio();
    const farm = await farmacia(origen.id);
    const mes = await periodo();
    const facturacion = await insertar('facturacion', `INSERT INTO facturacion
      (ayuntamiento_id, periodo_id, tipo_facturacion, fecha_factura)
      VALUES ($1, $2, 'TD', '2026-01-31') RETURNING *;`, [origen.id, mes.id]);
    const factura = await insertar('factura', `INSERT INTO factura
      (facturacion_id, tipo, numero_factura, numero_precintos, importe_total)
      VALUES ($1, 'PRECINTOS', $2, 1, 2) RETURNING *;`, [facturacion.id, `TEST-${randomUUID()}`]);
    expect((await asignar(destino.id, farm.id, origen.id)).status).toBe(200);
    expect((await pool.query('SELECT * FROM factura WHERE id = $1;', [factura.id])).rows[0]).toEqual(factura);
  });

  it('mantiene bloqueado el PUT general y conserva su edición de maestros', async () => {
    const origen = await municipio();
    const destino = await municipio();
    const farm = await farmacia(origen.id);
    const { id, ayuntamiento_id, ...editable } = farm;
    for (const cambio of [null, destino.id]) {
      expect((await request(app).put(`/farmacias/${id}`).send({ ...editable, ayuntamiento_id: cambio })).status).toBe(400);
    }
    expect(await leerFarmacia(id)).toEqual(farm);
    expect((await request(app).put(`/farmacias/${id}`).send(editable)).status).toBe(200);
  });

  it('serializa dos reasignaciones con el mismo origen: la petición perdedora no sobrescribe', async () => {
    const origen = await municipio();
    const a = await municipio();
    const b = await municipio();
    const farm = await farmacia(origen.id);
    const resultados = await Promise.all([asignar(a.id, farm.id, origen.id), asignar(b.id, farm.id, origen.id)]);
    expect(resultados.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(resultados.find((r) => r.status === 409).body.error).toMatch(/origen ha cambiado/i);
    expect((await leerFarmacia(farm.id)).ayuntamiento_id).toBe(resultados.find((r) => r.status === 200).body.ayuntamiento_id);
  });
});

describe('concurrencia real de PostgreSQL', () => {
  it('la FK hace esperar un INSERT posterior, pero no valida por sí sola el Ayuntamiento seleccionado', async () => {
    const origen = await municipio();
    const destino = await municipio();
    const farm = await farmacia(origen.id);
    const mes = await periodo();
    const bloqueo = await pool.connect();
    const registro = await pool.connect();
    let mutacion;
    let insercion;
    try {
      await bloqueo.query('BEGIN');
      await bloqueo.query('SELECT id FROM farmacia WHERE id = $1 FOR UPDATE;', [farm.id]);
      const pid = (await bloqueo.query('SELECT pg_backend_pid() AS pid;')).rows[0].pid;
      mutacion = asignar(destino.id, farm.id, origen.id).then((r) => r);
      await esperarBloqueo(pid);
      await registro.query('BEGIN');
      const pidRegistro = (await registro.query('SELECT pg_backend_pid() AS pid;')).rows[0].pid;
      insercion = registro.query(`INSERT INTO entrega_farmacia_periodo
        (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia)
        VALUES ($1, $2, $3, $4) RETURNING *;`, [farm.id, mes.id, farm.denominacion, farm.cif_nif]);
      await vi.waitFor(async () => {
        const bloqueos = await pool.query('SELECT pg_blocking_pids($1) AS pids;', [pidRegistro]);
        expect(bloqueos.rows[0].pids.length).toBeGreaterThan(0);
      }, { timeout: 4000, interval: 20 });
      await bloqueo.query('COMMIT');
      expect((await mutacion).status).toBe(200);
      const entrega = guardar('entrega_farmacia_periodo', (await insercion).rows[0]);
      await registro.query('COMMIT');
      expect((await leerFarmacia(farm.id)).ayuntamiento_id).toBe(destino.id);
      expect(entrega.farmacia_id).toBe(farm.id);
      // No hay Ayuntamiento en ENTREGA: el INSERT directo no conoce ni puede validar el origen elegido.
      expect((await quitar(destino.id, farm.id)).status).toBe(409);
    } finally {
      await bloqueo.query('ROLLBACK');
      bloqueo.release();
      if (mutacion) await mutacion;
      if (insercion) await insercion;
      await registro.query('ROLLBACK');
      registro.release();
    }
  }, 10000);

  it.each(['asignar', 'quitar'])('espera una entrega insertada sin commit mediante su FK y bloquea %s después del commit', async (operacion) => {
    const origen = await municipio();
    const destino = await municipio();
    const farm = await farmacia(origen.id);
    const mes = await periodo();
    const client = await pool.connect();
    let pendiente;
    try {
      await client.query('BEGIN');
      const entrega = guardar('entrega_farmacia_periodo', (await client.query(`INSERT INTO entrega_farmacia_periodo
        (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia)
        VALUES ($1, $2, $3, $4) RETURNING *;`, [farm.id, mes.id, farm.denominacion, farm.cif_nif])).rows[0]);
      const pid = (await client.query('SELECT pg_backend_pid() AS pid;')).rows[0].pid;
      pendiente = (operacion === 'asignar' ? asignar(destino.id, farm.id, origen.id) : quitar(origen.id, farm.id)).then((r) => r);
      await esperarBloqueo(pid); // Observa un lock real; no depende de una pausa temporal.
      await client.query('COMMIT');
      const respuesta = await pendiente;
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error).toMatch(/entregas o precintos/i);
      expect(await leerFarmacia(farm.id)).toEqual(farm);
      expect((await pool.query('SELECT * FROM entrega_farmacia_periodo WHERE id = $1;', [entrega.id])).rows[0]).toEqual(entrega);
    } finally {
      await client.query('ROLLBACK');
      client.release();
      if (pendiente) await pendiente;
    }
  }, 10000);

  it.each(['asignar', 'quitar'])('el protocolo futuro de entrega espera %s y rechaza el Ayuntamiento antiguo', async (operacion) => {
    const origen = await municipio();
    const destino = await municipio();
    const farm = await farmacia(origen.id);
    const bloqueo = await pool.connect();
    const registro = await pool.connect();
    let mutacion;
    let lectura;
    try {
      await bloqueo.query('BEGIN');
      await bloqueo.query('SELECT id FROM farmacia WHERE id = $1 FOR UPDATE;', [farm.id]);
      const pid = (await bloqueo.query('SELECT pg_backend_pid() AS pid;')).rows[0].pid;
      mutacion = (operacion === 'asignar' ? asignar(destino.id, farm.id, origen.id) : quitar(origen.id, farm.id)).then((r) => r);
      await esperarBloqueo(pid);
      await registro.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const pidRegistro = (await registro.query('SELECT pg_backend_pid() AS pid;')).rows[0].pid;
      // Se encola detrás del FOR UPDATE de la API; es el protocolo que compartirá el módulo de entregas.
      lectura = registro.query('SELECT ayuntamiento_id FROM farmacia WHERE id = $1 FOR SHARE;', [farm.id]);
      await vi.waitFor(async () => {
        const bloqueos = await pool.query('SELECT pg_blocking_pids($1) AS pids;', [pidRegistro]);
        expect(bloqueos.rows[0].pids.length).toBeGreaterThan(0);
      }, { timeout: 4000, interval: 20 });
      await bloqueo.query('COMMIT');
      expect((await mutacion).status).toBe(operacion === 'asignar' ? 200 : 204);
      const asignacion = (await lectura).rows[0].ayuntamiento_id;
      expect(asignacion).toBe(operacion === 'asignar' ? destino.id : null);
      expect(asignacion).not.toBe(origen.id);
      // Validación servidor: no insertar bajo el Ayuntamiento antiguo ni sin asignación.
      await registro.query('ROLLBACK');
      expect((await pool.query('SELECT id FROM entrega_farmacia_periodo WHERE farmacia_id = $1;', [farm.id])).rows).toEqual([]);
    } finally {
      await bloqueo.query('ROLLBACK');
      bloqueo.release();
      if (mutacion) await mutacion;
      if (lectura) await lectura;
      await registro.query('ROLLBACK');
      registro.release();
    }
  }, 10000);
});
