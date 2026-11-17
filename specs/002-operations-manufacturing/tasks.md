# Tareas: Módulo de Operaciones / Manufactura (ERP)

**Entrada**: Documentos de diseño desde `/specs/002-operations-manufacturing/`
**Prerrequisitos**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [research.md](research.md), [contracts/operator-shift.md](contracts/operator-shift.md), [contracts/maintenance.md](contracts/maintenance.md)
**Stack**: Vanilla JavaScript (ES2022) + Vite 8 + Vitest 4/jsdom — paridad con `001-erp-base-module`
**Convención**: `snake_case` y claves `_id` en datos; `camelCase` en código.

> **Estado de partida (2026-11-03)**: US-01 a US-05 ya están implementadas y verificadas por AC-01..AC-03 y AC-08..AC-14; esos IDs son anclas históricas y `spec.md` añade una columna "Historia" para evitar cruces con AC-04..AC-07/AC-20 de US-08. Este listado cubre los incrementos pendientes **US-06 (Operador de Máquina)**, **US-07 / HU-04 (Supervisor de Línea)**, **US-08 / FR-09 (Panel de desempeño de planta)**, **US-09 / HU-06 (Mantenimiento)**, **US-10 (Planificador)** y **US-11 (Balance de líneas)**, conservando una fase de verificación por cada historia existente para evitar regresiones.
>
> **Snapshot**: US-06/US-07 usan `erp.manufacturing.v1`; US-08 introduce `erp.manufacturing.v2` con migración desde `v1` y US-09/US-10/US-11 reutilizan `v2`. Toda tarea que persiste estado nuevo debe escribir en `v2`.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Historia]**: `US1`–`US11` para tareas de historia; sin etiqueta en configuración, fundacional y pulido
- Rutas de archivo explícitas en cada tarea

---

## Fase 1: Configuración (Infraestructura Compartida)

**Propósito**: Confirmar que el entorno de ejecución y pruebas del módulo está listo.

- [X] T001 [P] Verificar dependencias y scripts de manufactura en `package.json` y `package-lock.json`; ejecutar `npm ci` si `node_modules` no existe
- [X] T002 [P] Confirmar que jsdom se configura por suite con `JSDOM` en las pruebas de integración de manufactura; no se requiere cambio global en `vitest.config.mjs`
- [X] T003 [P] Confirmar la estructura real del proyecto (`src/domain/`, `src/data/`, `src/data/fixtures/`, `src/data/ports/`, `src/components/`, `src/styles/`, `tests/unit/`, `tests/integration/`) contra `plan.md` §6

**Punto de control**: entorno y estructura verificados.

---

## Fase 2: Fundacional (Prerrequisitos Bloqueantes)

**Propósito**: Tipos, persistencia, fixtures y estado compartido que necesitan todas las historias.

**⚠️ CRÍTICO**: ninguna historia puede cerrarse sin completar esta fase.

- [X] T004 [P] Añadir a `src/domain/types.js` los enums `DelayReasonOrigin` (`predefined`/`custom`), `ShiftStatus` (`in_progress`/`completed`), `WorkCenterOperationalStatus` (`in_operation`/`paused`/`fault`/`changeover`) y `MaintenanceTicketStatus` (`open`/`in_progress`/`resolved`); definir los typedefs `ProductionShift` (con `supervisor_validated`, `validated_at`, `supervisor_notes`), `OperationDelay` (con `escalated_to_maint`), `DelayReason`, `ShiftAssignment` (`shift_assignment_id`, `work_center_id`, `ext_hr_employee_id`, `shift_band`, `assigned_at`, `active`) y `MaintenanceTicket` (`ticket_id`, `work_center_id`, `operation_delay_id`, `priority`, `ticket_status`, `reported_by`, `created_at`); ampliar `ProductionOrderOperation` con `delay_time_minutes` y `WorkCenter` con `operational_status`
- [X] T005 [P] Implementar el adaptador de snapshot versionado `erp.manufacturing.v1` en `src/data/persistence.js` (`loadSnapshot`, `saveSnapshot`, `clearSnapshot`, validación de `version` y forma mínima incluyendo colecciones de turno y supervisión) según `contracts/operator-shift.md` §6
- [X] T006 [P] Añadir pruebas unitarias de persistencia (round-trip, snapshot ausente, JSON corrupto, versión distinta) en `tests/unit/persistence.test.js`
- [X] T007 [P] Crear fixtures de motivos y turnos en `src/data/fixtures/delay-reasons.js` y `src/data/fixtures/production-shifts.js`; crear fixtures de supervisión en `src/data/fixtures/shift-assignments.js`, `src/data/fixtures/hr-employees.js` (puente `ext_hr_employee_id`) y `src/data/fixtures/maintenance-tickets.js`; ampliar `src/data/fixtures/production-orders.js` y `src/data/fixtures/work-centers.js` con estados iniciales de semáforo y escenario sembrado de turno y atraso
- [X] T008 Extender `src/data/ManufacturingStore.js` con las colecciones `productionShifts`, `operationDelays`, `delayReasons`, `shiftAssignments`, `hrEmployees` y `maintenanceTickets`, hidratación desde `src/data/persistence.js` y escritura del snapshot tras cada mutación (depende de T005, T007)

**Punto de control**: tipos, fixtures, persistencia y store listos; las historias pueden validarse sin romper el estado existente.

---

## Fase 3: Historia de Usuario US-01 - BOM multi-nivel (Prioridad: P1)

**Objetivo**: Confirmar que la gestión y visualización de BOM multi-nivel sigue intacta.

**Prueba Independiente**: un planificador abre una BOM de bien terminado, ve el árbol anidado (≥4 niveles) con consumo teórico total y un ciclo se detecta sin recursión infinita.

- [X] T009 [P] [US1] Verificar AC-01 ejecutando `tests/unit/bom-explosion.test.js` y revisando el árbol y la detección de ciclos en `src/components/BomExplorer.js`

**Punto de control**: US-01 verificada; cualquier regresión debe corregirse antes de avanzar.

---

## Fase 4: Historia de Usuario US-02 - Centros de trabajo y rutas (Prioridad: P1)

**Objetivo**: Confirmar capacidad, secuencia de operaciones y tiempo estándar.

**Prueba Independiente**: una ruta conserva secuencia estrictamente creciente y `planned_time_minutes` se calcula como `setup + run × quantity`.

- [X] T010 [P] [US2] Verificar AC-02 ejecutando `tests/unit/operation-planning.test.js` y revisando `src/domain/operation-planning.js` y `src/data/fixtures/routings.js`

**Punto de control**: US-02 verificada sin mutar operaciones ya congeladas.

---

## Fase 5: Historia de Usuario US-03 - Despacho de órdenes (Prioridad: P1)

**Objetivo**: Confirmar creación, liberación y congelamiento de BOM/ruta/operaciones.

**Prueba Independiente**: una orden creada desde stock o MTO se libera, genera una operación por paso de ruta y respeta la máquina de estados.

- [X] T011 [P] [US3] Verificar AC-03 ejecutando `tests/unit/order-state-machine.test.js` y revisando `src/data/ManufacturingStore.js` (`createOrder`, `transitionOrder`, `#generateOperations`); AC-04 pertenece a US-08 y no se renumbera: la trazabilidad se resume en la columna "Historia" de `spec.md`

**Punto de control**: US-03 verificada; las operaciones generadas son la base de US-06 y US-07.

---

## Fase 6: Historia de Usuario US-06 - Registro de turno del operador (Prioridad: P1) 🎯 MVP Operador

**Objetivo**: Iniciar/finalizar la operación activa con un botón, justificar atrasos y mantener contadores de turno y acumulado, con persistencia ante recarga.

**Prueba Independiente**: un operador inicia una operación, registra un atraso, ajusta ambos contadores, finaliza con confirmación y recarga la página conservando turno, tiempos, atrasos y piezas.

### Pruebas para US-06 (escribir primero) ⚠️

- [X] T012 [P] [US6] Añadir pruebas unitarias de tiempo efectivo, descuento de atrasos cerrados, atrasos abiertos y tolerancia de 1 s en `tests/unit/shift-tracking.test.js`
- [X] T013 [P] [US6] Añadir pruebas unitarias de guardas y contadores del store (un turno activo, doble cierre, motivo obligatorio, atrasos simultáneos, valores negativos/no numéricos) en `tests/unit/manufacturing-store.test.js`
- [X] T014 [P] [US6] Añadir prueba de integración jsdom del botón alterno, confirmación, atraso y contadores en `tests/integration/operator-shift.test.js`
- [X] T015 [P] [US6] Añadir prueba de integración de cierre con atraso abierto y corrección posterior en `tests/integration/delay-correction.test.js`

### Implementación para US-06

- [X] T016 [P] [US6] Implementar `src/domain/shift-tracking.js` con funciones puras `elapsedMinutes`, `computeEffectiveMinutes`, `sumClosedDelayMinutes`, `hasOpenDelay`, `validateCounter` y guardas de un solo turno/atraso
- [X] T017 [US6] Implementar en `src/data/ManufacturingStore.js` las consultas `activeShiftFor`, `openDelayFor`, `delaysForOperation`, `reasonsForShift` y las acciones `startShift`, `finishOperation`, `closeDelay`, `correctOpenDelay`
- [X] T018 [US6] Implementar en `src/data/ManufacturingStore.js` `startDelay` con motivo predefinido o personalizado reutilizable, y `adjustShiftCounter`/`setShiftCounter` con delta único hacia `quantity_completed` (depende de T017)
- [X] T019 [US6] Crear `src/components/OperatorWorkstationPanel.js` con tarjeta de orden/operación activa, botón alterno `Iniciar`/`Finalizar`, confirmación, cronómetro, lista de atrasos y ambos contadores
- [X] T020 [US6] Crear `src/components/DelayCorrectionDialog.js` para listar atrasos abiertos tras el cierre y corregirlos con nota de auditoría
- [X] T021 [US6] Integrar `OperatorWorkstationPanel` en `src/components/ProductionOrders.js` y añadir su vista/ruta en `src/manufacturing-main.js`
- [X] T022 [US6] Añadir estilos de botón alterno, cronómetro, aviso de atraso abierto y contadores en `src/styles/manufacturing.css`, incluyendo `aria-pressed`, foco del diálogo y cierre con `Esc`
- [X] T023 [US6] Asegurar la escritura del snapshot tras cada acción de US-06 y la rehidratación de cronómetros desde `started_at`/`ended_at` en `src/data/ManufacturingStore.js` y `src/data/persistence.js` (depende de T008, T017)
- [X] T024 [US6] Ejecutar las pruebas de US-06 (`tests/unit/shift-tracking.test.js`, `tests/unit/manufacturing-store.test.js`, `tests/integration/operator-shift.test.js`, `tests/integration/delay-correction.test.js`), corregir fallos y actualizar AC-15..AC-17 a `Implementado`/`Verificado` en `spec.md`

**Punto de control**: US-06 completamente funcional y comprobable de forma independiente; AC-15..AC-17 verificados.

---

## Fase 7: Historia de Usuario US-07 (HU-04) - Supervisión de Línea (Prioridad: P1) 🎯 MVP Supervisor

**Objetivo**: Visualizar el semáforo en tiempo real, asignar operarios (`ext_hr_employee_id`), validar cierres de turno (`supervisor_validated = true`) y escalar incidentes a mantenimiento (`escalated_to_maint = true`).

**Prueba Independiente**: el supervisor visualiza el semáforo, asigna un operario a un centro, aprueba un cierre sin atrasos abiertos y escala una parada crítica viendo la máquina pasar a *En fallo* y persistir tras recargar.

### Pruebas para US-07 (escribir primero) ⚠️

- [X] T025 [P] [US7] Añadir pruebas unitarias de derivación del semáforo (`in_operation`, `paused`, `fault`, `changeover`), asignación única de operario por franja (`ext_hr_employee_id`) y reglas de aprobación de cierre en `tests/unit/line-supervision.test.js`
- [X] T026 [P] [US7] Añadir pruebas unitarias en `tests/unit/manufacturing-store.test.js` para `assignOperatorToWorkCenter`, `setWorkCenterOperationalStatus`, `validateShiftClosure` y `escalateIncidentToMaintenance` (`escalated_to_maint = true` + ticket + `fault`)
- [X] T027 [P] [US7] Añadir prueba de integración jsdom del panel de supervisor (semáforo, asignación, aprobación y botón de escalamiento) en `tests/integration/supervisor-line-panel.test.js`

### Implementación para US-07

- [X] T028 [P] [US7] Implementar `src/domain/line-supervision.js` con funciones puras `deriveWorkCenterTrafficLight`, `canAssignOperator`, `canValidateShiftClosure` y `buildUrgentMaintenanceTicket`
- [X] T029 [US7] Implementar en `src/data/ManufacturingStore.js` las consultas `trafficLightForWorkCenters`, `activeAssignmentForWorkCenter`, `shiftsPendingValidation`, `openMaintenanceTicketsFor` y las mutaciones `assignOperatorToWorkCenter`, `setWorkCenterOperationalStatus`, `validateShiftClosure` y `escalateIncidentToMaintenance` (depende de T008, T017, T028)
- [X] T030 [US7] Crear `src/components/SupervisorLinePanel.js` con semáforo en vivo, asignación de personal, bandeja de cierres con aprobación y botón de alerta de escalamiento
- [X] T031 [US7] Integrar `SupervisorLinePanel` en `src/manufacturing-main.js` y vincular alertas rápidas desde `src/components/ProductionOrders.js` (depende de T030)
- [X] T032 [US7] Añadir estilos de semáforo industrial accesible, insignias de validación y botón de emergencia en `src/styles/manufacturing.css`
- [X] T033 [US7] Ejecutar las suites de US-07 (`tests/unit/line-supervision.test.js`, `tests/unit/manufacturing-store.test.js`, `tests/integration/supervisor-line-panel.test.js`), verificar persistencia tras recarga y actualizar AC-18..AC-19 a `Implementado`/`Verificado` en `spec.md`

**Punto de control**: US-07 (HU-04) completamente funcional; AC-18..AC-19 verificados.

---

## Fase 8: Historia de Usuario US-04 - Ejecución en piso (Prioridad: P2)

**Objetivo**: Confirmar que la ejecución existente sigue funcionando junto a US-06 y US-07.

**Prueba Independiente**: iniciar la primera operación mueve la orden a `in_progress` y el semáforo a `in_operation`; pausar y completar respetan la máquina de estados; completar la última operación mueve la orden a `completed`.

- [X] T034 [P] [US4] Verificar AC-08 y AC-09 ejecutando `tests/unit/manufacturing-store.test.js` y revisando `startOperation`, `pauseOperation` y `completeOperation` en `src/data/ManufacturingStore.js`; la orden se completa aunque falte output (E-06)
- [X] T035 [US4] Asegurar que `finishOperation` reutiliza la lógica de `completeOperation` sin romper pausas ni el cálculo previo de `actual_time_minutes`, y actualiza el estado del semáforo en `src/data/ManufacturingStore.js`

**Punto de control**: US-04, US-06 y US-07 conviven sin dobles cierres ni estados inconsistentes.

---

## Fase 9: Historia de Usuario US-05 - Consumo y salida (Prioridad: P2)

**Objetivo**: Confirmar que consumo, salida e inventario simulado no se ven afectados por el seguimiento de turno ni la supervisión de línea.

**Prueba Independiente**: registrar consumo debita inventario, registrar salida lo acredita y la reconciliación plan-vs-real sigue calculando varianza y flags.

- [X] T036 [P] [US5] Verificar AC-10 y AC-11 ejecutando `tests/unit/reconciliation.test.js` y `tests/unit/manufacturing-store.test.js` y revisando `src/data/ports/index.js`

**Punto de control**: US-01 a US-07 verificadas en conjunto.

---

## Fase 10: Historia de Usuario US-08 - Panel de Desempeño de Planta (Prioridad: P2) 🎯 MVP Jefa de Planta

**Objetivo**: Consolidar carga, OEE, paradas y cumplimiento por período; configurar umbrales con alarmas; reprogramar/cancelar órdenes; exportar PDF/Excel y aplicar permisos por rol simulado.

**Prueba Independiente**: la Jefa de Planta abre el panel, ve carga por centro con OEE y paradas del período, recibe una alarma al caer bajo el umbral, reprograma/cancela una orden, exporta el reporte y comprueba que un rol restringido no puede ejecutar acciones no permitidas.

### Pruebas para US-08 (escribir primero) ⚠️

- [X] T037 [P] [US8] Añadir pruebas unitarias de OEE (Disponibilidad × Rendimiento × Calidad), carga vs. capacidad efectiva, paradas acumuladas por motivo y evaluación de umbrales en `tests/unit/plant-performance.test.js`
- [X] T038 [P] [US8] Añadir un bloque aditivo de pruebas del store para `setIndicatorThreshold`, `changeOrderPriority`, `cancelOrderFromPanel`, `rolePermissions` y la delegación del store a la función pura `buildConsolidatedReport` en `tests/unit/manufacturing-store.test.js`
- [X] T039 [P] [US8] Añadir prueba de integración jsdom del panel de planta (KPIs, alarmas, acciones de orden, selector de rol y exportación simulada) en `tests/integration/plant-performance-panel.test.js`

### Implementación para US-08

- [X] T040 [P] [US8] Extender `src/domain/types.js` con los enums `PlantRole` (`plant_manager`/`supervisor`/`planner`/`operator`), `PlantIndicator` (`load`/`oee`/`downtime`/`fulfillment`) y el typedef `ThresholdSetting` (`indicator`, `threshold`, `comparison`, `updated_at`); añadir el mapa de permisos rol×acción con supervisor sin set_threshold ni cancel_order
- [X] T041 [P] [US8] Implementar `src/domain/plant-performance.js` con funciones puras `computeOee`, `computeLoadByWorkCenter`, `accumulateDowntimesByReason`, `evaluateThresholds`, `canPerformAction` y `buildConsolidatedReport`
- [X] T042 [P] [US8] Crear fixtures deterministas de umbrales y permisos en `src/data/fixtures/plant-performance.js`, incluyendo un escenario con centro sobre capacidad y una alarma activa
- [X] T043 [US8] Implementar el snapshot `erp.manufacturing.v2` en `src/data/persistence.js` con migración desde `v1` (inicializa `thresholdSettings` y `rolePermissions` y conserva el resto del estado; cae a fixtures con advertencia si es inválido) (depende de T005, T040)
- [X] T044 [US8] Extender `src/data/ManufacturingStore.js` con la colección `thresholdSettings`, las consultas `plantPerformanceFor(period)`, `loadByWorkCenterFor(period)`, `downtimesByReasonFor(period)` y `rolePermissionsFor(role)`, y las acciones `setIndicatorThreshold`, `changeOrderPriority` y `cancelOrderFromPanel`; el store delega el reporte consolidado a la función pura `buildConsolidatedReport` (depende de T008, T041, T043)
- [X] T045 [US8] Implementar la exportación local del reporte consolidado sin dependencias externas (Excel vía descarga CSV/SpreadsheetML y PDF vía vista imprimible con `window.print()`, con datos mock) en `src/data/exporters/plant-report.js`
- [X] T046 [US8] Crear `src/components/PlantPerformancePanel.js` con tarjetas de carga y OEE, tabla de paradas por motivo, alarmas de umbral, acciones de reprogramación/cancelación con confirmación, selector de rol y botones de exportación
- [X] T047 [US8] Integrar `PlantPerformancePanel` en una vista/ruta de `src/manufacturing-main.js` (depende de T046)
- [X] T048 [US8] Añadir estilos de tarjetas KPI, barras de carga, alarmas, insignias de rol y estados deshabilitados por permisos en `src/styles/manufacturing.css` (depende de T046)
- [X] T049 [US8] Ejecutar `tests/unit/plant-performance.test.js`, el bloque US-08 de `tests/unit/manufacturing-store.test.js` y `tests/integration/plant-performance-panel.test.js`; corregir fallos
- [X] T050 [US8] Actualizar `spec.md` AC-04..AC-07 y AC-20 a `Implementado`/`Verificado` y añadir el guion de demo del panel en `quickstart.md` cuando T049 pase

**Punto de control**: US-08 completamente funcional; AC-04..AC-07 y AC-20 verificados; snapshot `v2` operativo.

---

## Fase 11: Historia de Usuario US-09 - Mantenimiento (Prioridad: P2) 🎯 MVP Mantenimiento

**Objetivo**: Recibir tickets escalados, priorizarlos en bandeja, tomar la intervención con técnico, cerrarla registrando el tiempo real de parada y restablecer la disponibilidad, además de programar órdenes preventivas. Todo de forma **aditiva**.

**Prueba Independiente**: un ticket escalado aparece con prioridad `urgent`; se toma la intervención, se resuelve con marcas de parada y la máquina sale de `fault`; se programa una preventiva; tras recargar se conserva todo y la migración `v1 → v2` no pierde estado.

### Pruebas para US-09 (escribir primero) ⚠️

- [X] T051 [P] [US9] Añadir pruebas unitarias de `src/domain/maintenance.js` (transiciones de ticket y preventiva, guard de una intervención por centro, cálculo de `downtime_minutes`, desgaste derivado, disponibilidad al resolver e idempotencia por `operation_delay_id`) en `tests/unit/maintenance.test.js`
- [X] T052 [P] [US9] Añadir un bloque aditivo de pruebas del store para `startMaintenanceIntervention`, `resolveMaintenanceTicket`, órdenes preventivas, inmutabilidad ante error y migración `v1 → v2` en `tests/unit/manufacturing-store.test.js`
- [X] T053 [P] [US9] Añadir prueba de integración jsdom del panel de mantenimiento (bandeja priorizada → intervención → resolución y disponibilidad → recarga) y del ciclo de una orden preventiva en `tests/integration/maintenance-panel.test.js`

### Implementación para US-09

- [X] T054 [P] [US9] Extender el typedef `MaintenanceTicket` definido en T004 y añadir en `src/domain/types.js` los enums `MaintenancePriority` (`urgent`/`high`/`normal`), `PreventiveMaintenanceOrderStatus` (`planned`/`in_progress`/`completed`/`cancelled`) y el typedef `PreventiveMaintenanceOrder`; ampliar `MaintenanceTicket` con `technician_ext_hr_employee_id`, `intervention_started_at`, `resolved_at`, `downtime_started_at`, `downtime_ended_at`, `downtime_minutes`, `cause_reason_id`, `resolution_notes`, `escalated_to_maint` y `ticket_code`
- [X] T055 [P] [US9] Crear `src/data/fixtures/preventive-maintenance-orders.js` y ampliar `src/data/fixtures/maintenance-tickets.js` con escenarios sembrados de ticket `open`, `in_progress` y `resolved` (técnico, marcas de parada y `downtime_minutes`)
- [X] T056 [US9] Extender el snapshot `erp.manufacturing.v2` en `src/data/persistence.js` con `maintenanceTickets` y `preventiveMaintenanceOrders` (arrancan vacías si no existen), conservando la migración `v1 → v2` introducida en T043 (depende de T005, T043)
- [X] T057 [US9] Extender `src/data/ManufacturingStore.js` con la colección `preventiveMaintenanceOrders`, su hidratación desde el snapshot `v2` y la escritura write-through de mantenimiento (depende de T008, T054, T056)
- [X] T058 [P] [US9] Implementar `src/domain/maintenance.js` con funciones puras `canStartIntervention`, `canResolveTicket`, `computeDowntimeMinutes`, `deriveWearIndicator`, `resolveAvailabilityStatus`, `canTransitionPreventiveOrder` y `buildPreventiveOrderFromHistory` (depende de T054)
- [X] T059 [US9] Implementar en `src/data/ManufacturingStore.js` las consultas `maintenanceTicketsFor`, `activeInterventionForWorkCenter`, `maintenanceHistoryForWorkCenter`, `preventiveOrdersFor` y `maintenanceIndicatorsForWorkCenter` (depende de T057, T058)
- [X] T060 [US9] Implementar en `src/data/ManufacturingStore.js` `startMaintenanceIntervention` y `resolveMaintenanceTicket` con validación previa, una sola intervención activa por centro, cálculo de parada y restablecimiento derivado de la disponibilidad (depende de T059)
- [X] T061 [US9] Implementar en `src/data/ManufacturingStore.js` `createPreventiveMaintenanceOrder`, `transitionPreventiveMaintenanceOrder` y `cancelPreventiveMaintenanceOrder` con transiciones válidas y sin reabrir el ticket de origen (depende de T059)
- [X] T062 [US9] Crear `src/components/MaintenancePanel.js` con bandeja priorizada y filtrable, diálogo de toma de intervención, detalle y cierre con marcas de parada, historial/desgaste por máquina y alta/transición de órdenes preventivas
- [X] T063 [US9] Integrar `MaintenancePanel` en una vista/ruta de `src/manufacturing-main.js` sin modificar las vistas existentes (depende de T062)
- [X] T064 [US9] Añadir estilos de bandeja, semáforo de máquina, insignias de prioridad, aviso de máquina detenida y diálogos accesibles en `src/styles/manufacturing.css` (depende de T062)
- [X] T065 [US9] Crear el adaptador de solo lectura `src/data/ports/maintenance.js` con tiempos de parada y tickets resueltos para US-08, sin mutar colecciones existentes (depende de T060, T061)
- [X] T066 [US9] Ejecutar `tests/unit/maintenance.test.js`, el bloque US-09 de `tests/unit/manufacturing-store.test.js`, `tests/integration/maintenance-panel.test.js` y las suites de regresión de US-01…US-08; corregir fallos sin cambiar comportamiento existente
- [X] T067 [US9] Actualizar `spec.md` AC-21..AC-27 a `Implementado`/`Verificado` y añadir el guion de demo de mantenimiento en `quickstart.md` cuando T066 pase

**Punto de control**: US-09 completamente funcional; AC-21..AC-27 verificados; US-01…US-08 sin regresiones.

---

## Fase 12: Historia de Usuario US-10 - Planificación y Calendarización de Órdenes (Prioridad: P2) 🎯 MVP Planificador

**Objetivo**: Consultar órdenes, asignar y modificar fechas planificadas de inicio y término, validando el orden de fechas y conservando los cambios.

**Prueba Independiente**: el planificador consulta las órdenes, asigna fechas válidas, modifica una fecha, el sistema rechaza un término anterior al inicio y las fechas persisten tras recargar.

### Pruebas para US-10 (escribir primero) ⚠️

- [X] T068 [P] [US10] Añadir pruebas unitarias de validación de fechas planificadas (término ≥ inicio, valores nulos, órdenes terminales) en `tests/unit/order-scheduling.test.js`
- [X] T069 [P] [US10] Añadir un bloque aditivo de pruebas del store para `ordersForScheduling`, `updatePlannedDates` y persistencia de fechas en `tests/unit/manufacturing-store.test.js`
- [X] T070 [P] [US10] Añadir prueba de integración jsdom de la vista de planificación (listado, edición de fechas, validación inline y recarga) en `tests/integration/order-scheduling.test.js`

### Implementación para US-10

- [X] T071 [P] [US10] Extender `src/domain/types.js` con `planned_start_date` y `planned_end_date` (nullable) en `ProductionOrder`
- [X] T072 [P] [US10] Implementar `src/domain/order-scheduling.js` con las funciones puras `isValidIsoDate`, `validatePlannedDates`, `canRescheduleOrder` y `sortOrdersForScheduling`
- [X] T073 [US10] Extender `src/data/ManufacturingStore.js` con las consultas `ordersForScheduling({ status, dateFrom, dateTo })` y la acción `updatePlannedDates(orderId, { planned_start_date, planned_end_date })` con validación previa y write-through al snapshot `v2` (depende de T071, T072, T008)
- [X] T074 [US10] Crear `src/components/ProductionSchedulingPanel.js` con filtros por estado y fechas, edición de fechas planificadas, validación inline y confirmación de guardado
- [X] T075 [US10] Integrar `ProductionSchedulingPanel` en una vista/ruta de `src/manufacturing-main.js` y añadir sus estilos en `src/styles/manufacturing.css` (depende de T074)
- [X] T076 [US10] Ejecutar `tests/unit/order-scheduling.test.js`, el bloque US-10 de `tests/unit/manufacturing-store.test.js` y `tests/integration/order-scheduling.test.js`; actualizar AC-28..AC-33 a `Implementado`/`Verificado`

**Punto de control**: US-10 completamente funcional; AC-28..AC-33 verificados.

---

## Fase 13: Historia de Usuario US-11 - Balance de Líneas (Prioridad: P2) 🎯 MVP Ingeniero de Producción

**Objetivo**: Consultar la utilización y carga proyectada por centro frente a su capacidad nominal, identificar cuellos de botella y comparar tiempos estándar para balancear la línea.

**Prueba Independiente**: el Ingeniero de Producción abre el panel, ve la utilización y carga proyectada por centro, identifica el cuello de botella y la carga se actualiza al cambiar la demanda planificada.

### Pruebas para US-11 (escribir primero) ⚠️

- [X] T077 [P] [US11] Añadir pruebas unitarias de tiempos estándar, carga proyectada, utilización vs. capacidad nominal y detección de cuello de botella en `tests/unit/line-balance.test.js`
- [X] T078 [P] [US11] Añadir prueba de integración jsdom del panel de balance de líneas (tabla por centro, cuello de botella destacado y escenario vacío) en `tests/integration/line-balance-panel.test.js`

### Implementación para US-11

- [X] T079 [P] [US11] Implementar `src/domain/line-balance.js` con las funciones puras `computeStandardTimes`, `computeProjectedLoad`, `computeUtilization` y `detectBottlenecks`
- [X] T080 [US11] Crear `src/components/LineBalancePanel.js` con tabla por centro de trabajo, utilización vs. capacidad nominal, carga proyectada y resaltado de cuellos de botella
- [X] T081 [US11] Añadir un escenario determinista de cuello de botella en `src/data/fixtures/routings.js` y `src/data/fixtures/work-centers.js`
- [X] T082 [US11] Integrar `LineBalancePanel` en una vista/ruta de `src/manufacturing-main.js` y añadir estilos de barras de utilización y cuello de botella en `src/styles/manufacturing.css` (depende de T080)
- [X] T083 [US11] Ejecutar `tests/unit/line-balance.test.js` y `tests/integration/line-balance-panel.test.js`; documentar en `quickstart.md` el flujo de balance de líneas y actualizar AC-37..AC-40 a Verificado en `spec.md`

**Punto de control**: US-11 completamente funcional y comprobable de forma independiente.

---

## Fase 14: Pulido y Preocupaciones Transversales

**Propósito**: Calidad, accesibilidad, rendimiento, documentación y cierre de AC.

- [ ] T084 [P] Documentar y aislar las 12 suites legadas de `001-erp-base-module` que importan `src/storage.js` y `src/module-config.js` inexistentes, ajustando `vitest.config.mjs` o `tests/` según corresponda; deuda heredada no bloqueante para AC-14
- [X] T085 [P] Revisar accesibilidad y consistencia de `src/components/OperatorWorkstationPanel.js`, `src/components/DelayCorrectionDialog.js`, `src/components/SupervisorLinePanel.js`, `src/components/PlantPerformancePanel.js`, `src/components/MaintenancePanel.js`, `src/components/ProductionSchedulingPanel.js` y `src/components/LineBalancePanel.js` (ARIA, foco, `Esc`, mensajes inline)
- [X] T086 [P] Actualizar `quickstart.md` y `contracts/operator-shift.md` con selectores, etiquetas y pasos finales de todas las historias implementadas
- [X] T087 [P] Validar el rendimiento con 500 órdenes, semáforo de supervisión, panel de planta, balance de líneas y cronómetro activo (<100 ms por interacción) usando `src/data/ManufacturingStore.js` y las vistas en `src/components/`
- [X] T088 Ejecutar `npm run lint`, `npm run format:check`, `npm test -- --run` y `npm run build`; documentar en `tasks.md` cualquier fallo preexistente no relacionado con las historias nuevas

> **Nota de gate (2026-11-11, revisada 2026-11-17)**: `npm run lint`, `npm run format:check` y `npm run build` pasan. `npm test -- --run` deja 114 pruebas verdes y 12 suites legadas de `001-erp-base-module` que no cargan por imports inexistentes (`src/storage.js`, `src/module-config.js`); es el fallo preexistente cubierto por T084, ajeno a las historias US-06…US-11. T002 quedó cerrado: jsdom se configura por suite con `JSDOM`; no se requiere cambio en `vitest.config.mjs`. AC-14 se interpreta como “suites del módulo en verde”.
- [X] T089 Actualizar `spec.md` para fijar la versión de snapshot en `erp.manufacturing.v2` de forma consistente y marcar todos los AC implementados como `Implementado`/`Verificado`
- [X] T090 Preparar el guion de demo de 5 minutos (pedido → orden → fechas planificadas → asignación de operario → turno operador → atraso → escalamiento → mantenimiento → validación de cierre → panel de planta → balance de líneas → recarga) en `quickstart.md`

---

## Fase 15: Remediación de análisis (2026-11-11)

**Propósito**: Cerrar los hallazgos del análisis de consistencia entre `spec.md`, `plan.md` y `tasks.md`.

- [X] T091 [P] [US8] Implementar y probar el bloqueo de programación de órdenes nuevas sobre centros de trabajo desactivados (`canScheduleOnWorkCenter`) en `src/domain/order-state-machine.js` y `src/data/ManufacturingStore.js`, con pruebas en `tests/unit/order-state-machine.test.js` y `tests/unit/manufacturing-store.test.js` (AC-20)
- [X] T092 [P] [US11] Implementar las consultas de store `lineBalanceFor(period)`, `lineBalanceForOrder(orderId)` y `capacityForPeriod(period)` en `src/data/ManufacturingStore.js`, con pruebas en `tests/unit/line-balance.test.js` y `tests/unit/manufacturing-store.test.js`, usando capacidad nominal sin `efficiency_factor`
- [X] T093 [P] [US8] Añadir pruebas de verificación de FR-06 (KPIs del panel y utilización por centro, AC-12) y de la calidad derivada desde `quality_inspections` (AC-13) en `tests/unit/` y `tests/integration/`
- [X] T094 [P] [US8] [US9] Añadir pruebas de tiempo para SC-03 (exportación PDF/Excel en menos de 10 s) y SC-04 (toma del ticket urgente más antiguo en menos de 30 s)
- [X] T095 [P] [US8] [US9] Añadir verificación de SC-08: ninguna vista expone rankings individuales y todo detalle por persona lleva la etiqueta *solo contexto operativo — no evaluación de desempeño*
- [X] T096 [P] Configurar ESLint + Prettier (`eslint.config.js`, `.prettierrc.json`) y los scripts `lint`, `format` y `format:check` en `package.json` (Principio I / Quality Standards)

**Punto de control**: hallazgos CRITICAL/HIGH/MEDIUM del análisis cerrados; AC-12/AC-13/AC-20 con cobertura; gate de calidad (lint/format) operativo.

---

## Fase 16: Consolidación de trazabilidad, roles y experiencia de usuario (2026-11-17)

**Propósito**: Cerrar los hallazgos del feedback sobre IDs AC, roles y consistencia sitio–especificación, y mejorar la experiencia navegable con datos de demostración.

- [X] T097 [P] Auditar la tabla de AC de `spec.md`: confirmar 40 IDs únicos, añadir la columna "Historia" y documentar que AC-04..AC-07/AC-20 son US-08 mientras AC-08..AC-14 son la base US-01..US-05/FR-06 (AC-34..AC-36), y AC-37..AC-40 son US-11
- [X] T098 [P] [FR-13] Formalizar en `spec.md` los cuatro roles simulados (Jefa de Planta, Supervisor, Planificador, Operador), la matriz `MODULE_ACCESS` y el panel `RoleAccessPanel`, añadiendo permisos de planta para Supervisor en `src/data/fixtures/plant-performance.js`, `role_permissions`, `contracts/plant-performance.md` y `data-model.md`
- [X] T099 [P] [FR-13] Unificar la etiqueta visible "Operador" en `src/domain/access-control.js`, `src/components/PlantPerformancePanel.js`, `src/components/SupervisorLinePanel.js` y `src/manufacturing-main.js`, conservando "operario" sólo como término de RR.HH. en documentación
- [X] T100 [P] [FR-13] Añadir navegación por hash en `src/manufacturing-main.js` (`#/dashboard`, `#/plant`, etc.), breadcrumb, agrupación de módulos en la barra lateral y respeto de permisos al abrir un módulo por URL (AC-35)
- [X] T101 [P] [FR-13] Crear `src/data/fixtures/dashboard-demo.js` con accesos rápidos por rol, actividad reciente y avisos de demostración; mostrarlos en `src/components/DashboardOverview.js` sin mutar el snapshot (AC-36)
- [X] T102 [P] [FR-13] Añadir transiciones suaves, animación de entrada, estados de foco y `prefers-reduced-motion` en `src/styles/manufacturing.css`
- [X] T103 [P] [FR-13] Añadir `tests/unit/dashboard-demo.test.js` y `tests/integration/dashboard-shell.test.js`, y ejecutar regresión de `tests/integration/plant-scheduling-panels.test.js` y `tests/unit/operations-store.test.js`
- [X] T104 Actualizar `README.md` con roles, módulos, datos simulados, navegación por hash y comandos de validación; T002 cerrado por configuración jsdom por suite; T084 sigue como deuda heredada de 001
- [X] T105 Ajustar `.prettierrc.json` con `endOfLine: "auto"` para validar el formato en checkouts Windows y Unix sin normalizar archivos no relacionados, y volver a ejecutar el gate

**Punto de control**: sin IDs AC duplicados ni cruzados, roles y terminología alineados, navegación profunda y demo visual verificadas, formato validado en ambos sistemas de archivos; T002 está cerrado; T084 permanece como deuda heredada documentada.

---

## Dependencias y Orden de Ejecución

### Dependencias por fase

- **Configuración (Fase 1)**: sin dependencias.
- **Fundacional (Fase 2)**: depende de Fase 1; **BLOQUEA** todas las historias.
- **US-01, US-02, US-03 (Fases 3–5)**: dependen de Fase 2; son verificaciones de la base ya implementada.
- **US-06 (Fase 6)**: depende de Fase 2 y de las operaciones generadas por US-03; usa la ejecución existente de US-04.
- **US-07 (Fase 7)**: depende de Fase 2 y se integra con turnos y atrasos de US-06. El semáforo y la asignación pueden avanzar en paralelo con US-06.
- **US-04 (Fase 8)**: depende de US-06 y US-07 para comprobar la convivencia con `finishOperation` y el semáforo.
- **US-05 (Fase 9)**: depende de Fase 2; no depende de US-06 ni US-07.
- **US-08 (Fase 10)**: depende de Fase 2 y de la lectura de paradas de US-06/US-07; introduce el snapshot `v2`.
- **US-09 (Fase 11)**: depende de Fase 2, consume los tickets escalados por US-07 y extiende el snapshot `v2` de US-08; expone datos de solo lectura para US-08.
- **US-10 (Fase 12)**: depende de Fase 2 y de `production_orders` de US-03; reutiliza el snapshot `v2`.
- **US-11 (Fase 13)**: depende de Fase 2 y de centros/rutas de US-02 y de las órdenes de US-03.
- **Pulido (Fase 14)**: depende de todas las historias deseadas.
- **Remediación (Fase 15)**: depende de Fase 2 y de las historias que toca cada tarea (US-08, US-09, US-11); T096 debe completarse antes de ejecutar el gate de calidad de T088.
- **Consolidación UX (Fase 16)**: depende de Fases 2, 10 y 14; no modifica el snapshot `v2`; actualiza los contratos documentales de roles y preserva la deuda heredada T084.

### Dependencias dentro de cada historia

- Pruebas (si existen) se escriben primero y deben fallar antes de implementar.
- Tipos/fixtures → dominio puro → store → UI → integración → verificación.
- Ninguna historia debe modificar el comportamiento de otra; US-08/US-09 se integran por colecciones y adaptadores de solo lectura.

### Oportunidades de paralelización

- Fase 1: T001, T002 y T003 en paralelo.
- Fase 2: T004, T005, T006 y T007 en paralelo; T008 depende de T005 y T007.
- US-06: T012–T015 (pruebas) y T016, T019, T020 en paralelo; T017–T018 y T021–T023 en secuencia.
- US-07: T025–T027 (pruebas) y T028, T030, T032 en paralelo; T029 depende de T008/T017/T028.
- US-08: T037–T039 (pruebas), T040, T041, T042 y T045 en paralelo; T043–T044 en secuencia; T046→T047/T048.
- US-09: T051–T053 (pruebas), T054, T055 y T058 en paralelo; T056–T057 en secuencia; T062→T063/T064.
- US-10: T068–T070 (pruebas), T071, T072 y T074 en paralelo; T073 en secuencia.
- US-11: T077, T078 y T079 en paralelo; T080→T082; T081 en secuencia por tocar fixtures compartidos.
- Pulido: T084–T087 y T090 en paralelo.
- Remediación: T091–T096 en paralelo; T096 antes del gate de T088.

---

## Ejemplo de Ejecución Paralela

```text
# US-08: pruebas y dominio en paralelo
T037 pruebas unitarias de OEE en tests/unit/plant-performance.test.js
T038 pruebas del store US-08 en tests/unit/manufacturing-store.test.js
T039 prueba de integración del panel en tests/integration/plant-performance-panel.test.js
T040 tipos de umbrales y roles en src/domain/types.js
T041 dominio puro en src/domain/plant-performance.js
T042 fixtures de umbrales/permisos en src/data/fixtures/plant-performance.js
T045 exportador PDF/Excel en src/data/exporters/plant-report.js
```

---

## Estrategia de Implementación

### MVP incremental

US-01 a US-05 ya están implementadas. El primer incremento entregable es **US-06 + US-07 (P1)**: turno del operador y supervisión de línea, que habilitan el flujo de piso completo. Después se añaden US-08 (panel de planta), US-09 (mantenimiento), US-10 (planificación) y US-11 (balance de líneas) como incrementos independientes.

### Entrega por historia

1. Completar Fase 1 y Fase 2 → base lista.
2. US-06 → validar de forma independiente (AC-15..AC-17).
3. US-07 → validar de forma independiente (AC-18..AC-19).
4. US-04 y US-05 → regresión de ejecución, consumo y salida.
5. US-08 → snapshot `v2` y panel de planta (AC-04..AC-07, AC-20).
6. US-09 → mantenimiento (AC-21..AC-27).
7. US-10 → planificación de fechas (AC-28..AC-33).
8. US-11 → balance de líneas.
9. Pulido → accesibilidad, rendimiento, documentación y demo.

### Estrategia de equipo paralelo

Tras la Fase 2, un equipo puede dividir: persona A en US-06/US-07, persona B en US-08, persona C en US-09, persona D en US-10/US-11. US-09 depende del snapshot `v2` introducido por US-08, por lo que US-08 debe completar T043 antes de T056.

---

## Notas

- `[P]` = archivos distintos, sin dependencias.
- La etiqueta `[USx]` mapea la tarea a su historia para trazabilidad.
- Cada historia debe ser completable y comprobable de forma independiente.
- Verificar que las pruebas fallan antes de implementar (constitución, principio II).
- Snapshot `erp.manufacturing.v1` para US-06/US-07; `erp.manufacturing.v2` desde US-08 con migración automática y reutilizado por US-09/US-10/US-11.
- No introducir rankings por operador; los tiempos, asignaciones y atrasos son contexto operacional.
- Los indicadores de mantenimiento se agregan por máquina/centro; no se exponen rankings de técnicos.
- El panel de planta agrega siempre por centro de trabajo y operación, sin rankings individuales.
