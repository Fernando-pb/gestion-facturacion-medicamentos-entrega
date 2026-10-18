# Plan técnico: gestión de Ayuntamientos

## 1. Punto de partida

El proyecto ya dispone de:

- una aplicación Express configurada en `src/app.js` con soporte JSON;
- un `Pool` de PostgreSQL compartido en `src/db.js`;
- separación entre la aplicación y el arranque del servidor;
- Vitest y Supertest, con una prueba de API existente;
- la tabla `ayuntamiento` y sus restricciones en `db/schema.sql`.

La implementación añadirá el módulo de Ayuntamientos sin modificar el esquema ni incorporar un ORM.

## 2. Arquitectura elegida

Se propone un módulo en `src/ayuntamientos/` con cuatro responsabilidades:

- **Rutas:** relacionan cada método y URL con su controlador. No contienen SQL ni reglas de negocio.
- **Controlador:** recibe la petición, usa la validación y el repositorio, y traduce el resultado a una respuesta HTTP.
- **Validación:** define y reutiliza las reglas del cuerpo y del parámetro `id`.
- **Repositorio:** contiene únicamente las consultas SQL parametrizadas y devuelve filas o ausencia de resultado.

No se propone una capa de servicio en este hito. Los casos de uso solo requieren validar una petición y ejecutar una consulta; añadir un servicio sería una delegación sin responsabilidad propia. Si más adelante aparecen operaciones que coordinen varias consultas o reglas de negocio, se reconsiderará.

`src/app.js` montará las rutas bajo `/ayuntamientos`. El repositorio importará el `pool` ya existente de `src/db.js`.

## 3. Archivos previstos

### Crear

- `src/ayuntamientos/ayuntamiento.routes.js`: definición de las cuatro rutas.
- `src/ayuntamientos/ayuntamiento.controller.js`: flujo HTTP de cada endpoint.
- `src/ayuntamientos/ayuntamiento.repository.js`: `INSERT`, consultas y `UPDATE`.
- `src/ayuntamientos/ayuntamiento.validation.js`: esquemas de cuerpo e identificador.
- `test/ayuntamientos.test.js`: pruebas de API/integración contra PostgreSQL.

### Modificar

- `src/app.js`: importar y montar el router.
- `package.json`: Zod está instalado como dependencia de producción.
- `package-lock.json`: registra la instalación de Zod.
- `MEMORY.md`: actualizado al finalizar la implementación y las pruebas del módulo, conforme a `AGENTS.md`.

No se prevén cambios en `src/db.js` ni `db/schema.sql`.

## 4. Flujo de los endpoints

### `POST /ayuntamientos`

1. Validar el cuerpo completo.
2. Ejecutar un `INSERT ... VALUES ($1, $2, ...) RETURNING ...`.
3. Responder `201 Created` con el registro creado.
4. Si PostgreSQL informa de la violación de unicidad del CIF, responder `409 Conflict`.

### `GET /ayuntamientos`

1. Ejecutar un `SELECT` con la lista explícita de columnas.
2. Aplicar un orden estable por `id ASC`.
3. Responder `200 OK` con el array, también cuando esté vacío.

### `GET /ayuntamientos/:id`

1. Validar que `id` sea un entero positivo.
2. Ejecutar `SELECT ... WHERE id = $1`.
3. Responder `200 OK` si existe o `404 Not Found` si no existe.

### `PUT /ayuntamientos/:id`

1. Validar `id` y el cuerpo completo con las mismas reglas obligatorias que POST.
2. Ejecutar `UPDATE ... WHERE id = $n RETURNING ...`; el `id` no forma parte de los campos actualizables.
3. Responder `200 OK` con el registro actualizado.
4. Si no se actualiza ninguna fila, responder `404 Not Found`.
5. Si el nuevo CIF pertenece a otro registro, responder `409 Conflict`.

No se implementará `PATCH`, `DELETE` ni un endpoint específico para el estado. Activar o desactivar forma parte del `PUT` completo.

## 5. Validación de entrada

La validación utiliza `zod`, instalado como dependencia de producción. Aporta esquemas declarativos pequeños, mensajes de validación predecibles y reutilización del mismo esquema para POST y PUT. Evita mantener comprobaciones manuales repetidas para los trece campos editables.

Se usa un esquema estricto para rechazar un cuerpo que no sea un objeto válido, tipos incorrectos y campos desconocidos como `id`. Las reglas son:

- `cif`, `denominacion`, `direccion`, `codigo_postal`, `localidad` y `provincia`: cadenas obligatorias que, tras `trim`, deben contener al menos un carácter;
- `cif`: además se convierte a mayúsculas mediante `.toUpperCase()` de Zod antes de persistirlo; POST y PUT reutilizan esta normalización;
- `estado`: enumeración `ACTIVO | INACTIVO`;
- `tipo_lista_medicamentos`: enumeración `GENERAL | ESPECIFICA`;
- `telefono`, `movil`, `persona_responsable`, `persona_contacto` y `alcalde`: cadenas opcionales y anulables;
- `id` de ruta: texto formado exclusivamente por dígitos que se convierte en un entero positivo y seguro.

La normalización del CIF con `trim` y mayúsculas está confirmada. La validación formal de su formato y dígito de control queda como mejora futura, igual que los formatos de código postal y teléfonos. Los errores de validación se convertirán en `400 Bad Request` con un mensaje breve.

Zod está instalado y sus esquemas se reutilizan para validar los cuerpos de POST y PUT y el parámetro `id`.

## 6. Acceso a PostgreSQL

El repositorio utilizará `pool.query()` y SQL explícito. Todas las entradas se enviarán mediante parámetros `$1`, `$2`, etc.; nunca se interpolarán valores recibidos del cliente.

- **INSERT:** incluir las columnas editables y utilizar `RETURNING` con todas las columnas del recurso.
- **Listado:** seleccionar explícitamente las columnas de `ayuntamiento` y ordenar por `id ASC`.
- **Detalle:** filtrar mediante `WHERE id = $1`.
- **UPDATE:** asignar únicamente los campos editables mediante parámetros, filtrar por el último parámetro de `id` y usar `RETURNING`.

Estas operaciones afectan a una sola fila y no requieren una transacción explícita. El pool gestiona la conexión necesaria para cada consulta.

## 7. Tratamiento de errores

El controlador distinguirá solo los casos necesarios para este módulo:

- `400 Bad Request`: cuerpo o `id` inválidos;
- `404 Not Found`: consulta o actualización de un `id` válido inexistente;
- `409 Conflict`: PostgreSQL devuelve el código `23505` para la restricción `uq_ayuntamiento_cif`;
- `200 OK` y `201 Created`: operaciones correctas según el endpoint.

La unicidad no dependerá de un `SELECT` previo, porque dos peticiones simultáneas podrían superar esa comprobación. La restricción `UNIQUE` será la garantía definitiva y su error se traducirá a `409`. No es necesario consultar antes de insertar o actualizar.

Los errores inesperados no se ocultarán: se pasarán al mecanismo de errores de Express y se registrarán o tratarán de forma mínima según la configuración de la aplicación. No se diseñará todavía un framework global de errores.

## 8. Estrategia de pruebas

Las pruebas principales serán de API/integración con Supertest sobre `app` y utilizarán el PostgreSQL real configurado en `src/db.js`; no se sustituirá el repositorio ni el pool por mocks.

Las pruebas de integración se ejecutan contra la base local dedicada `gestion_facturacion_medicamentos_test`, creada con `db/schema.sql` y seleccionada mediante la configuración local de entorno, especialmente `DB_NAME`. Esta base evita mezclar las pruebas con los datos de desarrollo; debe configurarse también en cada equipo que vaya a ejecutar la integración.

Para mantener cada prueba independiente:

- cada prueba preparará solo los registros que necesita;
- los CIF serán ficticios y únicos para esa prueba;
- los IDs insertados se guardarán durante la prueba;
- la limpieza eliminará exclusivamente esos IDs en `afterEach`, nunca todas las filas de la tabla;
- las aserciones del listado buscarán los registros preparados por la propia prueba y no asumirán que la tabla está vacía;
- ninguna prueba dependerá del resultado o del orden de otra;
- al finalizar la suite se cerrará el pool.

Se cubrirán todos los comportamientos enumerados en `spec.md`: altas válidas e inválidas, CIF duplicado, enumeraciones, listado, IDs válidos e inválidos, detalle, modificación completa, cambio de estado, conflicto de CIF y ausencia de borrado físico. El caso de CIF duplicado comprobará el comportamiento respaldado por la restricción real de PostgreSQL.

## 9. Dependencias nuevas

La única dependencia añadida para esta funcionalidad es:

- `zod`: dependencia de producción para validar cuerpos y parámetros de la API.

Express, `pg`, Vitest y Supertest ya están instalados y se reutilizarán.

## 10. Decisiones confirmadas

Para esta implementación quedaron confirmadas las siguientes decisiones:

1. `zod` se utiliza como dependencia de producción.
2. Las pruebas de integración utilizan la base local dedicada `gestion_facturacion_medicamentos_test`; las credenciales se configuran localmente y no se guardan en el repositorio.
3. El listado utiliza el orden estable `id ASC`.

## 11. Fuera de alcance

No se incluirán farmacias, medicamentos, facturación, autenticación, frontend, `DELETE`, `PATCH`, paginación, filtros ni manejo global sofisticado de errores.
