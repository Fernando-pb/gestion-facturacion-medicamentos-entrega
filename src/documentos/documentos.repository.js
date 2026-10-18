export const configuracionActual = async (client) => (await client.query(`SELECT nombre_presidente,
  logo_personalizado, datos_emisor FROM configuracion_documentos ORDER BY id`)).rows[0]
  ?? { nombre_presidente: null, logo_personalizado: null, datos_emisor: null };

export const guardarConfiguracion = async (client, d) => {
  await client.query('LOCK TABLE configuracion_documentos IN EXCLUSIVE MODE');
  const existente = (await client.query('SELECT id FROM configuracion_documentos')).rows[0];
  if (existente) await client.query(`UPDATE configuracion_documentos SET nombre_presidente=$1,
    logo_personalizado=$2, datos_emisor=$3 WHERE id=$4`, [d.nombre_presidente, d.logo_personalizado, d.datos_emisor, existente.id]);
  else await client.query(`INSERT INTO configuracion_documentos (nombre_presidente,logo_personalizado,datos_emisor)
    VALUES ($1,$2,$3)`, [d.nombre_presidente,d.logo_personalizado,d.datos_emisor]);
};
export const cabeceraDocumental = async (client, id) => (await client.query(`SELECT f.id, f.estado,
  f.nombre_presidente_historico, to_char(f.fecha_factura,'YYYY-MM-DD') AS fecha_factura,
  pe.mes, pe.anio, a.denominacion, a.cif, a.direccion, a.codigo_postal, a.localidad, a.provincia
  FROM facturacion f JOIN ayuntamiento a ON a.id=f.ayuntamiento_id
  JOIN periodo pe ON pe.id=f.periodo_id WHERE f.id=$1`, [id])).rows[0];
