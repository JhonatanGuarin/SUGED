import type { Request, Response } from 'express';
import { crearReservaBase, actualizarEstadoReserva, unirseAReserva, generarReporteExcel } from './reservas.service.js';



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

export const unirseEquipo = async (req: Request, res: Response): Promise<any> => {
  try {
    const reservaId = req.params.id as string;
    // req.user viene del middleware verificarToken
    const usuarioId = (req as any).user.id; 

    const participante = await unirseAReserva(reservaId, usuarioId);
    return res.status(201).json({ 
      mensaje: 'Te has unido al equipo con éxito', 
      participante 
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
};

export const descargarReporteExcel = async (req: Request, res: Response): Promise<any> => {
  try {
    // 1. Extraemos los parámetros de filtrado desde la URL (Query Params)
    const { fechaInicio, fechaFin, escenarioId } = req.query;

    // 2. Pedimos el archivo al servicio
    const buffer = await generarReporteExcel(
      fechaInicio as string, 
      fechaFin as string, 
      escenarioId as string
    );

    // 3. Forzamos los headers para que el navegador lo detecte como Excel
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Reporte_SUGED_Escenarios.xlsx');

    // 4. Enviamos el binario finalizando la conexión con res.end()
    return res.status(200).end(buffer);
  } catch (error: any) {
    console.error('Error generando Excel:', error);
    return res.status(500).json({ error: error.message || 'Ocurrió un error al procesar el reporte.' });
  }
};