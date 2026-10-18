# Especificación funcional: gestión de Ayuntamientos

## 1. Objetivo y alcance

Esta funcionalidad permite mantener los datos básicos de los ayuntamientos durante el MVP. Incluye alta, listado, consulta individual y modificación. La activación y desactivación se realiza modificando el campo `estado`.

No se contempla el borrado físico: un ayuntamiento con información relacionada debe conservarse para no perder trazabilidad.

## 2. Datos del Ayuntamiento

La funcionalidad utiliza exactamente los campos existentes en el modelo:

| Campo | Obligatorio | Observaciones |
|---|---:|---|
| `id` | Sí | Lo genera PostgreSQL. Es estable y no se recibe al crear ni se modifica. |
| `cif` | Sí | Debe ser único. Se recorta con `trim` y se convierte a mayúsculas antes de guardarlo. Puede corregirse posteriormente. |
| `denominacion` | Sí | Nombre oficial. |
| `direccion` | Sí | Dirección postal. |
| `codigo_postal` | Sí | Código postal. |
| `localidad` | Sí | Localidad. |
| `provincia` | Sí | Provincia. |
| `telefono` | No | Teléfono de contacto. |
| `movil` | No | Teléfono móvil de contacto. |
| `persona_responsable` | No | Persona responsable. |
| `persona_contacto` | No | Persona de contacto. |
| `alcalde` | No | Nombre del alcalde. |
| `estado` | Sí | Solo `ACTIVO` o `INACTIVO`. |
| `tipo_lista_medicamentos` | Sí | Solo `GENERAL` o `ESPECIFICA`. |

Las cadenas obligatorias no pueden estar vacías ni contener únicamente espacios.

## 3. Casos de uso

### 3.1 Crear Ayuntamiento

El usuario proporciona todos los campos obligatorios y, opcionalmente, los datos de contacto y responsables. El sistema valida la petición y crea el registro con un `id` nuevo.

El alta se rechaza si faltan campos obligatorios, alguno está vacío, los valores enumerados no son válidos o el CIF ya pertenece a otro ayuntamiento.

### 3.2 Consultar listado

El sistema devuelve el listado de ayuntamientos existentes, incluidos los activos y los inactivos. Para el MVP no se requieren filtros, búsquedas ni paginación avanzada.

El listado se devuelve ordenado de forma estable por `id ASC`. Si no existen ayuntamientos, se devuelve una lista vacía.

### 3.3 Consultar detalle

El sistema devuelve el ayuntamiento identificado por su `id`. Si el identificador no tiene un formato válido, la petición se rechaza. Si es válido pero no existe, se informa de que el recurso no se ha encontrado.

### 3.4 Modificar Ayuntamiento

El usuario sustituye los datos editables de un ayuntamiento existente. Para el MVP, `PUT` requiere todos los campos obligatorios, igual que la creación, aunque algunos no hayan cambiado.

El `id` de la ruta identifica el registro y no puede modificarse. El CIF sí puede cambiar, siempre que no esté asignado a otro ayuntamiento. Se aplican las mismas validaciones de datos que en la creación.

Si el ayuntamiento no existe, no se crea uno nuevo: se informa de que no se ha encontrado.

### 3.5 Activar o desactivar

El cambio se realiza mediante la modificación del campo `estado` con `PUT /ayuntamientos/:id`. No se define un endpoint específico ni una operación `DELETE` para el MVP.

Cambiar el estado no elimina el registro ni su información relacionada. `INACTIVO` indica que el ayuntamiento no está disponible para nuevas operaciones, sin alterar su histórico.

## 4. API REST prevista

| Método y ruta | Finalidad | Respuesta correcta |
|---|---|---|
| `POST /ayuntamientos` | Crear un ayuntamiento. | `201 Created` con el registro creado. |
| `GET /ayuntamientos` | Obtener el listado. | `200 OK` con un array. |
| `GET /ayuntamientos/:id` | Consultar un ayuntamiento. | `200 OK` con el registro. |
| `PUT /ayuntamientos/:id` | Modificar todos sus datos editables, incluido `estado`. | `200 OK` con el registro actualizado. |

No se proponen más endpoints para este hito.

### Códigos HTTP previstos

- `200 OK`: listado, detalle o modificación completados correctamente.
- `201 Created`: ayuntamiento creado correctamente.
- `400 Bad Request`: petición mal formada, `id` con formato inválido, campo obligatorio ausente o vacío, tipo incorrecto, o valor no admitido.
- `404 Not Found`: el `id` tiene formato válido, pero no corresponde a ningún ayuntamiento.
- `409 Conflict`: el CIF ya está utilizado por otro ayuntamiento, tanto al crear como al modificar.

Los errores deben incluir un mensaje breve y comprensible. El formato global definitivo de errores se decidirá cuando se diseñe la API común.

## 5. Validaciones

### 5.1 Protegidas por PostgreSQL

- La clave primaria genera y protege `id`.
- `UNIQUE (cif)` impide CIF duplicados.
- `NOT NULL` exige `cif`, `denominacion`, `direccion`, `codigo_postal`, `localidad`, `provincia`, `estado` y `tipo_lista_medicamentos`.
- Los `CHECK` limitan `estado` a `ACTIVO` o `INACTIVO` y `tipo_lista_medicamentos` a `GENERAL` o `ESPECIFICA`.

PostgreSQL es la última garantía de integridad, también ante escrituras que no pasen por la API.

### 5.2 Validadas por la aplicación

- El cuerpo de la petición debe tener el formato esperado y los campos deben ser del tipo adecuado.
- En creación y modificación deben estar presentes todos los campos obligatorios.
- Tras ignorar espacios al principio y al final para validar, las cadenas obligatorias no pueden quedar vacías.
- El CIF se normaliza con `trim` y mayúsculas antes de guardarlo, tanto en POST como en PUT. Si el CIF normalizado ya pertenece a otro ayuntamiento, se devuelve `409`, aunque las entradas solo difieran en mayúsculas o espacios exteriores.
- `estado` y `tipo_lista_medicamentos` deben pertenecer a sus respectivos conjuntos de valores admitidos.
- El parámetro `id` debe representar un entero positivo.
- Antes de guardar debe detectarse el conflicto de CIF para devolver un `409 Conflict` comprensible.
- Los campos opcionales pueden omitirse o enviarse como `null`; no deben convertirse en obligatorios.

Las reglas de obligatoriedad, unicidad y valores permitidos se comprueban en ambas capas de forma intencionada: la aplicación ofrece una respuesta útil al cliente y PostgreSQL conserva la integridad aunque la validación de aplicación falle o sea evitada.

No se establece todavía una validación formal del formato de CIF, código postal o teléfonos porque los documentos actuales no la definen.

## 6. Pruebas previstas

La implementación posterior necesitará pruebas de API con Supertest y Vitest. Estas pruebas atravesarán la ruta HTTP y la persistencia, por lo que serán pruebas de API/integración:

- creación correcta y respuesta `201`;
- rechazo por ausencia de cada campo obligatorio;
- rechazo de cadenas obligatorias vacías o formadas solo por espacios;
- rechazo de CIF duplicado con `409`;
- rechazo de `estado` inválido;
- rechazo de `tipo_lista_medicamentos` inválido;
- listado con registros y listado vacío;
- consulta de un `id` existente;
- consulta de un `id` inexistente con `404`;
- rechazo de un `id` con formato inválido con `400`;
- modificación correcta, incluido el cambio de estado;
- modificación de un ayuntamiento inexistente con `404`;
- modificación intentando utilizar el CIF de otro ayuntamiento con `409`;
- modificación conservando el mismo CIF del propio ayuntamiento;
- comprobación de que no existe borrado físico en esta API.

Si la validación se implementa como un módulo aislado con comportamiento relevante, sus combinaciones de entradas válidas e inválidas podrán cubrirse además con pruebas unitarias. La unicidad del CIF y la persistencia deben comprobarse mediante integración con PostgreSQL.

## 7. Decisiones funcionales asumidas

- `PUT` representa una actualización completa de los campos editables y exige los mismos campos obligatorios que la creación.
- El listado incluye registros activos e inactivos y devuelve un array vacío cuando no hay resultados.
- Los campos opcionales pueden omitirse o representarse mediante `null`.
- Un `id` sintácticamente inválido produce `400`; un `id` válido pero inexistente produce `404`.

## 8. Cuestiones abiertas y mejoras futuras

No bloquean el MVP, pero deberán concretarse si surge una necesidad real:

- validación formal del formato y del dígito de control del CIF; la normalización con `trim` y mayúsculas ya está confirmada;
- formatos admitidos para código postal, teléfono y móvil;
- formato común de las respuestas de error;
- filtros por estado, denominación o CIF;
- paginación avanzada y búsquedas más sofisticadas.

## 9. Fuera de alcance

Quedan fuera de este hito:

- farmacias;
- medicamentos autorizados por ayuntamiento;
- facturación;
- precintos;
- pagos;
- autenticación;
- frontend;
- paginación avanzada;
- filtros avanzados;
- borrado físico.
