import { describe, expect, it } from 'vitest';
import { generarExcelLiquidacion } from '../src/facturacion/liquidacion.excel.js';

describe('fecha visible en Excel XML de liquidación', () => {
  it.each([
    ['2026-10-19', '19-10-2026'],
    ['2026-01-05', '05-01-2026'],
  ])('presenta %s como %s sin alterar el día', (fecha_pago, fechaVisible) => {
    const xml = generarExcelLiquidacion({
      fecha_pago,
      ayuntamiento: 'Municipio ficticio',
      mes: 10,
      anio: 2026,
      importe_total: '25.00',
      detalles: [{
        soe: 'SOE-TEST',
        denominacion_farmacia: 'Farmacia TEST',
        pais_control_iban: 'ES',
        entidad_bancaria: '0000',
        sucursal_bancaria: '0000',
        digito_control_bancario: '00',
        cuenta_bancaria: '0000010101',
        importe: '25.00',
      }],
    });

    expect(xml).toContain(`<Data ss:Type="String">${fechaVisible}</Data>`);
    expect(xml).not.toContain(`<Data ss:Type="String">${fecha_pago}</Data>`);
  });
});
