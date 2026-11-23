import { el, escapeHtml } from './format.js';
import { showToast } from './Toast.js';
import { CANONICAL_ROLES, roleLabel } from '../domain/role-access.js';

export function RoleAdminPanel({ store } = {}) {
  const root = el(`
    <section class="view admin-roles" data-role="admin-roles-view">
      <header class="view__header">
        <div>
          <p class="view__eyebrow">Sistema</p>
          <h1>Datos de roles</h1>
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
          <label>
            <span>Rol</span>
            <select name="role" data-role="admin-new-role">
              ${CANONICAL_ROLES.map(
                (role) => `<option value="${role}">${escapeHtml(roleLabel(role))}</option>`,
              ).join('')}
            </select>
          </label>
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
  const assignForm = root.querySelector('[data-role="admin-assign-form"]');

  function renderTables() {
    tablesHost.innerHTML = CANONICAL_ROLES.map((role) => {
      const rows = store.roleUsersFor(role);
      const items = rows.length
        ? rows
            .map(
              (row) =>
                `<li data-username="${escapeHtml(row.username)}">${escapeHtml(row.username)}</li>`,
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
    const role = addForm.querySelector('[data-role="admin-new-role"]').value;
    if (!String(username).trim()) return;
    const row = store.addRoleUser(role, { username });
    if (row) {
      showToast(`Usuario agregado a ${roleLabel(role)}: ${row.username}`, { tone: 'success' });
      addForm.reset();
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

  renderTables();
  return root;
}
