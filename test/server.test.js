import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const procesos = [], servidores = [];
const script = fileURLToPath(new URL('../src/server.js', import.meta.url));
const arrancar = (port, overrides = {}) => {
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    DEMO_USERNAME: `prueba-${randomBytes(6).toString('hex')}`,
    DEMO_PASSWORD: randomBytes(24).toString('base64url'),
    APP_ORIGIN: 'http://localhost:3000',
    PORT: String(port),
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  // El Pool no abre conexiones hasta recibir una petición de negocio.
  const proceso = spawn(process.execPath, [script], {
    env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  procesos.push(proceso);
  const salida = { stdout: '', stderr: '' };
  proceso.stdout.on('data', (datos) => { salida.stdout += datos; });
  proceso.stderr.on('data', (datos) => { salida.stderr += datos; });
  return { proceso, salida };
};
const esperarArranque = (proceso) => new Promise((resolve, reject) => {
  proceso.once('error', reject);
  proceso.once('exit', (codigo) => reject(new Error(`Arranque terminado con código ${codigo}`)));
  let texto = '';
  proceso.stdout.on('data', (datos) => {
    texto += datos;
    const coincidencia = texto.match(/API escuchando en el puerto (\d+)/);
    if (coincidencia) resolve(coincidencia[1]);
  });
});
afterEach(async () => {
  for (const proceso of procesos.splice(0)) {
    if (proceso.exitCode === null && proceso.signalCode === null) {
      const terminado = once(proceso, 'exit'); proceso.kill(); await terminado;
    }
  }
  for (const servidor of servidores.splice(0)) {
    await new Promise((resolve, reject) => servidor.close((error) => error ? reject(error) : resolve()));
  }
});

describe('arranque HTTP sin consultas a la base', () => {
  it.each([
    ['NODE_ENV=test', { NODE_ENV: 'test' }, 'NODE_ENV=test'],
    ['sin usuario', { DEMO_USERNAME: undefined }, 'DEMO_USERNAME y DEMO_PASSWORD'],
    ['sin contraseña', { DEMO_PASSWORD: undefined }, 'DEMO_USERNAME y DEMO_PASSWORD'],
    ['contraseña no válida', { DEMO_PASSWORD: randomBytes(4).toString('base64url') }, 'al menos 12 caracteres'],
    ['sin origen configurado', { APP_ORIGIN: undefined }, 'APP_ORIGIN'],
    ['origen no válido', { APP_ORIGIN: 'https://demo.example.test/ruta' }, 'APP_ORIGIN'],
  ])('no inicia sin autenticación válida (%s)', async (_caso, overrides, mensaje) => {
    const { proceso, salida } = arrancar(0, overrides);
    const [codigo] = await once(proceso, 'close');

    expect(codigo).toBe(1);
    expect(salida.stderr).toContain(mensaje);
    expect(salida.stderr).toContain('No se puede iniciar el servidor');
    expect(salida.stdout).not.toContain('API escuchando');
  });

  it('anuncia el puerto real al arrancar y sirve health', async () => {
    // Puerto efímero exclusivo para prueba, solicitado explícitamente; no fallback.
    const { proceso, salida } = arrancar(0);
    const port = await esperarArranque(proceso);
    const respuesta = await fetch(`http://localhost:${port}/health`);
    expect(respuesta.status).toBe(200); expect(await respuesta.json()).toEqual({ status: 'ok' });
    expect(salida.stderr).toBe(''); expect(proceso.exitCode).toBeNull();
  }, 10000);
  it('EADDRINUSE muestra el error original, sale con 1 y no anuncia éxito ni toma otro puerto', async () => {
    const ocupado = createServer((_, res) => res.end('Servidor de prueba original'));
    servidores.push(ocupado);
    await new Promise((resolve) => ocupado.listen(0, resolve));
    const port = ocupado.address().port;
    const { proceso, salida } = arrancar(port);
    const [codigo] = await once(proceso, 'close');
    expect(codigo).toBe(1);
    expect(salida.stderr).toContain(`puerto ${port} está ocupado (EADDRINUSE)`);
    expect(salida.stderr).not.toContain('TypeError');
    expect(salida.stdout).not.toContain('API escuchando');
    expect(await (await fetch(`http://localhost:${port}`)).text()).toBe('Servidor de prueba original');
  }, 10000);
});
