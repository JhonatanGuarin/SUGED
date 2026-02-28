import { createClient } from '@supabase/supabase-js';

// Usamos import.meta.env porque Vite maneja las variables de entorno de esta forma
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validamos que las variables existan para que TypeScript no se queje y para evitar errores silenciosos
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan las variables de entorno de Supabase. Revisa tu archivo .env en el frontend.');
}

// Creamos y exportamos el cliente. ¡Este es nuestro puente!
export const supabase = createClient(supabaseUrl, supabaseAnonKey);