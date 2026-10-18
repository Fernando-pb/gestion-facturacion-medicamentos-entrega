export const solicitar = async (url, datos) => {
  const r=await fetch(url, datos ? {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(datos)} : {});
  const d=await r.json();
  if (!r.ok) throw new Error(d.error ?? 'No se ha podido consultar el documento.');
  return d;
};
export const consultar = (id) => solicitar(`/facturaciones/${id}/documentos`);
export const listarAyuntamientos = () => solicitar('/ayuntamientos');
export const listarPeriodos = () => solicitar('/entregas/periodos');
export const buscar = (ayuntamientoId, periodoId) => solicitar(`/facturaciones/busqueda?${new URLSearchParams({ ayuntamiento_id: ayuntamientoId, periodo_id: periodoId })}`);
export const configuracion = () => solicitar('/configuracion-documentos');
export const guardar = (d) => solicitar('/configuracion-documentos',d);
