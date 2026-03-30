import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { supabase } from '../../app/supabase';
import { Activity, MapPin, Clock, Ticket, AlertCircle, CheckCircle2, UserCircle, ChevronRight, Calendar, Sparkles } from 'lucide-react';

export default function Inicio() {
  const { perfil, session } = useAuth();
  const navigate = useNavigate(); 
  const [cargando, setCargando] = useState(true);
  
  // Estados para las métricas Admin
  const [metricasAdmin, setMetricasAdmin] = useState({ pendientes: 0, escenariosActivos: 0, reservasHoy: 0 });
  
  // Estados para el Usuario (Estudiante)
  const [misReservasFuturas, setMisReservasFuturas] = useState(0);
  const [proximaReserva, setProximaReserva] = useState<any>(null);

  useEffect(() => {
    if (session && perfil) {
      cargarDatosInicio();
    }
  }, [session, perfil]);

  const cargarDatosInicio = async () => {
    setCargando(true);
    const hoy = new Date();
    const fechaLocal = new Date(hoy.getTime() - (hoy.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const horaActualStr = `${hoy.getHours().toString().padStart(2, '0')}:${hoy.getMinutes().toString().padStart(2, '0')}:00`;

    try {
      if (perfil?.rol === 'ADMIN') {
        const { count: countPendientes } = await supabase
          .from('reservas')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'PENDIENTE_APROBACION');

        const { count: countEscenarios } = await supabase
          .from('escenarios')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'ACTIVO');

        const { count: countHoy } = await supabase
          .from('reservas')
          .select('*', { count: 'exact', head: true })
          .eq('fecha_reserva', fechaLocal)
          .in('estado', ['APROBADA', 'PENDIENTE_APROBACION']);

        setMetricasAdmin({
          pendientes: countPendientes || 0,
          escenariosActivos: countEscenarios || 0,
          reservasHoy: countHoy || 0
        });

      } else {
        const { data: reservasCandidatas } = await supabase
          .from('reservas')
          .select('fecha_reserva, hora_inicio, hora_fin, escenarios(nombre), estado')
          .eq('usuario_id', session?.user.id)
          .gte('fecha_reserva', fechaLocal)
          .in('estado', ['APROBADA', 'PENDIENTE_APROBACION'])
          .order('fecha_reserva', { ascending: true })
          .order('hora_inicio', { ascending: true });
          
        if (reservasCandidatas) {
          const reservasValidas = reservasCandidatas.filter(res => {
            if (res.fecha_reserva > fechaLocal) return true; 
            if (res.fecha_reserva === fechaLocal && res.hora_fin > horaActualStr) return true; 
            return false; 
          });

          setMisReservasFuturas(reservasValidas.length);
          setProximaReserva(reservasValidas[0] || null); 
        } else {
          setMisReservasFuturas(0);
          setProximaReserva(null);
        }
      }
    } catch (error) {
      console.error("Error cargando inicio:", error);
    } finally {
      setCargando(false);
    }
  };

  const nombrePila = perfil?.nombre_completo?.split(' ')[0] || 'Usuario';
  
  const opcionesFecha: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
  const fechaHoyStr = new Date().toLocaleDateString('es-ES', opcionesFecha);
  const fechaCapitalizada = fechaHoyStr.charAt(0).toUpperCase() + fechaHoyStr.slice(1);

  if (cargando) {
    return <div className="flex justify-center items-center h-[50vh] text-slate-500 font-medium animate-pulse">Cargando tu resumen...</div>;
  }

  return (
    // LA SOLUCIÓN ESTÁ AQUÍ: px-4 py-6 md:p-0 le da el oxígeno arriba y a los lados en móvil
    <div className="px-4 py-6 md:p-0 space-y-4 md:space-y-6">
      
      {/* ========================================== */}
      {/* BANNER DE BIENVENIDA */}
      {/* ========================================== */}
      <div className="bg-[#1A1A1A] rounded-xl p-6 md:p-8 relative overflow-hidden shadow-md border border-[#FFCC29]/10">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-[#FFCC29] rounded-full opacity-10 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-white rounded-full opacity-5 blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="inline-block px-3 py-1 bg-white/10 rounded-lg text-[#FFCC29] text-[10px] md:text-xs font-bold uppercase tracking-widest mb-3 md:mb-4 border border-white/5 backdrop-blur-sm">
              {fechaCapitalizada}
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white mb-2 flex items-center gap-2 md:gap-3 tracking-tight">
              ¡Hola, {nombrePila}!
            </h1>
            <p className="text-slate-400 text-xs md:text-sm max-w-md leading-relaxed">
              Bienvenido a <span className="text-white font-bold">SUGED</span>. El centro de control para la infraestructura deportiva de la UPTC.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 backdrop-blur-sm">
            <div className="w-12 h-12 bg-[#FFCC29] rounded-lg flex items-center justify-center text-[#1A1A1A] shadow-md shadow-[#FFCC29]/20">
              <UserCircle size={28} />
            </div>
            <div className="pr-2">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tu Rol</p>
              <p className="text-white font-bold">{perfil?.rol === 'ADMIN' ? 'Administrador' : 'Estudiante / Miembro'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* VISTA ADMINISTRADOR */}
      {/* ========================================== */}
      {perfil?.rol === 'ADMIN' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 animate-in slide-in-from-bottom-4">
          
          <div className={`md:col-span-2 p-6 md:p-8 rounded-xl border ${metricasAdmin.pendientes > 0 ? 'bg-gradient-to-br from-white to-red-50/30 border-red-100 shadow-sm' : 'bg-white border-slate-200 shadow-sm'} relative overflow-hidden group transition-all`}>
            {metricasAdmin.pendientes > 0 && <div className="absolute top-0 right-0 w-32 h-32 bg-red-500 opacity-5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>}
            
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <div className={`p-2.5 md:p-3 rounded-lg ${metricasAdmin.pendientes > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                {metricasAdmin.pendientes > 0 ? <AlertCircle size={20} className="md:w-6 md:h-6" /> : <CheckCircle2 size={20} className="md:w-6 md:h-6" />}
              </div>
              <h2 className="text-base md:text-lg font-bold text-[#1A1A1A]">Centro de Aprobaciones</h2>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 md:gap-6">
              <div>
                <p className="text-5xl md:text-6xl font-black text-[#1A1A1A] tracking-tighter mb-1">{metricasAdmin.pendientes}</p>
                <p className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider">Solicitudes Pendientes</p>
                {metricasAdmin.pendientes > 0 ? (
                  <p className="text-xs md:text-sm text-red-500 mt-1.5 md:mt-2 font-medium">Estudiantes esperando autorización para jugar.</p>
                ) : (
                  <p className="text-xs md:text-sm text-green-600 mt-1.5 md:mt-2 font-medium">¡Todo al día! No hay reservas pendientes.</p>
                )}
              </div>
              
              <button 
                onClick={() => navigate('/reservas')} 
                className={`w-full md:w-auto px-6 py-3.5 md:py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all text-sm md:text-base ${metricasAdmin.pendientes > 0 ? 'bg-[#1A1A1A] text-white hover:bg-black hover:shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Revisar Solicitudes <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 md:gap-6">
            <div className="p-5 md:p-6 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-2xl md:text-3xl font-black text-[#1A1A1A] mb-1">{metricasAdmin.reservasHoy}</p>
                <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Reservas Hoy</p>
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                <Clock size={20} className="md:w-6 md:h-6" />
              </div>
            </div>

            <div className="p-5 md:p-6 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-2xl md:text-3xl font-black text-[#1A1A1A] mb-1">{metricasAdmin.escenariosActivos}</p>
                <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Escenarios Activos</p>
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                <MapPin size={20} className="md:w-6 md:h-6" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* VISTA USUARIO (TICKET VIP) */}
      {/* ========================================== */}
      {perfil?.rol !== 'ADMIN' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 animate-in slide-in-from-bottom-4">
          
          <div className="md:col-span-2 bg-gradient-to-br from-[#1A1A1A] to-[#2d2d2d] rounded-xl p-6 md:p-8 text-white relative overflow-hidden shadow-lg border border-white/10 flex flex-col justify-between min-h-[220px]">
            {/* Decoración Ticket: Vertical en PC, Horizontal en Móvil */}
            <div className="hidden md:block absolute top-0 right-[25%] w-px h-full bg-white/10 border-dashed border-l border-white/20"></div>
            <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full opacity-10"></div>
            <div className="hidden md:block absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full opacity-10"></div>
            <div className="md:hidden absolute bottom-[76px] left-0 w-full h-px border-dashed border-b border-white/20"></div>

            <div className="relative z-10 mb-6 md:mb-0">
              <h2 className="text-xs md:text-sm font-bold text-[#FFCC29] uppercase tracking-widest mb-4 flex items-center gap-2">
                <Sparkles size={16} /> Tu Próximo Partido
              </h2>
              
              {proximaReserva ? (
                <div>
                  <p className="text-2xl md:text-3xl font-black text-white leading-tight mb-3 md:mb-4 pr-0 md:pr-32">{proximaReserva.escenarios?.nombre}</p>
                  <div className="flex flex-wrap items-center gap-2 md:gap-4 text-slate-300 text-xs md:text-sm font-medium">
                    <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-lg border border-white/5"><Calendar size={14} className="text-[#FFCC29]" /> {proximaReserva.fecha_reserva}</span>
                    <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-lg border border-white/5"><Clock size={14} className="text-[#FFCC29]" /> {proximaReserva.hora_inicio.slice(0,5)} - {proximaReserva.hora_fin.slice(0,5)}</span>
                    <span className={`px-2.5 py-1.5 md:px-3 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wider border ${proximaReserva.estado === 'APROBADA' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>
                      {proximaReserva.estado === 'APROBADA' ? 'Confirmada' : 'En Revisión'}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-2xl md:text-3xl font-black text-slate-300 leading-tight mb-2">Sin reservas próximas</p>
                  <p className="text-slate-400 text-xs md:text-sm max-w-sm">No tienes ningún partido agendado para esta semana. ¡Aprovecha que hay canchas libres!</p>
                </div>
              )}
            </div>

            <div className="relative z-10 pt-4 md:pt-0 mt-auto md:absolute md:bottom-8 md:right-8">
              <button onClick={() => navigate('/reservas')} className="w-full md:w-auto bg-[#FFCC29] text-[#1A1A1A] px-6 py-3.5 md:py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-[#e6b825] transition-transform md:hover:scale-105 shadow-md text-sm md:text-base">
                <Ticket size={18} /> Agendar Ahora
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 md:gap-6">
            <div className="p-5 md:p-6 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-center">
              <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 md:mb-2">Total en Agenda</p>
              <div className="flex items-end gap-2">
                <p className="text-4xl md:text-5xl font-black text-[#1A1A1A] leading-none">{misReservasFuturas}</p>
                <p className="text-xs md:text-sm text-slate-400 font-medium pb-1">reservas vigentes</p>
              </div>
            </div>

            <button onClick={() => navigate('/reservas', { state: { pestaña: 'HISTORIAL' } })} className="p-5 md:p-6 rounded-xl bg-slate-50 border border-slate-200 shadow-sm hover:bg-slate-100 transition-all flex items-center justify-between group">
              <div className="text-left">
                <p className="text-base md:text-lg font-bold text-[#1A1A1A] mb-0.5 md:mb-1">Mi Historial</p>
                <p className="text-[10px] md:text-xs font-medium text-slate-500">Ver pases QR y pasados</p>
              </div>
              <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-lg flex items-center justify-center text-slate-400 group-hover:text-[#1A1A1A] group-hover:translate-x-1 transition-all shadow-sm">
                <ChevronRight size={18} />
              </div>
            </button>
          </div>

        </div>
      )}

    </div>
  );
}