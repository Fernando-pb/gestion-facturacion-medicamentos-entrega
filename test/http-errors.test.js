import request from 'supertest';
import { randomBytes, scrypt } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import pool from '../src/db.js';
import { handleHttpError } from '../src/http-errors.js';

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, scrypt: vi.fn(actual.scrypt) };
});

const expectedOrigin = 'https://demo.example.test';
const credentials = { username: 'TEST-login', password: randomBytes(24).toString('base64url') };
const authConfig = { ...credentials, expectedOrigin, secureCookie: false };
const internalError = () => Object.assign(new Error('DETALLE_INTERNO_TEST SELECT /srv/privado host.interno.invalid'), {
  code: 'XX000', detail: 'DETALLE_SQL_TEST', query: 'SELECT TEST',
});
let log;
beforeEach(() => { log = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

const expectInternalError = (response) => {
  expect(response.status).toBe(500);
  expect(response.headers['content-type']).toMatch(/application\/json/);
  expect(response.body).toEqual({ error: 'Error interno del servidor.' });
  expect(response.text).not.toMatch(/DETALLE_|SELECT|\/srv\/|host\.interno|stack|<html/i);
};

describe('errores HTTP sin detalles internos', () => {
  it.each(['/ayuntamientos', '/farmacias', '/medicamentos', '/facturaciones/emitidas', '/configuracion-documentos'])(
    'protege los fallos inesperados de %s', async (path) => {
      vi.spyOn(pool, 'query').mockRejectedValue(internalError());
      vi.spyOn(pool, 'connect').mockRejectedValue(internalError());
      expectInternalError(await request(createApp({ authConfig: null })).get(path));
      expect(log).toHaveBeenCalledOnce();
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/DETALLE_|SELECT|\/srv\/|host\.interno/);
    },
  );

  it('protege un fallo asíncrono del login y libera la reserva', async () => {
    const app = createApp({ authConfig });
    for (let i = 0; i < 6; i += 1) {
      vi.mocked(scrypt).mockImplementationOnce((_password, _salt, _length, callback) => callback(internalError()));
      const response = await request(app).post('/auth/login').set('Origin', expectedOrigin).send(credentials);
      expectInternalError(response);
      expect(response.headers['set-cookie']).toBeUndefined();
    }
    expect(JSON.stringify(log.mock.calls)).not.toContain(credentials.password);
    expect(JSON.stringify(log.mock.calls)).not.toContain(credentials.username);
    await request(app).post('/auth/login').set('Origin', expectedOrigin).send(credentials).expect(200);
  });

  it('conserva JSON mal formado como 400 sin devolver el cuerpo recibido', async () => {
    const response = await request(createApp({ authConfig })).post('/auth/login')
      .set('Origin', expectedOrigin).set('Content-Type', 'application/json').send('{"password":"TEST-incompleto');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'JSON no válido.' });
    expect(log).not.toHaveBeenCalled();
  });

  it('no confía en el status ni en los metadatos arbitrarios de un error inesperado', async () => {
    const marker = 'TEST-dato-privado-' + randomBytes(12).toString('hex');
    vi.spyOn(pool, 'query').mockRejectedValue(Object.assign(new Error(marker), {
      status: 401, expose: true, code: marker, name: marker, detail: marker,
    }));
    expectInternalError(await request(createApp({ authConfig: null })).get('/ayuntamientos?token=' + marker)
      .set('Cookie', 'TEST=' + marker).set('Authorization', 'Bearer ' + marker));
    expect(log).toHaveBeenCalledWith('Error HTTP inesperado.', {
      metodo: 'GET', recurso: 'ayuntamientos', ruta: '/', tipo: 'Error', codigo: undefined,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(marker);
  });

  it('cierra una respuesta ya iniciada sin añadir detalles ni delegar el error original', () => {
    const response = { headersSent: true, destroy: vi.fn(), status: vi.fn() };
    const next = vi.fn();
    handleHttpError(internalError(), { method: 'GET', route: { path: '/TEST' } }, response, next);
    expect(response.destroy).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/DETALLE_|SELECT|\/srv\/|host\.interno/);
  });

  it('devuelve 413 genérico en login al superar el límite JSON', async () => {
    const response = await request(createApp({ authConfig })).post('/auth/login')
      .set('Origin', expectedOrigin).send({ password: 'TEST'.repeat(30000) });
    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: 'El cuerpo de la petición supera el tamaño permitido.' });
    expect(log).not.toHaveBeenCalled();
  });

  it('devuelve 415 genérico para una codificación no admitida', async () => {
    const response = await request(createApp({ authConfig })).post('/auth/login')
      .set('Origin', expectedOrigin).set('Content-Type', 'application/json; charset=iso-8859-1').send('{}');
    expect(response.status).toBe(415);
    expect(response.body).toEqual({ error: 'Codificación del cuerpo no admitida.' });
    expect(log).not.toHaveBeenCalled();
  });

  it('conserva validación 400, inexistencia 404 y conflicto funcional 409', async () => {
    const app = createApp({ authConfig: null });
    await request(app).get('/ayuntamientos/no-valido').expect(400, { error: 'Identificador no válido.' });
    const query = vi.spyOn(pool, 'query').mockResolvedValueOnce({ rows: [] });
    await request(app).get('/ayuntamientos/1').expect(404, { error: 'Ayuntamiento no encontrado.' });
    query.mockRejectedValueOnce(Object.assign(internalError(), { code: '23505', constraint: 'uq_ayuntamiento_cif' }));
    await request(app).post('/ayuntamientos').send({
      cif: 'TEST-CIF-ERROR', denominacion: 'Ayuntamiento TEST', direccion: 'Calle TEST',
      codigo_postal: '00000', localidad: 'Localidad TEST', provincia: 'Provincia TEST',
      estado: 'ACTIVO', tipo_lista_medicamentos: 'GENERAL',
    }).expect(409, { error: 'El CIF ya está registrado.' });
    expect(log).not.toHaveBeenCalled();
  });
});
