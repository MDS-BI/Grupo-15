# Plan de Implementación: [FEATURE]

**Rama**: `[###-feature-name]` | **Fecha**: [DATE] | **Especificación**: [link]

**Entrada**: Especificación de la funcionalidad desde `/specs/[###-feature-name]/spec.md`

**Nota**: Esta plantilla la rellena el comando `/speckit.plan`; su definición describe el flujo de ejecución.

## Alcance

Este plan se centra en la manufactura y las operaciones del ERP. Marca cada dominio antes de empezar; lo marcado **Fuera** o **Pospuesto** queda para otra funcionalidad.

| Dominio | Estado (Incluido / Fuera / Pospuesto) | Notas |
|---------|---------------------------------------|-------|
| Listas de materiales (BOM) | [estado] | |
| Órdenes de fabricación | [estado] | |
| Inventario y existencias | [estado] | |
| Rutas y centros de trabajo | [estado] | |
| MRP / planificación de material | [estado] | |
| [dominio futuro, p. ej., calidad] | [estado] | |

> Si la funcionalidad toca más de 3 dominios, divídela en funcionalidades separadas (`002-...`, `003-...`) con su propia especificación y plan.

## Resumen

[Extraer de la especificación: requisito principal + enfoque técnico de la investigación. Indica qué dominios de manufactura abarca y cómo se apoya en el módulo base 001 (Entidades, Documentos, configuración del módulo).]

## Contexto Técnico

<!--
  El stack ya está fijado por el módulo base (001). Rellena solo lo que cambie
  para esta funcionalidad; los marcadores NEEDS CLARIFICATION se convierten en
  tareas de investigación en la Fase 0 y DEBEN resolverse en research.md.
-->

**Lenguaje/Versión**: JavaScript (ES2022), HTML, CSS con Vite

**Dependencias Principales**: Vite; sin framework de interfaz pesado (añadir solo si la investigación lo justifica)

**Almacenamiento**: localStorage del navegador (instancia única). Los movimientos de inventario DEBEN grabarse de forma atómica para que un fallo parcial no deje saldos incoherentes. NEEDS CLARIFICATION: ¿se requiere un journal de movimientos además del saldo actual?

**Pruebas**: Vitest con jsdom; los cálculos de dominio (explosión de BOM, consumos, saldos) DEBEN cubrirse con pruebas unitarias

**Plataforma Objetivo**: Navegadores modernos de escritorio y móvil

**Tipo de Proyecto**: Aplicación web (módulo de manufactura sobre la base ERP 001)

**Objetivos de Rendimiento**: listas ágiles con 500+ registros; explosión de BOM dentro de presupuesto. NEEDS CLARIFICATION: presupuesto concreto (p. ej., <200 ms para una BOM de 3 niveles)

**Restricciones**: sin backend; sanitización XSS de todo dato almacenado; etiquetas derivadas de la configuración del módulo; los cálculos sobre existencias DEBEN ser deterministas y auditables

**Escala/Alcance**: [dominios incluidos y registros esperados: productos, líneas de BOM, movimientos]

**Escalabilidad**: [volumen actual/proyectado, presupuesto de datos frente al límite de localStorage (~5 MB) y umbral o fecha de migración a IndexedDB o base de datos]

## Verificación de la Constitución

*COMPROBACIÓN: Debe pasar antes de la investigación de la Fase 0. Reverificar tras el diseño de la Fase 1.*

- **Calidad**: La lógica de manufactura (BOM, inventario, órdenes) se mantiene separada de la infraestructura base (almacenamiento, identidad, integridad referencial) para que el módulo base siga siendo extensible.
- **Pruebas**: Los cálculos de dominio están cubiertos por pruebas automatizadas antes de completar; los flujos críticos tienen cobertura de integración.
- **Experiencia de Usuario**: Las pantallas siguen el marco del espacio de trabajo ERP, la terminología procede de la configuración del módulo y los errores se presentan de forma consistente y accesible.
- **Rendimiento**: Se respetan los presupuestos de Contexto Técnico, con evidencia (mediciones) cuando la decisión lo requiera.

## Decisiones de Dominio

> Resolver en Fase 0 (research.md) y consolidar en Fase 1 (data-model.md). Marca cada una como decidida o N/A si el dominio queda fuera. La lista es extensible: añade entradas cuando un dominio de la tabla de alcance pase a **Incluido**.

- **Lista de materiales (BOM)**: niveles admitidos, vigencia, cantidades por línea, detección de ciclos.
- **Orden de fabricación**: estados y transiciones permitidas, quién transiciona, relación con el documento base.
- **Unidades de medida (UoM)**: UoM por producto y factor de conversión; política si falta conversión.
- **Existencias**: se admite saldo negativo o no; consumo por backflush contra consumo explícito.
- **Trazabilidad**: lote/serie, si aplica.
- **Auditoría**: journal inmutable de movimientos o solo saldo actual.

## Comprobaciones de Integridad Operativa

*COMPROBACIÓN: Debe pasar tras el diseño de la Fase 1. Cualquier incumplimiento se justifica en Seguimiento de Complejidad.*

- El saldo de existencias resultante de cualquier secuencia de movimientos coincide con el registro de movimientos.
- Toda conversión de UoM usada en cálculos tiene un factor declarado; si falta, se rechaza con un mensaje claro.
- La explosión de BOM detecta y rechaza ciclos, y sus líneas referencian productos existentes.
- Las transiciones de estado de la orden se aplican igual por cualquier vía (formulario, acción rápida, llamada interna) y las cascadas no dejan registros huérfanos.
- Los cálculos de dominio son deterministas y los datos mostrados en el DOM están sanitizados (XSS).

## Estructura del Proyecto

### Documentación (esta funcionalidad)

```text
specs/[###-feature]/
├── plan.md              # Este archivo (salida del comando /speckit.plan)
├── research.md          # Salida de la Fase 0 (comando /speckit.plan)
├── data-model.md        # Salida de la Fase 1 (comando /speckit.plan)
├── quickstart.md        # Salida de la Fase 1 (comando /speckit.plan)
├── contracts/           # Salida de la Fase 1 (comando /speckit.plan)
└── tasks.md             # Salida de la Fase 2 (comando /speckit.tasks - NO lo crea /speckit.plan)
```

### Código Fuente (raíz del repositorio)

<!--
  ACCIÓN REQUERIDA: Conserva solo los módulos de dominio que esta
  funcionalidad toca. La base 001 se mantiene; el árbol entregado no debe
  mostrar etiquetas de opción.
-->

```text
# Base (001) - mantener
src/
├── main.js
├── styles.css
├── storage.js            # persistencia localStorage + escrituras atómicas
├── app.js
├── module-config.js      # identidad, etiquetas, campos personalizados, ciclo de vida
└── components/           # shell, dashboard, entity-form, document-form

# Módulos de manufactura - añadir solo los necesarios
src/domain/
├── bom.js                # lista de materiales, explosión
├── work-orders.js        # órdenes: estados, transiciones
└── inventory.js          # existencias, movimientos, UoM

src/components/
├── bom-view.js
├── work-order-form.js
└── inventory-movements.js

tests/
├── unit/                 # cálculos de dominio: bom, inventory, estados
└── integration/          # flujos: orden → consumo → existencias
```

**Decisión de Estructura**: [Documentar la estructura seleccionada referenciando los directorios reales de arriba: qué módulos de dominio se añaden, dónde viven los cálculos y cómo se conectan con la base 001 (Entidad/Documento, configuración, almacenamiento).]

## Seguimiento de Complejidad

> **Rellenar SOLO si la Verificación de la Constitución o la Verificación de Integridad Operativa tienen incumplimientos que deban justificarse**

| Incumplimiento | Por qué se necesita | Alternativa más simple descartada porque |
|----------------|---------------------|------------------------------------------|
| [p. ej., 4º proyecto] | [necesidad actual] | [por qué no bastan 3 proyectos] |
| [p. ej., patrón Repository] | [problema concreto] | [por qué no basta acceso directo a datos] |
