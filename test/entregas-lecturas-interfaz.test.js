import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { iniciarLecturas } from '../public/js/entregas-lecturas.js';
import { ErrorEntrega, evaluarLectura, guardarLectura, consultarOperacion, consultarPrecintos, consultarIncidencias, consultarContextoPrecios, corregirPrecio, eliminarPrecinto } from '../public/js/entregas-api.js';

class Elemento {
  constructor() { this.value = ''; this.hidden = false; this.disabled = false; this.children = []; this.listeners = new Map(); this.attributes = {}; this.scrollTop = 0; this.scrollLeft = 0; }
  addEventListener(name, fn) { this.listeners.set(name, [...(this.listeners.get(name) ?? []), fn]); }
  async dispatch(name, event = { preventDefault() {} }) { for (const fn of this.listeners.get(name) ?? []) await fn(event); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getBoundingClientRect() { return this.rect ?? { top: 0, bottom: 0 }; }
  focus() { this.focused = true; this.focusCount = (this.focusCount ?? 0) + 1; }
}
const clave = 'b5918e5b-a4df-40b5-82eb-735530972683';
const entrega = { id: 7, soe: '002', mes: 9, anio: 2026, denominacion_farmacia: 'Farmacia histórica', ayuntamiento_denominacion: 'Villa' };
const lectura = { id: 11, entrega_id: 7, numero_paquete: 2, posicion_paquete: 3, codigo_barras_original: '8470006772911', codigo_nacional: '677291', medicamento_id: 5, precio_aplicado: '12.34', precio_referencia: '12.34' };
const apto = { resultado: 'ADMITIDO', medicamento: { id: 5, descripcion: '<Nombre observado>', precio: '99.99' } };
const resumen = (total = '0.00', admitidos = 0) => ({ admitidos, subtotal_facturable: total, incidencias: 0, total_registrado: admitidos, diferencia_cantidad: null, diferencia_importe: null, paquetes: [] });
const guardado = { resultado: 'GUARDADO', clave_operacion: clave, tipo: 'PRECINTO', lectura };
const pendiente = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const preparar = async (overrides = {}) => {
  const html = await readFile(new URL('../public/entregas.html', import.meta.url), 'utf8');
  const nodes = new Map([...html.matchAll(/id="([^"]+)"/g)].map((m) => [m[1], new Elemento()]));
  const $ = (id) => nodes.get(id);
  vi.stubGlobal('document', { getElementById: $, createElement: () => new Elemento() });
  const api = { consultarResumen: vi.fn().mockResolvedValue(resumen()), consultarPrecintos: vi.fn().mockResolvedValue([]),
    eliminarPrecinto: vi.fn().mockResolvedValue({ estado: 204, datos: null }),
    consultarContextoPrecios: vi.fn().mockResolvedValue({ facturacion_id: 3, estado: 'REVISION', tiene_cobros: false, permite_correccion: true }),
    corregirPrecio: vi.fn().mockResolvedValue({ lectura: { ...lectura, precio_aplicado: '0.10' }, subtotal_facturable: '12.44' }),
    consultarIncidencias: vi.fn().mockResolvedValue([]), evaluarLectura: vi.fn().mockResolvedValue(apto),
    guardarLectura: vi.fn().mockResolvedValue(guardado), consultarOperacion: vi.fn().mockResolvedValue({ ...guardado, resultado: 'RECUPERADO' }), ...overrides };
  const alVolver = vi.fn(), alBloquear = vi.fn();
  const vista = iniciarLecturas({ api, alVolver, alBloquear, crearClave: () => clave });
  await vista.abrir(entrega);
  return { $, api, alVolver, alBloquear, html };
};
const leer = async ($, codigo = '8470006772911') => {
  $('codigo-lectura').value = codigo;
  // Enter (también el sufijo de un lector de teclado) dispara el submit nativo.
  await $('codigo-lectura').dispatch('keydown', { key: 'Enter', preventDefault: vi.fn() });
  return $('formulario-lectura').dispatch('submit');
};
const enviarConRaton = async ($, codigo = '8470006772911') => {
  $('codigo-lectura').value = codigo;
  await $('evaluar-lectura').dispatch('click');
  // Simula la acción de envío nativa del botón type=submit.
  return $('formulario-lectura').dispatch('submit');
};
afterEach(() => vi.unstubAllGlobals());

describe('registro visual de precintos', () => {
  it('reutiliza el bloque interior del resumen de entrega con dos columnas y apilado móvil', async () => {
    const css = await readFile(new URL('../public/css/entregas.css', import.meta.url), 'utf8');
    const { html, $ } = await preparar({ consultarResumen: vi.fn().mockResolvedValue(resumen('12.34', 1)) });
    const indicadores = html.match(/<div class="resumen-entrega resumen-principal"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/)[1];
    expect(indicadores).toContain('id="aptos-lecturas"');
    expect(indicadores).toContain('id="importe-lecturas"');
    expect(indicadores).toContain('id="estado-totales-lecturas"');
    expect(indicadores).not.toContain('estado-precios');
    expect(html).toContain('class="resumen-entrega resumen-principal" aria-live="polite" aria-atomic="true"');
    expect(css).toContain('.resumen-entrega { margin: 1.5rem; padding: 1.25rem; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem 1.5rem; background: #edf5fb; border: 1px solid #9aafc5; border-radius: .5rem; }');
    expect(css).toContain('.resumen-entrega > div { min-width: 0; }');
    expect(css).toContain('@media (max-width: 40rem) { .resumen-entrega { grid-template-columns: 1fr; } }');
    expect(css).not.toContain('.indicadores-lecturas');
    expect(css).not.toContain('#lecturas .resumen-principal { padding-inline:');
    expect($('aptos-lecturas').textContent).toBe(1);
    expect($('importe-lecturas').textContent).toContain('12,34');
  });
  it('márgenes simétricos y cabecera de columnas fija dentro de una única tabla con scroll vertical', async () => {
    const css = await readFile(new URL('../public/css/entregas.css', import.meta.url), 'utf8');
    const { html } = await preparar();
    expect(css).toContain('html:has(#lecturas:not([hidden])) { scrollbar-gutter: stable both-edges; }');
    expect(html).toContain('<body class="entregas-page"><main>');
    expect(css).toContain('.entregas-page { min-width: 0;');
    expect(css).toContain('width: min(calc(100% - 2 * var(--margen-pagina)), 72rem); margin-inline: auto;');
    expect(css).toContain('.entregas-page .page-header { padding-inline: calc(var(--margen-lecturas) + 1px); }');
    expect(css).not.toContain('main:has(#lecturas:not([hidden]))');
    expect(css).toContain('.lista-lecturas { width: auto; margin-inline: var(--margen-lecturas);');
    expect(css).toContain('scrollbar-gutter: stable;');
    expect(css).toContain('.tabla-lecturas thead { position: sticky; top: 0; z-index: 4; background: #f7f9fc;');
    expect(css).toContain('overflow: auto; scroll-padding-block-start: 5rem;');
    expect(css).toContain('.tabla-lecturas caption { display: block; position: sticky; top: 0; z-index: 4;');
    const tabla = html.slice(html.indexOf('<table class="tabla-lecturas"'), html.indexOf('</table>', html.indexOf('<table class="tabla-lecturas"')));
    expect(tabla).toContain('<thead role="rowgroup">'); expect(tabla).toContain('<tbody id="precintos-lecturas"');
    expect(tabla.match(/<table/g)).toHaveLength(1); expect(tabla.match(/<th scope="col">/g)).toHaveLength(6);
  });

  it('seis columnas independientes con acciones completas sin descripción', async () => {
    const { $, html } = await preparar({ consultarPrecintos: vi.fn().mockResolvedValue([lectura]) });
    const tabla = html.slice(html.indexOf('<table class="tabla-lecturas"'), html.indexOf('</table>', html.indexOf('<table class="tabla-lecturas"')));
    expect(tabla).not.toContain('Descripción observada'); expect(tabla.match(/<th scope="col">/g)).toHaveLength(6);
    expect(tabla).toContain('role="table"'); expect(tabla).toContain('class="col-paquete"'); expect(tabla).toContain('class="col-precio"'); expect(tabla).toContain('class="col-codigo"'); expect(tabla).toContain('class="col-acciones"');
    const fila = $('precintos-lecturas').children[0];
    expect(fila.attributes.role).toBe('row'); expect(fila.children.map(td => td.attributes['data-label'])).toEqual(['Paquete','Posición','Código leído','Código nacional','Precio aplicado (€)','Acciones']);
    expect(fila.children.every(td => td.attributes.role === 'cell')).toBe(true);
    expect(fila.children[4].children).toHaveLength(0);
    expect(fila.children[5].attributes['data-label']).toBe('Acciones');
    expect(fila.children[5].children[0].children.map(b => b.attributes['aria-label'])).toEqual([
      'Corregir precio del código 677291, paquete 2, posición 3', 'Eliminar precinto del código 677291, paquete 2, posición 3, precio 12,34 euros']);
  });
  it('mantiene descripción observada solo en el detalle plegable y la retira con su lectura', async () => {
    const { $, api, html } = await preparar();
    api.consultarPrecintos.mockResolvedValue([lectura]); api.consultarResumen.mockResolvedValue(resumen('12.34', 1)); await leer($);
    expect($('precintos-lecturas').children[0].children.map(td=>td.textContent)).not.toContain('<Nombre observado>');
    expect($('descripciones-lecturas').children[0].textContent).toBe('Paquete 2, posición 3, código nacional 677291: <Nombre observado>');
    expect(html.indexOf('id="descripciones-lecturas"')).toBeGreaterThan(html.indexOf('<details class="detalles-lecturas">'));
    await $('precintos-lecturas').children[0].children[5].children[0].children[1].dispatch('click');
    $('confirmacion-eliminar').checked = true; await $('confirmacion-eliminar').dispatch('input');
    api.consultarPrecintos.mockResolvedValue([]); api.consultarResumen.mockResolvedValue(resumen()); await $('formulario-eliminar').dispatch('submit');
    expect($('descripciones-lecturas').children).toHaveLength(0);
  });
  it('lectura nueva queda al final, resaltada y visible mediante scroll propio; muestra el total confirmado', async () => {
    const anterior = { ...lectura, id: 10, numero_paquete: 1, posicion_paquete: 1, precio_aplicado: '1.00' };
    const { $, api } = await preparar({ consultarResumen: vi.fn().mockResolvedValue(resumen('1.00', 1)),
      consultarPrecintos: vi.fn().mockResolvedValue([anterior]) });
    $('lista-precintos').rect = { top: 0, bottom: 200, left: 0, right: 300 };
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const e = new Elemento();
      if (tag === 'tr') e.rect = { top: 400, bottom: 440 };
      if (tag === 'td') e.rect = { left: 400, right: 500 };
      return e;
    });
    api.consultarPrecintos.mockResolvedValue([anterior, lectura]); api.consultarResumen.mockResolvedValue(resumen('13.34', 2));
    await leer($);
    const filas = $('precintos-lecturas').children;
    expect(filas).toHaveLength(2);
    expect(filas[0].children[4].textContent).toBe('1,00');
    expect(filas.at(-1).children[4].textContent).toBe('12,34');
    expect(filas.at(-1).className).toBe('ultima-lectura');
    expect(filas.at(-1).attributes['aria-label']).toBe('Último precinto guardado');
    expect($('lista-precintos').scrollTop).toBe(240);
    expect($('lista-precintos').scrollLeft).toBe(200);
    expect($('importe-lecturas').textContent).toBe('13,34 €'); expect($('aptos-lecturas').textContent).toBe(2);
    expect($('codigo-lectura').focused).toBe(true);
  });
  it('contexto y prioridades: dos totales y lista fuera de los controles plegables', async () => {
    const { $, html } = await preparar();
    expect($('contexto-lecturas').textContent).toContain('09/2026 · SOE 002 · Farmacia histórica · Ayuntamiento: Villa');
    expect($('aptos-lecturas').textContent).toBe(0); expect($('importe-lecturas').textContent).toBe('0,00 €');
    expect(html.indexOf('id="precintos-lecturas"')).toBeLessThan(html.indexOf('<details class="detalles-lecturas">'));
    expect(html).toContain('type="submit">Evaluar y registrar');
    expect($('sin-precintos-lecturas').textContent).toBe('Todavía no se ha registrado ningún precinto.');
    expect($('sin-precintos-lecturas').hidden).toBe(false);
    expect(html).toContain('Código leído o escaneado (valor original)');
    expect(html).not.toContain('>Actualizar datos</button>');
    expect($('reintentar-lecturas').hidden).toBe(true);
    expect($('codigo-lectura').focused).toBe(true);
    expect($('estado-totales-lecturas').textContent).toBe('Datos confirmados por el servidor.');
    expect($('estado-paquete-lectura').textContent).not.toContain('/15 aptos');
    expect(html).toContain('>Escanea o escribe el código y pulsa Enter</p>');
    expect(html).toMatch(/<details class="detalles-lecturas"><summary>Ver más detalles: incidencias y controles<\/summary>/);
    expect(html).not.toMatch(/<details class="detalles-lecturas"[^>]*\bopen/);
    expect(html).toContain('id="incidencias-lecturas"'); expect(html).toContain('id="controles-lecturas"');
  });
  it('Enter de teclado registra una lectura apta con precio/posición/totales confirmados por el servidor', async () => {
    const { $, api } = await preparar();
    api.consultarResumen.mockResolvedValue(resumen('9999999999.99', 27));
    api.consultarPrecintos.mockResolvedValue([lectura]);
    await leer($);
    expect(api.evaluarLectura).toHaveBeenCalledWith(7, '8470006772911');
    expect(api.guardarLectura).toHaveBeenCalledWith(7, { codigo_barras_original: '8470006772911', clave_operacion: clave, decision: null, nuevo_paquete: false });
    expect($('aptos-lecturas').textContent).toBe(27);
    expect($('importe-lecturas').textContent).toBe('9999999999,99 €');
    expect($('precintos-lecturas').children[0].children.map((td) => td.textContent)).toEqual([2, 3, '8470006772911', '677291', '12,34', '']);
    expect($('estado-lectura').textContent).toBe('Precinto guardado.');
    expect($('estado-totales-lecturas').textContent).not.toContain('Hay 27 precintos aptos');
    expect($('codigo-lectura').value).toBe(''); expect($('codigo-lectura').focusCount).toBeGreaterThan(1);
  });
  it('lista ordenada con precio histórico y descripción ausente sin sustituirla por catálogo', async () => {
    const { $ } = await preparar({ consultarPrecintos: vi.fn().mockResolvedValue([{ ...lectura, id: 12, numero_paquete: 3 }, lectura]) });
    expect($('precintos-lecturas').children[0].children[0].textContent).toBe(2);
    expect($('precintos-lecturas').children[0].children).toHaveLength(6);
    expect($('precintos-lecturas').children[0].children[4].textContent).toBe('12,34');
  });
  it('incidencia requiere confirmación coincidente y no se guarda al evaluar', async () => {
    const { $, api } = await preparar({ evaluarLectura: vi.fn().mockResolvedValue({ resultado: 'INCIDENCIA', motivo: 'MEDICAMENTO_DESCONOCIDO' }) });
    const focoInicial = $('codigo-lectura').focusCount;
    await leer($, '000000');
    expect(api.guardarLectura).not.toHaveBeenCalled(); expect($('codigo-lectura').disabled).toBe(true);
    expect($('codigo-lectura').focusCount).toBe(focoInicial);
    expect($('confirmar-incidencia').hidden).toBe(false);
    expect($('estado-lectura').textContent).toContain('decisión explícita');
    api.guardarLectura.mockResolvedValue({ resultado: 'GUARDADO', tipo: 'INCIDENCIA', lectura: { codigo_barras_original: '000000', motivo: 'MEDICAMENTO_DESCONOCIDO' } });
    await $('confirmar-incidencia').dispatch('click');
    expect(api.guardarLectura).toHaveBeenCalledWith(7, expect.objectContaining({ decision: { tipo: 'CONFIRMAR_INCIDENCIA', motivo: 'MEDICAMENTO_DESCONOCIDO' } }));
    expect($('estado-lectura').textContent).toBe('Incidencia registrada.');
    expect($('codigo-lectura').focused).toBe(true);
  });
  it('ratón, Enter y lector de teclado usan el mismo envío y una sola operación', async () => {
    const { $, api } = await preparar();
    await enviarConRaton($, '677291');
    expect(api.evaluarLectura).toHaveBeenCalledTimes(1); expect(api.guardarLectura).toHaveBeenCalledTimes(1);
    api.evaluarLectura.mockClear(); api.guardarLectura.mockClear();
    await leer($, '8470006772911'); // Enter o lector que envía Enter: submit nativo del mismo formulario.
    expect(api.evaluarLectura).toHaveBeenCalledTimes(1); expect(api.guardarLectura).toHaveBeenCalledTimes(1);
  });
  it('distingue entrega sin lecturas de entrega con incidencias y ningún apto', async () => {
    const { $, api } = await preparar({
      evaluarLectura: vi.fn().mockResolvedValue({ resultado: 'INCIDENCIA', motivo: 'MEDICAMENTO_DESCONOCIDO' }),
      guardarLectura: vi.fn().mockResolvedValue({ resultado: 'GUARDADO', tipo: 'INCIDENCIA', lectura: { codigo_barras_original: '000000', motivo: 'MEDICAMENTO_DESCONOCIDO' } }),
      consultarResumen: vi.fn().mockResolvedValueOnce(resumen()).mockResolvedValue({ admitidos: 0, incidencias: 1, total_registrado: 1, subtotal_facturable: '0.00', diferencia_cantidad: null, diferencia_importe: null, paquetes: [] }),
      consultarIncidencias: vi.fn().mockResolvedValueOnce([]).mockResolvedValue([{ codigo_barras_original: '000000', codigo_nacional: null, motivo: 'MEDICAMENTO_DESCONOCIDO' }]),
    });
    expect($('sin-precintos-lecturas').textContent).toBe('Todavía no se ha registrado ningún precinto.');
    await leer($, '000000'); await $('confirmar-incidencia').dispatch('click');
    expect($('sin-precintos-lecturas').hidden).toBe(false);
    expect($('sin-precintos-lecturas').textContent).toBe('Se han registrado 1 precintos y ninguno es apto.');
    expect($('incidencias-lecturas').children).toHaveLength(1);
  });
  it('no deduce un estado vacío si el resumen no proporciona conteos coherentes', async () => {
    const { $ } = await preparar({ consultarResumen: vi.fn().mockResolvedValue({ admitidos: 0, incidencias: null, total_registrado: null,
      subtotal_facturable: '0.00', diferencia_cantidad: null, diferencia_importe: null, paquetes: [] }) });
    expect($('sin-precintos-lecturas').hidden).toBe(true);
    expect($('estado-totales-lecturas').textContent).toContain('No se pudieron cargar todos los datos');
    expect($('reintentar-lecturas').hidden).toBe(false);
  });
  it('el servidor confirma el apto 15 y asigna automáticamente el siguiente al precinto 16', async () => {
    let guardados = 0;
    let lista = [];
    const api = {
      consultarResumen: vi.fn(async () => ({ admitidos: guardados, incidencias: 0, total_registrado: guardados,
        subtotal_facturable: '12.34', diferencia_cantidad: null, diferencia_importe: null, paquetes: [] })),
      consultarPrecintos: vi.fn(async () => lista), consultarIncidencias: vi.fn().mockResolvedValue([]),
      evaluarLectura: vi.fn().mockResolvedValue(apto),
      guardarLectura: vi.fn(async (_id, request) => {
        guardados += 1;
        const lecturaGuardada = { ...lectura, id: guardados, codigo_barras_original: request.codigo_barras_original,
          numero_paquete: guardados <= 15 ? 1 : 2, posicion_paquete: guardados <= 15 ? guardados : guardados - 15 };
        lista = [...lista, lecturaGuardada];
        return { resultado: 'GUARDADO', tipo: 'PRECINTO', lectura: lecturaGuardada };
      }),
    };
    const { $, html } = await preparar(api);
    for (let n = 1; n <= 15; n++) await leer($, String(n).padStart(6, '0'));
    expect($('precintos-lecturas').children[14].children.slice(0, 2).map((td) => td.textContent)).toEqual([1, 15]);
    await leer($, '000016');
    expect($('precintos-lecturas').children[15].children.slice(0, 2).map((td) => td.textContent)).toEqual([2, 1]);
    expect(api.guardarLectura.mock.calls.every(([, body]) => body.nuevo_paquete === false)).toBe(true);
    expect($('estado-paquete-lectura').textContent).toContain('abre otro al completar 15 aptos');
  });
  it.each([['aceptar-baja', 'ACEPTAR_BAJA'], ['apartar-baja', 'APARTAR_BAJA']])('BAJA exige decisión explícita %s', async (boton, tipo) => {
    const { $, api } = await preparar({ evaluarLectura: vi.fn().mockResolvedValue({ resultado: 'PENDIENTE_DECISION_BAJA', medicamento: apto.medicamento }) });
    await leer($, '677291');
    expect(api.guardarLectura).not.toHaveBeenCalled(); expect($('aceptar-baja').hidden).toBe(false);
    expect($('confirmar-incidencia').hidden).toBe(true);
    await $(boton).dispatch('click');
    expect(api.guardarLectura).toHaveBeenCalledWith(7, expect.objectContaining({ decision: { tipo } }));
  });
  it('cancelar una decisión conserva el código y permite corregirlo, sin escritura', async () => {
    const { $, api } = await preparar({ evaluarLectura: vi.fn().mockResolvedValue({ resultado: 'INCIDENCIA', motivo: 'MEDICAMENTO_INACTIVO' }) });
    await leer($, '677291'); await $('cancelar-lectura').dispatch('click');
    expect($('codigo-lectura').value).toBe('677291'); expect($('codigo-lectura').disabled).toBe(false);
    expect(api.guardarLectura).not.toHaveBeenCalled();
  });
  it('doble envío y navegación bloqueados durante evaluación y guardado', async () => {
    const evalPendiente = pendiente(), savePendiente = pendiente();
    const { $, api, alVolver } = await preparar({ evaluarLectura: vi.fn().mockReturnValue(evalPendiente.promise), guardarLectura: vi.fn().mockReturnValue(savePendiente.promise) });
    $('codigo-lectura').value = '8470006772911';
    const envio = $('formulario-lectura').dispatch('submit'); await $('formulario-lectura').dispatch('submit'); await $('volver-detalle').dispatch('click');
    expect(api.evaluarLectura).toHaveBeenCalledTimes(1); expect(alVolver).not.toHaveBeenCalled();
    evalPendiente.resolve(apto); await vi.waitFor(() => expect(api.guardarLectura).toHaveBeenCalledTimes(1));
    expect($('estado-lectura').textContent).toBe('Guardando…');
    await $('formulario-lectura').dispatch('submit'); expect(api.guardarLectura).toHaveBeenCalledTimes(1);
    savePendiente.resolve(guardado); await envio; expect($('volver-detalle').disabled).toBe(false);
  });
  it('errores de evaluación y bloqueo por facturación conservan código', async () => {
    const { $, api } = await preparar({ evaluarLectura: vi.fn().mockRejectedValueOnce(new ErrorEntrega('Código inválido', 400)).mockResolvedValue(apto) });
    await leer($, 'mal'); expect($('codigo-lectura').value).toBe('mal'); expect(api.guardarLectura).not.toHaveBeenCalled();
    api.guardarLectura.mockRejectedValue(new ErrorEntrega('Existe facturación', 409));
    await leer($, '677291'); expect($('codigo-lectura').value).toBe('677291');
    expect($('estado-lectura').textContent).toContain('Conflicto: Existe facturación');
    expect($('consultar-operacion-lectura').hidden).toBe(true);
  });
  it('resultado incierto solo se consulta por clave y recupera sin duplicar ni reevaluar', async () => {
    const { $, api, alVolver } = await preparar({ guardarLectura: vi.fn().mockRejectedValue(new ErrorEntrega('Red perdida')) });
    await leer($); await $('formulario-lectura').dispatch('submit'); await $('volver-detalle').dispatch('click');
    expect($('codigo-lectura').value).toBe('8470006772911'); expect($('codigo-lectura').disabled).toBe(true);
    expect(api.guardarLectura).toHaveBeenCalledTimes(1); expect(alVolver).not.toHaveBeenCalled();
    await $('consultar-operacion-lectura').dispatch('click');
    expect(api.consultarOperacion).toHaveBeenCalledWith(7, clave); expect(api.guardarLectura).toHaveBeenCalledTimes(1);
    expect($('codigo-lectura').value).toBe(''); expect($('volver-detalle').disabled).toBe(false);
  });
  it('404 tras incertidumbre ofrece repetir explícitamente la misma clave y contenido', async () => {
    const { $, api } = await preparar({ guardarLectura: vi.fn().mockRejectedValueOnce(new ErrorEntrega('Respuesta perdida')).mockResolvedValue(guardado),
      consultarOperacion: vi.fn().mockRejectedValue(new ErrorEntrega('Aún no visible', 404)) });
    await leer($); expect($('repetir-operacion-lectura').hidden).toBe(true);
    await $('consultar-operacion-lectura').dispatch('click'); expect($('repetir-operacion-lectura').hidden).toBe(false);
    expect($('estado-lectura').textContent).toContain('puede seguir en curso');
    await $('repetir-operacion-lectura').dispatch('click');
    expect(api.guardarLectura.mock.calls[1]).toEqual(api.guardarLectura.mock.calls[0]);
    expect(api.evaluarLectura).toHaveBeenCalledTimes(1);
  });
  it('fallo de consulta conserva incertidumbre; 410 no recrea la operación retirada', async () => {
    const { $, api } = await preparar({ guardarLectura: vi.fn().mockRejectedValue(new ErrorEntrega('Respuesta perdida')),
      consultarOperacion: vi.fn().mockRejectedValueOnce(new ErrorEntrega('Sin red')).mockRejectedValueOnce(new ErrorEntrega('Retirada', 410)) });
    await leer($); await $('consultar-operacion-lectura').dispatch('click');
    expect($('codigo-lectura').disabled).toBe(true); expect($('repetir-operacion-lectura').hidden).toBe(true);
    await $('consultar-operacion-lectura').dispatch('click');
    expect($('codigo-lectura').value).toBe('8470006772911'); expect($('codigo-lectura').disabled).toBe(false);
    expect(api.guardarLectura).toHaveBeenCalledTimes(1); expect($('estado-lectura').textContent).toContain('retirada');
  });
  it('error 5xx al guardar conserva el código y exige consultar antes de repetir', async () => {
    const { $, api } = await preparar({ guardarLectura: vi.fn().mockRejectedValue(new ErrorEntrega('Error del servidor', 500)) });
    await leer($, '677291');
    expect($('codigo-lectura').value).toBe('677291'); expect($('codigo-lectura').disabled).toBe(true);
    expect($('estado-lectura').textContent).toContain('resultado es incierto');
    expect($('consultar-operacion-lectura').hidden).toBe(false); expect($('repetir-operacion-lectura').hidden).toBe(true);
    expect(api.guardarLectura).toHaveBeenCalledTimes(1);
  });
  it('cambio de condiciones durante guardar pide decisión y no trata DECISION_PENDIENTE como éxito', async () => {
    const { $, api } = await preparar({ guardarLectura: vi.fn().mockResolvedValueOnce({ resultado: 'DECISION_PENDIENTE', evaluacion: { resultado: 'INCIDENCIA', motivo: 'MEDICAMENTO_NO_AUTORIZADO' } }).mockResolvedValue(guardado) });
    await leer($); expect($('codigo-lectura').value).toBe('8470006772911'); expect($('confirmar-incidencia').hidden).toBe(false);
    await $('confirmar-incidencia').dispatch('click');
    expect(api.guardarLectura.mock.calls[1][1].clave_operacion).toBe(clave);
    expect(api.guardarLectura.mock.calls[1][1].decision.motivo).toBe('MEDICAMENTO_NO_AUTORIZADO');
  });
  it('nuevo paquete es una intención explícita, no escribe vacío ni se consume con incidencias', async () => {
    const { $, api } = await preparar({ evaluarLectura: vi.fn().mockResolvedValueOnce({ resultado: 'INCIDENCIA', motivo: 'MEDICAMENTO_DESCONOCIDO' }).mockResolvedValue(apto),
      guardarLectura: vi.fn().mockResolvedValueOnce({ resultado: 'GUARDADO', tipo: 'INCIDENCIA', lectura: { motivo: 'MEDICAMENTO_DESCONOCIDO' } }).mockResolvedValue(guardado) });
    await $('nuevo-paquete-lectura').dispatch('click'); expect(api.guardarLectura).not.toHaveBeenCalled();
    await leer($, '000000'); await $('confirmar-incidencia').dispatch('click');
    expect($('nuevo-paquete-lectura').attributes['aria-pressed']).toBe('true');
    await leer($); expect(api.guardarLectura.mock.calls[1][1].nuevo_paquete).toBe(true);
    expect($('nuevo-paquete-lectura').attributes['aria-pressed']).toBe('false');
  });
  it('muestra la ocupación comunicada por el resumen y la mantiene junto a la acción de paquete', async () => {
    const { $, api, html } = await preparar({ consultarResumen: vi.fn().mockResolvedValue({ ...resumen('0.00', 4),
      total_registrado: 4, paquetes: [{ numero_paquete: 1, precintos: 4, subtotal_facturable: '0.00' }] }),
    consultarPrecintos: vi.fn().mockResolvedValue(Array.from({ length: 4 }, (_, i) => ({ ...lectura, id: i + 1, posicion_paquete: i + 1 }))) });
    expect($('estado-paquete-lectura').textContent).toContain('Ocupación del paquete actual: 1, 4/15 aptos.');
    await $('nuevo-paquete-lectura').dispatch('click');
    expect($('estado-paquete-lectura').textContent).toContain('Último paquete registrado: 1, 4/15 aptos.');
    expect(api.guardarLectura).not.toHaveBeenCalled();
    expect(html.indexOf('id="nuevo-paquete-lectura"')).toBeLessThan(html.indexOf('id="estado-paquete-lectura"'));
    expect(html).toContain('class="button button-secondary button-paquete"');
  });
  it('mantiene texto legible y adapta filas para evitar scroll horizontal en móvil', async () => {
    const css = await readFile(new URL('../public/css/entregas.css', import.meta.url), 'utf8');
    const cssComun = await readFile(new URL('../public/css/ayuntamientos.css', import.meta.url), 'utf8');
    expect(css).toContain('.entrada-lectura label { font-size: 1rem; font-weight: 700; }');
    expect(css).toContain('#codigo-lectura { font-size: 1.25rem; font-weight: 600;');
    expect(css).toContain('.tabla-lecturas { width: 100%; min-width: 0; table-layout: fixed; }');
    expect(css).toContain('@media (max-width: 44rem)');
    expect(css).toContain('.lista-lecturas { max-height: 24rem; }');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(css).toContain('content: attr(data-label)');
    expect(css).toContain('.tabla-lecturas .col-codigo { width: 10rem; }');
    expect(css).toContain('.tabla-lecturas .col-acciones { width: 13rem; }');
    expect(css).toContain('flex-wrap: nowrap; align-items: center; gap: .35rem;');
    expect(css).toContain('.tabla-lecturas .acciones-precio .button { align-self: center; }');
    expect(css).not.toContain('.tabla-lecturas { min-width: 42rem; }');
    expect(cssComun).toContain('.table-scroll {'); expect(cssComun).toContain('max-width: 100%;');
    expect(cssComun).toContain('overflow-x: auto;');
  });
  it('comparte el margen interior del registro entre cabecera, campo, avisos, acciones y detalles', async () => {
    const css = await readFile(new URL('../public/css/entregas.css', import.meta.url), 'utf8');
    expect(css).toContain('--margen-pagina: clamp(1rem, 3vw, 2rem);');
    expect(css).toContain('--margen-lecturas: clamp(.75rem, 2vw, 1.5rem);');
    for (const selector of ['#lecturas .section-heading', '#lecturas > .form-actions', '#decision-lectura']) {
      expect(css).toContain(`${selector} { padding-inline: var(--margen-lecturas); }`);
    }
    expect(css).toContain('#sin-precintos-lecturas { margin-inline: var(--margen-lecturas); }');
    expect(css).toContain('.entrada-lectura { padding: 1rem var(--margen-lecturas) .5rem; }');
    expect(css).toContain('#estado-lectura { margin: 0 0 .5rem; padding-inline: var(--margen-lecturas); }');
    expect(css).toContain('.detalles-lecturas { margin: 0 var(--margen-lecturas) 1.5rem; padding: 1rem 0; }');
    expect(css).toContain('.detalles-lecturas .datos-entrega { margin: 1rem 0; }');
    expect(css).toContain('#decision-lectura .form-actions { padding-inline: 0; }');
  });
  it('guardado confirmado y fallo de carga conserva línea y ofrece reintentar sin reescribir', async () => {
    const { $, api } = await preparar(); api.consultarResumen.mockRejectedValueOnce(new ErrorEntrega('No responde resumen'));
    api.consultarPrecintos.mockResolvedValueOnce([lectura]);
    await leer($);
    expect($('precintos-lecturas').children[0].children[1].textContent).toBe(3);
    expect($('estado-lectura').textContent).toBe('Precinto guardado.');
    expect($('estado-totales-lecturas').textContent).toContain('No se pudieron cargar todos los datos');
    expect($('reintentar-lecturas').hidden).toBe(false); expect($('codigo-lectura').disabled).toBe(true);
    await $('reintentar-lecturas').dispatch('click'); expect($('codigo-lectura').disabled).toBe(false);
    expect($('reintentar-lecturas').hidden).toBe(true);
    expect(api.guardarLectura).toHaveBeenCalledTimes(1);
  });
  it('volver al detalle se permite tras finalizar y ejecuta su actualización', async () => {
    const { $, alVolver } = await preparar(); await $('volver-detalle').dispatch('click');
    expect(alVolver).toHaveBeenCalledTimes(1); expect($('lecturas').hidden).toBe(true);
  });
});

describe('corrección de precio en la pantalla', () => {
  const dosLecturas = [lectura, { ...lectura, id: 12, posicion_paquete: 4, precio_referencia: '23.45' }];
  const conLecturas = (extra = {}) => preparar({ consultarResumen: vi.fn().mockResolvedValue(resumen('24.68', 2)),
    consultarPrecintos: vi.fn().mockResolvedValue(dosLecturas), ...extra });
  const abrirPrecio = async ($) => $('precintos-lecturas').children[0].children[5].children[0].children[0].dispatch('click');
  const confirmar = async ($, valor = true) => { $('confirmacion-precio').checked = valor; await $('confirmacion-precio').dispatch('input'); };
  it.each(['REVISION', 'REABIERTA'])('%s corrige solo la lectura elegida conservando su referencia', async (estado) => {
    const { $, api } = await conLecturas({ consultarContextoPrecios: vi.fn().mockResolvedValue({ facturacion_id: 3, estado, tiene_cobros: false, permite_correccion: true }) });
    expect($('estado-precios').textContent).toContain('sin cobros');
    await abrirPrecio($);
    expect($('formulario-precio').hidden).toBe(false); expect($('alcance-precio').textContent).toContain('Solo este precinto: paquete 2, posición 3');
    expect($('titulo-correccion-precio').focused).toBe(true);
    expect($('alcance-precio').textContent).toContain('677291');
    expect($('referencia-precio').textContent).toContain('12,34'); expect($('referencia-precio').textContent).not.toContain('23,45');
    expect($('precio-corregido').value).toBe('12,34'); expect($('guardar-precio').disabled).toBe(true);
    expect($('codigo-lectura').disabled).toBe(true); expect($('volver-detalle').disabled).toBe(true);
    $('precio-corregido').value = '0,10'; await confirmar($); expect($('guardar-precio').disabled).toBe(false);
    await $('formulario-precio').dispatch('submit');
    expect(api.corregirPrecio).toHaveBeenCalledWith(7, 11, { precio_aplicado: '0.10' });
    expect($('estado-lectura').textContent).toContain('Precio del precinto corregido. Importe de la entrega actualizado.');
    expect($('formulario-precio').hidden).toBe(true); expect($('volver-detalle').disabled).toBe(false);
  });
  it.each([
    { estado: 'EMITIDA', tiene_cobros: false, motivo_bloqueo: 'Facturación emitida. Debe reabrirse de forma controlada, con fecha y motivo.' },
    { estado: 'EMITIDA', tiene_cobros: true, motivo_bloqueo: 'Existe un cobro. No se puede reabrir ni corregir precios.' },
  ])('estado bloqueado $estado con cobros=$tiene_cobros comunica el motivo y no habilita edición', async (contexto) => {
    const { $, api } = await conLecturas({ consultarContextoPrecios: vi.fn().mockResolvedValue({ ...contexto, permite_correccion: false }) });
    expect($('estado-precios').textContent).toBe(contexto.motivo_bloqueo);
    expect($('precintos-lecturas').children[0].children[5].children[0].children[0].disabled).toBe(true);
    await abrirPrecio($); expect($('formulario-precio').hidden).not.toBe(false);
    expect($('codigo-lectura').disabled).toBe(true); await leer($); expect(api.evaluarLectura).not.toHaveBeenCalled();
    expect(api.corregirPrecio).not.toHaveBeenCalled();
  });
  it('no permite corregir si falla comprobar el estado real', async () => {
    const { $, api } = await conLecturas({ consultarContextoPrecios: vi.fn().mockRejectedValue(new ErrorEntrega('Fallo de consulta')) });
    expect($('estado-precios').textContent).toContain('No se pudo comprobar');
    await abrirPrecio($); expect(api.corregirPrecio).not.toHaveBeenCalled();
    expect($('reintentar-lecturas').hidden).toBe(false);
  });
  it('sin revisión permite corregir cada fila sin preparar facturación', async () => {
    const { $, api, html } = await conLecturas({ consultarContextoPrecios: vi.fn().mockResolvedValue({
      facturacion_id: null, estado: null, estado_entrega: 'SIN_FACTURAR', participacion_id: null, tiene_cobros: false, permite_correccion: true, motivo_bloqueo: null,
    }) });
    expect(html.indexOf('id="estado-precios"')).toBeLessThan(html.indexOf('id="precintos-lecturas"'));
    expect($('estado-precios').textContent).toContain('Entrega sin facturar');
    expect($('precintos-lecturas').children.every((tr) => !tr.children[5].children[0].children[0].disabled)).toBe(true);
    expect($('reconsultar-precios').hidden).toBe(true);
    await abrirPrecio($); await confirmar($); await $('formulario-precio').dispatch('submit');
    expect(api.corregirPrecio).toHaveBeenCalledWith(7, 11, { precio_aplicado: '12.34' });
  });
  it('corrección muestra el total nuevo y deja intacta la otra fila con el mismo código', async () => {
    const { $, api } = await conLecturas(); await abrirPrecio($); await confirmar($);
    $('precio-corregido').value = '0,10';
    api.consultarPrecintos.mockResolvedValue([{ ...lectura, precio_aplicado: '0.10' }, dosLecturas[1]]);
    api.consultarResumen.mockResolvedValue(resumen('12.44', 2));
    await $('formulario-precio').dispatch('submit');
    expect($('importe-lecturas').textContent).toBe('12,44 €');
    expect($('precintos-lecturas').children.map((tr) => tr.children[4].textContent)).toEqual(['0,10', '12,34']);
  });
  it('fallo de contexto no equivale a facturación cerrada y se recupera consultando el servidor', async () => {
    const { $, api } = await conLecturas({ consultarContextoPrecios: vi.fn().mockRejectedValue(new ErrorEntrega('No se pudo conectar con la API.')) });
    expect($('estado-precios').textContent).toContain('No se pudo conectar con la API.');
    expect($('reconsultar-precios').hidden).toBe(false);
    api.consultarContextoPrecios.mockResolvedValue({ facturacion_id: 3, estado: 'REABIERTA', tiene_cobros: false, permite_correccion: true });
    await $('reconsultar-precios').dispatch('click');
    expect($('estado-precios').textContent).toContain('reabierta sin cobros');
    expect($('precintos-lecturas').children.every((tr) => !tr.children[5].children[0].children[0].disabled)).toBe(true);
  });
  it('rechaza decimal inválido sin enviar, conserva entrada y permite cancelar', async () => {
    const { $, api } = await conLecturas(); await abrirPrecio($); await confirmar($);
    $('precio-corregido').value = '1,234'; await $('formulario-precio').dispatch('submit');
    expect(api.corregirPrecio).not.toHaveBeenCalled(); expect($('precio-corregido').value).toBe('1,234');
    expect($('mensaje-precio').textContent).toContain('sin redondeo');
    await $('cancelar-precio').dispatch('click'); expect($('codigo-lectura').disabled).toBe(false);
  });
  it('bloquea doble envío, lectura y navegación hasta confirmar la respuesta', async () => {
    const wait = pendiente(), { $, api, alVolver } = await conLecturas({ corregirPrecio: vi.fn().mockReturnValue(wait.promise) });
    await abrirPrecio($); await confirmar($); const guardando = $('formulario-precio').dispatch('submit');
    await $('formulario-precio').dispatch('submit'); await leer($); await $('volver-detalle').dispatch('click');
    expect(api.corregirPrecio).toHaveBeenCalledTimes(1); expect(api.evaluarLectura).not.toHaveBeenCalled(); expect(alVolver).not.toHaveBeenCalled();
    expect($('cancelar-precio').disabled).toBe(true);
    wait.resolve({ lectura, subtotal_facturable: '24.68' }); await guardando;
  });
  it('cierre posterior al abrir produce conflicto, conserva entrada y muestra el bloqueo actualizado', async () => {
    const { $, api } = await conLecturas({ corregirPrecio: vi.fn().mockRejectedValue(new ErrorEntrega('Facturación emitida. Debe reabrirse.', 409)) });
    await abrirPrecio($); await confirmar($); $('precio-corregido').value = '0,10';
    api.consultarContextoPrecios.mockResolvedValue({ facturacion_id: 3, estado: 'EMITIDA', permite_correccion: false, motivo_bloqueo: 'Debe reabrirse de forma controlada.' });
    await $('formulario-precio').dispatch('submit');
    expect($('precio-corregido').value).toBe('0,10'); expect($('mensaje-precio').textContent).toContain('Conflicto');
    expect($('estado-precios').textContent).toContain('reabrirse'); expect($('guardar-precio').disabled).toBe(true);
  });
  it('respuesta incierta exige consulta y nueva confirmación sin repetir automáticamente', async () => {
    const { $, api } = await conLecturas({ corregirPrecio: vi.fn().mockRejectedValue(new ErrorEntrega('Respuesta perdida')) });
    await abrirPrecio($); await confirmar($); $('precio-corregido').value = '0,10'; await $('formulario-precio').dispatch('submit');
    expect($('mensaje-precio').textContent).toContain('Resultado incierto'); expect($('guardar-precio').disabled).toBe(true);
    await confirmar($); await $('formulario-precio').dispatch('submit'); expect(api.corregirPrecio).toHaveBeenCalledTimes(1);
    api.consultarPrecintos.mockResolvedValue(dosLecturas.map((p) => p.id === lectura.id ? { ...p, precio_aplicado: '0.10' } : p));
    await $('consultar-precio').dispatch('click');
    expect($('mensaje-precio').textContent).toContain('Precio aplicado actual del precinto seleccionado: 0,10');
    expect($('confirmacion-precio').checked).toBe(false); expect($('guardar-precio').disabled).toBe(true);
    expect(api.corregirPrecio).toHaveBeenCalledTimes(1);
  });
  it('fallo al refrescar conserva la confirmación del guardado y permite recuperar por consulta', async () => {
    const { $, api } = await conLecturas(); await abrirPrecio($); await confirmar($);
    api.consultarResumen.mockRejectedValue(new ErrorEntrega('Fallo del resumen'));
    await $('formulario-precio').dispatch('submit');
    expect($('estado-lectura').textContent).toContain('Precio del precinto corregido'); expect($('estado-totales-lecturas').textContent).toContain('Fallo del resumen');
    expect($('importe-lecturas').textContent).toBe('12,44 €');
    expect($('reintentar-lecturas').hidden).toBe(false); expect(api.corregirPrecio).toHaveBeenCalledTimes(1);
  });
  it('cliente HTTP identifica el precinto individual y envía solo el precio textual', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }); vi.stubGlobal('fetch', fetch);
    await consultarContextoPrecios(7); await corregirPrecio(7, 11, { precio_aplicado: '0.10' });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/entregas/7/precios', '/entregas/7/precintos/11/precio']);
    expect(fetch.mock.calls[1][1].method).toBe('PUT'); expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ precio_aplicado: '0.10' });
  });
});

describe('cliente de endpoints existentes de lecturas', () => {
  it('usa rutas y cuerpos existentes sin campos de precio/estado/autorización', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ resultado: 'ADMITIDO' }) }); vi.stubGlobal('fetch', fetch);
    await evaluarLectura(7, '677291'); await guardarLectura(7, { codigo_barras_original: '677291', clave_operacion: clave, decision: null, nuevo_paquete: false });
    await consultarOperacion(7, clave); await consultarPrecintos(7); await consultarIncidencias(7);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/entregas/7/evaluacion', '/entregas/7/lecturas', `/entregas/7/operaciones/${clave}`, '/entregas/7/precintos', '/entregas/7/incidencias']);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ codigo_barras_original: '677291' });
    expect(Object.keys(JSON.parse(fetch.mock.calls[1][1].body))).toEqual(['codigo_barras_original', 'clave_operacion', 'decision', 'nuevo_paquete']);
  });
});


describe('eliminación visual individual de precinto apto', () => {
  const prepararBorrado = (overrides = {}) => preparar({ consultarResumen: vi.fn().mockResolvedValue(resumen('12.34', 1)), consultarPrecintos: vi.fn().mockResolvedValue([lectura]), ...overrides });
  const abrir = async ($) => $('precintos-lecturas').children[0].children[5].children[0].children[1].dispatch('click');
  const confirmar = async ($) => { $('confirmacion-eliminar').checked = true; await $('confirmacion-eliminar').dispatch('input'); };
  it('papelera compacta en la misma celda, accesible, confirmación identificada y cancelación sin DELETE', async () => {
    const { $, api, html } = await prepararBorrado();
    const fila = $('precintos-lecturas').children[0], boton = fila.children[5].children[0].children[1];
    expect(fila.children).toHaveLength(6); expect(boton.attributes['aria-label']).toContain('Eliminar precinto del código 677291, paquete 2, posición 3, precio 12,34 euros');
    expect(boton.attributes.title).toBe(boton.attributes['aria-label']); expect(boton.children[0].attributes['aria-hidden']).toBe('true');
    await abrir($); expect($('formulario-eliminar').hidden).toBe(false); expect($('titulo-eliminar').focused).toBe(true);
    expect($('identidad-eliminar').textContent).toContain('Código nacional 677291 · Paquete 2 · Posición 3 · Precio aplicado 12,34 €');
    expect($('identidad-eliminar').textContent).toContain('Farmacia histórica');
    expect($('confirmar-eliminar').disabled).toBe(true); await $('formulario-eliminar').dispatch('submit'); expect(api.eliminarPrecinto).not.toHaveBeenCalled();
    expect(html).toContain('Confirmo eliminar este precinto registrado por error.');
    await $('cancelar-eliminar').dispatch('click'); expect($('formulario-eliminar').hidden).toBe(true); expect($('codigo-lectura').focused).toBe(true);
  });
  it.each([null, 'REVISION', 'REABIERTA'])('permite en %s sin cobros, borra solo ID y actualiza tabla/total/contexto/scroll', async (estado) => {
    const otro = { ...lectura, id: 12, numero_paquete: 3, posicion_paquete: 1 };
    const { $, api } = await prepararBorrado({ consultarPrecintos: vi.fn().mockResolvedValue([lectura, otro]), consultarResumen: vi.fn().mockResolvedValue(resumen('24.68', 2)),
      consultarContextoPrecios: vi.fn().mockResolvedValue({ facturacion_id: estado === null ? null : 3, estado, tiene_cobros: false, permite_correccion: true }) });
    $('lista-precintos').scrollTop = 130; $('lista-precintos').scrollLeft = 40; $('codigo-lectura').value = '123456';
    await abrir($); await confirmar($);
    api.consultarPrecintos.mockResolvedValue([otro]); api.consultarResumen.mockResolvedValue(resumen('12.34', 1));
    await $('formulario-eliminar').dispatch('submit');
    expect(api.eliminarPrecinto).toHaveBeenCalledWith(7, 11); expect(api.eliminarPrecinto).toHaveBeenCalledTimes(1);
    expect($('precintos-lecturas').children).toHaveLength(1); expect($('precintos-lecturas').children[0].children[0].textContent).toBe(3);
    expect($('importe-lecturas').textContent).toBe('12,34 €'); expect($('aptos-lecturas').textContent).toBe(1);
    expect($('contexto-lecturas').textContent).toContain('Farmacia histórica'); expect($('codigo-lectura').value).toBe('123456');
    expect($('lista-precintos').scrollTop).toBe(130); expect($('lista-precintos').scrollLeft).toBe(40); expect($('codigo-lectura').focused).toBe(true);
    expect($('estado-lectura').textContent).toContain('totales actualizados');
  });
  it.each(['EMITIDA', 'COBRADA', 'ERROR'])('bloquea acción en %s y no envía DELETE', async (estado) => {
    const { $, api } = await prepararBorrado({ consultarContextoPrecios: estado === 'ERROR' ? vi.fn().mockRejectedValue(new ErrorEntrega('No disponible')) : vi.fn().mockResolvedValue({ estado: estado === 'COBRADA' ? 'REABIERTA' : estado, tiene_cobros: estado === 'COBRADA', permite_correccion: false, motivo_bloqueo: 'Bloqueada' }) });
    expect($('precintos-lecturas').children[0].children[5].children[0].children[1].disabled).toBe(true);
    await abrir($); await confirmar($); await $('formulario-eliminar').dispatch('submit'); expect(api.eliminarPrecinto).not.toHaveBeenCalled();
  });
  it('bloquea doble envío, lectura, corrección y regreso mientras confirma o elimina', async () => {
    const wait = pendiente(), { $, api, alVolver } = await prepararBorrado({ eliminarPrecinto: vi.fn().mockReturnValue(wait.promise) });
    await abrir($); await confirmar($); const borrando = $('formulario-eliminar').dispatch('submit');
    await $('formulario-eliminar').dispatch('submit'); await leer($); await $('volver-detalle').dispatch('click');
    await $('precintos-lecturas').children[0].children[5].children[0].children[0].dispatch('click');
    expect(api.eliminarPrecinto).toHaveBeenCalledTimes(1); expect(api.evaluarLectura).not.toHaveBeenCalled(); expect(alVolver).not.toHaveBeenCalled(); expect($('formulario-precio').hidden).toBe(true);
    api.consultarPrecintos.mockResolvedValue([]); api.consultarResumen.mockResolvedValue(resumen()); wait.resolve({ estado: 204 }); await borrando;
    expect($('importe-lecturas').textContent).toBe('0,00 €'); expect($('sin-precintos-lecturas').hidden).toBe(false);
  });
  it('conflicto del servidor conserva selección, refresca permisos y no repite', async () => {
    const { $, api } = await prepararBorrado({ eliminarPrecinto: vi.fn().mockRejectedValue(new ErrorEntrega('Debe reabrirse', 409)) });
    await abrir($); await confirmar($); api.consultarContextoPrecios.mockResolvedValue({ estado: 'EMITIDA', permite_correccion: false, motivo_bloqueo: 'Debe reabrirse' });
    await $('formulario-eliminar').dispatch('submit'); expect($('mensaje-eliminar').textContent).toContain('Debe reabrirse'); expect($('confirmar-eliminar').disabled).toBe(true); expect($('precintos-lecturas').children).toHaveLength(1); expect(api.eliminarPrecinto).toHaveBeenCalledTimes(1);
  });
  it('respuesta perdida exige consulta; lectura ausente confirma resultado sin repetir DELETE', async () => {
    const { $, api } = await prepararBorrado({ eliminarPrecinto: vi.fn().mockRejectedValue(new ErrorEntrega('Sin respuesta')) });
    await abrir($); await confirmar($); await $('formulario-eliminar').dispatch('submit');
    expect($('consultar-eliminacion').hidden).toBe(false); expect($('cancelar-eliminar').disabled).toBe(true); expect($('confirmar-eliminar').disabled).toBe(true);
    api.consultarPrecintos.mockResolvedValue([]); api.consultarResumen.mockResolvedValue(resumen()); await $('consultar-eliminacion').dispatch('click');
    expect($('formulario-eliminar').hidden).toBe(true); expect($('importe-lecturas').textContent).toBe('0,00 €'); expect(api.eliminarPrecinto).toHaveBeenCalledTimes(1); expect($('estado-lectura').textContent).toContain('ya no está');
  });
  it('fallo de refresco después de 204 no presenta el borrado como fallido ni lo repite', async () => {
    const { $, api } = await prepararBorrado(); await abrir($); await confirmar($);
    api.consultarResumen.mockRejectedValue(new ErrorEntrega('Sin conexión')); api.consultarPrecintos.mockResolvedValue([]);
    await $('formulario-eliminar').dispatch('submit'); expect($('formulario-eliminar').hidden).toBe(true); expect($('importe-lecturas').textContent).toBe('—'); expect($('estado-lectura').textContent).toContain('Precinto eliminado. No se pudieron confirmar'); expect($('reintentar-lecturas').hidden).toBe(false); expect(api.eliminarPrecinto).toHaveBeenCalledTimes(1);
  });
  it('cliente acepta 204 sin intentar JSON y usa DELETE sin cuerpo', async () => {
    const json = vi.fn().mockRejectedValue(new Error('Sin cuerpo')), fetch = vi.fn().mockResolvedValue({ ok: true, status: 204, json }); vi.stubGlobal('fetch', fetch);
    expect(await eliminarPrecinto(7, 11)).toEqual({ estado: 204, datos: null }); expect(json).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledWith('/entregas/7/precintos/11', { method: 'DELETE' });
  });
});
