# Especificación: Módulo de Operaciones / Manufactura (ERP)

**Rama**: `002-operations-manufacturing` | **Fecha**: 2026-10-31 | **Actualizado**: 2026-11-18
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
- **Q**: ¿Cómo se vinculan los operarios con las máquinas para el turno? → **A**: Mediante asignaciones de turno (`shift_assignments`) usando el puente de solo lectura `ext_hr_employee_id` hacia el módulo de *Recursos Humanos y Planillas*.
- **Q**: ¿Qué ocurre cuando el supervisor valida un cierre de turno o escala un incidente? → **A**: La validación marca `supervisor_validated = true` con timestamp y firma del supervisor sobre el turno cerrado (`completed`); el botón de alerta de escalamiento marca `escalated_to_maint = true` en el evento de parada/atraso y genera un registro urgente en `maintenance_tickets` cambiando el semáforo del centro de trabajo a `fault` ("En fallo").

</details>

## 2. Alcance

- Gestión de BOM multi-nivel (`bill_of_materials`, `bom_components`) con detección de ciclos.
- Configuración de centros de trabajo y rutas (`work_centers`, `routings`, `routing_operations`) con tiempos estándar.
- Despacho de órdenes (`production_orders`) desde reposición o make-to-order (`sales_order_id`), con congelación de BOM/ruta y generación de operaciones.
- Ejecución en piso (`production_order_operations`) con estados `pending → in_progress → paused → completed`, tiempos reales y cálculo de avance.
- Registro de turno del operador: inicio/fin de la orden activa con un solo botón, tiempo real, justificación de atrasos con motivos predefinidos o personalizados, y contador de piezas del turno.
- **Supervisión de operaciones en línea (HU-04 / US-07)**: semáforo de estado en tiempo real por línea/máquina (*En operación, En pausa, En fallo, Cambio de formato*), asignación de operarios a máquinas para el turno (`shift_assignments` con puente `ext_hr_employee_id`), revisión y aprobación de cierres de turno (`supervisor_validated = true`), y escalamiento inmediato de incidentes a mantenimiento (`maintenance_tickets` con `escalated_to_maint = true`).
- Consumo real (`material_consumption`) vs. teórico, y salida de bien terminado (`production_output`) con merma.
- Panel con KPIs, tablero kanban, trazabilidad plan-vs-real y estado de calidad derivado. El tablero permite arrastrar tarjetas entre columnas válidas, respetando la máquina de estados.
- La captura de datos numéricos admite escritura directa con punto o coma decimal y un máximo de dos decimales, sin flechas de precisión que bloqueen el formulario.
- **Panel de desempeño de planta (US-08 / Jefa de Planta)**: carga por centro, OEE y paradas acumuladas por período, umbrales críticos con alarmas, reprogramación y cancelación de órdenes, exportación del reporte consolidado a PDF y Excel, y permisos por rol simulados.
- **Gestión de mantenimiento y disponibilidad de máquinas (US-09 / HU-06)**: bandeja de tickets escalados, toma de intervención con técnico asignado, historial y desgaste por máquina, órdenes de mantenimiento preventivo, registro de tiempos reales de parada y restablecimiento del semáforo del centro de trabajo.
- **Acceso por rol y navegación**: ingreso genérico con credenciales simuladas, filtrado de la navegación según permisos, navegación por hash (deep links y botón atrás), panel de acceso por rol, datos de roles restringidos a la Jefa de Planta y datos simulados para probar estados y formularios sin backend.

**Límites**: sin backend, sin MRP automático, sin MES en tiempo real. Las entidades de frontera (`products`, `warehouses`, `units_of_measure`, `companies`, `sales_orders`, `quality_inspections`, `hr_employees`) se consumen como datos simulados de solo lectura.

> **Convención de "tiempo real"**: en esta especificación significa actualización reactiva inmediata de la interfaz ante cambios del store local y eventos persistidos, con objetivo `< 100 ms` (SC-07). No implica telemetría de máquina, backend ni sincronización externa.

## 3. Personas

| Persona | Descripción |
|---|---|
| **Jefa de Planta (`@Lia-dl`)** | Gestiona BOM y rutas, define capacidad, programa y prioriza órdenes, monitorea carga. Supervisa el desempeño global de la planta: consulta carga por centro, OEE, paradas acumuladas y cumplimiento de órdenes, configura alarmas de umbral, reprograma o cancela órdenes, exporta reportes consolidados y define permisos por rol. Analiza por centro de trabajo y operación, sin ranking de operadores. |
| **Supervisor de Operaciones / Línea (`@carlos-277`)** | Monitorea el semáforo de líneas/máquinas en tiempo real, asigna operarios por turno (`ext_hr_employee_id`), revisa y aprueba cierres de turno (`supervisor_validated`) y escala incidentes críticos a mantenimiento. |
| **Operador de Máquina (`@maximilianMC`)** | Ejecuta operaciones en pantalla táctil/piso, inicia/finaliza turno, justifica atrasos, registra conteo de piezas, consumo, salida y merma. |
| **Ingeniero de Producción (`@JualTrupe`)** | Configura rutas de fabricación y tiempos estándar, analiza el balance de líneas y evalúa informes de materiales para optimizar tiempos, reducir mermas y encontrar rutas óptimas. |
| **Encargado de Mantenimiento (`@SebastianRivasprg`)** | Atiende incidentes críticos escalados desde piso (`fault`), analiza historial operativo y evalúa desgaste en maquinaria para programar mantenimientos preventivos, registra tiempos de parada por mantención y restablece la disponibilidad operativa de las máquinas. |
| **Planificador (`@maiteval`)** |  Organiza y calendariza las órdenes de producción, asignando fechas planificadas de inicio y término a las tareas. Coordina la secuencia de fabricación según las prioridades y plazos de entrega, consulta el estado de las órdenes y ajusta la programación cuando existen atrasos o cambios en la producción, buscando optimizar los tiempos y cumplir con las fechas de entrega establecidas. |

> **Convención de roles simulados**: la interfaz usa cuatro etiquetas de rol —Jefa de Planta, Supervisor de Operaciones/Línea, Planificador y **Operador**—. "Operario" en textos de asignación de RR.HH. y "Operador de Máquina" en descripciones de persona son sinónimos documentales; la etiqueta visible canónica en toda la interfaz es **Operador**. Las responsabilidades de Ingeniería de Producción y Mantenimiento se ejercen, en la demo, desde los roles Planificador y Supervisor/Jefa de Planta respectivamente, sin crear credenciales adicionales.

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

**US-07 (HU-04 — Supervisor de Operaciones / Línea)**: Como Supervisor de Operaciones / Línea (Nivel Táctico-Operativo a pie de fábrica), quiero visualizar el semáforo de estado de cada línea/máquina en tiempo real, vincular operarios con máquinas para el turno, revisar y aprobar los cierres de turno y escalar incidentes a mantenimiento con un botón de alerta, para asegurar el cumplimiento del plan del turno y resolver incidencias inmediatas.

- **Semáforo en tiempo real por línea/máquina (`work_centers`)**: Mostrar tarjetas o filas por cada centro de trabajo con su estado operativo en vivo (`in_operation` = *En operación* [verde], `paused` = *En pausa* [amarillo], `changeover` = *Cambio de formato* [azul/ámbar], `fault` = *En fallo* [rojo]), junto con la orden/operación activa, operario asignado y avance de piezas.
- **Asignación de personal al turno (`shift_assignments`)**: Permitir vincular un operario (`ext_hr_employee_id`, puente hacia *Recursos Humanos y Planillas*) con un centro de trabajo/máquina (`work_center_id`) y franja de turno (`morning`, `afternoon`, `night`); impedir que un mismo operario sea asignado simultáneamente a dos máquinas activas en la misma franja sin confirmación de reasignación.
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

- Mostrar una pantalla de ingreso genérica con usuario y contraseña, sin exponer roles ni descripciones, y persistir el rol resuelto en `erp.manufacturing.role` (`src/data/fixtures/demo-accounts.js`). Cargar la página o cerrar sesión vuelve al ingreso.
- Filtrar la navegación lateral y el panel "Acceso por rol" según la matriz `MODULE_ACCESS`; denegar módulos no permitidos aunque se acceda por URL.
- Exponer las tarjetas con nombre, descripción y acceso por rol solo en `#/admin/roles`, permitido únicamente para la Jefa de Planta (`isAdmin`).
- Sincronizar el módulo activo con el hash (`#/dashboard`, `#/plant`, etc.) para soportar enlaces profundos y el botón atrás del navegador.
- Usar datos simulados deterministas para la actividad reciente, identificados como datos de demostración y sin mutar el snapshot de manufactura. La navegación lateral es el único acceso directo a los módulos por rol.
- Aplicar etiqueta "Operador" de forma consistente en selector global, panel de planta, estación y supervisión.

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
| AC-18 | US-07 | Semáforo en vivo por línea/máquina (*En operación, En pausa, En fallo, Cambio de formato*) y registro de asignación de operario (`ext_hr_employee_id`) en `shift_assignments` | Verificado |
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

> **Nota de numeración**: los IDs AC son anclas históricas estables; no se renombran al añadir historias. La columna "Historia" disambigúa los rangos: AC-04..AC-07 y AC-20 pertenecen a US-08, AC-08..AC-14 a la base US-01..US-05/FR-06, y AC-37, AC-39, AC-40 y AC-45 a US-11; AC-46 cubre la utilización diaria compartida entre FR-06 y US-11. AC-38 fue retirado y su cobertura de carga/utilización se integró en AC-39. No existen IDs duplicados ni un mismo criterio asignado a dos historias.

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
- **SC-02**: El 100% de los centros con carga superior a su capacidad efectiva se resaltan y las alarmas por umbral se muestran al abrir el panel. Este resaltado pertenece a US-08; la alerta superior de US-11 usa regla propia de ≥ 95 % descrita en AC-39.
- **SC-03**: El reporte consolidado se exporta en PDF y Excel con los datos del período seleccionado en menos de 10 segundos.
- **SC-04**: Un Encargado de Mantenimiento identifica y toma el ticket urgente más antiguo en menos de 30 segundos desde que fue escalado.
- **SC-05**: El 100% de las intervenciones cerradas registran su tiempo real de parada y dejan la máquina disponible (fuera de *En fallo*).
- **SC-06**: Tras recargar la página se conserva el 100% de tickets, intervenciones, umbrales y órdenes preventivas.
- **SC-07**: Las interacciones de los paneles responden en menos de 100 ms con 500 órdenes y BOM de 4 niveles.
- **SC-08**: El 0% de las vistas expone rankings individuales; todo detalle por persona se etiqueta como contexto operativo.

## 8. Supuestos y Dependencias

- El snapshot local se mantiene versionado con `erp.manufacturing.v2` como versión vigente desde US-08; `erp.manufacturing.v1` se migra automáticamente. Cualquier cambio de forma incrementa la versión y se valida al hidratar.
- `maintenance_tickets`, las órdenes preventivas, `threshold_settings` y `role_permissions` se modelan como entidades locales del módulo y ya están descritas en `data-model.md` §3.19–3.22.
- Los roles simulados con selector son Jefa de Planta, Supervisor de Operaciones/Línea, Planificador y Operador; no existe autenticación real. La etiqueta visible canónica es "Operador" en toda la interfaz.
- La exportación a PDF y Excel se genera localmente con los datos mock, sin backend ni servicios externos.
- Los catálogos de RR.HH., calidad y ventas son datos simulados de solo lectura.
- Los tiempos de turno y de parada se derivan de marcas de tiempo persistidas, no de temporizadores en memoria.
- El OEE, la carga, la utilización, el cuello de botella y el indicador de desgaste son valores derivados y no se persisten.
- `efficiency_factor` se aplica a la capacidad efectiva: `domain/capacity.js` deriva la tasa diaria (`capacity_per_day_minutes × efficiency_factor`) y la escala a días hábiles para el panel de planta (US-08) y el balance de líneas (US-11); el Panel de Producción (US-06) muestra esa tasa de un solo día. Cada panel conserva su propia definición de carga (pendiente, observada o proyectada) y `null` significa "sin capacidad válida".

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
- **Puentes Inter-Modulares (US-07 / HU-04)**: `ext_hr_employee_id` consume catálogo simulado de operarios de RR.HH. (`src/data/fixtures/hr-employees.js`) y el escalamiento genera registros en `maintenance_tickets` consumibles por la vista de Mantenimiento (HU-06).
- **Ética**: agregación por centro/operación, sin rankings individuales; tiempos y asignaciones como dato de coordinación operativa.
- **Navegación**: `src/domain/access-control.js` es la fuente única de roles, etiquetas y matriz de módulos; `src/manufacturing-main.js` sincroniza rol y hash; `src/data/fixtures/dashboard-demo.js` contiene sólo datos de demostración para el inicio.
