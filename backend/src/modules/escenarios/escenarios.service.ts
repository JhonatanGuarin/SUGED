import { supabaseAdmin } from '../../core/supabase.js';

// 1. Calcular disponibilidad matemática
export const obtenerBloquesDisponibles = async (escenarioId: string, fecha: string) => {
  const dateObj = new Date(fecha);
  let diaSemana = dateObj.getDay();
  diaSemana = diaSemana === 0 ? 7 : diaSemana; // Ajustamos domingo a 7

  // A. Traer horario base del día
  const { data: horarioBase } = await supabaseAdmin
    .from('horarios_escenarios')
    .select('*')
    .eq('escenario_id', escenarioId)
    .eq('dia_semana', diaSemana)
    .single();

  if (!horarioBase) return []; // Si no hay horario, está cerrado todo el día

  // B. Traer bloqueos excepcionales (mantenimientos/eventos)
  const { data: bloqueos } = await supabaseAdmin
    .from('bloqueos_escenarios')
    .select('hora_inicio, hora_fin')
    .eq('escenario_id', escenarioId)
    .eq('fecha', fecha);

  // C. Traer reservas existentes que ya ocupan espacio
  const { data: reservas } = await supabaseAdmin
    .from('reservas')
    .select('hora_inicio, hora_fin')
    .eq('escenario_id', escenarioId)
    .eq('fecha_reserva', fecha)
    .in('estado', ['PENDIENTE_APROBACION', 'APROBADA']);

  // Unimos todo lo que ocupa tiempo
  const ocupados = [...(bloqueos || []), ...(reservas || [])];

  // D. Matemática: generar bloques de 1 hora y descartar los cruzados
  const bloquesLibres = [];
  let horaActual = parseInt(horarioBase.hora_apertura.split(':')[0]);
  const horaCierre = parseInt(horarioBase.hora_cierre.split(':')[0]);

  while (horaActual < horaCierre) {
    const inicioStr = `${horaActual.toString().padStart(2, '0')}:00:00`;
    const finStr = `${(horaActual + 1).toString().padStart(2, '0')}:00:00`;

    // Verifica si este bloque exacto se cruza con algo ocupado
    const estaOcupado = ocupados.some(o => (inicioStr < o.hora_fin) && (finStr > o.hora_inicio));

    if (!estaOcupado) {
      bloquesLibres.push({
        hora_inicio: inicioStr,
        hora_fin: finStr,
        etiqueta: `${horaActual}:00 - ${horaActual + 1}:00`
      });
    }
    horaActual++;
  }

  return bloquesLibres;
};

// 2. Crear un escenario físico
export const crearEscenarioBase = async (datosEscenario: any) => {
  const { data, error } = await supabaseAdmin
    .from('escenarios')
    .insert([datosEscenario])
    .select()
    .single();

  if (error) throw new Error(`Error creando escenario: ${error.message}`);
  return data;
};

// 3. Asignar un horario recurrente (Ej. Lunes 8am a 6pm)
export const crearHorario = async (escenarioId: string, datosHorario: any) => {
  const { data, error } = await supabaseAdmin
    .from('horarios_escenarios')
    .insert([{ escenario_id: escenarioId, ...datosHorario }])
    .select()
    .single();

  if (error) throw new Error(`Error creando horario: ${error.message}`);
  return data;
};

// 4. Registrar un bloqueo/excepción (Ej. Mantenimiento)
export const crearBloqueo = async (escenarioId: string, datosBloqueo: any) => {
  const { data, error } = await supabaseAdmin
    .from('bloqueos_escenarios')
    .insert([{ escenario_id: escenarioId, ...datosBloqueo }])
    .select()
    .single();

  if (error) throw new Error(`Error creando bloqueo: ${error.message}`);
  return data;
};

export const actualizarEscenarioBase = async (id: string, datos: any) => {
  const { data, error } = await supabaseAdmin
    .from('escenarios')
    .update(datos)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Error actualizando: ${error.message}`);
  return data;
};

export const eliminarEscenarioBase = async (id: string) => {
  const { error } = await supabaseAdmin
    .from('escenarios')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Error eliminando: ${error.message}`);
  return true;
};