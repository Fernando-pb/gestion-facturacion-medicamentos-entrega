export const contextoPrecioEntrega = async (client, entregaId) => (await client.query(`
  SELECT facturacion.id AS facturacion_id, facturacion.estado, p.id AS participacion_id,
    EXISTS (SELECT 1 FROM factura fa JOIN cobro c ON c.factura_id = fa.id
      WHERE fa.facturacion_id = facturacion.id) AS tiene_cobros
  FROM entrega_farmacia_periodo e JOIN farmacia f ON f.id = e.farmacia_id
  LEFT JOIN facturacion ON facturacion.ayuntamiento_id = f.ayuntamiento_id
    AND facturacion.periodo_id = e.periodo_id AND facturacion.tipo_facturacion = 'TD'
  LEFT JOIN participacion_facturacion p ON p.facturacion_id = facturacion.id AND p.entrega_id = e.id
  WHERE e.id = $1;`, [entregaId])).rows[0] ?? null;

export const actualizarPrecioPrecinto = async (client, entregaId, precintoId, precio) => (await client.query(`
  UPDATE precinto SET precio_aplicado = $3
  WHERE entrega_id = $1 AND id = $2
  RETURNING id, entrega_id, numero_paquete, posicion_paquete, codigo_barras_original,
    codigo_nacional, medicamento_id, precio_aplicado::text, precio_referencia::text;`,
[entregaId, precintoId, precio])).rows[0] ?? null;

export const recalcularParticipacionEntrega = async (client, entregaId, facturacionId) => (await client.query(`
  UPDATE participacion_facturacion SET importe_precintos =
    (SELECT COALESCE(sum(precio_aplicado), 0.00) FROM precinto WHERE entrega_id = $1)
  WHERE entrega_id = $1 AND facturacion_id = $2 RETURNING importe_precintos::text;`,
[entregaId, facturacionId])).rows[0];
