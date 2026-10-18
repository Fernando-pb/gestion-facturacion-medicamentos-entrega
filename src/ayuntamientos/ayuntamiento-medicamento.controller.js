import { ayuntamientoIdSchema } from './ayuntamiento.validation.js';
import { medicamentoIdSchema } from '../medicamentos/medicamento.validation.js';
import { buscarAyuntamientoPorId } from './ayuntamiento.repository.js';
import { listarMedicamentosAsociados } from './ayuntamiento-medicamento.repository.js';
import { asociacionMedicamentoSchema, listadoMedicamentosQuerySchema } from './ayuntamiento-medicamento.validation.js';
import { cambiarAsociacionMedicamento } from './ayuntamiento-medicamento.service.js';

export const consultarMedicamentosAdmitidos = async (req, res, next) => {
  const municipio = ayuntamientoIdSchema.safeParse(req.params.id);
  if (!municipio.success || !listadoMedicamentosQuerySchema.safeParse(req.query).success) {
    return res.status(400).json({ error: 'Identificador o parámetros de consulta no válidos.' });
  }
  try {
    if (await buscarAyuntamientoPorId(municipio.data) === null) {
      return res.status(404).json({ error: 'Ayuntamiento no encontrado.' });
    }
    return res.status(200).json(await listarMedicamentosAsociados(municipio.data));
  } catch (error) { return next(error); }
};

export const asociarMedicamento = async (req, res, next) => {
  const municipio = ayuntamientoIdSchema.safeParse(req.params.id);
  const cuerpo = asociacionMedicamentoSchema.safeParse(req.body);
  if (!municipio.success || !cuerpo.success) {
    return res.status(400).json({ error: 'Identificadores o datos de asociación no válidos.' });
  }
  try {
    const resultado = await cambiarAsociacionMedicamento({ ayuntamientoId: municipio.data, medicamentoId: cuerpo.data.medicamento_id });
    return res.status(resultado.estadoHttp).json(resultado.datos);
  } catch (error) { return next(error); }
};

export const quitarMedicamento = async (req, res, next) => {
  const municipio = ayuntamientoIdSchema.safeParse(req.params.id);
  const medicamento = medicamentoIdSchema.safeParse(req.params.medicamentoId);
  if (!municipio.success || !medicamento.success) return res.status(400).json({ error: 'Identificador no válido.' });
  try {
    const resultado = await cambiarAsociacionMedicamento({ ayuntamientoId: municipio.data, medicamentoId: medicamento.data, retirar: true });
    if (resultado.estadoHttp === 204) return res.status(204).end();
    return res.status(resultado.estadoHttp).json(resultado.datos);
  } catch (error) { return next(error); }
};
