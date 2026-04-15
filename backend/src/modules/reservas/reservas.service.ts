import { supabaseAdmin } from '../../core/supabase.js';

export const crearReservaBase = async (datosReserva: any) => {
  // 1. Anti Double-Booking
  const { data: colisiones } = await supabaseAdmin
    .from('reservas')
    .select('id')
    .eq('escenario_id', datosReserva.escenario_id)
    .eq('fecha_reserva', datosReserva.fecha_reserva)
    .lt('hora_inicio', datosReserva.hora_fin)
    .gt('hora_fin', datosReserva.hora_inicio)
    .in('estado', ['PENDIENTE', 'APROBADA', 'FINALIZADA']);

  if (colisiones && colisiones.length > 0) {
    throw new Error('Lo sentimos, este horario acaba de ser reservado por alguien más.');
  }

  // 2. Guardamos la reserva forzando el estado y eliminando el comprobante
  const { data, error } = await supabaseAdmin
    .from('reservas')
    .insert([{
      escenario_id: datosReserva.escenario_id,
      usuario_id: datosReserva.usuario_id,
      fecha_reserva: datosReserva.fecha_reserva,
      hora_inicio: datosReserva.hora_inicio,
      hora_fin: datosReserva.hora_fin,
      estado: 'PENDIENTE' 
    }])
    .select()
    .single();

  if (error) throw new Error(`Error creando reserva: ${error.message}`);
  return data;
};

// Actualizar el estado (APROBADA, CANCELADA o FINALIZADA)
export const actualizarEstadoReserva = async (id: string, estado: string, usuario: any, recortarHora: boolean = false) => {
  
  if (usuario && usuario.perfil.rol !== 'ADMIN') {
    const { data: reservaExistente, error: errorBusqueda } = await supabaseAdmin
      .from('reservas')
      .select('usuario_id')
      .eq('id', id)
      .single();

    if (errorBusqueda || !reservaExistente) {
      throw new Error('La reserva no existe o ya fue eliminada.');
    }

    if (reservaExistente.usuario_id !== usuario.id) {
      throw new Error('No puedes modificar esta reserva porque le pertenece a otro estudiante.');
    }
  }

  const datosAActualizar: any = { estado };

  // Solo cortamos el tiempo si el botón explícito de Liberar lo pidió
  if (estado === 'FINALIZADA' && recortarHora === true) {
    const ahora = new Date();
    const colombiaTime = new Date(ahora.getTime() - (5 * 3600 * 1000));
    
    // ¡LA SOLUCIÓN! Usamos substring para extraer "HH:mm:ss" directamente. 
    // Es 100% seguro y TypeScript no se queja.
    const horaActual = colombiaTime.toISOString().substring(11, 19);
    
    datosAActualizar.hora_fin = horaActual;
  }

  const { data, error } = await supabaseAdmin
    .from('reservas')
    .update(datosAActualizar)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Error al actualizar la reserva: ${error.message}`);
  return data;
};