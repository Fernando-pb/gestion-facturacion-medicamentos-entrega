import request from 'supertest';
import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { createDemoAuth, demoAuthConfigFromEnv } from '../src/auth/demo-auth.js';
import pool from '../src/db.js';

const username = `demo-${randomBytes(5).toString('hex')}`;
const password = randomBytes(24).toString('base64url');
const wrongPassword = randomBytes(24).toString('base64url');
const expectedOrigin = 'https://demo.example.test';
const authConfig = { username, password, expectedOrigin, secureCookie: false };

function configuredApp(overrides = {}) {
  return createApp({
    authConfig: { ...authConfig, ...overrides },
  });
}

const postLogin = (browser, body = { username, password }) => browser.post('/auth/login')
  .set('Origin', expectedOrigin).send(body);

afterEach(() => vi.restoreAllMocks());

describe('acceso de demostración', () => {
  it('exige credenciales y contraseña mínima al iniciar fuera de las pruebas', () => {
    expect(() => demoAuthConfigFromEnv({ NODE_ENV: 'production' })).toThrow(/DEMO_USERNAME y DEMO_PASSWORD/);
    expect(() => demoAuthConfigFromEnv({ NODE_ENV: 'production', DEMO_USERNAME: 'demo', DEMO_PASSWORD: randomBytes(4).toString('hex') }))
      .toThrow(/al menos 12 caracteres/);
    expect(demoAuthConfigFromEnv({ NODE_ENV: 'production', DEMO_USERNAME: 'demo', DEMO_PASSWORD: password, APP_ORIGIN: expectedOrigin }))
      .toMatchObject({ username: 'demo', secureCookie: true, expectedOrigin });
  });

  it.each([undefined, 'null', 'file:///tmp', `${expectedOrigin}/`, `${expectedOrigin}/ruta`, `${expectedOrigin}?x=1`])(
    'exige un origen explícito y canónico en la configuración (%s)', (origin) => {
      expect(() => demoAuthConfigFromEnv({ DEMO_USERNAME: username, DEMO_PASSWORD: password, APP_ORIGIN: origin }))
        .toThrow(/APP_ORIGIN/);
    },
  );

  it('sirve la página de acceso y protege páginas y API privadas sin sesión', async () => {
    const app = configuredApp();
    const loginPage = await request(app).get('/login.html');
    const privatePage = await request(app).get('/');
    const deliveriesPage = await request(app).get('/entregas.html');
    const privateApi = await request(app).get('/ayuntamientos/no-valido');

    expect(loginPage.status).toBe(200);
    expect(loginPage.text).toContain('Iniciar sesión');
    expect((await request(app).get('/css/login.css')).status).toBe(200);
    expect((await request(app).get('/js/login.js')).status).toBe(200);
    expect(privatePage.status).toBe(303);
    expect(privatePage.headers.location).toBe('/login.html');
    expect(deliveriesPage.status).toBe(303);
    expect(privateApi.status).toBe(401);
  });

  it('acepta credenciales correctas y permite una API privada con la sesión', async () => {
    const app = configuredApp();
    const browser = request.agent(app);
    const login = await postLogin(browser);

    expect(login.status).toBe(200);
    expect(login.body).toEqual({ autenticado: true });
    expect(login.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(login.headers['set-cookie'][0]).toMatch(/SameSite=Lax/);
    const home = await browser.get('/');
    expect(home.status).toBe(200);
    expect(home.text).toContain('id="logout"');
    expect(home.text).toContain('/js/logout.js');
    expect((await browser.get('/entregas.html')).status).toBe(200);
    expect((await browser.get('/ayuntamientos/no-valido')).status).toBe(400);
  });

  it.each(['get', 'put'])('rechaza %s /configuracion-documentos sin sesión antes de acceder a datos', async (method) => {
    const connect = vi.spyOn(pool, 'connect').mockRejectedValue(new Error('No debe acceder a PostgreSQL sin sesión.'));
    let operation = request(configuredApp())[method]('/configuracion-documentos');
    if (method === 'put') operation = operation.set('Origin', expectedOrigin).send({
      nombre_presidente: 'Presidente ficticio', logo_personalizado: null,
      datos_emisor: { denominacion: 'Emisor ficticio', cif: 'TEST-CIF-0016', direccion: 'Calle ficticia' },
    });
    const response = await operation;
    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({ error: 'Inicia sesión para continuar.' });
    expect(connect).not.toHaveBeenCalled();
  });

  it.each([undefined, 'null', 'https://externa.example.test'])('rechaza PUT documental de origen %s aun con sesión válida', async (origin) => {
    const connect = vi.spyOn(pool, 'connect').mockRejectedValue(new Error('No debe acceder a PostgreSQL con origen rechazado.'));
    const browser = request.agent(configuredApp());
    await postLogin(browser).expect(200);
    let operation = browser.put('/configuracion-documentos');
    if (origin !== undefined) operation = operation.set('Origin', origin);
    const response = await operation.send({});
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Origen de la petición no permitido.' });
    expect(connect).not.toHaveBeenCalled();
  });

  it('rechaza credenciales sin revelar si falló el usuario o la contraseña', async () => {
    const app = configuredApp();
    const invalidPassword = await postLogin(request(app), { username, password: wrongPassword });
    const wrongUsername = await postLogin(request(app), { username: 'desconocido', password });

    expect(invalidPassword.status).toBe(401);
    expect(wrongUsername.status).toBe(401);
    expect(invalidPassword.body).toEqual({ error: 'Credenciales no válidas.' });
    expect(wrongUsername.body).toEqual(invalidPassword.body);
  });

  it('invalida la sesión al cerrar y elimina su cookie', async () => {
    const browser = request.agent(configuredApp());
    await postLogin(browser).expect(200);

    const logout = await browser.post('/auth/logout').set('Origin', expectedOrigin);
    expect(logout.status).toBe(204);
    expect(logout.headers['set-cookie'][0]).toMatch(/Max-Age=0/);
    expect((await browser.get('/ayuntamientos/no-valido')).status).toBe(401);
  });

  it('activa Secure para cookies cuando se configura HTTPS de producción', async () => {
    const login = await postLogin(request(configuredApp({ secureCookie: true })));
    expect(login.headers['set-cookie'][0]).toMatch(/; Secure/);
  });

  it('limita los intentos fallidos antes de aceptar más accesos', async () => {
    const app = configuredApp();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await postLogin(request(app), { username, password: wrongPassword }).expect(401);
    }

    const blocked = await postLogin(request(app));
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'No se ha podido iniciar sesión. Inténtalo más tarde.' });
  });
});

const forbiddenOrigins = [undefined, 'null', 'https://externa.example.test',
  'http://demo.example.test', 'https://demo.example.test:444', `${expectedOrigin}.externa.test`];

describe('origen de las operaciones', () => {
  it.each(forbiddenOrigins)('rechaza login de origen %s antes de crear sesión o contar intentos', async (origin) => {
    const browser = request.agent(configuredApp());
    for (let i = 0; i < 6; i += 1) {
      let login = browser.post('/auth/login').set('Host', 'externa.example.test')
        .set('X-Forwarded-Host', 'demo.example.test').set('X-Forwarded-Proto', 'https');
      if (origin !== undefined) login = login.set('Origin', origin);
      const rejected = await login.send({ username, password });
      expect(rejected.status).toBe(403);
      expect(rejected.headers['set-cookie']).toBeUndefined();
    }
    expect((await browser.get('/')).status).toBe(303);
    await postLogin(browser).expect(200);
  });

  it.each(['post', 'put', 'patch', 'delete'])('protege %s antes de modificar estado y admite el origen configurado', async (method) => {
    const app = configuredApp();
    let changes = 0;
    // Ruta solo de prueba, detrás de la misma protección que todas las API reales.
    app[method]('/csrf-probe', (_req, res) => { changes += 1; res.status(204).end(); });
    const browser = request.agent(app);
    await postLogin(browser).expect(200);

    for (const origin of forbiddenOrigins) {
      let operation = browser[method]('/csrf-probe');
      if (origin !== undefined) operation = operation.set('Origin', origin);
      await operation.send({}).expect(403);
      expect(changes).toBe(0);
    }
    await browser[method]('/csrf-probe').set('Origin', expectedOrigin).send({}).expect(204);
    expect(changes).toBe(1);
  });

  it.each([undefined, 'null', 'https://externa.example.test'])('rechaza logout de origen %s sin invalidar la sesión', async (origin) => {
    const browser = request.agent(configuredApp());
    await postLogin(browser).expect(200);
    let logout = browser.post('/auth/logout');
    if (origin !== undefined) logout = logout.set('Origin', origin);
    await logout.expect(403);
    expect((await browser.get('/')).status).toBe(200);
    await browser.post('/auth/logout').set('Origin', expectedOrigin).expect(204);
    expect((await browser.get('/')).status).toBe(303);
  });
});

function reservedAttempt(auth, body = { username, password: wrongPassword }) {
  const req = { ip: '127.0.0.1', body };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json: vi.fn(),
    setHeader: vi.fn(),
  };
  const next = vi.fn();
  auth.rateLimitMiddleware(req, res, next);
  return { req, res, next };
}

describe('reservas de intentos', () => {
  it('reserva sincrónicamente cinco plazas antes de verificar ninguna contraseña', async () => {
    const auth = createDemoAuth(authConfig);
    const admitted = Array.from({ length: 5 }, () => reservedAttempt(auth));
    expect(admitted.every(({ next }) => next.mock.calls.length === 1)).toBe(true);
    expect(reservedAttempt(auth).res.statusCode).toBe(429);

    await Promise.all(admitted.map(({ req, res }) => auth.login(req, res)));
    expect(admitted.map(({ res }) => res.statusCode)).toEqual([401, 401, 401, 401, 401]);
    expect(reservedAttempt(auth).res.statusCode).toBe(429);
  });

  it('limita una ráfaga HTTP de doce intentos a cinco comprobaciones admitidas', async () => {
    const app = configuredApp();
    const responses = await Promise.all(Array.from({ length: 12 }, () =>
      postLogin(request(app), { username, password: wrongPassword })));
    expect(responses.filter(({ status }) => status === 401)).toHaveLength(5);
    expect(responses.filter(({ status }) => status === 429)).toHaveLength(7);
    await postLogin(request(app)).expect(429);
  });

  it('conserva otras reservas cuando un login correcto limpia los fallos', async () => {
    const auth = createDemoAuth(authConfig);
    for (let i = 0; i < 2; i += 1) {
      const { req, res } = reservedAttempt(auth);
      await auth.login(req, res);
    }
    const success = reservedAttempt(auth, { username, password });
    const pending = [reservedAttempt(auth), reservedAttempt(auth)];
    expect(reservedAttempt(auth).res.statusCode).toBe(429);
    await auth.login(success.req, success.res);
    expect(success.res.statusCode).toBe(200);

    // Los dos fallos históricos se han limpiado; las dos reservas siguen ocupadas.
    const more = Array.from({ length: 3 }, () => reservedAttempt(auth));
    expect(more.every(({ next }) => next.mock.calls.length === 1)).toBe(true);
    expect(reservedAttempt(auth).res.statusCode).toBe(429);
    await Promise.all([...pending, ...more].map(({ req, res }) => auth.login(req, res)));
    expect(reservedAttempt(auth).res.statusCode).toBe(429);
  });

  it('libera la reserva ante errores antes y después de la comprobación asíncrona', async () => {
    const auth = createDemoAuth(authConfig);
    for (let i = 0; i < 6; i += 1) {
      const attempt = reservedAttempt(auth);
      expect(attempt.next).toHaveBeenCalledOnce();
      Object.defineProperty(attempt.req, 'body', { get() { throw new Error('Fallo simulado de lectura'); } });
      await expect(auth.login(attempt.req, attempt.res)).rejects.toThrow('Fallo simulado de lectura');
    }
    for (let i = 0; i < 6; i += 1) {
      const attempt = reservedAttempt(auth, { username, password });
      expect(attempt.next).toHaveBeenCalledOnce();
      attempt.res.setHeader.mockImplementation(() => { throw new Error('Fallo simulado de respuesta'); });
      await expect(auth.login(attempt.req, attempt.res)).rejects.toThrow('Fallo simulado de respuesta');
    }
    expect(reservedAttempt(auth).next).toHaveBeenCalledOnce();
  });

  it('mantiene el bloqueo hasta los 15 minutos y lo levanta al vencer la ventana', async () => {
    const start = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(start);
    const app = configuredApp();
    for (let i = 0; i < 5; i += 1) await postLogin(request(app), { username, password: wrongPassword }).expect(401);
    clock.mockReturnValue(start + 15 * 60 * 1000 - 1);
    await postLogin(request(app)).expect(429);
    clock.mockReturnValue(start + 15 * 60 * 1000);
    await postLogin(request(app)).expect(200);
  });

  it('una comprobación de una ventana vencida no borra el bloqueo de la nueva', async () => {
    const start = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(start);
    const auth = createDemoAuth(authConfig);
    const previous = reservedAttempt(auth, { username, password });
    clock.mockReturnValue(start + 15 * 60 * 1000);
    for (let i = 0; i < 5; i += 1) {
      const { req, res } = reservedAttempt(auth);
      await auth.login(req, res);
    }
    await auth.login(previous.req, previous.res);
    expect(previous.res.statusCode).toBe(200);
    expect(reservedAttempt(auth).res.statusCode).toBe(429);
  });
});
