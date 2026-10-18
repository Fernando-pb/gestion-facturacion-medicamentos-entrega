import { Router } from 'express';

import {
  actualizarMedicamento,
  crearMedicamento,
  listarMedicamentos,
  obtenerMedicamento,
} from './medicamento.controller.js';

const router = Router();

router.post('/', crearMedicamento);
router.get('/', listarMedicamentos);
router.get('/:id', obtenerMedicamento);
router.put('/:id', actualizarMedicamento);

export default router;
