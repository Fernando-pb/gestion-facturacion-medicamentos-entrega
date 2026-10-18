import { entregaIdSchema, entregaLecturaSchema, claveOperacionSchema } from './entrega.validation.js';
import { guardarLectura, consultarOperacionLectura, consultarLecturasEntrega, eliminarLecturaEntrega } from './lectura.service.js';

export const eliminarLectura = (tipo) => async (req, res, next) => {
  const id = entregaIdSchema.safeParse(req.params.id);
  const lecturaId = entregaIdSchema.safeParse(req.params.lecturaId);
  if (!id.success || !lecturaId.success || Object.keys(req.query).length
    || (req.body !== undefined && (req.body === null || Array.isArray(req.body)
      || typeof req.body !== 'object' || Object.keys(req.body).length))) {
    return res.status(400).json({ error: 'Identificador o parámetros de eliminación no válidos.' });
  }
  try {
    const respuesta = await eliminarLecturaEntrega(id.data, lecturaId.data, tipo);
    return respuesta.estadoHttp === 204 ? res.status(204).end() : res.status(respuesta.estadoHttp).json(respuesta.datos);
  } catch (error) { return next(error); }
};

// El recurso es una constante de las rutas, nunca un identificador SQL del usuario.
export const consultarLecturas = (recurso) => async (req, res, next) => {
  const id = entregaIdSchema.safeParse(req.params.id);
  if (!id.success || Object.keys(req.query).length) {
    return res.status(400).json({ error: 'Identificador o parámetros de consulta no válidos.' });
  }
  try {
    const respuesta = await consultarLecturasEntrega(id.data, recurso);
    return res.status(respuesta.estadoHttp).json(respuesta.datos);
  } catch (error) { return next(error); }
};

export const registrarLectura = async (req, res, next) => {
  const id = entregaIdSchema.safeParse(req.params.id);
  const datos = entregaLecturaSchema.safeParse(req.body);
  if (!id.success || !datos.success) return res.status(400).json({ error: 'Identificador o datos de lectura no válidos.' });
  try {
    const respuesta = await guardarLectura(id.data, datos.data);
    return res.status(respuesta.estadoHttp).json(respuesta.datos);
  } catch (error) { return next(error); }
};

export const recuperarOperacionLectura = async (req, res, next) => {
  const id = entregaIdSchema.safeParse(req.params.id);
  const clave = claveOperacionSchema.safeParse(req.params.clave);
  if (!id.success || !clave.success || Object.keys(req.query).length) {
    return res.status(400).json({ error: 'Identificador o clave de operación no válidos.' });
  }
  try {
    const respuesta = await consultarOperacionLectura(id.data, clave.data);
    return res.status(respuesta.estadoHttp).json(respuesta.datos);
  } catch (error) { return next(error); }
};
