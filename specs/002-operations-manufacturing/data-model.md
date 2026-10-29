# Modelo de Datos: Módulo de Operaciones / Manufactura (ERP)

**Rama**: `002-operations-manufacturing` | **Fecha**: 2026-10-21 | **Actualizado**: 2026-10-29
**Fuente base**: `erp_data_model.md` — Módulo 7: Operaciones / Manufactura e integraciones cruzadas.
**Documento relacionado**: [plan.md](plan.md)

> **Nota de reconciliación (trazabilidad).** El archivo fundacional `erp_data_model.md` no está presente en el repositorio al momento de esta redacción. Este documento adopta el esquema canónico de manufactura descrito en la especificación de la funcionalidad (nomenclatura `snake_case`, prefijos de clave `_id`) como **línea base verificable**. Durante la **Fase 1 (Contratos de Datos)** del [plan.md](plan.md) se debe contrastar cada tabla y columna con el `erp_data_model.md` final; cualquier divergencia (nombre, tipo o nulabilidad) se registra como incidencia de arquitectura antes de congelar los contratos de UI.

---

## 1. Alcance del Módulo

El Módulo de Operaciones / Manufactura modela el ciclo **planificado → ejecutado** de la producción: qué se debe fabricar (`bill_of_materials`, `routings`), cómo y dónde se fabrica (`work_centers`, `routing_operations`), qué se ordena (planned) y qué se ejecuta (actual) en la planta (`production_orders`, `production_order_operations`, `production_shifts`, `operation_delays`, `delay_reasons`, `material_consumption`, `production_output`).

**Tablas de frontera (integración cruzada, no propias del módulo):**

| Módulo de origen | Tablas de frontera | Rol en manufactura |
|---|---|---|
| Logística / Inventario | `products`, `warehouses` | Bien terminado, componentes y puntos de descuento/ingreso de stock |
| Ventas | `sales_orders` | Disparador de fabricación make-to-order (MTO) |
| Control de Calidad | `quality_inspections` | Ganchos de inspección en proceso y final |
| Núcleo | `companies`, `units_of_measure` | Multi-empresa y unidades de medida |

---

## 2. Clasificación Funcional (Planificado vs. Ejecutado)

| Naturaleza | Tablas | Descripción |
|---|---|---|
| **Maestros de planificación** | `bill_of_materials`, `bom_components`, `work_centers`, `routings`, `routing_operations` | Qué, con qué y dónde *debería* producirse. Definen el estándar/target. |
| **Ejecución transaccional** | `production_orders`, `production_order_operations`, `production_shifts`, `operation_delays`, `material_consumption`, `production_output` | Qué se *ordenó* y qué *ocurrió realmente* en el piso de planta. |
| **Catálogo de apoyo** | `delay_reasons` | Motivos reutilizables para justificar atrasos (predefinidos y personalizados). |

**Pináculo de integración planificado ↔ ejecutado:**

- `bom_components.quantity_per_unit` (consumo teórico por unidad) **vs.** `material_consumption.quantity_consumed` (consumo real por lote).
- `routing_operations.setup_time_minutes` + `run_time_per_unit_minutes` (tiempo estándar) **vs.** `production_order_operations.actual_time_minutes` (tiempo real reportado).

---

## 3. Diccionario de Datos

Convenciones: toda PK es `id` de tipo `uuid`; todos los códigos de negocio (`code`) son `string` únicos por empresa salvo indicación contraria. Los campos `created_at` / `updated_at` son `timestamp` obligatorios y se omiten de la prosa para no repetir. **Nullable** indica si la columna admite `NULL`.

### 3.1 `companies` — Núcleo (frontera)

Rol funcional: raíz de aislamiento multi-empresa (multi-tenant). Toda entidad operativa cuelga de una `company_id`.

| Columna | Tipo | PK/FK | Nullable | Restricciones |
|---|---|---|---|---|
| id | uuid | PK | No | — |
| name | string | — | No | no vacío |
| tax_id | string | — | Sí | único por empresa cuando existe |
| default_currency | string | — | Sí | código ISO 4217 |

### 3.2 `units_of_measure` — Núcleo (frontera)

Rol funcional: normaliza magnitudes físicas (kg, L, unidad, m) usadas en BOM, consumo y salida.

| Columna | Tipo | PK/FK | Nullable | Restricciones |
|---|---|---|---|---|
| id | uuid | PK | No | — |
| code | string | — | No | único (p. ej., `KG`, `UN`) |
| name | string | — | No | no vacío |
| category | string | — | Sí | agrupación (masa, volumen, conteo) |
| company_id | uuid | FK → companies.id | Sí | `NULL` = unidad global del sistema |

### 3.3 `products` — Logística (frontera)

Rol funcional: catálogo maestro de artículos. Distingue con `product_type` el **bien terminado** (se fabrica) del **componente** (se consume).

| Columna | Tipo | PK/FK | Nullable | Restricciones |
|---|---|---|---|---|
| id | uuid | PK | No | — |
| company_id | uuid | FK → companies.id | No | — |
| code | string | — | No | único por empresa |
| name | string | — | No | no vacío |
| product_type | enum | — | No | `finished_good` \| `component` \| `raw_material` |
| uom_id | uuid | FK → units_of_measure.id | No | unidad base de inventario |
| unit_cost | numeric(14,4) | — | Sí | ≥ 0; costo estándar usado en valorización de consumo |

### 3.4 `warehouses` — Logística (frontera)

Rol funcional: puntos físicos de stock. Las bodegas de tipo `production` / WIP son el destino del consumo y la fuente de la salida.

| Columna | Tipo | PK/FK | Nullable | Restricciones |
|---|---|---|---|---|
| id | uuid | PK | No | — |
| company_id | uuid | FK → companies.id | No | — |
| code | string | — | No | único por empresa |
| name | string | — | No | no vacío |
| warehouse_type | enum | — | No | `raw_materials` \| `wip` \| `finished_goods` |

### 3.5 `sales_orders` — Ventas (frontera)

Rol funcional: pedido de venta que dispara fabricación make-to-order (MTO) cuando `make_to_order = true`.

| Columna | Tipo | PK/FK | Nullable | Restricciones |
|---|---|---|---|---|
| id | uuid | PK | No | — |
| company_id | uuid | FK → companies.id | No | — |
| customer_id | uuid | FK → companies.id | Sí | contraparte comercial si se usa esa tabla |
| order_number | string | — | No | único por empresa |
| status | enum | — | No | ciclo de ventas (`open`, `confirmed`, …) |
| make_to_order | boolean | — | No | `default false`; habilita vinculación con producción |
| requested_date | date | — | Sí | fecha requerida por el cliente |

### 3.6 `bill_of_materials` — Manufactura (planificado)

Rol funcional: **cabecera/receta** para fabricar 1 unidad del bien terminado. Define la versión vigente de la estructura.

| Columna | Tipo | PK/FK | Nullable | Restricciones |
|---|---|---|---|---|
| id | uuid | PK | No | — |
| company_id | uuid | FK → companies.id | No | — |
| product_id | uuid | FK → products.id | No | **bien terminado** (`product_type = finished_good`) |
| code | string | — | No | único por empresa |
| version | string | — | No | único por (`product_id`, `version`) |
| effective_from | date | — | No | — |
| effective_to | date | — | Sí | ≥ `effective_from` cuando existe |
| base_quantity | numeric(14,4) | — | No | > 0; rendimiento base (p. ej., 1 unidad o 100 kg) |
| status | enum | — | No | `draft` \| `active` \| `obsolete` |
| notes | string | — | Sí | — |

### 3.7 `bom_components` — Manufactura (planificado)

Rol funcional: **líneas de material** de una BOM. Es la fuente del **consumo teórico**.

| Columna | Tipo | PK/FK | Nullable | Restricciones |
|---|---|---|---|---|
| id | uuid | PK | No | — |
| bom_id | uuid | FK → bill_of_materials.id | No | borrado en cascada con la BOM |
| component_product_id | uuid | FK → products.id | No | **materia prima** (`product_type ∈ {component, raw_material}`) |
| quantity_per_unit | numeric(14,6) | — | No | > 0; consumo teórico por `base_quantity` |
| uom_id | uuid | FK → units_of_measure.id | No | unidad del componente |
| scrap_percentage | numeric(6,3) | — | No | ≥ 0; `default 0`; merma prevista |
| sequence | integer | — | No | ≥ 0; orden de presentación/consumo |
| is_optional | boolean | — | No | `default false`; componentes alternos |

**Restricción clave:** `UNIQUE (bom_id, component_product_id)` para evitar líneas duplicadas.

### 3.8 `work_centers` — Manufactura (planificado, capacidad)

Rol funcional: recurso de capacidad donde se ejecutan las operaciones. Es el eje del cálculo de carga/backlog.

| Columna | Tipo | PK/FK | Nullable | Restricciones |
|---|---|---|---|---|
| id | uuid | PK | No | — |
| company_id | uuid | FK → companies.id | No | — |
| code | string | — | No | único por empresa |
| name | string | — | No | no vacío |
| warehouse_id | uuid | FK → warehouses.id | Sí | bodega WIP por defecto |
| capacity_per_day_minutes | numeric(10,2) | — | No | > 0; capacidad nominal diaria |
| efficiency_factor | numeric(5,4) | — | No | `default 1.0`; rango `(0, 1]` |
| cost_per_hour | numeric(14,4) | — | Sí | ≥ 0 |
| status | enum | — | No | `active` \| `inactive` |

### 3.9 `routings` — Manufactura (planificado, secuencia)

Rol funcional: **cabecera de ruta** de fabricación para un producto; agrupa las operaciones en secuencia.

| Columna | Tipo | PK/FK | Nullable | Restricciones |
|---|---|---|---|---|
| id | uuid | PK | No | — |
| company_id | uuid | FK → companies.id | No | — |
| product_id | uuid | FK → products.id | No | bien terminado a fabricar |
| code | string | — | No | único por empresa |
| version | string | — | No | único por (`product_id`, `version`) |
| status | enum | — | No | `draft` \| `active` \| `obsolete` |

### 3.10 `routing_operations` — Manufactura (planificado, secuencia)

Rol funcional: **pasos ordenados** de una ruta y sus tiempos estándar. Define la secuencia obligatoria de ejecución.

| Columna | Tipo | PK/FK | Nullable | Restricciones |
|---|---|---|---|---|
| id | uuid | PK | No | — |
| routing_id | uuid | FK → routings.id | No | borrado en cascada con la ruta |
| work_center_id | uuid | FK → work_centers.id | No | recurso donde se ejecuta |
| sequence | integer | — | No | ≥ 10, estrictamente creciente dentro de la ruta |
| description | string | — | Sí | — |
| setup_time_minutes | numeric(10,2) | — | No | ≥ 0; tiempo de alistamiento por lote |
| run_time_per_unit_minutes | numeric(10,4) | — | No | ≥ 0; tiempo de proceso por unidad |

### 3.11 `production_orders` — Manufactura (ejecución)

Rol funcional: **orden de fabricación** de un lote. Es el núcleo operativo y el objeto de la máquina de estados `planned → released → in_progress → completed → cancelled`.

| Columna | Tipo | PK/FK | Nullable | Restricciones |
|---|---|---|---|---|
| id | uuid | PK | No | — |
| company_id | uuid | FK → companies.id | No | — |
| order_number | string | — | No | único por empresa |
| product_id | uuid | FK → products.id | No | bien terminado a producir |
| bom_id | uuid | FK → bill_of_materials.id | No | receta congelada al liberar |
| routing_id | uuid | FK → routings.id | Sí | requerido para generar operaciones |
| **sales_order_id** | uuid | FK → sales_orders.id | **Sí** | **enlace make-to-order opcional** (`NULL` = fabricación a stock) |
| warehouse_id | uuid | FK → warehouses.id | No | bodega destino del bien terminado |
| quantity_planned | numeric(14,4) | — | No | > 0 (variable de trazabilidad) |
| status | enum | — | No | `planned` \| `released` \| `in_progress` \| `completed` \| `cancelled` |
| planned_start_date | date | — | Sí | — |
| planned_end_date | date | — | Sí | ≥ `planned_start_date` |
| actual_start_date | date | — | Sí | se fija al pasar a `in_progress` |
| actual_end_date | date | — | Sí | se fija al pasar a `completed` |
| priority | enum | — | No | `low` \| `normal` \| `high`; `default normal` |
| notes | string | — | Sí | — |

### 3.12 `production_order_operations` — Manufactura (ejecución)

Rol funcional: **instantánea congelada** de las operaciones de la ruta para una orden concreta; registra estado y tiempo real por paso.

| Columna | Tipo | PK/FK | Nullable | Restricciones |
|---|---|---|---|---|
| id | uuid | PK | No | — |
| production_order_id | uuid | FK → production_orders.id | No | borrado en cascada con la orden |
| routing_operation_id | uuid | FK → routing_operations.id | Sí | origen teórico (puede quedar `NULL` si la ruta cambia después) |
| work_center_id | uuid | FK → work_centers.id | No | copia desnormalizada para reportes |
| sequence | integer | — | No | ≥ 10; orden de ejecución |
| status | enum | — | No | `pending` \| `in_progress` \| `paused` \| `completed` |
| planned_time_minutes | numeric(10,2) | — | No | ≥ 0; estándar congelado |
| actual_time_minutes | numeric(12,2) | — | Sí | ≥ 0; **tiempo efectivo** (sin atrasos) para trazabilidad de desempeño real |
| delay_time_minutes | numeric(12,2) | — | No | `default 0`; ≥ 0; suma de atrasos justificados de la operación (derivada y persistida al cerrar) |
| quantity_completed | numeric(14,4) | — | No | `default 0`; ≥ 0; **acumulado por operación a través de todos los turnos, no se reinicia** |
| scrap_quantity | numeric(14,4) | — | No | `default 0`; ≥ 0 |
| operator_id | uuid | FK → (usuarios/operadores) | Sí | **sensible**: métricas por persona; ver §7 |
| started_at | timestamp | — | Sí | se fija al primer `Iniciar`; se conserva entre pausas/reinicios |
| completed_at | timestamp | — | Sí | ≥ `started_at` cuando existe; se fija una sola vez (sin doble cierre) |

> **Regla de tiempo efectivo (US-06):** `actual_time_minutes = (completed_at − started_at) − Σ operation_delays.duration_minutes`. Los atrasos con `ended_at = NULL` al finalizar la operación **no** se descuentan hasta ser corregidos; al corregirlos se recalcula `actual_time_minutes` y `delay_time_minutes`. La UI muestra los segundos con tolerancia máxima de 1 s.

### 3.13 `material_consumption` — Manufactura (ejecución)

Rol funcional: **registro real de consumo** en el piso de planta. Conecta el componente teórico del BOM con el movimiento de inventario real.

| Columna | Tipo | PK/FK | Nullable | Restricciones |
|---|---|---|---|---|
| id | uuid | PK | No | — |
| production_order_id | uuid | FK → production_orders.id | No | — |
| po_operation_id | uuid | FK → production_order_operations.id | Sí | operación que origina el consumo |
| component_product_id | uuid | FK → products.id | No | materia prima consumida |
| bom_component_id | uuid | FK → bom_components.id | Sí | línea teórica de referencia (puede ser consumo no planeado) |
| warehouse_id | uuid | FK → warehouses.id | No | bodega fuente (descuento de stock) |
| quantity_consumed | numeric(14,6) | — | No | > 0; **variable de trazabilidad** de consumo real |
| uom_id | uuid | FK → units_of_measure.id | No | — |
| lot_number | string | — | Sí | trazabilidad de lote |
| consumed_at | timestamp | — | No | — |
| consumed_by | uuid | FK → (usuarios/operadores) | Sí | **sensible**: quién registró; ver §6 |

### 3.14 `production_output` — Manufactura (ejecución)

Rol funcional: **registro real de bien terminado** producido (ingreso a bodega), incluyendo merma.

| Columna | Tipo | PK/FK | Nullable | Restricciones |
|---|---|---|---|---|
| id | uuid | PK | No | — |
| production_order_id | uuid | FK → production_orders.id | No | — |
| product_id | uuid | FK → products.id | No | bien terminado producido |
| warehouse_id | uuid | FK → warehouses.id | No | bodega destino (ingreso de stock) |
| quantity_produced | numeric(14,4) | — | No | > 0; **variable de trazabilidad** de salida real |
| scrap_quantity | numeric(14,4) | — | No | `default 0`; ≥ 0 |
| lot_number | string | — | Sí | trazabilidad de lote terminado |
| uom_id | uuid | FK → units_of_measure.id | No | — |
| produced_at | timestamp | — | No | — |
| recorded_by | uuid | FK → (usuarios/operadores) | Sí | **sensible**: quién reportó; ver §6 |

### 3.15 `quality_inspections` — Control de Calidad (frontera, gancho)

Rol funcional: inspección asociada (en proceso o final) desde el módulo de calidad. Manufactura solo la **referencia**; no la posee.

| Columna | Tipo | PK/FK | Nullable | Restricciones |
|---|---|---|---|---|
| id | uuid | PK | No | — |
| company_id | uuid | FK → companies.id | No | — |
| inspection_type | enum | — | No | `in_process` \| `final` |
| production_order_id | uuid | FK → production_orders.id | Sí | gancho hacia la orden |
| po_operation_id | uuid | FK → production_order_operations.id | Sí | inspección en proceso por paso |
| product_id | uuid | FK → products.id | Sí | inspección final sobre el bien terminado |
| status | enum | — | No | `pending` \| `passed` \| `failed` |

> **Decisión de frontera:** la orden de producción **no** almacena un `quality_status` propio; el estado de calidad se **deriva** consultando `quality_inspections`. Esto evita acoplar el ciclo de manufactura al ciclo de calidad y mantiene la integración como hook de solo lectura hasta la Fase 4.

### 3.16 `production_shifts` — Manufactura (ejecución, US-06)

Rol funcional: **turno de trabajo del operador** sobre una operación concreta. Es la unidad que reinicia el contador de piezas y agrupa los atrasos justificados del turno.

| Columna | Tipo | PK/FK | Nullable | Restricciones |
|---|---|---|---|---|
| id | uuid | PK | No | — |
| po_operation_id | uuid | FK → production_order_operations.id | No | borrado en cascada con la operación |
| operator_id | uuid | FK → (usuarios/operadores) | Sí | **sensible**: contexto operacional, no evaluación; ver §7 |
| shift_number | integer | — | No | ≥ 1; consecutivo dentro de `po_operation_id`; `UNIQUE (po_operation_id, shift_number)` |
| status | enum | — | No | `in_progress` \| `completed` |
| started_at | timestamp | — | No | inicio del turno |
| ended_at | timestamp | — | Sí | ≥ `started_at`; se fija al finalizar el turno/operación |
| quantity_counted | numeric(14,4) | — | No | `default 0`; ≥ 0; **contador del turno, se reinicia en cada turno nuevo** |

**Reglas**
- Un operador solo puede tener un turno `in_progress` a la vez; una operación solo puede tener un turno `in_progress` a la vez.
- Al iniciar un turno nuevo, `quantity_counted` arranca en `0`; el acumulado de la operación (`production_order_operations.quantity_completed`) se conserva.
- Finalizar la operación cierra el turno activo (`status = completed`, `ended_at = completed_at`).
- Incrementar/decrementar/fijar el contador del turno ajusta también `production_order_operations.quantity_completed` en el mismo delta; nunca se permiten valores negativos.

### 3.17 `delay_reasons` — Manufactura (catálogo de apoyo, US-06)

Rol funcional: **catálogo de motivos** para justificar atrasos. Los predefinidos son globales de la empresa; los personalizados se crean desde el turno y quedan reutilizables durante ese turno.

| Columna | Tipo | PK/FK | Nullable | Restricciones |
|---|---|---|---|---|
| id | uuid | PK | No | — |
| company_id | uuid | FK → companies.id | No | — |
| label | string | — | No | no vacío; `UNIQUE (company_id, lower(label))` |
| origin | enum | — | No | `predefined` \| `custom` |
| scope | enum | — | No | `global` \| `shift`; `predefined` ⇒ `global`; `custom` ⇒ `shift` |
| production_shift_id | uuid | FK → production_shifts.id | Sí | obligatorio cuando `scope = shift`; `NULL` cuando `scope = global` |
| active | boolean | — | No | `default true`; un motivo inactivo no se ofrece en el selector |
| created_by | uuid | FK → (usuarios/operadores) | Sí | autor del motivo personalizado; **sensible** |

**Reglas**
- No se puede iniciar un atraso sin `delay_reason_id` activo.
- Un motivo `custom` solo es visible para turnos de la misma empresa/operador mientras el turno esté vigente; los predefinidos están siempre disponibles.
- Etiquetas duplicadas (sin distinguir mayúsculas) se rechazan con un mensaje bloqueante.

### 3.18 `operation_delays` — Manufactura (ejecución, US-06)

Rol funcional: **atraso justificado** de una operación. Mientras está abierto pausa el tiempo efectivo; puede quedar abierto al cerrar la operación y corregirse después sin borrar el registro.

| Columna | Tipo | PK/FK | Nullable | Restricciones |
|---|---|---|---|---|
| id | uuid | PK | No | — |
| po_operation_id | uuid | FK → production_order_operations.id | No | borrado en cascada con la operación |
| production_shift_id | uuid | FK → production_shifts.id | No | turno en el que ocurrió el atraso |
| delay_reason_id | uuid | FK → delay_reasons.id | No | motivo obligatorio |
| started_at | timestamp | — | No | ≥ turno.`started_at` |
| ended_at | timestamp | — | Sí | `NULL` = atraso abierto; ≥ `started_at` cuando existe |
| duration_minutes | numeric(12,2) | — | Sí | ≥ 0; calculada al cerrar/corregir; `NULL` mientras está abierto |
| status | enum | — | No | `open` \| `closed`; consistente con `ended_at` |
| note | string | — | Sí | detalle libre del operador |
| corrected_at | timestamp | — | Sí | marca de corrección posterior al cierre de la operación |
| corrected_by | uuid | FK → (usuarios/operadores) | Sí | autor de la corrección; **sensible** |
| correction_note | string | — | Sí | justificación de la corrección |

**Reglas**
- Un solo atraso `open` por `po_operation_id` (restricción única parcial); iniciar otro exige cerrar el actual.
- `ended_at` y `duration_minutes` se calculan al cerrar; `duration_minutes = (ended_at − started_at)` en minutos decimales.
- Al finalizar la operación con un atraso abierto, el atraso **permanece abierto** (`status = open`) y se marca en la UI como *pendiente de corrección*; no bloquea el cierre.
- Corregir un atraso abierto fija `ended_at`/`duration_minutes`, actualiza `corrected_at`/`corrected_by`/`correction_note`, y recalcula `delay_time_minutes` y `actual_time_minutes` de la operación.
- Los atrasos son append-only: nunca se eliminan; una corrección deja rastro de auditoría.

---

## 4. Relaciones y Cardinalidades

| Relación | Cardinalidad | Semántica |
|---|---|---|
| companies → (todas) | 1:N | aislamiento multi-empresa |
| products → bill_of_materials (`product_id`) | 1:N | un bien terminado tiene varias versiones de BOM |
| bill_of_materials → bom_components | 1:N | cabecera → líneas de material |
| products → bom_components (`component_product_id`) | 1:N | un componente aparece en muchas BOM |
| **`bill_of_materials` ⟷ `products` (vía `bom_components`)** | **N:M** | **una BOM usa muchos componentes; un componente es usado por muchas BOM** |
| routings → routing_operations | 1:N | cabecera → pasos secuenciales |
| work_centers → routing_operations | 1:N | un centro ejecuta muchas operaciones teóricas |
| work_centers → production_order_operations | 1:N | un centro ejecuta muchas operaciones reales (carga) |
| products → production_orders (`product_id`) | 1:N | un bien terminado se fabrica en muchas órdenes |
| bill_of_materials → production_orders (`bom_id`) | 1:N | versión de BOM usada por varias órdenes |
| routings → production_orders (`routing_id`) | 1:N (nullable) | ruta usada; puede no especificarse |
| sales_orders → production_orders (`sales_order_id`) | 1:N (nullable) | **MTO opcional**; `NULL` = fabricación a stock |
| production_orders → production_order_operations | 1:N | orden → operaciones congeladas |
| production_order_operations → material_consumption | 1:N (nullable) | consumo originado por paso |
| production_orders → material_consumption | 1:N | consumo real de la orden |
| bill_of_materials → material_consumption (vía `bom_components`) | 1:N | comparación plan vs. real |
| production_orders → production_output | 1:N | salida real (posibles salidas parciales) |
| production_orders → quality_inspections | 1:N (nullable) | ganchos de inspección |
| production_order_operations → quality_inspections | 1:N (nullable) | inspección en proceso |
| production_order_operations → production_shifts | 1:N | turnos de trabajo de la operación (uno activo como máximo) |
| production_shifts → operation_delays | 1:N | atrasos justificados ocurridos en el turno |
| delay_reasons → operation_delays | 1:N | motivo reutilizable aplicado a muchos atrasos |
| companies → delay_reasons | 1:N | catálogo de motivos por empresa |
| production_shifts → delay_reasons (`production_shift_id`) | 1:N (nullable) | motivos personalizados creados en el turno |

`companies`, `units_of_measure` y `warehouses` aparecen como destinos FK (`1:N` cada uno) desde las tablas operativas que los referencian.

---

## 5. Diagrama ERD (Mermaid)

```mermaid
erDiagram
    companies ||--o{ products : "owns"
    companies ||--o{ warehouses : "owns"
    companies ||--o{ work_centers : "owns"
    companies ||--o{ bill_of_materials : "owns"
    companies ||--o{ routings : "owns"
    companies ||--o{ production_orders : "owns"
    units_of_measure ||--o{ products : "base_uom"
    units_of_measure ||--o{ bom_components : "uom"
    units_of_measure ||--o{ material_consumption : "uom"
    units_of_measure ||--o{ production_output : "uom"

    products ||--o{ bill_of_materials : "finished_good"
    products ||--o{ bom_components : "component"
    products ||--o{ routings : "manufactured"
    products ||--o{ production_orders : "produced"
    products ||--o{ material_consumption : "consumed"
    products ||--o{ production_output : "output"

    bill_of_materials ||--o{ bom_components : "has_lines"
    bill_of_materials ||--o{ production_orders : "referenced_by"
    routings ||--o{ routing_operations : "has_steps"
    work_centers ||--o{ routing_operations : "performs"
    work_centers ||--o{ production_order_operations : "executes"

    sales_orders ||--o{ production_orders : "MTO_optional"

    production_orders ||--o{ production_order_operations : "schedules"
    production_orders ||--o{ material_consumption : "consumes"
    production_orders ||--o{ production_output : "produces"
    production_order_operations ||--o{ material_consumption : "originates"
    routing_operations ||--o{ production_order_operations : "snapshot_of"
    production_order_operations ||--o{ production_shifts : "worked_in"
    production_shifts ||--o{ operation_delays : "has_delays"
    delay_reasons ||--o{ operation_delays : "justifies"
    companies ||--o{ delay_reasons : "owns"
    production_shifts ||--o{ delay_reasons : "creates_custom"

    warehouses ||--o{ material_consumption : "source"
    warehouses ||--o{ production_output : "destination"
    warehouses ||--o{ work_centers : "wip_default"

    production_orders ||--o{ quality_inspections : "inspected_by"
    production_order_operations ||--o{ quality_inspections : "inspected_by"

    companies {
        uuid id PK
        string name
        string tax_id
    }
    units_of_measure {
        uuid id PK
        string code
        string name
    }
    products {
        uuid id PK
        uuid company_id FK
        string code
        enum product_type
        uuid uom_id FK
    }
    warehouses {
        uuid id PK
        uuid company_id FK
        string code
        enum warehouse_type
    }
    sales_orders {
        uuid id PK
        uuid company_id FK
        string order_number
        boolean make_to_order
    }
    bill_of_materials {
        uuid id PK
        uuid company_id FK
        uuid product_id FK
        string version
        numeric base_quantity
        enum status
    }
    bom_components {
        uuid id PK
        uuid bom_id FK
        uuid component_product_id FK
        numeric quantity_per_unit
        uuid uom_id FK
        numeric scrap_percentage
    }
    work_centers {
        uuid id PK
        uuid company_id FK
        string code
        numeric capacity_per_day_minutes
        numeric efficiency_factor
    }
    routings {
        uuid id PK
        uuid company_id FK
        uuid product_id FK
        string version
        enum status
    }
    routing_operations {
        uuid id PK
        uuid routing_id FK
        uuid work_center_id FK
        integer sequence
        numeric setup_time_minutes
        numeric run_time_per_unit_minutes
    }
    production_orders {
        uuid id PK
        uuid company_id FK
        uuid product_id FK
        uuid bom_id FK
        uuid routing_id FK
        uuid sales_order_id FK
        uuid warehouse_id FK
        numeric quantity_planned
        enum status
    }
    production_order_operations {
        uuid id PK
        uuid production_order_id FK
        uuid routing_operation_id FK
        uuid work_center_id FK
        integer sequence
        enum status
        numeric planned_time_minutes
        numeric actual_time_minutes
        numeric delay_time_minutes
        numeric quantity_completed
        timestamp started_at
        timestamp completed_at
    }
    production_shifts {
        uuid id PK
        uuid po_operation_id FK
        uuid operator_id FK
        integer shift_number
        enum status
        timestamp started_at
        timestamp ended_at
        numeric quantity_counted
    }
    delay_reasons {
        uuid id PK
        uuid company_id FK
        string label
        enum origin
        enum scope
        uuid production_shift_id FK
        boolean active
    }
    operation_delays {
        uuid id PK
        uuid po_operation_id FK
        uuid production_shift_id FK
        uuid delay_reason_id FK
        timestamp started_at
        timestamp ended_at
        numeric duration_minutes
        enum status
    }
    material_consumption {
        uuid id PK
        uuid production_order_id FK
        uuid po_operation_id FK
        uuid component_product_id FK
        uuid bom_component_id FK
        uuid warehouse_id FK
        numeric quantity_consumed
    }
    production_output {
        uuid id PK
        uuid production_order_id FK
        uuid product_id FK
        uuid warehouse_id FK
        numeric quantity_produced
        numeric scrap_quantity
    }
    quality_inspections {
        uuid id PK
        enum inspection_type
        uuid production_order_id FK
        uuid po_operation_id FK
        enum status
    }
```

---

## 6. Variables y Tablas Críticas

### 6.1 Impulsores operativos centrales

| Tabla/Variable | Justificación |
|---|---|
| `production_orders` | Entidad pivote: sin ella no hay ejecución, trazabilidad ni vínculo MTO/comercial. Determina el estado global del negocio de fabricación. |
| `bill_of_materials` + `bom_components` | Definen el consumo teórico y la estructura de costos; cualquier error se propaga a inventario y márgenes. |
| `material_consumption` | Registro real de consumo: nexo entre ejecución y descuento de inventario; base del análisis plan vs. real. |

### 6.2 Restricciones de capacidad y secuencia

| Tabla/Variable | Justificación |
|---|---|
| `work_centers.capacity_per_day_minutes` | Fija el techo de capacidad; base del cálculo de carga y detección de cuellos de botella. |
| `routing_operations.sequence`, `setup_time_minutes`, `run_time_per_unit_minutes` | Definen el orden obligatorio y el tiempo estándar; habilitan el cálculo de `planned_time_minutes` y la detección de violaciones de secuencia. |

### 6.3 Variables de trazabilidad aguas abajo

| Variable | Tabla | Significado en el negocio |
|---|---|---|
| `quantity_planned` | `production_orders` | Meta de producción del lote. |
| `quantity_consumed` | `material_consumption` | Consumo real; comparado con `bom_components.quantity_per_unit` revela mermas/ineficiencias. |
| `quantity_produced` | `production_output` | Salida real; confrontada con `quantity_planned` arroja cumplimiento y rendimiento. |
| `actual_time_minutes` | `production_order_operations` | Tiempo efectivo real (excluye atrasos); contra `planned_time_minutes` mide eficiencia y desviación de estándar. |
| `delay_time_minutes` | `production_order_operations` | Tiempo total justificado por atrasos; explica la diferencia entre tiempo transcurrido y tiempo efectivo. |
| `quantity_counted` | `production_shifts` | Piezas del turno actual; se reinicia en cada turno y alimenta el acumulado. |
| `quantity_completed` | `production_order_operations` | Acumulado por operación a través de todos los turnos; no se reinicia. |
| `duration_minutes` | `operation_delays` | Duración de cada atraso justificado; insumo del tiempo efectivo y del análisis de causas. |

**Indicadores derivados (no persistidos, calculados en UI):** *Yield* = `SUM(quantity_produced) / quantity_planned`; *Scrap rate* = `scrap_quantity / (quantity_produced + scrap_quantity)`; *Consumption variance* = (`quantity_consumed` − `quantity_planned × quantity_per_unit`) / teórico.

---

## 7. Ética de Datos, Privacidad y Gestión de Sesgos

### 7.1 Sesgo en el seguimiento del desempeño laboral

`production_order_operations.operator_id` / `actual_time_minutes`, `production_shifts.operator_id` / `quantity_counted`, `operation_delays.corrected_by` y `material_consumption.consumed_by` / `production_output.recorded_by` permiten construir métricas de productividad individual. Riesgos y controles:

- **Riesgo de sesgo:** comparar operadores por tiempo real sin normalizar por tipo de máquina, complejidad del producto, turno o antigüedad penaliza injustamente a quien recibe trabajo más difícil.
- **Control de diseño:** las vistas de análisis de MVP agregan por **centro de trabajo / operación**, no por persona. Cualquier vista individual requiere aprobación explícita y se etiqueta como "solo contexto operacional, no evaluación de desempeño".
- **Minimización:** `operator_id` es nullable y se captura solo cuando el proceso de negocio lo exige; el prototipo de MVP no expone rankings de operadores.
- **Transparencia:** los usuarios deben saber que los tiempos se registran; el reporte de tiempo se presenta como dato de proceso, no como vigilancia.
- **Turnos y atrasos:** `production_shifts` y `operation_delays` existen para calcular tiempo efectivo y explicar demoras, no para rankear operadores; los motivos personalizados se limitan al turno y no se usan como evaluación de desempeño.

### 7.2 Integridad de reportes de merma, seguridad e inventario

- **Merma (`scrap_quantity`)**: debe capturarse a nivel de operación **y** de salida, con motivo obligatorio cuando `scrap_quantity > 0`, para evitar que la merma "desaparezca" y distorsione costos y rendimiento.
- **Seguridad**: los eventos de merma/incidente deben quedar inmutables (append-only) y con marca de autor (`consumed_by` / `recorded_by`) para auditoría; nunca borrar un registro de consumo o salida.
- **Discrepancias de inventario**: la conciliación `bom_components` (teórico) vs. `material_consumption` (real) vs. movimiento de `warehouses` debe ser visible y trazable; se prohíbe ajustar cantidades silenciosamente. Toda corrección se modela como un nuevo registro con justificación, preservando la historia.
- **Sesgo de reporte**: si los operadores perciben que reportar merma los penaliza, subreportarán. La política de UX debe desacoplar el reporte de merma del desempeño individual (ver §7.1).

---

## 8. Reglas de Validación Consolidadas

- `bom_components.bom_id` + `component_product_id`: único; `quantity_per_unit > 0`.
- `bill_of_materials.product_id`: debe ser `finished_good`; `base_quantity > 0`.
- `routing_operations.sequence`: entero ≥ 10, estrictamente creciente dentro de `routing_id`.
- `production_orders`: transiciones de `status` restringidas a `planned → released → in_progress → completed`; `cancelled` alcanzable desde cualquier estado no terminal; el salto inverso no se permite sin evento explícito.
- `production_orders.quantity_planned > 0`; `actual_end_date >= actual_start_date`.
- `material_consumption.quantity_consumed > 0`; `production_output.quantity_produced > 0`.
- Toda FK nullable (`sales_order_id`, `routing_id`, `po_operation_id`, `bom_component_id`) debe ser explícitamente `NULL` cuando el vínculo no existe; **no** usar valores centinela.
- Borrado en cascada: `bill_of_materials → bom_components`, `routings → routing_operations`, `production_orders → production_order_operations`.
- Borrado restringido: no eliminar `products` / `warehouses` con documentos operativos dependientes.
- `production_shifts`: `shift_number ≥ 1` y único por operación; como máximo un turno `in_progress` por operador y por operación; `quantity_counted ≥ 0`; `ended_at ≥ started_at`.
- `operation_delays`: como máximo un atraso `open` por operación; `delay_reason_id` obligatorio y activo; `ended_at ≥ started_at`; `duration_minutes ≥ 0` y calculada al cerrar; `status = open` ⇔ `ended_at IS NULL`.
- `delay_reasons`: `label` no vacío y único por empresa sin distinguir mayúsculas; `predefined ⇒ scope = global`; `custom ⇒ scope = shift` con `production_shift_id` obligatorio.
- `production_order_operations.quantity_completed` y `production_shifts.quantity_counted` rechazan valores negativos o no numéricos; se conserva el último valor válido.
- `production_order_operations.actual_time_minutes ≥ 0` y se recalcula al corregir atrasos; `completed_at` se fija una sola vez (sin doble cierre).
