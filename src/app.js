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
import { createDemoAuth, demoAuthConfigFromEnv } from './auth/demo-auth.js';

const publicDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../public');

export function createApp({ authConfig = demoAuthConfigFromEnv() } = {}) {
  const app = express();
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

  app.use((error, request, response, next) => {
    if (error?.type === 'entity.parse.failed' && error.status === 400) {
      return response.status(400).json({ error: 'JSON no válido.' });
    }
    return next(error);
  });

  return app;
}

const app = createApp();

export default app;
