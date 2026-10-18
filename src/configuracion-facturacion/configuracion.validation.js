import { z } from 'zod';
const porcentaje=z.string().regex(/^(0|[1-9]\d{0,2})(\.\d{1,4})?$/).refine(s=>{
  const [e,d='']=s.split('.'); return BigInt(e)*10000n+BigInt(d.padEnd(4,'0'))<=1000000n;
});
const fecha=z.iso.date().refine(s=>!s.startsWith('0000-'));
export const configuracionSchema=z.object({porcentaje_comision:porcentaje,porcentaje_iva:porcentaje,
  fecha_inicio:fecha,fecha_fin:fecha.nullable()}).strict().refine(d=>d.fecha_fin===null || d.fecha_fin>=d.fecha_inicio);
