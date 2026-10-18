const solicitar = async (ruta, xml = false) => {
  let respuesta;
  try { respuesta = await fetch(ruta); }
  catch { throw new Error('No se pudo conectar. Inténtalo de nuevo.'); }
  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => null);
    throw new Error(datos?.error || 'No se pudo obtener el informe.');
  }
  if (xml) {
    if (!respuesta.headers.get('content-type')?.includes('application/xml')) throw new Error('La respuesta no es un archivo Excel XML.');
    return respuesta.blob();
  }
  return respuesta.json();
};
export const listarAyuntamientos = () => solicitar('/ayuntamientos');
export const verInforme = (filtros) => solicitar(`/facturaciones/informe-anual?${new URLSearchParams(filtros)}`);
export const exportarInforme = (filtros) => solicitar(`/facturaciones/informe-anual/excel?${new URLSearchParams(filtros)}`, true);
export const descargarExcel = (blob, nombre) => {
  const url = URL.createObjectURL(blob), enlace = document.createElement('a');
  enlace.href = url; enlace.download = nombre; document.body.append(enlace); enlace.click(); enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
