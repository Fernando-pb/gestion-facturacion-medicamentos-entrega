import { describe, expect, it } from 'vitest';
import { cuentaBancariaTest } from './fixtures/datos-test.js';
import { confirmacionLiquidacionSchema } from '../src/facturacion/facturacion.validation.js';

const cuerpo = (cuenta) => ({ fecha_pago: '2026-10-19', detalles: [{
  participacion_facturacion_id: 1, soe: 'TEST-SOE', denominacion_farmacia: 'Titular TEST',
  cif_nif: 'TEST-CIF-0001', importe: '100.00', ...cuenta,
}] });
const ccc = (cuenta) => cuenta.entidad_bancaria + cuenta.sucursal_bancaria
  + cuenta.digito_control_bancario + cuenta.cuenta_bancaria;

describe('cuentas generadas exclusivamente para pruebas', () => {
  it.each([101, 202])('la semilla %i es reproducible y supera el validador real de CCC e IBAN', (semilla) => {
    const cuenta = cuentaBancariaTest(semilla);
    expect(cuentaBancariaTest(semilla)).toEqual(cuenta);
    expect(confirmacionLiquidacionSchema.safeParse(cuerpo(cuenta)).success).toBe(true);
    expect(BigInt(ccc(cuenta) + '1428' + cuenta.pais_control_iban.slice(2)) % 97n).toBe(1n);
  });

  it('conserva cuentas distintas antes y después de la corrección', () => {
    expect(cuentaBancariaTest(101).cuenta_bancaria).not.toBe(cuentaBancariaTest(202).cuenta_bancaria);
  });

  it('rechaza un IBAN alterado aunque el CCC siga siendo correcto', () => {
    const cuenta = { ...cuentaBancariaTest(), pais_control_iban: 'ES00' };
    expect(confirmacionLiquidacionSchema.safeParse(cuerpo(cuenta)).success).toBe(false);
  });

  it('rechaza un CCC alterado aunque se recalcule un IBAN con resto correcto', () => {
    const cuenta = { ...cuentaBancariaTest(), digito_control_bancario: '99' };
    cuenta.pais_control_iban = 'ES' + String(98n - BigInt(ccc(cuenta) + '142800') % 97n).padStart(2, '0');
    expect(BigInt(ccc(cuenta) + '1428' + cuenta.pais_control_iban.slice(2)) % 97n).toBe(1n);
    expect(confirmacionLiquidacionSchema.safeParse(cuerpo(cuenta)).success).toBe(false);
  });
});
