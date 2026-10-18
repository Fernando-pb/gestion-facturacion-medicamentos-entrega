import { calculoSchema, participacionBSchema, facturacionIdSchema, participacionIdSchema, reaperturaSchema, emisionSchema, cobroSchema, preparacionLiquidacionSchema, confirmacionLiquidacionSchema } from './facturacion.validation.js';
import { calcularFacturacion, consultarFacturacionRevision, corregirParticipacionB, reabrirFacturacion, emitirFacturacion, registrarCobro, prepararLiquidacion, confirmarLiquidacion, consultarLiquidacion, previsualizarFacturacion } from './facturacion.service.js';
import { generarExcelLiquidacion } from './liquidacion.excel.js';
import { informeAnualSchema } from './facturacion.validation.js';
import { consultarInformeAnual } from './facturacion.service.js';
import { generarExcelInformeAnual } from './informe-anual.excel.js';
import { busquedaFacturacionSchema } from './facturacion.validation.js';
import { buscarFacturacion } from './facturacion.service.js';
import { consultarListadoEmitidas, consultarPendientes } from './facturacion.service.js';

export const listarPendientes = async (req, res, next) => {
  if (Object.keys(req.query).length || req.body !== undefined) return res.status(400).json({ error: 'Consulta de pendientes no válida.' });
  try {
    const r = await consultarPendientes();
    return res.status(r.estadoHttp).json(r.datos);
  } catch (error) { return next(error); }
};

export const listarEmitidas = async (req, res, next) => {
  if (Object.keys(req.query).length || req.body !== undefined) return res.status(400).json({ error: 'Consulta del listado no válida.' });
  try {
    const r = await consultarListadoEmitidas();
    return res.status(r.estadoHttp).json(r.datos);
  } catch (error) { return next(error); }
};

export const buscar = async (req, res, next) => {
  const consulta = busquedaFacturacionSchema.safeParse(req.query);
  if (!consulta.success) return res.status(400).json({ error: 'Selecciona un Ayuntamiento y periodo válidos.' });
  try {
    const r = await buscarFacturacion(consulta.data);
    return res.status(r.estadoHttp).json(r.datos);
  } catch (error) { return next(error); }
};

export const exportarInformeAnual = async (req, res, next) => {
  const consulta = informeAnualSchema.safeParse(req.query);
  if (!consulta.success) return res.status(400).json({ error: 'Año o filtros del informe anual no válidos.' });
  try {
    const r = await consultarInformeAnual(consulta.data);
    if (r.estadoHttp !== 200) return res.status(r.estadoHttp).json(r.datos);
    return res.set('Content-Disposition', `attachment; filename="informe-anual-${r.datos.anio}.xml"`)
      .type('application/xml').send(generarExcelInformeAnual(r.datos));
  } catch (error) { return next(error); }
};

export const informeAnual = async (req, res, next) => {
  const consulta = informeAnualSchema.safeParse(req.query);
  if (!consulta.success) return res.status(400).json({ error: 'Año o filtros del informe anual no válidos.' });
  try {
    const r = await consultarInformeAnual(consulta.data);
    return res.status(r.estadoHttp).json(r.datos);
  } catch (error) { return next(error); }
};

export const prepararPago = async (req, res, next) => {
  const id = facturacionIdSchema.safeParse(req.params.id);
  if (!id.success || !preparacionLiquidacionSchema.safeParse(req.body).success || Object.keys(req.query).length) {
    return res.status(400).json({ error: 'Datos de preparación no válidos.' });
  }
  try {
    const r = await prepararLiquidacion(id.data);
    return res.status(r.estadoHttp).json(r.datos);
  } catch (error) { return next(error); }
};

export const confirmarPago = async (req, res, next) => {
  const id = facturacionIdSchema.safeParse(req.params.id);
  const datos = confirmacionLiquidacionSchema.safeParse(req.body);
  if (!id.success || !datos.success || Object.keys(req.query).length) {
    return res.status(400).json({ error: 'Datos de liquidación, fecha o cuenta bancaria no válidos.' });
  }
  try {
    const r = await confirmarLiquidacion(id.data, datos.data);
    return res.status(r.estadoHttp).json(r.datos);
  } catch (error) { return next(error); }
};

export const consultarPago = async (req, res, next) => {
  const id = facturacionIdSchema.safeParse(req.params.id);
  if (!id.success || Object.keys(req.query).length) return res.status(400).json({ error: 'Consulta de liquidación no válida.' });
  try {
    const r = await consultarLiquidacion(id.data);
    return res.status(r.estadoHttp).json(r.datos);
  } catch (error) { return next(error); }
};

export const exportarPago = async (req, res, next) => {
  const id = facturacionIdSchema.safeParse(req.params.id);
  if (!id.success || Object.keys(req.query).length) return res.status(400).json({ error: 'Consulta de liquidación no válida.' });
  try {
    const r = await consultarLiquidacion(id.data);
    if (r.estadoHttp !== 200) return res.status(r.estadoHttp).json(r.datos);
    if (!r.datos.cuadra) return res.status(409).json({ error: 'El total de la liquidación no cuadra con PRECINTOS.' });
    const datos = { fecha_pago: r.datos.fecha_pago, detalles: r.datos.detalles.map(({ id, ...d }) => d) };
    if (!confirmacionLiquidacionSchema.safeParse(datos).success) {
      return res.status(409).json({ error: 'Los datos históricos de liquidación no permiten preparar el archivo.' });
    }
    return res.set('Content-Disposition', `attachment; filename="liquidacion-${id.data}.xml"`)
      .type('application/xml').send(generarExcelLiquidacion(r.datos));
  } catch (error) { return next(error); }
};

export const cobrar = async (req, res, next) => {
  const id = facturacionIdSchema.safeParse(req.params.id);
  const facturaId = facturacionIdSchema.safeParse(req.params.facturaId);
  const datos = cobroSchema.safeParse(req.body);
  if (!id.success || !facturaId.success || !datos.success || Object.keys(req.query).length) {
    return res.status(400).json({ error: 'Identificadores o datos de cobro no válidos.' });
  }
  try {
    const r = await registrarCobro(id.data, facturaId.data, datos.data);
    return res.status(r.estadoHttp).json(r.datos);
  } catch (error) { return next(error); }
};

export const emitir = async (req, res, next) => {
  const id = facturacionIdSchema.safeParse(req.params.id);
  const datos = emisionSchema.safeParse(req.body);
  if (!id.success || !datos.success || Object.keys(req.query).length) return res.status(400).json({ error: 'Identificador o datos de emisión no válidos.' });
  try {
    const r = await emitirFacturacion(id.data, datos.data);
    return res.status(r.estadoHttp).json(r.datos);
  } catch (error) { return next(error); }
};

export const previsualizar = async (req, res, next) => {
  const id = facturacionIdSchema.safeParse(req.params.id);
  if (!id.success || Object.keys(req.query).length || req.body !== undefined) {
    return res.status(400).json({ error: 'Consulta de previsualización no válida.' });
  }
  try {
    const r = await previsualizarFacturacion(id.data);
    return res.status(r.estadoHttp).json(r.datos);
  } catch (error) { return next(error); }
};

export const calcular = async (req, res, next) => {
  const datos = calculoSchema.safeParse(req.body);
  if (!datos.success || Object.keys(req.query).length) return res.status(400).json({ error: 'Datos de cálculo no válidos.' });
  try {
    const r = await calcularFacturacion(datos.data);
    return res.status(r.estadoHttp).json(r.datos);
  } catch (error) { return next(error); }
};

export const consultar = async (req, res, next) => {
  const id = facturacionIdSchema.safeParse(req.params.id);
  if (!id.success || Object.keys(req.query).length) return res.status(400).json({ error: 'Consulta de facturación no válida.' });
  try {
    const r = await consultarFacturacionRevision(id.data);
    return res.status(r.estadoHttp).json(r.datos);
  } catch (error) { return next(error); }
};

export const corregirB = async (req, res, next) => {
  const id = facturacionIdSchema.safeParse(req.params.id);
  const participacion = participacionIdSchema.safeParse(req.params.participacionId);
  const datos = participacionBSchema.safeParse(req.body);
  if (!id.success || !participacion.success || !datos.success || Object.keys(req.query).length) {
    return res.status(400).json({ error: 'Identificador o datos de B no válidos.' });
  }
  try {
    const r = await corregirParticipacionB(id.data, participacion.data, datos.data);
    return res.status(r.estadoHttp).json(r.datos);
  } catch (error) { return next(error); }
};

export const reabrirRevision = async (req, res, next) => {
  const id = facturacionIdSchema.safeParse(req.params.id);
  const datos = reaperturaSchema.safeParse(req.body);
  if (!id.success || !datos.success || Object.keys(req.query).length) return res.status(400).json({ error: 'Identificador o motivo de reapertura no válido.' });
  try {
    const r = await reabrirFacturacion(id.data, datos.data.motivo);
    return res.status(r.estadoHttp).json(r.datos);
  } catch (error) { return next(error); }
};
