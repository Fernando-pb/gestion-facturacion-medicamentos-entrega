import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { iniciarInterfaz, leerDeclarados } from '../public/js/entregas.js';
import { ErrorEntrega, abrirEntrega, consultarEntrega, guardarDeclarados, listarPeriodos, buscarFarmacias, listarEntregas } from '../public/js/entregas-api.js';

class Elemento {
  constructor() { this.value = ''; this.hidden = false; this.disabled = false; this.children = []; this.listeners = new Map(); this.attributes = {}; }
  addEventListener(name, fn) { this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]); }
  async dispatch(name, event = { preventDefault() {} }) { for (const fn of this.listeners.get(name) ?? []) await fn(event); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() { this.focused = true; }
}
const entrega = { id: 7, farmacia_id: 2, periodo_id: 3, mes: 9, anio: 2026, denominacion_farmacia: 'Nombre histórico', cif_nif_farmacia: 'TEST-CIF-0001', ayuntamiento_denominacion: 'Villa', precintos_informados: 12, importe_informado: '123.45' };
const resumen = { admitidos: 0, incidencias: 0, total_registrado: 0, subtotal_facturable: '0.00', diferencia_cantidad: null, diferencia_importe: null, paquetes: [] };
const pendiente = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };
const catalogo = [
  { id: 2, soe: '002', denominacion: 'Farmacia actual', localidad: 'Villa', ayuntamiento_id: 4, ayuntamiento_denominacion: 'Villa' },
  { id: 8, soe: '008', denominacion: 'Sin asignar', localidad: 'Villa', ayuntamiento_id: null },
];
const seleccionar = async ($, id) => {
  if ($('selector-farmacias').hidden) await $('seleccionar-farmacia').dispatch('click');
  if (id === '') return;
  $('busqueda').value = id === '8' ? '008' : '002';
  await $('busqueda').dispatch('input');
  await $('busqueda').dispatch('keydown', { key: 'Enter', preventDefault() {}, stopPropagation() {} });
};
const preparar = async (overrides = {}, antesDeSeleccionar) => {
  const html = await readFile(new URL('../public/entregas.html', import.meta.url), 'utf8');
  const nodes = new Map([...html.matchAll(/id="([^"]+)"/g)].map((match) => [match[1], new Elemento()]));
  const $ = (id) => nodes.get(id);
  $('detalle').hidden = true;
  vi.stubGlobal('document', { getElementById: $, createElement: () => new Elemento() });
  const api = {
    consultarContextoPrecios: vi.fn().mockResolvedValue({ facturacion_id: null, estado: null, estado_entrega: 'SIN_FACTURAR', tiene_cobros: false, permite_correccion: true, motivo_bloqueo: null }),
    listarEntregas: vi.fn().mockResolvedValue([]),
    listarPeriodos: vi.fn().mockResolvedValue([{ id: 3, mes: 9, anio: 2026 }]),
    buscarFarmacias: vi.fn().mockImplementation(async (q) => catalogo.filter((f) => f.soe.startsWith(q) || f.denominacion.toLowerCase().includes(q.toLowerCase()))),
    abrirEntrega: vi.fn().mockResolvedValue({ estado: 200, datos: { ...entrega } }),
    consultarEntrega: vi.fn().mockResolvedValue({ ...entrega }),
    guardarDeclarados: vi.fn().mockImplementation(async (id, data) => ({ ...entrega, ...data })),
    consultarResumen: vi.fn().mockResolvedValue(resumen), ...overrides,
  };
  iniciarInterfaz({ api });
  await vi.waitFor(() => expect($('listado-entregas').attributes['aria-busy']).toBe('false'));
  await antesDeSeleccionar?.($);
  await $('crear-entrega').dispatch('click');
  await $('seleccionar-farmacia').dispatch('click');
  $('mes').value = '9'; $('anio').value = '2026';
  await seleccionar($, '2');
  return { $, api };
};
const abrir = async ($) => $('formulario-seleccion').dispatch('submit');
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('interfaz de Entregas', () => {
  const filaRegistrada = { ...entrega, soe: '002', ayuntamiento_id: 4, admitidos: 0, subtotal_facturable: '0.00' };
  const botonFila = ($) => $('grupos-entregas').children[0].children[1].children[0].children[1].children[0].children[4].children[0];
  const filasRenderizadas = ($) => $('grupos-entregas').children.flatMap((grupo) => grupo.children[1].children[0].children[1].children);
  it('presentación inicial neutral, alta independiente y periodos más recientes primero', async () => {
    let inicial;
    const { $, api } = await preparar({ listarEntregas: vi.fn().mockResolvedValue([filaRegistrada]),
      listarPeriodos: vi.fn().mockResolvedValue([{ id: 1, mes: 1, anio: 2025 }, { id: 3, mes: 9, anio: 2026 }, { id: 4, mes: 10, anio: 2026 }]) }, ($) => {
      inicial = $('seleccion').hidden;
      expect($('periodo-listado').children.map((p) => p.value)).toEqual(['4', '3', '1']);
      expect($('periodo-listado').value).toBe('3'); // El 4 es más nuevo, pero no tiene entregas.
    });
    expect(inicial).toBe(true); expect(api.abrirEntrega).not.toHaveBeenCalled(); expect(api.guardarDeclarados).not.toHaveBeenCalled();
    expect($('seleccion').hidden).toBe(false); expect($('listado-entregas').hidden).toBe(true);
    expect($('estado').textContent).toContain('sin guardar');
    const html = await readFile(new URL('../public/entregas.html', import.meta.url), 'utf8');
    expect(html).toContain('>Entregas registradas</h2>'); expect(html).not.toContain('>Pendientes de facturar<');
  });
  it('agrupa por Ayuntamiento y muestra cero aptos e importe exacto, sin lista de lecturas', async () => {
    const { $ } = await preparar({ listarEntregas: vi.fn().mockResolvedValue([filaRegistrada, { ...filaRegistrada, id: 8, soe: '003' }, { ...filaRegistrada, id: 9, ayuntamiento_id: 5, ayuntamiento_denominacion: 'Zeta' }]) });
    expect($('grupos-entregas').children).toHaveLength(2);
    const tabla = $('grupos-entregas').children[0].children[1].children[0];
    expect(tabla.children[1].children).toHaveLength(2);
    expect(tabla.children[0].children[0].children.map((th) => th.textContent)).toEqual(['SOE', 'Farmacia (nombre histórico)', 'Precintos aptos', 'Importe aptos (€)', 'Acción']);
    expect(tabla.children[1].children[0].children).toHaveLength(5);
    expect(tabla.children[1].children[0].children.slice(0,4).map((td) => td.textContent)).toEqual(['002', 'Nombre histórico', 0, '0,00']);
    expect($('estado-listado').textContent).toBe('3 entregas'); expect($('actualizar-listado').hidden).toBe(true);
  });
  it('mantiene solo el título municipal y etiqueta la tabla/región para teclado sin caption redundante', async () => {
    const { $ } = await preparar({ listarEntregas: vi.fn().mockResolvedValue([filaRegistrada]) });
    const grupo = $('grupos-entregas').children[0], tabla = grupo.children[1].children[0];
    expect(grupo.children[0].textContent).toBe('Villa'); expect(tabla.children).toHaveLength(2);
    expect(tabla.attributes['aria-labelledby']).toBe(grupo.children[0].id);
    expect(grupo.children[1].tabIndex).toBe(0); expect(grupo.children[1].attributes['role']).toBe('region');
    expect($('estado-listado').textContent).toBe('1 entrega');
    const html = await readFile(new URL('../public/entregas.html', import.meta.url),'utf8');
    expect(html).not.toContain('>Actualizar listado</button>'); expect(html).not.toContain('>Eliminar entrega</button>');
    expect(html).toMatch(/id="actualizar-listado"[^>]*hidden>Reintentar<\/button>/);
  });
  it('conserva cinco columnas, importes y acción en cada grupo sin repetir el periodo seleccionado', async () => {
    const { $, api } = await preparar({ listarEntregas: vi.fn().mockResolvedValue([
      { ...filaRegistrada, admitidos: 15, subtotal_facturable: '9999999999.99' },
      { ...filaRegistrada, id: 9, ayuntamiento_id: 5, ayuntamiento_denominacion: 'Zeta' },
    ]) });
    for (const grupo of $('grupos-entregas').children) {
      const tabla = grupo.children[1].children[0];
      const encabezados = tabla.children[0].children[0].children;
      expect(encabezados).toHaveLength(5); expect(encabezados.map((th) => th.textContent)).not.toContain('Periodo');
      expect(encabezados.every((th) => th.attributes.scope === 'col')).toBe(true);
      for (const fila of tabla.children[1].children) {
        expect(fila.children).toHaveLength(5);
        expect(fila.children[4].children[0].textContent).toBe('Continuar entrega');
        expect(fila.children[4].children[0].attributes['aria-label']).toContain('9/2026');
      }
    }
    expect(filasRenderizadas($)[0].children[3].textContent).toBe('9999999999,99');
    expect($('periodo-listado').value).toBe('3'); expect(api.abrirEntrega).not.toHaveBeenCalled();
  });
  it('limita los estilos del listado y comparte margen entre filtros, cabecera y grupos', async () => {
    const css = await readFile(new URL('../public/css/entregas.css', import.meta.url), 'utf8');
    expect(css).toContain('#listado-entregas { --margen-listado: 1.5rem; }');
    expect(css).toContain('#listado-entregas { --margen-listado: 1rem; }');
    expect(css).toContain('#listado-entregas .section-heading { padding-inline: var(--margen-listado); }');
    expect(css).toContain('#grupos-entregas { margin: 0 var(--margen-listado) 1.5rem; }');
    expect(css).toContain('.filtros-entregas-listado { grid-template-columns: repeat(2, minmax(12rem, 1fr)); padding-inline: var(--margen-listado); }');
    expect(css).toContain('#grupos-entregas th:nth-child(2), #grupos-entregas td:nth-child(2) { width: 40%; }');
    expect(css).toContain('#grupos-entregas .button { max-width: 100%; white-space: normal; }');
    expect(css).toContain('#grupos-entregas table { min-width: 56rem; }');
  });
  it('lista vacía no ofrece reintento y mantiene periodo, carga automática y ausencia de escrituras', async () => {
    const { $, api } = await preparar();
    expect($('estado-listado').textContent).toContain('No hay entregas registradas para el periodo 09/2026'); expect($('actualizar-listado').hidden).toBe(true);
    expect($('grupos-entregas').children).toHaveLength(0); expect($('periodo-listado').children.map((p) => p.value)).toEqual(['3']);
    $('periodo-listado').value='3'; await $('periodo-listado').dispatch('change');
    expect(api.listarEntregas).toHaveBeenLastCalledWith('3'); expect($('periodo-listado').value).toBe('3');
    expect(api.abrirEntrega).not.toHaveBeenCalled(); expect(api.guardarDeclarados).not.toHaveBeenCalled();
  });
  it('abre fila solo con GET, preserva declarados históricos y filtro al volver', async () => {
    const { $, api } = await preparar({ listarEntregas: vi.fn().mockResolvedValue([filaRegistrada]) });
    await $('cancelar-alta').dispatch('click'); $('periodo-listado').value = '3'; await $('periodo-listado').dispatch('change');
    await botonFila($).dispatch('click');
    expect(api.consultarEntrega).toHaveBeenCalledWith({ farmacia_id: 2, periodo_id: 3 });
    expect(api.abrirEntrega).not.toHaveBeenCalled(); expect(api.guardarDeclarados).not.toHaveBeenCalled();
    expect($('cantidad-guardada').textContent).toBe(12); expect($('importe-guardado').textContent).toBe('123.45');
    expect($('estado').textContent).not.toContain('Entrega recuperada');
    expect($('estado').textContent).toBe('');
    expect($('estado-resumen').textContent).toBe('');
    expect($('control-entrega').open).toBe(false);
    expect($('seleccion').hidden).toBe(true); expect($('formulario-declarados').hidden).toBe(true);
    await $('volver-seleccion').dispatch('click'); expect($('periodo-listado').value).toBe('3');
    expect(api.listarEntregas).toHaveBeenLastCalledWith('3');
  });
  it('retorno y cambios de Ayuntamiento/periodo no conservan resaltado verde de la fila consultada', async () => {
    const filaOtroPeriodo = { ...filaRegistrada, id: 12, periodo_id: 4, mes: 10, anio: 2026,
      ayuntamiento_id: 5, ayuntamiento_denominacion: 'Zeta' };
    const listar = vi.fn(async (periodoId = '') => periodoId === '3' ? [filaRegistrada]
      : periodoId === '4' ? [filaOtroPeriodo] : [filaRegistrada, filaOtroPeriodo]);
    const { $, api } = await preparar({ listarEntregas: listar,
      listarPeriodos: vi.fn().mockResolvedValue([{ id: 3, mes: 9, anio: 2026 }, { id: 4, mes: 10, anio: 2026 }]) });
    await $('cancelar-alta').dispatch('click');
    await botonFila($).dispatch('click');
    await $('volver-seleccion').dispatch('click');
    expect(api.listarEntregas).toHaveBeenLastCalledWith('4');
    expect(filasRenderizadas($)).toHaveLength(1);
    expect(filasRenderizadas($).some((fila) => fila.className === 'ultima-lectura')).toBe(false);

    $('ayuntamiento-listado').value = '5'; await $('ayuntamiento-listado').dispatch('change');
    expect(filasRenderizadas($)).toHaveLength(1);
    expect(filasRenderizadas($).some((fila) => fila.className === 'ultima-lectura')).toBe(false);

    $('ayuntamiento-listado').value = ''; await $('ayuntamiento-listado').dispatch('change');
    $('periodo-listado').value = '3'; await $('periodo-listado').dispatch('change');
    expect(api.listarEntregas).toHaveBeenLastCalledWith('3');
    expect(filasRenderizadas($)).toHaveLength(1);
    expect(filasRenderizadas($).some((fila) => fila.className === 'ultima-lectura')).toBe(false);
  });
  it('error del listado permite reintentar sin crear ni guardar', async () => {
    const { $, api } = await preparar({ listarEntregas: vi.fn().mockRejectedValueOnce(new ErrorEntrega('Sin red')).mockResolvedValue([]) }, async ($) => {
      expect($('estado-listado').textContent).toContain('Sin red'); expect($('estado-listado').attributes.role).toBe('alert');
      expect($('actualizar-listado').hidden).toBe(false); await $('actualizar-listado').dispatch('click');
      expect($('actualizar-listado').hidden).toBe(true); expect($('estado-listado').attributes.role).toBe('status');
    });
    expect($('estado-listado').textContent).toContain('No hay entregas'); expect(api.abrirEntrega).not.toHaveBeenCalled();
  });
  it('combina periodo y Ayuntamiento y mantiene todos los periodos concretos consultables', async () => {
    const filaOtro = { ...filaRegistrada, id: 12, periodo_id: 4, mes: 10, anio: 2026, ayuntamiento_id: 5, ayuntamiento_denominacion: 'Zeta' };
    const filaPeriodo3 = { ...filaRegistrada, periodo_id: 3 };
    const listar = vi.fn(async (periodoId = '') => periodoId === '3' ? [filaPeriodo3] : periodoId === '4' ? [filaOtro] : [filaRegistrada, filaOtro]);
    const { $, api } = await preparar({ listarEntregas: listar,
      listarPeriodos: vi.fn().mockResolvedValue([{ id: 3, mes: 9, anio: 2026 }, { id: 4, mes: 10, anio: 2026 }]) });
    await $('cancelar-alta').dispatch('click');
    expect($('periodo-listado').value).toBe('4');
    expect($('periodo-listado').children.map((o) => o.value)).toEqual(['4', '3']);
    expect($('periodo-listado').children.map((o) => o.textContent)).not.toContain('Todos los periodos');
    expect($('ayuntamiento-listado').children.map((o) => o.textContent)).toEqual(['Todos los Ayuntamientos', 'Villa', 'Zeta']);
    $('ayuntamiento-listado').value = '5'; await $('ayuntamiento-listado').dispatch('change');
    expect($('grupos-entregas').children).toHaveLength(1);
    expect($('grupos-entregas').children[0].children[0].textContent).toBe('Zeta');
    $('periodo-listado').value = '3'; await $('periodo-listado').dispatch('change');
    expect(api.listarEntregas).toHaveBeenLastCalledWith('3');
    expect($('grupos-entregas').children).toHaveLength(0);
    expect($('estado-listado').textContent).toContain('No hay entregas registradas para Zeta en el periodo 09/2026');
    expect($('estado-listado').attributes.role).toBe('status'); expect($('actualizar-listado').hidden).toBe(true);
  });
  it('sin entregas selecciona el periodo existente más reciente y conserva los demás', async () => {
    const { $ } = await preparar({ listarEntregas: vi.fn().mockResolvedValue([]),
      listarPeriodos: vi.fn().mockResolvedValue([{ id: 2, mes: 2, anio: 2025 }, { id: 4, mes: 1, anio: 2026 }]) });
    await $('cancelar-alta').dispatch('click');
    expect($('periodo-listado').value).toBe('4');
    expect($('periodo-listado').children.map((o) => o.value)).toEqual(['4', '2']);
    expect($('estado-listado').textContent).toContain('periodo 01/2026');
  });
  it('consulta de fila bloquea doble apertura y conserva listado ante error', async () => {
    const wait = pendiente();
    const { $, api } = await preparar({ listarEntregas: vi.fn().mockResolvedValue([filaRegistrada]), consultarEntrega: vi.fn().mockReturnValue(wait.promise) });
    await $('cancelar-alta').dispatch('click'); const boton = botonFila($); const primera = boton.dispatch('click'); await boton.dispatch('click');
    expect(api.consultarEntrega).toHaveBeenCalledTimes(1); expect($('crear-entrega').disabled).toBe(true);
    wait.reject(new ErrorEntrega('No encontrada',404)); await primera;
    expect($('listado-entregas').hidden).toBe(false); expect($('estado').textContent).toContain('No encontrada');
  });
  it('Guardando… no se presenta como Guardado antes de confirmar; refresco fallido conserva éxito', async () => {
    const wait = pendiente(); const { $, api } = await preparar(); await abrir($); await $('editar').dispatch('click');
    api.guardarDeclarados.mockReturnValue(wait.promise); api.consultarResumen.mockRejectedValue(new ErrorEntrega('Sin resumen'));
    $('importe-editado').value = '10,20'; const guardando = $('formulario-declarados').dispatch('submit');
    expect($('estado').textContent).toContain('Guardando…'); expect($('estado').textContent).not.toContain('Guardado.');
    wait.resolve({ ...entrega, importe_informado: '10.20' }); await guardando;
    expect($('estado').textContent).toContain('Guardado.'); expect($('estado-resumen').textContent).toContain('Sin resumen');
  });
  it('cliente del listado usa GET neutro con filtro opcional', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok:true, status:200, json:async () => [] }); vi.stubGlobal('fetch',fetch);
    await listarEntregas(); await listarEntregas('3');
    expect(fetch.mock.calls.map(([ruta]) => ruta)).toEqual(['/entregas/registradas','/entregas/registradas?periodo_id=3']);
    expect(fetch.mock.calls.every(([, opciones]) => opciones.method === 'GET')).toBe(true);
  });
  it('Registrar precintos abre vista dedicada y volver conserva entrega y refresca detalle', async () => {
    const { $, api } = await preparar({ consultarPrecintos: vi.fn().mockResolvedValue([]), consultarIncidencias: vi.fn().mockResolvedValue([]) });
    await abrir($); const consultas = api.consultarResumen.mock.calls.length;
    await $('registrar-precintos').dispatch('click');
    expect($('detalle').hidden).toBe(true); expect($('lecturas').hidden).toBe(false);
    expect($('contexto-lecturas').textContent).toContain('SOE 002');
    await $('volver-detalle').dispatch('click');
    expect($('detalle').hidden).toBe(false); expect($('lecturas').hidden).toBe(true);
    expect($('nombre-historico').textContent).toBe('Nombre histórico');
    expect(api.consultarResumen.mock.calls.length).toBeGreaterThan(consultas);
    expect(api.consultarResumen).toHaveBeenLastCalledWith(7); expect(api.abrirEntrega).toHaveBeenCalledTimes(1);
  });
  it('retira la aclaración municipal inicial y no duplica el aviso sin Ayuntamiento', async () => {
    const { $ } = await preparar();
    await $('seleccionar-farmacia').dispatch('click');
    expect($('farmacia-seleccionada').textContent).toContain('Ayuntamiento: Villa');
    await seleccionar($, '8');
    expect($('farmacia-seleccionada').textContent).not.toContain('Ayuntamiento:');
    expect($('aviso-ayuntamiento').hidden).toBe(false); expect($('estado-apertura').textContent).toBe('');
    await seleccionar($, '2');
    expect($('farmacia-seleccionada').textContent).toContain('Ayuntamiento: Villa');
    expect($('aviso-ayuntamiento').hidden).toBe(true); expect($('aviso-ayuntamiento').textContent).toBe('');
    const html = await readFile(new URL('../public/entregas.html', import.meta.url), 'utf8');
    expect(html).not.toContain('Selecciona una farmacia para ver su Ayuntamiento');
    expect(html).not.toContain('id="ayuntamiento"');
  });
  it('alinea el selector con el interior de su tarjeta y limita el ancho del campo', async () => {
    const html = await readFile(new URL('../public/entregas.html', import.meta.url), 'utf8');
    const css = await readFile(new URL('../public/css/entregas.css', import.meta.url), 'utf8');
    expect(html).toMatch(/<section id="selector-farmacias"[\s\S]*?<div class="selector-farmacias-contenido">[\s\S]*?<label for="busqueda">[\s\S]*?<input id="busqueda"[\s\S]*?<p id="estado-busqueda"/);
    expect(css).toContain('.selector-farmacias-contenido { min-width: 0; margin: 0 1.5rem; }');
    expect(css).toContain('.selector-farmacias-contenido > * { max-width: 100%; box-sizing: border-box; }');
    expect(css).toContain('.selector-farmacias-contenido input { min-width: 0; }');
  });
  it('normaliza ambos importes sin perder campos ante error y mantiene precintos enteros', async () => {
    const { $, api } = await preparar({ abrirEntrega: vi.fn().mockResolvedValue({ estado: 201, datos: entrega }),
      guardarDeclarados: vi.fn().mockRejectedValue(new ErrorEntrega('Fallo', 400)) });
    $('cantidad-inicial').value = '0'; $('importe-inicial').value = '12,30';
    await abrir($);
    expect(api.guardarDeclarados).toHaveBeenCalledWith(7, { precintos_informados: 0, importe_informado: '12.30' });
    expect($('importe-inicial').value).toBe('12,30');
    $('importe-editado').value = '0,01';
    await $('formulario-declarados').dispatch('submit');
    expect(api.guardarDeclarados).toHaveBeenLastCalledWith(7, expect.objectContaining({ importe_informado: '0.01' }));
    expect($('importe-editado').value).toBe('0,01');
    $('importe-editado').value = '1,234'; await $('importe-editado').dispatch('blur');
    expect($('importe-editado').value).toBe('1,234');
    $('importe-inicial').value = '12.3'; await $('importe-inicial').dispatch('blur');
    expect($('importe-inicial').value).toBe('12,30');
    const html = await readFile(new URL('../public/entregas.html', import.meta.url), 'utf8');
    for (const id of ['importe-inicial', 'importe-editado']) {
      expect(html).toMatch(new RegExp(`class="campo-monetario"><input id="${id}"[^>]*inputmode="decimal"[^>]*><span aria-hidden="true">€</span>`));
    }
  });
  it('debounce combina búsqueda, conserva ceros y selecciona por clic mostrando localidad sin datos bancarios', async () => {
    const { $, api } = await preparar(); vi.useFakeTimers();
    api.buscarFarmacias.mockClear(); await $('seleccionar-farmacia').dispatch('click'); $('busqueda').value = '0'; await $('busqueda').dispatch('input');
    $('busqueda').value = '00'; await $('busqueda').dispatch('input');
    await vi.advanceTimersByTimeAsync(249); expect(api.buscarFarmacias).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(api.buscarFarmacias).toHaveBeenCalledTimes(1);
    expect(api.buscarFarmacias).toHaveBeenCalledWith('00'); expect($('resultados-farmacias').children).toHaveLength(2);
    expect($('resultados-farmacias').children[0].textContent).toContain('002 — Farmacia actual · Villa · Villa');
    expect($('resultados-farmacias').children[1].textContent).toContain('Sin Ayuntamiento');
    await $('resultados-farmacias').children[0].dispatch('click');
    expect($('resultados-farmacias').hidden).toBe(true); expect($('selector-farmacias').hidden).toBe(true);
    expect($('farmacia-seleccionada').textContent).toContain('002'); expect($('seleccionar-farmacia').textContent).toBe('Cambiar farmacia');
  });
  it('Enter exacto selecciona sin abrir; varias coincidencias requieren flechas y Enter explícitos', async () => {
    const { $, api } = await preparar();
    expect(api.abrirEntrega).not.toHaveBeenCalled();
    api.buscarFarmacias.mockResolvedValue([catalogo[0], { ...catalogo[0], id: 9, soe: '002' }]);
    await $('seleccionar-farmacia').dispatch('click');
    $('busqueda').value = '002'; await $('busqueda').dispatch('input');
    const event = { key: 'Enter', preventDefault: vi.fn(), stopPropagation: vi.fn() };
    await $('busqueda').dispatch('keydown', event);
    expect(event.preventDefault).toHaveBeenCalled(); expect($('abrir').disabled).toBe(true);
    await $('busqueda').dispatch('keydown', { key: 'ArrowDown', preventDefault() {} });
    await $('busqueda').dispatch('keydown', { key: 'ArrowDown', preventDefault() {} });
    expect($('busqueda').attributes['aria-activedescendant']).toBe('farmacia-resultado-1');
    await $('busqueda').dispatch('keydown', event); expect(api.abrirEntrega).not.toHaveBeenCalled(); await abrir($);
    expect(api.abrirEntrega).toHaveBeenCalledWith({ farmacia_id: 9, mes: 9, anio: 2026 });
  });
  it('cambiar farmacia abre una vista independiente y cancelar conserva selección y datos del alta', async () => {
    const { $, api } = await preparar(); $('cantidad-inicial').value = '80'; $('importe-inicial').value = '12.30';
    await $('seleccionar-farmacia').dispatch('click');
    expect($('selector-farmacias').hidden).toBe(false); expect($('seleccion').hidden).toBe(true);
    expect($('busqueda').focused).toBe(true); expect($('busqueda').value).toBe('');
    expect($('mes').value).toBe('9'); expect($('anio').value).toBe('2026'); expect($('importe-inicial').value).toBe('12.30');
    await $('cancelar-selector-farmacias').dispatch('click');
    expect($('selector-farmacias').hidden).toBe(true); expect($('seleccion').hidden).toBe(false);
    expect($('farmacia-seleccionada').textContent).toContain('SOE 002');
    expect($('farmacia-seleccionada').textContent).toContain('Ayuntamiento: Villa'); expect($('abrir').disabled).toBe(false);
    expect($('mes').value).toBe('9'); expect($('anio').value).toBe('2026');
    expect($('cantidad-inicial').value).toBe('80'); expect($('importe-inicial').value).toBe('12.30');
    expect(api.abrirEntrega).not.toHaveBeenCalled();
  });
  it('seleccionar y cambiar farmacia vuelve al formulario sin confirmar con un segundo botón', async () => {
    const { $ } = await preparar();
    await $('seleccionar-farmacia').dispatch('click');
    $('busqueda').value = '008'; await $('busqueda').dispatch('input');
    await $('busqueda').dispatch('keydown', { key: 'Enter', preventDefault() {}, stopPropagation() {} });
    expect($('selector-farmacias').hidden).toBe(true); expect($('seleccion').hidden).toBe(false);
    expect($('farmacia-seleccionada').textContent).not.toContain('Ayuntamiento:');
    expect($('aviso-ayuntamiento').textContent).toContain('no tiene Ayuntamiento asignado');
    expect($('abrir').disabled).toBe(true);
    await $('seleccionar-farmacia').dispatch('click');
    $('busqueda').value = '002'; await $('busqueda').dispatch('input');
    await $('busqueda').dispatch('keydown', { key: 'Enter', preventDefault() {}, stopPropagation() {} });
    expect($('farmacia-seleccionada').textContent).toContain('SOE 002');
    expect($('selector-farmacias').hidden).toBe(true); expect($('abrir').disabled).toBe(false);
  });
  it('Escape y Tab cierran sin selección silenciosa y no hacen consultas vacías', async () => {
    const { $, api } = await preparar();
    await $('seleccionar-farmacia').dispatch('click'); $('busqueda').value = '00'; await $('busqueda').dispatch('input');
    await $('busqueda').dispatch('keydown', { key: 'Enter', preventDefault() {} });
    for (const key of ['Escape', 'Tab']) {
      await $('busqueda').dispatch('keydown', { key, preventDefault() {} });
      expect($('resultados-farmacias').hidden).toBe(true); expect($('abrir').disabled).toBe(true);
    }
    api.buscarFarmacias.mockClear(); $('busqueda').value = ''; await $('busqueda').dispatch('input');
    await $('busqueda').dispatch('keydown', { key: 'Enter', preventDefault() {} }); expect(api.buscarFarmacias).not.toHaveBeenCalled();
  });
  it('descarta respuestas antiguas y muestra ausencia de resultados y error sin quedar ocupado', async () => {
    const { $, api } = await preparar(); const vieja = pendiente(); await $('seleccionar-farmacia').dispatch('click');
    api.buscarFarmacias.mockReturnValueOnce(vieja.promise).mockResolvedValueOnce([]);
    $('busqueda').value = 'vieja'; await $('busqueda').dispatch('input');
    const first = $('busqueda').dispatch('keydown', { key: 'Enter', preventDefault() {} });
    $('busqueda').value = 'nueva'; await $('busqueda').dispatch('input');
    await $('busqueda').dispatch('keydown', { key: 'Enter', preventDefault() {} });
    vieja.resolve(catalogo); await first;
    expect($('estado-busqueda').textContent).toBe('Sin coincidencias.'); expect($('abrir').disabled).toBe(true);
    api.buscarFarmacias.mockRejectedValue(new ErrorEntrega('Red perdida'));
    await $('busqueda').dispatch('keydown', { key: 'Enter', preventDefault() {} });
    expect($('estado-busqueda').textContent).toContain('Red perdida'); expect($('busqueda').disabled).toBe(false);
  });
  it('destaca Ayuntamiento junto a farmacia y mantiene aviso cerca del botón solo mientras falte asignación', async () => {
    const { $ } = await preparar();
    expect($('farmacia-seleccionada').textContent).toContain('Ayuntamiento: Villa');
    expect($('aviso-ayuntamiento').hidden).toBe(true);
    await seleccionar($, '8');
    const texto = 'Esta farmacia no tiene Ayuntamiento asignado. Debes asignarlo desde la gestión de Ayuntamientos antes de abrir una entrega';
    expect($('aviso-ayuntamiento').hidden).toBe(false); expect($('aviso-ayuntamiento').textContent).toBe(texto);
    expect($('farmacia-seleccionada').textContent).not.toContain('Ayuntamiento:'); expect($('abrir').disabled).toBe(true);
    $('anio').value = ''; await $('anio').dispatch('input');
    expect($('aviso-ayuntamiento').hidden).toBe(false); expect($('aviso-ayuntamiento').textContent).toBe(texto);
    await seleccionar($, '2');
    expect($('aviso-ayuntamiento').hidden).toBe(true); expect($('aviso-ayuntamiento').textContent).toBe('');
    expect($('farmacia-seleccionada').textContent).toContain('Ayuntamiento: Villa');
    await seleccionar($, '');
    expect($('farmacia-seleccionada').textContent).toContain('Ayuntamiento: Villa');
    const html = await readFile(new URL('../public/entregas.html', import.meta.url), 'utf8');
    expect(html).not.toContain('id="ayuntamiento"');
    expect(html).toContain('id="aviso-ayuntamiento" class="informative-notice aviso-apertura" role="alert" hidden');
  });
  it('error de carga libera actividad y permite reintentar sin perder fecha ni entradas', async () => {
    const listar = vi.fn().mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue([
      { id: 2, soe: '002', denominacion: 'Farmacia', ayuntamiento_id: 4, ayuntamiento_denominacion: 'Villa' },
      { id: 8, soe: '008', denominacion: 'Sin asignar', ayuntamiento_id: null },
    ]);
    await preparar({ buscarFarmacias: listar }, async ($) => {
      await $('seleccionar-farmacia').dispatch('click'); $('busqueda').value = '002'; await $('busqueda').dispatch('input'); await $('busqueda').dispatch('keydown', { key: 'Enter', preventDefault() {} }); await vi.waitFor(() => expect($('reintentar-carga').hidden).toBe(false));
      expect($('abrir').attributes['aria-busy']).toBe('false');
      expect($('estado-apertura').textContent).toContain('Selecciona una farmacia');
      $('anio').value = '2035'; $('cantidad-inicial').value = '80';
      await $('reintentar-carga').dispatch('click');
      expect($('anio').value).toBe('2035'); expect($('cantidad-inicial').value).toBe('80');
    });
    expect(listar).toHaveBeenCalledTimes(3); // Fallo, reintento y selección exacta posterior.
  });
  it('regresión: farmacia sin Ayuntamiento bloquea por requisito, sin simular una operación en curso', async () => {
    const { $, api } = await preparar();
    await seleccionar($, '8');
    expect($('abrir').disabled).toBe(true); expect($('abrir').attributes['aria-busy']).toBe('false');
    expect($('estado-apertura').textContent).toBe('');
    expect($('aviso-ayuntamiento').textContent).toContain('no tiene Ayuntamiento');
    expect(api.abrirEntrega).not.toHaveBeenCalled();
    const css = await readFile(new URL('../public/css/entregas.css', import.meta.url), 'utf8');
    expect(css).toContain('.button:disabled { cursor: not-allowed; }');
    expect(css).toContain('#abrir:disabled[aria-busy="true"] { cursor: wait; }');
    await seleccionar($, '2');
    expect($('abrir').disabled).toBe(false); expect($('estado-apertura').textContent).toContain('Puedes abrir');
  });
  it('explica selección vacía y recuperación tras error sin dejar ocupado el botón', async () => {
    const { $, api } = await preparar({ abrirEntrega: vi.fn().mockRejectedValue(new ErrorEntrega('Validación', 400)) });
    await seleccionar($, '');
    expect($('estado-apertura').textContent).toContain('Selecciona una farmacia');
    await seleccionar($, '2'); await abrir($);
    expect($('abrir').disabled).toBe(false); expect($('abrir').attributes['aria-busy']).toBe('false');
    expect($('farmacia-seleccionada').textContent).toContain('SOE 002'); expect($('anio').value).toBe('2026');
    api.abrirEntrega.mockResolvedValue({ estado: 200, datos: entrega }); await abrir($);
    expect($('detalle').hidden).toBe(false); expect(api.abrirEntrega).toHaveBeenCalledTimes(2);
  });
  it.each(['', '0', '-1', '1.5', '2147483648', 'x'])('bloquea año inválido %j sin escribir', async (value) => {
    const { $, api } = await preparar(); $('anio').value = value; await $('anio').dispatch('input');
    expect($('abrir').disabled).toBe(true); await abrir($); expect(api.abrirEntrega).not.toHaveBeenCalled();
    expect($('anio').value).toBe(value);
  });
  it('conserva mes/año y declarados tras error de apertura', async () => {
    const { $, api } = await preparar({ abrirEntrega: vi.fn().mockRejectedValue(new ErrorEntrega('Facturación', 409)) });
    $('mes').value = '1'; $('anio').value = '1'; $('cantidad-inicial').value = '80';
    await $('mes').dispatch('change'); await abrir($);
    expect(api.abrirEntrega).toHaveBeenCalledWith({ farmacia_id: 2, mes: 1, anio: 1 });
    expect($('mes').value).toBe('1'); expect($('anio').value).toBe('1'); expect($('cantidad-inicial').value).toBe('80');
  });
  it('publica acceso, etiquetas, foco y resumen accesible sin controles de lector', async () => {
    const html = await readFile(new URL('../public/entregas.html', import.meta.url), 'utf8');
    expect(await readFile(new URL('../public/index.html', import.meta.url), 'utf8')).toContain('href="/entregas.html"');
    for (const id of ['mes', 'anio', 'busqueda', 'cantidad-inicial', 'importe-inicial', 'cantidad-editada', 'importe-editado']) expect(html).toContain(`for="${id}"`);
    expect(html).toContain('aria-live="polite"'); expect(html).toContain('scope="col"');
    expect(html).toContain('tabindex="-1"'); expect(html).not.toContain('codigo-barras');
  });
  it('filtra SOE y denominación y deriva Ayuntamiento; farmacia no asignada bloquea', async () => {
    const { $, api } = await preparar();
    expect($('farmacia-seleccionada').textContent).toContain('Ayuntamiento: Villa');
    await $('seleccionar-farmacia').dispatch('click'); $('busqueda').value = '008'; await $('busqueda').dispatch('input');
    await seleccionar($, '8');
    expect($('aviso-ayuntamiento').textContent).toContain('Debes asignarlo'); expect($('abrir').disabled).toBe(true);
    await abrir($); expect(api.abrirEntrega).not.toHaveBeenCalled();
    await $('seleccionar-farmacia').dispatch('click'); $('busqueda').value = 'ACTUAL'; await $('busqueda').dispatch('input');
    await $('busqueda').dispatch('keydown', { key: 'Enter', preventDefault() {} });
    expect($('resultados-farmacias').children).toHaveLength(1);
    await $('resultados-farmacias').children[0].dispatch('click');
    expect($('farmacia-seleccionada').textContent).toContain('SOE 002');
  });
  it('alta admite cualquier mes/año aunque el filtro del listado no tenga periodos', async () => {
    const listar = vi.fn().mockResolvedValue([]);
    const { $, api } = await preparar({ listarPeriodos: listar }); $('mes').value = '10'; $('anio').value = '2035'; await $('anio').dispatch('input');
    expect($('abrir').disabled).toBe(false); expect(listar).toHaveBeenCalledTimes(1);
    expect(api.abrirEntrega).not.toHaveBeenCalled(); await abrir($);
    expect(api.abrirEntrega).toHaveBeenCalledWith({ farmacia_id: 2, mes: 10, anio: 2035 });
  });
  it('recupera sin PUT ni sobrescritura, muestra históricos y conserva selección al volver', async () => {
    const { $, api } = await preparar(); $('cantidad-inicial').value = '99'; $('importe-inicial').value = '900.00';
    await abrir($);
    expect(api.guardarDeclarados).not.toHaveBeenCalled(); expect($('cantidad-guardada').textContent).toBe(12);
    expect($('nombre-historico').textContent).toBe('Nombre histórico'); expect($('contexto').textContent).toContain('09/2026');
    expect($('seleccion').hidden).toBe(true); expect($('titulo-detalle').focused).toBe(true);
    await $('volver-seleccion').dispatch('click'); expect($('mes').value).toBe('9'); expect($('farmacia-seleccionada').textContent).toContain('SOE 002');
    expect($('titulo-listado-entregas').focused).toBe(true); expect($('listado-entregas').hidden).toBe(false);
  });
  it('crea y guarda iniciales exclusivamente tras 201', async () => {
    const { $, api } = await preparar({ abrirEntrega: vi.fn().mockResolvedValue({ estado: 201, datos: { ...entrega, precintos_informados: null, importe_informado: null } }) });
    $('cantidad-inicial').value = '0'; $('importe-inicial').value = ''; await abrir($);
    expect(api.abrirEntrega).toHaveBeenCalledWith({ farmacia_id: 2, mes: 9, anio: 2026 });
    expect(api.guardarDeclarados).toHaveBeenCalledWith(7, { precintos_informados: 0, importe_informado: null });
    expect($('importe-guardado').textContent).toBe('Sin informar'); expect($('cantidad-guardada').textContent).toBe(0);
  });
  it('edita explícitamente, refresca resumen y distingue vacíos de cero', async () => {
    const { $, api } = await preparar(); await abrir($); await $('editar').dispatch('click');
    expect($('cantidad-editada').focused).toBe(true); expect($('importe-editado').value).toBe('123,45');
    $('cantidad-editada').value = ''; $('importe-editado').value = '0.00'; await $('formulario-declarados').dispatch('submit');
    expect(api.guardarDeclarados).toHaveBeenCalledWith(7, { precintos_informados: null, importe_informado: '0.00' });
    expect(api.consultarResumen).toHaveBeenCalledTimes(2); expect($('detalle').hidden).toBe(false);
  });
  it('rechaza entradas locales incorrectas sin escribir y conserva campos', async () => {
    const { $, api } = await preparar(); $('cantidad-inicial').value = '-1'; await abrir($);
    expect(api.abrirEntrega).not.toHaveBeenCalled(); expect($('cantidad-inicial').value).toBe('-1');
  });
  it('409 mantiene edición y muestra bloqueo por facturación', async () => {
    const { $, api } = await preparar(); await abrir($); await $('editar').dispatch('click');
    api.guardarDeclarados.mockRejectedValue(new ErrorEntrega('Existe facturación TD.', 409));
    $('cantidad-editada').value = '80'; await $('formulario-declarados').dispatch('submit');
    expect($('cantidad-editada').value).toBe('80'); expect($('estado').textContent).toContain('Conflicto: Existe facturación');
    expect($('formulario-declarados').hidden).toBe(false);
  });
  it('bloquea doble envío y navegación durante escritura pendiente', async () => {
    const wait = pendiente(); const { $, api } = await preparar({ abrirEntrega: vi.fn().mockReturnValue(wait.promise) });
    const first = abrir($); await abrir($);
    await $('volver-seleccion').dispatch('click');
    expect($('volver-seleccion').disabled).toBe(true); expect(api.abrirEntrega).toHaveBeenCalledTimes(1);
    expect($('busqueda').disabled).toBe(true); expect($('volver-seleccion').disabled).toBe(true);
    expect($('abrir').attributes['aria-busy']).toBe('true'); expect($('estado-apertura').textContent).toContain('operación en curso');
    wait.resolve({ estado: 200, datos: entrega }); await first; expect($('volver-seleccion').disabled).toBe(false);
    expect($('abrir').attributes['aria-busy']).toBe('false');
  });
  it('respuesta POST perdida exige consultar y nunca aplica declarados a entrega de origen incierto', async () => {
    const { $, api } = await preparar({ abrirEntrega: vi.fn().mockRejectedValue(new ErrorEntrega('Red perdida')) });
    $('cantidad-inicial').value = '80'; await abrir($); await abrir($);
    expect(api.abrirEntrega).toHaveBeenCalledTimes(1); expect($('consultar-guardado').hidden).toBe(false);
    await $('consultar-guardado').dispatch('click'); expect(api.consultarEntrega).toHaveBeenCalledWith({ farmacia_id: 2, mes: 9, anio: 2026 });
    expect(api.guardarDeclarados).not.toHaveBeenCalled(); expect($('cantidad-guardada').textContent).toBe(12);
  });
  it('respuesta PUT perdida conserva propuesta y consulta antes de permitir repetir', async () => {
    const { $, api } = await preparar(); await abrir($); await $('editar').dispatch('click');
    $('cantidad-editada').value = '80'; api.guardarDeclarados.mockRejectedValue(new ErrorEntrega('Respuesta perdida'));
    await $('formulario-declarados').dispatch('submit'); expect($('guardar').disabled).toBe(true);
    await $('consultar-guardado').dispatch('click'); expect($('cantidad-editada').value).toBe('80');
    expect($('cantidad-guardada').textContent).toBe(12); expect($('guardar').disabled).toBe(false);
  });
  it('creación confirmada con PUT fallido deja detalle consultable y valores editables conservados', async () => {
    const { $, api } = await preparar({ abrirEntrega: vi.fn().mockResolvedValue({ estado: 201, datos: { ...entrega, precintos_informados: null, importe_informado: null } }), guardarDeclarados: vi.fn().mockRejectedValue(new ErrorEntrega('Datos no válidos', 400)) });
    $('cantidad-inicial').value = '80'; await abrir($); expect($('detalle').hidden).toBe(false);
    expect($('cantidad-editada').value).toBe('80'); expect($('cantidad-guardada').textContent).toBe('Sin informar');
    expect(api.consultarResumen).toHaveBeenCalled(); expect($('estado').textContent).toContain('Datos no válidos');
  });
  it('muestra resumen vacío, NULL y paquetes con importes exactos del servidor', async () => {
    const { $, api } = await preparar(); await abrir($);
    expect($('sin-paquetes').hidden).toBe(false); expect($('aptos-entrega').textContent).toBe(0);
    expect($('tabla-paquetes').hidden).toBe(true);
    expect($('importe-entrega').textContent).toBe('0,00 €'); expect($('totales').children[2].children[1].textContent).toBe('0.00');
    expect($('totales').children[3].children[1].textContent).toBe('Sin informar');
    api.consultarResumen.mockResolvedValue({ ...resumen, admitidos: 2, paquetes: [{ numero_paquete: 3, precintos: 2, subtotal_facturable: '90000000.01' }] });
    await $('reintentar-resumen').dispatch('click'); expect($('paquetes').children[0].children[2].textContent).toBe('90000000.01');
    expect($('tabla-paquetes').hidden).toBe(false); expect($('sin-paquetes').hidden).toBe(true);
  });
  it('oculta caption, tabla y scroll con cero aptos, incluso cuando hay incidencias; no deduce vacío sin recuento', async () => {
    const { $, api } = await preparar({ consultarResumen: vi.fn().mockResolvedValue({ ...resumen, incidencias: 3, total_registrado: 3 }) });
    await abrir($);
    expect($('tabla-paquetes').hidden).toBe(true); expect($('paquetes').children).toHaveLength(0);
    expect($('sin-paquetes').hidden).toBe(false);
    const html = await readFile(new URL('../public/entregas.html', import.meta.url), 'utf8');
    expect(html).toMatch(/id="tabla-paquetes" class="table-scroll" hidden><table><caption>Paquetes con precintos admitidos/);
    expect(html.match(/Todavía no hay precintos aptos en esta entrega/g)).toHaveLength(1);
    api.consultarResumen.mockResolvedValue({ ...resumen, admitidos: undefined });
    await $('reintentar-resumen').dispatch('click');
    expect($('tabla-paquetes').hidden).toBe(true); expect($('sin-paquetes').hidden).toBe(true);
  });
  it('oculta paquetes y estado vacío mientras carga y ante error; actualiza visibilidad al reintentar', async () => {
    const { $, api } = await preparar({ consultarResumen: vi.fn().mockResolvedValue({ ...resumen, admitidos: 1,
      paquetes: [{ numero_paquete: 1, precintos: 1, subtotal_facturable: '12.34' }] }) });
    await abrir($); expect($('tabla-paquetes').hidden).toBe(false);
    const wait = pendiente(); api.consultarResumen.mockReturnValueOnce(wait.promise);
    const carga = $('reintentar-resumen').dispatch('click');
    expect($('tabla-paquetes').hidden).toBe(true); expect($('sin-paquetes').hidden).toBe(true);
    wait.reject(new ErrorEntrega('Sin red')); await carga;
    expect($('tabla-paquetes').hidden).toBe(true); expect($('sin-paquetes').hidden).toBe(true);
    expect($('estado-resumen').textContent).toContain('Sin red');
    api.consultarResumen.mockResolvedValue(resumen); await $('reintentar-resumen').dispatch('click');
    expect($('tabla-paquetes').hidden).toBe(true); expect($('sin-paquetes').hidden).toBe(false);
    expect($('estado-resumen').textContent).toBe('');
  });
  it('retira Consultando entrega al terminar el GET y mantiene la carga del resumen separada', async () => {
    const { $, api } = await preparar({ listarEntregas: vi.fn().mockResolvedValue([filaRegistrada]) });
    await $('cancelar-alta').dispatch('click');
    const ficha = pendiente(), totales = pendiente();
    api.consultarEntrega.mockReturnValueOnce(ficha.promise); api.consultarResumen.mockReturnValueOnce(totales.promise);
    const consulta = botonFila($).dispatch('click');
    expect($('estado').textContent).toBe('Consultando entrega…');
    ficha.resolve(entrega);
    await vi.waitFor(() => expect(api.consultarResumen).toHaveBeenCalled());
    expect($('detalle').hidden).toBe(false); expect($('estado').textContent).toBe('');
    expect($('estado-resumen').textContent).toBe('Cargando resumen…');
    totales.resolve(resumen); await consulta;
    expect($('estado').textContent).toBe(''); expect($('estado-resumen').textContent).toBe('');
  });
  it('vuelve a plegar Información de control al abrir otra entrega y permite desplegarla para editar', async () => {
    const { $ } = await preparar({ listarEntregas: vi.fn().mockResolvedValue([filaRegistrada]) });
    await $('cancelar-alta').dispatch('click'); await botonFila($).dispatch('click');
    expect($('control-entrega').open).toBe(false);
    await $('editar').dispatch('click'); expect($('control-entrega').open).toBe(true);
    await $('volver-seleccion').dispatch('click'); await botonFila($).dispatch('click');
    expect($('control-entrega').open).toBe(false); expect($('formulario-declarados').hidden).toBe(true);
  });
  it('descarta resumen antiguo al cambiar de pantalla y no inserta datos como HTML', async () => {
    const { $, api } = await preparar(); await abrir($);
    const wait = pendiente(); api.consultarResumen.mockReturnValue(wait.promise); const old = $('reintentar-resumen').dispatch('click');
    await $('volver-seleccion').dispatch('click'); wait.resolve({ ...resumen, paquetes: [{ numero_paquete: 99, precintos: 1, subtotal_facturable: '1.00' }] });
    await old; expect($('paquetes').children).toHaveLength(0); expect($('detalle').hidden).toBe(true);
    expect(await readFile(new URL('../public/js/entregas.js', import.meta.url), 'utf8')).not.toContain('innerHTML');
  });
  it('error de carga ofrece reintentar junto al error y se oculta al cargar automáticamente', async () => {
    const { $, api } = await preparar({ consultarResumen: vi.fn().mockRejectedValue(new ErrorEntrega('Red perdida')) });
    await abrir($); expect($('estado-resumen').textContent).toContain('Red perdida'); expect($('reintentar-resumen').hidden).toBe(false);
    api.consultarResumen.mockResolvedValue({ ...resumen, admitidos: 4, subtotal_facturable: '21.30' });
    await $('reintentar-resumen').dispatch('click'); expect($('estado-resumen').textContent).toBe('');
    expect($('reintentar-resumen').hidden).toBe(true); expect($('aptos-entrega').textContent).toBe(4);
    expect($('importe-entrega').textContent).toBe('21,30 €');
  });
  it('detalle prioriza Registrar precintos y pliega los datos de control con edición secundaria', async () => {
    const html = await readFile(new URL('../public/entregas.html', import.meta.url), 'utf8');
    expect(html).not.toContain('Actualizar resumen');
    expect(html).toContain('>Volver al listado</button>'); expect(html).toContain('>Registrar precintos</button>');
    expect((html.match(/>Volver al listado<\/button>/g) ?? []).length).toBe(2); // Alta y detalle.
    expect(html).toContain('<summary>Información de control</summary>');
    expect(html.indexOf('id="editar"')).toBeGreaterThan(html.indexOf('<summary>Información de control</summary>'));
    expect(html).toContain('Código leído o escaneado (valor original)</th><th scope="col">Código nacional');
    expect(html).toContain('>Paquete</th><th scope="col">Posición');
  });
  it('muestra Volver al inicio solo en Entregas registradas, no en detalle ni registro', async () => {
    const html = await readFile(new URL('../public/entregas.html', import.meta.url), 'utf8');
    const cabecera = html.slice(html.indexOf('<header'), html.indexOf('</header>') + '</header>'.length);
    const listado = html.slice(html.indexOf('<section id="listado-entregas"'), html.indexOf('<section id="seleccion"'));
    const detalle = html.slice(html.indexOf('<section id="detalle"'), html.indexOf('<section id="lecturas"'));
    const lecturas = html.slice(html.indexOf('<section id="lecturas"'), html.indexOf('</main>'));
    expect(cabecera).toContain('class="page-header page-header-with-link"');
    expect(cabecera).toContain('<h1>Entregas y precintos</h1>'); expect(cabecera).toContain('id="volver-inicio"');
    expect(cabecera).toContain('>Volver al inicio</a>'); expect(listado).not.toContain('volver-inicio');
    expect(detalle).not.toContain('volver-inicio'); expect(lecturas).not.toContain('volver-inicio');
    const { $, api } = await preparar({ listarEntregas: vi.fn().mockResolvedValue([filaRegistrada]),
      consultarPrecintos: vi.fn().mockResolvedValue([]), consultarIncidencias: vi.fn().mockResolvedValue([]) });
    expect($('listado-entregas').hidden).toBe(true); // preparar deja la pantalla de alta abierta.
    expect($('volver-inicio').hidden).toBe(true);
    await $('cancelar-alta').dispatch('click');
    expect($('listado-entregas').hidden).toBe(false); expect($('detalle').hidden).toBe(true);
    expect($('volver-inicio').hidden).toBe(false);
    await botonFila($).dispatch('click');
    expect($('listado-entregas').hidden).toBe(true); expect($('detalle').hidden).toBe(false);
    expect($('volver-inicio').hidden).toBe(true);
    await $('registrar-precintos').dispatch('click');
    expect($('listado-entregas').hidden).toBe(true); expect($('detalle').hidden).toBe(true); expect($('lecturas').hidden).toBe(false);
    await $('volver-detalle').dispatch('click');
    expect($('detalle').hidden).toBe(false); expect($('lecturas').hidden).toBe(true);
    expect($('volver-inicio').hidden).toBe(true);
    await $('volver-seleccion').dispatch('click'); expect($('listado-entregas').hidden).toBe(false);
    expect($('volver-inicio').hidden).toBe(false);
  });
});

describe('declarados y transporte de Entregas', () => {
  it('busca SOE prefijo y nombre contiene, deduplica por ID y no consulta texto vacío', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [catalogo[0]] });
    vi.stubGlobal('fetch', fetch);
    expect(await buscarFarmacias('')).toEqual([]); expect(fetch).not.toHaveBeenCalled();
    expect(await buscarFarmacias('002')).toEqual([catalogo[0]]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toContain('campo=soe&modo=prefijo&q=002');
    expect(fetch.mock.calls[1][0]).toContain('campo=denominacion&modo=contiene&q=002');
  });
  it.each(['-1', '1.5', '2147483648', ' ', 'x'])('rechaza cantidad %j', (value) => expect(() => leerDeclarados(value, '')).toThrow());
  it.each(['1,234', '1.234', '1e3', '10000000000', '-1', ' '])('rechaza importe %j', (value) => expect(() => leerDeclarados('', value)).toThrow());
  it('no transforma importes a coma flotante', () => expect(leerDeclarados('0', '00012.30')).toEqual({ precintos_informados: 0, importe_informado: '00012.30' }));
  it('conserva HTTP 201 y contratos estrictos de cuerpo', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => entrega }); vi.stubGlobal('fetch', fetch);
    expect(await abrirEntrega({ farmacia_id: 2, periodo_id: 3 })).toEqual({ estado: 201, datos: entrega });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ farmacia_id: 2, periodo_id: 3 });
    await guardarDeclarados(7, { precintos_informados: null, importe_informado: '0.00' });
    expect(fetch.mock.calls[1][0]).toBe('/entregas/7/declarados');
  });
  it('consultar usa GET y errores HTTP conservan estado', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'Facturación' }) }); vi.stubGlobal('fetch', fetch);
    await expect(consultarEntrega({ farmacia_id: 2, periodo_id: 3 })).rejects.toMatchObject({ estado: 409, incierto: false });
    expect(fetch.mock.calls[0][1].method).toBe('GET');
  });
  it('red y respuesta ilegible se consideran inciertas, sin reintentos', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('offline')); vi.stubGlobal('fetch', fetch);
    await expect(abrirEntrega({})).rejects.toMatchObject({ incierto: true }); expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('JSON'); } });
    await expect(listarPeriodos()).rejects.toMatchObject({ incierto: true });
  });
});
