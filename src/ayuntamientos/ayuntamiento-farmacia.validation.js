import { z } from 'zod';

const idInterno = z.number().int().positive().max(2147483647);

// El origen es una precondición de la petición, no un campo nuevo del modelo.
export const asignacionFarmaciaSchema = z.strictObject({
  farmacia_id: idInterno,
  ayuntamiento_origen_id: idInterno.nullable(),
});

export const listadoFarmaciasQuerySchema = z.strictObject({});

export const busquedaFarmaciasQuerySchema = z.strictObject({
  campo: z.enum(['soe', 'denominacion']),
  modo: z.enum(['exacto', 'prefijo', 'contiene']),
  q: z.string().trim().min(1).max(200).refine((valor) => !valor.includes('\0')),
});
