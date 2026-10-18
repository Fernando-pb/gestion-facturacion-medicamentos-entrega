import { readFile } from 'node:fs/promises';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import { iniciarInicio } from '../public/js/inicio.js';

const secciones = ['diaria', 'maestros', 'informes', 'configuracion'];
const nombres = ['Gestión diaria', 'Datos maestros', 'Informes', 'Configuración'];
const accesos = {
  diaria: [
    ['/entregas.html', 'Entregas y precintos', 'Abrir una entrega y consultar sus declarados y resumen.'],
    ['/facturacion-municipal.html', 'Facturación municipal', 'Consultar facturaciones emitidas y sus documentos, o iniciar una nueva facturación.'],
    ['/cobros-municipales.html', 'Cobros y liquidaciones', 'Consultar cobros del Ayuntamiento y preparar liquidaciones a farmacias.'],
  ],
  maestros: [
    ['/ayuntamientos.html', 'Ayuntamientos', 'Consultar y gestionar ayuntamientos.'],
    ['/farmacias.html', 'Farmacias', 'Consultar y gestionar farmacias y su ayuntamiento asociado.'],
    ['/medicamentos.html', 'Medicamentos', 'Consultar y gestionar el catálogo de medicamentos.'],
  ],
  informes: [['/informe-anual.html', 'Informe anual de precintos', 'Ver importes trimestrales o exportar a Excel.']],
  configuracion: [['/configuracion-facturacion.html', 'Comisión e IVA', 'Gestionar porcentajes y fechas de vigencia para gastos de facturación.']],
};
class Elemento {
  constructor() { this.attributes = {}; this.listeners = {}; this.hidden = false; this.tabIndex = 0; }
  setAttribute(n, v) { this.attributes[n] = v; }
  addEventListener(n, f) { this.listeners[n] = f; }
  focus() { this.focused = true; }
  dispatch(n, e) { this.listeners[n](e); }
}
const preparar = () => {
  const nodes = new Map(secciones.flatMap((n) => [`tab-${n}`, `panel-${n}`]).map((id) => [id, new Elemento()]));
  const el = (id) => nodes.get(id);
  iniciarInicio({ documento: { getElementById: el } });
  return el;
};
const comprobar = (el, seleccionada) => {
  for (const s of secciones) {
    expect(el(`panel-${s}`).hidden).toBe(s !== seleccionada);
    expect(el(`tab-${s}`).attributes['aria-selected']).toBe(String(s === seleccionada));
    expect(el(`tab-${s}`).tabIndex).toBe(s === seleccionada ? 0 : -1);
  }
};

describe('Inicio por secciones', () => {
  it('cada panel conserva exactamente las tarjetas, textos y destinos previstos, sin duplicados', async () => {
    const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
    expect([...html.matchAll(/class="home-link" href="/g)]).toHaveLength(8);
    for (const [indice, s] of secciones.entries()) {
      const panel = html.match(new RegExp(`<section id="panel-${s}"([^>]*)>([\\s\\S]*?)</section>`));
      expect(panel).not.toBeNull();
      expect(panel[1]).toContain(`role="tabpanel" aria-labelledby="tab-${s}" tabindex="0"`);
      expect(panel[1].includes('hidden')).toBe(s !== 'diaria');
      const enlaces = [...panel[2].matchAll(/<a class="home-link" href="([^"]+)">\s*<span class="home-link-title">([^<]+)<\/span>\s*<span class="home-link-description">([^<]+)<\/span>/g)].map((m) => m.slice(1));
      expect(enlaces).toEqual(accesos[s]);
      expect(html).toContain(`aria-controls="panel-${s}" tabindex="${indice === 0 ? '0' : '-1'}">${nombres[indice]}</button>`);
    }
    expect(html).toContain('role="tablist" aria-label="Secciones de Inicio" aria-orientation="horizontal"');
    expect(html).not.toContain('<select');
  });
  it('Gestión diaria es la única sección activa y vuelve a serlo al inicializar', () => {
    const el = preparar(); comprobar(el, 'diaria');
    el('tab-informes').dispatch('click'); comprobar(el, 'informes');
    iniciarInicio({ documento: { getElementById: el } }); comprobar(el, 'diaria');
  });
  it.each(secciones)('seleccionar %s oculta las demás secciones y actualiza ARIA y tabulación', (s) => {
    const el = preparar(); el(`tab-${s}`).dispatch('click'); comprobar(el, s);
  });
  it('flechas, Inicio y Fin seleccionan y enfocan; recorrido circular en ambas direcciones', () => {
    const el = preparar();
    for (const [desde, tecla, destino] of [
      ['diaria', 'ArrowRight', 'maestros'], ['maestros', 'ArrowRight', 'informes'],
      ['informes', 'ArrowRight', 'configuracion'], ['configuracion', 'ArrowRight', 'diaria'],
      ['diaria', 'ArrowLeft', 'configuracion'], ['configuracion', 'Home', 'diaria'], ['diaria', 'End', 'configuracion'],
    ]) {
      const evento = { key: tecla, preventDefault: vi.fn() };
      el(`tab-${desde}`).dispatch('keydown', evento); comprobar(el, destino);
      expect(el(`tab-${destino}`).focused).toBe(true); expect(evento.preventDefault).toHaveBeenCalledOnce();
    }
  });
  it('no intercepta Tab, Enter ni Espacio; conserva la activación nativa del botón', () => {
    const el = preparar();
    for (const key of ['Tab', 'Enter', ' ', 'ArrowDown']) {
      const evento = { key, preventDefault: vi.fn() }; el('tab-diaria').dispatch('keydown', evento);
      expect(evento.preventDefault).not.toHaveBeenCalled(); comprobar(el, 'diaria');
    }
  });
  it('sirve controlador y CSS, mantiene tarjetas y adapta la barra sin desplegable', async () => {
    const modulo = await request(app).get('/js/inicio.js');
    expect(modulo.status).toBe(200); expect(modulo.headers['content-type']).toMatch(/javascript/);
    const css = await request(app).get('/css/inicio.css'); expect(css.status).toBe(200);
    expect(css.text).toMatch(/\.home-tabs\s*\{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
    expect(css.text).toMatch(/@media \(max-width: 40rem\)[\s\S]*\.home-tabs\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css.text).toContain('.home-link:focus-visible'); expect(css.text).toContain('min-height: 2.75rem');
    expect(css.text).toContain('body { min-width: 0; }');
    expect(css.text).toMatch(/@media \(max-width: 40rem\)[\s\S]*\.home-tabs \.button\s*\{[^}]*padding: \.65rem \.5rem;[^}]*font-size: \.875rem;/);
    const html = await request(app).get('/'); expect(html.text).toContain('src="/js/inicio.js"');
  });
});
