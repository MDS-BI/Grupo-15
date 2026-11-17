# Módulo de Operaciones / Manufactura (ERP)

Prototipo frontend del módulo de manufactura del Grupo 15. El flujo cubre BOM y rutas, órdenes de producción, ejecución en piso, turno del operador, supervisión de línea, panel de desempeño de planta, mantenimiento, planificación y balance de líneas.

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

El inicio es un login genérico: no muestra roles, descripciones ni pistas sobre los permisos. Usa una de estas cuentas de demostración:

| Usuario | Contraseña | Rol |
|---|---|---|
| `operador` | `Op3rador2026` | Operador de Máquina |
| `supervisor` | `Sup3rvisor2026` | Supervisor de línea |
| `planificador` | `Pl4nificador2026` | Planificador |
| `jefa.planta` | `Pl4nta2026` | Jefa de Planta (administrador) |
| `usuario` | `usuario` | Jefa de Planta (administrador) |

No hay autenticación real: es una simulación frontend para demostrar permisos. El formulario valida las credenciales con `src/data/fixtures/demo-accounts.js`, guarda el rol en `erp.manufacturing.role` y vuelve al login al cargar la página o al pulsar **Cerrar sesión**. El selector de la barra superior permite cambiar de rol sin recargar, y la navegación lateral se filtra con `src/domain/access-control.js`.

| Rol | Módulos principales |
|---|---|
| Jefa de Planta | Panel, BOM, Órdenes, Estación, Supervisión, Planta, Planificación, Balance, Mantenimiento, Roles y Datos de roles |
| Supervisor de línea | Panel, Órdenes, Estación, Supervisión, Planta, Mantenimiento, Roles |
| Planificador | Panel, BOM, Órdenes, Planta, Planificación, Balance, Roles |
| Operador de Máquina | Panel, Estación, Planta, Mantenimiento, Roles |

Las tarjetas con los datos de cada rol (nombre, descripción y "Entrar como…") viven solo en `#/admin/roles`, accesible únicamente para la Jefa de Planta; los demás roles son redirigidos aunque escriban el hash directamente.

La etiqueta visible es **Operador de Máquina** (o **Operador** en selectores compactos).

## Navegación

- El módulo activo se sincroniza con el hash (`#/dashboard`, `#/plant`, `#/scheduling`, ...), por lo que funcionan enlaces profundos y el botón atrás del navegador.
- Si un rol abre por URL un módulo no permitido, la app lo redirige a su módulo de inicio.
- El panel **Roles** muestra las páginas disponibles para cada rol; **Datos de roles** (`#/admin/roles`) está restringido a la Jefa de Planta.
- El panel inicial ofrece avisos de situación (alarmas, tickets, cierres y atrasos) y actividad reciente simulada; la navegación lateral cubre todos los destinos por rol.
- En Órdenes, las tarjetas del tablero se pueden arrastrar a la siguiente columna válida; los botones del detalle siguen siendo la alternativa accesible.

## Datos simulados

- `src/data/fixtures/`: maestros, BOM, rutas, órdenes, turnos, atrasos, asignaciones, mantenimiento y umbrales.
- `src/data/fixtures/dashboard-demo.js`: actividad reciente del inicio; no se persiste.
- `src/data/persistence.js`: snapshot vigente `erp.manufacturing.v2`, con migración desde `v1`.
- El rol activo se guarda por separado en `erp.manufacturing.role`.

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

- `T002`: Vitest no configura jsdom globalmente; las suites que necesitan DOM crean su propio `JSDOM`.
- `T084`: 12 suites heredadas de `001-erp-base-module` importan `src/app.js`, `src/storage.js` y `src/module-config.js`, que no existen en este módulo. Están documentadas en `specs/002-operations-manufacturing/tasks.md`.
