# Contrato: Mantenimiento (US-09)

**Rama**: `002-operations-manufacturing` | **Fecha**: 2026-11-03
**Referencias**: [spec.md](../spec.md) FR-10 / US-09 / AC-21…AC-27, [data-model.md](../data-model.md) §3.19–3.20, [plan.md](../plan.md) §9, [research.md](../research.md) §4

---

## 1. Propósito

Definir el contrato verificable entre la UI de mantenimiento, el `ManufacturingStore` y el módulo puro `src/domain/maintenance.js`. Cubre la bandeja de tickets correctivos, la intervención, el cierre con tiempo de parada, la disponibilidad del centro de trabajo, el historial/desgaste y las órdenes preventivas. No define endpoints HTTP: el módulo es frontend-only y usa el snapshot local.

**Restricción de alcance**: el contrato es aditivo. No cambia firmas, acciones ni comportamiento de US-01…US-08. La integración con US-07 (entrada de tickets) y US-08 (lectura de paradas/OEE) se realiza por las colecciones descritas aquí.

---

## 2. Entidades y campos obligatorios

### `maintenance_tickets`
- `id`, `company_id`, `ticket_code` (único por empresa), `work_center_id`, `priority` (`urgent` | `high` | `normal`), `ticket_status` (`open` | `in_progress` | `resolved`), `escalated_to_maint`, `description` no vacío.
- `po_operation_id`, `operation_delay_id`, `reported_by`, `cause_reason_id`, `resolution_notes` son nullable.
- `technician_ext_hr_employee_id`, `intervention_started_at`, `resolved_at`, `downtime_started_at`, `downtime_ended_at`, `downtime_minutes` son nullable con obligatoriedad según estado.
- Invariantes: `operation_delay_id` único cuando no es `null`; máximo un ticket `in_progress` por `work_center_id`; `resolved` exige `resolved_at`, marcas de parada y `downtime_minutes ≥ 0`; `resolved_at ≥ intervention_started_at`; `downtime_ended_at ≥ downtime_started_at`; un ticket resuelto no se reabre ni se elimina.

### `preventive_maintenance_orders`
- `id`, `company_id`, `order_code` (único por empresa), `work_center_id`, `title` no vacío, `planned_date`, `status` (`planned` | `in_progress` | `completed` | `cancelled`).
- `source_ticket_id`, `technician_ext_hr_employee_id`, `completed_at`, `downtime_minutes`, `notes` son nullable.
- Invariantes: `planned → in_progress → completed`; `cancelled` solo desde `planned` o `in_progress`; `completed` ⇒ `completed_at` no nulo; `downtime_minutes ≥ 0`; no reabre ni reemplaza `source_ticket_id`.

### Campos de solo lectura consumidos
- `work_centers.operational_status` / `capacity_per_day_minutes`: se leen para disponibilidad y contexto; no se reescriben desde este contrato salvo la transición derivada al resolver.
- `operation_delays`: origen del escalamiento; US-09 no los muta.
- `production_order_operations`: se leen para determinar la operación activa al resolver.

---

## 3. Acciones del store

Todas las acciones validan primero, mutan después y emiten un único evento `change`. Ante error, no mutan estado y lanzan `Error` con mensaje en español.

### `startMaintenanceIntervention(ticketId, { technician_ext_hr_employee_id })`
1. Rechaza si el ticket no existe o no está `open`.
2. Rechaza si falta el técnico o si ya existe un ticket `in_progress` en el mismo `work_center_id`.
3. Fija `ticket_status = in_progress`, `technician_ext_hr_employee_id`, `intervention_started_at = now`.
4. Deriva `work_centers.operational_status = fault` si aún no lo estaba.
5. Devuelve `{ ticket, workCenter }`.

### `resolveMaintenanceTicket(ticketId, { resolvedAt, downtimeStartedAt, downtimeEndedAt, causeReasonId, notes })`
1. Rechaza si el ticket no está `in_progress`.
2. Valida `resolvedAt ≥ intervention_started_at` y `downtimeEndedAt ≥ downtimeStartedAt`.
3. Calcula `downtime_minutes = (downtimeEndedAt − downtimeStartedAt) / 60000` redondeado a 2 decimales; rechaza negativos.
4. Fija `ticket_status = resolved`, `resolved_at`, marcas de parada, `cause_reason_id` y `resolution_notes`.
5. Restablece la disponibilidad del centro con `resolveAvailabilityStatus` (ver §5).
6. Devuelve `{ ticket, workCenter }`. Nunca elimina el ticket.

### `createPreventiveMaintenanceOrder({ workCenterId, sourceTicketId, plannedDate, title, technician_ext_hr_employee_id })`
1. Rechaza si falta `workCenterId`, `plannedDate` o `title`, o si el centro no existe.
2. Si viene `sourceTicketId`, valida que exista y pertenezca al mismo `work_center_id`.
3. Crea la orden con `status = planned`, `order_code` autogenerado y `completed_at = null`.
4. Devuelve la orden creada.

### `transitionPreventiveMaintenanceOrder(orderId, nextStatus)`
1. Rechaza transiciones no permitidas por la máquina de estados.
2. Si `nextStatus = completed`, exige y fija `completed_at = now`; valida `downtime_minutes ≥ 0` si se informa.
3. Devuelve la orden actualizada.

### `cancelPreventiveMaintenanceOrder(orderId, { reason })`
1. Solo aplica desde `planned` o `in_progress`; rechaza desde `completed` o `cancelled`.
2. Fija `status = cancelled` y registra el motivo en `notes`.
3. Devuelve la orden actualizada.

### Consultas
- `maintenanceTicketsFor({ status, priority, workCenterId })` → tickets filtrados y ordenados por prioridad (`urgent → high → normal`) y luego por antigüedad.
- `activeInterventionForWorkCenter(workCenterId)` → ticket `in_progress` o `null`.
- `maintenanceHistoryForWorkCenter(workCenterId)` → tickets resueltos ordenados por `resolved_at` descendente.
- `preventiveOrdersFor({ status, workCenterId })` → órdenes preventivas filtradas.
- `maintenanceIndicatorsForWorkCenter(workCenterId, period)` → desgaste derivado (frecuencia de fallos, paradas acumuladas, MTTR); **no se persiste**.

---

## 4. Contrato de UI (`MaintenancePanel`)

| Elemento | Estado | Comportamiento |
|---|---|---|
| Bandeja de tickets | Tickets `open`/`in_progress` | Orden por prioridad y antigüedad; filtros por estado, prioridad y centro. |
| Acción `Tomar intervención` | Ticket `open` | Abre diálogo de técnico; deshabilitada si el centro ya tiene una intervención activa. |
| Acción `Resolver` | Ticket `in_progress` | Exige `resolvedAt`, marcas de parada y causa; muestra el tiempo de parada calculado antes de confirmar. |
| Historial por máquina | Centro seleccionado | Lista de tickets resueltos y desgaste agregado; etiqueta *solo contexto operativo*. |
| Acción `Programar preventiva` | Centro seleccionado | Alta con fecha objetivo, título y técnico opcional; parte del desgaste y de un ticket de origen si existe. |
| Acciones de orden preventiva | `planned`/`in_progress` | `Iniciar`, `Completar` y `Cancelar` según transiciones válidas. |
| Aviso de máquina detenida | Centro en `fault` con ticket activo | Banner con ticket, técnico y tiempo transcurrido desde `downtime_started_at`/`intervention_started_at`. |
| Estados vacíos | Sin tickets / sin historial / sin preventivas | Mensajes claros y acción primaria para el siguiente paso. |

### Accesibilidad y consistencia
- Los diálogos atrapan el foco y se cierran con `Esc` (equivale a cancelar).
- Los errores usan el mismo patrón inline del resto del módulo.
- El semáforo y las etiquetas de prioridad reutilizan los colores y textos de US-07.
- La información de técnicos se presenta como contexto de la intervención, nunca como ranking.

---

## 5. Reglas de cálculo y derivación

```
downtime_minutes = max(0, (downtime_ended_at − downtime_started_at) / 60000)
response_minutes = (intervention_started_at − created_at) / 60000
repair_minutes   = (resolved_at − intervention_started_at) / 60000
wear_indicator   = f(fallos por período, paradas acumuladas)   # derivado, no persistido
```

**Disponibilidad al resolver**

```
si existe operación activa in_progress  → work_center.operational_status = in_operation
si la operación activa está paused      → work_center.operational_status = paused
si no hay operación activa              → work_center.operational_status = disponible
```

- `downtime_minutes` se redondea a 2 decimales.
- No se deja el centro en `fault` sin un ticket abierto.
- El desgaste y el MTTR son indicadores de máquina, no de personas.

---

## 6. Persistencia

- **Clave**: `erp.manufacturing.v2`.
- **Forma**: `{ version: 2, savedAt: ISO-8601, data: { ...colecciones existentes, maintenanceTickets, preventiveMaintenanceOrders } }`.
- **Migración**: si existe `erp.manufacturing.v1` válido, se copia su `data`, se inicializan `maintenanceTickets = []` y `preventiveMaintenanceOrders = []`, y se reescribe como `v2`. Un snapshot inválido o corrupto se descarta y se cargan fixtures con advertencia visible.
- **Escritura**: tras cada mutación exitosa del store (write-through), sin bloquear la UI.
- **Rehidratación**: los tiempos se recalculan desde `intervention_started_at`/`downtime_*`; nunca se reanuda un contador de segundos en memoria.
- **Reset de demo**: elimina `v2` (y opcionalmente `v1`) y recarga los fixtures.

---

## 7. Escenarios de verificación

1. **Bandeja priorizada**: tickets `normal`, `high` y `urgent` se muestran en ese orden inverso de prioridad y, a igual prioridad, por antigüedad.
2. **Toma de intervención**: un ticket `open` pasa a `in_progress`, registra técnico e inicio, y el centro queda en `fault`.
3. **Doble intervención**: con un ticket `in_progress` en el centro, tomar otro ticket del mismo centro falla y no muta estado.
4. **Cierre feliz**: resolver registra marcas de parada, calcula `downtime_minutes`, deja el ticket `resolved` y restablece la disponibilidad según la operación activa.
5. **Cierre inválido**: `downtimeEndedAt < downtimeStartedAt` o `resolvedAt < intervention_started_at` falla sin mutar.
6. **Sin reapertura**: intentar volver un ticket `resolved` a `in_progress` falla; una nueva incidencia crea un ticket nuevo.
7. **Idempotencia del escalamiento**: dos altas con el mismo `operation_delay_id` producen un solo ticket.
8. **Historial y desgaste**: el historial lista tickets resueltos y el indicador de desgaste se calcula sin persistirse.
9. **Preventiva**: crear una orden desde el historial la deja `planned`; `planned → in_progress → completed` funciona; `cancelled` desde `completed` falla.
10. **Persistencia**: tras intervenir y resolver, recargar rehidrata tickets, marcas de tiempo y órdenes preventivas.
11. **Migración**: un snapshot `v1` válido se migra a `v2` conservando el estado de US-01…US-07 e inicializando umbrales, permisos y colecciones de mantenimiento vacías; un `v2` existente de US-08 se completa sin perder su estado.
12. **Snapshot corrupto**: un JSON inválido o `version` desconocida se descarta y se cargan fixtures sin romper el arranque.
13. **Regresión**: las suites de US-01…US-08 siguen pasando sin cambios de comportamiento.

---

# Extensión US-15 — Tres pestañas, programación y sincronización con calendario

Las secciones 1 a 7 permanecen vigentes para US-09. Todo lo siguiente es aditivo y cubre FR-12, FR-15, FR-18 y AC-67 a AC-76.

## 8. Vista de tres pestañas

`MaintenancePanel(store)` conserva su exportación única y muestra exactamente las subpestañas **Máquinas**, **Tickets** y **Mantenimientos** (AC-67).

### 8.1 Máquinas (AC-68)

- Buscador por nombre y filtro por sección (`work_centers.station_type`).
- Alerta superior de máquinas sin preventiva o cuya frecuencia recomendada fue superada.
- Campo “Cada cuánto se recomienda mantención” editable solo por `maintenance` y `plant_manager`.
- Badge por máquina: `Frenada por mantención` / `Disponible` / `En operación`.
- Historial de fallas, paradas acumuladas e indicador `deriveWearIndicator`.
- Acciones `Programar preventiva` y `Revisar históricas`; la segunda enfoca la subpestaña “Mantenimientos”, el bloque “Históricos” y prellena su buscador con la máquina elegida.

### 8.2 Tickets (AC-69/AC-70)

- Solo la tabla de tickets: sin banner duplicado, sin panel lateral y sin tabla de preventivas.
- Al hacer clic en un ticket se despliega debajo un recuadro con detalle del ticket, historial de fallas, historial completo de mantenciones e indicador `deriveWearIndicator` con nivel `Bajo` / `Medio` / `Alto`, conteo de fallas y minutos acumulados.
- `Programar mantención` abre un modal con técnico, inicio (`scheduled_start_date`) y plazo (`scheduled_end_date`). Guardar pasa el ticket a `in_progress`, la máquina a `fault` y el registro aparece de inmediato en el calendario y en el bloque “Activos”.
- Fecha de inicio por defecto = `relativeDay(0)` y plazo = `daysFromNow(1)`; técnico = `technicianLabel(id)` cuando ya existe.

### 8.3 Mantenimientos (AC-71)

- Refleja el 100 % de las mantenciones del calendario en tres bloques con buscador propio por máquina o código:
  - **Activos**: acciones `Resolver`.
  - **No resueltos por vencimiento**: acciones `Resolver`.
  - **Históricos**: acción `Eliminar`, confirmada con `ConfirmDialog.js`, que borra el registro de `erp.manufacturing.v2` y del calendario.

El estado de la pestaña activa y los buscadores son transitorios: se conservan mientras el panel esté montado y se descartan al cambiar de rol o recargar.

## 9. Modelo unificado y campos

| Colección | Campos nuevos | Uso |
|---|---|---|
| `maintenance_tickets` | `scheduled_start_date`, `scheduled_end_date` | Programación correctiva desde ticket; ambos requeridos para calendario. |
| `preventive_maintenance_orders` | `scheduled_start_date`, `scheduled_end_date` | Derivados de `planned_date` si faltan en snapshots `v2` antiguos. |
| `work_centers` | `recommended_maintenance_frequency_days` | Días entre mantenciones preventivas recomendadas; editable por `maintenance` y `plant_manager`. |

**Evento unificado** devuelto por `maintenanceFeed()` y por `calendarEventsForMonth()`:

```js
{
  id: string,
  kind: 'corrective' | 'preventive',
  sourceId: string,
  title: string,
  work_center_id: string,
  technician_ext_hr_employee_id: string | null,
  scheduled_start_date: 'YYYY-MM-DD',
  scheduled_end_date: 'YYYY-MM-DD',
  status: 'open' | 'in_progress' | 'resolved' | 'planned' | 'completed' | 'cancelled',
  is_overdue: boolean,
  visible_end_date: 'YYYY-MM-DD',
  resolved_at: string | null
}
```

- Un ticket con `source_ticket_id` en una preventiva aparece dos veces solo si ambos registros tienen fechas programadas propias; la preventiva no se fusiona con el ticket.
- `visible_end_date` se calcula con `effectiveMaintenanceEnd(event, today)`:
  - activo vencido → `today` (AC-73);
  - resuelto antes del plazo → fecha real de resolución;
  - en otro caso → `scheduled_end_date`.
- La fecha original nunca se sobreescribe; el vencimiento es una proyección derivada.

## 10. Funciones puras adicionales

| Función | Contrato |
|---|---|
| `buildScheduledMaintenanceFromTicket(ticket, { scheduled_start_date, scheduled_end_date, technician_ext_hr_employee_id })` | Valida fechas ISO, `end ≥ start` y técnico no vacío; devuelve un evento `corrective` sin mutar el ticket. |
| `computeCorrectiveDowntime(startedAt, resolvedAt)` | Devuelve minutos `≥ 0` redondeados a 2 decimales entre inicio de intervención y resolución, sin ingreso manual (AC-72). |
| `effectiveMaintenanceEnd(event, today)` | Aplica la regla de fecha visible del §9 (AC-73). |
| `isResolvedMaintenance(event)` | `corrective ⇒ ticket_status = resolved`; `preventive ⇒ status = completed \| cancelled`. |
| `canResolveScheduledMaintenance(event)` | `false` si ya está resuelta/completada/cancelada; `true` para `open`, `in_progress` y `planned`. |
| `canRescheduleMaintenance(role)` | `true` solo para `maintenance`; los demás roles son solo lectura. |
| `canEditMaintenanceFrequency(role)` | `true` para `maintenance` y `plant_manager` (AC-68). |

## 11. Acciones del store

| Acción | Contrato |
|---|---|
| `maintenanceFeed()` | Devuelve tickets y preventivas unificados y ordenados por `scheduled_start_date`, prioridad y código. |
| `scheduleMaintenanceFromTicket(ticketId, { technician_ext_hr_employee_id, scheduled_start_date, scheduled_end_date })` | Persiste fechas y técnico; pasa ticket a `in_progress` y máquina a `fault`; emite `change`. |
| `schedulePreventiveMaintenance(orderId, { scheduled_start_date, scheduled_end_date })` | Persiste el rango; mantiene `planned_date` como legado; emite `change`. |
| `setRecommendedMaintenanceFrequency(workCenterId, days)` | Persiste días ≥ 1; solo `maintenance` / `plant_manager`; emite `change`. |
| `resolveScheduledMaintenance(id, { resolvedAt })` | Solo `maintenance`. Correctivo: calcula inactividad desde `intervention_started_at` y cierra con `resolveMaintenanceTicket`. Preventiva: transiciona a `completed` con `completed_at = resolvedAt` y calcula inactividad. Rechaza eventos ya cerrados; nunca cierra por fecha. |
| `deleteResolvedMaintenance(id)` | Solo desde “Históricos” y solo con rol `maintenance`; exige `ConfirmDialog.js`, muestra `showToast`, emite `change` y elimina el registro de `v2` y del calendario. Única excepción demo a append-only de US-09; nunca reactiva ni reabre. |

`resolveMaintenanceTicket` original sigue disponible para US-09 y sus pruebas; la nueva acción no cambia su firma.

## 12. Contrato de UI y sincronización con calendario

- La pestaña “Mantenimientos” y el calendario leen el mismo `maintenanceFeed()`: programar, reprogramar o eliminar en un lado actualiza el otro tras `change`.
- Cada bloque filtra solo por máquina o código; “Revisar históricas” prellena el buscador histórico con la máquina elegida desde Máquinas.
- Desde un ticket, `Programar mantención` usa el modal descrito en §8.2 y respeta la transición a `in_progress`/`fault`.
- La creación de preventivas usa `buildPreventiveOrderFromHistory` existente y luego `schedulePreventiveMaintenance`; **ninguna preventiva se resuelve sola** al vencer el plazo.
- En el calendario, solo `maintenance` ve “Resolver” y no existe bandeja manual de resolución. Al seleccionar una activa ve tiempo parado, técnico y prioridad; al seleccionar una resuelta la abre en solo lectura sin el botón.
- Popup “Resolver”: mensaje exacto **“¿Está seguro que quiere resolver esta mantención?”**, campo `datetime-local` editable prellenado con la **hora ACTUAL del sistema al hacer clic** (no con la hora de la celda). Al aceptar se llama `resolveScheduledMaintenance` con esa marca; la inactividad se calcula sola.
- Una mantención resuelta no se puede resolver ni editar en ninguna vista; la corrección exige eliminarla en “Históricos” y crearla de nuevo (AC-74).
- `ConfirmDialog.js` se usa para el borrado histórico; `Toast.js` confirma cada mutación; `format.js`, `labels.js`, `icons.js` y `demo-dates.js` son la única fuente de formato, nombres, iconos y fechas dinámicas.
- Nombres de técnicos se muestran solo para `maintenance` y `plant_manager`; otros roles ven `Máquina <code> · <duración>`.

## 13. Escenarios de verificación US-15 y FR-18

1. **Pestañas (AC-67)**: el panel muestra exactamente “Máquinas”, “Tickets” y “Mantenimientos”.
2. **Máquinas (AC-68)**: alerta de frecuencia vencida, campo editable solo por roles permitidos, badges, historial, `deriveWearIndicator`, “Programar preventiva” y “Revisar históricas” con búsqueda prellenada.
3. **Tickets (AC-69)**: solo tabla; `Programar mantención` pasa ticket a `in_progress`, máquina a `fault` y sincroniza calendario/“Activos”.
4. **Detalle (AC-70)**: clic en ticket despliega detalle, historial de fallas, historial de mantenciones y nivel Bajo/Medio/Alto con conteo y minutos.
5. **Bloques (AC-71)**: los tres bloques reflejan el 100 % del calendario; borrado histórico con `ConfirmDialog.js` elimina de `v2` y del calendario.
6. **Resolución correctiva (AC-72)**: resolver calcula parada real sin ingreso manual; una preventiva vencida no se cierra sola.
7. **Fechas (AC-73)**: activo vencido muestra fecha hasta hoy; resuelto antes de plazo muestra fecha real de resolución.
8. **Inmutabilidad (AC-74)**: resuelto no se edita ni se resuelve de nuevo; corregir implica borrar en históricos y crear de nuevo.
9. **Calendario (AC-75)**: solo maintenance ve “Resolver”; popup con mensaje exacto y hora actual editable; resuelto queda solo lectura.
10. **FR-18 (AC-76)**: mejoras de `main`, IDs de ruta, nombre del paquete, `vitest.config.mjs` y `index.html` permanecen intactos.
11. **Regresión**: suites de US-09, US-10 y Fases 1 a 24 siguen pasando sin cambios en `vitest.config.mjs`.
