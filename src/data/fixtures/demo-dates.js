function safeDate(now) {
  return now instanceof Date && Number.isFinite(now.getTime()) ? new Date(now) : new Date();
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function relativeDay(offsetDays = 0, now = new Date()) {
  const date = safeDate(now);
  const offset = Number(offsetDays);
  date.setDate(date.getDate() + (Number.isFinite(offset) ? offset : 0));
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function relativeTimestamp(offsetDays = 0, time = '08:00', now = new Date()) {
  const normalized = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
  return new Date(`${relativeDay(offsetDays, now)}T${normalized}Z`)
    .toISOString()
    .replace('.000Z', 'Z');
}

export function daysAgo(days = 1, now = new Date()) {
  return relativeDay(-Math.abs(Number(days) || 0), now);
}

export function daysFromNow(days = 1, now = new Date()) {
  return relativeDay(Math.abs(Number(days) || 0), now);
}
