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
