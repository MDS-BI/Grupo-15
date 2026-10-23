import { describe, it, expect } from 'vitest';
import {
  theoreticalQuantityPerUnit,
  buildBomTree,
  flattenBom,
} from '../../src/domain/bom-explosion.js';
import { billOfMaterials } from '../../src/data/fixtures/boms.js';
import { bomComponents } from '../../src/data/fixtures/boms.js';
import { products } from '../../src/data/fixtures/master-data.js';

const build = (rootBomId) =>
  buildBomTree({ boms: billOfMaterials, components: bomComponents, products, rootBomId });

describe('bom-explosion', () => {
  it('incluye la merma en el consumo teórico por unidad', () => {
    expect(theoreticalQuantityPerUnit({ quantity_per_unit: 6, scrap_percentage: 2 })).toBe(6.12);
    expect(theoreticalQuantityPerUnit({ quantity_per_unit: 1, scrap_percentage: 0 })).toBe(1);
  });

  it('construye un árbol multi-nivel (≥4 niveles) desde la bicicleta', () => {
    const tree = build('bom_bici');
    expect(tree.product_id).toBe('prod_bici');
    // Nivel 1: cuadro, rueda
    expect(tree.children.map((c) => c.product_id).sort()).toEqual(['prod_cuadro', 'prod_rueda']);
    // Nivel 2: desde el cuadro → tubo, pintura, soldadura
    const cuadro = tree.children.find((c) => c.product_id === 'prod_cuadro');
    expect(cuadro.children.length).toBe(3);
    expect(cuadro.children.map((c) => c.product_id)).toContain('comp_tubo');
  });

  it('aplana el árbol con cantidades acumuladas', () => {
    const flat = flattenBom(build('bom_bici'));
    const rueda = flat.find((f) => f.product_id === 'prod_rueda');
    expect(rueda.total_quantity).toBe(2);
    const llanta = flat.find((f) => f.product_id === 'comp_llanta');
    // 2 ruedas × 1 llanta = 2
    expect(llanta.total_quantity).toBe(2);
    const tubo = flat.find((f) => f.product_id === 'comp_tubo');
    // 1 cuadro × 6 metros = 6
    expect(tubo.total_quantity).toBe(6);
  });

  it('detecta ciclos sin caer en recursión infinita', () => {
    const cyclicBoms = [
      { id: 'bA', product_id: 'pA', base_quantity: 1, status: 'active' },
      { id: 'bB', product_id: 'pB', base_quantity: 1, status: 'active' },
    ];
    const cyclicComponents = [
      { id: 'c1', bom_id: 'bA', component_product_id: 'pB', quantity_per_unit: 1, uom_id: 'u', scrap_percentage: 0, sequence: 10 },
      { id: 'c2', bom_id: 'bB', component_product_id: 'pA', quantity_per_unit: 1, uom_id: 'u', scrap_percentage: 0, sequence: 10 },
    ];
    const cyclicProducts = [
      { id: 'pA', name: 'A', product_type: 'finished_good' },
      { id: 'pB', name: 'B', product_type: 'finished_good' },
    ];
    const tree = buildBomTree({
      boms: cyclicBoms,
      components: cyclicComponents,
      products: cyclicProducts,
      rootBomId: 'bA',
    });
    const bNode = tree.children.find((c) => c.product_id === 'pB');
    expect(bNode.bom_id).toBe('bB'); // B sí tiene sub-BOM
    const aNode = bNode.children.find((c) => c.product_id === 'pA');
    expect(aNode.bom_id).toBeNull(); // ciclo cortado: A vuelve a aparecer como ancestro
    expect(aNode.children).toEqual([]);
  });
});
