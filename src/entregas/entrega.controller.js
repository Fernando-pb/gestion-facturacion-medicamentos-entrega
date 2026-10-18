import pool from '../db.js';
import { listarPeriodosEntrega, listarEntregasRegistradas } from './entrega.repository.js';
import { entregaCreateSchema, entregaQuerySchema, entregaIdSchema, entregaDeclaradosSchema, entregaEvaluacionSchema, entregaListadoSchema } from './entrega.validation.js';
import { accederEntrega, corregirDeclarados, evaluarEntrega } from './entrega.service.js';

export const consultarEntregasRegistradas = async (req, res, next) => {
  const query = entregaListadoSchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: 'Filtro de entregas no válido.' });
  try {
    return res.status(200).json(await listarEntregasRegistradas(pool, query.data.periodo_id));
  } catch (error) { return next(error); }
};

export const evaluarCodigoEntrega = async (req, res, next) => {
  const id = entregaIdSchema.safeParse(req.params.id);
  const datos = entregaEvaluacionSchema.safeParse(req.body);
  if (!id.success || !datos.success) {
    return res.status(400).json({ error: 'Identificador o datos de evaluación no válidos.' });
  }
  try {
    const resultado = await evaluarEntrega(id.data, datos.data.codigo_barras_original);
    return res.status(resultado.estadoHttp).json(resultado.datos);
  } catch (error) {
    return next(error);
  }
};

export const actualizarDeclarados = async (req, res, next) => {
  const id = entregaIdSchema.safeParse(req.params.id);
  const datos = entregaDeclaradosSchema.safeParse(req.body);
  if (!id.success || !datos.success) {
    return res.status(400).json({ error: 'Identificador o datos declarados no válidos.' });
  }
  try {
    const resultado = await corregirDeclarados(id.data, datos.data);
    return res.status(resultado.estadoHttp).json(resultado.datos);
  } catch (error) {
    return next(error);
  }
};

export const crearORecuperarEntrega = async (req, res, next) => {
  const validacion = entregaCreateSchema.safeParse(req.body);
  if (!validacion.success) return res.status(400).json({ error: 'Datos de entrega no válidos.' });
  try {
    const resultado = await accederEntrega(validacion.data, true);
    return res.status(resultado.estadoHttp).json(resultado.datos);
  } catch (error) {
    return next(error);
  }
};

export const recuperarEntrega = async (req, res, next) => {
  const validacion = entregaQuerySchema.safeParse(req.query);
  if (!validacion.success) return res.status(400).json({ error: 'Parámetros de entrega no válidos.' });
  try {
    const resultado = await accederEntrega(validacion.data);
    return res.status(resultado.estadoHttp).json(resultado.datos);
  } catch (error) {
    return next(error);
  }
};
export const consultarPeriodosEntrega = async (req, res, next) => {
  if (Object.keys(req.query).length > 0) return res.status(400).json({ error: 'Consulta de periodos no válida.' });
  try {
    return res.status(200).json(await listarPeriodosEntrega(pool));
  } catch (error) {
    return next(error);
  }
};
