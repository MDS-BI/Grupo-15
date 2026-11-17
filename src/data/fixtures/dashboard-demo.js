export const ACTIVITY_FEED = Object.freeze([
  {
    time: '08:15',
    title: 'Orden OP-3004 liberada',
    detail: 'BOM y ruta congeladas para la línea de armado.',
    moduleId: 'orders',
    tone: 'info',
  },
  {
    time: '09:40',
    title: 'Atraso justificado en Corte',
    detail: 'Motivo: falta de material. Tiempo efectivo recalculado.',
    moduleId: 'operator',
    tone: 'warning',
  },
  {
    time: '10:05',
    title: 'Ticket urgente escalado',
    detail: 'Centro Pintura en fallo; mantenimiento notificado.',
    moduleId: 'maintenance',
    tone: 'danger',
  },
  {
    time: '11:20',
    title: 'Cierre de turno validado',
    detail: 'Supervisión aprobó el turno de la línea de ensamble.',
    moduleId: 'supervision',
    tone: 'success',
  },
]);

export const DEMO_NOTICE = Object.freeze({
  title: 'Datos de demostración',
  detail: 'La actividad es simulada; no modifica el snapshot v2.',
});
