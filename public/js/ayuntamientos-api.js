export class ApiError extends Error {
  constructor(message, status, options = {}) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
  }
}

const leerRespuesta = async (respuesta) => {
  if (respuesta.ok && respuesta.status === 204) return null;
  let datos;

  try {
    datos = await respuesta.json();
  } catch (error) {
    throw new ApiError(
      `La API respondió con estado ${respuesta.status} y un cuerpo no JSON válido.`,
      respuesta.status,
      { cause: error },
    );
  }

  if (!respuesta.ok) {
    const mensaje =
      typeof datos?.error === 'string' && datos.error.trim() !== ''
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
    throw new ApiError(`No se pudo conectar con la API: ${causa}`, null, {
      cause: error,
    });
  }

  return leerRespuesta(respuesta);
};

export const listarAyuntamientos = () => solicitar('/ayuntamientos');

export const obtenerAyuntamiento = (id) =>
  solicitar(`/ayuntamientos/${encodeURIComponent(id)}`);

export const crearAyuntamiento = (datos) =>
  solicitar('/ayuntamientos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });

export const actualizarAyuntamiento = (id, datos) =>
  solicitar(`/ayuntamientos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });

const rutaFarmacias = (id) => `/ayuntamientos/${encodeURIComponent(id)}/farmacias`;
export const listarFarmaciasAsociadas = (id) => solicitar(rutaFarmacias(id));
export const buscarFarmacias = (id, parametros) =>
  solicitar(`${rutaFarmacias(id)}/busqueda?${new URLSearchParams(parametros)}`);
export const asignarFarmacia = (id, datos) => solicitar(rutaFarmacias(id), {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
});
export const quitarFarmacia = (id, farmaciaId) =>
  solicitar(`${rutaFarmacias(id)}/${encodeURIComponent(farmaciaId)}`, { method: 'DELETE' });

const rutaMedicamentos = (id) => `/ayuntamientos/${encodeURIComponent(id)}/medicamentos`;
export const listarMedicamentosAdmitidos = (id) => solicitar(rutaMedicamentos(id));
export const buscarMedicamentos = (parametros) => solicitar(`/medicamentos?${new URLSearchParams(parametros)}`);
export const asociarMedicamento = (id, medicamentoId) => solicitar(rutaMedicamentos(id), {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medicamento_id: medicamentoId }),
});
export const quitarMedicamento = (id, medicamentoId) =>
  solicitar(`${rutaMedicamentos(id)}/${encodeURIComponent(medicamentoId)}`, { method: 'DELETE' });
