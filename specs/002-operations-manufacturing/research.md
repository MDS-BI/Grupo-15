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

---

## 4. Investigación US-09 — Mantenimiento (Fase 0 incremental)

**Entrada**: [spec.md](spec.md) (FR-10 / US-09 / AC-21…AC-27), [data-model.md](data-model.md) §3.19–3.20.
**Restricción**: no modificar el comportamiento de los módulos existentes; solo extensiones aditivas.

### D-10 — Ciclo de vida del ticket correctivo sin reapertura

- **Decisión**: `open → in_progress → resolved`. Un ticket `resolved` es terminal; una nueva incidencia genera un ticket nuevo (con `operation_delay_id` o descripción propia) que puede referenciar al anterior en notas. La bandeja ordena por `priority` (urgent → high → normal) y luego por antigüedad.
- **Razón**: preserva trazabilidad append-only, evita reescribir historia y hace idempotente el escalamiento.
- **Alternativas descartadas**: permitir reapertura (borra el histórico de la intervención); reutilizar el mismo ticket para fallos distintos (mezcla causas y tiempos).

### D-11 — Una sola intervención activa por centro de trabajo

- **Decisión**: como máximo un ticket `in_progress` por `work_center_id`. La acción de tomar una intervención valida esta regla dentro de la misma transacción del store.
- **Razón**: una máquina no puede estar en dos reparaciones simultáneas; evita duplicar tiempos de parada y descuadrar la disponibilidad.
- **Alternativas descartadas**: permitir varias intervenciones simultáneas (solapa paradas y sesga el OEE); bloquear por técnico (el cuello de botella es la máquina).

### D-12 — Tiempo de parada derivado de marcas de tiempo

- **Decisión**: `downtime_minutes` se calcula al resolver con `downtime_ended_at − downtime_started_at` y se persiste como valor inmutable del ticket. La UI muestra el tiempo transcurrido mientras el ticket está `in_progress`, pero no lo escribe hasta el cierre.
- **Razón**: una sola fuente de verdad para US-08 (OEE/paradas) y resistencia a recargas; no depende de intervalos en memoria.
- **Alternativas descartadas**: cronómetro acumulativo en el cliente (se desincroniza al recargar); calcular la parada en US-08 a partir de `operation_delays` (no distingue parada técnica de otros atrasos).

### D-13 — Restablecimiento de la disponibilidad al resolver

- **Decisión**: al resolver, el centro sale de `fault` según el estado real de la operación activa: `in_operation` si hay operación `in_progress`, `paused` si la operación quedó pausada y disponible si no hay operación activa. La transición se deriva, no se fuerza desde la UI.
- **Razón**: evita dejar máquinas atascadas en `fault` y mantiene coherencia con US-06/US-07.
- **Alternativas descartadas**: fijar siempre `in_operation` (miente si la operación sigue pausada); dejar que el usuario elija el estado (introduce inconsistencia).

### D-14 — Desgaste y preventivas derivados del historial

- **Decisión**: el indicador de desgaste (frecuencia de fallos y paradas acumuladas por período) se calcula bajo demanda y no se persiste. `createPreventiveMaintenanceOrder` puede partir de ese indicador y de un `source_ticket_id`; la orden nace en `planned`.
- **Razón**: evita métricas almacenadas que se desactualizan y permite justificar la preventiva con datos reales.
- **Alternativas descartadas**: persistir un score de desgaste (mantenimiento y deriva); generar preventivas automáticamente sin confirmación (quita control al planificador).

### D-15 — Persistencia: snapshot `v2` con migración desde `v1`

- **Decisión**: las nuevas colecciones (`maintenanceTickets`, `preventiveMaintenanceOrders`) viven en `erp.manufacturing.v2`. Al hidratar, un snapshot `v1` válido se migra inicializando ambas colecciones vacías y se reescribe como `v2`; un snapshot inválido cae a fixtures con advertencia.
- **Razón**: el estado existente de US-01…US-08 se conserva y el cambio de forma queda explícito y verificable.
- **Alternativas descartadas**: mantener `v1` con colecciones opcionales (oculta el cambio y complica la validación); clave separada solo para mantenimiento (rompe la unidad del snapshot y la transacción).

### D-16 — Verificación de US-09

- **Decisión**: unitarias de `src/domain/maintenance.js` (transiciones, guard de intervención única, cálculo de parada, desgaste, disponibilidad, idempotencia por `operation_delay_id`), unitarias del store (acciones, migración `v1 → v2`, inmutabilidad ante error) e integración jsdom del panel (bandeja → intervención → cierre → recarga; alta y transición de preventiva). Se ejecutan además las suites de regresión de US-01…US-08.
- **Razón**: cumple el principio II y demuestra que las extensiones aditivas no alteran los módulos existentes.
- **Alternativas descartadas**: solo pruebas manuales; pruebas E2E con navegador real (sin infraestructura en el repo).

### Incógnitas resueltas (US-09)

| Incógnita | Resolución |
|---|---|
| ¿Se puede reabrir un ticket? | No; nueva incidencia = ticket nuevo (D-10). |
| ¿Varias reparaciones a la vez en una máquina? | No; máximo un ticket `in_progress` por centro (D-11). |
| ¿De dónde sale el tiempo de parada? | De marcas de tiempo persistidas al resolver (D-12). |
| ¿Qué pasa con la máquina al resolver? | La disponibilidad se deriva del estado de la operación activa (D-13). |
| ¿Se persiste el desgaste? | No; se deriva del historial (D-14). |
| ¿Cómo se preserva el estado existente? | Snapshot `v2` con migración desde `v1` (D-15). |
| ¿Cómo se prueba sin tocar US-01…US-08? | Unitarias + integración jsdom + regresión (D-16). |

No quedan incógnitas bloqueantes para la Fase 1 de US-09.
