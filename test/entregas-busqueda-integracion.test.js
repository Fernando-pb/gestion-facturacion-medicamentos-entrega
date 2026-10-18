import { randomInt, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import pool from '../src/db.js';
import { obtenerFarmacia } from '../src/farmacias/farmacia.controller.js';
import * as api from '../public/js/entregas-api.js';
import { iniciarInterfaz } from '../public/js/entregas.js';

// DOM simulado; transporte HTTP, rutas y PostgreSQL reales.
class Elemento {
  constructor() { this.value = ''; this.children = []; this.listeners = new Map(); this.attributes = {}; }
  addEventListener(nombre, fn) { this.listeners.set(nombre, [...(this.listeners.get(nombre) ?? []), fn]); }
  async dispatch(nombre, event = {}) { for (const fn of this.listeners.get(nombre) ?? []) await fn(event); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(nombre, valor) { this.attributes[nombre] = valor; }
  focus() { this.focused = true; }
}
const fetchReal = globalThis.fetch;
let server, origen, farmaciaIds = [], municipioId, clave, farmacia, sinMunicipio, anioPrueba;
const escuchar = (aplicacion) => new Promise((resolve) => {
  const servidor = aplicacion.listen(0, '127.0.0.1', () => resolve(servidor));
});
const cerrar = (servidor) => new Promise((resolve, reject) => servidor.close((error) => error ? reject(error) : resolve()));
const pantalla = async (base = origen) => {
  const html = await readFile(new URL('../public/entregas.html', import.meta.url), 'utf8');
  const nodes = new Map([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, new Elemento()]));
  const $ = (id) => nodes.get(id);
  vi.stubGlobal('document', { getElementById: $, createElement: () => new Elemento() });
  const peticiones = [];
  vi.stubGlobal('fetch', (url, opciones) => {
    peticiones.push({ url: String(url), metodo: opciones?.method ?? 'GET', cuerpo: opciones?.body });
    return fetchReal(new URL(url, base), opciones);
  });
  iniciarInterfaz({ api });
  await vi.waitFor(() => expect($('listado-entregas').attributes['aria-busy']).toBe('false'));
  expect(peticiones.map((p) => p.url)).toEqual(['/entregas/periodos', '/entregas/registradas']);
  expect(peticiones.every((p) => p.metodo === 'GET')).toBe(true);
  peticiones.length = 0; // Las siguientes aserciones comprueban solo el flujo de alta/búsqueda.
  await $('crear-entrega').dispatch('click');
  $('mes').value = '2'; $('anio').value = '2035';
  $('cantidad-inicial').value = '0'; $('importe-inicial').value = '12,34';
  return { $, peticiones };
};
const escribir = async ($, texto, enter = false) => {
  if ($('selector-farmacias').hidden) await $('seleccionar-farmacia').dispatch('click');
  $('busqueda').value = texto; await $('busqueda').dispatch('input');
  if (enter) await $('busqueda').dispatch('keydown', { key: 'Enter', preventDefault() {}, stopPropagation() {} });
};

beforeAll(async () => {
  if (process.env.DB_NAME !== 'gestion_facturacion_medicamentos_test' ||
      !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST ?? 'localhost')) {
    throw new Error('Se requiere la base dedicada local de pruebas.');
  }
  expect((await pool.query('SELECT current_database() AS nombre')).rows[0].nombre)
    .toBe('gestion_facturacion_medicamentos_test');
  server = await escuchar(app); origen = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  clave = randomUUID(); farmaciaIds = [];
  do { anioPrueba = randomInt(1000000, 2147483000); }
  while ((await pool.query('SELECT 1 FROM periodo WHERE mes = 2 AND anio = $1', [anioPrueba])).rowCount);
  municipioId = (await pool.query(`INSERT INTO ayuntamiento
    (cif, denominacion, direccion, codigo_postal, localidad, provincia, estado, tipo_lista_medicamentos)
    VALUES ($1, 'Villa de prueba', 'Calle', '28001', 'Villa', 'Madrid', 'ACTIVO', 'GENERAL') RETURNING id`,
  [`TEST-BUSQUEDA-${clave}`])).rows[0].id;
  const crear = async (soe, ayuntamiento) => {
    const fila = (await pool.query(`INSERT INTO farmacia
      (soe, cif_nif, denominacion, direccion, codigo_postal, localidad, provincia, ayuntamiento_id)
      VALUES ($1, 'TEST-CIF-0001', $2, 'Calle', '28001', 'Villa', 'Madrid', $3) RETURNING *`,
    [soe, `Farmacia ${clave}`, ayuntamiento])).rows[0];
    farmaciaIds.push(fila.id); return fila;
  };
  farmacia = await crear(`00AB-${clave}`, municipioId);
  sinMunicipio = await crear(`00CD-${clave}`, null);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  const periodos = (await pool.query('DELETE FROM entrega_farmacia_periodo WHERE farmacia_id = ANY($1::int[]) RETURNING periodo_id', [farmaciaIds])).rows;
  for (const { periodo_id } of periodos) await pool.query('DELETE FROM periodo WHERE id = $1 AND anio = $2', [periodo_id, anioPrueba]);
  await pool.query('DELETE FROM farmacia WHERE id = ANY($1::int[])', [farmaciaIds]);
  if (municipioId) await pool.query('DELETE FROM ayuntamiento WHERE id = $1', [municipioId]);
});
afterAll(async () => { if (server) await cerrar(server); await pool.end(); });

describe('autocompletado conectado a la API real', () => {
  it('listado real permite continuar entrega con GET y conserva declarados sin POST/PUT adicionales', async () => {
    const { $, peticiones } = await pantalla();
    $('anio').value = String(anioPrueba); await $('anio').dispatch('input');
    await escribir($, farmacia.soe, true);
    await $('formulario-seleccion').dispatch('submit', { preventDefault() {} });
    const guardada = (await pool.query('SELECT * FROM entrega_farmacia_periodo WHERE farmacia_id=$1', [farmacia.id])).rows[0];
    await $('volver-seleccion').dispatch('click');
    $('periodo-listado').value = String(guardada.periodo_id); await $('periodo-listado').dispatch('change');
    const filas = $('grupos-entregas').children.flatMap((grupo) => grupo.children[1].children[0].children[1].children);
    const fila = filas.find((tr) => tr.children[0].textContent === farmacia.soe);
    expect(fila.children[2].textContent).toBe(0); expect(fila.children[3].textContent).toBe('0,00');
    const desde = peticiones.length; await fila.children[4].children[0].dispatch('click');
    expect(peticiones.slice(desde).every((p) => p.metodo === 'GET')).toBe(true);
    expect(peticiones[desde].url).toContain(`/entregas?farmacia_id=${farmacia.id}&periodo_id=${guardada.periodo_id}`);
    expect($('cantidad-guardada').textContent).toBe(0); expect($('importe-guardado').textContent).toBe('12.34');
    expect($('seleccion').hidden).toBe(true);
    expect((await pool.query('SELECT * FROM entrega_farmacia_periodo WHERE id=$1',[guardada.id])).rows[0]).toEqual(guardada);
  });
  it.each(['clic', 'Enter'])('selección por %s habilita y abre por mes/año con API y PostgreSQL reales', async (modo) => {
    const { $, peticiones } = await pantalla();
    $('anio').value = String(anioPrueba); await $('anio').dispatch('input');
    expect($('ayuntamiento')).toBeUndefined(); // El recuadro duplicado se eliminó.
    expect($('farmacia-vacia').hidden).toBe(false);
    expect($('aviso-ayuntamiento').hidden).toBe(true); expect($('aviso-ayuntamiento').textContent).toBe('');
    await escribir($, farmacia.soe, modo === 'Enter');
    if (modo === 'clic') {
      await vi.waitFor(() => expect($('resultados-farmacias').children).toHaveLength(1));
      await $('resultados-farmacias').children[0].dispatch('click');
    }
    expect($('abrir').disabled).toBe(false); expect($('abrir').attributes['aria-busy']).toBe('false');
    expect($('selector-farmacias').hidden).toBe(true); expect($('seleccion').hidden).toBe(false);
    expect($('farmacia-seleccionada').textContent).toBe(`SOE ${farmacia.soe} — ${farmacia.denominacion} · Ayuntamiento: Villa de prueba`);
    expect($('aviso-ayuntamiento').hidden).toBe(true); expect($('aviso-ayuntamiento').textContent).toBe('');
    expect($('seleccionar-farmacia').textContent).toBe('Cambiar farmacia');
    expect(peticiones.every((p) => p.metodo === 'GET')).toBe(true);
    expect((await pool.query('SELECT 1 FROM entrega_farmacia_periodo WHERE farmacia_id=$1', [farmacia.id])).rowCount).toBe(0);
    expect((await pool.query('SELECT 1 FROM periodo WHERE mes=2 AND anio=$1', [anioPrueba])).rowCount).toBe(0);
    await $('formulario-seleccion').dispatch('submit', { preventDefault() {}, submitter: $('abrir') });
    expect($('estado').textContent).toBe('Guardado. Entrega creada y declarados guardados.');
    expect($('detalle').hidden).toBe(false); expect($('seleccion').hidden).toBe(true);
    const apertura = peticiones.find((p) => p.metodo === 'POST');
    expect(JSON.parse(apertura.cuerpo)).toEqual({ farmacia_id: farmacia.id, mes: 2, anio: anioPrueba });
    const guardada = (await pool.query('SELECT * FROM entrega_farmacia_periodo WHERE farmacia_id = $1', [farmacia.id])).rows;
    expect(guardada).toHaveLength(1);
    expect(guardada[0]).toMatchObject({ precintos_informados: 0, importe_informado: '12.34', denominacion_farmacia: farmacia.denominacion });
  });
  it('debounce busca denominación por HTTP real, presenta contexto y selecciona con clic', async () => {
    const { $, peticiones } = await pantalla();
    await escribir($, clave);
    expect(peticiones).toHaveLength(0);
    await vi.waitFor(() => expect($('resultados-farmacias').children).toHaveLength(2));
    expect(peticiones.map((p) => p.url)).toEqual([
      `/farmacias/busqueda?campo=soe&modo=prefijo&q=${clave}`,
      `/farmacias/busqueda?campo=denominacion&modo=contiene&q=${clave}`,
    ]);
    expect($('resultados-farmacias').children[0].textContent).toContain('Villa');
    await $('resultados-farmacias').children[0].dispatch('click');
    expect($('farmacia-seleccionada').textContent).toBe(`SOE ${farmacia.soe} — ${farmacia.denominacion} · Ayuntamiento: Villa de prueba`);
    expect($('aviso-ayuntamiento').hidden).toBe(true);
    expect($('abrir').disabled).toBe(false);
    await $('seleccionar-farmacia').dispatch('click');
    expect($('selector-farmacias').hidden).toBe(false); expect($('seleccion').hidden).toBe(true);
    expect($('mes').value).toBe('2'); expect($('anio').value).toBe('2035');
    expect($('importe-inicial').value).toBe('12,34'); expect($('cantidad-inicial').value).toBe('0');
    await $('cancelar-selector-farmacias').dispatch('click');
    expect($('selector-farmacias').hidden).toBe(true); expect($('seleccion').hidden).toBe(false);
    expect($('farmacia-seleccionada').textContent).toContain(farmacia.soe);
    expect($('abrir').disabled).toBe(false);
    expect($('mes').value).toBe('2'); expect($('anio').value).toBe('2035');
    expect($('importe-inicial').value).toBe('12,34'); expect($('cantidad-inicial').value).toBe('0');
    expect(peticiones.every((p) => p.metodo === 'GET')).toBe(true);
  });
  it('SOE exacto conserva ceros/letras, deduplica y Enter selecciona sin abrir entrega', async () => {
    const { $, peticiones } = await pantalla();
    await escribir($, farmacia.soe, true);
    expect($('busqueda').value).toBe(farmacia.soe);
    expect($('farmacia-seleccionada').textContent).toContain(farmacia.soe);
    expect($('resultados-farmacias').hidden).toBe(true);
    expect(peticiones).toHaveLength(2); expect(peticiones.every((p) => p.metodo === 'GET')).toBe(true);
  });
  it('teclado selecciona una farmacia sin Ayuntamiento y conserva el aviso de bloqueo', async () => {
    const { $, peticiones } = await pantalla();
    await escribir($, sinMunicipio.soe.slice(0, -1));
    await vi.waitFor(() => expect($('resultados-farmacias').children).toHaveLength(1));
    expect($('resultados-farmacias').children[0].textContent).toContain('Sin Ayuntamiento');
    await $('busqueda').dispatch('keydown', { key: 'ArrowDown', preventDefault() {} });
    await $('busqueda').dispatch('keydown', { key: 'Enter', preventDefault() {} });
    expect($('selector-farmacias').hidden).toBe(true); expect($('seleccion').hidden).toBe(false);
    expect($('farmacia-seleccionada').textContent).toBe(`SOE ${sinMunicipio.soe} — ${sinMunicipio.denominacion}`);
    expect($('abrir').disabled).toBe(true); expect($('aviso-ayuntamiento').hidden).toBe(false);
    expect($('ayuntamiento')).toBeUndefined();
    expect($('estado-apertura').textContent).toBe('');
    expect($('aviso-ayuntamiento').textContent).toContain('Debes asignarlo desde la gestión de Ayuntamientos');
    await $('formulario-seleccion').dispatch('submit', { preventDefault() {}, submitter: $('abrir') });
    expect(peticiones.every((p) => p.metodo === 'GET')).toBe(true);
    expect((await pool.query('SELECT 1 FROM entrega_farmacia_periodo WHERE farmacia_id=$1', [sinMunicipio.id])).rowCount).toBe(0);
  });
  it('reproduce el servidor antiguo: /:id captura busqueda y el 400 es error, nunca lista vacía', async () => {
    const antigua = express(); antigua.get('/farmacias/:id', obtenerFarmacia);
    const servidorAntiguo = await escuchar(antigua);
    try {
      const { $ } = await pantalla(`http://127.0.0.1:${servidorAntiguo.address().port}`);
      await escribir($, farmacia.soe, true);
      expect($('estado-busqueda').textContent).toContain('Identificador no válido');
      expect($('estado-busqueda').textContent).not.toContain('Sin coincidencias');
      expect($('reintentar-carga').hidden).toBe(false);
      expect($('abrir').disabled).toBe(true);
    } finally { await cerrar(servidorAntiguo); }
  });
});
