import { Router } from 'express';
import { crearORecuperarEntrega, recuperarEntrega, actualizarDeclarados, evaluarCodigoEntrega, consultarPeriodosEntrega, consultarEntregasRegistradas } from './entrega.controller.js';
import { registrarLectura, recuperarOperacionLectura, consultarLecturas, eliminarLectura } from './lectura.controller.js';
import { consultarPrecios, actualizarPrecio } from './precio.controller.js';

const router = Router();
router.get('/periodos', consultarPeriodosEntrega);
router.get('/registradas', consultarEntregasRegistradas);
router.post('/', crearORecuperarEntrega);
router.post('/:id/evaluacion', evaluarCodigoEntrega);
router.post('/:id/lecturas', registrarLectura);
router.get('/:id/operaciones/:clave', recuperarOperacionLectura);
router.get('/:id/precintos', consultarLecturas('precintos'));
router.get('/:id/incidencias', consultarLecturas('incidencias'));
router.get('/:id/resumen', consultarLecturas('resumen'));
router.get('/:id/precios', consultarPrecios);
router.put('/:id/precintos/:lecturaId/precio', actualizarPrecio);
router.delete('/:id/precintos/:lecturaId', eliminarLectura('precintos'));
router.delete('/:id/incidencias/:lecturaId', eliminarLectura('incidencias'));
router.get('/', recuperarEntrega);
router.put('/:id/declarados', actualizarDeclarados);

export default router;
