import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../app/supabase';
import { useAuth } from '../../app/AuthContext';
import { Calendar as CalendarIcon, Clock, MapPin, ChevronRight, CheckCircle2, Check, X, Ticket, History, ScanLine, AlertCircle, Search, Eye, IdCard, Sparkles, Users, Edit2, ShieldAlert } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { fetchAPI } from '../../utils/api';

import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { es } from 'date-fns/locale/es';
registerLocale('es', es);

interface Escenario { id: string; nombre: string; imagen_url: string; aforo: number; }
interface BloqueDisponible { hora_inicio: string; hora_fin: string; etiqueta: string; }
interface UsuarioInfo { nombre_completo: string; rol: string; documento?: string; codigo?: string; carrera?: string; }
interface ReservaAdmin {
  id: string; fecha_reserva: string; hora_inicio: string; hora_fin: string; estado: string; 
  escenarios: { nombre: string }; usuarios: UsuarioInfo;
}

const formatearFechaBackend = (fecha: Date) => {
  return new Date(fecha.getTime() - (fecha.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

// Componente Premium para los Estados
const RenderEstado = ({ estado }: { estado: string }) => {
  const config: Record<string, { bg: string, text: string, dot: string, label: string }> = {
    'PENDIENTE_APROBACION': { bg: 'bg-yellow-500/10', text: 'text-yellow-600', dot: 'bg-yellow-500', label: 'En Revisión' },
    'APROBADA': { bg: 'bg-green-500/10', text: 'text-green-600', dot: 'bg-green-500', label: 'Aprobada' },
    'FINALIZADA': { bg: 'bg-blue-500/10', text: 'text-blue-600', dot: 'bg-blue-500', label: 'Finalizada' },
    'RECHAZADA': { bg: 'bg-red-500/10', text: 'text-red-600', dot: 'bg-red-500', label: 'Rechazada' },
    'CANCELADA': { bg: 'bg-slate-500/10', text: 'text-slate-600', dot: 'bg-slate-500', label: 'Cancelada' }
  };
  const c = config[estado] || config['PENDIENTE_APROBACION'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wider ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${estado === 'PENDIENTE_APROBACION' ? 'animate-pulse' : ''}`}></span> {c.label}
    </span>
  );
};

export default function Reservas() {
  const { perfil, session, recargarPerfil } = useAuth();
  const location = useLocation();
  const [cargandoInicial, setCargandoInicial] = useState(true);

  // Estados Admin
  const [reservasAdmin, setReservasAdmin] = useState<ReservaAdmin[]>([]);
  const [vistaAdmin, setVistaAdmin] = useState<'TABLA' | 'ESCANER'>('TABLA');
  const [resultadoEscaneo, setResultadoEscaneo] = useState<{ valido: boolean; mensaje: string; datos?: ReservaAdmin } | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [usuarioCarnet, setUsuarioCarnet] = useState<UsuarioInfo | null>(null);

  // Estados Usuario
  const [vistaActiva, setVistaActiva] = useState<'NUEVA' | 'HISTORIAL'>('NUEVA');
  const [reservasVigentes, setReservasVigentes] = useState<any[]>([]);
  const [reservasPasadas, setReservasPasadas] = useState<any[]>([]);

  // Estados Wizard Usuario
  const [escenarios, setEscenarios] = useState<Escenario[]>([]);
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [escenarioSeleccionado, setEscenarioSeleccionado] = useState<Escenario | null>(null);
  const [fechaObj, setFechaObj] = useState<Date | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('');
  const [bloquesLibres, setBloquesLibres] = useState<BloqueDisponible[]>([]);
  const [cargandoHoras, setCargandoHoras] = useState(false);
  const [bloqueSeleccionado, setBloqueSeleccionado] = useState<BloqueDisponible | null>(null);
  const [procesandoReserva, setProcesandoReserva] = useState(false);
  const [datosPerfilFaltantes, setDatosPerfilFaltantes] = useState({ documento: '', codigo: '', carrera: '' });
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  useEffect(() => {
    if (location.state && location.state.pestaña) { 
      setVistaActiva(location.state.pestaña); 
      if (location.state.escenarioPreseleccionado) {
        setEscenarioSeleccionado(location.state.escenarioPreseleccionado);
        setPaso(2);
        window.history.replaceState({}, document.title);
      }
    }
    if (perfil?.rol === 'ADMIN') cargarReservasAdmin();
    else { cargarEscenariosUsuario(); cargarMisReservas(); }
  }, [perfil, location]);

  const cargarReservasAdmin = async () => {
    setCargandoInicial(true);
    const { data } = await supabase
      .from('reservas')
      .select(`id, fecha_reserva, hora_inicio, hora_fin, estado, escenarios ( nombre ), usuarios!fk_reservas_usuarios ( nombre_completo, rol, documento, codigo, carrera )`)
      .order('fecha_reserva', { ascending: false });
    if (data) setReservasAdmin(data as any[]);
    setCargandoInicial(false);
  };

  const manejarCambioEstado = async (reserva: any, nuevoEstado: string) => {
    const confirmacion = await Swal.fire({
      title: 'Confirmar Acción',
      html: `¿Seguro que deseas marcar esta reserva como <b>${nuevoEstado.replace('_', ' ')}</b>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#1A1A1A',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar',
      color: '#1A1A1A',
      customClass: { popup: 'rounded-2xl' }
    });

    if (!confirmacion.isConfirmed) return;
    const toastId = toast.loading('Actualizando estado...');

    try {
      const res = await fetchAPI(`/api/reservas/${reserva.id}/estado`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: nuevoEstado })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      
      toast.success(`Reserva ${nuevoEstado.replace('_', ' ').toLowerCase()} con éxito`, { id: toastId });
      cargarReservasAdmin(); 
    } catch (error: any) { 
      toast.error('Error al actualizar', { description: error.message, id: toastId }); 
    }
  };

  const procesarQR = async (textoLector: string) => {
    try {
      const { data, error } = await supabase
        .from('reservas')
        .select(`id, fecha_reserva, hora_inicio, hora_fin, estado, escenarios ( nombre ), usuarios!fk_reservas_usuarios ( nombre_completo, rol, documento, codigo, carrera )`)
        .eq('id', textoLector)
        .single();

      if (error || !data) { setResultadoEscaneo({ valido: false, mensaje: 'Código QR no válido o reserva no encontrada en el sistema.' }); return; }
      if (data.estado !== 'APROBADA') { setResultadoEscaneo({ valido: false, mensaje: `Acceso Denegado. Estado actual: ${data.estado.replace('_', ' ')}` }); return; }

      setResultadoEscaneo({ valido: true, mensaje: '¡Acceso Permitido!', datos: data as any });
      toast.success('Pase validado correctamente');
    } catch (err) {
      setResultadoEscaneo({ valido: false, mensaje: 'Error de lectura del escáner.' });
      toast.error('Ocurrió un error al procesar el código QR');
    }
  };

  const reservasFiltradas = reservasAdmin.filter((res) => {
    const coincideNombre = res.usuarios?.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) || false;
    const coincideEscenario = res.escenarios?.nombre.toLowerCase().includes(busqueda.toLowerCase()) || false;
    const coincideTexto = coincideNombre || coincideEscenario;
    const coincideEstado = filtroEstado === 'TODOS' || res.estado === filtroEstado;
    const coincideFecha = filtroFecha === '' || res.fecha_reserva === filtroFecha;
    return coincideTexto && coincideEstado && coincideFecha;
  });

  const cargarEscenariosUsuario = async () => { 
    const { data } = await supabase.from('escenarios').select('*').eq('estado', 'ACTIVO'); 
    if (data) setEscenarios(data); 
    setCargandoInicial(false); 
  };

  const cargarMisReservas = async () => { 
    if (!session) return; 
    
    const hoy = new Date();
    const fechaLocal = new Date(hoy.getTime() - (hoy.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const horaActualStr = `${hoy.getHours().toString().padStart(2, '0')}:${hoy.getMinutes().toString().padStart(2, '0')}:00`;

    const { data } = await supabase
      .from('reservas')
      .select(`id, fecha_reserva, hora_inicio, hora_fin, estado, escenarios ( nombre )`)
      .eq('usuario_id', session.user.id)
      .order('fecha_reserva', { ascending: false })
      .order('hora_inicio', { ascending: false });

    if (data) {
      const vigentes = data.filter(res => {
        if (!['PENDIENTE_APROBACION', 'APROBADA'].includes(res.estado)) return false;
        if (res.fecha_reserva > fechaLocal) return true; 
        if (res.fecha_reserva === fechaLocal && res.hora_fin > horaActualStr) return true; 
        return false;
      });

      const pasadas = data.filter(res => {
        if (['RECHAZADA', 'CANCELADA', 'FINALIZADA'].includes(res.estado)) return true;
        if (res.fecha_reserva < fechaLocal) return true; 
        if (res.fecha_reserva === fechaLocal && res.hora_fin <= horaActualStr) return true; 
        return false;
      });

      vigentes.sort((a, b) => {
        if (a.fecha_reserva === b.fecha_reserva) return a.hora_inicio.localeCompare(b.hora_inicio);
        return a.fecha_reserva.localeCompare(b.fecha_reserva);
      });

      setReservasVigentes(vigentes);
      setReservasPasadas(pasadas);
    } 
  };

  const getFechasPermitidasObj = () => {
    const hoy = new Date();
    let diasParaDomingo = 7 - hoy.getDay();
    if (hoy.getDay() === 0) diasParaDomingo = 0; 
    let diasMaximos = diasParaDomingo;
    if (hoy.getDay() === 5 || hoy.getDay() === 6 || hoy.getDay() === 0) { diasMaximos += 7; }
    const max = new Date(hoy.getTime() + (diasMaximos * 24 * 60 * 60 * 1000));
    return { minDateObj: hoy, maxDateObj: max };
  };

  useEffect(() => { 
    if (escenarioSeleccionado && fechaSeleccionada && perfil?.rol !== 'ADMIN') consultarDisponibilidad(escenarioSeleccionado.id, fechaSeleccionada); 
  }, [escenarioSeleccionado, fechaSeleccionada]);
  
  const consultarDisponibilidad = async (escenarioId: string, fecha: string) => { 
    setCargandoHoras(true); 
    setBloqueSeleccionado(null); 
    try { 
      const res = await fetchAPI(`/api/escenarios/${escenarioId}/disponibilidad?fecha=${fecha}`); 
      if (res.ok) setBloquesLibres((await res.json()).libres); 
    } catch { 
      setBloquesLibres([]); 
      toast.error('Error al cargar disponibilidad');
    } finally { 
      setCargandoHoras(false); 
    } 
  };

  const manejarGuardarPerfilYReservar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !escenarioSeleccionado || !bloqueSeleccionado) return;
    setGuardandoPerfil(true);
    const toastId = toast.loading('Actualizando perfil y enviando solicitud...');
    try {
      const { error: errorPerfil } = await supabase.from('usuarios').update({ documento: datosPerfilFaltantes.documento, codigo: datosPerfilFaltantes.codigo, carrera: datosPerfilFaltantes.carrera }).eq('id', session.user.id);
      if (errorPerfil) throw new Error("Error al guardar tus datos personales.");
      await recargarPerfil();
      await procesarPeticionReserva(toastId);
    } catch (error: any) {
      toast.error('Error', { description: error.message, id: toastId });
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const confirmarReserva = async () => { 
    if (!session || !escenarioSeleccionado || !bloqueSeleccionado) return; 
    setProcesandoReserva(true); 
    const toastId = toast.loading('Enviando solicitud...');
    await procesarPeticionReserva(toastId);
    setProcesandoReserva(false);
  };

  const procesarPeticionReserva = async (toastId: string | number) => {
    try { 
      const nuevaReserva = { escenario_id: escenarioSeleccionado!.id, usuario_id: session!.user.id, fecha_reserva: fechaSeleccionada, hora_inicio: bloqueSeleccionado!.hora_inicio, hora_fin: bloqueSeleccionado!.hora_fin, estado: 'PENDIENTE_APROBACION', comprobante_url: null }; 
      const res = await fetchAPI('/api/reservas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nuevaReserva) }); 
      if (!res.ok) throw new Error((await res.json()).error); 
      
      toast.success('¡Solicitud enviada!', { description: 'Tu reserva está a la espera de aprobación del administrador.', id: toastId });
      setPaso(1); setEscenarioSeleccionado(null); setFechaObj(null); setFechaSeleccionada(''); setBloqueSeleccionado(null); cargarMisReservas(); setVistaActiva('HISTORIAL'); 
    } catch (error: any) { 
      toast.error('Error al procesar reserva', { description: error.message, id: toastId }); 
    } 
  };

  const leFaltanDatos = !perfil?.documento || !perfil?.codigo || !perfil?.carrera;
  const { minDateObj, maxDateObj } = getFechasPermitidasObj();
  const ESTADOS_TABS = ['TODOS', 'PENDIENTE_APROBACION', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'FINALIZADA'];

  if (cargandoInicial) return <div className="p-8 text-center text-slate-500 animate-pulse">Cargando...</div>;

  // ==========================================
  // VISTA ADMIN (PREMIUM)
  // ==========================================
  if (perfil?.rol === 'ADMIN') {
    return (
      <div className="bg-white p-4 md:p-8 rounded-xl shadow-sm border border-slate-200 min-h-[80vh]">
        
        {/* ENCABEZADO */}
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tight">Centro de Control</h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">Gestiona las reservas y supervisa los accesos.</p>
          </div>
          
          <div className="flex bg-slate-100/80 p-1.5 rounded-2xl w-full md:w-auto border border-slate-200/50">
            <button onClick={() => setVistaAdmin('TABLA')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${vistaAdmin === 'TABLA' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-slate-500 hover:text-[#1A1A1A]'}`}><History size={16} /> Reservas</button>
            <button onClick={() => { setVistaAdmin('ESCANER'); setResultadoEscaneo(null); }} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${vistaAdmin === 'ESCANER' ? 'bg-[#1A1A1A] text-[#FFCC29] shadow-md' : 'text-slate-500 hover:text-[#1A1A1A]'}`}><ScanLine size={16} /> Escáner QR</button>
          </div>
        </div>

        {vistaAdmin === 'TABLA' && (
          <div className="animate-in fade-in duration-500">
            
            {/* COMANDO CENTRAL (Filtros Unificados) */}
            <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 mb-8 space-y-4 shadow-sm">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#FFCC29] transition-colors" size={18} />
                  <input type="text" placeholder="Buscar estudiante o escenario..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-300 outline-none focus:border-[#FFCC29] focus:ring-4 focus:ring-[#FFCC29]/10 bg-white text-sm font-medium transition-all" />
                </div>
                <div className="md:w-64 relative group">
                  <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#FFCC29] z-10 transition-colors" size={18} />
                  <DatePicker selected={filtroFecha ? new Date(`${filtroFecha}T12:00:00`) : null} onChange={(date: Date | null) => setFiltroFecha(date ? formatearFechaBackend(date) : '')} placeholderText="Filtrar por fecha..." locale="es" dateFormat="dd/MM/yyyy" isClearable className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-300 outline-none focus:border-[#FFCC29] focus:ring-4 focus:ring-[#FFCC29]/10 bg-white text-sm font-medium cursor-pointer transition-all" />
                </div>
              </div>
              
              <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide">
                {ESTADOS_TABS.map(estado => (
                  <button key={estado} onClick={() => setFiltroEstado(estado)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-300 border ${filtroEstado === estado ? 'bg-[#1A1A1A] text-[#FFCC29] border-[#1A1A1A] shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                    {estado === 'TODOS' ? 'Todas las reservas' : estado.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* ÁREA DE DATOS */}
            {reservasFiltradas.length === 0 ? (
              <div className="py-20 text-center text-slate-500 bg-slate-50 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-200 mb-4">
                  <Search size={28} className="text-slate-300" />
                </div>
                <p className="font-bold text-[#1A1A1A] text-lg">No se encontraron resultados</p>
                <p className="text-sm mt-1 mb-4">Intenta cambiar los filtros o los términos de búsqueda.</p>
                <button onClick={() => { setBusqueda(''); setFiltroEstado('TODOS'); setFiltroFecha(''); }} className="text-[#1A1A1A] bg-[#FFCC29] px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#e6b825] transition-all shadow-sm">Limpiar filtros</button>
              </div>
            ) : (
              <>
                {/* 💻 DATA GRID PREMIUM (Escritorio) */}
                <div className="hidden md:block bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-xs uppercase tracking-widest text-slate-500 font-bold">
                      <tr>
                        <th className="px-6 py-4">Usuario</th>
                        <th className="px-6 py-4">Escenario</th>
                        <th className="px-6 py-4">Fecha y Hora</th>
                        <th className="px-6 py-4">Estado</th>
                        <th className="px-6 py-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reservasFiltradas.map((res) => (
                        <tr key={res.id} className="hover:bg-slate-50 transition-colors group cursor-default">
                          <td className="px-6 py-4">
                            <button onClick={() => setUsuarioCarnet(res.usuarios)} className="text-left flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#1A1A1A] text-[#FFCC29] font-black flex items-center justify-center text-sm shadow-sm group-hover:scale-105 transition-transform">
                                {res.usuarios?.nombre_completo.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-[#1A1A1A] group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                                  {res.usuarios?.nombre_completo || 'Desconocido'} <Eye size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium tracking-wide uppercase">
                                  {res.usuarios?.rol === 'MEMBER_UPTC' ? 'Estudiante' : res.usuarios?.rol === 'ADMIN' ? 'Administrador' : res.usuarios?.rol}
                                </div>
                              </div>
                            </button>
                          </td>
                          <td className="px-6 py-4 font-bold text-[#1A1A1A] text-sm">{res.escenarios?.nombre}</td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-[#1A1A1A]">{res.fecha_reserva}</div>
                            <div className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5"><Clock size={12}/> {res.hora_inicio.slice(0,5)} - {res.hora_fin.slice(0,5)}</div>
                          </td>
                          <td className="px-6 py-4"><RenderEstado estado={res.estado} /></td>
                          <td className="px-6 py-4 text-right flex justify-end gap-2">
                            {res.estado === 'PENDIENTE_APROBACION' && (
                              <>
                                <button onClick={() => manejarCambioEstado(res, 'APROBADA')} className="p-2.5 bg-green-50 text-green-600 hover:bg-green-500 hover:text-white rounded-xl transition-all hover:shadow-md hover:scale-105" title="Aprobar"><Check size={18} /></button>
                                <button onClick={() => manejarCambioEstado(res, 'RECHAZADA')} className="p-2.5 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-xl transition-all hover:shadow-md hover:scale-105" title="Rechazar"><X size={18} /></button>
                              </>
                            )}
                            {res.estado === 'APROBADA' && (
                              <button onClick={() => manejarCambioEstado(res, 'CANCELADA')} className="p-2.5 bg-slate-50 text-slate-500 hover:bg-red-500 hover:text-white rounded-xl transition-all hover:shadow-md hover:scale-105" title="Cancelar Reserva"><X size={18} /></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 📱 TARJETAS MÓVILES PREMIUM */}
                <div className="md:hidden flex flex-col gap-4">
                  {reservasFiltradas.map((res) => (
                    <div key={res.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col relative overflow-hidden">
                      <div className="flex justify-between items-start mb-4">
                        <button onClick={() => setUsuarioCarnet(res.usuarios)} className="text-left flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#1A1A1A] text-[#FFCC29] font-black flex items-center justify-center text-sm">
                            {res.usuarios?.nombre_completo.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-[#1A1A1A] flex items-center gap-1.5 text-[15px]">
                              {res.usuarios?.nombre_completo || 'Desconocido'} <Eye size={14} className="text-[#FFCC29]" />
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                               {res.usuarios?.rol === 'MEMBER_UPTC' ? 'Estudiante' : res.usuarios?.rol === 'ADMIN' ? 'Administrador' : res.usuarios?.rol}
                            </span>
                          </div>
                        </button>
                      </div>
                      
                      <div className="bg-slate-50 rounded-2xl p-4 text-sm border border-slate-100 mb-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-black text-[#1A1A1A]">{res.escenarios?.nombre}</div>
                          <RenderEstado estado={res.estado} />
                        </div>
                        <div className="flex flex-col gap-2 mt-3 text-xs font-medium text-slate-600">
                          <div className="flex items-center gap-2"><CalendarIcon size={14} className="text-[#FFCC29]"/> {res.fecha_reserva}</div>
                          <div className="flex items-center gap-2"><Clock size={14} className="text-[#FFCC29]"/> {res.hora_inicio.slice(0,5)} - {res.hora_fin.slice(0,5)}</div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        {res.estado === 'PENDIENTE_APROBACION' && (
                          <>
                            <button onClick={() => manejarCambioEstado(res, 'APROBADA')} className="flex-1 py-3.5 bg-green-50 hover:bg-green-500 text-green-700 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"><Check size={16}/> Aprobar</button>
                            <button onClick={() => manejarCambioEstado(res, 'RECHAZADA')} className="flex-1 py-3.5 bg-red-50 hover:bg-red-500 text-red-700 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"><X size={16}/> Rechazar</button>
                          </>
                        )}
                        {res.estado === 'APROBADA' && (
                          <button onClick={() => manejarCambioEstado(res, 'CANCELADA')} className="w-full py-3.5 bg-slate-100 hover:bg-red-500 text-slate-600 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"><X size={16}/> Cancelar</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* CARNET DIGITAL (APPLE WALLET STYLE)        */}
        {/* ========================================== */}
        {usuarioCarnet && (
          <div className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-md flex justify-center items-center z-50 p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 relative border border-slate-200 flex flex-col">
              
              {/* Header Oscuro */}
              <div className="bg-gradient-to-br from-[#1A1A1A] to-[#2d2d2d] h-32 relative flex justify-center border-b-4 border-[#FFCC29]">
                <div className="absolute top-4 right-4"><button onClick={() => setUsuarioCarnet(null)} className="text-slate-400 hover:text-white transition-colors bg-white/10 rounded-full p-1.5 backdrop-blur-sm"><X size={20}/></button></div>
                <div className="absolute top-4 left-4"><span className="text-[#FFCC29] font-black tracking-widest uppercase text-[10px] flex items-center gap-1"><ShieldAlert size={14}/> Credencial UPTC</span></div>
                
                {/* Avatar Flotante */}
                <div className="absolute -bottom-12 w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-xl border-4 border-white rotate-3">
                  <div className="w-full h-full bg-[#FFCC29] rounded-xl flex items-center justify-center font-black text-4xl text-[#1A1A1A] -rotate-3">
                    {usuarioCarnet.nombre_completo.charAt(0).toUpperCase()}
                  </div>
                </div>
              </div>
              
              <div className="pt-16 pb-8 px-8 text-center bg-slate-50/50 flex-1">
                <h3 className="text-2xl font-black text-[#1A1A1A] mb-1 leading-tight">{usuarioCarnet.nombre_completo}</h3>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-8">{usuarioCarnet.rol === 'MEMBER_UPTC' ? 'Estudiante Activo' : usuarioCarnet.rol === 'ADMIN' ? 'Personal Administrativo' : usuarioCarnet.rol}</p>
                
                <div className="grid grid-cols-2 gap-4 text-left bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="col-span-2 border-b border-slate-100 pb-3">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Programa / Carrera</p>
                    <p className="font-black text-[#1A1A1A] text-sm">{usuarioCarnet.carrera || 'No registrado'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Cód. Estudiantil</p>
                    <p className="font-black text-[#1A1A1A] text-sm">{usuarioCarnet.codigo || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Documento</p>
                    <p className="font-black text-[#1A1A1A] text-sm">{usuarioCarnet.documento || 'N/A'}</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-100 p-4 text-center"><p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Pase Oficial de Acceso</p></div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* ESCÁNER HUD (CORREGIDO)                    */}
        {/* ========================================== */}
        {vistaAdmin === 'ESCANER' && (
          <div className="max-w-md mx-auto animate-in slide-in-from-bottom-8 duration-500 mt-4 md:mt-8">
            {!resultadoEscaneo ? (
              <div className="bg-[#1A1A1A] rounded-[2rem] p-6 md:p-8 shadow-2xl border border-slate-800 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#FFCC29] opacity-5 rounded-full blur-3xl pointer-events-none"></div>
                <h3 className="text-white font-black text-2xl mb-2 flex items-center justify-center gap-2 relative z-10"><ScanLine className="text-[#FFCC29]"/> Escáner de Acceso</h3>
                <p className="text-slate-400 text-sm mb-8 relative z-10">Apunta la cámara al código QR del estudiante.</p>
                
                {/* Marco del Escáner Limpio */}
                <div className="relative rounded-2xl overflow-hidden aspect-square bg-black shadow-inner border border-white/10">
                   <div className="opacity-90"><Scanner onScan={(result) => procesarQR(result[0].rawValue)} onError={(error) => console.log(error)} /></div>
                </div>
              </div>
            ) : (
              // TARJETA DE RESULTADO CON CONTRASTE ALTO
              <div className={`relative p-6 pt-14 mt-12 rounded-[2rem] text-center shadow-2xl animate-in zoom-in-95 border-2 ${resultadoEscaneo.valido ? 'bg-[#1A1A1A] border-green-500/30' : 'bg-[#1A1A1A] border-red-500/30'}`}>
                
                {/* EL AVATAR / FOTO (Sobresaliendo por arriba) */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                  {resultadoEscaneo.valido ? (
                    <div className="w-24 h-24 bg-[#FFCC29] rounded-2xl flex items-center justify-center font-black text-4xl text-[#1A1A1A] shadow-[0_10px_20px_rgba(255,204,41,0.3)] border-4 border-[#1A1A1A] rotate-3">
                      <div className="-rotate-3">
                        {resultadoEscaneo.datos?.usuarios?.nombre_completo.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  ) : (
                    <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center shadow-[0_10px_20px_rgba(239,68,68,0.4)] border-4 border-[#1A1A1A]">
                      <AlertCircle size={40} className="text-white" />
                    </div>
                  )}
                </div>

                {/* Badge de estado (Más legible) */}
                <div className="flex justify-center mb-4">
                   {resultadoEscaneo.valido ? 
                     <span className="bg-green-500/20 text-green-400 px-3 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase flex items-center gap-1.5"><CheckCircle2 size={16}/> Acceso Permitido</span> : 
                     <span className="bg-red-500/20 text-red-400 px-3 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase flex items-center gap-1.5"><X size={16}/> Acceso Denegado</span>
                   }
                </div>

                <h2 className="text-xl font-black mb-6 text-white leading-tight">
                  {resultadoEscaneo.mensaje}
                </h2>
                
                {/* Datos con Alto Contraste */}
                {resultadoEscaneo.datos && (
                  <div className="text-left bg-white/5 p-5 rounded-2xl border border-white/10">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Titular del Pase</p>
                    <p className="font-black text-xl mb-4 text-white leading-tight">{resultadoEscaneo.datos.usuarios?.nombre_completo}</p>
                    
                    <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Escenario</p>
                        <p className="font-bold text-sm text-[#FFCC29]">{resultadoEscaneo.datos.escenarios?.nombre}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Horario</p>
                        <p className="font-bold text-sm text-white">{resultadoEscaneo.datos.hora_inicio.slice(0,5)} - {resultadoEscaneo.datos.hora_fin.slice(0,5)}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <button onClick={() => setResultadoEscaneo(null)} className="mt-8 w-full bg-white text-[#1A1A1A] py-3.5 rounded-xl font-black hover:bg-slate-200 transition-all text-sm uppercase tracking-wide">
                  Escanear otro código
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VISTA USUARIO (Miembros UPTC) 
  // ==========================================
  return (
    <div className="bg-white p-4 md:p-8 rounded-xl shadow-sm border border-slate-200 min-h-[80vh] flex flex-col">
      <div className="mb-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4">
        <div><h1 className="text-2xl font-bold text-[#1A1A1A]">Mis Reservas</h1><p className="text-slate-500 mt-1 text-sm">Gestiona tus espacios deportivos.</p></div>
        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button onClick={() => setVistaActiva('NUEVA')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${vistaActiva === 'NUEVA' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-slate-500 hover:text-[#1A1A1A]'}`}><Ticket size={16} /> Agendar</button>
          <button onClick={() => setVistaActiva('HISTORIAL')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${vistaActiva === 'HISTORIAL' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-slate-500 hover:text-[#1A1A1A]'}`}><History size={16} /> Mi Historial</button>
        </div>
      </div>
      
      <div className="flex-1">
        
        {/* ========================================== */}
        {/* WIZARD DE RESERVA PREMIUM (NUEVA)          */}
        {/* ========================================== */}
        {vistaActiva === 'NUEVA' && (
          <div className="animate-in fade-in duration-500">
            
            {/* BARRA DE PROGRESO (STEPPER) */}
            <div className="max-w-2xl mx-auto mb-12 md:mb-16 mt-4">
              <div className="flex items-center justify-between relative px-2 md:px-8">
                {/* Línea de fondo */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1.5 bg-slate-100 rounded-full z-0"></div>
                {/* Línea de progreso amarilla animada */}
                <div 
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-[#FFCC29] rounded-full z-0 transition-all duration-700 ease-out" 
                  style={{ width: paso === 1 ? '0%' : paso === 2 ? '50%' : '100%' }}
                ></div>
                
                {[
                  { num: 1, icon: MapPin, label: 'Escenario' },
                  { num: 2, icon: CalendarIcon, label: 'Fecha' },
                  { num: 3, icon: Clock, label: 'Confirmación' }
                ].map((s) => (
                  <div key={s.num} className="relative z-10 flex flex-col items-center gap-2 md:gap-3 bg-white px-2">
                    <button 
                      onClick={() => s.num < paso ? setPaso(s.num as any) : null}
                      disabled={s.num > paso}
                      className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all duration-500 ${paso >= s.num ? 'bg-[#1A1A1A] text-[#FFCC29] shadow-lg shadow-[#1A1A1A]/20 scale-110' : 'bg-white border-2 border-slate-200 text-slate-300'}`}
                    >
                      <s.icon className={paso >= s.num ? 'w-5 h-5 md:w-6 md:h-6' : 'w-4 h-4 md:w-5 md:h-5'} />
                    </button>
                    <span className={`text-[10px] md:text-xs font-black uppercase tracking-widest transition-colors duration-500 ${paso >= s.num ? 'text-[#1A1A1A]' : 'text-slate-300'}`}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* PASO 1: CATÁLOGO INMERSIVO */}
            {paso === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-8 duration-500">
                {escenarios.map(esc => (
                  <button 
                    key={esc.id} 
                    onClick={() => { setEscenarioSeleccionado(esc); setPaso(2); }} 
                    className="relative text-left rounded-3xl overflow-hidden aspect-[4/3] group shadow-sm hover:shadow-xl transition-all border border-slate-200/50"
                  >
                    <img src={esc.imagen_url || 'https://via.placeholder.com/400x300?text=Escenario'} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" alt={esc.nombre} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-[#1A1A1A]/50 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
                    
                    <div className="absolute bottom-0 left-0 p-6 w-full">
                      <div className="flex justify-between items-end">
                        <div>
                          <h3 className="font-black text-white text-2xl mb-1 group-hover:text-[#FFCC29] transition-colors">{esc.nombre}</h3>
                          <p className="text-slate-300 text-xs font-medium flex items-center gap-1.5"><Users size={14} className="text-[#FFCC29]"/> Aforo máx: {esc.aforo || 'N/A'}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-[#FFCC29] group-hover:text-[#1A1A1A] transition-colors">
                          <ChevronRight size={20} />
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* PASO 2: FECHA */}
            {paso === 2 && escenarioSeleccionado && (
              <div className="max-w-2xl mx-auto animate-in slide-in-from-right-8 duration-500">
                
                {/* Resumen Superior */}
                <div className="flex items-center gap-4 p-4 mb-8 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0"><img src={escenarioSeleccionado.imagen_url} className="w-full h-full object-cover"/></div>
                  <div className="flex-1">
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Has seleccionado</p>
                    <p className="font-black text-[#1A1A1A] text-lg">{escenarioSeleccionado.nombre}</p>
                  </div>
                  <button onClick={() => setPaso(1)} className="p-2 md:p-3 text-slate-500 hover:text-[#1A1A1A] bg-white rounded-lg border border-slate-200 shadow-sm transition-colors" title="Cambiar Escenario"><Edit2 size={16}/></button>
                </div>

                <h2 className="text-xl md:text-2xl font-black text-[#1A1A1A] mb-8 text-center flex items-center justify-center gap-2"><CalendarIcon className="text-[#FFCC29]"/> ¿Qué día vas a jugar?</h2>
                
                <div className="flex justify-center mb-4">
                  <DatePicker 
                    selected={fechaObj} 
                    onChange={(date: Date | null) => { 
                      if (date) {
                        setFechaObj(date); 
                        setFechaSeleccionada(formatearFechaBackend(date)); 
                        setPaso(3); 
                      }
                    }} 
                    minDate={minDateObj} maxDate={maxDateObj} locale="es" inline 
                  />
                </div>
                <p className="text-xs text-slate-400 mt-4 text-center">* Solo puedes reservar para la semana en curso.</p>
              </div>
            )}

            {/* PASO 3: HORA Y CHECKOUT */}
            {paso === 3 && fechaSeleccionada && escenarioSeleccionado && (
              <div className="animate-in slide-in-from-right-8 duration-500">
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <h2 className="text-xl font-black text-[#1A1A1A] flex items-center gap-2"><Clock className="text-[#FFCC29]"/> Selecciona un horario</h2>
                  <button onClick={() => setPaso(2)} className="text-sm px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-[#1A1A1A] rounded-lg font-bold transition-colors flex items-center gap-1">
                    <Edit2 size={14}/> Cambiar fecha
                  </button>
                </div>

                {cargandoHoras ? <p className="text-center text-slate-500 py-12 animate-pulse font-medium">Buscando espacios libres...</p> : bloquesLibres.length === 0 ? <p className="text-center text-red-500 py-12 font-bold">No hay horarios disponibles para esta fecha.</p> : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {bloquesLibres.map((bloque, i) => (
                      <button key={i} onClick={() => setBloqueSeleccionado(bloque)} className={`p-3 rounded-xl border-2 font-bold text-sm flex justify-center items-center gap-1 transition-all ${bloqueSeleccionado?.hora_inicio === bloque.hora_inicio ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#FFCC29] shadow-lg scale-105' : 'border-slate-200 bg-white hover:border-[#FFCC29] text-slate-600'}`}>{bloque.etiqueta}</button>
                    ))}
                  </div>
                )}
                
                {/* EL TICKET BORRADOR (CHECKOUT) */}
                {bloqueSeleccionado && (
                  <div className="mt-12 animate-in slide-in-from-bottom-8 duration-500 max-w-3xl mx-auto">
                    <div className="bg-[#1A1A1A] rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-2xl border border-[#FFCC29]/20">
                      
                      <div className="hidden md:block absolute top-0 right-[35%] w-px h-full bg-white/10 border-dashed border-l border-white/20"></div>
                      <div className="hidden md:block absolute right-[calc(35%-16px)] top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full opacity-10"></div>
                      <div className="md:hidden absolute bottom-[100px] left-0 w-full h-px border-dashed border-b border-white/20"></div>

                      <div className="relative z-10 flex flex-col md:flex-row gap-8">
                        
                        {/* Datos de la Reserva */}
                        <div className="flex-1 md:pr-6">
                          <h3 className="text-xs md:text-sm font-bold text-[#FFCC29] uppercase tracking-widest mb-2 flex items-center gap-2"><Sparkles size={16}/> Resumen de Reserva</h3>
                          <p className="text-3xl md:text-4xl font-black text-white leading-tight mb-8">{escenarioSeleccionado.nombre}</p>
                          
                          <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1 flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                              <div className="w-12 h-12 rounded-xl bg-[#FFCC29]/10 text-[#FFCC29] flex items-center justify-center shrink-0"><CalendarIcon size={20}/></div>
                              <div><p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Fecha</p><p className="font-bold text-white text-sm md:text-base">{fechaSeleccionada}</p></div>
                            </div>
                            <div className="flex-1 flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                              <div className="w-12 h-12 rounded-xl bg-[#FFCC29]/10 text-[#FFCC29] flex items-center justify-center shrink-0"><Clock size={20}/></div>
                              <div><p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Horario</p><p className="font-bold text-white text-sm md:text-base">{bloqueSeleccionado.etiqueta}</p></div>
                            </div>
                          </div>
                        </div>

                        {/* Área de Acción / Formulario Faltante */}
                        <div className="md:w-[35%] flex flex-col justify-center pt-6 md:pt-0">
                          {leFaltanDatos ? (
                            <form onSubmit={manejarGuardarPerfilYReservar} className="space-y-4 animate-in fade-in">
                              <div><p className="text-xs text-[#FFCC29] font-bold mb-3 uppercase tracking-wider text-center">Completa tu perfil para continuar</p></div>
                              <input required type="text" value={datosPerfilFaltantes.documento} onChange={e => setDatosPerfilFaltantes({...datosPerfilFaltantes, documento: e.target.value})} className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-[#FFCC29] text-sm" placeholder="Doc. Identidad"/>
                              <input required type="text" value={datosPerfilFaltantes.codigo} onChange={e => setDatosPerfilFaltantes({...datosPerfilFaltantes, codigo: e.target.value})} className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-[#FFCC29] text-sm" placeholder="Cód. Estudiantil"/>
                              <input required type="text" value={datosPerfilFaltantes.carrera} onChange={e => setDatosPerfilFaltantes({...datosPerfilFaltantes, carrera: e.target.value})} className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-[#FFCC29] text-sm" placeholder="Carrera / Programa"/>
                              <button type="submit" disabled={guardandoPerfil} className="w-full bg-[#FFCC29] text-[#1A1A1A] py-3 rounded-xl font-black hover:bg-[#e6b825] transition-all disabled:opacity-50 mt-2">{guardandoPerfil ? 'Procesando...' : 'Guardar y Reservar'}</button>
                            </form>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full gap-4">
                              <p className="text-xs text-slate-400 text-center px-4 hidden md:block">Todo listo. Al confirmar, tu solicitud pasará a revisión.</p>
                              <button onClick={confirmarReserva} disabled={procesandoReserva} className="w-full bg-[#FFCC29] text-[#1A1A1A] py-4 rounded-xl font-black text-lg hover:bg-[#e6b825] hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,204,41,0.3)] flex justify-center items-center gap-2">
                                {procesandoReserva ? 'Enviando...' : <><CheckCircle2 size={20}/> Confirmar Reserva</>}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* VISTA HISTORIAL RENOVADA (PASES Y PASADAS) */}
        {/* ========================================== */}
        {vistaActiva === 'HISTORIAL' && (
          <div className="animate-in fade-in space-y-10">
            
            {reservasVigentes.length === 0 && reservasPasadas.length === 0 && (
              <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <Ticket className="mx-auto h-12 w-12 text-slate-400 mb-3" />
                <h3 className="text-lg font-medium text-[#1A1A1A]">Aún no tienes reservas</h3>
                <p className="text-sm text-slate-500 mt-1">Cuando agendes un espacio, aparecerá aquí.</p>
                <button onClick={() => setVistaActiva('NUEVA')} className="mt-6 bg-[#1A1A1A] text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-black transition-colors">Hacer mi primera reserva</button>
              </div>
            )}

            {reservasVigentes.length > 0 && (
              <div>
                <h2 className="text-lg font-black text-[#1A1A1A] mb-4 flex items-center gap-2">
                  <Sparkles className="text-[#FFCC29]" /> Pases Activos
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {reservasVigentes.map(res => (
                    <div key={res.id} className="bg-[#1A1A1A] text-white rounded-2xl overflow-hidden shadow-lg border border-white/10 flex flex-col relative group">
                      <div className="absolute top-0 right-[25%] w-px h-full bg-white/10 border-dashed border-l border-white/20"></div>
                      <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full opacity-10"></div>
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full opacity-10"></div>
                      
                      <div className="p-5 border-b border-white/5 relative z-10 flex justify-between items-start">
                        <div className="pr-4">
                          <h3 className="font-black text-xl leading-tight mb-2 text-white">{res.escenarios?.nombre}</h3>
                          <div className="flex flex-col gap-2">
                            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300"><CalendarIcon size={14} className="text-[#FFCC29]" /> {res.fecha_reserva}</span>
                            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300"><Clock size={14} className="text-[#FFCC29]" /> {res.hora_inicio.slice(0,5)} - {res.hora_fin.slice(0,5)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-5 relative z-10 bg-white/5 flex flex-col items-center justify-center min-h-[160px]">
                        {res.estado === 'PENDIENTE_APROBACION' ? (
                          <div className="text-center">
                            <div className="w-12 h-12 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Clock size={24} />
                            </div>
                            <p className="text-sm font-bold text-yellow-400">En Revisión</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto">Esperando aprobación del administrador.</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center text-center">
                            <div className="bg-white p-2 rounded-xl mb-3"><QRCodeSVG value={res.id} size={100} level="H" includeMargin={false} fgColor="#1A1A1A" /></div>
                            <p className="text-xs font-bold text-green-400 uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={14}/> Aprobada</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reservasPasadas.length > 0 && (
              <div>
                <h2 className="text-lg font-black text-slate-400 mb-4 flex items-center gap-2 border-t border-slate-100 pt-8">
                  <History size={20} /> Historial Pasado
                </h2>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="grid grid-cols-1 divide-y divide-slate-200">
                    {reservasPasadas.map(res => (
                      <div key={res.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${res.estado === 'FINALIZADA' ? 'bg-blue-100 text-blue-600' : res.estado === 'RECHAZADA' ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500'}`}>
                            {res.estado === 'FINALIZADA' ? <CheckCircle2 size={20}/> : <X size={20}/>}
                          </div>
                          <div>
                            <h3 className="font-bold text-[#1A1A1A] text-sm">{res.escenarios?.nombre}</h3>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                              <span className="flex items-center gap-1"><CalendarIcon size={12} /> {res.fecha_reserva}</span>
                              <span className="flex items-center gap-1"><Clock size={12} /> {res.hora_inicio.slice(0,5)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto pl-14 md:pl-0">
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider ${res.estado === 'FINALIZADA' ? 'bg-blue-100 text-blue-700' : res.estado === 'RECHAZADA' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>
                            {res.estado.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
}