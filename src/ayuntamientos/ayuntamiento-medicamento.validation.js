import { z } from 'zod';

export const asociacionMedicamentoSchema = z.strictObject({
  medicamento_id: z.number().int().positive().max(2147483647),
});
export const listadoMedicamentosQuerySchema = z.strictObject({});
