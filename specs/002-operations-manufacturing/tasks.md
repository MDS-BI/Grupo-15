# Tareas: Módulo de Operaciones / Manufactura (ERP)

**Entrada**: Documentos de diseño desde `/specs/002-operations-manufacturing/`
**Prerrequisitos**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [research.md](research.md), [contracts/operator-shift.md](contracts/operator-shift.md)
**Stack**: Vanilla JavaScript (ES2022) + Vite 8 + Vitest 4/jsdom — paridad con `001-erp-base-module`
**Convención**: `snake_case` y claves `_id` en datos; `camelCase` en código.

> **Estado de partida (2026-10-29)**: US-01 a US-05 ya están implementadas y verificadas por AC-01..AC-10. Este listado prioriza el incremento pendiente **US-06** y conserva una fase de verificación por cada historia existente para evitar regresiones.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Historia]**: `US1`–`US6` para tareas de historia; sin etiqueta en configuración, fundacional y pulido
- Rutas de archivo explícitas en cada tarea

---

## Fase 1: Configuración (Infraestructura Compartida)

**Propósito**: Confirmar que el entorno de ejecución y pruebas del módulo está listo.

- [ ] T001 [P] Verificar dependencias y scripts de manufactura en `package.json` y `package-lock.json`; ejecutar `npm ci` si `node_modules` no existe
- [ ] T002 [P] Configurar el entorno jsdom para las pruebas de integración de manufactura en `vitest.config.mjs`
- [ ] T003 [P] Confirmar la estructura real del proyecto (`src/domain/`, `src/data/`, `src/data/fixtures/`, `src/data/ports/`, `src/components/`, `src/styles/`, `tests/unit/`, `tests/integration/`) contra `plan.md` §6

---

## Fase 2: Fundacional (Prerrequisitos Bloqueantes)

**Propósito**: Tipos, persistencia, fixtures y estado compartido que necesitan todas las historias.

**⚠️ CRÍTICO**: ninguna historia puede cerrarse sin completar esta fase.

- [ ] T004 [P] Añadir a `src/domain/types.js` los enums `DelayReasonOrigin` (`predefined`/`custom`) y `ShiftStatus` (`in_progress`/`completed`), y los typedefs `ProductionShift`, `OperationDelay`, `DelayReason`; ampliar `ProductionOrderOperation` con `delay_time_minutes`
- [ ] T005 [P] Implementar el adaptador de snapshot versionado en `src/data/persistence.js` (`loadSnapshot`, `saveSnapshot`, `clearSnapshot`, validación de `version` y forma mínima) según `contracts/operator-shift.md` §6
- [ ] T006 [P] Añadir pruebas unitarias de persistencia (round-trip, snapshot ausente, JSON corrupto, versión distinta) en `tests/unit/persistence.test.js`
- [ ] T007 [P] Crear fixtures de motivos y turnos en `src/data/fixtures/delay-reasons.js` y `src/data/fixtures/production-shifts.js`; ampliar `src/data/fixtures/production-orders.js` con un escenario sembrado de turno y atraso
- [ ] T008 Extender `src/data/ManufacturingStore.js` con las colecciones `productionShifts`, `operationDelays` y `delayReasons`, hidratación desde `src/data/persistence.js` y escritura del snapshot tras cada mutación (depende de T005, T007)

**Punto de control**: tipos, fixtures, persistencia y store listos; las historias pueden validarse sin romper el estado existente.

---

## Fase 3: Historia de Usuario US-01 - BOM multi-nivel (Prioridad: P1)

**Objetivo**: Confirmar que la gestión y visualización de BOM multi-nivel sigue intacta.

**Prueba Independiente**: un planificador abre una BOM de bien terminado, ve el árbol anidado (≥4 niveles) con consumo teórico total y un ciclo se detecta sin recursión infinita.

- [ ] T009 [P] [US1] Verificar AC-01 ejecutando `tests/unit/bom-explosion.test.js` y revisando el árbol y la detección de ciclos en `src/components/BomExplorer.js`

**Punto de control**: US-01 verificada; cualquier regresión debe corregirse antes de avanzar a US-06.

---

## Fase 4: Historia de Usuario US-02 - Centros de trabajo y rutas (Prioridad: P1)

**Objetivo**: Confirmar capacidad, secuencia de operaciones y tiempo estándar.

**Prueba Independiente**: una ruta conserva secuencia estrictamente creciente y `planned_time_minutes` se calcula como `setup + run × quantity`.

- [ ] T010 [P] [US2] Verificar AC-02 ejecutando `tests/unit/operation-planning.test.js` y revisando `src/domain/operation-planning.js` y `src/data/fixtures/routings.js`

**Punto de control**: US-02 verificada sin mutar operaciones ya congeladas.

---

## Fase 5: Historia de Usuario US-03 - Despacho de órdenes (Prioridad: P1)

**Objetivo**: Confirmar creación, liberación y congelamiento de BOM/ruta/operaciones.

**Prueba Independiente**: una orden creada desde stock o MTO se libera, genera una operación por paso de ruta y respeta la máquina de estados.

- [ ] T011 [P] [US3] Verificar AC-03 y AC-04 ejecutando `tests/unit/order-state-machine.test.js` y revisando `src/data/ManufacturingStore.js` (`createOrder`, `transitionOrder`, `#generateOperations`)

**Punto de control**: US-03 verificada; las operaciones generadas son la base de US-06.

---

## Fase 6: Historia de Usuario US-06 - Registro de turno del operador (Prioridad: P1) 🎯 MVP del incremento

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

---

## Fase 7: Historia de Usuario US-04 - Ejecución en piso (Prioridad: P2)

**Objetivo**: Confirmar que la ejecución existente (iniciar/pausar/completar) sigue funcionando junto a US-06.

**Prueba Independiente**: iniciar la primera operación mueve la orden a `in_progress`; pausar y completar respetan la máquina de estados; completar la última operación mueve la orden a `completed`.

- [ ] T025 [P] [US4] Verificar AC-05 ejecutando `tests/unit/manufacturing-store.test.js` y revisando `startOperation`, `pauseOperation` y `completeOperation` en `src/data/ManufacturingStore.js`
- [ ] T026 [US4] Asegurar que `finishOperation` reutiliza la lógica de `completeOperation` sin romper pausas ni el cálculo previo de `actual_time_minutes` en `src/data/ManufacturingStore.js`

**Punto de control**: US-04 y US-06 conviven sin dobles cierres ni transiciones inválidas.

---

## Fase 8: Historia de Usuario US-05 - Consumo y salida (Prioridad: P2)

**Objetivo**: Confirmar que consumo, salida e inventario simulado no se ven afectados por el seguimiento de turno.

**Prueba Independiente**: registrar consumo debita inventario, registrar salida lo acredita y la reconciliación plan-vs-real sigue calculando varianza y flags.

- [ ] T027 [P] [US5] Verificar AC-06 y AC-07 ejecutando `tests/unit/reconciliation.test.js` y `tests/unit/manufacturing-store.test.js` y revisando `src/data/ports/index.js`

**Punto de control**: US-01 a US-06 verificadas en conjunto.

---

## Fase 9: Pulido y Preocupaciones Transversales

**Propósito**: Calidad, accesibilidad, rendimiento, documentación y cierre de AC.

- [ ] T028 [P] Reparar o aislar las 12 suites legadas de `001-erp-base-module` que importan `src/storage.js` y `src/module-config.js` inexistentes, ajustando `vitest.config.mjs` o `tests/` según corresponda
- [ ] T029 [P] Revisar accesibilidad y consistencia de `src/components/OperatorWorkstationPanel.js` y `src/components/DelayCorrectionDialog.js` (etiquetas, foco, `Esc`, mensajes inline)
- [ ] T030 [P] Actualizar `quickstart.md` con los selectores, etiquetas y pasos finales de US-06 tras la implementación
- [ ] T031 [P] Validar el rendimiento con 500 órdenes y cronómetro activo (<100 ms por interacción) usando `src/data/ManufacturingStore.js` y `src/components/OperatorWorkstationPanel.js`
- [ ] T032 Ejecutar `npm test -- --run` y `npm run build`; documentar en `tasks.md` cualquier fallo preexistente no relacionado con US-06
- [ ] T033 Actualizar `spec.md` AC-11, AC-12 y AC-13 a `Implementado`/`Verificado` cuando T024 y T032 pasen
- [ ] T034 Preparar el guion de demo de 5 minutos (pedido → orden → turno → atraso → contadores → recarga) en `quickstart.md`

---

## Dependencias y Orden de Ejecución

### Dependencias entre Fases

- **Configuración (Fase 1)**: sin dependencias.
- **Fundacional (Fase 2)**: depende de Fase 1; **BLOQUEA** todas las historias.
- **US-01, US-02, US-03 (Fases 3–5)**: dependen de Fase 2; son verificaciones de la base ya implementada.
- **US-06 (Fase 6)**: depende de Fase 2 y de las operaciones generadas por US-03; usa la ejecución existente de US-04.
- **US-04 (Fase 7)**: depende de US-06 para comprobar la convivencia con `finishOperation`.
- **US-05 (Fase 8)**: depende de Fase 2; no depende de US-06.
- **Pulido (Fase 9)**: depende de todas las historias deseadas.

### Dependencias dentro de US-06

- T012–T015 (pruebas) se escriben antes de T016–T023 y deben fallar primero.
- T016 (dominio puro) antes de T017/T018 (store).
- T017 antes de T018 y T023.
- T019 antes de T021/T022.
- T020 puede avanzar en paralelo con T019.
- T024 depende de T016–T023.

### Oportunidades Paralelas

- T001–T003 pueden ejecutarse en paralelo.
- T004–T007 pueden ejecutarse en paralelo; T008 depende de T005 y T007.
- T009–T011 (verificación de historias existentes) pueden ejecutarse en paralelo.
- T012–T015 (pruebas de US-06) pueden ejecutarse en paralelo.
- T016 y T019/T020 pueden avanzar en paralelo; T017/T018 requieren T016.
- T028–T031 pueden ejecutarse en paralelo tras cerrar US-06.

---

## Ejemplo Paralelo: US-06

```bash
# Pruebas de US-06 en paralelo
Task: "Añadir pruebas unitarias de tiempo efectivo en tests/unit/shift-tracking.test.js"
Task: "Añadir pruebas unitarias de guardas del store en tests/unit/manufacturing-store.test.js"
Task: "Añadir prueba de integración del botón alterno en tests/integration/operator-shift.test.js"
Task: "Añadir prueba de integración de corrección de atraso en tests/integration/delay-correction.test.js"

# Implementación paralela tras el dominio puro
Task: "Implementar src/domain/shift-tracking.js"
Task: "Crear src/components/OperatorWorkstationPanel.js"
Task: "Crear src/components/DelayCorrectionDialog.js"
```

---

## Estrategia de Implementación

### MVP del Incremento (US-06)

1. Completar Fase 1 y Fase 2.
2. Verificar US-01 a US-03 (T009–T011).
3. Implementar US-06 completo (T012–T024).
4. **DETENER y VALIDAR**: ejecutar las pruebas de US-06, recargar la página y comprobar persistencia.
5. Demostrar US-06 sobre la base existente.

### Entrega Incremental

1. Base verificada (US-01 a US-03) → US-06 → validar → demostrar.
2. Verificar US-04 y US-05 sin regresiones.
3. Pulido, accesibilidad, rendimiento y actualización de AC.

### Estrategia de Equipo Paralelo

Con varios desarrolladores, tras Fase 2:
- Desarrollador A: dominio y store de US-06 (T016–T018, T023).
- Desarrollador B: UI de US-06 (T019–T022).
- Desarrollador C: pruebas de US-06 (T012–T015) y verificación de historias existentes (T009–T011).

---

## Notas

- [P] = archivos distintos, sin dependencias.
- La etiqueta [USx] mapea la tarea a su historia para trazabilidad.
- Cada historia debe ser completable y comprobable de forma independiente.
- Verificar que las pruebas fallan antes de implementar (constitución, principio II).
- El snapshot usa `erp.manufacturing.v1`; cualquier cambio de forma exige incrementar la versión.
- No introducir rankings por operador; los tiempos y atrasos son contexto operacional (constitución y `data-model.md` §7).
- Evitar tareas vagas, conflictos de archivo y dependencias cruzadas que rompan la independencia.
