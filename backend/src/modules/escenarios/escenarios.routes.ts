import { Router } from 'express';
import { verificarToken, requerirAdmin } from '../../middlewares/auth.middleware.js';
import { 
  getDisponibilidad, 
  crearNuevoEscenario, 
  asignarHorario, 
  registrarBloqueo,
  editarEscenario,
  borrarEscenario,
  eliminarBloqueo,
  registrarBloqueoRecurrente,
  eliminarBloqueoRecurrente,
  getReservaActual
} from './escenarios.controller.js';

const router = Router();

// Consultar disponibilidad (Calculada matemáticamente)
router.get('/:id/disponibilidad', getDisponibilidad);
router.get('/:id/reserva-actual', getReservaActual);

// Rutas administrativas
router.post('/',verificarToken, requerirAdmin, crearNuevoEscenario);
router.post('/:id/horarios', verificarToken, requerirAdmin, asignarHorario);
router.post('/:id/bloqueos', verificarToken, requerirAdmin, registrarBloqueo);
router.put('/:id', verificarToken, requerirAdmin, editarEscenario);
router.delete('/:id', verificarToken, requerirAdmin, borrarEscenario);
router.delete('/bloqueos/:id', verificarToken, requerirAdmin, eliminarBloqueo);

//RUTAS PARA BLOQUEOS RECURRENTES
router.post('/:id/bloqueos-recurrentes', verificarToken, requerirAdmin, registrarBloqueoRecurrente);
router.delete('/bloqueos-recurrentes/:id', verificarToken, requerirAdmin, eliminarBloqueoRecurrente);

export default router;