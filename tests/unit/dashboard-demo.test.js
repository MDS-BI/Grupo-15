import { describe, it, expect } from 'vitest';
import { ACTIVITY_FEED, DEMO_NOTICE } from '../../src/data/fixtures/dashboard-demo.js';

describe('Datos simulados del panel inicial', () => {
  it('expone actividad determinista y aviso de demostración', () => {
    expect(ACTIVITY_FEED).toHaveLength(4);
    expect(ACTIVITY_FEED.every((item) => item.time && item.title && item.detail && item.tone)).toBe(
      true,
    );
    expect(DEMO_NOTICE.title).toContain('demostración');
    expect(DEMO_NOTICE.detail).toContain('actividad');
  });
});
