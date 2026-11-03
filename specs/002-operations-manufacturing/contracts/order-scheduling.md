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
