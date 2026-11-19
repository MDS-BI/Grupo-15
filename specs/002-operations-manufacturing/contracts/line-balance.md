# Contrato: Balance de líneas (US-11)

**Rama**: `002-operations-manufacturing` | **Fecha**: 2026-11-03 | **Actualizado**: 2026-11-18
**Referencias**: [spec.md](../spec.md) FR-12 / US-11 (AC-37, AC-39, AC-40, AC-45), [data-model.md](../data-model.md) §3.8, §3.10, §3.11 y §6.5, [plan.md](../plan.md) §10, [research.md](../research.md) §7

---

## 1. Propósito

Definir el contrato verificable entre la UI de balance de líneas, el `ManufacturingStore` y el módulo puro `src/domain/line-balance.js`. Cubre tiempos estándar, carga proyectada, utilización frente a capacidad efectiva del período, estados por umbral, cuellos críticos y sugerencias simuladas con confirmación explícita. No define endpoints HTTP ni nuevas entidades persistentes: el módulo es frontend-only.

**Restricción de alcance**: las consultas son derivadas y no mutan `work_centers`, `routing_operations`, `production_orders` ni `production_order_operations`. Aceptar una propuesta solo marca la fila como `Solicitud simulada` en la vista; no se registra en el store, no se persiste ni cambia datos maestros.

---

## 2. Entidades y campos consumidos

### `work_centers`
- `id`, `company_id`, `name`, `station_type`, `capacity_per_day_minutes`, `efficiency_factor`, `operational_status`.
- `station_type` restringe las reasignaciones: solo se propone mover carga a otro centro con el mismo valor. La demo tiene 5 tipos (`corte`, `soldadura`, `pintura`, `armado`, `calidad`) y 6 estaciones físicas: `Estación de Soldadura 1` y `Estación de Soldadura 2` comparten `soldadura`.
- `efficiency_factor` es una fracción `(0, 1]`; se aplica a la capacidad efectiva del período en US-08 y US-11.

### `routing_operations`
- `id`, `routing_id`, `work_center_id`, `sequence`, `setup_time_minutes`, `run_time_per_unit_minutes`.
- Los tiempos estándar se derivan de estos campos; no se reescriben.

### `production_orders`
- `id`, `order_number`, `status`, `quantity_planned`, `planned_start_date`, `planned_end_date`, `routing_id`.

### `production_order_operations`
- `id`, `production_order_id`, `work_center_id`, `planned_time_minutes`, `operation_status`.
- Se prefieren los tiempos congelados de la orden; si faltan, se derivan de `routing_operations`.

### `lineBalanceRequest`
- No existe. La aceptación es simulada y solo produce feedback visual local en el panel.

---

## 3. Funciones puras (`src/domain/line-balance.js`)

Sin efectos secundarios, sin acceso a `localStorage` y sin lectura del reloj global.

### `businessDaysInPeriod(period)`
1. Cuenta los días entre `from` y `to`, inclusive, excluyendo sábados y domingos.
2. Devuelve `1` para un rango inválido o vacío, de acuerdo con el comportamiento vigente.

### `utilizationStatus(utilization)`
1. `null`/no finito → `'unknown'`.
2. `< 0.75` → `'normal'` (verde / saludable).
3. `[0.75, 0.95)` → `'tight'` (ámbar / ajustada); por ejemplo, `0.945` también es ajustada.
4. `≥ 0.95` → `'bottleneck'` (rojo / sobrecarga).

### `computeStandardTimes(routingOperations)`
1. Agrupa por `work_center_id`.
2. Devuelve `{ [work_center_id]: { setup_time_minutes, run_time_per_unit_minutes, operation_count } }`.
3. Rechaza tiempos negativos o no numéricos con `Error` en español.

### `computeProjectedLoad(orders, routingOperations, period, orderOperations)`
1. Filtra órdenes no `cancelled` que se solapan con `period`.
2. Excluye órdenes sin fechas y las reporta en `unscheduled_order_ids`.
3. Usa `planned_time_minutes` si existe; si no, `setup_time_minutes + run_time_per_unit_minutes × quantity_planned`.
4. Devuelve `{ load_by_work_center, load_operations_by_order, unscheduled_order_ids }`.
   - `load_by_work_center[id]` incluye `load_minutes`, `order_count`, `order_ids` y `order_minutes`.

### `computeUtilization(loadByWorkCenter, workCenters, period)`
1. `days = businessDaysInPeriod(period)`.
2. `capacity_minutes = days × capacity_per_day_minutes × efficiency_factor` (factor por defecto `1` si es inválido).
3. `utilization = load_minutes / capacity_minutes`; si `capacity_minutes = 0`, devuelve `null` y `invalid_capacity: true`.
4. Cada fila incluye `status`, `slack_minutes`, `business_days` y `efficiency_factor`.
5. Ordena por utilización descendente y luego por carga descendente.

### `detectBottlenecks(utilizationByWorkCenter)`
1. Filtra solo filas con `utilization ≥ 0.95`; si no hay ninguna, devuelve `{ bottleneck: null, candidates: [] }`.
2. Entre críticas, toma la mayor utilización; desempate por mayor `load_minutes` y luego `work_center_id` ascendente.
3. Devuelve `{ bottleneck, candidates }`. Nunca devuelve personas ni rankings individuales.

### `buildLineBalanceSuggestions(balance, operationsByOrder, workCenters, orders)`
1. Devuelve `[]` si no hay `bottleneck` o si el centro cuello no tiene carga por orden.
2. Solo considera destinos con `station_type` igual al del centro cuello, `slack_minutes > 0` y distinto `id`. Sin destino del mismo tipo no hay reasignaciones, pero sí se conserva la sugerencia de secuencia.
3. Prioriza destinos por menor utilización, mayor holgura y `work_center_id`.
4. Genera hasta dos sugerencias `reassign` desde las órdenes con mayor carga del cuello, sin repetir destino.
5. Genera una sugerencia `sequence` para la primera operación con secuencia conocida del cuello.
6. Devuelve hasta 3 objetos con `suggestion_id`, `type`, `order_id`, `from_work_center_id`, `to_work_center_id`, `minutes`, `sequence` y `label`. La etiqueta usa nombres de estación, número de orden y minutos con separador de miles, por ejemplo: `Reasignar 6.865 min de OP-3007 desde Estación de Soldadura 1 a Estación de Soldadura 2 · Sec. 20.`

---

## 4. Consultas del store

- `lineBalanceFor(period)` → `{ standard_times, load_by_work_center, utilization_by_work_center, bottleneck, bottleneck_candidates, summary, unscheduled_order_ids, suggestions }`.
- `lineBalanceForOrder(orderId)` → balance proyectado de una sola orden (devuelve `null` si no existe).
- `capacityForPeriod(period)` → capacidad efectiva por centro (`días hábiles × capacity_per_day_minutes × efficiency_factor`).

No existen `lineBalanceRequestsFor()` ni `acceptLineBalanceSuggestion(...)`: el store no registra, no expone y no persiste solicitudes de balance.

Todas las consultas son deterministas para el mismo estado y período.

---

## 5. Contrato de UI (`LineBalancePanel`)

| Elemento | Estado | Comportamiento |
|---|---|---|
| Selector de período | Siempre visible | Cambia el cálculo; no muta datos. |
| Tabla por centro | Período con datos | Nombre, estado, carga proyectada, capacidad del período, capacidad/día, holgura, utilización del período, utilización del día (la misma del Panel de Producción), setup y run estándar. Ambas columnas de utilización usan el mismo componente de barra (contenedor `cell--bar`, pista gris redondeada y etiqueta de texto neutra), con relleno limitado al 100 % pero texto real y escala verde/ámbar/rojo por umbral. El título “Carga por centro · <período> (N días hábiles)” muestra los días; no hay columna de días. |
| Popover de órdenes por centro | Al activar una fila de “Carga por centro” | Ventana compacta centrada sobre la sección “Carga por centro” y limitada al viewport, con las órdenes que consumen el centro, la carga en el centro y la participación por orden; se cierra con botón, Escape, clic fuera o nueva activación. No existe una sección “Órdenes por centro”. |
| Semáforo | Siempre | `Normal · verde` (< 75 %), `Ajustada · ámbar` (75 % a < 95 %) y `Cuello crítico · rojo` (≥ 95 %); no solo color. |
| Alerta superior | Algún centro ≥ 95 % | Muestra `Alerta crítica · Cuello de botella: <nombre> (<utilización>)` y resalta la fila. Si ninguno alcanza el umbral, muestra “Línea balanceada · Sin cuellos de botella críticos”. |
| Sugerencias | Con cuello crítico | Tabla con tipo, propuesta, carga y botón `Solicitar`. Las reasignaciones son solo entre estaciones del mismo `station_type`. Sin críticos: “Sin cuellos de botella críticos: no hay reasignaciones pendientes.” |
| Modal de solicitud | Tras `Solicitar` | `role="dialog"`, `aria-modal="true"`, texto de la propuesta, aviso de simulación, textarea de nota, `Cancelar` y `Aceptar solicitud`; cierra con Escape. |
| Solicitud simulada | Tras confirmar | El botón se sustituye por el badge `Solicitud simulada` solo en la vista; no se envía nota, no se guarda y se reinicia al cambiar de período o recargar. |
| Órdenes sin fechas | Si existen | Aviso con cantidad y enlace a planificación (US-10); no se incluyen en la carga. |
| Capacidad inválida | Centro con capacidad `0` | Muestra `—` y una advertencia; no divide por cero. |
| Detalle de orden | Orden seleccionada | Desglose por operación/centro y utilización proyectada. |
| Estados vacíos | Sin órdenes o sin rutas | Mensaje claro y acción para revisar datos maestros. |

### Accesibilidad y consistencia
- La tabla usa encabezados asociados y permite navegación por teclado.
- El cuello de botella se anuncia con texto (`aria-live="polite"` al cambiar de período).
- El modal usa foco inicial en el textarea y cierra con Escape; reutiliza patrones de tabla y diálogos del módulo.
- La fila de centro expone `aria-expanded`/`aria-controls`, el popover mueve el foco a su botón de cierre y lo devuelve a la fila al cerrar con Escape o con el botón.
- Los datos se presentan por centro de trabajo; no por operador.

---

## 6. Reglas de cálculo

```
load_minutes(operation) = planned_time_minutes
                          ?? setup_time_minutes + run_time_per_unit_minutes × quantity_planned

capacity_minutes(work_center, period) = business_days(period)
                                        × capacity_per_day_minutes
                                        × efficiency_factor

utilization = load_minutes / capacity_minutes        # null si capacity_minutes == 0

status = 'normal' ([0, 0.75)) | 'tight' ([0.75, 0.95)) | 'bottleneck' ([0.95, ∞))

bottleneck = argmax(utilization) solo si utilization ≥ 0.95
             empate → argmax(load_minutes) → id ascendente

reassign_target = work_center con el mismo station_type que el cuello
                  y slack_minutes > 0
```

- La UI etiqueta la capacidad como **efectiva del período**; US-08 usa la misma eficiencia sobre capacidad diaria.
- `business_days(period)` cuenta lunes a viernes del rango inclusivo; la demo no aplica feriados (octubre 2026 = 22, noviembre 2026 = 21).
- `daily_utilization = pending_load_minutes / (capacity_per_day_minutes × efficiency_factor)`; es el mismo valor que muestra el Panel de Producción y alimenta la columna “Utilización del día”.
- En ambas columnas de utilización, el texto conserva el porcentaje real (por ejemplo `447,0 %`) mientras el relleno de la barra se limita a `min(daily_utilization × 100, 100) %`.
- La alerta superior se activa solo si existe al menos un centro con `utilization ≥ 0.95`.
- Las reasignaciones no cruzan `station_type`; la revisión de secuencia es siempre solo una propuesta.
- La carga se expresa en minutos y también como porcentaje de la capacidad del período.
- Las órdenes sin fechas planificadas se excluyen y se reportan aparte.
- El cálculo es O(n) sobre operaciones del período; no se recalcula en cada tecla.
- Aceptar una propuesta no altera los cálculos ni produce registro alguno.

---

## 7. Persistencia

- **No persiste**: tiempos estándar, carga, utilización, cuello de botella, sugerencias ni confirmaciones simuladas.
- **Clave de lectura**: `erp.manufacturing.v2` (o los fixtures si no hay snapshot).
- **Reset de demo**: no requiere limpieza adicional; al recargar se vuelve a calcular el balance desde el estado vigente.
- **Determinismo**: mismo estado + mismo período ⇒ mismo resultado.

---

## 8. Escenarios de verificación

1. **Tiempos estándar**: una ruta con dos operaciones en centros distintos agrupa correctamente `setup` y `run` por centro.
2. **Carga proyectada**: dos órdenes en el mismo centro suman minutos; una orden cancelada no suma.
3. **Utilización con eficiencia**: 600 minutos de carga, 480 minutos/día, eficiencia `0.8` y un día hábil dan `1.5625`, no `1.25`; la UI muestra capacidad efectiva de 384 minutos.
4. **Días hábiles**: octubre 2026 cuenta 22 días laborables; el rango `2026-10-01` a `2026-10-31` inclusive usa 22 días.
5. **Capacidad cero**: un centro con `capacity_per_day_minutes = 0` devuelve `null` y la UI muestra `—` sin romperse.
6. **Umbral y alerta**: 97 % se marca rojo y activa la alerta superior; 94,5 % se marca ámbar; 79 % se marca ámbar; 29 % se marca verde; sin centros ≥ 95 % aparece “Línea balanceada · Sin cuellos de botella críticos”.
6b. **Utilización diaria compatible con AC-46**: `wc_solda` muestra `447,0 %` como texto, con el relleno limitado al 100 % y color rojo; el markup usa `cell--bar`/`bar`/`bar__label` igual que “Utilización”, sin borde interno adicional y con etiqueta de texto neutra.
7. **Desempate**: dos centros al 97 % eligen el de mayor carga y, si empatan, el menor `work_center_id`.
8. **Sugerencia del mismo tipo**: con cuello en `wc_solda`, la demo propone `Reasignar 6.865 min de OP-3007 desde Estación de Soldadura 1 a Estación de Soldadura 2 · Sec. 20.`
9. **Sin cruce de tipos**: si el cuello es soldadura y solo hay destinos de corte, armado o calidad, no se genera reasignación; puede generarse solo la revisión de secuencia.
10. **Sin holgura**: si no hay destino del mismo tipo con `slack_minutes > 0`, no se ofrece reasignación.
11. **Aceptación simulada**: `Solicitar` abre el modal; `Aceptar solicitud` cierra y muestra `Solicitud simulada` sin guardar nota ni registro.
12. **No mutación**: tras aceptar, rutas, operaciones, asignaciones y snapshot permanecen idénticos; el store no expone APIs de solicitudes.
13. **Órdenes sin fechas**: se excluyen de la carga y aparecen en el aviso con enlace a US-10.
14. **Detalle de orden**: el desglose por operación coincide con la suma de la fila del centro.
15. **Regresión**: las suites de US-01…US-10 siguen pasando sin cambios de comportamiento; las 12 suites heredadas de `001-erp-base-module` están aisladas del run por defecto y permanecen como deuda documentada en T084.
