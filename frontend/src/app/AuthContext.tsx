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
    if (sesionActual) {
      // Modificamos el select para incluir los nuevos campos
      const { data } = await supabase
        .from('usuarios')
        .select('nombre_completo, rol, avatar_url, documento, codigo, carrera')
        .eq('id', sesionActual.user.id)
        .single();
      
      setPerfil(data);
    } else {
      setPerfil(null);
    }
    setCargando(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      cargarDatosUsuario(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nuevaSesion) => {
      setSession(nuevaSesion);
      cargarDatosUsuario(nuevaSesion);
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