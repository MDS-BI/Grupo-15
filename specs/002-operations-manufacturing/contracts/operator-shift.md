# Contrato: Registro de Turno del Operador (US-06)

**Rama**: `002-operations-manufacturing` | **Fecha**: 2026-10-29
**Referencias**: [spec.md](../spec.md) FR-07, [data-model.md](../data-model.md) §3.12/§3.16–3.18, [plan.md](../plan.md) US-06

---

## 1. Propósito

Definir el contrato verificable entre la UI del operador, el `ManufacturingStore` y el módulo puro `src/domain/shift-tracking.js`. Cubre inicio/fin de operación, atrasos justificados, contadores de piezas y persistencia. No define endpoints HTTP: el módulo es frontend-only y usa un snapshot local.

---

## 2. Entidades y campos obligatorios

### `production_shifts`
- `id`, `po_operation_id`, `shift_number ≥ 1`, `status` (`in_progress` | `completed`), `started_at`, `quantity_counted ≥ 0`.
- `operator_id` y `ended_at` son nullable.
- Invariantes: máximo un turno `in_progress` por operación y por operador; `shift_number` único por operación; al cerrar, `ended_at ≥ started_at`.

### `operation_delays`
- `id`, `po_operation_id`, `production_shift_id`, `delay_reason_id`, `started_at`, `status` (`open` | `closed`).
- `ended_at`, `duration_minutes`, `note`, `corrected_at`, `corrected_by`, `correction_note` son nullable.
- Invariantes: máximo un atraso `open` por operación; `status = open` ⇔ `ended_at IS NULL`; `ended_at ≥ started_at`; `duration_minutes ≥ 0` calculada al cerrar.

### `delay_reasons`
- `id`, `company_id`, `label` no vacío, `origin` (`predefined` | `custom`), `scope` (`global` | `shift`), `active`.
- Invariantes: `predefined ⇒ global`; `custom ⇒ shift` con `production_shift_id`; `label` único por empresa sin distinguir mayúsculas.

### `production_order_operations` (campos de US-06)
- `quantity_completed`: acumulado, `≥ 0`, nunca se reinicia.
- `actual_time_minutes`: tiempo efectivo, `≥ 0`, recalculable al corregir atrasos.
- `delay_time_minutes`: suma de atrasos cerrados, `≥ 0`.
- `started_at` / `completed_at`: ISO-8601; `completed_at` se fija una sola vez.

---

## 3. Acciones del store

Todas las acciones validan primero, mutan después y emiten un único evento `change`. Ante error, no mutan estado y lanzan `Error` con mensaje en español.

### `startShift(operationId, { operator_id }?)`
1. Rechaza si la operación no existe, está `completed`, o si el operador ya tiene otra operación `in_progress`.
2. Rechaza si ya existe un turno `in_progress` para la operación.
3. Crea `production_shifts` con `shift_number = max + 1`, `quantity_counted = 0`, `started_at = now`.
4. Pone la operación `in_progress`, fija `started_at` si es la primera vez y deriva el estado de la orden (`released → in_progress`).
5. Devuelve `{ shift, operation, order }`.

### `finishOperation(operationId)`
1. Rechaza si la operación no está `in_progress` (incluye doble cierre e idempotencia).
2. Fija `completed_at = now`, cierra el turno activo (`status = completed`, `ended_at = completed_at`).
3. Calcula `delay_time_minutes` con atrasos cerrados y `actual_time_minutes` con la fórmula de §5. Los atrasos abiertos **no** se descuentan.
4. Marca la operación `completed`, conserva los atrasos abiertos como *pendientes de corrección* y llama a `recomputeOrderStatus`.
5. Devuelve `{ operation, order, openDelays }`.

### `startDelay(operationId, { reasonId, customLabel, note }?)`
1. Rechaza si la operación no está `in_progress`, si ya hay un atraso `open`, o si no hay motivo resoluble.
2. Si `customLabel` viene informado, crea un `delay_reasons` `custom`/`shift` para el turno activo (rechaza etiqueta duplicada).
3. Crea `operation_delays` con `status = open`, `started_at = now`, `ended_at = null`, `duration_minutes = null`.
4. Devuelve el atraso creado.

### `closeDelay(delayId)`
1. Rechaza si el atraso no existe o ya está cerrado.
2. Fija `ended_at = now`, `duration_minutes = (ended_at − started_at)` en minutos decimales, `status = closed`.
3. Recalcula `delay_time_minutes` y, si la operación ya está `completed`, `actual_time_minutes`.
4. Devuelve el atraso actualizado.

### `correctOpenDelay(delayId, { endedAt, note })`
1. Solo aplica a atrasos `open` de operaciones `completed`.
2. Valida `endedAt ≥ started_at` y `endedAt ≤ completed_at`.
3. Fija `ended_at`, `duration_minutes`, `status = closed`, `corrected_at = now`, `corrected_by`, `correction_note = note`.
4. Recalcula `delay_time_minutes` y `actual_time_minutes` de la operación.
5. Devuelve el atraso actualizado. Nunca elimina registros.

### `adjustShiftCounter(operationId, delta)` / `setShiftCounter(operationId, value)`
1. Rechaza valores no numéricos, `NaN`, `Infinity` o resultados `< 0`.
2. Ajusta `production_shifts.quantity_counted` y aplica el mismo delta a `production_order_operations.quantity_completed` (nunca `< 0`).
3. Conserva el último valor válido si la validación falla; la UI muestra el error inline.
4. Devuelve `{ shiftQuantity, cumulativeQuantity }`.

### Consultas
- `activeShiftFor(operationId)` → turno `in_progress` o `null`.
- `openDelayFor(operationId)` → atraso `open` o `null`.
- `delaysForOperation(operationId)` → todos los atrasos, ordenados por `started_at`.
- `reasonsForShift(shiftId)` → predefinidos activos + personalizados del turno.

---

## 4. Contrato de UI (`OperatorWorkstationPanel`)

| Elemento | Estado | Comportamiento |
|---|---|---|
| Botón alterno | Operación `pending`/`paused` | Texto `Iniciar`; habilita `startShift`. |
| Botón alterno | Operación `in_progress` | Texto `Finalizar`; abre confirmación. |
| Botón alterno | Operación `completed` | Deshabilitado; texto `Finalizada`. |
| Confirmación | Antes de `finishOperation` | Resume tiempo efectivo, atrasos abiertos y piezas; `Cancelar` no muta nada. |
| Cronómetro | Turno activo | Se calcula desde `started_at` y descuenta atrasos cerrados; tolerancia ≤ 1 s; no usa intervalos acumulativos. |
| Selector de motivo | Atraso nuevo | Lista predefinidos + personalizados del turno; opción "Nuevo motivo…" revela un campo de texto. |
| Botón `Registrar atraso` | Sin atraso abierto | Crea atraso; se deshabilita mientras hay uno abierto. |
| Botón `Finalizar atraso` | Atraso abierto | Cierra el atraso y recalcula el tiempo efectivo. |
| Aviso de atraso abierto | Operación `completed` con atraso `open` | Muestra *Abierto — pendiente de corrección* y abre `DelayCorrectionDialog`. |
| Contador de turno | Siempre visible | `+`, `−`, edición directa y `Fijar`; rechaza negativos/no numéricos con error inline; muestra el último valor válido. |
| Contador acumulado | Siempre visible | Solo lectura; refleja `quantity_completed` y se actualiza en el mismo evento. |
| Resumen | Operación y orden | Tiempo total, tiempo de atrasos, piezas del turno, piezas acumuladas y avance de la orden. |

### Accesibilidad y consistencia
- El botón alterno expone `aria-pressed` y un `aria-label` que incluye la operación.
- La confirmación atrapa el foco y se cierra con `Esc` (equivale a `Cancelar`).
- Los errores de contador y motivo usan el mismo patrón inline del resto del módulo.
- El aviso de atraso abierto usa el mismo estilo de advertencia que las discrepancias de inventario.

---

## 5. Cálculo de tiempo

```
elapsed_minutes   = (completed_at − started_at) / 60000
closed_delay_min  = Σ operation_delays.duration_minutes  (solo status = closed)
open_delay_min    = Σ (now − started_at) / 60000         (solo para mostrar en vivo)
actual_time_minutes = max(0, elapsed_minutes − closed_delay_min)
```

- `duration_minutes` se redondea a 2 decimales; la UI muestra segundos.
- La diferencia aceptable entre el cronómetro mostrado y los timestamps persistidos es ≤ 1 s.
- Los atrasos abiertos al finalizar no se descuentan hasta su corrección; la corrección recalcula `actual_time_minutes`.
- Un `endedAt` propuesto en la corrección no puede ser anterior a `started_at` ni posterior a `completed_at`.

---

## 6. Persistencia

- **Clave**: `erp.manufacturing.v1`.
- **Forma**: `{ version: 1, savedAt: ISO-8601, data: { productionOrders, productionOrderOperations, productionShifts, operationDelays, delayReasons, materialConsumption, productionOutput } }`.
- **Escritura**: tras cada mutación exitosa del store (write-through), sin bloquear la UI.
- **Lectura**: al arrancar se valida `version` y la forma mínima de cada colección. Si falta, está corrupta o es de otra versión, se ignoran los datos y se cargan los fixtures; se registra una advertencia visible.
- **Rehidratación**: los cronómetros se recalculan desde `started_at`/`ended_at`; nunca se reanuda un contador de segundos en memoria.
- **Reset de demo**: acción explícita que elimina la clave y recarga los fixtures.

---

## 7. Escenarios de verificación

1. **Inicio/fin feliz**: `pending → in_progress → completed`; `started_at`/`completed_at` presentes; orden `released → in_progress → completed`; sin doble cierre.
2. **Segundo inicio**: con una operación `in_progress`, otro `startShift` falla y no muta estado.
3. **Doble finalización**: dos `finishOperation` consecutivos; el segundo falla y conserva `completed_at`.
4. **Atraso cerrado**: atraso de 10 min descuenta 10 min del tiempo efectivo; `delay_time_minutes = 10`.
5. **Atraso abierto al finalizar**: la operación cierra, el atraso queda `open` y no se descuenta; la UI lo marca pendiente.
6. **Corrección posterior**: `correctOpenDelay` fija 5 min; `actual_time_minutes` se reduce en 5 y se registra `corrected_at`.
7. **Motivo obligatorio**: `startDelay` sin motivo falla; con motivo personalizado duplicado falla.
8. **Atrasos simultáneos**: un segundo `startDelay` con atraso abierto falla.
9. **Contadores**: `+10` en turno lleva acumulado a `+10`; `-3` lo baja a `7`; `-100` se rechaza; `setShiftCounter(NaN)` se rechaza y conserva el valor.
10. **Nuevo turno**: al abrir otro turno, `quantity_counted = 0` y `quantity_completed` conserva el acumulado.
11. **Recarga**: tras `startShift` y un atraso, recargar rehidrata turno, atraso y contadores; el cronómetro continúa desde `started_at`.
12. **Snapshot corrupto**: un JSON inválido o `version` distinta se descarta y se cargan fixtures sin romper el arranque.
