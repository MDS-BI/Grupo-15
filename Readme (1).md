# Módulo ERP de Manufactura y Operaciones (Vite + Vanilla JS) — Grupo 15

Este producto consiste en un módulo funcional, modular y escalable de **Manufactura y Operaciones** integrable dentro de un sistema de Planificación de Recursos Empresariales (ERP), estructurado en tres capas de prioridad técnica (núcleo base, sub-entidades de manufactura y contratos de integración inter-áreas). En primer lugar, respeta íntegramente el modelo base compartido por el curso gestionando **Productos** como datos maestros (`Entity`) y **Órdenes de Producción** como documentos transaccionales (`Document`), manteniéndolos ligeros con solo dos campos personalizados en `Producto` (`unitOfMeasure`, `standardUnitCost`) y cuatro llaves de enlace en `Orden de Producción` (`id_bom`, `id_ruta`, `id_centro_trabajo`, `tiempo_real`). En segundo lugar, desacopla el detalle técnico de planta en **cuatro sub-entidades modulares en Tercera Forma Normal (3FN)** (`sub_listas_bom`, `sub_rutas_operaciones`, `sub_centros_trabajo` y `sub_consumos_salidas`), las cuales a su vez conectan de forma nativa con **cinco áreas clave de la empresa** (**Ventas y Comercial (CRM)**, **Inventario y Bodega (SCM)**, **Compras y Proveedores (SRM)**, **Contabilidad y Finanzas**, y **RRHH y Mantenimiento (EAM)**) y se visualizan mediante un resumen ligero en solo lectura dentro del Panel y del detalle de Orden sin alejarse de la plantilla.

El desarrollo se llevará a cabo bajo la metodología **Spec Driven Development (SDD)** con **GitHub Spec Kit**, definiendo primero el Modelo Entidad-Relación modular (`specs/001-erp-base-module/data-model.md` y su esquema gráfico `mer_manufactura_operaciones.png`), las especificaciones funcionales (`specs/001-erp-base-module/spec.md`) y el plan técnico (`specs/001-erp-base-module/plan.md`) antes de implementar el código. Técnicamente, la aplicación se construirá sobre la plantilla común del curso en **Vite con HTML, CSS y JavaScript vanilla (ES2022)** y persistencia local exclusiva en el navegador (`localStorage`), concentrando toda la adaptación declarativa en `src/module-config.js` (`ModuleConfig`) sin modificar `src/storage.js`, lo que permite escalar el código hacia las sub-entidades y módulos empresariales manteniendo cobertura de pruebas automatizadas en **Vitest**.

## Equipo de Desarrollo — Grupo 15 (Modelación de Sistemas, UdeC)

**Asignatura**: Modelación de Sistemas (Ingeniería Civil Industrial — Universidad de Concepción)  
**Módulo Asignado**: Manufactura y Operaciones  
**Repositorio Oficial**: [`https://github.com/MDS-BI/Grupo-15`](https://github.com/MDS-BI/Grupo-15)

| N° | Integrante | Usuario GitHub | Perfil GitHub |
| :---: | :--- | :--- | :--- |
| 1 | **Julián Alberto Trujillo Peñaloza** | `@JualTrupe` | [https://github.com/JualTrupe](https://www.google.com/search?q=https://github.com/JualTrupe) |
| 2 | **Sebastián Matías Rivas Merino** | `@SebastianRivasprg` | [https://github.com/SebastianRivasprg](https://www.google.com/search?q=https://github.com/SebastianRivasprg) |
| 3 | **Carlos Gonzalo Espinoza Sepúlveda** | `@carlos-277` | [https://github.com/carlos-277](https://www.google.com/search?q=https://github.com/carlos-277) |
| 4 | **Maite Valentina Concha Barra** | `@maiteval` | [https://github.com/maiteval](https://www.google.com/search?q=https://github.com/maiteval) |
| 5 | **Maximilian Mogster Carrasco** | `@maximilianMC` | [https://github.com/maximilianMC](https://www.google.com/search?q=https://github.com/maximilianMC) |
| 6 | **Liang Giuliana Martina Durán Lara** | `@Lia-dl` | [https://github.com/Lia-dl](https://www.google.com/search?q=https://github.com/Lia-dl) |

## Problema Operacional, Solución Propuesta y Propuesta de Valor (MVP)

- **Problema Operacional en la Cadena de Valor**: En plantas industriales de manufactura por lotes, la desconexión entre la ingeniería de producto (catálogo de SKUs, listas de materiales BOM y hojas de ruta), la ejecución en piso de planta y los departamentos de Ventas, Inventario, Compras, Contabilidad y Mantenimiento ocasiona producción con fórmulas obsoletas, subregistro de tiempos reales y mermas, descuadres de stock físico frente a bodega y desviaciones financieras no detectadas entre el costo estándar unitario y el costo real liquidado por lote.
- **Solución Propuesta y Propuesta de Valor del MVP**: Un módulo ERP 100% frontend sobre `localStorage` que reutiliza las 32 variables base del curso para administrar **Productos** (`Entity`) y **Órdenes de Producción** (`Document`), incorporando únicamente 6 `customFields` (`unitOfMeasure`, `standardUnitCost`, `id_bom`, `id_ruta`, `id_centro_trabajo`, `tiempo_real`), una máquina de estados estricta (`planificada` → `en_proceso` → `control_calidad` → `completada` | `cancelada`) y un resumen ligero de trazabilidad en solo lectura (`#traceability-summary`) conectado con las 4 sub-entidades en 3FN y los 5 módulos empresariales.

## Esquema del Modelo Entidad-Relación (MER)



- **Archivo gráfico en la raíz del repositorio**: `mer_manufactura_operaciones.png` ([https://github.com/MDS-BI/Grupo-15/blob/main/mer\_manufactura\_operaciones.png](https://www.google.com/search?q=https://github.com/MDS-BI/Grupo-15/blob/main/mer_manufactura_operaciones.png))
- **Especificación lógica completa (38 atributos de Prioridad 1 + 4 Sub-Entidades en 3FN + 5 Áreas ERP)**: `specs/001-erp-base-module/data-model.md` ([https://github.com/MDS-BI/Grupo-15/blob/main/specs/001-erp-base-module/data-model.md](https://www.google.com/search?q=https://github.com/MDS-BI/Grupo-15/blob/main/specs/001-erp-base-module/data-model.md))

## Del Enunciado al Modelo de Datos (Tabla de Trazabilidad)

| Enunciado de Negocio (Manufactura y Operaciones) | Entidad, Variable (`key`) o Regla en `data-model.md` |
| :--- | :--- |
| «Cada producto se identifica por un código SKU único, su nombre y su categoría (terminado, subensamble o materia prima)» | `Entity.code` (`UK` obligatorio), `Entity.name`, `Entity.category` (§1.1) |
| «Cada producto define su unidad física estándar, su costo estándar unitario, su almacén asignado y su tope presupuestario» | `Entity.unitOfMeasure` (`CF`), `Entity.standardUnitCost` (`CF`), `Entity.address`, `Entity.creditLimit` (§1.1) |
| «Cada lista de materiales se versiona, tiene vigencia y un producto solo mantiene una receta activa para nuevas órdenes» | `sub_listas_bom.id_bom`, `.version`, `.activo` + `Entity.targetDate` (§2.1 y §5.4) |
| «Las líneas de receta señalan el insumo requerido y su cantidad por unidad, impidiendo referencias cíclicas a sí mismo» | `sub_listas_bom.id_producto_componente`, `.cantidad_requerida` + invariante anticiclos (§2.1 y §5.4) |
| «Las rutas definen la secuencia de operaciones, el centro de trabajo asignado y el tiempo estándar teórico» | `sub_rutas_operaciones.id_ruta`, `.numero_secuencia`, `.nombre_operacion`, `.tiempo_estandar`, `.id_centro_trabajo` (§2.2) |
| «Cada orden de producción se identifica por serie y folio, pertenece a un producto y fija la receta, ruta y centro al ejecutarse» | `Document.series`, `.folio`, `.entity_id`, `.id_bom` (`CF`), `.id_ruta` (`CF`), `.id_centro_trabajo` (`CF`) (§1.2) |
| «La orden registra su ventana programada sin que la fecha final sea anterior a la inicial, cantidad del lote y tiempo real» | `Document.startDate`, `.endDate` (`endDate >= startDate`), `.quantity`, `.tiempo_real` (`CF`) (§1.2) |
| «La orden avanza por un ciclo de estados controlado y conserva historial cuando se cancela» | `Document.status` gobernado por `ModuleConfig.statusLifecycle` (`planificada` → `en_proceso` → `control_calidad` → `completada` \| `cancelada`) (§1.3 y §4.2) |
| «Los movimientos de planta registran de forma inmutable (append-only) el consumo de insumos y la salida de terminados» | `sub_consumos_salidas.id_movimiento`, `.cantidad_consumida`, `.quantity`, `.fecha_movimiento` (§2.4 y §5.4) |
| «El módulo se interconecta nativamente con Ventas, Inventario, Compras, Contabilidad y RRHH/Mantenimiento» | Contratos de Prioridad 3 sobre las mismas variables base (`entity_id`, `code`, `series`, `folio`, `totalAmount`, `status`) (§3) |
| «Corridas automáticas de MRP multinivel, reservas finitas por minuto y trazabilidad unitaria por serie quedan fuera del MVP» | Sección **Fuera de Alcance (Out of Scope)** en `plan.md` y `data-model.md` (§6) |

## Síntesis de Variables del Modelo (100% Idénticas en Todos los Archivos)

El detalle de las 32 variables base (`15` de `Entity` y `17` de `Document`) se encuentra en `specs/001-erp-base-module/data-model.md` (§1.1 y §1.2). A continuación se resumen los **6 `customFields`** de Prioridad 1, las **4 Sub-Entidades en 3FN** de Prioridad 2 y los **5 Módulos Empresariales** de Prioridad 3:

### 1. Los 6 Campos Personalizados (`customFields` en `src/module-config.js`)

| Destino (`target`) | Variable (`key`) | Tipo (`type`) | Restricciones / Opciones | Descripción Unificada |
| :--- | :--- | :--- | :--- | :--- |
| `"entity"` (`Producto`) | `unitOfMeasure` | `select` | Obligatorio; `["UN", "KG", "LT", "MT"]` | Define la unidad física estándar en la que se cuantifica, inventaría y fabrica el producto en toda la empresa. |
| `"entity"` (`Producto`) | `standardUnitCost` | `number` | Obligatorio; `>= 0` | Representa el costo teórico unitario de fabricación del producto, utilizado como referencia base para valorizar inventarios y medir desviaciones en Contabilidad. |
| `"document"` (`Orden`) | `id_bom` | `text` | Obligatorio; no vacío | Llave foránea que identifica la receta activa en la sub-entidad `sub_listas_bom` (p. ej., `"BOM-001-V1"`) con la que se fabricará el lote. |
| `"document"` (`Orden`) | `id_ruta` | `text` | Obligatorio; no vacío | Llave foránea que identifica la secuencia de operaciones en la sub-entidad `sub_rutas_operaciones` (p. ej., `"RUTA-ENS-01"`) aplicada a la orden. |
| `"document"` (`Orden`) | `id_centro_trabajo` | `select` | Obligatorio; `["CT-01 Ensamble", "CT-02 Maquinado", "CT-03 Procesos", "CT-04 Empaque"]` | Llave foránea que vincula la orden con la estación principal en `sub_centros_trabajo`. |
| `"document"` (`Orden`) | `tiempo_real` | `number` | Obligatorio; `>= 0` | Total de horas reales empleadas en ejecutar la orden en planta, utilizado para medir eficiencia frente a `tiempo_estandar` y reportar horas a RRHH/Costos. |

### 2. Prioridad 2 y 3: Sub-Entidades Modulares en 3FN y Módulos Empresariales Conectados

| Bloque Modular | Nombre de Entidad / Módulo | Llaves y Variables Compartidas | Rol en la Escalabilidad e Integración |
| :--- | :--- | :--- | :--- |
| **Sub-Entidad 1** | `sub_listas_bom` | `id_bom` (`PK`), `entity_id` (`FK`), `id_producto_componente` (`FK`), `cantidad_requerida`, `version`, `activo` | Gestiona versiones de recetas e insumos requeridos por unidad sin saturar `Entity`. |
| **Sub-Entidad 2** | `sub_rutas_operaciones` | `id_ruta` (`PK`), `entity_id` (`FK`), `id_centro_trabajo` (`FK`), `numero_secuencia`, `nombre_operacion`, `tiempo_estandar` | Define los pasos secuenciales de fabricación y tiempos teóricos por producto. |
| **Sub-Entidad 3** | `sub_centros_trabajo` | `id_centro_trabajo` (`PK`), `nombre`, `address` (almacén/nave), `capacidad_por_hora`, `status` (`"operativo" \| "en_mantencion" \| "detenido"`) | Catálogo maestro en 3FN de estaciones de planta y capacidad instalada (`u/h`). |
| **Sub-Entidad 4** | `sub_consumos_salidas` | `id_movimiento` (`PK`), `id` (`FK`), `entity_id` (`FK`), `cantidad_consumida`, `quantity`, `fecha_movimiento` | Registro inmutable (*append-only*) de descarga de materias primas (`cantidad_consumida`) y entrega de terminados (`quantity`). |
| **Área Empresa 1** | **Ventas y Comercial (CRM)** | `entity_id`, `code`, `series`, `folio`, `quantity`, `startDate`, `endDate`, `status` | Conecta los pedidos de clientes con órdenes de producción y fechas de entrega. |
| **Área Empresa 2** | **Inventario y Bodega (SCM)** | `entity_id`, `code`, `address`, `unitOfMeasure`, `cantidad_consumida`, `quantity` | Sincroniza el descuento de insumos consumidos y el ingreso de productos terminados en almacén. |
| **Área Empresa 3** | **Compras y Proveedores (SRM)** | `entity_id`, `code`, `id_bom`, `cantidad_requerida`, `taxId`, `email`, `phone`, `paymentTerms`, `targetDate` | Dispara el reabastecimiento de materias primas según la explosión de `sub_listas_bom`. |
| **Área Empresa 4** | **Contabilidad y Finanzas** | `entity_id`, `series`, `folio`, `creditLimit`, `standardUnitCost`, `subtotal`, `discount`, `taxAmount`, `totalAmount`, `currency` | Audita presupuestos, valoriza inventario y liquida los costos reales de cada lote. |
| **Área Empresa 5** | **RRHH y Mantenimiento (EAM)** | `id_centro_trabajo`, `tiempo_estandar`, `tiempo_real`, `capacidad_por_hora`, `targetDate`, `status` | Coordina turnos operativos, productividad laboral y mantenciones preventivas de planta. |

## Clientes, Usuarios, Riesgos de Datos Sensibles y Mitigación de Sesgos

### 1. Clientes y Usuarios Operativos
- **Cliente Objetivo**: Empresas industriales y plantas de manufactura por lotes que requieren articular su ingeniería de producto (BOM/rutas) y control de piso de planta con las áreas de Ventas, Inventario, Compras, Contabilidad y RRHH/Mantenimiento.
- **Usuarios Operativos**:
  - **Ingeniero de Producto / Planificador MRP**: Administra `Productos` (`Entity`), define `unitOfMeasure`, `standardUnitCost` y `targetDate`, y emite `Órdenes de Producción` (`Document`) vinculando `id_bom` e `id_ruta`.
  - **Jefe de Planta / Supervisor de Operaciones**: Gestiona el avance de órdenes en planta (`planificada` → `en_proceso`), asigna `id_centro_trabajo` y registra `tiempo_real`.
  - **Inspector de Control de Calidad y Bodega**: Audita los lotes en `control_calidad`, verifica `cantidad_consumida` y aprueba la transición a `completada` o `cancelada`.
  - **Analista de Costos y Finanzas**: Contrasta `standardUnitCost` y `creditLimit` frente a `subtotal`, `discount`, `taxAmount` y `totalAmount`.

### 2. Manejo de Riesgos de Datos y Protección de Datos Sensibles en Frontend
- **Sanitización contra XSS en `localStorage`**: Los campos `taxId` (RUT fiscal), `email`, `phone`, fórmulas (`id_bom`, `description`) y estructura de costos (`standardUnitCost`, `totalAmount`) son datos sensibles de negocio. Todo input de usuario se recorta (`trim`) y se escapa antes de renderizarse en el DOM para impedir ataques de inyección de scripts (XSS).
- **Integridad Referencial, Cascada e Inmutabilidad**: `src/storage.js` impide crear órdenes con un `entity_id` inexistente y aplica borrado en cascada al eliminar un `Producto`. Los movimientos de stock (`sub_consumos_salidas`) se modelan como un registro *append-only* (las correcciones se hacen con movimientos compensatorios).

### 3. Mitigación de Sesgos Operativos
- **Sesgo de subreporte en planta (*Reporting Bias*)**: Se mitiga separando la etapa de ejecución (`en_proceso`) de la etapa de validación (`control_calidad`) en `statusLifecycle` para auditar `tiempo_real` y `cantidad_consumida`.
- **Sesgo de supervivencia (*Survivorship Bias*)**: Se mitiga mediante el estado terminal `cancelada` en `statusLifecycle`, conservando los lotes fallidos en las métricas históricas en lugar de eliminarlos.
- **Sesgo de desactualización técnica (*Stale Baseline Bias*)**: Se mitiga mediante el campo `targetDate` (fecha de revisión de ingeniería), la restricción de una única versión `activo = true` en `sub_listas_bom` y el congelamiento de `id_bom` e `id_ruta` al pasar la orden a `en_proceso`.

## Límites del Alcance (Fuera de Alcance del MVP)

Quedan explícitamente fuera del alcance operativo del MVP inicial (y documentados en `specs/001-erp-base-module/plan.md` y `specs/001-erp-base-module/data-model.md`):
- **Explosión automática recursiva de MRP multinivel** y generación automática de órdenes de compra.
- **Programación de capacidad finita por minuto (CRP)** y reservas bloqueantes de stock.
- **Tablas de factores de conversión cruzada** entre unidades de medida o monedas.
- **Trazabilidad unitaria por número de serie individual de pieza**.
- **Servidores backend o motores de bases de datos externos** (toda la persistencia reside en `localStorage`).

## Flujo de Trabajo con Spec Kit y Documentos del Repositorio

1. `/speckit.constitution` — Verifica los principios rectores en `.specify/memory/constitution.md` ([https://github.com/MDS-BI/Grupo-15/blob/main/.specify/memory/constitution.md](https://www.google.com/search?q=https://github.com/MDS-BI/Grupo-15/blob/main/.specify/memory/constitution.md)).
2. `/speckit.specify` — Mantiene la especificación funcional en `specs/001-erp-base-module/spec.md` ([https://github.com/MDS-BI/Grupo-15/blob/main/specs/001-erp-base-module/spec.md](https://www.google.com/search?q=https://github.com/MDS-BI/Grupo-15/blob/main/specs/001-erp-base-module/spec.md)).
3. `/speckit.clarify` — Resuelve ambigüedades sobre variables, sub-entidades y conexiones inter-áreas.
4. `/speckit.plan` — Define la arquitectura técnica y el modelo de datos en `specs/001-erp-base-module/plan.md` ([https://github.com/MDS-BI/Grupo-15/blob/main/specs/001-erp-base-module/plan.md](https://www.google.com/search?q=https://github.com/MDS-BI/Grupo-15/blob/main/specs/001-erp-base-module/plan.md)) y `specs/001-erp-base-module/data-model.md` ([https://github.com/MDS-BI/Grupo-15/blob/main/specs/001-erp-base-module/data-model.md](https://www.google.com/search?q=https://github.com/MDS-BI/Grupo-15/blob/main/specs/001-erp-base-module/data-model.md)).
5. `/speckit.tasks` — Desglosa el plan en las tareas ejecutables de `specs/001-erp-base-module/tasks.md` ([https://github.com/MDS-BI/Grupo-15/blob/main/specs/001-erp-base-module/tasks.md](https://www.google.com/search?q=https://github.com/MDS-BI/Grupo-15/blob/main/specs/001-erp-base-module/tasks.md)).
6. `/speckit.analyze` — Audita la consistencia cruzada entre `spec.md`, `plan.md`, `data-model.md` y `tasks.md`.
7. `/speckit.implement` — Ejecuta la adaptación en `src/module-config.js` ([https://github.com/MDS-BI/Grupo-15/blob/main/src/module-config.js](https://www.google.com/search?q=https://github.com/MDS-BI/Grupo-15/blob/main/src/module-config.js)) y valida con Vitest.

## Configuración, Pre-requisitos e Inicio Rápido

### Pre-requisitos de Entorno
- **Node.js**: versión `>= 18.0.0 LTS` (recomendado `v20 LTS`).
- **Gestor de paquetes**: `npm >= 9.0.0`.
- **Navegador web moderno**: Chrome, Edge, Firefox o Safari con `localStorage` habilitado.

### Pasos de Instalación y Ejecución Local
1. Clonar el repositorio oficial del **Grupo 15** e ingresar al directorio del proyecto:
   ```bash
   git clone https://github.com/MDS-BI/Grupo-15.git
   cd Grupo-15
   ```
2. Instalar las dependencias locales:
   ```bash
   npm install
   ```
3. Iniciar el servidor de desarrollo local con Vite:
   ```bash
   npm run dev
   ```
4. Abrir en el navegador la URL indicada en consola (por defecto `http://localhost:5173`).
5. Ejecutar la suite completa de pruebas automatizadas (unitarias y de integración) con Vitest:
   ```bash
   npm test
   # o en ejecución única sin modo interactivo:
   npx vitest run
   ```

## Bitácora de Toma de Decisiones del Equipo (Trazabilidad / Issues)

Seguimiento en el tablero de Issues del repositorio: [https://github.com/MDS-BI/Grupo-15/issues](https://www.google.com/search?q=https://github.com/MDS-BI/Grupo-15/issues)

| ID Hito / Issue | Fecha | Decisión Metodológica y Justificación Técnica | Archivos Impactados |
| :--- | :--- | :--- | :--- |
| `Issue #1` ([https://github.com/MDS-BI/Grupo-15/issues](https://www.google.com/search?q=https://github.com/MDS-BI/Grupo-15/issues)) | 2026-10-20 | **Definición de Entidad Maestra y Documento Transaccional General**: Se acordó mapear `Entity` a `Producto` y `Document` a `Orden de Producción` manteniendo un enfoque general de Manufactura y Operaciones y preservando los 32 campos base del template para garantizar compatibilidad en `localStorage` con el resto del curso. | `README.md`, `plan.md`, `data-model.md`, `spec.md` |
| `Issue #2` ([https://github.com/MDS-BI/Grupo-15/issues](https://www.google.com/search?q=https://github.com/MDS-BI/Grupo-15/issues)) | 2026-10-20 | **Normalización en 3FN y Reducción de `customFields`**: Se redujeron los `customFields` a 6 variables esenciales (`unitOfMeasure`, `standardUnitCost`, `id_bom`, `id_ruta`, `id_centro_trabajo`, `tiempo_real`) y se desacoplaron las relaciones `1:N` en 4 sub-entidades modulares (`sub_listas_bom`, `sub_rutas_operaciones`, `sub_centros_trabajo`, `sub_consumos_salidas`) conectadas con 5 áreas de la empresa. | `data-model.md`, `plan.md`, `src/module-config.js`, `mer_manufactura_operaciones.png` |
| `Issue #3` ([https://github.com/MDS-BI/Grupo-15/issues](https://www.google.com/search?q=https://github.com/MDS-BI/Grupo-15/issues)) | 2026-10-22 | **Resumen de Trazabilidad en Solo Lectura (Alternativa 2 Ligera) e Invariantes de Dominio**: Se incorporó la matriz de alcance (*Incluido vs. Pospuesto*), la tarjeta de trazabilidad en solo lectura en el Panel y detalle de Orden sin alterar las 4 vistas de la plantilla, la prohibición de ciclos en `sub_listas_bom`, el congelamiento de receta/ruta al pasar a `en_proceso` y la regla *append-only* en `sub_consumos_salidas`. | `plan.md`, `data-model.md`, `spec.md`, `tasks.md`, `README.md` |

## Anexo Obligatorio de Política de Uso de IA Generativa

Conforme a la política del curso (diapositiva 13 de `MDS_SDD_taller.pdf`), se detallan los modelos de IA generativa utilizados fuera de los comandos internos de Spec Kit, su objetivo, fecha y los prompts empleados:

| Fecha | Modelo Utilizado | Objetivo Específico | Prompt Empleado |
| :--- | :--- | :--- | :--- |
| 2026-10-20 | Gemini (Modo Agente de Tareas) | Analizar la rúbrica e instructivo del curso y estructurar el plan de trabajo SDD, `plan.md`, `README.md` y `data-model.md` para Manufactura y Operaciones. | *"En base a la descripción anterior Crea un plan .md con base en la plantilla que esté pensado para el área de manufactura y operaciones. También crea un archivo .redme que tenga dos párrafos definiendo de en qué se va a centrar el producto la aplicación y cómo se va a llevar a cabo. Y también genera en el data model un apartado para el modelo entidad relación. Y que todo esto compartan las mismas variables y siga lo dicho en la Constitución"* |
| 2026-10-20 | Gemini (Modo Agente de Tareas) | Modularizar el Modelo Entidad-Relación en 3 capas de prioridad (núcleo base ligero, 4 sub-entidades en 3FN y conexión con 5 áreas de la empresa) y generar `mer_manufactura_operaciones.png`, `spec.md`, `tasks.md` y `src/module-config.js`. | *"En cuanto al modelo entidad relación, podrías crear más sub entidades y reducir la cantidad de cosas que tengan las entidades principales... Recuerda agregarle módulos que conecten que sean posibles áreas de la empresa que tenga un sentido o relación con el área de manufactura y operaciones, ya sea el área de ventas, el área de inventario y así."* |
| 2026-10-21 | OpenCode (`.specify/integrations/opencode.manifest.json`) | Ejecutar comandos de especificación de Spec Kit y generar propuestas de tabla de trazabilidad del enunciado al modelo, diagramas de estados (`stateDiagram-v2`) y sección de Fuera de Alcance (*Out of Scope*). | *Ejecución de flujos `/speckit.specify` y `/speckit.plan` en entorno local con OpenCode para contrastar cobertura de invariantes de negocio y límites del MVP.* |
| 2026-10-21 | GitHub Copilot (`.specify/integrations/copilot.manifest.json`) | Asistencia en autocompletado y revisión de sintaxis de configuración en VS Code durante la inspección de `tests/` y `src/module-config.js`. | *Autocompletado contextual en el editor VS Code sobre las estructuras de validación de `ModuleConfig` y pruebas unitarias en Vitest.* |
| 2026-10-22 | Gemini (Modo Agente de Tareas) | Auditoría técnica y metodológica cruzada de `plan.md`, `data-model.md`, `README.md`, `spec.md`, `tasks.md` y `src/module-config.js` e integración con el repositorio `https://github.com/MDS-BI/Grupo-15`. | *"Actúa como Auditor Técnico Principal y Evaluador Académico de la carrera de Ingeniería Civil Industrial en la Universidad de Concepción para la asignatura Modelación de Sistemas... Realiza esas 4 correcciones y actualiza el paquete .zip y los archivos."* |
