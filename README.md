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

## Ingreso y roles simulados

El inicio es un login genérico: no muestra roles, descripciones ni pistas sobre los permisos. Usa una de estas cuentas de demostración; en todas ellas la contraseña es igual al usuario:

| Usuario | Contraseña | Roles asignados |
|---|---|---|
| `jefa` | `jefa` | Jefa de Planta (`plant_manager`) |
| `supervisor` | `supervisor` | Supervisor de línea (`supervisor`) |
| `planificador` | `planificador` | Planificador (`planner`) |
| `operador` | `operador` | Operador de Máquina (`operator`) |
| `mantenimiento` | `mantenimiento` | Encargado de Mantenimiento (`maintenance`) |
| `test` | `test` | Jefa de Planta, Supervisor de línea, Planificador, Operador de Máquina y Encargado de Mantenimiento |
| `doble` | `doble` | Operador de Máquina y Encargado de Mantenimiento |

No hay autenticación real: es una simulación frontend para demostrar permisos. El formulario valida las credenciales con `src/data/fixtures/demo-accounts.js`, guarda el rol real y el efectivo en `erp.manufacturing.role` y vuelve al login al cargar la página o al pulsar **Cerrar sesión**. El rol real es el que proviene del login; el rol efectivo es el que filtra la navegación con `src/domain/access-control.js`.

**Ver como** aparece en el menú de usuario de la barra superior solo cuando la cuenta tiene más de un rol asignado; en la demo están disponibles para `test` y `doble`. Al elegir un rol se muestra la etiqueta «Viendo como: <rol>» y se puede volver al rol real desde el mismo menú. El logo lleva al módulo de inicio del rol efectivo. Cerrar sesión descarta ambos roles.

La pestaña **Roles** muestra solo las tarjetas de los roles asignados al usuario autenticado. Cada tarjeta indica cuál es el rol efectivo y permite cambiar a otro de los roles asignados después de confirmar. La pestaña **Configurar roles** solo está habilitada cuando el rol efectivo es Jefa de Planta (`plant_manager`); permite dar de alta usuarios con hasta 5 roles en una sola operación, asignar roles adicionales y dar de baja usuarios por rol.

| Rol | Módulos principales |
|---|---|
| Jefa de Planta | Panel, BOM, Órdenes, Estación, Supervisión, Planta, Planificación, Balance, Mantenimiento, Roles y Configurar roles |
| Supervisor de línea | Panel, Estación, Supervisión, Planta, Planificación, Mantenimiento y Roles |
| Planificador | Panel, BOM, Órdenes, Planta, Planificación, Balance y Roles |
| Operador de Máquina | Estación, Planificación y Roles |
| Encargado de Mantenimiento | Planificación y Mantenimiento |

La etiqueta visible es **Operador de Máquina** (o **Operador** en selectores compactos).

### Cambiar contraseña

El menú de usuario ofrece **Cambiar contraseña**. El diálogo (`src/components/ChangePasswordDialog.js`) solicita **Contraseña actual**, **Nueva contraseña** y **Confirmar nueva contraseña**: recorta espacios, exige que la actual y la nueva no estén vacías, verifica que la nueva coincida con la confirmación y valida la contraseña actual contra el usuario autenticado.

`ManufacturingStore.changeUserPassword(username, currentPassword, newPassword)` actualiza todas las filas del usuario en las tablas de roles donde aparece y persiste el cambio en el snapshot `erp.manufacturing.v2`. Por eso una misma cuenta multicrol comparte una sola contraseña vigente.

## Navegación

- El módulo activo se sincroniza con el hash (`#/dashboard`, `#/plant`, `#/scheduling`, ...), por lo que funcionan enlaces profundos y el botón atrás del navegador.
- Si un rol abre por URL un módulo no permitido, la app lo redirige a su módulo de inicio.
- El panel **Roles** muestra las páginas disponibles para los roles asignados; **Configurar roles** está restringido al rol efectivo Jefa de Planta.
- En pantallas de hasta 900 px la barra lateral se convierte en un drawer: se abre con el botón hamburguesa, se cierra con Escape, con clic fuera o al elegir un módulo, y devuelve el foco al botón. El menú de usuario (avatar, rol efectivo, «Ver como» y «Cerrar sesión») se opera con teclado y se cierra con Escape o clic fuera.
- El panel inicial ofrece avisos de situación (alarmas, tickets, cierres y atrasos) y actividad reciente simulada; la navegación lateral cubre todos los destinos por rol.
- En Órdenes, las tarjetas del tablero se pueden arrastrar a la siguiente columna válida; los botones del detalle siguen siendo la alternativa accesible.

## Datos simulados

- `src/data/fixtures/`: maestros, BOM, rutas, órdenes, turnos, atrasos, asignaciones, mantenimiento y umbrales.
- `src/data/fixtures/dashboard-demo.js`: actividad reciente del inicio; no se persiste.
- `src/data/persistence.js`: snapshot vigente `erp.manufacturing.v2`, con migración desde `v1`.
- Los roles real y efectivo se guardan por separado del snapshot en `erp.manufacturing.role` (formato `real|efectivo`).

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

- No hay deuda pendiente de Fase 16. `T002` quedó cerrado con `environment: 'jsdom'` global en `vitest.config.mjs` y `T084` con el aislamiento histórico de las 12 suites heredadas de `001-erp-base-module` que importan `src/app.js`, `src/storage.js` y `src/module-config.js`: se excluyen en `test.exclude` (conservando los excludes por defecto), sin borrarlas. Ese módulo es solo contexto histórico/prohibido y no forma parte del MVP activo. Detalle en `specs/002-operations-manufacturing/tasks.md`.
