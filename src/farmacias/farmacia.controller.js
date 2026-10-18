import { busquedaFarmaciasQuerySchema } from '../ayuntamientos/ayuntamiento-farmacia.validation.js';
import { buscarFarmaciasExistentes } from '../ayuntamientos/ayuntamiento-farmacia.repository.js';
import {
  actualizarFarmacia as actualizarFarmaciaEnRepositorio,
  buscarFarmaciaPorId,
  crearFarmacia as crearFarmaciaEnRepositorio,
  listarFarmacias as listarFarmaciasEnRepositorio,
} from './farmacia.repository.js';
import {
  farmaciaCreateSchema,
  farmaciaIdSchema,
  farmaciaUpdateSchema,
} from './farmacia.validation.js';

const esConflictoDeSoe = (error) =>
  error?.code === '23505' && error?.constraint === 'uq_farmacia_soe';
const esAyuntamientoInexistente = (error) =>
  error?.code === '23503' && error?.constraint === 'fk_farmacia_ayuntamiento';

export const crearFarmacia = async (req, res, next) => {
  const validacion = farmaciaCreateSchema.safeParse(req.body);
  if (!validacion.success) return res.status(400).json({ error: 'Datos de farmacia no válidos.' });

  try {
    return res.status(201).json(await crearFarmaciaEnRepositorio(validacion.data));
  } catch (error) {
    if (esConflictoDeSoe(error)) return res.status(409).json({ error: 'El SOE ya está registrado.' });
    if (esAyuntamientoInexistente(error)) return res.status(400).json({ error: 'El ayuntamiento indicado no existe.' });
    return next(error);
  }
};

export const listarFarmacias = async (req, res, next) => {
  try {
    return res.status(200).json(await listarFarmaciasEnRepositorio());
  } catch (error) {
    return next(error);
  }
};

export const obtenerFarmacia = async (req, res, next) => {
  const validacionId = farmaciaIdSchema.safeParse(req.params.id);
  if (!validacionId.success) return res.status(400).json({ error: 'Identificador no válido.' });

  try {
    const farmacia = await buscarFarmaciaPorId(validacionId.data);
    if (farmacia === null) return res.status(404).json({ error: 'Farmacia no encontrada.' });
    return res.status(200).json(farmacia);
  } catch (error) {
    return next(error);
  }
};

export const actualizarFarmacia = async (req, res, next) => {
  const validacionId = farmaciaIdSchema.safeParse(req.params.id);
  if (!validacionId.success) return res.status(400).json({ error: 'Identificador no válido.' });
  const validacion = farmaciaUpdateSchema.safeParse(req.body);
  if (!validacion.success) return res.status(400).json({ error: 'Datos de farmacia no válidos.' });

  try {
    const farmacia = await actualizarFarmaciaEnRepositorio(validacionId.data, validacion.data);
    if (farmacia === null) return res.status(404).json({ error: 'Farmacia no encontrada.' });
    return res.status(200).json(farmacia);
  } catch (error) {
    if (esConflictoDeSoe(error)) return res.status(409).json({ error: 'El SOE ya está registrado.' });
    return next(error);
  }
};
export const buscarFarmacias = async (req, res, next) => {
  const validacion = busquedaFarmaciasQuerySchema.safeParse(req.query);
  if (!validacion.success) return res.status(400).json({ error: 'Parámetros de búsqueda no válidos.' });
  try {
    const filas = await buscarFarmaciasExistentes(validacion.data);
    return res.status(200).json(filas.map(({ farmacia_id, soe, denominacion, localidad, ayuntamiento_id, ayuntamiento_denominacion }) =>
      ({ id: farmacia_id, soe, denominacion, localidad, ayuntamiento_id, ayuntamiento_denominacion })));
  }
  catch (error) { return next(error); }
};
