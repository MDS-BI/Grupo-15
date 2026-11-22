import { describe, it, expect } from 'vitest';
import { ManufacturingStore } from '../../src/data/ManufacturingStore.js';
import {
  operationLabel,
  technicianLabel,
  stopEventLabel,
  salesOrderLabel,
} from '../../src/components/labels.js';

describe('Nombres legibles para la demo', () => {
  const store = new ManufacturingStore({ storage: null, hydrate: false });

  it('compone la etiqueta de operación con secuencia y centro', () => {
    const operation = store.productionOrderOperations.find((op) => op.id === 'poo_3002_2');
    const center = store.workCenterById(operation.work_center_id);

    expect(operationLabel(store, operation)).toBe(
      `Operación ${operation.sequence} · ${center.name}`,
    );
    expect(operationLabel(store, 'no_existe')).toBe('no_existe');
  });

  it('resuelve técnicos desde RR.HH. y conserva el ID como respaldo', () => {
    expect(technicianLabel('ext_hr_tec_02')).toBe('Bruno Díaz');
    expect(technicianLabel('id_desconocido')).toBe('id_desconocido');
  });

  it('describe el evento de parada usando motivo y centro', () => {
    const label = stopEventLabel(store, 'od_1001');
    const reason = store.delayReasons.find((row) => row.id === 'dr_falla_maquina');
    const operation = store.productionOrderOperations.find((op) => op.id === 'poo_3002_2');
    const center = store.workCenterById(operation.work_center_id);

    expect(label).toContain(reason.label);
    expect(label).toContain(center.name);
    expect(stopEventLabel(store, 'od_inexistente')).toBe('od_inexistente');
  });

  it('resuelve pedidos de venta desde los datos maestros', () => {
    expect(salesOrderLabel('so_1001')).toBe('Pedido PV-1001');
    expect(salesOrderLabel('so_inexistente')).toBe('so_inexistente');
  });
});
