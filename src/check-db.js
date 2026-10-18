import pool from './db.js';

try {
  const result = await pool.query(`
    SELECT current_database() AS base,
      to_regclass('public.participacion_facturacion') IS NOT NULL AS participacion
  `);
  if (!result.rows[0]?.participacion) {
    throw new Error('El esquema está desactualizado: falta public.participacion_facturacion.');
  }

  const estado = await pool.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'facturacion' AND column_name = 'estado'
      AND data_type = 'text' AND is_nullable = 'NO';`);
  const checkEstado = await pool.query(`SELECT pg_get_constraintdef(oid) AS definicion FROM pg_constraint
    WHERE conrelid = 'public.facturacion'::regclass AND conname = 'ck_facturacion_estado' AND convalidated;`);
  if (!estado.rowCount || !['REVISION', 'EMITIDA', 'REABIERTA'].every((valor) => checkEstado.rows[0]?.definicion.includes(`'${valor}'`))) {
    throw new Error('El esquema está desactualizado: falta el estado de revisión/emisión/reapertura de facturacion.');
  }

  const referencia = await pool.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'precinto' AND column_name = 'precio_referencia'
      AND data_type = 'numeric' AND numeric_precision = 12 AND numeric_scale = 2 AND is_nullable = 'NO';`);
  const checkReferencia = await pool.query(`SELECT pg_get_constraintdef(oid) AS definicion FROM pg_constraint
    WHERE conrelid = 'public.precinto'::regclass AND conname = 'ck_precinto_precio_referencia' AND convalidated;`);
  if (!referencia.rowCount || checkReferencia.rows[0]?.definicion !== 'CHECK ((precio_referencia >= (0)::numeric))') {
    throw new Error('El esquema está desactualizado: aplica 005-precio-referencia.sql antes de corregir precios.');
  }

  const restricciones = await pool.query(`
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND (t.relname, c.conname) IN (
        ('participacion_facturacion', 'uq_participacion_facturacion_entrega'),
        ('participacion_facturacion', 'fk_participacion_facturacion_facturacion'),
        ('participacion_facturacion', 'fk_participacion_facturacion_entrega'),
        ('factura', 'uq_factura_tipo_numero_factura'),
        ('detalle_pago_farmacia', 'uq_detalle_pago_farmacia_participacion'),
        ('detalle_pago_farmacia', 'fk_detalle_pago_farmacia_participacion')
      )
  `);
  const presentes = new Set(restricciones.rows.map((fila) => fila.conname));
  const esperadas = [
    'uq_participacion_facturacion_entrega',
    'fk_participacion_facturacion_facturacion',
    'fk_participacion_facturacion_entrega',
    'uq_factura_tipo_numero_factura',
    'uq_detalle_pago_farmacia_participacion',
    'fk_detalle_pago_farmacia_participacion',
  ];
  const faltantes = esperadas.filter((nombre) => !presentes.has(nombre));
  if (faltantes.length) {
    throw new Error(`El esquema está desactualizado: faltan restricciones ${faltantes.join(', ')}.`);
  }

  const numeroGlobal = await pool.query(`
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'factura'
      AND c.conname = 'uq_factura_numero_factura' AND c.contype = 'u'
  `);
  if (numeroGlobal.rowCount) {
    throw new Error('El esquema está desactualizado: numero_factura conserva unicidad global.');
  }

  console.log(`Conexión y estructura financiera comprobadas en ${result.rows[0].base}.`);
} catch (error) {
  console.error(`Error al conectar con PostgreSQL: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
