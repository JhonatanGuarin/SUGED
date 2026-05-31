import { Router } from 'express';
import { crearNuevaReserva, cambiarEstadoReserva, unirseEquipo, descargarReporteExcel } from './reservas.controller.js';
import { verificarToken, requerirMiembroUPTC, requerirAdmin } from '../../middlewares/auth.middleware.js';


const router = Router();


// 2. AGREGA ESTA RUTA NUEVA (Solo los ADMIN podrán descargar este archivo)
router.get('/reporte/excel', verificarToken, requerirAdmin, descargarReporteExcel);

//Solo usuarios logueados que sean de la UPTC (o ADMIN) pueden crear
router.post('/', verificarToken, requerirMiembroUPTC, crearNuevaReserva);

//Solo usuarios logueados que sean ADMIN pueden aprobar/rechazar
router.patch('/:id/estado', verificarToken, cambiarEstadoReserva); 

router.post('/:id/unirse', verificarToken, requerirMiembroUPTC, unirseEquipo);

export default router;