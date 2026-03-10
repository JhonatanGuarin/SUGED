import type { Request, Response, NextFunction } from 'express';
// Asegúrate de importar tu cliente de Supabase (ajusta la ruta según tu proyecto)
import { supabaseAdmin } from '../core/supabase.js'; 

// Extendemos la interfaz Request de Express para que acepte nuestra variable "user"
export interface AuthRequest extends Request {
  user?: any;
}

// 1. EL GUARDIA PRINCIPAL: Verifica que el JWT sea válido
export const verificarToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Buscamos el token en la mochila de la petición (Headers)
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Acceso denegado: Token no proporcionado o formato inválido.' });
      return;
    }

    // Extraemos solo el token (quitamos la palabra "Bearer ")
    const token = authHeader.split(' ')[1];

    // Le pedimos a Supabase que valide este token criptográficamente
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'Acceso denegado: Token inválido, manipulado o expirado.' });
      return;
    }

    // Como el token es válido, traemos el rol del usuario desde tu tabla "usuarios"
    const { data: perfilUsuario } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('id', user.id)
      .single();

    // Pegamos toda la información del usuario a la petición para que las siguientes funciones la usen
    req.user = { ...user, perfil: perfilUsuario };
    
    // Le abrimos la puerta para que continúe a la ruta
    next();
  } catch (err) {
    console.error('Error en middleware de autenticación:', err);
    res.status(500).json({ error: 'Error interno en el servidor.' });
  }
};

// 2. EL GUARDIA VIP: Verifica que el usuario sea ADMIN
export const requerirAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // Primero revisamos si pasó por el guardia principal
  if (!req.user || !req.user.perfil) {
    res.status(401).json({ error: 'Acceso denegado: Usuario no autenticado.' });
    return;
  }

  // Revisamos su rol
  if (req.user.perfil.rol !== 'ADMIN') {
    res.status(403).json({ error: 'Acceso prohibido: Esta acción requiere privilegios de Administrador.' });
    return;
  }

  // Si es ADMIN, lo dejamos pasar
  next();
};