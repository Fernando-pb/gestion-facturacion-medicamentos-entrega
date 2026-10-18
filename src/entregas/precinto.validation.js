// Interpreta solo el formato; no consulta autorización ni registra lecturas.
export const interpretarCodigoPrecinto = (entrada) => {
  const manual = typeof entrada === 'string'
    && entrada.length === 6 && /^[0-9]{6}$/.test(entrada);
  const barras = typeof entrada === 'string'
    && entrada.length === 13 && /^847000[0-9]{7}$/.test(entrada);

  if (!manual && !barras) {
    throw new TypeError('Entrada de precinto no válida: usa seis dígitos o trece dígitos con prefijo 847000, sin espacios.');
  }

  return {
    codigo_barras_original: entrada,
    codigo_nacional: manual ? entrada : entrada.slice(6, 12),
  };
};
