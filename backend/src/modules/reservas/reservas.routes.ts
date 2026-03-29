import { Router } from 'express';
import { crearNuevaReserva, cambiarEstadoReserva } from './reservas.controller.js';
import { verificarToken, requerirMiembroUPTC, requerirAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();

//Solo usuarios logueados que sean de la UPTC (o ADMIN) pueden crear
router.post('/', verificarToken, requerirMiembroUPTC, crearNuevaReserva);

//Solo usuarios logueados que sean ADMIN pueden aprobar/rechazar
router.patch('/:id/estado', verificarToken, requerirAdmin, cambiarEstadoReserva); 

export default router;