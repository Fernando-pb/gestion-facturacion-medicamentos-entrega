import pool from '../db.js';
import {listar,consultar,solapada,protegeHistorico,guardar} from './configuracion.repository.js';
export const listarConfiguraciones=()=>listar(pool);
export const guardarConfiguracion=async(id,d)=>{
  const c=await pool.connect();
  try {
    await c.query('BEGIN');
    // Serializa modificaciones de vigencias y espera al SHARE de emisión.
    await c.query('LOCK TABLE configuracion_facturacion IN SHARE ROW EXCLUSIVE MODE');
    const actual=id===null ? null : await consultar(c,id);
    let error=null;
    if(id!==null && !actual) error={estado:404,datos:{error:'Configuración no encontrada.'}};
    else if(actual?.utilizada && !await protegeHistorico(c,id,d)) error={estado:409,datos:{error:'Esta configuración ya se utilizó: conserva sus porcentajes e inicio y no excluyas fechas ya facturadas. Para nuevas tasas crea otra vigencia.'}};
    else if(await solapada(c,id,d)) error={estado:409,datos:{error:'La vigencia se solapa con otra configuración. Las fechas de fin son inclusivas; cierra la anterior antes del inicio de la nueva.'}};
    if(error){await c.query('ROLLBACK');return error;}
    const guardada=await guardar(c,id,d);const datos=await consultar(c,guardada);await c.query('COMMIT');
    return {estado:id===null?201:200,datos};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
};
