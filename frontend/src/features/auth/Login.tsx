import { useState } from 'react';
import { supabase } from '../../app/supabase';
import { MapPin, Calendar, ShieldCheck, Info, X, Code2, Database, LayoutTemplate, Server, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
export default function Login() {
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [cargando, setCargando] = useState(false);

  const iniciarSesionConGoogle = async () => {
    setCargando(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin 
        }
      });

      if (error) throw error;
      

    } catch (error: any) {
      console.error('Error Login:', error);
      

      toast.error('No se pudo iniciar sesión', {
        description: error.message || 'Verifica tu conexión a internet e inténtalo de nuevo.',
        icon: <WifiOff size={18} />, 
        duration: 5000,
      });
      
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white font-sans relative">
      
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
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#FFCC29] shrink-0">
                <Calendar size={24} />
              </div>
              <div>
                <h3 className="font-bold text-white">Disponibilidad Real</h3>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#FFCC29] shrink-0">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="font-bold text-white">Acceso Seguro</h3>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL DE LOGIN (Derecha en PC, Abajo en Móvil) */}
      <div className="lg:w-7/12 flex-1 flex flex-col items-center justify-center p-8 md:p-16 bg-slate-50 relative">
        <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-3xl shadow-xl border border-slate-100/60 text-center relative z-10">
          
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#1A1A1A] mb-2">
            Bienvenido de vuelta
          </h2>
          <p className="text-slate-500 text-sm md:text-base mb-10">
            Inicia sesión para empezar a gestionar tus reservas deportivas.
          </p>
          
          <button
            onClick={iniciarSesionConGoogle}
            disabled={cargando}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 text-[#1A1A1A] px-6 py-4 rounded-xl hover:bg-slate-50 hover:border-[#FFCC29] hover:shadow-md transition-all duration-300 font-bold text-lg group disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {cargando ? (
              <span className="animate-pulse">Conectando...</span>
            ) : (
              <>
                <img 
                  src="https://www.svgrepo.com/show/475656/google-color.svg" 
                  alt="Google Logo" 
                  className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" 
                />
                Continuar con Google
              </>
            )}
          </button>

          <div className="mt-10 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 leading-relaxed">
              Al iniciar sesión, aceptas usar la plataforma de acuerdo con los reglamentos de la universidad y las políticas de uso de los escenarios deportivos.
            </p>
          </div>
        </div>

        {/* BOTÓN ACERCA DE (Debajo de la tarjeta) */}
        <button 
          onClick={() => setIsAboutOpen(true)}
          className="mt-8 flex items-center gap-2 text-sm text-slate-400 hover:text-[#1A1A1A] transition-colors px-4 py-2 rounded-full hover:bg-slate-200 font-medium"
        >
          <Info size={16} /> Acerca del Sistema
        </button>
      </div>

      {/* MODAL: ACERCA DE SUGED */}
      {isAboutOpen && (
        <div className="fixed inset-0 bg-[#1A1A1A]/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Cabecera del Modal */}
            <div className="p-6 border-b border-white/5 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FFCC29] rounded-xl flex items-center justify-center font-black text-[#1A1A1A] text-xl">S</div>
                <div>
                  <h2 className="text-lg font-bold text-white leading-none">SUGED</h2>
                  <span className="text-xs text-[#FFCC29] font-bold tracking-widest uppercase">Versión 1.0</span>
                </div>
              </div>
              <button onClick={() => setIsAboutOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-6 space-y-6">

              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Stack Tecnológico</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center gap-2 hover:bg-white/10 transition-colors">
                    <LayoutTemplate size={20} className="text-[#61DAFB]" />
                    <span className="text-xs text-slate-300 font-medium">React & Tailwind</span>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center gap-2 hover:bg-white/10 transition-colors">
                    <Server size={20} className="text-[#339933]" />
                    <span className="text-xs text-slate-300 font-medium">Node.js & Express</span>
                  </div>
                  <div className="col-span-2 bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center gap-2 hover:bg-white/10 transition-colors">
                    <Database size={20} className="text-[#3ECF8E]" />
                    <span className="text-xs text-slate-300 font-medium">Supabase (PostgreSQL)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pie del Modal */}
            <div className="p-4 bg-black/40 text-center border-t border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">© 2026 Universidad Pedagógica y Tecnológica de Colombia</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}