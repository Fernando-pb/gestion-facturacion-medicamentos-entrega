// Datos creados expresamente para pruebas. No utilizar para pagos reales.
// Un control correcto no garantiza que una cuenta no esté asignada.
export const cuentaBancariaTest = (semilla = 101) => {
  if (!Number.isSafeInteger(semilla) || semilla < 1 || semilla > 9999999999) {
    throw new RangeError('La semilla TEST debe ser un entero de 1 a 9999999999.');
  }
  const entidad = '0000', sucursal = '0000';
  const numero = String(semilla).padStart(10, '0');
  const controlCCC = (digitos) => {
    const pesos = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6];
    const resto = [...digitos].reduce((suma, digito, i) => suma + Number(digito) * pesos[i], 0) % 11;
    const valor = 11 - resto;
    return String(valor === 11 ? 0 : valor === 10 ? 1 : valor);
  };
  const controles = controlCCC('00' + entidad + sucursal) + controlCCC(numero);
  const ccc = entidad + sucursal + controles + numero;
  return {
    pais_control_iban: 'ES' + String(98n - BigInt(ccc + '142800') % 97n).padStart(2, '0'),
    entidad_bancaria: entidad,
    sucursal_bancaria: sucursal,
    digito_control_bancario: controles,
    cuenta_bancaria: numero,
  };
};
