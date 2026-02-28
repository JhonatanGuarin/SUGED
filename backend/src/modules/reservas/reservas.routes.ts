import { Router } from 'express';
import { crearNuevaReserva, cambiarEstadoReserva } from './reservas.controller.js';

const router = Router();

router.post('/', crearNuevaReserva);
router.patch('/:id/estado', cambiarEstadoReserva); 

export default router;