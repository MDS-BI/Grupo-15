import { describe, it, expect } from 'vitest';
import {
  buildPreventiveOrderFromHistory,
  canResolveTicket,
  canStartIntervention,
  canTransitionPreventiveOrder,
  canTransitionTicket,
  computeDowntimeMinutes,
  computeRepairMinutes,
  computeResponseMinutes,
  deriveWearIndicator,
  hasTicketForOperationDelay,
  resolveAvailabilityStatus,
  sortTicketsByPriorityAndAge,
} from '../../src/domain/maintenance.js';
import { maintenanceTickets } from '../../src/data/fixtures/maintenance-tickets.js';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import { SNAPSHOT_KEY } from '../../src/data/persistence.js';
import { relativeDay } from '../../src/data/fixtures/demo-dates.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

function ticket(overrides = {}) {
  return {
    id: 't1',
    work_center_id: 'wc_corte',
    ticket_status: 'open',
    priority: 'normal',
    created_at: '2026-11-01T08:00:00Z',
    operation_delay_id: null,
    ...overrides,
  };
}

describe('domain/maintenance - tickets correctivos', () => {
  it('permite iniciar solo tickets abiertos', () => {
    expect(canStartIntervention(ticket(), [], 'tec_1')).toBe(true);
    expect(canStartIntervention(ticket({ ticket_status: 'in_progress' }), [], 'tec_1')).toBe(false);
    expect(canStartIntervention(ticket({ ticket_status: 'resolved' }), [], 'tec_1')).toBe(false);
    expect(canStartIntervention(null, [], 'tec_1')).toBe(false);
  });

  it('exige técnico cuando se informa y bloquea doble intervención por centro', () => {
    const current = ticket({ id: 't1', work_center_id: 'wc_corte' });
    const active = ticket({ id: 't2', work_center_id: 'wc_corte', ticket_status: 'in_progress' });
    const otherCenter = ticket({
      id: 't3',
      work_center_id: 'wc_solda',
      ticket_status: 'in_progress',
    });

    expect(canStartIntervention(current, [], '')).toBe(false);
    expect(canStartIntervention(current, [active], 'tec_1')).toBe(false);
    expect(canStartIntervention(current, [otherCenter], 'tec_1')).toBe(true);
  });

  it('resuelve solo tickets en intervención y no reabre resueltos', () => {
    expect(canResolveTicket(ticket({ ticket_status: 'in_progress' }))).toBe(true);
    expect(canResolveTicket(ticket({ ticket_status: 'open' }))).toBe(false);
    expect(canResolveTicket(ticket({ ticket_status: 'resolved' }))).toBe(false);
    expect(canTransitionTicket(ticket(), 'in_progress')).toBe(true);
    expect(canTransitionTicket(ticket({ ticket_status: 'resolved' }), 'in_progress')).toBe(false);
  });
});

describe('domain/maintenance - tiempos de parada', () => {
  it('calcula la parada en minutos redondeada a 2 decimales', () => {
    expect(computeDowntimeMinutes('2026-11-02T08:40:00Z', '2026-11-02T09:10:30Z')).toBe(30.5);
    expect(computeDowntimeMinutes('2026-11-02T08:00:00Z', '2026-11-02T08:01:20Z')).toBe(1.33);
    expect(computeDowntimeMinutes('2026-11-02T08:00:00Z', '2026-11-02T08:00:00Z')).toBe(0);
  });

  it('rechaza marcas invertidas o inválidas', () => {
    expect(() => computeDowntimeMinutes('2026-11-02T10:00:00Z', '2026-11-02T09:00:00Z')).toThrow(
      /anterior/,
    );
    expect(() => computeDowntimeMinutes('no-es-fecha', '2026-11-02T09:00:00Z')).toThrow(/válidas/);
  });

  it('deriva tiempos de respuesta y reparación', () => {
    const t = ticket({
      created_at: '2026-11-02T08:00:00Z',
      intervention_started_at: '2026-11-02T08:20:00Z',
      resolved_at: '2026-11-02T09:20:00Z',
    });
    expect(computeResponseMinutes(t)).toBe(20);
    expect(computeRepairMinutes(t)).toBe(60);
  });
});

describe('domain/maintenance - historial y desgaste', () => {
  it('agrega fallos, paradas y MTTR por máquina', () => {
    const wear = deriveWearIndicator(maintenanceTickets, 'wc_armado');
    expect(wear.failure_count).toBe(1);
    expect(wear.total_downtime_minutes).toBe(90);
    expect(wear.mttr_minutes).toBe(90);
    expect(wear.wear_level).toBe('medium');
    expect(wear.last_failure_at).toBe('2026-10-20T11:00:00Z');
  });

  it('filtra por período y excluye otros centros', () => {
    const empty = deriveWearIndicator(maintenanceTickets, 'wc_armado', {
      from: '2026-10-21T00:00:00Z',
    });
    expect(empty.failure_count).toBe(0);
    expect(empty.last_failure_at).toBeNull();
    const pintura = deriveWearIndicator(maintenanceTickets, 'wc_pintura');
    expect(pintura.failure_count).toBe(1);
    expect(pintura.total_downtime_minutes).toBe(30);
  });

  it('deriva la disponibilidad al resolver según la operación activa', () => {
    const resolved = ticket({ ticket_status: 'resolved' });
    expect(resolveAvailabilityStatus({ status: 'in_progress' }, resolved)).toBe('in_operation');
    expect(resolveAvailabilityStatus({ status: 'paused' }, resolved)).toBe('paused');
    expect(resolveAvailabilityStatus(null, resolved)).toBe('available');
    expect(resolveAvailabilityStatus({ status: 'in_progress' }, ticket())).toBe('fault');
  });
});

describe('domain/maintenance - órdenes preventivas', () => {
  it('valida la máquina de estados de las preventivas', () => {
    expect(canTransitionPreventiveOrder({ status: 'planned' }, 'in_progress')).toBe(true);
    expect(canTransitionPreventiveOrder({ status: 'planned' }, 'completed')).toBe(false);
    expect(canTransitionPreventiveOrder({ status: 'in_progress' }, 'completed')).toBe(true);
    expect(canTransitionPreventiveOrder({ status: 'in_progress' }, 'cancelled')).toBe(true);
    expect(canTransitionPreventiveOrder({ status: 'completed' }, 'cancelled')).toBe(false);
    expect(canTransitionPreventiveOrder({ status: 'cancelled' }, 'in_progress')).toBe(false);
  });

  it('construye un borrador desde el historial de la máquina', () => {
    const draft = buildPreventiveOrderFromHistory(maintenanceTickets, 'wc_armado', '2026-11-15');
    expect(draft.status).toBe('planned');
    expect(draft.source_ticket_id).toBe('mt_1004');
    expect(draft.planned_date).toBe('2026-11-15');
    expect(draft.title).toContain('Preventiva');
  });
});

function localIsoDate(value) {
  const date = new Date(value);
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

describe('US-15 - mantenimiento programado en el store', () => {
  it('programa desde ticket, calcula la parada al resolver y persiste en v2', () => {
    const storage = memoryStorage();
    const store = new ManufacturingStore({ storage });
    const created = store.scheduleMaintenanceFromTicket(
      'mt_1001',
      {
        technician_ext_hr_employee_id: 'ext_hr_tec_01',
        scheduled_start_date: '2026-11-10',
        scheduled_end_date: '2026-11-12',
      },
      'maintenance',
    );

    const ticket = store.maintenanceTickets.find((row) => row.id === 'mt_1001');
    expect(created.status).toBe('in_progress');
    expect(ticket.ticket_status).toBe('in_progress');
    expect(ticket.intervention_started_at).toBeTruthy();
    expect(ticket.downtime_started_at).toBe(ticket.intervention_started_at);
    expect(store.workCenterById(ticket.work_center_id).operational_status).toBe('fault');
    expect(store.maintenanceFeed().some((event) => event.id === 'maintenance:mt_1001')).toBe(true);

    const resolvedAt = new Date(
      new Date(ticket.intervention_started_at).getTime() + 65 * 60000,
    ).toISOString();
    store.resolveScheduledMaintenance('maintenance:mt_1001', { resolvedAt }, 'maintenance');

    expect(ticket.ticket_status).toBe('resolved');
    expect(ticket.downtime_minutes).toBe(65);
    expect(ticket.downtime_ended_at).toBe(resolvedAt);
    expect(JSON.parse(storage.getItem(SNAPSHOT_KEY)).data.maintenanceTickets).toBeDefined();
  });

  it('no cierra una preventiva vencida y proyecta su fecha hasta hoy', () => {
    const store = new ManufacturingStore({ storage: memoryStorage() });
    const created = store.createPreventiveMaintenanceOrder({
      workCenterId: 'wc_solda_2',
      sourceTicketId: null,
      plannedDate: '2026-01-01',
      title: 'Preventiva vencida de prueba',
    });
    store.schedulePreventiveMaintenance(
      created.id,
      {
        scheduled_start_date: '2026-01-01',
        scheduled_end_date: '2026-01-02',
      },
      'maintenance',
    );

    const event = store.maintenanceFeed().find((row) => row.sourceId === created.id);
    expect(event.status).toBe('planned');
    expect(event.is_overdue).toBe(true);
    expect(event.visible_end_date).toBe(relativeDay(0));
    expect(store.preventiveMaintenanceOrders.find((row) => row.id === created.id).status).toBe(
      'planned',
    );

    const resolvedAt = new Date().toISOString();
    store.resolveScheduledMaintenance(`maintenance:${created.id}`, { resolvedAt }, 'maintenance');
    expect(store.preventiveMaintenanceOrders.find((row) => row.id === created.id).status).toBe(
      'completed',
    );
  });

  it('acorta la fecha visible de una correctiva resuelta antes del plazo', () => {
    const store = new ManufacturingStore({ storage: memoryStorage() });
    store.scheduleMaintenanceFromTicket(
      'mt_1003',
      {
        technician_ext_hr_employee_id: 'ext_hr_tec_03',
        scheduled_start_date: relativeDay(0),
        scheduled_end_date: relativeDay(10),
      },
      'maintenance',
    );
    const resolvedAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    store.resolveScheduledMaintenance('maintenance:mt_1003', { resolvedAt }, 'maintenance');

    const event = store.maintenanceFeed().find((row) => row.sourceId === 'mt_1003');
    expect(event.status).toBe('resolved');
    expect(event.visible_end_date).toBe(localIsoDate(resolvedAt));
  });

  it('bloquea resolver, reprogramar o borrar registros resueltos sin permiso', () => {
    const store = new ManufacturingStore({ storage: memoryStorage() });
    store.scheduleMaintenanceFromTicket(
      'mt_1005',
      {
        technician_ext_hr_employee_id: 'ext_hr_tec_02',
        scheduled_start_date: relativeDay(0),
        scheduled_end_date: relativeDay(2),
      },
      'maintenance',
    );
    const resolvedAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    store.resolveScheduledMaintenance('maintenance:mt_1005', { resolvedAt }, 'maintenance');

    expect(() =>
      store.resolveScheduledMaintenance('maintenance:mt_1005', { resolvedAt }, 'maintenance'),
    ).toThrow(/resuelta|no se puede/i);
    expect(() =>
      store.scheduleMaintenanceFromTicket(
        'mt_1005',
        {
          technician_ext_hr_employee_id: 'ext_hr_tec_02',
          scheduled_start_date: relativeDay(1),
          scheduled_end_date: relativeDay(3),
        },
        'maintenance',
      ),
    ).toThrow(/resuelto/i);
    expect(() => store.deleteResolvedMaintenance('maintenance:mt_1005', 'operator')).toThrow(
      /rol/i,
    );
  });
});

describe('domain/maintenance - idempotencia y prioridad', () => {
  it('un evento de parada origina como máximo un ticket', () => {
    expect(hasTicketForOperationDelay(maintenanceTickets, 'od_1001')).toBe(true);
    expect(hasTicketForOperationDelay(maintenanceTickets, 'od_9999')).toBe(false);
    expect(hasTicketForOperationDelay(maintenanceTickets, null)).toBe(false);
  });

  it('ordena por prioridad y luego por antigüedad', () => {
    const list = [
      ticket({ id: 'normal', priority: 'normal', created_at: '2026-11-01T08:00:00Z' }),
      ticket({ id: 'urgent-new', priority: 'urgent', created_at: '2026-11-02T08:00:00Z' }),
      ticket({ id: 'urgent-old', priority: 'urgent', created_at: '2026-11-01T09:00:00Z' }),
      ticket({ id: 'high', priority: 'high', created_at: '2026-11-01T10:00:00Z' }),
    ];
    expect(sortTicketsByPriorityAndAge(list).map((t) => t.id)).toEqual([
      'urgent-old',
      'urgent-new',
      'high',
      'normal',
    ]);
  });
});
