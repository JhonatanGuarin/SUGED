import type { Request, Response } from 'express';
import { 
  obtenerBloquesDisponibles, 
  crearEscenarioBase, 
  crearHorario, 
  crearBloqueo,
  actualizarEscenarioBase,
  eliminarEscenarioBase
} from './escenarios.service.js';

export const getDisponibilidad = async (req: Request, res: Response): Promise<any> => {
  try {
    // Le aseguramos a TypeScript que ambos valores serán tratados como texto (string)
    const escenarioId = req.params.id as string;
    const fecha = req.query.fecha as string;

    if (!fecha) {
      return res.status(400).json({ error: 'Debes enviar una fecha (?fecha=YYYY-MM-DD)' });
    }

    const libres = await obtenerBloquesDisponibles(escenarioId, fecha);
    return res.json({ libres });

  } catch (error: any) {
    console.error('Error en getDisponibilidad:', error);
    return res.status(500).json({ error: 'Error interno calculando disponibilidad' });
  }
};

export const crearNuevoEscenario = async (req: Request, res: Response): Promise<any> => {
  try {
    const escenario = await crearEscenarioBase(req.body);
    return res.status(201).json(escenario);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
};

export const asignarHorario = async (req: Request, res: Response): Promise<any> => {
  try {
    // Forzamos el tipado del ID de la URL
    const escenarioId = req.params.id as string;
    
    const horario = await crearHorario(escenarioId, req.body);
    return res.status(201).json(horario);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
};

export const registrarBloqueo = async (req: Request, res: Response): Promise<any> => {
  try {
    // Forzamos el tipado del ID de la URL
    const escenarioId = req.params.id as string;
    
    const bloqueo = await crearBloqueo(escenarioId, req.body);
    return res.status(201).json(bloqueo);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
};

export const editarEscenario = async (req: Request, res: Response): Promise<any> => {
  try {
    const escenarioId = req.params.id as string;
    const escenario = await actualizarEscenarioBase(escenarioId, req.body);
    return res.status(200).json(escenario);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
};

export const borrarEscenario = async (req: Request, res: Response): Promise<any> => {
  try {
    const escenarioId = req.params.id as string;
    await eliminarEscenarioBase(escenarioId);
    return res.status(200).json({ mensaje: 'Escenario eliminado' });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
};