# Módulo de Operaciones / Manufactura (ERP)

Prototipo frontend del módulo de manufactura del Grupo 15. El flujo cubre BOM y rutas, órdenes de producción, ejecución en piso, turno del operador, supervisión de línea, panel de desempeño de planta, mantenimiento, planificación y balance de líneas.

> **Alcance vigente**: el MVP activo corresponde exclusivamente a `specs/002-operations-manufacturing/`. `specs/001-erp-base-module/` es solo referencia histórica y está prohibido: no se generan los botones **Documentos**, **Entidades** ni **Módulo Base ERP**, y no se incorporan `src/storage.js` ni `src/module-config.js`.

## Integrantes

- Trujillo Peñaloza Julián Alberto (@JualTrupe)
- Rivas Merino Sebastián Matías (@SebastianRivasprg)
- Espinoza Sepúlveda Carlos Gonzalo (@carlos-277)
- Concha Barra Maite Valentina (@maiteval)
- Mogster Carrasco Maximiliano (@maximilianMC)
- Durán Lara Liang Giuliana Martina (@Lia-dl)

## Ejecutar

```bash
npm install
npm run dev
```

Abre la URL que muestra Vite (normalmente http://localhost:5173).

| Comando | Propósito |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run preview` | Vista previa del build |
| `npm test -- --run` | Pruebas unitarias y de integración |
| `npm run lint` | ESLint |
| `npm run format:check` | Verificación de formato |

## Ingreso y roles

El inicio es un login genérico: no muestra roles, descripciones ni pistas sobre los permisos. Hay **una cuenta por rol**; las credenciales son exactamente estas:

| Usuario | Contraseña | Persona | Rol | Módulo de inicio |
|---|---|---|---|---|
| `jefa.planta` | `ForjaPlanta26!` | Bárbara Ilicura Sotomayor | Jefa de Planta (`plant_manager`, administradora) | Panel de planta (`#/plant`) |
| `planificador.ops` | `Calendario2026!` | Marisol Antihuala Cárcamo | Planificador (`planner`) | Planificación (`#/scheduling`) |
| `ingeniero.prod` | `RutaOptimal26!` | Efraín Troncoso Bustamante | Ingeniero de Producción (`production_engineer`) | Balance de líneas (`#/line-balance`) |
| `supervisor.linea` | `TurnoLinea26!` | Cristóbal Zermeño Aravena | Supervisor de Línea (`supervisor`) | Supervisión (`#/supervision`) |
| `operador.planta` | `Estacion2026!` | Yanis Cheuquemán Linco | Operador (`operator`) | Estación (`#/operator`) |
| `mantencion.mgr` | `TallerMaq26!` | Ruperto Espinoza Gaete | Encargado de Mantenimiento (`maintenance`) | Mantenimiento (`#/maintenance`) |

No hay autenticación real ni backend: es una simulación frontend. El formulario valida las credenciales con `src/data/fixtures/demo-accounts.js`, guarda el rol del login en `erp.manufacturing.role` y vuelve al ingreso al cargar la página o al pulsar **Cerrar sesión**. No existen las cuentas `usuario`, `test` ni `doble`, y no hay controles de cambio de rol en la cabecera ni en los paneles.

**Ver como** aparece solo en el menú de usuario de `jefa.planta`. Es una previsualización temporal: muestra «Viendo como: <rol>» y aplica la intersección de permisos entre el rol autenticado y el rol previsualizado, sin ampliarlos. La identidad y la contraseña siguen siendo las del login; cerrar sesión descarta la previsualización.

La única página **Roles** (`#/roles`) está disponible solo para `jefa.planta`, integra las seis tarjetas y las seis tablas, y permite altas de usuario con un solo rol y bajas confirmadas por rol. No existe el botón **Datos de roles**, una vista independiente `#/admin-roles` ni asignaciones adicionales de rol.

| Rol | Módulos principales |
|---|---|
| Jefa de Planta | Todos: Panel, BOM, Órdenes, Estación, Supervisión, Planta, Planificación, Balance, Mantenimiento y Roles |
| Planificador | Panel, BOM, Órdenes, Planta, Planificación y Balance |
| Ingeniero de Producción | Panel (solo lectura), BOM, Balance y Planta (solo lectura) |
| Supervisor de Línea | Panel (solo lectura), Estación, Supervisión, Planta (solo lectura), Planificación y Mantenimiento |
| Operador | Estación y Planificación (solo Calendario) |
| Encargado de Mantenimiento | Mantenimiento y Planificación (Listado de mantenciones activas) |

La etiqueta visible canónica es **Operador** en toda la interfaz. Los permisos por acción (`ver`, `crear`, `editar`, `aprobar/cerrar`, `exportar`, `configurar umbrales`) se rigen por la matriz FR-22 de `specs/002-operations-manufacturing/spec.md`: el Operador solo ve y reporta incidentes en Mantenimiento; solo Encargado y Jefa toman/cierran tickets; solo Planificador y Jefa liberan, reprograman o cancelan órdenes; Ingeniero edita BOM, rutas y balance; solo Jefa configura umbrales. Las acciones no permitidas se ocultan y el store las rechaza con `permission-denied`.

### Cambiar contraseña

El menú de usuario ofrece **Cambiar contraseña** a cualquier cuenta autenticada. El diálogo (`src/components/ChangePasswordDialog.js`) solicita **Contraseña actual**, **Nueva contraseña** y **Confirmar nueva contraseña**: recorta espacios, exige que la actual y la nueva no estén vacías, verifica que la nueva coincida con la confirmación y valida la contraseña actual contra el usuario autenticado.

`ManufacturingStore.changeUserPassword(username, currentPassword, newPassword)` actualiza la contraseña en la tabla o tablas donde aparece el usuario y persiste el cambio en el snapshot `erp.manufacturing.v2`. Para las cuentas demo el valor inicial es el de la tabla anterior, no necesariamente el nombre de usuario; para cuentas nuevas sí es igual al usuario.

## Navegación

- El módulo activo se sincroniza con el hash (`#/dashboard`, `#/plant`, `#/scheduling`, ...), por lo que funcionan enlaces profundos y el botón atrás del navegador.
- Si un rol abre por URL un módulo no permitido, la app lo redirige a su módulo de inicio.
- La única página **Roles** muestra las seis tarjetas y la configuración integrada; está restringida al rol autenticado Jefa de Planta.
- En pantallas de hasta 900 px la barra lateral se convierte en un drawer: se abre con el botón hamburguesa, se cierra con Escape, con clic fuera o al elegir un módulo, y devuelve el foco al botón. El menú de usuario (avatar, rol autenticado, «Ver como» solo para Jefa y «Cerrar sesión») se opera con teclado y se cierra con Escape o clic fuera.
- El panel inicial ofrece avisos de situación (alarmas, tickets, cierres y atrasos) y actividad reciente simulada; la navegación lateral cubre todos los destinos por rol.
- En Órdenes, las tarjetas del tablero se pueden arrastrar a la siguiente columna válida; los botones del detalle siguen siendo la alternativa accesible.

## Datos simulados

- `src/data/fixtures/`: maestros, BOM, rutas, órdenes, turnos, atrasos, asignaciones, mantenimiento y umbrales.
- `src/data/fixtures/dashboard-demo.js`: actividad reciente del inicio; no se persiste.
- `src/data/persistence.js`: snapshot vigente `erp.manufacturing.v2`, con migración desde `v1`.
- El rol del login se guarda por separado del snapshot en `erp.manufacturing.role`; "Ver como" solo modifica una previsualización en memoria.
- El dataset semilla incluye 4 productos terminados con BOM de hasta 4 niveles, 10 centros de trabajo (uno inactivo), 40 órdenes en tres meses y todos los estados, 15 tickets, 5 preventivas y 12 empleados de RR.HH.; el conjunto opcional `demo-volume-500` se genera solo para la prueba de rendimiento.

## Captura de datos

- Los campos numéricos aceptan escritura directa con punto o coma decimal y un máximo de dos decimales; `src/components/numeric-field.js` centraliza el análisis y los mensajes de error.
- En Estación, el contador acumulado no puede superar la cantidad planificada de la orden; el rechazo se muestra inline y conserva el último valor válido.

## Estructura

- `src/domain/`: lógica pura (BOM, capacidades, turnos, semáforo, mantenimiento, OEE, fechas y control de acceso).
- `src/data/`: fixtures, store, adaptadores y exportadores.
- `src/components/`: vistas de cada historia de usuario.
- `src/styles/manufacturing.css`: tokens, layout, estados accesibles y transiciones con `prefers-reduced-motion`.
- `specs/002-operations-manufacturing/`: especificación, plan, contratos y tareas.

## Deuda conocida

- No hay deuda pendiente de Fase 16. `T002` quedó cerrado con `environment: 'jsdom'` global en `vitest.config.mjs`; la excepción documentada de Fase 33 retiró `browser-check.html`, las 13 suites heredadas de `001-erp-base-module` y el bloque `exclude` heredado. `001-erp-base-module` es solo contexto histórico/prohibido y no forma parte del MVP activo. Detalle en `specs/002-operations-manufacturing/tasks.md`.
