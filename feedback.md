Feedback Avance (26/10/26)

- el avance de plan y data-model no permiten dar feedback adecuado. 
- falta editar README

Proximos pasos:
 
- rectificar puntos anteriores 
- trabajar en los specs (historias de usuario, US) para definir tareas
- dividirse las US y tareas para una siguiente iteracion (avances cada semana)
- ejecutar una version integrada de prueba

Feedback Avance 02 (2/11/26)

- Se observan historias de usuario por algunos miembro del grupo
- Excelente avance acumulativo de implementacion, permite registar modificaciones e incremental
- Evitar trabajar con modelos de IA fuera de speckit en local, porque crean ramas nuevas y se pierde la integridad del proyecto

Proximos pasos:

- crear tareas a partir de los specs
- registar modificaciones/incremental y volver al spec
- dividir el grupo entre modificaciones (ajustes previos) e incremental (nueva funcionalidad)
- integrar nueva version en 2 semanas

Feedback Avance 03 (16/11/26)

- Spec.md añade US-08 (Panel de planta), US-09 (Mantenimiento), US-10 (Planificador) y US-11 (Balance de líneas), y pasa el snapshot a `erp.manufacturing.v2`. En tasks.md se agregan las fases 10 a 15 y se marca casi todo como hecho. Es claro y coherente entre ambos archivos.
- Los AC-04 a AC-07 y AC-20 aparecen como "Verificado" y también como cubiertos por US-08, pero spec.md mantiene AC-08 a AC-14 de la base con otra numeración. Conviene revisar que no haya IDs duplicados o cruzados.

Consistencia sitio–especificación

- T002 sigue sin marcar y es correcto: `vitest.config.mjs` no configura jsdom (la nota de gate lo explica).
- T084 (suites legadas de 001) sigue pendiente y es real: `tests/integration/*` y `tests/unit/storage.test.js` importan `src/storage.js`, `src/app.js` y `src/module-config.js`, que no existen en el sitio.
- Roles: spec.md FR-09 define Jefa de Planta, Planificador y Operador. El sitio añade Supervisor en `access-control.js` y un panel `RoleAccessPanel` que filtra la navegación. Esto no está en la especificación.
- spec.md usa "Operador", pero el sitio dice "Operario"; no hay una tarea que lo unifique.
- hacer mejoras de funcionalidad e interfaz de usuario, incluir data simulada para probar campos, incluir mejoras de estilo, transicion, navegacion, etcetera.

Presentacion de MVP final en 2 semanas.
