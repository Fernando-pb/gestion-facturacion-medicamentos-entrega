const columnas=`c.id,c.porcentaje_comision::text,c.porcentaje_iva::text,
  to_char(c.fecha_inicio,'YYYY-MM-DD') AS fecha_inicio,to_char(c.fecha_fin,'YYYY-MM-DD') AS fecha_fin,
  EXISTS(SELECT 1 FROM factura f WHERE f.configuracion_facturacion_id=c.id) AS utilizada`;
export const listar=async c=>(await c.query(`SELECT ${columnas} FROM configuracion_facturacion c ORDER BY c.fecha_inicio,c.id`)).rows;
export const consultar=async(c,id)=>(await c.query(`SELECT ${columnas} FROM configuracion_facturacion c WHERE c.id=$1`,[id])).rows[0];
export const solapada=async(c,id,d)=>(await c.query(`SELECT EXISTS(SELECT 1 FROM configuracion_facturacion
  WHERE ($1::int IS NULL OR id<>$1) AND fecha_inicio<=COALESCE($3::date,'infinity'::date)
  AND COALESCE(fecha_fin,'infinity'::date)>=$2::date) AS existe`,[id,d.fecha_inicio,d.fecha_fin])).rows[0].existe;
export const protegeHistorico=async(c,id,d)=>(await c.query(`SELECT
  c.porcentaje_comision=$2::numeric AND c.porcentaje_iva=$3::numeric AND c.fecha_inicio=$4::date
  AND NOT EXISTS(SELECT 1 FROM factura f JOIN facturacion fc ON fc.id=f.facturacion_id
    WHERE f.configuracion_facturacion_id=c.id AND ($5::date IS NOT NULL AND fc.fecha_factura>$5::date)) AS valido
  FROM configuracion_facturacion c WHERE c.id=$1`,[id,d.porcentaje_comision,d.porcentaje_iva,d.fecha_inicio,d.fecha_fin])).rows[0].valido;
export const guardar=async(c,id,d)=>{
  const valores=[d.porcentaje_comision,d.porcentaje_iva,d.fecha_inicio,d.fecha_fin];
  if(id===null) return (await c.query(`INSERT INTO configuracion_facturacion(porcentaje_comision,porcentaje_iva,fecha_inicio,fecha_fin)
    VALUES ($1,$2,$3,$4) RETURNING id`,valores)).rows[0].id;
  await c.query(`UPDATE configuracion_facturacion SET porcentaje_comision=$1,porcentaje_iva=$2,fecha_inicio=$3,fecha_fin=$4 WHERE id=$5`,[...valores,id]);
  return id;
};
