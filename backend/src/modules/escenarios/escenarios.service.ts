import { supabaseAdmin } from '../../core/supabase.js';

// 1. Calcular disponibilidad matemática
export const obtenerBloquesDisponibles = async (escenarioId: string, fecha: string) => {
  const dateObj = new Date(fecha);
  let diaSemana = dateObj.getDay();
  diaSemana = diaSemana === 0 ? 7 : diaSemana; 

  // A. Traer horario base del día
  const { data: horarioBase } = await supabaseAdmin
    .from('horarios_escenarios')
    .select('*')
    .eq('escenario_id', escenarioId)
    .eq('dia_semana', diaSemana)
    .single();

  if (!horarioBase) return [];

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

// 3. Asignar o actualizar un horario recurrente (Con regla anti-colisiones)
export const crearHorario = async (escenarioId: string, datosHorario: any) => {
  const hoy = new Date().toISOString().split('T')[0];

  // A. REGLA DE NEGOCIO CRÍTICA: Buscar reservas que queden por fuera del nuevo horario
  const { data: colisiones } = await supabaseAdmin
    .from('reservas')
    .select('id, fecha_reserva, hora_inicio, hora_fin')
    .eq('escenario_id', escenarioId)
    .gte('fecha_reserva', hoy)
    .in('estado', ['PENDIENTE_APROBACION', 'APROBADA']);

  // B. Filtramos en memoria las reservas que caigan en el mismo día de la semana y choquen con el nuevo horario
  const reservasAfectadas = (colisiones || []).filter((reserva) => {
    const fechaObj = new Date(reserva.fecha_reserva);
    let diaReserva = fechaObj.getDay();
    diaReserva = diaReserva === 0 ? 7 : diaReserva; 

    if (diaReserva !== datosHorario.dia_semana) return false;

    const chocaApertura = reserva.hora_inicio < datosHorario.hora_apertura;
    const chocaCierre = reserva.hora_fin > datosHorario.hora_cierre;

    return chocaApertura || chocaCierre;
  });

  // C. Si hay colisiones, bloqueamos el cambio y lanzamos el error
  if (reservasAfectadas.length > 0) {
    throw new Error(`Acción denegada: Modificar este horario dejaría ${reservasAfectadas.length} reserva(s) por fuera del horario de atención. Por favor, cancela esas reservas manualmente antes de aplicar el cambio.`);
  }

  // D. Si pasó el escudo, hacemos el Upsert normal
  const { data, error } = await supabaseAdmin
    .from('horarios_escenarios')
    .upsert(
      [{ escenario_id: escenarioId, ...datosHorario }], 
      { onConflict: 'escenario_id,dia_semana' }
    )
    .select()
    .single();

  if (error) throw new Error(`Error asignando horario: ${error.message}`);
  return data;
};

// 4. Registrar un bloqueo/excepción (Con regla anti-colisiones)
export const crearBloqueo = async (escenarioId: string, datosBloqueo: any) => {
  
  // A. REGLA DE NEGOCIO: Verificar si hay reservas aprobadas o pendientes en ese rango
  const { data: colisiones } = await supabaseAdmin
    .from('reservas')
    .select('id')
    .eq('escenario_id', escenarioId)
    .eq('fecha_reserva', datosBloqueo.fecha)
    .lt('hora_inicio', datosBloqueo.hora_fin) 
    .gt('hora_fin', datosBloqueo.hora_inicio) 
    .in('estado', ['PENDIENTE_APROBACION', 'APROBADA']);

  // B. Si la base de datos encuentra colisiones, abortamos y lanzamos el error
  if (colisiones && colisiones.length > 0) {
    throw new Error(`Acción rechazada: Hay ${colisiones.length} reserva(s) activa(s) o en revisión en ese rango de horas. Por favor, cancela esas reservas antes de bloquear el escenario.`);
  }

  // C. Si el camino está despejado, creamos el bloqueo
  const { data, error } = await supabaseAdmin
    .from('bloqueos_escenarios')
    .insert([{ escenario_id: escenarioId, ...datosBloqueo }])
    .select()
    .single();

  if (error) throw new Error(`Error creando bloqueo: ${error.message}`);
  return data;
};

// 5. Eliminar un bloqueo
export const eliminarBloqueoBase = async (id: string) => {
  const { error } = await supabaseAdmin
    .from('bloqueos_escenarios')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Error eliminando bloqueo: ${error.message}`);
  return true;
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