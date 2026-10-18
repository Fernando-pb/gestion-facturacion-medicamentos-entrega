import {Router} from 'express';
import {listar,guardar} from './configuracion.controller.js';
const router=Router();
router.get('/',listar);router.post('/',guardar);router.put('/:id',guardar);
export default router;
