import { useEffect, useState } from 'react';
import { supabase } from '../../app/supabase';
import { useAuth } from '../../app/AuthContext';
import { Calendar as CalendarIcon, Clock, MapPin, X } from 'lucide-react';

interface Reserva {
  id: string;
  fecha_reserva: string;
  hora_inicio: string;
  hora_fin: string;
  estado: 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'COMPLETADA';
  escenarios: { nombre: string };
}

interface EscenarioDisponible {
  id: string;
  nombre: string;
}

export default function Reservas() {
  const { session, perfil } = useAuth();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [cargando, setCargando] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [escenariosDisponibles, setEscenariosDisponibles] = useState<EscenarioDisponible[]>([]);

  // NUEVO ENFOQUE: Calculamos fechas exactas para que el usuario solo elija "Hoy" o "Mañana"
  const hoy = new Date().toISOString().split('T')[0];
  const mananaDate = new Date();
  mananaDate.setDate(mananaDate.getDate() + 1);
  const manana = mananaDate.toISOString().split('T')[0];

  // NUEVO ENFOQUE: Bloques de hora estrictos, con el formato de Supabase perfecto ('HH:MM:SS')
  const bloquesHorarios = [
    { inicio: '08:00:00', fin: '10:00:00', etiqueta: 'Mañana: 8:00 AM - 10:00 AM' },
    { inicio: '10:00:00', fin: '12:00:00', etiqueta: 'Mañana: 10:00 AM - 12:00 PM' },
    { inicio: '14:00:00', fin: '16:00:00', etiqueta: 'Tarde: 2:00 PM - 4:00 PM' },
    { inicio: '16:00:00', fin: '18:00:00', etiqueta: 'Tarde: 4:00 PM - 6:00 PM' },
  ];

  const obtenerReservas = async () => {
    if (!session || !perfil) return;
    setCargando(true);

    let consulta = supabase
      .from('reservas')
      .select('*, escenarios(nombre)')
      .order('fecha_reserva', { ascending: false });

    if (perfil.rol !== 'ADMIN') {
      consulta = consulta.eq('usuario_id', session.user.id);
    }

    const { data, error } = await consulta;
    if (error) console.error('Error al obtener reservas:', error.message);
    else if (data) setReservas(data as any);
    
    setCargando(false);
  };

  const cargarEscenarios = async () => {
    const { data, error } = await supabase.from('escenarios').select('id, nombre').eq('estado', 'ACTIVO');
    if (!error && data) setEscenariosDisponibles(data);
  };

  useEffect(() => {
    obtenerReservas();
    cargarEscenarios();
  }, [session, perfil]);

  const manejarGuardar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); 
    if (!session) return;
    
    const formData = new FormData(e.currentTarget);
    const escenario_id = formData.get('escenario_id') as string;
    const fecha_reserva = formData.get('fecha_reserva') as string;
    
    // Aquí sacamos el bloque elegido y lo partimos para tener inicio y fin limpios
    const bloqueElegido = formData.get('bloque_horario') as string;
    const [hora_inicio, hora_fin] = bloqueElegido.split('|');

    if (!escenario_id || !fecha_reserva || !bloqueElegido) {
      return alert('Selecciona todos los datos por favor.');
    }

    setGuardando(true);

    const { error } = await supabase
      .from('reservas')
      .insert([{
        usuario_id: session.user.id,
        escenario_id,
        fecha_reserva,
        hora_inicio, // Ya viene perfecto: "14:00:00"
        hora_fin,    // Ya viene perfecto: "16:00:00"
        estado: 'PENDIENTE_APROBACION'
      }]);

    setGuardando(false);

    if (error) {
      alert('Error de base de datos: ' + error.message);
    } else {
      setIsModalOpen(false);
      obtenerReservas(); 
    }
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 min-h-[80vh] relative">
      <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            {perfil?.rol === 'ADMIN' ? 'Todas las Reservas' : 'Mis Reservas'}
          </h1>
          <p className="text-slate-500 mt-1">Gestiona los espacios deportivos</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm">
          + Nueva Reserva
        </button>
      </div>

      {cargando ? (
        <div className="flex justify-center items-center h-40 text-slate-500 font-medium animate-pulse">Cargando reservas...</div>
      ) : reservas.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <CalendarIcon className="mx-auto h-12 w-12 text-slate-400 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No hay reservas</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reservas.map((reserva) => (
            <div key={reserva.id} className="border border-slate-200 rounded-xl p-5 hover:border-blue-300 transition-colors flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 text-lg font-bold text-slate-800">
                  <MapPin className="text-blue-500" size={20} />
                  {reserva.escenarios?.nombre}
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                  reserva.estado === 'CONFIRMADA' ? 'bg-green-100 text-green-700' : 
                  reserva.estado === 'PENDIENTE' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                }`}>
                  {reserva.estado}
                </span>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 flex flex-col gap-2 text-sm text-slate-700 border border-slate-100">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} className="text-slate-400" />
                  <span>Fecha: <strong>{reserva.fecha_reserva}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-slate-400" />
                  <span>Horario: <strong>{reserva.hora_inicio} - {reserva.hora_fin}</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Agendar Espacio</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* FORMULARIO SIMPLIFICADO: Solo listas desplegables, nada de escribir a mano */}
            <form onSubmit={manejarGuardar} className="p-6 space-y-5">
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Escenario Deportivo</label>
                <select name="escenario_id" className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-blue-500 bg-white shadow-sm">
                  {escenariosDisponibles.map(esc => <option key={esc.id} value={esc.id}>{esc.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Día de la reserva</label>
                <select name="fecha_reserva" className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-blue-500 bg-white shadow-sm">
                  <option value={hoy}>Hoy ({hoy})</option>
                  <option value={manana}>Mañana ({manana})</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bloque Horario</label>
                <select name="bloque_horario" className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-blue-500 bg-white shadow-sm">
                  {bloquesHorarios.map(b => (
                    <option key={b.inicio} value={`${b.inicio}|${b.fin}`}>{b.etiqueta}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                  {guardando ? 'Reservando...' : 'Confirmar Reserva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}