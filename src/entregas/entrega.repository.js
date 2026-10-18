export const bloquearFarmaciaEntrega = async (client, id) => {
  const resultado = await client.query(`
    SELECT id, ayuntamiento_id, denominacion, cif_nif
    FROM farmacia WHERE id = $1 FOR SHARE;
  `, [id]);
  return resultado.rows[0] ?? null;
};

export const consultarFarmaciaEntrega = async (client, id) => {
  const resultado = await client.query('SELECT id, ayuntamiento_id FROM farmacia WHERE id = $1;', [id]);
  return resultado.rows[0] ?? null;
};

export const bloquearAyuntamientoEntrega = async (client, id) => {
  const resultado = await client.query('SELECT id FROM ayuntamiento WHERE id = $1 FOR UPDATE;', [id]);
  return resultado.rows[0] ?? null;
};

export const existeFacturacionEntrega = async (client, ayuntamientoId, periodoId) => {
  const resultado = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM facturacion f
      WHERE ayuntamiento_id = $1 AND periodo_id = $2 AND tipo_facturacion = 'TD'
        AND (estado = 'EMITIDA' OR EXISTS (
          SELECT 1 FROM factura fa JOIN cobro c ON c.factura_id = fa.id
          WHERE fa.facturacion_id = f.id
        ))
    ) AS existe;
  `, [ayuntamientoId, periodoId]);
  return resultado.rows[0].existe;
};

export const consultarBloqueoEliminacionEntrega = async (client, ayuntamientoId, periodoId) => (await client.query(`
  SELECT
    EXISTS (
      SELECT 1 FROM facturacion f
      JOIN factura fa ON fa.facturacion_id = f.id
      JOIN cobro c ON c.factura_id = fa.id
      WHERE f.ayuntamiento_id = $1 AND f.periodo_id = $2 AND f.tipo_facturacion = 'TD'
    ) AS tiene_cobros,
    EXISTS (
      SELECT 1 FROM facturacion f
      WHERE f.ayuntamiento_id = $1 AND f.periodo_id = $2
        AND f.tipo_facturacion = 'TD' AND f.estado = 'EMITIDA'
    ) AS emitida;
`, [ayuntamientoId, periodoId])).rows[0];

export const consultarIdentidadEntrega = async (client, id, bloquear = false) => {
  const resultado = await client.query(`
    SELECT id, farmacia_id, periodo_id FROM entrega_farmacia_periodo WHERE id = $1
    ${bloquear ? 'FOR UPDATE' : ''};
  `, [id]);
  return resultado.rows[0] ?? null;
};

export const actualizarDeclaradosEntrega = async (client, id, datos) => {
  await client.query(`
    UPDATE entrega_farmacia_periodo
    SET precintos_informados = $1, importe_informado = $2 WHERE id = $3;
  `, [datos.precintos_informados, datos.importe_informado, id]);
};

export const bloquearPeriodoEntrega = async (client, id) => {
  const resultado = await client.query('SELECT id FROM periodo WHERE id = $1 FOR KEY SHARE;', [id]);
  return resultado.rows[0] ?? null;
};

export const buscarEntrega = async (client, farmaciaId, periodoId) => {
  const resultado = await client.query(`
    SELECT entrega.id, entrega.farmacia_id, entrega.periodo_id,
      entrega.denominacion_farmacia, entrega.cif_nif_farmacia,
      entrega.precintos_informados, entrega.importe_informado,
      periodo.mes, periodo.anio, farmacia.ayuntamiento_id,
      ayuntamiento.denominacion AS ayuntamiento_denominacion
    FROM entrega_farmacia_periodo AS entrega
    JOIN periodo ON periodo.id = entrega.periodo_id
    JOIN farmacia ON farmacia.id = entrega.farmacia_id
    JOIN ayuntamiento ON ayuntamiento.id = farmacia.ayuntamiento_id
    WHERE entrega.farmacia_id = $1 AND entrega.periodo_id = $2;
  `, [farmaciaId, periodoId]);
  return resultado.rows[0] ?? null;
};

export const insertarEntrega = async (client, farmacia, periodoId) => {
  const resultado = await client.query(`
    INSERT INTO entrega_farmacia_periodo
      (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT ON CONSTRAINT uq_entrega_farmacia_periodo DO NOTHING
    RETURNING id;
  `, [farmacia.id, periodoId, farmacia.denominacion, farmacia.cif_nif]);
  return resultado.rows[0] ?? null;
};

// Una sola sentencia comparte el snapshot de entrega, municipio y catálogo.
export const consultarEvaluacionEntrega = async (client, id, codigoNacional) => {
  const resultado = await client.query(`
    SELECT ayuntamiento.tipo_lista_medicamentos,
      medicamento.id, medicamento.descripcion, medicamento.precio,
      medicamento.estado, medicamento.situacion_comercial, medicamento.tipo_facturacion,
      EXISTS (SELECT 1 FROM ayuntamiento_medicamento AS lista
        WHERE lista.ayuntamiento_id = ayuntamiento.id
          AND lista.medicamento_id = medicamento.id) AS pertenece_lista_especifica
    FROM entrega_farmacia_periodo AS entrega
    JOIN farmacia ON farmacia.id = entrega.farmacia_id
    LEFT JOIN ayuntamiento ON ayuntamiento.id = farmacia.ayuntamiento_id
    LEFT JOIN medicamento ON medicamento.codigo_nacional = $2
    WHERE entrega.id = $1;
  `, [id, codigoNacional]);
  return resultado.rows[0] ?? null;
};

export const listarPeriodosEntrega = async (client) =>
  (await client.query('SELECT id, mes, anio FROM periodo ORDER BY anio DESC, mes DESC;')).rows;

// Los totales incluyen solo precintos; no multiplicarlos al unir incidencias.
export const listarEntregasRegistradas = async (client, periodoId) => (await client.query(`
  SELECT entrega.id, entrega.farmacia_id, entrega.periodo_id,
    entrega.denominacion_farmacia, entrega.cif_nif_farmacia,
    entrega.precintos_informados, entrega.importe_informado,
    periodo.mes, periodo.anio, farmacia.soe, farmacia.ayuntamiento_id,
    ayuntamiento.denominacion AS ayuntamiento_denominacion,
    totales.admitidos, totales.subtotal_facturable
  FROM entrega_farmacia_periodo AS entrega
  JOIN periodo ON periodo.id = entrega.periodo_id
  JOIN farmacia ON farmacia.id = entrega.farmacia_id
  LEFT JOIN ayuntamiento ON ayuntamiento.id = farmacia.ayuntamiento_id
  CROSS JOIN LATERAL (
    SELECT count(*)::int AS admitidos,
      COALESCE(sum(precio_aplicado), 0.00)::text AS subtotal_facturable
    FROM precinto WHERE entrega_id = entrega.id
  ) AS totales
  WHERE ($1::integer IS NULL OR entrega.periodo_id = $1)
  ORDER BY ayuntamiento.denominacion ASC NULLS LAST, farmacia.ayuntamiento_id,
    farmacia.soe ASC, periodo.anio DESC, periodo.mes DESC, entrega.id;
`, [periodoId ?? null])).rows;

export const buscarPeriodoPorFecha = async (client, mes, anio) =>
  (await client.query('SELECT id FROM periodo WHERE mes = $1 AND anio = $2;', [mes, anio])).rows[0] ?? null;

export const resolverPeriodoEntrega = async (client, mes, anio) => {
  const existente = await buscarPeriodoPorFecha(client, mes, anio);
  if (existente) return existente.id;
  const nueva = await client.query(`INSERT INTO periodo (mes, anio) VALUES ($1, $2)
    ON CONFLICT ON CONSTRAINT uq_periodo_mes_anio DO NOTHING RETURNING id;`, [mes, anio]);
  // Consulta separada READ COMMITTED ve al ganador después de esperar UNIQUE.
  return nueva.rows[0]?.id ?? (await buscarPeriodoPorFecha(client, mes, anio))?.id;
};
