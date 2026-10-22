# Speckit Template — ERP de Manufactura y Operaciones

> **Archivos nuevos de la rama `pruebassimplificada` (marcados `_rama2`)**: [`data_model_rama2.md`](./data_model_rama2.md) y [`data_model_diagram_rama2.md`](./data_model_diagram_rama2.md). El resto de cambios de la rama son la plantilla de plan (`.specify/templates/plan-template.md`) y este README.

Una plataforma ERP de manufactura y operaciones necesita diseñar una base de datos relacional para almacenar la información de su producción. La plataforma parte de un módulo base que ya gestiona datos maestros (entidades) y documentos transaccionales con serie y folio; sobre esa base, cada planta registra los artículos que fabrica, las listas de materiales que los componen, las órdenes de fabricación que lanza y los movimientos de existencias que consumen y devuelven material.

Cada artículo se identifica por su código, que es único en la plataforma, y se describe con su nombre, su tipo (fabricado, comprado o subensamblaje), su unidad de medida base, su costo estándar y su stock mínimo. La plataforma admite tantas unidades de medida como necesite cada planta (kilogramos, unidades, metros) y, cuando una cantidad se registra en una unidad distinta de la base, exige que exista una conversión declarada entre ambas unidades con su factor. Un artículo puede archivarse para retirarlo de las listas sin perder su historial.

Una lista de materiales indica qué componentes forman un artículo. Cada lista se versiona y tiene una vigencia de inicio, y un mismo artículo sólo puede tener una lista activa a la vez; sus líneas señalan el componente, la cantidad necesaria por unidad del artículo padre, la unidad en que se consume ese componente y el porcentaje de merma esperada. La plataforma impide que una lista se refere a sí misma, directa o indirectamente, de modo que la explosión de materiales no pueda entrar en un ciclo.

Una orden de fabricación es el documento que lanza la producción de una cantidad determinada de un artículo. Se identifica por serie y folio y pertenece a la entidad —el cliente o la planta— que la solicitó. Al liberarse, la orden fija la versión de la lista de materiales que usará, de manera que los cambios posteriores en esa lista no alteran una producción ya planificada; una orden en curso puede además llevar registradas las cantidades completadas. Al planearla, cada orden puede llevar su fecha programada de inicio y su fecha objetivo, y la fecha objetivo nunca puede ser anterior a la de inicio. La orden avanza por los estados borrador, liberada, en curso, recibida y cerrada, y sólo puede cancelarse desde borrador o liberada.

Toda entrada o salida de material se registra como un movimiento de inventario que nunca se modifica ni se borra: una corrección se hace con un movimiento compensatorio. Cada movimiento indica el artículo afectado, su tipo (recepción, consumo, ajuste o transferencia), la cantidad con signo, la unidad en que se registró, el factor de conversión aplicado cuando la unidad difiere de la base, la orden de fabricación a la que se asocia cuando existe, el motivo en el caso de los ajustes y la fecha y hora en que se produjo. La plataforma mantiene además el saldo actual de cada artículo, que es la suma de los movimientos de ese artículo y se verifica al arrancar para que nunca haya descuadres; el saldo sólo puede ser negativo si la configuración lo permite. La planificación de materiales (MRP), las rutas de trabajo, las reservas de existencias y la trazabilidad por lote quedan fuera del alcance de este modelo y se tratan en funcionalidades propias.

## Del enunciado al modelo de datos

Cada enunciado del párrafo anterior se formaliza en [`data_model_rama2.md`](./data_model_rama2.md), cuyo diagrama entidad-relación está en [`data_model_diagram_rama2.md`](./data_model_diagram_rama2.md).

| Enunciado | Entidad o campo en el modelo |
|---|---|
| artículo con código único, nombre, tipo, UoM base, costo estándar y stock mínimo | `Product` (extensión de `Entity`) |
| artículo archivado sin perder su historial | `Product.isArchived` |
| unidades de medida con código y nombre | `UnitOfMeasure` |
| conversión entre unidades con su factor | `UoMConversion.factor` |
| lista de materiales versionada, con vigencia y una sola activa por artículo | `Bom.version`, `Bom.effectiveFrom`, `Bom.status` |
| línea con componente, cantidad, unidad y merma esperada | `BomLine.componentProduct_id`, `.quantity`, `.uom`, `.scrapPercent` |
| lista que no puede referirse a sí misma | reglas de explosión de BOM (§3.3) |
| orden con serie y folio, perteneciente a una entidad | `WorkOrder` (extensión de `Document`), `WorkOrder.entity_id` |
| orden que fija la versión de la lista al liberarse | `WorkOrder.bomVersion_id` y la transición a `liberada` (§5) |
| cantidades completadas durante la producción | `WorkOrder.quantityCompleted` |
| orden con fecha programada de inicio y fecha objetivo, sin que la objetivo sea anterior a la de inicio | `WorkOrder.startDate` / `WorkOrder.dueDate` (§3.4) |
| estados borrador → liberada → en curso → recibida → cerrada, cancelable | máquinas de estados (§5) |
| movimiento inmutable con tipo, cantidad con signo, unidad, factor, orden, motivo y fecha | `InventoryMovement` |
| corrección mediante movimiento compensatorio | `InventoryMovement` es append-only (§3.5) |
| saldo igual a la suma de movimientos, verificado al arrancar | `StockBalance.onHand` e invariante 1 (§3.5) |
| saldo negativo sólo si la configuración lo permite | `ModuleConfig.allowNegativeStock` (§7) |
| MRP, rutas, reservas y trazabilidad fuera de alcance | §8 Fuera de alcance |

## Documentos del repositorio

- [`data_model_rama2.md`](./data_model_rama2.md) — **nuevo en esta rama**: modelo de datos del dominio de manufactura.
- [`data_model_diagram_rama2.md`](./data_model_diagram_rama2.md) — **nuevo en esta rama**: diagrama entidad-relación derivado del modelo anterior.
- [`specs/001-erp-base-module/`](./specs/001-erp-base-module/) — Especificación completa del módulo base (entidades y documentos): `spec.md`, `plan.md`, `data-model.md`, `research.md`, `quickstart.md`, `tasks.md` y `contracts/`.
- [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) — Principios del proyecto (calidad, pruebas, experiencia de usuario, rendimiento) que todo plan debe verificar.
- [`.specify/templates/plan-template.md`](./.specify/templates/plan-template.md) — Plantilla de plan, en español y orientada a los dominios de manufactura.

```text
.specify/                 # scripts, plantillas, constitución e integraciones de Spec Kit
├── memory/constitution.md
└── templates/            # plan-, spec-, tasks-, checklist- y constitution-template
.opencode/commands/       # comandos /speckit.* disponibles en el agente
specs/                    # artefactos de cada funcionalidad planificada
└── 001-erp-base-module/
data_model_rama2.md           # nuevo: modelo de datos de manufactura
data_model_diagram_rama2.md   # nuevo: diagrama entidad-relación
tests/                    # pruebas unitarias e de integración del módulo base
```

## Flujo de trabajo

Los comandos de Spec Kit están disponibles en el agente a través de `.opencode/commands/`:

1. `/speckit.constitution` — define o actualiza la constitución del proyecto.
2. `/speckit.specify` — describe la funcionalidad y genera `specs/[###-feature]/spec.md`.
3. `/speckit.clarify` — resuelve ambigüedades de la especificación.
4. `/speckit.plan` — rellena la plantilla de plan y produce `research.md`, `data-model.md`, `quickstart.md` y `contracts/`.
5. `/speckit.tasks` — descompone el plan en tareas ejecutables.
6. `/speckit.analyze` — comprueba la coherencia entre especificación, plan y tareas.
7. `/speckit.implement` — ejecuta las tareas.

La plantilla de plan pide marcar el **alcance de dominio** antes de empezar: los dominios marcados como *Incluido* se resuelven en esa funcionalidad y los demás se posponen.

## Módulo Base ERP

Base sobre la que se construyen los módulos: un espacio de trabajo con barra superior y barra lateral, panel de inicio con acciones rápidas y tarjetas de estadísticas, gestión de **entidades** (datos maestros: nombre, código, identificación fiscal, contacto, condiciones comerciales) y de **documentos** (registros transaccionales: serie y folio, desglose económico, moneda, fechas, estado), con búsqueda y eliminaciones en cascada. La interfaz está en **español** (Entidad / Documento; módulo: Módulo Base ERP).

Todo el ajuste vive en el objeto `userConfig` de `src/module-config.js`. Sin tocar el código base se puede cambiar:

- `moduleName` — nombre visible del módulo; también deriva el monograma del logotipo.
- `labels` — renombra Entidad/Documento en todas las pantallas; los artículos y concordancia se derivan de la primera palabra.
- `customFields` — campos extra por tipo de registro (`target`, `key`, `label`, `type`: `text`, `number`, `date`, `select`, `required`, `options`). Las claves no pueden chocar con los campos base.
- `statusLifecycle` — limita los estados de documento a una lista de `statuses` con sus `transitions`.
- `theme.accentColor` — color de acento aplicado como propiedad CSS en todo el marco.

Si la configuración es inválida, la aplicación muestra los problemas en un banner y vuelve a los valores por defecto en lugar de romperse.

## Setup

```bash
npm install
npm run dev
```

Abre http://localhost:5173 (o la URL que imprima Vite).

## Tests

```bash
npm test          # suite completa en modo watch
npx vitest run   # ejecución única
```

## Notas

- Los datos se persisten en `localStorage` bajo las claves `erp_base_module:entities` y `erp_base_module:documents`.
- Eliminar una entidad elimina también sus documentos (cascada).
- El proyecto usa HTML, CSS y JavaScript sin framework, por simplicidad.
- El diagrama del modelo de datos está escrito en **Mermaid**, compatible con el renderizado de Markdown de GitHub y de las vistas previas de Spec Kit.
