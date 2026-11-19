/**
 * @file Diálogos accesibles basados en <dialog> para confirmaciones y avisos.
 * Los textos se asignan con textContent para no interpretar HTML procedente de datos.
 */

/**
 * @param {{title: string, message: string, confirmLabel: string, danger: boolean, notify: boolean}} options
 * @returns {Promise<boolean|void>}
 */
function openDialog({ title, message, confirmLabel, danger, notify }) {
  const previouslyFocused = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'confirm-dialog';
  dialog.setAttribute('data-role', 'confirm-dialog');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'confirm-dialog-title');
  dialog.setAttribute('aria-describedby', 'confirm-dialog-message');

  const body = document.createElement('div');
  body.className = 'confirm-dialog__body';

  const titleEl = document.createElement('h2');
  titleEl.className = 'confirm-dialog__title';
  titleEl.id = 'confirm-dialog-title';
  titleEl.textContent = title;

  const messageEl = document.createElement('p');
  messageEl.className = 'confirm-dialog__message';
  messageEl.id = 'confirm-dialog-message';
  messageEl.textContent = message || '';

  body.append(titleEl, messageEl);

  const actions = document.createElement('div');
  actions.className = 'confirm-dialog__actions';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'btn';
  cancelButton.setAttribute('data-role', 'cancel');
  cancelButton.textContent = 'Cancelar';

  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  confirmButton.className = `btn ${danger ? 'btn--danger' : 'btn--primary'}`;
  confirmButton.setAttribute('data-role', 'confirm');
  confirmButton.textContent = confirmLabel;

  const buttons = notify ? [confirmButton] : [cancelButton, confirmButton];
  const initialFocus = notify ? confirmButton : cancelButton;

  let settle;
  const result = new Promise((resolve) => {
    settle = resolve;
  });
  let settled = false;

  function close(value) {
    if (settled) return;
    settled = true;
    document.removeEventListener('keydown', onKeyDown);
    dialog.removeEventListener('cancel', onCancel);
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    dialog.remove();
    if (
      previouslyFocused &&
      previouslyFocused.isConnected &&
      typeof previouslyFocused.focus === 'function'
    ) {
      previouslyFocused.focus();
    }
    settle(value);
  }

  function onCancel(event) {
    event.preventDefault();
    close(notify ? undefined : false);
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(notify ? undefined : false);
      return;
    }
    if (event.key !== 'Tab' || buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  cancelButton.addEventListener('click', () => close(false));
  confirmButton.addEventListener('click', () => close(notify ? undefined : true));
  dialog.addEventListener('cancel', onCancel);
  document.addEventListener('keydown', onKeyDown);

  if (notify) {
    actions.append(confirmButton);
  } else {
    actions.append(cancelButton, confirmButton);
  }
  dialog.append(body, actions);
  document.body.append(dialog);

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
    dialog.classList.add('confirm-dialog--fallback');
  }
  initialFocus.focus();

  return result;
}

/**
 * Pregunta al usuario y resuelve `true` al confirmar o `false` al cancelar/Escape.
 * @param {{title?: string, message?: string, confirmLabel?: string, danger?: boolean}} [options]
 * @returns {Promise<boolean>}
 */
export function confirmDialog({
  title = 'Confirmar acción',
  message = '',
  confirmLabel = 'Confirmar',
  danger = false,
} = {}) {
  return /** @type {Promise<boolean>} */ (
    openDialog({ title, message, confirmLabel, danger, notify: false })
  );
}

/**
 * Muestra un aviso y resuelve cuando el usuario lo cierra.
 * @param {{title?: string, message?: string}} [options]
 * @returns {Promise<void>}
 */
export function notifyDialog({ title = 'Aviso', message = '' } = {}) {
  return /** @type {Promise<void>} */ (
    openDialog({ title, message, confirmLabel: 'Aceptar', danger: false, notify: true })
  );
}
