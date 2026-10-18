import request from 'supertest';
import { describe, expect, it } from 'vitest';

import app from '../src/app.js';

describe('página principal', () => {
  it('sirve el inicio en / con enlaces a las funciones disponibles', async () => {
    const respuesta = await request(app).get('/');

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toMatch(/text\/html/);
    expect(respuesta.text).toContain('href="/css/inicio.css"');
    expect(respuesta.text).toContain('href="/entregas.html"');
    expect(respuesta.text).toContain('href="/ayuntamientos.html"');
    expect(respuesta.text).toContain('href="/farmacias.html"');
    expect(respuesta.text).toContain('href="/medicamentos.html"');
    expect(respuesta.text).not.toContain('href="/facturacion.html"');

    const css = await request(app).get('/css/inicio.css');
    expect(css.status).toBe(200);
    expect(css.headers['content-type']).toMatch(/text\/css/);
  });
});

describe('recursos estáticos de Ayuntamientos', () => {
  it('sirve la página y los recursos referenciados con tipos de contenido adecuados', async () => {
    const pagina = await request(app).get('/ayuntamientos.html');

    expect(pagina.status).toBe(200);
    expect(pagina.headers['content-type']).toMatch(/text\/html/);
    expect(pagina.text).toContain('<header class="page-header page-header-with-link">');
    expect(pagina.text).toContain('href="/css/ayuntamientos.css"');
    expect(pagina.text).toContain('src="/js/ayuntamientos.js"');
    expect(pagina.text).toContain('href="/">Volver al inicio</a>');

    const css = await request(app).get('/css/ayuntamientos.css');
    expect(css.status).toBe(200);
    expect(css.headers['content-type']).toMatch(/text\/css/);
    expect(css.text).toMatch(/\.page-header-with-link\s*\{[^}]*justify-content:\s*space-between/s);
    expect(css.text).toMatch(/@media \(max-width: 40rem\)[\s\S]*?\.page-header-with-link\s*\{[^}]*flex-direction:\s*column/s);
    expect(css.text).toContain('.button:focus-visible');

    const javascript = await request(app).get('/js/ayuntamientos.js');
    expect(javascript.status).toBe(200);
    expect(javascript.headers['content-type']).toMatch(/javascript/);
  });

  it('sirve la página y los recursos JavaScript de Farmacias', async () => {
    const pagina = await request(app).get('/farmacias.html');

    expect(pagina.status).toBe(200);
    expect(pagina.headers['content-type']).toMatch(/text\/html/);
    expect(pagina.text).toContain('<header class="page-header page-header-with-link">');
    expect(pagina.text).toContain('id="campo-ayuntamiento-id"');
    expect(pagina.text).toContain('src="/js/farmacias.js"');
    expect(pagina.text).toContain('href="/">Volver al inicio</a>');

    const javascript = await request(app).get('/js/farmacias.js');
    expect(javascript.status).toBe(200);
    expect(javascript.headers['content-type']).toMatch(/javascript/);

    const apiClient = await request(app).get('/js/farmacias-api.js');
    expect(apiClient.status).toBe(200);
    expect(apiClient.headers['content-type']).toMatch(/javascript/);
  });

  it('mantiene disponible GET /health', async () => {
    const respuesta = await request(app).get('/health');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ status: 'ok' });
  });

  it('mantiene las rutas API de ayuntamientos antes del middleware estático', async () => {
    const consulta = await request(app).get('/ayuntamientos/no-valido');
    const creacion = await request(app).post('/ayuntamientos').send({});
    const actualizacion = await request(app).put('/ayuntamientos/no-valido').send({});

    expect(consulta.status).toBe(400);
    expect(consulta.body).toEqual({ error: 'Identificador no válido.' });
    expect(creacion.status).toBe(400);
    expect(creacion.body).toEqual({ error: 'Datos de ayuntamiento no válidos.' });
    expect(actualizacion.status).toBe(400);
    expect(actualizacion.body).toEqual({ error: 'Identificador no válido.' });
  });
});

describe('recursos estáticos de Medicamentos', () => {
  it('sirve la página y los recursos JavaScript del catálogo', async () => {
    const pagina = await request(app).get('/medicamentos.html');
    expect(pagina.status).toBe(200);
    expect(pagina.headers['content-type']).toMatch(/text\/html/);
    expect(pagina.text).toContain('src="/js/medicamentos.js"');
    expect(pagina.text).toContain('href="/">Volver al inicio</a>');

    const javascript = await request(app).get('/js/medicamentos.js');
    expect(javascript.status).toBe(200);
    expect(javascript.headers['content-type']).toMatch(/javascript/);

    const apiClient = await request(app).get('/js/medicamentos-api.js');
    expect(apiClient.status).toBe(200);
    expect(apiClient.headers['content-type']).toMatch(/javascript/);
  });
});

describe('recursos de Medicamentos admitidos', () => {
  it('sirve el apartado con estados separados, etiquetas y estilos compartidos', async () => {
    const pagina = await request(app).get('/ayuntamientos.html');
    expect(pagina.text).toContain('id="apartado-medicamentos"');
    expect(pagina.text.match(/role="tab"/g)).toHaveLength(3);
    expect(pagina.text.match(/role="tabpanel"/g)).toHaveLength(3);
    expect(pagina.text).toContain('aria-controls="apartado-datos"');
    expect(pagina.text).toContain('<details><summary>Ayuda sobre medicamentos</summary>');
    expect(pagina.text).not.toContain('>Actualizar medicamentos</button>');
    expect(pagina.text).not.toContain('>Actualizar lista</button>');
    expect(pagina.text).toContain('id="panel-busqueda-medicamentos"');
    expect(pagina.text).toContain('aria-controls="panel-busqueda-medicamentos"');
    expect(pagina.text).toContain('id="accion-seleccion-medicamentos"');
    expect(pagina.text).toContain('for="medicamentos-q"');
    expect(pagina.text).toContain('Situación comercial');
    expect(pagina.text).toContain('Estado general');
    expect(pagina.text).toContain('id="cancelar-medicamento"');
    expect(pagina.text).toContain('class="municipal-table"');
    for (const ruta of ['/js/ayuntamiento-medicamentos.js', '/js/gestion-municipal-ui.js']) {
      const modulo = await request(app).get(ruta);
      expect(modulo.status).toBe(200);
      expect(modulo.headers['content-type']).toMatch(/javascript/);
    }
    const css = await request(app).get('/css/ayuntamientos.css');
    expect(css.text).toContain('.municipal-table');
    expect(pagina.text).toMatch(/id="aviso-modalidad-medicamentos"[^>]*class="informative-notice"[^>]*hidden/);
    expect(css.text).toMatch(/\.informative-notice\s*\{[^}]*padding:[^}]*border:[^}]*background:[^}]*color:/s);
    expect(css.text).toMatch(/\.button\s*\{[^}]*display: inline-flex;[^}]*align-self: flex-start;[^}]*text-decoration: none;/s);
    expect(css.text).toContain('.button:focus-visible');
    expect(css.text).toMatch(/.table-scroll\s*\{[^}]*overflow-x: auto/s);
  });
});

 describe('recursos de la ficha municipal de Farmacias', () => {
  it('sirve el módulo, etiquetas, confirmaciones y tablas dentro de scroll adaptable', async () => {
    const pagina=await request(app).get('/ayuntamientos.html');
    expect(pagina.text).toContain('id="ficha-ayuntamiento"');
    expect(pagina.text).toContain('Farmacias asociadas');
    expect(pagina.text).toContain('id="panel-busqueda-farmacias"');
    expect(pagina.text).not.toContain('id="accion-seleccion-farmacias"');
    expect(pagina.text).not.toContain('id="seleccion-farmacias"');
    expect(pagina.text).not.toContain('id="volver-resultados-farmacias"');
    expect(pagina.text).toContain('>Volver al listado</button>');
    expect(pagina.text).toContain('for="farmacias-q"');
    expect(pagina.text).toContain('id="cancelar-farmacia"');
    expect(pagina.text).toContain('class="farmacias-municipales-table"');
    const modulo=await request(app).get('/js/ayuntamiento-farmacias.js');
    expect(modulo.status).toBe(200); expect(modulo.headers['content-type']).toMatch(/javascript/);
    expect(modulo.text).not.toContain("from './farmacias-api.js'");
    const css=await request(app).get('/css/ayuntamientos.css');
    expect(css.text).toContain('.farmacias-municipales-table');
    expect(css.text).toMatch(/.table-scroll\s*\{[^}]*overflow-x: auto/s);
  });
 });
