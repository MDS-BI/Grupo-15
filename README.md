# Speckit Template — ERP de Manufactura y Operaciones

Plantilla de **Spec Kit** para planificar y construir módulos de un ERP sobre una base ya existente: el **Módulo Base ERP** (entidades y documentos enlazados, con CRUD, validación y persistencia en `localStorage`).

Esta rama (`pruebassimplificada`) parte de `main` y adapta el flujo de planificación al dominio de **manufactura y operaciones**, con un modelo de datos de referencia reducido y su diagrama entidad-relación.

## Qué cambia respecto a `main`

| Artefacto | Cambio |
|---|---|
| `.specify/templates/plan-template.md` | Plantilla de plan en español, centrada en los dominios de manufactura (BOM, órdenes de fabricación, inventario, MRP) en lugar de la plantilla genérica en inglés |
| `specs/002-manufacturing-module/data-model.md` | Modelo de datos **simplificado** del módulo de manufactura construido sobre la base 001 |
| `specs/002-manufacturing-module/data-model-diagram.md` | Diagrama entidad-relación derivado del modelo de datos anterior |
| `README.md` | Este documento |

El resto del repositorio es idéntico a `main`.

## Documentos clave

- [`specs/001-erp-base-module/`](./specs/001-erp-base-module/) — Especificación completa del módulo base: `spec.md`, `plan.md`, `data-model.md`, `research.md`, `quickstart.md`, `tasks.md` y `contracts/`.
- [`specs/002-manufacturing-module/data-model.md`](./specs/002-manufacturing-module/data-model.md) — Modelo de datos de manufactura: productos, listas de materiales, órdenes de fabricación e inventario.
- [`specs/002-manufacturing-module/data-model-diagram.md`](./specs/002-manufacturing-module/data-model-diagram.md) — Diagrama entidad-relación, máquinas de estados y flujo del journal de existencias.
- [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) — Principios del proyecto (calidad, pruebas, experiencia de usuario, rendimiento) que todo plan debe verificar.

## Estructura del repositorio

```text
.specify/                 # scripts, plantillas, constitución e integraciones de Spec Kit
├── memory/constitution.md
└── templates/            # plan-, spec-, tasks-, checklist- y constitution-template
.opencode/commands/       # comandos /speckit.* disponibles en el agente
specs/                    # artefactos de cada funcionalidad planificada
├── 001-erp-base-module/
└── 002-manufacturing-module/
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

La plantilla de plan (`plan-template.md`) pide marcar el **alcance de dominio** antes de empezar: los dominios de manufactura marcados como *Incluido* se resuelven en esa funcionalidad y los demás se posponen. El modelo de datos de `002-manufacturing-module` cubre el núcleo mínimo (productos, BOM, órdenes, inventario) y enumera explícitamente lo que queda fuera (MRP, rutas, reservas, trazabilidad, compras).

## Módulo Base ERP

Base sobre la que se construyen los módulos: un espacio de trabajo con barra superior y barra lateral, panel de inicio con acciones rápidas y tarjetas de estadísticas, gestión de **entidades** (datos maestros: nombre, código, identificación fiscal, contacto, condiciones comerciales) y de **documentos** (registros transaccionales: serie y folio, desglose económico, moneda, fechas, estado), con búsqueda y eliminaciones en cascada.

La interfaz está en **español** (Entidad / Documento; módulo: Módulo Base ERP).

### Personalización por configuración

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
