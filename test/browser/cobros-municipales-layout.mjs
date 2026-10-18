// Ejecución: node test/browser/cobros-municipales-layout.mjs
// Usa Playwright instalado o PLAYWRIGHT_MODULE con la URL de su módulo disponible.
// No consulta PostgreSQL: sirve los recursos reales y un listado ficticio en memoria.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const filas = [
  { facturacion_id: 1, ayuntamiento: 'Ayuntamiento ficticio con denominación extensa', mes: 9, anio: 2026,
    importe_precintos: '2.00', importe_comision: '0.06', factura_precintos_cobrada: true, factura_comision_cobrada: true,
    numero_factura_precintos: '00001-A', numero_factura_comision: 'GEN-000002',
    fecha_prevista_liquidacion: '2026-10-20' },
  { facturacion_id: 2, ayuntamiento: 'Otro Ayuntamiento', mes: 8, anio: 2026,
    importe_precintos: '9999999999.99', importe_comision: '270000000.00', factura_precintos_cobrada: false, factura_comision_cobrada: true,
    numero_factura_precintos: 'P'.repeat(200), numero_factura_comision: 'C'.repeat(200),
    fecha_prevista_liquidacion: null },
];
const rutas = new Map([
  ['/cobros-municipales.html', 'text/html'], ['/css/ayuntamientos.css', 'text/css'],
  ['/css/cobros-municipales.css', 'text/css'], ['/js/cobros-municipales.js', 'text/javascript'],
  ['/js/facturacion-municipal-api.js', 'text/javascript'], ['/js/liquidacion-farmacias.js', 'text/javascript'],
]);
const server = createServer(async (req, res) => {
  if (req.url === '/facturaciones/emitidas') {
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(filas)); return;
  }
  if (!rutas.has(req.url)) { res.writeHead(404); res.end(); return; }
  try {
    const contenido = await readFile(new URL(`../../public${req.url}`, import.meta.url));
    res.writeHead(200, { 'Content-Type': rutas.get(req.url) }); res.end(contenido);
  } catch { res.writeHead(500); res.end(); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge' });
  const page = await browser.newPage();
  for (const width of [1280, 1024, 800, 768, 600, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`http://127.0.0.1:${server.address().port}/cobros-municipales.html`);
    await page.waitForSelector('#filas-cobros tr');
    const problemas = await page.evaluate((esperadas) => {
      const errores = [];
      const comprobar = (condicion, mensaje) => { if (!condicion) errores.push(mensaje); };
      const rectTexto = (el) => {
        const rango = document.createRange(); rango.selectNodeContents(el);
        return [...rango.getClientRects()];
      };
      const dentro = (a, b) => a.left >= b.left - 1 && a.right <= b.right + 1
        && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
      comprobar(document.documentElement.scrollWidth <= innerWidth, 'Desbordamiento horizontal de página');
      const contenedor = document.querySelector('.table-scroll');
      comprobar(contenedor.scrollWidth <= contenedor.clientWidth + 1, 'Desplazamiento horizontal de tabla');
      comprobar(document.querySelectorAll('#filas-cobros tr').length === 2, 'Faltan filas');
      for (const [i, fila] of [...document.querySelectorAll('#filas-cobros tr')].entries()) {
        const referencias = [...fila.querySelectorAll('.numero-factura')].map((el) => el.textContent);
        comprobar(JSON.stringify(referencias) === JSON.stringify([
          `Número oficial: ${esperadas[i].numero_factura_precintos}`, `Número oficial: ${esperadas[i].numero_factura_comision}`,
        ]), 'Numeración cambiada o asociada a otra factura');
      }
      for (const bloque of document.querySelectorAll('.facturas-municipales p')) {
        const nombre = bloque.querySelector('strong'), numero = bloque.querySelector('.numero-factura'), detalle = bloque.querySelector('.detalle-factura');
        const nombreRects = rectTexto(nombre), numeroRects = rectTexto(numero), detalleRects = rectTexto(detalle);
        comprobar(nombreRects.length === 1, `Etiqueta partida: ${nombre.textContent}`);
        comprobar(nombreRects.every((r) => r.bottom <= numeroRects[0].top + 1), `Solapamiento de nombre y número: ${nombre.textContent}`);
        comprobar(numeroRects.every((r) => r.bottom <= detalleRects[0].top + 1), `Solapamiento de número e importe: ${numero.textContent}`);
        const celda = bloque.closest('td').getBoundingClientRect();
        for (const r of [...nombreRects, ...numeroRects, ...detalleRects]) comprobar(dentro(r, celda), `Texto cortado: ${bloque.textContent}`);
      }
      comprobar([...document.querySelectorAll('.facturas-municipales strong')].filter((el) => el.textContent === 'GASTOS/COMISIÓN').length === 2,
        'Falta el nombre completo GASTOS/COMISIÓN');
      comprobar([...document.querySelectorAll('.facturas-municipales span')].some((el) => el.textContent === '0,06 € · Cobrada'), 'Falta importe/estado');
      for (const boton of document.querySelectorAll('#filas-cobros button')) {
        comprobar(dentro(boton.getBoundingClientRect(), boton.closest('td').getBoundingClientRect()), 'Botón fuera de celda');
        comprobar(rectTexto(boton).every((r) => dentro(r, boton.getBoundingClientRect())), 'Texto de botón cortado');
      }
      return errores;
    }, filas);
    assert.deepEqual(problemas, [], `Diseño a ${width}px: ${problemas.join('; ')}`);
    console.log(`Correcto: ${width}px, nombres, números e importes completos y sin solapamientos ni desplazamiento horizontal.`);
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
