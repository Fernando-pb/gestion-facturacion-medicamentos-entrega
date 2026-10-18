import { facturacionIdSchema } from '../facturacion/facturacion.validation.js';
import { configuracionSchema } from './configuracion.validation.js';
import {listarConfiguraciones,guardarConfiguracion} from './configuracion.service.js';
export const listar=async(req,res,next)=>{
  if(Object.keys(req.query).length || req.body!==undefined)return res.status(400).json({error:'Consulta de configuración no válida.'});
  try{res.json(await listarConfiguraciones());}catch(e){next(e);}
};
export const guardar=async(req,res,next)=>{
  const id=req.params.id===undefined?{success:true,data:null}:facturacionIdSchema.safeParse(req.params.id);
  const d=configuracionSchema.safeParse(req.body);
  if(!id.success || !d.success || Object.keys(req.query).length)return res.status(400).json({error:'Introduce porcentajes de 0 a 100 (máximo cuatro decimales) y fechas reales, con fin igual o posterior al inicio.'});
  try{const r=await guardarConfiguracion(id.data,d.data);res.status(r.estado).json(r.datos);}catch(e){next(e);}
};
