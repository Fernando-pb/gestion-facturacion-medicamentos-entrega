// Se opera sobre cadenas: no hay redondeo ni conversión a coma flotante.
export const normalizarDecimal = (valor, { decimales = 2, cifrasEnteras = 10, nullable = false, recortar = false } = {}) => {
  if (typeof valor !== 'string') throw new Error('El valor decimal debe ser texto.');
  const texto = recortar ? valor.trim() : valor;
  if (texto === '' && nullable) return null;
  if (!/^\d+(?:[.,]\d+)?$/.test(texto)) {
    throw new Error('Introduce un decimal con coma o punto, sin separadores de miles ni signos.');
  }
  const [entero, fraccion = ''] = texto.split(/[.,]/);
  if (fraccion.length > decimales || entero.replace(/^0+(?=\d)/, '').length > cifrasEnteras) {
    throw new Error(`El valor admite hasta ${cifrasEnteras} cifras enteras y ${decimales} decimales, sin redondeo.`);
  }
  return texto.replace(',', '.');
};

export const formatoMonetario = (valor) => {
  if (valor === null || valor === '') return '';
  const normalizado = normalizarDecimal(valor, { decimales: 2, cifrasEnteras: 10 });
  const [entero, fraccion = ''] = normalizado.split('.');
  return `${entero},${fraccion.padEnd(2, '0')}`;
};

export const configurarCampoMonetario = (input, opciones = {}) => {
  input.addEventListener('blur', () => {
    // Una entrada inválida se conserva; el envío muestra el error de validación.
    try {
      const valor = normalizarDecimal(input.value, { decimales: 2, cifrasEnteras: 10, ...opciones });
      input.value = formatoMonetario(valor);
      input.setAttribute('aria-invalid', 'false');
    } catch (error) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('title', error.message);
      return;
    }
    input.setAttribute('title', '');
  });
};
