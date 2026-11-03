# Contrato: Panel de desempeño de planta (US-08)

**Rama**: `002-operations-manufacturing` | **Fecha**: 2026-11-03
**Referencias**: [spec.md](../spec.md) FR-09 / US-08 / AC-04…AC-07 y AC-20, [data-model.md](../data-model.md) §3.21–3.22, [plan.md](../plan.md) §10, [research.md](../research.md) §5

---

## 1. Propósito

Definir el contrato verificable entre la UI del panel de planta, el `ManufacturingStore` y el módulo puro `src/domain/plant-performance.js`. Cubre los indicadores consolidados (carga, OEE, paradas por motivo y cumplimiento), los umbrales de alarma, la matriz rol×acción simulada, las acciones de reprogramación/cancelación y la exportación local. No define endpoints HTTP: el módulo es frontend-only y usa el snapshot local.

**Restricción de alcance**: el contrato es aditivo. No cambia firmas, acciones ni comportamiento de US-01…US-07 ni US-09. Consume `production_order_operations`, `operation_delays`, `maintenance_tickets`, `work_centers` y `production_orders` sin reescribirlos, salvo las acciones explícitas de prioridad y cancelación descritas en §3.

---

## 2. Entidades y campos obligatorios

### `threshold_settings`
- `id`, `company_id`, `indicator` (`load` | `oee` | `downtime` | `fulfillment`), `threshold`, `comparison` (`lt` | `gt`), `updated_at`.
- Invariantes: `(company_id, indicator)` único; `oee | load | fulfillment` ⇒ `threshold ∈ [0, 1]`; `downtime` ⇒ `threshold ≥ 0` y `comparison = gt`.

### `role_permissions`
- `id`, `company_id`, `role` (`plant_manager` | `planner` | `operator`), `action` (`view_plant_panel` | `set_threshold` | `change_priority` | `cancel_order` | `export_report`), `allowed`, `updated_at`.
- Invariantes: `(company_id, role, action)` único; `plant_manager` ⇒ todas las acciones permitidas; `planner` ⇒ `view_plant_panel`, `change_priority`, `export_report`; `operator` ⇒ solo `view_plant_panel`.

### Campos de solo lectura consumidos
- `production_orders`: `id`, `order_number`, `status`, `priority`, `quantity_planned`, `planned_start_date`, `planned_end_date`.
- `production_order_operations`: `planned_time_minutes`, `quantity_completed`, `scrap_quantity`, `operation_status`.
- `operation_delays`: `reason_id`, `started_at`, `ended_at` (o equivalente) para paradas por motivo.
- `maintenance_tickets`: `downtime_minutes`, `resolved_at`, `work_center_id`.
- `work_centers`: `id`, `name`, `capacity_per_day_minutes`, `efficiency_factor`, `operational_status`.
- `routing_operations`: `run_time_per_unit_minutes`, `setup_time_minutes` para el cálculo de carga.

---

## 3. Funciones puras (`src/domain/plant-performance.js`)

Sin efectos secundarios, sin acceso a `localStorage` y sin lectura del reloj global: el período y el instante de corte se pasan como argumentos.

### `computeOee(workCenterId, operations, delays, period)`
1. Filtra operaciones del centro dentro de `period`.
2. `availability = (planned_time_minutes − downtime_minutes) / planned_time_minutes`; si no hay tiempo planificado, devuelve `null`.
3. `performance = quantity_completed / (run_time_per_unit_minutes × quantity_planned)` acotado a `[0, 1]`.
4. `quality = quantity_completed / (quantity_completed + scrap_quantity)`; si el denominador es `0`, devuelve `null`.
5. Devuelve `{ availability, performance, quality, oee }` con `oee = availability × performance × quality` acotado a `[0, 1]`, o `null` si falta algún componente.

### `computeLoadByWorkCenter(workCenters, operations, period)`
1. Suma `planned_time_minutes` por `work_center_id` dentro del período.
2. `capacity = capacity_per_day_minutes × efficiency_factor` (mínimo `1` para evitar división por cero).
3. Devuelve un mapa `{ [work_center_id]: { load_minutes, capacity_minutes, load_ratio } }`, con `load_ratio = load_minutes / capacity_minutes`.
4. Incluye centros desactivados con `load_ratio = 0` y marca `inactive: true`; no los omite del reporte.

### `accumulateDowntimesByReason(delays, maintenanceTickets, period)`
1. Agrupa por `reason_id` (o `cause_reason_id` en tickets) dentro del período.
2. Suma minutos; usa `downtime_minutes` del ticket cuando existe y, si no, deriva de las marcas de tiempo.
3. Devuelve una lista ordenada por minutos descendente: `[{ reason_id, reason_label, downtime_minutes }]`.

### `evaluateThresholds(indicators, thresholdSettings)`
1. Recibe los indicadores del período (`load_ratio`, `oee`, `downtime_minutes`, `fulfillment_ratio`).
2. Compara cada indicador contra su umbral (`lt` o `gt`) y devuelve `[{ indicator, threshold, comparison, value, breached }]`.
3. Un indicador sin umbral configurado se devuelve con `threshold = null` y `breached = false`.
4. No muta `thresholdSettings`.

### `canPerformAction(role, action, rolePermissions)`
1. Busca la fila `(role, action)`; si no existe, devuelve `false` (deny by default).
2. Devuelve `allowed`.

### `buildConsolidatedReport(period, data)`
1. Compone carga, OEE, paradas por motivo y cumplimiento de órdenes del período.
2. Incluye `generated_at` recibido como argumento y la etiqueta de período.
3. No incluye datos por operador ni rankings individuales.
4. Devuelve una estructura serializable apta para PDF/Excel.

---

## 4. Acciones y consultas del store

Todas las acciones validan primero, mutan después y emiten un único evento `change`. Ante error, no mutan estado y lanzan `Error` con mensaje en español.

### `setIndicatorThreshold({ indicator, threshold, comparison })`
1. Rechaza indicadores desconocidos, umbrales fuera de rango o `comparison` inválida.
2. Actualiza o crea la fila de `threshold_settings` de la empresa con `updated_at = now`.
3. Devuelve la configuración actualizada.

### `changeOrderPriority(orderId, priority)`
1. Rechaza si la orden no existe, no está `planned` o la prioridad no es válida.
2. Fija `priority` y emite `change`.
3. Devuelve la orden actualizada.

### `cancelOrderFromPanel(orderId, { reason })`
1. Rechaza si la orden no existe o ya está `cancelled`/`completed`.
2. Exige un motivo no vacío (confirmación de UI).
3. Fija `status = cancelled`, conserva las operaciones y registros de ejecución y emite `change`.
4. Devuelve la orden actualizada.

### Consultas
- `plantPerformanceFor(period)` → `{ indicators, oee_by_work_center, load_by_work_center, downtime_by_reason, fulfillment }`.
- `loadByWorkCenterFor(period)` → mapa de carga y capacidad efectiva.
- `downtimesByReasonFor(period)` → paradas acumuladas por motivo.
- `rolePermissionsFor(role)` → matriz rol×acción del rol.
- `thresholdsFor()` → umbrales configurados por indicador.

---

## 5. Contrato de UI (`PlantPerformancePanel`)

| Elemento | Estado | Comportamiento |
|---|---|---|
| Tarjetas KPI | Período seleccionado | Muestra carga, OEE, paradas y cumplimiento con formato y unidad consistentes. |
| Alarmas de umbral | Indicador que supera el umbral | Tarjeta destacada con indicador, valor, umbral y acción para ajustar. |
| Selector de rol | Siempre visible | Cambia la matriz de permisos simulada; las acciones no permitidas se ocultan o deshabilitan con motivo. |
| Configuración de umbrales | Rol con `set_threshold` | Formulario con validación inline; guarda en `threshold_settings`. |
| Tabla por centro | Período seleccionado | Carga vs. capacidad efectiva, OEE y estado; centros desactivados visibles y marcados. |
| Panel de paradas | Período seleccionado | Paradas acumuladas por motivo, ordenadas de mayor a menor. |
| Acción `Cambiar prioridad` | Orden `planned` y rol con `change_priority` | Diálogo con confirmación; refresca la tabla sin recargar. |
| Acción `Cancelar orden` | Orden no cerrada y rol con `cancel_order` | Confirmación obligatoria con motivo; conserva la trazabilidad. |
| Acción `Exportar` | Rol con `export_report` | Genera PDF y Excel locales del reporte consolidado. |
| Estados vacíos | Sin datos del período | Mensaje claro y sugerencia de período/acción. |

### Accesibilidad y consistencia
- Los diálogos atrapan el foco y se cierran con `Esc` (equivale a cancelar).
- Los errores usan el patrón inline del resto del módulo.
- Los colores de alarma no son el único indicador: se acompaña de texto e icono.
- Los indicadores se presentan por centro de trabajo; nunca por operador.

---

## 6. Reglas de cálculo y derivación

```
availability = (planned_time_minutes − downtime_minutes) / planned_time_minutes
performance  = clamp(quantity_completed / (run_time_per_unit_minutes × quantity_planned), 0, 1)
quality      = quantity_completed / (quantity_completed + scrap_quantity)
oee          = clamp(availability × performance × quality, 0, 1)

capacity_minutes = capacity_per_day_minutes × efficiency_factor
load_ratio       = Σ planned_time_minutes / capacity_minutes
fulfillment      = órdenes completadas a tiempo / órdenes con fecha objetivo
```

- Los indicadores se calculan bajo demanda y **no se persisten**.
- `downtime_minutes` se toma de `operation_delays` y `maintenance_tickets`; no se duplica el conteo de una misma parada.
- `load_ratio > 1` señala sobrecarga y debe destacarse.
- `performance` y `quality` devuelven `null` cuando falta el denominador; la UI muestra `—`, no `0`.

---

## 7. Persistencia

- **Clave**: `erp.manufacturing.v2` (introducida por US-08).
- **Forma**: `{ version: 2, savedAt: ISO-8601, data: { ...colecciones existentes, thresholdSettings, rolePermissions } }`.
- **Migración**: si existe `erp.manufacturing.v1` válido, se copia su `data`, se inicializan `thresholdSettings` y `rolePermissions` con valores por defecto y se reescribe como `v2`. Un snapshot inválido o corrupto se descarta y se cargan fixtures con advertencia visible.
- **Escritura**: tras cada mutación exitosa del store (write-through), sin bloquear la UI.
- **Reset de demo**: elimina `v2` (y opcionalmente `v1`) y recarga los fixtures.

---

## 8. Escenarios de verificación

1. **Carga y capacidad**: un centro con 600 minutos planificados, capacidad 480 y eficiencia 0.9 muestra `load_ratio ≈ 1.39` y se marca sobrecarga.
2. **OEE**: con disponibilidad 0.9, performance 0.8 y calidad 0.95, el OEE mostrado es `0.684` (redondeo de UI).
3. **Datos insuficientes**: sin tiempo planificado, `computeOee` devuelve `null` y la UI muestra `—`.
4. **Paradas por motivo**: dos atrasos y un ticket del mismo motivo suman minutos una sola vez y se ordenan de mayor a menor.
5. **Umbral**: configurar OEE `< 0.7` y obtener `0.65` genera alarma; un valor `0.75` no la genera.
6. **Permisos**: como `operator`, las acciones de umbral, prioridad y cancelación se deshabilitan; como `plant_manager` se habilitan.
7. **Prioridad**: cambiar la prioridad de una orden `planned` se refleja en la tabla; una orden `in_progress` se rechaza.
8. **Cancelación**: cancelar exige motivo, deja la orden `cancelled` y conserva operaciones y registros de ejecución.
9. **Exportación**: el reporte PDF/Excel contiene los indicadores del período y no incluye datos por operador.
10. **Persistencia**: tras cambiar umbrales y permisos, recargar rehidrata los valores; un snapshot `v1` válido se migra a `v2`.
11. **Regresión**: las suites de US-01…US-07 y US-09 siguen pasando sin cambios de comportamiento.
