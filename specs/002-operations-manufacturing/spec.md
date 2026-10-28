# Especificación: Módulo de Operaciones / Manufactura (ERP)

**Rama**: `002-operations-manufacturing` | **Fecha**: 2026-10-21
**Datos maestros**: [data-model.md](data-model.md) | **Plan**: [plan.md](plan.md) | **Tareas**: [tasks.md](tasks.md)

---

## 1. Objetivo

Implementar un prototipo funcional de frontend para el módulo de Operaciones / Manufactura que centraliza el ciclo **planificado → programado → ejecutado → registrado**: gestión de BOM y rutas, despacho de órdenes, seguimiento de operaciones en piso, registro de consumo y salida de producción.

## 2. Alcance

- Gestión de BOM multi-nivel (`bill_of_materials`, `bom_components`) con detección de ciclos.
- Configuración de centros de trabajo y rutas (`work_centers`, `routings`, `routing_operations`) con tiempos estándar.
- Despacho de órdenes (`production_orders`) desde reposición o make-to-order (`sales_order_id`), con congelación de BOM/ruta y generación de operaciones.
- Ejecución en piso (`production_order_operations`) con estados `pending → in_progress → paused → completed`, tiempos reales y cálculo de avance.
- Consumo real (`material_consumption`) vs. teórico, y salida de bien terminado (`production_output`) con merma.
- Panel con KPIs, tablero kanban, trazabilidad plan-vs-real y estado de calidad derivado.

**Límites**: sin backend, sin MRP automático, sin MES en tiempo real. Las entidades de frontera (`products`, `warehouses`, `units_of_measure`, `companies`, `sales_orders`, `quality_inspections`) se consumen como datos simulados de solo lectura.

## 3. Personas

| Persona | Descripción |
|---|---|
| **Planificador de Producción / Jefe de Planta** | Gestiona BOM y rutas, define capacidad, programa y prioriza órdenes, monitorea carga. |
| **Operador / Supervisor de Piso** | Ejecuta operaciones, registra consumo, registra salida y merma, controla avance por orden. |

## 4. Requisitos Funcionales

### FR-01: Gestión de BOM (US-01)
- Crear/ver BOM por producto terminado con `base_quantity > 0`, `version`, `effective_from`.
- Añadir componentes con `quantity_per_unit > 0`, unidad y merma. Rechazar duplicados (`UNIQUE (bom_id, component_product_id)`).
- Visualizar árbol multi-nivel (≥4 niveles), distinguir sub-ensamble vs. material.
- Detectar ciclos y cortarlos sin recursión infinita.

### FR-02: Centros de Trabajo y Rutas (US-02)
- Configurar `work_centers` con `capacity_per_day_minutes > 0` y `efficiency_factor` en (0,1].
- Crear `routings` con operaciones ordenadas por `sequence` ≥ 10, estrictamente crecientes.
- Calcular `planned_time_minutes = setup_time_minutes + run_time_per_unit_minutes × quantity`.
- Editar ruta sin mutar `production_order_operations` ya congeladas.

### FR-03: Despacho de Órdenes (US-03)
- Crear orden con `quantity_planned > 0`, producto, BOM, bodega destino.
- Soportar MTO (`sales_order_id` con `make_to_order=true`) o stock (`sales_order_id = null`).
- Al liberar, congelar BOM/ruta y generar una `production_order_operations` por cada paso de ruta.
- Transiciones: `planned → released → in_progress → completed`, `cancelled` lateral desde no-terminales.

### FR-04: Ejecución en Piso (US-04)
- Operaciones: `pending → in_progress → paused → completed`. `started_at` al iniciar; `completed_at` al completar.
- Primera operación iniciada → orden pasa a `in_progress`. Todas completadas → orden pasa a `completed` con `actual_end_date`.
- Capturar `actual_time_minutes > 0`, `quantity_completed`, `scrap_quantity`.
- Marcar operaciones fuera de secuencia como advertencia (no bloqueante).

### FR-05: Consumo y Salida (US-05)
- Registrar `material_consumption` con `quantity_consumed > 0`, vinculado a orden/componente/bodega.
- Mostrar teórico vs. real por línea BOM; permitir uso no planificado (`bom_component_id = null`).
- Registrar `production_output` con `quantity_produced > 0` y `scrap_quantity ≥ 0`. Soportar salidas parciales.
- Simular débito/crédito de inventario vía `InventoryPort`.
- Calcular yield (`produced/planned`) y scrap rate (`scrap/(produced+scrap)`) sin persistir.

### FR-06: Panel y Trazabilidad
- KPIs: órdenes activas, scrap rate, completion/yield, totales.
- Utilización por centro de trabajo (carga pendiente vs. capacidad efectiva).
- Trazabilidad por orden: operaciones, consumo plan-vs-real, salida, calidad derivada.

### FR-07: Planificación y Calendarización de Órdenes (US-07)

- Consultar las órdenes de producción existentes, mostrando identificador, producto, cantidad planificada, estado y fechas planificadas disponibles.
- Asignar y modificar las fechas planificadas de inicio y término de las órdenes de producción.
- Validar que la fecha de término sea igual o posterior a la fecha de inicio. Si las fechas son inválidas, impedir el guardado y mostrar un mensaje explicativo.
- Mostrar las órdenes calendarizadas en un listado ordenado cronológicamente e identificar las órdenes que todavía no tienen fechas asignadas.
- Permitir consultar la programación actualizada después de guardar los cambios.
- Mantener diferenciadas las fechas planificadas y la información real de ejecución. La calendarización no debe modificar los tiempos reales, las cantidades producidas ni el historial de las operaciones ejecutadas.

**Historia de usuario:** Como planificador de producción, quiero asignar y consultar las fechas planificadas de inicio y término de las órdenes de producción, para organizar las actividades de fabricación y facilitar el cumplimiento de los plazos establecidos.

Alcance del MVP: La funcionalidad se implementará en el frontend, utilizando los datos y mecanismos de persistencia disponibles en el proyecto. No se requiere un algoritmo de optimización automática de la secuencia de producción.

## 5. Criterios de Aceptación

| ID | Criterio | Estado |
|---|---|---|
| AC-01 | Árbol BOM multi-nivel con ≥4 niveles y ciclo detectado | Implementado |
| AC-02 | Ruta con secuencia estrictamente creciente y tiempo estándar calculado | Implementado |
| AC-03 | Liberación congela BOM/ruta y genera operaciones; MTO/stock soportado | Implementado |
| AC-04 | Máquinas de estados validadas; rechazo de transiciones inversas | Implementado |
| AC-05 | Ejecución con tiempos reales; avance automático del estado de orden | Implementado |
| AC-06 | Consumo teórico vs. real con flags de discrepancia; uso no planificado permitido | Implementado |
| AC-07 | Salida con merma, salidas parciales, inventario simulado actualizado | Implementado |
| AC-08 | Panel con KPIs y utilización por centro de trabajo | Implementado |
| AC-09 | Calidad derivada desde `quality_inspections` (solo lectura) | Implementado |
| AC-10 | Pruebas unitarias del dominio y del store pasan; build exitoso | Verificado |
| AC-11 | Consultar órdenes de producción con sus fechas planificadas y estados | Pendiente |
| AC-12 | Asignar y modificar fechas planificadas de inicio y término | Pendiente |
| AC-13 | Rechazar fechas inválidas y mostrar un mensaje explicativo | Pendiente |
| AC-14 | Visualizar las órdenes calendarizadas en orden cronológico e identificar las no calendarizadas | Pendiente |
| AC-15 | Reflejar los cambios de programación después de guardar | Pendiente |
| AC-16 | Mantener intactos los tiempos reales, cantidades producidas e historial de ejecución al modificar la planificación | Pendiente |

## 6. Artefactos Spec-Kit

| Artefacto | Ruta | Propósito |
|---|---|---|
| `spec.md` | `specs/002-operations-manufacturing/spec.md` | Especificación funcional y criterios de aceptación |
| `plan.md` | `specs/002-operations-manufacturing/plan.md` | Plan de implementación, fases, gobernanza, estructura |
| `data-model.md` | `specs/002-operations-manufacturing/data-model.md` | Diccionario de datos, ERD Mermaid, ética/datos, trazabilidad |
| `tasks.md` | `specs/002-operations-manufacturing/tasks.md` | Tareas atómicas por fase e historia de usuario |

## 7. Notas de Implementación

- **Stack**: Vanilla JavaScript ES2022 + Vite + CSS. JSDoc para tipado (paridad con `001-erp-base-module`).
- **Arquitectura**: `domain/` (lógica pura), `data/` (fixtures + store + puertos), `components/` (vistas), `styles/`.
- **Estado**: `ManufacturingStore` en memoria con `EventTarget` para re-render reactivo.
- **Datos**: fixtures deterministas con MTO, BOM multi-nivel, órdenes en varios estados.
- **Ética**: agregación por centro/operación, sin rankings individuales; tiempos como dato de proceso.
