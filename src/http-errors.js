const errorNames = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'AggregateError']);
const systemCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE']);
const resources = new Set(['auth', 'ayuntamientos', 'farmacias', 'medicamentos', 'entregas',
  'facturaciones', 'configuracion-facturacion', 'configuracion-documentos']);

// No registrar mensajes, stacks, SQL, cuerpos, cabeceras ni URLs con parámetros.
function logUnexpectedError(error, request) {
  const code = typeof error?.code === 'string' ? error.code : '';
  const resource = request.path?.split('/')[1];
  console.error('Error HTTP inesperado.', {
    metodo: request.method,
    recurso: resources.has(resource) ? resource : null,
    ruta: typeof request.route?.path === 'string' ? request.route.path : null,
    tipo: errorNames.has(error?.name) ? error.name : 'Error',
    codigo: /^[0-9A-Z]{5}$/.test(code) || systemCodes.has(code) ? code : undefined,
  });
}

export function handleHttpError(error, request, response, _next) {
  // Los errores previstos de negocio se resuelven antes, en sus controladores/servicios.
  if (!response.headersSent) {
    if (error?.type === 'entity.parse.failed' && error.status === 400) {
      return response.status(400).json({ error: 'JSON no válido.' });
    }
    if (error?.type === 'entity.too.large' && error.status === 413) {
      return response.status(413).json({ error: 'El cuerpo de la petición supera el tamaño permitido.' });
    }
    if (['charset.unsupported', 'encoding.unsupported'].includes(error?.type) && error.status === 415) {
      return response.status(415).json({ error: 'Codificación del cuerpo no admitida.' });
    }
    if (['request.aborted', 'request.size.invalid'].includes(error?.type) && error.status === 400) {
      return response.status(400).json({ error: 'Cuerpo de la petición no válido.' });
    }
  }
  logUnexpectedError(error, request);
  // Si ya empezó la respuesta, cerrarla sin delegar el error original al manejador por defecto.
  if (response.headersSent) return response.destroy();
  return response.status(500).json({ error: 'Error interno del servidor.' });
}
