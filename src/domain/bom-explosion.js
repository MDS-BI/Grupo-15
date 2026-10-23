/**
 * @file Explosión de BOM y consumo teórico.
 * Calcula el consumo teórico por unidad y expande la estructura multi-nivel,
 * detectando ciclos (un componente que resuelve a un BOM ancestro).
 */

function round6(n) {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

/**
 * Consumo teórico de una línea de BOM incluyendo merma prevista.
 * @param {import('./types.js').BomComponent} component
 * @returns {number}
 */
export function theoreticalQuantityPerUnit(component) {
  const qty = Number(component?.quantity_per_unit) || 0;
  const scrap = Number(component?.scrap_percentage) || 0;
  return round6(qty * (1 + scrap / 100));
}

/**
 * @typedef {Object} BomNode
 * @property {string} product_id
 * @property {string} name
 * @property {number} quantity_per_unit
 * @property {number} scrap_percentage
 * @property {number} level
 * @property {string|null} bom_id  BOM del sub-ensamble, si existe.
 * @property {BomNode[]} children
 */

/**
 * Construye el árbol anidado de una BOM.
 * @param {Object} args
 * @param {Array<import('./types.js').BillOfMaterials>} args.boms
 * @param {Array<import('./types.js').BomComponent>} args.components
 * @param {Array<import('./types.js').Product>} args.products
 * @param {string} args.rootBomId
 * @returns {BomNode}
 */
export function buildBomTree({ boms, components, products, rootBomId }) {
  const productById = indexBy(products, 'id');
  const bomsByProduct = new Map();
  for (const bom of boms) {
    const list = bomsByProduct.get(bom.product_id) || [];
    list.push(bom);
    bomsByProduct.set(bom.product_id, list);
  }
  const rootBom = boms.find((b) => b.id === rootBomId);
  if (!rootBom) throw new Error(`BOM no encontrado: ${rootBomId}`);
  const rootProduct = productById.get(rootBom.product_id);

  const visit = (bom, level, ancestors) => {
    const lines = components
      .filter((c) => c.bom_id === bom.id)
      .sort((a, b) => a.sequence - b.sequence);
    return lines.map((line) => {
      const childProduct = productById.get(line.component_product_id);
      const childBoms = bomsByProduct.get(line.component_product_id) || [];
      const childBom = childBoms.find((b) => b.status === 'active') || childBoms[0] || null;
      const nodeAncestors = [...ancestors, bom.product_id];
      const cycle = childBom ? nodeAncestors.includes(childBom.product_id) : false;
      const children =
        childBom && !cycle ? visit(childBom, level + 1, nodeAncestors) : [];
      return {
        product_id: line.component_product_id,
        name: childProduct ? childProduct.name : line.component_product_id,
        quantity_per_unit: Number(line.quantity_per_unit) || 0,
        scrap_percentage: Number(line.scrap_percentage) || 0,
        level,
        bom_id: cycle ? null : childBom ? childBom.id : null,
        children,
      };
    });
  };

  return {
    product_id: rootBom.product_id,
    name: rootProduct ? rootProduct.name : rootBom.product_id,
    quantity_per_unit: Number(rootBom.base_quantity) || 1,
    scrap_percentage: 0,
    level: 0,
    bom_id: rootBom.id,
    children: visit(rootBom, 1, []),
  };
}

/**
 * Aplana un árbol de BOM a una lista de hojas con cantidades acumuladas.
 * @param {BomNode} node
 * @returns {Array<{ product_id: string, name: string, total_quantity: number, level: number, is_leaf: boolean }>}
 */
export function flattenBom(node) {
  const out = [];
  const walk = (n, multiplier) => {
    const total = multiplier * n.quantity_per_unit;
    out.push({
      product_id: n.product_id,
      name: n.name,
      total_quantity: round6(total),
      level: n.level,
      is_leaf: n.children.length === 0,
    });
    for (const child of n.children) walk(child, total);
  };
  if (node) walk(node, 1);
  return out;
}

function indexBy(list, key) {
  const map = new Map();
  for (const item of list || []) map.set(item[key], item);
  return map;
}
