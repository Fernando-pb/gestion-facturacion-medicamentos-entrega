import { listarAyuntamientos } from './ayuntamientos-api.js';

const leer = async (response) => {
  let data;
  try {
    data = await response.json();
  } catch (cause) {
    throw new Error(`La API respondió con estado ${response.status} y un cuerpo no JSON válido.`, { cause });
  }
  if (!response.ok) throw new Error(data?.error || `La petición a la API falló con estado ${response.status}.`);
  return data;
};

const solicitar = async (path, options) => {
  let response;
  try {
    response = await fetch(path, options);
  } catch (cause) {
    throw new Error(`No se pudo conectar con la API: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
  return leer(response);
};

export const listarFarmacias = () => solicitar('/farmacias');
export const obtenerFarmacia = (id) => solicitar(`/farmacias/${encodeURIComponent(id)}`);
export const listarAyuntamientosParaFarmacia = listarAyuntamientos;
export const crearFarmacia = (data) => solicitar('/farmacias', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});
export const actualizarFarmacia = (id, data) => solicitar(`/farmacias/${encodeURIComponent(id)}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});
