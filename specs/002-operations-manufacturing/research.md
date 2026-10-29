# Investigación y Decisiones Técnicas (Fase 0)

**Rama**: `002-operations-manufacturing` | **Fecha**: 2026-10-29
**Entrada**: [spec.md](spec.md) (FR-07 / US-06), [data-model.md](data-model.md), [plan.md](plan.md)
**Alcance**: resolver las incógnitas de diseño del registro de turno del operador antes de generar los contratos.

---

## 1. Contexto

La spec incorporó US-06: el operador inicia y finaliza la operación activa con un único botón, registra tiempo, justifica atrasos con motivos predefinidos o personalizados, y cuenta piezas por turno. Las cinco decisiones funcionales ya fueron cerradas en `spec.md` (`## Clarifications`, sesión 2026-10-29). Esta investigación convierte esas decisiones en un diseño verificable y compatible con el código real del repositorio (**JavaScript ES2022 + Vite**, no React/TypeScript).

---

## 2. Decisiones

### D-01 — El botón opera sobre la operación activa, no sobre la orden

- **Decisión**: `Iniciar`/`Finalizar` actúa sobre `production_order_operations` (la operación `pending`/`paused` de la orden activa). El estado de `production_orders` se deriva con `recomputeOrderStatus`/`deriveOrderStatus`.
- **Razón**: una orden puede tener varias operaciones secuenciales; cerrar la orden completa desde el botón impediría ejecutar pasos pendientes y rompería la máquina de estados ya implementada.
- **Alternativas descartadas**: operar sobre la orden completa (no modela pasos); un botón por operación en una tabla (no cumple "operación activa" ni el flujo de un solo botón).

### D-02 — Dos contadores con una sola fuente de verdad

- **Decisión**: el contador del turno vive en `production_shifts.quantity_counted` y se reinicia al abrir un turno nuevo. El acumulado vive en `production_order_operations.quantity_completed` y nunca se reinicia. Cada incremento/decremento/fijado del turno aplica el mismo delta al acumulado.
- **Razón**: separa la lectura operativa del turno de la trazabilidad histórica de la operación, sin duplicar el total. El acumulado sigue siendo el campo ya usado por el resto del sistema (KPIs, salida, trazabilidad).
- **Alternativas descartadas**: un solo contador que se reinicia (pierde historia); dos contadores independientes (permiten divergencia); recalcular el acumulado solo al cerrar el turno (no cumple "tiempo real").

### D-03 — Catálogo de motivos con alcance global/turno

- **Decisión**: `delay_reasons` guarda motivos `predefined` (`scope = global`) y `custom` (`scope = shift`, ligados al turno). Los personalizados quedan reutilizables durante el turno y no se ofrecen fuera de él. `label` es único por empresa sin distinguir mayúsculas.
- **Razón**: cumple "motivo predefinido o nuevo reutilizable durante el turno" sin crear un catálogo global contaminado por textos improvisados.
- **Alternativas descartadas**: texto libre por atraso (no es reutilizable ni analizable); catálogo global para personalizados (mezcla datos de demo y facilita duplicados).

### D-04 — Cierre con atraso abierto y corrección posterior

- **Decisión**: finalizar la operación con un atraso `open` está permitido. El atraso permanece `open`, la UI lo marca como *pendiente de corrección* y no se descuenta del tiempo efectivo hasta que se cierre. La corrección fija `ended_at`/`duration_minutes`, registra `corrected_at`/`corrected_by`/`correction_note` y recalcula `delay_time_minutes` y `actual_time_minutes`.
- **Razón**: cumple la clarificación y evita bloquear el cierre por un olvido del operador, sin perder trazabilidad (append-only, con auditoría).
- **Alternativas descartadas**: bloquear el cierre (contradice la clarificación); cerrar el atraso automáticamente al finalizar (inventa una duración no observada).

### D-05 — Un botón alterno con confirmación de finalización

- **Decisión**: un solo control cuyo texto depende del estado (`Iniciar` cuando la operación está `pending`/`paused`; `Finalizar` cuando está `in_progress`). Finalizar abre un diálogo de confirmación que resume tiempo efectivo, atrasos y piezas. El doble clic se neutraliza con un guard de estado en el store.
- **Razón**: reduce errores en piso de planta y cumple la clarificación; el guard evita dobles cierres por clics rápidos.
- **Alternativas descartadas**: dos botones separados (más superficie de error); finalizar sin confirmación (riesgo de cierre accidental).

### D-06 — Tiempo efectivo derivado de timestamps, tolerancia 1 s

- **Decisión**: `actual_time_minutes` se calcula como `(completed_at − started_at) − Σ operation_delays.duration_minutes`, en minutos decimales, redondeado a 2 decimales. La UI muestra el cronómetro a partir de los timestamps persistidos, no de un contador en memoria. La diferencia aceptable es ≤ 1 segundo.
- **Razón**: sobrevive recargas, suspensión del equipo y cambios de pestaña; un `setInterval` que acumula segundos se desincroniza y no es auditable.
- **Alternativas descartadas**: cronómetro en memoria (se pierde al recargar); confiar solo en la duración del intervalo (no resiste suspensión); reloj de servidor (no hay backend).

### D-07 — Persistencia con snapshot versionado en `localStorage`

- **Decisión**: `ManufacturingStore` escribe un snapshot JSON versionado (`erp.manufacturing.v1`) tras cada mutación y lo rehidrata al arrancar. Si el snapshot falta, está corrupto o no coincide con la versión, se descarta y se cargan los fixtures con una advertencia.
- **Razón**: US-06 exige conservar estado, tiempos, atrasos y contadores ante recarga o pérdida de sesión. `localStorage` sobrevive al cierre de pestaña; el versionado permite evolucionar el esquema sin romper demos.
- **Alternativas descartadas**: solo memoria (pierde el turno); `sessionStorage` (pierde el turno al cerrar pestaña); IndexedDB (complejidad innecesaria para un único snapshot de demo).

### D-08 — Mantener la arquitectura real: dominio puro + un store + componentes vanilla

- **Decisión**: la lógica nueva vive en `src/domain/shift-tracking.js` (funciones puras: tiempo efectivo, detección de atraso abierto, validación de contadores, guard de un solo turno). `ManufacturingStore` orquesta mutaciones y emite `change`. La UI se implementa en `src/components/OperatorWorkstationPanel.js` y `DelayCorrectionDialog.js` con el shell existente.
- **Razón**: el repositorio es Vanilla JS + Vite + Vitest; introducir React/TS/Zustand solo para US-06 rompería la consistencia con `001-erp-base-module` y el resto del módulo.
- **Alternativas descartadas**: migrar a React/TypeScript (fuera de alcance, coste alto); lógica de tiempo dentro del componente (no testeable de forma pura).

### D-09 — Verificación con Vitest (unidad + integración jsdom)

- **Decisión**: pruebas unitarias de `shift-tracking` (tiempo efectivo con/sin atrasos, tolerancia, atraso abierto, corrección, contadores negativos/no numéricos) y del store (un turno activo, doble cierre, persistencia/rehidratación). Pruebas de integración con `jsdom` para el flujo del botón, confirmación y corrección de atraso.
- **Razón**: cumple el principio II de la constitución y permite validar US-06 sin backend.
- **Alternativas descartadas**: solo pruebas manuales (no verificables en CI); pruebas E2E con navegador real (no hay infraestructura en el repo).

---

## 3. Incógnitas resueltas

| Incógnita | Resolución |
|---|---|
| ¿Operación u orden? | Operación activa; orden derivada (D-01). |
| ¿Un contador o dos? | Turno + acumulado, con delta único (D-02). |
| ¿Motivos globales o por turno? | Predefinidos globales; personalizados por turno (D-03). |
| ¿Qué pasa con atraso abierto al finalizar? | Se permite el cierre; queda abierto y corregible (D-04). |
| ¿Un botón o dos? | Un botón alterno con confirmación (D-05). |
| ¿Cómo se mide el tiempo? | Timestamps + descuento de atrasos, tolerancia 1 s (D-06). |
| ¿Cómo sobrevive la recarga? | Snapshot versionado en `localStorage` (D-07). |
| ¿Qué stack se usa? | Vanilla JS + Vite + Vitest, como el resto del repo (D-08). |
| ¿Cómo se prueba? | Unitarias de dominio/store + integración jsdom (D-09). |

No quedan incógnitas bloqueantes para la Fase 1.
