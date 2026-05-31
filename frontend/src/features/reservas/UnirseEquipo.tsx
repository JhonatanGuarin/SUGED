import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { supabase } from '../../app/supabase';
import { fetchAPI } from '../../utils/api';
import { Calendar, Clock, MapPin, Users, CheckCircle2, AlertCircle, Sparkles, LogIn } from 'lucide-react';
import { toast } from 'sonner';

interface InfoReserva {
  id: string;
  usuario_id: string;
  fecha_reserva: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  escenarios: { nombre: string; imagen_url: string; aforo: number };
  usuarios: { nombre_completo: string; avatar_url: string };
}

export default function UnirseEquipo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, perfil, recargarPerfil } = useAuth();
  
  const [cargando, setCargando] = useState(true);
  const [reserva, setReserva] = useState<InfoReserva | null>(null);
  const [errorVincular, setErrorVincular] = useState<string | null>(null);
  
  const [procesando, setProcesando] = useState(false);
  const [yaInscrito, setYaInscrito] = useState(false);
  
  // Estado para el peaje de datos faltantes, ahora incluyendo teléfono
  const [datosPerfil, setDatosPerfil] = useState({ documento: '', codigo: '', carrera: '', telefono: '' });

  useEffect(() => {
    document.title = "Unirse al Equipo | SUGED";
    if (id) cargarInfoReserva(id);
  }, [id]);

  const cargarInfoReserva = async (reservaId: string) => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('reservas')
        .select(`
          id, usuario_id, fecha_reserva, hora_inicio, hora_fin, estado, 
          escenarios ( nombre, imagen_url, aforo ), 
          usuarios!fk_reservas_usuarios ( nombre_completo, avatar_url )
        `)
        .eq('id', reservaId)
        .single();

      if (error || !data) throw new Error('La invitación no existe o el enlace es incorrecto.');
      if (data.estado !== 'PENDIENTE' && data.estado !== 'APROBADA') throw new Error('Esta reserva ya no está activa.');
      
      setReserva(data as unknown as InfoReserva);

      if (session) {
        if (session.user.id === data.usuario_id) {
          setYaInscrito(true); 
        } else {
          const { data: participante } = await supabase
            .from('reservas_participantes')
            .select('id')
            .eq('reserva_id', reservaId)
            .eq('usuario_id', session.user.id)
            .maybeSingle();
            
          if (participante) setYaInscrito(true);
        }
      }
    } catch (err: any) {
      setErrorVincular(err.message);
    } finally {
      setCargando(false);
    }
  };

  const manejarLoginDirecto = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.href 
      }
    });

    if (error) {
      toast.error('Error al iniciar sesión');
    }
  };

  const manejarUnirse = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!session || !id) return;

    setProcesando(true);
    const toastId = toast.loading('Procesando solicitud...');

    try {
      // Verificamos si falta el teléfono junto con los demás datos
      const leFaltanDatos = !perfil?.documento || !perfil?.codigo || !perfil?.carrera || !perfil?.telefono;
      if (leFaltanDatos) {
        const { error: errorPerfil } = await supabase
          .from('usuarios')
          .update(datosPerfil)
          .eq('id', session.user.id);
          
        if (errorPerfil) throw new Error("Error al guardar tus datos de estudiante.");
        await recargarPerfil();
      }

      const res = await fetchAPI(`/api/reservas/${id}/unirse`, { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Error al unirse al equipo.');

      toast.success('¡Te has unido al equipo!', { id: toastId });
      setYaInscrito(true);
      
    } catch (error: any) {
      toast.error('Acción rechazada', { description: error.message, id: toastId });
    } finally {
      setProcesando(false);
    }
  };

  const obtenerAvatarHD = (url?: string) => url?.includes('googleusercontent.com') ? url.replace(/=s\d+-c/, '=s400-c') : url;
  
  // Condición de renderizado actualizada con el teléfono
  const leFaltanDatos = session && (!perfil?.documento || !perfil?.codigo || !perfil?.carrera || !perfil?.telefono);

  if (cargando) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><div className="animate-pulse text-slate-400 font-bold">Cargando invitación...</div></div>;
  }

  if (errorVincular || !reserva) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-8 rounded-[2rem] shadow-xl border border-slate-200 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle size={40} className="text-red-500"/></div>
          <h1 className="text-2xl font-black text-[#1A1A1A] mb-2">Invitación no válida</h1>
          <p className="text-slate-500 mb-8">{errorVincular}</p>
          <button onClick={() => navigate('/reservas')} className="bg-[#1A1A1A] text-white px-6 py-3 rounded-xl font-bold w-full hover:bg-black transition-colors">Volver a mis reservas</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Fondo Decorativo */}
      <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[50%] md:w-[40%] md:h-[40%] bg-[#FFCC29] opacity-20 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[50%] md:w-[40%] md:h-[40%] bg-[#1A1A1A] opacity-10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-lg relative z-10 animate-in zoom-in-95 duration-500">
        
        <div className="bg-[#1A1A1A] rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10 text-white relative">
          
          {/* Cabecera con la imagen del escenario */}
          <div className="h-40 md:h-48 relative">
            <img src={reserva.escenarios.imagen_url || 'https://via.placeholder.com/800x400'} className="w-full h-full object-cover" alt="Escenario" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] to-transparent"></div>
            
            {/* Foto del Titular Flotante */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
              <div className="w-20 h-20 rounded-2xl bg-[#FFCC29] p-1 shadow-lg rotate-3">
                <div className="w-full h-full rounded-xl overflow-hidden bg-white -rotate-3">
                  {reserva.usuarios?.avatar_url ? (
                    <img src={obtenerAvatarHD(reserva.usuarios.avatar_url)} className="w-full h-full object-cover scale-110" alt="Avatar" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-800 font-black text-2xl">
                      {reserva.usuarios?.nombre_completo.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 md:px-8 pt-12 pb-8 text-center">
            <h2 className="text-[10px] font-bold text-[#FFCC29] uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5"><Sparkles size={14}/> Invitación VIP</h2>
            <h1 className="text-xl md:text-2xl font-black mb-1">{reserva.usuarios.nombre_completo}</h1>
            <p className="text-slate-400 text-sm mb-8">te ha invitado a unirte a su equipo.</p>

            {/* Tarjeta de Resumen */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 mb-8 text-left grid grid-cols-2 gap-4 relative overflow-hidden">
               <div className="col-span-2 pb-3 border-b border-white/10">
                 <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Escenario Deportivo</p>
                 <p className="font-bold text-base md:text-lg text-white flex items-center gap-2"><MapPin size={16} className="text-[#FFCC29] shrink-0"/> {reserva.escenarios.nombre}</p>
               </div>
               <div>
                 <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Día</p>
                 <p className="font-bold text-xs md:text-sm text-white flex items-center gap-2"><Calendar size={14} className="text-[#FFCC29] shrink-0"/> {reserva.fecha_reserva}</p>
               </div>
               <div>
                 <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Horario</p>
                 <p className="font-bold text-xs md:text-sm text-white flex items-center gap-2"><Clock size={14} className="text-[#FFCC29] shrink-0"/> {reserva.hora_inicio.slice(0,5)} - {reserva.hora_fin.slice(0,5)}</p>
               </div>
            </div>

            {/* Lógica de Estados (No sesión -> Faltan Datos -> Listo) */}
            {!session ? (
              <div className="bg-[#FFCC29]/10 border border-[#FFCC29]/20 rounded-2xl p-5">
                <p className="text-[#FFCC29] font-bold text-sm mb-4">Debes identificarte como estudiante de la UPTC para aceptar la invitación.</p>
                <button onClick={manejarLoginDirecto} className="w-full bg-[#FFCC29] text-[#1A1A1A] py-3.5 rounded-xl font-black hover:bg-[#e6b825] transition-all flex items-center justify-center gap-2">
                  <LogIn size={18}/> Iniciar Sesión con Google
                </button>
              </div>
            ) : yaInscrito ? (
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 text-center">
                <div className="w-12 h-12 bg-green-500 text-[#1A1A1A] rounded-full flex items-center justify-center mx-auto mb-3"><CheckCircle2 size={24}/></div>
                <h3 className="text-green-400 font-black text-lg mb-1">¡Ya eres del equipo!</h3>
                <p className="text-green-500/80 text-xs font-medium">Estás en la lista oficial de ingreso.</p>
              </div>
            ) : leFaltanDatos ? (
              <form onSubmit={manejarUnirse} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left animate-in slide-in-from-bottom-4">
                <p className="text-[#FFCC29] font-bold text-[11px] md:text-xs uppercase tracking-wider mb-4 text-center">Completa tu credencial para unirte</p>
                <div className="space-y-3">
                  <input required type="text" value={datosPerfil.documento} onChange={e => setDatosPerfil({...datosPerfil, documento: e.target.value})} className="w-full p-3.5 rounded-xl bg-black/20 border border-white/10 text-white outline-none focus:border-[#FFCC29] text-sm transition-all" placeholder="Doc. Identidad"/>
                  <input required type="text" value={datosPerfil.codigo} onChange={e => setDatosPerfil({...datosPerfil, codigo: e.target.value})} className="w-full p-3.5 rounded-xl bg-black/20 border border-white/10 text-white outline-none focus:border-[#FFCC29] text-sm transition-all" placeholder="Cód. Estudiantil"/>
                  <input required type="text" value={datosPerfil.carrera} onChange={e => setDatosPerfil({...datosPerfil, carrera: e.target.value})} className="w-full p-3.5 rounded-xl bg-black/20 border border-white/10 text-white outline-none focus:border-[#FFCC29] text-sm transition-all" placeholder="Carrera / Programa"/>
                  {/* Nuevo input para el número de celular */}
                  <input required type="tel" value={datosPerfil.telefono} onChange={e => setDatosPerfil({...datosPerfil, telefono: e.target.value})} className="w-full p-3.5 rounded-xl bg-black/20 border border-white/10 text-white outline-none focus:border-[#FFCC29] text-sm transition-all" placeholder="Número de Celular"/>
                  <button type="submit" disabled={procesando} className="w-full bg-[#FFCC29] text-[#1A1A1A] py-3.5 rounded-xl font-black hover:bg-[#e6b825] transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(255,204,41,0.2)] mt-2">
                    {procesando ? 'Inscribiendo...' : 'Guardar y Unirme'}
                  </button>
                </div>
              </form>
            ) : (
              <button onClick={() => manejarUnirse()} disabled={procesando} className="w-full bg-[#FFCC29] text-[#1A1A1A] py-4 rounded-xl font-black text-base md:text-lg hover:bg-[#e6b825] active:scale-95 transition-all shadow-[0_0_20px_rgba(255,204,41,0.3)] flex justify-center items-center gap-2">
                 {procesando ? 'Procesando...' : <><Users size={20}/> Unirme al Equipo</>}
              </button>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}