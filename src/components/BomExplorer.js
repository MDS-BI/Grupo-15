/**
 * @file Explorador de BOM: árbol jerárquico multi-nivel + editor de recetas.
 * Ver US-01 (plan.md §2) y data-model.md §3.6–3.10.
 */

import { fmtNumber, escapeHtml, el } from './format.js';
import { decimalInput, parseDecimal } from './numeric-field.js';
import { confirmDialog, notifyDialog } from './ConfirmDialog.js';
import { can } from '../domain/access-control.js';

const MODIFY_FIELDS = [
  ['material_quantity', 'Cantidad de un material'],
  ['material_scrap', 'Merma de un material'],
  ['add_material', 'Añadir material'],
  ['remove_material', 'Eliminar material'],
  ['station_time', 'Tiempo estimado de una estación'],
  ['station_setup', 'Tiempo de alistamiento de una estación'],
  ['add_station', 'Añadir estación'],
  ['remove_station', 'Eliminar estación'],
  ['product_name', 'Nombre del producto'],
  ['code', 'Código de la receta'],
  ['version', 'Versión de la receta'],
  ['effective_from', 'Vigencia desde'],
  ['base_quantity', 'Cantidad base'],
  ['notes', 'Notas'],
];

/**
 * @param {import('../data/ManufacturingStore.js').ManufacturingStore} store
 * @param {{role?: string}} [options]
 * @returns {HTMLElement}
 */
export function BomExplorer(store, options = {}) {
  const role = options.role;
  const canView = can(role, 'bom.ver');
  const canCreate = can(role, 'bom.crear');
  const canEdit = can(role, 'bom.editar');
  let selectedBomId = store.activeBoms().length ? store.activeBoms()[0].id : null;

  const root = el(`
    <section class="view">
      <header class="view__header">
        <div>
          <h1>Explorador de BOM</h1>
          <p class="view__subtitle">Recetas, materiales, estaciones y consumo teórico.</p>
        </div>
        <div class="row-actions">
          ${canCreate ? '<button type="button" class="btn btn--primary" data-role="new-recipe">Añadir receta</button>' : ''}
          ${canEdit ? '<button type="button" class="btn" data-role="edit-recipe">Modificar receta</button>' : ''}
          ${canEdit ? '<button type="button" class="btn btn--danger" data-role="delete-recipe">Eliminar receta</button>' : ''}
        </div>
      </header>
      <div class="bom-layout">
        <aside class="panel panel--side" data-action="bom.ver">
          <header class="panel__header"><h2>Recetas / Listas de Materiales</h2></header>
          <div class="panel__body">
            <ul class="bom-list" data-role="bom-list"></ul>
          </div>
        </aside>
        <div class="panel panel--main">
          <header class="panel__header">
            <h2 data-role="bom-title">—</h2>
            <p class="panel__subtitle" data-role="bom-meta"></p>
          </header>
          <div class="panel__body">
            <div class="bom-tree" data-role="tree"></div>
            <div class="bom-editor" data-role="editor"></div>
          </div>
        </div>
      </div>
      <div class="modal-root" data-role="modal-root"></div>
    </section>`);

  const listEl = root.querySelector('[data-role="bom-list"]');
  const titleEl = root.querySelector('[data-role="bom-title"]');
  const metaEl = root.querySelector('[data-role="bom-meta"]');
  const treeEl = root.querySelector('[data-role="tree"]');
  const editorEl = root.querySelector('[data-role="editor"]');
  const modalRoot = root.querySelector('[data-role="modal-root"]');

  function currentBom() {
    return store.billOfMaterials.find((bom) => bom.id === selectedBomId) || null;
  }

  function productNameOf(bom) {
    const product = bom ? store.productById(bom.product_id) : null;
    return product ? product.name : bom ? bom.product_id : '';
  }

  function ensureSelection() {
    const boms = store.activeBoms();
    if (!boms.some((bom) => bom.id === selectedBomId)) {
      selectedBomId = boms.length ? boms[0].id : null;
    }
    return boms;
  }

  function renderList(boms) {
    listEl.innerHTML = boms
      .map((bom) => {
        const active = bom.id === selectedBomId ? 'is-active' : '';
        return `<li>
        <button type="button" class="bom-list__item ${active}" data-bom="${escapeHtml(bom.id)}">
          <span class="bom-list__name">${escapeHtml(productNameOf(bom))}</span>
          <span class="bom-list__code">${escapeHtml(bom.code)} · v${escapeHtml(bom.version)}</span>
        </button>
      </li>`;
      })
      .join('');
    if (!boms.length) {
      listEl.innerHTML = '<li><p class="empty-note">No hay recetas registradas.</p></li>';
    }
    listEl.querySelectorAll('[data-bom]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedBomId = btn.getAttribute('data-bom');
        renderAll();
      });
    });
  }

  function renderTree() {
    const bom = currentBom();
    if (!bom) {
      titleEl.textContent = 'Sin receta seleccionada';
      metaEl.textContent = '';
      treeEl.innerHTML = '';
      return;
    }
    titleEl.textContent = productNameOf(bom);
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
          <span class="tree-qty">${fmtNumber(node.quantity_per_unit, 2)}/u</span>
          ${node.scrap_percentage ? `<span class="tree-scrap">merma ${fmtNumber(node.scrap_percentage, 1)}%</span>` : ''}
        </div>
        ${childrenHtml}
      </li>`;
  }

  function materialOptions(excludeIds = []) {
    const excluded = new Set(excludeIds);
    return store.products
      .filter((product) => !excluded.has(product.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map(
        (product) =>
          `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} (${escapeHtml(product.code)})</option>`,
      )
      .join('');
  }

  function stationOptions() {
    return store.workCenters
      .filter((workCenter) => workCenter.status === 'active')
      .map(
        (workCenter) =>
          `<option value="${escapeHtml(workCenter.id)}">${escapeHtml(workCenter.name)} (${escapeHtml(workCenter.code)})</option>`,
      )
      .join('');
  }

  function renderEditor() {
    const bom = currentBom();
    if (!bom) {
      editorEl.innerHTML = `
        <p class="empty-note">Crea una receta para registrar materiales y estaciones.</p>
        ${canCreate ? '<div class="detail-actions"><button type="button" class="btn btn--primary" data-role="empty-new">Añadir receta</button></div>' : ''}`;
      const emptyNew = editorEl.querySelector('[data-role="empty-new"]');
      if (emptyNew) emptyNew.addEventListener('click', openNewRecipeModal);
      return;
    }

    const lines = store.bomMaterials(bom.id);
    const stations = store.bomStations(bom.id);

    const rows = lines
      .map((line) => {
        const prod = store.productById(line.component_product_id);
        const uom = store.uomById(line.uom_id);
        return `<tr data-material="${escapeHtml(line.id)}">
        <td>${escapeHtml(prod ? prod.name : line.component_product_id)}</td>
        <td>${fmtNumber(line.quantity_per_unit, 4)} ${escapeHtml(uom ? uom.code : '')}</td>
        <td>${fmtNumber(line.scrap_percentage, 2)}%</td>
        <td>${escapeHtml(line.sequence)}</td>
        <td class="cell--actions">${
          canEdit
            ? `<button type="button" class="btn btn--tiny" data-edit-material="${escapeHtml(line.id)}">Modificar</button>
          <button type="button" class="btn btn--tiny btn--danger" data-remove-material="${escapeHtml(line.id)}">Eliminar</button>`
            : ''
        }</td>
      </tr>`;
      })
      .join('');

    const stationRows = stations
      .map((station) => {
        const workCenter = station.work_center;
        return `<tr data-station="${escapeHtml(station.id)}">
        <td>${escapeHtml(station.sequence)}</td>
        <td>${escapeHtml(workCenter ? workCenter.name : station.work_center_id)}</td>
        <td>${escapeHtml(station.description || '—')}</td>
        <td>${fmtNumber(station.setup_time_minutes, 2)} min</td>
        <td>${fmtNumber(station.run_time_per_unit_minutes, 2)} min/u</td>
        <td>${fmtNumber(station.estimated_time_minutes, 2)} min</td>
        <td class="cell--actions">${
          canEdit
            ? `<button type="button" class="btn btn--tiny" data-edit-station="${escapeHtml(station.id)}">Modificar</button>
          <button type="button" class="btn btn--tiny btn--danger" data-remove-station="${escapeHtml(station.id)}">Eliminar</button>`
            : ''
        }</td>
      </tr>`;
      })
      .join('');

    const usedMaterialIds = lines.map((line) => line.component_product_id);
    const addableMaterials = materialOptions([bom.product_id, ...usedMaterialIds]);

    editorEl.innerHTML = `
      <header class="panel__header">
        <h3>Estaciones y tiempos (${stations.length})</h3>
        <p class="panel__subtitle">Tiempo estimado = alistamiento + tiempo por unidad × cantidad base.</p>
      </header>
      <div class="table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr><th>#</th><th>Estación / máquina</th><th>Descripción</th><th>Alistamiento</th><th>Tiempo/unidad</th><th>Tiempo estimado</th><th></th></tr></thead>
          <tbody>${stationRows || '<tr><td colspan="7" class="empty-cell">Sin estaciones configuradas.</td></tr>'}</tbody>
        </table>
      </div>
      ${
        canEdit
          ? `<div class="detail-actions">
        <button type="button" class="btn btn--small" data-role="add-station">Añadir estación</button>
        <button type="button" class="btn btn--small" data-role="edit-stations">Modificar tiempos</button>
      </div>`
          : ''
      }

      <header class="panel__header"><h3>Materiales (${lines.length})</h3></header>
      <div class="table-wrap">
        <table class="data-table data-table--compact">
          <thead><tr><th>Componente</th><th>Cant./unidad</th><th>Merma</th><th>Secuencia</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="empty-cell">Sin materiales.</td></tr>'}</tbody>
        </table>
      </div>
      ${
        canEdit
          ? `<form class="inline-form" data-role="add-component">
        <select name="component_product_id" required>
          <option value="">Añadir material…</option>
          ${addableMaterials}
        </select>
        ${decimalInput({ name: 'quantity_per_unit', placeholder: 'Cant./unidad', required: true, min: 0.01, label: 'La cantidad por unidad' })}
        ${decimalInput({ name: 'scrap_percentage', placeholder: 'Merma %', value: '0', min: 0, label: 'La merma' })}
        <button type="submit" class="btn btn--primary">Añadir</button>
      </form>`
          : ''
      }
      <p class="form-error" data-role="error" role="alert"></p>`;

    const form = editorEl.querySelector('[data-role="add-component"]');
    const errorEl = editorEl.querySelector('[data-role="error"]');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      try {
        store.addBomComponent(bom.id, {
          component_product_id: data.get('component_product_id'),
          quantity_per_unit: parseDecimal(data.get('quantity_per_unit'), {
            required: true,
            min: 0.01,
            label: 'La cantidad por unidad',
          }),
          scrap_percentage:
            parseDecimal(data.get('scrap_percentage'), { min: 0, label: 'La merma' }) ?? 0,
        });
        renderAll();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });

    editorEl.querySelectorAll('[data-edit-material]').forEach((btn) => {
      btn.addEventListener('click', () =>
        openModifyRecipeModal({
          field: 'material_quantity',
          target: btn.getAttribute('data-edit-material'),
        }),
      );
    });
    editorEl.querySelectorAll('[data-remove-material]').forEach((btn) => {
      btn.addEventListener('click', () => removeMaterial(btn.getAttribute('data-remove-material')));
    });
    editorEl.querySelectorAll('[data-edit-station]').forEach((btn) => {
      btn.addEventListener('click', () =>
        openModifyRecipeModal({
          field: 'station_time',
          target: btn.getAttribute('data-edit-station'),
        }),
      );
    });
    editorEl.querySelectorAll('[data-remove-station]').forEach((btn) => {
      btn.addEventListener('click', () => removeStation(btn.getAttribute('data-remove-station')));
    });
    const addStationBtn = editorEl.querySelector('[data-role="add-station"]');
    if (addStationBtn) {
      addStationBtn.addEventListener('click', () =>
        openModifyRecipeModal({ field: 'add_station' }),
      );
    }
    const editStationsBtn = editorEl.querySelector('[data-role="edit-stations"]');
    if (editStationsBtn) {
      editStationsBtn.addEventListener('click', () =>
        openModifyRecipeModal({ field: 'station_time' }),
      );
    }
  }

  async function removeMaterial(componentId) {
    const bom = currentBom();
    if (!bom) return;
    const line = store.bomComponents.find((item) => item.id === componentId);
    const product = line ? store.productById(line.component_product_id) : null;
    const name = product ? product.name : componentId;
    const confirmed = await confirmDialog({
      title: 'Eliminar material',
      message: `¿Eliminar el material "${name}" de la receta?`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;
    try {
      store.removeBomComponent(bom.id, componentId);
      renderAll();
    } catch (err) {
      await notifyDialog({ title: 'No se pudo eliminar el material', message: err.message });
    }
  }

  async function removeStation(operationId) {
    const bom = currentBom();
    if (!bom) return;
    const operation = store.routingOperations.find((item) => item.id === operationId);
    const workCenter = operation ? store.workCenterById(operation.work_center_id) : null;
    const name = workCenter ? workCenter.name : operationId;
    const confirmed = await confirmDialog({
      title: 'Eliminar estación',
      message: `¿Eliminar la estación "${name}" de la receta?`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;
    try {
      store.removeRoutingOperationForBom(bom.id, operationId);
      renderAll();
    } catch (err) {
      await notifyDialog({ title: 'No se pudo eliminar la estación', message: err.message });
    }
  }

  function showModal(innerHtml) {
    modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal modal--wide">${innerHtml}</div></div>`;
    const cancel = modalRoot.querySelector('[data-role="cancel"]');
    if (cancel) cancel.addEventListener('click', closeModal);
    modalRoot.querySelector('.modal-backdrop').addEventListener('click', (event) => {
      if (event.target.classList.contains('modal-backdrop')) closeModal();
    });
  }

  function closeModal() {
    modalRoot.innerHTML = '';
  }

  function parseMaterialsFromForm(form) {
    return [...form.querySelectorAll('[data-material-row]')].map((row) => ({
      component_product_id: row.querySelector('[name="material_product_id"]').value,
      quantity_per_unit: parseDecimal(row.querySelector('[name="material_quantity"]').value, {
        required: true,
        min: 0.01,
        label: 'La cantidad por unidad',
      }),
      scrap_percentage:
        parseDecimal(row.querySelector('[name="material_scrap"]').value, {
          min: 0,
          label: 'La merma',
        }) ?? 0,
    }));
  }

  function parseStationsFromForm(form) {
    return [...form.querySelectorAll('[data-station-row]')].map((row) => ({
      work_center_id: row.querySelector('[name="station_work_center_id"]').value,
      description: row.querySelector('[name="station_description"]').value,
      setup_time_minutes:
        parseDecimal(row.querySelector('[name="station_setup"]').value, {
          min: 0,
          label: 'El alistamiento',
        }) ?? 0,
      run_time_per_unit_minutes: parseDecimal(row.querySelector('[name="station_time"]').value, {
        required: true,
        min: 0.01,
        label: 'El tiempo estimado por unidad',
      }),
    }));
  }

  function bindRecipeRows(form) {
    const materialsEl = form.querySelector('[data-role="materials"]');
    const stationsEl = form.querySelector('[data-role="stations"]');

    function addMaterialRow() {
      if (!materialsEl) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'recipe-row';
      wrapper.setAttribute('data-material-row', '');
      wrapper.innerHTML = `
        <select name="material_product_id" required>
          <option value="">Material…</option>
          ${materialOptions([])}
        </select>
        ${decimalInput({ name: 'material_quantity', placeholder: 'Cant./unidad', required: true, min: 0.01, label: 'La cantidad por unidad' })}
        ${decimalInput({ name: 'material_scrap', placeholder: 'Merma %', value: '0', min: 0, label: 'La merma' })}
        <button type="button" class="btn btn--tiny btn--danger" data-remove-row>Quitar</button>`;
      wrapper.querySelector('[data-remove-row]').addEventListener('click', () => wrapper.remove());
      materialsEl.appendChild(wrapper);
    }

    function addStationRow() {
      if (!stationsEl) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'recipe-row';
      wrapper.setAttribute('data-station-row', '');
      wrapper.innerHTML = `
        <select name="station_work_center_id" required>
          <option value="">Estación / máquina…</option>
          ${stationOptions()}
        </select>
        <input name="station_description" type="text" placeholder="Descripción (opcional)" />
        ${decimalInput({ name: 'station_setup', placeholder: 'Alistamiento min', value: '0', min: 0, label: 'El alistamiento' })}
        ${decimalInput({ name: 'station_time', placeholder: 'Tiempo estimado min/u', required: true, min: 0.01, label: 'El tiempo estimado por unidad' })}
        <button type="button" class="btn btn--tiny btn--danger" data-remove-row>Quitar</button>`;
      wrapper.querySelector('[data-remove-row]').addEventListener('click', () => wrapper.remove());
      stationsEl.appendChild(wrapper);
    }

    form.querySelector('[data-role="add-material-row"]').addEventListener('click', addMaterialRow);
    form.querySelector('[data-role="add-station-row"]').addEventListener('click', addStationRow);
    addMaterialRow();
    addStationRow();
  }

  function openNewRecipeModal() {
    if (!canCreate) return;
    const productNames = store.products
      .filter((product) => product.product_type === 'finished_good')
      .map((product) => `<option value="${escapeHtml(product.name)}"></option>`)
      .join('');
    showModal(`
      <h2>Nueva receta</h2>
      <form data-role="form" class="stack-form recipe-form">
        <div class="recipe-grid">
          <label>Nombre del producto
            <input name="product_name" list="recipe-product-names" placeholder="Ej: Bicicleta Urbana 700c" required />
            <datalist id="recipe-product-names">${productNames}</datalist>
          </label>
          <label>Código (opcional)
            <input name="code" type="text" placeholder="Automático" />
          </label>
          <label>Versión (opcional)
            <input name="version" type="text" placeholder="Automática" maxlength="8" />
          </label>
          <label>Vigente desde
            <input name="effective_from" type="date" value="${new Date().toISOString().slice(0, 10)}" required />
          </label>
          <label>Cantidad base
            ${decimalInput({ name: 'base_quantity', value: '1', required: true, min: 0.01, label: 'La cantidad base' })}
          </label>
        </div>
        <fieldset class="recipe-fieldset">
          <legend>Materiales necesarios</legend>
          <div data-role="materials"></div>
          <button type="button" class="btn btn--small" data-role="add-material-row">Añadir material</button>
        </fieldset>
        <fieldset class="recipe-fieldset">
          <legend>Estaciones / máquinas y tiempo estimado</legend>
          <div data-role="stations"></div>
          <button type="button" class="btn btn--small" data-role="add-station-row">Añadir estación</button>
        </fieldset>
        <label>Notas
          <textarea name="notes" rows="2" placeholder="Observaciones de la receta"></textarea>
        </label>
        <p class="form-error" data-role="error" role="alert"></p>
        <div class="modal-actions">
          <button type="button" class="btn" data-role="cancel">Cancelar</button>
          <button type="submit" class="btn btn--primary">Guardar receta</button>
        </div>
      </form>`);

    const form = modalRoot.querySelector('[data-role="form"]');
    const errorEl = form.querySelector('[data-role="error"]');
    bindRecipeRows(form);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      try {
        const result = store.createBomRecipe({
          product_name: data.get('product_name'),
          code: data.get('code'),
          version: data.get('version'),
          effective_from: data.get('effective_from'),
          base_quantity: parseDecimal(data.get('base_quantity'), {
            required: true,
            min: 0.01,
            label: 'La cantidad base',
          }),
          notes: data.get('notes'),
          materials: parseMaterialsFromForm(form),
          stations: parseStationsFromForm(form),
        });
        selectedBomId = result.bom.id;
        closeModal();
        renderAll();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  }

  function buildModifyFields(field, presetTarget = null) {
    const bom = currentBom();
    if (!bom) return '';
    const selected = (value) => (value === presetTarget ? 'selected' : '');

    if (field.startsWith('material_') || field === 'remove_material') {
      const lines = store.bomMaterials(bom.id);
      const options = lines
        .map((line) => {
          const product = store.productById(line.component_product_id);
          return `<option value="${escapeHtml(line.id)}" ${selected(line.id)}>${escapeHtml(product ? product.name : line.component_product_id)}</option>`;
        })
        .join('');
      if (!lines.length) return '<p class="empty-note">La receta no tiene materiales.</p>';
      const target = `<label>Material
          <select name="target" data-role="target">${options}</select>
        </label>`;
      if (field === 'remove_material') return target;
      if (field === 'material_scrap') {
        return `${target}<label>Nueva merma (%)
           ${decimalInput({ name: 'change_value', extra: 'data-role="change-value"', required: true, min: 0, label: 'La merma' })}</label>`;
      }
      return `${target}<label>Nueva cantidad por unidad
         ${decimalInput({ name: 'change_value', extra: 'data-role="change-value"', required: true, min: 0.01, label: 'La cantidad por unidad' })}</label>`;
    }

    if (field === 'add_material') {
      const used = store.bomMaterials(bom.id).map((line) => line.component_product_id);
      const options = materialOptions([bom.product_id, ...used]);
      return `<label>Material a añadir
          <select name="target" data-role="target" required>
            <option value="">Selecciona…</option>${options}
          </select>
        </label>
        <label>Cantidad por unidad
          ${decimalInput({ name: 'change_value', extra: 'data-role="change-value"', required: true, min: 0.01, label: 'La cantidad por unidad' })}
        </label>
        <label>Merma (%)
          ${decimalInput({ name: 'scrap', value: '0', min: 0, label: 'La merma' })}
        </label>`;
    }

    if (field.startsWith('station_') || field === 'remove_station') {
      const stations = store.bomStations(bom.id);
      const options = stations
        .map((station) => {
          const name = station.work_center ? station.work_center.name : station.work_center_id;
          return `<option value="${escapeHtml(station.id)}" ${selected(station.id)}>${escapeHtml(name)}</option>`;
        })
        .join('');
      if (!stations.length) return '<p class="empty-note">La receta no tiene estaciones.</p>';
      const target = `<label>Estación / máquina
          <select name="target" data-role="target">${options}</select>
        </label>`;
      if (field === 'remove_station') return target;
      if (field === 'station_setup') {
        return `${target}<label>Nuevo tiempo de alistamiento (min)
           ${decimalInput({ name: 'change_value', extra: 'data-role="change-value"', required: true, min: 0, label: 'El alistamiento' })}</label>`;
      }
      return `${target}<label>Nuevo tiempo estimado por unidad (min)
         ${decimalInput({ name: 'change_value', extra: 'data-role="change-value"', required: true, min: 0.01, label: 'El tiempo estimado por unidad' })}</label>`;
    }

    if (field === 'add_station') {
      const used = store.bomStations(bom.id).map((station) => station.work_center_id);
      const options = store.workCenters
        .filter((workCenter) => workCenter.status === 'active' && !used.includes(workCenter.id))
        .map(
          (workCenter) =>
            `<option value="${escapeHtml(workCenter.id)}">${escapeHtml(workCenter.name)} (${escapeHtml(workCenter.code)})</option>`,
        )
        .join('');
      return `<label>Estación / máquina a añadir
          <select name="target" data-role="target" required>
            <option value="">Selecciona…</option>${options}
          </select>
        </label>
        <label>Descripción (opcional)
          <input name="description" type="text" placeholder="Operación" />
        </label>
        <label>Tiempo de alistamiento (min)
          ${decimalInput({ name: 'setup', value: '0', min: 0, label: 'El alistamiento' })}
        </label>
        <label>Tiempo estimado por unidad (min)
          ${decimalInput({ name: 'change_value', extra: 'data-role="change-value"', required: true, min: 0.01, label: 'El tiempo estimado por unidad' })}
        </label>`;
    }

    if (field === 'notes') {
      return `<label>Nuevo valor de notas
        <textarea name="change_value" data-role="change-value" rows="3"></textarea>
      </label>`;
    }
    if (field === 'effective_from') {
      return `<label>Nueva fecha de vigencia
        <input name="change_value" data-role="change-value" type="date" required />
      </label>`;
    }
    if (field === 'base_quantity') {
      return `<label>Nueva cantidad base
        ${decimalInput({ name: 'change_value', extra: 'data-role="change-value"', required: true, min: 0.01, label: 'La cantidad base' })}
      </label>`;
    }
    if (field === 'product_name') {
      return `<label>Nuevo nombre del producto
        <input name="change_value" data-role="change-value" type="text" required />
      </label>`;
    }
    return `<label>Nuevo valor
      <input name="change_value" data-role="change-value" type="text" required />
    </label>`;
  }

  function openModifyRecipeModal({ field = 'material_quantity', target = null } = {}) {
    if (!canEdit) return;
    const bom = currentBom();
    if (!bom) return;
    const fieldOptions = MODIFY_FIELDS.map(
      ([value, label]) =>
        `<option value="${value}" ${value === field ? 'selected' : ''}>${label}</option>`,
    ).join('');
    showModal(`
      <h2>Modificar receta — ${escapeHtml(productNameOf(bom))}</h2>
      <form data-role="form" class="stack-form">
        <label>¿Qué desea modificar dentro de la receta?
          <select name="field" data-role="field">${fieldOptions}</select>
        </label>
        <div data-role="dynamic"></div>
        <p class="form-error" data-role="error" role="alert"></p>
        <div class="modal-actions">
          <button type="button" class="btn" data-role="cancel">Cancelar</button>
          <button type="submit" class="btn btn--primary">Aplicar cambio</button>
        </div>
      </form>`);

    const form = modalRoot.querySelector('[data-role="form"]');
    const dynamicEl = form.querySelector('[data-role="dynamic"]');
    const errorEl = form.querySelector('[data-role="error"]');
    let presetTarget = target;

    const renderDynamic = () => {
      const selectedField = form.querySelector('[name="field"]').value;
      dynamicEl.innerHTML = buildModifyFields(selectedField, presetTarget);
    };
    form.querySelector('[name="field"]').addEventListener('change', () => {
      presetTarget = null;
      renderDynamic();
    });
    renderDynamic();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const selectedField = form.querySelector('[name="field"]').value;
      const targetEl = form.querySelector('[data-role="target"]');
      const valueEl = form.querySelector('[data-role="change-value"]');
      const value = valueEl ? valueEl.value.trim() : '';
      const targetValue = targetEl ? targetEl.value : null;
      const removeField = selectedField.startsWith('remove_');

      if (targetEl && !targetValue) {
        errorEl.textContent = 'Seleccione el elemento que desea modificar.';
        return;
      }
      if (!removeField && valueEl && !value) {
        errorEl.textContent = 'El cambio está vacío. Indique el nuevo valor o cancele.';
        const name = productNameOf(bom);
        const deleteRecipe = await confirmDialog({
          title: 'Cambio vacío',
          message: `El cambio está vacío. ¿Desea eliminar el producto "${name}" y su receta?`,
          confirmLabel: 'Eliminar receta',
          danger: true,
        });
        if (deleteRecipe) {
          try {
            store.deleteBomRecipe(bom.id);
            selectedBomId = store.activeBoms().length ? store.activeBoms()[0].id : null;
            closeModal();
            renderAll();
          } catch (err) {
            errorEl.textContent = err.message;
          }
        }
        return;
      }

      const decimal = (label, options = {}) =>
        parseDecimal(value, { required: true, label, ...options });

      try {
        switch (selectedField) {
          case 'material_quantity':
            store.updateBomComponent(bom.id, targetValue, {
              quantity_per_unit: decimal('La cantidad por unidad', { min: 0.01 }),
            });
            break;
          case 'material_scrap':
            store.updateBomComponent(bom.id, targetValue, {
              scrap_percentage: decimal('La merma', { min: 0 }),
            });
            break;
          case 'add_material':
            store.addBomComponent(bom.id, {
              component_product_id: targetValue,
              quantity_per_unit: decimal('La cantidad por unidad', { min: 0.01 }),
              scrap_percentage:
                parseDecimal(form.querySelector('[name="scrap"]').value, {
                  min: 0,
                  label: 'La merma',
                }) ?? 0,
            });
            break;
          case 'remove_material': {
            const confirmed = await confirmDialog({
              title: 'Eliminar material',
              message: `¿Eliminar el material seleccionado de la receta "${productNameOf(bom)}"?`,
              confirmLabel: 'Eliminar',
              danger: true,
            });
            if (!confirmed) return;
            store.removeBomComponent(bom.id, targetValue);
            break;
          }
          case 'station_time':
            store.updateRoutingOperationForBom(bom.id, targetValue, {
              run_time_per_unit_minutes: decimal('El tiempo estimado por unidad', { min: 0.01 }),
            });
            break;
          case 'station_setup':
            store.updateRoutingOperationForBom(bom.id, targetValue, {
              setup_time_minutes: decimal('El alistamiento', { min: 0 }),
            });
            break;
          case 'add_station':
            store.addRoutingOperationForBom(bom.id, {
              work_center_id: targetValue,
              description: form.querySelector('[name="description"]').value,
              setup_time_minutes:
                parseDecimal(form.querySelector('[name="setup"]').value, {
                  min: 0,
                  label: 'El alistamiento',
                }) ?? 0,
              run_time_per_unit_minutes: decimal('El tiempo estimado por unidad', { min: 0.01 }),
            });
            break;
          case 'remove_station': {
            const confirmed = await confirmDialog({
              title: 'Eliminar estación',
              message: `¿Eliminar la estación seleccionada de la receta "${productNameOf(bom)}"?`,
              confirmLabel: 'Eliminar',
              danger: true,
            });
            if (!confirmed) return;
            store.removeRoutingOperationForBom(bom.id, targetValue);
            break;
          }
          case 'product_name':
            store.updateBomRecipe(bom.id, { product_name: value });
            break;
          case 'notes':
            store.updateBomRecipe(bom.id, { notes: valueEl.value });
            break;
          case 'effective_from':
            store.updateBomRecipe(bom.id, { effective_from: value });
            break;
          case 'base_quantity':
            store.updateBomRecipe(bom.id, {
              base_quantity: decimal('La cantidad base', { min: 0.01 }),
            });
            break;
          case 'code':
            store.updateBomRecipe(bom.id, { code: value });
            break;
          case 'version':
            store.updateBomRecipe(bom.id, { version: value });
            break;
          default:
            break;
        }
        closeModal();
        renderAll();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  }

  async function openDeleteRecipeModal() {
    if (!canEdit) return;
    const boms = store.activeBoms();
    if (!boms.length) {
      await notifyDialog({ title: 'Sin recetas', message: 'No hay recetas para eliminar.' });
      return;
    }
    const options = boms
      .map(
        (bom) =>
          `<option value="${escapeHtml(bom.id)}" ${bom.id === selectedBomId ? 'selected' : ''}>${escapeHtml(productNameOf(bom))} — ${escapeHtml(bom.code)} (v${escapeHtml(bom.version)})</option>`,
      )
      .join('');
    showModal(`
      <h2>Eliminar receta</h2>
      <form data-role="form" class="stack-form">
        <label>Seleccione la receta por nombre de producto
          <select name="bom_id" required>${options}</select>
        </label>
        <p class="panel__subtitle">Se eliminarán la cabecera, los materiales y las estaciones asociadas.</p>
        <p class="form-error" data-role="error" role="alert"></p>
        <div class="modal-actions">
          <button type="button" class="btn" data-role="cancel">Cancelar</button>
          <button type="submit" class="btn btn--danger">Eliminar receta</button>
        </div>
      </form>`);

    const form = modalRoot.querySelector('[data-role="form"]');
    const errorEl = form.querySelector('[data-role="error"]');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const bomId = data.get('bom_id');
      const bom = store.billOfMaterials.find((item) => item.id === bomId);
      if (!bom) return;
      const name = productNameOf(bom);
      const confirmed = await confirmDialog({
        title: 'Eliminar receta',
        message: `¿Está seguro de eliminar la receta "${name}" (${bom.code})? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar receta',
        danger: true,
      });
      if (!confirmed) return;
      try {
        store.deleteBomRecipe(bomId);
        selectedBomId = store.activeBoms().length ? store.activeBoms()[0].id : null;
        closeModal();
        renderAll();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  }

  function renderAll() {
    if (!canView) {
      listEl.innerHTML = '';
      titleEl.textContent = '—';
      metaEl.textContent = '';
      treeEl.innerHTML = '';
      editorEl.innerHTML = '<p class="empty-note">Sin permiso para ver recetas.</p>';
      return;
    }
    const boms = ensureSelection();
    renderList(boms);
    renderTree();
    renderEditor();
  }

  root.querySelector('[data-role="new-recipe"]')?.addEventListener('click', openNewRecipeModal);
  root.querySelector('[data-role="edit-recipe"]')?.addEventListener('click', async () => {
    if (!currentBom()) {
      await notifyDialog({
        title: 'Sin receta seleccionada',
        message: 'Primero seleccione o cree una receta.',
      });
      return;
    }
    openModifyRecipeModal();
  });
  root
    .querySelector('[data-role="delete-recipe"]')
    ?.addEventListener('click', openDeleteRecipeModal);

  renderAll();
  return root;
}
