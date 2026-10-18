// El único comodín procede del modo, nunca del término recibido.
export const construirPatronLiteral = (q, modo) => {
  const literal = q.replaceAll('!', '!!').replaceAll('%', '!%').replaceAll('_', '!_');
  return modo === 'prefijo' ? `${literal}%` : modo === 'contiene' ? `%${literal}%` : literal;
};
