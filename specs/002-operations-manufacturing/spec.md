# Especificación: Módulo de Operaciones / Manufactura (ERP)

**Rama**: `010-manufacturing-ux-refine` (directorio de especificación `specs/002-operations-manufacturing`) | **Fecha**: 2026-10-31 | **Actualizado**: 2026-11-23
**Datos maestros**: [data-model.md](data-model.md) | **Plan**: [plan.md](plan.md) | **Tareas**: [tasks.md](tasks.md)
> **Ampliación 2026-11-23**: se extienden US-12, US-13 y US-15 con baja de usuarios y cambio de contraseña, calendario ancho completo con modales reales y selección por arrastre sin bugs, y rediseño de mantenimiento con mini-calendario de máquina. Fases 1 a 29 de `tasks.md`, `plan.md` y las mejoras presentes en `main` permanecen intactas; los criterios AC-01 a AC-87 se conservan textualmente y la ampliación se registra desde AC-88.

---

## 1. Objetivo

Implementar un prototipo funcional de frontend para el módulo de Operaciones / Manufactura que centraliza el ciclo **planificado → programado → ejecutado → registrado → supervisado → mantenido**: gestión de BOM y rutas, despacho de órdenes, seguimiento de operaciones en piso, registro de turno del operador, supervisión de línea en tiempo real (semáforo, asignación de personal, validación de cierre y escalamiento a mantenimiento), panel de desempeño de planta (carga, OEE, paradas, alarmas, reportes y permisos) y gestión de mantenimiento correctivo/preventivo con registro de tiempos de parada y restablecimiento de la disponibilidad de las máquinas. Se amplía con un sistema multi-rol de cinco roles con tablas de usuario separadas y privacidad de personas, un calendario mensual interactivo con programación por arrastre y vistas estrictas por rol, estaciones derivadas de la receta del BOM gestionadas desde supervisión, y un panel de mantenimiento en tres subpestañas sincronizado con el calendario, con programación desde tickets, fechas dinámicas e inmutabilidad de lo resuelto. Se incorporan tres ajustes de interfaz y navegación: una jerarquía estricta de capas que impide que tablas, barras o encabezados fijos tapen ventanas emergentes; una distribución del calendario mensual con pestañas integradas, cuadrícula de siete columnas legibles y tope visual de tres eventos por día con indicador de exceso; y la unificación de "Roles" en una sola pestaña con subpestañas "Roles" (filtrada por los roles asignados al usuario autenticado) y "Configurar roles" (exclusiva del rol activo Jefa de Planta). Se amplía además con la baja confirmada de usuarios por rol y el cambio de contraseña desde el menú de usuario, un calendario mensual de ancho completo con bandeja horizontal, ventanas emergentes centradas y selección de horario por arrastre continuo, y un rediseño de mantenimiento que consolida máquinas en dos paneles con mini-calendario, simplifica tickets a una sola acción y unifica mantenciones en dos listas.

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
- **Q**: ¿Cómo se vinculan los operadores con las máquinas para el turno? → **A**: Mediante asignaciones de turno (`shift_assignments`) usando el puente de solo lectura `ext_hr_employee_id` hacia el módulo de *Recursos Humanos y Planillas*.
- **Q**: ¿Qué ocurre cuando el supervisor valida un cierre de turno o escala un incidente? → **A**: La validación marca `supervisor_validated = true` con timestamp y firma del supervisor sobre el turno cerrado (`completed`); el botón de alerta de escalamiento marca `escalated_to_maint = true` en el evento de parada/atraso y genera un registro urgente en `maintenance_tickets` cambiando el semáforo del centro de trabajo a `fault` ("En fallo").

</details>

<details>
<summary><strong>Session 2026-11-23 (US-12 a US-15)</strong></summary>

- **Q**: ¿Qué identidad se obtiene si un mismo usuario aparece en varias tablas de rol? → **A**: la unión de todos los roles en los que aparece; el selector superior muestra únicamente esa unión, sin opciones extra.
- **Q**: ¿Qué alcance tiene la memoria del mes visitado en el calendario? → **A**: solo recuerda el último mes entre cambios de pestaña dentro del panel; cambiar de usuario/rol, cerrar sesión o recargar vuelve al mes actual.
- **Q**: ¿Cómo se corrige una mantención resuelta por error? → **A**: no se edita ni se vuelve a resolver; se elimina desde "Mantenimientos históricos" con confirmación y se crea un registro nuevo.

</details>

<details open>
<summary><strong>Session 2026-11-23 (Ajustes de interfaz y navegación — US-12 / US-13 / FR-13)</strong></summary>

- **Q**: ¿Qué ocurre al presionar la tarjeta del rol ya activo en la subpestaña "Roles"? → **A**: no se abre confirmación ni cambia nada; `ConfirmDialog.js` aparece únicamente al elegir un rol distinto al activo.
- **Q**: ¿Debe el indicador "+N más" desplegar el detalle de los eventos restantes dentro de la celda? → **A**: no; es un indicador compacto y solo informa del exceso. El detalle completo de todas las actividades del día se consulta en el menú del día.
- **Q**: ¿Puede configurar roles un usuario con la Jefa de Planta asignada pero con otro rol activo? → **A**: no; "Configurar roles" depende del **rol activo**. Si abre `#/admin-roles` con otro rol activo, se deniega la configuración y se muestra la subpestaña "Roles" filtrada.
- **Q**: ¿Cómo se evita que un modal quede por debajo de una tabla con encabezado fijo? → **A**: con una escala de capas fija y sin contenedores de vista, contenido o panel que generen contextos de apilamiento que encierren al modal.

</details>

<details open>
<summary><strong>Session 2026-11-23 (Ampliación de US-12 / US-13 / US-15)</strong></summary>

- **Q**: ¿Qué ocurre al intentar quitar al último usuario de la tabla `plant_manager`? → **A**: la operación se rechaza con un mensaje claro y la tabla queda intacta; las demás tablas de rol admiten quitar cualquier usuario previa confirmación.
- **Q**: ¿Cómo se cambia la contraseña de una cuenta demo? → **A**: desde "Cambiar contraseña" del menú superior, validando la contraseña actual y la confirmación; la nueva contraseña se aplica a todas las tablas de rol donde figure el usuario y se valida al iniciar sesión, incluso tras cerrar sesión o recargar.
- **Q**: ¿Cómo se cierran las ventanas emergentes del calendario? → **A**: siempre con botón, tecla Escape y clic fuera, en las tres variantes (menú del día, detalle de evento y popup de horario).
- **Q**: ¿Qué interacción ofrece el mini-calendario de máquina? → **A**: únicamente la navegación de mes con ‹ y ›; las celdas son informativas y no seleccionables ni clickeables.
- **Q**: ¿Cómo se agrupan las mantenciones vigentes y vencidas? → **A**: en una sola lista "Mantenimientos activos" con filtro "Todos", "Vigentes" y "Vencidos"; los resueltos pasan a "Mantenimientos históricos".

</details>

## 2. Alcance

- Gestión de BOM multi-nivel (`bill_of_materials`, `bom_components`) con detección de ciclos.
- Configuración de centros de trabajo y rutas (`work_centers`, `routings`, `routing_operations`) con tiempos estándar.
- Despacho de órdenes (`production_orders`) desde reposición o make-to-order (`sales_order_id`), con congelación de BOM/ruta y generación de operaciones.
- Ejecución en piso (`production_order_operations`) con estados `pending → in_progress → paused → completed`, tiempos reales y cálculo de avance.
- Registro de turno del operador: inicio/fin de la orden activa con un solo botón, tiempo real, justificación de atrasos con motivos predefinidos o personalizados, y contador de piezas del turno.
- **Supervisión de operaciones en línea (HU-04 / US-07)**: semáforo de estado en tiempo real por línea/máquina (*En operación, En pausa, En fallo, Cambio de formato*), asignación de operadores a máquinas para el turno (`shift_assignments` con puente `ext_hr_employee_id`), revisión y aprobación de cierres de turno (`supervisor_validated = true`), y escalamiento inmediato de incidentes a mantenimiento (`maintenance_tickets` con `escalated_to_maint = true`).
- Consumo real (`material_consumption`) vs. teórico, y salida de bien terminado (`production_output`) con merma.
- Panel con KPIs, tablero kanban, trazabilidad plan-vs-real y estado de calidad derivado. El tablero permite arrastrar tarjetas entre columnas válidas, respetando la máquina de estados.
- La captura de datos numéricos admite escritura directa con punto o coma decimal y un máximo de dos decimales, sin flechas de precisión que bloqueen el formulario.
- **Panel de desempeño de planta (US-08 / Jefa de Planta)**: carga por centro, OEE y paradas acumuladas por período, umbrales críticos con alarmas, reprogramación y cancelación de órdenes, exportación del reporte consolidado a PDF y Excel, y permisos por rol simulados.
- **Gestión de mantenimiento y disponibilidad de máquinas (US-09 / HU-06)**: bandeja de tickets escalados, toma de intervención con técnico asignado, historial y desgaste por máquina, órdenes de mantenimiento preventivo, registro de tiempos reales de parada y restablecimiento del semáforo del centro de trabajo.
- **Acceso por rol y navegación**: ingreso con credenciales simuladas por usuario, resolución de todos los roles asignados desde cinco tablas de usuario, filtrado de la navegación según permisos, navegación por hash (deep links y botón atrás), panel de administración de roles restringido a la Jefa de Planta y datos simulados para probar estados y formularios sin backend.
- **Sistema multi-rol y privacidad (US-12)**: quinto rol canónico de Encargado de Mantenimiento, cinco tablas de usuarios persistentes, selector único de roles asignados, matriz de módulos por rol y reglas de anonimización de nombres de RR.HH. y de técnicos de mantención.
- **Calendario mensual interactivo (US-13)**: calendario mensual con filtro de eventos, bandeja de pendientes de horario, modo de selección por arrastre para el planificador, menú diario por tarea, ventanas de detalle por rol y resúmenes contextuales según el rol activo.
- **Estaciones derivadas del BOM (US-14)**: estación equivalente a máquina (`work_center`), secuencia derivada de la receta/ruta de cada orden y edición de dotación exclusivamente desde supervisión para supervisor y Jefa de Planta.
- **Mantenimiento en tres subpestañas (US-15)**: máquinas con alertas e indicador de desgaste, tickets con programación de mantenciones, y mantenciones activas/vencidas/históricas sincronizadas con el calendario, con cálculo automático de parada, fechas dinámicas e inmutabilidad de registros resueltos.
- **Jerarquía de capas para ventanas emergentes (FR-19)**: escala de superposición obligatoria que impide que encabezados fijos de tabla, barras laterales o barras superiores tapen modales, popups, diálogos de confirmación ni notificaciones, sin contextos de apilamiento que atrapen los modales por debajo de las tablas.
- **Distribución del calendario mensual (US-13)**: pestañas "Calendario" y "Listado" integradas en el sistema visual de la aplicación, cuadrícula de siete columnas proporcionales a ancho completo con títulos legibles, y tope visual de tres eventos por día con indicador "+N más" cuyo detalle completo se consulta en el menú del día.
- **Unificación de Roles (US-12 / FR-13)**: un único acceso lateral "Roles" (`#/roles`) con subpestañas "Roles" (solo tarjetas de los roles asignados al usuario autenticado, con confirmación antes de cambiar el rol activo) y "Configurar roles" (solo para el rol activo Jefa de Planta, con las cinco tablas y altas/asignaciones persistidas); `#/admin-roles` abre directamente la subpestaña de configuración dentro de Roles.
- **Baja de usuarios y credenciales (US-12)**: cada chip de usuario en las cinco tablas de rol ofrece "Quitar" (×) con confirmación, sin permitir vaciar `plant_manager`; las cuentas nuevas conservan la contraseña igual al nombre de usuario y cualquier usuario autenticado puede cambiar su contraseña desde el menú superior, con persistencia y validación en el ingreso.
- **Calendario ancho completo y modales reales (US-13)**: bandeja "Pendiente de horario" como barra horizontal compacta sobre un calendario que ocupa el 100 % del ancho útil en los cinco roles; menú diario, detalle de evento y popup de horario siempre como ventanas centradas, con cierre por botón, Escape y clic fuera; selección de horario por arrastre continuo con rango exacto y apertura inmediata del modal al soltar.
- **Rediseño de mantenimiento (US-15)**: vista de máquinas en dos paneles con detalle consolidado, deselección explícita o por clic fuera y mini-calendario mensual informativo con leyenda de colores; tickets reducidos a buscador, detalle desplegable y "Programar mantención"; mantenciones unificadas en exactamente dos listas (activas con filtro de vigencia e históricas con baja confirmada).

**Límites**: sin backend, sin MRP automático, sin MES en tiempo real. Las entidades de frontera (`products`, `warehouses`, `units_of_measure`, `companies`, `sales_orders`, `quality_inspections`, `hr_employees`) se consumen como datos simulados de solo lectura.

> **Convención de "tiempo real"**: en esta especificación significa actualización reactiva inmediata de la interfaz ante cambios del store local y eventos persistidos, con objetivo `< 100 ms` (SC-07). No implica telemetría de máquina, backend ni sincronización externa.

## 3. Personas

| Persona | Descripción |
|---|---|
| **Jefa de Planta (`@Lia-dl`)** | Gestiona BOM y rutas, define capacidad, programa y prioriza órdenes, monitorea carga. Supervisa el desempeño global de la planta: consulta carga por centro, OEE, paradas acumuladas y cumplimiento de órdenes, configura alarmas de umbral, reprograma o cancela órdenes, exporta reportes consolidados y define permisos por rol. Analiza por centro de trabajo y operación, sin ranking de operadores. |
| **Supervisor de Operaciones / Línea (`@carlos-277`)** | Monitorea el semáforo de líneas/máquinas en tiempo real, asigna operadores por turno (`ext_hr_employee_id`), revisa y aprueba cierres de turno (`supervisor_validated`) y escala incidentes críticos a mantenimiento. |
| **Operador de Máquina (`@maximilianMC`)** | Ejecuta operaciones en pantalla táctil/piso, inicia/finaliza turno, justifica atrasos, registra conteo de piezas, consumo, salida y merma. |
| **Ingeniero de Producción (`@JualTrupe`)** | Configura rutas de fabricación y tiempos estándar, analiza el balance de líneas y evalúa informes de materiales para optimizar tiempos, reducir mermas y encontrar rutas óptimas. |
| **Encargado de Mantenimiento (`@SebastianRivasprg`)** | Atiende incidentes críticos escalados desde piso (`fault`), analiza historial operativo y evalúa desgaste en maquinaria para programar mantenimientos preventivos, registra tiempos de parada por mantención y restablece la disponibilidad operativa de las máquinas. |
| **Planificador (`@maiteval`)** |  Organiza y calendariza las órdenes de producción, asignando fechas planificadas de inicio y término a las tareas. Coordina la secuencia de fabricación según las prioridades y plazos de entrega, consulta el estado de las órdenes y ajusta la programación cuando existen atrasos o cambios en la producción, buscando optimizar los tiempos y cumplir con las fechas de entrega establecidas. |

> **Convención de roles simulados**: la interfaz usa cinco etiquetas de rol canónicas —Jefa de Planta (`plant_manager`), Supervisor de Operaciones/Línea (`supervisor`), Planificador (`planner`), **Operador** (`operator`) y Encargado de Mantenimiento (`maintenance`)—. "Operador" es la forma canónica en textos de asignación de RR.HH. y descripciones de persona, con "Operador de Máquina" como variante descriptiva; la etiqueta visible canónica en toda la interfaz es **Operador**. Cada rol cuenta con credenciales demo propias y el usuario autenticado puede tener varios roles a la vez; las responsabilidades de Ingeniería de Producción se ejercen desde Planificador, sin crear un sexto rol.

## 4. Requisitos Funcionales

<details>
<summary><strong>FR-01 a FR-06: Base Implementada (US-01 a US-05 y Panel)</strong></summary>

### FR-01: Lista de Materiales (BOM) (US-01)
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
- El tablero kanban permite arrastrar una orden a la columna de un estado siguiente válido; los saltos inválidos se ignoran sin mutar la orden.

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
- Utilización por centro de trabajo (carga pendiente vs. capacidad efectiva); al activar una fila se abre una ventana con las operaciones no completadas que generan esa carga (orden, secuencia, estado y minutos).
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
- Rechazar cualquier ajuste que deje `quantity_completed` por encima de `production_orders.quantity_planned`, mostrando el error inline y sin mutar turno ni operación. La finalización de la operación no sobrescribe el acumulado registrado.
- Presentar un resumen por operación y orden con tiempo total, tiempo de atrasos justificados y piezas del turno y acumuladas; conservar estado, tiempos, atrasos y contadores ante recarga o interrupción de la sesión.

</details>

<details open>
<summary><strong>FR-08: Supervisión de Línea, Semáforo, Asignación de Personal, Validación de Turno y Escalamiento (US-07 / HU-04)</strong></summary>

**US-07 (HU-04 — Supervisor de Operaciones / Línea)**: Como Supervisor de Operaciones / Línea (Nivel Táctico-Operativo a pie de fábrica), quiero visualizar el semáforo de estado de cada línea/máquina en tiempo real, vincular operadores con máquinas para el turno, revisar y aprobar los cierres de turno y escalar incidentes a mantenimiento con un botón de alerta, para asegurar el cumplimiento del plan del turno y resolver incidencias inmediatas.

- **Semáforo en tiempo real por línea/máquina (`work_centers`)**: Mostrar tarjetas o filas por cada centro de trabajo con su estado operativo en vivo (`in_operation` = *En operación* [verde], `paused` = *En pausa* [amarillo], `changeover` = *Cambio de formato* [azul/ámbar], `fault` = *En fallo* [rojo]), junto con la orden/operación activa, operador asignado y avance de piezas.
- **Asignación de personal al turno (`shift_assignments`)**: Permitir vincular un operador (`ext_hr_employee_id`, puente hacia *Recursos Humanos y Planillas*) con un centro de trabajo/máquina (`work_center_id`) y franja de turno (`morning`, `afternoon`, `night`); impedir que un mismo operador sea asignado simultáneamente a dos máquinas activas en la misma franja sin confirmación de reasignación.
- **Revisión y aprobación de cierres de turno (`production_shifts`)**: Listar los turnos finalizados (`status === 'completed'`) pendientes de revisión con su resumen de piezas conformes, merma, tiempo efectivo y atrasos (`operation_delays`); permitir al supervisor aprobar el cierre marcando `supervisor_validated = true`, `validated_by`, `validated_at` y nota opcional de supervisión. Bloquear la aprobación si el turno aún tiene un atraso abierto sin corregir (integración con `DelayCorrectionDialog` de US-06).
- **Escalamiento de incidentes a mantenimiento (`maintenance_tickets`)**: Incluir un botón de alerta rápida en cada línea/máquina o evento de parada para escalar incidentes críticos; al activarlo, marcar `escalated_to_maint = true` en el evento de atraso/parada (`operation_delays`), crear un ticket urgente (`priority = 'urgent'`, `ticket_status = 'open'`) en `maintenance_tickets` y cambiar automáticamente el estado operativo del centro de trabajo a `fault` (*En fallo*).
- **Persistencia**: Conservar asignaciones de personal, estados del semáforo, validaciones de turno y tickets de mantenimiento escalados dentro del snapshot versionado en `localStorage` (`erp.manufacturing.v2`; un `v1` existente se migra automáticamente).

</details>


<details open>
<summary><strong>FR-09: Supervisión del Desempeño de Planta, OEE, Alarmas, Reportes y Permisos (US-08)</strong></summary>

**US-08 (Jefa de Planta)**: Como Jefa de Planta, quiero consultar en un solo lugar la carga de cada centro de trabajo, el OEE, las paradas acumuladas y el cumplimiento de órdenes (por día, semana o mes), recibir alertas cuando un indicador cae bajo su umbral crítico y reprogramar o cancelar órdenes desde la misma vista, para mantener una visión global del desempeño de la planta y decidir en minutos.

- **Carga y capacidad**: Mostrar la carga por centro de trabajo contra la capacidad efectiva: en el resumen del período, `días hábiles × capacity_per_day_minutes × efficiency_factor`; en la tarjeta diaria, `capacity_per_day_minutes × efficiency_factor`. Destacar los centros sobre el 100 % solo en el panel de planta; el balance usa su propio umbral de 95 %.
- **OEE derivado**: Calcular el OEE (Disponibilidad × Rendimiento × Calidad) por centro y período (diario, semanal, mensual), derivado de `planned_time_minutes`, `actual_time_minutes` como tiempo ejecutado observado, `operation_delays`, `maintenance_tickets.downtime_minutes` de intervenciones cerradas, `quantity_completed` y `scrap_quantity`; no se persiste. Fórmula única: `disponibilidad = (planned_time_minutes − downtime_minutes) / planned_time_minutes`, con `downtime_minutes = Σ operation_delays.duration_minutes + Σ maintenance_tickets.downtime_minutes` del período; `rendimiento = quantity_completed / (run_time_per_unit_minutes × quantity_planned)`; `calidad = quantity_completed / (quantity_completed + scrap_quantity)`; `OEE = disponibilidad × rendimiento × calidad`, acotado a `[0,1]`.
- **Paradas acumuladas**: Resumir las paradas acumuladas por centro y motivo (`delay_reasons`), ordenadas de mayor a menor, sin atribuirlas a personas.
- **Umbrales y alarmas**: Configurar umbrales críticos por indicador (ej. rendimiento < 75%), mostrar alarmas visibles y conservar los umbrales en el snapshot `erp.manufacturing.v2`.
- **Gestión de órdenes**: Filtrar órdenes por `status` y `priority`, cambiar la prioridad de órdenes `planned` y cancelar órdenes con confirmación explícita, conservando los registros de ejecución.
- **Centros desactivados**: Bloquear la programación de órdenes nuevas sobre centros de trabajo desactivados.
- **Exportación**: Exportar el reporte consolidado del período (OEE, paradas, cumplimiento y alarmas activas) en PDF y Excel, generado localmente con datos mock y sin dependencias externas: Excel mediante descarga CSV/SpreadsheetML y PDF mediante una vista imprimible con `window.print()`.
- **Permisos por rol**: Definir permisos por rol (Jefa de Planta, Supervisor de Operaciones/Línea, Planificador, Operador de Máquina) con un selector de rol simulado, sin autenticación real; la interfaz oculta o bloquea las acciones no permitidas. El Supervisor puede consultar el panel, cambiar prioridades y exportar; no puede modificar umbrales. Jefa de Planta tiene todos los permisos; Planificador puede cambiar prioridades y exportar; Operador solo consulta.
- **Ética de datos**: Agregar siempre por centro de trabajo y operación, sin ranking entre operadores; todo detalle por persona lleva la etiqueta *solo contexto operativo — no evaluación de desempeño*.
- **Rendimiento**: Responder en menos de 100 ms con el dataset de volumen (500 órdenes, BOM de 4 niveles).

</details>

<details open>
<summary><strong>FR-10: Gestión de Mantenimiento y Disponibilidad de Máquinas (US-09 / HU-06)</strong></summary>

**US-09 (Encargado de Mantenimiento)**: Como Encargado de Mantenimiento, quiero atender los tickets de avería escalados desde piso en tiempo real, analizar el historial operativo de las máquinas y evaluar su desgaste para programar órdenes de mantenimiento preventivo y registrar los tiempos reales de parada técnica al cerrar cada intervención, para restablecer la disponibilidad operativa de los centros de trabajo.

**Por qué esta prioridad**: Es indispensable para desbloquear las máquinas que caen en estado de fallo (`fault`) y registrar los tiempos de parada que alimentan el OEE de planta.

- **Bandeja de tickets**: Listar los tickets de mantenimiento (`maintenance_tickets`) escalados desde piso con su prioridad (`urgent`, `high`, `normal`), estado (`open`, `in_progress`, `resolved`), centro de trabajo, evento de parada vinculado (`operation_delays`), quién lo reportó y su fecha de creación; ordenar por prioridad y antigüedad.
- **Toma de intervención**: Permitir asignar un técnico y pasar el ticket a `in_progress` registrando el inicio de la intervención; impedir dos intervenciones simultáneas sobre el mismo centro de trabajo.
- **Historial y desgaste**: Mostrar por máquina el historial de fallos e intervenciones, las paradas acumuladas y un indicador derivado de desgaste/frecuencia de fallos (no persistido) que sustente el mantenimiento preventivo.
- **Órdenes preventivas**: Permitir programar una orden de mantenimiento preventivo a partir del historial y del indicador de desgaste, con fecha objetivo y responsable; la orden preventiva es distinta de los tickets correctivos.
- **Registro de tiempos de parada**: Al cerrar la intervención, registrar el tiempo real de parada técnica (inicio, fin y duración en minutos) y la causa; estos tiempos alimentan el OEE y las paradas acumuladas de US-08.
- **Resolución y disponibilidad**: Al marcar el ticket como `resolved`, registrar fecha de resolución, notas y técnico, y restablecer la disponibilidad del centro de trabajo; el semáforo vuelve a *En operación* o *En pausa* según la operación activa y nunca permanece en `fault` sin un ticket abierto.
- **Integración con supervisión**: Consumir de forma reactiva los tickets generados por el escalamiento de US-07 sin duplicar registros; un ticket resuelto no se reabre, se crea uno nuevo vinculado al mismo evento o a uno nuevo.
- **Persistencia**: Conservar tickets, intervenciones, tiempos de parada y órdenes preventivas dentro del snapshot versionado en `localStorage` (`erp.manufacturing.v2`).
- **Ética de datos**: Los tiempos de intervención son contexto operativo de la máquina, no evaluación de desempeño del técnico; las vistas agregan por centro de trabajo y no generan rankings de personal.

</details>


<details open>
<summary><strong>FR-11: Planificación y Calendarización de Órdenes de Producción (US-10)</strong></summary>

**US-10 (Planificador):** Como Planificador de Producción, quiero consultar las órdenes de producción y asignar o modificar sus fechas planificadas de inicio y término, para organizar las actividades de fabricación y facilitar el cumplimiento de los plazos de entrega.

**Funcionalidades:**
- Consultar las órdenes de producción existentes.
- Visualizar información de cada orden, incluyendo producto, cantidad, prioridad y estado.
- Asignar fechas planificadas de inicio y término.
- Modificar las fechas planificadas cuando existan atrasos o cambios en la programación.
- Validar que la fecha de término no sea anterior a la fecha de inicio.
- Consultar las órdenes según su programación y estado.
- Conservar los cambios realizados en la programación dentro del snapshot `erp.manufacturing.v2`.

</details>

<details open>
<summary><strong>FR-12: Balance de líneas (US-11)</strong></summary>

**US-11**: Como Ingeniero de Producción, quiero consultar la utilización y la carga proyectada de cada centro de trabajo frente a su capacidad efectiva del período, para identificar cuellos críticos, balancear la línea de producción, maximizar la eficiencia global de la línea y evaluar cómo optimizar las rutas de trabajo, sin aplicar cambios reales desde esta vista.

- **Analizar los tiempos estándar**: Medir y determinar los tiempos teóricos de cada preparación para cada paso de la fabricación.
- **Clasificar la utilización**: Normal (< 75 %) en verde o saludable, con capacidad ociosa; Estación restrictiva / Ajustada (75 % a < 95 %) en ámbar, con mayor carga relativa sin sobrecarga; Cuello de botella / Sobrecarga (≥ 95 %) en rojo. No hay intervalo sin clasificar entre 94 % y 95 %.
- **Activar la alerta superior solo si existe al menos un centro con utilización ≥ 95 %**. Si ninguno alcanza ese umbral, la vista muestra exactamente “Línea balanceada · Sin cuellos de botella críticos”.
- **Identificar cuellos de botella**: entre centros críticos gana la mayor utilización, luego la mayor carga absoluta y finalmente el identificador; nunca se muestra un ranking de personas.
- **Proponer ajustes simulados**: solo se ofrecen cuando existe un cuello crítico. Las reasignaciones se permiten únicamente entre estaciones con el mismo `station_type`; la demo tiene 5 tipos y 6 estaciones físicas (Soldadura 1 y Soldadura 2). Ejemplo: “Reasignar 6.865 min de OP-3007 desde Estación de Soldadura 1 a Estación de Soldadura 2 · Sec. 20.”
- **Aceptar de forma simulada**: la propuesta requiere confirmación explícita y marca la fila como `Solicitud simulada`; no se registra en el store, no se persiste y no muta rutas, operaciones ni asignaciones.
- **Calcular y monitorear la capacidad del período**: Comparar la demanda planificada frente a la capacidad calculada como días hábiles del período × `capacity_per_day_minutes` × `efficiency_factor`. El factor de eficiencia también aplica aquí; la vista debe etiquetar la capacidad como efectiva del período.
- **Recomendar mejoras de eficiencia**: Identificar oportunidades para reducir tiempos muertos y maximizar la tasa de salida, sin modificar la asignación de recursos ni el personal desde esta vista.
- **Consultar órdenes por estación en un popover**: al activar una fila de “Carga por centro”, se abre una ventana compacta con las órdenes que consumen esa estación, la carga en el centro y el porcentaje de participación por orden. La sección independiente “Órdenes por centro” no forma parte de la vista.

</details>


<details open>
<summary><strong>FR-13: Acceso por rol, navegación y datos de demostración</strong></summary>

- Mostrar una pantalla de ingreso genérica con usuario y contraseña, sin exponer roles ni descripciones, y persistir el rol resuelto en `erp.manufacturing.role` (`src/data/fixtures/demo-accounts.js`). Cargar la página o cerrar sesión vuelve al ingreso. El menú de usuario superior ofrece además "Cambiar contraseña" para cualquier persona autenticada, según FR-14.
- Filtrar la navegación lateral y el panel "Acceso por rol" según la matriz `MODULE_ACCESS`; denegar módulos no permitidos aunque se acceda por URL. La navegación lateral ofrece un único acceso "Roles" (`#/roles`) y suprime el botón independiente "Datos de roles".
- Exponer las tarjetas de roles con nombre, descripción y acceso por rol, junto con la configuración administrativa, dentro de `#/roles` en dos subpestañas. La subpestaña "Configurar roles" está permitida únicamente para el rol activo Jefa de Planta, y el acceso directo `#/admin-roles` abre esa subpestaña dentro de Roles sin crear una vista lateral independiente.
- Sincronizar el módulo activo con el hash (`#/dashboard`, `#/plant`, etc.) para soportar enlaces profundos y el botón atrás del navegador.
- Usar datos simulados deterministas para la actividad reciente, identificados como datos de demostración y sin mutar el snapshot de manufactura. La navegación lateral es el único acceso directo a los módulos por rol.
- Aplicar etiqueta "Operador" de forma consistente en selector global, panel de planta, estación y supervisión.

</details>


<details open>
<summary><strong>FR-14: Sistema multi-rol, cinco tablas de usuarios y privacidad (US-12)</strong></summary>

**US-12**: Como Jefa de Planta, quiero administrar cinco roles canónicos con cuentas separadas y ver solo la información de personas autorizada, para que cada integrante acceda únicamente a las funciones y datos que le corresponden.

- **Roles canónicos**: incorporar el quinto rol Encargado de Mantenimiento (`maintenance`) junto a `plant_manager`, `supervisor`, `planner` y `operator`. La cuenta genérica "usuario" se elimina.
- **Cuentas demo**: `jefa/jefa`, `supervisor/supervisor`, `planificador/planificador`, `operador/operador` y `mantenimiento/mantenimiento`; además `test/test` inscrito en las cinco tablas y `doble/doble` inscrito en `operator` y `maintenance`. En todas ellas la contraseña es igual al nombre de usuario.
- **Cinco tablas de usuario**: `role_users_plant_manager`, `role_users_supervisor`, `role_users_planner`, `role_users_operator` y `role_users_maintenance`, persistidas en `erp.manufacturing.v2`; sobreviven al cierre de sesión y se restauran con `resetDemoData` (botón "Reiniciar datos de demo" de la Jefa de Planta).
- **Resolución de roles**: al iniciar sesión recorrer las cinco tablas y recolectar TODOS los roles donde aparece el usuario. El selector de rol del menú superior (`src/manufacturing-main.js`) muestra únicamente esos roles; con un solo rol asignado no se puede cambiar a otros. No existe ningún selector de rol duplicado dentro de otros paneles.
- **Administración de roles**: reemplazar la vista `#/admin-roles` (exclusiva de `plant_manager`) por `RoleAdminPanel.js`, con las cinco tablas visibles, alta de nuevos usuarios en un rol y asignación de roles adicionales a usuarios existentes, con persistencia inmediata en `erp.manufacturing.v2` y confirmación mediante `showToast`. Tras cerrar sesión y volver a ingresar, los roles nuevos aparecen en el menú superior y en `#/roles`.
- **Matriz de acceso (`MODULE_ACCESS`)**: quitar `orders` a `supervisor`; dejar a `operator` exactamente con `['operator', 'scheduling', 'roles']` y, dentro de `scheduling`, únicamente el Calendario Mensual sin la pestaña "Listado"; dejar a `maintenance` exactamente con `['maintenance', 'scheduling']`. Los identificadores de ruta existentes no cambian.
- **Privacidad**: los nombres reales de `hr_employees` solo son visibles para `supervisor` y `plant_manager`; los demás roles ven datos anonimizados o un conteo. En el calendario, el nombre del técnico a cargo de una mantención solo es visible para `plant_manager` y `maintenance`; los otros roles ven solo máquina y duración.
- **Unificación de la vista de roles**: sustituir el botón lateral "Datos de roles" por la única pestaña "Roles" (`#/roles`), organizada en dos subpestañas estilizadas "Roles" y "Configurar roles", coherentes con el sistema visual de las subpestañas de Mantenimiento.
- **Filtro por usuario autenticado**: la subpestaña "Roles", visible para todos los usuarios, muestra únicamente las tarjetas de los roles en los que aparece el usuario autenticado según las cinco tablas persistidas; nadie ve tarjetas de roles no asignados. La tarjeta del rol activo se distingue como vigente.
- **Cambio de rol confirmado**: al presionar una tarjeta de un rol distinto al activo, abrir `ConfirmDialog.js` con un mensaje del tipo "¿Deseas cambiar tu vista al rol <Nombre del rol>?" y aplicar el cambio solo tras la confirmación explícita; cancelar o cerrar el diálogo conserva el rol activo. Presionar la tarjeta activa no abre diálogo.
- **Administración integrada**: la subpestaña "Configurar roles" aparece solo cuando el rol activo es `plant_manager` e integra la funcionalidad de `RoleAdminPanel.js`: las cinco tablas por rol, alta de usuarios y asignación de roles adicionales, con persistencia inmediata en `erp.manufacturing.v2` y confirmación mediante `showToast`. El acceso por URL a `#/admin-roles` siendo `plant_manager` abre directamente esta subpestaña dentro de Roles.
- **Baja de usuarios por rol**: cada chip de usuario dentro de las cinco tablas de `RoleAdminPanel.js` incluye un botón "Quitar" (×). Al pulsarlo se abre `ConfirmDialog.js` para confirmar la baja; al confirmar se ejecuta `store.removeRoleUser(role, username)`, se persiste en `erp.manufacturing.v2` y se actualizan de inmediato la tabla, el selector de roles y la subpestaña "Roles". Si el usuario es el último miembro de `role_users_plant_manager`, la baja se rechaza con un mensaje explícito y no se muta ninguna tabla; cancelar o cerrar el diálogo tampoco muta el snapshot.
- **Contraseña inicial**: toda cuenta nueva creada desde "Configurar roles" mantiene la contraseña inicial igual al nombre de usuario, sin campo adicional obligatorio ni cambio respecto de las cuentas demo.
- **Cambio de contraseña**: "Cambiar contraseña" está disponible en el menú de usuario superior de `src/manufacturing-main.js` para cualquier usuario autenticado, sin depender del rol activo. Abre un modal centrado con tres campos: contraseña actual, nueva contraseña y confirmación de la nueva contraseña. El sistema valida que la contraseña actual coincida con la credencial vigente, que la nueva y su confirmación sean iguales y que la nueva no esté vacía; muestra errores inline y no muta el snapshot si alguna validación falla. Al confirmar, actualiza la contraseña del usuario en **todas** las tablas de rol donde figure, persiste el cambio en `erp.manufacturing.v2` y lo valida `authenticate` en el próximo ingreso, incluso tras logout o recarga. Si el usuario cambia su contraseña con un rol activo distinto, la credencial queda actualizada para el conjunto completo de roles asignados.

</details>


<details open>
<summary><strong>FR-15: Calendario Mensual Interactivo y Modo Selección de Horario (US-13)</strong></summary>

**US-13**: Como Planificador de Producción, quiero programar órdenes y revisar mantenciones en un calendario mensual con selección visual de horarios y vistas adaptadas a mi rol, para coordinar la producción sin ambigüedades.

- **Calendario mensual**: reestructurar `ProductionSchedulingPanel.js` con un Calendario Mensual en Vanilla JS + CSS Grid, sin librerías externas. Abre en el mes actual, recuerda en memoria de sesión el último mes visitado al cambiar de pestaña y vuelve al mes actual al cambiar de usuario/rol, cerrar sesión o recargar.
- **Filtro de eventos**: "Ambos" (predeterminado), "Solo Órdenes de Trabajo" y "Solo Mantenciones" (incluye tickets programados y órdenes preventivas).
- **Bandeja "Pendiente de horario"**: visible exclusivamente para `planner` y `plant_manager`, ordenada por prioridad/urgencia crítica y con porcentaje de avance. Solo `plant_manager` puede cambiar la prioridad y marcar órdenes pendientes como "Urgencia crítica" (`is_critical_urgent` / `priority urgent`). Se renderiza como una barra horizontal compacta (`.pending-tray`) **arriba** del calendario, dentro de un `.calendar-layout` de una sola columna vertical `minmax(0, 1fr)`, de modo que `.calendar-main` ocupe siempre el 100 % del ancho útil en los cinco roles (incluidos `maintenance`, `operator` y `supervisor`, que no ven la bandeja). Las celdas se dimensionan para que el mes completo resulte cómodo y proporcionado en pantalla estándar, sin compresión de títulos.
- **Modo Selección de Horario para `planner`**: un clic izquierdo en **cualquier parte** de la tarjeta `.pending-tray__row` activa el modo foco (hitbox completa, no solo el texto del código de la orden); en `plant_manager` los controles `select` y `checkbox` de la misma fila siguen funcionando sin interferir con el modo. Con el modo activo, `.scheduling-focus-backdrop` queda en `z-index: 40`, únicamente el bloque del calendario se eleva a `z-index: 50` con fondo blanco para permanecer totalmente iluminado, y `.scheduling-floating-card` sigue al cursor en `z-index: 60`. Las celdas `.calendar-day` declaran `draggable="false"` y `mousedown` ejecuta `preventDefault()`, con `user-select: none` en `.calendar-grid` mientras dure el modo, para impedir el arrastre fantasma nativo y la selección de texto. Al presionar `mousedown` en el día inicio y arrastrar sobre otros días, el rango completo se colorea de inmediato en tiempo real con `.calendar-day--drag-range`. Al soltar (`mouseup`) en **cualquier lugar del documento**, se desactiva el modo y se abre de inmediato el modal de horario centrado con horas predeterminadas "08:00" a "16:00", editables, conservando exactamente el rango completo seleccionado (por ejemplo, del 24 al 28) sin requerir ningún clic adicional. `contextmenu` ejecuta `preventDefault()` y cancela sin abrir el modal.
- **Ventanas emergentes centradas del calendario**: el menú diario (`calendar-day-menu`), el detalle de evento (`CalendarEventDialog.js`) y el popup de horario (`.schedule-popup`) se renderizan **siempre** como ventanas emergentes centradas sobre la pantalla, con `.modal-backdrop` en `z-index: 1000` y `.modal` en `z-index: 1001`, y se cierran mediante botón, tecla Escape y clic fuera. Se elimina cualquier renderizado incrustado debajo del calendario.
- **Menú diario por tarea**: para `planner`, `plant_manager` y `supervisor`, hacer clic en un día abre primero un menú con las órdenes de trabajo y mantenciones de ese día; al elegir una tarea se ocultan las demás y se muestra solo su detalle en `src/components/calendar/CalendarEventDialog.js`, con el botón "Volver a la lista del día".
- **Vistas y popups por rol**: solo `planner` y `plant_manager` pueden modificar fechas u horarios de órdenes. Para `supervisor` el bloqueo es total: sin inputs de fecha/hora, sin botones de guardar y eventos del calendario con `draggable="false"`. `plant_manager` ve indicadores compactos de color por día y un resumen ejecutivo con productos, meta de producción, máquinas activas/inactivas y cantidad de operadores. `supervisor` ve nombres reales con la etiqueta SC-08 "solo contexto operativo — no evaluación de desempeño" y una alerta de órdenes sin operador asignado; para mantenciones ve solo un resumen de lectura. `operator` ve únicamente sus órdenes asignadas y mantenciones en solo lectura.
- **Subpestañas de programación**: estilizar "Calendario" y "Listado" como pestañas integradas y coherentes con el sistema visual de las subpestañas de Mantenimiento, sin apariencia de botón HTML nativo; para `operator` continúa disponible únicamente "Calendario".
- **Cuadrícula mensual legible**: con la bandeja movida arriba y `.calendar-layout` en una sola columna, la cuadrícula ocupa el 100 % del ancho disponible con siete columnas proporcionadas (`grid-template-columns: repeat(7, minmax(0, 1fr))`), de modo que el título de cada evento se muestra legible y no queda reducido a íconos comprimidos en ninguno de los cinco roles.
- **Tope visual por día**: cada celda muestra como máximo los primeros tres eventos legibles y, cuando hay más actividades, un indicador compacto "+N más"; el menú del día muestra la totalidad de órdenes y mantenciones de esa fecha para su consulta completa.

</details>


<details open>
<summary><strong>FR-16: Estaciones Derivadas del BOM y Dotación en Supervisión (US-14)</strong></summary>

**US-14**: Como Supervisor de Operaciones/Línea, quiero ver y ajustar las máquinas y los trabajadores de cada orden a partir de la receta del producto, para asegurar que la ejecución siga la secuencia prevista sin duplicar esfuerzos.

- **Estación = máquina**: una estación equivale a un centro de trabajo (`work_center`), sin subdivisión por máquina individual. `deriveBomStations` en `src/domain/operation-planning.js` precarga automáticamente las estaciones/máquinas y su secuencia desde la receta/ruta del BOM de cada orden, conservando intacta la integración con `src/domain/capacity.js`.
- **Detalle diario de orden**: `CalendarEventDialog.js` muestra las estaciones/máquinas a usar con la etiqueta explícita "Secuencia <N>", con un `title` explicativo y sin duplicar la numeración visual "1., 2., 3." en la misma fila, junto a la cantidad de trabajadores asignados.
- **Edición de dotación**: el botón "Editar estaciones y trabajadores" aparece exclusivamente para `supervisor` y `plant_manager`. Al presionarlo se redirige a `#/supervision` y se abre automáticamente la edición de esa orden en `SupervisorLinePanel.js`, permitiendo añadir o quitar operadores y estaciones de trabajo con persistencia en `erp.manufacturing.v2`.
- **Límite de órdenes**: `ProductionOrders.js` (`#/orders`) sigue dedicado exclusivamente a crear y gestionar órdenes, conservando su buscador y filtro de prioridad actuales, sin controles de edición de estaciones/operadores.

</details>


<details open>
<summary><strong>FR-17: Panel de Mantenimiento en 3 Subpestañas e Inmutabilidad (US-15)</strong></summary>

**US-15**: Como Encargado de Mantenimiento, quiero gestionar máquinas, tickets y mantenciones en un solo panel sincronizado con el calendario, para programar intervenciones, registrar paradas reales y dejar constancia confiable de lo resuelto.

- **Estructura**: `MaintenancePanel.js` se organiza en tres subpestañas: "Máquinas", "Tickets" y "Mantenimientos". Se eliminan los tres filtros globales superiores (Estado, Prioridad y Centro, `.maintenance-filters` del header); el filtrado se realiza solo dentro de cada subpestaña.
- **Subpestaña Máquinas — vista consolidada**: se eliminan los paneles sueltos inferiores de Historial y Preventivas y el `fault-banner` duplicado. La subpestaña se presenta como dos paneles lado a lado: a la izquierda, la lista de máquinas (más ancha inicialmente) con buscador por nombre o código, filtro por sección, filtro por estado de máquina con opciones exactas "Todos", "Disponible", "En operación", "En mantención" y "Detenida / En fallo", junto a la alerta de frecuencia de mantención; a la derecha, el panel de detalle inicialmente vacío. La selección de una máquina encoge la lista y da protagonismo al detalle con una transición suave (proporción objetivo `0.85fr 1.15fr`). "Deseleccionar" (×) restaura la proporción inicial y el panel derecho vacío.
- **Subpestaña Máquinas — detalle de la máquina**: al seleccionar una máquina, el panel derecho muestra toda su información consolidada: badge de estado operativo ("Frenada por mantención" si está en `fault` o con mantención activa, o "Disponible"/"En operación"), campo editable "Cada cuánto se recomienda mantención" en días (solo `maintenance` y `plant_manager`), desgaste derivado de `deriveWearIndicator`, historial de fallas, paradas acumuladas, botón "Programar preventiva" (motivo y plazo inicial), botón "Revisar históricas" (cambia a "Mantenimientos", enfoca el histórico y prellena su buscador con el nombre de la máquina) y el botón explícito "Deseleccionar" (×).
- **Deselección por clic fuera**: además del botón "Deseleccionar", un clic fuera de los recuadros de "lista de máquinas" y "detalle de máquina" deselecciona la máquina, restaura los tamaños iniciales y deja el panel de detalle vacío. Se ignoran los clics que ocurren dentro de modales o diálogos abiertos y los de la navegación del mini-calendario (botones ‹ y ›), que no deben provocar la deselección.
- **Mini-calendario de máquina**: mientras haya una máquina seleccionada, se muestra debajo de ambos paneles un mini-calendario mensual matricial compacto y no interactivo. Su encabezado indica el mes y ofrece los botones ‹ y › como **única** interacción posible; los días se encabezan L, Ma, Mi, J, V, S, D y las celdas no son clickeables. La leyenda visible distingue cuatro estados: sin color (sin plan), rojo (detención por mantención correctiva o fallo), azul (uso planificado por orden de trabajo que pasa por esa máquina/estación) y morado (mantención preventiva planificada).
- **Subpestaña Tickets**: se eliminan los botones "Resolver" y "Tomar intervención" tanto de la tabla como del detalle. Queda únicamente la tabla con buscador, el detalle consolidado desplegable al hacer clic en un ticket (detalle del ticket, historial de fallas, historial completo de mantenciones preventivas y correctivas, e indicador `deriveWearIndicator` con nivel Bajo/Medio/Alto, conteo de fallas y minutos acumulados) y el botón "Programar mantención" como única acción de intervención: abre un modal para elegir técnico, fecha de inicio y plazo estimado (`scheduled_start_date`, `scheduled_end_date`), pasa el ticket a `in_progress` y la máquina a `fault`, y lo muestra de inmediato en el Calendario Mensual y en "Mantenimientos activos". No hay banner superior duplicado, panel lateral separado ni tabla de preventivas.
- **Subpestaña Mantenimientos**: sincronizada al 100 % con todas las mantenciones del calendario (tickets programados y preventivas) y unificada en **exactamente dos listas**, cada una con su buscador por nombre de máquina o código: (1) "Mantenimientos activos" agrupa todas las mantenciones aún no resueltas, vigentes y vencidas, incorpora el filtro "Todos", "Vigentes" y "Vencidos" y ofrece el botón "Resolver"; (2) "Mantenimientos históricos" lista las mantenciones resueltas con botón "Eliminar" confirmado mediante `ConfirmDialog.js`, que borra el registro de `erp.manufacturing.v2` y del calendario, y cuyo buscador se prellena automáticamente con el nombre de la máquina al entrar desde "Revisar históricas". No existe una tercera lista independiente para vencidas.
- **Cálculo automático de parada técnica**: al resolver un ticket correctivo se calcula automáticamente el tiempo real entre el inicio de la intervención y la fecha/hora de resolución, sin exigir ingreso manual. Las mantenciones preventivas nunca se resuelven automáticamente al vencer el plazo; solo al presionar "Resolver".
- **Fechas dinámicas**: si una mantención activa supera su plazo sin resolverse, su fecha final visible se extiende automáticamente hasta la fecha actual; si se resuelve antes del plazo, se acorta automáticamente a la fecha real de resolución.
- **Inmutabilidad y resolución en calendario**: una mantención resuelta no puede volverse a resolver ni editarse en ninguna vista; para corregir errores se elimina en Históricos y se vuelve a crear. En el calendario, `maintenance` es el único rol con acción "Resolver" y no tiene bandeja de programación manual: al seleccionar una mantención activa ve tiempo parado, técnico y prioridad; al presionar "Resolver" se abre el popup "¿Está seguro que quiere resolver esta mantención?" con un campo editable de fecha/hora prellenado con la fecha y hora ACTUAL del sistema al momento del clic (NO la fecha de la celda seleccionada). Si la mantención ya está resuelta, se abre en solo lectura sin botón "Resolver".

</details>


<details open>
<summary><strong>FR-18: Restricciones de conservación del estado actual de main</strong></summary>

- Conservar sin cambios las mejoras ya presentes: tipografía `@fontsource-variable/inter`, `icons.js`, `ConfirmDialog.js`, `Toast.js`, `labels.js`, `demo-dates.js`, `capacity.js`, el balance de líneas de US-11, el menú drawer, el botón "Reiniciar datos de demo" de Jefa de Planta y la configuración de `vitest.config.mjs`.
- Respetar los identificadores de ruta existentes: `orders`, `supervision`, `scheduling`, `maintenance`, `operator`, `plant`, `line-balance`, `bom`, `dashboard`, `roles`, `admin-roles`.
- No cambiar el nombre del paquete en `package.json`, no agregar dependencias externas y no incorporar elementos de `001-erp-base-module` en `index.html`.
- Las Fases 1 a 29 de `tasks.md` y las secciones 1 a 10 de `plan.md` se conservan sin modificación; la ampliación de US-12, US-13 y US-15 se documenta en esta especificación y sus criterios nuevos, sin reescribir fases previas ni el estado de mejoras ya integradas en `main`.

</details>


<details open>
<summary><strong>FR-19: Jerarquía de capas para ventanas emergentes (ajuste transversal)</strong></summary>

- Establecer una jerarquía estricta de superposición en `src/styles/manufacturing.css`: encabezados fijos de tabla (`thead th` con `position: sticky`) en `z-index: 1`; barra superior y barra lateral en el rango 20–30; modo foco del calendario en 40–60, con backdrop en 40, bloque del calendario en 50 con fondo blanco y tarjeta flotante en 60; backdrop de ventanas emergentes (`.modal-backdrop`) en `z-index: 1000` y ventana (`.modal`) en `z-index: 1001`, aplicables al menú diario, detalle de evento y popup de horario; `ConfirmDialog` en 1100; notificaciones/toasts en 1200.
- Garantizar que ningún encabezado sticky de tabla, barra lateral ni barra superior se superponga jamás sobre una ventana emergente, modal, diálogo de confirmación o notificación, incluso al desplazar tablas con muchas filas.
- Evitar que animaciones o transformaciones aplicadas a `.view`, `.content` o `.panel` creen contextos de apilamiento que encierren a los modales por debajo de las tablas; los modales y diálogos deben resolver su capa en el nivel raíz de la jerarquía.
- Conservar el comportamiento funcional de tablas, menú drawer, diálogos y notificaciones existentes; el ajuste es exclusivamente de orden visual de capas.

</details>


## 5. Criterios de Aceptación

| ID | Historia | Criterio | Estado |
|---|---|---|---|
| AC-01 | US-01 | Árbol BOM multi-nivel con ≥4 niveles y ciclo detectado | Implementado |
| AC-02 | US-02 | Ruta con secuencia estrictamente creciente y tiempo estándar calculado | Implementado |
| AC-03 | US-03 | Liberación congela BOM/ruta y genera operaciones; MTO/stock soportado | Implementado |
| AC-04 | US-08 | Tablero de carga por centro con OEE (Disponibilidad × Rendimiento × Calidad) y paradas acumuladas por período, derivados y no persistidos | Verificado |
| AC-05 | US-08 | Umbrales de alarma configurables, persistidos en el snapshot y evaluados de inmediato | Verificado |
| AC-06 | US-08 | Reprogramación de prioridad y cancelación con confirmación, conservando registros de ejecución | Verificado |
| AC-07 | US-08 | Exportación del reporte consolidado a PDF y Excel (sin dependencias externas) y permisos por rol simulados | Verificado |
| AC-08 | US-04 | Máquinas de estados validadas; rechazo de transiciones inversas | Implementado |
| AC-09 | US-04 | Ejecución con tiempos reales; avance automático del estado de orden | Implementado |
| AC-10 | US-05 | Consumo teórico vs. real con flags de discrepancia; uso no planificado permitido | Implementado |
| AC-11 | US-05 | Salida con merma, salidas parciales, inventario simulado actualizado | Implementado |
| AC-12 | Base | Panel con KPIs y utilización por centro de trabajo | Implementado |
| AC-13 | Base | Calidad derivada desde `quality_inspections` (solo lectura) | Implementado |
| AC-14 | Base | Pruebas unitarias del dominio y del store pasan; build exitoso | Verificado |
| AC-15 | US-06 | Inicio/fin de la operación activa con un único botón alterno y confirmación, tiempo real registrado y sin doble cierre | Verificado |
| AC-16 | US-06 | Atrasos justificados con motivos predefinidos o personalizados; tiempo efectivo pausado y cierre permitido con atraso abierto para corrección posterior | Verificado |
| AC-17 | US-06 | Dos contadores de piezas (turno y acumulado) incrementables, ajustables y validados; totales conservados al finalizar y recargar | Verificado |
| AC-18 | US-07 | Semáforo en vivo por línea/máquina (*En operación, En pausa, En fallo, Cambio de formato*) y registro de asignación de operador (`ext_hr_employee_id`) en `shift_assignments` | Verificado |
| AC-19 | US-07 | Aprobación de cierre de turno (`supervisor_validated = true`) tras verificar atrasos cerrados, y disparo de ticket urgente (`escalated_to_maint = true`) hacia `maintenance_tickets` pasando la máquina a *En fallo* | Verificado |
| AC-20 | US-08 | Carga por centro destacada sobre la capacidad efectiva y bloqueo de programación en centros desactivados | Verificado |
| AC-21 | US-09 | Bandeja de tickets escalados con prioridad, estado, centro y evento de parada vinculado, ordenada por prioridad y antigüedad | Verificado |
| AC-22 | US-09 | Toma de intervención con técnico asignado y bloqueo de dos intervenciones simultáneas sobre el mismo centro de trabajo | Verificado |
| AC-23 | US-09 | Historial por máquina con paradas acumuladas e indicador derivado de desgaste que sustenta la orden preventiva | Verificado |
| AC-24 | US-09 | Cierre de intervención con tiempo real de parada registrado y restablecimiento del semáforo fuera de *En fallo* | Verificado |
| AC-25 | US-09 | Ticket resuelto sin reapertura; nueva incidencia genera un ticket vinculado al evento correspondiente | Verificado |
| AC-26 | US-09 | Tickets, intervenciones, tiempos de parada y órdenes preventivas conservados en el snapshot tras recargar | Verificado |
| AC-27 | US-09 | Tiempos de mantenimiento agregados por centro, sin rankings ni evaluación de desempeño de técnicos | Verificado |
| AC-28 | US-10 | El sistema permite consultar las órdenes de producción existentes y visualizar sus datos principales | Verificado |
| AC-29 | US-10 | El planificador puede asignar fechas planificadas de inicio y término a una orden de producción | Verificado |
| AC-30 | US-10 | El planificador puede modificar las fechas planificadas de una orden existente | Verificado |
| AC-31 | US-10 | El sistema impide asignar una fecha de término anterior a la fecha de inicio | Verificado |
| AC-32 | US-10 | El sistema permite visualizar las órdenes según sus fechas planificadas y estados | Verificado |
| AC-33 | US-10 | Las fechas asignadas y sus modificaciones permanecen guardadas al volver a abrir el sistema | Verificado |
| AC-34 | FR-13 | El selector global filtra navegación y módulos por rol, incluido Supervisor, con denegación por URL | Verificado |
| AC-35 | FR-13 | El hash mantiene el módulo activo y responde a enlaces profundos y navegación atrás | Verificado |
| AC-36 | FR-13 | El panel inicial muestra actividad simulada y la etiqueta Operador de forma consistente, sin sección de accesos rápidos | Verificado |
| AC-37 | US-11 | El panel muestra tiempos estándar por operación y totales por ruta (`setup + run × cantidad`) sin mutar rutas ni operaciones | Verificado |
| AC-39 | US-11 | La carga y la utilización se calculan para el período contra días hábiles × `capacity_per_day_minutes` × `efficiency_factor`; el estado es Normal (< 75 %) en verde, Ajustada (75 % a < 95 %) en ámbar o Cuello crítico (≥ 95 %) en rojo. La alerta superior se activa solo si algún centro alcanza el 95 %; si no, se muestra “Línea balanceada · Sin cuellos de botella críticos”. El cuello se desempata por mayor utilización, mayor carga y luego identificador | Verificado |
| AC-40 | US-11 | Solo con cuello crítico se muestran propuestas de reasignación entre estaciones del mismo `station_type` o de revisión de secuencia; la aceptación explícita marca la fila como `Solicitud simulada`, sin registro en store, persistencia ni mutación de rutas, operaciones o asignaciones | Verificado |
| AC-41 | FR-13 | El ingreso es genérico, valida credenciales simuladas y los datos de roles solo son visibles para la Jefa de Planta en `#/admin/roles` | Verificado |
| AC-42 | FR-03 | El tablero permite arrastrar órdenes solo a estados siguientes válidos, sin mutar ante saltos inválidos | Verificado |
| AC-43 | FR-07 | El acumulado de Estación se rechaza cuando supera la cantidad planificada, sin mutar turno ni operación | Verificado |
| AC-44 | FR-01 a FR-13 | Los campos numéricos aceptan punto o coma decimal y hasta dos decimales, sin flechas de precisión y con errores inline para valores inválidos | Verificado |
| AC-45 | US-11 | Al activar una fila de “Carga por centro” se abre un popover compacto centrado sobre esa sección, sin salirse del viewport, con las órdenes de la estación, la carga en el centro y la participación por orden; se cierra con botón, Escape, clic fuera o nueva activación, y no existe la sección “Órdenes por centro” | Verificado |
| AC-46 | FR-06 / US-11 | En “Utilización por Centro de Trabajo” del Panel de Producción, activar un centro abre una ventana con sus operaciones pendientes, orden, secuencia, estado y minutos; en “Carga por centro” los días hábiles van entre paréntesis en el título del período y la columna “Utilización del día” repite el valor diario del panel, sin columna de días | Verificado |

| AC-47 | US-12 | Cinco roles canónicos (`plant_manager`, `supervisor`, `planner`, `operator`, `maintenance`) sin cuenta genérica "usuario"; credenciales demo jefa/jefa, supervisor/supervisor, planificador/planificador, operador/operador y mantenimiento/mantenimiento, más test/test en las cinco tablas y doble/doble en operator y maintenance, con contraseña igual al usuario | Pendiente |
| AC-48 | US-12 | Las tablas `role_users_plant_manager`, `role_users_supervisor`, `role_users_planner`, `role_users_operator` y `role_users_maintenance` persisten en `erp.manufacturing.v2`, sobreviven al logout y se restauran con `resetDemoData` | Pendiente |
| AC-49 | US-12 | El ingreso recorre las cinco tablas y recolecta todos los roles del usuario; el selector del menú superior ofrece solo esos roles, sin cambio posible con un único rol y sin selectores duplicados en otros paneles | Pendiente |
| AC-50 | US-12 | `#/admin-roles`, exclusivo de `plant_manager`, muestra `RoleAdminPanel.js` con las cinco tablas; agregar usuarios o roles adicionales persiste de inmediato, notifica con `showToast` y, tras logout/login, aparece en el menú superior y en `#/roles` | Pendiente |
| AC-51 | US-12 | `MODULE_ACCESS` quita `orders` a supervisor; operator queda exactamente con `['operator', 'scheduling', 'roles']` y en scheduling solo ve el Calendario Mensual sin pestaña "Listado"; maintenance queda exactamente con `['maintenance', 'scheduling']`; los IDs de ruta no cambian | Pendiente |
| AC-52 | US-12 | Nombres reales de `hr_employees` solo para supervisor y plant_manager (anonimizados o conteo para el resto); el técnico de una mantención en el calendario solo se nombra para plant_manager y maintenance, otros roles ven máquina y duración | Pendiente |
| AC-53 | US-13 | Calendario Mensual en Vanilla JS + CSS Grid sin librerías externas; abre en el mes actual, recuerda el último mes entre cambios de pestaña y vuelve al mes actual al cambiar de usuario/rol, cerrar sesión o recargar | Pendiente |
| AC-54 | US-13 | Filtro "Ambos" por defecto, "Solo Órdenes de Trabajo" y "Solo Mantenciones", incluyendo tickets programados y órdenes preventivas | Pendiente |
| AC-55 | US-13 | Bandeja "Pendiente de horario" solo para planner y plant_manager, ordenada por prioridad/urgencia crítica con % de avance; solo plant_manager cambia prioridad y marca "Urgencia crítica" (`is_critical_urgent` / `priority urgent`) | Pendiente |
| AC-56 | US-13 | En planner, un clic izquierdo simple en una orden pendiente activa el modo foco con `.scheduling-focus-backdrop`, `.scheduling-floating-card` siguiendo al cursor y aviso bajo la cuadrícula de que clic derecho sale del modo | Pendiente |
| AC-57 | US-13 | `mousedown` en un día y arrastre con `mouseenter`/`mouseover` colorea en vivo las celdas `.calendar-day--drag-range`; `mouseup` cierra el modo y abre el popup con "08:00" a "16:00" editables; `contextmenu` llama `preventDefault()` y cancela sin popup | Pendiente |
| AC-58 | US-13 | Para planner, plant_manager y supervisor, clic en un día abre un menú de órdenes y mantenciones; elegir una tarea oculta las demás y muestra solo su detalle en `CalendarEventDialog.js` con "Volver a la lista del día" | Pendiente |
| AC-59 | US-13 | Solo planner y plant_manager modifican fechas/horarios de órdenes; supervisor no tiene inputs de fecha/hora ni botones de guardar y sus eventos tienen `draggable="false"` | Pendiente |
| AC-60 | US-13 | Plant_manager ve indicadores compactos de color por día y resumen ejecutivo de productos, meta de producción, máquinas activas/inactivas y cantidad de operadores | Pendiente |
| AC-61 | US-13 | Supervisor ve nombres reales con la etiqueta SC-08 "solo contexto operativo — no evaluación de desempeño", alerta de órdenes sin operador asignado y mantenciones como resumen de solo lectura | Pendiente |
| AC-62 | US-13 | Operator ve únicamente sus órdenes asignadas y las mantenciones en solo lectura | Pendiente |
| AC-63 | US-14 | Estación = máquina (`work_center`) sin subdivisión; `deriveBomStations` precarga estaciones y secuencia desde la receta/ruta del BOM de cada orden, conservando la integración con `capacity.js` | Pendiente |
| AC-64 | US-14 | El detalle diario de orden muestra estaciones con etiqueta "Secuencia <N>", título explicativo, sin doble numeración "1., 2., 3." en la misma fila, junto a la cantidad de trabajadores asignados | Pendiente |
| AC-65 | US-14 | "Editar estaciones y trabajadores" solo para supervisor y plant_manager; redirige a `#/supervision`, abre la edición de esa orden en `SupervisorLinePanel.js` y persiste altas/bajas de operadores y estaciones en `erp.manufacturing.v2` | Pendiente |
| AC-66 | US-14 | `#/orders` sigue dedicado a crear y gestionar órdenes, conserva buscador y filtro de prioridad y no contiene controles de estaciones/operadores | Pendiente |
| AC-67 | US-15 | `MaintenancePanel.js` muestra exactamente las subpestañas "Máquinas", "Tickets" y "Mantenimientos" | Pendiente |
| AC-68 | US-15 | En Máquinas: buscador por nombre, filtro por sección, alerta superior de máquinas sin preventiva o con frecuencia superada, campo "Cada cuánto se recomienda mantención" editable solo por maintenance y plant_manager, badge "Frenada por mantención"/"Disponible"/"En operación", historial de fallas, paradas acumuladas, `deriveWearIndicator`, "Programar preventiva" y "Revisar históricas" que enfoca el histórico y prellena su buscador con la máquina elegida | Pendiente |
| AC-69 | US-15 | En Tickets solo aparece la tabla de tickets, sin banner duplicado, panel lateral ni tabla de preventivas; "Programar mantención" abre un modal de técnico, inicio y plazo (`scheduled_start_date`/`scheduled_end_date`), pasa ticket a `in_progress` y máquina a `fault`, y aparece de inmediato en el calendario y en "Mantenimientos activos" | Pendiente |
| AC-70 | US-15 | Al hacer clic en un ticket se despliega debajo un recuadro con detalle del ticket, historial de fallas, historial completo de mantenciones e indicador `deriveWearIndicator` con nivel Bajo/Medio/Alto, conteo de fallas y minutos acumulados | Pendiente |
| AC-71 | US-15 | Mantenimientos refleja el 100 % de las mantenciones del calendario en tres bloques con buscador propio por máquina o código: activos (Resolver), no resueltos por vencimiento (Resolver) e históricos (Eliminar confirmado con `ConfirmDialog.js`, borrando registro de `erp.manufacturing.v2` y del calendario) | Pendiente |
| AC-72 | US-15 | Resolver una correctiva calcula automáticamente la parada real entre inicio de intervención y resolución sin ingreso manual; una preventiva nunca se resuelve sola al vencer el plazo, solo con "Resolver" | Pendiente |
| AC-73 | US-15 | Una mantención activa vencida extiende su fecha final visible hasta hoy; si se resuelve antes del plazo, la fecha final se acorta a la resolución real | Pendiente |
| AC-74 | US-15 | Una mantención resuelta no se puede resolver ni editar en ninguna vista; la corrección exige eliminarla en Históricos y crearla de nuevo | Pendiente |
| AC-75 | US-15 | En el calendario solo maintenance tiene "Resolver" (sin bandeja manual); al seleccionar una activa ve tiempo parado, técnico y prioridad; el popup "¿Está seguro que quiere resolver esta mantención?" trae fecha/hora editable prellenada con la hora ACTUAL del sistema al hacer clic, no la de la celda; una resuelta se abre en solo lectura sin el botón | Pendiente |
| AC-76 | FR-18 | Permanecen intactas las mejoras de main (tipografía `@fontsource-variable/inter`, `icons.js`, `ConfirmDialog.js`, `Toast.js`, `labels.js`, `demo-dates.js`, `capacity.js`, US-11, menú drawer, "Reiniciar datos de demo" y `vitest.config.mjs`), los IDs de ruta existentes, el nombre del paquete, la ausencia de dependencias externas nuevas y la ausencia de elementos de `001-erp-base-module` en `index.html` | Pendiente |
| AC-77 | FR-19 | La escala de capas es estricta: encabezados sticky de tabla en `z-index: 1`, barra superior/lateral en 20–30, modo foco del calendario en 40–60, backdrop y modales normales en 1000–1001, `ConfirmDialog` en 1100 y toasts en 1200 | Pendiente |
| AC-78 | FR-19 | Ningún encabezado fijo de tabla, barra lateral ni barra superior se superpone sobre modales, popups, diálogos de confirmación ni toasts, y ninguna animación/transformación de `.view`, `.content` o `.panel` deja un modal por debajo de una tabla | Pendiente |
| AC-79 | US-13 | "Calendario" y "Listado" se presentan como pestañas integradas del mismo sistema visual que las subpestañas de Mantenimiento, sin apariencia de botón nativo; `operator` solo ve "Calendario" | Pendiente |
| AC-80 | US-13 | La cuadrícula mensual ocupa el 100 % del ancho disponible con siete columnas proporcionadas (`repeat(7, minmax(0, 1fr))`) y muestra el título legible de cada evento en lugar de íconos comprimidos | Pendiente |
| AC-81 | US-13 | Cada día muestra como máximo tres eventos legibles y un indicador compacto "+N más" cuando hay más actividades; el menú del día enumera todas las órdenes y mantenciones de esa fecha | Pendiente |
| AC-82 | FR-13 | El menú lateral no contiene el botón independiente "Datos de roles" y expone únicamente "Roles" (`#/roles`) | Pendiente |
| AC-83 | US-12 | `#/roles` muestra dos subpestañas estilizadas, "Roles" y "Configurar roles", coherentes con el sistema visual de las subpestañas de Mantenimiento | Pendiente |
| AC-84 | US-12 | La subpestaña "Roles", visible para todos los usuarios, muestra únicamente las tarjetas de los roles asignados al usuario autenticado según las cinco tablas persistidas, sin mostrar roles no asignados | Pendiente |
| AC-85 | US-12 | Al presionar una tarjeta de un rol distinto al activo se abre `ConfirmDialog.js` con "¿Deseas cambiar tu vista al rol <Nombre del rol>?" y el rol activo cambia solo tras confirmación; al presionar la tarjeta activa no se abre diálogo | Pendiente |
| AC-86 | US-12 | La subpestaña "Configurar roles" solo está disponible con el rol activo `plant_manager` e integra las cinco tablas por rol, el alta de usuarios y la asignación de roles con persistencia inmediata en `erp.manufacturing.v2` y `showToast`; otros roles no pueden acceder | Pendiente |
| AC-87 | FR-13 / US-12 | Al abrir `#/admin-roles` con el rol activo `plant_manager`, se muestra directamente la subpestaña "Configurar roles" dentro de `#/roles` | Pendiente |
| AC-88 | US-12 | Cada chip de usuario de las cinco tablas de "Configurar roles" incluye "Quitar" (×); tras confirmar con `ConfirmDialog.js` se ejecuta `store.removeRoleUser(role, username)`, se persiste en `erp.manufacturing.v2` y se actualizan tabla, selector de roles y subpestaña "Roles"; cancelar no muta nada y quitar al último `plant_manager` se rechaza con mensaje | Pendiente |
| AC-89 | US-12 | Las cuentas nuevas creadas desde "Configurar roles" conservan la contraseña inicial igual al nombre de usuario | Pendiente |
| AC-90 | US-12 | "Cambiar contraseña" está disponible para cualquier usuario autenticado en el menú superior; el modal solicita contraseña actual, nueva y confirmación, valida la actual y la coincidencia, actualiza la credencial en todas las tablas de rol donde figure el usuario, persiste en `erp.manufacturing.v2` y es aceptada por `authenticate` tras logout y recarga | Pendiente |
| AC-91 | US-13 | La bandeja "Pendiente de horario" es una barra horizontal compacta arriba del calendario, `.calendar-layout` usa una sola columna `minmax(0, 1fr)` y `.calendar-main` ocupa el 100 % del ancho útil en los cinco roles, con celdas cómodas y proporcionadas en pantalla estándar | Pendiente |
| AC-92 | US-13 | Menú diario, detalle de evento y popup de horario se muestran siempre como ventanas centradas sobre la pantalla con `.modal-backdrop` en 1000 y `.modal` en 1001, sin renderizado incrustado bajo el calendario, y se cierran con botón, Escape y clic fuera | Pendiente |
| AC-93 | US-13 | En planner, un clic izquierdo en cualquier zona de `.pending-tray__row` activa el modo selección, mientras que en plant_manager los `select` y `checkbox` de la fila siguen operando sin interferencias | Pendiente |
| AC-94 | US-13 | Con el modo selección activo, `.scheduling-focus-backdrop` está en 40, solo el bloque del calendario se eleva a 50 con fondo blanco y permanece iluminado, y `.scheduling-floating-card` se sitúa en 60 | Pendiente |
| AC-95 | US-13 | Las celdas `.calendar-day` tienen `draggable="false"`, `mousedown` llama `preventDefault()` y `.calendar-grid` aplica `user-select: none` en el modo selección; al arrastrar desde el día inicio se colorea el rango completo en tiempo real y al soltar en cualquier lugar del documento se desactiva el modo y se abre de inmediato el modal centrado con el rango exacto (por ejemplo 24–28) y horas "08:00"–"16:00" editables, sin clics adicionales | Pendiente |
| AC-96 | US-15 | No existen los filtros globales superiores Estado, Prioridad y Centro (`.maintenance-filters` del header) en MaintenancePanel.js | Pendiente |
| AC-97 | US-15 | La subpestaña Máquinas muestra dos paneles lado a lado sin paneles inferiores sueltos ni `fault-banner` duplicado: lista izquierda más ancha al inicio con buscador por nombre/código, filtro por sección y filtro por estado ("Todos", "Disponible", "En operación", "En mantención", "Detenida / En fallo") junto a la alerta de frecuencia, y panel derecho inicialmente vacío; al seleccionar se transiciona suavemente a `0.85fr 1.15fr` | Pendiente |
| AC-98 | US-15 | El detalle de la máquina seleccionada consolida estado operativo, campo editable "Cada cuánto se recomienda mantención", desgaste (`deriveWearIndicator`), historial de fallas, "Programar preventiva", "Revisar históricas" y "Deseleccionar" (×) | Pendiente |
| AC-99 | US-15 | "Deseleccionar" y un clic fuera de los recuadros de lista y detalle deseleccionan la máquina, restauran los tamaños iniciales y vacían el panel derecho; los clics en modales y en la navegación ‹ › del mini-calendario no deseleccionan | Pendiente |
| AC-100 | US-15 | Con una máquina seleccionada aparece debajo de ambos paneles un mini-calendario mensual matricial compacto con encabezado de mes, botones ‹ › como única interacción, días L, Ma, Mi, J, V, S, D, celdas no clickeables y leyenda visible de sin plan (sin color), correctiva/fallo (rojo), orden de trabajo que pasa por la máquina/estación (azul) y preventiva planificada (morado) | Pendiente |
| AC-101 | US-15 | En Tickets no aparecen "Resolver" ni "Tomar intervención" en la tabla ni en el detalle; solo quedan la tabla con buscador, el detalle consolidado desplegable al hacer clic en un ticket y "Programar mantención" para pasar la intervención al calendario y a Mantenimientos activos | Pendiente |
| AC-102 | US-15 | Mantenimientos tiene exactamente dos listas con buscador propio: "Mantenimientos activos" reúne vigentes y vencidas con filtro "Todos"/"Vigentes"/"Vencidos" y botón "Resolver", y "Mantenimientos históricos" lista las resueltas con "Eliminar" confirmado por `ConfirmDialog.js` y buscador prellenado con el nombre de la máquina al llegar desde "Revisar históricas" | Pendiente |
| AC-103 | FR-18 | Las Fases 1 a 29 de `tasks.md`, las secciones 1 a 10 de `plan.md` y las mejoras presentes en `main` permanecen intactas tras la ampliación de US-12, US-13 y US-15 | Pendiente |

> **Nota de numeración**: los IDs AC son anclas históricas estables; no se renombran al añadir historias. La columna "Historia" disambigúa los rangos: AC-04..AC-07 y AC-20 pertenecen a US-08, AC-08..AC-14 a la base US-01..US-05/FR-06, y AC-37, AC-39, AC-40 y AC-45 a US-11; AC-46 cubre la utilización diaria compartida entre FR-06 y US-11. AC-38 fue retirado y su cobertura de carga/utilización se integró en AC-39. No existen IDs duplicados ni un mismo criterio asignado a dos historias.
>
> **Rangos añadidos**: AC-47..AC-52 corresponden a US-12, AC-53..AC-62 a US-13, AC-63..AC-66 a US-14, AC-67..AC-75 a US-15 y AC-76 a FR-18. La ampliación de interfaz y navegación incorpora AC-77..AC-78 (FR-19), AC-79..AC-81 (US-13) y AC-82..AC-87 (FR-13 / US-12). La ampliación de 2026-11-23 incorpora AC-88..AC-90 (US-12), AC-91..AC-95 (US-13), AC-96..AC-102 (US-15) y AC-103 (FR-18). AC-01..AC-87 se mantienen textualmente intactos.
>
> **Supersedencia de navegación**: la entrada lateral "Datos de roles" y la vista independiente `#/admin-roles` descritas en FR-13 y AC-41 quedan sustituidas en navegación por AC-82, AC-86 y AC-87; la restricción de acceso exclusivo a Jefa de Planta se conserva y se refuerza con AC-86.
>
> **Supersedencia de la ampliación**: AC-88..AC-90 precisan la administración de cuentas de AC-50 y AC-86; AC-91..AC-95 refinan la distribución y el modo selección de AC-56, AC-57, AC-77, AC-80 y AC-81; AC-92 sustituye cualquier renderizado incrustado de ventanas del calendario; AC-96..AC-102 sustituyen los filtros globales, la vista de tres bloques de AC-71 (y la referencia a "tres bloques" de SC-11, que se interpreta como las dos listas de AC-102) y las acciones de tickets descritas en AC-69/AC-70, conservando la sincronización con el calendario y la inmutabilidad de AC-72..AC-75. AC-103 garantiza que ninguna de estas precisiones altera las Fases 1 a 29 ni las mejoras de `main`.

## 6. Entidades Clave

- **BillOfMaterials / BomComponent**: estructura multi-nivel que define el consumo teórico por unidad.
- **WorkCenter / Routing / RoutingOperation**: capacidad, secuencia y tiempos estándar de fabricación.
- **ProductionOrder / ProductionOrderOperation**: trabajo planificado, liberado y ejecutado, con tiempos y cantidades reales.
- **ProductionShift / OperationDelay / DelayReason**: turno del operador, atrasos justificados y catálogo reutilizable de motivos.
- **ShiftAssignment**: vínculo entre un operador de RR.HH. (`ext_hr_employee_id`) y un centro de trabajo por franja de turno.
- **MaintenanceTicket**: ticket correctivo escalado desde piso, con prioridad, estado, centro, evento de parada, técnico y tiempos de intervención.
- **PreventiveMaintenanceOrder**: orden de mantenimiento preventivo programada a partir del historial y del desgaste de la máquina.
- **Umbral de indicador (ThresholdSetting)**: valor crítico configurable por indicador de planta, persistido en el snapshot.
- **RoleUser (cinco tablas por rol)**: pertenencia de usuarios a `plant_manager`, `supervisor`, `planner`, `operator` y `maintenance`; un usuario puede pertenecer a varias tablas y cada alta se persiste de inmediato.
- **CalendarEvent / CalendarSelectionState**: órdenes y mantenciones visibles por mes con filtro de tipo, mes visitado en memoria de sesión y rango de días seleccionado por arrastre con horario de inicio/fin editable.
- **BomStation**: estación derivada de la máquina (`work_center`) y su número de secuencia, obtenida de la receta/ruta del BOM; no subdivide una máquina y se complementa con la dotación de operadores de la orden.
- **MaintenanceSchedule**: fechas de inicio y plazo estimado de tickets programados y preventivas, con fecha final visible dinámica (extendida a hoy si vence o acortada a la resolución real) y marca de inmutabilidad una vez resuelta.
- **Capa de superposición (OverlayLayer)**: orden de presentación de tablas, barras, modo foco, modales, confirmaciones y notificaciones, con reglas que impiden que un contenedor de vista atrape un modal por debajo de una tabla.
- **Celda de calendario (CalendarDayCell)**: día del mes con sus eventos, tope visual de tres entradas legibles y contador de actividades adicionales resueltas en el menú del día.
- **Estado de acceso por rol (RoleAccessViewState)**: subpestaña activa de `#/roles`, roles asignados filtrados para el usuario autenticado y rol activo pendiente de confirmación.
- **Credencial de usuario (UserCredential)**: contraseña inicial igual al nombre de usuario, contraseña vigente susceptible de cambio desde el menú superior y validación durante `authenticate`, compartida por todas las tablas de rol donde aparece el usuario.
- **Ventana emergente del calendario (CalendarOverlay)**: menú del día, detalle de evento y popup de horario presentados como ventanas centradas, con capas de fondo y contenido, cierre por botón/Escape/clic fuera y sin renderizado incrustado.
- **Gesto de selección de horario (ScheduleSelectionGesture)**: estado transitorio del modo foco con hitbox de tarjeta, rango de días resaltado en vivo, bloque de calendario iluminado y rango exacto transferido al modal al soltar el puntero.
- **Vista de máquina (MachineDetailViewState)**: máquina seleccionada, panel izquierdo/derecho con proporciones dinámicas, deselección por botón o clic fuera y mini-calendario mensual asociado con leyenda de colores.
- **Lista de mantenciones (MaintenanceLifecycleList)**: agrupación en activas (vigentes y vencidas, con filtro de vigencia) e históricas (resueltas, con baja confirmada), cada una con su propio buscador.

## 7. Métricas de Éxito

- **SC-01**: La Jefa de Planta obtiene la visión consolidada de carga, OEE, paradas y cumplimiento del período en menos de 1 minuto y sin salir del panel.
- **SC-02**: El 100% de los centros con carga superior a su capacidad efectiva se resaltan y las alarmas por umbral se muestran al abrir el panel. Este resaltado pertenece a US-08; la alerta superior de US-11 usa regla propia de ≥ 95 % descrita en AC-39.
- **SC-03**: El reporte consolidado se exporta en PDF y Excel con los datos del período seleccionado en menos de 10 segundos.
- **SC-04**: Un Encargado de Mantenimiento identifica y toma el ticket urgente más antiguo en menos de 30 segundos desde que fue escalado.
- **SC-05**: El 100% de las intervenciones cerradas registran su tiempo real de parada y dejan la máquina disponible (fuera de *En fallo*).
- **SC-06**: Tras recargar la página se conserva el 100% de tickets, intervenciones, umbrales y órdenes preventivas.
- **SC-07**: Las interacciones de los paneles responden en menos de 100 ms con 500 órdenes y BOM de 4 niveles.
- **SC-08**: El 0% de las vistas expone rankings individuales; todo detalle por persona se etiqueta como contexto operativo.
- **SC-09**: El 100% de los roles asignados a un usuario aparece en el menú superior y en `#/roles` tras cerrar sesión y volver a ingresar, sin opciones de rol no asignadas.
- **SC-10**: El planificador selecciona un rango y guarda el horario de una orden en menos de 1 minuto, con horas predeterminadas editables y cancelación inmediata con clic derecho.
- **SC-11**: El 100% de las mantenciones visible en el calendario coincide con los tres bloques del panel de mantenimiento, y el 100% de las resoluciones registra parada real sin ingreso manual.
- **SC-12**: El 0% de las vistas de roles no autorizados revela nombres reales de RR.HH. o de técnicos de mantención; los datos sensibles aparecen anonimizados o como conteo.
- **SC-13**: El 100 % de las ventanas emergentes, diálogos de confirmación y notificaciones permanece totalmente visible sobre tablas, barras y encabezados fijos en cualquier estado de desplazamiento o animación.
- **SC-14**: El 100 % de los días del calendario muestra títulos de eventos legibles en una cuadrícula de ancho completo, con no más de tres eventos visibles y un indicador exacto de las actividades restantes, disponibles íntegramente en el menú del día.
- **SC-15**: El 100 % de los usuarios ve únicamente las tarjetas de sus roles asignados, todo cambio de rol requiere confirmación previa y solo el rol activo Jefa de Planta puede acceder a la configuración de roles, incluido el enlace directo.
- **SC-16**: El 100 % de las bajas de usuario se aplican solo tras confirmación, se reflejan después de logout y recarga, y ninguna operación deja la tabla de Jefa de Planta sin administradores; el 100 % de las cuentas nuevas mantiene la contraseña igual al nombre de usuario.
- **SC-17**: El 100 % de los cambios de contraseña realizados desde el menú superior se valida y persiste para todos los roles del usuario, y el ingreso con la nueva contraseña funciona en la primera tentativa tras cerrar sesión o recargar; el 0 % de los cambios con datos inválidos modifica cuentas.
- **SC-18**: En los cinco roles, el 100 % del ancho útil se destina al calendario mensual con la bandeja como barra horizontal superior, y el 100 % de los meses se visualiza completo sin títulos comprimidos en pantalla estándar.
- **SC-19**: El 100 % de los menús diarios, detalles de evento y popups de horario se abre centrado y se cierra por las tres vías previstas, y el 100 % de los arrastres conserva el rango exacto seleccionado al abrir el modal sin clics adicionales.
- **SC-20**: El 100 % de la subpestaña Máquinas usa dos paneles con los filtros y el mini-calendario especificados, y el 100 % de Mantenimientos usar exactamente dos listas, sin botones de intervención obsoletos en Tickets ni filtros globales residuales.

## 8. Supuestos y Dependencias

- El snapshot local se mantiene versionado con `erp.manufacturing.v2` como versión vigente desde US-08; `erp.manufacturing.v1` se migra automáticamente. Cualquier cambio de forma incrementa la versión y se valida al hidratar.
- `maintenance_tickets`, las órdenes preventivas, `threshold_settings` y `role_permissions` se modelan como entidades locales del módulo y ya están descritas en `data-model.md` §3.19–3.22.
- Los roles simulados con selector son Jefa de Planta, Supervisor de Operaciones/Línea, Planificador, Operador y Encargado de Mantenimiento; no existe autenticación real. Un usuario puede tener varios roles y la etiqueta visible canónica es "Operador" en toda la interfaz.
- La exportación a PDF y Excel se genera localmente con los datos mock, sin backend ni servicios externos.
- Los catálogos de RR.HH., calidad y ventas son datos simulados de solo lectura.
- Los tiempos de turno y de parada se derivan de marcas de tiempo persistidas, no de temporizadores en memoria.
- El OEE, la carga, la utilización, el cuello de botella y el indicador de desgaste son valores derivados y no se persisten.
- `efficiency_factor` se aplica a la capacidad efectiva: `domain/capacity.js` deriva la tasa diaria (`capacity_per_day_minutes × efficiency_factor`) y la escala a días hábiles para el panel de planta (US-08) y el balance de líneas (US-11); el Panel de Producción (US-06) muestra esa tasa de un solo día. Cada panel conserva su propia definición de carga (pendiente, observada o proyectada) y `null` significa "sin capacidad válida".
- Las cinco tablas de usuario forman parte del mismo snapshot `erp.manufacturing.v2`; el botón "Reiniciar datos de demo" de Jefa de Planta restaura tanto las cuentas como sus asignaciones de roles.
- El calendario y el panel de mantenimiento comparten una única fuente de mantenciones; programar, resolver o eliminar en una vista se refleja en la otra sin duplicar registros.
- El mes visitado solo se conserva entre pestañas del panel de programación; cualquier cambio de identidad, cierre de sesión o recarga vuelve al mes actual.
- Las estaciones se derivan de la receta/ruta vigente de cada orden; los cambios de dotación se guardan en la orden y no alteran la receta base ni el cálculo de capacidad existente.
- La jerarquía de capas, los selectores y los valores numéricos de `src/styles/manufacturing.css` se tratan como restricción de interfaz acordada; no se introducen librerías ni sistemas de estilos nuevos.
- El filtro de la subpestaña "Roles" se resuelve con el usuario autenticado y las cinco tablas persistidas; el rol activo del menú superior sigue siendo la vista efectiva y su cambio requiere confirmación explícita.
- "Configurar roles" depende del rol **activo**, no solo de la pertenencia a la tabla de Jefa de Planta; `#/admin-roles` se conserva como enlace profundo hacia esa subpestaña y deja de ser un destino de navegación independiente.
- El indicador "+N más" es solo una ayuda visual: el menú del día es la fuente completa de actividades y no se pierde información al limitar la altura de la celda.
- Las pestañas "Calendario"/"Listado" y las subpestañas de Roles reutilizan el lenguaje visual ya existente en Mantenimiento, sin componentes nuevos ni dependencias adicionales.
- La autenticación sigue siendo simulada: "validar contraseña actual" significa comparar con la credencial persistida en el snapshot local, sin recuperación, bloqueo por intentos ni servicios externos.
- La contraseña inicial de una cuenta nueva es el propio nombre de usuario; el cambio de contraseña es voluntario y no obliga a renovarla en el primer ingreso.
- La regla de conservar al menos una cuenta en `plant_manager` protege la administración de roles; las demás tablas pueden quedar vacías y un usuario puede quedar sin roles asignados tras una baja.
- Los eventos de cierre de ventanas emergentes (botón, Escape, clic fuera) y de arrastre se consideran parte del mismo flujo: soltar el puntero en cualquier posición del documento confirma la intención de abrir el modal de horario.
- El mini-calendario de máquina es una vista de lectura: el cambio de mes sirve solo para inspeccionar otro período y no modifica planes, órdenes ni mantenciones.
- La ampliación de US-12, US-13 y US-15 se documenta únicamente en esta especificación y sus criterios de aceptación; las Fases 1 a 29 de `tasks.md` y las mejoras de `main` se tratan como línea base inmutable.

## 9. Artefactos Spec-Kit

| Artefacto | Ruta | Propósito |
|---|---|---|
| `spec.md` | `specs/002-operations-manufacturing/spec.md` | Especificación funcional y criterios de aceptación |
| `checklists/requirements.md` | `specs/002-operations-manufacturing/checklists/requirements.md` | Validación de calidad de la especificación |
| `plan.md` | `specs/002-operations-manufacturing/plan.md` | Plan de implementación, fases, gobernanza, estructura |
| `data-model.md` | `specs/002-operations-manufacturing/data-model.md` | Diccionario de datos, ERD Mermaid, ética/datos, trazabilidad |
| `research.md` | `specs/002-operations-manufacturing/research.md` | Decisiones técnicas de US-06, US-07, US-08, US-09, US-10 y US-11 |
| `contracts/operator-shift.md` | `specs/002-operations-manufacturing/contracts/operator-shift.md` | Contrato de store/UI para operador (US-06) y supervisor de línea (US-07) |
| `contracts/plant-performance.md` | `specs/002-operations-manufacturing/contracts/plant-performance.md` | Contrato de panel de planta, umbrales, permisos y exportación (US-08) |
| `contracts/order-scheduling.md` | `specs/002-operations-manufacturing/contracts/order-scheduling.md` | Contrato de planificación y fechas planificadas (US-10) |
| `contracts/maintenance.md` | `specs/002-operations-manufacturing/contracts/maintenance.md` | Contrato de tickets, intervenciones y disponibilidad (US-09) |
| `contracts/line-balance.md` | `specs/002-operations-manufacturing/contracts/line-balance.md` | Contrato de balance de líneas, umbrales y sugerencias simuladas (US-11) |
| `quickstart.md` | `specs/002-operations-manufacturing/quickstart.md` | Guía de ejecución y validación de las historias de usuario |
| `tasks.md` | `specs/002-operations-manufacturing/tasks.md` | Tareas atómicas por fase e historia de usuario |

## 10. Notas de Implementación

- **Stack**: Vanilla JavaScript ES2022 + Vite + CSS. JSDoc para tipado (paridad con `001-erp-base-module`).
- **Arquitectura**: `domain/` (lógica pura), `data/` (fixtures + store + puertos), `components/` (vistas), `styles/`.
- **Estado**: `ManufacturingStore` en memoria con `EventTarget` para re-render reactivo y snapshot versionado en `localStorage` (`erp.manufacturing.v2`, con migración desde `v1`) para sobrevivir recargas.
- **Puentes Inter-Modulares (US-07 / HU-04)**: `ext_hr_employee_id` consume catálogo simulado de operadores de RR.HH. (`src/data/fixtures/hr-employees.js`) y el escalamiento genera registros en `maintenance_tickets` consumibles por la vista de Mantenimiento (HU-06).
- **Ética**: agregación por centro/operación, sin rankings individuales; tiempos y asignaciones como dato de coordinación operativa.
- **Navegación**: `src/domain/access-control.js` es la fuente única de roles, etiquetas y matriz de módulos; `src/manufacturing-main.js` sincroniza rol y hash, sin exposición lateral de "Datos de roles" y con `#/admin-roles` como enlace profundo hacia "Configurar roles"; `src/data/fixtures/dashboard-demo.js` contiene sólo datos de demostración para el inicio.
- **Puntos de extensión de US-12 a US-15**: `RoleAccessPanel.js` aloja las subpestañas "Roles" y "Configurar roles", integrando la funcionalidad de `RoleAdminPanel.js` (cinco tablas, altas, asignaciones y botón "Quitar") y reutilizando `ConfirmDialog.js` para el cambio de rol y las bajas; `src/manufacturing-main.js` aloja "Cambiar contraseña" en el menú de usuario; `ProductionSchedulingPanel.js` y `src/components/calendar/CalendarEventDialog.js` para bandeja horizontal, calendario, pestañas, detalle por tarea, modales centrados y gesto de arrastre; `src/domain/operation-planning.js` (`deriveBomStations`) junto a `SupervisorLinePanel.js` para estaciones y dotación; `MaintenancePanel.js` para los dos paneles de máquinas, el mini-calendario, Tickets y las dos listas de Mantenimientos.
- **Capas visuales**: `src/styles/manufacturing.css` define la jerarquía z-index de FR-19 y mantiene los contenedores `.view`, `.content` y `.panel` libres de transformaciones o animaciones que generen contextos de apilamiento por debajo de los modales.
- **Conservación obligatoria**: no modificar la tipografía `@fontsource-variable/inter`, `icons.js`, `ConfirmDialog.js`, `Toast.js`, `labels.js`, `demo-dates.js`, `capacity.js`, el balance de líneas de US-11, el menú drawer, el botón "Reiniciar datos de demo" ni la configuración de `vitest.config.mjs`.
- **Límites de cambio**: no renombrar el paquete en `package.json`, no añadir dependencias externas, no incorporar elementos de `001-erp-base-module` en `index.html` y mantener los IDs de ruta `orders`, `supervision`, `scheduling`, `maintenance`, `operator`, `plant`, `line-balance`, `bom`, `dashboard`, `roles` y `admin-roles`.
