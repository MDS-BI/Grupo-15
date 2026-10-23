# Tareas: Módulo de Operaciones / Manufactura (ERP)

**Entrada**: Documentos de diseño desde `/specs/002-operations-manufacturing/`
**Prerrequisitos**: plan.md (obligatorio), data-model.md (obligatorio), contracts/ (Fase 1), spec.md (historias de usuario)
**Stack**: Vanilla JavaScript (ES2022) + Vite + Vitest/jsdom — paridad con `001-erp-base-module` (ver decisión de arquitectura en §Notas)
**Convención de nombres**: se preservan `snake_case` y claves `_id` de `data-model.md`; los módulos de código usan `camelCase`.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Historia]**: historia de usuario asociada (US1–US5)
- Rutas de archivo explícitas en cada tarea

---

## Fase 1: Configuración (Infraestructura Compartida)

**Propósito**: Preparar el espacio de trabajo del frontend de manufactura.

- [ ] T001 Crear la estructura de carpetas de manufactura (`src/domain/`, `src/data/fixtures/`, `src/data/ports/`, `src/stores/`, `src/components/{bom,routing,workcenters,orders,execution}/`, `src/pages/`) conforme a plan.md
- [ ] T002 [P] Añadir scripts de manufactura a `package.json` si se requiere una entrada separada (por defecto se reutiliza `npm run dev` / `npm test`)
- [ ] T003 [P] Configurar el contexto de pruebas jsdom para los nuevos módulos en `vitest.config.mjs`

---

## Fase 2: Fundacional (Prerrequisitos Bloqueantes)

**Propósito**: Tipos, contratos, estado y motor mock de los que dependen TODAS las historias.

**⚠️ CRÍTICO**: ninguna historia puede comenzar hasta completar esta fase.

- [ ] T004 Definir enums y tipos espejo de `data-model.md` (`ProductType`, `WarehouseType`, `BomStatus`, `RoutingStatus`, `ProductionOrderStatus`, `OperationStatus`, `Priority` y entidades `BillOfMaterials`, `BomComponent`, `WorkCenter`, `Routing`, `RoutingOperation`, `ProductionOrder`, `ProductionOrderOperation`, `MaterialConsumption`, `ProductionOutput`, y frontera `Product`, `Warehouse`, `UnitOfMeasure`, `Company`, `SalesOrder`, `QualityInspection`) en `src/domain/types.js`
- [ ] T005 [P] Implementar la máquina de estados de `production_orders` (`planned → released → in_progress → completed`, `cancelled` lateral, transiciones inversas rechazadas) en `src/domain/order-state-machine.js`
- [ ] T006 [P] Implementar `planned_time_minutes = setup_time_minutes + run_time_per_unit_minutes × quantity` en `src/domain/operation-planning.js`
- [ ] T007 [P] Implementar cálculo de consumo teórico y explosión multi-nivel de BOM en `src/domain/bom-explosion.js`
- [ ] T008 [P] Implementar reglas de reconciliación plan-vs-real (varianza, tolerancia, flags de discrepancia) en `src/domain/reconciliation.js`
- [ ] T009 [P] Implementar validadores de esquema/negocio (`quantity_planned > 0`, `quantity_consumed > 0`, `UNIQUE (bom_id, component_product_id)`, detección de ciclos) en `src/domain/validators.js`
- [ ] T010 Definir la interfaz del repositorio `ProductionRepository` en `src/data/ProductionRepository.js`
- [ ] T011 Definir los puertos de solo lectura `InventoryPort` y `QualityPort` en `src/data/ports/InventoryPort.js` y `src/data/ports/QualityPort.js`
- [ ] T012 Implementar `MockProductionRepository` con RNG semillado y latencia simulada en `src/data/MockProductionRepository.js`
- [ ] T013 Crear el store de estado de órdenes (acciones de despacho, guardas de transición, generación de operaciones) en `src/stores/orderStore.js`
- [ ] T014 [P] Crear el store de BOM/rutas (CRUD, ensamblado de árbol, explosión) en `src/stores/bomStore.js`
- [ ] T015 [P] Crear el store de ejecución (progreso de operaciones, consumo, salida) en `src/stores/executionStore.js`
- [ ] T016 [P] Crear el store de datos maestros de solo lectura (`products`, `warehouses`, `units_of_measure`, `sales_orders`, `quality_inspections`) en `src/stores/masterDataStore.js`

**Punto de control**: tipos, estado y motor mock operativos; las historias pueden comenzar.

---

## Fase 3: Historia de Usuario US-01 - BOM multi-nivel (Prioridad: P1) 🎯 MVP

**Objetivo**: Crear y visualizar estructuras de materiales multi-nivel (`bill_of_materials`, `bom_components`).

**Prueba Independiente**: un planificador crea una BOM de bien terminado, añade componentes y sub-ensambles, y ve el árbol anidado (≥4 niveles) con consumo teórico total.

### Datos y prueba para US-01

- [ ] T017 [P] [US1] Añadir fixtures de BOM multi-nivel y componentes en `src/data/fixtures/boms.js`
- [ ] T018 [P] [US1] Añadir pruebas unitarias de explosión de BOM y detección de ciclos en `tests/unit/bom-explosion.test.js`
- [ ] T019 [P] [US1] Añadir pruebas unitarias de validación de BOM (`UNIQUE (bom_id, component_product_id)`) en `tests/unit/bom-validators.test.js`

### Implementación para US-01

- [ ] T020 [P] [US1] Crear `BomTreeViewer` (árbol expandible/colapsable, ≥4 niveles, distinción sub-ensamble vs. material) en `src/components/bom/BomTreeViewer.js`
- [ ] T021 [US1] Crear `BomEditor` (cabecera + líneas `bom_components`, `quantity_per_unit`, `scrap_percentage`) en `src/components/bom/BomEditor.js`
- [ ] T022 [US1] Crear la página explorador de BOM en `src/pages/BomExplorerPage.js`
- [ ] T023 [US1] Añadir pruebas de integración del árbol de BOM en `tests/integration/bom-explorer.test.js`

**Punto de control**: US-01 completamente funcional y comprobable de forma independiente.

---

## Fase 4: Historia de Usuario US-02 - Centros de trabajo y rutas (Prioridad: P1)

**Objetivo**: Configurar capacidad de centros de trabajo y secuencia de operaciones (`work_centers`, `routings`, `routing_operations`).

**Prueba Independiente**: un planificador define un centro de trabajo con capacidad, crea una ruta y ordena sus operaciones; el tiempo estándar total se calcula en vivo.

### Datos y prueba para US-02

- [ ] T024 [P] [US2] Añadir fixtures de centros de trabajo y rutas en `src/data/fixtures/work-centers.js` y `src/data/fixtures/routings.js`
- [ ] T025 [P] [US2] Añadir pruebas unitarias de `planned_time_minutes` y validación de `sequence` en `tests/unit/operation-planning.test.js`

### Implementación para US-02

- [ ] T026 [P] [US2] Crear `WorkCenterCapacityList` (carga vs. `capacity_per_day_minutes`) en `src/components/routing/WorkCenterCapacityList.js`
- [ ] T027 [US2] Crear `RoutingEditor` (secuencia de operaciones, prevención de duplicados/fuera de orden) en `src/components/routing/RoutingEditor.js`
- [ ] T028 [US2] Asegurar que editar una ruta no muta `production_order_operations` ya congeladas en `src/stores/bomStore.js`
- [ ] T029 [US2] Añadir pruebas de integración del editor de rutas en `tests/integration/routing-editor.test.js`

**Punto de control**: US-01 y US-02 funcionales de forma independiente.

---

## Fase 5: Historia de Usuario US-03 - Despacho de órdenes de producción (Prioridad: P1) 🎯 MVP

**Objetivo**: Crear y liberar órdenes desde reposición o make-to-order (`production_orders` + snapshot de `production_order_operations`).

**Prueba Independiente**: un planificador crea una orden (stock o MTO), la libera y observa las operaciones generadas y el estado `released`.

### Datos y prueba para US-03

- [ ] T030 [P] [US3] Añadir fixtures de datos maestros (`products`, `warehouses`, `units_of_measure`, `sales_orders` con MTO) en `src/data/fixtures/master-data.js`
- [ ] T031 [P] [US3] Añadir fixtures de órdenes de producción en varios estados en `src/data/fixtures/production-orders.js`
- [ ] T032 [P] [US3] Añadir pruebas unitarias de la máquina de estados de órdenes en `tests/unit/order-state-machine.test.js`

### Implementación para US-03

- [ ] T033 [US3] Crear `OrderDispatcher` (crear desde stock o MTO con `sales_order_id` nullable; liberar congela BOM/ruta y genera operaciones) en `src/components/orders/OrderDispatcher.js`
- [ ] T034 [US3] Crear `ProductionOrderBoard` (lista + kanban por `status`, filtros por `status`/`priority`) en `src/components/orders/ProductionOrderBoard.js`
- [ ] T035 [US3] Crear la página de seguimiento de órdenes en `src/pages/ProductionOrdersPage.js`
- [ ] T036 [US3] Implementar liberación/cancelación con confirmación y sin borrado silencioso de registros de ejecución en `src/stores/orderStore.js`
- [ ] T037 [US3] Añadir pruebas de integración del despacho y el tablero en `tests/integration/production-orders.test.js`

**Punto de control**: US-01, US-02 y US-03 funcionales; tablero de producción operativo (MVP ampliado).

---

## Fase 6: Historia de Usuario US-04 - Ejecución en piso de planta (Prioridad: P2)

**Objetivo**: Iniciar, pausar y completar operaciones registrando `actual_time_minutes`.

**Prueba Independiente**: un operador inicia la primera operación (la orden pasa a `in_progress`), completa todas y la orden pasa a `completed` con `actual_end_date`.

### Datos y prueba para US-04

- [ ] T038 [P] [US4] Añadir pruebas unitarias de transiciones de operación (`pending → in_progress → completed`, `paused`) en `tests/unit/operation-execution.test.js`

### Implementación para US-04

- [ ] T039 [US4] Crear `OperationExecutionPanel` (iniciar/pausar/completar, `actual_time_minutes` vs. `planned_time_minutes`) en `src/components/execution/OperationExecutionPanel.js`
- [ ] T040 [US4] Propagar la finalización de la primera operación a `production_orders.status = in_progress` y la última a `completed` en `src/stores/executionStore.js`
- [ ] T041 [US4] Marcar operaciones fuera de secuencia como advertencia (no bloqueo) en `src/components/execution/OperationExecutionPanel.js`
- [ ] T042 [US4] Añadir pruebas de integración de la consola de ejecución en `tests/integration/operation-execution.test.js`

**Punto de control**: US-04 funcional de forma independiente.

---

## Fase 7: Historia de Usuario US-05 - Consumo y salida (Prioridad: P2)

**Objetivo**: Registrar `material_consumption` real y `production_output` con merma.

**Prueba Independiente**: un operador registra consumo (teórico vs. real), produce un lote parcial y ve yield y scrap rate calculados; el inventario mock se debita/acredita.

### Datos y prueba para US-05

- [ ] T043 [P] [US5] Añadir fixtures de consumo y salida de ejemplo, y hooks de `quality_inspections`, en `src/data/fixtures/consumption-output.js`
- [ ] T044 [P] [US5] Añadir pruebas unitarias de reconciliación plan-vs-real en `tests/unit/reconciliation.test.js`

### Implementación para US-05

- [ ] T045 [US5] Crear `MaterialConsumptionModal` (teórico vs. real por `bom_components`, lotes, uso no planificado con `bom_component_id = null`) en `src/components/execution/MaterialConsumptionModal.js`
- [ ] T046 [US5] Crear `ProductionOutputForm` (`quantity_produced` + `scrap_quantity`, salidas parciales) en `src/components/execution/ProductionOutputForm.js`
- [ ] T047 [US5] Implementar el débito/crédito simulado de inventario vía `InventoryPort` en `src/stores/executionStore.js`
- [ ] T048 [US5] Calcular y mostrar yield y scrap rate (no persistidos) en `src/components/orders/OrderTraceabilityView.js`
- [ ] T049 [US5] Añadir pruebas de integración de consumo, salida e inventario en `tests/integration/consumption-output.test.js`

**Punto de control**: US-01 a US-05 completamente funcionales.

---

## Fase 8: Panel y Marco (Historia de Usuario US-00 - Dashboard, Prioridad: P1) 🎯 MVP

**Objetivo**: Punto de entrada con KPIs y navegación consistente (dashboard overview).

**Prueba Independiente**: la aplicación abre en un panel con KPIs (órdenes activas, utilización de capacidad, scrap/completitud) y la navegación a cada vista funciona.

### Implementación para US-00

- [ ] T050 [P] [US0] Crear `DashboardOverview` con KPIs (órdenes activas por `status`, utilización por `work_center`, scrap rate, completion/yield rate) en `src/components/DashboardOverview.js`
- [ ] T051 [P] [US0] Crear la página panel en `src/pages/DashboardPage.js`
- [ ] T052 [US0] Crear el componente de estado vacío reutilizable en `src/components/EmptyState.js`
- [ ] T053 [US0] Reutilizar/adaptar los tokens de diseño del marco ERP en `src/styles/manufacturing.css`
- [ ] T054 [US0] Añadir pruebas de integración del panel y sus KPIs en `tests/integration/dashboard.test.js`

**Punto de control**: pantalla de entrada y navegación listas.

---

## Fase 9: Pulido y Preocupaciones Transversales

**Propósito**: Calidad, accesibilidad, rendimiento y preparación de la defensa.

- [ ] T055 [P] Añadir accesibilidad (etiquetas, foco de teclado, estructura semántica) en las vistas de manufactura
- [ ] T056 [P] Añadir pulido UX para estados vacíos, validación y diseño responsivo en `src/styles/manufacturing.css`
- [ ] T057 Verificar rendimiento con 500 órdenes y BOM de 4 niveles (< 100 ms por interacción) (plan.md §3 Fase 4)
- [ ] T058 Verificar la alineación de integración con Logística (débito/crédito) y Calidad (estado derivado de solo lectura)
- [ ] T059 Ejecutar la suite completa de pruebas y la compilación de producción (`npm test`, `npm run build`) sin regresiones
- [ ] T060 Preparar el guion de demo E2E de 5 minutos (pedido → orden → ejecución → consumo → salida → trazabilidad)

---

## Fase 10: Alineación de Especificación

**Propósito**: Cerrar la trazabilidad de la metodología SDD.

- [ ] T061 Crear `specs/002-operations-manufacturing/spec.md` a partir de plan.md §2 con requisitos funcionales y criterios de aceptación
- [ ] T062 [P] Crear los contratos de estado y repositorio en `specs/002-operations-manufacturing/contracts/`
- [ ] T063 [P] Crear `specs/002-operations-manufacturing/research.md` y `quickstart.md`

---

## Dependencias y Orden de Ejecución

### Dependencias entre Fases

- Configuración (Fase 1): sin dependencias
- Fundacional (Fase 2): depende de Configuración; **BLOQUEA** todas las historias
- US-01 (Fase 3): depende de Fundacional
- US-02 (Fase 4): depende de Fundacional
- US-03 (Fase 5): depende de US-01 y US-02 (necesita BOM y ruta para congelarlas)
- US-04 (Fase 6): depende de US-03 (necesita operaciones generadas)
- US-05 (Fase 7): depende de US-03 y US-04
- Panel US-00 (Fase 8): depende de Fundacional; los KPIs se completan tras US-03/US-05
- Pulido (Fase 9): depende de todas las historias deseadas
- Alineación de Especificación (Fase 10): puede avanzar en paralelo desde el inicio

### Oportunidades Paralelas

- T003, T005–T009, T014–T016 pueden ejecutarse en paralelo dentro de la Fase 2
- Las tareas de fixtures y pruebas de cada historia ([P]) pueden crearse en paralelo con la implementación de esa historia
- US-01 y US-02 pueden proceder en paralelo tras la Fase 2
- T050–T053 pueden ejecutarse en paralelo; T054 depende de ellas

---

## Estrategia de Implementación

### MVP Primero

1. Fase 1 (Configuración) + Fase 2 (Fundacional)
2. US-01 (BOM) + US-02 (Rutas) + US-03 (Órdenes) + Panel US-00
3. **DETENER y VALIDAR**: BOM, rutas, despacho y panel funcionan sobre datos mock
4. Demostrar

### Entrega Incremental

1. Añadir US-04 (ejecución) → validar → demostrar
2. Añadir US-05 (consumo/salida) → validar → demostrar
3. Pulido y preparación de defensa

---

## Notas

- [P] = archivos distintos, sin dependencias
- La etiqueta [USx] mapea la tarea a su historia para trazabilidad
- Cada historia debe ser completable y comprobable de forma independiente
- **Decisión de arquitectura (ADR pendiente)**: se adopta **JavaScript ES2022 con JSDoc tipado** para mantener paridad con `001-erp-base-module` y evitar migrar el stack a TypeScript en el MVP; registrar como ADR según plan.md §5.2. Si se aprueba TypeScript, renombrar `.js` → `.ts` sin cambiar la organización de tareas.
- Verificar que las pruebas fallan antes de implementar
- Evitar: tareas vagas, conflictos de archivo, dependencias cruzadas que rompan la independencia
