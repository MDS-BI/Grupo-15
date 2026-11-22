import { hrEmployees } from '../data/fixtures/hr-employees.js';
import { salesOrders } from '../data/fixtures/master-data.js';

function fallback(id) {
  return id == null || id === '' ? '—' : String(id);
}

export function operationLabel(store, operationOrId) {
  const operation =
    typeof operationOrId === 'string'
      ? store.productionOrderOperations.find((row) => row.id === operationOrId)
      : operationOrId;
  if (!operation) return fallback(operationOrId);

  const center = store.workCenterById(operation.work_center_id);
  if (!center?.name) return fallback(operation.id);
  return `Operación ${operation.sequence} · ${center.name}`;
}

export function technicianLabel(employeeId) {
  const employee = hrEmployees.find((row) => row.ext_hr_employee_id === employeeId);
  return employee?.name ? employee.name : fallback(employeeId);
}

export function stopEventLabel(store, delayOrId) {
  const delay =
    typeof delayOrId === 'string'
      ? store.operationDelays.find((row) => row.id === delayOrId)
      : delayOrId;
  if (!delay) return fallback(delayOrId);

  const reason = store.delayReasons.find((row) => row.id === delay.delay_reason_id);
  const operation = store.productionOrderOperations.find((row) => row.id === delay.po_operation_id);
  const center = operation ? store.workCenterById(operation.work_center_id) : null;
  const label = [reason?.label, center?.name].filter(Boolean).join(' · ');
  return label || fallback(delay.id);
}

export function salesOrderLabel(orderId) {
  const order = salesOrders.find((row) => row.id === orderId);
  return order?.order_number ? `Pedido ${order.order_number}` : fallback(orderId);
}
