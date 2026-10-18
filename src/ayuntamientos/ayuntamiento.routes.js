import { Router } from 'express';

import {
  actualizarAyuntamiento,
  crearAyuntamiento,
  listarAyuntamientos,
  obtenerAyuntamiento,
} from './ayuntamiento.controller.js';
import {
  asignarFarmacia, buscarFarmacias, consultarFarmaciasAsociadas, quitarFarmacia,
} from './ayuntamiento-farmacia.controller.js';

import {
  asociarMedicamento, consultarMedicamentosAdmitidos, quitarMedicamento,
} from './ayuntamiento-medicamento.controller.js';

const router = Router();

router.post('/', crearAyuntamiento);
router.get('/', listarAyuntamientos);
router.get('/:id', obtenerAyuntamiento);
router.put('/:id', actualizarAyuntamiento);
router.post('/:id/farmacias', asignarFarmacia);
router.get('/:id/farmacias', consultarFarmaciasAsociadas);
router.get('/:id/farmacias/busqueda', buscarFarmacias);
router.delete('/:id/farmacias/:farmaciaId', quitarFarmacia);

router.get('/:id/medicamentos', consultarMedicamentosAdmitidos);
router.post('/:id/medicamentos', asociarMedicamento);
router.delete('/:id/medicamentos/:medicamentoId', quitarMedicamento);

export default router;
