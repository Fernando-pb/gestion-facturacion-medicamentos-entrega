import pool from '../db.js';
import { consultarFacturas, listarParticipaciones } from '../facturacion/facturacion.repository.js';
import { cabeceraDocumental, configuracionActual, guardarConfiguracion } from './documentos.repository.js';
import { logoValido } from './documentos.validation.js';

const transaccion = async (lectura, operacion) => {
  const client = await pool.connect();
  try {
    await client.query(lectura ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
    const r = await operacion(client);
    await client.query('COMMIT');
    return r;
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
};
const centimos = (s) => { const [e,d=''] = s.split('.'); return BigInt(e)*100n+BigInt(d.padEnd(2,'0')); };
export const consultarConfiguracion = () => transaccion(true, async (c) => {
  const d=await configuracionActual(c);
  if (!logoValido(d.logo_personalizado)) d.logo_personalizado=null;
  return d;
});
export const actualizarConfiguracion = (datos) => transaccion(false, async (c) => {
  await guardarConfiguracion(c, datos); return configuracionActual(c);
});
export const consultarDocumentos = (id) => transaccion(true, async (c) => {
  const cabecera = await cabeceraDocumental(c,id);
  if (!cabecera) return { estado:404, datos:{ error:'Facturación no encontrada.' } };
  if (cabecera.estado !== 'EMITIDA') return { estado:409, datos:{ error:'Los documentos requieren una facturación emitida. Si está reabierta, hay una corrección pendiente.' } };
  const facturas = await consultarFacturas(c,id), participaciones = await listarParticipaciones(c,id);
  const p = facturas.find((f) => f.tipo==='PRECINTOS'), g = facturas.find((f) => f.tipo==='COMISION');
  if (!p || !g || facturas.length!==2 || !participaciones.length
    || participaciones.reduce((n,r)=>n+centimos(r.importe_precintos),0n)!==centimos(p.importe_total)
    || participaciones.reduce((n,r)=>n+r.cantidad_precintos,0)!==p.numero_precintos
    || participaciones.some((r)=>r.requiere_recalculo)
    || centimos(g.base_calculo)!==centimos(p.importe_total)
    || centimos(g.importe_comision)+centimos(g.importe_iva)!==centimos(g.importe_total)) {
    return { estado:409, datos:{ error:'Los datos históricos no cuadran con las facturas emitidas.' } };
  }
  const configuracion = await configuracionActual(c);
  // Una antigua referencia de archivo nunca se expone ni se utiliza como URL.
  if (!logoValido(configuracion.logo_personalizado)) configuracion.logo_personalizado=null;
  return { estado:200, datos:{ cabecera, facturas, participaciones, configuracion,
    advertencias:[...(!cabecera.nombre_presidente_historico ? ['No consta el presidente histórico.'] : []),
      ...(!configuracion.datos_emisor ? ['Configura los datos del emisor antes de imprimir.'] : [])] } };
});
