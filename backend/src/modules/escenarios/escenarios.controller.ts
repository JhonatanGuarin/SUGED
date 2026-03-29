import type { Request, Response } from 'express';
import { 
  obtenerBloquesDisponibles, 
  crearEscenarioBase, 
  crearHorario, 
  crearBloqueo,
  actualizarEscenarioBase,
  eliminarEscenarioBase,
  eliminarBloqueoBase,
  crearBloqueoRecurrente,
  eliminarBloqueoRecurrenteBase,
  obtenerReservaActual
} from './escenarios.service.js';

export const getDisponibilidad = async (req: Request, res: Response): Promise<any> => {
  try {
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
    const escenarioId = req.params.id as string;
    const horario = await crearHorario(escenarioId, req.body);
    return res.status(201).json(horario);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
};

export const registrarBloqueo = async (req: Request, res: Response): Promise<any> => {
  try {
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

export const eliminarBloqueo = async (req: Request, res: Response): Promise<any> => {
  try {
    const bloqueoId = req.params.id as string; 
    await eliminarBloqueoBase(bloqueoId);
    return res.status(200).json({ message: 'Bloqueo eliminado correctamente' });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
};

// --- NUEVOS CONTROLADORES PARA BLOQUEOS RECURRENTES ---

export const registrarBloqueoRecurrente = async (req: Request, res: Response): Promise<any> => {
  try {
    const escenarioId = req.params.id as string;
    const bloqueoFijo = await crearBloqueoRecurrente(escenarioId, req.body);
    return res.status(201).json(bloqueoFijo);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
};

export const eliminarBloqueoRecurrente = async (req: Request, res: Response): Promise<any> => {
  try {
    const bloqueoId = req.params.id as string; 
    await eliminarBloqueoRecurrenteBase(bloqueoId);
    return res.status(200).json({ message: 'Bloqueo fijo eliminado correctamente' });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
};

export const getReservaActual = async (req: Request, res: Response): Promise<any> => {
  try {
    const escenarioId = req.params.id as string;
    const reserva = await obtenerReservaActual(escenarioId);
    return res.json({ reserva });
  } catch (error: any) {
    console.error('Error en getReservaActual:', error);
    return res.status(500).json({ error: 'Error interno buscando reserva actual' });
  }
};