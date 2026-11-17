export const ROLE_SHORTCUTS = Object.freeze({
  operator: [
    {
      moduleId: 'operator',
      label: 'Estación de trabajo',
      hint: 'Inicia o finaliza tu operación activa',
      tag: 'Turno',
    },
    {
      moduleId: 'maintenance',
      label: 'Reportar incidencia',
      hint: 'Revisa tickets y tiempos de parada',
      tag: 'Máquinas',
    },
    {
      moduleId: 'plant',
      label: 'Desempeño de planta',
      hint: 'Consulta carga y OEE del período',
      tag: 'Solo lectura',
    },
  ],
  supervisor: [
    {
      moduleId: 'supervision',
      label: 'Semáforo de línea',
      hint: 'Asigna operadores y escala incidentes',
      tag: 'En vivo',
    },
    {
      moduleId: 'orders',
      label: 'Órdenes de producción',
      hint: 'Supervisa el avance de las órdenes',
      tag: 'Piso',
    },
    {
      moduleId: 'maintenance',
      label: 'Bandeja de mantenimiento',
      hint: 'Da seguimiento a tickets urgentes',
      tag: 'Urgente',
    },
  ],
  planner: [
    {
      moduleId: 'scheduling',
      label: 'Planificación',
      hint: 'Ajusta fechas planificadas',
      tag: 'Fechas',
    },
    {
      moduleId: 'line-balance',
      label: 'Balance de líneas',
      hint: 'Detecta cuellos de botella',
      tag: 'Capacidad',
    },
    {
      moduleId: 'bom',
      label: 'BOM y rutas',
      hint: 'Revisa estructura y tiempos estándar',
      tag: 'Maestros',
    },
  ],
  plant_manager: [
    {
      moduleId: 'plant',
      label: 'Desempeño de planta',
      hint: 'Revisa OEE, alarmas y exporta',
      tag: 'Ejecutivo',
    },
    {
      moduleId: 'orders',
      label: 'Órdenes activas',
      hint: 'Reprioriza o cancela con confirmación',
      tag: 'Decisión',
    },
    {
      moduleId: 'roles',
      label: 'Acceso por rol',
      hint: 'Verifica permisos simulados',
      tag: 'Seguridad',
    },
  ],
});

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
  detail: 'Los accesos y la actividad son simulados; no modifican el snapshot v2.',
});

export function shortcutsForRole(role) {
  return ROLE_SHORTCUTS[role] || ROLE_SHORTCUTS.plant_manager;
}
