import { el, escapeHtml } from './format.js';
import { showToast } from './Toast.js';
import { confirmDialog } from './ConfirmDialog.js';
import { CANONICAL_ROLES, roleLabel } from '../domain/role-access.js';

export function RoleAdminPanel({ store } = {}) {
  const root = el(`
    <section class="view admin-roles" data-role="admin-roles-view">
      <header class="view__header">
        <div>
          <p class="view__eyebrow">Sistema</p>
          <h1>Configurar roles</h1>
          <p class="view__subtitle">Altas y asignaciones persistidas en la demo.</p>
        </div>
      </header>
      <div class="role-admin__grid" data-role="admin-tables"></div>
      <div class="role-admin__forms">
        <form class="stack-form" data-role="admin-add-form">
          <h2>Agregar usuario</h2>
          <label>
            <span>Usuario</span>
            <input type="text" name="username" autocomplete="off" data-role="admin-new-username" required />
          </label>
          <div class="role-admin__role-rows" data-role="admin-role-rows"></div>
          <button type="button" class="btn btn--tiny role-admin__add-role" data-role="admin-add-role" aria-label="Agregar rol">+</button>
          <button type="submit" class="btn btn--primary">Agregar</button>
        </form>
        <form class="stack-form" data-role="admin-assign-form">
          <h2>Asignar rol adicional</h2>
          <label>
            <span>Usuario existente</span>
            <input type="text" name="username" list="admin-user-options" autocomplete="off" data-role="admin-existing-username" required />
          </label>
          <label>
            <span>Rol adicional</span>
            <select name="role" data-role="admin-assign-role">
              ${CANONICAL_ROLES.map(
                (role) => `<option value="${role}">${escapeHtml(roleLabel(role))}</option>`,
              ).join('')}
            </select>
          </label>
          <button type="submit" class="btn">Asignar</button>
        </form>
      </div>
      <datalist id="admin-user-options" data-role="admin-user-options"></datalist>
    </section>
  `);

  const tablesHost = root.querySelector('[data-role="admin-tables"]');
  const userOptions = root.querySelector('[data-role="admin-user-options"]');
  const addForm = root.querySelector('[data-role="admin-add-form"]');
  const roleRowsEl = root.querySelector('[data-role="admin-role-rows"]');
  const addRoleButton = root.querySelector('[data-role="admin-add-role"]');
  const assignForm = root.querySelector('[data-role="admin-assign-form"]');

  function roleOptions() {
    return CANONICAL_ROLES.map(
      (role) => `<option value="${role}">${escapeHtml(roleLabel(role))}</option>`,
    ).join('');
  }

  function roleRowMarkup(index, removable) {
    return `<label class="role-admin__role-row" data-role="admin-role-row">
      <span>${index === 0 ? 'Rol' : `Rol ${index + 1}`}</span>
      <span class="role-admin__role-control">
        <select name="role" data-role="admin-new-role">${roleOptions()}</select>
        ${
          removable
            ? '<button type="button" class="role-admin__remove-role" data-role="admin-remove-role" aria-label="Quitar rol">×</button>'
            : ''
        }
      </span>
    </label>`;
  }

  function roleValues() {
    return [...roleRowsEl.querySelectorAll('[data-role="admin-new-role"]')].map(
      (select) => select.value,
    );
  }

  function renderRoleRows(count = 1, values = []) {
    roleRowsEl.innerHTML = Array.from({ length: count }, (_, index) =>
      roleRowMarkup(index, index > 0),
    ).join('');
    const selects = [...roleRowsEl.querySelectorAll('[data-role="admin-new-role"]')];
    selects.forEach((select, index) => {
      if (values[index]) select.value = values[index];
    });
    addRoleButton.disabled = count >= CANONICAL_ROLES.length;
  }

  addRoleButton.addEventListener('click', () => {
    const count = roleRowsEl.querySelectorAll('[data-role="admin-role-row"]').length;
    if (count < CANONICAL_ROLES.length) renderRoleRows(count + 1, roleValues());
  });

  roleRowsEl.addEventListener('click', (event) => {
    if (!event.target.closest('[data-role="admin-remove-role"]')) return;
    const rows = [...roleRowsEl.querySelectorAll('[data-role="admin-role-row"]')];
    const row = event.target.closest('[data-role="admin-role-row"]');
    const index = rows.indexOf(row);
    if (index <= 0) return;
    const values = roleValues();
    values.splice(index, 1);
    renderRoleRows(values.length, values);
  });

  function renderTables() {
    tablesHost.innerHTML = CANONICAL_ROLES.map((role) => {
      const rows = store.roleUsersFor(role);
      const items = rows.length
        ? rows
            .map(
              (row) => `
                <li class="role-admin__user-chip" data-username="${escapeHtml(row.username)}">
                  <span class="role-admin__user-name">${escapeHtml(row.username)}</span>
                  <button type="button" class="role-admin__remove-user"
                    data-remove-user="${escapeHtml(row.username)}" data-role="${role}"
                    aria-label="Quitar a ${escapeHtml(row.username)} de ${escapeHtml(roleLabel(role))}"
                    title="Quitar">×</button>
                </li>`,
            )
            .join('')
        : '<li class="role-admin__empty">Sin usuarios</li>';
      return `
        <section class="role-admin__table" data-role="admin-user-table" data-roles="${role}">
          <h2>${escapeHtml(roleLabel(role))}</h2>
          <ul class="role-admin__users" data-role="admin-user-list">${items}</ul>
        </section>
      `;
    }).join('');

    const usernames = new Set(
      CANONICAL_ROLES.flatMap((role) => store.roleUsersFor(role).map((row) => row.username)),
    );
    userOptions.innerHTML = Array.from(usernames)
      .map((username) => `<option value="${escapeHtml(username)}"></option>`)
      .join('');
  }

  addForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const username = addForm.querySelector('[data-role="admin-new-username"]').value;
    const roles = [...new Set(roleValues().filter(Boolean))];
    if (!String(username).trim() || roles.length === 0) return;
    const created = store.createUserWithRoles(username, roles);
    if (created.length) {
      showToast(`Usuario agregado a ${roles.map(roleLabel).join(', ')}: ${created[0].username}`, {
        tone: 'success',
      });
      addForm.reset();
      renderRoleRows(1);
      renderTables();
    }
  });

  assignForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const username = assignForm.querySelector('[data-role="admin-existing-username"]').value;
    const role = assignForm.querySelector('[data-role="admin-assign-role"]').value;
    if (!String(username).trim()) return;
    if (store.assignRoleToUser(username, role)) {
      showToast(`Rol asignado: ${roleLabel(role)} a ${username}`, { tone: 'success' });
      assignForm.reset();
      renderTables();
    } else {
      showToast('El usuario no existe en las tablas de roles', { tone: 'danger' });
    }
  });

  root.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-remove-user]');
    if (!button) return;
    const username = button.dataset.removeUser;
    const role = button.dataset.role;
    if (!username || !role) return;

    const confirmed = await confirmDialog({
      title: 'Quitar usuario',
      message: `¿Quitar a "${username}" del rol ${roleLabel(role)}? El usuario conservará sus otros roles asignados.`,
      confirmLabel: 'Quitar',
      danger: true,
    });
    if (!confirmed) return;

    const result = store.removeRoleUser(role, username);
    if (result?.ok) {
      showToast(`Usuario ${username} quitado de ${roleLabel(role)}`, { tone: 'success' });
      renderTables();
      return;
    }
    const message =
      result?.reason === 'last-plant-manager'
        ? 'No se puede quitar al último usuario de Jefa de Planta'
        : `No se pudo quitar a ${username} de ${roleLabel(role)}`;
    showToast(message, { tone: 'danger' });
  });

  renderRoleRows(1);
  renderTables();
  return root;
}
