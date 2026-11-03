# Especificación: Módulo de Operaciones / Manufactura (ERP)

**Rama**: `002-operations-manufacturing` | **Fecha**: 2026-10-31 | **Actualizado**: 2026-11-03
**Datos maestros**: [data-model.md](data-model.md) | **Plan**: [plan.md](plan.md) | **Tareas**: [tasks.md](tasks.md)

---

## 1. Objetivo

Implementar un prototipo funcional de frontend para el módulo de Operaciones / Manufactura que centraliza el ciclo **planificado → programado → ejecutado → registrado → supervisado → mantenido**: gestión de BOM y rutas, despacho de órdenes, seguimiento de operaciones en piso, registro de turno del operador, supervisión de línea en tiempo real (semáforo, asignación de personal, validación de cierre y escalamiento a mantenimiento), panel de desempeño de planta (carga, OEE, paradas, alarmas, reportes y permisos) y gestión de mantenimiento correctivo/preventivo con registro de tiempos de parada y restablecimiento de la disponibilidad de las máquinas.

## Clarifications

<details>
<summary><strong>Session 2026-10-29 (Operador - US-06)</strong></summary>

- **Q**: ¿El botón de iniciar/finalizar debe operar sobre la operación activa de la orden o sobre la orden de producción completa? → **A**: Operación activa; la orden cambia de estado automáticamente según FR-04.
- **Q**: ¿El contador de piezas debe actualizar la cantidad completada de la operación activa o ser un conteo independiente del turno? → **A**: Actualiza `quantity_completed` de la operación activa en tiempo real; salida y merma permanecen en FR-05.
- **Q**: ¿El contador debe acumularse por operación a través de varios turnos o reiniciarse en cada turno? → **A**: Dos contadores: uno por turno (se reinicia al iniciar cada turno) y uno acumulado por operación (no se reinicia).
- **Q**: Si el operador finaliza la operación mientras hay un atraso en curso, ¿qué debe hacer el sistema? → **A**: Permitir el cierre de la operación; el atraso queda abierto para corregirlo después.
- **Q**: ¿El operador debe tener un único botón que alterna entre iniciar y finalizar, o dos botones separados? → **A**: Un único botón alterno ("Iniciar"/"Finalizar") con confirmación antes de finalizar.

</details>

<details open>
<summary><strong>Session 2026-10-31 (Supervisor de Operaciones - US-07 / HU-04)</strong></summary>

- **Q**: ¿Cómo se determina el estado del semáforo en vivo de cada línea/máquina (`work_center`)? → **A**: Se deriva reactivamente del estado operativo y eventos activos (`in_operation` / En operación, `paused` / En pausa, `fault` / En fallo cuando existe un atraso crítico o ticket urgente abierto, `changeover` / Cambio de formato) permitiendo además cambio manual justificado por el supervisor.
- **Q**: ¿Cómo se vinculan los operarios con las máquinas para el turno? → **A**: Mediante asignaciones de turno (`shift_assignments` / `tblSHIFT_ASSIGNMENTS`) usando el puente de solo lectura `ext_hr_employee_id` hacia el módulo de *Recursos Humanos y Planillas*.
- **Q**: ¿Qué ocurre cuando el supervisor valida un cierre de turno o escala un incidente? → **A**: La validación marca `supervisor_validated = true` con timestamp y firma del supervisor sobre el turno cerrado (`completed`); el botón de alerta de escalamiento marca `escalated_to_maint = true` en el evento de parada/atraso y genera un registro urgente en `maintenance_tickets` (`tblMAINTENANCE_TICKETS`) cambiando el semáforo del centro de trabajo a `fault` ("En fallo").

</details>

## 2. Alcance

- Gestión de BOM multi-nivel (`bill_of_materials`, `bom_components`) con detección de ciclos.
- Configuración de centros de trabajo y rutas (`work_centers`, `routings`, `routing_operations`) con tiempos estándar.
- Despacho de órdenes (`production_orders`) desde reposición o make-to-order (`sales_order_id`), con congelación de BOM/ruta y generación de operaciones.
- Ejecución en piso (`production_order_operations`) con estados `pending → in_progress → paused → completed`, tiempos reales y cálculo de avance.
- Registro de turno del operador: inicio/fin de la orden activa con un solo botón, tiempo real, justificación de atrasos con motivos predefinidos o personalizados, y contador de piezas del turno.
- **Supervisión de operaciones en línea (HU-04 / US-07)**: semáforo de estado en tiempo real por línea/máquina (*En operación, En pausa, En fallo, Cambio de formato*), asignación de operarios a máquinas para el turno (`shift_assignments` con puente `ext_hr_employee_id`), revisión y aprobación de cierres de turno (`supervisor_validated = true`), y escalamiento inmediato de incidentes a mantenimiento (`maintenance_tickets` con `escalated_to_maint = true`).
- Consumo real (`material_consumption`) vs. teórico, y salida de bien terminado (`production_output`) con merma.
- Panel con KPIs, tablero kanban, trazabilidad plan-vs-real y estado de calidad derivado.
- **Panel de desempeño de planta (US-08 / Jefa de Planta)**: carga por centro, OEE y paradas acumuladas por período, umbrales críticos con alarmas, reprogramación y cancelación de órdenes, exportación del reporte consolidado a PDF y Excel, y permisos por rol simulados.
- **Gestión de mantenimiento y disponibilidad de máquinas (US-09 / HU-06)**: bandeja de tickets escalados, toma de intervención con técnico asignado, historial y desgaste por máquina, órdenes de mantenimiento preventivo, registro de tiempos reales de parada y restablecimiento del semáforo del centro de trabajo.

**Límites**: sin backend, sin MRP automático, sin MES en tiempo real. Las entidades de frontera (`products`, `warehouses`, `units_of_measure`, `companies`, `sales_orders`, `quality_inspections`, `hr_employees`) se consumen como datos simulados de solo lectura.

## 3. Personas

| Persona | Descripción |
|---|---|
| **Planificador de Producción / Jefe de Planta** | Gestiona BOM y rutas, define capacidad, programa y prioriza órdenes, monitorea carga. |
| **Supervisor de Operaciones / Línea (`@carlos-277`)** | Monitorea el semáforo de líneas/máquinas en tiempo real, asigna operarios por turno (`ext_hr_employee_id`), revisa y aprueba cierres de turno (`supervisor_validated`) y escala incidentes críticos a mantenimiento. |
| **Operador de Máquina (`@maximilianMC`)** | Ejecuta operaciones en pantalla táctil/piso, inicia/finaliza turno, justifica atrasos, registra conteo de piezas, consumo, salida y merma. |
| **Ingeniero de Producción (`@JualTrupe`)** | Configura rutas de fabricación y tiempos estándar, analiza el balance de líneas y evalúa informes de materiales para optimizar tiempos, reducir mermas y encontrar rutas óptimas. |
| **Encargado de Mantenimiento (`@SebastianRivasprg`)** | Atiende incidentes críticos escalados desde piso (`fault`), analiza historial operativo y evalúa desgaste en maquinaria para programar mantenimientos preventivos, registra tiempos de parada por mantención y restablece la disponibilidad operativa de las máquinas. |

## 4. Requisitos Funcionales

<details>
<summary><strong>FR-01 a FR-06: Base Implementada (US-01 a US-05 y Panel)</strong></summary>

### FR-01: Gestión de BOM (US-01)
- Crear/ver BOM por producto terminado con `base_quantity > 0`, `version`, `effective_from`.
- Añadir componentes con `quantity_per_unit > 0`, unidad y merma. Rechazar duplicados (`UNIQUE (bom_id, component_product_id)`).
- Visualizar árbol multi-nivel (≥4 niveles), distinguir sub-ensamble vs. material.
- Detectar ciclos y cortarlos sin recursión infinita.

### FR-02: Centros de Trabajo y Rutas (US-02)
- Configurar `work_centers` con `capacity_per_day_minutes > 0` y `efficiency_factor` en (0,1].
- Crear `routings` con operaciones ordenadas por `sequence` ≥ 10, estrictamente crecientes.
- Calcular `planned_time_minutes = setup_time_minutes + run_time_per_unit_minutes × quantity`.
- Editar ruta sin mutar `production_order_operations` ya congeladas.

### FR-03: Despacho de Órdenes (US-03)
- Crear orden con `quantity_planned > 0`, producto, BOM, bodega destino.
- Soportar MTO (`sales_order_id` con `make_to_order=true`) o stock (`sales_order_id = null`).
- Al liberar, congelar BOM/ruta y generar una `production_order_operations` por cada paso de ruta.
- Transiciones: `planned → released → in_progress → completed`, `cancelled` lateral desde no-terminales.

### FR-04: Ejecución en Piso (US-04)
- Operaciones: `pending → in_progress → paused → completed`. `started_at` al iniciar; `completed_at` al completar.
- Primera operación iniciada → orden pasa a `in_progress`. Todas completadas → orden pasa a `completed` con `actual_end_date`.
- Capturar `actual_time_minutes > 0`, `quantity_completed`, `scrap_quantity`.
- Marcar operaciones fuera de secuencia como advertencia (no bloqueante).

### FR-05: Consumo y Salida (US-05)
- Registrar `material_consumption` con `quantity_consumed > 0`, vinculado a orden/componente/bodega.
- Mostrar teórico vs. real por línea BOM; permitir uso no planificado (`bom_component_id = null`).
- Registrar `production_output` con `quantity_produced > 0` y `scrap_quantity ≥ 0`. Soportar salidas parciales.
- Simular débito/crédito de inventario vía `InventoryPort`.
- Calcular yield (`produced/planned`) y scrap rate (`scrap/(produced+scrap)`) sin persistir.

### FR-06: Panel y Trazabilidad
- KPIs: órdenes activas, scrap rate, completion/yield, totales.
- Utilización por centro de trabajo (carga pendiente vs. capacidad efectiva).
- Trazabilidad por orden: operaciones, consumo plan-vs-real, salida, calidad derivada.

</details>

<details open>
<summary><strong>FR-07: Registro de Turno del Operador (US-06 / HU-05)</strong></summary>

**US-06**: Como operador de máquina, quiero iniciar y finalizar mi orden de trabajo activo con un solo botón, registrar el tiempo de trabajo, justificar atrasos seleccionando motivos predefinidos o escribiendo uno nuevo, e ingresar el número de piezas del turno con un contador.

- Mostrar la orden activa del operador y su operación en curso con un único botón que alterna entre "Iniciar" y "Finalizar" según el estado, solicitando confirmación antes de finalizar; la acción actúa sobre la operación activa y la orden cambia de estado automáticamente (FR-04); impedir una segunda operación en ejecución simultánea y el doble cierre.
- Registrar marcas de tiempo de inicio y fin de la operación activa, y calcular la duración del trabajo con tolerancia máxima de 1 segundo.
- Ofrecer un catálogo de motivos de atraso predefinidos y permitir crear un motivo personalizado reutilizable durante el turno; impedir atrasos sin motivo o simultáneos.
- Registrar cada atraso de la operación activa con motivo, inicio, fin y duración; pausar el tiempo de trabajo efectivo mientras el atraso esté en curso y reanudarlo al finalizarlo.
- Permitir finalizar la operación aunque exista un atraso en curso; el atraso permanece abierto para su corrección posterior y no bloquea el cierre.
- Mantener dos contadores de piezas: uno del turno actual (se reinicia al iniciar cada turno) y uno acumulado por operación (`quantity_completed`, no se reinicia); permitir incrementar, decrementar y fijar manualmente ambos, rechazando valores negativos o no numéricos y conservando el último valor válido.
- Presentar un resumen por operación y orden con tiempo total, tiempo de atrasos justificados y piezas del turno y acumuladas; conservar estado, tiempos, atrasos y contadores ante recarga o interrupción de la sesión.

</details>

<details open>
<summary><strong>FR-08: Supervisión de Línea, Semáforo, Asignación de Personal, Validación de Turno y Escalamiento (US-07 / HU-04)</strong></summary>

**US-07 (HU-04 — Supervisor de Operaciones / Línea)**: Como Supervisor de Operaciones / Línea (Nivel Táctico-Operativo a pie de fábrica), quiero visualizar el semáforo de estado de cada línea/máquina en tiempo real, vincular operarios con máquinas para el turno, revisar y aprobar los cierres de turno y escalar incidentes a mantenimiento con un botón de alerta, para asegurar el cumplimiento del plan del turno y resolver incidencias inmediatas.

- **Semáforo en tiempo real por línea/máquina (`work_centers` / `Entity`)**: Mostrar tarjetas o filas por cada centro de trabajo con su estado operativo en vivo (`in_operation` = *En operación* [verde], `paused` = *En pausa* [amarillo], `changeover` = *Cambio de formato* [azul/ámbar], `fault` = *En fallo* [rojo]), junto con la orden/operación activa, operario asignado y avance de piezas.
- **Asignación de personal al turno (`shift_assignments` / `tblSHIFT_ASSIGNMENTS`)**: Permitir vincular un operario (`ext_hr_employee_id`, puente hacia *Recursos Humanos y Planillas*) con un centro de trabajo/máquina (`work_center_id` / `lineIdRef`) y franja de turno (`morning`, `afternoon`, `night`); impedir que un mismo operario sea asignado simultáneamente a dos máquinas activas en la misma franja sin confirmación de reasignación.
- **Revisión y aprobación de cierres de turno (`production_shifts` / `tblPRODUCTION_COUNTS`)**: Listar los turnos finalizados (`status === 'completed'`) pendientes de revisión con su resumen de piezas conformes, merma, tiempo efectivo y atrasos (`operation_delays` / `tblDOWNTIME_EVENTS`); permitir al supervisor aprobar el cierre marcando `supervisor_validated = true`, `validated_at` y nota opcional de supervisión. Bloquear la aprobación si el turno aún tiene un atraso abierto sin corregir (integración con `DelayCorrectionDialog` de US-06).
- **Escalamiento de incidentes a mantenimiento (`maintenance_tickets` / `tblMAINTENANCE_TICKETS`)**: Incluir un botón de alerta rápida en cada línea/máquina o evento de parada para escalar incidentes críticos; al activarlo, marcar `escalated_to_maint = true` en el evento de atraso/parada (`operation_delays` / `tblDOWNTIME_EVENTS`), crear un ticket urgente (`priority = 'urgent'`, `ticket_status = 'open'`) en `maintenance_tickets` y cambiar automáticamente el estado operativo del centro de trabajo a `fault` (*En fallo*).
- **Persistencia**: Conservar asignaciones de personal, estados del semáforo, validaciones de turno y tickets de mantenimiento escalados dentro del snapshot versionado en `localStorage` (`erp.manufacturing.v1`).

</details>

<details open>
<summary><strong>FR-09: Supervisión del Desempeño de Planta, OEE, Alarmas, Reportes y Permisos (US-08)</strong></summary>

**US-08 (Jefa de Planta)**: Como Jefa de Planta, quiero consultar en un solo lugar la carga de cada centro de trabajo, el OEE, las paradas acumuladas y el cumplimiento de órdenes (por día, semana o mes), recibir alertas cuando un indicador cae bajo su umbral crítico y reprogramar o cancelar órdenes desde la misma vista, para mantener una visión global del desempeño de la planta y decidir en minutos.

- **Carga y capacidad**: Mostrar la carga por centro de trabajo contra `capacity_per_day_minutes` ajustada por `efficiency_factor`, destacando los centros sobre el 100%.
- **OEE derivado**: Calcular el OEE (Disponibilidad × Rendimiento × Calidad) por centro y período (diario, semanal, mensual), derivado de `planned_time_minutes`, `actual_time_minutes`, `operation_delays`, `quantity_completed` y `scrap_quantity`; no se persiste.
- **Paradas acumuladas**: Resumir las paradas acumuladas por centro y motivo (`delay_reasons`), ordenadas de mayor a menor, sin atribuirlas a personas.
- **Umbrales y alarmas**: Configurar umbrales críticos por indicador (ej. rendimiento < 75%), mostrar alarmas visibles y conservar los umbrales en el snapshot `erp.manufacturing.v1`.
- **Gestión de órdenes**: Filtrar órdenes por `status` y `priority`, cambiar la prioridad de órdenes `planned` y cancelar órdenes con confirmación explícita, conservando los registros de ejecución.
- **Centros desactivados**: Bloquear la programación de órdenes nuevas sobre centros de trabajo desactivados.
- **Exportación**: Exportar el reporte consolidado del período (OEE, paradas, cumplimiento y alarmas activas) en PDF y Excel, generado localmente con datos mock.
- **Permisos por rol**: Definir permisos por rol (Jefa de Planta, Planificador, Operador) con un selector de rol simulado, sin autenticación real; la interfaz oculta o bloquea las acciones no permitidas.
- **Ética de datos**: Agregar siempre por centro de trabajo y operación, sin ranking entre operadores; todo detalle por persona lleva la etiqueta *solo contexto operativo — no evaluación de desempeño*.
- **Rendimiento**: Responder en menos de 100 ms con el dataset de volumen (500 órdenes, BOM de 4 niveles).

</details>

<details open>
<summary><strong>FR-10: Gestión de Mantenimiento y Disponibilidad de Máquinas (US-09 / HU-06)</strong></summary>

**US-09 (Encargado de Mantenimiento)**: Como Encargado de Mantenimiento, quiero atender los tickets de avería escalados desde piso en tiempo real, analizar el historial operativo de las máquinas y evaluar su desgaste para programar órdenes de mantenimiento preventivo y registrar los tiempos reales de parada técnica al cerrar cada intervención, para restablecer la disponibilidad operativa de los centros de trabajo.

**Por qué esta prioridad**: Es indispensable para desbloquear las máquinas que caen en estado de fallo (`fault`) y registrar los tiempos de parada que alimentan el OEE de planta.

- **Bandeja de tickets**: Listar los tickets de mantenimiento (`maintenance_tickets` / `tblMAINTENANCE_TICKETS`) escalados desde piso con su prioridad (`urgent`, `high`, `normal`), estado (`open`, `in_progress`, `resolved`), centro de trabajo, evento de parada vinculado (`operation_delays` / `tblDOWNTIME_EVENTS`), quién lo reportó y su fecha de creación; ordenar por prioridad y antigüedad.
- **Toma de intervención**: Permitir asignar un técnico y pasar el ticket a `in_progress` registrando el inicio de la intervención; impedir dos intervenciones simultáneas sobre el mismo centro de trabajo.
- **Historial y desgaste**: Mostrar por máquina el historial de fallos e intervenciones, las paradas acumuladas y un indicador derivado de desgaste/frecuencia de fallos (no persistido) que sustente el mantenimiento preventivo.
- **Órdenes preventivas**: Permitir programar una orden de mantenimiento preventivo a partir del historial y del indicador de desgaste, con fecha objetivo y responsable; la orden preventiva es distinta de los tickets correctivos.
- **Registro de tiempos de parada**: Al cerrar la intervención, registrar el tiempo real de parada técnica (inicio, fin y duración en minutos) y la causa; estos tiempos alimentan el OEE y las paradas acumuladas de US-08.
- **Resolución y disponibilidad**: Al marcar el ticket como `resolved`, registrar fecha de resolución, notas y técnico, y restablecer la disponibilidad del centro de trabajo; el semáforo vuelve a *En operación* o *En pausa* según la operación activa y nunca permanece en `fault` sin un ticket abierto.
- **Integración con supervisión**: Consumir de forma reactiva los tickets generados por el escalamiento de US-07 sin duplicar registros; un ticket resuelto no se reabre, se crea uno nuevo vinculado al mismo evento o a uno nuevo.
- **Persistencia**: Conservar tickets, intervenciones, tiempos de parada y órdenes preventivas dentro del snapshot versionado en `localStorage` (`erp.manufacturing.v1`).
- **Ética de datos**: Los tiempos de intervención son contexto operativo de la máquina, no evaluación de desempeño del técnico; las vistas agregan por centro de trabajo y no generan rankings de personal.

</details>

## 5. Criterios de Aceptación

| ID | Criterio | Estado |
|---|---|---|
| AC-01 | Árbol BOM multi-nivel con ≥4 niveles y ciclo detectado | Implementado |
| AC-02 | Ruta con secuencia estrictamente creciente y tiempo estándar calculado | Implementado |
| AC-03 | Liberación congela BOM/ruta y genera operaciones; MTO/stock soportado | Implementado |
| AC-04 | Máquinas de estados validadas; rechazo de transiciones inversas | Implementado |
| AC-05 | Ejecución con tiempos reales; avance automático del estado de orden | Implementado |
| AC-06 | Consumo teórico vs. real con flags de discrepancia; uso no planificado permitido | Implementado |
| AC-07 | Salida con merma, salidas parciales, inventario simulado actualizado | Implementado |
| AC-08 | Panel con KPIs y utilización por centro de trabajo | Implementado |
| AC-09 | Calidad derivada desde `quality_inspections` (solo lectura) | Implementado |
| AC-10 | Pruebas unitarias del dominio y del store pasan; build exitoso | Verificado |
| AC-11 | Inicio/fin de la operación activa con un único botón alterno y confirmación, tiempo real registrado y sin doble cierre | Planificado |
| AC-12 | Atrasos justificados con motivos predefinidos o personalizados; tiempo efectivo pausado y cierre permitido con atraso abierto para corrección posterior | Planificado |
| AC-13 | Dos contadores de piezas (turno y acumulado) incrementables, ajustables y validados; totales conservados al finalizar y recargar | Planificado |
| AC-14 | Semáforo en vivo por línea/máquina (*En operación, En pausa, En fallo, Cambio de formato*) y registro de asignación de operario (`ext_hr_employee_id`) en `shift_assignments` (`tblSHIFT_ASSIGNMENTS`) | Planificado |
| AC-15 | Aprobación de cierre de turno (`supervisor_validated = true`) tras verificar atrasos cerrados, y disparo de ticket urgente (`escalated_to_maint = true`) hacia `maintenance_tickets` (`tblMAINTENANCE_TICKETS`) pasando la máquina a *En fallo* | Planificado |
| AC-16 | Tablero de carga por centro con OEE (Disponibilidad × Rendimiento × Calidad) y paradas acumuladas por período, derivados y no persistidos | Planificado |
| AC-17 | Umbrales de alarma configurables, persistidos en el snapshot y evaluados de inmediato | Planificado |
| AC-18 | Reprogramación de prioridad y cancelación con confirmación, conservando registros de ejecución | Planificado |
| AC-19 | Exportación del reporte consolidado a PDF y Excel, y permisos por rol simulados | Planificado |
| AC-20 | Carga por centro destacada sobre la capacidad efectiva y bloqueo de programación en centros desactivados | Planificado |
| AC-21 | Bandeja de tickets escalados con prioridad, estado, centro y evento de parada vinculado, ordenada por prioridad y antigüedad | Planificado |
| AC-22 | Toma de intervención con técnico asignado y bloqueo de dos intervenciones simultáneas sobre el mismo centro de trabajo | Planificado |
| AC-23 | Historial por máquina con paradas acumuladas e indicador derivado de desgaste que sustenta la orden preventiva | Planificado |
| AC-24 | Cierre de intervención con tiempo real de parada registrado y restablecimiento del semáforo fuera de *En fallo* | Planificado |
| AC-25 | Ticket resuelto sin reapertura; nueva incidencia genera un ticket vinculado al evento correspondiente | Planificado |
| AC-26 | Tickets, intervenciones, tiempos de parada y órdenes preventivas conservados en el snapshot tras recargar | Planificado |
| AC-27 | Tiempos de mantenimiento agregados por centro, sin rankings ni evaluación de desempeño de técnicos | Planificado |

## 6. Entidades Clave

- **BillOfMaterials / BomComponent**: estructura multi-nivel que define el consumo teórico por unidad.
- **WorkCenter / Routing / RoutingOperation**: capacidad, secuencia y tiempos estándar de fabricación.
- **ProductionOrder / ProductionOrderOperation**: trabajo planificado, liberado y ejecutado, con tiempos y cantidades reales.
- **ProductionShift / OperationDelay / DelayReason**: turno del operador, atrasos justificados y catálogo reutilizable de motivos.
- **ShiftAssignment**: vínculo entre un operario de RR.HH. (`ext_hr_employee_id`) y un centro de trabajo por franja de turno.
- **MaintenanceTicket**: ticket correctivo escalado desde piso, con prioridad, estado, centro, evento de parada, técnico y tiempos de intervención.
- **PreventiveMaintenanceOrder**: orden de mantenimiento preventivo programada a partir del historial y del desgaste de la máquina.
- **Umbral de indicador (ThresholdSetting)**: valor crítico configurable por indicador de planta, persistido en el snapshot.

## 7. Métricas de Éxito

- **SC-01**: La Jefa de Planta obtiene la visión consolidada de carga, OEE, paradas y cumplimiento del período en menos de 1 minuto y sin salir del panel.
- **SC-02**: El 100% de los centros con carga superior a su capacidad efectiva se resaltan y las alarmas por umbral se muestran al abrir el panel.
- **SC-03**: El reporte consolidado se exporta en PDF y Excel con los datos del período seleccionado en menos de 10 segundos.
- **SC-04**: Un Encargado de Mantenimiento identifica y toma el ticket urgente más antiguo en menos de 30 segundos desde que fue escalado.
- **SC-05**: El 100% de las intervenciones cerradas registran su tiempo real de parada y dejan la máquina disponible (fuera de *En fallo*).
- **SC-06**: Tras recargar la página se conserva el 100% de tickets, intervenciones, umbrales y órdenes preventivas.
- **SC-07**: Las interacciones de los paneles responden en menos de 100 ms con 500 órdenes y BOM de 4 niveles.
- **SC-08**: El 0% de las vistas expone rankings individuales; todo detalle por persona se etiqueta como contexto operativo.

## 8. Supuestos y Dependencias

- El snapshot local se mantiene versionado (`erp.manufacturing.v1`); cualquier cambio de forma incrementa la versión y se valida al hidratar.
- `maintenance_tickets` y las órdenes preventivas se modelan como entidades locales del módulo; `data-model.md` debe actualizarse antes de implementar US-09.
- Los roles (Jefa de Planta, Planificador, Operador, Encargado de Mantenimiento) son simulados con un selector; no existe autenticación real.
- La exportación a PDF y Excel se genera localmente con los datos mock, sin backend ni servicios externos.
- Los catálogos de RR.HH., calidad y ventas son datos simulados de solo lectura.
- Los tiempos de turno y de parada se derivan de marcas de tiempo persistidas, no de temporizadores en memoria.
- El OEE y el indicador de desgaste son valores derivados y no se persisten.

## 9. Artefactos Spec-Kit

| Artefacto | Ruta | Propósito |
|---|---|---|
| `spec.md` | `specs/002-operations-manufacturing/spec.md` | Especificación funcional y criterios de aceptación |
| `checklists/requirements.md` | `specs/002-operations-manufacturing/checklists/requirements.md` | Validación de calidad de la especificación |
| `plan.md` | `specs/002-operations-manufacturing/plan.md` | Plan de implementación, fases, gobernanza, estructura |
| `data-model.md` | `specs/002-operations-manufacturing/data-model.md` | Diccionario de datos, ERD Mermaid, ética/datos, trazabilidad |
| `research.md` | `specs/002-operations-manufacturing/research.md` | Decisiones técnicas de US-06, US-07 y US-09 (tiempo, contadores, atrasos, semáforo, escalamiento, mantenimiento, persistencia) |
| `contracts/operator-shift.md` | `specs/002-operations-manufacturing/contracts/operator-shift.md` | Contrato de store/UI para operador (US-06) y supervisor de línea (US-07) |
| `quickstart.md` | `specs/002-operations-manufacturing/quickstart.md` | Guía de ejecución y validación de las historias de usuario |
| `tasks.md` | `specs/002-operations-manufacturing/tasks.md` | Tareas atómicas por fase e historia de usuario |

## 10. Notas de Implementación

- **Stack**: Vanilla JavaScript ES2022 + Vite + CSS. JSDoc para tipado (paridad con `001-erp-base-module`).
- **Arquitectura**: `domain/` (lógica pura), `data/` (fixtures + store + puertos), `components/` (vistas), `styles/`.
- **Estado**: `ManufacturingStore` en memoria con `EventTarget` para re-render reactivo y snapshot versionado en `localStorage` (`erp.manufacturing.v1`) para sobrevivir recargas.
- **Puentes Inter-Modulares (US-07 / HU-04)**: `ext_hr_employee_id` consume catálogo simulado de operarios de RR.HH. (`src/data/fixtures/hr-employees.js`) y el escalamiento genera registros en `maintenance_tickets` consumibles por la vista de Mantenimiento (HU-06).
- **Ética**: agregación por centro/operación, sin rankings individuales; tiempos y asignaciones como dato de coordinación operativa.
