/**
 * @file Diálogo de corrección de atrasos abiertos tras cerrar una operación (US-06).
 * No elimina registros: fija ended_at, duración y nota de auditoría.
 */

import { escapeHtml, el, fmtNumber } from './format.js';

/**
 * @param {import('../data/ManufacturingStore.js').ManufacturingStore} store
 * @param {string} operationId
 * @param {{onClose?:()=>void}} [options]
 * @returns {HTMLElement}
 */
export function DelayCorrectionDialog(store, operationId, { onClose } = {}) {
  const delays = store.delaysForOperation(operationId).filter((delay) => delay.status === 'open');
  const root = el(`
    <div class="modal-backdrop" data-role="delay-correction">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="delay-correction-title">
        <h2 id="delay-correction-title">Corregir atrasos pendientes</h2>
        <p class="panel__subtitle">Solo contexto operacional — no evaluación de desempeño.</p>
        <div data-role="delay-list">
          ${delays
            .map(
              (delay) => `
            <form class="stack-form" data-correction-form="${escapeHtml(delay.id)}">
              <p><strong>${escapeHtml(store.delayReasons.find((r) => r.id === delay.delay_reason_id)?.label || delay.delay_reason_id)}</strong>
                · inicio ${escapeHtml(delay.started_at)}</p>
              <label>Fin del atraso
                <input name="endedAt" type="datetime-local" required />
              </label>
              <label>Nota de auditoría
                <input name="note" type="text" placeholder="Justificación de la corrección" />
              </label>
              <p class="form-error" data-role="error" role="alert"></p>
              <div class="modal-actions">
                <button type="submit" class="btn btn--primary">Corregir</button>
              </div>
            </form>`,
            )
            .join('')}
        </div>
        <p class="empty-note" data-role="empty">${
          delays.length ? '' : 'Sin atrasos abiertos pendientes.'
        }</p>
        <div class="modal-actions">
          <button type="button" class="btn" data-role="close">Cerrar</button>
        </div>
      </div>
    </div>`);

  const close = () => {
    root.remove();
    if (typeof onClose === 'function') onClose();
  };
  root.querySelector('[data-role="close"]').addEventListener('click', close);
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  for (const form of root.querySelectorAll('[data-correction-form]')) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const delayId = form.getAttribute('data-correction-form');
      const data = new FormData(form);
      const errorEl = form.querySelector('[data-role="error"]');
      try {
        store.correctOpenDelay(delayId, {
          endedAt: data.get('endedAt'),
          note: data.get('note'),
        });
        const operation = store.productionOrderOperations.find((op) => op.id === operationId);
        errorEl.textContent = '';
        if (operation) {
          errorEl.textContent = `Tiempo efectivo: ${fmtNumber(operation.actual_time_minutes, 2)} min`;
        }
        form.querySelector('button[type="submit"]').disabled = true;
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  }

  return root;
}
