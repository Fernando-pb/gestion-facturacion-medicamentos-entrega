export class ErrorEntrega extends Error {
  constructor(message, estado = null) {
    super(message);
    this.estado = estado;
    this.incierto = estado === null;
  }
}

const solicitar = async (url, method = 'GET', body) => {
  let response;
  try {
    response = await fetch(url, { method, ...(body === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }) });
  } catch {
    throw new ErrorEntrega('No se pudo conectar con la API.');
  }
  if (response.status === 204 && response.ok) return { estado: 204, datos: null };
  let datos;
  try { datos = await response.json(); } catch {
    throw new ErrorEntrega('La respuesta de la API no pudo confirmarse.');
  }
  if (!response.ok) {
    const error = new ErrorEntrega(datos?.error || datos?.resultado || 'La petición falló.', response.status);
    error.datos = datos;
    throw error;
  }
  return { estado: response.status, datos };
};
export const listarPeriodos = async () => (await solicitar('/entregas/periodos')).datos;
export const listarEntregas = async (periodoId = '') =>
  (await solicitar(`/entregas/registradas${periodoId === '' ? '' : `?${new URLSearchParams({ periodo_id: periodoId })}`}`)).datos;
export const buscarFarmacias = async (texto) => {
  if (!texto.trim()) return [];
  const consultar = async (campo, modo) => (await solicitar(`/farmacias/busqueda?${new URLSearchParams({ campo, modo, q: texto })}`)).datos;
  const listas = await Promise.all([consultar('soe', 'prefijo'), consultar('denominacion', 'contiene')]);
  return [...new Map(listas.flat().map((farmacia) => [farmacia.id, farmacia])).values()];
};
export const abrirEntrega = (body) => solicitar('/entregas', 'POST', body);
export const consultarEntrega = async (body) => (await solicitar(`/entregas?${new URLSearchParams(body)}`)).datos;
export const guardarDeclarados = async (id, body) =>
  (await solicitar(`/entregas/${encodeURIComponent(id)}/declarados`, 'PUT', body)).datos;
export const consultarResumen = async (id) => (await solicitar(`/entregas/${encodeURIComponent(id)}/resumen`)).datos;
export const evaluarLectura = async (id, codigo) =>
  (await solicitar(`/entregas/${encodeURIComponent(id)}/evaluacion`, 'POST', { codigo_barras_original: codigo })).datos;
export const guardarLectura = async (id, body) =>
  (await solicitar(`/entregas/${encodeURIComponent(id)}/lecturas`, 'POST', body)).datos;
export const consultarOperacion = async (id, clave) =>
  (await solicitar(`/entregas/${encodeURIComponent(id)}/operaciones/${encodeURIComponent(clave)}`)).datos;
export const consultarPrecintos = async (id) => (await solicitar(`/entregas/${encodeURIComponent(id)}/precintos`)).datos;
export const consultarIncidencias = async (id) => (await solicitar(`/entregas/${encodeURIComponent(id)}/incidencias`)).datos;
export const consultarContextoPrecios = async (id) => (await solicitar(`/entregas/${encodeURIComponent(id)}/precios`)).datos;
export const corregirPrecio = async (id, precintoId, body) =>
  (await solicitar(`/entregas/${encodeURIComponent(id)}/precintos/${encodeURIComponent(precintoId)}/precio`, 'PUT', body)).datos;
export const eliminarPrecinto = async (id, precintoId) =>
  solicitar(`/entregas/${encodeURIComponent(id)}/precintos/${encodeURIComponent(precintoId)}`, 'DELETE');
