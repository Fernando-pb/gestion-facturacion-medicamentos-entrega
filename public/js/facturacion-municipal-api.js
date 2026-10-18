export class ErrorFacturacion extends Error {
  constructor(message, estado = null) { super(message); this.estado = estado; this.incierto = estado === null || estado >= 500; }
}
const solicitar = async (ruta, method = 'GET', body) => {
  let respuesta;
  try { respuesta = await fetch(ruta, { method, ...(body === undefined ? {} : {
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }) }); } catch { throw new ErrorFacturacion('No se pudo conectar con la API.'); }
  let datos;
  try { datos = await respuesta.json(); } catch { throw new ErrorFacturacion('La respuesta no pudo confirmarse.'); }
  if (!respuesta.ok) throw new ErrorFacturacion(datos?.error || 'La petición falló.', respuesta.status);
  return datos;
};
export const listarAyuntamientos = () => solicitar('/ayuntamientos');
export const listarPeriodos = () => solicitar('/entregas/periodos');
export const listarPendientes = () => solicitar('/facturaciones/pendientes');
export const calcular = (datos) => solicitar('/facturaciones/calculo', 'POST', datos);
export const consultar = (id) => solicitar(`/facturaciones/${encodeURIComponent(id)}`);
export const reabrir = (id, motivo) => solicitar(`/facturaciones/${encodeURIComponent(id)}/reapertura`, 'POST', { motivo });
export const corregirB = (id, participacionId, datos) => solicitar(`/facturaciones/${encodeURIComponent(id)}/participaciones/${encodeURIComponent(participacionId)}/b`, 'PUT', datos);
export const previsualizar = (id) => solicitar(`/facturaciones/${encodeURIComponent(id)}/previsualizacion`);
export const emitir = (id, datos) => solicitar(`/facturaciones/${encodeURIComponent(id)}/emision`, 'POST', datos);
export const cobrar = (id, facturaId, datos) => solicitar(`/facturaciones/${encodeURIComponent(id)}/facturas/${encodeURIComponent(facturaId)}/cobro`, 'POST', datos);
export const listarEmitidas = () => solicitar('/facturaciones/emitidas');
export const consultarLiquidacion = (id) => solicitar(`/facturaciones/${encodeURIComponent(id)}/liquidacion`);
export const prepararLiquidacion = (id) => solicitar(`/facturaciones/${encodeURIComponent(id)}/liquidacion/preparacion`, 'POST', {});
export const confirmarLiquidacion = (id, datos) => solicitar(`/facturaciones/${encodeURIComponent(id)}/liquidacion/confirmacion`, 'POST', datos);
