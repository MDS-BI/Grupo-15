import { escapeHtml } from './format.js';

function normalizeDecimalText(value) {
  const text = String(value ?? '')
    .trim()
    .replace(/\s/g, '');
  if (!text) return '';
  if (text.includes(',') && text.includes('.')) {
    return text.lastIndexOf(',') > text.lastIndexOf('.')
      ? text.replace(/\./g, '').replace(',', '.')
      : text.replace(/,/g, '');
  }
  return text.replace(',', '.');
}

export function parseDecimal(value, options = {}) {
  const {
    decimals = 2,
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
    required = false,
    label = 'El valor',
  } = options;
  const text = normalizeDecimalText(value);
  if (!text) {
    if (required) throw new Error(`${label} es obligatorio.`);
    return null;
  }
  if (!/^[+-]?\d+(\.\d+)?$/.test(text)) {
    throw new Error(`${label} debe ser un número válido.`);
  }
  const fraction = text.split('.')[1] || '';
  if (fraction.length > decimals) {
    throw new Error(`${label} admite máximo ${decimals} decimales.`);
  }
  const num = Number(text);
  if (!Number.isFinite(num)) {
    throw new Error(`${label} debe ser un número válido.`);
  }
  if (num < min) {
    throw new Error(`${label} debe ser al menos ${min}.`);
  }
  if (num > max) {
    throw new Error(`${label} no puede superar ${max}.`);
  }
  return num;
}

export function decimalInput(options = {}) {
  const {
    name,
    value = '',
    placeholder = '',
    required = false,
    min,
    max,
    decimals = 2,
    label = 'El valor',
    extra = '',
  } = options;
  const attrs = [
    `name="${escapeHtml(name)}"`,
    'type="text"',
    'inputmode="decimal"',
    'autocomplete="off"',
    `data-decimal="${decimals}"`,
    `placeholder="${escapeHtml(placeholder)}"`,
    `value="${escapeHtml(value)}"`,
    required ? 'aria-required="true"' : '',
    min === undefined ? '' : `data-min="${min}"`,
    max === undefined ? '' : `data-max="${max}"`,
    `aria-label="${escapeHtml(label)}"`,
    extra,
  ]
    .filter(Boolean)
    .join(' ');
  return `<input ${attrs} />`;
}
