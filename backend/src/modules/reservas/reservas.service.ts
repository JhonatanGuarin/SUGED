import { supabaseAdmin } from '../../core/supabase.js';
import ExcelJS from 'exceljs';

export const crearReservaBase = async (datosReserva: any) => {
  // 1. Anti Double-Booking
  // ¡CORRECCIÓN!: Ya no tomamos en cuenta las FINALIZADAS para permitir agendar en ese espacio liberado
  const { data: colisiones } = await supabaseAdmin
    .from('reservas')
    .select('id')
    .eq('escenario_id', datosReserva.escenario_id)
    .eq('fecha_reserva', datosReserva.fecha_reserva)
    .lt('hora_inicio', datosReserva.hora_fin)
    .gt('hora_fin', datosReserva.hora_inicio)
    .in('estado', ['PENDIENTE', 'APROBADA']);

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
    
    // Usamos substring para extraer "HH:mm:ss" directamente. 
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

// NUEVA FUNCIÓN: Inscribir a un acompañante validando el aforo
export const unirseAReserva = async (reservaId: string, usuarioId: string) => {
  // 1. Obtener detalles de la reserva y el aforo máximo del escenario
  const { data: reserva, error: errorReserva } = await supabaseAdmin
    .from('reservas')
    .select('usuario_id, estado, escenarios ( aforo )')
    .eq('id', reservaId)
    .single();

  if (errorReserva || !reserva) {
    throw new Error('La reserva no existe o fue eliminada.');
  }

  if (reserva.estado === 'CANCELADA' || reserva.estado === 'FINALIZADA') {
    throw new Error('No puedes unirte a una reserva cancelada o finalizada.');
  }

  // El titular de la reserva ya está incluido, no necesita unirse
  if (reserva.usuario_id === usuarioId) {
    throw new Error('Ya eres el titular de esta reserva.');
  }

  // 2. Contar cuántos invitados hay actualmente inscritos
  const { count, error: errorConteo } = await supabaseAdmin
    .from('reservas_participantes')
    .select('*', { count: 'exact', head: true })
    .eq('reserva_id', reservaId);

  if (errorConteo) throw new Error('Error al verificar los cupos disponibles.');

  // El total de personas es: Los invitados (count) + 1 (el titular)
  const escenariosData = reserva.escenarios as any;
  const aforoMaximo = Array.isArray(escenariosData) 
    ? (escenariosData[0]?.aforo || 0) 
    : (escenariosData?.aforo || 0);
  const totalPersonasActual = (count || 0) + 1;

  if (aforoMaximo > 0 && totalPersonasActual >= aforoMaximo) {
    throw new Error(`El escenario ya alcanzó su límite máximo de ${aforoMaximo} personas.`);
  }

  // 3. Si hay cupo, inscribimos al invitado en la tabla puente
  const { data, error: errorInsert } = await supabaseAdmin
    .from('reservas_participantes')
    .insert([{ reserva_id: reservaId, usuario_id: usuarioId }])
    .select()
    .single();

  if (errorInsert) {
    // Si la base de datos rechaza por la regla UNIQUE que creamos en SQL
    if (errorInsert.code === '23505') {
      throw new Error('Ya estás inscrito en este equipo.');
    }
    throw new Error(`Error al unirte al equipo: ${errorInsert.message}`);
  }

  return data;
};

export const generarReporteExcel = async (fechaInicio?: string, fechaFin?: string, escenarioId?: string) => {
  // 1. Iniciamos la consulta base
  let query = supabaseAdmin
    .from('reservas')
    .select(`
      id, fecha_reserva, hora_inicio, hora_fin, estado, 
      escenarios ( nombre, aforo ), 
      usuarios!fk_reservas_usuarios ( documento, nombre_completo, carrera, telefono ),
      reservas_participantes ( 
        usuarios ( documento, nombre_completo, carrera, telefono ) 
      )
    `)
    .order('fecha_reserva', { ascending: false });

  // 2. Aplicamos los filtros recibidos desde el frontend
  if (fechaInicio) query = query.gte('fecha_reserva', fechaInicio);
  if (fechaFin) query = query.lte('fecha_reserva', fechaFin);
  if (escenarioId && escenarioId !== 'TODOS') query = query.eq('escenario_id', escenarioId);

  const { data: reservas, error } = await query;

  if (error) throw new Error(`Error obteniendo datos para el reporte: ${error.message}`);

  // 3. Inicializar el Libro de Excel
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SUGED - UPTC';
  workbook.created = new Date();

  // ==========================================
  // HOJA 1: CONSOLIDADO DE RESERVAS (OPERATIVA)
  // ==========================================
  const hojaReservas = workbook.addWorksheet('Consolidado Reservas');
  hojaReservas.columns = [
    { header: 'ID Reserva', key: 'id', width: 10 },
    { header: 'Fecha', key: 'fecha', width: 15 },
    { header: 'Horario', key: 'horario', width: 15 },
    { header: 'Escenario', key: 'escenario', width: 25 },
    { header: 'Estado', key: 'estado', width: 15 },
    { header: 'Doc. Titular', key: 'doc_titular', width: 15 },
    { header: 'Nombre Titular', key: 'nombre_titular', width: 30 },
    { header: 'Programa Titular', key: 'programa_titular', width: 30 },
    { header: 'Asistentes', key: 'asistentes', width: 12 },
    { header: 'Aforo Máx.', key: 'aforo', width: 12 },
    { header: '% Ocupación', key: 'ocupacion', width: 15 }
  ];

  hojaReservas.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hojaReservas.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1A' } };

  // ==========================================
  // HOJA 2: DETALLE DEMOGRÁFICO (POBLACIONAL)
  // ==========================================
  const hojaDemografica = workbook.addWorksheet('Detalle Demográfico');
  hojaDemografica.columns = [
    { header: 'Fecha Actividad', key: 'fecha', width: 15 },
    { header: 'Escenario', key: 'escenario', width: 25 },
    { header: 'Rol', key: 'rol', width: 15 },
    { header: 'Documento', key: 'documento', width: 15 },
    { header: 'Nombre Estudiante', key: 'nombre', width: 30 },
    { header: 'Programa Académico', key: 'programa', width: 30 },
    { header: 'Teléfono', key: 'telefono', width: 15 }
  ];

  hojaDemografica.getRow(1).font = { bold: true };
  hojaDemografica.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC29' } };

  // 4. Procesar la información de Supabase
  reservas?.forEach((reserva: any) => {
    // Normalizar acceso a la tabla relacional (por si viene como objeto o array)
    const escenariosData = reserva.escenarios;
    const aforo = Array.isArray(escenariosData) ? (escenariosData[0]?.aforo || 1) : (escenariosData?.aforo || 1);
    const escenarioNombre = Array.isArray(escenariosData) ? (escenariosData[0]?.nombre || 'N/A') : (escenariosData?.nombre || 'N/A');
    
    const numAsistentes = 1 + (reserva.reservas_participantes?.length || 0); 
    const porcentajeOcupacion = ((numAsistentes / aforo) * 100).toFixed(1) + '%';

    // Rellenar Hoja 1
    hojaReservas.addRow({
      id: reserva.id.split('-')[0], 
      fecha: reserva.fecha_reserva,
      horario: `${reserva.hora_inicio.slice(0,5)} - ${reserva.hora_fin.slice(0,5)}`,
      escenario: escenarioNombre,
      estado: reserva.estado,
      doc_titular: reserva.usuarios?.documento || 'N/A',
      nombre_titular: reserva.usuarios?.nombre_completo || 'N/A',
      programa_titular: reserva.usuarios?.carrera || 'N/A',
      asistentes: numAsistentes,
      aforo: aforo,
      ocupacion: porcentajeOcupacion
    });

    // Rellenar Hoja 2 (Datos del Titular)
    hojaDemografica.addRow({
      fecha: reserva.fecha_reserva,
      escenario: escenarioNombre,
      rol: 'TITULAR',
      documento: reserva.usuarios?.documento || 'N/A',
      nombre: reserva.usuarios?.nombre_completo || 'N/A',
      programa: reserva.usuarios?.carrera || 'N/A',
      telefono: reserva.usuarios?.telefono || 'N/A'
    });

    // Rellenar Hoja 2 (Datos de los Invitados)
    if (reserva.reservas_participantes && reserva.reservas_participantes.length > 0) {
      reserva.reservas_participantes.forEach((participante: any) => {
        hojaDemografica.addRow({
          fecha: reserva.fecha_reserva,
          escenario: escenarioNombre,
          rol: 'INVITADO',
          documento: participante.usuarios?.documento || 'N/A',
          nombre: participante.usuarios?.nombre_completo || 'N/A',
          programa: participante.usuarios?.carrera || 'N/A',
          telefono: participante.usuarios?.telefono || 'N/A'
        });
      });
    }
  });

  // 5. Retornar el archivo binario
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};