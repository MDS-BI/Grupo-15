# Inicio Rápido: Módulo de Operaciones / Manufactura (ERP)

**Rama**: `002-operations-manufacturing` | **Fecha**: 2026-11-03 | **Actualizado**: 2026-11-18
**Referencias**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [contracts/operator-shift.md](contracts/operator-shift.md), [contracts/maintenance.md](contracts/maintenance.md), [contracts/plant-performance.md](contracts/plant-performance.md), [contracts/order-scheduling.md](contracts/order-scheduling.md), [contracts/line-balance.md](contracts/line-balance.md)

---

## 1. Configuración

1. Instale dependencias: `npm install`.
2. Inicie el servidor de desarrollo: `npm run dev`.
3. Abra la URL local que imprime Vite.
4. Ejecute las pruebas: `npm test` (Vitest, modo watch) o `npm test -- --run` (una sola pasada).
5. Verifique el build: `npm run build`.

El módulo es frontend-only: no requiere backend ni variables de entorno. Los datos iniciales provienen de `src/data/fixtures/` y se persisten en `localStorage` bajo `erp.manufacturing.v2`; un snapshot `v1` existente se migra automáticamente al arrancar.

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

## 3.1 Flujo del supervisor (US-07)

1. Abra **Supervisión** y confirme las filas por centro con semáforo: *En operación*, *En pausa*, *En fallo*, *Cambio de formato* o *Disponible*.
2. Asigne un operario (`ext_hr_employee_id`) a un centro y franja; verifique que no se duplica el operario ni el centro en la misma franja.
3. Finalice un turno con atraso abierto y confirme que **Validar cierre** permanece bloqueado hasta corregir el atraso.
4. Corrija el atraso y valide el cierre: `supervisor_validated = true` y la nota del supervisor quedan persistidas.
5. Pulse **Escalar incidente** en un centro: se crea un ticket `urgent`/`open`, el atraso queda `escalated_to_maint = true` y el centro pasa a *En fallo*.
6. Desde **Órdenes → detalle** puede abrir **Estación del operador** y **Supervisión de línea** en un panel embebido para operar sin cambiar de vista.

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
| AC-28 | Paso 1: consulta de órdenes y datos principales. |
| AC-29 | Paso 2: asignación de fechas planificadas. |
| AC-30 | Paso 2: modificación de fechas existentes. |
| AC-31 | Paso 3: rechazo de rango invertido sin mutar estado; paso 4 rechaza fecha inexistente. |
| AC-32 | Pasos 1 y 9: visualización por fechas/estados y resumen del período. |
| AC-33 | Paso 8: persistencia de fechas tras recargar. |

---

## 15. Balance de líneas (US-11)

1. Abra **Balance de líneas** y seleccione un período con órdenes planificadas; en la demo use **Octubre 2026** (22 días hábiles).
2. Confirme el título “Carga por centro · Octubre 2026 (22 días hábiles)” y la tabla por centro: tiempo estándar, carga proyectada, eficiencia, capacidad efectiva del período, utilización y utilización del día. No debe haber columna de días.
3. Verifique el semáforo: **Normal · verde** (< 75 %, capacidad ociosa), **Ajustada · ámbar** (75 % a < 95 %, por ejemplo 94,5 %) y **Cuello crítico · rojo** (≥ 95 %). La alerta superior se activa solo si algún centro alcanza el 95 %; si ninguno lo hace, debe aparecer “Línea balanceada · Sin cuellos de botella críticos”.
4. Revise el panel **Sugerencias de balanceo**: solo ofrece propuestas con cuello crítico. Las reasignaciones son únicamente entre estaciones del mismo tipo; en la demo se espera “Reasignar 6.865 min de OP-3007 desde Estación de Soldadura 1 a Estación de Soldadura 2 · Sec. 20.”
5. Pulse **Solicitar**, añada una nota y confirme **Aceptar solicitud**: la fila pasa a `Solicitud simulada`. La nota no se envía, no se registra solicitud alguna y no cambian rutas, operaciones ni asignaciones.
6. Si hay órdenes sin fechas planificadas, confirme el aviso y el enlace a **Planificación**; no deben sumarse a la carga.
7. Haga clic (o pulse Enter/Espacio) en una fila de **Carga por centro**: se abre un popover compacto centrado sobre esa sección, sin salirse del viewport, con las órdenes de la estación, la carga en el centro y la participación por orden; se cierra con el botón, Escape, clic fuera o nueva activación. La sección “Órdenes por centro” ya no existe; el detalle de una orden sigue disponible para comparar su desglose por operación con la fila del centro.
8. En la pestaña **Producción**, active una fila de **Utilización por Centro de Trabajo**: se abre una ventana con las operaciones pendientes de ese centro (orden, secuencia, estado y minutos). Compare el porcentaje de la fila con la columna **Utilización del día** del balance: deben coincidir, con texto real aunque supere 100 % y relleno limitado al 100 % en ambas columnas del balance; los colores verde/ámbar/rojo son idénticos en “Utilización” y “Utilización del día”.
9. Recargue la página: el balance se recalcula desde el estado vigente y no aparece ningún registro de solicitudes porque la confirmación fue solo visual.
10. **Solución de problemas US-11**: si la tabla aparece vacía, revise que existan rutas con tiempos estándar y órdenes con fechas; si un centro muestra `—`, su capacidad efectiva es `0` y debe corregirse en datos maestros.

| AC | Verificación |
|---|---|
| AC-37 | Paso 2: tiempos estándar por operación y totales por ruta. |
| AC-39 | Pasos 1–3: carga/utilización con días hábiles × `capacity_per_day_minutes` × `efficiency_factor`; semáforo verde/ámbar/rojo; alerta superior solo con algún centro ≥ 95 % y mensaje de línea balanceada en caso contrario. |
| AC-40 | Pasos 4–5 y 8: propuestas solo con cuello crítico, reasignaciones del mismo `station_type`, confirmación simulada sin registro ni persistencia y sin mutación de datos maestros. |
| AC-45 | Paso 7: popover compacto centrado sobre “Carga por centro” y limitado al viewport, con órdenes, carga en el centro y participación; cierre con botón, Escape, clic fuera o nueva activación; sin sección “Órdenes por centro”. |
| AC-46 | Pasos 2, 3 y 8: días hábiles en el título sin columna de días, columna “Utilización del día” con markup y colores compartidos, texto real con relleno limitado al 100 % y ventana de operaciones pendientes en el Panel de Producción. |

---

## 16. Guion de demo (5 minutos)

1. **Pedido → orden** (30 s): cree una orden desde stock o MTO, libérela y abra su detalle.
2. **Fechas planificadas** (30 s): en **Planificación**, asigne inicio/término; pruebe un rango invertido y corrija.
3. **Asignación y semáforo** (40 s): en **Supervisión**, asigne un operario y revise el semáforo por centro.
4. **Turno del operador** (60 s): en **Estación**, inicie, ajuste contadores, registre un atraso y finalice con confirmación.
5. **Cierre y escalamiento** (40 s): valide el cierre en **Supervisión**; escale un incidente y confirme el ticket urgente y el estado *En fallo*.
6. **Mantenimiento** (50 s): tome el ticket más antiguo, resuélvalo con marcas de parada y confirme que la máquina sale de *En fallo*.
7. **Panel de planta** (40 s): revise carga/OEE/paradas, cambie el rol simulado, ajuste un umbral y cancele una orden con motivo.
8. **Balance de líneas** (45 s): identifique el cuello crítico (≥ 95 %), confirme la reasignación simulada Soldadura 1 → Soldadura 2 y abra el detalle por orden.
9. **Recarga** (20 s): recargue la página, confirme que turno, atrasos, asignaciones, umbrales y fechas persisten en `erp.manufacturing.v2`, y que el balance se recalcula sin dejar solicitudes registradas.

---

## 17. Cuentas y roles (US-12)

1. Limpie `localStorage` o use **Reiniciar datos de demo** como `jefa`.
2. Ingrese con `jefa/jefa`, `supervisor/supervisor`, `planificador/planificador`, `operador/operador` y `mantenimiento/mantenimiento`; `usuario` debe fallar. `test/test` y `doble/doble` también funcionan.
3. Con `test` (cinco tablas) el selector de la cabecera ofrece los cinco roles; con `doble` ofrece solo `operator` y `maintenance`; con una cuenta de un solo rol no aparece selector. No hay selectores duplicados en `#/roles`.
4. Verifique `MODULE_ACCESS`: supervisor no ve `orders`; operator ve exactamente `operator`, `scheduling`, `roles` (sin pestaña “Listado”); maintenance ve exactamente `maintenance`, `scheduling`. Los IDs de ruta no cambian.
5. Abra `#/admin-roles` solo como `jefa`: `RoleAdminPanel` muestra las cinco tablas, agregar usuario/rol persiste con toast y aparece tras logout/login en el menú y en `#/roles`.
6. Revise privacidad: `operator`/`planner` no ven nombres de `hr_employees` ni de técnicos; `supervisor` ve nombres de operarios; `maintenance` ve nombres de técnicos.

## 18. Calendario de producción (US-13)

1. Abra **Planificación** → **Calendario**: debe abrir en el mes actual, recordar el mes entre pestañas y volver al actual al cambiar de usuario/rol, cerrar sesión o recargar.
2. El filtro inicia en **Ambos**; pruebe **Solo Órdenes de Trabajo** y **Solo Mantenciones** (tickets programados + preventivas).
3. La bandeja **Pendiente de horario** aparece solo para planner y jefa, ordenada por urgencia crítica/prioridad con `% de avance`; solo jefa cambia prioridad y marca **Urgencia crítica**.
4. Como planner, un clic izquierdo simple en una orden pendiente activa `.scheduling-focus-backdrop`, `.scheduling-floating-card` siguiendo el cursor y el aviso de que clic derecho sale del modo.
5. Con `mousedown` + `mouseenter`/`mouseover` arrastre de lunes a miércoles: las celdas se colorean en vivo con `.calendar-day--drag-range`; `mouseup` abre popup con `08:00`–`16:00` editables; `contextmenu` cancela sin popup.
6. Cambie horas a `09:30`–`17:30` y guarde; recargue y verifique persistencia en `erp.manufacturing.v2`.
7. Como planner/jefa/supervisor, haga clic en un día: el menú lista órdenes y mantenciones; elegir una oculta las demás y abre `src/components/calendar/CalendarEventDialog.js` con **Volver a la lista del día**. Supervisor no ve inputs de fecha/hora ni botones de guardar y sus eventos tienen `draggable="false"`.
8. Supervisor además ve nombres reales con etiqueta SC-08 “solo contexto operativo — no evaluación de desempeño”, alerta de órdenes sin operador y mantenciones como resumen de solo lectura. Jefa ve indicadores de color por día y resumen ejecutivo (productos, meta, máquinas activas/inactivas, operadores). Operator ve solo sus órdenes y mantenciones en solo lectura.

## 19. Estaciones desde BOM (US-14)

1. Libere una orden con receta/ruta BOM y compruebe que `order_stations` se precarga con una fila por operación, `Secuencia <N>`, nombre del `work_center` y cantidad de trabajadores, sin doble numeración `1., 2., 3.`.
2. Abra el detalle diario de la orden: debe incluir título explicativo y las estaciones en solo lectura.
3. El botón **Editar estaciones y trabajadores** aparece solo para supervisor/jefa, redirige a `#/supervision` y abre esa orden en `SupervisorLinePanel.js`.
4. Añada una estación, quite otra y asigne dos operadores; confirme persistencia tras recarga.
5. `#/orders` conserva buscador y filtro de prioridad, sin controles de estaciones/operadores; liberar de nuevo no duplica filas.

## 20. Mantenimiento (US-15)

1. Abra **Mantenimiento** y confirme las subpestañas exactas “Máquinas”, “Tickets” y “Mantenimientos”.
2. En **Máquinas**: busque por nombre, filtre por sección, revise alerta de frecuencia superada, badges, historial de fallas, paradas acumuladas y `deriveWearIndicator`; el campo “Cada cuánto se recomienda mantención” solo es editable por `maintenance` y jefa. “Revisar históricas” enfoca “Históricos” y prellena el buscador con la máquina elegida.
3. En **Tickets** solo hay tabla; **Programar mantención** abre modal de técnico/inicio/plazo, pasa ticket a `in_progress`, máquina a `fault` y sincroniza calendario y bloque **Activos**.
4. Clic en un ticket despliega debajo detalle, historial de fallas, historial completo de mantenciones y nivel `Bajo`/`Medio`/`Alto` con conteo y minutos.
5. En **Mantenimientos**, los bloques son **Activos**, **No resueltos por vencimiento** e **Históricos**, cada uno con buscador por máquina o código y 100 % de correspondencia con el calendario.
6. Un activo vencido sigue visible con fecha hasta hoy; si se resolvió antes del plazo, la fecha final se acorta a la resolución real; la fecha original no se altera.
7. Solo `maintenance` ve **Resolver** en el calendario (sin bandeja manual): al seleccionar una activa ve tiempo parado, técnico y prioridad; el popup dice **“¿Está seguro que quiere resolver esta mantención?”** y trae fecha/hora editable prellenada con la hora actual del sistema al hacer clic. La inactividad se calcula sola.
8. Una preventiva vencida nunca se resuelve sola; solo con **Resolver**. Una resuelta se abre en solo lectura sin botón; no se edita ni se resuelve de nuevo.
9. Para corregir, elimine desde **Históricos** con `ConfirmDialog.js` como `maintenance`: el registro desaparece de `erp.manufacturing.v2` y del calendario; luego créelo de nuevo.
10. Privacidad: técnica/o nombre de técnico solo para `maintenance` y jefa; otros roles ven máquina y duración.

## 21. Mapa de criterios US-12 a US-15

| AC | Verificación |
|---|---|
| AC-47 a AC-52 | §17: cinco roles, credenciales, tablas, selector único, `MODULE_ACCESS` y privacidad. |
| AC-53 a AC-62 | §18: mes, filtros, bandeja, foco, arrastre, menú diario, roles y resúmenes. |
| AC-63 a AC-66 | §19: BOM/stations, `Secuencia <N>`, editor desde supervisión y `#/orders` intacto. |
| AC-67 a AC-75 | §20: tres pestañas, Máquinas, Tickets, tres bloques, fechas, resolución e inmutabilidad. |
| AC-76 | §22: mejoras de `main`, rutas, paquete y `vitest.config.mjs` intactos. |

## 22. Solución de problemas y regresión

- Si el grid del calendario no aparece, confirme que se usa CSS Grid y que no se agregó una dependencia externa.
- Si una mantención vencida desaparece, revise `effectiveMaintenanceEnd(event, today)`; no debe mutar `scheduled_end_date`.
- Si las estaciones se duplican al liberar, revise la unicidad de `(production_order_id, work_center_id, sequence)` en `order_stations`.
- Si un rol ve nombres que no debe, revise `visibleEmployeeNamesFor` / `visibleTechnicianNamesFor` en `src/domain/role-access.js`.
- Ejecute `npm test` al terminar: las suites de Fases 1 a 24 deben pasar sin cambios en `vitest.config.mjs`, `package.json` ni `index.html`.
