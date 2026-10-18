import { texto, importe, fila, libro } from './excel-xml.js';

const identidad = (farmacia) => ['soe_b', 'denominacion_b', 'cif_b']
  .map((campo) => texto(farmacia.identidades_b.map((b) => b[campo]).join('\n')));
const totales = (grupo) => [...grupo.trimestres.map((t) => importe(t.importe_total)), importe(grupo.total_anual)];

export const generarExcelInformeAnual = (informe) => {
  const resumen = [fila(['AYUNTAMIENTO', 'SOE', 'DENOMINACIÓN', 'CIF',
    'TRIMESTRE 1', 'TRIMESTRE 2', 'TRIMESTRE 3', 'TRIMESTRE 4', 'TOTAL ANUAL'].map(texto))];
  const meses = [fila(['AYUNTAMIENTO', 'SOE', 'DENOMINACIÓN', 'CIF', 'TRIMESTRE', 'MES', 'IMPORTE'].map(texto))];
  for (const municipio of informe.ayuntamientos) {
    for (const farmacia of municipio.farmacias) {
      resumen.push(fila([texto(municipio.denominacion), ...identidad(farmacia), ...totales(farmacia)]));
      if (informe.detalle_mensual) for (const t of farmacia.trimestres) for (const m of t.meses) {
        meses.push(fila([texto(municipio.denominacion), ...identidad(farmacia),
          texto(t.trimestre), texto(m.mes), importe(m.importe_total)]));
      }
    }
    resumen.push(fila([texto(`SUBTOTAL ${municipio.denominacion}`), texto(''), texto(''), texto(''), ...totales(municipio)]));
  }
  resumen.push(fila([texto(`TOTAL ${informe.anio}`), texto(''), texto(''), texto(''), ...totales(informe)]));
  resumen.push(fila([texto(`Informe operativo de PRECINTOS, año ${informe.anio}. Trimestres del periodo facturado. Sin alcance fiscal.`)]));
  if (informe.advertencia) {
    resumen.push(fila([texto(informe.advertencia)]));
    for (const p of informe.facturaciones_pendientes) resumen.push(fila([texto(
      `Corrección pendiente: facturación ${p.facturacion_id}, Ayuntamiento ${p.ayuntamiento_id}, ${p.mes}/${informe.anio}.`)]));
  }
  return libro([{ nombre: 'Resumen anual', filas: resumen },
    ...(informe.detalle_mensual ? [{ nombre: 'Detalle mensual', filas: meses }] : [])]);
};
