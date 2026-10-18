import { z } from 'zod';

const idInterno = z.number().int().positive().max(2147483647);
const idConsulta = z.string().regex(/^\d+$/).transform(Number).pipe(idInterno);

export const entregaIdSchema = idConsulta;
export const correccionPrecioSchema = z.strictObject({
  precio_aplicado: z.string().trim().refine((valor) => /^\d+(?:\.\d{1,2})?$/.test(valor)
    && valor.split('.')[0].replace(/^0+(?=\d)/, '').length <= 10, 'Precio no válido.'),
});
export const entregaListadoSchema = z.strictObject({ periodo_id: idConsulta.optional() });
export const entregaEvaluacionSchema = z.strictObject({ codigo_barras_original: z.string() });
export const claveOperacionSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  .transform((clave) => clave.toLowerCase());
const motivoConfirmable = z.enum(['MEDICAMENTO_DESCONOCIDO', 'MEDICAMENTO_INACTIVO', 'MEDICAMENTO_NO_AUTORIZADO']);
export const entregaLecturaSchema = z.strictObject({
  codigo_barras_original: z.string(),
  clave_operacion: claveOperacionSchema,
  decision: z.discriminatedUnion('tipo', [
    z.strictObject({ tipo: z.literal('CONFIRMAR_INCIDENCIA'), motivo: motivoConfirmable }),
    z.strictObject({ tipo: z.literal('ACEPTAR_BAJA') }),
    z.strictObject({ tipo: z.literal('APARTAR_BAJA') }),
  ]).nullable().default(null),
  nuevo_paquete: z.boolean().default(false),
});
export const entregaDeclaradosSchema = z.strictObject({
  precintos_informados: z.number().int().min(0).max(2147483647).nullable(),
  importe_informado: z.string().trim().refine((valor) => {
    if (!/^\d+(?:\.\d{1,2})?$/.test(valor)) return false;
    const unidades = valor.split('.')[0].replace(/^0+(?=\d)/, '');
    return unidades.length <= 10;
  }, 'Importe no válido.').nullable(),
});

export const entregaCreateSchema = z.union([z.strictObject({
  farmacia_id: idInterno,
  periodo_id: idInterno,
}), z.strictObject({ farmacia_id: idInterno, mes: z.number().int().min(1).max(12), anio: idInterno })]);

export const entregaQuerySchema = z.union([z.strictObject({
  farmacia_id: idConsulta,
  periodo_id: idConsulta,
}), z.strictObject({ farmacia_id: idConsulta,
  mes: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(12)), anio: idConsulta })]);
