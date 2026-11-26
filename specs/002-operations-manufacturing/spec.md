# Especificación: Módulo de Operaciones / Manufactura (ERP)

> **Nota de alcance del MVP (vigente, 2026-11-26)**: el MVP activo del Grupo 15 corresponde **EXCLUSIVAMENTE** a `specs/002-operations-manufacturing/`. `specs/001-erp-base-module/` es **solo referencia histórica** y **NO debe implementarse**. **NO se implementan Entidades, Documentos, pestañas ni campos personalizados del template 001**; tampoco los botones "Documentos", "Entidades" o "Módulo Base ERP", ni los archivos `src/storage.js` y `src/module-config.js`. Cualquier mención a `001-erp-base-module` en esta especificación se limita a conservar compatibilidad o paridad documental; no autoriza a incorporar elementos de ese módulo en `index.html`, la navegación ni el código fuente.

**Rama**: `main` (directorio de especificación `specs/002-operations-manufacturing`; sin creación de rama ni carpeta nueva) | **Fecha**: 2026-10-31 | **Actualizado**: 2026-11-26
**Datos maestros**: [data-model.md](data-model.md) | **Plan**: [plan.md](plan.md) | **Tareas**: [tasks.md](tasks.md)
> **Ampliación 2026-11-23**: se extienden US-12, US-13 y US-15 con baja de usuarios y cambio de contraseña, calendario ancho completo con modales reales y selección por arrastre sin bugs, y rediseño de mantenimiento con mini-calendario de máquina. Fases 1 a 29 de `tasks.md`, `plan.md` y las mejoras presentes en `main` permanecen intactas; los criterios AC-01 a AC-87 se conservan textualmente y la ampliación se registra desde AC-88.
> **Ampliación 2026-11-24**: se extienden US-12, US-13 y US-15 con retroalimentación visual uniforme en bloques seleccionables, reordenación de subpestañas y mini-calendario compacto en Mantenimiento, bandeja vertical derecha y cierre correcto de ventanas en Planificación, acceso directo a Supervisión para el rol supervisor y asignación múltiple de roles al crear usuarios. Las mejoras de `main` y las Fases 1 a 30 de `tasks.md` permanecen intactas; AC-01 a AC-103 conservan su texto histórico y la ampliación se registra desde AC-104.
> **Consolidación 2026-11-24**: esta especificación queda 100 % autocontenida y reconstruible desde cero. Se aclara el alcance del MVP, se eliminan contradicciones entre las redacciones históricas y el estado final vigente de FR-20, se confirman AC-47 a AC-119 como **Verificado** tras la ejecución de 297 pruebas y se incorpora FR-21 con el dataset semilla obligatorio. Los IDs históricos AC-01 a AC-119 se conservan sin renombrar ni borrar; cuando un texto histórico queda superado, la regla vigente se indica expresamente en el propio requisito, criterio o nota de supersedencia.

> **Actualización 2026-11-26 (vigente)**: se amplía a **seis roles** alineados con las Personas (se agrega Ingeniero de Producción), se fija una **única cuenta por rol** en FR-13 —credenciales copiadas literalmente en el README— y se elimina la cuenta `usuario` junto a las cuentas multicrol de prueba. El rol del login es la única fuente de permisos: **no existen controles de cambio de rol**; solo la Jefa de Planta puede usar **"Ver como"** desde el menú de usuario. "Roles" y "Datos de roles" se fusionan en una única página `#/roles`, visible solo para la Jefa. Se incorpora FR-22 (matriz de permisos por acción y módulo) y FR-23 (bloqueo de permisos en el store), además de la sección **Datos de demostración** (4 productos terminados, 10 centros, 40 órdenes en 3 meses, 15 tickets, 5 preventivas, 12 empleados de RR.HH. y el dataset de 500 órdenes de SC-07). Los IDs AC existentes se conservan; los AC modificados vuelven a **Pendiente** y los nuevos AC-127 en adelante se registran como **Pendiente**.

---

## 1. Objetivo

Implementar un prototipo funcional de frontend para el módulo de Operaciones / Manufactura que centraliza el ciclo **planificado → programado → ejecutado → registrado → supervisado → mantenido**: gestión de BOM y rutas, despacho de órdenes, seguimiento de operaciones en piso, registro de turno del operador, supervisión de línea en tiempo real (semáforo, asignación de personal, validación de cierre y escalamiento a mantenimiento), panel de desempeño de planta (carga, OEE, paradas, alarmas, reportes y permisos) y gestión de mantenimiento correctivo/preventivo con registro de tiempos de parada y restablecimiento de la disponibilidad de las máquinas. Se amplía con un sistema multi-rol de seis roles con tablas de usuario separadas y privacidad de personas, un calendario mensual interactivo con programación por arrastre y vistas estrictas por rol, estaciones derivadas de la receta del BOM gestionadas desde supervisión, y un panel de mantenimiento en tres subpestañas sincronizado con el calendario, con programación desde tickets, fechas dinámicas e inmutabilidad de lo resuelto. Se incorporan tres ajustes de interfaz y navegación: una jerarquía estricta de capas que impide que tablas, barras o encabezados fijos tapen ventanas emergentes; una distribución del calendario mensual con pestañas integradas, cuadrícula de siete columnas legibles y tope visual de tres eventos por día con indicador de exceso; y la unificación de "Roles" y "Datos de roles" en una única página (`#/roles`) exclusiva de la Jefa de Planta. Se amplía además con la baja confirmada de usuarios por rol y el cambio de contraseña desde el menú de usuario, un calendario mensual con bandeja vertical derecha solo para planner y plant_manager, ancho completo para los demás roles, ventanas emergentes centradas que se cierran con "×" y selección de horario por arrastre continuo, y un rediseño de mantenimiento que consolida máquinas en dos paneles con mini-calendario, simplifica tickets a una sola acción y unifica mantenciones en dos listas.

Se incorpora además un conjunto de precisiones de interfaz y usabilidad: todo bloque seleccionable ofrece una retroalimentación visual de hover uniforme; Mantenimiento abre en "Mantenimientos", muestra las máquinas como filas compactas de nombre y código y un mini-calendario más estrecho con leyenda siempre visible; Planificación adapta el "Listado" del rol de mantenimiento a las mantenciones activas, devuelve la bandeja de pendientes al costado derecho del calendario y elimina los controles de retroceso redundantes en las ventanas emergentes; el rol supervisor accede a Supervisión de línea desde el resumen del día; y la creación de usuarios permite inscribirlos en varios roles en una sola operación sin duplicados.

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

- **Q**: ¿Qué identidad se obtiene si un mismo usuario aparece en varias tablas de rol? → **A (supersedido el 2026-11-26)**: ya no existen cuentas multicrol ni uniones de roles; cada cuenta demo pertenece a una sola tabla y el rol se resuelve únicamente al iniciar sesión. La única excepción es "Ver como" de la Jefa de Planta, que no cambia la identidad autenticada.
- **Q**: ¿Qué alcance tiene la memoria del mes visitado en el calendario? → **A**: solo recuerda el último mes entre cambios de pestaña dentro del panel; cambiar de usuario/rol, cerrar sesión o recargar vuelve al mes actual.
- **Q**: ¿Cómo se corrige una mantención resuelta por error? → **A**: no se edita ni se vuelve a resolver; se elimina desde "Mantenimientos históricos" con confirmación y se crea un registro nuevo.

</details>

<details open>
<summary><strong>Session 2026-11-23 (Ajustes de interfaz y navegación — US-12 / US-13 / FR-13)</strong></summary>

- **Q**: ¿Qué ocurre al presionar la tarjeta del rol ya activo en la subpestaña "Roles"? → **A (supersedido el 2026-11-26)**: la página "Roles" ya no es visible para todos los usuarios; solo la Jefa puede abrirla y el cambio de vista se hace exclusivamente desde "Ver como" en el menú de usuario, con confirmación.
- **Q**: ¿Debe el indicador "+N más" desplegar el detalle de los eventos restantes dentro de la celda? → **A**: no; es un indicador compacto y solo informa del exceso. El detalle completo de todas las actividades del día se consulta en el menú del día.
- **Q**: ¿Puede configurar roles un usuario con la Jefa de Planta asignada pero con otro rol activo? → **A (supersedido el 2026-11-26)**: ya no existen cuentas con varios roles asignados. La configuración depende del rol autenticado: solo la cuenta de Jefa de Planta ve `#/roles`; cualquier otro usuario es redirigido a su módulo de inicio, inclusive si abre `#/admin-roles`.
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

<details open>
<summary><strong>Session 2026-11-24 (Ajustes de interfaz y usabilidad — US-12 / US-13 / US-15)</strong></summary>

- **Q**: ¿Cómo conviven la bandeja vertical derecha con la bandeja horizontal de la ampliación anterior? → **A**: la bandeja vertical derecha sustituye a la horizontal. El texto histórico de AC-91 se conserva como ancla, SC-18 queda alineado a la distribución vigente y la regla aplicable es AC-113: bandeja solo para `planner` y `plant_manager`, y calendario al 100 % del ancho para los demás roles.
- **Q**: ¿Qué señal de cierre queda en las ventanas del calendario? → **A**: únicamente el botón "×" en la esquina superior derecha. Se elimina "Volver a la lista del día" de `CalendarEventDialog.js` y del menú diario; al presionar "×" se limpian `selectedEventId` y `dayMenuDate` y se cierra el backdrop, igual que Escape y el clic fuera.
- **Q**: ¿Qué muestra Planificación en "Listado" para el Encargado de Mantenimiento? → **A**: exactamente el mismo listado "Mantenimientos activos" de la subpestaña Mantenimientos: activas y vencidas sin resolver, con buscador por máquina/código, filtro Todos/Vigentes/Vencidos y botón "Resolver"; no muestra órdenes de producción para ese rol.
- **Q**: ¿Cómo se crea un usuario con varios roles? → **A**: el formulario "Agregar usuario" ofrece hasta seis desplegables de rol con un botón "+" cuadrado a la derecha; se pueden quitar filas adicionales, los roles repetidos se cuentan una sola vez, la contraseña inicial es el nombre de usuario y todo se persiste antes de mostrar el toast y reiniciar el formulario a un solo desplegable.

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
- **Panel de desempeño de planta (US-08 / Jefa de Planta)**: carga por centro, OEE y paradas acumuladas por período, umbrales críticos con alarmas, reprogramación y cancelación de órdenes, exportación del reporte consolidado a PDF y Excel, y permisos por acción derivados del rol del login.
- **Gestión de mantenimiento y disponibilidad de máquinas (US-09 / HU-06)**: bandeja de tickets escalados, toma de intervención con técnico asignado, historial y desgaste por máquina, órdenes de mantenimiento preventivo, registro de tiempos reales de parada y restablecimiento del semáforo del centro de trabajo.
- **Acceso por rol y navegación**: ingreso con credenciales de demostración, resolución del rol desde la cuenta autenticada, filtrado de la navegación según la matriz de permisos, navegación por hash (deep links y botón atrás), única página de roles restringida a la Jefa de Planta y datos simulados para probar estados y formularios sin backend.
- **Sistema multi-rol y privacidad (US-12)**: seis roles canónicos con Ingeniero de Producción y Encargado de Mantenimiento, seis tablas de usuarios persistentes, una cuenta por rol, matriz de módulos y acciones por rol, y reglas de anonimización de nombres de RR.HH. y de técnicos de mantención.
- **Calendario mensual interactivo (US-13)**: calendario mensual con filtro de eventos, bandeja de pendientes de horario, modo de selección por arrastre para el planificador, menú diario por tarea, ventanas de detalle por rol y resúmenes contextuales según el rol activo.
- **Estaciones derivadas del BOM (US-14)**: estación equivalente a máquina (`work_center`), secuencia derivada de la receta/ruta de cada orden y edición de dotación exclusivamente desde supervisión para supervisor y Jefa de Planta.
- **Mantenimiento en tres subpestañas (US-15)**: máquinas con alertas e indicador de desgaste, tickets con programación de mantenciones, y mantenciones activas/vencidas/históricas sincronizadas con el calendario, con cálculo automático de parada, fechas dinámicas e inmutabilidad de registros resueltos.
- **Jerarquía de capas para ventanas emergentes (FR-19)**: escala de superposición obligatoria que impide que encabezados fijos de tabla, barras laterales o barras superiores tapen modales, popups, diálogos de confirmación ni notificaciones, sin contextos de apilamiento que atrapen los modales por debajo de las tablas.
- **Distribución del calendario mensual (US-13)**: pestañas "Calendario" y "Listado" integradas en el sistema visual de la aplicación, cuadrícula de siete columnas proporcionales a ancho completo con títulos legibles, y tope visual de tres eventos por día con indicador "+N más" cuyo detalle completo se consulta en el menú del día.
- **Unificación de Roles (US-12 / FR-13)**: "Roles" y "Datos de roles" se fusionan en una única página `#/roles`, visible solo para la Jefa de Planta, con las tarjetas de los seis roles y la configuración administrativa integrada; `#/admin-roles` redirige a esa página. Los demás roles no ven el acceso lateral ni pueden abrir la página por URL. "Ver como" solo está en el menú de usuario de la Jefa.
- **Baja de usuarios y credenciales (US-12)**: cada chip de usuario en las seis tablas de rol ofrece "Quitar" (×) con confirmación, sin permitir vaciar `plant_manager`; las cuentas nuevas conservan la contraseña igual al nombre de usuario, las credenciales demo son las de FR-13 y cualquier usuario autenticado puede cambiar su contraseña desde el menú superior, con persistencia y validación en el ingreso.
- **Calendario con bandeja vertical y modales reales (US-13, estado vigente)**: bandeja "Pendiente de horario" vertical a la derecha solo para `planner` y `plant_manager`; calendario al 100 % del ancho útil para `maintenance`, `operator` y `supervisor`; menú diario, detalle de evento y popup de horario siempre como ventanas centradas, sin "Volver a la lista del día" y con cierre únicamente mediante "×" (equivalente a Escape y clic fuera); selección de horario por arrastre continuo con rango exacto y apertura inmediata del modal al soltar.
- **Rediseño de mantenimiento (US-15)**: vista de máquinas en dos paneles con detalle consolidado, deselección explícita o por clic fuera y mini-calendario mensual informativo con leyenda de colores; tickets reducidos a buscador, detalle desplegable y "Programar mantención"; mantenciones unificadas en exactamente dos listas (activas con filtro de vigencia e históricas con baja confirmada).

- **Ajustes de interfaz y usabilidad (2026-11-24, US-12 / US-13 / US-15)**: hover uniforme en bloques seleccionables, subpestañas de Mantenimiento con "Mantenimientos" primero y lista de máquinas compacta, mini-calendario reducido con leyenda visible, listado de mantenciones activas para el rol `maintenance` en Planificación, bandeja "Pendiente de horario" vertical al lado derecho del calendario, cierre de ventanas exclusivamente con "×", acceso directo a Supervisión para `supervisor` y creación de usuarios con asignación múltiple de roles.

**Límites**: sin backend, sin MRP automático, sin MES en tiempo real. Las entidades de frontera (`products`, `warehouses`, `units_of_measure`, `companies`, `sales_orders`, `quality_inspections`, `hr_employees`) se consumen como datos simulados de solo lectura.

> **Convención de "tiempo real"**: en esta especificación significa actualización reactiva inmediata de la interfaz ante cambios del store local y eventos persistidos, con objetivo `< 100 ms` (SC-07). No implica telemetría de máquina, backend ni sincronización externa.

## 3. Personas

| Persona | Descripción |
|---|---|
| **Jefa de Planta (`@Lia-dl`)** | Gestiona BOM y rutas, define capacidad, programa y prioriza órdenes, monitorea carga. Supervisa el desempeño global de la planta: consulta carga por centro, OEE, paradas acumuladas y cumplimiento de órdenes, configura alarmas de umbral, reprograma o cancela órdenes, exporta reportes consolidados y define permisos por rol. Analiza por centro de trabajo y operación, sin ranking de operadores. |
| **Supervisor de Operaciones / Línea (`@carlos-277`)** | Monitorea el semáforo de líneas/máquinas en tiempo real, asigna operadores por turno (`ext_hr_employee_id`), revisa y aprueba cierres de turno (`supervisor_validated`) y escala incidentes críticos a mantenimiento. |
| **Operador (`@maximilianMC`)** | Ejecuta operaciones en pantalla táctil/piso, inicia/finaliza turno, justifica atrasos, registra conteo de piezas, consumo, salida y merma; solo consulta y reporta incidentes de mantenimiento. |
| **Ingeniero de Producción (`@JualTrupe`)** | Configura rutas de fabricación y tiempos estándar, analiza el balance de líneas y evalúa informes de materiales para optimizar tiempos, reducir mermas y encontrar rutas óptimas. |
| **Encargado de Mantenimiento (`@SebastianRivasprg`)** | Atiende incidentes críticos escalados desde piso (`fault`), analiza historial operativo y evalúa desgaste en maquinaria para programar mantenimientos preventivos, registra tiempos de parada por mantención y restablece la disponibilidad operativa de las máquinas. |
| **Planificador (`@maiteval`)** |  Organiza y calendariza las órdenes de producción, asignando fechas planificadas de inicio y término a las tareas. Coordina la secuencia de fabricación según las prioridades y plazos de entrega, consulta el estado de las órdenes y ajusta la programación cuando existen atrasos o cambios en la producción, buscando optimizar los tiempos y cumplir con las fechas de entrega establecidas. |

> **Convención de roles (vigente 2026-11-26)**: la interfaz usa seis etiquetas de rol canónicas —Jefa de Planta (`plant_manager`, rol administrador), Planificador (`planner`), Ingeniero de Producción (`production_engineer`), Supervisor de Línea (`supervisor`), **Operador** (`operator`) y Encargado de Mantenimiento (`maintenance`)—. "Operador" es la etiqueta visible canónica en **toda** la UI (panel de planta, estación, supervisión, Roles, reportes, calendario y menú de usuario); no se muestran etiquetas alternativas. El rol autenticado se obtiene **solo del login** y cada cuenta demo tiene un único rol. No existen controles de cambio de rol en la cabecera ni en los paneles; solo la Jefa de Planta puede usar "Ver como" desde su menú de usuario para previsualizar otro rol sin cambiar su identidad.

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
- **Permisos por rol**: los permisos se derivan **exclusivamente del rol obtenido en el login** para los **seis roles canónicos** definidos en la convención de roles. La interfaz oculta las acciones no permitidas y el store las rechaza aunque se invoquen por URL o por manipulación del estado (FR-22/FR-23). No existen controles de cambio de rol en la cabecera ni en los paneles; "Ver como" es una previsualización que solo la Jefa de Planta inicia desde el menú de usuario y no modifica la identidad autenticada. Jefa de Planta tiene todos los permisos; Supervisor consulta, asigna, valida y escala en Supervisión, sin cambiar umbrales; Planificador programa y reprograma órdenes; Ingeniero de Producción edita BOM, rutas y balance; Operador solo consulta y reporta incidentes en Mantenimiento; Encargado de Mantenimiento toma y cierra tickets, programa preventivas y no cambia umbrales ni prioridades de órdenes.
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
- **Proponer ajustes simulados**: solo se ofrecen cuando existe un cuello crítico. Las reasignaciones se permiten únicamente entre estaciones con el mismo `station_type`; la demo tiene 10 centros de trabajo; el ejemplo de balance usa 5 tipos y 2 estaciones de Soldadura (Soldadura 1 y Soldadura 2). Ejemplo: “Reasignar 6.865 min de OP-3007 desde Estación de Soldadura 1 a Estación de Soldadura 2 · Sec. 20.”
- **Aceptar de forma simulada**: la propuesta requiere confirmación explícita y marca la fila como `Solicitud simulada`; no se registra en el store, no se persiste y no muta rutas, operaciones ni asignaciones.
- **Calcular y monitorear la capacidad del período**: Comparar la demanda planificada frente a la capacidad calculada como días hábiles del período × `capacity_per_day_minutes` × `efficiency_factor`. El factor de eficiencia también aplica aquí; la vista debe etiquetar la capacidad como efectiva del período.
- **Recomendar mejoras de eficiencia**: Identificar oportunidades para reducir tiempos muertos y maximizar la tasa de salida, sin modificar la asignación de recursos ni el personal desde esta vista.
- **Consultar órdenes por estación en un popover**: al activar una fila de “Carga por centro”, se abre una ventana compacta con las órdenes que consumen esa estación, la carga en el centro y el porcentaje de participación por orden. La sección independiente “Órdenes por centro” no forma parte de la vista.

</details>


<details open>
<summary><strong>FR-13: Acceso por rol, navegación y datos de demostración</strong></summary>

- Mostrar una pantalla de ingreso genérica con usuario y contraseña, sin exponer roles ni descripciones. El login resuelve **una sola cuenta con un solo rol** y persiste ese rol en `erp.manufacturing.role` (`src/data/fixtures/demo-accounts.js`). Cargar la página o cerrar sesión vuelve al ingreso. El menú de usuario ofrece "Cambiar contraseña" a cualquier persona autenticada y, **solo a la Jefa de Planta**, "Ver como" (previsualización temporal, sin cambio de identidad ni de credenciales).
- **Cuentas demo obligatorias (una por rol)**: estas credenciales se copian **literalmente** en el README y se usan tal cual en la demostración; no existen cuentas multicrol ni la cuenta `usuario`/`usuario`.

  | Rol (etiqueta visible) | Usuario | Contraseña | Nombre de persona ficticia | Módulo de inicio |
  |---|---|---|---|---|
  | Jefa de Planta (`plant_manager`, admin) | `jefa.planta` | `ForjaPlanta26!` | `Bárbara Ilicura Sotomayor` | Panel de planta (`#/plant`) |
  | Planificador (`planner`) | `planificador.ops` | `Calendario2026!` | `Marisol Antihuala Cárcamo` | Planificación (`#/scheduling`) |
  | Ingeniero de Producción (`production_engineer`) | `ingeniero.prod` | `RutaOptimal26!` | `Efraín Troncoso Bustamante` | Balance de líneas (`#/line-balance`) |
  | Supervisor de Línea (`supervisor`) | `supervisor.linea` | `TurnoLinea26!` | `Cristóbal Zermeño Aravena` | Supervisión (`#/supervision`) |
  | Operador (`operator`) | `operador.planta` | `Estacion2026!` | `Yanis Cheuquemán Linco` | Estación (`#/operator`) |
  | Encargado de Mantenimiento (`maintenance`) | `mantencion.mgr` | `TallerMaq26!` | `Ruperto Espinoza Gaete` | Mantenimiento (`#/maintenance`) |

- Filtrar la navegación lateral y los módulos según `MODULE_ACCESS` y la matriz FR-22; denegar módulos y acciones no permitidos aunque se acceda por URL o se manipule el store. La navegación lateral ofrece el acceso "Roles" **únicamente a la Jefa de Planta**; "Datos de roles" deja de existir como acceso o página independiente.
- Mostrar una única página `#/roles`, visible solo para la Jefa de Planta, que integra las tarjetas de los seis roles y la configuración administrativa de las seis tablas. El acceso directo `#/admin-roles` redirige a `#/roles` solo para la Jefa; para cualquier otro rol se deniega y se redirige a su módulo de inicio.
- Sincronizar el módulo activo con el hash (`#/dashboard`, `#/plant`, etc.) para soportar enlaces profundos y el botón atrás del navegador, respetando siempre el rol del login.
- Usar datos simulados deterministas para la actividad reciente, identificados como datos de demostración y sin mutar el snapshot de manufactura. La navegación lateral es el único acceso directo a los módulos por rol.
- Aplicar la etiqueta **Operador** de forma consistente en toda la UI —panel de planta, estación, supervisión, calendario, Roles, reportes y menú de usuario— sin usar etiquetas alternativas ni controles de cambio de rol.

</details>


<details open>
<summary><strong>FR-14: Sistema multi-rol, seis tablas de usuarios y privacidad (US-12)</strong></summary>

**US-12**: Como Jefa de Planta, quiero administrar seis roles canónicos con una cuenta por rol y ver solo la información de personas autorizada, para que cada integrante acceda únicamente a las funciones y datos que le corresponden.

- **Roles canónicos**: seis roles —`plant_manager` (Jefa de Planta, administrador), `planner` (Planificador), `production_engineer` (Ingeniero de Producción), `supervisor` (Supervisor de Línea), `operator` (Operador) y `maintenance` (Encargado de Mantenimiento)—. La cuenta genérica `usuario` y las cuentas de prueba multicrol (`test`, `doble`) se eliminan.
- **Cuentas demo**: exactamente las seis cuentas de la tabla de FR-13, una por rol, con usuario, contraseña, nombre ficticio y módulo de inicio indicados allí; el README las reproduce literalmente.
- **Seis tablas de usuario**: `role_users_plant_manager`, `role_users_planner`, `role_users_production_engineer`, `role_users_supervisor`, `role_users_operator` y `role_users_maintenance`, persistidas en `erp.manufacturing.v2`; sobreviven al cierre de sesión y se restauran con `resetDemoData` (botón "Reiniciar datos de demo" de la Jefa de Planta).
- **Resolución de roles**: al iniciar sesión se valida la cuenta y se toma **su único rol** como rol autenticado; no se recorren tablas para unir roles ni existen controles de cambio de rol en la cabecera ni en ningún panel. "Ver como" solo lo ofrece la Jefa de Planta en su menú de usuario: cambia la vista temporalmente, respeta la matriz FR-22 y nunca altera la cuenta autenticada ni sus credenciales.
- **Administración de roles**: `#/roles` (exclusiva de `plant_manager`) integra las seis tablas, el alta de usuarios en uno o más roles y la asignación de roles adicionales, con persistencia inmediata en `erp.manufacturing.v2` y confirmación mediante `showToast`. Tras cerrar sesión y volver a ingresar, los cambios son visibles en la configuración de la Jefa; los usuarios creados siguen la regla de una cuenta por rol demo y cualquier cuenta nueva recibe contraseña inicial igual a su usuario.
- **Matriz de módulos (`MODULE_ACCESS`)**: `plant_manager` accede a todos; `planner` a `dashboard`, `bom`, `orders`, `scheduling`, `plant`, `line-balance`; `production_engineer` a `dashboard`, `bom`, `line-balance`, `plant` (solo lectura); `supervisor` a `dashboard`, `operator`, `supervision`, `scheduling`, `maintenance`, `plant` (solo lectura) y sin `orders`; `operator` exactamente a `operator` y `scheduling`, y dentro de `scheduling` solo el Calendario Mensual sin "Listado"; `maintenance` exactamente a `maintenance` y `scheduling`, con el "Listado" de mantenciones activas. Ningún rol excepto `plant_manager` ve `roles` o `admin-roles`. Los identificadores de ruta existentes no cambian y se agrega `production_engineer` sin renombrar los anteriores.
- **Privacidad**: los nombres reales de `hr_employees` solo son visibles para `supervisor` y `plant_manager`; los demás roles, incluido `production_engineer`, ven datos anonimizados o un conteo. En el calendario, el nombre del técnico a cargo de una mantención solo es visible para `plant_manager` y `maintenance`; los otros roles ven solo máquina y duración.
- **Unificación de la vista de roles**: "Datos de roles" deja de existir; la única página "Roles" (`#/roles`) es visible exclusivamente para la Jefa de Planta y muestra las seis tarjetas de rol junto con la configuración administrativa, con el mismo lenguaje visual de las subpestañas de Mantenimiento.
- **Acceso restringido por login**: la página "Roles" no se muestra en la navegación de los otros cinco roles y cualquier intento de abrir `#/roles` o `#/admin-roles` por URL se deniega en la UI y en el store, redirigiendo al módulo de inicio del rol autenticado. La Jefa ve las seis tarjetas, con la suya marcada como vigente.
- **"Ver como" desde el menú de usuario**: solo la Jefa de Planta lo ve; al elegir otro rol abre `ConfirmDialog.js` con "¿Deseas ver la aplicación como <Nombre del rol>?" y aplica una vista temporal tras la confirmación. Cancelar conserva la vista actual y "Volver a mi rol" restaura `plant_manager`. La identidad, la contraseña y los permisos base siguen siendo los del login; el store valida cada acción contra el rol autenticado y el rol previsualizado.
- **Administración integrada**: la configuración reside dentro de la única página `#/roles` de la Jefa e integra `RoleAdminPanel.js`: las seis tablas por rol, alta de usuarios y asignación de roles adicionales, con persistencia inmediata en `erp.manufacturing.v2` y confirmación mediante `showToast`. `#/admin-roles` redirige a `#/roles` solo para `plant_manager`.
- **Baja de usuarios por rol**: cada chip de usuario dentro de las seis tablas de `RoleAdminPanel.js` incluye un botón "Quitar" (×). Al pulsarlo se abre `ConfirmDialog.js` para confirmar la baja; al confirmar se ejecuta `store.removeRoleUser(role, username)`, se persiste en `erp.manufacturing.v2` y se actualizan de inmediato la tabla y las tarjetas de roles de `#/roles`. Si el usuario es el último miembro de `role_users_plant_manager`, la baja se rechaza con un mensaje explícito y no se muta ninguna tabla; cancelar o cerrar el diálogo tampoco muta el snapshot.
- **Contraseña inicial**: las seis cuentas demo usan las contraseñas literales de FR-13. Toda cuenta nueva creada desde la configuración de roles mantiene la contraseña inicial igual al nombre de usuario, sin campo adicional obligatorio.
- **Cambio de contraseña**: "Cambiar contraseña" está disponible en el menú de usuario superior de `src/manufacturing-main.js` para cualquier usuario autenticado, sin depender del rol activo. Abre un modal centrado con tres campos: contraseña actual, nueva contraseña y confirmación de la nueva contraseña. El sistema valida que la contraseña actual coincida con la credencial vigente, que la nueva y su confirmación sean iguales y que la nueva no esté vacía; muestra errores inline y no muta el snapshot si alguna validación falla. Al confirmar, actualiza la contraseña del usuario en **todas** las tablas de rol donde figure, persiste el cambio en `erp.manufacturing.v2` y lo valida `authenticate` en el próximo ingreso, incluso tras logout o recarga. Si el usuario cambia su contraseña con un rol activo distinto, la credencial queda actualizada para el conjunto completo de roles asignados.

</details>


<details open>
<summary><strong>FR-15: Calendario Mensual Interactivo y Modo Selección de Horario (US-13)</strong></summary>

**US-13**: Como Planificador de Producción, quiero programar órdenes y revisar mantenciones en un calendario mensual con selección visual de horarios y vistas adaptadas a mi rol, para coordinar la producción sin ambigüedades.

- **Calendario mensual**: reestructurar `ProductionSchedulingPanel.js` con un Calendario Mensual en Vanilla JS + CSS Grid, sin librerías externas. Abre en el mes actual, recuerda en memoria de sesión el último mes visitado al cambiar de pestaña y vuelve al mes actual al cambiar de usuario/rol, cerrar sesión o recargar.
- **Filtro de eventos**: "Ambos" (predeterminado), "Solo Órdenes de Trabajo" y "Solo Mantenciones" (incluye tickets programados y órdenes preventivas).
- **Bandeja "Pendiente de horario" (vigente según FR-20.6 / AC-113)**: visible exclusivamente para `planner` y `plant_manager`, ordenada por prioridad/urgencia crítica y con porcentaje de avance. Solo `plant_manager` puede cambiar la prioridad y marcar órdenes pendientes como "Urgencia crítica" (`is_critical_urgent` / `priority urgent`). Se renderiza como una columna **vertical a la derecha** del calendario: `.calendar-layout--with-tray` aplica `grid-template-columns: minmax(0, 1fr) 280px` solo cuando la bandeja está visible. Para `maintenance`, `operator` y `supervisor`, que no ven la bandeja, `.calendar-layout` usa una sola columna `1fr` y `.calendar-main` ocupa el 100 % del ancho útil; no queda espacio reservado ni barra horizontal superior. Las celdas se dimensionan para que el mes completo resulte cómodo y proporcionado en pantalla estándar, sin compresión de títulos.
- **Modo Selección de Horario para `planner`**: un clic izquierdo en **cualquier parte** de la tarjeta `.pending-tray__row` activa el modo foco (hitbox completa, no solo el texto del código de la orden); en `plant_manager` los controles `select` y `checkbox` de la misma fila siguen funcionando sin interferir con el modo. Con el modo activo, `.scheduling-focus-backdrop` queda en `z-index: 40`, únicamente el bloque del calendario se eleva a `z-index: 50` con fondo blanco para permanecer totalmente iluminado, y `.scheduling-floating-card` sigue al cursor en `z-index: 60`. Las celdas `.calendar-day` declaran `draggable="false"` y `mousedown` ejecuta `preventDefault()`, con `user-select: none` en `.calendar-grid` mientras dure el modo, para impedir el arrastre fantasma nativo y la selección de texto. Al presionar `mousedown` en el día inicio y arrastrar sobre otros días, el rango completo se colorea de inmediato en tiempo real con `.calendar-day--drag-range`. Al soltar (`mouseup`) en **cualquier lugar del documento**, se desactiva el modo y se abre de inmediato el modal de horario centrado con horas predeterminadas "08:00" a "16:00", editables, conservando exactamente el rango completo seleccionado (por ejemplo, del 24 al 28) sin requerir ningún clic adicional. `contextmenu` ejecuta `preventDefault()` y cancela sin abrir el modal.
- **Ventanas emergentes centradas del calendario (vigente según FR-20.7 / AC-115)**: el menú diario (`calendar-day-menu`), el detalle de evento (`CalendarEventDialog.js`) y el popup de horario (`.schedule-popup`) se renderizan **siempre** como ventanas emergentes centradas sobre la pantalla, con `.modal-backdrop` en `z-index: 1000` y `.modal` en `z-index: 1001`. La única señal de cierre visible es el botón "×" en la esquina superior derecha; **no existe** el texto ni el botón "Volver a la lista del día". Al presionar "×" se limpian simultáneamente `selectedEventId` y `dayMenuDate` y se cierra el backdrop, con el mismo resultado que Escape y el clic fuera. Se elimina cualquier renderizado incrustado debajo del calendario.
- **Menú diario por tarea**: para `planner`, `plant_manager` y `supervisor`, hacer clic en un día abre primero un menú con las órdenes de trabajo y mantenciones de ese día; al elegir una tarea se ocultan las demás y se muestra solo su detalle en `src/components/calendar/CalendarEventDialog.js`, sin botón de retroceso al menú. El cierre se hace únicamente con "×", Escape o clic fuera, según FR-20.7. Para `supervisor`, tanto el menú diario como el detalle de orden incluyen el botón "Ir a Supervisión de línea" hacia `#/supervision` (FR-20.8 / AC-116), sin aparecer para otros roles.
- **Vistas y popups por rol**: solo `planner` y `plant_manager` pueden modificar fechas u horarios de órdenes. Para `supervisor` el bloqueo es total: sin inputs de fecha/hora, sin botones de guardar y eventos del calendario con `draggable="false"`. `plant_manager` ve indicadores compactos de color por día y un resumen ejecutivo con productos, meta de producción, máquinas activas/inactivas y cantidad de operadores. `supervisor` ve nombres reales con la etiqueta SC-08 "solo contexto operativo — no evaluación de desempeño" y una alerta de órdenes sin operador asignado; para mantenciones ve solo un resumen de lectura. `operator` ve únicamente sus órdenes asignadas y mantenciones en solo lectura.
- **Subpestañas de programación**: estilizar "Calendario" y "Listado" como pestañas integradas y coherentes con el sistema visual de las subpestañas de Mantenimiento, sin apariencia de botón HTML nativo; para `operator` continúa disponible únicamente "Calendario".
- **Cuadrícula mensual legible**: con la bandeja vertical a la derecha solo cuando corresponde, el bloque del calendario ocupa el 100 % del ancho disponible dentro de su columna y usa siete columnas proporcionadas (`grid-template-columns: repeat(7, minmax(0, 1fr))`), de modo que el título de cada evento se muestra legible y no queda reducido a íconos comprimidos en ninguno de los seis roles.
- **Tope visual por día**: cada celda muestra como máximo los primeros tres eventos legibles y, cuando hay más actividades, un indicador compacto "+N más"; el menú del día muestra la totalidad de órdenes y mantenciones de esa fecha para su consulta completa.
- **Precedencia del estado final**: los textos históricos de AC-55, AC-58, AC-91, AC-92 y SC-18 se conservan como anclas documentales, pero no definen la distribución vigente. La bandeja vertical de FR-20.6 sustituye a la horizontal de AC-91; el cierre con "×" de FR-20.7 sustituye el botón citado en AC-58; y el botón de supervisor de FR-20.8 se aplica además de las vistas por rol descritas arriba.

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

- **Estructura (vigente según FR-20.2 / AC-108)**: `MaintenancePanel.js` se organiza en tres subpestañas, en este orden exacto: **"Mantenimientos"** (primera y activa por defecto al abrir el módulo), **"Máquinas"** y **"Tickets"**. Se eliminan los tres filtros globales superiores (Estado, Prioridad y Centro, `.maintenance-filters` del header); el filtrado se realiza solo dentro de cada subpestaña.
- **Subpestaña Máquinas — vista consolidada**: se eliminan los paneles sueltos inferiores de Historial y Preventivas y el `fault-banner` duplicado. La subpestaña se presenta como dos paneles lado a lado: a la izquierda, la **lista compacta** de máquinas (más ancha inicialmente), donde cada fila muestra solo "Nombre de la máquina · CT-CÓDIGO" en horizontal, sin columnas de Sección, Estado, Frecuencia ni Desgaste (FR-20.3 / AC-109); a la derecha, el panel de detalle inicialmente vacío. La búsqueda y los filtros por sección y estado ("Todos", "Disponible", "En operación", "En mantención", "Detenida / En fallo") pueden permanecer como controles, pero esos datos nunca se despliegan como columnas en la lista. La selección de una máquina encoge la lista y da protagonismo al detalle con una transición suave (proporción objetivo `0.85fr 1.15fr`). "Deseleccionar" (×) restaura la proporción inicial y el panel derecho vacío.
- **Subpestaña Máquinas — detalle de la máquina**: al seleccionar una máquina, el panel derecho muestra toda su información consolidada: badge de estado operativo ("Frenada por mantención" si está en `fault` o con mantención activa, o "Disponible"/"En operación"), campo editable "Cada cuánto se recomienda mantención" en días (solo `maintenance` y `plant_manager`), desgaste derivado de `deriveWearIndicator`, historial de fallas, paradas acumuladas, botón "Programar preventiva" (motivo y plazo inicial), botón "Revisar históricas" (cambia a "Mantenimientos", enfoca el histórico y prellena su buscador con el nombre de la máquina) y el botón explícito "Deseleccionar" (×).
- **Deselección por clic fuera**: además del botón "Deseleccionar", un clic fuera de los recuadros de "lista de máquinas" y "detalle de máquina" deselecciona la máquina, restaura los tamaños iniciales y deja el panel de detalle vacío. Se ignoran los clics que ocurren dentro de modales o diálogos abiertos y los de la navegación del mini-calendario (botones ‹ y ›), que no deben provocar la deselección.
- **Mini-calendario de máquina (vigente según FR-20.4 / AC-110 y AC-111)**: mientras haya una máquina seleccionada, se muestra debajo de ambos paneles un mini-calendario mensual compacto y no interactivo con un ancho máximo de **520 px** (rango acordado 460–560 px) y la altura previamente acordada. La leyenda de colores se ubica **arriba o al costado**, nunca debajo, y no exige scrolling adicional. Cada día es un rectángulo independiente con `border-radius: 8px`, separación por `gap` y proporción aproximada **2.5:1** entre ancho y alto (`aspect-ratio: 2.5 / 1`), sin aspecto de tabla ni celdas pegadas. Su encabezado indica el mes y ofrece los botones ‹ y › como **única** interacción posible; los días se encabezan L, Ma, Mi, J, V, S, D y las celdas no son clickeables ni seleccionables. La leyenda distingue cuatro estados: sin color (sin plan), rojo (detención por mantención correctiva o fallo), azul (uso planificado por orden de trabajo que pasa por esa máquina/estación) y morado (mantención preventiva planificada).
- **Subpestaña Tickets**: se eliminan los botones "Resolver" y "Tomar intervención" tanto de la tabla como del detalle. Queda únicamente la tabla con buscador, el detalle consolidado desplegable al hacer clic en un ticket (detalle del ticket, historial de fallas, historial completo de mantenciones preventivas y correctivas, e indicador `deriveWearIndicator` con nivel Bajo/Medio/Alto, conteo de fallas y minutos acumulados) y el botón "Programar mantención" como única acción de intervención: abre un modal para elegir técnico, fecha de inicio y plazo estimado (`scheduled_start_date`, `scheduled_end_date`), pasa el ticket a `in_progress` y la máquina a `fault`, y lo muestra de inmediato en el Calendario Mensual y en "Mantenimientos activos". No hay banner superior duplicado, panel lateral separado ni tabla de preventivas.
- **Subpestaña Mantenimientos**: sincronizada al 100 % con todas las mantenciones del calendario (tickets programados y preventivas) y unificada en **exactamente dos listas**, cada una con su buscador por nombre de máquina o código: (1) "Mantenimientos activos" agrupa todas las mantenciones aún no resueltas, vigentes y vencidas, incorpora el filtro "Todos", "Vigentes" y "Vencidos" y ofrece el botón "Resolver"; (2) "Mantenimientos históricos" lista las mantenciones resueltas con botón "Eliminar" confirmado mediante `ConfirmDialog.js`, que borra el registro de `erp.manufacturing.v2` y del calendario, y cuyo buscador se prellena automáticamente con el nombre de la máquina al entrar desde "Revisar históricas". No existe una tercera lista independiente para vencidas.
- **Cálculo automático de parada técnica**: al resolver un ticket correctivo se calcula automáticamente el tiempo real entre el inicio de la intervención y la fecha/hora de resolución, sin exigir ingreso manual. Las mantenciones preventivas nunca se resuelven automáticamente al vencer el plazo; solo al presionar "Resolver".
- **Fechas dinámicas**: si una mantención activa supera su plazo sin resolverse, su fecha final visible se extiende automáticamente hasta la fecha actual; si se resuelve antes del plazo, se acorta automáticamente a la fecha real de resolución.
- **Inmutabilidad y resolución en calendario**: una mantención resuelta no puede volverse a resolver ni editarse en ninguna vista; para corregir errores se elimina en Históricos y se vuelve a crear. En el calendario, `maintenance` es el único rol con acción "Resolver" y no tiene bandeja de programación manual: al seleccionar una mantención activa ve tiempo parado, técnico y prioridad; al presionar "Resolver" se abre el popup "¿Está seguro que quiere resolver esta mantención?" con un campo editable de fecha/hora prellenado con la fecha y hora ACTUAL del sistema al momento del clic (NO la fecha de la celda seleccionada). Si la mantención ya está resuelta, se abre en solo lectura sin botón "Resolver".
- **Precedencia del estado final**: los textos históricos de AC-67, AC-71, AC-97 y AC-100 se conservan como anclas documentales. La regla vigente es la de FR-20.2 (orden "Mantenimientos", "Máquinas", "Tickets" con "Mantenimientos" activo por defecto), FR-20.3 (fila compacta nombre · código), FR-20.4 (mini-calendario ≤ 520 px, leyenda arriba/al lado y celdas 2.5:1) y FR-20.6/AC-102 (exactamente dos listas: "Mantenimientos activos" con filtro Todos/Vigentes/Vencidos y "Mantenimientos históricos"). No existe una tercera lista para vencidas.

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


<details open>
<summary><strong>FR-20: Ajustes de interfaz y usabilidad en US-12, US-13 y US-15 (2026-11-24)</strong></summary>

- **FR-20.1 — Retroalimentación visual global**: todos los recuadros o bloques seleccionables de la interfaz —filas de máquinas, tarjetas de órdenes pendientes de horario, ítems del menú diario del calendario, tarjetas de roles y filas seleccionables de tickets— deben oscurecer ligeramente su fondo al pasar el puntero, con una transición suave y `cursor: pointer`. El efecto cubre toda la hitbox del bloque, es claramente perceptible sin resultar agresivo y no selecciona ni muta datos por sí solo.
- **FR-20.2 — Orden de subpestañas de Mantenimiento**: `MaintenancePanel.js` presenta las subpestañas en el orden exacto "Mantenimientos", "Máquinas" y "Tickets". Al abrir el módulo de Mantenimiento, la subpestaña activa por defecto es "Mantenimientos". El comportamiento funcional de cada subpestaña se conserva según FR-17, salvo por los ajustes expresos de FR-20.3 y FR-20.4.
- **FR-20.3 — Lista compacta de máquinas**: en la subpestaña "Máquinas", la lista izquierda muestra únicamente el nombre de cada máquina en horizontal junto a su código, con el formato "Estación de Corte · CT-CORTE", en bloques limpios por fila. La lista no incluye columnas de Sección, Estado, Frecuencia ni Desgaste; los controles de búsqueda y filtros existentes pueden permanecer, pero no despliegan esos datos como columnas. Toda la información detallada —sección, estado operativo, frecuencia recomendada editable, desgaste, fallas, paradas acumuladas y los botones "Programar preventiva", "Revisar históricas" y "Deseleccionar"— aparece exclusivamente en el panel derecho una vez seleccionada la máquina.
- **FR-20.4 — Mini-calendario compacto**: el mini-calendario no interactivo que aparece debajo al seleccionar una máquina reduce su ancho total a un máximo de 520 px, dentro del rango acordado de 460 px a 560 px, conservando su altura actual. La leyenda de colores se ubica arriba o al costado del mini-calendario, nunca debajo, para ser visible sin scrolling adicional. Cada día se renderiza como un rectángulo independiente con `border-radius: 8px`, separación con `gap` entre celdas y proporción aproximada de 2.5:1 entre ancho y alto (`aspect-ratio: 2.5 / 1`), eliminando el aspecto de tabla o Excel con bordes pegados. La codificación se mantiene: sin color para sin plan, rojo para detención por mantención o fallo, azul para uso planificado por orden de trabajo y morado para mantención preventiva planificada. El cambio de mes con ‹ y › continúa siendo la única interacción; las celdas siguen siendo informativas y no seleccionables.
- **FR-20.5 — Listado de mantenciones en Planificación**: cuando el rol activo es Encargado de Mantenimiento (`maintenance`) dentro de `#/scheduling`, la subpestaña "Listado" muestra el listado "Mantenimientos activos" exactamente igual al de la subpestaña Mantenimientos de US-15: mantenciones activas y vencidas sin resolver, buscador por máquina o código, filtro "Todos"/"Vigentes"/"Vencidos" y botón "Resolver". No muestra órdenes de producción para ese rol. Los demás roles conservan el Listado de órdenes de producción definido en FR-15.
- **FR-20.6 — Bandeja vertical derecha**: la bandeja "Pendiente de horario" (`.pending-tray`), visible solo para `planner` y `plant_manager`, vuelve a un formato vertical ubicado al lado derecho del calendario. `.calendar-layout` incorpora una clase condicional (`.calendar-layout--with-tray`) que aplica `grid-template-columns: minmax(0, 1fr) 280px` cuando la bandeja está visible; sin bandeja, la cuadrícula usa una sola columna `1fr` y el calendario ocupa el 100 % del ancho útil también para `maintenance`, `operator` y `supervisor`. Cada orden pendiente se delimita como una tarjeta rectangular bien definida, con borde y esquinas redondeadas, hitbox completa y hover de oscurecimiento según FR-20.1. Se conservan el modo foco por arrastre de `planner` y los controles de prioridad y urgencia crítica de `plant_manager` descritos en FR-15.
- **FR-20.7 — Cierre de ventanas emergentes**: en `CalendarEventDialog.js` y en el menú diario de `ProductionSchedulingPanel.js` se elimina por completo el botón o texto "Volver a la lista del día". La única señal de cierre visible es el botón "×" en la esquina superior derecha. El listener de "×" limpia simultáneamente `selectedEventId` y `dayMenuDate` y cierra el backdrop, con el mismo efecto que la tecla Escape y el clic fuera, sin dejar estados residuales que reabran la ventana al cambiar de día o de pestaña.
- **FR-20.8 — Acceso a Supervisión para el supervisor**: en las ventanas emergentes de resumen al presionar un día del calendario —menú diario y detalle de orden— el rol `supervisor` ve un botón claro "Ir a Supervisión de línea" que redirige directamente a `#/supervision`. El botón no aparece para otros roles y no altera la sesión ni el rol activo.
- **FR-20.9 — Asignación múltiple al crear usuario**: en `RoleAdminPanel.js`, dentro del formulario "Agregar usuario" de la configuración integrada en `#/roles`, se coloca un pequeño botón cuadrado "+" al costado derecho del desplegable "Rol". Al presionarlo se agrega dinámicamente una nueva fila "Rol 2" y sucesivamente hasta un máximo de seis roles; al llegar a seis, el botón "+" se deshabilita o se oculta. Las filas extra pueden quitarse. Al enviar "Agregar", se crea el usuario con contraseña inicial igual a su nombre de usuario, se le inscribe simultáneamente en todas las tablas de los roles seleccionados, se ignoran las repeticiones del mismo rol, se persiste en `erp.manufacturing.v2`, se muestra un toast de confirmación y el formulario vuelve a un solo desplegable de rol.

</details>


<details open>
<summary><strong>FR-21: Datos Semilla de Demostración (US-16)</strong></summary>

**US-16**: Como integrante del equipo de demostración del Grupo 15, quiero que el primer arranque y el botón "Reiniciar datos de demo" carguen un dataset rico, variado y fechado en relación con el día actual, para poder validar todas las historias US-01 a US-15 sin crear datos manualmente.

- **Regla temporal obligatoria**: todas las fechas del dataset que deban caer en la semana o el mes actual se calculan con `src/data/fixtures/demo-dates.js` (funciones `relativeDay`, `relativeTimestamp`, `relativeMonth`, `daysAgo` y `daysFromNow`), nunca con fechas fijas incrustadas. En consecuencia, el calendario mensual y los mini-calendarios muestran bloques visibles al abrir la aplicación en cualquier fecha y también después de "Reiniciar datos de demo".
- **Empresa y maestros**: una empresa "Acero del Biobío S.A."; exactamente 3 bodegas (`BD-MP` materias primas, `BD-WIP` en proceso y `BD-PT` producto terminado); 4 unidades de medida (`UN`, `KG`, `L`, `M`); al menos 13 productos, compuestos por 4 bienes terminados con BOM (Bicicleta Urbana 700c, Bicicleta Cargo 700c, Cuadro Soldado y Rueda Armada), 6 componentes/subensambles (Tubo de acero cromoly, Llanta 700c, Juego de rayos, Maza de eje, Freno de disco y Manubrio aleado) y 3 materias primas (Pintura en polvo, Hilo de soldadura y Barniz epóxico); y 3 pedidos de venta con al menos uno MTO (`make_to_order=true`) y al menos uno de stock (`make_to_order=false`), con fechas relativas al día actual.
- **BOM multinivel**: los 4 bienes terminados tienen BOM con hasta **4 niveles** sin ciclos; la estructura principal es Bicicleta Urbana 700c → Cuadro Soldado → Tubo de acero cromoly → Hilo de soldadura, conservando sub-ensambles, cantidades por unidad, unidad de medida y merma. Se debe poder visualizar cada árbol completo desde US-01 y usarlo para derivar estaciones en US-14.
- **Centros de trabajo**: 10 centros/máquinas —Corte, Soldadura 1, Soldadura 2, Pintura, Armado, Calidad, Laminado, Ensamble Eléctrico, Pulido y Horno de Curado (este último `status = inactive`)— con `station_type` variado y `operational_status` repartido entre `available`, `in_operation` y `fault`, de modo que supervisión y mantenimiento tengan estados reales que mostrar desde el inicio. El centro inactivo no admite programación nueva.
- **Recursos humanos simulados**: 12 trabajadores de RR.HH. con nombres ficticios chilenos variados y únicos —Maitén Cubillos Salazar, Raimundo Flores Cáceres, Violeta Garrido Neira, Teodoro Aravena Muñoz, Lidia Pichun Paillao y Amador Riffo Valenzuela (6 operadores); Bastián Coñoman Quezada, Narcisa Tapia Illanes y Osvaldo Marín Peluso (3 técnicos de mantenimiento); Paz Echenique Vidal (supervisora); Ignacio Beltrán Soto (planificador); y Ximena Narria Osses (jefa de planta)—. No se permite repetir nombres genéricos como "Ana Pérez" ni usar el mismo nombre para dos registros.
- **Órdenes de producción**: exactamente 40 órdenes repartidas en los meses anterior, actual y siguiente y en los cinco estados (`planned`, `released`, `in_progress`, `completed`, `cancelled`), según la tabla de la sección **Datos de demostración**. Incluyen órdenes completadas en el pasado, al menos 4 en progreso o liberadas entre `relativeDay(-2)` y `relativeDay(+10)` con bloques azules visibles, al menos 2 órdenes `planned` sin fechas (`planned_start_date: null`, `planned_end_date: null`) para la bandeja, y órdenes canceladas. Las operaciones congeladas acompañan a cada orden liberada o en ejecución.
- **Turnos y atrasos**: al menos 5 turnos `completed` con `supervisor_validated = false` pendientes de validar y al menos 2 turnos validados, con marcas de inicio/fin; al menos 3 atrasos `open` (uno de ellos escalado) y 8 atrasos `closed` con motivo, duración y corrección cuando corresponda.
- **Tickets correctivos**: exactamente 15 tickets que cubren los tres estados (`open`, `in_progress`, `resolved`) y las tres prioridades (`urgent`, `high`, `normal`) según la matriz de la sección **Datos de demostración**. Al menos 2 tickets activos tienen `scheduled_start_date` y `scheduled_end_date` vigentes en el mes actual (calculados con `relativeDay(0)` a `relativeDay(+10)`) para aparecer de inmediato tanto en el Calendario Mensual como en "Mantenimientos activos".
- **Mantenimiento preventivo**: exactamente 5 órdenes preventivas: 1 vencida sin resolver en el pasado (`relativeDay(-10)` a `relativeDay(-1)`), 2 planificadas vigentes entre `relativeDay(+2)` y `relativeDay(+8)` para ver celdas moradas y filtrar "Vigentes", 1 `in_progress` y 1 `completed` en "Mantenimientos históricos".
- **Cuentas demo**: las 6 cuentas exactas de FR-13, una por rol y con las contraseñas literales indicadas allí, deben estar presentes cada una en su única tabla de rol; las cuentas `usuario`, `test` y `doble` no existen. Ninguna cuenta demo puede faltar de su tabla ni aparecer en otra.
- **Dataset de volumen**: además del dataset semilla anterior, debe poder generarse el conjunto de 500 órdenes descrito en **Datos de demostración** para verificar SC-07; no se carga por defecto.
- **Restauración**: "Reiniciar datos de demo" debe reconstruir el dataset completo —maestros, BOM, rutas, máquinas, RR.HH., órdenes, tickets, preventivas, roles y credenciales— recalculando todas las fechas relativas con la fecha actual del sistema, sin dejar registros huérfanos ni duplicados y conservando la versión vigente del snapshot.

</details>


<details open>
<summary><strong>FR-22: Matriz de permisos por acción y módulo (vigente 2026-11-26)</strong></summary>

La matriz se evalúa para los seis roles del login. `Sí` = acción visible y permitida; `—` = acción oculta en la UI **y** rechazada en el store (FR-23). Las celdas marcadas como "solo lectura" en la definición de módulo no habilitan edición aunque el módulo figure como visible.

| Módulo | Acción | Jefa de Planta | Planificador | Ingeniero de Producción | Supervisor de Línea | Operador | Encargado de Mantenimiento |
|---|---|---|---|---|---|---|---|
| Panel de planta | ver | Sí | Sí | Sí | Sí | Sí | Sí |
| Panel de planta | crear | Sí | — | — | — | — | — |
| Panel de planta | editar | Sí | — | — | — | — | — |
| Panel de planta | aprobar/cerrar | — | — | — | — | — | — |
| Panel de planta | exportar | Sí | Sí | Sí | Sí | — | — |
| Panel de planta | configurar umbrales | Sí | — | — | — | — | — |
| BOM | ver | Sí | Sí | Sí | Sí | Sí | — |
| BOM | crear | Sí | — | Sí | — | — | — |
| BOM | editar | Sí | — | Sí | — | — | — |
| BOM | aprobar/cerrar | Sí | — | — | — | — | — |
| BOM | exportar | Sí | Sí | Sí | — | — | — |
| BOM | configurar umbrales | — | — | — | — | — | — |
| Órdenes | ver | Sí | Sí | Sí | Sí | — | — |
| Órdenes | crear | Sí | Sí | — | — | — | — |
| Órdenes | editar (liberar/reprogramar/cancelar) | Sí | Sí | — | — | — | — |
| Órdenes | aprobar/cerrar | Sí | Sí | — | — | — | — |
| Órdenes | exportar | Sí | Sí | Sí | — | — | — |
| Órdenes | configurar umbrales | — | — | — | — | — | — |
| Estación | ver | Sí | — | — | Sí | Sí | — |
| Estación | crear (turno/consumo/incidente) | Sí | — | — | Sí | Sí | — |
| Estación | editar (contadores y ejecución) | Sí | — | — | Sí | Sí | — |
| Estación | aprobar/cerrar (validación de turno) | Sí | — | — | Sí | — | — |
| Estación | exportar | — | — | — | — | — | — |
| Estación | configurar umbrales | — | — | — | — | — | — |
| Supervisión | ver | Sí | — | — | Sí | — | — |
| Supervisión | crear (asignación/escalamiento) | Sí | — | — | Sí | — | — |
| Supervisión | editar (semáforo y dotación) | Sí | — | — | Sí | — | — |
| Supervisión | aprobar/cerrar (cierres y escalamientos) | Sí | — | — | Sí | — | — |
| Supervisión | exportar | Sí | — | — | — | — | — |
| Supervisión | configurar umbrales | — | — | — | — | — | — |
| Planificación/Calendario | ver | Sí | Sí | Sí | Sí | Sí | Sí |
| Planificación/Calendario | crear (fechas y horarios) | Sí | Sí | — | — | — | — |
| Planificación/Calendario | editar (reprogramar fechas) | Sí | Sí | — | — | — | — |
| Planificación/Calendario | aprobar/cerrar (resolver mantenciones) | Sí | — | — | — | — | Sí |
| Planificación/Calendario | exportar | Sí | Sí | — | — | — | — |
| Planificación/Calendario | configurar umbrales | — | — | — | — | — | — |
| Balance de líneas | ver | Sí | Sí | Sí | Sí | — | — |
| Balance de líneas | crear (escenarios de balance) | Sí | — | Sí | — | — | — |
| Balance de líneas | editar (BOM, rutas y análisis de balance) | Sí | — | Sí | — | — | — |
| Balance de líneas | aprobar/cerrar | — | — | — | — | — | — |
| Balance de líneas | exportar | Sí | — | Sí | — | — | — |
| Balance de líneas | configurar umbrales | — | — | — | — | — | — |
| Mantenimiento | ver | Sí | — | — | Sí | Sí | Sí |
| Mantenimiento | crear (reportar/escalar ticket) | Sí | — | — | Sí | Sí | Sí |
| Mantenimiento | editar (programar/reprogramar) | Sí | — | — | — | — | Sí |
| Mantenimiento | aprobar/cerrar (tomar y cerrar tickets) | Sí | — | — | — | — | Sí |
| Mantenimiento | exportar | Sí | — | — | — | — | Sí |
| Mantenimiento | configurar umbrales | — | — | — | — | — | — |
| Roles | ver | Sí | — | — | — | — | — |
| Roles | crear | Sí | — | — | — | — | — |
| Roles | editar | Sí | — | — | — | — | — |
| Roles | aprobar/cerrar (bajas y "Ver como") | Sí | — | — | — | — | — |
| Roles | exportar | Sí | — | — | — | — | — |
| Roles | configurar umbrales | Sí | — | — | — | — | — |

**Reglas de lectura**

- Solo Planificador y Jefa de Planta liberan, reprograman o cancelan órdenes; las demás cuentas no ven esos botones y el store rechaza la operación.
- Solo Encargado de Mantenimiento y Jefa de Planta toman, reprograman y cierran tickets; el Operador solo ve y reporta incidentes en Mantenimiento, sin editar ni cerrar.
- Ingeniero de Producción edita BOM, rutas y el análisis de balance. La aceptación de reasignaciones simuladas de US-11 sigue sin escribir en el store, aunque la acción de editar el análisis esté permitida.
- "Ver como" no amplía los permisos reales de la cuenta: la Jefa solo previsualiza y todas las mutaciones se validan también contra el rol autenticado.
- Estas reglas sustituyen la matriz simulada de US-08 descrita en el texto histórico de FR-09 y AC-07.

</details>


<details open>
<summary><strong>FR-23: Aplicación de permisos en la interfaz y en el store</strong></summary>

- La función de decisión de permisos recibe el rol resuelto en el login y el par (módulo, acción) de la matriz FR-22; ningún parámetro de rol proveniente de la URL, del hash, de un componente o del estado local puede sustituirlo.
- Toda mutación del store —alta/edición/baja de usuarios, cambio de contraseña, umbrales, BOM, rutas, órdenes, turnos, asignaciones, tickets, preventivas, fechas y resoluciones— comprueba el permiso **antes** de escribir, emitir `change` o persistir en `erp.manufacturing.v2`.
- Una acción denegada se oculta en la UI y, si se invoca directamente, devuelve `{ ok: false, reason: 'permission-denied' }` sin mutar el snapshot ni mostrar un éxito engañoso.
- Las exportaciones y la vista de Roles también consultan la matriz: no se genera archivo ni se abre página para roles sin permiso.
- "Ver como" solo está disponible para `plant_manager`; fija un rol previsualizado para renderizar, pero el store conserva el rol autenticado y aplica la intersección de permisos de ambos para cualquier mutación.

</details>


## Datos de demostración

Esta sección es la fuente única para reconstruir el dataset desde cero. Todos los valores son ficticios, deterministas y se calculan con fechas relativas al día actual. "Reiniciar datos de demo" reconstruye exactamente estos conteos sin huérfanos ni duplicados.

### Productos terminados y BOM

| # | Producto terminado | Profundidad de BOM | Cadena de ejemplo hasta el nivel 4 |
|---|---|---|---|
| 1 | Bicicleta Urbana 700c | 4 niveles | Bicicleta Urbana 700c → Cuadro Soldado → Tubo de acero cromoly → Hilo de soldadura |
| 2 | Bicicleta Cargo 700c | 4 niveles | Bicicleta Cargo 700c → Cuadro Soldado → Maza de eje → Freno de disco |
| 3 | Cuadro Soldado | 3 niveles | Cuadro Soldado → Tubo de acero cromoly → Hilo de soldadura |
| 4 | Rueda Armada | 3 niveles | Rueda Armada → Llanta 700c → Juego de rayos |

### Centros de trabajo

| # | Centro | `station_type` | Estado inicial |
|---|---|---|---|
| 1 | Corte | `corte` | `available` |
| 2 | Soldadura 1 | `soldadura` | `in_operation` |
| 3 | Soldadura 2 | `soldadura` | `available` |
| 4 | Pintura | `pintura` | `fault` |
| 5 | Armado | `armado` | `in_operation` |
| 6 | Calidad | `calidad` | `available` |
| 7 | Laminado | `corte` | `available` |
| 8 | Ensamble Eléctrico | `armado` | `in_operation` |
| 9 | Pulido | `pintura` | `available` |
| 10 | Horno de Curado | `calidad` | `inactive` (no admite programación nueva) |

### Órdenes de producción (40)

Las fechas se reparten en el mes anterior (`relativeMonth(-1)`), el mes actual (`relativeMonth(0)`) y el mes siguiente (`relativeMonth(+1)`). La columna "Sin fechas" identifica las órdenes listas para la bandeja "Pendiente de horario".

| Estado | Mes anterior | Mes actual | Mes siguiente | Total | Sin fechas |
|---|---:|---:|---:|---:|---:|
| `planned` | 0 | 4 | 8 | 12 | 4 |
| `released` | 0 | 4 | 2 | 6 | 0 |
| `in_progress` | 0 | 6 | 0 | 6 | 0 |
| `completed` | 8 | 6 | 0 | 14 | 0 |
| `cancelled` | 2 | 0 | 0 | 2 | 0 |
| **Total** | **10** | **20** | **10** | **40** | **4** |

### Turnos, atrasos y mantenimiento

| Conjunto | Conteo | Distribución obligatoria |
|---|---:|---|
| Turnos pendientes de validar | 5 | `production_shifts.status = completed`, `supervisor_validated = false`, con resumen de piezas/merma/atrasos |
| Turnos validados | 2 | `supervisor_validated = true` con `validated_by`, `validated_at` y nota |
| Atrasos abiertos | 3 | `operation_delays.status = open`, uno con `escalated_to_maint = true` y ticket `urgent` vinculado |
| Atrasos cerrados | 8 | `status = closed`, con `ended_at`, `duration_minutes` y motivo activo |
| Tickets correctivos | 15 | 5 `open`, 5 `in_progress`, 5 `resolved`; 5 `urgent`, 5 `high`, 5 `normal` |
| Tickets programados en el mes actual | 3 | Al menos 2 activos con rango `relativeDay(0)` a `relativeDay(+10)`, visibles en calendario y "Mantenimientos activos" |
| Órdenes preventivas | 5 | 1 vencida sin resolver, 2 vigentes (`relativeDay(+2)` a `relativeDay(+8)`), 1 `in_progress`, 1 `completed` |
| Empleados de RR.HH. | 12 | 6 operadores, 3 técnicos, 1 supervisora, 1 planificador y 1 jefa de planta; nombres únicos de la sección FR-21 |

### Dataset de volumen (SC-07)

| Atributo | Valor |
|---|---|
| Nombre del conjunto | `demo-volume-500` |
| Órdenes | 500 deterministas, con BOM de 4 niveles y operaciones congeladas |
| Reparto por estado | 125 `completed`, 100 `in_progress`, 100 `released`, 125 `planned`, 50 `cancelled` |
| Reparto temporal | 150 en el mes anterior, 200 en el actual y 150 en el siguiente |
| Carga | No se instala en el arranque ni en "Reiniciar datos de demo"; se genera de forma explícita para la prueba de rendimiento de SC-07 |
| Resultado verificable | Cada interacción de panel responda en < 100 ms con este dataset y BOM de 4 niveles |

---

## 5. Criterios de Aceptación

| ID | Historia | Criterio | Estado |
|---|---|---|---|
| AC-01 | US-01 | Árbol BOM multi-nivel con ≥4 niveles y ciclo detectado | Implementado |
| AC-02 | US-02 | Ruta con secuencia estrictamente creciente y tiempo estándar calculado | Implementado |
| AC-03 | US-03 | Liberación congela BOM/ruta y genera operaciones; MTO/stock soportado | Implementado |
| AC-04 | US-08 | Tablero de carga por centro con OEE (Disponibilidad × Rendimiento × Calidad) y paradas acumuladas por período, derivados y no persistidos | Verificado |
| AC-05 | US-08 | Umbrales de alarma configurables, persistidos en el snapshot y evaluados de inmediato | Verificado |
| AC-06 | US-08 | Reprogramación de prioridad y cancelación con confirmación, conservando registros de ejecución | Verificado |
| AC-07 | US-08 / FR-22 | Exportación del reporte consolidado a PDF y Excel (sin dependencias externas) solo para los roles autorizados; permisos por acción derivados exclusivamente del rol del login | Pendiente |
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
| AC-34 | FR-13 / FR-23 | El rol del login filtra navegación y módulos por rol, incluido Supervisor, con denegación por URL y rechazo en el store; el rol no se puede cambiar desde la interfaz | Pendiente |
| AC-35 | FR-13 | El hash mantiene el módulo activo y responde a enlaces profundos y navegación atrás | Verificado |
| AC-36 | FR-13 | El panel inicial muestra actividad simulada y la etiqueta Operador de forma consistente, sin sección de accesos rápidos | Verificado |
| AC-37 | US-11 | El panel muestra tiempos estándar por operación y totales por ruta (`setup + run × cantidad`) sin mutar rutas ni operaciones | Verificado |
| AC-39 | US-11 | La carga y la utilización se calculan para el período contra días hábiles × `capacity_per_day_minutes` × `efficiency_factor`; el estado es Normal (< 75 %) en verde, Ajustada (75 % a < 95 %) en ámbar o Cuello crítico (≥ 95 %) en rojo. La alerta superior se activa solo si algún centro alcanza el 95 %; si no, se muestra “Línea balanceada · Sin cuellos de botella críticos”. El cuello se desempata por mayor utilización, mayor carga y luego identificador | Verificado |
| AC-40 | US-11 | Solo con cuello crítico se muestran propuestas de reasignación entre estaciones del mismo `station_type` o de revisión de secuencia; la aceptación explícita marca la fila como `Solicitud simulada`, sin registro en store, persistencia ni mutación de rutas, operaciones o asignaciones | Verificado |
| AC-41 | FR-13 | El ingreso es genérico, valida las credenciales de FR-13 y la única página "Roles" (`#/roles`) es visible solo para la Jefa de Planta; no existen "Datos de roles" ni `#/admin-roles` independientes | Pendiente |
| AC-42 | FR-03 | El tablero permite arrastrar órdenes solo a estados siguientes válidos, sin mutar ante saltos inválidos | Verificado |
| AC-43 | FR-07 | El acumulado de Estación se rechaza cuando supera la cantidad planificada, sin mutar turno ni operación | Verificado |
| AC-44 | FR-01 a FR-13 | Los campos numéricos aceptan punto o coma decimal y hasta dos decimales, sin flechas de precisión y con errores inline para valores inválidos | Verificado |
| AC-45 | US-11 | Al activar una fila de “Carga por centro” se abre un popover compacto centrado sobre esa sección, sin salirse del viewport, con las órdenes de la estación, la carga en el centro y la participación por orden; se cierra con botón, Escape, clic fuera o nueva activación, y no existe la sección “Órdenes por centro” | Verificado |
| AC-46 | FR-06 / US-11 | En “Utilización por Centro de Trabajo” del Panel de Producción, activar un centro abre una ventana con sus operaciones pendientes, orden, secuencia, estado y minutos; en “Carga por centro” los días hábiles van entre paréntesis en el título del período y la columna “Utilización del día” repite el valor diario del panel, sin columna de días | Verificado |

| AC-47 | US-12 | Seis roles canónicos (`plant_manager`, `planner`, `production_engineer`, `supervisor`, `operator`, `maintenance`), una cuenta por rol según la tabla literal de FR-13 y sin cuentas `usuario`, `test` ni `doble` | Pendiente |
| AC-48 | US-12 | Las tablas `role_users_plant_manager`, `role_users_planner`, `role_users_production_engineer`, `role_users_supervisor`, `role_users_operator` y `role_users_maintenance` persisten en `erp.manufacturing.v2`, sobreviven al logout y se restauran con `resetDemoData` | Pendiente |
| AC-49 | US-12 | El login resuelve el único rol de la cuenta y no hay controles de cambio de rol en la cabecera ni en paneles; solo la Jefa de Planta ve "Ver como" en el menú de usuario y la previsualización no cambia la identidad ni las credenciales | Pendiente |
| AC-50 | US-12 | La única página `#/roles`, exclusiva de `plant_manager`, integra `RoleAdminPanel.js` con las seis tablas; agregar usuarios o roles adicionales persiste de inmediato y notifica con `showToast`; `#/admin-roles` redirige a `#/roles` solo para la Jefa | Pendiente |
| AC-51 | US-12 | `MODULE_ACCESS` quita `orders` a supervisor; `production_engineer` accede a BOM, balance y panel solo lectura; operator queda exactamente con `['operator', 'scheduling']` y en scheduling solo ve el Calendario sin "Listado"; maintenance queda exactamente con `['maintenance', 'scheduling']`; solo `plant_manager` ve Roles; los IDs de ruta no cambian | Pendiente |
| AC-52 | US-12 | Nombres reales de `hr_employees` solo para supervisor y plant_manager (anonimizados o conteo para el resto); el técnico de una mantención en el calendario solo se nombra para plant_manager y maintenance, otros roles ven máquina y duración | Verificado |
| AC-53 | US-13 | Calendario Mensual en Vanilla JS + CSS Grid sin librerías externas; abre en el mes actual, recuerda el último mes entre cambios de pestaña y vuelve al mes actual al cambiar de usuario/rol, cerrar sesión o recargar | Verificado |
| AC-54 | US-13 | Filtro "Ambos" por defecto, "Solo Órdenes de Trabajo" y "Solo Mantenciones", incluyendo tickets programados y órdenes preventivas | Verificado |
| AC-55 | US-13 | Bandeja "Pendiente de horario" solo para planner y plant_manager, ordenada por prioridad/urgencia crítica con % de avance; solo plant_manager cambia prioridad y marca "Urgencia crítica" (`is_critical_urgent` / `priority urgent`) | Verificado |
| AC-56 | US-13 | En planner, un clic izquierdo simple en una orden pendiente activa el modo foco con `.scheduling-focus-backdrop`, `.scheduling-floating-card` siguiendo al cursor y aviso bajo la cuadrícula de que clic derecho sale del modo | Verificado |
| AC-57 | US-13 | `mousedown` en un día y arrastre con `mouseenter`/`mouseover` colorea en vivo las celdas `.calendar-day--drag-range`; `mouseup` cierra el modo y abre el popup con "08:00" a "16:00" editables; `contextmenu` llama `preventDefault()` y cancela sin popup | Verificado |
| AC-58 | US-13 | Para planner, plant_manager y supervisor, clic en un día abre un menú de órdenes y mantenciones; elegir una tarea oculta las demás y muestra solo su detalle en `CalendarEventDialog.js` con "Volver a la lista del día" | Verificado |
| AC-59 | US-13 | Solo planner y plant_manager modifican fechas/horarios de órdenes; supervisor no tiene inputs de fecha/hora ni botones de guardar y sus eventos tienen `draggable="false"` | Verificado |
| AC-60 | US-13 | Plant_manager ve indicadores compactos de color por día y resumen ejecutivo de productos, meta de producción, máquinas activas/inactivas y cantidad de operadores | Verificado |
| AC-61 | US-13 | Supervisor ve nombres reales con la etiqueta SC-08 "solo contexto operativo — no evaluación de desempeño", alerta de órdenes sin operador asignado y mantenciones como resumen de solo lectura | Verificado |
| AC-62 | US-13 | Operator ve únicamente sus órdenes asignadas y las mantenciones en solo lectura | Verificado |
| AC-63 | US-14 | Estación = máquina (`work_center`) sin subdivisión; `deriveBomStations` precarga estaciones y secuencia desde la receta/ruta del BOM de cada orden, conservando la integración con `capacity.js` | Verificado |
| AC-64 | US-14 | El detalle diario de orden muestra estaciones con etiqueta "Secuencia <N>", título explicativo, sin doble numeración "1., 2., 3." en la misma fila, junto a la cantidad de trabajadores asignados | Verificado |
| AC-65 | US-14 | "Editar estaciones y trabajadores" solo para supervisor y plant_manager; redirige a `#/supervision`, abre la edición de esa orden en `SupervisorLinePanel.js` y persiste altas/bajas de operadores y estaciones en `erp.manufacturing.v2` | Verificado |
| AC-66 | US-14 | `#/orders` sigue dedicado a crear y gestionar órdenes, conserva buscador y filtro de prioridad y no contiene controles de estaciones/operadores | Verificado |
| AC-67 | US-15 | `MaintenancePanel.js` muestra exactamente las subpestañas "Máquinas", "Tickets" y "Mantenimientos" | Verificado |
| AC-68 | US-15 | En Máquinas: buscador por nombre, filtro por sección, alerta superior de máquinas sin preventiva o con frecuencia superada, campo "Cada cuánto se recomienda mantención" editable solo por maintenance y plant_manager, badge "Frenada por mantención"/"Disponible"/"En operación", historial de fallas, paradas acumuladas, `deriveWearIndicator`, "Programar preventiva" y "Revisar históricas" que enfoca el histórico y prellena su buscador con la máquina elegida | Verificado |
| AC-69 | US-15 | En Tickets solo aparece la tabla de tickets, sin banner duplicado, panel lateral ni tabla de preventivas; "Programar mantención" abre un modal de técnico, inicio y plazo (`scheduled_start_date`/`scheduled_end_date`), pasa ticket a `in_progress` y máquina a `fault`, y aparece de inmediato en el calendario y en "Mantenimientos activos" | Verificado |
| AC-70 | US-15 | Al hacer clic en un ticket se despliega debajo un recuadro con detalle del ticket, historial de fallas, historial completo de mantenciones e indicador `deriveWearIndicator` con nivel Bajo/Medio/Alto, conteo de fallas y minutos acumulados | Verificado |
| AC-71 | US-15 | Mantenimientos refleja el 100 % de las mantenciones del calendario en tres bloques con buscador propio por máquina o código: activos (Resolver), no resueltos por vencimiento (Resolver) e históricos (Eliminar confirmado con `ConfirmDialog.js`, borrando registro de `erp.manufacturing.v2` y del calendario) | Verificado |
| AC-72 | US-15 | Resolver una correctiva calcula automáticamente la parada real entre inicio de intervención y resolución sin ingreso manual; una preventiva nunca se resuelve sola al vencer el plazo, solo con "Resolver" | Verificado |
| AC-73 | US-15 | Una mantención activa vencida extiende su fecha final visible hasta hoy; si se resuelve antes del plazo, la fecha final se acorta a la resolución real | Verificado |
| AC-74 | US-15 | Una mantención resuelta no se puede resolver ni editar en ninguna vista; la corrección exige eliminarla en Históricos y crearla de nuevo | Verificado |
| AC-75 | US-15 | En el calendario solo maintenance tiene "Resolver" (sin bandeja manual); al seleccionar una activa ve tiempo parado, técnico y prioridad; el popup "¿Está seguro que quiere resolver esta mantención?" trae fecha/hora editable prellenada con la hora ACTUAL del sistema al hacer clic, no la de la celda; una resuelta se abre en solo lectura sin el botón | Verificado |
| AC-76 | FR-18 | Permanecen intactas las mejoras de main (tipografía `@fontsource-variable/inter`, `icons.js`, `ConfirmDialog.js`, `Toast.js`, `labels.js`, `demo-dates.js`, `capacity.js`, US-11, menú drawer, "Reiniciar datos de demo" y `vitest.config.mjs`), los IDs de ruta existentes, el nombre del paquete, la ausencia de dependencias externas nuevas y la ausencia de elementos de `001-erp-base-module` en `index.html` | Verificado |
| AC-77 | FR-19 | La escala de capas es estricta: encabezados sticky de tabla en `z-index: 1`, barra superior/lateral en 20–30, modo foco del calendario en 40–60, backdrop y modales normales en 1000–1001, `ConfirmDialog` en 1100 y toasts en 1200 | Verificado |
| AC-78 | FR-19 | Ningún encabezado fijo de tabla, barra lateral ni barra superior se superpone sobre modales, popups, diálogos de confirmación ni toasts, y ninguna animación/transformación de `.view`, `.content` o `.panel` deja un modal por debajo de una tabla | Verificado |
| AC-79 | US-13 | "Calendario" y "Listado" se presentan como pestañas integradas del mismo sistema visual que las subpestañas de Mantenimiento, sin apariencia de botón nativo; `operator` solo ve "Calendario" | Verificado |
| AC-80 | US-13 | La cuadrícula mensual ocupa el 100 % del ancho disponible con siete columnas proporcionadas (`repeat(7, minmax(0, 1fr))`) y muestra el título legible de cada evento en lugar de íconos comprimidos | Verificado |
| AC-81 | US-13 | Cada día muestra como máximo tres eventos legibles y un indicador compacto "+N más" cuando hay más actividades; el menú del día enumera todas las órdenes y mantenciones de esa fecha | Verificado |
| AC-82 | FR-13 | No existe el botón "Datos de roles"; el acceso lateral "Roles" (`#/roles`) aparece únicamente para la Jefa de Planta y se deniega por URL a los demás roles | Pendiente |
| AC-83 | US-12 | `#/roles` es una única página visible solo para la Jefa, con las seis tarjetas de rol y la configuración integrada, con el lenguaje visual de las subpestañas de Mantenimiento | Pendiente |
| AC-84 | US-12 | La Jefa ve las seis tarjetas de rol en `#/roles`; ningún otro rol ve la página ni tarjetas, y las cuentas demo tienen un solo rol asignado | Pendiente |
| AC-85 | US-12 | "Ver como" solo aparece en el menú de usuario de la Jefa; al elegir otro rol abre `ConfirmDialog.js` con "¿Deseas ver la aplicación como <Nombre del rol>?", aplica la vista tras confirmar y "Volver a mi rol" restaura `plant_manager` sin cambiar credenciales | Pendiente |
| AC-86 | US-12 | La configuración dentro de `#/roles` solo está disponible para la cuenta `plant_manager` e integra las seis tablas por rol, el alta de usuarios y la asignación de roles con persistencia inmediata en `erp.manufacturing.v2` y `showToast`; otros roles no pueden acceder | Pendiente |
| AC-87 | FR-13 / US-12 | Al abrir `#/admin-roles` siendo `plant_manager`, se redirige a `#/roles`; para cualquier otro rol se deniega y se redirige a su módulo de inicio | Pendiente |
| AC-88 | US-12 | Cada chip de usuario de las seis tablas de la configuración de Roles incluye "Quitar" (×); tras confirmar se ejecuta `store.removeRoleUser(role, username)`, se persiste y se actualizan tabla y tarjetas; cancelar no muta nada y quitar al último `plant_manager` se rechaza con mensaje | Pendiente |
| AC-89 | US-12 | Las cuentas nuevas creadas desde "Configurar roles" conservan la contraseña inicial igual al nombre de usuario | Verificado |
| AC-90 | US-12 | "Cambiar contraseña" está disponible para cualquier usuario autenticado en el menú superior; el modal solicita contraseña actual, nueva y confirmación, valida la actual y la coincidencia, actualiza la credencial en las tablas donde figure el usuario, persiste en `erp.manufacturing.v2` y es aceptada por `authenticate` tras logout y recarga | Pendiente |
| AC-91 | US-13 | La bandeja "Pendiente de horario" es una barra horizontal compacta arriba del calendario, `.calendar-layout` usa una sola columna `minmax(0, 1fr)` y `.calendar-main` ocupa el 100 % del ancho útil en los seis roles, con celdas cómodas y proporcionadas en pantalla estándar | Verificado |
| AC-92 | US-13 | Menú diario, detalle de evento y popup de horario se muestran siempre como ventanas centradas sobre la pantalla con `.modal-backdrop` en 1000 y `.modal` en 1001, sin renderizado incrustado bajo el calendario, y se cierran con botón, Escape y clic fuera | Verificado |
| AC-93 | US-13 | En planner, un clic izquierdo en cualquier zona de `.pending-tray__row` activa el modo selección, mientras que en plant_manager los `select` y `checkbox` de la fila siguen operando sin interferencias | Verificado |
| AC-94 | US-13 | Con el modo selección activo, `.scheduling-focus-backdrop` está en 40, solo el bloque del calendario se eleva a 50 con fondo blanco y permanece iluminado, y `.scheduling-floating-card` se sitúa en 60 | Verificado |
| AC-95 | US-13 | Las celdas `.calendar-day` tienen `draggable="false"`, `mousedown` llama `preventDefault()` y `.calendar-grid` aplica `user-select: none` en el modo selección; al arrastrar desde el día inicio se colorea el rango completo en tiempo real y al soltar en cualquier lugar del documento se desactiva el modo y se abre de inmediato el modal centrado con el rango exacto (por ejemplo 24–28) y horas "08:00"–"16:00" editables, sin clics adicionales | Verificado |
| AC-96 | US-15 | No existen los filtros globales superiores Estado, Prioridad y Centro (`.maintenance-filters` del header) en MaintenancePanel.js | Verificado |
| AC-97 | US-15 | La subpestaña Máquinas muestra dos paneles lado a lado sin paneles inferiores sueltos ni `fault-banner` duplicado: lista izquierda más ancha al inicio con buscador por nombre/código, filtro por sección y filtro por estado ("Todos", "Disponible", "En operación", "En mantención", "Detenida / En fallo") junto a la alerta de frecuencia, y panel derecho inicialmente vacío; al seleccionar se transiciona suavemente a `0.85fr 1.15fr` | Verificado |
| AC-98 | US-15 | El detalle de la máquina seleccionada consolida estado operativo, campo editable "Cada cuánto se recomienda mantención", desgaste (`deriveWearIndicator`), historial de fallas, "Programar preventiva", "Revisar históricas" y "Deseleccionar" (×) | Verificado |
| AC-99 | US-15 | "Deseleccionar" y un clic fuera de los recuadros de lista y detalle deseleccionan la máquina, restauran los tamaños iniciales y vacían el panel derecho; los clics en modales y en la navegación ‹ › del mini-calendario no deseleccionan | Verificado |
| AC-100 | US-15 | Con una máquina seleccionada aparece debajo de ambos paneles un mini-calendario mensual matricial compacto con encabezado de mes, botones ‹ › como única interacción, días L, Ma, Mi, J, V, S, D, celdas no clickeables y leyenda visible de sin plan (sin color), correctiva/fallo (rojo), orden de trabajo que pasa por la máquina/estación (azul) y preventiva planificada (morado) | Verificado |
| AC-101 | US-15 | En Tickets no aparecen "Resolver" ni "Tomar intervención" en la tabla ni en el detalle; solo quedan la tabla con buscador, el detalle consolidado desplegable al hacer clic en un ticket y "Programar mantención" para pasar la intervención al calendario y a Mantenimientos activos | Verificado |
| AC-102 | US-15 | Mantenimientos tiene exactamente dos listas con buscador propio: "Mantenimientos activos" reúne vigentes y vencidas con filtro "Todos"/"Vigentes"/"Vencidos" y botón "Resolver", y "Mantenimientos históricos" lista las resueltas con "Eliminar" confirmado por `ConfirmDialog.js` y buscador prellenado con el nombre de la máquina al llegar desde "Revisar históricas" | Verificado |
| AC-103 | FR-18 | Las Fases 1 a 29 de `tasks.md`, las secciones 1 a 10 de `plan.md` y las mejoras presentes en `main` permanecen intactas tras la ampliación de US-12, US-13 y US-15 | Verificado |
| AC-104 | FR-20.1 / US-15 | Las filas de máquinas de la subpestaña Máquinas oscurecen ligeramente el fondo con transición suave y muestran `cursor: pointer` al pasar el puntero sobre toda la fila, sin seleccionar ni mutar datos con el solo hover | Verificado |
| AC-105 | FR-20.1 / US-13 | Las tarjetas de órdenes pendientes de horario tienen hitbox completa, borde y esquinas redondeadas, y oscurecen el fondo con transición suave y cursor de mano al pasar el puntero | Verificado |
| AC-106 | FR-20.1 / US-13 | Los ítems del menú diario del calendario muestran el mismo efecto hover de oscurecimiento suave, transición y cursor de mano en toda el área del ítem | Verificado |
| AC-107 | FR-20.1 / US-12 / US-15 | Las tarjetas de roles y las filas seleccionables de tickets presentan el mismo hover de oscurecimiento ligero, transición suave y cursor de mano, sin duplicar estilos inconsistentes entre paneles | Verificado |
| AC-108 | FR-20.2 / US-15 | Al abrir Mantenimiento las subpestañas aparecen exactamente en el orden "Mantenimientos", "Máquinas" y "Tickets", y "Mantenimientos" es la activa por defecto | Verificado |
| AC-109 | FR-20.3 / US-15 | La lista izquierda de Máquinas muestra solo bloques por fila con "Nombre de la máquina · CT-CÓDIGO" en horizontal, sin columnas de Sección, Estado, Frecuencia ni Desgaste; toda esa información detallada y las acciones "Programar preventiva", "Revisar históricas" y "Deseleccionar" aparecen únicamente en el panel derecho tras seleccionar la máquina | Verificado |
| AC-110 | FR-20.4 / US-15 | Con una máquina seleccionada, el mini-calendario tiene un ancho máximo de 520 px dentro del rango 460–560 px, conserva su altura actual y sitúa la leyenda de colores arriba o al costado, nunca debajo, sin exigir scroll adicional | Verificado |
| AC-111 | FR-20.4 / US-15 | Cada día del mini-calendario es un rectángulo independiente con `border-radius: 8px`, separación por `gap` y proporción aproximada 2.5:1, sin aspecto de tabla/Excel; los colores sin plan, rojo, azul y morado conservan su significado y solo ‹ y › son interactivos | Verificado |
| AC-112 | FR-20.5 / US-13 / US-15 | Con el rol activo `maintenance` en `#/scheduling`, la subpestaña "Listado" muestra el mismo listado "Mantenimientos activos" que la subpestaña Mantenimientos, con activas y vencidas sin resolver, buscador por máquina/código, filtro Todos/Vigentes/Vencidos y "Resolver", y no muestra órdenes de producción | Verificado |
| AC-113 | FR-20.6 / US-13 | Para `planner` y `plant_manager`, `.calendar-layout--with-tray` dispone el calendario y la bandeja "Pendiente de horario" en columnas `minmax(0, 1fr) 280px` con la bandeja vertical a la derecha; para `maintenance`, `operator` y `supervisor`, sin bandeja, el calendario usa `1fr` y conserva el 100 % del ancho útil | Verificado |
| AC-114 | FR-20.1 / FR-20.6 / US-13 | Cada orden pendiente se presenta como una tarjeta rectangular delimitada por borde y esquinas redondeadas, con hover de oscurecimiento en toda la tarjeta, sin perder el clic de `planner` para el modo foco ni los `select` y `checkbox` de `plant_manager` | Verificado |
| AC-115 | FR-20.7 / US-13 | En `CalendarEventDialog.js` y en el menú diario no existe el botón ni el texto "Volver a la lista del día"; el único cierre visible es "×" en la esquina superior derecha, y al presionarlo se limpian `selectedEventId` y `dayMenuDate` y se cierra el backdrop, igual que Escape y el clic fuera | Verificado |
| AC-116 | FR-20.8 / US-13 | En el resumen al presionar un día del calendario, tanto en el menú diario como en el detalle de orden, el rol `supervisor` dispone de un botón "Ir a Supervisión de línea" que lleva directamente a `#/supervision` en una sola acción | Verificado |
| AC-117 | FR-20.9 / US-12 | En "Agregar usuario" existe un botón cuadrado "+" a la derecha del desplegable "Rol" que agrega "Rol 2", "Rol 3" y así sucesivamente hasta seis; al llegar a seis se deshabilita u oculta y las filas extra pueden quitarse, dejando siempre al menos un desplegable | Pendiente |
| AC-118 | FR-20.9 / US-12 | Al enviar "Agregar", el usuario se crea con contraseña igual a su nombre de usuario, se inscribe en las tablas de los roles elegidos sin duplicados aunque se repita un rol, se persiste en `erp.manufacturing.v2`, se muestra un toast de confirmación y el formulario vuelve a un solo desplegable de rol | Pendiente |
| AC-119 | FR-20 / FR-18 | Las mejoras presentes en `main` y las Fases 1 a 30 de `tasks.md` permanecen intactas; AC-01 a AC-103 conservan su texto histórico y los cambios de esta ampliación se documentan solo en AC-104 a AC-118 y sus requisitos asociados | Verificado |
| AC-120 | FR-21 / Datos de demostración | El primer arranque y "Reiniciar datos de demo" cargan "Acero del Biobío S.A.", 3 bodegas, 4 UoM, al menos 13 productos (4 bienes terminados, 6 componentes/subensambles y 3 materias primas), 4 BOM de hasta 4 niveles sin ciclos y 3 pedidos de venta MTO/stock con fechas relativas | Pendiente |
| AC-121 | FR-21 / Datos de demostración | Los 10 centros de trabajo incluyen uno inactivo, `station_type` variado y estados operativos `available`, `in_operation` y `fault` visibles desde el inicio; el centro inactivo no admite programación nueva | Pendiente |
| AC-122 | FR-21 / Datos de demostración | RR.HH. expone 12 trabajadores con nombres ficticios únicos y la distribución exacta de 6 operadores, 3 técnicos, 1 supervisora, 1 planificador y 1 jefa de planta, sin nombres genéricos repetidos | Pendiente |
| AC-123 | FR-21 / Datos de demostración | 40 órdenes se reparten en los meses anterior, actual y siguiente y en los cinco estados según la tabla de Datos de demostración, con 4 abiertas sin fechas para la bandeja y operaciones congeladas en liberadas/en progreso | Pendiente |
| AC-124 | FR-21 / Datos de demostración | Hay 5 turnos pendientes de validar, 2 validados, 3 atrasos abiertos (uno escalado) y 8 cerrados, con marcas y motivos persistidos | Pendiente |
| AC-125 | FR-21 / Datos de demostración | 15 tickets cubren exactamente 5 `open`, 5 `in_progress`, 5 `resolved` y 5 `urgent`, 5 `high`, 5 `normal`, con al menos 2 activos programados en el mes actual y visibles en Calendario y "Mantenimientos activos" | Pendiente |
| AC-126 | FR-21 / Datos de demostración | Hay 5 preventivas (1 vencida, 2 vigentes, 1 en curso, 1 completada) y las 6 cuentas demo de FR-13 están cada una en su única tabla de rol; "Reiniciar datos de demo" reconstruye todo el dataset y recalcula fechas relativas sin huérfanos ni duplicados | Pendiente |
| AC-127 | FR-14 | Los seis roles canónicos coinciden con las Personas: Jefa de Planta (`plant_manager`, admin), Planificador, Ingeniero de Producción (`production_engineer`), Supervisor de Línea, Operador y Encargado de Mantenimiento; la etiqueta visible canónica es "Operador" en toda la UI | Pendiente |
| AC-128 | FR-13 | La tabla de cuentas tiene exactamente una cuenta por rol con usuario, contraseña, nombre de persona ficticia distintivo y módulo de inicio; esas credenciales aparecen literalmente en el README y no existen `usuario`, `test` ni `doble` | Pendiente |
| AC-129 | FR-22 | La matriz por módulo y acción (ver, crear, editar, aprobar/cerrar, exportar, configurar umbrales) se cumple para los seis roles: Operador solo ve y reporta incidentes en Mantenimiento; solo Encargado y Jefa toman/cierran tickets; solo Planificador y Jefa liberan, reprograman o cancelan órdenes; Ingeniero edita BOM, rutas y balance | Pendiente |
| AC-130 | FR-23 | Las acciones no permitidas se ocultan y cualquier intento directo, por URL o contra el store, devuelve `permission-denied` sin mutar ni persistir; umbrales, exportaciones y administración también respetan la matriz | Pendiente |
| AC-131 | FR-13 / FR-14 | El rol proviene solo del login en FR-09, AC-07, AC-34 y en cualquier otro panel; no existen controles de cambio de rol y solo la Jefa de Planta ve "Ver como" en el menú de usuario, conservando su identidad autenticada | Pendiente |
| AC-132 | FR-13 / FR-14 | "Roles" y "Datos de roles" están fusionados en una única página `#/roles` visible solo para la Jefa de Planta; los demás roles son redirigidos y `#/admin-roles` no es una vista independiente | Pendiente |
| AC-133 | Datos de demostración | El dataset semilla contiene 4 productos terminados con BOM de hasta 4 niveles, 10 centros de trabajo con uno desactivado y 40 órdenes repartidas en todos los estados y en los meses anterior, actual y siguiente | Pendiente |
| AC-134 | Datos de demostración | El dataset semilla contiene turnos pendientes de validar y validados, atrasos abiertos y cerrados, 15 tickets en todos los estados y prioridades, 5 órdenes preventivas y 12 empleados de RR.HH. con nombres variados y únicos | Pendiente |
| AC-135 | Datos de demostración / SC-07 | El conjunto `demo-volume-500` de 500 órdenes con BOM de 4 niveles se puede generar explícitamente y sostiene respuestas de panel inferiores a 100 ms sin instalarse en el arranque | Pendiente |
| AC-136 | FR-18 / Alcance | No se implementan Entidades, Documentos, pestañas ni campos personalizados del template 001, y no aparecen sus botones, archivos ni navegación en el MVP | Pendiente |

> **Nota de numeración**: los IDs AC son anclas históricas estables; no se renombran al añadir historias. La columna "Historia" disambigúa los rangos: AC-04..AC-07 y AC-20 pertenecen a US-08, AC-08..AC-14 a la base US-01..US-05/FR-06, y AC-37, AC-39, AC-40 y AC-45 a US-11; AC-46 cubre la utilización diaria compartida entre FR-06 y US-11. AC-38 fue retirado y su cobertura de carga/utilización se integró en AC-39. No existen IDs duplicados ni un mismo criterio asignado a dos historias.
>
> **Rangos añadidos**: AC-47..AC-52 corresponden a US-12, AC-53..AC-62 a US-13, AC-63..AC-66 a US-14, AC-67..AC-75 a US-15 y AC-76 a FR-18. La ampliación de interfaz y navegación incorpora AC-77..AC-78 (FR-19), AC-79..AC-81 (US-13) y AC-82..AC-87 (FR-13 / US-12). La ampliación de 2026-11-23 incorpora AC-88..AC-90 (US-12), AC-91..AC-95 (US-13), AC-96..AC-102 (US-15) y AC-103 (FR-18). AC-01..AC-87 se mantienen textualmente intactos.
>
> **Supersedencia de navegación**: la entrada lateral "Datos de roles" y la vista independiente `#/admin-roles` descritas en FR-13 y AC-41 quedan sustituidas en navegación por AC-82, AC-86 y AC-87; la restricción de acceso exclusivo a Jefa de Planta se conserva y se refuerza con AC-86.
>
> **Supersedencia de la ampliación**: AC-88..AC-90 precisan la administración de cuentas de AC-50 y AC-86; AC-91..AC-95 refinan la distribución y el modo selección de AC-56, AC-57, AC-77, AC-80 y AC-81; AC-92 sustituye cualquier renderizado incrustado de ventanas del calendario; AC-96..AC-102 sustituyen los filtros globales, la vista de tres bloques de AC-71 (y la referencia a "tres bloques" de SC-11, que se interpreta como las dos listas de AC-102) y las acciones de tickets descritas en AC-69/AC-70, conservando la sincronización con el calendario y la inmutabilidad de AC-72..AC-75. AC-103 garantiza que ninguna de estas precisiones altera las Fases 1 a 29 ni las mejoras de `main`.
>
> **Rangos añadidos (2026-11-24)**: AC-104 a AC-107 corresponden al hover global de FR-20.1; AC-108 a AC-111 a US-15; AC-112 a AC-114 a US-13/US-15; AC-115 y AC-116 al cierre de ventanas y al acceso de supervisor; AC-117 y AC-118 a US-12; y AC-119 a FR-18.
>
> **Rangos añadidos por la consolidación (2026-11-24)**: AC-120 a AC-126 corresponden a FR-21/US-16 (dataset semilla). AC-47 a AC-119 fueron **Verificado** tras la ejecución de 297 pruebas en su redacción de 2026-11-24; los AC reformulados el 2026-11-26 vuelven a **Pendiente** y AC-120 a AC-126 permanecen **Pendiente**. Ningún ID histórico AC-01 a AC-119 se renombra, reordena ni elimina.
>
> **Supersedencia de la ampliación de 2026-11-24**: AC-108 reordena las subpestañas descritas en AC-67; AC-109 y AC-110/AC-111 refinan la lista y el mini-calendario de AC-97 y AC-100; AC-112 precisa el contenido del "Listado" para `maintenance` sin modificar AC-51; AC-113 sustituye la bandeja horizontal de AC-91 y ajusta la distribución de AC-55, AC-93 y AC-95, conservando sus garantías funcionales; AC-115 retira el botón "Volver a la lista del día" citado en AC-58 y precisa AC-92; AC-117 y AC-118 amplían AC-50, AC-86 y AC-89; y AC-119 extiende la protección de AC-103 a las Fases 1 a 30. AC-01 a AC-103 se mantienen textualmente intactos en su redacción de 2026-11-24, salvo las reformulaciones de roles y permisos del 2026-11-26.
>
> **Vigencia 2026-11-26**: las notas históricas que mencionan cinco roles, cuentas multicrol, cambio de rol desde la interfaz, subpestañas de Roles o `#/admin-roles` como destino independiente quedan supersedidas por FR-13, FR-14, FR-22, FR-23, la sección **Datos de demostración** y AC-82 a AC-90, AC-117, AC-118 y AC-127 a AC-136. Los IDs se conservan; el texto vigente es el de la tabla de AC y no el de esas notas.

## 6. Entidades Clave

- **BillOfMaterials / BomComponent**: estructura multi-nivel que define el consumo teórico por unidad.
- **WorkCenter / Routing / RoutingOperation**: capacidad, secuencia y tiempos estándar de fabricación.
- **ProductionOrder / ProductionOrderOperation**: trabajo planificado, liberado y ejecutado, con tiempos y cantidades reales.
- **ProductionShift / OperationDelay / DelayReason**: turno del operador, atrasos justificados y catálogo reutilizable de motivos.
- **ShiftAssignment**: vínculo entre un operador de RR.HH. (`ext_hr_employee_id`) y un centro de trabajo por franja de turno.
- **MaintenanceTicket**: ticket correctivo escalado desde piso, con prioridad, estado, centro, evento de parada, técnico y tiempos de intervención.
- **PreventiveMaintenanceOrder**: orden de mantenimiento preventivo programada a partir del historial y del desgaste de la máquina.
- **Umbral de indicador (ThresholdSetting)**: valor crítico configurable por indicador de planta, persistido en el snapshot.
- **RoleUser (seis tablas por rol)**: pertenencia de usuarios a `plant_manager`, `planner`, `production_engineer`, `supervisor`, `operator` y `maintenance`; las cuentas demo tienen un solo rol y cada alta se persiste de inmediato.
- **CalendarEvent / CalendarSelectionState**: órdenes y mantenciones visibles por mes con filtro de tipo, mes visitado en memoria de sesión y rango de días seleccionado por arrastre con horario de inicio/fin editable.
- **BomStation**: estación derivada de la máquina (`work_center`) y su número de secuencia, obtenida de la receta/ruta del BOM; no subdivide una máquina y se complementa con la dotación de operadores de la orden.
- **MaintenanceSchedule**: fechas de inicio y plazo estimado de tickets programados y preventivas, con fecha final visible dinámica (extendida a hoy si vence o acortada a la resolución real) y marca de inmutabilidad una vez resuelta.
- **Capa de superposición (OverlayLayer)**: orden de presentación de tablas, barras, modo foco, modales, confirmaciones y notificaciones, con reglas que impiden que un contenedor de vista atrape un modal por debajo de una tabla.
- **Celda de calendario (CalendarDayCell)**: día del mes con sus eventos, tope visual de tres entradas legibles y contador de actividades adicionales resueltas en el menú del día.
- **Estado de acceso por rol (RoleAccessViewState)**: rol autenticado en el login, rol previsualizado opcional por "Ver como" y confirmación pendiente; la única página `#/roles` es exclusiva de la Jefa.
- **Credencial de usuario (UserCredential)**: usuario y contraseña de la tabla de FR-13 para cuentas demo, contraseña inicial igual al nombre de usuario para cuentas nuevas, contraseña vigente susceptible de cambio desde el menú superior y validación durante `authenticate`.
- **Matriz de permisos (PermissionMatrix)**: regla por módulo y acción (`ver`, `crear`, `editar`, `aprobar/cerrar`, `exportar`, `configurar umbrales`) evaluada contra el rol autenticado; oculta la UI y bloquea el store en cada mutación.
- **Ventana emergente del calendario (CalendarOverlay)**: menú del día, detalle de evento y popup de horario presentados como ventanas centradas, con capas de fondo y contenido, cierre por botón/Escape/clic fuera y sin renderizado incrustado.
- **Gesto de selección de horario (ScheduleSelectionGesture)**: estado transitorio del modo foco con hitbox de tarjeta, rango de días resaltado en vivo, bloque de calendario iluminado y rango exacto transferido al modal al soltar el puntero.
- **Vista de máquina (MachineDetailViewState)**: máquina seleccionada, panel izquierdo/derecho con proporciones dinámicas, deselección por botón o clic fuera y mini-calendario mensual asociado con leyenda de colores.
- **Lista de mantenciones (MaintenanceLifecycleList)**: agrupación en activas (vigentes y vencidas, con filtro de vigencia) e históricas (resueltas, con baja confirmada), cada una con su propio buscador.

- **Bloque seleccionable (SelectableBlock)**: fila, tarjeta o ítem de la interfaz con hitbox completa que muestra un hover de oscurecimiento ligero, transición suave y cursor de mano sin alterar el dato seleccionado.
- **Orden de subpestañas de mantenimiento (MaintenanceTabOrder)**: secuencia "Mantenimientos", "Máquinas", "Tickets" con "Mantenimientos" como estado inicial al abrir el módulo.
- **Fila compacta de máquina (MachineCompactRow)**: representación horizontal del nombre y código de la máquina en la lista izquierda, sin columnas de detalle; el detalle completo vive en el panel derecho.
- **Mini-calendario compacto (CompactMachineCalendar)**: vista informativa de ancho reducido, leyenda superior o lateral y celdas redondeadas independientes con codificación por color y navegación mensual como única interacción.
- **Distribución con bandeja (PendingTrayLayout)**: disposición condicional del calendario y la bandeja vertical derecha, con ancho completo del calendario cuando la bandeja no está presente.
- **Estado de ventana emergente (CalendarOverlayState)**: conjunto de `selectedEventId`, `dayMenuDate` y backdrop que debe limpiarse por completo al cerrar con "×", Escape o clic fuera.
- **Inscripción múltiple de roles (MultiRoleEnrollment)**: alta de usuario que asocia un nombre de usuario y una contraseña inicial a una o hasta seis tablas de rol distintas, sin repeticiones y con confirmación visible.
- **Dataset semilla de demostración (DemoSeedDataset)**: conjunto completo y reconstruible de maestros, 4 BOM de hasta 4 niveles, 10 máquinas con una inactiva, 12 RR.HH., 40 órdenes en 3 meses y 5 estados, turnos, atrasos, 15 tickets, 5 preventivas y 6 cuentas demo, con fechas relativas al día actual y restaurado por "Reiniciar datos de demo".
- **Empleado demo de RR.HH. (DemoHrEmployee)**: persona ficticia con identificador externo, nombre chileno único, rol y especialidad; alimenta asignaciones de turno, técnica de mantención y privacidad sin duplicar nombres genéricos.

## 7. Métricas de Éxito

- **SC-01**: La Jefa de Planta obtiene la visión consolidada de carga, OEE, paradas y cumplimiento del período en menos de 1 minuto y sin salir del panel.
- **SC-02**: El 100% de los centros con carga superior a su capacidad efectiva se resaltan y las alarmas por umbral se muestran al abrir el panel; solo la Jefa de Planta puede configurar umbrales. Este resaltado pertenece a US-08; la alerta superior de US-11 usa regla propia de ≥ 95 % descrita en AC-39.
- **SC-03**: El reporte consolidado se exporta en PDF y Excel con los datos del período seleccionado en menos de 10 segundos.
- **SC-04**: Un Encargado de Mantenimiento identifica y toma el ticket urgente más antiguo en menos de 30 segundos desde que fue escalado.
- **SC-05**: El 100% de las intervenciones cerradas registran su tiempo real de parada y dejan la máquina disponible (fuera de *En fallo*).
- **SC-06**: Tras recargar la página se conserva el 100% de tickets, intervenciones, umbrales y órdenes preventivas.
- **SC-07**: Las interacciones de los paneles responden en menos de 100 ms con 500 órdenes y BOM de 4 niveles.
- **SC-08**: El 0% de las vistas expone rankings individuales; todo detalle por persona se etiqueta como contexto operativo.
- **SC-09**: El 100 % de las cuentas demo ingresa con su único rol tras cerrar sesión y volver a ingresar, sin menú de roles ni opciones de rol no autorizadas.
- **SC-10**: El planificador selecciona un rango y guarda el horario de una orden en menos de 1 minuto, con horas predeterminadas editables y cancelación inmediata con clic derecho.
- **SC-11**: El 100 % de las mantenciones visibles en el calendario coincide con las dos listas vigentes del panel de Mantenimientos ("Mantenimientos activos" con filtro Todos/Vigentes/Vencidos y "Mantenimientos históricos"), y el 100 % de las resoluciones registra parada real sin ingreso manual.
- **SC-12**: El 0% de las vistas de roles no autorizados revela nombres reales de RR.HH. o de técnicos de mantención; los datos sensibles aparecen anonimizados o como conteo.
- **SC-13**: El 100 % de las ventanas emergentes, diálogos de confirmación y notificaciones permanece totalmente visible sobre tablas, barras y encabezados fijos en cualquier estado de desplazamiento o animación.
- **SC-14**: El 100 % de los días del calendario muestra títulos de eventos legibles en una cuadrícula de ancho completo, con no más de tres eventos visibles y un indicador exacto de las actividades restantes, disponibles íntegramente en el menú del día.
- **SC-15**: El 100 % de los roles excepto Jefa no ve la página `#/roles`, "Ver como" solo aparece para `plant_manager` y requiere confirmación, y la previsualización no altera la cuenta autenticada.
- **SC-16**: El 100 % de las bajas de usuario se aplican solo tras confirmación, se reflejan después de logout y recarga, y ninguna operación deja la tabla de Jefa de Planta sin administradores; el 100 % de las cuentas nuevas mantiene la contraseña igual al nombre de usuario.
- **SC-17**: El 100 % de los cambios de contraseña realizados desde el menú superior se valida y persiste en la tabla o tablas donde figure el usuario, y el ingreso con la nueva contraseña funciona en la primera tentativa tras cerrar sesión o recargar; el 0 % de los cambios con datos inválidos modifica cuentas.
- **SC-18**: En los seis roles, el 100 % del ancho útil se destina al calendario mensual: los roles con bandeja (`planner` y `plant_manager`) la ven como columna vertical derecha de 280 px junto al calendario, y los demás roles ven el calendario a 1fr completo; el 100 % de los meses se visualiza completo sin títulos comprimidos en pantalla estándar.
- **SC-19**: El 100 % de los menús diarios, detalles de evento y popups de horario se abre centrado y se cierra por las tres vías previstas, y el 100 % de los arrastres conserva el rango exacto seleccionado al abrir el modal sin clics adicionales.
- **SC-20**: El 100 % de la subpestaña Máquinas usa dos paneles con los filtros y el mini-calendario especificados, y el 100 % de Mantenimientos usar exactamente dos listas, sin botones de intervención obsoletos en Tickets ni filtros globales residuales.

- **SC-21**: El 100 % de los bloques seleccionables definidos muestra retroalimentación de hover perceptible y cursor de mano, y el 0 % de esos hovers cambia la selección o los datos.
- **SC-22**: En el 100 % de las aperturas de Mantenimiento, "Mantenimientos" es la subpestaña activa y el orden de las tres pestañas es el acordado; el 100 % de las máquinas se identifica en la lista compacta con nombre y código en menos de 5 segundos.
- **SC-23**: En el 100 % de las selecciones de máquina, el mini-calendario cabe en un ancho máximo de 520 px sin perder altura, muestra la leyenda sin scroll adicional y presenta celdas redondeadas independientes con la proporción y los colores acordados.
- **SC-24**: El 100 % de los usuarios con rol `maintenance` obtiene en "Listado" el mismo conjunto de mantenciones activas y vencidas que en Mantenimiento, con 0 órdenes de producción visibles en esa vista.
- **SC-25**: El 100 % de los roles con bandeja ve las órdenes pendientes como tarjetas verticales a la derecha del calendario, y el 100 % de los roles sin bandeja ve el calendario ocupando todo el ancho útil.
- **SC-26**: El 100 % de las ventanas emergentes del calendario se cierra con "×" sin dejar estados residuales, no aparece ningún texto "Volver a la lista del día" y las tres vías de cierre —botón, Escape y clic fuera— producen el mismo resultado.
- **SC-27**: El 100 % de los resúmenes diarios del rol `supervisor` ofrece el acceso "Ir a Supervisión de línea" y lleva a `#/supervision` en un solo clic, sin cambios en la sesión.
- **SC-28**: El 100 % de los nuevos usuarios puede inscribirse en uno a seis roles en una sola operación, sin duplicados, con contraseña igual al nombre de usuario, toast de confirmación y persistencia verificable tras recargar; el formulario queda restablecido a un solo desplegable.
- **SC-29**: Las mejoras de `main` y las Fases 1 a 30 permanecen intactas, con 0 regresiones en las historias US-01 a US-15; toda modificación de AC-01 a AC-103 está documentada como reformulación de roles/permisos del 2026-11-26 conservando su ID.
- **SC-30**: En el 100 % de los arranques y reinicios de demo, el dataset contiene 1 empresa, 3 bodegas, 4 UoM, al menos 13 productos (4 terminados), 4 BOM de hasta 4 niveles y 3 pedidos de venta con al menos una orden MTO y una de stock.
- **SC-31**: En el 100 % de los arranques, los 10 centros de trabajo incluyen uno inactivo y muestran al menos un estado `available`, uno `in_operation` y uno `fault`, y los 12 nombres de RR.HH. son únicos con la distribución de roles exigida.
- **SC-32**: En el 100 % de los arranques, 40 órdenes cubren los meses anterior, actual y siguiente y los cinco estados; al menos 4 caen entre `relativeDay(-2)` y `relativeDay(+10)`, 4 están abiertas sin fechas y la bandeja "Pendiente de horario" las muestra sin intervención manual.
- **SC-33**: En el 100 % de los arranques, hay 5 turnos pendientes de validar, 3 atrasos abiertos y 8 cerrados, 15 tickets en tres estados y tres prioridades, y 2 tickets activos y 2 preventivas vigentes caen en el mes actual con visibilidad inmediata en calendario, mini-calendario y "Mantenimientos activos".
- **SC-34**: El 100 % de las 6 cuentas demo aparece en su única tabla de rol con las credenciales literales de FR-13, y tras "Reiniciar datos de demo" el 100 % de las fechas relativas se recalcula para el día actual sin registros huérfanos ni duplicados.
- **SC-35**: El 100 % de las celdas de la matriz FR-22 se cumple para acciones visibles y acciones bloqueadas; el 0 % de las acciones denegadas muta el store, inclusive por URL o llamada directa.
- **SC-36**: El 0 % de la interfaz ofrece controles de cambio de rol; el 100 % de las pantallas usa la etiqueta "Operador" y el módulo de inicio de FR-13 tras cada login.
- **SC-37**: El 100 % de los intentos de abrir `#/roles` por un rol distinto de Jefa es redirigido y el 100 % de los enlaces `#/admin-roles` converge en `#/roles`.
- **SC-38**: El conjunto `demo-volume-500` se genera bajo demanda y el 100 % de las interacciones de panel responden en menos de 100 ms con BOM de 4 niveles.
- **SC-39**: El 0 % de elementos de `001-erp-base-module` —Entidades, Documentos, pestañas o campos personalizados— aparece en el MVP.

## 8. Supuestos y Dependencias

- El snapshot local se mantiene versionado con `erp.manufacturing.v2` como versión vigente desde US-08; `erp.manufacturing.v1` se migra automáticamente. Cualquier cambio de forma incrementa la versión y se valida al hidratar.
- `maintenance_tickets`, las órdenes preventivas, `threshold_settings` y `role_permissions` se modelan como entidades locales del módulo y ya están descritas en `data-model.md` §3.19–3.22.
- Los seis roles son Jefa de Planta, Planificador, Ingeniero de Producción, Supervisor de Línea, Operador y Encargado de Mantenimiento; la autenticación es simulada y local, pero el rol se obtiene solo del login de una cuenta. No hay controles de cambio de rol; la etiqueta visible canónica es "Operador" en toda la interfaz.
- La exportación a PDF y Excel se genera localmente con los datos mock, sin backend ni servicios externos.
- Los catálogos de RR.HH., calidad y ventas son datos simulados de solo lectura.
- Los tiempos de turno y de parada se derivan de marcas de tiempo persistidas, no de temporizadores en memoria.
- El OEE, la carga, la utilización, el cuello de botella y el indicador de desgaste son valores derivados y no se persisten.
- `efficiency_factor` se aplica a la capacidad efectiva: `domain/capacity.js` deriva la tasa diaria (`capacity_per_day_minutes × efficiency_factor`) y la escala a días hábiles para el panel de planta (US-08) y el balance de líneas (US-11); el Panel de Producción (US-06) muestra esa tasa de un solo día. Cada panel conserva su propia definición de carga (pendiente, observada o proyectada) y `null` significa "sin capacidad válida".
- Las seis tablas de usuario forman parte del mismo snapshot `erp.manufacturing.v2`; el botón "Reiniciar datos de demo" de Jefa de Planta restaura las cuentas, sus contraseñas y el dataset completo de la sección **Datos de demostración**.
- El calendario y el panel de mantenimiento comparten una única fuente de mantenciones; programar, resolver o eliminar en una vista se refleja en la otra sin duplicar registros.
- El mes visitado solo se conserva entre pestañas del panel de programación; cualquier cambio de identidad, cierre de sesión o recarga vuelve al mes actual.
- Las estaciones se derivan de la receta/ruta vigente de cada orden; los cambios de dotación se guardan en la orden y no alteran la receta base ni el cálculo de capacidad existente.
- La jerarquía de capas, los selectores CSS y los valores numéricos de `src/styles/manufacturing.css` se tratan como restricción de interfaz acordada; no se introducen librerías ni sistemas de estilos nuevos.
- La única página `#/roles` se resuelve con el usuario autenticado y las seis tablas persistidas; solo la cuenta `plant_manager` puede abrirla.
- La configuración de roles depende del rol **autenticado**, no de un rol activo elegido en la interfaz; `#/admin-roles` redirige a `#/roles` y no es un destino de navegación independiente.
- El indicador "+N más" es solo una ayuda visual: el menú del día es la fuente completa de actividades y no se pierde información al limitar la altura de la celda.
- Las pestañas "Calendario"/"Listado" y las subpestañas de Roles reutilizan el lenguaje visual ya existente en Mantenimiento, sin componentes nuevos ni dependencias adicionales.
- La autenticación sigue siendo simulada: "validar contraseña actual" significa comparar con la credencial persistida en el snapshot local, sin recuperación, bloqueo por intentos ni servicios externos.
- La contraseña inicial de una cuenta nueva es el propio nombre de usuario; el cambio de contraseña es voluntario y no obliga a renovarla en el primer ingreso.
- La regla de conservar al menos una cuenta en `plant_manager` protege la administración de roles; las demás tablas pueden quedar vacías y un usuario puede quedar sin roles asignados tras una baja.
- Los eventos de cierre de ventanas emergentes (botón, Escape, clic fuera) y de arrastre se consideran parte del mismo flujo: soltar el puntero en cualquier posición del documento confirma la intención de abrir el modal de horario.
- El mini-calendario de máquina es una vista de lectura: el cambio de mes sirve solo para inspeccionar otro período y no modifica planes, órdenes ni mantenciones.
- La ampliación de US-12, US-13 y US-15 se documenta únicamente en esta especificación y sus criterios de aceptación; las Fases 1 a 29 de `tasks.md` y las mejoras de `main` se tratan como línea base inmutable.

- El hover exigido es una ayuda visual: no confirma selección, no abre modales por sí solo y no modifica la persistencia.
- La bandeja vertical se muestra únicamente a `planner` y `plant_manager`; en los otros cuatro roles el calendario conserva todo el ancho disponible sin dejar un espacio vacío reservado.
- El listado de mantenciones activas de Planificación para `maintenance` consume la misma fuente que la subpestaña Mantenimientos, de modo que resolver una mantención actualiza ambas vistas sin duplicar registros.
- Se adopta 520 px como ancho máximo representativo del mini-calendario por estar dentro del rango 460–560 px solicitado, manteniendo la altura previamente acordada.
- Cerrar con "×" equivale a cerrar con Escape o clic fuera: limpia `selectedEventId`, `dayMenuDate` y el backdrop para evitar que la ventana reaparezca con estado obsoleto.
- El botón "Ir a Supervisión de línea" se ofrece solo al rol `supervisor` y conserva su sesión, rol activo y módulo de destino `#/supervision`.
- La creación de usuarios admite de uno a seis roles distintos por operación; se exige al menos un rol y las repeticiones del mismo rol se ignoran antes de persistir.
- Esta ampliación es documental: las Fases 1 a 30 de `tasks.md`, las mejoras presentes en `main` y los criterios AC-01 a AC-103 no se reescriben.
- "Semana y mes actuales" significa que las fechas se calculan al cargar el snapshot con la fecha del sistema mediante `demo-dates.js`; por eso el mismo dataset es válido en cualquier día y se recalcula al reiniciar.
- Las "órdenes abiertas sin fechas planificadas" usan estado `planned` con `planned_start_date: null` y `planned_end_date: null`; siguen siendo elegibles para la bandeja "Pendiente de horario" sin haber sido liberadas.
- Los tickets programados y las preventivas comparten el mismo calendario de mantenciones: una fecha vigente debe aparecer simultáneamente en el Calendario Mensual, el mini-calendario de la máquina y "Mantenimientos activos".
- El dataset semilla es de demostración y no constituye un sistema de RR.HH. ni de ventas real; los nombres y pedidos son ficticios y sirven solo para ejercitar permisos, privacidad y trazabilidad.
- La matriz FR-22 se evalúa en el store antes de cualquier escritura; ocultar un botón no sustituye la validación de permisos.
- "Ver como" es una previsualización temporal de la Jefa de Planta y no habilita acciones que el rol autenticado no posee.
- El conjunto `demo-volume-500` es opcional y separado del dataset semilla para no afectar el arranque ni la demostración normal.

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
- **Navegación**: `src/domain/access-control.js` es la fuente única de los seis roles, etiquetas, `MODULE_ACCESS` y la matriz FR-22; `src/manufacturing-main.js` sincroniza el rol del login con el hash, sin "Datos de roles" y con `#/admin-roles` redirigido a `#/roles`; `src/data/fixtures/dashboard-demo.js` contiene sólo datos de demostración para el inicio.
- **Puntos de extensión de US-12 a US-15**: `RoleAccessPanel.js` aloja la única página "Roles" integrando `RoleAdminPanel.js` (seis tablas, altas, asignaciones y botón "Quitar") y reutilizando `ConfirmDialog.js` para "Ver como" y las bajas; `src/manufacturing-main.js` aloja "Cambiar contraseña" y "Ver como" en el menú de usuario; `ProductionSchedulingPanel.js` y `src/components/calendar/CalendarEventDialog.js` para bandeja vertical condicional, calendario, pestañas, detalle por tarea, modales centrados, cierre con "×", botón de supervisor y gesto de arrastre; `src/domain/operation-planning.js` (`deriveBomStations`) junto a `SupervisorLinePanel.js` para estaciones y dotación; `MaintenancePanel.js` para los dos paneles de máquinas, el mini-calendario, Tickets y las dos listas de Mantenimientos.
- **Capas visuales**: `src/styles/manufacturing.css` define la jerarquía z-index de FR-19 y mantiene los contenedores `.view`, `.content` y `.panel` libres de transformaciones o animaciones que generen contextos de apilamiento por debajo de los modales.
- **Puntos de extensión de la ampliación de 2026-11-24**: `MaintenancePanel.js` para el orden de subpestañas, la lista compacta y el mini-calendario; `ProductionSchedulingPanel.js` para el "Listado" de `maintenance`, la bandeja vertical condicional, el menú diario y el botón de supervisor; `CalendarEventDialog.js` para el cierre con "×"; y `RoleAdminPanel.js` para la alta multi-rol de hasta seis roles. El hover y la bandeja se expresan como restricciones visuales acordadas sobre `src/styles/manufacturing.css`, sin introducir librerías ni sistemas de estilos nuevos.
- **Conservación obligatoria**: no modificar la tipografía `@fontsource-variable/inter`, `icons.js`, `ConfirmDialog.js`, `Toast.js`, `labels.js`, `demo-dates.js`, `capacity.js`, el balance de líneas de US-11, el menú drawer, el botón "Reiniciar datos de demo" ni la configuración de `vitest.config.mjs`.
- **Límites de cambio**: no renombrar el paquete en `package.json`, no añadir dependencias externas, no incorporar elementos de `001-erp-base-module` en `index.html` y mantener los IDs de ruta `orders`, `supervision`, `scheduling`, `maintenance`, `operator`, `plant`, `line-balance`, `bom`, `dashboard`, `roles` y `admin-roles`.
- **Datos semilla (FR-21)**: `demo-dates.js` es la única fuente de fechas relativas; los fixtures de maestros, 4 BOM de hasta 4 niveles, 10 centros, 12 RR.HH., 40 órdenes, turnos, atrasos, 15 tickets, 5 preventivas y 6 cuentas se reconstruyen completos desde "Reiniciar datos de demo" según la sección **Datos de demostración**, sin tocar `001-erp-base-module` ni crear `src/storage.js` o `src/module-config.js`.
- **Permisos**: `src/domain/access-control.js` expone la matriz FR-22 y el store la aplica antes de persistir; la UI deriva la visibilidad de botones y rutas de la misma matriz.
- **Alcance template 001**: no se crean Entidades, Documentos, pestañas ni campos personalizados del módulo base.
