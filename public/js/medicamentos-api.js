export class ApiError extends Error {
  constructor(message, status, options = {}) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
  }
}

const leerRespuesta = async (respuesta) => {
  let datos;
  try {
    datos = await respuesta.json();
  } catch (error) {
    throw new ApiError(`La API respondió con estado ${respuesta.status} y un cuerpo no JSON válido.`, respuesta.status, { cause: error });
  }

  if (!respuesta.ok) {
    const mensaje = typeof datos?.error === 'string' && datos.error.trim() !== ''
      ? datos.error
      : `La petición a la API falló con estado ${respuesta.status}.`;
    throw new ApiError(mensaje, respuesta.status);
  }

  return datos;
};

const solicitar = async (ruta, opciones) => {
  let respuesta;
  try {
    respuesta = await fetch(ruta, opciones);
  } catch (error) {
    const causa = error instanceof Error ? error.message : String(error);
    throw new ApiError(`No se pudo conectar con la API: ${causa}`, null, { cause: error });
  }
  return leerRespuesta(respuesta);
};

export const listarMedicamentos = () => solicitar('/medicamentos');
export const obtenerMedicamento = (id) => solicitar(`/medicamentos/${encodeURIComponent(id)}`);
export const crearMedicamento = (datos) => solicitar('/medicamentos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(datos),
});
export const actualizarMedicamento = (id, datos) => solicitar(`/medicamentos/${encodeURIComponent(id)}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(datos),
});
