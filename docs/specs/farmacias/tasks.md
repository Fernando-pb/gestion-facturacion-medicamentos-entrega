# Tareas de implementación: módulo de Farmacias

Este documento cubre las reglas del módulo, su validación y su API. La página, sus flujos, mensajes y navegación se planifican por separado en [interfaz-farmacias](../interfaz-farmacias/tasks.md).

## 1. Documentar el alcance y el contrato

- [x] **Objetivo:** definir los campos, la relación con Ayuntamiento, las operaciones y las restricciones del módulo desde el esquema y el modelo conceptual.
- **Archivos:** `spec.md`, `plan.md`, `tasks.md`.
- **Comprobación:** cotejo con `db/schema.sql` y `docs/modelo-datos/modelo-datos.md`; no se cambia el esquema.

## 2. Implementar la API y validación

- [x] **Objetivo:** permitir crear, listar, consultar y actualizar farmacias con validación y consultas SQL parametrizadas.
- **Archivos:** `src/farmacias/`, montaje en `src/app.js`.
- **Comportamiento esperado:** la creación exige un ayuntamiento existente; el `UPDATE` conserva la relación original; listado y detalle devuelven los datos asociados definidos en `spec.md`.
- **Comprobación:** pruebas unitarias y de API/integración en `test/farmacia.validation.test.js` y `test/farmacias.test.js`, contra `_test` y verificando `current_database()` antes de las escrituras.

## 3. Revisar el módulo

- [x] **Objetivo:** comprobar validación, persistencia, errores y conservación de la relación asignada.
- **Comprobación:** suite de pruebas, `node --check` y `git diff --check` ejecutados durante la implementación del módulo.

## 4. Compatibilidad con farmacias sin Ayuntamiento (6 de octubre de 2026)

- [x] Permitir NULL en el esquema de instalaciones nuevas y aportar actualización transaccional repetible para bases existentes, conservando filas, FK e índice.
- [x] Usar LEFT JOIN en listado/detalle y permitir editar datos maestros de farmacias desasignadas, devolviendo los tres campos municipales como NULL.
- [x] Revisar las rutas: POST sigue exigiendo Ayuntamiento existente; PUT rechaza `ayuntamiento_id`, incluido NULL, y SQL no modifica esa columna. No hay otra ruta actual de cambio de asignación.
- **Evidencia:** `test/farmacias.test.js` verifica esquema nuevo, repetición de actualización con filas conservadas, identidad de FK/índice, maestro sin asignación, Ayuntamiento inexistente y rechazo de cambios con entrega vacía o con precinto. `test/farmacia.validation.test.js` mantiene el contrato POST/PUT. Las 23 pruebas de Farmacias y la suite completa de 243 pruebas pasaron contra la base dedicada.
- **Comprobaciones finales:** `node --check` correcto en los cinco archivos JavaScript modificados; `git diff --check` y revisión de los archivos sin seguimiento sin errores de espacios. No se realizó revisión visual manual ni se considera implementada la gestión municipal.
- **Estado posterior:** las consultas, búsquedas y operaciones municipales POST/DELETE están implementadas y probadas según `../gestion-ayuntamiento/tasks.md`; la ficha municipal está implementada según `../interfaz-gestion-ayuntamiento/tasks.md`. Siguen pendientes aplicar el script a otras instalaciones y el futuro módulo de entregas con su protocolo compartido.
