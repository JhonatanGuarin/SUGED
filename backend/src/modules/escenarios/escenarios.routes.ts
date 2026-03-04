import { Router } from 'express';
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
router.post('/', crearNuevoEscenario);
router.post('/:id/horarios', asignarHorario);
router.post('/:id/bloqueos', registrarBloqueo);
router.put('/:id', editarEscenario);
router.delete('/:id', borrarEscenario);
router.delete('/bloqueos/:id', eliminarBloqueo);

export default router;