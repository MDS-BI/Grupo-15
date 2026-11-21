/**
 * @file Primitivas compartidas de capacidad y utilización. Cada panel elige su
 * propia definición de carga; aquí solo se calcula la capacidad efectiva y el
 * ratio carga/capacidad con una única política de días y redondeo.
 */

export function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toMillis(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/** Días hábiles (lunes a viernes) inclusivos del período; mínimo 1. */
export function businessDaysInPeriod(period = {}) {
  const from = toMillis(period.from);
  const to = toMillis(period.to);
  if (from === null || to === null) return 1;
  const start = new Date(from);
  const end = new Date(to);
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  let count = 0;
  while (cursor <= last) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return Math.max(1, count);
}

export function efficiencyFactorOf(workCenter) {
  const raw = Number(workCenter?.efficiency_factor);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

/** Capacidad efectiva de un día, o `null` si el centro no tiene capacidad. */
export function effectiveDailyCapacity(workCenter) {
  const capacity = Number(workCenter?.capacity_per_day_minutes) || 0;
  const daily = capacity * efficiencyFactorOf(workCenter);
  const rounded = round2(daily);
  return rounded > 0 ? rounded : null;
}

/** Capacidad del período = días hábiles × min/día × eficiencia. */
export function capacityFor(workCenter, period = {}) {
  const days = businessDaysInPeriod(period);
  const capacity = Number(workCenter?.capacity_per_day_minutes) || 0;
  const efficiency = efficiencyFactorOf(workCenter);
  const daily = round2(capacity * efficiency);
  const valid = daily > 0;
  return {
    business_days: days,
    efficiency_factor: efficiency,
    effective_per_day_minutes: valid ? daily : null,
    capacity_minutes: valid ? round2(capacity * efficiency * days) : null,
    invalid_capacity: !valid,
  };
}

/** Ratio carga/capacidad redondeado a 2 decimales; `null` si no hay capacidad. */
export function loadRatio(loadMinutes, capacityMinutes) {
  if (capacityMinutes === null || capacityMinutes === undefined) return null;
  const capacity = Number(capacityMinutes);
  const load = Number(loadMinutes);
  if (!Number.isFinite(capacity) || capacity <= 0 || !Number.isFinite(load)) return null;
  return round2(load / capacity);
}
