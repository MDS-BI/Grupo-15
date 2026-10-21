# Plan de Implementación: Módulo ERP de Manufactura y Operaciones (Núcleo Base + Sub-Entidades Modulares + Interconexión Empresarial)

**Rama**: `001-erp-base-module` | **Fecha**: 2026-10-20 | **Especificación**: `specs/001-erp-base-module/spec.md`
**Entrada**: Adaptación del Módulo Base ERP hacia el área de Manufactura y Operaciones mediante Spec Driven Development (SDD), estructurada en 3 niveles de prioridad: (1) Entidades Base del Template (`Entity` = `Producto` y `Document` = `Orden de Producción`), (2) Sub-Entidades Modulares de Manufactura para escalabilidad, y (3) Conexión nativa con los Módulos de Ventas, Inventario, Compras, Contabilidad y RRHH/Mantenimiento.

## Resumen

Construir y configurar una aplicación web ligera con Vite que adapte el módulo base de Planificación de Recursos Empresariales (ERP) al área de **Manufactura y Operaciones**. El diseño sigue una arquitectura modular y escalable de tres capas:
1. **Capa 1 — Núcleo Base Prioritario (`Entity` y `Document`)**: Conserva intactos los 15 campos base de `Entity` (**Producto**) y los 17 campos base de `Document` (**Orden de Producción**) en `localStorage`, agregando únicamente **6 campos personalizados (`customFields`)** en `src/module-config.js` (`unitOfMeasure` y `standardUnitCost` en `Entity`; `id_bom`, `id_ruta`, `id_centro_trabajo` y `tiempo_real` en `Document`) para mantener las entidades principales limpias y ligeras.
2. **Capa 2 — Sub-Entidades Modulares de Manufactura (Escalabilidad Interna)**: Desacopla la ingeniería y el control de piso de planta en **4 sub-entidades cohesivas** (`sub_listas_bom`, `sub_rutas_operaciones`, `sub_centros_trabajo` y `sub_consumos_salidas`), evitando sobrecargar las tablas principales y permitiendo crecer modularmente.
3. **Capa 3 — Interconexión con Otras Áreas de la Empresa (Escalabilidad Horizontal ERP)**: Conecta tanto el núcleo base como las sub-entidades de manufactura con **5 áreas empresariales** (**Ventas y Comercial**, **Inventario y Bodega**, **Compras y Proveedores**, **Contabilidad y Finanzas**, y **RRHH y Mantenimiento**) utilizando exactamente las mismas variables compartidas del modelo.

## Contexto Técnico

**Lenguaje/Versión**: JavaScript (ES2022), HTML, CSS  
**Dependencias Principales**: Vite, sin framework de interfaz pesado  
**Almacenamiento**: `localStorage` del navegador (`erp_base_module:entities` y `erp_base_module:documents`, extensible modularmente a `erp_base_module:sub:*`)  
**Pruebas**: Vitest con `jsdom` para pruebas unitarias y de interacción  
**Plataforma Objetivo**: Navegadores modernos de escritorio y móviles (tablets en piso de planta)  
**Tipo de Proyecto**: Aplicación web (SPA de solo frontend escalable)  
**Objetivos de Rendimiento**: Interacciones responsivas para listas de hasta 500 registros; la búsqueda y las actualizaciones de la interfaz deben sentirse instantáneas  
**Restricciones**: Respeto estricto al contrato base de `data-model.md`; entidades principales reducidas (solo 2 `customFields` en `Entity` y 4 en `Document`) conectadas a 4 sub-entidades modulares y 5 módulos empresariales  
**Escala/Alcance**: CRUD de datos maestros (`Producto`) y documentos transaccionales (`Orden de Producción`), ciclo de vida controlado de manufactura, sub-entidades modulares y contratos de integración inter-áreas

## Verificación de la Constitución

*COMPROBACIÓN: Verificada antes de la investigación de la Fase 0 y reverificada tras el diseño del Modelo de Datos modular de la Fase 1.*

- **Calidad**: Estructura JavaScript modular con separación estricta entre el motor base (`src/storage.js`), la configuración declarativa del dominio (`src/module-config.js`), las 4 sub-entidades internas y los contratos con otras áreas de la empresa. Nomenclatura 100% unificada y sanitización obligatoria de cadenas en el DOM contra XSS.
- **Pruebas**: Cobertura automatizada en Vitest para los flujos de crear, editar, eliminar en cascada y buscar `Productos` y `Órdenes de Producción`, validaciones de los 6 `customFields` y transiciones de `statusLifecycle`.
- **Experiencia de Usuario**: Formularios principales ágiles y descongestionados dentro del marco corporativo ERP (`shell.js`) con color de acento industrial (`#d97706`), etiquetas consistentes y retroalimentación clara de validación.
- **Rendimiento**: Al mantener `Entity` y `Document` livianos y desacoplar los detalles repetitivos en sub-entidades modulares, las búsquedas y estadísticas en `dashboard.js` responden de forma instantánea hasta 500 registros.

## Definición del Problema, Solución Propuesta y Usuarios (Alineación con Rúbrica)

### Problema Operacional
En una empresa manufacturera, el área de operaciones no trabaja aislada: depende de los pedidos de **Ventas**, del stock en **Inventario**, del abastecimiento de **Compras**, del presupuesto de **Contabilidad** y de la disponibilidad de máquinas y personal de **RRHH y Mantenimiento**. Cuando toda esta información se intenta guardar en una sola tabla gigante sin modularización, el sistema pierde escalabilidad, duplica datos y no puede comunicarse con los demás departamentos del ERP.

### Solución Propuesta (MVP Modular e Interconectado)
1. **Prioridad 1 — Entidades Base Ligeras (`Entity` = `Producto`, `Document` = `Orden de Producción`)**: Operan directamente sobre la plantilla oficial del curso conservando todas sus variables base y sumando solo 6 `customFields` que actúan como llaves foráneas.
2. **Prioridad 2 — Sub-Entidades Modulares de Manufactura**: Cuatro sub-módulos normalizados (`sub_listas_bom`, `sub_rutas_operaciones`, `sub_centros_trabajo`, `sub_consumos_salidas`) que absorben el detalle técnico de recetas, secuencias de ruta, capacidades de máquina y movimientos de materiales en planta.
3. **Prioridad 3 — Puentes de Interconexión con 5 Áreas de la Empresa**: Integración nativa por llaves compartidas (`entity_id`, `code`, `id`, `series`, `folio`, `address`, `taxId`, `quantity`, `totalAmount`, `status`, `id_centro_trabajo`) con Ventas, Inventario, Compras, Contabilidad y RRHH/Mantenimiento.

### Clientes y Potenciales Usuarios de la Plataforma
- **Cliente Objetivo**: Empresas industriales y manufactureras que buscan integrar su planificación y control de producción (MRP/MES) con las áreas comerciales, logísticas y financieras en un único ecosistema ERP.
- **Usuarios Potenciales**:
  - **Ingeniero de Producto / Planificador MRP**: Gestiona el catálogo de `Productos` (`Entity`), define `unitOfMeasure` y `standardUnitCost`, y configura `sub_listas_bom` (`id_bom`) y `sub_rutas_operaciones` (`id_ruta`).
  - **Jefe de Planta / Supervisor de Operaciones**: Programa y ejecuta las `Órdenes de Producción` (`Document`), asigna `id_centro_trabajo`, actualiza el estado en `statusLifecycle` y registra `tiempo_real`.
  - **Coordinador de Inventario y Compras**: Monitorea `sub_consumos_salidas` (`cantidad_consumida` y `quantity` entregada) y gestiona la reposición de insumos según `cantidad_requerida` en la BOM.
  - **Analista de Costos y Finanzas**: Evalúa la rentabilidad por lote comparando `standardUnitCost` y `creditLimit` contra `subtotal`, `discount`, `taxAmount` y `totalAmount`.

## Diccionario Unificado de Variables (100% Idéntico en Todos los Archivos)

### 1. Configuración en `ModuleConfig` (`src/module-config.js`)
- `moduleName`: `"Manufactura y Operaciones"`
- `labels`: `{ entity: "Producto", entities: "Productos", document: "Orden de Producción", documents: "Órdenes de Producción" }`
- `theme`: `{ accentColor: "#d97706" }`
- `statusLifecycle`:
  - `statuses`: `["planificada", "en_proceso", "control_calidad", "completada", "cancelada"]`
  - `transitions`: `planificada` → `["en_proceso", "cancelada"]`, `en_proceso` → `["control_calidad", "cancelada"]`, `control_calidad` → `["completada", "en_proceso", "cancelada"]`, `completada` → `[]`, `cancelada` → `[]`.

### 2. Prioridad 1: Entidades Principales Base (`Entity` y `Document`)

#### 2.1 Campos Base de `Entity` (`Producto` — 15 variables compartidas del template)
- `id` (`string`, `PK` interna, obligatorio): Identificador interno único del registro de entidad, generado automáticamente.
- `entity_id` (`string`, `PK` pública, obligatorio): Identificador público único autogenerado usado para vincular `Órdenes de Producción`, sub-entidades de manufactura y los demás módulos de la empresa a este `Producto`.
- `name` (`string`, obligatorio): Nombre comercial o técnico del producto manufacturado o insumo.
- `code` (`string`, `UK`, obligatorio): Código SKU o clave de negocio única que identifica al `Producto` en toda la empresa.
- `category` (`string`, opcional): Categoría, tipo o familia industrial del producto (`"Producto Terminado"`, `"Subensamble"`, `"Materia Prima"`).
- `description` (`string`, opcional): Descripción técnica general y notas de ingeniería del producto.
- `address` (`string`, opcional): Almacén o bodega principal asignada al producto en planta (conecta con Inventario y Centros de Trabajo).
- `targetDate` (`string`, `YYYY-MM-DD`, opcional): Fecha objetivo de vigencia técnica de la receta o próxima revisión/mantención programada.
- `creditLimit` (`number`, `>= 0`, opcional): Presupuesto operativo máximo o límite de costo asignado a la partida del producto (conecta con Contabilidad).
- `paymentTerms` (`string`, opcional): Estrategia operativa o condición comercial de reposición (`"MTS"`, `"MTO"`, `"Neto 30"`).
- `taxId` (`string`, opcional): Identificación fiscal (RUT/NIT) del proveedor principal de insumos críticos (conecta con Compras).
- `email` (`string`, opcional): Correo electrónico del responsable técnico o contacto de proveedor.
- `phone` (`string`, opcional): Teléfono o anexo de contacto operativo.
- `createdAt` (`string`, obligatorio): Marca de tiempo de creación del registro del `Producto`.
- `updatedAt` (`string`, obligatorio): Marca de tiempo de la última actualización del `Producto`.

#### 2.2 Campos Personalizados de `Entity` (`customFields` con `target: "entity"` — Solo 2 campos)
- `unitOfMeasure` — **Etiqueta**: `"Unidad de Medida"` | **Tipo**: `select` | **Obligatorio**: Sí | **Opciones**: `["UN", "KG", "LT", "MT"]`
  - **Descripción**: Define la unidad física estándar en la que se cuantifica, inventaría y fabrica el producto en toda la empresa.
- `standardUnitCost` — **Etiqueta**: `"Costo Estándar Unitario"` | **Tipo**: `number` | **Obligatorio**: Sí (`>= 0`)
  - **Descripción**: Representa el costo teórico unitario de fabricación del producto, utilizado como referencia base para valorizar inventarios y medir desviaciones en Contabilidad.

#### 2.3 Campos Base de `Document` (`Orden de Producción` — 17 variables compartidas del template)
- `id` (`string`, `PK` interna, obligatorio): Identificador único interno de la `Orden de Producción`, generado automáticamente.
- `entity_id` (`string`, `FK` → `Entity.entity_id`, obligatorio): Identificador del `Producto` que se fabrica en esta orden.
- `series` (`string`, opcional): Serie documental de la orden (p. ej., `"OP"`, `"OF"`), usada para enlazar con el pedido de origen en Ventas.
- `folio` (`number`, entero `> 0`, obligatorio): Folio consecutivo oficial que junto con `series` forma el número del documento (p. ej., `OP-1001`).
- `startDate` (`string`, `YYYY-MM-DD`, obligatorio): Fecha programada o real de inicio de fabricación del lote.
- `endDate` (`string`, `YYYY-MM-DD`, obligatorio, `>= startDate`): Fecha programada o real de fin de fabricación y entrega a bodega.
- `quantity` (`number`, entero `> 0`, opcional en base / requerido en operación): Cantidad planificada de unidades a fabricar en la orden.
- `subtotal` (`number`, `>= 0`, opcional): Costo directo bruto del lote antes de descuentos e impuestos.
- `discount` (`number`, `>= 0` y `<= subtotal`, opcional): Ahorro por eficiencia operativa o recuperación de subproductos/mermas.
- `taxAmount` (`number`, `>= 0`, opcional): Costos indirectos de fabricación (CIF) o cargos aplicables al lote.
- `totalAmount` (`number`, `>= 0`, opcional): Costo total neto de la `Orden de Producción` (`subtotal - discount + taxAmount`).
- `currency` (`string`, opcional): Código de moneda de costeo (`"CLP"`, `"USD"`, `"EUR"`).
- `paymentTerms` (`string`, opcional): Condición de liquidación contable o almacén receptor.
- `notes` (`string`, opcional): Observaciones de ejecución, consumo de materiales y dictamen de calidad.
- `status` (`string`, controlado por `statusLifecycle`): Estado actual de la orden (`"planificada"`, `"en_proceso"`, `"control_calidad"`, `"completada"`, `"cancelada"`).
- `createdAt` (`string`, obligatorio): Marca de tiempo de creación de la `Orden de Producción`.
- `updatedAt` (`string`, obligatorio): Marca de tiempo de la última actualización de la `Orden de Producción`.

#### 2.4 Campos Personalizados de `Document` (`customFields` con `target: "document"` — Solo 4 llaves de enlace)
- `id_bom` — **Etiqueta**: `"ID Lista de Materiales (BOM)"` | **Tipo**: `text` | **Obligatorio**: Sí
  - **Descripción**: Llave foránea que identifica la receta activa en la sub-entidad `sub_listas_bom` (p. ej., `"BOM-001-V1"`) con la que se fabricará el lote.
- `id_ruta` — **Etiqueta**: `"ID Ruta de Producción"` | **Tipo**: `text` | **Obligatorio**: Sí
  - **Descripción**: Llave foránea que identifica la secuencia de operaciones en la sub-entidad `sub_rutas_operaciones` (p. ej., `"RUTA-ENS-01"`) aplicada a la orden.
- `id_centro_trabajo` — **Etiqueta**: `"ID Centro de Trabajo"` | **Tipo**: `select` | **Obligatorio**: Sí | **Opciones**: `["CT-01 Ensamble", "CT-02 Maquinado", "CT-03 Procesos", "CT-04 Empaque"]`
  - **Descripción**: Llave foránea que vincula la orden con la estación o línea principal en la sub-entidad `sub_centros_trabajo` responsable de la ejecución.
- `tiempo_real` — **Etiqueta**: `"Tiempo Real de Ejecución (h)"` | **Tipo**: `number` | **Obligatorio**: Sí (`>= 0`)
  - **Descripción**: Total de horas reales empleadas en ejecutar la orden en planta, utilizado para medir eficiencia frente a `tiempo_estandar` y reportar horas a RRHH/Costos.

### 3. Prioridad 2:Las 4 Sub-Entidades Modulares de Manufactura (Escalabilidad Interna)

| Sub-Entidad Modular | `PK` | `FK` de Enlace | Variables de la Sub-Entidad y Descripción |
| :--- | :--- | :--- | :--- |
| **1. `sub_listas_bom`** *(Recetas y Componentes)* | `id_bom` | `entity_id`, `id_producto_componente` | `version` (versión de la receta), `activo` (vigencia booleana), `cantidad_requerida` (unidades de insumo por unidad fabricada). Desacopla la fórmula y sus componentes fuera de `Entity`. |
| **2. `sub_rutas_operaciones`** *(Secuencias y Pasos)* | `id_ruta` | `entity_id`, `id_centro_trabajo` | `numero_secuencia` (orden del paso 10, 20...), `nombre_operacion` (tarea técnica), `tiempo_estandar` (horas/minutos teóricos por operación). Desacopla la ingeniería de procesos. |
| **3. `sub_centros_trabajo`** *(Capacidad y Ejecución)* | `id_centro_trabajo` | `address`, `id` (ref `Document`) | `nombre` (nombre de línea/máquina), `capacidad_por_hora` (u/h disponibles), `tiempo_real` (horas efectivas por operación), `status` (estado operativo de máquina/paso). |
| **4. `sub_consumos_salidas`** *(Movimientos de Planta)* | `id_movimiento` | `id` (ref `Document`), `entity_id` | `cantidad_consumida` (insumos reales descargados en la orden), `quantity` (unidades terminadas entregadas a bodega), `fecha_movimiento` (`YYYY-MM-DD`). |

### 4. Prioridad 3: Interconexión con los 5 Módulos de Otras Áreas de la Empresa

| Área / Módulo Empresarial Conectado | Entidades de Manufactura con las que Conecta | Variables Compartidas de Enlace | Flujo de Negocio en la Empresa |
| :--- | :--- | :--- | :--- |
| **1. Módulo de Ventas y Comercial (CRM)** | `Entity` (`Producto`) y `Document` (`Orden de Producción`) | `entity_id`, `code`, `series`, `folio`, `quantity`, `startDate`, `endDate`, `status` | Los pedidos de clientes en Ventas disparan órdenes de fabricación (`series`/`folio`), consultan fechas comprometidas (`startDate`/`endDate`) y monitorean el `status` del lote. |
| **2. Módulo de Inventario y Bodega (SCM)** | `Entity` (`Producto`) y `sub_consumos_salidas` | `entity_id`, `code`, `address`, `unitOfMeasure`, `cantidad_consumida`, `quantity` | Bodega entrega materias primas a planta descontando `cantidad_consumida` y recibe el producto terminado sumando `quantity` en el almacén (`address`) cuando `status = "completada"`. |
| **3. Módulo de Compras y Proveedores (SRM)** | `Entity` (`Producto`) y `sub_listas_bom` | `entity_id`, `code`, `taxId`, `email`, `phone`, `paymentTerms`, `cantidad_requerida` | Compras calcula los insumos requeridos (`cantidad_requerida * quantity`) según la receta `id_bom` y emite órdenes de compra al proveedor registrado en `taxId`/`email`/`phone`. |
| **4. Módulo de Contabilidad y Finanzas** | `Entity` (`Producto`) y `Document` (`Orden de Producción`) | `entity_id`, `series`, `folio`, `creditLimit`, `standardUnitCost`, `subtotal`, `discount`, `taxAmount`, `totalAmount`, `currency` | Contabilidad valida el tope presupuestario (`creditLimit`), compara el `standardUnitCost` contra el costo real del lote (`totalAmount`) e imputa costos directos (`subtotal`) y CIF (`taxAmount`). |
| **5. Módulo de RRHH y Mantenimiento (EAM)** | `Entity`, `Document`, `sub_centros_trabajo` y `sub_rutas_operaciones` | `id_centro_trabajo`, `targetDate`, `tiempo_estandar`, `tiempo_real`, `capacidad_por_hora`, `status` | Mantenimiento programa paradas preventivas según `targetDate` en cada `id_centro_trabajo`, mientras RRHH asigna operarios y evalúa la productividad (`tiempo_estandar` vs `tiempo_real`). |

## Método de Análisis, Variables Críticas y Herramientas de Estimación

| Indicador / Estimación | Expresión con Variables del Modelo | Área Empresarial Beneficiada |
| :--- | :--- | :--- |
| **Desviación de Costo Unitario** | `(totalAmount / quantity) - standardUnitCost` | **Manufactura y Contabilidad**: Detecta sobrecostos reales del lote frente al estándar. |
| **Eficiencia Operativa de Ruta** | `(tiempo_estandar * quantity) / tiempo_real` | **Manufactura y RRHH**: Evalúa el desempeño del turno y del centro de trabajo (`id_centro_trabajo`). |
| **Merma / Variación de Materiales** | `cantidad_consumida - (cantidad_requerida * quantity)` | **Manufactura, Inventario y Compras**: Cuantifica el desperdicio de insumos respecto a la BOM (`id_bom`). |
| **Ocupación de Capacidad de Planta** | `quantity / (capacidad_por_hora * tiempo_real)` | **Manufactura y Ventas**: Permite estimar fechas realistas de entrega (`endDate`) para nuevos pedidos. |

## Análisis de Escalabilidad y Manejo de Riesgos / Sesgos de Datos

1. **Escalabilidad Técnica y Modular**: El código base de Vite + Vanilla JS (`src/storage.js`) gestiona `Entity` y `Document` sin modificaciones, mientras que las 4 sub-entidades modulares (`sub_listas_bom`, `sub_rutas_operaciones`, `sub_centros_trabajo`, `sub_consumos_salidas`) y los 5 módulos externos se comunican mediante llaves primarias y foráneas estandarizadas, permitiendo migrar de `localStorage` a microservicios o tablas SQL sin renombrar variables.
2. **Riesgos de Datos y Datos Sensibles**: Integridad referencial garantizada por `entity_id` con borrado en cascada; sanitización en el DOM contra XSS para proteger `taxId`, `email`, `phone`, fórmulas `id_bom` y estructura de costos (`standardUnitCost`, `totalAmount`).
3. **Mitigación de Sesgos**:
   - **Sesgo de subreporte en planta**: Separación de etapas `en_proceso` y `control_calidad` en `statusLifecycle` para auditar `tiempo_real` y `cantidad_consumida`.
   - **Sesgo de supervivencia**: Conservación de órdenes en estado `cancelada` para no distorsionar los promedios históricos de costos y tiempos.
   - **Sesgo de desactualización técnica**: Control de `version` y `activo` en `sub_listas_bom` junto con `targetDate` en `Entity`.

## Estructura del Proyecto

```text
specs/001-erp-base-module/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md

src/
├── main.js
├── styles.css
├── storage.js
├── app.js
├── module-config.js
└── components/
    ├── shell.js
    ├── dashboard.js
    ├── entity-form.js
    └── document-form.js

tests/
├── unit/
├── integration/
└── setup/
```

## Seguimiento de Complejidad

Este plan respeta al 100% la Constitución del proyecto: prioriza las entidades base del template, mantiene solo 6 `customFields` en el núcleo, organiza la complejidad interna en 4 sub-entidades modulares y explicita las conexiones con 5 áreas de la empresa.
