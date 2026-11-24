# Tareas: Módulo de Operaciones / Manufactura (ERP)

**Entrada**: Documentos de diseño desde `/specs/002-operations-manufacturing/`
**Prerrequisitos**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [research.md](research.md), [contracts/operator-shift.md](contracts/operator-shift.md), [contracts/maintenance.md](contracts/maintenance.md), [contracts/line-balance.md](contracts/line-balance.md), [contracts/plant-performance.md](contracts/plant-performance.md), [quickstart.md](quickstart.md)
**Stack**: Vanilla JavaScript (ES2022) + Vite 8 + Vitest 4/jsdom — paridad con `001-erp-base-module`
**Convención**: `snake_case` y claves `_id` en datos; `camelCase` en código.

> **Estado de partida (2026-11-03)**: US-01 a US-05 ya están implementadas y verificadas por AC-01..AC-03 y AC-08..AC-14; esos IDs son anclas históricas y `spec.md` añade una columna "Historia" para evitar cruces con AC-04..AC-07/AC-20 de US-08. Este listado cubre los incrementos pendientes **US-06 (Operador de Máquina)**, **US-07 / HU-04 (Supervisor de Línea)**, **US-08 / FR-09 (Panel de desempeño de planta)**, **US-09 / HU-06 (Mantenimiento)**, **US-10 (Planificador)** y **US-11 (Balance de líneas)**, conservando una fase de verificación por cada historia existente para evitar regresiones.
>
> **Snapshot**: US-06/US-07 usan `erp.manufacturing.v1`; US-08 introduce `erp.manufacturing.v2` con migración desde `v1` y US-09/US-10/US-11 reutilizan `v2`. Toda tarea que persiste estado nuevo debe escribir en `v2`.
>
> **Consolidación (2026-11-19)**: T136–T141 cierran los hallazgos del análisis posterior a `/speckit.plan`: fórmula única de capacidad, umbrales sin huecos, días hábiles definidos, AC-46 con cobertura documental y gate actualizado a 161 pruebas en 23 suites.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Historia]**: `US1`–`US11` para tareas de historia; sin etiqueta en configuración, fundacional y pulido
- Rutas de archivo explícitas en cada tarea

---

## Fase 1: Configuración (Infraestructura Compartida)

**Propósito**: Confirmar que el entorno de ejecución y pruebas del módulo está listo.

- [X] T001 [P] Verificar dependencias y scripts de manufactura en `package.json` y `package-lock.json`; ejecutar `npm ci` si `node_modules` no existe
- [X] T002 [P] Confirmar que jsdom se configura por suite con `JSDOM` en las pruebas de integración de manufactura; cerrado en Fase 23 (T142) con `environment: 'jsdom'` global en `vitest.config.mjs`
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

**Objetivo**: Visualizar el semáforo en tiempo real, asignar operadores (`ext_hr_employee_id`), validar cierres de turno (`supervisor_validated = true`) y escalar incidentes a mantenimiento (`escalated_to_maint = true`).

**Prueba Independiente**: el supervisor visualiza el semáforo, asigna un operador a un centro, aprueba un cierre sin atrasos abiertos y escala una parada crítica viendo la máquina pasar a *En fallo* y persistir tras recargar.

### Pruebas para US-07 (escribir primero) ⚠️

- [X] T025 [P] [US7] Añadir pruebas unitarias de derivación del semáforo (`in_operation`, `paused`, `fault`, `changeover`), asignación única de operador por franja (`ext_hr_employee_id`) y reglas de aprobación de cierre en `tests/unit/line-supervision.test.js`
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

**Objetivo**: Consultar la utilización y carga proyectada por centro frente a la capacidad efectiva del período (días hábiles × `capacity_per_day_minutes` × `efficiency_factor`), identificar cuellos críticos (≥ 95%), proponer reasignaciones/secuencias y comparar tiempos estándar para balancear la línea.

**Prueba Independiente**: el Ingeniero de Producción abre el panel, ve la utilización y carga proyectada por centro, identifica el cuello crítico solo al ≥ 95%, solicita una sugerencia y comprueba que la carga se actualiza al cambiar la demanda planificada.

### Pruebas para US-11 (escribir primero) ⚠️

- [X] T077 [P] [US11] Añadir pruebas unitarias de tiempos estándar, carga proyectada, utilización con eficiencia/días hábiles, umbrales y detección de cuello de botella en `tests/unit/line-balance.test.js`
- [X] T078 [P] [US11] Añadir prueba de integración jsdom del panel de balance de líneas (tabla por centro, semáforo, cuello crítico, sugerencias y modal de aceptación) en `tests/integration/plant-scheduling-panels.test.js`

### Implementación para US-11

- [X] T079 [P] [US11] Implementar `src/domain/line-balance.js` con las funciones puras `computeStandardTimes`, `computeProjectedLoad`, `computeUtilization`, `detectBottlenecks` y `buildLineBalanceSuggestions`
- [X] T080 [US11] Crear `src/components/LineBalancePanel.js` con tabla por centro de trabajo, capacidad efectiva, semáforo, sugerencias con botón `Solicitar` y modal de aceptación de solicitud
- [X] T081 [US11] Añadir un escenario determinista de cuello crítico (97%), centro ajustado (79%) y centro normal (29%) en `src/data/fixtures/routings.js` y `src/data/fixtures/work-centers.js`
- [X] T082 [US11] Integrar `LineBalancePanel` en una vista/ruta de `src/manufacturing-main.js` y añadir estilos de barras de utilización, semáforo, tabla de sugerencias y modal en `src/styles/manufacturing.css` (depende de T080)
- [X] T083 [US11] Ejecutar `tests/unit/line-balance.test.js` y `tests/integration/plant-scheduling-panels.test.js`; documentar en `quickstart.md` el flujo de balance de líneas y actualizar AC-37, AC-39 y AC-40 a Verificado en `spec.md` (AC-38 retirado)

**Punto de control**: US-11 completamente funcional y comprobable de forma independiente.

---

## Fase 14: Pulido y Preocupaciones Transversales

**Propósito**: Calidad, accesibilidad, rendimiento, documentación y cierre de AC.

- [X] T084 [P] Documentar y aislar las 12 suites legadas de `001-erp-base-module` que importan `src/storage.js`, `src/app.js` y `src/module-config.js` inexistentes; aisladas en Fase 23 (T142) mediante `test.exclude` en `vitest.config.mjs`, conservando los excludes por defecto
- [X] T085 [P] Revisar accesibilidad y consistencia de `src/components/OperatorWorkstationPanel.js`, `src/components/DelayCorrectionDialog.js`, `src/components/SupervisorLinePanel.js`, `src/components/PlantPerformancePanel.js`, `src/components/MaintenancePanel.js`, `src/components/ProductionSchedulingPanel.js` y `src/components/LineBalancePanel.js` (ARIA, foco, `Esc`, mensajes inline)
- [X] T086 [P] Actualizar `quickstart.md` y `contracts/operator-shift.md` con selectores, etiquetas y pasos finales de todas las historias implementadas
- [X] T087 [P] Validar el rendimiento con 500 órdenes, semáforo de supervisión, panel de planta, balance de líneas y cronómetro activo (<100 ms por interacción) usando `src/data/ManufacturingStore.js` y las vistas en `src/components/`
- [X] T088 Ejecutar el gate de cierre de Fase 14 (`npm run lint`, `npm run format:check`, `npm test -- --run`, `npm run build`) y documentar en `tasks.md` cualquier fallo preexistente no relacionado con las historias nuevas; el gate final tras T096/T110 se registra en T114

> **Nota de gate (2026-11-11, revisada 2026-11-17 y 2026-11-19)**: `npm run lint`, `npm run format:check` y `npm run build` pasan. Históricamente `npm test -- --run` dejaba 12 suites legadas de `001-erp-base-module` que no cargaban por imports inexistentes (`src/storage.js`, `src/app.js`, `src/module-config.js`). T084 quedó cerrado en Fase 23 (T142): esas suites se excluyen en `vitest.config.mjs` sin borrarlas y se conservan los excludes por defecto. T002 quedó cerrado: jsdom se configura globalmente en `vitest.config.mjs` (además del `JSDOM` por suite). AC-14 se interpreta como “suites del módulo en verde”; el gate de Fase 14 se ejecutó antes de T096 y se reejecuta en T110/T114, con cierre actual en T140 y, tras el pulido MVP, en T142–T145.
- [X] T089 Actualizar `spec.md` para fijar la versión de snapshot en `erp.manufacturing.v2` de forma consistente y marcar todos los AC implementados como `Implementado`/`Verificado`
- [X] T090 Preparar el guion de demo de 5 minutos (pedido → orden → fechas planificadas → asignación de operador → turno operador → atraso → escalamiento → mantenimiento → validación de cierre → panel de planta → balance de líneas → recarga) en `quickstart.md`

---

## Fase 15: Remediación de análisis (2026-11-11)

**Propósito**: Cerrar los hallazgos del análisis de consistencia entre `spec.md`, `plan.md` y `tasks.md`.

- [X] T091 [P] [US8] Implementar y probar el bloqueo de programación de órdenes nuevas sobre centros de trabajo desactivados (`canScheduleOnWorkCenter`) en `src/domain/order-state-machine.js` y `src/data/ManufacturingStore.js`, con pruebas en `tests/unit/order-state-machine.test.js` y `tests/unit/manufacturing-store.test.js` (AC-20)
- [X] T092 [P] [US11] Implementar las consultas de store `lineBalanceFor(period)` (con `suggestions`), `lineBalanceForOrder(orderId)` y `capacityForPeriod(period)` en `src/data/ManufacturingStore.js`, con pruebas en `tests/unit/line-balance.test.js` y `tests/unit/operations-store.test.js`, usando capacidad efectiva con días hábiles y `efficiency_factor` (las APIs de solicitudes iniciales se retiraron en T121)
- [X] T093 [P] [US8] Añadir pruebas de verificación de FR-06 (KPIs del panel y utilización por centro, AC-12) y de la calidad derivada desde `quality_inspections` (AC-13) en `tests/unit/` y `tests/integration/`
- [X] T094 [P] [US8] [US9] Añadir pruebas de tiempo para SC-03 (exportación PDF/Excel en menos de 10 s) en `tests/integration/plant-performance-panel.test.js` y SC-04 (toma del ticket urgente más antiguo en menos de 30 s) en `tests/integration/maintenance-panel.test.js`
- [X] T095 [P] [US8] [US9] Añadir verificación de SC-08 en `tests/integration/plant-performance-panel.test.js` y `tests/integration/maintenance-panel.test.js`: ninguna vista expone rankings individuales y todo detalle por persona lleva la etiqueta *solo contexto operativo — no evaluación de desempeño*
- [X] T096 [P] Configurar ESLint + Prettier (`eslint.config.js`, `.prettierrc.json`) y los scripts `lint`, `format` y `format:check` en `package.json` (Principio I / Quality Standards)

**Punto de control**: hallazgos CRITICAL/HIGH/MEDIUM del análisis cerrados; AC-12/AC-13/AC-20 con cobertura; gate de calidad (lint/format) operativo.

---

## Fase 16: Consolidación de trazabilidad, roles y experiencia de usuario (2026-11-17)

**Propósito**: Cerrar los hallazgos del feedback sobre IDs AC, roles y consistencia sitio–especificación, y mejorar la experiencia navegable con datos de demostración.

- [X] T097 [P] Auditar la tabla de AC de `spec.md`: confirmar los IDs únicos (44 asignados históricamente, 43 activos tras retirar AC-38), añadir la columna "Historia" y documentar que AC-04..AC-07/AC-20 son US-08 mientras AC-08..AC-14 son la base US-01..US-05/FR-06 (AC-34..AC-36), y AC-37, AC-39 y AC-40 son US-11
- [X] T098 [P] [FR-13] Formalizar en `spec.md` los cuatro roles simulados (Jefa de Planta, Supervisor, Planificador, Operador), la matriz `MODULE_ACCESS` y el panel `RoleAccessPanel`, añadiendo permisos de planta para Supervisor en `src/data/fixtures/plant-performance.js`, `role_permissions`, `contracts/plant-performance.md` y `data-model.md`
- [X] T099 [P] [FR-13] Unificar la etiqueta visible "Operador" en `src/domain/access-control.js`, `src/components/PlantPerformancePanel.js`, `src/components/SupervisorLinePanel.js` y `src/manufacturing-main.js`, usando "operador" también en los textos de RR.HH. de la documentación
- [X] T100 [P] [FR-13] Añadir navegación por hash en `src/manufacturing-main.js` (`#/dashboard`, `#/plant`, etc.), breadcrumb, agrupación de módulos en la barra lateral y respeto de permisos al abrir un módulo por URL (AC-35)
- [X] T101 [P] [FR-13] Crear `src/data/fixtures/dashboard-demo.js` con actividad reciente y avisos de demostración; mostrarlos en `src/components/DashboardOverview.js` sin mutar el snapshot (AC-36)
- [X] T102 [P] [FR-13] Añadir transiciones suaves, animación de entrada, estados de foco y `prefers-reduced-motion` en `src/styles/manufacturing.css`
- [X] T103 [P] [FR-13] Añadir `tests/unit/dashboard-demo.test.js` y `tests/integration/dashboard-shell.test.js`, y ejecutar regresión de `tests/integration/plant-scheduling-panels.test.js` y `tests/unit/operations-store.test.js`
- [X] T104 Actualizar `README.md` con roles, módulos, datos simulados, navegación por hash y comandos de validación; T002 cerrado por configuración jsdom por suite y T084 cerrado en Fase 23 (T142) al aislar las suites heredadas de 001
- [X] T105 Ajustar `.prettierrc.json` con `endOfLine: "auto"` para validar el formato en checkouts Windows y Unix sin normalizar archivos no relacionados, y volver a ejecutar el gate

**Punto de control**: sin IDs AC duplicados ni cruzados, roles y terminología alineados, navegación profunda y demo visual verificadas, formato validado en ambos sistemas de archivos; T002 y T084 están cerrados (T084 cerrado en Fase 16 – Pulido MVP).

## Fase 17: Usabilidad de captura, tablero y contadores (2026-11-17)

**Propósito**: eliminar la fricción de los campos numéricos, permitir mover órdenes arrastrando en el kanban, impedir acumulados sobre el planificado y quitar la navegación redundante del panel inicial.

- [X] T106 [P] Crear `src/components/numeric-field.js` y migrar los campos de BOM, órdenes, consumo, salida, umbral y contador a texto decimal con punto/coma, dos decimales y errores inline, preservando la validación nativa de listas desplegables (AC-44)
- [X] T107 [P] [FR-03] Añadir drag & drop nativo al tablero de órdenes, validando cada destino con `canTransition` y conservando los botones del detalle como alternativa accesible (AC-42)
- [X] T108 [P] [FR-07] Añadir `validateCumulative`, aplicar el techo `quantity_planned` en `#applyShiftCounter` y evitar que `completeOperation` sobrescriba `quantity_completed` (AC-43)
- [X] T109 [P] [FR-13] Eliminar la sección "Accesos rápidos" de `src/components/DashboardOverview.js`, su fixture en `src/data/fixtures/dashboard-demo.js` y sus estilos en `src/styles/manufacturing.css`; actualizar `quickstart.md` y `tests/integration/dashboard-shell.test.js` (AC-36)
- [X] T110 Añadir pruebas unitarias/de integración y ejecutar `npm test -- --run`, `npm run lint`, `npm run format:check` y `npm run build`

**Punto de control**: la captura directa funciona con coma decimal, el kanban solo acepta transiciones válidas, el acumulado se rechaza sin mutar estado y el panel inicial ya no duplica la navegación lateral.

---

## Fase 18: Corrección de criterios US-11 y consistencia documental (2026-11-18)

**Propósito**: Retirar AC-38, fijar el umbral de cuello crítico en 95%, permitir sugerencias con aceptación de solicitud y alinear spec/plan/contratos/quickstart/tasks con el código y las pruebas.

- [X] T111 [P] [US11] Eliminar AC-38, redefinir AC-39 (capacidad efectiva con días hábiles × `capacity_per_day_minutes` × `efficiency_factor`, cuello solo al ≥ 95%) y AC-40 (sugerencias + aceptación sin mutación) en `spec.md`, `plan.md`, `contracts/line-balance.md`, `quickstart.md`, `research.md`, `data-model.md` y este archivo
- [X] T113 [P] [US11] Ajustar primero las pruebas unitarias/de integración para umbrales 97%/79%/29%, eficiencia del período, sugerencias del mismo `station_type`, confirmación simulada sin registro y no mutación de rutas/órdenes
- [X] T112 [P] [US11] Añadir `buildLineBalanceSuggestions` en `src/domain/line-balance.js` y el panel/modal de sugerencias en `src/components/LineBalancePanel.js` con estilos en `src/styles/manufacturing.css`; las APIs de solicitudes del store se retiraron en T121
- [X] T114 Ejecutar el gate final de Fase 18 (66 pruebas enfocadas en verde; en ese momento `npm test -- --run`: 151 pruebas verdes en 22 suites, con 12 suites heredadas aisladas en T084; `npm run lint`, `npm run format:check` y `npm run build` en verde), documentar la deuda heredada de T084 y marcar AC-37/AC-39/AC-40 como verificados; el gate vigente se registra en T140

**Punto de control**: AC-38 retirado sin pérdida de cobertura, AC-39 y AC-40 verificados, documentación y código alineados, y gate final ejecutado con la deuda heredada documentada y aislada.

---

## Fase 19: Ajuste final de US-11 y sugerencias simuladas (2026-11-18)

**Propósito**: alinear la historia con la página: estados por umbral y alerta superior, reasignaciones solo entre estaciones del mismo tipo y confirmaciones que no registran nada fuera de la vista.

- [X] T119 [P] [US11] Añadir `station_type` a los centros de trabajo y la estación `wc_solda_2` en `src/data/fixtures/work-centers.js`; documentar el campo en `data-model.md`
- [X] T120 [P] [US11] Restringir `buildLineBalanceSuggestions` a destinos del mismo `station_type`, usar nombres de estación/número de orden en la etiqueta y conservar la sugerencia de secuencia cuando no haya destino válido en `src/domain/line-balance.js`
- [X] T121 [P] [US11] Eliminar `lineBalanceRequestsFor` y `acceptLineBalanceSuggestion` del store; cambiar el badge a `Solicitud simulada` y mantener la confirmación solo en el estado local de `LineBalancePanel.js`
- [X] T122 [P] [US11] Actualizar `spec.md`, `plan.md`, `research.md`, `contracts/line-balance.md`, `quickstart.md` y este archivo con la alerta ≥ 95 %, el mensaje de línea balanceada y el ejemplo Soldadura 1 → Soldadura 2
- [X] T123 Ajustar `tests/unit/line-balance.test.js` y `tests/integration/plant-scheduling-panels.test.js`, verificar en `src/data/ManufacturingStore.js` y `src/components/LineBalancePanel.js` que no queden APIs ni registros de solicitudes de balance, y ejecutar el gate de calidad

**Punto de control**: la página y la especificación coinciden en colores/umbrales, la reasignación demo usa dos estaciones de soldadura y aceptar una propuesta no produce registro, persistencia ni mutación.

---

## Fase 20: Marco de navegación, roles efectivos y sistema visual (2026-11-17, renumerada 2026-11-18)

**Propósito**: separar el rol real del efectivo, convertir la barra lateral en un drawer accesible en pantallas angostas y unificar la estética del módulo con tipografía, tokens y tablas legibles.

- [X] T127 [P] Separar `realRole` y `role` efectivo en `src/manufacturing-main.js`, restringir «Ver como» y «Entrar como…» a la Jefa de Planta y mostrar «Viendo como: <rol>» en la barra superior
- [X] T128 [P] Redirigir el logo (`aria-label="Ir al inicio"`) al módulo de inicio del rol efectivo y mover «Cerrar sesión» al menú de usuario con avatar de iniciales, operable con teclado
- [X] T129 [P] Crear `src/components/icons.js` con iconos SVG inline (`currentColor`, `aria-hidden="true"`) para los módulos y controles, y mostrarlos en la barra lateral
- [X] T130 [P] Reemplazar la barra lateral comprimida por un drawer bajo 900 px con hamburguesa (`aria-expanded`/`aria-controls`), fondo oscurecido, cierre con Escape/clic fuera y devolución del foco
- [X] T131 [P] Compactar el contexto por rol en `src/components/DashboardOverview.js`, subir «Situación actual» y traducir etiquetas y prioridades con `PRIORITY_LABEL` en `src/components/format.js`
- [X] T132 [P] Instalar `@fontsource-variable/inter`, importarlo en `src/manufacturing-main.js`, definir tokens de superficies/estados en `src/styles/manufacturing.css`, mejorar contraste de advertencia y aplicar encabezado fijo, scroll y alineación numérica en tablas
- [X] T133 [P] Añadir monograma, nombre del módulo, botón accesible de contraseña y estado de carga de 400 ms en `renderLogin`, sin mostrar credenciales ni pistas de roles
- [X] T134 Actualizar `README.md` y las pruebas de integración de login y panel; ejecutar `npm test -- --run`, `npm run lint` y `npm run format:check`

**Punto de control**: el login determina el rol real, solo la Jefa de Planta puede cambiar el rol efectivo, el drawer y el menú son accesibles y el sistema visual usa tokens, tipografía Inter y tablas legibles; T084 se cierra en Fase 16 – Pulido MVP.

---

## Fase 21: Popover de órdenes por centro (2026-11-18)

**Propósito**: sustituir la sección “Órdenes por centro” por una ventana compacta que se abre al activar una fila de “Carga por centro”, sin perder órdenes, carga ni participación.

- [X] T135 [US11] Añadir un popover compacto, centrado sobre la sección “Carga por centro” y accesible por estación en `src/components/LineBalancePanel.js` con estilos en `src/styles/manufacturing.css`, eliminar la sección “Órdenes por centro”, actualizar la integración en `tests/integration/plant-scheduling-panels.test.js` y alinear AC-45 en `spec.md`, `plan.md`, `contracts/line-balance.md`, `quickstart.md`, `checklists/requirements.md` y este archivo

**Punto de control**: al hacer clic o pulsar Enter/Espacio sobre una fila de “Carga por centro” se abre el detalle compacto de órdenes; no existe la sección eliminada y las pruebas y documentación US-11 reflejan el nuevo comportamiento.

---

## Fase 22: Consolidación de fórmulas, umbrales y AC-46 (2026-11-19)

**Propósito**: cerrar los hallazgos C1/I1/I2/A1/U1/U2/I3/I4/D1/U3 del análisis de consistencia y dejar trazabilidad completa de FR-06/AC-46 en el plan, contratos y tareas.

- [X] T136 [P] [US11] Crear `src/domain/capacity.js` con `round2`, `businessDaysInPeriod`, `efficiencyFactorOf`, `effectiveDailyCapacity`, `capacityFor` y `loadRatio`; delegar la capacidad desde `src/domain/operation-planning.js`, `src/domain/line-balance.js`, `src/domain/plant-performance.js` y `src/data/ManufacturingStore.js`, con pruebas en `tests/unit/capacity.test.js`, `tests/unit/line-balance.test.js` y `tests/unit/plant-performance.test.js` (D-30/I1/I2/D1)
- [X] T137 [P] [US11] Fijar días hábiles lunes a viernes sin feriados y umbrales continuos `normal [0, 0.75)`, `tight [0.75, 0.95)` y `bottleneck [0.95, ∞)` en `src/domain/line-balance.js`, `spec.md`, `data-model.md`, `contracts/line-balance.md`, `plan.md`, `quickstart.md` y `tests/unit/line-balance.test.js` (A1/U1)
- [X] T138 [US11] Implementar AC-46: `dailyUtilizationByWorkCenter()` en `src/data/ManufacturingStore.js`, ventana de operaciones pendientes en `src/components/DashboardOverview.js`, título con días hábiles y columna “Utilización del día” con `utilizationCell` compartida en `src/components/LineBalancePanel.js`, estilos en `src/styles/manufacturing.css` y pruebas en `tests/integration/plant-scheduling-panels.test.js` (C1/U2)
- [X] T139 [P] [US11] Actualizar `research.md` D-30/D-31/D-32, `contracts/plant-performance.md` §9, `plan.md` (alcance, fórmula, umbrales, contratos de UI, trazabilidad) y este archivo para documentar AC-46/FR-06 y corregir `AC-01…AC-44` → `AC-01…AC-46` (C1/I3/FR-06)
- [X] T140 Ejecutar el gate completo (`npx vitest run`, `npm run lint`, `npm run format:check`, `npm run build`) y actualizar la nota de gate a 161 pruebas verdes en 23 suites (I4)
- [X] T141 [P] Documentar en `tasks.md` que T115–T118 y T124–T126 fueron IDs retirados durante la consolidación de Fases 18/19, sin trabajo pendiente asociado (U3)

**Punto de control**: fórmula de capacidad y umbrales alineados en spec/plan/contratos/código; AC-46 con cobertura en tareas, documentación y pruebas; gate vigente en 161/23 y huecos de IDs explicados.

---
## Fase 23: Pulido MVP (2026-11-19)

**Propósito**: cerrar la deuda heredada de pruebas, unificar terminología, blindar el render HTML y sustituir los diálogos nativos antes de la entrega del MVP. Las fases históricas no se renombran y los IDs T142–T145 continúan la secuencia existente (T141 es el último asignado).

- [X] T142 [P] Excluir en `vitest.config.mjs` las suites legadas de `001-erp-base-module` que importan `src/storage.js`, `src/app.js` o `src/module-config.js` (localizar los imports bajo `tests/` y añadir sus patrones a `test.exclude`), configurar `test.environment = 'jsdom'` de forma global, verificar `npm test -- --run` sin esas suites y cerrar T084 y T002 en `specs/002-operations-manufacturing/tasks.md`
- [X] T143 [P] Unificar la terminología como "operador"/"operadores" en `specs/002-operations-manufacturing/spec.md`, `specs/002-operations-manufacturing/tasks.md`, `specs/002-operations-manufacturing/data-model.md` y en los comentarios de `src/**/*.js` (sin cambiar identificadores, claves ni contratos de datos), y renombrar el campo `name` de `package.json` a `erp-manufactura-grupo15`
- [X] T144 [P] Auditar los `innerHTML` y las plantillas de `src/components/*.js` y aplicar `escapeHtml` de `src/components/format.js` a todo texto interpolado que proceda de datos (fixtures, store o entrada del usuario), conservando sin escapar únicamente el marcado generado por el propio componente
- [X] T145 Crear un `ConfirmDialog` accesible en `src/components/ConfirmDialog.js` (`role="dialog"`, `aria-modal="true"`, foco inicial, cierre con `Esc`, devolución del foco y acciones Confirmar/Cancelar) y reemplazar todos los `window.confirm`/`window.alert` de `src/components/BomExplorer.js` y `src/components/MaintenancePanel.js` por ese diálogo, conservando mensajes, flujos y resultados

**Punto de control**: `npm test -- --run` sin suites legadas de 001, terminología y nombre de paquete unificados, texto derivado de datos escapado en `src/components/` y sin `window.confirm`/`window.alert` en `BomExplorer.js` ni `MaintenancePanel.js`.

---

## Fase 24: Pulido visual y funcional para la demo (2026-11-22)

**Propósito**: cerrar el pulido visual y funcional de la demo sin cambiar las reglas de negocio: tablas y tarjetas legibles, kanban y mantenimiento sin desbordes, panel de planta con gráficos propios, nombres en lugar de IDs, fechas relativas, reinicio de datos y avisos accesibles. Los IDs T146–T159 continúan la secuencia de T145.

- [X] T146 [P] Añadir en `src/components/format.js` los helpers `formatLocalDate`, `formatLocalDateTime` y `formatDurationLong`, usando `Intl.DateTimeFormat('es-CL', ...)` para fechas y el formato `X d Y h Z min` para duraciones largas, sin librerías externas
- [X] T147 [P] Reestructurar `src/components/OperatorWorkstationPanel.js` para envolver la tabla de atrasos en un contenedor con scroll horizontal interno, compactar columnas, mostrar fechas con `formatLocalDate`, agrupar las acciones de atraso en una sola fila de botones con clases consistentes y redistribuir la tarjeta "Contadores" en dos columnas con jerarquía clara entre turno y acumulado
- [X] T148 [P] Añadir en `src/components/ProductionOrders.js` un buscador por número de orden/producto y un filtro por prioridad que se apliquen a las columnas del kanban; envolver cantidades y chips en `white-space: nowrap`, dar ancho mínimo a cada columna, adaptar el encabezado para que "Nueva Orden" no se desborde en móvil y conservar el drag & drop con transiciones válidas (AC-42)
- [X] T149 [P] Ajustar `src/components/MaintenancePanel.js` para mostrar códigos y fechas sin corte (`white-space: nowrap` y fecha corta con `formatLocalDate`), listar todos los tickets de la bandeja sin `max-height` ni recorte de filas, dejar un único botón "Programar preventiva" por contexto y conservar filtros, toma de intervención y resolución (AC-21–AC-24)
- [X] T150 [P] Replantear `src/components/PlantPerformancePanel.js` para reutilizar las clases `.kpi-card` del panel, dibujar barras CSS/SVG de carga y OEE por centro y de paradas por motivo con etiquetas accesibles (`role="img"`/`aria-label`) y sin librerías de gráficos, manteniendo los cálculos derivados vigentes (AC-04)
- [X] T151 [P] Ajustar `src/components/SupervisorLinePanel.js` para que los controles de prioridad usen el tamaño normal, "Escalar incidente" sea un botón secundario salvo en centros *En fallo* (donde conserva el estilo de peligro) y la selección de operador use el estilo único de `<select>`
- [X] T152 Sustituir en `src/components/*.js` y `src/manufacturing-main.js` todo texto visible "operations" por "operaciones", sin renombrar identificadores, claves, rutas ni contratos de datos
- [X] T153 Crear `src/components/labels.js` con resolvers de nombres legibles y usarlos en `src/components/MaintenancePanel.js`, `src/components/ProductionOrders.js`, `src/components/SupervisorLinePanel.js` y `src/components/OperatorWorkstationPanel.js`: operación como `Operación <secuencia> · <centro>`, técnico desde `src/data/fixtures/hr-employees.js`, evento de parada desde motivo/centro y pedido de venta desde `src/data/fixtures/master-data.js`; conservar los IDs en `title`/datos para auditoría
- [X] T154 [P] Crear `src/data/fixtures/demo-dates.js` con helpers relativos a hoy y actualizar `src/data/fixtures/production-orders.js`, `src/data/fixtures/production-shifts.js`, `src/data/fixtures/maintenance-tickets.js`, `src/data/fixtures/preventive-maintenance-orders.js`, `src/data/fixtures/master-data.js`, `src/data/fixtures/plant-performance.js` y `src/data/fixtures/shift-assignments.js` para que todas las marcas sean relativas a la fecha actual y las duraciones largas se muestren con `formatDurationLong` en estación, mantenimiento y planta
- [X] T155 Añadir `createFixtureSnapshot` y `resetDemoSnapshot` en `src/data/persistence.js`, exponer `resetDemoData` en `src/data/ManufacturingStore.js` reconstruyendo todas las colecciones desde `src/data/fixtures/` y guardando `erp.manufacturing.v2`, y agregar en `src/manufacturing-main.js` la opción "Reiniciar datos de demo" al menú de usuario solo cuando `realRole === 'plant_manager'`, usando `confirmDialog` de `src/components/ConfirmDialog.js` y recargando la vista tras confirmar
- [X] T156 [P] Crear `src/components/Toast.js` con `showToast(message, { tone })`, un contenedor `role="status" aria-live="polite"`, auto-ocultado y cierre manual, y montarlo desde `src/manufacturing-main.js` sin reemplazar los diálogos de error existentes
- [X] T157 Invocar `showToast` en `src/components/OperatorWorkstationPanel.js` al guardar contadores y atrasos, en `src/components/ProductionSchedulingPanel.js` al guardar fechas, en `src/components/PlantPerformancePanel.js` al guardar umbral/prioridad, en `src/components/SupervisorLinePanel.js` al asignar y escalar, en `src/components/MaintenancePanel.js` al tomar y resolver tickets y en `src/components/ProductionOrders.js` al cambiar el estado de una orden
- [X] T158 Unificar en `src/styles/manufacturing.css` los estilos de Fase 24: scroll y columnas compactas de atrasos, tarjeta de contadores, ancho mínimo/scroll del kanban y botón "Nueva Orden" adaptable, filas completas de mantenimiento, tarjetas KPI y barras de planta, un único estilo para todos los `<select>`, controles de prioridad de tamaño normal, botón de escalamiento secundario/peligro según estado y toast accesible, con ajustes móviles sin librerías externas
- [X] T159 Ejecutar `npm test -- --run`, `npm run lint`, `npm run format:check` y `npm run build` sobre `src/components/`, `src/data/` y `src/styles/manufacturing.css`; verificar en el navegador estación, kanban, mantenimiento, planta, menú de Jefa de Planta y toasts sin desbordes a 375 px

**Punto de control**: la demo se ve sin desbordes ni IDs crudos, las fechas son relativas y legibles, el reinicio de datos está restringido a la Jefa de Planta con confirmación, las acciones clave confirman visualmente con `aria-live` y el gate de calidad sigue en verde.

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
- **Remediación (Fase 15)**: depende de Fase 2 y de las historias que toca cada tarea (US-08, US-09, US-11); T096 configura el gate de calidad que T088 ya había ejecutado en Fase 14 y que se reejecuta en T110/T114.
- **Consolidación UX (Fase 16)**: depende de Fases 2, 10 y 14; no modifica el snapshot `v2`; actualiza los contratos documentales de roles y la deuda heredada T084 se cierra en la Fase 23 – Pulido MVP.
- **Usabilidad (Fase 17)**: depende de Fases 2, 3, 6 y 16; reutiliza la máquina de estados y el store sin introducir campos nuevos ni cambiar el snapshot `v2`.
- **Corrección US-11 (Fase 18)**: depende de Fases 2, 13 y 16; no cambia el snapshot `v2`.
- **Ajuste final US-11 (Fase 19)**: depende de la corrección US-11; no registra solicitudes y mantiene el snapshot `v2` intacto.
- **Marco visual y roles (Fase 20)**: depende de Fases 2 y 16; renumera el antiguo bloque duplicado sin cambiar el snapshot `v2`.
- **Popover de órdenes por centro (Fase 21)**: depende de Fases 2 y 19; reutiliza el balance derivado sin cambiar el snapshot `v2`.
- **Consolidación de fórmulas/AC-46 (Fase 22)**: depende de Fases 2, 13, 19 y 21; no cambia el snapshot `v2` y cierra hallazgos documentales y de cálculo sin reabrir otras historias.
- **Pulido MVP (Fase 23)**: depende de Fases 14 y 22; no cambia el snapshot `v2`; cierra la deuda heredada T084 y T002.
- **Pulido visual y funcional para la demo (Fase 24)**: depende de Fases 14, 22 y 23; no introduce dependencias externas ni cambia el snapshot `v2`, salvo el restablecimiento controlado desde fixtures para la Jefa de Planta.

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
- Remediación: T091–T096 en paralelo; T096 antes de los gates finales T110/T114, no del gate histórico T088.
- Corrección US-11: T111 y T113 en paralelo; T113 es anterior a T112 para cumplir el principio de pruebas primero; T114 depende de T111, T112 y T113.
- Ajuste final US-11: T119–T122 en paralelo; T123 cierra el gate y verifica la ausencia de APIs de solicitudes.
- Marco visual y roles: T127–T129 y T131–T133 en paralelo; T130 depende de T128; T134 cierra con pruebas y calidad.
- Popover de órdenes por centro: T135 integra UI, estilos, pruebas y documentación en una sola entrega cerrada.
- Consolidación AC-46: T136, T137, T139 y T141 en paralelo; T138 integra store, panel inicial, balance y pruebas; T140 cierra el gate tras T136–T139.

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
10. Consolidación AC-46 → capacidad compartida, umbrales continuos, días hábiles y trazabilidad documental cerrada.

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
- AC-46 comparte FR-06 y US-11: la utilización diaria se calcula una sola vez y se consume tanto en el Panel de Producción como en “Carga por centro”.
- T115–T118 y T124–T126 son IDs retirados durante la consolidación de Fases 18/19; no representan trabajo pendiente.

---

## Fase 25: Historia de Usuario US-12 - Sistema Multi-Rol (Prioridad: P1)

**Objetivo**: incorporar el quinto rol `maintenance`, cinco tablas de usuarios persistidas en `erp.manufacturing.v2`, `RoleAdminPanel.js`, un selector superior filtrado y privacidad por rol, sin duplicar selectores ni cambiar rutas existentes.

**Prueba Independiente**: iniciar sesión con `jefa/jefa`, `supervisor/supervisor`, `planificador/planificador`, `operador/operador` y `mantenimiento/mantenimiento`; `test/test` ve cinco roles, `doble/doble` solo `operator`/`maintenance`, `usuario` falla; dar de alta un usuario en `#/admin-roles` y verificar que tras logout/login aparece en el selector superior y en `#/roles`.

### Pruebas para US-12

- [X] T160 [P] [US12] Crear `tests/unit/role-access.test.js` con casos fallidos para `CANONICAL_ROLES`, `rolesForUsername`, `modulesForRoles`, `isModuleAllowedForRoles`, `visibleEmployeeNamesFor`, `visibleTechnicianNamesFor` y `roleLabel`, incluyendo `test` en cinco roles, `doble` en dos y cuenta con un solo rol sin selector.
- [X] T161 [P] [US12] Ampliar `tests/unit/access-control.test.js` con casos fallidos para `maintenance`, supervisor sin `orders`, operator exactamente `['operator', 'scheduling', 'roles']`, maintenance exactamente `['maintenance', 'scheduling']` e IDs de ruta inalterados.
- [X] T162 [P] [US12] Ampliar `tests/integration/login-shell.test.js` con login de las cinco cuentas canónicas, `test` y `doble`, rechazo de `usuario`, persistencia tras logout/recarga y existencia de un único `<select data-role="role-select">` en `src/manufacturing-main.js`.
- [X] T163 [P] [US12] Crear `tests/integration/role-admin-panel.test.js` con alta de usuario y asignación de roles en `#/admin-roles`, acceso exclusivo de `plant_manager`, persistencia en `src/data/fixtures/demo-accounts.js` y aparición de nuevos roles en el menú superior y `#/roles` tras logout/login.

### Implementación para US-12

- [X] T164 [US12] Crear `src/domain/role-access.js` con `CANONICAL_ROLES`, `rolesForUsername(roleUsers, username)`, `modulesForRoles(roles)`, `isModuleAllowedForRoles(roles, moduleId)`, `visibleEmployeeNamesFor(role)`, `visibleTechnicianNamesFor(role)` y `roleLabel(role)` (depende de T160).
- [X] T165 [US12] Extender `src/domain/access-control.js` con `maintenance` en `USER_ROLES`, `ROLE_ORDER`, `ROLE_LABELS`, `ROLE_DESCRIPTIONS`, `ROLE_HOME_MODULE`, `MODULE_GROUPS` y `MODULE_ACCESS`, quitando `orders` a supervisor y aplicando los listados exactos de operator y maintenance (depende de T161).
- [X] T166 [US12] Extender `src/data/fixtures/demo-accounts.js` con `role_users_plant_manager`, `role_users_supervisor`, `role_users_planner`, `role_users_operator` y `role_users_maintenance`, credenciales `jefa/jefa`, `supervisor/supervisor`, `planificador/planificador`, `operador/operador`, `mantenimiento/mantenimiento`, `test/test` en las cinco tablas y `doble/doble` en operator y maintenance (depende de T162).
- [X] T167 [US12] Extender `src/data/persistence.js` para validar, hidratar con arreglos vacíos y serializar en `erp.manufacturing.v2` las cinco colecciones de `src/data/fixtures/demo-accounts.js`, sin invalidar snapshots existentes (depende de T166).
- [X] T168 [US12] Extender `src/data/ManufacturingStore.js` con `roleUsersFor`, `rolesForUsername`, `addRoleUser`, `assignRoleToUser` y restauración de las cinco tablas en `resetDemoData()`, emitiendo `change` y persistiendo cada mutación (depende de T167).
- [X] T169 [US12] Crear `src/components/RoleAdminPanel.js` para reemplazar `adminRolesView()` en `#/admin-roles`, mostrando las cinco tablas, altas y asignaciones de roles con `showToast` de `src/components/Toast.js` y confirmación de `src/components/ConfirmDialog.js` cuando corresponda (depende de T163 y T168).
- [X] T170 [US12] Integrar en `src/manufacturing-main.js` la resolución de roles desde `src/domain/role-access.js`, el selector superior único con `rolesForUsername(username).length > 1`, la navegación filtrada por `MODULE_ACCESS`, el rechazo de URLs no permitidas y el retorno al login al cerrar sesión o recargar (depende de T164, T165, T168 y T169).
- [X] T171 [US12] Añadir en `src/styles/manufacturing.css` los estilos del selector superior, las cinco tablas de `src/components/RoleAdminPanel.js`, las insignias de rol y el estado oculto del selector con un solo rol, sin librerías externas (depende de T169 y T170).
- [X] T172 [US12] Ejecutar `npm test -- --run tests/unit/role-access.test.js tests/unit/access-control.test.js tests/integration/login-shell.test.js tests/integration/role-admin-panel.test.js` y `npm run lint` sobre `src/`; verificar en `src/manufacturing-main.js` que no exista otro selector de rol y que los IDs de ruta de FR-18 permanezcan intactos.

**Punto de control**: US-12 es comprobable de forma aislada; los cinco roles, sus cuentas y `MODULE_ACCESS` sobreviven a logout/login y `#/admin-roles` solo es accesible para jefa.

---

## Fase 26: Historia de Usuario US-13 - Calendario Mensual por Rol (Prioridad: P2)

**Objetivo**: reestructurar `#/scheduling` como Calendario Mensual con Modo Selección de Horario de 08:00 a 16:00, bandeja de urgencia crítica, menú diario por tarea y vistas específicas por rol, sin librerías externas.

**Prueba Independiente**: como `planificador`, abrir `#/scheduling` en el mes actual, arrastrar desde un día hasta otro, soltar y guardar el rango con horas `08:00`/`16:00` editables; cancelar con clic derecho sin popup; como `supervisor`, abrir el menú de un día, elegir una tarea, volver a la lista y confirmar que no hay inputs ni botones de guardar.

### Pruebas para US-13

- [X] T173 [P] [US13] Crear `tests/unit/calendar-scheduling.test.js` con casos fallidos para `buildCalendarRange`, `calendarEventsForMonth`, `filterCalendarEvents`, `sortPendingOrders`, `canEditOrderSchedule` y `canViewOrderDetails`, incluyendo filtro `"Ambos"` por defecto y orden por `is_critical_urgent`/prioridad.
- [X] T174 [P] [US13] Ampliar `tests/unit/order-scheduling.test.js` con validación fallida de `scheduled_start_time`/`scheduled_end_time` en formato `HH:mm`, error `hora_invalida`, error `rango_horario_invertido` y conservación de errores `fecha_invalida`/`rango_invertido`.
- [X] T175 [P] [US13] Ampliar `tests/integration/plant-scheduling-panels.test.js` con casos fallidos de mes actual, memoria del mes entre pestañas, filtros, bandeja solo para planner/jefa, foco, arrastre con `.calendar-day--drag-range`, `contextmenu` cancelado y menú diario por tarea.
- [X] T176 [P] [US13] Crear `tests/integration/calendar-event-dialog.test.js` con casos fallidos para “Volver a la lista del día”, detalle de orden/mantención, ausencia de inputs para supervisor y solo lectura para operator.

### Implementación para US-13

- [X] T177 [US13] Crear `src/domain/calendar-scheduling.js` con las funciones de `tests/unit/calendar-scheduling.test.js`, unificando órdenes y mantenimientos programados sin duplicar preventivas con `source_ticket_id` (depende de T173).
- [X] T178 [US13] Extender `src/domain/order-scheduling.js` para que `validatePlannedDates` acepte y valide `scheduled_start_time`/`scheduled_end_time` con valores por defecto `08:00`/`16:00` y `end > start` (depende de T174).
- [X] T179 [US13] Extender `src/data/ManufacturingStore.js` con `pendingSchedulingOrders()`, `calendarEventsForMonth(month)`, `scheduleOrderRange(orderId, payload)`, `setOrderPriority(orderId, priority)` y `setCriticalUrgent(orderId, flag)`, restringiendo las dos últimas a `plant_manager` y emitiendo `change` (depende de T177 y T178).
- [X] T180 [US13] Extender `src/data/persistence.js` con valores por defecto `is_critical_urgent: false`, `scheduled_start_time: '08:00'`, `scheduled_end_time: '16:00'` y fechas programadas de tickets/preventivas al hidratar `erp.manufacturing.v2` (depende de T179).
- [X] T181 [US13] Extender `src/components/ProductionSchedulingPanel.js` con grid CSS mensual de `.calendar-day`, filtro superior `"Ambos" | "Solo Órdenes de Trabajo" | "Solo Mantenciones"`, bandeja “Pendiente de horario” con `% de avance` y controles de prioridad/urgencia crítica solo para `plant_manager` (depende de T175 y T179).
- [X] T182 [US13] Extender `src/components/ProductionSchedulingPanel.js` con el Modo Selección de Horario: clic izquierdo simple en la bandeja aplica `.scheduling-focus-backdrop` y `.scheduling-floating-card` siguiendo el cursor, aviso de clic derecho bajo la cuadrícula, arrastre con `mousedown`/`mouseenter`/`mouseover`, `mouseup` con popup `08:00`/`16:00` editables y `contextmenu` con `preventDefault()` sin popup (depende de T181).
- [X] T183 [US13] Crear `src/components/calendar/CalendarEventDialog.js` con detalle de orden o mantención, botón “Volver a la lista del día”, acciones por rol y uso de `src/components/format.js`, `src/components/icons.js` y `src/components/Toast.js` (depende de T176).
- [X] T184 [US13] Integrar `src/components/calendar/CalendarEventDialog.js` en `src/components/ProductionSchedulingPanel.js` para el menú de planner/jefa/supervisor, resumen ejecutivo de jefa, etiqueta SC-08 y alerta de órdenes sin operador para supervisor, y vista de solo lectura para operator sin pestaña “Listado” (depende de T181, T182 y T183).
- [X] T185 [US13] Añadir en `src/styles/manufacturing.css` los estilos del grid mensual, celdas, indicadores por día, bandeja, tarjeta flotante, backdrop, rango de arrastre y diálogo, conservando `data-role="rows"`, `[data-summary]` y `[data-error]` (depende de T184).
- [X] T186 [US13] Ejecutar `npm test -- --run tests/unit/calendar-scheduling.test.js tests/unit/order-scheduling.test.js tests/integration/plant-scheduling-panels.test.js tests/integration/calendar-event-dialog.test.js` y `npm run lint` sobre `src/`; verificar que `vitest.config.mjs` no cambió y que el mes vuelve al actual al cambiar de identidad, logout o recarga.

**Punto de control**: US-13 es comprobable de forma aislada; el calendario respeta roles, el arrastre guarda horas válidas y el menú diario permite volver sin mutar datos.

---

## Fase 27: Historia de Usuario US-14 - Estaciones Derivadas del BOM (Prioridad: P2)

**Objetivo**: derivar estaciones/máquinas desde la receta del BOM con `deriveBomStations`, mostrar “Secuencia <N>” en el detalle diario, concentrar la edición en `SupervisorLinePanel.js` y dejar `ProductionOrders.js` sin controles de dotación.

**Prueba Independiente**: liberar una orden, verificar que `order_stations` se genera de forma idempotente desde la ruta, abrir su detalle diario y confirmar una sola numeración “Secuencia <N>” con cantidad de trabajadores; presionar “Editar estaciones y trabajadores” para abrir `#/supervision` con esa orden y persistir altas/bajas; confirmar que `#/orders` conserva buscador y filtro de prioridad sin esos controles.

### Pruebas para US-14

- [X] T187 [P] [US14] Ampliar `tests/unit/operation-planning.test.js` con casos fallidos para `deriveBomStations(order, { routingOperations, workCenters })`, orden ascendente por secuencia, reutilización de `plannedTimeMinutes` y estación igual a `work_center`.
- [X] T188 [P] [US14] Ampliar `tests/unit/manufacturing-store.test.js` con casos fallidos de `ensureBomStationsForOrder`, `orderStationsFor` y `setOrderStationStaffing`, incluyendo idempotencia por `(production_order_id, work_center_id, sequence)` y persistencia en `src/data/fixtures/production-orders.js`.
- [X] T189 [P] [US14] Ampliar `tests/integration/operations-panels.test.js` con el botón “Editar estaciones y trabajadores” en `src/components/calendar/CalendarEventDialog.js`, la apertura de esa orden en `src/components/SupervisorLinePanel.js` y la ausencia de controles de estaciones/operadores en `src/components/ProductionOrders.js`.

### Implementación para US-14

- [X] T190 [US14] Agregar `deriveBomStations(order, { routingOperations = [], workCenters = [] } = {})` en `src/domain/operation-planning.js`, devolviendo `{ work_center_id, name, sequence, planned_time_minutes }` ordenado por secuencia y sin modificar `src/domain/capacity.js` (depende de T187).
- [X] T191 [US14] Extender `src/data/persistence.js` y `src/data/ManufacturingStore.js` con la colección `order_stations`, `ensureBomStationsForOrder` invocado desde `releaseProductionOrder`, `orderStationsFor` y `setOrderStationStaffing` con `source` `bom_derived`/`manual` (depende de T188).
- [X] T192 [US14] Extender `src/components/calendar/CalendarEventDialog.js` para mostrar cada estación como `Secuencia <N>` con `title` explicativo, nombre resuelto desde `src/components/labels.js` y cantidad de trabajadores, sin doble numeración visual en la misma fila (depende de T183 y T189).
- [X] T193 [US14] Extender `src/components/SupervisorLinePanel.js` con el editor de estaciones/trabajadores de la orden, botón “Editar estaciones y trabajadores”, redirección a `#/supervision`, altas/bajas persistentes vía `setOrderStationStaffing` y confirmación con `src/components/Toast.js` (depende de T191 y T189).
- [X] T194 [US14] Verificar y ajustar `src/components/ProductionOrders.js` para conservar únicamente creación/gestión de órdenes, buscador y filtro de prioridad, eliminando cualquier control de estaciones u operadores introducido por fases anteriores (depende de T189).
- [X] T195 [US14] Añadir en `src/styles/manufacturing.css` los estilos de la etiqueta `Secuencia <N>`, el `title` explicativo, la lista de trabajadores y el editor de `src/components/SupervisorLinePanel.js`, sin duplicar contadores visuales (depende de T192 y T193).
- [X] T196 [US14] Ejecutar `npm test -- --run tests/unit/operation-planning.test.js tests/unit/manufacturing-store.test.js tests/integration/operations-panels.test.js` y `npm run lint` sobre `src/`; verificar que `production_order_operations`, `shift_assignments` y `src/domain/capacity.js` no cambiaron.

**Punto de control**: US-14 es comprobable de forma aislada; las estaciones salen del BOM, la edición vive solo en supervisión y `#/orders` permanece limpio.

---

## Fase 28: Historia de Usuario US-15 - Panel de Mantenimiento en 3 Subpestañas (Prioridad: P2)

**Objetivo**: reorganizar `MaintenancePanel.js` en “Máquinas”, “Tickets” y “Mantenimientos”, programar desde tickets, sincronizar tres bloques buscables con el calendario y resolver con fecha/hora actual en el popup, respetando inmutabilidad y permisos.

**Prueba Independiente**: programar una mantención desde un ticket y verla en “Activos” y en el calendario; dejar vencer una preventiva sin que se cierre sola; abrir una activa como `maintenance`, presionar “Resolver” y confirmar el mensaje exacto con hora actual editable; intentar resolver de nuevo y confirmar solo lectura; eliminar una histórica con `ConfirmDialog.js` y verificar que desaparece de `v2` y del calendario.

### Pruebas para US-15

- [X] T197 [P] [US15] Crear `tests/unit/scheduled-maintenance.test.js` con casos fallidos para `computeCorrectiveDowntime`, `effectiveMaintenanceEnd`, `canResolveScheduledMaintenance`, `canRescheduleMaintenance`, `canEditMaintenanceFrequency` y `buildScheduledMaintenanceFromTicket`.
- [X] T198 [P] [US15] Ampliar `tests/unit/maintenance.test.js` con casos fallidos de parada automática sin ingreso manual, preventiva vencida que no se cierra sola, fecha visible extendida hasta hoy y acortada a la resolución real.
- [X] T199 [P] [US15] Ampliar `tests/integration/maintenance-panel.test.js` con las tres subpestañas exactas, búsqueda por máquina/código en cada bloque, “Revisar históricas” prellenado, programación desde ticket y borrado confirmado.
- [X] T200 [P] [US15] Ampliar `tests/integration/calendar-event-dialog.test.js` con resolución exclusiva de `maintenance`, mensaje exacto “¿Está seguro que quiere resolver esta mantención?”, `datetime-local` prellenado con la hora actual al hacer clic y evento resuelto sin botón.

### Implementación para US-15

- [X] T201 [US15] Extender `src/domain/maintenance.js` con `computeCorrectiveDowntime`, `effectiveMaintenanceEnd`, `canResolveScheduledMaintenance`, `canRescheduleMaintenance`, `canEditMaintenanceFrequency` y `buildScheduledMaintenanceFromTicket`, sin cambiar `resolveMaintenanceTicket` de US-09 (depende de T197 y T198).
- [X] T202 [US15] Extender `src/data/ManufacturingStore.js` con `maintenanceFeed()`, `scheduleMaintenanceFromTicket`, `schedulePreventiveMaintenance`, `setRecommendedMaintenanceFrequency`, `resolveScheduledMaintenance` y `deleteResolvedMaintenance`, pasando ticket a `in_progress` y máquina a `fault` y bloqueando reedición de resueltas (depende de T201).
- [X] T203 [US15] Extender `src/data/persistence.js` con `scheduled_start_date`, `scheduled_end_date` y `recommended_maintenance_frequency_days` al hidratar `erp.manufacturing.v2`, derivando fechas de `planned_date` cuando falten (depende de T202).
- [X] T204 [US15] Reestructurar `src/components/MaintenancePanel.js` en tres subpestañas exactas —“Máquinas”, “Tickets” y “Mantenimientos”— conservando el comportamiento vigente de US-09 hasta que cada subpestaña esté migrada (depende de T199).
- [X] T205 [US15] Implementar en `src/components/MaintenancePanel.js` la subpestaña “Máquinas”: buscador, filtro por sección, alerta de frecuencia vencida o ausente, campo “Cada cuánto se recomienda mantención” solo para `maintenance`/`plant_manager`, badges, historial de fallas, paradas acumuladas, `deriveWearIndicator`, “Programar preventiva” y “Revisar históricas” (depende de T204).
- [X] T206 [US15] Implementar en `src/components/MaintenancePanel.js` la subpestaña “Tickets”: solo tabla sin banner duplicado, panel lateral ni preventivas; “Programar mantención” con técnico/fechas y detalle expandible con historial de fallas, historial completo y nivel Bajo/Medio/Alto con conteo y minutos (depende de T204 y T202).
- [X] T207 [US15] Implementar en `src/components/MaintenancePanel.js` la subpestaña “Mantenimientos” con los bloques exactos “Activos”, “No resueltos por vencimiento” e “Históricos”, buscador propio por máquina/código en cada uno, sincronización con `maintenanceFeed()` y borrado histórico con `src/components/ConfirmDialog.js` (depende de T204 y T202).
- [X] T208 [US15] Extender `src/components/calendar/CalendarEventDialog.js` con “Resolver” solo para `maintenance`, popup con mensaje exacto y `datetime-local` editable prellenado con la hora actual del clic —no la de la celda—, tiempo parado/técnico/prioridad para activas y solo lectura sin botón para resueltas (depende de T200 y T202).
- [X] T209 [US15] Añadir en `src/styles/manufacturing.css` los estilos de las tres subpestañas, alerta de máquinas, badges, filas expandibles, tres bloques, popup de resolución y eventos resueltos de solo lectura, reutilizando `src/components/Toast.js`, `src/components/format.js`, `src/components/labels.js` y `src/components/icons.js` (depende de T205, T206, T207 y T208).
- [X] T210 [US15] Ejecutar `npm test -- --run tests/unit/scheduled-maintenance.test.js tests/unit/maintenance.test.js tests/integration/maintenance-panel.test.js tests/integration/calendar-event-dialog.test.js` y `npm run lint` sobre `src/`; verificar FR-18 en `package.json`, `index.html`, `vitest.config.mjs`, IDs de ruta y mejoras de Fase 24.

**Punto de control**: US-15 es comprobable de forma aislada; el panel y el calendario comparten estado, las fechas son dinámicas, la resolución usa hora real y las mantenciones resueltas son inmutables.

---

## Dependencias y Orden de Ejecución — Fases 25 a 28

- **Fase 25 (US-12)**: sin dependencias nuevas; usa el snapshot `v2` de Fases 8 a 24 y habilita los cinco roles antes de las demás historias.
- **Fase 26 (US-13)**: depende de Fase 25 para el rol `maintenance` y las vistas por rol; consume `production_orders` y `maintenanceFeed()` sin cambiar IDs de ruta.
- **Fase 27 (US-14)**: depende de Fase 26 porque la etiqueta “Secuencia <N>” se muestra en `src/components/calendar/CalendarEventDialog.js`.
- **Fase 28 (US-15)**: depende de Fase 26 para la sincronización con el Calendario Mensual y de Fase 25 para el permiso exclusivo de `maintenance`.
- **Acumulativas**: cada fase se cierra con su propia prueba independiente y no reabre ni modifica Fases 1 a 24, T001–T159 ni `vitest.config.mjs`.

### Oportunidades de paralelización — Fases 25 a 28

- US-12: T160, T161, T162 y T163 en paralelo; T164/T165/T166 después de sus pruebas; T167→T168→T169→T170→T171 en secuencia; T172 cierra el gate.
- US-13: T173, T174, T175 y T176 en paralelo; T177 y T178 en paralelo; T179→T180→T181→T182→T183→T184→T185 en secuencia por compartir archivos; T186 cierra el gate.
- US-14: T187, T188 y T189 en paralelo; T190 y T191 en paralelo; T192→T193→T194→T195 en secuencia; T196 cierra el gate.
- US-15: T197, T198, T199 y T200 en paralelo; T201→T202→T203→T204 en secuencia; T205, T206, T207 y T208 pueden avanzar en paralelo solo tras T204 si se usan worktrees, de lo contrario en secuencia por compartir `MaintenancePanel.js`/`CalendarEventDialog.js`; T209 y T210 cierran estilos y gate.

---

## Ejemplo de Ejecución Paralela — Fases 25 a 28

```text
# US-12: pruebas primero
T160 tests/unit/role-access.test.js
T161 tests/unit/access-control.test.js
T162 tests/integration/login-shell.test.js
T163 tests/integration/role-admin-panel.test.js

# US-13: pruebas primero
T173 tests/unit/calendar-scheduling.test.js
T174 tests/unit/order-scheduling.test.js
T175 tests/integration/plant-scheduling-panels.test.js
T176 tests/integration/calendar-event-dialog.test.js

# US-14: pruebas primero
T187 tests/unit/operation-planning.test.js
T188 tests/unit/manufacturing-store.test.js
T189 tests/integration/operations-panels.test.js

# US-15: pruebas primero
T197 tests/unit/scheduled-maintenance.test.js
T198 tests/unit/maintenance.test.js
T199 tests/integration/maintenance-panel.test.js
T200 tests/integration/calendar-event-dialog.test.js
```

---

## Estrategia de Implementación — Fases 25 a 28

### MVP de la extensión

1. Completar Fase 25 (US-12) y validar login, cinco tablas, selector único y `#/admin-roles`.
2. Detener y verificar que supervisor, operator y maintenance ven exactamente los módulos permitidos.
3. Continuar con Fase 26 solo después de que el rol `maintenance` exista en `MODULE_ACCESS`.

### Entrega acumulativa

1. Fase 25 →identidad y permisos.
2. Fase 26 →calendario y programación horaria.
3. Fase 27 →estaciones derivadas y edición en supervisión.
4. Fase 28 →mantenimiento sincronizado e inmutable.
5. Cada fase conserva Fases 1 a 24 y añade valor sin romper la demo.

### Notas de formato

- T160–T210 son IDs nuevos y consecutivos; no se reutilizan T115–T118 ni T124–T126.
- Todas las tareas nuevas usan `- [ ]`, ID secuencial, marcador `[P]` cuando corresponde, etiqueta `[US12]`–`[US15]` y ruta de archivo explícita.

---

## Fase 29: Pulido de interfaz y roles (2026-11-23)

**Objetivo**: corregir la jerarquía de capas entre encabezados sticky de tablas, barras y ventanas emergentes; dar a la cuadrícula mensual ancho completo, siete columnas proporcionadas, títulos legibles, tope de tres eventos con "+N más" y pestañas "Calendario"/"Listado" del mismo sistema visual que Mantenimiento; y unificar "Datos de roles" como subpestaña "Configurar roles" dentro de "Roles", filtrando tarjetas por usuario autenticado y confirmando el cambio de rol desde tarjeta con `ConfirmDialog.js`.

**Prueba Independiente US-13**: con `ProductionSchedulingPanel` montado en jsdom, verificar que las pestañas usan `role="tab"` con estilo de subpestaña, que la cuadrícula conserva siete columnas a ancho completo, que un día con cinco actividades muestra tres títulos legibles y "+2 más" y que el menú diario enumera las cinco; abrir un modal, un `ConfirmDialog` y un toast sobre una tabla con `thead th` sticky y comprobar que ninguno queda tapado.

**Prueba Independiente US-12**: iniciar sesión con dos cuentas de roles distintos en `login-shell.test.js`, comprobar que la navegación lateral solo ofrece "Roles" (`#/roles`), que la subpestaña "Roles" muestra únicamente las tarjetas asignadas a cada usuario, que presionar otra tarjeta abre `ConfirmDialog` con el mensaje exacto y no cambia el rol al cancelar, y que "Configurar roles" solo se habilita con el rol activo `plant_manager` (también desde `#/admin-roles`).

### Pruebas para Fase 29 (escribir primero) ⚠️

- [X] T211 [P] [US13] Crear `tests/integration/overlay-layering.test.js` con casos fallidos que lean `src/styles/manufacturing.css` y comprueben la escala estricta: `thead th` sticky en `z-index: 1`, barra superior 20 y lateral 30, modo foco 40–60, `.modal-backdrop` 1000, `.modal` 1001, `.confirm-dialog` 1100 y `.toast-region` 1200, además de ausencia de `transform`/`filter`/`perspective`/`will-change` en `.view`, `.content` y `.panel` que atrapen modales.
- [X] T212 [P] [US13] Ampliar `tests/integration/plant-scheduling-panels.test.js` con casos fallidos de pestañas `role="tab"`/`aria-selected` con clases de subpestaña, `.calendar-grid` a ancho completo con siete columnas, títulos legibles en `.calendar-event-chip span`, tope de tres chips por día y botón `.calendar-day__more` "+N más" que abre el menú con todas las actividades.
- [X] T213 [P] [US13] Ampliar `tests/integration/calendar-event-dialog.test.js` con el caso fallido de que el menú diario lista los N eventos completos cuando la celda muestra "+N más" y de que el popup permanece por encima de un encabezado de tabla con `position: sticky`.
- [X] T214 [P] [US12] Ampliar `tests/integration/role-admin-panel.test.js` con casos fallidos de que las cinco tablas, altas y asignaciones de `RoleAdminPanel({ store })` se monten como subpestaña "Configurar roles" dentro de `src/components/RoleAccessPanel.js`, sin botón lateral "Datos de roles" y con acceso solo para `plant_manager`.
- [X] T215 [P] [US12] Ampliar `tests/unit/role-access.test.js` con casos fallidos para `rolesForUsername` sobre `test/test` (cinco tablas), `doble/doble` (dos) y cuenta de un solo rol, y para el nuevo `roleChangeMessage` de `src/domain/role-access.js` con el texto exacto "¿Deseas cambiar tu vista al rol <Nombre del rol>?".
- [X] T216 [P] [US12] Ampliar `tests/integration/login-shell.test.js` con casos fallidos de navegación sin `admin-roles`, de `#/admin-roles` abriendo "Configurar roles" solo con rol activo `plant_manager`, y de tarjeta de rol distinto al activo abriendo `ConfirmDialog` antes de actualizar el selector superior de `src/manufacturing-main.js`.

### Implementación para Fase 29 — US-13 (capas y calendario)

- [X] T217 [US13] Definir en `src/styles/manufacturing.css` la escala de capas: `thead th` con `position: sticky` en `z-index: 1`, barra superior 20 y lateral 30, modo foco 40/41/42, `.modal-backdrop` 1000, `.modal` 1001, `.confirm-dialog` 1100 y `.toast-region` 1200, sin modificar la lógica de los componentes.
- [X] T218 [US13] Eliminar en `src/styles/manufacturing.css` los contextos de apilamiento de `.content > .view`, `.view`, `.content` y `.panel`: retirar `animation: view-enter` y cualquier `transform`, `filter`, `perspective`, `contain: paint` o `will-change` que encierre a los modales por debajo de las tablas, conservando el aspecto visual.
- [X] T219 [US13] Ajustar en `src/styles/manufacturing.css` los niveles de `.modal-backdrop`/`.modal` (1000/1001), `.confirm-dialog`, `.confirm-dialog::backdrop` y `.confirm-dialog--fallback` (1100) y `.toast-region` (1200), sin editar `src/components/ConfirmDialog.js` ni `src/components/Toast.js` (FR-18).
- [X] T220 [US13] Ajustar en `src/styles/manufacturing.css` `.scheduling-focus-backdrop` (40), `.scheduling-floating-card` (41) y `.schedule-popup` (1001) para que el popup horario se resuelva en la capa raíz y no quede bajo encabezados sticky ni sobre un `ConfirmDialog`.
- [X] T221 [US13] Verificar en `src/components/ConfirmDialog.js` que el diálogo sigue montándose en `document.body` con su API intacta y, si el popup de `src/components/calendar/CalendarEventDialog.js` depende de un ancestro con transformación, reubicarlo en el contenedor raíz de `src/manufacturing-main.js` sin cambiar textos ni comportamiento.
- [X] T222 [US13] Modificar `renderCalendar()` en `src/components/ProductionSchedulingPanel.js` para mostrar como máximo tres `.calendar-event-chip` por día y añadir un `.calendar-day__more` con texto "+N más" que abra `renderDayMenu()` con la totalidad de órdenes y mantenciones, conservando `data-event-id`, `title`, el arrastre y el menú por tarea.
- [X] T223 [US13] Modificar `src/components/ProductionSchedulingPanel.js` para que las pestañas "Calendario" y "Listado" usen `role="tab"`, `aria-selected` inicial y las clases alineadas con `.maintenance-tabs__tab`, manteniendo "Listado" oculta para `operator` y sin cambiar el comportamiento de cambio de vista.
- [X] T224 [US13] Ajustar en `src/styles/manufacturing.css` `.calendar-layout`, `.calendar-main` y `.calendar-grid` para ocupar el 100 % del ancho con `repeat(7, minmax(0, 1fr))`, `.calendar-event-chip span` con título legible, altura tope por `.calendar-day` para tres chips más `.calendar-day__more`, y estilos de `.scheduling-tabs`/`.scheduling-tabs__tab` equivalentes a `.maintenance-tabs` sin apariencia de botón nativo.
- [X] T225 [US13] Ejecutar `npm test -- --run tests/integration/overlay-layering.test.js tests/integration/plant-scheduling-panels.test.js tests/integration/calendar-event-dialog.test.js` y `npm run lint` sobre `src/`; verificar en `package.json` y `vitest.config.mjs` que no cambiaron y que el mes visitado sigue volviendo al actual al recargar.

### Implementación para Fase 29 — US-12 (roles)

- [X] T226 [P] [US12] Extender `src/domain/role-access.js` con `roleChangeMessage(role)` que devuelva "¿Deseas cambiar tu vista al rol <Nombre del rol>?" usando `roleLabel`, sin alterar `CANONICAL_ROLES`, `rolesForUsername` ni la matriz de permisos (depende de T215).
- [X] T227 [US12] Reestructurar `src/components/RoleAccessPanel.js` con dos subpestañas `role="tab"`, `aria-selected` y `data-role="role-tab"` para "Roles" y "Configurar roles", usando el mismo lenguaje visual que `.maintenance-tabs` y sin duplicar el selector superior.
- [X] T228 [US12] Modificar `src/components/RoleAccessPanel.js` para recibir `store` y `username`, y mostrar en la subpestaña "Roles" únicamente las tarjetas de `store.rolesForUsername(username)`, conservando nombre, descripción, páginas disponibles y el badge "Rol efectivo" del rol activo (depende de T215 y T227).
- [X] T229 [US12] Modificar `src/components/RoleAccessPanel.js` para invocar `confirmDialog({ message: roleChangeMessage(role) })` de `src/components/ConfirmDialog.js` al presionar una tarjeta de rol distinto al activo, aplicando el cambio solo al confirmar y conservando el rol activo al cancelar o pulsar Escape (depende de T226, T228 y T219).
- [X] T230 [US12] Integrar en `src/components/RoleAccessPanel.js` el contenido de `RoleAdminPanel({ store })` dentro de la subpestaña "Configurar roles", montándolo solo cuando `currentRole === 'plant_manager'` y manteniendo las cinco tablas, altas y asignaciones persistentes en `erp.manufacturing.v2` (depende de T214 y T227).
- [X] T231 [P] [US12] Modificar `src/manufacturing-main.js` para eliminar el módulo lateral `admin-roles` ("Datos de roles"), pasar `store` y `username` a `RoleAccessPanel`, y resolver `#/admin-roles` como entrada directa a `#/roles` con "Configurar roles" activa solo para `plant_manager` (depende de T227 y T230).
- [X] T232 [P] [US12] Modificar `src/domain/access-control.js` para quitar `admin-roles` de `MODULE_GROUPS` y del menú lateral, conservando el identificador en `MODULE_ACCESS` y en la lista de rutas de FR-18 para la denegación por URL (depende de T214).
- [X] T233 [US12] Añadir en `src/styles/manufacturing.css` los estilos de las subpestañas de `src/components/RoleAccessPanel.js`, del badge "Rol efectivo" y del grid de tarjetas filtrado, sin nuevo selector de rol ni dependencias externas (depende de T227).
- [X] T234 [US12] Ejecutar `npm test -- --run tests/unit/role-access.test.js tests/integration/role-admin-panel.test.js tests/integration/login-shell.test.js` y `npm run lint` sobre `src/`; verificar en `src/manufacturing-main.js` y `src/domain/access-control.js` que no queda el botón "Datos de roles" y que los IDs de ruta de FR-18 permanecen intactos.

### Dependencias y paralelización — Fase 29

- Las pruebas T211–T216 son independientes entre sí y deben escribirse primero.
- US-13: T217 → T218 → T219 → T220 → T221 en secuencia por compartir `src/styles/manufacturing.css` y la capa raíz; T222 y T223 pueden avanzar juntos solo si se usan worktrees porque comparten `src/components/ProductionSchedulingPanel.js`; T224 cierra estilos y T225 el gate.
- US-12: T226 es paralelo a US-13 tras T215; T227 → T228 → T229 → T230 en secuencia por compartir `src/components/RoleAccessPanel.js`; T231 y T232 son paralelos entre sí y con T233 una vez cerradas T229/T230; T234 cierra el gate.
- T229 depende de T219 para que `ConfirmDialog` quede por encima de tablas con encabezado sticky; US-12 no reabre Fases 1 a 28 ni modifica T001–T210.

### Ejemplo de Ejecución Paralela — Fase 29

```text
# Pruebas primero
T211 tests/integration/overlay-layering.test.js
T212 tests/integration/plant-scheduling-panels.test.js
T213 tests/integration/calendar-event-dialog.test.js
T214 tests/integration/role-admin-panel.test.js
T215 tests/unit/role-access.test.js
T216 tests/integration/login-shell.test.js

# Implementación paralela tras las pruebas
T226 src/domain/role-access.js
T231 src/manufacturing-main.js   (tras T227 y T230)
T232 src/domain/access-control.js
```

**Punto de control**: la Fase 29 es desplegable por historia; US-13 deja modales siempre visibles y el calendario legible, y US-12 deja un único acceso "Roles" con tarjetas filtradas, cambio confirmado y administración restringida a la Jefa de Planta.

---

## Fase 30: Ampliación de roles, calendario y mantenimiento (2026-11-23)

**Objetivo**: ampliar US-12 con baja confirmada de usuarios por rol y cambio de contraseña propia persistido en `erp.manufacturing.v2`; ampliar US-13 con bandeja horizontal superior, calendario al 100 % del ancho en los cinco roles, modales centrados para menú diario/detalle/horario, hitbox completa de tarjeta y arrastre de rango sin arrastre nativo; y ampliar US-15 con eliminación de filtros globales, layout de dos paneles con encogimiento y deselección, filtro por estado de máquina, mini-calendario informativo con leyenda de colores, Tickets con una sola acción y Mantenimientos en dos listas. Fases 1 a 29 permanecen intactas y los IDs comienzan en T235.

**Prueba Independiente US-12**: con jsdom, montar `RoleAdminPanel({ store })` dentro de `RoleAccessPanel` como `plant_manager`, hacer clic en "Quitar" (×) de un chip, confirmar y comprobar que `store.roleUsersFor(role)` ya no contiene el usuario y que el snapshot `erp.manufacturing.v2` conserva el cambio tras recargar; intentar quitar al último `plant_manager` debe mostrar rechazo sin mutar; abrir "Cambiar contraseña" desde el menú superior, invalidar la contraseña actual y luego cambiarla correctamente, verificando que `authenticate` con las tablas del store acepta la nueva contraseña con cualquier rol asignado.

**Prueba Independiente US-13**: con jsdom y los cinco roles, verificar que `.calendar-layout` es una sola columna, que `.pending-tray` aparece como barra horizontal antes de `.calendar-main` solo para planner y plant_manager, y que `.calendar-main` ocupa el 100 % del ancho; abrir menú diario, detalle de evento y popup de horario y comprobar `.modal-backdrop`/`.modal` centrados con cierre por botón, Escape y clic fuera; en planner, hacer clic en cualquier zona de `.pending-tray__row`, arrastrar desde el día 24 hasta el 28 con `mousedown`/`mouseenter` y soltar con `document.mouseup`, comprobando color en vivo, `draggable="false"`, `preventDefault`, `user-select: none`, capas 40/50/60 y que el modal se abre una sola vez con el rango 24–28.

**Prueba Independiente US-15**: con jsdom, montar `MaintenancePanel({ store })` y comprobar que no existe `.maintenance-filters`, que Máquinas usa dos paneles con el derecho vacío y proporción inicial, que el filtro por estado ofrece exactamente "Todos", "Disponible", "En operación", "En mantención" y "Detenida / En fallo", que al seleccionar una máquina el layout pasa a `0.85fr 1.15fr` y que "Deseleccionar" o un clic fuera (ignorando modales y ‹/›) restauran el estado inicial; validar mini-calendario con Leyenda sin color/rojo/azul/morado y celdas no clickeables, Tickets sin "Resolver"/"Tomar intervención" y Mantenimientos con exactamente dos listas, filtro Vigentes/Vencidos y buscador histórico prellenado desde "Revisar históricas".

### Pruebas para Fase 30 — US-12 (escribir primero) ⚠️

- [X] T235 [P] [US12] Crear `tests/unit/role-user-credentials.test.js` con casos jsdom fallidos para `removeRoleUser` y `changeUserPassword` en `src/data/ManufacturingStore.js`: baja persistida en `erp.manufacturing.v2`, rechazo al quitar el último usuario de `role_users_plant_manager`, contraseña inicial igual al nombre de usuario en altas, actualización en todas las tablas donde aparece el usuario y `authenticate` válido tras reconstruir el store desde el snapshot.
- [X] T236 [P] [US12] Ampliar `tests/integration/role-admin-panel.test.js` con casos jsdom fallidos de botón "Quitar" (×) en los chips de las cinco tablas, apertura de `ConfirmDialog.js`, llamada a `store.removeRoleUser(role, username)`, `showToast`, re-render de tablas y mensaje de rechazo sin mutación para el último `plant_manager`.
- [X] T237 [P] [US12] Ampliar `tests/integration/login-shell.test.js` con casos jsdom fallidos de opción "Cambiar contraseña" visible para cualquier usuario autenticado en `src/manufacturing-main.js`, modal con contraseña actual/nueva/confirmación, errores inline, persistencia en `erp.manufacturing.v2` e ingreso correcto con la nueva contraseña tras logout y recarga.

### Pruebas para Fase 30 — US-13 (escribir primero) ⚠️

- [X] T238 [P] [US13] Ampliar `tests/integration/plant-scheduling-panels.test.js` con casos jsdom fallidos que comprueben en `src/components/ProductionSchedulingPanel.js` que `.calendar-layout` usa una sola columna `minmax(0, 1fr)`, que `.pending-tray` es una barra horizontal compacta anterior a `.calendar-main` y que `.calendar-main` ocupa el 100 % del ancho útil para plant_manager, planner, supervisor, operator y maintenance, con celdas proporcionadas.
- [X] T239 [P] [US13] Ampliar `tests/integration/calendar-event-dialog.test.js` con casos jsdom fallidos de renderizado centrado de menú diario, detalle de evento y popup de horario mediante `.modal-backdrop` y `.modal`, cierre por botón, Escape y clic fuera, y ausencia de markup incrustado bajo `.calendar-grid`.
- [X] T240 [P] [US13] Crear `tests/integration/schedule-drag-selection.test.js` con casos jsdom fallidos de hitbox completa de `.pending-tray__row` en planner, controles `select`/`checkbox` intactos en plant_manager, capas 40/50/60, `draggable="false"` en `.calendar-day`, `preventDefault` en `mousedown`, `user-select: none` en `.calendar-grid`, coloreado inmediato de todo el rango y apertura única del modal con el rango exacto tras `document.mouseup`.
- [X] T241 [P] [US13] Ampliar `tests/integration/overlay-layering.test.js` con aserciones jsdom fallidas sobre `src/styles/manufacturing.css` para `.scheduling-focus-backdrop` 40, bloque del calendario 50 con fondo blanco, `.scheduling-floating-card` 60 y `.modal-backdrop`/`.modal` 1000/1001 aplicados a los tres modales del calendario.

### Pruebas para Fase 30 — US-15 (escribir primero) ⚠️

- [X] T242 [P] [US15] Ampliar `tests/integration/maintenance-panel.test.js` con casos jsdom fallidos de ausencia de `.maintenance-filters`, layout de dos paneles inicialmente vacío, buscador por nombre/código, filtro por sección, filtro por estado con cinco opciones exactas, alerta de frecuencia en la lista, encogimiento a `0.85fr 1.15fr` al seleccionar y restauración mediante "Deseleccionar" (×) y clic fuera sin afectar modales ni navegación ‹/›.
- [X] T243 [P] [US15] Ampliar `tests/integration/maintenance-panel.test.js` con casos jsdom fallidos del mini-calendario mensual de máquina: aparece solo con selección, encabezado con mes y botones ‹/› como única interacción, días L, Ma, Mi, J, V, S, D, celdas sin manejadores de clic ni atributo de botón, y leyenda visible para sin plan, correctiva/fallo (rojo), orden de trabajo (azul) y preventiva (morado).
- [X] T244 [P] [US15] Ampliar `tests/integration/maintenance-panel.test.js` con casos jsdom fallidos de Tickets: tabla con buscador, detalle consolidado desplegable al hacer clic en una fila, ausencia total de "Resolver" y "Tomar intervención" en tabla y detalle, y único botón "Programar mantención" que abre el modal y refleja el ticket en Calendario y Mantenimientos activos.
- [X] T245 [P] [US15] Ampliar `tests/integration/maintenance-panel.test.js` con casos jsdom fallidos de Mantenimientos: exactamente dos bloques buscables, lista activa con filtro "Todos"/"Vigentes"/"Vencidos" y botón "Resolver", lista histórica con "Eliminar" confirmado por `ConfirmDialog.js` y buscador prellenado con el nombre de la máquina al llegar desde "Revisar históricas".
- [X] T246 [P] [US15] Crear `tests/unit/machine-calendar.test.js` con casos fallidos para `src/domain/machine-calendar.js`: generación matricial del mes, clasificación de días sin plan, rojo por ticket correctivo/fallo, azul por orden de trabajo que pasa por la máquina/estación, morado por preventiva planificada y prevalencia determinista cuando coinciden varias fuentes.

### Implementación para Fase 30 — US-12 (roles y credenciales)

- [X] T247 [P] [US12] Añadir `removeRoleUser(role, username)` en `src/data/ManufacturingStore.js` con normalización de usuario, baja en `ROLE_USER_PROPERTIES[role]`, rechazo explícito cuando dejaría `role_users_plant_manager` vacío, `#persist()` en `erp.manufacturing.v2`, `#emit()` y retorno booleano o motivo (depende de T235).
- [X] T248 [US12] Añadir `changeUserPassword(username, currentPassword, newPassword)` en `src/data/ManufacturingStore.js` validando usuario, contraseña actual y nueva no vacía, actualizando `password` en las cinco tablas donde aparece el usuario, persistiendo en `erp.manufacturing.v2` y emitiendo el cambio sin alterar `rolesForUsername` (depende de T235 y T247).
- [X] T249 [P] [US12] Verificar en `src/data/fixtures/demo-accounts.js` que `authenticate(username, password, roleUsers)` continúa leyendo las contraseñas de las tablas entregadas por el store y documentar en `tests/unit/demo-accounts.test.js` el caso de credencial cambiada, sin modificar `ROLE_USERS` ni `DEMO_ACCOUNTS` (depende de T235).
- [X] T250 [P] [US12] Modificar `renderTables()` en `src/components/RoleAdminPanel.js` para envolver cada usuario en `.role-admin__user-chip` con texto del nombre y botón "Quitar" (×) usando `data-remove-user` y `data-role`, conservando `data-username` y las cinco tablas (depende de T236).
- [X] T251 [US12] Modificar `src/components/RoleAdminPanel.js` para delegar el clic de "Quitar", abrir `confirmDialog` de `src/components/ConfirmDialog.js` con mensaje explícito, llamar a `store.removeRoleUser(role, username)` solo al confirmar, mostrar `showToast` de éxito o rechazo y volver a renderizar tablas y `datalist` (depende de T247, T250).
- [X] T252 [P] [US12] Crear `src/components/ChangePasswordDialog.js` con `.modal-backdrop`/`.modal` centrado, campos "Contraseña actual", "Nueva contraseña" y "Confirmar nueva contraseña", errores inline, cierre por botón/Escape/clic fuera y callback `onSubmit({ currentPassword, newPassword, confirmPassword })`; no modificar `ConfirmDialog.js` ni `Toast.js` (depende de T237).
- [X] T253 [US12] Modificar `userMenu()` y `renderShell()` en `src/manufacturing-main.js` para añadir "Cambiar contraseña" como `data-change-password` para todo usuario autenticado, abrir `ChangePasswordDialog`, invocar `store.changeUserPassword(state.username, ...)` con `state.username` normalizado, notificar con `showToast`, cerrar el menú y conservar `state.role` (depende de T248, T252).
- [X] T254 [US12] Añadir en `src/styles/manufacturing.css` los estilos de `.role-admin__user-chip`, su botón "Quitar" (×) y el modal de cambio de contraseña, reutilizando tokens visuales existentes y sin librerías nuevas (depende de T250, T252).
- [X] T255 [US12] Ejecutar `npm test -- --run tests/unit/role-user-credentials.test.js tests/unit/demo-accounts.test.js tests/integration/role-admin-panel.test.js tests/integration/login-shell.test.js` y `npm run lint` sobre `src/`, verificando en `src/data/ManufacturingStore.js` que el snapshot sigue siendo `erp.manufacturing.v2` (depende de T247, T248, T251, T253, T254).

### Implementación para Fase 30 — US-13 (calendario y selección)

- [X] T256 [P] [US13] Reordenar el markup de `src/components/ProductionSchedulingPanel.js` para que `.pending-tray` quede como barra horizontal compacta antes de `.calendar-main` dentro de `.calendar-layout`, manteniendo `hidden` para los roles sin bandeja y sin alterar filtros ni resumen ejecutivo (depende de T238).
- [X] T257 [US13] Modificar `renderTray()` en `src/components/ProductionSchedulingPanel.js` para que todo `.pending-tray__row` sea la hitbox de activación del modo selección en planner mediante delegación en el contenedor, excluyendo de esa delegación los `select`/`checkbox`/`button` de plant_manager para que conserven su comportamiento (depende de T240, T256).
- [X] T258 [US13] Modificar `renderGrid()` en `src/components/ProductionSchedulingPanel.js` para fijar `draggable="false"` en todas las celdas `.calendar-day`, añadir `dragstart` con `preventDefault()` y marcar `.calendar-grid` con la clase de selección que aplica `user-select: none` mientras el modo esté activo (depende de T240).
- [X] T259 [US13] Modificar los manejadores de arrastre en `src/components/ProductionSchedulingPanel.js`: `mousedown` sobre una celda llama `preventDefault()`, fija día inicio y entra en modo; `mouseenter`/`mouseover` amplían y colorean el rango completo en tiempo real; un único handler en `document.mouseup` cancela el modo, cierra backdrop/tarjeta y abre el modal de horario con el rango exacto y horas "08:00"–"16:00" (depende de T240, T257, T258).
- [X] T260 [US13] Ajustar `renderFocus()`, `renderDragHighlight()` y `renderPopup()` en `src/components/ProductionSchedulingPanel.js` para usar las clases de capas 40/50/60, fondo blanco exclusivo del bloque calendario y tarjeta flotante, evitando iluminar la bandeja o el resto del panel (depende de T241, T259).
- [X] T261 [US13] Extraer el menú diario y el popup de horario de `src/components/ProductionSchedulingPanel.js` a nodos `.modal-backdrop`/`.modal` montados en `document.body`, con botón de cierre, Escape y clic fuera, eliminando su renderizado incrustado bajo el calendario y reutilizando el mismo patrón para el detalle de evento (depende de T239).
- [X] T262 [P] [US13] Modificar `src/components/calendar/CalendarEventDialog.js` para montarse en `.modal-backdrop`/`.modal` centrado sobre la pantalla, conservar el flujo "Volver a la lista del día", el detalle por rol y `draggable="false"`, y cerrar con botón, Escape y clic fuera sin modificar textos ni permisos (depende de T239, T261).
- [X] T263 [US13] Actualizar `src/styles/manufacturing.css` para `.calendar-layout` en `minmax(0, 1fr)`, barra `.pending-tray` horizontal, `.calendar-main` al 100 %, dimensionamiento cómodo de `.calendar-day`, `.calendar-grid.is-selecting { user-select: none }`, capas 40/50/60 y estilos centrales de `.modal-backdrop`/`.modal` para los tres modales del calendario (depende de T241, T256, T260, T261, T262).
- [X] T264 [US13] Ejecutar `npm test -- --run tests/integration/plant-scheduling-panels.test.js tests/integration/calendar-event-dialog.test.js tests/integration/schedule-drag-selection.test.js tests/integration/overlay-layering.test.js` y `npm run lint` sobre `src/`, verificando en `src/styles/manufacturing.css` que no queda `.calendar-layout` de dos columnas ni popup incrustado (depende de T256–T263).

### Implementación para Fase 30 — US-15 (mantenimiento y mini-calendario)

- [X] T265 [P] [US15] Crear `src/domain/machine-calendar.js` con `buildMachineCalendarMonth({ year, month, tickets, workOrders, preventiveOrders, workCenterId })` que devuelva celdas con estado `none|corrective|planned_use|preventive` y orden de prevalencia determinista, sin importar componentes de UI (depende de T246).
- [X] T266 [US15] Eliminar el bloque `.maintenance-filters` del header y las referencias/handlers de `filter-status`, `filter-priority` y `filter-work-center` en `src/components/MaintenancePanel.js`, conservando el resto del encabezado y las tres subpestañas (depende de T242).
- [X] T267 [US15] Reestructurar el markup de la subpestaña "Máquinas" en `src/components/MaintenancePanel.js` con `.maintenance-machines-layout`, `.maintenance-machines-list` y `.maintenance-machine-detail` vacío; eliminar el `fault-banner` duplicado y los paneles sueltos de Historial y Preventivas, moviendo la alerta de frecuencia dentro de la lista (depende de T242).
- [X] T268 [US15] Modificar el estado local de `src/components/MaintenancePanel.js` para `selectedMachineId`, `machineSearch`, `machineSection` y `machineStatus`, con opciones exactas "Todos", "Disponible", "En operación", "En mantención" y "Detenida / En fallo", y renderizado de filas filtradas con `data-machine-id` (depende de T242, T267).
- [X] T269 [US15] Implementar en `src/components/MaintenancePanel.js` la selección de máquina que añade `is-selected` al layout (proporción `0.85fr 1.15fr`) y la deselección mediante botón "Deseleccionar" (×) que restaura el estado inicial y vacía el panel derecho, actualizando `aria-expanded`/foco sin recargar la vista (depende de T242, T268).
- [X] T270 [US15] Añadir en `src/components/MaintenancePanel.js` un manejador de clic en documento que deseleccione la máquina solo cuando el clic cae fuera de `.maintenance-machines-list` y `.maintenance-machine-detail`, ignorando `document.body > .modal-backdrop`, `.modal`, `.confirm-dialog` y los botones ‹/› del mini-calendario (depende de T242, T269).
- [X] T271 [US15] Consolidar en `.maintenance-machine-detail` de `src/components/MaintenancePanel.js` el badge operativo, el campo editable "Cada cuánto se recomienda mantención" con `canEditMaintenanceFrequency`, el indicador `deriveWearIndicator`, el historial de fallas, "Programar preventiva", "Revisar históricas" (prellena y enfoca el buscador histórico) y el botón "Deseleccionar" (depende de T242, T269).
- [X] T272 [US15] Renderizar en `src/components/MaintenancePanel.js` el mini-calendario mensual debajo de ambos paneles solo con máquina seleccionada, usando `buildMachineCalendarMonth`, encabezado con botones ‹/› como única interacción, columnas L, Ma, Mi, J, V, S, D, celdas no clickeables y leyenda visible sin color/rojo/azul/morado; impedir que ‹/› dispare deselección (depende de T243, T265, T270).
- [X] T273 [US15] Quitar de la tabla y del detalle de Tickets en `src/components/MaintenancePanel.js` los botones "Resolver" y "Tomar intervención", dejando buscador, fila expandible con historial/desgaste consolidados y "Programar mantención" como única acción que sigue pasando el ticket a `in_progress`, la máquina a `fault`, al Calendario y a Mantenimientos activos (depende de T244).
- [X] T274 [US15] Sustituir `MAINTENANCE_BLOCKS` en `src/components/MaintenancePanel.js` por dos listas `active`/`history`, añadir el filtro "Todos"/"Vigentes"/"Vencidos" a la activa, conservar buscadores propios, "Resolver", "Eliminar" con `ConfirmDialog.js` y el prellenado del buscador histórico desde "Revisar históricas" (depende de T245, T271).
- [X] T275 [US15] Actualizar `src/styles/manufacturing.css` con transición suave de `.maintenance-machines-layout`, estilos de los dos paneles, filtros de máquina, mini-calendario matricial y leyenda de colores, tabla de tickets sin columna de acción duplicada y los dos bloques de mantenimientos (depende de T267, T269, T272, T273, T274).
- [X] T276 [US15] Ejecutar `npm test -- --run tests/unit/machine-calendar.test.js tests/integration/maintenance-panel.test.js` y `npm run lint` sobre `src/`, verificando en `src/components/MaintenancePanel.js` que no quedan `.maintenance-filters`, tres bloques ni botones obsoletos de tickets (depende de T265–T275).

### Dependencias y paralelización — Fase 30

- Las pruebas T235–T246 se escriben primero y son paralelas entre sí por archivo distinto; deben fallar antes de tocar `src/`.
- US-12: T247 → T248 → T249 en `src/data/`; T250 → T251 en paralelo a T252; T253 depende de T248 y T252; T254 cierra estilos y T255 el gate.
- US-13: T256 → T257 → T258 → T259 → T260 → T261 comparten `ProductionSchedulingPanel.js` y van en secuencia; T262 es paralelo a T256–T261 porque toca solo `CalendarEventDialog.js`; T263 y T264 cierran estilos y gate.
- US-15: T265 es paralelo a T266–T271; T266 → T267 → T268 → T269 → T270 → T271 comparten `MaintenancePanel.js`; T272 depende de T265 y T270; T273 y T274 dependen de T271 para reutilizar el estado de máquina; T275 y T276 cierran estilos y gate.
- Las tres historias son independientes entre sí y pueden ejecutarse en paralelo con worktrees; T277 y T278 son el cierre transversal y requieren los tres gates T255, T264 y T276.

### Ejemplo de Ejecución Paralela — Fase 30

```text
# Pruebas primero (fallidas)
T235 tests/unit/role-user-credentials.test.js
T236 tests/integration/role-admin-panel.test.js
T237 tests/integration/login-shell.test.js
T238 tests/integration/plant-scheduling-panels.test.js
T239 tests/integration/calendar-event-dialog.test.js
T240 tests/integration/schedule-drag-selection.test.js
T241 tests/integration/overlay-layering.test.js
T242-T245 tests/integration/maintenance-panel.test.js (sección por sección)
T246 tests/unit/machine-calendar.test.js

# Implementación paralela por historia
US-12: T247 → T248 → T253 → T255  |  T250 → T251 → T254  |  T252
US-13: T256 → T257 → T258 → T259 → T260 → T261 → T263 → T264  |  T262
US-15: T265 → T272  |  T266 → T267 → T268 → T269 → T270 → T271 → T273 → T274 → T275 → T276

# Cierre
T277 verificación de Fases 1–29 y FR-18 en specs/002-operations-manufacturing/tasks.md
T278 trazabilidad AC-88–AC-103 en specs/002-operations-manufacturing/spec.md
```

### Cierre transversal — Fase 30

- [X] T277 [P] Verificar en `specs/002-operations-manufacturing/tasks.md` que Fases 1 a 29 conservan sus IDs T001–T234 y que Fase 30 usa únicamente T235 en adelante, y en `package.json` y `vitest.config.mjs` que no se añadieron dependencias ni cambió la configuración existente.
- [X] T278 [P] Verificar en `specs/002-operations-manufacturing/spec.md` y `specs/002-operations-manufacturing/checklists/requirements.md` que AC-88–AC-103 y SC-16–SC-20 quedan trazados con US-12, US-13 y US-15, sin reescribir AC-01–AC-87 ni las mejoras de `main`.

**Punto de control**: la Fase 30 es desplegable por historia; US-12 cierra altas/bajas y credenciales persistentes, US-13 deja el calendario ancho con modales reales y arrastre exacto, y US-15 deja el panel de mantenimiento consolidado con mini-calendario y dos listas. Fases 1 a 29 siguen intactas.
