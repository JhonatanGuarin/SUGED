import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface PerfilUsuario {
  nombre_completo: string;
  rol: 'ADMIN' | 'MEMBER_UPTC' | 'EXTERNAL';
  avatar_url: string;
  documento: string | null;
  codigo: string | null;
  carrera: string | null;
  telefono: string | null;
}

interface AuthState {
  session: Session | null;
  perfil: PerfilUsuario | null;
  cargando: boolean; 
  cerrarSesion: () => Promise<void>;
  recargarPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargarDatosUsuario = async (sesionActual: Session | null) => {
    // Si la sesión es nula, limpiamos todo inmediatamente
    if (!sesionActual) {
      setPerfil(null);
      setCargando(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('nombre_completo, rol, avatar_url, documento, codigo, carrera, telefono')
        .eq('id', sesionActual.user.id)
        .single();
      
      if (error) throw error;
      setPerfil(data);
    } catch (error) {
      console.error("Error cargando perfil del usuario:", error);
      // Si falla la consulta del perfil (ej. token inválido), limpiamos por seguridad
      setPerfil(null);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    // 1. Carga Inicial Segura
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        supabase.auth.signOut();
        setSession(null);
        cargarDatosUsuario(null);
      } else {
        setSession(session);
        cargarDatosUsuario(session);
      }
    });

    // 2. Escuchador de Eventos de Autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nuevaSesion) => {
      if (event === 'SIGNED_OUT') {
        // Cuando el Interceptor dispara el signOut, este evento lo escucha y limpia la UI
        setSession(null);
        setPerfil(null);
        setCargando(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(nuevaSesion);
        cargarDatosUsuario(nuevaSesion);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
  };

  const recargarPerfil = async () => {
    await cargarDatosUsuario(session);
  };

  return (
    <AuthContext.Provider value={{ session, perfil, cargando, cerrarSesion, recargarPerfil }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}