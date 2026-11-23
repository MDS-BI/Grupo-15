import { CANONICAL_ROLES, rolesForUsername } from '../../domain/role-access.js';

const ROLES_BY_USERNAME = Object.freeze({
  jefa: Object.freeze(['plant_manager']),
  supervisor: Object.freeze(['supervisor']),
  planificador: Object.freeze(['planner']),
  operador: Object.freeze(['operator']),
  mantenimiento: Object.freeze(['maintenance']),
  test: Object.freeze(CANONICAL_ROLES),
  doble: Object.freeze(['operator', 'maintenance']),
});

const CREATED_AT = '2026-01-01T00:00:00.000Z';

function rowsForRole(role) {
  return Object.entries(ROLES_BY_USERNAME)
    .filter(([, roles]) => roles.includes(role))
    .map(([username]) =>
      Object.freeze({
        id: `ru_${role}_${username}`,
        company_id: 'cmp_1',
        username,
        password: username,
        created_at: CREATED_AT,
      }),
    );
}

export const ROLE_USER_COLLECTION_KEYS = Object.freeze({
  plant_manager: 'role_users_plant_manager',
  supervisor: 'role_users_supervisor',
  planner: 'role_users_planner',
  operator: 'role_users_operator',
  maintenance: 'role_users_maintenance',
});

export const ROLE_USERS = Object.freeze(
  Object.fromEntries(CANONICAL_ROLES.map((role) => [role, Object.freeze(rowsForRole(role))])),
);

export const DEMO_ACCOUNTS = Object.freeze(
  Object.entries(ROLES_BY_USERNAME).map(([username, roles]) =>
    Object.freeze({ username, password: username, roles: Object.freeze([...roles]) }),
  ),
);

export function authenticate(username, password, roleUsers = ROLE_USERS) {
  const normalized = String(username ?? '')
    .trim()
    .toLowerCase();
  const secret = String(password ?? '');
  if (!normalized || !secret) return null;

  const validPair = CANONICAL_ROLES.some((role) =>
    (roleUsers?.[role] ?? []).some((row) => row.username === normalized && row.password === secret),
  );
  if (!validPair) return null;
  return rolesForUsername(roleUsers, normalized);
}
