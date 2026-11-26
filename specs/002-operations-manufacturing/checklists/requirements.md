# Lista de Verificación de Calidad de la Especificación: Módulo de Operaciones / Manufactura (ERP)

**Propósito**: Validar que `spec.md` sea 100 % autocontenido y reconstruible desde cero, con alcance MVP explícito, contradicciones resueltas y dataset semilla obligatorio, antes de proceder a la planificación.
**Creada**: 2026-11-24 | **Actualizada**: 2026-11-26
**Funcionalidad**: [Enlace a spec.md](../spec.md)

## Calidad del Contenido

- [x] Sin detalles de implementación abiertos (lenguajes, frameworks, APIs) — los nombres de archivos, selectores CSS, clases condicionales, claves de almacenamiento y rutas se registran únicamente como restricciones de interfaz exigidas por el usuario, no como decisiones pendientes de diseño
- [x] Enfocada en el valor para el usuario y las necesidades del negocio (programación sin ambigüedad, mantenimiento legible, permisos por seis roles y demo utilizable desde el primer arranque)
- [x] Escrita para partes interesadas no técnicas (Objetivo, Alcance, Personas, US-16 y Métricas de Éxito en lenguaje de negocio)
- [x] Todas las secciones obligatorias completadas (Objetivo, Alcance, Personas, Requisitos, Criterios de Aceptación, Entidades Clave, Métricas, Supuestos)

## Completitud de los Requisitos

- [x] No quedan marcadores [NEEDS CLARIFICATION] (alcance, bandeja vertical, cierre con "×", orden de subpestañas, alta multi-rol y dataset semilla quedaron definidos explícitamente)
- [x] Los requisitos son comprobables y sin ambigüedades (FR-09 incluye los seis roles; FR-22 fija la matriz por acción y FR-23 el bloqueo en store; FR-15 y FR-17 declaran precedencia; FR-21 y la sección Datos de demostración fijan conteos, estados y fechas relativas)
- [x] Los criterios de éxito son medibles (SC-01 a SC-39 con tiempos, porcentajes, conteos, bloqueos de permisos y ausencias verificables)
- [x] Los criterios de éxito son agnósticos a la tecnología (resultados observables por el usuario, sin depender de frameworks ni librerías)
- [x] Todos los escenarios de aceptación están definidos (AC-01 a AC-119 conservan sus IDs; AC-120 a AC-126 cubren FR-21 y AC-127 a AC-136 cubren roles, credenciales, matriz de permisos, dataset y alcance template 001)
- [x] Los casos límite están identificados (roles sin bandeja, máquina sin seleccionar, mini-calendario sin scroll, estados residuales de modales, roles repetidos, máximo de seis roles, acciones denegadas forzadas por URL/store, órdenes sin fechas y tickets/preventivas vencidas)
- [x] El alcance está claramente delimitado (MVP activo exclusivo de `specs/002-operations-manufacturing/`; `001-erp-base-module/` solo histórico y prohibido; sin backend ni dependencias nuevas)
- [x] Dependencias y suposiciones identificadas (sección 8, incluidas fecha relativa, fuente única de mantenciones, ancho de 520 px, validación de permisos en store e inmutabilidad de IDs AC-01 a AC-119)

## Preparación de la Funcionalidad

- [x] Todos los requisitos funcionales tienen criterios de aceptación claros (FR-09/FR-13/FR-14 → AC-34, AC-41, AC-47..AC-52, AC-82..AC-90, AC-117..AC-118, AC-127..AC-132; FR-22/FR-23 → AC-07, AC-129..AC-130; FR-15 → AC-53..AC-62, AC-79..AC-81, AC-91..AC-95, AC-112..AC-116; FR-17 → AC-67..AC-75, AC-96..AC-102, AC-104..AC-111; FR-20 → AC-104..AC-119; FR-21 → AC-120..AC-126, AC-133..AC-135)
- [x] Los escenarios de usuario cubren los flujos principales (US-01 a US-15 y US-16 de datos semilla)
- [ ] La funcionalidad cumple los resultados medibles definidos en las Métricas de Éxito (SC-21 a SC-29 para la ampliación, SC-30 a SC-34 para el dataset semilla y SC-35 a SC-39 para permisos, login, volumen y alcance; pendiente de implementación)
- [x] No hay filtración de detalles de implementación no resueltos (las referencias técnicas son restricciones de conservación acordadas, no soluciones propuestas)

## Notas

- AC-01 a AC-119 se conservan sin renombrar ni borrar. Sus redacciones de 2026-11-24 fueron **Verificado** (42 archivos y 297 pruebas); las reformulaciones de roles/permisos del 2026-11-26 vuelven a **Pendiente**.
- AC-120 a AC-126 y AC-127 a AC-136 están **Pendiente**: el dataset enriquecido, la matriz FR-22 y el bloqueo FR-23 todavía deben implementarse y validarse.
- Las redacciones históricas superadas (bandeja horizontal de AC-91, "Volver a la lista del día" de AC-58, tres bloques de AC-71, orden inicial de AC-67 y flujos de roles/cambio de rol) se mantienen como anclas documentales; la regla vigente está declarada en FR-13, FR-14, FR-22, FR-23, FR-15, FR-17, FR-20 y las notas de supersedencia.
- No se creó rama ni directorio nuevo: se trabaja en `main` y el directorio sigue siendo `specs/002-operations-manufacturing` por indicación explícita del usuario. El hook `before_specify` de `.specify/extensions.yml` se omitió para respetar esa restricción.
- La especificación está lista para `/speckit.clarify` (si se desea afinar algún punto) y para `/speckit.plan`, que deberá incorporar FR-21, FR-22, FR-23 y AC-120 a AC-136 en artefactos derivados sin alterar las Fases 1 a 30 ni las mejoras presentes en `main`.
