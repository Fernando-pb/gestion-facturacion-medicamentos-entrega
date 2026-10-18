import { z } from 'zod';

const POSTGRES_INTEGER_MAX = 2147483647;
const cadenaObligatoria = z.string().trim().min(1);
const cadenaOpcional = z.string().nullable().optional();

export const farmaciaCreateSchema = z.strictObject({
  soe: cadenaObligatoria,
  cif_nif: cadenaObligatoria,
  denominacion: cadenaObligatoria,
  direccion: cadenaObligatoria,
  codigo_postal: cadenaObligatoria,
  localidad: cadenaObligatoria,
  provincia: cadenaObligatoria,
  telefono: cadenaOpcional,
  ayuntamiento_id: z.number().int().positive().max(POSTGRES_INTEGER_MAX),
  pais_control_iban: cadenaOpcional,
  entidad_bancaria: cadenaOpcional,
  sucursal_bancaria: cadenaOpcional,
  digito_control_bancario: cadenaOpcional,
  cuenta_bancaria: cadenaOpcional,
});

export const farmaciaUpdateSchema = z.strictObject({
  soe: cadenaObligatoria,
  cif_nif: cadenaObligatoria,
  denominacion: cadenaObligatoria,
  direccion: cadenaObligatoria,
  codigo_postal: cadenaObligatoria,
  localidad: cadenaObligatoria,
  provincia: cadenaObligatoria,
  telefono: cadenaOpcional,
  pais_control_iban: cadenaOpcional,
  entidad_bancaria: cadenaOpcional,
  sucursal_bancaria: cadenaOpcional,
  digito_control_bancario: cadenaOpcional,
  cuenta_bancaria: cadenaOpcional,
});

export const farmaciaIdSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().positive().max(POSTGRES_INTEGER_MAX));
