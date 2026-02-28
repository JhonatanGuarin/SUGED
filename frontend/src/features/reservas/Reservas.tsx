import { useEffect, useState } from 'react';
import { supabase } from '../../app/supabase';
import { useAuth } from '../../app/AuthContext';
import { useLocation } from 'react-router-dom';
import { Calendar as CalendarIcon, Clock, MapPin, ChevronRight, CheckCircle2, Check, X, Upload, Receipt, Ticket, History, QrCode, ScanLine, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Scanner } from '@yudiel/react-qr-scanner';

interface Escenario { id: string; nombre: string; tarifa_hora: number; imagen_url: string; }
interface BloqueDisponible { hora_inicio: string; hora_fin: string; etiqueta: string; }
interface ReservaAdmin {
  id: string; fecha_reserva: string; hora_inicio: string; hora_fin: string; estado: string; 
  escenarios: { nombre: string }; usuarios: { nombre_completo: string; rol: string }; comprobante_url: string | null;
}

export default function Reservas() {
  const { perfil, session } = useAuth();
  const location = useLocation();
  const [cargandoInicial, setCargandoInicial] = useState(true);

  // Estados Admin
  const [reservasAdmin, setReservasAdmin] = useState<ReservaAdmin[]>([]);
  const [vistaAdmin, setVistaAdmin] = useState<'TABLA' | 'ESCANER'>('TABLA');
  const [resultadoEscaneo, setResultadoEscaneo] = useState<{ valido: boolean; mensaje: string; datos?: ReservaAdmin } | null>(null);

  // Estados Usuario
  const [vistaActiva, setVistaActiva] = useState<'NUEVA' | 'HISTORIAL'>('NUEVA');
  const [misReservas, setMisReservas] = useState<any[]>([]);
  useEffect(() => {
    if (location.state && location.state.pestaña) {
      setVistaActiva(location.state.pestaña);
    }
  }, [location]);

  // Estados Wizard Usuario
  const [escenarios, setEscenarios] = useState<Escenario[]>([]);
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1);
  const [escenarioSeleccionado, setEscenarioSeleccionado] = useState<Escenario | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('');
  const [bloquesLibres, setBloquesLibres] = useState<BloqueDisponible[]>([]);
  const [cargandoHoras, setCargandoHoras] = useState(false);
  const [bloqueSeleccionado, setBloqueSeleccionado] = useState<BloqueDisponible | null>(null);
  const [archivoComprobante, setArchivoComprobante] = useState<File | null>(null);
  const [procesandoReserva, setProcesandoReserva] = useState(false);

  useEffect(() => {
    if (perfil?.rol === 'ADMIN') cargarReservasAdmin();
    else { cargarEscenariosUsuario(); cargarMisReservas(); }
  }, [perfil]);

  // --- LÓGICA ADMIN ---
  const cargarReservasAdmin = async () => {
    setCargandoInicial(true);
    const { data } = await supabase
      .from('reservas')
      .select(`id, fecha_reserva, hora_inicio, hora_fin, estado, comprobante_url, escenarios ( nombre ), usuarios!fk_reservas_usuarios ( nombre_completo, rol )`)
      .order('fecha_reserva', { ascending: false });
    if (data) setReservasAdmin(data as any[]);
    setCargandoInicial(false);
  };

  const manejarCambioEstado = async (id: string, nuevoEstado: string) => {
    if (!window.confirm(`¿Seguro que deseas marcar esta reserva como ${nuevoEstado}?`)) return;
    try {
      const res = await fetch(`http://localhost:3000/api/reservas/${id}/estado`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: nuevoEstado })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      alert(`Reserva ${nuevoEstado} con éxito`);
      cargarReservasAdmin(); 
    } catch (error: any) { alert(error.message); }
  };

  const procesarQR = async (textoLector: string) => {
    try {
      // Buscamos el ID en Supabase en tiempo real
      const { data, error } = await supabase
        .from('reservas')
        .select(`id, fecha_reserva, hora_inicio, hora_fin, estado, escenarios ( nombre ), usuarios!fk_reservas_usuarios ( nombre_completo, rol )`)
        .eq('id', textoLector)
        .single();

      if (error || !data) {
        setResultadoEscaneo({ valido: false, mensaje: 'Código QR no válido o reserva no encontrada en el sistema.' });
        return;
      }

      if (data.estado !== 'APROBADA') {
        setResultadoEscaneo({ valido: false, mensaje: `Reserva Denegada. Estado actual: ${data.estado.replace('_', ' ')}` });
        return;
      }

      setResultadoEscaneo({ valido: true, mensaje: '¡Acceso Permitido!', datos: data as any });
    } catch (err) {
      setResultadoEscaneo({ valido: false, mensaje: 'Error al leer el código.' });
    }
  };

  // --- LÓGICA USUARIO (Omitida para no saturar el código aquí, es la misma que ya teníamos) ---
  const cargarEscenariosUsuario = async () => { const { data } = await supabase.from('escenarios').select('*').eq('estado', 'ACTIVO'); if (data) setEscenarios(data); setCargandoInicial(false); };
  const cargarMisReservas = async () => { if (!session) return; const { data } = await supabase.from('reservas').select(`id, fecha_reserva, hora_inicio, hora_fin, estado, comprobante_url, escenarios ( nombre )`).eq('usuario_id', session.user.id).order('fecha_reserva', { ascending: false }); if (data) setMisReservas(data); };
  useEffect(() => { if (escenarioSeleccionado && fechaSeleccionada && perfil?.rol !== 'ADMIN') consultarDisponibilidad(escenarioSeleccionado.id, fechaSeleccionada); }, [escenarioSeleccionado, fechaSeleccionada]);
  const consultarDisponibilidad = async (escenarioId: string, fecha: string) => { setCargandoHoras(true); setBloqueSeleccionado(null); try { const res = await fetch(`http://localhost:3000/api/escenarios/${escenarioId}/disponibilidad?fecha=${fecha}`); if (res.ok) setBloquesLibres((await res.json()).libres); } catch { setBloquesLibres([]); } finally { setCargandoHoras(false); } };
  const confirmarReserva = async () => { if (!session || !escenarioSeleccionado || !bloqueSeleccionado) return; setProcesandoReserva(true); let comprobante_url = null; let estadoFinal = 'APROBADA'; try { if (perfil?.rol !== 'MEMBER_UPTC') { if (!archivoComprobante) throw new Error("Debes adjuntar el comprobante de pago."); estadoFinal = 'PENDIENTE_APROBACION'; const fileExt = archivoComprobante.name.split('.').pop(); const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`; const { error: uploadError } = await supabase.storage.from('comprobantes').upload(fileName, archivoComprobante); if (uploadError) throw new Error("Error al subir el comprobante."); const { data: { publicUrl } } = supabase.storage.from('comprobantes').getPublicUrl(fileName); comprobante_url = publicUrl; } const nuevaReserva = { escenario_id: escenarioSeleccionado.id, usuario_id: session.user.id, fecha_reserva: fechaSeleccionada, hora_inicio: bloqueSeleccionado.hora_inicio, hora_fin: bloqueSeleccionado.hora_fin, estado: estadoFinal, comprobante_url }; const res = await fetch('http://localhost:3000/api/reservas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nuevaReserva) }); if (!res.ok) throw new Error((await res.json()).error); alert(perfil?.rol === 'MEMBER_UPTC' ? '¡Reserva confirmada exitosamente!' : '¡Reserva enviada! Espera la aprobación del administrador.'); setPaso(1); setEscenarioSeleccionado(null); setFechaSeleccionada(''); setBloqueSeleccionado(null); setArchivoComprobante(null); cargarMisReservas(); setVistaActiva('HISTORIAL'); } catch (error: any) { alert(error.message); } finally { setProcesandoReserva(false); } };

  if (cargandoInicial) return <div className="p-8 text-center text-slate-500 animate-pulse">Cargando...</div>;

  // ==========================================
  // VISTA ADMIN
  // ==========================================
  if (perfil?.rol === 'ADMIN') {
    return (
      <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-slate-200 min-h-[80vh]">
        <div className="mb-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">Centro de Control</h1>
            <p className="text-slate-500 mt-1 text-sm">Gestiona reservas y valida entradas.</p>
          </div>
          
          {/* Pestañas de Admin */}
          <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
            <button onClick={() => setVistaAdmin('TABLA')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${vistaAdmin === 'TABLA' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-slate-500 hover:text-[#1A1A1A]'}`}>
              <History size={16} /> Reservas
            </button>
            <button onClick={() => { setVistaAdmin('ESCANER'); setResultadoEscaneo(null); }} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${vistaAdmin === 'ESCANER' ? 'bg-[#FFCC29] text-[#1A1A1A] shadow-sm' : 'text-slate-500 hover:text-[#1A1A1A]'}`}>
              <ScanLine size={16} /> Escanear Entrada
            </button>
          </div>
        </div>

        {/* CONTENIDO ADMIN: TABLA */}
        {vistaAdmin === 'TABLA' && (
          <div className="overflow-x-auto animate-in fade-in">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 text-sm font-bold text-[#1A1A1A]">Usuario</th>
                  <th className="p-4 text-sm font-bold text-[#1A1A1A]">Escenario</th>
                  <th className="p-4 text-sm font-bold text-[#1A1A1A]">Fecha y Hora</th>
                  <th className="p-4 text-sm font-bold text-[#1A1A1A]">Comprobante</th>
                  <th className="p-4 text-sm font-bold text-[#1A1A1A]">Estado</th>
                  <th className="p-4 text-sm font-bold text-[#1A1A1A] text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {reservasAdmin.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">No hay reservas registradas.</td></tr>
                ) : (
                  reservasAdmin.map((res) => (
                    <tr key={res.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-4"><div className="font-bold text-[#1A1A1A]">{res.usuarios?.nombre_completo || 'Usuario Desconocido'}</div><div className="text-xs text-slate-500">{res.usuarios?.rol}</div></td>
                      <td className="p-4 font-bold text-[#1A1A1A]">{res.escenarios?.nombre}</td>
                      <td className="p-4"><div className="text-sm font-bold">{res.fecha_reserva}</div><div className="text-xs text-slate-500">{res.hora_inicio.slice(0,5)} - {res.hora_fin.slice(0,5)}</div></td>
                      <td className="p-4">{res.comprobante_url ? (<a href={res.comprobante_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 text-xs font-bold hover:underline"><Receipt size={14}/> Ver Pago</a>) : <span className="text-xs text-slate-400">N/A</span>}</td>
                      <td className="p-4"><span className={`px-3 py-1 text-xs font-bold rounded-full uppercase ${res.estado === 'PENDIENTE_APROBACION' ? 'bg-yellow-100 text-yellow-800' : res.estado === 'APROBADA' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{res.estado.replace('_', ' ')}</span></td>
                      <td className="p-4 text-right flex justify-end gap-2">
                        {res.estado === 'PENDIENTE_APROBACION' && (
                          <>
                            <button onClick={() => manejarCambioEstado(res.id, 'APROBADA')} className="p-2 bg-green-50 text-green-600 hover:bg-green-500 hover:text-white rounded-lg transition-colors" title="Aprobar"><Check size={18} /></button>
                            <button onClick={() => manejarCambioEstado(res.id, 'RECHAZADA')} className="p-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-lg transition-colors" title="Rechazar"><X size={18} /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* CONTENIDO ADMIN: LECTOR QR */}
        {vistaAdmin === 'ESCANER' && (
          <div className="max-w-md mx-auto animate-in slide-in-from-right-4">
            
            {!resultadoEscaneo ? (
              <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-4 overflow-hidden text-center">
                <p className="font-bold text-[#1A1A1A] mb-4">Apunta la cámara al código QR</p>
                <div className="rounded-xl overflow-hidden shadow-inner">
                  <Scanner 
                    onScan={(result) => procesarQR(result[0].rawValue)}
                    onError={(error) => console.log(error)}
                  />
                </div>
              </div>
            ) : (
              <div className={`p-6 rounded-2xl text-center border-2 ${resultadoEscaneo.valido ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                {resultadoEscaneo.valido ? <CheckCircle2 size={64} className="mx-auto text-green-500 mb-4" /> : <AlertCircle size={64} className="mx-auto text-red-500 mb-4" />}
                
                <h2 className={`text-2xl font-black mb-2 ${resultadoEscaneo.valido ? 'text-green-700' : 'text-red-700'}`}>
                  {resultadoEscaneo.mensaje}
                </h2>
                
                {resultadoEscaneo.datos && (
                  <div className="text-left bg-white p-4 rounded-xl mt-4 border border-green-100 shadow-sm">
                    <p className="text-sm text-slate-500 mb-1">Usuario:</p>
                    <p className="font-bold text-[#1A1A1A] text-lg mb-3">{resultadoEscaneo.datos.usuarios?.nombre_completo}</p>
                    
                    <p className="text-sm text-slate-500 mb-1">Escenario:</p>
                    <p className="font-bold text-[#1A1A1A] mb-3">{resultadoEscaneo.datos.escenarios?.nombre}</p>
                    
                    <p className="text-sm text-slate-500 mb-1">Horario Reservado:</p>
                    <p className="font-bold text-[#1A1A1A]">{resultadoEscaneo.datos.fecha_reserva} | {resultadoEscaneo.datos.hora_inicio.slice(0,5)} - {resultadoEscaneo.datos.hora_fin.slice(0,5)}</p>
                  </div>
                )}

                <button 
                  onClick={() => setResultadoEscaneo(null)}
                  className="mt-6 w-full bg-[#1A1A1A] text-white py-3 rounded-xl font-bold hover:bg-black transition-colors"
                >
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
  // VISTA USUARIO (MEMBER_UPTC o EXTERNO)
  // ==========================================
  // (Mantenemos exactamente la misma vista de usuario con el QR que teníamos en el paso anterior)
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
            <div className="flex items-center gap-2 mb-8 text-sm font-bold overflow-x-auto pb-2">{['Escenario', 'Fecha', 'Hora', ...(perfil?.rol !== 'MEMBER_UPTC' ? ['Pago'] : [])].map((label, i) => (<div key={label} className="flex items-center gap-2 shrink-0"><button className={`flex items-center gap-1 ${paso >= i+1 ? 'text-[#FFCC29]' : 'text-slate-300'}`}><span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${paso >= i+1 ? 'bg-[#1A1A1A] text-[#FFCC29]' : 'bg-slate-100 text-slate-400'}`}>{i+1}</span>{label}</button>{i < (perfil?.rol !== 'MEMBER_UPTC' ? 3 : 2) && <ChevronRight size={16} className="text-slate-300" />}</div>))}</div>
            {paso === 1 && (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{escenarios.map(esc => (<button key={esc.id} onClick={() => { setEscenarioSeleccionado(esc); setPaso(2); }} className="text-left border border-slate-200 rounded-xl overflow-hidden hover:border-[#FFCC29] hover:shadow-md transition-all group bg-white"><div className="h-32 bg-slate-100"><img src={esc.imagen_url} className="h-full w-full object-cover group-hover:scale-105 transition-transform" /></div><div className="p-4"><h3 className="font-bold text-[#1A1A1A] group-hover:text-[#FFCC29]">{esc.nombre}</h3>{perfil?.rol === 'MEMBER_UPTC' ? <span className="text-green-600 text-xs font-bold bg-green-50 px-2 py-0.5 rounded mt-2 inline-block">Gratis (UPTC)</span> : <span className="text-slate-500 text-xs mt-2 block">Tarifa: ${esc.tarifa_hora}/hr</span>}</div></button>))}</div>)}
            {paso === 2 && escenarioSeleccionado && (<div className="max-w-md mx-auto text-center animate-in slide-in-from-right-4"><h2 className="text-lg font-bold text-[#1A1A1A] mb-6 flex items-center justify-center gap-2"><CalendarIcon className="text-[#FFCC29]"/> ¿Cuándo vas a ir a {escenarioSeleccionado.nombre}?</h2><input type="date" min={new Date().toISOString().split('T')[0]} value={fechaSeleccionada} onChange={(e) => { setFechaSeleccionada(e.target.value); setPaso(3); }} className="w-full text-center border-2 border-slate-200 rounded-xl p-4 text-xl font-bold bg-slate-50 focus:border-[#FFCC29] outline-none" /><button onClick={() => setPaso(1)} className="mt-8 text-sm text-slate-400 hover:text-[#1A1A1A] font-bold">← Volver a Escenarios</button></div>)}
            {paso === 3 && fechaSeleccionada && (<div className="animate-in slide-in-from-right-4"><h2 className="text-lg font-bold text-[#1A1A1A] mb-6 flex items-center gap-2"><Clock className="text-[#FFCC29]"/> Horarios Disponibles ({fechaSeleccionada})</h2>{cargandoHoras ? <p className="text-center text-slate-500 py-12 animate-pulse">Calculando...</p> : bloquesLibres.length === 0 ? <p className="text-center text-red-500 py-12 font-bold">No hay horarios disponibles.</p> : (<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">{bloquesLibres.map((bloque, i) => (<button key={i} onClick={() => setBloqueSeleccionado(bloque)} className={`p-3 rounded-xl border-2 font-bold text-sm flex justify-center items-center gap-1 ${bloqueSeleccionado?.hora_inicio === bloque.hora_inicio ? 'border-[#1A1A1A] bg-[#1A1A1A] text-[#FFCC29] shadow-lg scale-105' : 'border-slate-200 hover:border-[#FFCC29]'}`}>{bloque.etiqueta}</button>))}</div>)}{bloqueSeleccionado && (<div className="mt-8 flex justify-end">{perfil?.rol === 'MEMBER_UPTC' ? (<button onClick={confirmarReserva} disabled={procesandoReserva} className="bg-[#FFCC29] text-[#1A1A1A] px-8 py-3 rounded-xl font-bold shadow-sm text-lg hover:bg-[#e6b825]">{procesandoReserva ? 'Procesando...' : 'Confirmar Reserva (Gratis)'}</button>) : (<button onClick={() => setPaso(4)} className="bg-[#1A1A1A] text-white px-8 py-3 rounded-xl font-bold shadow-sm text-lg hover:bg-black">Continuar al Pago →</button>)}</div>)}</div>)}
            {paso === 4 && perfil?.rol !== 'MEMBER_UPTC' && escenarioSeleccionado && bloqueSeleccionado && (<div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-6 md:p-8 animate-in slide-in-from-right-4"><h2 className="text-xl font-bold text-[#1A1A1A] mb-2 flex items-center gap-2"><Receipt className="text-[#FFCC29]"/> Realizar Pago</h2><p className="text-slate-500 text-sm mb-6">Transfiere el valor exacto para asegurar tu reserva en <strong>{escenarioSeleccionado.nombre}</strong>.</p><div className="bg-white p-4 rounded-xl border border-slate-200 mb-6 text-center"><span className="block text-slate-500 text-sm mb-1">Total a pagar (1 hora)</span><span className="text-3xl font-black text-[#1A1A1A]">${escenarioSeleccionado.tarifa_hora}</span></div><div className="space-y-4 mb-8 text-sm"><div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">Banco:</span><strong className="text-[#1A1A1A]">Bancolombia (Ahorros)</strong></div><div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">Número de Cuenta:</span><strong className="text-[#1A1A1A]">123-456789-00</strong></div><div className="flex justify-between pb-2"><span className="text-slate-500">Titular:</span><strong className="text-[#1A1A1A]">UPTC Deportes</strong></div></div><div className="mb-8"><label className="block text-sm font-bold text-[#1A1A1A] mb-2 flex items-center gap-2"><Upload size={16}/> Sube tu comprobante</label><input type="file" accept="image/*,.pdf" onChange={(e) => setArchivoComprobante(e.target.files?.[0] || null)} className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-bold file:bg-[#FFCC29]/20 file:text-[#1A1A1A] cursor-pointer" /></div><div className="flex gap-4"><button onClick={() => setPaso(3)} className="w-1/3 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">Volver</button><button onClick={confirmarReserva} disabled={procesandoReserva || !archivoComprobante} className="w-2/3 bg-[#FFCC29] text-[#1A1A1A] py-3 rounded-xl font-bold hover:bg-[#e6b825] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">{procesandoReserva ? 'Procesando...' : 'Enviar Comprobante'}</button></div></div>)}
          </div>
        )}
        {vistaActiva === 'HISTORIAL' && (<div className="animate-in fade-in">{misReservas.length === 0 ? (<div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300"><Ticket className="mx-auto h-12 w-12 text-slate-400 mb-3" /><h3 className="text-lg font-medium text-[#1A1A1A]">Aún no tienes reservas</h3><p className="text-sm text-slate-500 mt-1">Cuando agendes un espacio, aparecerá aquí.</p><button onClick={() => setVistaActiva('NUEVA')} className="mt-6 bg-[#1A1A1A] text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-black transition-colors">Hacer mi primera reserva</button></div>) : (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{misReservas.map(res => (<div key={res.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col"><div className="p-5 border-b border-slate-100 flex justify-between items-start bg-slate-50/50"><div><h3 className="font-bold text-lg text-[#1A1A1A] leading-tight mb-1">{res.escenarios?.nombre}</h3><span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider inline-block ${res.estado === 'PENDIENTE_APROBACION' ? 'bg-yellow-100 text-yellow-800' : res.estado === 'APROBADA' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{res.estado.replace('_', ' ')}</span></div></div><div className="p-5 flex flex-col gap-3 text-sm text-slate-600 flex-1"><div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100"><CalendarIcon size={18} className="text-[#FFCC29]" /> <span className="font-bold text-[#1A1A1A]">{res.fecha_reserva}</span></div><div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100"><Clock size={18} className="text-[#FFCC29]" /> <span className="font-bold text-[#1A1A1A]">{res.hora_inicio.slice(0,5)} - {res.hora_fin.slice(0,5)}</span></div></div><div className="p-5 pt-0 mt-auto">{res.estado === 'RECHAZADA' && (<div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-100 font-medium">Tu pago no pudo ser validado o el escenario fue cerrado.</div>)}{res.estado === 'PENDIENTE_APROBACION' && (<div className="bg-blue-50 text-blue-700 text-xs p-3 rounded-lg border border-blue-100 font-medium">Tu comprobante está siendo revisado por un administrador.</div>)}{res.estado === 'APROBADA' && (<div className="mt-2 p-4 bg-white border-2 border-dashed border-[#FFCC29] rounded-xl flex flex-col items-center justify-center text-center"><p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Tu pase de entrada</p><div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100"><QRCodeSVG value={res.id} size={120} level="H" includeMargin={false} fgColor="#1A1A1A" /></div><p className="text-[10px] text-slate-400 mt-3 max-w-[200px]">Muestra este código al personal de seguridad en la entrada.</p></div>)}</div></div>))}</div>)}</div>)}
      </div>
    </div>
  );
}