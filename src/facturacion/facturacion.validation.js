import { z } from 'zod';

export const cobroSchema = z.object({
  fecha_cobro: z.iso.date().refine((fecha) => !fecha.startsWith('0000-')),
  importe_cobrado: z.string().regex(/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/),
  justificante: z.string().trim().min(1).nullable().optional(),
}).strict();

const id = z.number().int().positive().max(2147483647);

const textoPago = z.string().trim().min(1).refine((s) => s.isWellFormed()
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(s));
const cuentaPago = z.object({
  participacion_facturacion_id: id,
  soe: textoPago,
  denominacion_farmacia: textoPago,
  cif_nif: textoPago,
  importe: cobroSchema.shape.importe_cobrado,
  pais_control_iban: z.string().trim().toUpperCase().regex(/^ES\d{2}$/),
  entidad_bancaria: z.string().trim().regex(/^\d{4}$/),
  sucursal_bancaria: z.string().trim().regex(/^\d{4}$/),
  digito_control_bancario: z.string().trim().regex(/^\d{2}$/),
  cuenta_bancaria: z.string().trim().regex(/^\d{10}$/),
}).strict().refine((d) => {
  const cuenta = d.entidad_bancaria + d.sucursal_bancaria + d.digito_control_bancario + d.cuenta_bancaria;
  if (!/^ES\d{22}$/.test(d.pais_control_iban + cuenta)) return false;
  const control = (digitos) => {
    const pesos = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6];
    const valor = 11 - [...digitos].reduce((suma, digito, i) => suma + Number(digito) * pesos[i], 0) % 11;
    return String(valor === 11 ? 0 : valor === 10 ? 1 : valor);
  };
  return d.digito_control_bancario === control('00' + cuenta.slice(0, 8)) + control(d.cuenta_bancaria)
    && BigInt(cuenta + '1428' + d.pais_control_iban.slice(2)) % 97n === 1n;
}, 'IBAN no válido.');

export const preparacionLiquidacionSchema = z.object({}).strict();
export const confirmacionLiquidacionSchema = z.object({
  fecha_pago: cobroSchema.shape.fecha_cobro,
  detalles: z.array(cuentaPago).min(1),
}).strict();
export const calculoSchema = z.object({ ayuntamiento_id: id, periodo_id: id }).strict();
export const participacionBSchema = z.object({ soe_b: z.string().trim().min(1).max(100),
  denominacion_b: z.string().trim().min(1).max(250), cif_b: z.string().trim().min(1).max(50) }).strict();
export const facturacionIdSchema = z.string().regex(/^\d+$/).transform(Number).pipe(id);
export const busquedaFacturacionSchema = z.object({
  ayuntamiento_id: facturacionIdSchema,
  periodo_id: facturacionIdSchema,
}).strict();
export const informeAnualSchema = z.object({
  anio: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(9999)),
  ayuntamiento_id: facturacionIdSchema.optional(),
  detalle_mensual: z.enum(['true', 'false']).default('false').transform((valor) => valor === 'true'),
}).strict();
export const participacionIdSchema = facturacionIdSchema;
export const reaperturaSchema = z.object({ motivo: z.string().trim().min(1).max(500) }).strict();

const numeroOficial = z.string().trim().min(1).max(200);
export const emisionSchema = z.object({ numero_factura_precintos: numeroOficial.optional(),
  numero_factura_comision: numeroOficial.optional() }).strict().refine((datos) =>
  (datos.numero_factura_precintos === undefined) === (datos.numero_factura_comision === undefined),
'Deben informarse los dos números oficiales conjuntamente.');
