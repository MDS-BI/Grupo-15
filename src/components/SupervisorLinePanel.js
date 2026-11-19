/**
 * @file Panel del supervisor de línea (US-07): semáforo en vivo, asignación de
 * operadores, validación de cierres y escalamiento de incidentes.
 */

import { escapeHtml, el, fmtNumber } from './format.js';

const LIGHT_LABEL = {
  in_operation: 'En operación',
  paused: 'Pausado',
  fault: 'En fallo',
  changeover: 'Cambio de producto',
  available: 'Disponible',
};

/**
 * @param {import('../data/ManufacturingStore.js').ManufacturingStore} store
 * @returns {HTMLElement}
 */
export function SupervisorLinePanel(store) {
  const root = el(`
    <section class="view">
      <header class="view__header">
        <div>
          <h1>Supervisión de Línea</h1>
          <p class="view__subtitle">Semáforo por centro, personal asignado y cierres pendientes.</p>
        </div>
      </header>
      <div data-role="lights"></div>
      <div class="panel-grid">
        <article class="panel">
          <header class="panel__header"><h3>Asignar operador</h3></header>
          <form class="stack-form" data-role="assign-form">
            <label>Centro de trabajo
              <select name="work_center_id">${store.workCenters
                .map((wc) => `<option value="${escapeHtml(wc.id)}">${escapeHtml(wc.name)}</option>`)
                .join('')}</select>
            </label>
            <label>Operador (RR.HH.)
              <select name="ext_hr_employee_id">${store.hrEmployees
                .filter((employee) => employee.role === 'operator')
                .map(
                  (employee) =>
                    `<option value="${escapeHtml(employee.ext_hr_employee_id)}">${escapeHtml(employee.name)}</option>`,
                )
                .join('')}</select>
            </label>
            <label>Franja
              <select name="shift_band">
                <option value="morning">Mañana</option>
                <option value="afternoon">Tarde</option>
                <option value="night">Noche</option>
              </select>
            </label>
            <p class="form-error" data-role="assign-error" role="alert"></p>
            <button type="submit" class="btn btn--primary">Asignar</button>
          </form>
        </article>
        <article class="panel">
          <header class="panel__header"><h3>Cierres pendientes de validación</h3></header>
          <div data-role="closures"></div>
        </article>
      </div>
      <div class="modal-root" data-role="modal-root"></div>
    </section>`);

  const lightsEl = root.querySelector('[data-role="lights"]');
  const closuresEl = root.querySelector('[data-role="closures"]');
  const modalRoot = root.querySelector('[data-role="modal-root"]');
  const assignError = root.querySelector('[data-role="assign-error"]');

  function renderLights() {
    const rows = store.trafficLightForWorkCenters();
    lightsEl.innerHTML = `
      <div class="panel">
        <header class="panel__header"><h2>Semáforo de planta</h2></header>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Centro</th><th>Estado</th><th>Operador asignado</th><th>Operación activa</th><th>Alerta</th></tr></thead>
            <tbody>
              ${rows
                .map(({ work_center, status, assignment, active_operation }) => {
                  const employee = assignment
                    ? store.hrEmployees.find(
                        (row) => row.ext_hr_employee_id === assignment.ext_hr_employee_id,
                      )
                    : null;
                  return `<tr data-wc="${escapeHtml(work_center.id)}">
                    <td>${escapeHtml(work_center.name)}</td>
                    <td><span class="badge badge--light-${escapeHtml(status)}" data-light="${escapeHtml(work_center.id)}">${escapeHtml(LIGHT_LABEL[status] || status)}</span></td>
                    <td>${employee ? escapeHtml(employee.name) : '—'}</td>
                    <td>${active_operation ? escapeHtml(active_operation.id) : '—'}</td>
                    <td><button type="button" class="btn btn--tiny btn--danger" data-escalate="${escapeHtml(work_center.id)}">Escalar incidente</button></td>
                  </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    lightsEl.querySelectorAll('[data-escalate]').forEach((button) => {
      button.addEventListener('click', () => openEscalate(button.getAttribute('data-escalate')));
    });
  }

  function renderClosures() {
    const shifts = store.shiftsPendingValidation();
    closuresEl.innerHTML = shifts.length
      ? shifts
          .map((shift) => {
            const operation = store.productionOrderOperations.find(
              (op) => op.id === shift.po_operation_id,
            );
            const order = operation ? store.orderById(operation.production_order_id) : null;
            return `<div class="closure-row" data-shift-row="${escapeHtml(shift.id)}">
              <span>${escapeHtml(order ? order.order_number : shift.po_operation_id)} · turno ${shift.shift_number} · ${fmtNumber(shift.quantity_counted)} piezas</span>
              <button type="button" class="btn btn--tiny btn--primary" data-validate="${escapeHtml(shift.id)}">Validar cierre</button>
            </div>`;
          })
          .join('')
      : '<p class="empty-note">Sin cierres pendientes.</p>';

    closuresEl.querySelectorAll('[data-validate]').forEach((button) => {
      button.addEventListener('click', () => {
        try {
          store.validateShiftClosure(button.getAttribute('data-validate'), {
            supervisor_notes: 'Validado desde supervisión de línea.',
          });
          render();
        } catch (err) {
          assignError.textContent = err.message;
        }
      });
    });
  }

  function openEscalate(workCenterId) {
    const workCenter = store.workCenterById(workCenterId);
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-role="escalate-modal">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="escalate-title">
          <h2 id="escalate-title">Escalar incidente · ${escapeHtml(workCenter.name)}</h2>
          <form class="stack-form" data-role="escalate-form">
            <label>Descripción del incidente
              <textarea name="description" rows="3" required></textarea>
            </label>
            <p class="form-error" data-role="error" role="alert"></p>
            <div class="modal-actions">
              <button type="button" class="btn" data-role="cancel">Cancelar</button>
              <button type="submit" class="btn btn--primary btn--danger">Escalar a mantenimiento</button>
            </div>
          </form>
        </div>
      </div>`;
    const close = () => {
      modalRoot.innerHTML = '';
    };
    modalRoot.querySelector('[data-role="cancel"]').addEventListener('click', close);
    modalRoot.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
    const form = modalRoot.querySelector('[data-role="escalate-form"]');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      try {
        store.escalateIncidentToMaintenance({
          workCenterId,
          description: data.get('description'),
        });
        close();
        render();
      } catch (err) {
        form.querySelector('[data-role="error"]').textContent = err.message;
      }
    });
  }

  root.querySelector('[data-role="assign-form"]').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    try {
      store.assignOperatorToWorkCenter(data.get('work_center_id'), {
        ext_hr_employee_id: data.get('ext_hr_employee_id'),
        shift_band: data.get('shift_band'),
      });
      assignError.textContent = '';
      render();
    } catch (err) {
      assignError.textContent = err.message;
    }
  });

  function render() {
    renderLights();
    renderClosures();
  }

  store.addEventListener('change', render);
  render();
  return root;
}
