import type { Request, Response } from 'express';
import { crearReservaBase, actualizarEstadoReserva } from './reservas.service.js';


export const crearNuevaReserva = async (req: Request, res: Response): Promise<any> => {
  try {
    const reserva = await crearReservaBase(req.body);
    return res.status(201).json(reserva);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
};

export const cambiarEstadoReserva = async (req: Request, res: Response): Promise<any> => {
  try {
    const reservaId = req.params.id as string;
    const { estado } = req.body; // Recibimos si es APROBADA o RECHAZADA
    
    const reserva = await actualizarEstadoReserva(reservaId, estado);
    return res.status(200).json(reserva);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
};