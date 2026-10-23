/**
 * @file Explorador de BOM: árbol jerárquico multi-nivel + editor de líneas.
 * Ver US-01 (plan.md §2) y data-model.md §3.6–3.7.
 */

import { fmtNumber, escapeHtml, el } from './format.js';
import { makeId } from '../domain/types.js';
import { validateBomComponent } from '../domain/validators.js';

/**
 * @param {import('../data/ManufacturingStore.js').ManufacturingStore} store
 * @returns {HTMLElement}
 */
export function BomExplorer(store) {
  const boms = store.activeBoms();
  let selectedBomId = boms.length ? boms[0].id : null;

  const root = el(`
    <section class="view">
      <header class="view__header">
        <div>
          <h1>Explorador de BOM</h1>
          <p class="view__subtitle">Estructuras de materiales multi-nivel y consumo teórico.</p>
        </div>
      </header>
      <div class="bom-layout">
        <aside class="panel panel--side">
          <header class="panel__header"><h2>Listas de Materiales</h2></header>
          <ul class="bom-list" data-role="bom-list"></ul>
        </aside>
        <div class="panel panel--main">
          <header class="panel__header">
            <h2 data-role="bom-title">—</h2>
            <p class="panel__subtitle" data-role="bom-meta"></p>
          </header>
          <div class="bom-tree" data-role="tree"></div>
          <div class="bom-editor" data-role="editor"></div>
        </div>
      </div>
    </section>`);

  const listEl = root.querySelector('[data-role="bom-list"]');
  const titleEl = root.querySelector('[data-role="bom-title"]');
  const metaEl = root.querySelector('[data-role="bom-meta"]');
  const treeEl = root.querySelector('[data-role="tree"]');
  const editorEl = root.querySelector('[data-role="editor"]');

  function renderList() {
    listEl.innerHTML = boms.map((bom) => {
      const product = store.productById(bom.product_id);
      const active = bom.id === selectedBomId ? 'is-active' : '';
      return `<li>
        <button type="button" class="bom-list__item ${active}" data-bom="${bom.id}">
          <span class="bom-list__name">${escapeHtml(product ? product.name : bom.product_id)}</span>
          <span class="bom-list__code">${escapeHtml(bom.code)} · v${escapeHtml(bom.version)}</span>
        </button>
      </li>`;
    }).join('');
    listEl.querySelectorAll('[data-bom]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedBomId = btn.getAttribute('data-bom');
        renderAll();
      });
    });
  }

  function renderTree() {
    const bom = store.billOfMaterials.find((b) => b.id === selectedBomId);
    if (!bom) {
      titleEl.textContent = 'Sin BOM seleccionada';
      metaEl.textContent = '';
      treeEl.innerHTML = '';
      return;
    }
    const product = store.productById(bom.product_id);
    titleEl.textContent = product ? product.name : bom.product_id;
    metaEl.textContent = `${bom.code} · versión ${bom.version} · base ${fmtNumber(bom.base_quantity)} · vigente desde ${bom.effective_from}`;
    const tree = store.bomTree(bom.id);
    treeEl.innerHTML = renderNode(tree, true);
    treeEl.querySelectorAll('[data-toggle]').forEach((node) => {
      node.addEventListener('click', () => {
        const li = node.closest('.tree-node');
        li.classList.toggle('is-collapsed');
      });
    });
  }

  function renderNode(node, isRoot = false) {
    const hasChildren = node.children.length > 0;
    const uom = '';
    const childrenHtml = hasChildren
      ? `<ul class="tree-children">${node.children.map((c) => renderNode(c)).join('')}</ul>`
      : '';
    const toggle = hasChildren
      ? `<button type="button" class="tree-toggle" data-toggle aria-label="Expandir/colapsar">▾</button>`
      : `<span class="tree-toggle tree-toggle--empty"></span>`;
    const typeTag = isRoot
      ? '<span class="tag tag--fg">Bien Terminado</span>'
      : hasChildren
        ? '<span class="tag tag--sub">Sub-ensamble</span>'
        : '<span class="tag tag--leaf">Material</span>';
    return `
      <li class="tree-node">
        <div class="tree-row">
          ${toggle}
          <span class="tree-name">${escapeHtml(node.name)}</span>
          ${typeTag}
          <span class="tree-qty">${fmtNumber(node.quantity_per_unit, 2)} ${escapeHtml(uom)}/u</span>
          ${node.scrap_percentage ? `<span class="tree-scrap">merma ${fmtNumber(node.scrap_percentage, 1)}%</span>` : ''}
        </div>
        ${childrenHtml}
      </li>`;
  }

  function renderEditor() {
    const bom = store.billOfMaterials.find((b) => b.id === selectedBomId);
    if (!bom) {
      editorEl.innerHTML = '';
      return;
    }
    const lines = store.bomComponents
      .filter((c) => c.bom_id === bom.id)
      .sort((a, b) => a.sequence - b.sequence);
    const options = store.products
      .filter((p) => p.product_type !== 'finished_good')
      .map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.code)})</option>`)
      .join('');

    const rows = lines.map((line) => {
      const prod = store.productById(line.component_product_id);
      const uom = store.uomById(line.uom_id);
      return `<tr>
        <td>${escapeHtml(prod ? prod.name : line.component_product_id)}</td>
        <td>${fmtNumber(line.quantity_per_unit, 4)} ${escapeHtml(uom ? uom.code : '')}</td>
        <td>${fmtNumber(line.scrap_percentage, 2)}%</td>
        <td>${line.sequence}</td>
      </tr>`;
    }).join('');

    editorEl.innerHTML = `
      <header class="panel__header"><h3>Componentes (${lines.length})</h3></header>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Componente</th><th>Cant./unidad</th><th>Merma</th><th>Secuencia</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4" class="empty-cell">Sin componentes.</td></tr>'}</tbody>
        </table>
      </div>
      <form class="inline-form" data-role="add-component">
        <select name="component_product_id" required>
          <option value="">Añadir componente…</option>
          ${options}
        </select>
        <input name="quantity_per_unit" type="number" min="0.0001" step="0.0001" placeholder="Cant./unidad" required />
        <input name="scrap_percentage" type="number" min="0" step="0.01" placeholder="Merma %" value="0" />
        <button type="submit" class="btn btn--primary">Añadir</button>
      </form>
      <p class="form-error" data-role="error" role="alert"></p>`;

    const form = editorEl.querySelector('[data-role="add-component"]');
    const errorEl = editorEl.querySelector('[data-role="error"]');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const componentProductId = data.get('component_product_id');
      const product = store.productById(componentProductId);
      const line = {
        id: makeId('bc'),
        bom_id: bom.id,
        component_product_id: componentProductId,
        quantity_per_unit: Number(data.get('quantity_per_unit')),
        uom_id: product ? product.uom_id : 'uom_un',
        scrap_percentage: Number(data.get('scrap_percentage')) || 0,
        sequence: (lines.at(-1)?.sequence || 0) + 10,
        is_optional: false,
      };
      const issues = validateBomComponent(line, lines);
      if (issues.length) {
        errorEl.textContent = issues.map((i) => i.message).join(' ');
        return;
      }
      errorEl.textContent = '';
      store.bomComponents.push(line);
      store.dispatchEvent(new Event('change'));
      renderAll();
    });
  }

  function renderAll() {
    renderList();
    renderTree();
    renderEditor();
  }

  renderAll();
  return root;
}
