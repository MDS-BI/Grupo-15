# Inicio Rápido: Módulo de Operaciones / Manufactura (ERP)

**Rama**: `002-operations-manufacturing` | **Fecha**: 2026-11-03
**Referencias**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [contracts/operator-shift.md](contracts/operator-shift.md), [contracts/maintenance.md](contracts/maintenance.md), [contracts/plant-performance.md](contracts/plant-performance.md), [contracts/order-scheduling.md](contracts/order-scheduling.md), [contracts/line-balance.md](contracts/line-balance.md)

---

## 1. Configuración

1. Instale dependencias: `npm install`.
2. Inicie el servidor de desarrollo: `npm run dev`.
3. Abra la URL local que imprime Vite.
4. Ejecute las pruebas: `npm test` (Vitest, modo watch) o `npm test -- --run` (una sola pasada).
5. Verifique el build: `npm run build`.

El módulo es frontend-only: no requiere backend ni variables de entorno. Los datos iniciales provienen de `src/data/fixtures/` y se persisten en `localStorage`: `erp.manufacturing.v1` para US-01…US-07 y `erp.manufacturing.v2` desde US-08, con migración automática.

---

## 2. Recorrido principal (US-01 a US-05)

1. **Panel**: confirme KPIs de órdenes activas, scrap rate y carga por centro de trabajo.
2. **BOM**: abra el explorador, expanda al menos 4 niveles y verifique el árbol multinivel.
3. **Órdenes**: cree una orden desde stock o MTO; libérela y confirme que se generan las operaciones congeladas.
4. **Ejecución**: inicie una operación, registre consumo y salida parcial; verifique el débito/crédito simulado de inventario.
5. **Trazabilidad**: revise plan vs. real, calidad derivada y el estado global de la orden.

---

## 3. Flujo del operador (US-06)

1. Abra la vista de **Operador** (estación de trabajo).
2. Confirme que se muestran la orden activa y su operación en curso.
3. Pulse **Iniciar**:
   - la operación pasa a `in_progress`;
   - la orden pasa de `released` a `in_progress`;
   - el cronómetro avanza desde `started_at`.
4. Registre un **atraso**:
   - elija un motivo predefinido o cree uno nuevo;
   - el atraso queda abierto y el tiempo efectivo se pausa;
   - pulse **Finalizar atraso** y confirme que el tiempo efectivo se reanuda.
5. Use los **contadores de piezas**:
   - `+`/`−` o edición directa sobre el contador del turno;
   - verifique que el acumulado cambia en el mismo delta;
   - intente un valor negativo o no numérico y confirme el error inline con el último valor válido.
6. Pulse **Finalizar**:
   - aparece la confirmación con tiempo efectivo, atrasos y piezas;
   - cancele una vez y confirme que no hay cambios;
   - confirme y verifique que la operación queda `completed` y que no se puede volver a finalizar.
7. Repita el flujo dejando un atraso **abierto** al finalizar:
   - el cierre debe permitirse;
   - el atraso debe quedar marcado *Abierto — pendiente de corrección*;
   - use **Corregir atraso** para cerrarlo y confirme que el tiempo efectivo se recalcula.
8. Abra un **nuevo turno** sobre otra operación y confirme que el contador del turno arranca en `0` y el acumulado de la operación se conserva.

---

## 4. Validación de persistencia

1. Con un turno activo y un atraso abierto, recargue la página.
2. Confirme que se rehidratan turno, atraso, contadores y que el cronómetro continúa desde `started_at` (no desde cero).
3. Cierre la pestaña y vuelva a abrir la aplicación: el snapshot de `localStorage` debe restaurar el estado.
4. Para reiniciar la demo:
   - ejecute en la consola `localStorage.removeItem('erp.manufacturing.v2'); localStorage.removeItem('erp.manufacturing.v1')` y recargue; o
   - use la acción de reset de demo si está disponible en la UI.
5. Para probar un snapshot inválido, escriba un JSON corrupto en la clave y recargue: la app debe cargar fixtures y mostrar una advertencia, sin romperse.

---

## 5. Casos límite a verificar

| Caso | Resultado esperado |
|---|---|
| Iniciar una segunda operación con otra en curso | Rechazo con mensaje; la operación activa no cambia. |
| Doble clic en `Finalizar` | Solo se aplica el primer cierre; el segundo se rechaza. |
| Atraso sin motivo | Rechazo bloqueante. |
| Dos atrasos simultáneos | Rechazo; debe cerrarse el atraso actual. |
| Motivo personalizado duplicado | Rechazo por etiqueta repetida (sin distinguir mayúsculas). |
| Contador negativo o `NaN` | Rechazo inline; se conserva el último valor válido. |
| Finalizar con atraso abierto | Cierre permitido; atraso pendiente de corrección. |
| Corrección con `endedAt` fuera del intervalo | Rechazo; no se muta el atraso. |
| Recarga durante el turno | Estado, tiempos, atrasos y contadores se restauran. |

---

## 6. Mapa de criterios de aceptación

| AC | Verificación |
|---|---|
| AC-15 | Pasos 3, 6 y casos de doble inicio/cierre. |
| AC-16 | Pasos 4, 7 y casos de motivo obligatorio/atrasos simultáneos. |
| AC-17 | Paso 5, paso 8 y casos de contador inválido. |

---

## 7. Solución de problemas

- **El cronómetro no avanza**: verifique que exista un turno `in_progress`; el tiempo se deriva de `started_at`, no de un intervalo en memoria.
- **El estado vuelve a fixtures**: el snapshot puede estar corrupto o tener otra versión; revise la consola y la advertencia de arranque.
- **No aparece el botón `Finalizar`**: la operación no está `in_progress` o ya fue cerrada; recargue y revise el estado persistido.
- **Los motivos personalizados no aparecen**: solo son visibles dentro del turno que los creó; abra el turno correcto o use un motivo predefinido.
- **Pruebas lentas o en watch**: use `npm test -- --run` para una pasada única.

---

## 8. Flujo de mantenimiento (US-09)

> El estado de mantenimiento se persiste en `erp.manufacturing.v2`, introducido por US-08. Un snapshot `v1` existente se migra automáticamente conservando el estado de US-01…US-07.

1. **Entrada del ticket**: desde supervisión (US-07), escale un incidente de máquina. Verifique que aparece en la **bandeja de mantenimiento** con prioridad `urgent`.
2. **Bandeja**: confirme el orden por prioridad (`urgent` → `high` → `normal`) y, a igual prioridad, por antigüedad. Pruebe los filtros por estado, prioridad y centro.
3. **Tomar intervención**: abra un ticket `open` y asígnelo a un técnico. El ticket pasa a `in_progress`, se registra `intervention_started_at` y el centro queda en `fault`.
4. **Bloqueo por centro**: intente tomar otro ticket de la misma máquina mientras hay uno `in_progress`; debe rechazarse sin mutar estado.
5. **Historial y desgaste**: abra el historial de la máquina y confirme que lista tickets resueltos y muestra un indicador de desgaste agregado, etiquetado *solo contexto operativo*.
6. **Resolver**: cierre la intervención indicando marcas de parada y causa. Verifique:
   - `downtime_minutes` calculado y mostrado antes de confirmar;
   - ticket en `resolved` y sin posibilidad de reapertura;
   - la máquina sale de `fault` según el estado real de la operación activa.
7. **Orden preventiva**: programe una preventiva desde el historial con fecha objetivo. Confirme que nace en `planned` y que puede pasar a `in_progress` y `completed`.
8. **Persistencia**: recargue la página y confirme que tickets, marcas de tiempo y órdenes preventivas se rehidratan.

---

## 9. Mapa de criterios de aceptación (US-09)

| AC | Verificación |
|---|---|
| AC-21 | Paso 2: bandeja priorizada y filtrable. |
| AC-22 | Pasos 3 y 4: toma de intervención y bloqueo por centro. |
| AC-23 | Paso 5: historial y desgaste agregado. |
| AC-24 | Paso 6: cierre con tiempo real y disponibilidad restablecida. |
| AC-25 | Paso 6: ticket resuelto sin reapertura; nueva incidencia crea ticket nuevo. |
| AC-26 | Paso 8: persistencia y migración `v1 → v2`. |
| AC-27 | Paso 5: indicadores por máquina, sin rankings de técnicos. |

---

## 10. Solución de problemas (US-09)

- **No aparece el ticket escalado**: confirme que el escalamiento de US-07 fijó `escalated_to_maint = true` y que el `operation_delay_id` no generó ya un ticket.
- **No se puede tomar la intervención**: el centro ya tiene un ticket `in_progress` o el ticket no está `open`.
- **La máquina sigue en `fault`**: el ticket aún no está `resolved` o la operación activa quedó en un estado inesperado; revise la operación y vuelva a resolver.
- **El estado vuelve a fixtures**: el snapshot `v2` puede estar corrupto o tener otra versión; revise la consola y la advertencia de arranque.
- **Faltan datos tras actualizar**: un snapshot `v1` se migra solo si es válido; si el JSON estaba corrupto, se cargan fixtures intencionalmente.

---

## 11. Panel de desempeño de planta (US-08)

1. Abra el **Panel de planta** y seleccione un período con órdenes y paradas.
2. Confirme las tarjetas de **carga**, **OEE**, **paradas por motivo** y **cumplimiento**; los valores deben coincidir con el detalle por centro.
3. Verifique que un centro con `load_ratio > 1` se marca como sobrecargado y que los centros desactivados aparecen, sin carga, marcados como inactivos.
4. Ajuste un **umbral** (por ejemplo OEE `< 0.70`) y confirme que la alarma aparece o desaparece según el valor del período.
5. Cambie el **rol simulado**:
   - `operator` solo puede ver el panel;
   - `planner` puede cambiar prioridad y exportar;
   - `plant_manager` puede además ajustar umbrales y cancelar órdenes.
6. Como `planner`, cambie la **prioridad** de una orden `planned` y confirme que se refleja en la tabla; intente con una orden `in_progress` y confirme el rechazo.
7. Como `plant_manager`, **cancele** una orden: exija motivo, confirme y verifique que conserva sus operaciones y registros de ejecución.
8. **Exporte** el reporte a PDF y Excel; ambos deben contener los indicadores del período y no incluir datos por operador.
9. Recargue la página: umbrales, permisos y cambios de prioridad/cancelación deben rehidratarse desde `v2`.
10. Para migrar, deje solo un snapshot `v1` válido y recargue: debe migrarse a `v2` con umbrales y permisos por defecto.

---

## 12. Mapa de criterios de aceptación (US-08)

| AC | Verificación |
|---|---|
| AC-04 | Pasos 1–2: carga, OEE y paradas por período. |
| AC-05 | Paso 4: umbrales configurables y alarmas. |
| AC-06 | Pasos 6–7: reprogramación de prioridad y cancelación con confirmación. |
| AC-07 | Pasos 5 y 8: permisos por rol y exportación PDF/Excel. |
| AC-20 | Paso 3: carga sobre capacidad y centros desactivados visibles. |

---

## 13. Planificación de fechas (US-10)

1. Abra **Planificación** y filtre por estado y rango de fechas.
2. Edite el **inicio planificado** y el **término planificado** de una orden `planned`; guarde y confirme el mensaje de éxito.
3. Introduzca un término anterior al inicio: debe mostrarse un error inline y conservarse el último valor válido.
4. Introduzca una fecha inexistente (`2026-02-30`): debe rechazarse como inválida.
5. Deje solo una de las dos fechas: debe permitirse guardar.
6. Use **Limpiar fechas**: ambas vuelven a `null` y la orden pasa a “sin planificar”.
7. Abra una orden `completed` o `cancelled`: las fechas son de solo lectura y no se pueden guardar.
8. Recargue la página: las fechas guardadas se rehidratan desde `v2`.
9. Confirme que el resumen de planificadas/sin planificar/atrasadas usa la fecha de corte del período.

---

## 14. Mapa de criterios de aceptación (US-10)

| AC | Verificación |
|---|---|
| AC-28 | Paso 1: listado filtrable de órdenes. |
| AC-29 | Paso 2: asignación y edición de fechas planificadas. |
| AC-30 | Pasos 3–4: validación de rango y formato. |
| AC-31 | Paso 3: rechazo de rango invertido sin mutar estado. |
| AC-32 | Paso 8: persistencia de fechas. |
| AC-33 | Paso 9: resumen de planificación y atrasos. |

---

## 15. Balance de líneas (US-11)

1. Abra **Balance de líneas** y seleccione un período con órdenes planificadas.
2. Confirme la tabla por centro: tiempo estándar, carga proyectada, capacidad nominal y utilización.
3. Verifique que el **cuello de botella** es el centro con mayor utilización y que se anuncia con texto, no solo con color.
4. Si hay órdenes sin fechas planificadas, confirme el aviso y el enlace a **Planificación**; no deben sumarse a la carga.
5. Abra el detalle de una orden y compare el desglose por operación con la fila del centro.
6. Recargue la página: el balance se recalcula desde el estado vigente y no se persiste ningún resultado.
7. **Solución de problemas US-11**: si la tabla aparece vacía, revise que existan rutas con tiempos estándar y órdenes con fechas; si un centro muestra `—`, su capacidad nominal es `0` y debe corregirse en datos maestros.
