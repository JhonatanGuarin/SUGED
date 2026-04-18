import { supabaseAdmin } from '../../core/supabase.js';

// 1. Calcular disponibilidad matemática (CUADRÍCULA INTELIGENTE 2H/1H)
export const obtenerBloquesDisponibles = async (escenarioId: string, fecha: string) => {
  const dateObj = new Date(fecha);
  let diaSemana = dateObj.getDay();
  diaSemana = diaSemana === 0 ? 7 : diaSemana; 

  const { data: horarioBase } = await supabaseAdmin
    .from('horarios_escenarios')
    .select('*')
    .eq('escenario_id', escenarioId)
    .eq('dia_semana', diaSemana)
    .single();

  if (!horarioBase) return [];

  const { data: bloqueosPuntuales } = await supabaseAdmin.from('bloqueos_escenarios').select('hora_inicio, hora_fin').eq('escenario_id', escenarioId).eq('fecha', fecha);
  const { data: bloqueosFijos } = await supabaseAdmin.from('bloqueos_recurrentes').select('hora_inicio, hora_fin').eq('escenario_id', escenarioId).eq('dia_semana', diaSemana);

  // ¡CORRECCIÓN!: Ya no tomamos en cuenta las FINALIZADAS
  const { data: reservas } = await supabaseAdmin
    .from('reservas')
    .select('hora_inicio, hora_fin')
    .eq('escenario_id', escenarioId)
    .eq('fecha_reserva', fecha)
    .in('estado', ['PENDIENTE', 'APROBADA']); 

  const ocupados = [
    ...(bloqueosPuntuales || []), 
    ...(bloqueosFijos || []), 
    ...(reservas || [])
  ];

  const bloquesLibres = [];
  let horaActual = parseInt(horarioBase.hora_apertura.split(':')[0]);
  const horaCierre = parseInt(horarioBase.hora_cierre.split(':')[0]);

  const now = new Date();
  const colombiaTime = new Date(now.getTime() - (5 * 3600 * 1000));
  const fechaLocal = colombiaTime.toISOString().split('T')[0];
  const horaActualDelDia = colombiaTime.getUTCHours();

  while (horaActual < horaCierre) {
    const finGrid = Math.min(horaActual + 2, horaCierre);
    
    let h1Free = true;
    let h2Free = (finGrid - horaActual === 2); 

    const h1Inicio = `${horaActual.toString().padStart(2, '0')}:00:00`;
    const h1Fin = `${(horaActual + 1).toString().padStart(2, '0')}:00:00`;
    
    if (fecha === fechaLocal && horaActual < horaActualDelDia) h1Free = false;
    if (ocupados.some(o => (h1Inicio < o.hora_fin) && (h1Fin > o.hora_inicio))) h1Free = false;

    let h2Inicio = "", h2Fin = "";
    if (h2Free) {
        h2Inicio = `${(horaActual + 1).toString().padStart(2, '0')}:00:00`;
        h2Fin = `${(horaActual + 2).toString().padStart(2, '0')}:00:00`;
        
        if (fecha === fechaLocal && (horaActual + 1) < horaActualDelDia) h2Free = false;
        if (ocupados.some(o => (h2Inicio < o.hora_fin) && (h2Fin > o.hora_inicio))) h2Free = false;
    }

    if (h1Free && h2Free) {
        bloquesLibres.push({ hora_inicio: h1Inicio, hora_fin: h2Fin, etiqueta: `${horaActual}:00 - ${horaActual + 2}:00` });
    } else if (h1Free && !h2Free) {
        bloquesLibres.push({ hora_inicio: h1Inicio, hora_fin: h1Fin, etiqueta: `${horaActual}:00 - ${horaActual + 1}:00` });
    } else if (!h1Free && h2Free) {
        bloquesLibres.push({ hora_inicio: h2Inicio, hora_fin: h2Fin, etiqueta: `${horaActual + 1}:00 - ${horaActual + 2}:00` });
    }

    horaActual += 2;
  }

  return bloquesLibres;
};

export const crearEscenarioBase = async (datosEscenario: any) => {
  delete datosEscenario.tarifa_hora; 

  const { data, error } = await supabaseAdmin
    .from('escenarios')
    .insert([datosEscenario])
    .select()
    .single();

  if (error) throw new Error(`Error creando escenario: ${error.message}`);
  return data;
};

export const actualizarEscenarioBase = async (id: string, datos: any) => {
  delete datos.tarifa_hora;

  const { data, error } = await supabaseAdmin
    .from('escenarios')
    .update(datos)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Error actualizando: ${error.message}`);
  return data;
};

export const crearHorario = async (escenarioId: string, datosHorario: any) => {
  const hoy = new Date().toISOString().split('T')[0];

  // ¡CORRECCIÓN!: Ya no tomamos en cuenta las FINALIZADAS
  const { data: colisiones } = await supabaseAdmin
    .from('reservas')
    .select('id, fecha_reserva, hora_inicio, hora_fin')
    .eq('escenario_id', escenarioId)
    .gte('fecha_reserva', hoy)
    .in('estado', ['PENDIENTE', 'APROBADA']); 

  const reservasAfectadas = (colisiones || []).filter((reserva) => {
    const fechaObj = new Date(reserva.fecha_reserva);
    let diaReserva = fechaObj.getDay();
    diaReserva = diaReserva === 0 ? 7 : diaReserva; 

    if (diaReserva !== datosHorario.dia_semana) return false;

    const chocaApertura = reserva.hora_inicio < datosHorario.hora_apertura;
    const chocaCierre = reserva.hora_fin > datosHorario.hora_cierre;

    return chocaApertura || chocaCierre;
  });

  if (reservasAfectadas.length > 0) {
    throw new Error(`Acción denegada: Modificar este horario dejaría ${reservasAfectadas.length} reserva(s) por fuera del horario de atención. Por favor, cancela esas reservas manualmente antes de aplicar el cambio.`);
  }

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

export const crearBloqueo = async (escenarioId: string, datosBloqueo: any) => {
  // ¡CORRECCIÓN!: Ya no tomamos en cuenta las FINALIZADAS
  const { data: colisiones } = await supabaseAdmin
    .from('reservas')
    .select('id')
    .eq('escenario_id', escenarioId)
    .eq('fecha_reserva', datosBloqueo.fecha)
    .lt('hora_inicio', datosBloqueo.hora_fin) 
    .gt('hora_fin', datosBloqueo.hora_inicio) 
    .in('estado', ['PENDIENTE', 'APROBADA']); 

  if (colisiones && colisiones.length > 0) {
    throw new Error(`Acción rechazada: Hay ${colisiones.length} reserva(s) activa(s) o en revisión en ese rango de horas. Por favor, cancela esas reservas antes de bloquear el escenario.`);
  }

  const { data, error } = await supabaseAdmin
    .from('bloqueos_escenarios')
    .insert([{ escenario_id: escenarioId, ...datosBloqueo }])
    .select()
    .single();

  if (error) throw new Error(`Error creando bloqueo: ${error.message}`);
  return data;
};

export const eliminarBloqueoBase = async (id: string) => {
  const { error } = await supabaseAdmin
    .from('bloqueos_escenarios')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Error eliminando bloqueo: ${error.message}`);
  return true;
};

export const eliminarEscenarioBase = async (id: string) => {
  const { error } = await supabaseAdmin
    .from('escenarios')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Error eliminando: ${error.message}`);
  return true;
};

export const crearBloqueoRecurrente = async (escenarioId: string, datosBloqueoFijo: any) => {
  const { data, error } = await supabaseAdmin
    .from('bloqueos_recurrentes')
    .insert([{ escenario_id: escenarioId, ...datosBloqueoFijo }])
    .select()
    .single();

  if (error) throw new Error(`Error creando bloqueo fijo: ${error.message}`);
  return data;
};

export const eliminarBloqueoRecurrenteBase = async (id: string) => {
  const { error } = await supabaseAdmin
    .from('bloqueos_recurrentes')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Error eliminando bloqueo fijo: ${error.message}`);
  return true;
};

export const obtenerReservaActual = async (escenarioId: string) => {
  const now = new Date();
  const colombiaTime = new Date(now.getTime() - (5 * 3600 * 1000));
  const fechaLocal = colombiaTime.toISOString().split('T')[0];
  
  const horaExactaStr = colombiaTime.toISOString().substring(11, 19); 

  const { data, error } = await supabaseAdmin
    .from('reservas')
    .select(`
      id, 
      hora_inicio, 
      hora_fin, 
      usuarios!fk_reservas_usuarios(nombre_completo)
    `)
    .eq('escenario_id', escenarioId)
    .eq('fecha_reserva', fechaLocal)
    // ¡CORRECCIÓN!: Ya no buscamos FINALIZADAS, solo APROBADAS activas
    .eq('estado', 'APROBADA')
    .lte('hora_inicio', horaExactaStr) // Empezó antes o justo ahora
    .gt('hora_fin', horaExactaStr)     // ¡La hora fin debe ser estrictamente mayor a este segundo!
    .maybeSingle(); 

  if (error) throw new Error(`Error buscando reserva actual: ${error.message}`);
  return data;
};