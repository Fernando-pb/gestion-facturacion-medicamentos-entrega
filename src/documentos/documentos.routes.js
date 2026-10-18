import express, { Router } from 'express';
import { documentos, configuracion, guardar } from './documentos.controller.js';

export const documentosRouter = Router();
documentosRouter.get('/:id/documentos', documentos);
export const configuracionRouter = Router();
configuracionRouter.use(express.json({limit:'1500kb'}));
configuracionRouter.get('/', configuracion);
configuracionRouter.put('/', guardar);
configuracionRouter.use((e,req,res,next)=>e.type==='entity.too.large' ? res.status(413).json({error:'El logo supera el tamaño permitido.'}) : next(e));
