import request from 'supertest';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { trustProxyFromEnv } from '../src/auth/demo-auth.js';

const credentials = { username: 'TEST-proxy', password: randomBytes(24).toString('base64url') };
const origin = 'https://demo.example.test';
const wrongPassword = randomBytes(24).toString('base64url');
const appFor = (trustProxy = false, secureCookie = true, expectedOrigin = origin) => {
  const app = createApp({ authConfig: { ...credentials, expectedOrigin, secureCookie }, trustProxy });
  // Sonda exclusiva de prueba, protegida por la sesión; no existe en la aplicación real.
  app.get('/proxy-test', (req, res) => res.json({ secure: req.secure, protocol: req.protocol, ip: req.ip }));
  return app;
};
const login = (app, forwardedFor, password = credentials.password) => request(app).post('/auth/login')
  .set('Origin', origin).set('X-Forwarded-Proto', 'https').set('X-Forwarded-For', forwardedFor)
  .send({ username: credentials.username, password });
const cookieFrom = (response) => response.headers['set-cookie'][0].split(';')[0];

describe('confianza explícita en el proxy y sesión', () => {
  it('no confía en cabeceras por defecto, tampoco por NODE_ENV=production', () => {
    expect(trustProxyFromEnv({})).toBe(false);
    expect(trustProxyFromEnv({ NODE_ENV: 'production' })).toBe(false);
    expect(trustProxyFromEnv({ TRUST_PROXY_HOPS: '0' })).toBe(false);
    expect(trustProxyFromEnv({ TRUST_PROXY_HOPS: '1' })).toBe(1);
  });

  it.each(['true', 'false', '2', '-1', '1.5', '', 'loopback'])('rechaza una configuración de confianza no admitida: %s', (value) => {
    expect(() => trustProxyFromEnv({ TRUST_PROXY_HOPS: value })).toThrow(/TRUST_PROXY_HOPS/);
  });

  it('inicia sesión tras un salto HTTPS, conserva la sesión y la invalida al salir', async () => {
    const app = appFor(1);
    const response = await login(app, '198.51.100.10');
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie'][0]).toMatch(/; Secure/);
    expect(response.headers['set-cookie'][0]).toMatch(/; HttpOnly/);
    expect(response.headers['set-cookie'][0]).toMatch(/; SameSite=Lax/);
    const cookie = cookieFrom(response);
    // Supertest habla HTTP con el backend; el envío manual representa al navegador tras el proxy TLS.
    const session = await request(app).get('/proxy-test').set('Cookie', cookie)
      .set('X-Forwarded-Proto', 'https').set('X-Forwarded-For', '203.0.113.90, 198.51.100.10');
    expect(session.status).toBe(200);
    expect(session.body).toEqual({ secure: true, protocol: 'https', ip: '198.51.100.10' });
    await request(app).get('/ayuntamientos/no-valido').set('Cookie', cookie).expect(400);
    const logout = await request(app).post('/auth/logout').set('Origin', origin).set('Cookie', cookie);
    expect(logout.status).toBe(204);
    expect(logout.headers['set-cookie'][0]).toMatch(/; Secure/);
    expect(logout.headers['set-cookie'][0]).toMatch(/Max-Age=0/);
    await request(app).get('/ayuntamientos/no-valido').set('Cookie', cookie).expect(401);
  });

  it('funciona por HTTP local con cookie de desarrollo y no cree las cabeceras reenviadas', async () => {
    const localOrigin = 'http://localhost:3000';
    const browser = request.agent(appFor(false, false, localOrigin));
    const response = await browser.post('/auth/login').set('Origin', localOrigin)
      .set('X-Forwarded-Proto', 'https').set('X-Forwarded-For', '198.51.100.10').send(credentials);
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie'][0]).not.toMatch(/; Secure/);
    const session = await browser.get('/proxy-test').set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-For', '198.51.100.10');
    expect(session.body.secure).toBe(false);
    expect(session.body.protocol).toBe('http');
    expect(session.body.ip).not.toBe('198.51.100.10');
    await browser.get('/').expect(200);
    await browser.post('/auth/logout').set('Origin', localOrigin).expect(204);
    await browser.get('/').expect(303);
  });

  it('separa el límite entre clientes del proxy e ignora prefijos falsificados', async () => {
    const app = appFor(1);
    for (let i = 0; i < 5; i += 1) {
      await login(app, `203.0.113.${i + 1}, 198.51.100.10`, wrongPassword).expect(401);
    }
    await login(app, '203.0.113.99, 198.51.100.10').expect(429);
    await login(app, '198.51.100.11').expect(200);
  });

  it('sin proxy configurado no permite eludir el límite cambiando X-Forwarded-For', async () => {
    const app = appFor(false);
    for (let i = 0; i < 5; i += 1) await login(app, `198.51.100.${i + 1}`, wrongPassword).expect(401);
    await login(app, '198.51.100.99').expect(429);
  });

  it('no sustituye APP_ORIGIN por Host ni por cabeceras de proxy', async () => {
    const app = appFor(1);
    for (const suppliedOrigin of ['https://externa.example.test', 'null']) {
      const response = await request(app).post('/auth/login').set('Origin', suppliedOrigin)
        .set('Host', 'demo.example.test').set('X-Forwarded-Host', 'demo.example.test')
        .set('X-Forwarded-Proto', 'https').send(credentials);
      expect(response.status).toBe(403);
      expect(response.headers['set-cookie']).toBeUndefined();
    }
    await login(app, '198.51.100.10').expect(200);
  });

  it('no retira Secure de producción si la cabecera reenviada dice HTTP', async () => {
    const response = await request(appFor(1)).post('/auth/login').set('Origin', origin)
      .set('X-Forwarded-Proto', 'http').send(credentials);
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie'][0]).toMatch(/; Secure/);
  });
});
