# Lista de Verificación de Calidad de la Especificación: Módulo de Operaciones / Manufactura (ERP)

**Propósito**: Validar que `spec.md` sea 100 % autocontenido y reconstruible desde cero, con alcance MVP explícito, contradicciones resueltas y dataset semilla obligatorio, antes de proceder a la planificación.
**Creada**: 2026-11-24
**Funcionalidad**: [Enlace a spec.md](../spec.md)

## Calidad del Contenido

- [x] Sin detalles de implementación abiertos (lenguajes, frameworks, APIs) — los nombres de archivos, selectores CSS, clases condicionales, claves de almacenamiento y rutas se registran únicamente como restricciones de interfaz exigidas por el usuario, no como decisiones pendientes de diseño
- [x] Enfocada en el valor para el usuario y las necesidades del negocio (programación sin ambigüedad, mantenimiento legible, permisos por cinco roles y demo utilizable desde el primer arranque)
- [x] Escrita para partes interesadas no técnicas (Objetivo, Alcance, Personas, US-16 y Métricas de Éxito en lenguaje de negocio)
- [x] Todas las secciones obligatorias completadas (Objetivo, Alcance, Personas, Requisitos, Criterios de Aceptación, Entidades Clave, Métricas, Supuestos)

## Completitud de los Requisitos

- [x] No quedan marcadores [NEEDS CLARIFICATION] (alcance, bandeja vertical, cierre con "×", orden de subpestañas, alta multi-rol y dataset semilla quedaron definidos explícitamente)
- [x] Los requisitos son comprobables y sin ambigüedades (FR-09 incluye los cinco roles; FR-15 y FR-17 declaran precedencia sobre el texto histórico; FR-21 fija conteos, estados y ventanas de fechas relativas)
- [x] Los criterios de éxito son medibles (SC-01 a SC-34 con tiempos, porcentajes, conteos y ausencias verificables)
- [x] Los criterios de éxito son agnósticos a la tecnología (resultados observables por el usuario, sin depender de frameworks ni librerías)
- [x] Todos los escenarios de aceptación están definidos (AC-01 a AC-119 conservan sus IDs y AC-120 a AC-126 cubren FR-21)
- [x] Los casos límite están identificados (roles sin bandeja, máquina sin seleccionar, mini-calendario sin scroll, estados residuales de modales, roles repetidos, máximo de cinco roles, órdenes sin fechas y tickets/preventivas vencidas)
- [x] El alcance está claramente delimitado (MVP activo exclusivo de `specs/002-operations-manufacturing/`; `001-erp-base-module/` solo histórico y prohibido; sin backend ni dependencias nuevas)
- [x] Dependencias y suposiciones identificadas (sección 8, incluidas fecha relativa, fuente única de mantenciones, ancho de 520 px e inmutabilidad de AC-01 a AC-119)

## Preparación de la Funcionalidad

- [x] Todos los requisitos funcionales tienen criterios de aceptación claros (FR-09 → AC-47/AC-51; FR-15 → AC-53..AC-62, AC-79..AC-81, AC-91..AC-95, AC-112..AC-116; FR-17 → AC-67..AC-75, AC-96..AC-102, AC-104..AC-111; FR-20 → AC-104..AC-119; FR-21 → AC-120..AC-126)
- [x] Los escenarios de usuario cubren los flujos principales (US-01 a US-15 y US-16 de datos semilla)
- [x] La funcionalidad cumple los resultados medibles definidos en las Métricas de Éxito (SC-21 a SC-29 para la ampliación de interfaz y SC-30 a SC-34 para el dataset semilla)
- [x] No hay filtración de detalles de implementación no resueltos (las referencias técnicas son restricciones de conservación acordadas, no soluciones propuestas)

## Notas

- AC-01 a AC-119 se conservan sin renombrar ni borrar. AC-47 a AC-119 están **Verificado** tras ejecutar `npm test -- --run` (42 archivos y 297 pruebas aprobadas).
- AC-120 a AC-126 están **Pendiente**: FR-21 es un requisito nuevo de consolidación y su dataset enriquecido todavía debe implementarse y validarse.
- Las redacciones históricas superadas (bandeja horizontal de AC-91, "Volver a la lista del día" de AC-58, tres bloques de AC-71 y orden inicial de AC-67) se mantienen como anclas documentales; la regla vigente está declarada en FR-15, FR-17, FR-20 y las notas de supersedencia.
- La rama creada por el hook `before_specify` es `012-consolidate-manufacturing-spec`; el directorio de especificación sigue siendo `specs/002-operations-manufacturing` por indicación explícita del usuario.
- La especificación está lista para `/speckit.clarify` (si se desea afinar algún punto) y para `/speckit.plan`, que deberá incorporar FR-21 y AC-120 a AC-126 en artefactos derivados sin alterar las Fases 1 a 30 ni las mejoras presentes en `main`.
