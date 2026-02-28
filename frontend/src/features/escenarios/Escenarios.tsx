import { useEffect, useState } from 'react';
import { supabase } from '../../app/supabase'; 
import { useAuth } from '../../app/AuthContext';
import { MapPin, Users, DollarSign, X, Plus, Clock, Edit, Trash2, CalendarOff } from 'lucide-react';

interface Escenario {
  id: string;
  nombre: string;
  descripcion: string;
  aforo: number;
  tarifa_hora: number;
  imagen_url: string;
  estado: 'ACTIVO' | 'MANTENIMIENTO' | 'INACTIVO';
}

export default function Escenarios() {
  const { perfil, session } = useAuth();
  const [escenarios, setEscenarios] = useState<Escenario[]>([]);
  const [cargando, setCargando] = useState(true);

  // Estados Modal Principal (Crear / Editar)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [escenarioEditando, setEscenarioEditando] = useState<Escenario | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Estados Modales Secundarios
  const [escenarioSeleccionado, setEscenarioSeleccionado] = useState<Escenario | null>(null);
  const [isHorarioModalOpen, setIsHorarioModalOpen] = useState(false);
  const [isBloqueoModalOpen, setIsBloqueoModalOpen] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const obtenerEscenarios = async () => {
    setCargando(true);
    const { data, error } = await supabase.from('escenarios').select('*').order('creado_en', { ascending: false });
    if (!error && data) setEscenarios(data);
    setCargando(false);
  };

  useEffect(() => { obtenerEscenarios(); }, []);

  // --- CRUD ESCENARIOS ---
  const abrirModalCrear = () => {
    setEscenarioEditando(null);
    setIsModalOpen(true);
  };

  const abrirModalEditar = (escenario: Escenario) => {
    setEscenarioEditando(escenario);
    setIsModalOpen(true);
  };

  const manejarGuardarEscenario = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!session) return;
    
    setGuardando(true); // Bloqueamos el botón desde el inicio
    
    const formData = new FormData(e.currentTarget);
    let imagen_url_final = escenarioEditando?.imagen_url || null; // Por defecto, mantenemos la que ya tenía (si está editando)

    try {
      // 1. Lógica de subida de imagen a Supabase Storage
      const archivoImagen = formData.get('imagen_archivo') as File;
      
      // Si el usuario seleccionó un archivo nuevo real
      if (archivoImagen && archivoImagen.size > 0) {
        // Generamos un nombre único para que no se sobreescriban fotos con el mismo nombre
        const fileExt = archivoImagen.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

        // Subimos el archivo al bucket 'escenarios'
        const { error: uploadError } = await supabase.storage
          .from('escenarios')
          .upload(fileName, archivoImagen);

        if (uploadError) throw new Error(`Error al subir la foto: ${uploadError.message}`);

        // Pedimos la URL pública de la foto recién subida
        const { data: { publicUrl } } = supabase.storage
          .from('escenarios')
          .getPublicUrl(fileName);

        imagen_url_final = publicUrl; // Reemplazamos por la nueva URL
      }

      // 2. Preparamos los datos para nuestro backend Node.js
      const datosEscenario = {
        nombre: formData.get('nombre'),
        descripcion: formData.get('descripcion'),
        aforo: parseInt(formData.get('aforo') as string) || 0,
        tarifa_hora: parseInt(formData.get('tarifa_hora') as string) || 0,
        estado: formData.get('estado'),
        imagen_url: imagen_url_final // Mandamos la URL real generada por Storage
      };

      const url = escenarioEditando 
        ? `http://localhost:3000/api/escenarios/${escenarioEditando.id}` 
        : 'http://localhost:3000/api/escenarios';
      const method = escenarioEditando ? 'PUT' : 'POST';

      // 3. Enviamos a Node.js
      const res = await fetch(url, { 
        method, 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(datosEscenario) 
      });
      
      if (!res.ok) throw new Error((await res.json()).error);
      
      setIsModalOpen(false);
      obtenerEscenarios(); 
      
    } catch (error: any) { 
      alert(error.message); 
    } finally { 
      setGuardando(false); 
    }
  };

  const manejarEliminar = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este escenario? Esto borrará también sus horarios y reservas.')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/escenarios/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      obtenerEscenarios();
    } catch (error: any) { alert(error.message); }
  };

  // --- HORARIOS Y BLOQUEOS ---
  const manejarGuardarHorario = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!escenarioSeleccionado) return;
    const formData = new FormData(e.currentTarget);
    const datos = {
      dia_semana: parseInt(formData.get('dia_semana') as string),
      hora_apertura: `${formData.get('hora_apertura')}:00`,
      hora_cierre: `${formData.get('hora_cierre')}:00`
    };

    setProcesando(true);
    try {
      const res = await fetch(`http://localhost:3000/api/escenarios/${escenarioSeleccionado.id}/horarios`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      alert('Horario asignado');
      setIsHorarioModalOpen(false);
    } catch (error: any) { alert(error.message); } 
    finally { setProcesando(false); }
  };

  const manejarGuardarBloqueo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!escenarioSeleccionado) return;
    const formData = new FormData(e.currentTarget);
    const datos = {
      fecha: formData.get('fecha'),
      hora_inicio: `${formData.get('hora_inicio')}:00`,
      hora_fin: `${formData.get('hora_fin')}:00`,
      motivo: formData.get('motivo')
    };

    setProcesando(true);
    try {
      const res = await fetch(`http://localhost:3000/api/escenarios/${escenarioSeleccionado.id}/bloqueos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      alert('Bloqueo registrado');
      setIsBloqueoModalOpen(false);
    } catch (error: any) { alert(error.message); } 
    finally { setProcesando(false); }
  };

  return (
    <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-slate-200 min-h-[80vh] relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-8 pb-4 md:pb-6 border-b border-slate-100 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1A1A1A]">Escenarios Deportivos</h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">Gestiona los espacios de la UPTC</p>
        </div>
        {perfil?.rol === 'ADMIN' && (
          <button onClick={abrirModalCrear} className="w-full sm:w-auto bg-[#FFCC29] text-[#1A1A1A] px-5 py-3 md:py-2.5 rounded-lg font-bold hover:bg-[#e6b825] transition-colors shadow-sm flex items-center justify-center gap-2">
            <Plus size={20} /> Nuevo Escenario
          </button>
        )}
      </div>

      {cargando ? (
        <div className="flex justify-center items-center h-40 text-slate-500 font-medium animate-pulse">Cargando escenarios...</div>
      ) : escenarios.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <MapPin className="mx-auto h-12 w-12 text-slate-400 mb-3" />
          <h3 className="text-lg font-medium text-[#1A1A1A]">No hay escenarios registrados</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {escenarios.map((escenario) => (
            <div key={escenario.id} className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow bg-white flex flex-col group">
              <div className="h-40 md:h-48 bg-slate-100 w-full relative overflow-hidden">
                {escenario.imagen_url ? (
                  <img src={escenario.imagen_url} alt={escenario.nombre} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : <div className="h-full w-full flex items-center justify-center text-slate-400">Sin imagen</div>}
                <div className="absolute top-3 right-3">
                  <span className={`text-[10px] md:text-xs font-bold px-2.5 py-1 rounded-full shadow-sm uppercase tracking-wide ${escenario.estado === 'ACTIVO' ? 'bg-green-500 text-white' : escenario.estado === 'MANTENIMIENTO' ? 'bg-[#FFCC29] text-[#1A1A1A]' : 'bg-red-500 text-white'}`}>
                    {escenario.estado}
                  </span>
                </div>
              </div>
              
              <div className="p-4 md:p-5 flex-1 flex flex-col">
                <h3 className="text-lg md:text-xl font-bold text-[#1A1A1A] mb-1">{escenario.nombre}</h3>
                <p className="text-slate-600 text-xs md:text-sm mb-4 line-clamp-2 flex-1">{escenario.descripcion}</p>
                
                <div className="flex flex-col gap-3 text-xs md:text-sm text-slate-700 mt-auto border-t border-slate-100 pt-4">
                <div className="flex justify-between items-center">
                  {/* Aforo se mantiene intacto */}
                  <span className="flex items-center gap-2">
                    <Users size={16} className="text-slate-400" /> 
                    Aforo: <strong className="text-[#1A1A1A]">{escenario.aforo}</strong>
                  </span>
                  
                  {/* Lógica condicional SOLO para la tarifa */}
                  {perfil?.rol === 'MEMBER_UPTC' ? (
                    <span className="text-green-700 font-bold text-[10px] md:text-xs bg-green-50 px-2 py-1 rounded border border-green-200 uppercase tracking-wide">
                      Gratuito (UPTC)
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <DollarSign size={16} className="text-slate-400" /> 
                      <strong className="text-[#1A1A1A]">${escenario.tarifa_hora}/hr</strong>
                    </span>
                  )}
                </div>
                  
                  {/* BOTONERA ADMIN */}
                  {perfil?.rol === 'ADMIN' && (
                    <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-50">
                      <div className="flex gap-1">
                        <button onClick={() => { setEscenarioSeleccionado(escenario); setIsHorarioModalOpen(true); }} className="p-2 text-slate-400 hover:text-[#1A1A1A] hover:bg-[#FFCC29] rounded-md transition-colors" title="Asignar Horario Rutina"><Clock size={18} /></button>
                        <button onClick={() => { setEscenarioSeleccionado(escenario); setIsBloqueoModalOpen(true); }} className="p-2 text-slate-400 hover:text-white hover:bg-red-500 rounded-md transition-colors" title="Bloquear Fecha Excepcional"><CalendarOff size={18} /></button>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => abrirModalEditar(escenario)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Editar Escenario"><Edit size={18} /></button>
                        <button onClick={() => manejarEliminar(escenario.id)} className="p-2 text-slate-400 hover:text-white hover:bg-red-600 rounded-md transition-colors" title="Eliminar Escenario"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: CREAR/EDITAR ESCENARIO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#1A1A1A]/60 backdrop-blur-sm flex justify-center items-end sm:items-center z-50 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 md:p-6 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg md:text-xl font-bold text-[#1A1A1A]">{escenarioEditando ? 'Editar Escenario' : 'Registrar Escenario'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-[#1A1A1A] transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={manejarGuardarEscenario} className="p-5 md:p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#1A1A1A] mb-1.5">Nombre *</label>
                <input required name="nombre" defaultValue={escenarioEditando?.nombre} type="text" className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-[#FFCC29]" />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#1A1A1A] mb-1.5">Descripción</label>
                <textarea name="descripcion" defaultValue={escenarioEditando?.descripcion} rows={3} className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-[#FFCC29] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#1A1A1A] mb-1.5">Aforo *</label>
                  <input required name="aforo" defaultValue={escenarioEditando?.aforo || 0} type="number" className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-[#FFCC29]" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1A1A1A] mb-1.5">Tarifa/Hora *</label>
                  <input required name="tarifa_hora" defaultValue={escenarioEditando?.tarifa_hora || 0} type="number" className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-[#FFCC29]" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#1A1A1A] mb-1.5">Estado</label>
                  <select name="estado" defaultValue={escenarioEditando?.estado || 'ACTIVO'} className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-[#FFCC29] bg-white">
                    <option value="ACTIVO">Activo</option>
                    <option value="MANTENIMIENTO">Mantenimiento</option>
                    <option value="INACTIVO">Inactivo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1A1A1A] mb-1.5">Foto del Escenario</label>
                  {/* Cambiamos a type="file" y aceptamos solo imágenes */}
                  <input 
                    name="imagen_archivo" 
                    type="file" 
                    accept="image/*"
                    className="w-full border border-slate-300 rounded-lg p-2 outline-none focus:border-[#FFCC29] bg-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-bold file:bg-[#FFCC29]/20 file:text-[#1A1A1A] hover:file:bg-[#FFCC29]/30 transition-all cursor-pointer" 
                  />
                  {escenarioEditando?.imagen_url && (
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> 
                      Ya tiene una imagen. Sube otra si deseas cambiarla.
                    </p>
                  )}
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" disabled={guardando} className="bg-[#FFCC29] text-[#1A1A1A] px-5 py-2.5 rounded-lg font-bold hover:bg-[#e6b825]">{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BLOQUEAR FECHA (NUEVO) */}
      {isBloqueoModalOpen && escenarioSeleccionado && (
        <div className="fixed inset-0 bg-[#1A1A1A]/60 backdrop-blur-sm flex justify-center items-end sm:items-center z-50 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="flex justify-between items-center p-5 border-b border-red-500 bg-red-50">
              <h2 className="text-lg font-bold text-red-700 flex items-center gap-2"><CalendarOff size={20}/> Bloquear Fecha</h2>
              <button onClick={() => setIsBloqueoModalOpen(false)} className="text-red-400 hover:text-red-700"><X size={24} /></button>
            </div>
            <form onSubmit={manejarGuardarBloqueo} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#1A1A1A] mb-1.5">Fecha Exacta *</label>
                <input required name="fecha" type="date" className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-red-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#1A1A1A] mb-1.5">Desde *</label>
                  <input required name="hora_inicio" type="time" className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1A1A1A] mb-1.5">Hasta *</label>
                  <input required name="hora_fin" type="time" className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-red-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-[#1A1A1A] mb-1.5">Motivo *</label>
                <input required name="motivo" type="text" placeholder="Ej. Mantenimiento, Torneo..." className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-red-500" />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="submit" disabled={procesando} className="w-full bg-red-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-red-700">{procesando ? 'Procesando...' : 'Bloquear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HORARIOS (El que ya teníamos, lo mantengo aquí para que todo funcione) */}
      {isHorarioModalOpen && escenarioSeleccionado && (
        <div className="fixed inset-0 bg-[#1A1A1A]/60 backdrop-blur-sm flex justify-center items-end sm:items-center z-50 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-[#FFCC29]">
              <h2 className="text-lg font-bold text-[#1A1A1A] flex items-center gap-2"><Clock size={20}/> Horario Rutina</h2>
              <button onClick={() => setIsHorarioModalOpen(false)} className="text-[#1A1A1A]/70 hover:text-[#1A1A1A]"><X size={24} /></button>
            </div>
            <form onSubmit={manejarGuardarHorario} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#1A1A1A] mb-1.5">Día *</label>
                <select name="dia_semana" required className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-[#FFCC29] bg-white">
                  <option value="">Seleccione...</option>
                  <option value="1">Lunes</option><option value="2">Martes</option><option value="3">Miércoles</option><option value="4">Jueves</option><option value="5">Viernes</option><option value="6">Sábado</option><option value="7">Domingo</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#1A1A1A] mb-1.5">Apertura *</label>
                  <input required name="hora_apertura" type="time" defaultValue="08:00" className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-[#FFCC29]" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1A1A1A] mb-1.5">Cierre *</label>
                  <input required name="hora_cierre" type="time" defaultValue="18:00" className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-[#FFCC29]" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="submit" disabled={procesando} className="w-full bg-[#1A1A1A] text-white px-5 py-2.5 rounded-lg font-bold hover:bg-black">{procesando ? 'Procesando...' : 'Asignar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}