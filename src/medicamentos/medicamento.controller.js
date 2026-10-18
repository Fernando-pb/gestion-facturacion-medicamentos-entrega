import {
  actualizarMedicamento as actualizarMedicamentoEnRepositorio,
  buscarMedicamentoPorId,
  buscarMedicamentos,
  crearMedicamento as crearMedicamentoEnRepositorio,
  listarMedicamentos as listarMedicamentosEnRepositorio,
} from './medicamento.repository.js';
import {
  medicamentoCreateSchema,
  medicamentoBusquedaSchema,
  medicamentoIdSchema,
  medicamentoUpdateSchema,
} from './medicamento.validation.js';

const esCodigoDuplicado = (error) =>
  error?.code === '23505' && error?.constraint === 'uq_medicamento_codigo_nacional';

export const crearMedicamento = async (req, res, next) => {
  const validacion = medicamentoCreateSchema.safeParse(req.body);
  if (!validacion.success) return res.status(400).json({ error: 'Datos de medicamento no válidos.' });

  try {
    return res.status(201).json(await crearMedicamentoEnRepositorio(validacion.data));
  } catch (error) {
    if (esCodigoDuplicado(error)) return res.status(409).json({ error: 'El código nacional ya está registrado.' });
    return next(error);
  }
};

export const listarMedicamentos = async (req, res, next) => {
  // Sin parámetros conserva el payload y orden del catálogo existente.
  const usaBusqueda = Object.keys(req.query).length > 0;
  const busqueda = usaBusqueda ? medicamentoBusquedaSchema.safeParse(req.query) : null;
  if (usaBusqueda && !busqueda.success) {
    return res.status(400).json({ error: 'Parámetros de búsqueda no válidos.' });
  }
  try {
    if (usaBusqueda) return res.status(200).json(await buscarMedicamentos(busqueda.data));
    return res.status(200).json(await listarMedicamentosEnRepositorio());
  } catch (error) {
    return next(error);
  }
};

export const obtenerMedicamento = async (req, res, next) => {
  const validacionId = medicamentoIdSchema.safeParse(req.params.id);
  if (!validacionId.success) return res.status(400).json({ error: 'Identificador no válido.' });

  try {
    const medicamento = await buscarMedicamentoPorId(validacionId.data);
    if (medicamento === null) return res.status(404).json({ error: 'Medicamento no encontrado.' });
    return res.status(200).json(medicamento);
  } catch (error) {
    return next(error);
  }
};

export const actualizarMedicamento = async (req, res, next) => {
  const validacionId = medicamentoIdSchema.safeParse(req.params.id);
  if (!validacionId.success) return res.status(400).json({ error: 'Identificador no válido.' });

  const validacion = medicamentoUpdateSchema.safeParse(req.body);
  if (!validacion.success) return res.status(400).json({ error: 'Datos de medicamento no válidos.' });

  try {
    const medicamento = await actualizarMedicamentoEnRepositorio(validacionId.data, validacion.data);
    if (medicamento === null) return res.status(404).json({ error: 'Medicamento no encontrado.' });
    return res.status(200).json(medicamento);
  } catch (error) {
    if (esCodigoDuplicado(error)) return res.status(409).json({ error: 'El código nacional ya está registrado.' });
    return next(error);
  }
};
