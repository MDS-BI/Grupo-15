# Contrato: Balance de líneas (US-11)

**Rama**: `002-operations-manufacturing` | **Fecha**: 2026-11-03
**Referencias**: [spec.md](../spec.md) FR-12 / US-11, [data-model.md](../data-model.md) §3.8, §3.10, §3.11 y §6.5, [plan.md](../plan.md) §10, [research.md](../research.md) §7

---

## 1. Propósito

Definir el contrato verificable entre la UI de balance de líneas, el `ManufacturingStore` y el módulo puro `src/domain/line-balance.js`. Cubre tiempos estándar, carga proyectada, utilización frente a capacidad nominal y detección de cuellos de botella a partir de datos existentes. No define endpoints HTTP ni nuevas entidades: el módulo es frontend-only y todo el resultado es derivado.

**Restricción de alcance**: el contrato es aditivo y de solo lectura. No muta `work_centers`, `routing_operations`, `production_orders` ni `production_order_operations`, y no cambia el comportamiento de US-01…US-10.

---

## 2. Entidades y campos consumidos

### `work_centers`
- `id`, `company_id`, `name`, `capacity_per_day_minutes`, `efficiency_factor`, `operational_status`.
- `efficiency_factor` es una fracción `(0, 1]`; se usa para la capacidad efectiva del panel de planta (US-08), no para la utilización nominal de este contrato.

### `routing_operations`
- `id`, `routing_id`, `work_center_id`, `sequence`, `setup_time_minutes`, `run_time_per_unit_minutes`.
- Los tiempos estándar se derivan de estos campos; no se reescriben.

### `production_orders`
- `id`, `order_number`, `status`, `quantity_planned`, `planned_start_date`, `planned_end_date`, `routing_id`.

### `production_order_operations`
- `id`, `production_order_id`, `work_center_id`, `planned_time_minutes`, `operation_status`.
- Se prefieren los tiempos congelados de la orden; si faltan, se derivan de `routing_operations`.

---

## 3. Funciones puras (`src/domain/line-balance.js`)

Sin efectos secundarios, sin acceso a `localStorage` y sin lectura del reloj global.

### `computeStandardTimes(routingOperations)`
1. Agrupa por `work_center_id`.
2. Devuelve `{ [work_center_id]: { setup_time_minutes, run_time_per_unit_minutes, operation_count } }`.
3. Rechaza tiempos negativos o no numéricos con `Error` en español.

### `computeProjectedLoad(orders, routingOperations, period)`
1. Filtra órdenes no `cancelled` que se solapan con `period` (por fechas planificadas; sin fechas, se excluyen y se reportan como `unscheduled`).
2. Para cada operación, usa `planned_time_minutes` si existe; si no, `setup_time_minutes + run_time_per_unit_minutes × quantity_planned`.
3. Suma por `work_center_id` y devuelve `{ [work_center_id]: { load_minutes, order_count } }`.
4. Devuelve también `unscheduled_order_ids` para que la UI lo advierta.

### `computeUtilization(loadByWorkCenter, workCenters)`
1. `capacity_minutes = capacity_per_day_minutes × número de días del período`.
2. `utilization = load_minutes / capacity_minutes`; si `capacity_minutes = 0`, devuelve `null` y marca `invalid_capacity: true`.
3. Devuelve una lista ordenada por `utilization` descendente: `[{ work_center_id, name, load_minutes, capacity_minutes, utilization }]`.

### `detectBottlenecks(utilizationByWorkCenter)`
1. Toma el mayor `utilization`; en empate, el mayor `load_minutes`; en nuevo empate, el `work_center_id` ascendente.
2. Devuelve `{ bottleneck, candidates }`, donde `candidates` incluye todos los centros con la utilización máxima.
3. Nunca devuelve personas ni rankings individuales.

---

## 4. Consultas del store

Este contrato no define acciones de mutación.

- `lineBalanceFor(period)` → `{ standard_times, load_by_work_center, utilization_by_work_center, bottleneck, unscheduled_order_ids }`.
- `lineBalanceForOrder(orderId)` → balance proyectado de una sola orden, útil para la vista de detalle.
- `capacityForPeriod(period)` → capacidad nominal por centro para el período.

Todas las consultas son deterministas para el mismo estado y período; no escriben en el snapshot.

---

## 5. Contrato de UI (`LineBalancePanel`)

| Elemento | Estado | Comportamiento |
|---|---|---|
| Selector de período | Siempre visible | Cambia el cálculo; no muta datos. |
| Tabla por centro | Período con datos | Nombre, tiempo estándar, carga proyectada, capacidad nominal, utilización y estado. |
| Cuello de botella | Cálculo con datos | Fila destacada con texto e icono, no solo color; muestra la causa (mayor utilización). |
| Órdenes sin fechas | Si existen | Aviso con cantidad y enlace a planificación (US-10); no se incluyen en la carga. |
| Capacidad inválida | Centro con capacidad `0` | Muestra `—` y una advertencia; no divide por cero. |
| Detalle de orden | Orden seleccionada | Desglose por operación/centro y utilización proyectada. |
| Estados vacíos | Sin órdenes o sin rutas | Mensaje claro y acción para revisar datos maestros. |

### Accesibilidad y consistencia
- La tabla usa encabezados asociados y permite navegación por teclado.
- El cuello de botella se anuncia con texto (`aria-live="polite"` al cambiar de período).
- Se reutilizan los patrones de tabla y filtros del módulo.
- Los datos se presentan por centro de trabajo; no por operador.

---

## 6. Reglas de cálculo

```
load_minutes(operation) = planned_time_minutes
                          ?? setup_time_minutes + run_time_per_unit_minutes × quantity_planned

capacity_minutes(work_center, period) = capacity_per_day_minutes × días_del_período

utilization = load_minutes / capacity_minutes        # null si capacity_minutes == 0

bottleneck = argmax(utilization); empate → argmax(load_minutes); empate → id ascendente
```

- La utilización de este contrato usa capacidad **nominal**; la del panel de planta (US-08) usa capacidad **efectiva** (`× efficiency_factor`). La UI debe etiquetar cuál está mostrando.
- La carga se expresa en minutos y se muestra también como porcentaje de la capacidad del período.
- Las órdenes sin fechas planificadas se excluyen y se reportan aparte.
- El cálculo es O(n) sobre operaciones del período; no se recalcula en cada tecla.

---

## 7. Persistencia

- **No persiste**: tiempos estándar, carga, utilización y cuello de botella se calculan bajo demanda.
- **Clave de lectura**: `erp.manufacturing.v2` (o los fixtures si no hay snapshot).
- **Reset de demo**: no requiere limpieza adicional; al recargar se vuelve a calcular desde el estado vigente.
- **Determinismo**: mismo estado + mismo período ⇒ mismo resultado, sin depender del reloj global.

---

## 8. Escenarios de verificación

1. **Tiempos estándar**: una ruta con dos operaciones en centros distintos agrupa correctamente `setup` y `run` por centro.
2. **Carga proyectada**: dos órdenes en el mismo centro suman minutos; una orden cancelada no suma.
3. **Utilización**: 600 minutos de carga sobre 480 de capacidad diaria en un período de un día da `1.25` y se marca sobrecarga.
4. **Capacidad cero**: un centro con `capacity_per_day_minutes = 0` devuelve `null` y la UI muestra `—` sin romperse.
5. **Cuello de botella**: el centro con mayor utilización se marca; en empate gana el de mayor carga y luego el id ascendente.
6. **Órdenes sin fechas**: se excluyen de la carga y aparecen en el aviso con enlace a US-10.
7. **Detalle de orden**: el desglose por operación coincide con la suma de la fila del centro.
8. **Sin persistencia**: recargar no altera datos; el cálculo se repite desde el estado vigente.
9. **Regresión**: las suites de US-01…US-10 siguen pasando sin cambios de comportamiento.
