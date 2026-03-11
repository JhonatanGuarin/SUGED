import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../core/supabase.js'; 

// Extendemos la interfaz Request de Express para que acepte nuestra variable "user"
export interface AuthRequest extends Request {
  user?: any;
}

// 1. Verifica que el JWT sea válido
export const verificarToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Acceso denegado: Token no proporcionado o formato inválido.' });
      return;
    }

    // Extraemos solo el token 
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

    req.user = { ...user, perfil: perfilUsuario };
    
    next();
  } catch (err) {
    console.error('Error en middleware de autenticación:', err);
    res.status(500).json({ error: 'Error interno en el servidor.' });
  }
};

// 2. Verifica que el usuario sea ADMIN
export const requerirAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {

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