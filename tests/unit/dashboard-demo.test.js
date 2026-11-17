import { describe, it, expect } from 'vitest';
import {
  ACTIVITY_FEED,
  DEMO_NOTICE,
  ROLE_SHORTCUTS,
  shortcutsForRole,
} from '../../src/data/fixtures/dashboard-demo.js';
import { ROLE_ORDER } from '../../src/domain/access-control.js';

describe('Datos simulados del panel inicial', () => {
  it('define accesos rápidos para cada rol simulado', () => {
    expect(Object.keys(ROLE_SHORTCUTS).sort()).toEqual([...ROLE_ORDER].sort());
    for (const role of ROLE_ORDER) {
      const shortcuts = shortcutsForRole(role);
      expect(shortcuts).toHaveLength(3);
      for (const shortcut of shortcuts) {
        expect(shortcut.moduleId).toBeTruthy();
        expect(shortcut.label).toBeTruthy();
        expect(shortcut.hint).toBeTruthy();
        expect(shortcut.tag).toBeTruthy();
      }
    }
  });

  it('expone actividad determinista y aviso de demostración', () => {
    expect(ACTIVITY_FEED).toHaveLength(4);
    expect(ACTIVITY_FEED.every((item) => item.time && item.title && item.detail && item.tone)).toBe(
      true,
    );
    expect(DEMO_NOTICE.title).toContain('demostración');
    expect(shortcutsForRole('unknown')).toBe(ROLE_SHORTCUTS.plant_manager);
  });
});
