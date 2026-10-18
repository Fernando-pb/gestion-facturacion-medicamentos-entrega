import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = 'demo_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

function validateAppOrigin(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value) throw new Error();
    return url.origin;
  } catch {
    throw new Error('Configura APP_ORIGIN con el origen HTTP(S) exacto de la aplicación, sin ruta ni barra final.');
  }
}

export function demoAuthConfigFromEnv(env = process.env) {
  const username = env.DEMO_USERNAME;
  const password = env.DEMO_PASSWORD;
  if (env.NODE_ENV === 'test') return null;
  if (!username || !password) {
    throw new Error('Configura DEMO_USERNAME y DEMO_PASSWORD antes de iniciar el servidor.');
  }
  if (password.length < 12) {
    throw new Error('DEMO_PASSWORD debe tener al menos 12 caracteres.');
  }
  return {
    username, password,
    expectedOrigin: validateAppOrigin(env.APP_ORIGIN),
    secureCookie: env.NODE_ENV === 'production',
  };
}

export function serverAuthConfigFromEnv(env = process.env) {
  if (env.NODE_ENV === 'test') {
    throw new Error('NODE_ENV=test solo está permitido al probar createApp; no se permite iniciar el servidor.');
  }
  return demoAuthConfigFromEnv(env);
}

export function trustProxyFromEnv(env = process.env) {
  const hops = env.TRUST_PROXY_HOPS ?? '0';
  if (hops === '0') return false;
  if (hops === '1') return 1;
  throw new Error('Configura TRUST_PROXY_HOPS como 0 (directo) o 1 (un proxy de confianza).');
}

export function createDemoAuth(config) {
  if (!config?.username || !config?.password) throw new Error('Falta configurar la cuenta de demostración.');

  const configuredUsername = config.username;
  const secureCookie = Boolean(config.secureCookie);
  const expectedOrigin = validateAppOrigin(config.expectedOrigin);
  const sessions = new Map();
  const attempts = new Map();
  const salt = randomBytes(16);
  const dummySalt = randomBytes(16);
  const passwordHashPromise = scrypt(config.password, salt, 64);
  const dummyHashPromise = scrypt(randomBytes(32), dummySalt, 64);

  function originMiddleware(request, response, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
    if (request.get('Origin') !== expectedOrigin) {
      return response.status(403).json({ error: 'Origen de la petición no permitido.' });
    }
    return next();
  }

  function cookie(value, { clear = false } = {}) {
    const parts = [`${COOKIE_NAME}=${clear ? '' : value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
    if (secureCookie) parts.push('Secure');
    parts.push(clear ? 'Max-Age=0' : `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
    return parts.join('; ');
  }

  function readSessionId(request) {
    const entry = request.headers.cookie?.split(';').map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE_NAME}=`));
    return entry ? entry.slice(COOKIE_NAME.length + 1) : null;
  }

  function sessionMiddleware(request, response, next) {
    const sessionId = readSessionId(request);
    const session = sessionId ? sessions.get(sessionId) : null;
    if (session && session.expiresAt > Date.now()) {
      request.demoSession = session;
      return next();
    }
    if (sessionId) sessions.delete(sessionId);
    return reject(request, response);
  }

  function reject(request, response) {
    // baseUrl conserva el prefijo cuando el middleware está montado en una ruta privada.
    const path = `${request.baseUrl ?? ''}${request.path}`;
    if (path.startsWith('/api/') || /^\/(ayuntamientos|farmacias|medicamentos|entregas|facturaciones|configuracion-facturacion|configuracion-documentos)(\/|$)/.test(path)) {
      return response.status(401).json({ error: 'Inicia sesión para continuar.' });
    }
    return response.redirect(303, '/login.html');
  }

  function rateLimitMiddleware(request, response, next) {
    const now = Date.now();
    for (const [ip, entry] of attempts) if (now - entry.firstAttemptAt >= ATTEMPT_WINDOW_MS) attempts.delete(ip);
    const current = attempts.get(request.ip) ?? { count: 0, reserved: 0, firstAttemptAt: now };
    if (current.count + current.reserved >= MAX_FAILED_ATTEMPTS) {
      return response.status(429).json({ error: 'No se ha podido iniciar sesión. Inténtalo más tarde.' });
    }
    // Reservar antes del primer await impide admitir una ráfaga por encima del límite.
    current.reserved += 1;
    attempts.set(request.ip, current);
    request.loginAttempt = current;
    return next();
  }

  function finishAttempt(request, outcome) {
    const current = request.loginAttempt;
    current.reserved -= 1;
    if (outcome === 'failed') current.count += 1;
    if (outcome === 'success') current.count = 0;
    // Un acceso correcto limpia los fallos, pero conserva las reservas en curso.
    // Una respuesta de una ventana vencida nunca elimina la ventana nueva.
    if (current.count === 0 && current.reserved === 0 && attempts.get(request.ip) === current) {
      attempts.delete(request.ip);
    }
  }

  async function login(request, response) {
    let outcome;
    try {
      const submittedUsername = typeof request.body?.username === 'string' ? request.body.username : '';
      const password = typeof request.body?.password === 'string' ? request.body.password : '';
      const candidate = await scrypt(password.slice(0, 1024), submittedUsername === configuredUsername ? salt : dummySalt, 64);
      const expected = submittedUsername === configuredUsername ? await passwordHashPromise : await dummyHashPromise;
      const validPassword = timingSafeEqual(candidate, expected);
      if (submittedUsername !== configuredUsername || !validPassword || password.length > 1024) {
        outcome = 'failed';
        return response.status(401).json({ error: 'Credenciales no válidas.' });
      }

      outcome = 'success';
      const now = Date.now();
      for (const [id, session] of sessions) if (session.expiresAt <= now) sessions.delete(id);
      const sessionId = randomBytes(32).toString('base64url');
      sessions.set(sessionId, { expiresAt: now + SESSION_TTL_MS });
      response.setHeader('Set-Cookie', cookie(sessionId));
      return response.status(200).json({ autenticado: true });
    } finally {
      finishAttempt(request, outcome);
    }
  }

  function logout(request, response) {
    const sessionId = readSessionId(request);
    if (sessionId) sessions.delete(sessionId);
    response.setHeader('Set-Cookie', cookie('', { clear: true }));
    return response.status(204).end();
  }

  return { originMiddleware, sessionMiddleware, rateLimitMiddleware, login, logout };
}
