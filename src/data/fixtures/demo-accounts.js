import { CANONICAL_ROLES, rolesForUsername } from '../../domain/role-access.js';

const ACCOUNTS = Object.freeze([
  Object.freeze({
    username: 'jefa.planta',
    password: 'ForjaPlanta26!',
    role: 'plant_manager',
    name: 'Bárbara Ilicura Sotomayor',
    homeModule: 'plant',
  }),
  Object.freeze({
    username: 'planificador.ops',
    password: 'Calendario2026!',
    role: 'planner',
    name: 'Marisol Antihuala Cárcamo',
    homeModule: 'scheduling',
  }),
  Object.freeze({
    username: 'ingeniero.prod',
    password: 'RutaOptimal26!',
    role: 'production_engineer',
    name: 'Efraín Troncoso Bustamante',
    homeModule: 'line-balance',
  }),
  Object.freeze({
    username: 'supervisor.linea',
    password: 'TurnoLinea26!',
    role: 'supervisor',
    name: 'Cristóbal Zermeño Aravena',
    homeModule: 'supervision',
  }),
  Object.freeze({
    username: 'operador.planta',
    password: 'Estacion2026!',
    role: 'operator',
    name: 'Yanis Cheuquemán Linco',
    homeModule: 'operator',
  }),
  Object.freeze({
    username: 'mantencion.mgr',
    password: 'TallerMaq26!',
    role: 'maintenance',
    name: 'Ruperto Espinoza Gaete',
    homeModule: 'maintenance',
  }),
]);

const CREATED_AT = '2026-01-01T00:00:00.000Z';

export const ROLE_USER_COLLECTION_KEYS = Object.freeze({
  plant_manager: 'role_users_plant_manager',
  planner: 'role_users_planner',
  production_engineer: 'role_users_production_engineer',
  supervisor: 'role_users_supervisor',
  operator: 'role_users_operator',
  maintenance: 'role_users_maintenance',
});

export const ROLE_USERS = Object.freeze(
  Object.fromEntries(
    CANONICAL_ROLES.map((role) => {
      const account = ACCOUNTS.find((entry) => entry.role === role);
      return [
        role,
        Object.freeze([
          Object.freeze({
            id: `ru_${role}_${account.username}`,
            company_id: 'cmp_1',
            username: account.username,
            password: account.password,
            name: account.name,
            home_module: account.homeModule,
            created_at: CREATED_AT,
          }),
        ]),
      ];
    }),
  ),
);

export const DEMO_ACCOUNTS = Object.freeze(
  ACCOUNTS.map((account) =>
    Object.freeze({
      username: account.username,
      password: account.password,
      role: account.role,
      roles: Object.freeze([account.role]),
      name: account.name,
      homeModule: account.homeModule,
    }),
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
