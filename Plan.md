# Plan de Implementación: Módulo ERP de Manufactura y Operaciones (Grupo 15)

**Rama**: `001-erp-base-module` | **Fecha**: 2026-10-22 | **Especificación**: `specs/001-erp-base-module/spec.md` ([https://github.com/MDS-BI/Grupo-15/blob/main/specs/001-erp-base-module/spec.md](https://www.google.com/search?q=https://github.com/MDS-BI/Grupo-15/blob/main/specs/001-erp-base-module/spec.md))  
**Repositorio Oficial**: [`https://github.com/MDS-BI/Grupo-15`](https://github.com/MDS-BI/Grupo-15)  
**Entrada**: Especificación de la funcionalidad desde `/specs/001-erp-base-module/spec.md`

## Resumen

Construir y configurar una aplicación web de página única (SPA) con Vite, HTML, CSS y JavaScript vanilla (ES2022) que adapte el módulo base de Planificación de Recursos Empresariales (ERP) al área general de **Manufactura y Operaciones**, operando exclusivamente con persistencia local en el navegador (`localStorage`). La arquitectura se organiza en tres capas de prioridad técnica sin alejarse de la plantilla base del curso:
1. **Prioridad 1 — Núcleo Base (`Entity` y `Document`)**: Conserva sin alteraciones de esquema los 15 campos base de `Entity` (**Producto**) y los 17 campos base de `Document` (**Orden de Producción**) gestionados por `src/storage.js`, declarando en `src/module-config.js` únicamente **6 campos personalizados (`customFields`)**: `unitOfMeasure` y `standardUnitCost` en `Entity`; `id_bom`, `id_ruta`, `id_centro_trabajo` y `tiempo_real` en `Document`, además del ciclo de vida controlado `statusLifecycle` y el token CSS `--accent: #d97706`.
2. **Prioridad 2 — Sub-Entidades Modulares de Manufactura en 3FN**: Desacopla las relaciones `1:N` del dominio industrial en **4 sub-entidades en Tercera Forma Normal (3FN)** (`sub_listas_bom`, `sub_rutas_operaciones`, `sub_centros_trabajo` y `sub_consumos_salidas`), evitando sobrecargar los formularios principales y mostrando un bloque ligero de trazabilidad en solo lectura (`#traceability-summary`) dentro del Panel (`dashboard.js`) y del detalle de `Orden de Producción` (`document-form.js`).
3. **Prioridad 3 — Contratos de Interconexión Empresarial**: Estandariza las llaves y variables compartidas para conectar en sesión local con **5 áreas de la empresa**: **Ventas y Comercial (CRM)**, **Inventario y Bodega (SCM)**, **Compras y Proveedores (SRM)**, **Contabilidad y Finanzas**, y **RRHH y Mantenimiento (EAM)**.

## Contexto Técnico

**Lenguaje/Versión**: JavaScript (ES2022), HTML5, CSS3  
**Dependencias Principales**: Vite (`^8.2.1`), sin frameworks de interfaz adicionales  
**Almacenamiento**: `localStorage` del navegador (`erp_base_module:entities` y `erp_base_module:documents`, particionable en `erp_base_module:sub:*`)  
**Pruebas**: Vitest (`^4.1.10`) con `jsdom` (`^30.0.1`) para pruebas unitarias y de integración en el DOM (`vitest.config.mjs` con `fileParallelism: false`)  
**Plataforma Objetivo**: Navegadores modernos de escritorio y dispositivos móviles de planta  
**Tipo de Proyecto**: Aplicación web SPA (exclusivamente frontend)  
**Objetivos de Rendimiento**: Renderizado de listas, cálculo de estadísticas y filtrado de búsqueda inferiores a 50 ms para colecciones de hasta 500 registros  
**Restricciones**: Sin backend, sin APIs externas y sin motores de bases de datos de servidor; adaptación centralizada en `src/module-config.js` respetando los 32 nombres de campos base de `specs/001-erp-base-module/data-model.md`  
**Escala/Alcance**: Módulo general de Manufactura y Operaciones con CRUD maestro (`Producto`) y transaccional (`Orden de Producción`), máquina de estados de fabricación, búsqueda multicriterio y resumen de trazabilidad en solo lectura hacia las 4 sub-entidades en 3FN y las 5 áreas empresariales

## Verificación de la Constitución

*COMPROBACIÓN: Verificada contra `.specify/memory/constitution.md` (v1.0.0) antes de la investigación de la Fase 0 y reverificada tras el diseño del Modelo de Datos en 3FN de la Fase 1.*

- **I. Calidad de Código y Mantenibilidad**: Código JavaScript modular con separación estricta entre la capa de persistencia (`src/storage.js`), los componentes de interfaz (`src/components/`) y la configuración declarativa del dominio (`src/module-config.js`). Nomenclatura camelCase unificada, recorte de cadenas (`trim`) y sanitización obligatoria de salida en el DOM para mitigar inyecciones XSS.
- **II. Desarrollo Guiado por Pruebas (Test-First) y Verificación**: Cobertura automatizada en Vitest (`tests/unit/` y `tests/integration/`) para los flujos de crear, editar, eliminar en cascada y buscar `Productos` y `Órdenes de Producción`, validaciones de rangos y formatos de los 6 `customFields`, y bloqueo de transiciones no permitidas en `statusLifecycle`.
- **III. Consistencia de Experiencia de Usuario**: Marco de trabajo ERP persistente (`shell.js`: barra superior con monograma SVG `"MO"` y barra lateral colapsable con las 4 vistas estándar `Panel`, `Productos`, `Órdenes de Producción` y `Búsqueda`), aplicación global del token CSS `--accent: #d97706` (con respaldo seguro a `#2563eb`), reetiquetado uniforme en español (`Producto` / `Orden de Producción`), estados vacíos explícitos y resumen ligero de trazabilidad en solo lectura sin alterar el flujo de navegación de la plantilla.
- **IV. Rendimiento y Fiabilidad**: Operaciones de filtrado y agregación ejecutadas en memoria sobre la colección deserializada de `localStorage` y actualizaciones acotadas del DOM para sostener tiempos de respuesta menores a 50 ms con hasta 500 registros.

## Alcance del Dominio y Fuera de Alcance (Out of Scope)

### 1. Matriz de Alcance del Dominio

| Dominio de Manufactura y Operaciones | Estado en el MVP | Implementación en la Arquitectura Frontend |
| :--- | :--- | :--- |
| **Catálogo Maestro de Productos (`Entity`)** | **Incluido (Prioridad 1)** | CRUD sobre `erp_base_module:entities` con 15 campos base + `unitOfMeasure` y `standardUnitCost`. |
| **Órdenes de Producción y Costeo de Lote (`Document`)** | **Incluido (Prioridad 1)** | CRUD sobre `erp_base_module:documents` con 17 campos base + `id_bom`, `id_ruta`, `id_centro_trabajo`, `tiempo_real` y `statusLifecycle`. |
| **Panel de Control, Estadísticas en Vivo y Búsqueda** | **Incluido (Prioridad 1)** | Implementado en `dashboard.js`, `shell.js` y pantalla de búsqueda multicriterio hasta 500 registros. |
| **Enlace y Resumen de Trazabilidad con 4 Sub-Entidades (3FN)** | **Incluido como Contrato Modular y Vista Ligera (Prioridad 2)** | Vinculado desde `Document` (`id_bom`, `id_ruta`, `id_centro_trabajo`) hacia `sub_listas_bom`, `sub_rutas_operaciones`, `sub_centros_trabajo` y `sub_consumos_salidas`, con resumen en solo lectura en el Panel y detalle de Orden sin alterar las 4 vistas base. |
| **Contratos de Interconexión con 5 Áreas de la Empresa** | **Incluido como Contrato ERP y Vista Ligera (Prioridad 3)** | Intercambio en sesión local mediante las variables compartidas (`entity_id`, `code`, `series`, `folio`, `quantity`, `totalAmount`, `status`) con Ventas, Inventario, Compras, Contabilidad y RRHH/Mantenimiento. |
| **Motor de Explosión MRP Multinivel Automático** | **Fuera de Alcance (Pospuesto)** | No se ejecutan corridas automáticas recursivas de requerimientos netos ni emisión automática de órdenes de compra. |
| **Planificación de Capacidad Finita (CRP) y Reservas** | **Fuera de Alcance (Pospuesto)** | No se agenda el uso de máquinas por minuto ni se bloquean saldos de inventario previos a la ejecución de la orden. |
| **Conversión Dinámica Multi-UoM y Multimoneda** | **Fuera de Alcance (Pospuesto)** | Cada `Producto` opera en su `unitOfMeasure` base (`UN`, `KG`, `LT`, `MT`) y cada `Orden de Producción` en su `currency` declarada. |
| **Trazabilidad Unitaria por Número de Serie** | **Fuera de Alcance (Pospuesto)** | El seguimiento se realiza por lote documental (`series` + `folio`), no por número de serie individual de pieza. |
| **Backend y Motores de Base de Datos Externos** | **Fuera de Alcance (Pospuesto)** | Por especificación de la asignatura, el proyecto no utiliza servidores backend ni bases de datos externas; toda la persistencia reside en `localStorage`. |

## Definición del Problema, Solución Propuesta y Usuarios (Alineación con Rúbrica)

### Problema Operacional
En empresas manufactureras, la desarticulación entre el catálogo técnico de productos (especificaciones, recetas BOM y rutas de fabricación) y la emisión de órdenes de producción en piso de planta genera lotes fabricados con versiones obsoletas de recetas, subregistro de tiempos de máquina y mermas, desfases de stock respecto a bodega y desviaciones no controladas entre el costo estándar unitario y el costo real ejecutado por lote.

### Solución Propuesta (MVP)
Un módulo ERP general de Manufactura y Operaciones en frontend donde:
1. **`Entity` (`Producto`)** centraliza el dato maestro del artículo reutilizando los 15 campos base del template más 2 atributos técnicos (`unitOfMeasure`, `standardUnitCost`).
2. **`Document` (`Orden de Producción`)** registra cada lote de fabricación vinculado a un `Producto` mediante `entity_id`, reutilizando los 17 campos base (numeración `series`/`folio`, fechas `startDate`/`endDate`, cantidad `quantity`, costeo `subtotal`/`discount`/`taxAmount`/`totalAmount`, estado `status`) más 4 llaves operativas (`id_bom`, `id_ruta`, `id_centro_trabajo`, `tiempo_real`).
3. **Sub-entidades en 3FN y Resumen de Trazabilidad ERP (Alternativa 2 Ligera)** estructuran las relaciones normalizadas hacia `sub_listas_bom`, `sub_rutas_operaciones`, `sub_centros_trabajo` y `sub_consumos_salidas`, presentando un resumen de trazabilidad en solo lectura en el Panel (`dashboard.js`) y en el formulario de `Orden de Producción` (`document-form.js`) que muestra los indicadores operativos y las variables compartidas con Ventas, Inventario, Compras, Contabilidad y RRHH/Mantenimiento sin añadir pestañas extra a la plantilla.

### Clientes y Usuarios del Sistema
- **Cliente (Comprador / Administrador del ERP)**: Empresas manufactureras y plantas de producción por lotes que requieren integrar su operación industrial con las áreas comerciales, logísticas y contables bajo un mismo estándar de datos.
- **Usuarios Operativos Finales**:
  - **Ingeniero de Producto / Planificador MRP**: Administra el catálogo de `Productos` (`Entity`), define `unitOfMeasure`, `standardUnitCost` y `targetDate`, y emite `Órdenes de Producción` (`Document`) en estado `planificada` asignando `id_bom` e `id_ruta`.
  - **Jefe de Planta / Supervisor de Operaciones**: Opera el panel de inicio (`dashboard.js`), asigna el centro de trabajo (`id_centro_trabajo`), transiciona las órdenes a `en_proceso` y registra el `tiempo_real` consumido.
  - **Inspector de Control de Calidad y Bodega**: Evalúa lotes en estado `control_calidad`, registra observaciones en `notes`, verifica consumos (`cantidad_consumida`) y aprueba el paso a `completada` o `cancelada`.
  - **Analista de Costos Operacionales**: Audita el costo total de cada orden (`subtotal`, `discount`, `taxAmount`, `totalAmount`) frente al `standardUnitCost` y al techo presupuestario (`creditLimit`).

## Especificación de Adaptación en `src/module-config.js` y Mapeo de Variables

El diccionario completo de las 32 variables base (`15` de `Entity` y `17` de `Document`), sus tipos y restricciones formales se encuentra en `specs/001-erp-base-module/data-model.md` (§1.1 y §1.2, [https://github.com/MDS-BI/Grupo-15/blob/main/specs/001-erp-base-module/data-model.md](https://www.google.com/search?q=https://github.com/MDS-BI/Grupo-15/blob/main/specs/001-erp-base-module/data-model.md)). A continuación se especifica la configuración declarativa y el mapeo semántico del módulo:

### 1. Parámetros de `ModuleConfig` (`src/module-config.js`)
- `moduleName`: `"Manufactura y Operaciones"`
- `labels`: `{ entity: "Producto", entities: "Productos", document: "Orden de Producción", documents: "Órdenes de Producción" }`
- `theme`: `{ accentColor: "#d97706" }` (aplicado en `document.documentElement.style` como `--accent: #d97706`, con respaldo a `#2563eb`)
- `statusLifecycle`:
  - `statuses`: `["planificada", "en_proceso", "control_calidad", "completada", "cancelada"]`
  - `transitions`: `planificada` → `["en_proceso", "cancelada"]`, `en_proceso` → `["control_calidad", "cancelada"]`, `control_calidad` → `["completada", "en_proceso", "cancelada"]`, `completada` → `[]`, `cancelada` → `[]`.

### 2. Especificación de los 6 Campos Personalizados (`customFields`)

| Destino (`target`) | Clave (`key`) | Etiqueta (`label`) | Tipo (`type`) | Restricciones / Opciones | Descripción Técnica Unificada |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `"entity"` | `unitOfMeasure` | `Unidad de Medida` | `select` | Obligatorio; `["UN", "KG", "LT", "MT"]` | Define la unidad física estándar en la que se cuantifica, inventaría y fabrica el producto en toda la empresa. |
| `"entity"` | `standardUnitCost` | `Costo Estándar Unitario` | `number` | Obligatorio; `>= 0` | Representa el costo teórico unitario de fabricación del producto, utilizado como referencia base para valorizar inventarios y medir desviaciones en Contabilidad. |
| `"document"` | `id_bom` | `ID Lista de Materiales (BOM)` | `text` | Obligatorio; no vacío | Llave foránea que identifica la receta activa en la sub-entidad `sub_listas_bom` (p. ej., `"BOM-001-V1"`) con la que se fabricará el lote. |
| `"document"` | `id_ruta` | `ID Ruta de Producción` | `text` | Obligatorio; no vacío | Llave foránea que identifica la secuencia de operaciones en la sub-entidad `sub_rutas_operaciones` (p. ej., `"RUTA-ENS-01"`) aplicada a la orden. |
| `"document"` | `id_centro_trabajo` | `ID Centro de Trabajo` | `select` | Obligatorio; `["CT-01 Ensamble", "CT-02 Maquinado", "CT-03 Procesos", "CT-04 Empaque"]` | Llave foránea que vincula la orden con la estación o línea principal en la sub-entidad `sub_centros_trabajo` responsable de la ejecución. |
| `"document"` | `tiempo_real` | `Tiempo Real de Ejecución (h)` | `number` | Obligatorio; `>= 0` | Total de horas reales empleadas en ejecutar la orden en planta, utilizado para medir eficiencia frente a `tiempo_estandar` y reportar horas a RRHH/Costos. |

### 3. Resumen de Sub-Entidades Modulares (Prioridad 2) e Interconexión ERP (Prioridad 3)

| Nivel | Identificador | Clave Primaria (`PK`) | Llaves Foráneas (`FK`) y Variables Compartidas | Rol en la Arquitectura |
| :--- | :--- | :--- | :--- | :--- |
| **Prioridad 2** | `sub_listas_bom` | `id_bom` | `entity_id` (`FK`), `id_producto_componente` (`FK`), `cantidad_requerida`, `version`, `activo` | Normaliza recetas e insumos requeridos por unidad fuera de `Entity`. |
| **Prioridad 2** | `sub_rutas_operaciones` | `id_ruta` | `entity_id` (`FK`), `id_centro_trabajo` (`FK`), `numero_secuencia`, `nombre_operacion`, `tiempo_estandar` | Normaliza secuencias de fabricación y tiempos estándar teóricos. |
| **Prioridad 2** | `sub_centros_trabajo` | `id_centro_trabajo` | `nombre`, `address` (almacén/nave), `capacidad_por_hora`, `status` (`"operativo" \| "en_mantencion" \| "detenido"`) | Catálogo maestro de estaciones y capacidad instalada por hora en 3FN. |
| **Prioridad 2** | `sub_consumos_salidas` | `id_movimiento` | `id` (`FK` → `Document.id`), `entity_id` (`FK` → `Entity.entity_id`), `cantidad_consumida`, `quantity`, `fecha_movimiento` | Registro inmutable (*append-only*) de consumos de insumos y altas de terminados. |
| **Prioridad 3** | **Ventas y Comercial (CRM)** | — | `entity_id`, `code`, `series`, `folio`, `quantity`, `startDate`, `endDate`, `status` | Enlaza pedidos de clientes con órdenes de producción y fechas de entrega. |
| **Prioridad 3** | **Inventario y Bodega (SCM)** | — | `entity_id`, `code`, `address`, `unitOfMeasure`, `cantidad_consumida`, `quantity` | Sincroniza descuento de materias primas y recepción de productos terminados. |
| **Prioridad 3** | **Compras y Proveedores (SRM)** | — | `entity_id`, `code`, `id_bom`, `cantidad_requerida`, `taxId`, `email`, `phone`, `paymentTerms`, `targetDate` | Determina requerimientos de compra de insumos según receta BOM y proveedor. |
| **Prioridad 3** | **Contabilidad y Finanzas** | — | `entity_id`, `series`, `folio`, `creditLimit`, `standardUnitCost`, `subtotal`, `discount`, `taxAmount`, `totalAmount`, `currency` | Controla presupuestos por partida y liquida costos reales por lote fabricado. |
| **Prioridad 3** | **RRHH y Mantenimiento (EAM)** | — | `id_centro_trabajo`, `tiempo_estandar`, `tiempo_real`, `capacidad_por_hora`, `targetDate`, `status` | Coordina turnos operativos, productividad laboral y mantenciones preventivas. |

## Método de Análisis, Variables Críticas y Herramientas de Estimación

| Indicador / Herramienta de Estimación | Fórmula con Variables del Modelo | Aplicación en la Toma de Decisiones |
| :--- | :--- | :--- |
| **Desviación de Costo Unitario** | `(totalAmount / quantity) - standardUnitCost` | Cuantifica el sobrecosto o ahorro real por unidad fabricada respecto al estándar de ingeniería. |
| **Eficiencia Operativa de Ruta** | `(tiempo_estandar * quantity) / tiempo_real` | Evalúa el rendimiento de ejecución del lote en el `id_centro_trabajo` asignado. |
| **Variación de Consumo de Materiales (Merma)** | `cantidad_consumida - (cantidad_requerida * quantity)` | Mide la pérdida o sobreconsumo de insumos en planta frente a la receta `id_bom`. |
| **Índice de Ocupación de Capacidad** | `quantity / (capacidad_por_hora * tiempo_real)` | Estima el grado de utilización efectiva del centro de trabajo para comprometer fechas (`endDate`) con Ventas. |

## Análisis de Escalabilidad, Riesgos de Datos y Mitigación de Sesgos

1. **Escalabilidad Modular en el Frontend (`localStorage`)**:
   - El aislamiento de la capa de datos en `src/storage.js` permite escalar el módulo en el navegador sin modificar el núcleo base: las entidades principales operan en `erp_base_module:entities` y `erp_base_module:documents`, mientras que las 4 sub-entidades modulares operan bajo claves particionadas independientes (`erp_base_module:sub:listas_bom`, `erp_base_module:sub:rutas_operaciones`, `erp_base_module:sub:centros_trabajo`, `erp_base_module:sub:consumos_salidas`). Asimismo, la estandarización de llaves públicas (`entity_id`, `code`, `series`, `folio`) permite que otros módulos ERP ejecutados en el mismo dominio del navegador lean e integren los registros directamente desde `localStorage`.
2. **Manejo de Riesgos de Datos y Datos Sensibles**:
   - **Integridad referencial y borrado en cascada**: Se rechaza toda creación de `Orden de Producción` cuyo `entity_id` no exista en `erp_base_module:entities`, y al eliminar un `Producto` se eliminan en cascada sus órdenes dependientes (`deleteDocumentsForEntity`). En `sub_consumos_salidas` los registros siguen una política *append-only* (las correcciones se efectúan mediante movimientos compensatorios).
   - **Protección de datos sensibles y prevención de XSS**: Los campos `taxId` (RUT de proveedor), `email`, `phone`, costos (`standardUnitCost`, `subtotal`, `totalAmount`) y especificaciones (`description`, `id_bom`) se consideran sensibles. El frontend escapa todo carácter HTML especial (`&`, `<`, `>`, `"`, `'`) y utiliza `textContent` al renderizar valores en el DOM, bloqueando ataques de Cross-Site Scripting (XSS) provenientes de datos manipulados en `localStorage`.
3. **Identificación y Mitigación de Sesgos en los Datos**:
   - **Sesgo de subreporte en piso de planta (*Reporting Bias*)**: Los operadores pueden subdeclarar `tiempo_real` o `cantidad_consumida` para aparentar mayor eficiencia frente a `tiempo_estandar` y `cantidad_requerida`. **Mitigación**: Separación obligatoria entre el estado de ejecución (`en_proceso`) y el de auditoría (`control_calidad`) en `statusLifecycle` antes de permitir el cierre en `completada`.
   - **Sesgo de supervivencia (*Survivorship Bias*)**: Si las órdenes defectuosas o abortadas se eliminan, el costo promedio histórico y la eficiencia aparente de planta se sesgan positivamente. **Mitigación**: Incorporación del estado terminal `cancelada` en `statusLifecycle` para conservar el registro histórico de órdenes abortadas sin borrarlas.
   - **Sesgo de línea base desactualizada (*Stale Baseline Bias*)**: Evaluar desviaciones contra un `standardUnitCost` o una receta `id_bom` obsoleta distorsiona los indicadores financieros. **Mitigación**: Control de fecha de revisión obligatoria mediante `targetDate` en `Entity` y restricción de una única versión con `activo = true` por producto en `sub_listas_bom`.

## Estructura del Proyecto

### Documentación (esta funcionalidad)

```text
specs/001-erp-base-module/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── entity-storage.md
└── tasks.md
```

### Código Fuente (raíz del repositorio)

```text
index.html
src/
├── main.js
├── styles.css
├── storage.js
├── app.js
├── module-config.js
└── components/
    ├── shell.js         (marco del espacio de trabajo: barra superior, logotipo SVG "MO", barra lateral, estado de módulo activo)
    ├── dashboard.js     (vista de inicio: cuadrícula de 4 acciones rápidas + tarjetas de estadísticas en vivo + resumen ligero de trazabilidad ERP)
    ├── entity-form.js   (formulario de creación/edición de Productos con los 2 customFields)
    └── document-form.js (formulario de creación/edición de Órdenes de Producción con los 4 customFields, statusLifecycle y resumen de enlace en solo lectura)

tests/
├── unit/
│   ├── module-config.test.js
│   └── storage.test.js
└── integration/
    ├── add-document.test.js
    ├── create-entity.test.js
    ├── custom-fields.test.js
    ├── dashboard.test.js
    ├── edit-delete-entity.test.js
    ├── manage-document.test.js
    ├── manage-tabs.test.js
    ├── relabeling.test.js
    ├── search-entities.test.js
    └── workspace-shell.test.js
```

**Decisión de Estructura**: Se utiliza la estructura oficial de la plantilla del curso en Vite con un único punto de entrada HTML (`index.html`), módulos JavaScript ES2022 desacoplados y hojas de estilo basadas en tokens de diseño CSS (`--accent` en `src/styles.css`), empleando `localStorage` (`src/storage.js`) para mantener la aplicación autónoma y libre de dependencias de servidor. Los componentes se dividen en el par `entity-form.js` (datos maestros: `Producto`) y `document-form.js` (registros transaccionales: `Orden de Producción`), envueltos por `shell.js` (barra superior con monograma SVG derivado y barra lateral colapsable de 4 vistas) y `dashboard.js` (4 acciones rápidas, contadores en vivo y bloque ligero de trazabilidad en solo lectura hacia las 4 sub-entidades y las 5 áreas empresariales sin modificar la navegación de la plantilla). `src/module-config.js` centraliza tanto el motor de validación de configuración (`DEFAULT_CONFIG`, `BASE_FIELDS`, `FIELD_TYPES`, `normalizeConfig`, `loadModuleConfig`, `setActiveConfig`, `getConfig`, `labelFor`) como el perfil `userConfig` y los contratos modulares de Manufactura y Operaciones.

## Seguimiento de Complejidad

Este plan no introduce violaciones a la Constitución del proyecto.

## Referencias Metodológicas y Técnicas

- Microsoft Developer Blog (2025). *Spec-Driven Development: AI-Native Engineering with GitHub Spec Kit*. [`https://developer.microsoft.com/blog/spec-driven-development-ai-native-engineering/`](https://developer.microsoft.com/blog/spec-driven-development-ai-native-engineering/)
- ISA-95 / IEC 62264 Standard. *Enterprise-Control System Integration (Manufacturing Operations Management, Work Masters, Personnel, Equipment, and Material Models)*.
- APICS / ASCM Dictionary (17th Ed.). *Bill of Materials (BOM), Routing, Work Center, and Production Order Lifecycle Standards*.
