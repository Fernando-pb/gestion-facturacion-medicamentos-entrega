import {
  actualizarAyuntamiento as actualizarAyuntamientoEnRepositorio,
  buscarAyuntamientoPorId,
  crearAyuntamiento as crearAyuntamientoEnRepositorio,
  listarAyuntamientos as listarAyuntamientosEnRepositorio,
} from './ayuntamiento.repository.js';
import {
  ayuntamientoBodySchema,
  ayuntamientoIdSchema,
} from './ayuntamiento.validation.js';

const esConflictoDeCif = (error) =>
  error?.code === '23505' && error?.constraint === 'uq_ayuntamiento_cif';

export const crearAyuntamiento = async (req, res, next) => {
  const validacion = ayuntamientoBodySchema.safeParse(req.body);

  if (!validacion.success) {
    return res.status(400).json({ error: 'Datos de ayuntamiento no válidos.' });
  }

  try {
    const ayuntamiento = await crearAyuntamientoEnRepositorio(validacion.data);
    return res.status(201).json(ayuntamiento);
  } catch (error) {
    if (esConflictoDeCif(error)) {
      return res.status(409).json({ error: 'El CIF ya está registrado.' });
    }

    return next(error);
  }
};

export const listarAyuntamientos = async (req, res, next) => {
  try {
    const ayuntamientos = await listarAyuntamientosEnRepositorio();
    return res.status(200).json(ayuntamientos);
  } catch (error) {
    return next(error);
  }
};

export const obtenerAyuntamiento = async (req, res, next) => {
  const validacionId = ayuntamientoIdSchema.safeParse(req.params.id);

  if (!validacionId.success) {
    return res.status(400).json({ error: 'Identificador no válido.' });
  }

  try {
    const ayuntamiento = await buscarAyuntamientoPorId(validacionId.data);

    if (ayuntamiento === null) {
      return res.status(404).json({ error: 'Ayuntamiento no encontrado.' });
    }

    return res.status(200).json(ayuntamiento);
  } catch (error) {
    return next(error);
  }
};

export const actualizarAyuntamiento = async (req, res, next) => {
  const validacionId = ayuntamientoIdSchema.safeParse(req.params.id);

  if (!validacionId.success) {
    return res.status(400).json({ error: 'Identificador no válido.' });
  }

  const validacionBody = ayuntamientoBodySchema.safeParse(req.body);

  if (!validacionBody.success) {
    return res.status(400).json({ error: 'Datos de ayuntamiento no válidos.' });
  }

  try {
    const ayuntamiento = await actualizarAyuntamientoEnRepositorio(
      validacionId.data,
      validacionBody.data,
    );

    if (ayuntamiento === null) {
      return res.status(404).json({ error: 'Ayuntamiento no encontrado.' });
    }

    return res.status(200).json(ayuntamiento);
  } catch (error) {
    if (esConflictoDeCif(error)) {
      return res.status(409).json({ error: 'El CIF ya está registrado.' });
    }

    return next(error);
  }
};
