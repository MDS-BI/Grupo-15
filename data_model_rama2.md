# Modelo de Datos `_rama2`: Módulo de Manufactura y Operaciones

Formaliza el enunciado del dominio descrito en el [`README.md`](./README.md): una plataforma ERP de manufactura que registra artículos, listas de materiales, órdenes de fabricación y movimientos de existencias, apoyada en el módulo base 001 (`specs/001-erp-base-module/data-model.md`).

Su diagrama entidad-relación está en [`data_model_diagram_rama2.md`](./data_model_diagram_rama2.md).

## 1. Trazabilidad con el enunciado

Cada frase del enunciado del README se corresponde con una entidad, un campo o una regla de este modelo:

| Enunciado (README) | Entidad, campo o regla |
|---|---|
| «Cada artículo se identifica por su código, que es único en la plataforma» | `Product.code` (obligatorio, único) |
| «su nombre, su tipo (fabricado, comprado o subensamblaje)» | `Product.name`, `Product.productType` |
| «su unidad de medida base, su costo estándar y su stock mínimo» | `Product.uom`, `Product.standardCost`, `Product.minStock` |
| «Un artículo puede archivarse para retirarlo de las listas sin perder su historial» | `Product.isArchived` + cascadas de §6 |
| «La plataforma admite tantas unidades de medida como necesite cada planta» | `UnitOfMeasure` (código único, nombre) |
| «exige que exista una conversión declarada entre ambas unidades con su factor» | `UoMConversion` (`factor` positivo, par único) |
| «Cada lista se versiona y tiene una vigencia de inicio» | `Bom.version` (único por producto), `Bom.effectiveFrom` |
| «un mismo artículo sólo puede tener una lista activa a la vez» | `Bom.status` (`activa`) |
| «sus líneas señalan el componente, la cantidad necesaria, la unidad y el porcentaje de merma esperada» | `BomLine.componentProduct_id`, `.quantity`, `.uom`, `.scrapPercent` |
| «impide que una lista se refere a sí misma, directa o indirectamente» | reglas de explosión de BOM (§3.3) |
| «Se identifica por serie y folio» | `WorkOrder.series`, `WorkOrder.folio` (heredados de Document) |
| «pertenece a la entidad —el cliente o la planta— que la solicitó» | `WorkOrder.entity_id` → `Entity` |
| «Al liberarse, la orden fija la versión de la lista de materiales que usará» | `WorkOrder.bomVersion_id` + transición a `liberada` (§5) |
| «una orden en curso puede además llevar registradas las cantidades completadas» | `WorkOrder.quantityCompleted` |
| «avanza por los estados borrador, liberada, en curso, recibida y cerrada» | `WorkOrder.status` (§5) |
| «sólo puede cancelarse desde borrador o liberada» | transición `cancelada` (§5) |
| «nunca se modifica ni se borra: una corrección se hace con un movimiento compensatorio» | `InventoryMovement` append-only (§3.5) |
| «su tipo (recepción, consumo, ajuste o transferencia)» | `InventoryMovement.type` |
| «la cantidad con signo ... el factor de conversión aplicado» | `InventoryMovement.qtySigned`, `.factor` |
| «la orden de fabricación a la que se asocia ... el motivo ... la fecha y hora» | `InventoryMovement.workOrderId`, `.reason`, `.at` |
| «el saldo actual de cada artículo, que es la suma de los movimientos de ese artículo» | `StockBalance.onHand` + invariante 1 (§3.5) |
| «se verifica al arrancar para que nunca haya descuadres» | invariante 1 (§3.5) |
| «el saldo sólo puede ser negativo si la configuración lo permite» | `ModuleConfig.allowNegativeStock` (§7) |
| «MRP, rutas, reservas y trazabilidad quedan fuera del alcance» | §8 Fuera de alcance |

## 2. Estrategia de Mapeo sobre la Base 001

| Concepto de Manufactura | Mapeo | Justificación |
|-------------------------|-------|---------------|
| Producto | **Entity** (001) + campos personalizados | Reutiliza CRUD, búsqueda, `entity_id` y eliminación en cascada ya implementados |
| Orden de fabricación | **Document** (001) + `statusLifecycle` | La base ya posee serie/folio, entidad dueña y ciclo de vida configurable |
| BOM y líneas de BOM | **Colecciones nuevas** | Son datos de estructura, no datos maestros ni documentos simples |
| Movimientos y saldo de existencias | **Colecciones nuevas** | El saldo es una proyección del journal de movimientos |

Regla: los campos base de 001 mantienen sus nombres y semántica; el dominio de manufactura se añade sin alterar el esquema de almacenamiento base.

## 3. Tablas de Dominio

### 3.1 Product (extensión de Entity)

| Campo | Tipo | Descripción | Restricciones |
|---|---|---|---|
| entity_id | string | Identificador del producto (heredado de Entity) | Obligatorio, único, autogenerado |
| code | string | Código del artículo (SKU) | Obligatorio, no vacío, único |
| name | string | Nombre del artículo | Obligatorio, no vacío |
| productType | string | `manufactured` \| `purchased` \| `subassembly` | Obligatorio; predeterminado `purchased` |
| uom | string | Unidad de medida base (p. ej., `kg`, `und`, `m`) | Obligatorio; debe existir en UnitOfMeasure |
| standardCost | number | Costo estándar por unidad base | Opcional; número no negativo |
| minStock | number | Stock mínimo antes de alertar o reponer | Opcional; número no negativo |
| isArchived | boolean | Producto archivado (oculto en listas, conserva historial) | Obligatorio; predeterminado `false` |

### 3.2 UnitOfMeasure y UoMConversion

**UnitOfMeasure**

| Campo | Tipo | Descripción | Restricciones |
|---|---|---|---|
| id | string | Identificador de la unidad | Obligatorio, autogenerado |
| code | string | Código corto (p. ej., `kg`, `und`) | Obligatorio, único |
| name | string | Nombre visible | Obligatorio |

**UoMConversion**

| Campo | Tipo | Descripción | Restricciones |
|---|---|---|---|
| id | string | Identificador | Obligatorio, autogenerado |
| fromUom | string | Unidad de origen | Obligatorio, existe en UnitOfMeasure |
| toUom | string | Unidad de destino | Obligatorio, existe en UnitOfMeasure |
| factor | number | Cuántas unidades destino equivale una de origen | Obligatorio, número positivo |

Regla: `(fromUom, toUom)` es único; sin conversión declarada, todo cálculo que cruce unidades se RECHAZA con un mensaje claro.

### 3.3 Bom y BomLine

**Bom** — un producto puede tener varias versiones de lista de materiales.

| Campo | Tipo | Descripción | Restricciones |
|---|---|---|---|
| id | string | Identificador | Obligatorio, autogenerado |
| product_id | string | Producto terminado o subensamblaje | Obligatorio, referencia a Product |
| version | string | Versión o revisión (p. ej., `v1`, `A`) | Obligatorio, único por product_id |
| effectiveFrom | string | Vigencia desde (YYYY-MM-DD) | Obligatorio, fecha válida |
| status | string | `borrador` \| `activa` \| `obsoleta` | Obligatorio; solo una `activa` por producto |

**BomLine**

| Campo | Tipo | Descripción | Restricciones |
|---|---|---|---|
| id | string | Identificador | Obligatorio, autogenerado |
| bom_id | string | BOM padre | Obligatorio, referencia a Bom, cascada con Bom |
| componentProduct_id | string | Componente | Obligatorio, referencia a Product existente |
| quantity | number | Cantidad por unidad padre | Obligatorio, número positivo |
| uom | string | Unidad de la línea | Obligatorio; si difiere de la base del componente, requiere conversión |
| scrapPercent | number | Porcentaje de merma esperada | Opcional; 0–100 |

Reglas:

- La explosión de BOM detecta y rechaza **ciclos** (un producto que depende de sí mismo, directa o indirectamente).
- Borrar una BOM borra sus líneas en cascada. Borrar un componente no borra la BOM: se impide la operación.
- Una orden liberada **fija la versión de BOM** y no la hereda viva.

### 3.4 WorkOrder (extensión de Document)

| Campo | Tipo | Descripción | Restricciones |
|---|---|---|---|
| id / entity_id / series / folio | heredado de Document | Número oficial de la orden (p. ej., `OF-1001`) | Como en 001 |
| entity_id (dueño) | string | Entidad dueña de la orden | Obligatorio, referencia a Entity |
| product_id | string | Producto a fabricar | Obligatorio, referencia a Product |
| quantityPlanned | number | Cantidad planificada | Obligatorio, número positivo |
| quantityCompleted | number | Cantidad completada | Obligatorio; 0 ≤ completed ≤ planned |
| bomVersion_id | string | Versión de BOM fijada al liberar | Obligatorio al pasar a `liberada` |
| startDate / dueDate | string | Fechas programadas | Opcional; dueDate ≥ startDate |
| status | string | Ciclo de vida (ver §5) | Obligatorio si hay ciclo de vida configurado |
| notes | string | Notas | Opcional |

### 3.5 InventoryMovement y StockBalance

**InventoryMovement** — journal **append-only**: nunca se modifica ni se borra; una corrección es un movimiento compensatorio.

| Campo | Tipo | Descripción | Restricciones |
|---|---|---|---|
| id | string | Identificador | Obligatorio, autogenerado, ordenable por tiempo |
| product_id | string | Producto afectado | Obligatorio, referencia a Product |
| type | string | `receipt` \| `consumption` \| `adjustment` \| `transfer` | Obligatorio |
| qtySigned | number | Cantidad con signo (+entrada, −salida) | Obligatorio, distinto de cero |
| uom | string | Unidad registrada | Obligatorio; con factor declarado si difiere de la base |
| factor | number | Factor de conversión aplicado | Obligatorio si uom ≠ unidad base; positivo |
| workOrderId | string | Orden relacionada (consumo/recepción) | Opcional, referencia a WorkOrder |
| reason | string | Motivo del ajuste o movimiento | Opcional; obligatorio en `adjustment` |
| at | string | Marca de tiempo ISO 8601 | Obligatorio |

**StockBalance** — proyección derivada del journal, almacenada para rendimiento.

| Campo | Tipo | Descripción | Restricciones |
|---|---|---|---|
| product_id | string | Producto | Obligatorio, único |
| onHand | number | Saldo actual en unidad base | Obligatorio |
| updatedAt | string | Última actualización | Obligatorio |

Invariantes:

1. `onHand == Σ qtySigned × factor` (en unidad base) sobre los movimientos del producto, verificado por prueba unitaria y comprobación al arrancar.
2. El saldo solo puede ser negativo si `allowNegativeStock` está habilitado; en caso contrario, la salida que dejaría el saldo < 0 se rechaza.
3. El journal es inmutable: sin operaciones de actualización ni borrado en el almacén.

## 4. Validaciones Transversales

- Toda referencia (`product_id`, `bom_id`, `workOrderId`) debe apuntar a un registro existente; la integridad referencial se comprueba antes de persistir.
- Todo cálculo que cruce unidades exige una conversión declarada; si falta, se rechaza con un mensaje claro.
- Las cantidades usan una política decimal fija (p. ej., 4 decimales) para que los cálculos sean deterministas y auditables.
- Los textos de usuario se sanitizan (XSS) antes de renderizar, como en la base.

## 5. Máquinas de Estados

**Orden de fabricación**

```text
borrador → liberada → en curso → recibida → cerrada
                ↘ cancelada (desde borrador o liberada)
```

- Solo se ofrecen estados alcanzables por transiciones permitidas.
- Toda transición rechazada explica el motivo, por cualquier vía de entrada.
- `liberada` exige `bomVersion_id` y valida la existencia de los componentes.
- `recibida` genera el movimiento `receipt` y, en modo backflush, los consumos de las líneas de la BOM.
- `cerrada` bloquea cambios posteriores.

**BOM**

```text
borrador → activa → obsoleta
```

Solo una `activa` por producto.

## 6. Relaciones y Cascadas

```text
Entity 1 ──* Product (extensión)
Entity 1 ──* WorkOrder (documento)
Product 1 ──* Bom 1 ──* BomLine *──1 Product
Product 1 ──* WorkOrder
Product 1 ──* InventoryMovement
Product 1 ──1 StockBalance
WorkOrder 1 ──* InventoryMovement
```

Cascadas:

- Eliminar entidad (base 001) elimina sus documentos; las órdenes con movimientos asociados solo se **archivan**.
- Eliminar un producto con movimientos o saldo ≠ 0: **prohibido** → se archiva (`isArchived: true`).
- Eliminar una BOM elimina sus líneas.
- Eliminar una orden no elimina movimientos: son historial.

## 7. Extensiones de ModuleConfig

| Clave | Tipo | Descripción |
|---|---|---|
| `labels.manufacturing` | object | Etiquetas de los registros nuevos (`product`, `workOrder`, `bom`, `movement`, …) |
| `workOrderLifecycle` | object | Estados y transiciones de la orden (mismo formato que `statusLifecycle` de 001) |
| `allowNegativeStock` | boolean | Permite saldos negativos; predeterminado `false` |
| `consumptionMode` | string | `backflush` \| `explicit` |

Reglas de configuración: mismas de 001 (retroceso seguro a valores integrados, informe claro de configuración inválida, sin choques de claves con campos base).

## 8. Fuera de alcance

Este modelo es deliberadamente reducido. Los siguientes dominios **no** están modelados aquí y se tratan en funcionalidades propias:

- **MRP / planificación de material**: ejecuciones de MRP y órdenes planificadas.
- **Rutas y centros de trabajo**: rutas, operaciones y horas por centro.
- **Reservas de material**: reservas de existencias por orden.
- **Consumo explícito**: líneas de consumo por orden (solo se contempla backflush).
- **Trazabilidad**: lote y serie.
- **Compras**: órdenes de compra y abastecimiento.

Cada uno se incorpora en una funcionalidad posterior siguiendo la tabla de alcance del plan (ver `.specify/templates/plan-template.md`).
