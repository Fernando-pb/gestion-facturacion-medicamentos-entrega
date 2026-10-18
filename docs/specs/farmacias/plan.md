# Plan técnico: gestión de Farmacias

## 1. Punto de partida

`src/app.js` monta los módulos con rutas, controlador, validación Zod y repositorio SQL sobre el Pool compartido. `farmacia.ayuntamiento_id` permite NULL en el esquema, conservando su FK. La compatibilidad aprobada del 6 de octubre de 2026 se aplica a bases existentes mediante `db/updates/001-farmacia-ayuntamiento-opcional.sql`, sin backfill ni dependencias nuevas.

## 2. Arquitectura

`src/farmacias/` separa rutas, controlador, validación y repositorio. Las consultas parametrizadas usan `LEFT JOIN ayuntamiento`, conservando las farmacias sin asignación y devolviendo datos de Ayuntamiento nulos. En `UPDATE` solo se incluyen columnas editables distintas de `ayuntamiento_id`.

Se monta el router en `src/app.js`. El diseño de páginas, formularios, mensajes y navegación se describe por separado en [el plan de interfaz de Farmacias](../interfaz-farmacias/plan.md).

## 3. Archivos previstos

### Crear

- `docs/specs/farmacias/spec.md`, `plan.md`, `tasks.md`.
- `src/farmacias/farmacia.validation.js`, `farmacia.repository.js`, `farmacia.controller.js`, `farmacia.routes.js`.
- Pruebas de validación y API/integración en `test/`.

### Modificar

- `src/app.js`: montar `/farmacias`.

La ampliación de compatibilidad actualiza `db/schema.sql`, añade el script SQL y su procedimiento en `db/README.md`, adapta consultas y presentación y registra evidencia en tareas y MEMORY. No cambia dependencias ni configuración local.

## 4. API y persistencia

POST conserva una referencia positiva obligatoria; la FK protege la existencia y el controlador traduce `23503` a `400`. `uq_farmacia_soe` se traduce a `409`. GET usa `LEFT JOIN`. PUT valida y actualiza únicamente datos editables: rechaza `ayuntamiento_id` con cualquier valor, incluso NULL, por lo que ninguna ruta del CRUD maestro modifica la asignación. Las operaciones municipales ya implementadas comprueban origen y actividad de forma atómica, según `../gestion-ayuntamiento/plan.md`.

## 5. Pruebas y seguridad

Vitest y Supertest cubrirán validación y persistencia real. `DB_NAME` se establecerá en el proceso que ejecuta las pruebas; antes de la primera escritura se comprobará `current_database()` y se abortará si no coincide exactamente con `gestion_facturacion_medicamentos_test`. Se guardarán IDs de recursos creados por cada prueba para limpieza parametrizada y acotada. El plan y las comprobaciones de pantalla están en [interfaz-farmacias](../interfaz-farmacias/plan.md).

Las comprobaciones finales incluirán suite de pruebas, `node --check` en JavaScript nuevo/modificado y `git diff --check`. Las pruebas de la interfaz se detallan en el plan separado indicado arriba.
