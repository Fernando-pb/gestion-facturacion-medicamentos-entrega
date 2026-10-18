import { Router } from 'express';

import {
  actualizarFarmacia,
  crearFarmacia,
  listarFarmacias,
  obtenerFarmacia,
  buscarFarmacias,
} from './farmacia.controller.js';

const router = Router();

router.post('/', crearFarmacia);
router.get('/', listarFarmacias);
router.get('/busqueda', buscarFarmacias);
router.get('/:id', obtenerFarmacia);
router.put('/:id', actualizarFarmacia);

export default router;
