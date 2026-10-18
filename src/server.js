import { serverAuthConfigFromEnv, trustProxyFromEnv } from './auth/demo-auth.js';

const requestedPort = Number.parseInt(process.env.PORT ?? '3000', 10);
let authConfig;
let trustProxy;

try {
  const configuredAuth = serverAuthConfigFromEnv();
  trustProxy = trustProxyFromEnv();
  authConfig = configuredAuth;
} catch (error) {
  console.error(`No se puede iniciar el servidor: ${error.message}`);
  process.exitCode = 1;
}

if (authConfig) {
  const { createApp } = await import('./app.js');
  const app = createApp({ authConfig, trustProxy });

  // Express 5 entrega también los errores de listen a este callback.
  const server = app.listen(requestedPort, (error) => {
    if (error) {
      console.error(error.code === 'EADDRINUSE'
        ? `No se pudo iniciar la API: el puerto ${requestedPort} está ocupado (EADDRINUSE). Detén el servidor anterior si corresponde a este proyecto y vuelve a intentarlo.`
        : `No se pudo iniciar la API (${error.code ?? 'error'}): ${error.message}`);
      process.exitCode = 1;
      return;
    }
    const address = server.address();
    if (address === null) {
      console.error('No se pudo iniciar la API: el servidor no está escuchando.');
      process.exitCode = 1;
      return;
    }
    const listeningPort = typeof address === 'object' ? address.port : requestedPort;

    console.log(`API escuchando en el puerto ${listeningPort}`);
  });
}
