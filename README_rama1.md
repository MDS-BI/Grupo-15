# Módulo ERP de Manufactura y Operaciones (Vite + Vanilla JS)

Este producto consiste en un módulo funcional, modular y escalable de **Manufactura y Operaciones** integrable dentro de un sistema de Planificación de Recursos Empresariales (ERP), diseñado en tres niveles de prioridad para combinar simplicidad operativa con integración empresarial total. En primer lugar, respeta íntegramente el modelo base compartido por el curso gestionando **Productos** como datos maestros (`Entity`) y **Órdenes de Producción** como documentos transaccionales (`Document`), manteniéndolos ligeros con solo dos campos personalizados en `Producto` (`unitOfMeasure`, `standardUnitCost`) y cuatro llaves de enlace en `Orden de Producción` (`id_bom`, `id_ruta`, `id_centro_trabajo`, `tiempo_real`). En segundo lugar, desacopla el detalle técnico de planta en **cuatro sub-entidades modulares** (`sub_listas_bom`, `sub_rutas_operaciones`, `sub_centros_trabajo` y `sub_consumos_salidas`), las cuales a su vez conectan de forma nativa con **cinco áreas clave de la empresa**: **Ventas y Comercial (CRM)**, **Inventario y Bodega (SCM)**, **Compras y Proveedores (SRM)**, **Contabilidad y Finanzas**, y **RRHH y Mantenimiento (EAM)**.

El desarrollo se llevará a cabo bajo la metodología **Spec Driven Development (SDD)** con **GitHub Spec Kit**, definiendo primero el Modelo Entidad-Relación modular (`data-model.md` y su esquema gráfico `mer_manufactura_operaciones.png`), las especificaciones funcionales (`spec.md`) y el plan técnico (`plan.md`) antes de implementar el código. Técnicamente, la aplicación se construirá sobre la plantilla común del curso en **Vite con HTML, CSS y JavaScript vanilla (ES2022)** y persistencia local en el navegador (`localStorage`), concentrando toda la adaptación declarativa en `src/module-config.js` (`ModuleConfig`) sin modificar `src/storage.js`, lo que permite escalar el código hacia las sub-entidades y módulos empresariales manteniendo cobertura de pruebas automatizadas en **Vitest**.

## Diccionario Unificado de Variables (100% Idéntico en Todos los Archivos)

### 1. Prioridad 1: Entidades Principales Base (`Entity` = `Producto` y `Document` = `Orden de Producción`)

| Entidad | Variable (`key`) | Origen | Tipo | Descripción Unificada |
| :--- | :--- | :--- | :--- | :--- |
| **`Entity`** (`Producto`) | `id` | Base (`PK` interna) | `string` | Identificador interno único del registro de entidad, generado automáticamente. |
| **`Entity`** (`Producto`) | `entity_id` | Base (`PK` pública) | `string` | Identificador público único autogenerado usado para vincular `Órdenes de Producción`, sub-entidades y los demás módulos de la empresa a este `Producto`. |
| **`Entity`** (`Producto`) | `name` | Base (Obligatorio) | `string` | Nombre comercial o técnico del producto manufacturado o insumo. |
| **`Entity`** (`Producto`) | `code` | Base (`UK` SKU) | `string` | Código SKU o clave de negocio única que identifica al `Producto` en toda la empresa. |
| **`Entity`** (`Producto`) | `category` | Base (Opcional) | `string` | Categoría, tipo o familia industrial del producto (`"Producto Terminado"`, `"Subensamble"`, `"Materia Prima"`). |
| **`Entity`** (`Producto`) | `description` | Base (Opcional) | `string` | Descripción técnica general y notas de ingeniería del producto. |
| **`Entity`** (`Producto`) | `address` | Base (Opcional) | `string` | Almacén o bodega principal asignada al producto en planta (conecta con Inventario y Centros de Trabajo). |
| **`Entity`** (`Producto`) | `targetDate` | Base (Opcional) | `string` | Fecha objetivo (`YYYY-MM-DD`) de vigencia técnica de la receta o próxima revisión/mantención programada. |
| **`Entity`** (`Producto`) | `creditLimit` | Base (Opcional) | `number` | Presupuesto operativo máximo o límite de costo asignado a la partida del producto (`>= 0`, conecta con Contabilidad). |
| **`Entity`** (`Producto`) | `paymentTerms` | Base (Opcional) | `string` | Estrategia operativa o condición comercial de reposición (`"MTS"`, `"MTO"`, `"Neto 30"`). |
| **`Entity`** (`Producto`) | `taxId` | Base (Opcional) | `string` | Identificación fiscal (RUT/NIT) del proveedor principal de insumos críticos (conecta con Compras). |
| **`Entity`** (`Producto`) | `email` / `phone` | Base (Opcional) | `string` | Correo electrónico y teléfono del responsable técnico o contacto del proveedor. |
| **`Entity`** (`Producto`) | `createdAt` / `updatedAt` | Base (Obligatorio) | `string` | Marcas de tiempo de creación y última actualización del `Producto`. |
| **`Entity`** (`Producto`) | `unitOfMeasure` | `customField` (Obligatorio) | `select` | **Unidad de Medida** (`["UN", "KG", "LT", "MT"]`): Define la unidad física estándar en la que se cuantifica, inventaría y fabrica el producto en toda la empresa. |
| **`Entity`** (`Producto`) | `standardUnitCost` | `customField` (Obligatorio) | `number` | **Costo Estándar Unitario** (`>= 0`): Representa el costo teórico unitario de fabricación del producto, utilizado como referencia base para valorizar inventarios y medir desviaciones en Contabilidad. |
| **`Document`** (`Orden`) | `id` | Base (`PK` interna) | `string` | Identificador único interno de la `Orden de Producción`, generado automáticamente. |
| **`Document`** (`Orden`) | `entity_id` | Base (`FK` → `Entity`) | `string` | Identificador del `Producto` (`Entity.entity_id`) que se fabrica en esta orden. |
| **`Document`** (`Orden`) | `series` / `folio` | Base (Obligatorio `folio`) | `str`/`num` | Serie documental (`"OP"`, `"OF"`) y folio entero positivo (`> 0`) que forman el número oficial y enlazan con Ventas. |
| **`Document`** (`Orden`) | `startDate` / `endDate` | Base (Obligatorio) | `string` | Fechas de inicio y término de fabricación del lote en formato `YYYY-MM-DD` (`endDate >= startDate`). |
| **`Document`** (`Orden`) | `quantity` | Base (Entero `> 0`) | `number` | Cantidad planificada de unidades a fabricar en la orden. |
| **`Document`** (`Orden`) | `subtotal` / `discount` | Base (Opcional) | `number` | Costo directo bruto del lote (`>= 0`) y ahorro por eficiencia o recuperación de merma (`<= subtotal`). |
| **`Document`** (`Orden`) | `taxAmount` / `totalAmount` | Base (Opcional) | `number` | Costos indirectos de fabricación CIF (`>= 0`) y costo total neto de la orden (`subtotal - discount + taxAmount`). |
| **`Document`** (`Orden`) | `currency` / `paymentTerms` | Base (Opcional) | `string` | Código de moneda (`"CLP"`, `"USD"`, `"EUR"`) y condición de liquidación contable o almacén receptor. |
| **`Document`** (`Orden`) | `notes` | Base (Opcional) | `string` | Observaciones de ejecución, consumo de materiales y dictamen de control de calidad. |
| **`Document`** (`Orden`) | `status` | Base (`statusLifecycle`) | `string` | Estado actual de la orden (`"planificada"`, `"en_proceso"`, `"control_calidad"`, `"completada"`, `"cancelada"`). |
| **`Document`** (`Orden`) | `createdAt` / `updatedAt` | Base (Obligatorio) | `string` | Marcas de tiempo de creación y última actualización de la `Orden de Producción`. |
| **`Document`** (`Orden`) | `id_bom` | `customField` (Obligatorio) | `text` | **ID Lista de Materiales (BOM)**: Llave foránea que identifica la receta activa en la sub-entidad `sub_listas_bom` (p. ej., `"BOM-001-V1"`) con la que se fabricará el lote. |
| **`Document`** (`Orden`) | `id_ruta` | `customField` (Obligatorio) | `text` | **ID Ruta de Producción**: Llave foránea que identifica la secuencia de operaciones en la sub-entidad `sub_rutas_operaciones` (p. ej., `"RUTA-ENS-01"`) aplicada a la orden. |
| **`Document`** (`Orden`) | `id_centro_trabajo` | `customField` (Obligatorio) | `select` | **ID Centro de Trabajo** (`["CT-01 Ensamble", "CT-02 Maquinado", "CT-03 Procesos", "CT-04 Empaque"]`): Llave foránea que vincula la orden con la estación principal en `sub_centros_trabajo`. |
| **`Document`** (`Orden`) | `tiempo_real` | `customField` (Obligatorio) | `number` | **Tiempo Real de Ejecución (h)** (`>= 0`): Total de horas reales empleadas en ejecutar la orden en planta, utilizado para medir eficiencia frente a `tiempo_estandar` y reportar horas a RRHH/Costos. |

### 2. Prioridad 2 y 3: Sub-Entidades Modulares y Módulos Empresariales Conectados

| Bloque Modular | Nombre de Entidad / Módulo | Llaves y Variables Compartidas | Rol en la Escalabilidad e Integración |
| :--- | :--- | :--- | :--- |
| **Sub-Entidad 1** | `sub_listas_bom` | `id_bom` (`PK`), `entity_id` (`FK`), `id_producto_componente` (`FK`), `version`, `activo`, `cantidad_requerida` | Gestiona versiones de recetas e insumos requeridos por unidad sin saturar `Entity`. |
| **Sub-Entidad 2** | `sub_rutas_operaciones` | `id_ruta` (`PK`), `entity_id` (`FK`), `id_centro_trabajo` (`FK`), `numero_secuencia`, `nombre_operacion`, `tiempo_estandar` | Define los pasos secuenciales de fabricación y tiempos teóricos por producto. |
| **Sub-Entidad 3** | `sub_centros_trabajo` | `id_centro_trabajo` (`PK`), `address` (`FK`), `id` (`FK`), `nombre`, `capacidad_por_hora`, `tiempo_real`, `status` | Administra estaciones de planta, capacidad instalada (u/h) y tiempos reales por operación. |
| **Sub-Entidad 4** | `sub_consumos_salidas` | `id_movimiento` (`PK`), `id` (`FK`), `entity_id` (`FK`), `cantidad_consumida`, `quantity`, `fecha_movimiento` | Registra la descarga de materias primas (`cantidad_consumida`) y la entrega de terminados (`quantity`). |
| **Área Empresa 1** | **Ventas y Comercial (CRM)** | `entity_id`, `code`, `series`, `folio`, `quantity`, `startDate`, `endDate`, `status` | Conecta los pedidos de clientes con órdenes de producción y fechas de entrega. |
| **Área Empresa 2** | **Inventario y Bodega (SCM)** | `entity_id`, `code`, `address`, `unitOfMeasure`, `cantidad_consumida`, `quantity` | Sincroniza el descuento de insumos consumidos y el ingreso de productos terminados en almacén. |
| **Área Empresa 3** | **Compras y Proveedores (SRM)** | `entity_id`, `code`, `taxId`, `email`, `phone`, `paymentTerms`, `cantidad_requerida` | Dispara el reabastecimiento de materias primas según la explosión de `sub_listas_bom`. |
| **Área Empresa 4** | **Contabilidad y Finanzas** | `entity_id`, `series`, `folio`, `creditLimit`, `standardUnitCost`, `subtotal`, `discount`, `taxAmount`, `totalAmount`, `currency` | Audita presupuestos, valoriza inventario y liquida los costos reales de cada lote. |
| **Área Empresa 5** | **RRHH y Mantenimiento (EAM)** | `id_centro_trabajo`, `targetDate`, `tiempo_estandar`, `tiempo_real`, `capacidad_por_hora`, `status` | Coordina turnos operativos, productividad laboral y mantenciones preventivas de planta. |

## Configuración e Inicio Rápido

1. Instalar las dependencias del repositorio:
   ```bash
   npm install
   ```
2. Iniciar el servidor de desarrollo local de Vite:
   ```bash
   npm run dev
   ```
3. Abrir la URL local indicada en consola (p. ej., `http://localhost:5173`) para utilizar el módulo.
4. Ejecutar las pruebas automatizadas con Vitest:
   ```bash
   npx vitest run
   ```

## Registro de Toma de Decisiones y Anexo de Uso de IA

| Fecha | Integrante / Equipo | Decisión Metodológica / Uso de IA (Modelo, Objetivo y Prompt) | Archivo Impactado |
| :--- | :--- | :--- | :--- |
| 2026-10-20 | Equipo | Diseño modular en 3 capas: (1) Entidades base `Entity` (`Producto`) y `Document` (`Orden de Producción`) con solo 6 `customFields`, (2) 4 sub-entidades modulares de manufactura (`sub_listas_bom`, `sub_rutas_operaciones`, `sub_centros_trabajo`, `sub_consumos_salidas`), y (3) interconexión explícita con 5 áreas empresariales (Ventas, Inventario, Compras, Contabilidad y RRHH/Mantenimiento). | `README.md`, `plan.md`, `data-model.md`, `mer_manufactura_operaciones.png` |
