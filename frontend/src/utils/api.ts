import { supabase } from '../app/supabase'; 

// Aquí se define la URL de tu backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const fetchAPI = async (endpoint: string, options: RequestInit = {}) => {
  // 1. Pedimos la sesión actual. Si el token está por expirar, Supabase intenta refrescarlo aquí automáticamente.
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  // Si Supabase detecta que el Refresh Token también murió, matamos la sesión inmediatamente
  if (sessionError) {
    await supabase.auth.signOut();
    window.location.href = '/';
    throw new Error('Tu sesión ha expirado. Inicia sesión nuevamente.');
  }

  // 2. Preparamos los Headers
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // 3. Inyectamos el JWT 
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  // 4. Ejecutamos el fetch real
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    console.warn("Token rechazado por el servidor. Forzando cierre de sesión...");
    await supabase.auth.signOut(); // Limpiamos el caché del navegador
    window.location.href = '/';    // Recargamos la página para volver al Login
    throw new Error('Sesión expirada por inactividad.');
  }

  return response;
};