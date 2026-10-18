import { farmaciaIdSchema } from '../farmacias/farmacia.validation.js';
import { ayuntamientoIdSchema } from './ayuntamiento.validation.js';
import {
  asignacionFarmaciaSchema, busquedaFarmaciasQuerySchema, listadoFarmaciasQuerySchema,
} from './ayuntamiento-farmacia.validation.js';
import { buscarAyuntamientoPorId } from './ayuntamiento.repository.js';
import { buscarFarmaciasExistentes, listarFarmaciasAsociadas } from './ayuntamiento-farmacia.repository.js';
import { cambiarAsignacionFarmacia } from './ayuntamiento-farmacia.service.js';

export const consultarFarmaciasAsociadas = async (req, res, next) => {
  const municipio = ayuntamientoIdSchema.safeParse(req.params.id);
  if (!municipio.success || !listadoFarmaciasQuerySchema.safeParse(req.query).success) {
    return res.status(400).json({ error: 'Identificador o parámetros de consulta no válidos.' });
  }
  try {
    if (await buscarAyuntamientoPorId(municipio.data) === null) {
      return res.status(404).json({ error: 'Ayuntamiento no encontrado.' });
    }
    return res.status(200).json(await listarFarmaciasAsociadas(municipio.data));
  } catch (error) {
    return next(error);
  }
};

export const buscarFarmacias = async (req, res, next) => {
  const municipio = ayuntamientoIdSchema.safeParse(req.params.id);
  const busqueda = busquedaFarmaciasQuerySchema.safeParse(req.query);
  if (!municipio.success || !busqueda.success) {
    return res.status(400).json({ error: 'Identificador o parámetros de búsqueda no válidos.' });
  }
  try {
    if (await buscarAyuntamientoPorId(municipio.data) === null) {
      return res.status(404).json({ error: 'Ayuntamiento no encontrado.' });
    }
    return res.status(200).json(await buscarFarmaciasExistentes(busqueda.data));
  } catch (error) {
    return next(error);
  }
};

export const asignarFarmacia = async (req, res, next) => {
  const municipio = ayuntamientoIdSchema.safeParse(req.params.id);
  const cuerpo = asignacionFarmaciaSchema.safeParse(req.body);
  if (!municipio.success || !cuerpo.success) {
    return res.status(400).json({ error: 'Identificadores o datos de asignación no válidos.' });
  }
  try {
    const resultado = await cambiarAsignacionFarmacia({
      ayuntamientoId: municipio.data, farmaciaId: cuerpo.data.farmacia_id,
      origenEsperado: cuerpo.data.ayuntamiento_origen_id,
    });
    return res.status(resultado.estadoHttp).json(resultado.datos);
  } catch (error) {
    return next(error);
  }
};

export const quitarFarmacia = async (req, res, next) => {
  const municipio = ayuntamientoIdSchema.safeParse(req.params.id);
  const farmacia = farmaciaIdSchema.safeParse(req.params.farmaciaId);
  if (!municipio.success || !farmacia.success) {
    return res.status(400).json({ error: 'Identificador no válido.' });
  }
  try {
    const resultado = await cambiarAsignacionFarmacia({
      ayuntamientoId: municipio.data, farmaciaId: farmacia.data, retirar: true,
    });
    if (resultado.estadoHttp === 204) return res.status(204).end();
    return res.status(resultado.estadoHttp).json(resultado.datos);
  } catch (error) {
    return next(error);
  }
};
