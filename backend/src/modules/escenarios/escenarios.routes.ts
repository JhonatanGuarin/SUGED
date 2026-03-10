import { Router } from 'express';
import { verificarToken, requerirAdmin } from '../../middlewares/auth.middleware.js';
import { 
  getDisponibilidad, 
  crearNuevoEscenario, 
  asignarHorario, 
  registrarBloqueo,
  editarEscenario,
  borrarEscenario,
  eliminarBloqueo
} from './escenarios.controller.js';

const router = Router();

// Consultar disponibilidad (Calculada matemáticamente)
router.get('/:id/disponibilidad', getDisponibilidad);

// Rutas administrativas
router.post('/',verificarToken, requerirAdmin, crearNuevoEscenario);
router.post('/:id/horarios', asignarHorario);
router.post('/:id/bloqueos', registrarBloqueo);
router.put('/:id', editarEscenario);
router.delete('/:id', verificarToken, requerirAdmin, borrarEscenario);
router.delete('/bloqueos/:id', eliminarBloqueo);

export default router;