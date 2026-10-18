import { Router } from 'express';
import { calcular, consultar, corregirB, reabrirRevision, emitir, cobrar,
  prepararPago, confirmarPago, consultarPago, exportarPago, informeAnual, exportarInformeAnual, previsualizar, buscar, listarEmitidas, listarPendientes } from './facturacion.controller.js';

const router = Router();
router.post('/calculo', calcular);
router.get('/busqueda', buscar);
router.get('/emitidas', listarEmitidas);
router.get('/pendientes', listarPendientes);
router.get('/informe-anual', informeAnual);
router.get('/informe-anual/excel', exportarInformeAnual);
router.get('/:id', consultar);
router.get('/:id/previsualizacion', previsualizar);
router.put('/:id/participaciones/:participacionId/b', corregirB);
router.post('/:id/reapertura', reabrirRevision);
router.post('/:id/emision', emitir);
router.post('/:id/facturas/:facturaId/cobro', cobrar);
router.post('/:id/liquidacion/preparacion', prepararPago);
router.post('/:id/liquidacion/confirmacion', confirmarPago);
router.get('/:id/liquidacion', consultarPago);
router.get('/:id/liquidacion/contabilidad', exportarPago);
export default router;
