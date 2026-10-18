import pool from '../db.js';
import { listarFacturacionesEmitidas, listarCombinacionesPendientes } from './facturacion.repository.js';
import { actualizarB, calcularEntregas, consultarFacturacion, crearFacturacionRevision,
  listarParticipaciones, reabrir, guardarParticipaciones, resumenParticipaciones,
  recalcularParticipacionesEmitidas, tieneCobros, cabeceraPorId, consultarFacturas,
  consultarConfiguracionEmision, numerosOficialesUsados, calcularComisionEmision,
  insertarFacturasEmision, actualizarFacturasEmision, marcarEmitida,
  facturaParaCobro, insertarCobro, consultarCobros,
  requisitoLiquidacion, propuestaDetallesPago, consultarPago, insertarPago,
  actividadInformeAnual, reaperturasInformeAnual } from './facturacion.repository.js';

const resultado = (estadoHttp, datos) => ({ estadoHttp, datos });
const errorResultado = (estadoHttp, error) => resultado(estadoHttp, { error });
const advertencia = 'No hay precintos aptos para este Ayuntamiento y periodo.';
export const consultarListadoEmitidas = async () => resultado(200, await listarFacturacionesEmitidas(pool));
export const consultarPendientes = async () => resultado(200, await listarCombinacionesPendientes(pool));

export const buscarFacturacion = async ({ ayuntamiento_id, periodo_id }) => {
  const cabecera = await consultarFacturacion(pool, ayuntamiento_id, periodo_id);
  return cabecera ? resultado(200, { facturacion_id: cabecera.id, estado: cabecera.estado })
    : errorResultado(404, 'No hay una facturación guardada para este Ayuntamiento y periodo.');
};

// Todas las mutaciones respetan Ayuntamiento → Facturación. Entregas adquiere
// el mismo bloqueo municipal antes de escribir: el cálculo no pierde lecturas.
const enTransaccion = async (operacion) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const respuesta = await operacion(client);
    await client.query(respuesta.estadoHttp < 400 ? 'COMMIT' : 'ROLLBACK');
    return respuesta;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505' && ['uq_pago_farmacias_facturacion', 'uq_detalle_pago_farmacia_participacion'].includes(error.constraint)) {
      return errorResultado(409, 'La facturación o una de sus participaciones ya está liquidada.');
    }
    if (error.code === '23505' && error.constraint === 'uq_cobro_factura') {
      return errorResultado(409, 'La factura ya tiene un cobro registrado.');
    }
    if (error.code === '22003') return errorResultado(409, 'El importe calculado supera la capacidad monetaria del esquema.');
    if (error.status === 409) return errorResultado(409, error.message);
    if (error.code === '23505' && error.constraint === 'uq_factura_tipo_numero_factura') {
      return errorResultado(409, 'Uno de los números oficiales ya está utilizado en su propia serie.');
    }
    if (['22008', '22009'].includes(error.code)) return errorResultado(409, 'El periodo no permite representar la fecha de factura en PostgreSQL.');
    throw error;
  } finally { client.release(); }
};

const bloquearCabecera = async (client, id) => {
  const observada = await cabeceraPorId(client, id);
  if (!observada) return null;
  await client.query('SELECT id FROM ayuntamiento WHERE id = $1 FOR UPDATE;', [observada.ayuntamiento_id]);
  return consultarFacturacion(client, observada.ayuntamiento_id, observada.periodo_id, true);
};

export const registrarCobro = async (id, facturaId, datos) => enTransaccion(async (client) => {
  // El mismo orden que reapertura y emisión: la comprobación del estado y el
  // INSERT quedan protegidos hasta COMMIT. La otra factura puede cobrarse después.
  const cabecera = await bloquearCabecera(client, id);
  if (!cabecera) return errorResultado(404, 'Facturación no encontrada.');
  const factura = await facturaParaCobro(client, id, facturaId, datos.importe_cobrado);
  if (!factura) return errorResultado(404, 'Factura no encontrada en esta facturación.');
  if (cabecera.estado !== 'EMITIDA') return errorResultado(409, 'Solo se pueden cobrar facturas de una facturación emitida.');
  if (factura.cobrada) return errorResultado(409, 'La factura ya tiene un cobro registrado.');
  if (!factura.importe_correcto) return errorResultado(409, 'El cobro debe coincidir con el importe total de la factura.');
  return resultado(201, await insertarCobro(client, facturaId, datos));
});

const consultarResultado = async (client, cabecera) => {
  const participaciones = await listarParticipaciones(client, cabecera.id);
  const resumen = await resumenParticipaciones(client, cabecera.id);
  return { facturacion_id: cabecera.id, estado: cabecera.estado, participaciones, ...resumen,
    requiere_recalculo: resumen.faltan_participaciones || participaciones.some((p) => p.requiere_recalculo
      || (cabecera.estado === 'REVISION' && p.cantidad_precintos === 0)),
    ...(resumen.cantidad_precintos === 0 ? { advertencia } : {}) };
};

export const calcularFacturacion = async ({ ayuntamiento_id, periodo_id }) => enTransaccion(async (client) => {
  const ayuntamiento = await client.query('SELECT id FROM ayuntamiento WHERE id = $1 FOR UPDATE;', [ayuntamiento_id]);
  if (!ayuntamiento.rowCount) return errorResultado(404, 'Ayuntamiento no encontrado.');
  const periodo = await client.query('SELECT id FROM periodo WHERE id = $1 FOR KEY SHARE;', [periodo_id]);
  if (!periodo.rowCount) return errorResultado(404, 'Periodo no encontrado.');
  let cabecera = await consultarFacturacion(client, ayuntamiento_id, periodo_id, true);
  if (cabecera?.estado === 'EMITIDA' || (cabecera && await tieneCobros(client, cabecera.id))) {
    return errorResultado(409, 'La facturación está bloqueada: debe estar en revisión o reabierta sin cobros.');
  }
  const entregas = await calcularEntregas(client, ayuntamiento_id, periodo_id);
  if (!cabecera && !entregas.length) {
    return resultado(200, { facturacion_id: null, estado: null, participaciones: [],
      cantidad_precintos: 0, importe_total: '0.00', importe_actual: '0.00', requiere_recalculo: false, advertencia });
  }
  cabecera ??= await crearFacturacionRevision(client, ayuntamiento_id, periodo_id);
  if (cabecera.estado === 'REABIERTA') {
    const existentes = await listarParticipaciones(client, cabecera.id);
    if (entregas.some((e) => !existentes.some((p) => p.entrega_id === e.entrega_id))) {
      return errorResultado(409, 'La reapertura solo permite corregir las participaciones ya emitidas.');
    }
    await recalcularParticipacionesEmitidas(client, cabecera.id);
  } else {
    await guardarParticipaciones(client, cabecera.id, entregas);
  }
  return resultado(200, await consultarResultado(client, cabecera));
});

export const consultarFacturacionRevision = async (id) => {
  const client = await pool.connect();
  try {
    // Un snapshot para cabecera, cantidades e importes, sin escribir desde GET.
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const cabecera = await cabeceraPorId(client, id);
    const respuesta = cabecera ? resultado(200, { ...await consultarResultado(client, cabecera),
      ...(cabecera.estado !== 'REVISION' ? { facturas: await consultarFacturas(client, id),
        cobros: await consultarCobros(client, id) } : {}) })
      : errorResultado(404, 'Facturación no encontrada.');
    await client.query('COMMIT');
    return respuesta;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};

export const corregirParticipacionB = async (id, participacionId, datos) => enTransaccion(async (client) => {
  const cabecera = await bloquearCabecera(client, id);
  if (!cabecera) return errorResultado(404, 'Facturación no encontrada.');
  if (cabecera.estado !== 'REVISION' || await tieneCobros(client, id)) {
    return errorResultado(409, 'B está congelado desde la emisión, también durante una reapertura.');
  }
  const fila = await actualizarB(client, id, participacionId, datos);
  return fila ? resultado(200, fila) : errorResultado(404, 'Participación no encontrada en esta facturación.');
});

export const reabrirFacturacion = async (id, motivo) => enTransaccion(async (client) => {
  const cabecera = await bloquearCabecera(client, id);
  if (!cabecera) return errorResultado(404, 'Facturación no encontrada.');
  if (!await reabrir(client, id, motivo)) return errorResultado(409, 'Solo se puede reabrir una facturación emitida sin cobros.');
  return resultado(200, { facturacion_id: id, estado: 'REABIERTA' });
});

export const emitirFacturacion = async (id, numeros) => enTransaccion(async (client) => {
  const cabecera = await bloquearCabecera(client, id);
  if (!cabecera) return errorResultado(404, 'Facturación no encontrada.');
  if (cabecera.estado === 'EMITIDA' || await tieneCobros(client, id)) {
    return errorResultado(409, 'La facturación ya está emitida o tiene cobros; no puede modificarse.');
  }
  let revision = await consultarResultado(client, cabecera);
  if (revision.cantidad_precintos === 0) return resultado(200, revision);
  const facturas = await consultarFacturas(client, id);
  let configuracion;
  if (cabecera.estado === 'REVISION') {
    if (!numeros.numero_factura_precintos || !numeros.numero_factura_comision) {
      return errorResultado(400, 'La primera emisión exige ambos números oficiales de Contabilidad.');
    }
    if (facturas.length) return errorResultado(409, 'La revisión contiene documentos previos incompatibles con una primera emisión.');
    if (revision.requiere_recalculo) return errorResultado(409, 'Recalcula y revisa las participaciones antes de emitir.');
    if ((await numerosOficialesUsados(client, numeros)).length) {
      return errorResultado(409, 'Uno de los números oficiales ya está utilizado en su propia serie.');
    }
    const configuraciones = await consultarConfiguracionEmision(client, id);
    if (configuraciones.length !== 1) return errorResultado(409,
      'Debe existir una única configuración de comisión e IVA vigente en la fecha de factura (último día del periodo). Abre «Gestionar comisión e IVA» y crea una vigencia que cubra esa fecha o corrige las vigencias solapadas.');
    configuracion = configuraciones[0];
  } else {
    const precintos = facturas.find((f) => f.tipo === 'PRECINTOS');
    configuracion = facturas.find((f) => f.tipo === 'COMISION');
    if (facturas.length !== 2 || !precintos || !configuracion) {
      return errorResultado(409, 'La reapertura requiere las dos facturas originales completas.');
    }
    if (numeros.numero_factura_precintos !== undefined
      && (numeros.numero_factura_precintos !== precintos.numero_factura || numeros.numero_factura_comision !== configuracion.numero_factura)) {
      return errorResultado(409, 'La reapertura conserva los números oficiales originales; no permite sustituirlos.');
    }
    if (revision.faltan_participaciones) return errorResultado(409, 'La reapertura solo permite corregir las participaciones ya emitidas.');
    await recalcularParticipacionesEmitidas(client, id);
    revision = await consultarResultado(client, cabecera);
  }
  const calculo = await calcularComisionEmision(client, revision.importe_total, configuracion);
  if (cabecera.estado === 'REVISION') {
    await insertarFacturasEmision(client, id, numeros, revision, calculo, configuracion);
    // Snapshot documental en la misma transacción que ambas facturas.
    // Reemitir conserva el presidente capturado en la primera emisión.
    await client.query(`UPDATE facturacion SET nombre_presidente_historico =
      (SELECT nombre_presidente FROM configuracion_documentos) WHERE id = $1`, [id]);
  } else {
    await actualizarFacturasEmision(client, id, revision, calculo);
  }
  // B ya está persistido y confirmado en la revisión. Cambiar el estado dentro
  // de la misma transacción lo congela sin volver a consultar el catálogo/A.
  await marcarEmitida(client, id);
  return resultado(cabecera.estado === 'REVISION' ? 201 : 200, {
    facturacion_id: id, estado: 'EMITIDA', facturas: await consultarFacturas(client, id),
  });
});

export const previsualizarFacturacion = async (id) => {
  const client = await pool.connect();
  try {
    // Un snapshot consistente, sin locks de escritura ni recálculo persistido.
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const consultar = async () => {
      const cabecera = await cabeceraPorId(client, id);
      if (!cabecera) return errorResultado(404, 'Facturación no encontrada.');
      if (cabecera.estado === 'EMITIDA' || await tieneCobros(client, id)) {
        return errorResultado(409, 'La facturación ya está emitida o tiene cobros; no puede modificarse.');
      }
      const revision = await consultarResultado(client, cabecera);
      if (revision.cantidad_precintos === 0) return resultado(200, revision);
      const facturas = await consultarFacturas(client, id);
      let configuracion, base = revision.importe_total;
      if (cabecera.estado === 'REVISION') {
        if (facturas.length) return errorResultado(409, 'La revisión contiene documentos previos incompatibles con una primera emisión.');
        if (revision.requiere_recalculo) return errorResultado(409, 'Recalcula y revisa las participaciones antes de emitir.');
        const configuraciones = await consultarConfiguracionEmision(client, id, false);
        if (configuraciones.length !== 1) return errorResultado(409,
          'Debe existir una única configuración de comisión e IVA vigente en la fecha de factura (último día del periodo). Abre «Gestionar comisión e IVA» y crea una vigencia que cubra esa fecha o corrige las vigencias solapadas.');
        configuracion = configuraciones[0];
      } else {
        configuracion = facturas.find((f) => f.tipo === 'COMISION');
        if (facturas.length !== 2 || !configuracion || !facturas.some((f) => f.tipo === 'PRECINTOS')) {
          return errorResultado(409, 'La reapertura requiere las dos facturas originales completas.');
        }
        if (revision.faltan_participaciones) return errorResultado(409, 'La reapertura solo permite corregir las participaciones ya emitidas.');
        base = monedaInforme(revision.participaciones.reduce((total, p) => total + centimos(p.importe_actual), 0n));
      }
      const calculo = await calcularComisionEmision(client, base, configuracion);
      // Las dos facturas se guardan en NUMERIC(12,2), aunque su suma puede superarlo.
      const limite = 999999999999n;
      if (centimos(base) > limite || centimos(calculo.importe_total) > limite
        || centimos(calculo.importe_comision) > limite || centimos(calculo.importe_iva) > limite
        || revision.participaciones.some((p) => centimos(p.importe_actual) > limite)) {
        return errorResultado(409, 'El importe calculado supera la capacidad monetaria del esquema.');
      }
      return resultado(200, { facturacion_id: id, estado: cabecera.estado,
        cantidad_precintos: revision.cantidad_precintos, importe_precintos: base,
        base_calculo: calculo.base_calculo, porcentaje_comision: configuracion.porcentaje_comision,
        importe_comision: calculo.importe_comision, porcentaje_iva: configuracion.porcentaje_iva,
        importe_iva: calculo.importe_iva, importe_total_comision: calculo.importe_total,
        importe_total_conjunto: monedaInforme(centimos(base) + centimos(calculo.importe_total)) });
    };
    const respuesta = await consultar();
    await client.query('COMMIT');
    return respuesta;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};

const comprobarLiquidacion = async (client, id) => {
  const cabecera = await bloquearCabecera(client, id);
  if (!cabecera) return errorResultado(404, 'Facturación no encontrada.');
  if (cabecera.estado !== 'EMITIDA') return errorResultado(409, 'La facturación debe estar emitida.');
  const requisito = await requisitoLiquidacion(client, id);
  if (!requisito) return errorResultado(409, 'Se requiere el cobro completo de PRECINTOS antes de preparar la liquidación.');
  if (!requisito.cuadra) return errorResultado(409, 'Las participaciones no cuadran con el total de PRECINTOS.');
  if (await consultarPago(client, id)) return errorResultado(409, 'La facturación ya está liquidada.');
  const detalles = await propuestaDetallesPago(client, id);
  if (!detalles.length || detalles.some((d) => d.liquidada)) return errorResultado(409, 'No hay participaciones disponibles para liquidar.');
  return { requisito, detalles };
};

export const prepararLiquidacion = async (id) => enTransaccion(async (client) => {
  const contexto = await comprobarLiquidacion(client, id);
  if (contexto.estadoHttp) return contexto;
  const { requisito, detalles } = contexto;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requisito.fecha_sugerida)) {
    return errorResultado(409, 'La fecha sugerida supera el rango de fechas permitido.');
  }
  return resultado(200, { facturacion_id: id, fecha_pago: requisito.fecha_sugerida,
    importe_total: requisito.importe_total, detalles: detalles.map(({ liquidada, ...d }) => d) });
});

// Céntimos exactos para comparar las cadenas validadas; no hay redondeo de entrada.
const centimos = (importe) => {
  const [entero, decimal = ''] = importe.split('.');
  return BigInt(entero) * 100n + BigInt(decimal.padEnd(2, '0'));
};

export const confirmarLiquidacion = async (id, datos) => enTransaccion(async (client) => {
  const contexto = await comprobarLiquidacion(client, id);
  if (contexto.estadoHttp) return contexto;
  const existentes = contexto.detalles;
  const ids = new Set(datos.detalles.map((d) => d.participacion_facturacion_id));
  if (datos.detalles.length !== existentes.length || ids.size !== existentes.length
    || existentes.some((p) => !ids.has(p.participacion_facturacion_id))) {
    return errorResultado(409, 'La liquidación debe incluir exactamente una vez cada participación de esta facturación.');
  }
  for (const d of datos.detalles) {
    const p = existentes.find((p) => p.participacion_facturacion_id === d.participacion_facturacion_id);
    if (centimos(p.importe) !== centimos(d.importe)) return errorResultado(409, 'Cada participación debe liquidarse por su importe completo.');
    if (p.soe !== d.soe) return errorResultado(409, 'El SOE debe identificar el establecimiento de la participación.');
  }
  // Guarda los datos revisados de C/cuenta; el catálogo solo propone, no los reemplaza.
  await insertarPago(client, id, datos);
  return resultado(201, await consultarPago(client, id));
});

export const consultarLiquidacion = async (id) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const cabecera = await cabeceraPorId(client, id);
    const pago = cabecera ? await consultarPago(client, id) : null;
    const respuesta = !cabecera ? errorResultado(404, 'Facturación no encontrada.')
      : pago ? resultado(200, pago) : errorResultado(404, 'Liquidación confirmada no encontrada.');
    await client.query('COMMIT');
    return respuesta;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};

const mesesVaciosInforme = () => Array(12).fill(0n);
const monedaInforme = (valor) => `${valor / 100n}.${String(valor % 100n).padStart(2, '0')}`;
const resumenInforme = (meses, detalleMensual) => ({
  total_anual: monedaInforme(meses.reduce((total, importe) => total + importe, 0n)),
  trimestres: Array.from({ length: 4 }, (_, i) => ({
    trimestre: i + 1,
    importe_total: monedaInforme(meses.slice(i * 3, i * 3 + 3).reduce((total, importe) => total + importe, 0n)),
    ...(detalleMensual ? { meses: meses.slice(i * 3, i * 3 + 3)
      .map((importe, j) => ({ mes: i * 3 + j + 1, importe_total: monedaInforme(importe) })) } : {}),
  })),
});

export const consultarInformeAnual = async ({ anio, ayuntamiento_id, detalle_mensual }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    if (ayuntamiento_id && !(await client.query('SELECT id FROM ayuntamiento WHERE id=$1', [ayuntamiento_id])).rowCount) {
      await client.query('ROLLBACK');
      return errorResultado(404, 'Ayuntamiento no encontrado.');
    }
    const filas = await actividadInformeAnual(client, anio, ayuntamiento_id);
    const pendientes = await reaperturasInformeAnual(client, anio, ayuntamiento_id);
    await client.query('COMMIT');
    const meses = mesesVaciosInforme(), municipios = new Map();
    for (const fila of filas) {
      let municipio = municipios.get(fila.ayuntamiento_id);
      if (!municipio) {
        municipio = { ayuntamiento_id: fila.ayuntamiento_id, denominacion: fila.ayuntamiento,
          meses: mesesVaciosInforme(), farmacias: new Map() };
        municipios.set(fila.ayuntamiento_id, municipio);
      }
      let farmacia = municipio.farmacias.get(fila.farmacia_id);
      if (!farmacia) {
        farmacia = { farmacia_id: fila.farmacia_id, identidades_b: [], meses: mesesVaciosInforme() };
        municipio.farmacias.set(fila.farmacia_id, farmacia);
      }
      const identidad = { soe_b: fila.soe_b, denominacion_b: fila.denominacion_b, cif_b: fila.cif_b };
      if (!farmacia.identidades_b.some((b) => b.soe_b === identidad.soe_b
        && b.denominacion_b === identidad.denominacion_b && b.cif_b === identidad.cif_b)) farmacia.identidades_b.push(identidad);
      const importe = centimos(fila.importe), mes = fila.mes - 1;
      meses[mes] += importe; municipio.meses[mes] += importe; farmacia.meses[mes] += importe;
    }
    return resultado(200, { anio, detalle_mensual, ...resumenInforme(meses, detalle_mensual),
      ayuntamientos: [...municipios.values()].map((m) => ({ ayuntamiento_id: m.ayuntamiento_id,
        denominacion: m.denominacion, ...resumenInforme(m.meses, detalle_mensual),
        farmacias: [...m.farmacias.values()].map((f) => ({ farmacia_id: f.farmacia_id,
          identidades_b: f.identidades_b, ...resumenInforme(f.meses, detalle_mensual) })) })),
      ...(pendientes.length ? { advertencia: 'Hay facturaciones reabiertas excluidas temporalmente hasta su reemisión.',
        facturaciones_pendientes: pendientes } : {}),
    });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};
