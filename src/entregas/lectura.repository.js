export const buscarOperacion = async (client, entregaId, clave) => {
  const resultado = await client.query(`
    SELECT operacion.solicitud, operacion.clave, operacion.retirada,
      CASE WHEN precinto.id IS NOT NULL THEN 'PRECINTO' ELSE 'INCIDENCIA' END AS tipo,
      COALESCE(precinto.id, incidencia.id) AS id, operacion.entrega_id,
      COALESCE(precinto.codigo_barras_original, incidencia.codigo_barras_original) AS codigo_barras_original,
      COALESCE(precinto.codigo_nacional, incidencia.codigo_nacional) AS codigo_nacional,
      precinto.numero_paquete, precinto.posicion_paquete, precinto.medicamento_id,
      precinto.precio_aplicado, precinto.precio_referencia, incidencia.motivo
    FROM operacion_lectura AS operacion
    LEFT JOIN precinto ON precinto.id = operacion.precinto_id
    LEFT JOIN incidencia ON incidencia.id = operacion.incidencia_id
    WHERE operacion.entrega_id = $1 AND operacion.clave = $2;
  `, [entregaId, clave]);
  const fila = resultado.rows[0];
  if (!fila) return null;
  if (fila.retirada) return { retirada: true, datos: { clave_operacion: fila.clave } };
  const lectura = { id: fila.id, entrega_id: fila.entrega_id,
    codigo_barras_original: fila.codigo_barras_original, codigo_nacional: fila.codigo_nacional };
  if (fila.tipo === 'PRECINTO') Object.assign(lectura, {
    numero_paquete: fila.numero_paquete, posicion_paquete: fila.posicion_paquete,
    medicamento_id: fila.medicamento_id, precio_aplicado: fila.precio_aplicado, precio_referencia: fila.precio_referencia,
  });
  else lectura.motivo = fila.motivo;
  return { solicitud: fila.solicitud, datos: { clave_operacion: fila.clave, tipo: fila.tipo, lectura } };
};

export const consultarPrecintos = async (client, entregaId) => {
  const resultado = await client.query(`
    SELECT COALESCE((SELECT jsonb_agg(to_jsonb(lectura) ORDER BY numero_paquete, posicion_paquete)
      FROM (SELECT id, entrega_id, numero_paquete, posicion_paquete,
        codigo_barras_original, codigo_nacional, medicamento_id, precio_aplicado::text AS precio_aplicado,
        precio_referencia::text AS precio_referencia
        FROM precinto WHERE entrega_id = entrega.id) AS lectura), '[]'::jsonb) AS datos
    FROM entrega_farmacia_periodo AS entrega WHERE entrega.id = $1;
  `, [entregaId]);
  return resultado.rows[0]?.datos ?? null;
};

export const consultarIncidencias = async (client, entregaId) => {
  const resultado = await client.query(`
    SELECT COALESCE((SELECT jsonb_agg(to_jsonb(lectura) ORDER BY id)
      FROM (SELECT id, entrega_id, codigo_barras_original, codigo_nacional, motivo, observaciones
        FROM incidencia WHERE entrega_id = entrega.id) AS lectura), '[]'::jsonb) AS datos
    FROM entrega_farmacia_periodo AS entrega WHERE entrega.id = $1;
  `, [entregaId]);
  return resultado.rows[0]?.datos ?? null;
};

// Agrupar cada origen antes de combinarlo evita multiplicar precintos por incidencias.
// Una sentencia utiliza un único snapshot, incluso si otra transacción está guardando.
export const consultarResumen = async (client, entregaId) => {
  const resultado = await client.query(`
    WITH paquetes AS (
      SELECT numero_paquete, count(*)::int AS precintos, sum(precio_aplicado) AS subtotal
      FROM precinto WHERE entrega_id = $1 GROUP BY numero_paquete
    ), admitidos AS (
      SELECT COALESCE(sum(precintos), 0)::bigint AS cantidad,
        COALESCE(sum(subtotal), 0.00::numeric) AS subtotal FROM paquetes
    ), incidencias AS (
      SELECT count(*) AS cantidad FROM incidencia WHERE entrega_id = $1
    )
    SELECT jsonb_build_object(
      'entrega_id', entrega.id,
      'precintos_informados', entrega.precintos_informados,
      'importe_informado', entrega.importe_informado::text,
      'admitidos', admitidos.cantidad,
      'incidencias', incidencias.cantidad,
      'total_registrado', admitidos.cantidad + incidencias.cantidad,
      'subtotal_facturable', admitidos.subtotal::text,
      'diferencia_cantidad', admitidos.cantidad + incidencias.cantidad - entrega.precintos_informados,
      'diferencia_importe', (admitidos.subtotal - entrega.importe_informado)::text,
      'paquetes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'numero_paquete', numero_paquete, 'precintos', precintos, 'subtotal_facturable', subtotal::text)
        ORDER BY numero_paquete) FROM paquetes), '[]'::jsonb)
    ) AS datos
    FROM entrega_farmacia_periodo AS entrega CROSS JOIN admitidos CROSS JOIN incidencias
    WHERE entrega.id = $1;
  `, [entregaId]);
  return resultado.rows[0]?.datos ?? null;
};

export const eliminarEntrada = async (client, entregaId, lecturaId, tipo) => {
  const tabla = tipo === 'precintos' ? 'precinto' : 'incidencia';
  const referencia = tipo === 'precintos' ? 'precinto_id' : 'incidencia_id';
  // Identificadores escogidos de constantes internas, nunca de entrada de usuario.
  const fila = (await client.query(`SELECT * FROM ${tabla} WHERE entrega_id = $1 AND id = $2;`,
  [entregaId, lecturaId])).rows[0];
  if (!fila) return false;
  // Desvincular y purgar antes del DELETE impide que CASCADE borre la protección.
  await client.query(`UPDATE operacion_lectura SET retirada = TRUE, solicitud = NULL,
    precinto_id = NULL, incidencia_id = NULL WHERE entrega_id = $1 AND ${referencia} = $2;`, [entregaId, lecturaId]);
  await client.query(`DELETE FROM ${tabla} WHERE entrega_id = $1 AND id = $2;`, [entregaId, lecturaId]);
  if (tipo === 'precintos') {
    const restantes = (await client.query(`SELECT id, posicion_paquete FROM precinto
      WHERE entrega_id = $1 AND numero_paquete = $2 ORDER BY posicion_paquete;`, [entregaId, fila.numero_paquete])).rows;
    // El destino nunca supera la posición anterior. Actualizar de menor a mayor
    // aprovecha el hueco liberado, sin colisiones ni diferir/desactivar UNIQUE.
    for (const [indice, restante] of restantes.entries()) {
      if (restante.posicion_paquete !== indice + 1) {
        await client.query('UPDATE precinto SET posicion_paquete = $1 WHERE id = $2;', [indice + 1, restante.id]);
      }
    }
  }
  return true;
};

export const bloquearMedicamentoCodigo = async (client, codigo) => {
  const resultado = await client.query('SELECT id FROM medicamento WHERE codigo_nacional = $1 FOR SHARE;', [codigo]);
  return resultado.rows[0]?.id ?? null;
};

export const siguientePosicion = async (client, entregaId, nuevoPaquete) => {
  const ultimo = (await client.query(`SELECT numero_paquete, max(posicion_paquete)::int AS posicion
    FROM precinto WHERE entrega_id = $1 GROUP BY numero_paquete ORDER BY numero_paquete DESC LIMIT 1;`,
  [entregaId])).rows[0];
  if (!ultimo) return { numero_paquete: 1, posicion_paquete: 1 };
  if (nuevoPaquete || ultimo.posicion === 15) {
    return { numero_paquete: ultimo.numero_paquete + 1, posicion_paquete: 1 };
  }
  return { numero_paquete: ultimo.numero_paquete, posicion_paquete: ultimo.posicion + 1 };
};

export const insertarLectura = async (client, entregaId, codigos, contexto, motivo, posicion) => {
  if (motivo) {
    return (await client.query(`INSERT INTO incidencia (entrega_id, codigo_barras_original, codigo_nacional, motivo)
      VALUES ($1, $2, $3, $4) RETURNING id;`,
    [entregaId, codigos.codigo_barras_original, codigos.codigo_nacional, motivo])).rows[0];
  }
  return (await client.query(`INSERT INTO precinto
    (entrega_id, codigo_barras_original, codigo_nacional, medicamento_id, precio_aplicado, numero_paquete, posicion_paquete, precio_referencia)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $5) RETURNING id;`,
  [entregaId, codigos.codigo_barras_original, codigos.codigo_nacional, contexto.id, contexto.precio,
    posicion.numero_paquete, posicion.posicion_paquete])).rows[0];
};

export const insertarOperacion = async (client, entregaId, solicitud, lecturaId, incidencia) => {
  await client.query(`INSERT INTO operacion_lectura (entrega_id, clave, solicitud, precinto_id, incidencia_id)
    VALUES ($1, $2, $3, $4, $5);`, [entregaId, solicitud.clave_operacion, solicitud,
    incidencia ? null : lecturaId, incidencia ? lecturaId : null]);
};
