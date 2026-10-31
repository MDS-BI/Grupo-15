# Tareas: Módulo de Operaciones / Manufactura (ERP)

**Entrada**: Documentos de diseño desde `/specs/002-operations-manufacturing/`
**Prerrequisitos**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [research.md](research.md), [contracts/operator-shift.md](contracts/operator-shift.md)
**Stack**: Vanilla JavaScript (ES2022) + Vite 8 + Vitest 4/jsdom — paridad con `001-erp-base-module`
**Convención**: `snake_case` y claves `_id` en datos; `camelCase` en código.

> **Estado de partida (2026-10-31)**: US-01 a US-05 ya están implementadas y verificadas por AC-01..AC-10. Este listado cubre los incrementos pendientes **US-06 (Operador de Máquina)** y **US-07 / HU-04 (Supervisor de Operaciones / Línea)**, conservando una fase de verificación por cada historia existente para evitar regresiones.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Historia]**: `US1`–`US7` para tareas de historia; sin etiqueta en configuración, fundacional y pulido
- Rutas de archivo explícitas en cada tarea

---

<details open>
<summary><strong>Fase 1: Configuración (Infraestructura Compartida)</strong></summary>

**Propósito**: Confirmar que el entorno de ejecución y pruebas del módulo está listo.

- [ ] T001 [P] Verificar dependencias y scripts de manufactura en `package.json` y `package-lock.json`; ejecutar `npm ci` si `node_modules` no existe
- [ ] T002 [P] Configurar el entorno jsdom para las pruebas de integración de manufactura en `vitest.config.mjs`
- [ ] T003 [P] Confirmar la estructura real del proyecto (`src/domain/`, `src/data/`, `src/data/fixtures/`, `src/data/ports/`, `src/components/`, `src/styles/`, `tests/unit/`, `tests/integration/`) contra `plan.md` §6

</details>

---

<details open>
<summary><strong>Fase 2: Fundacional (Prerrequisitos Bloqueantes)</strong></summary>

**Propósito**: Tipos, persistencia, fixtures y estado compartido que necesitan todas las historias (incluyendo US-06 y US-07).

**⚠️ CRÍTICO**: ninguna historia puede cerrarse sin completar esta fase.

- [ ] T004 [P] Añadir a `src/domain/types.js` los enums `DelayReasonOrigin` (`predefined`/`custom`), `ShiftStatus` (`in_progress`/`completed`), `WorkCenterOperationalStatus` (`in_operation`/`paused`/`fault`/`changeover`) y `MaintenanceTicketStatus` (`open`/`in_progress`/`resolved`); definir los typedefs `ProductionShift` (con `supervisor_validated`, `validated_at`, `supervisor_notes`), `OperationDelay` (con `escalated_to_maint`), `DelayReason`, `ShiftAssignment` (`shift_assignment_id`, `work_center_id`, `ext_hr_employee_id`, `shift_band`, `assigned_at`, `active`) y `MaintenanceTicket` (`ticket_id`, `work_center_id`, `operation_delay_id`, `priority`, `ticket_status`, `reported_by`, `created_at`); ampliar `ProductionOrderOperation` con `delay_time_minutes` y `WorkCenter` con `operational_status`
- [ ] T005 [P] Implementar el adaptador de snapshot versionado en `src/data/persistence.js` (`loadSnapshot`, `saveSnapshot`, `clearSnapshot`, validación de `version` y forma mínima incluyendo colecciones de turno y supervisión) según `contracts/operator-shift.md` §6
- [ ] T006 [P] Añadir pruebas unitarias de persistencia (round-trip, snapshot ausente, JSON corrupto, versión distinta) en `tests/unit/persistence.test.js`
- [ ] T007 [P] Crear fixtures de motivos y turnos en `src/data/fixtures/delay-reasons.js` y `src/data/fixtures/production-shifts.js`; crear fixtures de supervisión en `src/data/fixtures/shift-assignments.js`, `src/data/fixtures/hr-employees.js` (puente `ext_hr_employee_id`) y `src/data/fixtures/maintenance-tickets.js`; ampliar `src/data/fixtures/production-orders.js` y `src/data/fixtures/work-centers.js` con estados iniciales de semáforo y escenario sembrado de turno y atraso
- [ ] T008 Extender `src/data/ManufacturingStore.js` con las colecciones `productionShifts`, `operationDelays`, `delayReasons`, `shiftAssignments`, `hrEmployees` y `maintenanceTickets`, hidratación desde `src/data/persistence.js` y escritura del snapshot tras cada mutación (depende de T005, T007)

**Punto de control**: tipos, fixtures, persistencia y store listos; las historias pueden validarse sin romper el estado existente.

</details>

---

<details>
<summary><strong>Fases 3 a 5: Verificación de Base (US-01, US-02 y US-03)</strong></summary>

## Fase 3: Historia de Usuario US-01 - BOM multi-nivel (Prioridad: P1)

**Objetivo**: Confirmar que la gestión y visualización de BOM multi-nivel sigue intacta.

**Prueba Independiente**: un planificador abre una BOM de bien terminado, ve el árbol anidado (≥4 niveles) con consumo teórico total y un ciclo se detecta sin recursión infinita.

- [ ] T009 [P] [US1] Verificar AC-01 ejecutando `tests/unit/bom-explosion.test.js` y revisando el árbol y la detección de ciclos en `src/components/BomExplorer.js`

**Punto de control**: US-01 verificada; cualquier regresión debe corregirse antes de avanzar a US-06 y US-07.

## Fase 4: Historia de Usuario US-02 - Centros de trabajo y rutas (Prioridad: P1)

**Objetivo**: Confirmar capacidad, secuencia de operaciones y tiempo estándar.

**Prueba Independiente**: una ruta conserva secuencia estrictamente creciente y `planned_time_minutes` se calcula como `setup + run × quantity`.

- [ ] T010 [P] [US2] Verificar AC-02 ejecutando `tests/unit/operation-planning.test.js` y revisando `src/domain/operation-planning.js` y `src/data/fixtures/routings.js`

**Punto de control**: US-02 verificada sin mutar operaciones ya congeladas.

## Fase 5: Historia de Usuario US-03 - Despacho de órdenes (Prioridad: P1)

**Objetivo**: Confirmar creación, liberación y congelamiento de BOM/ruta/operaciones.

**Prueba Independiente**: una orden creada desde stock o MTO se libera, genera una operación por paso de ruta y respeta la máquina de estados.

- [ ] T011 [P] [US3] Verificar AC-03 y AC-04 ejecutando `tests/unit/order-state-machine.test.js` y revisando `src/data/ManufacturingStore.js` (`createOrder`, `transitionOrder`, `#generateOperations`)

**Punto de control**: US-03 verificada; las operaciones generadas son la base de US-06 y US-07.

</details>

---

<details open>
<summary><strong>Fase 6: Historia de Usuario US-06 - Registro de turno del operador (Prioridad: P1) 🎯 MVP Operador</strong></summary>

**Objetivo**: Iniciar/finalizar la operación activa con un botón, justificar atrasos y mantener contadores de turno y acumulado, con persistencia ante recarga.

**Prueba Independiente**: un operador inicia una operación, registra un atraso, ajusta ambos contadores, finaliza con confirmación y recarga la página conservando turno, tiempos, atrasos y piezas.

### Pruebas para US-06 (escribir primero) ⚠️

- [ ] T012 [P] [US6] Añadir pruebas unitarias de tiempo efectivo, descuento de atrasos cerrados, atrasos abiertos y tolerancia de 1 s en `tests/unit/shift-tracking.test.js`
- [ ] T013 [P] [US6] Añadir pruebas unitarias de guardas y contadores del store (un turno activo, doble cierre, motivo obligatorio, atrasos simultáneos, valores negativos/no numéricos) en `tests/unit/manufacturing-store.test.js`
- [ ] T014 [P] [US6] Añadir prueba de integración jsdom del botón alterno, confirmación, atraso y contadores en `tests/integration/operator-shift.test.js`
- [ ] T015 [P] [US6] Añadir prueba de integración de cierre con atraso abierto y corrección posterior en `tests/integration/delay-correction.test.js`

### Implementación para US-06

- [ ] T016 [P] [US6] Implementar `src/domain/shift-tracking.js` con funciones puras `elapsedMinutes`, `computeEffectiveMinutes`, `sumClosedDelayMinutes`, `hasOpenDelay`, `validateCounter` y guardas de un solo turno/atraso
- [ ] T017 [US6] Implementar en `src/data/ManufacturingStore.js` las consultas `activeShiftFor`, `openDelayFor`, `delaysForOperation`, `reasonsForShift` y las acciones `startShift`, `finishOperation`, `closeDelay`, `correctOpenDelay`
- [ ] T018 [US6] Implementar en `src/data/ManufacturingStore.js` `startDelay` con motivo predefinido o personalizado reutilizable, y `adjustShiftCounter`/`setShiftCounter` con delta único hacia `quantity_completed` (depende de T017)
- [ ] T019 [US6] Crear `src/components/OperatorWorkstationPanel.js` con tarjeta de orden/operación activa, botón alterno `Iniciar`/`Finalizar`, confirmación, cronómetro, lista de atrasos y ambos contadores
- [ ] T020 [US6] Crear `src/components/DelayCorrectionDialog.js` para listar atrasos abiertos tras el cierre y corregirlos con nota de auditoría
- [ ] T021 [US6] Integrar `OperatorWorkstationPanel` en `src/components/ProductionOrders.js` y añadir su vista/ruta en `src/manufacturing-main.js`
- [ ] T022 [US6] Añadir estilos de botón alterno, cronómetro, aviso de atraso abierto y contadores en `src/styles/manufacturing.css`, incluyendo `aria-pressed`, foco del diálogo y cierre con `Esc`
- [ ] T023 [US6] Asegurar la escritura del snapshot tras cada acción de US-06 y la rehidratación de cronómetros desde `started_at`/`ended_at` en `src/data/ManufacturingStore.js` y `src/data/persistence.js` (depende de T008, T017)
- [ ] T024 [US6] Ejecutar las pruebas de US-06 (`tests/unit/shift-tracking.test.js`, `tests/unit/manufacturing-store.test.js`, `tests/integration/operator-shift.test.js`, `tests/integration/delay-correction.test.js`) y corregir fallos

**Punto de control**: US-06 completamente funcional y comprobable de forma independiente; AC-11..AC-13 verificados.

</details>

---

<details open>
<summary><strong>Fase 7: Historia de Usuario US-07 (HU-04) - Supervisión de Línea: Semáforo, Asignación, Validación y Escalamiento (Prioridad: P1) 🎯 MVP Supervisor</strong></summary>

**Objetivo**: Visualizar el semáforo de estado de cada línea/máquina en tiempo real, vincular operarios (`ext_hr_employee_id`) con máquinas para el turno, revisar y aprobar los cierres de turno (`supervisor_validated = true`) y escalar incidentes a mantenimiento (`escalated_to_maint = true`) con un botón de alerta.

**Prueba Independiente**: el supervisor abre el panel de supervisión, visualiza el semáforo en vivo de todas las máquinas, asigna un operario de RR.HH. a un centro de trabajo para el turno actual, aprueba un cierre de turno completado (sin atrasos abiertos) y dispara un ticket urgente de mantenimiento desde una parada crítica viendo cómo la máquina pasa inmediatamente a estado *En fallo* y persiste tras recargar la página.

### Pruebas para US-07 (escribir primero) ⚠️

- [ ] T025 [P] [US7] Añadir pruebas unitarias de derivación del semáforo (`in_operation`, `paused`, `fault`, `changeover`), validación de asignación única de operario por franja (`ext_hr_employee_id`) y reglas de aprobación de cierre de turno en `tests/unit/line-supervision.test.js`
- [ ] T026 [P] [US7] Añadir pruebas unitarias en `tests/unit/manufacturing-store.test.js` para `assignOperatorToWorkCenter`, `setWorkCenterOperationalStatus`, `validateShiftClosure` (bloqueo si hay atraso abierto, éxito con `supervisor_validated = true`) y `escalateIncidentToMaintenance` (`escalated_to_maint = true` + creación en `maintenanceTickets` + cambio a `fault`)
- [ ] T027 [P] [US7] Añadir prueba de integración jsdom del panel de supervisor (semáforo en tiempo real, selector de asignación de operario, aprobación de turno y botón de alerta de escalamiento a mantenimiento) en `tests/integration/supervisor-line-panel.test.js`

### Implementación para US-07

- [ ] T028 [P] [US7] Implementar `src/domain/line-supervision.js` con funciones puras `deriveWorkCenterTrafficLight`, `canAssignOperator`, `canValidateShiftClosure` y `buildUrgentMaintenanceTicket`
- [ ] T029 [US7] Implementar en `src/data/ManufacturingStore.js` las consultas `trafficLightForWorkCenters`, `activeAssignmentForWorkCenter`, `shiftsPendingValidation`, `openMaintenanceTicketsFor` y las mutaciones `assignOperatorToWorkCenter`, `setWorkCenterOperationalStatus`, `validateShiftClosure` y `escalateIncidentToMaintenance` (depende de T008, T017, T028)
- [ ] T030 [US7] Crear `src/components/SupervisorLinePanel.js` con cuatro secciones integradas: (1) Semáforo en vivo por línea/máquina (*En operación, En pausa, En fallo, Cambio de formato*), (2) Asignación de personal (`ext_hr_employee_id` → máquina/turno), (3) Bandeja de cierre de turnos con botón de aprobación (`supervisor_validated`) y acceso a `DelayCorrectionDialog`, y (4) Botón de alerta para escalar incidente a mantenimiento (`tblMAINTENANCE_TICKETS`)
- [ ] T031 [US7] Integrar la pestaña/vista `SupervisorLinePanel` en `src/manufacturing-main.js` y vincular alertas rápidas desde `src/components/ProductionOrders.js` (depende de T030)
- [ ] T032 [US7] Añadir estilos de semáforo industrial (indicadores cromáticos de alto contraste con etiquetas textuales para accesibilidad: verde `in_operation`, amarillo `paused`, azul/ámbar `changeover`, rojo pulsante `fault`), insignias de validación y botón de emergencia de mantenimiento en `src/styles/manufacturing.css`
- [ ] T033 [US7] Ejecutar las suites de US-07 (`tests/unit/line-supervision.test.js`, `tests/unit/manufacturing-store.test.js`, `tests/integration/supervisor-line-panel.test.js`) y verificar persistencia del estado de supervisión tras recarga

**Punto de control**: US-07 (HU-04) completamente funcional y comprobable de forma independiente; AC-14 y AC-15 verificados.

</details>

---

<details>
<summary><strong>Fases 8 y 9: Regresión de Ejecución, Consumo y Salida (US-04 y US-05)</strong></summary>

## Fase 8: Historia de Usuario US-04 - Ejecución en piso (Prioridad: P2)

**Objetivo**: Confirmar que la ejecución existente (iniciar/pausar/completar) sigue funcionando junto a US-06 y US-07.

**Prueba Independiente**: iniciar la primera operación mueve la orden a `in_progress` y el semáforo del centro de trabajo a `in_operation`; pausar y completar respetan la máquina de estados; completar la última operación mueve la orden a `completed`.

- [ ] T034 [P] [US4] Verificar AC-05 ejecutando `tests/unit/manufacturing-store.test.js` y revisando `startOperation`, `pauseOperation` y `completeOperation` en `src/data/ManufacturingStore.js`
- [ ] T035 [US4] Asegurar que `finishOperation` reutiliza la lógica de `completeOperation` sin romper pausas ni el cálculo previo de `actual_time_minutes`, y actualiza el estado del semáforo de supervisión en `src/data/ManufacturingStore.js`

**Punto de control**: US-04, US-06 y US-07 conviven sin dobles cierres ni estados inconsistentes en el semáforo.

## Fase 9: Historia de Usuario US-05 - Consumo y salida (Prioridad: P2)

**Objetivo**: Confirmar que consumo, salida e inventario simulado no se ven afectados por el seguimiento de turno ni la supervisión de línea.

**Prueba Independiente**: registrar consumo debita inventario, registrar salida lo acredita y la reconciliación plan-vs-real sigue calculando varianza y flags.

- [ ] T036 [P] [US5] Verificar AC-06 y AC-07 ejecutando `tests/unit/reconciliation.test.js` y `tests/unit/manufacturing-store.test.js` y revisando `src/data/ports/index.js`

**Punto de control**: US-01 a US-07 verificadas en conjunto.

</details>

---

<details open>
<summary><strong>Fase 10: Pulido y Preocupaciones Transversales</strong></summary>

**Propósito**: Calidad, accesibilidad, rendimiento, documentación y cierre de AC.

- [ ] T037 [P] Reparar o aislar las 12 suites legadas de `001-erp-base-module` que importan `src/storage.js` y `src/module-config.js` inexistentes, ajustando `vitest.config.mjs` o `tests/` según corresponda
- [ ] T038 [P] Revisar accesibilidad y consistencia de `src/components/OperatorWorkstationPanel.js`, `src/components/DelayCorrectionDialog.js` y `src/components/SupervisorLinePanel.js` (etiquetas ARIA del semáforo, foco, `Esc`, mensajes inline)
- [ ] T039 [P] Actualizar `quickstart.md` y `contracts/operator-shift.md` con los selectores, etiquetas y pasos finales de US-06 y US-07 tras la implementación
- [ ] T040 [P] Validar el rendimiento con 500 órdenes, semáforo de supervisión y cronómetro activo (<100 ms por interacción) usando `src/data/ManufacturingStore.js`, `src/components/OperatorWorkstationPanel.js` y `src/components/SupervisorLinePanel.js`
- [ ] T041 Ejecutar `npm test -- --run` y `npm run build`; documentar en `tasks.md` cualquier fallo preexistente no relacionado con US-06/US-07
- [ ] T042 Actualizar `spec.md` AC-11 a AC-15 a `Implementado`/`Verificado` cuando T024, T033 y T041 pasen
- [ ] T043 Preparar el guion de demo de 5 minutos (pedido → orden → asignación de operario por supervisor → turno operador → atraso → escalamiento a mantenimiento / corrección → validación de cierre de turno → recarga) en `quickstart.md`

</details>

---

## Dependencias y Orden de Ejecución

- **Configuración (Fase 1)**: sin dependencias.
- **Fundacional (Fase 2)**: depende de Fase 1; **BLOQUEA** todas las historias.
- **US-01, US-02, US-03 (Fases 3–5)**: dependen de Fase 2; son verificaciones de la base ya implementada.
- **US-06 (Fase 6)**: depende de Fase 2 y de las operaciones generadas por US-03; usa la ejecución existente de US-04.
- **US-07 / HU-04 (Fase 7)**: depende de Fase 2 y se integra con los turnos y atrasos de US-06 (`productionShifts`, `operationDelays`) para validar cierres y escalar paradas a mantenimiento. El semáforo y la asignación de personal (`T028`, `T030` parcial) pueden avanzar en paralelo con US-06.
- **US-04 (Fase 8)**: depende de US-06 y US-07 para comprobar la convivencia con `finishOperation` y el semáforo.
- **US-05 (Fase 9)**: depende de Fase 2; no depende de US-06 ni US-07.
- **Pulido (Fase 10)**: depende de todas las historias deseadas.

## Notas

- `[P]` = archivos distintos, sin dependencias.
- La etiqueta `[USx]` mapea la tarea a su historia para trazabilidad.
- Cada historia debe ser completable y comprobable de forma independiente.
- Verificar que las pruebas fallan antes de implementar (constitución, principio II).
- El snapshot usa `erp.manufacturing.v1`; cualquier cambio de forma exige incrementar la versión.
- No introducir rankings por operador; los tiempos, asignaciones y atrasos son contexto operacional.