import { z } from 'zod';

const datosAdmisionSchema = z.strictObject({
  medicamento: z.strictObject({
    estado: z.enum(['ACTIVO', 'INACTIVO']),
    situacion_comercial: z.enum(['ALTA', 'BAJA']),
    tipo_facturacion: z.literal('TD'),
  }).nullable(),
  tipo_lista_medicamentos: z.enum(['GENERAL', 'ESPECIFICA']),
  pertenece_lista_especifica: z.boolean(),
}).refine((datos) => datos.medicamento !== null || !datos.pertenece_lista_especifica);

// Evalúa únicamente los datos proporcionados; no consulta ni persiste lecturas.
export const evaluarAdmisionMedicamento = (entrada) => {
  const validacion = datosAdmisionSchema.safeParse(entrada);
  if (!validacion.success) throw new TypeError('Datos de admisión no válidos.');

  const { medicamento, tipo_lista_medicamentos, pertenece_lista_especifica } = validacion.data;
  if (medicamento === null) {
    return { resultado: 'INCIDENCIA', motivo: 'MEDICAMENTO_DESCONOCIDO' };
  }
  if (medicamento.estado === 'INACTIVO') {
    return { resultado: 'INCIDENCIA', motivo: 'MEDICAMENTO_INACTIVO' };
  }
  if (tipo_lista_medicamentos === 'ESPECIFICA' && !pertenece_lista_especifica) {
    return { resultado: 'INCIDENCIA', motivo: 'MEDICAMENTO_NO_AUTORIZADO' };
  }
  if (medicamento.situacion_comercial === 'BAJA') {
    return { resultado: 'PENDIENTE_DECISION_BAJA' };
  }
  return { resultado: 'ADMITIDO' };
};
