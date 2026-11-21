/**
 * @file Panel de acceso por rol: muestra los roles y sus páginas disponibles.
 * Solo la Jefa de Planta (rol real) puede cambiar el rol efectivo desde aquí.
 */

import { el, escapeHtml } from './format.js';
import {
  ROLE_ORDER,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  isAdmin,
  isModuleAllowed,
} from '../domain/access-control.js';

/**
 * @param {{
 *   currentRole: string,
 *   realRole: string,
 *   modules: Array<{ id: string, label: string }>,
 *   onSelect: (role: string) => void
 * }} options
 * @returns {HTMLElement}
 */
export function RoleAccessPanel({ currentRole, realRole, modules = [], onSelect }) {
  const canSwitch = isAdmin(realRole);
  const cards = ROLE_ORDER.map((role) => {
    const active = role === currentRole;
    const pages = modules.filter(
      (module) => module.id !== 'roles' && isModuleAllowed(role, module.id),
    );
    return `
      <article class="role-card ${active ? 'is-active' : ''}" data-role-card="${role}">
        <header class="role-card__header">
          <h2>${ROLE_LABELS[role]}</h2>
          ${active ? '<span class="role-card__badge">Rol efectivo</span>' : ''}
        </header>
        <p class="role-card__desc">${ROLE_DESCRIPTIONS[role]}</p>
        <p class="role-card__label">Páginas disponibles</p>
        <ul class="role-card__pages">
          ${pages.map((module) => `<li>${escapeHtml(module.label)}</li>`).join('')}
        </ul>
        ${
          canSwitch
            ? `<button
          type="button"
          class="btn ${active ? '' : 'btn--primary'}"
          data-select-role="${role}"
          ${active ? 'disabled' : ''}
        >
          ${active ? 'Rol actual' : `Entrar como ${ROLE_LABELS[role]}`}
        </button>`
            : ''
        }
      </article>`;
  }).join('');

  const root = el(`
    <section class="view">
      <header class="view__header">
        <div>
          <h1>Acceso por rol</h1>
          <p class="view__subtitle">${
            canSwitch
              ? 'Cambia el rol efectivo para ver únicamente las páginas de su tarea.'
              : 'Consulta los roles disponibles y las páginas que puede ver cada uno.'
          }</p>
        </div>
      </header>
      <div class="role-grid">${cards}</div>
    </section>`);

  if (canSwitch) {
    root.querySelectorAll('[data-select-role]').forEach((button) => {
      button.addEventListener('click', () => {
        onSelect(button.getAttribute('data-select-role'));
      });
    });
  }

  return root;
}
