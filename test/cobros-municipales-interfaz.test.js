import { cuentaBancariaTest } from './fixtures/datos-test.js';
import { readFile } from 'node:fs/promises';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import { iniciarCobros, fechaCobroValida } from '../public/js/cobros-municipales.js';
import { cobrar, ErrorFacturacion, prepararLiquidacion, confirmarLiquidacion, consultarLiquidacion } from '../public/js/facturacion-municipal-api.js';

class Elemento {
  constructor(tag = '') { this.tag = tag; this.value = ''; this.checked = false; this.hidden = false; this.disabled = false; this.children = []; this.listeners = new Map(); this.attributes = {}; }
  addEventListener(n, f) { this.listeners.set(n, [...(this.listeners.get(n) ?? []), f]); }
  async dispatch(n, e = { preventDefault() {} }) { for (const f of this.listeners.get(n) ?? []) await f(e); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(n, v) { this.attributes[n] = v; }
  focus() { this.focused = true; }
}
const proceso = () => ({ facturacion_id: 3, estado: 'EMITIDA', facturas: [
  { id: 10, tipo: 'PRECINTOS', numero_factura: '000P', importe_total: '100.00' },
  { id: 11, tipo: 'COMISION', numero_factura: '000C', importe_total: '3.27' }], cobros: [] });
const cobro = (facturaId = 10) => ({ id: facturaId + 20, factura_id: facturaId, fecha_cobro: '2026-10-11', importe_cobrado: facturaId === 10 ? '100.00' : '3.27', justificante: null });
const textos = (n) => [n.textContent, ...n.children.flatMap(textos)].filter((v) => v !== undefined);
const botones = (n) => n.children.flatMap((e) => [...(e.tag === 'button' ? [e] : []), ...botones(e)]);
const preparar = async (overrides = {}, referencia = null) => {
  const html = await readFile(new URL('../public/cobros-municipales.html', import.meta.url), 'utf8');
  const nodes = new Map([...html.matchAll(/id="([^"]+)"/g)].map((m) => [m[1], new Elemento()]));
  const $ = (id) => nodes.get(id);
  for (const id of ['paso-facturas', 'paso-registro', 'recuperar-cobro']) $(id).hidden = true;
  $('pantalla-cobros').querySelectorAll = () => [...nodes.values(), ...botones($('tarjetas-facturas'))];
  vi.stubGlobal('document', { getElementById: $, createElement: (tag) => new Elemento(tag) });
  const api = { listarEmitidas: vi.fn().mockResolvedValue([{ facturacion_id: 3, ayuntamiento: 'Ayuntamiento A1', mes: 9, anio: 2026, importe_precintos: '100.00', importe_comision: '3.27', factura_precintos_cobrada: false, factura_comision_cobrada: false, fecha_prevista_liquidacion: null }]), consultarLiquidacion: vi.fn().mockRejectedValue(new ErrorFacturacion('Liquidación confirmada no encontrada.', 404)), consultar: vi.fn().mockResolvedValue(proceso()), cobrar: vi.fn().mockImplementation(async (id, f, d) => ({ id: f + 20, factura_id: f, ...d })), ...overrides };
  await iniciarCobros({ api, referencia });
  return { $, api };
};
const consultar = ($) => botones($('filas-cobros'))[0].dispatch('click');
const abrir = ($, tipo = 'PRECINTOS') => botones($('tarjetas-facturas')).find((b) => b.textContent === `Registrar cobro de ${tipo}`).dispatch('click');
const guardar = ($) => { $('fecha-cobro').value = '2026-10-11'; $('confirmacion-cobro').checked = true; return $('formulario-registro-cobro').dispatch('submit'); };
const propuesta = () => ({ facturacion_id: 3, fecha_pago: '2026-10-12', importe_total: '100.00', detalles: [60, 40].map((n, i) => ({
  participacion_facturacion_id: i + 21, soe: `SOE${i}`, denominacion_farmacia: `Titular TEST ${i}`, cif_nif: 'TEST-CIF-0008', importe: `${n}.00`,
  ...cuentaBancariaTest(),
})) });
const inputsLiquidacion = ($) => $('detalles-liquidacion').children.map((grupo) => Object.fromEntries(grupo.children[2].children.map((celda) => {
  const input = celda.children[1]; return [input.id.replace(/^liquidacion-\d+-/, ''), input];
})));
const prepararLote = async (overrides = {}) => {
  const datos = { ...proceso(), cobros: [cobro()] };
  const vista = await preparar({ consultar: vi.fn().mockResolvedValue(datos), prepararLiquidacion: vi.fn().mockResolvedValue(propuesta()),
    confirmarLiquidacion: vi.fn().mockImplementation(async (id, d) => ({ ...d, facturacion_id: id, importe_total: '100.00', cuadra: true })), ...overrides }, '3');
  await vista.$('preparar-liquidacion').dispatch('click'); return vista;
};
afterEach(() => vi.unstubAllGlobals());

describe('cobros municipales en interfaz', () => {
  it.each([['PRECINTOS', 'GASTOS/COMISIÓN'], ['GASTOS/COMISIÓN', 'PRECINTOS']])('cobra %s y después %s independientemente', async (primera, segunda) => {
    const { $, api } = await preparar(); await consultar($);
    expect(botones($('tarjetas-facturas'))).toHaveLength(2); expect($('bloqueo-reapertura').textContent).toContain('Registrar cualquier cobro');
    await abrir($, primera); $('justificante-cobro').value = '  REF <banco>  '; await guardar($);
    const id = primera === 'PRECINTOS' ? 10 : 11;
    expect(api.cobrar).toHaveBeenCalledWith(3, id, { fecha_cobro: '2026-10-11', importe_cobrado: id === 10 ? '100.00' : '3.27', justificante: 'REF <banco>' });
    expect($('bloqueo-reapertura').textContent).toBe('Reapertura bloqueada: existe un cobro registrado en esta facturación.');
    expect(botones($('tarjetas-facturas'))).toHaveLength(1);
    expect(textos($('tarjetas-facturas'))).toContain('Justificante: REF <banco>');
    await abrir($, segunda); expect($('justificante-cobro').value).toBe(''); await guardar($);
    expect(api.cobrar).toHaveBeenCalledTimes(2); expect(botones($('tarjetas-facturas'))).toHaveLength(0);
    expect(textos($('tarjetas-facturas')).filter((t) => t === 'Estado: Cobrada')).toHaveLength(2);
  });

  it('factura ya cobrada no ofrece segundo cobro y conserva la otra pendiente', async () => {
    const { $, api } = await preparar({ consultar: vi.fn().mockResolvedValue({ ...proceso(), cobros: [cobro()] }) }, '3');
    expect(api.consultar).toHaveBeenCalledWith(3);
    expect(botones($('tarjetas-facturas')).map((b) => b.textContent)).toEqual(['Registrar cobro de GASTOS/COMISIÓN']);
    expect(textos($('tarjetas-facturas'))).toContain('Fecha de cobro: 2026-10-11');
    await $('formulario-registro-cobro').dispatch('submit'); expect(api.cobrar).not.toHaveBeenCalled();
  });

  it.each(['99,99', '100,01', '1e2'])('rechaza alterar el importe fijo a %s', async (importe) => {
    const { $, api } = await preparar(); await consultar($); await abrir($);
    expect($('importe-cobro').value).toBe('100,00'); $('importe-cobro').value = importe; await guardar($);
    expect(api.cobrar).not.toHaveBeenCalled(); expect($('error-cobros').textContent).toContain('total de la factura');
  });

  it('importe cero y justificante vacío usan el total exacto y null sin redondear', async () => {
    const datos = proceso(); datos.facturas[0].importe_total = '0.00';
    const { $, api } = await preparar({ consultar: vi.fn().mockResolvedValue(datos) }); await consultar($); await abrir($);
    $('justificante-cobro').value = ' '; await guardar($);
    expect(api.cobrar).toHaveBeenCalledWith(3, 10, { fecha_cobro: '2026-10-11', importe_cobrado: '0.00', justificante: null });
  });

  it('no pide referencia y valida fecha real y confirmación explícita sin POST', async () => {
    const { $, api } = await preparar();
    expect($('referencia-cobros')).toBeUndefined();
    expect(api.consultar).not.toHaveBeenCalled(); await consultar($); await abrir($);
    $('fecha-cobro').value = '2026-02-30'; $('confirmacion-cobro').checked = true; await $('formulario-registro-cobro').dispatch('submit');
    $('fecha-cobro').value = '2026-10-11'; $('confirmacion-cobro').checked = false; await $('formulario-registro-cobro').dispatch('submit');
    expect(api.cobrar).not.toHaveBeenCalled();
    for (const fecha of ['0000-01-01', '2026-02-29', '1900-02-29', '2026-13-01', '2026-00-01']) expect(fechaCobroValida(fecha)).toBe(false);
    for (const fecha of ['0001-01-01', '2000-02-29', '2024-02-29', '9999-12-31']) expect(fechaCobroValida(fecha)).toBe(true);
  });

  it.each(['REVISION', 'REABIERTA'])('estado %s no ofrece registrar cobros ni reapertura', async (estado) => {
    const { $, api } = await preparar({ consultar: vi.fn().mockResolvedValue({ ...proceso(), estado }) }); await consultar($);
    expect(botones($('tarjetas-facturas'))).toHaveLength(0); expect(api.cobrar).not.toHaveBeenCalled();
    expect(textos($('tarjetas-facturas')).join(' ')).toMatch(estado === 'REVISION' ? /no hay facturas emitidas/ : /debe reemitirse/);
  });

  it('errores de consulta y registro conservan entradas para revisión explícita', async () => {
    const { $, api } = await preparar({ consultar: vi.fn().mockRejectedValueOnce(new Error('No encontrada')).mockResolvedValue(proceso()),
      cobrar: vi.fn().mockRejectedValue(new ErrorFacturacion('Fecha inválida', 400)) });
    await consultar($); expect($('filas-cobros').children).toHaveLength(1); expect($('error-cobros').textContent).toBe('No encontrada');
    await consultar($); await abrir($); $('justificante-cobro').value = 'Referencia'; await guardar($);
    expect($('paso-registro').hidden).toBe(false); expect($('justificante-cobro').value).toBe('Referencia');
    expect($('guardar-cobro').disabled).toBe(false); expect($('error-cobros').textContent).toBe('Fecha inválida');
  });

  it('409 duplicado exige refresco y oculta segundo cobro cuando GET lo confirma', async () => {
    const { $, api } = await preparar({ cobrar: vi.fn().mockRejectedValue(new ErrorFacturacion('Factura ya cobrada', 409)) });
    await consultar($); await abrir($); await guardar($);
    expect($('recuperar-cobro').hidden).toBe(false); await guardar($); expect(api.cobrar).toHaveBeenCalledOnce();
    api.consultar.mockResolvedValue({ ...proceso(), cobros: [cobro()] }); await $('recuperar-cobro').dispatch('click');
    expect(botones($('tarjetas-facturas')).map((b) => b.textContent)).toEqual(['Registrar cobro de GASTOS/COMISIÓN']);
    expect($('bloqueo-reapertura').textContent).toContain('Reapertura bloqueada');
  });

  it('cobro incierto bloquea navegación/repetición; GET fallido conserva el bloqueo', async () => {
    const { $, api } = await preparar({ cobrar: vi.fn().mockRejectedValue(new ErrorFacturacion('Sin respuesta')) });
    await consultar($); await abrir($); await guardar($);
    expect($('guardar-cobro').disabled).toBe(true); await $('cancelar-cobro').dispatch('click'); expect($('paso-registro').hidden).toBe(false);
    await guardar($); expect(api.cobrar).toHaveBeenCalledOnce();
    api.consultar.mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue({ ...proceso(), cobros: [cobro()] });
    await $('recuperar-cobro').dispatch('click'); expect($('recuperar-cobro').hidden).toBe(false);
    await $('recuperar-cobro').dispatch('click'); expect($('recuperar-cobro').hidden).toBe(true);
    expect(api.cobrar).toHaveBeenCalledOnce();
  });

  it('recuperación sin cobro permite nueva revisión y conserva fecha/justificante sin POST automático', async () => {
    const { $, api } = await preparar({ cobrar: vi.fn().mockRejectedValue(new ErrorFacturacion('Sin respuesta')) });
    await consultar($); await abrir($); $('justificante-cobro').value = 'Conservar'; await guardar($);
    await $('recuperar-cobro').dispatch('click'); expect(api.cobrar).toHaveBeenCalledOnce(); await abrir($);
    expect($('justificante-cobro').value).toBe('Conservar'); expect($('fecha-cobro').value).toBe('2026-10-11');
    expect($('confirmacion-cobro').checked).toBe(false);
  });

  it('bloquea doble envío, navegación y cambios durante el registro', async () => {
    let resolver; const { $, api } = await preparar({ cobrar: vi.fn().mockReturnValue(new Promise((r) => { resolver = r; })) });
    await consultar($); await abrir($); const envio = guardar($);
    expect($('fecha-cobro').disabled).toBe(true); await guardar($); await $('cancelar-cobro').dispatch('click');
    expect(api.cobrar).toHaveBeenCalledOnce(); expect($('paso-registro').hidden).toBe(false);
    resolver(cobro()); await envio; expect($('paso-facturas').hidden).toBe(false);
  });

  it('respuestas incompletas o importes históricos parciales no habilitan nuevos cobros', async () => {
    const malos = { ...proceso(), cobros: [{ ...cobro(), importe_cobrado: '50.00' }] };
    const { $, api } = await preparar({ consultar: vi.fn().mockResolvedValueOnce(malos).mockResolvedValue(proceso()), cobrar: vi.fn().mockResolvedValue(null) });
    await consultar($); expect($('paso-consulta').hidden).toBe(false); expect($('error-cobros').textContent).toContain('coherentes');
    await consultar($); await abrir($); await guardar($); expect($('recuperar-cobro').hidden).toBe(false);
  });

  it('fallo en consulta automática exige recuperar por GET; cambios invalidan confirmación', async () => {
    const listeners = {}; vi.stubGlobal('addEventListener', (n, f) => { listeners[n] = f; });
    const { $, api } = await preparar(); await consultar($); await abrir($); $('confirmacion-cobro').checked = true;
    await $('justificante-cobro').dispatch('input'); expect($('confirmacion-cobro').checked).toBe(false);
    await $('cancelar-cobro').dispatch('click'); api.consultar.mockRejectedValue(new Error('Error de refresco'));
    await listeners.pageshow({ persisted: true }); expect($('recuperar-cobro').hidden).toBe(false);
    expect(botones($('tarjetas-facturas')).every((b) => b.disabled)).toBe(true);
  });

  it('sirve recursos/accesos y cliente envía el contrato existente por factura', async () => {
    const html = await request(app).get('/cobros-municipales.html'); expect(html.status).toBe(200); expect(html.text).toContain('readonly');
    expect((await request(app).get('/')).text).toContain('/cobros-municipales.html');
    expect((await request(app).get('/facturacion-emision.html')).text).toContain('Registrar cobros municipales');
    for (const path of ['/js/cobros-municipales.js', '/css/cobros-municipales.css']) expect((await request(app).get(path)).status).toBe(200);
    const css = await readFile(new URL('../public/css/cobros-municipales.css', import.meta.url), 'utf8');
    expect(css).toContain('#tabla-cobros { width: 100%; min-width: 0; table-layout: fixed; }');
    expect(css).toContain('@media (max-width: 48rem)'); expect(css).toContain('#tabla-cobros td::before { content: attr(data-label);');
    expect(css).toContain('.facturas-municipales strong { white-space: nowrap; overflow-wrap: normal; word-break: keep-all; }');
    const datos = { fecha_cobro: '2026-10-11', importe_cobrado: '100.00', justificante: null };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => cobro() })); await cobrar(3, 10, datos);
    expect(fetch).toHaveBeenCalledWith('/facturaciones/3/facturas/10/cobro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
  });
});

describe('listado y liquidaciones a farmacias', () => {
  it('carga automáticamente y ordena año/mes descendente y Ayuntamiento alfabético', async () => {
    const fila = { facturacion_id: 3, ayuntamiento: 'Zeta', mes: 9, anio: 2026, importe_precintos: '100.00', importe_comision: '3.27', factura_precintos_cobrada: false, factura_comision_cobrada: false, fecha_prevista_liquidacion: null };
    const { $, api } = await preparar({ listarEmitidas: vi.fn().mockResolvedValue([
        fila, { ...fila, facturacion_id: 4, ayuntamiento: 'Alfa' }, { ...fila, facturacion_id: 5, mes: 1, anio: 2027 },
      { ...fila, facturacion_id: 6, mes: 12, anio: 2025 },
    ]) });
    expect(api.listarEmitidas).toHaveBeenCalledOnce(); expect(api.consultar).not.toHaveBeenCalled();
    expect($('filas-cobros').children.map((r) => r.children.slice(0, 2).map((c) => c.textContent)))
      .toEqual([['01/2027', 'Zeta'], ['09/2026', 'Alfa'], ['09/2026', 'Zeta'], ['12/2025', 'Zeta']]);
    expect(textos($('filas-cobros'))).toContain('Sin fecha prevista');
    expect(textos($('filas-cobros'))).toContain('Pendiente');
  });

  it.each([[false,false,'pendiente'],[true,false,'parcial'],[false,true,'parcial'],[true,true,'cobrada']])
    ('muestra estados individuales y filtra estado conjunto %s/%s', async (precintos, comision, estado) => {
      const filas = [
        { facturacion_id: 31, ayuntamiento: 'Uno', mes: 9, anio: 2026, importe_precintos: '1.00', importe_comision: '0.01', factura_precintos_cobrada: precintos, factura_comision_cobrada: comision, fecha_prevista_liquidacion: '2026-10-20', numero_factura_precintos: '00001-A', numero_factura_comision: 'GEN-000002' },
        { facturacion_id: 32, ayuntamiento: 'Dos', mes: 9, anio: 2026, importe_precintos: '2.00', importe_comision: '0.02', factura_precintos_cobrada: !precintos, factura_comision_cobrada: !comision, fecha_prevista_liquidacion: null },
      ];
      const { $, api } = await preparar({ listarEmitidas: vi.fn().mockResolvedValue(filas) });
      const r = $('filas-cobros').children.find((tr) => tr.children[1].textContent === 'Uno');
      const contenidoFacturas = ['PRECINTOS', 'Número oficial: 00001-A', `1,00 € · ${precintos ? 'Cobrada' : 'Pendiente'}`,
        'GASTOS/COMISIÓN', 'Número oficial: GEN-000002', `0,01 € · ${comision ? 'Cobrada' : 'Pendiente'}`];
      expect(textos(r.children[2])).toEqual(contenidoFacturas);
      expect(r.children[3].textContent).toBe(estado === 'pendiente' ? 'Pendiente' : estado === 'parcial' ? 'Parcial' : 'Cobrada');
      expect(r.children[4].textContent).toBe('2026-10-20');
      expect(r.children.map((td) => td.attributes['data-label'])).toEqual(['Periodo facturado', 'Ayuntamiento', 'Facturas municipales', 'Estado conjunto del cobro', 'Fecha prevista de liquidación a farmacias', 'Acción']);
      $('estado-cobro-filtro').value = estado; await $('estado-cobro-filtro').dispatch('change');
      const expectedNames = estado === 'parcial' ? ['Dos', 'Uno'] : ['Uno'];
      expect($('filas-cobros').children.map((tr) => tr.children[1].textContent)).toEqual(expectedNames);
      $('ayuntamiento-filtro').value = 'Uno'; await $('ayuntamiento-filtro').dispatch('input');
      $('periodo-filtro').value = '2026-09'; await $('periodo-filtro').dispatch('change');
      expect($('filas-cobros').children).toHaveLength(1);
      expect(textos($('filas-cobros').children[0].children[2])).toEqual(contenidoFacturas);
      expect(api.listarEmitidas).toHaveBeenCalledOnce();
    });

  it.each([undefined, null, '', '  '])('muestra Sin número si falta la referencia oficial (%s)', async (numero) => {
    const fila = { facturacion_id: 3, ayuntamiento: 'Ayuntamiento ficticio', mes: 9, anio: 2026,
      importe_precintos: '1.00', importe_comision: '0.03', factura_precintos_cobrada: false, factura_comision_cobrada: true,
      numero_factura_precintos: numero, numero_factura_comision: 'GEN-000003', fecha_prevista_liquidacion: null };
    const { $ } = await preparar({ listarEmitidas: vi.fn().mockResolvedValue([fila]) });
    const bloques = $('filas-cobros').children[0].children[2].children[0].children;
    expect(textos(bloques[0])).toEqual(['PRECINTOS', 'Sin número', '1,00 € · Pendiente']);
    expect(textos(bloques[1])).toEqual(['GASTOS/COMISIÓN', 'Número oficial: GEN-000003', '0,03 € · Cobrada']);
  });

  it('filtra sin ID y abre directamente el detalle correcto; conserva filtros al volver', async () => {
    const history = { replaceState: vi.fn() }; vi.stubGlobal('history', history);
    const { $, api } = await preparar(); $('ayuntamiento-filtro').value = 'a1'; await $('ayuntamiento-filtro').dispatch('input');
    $('periodo-filtro').value = '2026-09'; await $('periodo-filtro').dispatch('change');
    await consultar($); expect(api.consultar).toHaveBeenCalledWith(3); expect(api.consultarLiquidacion).toHaveBeenCalledWith(3);
    expect($('contexto-cobros').textContent).toBe('Ayuntamiento A1 · Periodo facturado: 09/2026');
    expect($('paso-consulta').hidden).toBe(true); expect($('referencia-cobros')).toBeUndefined();
    expect($('documentos-cobros')).toBeUndefined(); expect($('actualizar-cobros')).toBeUndefined();
    await $('cambiar-facturacion-cobros').dispatch('click');
    expect($('paso-consulta').hidden).toBe(false); expect($('seccion-liquidacion').hidden).toBe(true);
    expect($('ayuntamiento-filtro').value).toBe('a1'); expect($('periodo-filtro').value).toBe('2026-09');
    expect(api.listarEmitidas).toHaveBeenCalledTimes(2);
    $('estado-cobro-filtro').value = 'pendiente'; await $('estado-cobro-filtro').dispatch('change');
    expect(history.replaceState).toHaveBeenLastCalledWith(null, '', '/cobros-municipales.html?ayuntamiento_filtro=a1&periodo_filtro=2026-09&estado_cobro_filtro=pendiente');
    $('ayuntamiento-filtro').value = 'ausente'; await $('ayuntamiento-filtro').dispatch('input');
    expect($('tabla-cobros').hidden).toBe(true); expect($('estado-listado').textContent).toContain('coincidan');
  });

  it('restaura filtros de URL y permite acceso directo desde emisión sin segunda búsqueda', async () => {
    vi.stubGlobal('location', { search: '?facturacion_id=3&ayuntamiento_filtro=A1&periodo_filtro=2026-09' });
    const { $, api } = await preparar({}, '3');
    expect($('ayuntamiento-filtro').value).toBe('A1'); expect($('periodo-filtro').value).toBe('2026-09');
    expect($('paso-facturas').hidden).toBe(false); expect(api.consultar).toHaveBeenCalledOnce();
  });

  it('cada fila consulta su facturación, sin cálculo, reemisión ni referencia manual', async () => {
    const filas = [3, 7].map((id) => ({ facturacion_id: id, ayuntamiento: `Ayuntamiento ${id}`, mes: 9, anio: 2026, importe_precintos: '100.00', importe_comision: '3.27', factura_precintos_cobrada: false, factura_comision_cobrada: false, fecha_prevista_liquidacion: null }));
    const { $, api } = await preparar({ listarEmitidas: vi.fn().mockResolvedValue(filas),
      consultar: vi.fn().mockImplementation(async (id) => ({ ...proceso(), facturacion_id: id })), emitir: vi.fn(), calcular: vi.fn() });
    await botones($('filas-cobros'))[1].dispatch('click');
    expect(api.consultar).toHaveBeenCalledWith(7); expect(api.consultarLiquidacion).toHaveBeenCalledWith(7);
    expect($('contexto-cobros').textContent).toBe('Ayuntamiento 7 · Periodo facturado: 09/2026');
    expect(api.emitir).not.toHaveBeenCalled(); expect(api.calcular).not.toHaveBeenCalled();
  });

  it('restauración del navegador consulta automáticamente el estado actual', async () => {
    const listeners = {}; vi.stubGlobal('addEventListener', (n, f) => { listeners[n] = f; });
    const { api } = await preparar({}, '3');
    await listeners.pageshow({ persisted: true });
    expect(api.listarEmitidas).toHaveBeenCalledTimes(2); expect(api.consultar).toHaveBeenCalledTimes(2); expect(api.consultarLiquidacion).toHaveBeenCalledTimes(2);
  });

  it('lista vacía y errores permiten reintentar sin operaciones financieras', async () => {
    const { $, api } = await preparar({ listarEmitidas: vi.fn().mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue([]) });
    expect($('reintentar-listado').hidden).toBe(false); await $('reintentar-listado').dispatch('click');
    expect($('estado-listado').textContent).toContain('Todavía no hay'); expect(api.consultar).not.toHaveBeenCalled(); expect(api.cobrar).not.toHaveBeenCalled();
  });

  it.each([[[]], [[11]]])('no permite preparar sin cobro de PRECINTOS aunque COMISIÓN esté cobrada (%s)', async (ids) => {
    const { $, api } = await preparar({ consultar: vi.fn().mockResolvedValue({ ...proceso(), cobros: ids.map(cobro) }), prepararLiquidacion: vi.fn() }, '3');
    expect($('preparar-liquidacion').hidden).toBe(true); await $('preparar-liquidacion').dispatch('click');
    expect(api.prepararLiquidacion).not.toHaveBeenCalled(); expect($('estado-liquidacion').textContent).toContain('cobro completo de PRECINTOS');
  });

  it('PRECINTOS cobrada habilita preparar sin exigir COMISIÓN y sin preparación automática', async () => {
    const { $, api } = await preparar({ prepararLiquidacion: vi.fn().mockResolvedValue(propuesta()) }, '3');
    await abrir($); await guardar($);
    expect($('preparar-liquidacion').hidden).toBe(false); expect(api.prepararLiquidacion).not.toHaveBeenCalled();
    await $('preparar-liquidacion').dispatch('click'); expect(api.prepararLiquidacion).toHaveBeenCalledWith(3);
    expect($('formulario-liquidacion').hidden).toBe(false); expect($('fecha-liquidacion').value).toBe('2026-10-12');
    expect(textos($('detalles-liquidacion'))).toContain('Importe completo: 60,00 €');
    expect(textos($('detalles-liquidacion'))).toContain('Importe completo: 40,00 €');
  });

  it('revisa titulares y cuentas, congela fecha editada e importes completos; descarga solo tras confirmar', async () => {
    const { $, api } = await prepararLote();
    expect($('guardar-liquidacion').disabled).toBe(true); expect($('exportar-liquidacion').hidden).toBe(true);
    const campos = inputsLiquidacion($); campos[0].denominacion_farmacia.value = 'Titular TEST revisado';
    for (const [campo, valor] of Object.entries(cuentaBancariaTest(202))) campos[0][campo].value = valor;
    $('confirmacion-liquidacion').checked = true;
    await campos[0].cuenta_bancaria.dispatch('input'); expect($('confirmacion-liquidacion').checked).toBe(false);
    $('fecha-liquidacion').value = '2026-10-17'; await $('fecha-liquidacion').dispatch('input');
    $('confirmacion-liquidacion').checked = true; await $('confirmacion-liquidacion').dispatch('input');
    expect($('guardar-liquidacion').disabled).toBe(false);
    await $('formulario-liquidacion').dispatch('submit');
    expect(api.confirmarLiquidacion).toHaveBeenCalledWith(3, { fecha_pago: '2026-10-17', detalles: [
      { ...propuesta().detalles[0], denominacion_farmacia: 'Titular TEST revisado', ...cuentaBancariaTest(202) }, propuesta().detalles[1],
    ] });
    expect($('estado-liquidacion').textContent).toContain('Liquidación confirmada'); expect($('estado-liquidacion').textContent).not.toMatch(/pagad/i);
    expect($('formulario-liquidacion').hidden).toBe(true); expect($('preparar-liquidacion').hidden).toBe(true);
    expect($('exportar-liquidacion').href).toBe('/facturaciones/3/liquidacion/contabilidad'); expect($('exportar-liquidacion').hidden).toBe(false);
    await $('formulario-liquidacion').dispatch('submit'); expect(api.confirmarLiquidacion).toHaveBeenCalledOnce();
  });

  it('lote histórico muestra snapshots sin ofrecer preparación ni corrección', async () => {
    const { $, api } = await preparar({ consultarLiquidacion: vi.fn().mockResolvedValue({ ...propuesta(), cuadra: true }), prepararLiquidacion: vi.fn() }, '3');
    expect(textos($('liquidacion-confirmada'))).toContain(`Cuenta utilizada: ${Object.values(cuentaBancariaTest()).join('')}`);
    expect($('preparar-liquidacion').hidden).toBe(true); expect($('formulario-liquidacion').hidden).toBe(true);
    await $('preparar-liquidacion').dispatch('click'); expect(api.prepararLiquidacion).not.toHaveBeenCalled(); expect(api.cobrar).not.toHaveBeenCalled();
  });

  it('error de consulta no se trata como ausencia de liquidación', async () => {
    const { $, api } = await preparar({ consultarLiquidacion: vi.fn().mockRejectedValue(new ErrorFacturacion('Servidor no disponible', 500)), prepararLiquidacion: vi.fn() }, '3');
    expect($('estado-liquidacion').textContent).toContain('No se pudo consultar'); expect($('preparar-liquidacion').hidden).toBe(true);
    await $('preparar-liquidacion').dispatch('click'); expect(api.prepararLiquidacion).not.toHaveBeenCalled();
    expect($('recuperar-cobro').hidden).toBe(false);
    api.consultarLiquidacion.mockRejectedValue(new ErrorFacturacion('Liquidación confirmada no encontrada.', 404));
    await $('recuperar-cobro').dispatch('click');
    expect($('recuperar-cobro').hidden).toBe(true); expect($('estado-liquidacion').textContent).toContain('Se requiere el cobro completo de PRECINTOS');
    expect(api.cobrar).not.toHaveBeenCalled(); expect(api.prepararLiquidacion).not.toHaveBeenCalled();
  });

  it('cobro confirmado se conserva si falla la consulta posterior de liquidación', async () => {
    const { $, api } = await preparar({}, '3');
    api.consultarLiquidacion.mockRejectedValue(new ErrorFacturacion('Sin conexión'));
    await abrir($); await guardar($);
    expect(textos($('tarjetas-facturas'))).toContain('Estado: Cobrada'); expect($('recuperar-cobro').hidden).toBe(false);
    expect($('estado-cobros').textContent).toContain('Cobro completo registrado'); expect($('preparar-liquidacion').hidden).toBe(true);
    expect(api.cobrar).toHaveBeenCalledOnce();
    api.consultar.mockResolvedValue({ ...proceso(), cobros: [cobro()] });
    api.consultarLiquidacion.mockRejectedValue(new ErrorFacturacion('Liquidación confirmada no encontrada.', 404));
    await $('recuperar-cobro').dispatch('click');
    expect($('preparar-liquidacion').hidden).toBe(false); expect($('recuperar-cobro').hidden).toBe(true);
    expect(api.cobrar).toHaveBeenCalledOnce();
  });

  it('detalle sin accesos documentales ni refresco manual; Facturación conserva sus documentos', async () => {
    const html = await readFile(new URL('../public/cobros-municipales.html', import.meta.url), 'utf8');
    expect(html).not.toContain('Ver e imprimir documentos'); expect(html).not.toContain('Consultar estado actual');
    expect(html).not.toContain('documentos-cobros'); expect(html).not.toContain('actualizar-cobros');
    const listado = await readFile(new URL('../public/js/facturacion-listado.js', import.meta.url), 'utf8');
    expect(listado).toContain('Ver documentos'); expect(listado).toContain('/documentos-facturacion.html?');
    const { $, api } = await preparar({}, '3');
    expect(api.consultar).toHaveBeenCalledOnce(); expect(api.consultarLiquidacion).toHaveBeenCalledOnce();
    expect($('recuperar-cobro').hidden).toBe(true); expect($('contexto-cobros').textContent).toContain('09/2026');
  });

  it('cancelar la revisión no confirma ni guarda un borrador', async () => {
    const { $, api } = await prepararLote(); await $('cancelar-liquidacion').dispatch('click');
    expect($('formulario-liquidacion').hidden).toBe(true); expect($('preparar-liquidacion').hidden).toBe(false);
    expect(api.confirmarLiquidacion).not.toHaveBeenCalled();
  });

  it('una respuesta de propuesta incoherente no permite confirmar importes ni detalles', async () => {
    const p = propuesta(); p.detalles[0].importe = '59.99';
    const { $, api } = await prepararLote({ prepararLiquidacion: vi.fn().mockResolvedValue(p) });
    expect($('formulario-liquidacion').hidden).toBe(true); expect($('error-cobros').textContent).toContain('no pudo verificarse');
    await $('formulario-liquidacion').dispatch('submit'); expect(api.confirmarLiquidacion).not.toHaveBeenCalled();
  });

  it('confirmación incoherente exige recuperación, sin afirmar que el lote quedó confirmado', async () => {
    const { $, api } = await prepararLote({ confirmarLiquidacion: vi.fn().mockResolvedValue({ ...propuesta(), fecha_pago: '2026-10-13', cuadra: true }) });
    $('confirmacion-liquidacion').checked = true; await $('formulario-liquidacion').dispatch('submit');
    expect($('recuperar-cobro').hidden).toBe(false); expect($('exportar-liquidacion').hidden).toBe(true);
    expect(api.confirmarLiquidacion).toHaveBeenCalledOnce();
  });

  it('error de validación conserva el lote y permite corregir; controles impiden enviar vacío o fecha imposible', async () => {
    const { $, api } = await prepararLote({ confirmarLiquidacion: vi.fn().mockRejectedValue(new ErrorFacturacion('IBAN no válido', 400)) });
    $('confirmacion-liquidacion').checked = true; $('fecha-liquidacion').value = '2026-02-30'; await $('formulario-liquidacion').dispatch('submit');
    expect(api.confirmarLiquidacion).not.toHaveBeenCalled(); $('fecha-liquidacion').value = '2026-10-12';
    await $('formulario-liquidacion').dispatch('submit'); expect($('error-cobros').textContent).toBe('IBAN no válido');
    expect($('formulario-liquidacion').hidden).toBe(false); expect($('guardar-liquidacion').disabled).toBe(false);
    inputsLiquidacion($)[0].cif_nif.value = ''; await $('formulario-liquidacion').dispatch('submit');
    expect(api.confirmarLiquidacion).toHaveBeenCalledOnce(); expect($('error-cobros').textContent).toContain('Completa');
  });

  it.each([null, 409])('confirmación incierta/conflicto %s bloquea repetición; GET recupera el lote sin POST automático', async (estado) => {
    const { $, api } = await prepararLote({ confirmarLiquidacion: vi.fn().mockRejectedValue(new ErrorFacturacion('Consulta el estado', estado)) });
    $('confirmacion-liquidacion').checked = true; await $('formulario-liquidacion').dispatch('submit');
    expect($('recuperar-cobro').hidden).toBe(false); await $('formulario-liquidacion').dispatch('submit'); expect(api.confirmarLiquidacion).toHaveBeenCalledOnce();
    api.consultarLiquidacion.mockRejectedValueOnce(new ErrorFacturacion('Sin conexión')).mockResolvedValue({ ...propuesta(), cuadra: true });
    await $('recuperar-cobro').dispatch('click'); expect($('recuperar-cobro').hidden).toBe(false);
    await $('recuperar-cobro').dispatch('click'); expect($('recuperar-cobro').hidden).toBe(true);
    expect($('estado-liquidacion').textContent).toContain('Liquidación confirmada'); expect(api.confirmarLiquidacion).toHaveBeenCalledOnce();
  });

  it('doble confirmación no envía dos lotes ni permite navegar durante el envío', async () => {
    let resolver;
    const { $, api } = await prepararLote({ confirmarLiquidacion: vi.fn().mockReturnValue(new Promise((r) => { resolver = r; })) });
    $('confirmacion-liquidacion').checked = true; const envio = $('formulario-liquidacion').dispatch('submit');
    expect($('guardar-liquidacion').disabled).toBe(true); await $('formulario-liquidacion').dispatch('submit');
    await $('cambiar-facturacion-cobros').dispatch('click'); expect($('paso-facturas').hidden).toBe(false);
    resolver({ ...propuesta(), cuadra: true }); await envio; expect(api.confirmarLiquidacion).toHaveBeenCalledOnce();
  });

  it('cliente reutiliza las tres rutas de liquidación y cuerpos existentes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => propuesta() }));
    await consultarLiquidacion(3); await prepararLiquidacion(3); const d = { fecha_pago: propuesta().fecha_pago, detalles: propuesta().detalles }; await confirmarLiquidacion(3, d);
    expect(fetch).toHaveBeenNthCalledWith(1, '/facturaciones/3/liquidacion', { method: 'GET' });
    expect(fetch).toHaveBeenNthCalledWith(2, '/facturaciones/3/liquidacion/preparacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(fetch).toHaveBeenNthCalledWith(3, '/facturaciones/3/liquidacion/confirmacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
  });
});
