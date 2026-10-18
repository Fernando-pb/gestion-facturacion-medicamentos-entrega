import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { iniciarBusquedaDocumentos } from '../public/js/documentos-busqueda.js';
import * as cliente from '../public/js/documentos-api.js';

class Elemento {
  constructor() { this.listeners = {}; this.value = ''; this.disabled = false; this.children = []; }
  addEventListener(n, f) { this.listeners[n] = f; }
  dispatch(n) { return this.listeners[n]({ preventDefault() {} }); }
  replaceChildren(...n) { this.children = n; this.value = n[0]?.value ?? ''; }
}
const preparar = async (overrides = {}) => {
  const html = await readFile(new URL('../public/documentos-facturacion.html', import.meta.url), 'utf8');
  const nodes = new Map([...html.matchAll(/id="([^"]+)"/g)].map((m) => [m[1], new Elemento()]));
  const $ = (id) => nodes.get(id), navegar = vi.fn();
  const api = { listarAyuntamientos: vi.fn().mockResolvedValue([{ id: 2, denominacion: 'Ayuntamiento A1' }]),
    listarPeriodos: vi.fn().mockResolvedValue([{ id: 9, mes: 9, anio: 2026 }]),
    buscar: vi.fn().mockResolvedValue({ facturacion_id: 2, estado: 'EMITIDA' }), ...overrides };
  await iniciarBusquedaDocumentos({ documento: { getElementById: $, createElement: () => new Elemento() }, api, navegar });
  $('ayuntamiento-documentos').value = '2'; $('periodo-documentos').value = '9';
  return { $, api, navegar };
};
afterEach(() => vi.unstubAllGlobals());
describe('localizar documentos emitidos desde Inicio', () => {
  it('Inicio entra en el módulo municipal y la pantalla documental conserva búsqueda y cinco opciones', async () => {
    const inicio=(await request(app).get('/')).text; expect(inicio).toContain('/facturacion-municipal.html'); expect(inicio).not.toContain('href="/documentos-facturacion.html"');
    const pagina = await request(app).get('/documentos-facturacion.html');
    expect(pagina.text).toContain('id="busqueda-documentos"');
    expect(pagina.text).toContain('src="/js/documentos-busqueda.js"');
    for (const tipo of ['precintos', 'comision', 'relacion', 'gastos', 'ambas']) expect(pagina.text).toContain(`data-documento="${tipo}"`);
    expect((await request(app).get('/js/documentos-busqueda.js')).status).toBe(200);
  });
  it('localiza A1 y septiembre, abre por referencia guardada sin preparar ni emitir', async () => {
    const { $, api, navegar } = await preparar();
    expect($('periodo-documentos').children[1].textContent).toBe('09/2026');
    await $('busqueda-documentos').dispatch('submit');
    expect(api.buscar).toHaveBeenCalledExactlyOnceWith('2', '9');
    expect(navegar).toHaveBeenCalledExactlyOnceWith('/documentos-facturacion.html?facturacion_id=2');
  });
  it.each(['REVISION', 'REABIERTA'])('avisa si el proceso está %s sin abrir documentos', async (estado) => {
    const { $, navegar } = await preparar({ buscar: vi.fn().mockResolvedValue({ facturacion_id: 2, estado }) });
    await $('busqueda-documentos').dispatch('submit'); expect(navegar).not.toHaveBeenCalled();
    expect($('error-busqueda').textContent).toMatch(/revisión|corrección pendiente/);
  });
  it('valida selección y conserva entradas cuando no existe o falla la consulta', async () => {
    const { $, api, navegar } = await preparar({ buscar: vi.fn().mockRejectedValue(new Error('No hay facturación guardada.')) });
    $('periodo-documentos').value = ''; await $('busqueda-documentos').dispatch('submit'); expect(api.buscar).not.toHaveBeenCalled();
    $('periodo-documentos').value = '9'; await $('busqueda-documentos').dispatch('submit');
    expect($('error-busqueda').textContent).toBe('No hay facturación guardada.');
    expect($('ayuntamiento-documentos').value).toBe('2'); expect($('periodo-documentos').value).toBe('9');
    expect($('buscar-documentos').disabled).toBe(false); expect(navegar).not.toHaveBeenCalled();
  });
  it('catálogos fallidos permiten reintento y no dejan consultar opciones incompletas', async () => {
    const { $, api } = await preparar({ listarPeriodos: vi.fn().mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue([]) });
    expect($('reintentar-busqueda').hidden).toBe(false); expect($('buscar-documentos').disabled).toBe(true);
    await $('busqueda-documentos').dispatch('submit'); expect(api.buscar).not.toHaveBeenCalled();
    await $('reintentar-busqueda').dispatch('click'); expect($('estado-busqueda').textContent).toContain('No hay');
  });
  it('cliente solo usa GET para búsqueda y documentos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    await cliente.buscar('2', '9'); await cliente.consultar(2);
    expect(fetch.mock.calls).toEqual([
      ['/facturaciones/busqueda?ayuntamiento_id=2&periodo_id=9', {}], ['/facturaciones/2/documentos', {}],
    ]);
  });
});
