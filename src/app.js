import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ayuntamientoRoutes from './ayuntamientos/ayuntamiento.routes.js';
import farmaciaRoutes from './farmacias/farmacia.routes.js';
import medicamentoRoutes from './medicamentos/medicamento.routes.js';
import entregaRoutes from './entregas/entrega.routes.js';
import facturacionRoutes from './facturacion/facturacion.routes.js';
import configuracionFacturacionRoutes from './configuracion-facturacion/configuracion.routes.js';
import { documentosRouter, configuracionRouter } from './documentos/documentos.routes.js';
import { createDemoAuth, demoAuthConfigFromEnv, trustProxyFromEnv } from './auth/demo-auth.js';
import { handleHttpError } from './http-errors.js';

const publicDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../public');

export function createApp({ authConfig = demoAuthConfigFromEnv(), trustProxy = trustProxyFromEnv() } = {}) {
  const app = express();
  // Opt-in limitado al proxy inmediato. Nunca confiar en toda la cadena reenviada.
  if (trustProxy !== false && trustProxy !== 1) throw new Error('La confianza en proxy debe ser false o un salto.');
  app.set('trust proxy', trustProxy);
  const auth = authConfig ? createDemoAuth(authConfig) : null;
  if (auth) app.use(auth.originMiddleware);
  // Comprobar sesión antes del router y de su parser específico para el logo en Base64.
  if (auth) app.use('/configuracion-documentos', auth.sessionMiddleware);
  app.use('/configuracion-documentos', configuracionRouter);
  app.use(express.json());

  app.get('/health', (request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  if (auth) {
    const publicPaths = new Set(['/login.html', '/css/login.css', '/js/login.js']);
    app.post('/auth/login', auth.rateLimitMiddleware, auth.login);
    app.post('/auth/logout', auth.logout);
    app.use((request, response, next) => {
      if (request.path === '/health' || request.path === '/auth/login'
        || request.path === '/auth/logout' || publicPaths.has(request.path)) return next();
      return auth.sessionMiddleware(request, response, next);
    });
  }

  app.use('/ayuntamientos', ayuntamientoRoutes);
  app.use('/farmacias', farmaciaRoutes);
  app.use('/medicamentos', medicamentoRoutes);
  app.use('/entregas', entregaRoutes);
  app.use('/facturaciones', facturacionRoutes);
  app.use('/configuracion-facturacion', configuracionFacturacionRoutes);
  app.use('/facturaciones', documentosRouter);
  app.use(express.static(publicDirectory));

  app.use(handleHttpError);

  return app;
}

const app = createApp();

export default app;
