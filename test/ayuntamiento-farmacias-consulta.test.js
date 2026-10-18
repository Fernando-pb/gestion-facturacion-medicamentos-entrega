import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import pool from '../src/db.js';

const app = createApp({ authConfig: null });

let farmacias;
let ayuntamientos;
const clave = () => `TEST-${randomUUID()}`;
const crearAyuntamiento = async () => {
  const row = (await pool.query(`INSERT INTO ayuntamiento
    (cif, denominacion, direccion, codigo_postal, localidad, provincia, estado, tipo_lista_medicamentos)
    VALUES ($1, 'Ayuntamiento Ficticio', 'Calle', '28001', 'Villa', 'Madrid', 'ACTIVO', 'GENERAL') RETURNING *;`, [clave()])).rows[0];
  ayuntamientos.push(row);
  return row;
};
const crearFarmacia = async ({ ayuntamiento = null, soe = clave(), denominacion = clave(), cuenta = '11112222333344445555' } = {}) => {
  const row = (await pool.query(`INSERT INTO farmacia
    (soe, cif_nif, denominacion, direccion, codigo_postal, localidad, provincia, ayuntamiento_id,
      pais_control_iban, entidad_bancaria, sucursal_bancaria, digito_control_bancario, cuenta_bancaria)
    VALUES ($1, 'TEST-CIF-0001', $2, 'Calle', '28001', 'Villa', 'Madrid', $3, 'ES00', '1234', '5678', '90', $4) RETURNING *;`,
  [soe, denominacion, ayuntamiento, cuenta])).rows[0];
  farmacias.push(row);
  return row;
};
const buscar = (id, parametros) => request(app).get(`/ayuntamientos/${id}/farmacias/busqueda`).query(parametros);
const listar = (id) => request(app).get(`/ayuntamientos/${id}/farmacias`);
const identificadores = (respuesta) => respuesta.body.map((farmacia) => farmacia.farmacia_id);
const camposVisibles = ['farmacia_id', 'soe', 'denominacion', 'localidad', 'ayuntamiento_id', 'ayuntamiento_denominacion', 'cuenta_bancaria_enmascarada'].sort();
const comprobarProyeccion = (respuesta) => {
  expect(respuesta.status).toBe(200);
  for (const row of respuesta.body) {
    expect(Object.keys(row).sort()).toEqual(camposVisibles);
    expect(respuesta.text).not.toContain('11112222333344445555');
  }
};

beforeAll(async () => {
  if (process.env.DB_NAME !== 'gestion_facturacion_medicamentos_test') throw new Error('Estas pruebas requieren DB_NAME=gestion_facturacion_medicamentos_test.');
  expect((await pool.query('SELECT current_database() AS nombre;')).rows[0].nombre).toBe('gestion_facturacion_medicamentos_test');
});
beforeEach(() => { farmacias = []; ayuntamientos = []; });
afterEach(async () => {
  for (const row of farmacias) await pool.query('DELETE FROM farmacia WHERE id = $1;', [row.id]);
  for (const row of ayuntamientos) await pool.query('DELETE FROM ayuntamiento WHERE id = $1;', [row.id]);
});
afterAll(async () => pool.end());

describe('consulta municipal de Farmacias', () => {
  it('lista solo las farmacias actualmente asociadas en orden de ID y devuelve una proyección segura', async () => {
    const town = await crearAyuntamiento();
    const otro = await crearAyuntamiento();
    const a = await crearFarmacia({ ayuntamiento: town.id, soe: `${clave()}-Z` });
    const b = await crearFarmacia({ ayuntamiento: town.id, cuenta: null });
    await crearFarmacia({ ayuntamiento: otro.id });
    await crearFarmacia();
    const respuesta = await listar(town.id);
    comprobarProyeccion(respuesta);
    expect(identificadores(respuesta)).toEqual([a.id, b.id]);
    expect(respuesta.body[0]).toMatchObject({ soe: a.soe, denominacion: a.denominacion, localidad: a.localidad,
      ayuntamiento_id: town.id, ayuntamiento_denominacion: town.denominacion, cuenta_bancaria_enmascarada: '•••• 5555' });
    expect(respuesta.body[1].cuenta_bancaria_enmascarada).toBeNull();
  });

  it('devuelve [] para Ayuntamiento existente sin farmacias', async () => {
    const town = await crearAyuntamiento();
    const respuesta = await listar(town.id);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual([]);
  });

  it('devuelve 404 en listado y búsqueda si el Ayuntamiento no existe', async () => {
    for (const respuesta of [await listar(2147483647), await buscar(2147483647, { campo: 'soe', modo: 'exacto', q: clave() })]) {
      expect(respuesta.status).toBe(404);
      expect(respuesta.body).toEqual({ error: 'Ayuntamiento no encontrado.' });
    }
  });

  it.each(['no', '0', '-1', '1.5', '2147483648'])('rechaza el ID inválido %s en ambas consultas', async (id) => {
    expect((await listar(id)).status).toBe(400);
    expect((await buscar(id, { campo: 'soe', modo: 'exacto', q: 'TEST' })).status).toBe(400);
  });

  it.each([
    ['soe', 'exacto'], ['soe', 'prefijo'], ['soe', 'contiene'],
    ['denominacion', 'exacto'], ['denominacion', 'prefijo'], ['denominacion', 'contiene'],
  ])('busca por %s en modo %s, recorta extremos y no distingue mayúsculas', async (campo, modo) => {
    const town = await crearAyuntamiento();
    const q = `${clave()}-MiXeD`;
    const valores = [q, `${q} Final`, `Antes ${q} Después`, clave()];
    const creadas = [];
    for (const valor of valores) creadas.push(await crearFarmacia({ [campo]: valor }));
    const respuesta = await buscar(town.id, { campo, modo, q: `  ${q.toLowerCase()}  ` });
    comprobarProyeccion(respuesta);
    const esperadas = modo === 'exacto' ? [creadas[0].id] : modo === 'prefijo' ? [creadas[0].id, creadas[1].id] : creadas.slice(0, 3).map((row) => row.id);
    expect(identificadores(respuesta).sort((a, b) => a - b)).toEqual(esperadas.sort((a, b) => a - b));
  });

  it('ordena por el campo buscado y desempata denominaciones repetidas por ID', async () => {
    const town = await crearAyuntamiento();
    const token = clave();
    const c = await crearFarmacia({ soe: `${token}-C`, denominacion: `${token}-A` });
    const a = await crearFarmacia({ soe: `${token}-A`, denominacion: `${token}-C` });
    const b = await crearFarmacia({ soe: `${token}-B`, denominacion: `${token}-B` });
    const empate = await crearFarmacia({ soe: `${token}-D`, denominacion: `${token}-B` });
    expect(identificadores(await buscar(town.id, { campo: 'soe', modo: 'prefijo', q: token }))).toEqual([a.id, b.id, c.id, empate.id]);
    expect(identificadores(await buscar(town.id, { campo: 'denominacion', modo: 'prefijo', q: token }))).toEqual([c.id, b.id, empate.id, a.id]);
  });

  it('incluye todas las asignaciones actuales y permite usar el origen devuelto en POST', async () => {
    const town = await crearAyuntamiento();
    const otro = await crearAyuntamiento();
    const token = clave();
    const sinAsignar = await crearFarmacia({ soe: `${token}-A` });
    const propia = await crearFarmacia({ soe: `${token}-B`, ayuntamiento: town.id });
    const ajena = await crearFarmacia({ soe: `${token}-C`, ayuntamiento: otro.id });
    const respuesta = await buscar(town.id, { campo: 'soe', modo: 'prefijo', q: token });
    expect(identificadores(respuesta)).toEqual([sinAsignar.id, propia.id, ajena.id]);
    expect(respuesta.body.map((row) => row.ayuntamiento_id)).toEqual([null, town.id, otro.id]);
    expect(respuesta.body[0].ayuntamiento_denominacion).toBeNull();
    for (const row of [respuesta.body[0], respuesta.body[2]]) {
      const asignada = await request(app).post(`/ayuntamientos/${town.id}/farmacias`)
        .send({ farmacia_id: row.farmacia_id, ayuntamiento_origen_id: row.ayuntamiento_id });
      expect(asignada.status).toBe(200);
      expect(asignada.body.ayuntamiento_id).toBe(town.id);
    }
    expect(identificadores(await listar(town.id))).toEqual([sinAsignar.id, propia.id, ajena.id]);
    expect((await request(app).delete(`/ayuntamientos/${town.id}/farmacias/${ajena.id}`)).status).toBe(204);
    expect(identificadores(await listar(town.id))).toEqual([sinAsignar.id, propia.id]);
  });

  it('devuelve [] si una búsqueda válida no tiene resultados', async () => {
    const town = await crearAyuntamiento();
    const respuesta = await buscar(town.id, { campo: 'denominacion', modo: 'contiene', q: clave() });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual([]);
  });

  it.each([
    {}, { campo: 'soe', modo: 'exacto' }, { modo: 'exacto', q: 'TEST' }, { campo: 'soe', q: 'TEST' },
    { campo: 'nombre', modo: 'exacto', q: 'TEST' }, { campo: 'soe', modo: 'empieza', q: 'TEST' },
    { campo: 'soe', modo: 'contiene', q: '' }, { campo: 'soe', modo: 'prefijo', q: '  ' },
    { campo: 'soe', modo: 'exacto', q: 'a'.repeat(201) }, { campo: 'soe', modo: 'exacto', q: 'a\0b' },
    { campo: ['soe', 'denominacion'], modo: 'exacto', q: 'TEST' },
    { campo: 'soe', modo: 'exacto', q: ['TEST', 'OTRO'] },
    { campo: 'soe', modo: ['exacto', 'contiene'], q: 'TEST' },
    { campo: 'soe', modo: 'exacto', q: 'TEST', limite: '1' },
  ])('rechaza parámetros de búsqueda inválidos %j', async (parametros) => {
    const respuesta = await buscar(1, parametros);
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toEqual(expect.any(String));
  });

  it('el listado no acepta filtros ni parámetros desconocidos', async () => {
    const respuesta = await listar(1).query({ q: 'TEST' });
    expect(respuesta.status).toBe(400);
  });

  it('acepta 200 caracteres tras trim y conserva espacios interiores y acentos', async () => {
    const town = await crearAyuntamiento();
    const nombre = `${clave()} Clínica  Ficticia`;
    const farm = await crearFarmacia({ denominacion: nombre });
    expect(identificadores(await buscar(town.id, { campo: 'denominacion', modo: 'exacto', q: ` ${nombre.toUpperCase()} ` }))).toEqual([farm.id]);
    expect((await buscar(town.id, { campo: 'denominacion', modo: 'exacto', q: nombre.replace('  ', ' ') })).body).toEqual([]);
    expect((await buscar(town.id, { campo: 'denominacion', modo: 'exacto', q: nombre.replace('í', 'i') })).body).toEqual([]);
    const soeLargo = `${clave()}${'a'.repeat(200)}`.slice(0, 200);
    const larga = await crearFarmacia({ soe: soeLargo });
    const respuesta = await buscar(town.id, { campo: 'soe', modo: 'exacto', q: ` ${soeLargo} ` });
    expect(respuesta.status).toBe(200);
    expect(identificadores(respuesta)).toEqual([larga.id]);
  });

  it.each(['soe', 'denominacion'])('trata literalmente %%, _, ! y barra inversa en todos los modos de %s', async (campo) => {
    const town = await crearAyuntamiento();
    for (const especial of ['%', '_', '!', '\\']) {
      const token = clave();
      const q = `${token}${especial}`;
      const exacta = await crearFarmacia({ [campo]: q });
      const prefijo = await crearFarmacia({ [campo]: `${q} Final` });
      const contiene = await crearFarmacia({ [campo]: `Antes ${q} Después` });
      await crearFarmacia({ [campo]: `${token}Otro` });
      for (const modo of ['exacto', 'prefijo', 'contiene']) {
        const respuesta = await buscar(town.id, { campo, modo, q });
        expect(respuesta.status).toBe(200);
        const esperadas = modo === 'exacto' ? [exacta.id] : modo === 'prefijo' ? [exacta.id, prefijo.id] : [exacta.id, prefijo.id, contiene.id];
        expect(identificadores(respuesta).sort((a, b) => a - b)).toEqual(esperadas.sort((a, b) => a - b));
      }
    }
  });

  it('una consulta con texto SQL se busca literalmente y no modifica registros', async () => {
    const town = await crearAyuntamiento();
    const texto = `${clave()} ' OR 1=1 --`;
    const farm = await crearFarmacia({ soe: texto });
    await crearFarmacia();
    const respuesta = await buscar(town.id, { campo: 'soe', modo: 'exacto', q: texto });
    expect(respuesta.status).toBe(200);
    expect(identificadores(respuesta)).toEqual([farm.id]);
    expect((await pool.query('SELECT * FROM farmacia WHERE id = $1;', [farm.id])).rows[0]).toEqual(farm);
  });

  it.each([null, '', '1234', '12 34 56'])('mantiene la máscara aprobada para cuenta %s en listado y búsqueda', async (cuenta) => {
    const town = await crearAyuntamiento();
    const farm = await crearFarmacia({ ayuntamiento: town.id, cuenta });
    for (const respuesta of [await listar(town.id), await buscar(town.id, { campo: 'soe', modo: 'exacto', q: farm.soe })]) {
      comprobarProyeccion(respuesta);
      expect(respuesta.body[0].cuenta_bancaria_enmascarada).toBe(cuenta === null ? null : cuenta === '12 34 56' ? '•••• 3456' : '••••');
    }
  });

  it('conserva el contrato y el orden del listado/detalle del CRUD general', async () => {
    const town = await crearAyuntamiento();
    const a = await crearFarmacia({ ayuntamiento: town.id });
    const b = await crearFarmacia();
    const general = await request(app).get('/farmacias');
    expect(general.status).toBe(200);
    const propias = general.body.filter((row) => [a.id, b.id].includes(row.id));
    expect(propias.map((row) => row.id)).toEqual([a.id, b.id]);
    expect(propias[0].cuenta_bancaria).toBe(a.cuenta_bancaria);
    expect(propias[1].ayuntamiento_id).toBeNull();
    const detalle = await request(app).get(`/farmacias/${a.id}`);
    expect(detalle.status).toBe(200);
    expect(detalle.body.cuenta_bancaria).toBe(a.cuenta_bancaria);
    expect(detalle.body.ayuntamiento_id).toBe(town.id);
  });
});
