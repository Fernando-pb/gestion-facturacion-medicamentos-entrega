// SpreadsheetML 2003: archivo XML nativo de Excel, sin fórmulas ni dependencias.
import { texto, importe, fila, libro } from './excel-xml.js';

const fechaVisible = (fecha) => {
  const [anio, mes, dia] = String(fecha).split('-');
  return `${dia}-${mes}-${anio}`;
};

export const generarExcelLiquidacion = (pago) => {
  const concepto = `Precintos - ${pago.ayuntamiento} - ${String(pago.mes).padStart(2, '0')}/${String(pago.anio).padStart(4, '0')}`;
  const filas = [fila(['SOE', 'TITULAR', 'CUENTA DESTINO', 'IMPORTE', 'TIPO TRANSFERENCIA', 'CONCEPTO', 'FECHA PAGO'].map(texto))];
  for (const d of pago.detalles) {
    const cuenta = d.pais_control_iban + d.entidad_bancaria + d.sucursal_bancaria
      + d.digito_control_bancario + d.cuenta_bancaria;
    filas.push(fila([texto(d.soe), texto(d.denominacion_farmacia), texto(cuenta),
      importe(d.importe), texto('SEPA'), texto(concepto), texto(fechaVisible(pago.fecha_pago))]));
  }
  filas.push(fila([texto('TOTAL'), texto(''), texto(''), importe(pago.importe_total)]));
  return libro([{ nombre: 'Liquidacion', filas }]);
};
