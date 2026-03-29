import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../app/supabase';
import { useAuth } from '../../app/AuthContext';
import { Calendar as CalendarIcon, Clock, MapPin, ChevronRight, CheckCircle2, Check, X, Ticket, History, ScanLine, AlertCircle, Search, Filter, Eye, IdCard } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { fetchAPI } from '../../utils/api';

interface Escenario { id: string; nombre: string; imagen_url: string; }
interface BloqueDisponible { hora_inicio: string; hora_fin: string; etiqueta: string; }
interface UsuarioInfo { nombre_completo: string; rol: string; documento?: string; codigo?: string; carrera?: string; }
interface ReservaAdmin {
  id: string; fecha_reserva: string; hora_inicio: string; hora_fin: string; estado: string; 
  escenarios: { nombre: string }; usuarios: UsuarioInfo;
}

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
  const [misReservas, setMisReservas] = useState<any[]>([]);

  // Estados Wizard Usuario
  const [escenarios, setEscenarios] = useState<Escenario[]>([]);
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [escenarioSeleccionado, setEscenarioSeleccionado] = useState<Escenario | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('');
  const [bloquesLibres, setBloquesLibres] = useState<BloqueDisponible[]>([]);
  const [cargandoHoras, setCargandoHoras] = useState(false);
  const [bloqueSeleccionado, setBloqueSeleccionado] = useState<BloqueDisponible | null>(null);
  const [procesandoReserva, setProcesandoReserva] = useState(false);
  const [datosPerfilFaltantes, setDatosPerfilFaltantes] = useState({ documento: '', codigo: '', carrera: '' });
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  useEffect(() => {
    if (location.state && location.state.pestaña) { setVistaActiva(location.state.pestaña); }
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
      confirmButtonColor: '#FFCC29',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Atrás',
      color: '#1A1A1A',
      customClass: { popup: 'rounded-2xl' }
    });

    if (!confirmacion.isConfirmed) return;
    const toastId = toast.loading('Actualizando estado...');

    try {
      const res = await fetchAPI(`/api/reservas/${reserva.id}/estado`, {
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ estado: nuevoEstado })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      
      toast.success(`Reserva ${nuevoEstado} con éxito`, { id: toastId });
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

      if (error || !data) {
        setResultadoEscaneo({ valido: false, mensaje: 'Código QR no válido o reserva no encontrada.' });
        return;
      }

      if (data.estado !== 'APROBADA') {
        setResultadoEscaneo({ valido: false, mensaje: `Acceso Denegado. Estado: ${data.estado.replace('_', ' ')}` });
        return;
      }

      setResultadoEscaneo({ valido: true, mensaje: 'Acceso Permitido', datos: data as any });
      toast.success('Pase validado correctamente');

    } catch (err) {
      setResultadoEscaneo({ valido: false, mensaje: 'Error de lectura.' });
      toast.error('Ocurrió un error al procesar el código');
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
    const { data } = await supabase.from('reservas').select(`id, fecha_reserva, hora_inicio, hora_fin, estado, escenarios ( nombre )`).eq('usuario_id', session.user.id).order('fecha_reserva', { ascending: false }); 
    if (data) setMisReservas(data); 
  };

  const getFechasPermitidas = () => {
    const hoy = new Date();
    const minDate = new Date(hoy.getTime() - (hoy.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    let diasParaDomingo = 7 - hoy.getDay();
    if (hoy.getDay() === 0) diasParaDomingo = 0; 

    let diasMaximos = diasParaDomingo;
    if (hoy.getDay() === 5 || hoy.getDay() === 6 || hoy.getDay() === 0) { diasMaximos += 7; }

    const max = new Date(hoy.getTime() + (diasMaximos * 24 * 60 * 60 * 1000));
    const maxDate = new Date(max.getTime() - (max.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    return { minDate, maxDate };
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
      setPaso(1); setEscenarioSeleccionado(null); setFechaSeleccionada(''); setBloqueSeleccionado(null); cargarMisReservas(); setVistaActiva('HISTORIAL'); 
    } catch (error: any) { 
      toast.error('Error al procesar reserva', { description: error.message, id: toastId }); 
    } 
  };

  const leFaltanDatos = !perfil?.documento || !perfil?.codigo || !perfil?.carrera;
  const { minDate, maxDate } = getFechasPermitidas();

  // Constantes para el diseño de estados
  const ESTADOS_TABS = ['TODOS', 'PENDIENTE_APROBACION', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'FINALIZADA'];

  if (cargandoInicial) return <div className="p-8 text-center text-slate-500 animate-pulse">Cargando...</div>;

  // ==========================================
  // VISTA ADMIN
  // ==========================================
  if (perfil?.rol === 'ADMIN') {
    return (
      <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-slate-200 min-h-[80vh]">
        <div className="mb-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4">
          <div><h1 className="text-2xl font-bold text-[#1A1A1A]">Centro de Control</h1><p className="text-slate-500 mt-1 text-sm">Gestiona reservas y valida entradas.</p></div>
          <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
            <button onClick={() => setVistaAdmin('TABLA')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${vistaAdmin === 'TABLA' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-slate-500 hover:text-[#1A1A1A]'}`}><History size={16} /> Reservas</button>
            <button onClick={() => { setVistaAdmin('ESCANER'); setResultadoEscaneo(null); }} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${vistaAdmin === 'ESCANER' ? 'bg-[#FFCC29] text-[#1A1A1A] shadow-sm' : 'text-slate-500 hover:text-[#1A1A1A]'}`}><ScanLine size={16} /> Escanear Entrada</button>
          </div>
        </div>

        {/* BARRA DE HERRAMIENTAS Y PESTAÑAS (TABS) */}
        {vistaAdmin === 'TABLA' && (
          <div className="animate-in fade-in">
            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <input type="text" placeholder="Buscar por estudiante o escenario..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-[#FFCC29] bg-white text-sm" />
              </div>
              <div><input type="date" value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-[#FFCC29] bg-white text-sm" /></div>
            </div>

            {/* PESTAÑAS DE ESTADO (SCROLL HORIZONTAL EN MÓVIL) */}
            <div className="flex overflow-x-auto gap-2 pb-2 mb-6 scrollbar-hide">
              {ESTADOS_TABS.map(estado => (
                <button
                  key={estado}
                  onClick={() => setFiltroEstado(estado)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${
                    filtroEstado === estado
                      ? 'bg-[#1A1A1A] text-[#FFCC29] border-[#1A1A1A]'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {estado === 'TODOS' ? 'Todas' : estado.replace('_', ' ')}
                </button>
              ))}
            </div>

            {reservasFiltradas.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <div className="flex flex-col items-center gap-2">
                  <Search size={32} className="text-slate-300" />
                  <p>No se encontraron reservas con esos filtros.</p>
                  <button onClick={() => { setBusqueda(''); setFiltroEstado('TODOS'); setFiltroFecha(''); }} className="text-[#FFCC29] font-bold text-sm hover:underline">Limpiar filtros</button>
                </div>
              </div>
            ) : (
              <>
                {/* 💻 VISTA DE ESCRITORIO (TABLA CLÁSICA) */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse bg-white">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-4 text-sm font-bold text-[#1A1A1A]">Usuario</th>
                        <th className="p-4 text-sm font-bold text-[#1A1A1A]">Escenario</th>
                        <th className="p-4 text-sm font-bold text-[#1A1A1A]">Fecha y Hora</th>
                        <th className="p-4 text-sm font-bold text-[#1A1A1A]">Estado</th>
                        <th className="p-4 text-sm font-bold text-[#1A1A1A] text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservasFiltradas.map((res) => (
                        <tr key={res.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <button onClick={() => setUsuarioCarnet(res.usuarios)} className="text-left group flex items-center gap-2">
                              <div>
                                <div className="font-bold text-[#1A1A1A] group-hover:text-blue-600 flex items-center gap-1 transition-colors">
                                  {res.usuarios?.nombre_completo || 'Usuario Desconocido'} <Eye size={14} className="text-slate-300 group-hover:text-blue-600" />
                                </div>
                                <div className="text-xs text-slate-500">{res.usuarios?.rol}</div>
                              </div>
                            </button>
                          </td>
                          <td className="p-4 font-bold text-[#1A1A1A] text-sm">{res.escenarios?.nombre}</td>
                          <td className="p-4"><div className="text-sm font-bold">{res.fecha_reserva}</div><div className="text-xs text-slate-500">{res.hora_inicio.slice(0,5)} - {res.hora_fin.slice(0,5)}</div></td>
                          <td className="p-4"><span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${res.estado === 'PENDIENTE_APROBACION' ? 'bg-yellow-100 text-yellow-800' : res.estado === 'APROBADA' ? 'bg-green-100 text-green-800' : res.estado === 'FINALIZADA' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>{res.estado.replace('_', ' ')}</span></td>
                          <td className="p-4 text-right flex justify-end gap-2">
                            {res.estado === 'PENDIENTE_APROBACION' && (
                              <><button onClick={() => manejarCambioEstado(res, 'APROBADA')} className="p-2 bg-green-50 text-green-600 hover:bg-green-500 hover:text-white rounded-lg transition-colors" title="Aprobar"><Check size={18} /></button><button onClick={() => manejarCambioEstado(res, 'RECHAZADA')} className="p-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-lg transition-colors" title="Rechazar"><X size={18} /></button></>
                            )}
                            {res.estado === 'APROBADA' && (
                              <button onClick={() => manejarCambioEstado(res, 'CANCELADA')} className="p-2 bg-slate-100 text-slate-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors" title="Cancelar Reserva"><X size={18} /></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 📱 VISTA MÓVIL (TARJETAS) */}
                <div className="md:hidden flex flex-col gap-4">
                  {reservasFiltradas.map((res) => (
                    <div key={res.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-[#1A1A1A]"></div>
                      <div className="flex justify-between items-start pl-2">
                        <button onClick={() => setUsuarioCarnet(res.usuarios)} className="text-left group flex flex-col">
                          <span className="font-bold text-[#1A1A1A] flex items-center gap-1.5 text-[15px]">
                            {res.usuarios?.nombre_completo || 'Usuario Desconocido'} <Eye size={16} className="text-[#FFCC29]" />
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{res.usuarios?.rol}</span>
                        </button>
                        <span className={`px-2.5 py-1 text-[9px] font-bold rounded-full uppercase tracking-wider ${res.estado === 'PENDIENTE_APROBACION' ? 'bg-yellow-100 text-yellow-800' : res.estado === 'APROBADA' ? 'bg-green-100 text-green-800' : res.estado === 'FINALIZADA' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>{res.estado.replace('_', ' ')}</span>
                      </div>
                      
                      <div className="bg-slate-50 rounded-xl p-3 text-sm border border-slate-100 ml-2">
                        <div className="font-black text-[#1A1A1A] mb-2">{res.escenarios?.nombre}</div>
                        <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                          <div className="flex items-center gap-1.5"><CalendarIcon size={14} className="text-[#FFCC29]"/> {res.fecha_reserva}</div>
                          <div className="flex items-center gap-1.5"><Clock size={14} className="text-[#FFCC29]"/> {res.hora_inicio.slice(0,5)} - {res.hora_fin.slice(0,5)}</div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-1 ml-2">
                        {res.estado === 'PENDIENTE_APROBACION' && (
                          <>
                            <button onClick={() => manejarCambioEstado(res, 'APROBADA')} className="flex-1 py-2.5 bg-green-50 hover:bg-green-500 text-green-700 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"><Check size={16}/> Aprobar</button>
                            <button onClick={() => manejarCambioEstado(res, 'RECHAZADA')} className="flex-1 py-2.5 bg-red-50 hover:bg-red-500 text-red-700 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"><X size={16}/> Rechazar</button>
                          </>
                        )}
                        {res.estado === 'APROBADA' && (
                          <button onClick={() => manejarCambioEstado(res, 'CANCELADA')} className="w-full py-2.5 bg-slate-100 hover:bg-red-500 text-slate-600 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"><X size={16}/> Cancelar Reserva</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* MODAL: CARNET DEL USUARIO */}
        {usuarioCarnet && (
          <div className="fixed inset-0 bg-[#1A1A1A]/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 relative border border-slate-200">
              <div className="bg-[#1A1A1A] h-24 relative">
                <div className="absolute top-4 right-4"><button onClick={() => setUsuarioCarnet(null)} className="text-slate-400 hover:text-white transition-colors bg-black/20 rounded-full p-1"><X size={20}/></button></div>
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-[#FFCC29] rounded-2xl flex items-center justify-center font-black text-3xl text-[#1A1A1A] shadow-xl border-4 border-white">{usuarioCarnet.nombre_completo.charAt(0).toUpperCase()}</div>
              </div>
              <div className="pt-14 pb-8 px-6 text-center">
                <h3 className="text-xl font-black text-[#1A1A1A] mb-1">{usuarioCarnet.nombre_completo}</h3>
                <span className="inline-block px-3 py-1 bg-[#FFCC29]/20 text-[#1A1A1A] text-[10px] uppercase font-bold tracking-widest rounded-lg mb-6">{usuarioCarnet.rol === 'MEMBER_UPTC' ? 'Miembro UPTC' : usuarioCarnet.rol}</span>
                <div className="space-y-4 text-left bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0 text-slate-400"><IdCard size={16}/></div><div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Documento</p><p className="font-bold text-[#1A1A1A] text-sm">{usuarioCarnet.documento || 'No registrado'}</p></div></div>
                  <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0 text-slate-400"><span className="text-sm font-black">#</span></div><div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Código Estudiantil</p><p className="font-bold text-[#1A1A1A] text-sm">{usuarioCarnet.codigo || 'No registrado'}</p></div></div>
                  <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0 text-slate-400"><MapPin size={16}/></div><div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Programa / Carrera</p><p className="font-bold text-[#1A1A1A] text-sm">{usuarioCarnet.carrera || 'No registrado'}</p></div></div>
                </div>
              </div>
              <div className="bg-slate-50 border-t border-slate-100 p-3 text-center"><p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">UPTC Deportes</p></div>
            </div>
          </div>
        )}

        {/* LECTOR QR */}
        {vistaAdmin === 'ESCANER' && (
          <div className="max-w-md mx-auto animate-in slide-in-from-right-4">
            {!resultadoEscaneo ? (
              <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-4 overflow-hidden text-center">
                <p className="font-bold text-[#1A1A1A] mb-4">Apunta la cámara al código QR</p>
                <div className="rounded-xl overflow-hidden shadow-inner"><Scanner onScan={(result) => procesarQR(result[0].rawValue)} onError={(error) => console.log(error)} /></div>
              </div>
            ) : (
              <div className={`p-6 rounded-2xl text-center border-2 ${resultadoEscaneo.valido ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                {resultadoEscaneo.valido ? <CheckCircle2 size={64} className="mx-auto text-green-500 mb-4" /> : <AlertCircle size={64} className="mx-auto text-red-500 mb-4" />}
                <h2 className={`text-2xl font-black mb-2 ${resultadoEscaneo.valido ? 'text-green-700' : 'text-red-700'}`}>{resultadoEscaneo.mensaje}</h2>
                {resultadoEscaneo.datos && (<div className="text-left bg-white p-4 rounded-xl mt-4 border border-green-100 shadow-sm"><p className="text-sm text-slate-500 mb-1">Usuario:</p><p className="font-bold text-[#1A1A1A] text-lg mb-3">{resultadoEscaneo.datos.usuarios?.nombre_completo}</p><p className="text-sm text-slate-500 mb-1">Escenario:</p><p className="font-bold text-[#1A1A1A] mb-3">{resultadoEscaneo.datos.escenarios?.nombre}</p><p className="text-sm text-slate-500 mb-1">Horario Reservado:</p><p className="font-bold text-[#1A1A1A]">{resultadoEscaneo.datos.fecha_reserva} | {resultadoEscaneo.datos.hora_inicio.slice(0,5)} - {resultadoEscaneo.datos.hora_fin.slice(0,5)}</p></div>)}
                <button onClick={() => setResultadoEscaneo(null)} className="mt-6 w-full bg-[#1A1A1A] text-white py-3 rounded-xl font-bold hover:bg-black transition-colors">Escanear otro código</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VISTA USUARIO (Miembros UPTC)
  // (Sin cambios aquí, la mantuvimos igual de bonita)
  // ==========================================
  return (
    <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-slate-200 min-h-[80vh] flex flex-col">
      <div className="mb-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4">
        <div><h1 className="text-2xl font-bold text-[#1A1A1A]">Mis Reservas</h1><p className="text-slate-500 mt-1 text-sm">Gestiona tus espacios deportivos.</p></div>
        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button onClick={() => setVistaActiva('NUEVA')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${vistaActiva === 'NUEVA' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-slate-500 hover:text-[#1A1A1A]'}`}><Ticket size={16} /> Agendar</button>
          <button onClick={() => setVistaActiva('HISTORIAL')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${vistaActiva === 'HISTORIAL' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-slate-500 hover:text-[#1A1A1A]'}`}><History size={16} /> Mi Historial</button>
        </div>
      </div>
      
      <div className="flex-1">
        {vistaActiva === 'NUEVA' && (
          <div className="animate-in fade-in">
            <div className="flex items-center gap-2 mb-8 text-sm font-bold overflow-x-auto pb-2">
              {['Escenario', 'Fecha', 'Hora'].map((label, i) => (
                <div key={label} className="flex items-center gap-2 shrink-0">
                  <button className={`flex items-center gap-1 ${paso >= i+1 ? 'text-[#FFCC29]' : 'text-slate-300'}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${paso >= i+1 ? 'bg-[#1A1A1A] text-[#FFCC29]' : 'bg-slate-100 text-slate-400'}`}>{i+1}</span>{label}
                  </button>
                  {i < 2 && <ChevronRight size={16} className="text-slate-300" />}
                </div>
              ))}
            </div>

            {paso === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {escenarios.map(esc => (
                  <button key={esc.id} onClick={() => { setEscenarioSeleccionado(esc); setPaso(2); }} className="text-left border border-slate-200 rounded-xl overflow-hidden hover:border-[#FFCC29] hover:shadow-md transition-all group bg-white">
                    <div className="h-32 bg-slate-100"><img src={esc.imagen_url} className="h-full w-full object-cover group-hover:scale-105 transition-transform" /></div>
                    <div className="p-4"><h3 className="font-bold text-[#1A1A1A] group-hover:text-[#FFCC29]">{esc.nombre}</h3></div>
                  </button>
                ))}
              </div>
            )}

            {paso === 2 && escenarioSeleccionado && (
              <div className="max-w-md mx-auto text-center animate-in slide-in-from-right-4">
                <h2 className="text-lg font-bold text-[#1A1A1A] mb-6 flex items-center justify-center gap-2"><CalendarIcon className="text-[#FFCC29]"/> ¿Cuándo vas a ir a {escenarioSeleccionado.nombre}?</h2>
                <input type="date" min={minDate} max={maxDate} value={fechaSeleccionada} onChange={(e) => { setFechaSeleccionada(e.target.value); setPaso(3); }} className="w-full text-center border-2 border-slate-200 rounded-xl p-4 text-xl font-bold bg-slate-50 focus:border-[#FFCC29] outline-none" />
                <p className="text-xs text-slate-400 mt-4">* Solo puedes reservar para la semana en curso. Los días de la próxima semana se habilitan los viernes.</p>
                <button onClick={() => setPaso(1)} className="mt-8 text-sm text-slate-400 hover:text-[#1A1A1A] font-bold">← Volver a Escenarios</button>
              </div>
            )}

            {paso === 3 && fechaSeleccionada && (
              <div className="animate-in slide-in-from-right-4">
                <h2 className="text-lg font-bold text-[#1A1A1A] mb-6 flex items-center gap-2"><Clock className="text-[#FFCC29]"/> Horarios Disponibles ({fechaSeleccionada})</h2>
                {cargandoHoras ? <p className="text-center text-slate-500 py-12 animate-pulse">Calculando...</p> : bloquesLibres.length === 0 ? <p className="text-center text-red-500 py-12 font-bold">No hay horarios disponibles.</p> : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {bloquesLibres.map((bloque, i) => (
                      <button key={i} onClick={() => setBloqueSeleccionado(bloque)} className={`p-3 rounded-xl border-2 font-bold text-sm flex justify-center items-center gap-1 ${bloqueSeleccionado?.hora_inicio === bloque.hora_inicio ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#FFCC29] shadow-lg scale-105' : 'border-slate-200 hover:border-[#FFCC29]'}`}>{bloque.etiqueta}</button>
                    ))}
                  </div>
                )}
                
                {bloqueSeleccionado && (
                  <div className="mt-8">
                    {leFaltanDatos ? (
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mt-8 animate-in fade-in slide-in-from-bottom-4">
                        <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">Completar Perfil</h3>
                        <p className="text-sm text-slate-500 mb-6">Para solicitar tu primera reserva, necesitamos que completes estos datos institucionales. Solo te los pediremos esta vez.</p>
                        <form onSubmit={manejarGuardarPerfilYReservar} className="space-y-4 max-w-lg">
                          <div><label className="block text-sm font-bold text-[#1A1A1A] mb-1">Documento de Identidad *</label><input required type="text" value={datosPerfilFaltantes.documento} onChange={e => setDatosPerfilFaltantes({...datosPerfilFaltantes, documento: e.target.value})} className="w-full p-3 rounded-lg border border-slate-300 outline-none focus:border-[#FFCC29]" placeholder="Ej. 1002345678"/></div>
                          <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-bold text-[#1A1A1A] mb-1">Código Estudiantil *</label><input required type="text" value={datosPerfilFaltantes.codigo} onChange={e => setDatosPerfilFaltantes({...datosPerfilFaltantes, codigo: e.target.value})} className="w-full p-3 rounded-lg border border-slate-300 outline-none focus:border-[#FFCC29]" placeholder="Ej. 202012345"/></div>
                            <div><label className="block text-sm font-bold text-[#1A1A1A] mb-1">Carrera / Programa *</label><input required type="text" value={datosPerfilFaltantes.carrera} onChange={e => setDatosPerfilFaltantes({...datosPerfilFaltantes, carrera: e.target.value})} className="w-full p-3 rounded-lg border border-slate-300 outline-none focus:border-[#FFCC29]" placeholder="Ej. Ing. Sistemas"/></div>
                          </div>
                          <div className="pt-4 flex justify-end">
                            <button type="submit" disabled={guardandoPerfil} className="bg-[#1A1A1A] text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-colors disabled:opacity-50">{guardandoPerfil ? 'Guardando...' : 'Guardar y Solicitar Reserva'}</button>
                          </div>
                        </form>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button onClick={confirmarReserva} disabled={procesandoReserva} className="bg-[#FFCC29] text-[#1A1A1A] px-8 py-3 rounded-xl font-bold shadow-sm text-lg hover:bg-[#e6b825] transition-colors disabled:opacity-50">{procesandoReserva ? 'Enviando solicitud...' : 'Solicitar Reserva'}</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {vistaActiva === 'HISTORIAL' && (
          <div className="animate-in fade-in">
            {misReservas.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <Ticket className="mx-auto h-12 w-12 text-slate-400 mb-3" />
                <h3 className="text-lg font-medium text-[#1A1A1A]">Aún no tienes reservas</h3>
                <p className="text-sm text-slate-500 mt-1">Cuando agendes un espacio, aparecerá aquí.</p>
                <button onClick={() => setVistaActiva('NUEVA')} className="mt-6 bg-[#1A1A1A] text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-black transition-colors">Hacer mi primera reserva</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {misReservas.map(res => (
                  <div key={res.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                      <div>
                        <h3 className="font-bold text-lg text-[#1A1A1A] leading-tight mb-1">{res.escenarios?.nombre}</h3>
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider inline-block ${res.estado === 'PENDIENTE_APROBACION' ? 'bg-yellow-100 text-yellow-800' : res.estado === 'APROBADA' ? 'bg-green-100 text-green-800' : res.estado === 'FINALIZADA' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>{res.estado.replace('_', ' ')}</span>
                      </div>
                    </div>
                    <div className="p-5 flex flex-col gap-3 text-sm text-slate-600 flex-1">
                      <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100"><CalendarIcon size={18} className="text-[#FFCC29]" /> <span className="font-bold text-[#1A1A1A]">{res.fecha_reserva}</span></div>
                      <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100"><Clock size={18} className="text-[#FFCC29]" /> <span className="font-bold text-[#1A1A1A]">{res.hora_inicio.slice(0,5)} - {res.hora_fin.slice(0,5)}</span></div>
                    </div>
                    <div className="p-5 pt-0 mt-auto">
                      {res.estado === 'RECHAZADA' && <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-100 font-medium">El administrador no aprobó tu solicitud o el escenario fue cerrado.</div>}
                      {res.estado === 'PENDIENTE_APROBACION' && <div className="bg-blue-50 text-blue-700 text-xs p-3 rounded-lg border border-blue-100 font-medium">Tu solicitud está esperando la revisión de un administrador.</div>}
                      {res.estado === 'APROBADA' && (
                        <div className="mt-2 p-4 bg-white border-2 border-dashed border-[#FFCC29] rounded-xl flex flex-col items-center justify-center text-center">
                          <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Tu pase de entrada</p>
                          <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100"><QRCodeSVG value={res.id} size={120} level="H" includeMargin={false} fgColor="#1A1A1A" /></div>
                          <p className="text-[10px] text-slate-400 mt-3 max-w-[200px]">Muestra este código al personal de seguridad en la entrada.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}