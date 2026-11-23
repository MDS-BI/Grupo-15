# Contrato: Planificación y calendarización de órdenes (US-10)

**Rama**: `002-operations-manufacturing` | **Fecha**: 2026-11-03
**Referencias**: [spec.md](../spec.md) FR-11 / US-10 / AC-28…AC-33, [data-model.md](../data-model.md) §3.11, [plan.md](../plan.md) §10, [research.md](../research.md) §6

---

## 1. Propósito

Definir el contrato verificable entre la UI de planificación, el `ManufacturingStore` y el módulo puro `src/domain/order-scheduling.js`. Cubre la asignación y edición de fechas planificadas de inicio y término por orden, su validación y su persistencia en el snapshot local. No define endpoints HTTP: el módulo es frontend-only.

**Restricción de alcance**: el contrato es aditivo. No crea entidades nuevas ni cambia el comportamiento de US-01…US-09. Usa los campos `planned_start_date` y `planned_end_date` ya definidos en `production_orders`.

---

## 2. Entidades y campos

### `production_orders` (campos usados)
- `id`, `company_id`, `order_number` (único por empresa), `status` (`planned` | `released` | `in_progress` | `completed` | `cancelled`).
- `planned_start_date` (ISO-8601 `YYYY-MM-DD` o `null`), `planned_end_date` (ISO-8601 `YYYY-MM-DD` o `null`).
- `quantity_planned`, `priority` (solo lectura para esta vista).

### Invariantes
- `planned_end_date ≥ planned_start_date` cuando ambas existen.
- Ambas fechas son `null` o strings ISO-8601 válidas (`YYYY-MM-DD`); no se aceptan fechas parciales ni zonas horarias.
- Una orden `completed` o `cancelled` no admite cambios de fechas.
- El cambio de fechas no altera `status`, operaciones ni registros de ejecución.

---

## 3. Funciones puras (`src/domain/order-scheduling.js`)

Sin efectos secundarios ni acceso al reloj global.

### `isValidIsoDate(value)`
- Devuelve `true` solo para `null` o una fecha `YYYY-MM-DD` que exista en el calendario (rechaza `2026-02-30`).

### `validatePlannedDates({ planned_start_date, planned_end_date })`
1. Rechaza valores no ISO con `{ valid: false, error: 'fecha_invalida' }`.
2. Si ambas existen y `planned_end_date < planned_start_date`, devuelve `{ valid: false, error: 'rango_invertido' }`.
3. Si ambas son `null`, devuelve `{ valid: true }` (orden sin planificar).
4. Devuelve `{ valid: true }` en caso contrario.

### `canRescheduleOrder(order)`
- Devuelve `false` para órdenes `completed` o `cancelled`; `true` en el resto.
- No valida fechas; esa responsabilidad es de `validatePlannedDates`.

### `sortOrdersForScheduling(orders)`
- Ordena por `planned_start_date` ascendente (las `null` al final), luego por `priority` (`high` → `normal` → `low`) y luego por `order_number`.
- Devuelve una copia; no muta la lista original.

---

## 4. Acciones y consultas del store

Todas las acciones validan primero, mutan después y emiten un único evento `change`. Ante error, no mutan estado y lanzan `Error` con mensaje en español.

### `updatePlannedDates(orderId, { planned_start_date, planned_end_date })`
1. Rechaza si la orden no existe.
2. Rechaza si `canRescheduleOrder` es `false`.
3. Ejecuta `validatePlannedDates`; si falla, no muta y lanza el error correspondiente.
4. Normaliza `undefined` a `null` y fija ambas fechas.
5. Emite `change` y devuelve la orden actualizada.

### Consultas
- `ordersForScheduling({ status, dateFrom, dateTo })` → órdenes filtradas y ordenadas con `sortOrdersForScheduling`; `status` ausente incluye todas las reprogramables.
- `orderScheduleSummary()` → `{ planned, unplanned, overdue }`, donde `overdue` cuenta órdenes no completadas con `planned_end_date` anterior a la fecha de corte recibida por parámetro.

---

## 5. Contrato de UI (`ProductionSchedulingPanel`)

| Elemento | Estado | Comportamiento |
|---|---|---|
| Tabla de órdenes | Órdenes reprogramables y cerradas | Columnas: código, estado, prioridad, inicio planificado, término planificado, cantidad. |
| Filtros | Siempre visibles | Por estado y rango de fechas; no bloquean la tabla. |
| Edición inline | Orden reprogramable | Campos de fecha con validación al salir del campo; error inline y conservación del último valor válido. |
| Acción `Guardar` | Fila con cambios válidos | Persiste y muestra confirmación breve; deshabilitada si no hay cambios o hay error. |
| Acción `Limpiar fechas` | Orden reprogramable | Fija ambas fechas en `null` tras confirmación. |
| Órdenes cerradas | `completed`/`cancelled` | Fechas de solo lectura; sin acción de guardado. |
| Resumen | Parte superior | Planificadas, sin planificar y atrasadas según la fecha de corte. |
| Estados vacíos | Sin órdenes | Mensaje claro y enlace a la vista de órdenes. |

### Accesibilidad y consistencia
- Los campos de fecha usan etiquetas asociadas y mensajes de error vinculados por `aria-describedby`.
- La validación no depende solo del color.
- El patrón de tabla y filtros reutiliza el de US-03.
- No se muestran ni editan datos de operadores.

---

## 6. Reglas de cálculo

```
rango_válido   = planned_start_date == null || planned_end_date == null
                 || planned_end_date >= planned_start_date
atrasada       = status != completed && status != cancelled
                 && planned_end_date != null && planned_end_date < fecha_de_corte
```

- Las fechas se comparan como strings ISO `YYYY-MM-DD` (orden lexicográfico equivalente al cronológico).
- No se calculan duraciones ni se infieren fechas a partir de la capacidad; eso queda fuera de alcance.
- Los cambios de fecha no recalculan operaciones ni consumos.

---

## 7. Persistencia

- **Clave**: `erp.manufacturing.v2` (sin nueva versión ni colección).
- **Forma**: las fechas se guardan dentro de `production_orders` en `data`.
- **Migración**: no aplica; un snapshot `v1` se migra según el contrato de US-08 y conserva las fechas existentes.
- **Escritura**: tras cada guardado exitoso (write-through), sin bloquear la UI.
- **Reset de demo**: elimina `v2` (y opcionalmente `v1`) y recarga los fixtures.

---

## 8. Escenarios de verificación

1. **Asignación válida**: asignar inicio `2026-11-10` y término `2026-11-14` guarda y muestra ambas fechas.
2. **Rango invertido**: término `2026-11-09` con inicio `2026-11-10` se rechaza inline y no muta.
3. **Fecha inexistente**: `2026-02-30` se rechaza como inválida.
4. **Solo una fecha**: se permite guardar inicio sin término y viceversa.
5. **Limpiar**: ambas fechas vuelven a `null` y la orden aparece como no planificada.
6. **Orden cerrada**: una orden `completed` muestra las fechas en solo lectura y rechaza `updatePlannedDates`.
7. **Persistencia**: recargar rehidrata las fechas guardadas.
8. **Resumen**: una orden con término anterior a la fecha de corte y estado `released` cuenta como atrasada.
9. **Regresión**: las suites de US-01…US-09 siguen pasando sin cambios de comportamiento.

---

# Extensión US-12 a US-14 — Multi-rol, calendario y estaciones BOM

Las secciones 1 a 8 permanecen vigentes para US-10. Todo lo siguiente es aditivo y cubre FR-14 a FR-17 y AC-47 a AC-66. AC-67 a AC-76 se contratan en `contracts/maintenance.md`.

## 9. Cuentas, roles y permisos (US-12)

**Fuentes**: cinco tablas `role_users_plant_manager`, `role_users_supervisor`, `role_users_planner`, `role_users_operator`, `role_users_maintenance` en `erp.manufacturing.v2` (ver `data-model.md` 3.23 a 3.27).

| API | Firma / comportamiento |
|---|---|
| `CANONICAL_ROLES` | `['plant_manager', 'supervisor', 'planner', 'operator', 'maintenance']` |
| `rolesForUsername(username)` | Recorre las cinco tablas y devuelve la unión de roles sin duplicados. |
| `authenticate(username, password)` | Acepta `jefa/jefa`, `supervisor/supervisor`, `planificador/planificador`, `operador/operador`, `mantenimiento/mantenimiento`, `test/test` (cinco tablas) y `doble/doble` (operator + maintenance); `usuario` falla. |
| `modulesForRoles(roles)` | Unión de módulos permitidos para poblar el selector. |
| `isModuleAllowedForRoles(roles, moduleId)` | `true` si algún rol asignado habilita el módulo; el módulo activo se resuelve con `MODULE_ACCESS[activeRole]`. |
| `visibleEmployeeNamesFor(role)` | `supervisor`/`plant_manager` → nombres reales; otros → iniciales o conteo. |
| `visibleTechnicianNamesFor(role)` | `maintenance`/`plant_manager` → nombre; otros → máquina + duración. |

**`MODULE_ACCESS` (AC-51)**
- `plant_manager`: todos los módulos, incluido `admin-roles`.
- `supervisor`: `dashboard`, `operator`, `supervision`, `plant`, `scheduling`, `maintenance`, `roles` — ya no incluye `orders`.
- `planner`: `dashboard`, `bom`, `orders`, `plant`, `scheduling`, `line-balance`, `roles`.
- `operator`: exactamente `['operator', 'scheduling', 'roles']`; en scheduling solo ve el Calendario Mensual, sin pestaña “Listado”.
- `maintenance`: exactamente `['maintenance', 'scheduling']`.
- Los IDs de ruta (`#/orders`, `#/scheduling`, etc.) no cambian.

**UI (`#/admin-roles` y selector de la cabecera)**
- `src/components/RoleAdminPanel.js` reemplaza la función privada `adminRolesView()`; es exclusivo de `plant_manager`, muestra las cinco tablas y persiste altas de usuario/rol con `showToast`; tras logout/login aparecen en el menú superior y en `#/roles`.
- El `<select data-role="role-select">` de la cabecera es el único selector: se muestra solo si `rolesForUsername(username).length > 1` y no se duplica en otros paneles.
- `#/roles` conserva sus tarjetas descriptivas, pero no contiene un selector de rol adicional.
- El botón “Reiniciar datos de demo” sigue disponible solo para `realRole = plant_manager` con rol activo propio; usa `ConfirmDialog.js` y `Toast.js` existentes.

## 10. Campos extendidos de programación

| Colección | Campo | Regla |
|---|---|---|
| `production_orders` | `priority` | Ahora incluye `urgent`; solo `plant_manager` la cambia. |
| `production_orders` | `is_critical_urgent` | Booleano, `default false`; solo `plant_manager` lo marca; prioridad visual en el calendario. |
| `production_orders` | `scheduled_start_time` / `scheduled_end_time` | `HH:mm`, `default 08:00` / `16:00`; `end > start`; se aplican a cada día del rango. |
| `maintenance_tickets` | `scheduled_start_date` / `scheduled_end_date` | Requeridos para calendario; `end ≥ start`. |
| `preventive_maintenance_orders` | `scheduled_start_date` / `scheduled_end_date` | Derivados de `planned_date` si faltan al hidratar `v2`. |
| `order_stations` | ver §12 | Estaciones por orden y dotación editable. |

## 11. Funciones puras de calendario

- `validatePlannedDates({ planned_start_date, planned_end_date, scheduled_start_time, scheduled_end_time })` extiende la validación actual sin cambiar sus errores `fecha_invalida` / `rango_invertido`; agrega `hora_invalida` y `rango_horario_invertido`.
- `buildCalendarRange(startDay, endDay, startTime = '08:00', endTime = '16:00')` devuelve:

```js
{
  start_date: 'YYYY-MM-DD',
  end_date: 'YYYY-MM-DD',
  start_time: 'HH:mm',
  end_time: 'HH:mm',
  days: ['YYYY-MM-DD', ...]
}
```

- `calendarEventsForMonth(month, sources)` devuelve eventos `{ id, kind: 'order' | 'maintenance', sourceId, title, start_date, end_date, start_time, end_time, status, priority, is_critical_urgent, work_center_id }` para `month = 'YYYY-MM'`. Los mantenimientos se derivan de `maintenance_tickets` y `preventive_maintenance_orders` con fechas programadas, sin duplicar la preventiva que comparte `source_ticket_id`.
- `filterCalendarEvents(events, filter)` usa `filter.kind` con valores exactos `"Ambos"` (por defecto), `"Solo Órdenes de Trabajo"` y `"Solo Mantenciones"`; admite además centro y criticidad como filtros secundarios.
- `sortPendingOrders(orders)` ordena por `is_critical_urgent`, prioridad (`urgent > high > normal > low`), fecha de entrega y número de orden; cada fila expone `% de avance`.
- `canEditOrderSchedule(role)`: `planner` y `plant_manager` → `true`; `supervisor` ve el menú diario pero sin inputs de fecha/hora ni botones de guardar; `operator`, `maintenance` → `false`.
- `canViewOrderDetails(role)`: `operator` solo ve sus órdenes asignadas; `maintenance` ve el calendario en modo solo lectura; `supervisor` ve nombres reales con la etiqueta SC-08 “solo contexto operativo — no evaluación de desempeño”.
- El mes visible se recuerda entre cambios de pestaña y vuelve al mes actual al cambiar de usuario/rol, cerrar sesión o recargar (AC-53).

## 12. Derivación y persistencia de estaciones (US-14)

- `deriveBomStations(order, { routingOperations = [], workCenters = [] } = {})`:

```js
[
  {
    work_center_id: string,
    name: string,
    sequence: number,
    planned_time_minutes: number
  }
]
```

- La estación es el `work_center` (máquina), sin subdivisión. La secuencia se toma de `routing_operation.sequence` de la receta/ruta del BOM; `planned_time_minutes` usa `plannedTimeMinutes(operation, order.quantity_planned)` de `src/domain/operation-planning.js`; el orden siempre es ascendente por `sequence` y se conserva la integración con `capacity.js`.
- `ensureBomStationsForOrder(orderId)` se ejecuta al liberar la orden y es idempotente por `(production_order_id, work_center_id, sequence)`; crea filas `source = 'bom_derived'`.
- `setOrderStationStaffing(orderId, stations)` recibe `{ work_center_id, sequence, operator_ext_hr_employee_ids }`, elimina estaciones omitidas, agrega nuevas con `source = 'manual'` y persiste en `order_stations`.
- El detalle diario muestra `Secuencia <N>` con título explicativo y cantidad de trabajadores, sin doble numeración `1., 2., 3.` en la misma fila (AC-64).
- “Editar estaciones y trabajadores” (solo supervisor y plant_manager) redirige a `#/supervision` y abre esa orden en `SupervisorLinePanel.js`, persistiendo altas/bajas en `erp.manufacturing.v2`.
- `#/orders` conserva buscador, filtro de prioridad y su gestión de órdenes, sin controles de estaciones/operadores (AC-66).
- No se modifica `production_order_operations`, `shift_assignments` ni `capacity.js`; el editor usa `icon(name)` y `showToast`.

## 13. Acciones del store y contrato de UI

| Acción / consulta | Contrato |
|---|---|
| `pendingSchedulingOrders()` | Órdenes activas sin rango o con rango inválido; respeta `canRescheduleOrder`; visible solo para planner/plant_manager. |
| `calendarEventsForMonth(month)` | Eventos unificados de orden y mantenimiento para el mes. |
| `scheduleOrderRange(orderId, { startDate, endDate, startTime, endTime })` | Valida, persiste fechas/horas y emite `change`; solo planner/plant_manager. |
| `setOrderPriority(orderId, priority)` | Acepta `low \| normal \| high \| urgent`; solo plant_manager. |
| `setCriticalUrgent(orderId, flag)` | Actualiza solo `is_critical_urgent`; solo plant_manager. |
| `orderStationsFor(orderId)` | Devuelve estaciones ordenadas por secuencia con nombres resueltos. |

**`ProductionSchedulingPanel` extendido**
- La vista “Listado” US-10 se mantiene para los roles que tenían acceso a `orders` y se oculta para `operator` (AC-51). La vista “Calendario” usa CSS Grid mensual con celdas `.calendar-day`.
- Filtro superior: `"Ambos"` por defecto, `"Solo Órdenes de Trabajo"` y `"Solo Mantenciones"`; el segundo incluye tickets programados y órdenes preventivas.
- Bandeja “Pendiente de horario”: solo `planner` y `plant_manager`; ordenada por urgencia crítica/prioridad con `% de avance`; solo `plant_manager` cambia prioridad y marca “Urgencia crítica”.
- Foco (planner): un clic izquierdo simple en una orden pendiente aplica `.scheduling-focus-backdrop` y muestra `.scheduling-floating-card` siguiendo al cursor, con aviso bajo la cuadrícula de que clic derecho sale del modo.
- Arrastre: `mousedown` en un día y `mouseenter`/`mouseover` colorean en vivo `.calendar-day--drag-range`; `mouseup` cierra el modo y abre el popup con `"08:00"` y `"16:00"` editables; `contextmenu` debe llamar `preventDefault()` y cancelar sin popup.
- Menú por día: para planner, plant_manager y supervisor, clic en un día abre órdenes y mantenciones; elegir una tarea oculta las demás y muestra solo su detalle en `src/components/calendar/CalendarEventDialog.js`, con botón “Volver a la lista del día”.
- Supervisor: sin inputs de fecha/hora ni botones de guardar; eventos con `draggable="false"`; nombres reales con etiqueta SC-08, alerta de órdenes sin operador asignado y mantenciones como resumen de solo lectura.
- Plant_manager: indicadores compactos de color por día y resumen ejecutivo de productos, meta de producción, máquinas activas/inactivas y cantidad de operadores.
- Operator: solo sus órdenes asignadas y mantenciones en solo lectura.
- Las clases y estados del panel actual (`data-role="rows"`, `[data-summary]`, `[data-error]`) se conservan para no romper pruebas de Fases 1 a 24.

## 14. Escenarios de verificación US-12 a US-14

1. **Cinco cuentas**: login con `jefa`, `supervisor`, `planificador`, `operador` y `mantenimiento` funciona; `usuario` falla; `test` y `doble` también funcionan.
2. **Rol duplicado**: `test` ve cinco opciones en el selector; `doble` ve solo `operator` y `maintenance`; una cuenta con un solo rol no ve selector.
3. **Menú por rol**: supervisor no ve `orders`; operator ve exactamente `operator`, `scheduling`, `roles` y no ve “Listado”; maintenance ve exactamente `maintenance`, `scheduling`.
4. **Privacidad**: operator no ve nombres de `hr_employees` ni de técnicos; supervisor ve nombres de operarios con etiqueta SC-08; maintenance ve nombres de técnicos.
5. **Mes y filtros**: el mes se recuerda entre pestañas y vuelve al actual al cambiar de identidad o recargar; el filtro inicia en “Ambos”.
6. **Foco**: clic izquierdo simple en planner activa backdrop, tarjeta flotante y aviso de clic derecho para salir.
7. **Arrastre**: `mousedown` + `mouseenter` colorea el rango; `mouseup` abre popup `08:00`–`16:00`; `contextmenu` cancela sin popup.
8. **Bandeja**: una orden `released` sin fechas aparece solo para planner/jefa; solo jefa cambia prioridad y urgencia crítica.
9. **Menú diario**: planner/jefa/supervisor ven el menú; elegir una tarea abre `CalendarEventDialog.js` con “Volver a la lista del día”; supervisor no tiene inputs de guardar.
10. **Derivación y edición**: `deriveBomStations` precarga `Secuencia <N>`; “Editar estaciones y trabajadores” redirige a `#/supervision` y persiste altas/bajas; `#/orders` sigue sin controles de dotación.
11. **Regresión**: suites de US-10, US-11 y Fases 1 a 24 pasan sin cambios en `vitest.config.mjs`.
