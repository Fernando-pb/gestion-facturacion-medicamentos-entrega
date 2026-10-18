import { facturacionIdSchema } from '../facturacion/facturacion.validation.js';
import { configuracionSchema } from './documentos.validation.js';
import { actualizarConfiguracion, consultarConfiguracion, consultarDocumentos } from './documentos.service.js';

export const documentos = async (req,res,next) => {
  const id=facturacionIdSchema.safeParse(req.params.id);
  if (!id.success || Object.keys(req.query).length || req.body!==undefined) return res.status(400).json({error:'Consulta documental no válida.'});
  try { const r=await consultarDocumentos(id.data); res.status(r.estado).json(r.datos); } catch(e) { next(e); }
};
export const configuracion = async (req,res,next) => {
  if (Object.keys(req.query).length || req.body!==undefined) return res.status(400).json({error:'Consulta no válida.'});
  try { res.json(await consultarConfiguracion()); } catch(e) { next(e); }
};
export const guardar = async (req,res,next) => {
  const d=configuracionSchema.safeParse(req.body);
  if (!d.success || Object.keys(req.query).length) return res.status(400).json({error:'Configuración no válida. Logo PNG/JPEG, máximo 1 MiB y 4096 × 4096 píxeles.'});
  try { res.json(await actualizarConfiguracion(d.data)); } catch(e) { next(e); }
};
