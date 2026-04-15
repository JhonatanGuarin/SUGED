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
    // ¡CAMBIO AQUÍ! Atrapamos el parámetro recortarHora
    const { estado, recortarHora } = req.body; 
    
    const usuario = (req as any).user;

    if (usuario.perfil.rol !== 'ADMIN') {
      if (estado !== 'CANCELADA') {
        return res.status(403).json({ error: 'Acceso denegado: Los estudiantes solo pueden cancelar reservas.' });
      }
    }
    
    // ¡CAMBIO AQUÍ! Le pasamos recortarHora como cuarto parámetro
    const reserva = await actualizarEstadoReserva(reservaId, estado, usuario, recortarHora);
    return res.status(200).json(reserva);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
};