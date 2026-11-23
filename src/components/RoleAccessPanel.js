import { el, escapeHtml } from './format.js';
import {
  ROLE_ORDER,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  isModuleAllowed,
} from '../domain/access-control.js';

export function RoleAccessPanel({ currentRole, modules = [] }) {
  const cards = ROLE_ORDER.map((role) => {
    const active = role === currentRole;
    const pages = modules.filter(
      (module) =>
        module.id !== 'roles' && module.id !== 'admin-roles' && isModuleAllowed(role, module.id),
    );
    return `
      <article class="role-card ${active ? 'is-active' : ''}" data-role-card="${role}">
        <header class="role-card__header">
          <h2>${escapeHtml(ROLE_LABELS[role])}</h2>
          ${active ? '<span class="role-card__badge">Rol efectivo</span>' : ''}
        </header>
        <p class="role-card__desc">${escapeHtml(ROLE_DESCRIPTIONS[role])}</p>
        <p class="role-card__label">Páginas disponibles</p>
        <ul class="role-card__pages">
          ${pages.map((module) => `<li>${escapeHtml(module.label)}</li>`).join('')}
        </ul>
      </article>`;
  }).join('');

  return el(`
    <section class="view">
      <header class="view__header">
        <div>
          <h1>Acceso por rol</h1>
          <p class="view__subtitle">Consulta los roles disponibles y las páginas que puede ver cada uno.</p>
        </div>
      </header>
      <div class="role-grid">${cards}</div>
    </section>`);
}
