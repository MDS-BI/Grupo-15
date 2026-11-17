import { USER_ROLES } from '../../domain/access-control.js';

export const DEMO_ACCOUNTS = Object.freeze([
  Object.freeze({ username: 'operador', password: 'Op3rador2026', role: USER_ROLES.OPERATOR }),
  Object.freeze({
    username: 'supervisor',
    password: 'Sup3rvisor2026',
    role: USER_ROLES.SUPERVISOR,
  }),
  Object.freeze({
    username: 'planificador',
    password: 'Pl4nificador2026',
    role: USER_ROLES.PLANNER,
  }),
  Object.freeze({
    username: 'jefa.planta',
    password: 'Pl4nta2026',
    role: USER_ROLES.PLANT_MANAGER,
  }),
  Object.freeze({ username: 'usuario', password: 'usuario', role: USER_ROLES.PLANT_MANAGER }),
]);

export function authenticate(username, password) {
  const normalized = String(username ?? '')
    .trim()
    .toLowerCase();
  const secret = String(password ?? '');
  const account = DEMO_ACCOUNTS.find(
    (entry) => entry.username === normalized && entry.password === secret,
  );
  return account ? account.role : null;
}
