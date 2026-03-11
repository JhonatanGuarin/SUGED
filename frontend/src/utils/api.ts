import { supabase } from '../app/supabase'; 

// Aquí se define la URL de tu backend. Luego la cambiaremos por la de tu VPS.
const API_BASE_URL = 'http://localhost:3000';

export const fetchAPI = async (endpoint: string, options: RequestInit = {}) => {
  // 1. Obtenemos la sesión actual directamente de Supabase
  const { data: { session } } = await supabase.auth.getSession();
  
  // 2. Preparamos los Headers
  const headers = new Headers(options.headers || {});
  
  // Siempre enviamos y recibimos JSON por defecto
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // 3. Si hay una sesión activa, inyectamos el JWT en la cabecera Authorization
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  // 4. Ejecutamos el fetch real combinando la URL base y el endpoint
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers
  });

  return response;
};