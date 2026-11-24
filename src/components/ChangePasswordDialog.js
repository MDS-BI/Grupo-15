import { el } from './format.js';

const ERROR_MESSAGES = {
  'invalid-current-password': 'La contraseña actual no es correcta.',
  'user-not-found': 'No se encontró el usuario autenticado.',
  'empty-password': 'La nueva contraseña no puede estar vacía.',
};

export function ChangePasswordDialog({ onSubmit, onClose } = {}) {
  let closed = false;

  const root = el(`
    <div class="modal-backdrop" data-role="change-password-dialog">
      <div class="modal change-password-modal" role="dialog" aria-modal="true"
        aria-labelledby="change-password-title">
        <div class="modal__header">
          <h2 id="change-password-title">Cambiar contraseña</h2>
          <button type="button" class="icon-btn" data-role="change-password-close" aria-label="Cerrar">×</button>
        </div>
        <form class="modal__body change-password-form" data-role="change-password-form" novalidate>
          <label class="form-field">
            <span>Contraseña actual</span>
            <input type="password" name="currentPassword" autocomplete="current-password"
              data-role="change-password-current" required />
            <span class="form-error" data-role="change-password-error-current" hidden></span>
          </label>
          <label class="form-field">
            <span>Nueva contraseña</span>
            <input type="password" name="newPassword" autocomplete="new-password"
              data-role="change-password-new" required />
            <span class="form-error" data-role="change-password-error-new" hidden></span>
          </label>
          <label class="form-field">
            <span>Confirmar nueva contraseña</span>
            <input type="password" name="confirmPassword" autocomplete="new-password"
              data-role="change-password-confirm" required />
            <span class="form-error" data-role="change-password-error-confirm" hidden></span>
          </label>
          <div class="modal__actions">
            <button type="button" class="btn" data-role="change-password-cancel">Cancelar</button>
            <button type="submit" class="btn btn--primary" data-role="change-password-submit">
              Guardar contraseña
            </button>
          </div>
        </form>
      </div>
    </div>`);

  const form = root.querySelector('[data-role="change-password-form"]');

  function clearErrors() {
    for (const error of form.querySelectorAll('.form-error')) {
      error.hidden = true;
      error.textContent = '';
    }
  }

  function showError(field, message) {
    const error = form.querySelector(`[data-role="change-password-error-${field}"]`);
    error.textContent = message;
    error.hidden = false;
  }

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown);
    root.remove();
    onClose?.();
  }

  function onKeyDown(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  }

  root.addEventListener('click', (event) => {
    if (event.target === root) close();
  });
  root.querySelector('[data-role="change-password-close"]').addEventListener('click', close);
  root.querySelector('[data-role="change-password-cancel"]').addEventListener('click', close);
  document.addEventListener('keydown', onKeyDown);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();
    const values = {
      currentPassword: String(form.elements.currentPassword.value).trim(),
      newPassword: String(form.elements.newPassword.value).trim(),
      confirmPassword: String(form.elements.confirmPassword.value).trim(),
    };
    let invalid = false;
    if (!values.currentPassword) {
      showError('current', 'Ingresa tu contraseña actual.');
      invalid = true;
    }
    if (!values.newPassword) {
      showError('new', 'La nueva contraseña no puede estar vacía.');
      invalid = true;
    } else if (values.newPassword !== values.confirmPassword) {
      showError('confirm', 'La confirmación no coincide con la nueva contraseña.');
      invalid = true;
    }
    if (invalid) return;

    const result = await onSubmit?.(values);
    if (closed) return;
    if (result && result.ok === false) {
      showError('current', ERROR_MESSAGES[result.reason] ?? 'No se pudo cambiar la contraseña.');
      return;
    }
    close();
  });

  root.querySelector('[data-role="change-password-current"]').focus();
  return root;
}
