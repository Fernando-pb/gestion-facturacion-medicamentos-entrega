import { z } from 'zod';

const POSTGRES_INTEGER_MAX = 2147483647;
const cadenaObligatoria = z.string().trim().min(1);
const cadenaOpcional = z.string().nullable().optional();

export const ayuntamientoBodySchema = z.strictObject({
  cif: cadenaObligatoria.toUpperCase(),
  denominacion: cadenaObligatoria,
  direccion: cadenaObligatoria,
  codigo_postal: cadenaObligatoria,
  localidad: cadenaObligatoria,
  provincia: cadenaObligatoria,
  telefono: cadenaOpcional,
  movil: cadenaOpcional,
  persona_responsable: cadenaOpcional,
  persona_contacto: cadenaOpcional,
  alcalde: cadenaOpcional,
  estado: z.enum(['ACTIVO', 'INACTIVO']),
  tipo_lista_medicamentos: z.enum(['GENERAL', 'ESPECIFICA']),
});

export const ayuntamientoIdSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().positive().max(POSTGRES_INTEGER_MAX));
