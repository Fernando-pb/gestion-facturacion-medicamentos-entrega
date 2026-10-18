# Tareas de implementación: gestión de Ayuntamientos

Ejecutar las tareas en el orden indicado. No iniciar una tarea hasta haber verificado la anterior.

## 1. Añadir Zod

- [x] **Objetivo:** instalar `zod` como dependencia de producción, según la decisión aprobada.
- **Archivos previstos:** `package.json`, `package-lock.json`.
- **Comportamiento esperado:** Zod queda disponible para los módulos de la aplicación sin añadir otras dependencias.
- **Comprobación:** revisar ambos archivos, confirmar que `zod` está en `dependencies` y ejecutar la suite existente.

## 2. Crear la validación de Ayuntamientos

- [x] **Objetivo:** definir esquemas sencillos y reutilizables para el cuerpo completo de POST/PUT y para el parámetro `id`.
- **Archivos previstos:** crear `src/ayuntamientos/ayuntamiento.validation.js`.
- **Comportamiento esperado:** rechazar tipos incorrectos, campos obligatorios ausentes, cadenas obligatorias vacías o con espacios, valores fuera de `ACTIVO | INACTIVO` y `GENERAL | ESPECIFICA`, campos desconocidos y cualquier `id` que no sea un entero positivo seguro. Los campos opcionales admiten omisión o `null`.
- **Comprobación:** probar los esquemas con ejemplos válidos e inválidos y verificar que POST y PUT comparten las mismas reglas obligatorias.

## 3. Crear el repositorio PostgreSQL

- [x] **Objetivo:** implementar las cuatro operaciones de persistencia mediante el `Pool` existente.
- **Archivos previstos:** crear `src/ayuntamientos/ayuntamiento.repository.js`.
- **Comportamiento esperado:** crear con `INSERT ... RETURNING`, listar con `ORDER BY id ASC`, buscar por `id` y actualizar todos los campos editables con `UPDATE ... RETURNING`. Todas las entradas usan `$1`, `$2`, etc.; no hay SQL concatenado ni ORM.
- **Comprobación:** revisar las consultas y ejecutarlas contra la base de pruebas con datos ficticios, comprobando filas devueltas, listado ordenado y ausencia de resultado para un `id` inexistente.

## 4. Implementar el controlador HTTP

- [x] **Objetivo:** coordinar validación, repositorio y respuestas para crear, listar, consultar detalle y actualizar.
- **Archivos previstos:** crear `src/ayuntamientos/ayuntamiento.controller.js`.
- **Comportamiento esperado:** devolver `201` en creación; `200` en listado, detalle y actualización; `400` ante validación inválida; `404` ante un `id` válido inexistente; y `409` cuando PostgreSQL devuelva `23505` para `uq_ayuntamiento_cif`. Los errores inesperados no se ocultan.
- **Comprobación:** revisar cada flujo, incluida la actualización completa de PUT, y confirmar que no existe un `SELECT` previo como única protección frente al CIF duplicado.

## 5. Crear y registrar las rutas

- [x] **Objetivo:** exponer únicamente los cuatro endpoints aprobados.
- **Archivos previstos:** crear `src/ayuntamientos/ayuntamiento.routes.js` y modificar `src/app.js`.
- **Comportamiento esperado:** registrar `POST /ayuntamientos`, `GET /ayuntamientos`, `GET /ayuntamientos/:id` y `PUT /ayuntamientos/:id`; conservar `GET /health`; no añadir `PATCH` ni `DELETE`.
- **Comprobación:** arrancar la aplicación, verificar que `/health` sigue respondiendo y realizar una petición básica a cada ruta contra la base de pruebas.

## 6. Preparar PostgreSQL para las pruebas

- [x] **Objetivo:** disponer de una base aislada de la base de desarrollo.
- **Archivos previstos:** ninguno versionado; configuración local de entorno no incluida en Git.
- **Comportamiento esperado:** crear `gestion_facturacion_medicamentos_test`, cargar en ella `db/schema.sql` y configurar `DB_NAME=gestion_facturacion_medicamentos_test` junto con las demás variables necesarias, sin guardar credenciales en el repositorio.
- **Comprobación:** ejecutar una conexión de prueba, confirmar que existe la tabla `ayuntamiento` y verificar explícitamente que el proceso de pruebas apunta a la base con sufijo `_test`, no a la de desarrollo.
- **Nota:** esta tarea se adelantó para permitir la comprobación de integración de la tarea 3.

## 7. Preparar la infraestructura de pruebas de Ayuntamientos

- [x] **Objetivo:** crear utilidades mínimas para datos ficticios, seguimiento y limpieza segura.
- **Archivos previstos:** crear `test/ayuntamientos.test.js`.
- **Comportamiento esperado:** cada prueba genera CIF propios, registra los IDs que crea y elimina únicamente esos registros en `afterEach`; la suite cierra el pool al finalizar. Ninguna prueba presupone una tabla vacía ni depende de otra prueba.
- **Comprobación:** ejecutar una prueba inicial, revisar que sus filas desaparecen después y confirmar que una fila ajena preparada manualmente permanece intacta.

## 8. Probar creación y validación

- [x] **Objetivo:** cubrir POST y todas las reglas de entrada comunes a POST/PUT.
- **Archivos previstos:** modificar `test/ayuntamientos.test.js`.
- **Comportamiento esperado:** comprobar creación `201`; ausencia de campos obligatorios; cadenas obligatorias vacías; tipos incorrectos; estado inválido; tipo de lista inválido; campos desconocidos; y CIF duplicado con `409` respaldado por la restricción real de PostgreSQL.
- **Comprobación:** ejecutar estas pruebas individualmente y en conjunto, en distinto orden cuando sea posible, y confirmar que todas pasan sin mocks de PostgreSQL.

## 9. Probar listado y detalle

- [x] **Objetivo:** cubrir los dos endpoints GET.
- **Archivos previstos:** modificar `test/ayuntamientos.test.js`.
- **Comportamiento esperado:** el listado devuelve `200`, incluye activos e inactivos y respeta `id ASC`; el detalle devuelve `200` para un ID existente, `404` para uno inexistente y `400` para un ID inválido.
- **Comprobación:** ejecutar el grupo de pruebas sin asumir que la tabla está vacía y verificar el orden de los registros creados por cada prueba.

## 10. Probar modificación completa

- [x] **Objetivo:** cubrir PUT y el cambio de estado sin introducir PATCH.
- **Archivos previstos:** modificar `test/ayuntamientos.test.js`.
- **Comportamiento esperado:** actualizar todos los campos editables con `200`; conservar el `id`; permitir mantener el CIF propio; permitir activar/desactivar; exigir los mismos campos obligatorios que POST; devolver `404` para un ayuntamiento inexistente y `409` al usar el CIF de otro.
- **Comprobación:** consultar posteriormente cada registro en PostgreSQL o mediante GET y confirmar su estado final; ejecutar el grupo de forma aislada y junto con el resto de la suite.

## 11. Revisar documentación y memoria

- [x] **Objetivo:** reflejar el estado real tras completar la implementación, sin duplicar la especificación detallada.
- **Archivos previstos:** modificar únicamente `MEMORY.md` si la implementación y sus pruebas han quedado completadas; ajustar `spec.md` o `plan.md` solo si el comportamiento aprobado hubiera cambiado.
- **Comportamiento esperado:** la memoria indica que Ayuntamientos está implementado, cómo se prueba y cualquier aprendizaje relevante; no contiene secretos.
- **Comprobación:** comparar documentación y comportamiento real y verificar que no existen decisiones importantes solo en el código.

## 12. Validación final

- [x] **Objetivo:** comprobar que la funcionalidad está completa y limitada al alcance aprobado.
- **Archivos previstos:** ninguno adicional; correcciones puntuales solo en los archivos ya previstos.
- **Comportamiento esperado:** los cuatro endpoints cumplen `spec.md`; todas las pruebas pasan contra PostgreSQL de pruebas; `GET /health` sigue funcionando; no existen frontend, autenticación, farmacias, medicamentos, `DELETE`, `PATCH`, filtros, paginación, ORM ni una capa de servicio sin responsabilidad real.
- **Comprobación:** ejecutar `npm test`, `git diff --check`, revisar `git status` y `git diff`, confirmar que `db/schema.sql` no cambió y comprobar que no hay credenciales ni archivos temporales versionados.

## Decisiones pendientes

No quedan decisiones bloqueantes: Zod, la base dedicada de pruebas y `ORDER BY id ASC` están aprobados. La configuración concreta de credenciales de PostgreSQL será local y no se documentará con valores sensibles.
