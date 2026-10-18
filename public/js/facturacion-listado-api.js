export const listarEmitidas = async () => {
  const r = await fetch('/facturaciones/emitidas', { method: 'GET' });
  const datos = await r.json();
  if (!r.ok) throw new Error(datos.error ?? 'No se ha podido consultar el listado.');
  return datos;
};
export { consultar, reabrir } from './facturacion-municipal-api.js';
