import { entregaIdSchema, correccionPrecioSchema } from './entrega.validation.js';
import { consultarContextoPrecios, corregirPrecio } from './precio.service.js';

export const consultarPrecios = async (req, res, next) => {
  const id = entregaIdSchema.safeParse(req.params.id);
  if (!id.success || Object.keys(req.query).length || (req.body !== undefined && (req.body === null
    || Array.isArray(req.body) || typeof req.body !== 'object' || Object.keys(req.body).length))) {
    return res.status(400).json({ error: 'Identificador o parámetros de consulta no válidos.' });
  }
  try {
    const r = await consultarContextoPrecios(id.data);
    return res.status(r.estadoHttp).json(r.datos);
  } catch (error) { return next(error); }
};
export const actualizarPrecio = async (req, res, next) => {
  const id = entregaIdSchema.safeParse(req.params.id), precinto = entregaIdSchema.safeParse(req.params.lecturaId);
  const datos = correccionPrecioSchema.safeParse(req.body);
  if (!id.success || !precinto.success || !datos.success || Object.keys(req.query).length) {
    return res.status(400).json({ error: 'Identificador de entrega/precinto o datos de precio no válidos.' });
  }
  try {
    const r = await corregirPrecio(id.data, precinto.data, datos.data);
    return res.status(r.estadoHttp).json(r.datos);
  } catch (error) { return next(error); }
};
