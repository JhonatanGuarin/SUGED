import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

// 1. Definimos qué forma tiene nuestro perfil y nuestro contexto
interface PerfilUsuario {
  nombre_completo: string;
  rol: 'ADMIN' | 'MEMBER_UPTC' | 'EXTERNAL';
  avatar_url: string;
}

interface AuthState {
  session: Session | null;
  perfil: PerfilUsuario | null;
  cargando: boolean; 
  cerrarSesion: () => Promise<void>;
}

// 2. Creamos el Contexto en blanco
const AuthContext = createContext<AuthState | undefined>(undefined);

// 3. Creamos el "Proveedor" (El componente que envolverá a toda la app)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Esta función va a Supabase por la sesión y el perfil de un solo golpe
    const cargarDatosUsuario = async (sesionActual: Session | null) => {
      if (sesionActual) {
        const { data } = await supabase
          .from('usuarios')
          .select('nombre_completo, rol, avatar_url')
          .eq('id', sesionActual.user.id)
          .single();
        
        setPerfil(data);
      } else {
        setPerfil(null);
      }
      setCargando(false);
    };

    // Al arrancar, verificamos si ya hay sesión
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      cargarDatosUsuario(session);
    });

    // Nos quedamos escuchando si el usuario inicia o cierra sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nuevaSesion) => {
      setSession(nuevaSesion);
      cargarDatosUsuario(nuevaSesion);
    });

    return () => subscription.unsubscribe();
  }, []);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
  };

  // 4. Repartimos los datos a todos los "hijos" (nuestras pantallas)
  return (
    <AuthContext.Provider value={{ session, perfil, cargando, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

// 5. Creamos un "Hook" personalizado para usarlo fácilmente en cualquier pantalla
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}