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
    .in('estado', ['PENDIENTE_APROBACION', 'APROBADA']);

  if (colisiones && colisiones.length > 0) {
    throw new Error('Lo sentimos, este horario acaba de ser reservado por alguien más.');
  }

  // 2. Guardamos la reserva con el estado dinámico y el comprobante
  const { data, error } = await supabaseAdmin
    .from('reservas')
    .insert([{
      escenario_id: datosReserva.escenario_id,
      usuario_id: datosReserva.usuario_id,
      fecha_reserva: datosReserva.fecha_reserva,
      hora_inicio: datosReserva.hora_inicio,
      hora_fin: datosReserva.hora_fin,
      estado: datosReserva.estado, // Ahora esto lo decide el Frontend (APROBADA o PENDIENTE)
      comprobante_url: datosReserva.comprobante_url || null // Guardamos el link si existe
    }])
    .select()
    .single();

  if (error) throw new Error(`Error creando reserva: ${error.message}`);
  return data;
};

// Actualizar el estado (APROBADA o RECHAZADA)
export const actualizarEstadoReserva = async (id: string, estado: string) => {
  const { data, error } = await supabaseAdmin
    .from('reservas')
    .update({ estado })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Error al actualizar la reserva: ${error.message}`);
  return data;
};