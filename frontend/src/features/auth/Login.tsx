import { useState } from 'react';
import { supabase } from '../../app/supabase';
import { MapPin, Calendar, ShieldCheck, Info, X, Database, LayoutTemplate, Server, WifiOff, ScanLine } from 'lucide-react';
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
    // CONTENEDOR PRINCIPAL: Fondo oscuro siempre para que el móvil sea Dark Mode, el PC divide.
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#1A1A1A] font-sans relative selection:bg-[#FFCC29] selection:text-[#1A1A1A]">
      
      {/* ========================================================= */}
      {/* PANEL IZQUIERDO: MARCA E INFORMACIÓN COMPLETA (DARK) */}
      {/* ========================================================= */}
      <div className="lg:w-5/12 text-white flex flex-col justify-center p-8 pt-16 md:p-16 relative overflow-hidden z-10 shrink-0 border-r border-white/5">
        
        {/* Decoración de luz amarilla de fondo */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#FFCC29] opacity-10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

        <div className="relative z-10 max-w-md mx-auto w-full flex flex-col items-center lg:items-start text-center lg:text-left">
          
          {/* Logo y Encabezado */}
          <div className="w-16 h-16 bg-[#FFCC29] rounded-2xl flex items-center justify-center font-black text-[#1A1A1A] text-4xl shadow-lg shadow-[#FFCC29]/20 mb-6">
            S
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-1 text-white tracking-tight">
            SUGED
          </h1>
          <p className="text-[#FFCC29] tracking-[0.2em] uppercase text-xs md:text-sm font-bold mb-4 lg:mb-8">
            UPTC Deportes
          </p>
          
          {/* ========================================================= */}
          {/* INFORMACIÓN COMPLEMENTARIA (SOLO VISIBLE EN PC) */}
          {/* ========================================================= */}
          <div className="hidden lg:flex flex-col w-full animate-in fade-in duration-700">
            <p className="text-slate-400 text-base mb-10 leading-relaxed">
              El Sistema de Gestión de Escenarios Deportivos (SUGED) centraliza y moderniza el acceso a la infraestructura deportiva de la universidad.
            </p>

            <div className="space-y-8">
              {/* Característica 1 */}
              <div className="flex gap-4 items-start group">
                <div className="p-3 bg-white/5 rounded-xl text-[#FFCC29] group-hover:bg-[#FFCC29] group-hover:text-[#1A1A1A] transition-colors shrink-0">
                  <MapPin size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg mb-1">Reserva de Escenarios</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">Accede a canchas múltiples y espacios deportivos desde cualquier lugar.</p>
                </div>
              </div>
              
              {/* Característica 2 */}
              <div className="flex gap-4 items-start group">
                <div className="p-3 bg-white/5 rounded-xl text-[#FFCC29] group-hover:bg-[#FFCC29] group-hover:text-[#1A1A1A] transition-colors shrink-0">
                  <Calendar size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg mb-1">Disponibilidad en Tiempo Real</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">Consulta los horarios libres reales, evitando cruces con mantenimientos o entrenamientos fijos.</p>
                </div>
              </div>

              {/* Característica 3 */}
              <div className="flex gap-4 items-start group">
                <div className="p-3 bg-white/5 rounded-xl text-[#FFCC29] group-hover:bg-[#FFCC29] group-hover:text-[#1A1A1A] transition-colors shrink-0">
                  <ScanLine size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg mb-1">Acceso Rápido con QR</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">Una vez aprobada tu reserva, genera tu pase digital para un ingreso ágil y seguro.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* PANEL DERECHO: ÁREA DE LOGIN (DARK EN MÓVIL, LIGHT EN PC) */}
      {/* ========================================================= */}
      <div className="lg:w-7/12 flex-1 flex flex-col items-center justify-center p-6 lg:p-16 lg:bg-slate-50 relative z-20">
        
        {/* LA TARJETA (Inexistente en móvil, caja blanca en PC) */}
        <div className="w-full max-w-md lg:bg-white lg:p-12 lg:rounded-[2rem] lg:shadow-xl lg:border lg:border-slate-200/60 text-center flex flex-col justify-center mt-8 lg:mt-0">
          
          <h2 className="text-2xl md:text-3xl font-extrabold text-white lg:text-[#1A1A1A] mb-3">
            Bienvenido de vuelta
          </h2>
          <p className="text-slate-400 lg:text-slate-500 text-sm md:text-base mb-10">
            Inicia sesión con tu cuenta de Google para gestionar tus reservas.
          </p>
          
          {/* EL ÚNICO BOTÓN BLANCO (Contraste perfecto en móvil) */}
          <button
            onClick={iniciarSesionConGoogle}
            disabled={cargando}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-transparent lg:border-slate-200 text-[#1A1A1A] px-6 py-4 rounded-xl lg:hover:bg-slate-50 hover:border-[#FFCC29] hover:shadow-[0_0_20px_rgba(255,204,41,0.3)] transition-all duration-300 font-bold text-lg group disabled:opacity-60 disabled:cursor-not-allowed"
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

          {/* Legal / Reglamento */}
          <div className="mt-12 lg:mt-10 pt-6 border-t border-white/10 lg:border-slate-100">
            <p className="text-[11px] lg:text-xs text-slate-500 lg:text-slate-400 leading-relaxed">
              Al iniciar sesión en SUGED, confirmas que perteneces a la comunidad universitaria y aceptas las políticas de uso de infraestructura deportiva de la UPTC.
            </p>
          </div>
        </div>

        {/* BOTÓN ACERCA DE (Abajo, sutil) */}
        <button 
          onClick={() => setIsAboutOpen(true)}
          className="mt-12 lg:mt-8 flex items-center gap-2 text-sm text-slate-400 lg:text-slate-500 hover:text-white lg:hover:text-[#1A1A1A] transition-colors px-5 py-2.5 rounded-full hover:bg-white/5 lg:hover:bg-slate-200 font-medium"
        >
          <Info size={16} /> Acerca del Sistema
        </button>
      </div>

      {/* ========================================================= */}
      {/* MODAL: ACERCA DE SUGED (Sin cambios estructurales, solo pulido) */}
      {/* ========================================================= */}
      {isAboutOpen && (
        <div className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-md flex justify-center items-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[#1A1A1A] border border-white/10 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="p-6 border-b border-white/5 flex justify-between items-start bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FFCC29] rounded-xl flex items-center justify-center font-black text-[#1A1A1A] text-xl">S</div>
                <div>
                  <h2 className="text-lg font-bold text-white leading-none">SUGED</h2>
                  <span className="text-xs text-[#FFCC29] font-bold tracking-widest uppercase">Versión 1.0</span>
                </div>
              </div>
              <button onClick={() => setIsAboutOpen(false)} className="text-slate-400 hover:text-white transition-colors bg-white/5 p-1 rounded-full"><X size={20} /></button>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 text-center">Stack Tecnológico</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-3 hover:bg-white/5 hover:border-white/10 transition-all cursor-default">
                    <LayoutTemplate size={24} className="text-[#61DAFB]" />
                    <span className="text-xs text-slate-300 font-medium">React & Tailwind</span>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-3 hover:bg-white/5 hover:border-white/10 transition-all cursor-default">
                    <Server size={24} className="text-[#339933]" />
                    <span className="text-xs text-slate-300 font-medium">Node.js API</span>
                  </div>
                  <div className="col-span-2 bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-3 hover:bg-white/5 hover:border-white/10 transition-all cursor-default">
                    <Database size={24} className="text-[#3ECF8E]" />
                    <span className="text-xs text-slate-300 font-medium">Supabase (PostgreSQL)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-black/60 text-center border-t border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">© 2026 Universidad Pedagógica y Tecnológica de Colombia</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}