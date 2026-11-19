import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { confirmDialog, notifyDialog } from '../../src/components/ConfirmDialog.js';

let dom;

function click(role) {
  const button = document.querySelector(`dialog [data-role="${role}"]`);
  expect(button).toBeTruthy();
  button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

function pressEscape() {
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body><button id="origin">Origen</button></body></html>', {
    url: 'http://localhost/',
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  document.getElementById('origin').focus();
});

afterEach(() => {
  dom.window.close();
});

describe('Diálogos accesibles (T122)', () => {
  it('confirma la acción y devuelve el foco al elemento que abrió el diálogo', async () => {
    const result = confirmDialog({
      title: 'Eliminar material',
      message: '¿Eliminar este material de la receta?',
      confirmLabel: 'Eliminar',
      danger: true,
    });

    const dialog = document.querySelector('dialog.confirm-dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.querySelector('[data-role="confirm"]').textContent).toBe('Eliminar');
    expect(dialog.querySelector('[data-role="confirm"]').classList.contains('btn--danger')).toBe(
      true,
    );
    expect(document.activeElement.getAttribute('data-role')).toBe('cancel');

    click('confirm');
    await expect(result).resolves.toBe(true);
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.activeElement.id).toBe('origin');
  });

  it('cancela la acción sin aplicar cambios', async () => {
    const result = confirmDialog({ title: 'Eliminar estación', message: '¿Continuar?' });

    click('cancel');
    await expect(result).resolves.toBe(false);
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.activeElement.id).toBe('origin');
  });

  it('cierra con Escape como si se cancelara', async () => {
    const result = confirmDialog({ title: 'Eliminar receta', message: '¿Continuar?' });

    pressEscape();
    await expect(result).resolves.toBe(false);
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.activeElement.id).toBe('origin');
  });

  it('muestra un aviso con un solo botón que lo cierra', async () => {
    const result = notifyDialog({ title: 'Sin recetas', message: 'No hay recetas para eliminar.' });

    const dialog = document.querySelector('dialog.confirm-dialog');
    expect(dialog.textContent).toContain('No hay recetas para eliminar.');
    expect(dialog.querySelector('[data-role="cancel"]')).toBeNull();
    expect(document.activeElement.getAttribute('data-role')).toBe('confirm');

    click('confirm');
    await expect(result).resolves.toBeUndefined();
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('inserta el mensaje como texto y no como HTML', async () => {
    const result = confirmDialog({ message: '<img src="x" onerror="alert(1)">' });

    const message = document.querySelector('[data-role="confirm-dialog"] .confirm-dialog__message');
    expect(message.textContent).toBe('<img src="x" onerror="alert(1)">');
    expect(document.querySelector('dialog img')).toBeNull();

    click('cancel');
    await result;
  });
});
