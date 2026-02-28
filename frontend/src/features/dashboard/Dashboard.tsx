import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Importamos el hook de navegación
import { useAuth } from '../../app/AuthContext';
import { supabase } from '../../app/supabase';
import { Activity, MapPin, Clock, Ticket, AlertCircle, CheckCircle2, UserCircle } from 'lucide-react';

export default function Inicio() {
  const { perfil, session } = useAuth();
  const navigate = useNavigate(); // Instanciamos la navegación
  const [cargando, setCargando] = useState(true);
  
  // Estados para las métricas
  const [metricasAdmin, setMetricasAdmin] = useState({ pendientes: 0, escenariosActivos: 0, reservasHoy: 0 });
  const [misReservasFuturas, setMisReservasFuturas] = useState(0);

  useEffect(() => {
    if (session && perfil) {
      cargarDatosInicio();
    }
  }, [session, perfil]);

  const cargarDatosInicio = async () => {
    setCargando(true);
    const hoy = new Date().toISOString().split('T')[0];

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
          .eq('fecha_reserva', hoy)
          .in('estado', ['APROBADA', 'PENDIENTE_APROBACION']);

        setMetricasAdmin({
          pendientes: countPendientes || 0,
          escenariosActivos: countEscenarios || 0,
          reservasHoy: countHoy || 0
        });

      } else {
        const { count: countMisReservas } = await supabase
          .from('reservas')
          .select('*', { count: 'exact', head: true })
          .eq('usuario_id', session?.user.id)
          .gte('fecha_reserva', hoy)
          .in('estado', ['APROBADA', 'PENDIENTE_APROBACION']);
          
        setMisReservasFuturas(countMisReservas || 0);
      }
    } catch (error) {
      console.error("Error cargando inicio:", error);
    } finally {
      setCargando(false);
    }
  };

  const nombrePila = perfil?.nombre_completo?.split(' ')[0] || 'Usuario';

  if (cargando) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Cargando tu resumen...</div>;
  }

  return (
    <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-slate-200 min-h-[80vh]">
      
      {/* SALUDO GENERAL (Con icono profesional) */}
      <div className="mb-8 pb-6 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#1A1A1A] mb-1 flex items-center gap-3">
            <UserCircle className="text-[#FFCC29]" size={32} />
            ¡Hola, {nombrePila}!
          </h1>
          <p className="text-slate-500 text-sm">
            Bienvenido a SUGED - Sistema Universitario para Gestiones Deportivas
          </p>
        </div>
      </div>

      {/* ========================================== */}
      {/* VISTA ADMINISTRADOR */}
      {/* ========================================== */}
      {perfil?.rol === 'ADMIN' && (
        <div className="animate-in slide-in-from-bottom-4">
          <h2 className="text-lg font-bold text-[#1A1A1A] mb-4 flex items-center gap-2">
            <Activity className="text-[#FFCC29]" /> Resumen del Sistema
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`p-6 rounded-2xl border-2 transition-all ${metricasAdmin.pendientes > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${metricasAdmin.pendientes > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500'}`}>
                  {metricasAdmin.pendientes > 0 ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
                </div>
              </div>
              <p className="text-4xl font-black text-[#1A1A1A] mb-1">{metricasAdmin.pendientes}</p>
              <p className="text-sm font-bold text-slate-600">Pagos por Auditar</p>
              {metricasAdmin.pendientes > 0 && (
                <p className="text-xs text-red-500 mt-2 font-medium">Requieren tu atención en Reservas.</p>
              )}
            </div>

            <div className="p-6 rounded-2xl border-2 border-slate-100 bg-slate-50">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
                  <Clock size={24} />
                </div>
              </div>
              <p className="text-4xl font-black text-[#1A1A1A] mb-1">{metricasAdmin.reservasHoy}</p>
              <p className="text-sm font-bold text-slate-600">Reservas para Hoy</p>
            </div>

            <div className="p-6 rounded-2xl border-2 border-slate-100 bg-slate-50">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-[#FFCC29]/20 text-[#1A1A1A]">
                  <MapPin size={24} />
                </div>
              </div>
              <p className="text-4xl font-black text-[#1A1A1A] mb-1">{metricasAdmin.escenariosActivos}</p>
              <p className="text-sm font-bold text-slate-600">Escenarios Activos</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* VISTA USUARIO (ESTUDIANTE / EXTERNO) */}
      {/* ========================================== */}
      {perfil?.rol !== 'ADMIN' && (
        <div className="animate-in slide-in-from-bottom-4">
          <div className="bg-[#1A1A1A] rounded-2xl p-6 md:p-10 text-white relative overflow-hidden shadow-lg">
            
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#FFCC29] rounded-full opacity-10 blur-3xl"></div>
            
            <div className="relative z-10">
              <h2 className="text-2xl font-black mb-2">Tu actividad deportiva</h2>
              
              <div className="flex items-end gap-3 mb-8">
                <span className="text-5xl font-black text-[#FFCC29]">{misReservasFuturas}</span>
                <span className="text-lg text-slate-300 pb-1">reservas próximas</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                {/* BOTONES CONECTADOS AL ENRUTADOR */}
                <button 
                  onClick={() => navigate('/reservas')} 
                  className="bg-[#FFCC29] text-[#1A1A1A] px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#e6b825] transition-colors"
                >
                  <Ticket size={18} /> Nueva Reserva
                </button>
                <button 
                  onClick={() => navigate('/reservas', { state: { pestaña: 'HISTORIAL' } })} 
                  className="bg-white/10 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
                >
                  <Clock size={18} /> Ver Historial
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 border border-slate-200 rounded-2xl bg-slate-50">
              <h3 className="font-bold text-[#1A1A1A] mb-2 flex items-center gap-2"><MapPin className="text-[#FFCC29]" size={18}/> ¿Sabías qué?</h3>
              <p className="text-sm text-slate-600">
                Al realizar una reserva, se generará un código QR único. Muéstralo en la entrada del escenario para validar tu acceso rápidamente.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}