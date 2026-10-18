export const consultarFacturacion = async (client, ayuntamientoId, periodoId, lock = false) => {
  const fila = await client.query(`SELECT id, estado FROM facturacion
    WHERE ayuntamiento_id = $1 AND periodo_id = $2 AND tipo_facturacion = 'TD' ${lock ? 'FOR UPDATE' : ''};`,
  [ayuntamientoId, periodoId]);
  return fila.rows[0] ?? null;
};

export const calcularEntregas = async (client, ayuntamientoId, periodoId) => (await client.query(`
  SELECT e.id AS entrega_id, f.id AS farmacia_id, f.soe, f.denominacion, f.cif_nif,
    count(p.id)::int AS cantidad_precintos,
    COALESCE(sum(p.precio_aplicado), 0.00)::numeric(12,2)::text AS importe_precintos
  FROM entrega_farmacia_periodo e
  JOIN farmacia f ON f.id = e.farmacia_id
  LEFT JOIN precinto p ON p.entrega_id = e.id
  WHERE f.ayuntamiento_id = $1 AND e.periodo_id = $2
  GROUP BY e.id, f.id
  HAVING count(p.id) > 0
  ORDER BY f.soe, e.id;
`, [ayuntamientoId, periodoId])).rows;

export const crearFacturacionRevision = async (client, ayuntamientoId, periodoId) => (await client.query(`
  INSERT INTO facturacion (ayuntamiento_id, periodo_id, tipo_facturacion, fecha_factura, estado)
  SELECT $1, periodo.id, 'TD', (make_date(periodo.anio, periodo.mes, 1) + interval '1 month - 1 day')::date, 'REVISION'
  FROM periodo WHERE periodo.id = $2
  RETURNING id, estado;
`, [ayuntamientoId, periodoId])).rows[0] ?? null;

export const guardarParticipaciones = async (client, facturacionId, filas) => {
  const ids = [];
  for (const fila of filas) {
    const guardada = await client.query(`INSERT INTO participacion_facturacion
      (facturacion_id, entrega_id, soe_b, denominacion_b, cif_b, importe_precintos)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (entrega_id) DO UPDATE SET importe_precintos = EXCLUDED.importe_precintos
      WHERE participacion_facturacion.facturacion_id = EXCLUDED.facturacion_id
      RETURNING id, entrega_id, soe_b, denominacion_b, cif_b, importe_precintos::text;`,
    [facturacionId, fila.entrega_id, fila.soe, fila.denominacion, fila.cif_nif, fila.importe_precintos]);
    if (!guardada.rows[0]) throw Object.assign(new Error('La entrega ya pertenece a otra facturación.'), { status: 409 });
    ids.push(guardada.rows[0]);
  }
  await client.query(`DELETE FROM participacion_facturacion p WHERE p.facturacion_id = $1
    AND NOT (p.entrega_id = ANY($2::int[]));`, [facturacionId, filas.map((fila) => fila.entrega_id)]);
  return ids;
};

// En reapertura solo se corrige la actividad ya emitida: ni se crea otra
// participación ni se borra una participación histórica al quedarse sin precintos.
export const recalcularParticipacionesEmitidas = async (client, facturacionId) => {
  await client.query(`UPDATE participacion_facturacion p SET importe_precintos =
    COALESCE((SELECT sum(precio_aplicado) FROM precinto WHERE entrega_id = p.entrega_id), 0.00)
    WHERE p.facturacion_id = $1;`, [facturacionId]);
};

export const tieneCobros = async (client, id) => (await client.query(`SELECT EXISTS (
  SELECT 1 FROM factura f JOIN cobro c ON c.factura_id = f.id WHERE f.facturacion_id = $1
) AS existe;`, [id])).rows[0].existe;

export const cabeceraPorId = async (client, id) => (await client.query(
  'SELECT id, ayuntamiento_id, periodo_id, estado FROM facturacion WHERE id = $1;', [id])).rows[0] ?? null;

export const listarParticipaciones = async (client, facturacionId) => (await client.query(`
  SELECT p.id, p.entrega_id, p.soe_b, p.denominacion_b, p.cif_b, p.importe_precintos::text,
    e.farmacia_id, count(pr.id)::int AS cantidad_precintos,
    COALESCE(sum(pr.precio_aplicado), 0.00)::text AS importe_actual,
    p.importe_precintos <> COALESCE(sum(pr.precio_aplicado), 0.00) AS requiere_recalculo
  FROM participacion_facturacion p
  JOIN entrega_farmacia_periodo e ON e.id = p.entrega_id
  LEFT JOIN precinto pr ON pr.entrega_id = e.id
  WHERE p.facturacion_id = $1
  GROUP BY p.id, e.id ORDER BY p.soe_b, p.id;
`, [facturacionId])).rows;

export const resumenParticipaciones = async (client, facturacionId) => (await client.query(`
  SELECT COALESCE((SELECT sum(p.importe_precintos) FROM participacion_facturacion p
      WHERE p.facturacion_id = f.id), 0.00)::text AS importe_total,
    actual.cantidad_precintos, actual.importe_actual,
    EXISTS (SELECT 1 FROM entrega_farmacia_periodo e JOIN farmacia fa ON fa.id = e.farmacia_id
      WHERE fa.ayuntamiento_id = f.ayuntamiento_id AND e.periodo_id = f.periodo_id
        AND EXISTS (SELECT 1 FROM precinto WHERE entrega_id = e.id)
        AND NOT EXISTS (SELECT 1 FROM participacion_facturacion p WHERE p.facturacion_id = f.id AND p.entrega_id = e.id)) AS faltan_participaciones
  FROM facturacion f CROSS JOIN LATERAL (
    SELECT count(*)::int AS cantidad_precintos, COALESCE(sum(pr.precio_aplicado), 0.00)::text AS importe_actual
    FROM precinto pr JOIN entrega_farmacia_periodo e ON e.id = pr.entrega_id
    JOIN farmacia fa ON fa.id = e.farmacia_id
    WHERE fa.ayuntamiento_id = f.ayuntamiento_id AND e.periodo_id = f.periodo_id
  ) actual WHERE f.id = $1;
`, [facturacionId])).rows[0];

export const actualizarB = async (client, facturacionId, participacionId, datos) => (await client.query(`
  UPDATE participacion_facturacion p SET soe_b = $3, denominacion_b = $4, cif_b = $5
  FROM facturacion f WHERE p.id = $2 AND p.facturacion_id = f.id AND f.id = $1 AND f.estado = 'REVISION'
  RETURNING p.id, p.entrega_id, p.soe_b, p.denominacion_b, p.cif_b, p.importe_precintos::text;
`, [facturacionId, participacionId, datos.soe_b, datos.denominacion_b, datos.cif_b])).rows[0] ?? null;

export const reabrir = async (client, facturacionId, motivo) => {
  const cabecera = await client.query(`UPDATE facturacion f SET estado = 'REABIERTA'
    WHERE f.id = $1 AND f.estado = 'EMITIDA'
      AND NOT EXISTS (SELECT 1 FROM cobro c JOIN factura fa ON fa.id = c.factura_id WHERE fa.facturacion_id = f.id)
    RETURNING f.id;`, [facturacionId]);
  if (!cabecera.rows[0]) return false;
  await client.query('INSERT INTO reapertura_facturacion (facturacion_id, motivo) VALUES ($1, $2);', [facturacionId, motivo]);
  return true;
};

export const consultarFacturas = async (client, id) => (await client.query(`SELECT id, facturacion_id, tipo,
  numero_factura, numero_precintos, importe_total::text, base_calculo::text,
  porcentaje_comision::text, importe_comision::text, porcentaje_iva::text, importe_iva::text,
  configuracion_facturacion_id FROM factura WHERE facturacion_id = $1 ORDER BY tipo;`, [id])).rows;

export const consultarConfiguracionEmision = async (client, id, bloquear = true) => {
  // Impide modificaciones y nuevas vigencias solapadas durante la selección.
  // La administración de vigencias respeta este lock con SHARE ROW EXCLUSIVE.
  if (bloquear) await client.query('LOCK TABLE configuracion_facturacion IN SHARE MODE;');
  return (await client.query(`SELECT c.id AS configuracion_facturacion_id,
    c.porcentaje_comision::text, c.porcentaje_iva::text
    FROM configuracion_facturacion c JOIN facturacion f ON f.id = $1
    WHERE c.fecha_inicio <= f.fecha_factura AND (c.fecha_fin IS NULL OR f.fecha_factura <= c.fecha_fin)
    ORDER BY c.id;`, [id])).rows;
};

export const numerosOficialesUsados = async (client, numeros) => (await client.query(`SELECT tipo
  FROM factura WHERE (tipo = 'PRECINTOS' AND numero_factura = $1)
    OR (tipo = 'COMISION' AND numero_factura = $2);`,
[numeros.numero_factura_precintos, numeros.numero_factura_comision])).rows;

// round(NUMERIC, 2) aplica HALF_UP a importes no negativos; no convertir a Number.
export const calcularComisionEmision = async (client, base, configuracion) => (await client.query(`
  WITH comision AS (SELECT round($1::numeric * $2::numeric / 100, 2) AS importe),
    iva AS (SELECT round(importe * $3::numeric / 100, 2) AS importe FROM comision)
  SELECT $1::numeric::text AS base_calculo, comision.importe::text AS importe_comision,
    iva.importe::text AS importe_iva, round(comision.importe + iva.importe, 2)::text AS importe_total
  FROM comision CROSS JOIN iva;`, [base, configuracion.porcentaje_comision, configuracion.porcentaje_iva])).rows[0];

export const insertarFacturasEmision = async (client, id, numeros, resumen, calculo, configuracion) => {
  await client.query(`INSERT INTO factura (facturacion_id, tipo, numero_factura, numero_precintos, importe_total)
    VALUES ($1, 'PRECINTOS', $2, $3, $4);`,
  [id, numeros.numero_factura_precintos, resumen.cantidad_precintos, resumen.importe_total]);
  await client.query(`INSERT INTO factura (facturacion_id, tipo, numero_factura, base_calculo,
    porcentaje_comision, importe_comision, porcentaje_iva, importe_iva, importe_total, configuracion_facturacion_id)
    VALUES ($1, 'COMISION', $2, $3, $4, $5, $6, $7, $8, $9);`,
  [id, numeros.numero_factura_comision, calculo.base_calculo, configuracion.porcentaje_comision,
    calculo.importe_comision, configuracion.porcentaje_iva, calculo.importe_iva, calculo.importe_total,
    configuracion.configuracion_facturacion_id]);
};

export const actualizarFacturasEmision = async (client, id, resumen, calculo) => {
  await client.query(`UPDATE factura SET numero_precintos = $2, importe_total = $3
    WHERE facturacion_id = $1 AND tipo = 'PRECINTOS';`, [id, resumen.cantidad_precintos, resumen.importe_total]);
  await client.query(`UPDATE factura SET base_calculo = $2, importe_comision = $3, importe_iva = $4, importe_total = $5
    WHERE facturacion_id = $1 AND tipo = 'COMISION';`,
  [id, calculo.base_calculo, calculo.importe_comision, calculo.importe_iva, calculo.importe_total]);
};

export const marcarEmitida = async (client, id) => {
  await client.query("UPDATE facturacion SET estado = 'EMITIDA' WHERE id = $1;", [id]);
};

export const facturaParaCobro = async (client, id, facturaId, importe) => (await client.query(`
  SELECT id, importe_total = $3::numeric AS importe_correcto,
    EXISTS (SELECT 1 FROM cobro WHERE factura_id = factura.id) AS cobrada
  FROM factura WHERE facturacion_id = $1 AND id = $2 FOR UPDATE;`,
[id, facturaId, importe])).rows[0] ?? null;

export const insertarCobro = async (client, facturaId, datos) => (await client.query(`
  INSERT INTO cobro (factura_id, fecha_cobro, importe_cobrado, justificante)
  VALUES ($1, $2, $3, $4)
  RETURNING id, factura_id, fecha_cobro::text, importe_cobrado::text, justificante;`,
[facturaId, datos.fecha_cobro, datos.importe_cobrado, datos.justificante ?? null])).rows[0];

export const consultarCobros = async (client, id) => (await client.query(`
  SELECT c.id, c.factura_id, c.fecha_cobro::text, c.importe_cobrado::text, c.justificante
  FROM cobro c JOIN factura f ON f.id = c.factura_id
  WHERE f.facturacion_id = $1 ORDER BY c.factura_id;`, [id])).rows;

export const requisitoLiquidacion = async (client, id) => (await client.query(`
  SELECT fa.importe_total::text,
    c.fecha_cobro::text,
    (c.fecha_cobro + CASE extract(isodow FROM c.fecha_cobro)
      WHEN 5 THEN 3 WHEN 6 THEN 2 ELSE 1 END)::text AS fecha_sugerida,
    fa.importe_total = (SELECT sum(p.importe_precintos)
      FROM participacion_facturacion p WHERE p.facturacion_id = fa.facturacion_id) AS cuadra
  FROM factura fa JOIN cobro c ON c.factura_id = fa.id
  WHERE fa.facturacion_id = $1 AND fa.tipo = 'PRECINTOS'
    AND c.importe_cobrado = fa.importe_total;`, [id])).rows[0] ?? null;

export const propuestaDetallesPago = async (client, id) => (await client.query(`
  SELECT p.id AS participacion_facturacion_id, p.importe_precintos::text AS importe,
    f.soe, f.denominacion AS denominacion_farmacia, f.cif_nif,
    f.pais_control_iban, f.entidad_bancaria, f.sucursal_bancaria,
    f.digito_control_bancario, f.cuenta_bancaria,
    EXISTS (SELECT 1 FROM detalle_pago_farmacia d
      WHERE d.participacion_facturacion_id = p.id) AS liquidada
  FROM participacion_facturacion p JOIN entrega_farmacia_periodo e ON e.id = p.entrega_id
  JOIN farmacia f ON f.id = e.farmacia_id
  WHERE p.facturacion_id = $1 ORDER BY p.id;`, [id])).rows;

export const consultarPago = async (client, id) => {
  const pago = (await client.query(`SELECT id, facturacion_id, fecha_pago::text
    FROM pago_farmacias WHERE facturacion_id = $1;`, [id])).rows[0];
  if (!pago) return null;
  const detalles = (await client.query(`SELECT id, participacion_facturacion_id,
    soe, denominacion_farmacia, cif_nif, importe::text, pais_control_iban,
    entidad_bancaria, sucursal_bancaria, digito_control_bancario, cuenta_bancaria
    FROM detalle_pago_farmacia WHERE pago_farmacias_id = $1 ORDER BY participacion_facturacion_id;`, [pago.id])).rows;
  const resumen = (await client.query(`SELECT sum(d.importe)::text AS importe_total,
    sum(d.importe) = fa.importe_total AS cuadra, a.denominacion AS ayuntamiento,
    pe.mes, pe.anio
    FROM facturacion f JOIN ayuntamiento a ON a.id = f.ayuntamiento_id
    JOIN periodo pe ON pe.id = f.periodo_id
    JOIN factura fa ON fa.facturacion_id = f.id AND fa.tipo = 'PRECINTOS'
    JOIN pago_farmacias pg ON pg.facturacion_id = f.id
    JOIN detalle_pago_farmacia d ON d.pago_farmacias_id = pg.id
    WHERE f.id = $1 GROUP BY fa.id, a.id, pe.id;`, [id])).rows[0];
  return { ...pago, detalles, ...resumen };
};

export const insertarPago = async (client, id, datos) => {
  const pago = (await client.query(`INSERT INTO pago_farmacias (facturacion_id, fecha_pago)
    VALUES ($1, $2) RETURNING id;`, [id, datos.fecha_pago])).rows[0];
  for (const d of datos.detalles) {
    await client.query(`INSERT INTO detalle_pago_farmacia
      (pago_farmacias_id, participacion_facturacion_id, soe, denominacion_farmacia,
       cif_nif, importe, pais_control_iban, entidad_bancaria, sucursal_bancaria,
       digito_control_bancario, cuenta_bancaria)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11);`,
    [pago.id, d.participacion_facturacion_id, d.soe, d.denominacion_farmacia, d.cif_nif,
      d.importe, d.pais_control_iban, d.entidad_bancaria, d.sucursal_bancaria,
      d.digito_control_bancario, d.cuenta_bancaria]);
  }
};

export const actividadInformeAnual = async (client, anio, ayuntamientoId) => (await client.query(`
  SELECT f.ayuntamiento_id, a.denominacion AS ayuntamiento, e.farmacia_id, pe.mes,
    p.soe_b, p.denominacion_b, p.cif_b,
    COALESCE(sum(pr.precio_aplicado), 0.00)::text AS importe
  FROM facturacion f JOIN periodo pe ON pe.id = f.periodo_id
  JOIN ayuntamiento a ON a.id = f.ayuntamiento_id
  JOIN participacion_facturacion p ON p.facturacion_id = f.id
  JOIN entrega_farmacia_periodo e ON e.id = p.entrega_id
  LEFT JOIN precinto pr ON pr.entrega_id = e.id
  WHERE pe.anio = $1 AND ($2::int IS NULL OR f.ayuntamiento_id = $2)
    AND f.estado = 'EMITIDA'
    AND EXISTS (SELECT 1 FROM factura fa WHERE fa.facturacion_id = f.id AND fa.tipo = 'PRECINTOS')
  GROUP BY f.id, a.id, e.id, pe.id, p.id
  ORDER BY f.ayuntamiento_id, e.farmacia_id, pe.mes, p.id;`, [anio, ayuntamientoId ?? null])).rows;

export const reaperturasInformeAnual = async (client, anio, ayuntamientoId) => (await client.query(`
  SELECT f.id AS facturacion_id, f.ayuntamiento_id, pe.mes
  FROM facturacion f JOIN periodo pe ON pe.id = f.periodo_id
  WHERE pe.anio = $1 AND ($2::int IS NULL OR f.ayuntamiento_id = $2) AND f.estado = 'REABIERTA'
  ORDER BY f.ayuntamiento_id, pe.mes;`, [anio, ayuntamientoId ?? null])).rows;
export const listarFacturacionesEmitidas = async (client) => (await client.query(`
  SELECT f.id AS facturacion_id, a.denominacion AS ayuntamiento, pe.mes, pe.anio,
    p.importe_total::text AS importe_precintos, c.importe_total::text AS importe_comision,
    p.numero_factura AS numero_factura_precintos, c.numero_factura AS numero_factura_comision,
    EXISTS (SELECT 1 FROM cobro WHERE factura_id = p.id) AS factura_precintos_cobrada,
    EXISTS (SELECT 1 FROM cobro WHERE factura_id = c.id) AS factura_comision_cobrada,
    EXISTS (SELECT 1 FROM factura fa JOIN cobro co ON co.factura_id = fa.id WHERE fa.facturacion_id = f.id) AS tiene_cobros,
    pg.fecha_pago::text AS fecha_prevista_liquidacion
  FROM facturacion f
  JOIN ayuntamiento a ON a.id = f.ayuntamiento_id
  JOIN periodo pe ON pe.id = f.periodo_id
  JOIN factura p ON p.facturacion_id = f.id AND p.tipo = 'PRECINTOS'
  JOIN factura c ON c.facturacion_id = f.id AND c.tipo = 'COMISION'
  LEFT JOIN pago_farmacias pg ON pg.facturacion_id = f.id
  WHERE f.estado = 'EMITIDA' AND f.tipo_facturacion = 'TD'
  ORDER BY pe.anio DESC, pe.mes DESC, lower(a.denominacion), a.denominacion, f.id;
`)).rows;

// Solo actividad apta y procesos TD editables. Consultar no prepara ni emite.
export const listarCombinacionesPendientes = async (client) => (await client.query(`
  SELECT a.id AS ayuntamiento_id, a.denominacion, pe.id AS periodo_id, pe.mes, pe.anio,
    f.id AS facturacion_id, COALESCE(f.estado, 'SIN_FACTURAR') AS estado
  FROM ayuntamiento a CROSS JOIN periodo pe
  LEFT JOIN facturacion f ON f.ayuntamiento_id = a.id AND f.periodo_id = pe.id AND f.tipo_facturacion = 'TD'
  WHERE (f.id IS NULL OR f.estado IN ('REVISION', 'REABIERTA'))
    AND NOT EXISTS (SELECT 1 FROM factura fa JOIN cobro c ON c.factura_id = fa.id WHERE fa.facturacion_id = f.id)
    AND EXISTS (SELECT 1 FROM entrega_farmacia_periodo e JOIN farmacia fm ON fm.id = e.farmacia_id
      JOIN precinto p ON p.entrega_id = e.id WHERE fm.ayuntamiento_id = a.id AND e.periodo_id = pe.id)
  ORDER BY lower(a.denominacion), a.id, pe.anio DESC, pe.mes DESC;
`)).rows;

