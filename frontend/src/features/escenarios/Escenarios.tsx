import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // <-- Agregado para el atajo
import { supabase } from '../../app/supabase'; 
import { useAuth } from '../../app/AuthContext';
import { MapPin, Users, X, Plus, Clock, Edit, Trash2, CalendarOff, Repeat, CheckCircle2, ImagePlus, ShieldAlert, Check, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { fetchAPI } from '../../utils/api';

import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { es } from 'date-fns/locale/es';
registerLocale('es', es); 

interface Escenario { id: string; nombre: string; descripcion: string; aforo: number; imagen_url: string; estado: 'ACTIVO' | 'MANTENIMIENTO' | 'INACTIVO'; }
interface BloqueoPuntual { id: string; fecha: string; hora_inicio: string; hora_fin: string; motivo: string; }
interface BloqueoFijo { id: string; dia_semana: number; hora_inicio: string; hora_fin: string; motivo: string; }

const DIAS_SEMANA: Record<number, string> = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo' };

const formatearHoraBackend = (fecha: Date) => {
  return `${fecha.getHours().toString().padStart(2, '0')}:${fecha.getMinutes().toString().padStart(2, '0')}:00`;
};

const formatearFechaBackend = (fecha: Date) => {
  return new Date(fecha.getTime() - (fecha.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

export default function Escenarios() {
  const { perfil, session } = useAuth();
  const navigate = useNavigate(); // <-- Iniciamos la navegación para el atajo

  const [escenarios, setEscenarios] = useState<Escenario[]>([]);
  const [cargando, setCargando] = useState(true);

  const [disponibilidadActual, setDisponibilidadActual] = useState<Record<string, 'LIBRE' | 'OCUPADO' | 'CERRADO' | 'CARGANDO'>>({});
  const [reservasActuales, setReservasActuales] = useState<Record<string, any>>({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [escenarioEditando, setEscenarioEditando] = useState<Escenario | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [escenarioSeleccionado, setEscenarioSeleccionado] = useState<Escenario | null>(null);
  const [isHorarioModalOpen, setIsHorarioModalOpen] = useState(false);
  
  const [horaAperturaBase, setHoraAperturaBase] = useState<Date>(new Date(new Date().setHours(8, 0, 0, 0)));
  const [horaCierreBase, setHoraCierreBase] = useState<Date>(new Date(new Date().setHours(18, 0, 0, 0)));
  
  const [fechaBloqueo, setFechaBloqueo] = useState<Date>(new Date());
  const [horaInicioBloqueo, setHoraInicioBloqueo] = useState<Date>(new Date(new Date().setHours(8, 0, 0, 0)));
  const [horaFinBloqueo, setHoraFinBloqueo] = useState<Date>(new Date(new Date().setHours(10, 0, 0, 0)));

  const [isBloqueoModalOpen, setIsBloqueoModalOpen] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [tipoBloqueo, setTipoBloqueo] = useState<'PUNTUAL' | 'FIJO'>('PUNTUAL');
  const [bloqueosActivos, setBloqueosActivos] = useState<BloqueoPuntual[]>([]);
  const [bloqueosFijos, setBloqueosFijos] = useState<BloqueoFijo[]>([]);
  const [diaCompleto, setDiaCompleto] = useState(false);

  const obtenerEscenarios = async () => {
    setCargando(true);
    const { data, error } = await supabase.from('escenarios').select('*').order('creado_en', { ascending: false });
    if (!error && data) {
      setEscenarios(data);
      verificarDisponibilidadEnTiempoReal(data);
    }
    setCargando(false);
  };

  const verificarDisponibilidadEnTiempoReal = async (escenariosData: Escenario[]) => {
    const estadoInicial: Record<string, 'CARGANDO'> = {};
    escenariosData.forEach(esc => estadoInicial[esc.id] = 'CARGANDO');
    setDisponibilidadActual(estadoInicial);
    setReservasActuales({});

    const hoy = new Date();
    const fechaLocal = new Date(hoy.getTime() - (hoy.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const horaActualInt = hoy.getHours();
    const horaActualStr = `${horaActualInt.toString().padStart(2, '0')}:00:00`;
    
    let diaSemana = hoy.getDay();
    diaSemana = diaSemana === 0 ? 7 : diaSemana; 

    await Promise.all(escenariosData.map(async (esc) => {
      try {
        if (esc.estado !== 'ACTIVO') {
          setDisponibilidadActual(prev => ({ ...prev, [esc.id]: 'CERRADO' }));
          return;
        }

        const { data: horario } = await supabase
          .from('horarios_escenarios')
          .select('hora_apertura, hora_cierre')
          .eq('escenario_id', esc.id)
          .eq('dia_semana', diaSemana)
          .maybeSingle();

        if (!horario) {
          setDisponibilidadActual(prev => ({ ...prev, [esc.id]: 'CERRADO' }));
          return;
        }

        const apertura = parseInt(horario.hora_apertura.split(':')[0]);
        const cierre = parseInt(horario.hora_cierre.split(':')[0]);

        if (horaActualInt < apertura || horaActualInt >= cierre) {
          setDisponibilidadActual(prev => ({ ...prev, [esc.id]: 'CERRADO' }));
          return;
        }

        const res = await fetchAPI(`/api/escenarios/${esc.id}/disponibilidad?fecha=${fechaLocal}`);
        
        if (res.ok) {
          const data = await res.json();
          const estaLibre = data.libres.some((bloque: any) => bloque.hora_inicio === horaActualStr);
          
          if (estaLibre) {
            setDisponibilidadActual(prev => ({ ...prev, [esc.id]: 'LIBRE' }));
          } else {
            setDisponibilidadActual(prev => ({ ...prev, [esc.id]: 'OCUPADO' }));
            
            if (perfil?.rol === 'ADMIN') {
              const resReserva = await fetchAPI(`/api/escenarios/${esc.id}/reserva-actual`);
              if (resReserva.ok) {
                const dataReserva = await resReserva.json();
                if (dataReserva.reserva) {
                  setReservasActuales(prev => ({ ...prev, [esc.id]: dataReserva.reserva }));
                }
              }
            }
          }
        } else {
          setDisponibilidadActual(prev => ({ ...prev, [esc.id]: 'OCUPADO' }));
        }
      } catch (error) {
        setDisponibilidadActual(prev => ({ ...prev, [esc.id]: 'CERRADO' }));
      }
    }));
  };

  const manejarLiberarEscenario = async (reservaId: string) => {
    const confirmacion = await Swal.fire({
      title: '¿Liberar Escenario?',
      text: "La reserva actual se finalizará y el espacio quedará libre inmediatamente.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981', 
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, liberar ahora',
      cancelButtonText: 'Cancelar',
      customClass: { popup: 'rounded-2xl' }
    });

    if (!confirmacion.isConfirmed) return;

    const toastId = toast.loading('Liberando escenario...');
    try {
      const res = await fetchAPI(`/api/reservas/${reservaId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'FINALIZADA' })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      
      toast.success('Escenario liberado con éxito', { id: toastId });
      obtenerEscenarios(); 
    } catch (error: any) {
      toast.error('Error al liberar', { description: error.message, id: toastId });
    }
  };

  useEffect(() => { obtenerEscenarios(); }, []);

  const abrirModalCrear = () => { setEscenarioEditando(null); setIsModalOpen(true); };
  const abrirModalEditar = (escenario: Escenario) => { setEscenarioEditando(escenario); setIsModalOpen(true); };
  
  const manejarGuardarEscenario = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!session) return;
    setGuardando(true);
    const formData = new FormData(e.currentTarget);
    let imagen_url_final = escenarioEditando?.imagen_url || null;

    try {
      const archivoImagen = formData.get('imagen_archivo') as File;
      if (archivoImagen && archivoImagen.size > 0) {
        const fileExt = archivoImagen.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('escenarios').upload(fileName, archivoImagen);
        if (uploadError) throw new Error(`Error al subir la foto: ${uploadError.message}`);
        const { data: { publicUrl } } = supabase.storage.from('escenarios').getPublicUrl(fileName);
        imagen_url_final = publicUrl;
      }

      const datosEscenario = {
        nombre: formData.get('nombre'), 
        descripcion: formData.get('descripcion'), 
        aforo: parseInt(formData.get('aforo') as string) || 0,
        estado: formData.get('estado'), 
        imagen_url: imagen_url_final
      };

      const endpoint = escenarioEditando ? `/api/escenarios/${escenarioEditando.id}` : '/api/escenarios';
      const method = escenarioEditando ? 'PUT' : 'POST';

      const res = await fetchAPI(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datosEscenario) });
      if (!res.ok) throw new Error((await res.json()).error);
      
      setIsModalOpen(false); 
      obtenerEscenarios(); 
      toast.success(escenarioEditando ? 'Escenario actualizado con éxito' : 'Escenario registrado con éxito');
    } catch (error: any) { 
      toast.error('Error al guardar el escenario', { description: error.message });
    } finally { 
      setGuardando(false); 
    }
  };

  const manejarEliminar = async (id: string) => {
    const confirmacion = await Swal.fire({ title: '¿Estás seguro?', text: "Esta acción eliminará el escenario y todas sus dependencias. No se puede deshacer.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar', customClass: { popup: 'rounded-2xl' } });
    if (!confirmacion.isConfirmed) return;
    try {
      const res = await fetchAPI(`/api/escenarios/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      obtenerEscenarios();
      toast.success('Escenario eliminado correctamente');
    } catch (error: any) { toast.error('Error al eliminar', { description: error.message }); }
  };

  const manejarGuardarHorario = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!escenarioSeleccionado) return;
    const formData = new FormData(e.currentTarget);
    
    const datos = { 
      dia_semana: parseInt(formData.get('dia_semana') as string), 
      hora_apertura: formatearHoraBackend(horaAperturaBase), 
      hora_cierre: formatearHoraBackend(horaCierreBase) 
    };
    
    setProcesando(true);
    try {
      const res = await fetchAPI(`/api/escenarios/${escenarioSeleccionado.id}/horarios`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Horario asignado correctamente');
      setIsHorarioModalOpen(false);
      obtenerEscenarios(); 
    } catch (error: any) { 
      toast.error('Error al asignar horario', { description: error.message }); 
    } finally { 
      setProcesando(false); 
    }
  };

  const cargarBloqueos = async (escenarioId: string) => {
    const hoy = new Date().toISOString().split('T')[0];
    const [resPuntuales, resFijos] = await Promise.all([
      supabase.from('bloqueos_escenarios').select('*').eq('escenario_id', escenarioId).gte('fecha', hoy).order('fecha', { ascending: true }),
      supabase.from('bloqueos_recurrentes').select('*').eq('escenario_id', escenarioId).order('dia_semana', { ascending: true })
    ]);
    if (resPuntuales.data) setBloqueosActivos(resPuntuales.data);
    if (resFijos.data) setBloqueosFijos(resFijos.data);
  };

  const abrirModalBloqueos = (escenario: Escenario) => {
    setEscenarioSeleccionado(escenario);
    setDiaCompleto(false);
    setTipoBloqueo('PUNTUAL');
    setFechaBloqueo(new Date()); 
    cargarBloqueos(escenario.id);
    setIsBloqueoModalOpen(true);
  };

  const manejarGuardarBloqueo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!escenarioSeleccionado) return;
    const formData = new FormData(e.currentTarget);
    
    let hInicio = formatearHoraBackend(horaInicioBloqueo);
    let hFin = formatearHoraBackend(horaFinBloqueo);

    if (diaCompleto && tipoBloqueo === 'PUNTUAL') { 
      hInicio = "00:00:00"; hFin = "23:59:59"; 
    } 

    setProcesando(true);
    try {
      if (tipoBloqueo === 'PUNTUAL') {
        const datosPuntual = { 
          fecha: formatearFechaBackend(fechaBloqueo), 
          hora_inicio: hInicio, 
          hora_fin: hFin, 
          motivo: formData.get('motivo') 
        };
        const res = await fetchAPI(`/api/escenarios/${escenarioSeleccionado.id}/bloqueos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datosPuntual) });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        const datosFijo = { 
          dia_semana: parseInt(formData.get('dia_semana') as string), 
          hora_inicio: hInicio, 
          hora_fin: hFin, 
          motivo: formData.get('motivo') 
        };
        const res = await fetchAPI(`/api/escenarios/${escenarioSeleccionado.id}/bloqueos-recurrentes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datosFijo) });
        if (!res.ok) throw new Error((await res.json()).error);
      }
      
      (e.target as HTMLFormElement).reset();
      setDiaCompleto(false);
      cargarBloqueos(escenarioSeleccionado.id);
      obtenerEscenarios(); 
      toast.success(tipoBloqueo === 'PUNTUAL' ? 'Bloqueo registrado correctamente' : 'Entrenamiento fijo asignado');
    } catch (error: any) { 
      toast.error('Error al registrar', { description: error.message }); 
    } finally { 
      setProcesando(false); 
    }
  };

  const eliminarBloqueo = async (bloqueoId: string, tipo: 'PUNTUAL' | 'FIJO') => {
    const confirmacion = await Swal.fire({ title: '¿Quitar bloqueo?', text: "El escenario volverá a estar disponible para reservas en ese horario.", icon: 'question', showCancelButton: true, confirmButtonColor: '#1A1A1A', cancelButtonColor: '#64748b', confirmButtonText: 'Sí, liberar horario', cancelButtonText: 'Cancelar', customClass: { popup: 'rounded-2xl' } });
    if (!confirmacion.isConfirmed) return;
    try {
      const endpoint = tipo === 'PUNTUAL' ? `/api/escenarios/bloqueos/${bloqueoId}` : `/api/escenarios/bloqueos-recurrentes/${bloqueoId}`;
      const res = await fetchAPI(endpoint, { method: 'DELETE' });
      if (!res.ok) throw new Error("Error al eliminar");
      cargarBloqueos(escenarioSeleccionado!.id); 
      obtenerEscenarios(); 
      toast.success('Horario liberado correctamente');
    } catch (error: any) { toast.error('Error al eliminar', { description: error.message }); }
  };

  const bloqueosPuntualesFiltrados = bloqueosActivos.filter(b => b.fecha === formatearFechaBackend(fechaBloqueo));

  return (
    <div className="px-4 py-6 md:p-0 space-y-6 min-h-[80vh]">
      
      {/* ========================================== */}
      {/* ENCABEZADO PREMIUM (DASHBOARD STYLE)       */}
      {/* ========================================== */}
      <div className="bg-[#1A1A1A] rounded-xl p-6 md:p-8 relative overflow-hidden shadow-md border border-[#FFCC29]/10">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-[#FFCC29] rounded-full opacity-10 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-white rounded-full opacity-5 blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight">Escenarios Deportivos</h1>
            <p className="text-slate-400 text-xs md:text-sm max-w-md leading-relaxed">
              {perfil?.rol === 'ADMIN' 
                ? 'Catálogo de infraestructura. Gestiona la disponibilidad, horarios base y bloqueos.' 
                : 'Catálogo de infraestructura. Revisa los espacios de la universidad y su estado actual.'}
            </p>
          </div>

          {perfil?.rol === 'ADMIN' && (
            <button onClick={abrirModalCrear} className="w-full md:w-auto bg-[#FFCC29] text-[#1A1A1A] px-6 py-3.5 md:py-3 rounded-xl font-bold hover:bg-[#e6b825] transition-transform md:hover:scale-105 shadow-[0_0_20px_rgba(255,204,41,0.2)] flex items-center justify-center gap-2">
              <Plus size={20} /> Nuevo Escenario
            </button>
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* CATÁLOGO INMERSIVO (GRILLA DE TARJETAS)    */}
      {/* ========================================== */}
      {cargando ? (
        <div className="flex justify-center items-center h-40 text-slate-500 font-medium animate-pulse">Cargando espacios...</div>
      ) : escenarios.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <MapPin className="mx-auto h-12 w-12 text-slate-400 mb-3" />
          <h3 className="text-lg font-medium text-[#1A1A1A]">No hay escenarios registrados</h3>
          <p className="text-sm text-slate-500">Comienza añadiendo tu primera cancha o coliseo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {escenarios.map((escenario) => (
            <div key={escenario.id} className="relative bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-lg group border border-slate-200/50 flex flex-col h-[360px] md:h-[400px]">
              
              {/* Imagen de Fondo y Degradado */}
              <img src={escenario.imagen_url || 'https://via.placeholder.com/400x300?text=Escenario'} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" alt={escenario.nombre} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-[#1A1A1A]/70 to-black/20 opacity-90 transition-opacity"></div>
              
              {/* Píldoras Superiores (Estado y Disponibilidad) */}
              <div className="absolute top-4 left-4 z-10">
                {disponibilidadActual[escenario.id] === 'CARGANDO' && (<span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse"></span> Calculando...</span>)}
                {disponibilidadActual[escenario.id] === 'LIBRE' && (<span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 backdrop-blur-md border border-green-500/30 text-[10px] font-bold text-green-400 uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse"></span> Libre Ahora</span>)}
                {disponibilidadActual[escenario.id] === 'OCUPADO' && (<span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 backdrop-blur-md border border-red-500/30 text-[10px] font-bold text-red-400 uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Ocupado</span>)}
                {disponibilidadActual[escenario.id] === 'CERRADO' && (<span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-500/30 backdrop-blur-md border border-white/10 text-[10px] font-bold text-slate-300 uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Cerrado</span>)}
              </div>

              <div className="absolute top-4 right-4 z-10">
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest backdrop-blur-md border ${escenario.estado === 'ACTIVO' ? 'bg-white/10 text-white border-white/20' : escenario.estado === 'MANTENIMIENTO' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                  {escenario.estado === 'ACTIVO' ? 'Habilitado' : escenario.estado}
                </span>
              </div>
              
              {/* Contenido Principal (Abajo) */}
              <div className="relative z-10 mt-auto p-5 flex flex-col">
                
                {/* Alerta de Reserva Actual (Para Admin) */}
                {perfil?.rol === 'ADMIN' && disponibilidadActual[escenario.id] === 'OCUPADO' && reservasActuales[escenario.id] && (
                  <div className="mb-4 bg-red-500/20 backdrop-blur-md border border-red-500/30 p-3 rounded-xl animate-in slide-in-from-bottom-2">
                    <p className="text-[10px] text-red-300 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> En Uso Por:</p>
                    <p className="text-sm text-white font-bold mb-2 line-clamp-1">{reservasActuales[escenario.id].usuarios?.nombre_completo}</p>
                    <button onClick={() => manejarLiberarEscenario(reservasActuales[escenario.id].id)} className="w-full bg-red-500/80 hover:bg-red-500 text-white text-[11px] font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1"><CheckCircle2 size={14} /> Finalizar Reserva</button>
                  </div>
                )}

                <h3 className="text-2xl font-black text-white mb-1 group-hover:text-[#FFCC29] transition-colors">{escenario.nombre}</h3>
                <p className="text-slate-300 text-xs line-clamp-2 mb-3 font-medium leading-relaxed">{escenario.descripcion}</p>
                <div className="flex items-center gap-2 text-[#FFCC29] text-xs font-bold mb-1"><Users size={14} /> Aforo máximo: <span className="text-white">{escenario.aforo} personas</span></div>

                {/* ATAJO VIP PARA ESTUDIANTES */}
                {perfil?.rol !== 'ADMIN' && disponibilidadActual[escenario.id] === 'LIBRE' && (
                  <div className="mt-4 pt-4 border-t border-white/10 animate-in slide-in-from-bottom-2">
                    <button 
                      onClick={() => navigate('/reservas', { state: { pestaña: 'NUEVA', escenarioPreseleccionado: escenario } })} 
                      className="w-full bg-[#FFCC29] hover:bg-[#e6b825] text-[#1A1A1A] font-bold py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(255,204,41,0.2)] flex items-center justify-center gap-2"
                    >
                      <Ticket size={16} /> ¡Aprovecha! Agendar Ahora
                    </button>
                  </div>
                )}

                {/* Barra de Comandos del Admin */}
                {perfil?.rol === 'ADMIN' && (
                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <button onClick={() => { setEscenarioSeleccionado(escenario); setIsHorarioModalOpen(true); }} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-[#FFCC29] text-white hover:text-[#1A1A1A] flex items-center justify-center transition-colors border border-white/10 hover:border-[#FFCC29]" title="Horario Base"><Clock size={16} /></button>
                      <button onClick={() => abrirModalBloqueos(escenario)} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-red-500 text-white flex items-center justify-center transition-colors border border-white/10 hover:border-red-500" title="Restricciones y Bloqueos"><CalendarOff size={16} /></button>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => abrirModalEditar(escenario)} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/20 text-white flex items-center justify-center transition-colors border border-white/10" title="Editar Información"><Edit size={16} /></button>
                      <button onClick={() => manejarEliminar(escenario.id)} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-red-500 text-white flex items-center justify-center transition-colors border border-white/10 hover:border-red-500" title="Eliminar Escenario"><Trash2 size={16} /></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CREAR / EDITAR (DISEÑO CLEAN)       */}
      {/* ========================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white shrink-0">
              <h2 className="text-xl font-black text-[#1A1A1A]">{escenarioEditando ? 'Editar Escenario' : 'Nuevo Escenario'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-[#1A1A1A] transition-colors bg-slate-50 p-2 rounded-full"><X size={20} /></button>
            </div>
            
            <form onSubmit={manejarGuardarEscenario} className="p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre del Escenario *</label>
                <input required name="nombre" defaultValue={escenarioEditando?.nombre} type="text" placeholder="Ej. Cancha Múltiple Central" className="w-full border border-slate-200 rounded-xl p-3.5 outline-none focus:border-[#FFCC29] focus:ring-4 focus:ring-[#FFCC29]/10 bg-white font-medium transition-all" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Descripción</label>
                <textarea name="descripcion" defaultValue={escenarioEditando?.descripcion} rows={3} placeholder="Breve descripción del espacio..." className="w-full border border-slate-200 rounded-xl p-3.5 outline-none focus:border-[#FFCC29] focus:ring-4 focus:ring-[#FFCC29]/10 bg-white font-medium resize-none transition-all" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Aforo Máximo *</label>
                  <input required name="aforo" defaultValue={escenarioEditando?.aforo || 0} type="number" min="0" className="w-full border border-slate-200 rounded-xl p-3.5 outline-none focus:border-[#FFCC29] focus:ring-4 focus:ring-[#FFCC29]/10 bg-white font-medium transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Estado Físico</label>
                  <select name="estado" defaultValue={escenarioEditando?.estado || 'ACTIVO'} className="w-full border border-slate-200 rounded-xl p-3.5 outline-none focus:border-[#FFCC29] focus:ring-4 focus:ring-[#FFCC29]/10 bg-white font-medium transition-all">
                    <option value="ACTIVO">Activo / Disponible</option>
                    <option value="MANTENIMIENTO">En Mantenimiento</option>
                    <option value="INACTIVO">Inactivo / Cerrado</option>
                  </select>
                </div>
              </div>

              {/* Zona de Subida de Imagen Premium */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fotografía del Escenario</label>
                <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-6 bg-white hover:bg-slate-50 transition-colors flex flex-col items-center justify-center text-center group cursor-pointer">
                  <input name="imagen_archivo" type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-3 group-hover:bg-[#FFCC29] group-hover:text-[#1A1A1A] transition-colors"><ImagePlus size={24}/></div>
                  <p className="text-sm font-bold text-[#1A1A1A]">Haz clic o arrastra una imagen</p>
                  <p className="text-xs text-slate-400 mt-1">Formatos recomendados: JPG, PNG. Max 5MB.</p>
                </div>
              </div>
              
              <div className="pt-6 flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" disabled={guardando} className="bg-[#1A1A1A] text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-transform hover:scale-105 disabled:opacity-50">{guardando ? 'Guardando...' : 'Guardar Cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: HORARIO BASE (DISEÑO CLEAN)         */}
      {/* ========================================== */}
      {isHorarioModalOpen && escenarioSeleccionado && (
        <div className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-[#FFCC29] shrink-0">
              <h2 className="text-xl font-black text-[#1A1A1A] flex items-center gap-2"><Clock size={24}/> Horario Base</h2>
              <button onClick={() => setIsHorarioModalOpen(false)} className="text-[#1A1A1A]/60 hover:text-[#1A1A1A] bg-black/5 p-2 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={manejarGuardarHorario} className="p-6 space-y-5 flex-1 bg-slate-50/50">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Día de la Semana *</label>
                <select name="dia_semana" required className="w-full border border-slate-200 rounded-xl p-3.5 outline-none focus:border-[#FFCC29] focus:ring-4 focus:ring-[#FFCC29]/10 bg-white font-medium transition-all">
                  <option value="">Seleccione...</option>
                  <option value="1">Lunes</option><option value="2">Martes</option><option value="3">Miércoles</option><option value="4">Jueves</option><option value="5">Viernes</option><option value="6">Sábado</option><option value="7">Domingo</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Apertura *</label>
                  <DatePicker selected={horaAperturaBase} onChange={(date: Date | null) => date && setHoraAperturaBase(date)} showTimeSelect showTimeSelectOnly timeIntervals={60} timeCaption="Hora" dateFormat="h:mm aa" className="w-full border border-slate-200 rounded-xl p-3.5 outline-none focus:border-[#FFCC29] focus:ring-4 focus:ring-[#FFCC29]/10 bg-white font-medium cursor-pointer transition-all text-center" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cierre *</label>
                  <DatePicker selected={horaCierreBase} onChange={(date: Date | null) => date && setHoraCierreBase(date)} showTimeSelect showTimeSelectOnly timeIntervals={60} timeCaption="Hora" dateFormat="h:mm aa" className="w-full border border-slate-200 rounded-xl p-3.5 outline-none focus:border-[#FFCC29] focus:ring-4 focus:ring-[#FFCC29]/10 bg-white font-medium cursor-pointer transition-all text-center" />
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" disabled={procesando} className="w-full bg-[#1A1A1A] text-white px-5 py-4 rounded-xl font-black hover:bg-black transition-transform hover:scale-105 shadow-lg">{procesando ? 'Procesando...' : 'Asignar Horario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: BLOQUEOS (HUD SECURITY STYLE)       */}
      {/* ========================================== */}
      {isBloqueoModalOpen && escenarioSeleccionado && (
        <div className="fixed inset-0 bg-[#1A1A1A]/90 backdrop-blur-md flex justify-center items-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
            
            {/* Header Seguridad */}
            <div className="flex justify-between items-center p-6 bg-gradient-to-r from-red-600 to-red-800 shrink-0">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2"><ShieldAlert size={24}/> Gestión de Restricciones</h2>
                <p className="text-red-200 text-xs font-bold uppercase tracking-widest mt-1">{escenarioSeleccionado.nombre}</p>
              </div>
              <button onClick={() => setIsBloqueoModalOpen(false)} className="text-white/60 hover:text-white bg-black/20 p-2 rounded-full transition-colors"><X size={20} /></button>
            </div>

            {/* Segmented Control */}
            <div className="flex bg-slate-100 p-1.5 shrink-0 border-b border-slate-200">
              <button onClick={() => setTipoBloqueo('PUNTUAL')} className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${tipoBloqueo === 'PUNTUAL' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-[#1A1A1A]'}`}><CalendarOff size={16}/> Cierre Excepcional (1 Día)</button>
              <button onClick={() => setTipoBloqueo('FIJO')} className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${tipoBloqueo === 'FIJO' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-slate-500 hover:text-[#1A1A1A]'}`}><Repeat size={16}/> Entrenamiento Fijo (Semanal)</button>
            </div>

            <div className="flex flex-col md:flex-row overflow-y-auto flex-1 bg-slate-50/50">
              
              {/* FORMULARIO IZQUIERDO */}
              <form onSubmit={manejarGuardarBloqueo} className="p-6 border-b md:border-b-0 md:border-r border-slate-200 bg-white md:w-1/2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">{tipoBloqueo === 'PUNTUAL' ? 'Añadir Nuevo Cierre' : 'Configurar Horario Fijo'}</h3>
                
                <div className="space-y-5">
                  {tipoBloqueo === 'PUNTUAL' ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha Exacta *</label>
                      <DatePicker selected={fechaBloqueo} onChange={(date: Date | null) => date && setFechaBloqueo(date)} minDate={new Date()} locale="es" dateFormat="dd/MM/yyyy" className="w-full border border-slate-200 rounded-xl p-3.5 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 bg-white font-medium cursor-pointer transition-all" />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Día de la semana *</label>
                      <select required name="dia_semana" className="w-full border border-slate-200 rounded-xl p-3.5 outline-none focus:border-[#FFCC29] focus:ring-4 focus:ring-[#FFCC29]/10 bg-white font-medium transition-all">
                        <option value="">Seleccione un día...</option>
                        {Object.entries(DIAS_SEMANA).map(([num, nombre]) => <option key={num} value={num}>{nombre}</option>)}
                      </select>
                    </div>
                  )}
                  
                  {tipoBloqueo === 'PUNTUAL' && (
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer" onClick={() => setDiaCompleto(!diaCompleto)}>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${diaCompleto ? 'bg-red-500 border-red-500' : 'bg-white border-slate-300'}`}>
                         {diaCompleto && <Check size={14} className="text-white"/>}
                      </div>
                      <span className="text-sm font-bold text-[#1A1A1A] select-none">Bloquear todo el día</span>
                    </div>
                  )}

                  {(!diaCompleto || tipoBloqueo === 'FIJO') && (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Desde *</label>
                        <DatePicker selected={horaInicioBloqueo} onChange={(date: Date | null) => date && setHoraInicioBloqueo(date)} showTimeSelect showTimeSelectOnly timeIntervals={60} timeCaption="Hora" dateFormat="h:mm aa" className={`w-full border border-slate-200 rounded-xl p-3.5 outline-none font-medium cursor-pointer transition-all text-center bg-white ${tipoBloqueo === 'PUNTUAL' ? 'focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'focus:border-[#FFCC29] focus:ring-4 focus:ring-[#FFCC29]/10'}`} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hasta *</label>
                        <DatePicker selected={horaFinBloqueo} onChange={(date: Date | null) => date && setHoraFinBloqueo(date)} showTimeSelect showTimeSelectOnly timeIntervals={60} timeCaption="Hora" dateFormat="h:mm aa" className={`w-full border border-slate-200 rounded-xl p-3.5 outline-none font-medium cursor-pointer transition-all text-center bg-white ${tipoBloqueo === 'PUNTUAL' ? 'focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'focus:border-[#FFCC29] focus:ring-4 focus:ring-[#FFCC29]/10'}`} />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Motivo o Actividad *</label>
                    <input required name="motivo" type="text" placeholder={tipoBloqueo === 'PUNTUAL' ? "Ej. Poda de césped..." : "Ej. Selección Futsal..."} className={`w-full border border-slate-200 rounded-xl p-3.5 outline-none font-medium transition-all bg-white ${tipoBloqueo === 'PUNTUAL' ? 'focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'focus:border-[#FFCC29] focus:ring-4 focus:ring-[#FFCC29]/10'}`} />
                  </div>
                  
                  <div className="pt-4">
                    <button type="submit" disabled={procesando} className={`w-full py-3.5 rounded-xl font-black transition-transform hover:scale-105 shadow-md text-white ${tipoBloqueo === 'PUNTUAL' ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20' : 'bg-[#1A1A1A] hover:bg-black shadow-black/20'}`}>
                      {procesando ? 'Procesando...' : (tipoBloqueo === 'PUNTUAL' ? 'Aplicar Bloqueo' : 'Fijar Entrenamiento')}
                    </button>
                  </div>
                </div>
              </form>

              {/* LISTA DERECHA (Notificaciones) */}
              <div className="p-6 bg-slate-50 flex-1 md:w-1/2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">
                  {tipoBloqueo === 'PUNTUAL' ? `Bloqueos del ${formatearFechaBackend(fechaBloqueo) || 'día'}` : 'Entrenamientos Activos'}
                </h3>
                
                {tipoBloqueo === 'PUNTUAL' ? (
                  bloqueosPuntualesFiltrados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                      <CheckCircle2 size={32} className="text-slate-300 mb-2"/>
                      <p className="text-sm font-medium">Día libre de bloqueos.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bloqueosPuntualesFiltrados.map((bloqueo) => (
                        <div key={bloqueo.id} className="p-4 bg-white border border-red-200 rounded-2xl shadow-sm relative overflow-hidden group">
                          <div className="absolute left-0 top-0 w-1.5 h-full bg-red-500"></div>
                          <div className="flex justify-between items-center ml-2">
                            <div>
                              <p className="font-bold text-[#1A1A1A] text-sm mb-1">{bloqueo.motivo}</p>
                              <p className="text-[11px] font-bold text-red-500 uppercase tracking-wider bg-red-50 inline-block px-2 py-0.5 rounded-md">
                                {bloqueo.hora_inicio === '00:00:00' && bloqueo.hora_fin === '23:59:59' ? 'Día Completo' : `${bloqueo.hora_inicio.slice(0,5)} - ${bloqueo.hora_fin.slice(0,5)}`}
                              </p>
                            </div>
                            <button onClick={() => eliminarBloqueo(bloqueo.id, 'PUNTUAL')} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-red-500 rounded-lg transition-colors"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  bloqueosFijos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                      <CheckCircle2 size={32} className="text-slate-300 mb-2"/>
                      <p className="text-sm font-medium">Sin horarios fijos.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bloqueosFijos.map((bloqueo) => (
                        <div key={bloqueo.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden group">
                          <div className="absolute left-0 top-0 w-1.5 h-full bg-[#1A1A1A]"></div>
                          <div className="flex justify-between items-center ml-2">
                            <div>
                              <p className="font-bold text-[#1A1A1A] text-sm mb-1">{bloqueo.motivo}</p>
                              <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider bg-slate-100 inline-block px-2 py-0.5 rounded-md">
                                {DIAS_SEMANA[bloqueo.dia_semana]} • {bloqueo.hora_inicio.slice(0,5)} - {bloqueo.hora_fin.slice(0,5)}
                              </p>
                            </div>
                            <button onClick={() => eliminarBloqueo(bloqueo.id, 'FIJO')} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white hover:bg-red-500 rounded-lg transition-colors"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}