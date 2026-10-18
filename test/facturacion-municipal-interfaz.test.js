import { readFile } from 'node:fs/promises';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import { iniciarFacturacion } from '../public/js/facturacion-municipal.js';
import * as cliente from '../public/js/facturacion-municipal-api.js';

class Elemento {
  constructor(tag = '') { this.tag = tag; this.value = ''; this.checked = false; this.hidden = false; this.disabled = false; this.children = []; this.listeners = new Map(); this.attributes = {}; }
  addEventListener(n, f) { this.listeners.set(n, [...(this.listeners.get(n) ?? []), f]); }
  async dispatch(n, event = { preventDefault() {} }) { for (const f of this.listeners.get(n) ?? []) await f(event); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(n, v) { this.attributes[n] = v; }
  focus() { this.focused = true; }
}
const revision = () => ({ facturacion_id: 3, estado: 'REVISION', cantidad_precintos: 2, importe_total: '5.00', requiere_recalculo: false,
  participaciones: [{ id: 4, farmacia_id: 2, soe_b: '0002', denominacion_b: '<B histórico>', cif_b: 'TEST-CIF-0003', cantidad_precintos: 2, importe_precintos: '5.00' }] });
const previa = () => ({ facturacion_id: 3, estado: 'REVISION', cantidad_precintos: 2, importe_precintos: '5.00', base_calculo: '5.00',
  porcentaje_comision: '2.7000', importe_comision: '0.14', porcentaje_iva: '21.0000', importe_iva: '0.03', importe_total_comision: '0.17', importe_total_conjunto: '5.17' });
const emitida = () => ({ facturacion_id: 3, estado: 'EMITIDA', facturas: [
  { tipo: 'PRECINTOS', numero_factura: '000P', importe_total: '5.00' }, { tipo: 'COMISION', numero_factura: '000C', importe_total: '0.17' }] });
const textos = (n) => [n.textContent, ...n.children.flatMap(textos)].filter((v) => v !== undefined);
const encontrar = (n, tag) => n.children.flatMap((e) => [...(e.tag === tag ? [e] : []), ...encontrar(e, tag)]);
const preparar = async (overrides = {}) => {
  const html = await readFile(new URL('../public/facturacion-emision.html', import.meta.url), 'utf8');
  const nodes = new Map([...html.matchAll(/id="([^"]+)"/g)].map((m) => [m[1], new Elemento()]));
  const $ = (id) => nodes.get(id);
  for (const id of ['paso-revision', 'paso-emision', 'paso-resultado', 'formulario-b', 'recuperar-facturacion']) $(id).hidden = true;
  $('pantalla-facturacion').querySelectorAll = () => [...nodes.values(), ...encontrar($('lista-participaciones'), 'button')];
  vi.stubGlobal('document', { getElementById: $, createElement: (tag) => new Elemento(tag) });
  const api = { listarPendientes: vi.fn().mockResolvedValue([{ ayuntamiento_id: 1, denominacion: 'Villa', periodo_id: 5, mes: 1, anio: 2026, estado: 'REVISION', facturacion_id: 3 }]), calcular: vi.fn().mockResolvedValue(revision()),
    consultar: vi.fn().mockResolvedValue(revision()), corregirB: vi.fn().mockImplementation(async (id, p, b) => ({ id: p, ...b })),
    previsualizar: vi.fn().mockResolvedValue(previa()), emitir: vi.fn().mockResolvedValue(emitida()), ...overrides };
  await iniciarFacturacion({ api });
  $('ayuntamiento-facturacion').value = '1'; await $('ayuntamiento-facturacion').dispatch('change');
  $('periodo-facturacion').value = '5'; await $('periodo-facturacion').dispatch('change');
  return { $, api };
};
const seleccionar = ($) => $('formulario-seleccion').dispatch('submit');
const continuar = ($) => $('continuar-emision').dispatch('click');
const numeros = ($) => { $('numero-precintos').value = '  000P  '; $('numero-comision').value = '000C'; $('confirmacion-emision').checked = true; };
afterEach(() => vi.unstubAllGlobals());

describe('revisión y emisión municipal', () => {
  it('continúa directamente la facturación reabierta del enlace del listado, sin preparar otra cabecera', async () => {
    vi.stubGlobal('location', { search: '?facturacion_id=3' });
    const reabierta = { ...revision(), estado: 'REABIERTA', facturas: emitida().facturas, cobros: [] };
    const { $, api } = await preparar({ consultar: vi.fn().mockResolvedValue(reabierta) });
    expect(api.consultar).toHaveBeenCalledExactlyOnceWith(3); expect(api.calcular).not.toHaveBeenCalled();
    expect($('paso-revision').hidden).toBe(false); expect($('estado-facturacion').textContent).toContain('REABIERTA');
    await continuar($); expect($('numero-precintos').value).toBe('000P');
    $('confirmacion-emision').checked = true; await $('formulario-emision').dispatch('submit');
    expect(api.emitir).toHaveBeenCalledExactlyOnceWith(3, {});
  });
  it('ofrece solo los periodos del Ayuntamiento elegido y rechaza parejas no devueltas por el servidor', async () => {
    const { $, api } = await preparar({ listarPendientes: vi.fn().mockResolvedValue([
      { ayuntamiento_id: 1, denominacion: 'Villa', periodo_id: 5, mes: 1, anio: 2026, estado: 'REVISION' },
      { ayuntamiento_id: 1, denominacion: 'Villa', periodo_id: 6, mes: 2, anio: 2026, estado: 'REABIERTA' },
      { ayuntamiento_id: 2, denominacion: 'Otra villa', periodo_id: 7, mes: 3, anio: 2026, estado: 'SIN_FACTURAR' },
    ]) });
    expect($('ayuntamiento-facturacion').children.map(o => o.value)).toEqual(['', '1', '2']);
    expect($('periodo-facturacion').children.map(o => o.value)).toEqual(['', '5', '6']);
    expect(textos($('periodo-facturacion'))).toContain('02/2026 · Reabierta');
    $('ayuntamiento-facturacion').value = '2'; await $('ayuntamiento-facturacion').dispatch('change');
    expect($('periodo-facturacion').value).toBe(''); expect($('preparar-facturacion').disabled).toBe(true);
    expect($('periodo-facturacion').children.map(o => o.value)).toEqual(['', '7']);
    $('periodo-facturacion').value = '5'; await seleccionar($); expect(api.calcular).not.toHaveBeenCalled();
    $('periodo-facturacion').value = '7'; await $('periodo-facturacion').dispatch('change');
    expect($('preparar-facturacion').disabled).toBe(false);
    await seleccionar($); expect(api.calcular).toHaveBeenCalledExactlyOnceWith({ ayuntamiento_id: 2, periodo_id: 7 });
    expect(api.emitir).not.toHaveBeenCalled();
  });

  it('consulta de nuevo pendientes después de emitir y retira la combinación que ya no devuelve el servidor', async () => {
    const { $, api } = await preparar(); await seleccionar($); await continuar($); numeros($);
    await $('formulario-emision').dispatch('submit'); api.listarPendientes.mockResolvedValue([]);
    await $('otra-facturacion').dispatch('click');
    expect(api.listarPendientes).toHaveBeenCalledTimes(2);
    expect($('preparar-facturacion').disabled).toBe(true);
    expect($('ayuntamiento-facturacion').value).toBe('');
    expect($('estado-facturacion').textContent).toContain('No hay combinaciones');
  });
  it('la casilla habilita inmediatamente la emisión al marcar y la deshabilita al desmarcar', async () => {
    const { $, api } = await preparar(); await seleccionar($); await continuar($);
    const casilla = $('confirmacion-emision'), boton = $('confirmar-emision');
    expect(casilla.checked).toBe(false); expect(casilla.disabled).toBe(false);
    expect(boton.disabled).toBe(true);
    $('numero-precintos').value = '000P'; await $('numero-precintos').dispatch('input');
    $('numero-comision').value = '000C'; await $('numero-comision').dispatch('input');
    expect(boton.disabled).toBe(true);
    await $('formulario-emision').dispatch('submit'); expect(api.emitir).not.toHaveBeenCalled();
    // La activación nativa con ratón o Espacio cambia checked y emite input.
    casilla.checked = true; await casilla.dispatch('input'); expect(boton.disabled).toBe(false);
    expect(api.emitir).not.toHaveBeenCalled();
    casilla.checked = false; await casilla.dispatch('input'); expect(boton.disabled).toBe(true);
    await $('formulario-emision').dispatch('submit'); expect(api.emitir).not.toHaveBeenCalled();
    casilla.checked = true; await casilla.dispatch('input'); expect(boton.disabled).toBe(false);
    await $('formulario-emision').dispatch('submit');
    expect(api.emitir).toHaveBeenCalledExactlyOnceWith(3, { numero_factura_precintos: '000P', numero_factura_comision: '000C' });
    expect($('paso-resultado').hidden).toBe(false);
  });

  it('marcar la casilla no omite los números obligatorios ni el bloqueo durante la emisión', async () => {
    const { $, api } = await preparar(); await seleccionar($); await continuar($);
    $('confirmacion-emision').checked = true; await $('confirmacion-emision').dispatch('input');
    expect($('confirmar-emision').disabled).toBe(true);
    await $('formulario-emision').dispatch('submit'); expect(api.emitir).not.toHaveBeenCalled();
    numeros($); await $('confirmacion-emision').dispatch('input');
    expect($('confirmar-emision').disabled).toBe(false);
    let resolver; api.emitir.mockReturnValue(new Promise((r) => { resolver = r; }));
    const envio = $('formulario-emision').dispatch('submit');
    expect($('confirmacion-emision').disabled).toBe(true); expect($('confirmar-emision').disabled).toBe(true);
    await $('confirmacion-emision').dispatch('input'); expect($('confirmar-emision').disabled).toBe(true);
    await $('formulario-emision').dispatch('submit'); expect(api.emitir).toHaveBeenCalledOnce();
    resolver(emitida()); await envio;
    expect($('confirmar-emision').disabled).toBe(true);
  });

  it('selecciona, corrige farmacia conservando B interno, previsualiza y confirma con números textuales', async () => {
    const { $, api } = await preparar(); await seleccionar($);
    expect(api.calcular).toHaveBeenCalledWith({ ayuntamiento_id: 1, periodo_id: 5 });
    expect($('paso-seleccion').hidden).toBe(true); expect($('paso-revision').hidden).toBe(false);
    expect(textos($('lista-participaciones'))).toContain('<B histórico>');
    expect(encontrar($('lista-participaciones'), 'th').map((e) => e.textContent)).toEqual([
      'ID farmacia', 'SOE', 'Denominación', 'CIF', 'Precintos aptos', 'Importe', 'Revisión',
    ]);
    expect(encontrar($('lista-participaciones'), 'td')[0].textContent).toBe('2');
    expect(encontrar($('lista-participaciones'), 'button')[0].textContent).toBe('Corregir farmacia');
    expect(encontrar($('lista-participaciones'), 'button')[0].attributes['aria-label']).toBe('Corregir farmacia 0002 <B histórico>');
    await encontrar($('lista-participaciones'), 'button')[0].dispatch('click');
    expect($('titulo-b').textContent).toBe('Corregir farmacia · ID 2');
    $('denominacion-b').value = ' B corregido '; await $('formulario-b').dispatch('submit');
    expect(api.corregirB).toHaveBeenCalledWith(3, 4, { soe_b: '0002', denominacion_b: 'B corregido', cif_b: 'TEST-CIF-0003' });
    expect(textos($('lista-participaciones'))).toContain('B corregido');
    expect($('estado-facturacion').textContent).toBe('Datos de la farmacia guardados. Todavía pueden revisarse antes de emitir.');
    await continuar($); expect(api.previsualizar).toHaveBeenCalledWith(3); expect(api.emitir).not.toHaveBeenCalled();
    expect($('paso-revision').hidden).toBe(true); expect($('paso-emision').hidden).toBe(false);
    expect(textos($('resumen-emision'))).toEqual(expect.arrayContaining(['5,00 €', '0,14 €', '0,03 €', '0,17 €', '5,17 €']));
    numeros($); await $('formulario-emision').dispatch('submit');
    expect(api.emitir).toHaveBeenCalledWith(3, { numero_factura_precintos: '000P', numero_factura_comision: '000C' });
    expect($('paso-resultado').hidden).toBe(false); expect(textos($('facturas-emitidas')).join(' ')).toContain('Número 000P');
    expect($('referencia-emitida').textContent).toBe('Referencia de facturación: 3');
    expect($('enlace-cobros').href).toBe('/cobros-municipales.html?facturacion_id=3');
    await $('formulario-emision').dispatch('submit'); expect(api.emitir).toHaveBeenCalledOnce();
  });

  it('valida selección disponible, B vacío/largo y ambos números con confirmación explícita', async () => {
    const { $, api } = await preparar(); $('periodo-facturacion').value = '9'; await seleccionar($); expect(api.calcular).not.toHaveBeenCalled();
    $('periodo-facturacion').value = '5'; await seleccionar($); await encontrar($('lista-participaciones'), 'button')[0].dispatch('click');
    $('soe-b').value = ' '; await $('formulario-b').dispatch('submit'); expect(api.corregirB).not.toHaveBeenCalled();
    expect($('error-facturacion').textContent).toBe('Completa SOE, denominación y CIF de la farmacia dentro de las longitudes permitidas.');
    $('soe-b').value = 'a'.repeat(101); await $('formulario-b').dispatch('submit'); expect(api.corregirB).not.toHaveBeenCalled();
    await $('cancelar-b').dispatch('click'); await continuar($);
    for (const [p, c, confirmado] of [['', 'C', true], ['P', '', true], ['a'.repeat(201), 'C', true], ['P', 'C', false]]) {
      $('numero-precintos').value = p; $('numero-comision').value = c; $('confirmacion-emision').checked = confirmado;
      await $('formulario-emision').dispatch('submit'); expect(api.emitir).not.toHaveBeenCalled();
    }
  });

  it('sin aptos muestra advertencia y no ofrece emisión aunque quede importe histórico', async () => {
    const sin = { ...revision(), cantidad_precintos: 0, participaciones: [], advertencia: 'No hay precintos aptos para este Ayuntamiento y periodo.' };
    const { $, api } = await preparar({ calcular: vi.fn().mockResolvedValue(sin) }); await seleccionar($);
    expect($('advertencia-facturacion').textContent).toBe(sin.advertencia); expect($('continuar-emision').hidden).toBe(true);
    await continuar($); expect(api.previsualizar).not.toHaveBeenCalled(); expect(api.emitir).not.toHaveBeenCalled();
  });

  it('aptos de precio cero permiten continuar y si desaparecen en la previa retira emisión', async () => {
    const { $, api } = await preparar({ calcular: vi.fn().mockResolvedValue({ ...revision(), importe_total: '0.00' }) });
    await seleccionar($); expect($('continuar-emision').hidden).toBe(false);
    api.previsualizar.mockResolvedValue({ ...revision(), cantidad_precintos: 0, importe_total: '0.00', participaciones: [] });
    await continuar($); expect($('paso-revision').hidden).toBe(false); expect($('continuar-emision').hidden).toBe(true);
    expect($('estado-facturacion').textContent).toBe('No hay precintos aptos para emitir.');
  });

  it('errores de preparación/B conservan entradas y permiten reintento o cancelación', async () => {
    const { $, api } = await preparar({ calcular: vi.fn().mockRejectedValueOnce(new Error('Bloqueada')).mockResolvedValue(revision()),
      corregirB: vi.fn().mockRejectedValue(new cliente.ErrorFacturacion('B está congelado desde la emisión, también durante una reapertura.', 409)) });
    await seleccionar($); expect($('error-facturacion').textContent).toBe('Bloqueada'); expect($('ayuntamiento-facturacion').value).toBe('1');
    await seleccionar($); await encontrar($('lista-participaciones'), 'button')[0].dispatch('click');
    $('denominacion-b').value = 'Corrección'; await $('formulario-b').dispatch('submit');
    expect($('denominacion-b').value).toBe('Corrección'); expect($('formulario-b').hidden).toBe(false);
    expect($('guardar-b').disabled).toBe(false);
    expect($('error-facturacion').textContent).toBe('Los datos de la farmacia quedan fijados desde la emisión, también durante una reapertura.');
  });

  it('error de previsualización oculta confirmación, permite volver y reintentar sin emitir', async () => {
    const { $, api } = await preparar({ previsualizar: vi.fn().mockRejectedValueOnce(new Error('Falta configuración')).mockResolvedValue(previa()) });
    await seleccionar($); await continuar($);
    expect($('error-facturacion').textContent).toBe('Falta configuración'); expect($('formulario-emision').hidden).toBe(true);
    expect($('reintentar-previa').hidden).toBe(false); await $('volver-revision').dispatch('click');
    expect($('paso-revision').hidden).toBe(false); await continuar($); expect($('formulario-emision').hidden).toBe(false);
    expect(api.emitir).not.toHaveBeenCalled();
  });

  it('conflicto de numeración conserva números y requiere nueva previa antes de confirmar', async () => {
    const { $, api } = await preparar({ emitir: vi.fn().mockRejectedValue(new cliente.ErrorFacturacion('Número usado', 409)) });
    await seleccionar($); await continuar($); numeros($); await $('formulario-emision').dispatch('submit');
    expect($('numero-precintos').value).toBe('  000P  '); expect($('error-facturacion').textContent).toBe('Número usado');
    await $('formulario-emision').dispatch('submit'); expect(api.emitir).toHaveBeenCalledOnce();
    await $('reintentar-previa').dispatch('click'); expect(api.previsualizar).toHaveBeenCalledTimes(2); expect($('confirmacion-emision').checked).toBe(false);
  });

  it('emisión incierta bloquea repetición y navegación hasta recuperar las facturas por GET', async () => {
    const { $, api } = await preparar({ emitir: vi.fn().mockRejectedValue(new cliente.ErrorFacturacion('Red perdida')),
      consultar: vi.fn().mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue(emitida()) });
    await seleccionar($); await continuar($); numeros($); await $('formulario-emision').dispatch('submit');
    expect($('recuperar-facturacion').hidden).toBe(false); expect($('confirmar-emision').disabled).toBe(true);
    await $('volver-revision').dispatch('click'); expect($('paso-emision').hidden).toBe(false);
    await $('formulario-emision').dispatch('submit'); expect(api.emitir).toHaveBeenCalledOnce();
    await $('recuperar-facturacion').dispatch('click'); expect($('recuperar-facturacion').hidden).toBe(false);
    await $('recuperar-facturacion').dispatch('click'); expect(api.consultar).toHaveBeenCalledWith(3);
    expect($('paso-resultado').hidden).toBe(false); expect(api.emitir).toHaveBeenCalledOnce();
  });

  it('B incierto exige consulta y recupera la revisión sin repetir PUT', async () => {
    const { $, api } = await preparar({ corregirB: vi.fn().mockRejectedValue(new cliente.ErrorFacturacion('Sin respuesta')) });
    await seleccionar($); await encontrar($('lista-participaciones'), 'button')[0].dispatch('click');
    await $('formulario-b').dispatch('submit'); expect($('recuperar-facturacion').hidden).toBe(false);
    expect($('estado-facturacion').textContent).toBe('Corrección de farmacia pendiente de confirmar. Consulta antes de repetir.');
    await $('formulario-b').dispatch('submit'); expect(api.corregirB).toHaveBeenCalledOnce();
    await $('recuperar-facturacion').dispatch('click'); expect($('recuperar-facturacion').hidden).toBe(true);
    expect($('paso-revision').hidden).toBe(false);
  });

  it('reabierta muestra datos de farmacia fijados y conserva números originales sin enviar números nuevos', async () => {
    const reabierta = { ...revision(), estado: 'REABIERTA', facturas: emitida().facturas };
    const { $, api } = await preparar({ calcular: vi.fn().mockResolvedValue(reabierta), consultar: vi.fn().mockResolvedValue(reabierta) });
    await seleccionar($); expect(encontrar($('lista-participaciones'), 'button')).toHaveLength(0);
    expect($('estado-facturacion').textContent).toBe('Revisión correctiva preparada. Se conservan los datos de las farmacias y los números originales.');
    expect(textos($('lista-participaciones'))).toContain('Datos de farmacia fijados'); await continuar($);
    expect($('numero-precintos').readOnly).toBe(true); expect($('numero-precintos').value).toBe('000P');
    $('confirmacion-emision').checked = true; await $('formulario-emision').dispatch('submit');
    expect(api.emitir).toHaveBeenCalledWith(3, {});
  });

  it('bloquea doble envío y navegación durante cálculo y emisión', async () => {
    let resolver; const p = new Promise((r) => { resolver = r; });
    const { $, api } = await preparar({ calcular: vi.fn().mockReturnValue(p) });
    const envio = seleccionar($); await seleccionar($); expect(api.calcular).toHaveBeenCalledOnce();
    expect($('preparar-facturacion').disabled).toBe(true); resolver(revision()); await envio;
    await continuar($); numeros($); let terminar; api.emitir.mockReturnValue(new Promise((r) => { terminar = r; }));
    const emision = $('formulario-emision').dispatch('submit'); await $('formulario-emision').dispatch('submit');
    await $('volver-revision').dispatch('click'); expect($('paso-emision').hidden).toBe(false);
    terminar(emitida()); await emision; expect(api.emitir).toHaveBeenCalledOnce();
  });

  it('carga vacía/error no permite preparar, ofrece reintentar y recalcula con selección conservada', async () => {
    const { $, api } = await preparar({ listarPendientes: vi.fn().mockRejectedValueOnce(new Error('Error pendientes')).mockResolvedValue([]) });
    expect($('reintentar-catalogos').hidden).toBe(false); expect($('preparar-facturacion').disabled).toBe(true);
    await $('reintentar-catalogos').dispatch('click'); expect($('estado-facturacion').textContent).toContain('No hay combinaciones Ayuntamiento–periodo pendientes');
    await seleccionar($); expect(api.calcular).not.toHaveBeenCalled();
  });

  it('retorno conserva números y selección; recalcular usa los mismos IDs', async () => {
    const { $, api } = await preparar(); await seleccionar($); await continuar($); numeros($);
    await $('volver-revision').dispatch('click'); await $('recalcular-facturacion').dispatch('click');
    expect(api.calcular).toHaveBeenLastCalledWith({ ayuntamiento_id: 1, periodo_id: 5 }); await continuar($);
    expect($('numero-precintos').value).toBe('  000P  '); expect($('confirmacion-emision').checked).toBe(false);
    await $('volver-revision').dispatch('click'); await $('volver-seleccion').dispatch('click');
    expect($('ayuntamiento-facturacion').value).toBe('1');
  });

  it('cambiar números exige confirmar la revisión de nuevo y una respuesta incompleta exige recuperación', async () => {
    const { $, api } = await preparar({ emitir: vi.fn().mockResolvedValue({ estado: 'EMITIDA', facturas: [] }) });
    await seleccionar($); await continuar($); numeros($); await $('numero-precintos').dispatch('input');
    expect($('confirmacion-emision').checked).toBe(false); expect($('confirmar-emision').disabled).toBe(true);
    await $('formulario-emision').dispatch('submit'); expect(api.emitir).not.toHaveBeenCalled();
    $('confirmacion-emision').checked = true; await $('formulario-emision').dispatch('submit');
    expect($('recuperar-facturacion').hidden).toBe(false); expect($('paso-resultado').hidden).toBe(true);
  });

  it('sirve recursos y acceso Inicio; cliente usa los contratos actuales sin números generados', async () => {
    const pagina = await request(app).get('/facturacion-emision.html'); expect(pagina.status).toBe(200);
    expect(pagina.text).not.toContain('configuracion-tasas');
    expect(pagina.text).not.toContain('Gestionar comisión e IVA');
    expect(pagina.text).toContain('type="text" maxlength="200"'); expect(pagina.text).toContain('Confirmar emisión conjunta');
    expect(pagina.text).toContain('Puedes revisar y corregir los datos de la farmacia antes de la primera emisión.');
    for (const [id, etiqueta] of [['soe-b', 'SOE'], ['denominacion-b', 'Denominación'], ['cif-b', 'CIF']]) {
      expect(pagina.text).toContain(`<label for="${id}">${etiqueta}</label>`);
    }
    expect(pagina.text).toContain('>Corregir farmacia</h3>');
    expect(pagina.text).toContain('>Guardar cambios</button>');
    expect(pagina.text).toContain('He revisado los datos de las farmacias, los números oficiales');
    const casilla = pagina.text.match(/<input\b[^>]*id="confirmacion-emision"[^>]*>/)[0];
    expect(casilla).toContain('type="checkbox"'); expect(casilla).toContain('required');
    expect(casilla).not.toMatch(/\b(?:disabled|checked|tabindex|aria-hidden)\s*(?:=|>)/);
    expect(pagina.text).toMatch(/<label\b[^>]*>\s*<input\b[^>]*id="confirmacion-emision"[^>]*>\s*He revisado los datos de las farmacias[^<]*<\/label>/);
    expect(pagina.text).toContain('Los datos de las farmacias quedan fijados.');
    expect(pagina.text).not.toMatch(/\bB\b/);
    expect((await request(app).get('/')).text).toContain('/facturacion-municipal.html');
    for (const path of ['/js/facturacion-municipal.js', '/js/facturacion-municipal-api.js', '/css/facturacion-municipal.css']) expect((await request(app).get(path)).status).toBe(200);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => previa() }));
    await cliente.previsualizar(3); expect(fetch).toHaveBeenLastCalledWith('/facturaciones/3/previsualizacion', { method: 'GET' });
    await cliente.emitir(3, { numero_factura_precintos: '000P', numero_factura_comision: '000C' });
    expect(JSON.parse(fetch.mock.lastCall[1].body)).toEqual({ numero_factura_precintos: '000P', numero_factura_comision: '000C' });
    fetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'Número usado' }) });
    await expect(cliente.emitir(3, {})).rejects.toMatchObject({ message: 'Número usado', incierto: false });
    fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'Error servidor' }) });
    await expect(cliente.emitir(3, {})).rejects.toMatchObject({ incierto: true });
    fetch.mockRejectedValue(new Error('Red')); await expect(cliente.emitir(3, {})).rejects.toMatchObject({ incierto: true });
  });
});
