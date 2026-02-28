import { supabase } from '../../app/supabase';
import { MapPin, Calendar, ShieldCheck } from 'lucide-react';

export default function Login() {
  
  const iniciarSesionConGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin 
      }
    });

    if (error) {
      console.error('Hubo un error al iniciar sesión:', error.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white font-sans">
      
      {/* PANEL DE MARCA (Izquierda en PC, Arriba en Móvil) */}
      <div className="lg:w-5/12 bg-[#1A1A1A] text-white flex flex-col justify-center p-8 md:p-16 relative overflow-hidden">
        {/* Decoración de fondo sutil */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FFCC29] opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

        <div className="relative z-10 max-w-md mx-auto w-full">
          {/* Logo */}
          <div className="w-16 h-16 bg-[#FFCC29] rounded-2xl flex items-center justify-center font-black text-[#1A1A1A] text-4xl shadow-lg shadow-[#FFCC29]/20 mb-8">
            S
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black mb-2 text-white tracking-tight">
            SUGED
          </h1>
          <p className="text-[#FFCC29] tracking-[0.2em] uppercase text-sm font-bold mb-10">
            UPTC Deportes
          </p>
          
          <p className="text-slate-400 text-lg mb-12 leading-relaxed">
            El sistema oficial para la gestión, reserva y control de escenarios deportivos de la universidad.
          </p>

          {/* Características de la plataforma */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#FFCC29] shrink-0">
                <MapPin size={24} />
              </div>
              <div>
                <h3 className="font-bold text-white">Espacios Múltiples</h3>
                <p className="text-sm text-slate-400">Canchas, coliseos y pistas a tu disposición.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#FFCC29] shrink-0">
                <Calendar size={24} />
              </div>
              <div>
                <h3 className="font-bold text-white">Disponibilidad Real</h3>
                <p className="text-sm text-slate-400">Horarios matemáticamente calculados y precisos.</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#FFCC29] shrink-0">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="font-bold text-white">Acceso Seguro</h3>
                <p className="text-sm text-slate-400">Ingreso exclusivo con tu correo institucional.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL DE LOGIN (Derecha en PC, Abajo en Móvil) */}
      <div className="lg:w-7/12 flex-1 flex flex-col items-center justify-center p-8 md:p-16 bg-slate-50 relative">
        <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-3xl shadow-xl border border-slate-100/60 text-center">
          
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#1A1A1A] mb-2">
            Bienvenido de vuelta
          </h2>
          <p className="text-slate-500 text-sm md:text-base mb-10">
            Inicia sesión para empezar a gestionar tus reservas deportivas.
          </p>
          
          <button
            onClick={iniciarSesionConGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 text-[#1A1A1A] px-6 py-4 rounded-xl hover:bg-slate-50 hover:border-[#FFCC29] hover:shadow-md transition-all duration-300 font-bold text-lg group"
          >
            <img 
              src="https://www.svgrepo.com/show/475656/google-color.svg" 
              alt="Google Logo" 
              className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" 
            />
            Continuar con Google
          </button>

          <div className="mt-10 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 leading-relaxed">
              Al iniciar sesión, aceptas usar la plataforma de acuerdo con los reglamentos de la universidad y las políticas de uso de los escenarios deportivos.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}