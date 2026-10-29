# Inicio Rápido: Módulo de Operaciones / Manufactura (ERP)

**Rama**: `002-operations-manufacturing` | **Fecha**: 2026-10-29
**Referencias**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [contracts/operator-shift.md](contracts/operator-shift.md)

---

## 1. Configuración

1. Instale dependencias: `npm install`.
2. Inicie el servidor de desarrollo: `npm run dev`.
3. Abra la URL local que imprime Vite.
4. Ejecute las pruebas: `npm test` (Vitest, modo watch) o `npm test -- --run` (una sola pasada).
5. Verifique el build: `npm run build`.

El módulo es frontend-only: no requiere backend ni variables de entorno. Los datos iniciales provienen de `src/data/fixtures/` y se persisten en `localStorage` bajo `erp.manufacturing.v1`.

---

## 2. Recorrido principal (US-01 a US-05)

1. **Panel**: confirme KPIs de órdenes activas, scrap rate y carga por centro de trabajo.
2. **BOM**: abra el explorador, expanda al menos 4 niveles y verifique el árbol multinivel.
3. **Órdenes**: cree una orden desde stock o MTO; libérela y confirme que se generan las operaciones congeladas.
4. **Ejecución**: inicie una operación, registre consumo y salida parcial; verifique el débito/crédito simulado de inventario.
5. **Trazabilidad**: revise plan vs. real, calidad derivada y el estado global de la orden.

---

## 3. Flujo del operador (US-06)

1. Abra la vista de **Operador** (estación de trabajo).
2. Confirme que se muestran la orden activa y su operación en curso.
3. Pulse **Iniciar**:
   - la operación pasa a `in_progress`;
   - la orden pasa de `released` a `in_progress`;
   - el cronómetro avanza desde `started_at`.
4. Registre un **atraso**:
   - elija un motivo predefinido o cree uno nuevo;
   - el atraso queda abierto y el tiempo efectivo se pausa;
   - pulse **Finalizar atraso** y confirme que el tiempo efectivo se reanuda.
5. Use los **contadores de piezas**:
   - `+`/`−` o edición directa sobre el contador del turno;
   - verifique que el acumulado cambia en el mismo delta;
   - intente un valor negativo o no numérico y confirme el error inline con el último valor válido.
6. Pulse **Finalizar**:
   - aparece la confirmación con tiempo efectivo, atrasos y piezas;
   - cancele una vez y confirme que no hay cambios;
   - confirme y verifique que la operación queda `completed` y que no se puede volver a finalizar.
7. Repita el flujo dejando un atraso **abierto** al finalizar:
   - el cierre debe permitirse;
   - el atraso debe quedar marcado *Abierto — pendiente de corrección*;
   - use **Corregir atraso** para cerrarlo y confirme que el tiempo efectivo se recalcula.
8. Abra un **nuevo turno** sobre otra operación y confirme que el contador del turno arranca en `0` y el acumulado de la operación se conserva.

---

## 4. Validación de persistencia

1. Con un turno activo y un atraso abierto, recargue la página.
2. Confirme que se rehidratan turno, atraso, contadores y que el cronómetro continúa desde `started_at` (no desde cero).
3. Cierre la pestaña y vuelva a abrir la aplicación: el snapshot de `localStorage` debe restaurar el estado.
4. Para reiniciar la demo:
   - ejecute en la consola `localStorage.removeItem('erp.manufacturing.v1')` y recargue; o
   - use la acción de reset de demo si está disponible en la UI.
5. Para probar un snapshot inválido, escriba un JSON corrupto en la clave y recargue: la app debe cargar fixtures y mostrar una advertencia, sin romperse.

---

## 5. Casos límite a verificar

| Caso | Resultado esperado |
|---|---|
| Iniciar una segunda operación con otra en curso | Rechazo con mensaje; la operación activa no cambia. |
| Doble clic en `Finalizar` | Solo se aplica el primer cierre; el segundo se rechaza. |
| Atraso sin motivo | Rechazo bloqueante. |
| Dos atrasos simultáneos | Rechazo; debe cerrarse el atraso actual. |
| Motivo personalizado duplicado | Rechazo por etiqueta repetida (sin distinguir mayúsculas). |
| Contador negativo o `NaN` | Rechazo inline; se conserva el último valor válido. |
| Finalizar con atraso abierto | Cierre permitido; atraso pendiente de corrección. |
| Corrección con `endedAt` fuera del intervalo | Rechazo; no se muta el atraso. |
| Recarga durante el turno | Estado, tiempos, atrasos y contadores se restauran. |

---

## 6. Mapa de criterios de aceptación

| AC | Verificación |
|---|---|
| AC-11 | Pasos 3, 6 y casos de doble inicio/cierre. |
| AC-12 | Pasos 4, 7 y casos de motivo obligatorio/atrasos simultáneos. |
| AC-13 | Paso 5, paso 8 y casos de contador inválido. |

---

## 7. Solución de problemas

- **El cronómetro no avanza**: verifique que exista un turno `in_progress`; el tiempo se deriva de `started_at`, no de un intervalo en memoria.
- **El estado vuelve a fixtures**: el snapshot puede estar corrupto o tener otra versión; revise la consola y la advertencia de arranque.
- **No aparece el botón `Finalizar`**: la operación no está `in_progress` o ya fue cerrada; recargue y revise el estado persistido.
- **Los motivos personalizados no aparecen**: solo son visibles dentro del turno que los creó; abra el turno correcto o use un motivo predefinido.
- **Pruebas lentas o en watch**: use `npm test -- --run` para una pasada única.
