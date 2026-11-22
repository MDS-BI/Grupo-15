import { describe, it, expect } from 'vitest';
import {
  formatLocalDate,
  formatLocalDateTime,
  formatDurationLong,
} from '../../src/components/format.js';

describe('Helpers de formato de Fase 24', () => {
  it('formatea fechas y fechas con hora en es-CL', () => {
    const dateOnly = new Date('2026-11-22T12:00:00');
    const dateTime = new Date('2026-11-22T10:30:00Z');

    expect(formatLocalDate('2026-11-22')).toBe(
      new Intl.DateTimeFormat('es-CL', { dateStyle: 'short' }).format(dateOnly),
    );
    expect(formatLocalDateTime(dateTime.toISOString())).toBe(
      new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(dateTime),
    );
    expect(formatLocalDate(null)).toBe('—');
    expect(formatLocalDateTime('no-es-fecha')).toBe('—');
  });

  it('formatea duraciones largas como días, horas y minutos', () => {
    expect(formatDurationLong(1500)).toBe('1 d 1 h 0 min');
    expect(formatDurationLong(90)).toBe('0 d 1 h 30 min');
    expect(formatDurationLong(45.7)).toBe('0 d 0 h 46 min');
    expect(formatDurationLong(null)).toBe('—');
  });
});
