import { z } from 'zod';

const POSTGRES_INTEGER_MAX = 2147483647;

const textoObligatorio = z.string().trim().min(1);
const textoOpcional = z.string().trim().transform((value) => value === '' ? null : value).nullable();
const enumeracionExacta = (valores) => z.string().trim().pipe(z.enum(valores));

const precioValido = (value) => {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return false;

  const [unidades, decimales = ''] = value.split('.');
  const unidadesNormalizadas = unidades.replace(/^0+(?=\d)/, '');
  if (unidadesNormalizadas.length > 10) return false;
  if (unidadesNormalizadas.length === 10 && unidadesNormalizadas > '9999999999') return false;
  return unidadesNormalizadas !== '9999999999' || Number(decimales.padEnd(2, '0')) <= 99;
};

const precio = z.string()
  .trim()
  .refine(precioValido, 'Precio no válido.');

const camposComunes = {
  codigo_nacional: textoObligatorio,
  descripcion: textoObligatorio,
  precio,
  estado: enumeracionExacta(['ACTIVO', 'INACTIVO']),
  situacion_comercial: enumeracionExacta(['ALTA', 'BAJA']),
  tipo_facturacion: enumeracionExacta(['TD']),
};

const camposOpcionales = {
  grupo_terapeutico: textoOpcional,
  codigo_laboratorio: textoOpcional,
  gtatc: textoOpcional,
  nombre_grupo: textoOpcional,
  anexo: textoOpcional,
};

export const medicamentoCreateSchema = z.strictObject({
  ...camposComunes,
  grupo_terapeutico: textoOpcional.optional(),
  codigo_laboratorio: textoOpcional.optional(),
  gtatc: textoOpcional.optional(),
  nombre_grupo: textoOpcional.optional(),
  anexo: textoOpcional.optional(),
});

export const medicamentoUpdateSchema = z.strictObject({
  ...camposComunes,
  ...camposOpcionales,
});

export const medicamentoIdSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().positive().max(POSTGRES_INTEGER_MAX));

export const medicamentoBusquedaSchema = z.strictObject({
  campo: z.enum(['codigo_nacional', 'descripcion']),
  modo: z.enum(['exacto', 'prefijo', 'contiene']),
  q: z.string().trim().min(1).max(200).refine((valor) => !valor.includes('\0')),
});
