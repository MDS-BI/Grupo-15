import { el, escapeHtml } from './format.js';
import { RoleAdminPanel } from './RoleAdminPanel.js';
import { confirmDialog } from './ConfirmDialog.js';
import {
  ROLE_ORDER,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  isModuleAllowed,
} from '../domain/access-control.js';
import { roleChangeMessage } from '../domain/role-access.js';

export function RoleAccessPanel({
  currentRole,
  username,
  store,
  modules = [],
  initialTab = 'roles',
  onRoleChange,
} = {}) {
  const canConfigure = currentRole === 'plant_manager' && Boolean(store);
  let activeTab = canConfigure && initialTab === 'config' ? 'config' : 'roles';

  const availableRoles = store && username ? store.rolesForUsername(username) : [...ROLE_ORDER];

  const root = el(`
    <section class="view" data-role="role-access-view">
      <header class="view__header">
        <div>
          <h1>Acceso por rol</h1>
          <p class="view__subtitle">Consulta tus roles disponibles y configura los accesos de la demo.</p>
        </div>
      </header>
      <nav class="role-tabs maintenance-tabs" role="tablist" aria-label="Secciones de roles">
        <button type="button" class="role-tabs__tab maintenance-tabs__tab" role="tab"
          data-role="role-tab" data-tab="roles" aria-controls="role-tabpanel-roles"
          aria-selected="${activeTab === 'roles'}">Roles</button>
        <button type="button" class="role-tabs__tab maintenance-tabs__tab" role="tab"
          data-role="role-tab" data-tab="config" aria-controls="role-tabpanel-config"
          aria-selected="${activeTab === 'config'}" ${canConfigure ? '' : 'disabled aria-disabled="true"'}>Configurar roles</button>
      </nav>
      <section class="maintenance-tabpanel role-tabpanel" role="tabpanel" id="role-tabpanel-roles"
        data-role="role-panel" data-panel="roles" ${activeTab === 'roles' ? '' : 'hidden'}>
        <div class="role-grid" data-role="role-cards"></div>
      </section>
      <section class="maintenance-tabpanel role-tabpanel" role="tabpanel" id="role-tabpanel-config"
        data-role="role-panel" data-panel="config" ${activeTab === 'config' ? '' : 'hidden'}>
        <div data-role="role-admin-host"></div>
      </section>
    </section>`);

  const cardsHost = root.querySelector('[data-role="role-cards"]');
  const configPanel = root.querySelector('[data-panel="config"]');
  const adminHost = root.querySelector('[data-role="role-admin-host"]');

  function renderCards() {
    const roles = store && username ? store.rolesForUsername(username) : availableRoles;
    cardsHost.innerHTML = roles
      .map((role) => {
        const active = role === currentRole;
        const pages = modules.filter(
          (module) =>
            module.id !== 'roles' &&
            module.id !== 'admin-roles' &&
            isModuleAllowed(role, module.id),
        );
        return `
          <button type="button" class="role-card ${active ? 'is-active' : ''}"
            data-role-card="${escapeHtml(role)}" aria-pressed="${active}">
            <span class="role-card__header">
              <h2>${escapeHtml(ROLE_LABELS[role])}</h2>
              ${active ? '<span class="role-card__badge">Rol efectivo</span>' : ''}
            </span>
            <span class="role-card__desc">${escapeHtml(ROLE_DESCRIPTIONS[role])}</span>
            <span class="role-card__label">Páginas disponibles</span>
            <ul class="role-card__pages">
              ${pages.map((module) => `<li>${escapeHtml(module.label)}</li>`).join('')}
            </ul>
          </button>`;
      })
      .join('');
  }

  function selectTab(tabName) {
    if (tabName === 'config' && !canConfigure) return;
    activeTab = tabName;
    for (const tab of root.querySelectorAll('[data-role="role-tab"]')) {
      tab.setAttribute('aria-selected', String(tab.dataset.tab === activeTab));
    }
    for (const panel of root.querySelectorAll('[data-role="role-panel"]')) {
      panel.hidden = panel.dataset.panel !== activeTab;
    }
  }

  root.addEventListener('click', async (event) => {
    const tab = event.target.closest('[data-role="role-tab"]');
    if (tab) {
      selectTab(tab.dataset.tab);
      return;
    }
    const card = event.target.closest('[data-role-card]');
    if (!card || card.dataset.roleCard === currentRole) return;
    const confirmed = await confirmDialog({
      title: 'Cambiar rol',
      message: roleChangeMessage(card.dataset.roleCard),
      confirmLabel: 'Cambiar rol',
    });
    if (confirmed) onRoleChange?.(card.dataset.roleCard);
  });

  renderCards();
  if (canConfigure) {
    adminHost.append(RoleAdminPanel({ store }));
  } else {
    configPanel.hidden = true;
  }
  store?.addEventListener?.('change', renderCards);
  return root;
}
