# Especificación funcional: gestión de Farmacias

## 1. Objetivo y alcance

Permite crear, listar, consultar y modificar los datos actuales de las farmacias, incluidas las que no tienen Ayuntamiento. El alta asigna Ayuntamiento y el PUT de este CRUD no cambia la asignación; su modificación controlada está implementada en la gestión municipal, según `../gestion-ayuntamiento/spec.md`.

No incluye borrado físico, cambio de ayuntamiento, estado de actividad, operaciones parciales ni reglas sobre ayuntamientos inactivos.

## 2. Datos

Los campos se derivan de `farmacia` en `db/schema.sql` y de FARMACIA en `docs/modelo-datos/modelo-datos.md`.

| Campo | Tipo PostgreSQL | Obligatorio | Uso |
|---|---|---:|---|
| `id` | `INTEGER` | Sí | Identificador generado por PostgreSQL; no editable. |
| `soe` | `TEXT` | Sí | Identificador estable y único del establecimiento. |
| `cif_nif` | `TEXT` | Sí | Identificador fiscal actual. |
| `denominacion` | `TEXT` | Sí | Denominación actual. |
| `direccion` | `TEXT` | Sí | Dirección postal. |
| `codigo_postal` | `TEXT` | Sí | Código postal. |
| `localidad` | `TEXT` | Sí | Localidad. |
| `provincia` | `TEXT` | Sí | Provincia. |
| `telefono` | `TEXT` | No | Teléfono de contacto. |
| `ayuntamiento_id` | `INTEGER` | No en BD; sí en POST | Referencia opcional en persistencia. El alta exige Ayuntamiento existente; no editable mediante PUT. |
| `pais_control_iban` | `TEXT` | No | Componente actual de país y control del IBAN. |
| `entidad_bancaria` | `TEXT` | No | Código actual de entidad bancaria. |
| `sucursal_bancaria` | `TEXT` | No | Código actual de sucursal bancaria. |
| `digito_control_bancario` | `TEXT` | No | Dígitos actuales de control bancario. |
| `cuenta_bancaria` | `TEXT` | No | Número actual de cuenta. |

Las cadenas obligatorias deben contener algún carácter distinto de espacios. Los campos opcionales admiten omisión o `null`. No se añaden reglas de formato que no estén definidas en el modelo.

## 3. Operaciones

- **Crear:** requiere los ocho datos no nulos del esquema, incluido un `ayuntamiento_id` entero positivo existente. `soe` duplicado produce conflicto.
- **Listar:** incluye todas las farmacias, ordenadas por `id ASC`, también las no asignadas. En ellas, `ayuntamiento_id`, `ayuntamiento_denominacion` y `ayuntamiento_cif` son `null`.
- **Consultar:** devuelve una farmacia con los mismos datos del ayuntamiento; ID válido inexistente produce 404.
- **Modificar:** `PUT` sustituye los campos editables y exige los obligatorios. No acepta `ayuntamiento_id` en el cuerpo y la consulta SQL no lo modifica.

No se filtra ni excluye un ayuntamiento por su estado. FARMACIA no tiene un campo de estado general; la ausencia de precintos en un periodo no significa que esté inactiva. La participación mensual se determinará en el alcance del módulo de entregas, no mediante un estado añadido a FARMACIA.

## 4. API

| Método y ruta | Resultado |
|---|---|
| `POST /farmacias` | `201` y farmacia creada con ayuntamiento asociado. |
| `GET /farmacias` | `200` y array ordenado. |
| `GET /farmacias/:id` | `200` con detalle o `404`. |
| `PUT /farmacias/:id` | `200` con los datos actualizados o `404`. |

`400` indica cuerpo, ID o referencia de ayuntamiento inválidos/inexistentes; `409` indica `soe` duplicado. Los errores tienen un mensaje breve. No hay `PATCH` ni `DELETE`.

Las respuestas incluyen `ayuntamiento_id`, `ayuntamiento_denominacion` y `ayuntamiento_cif`, obtenidos mediante `LEFT JOIN` con AYUNTAMIENTO. Los tres son `null` cuando no hay asignación; el maestro sigue disponible para lectura y edición de sus datos. El POST sigue requiriendo Ayuntamiento; el PUT sigue rechazando esa propiedad, incluido `null`.

## 5. Integridad y validación

### 5.1 Garantías de PostgreSQL

- `id` es la clave primaria autogenerada.
- Los campos obligatorios de la tabla son `NOT NULL`.
- `UNIQUE (soe)` impide identificadores SOE duplicados.
- `ayuntamiento_id` es una FK opcional a `ayuntamiento.id`; PostgreSQL acepta `NULL`, protege la existencia de los valores no nulos y restringe el borrado del ayuntamiento relacionado. El alta API conserva la referencia obligatoria según el contrato aprobado. Para bases existentes, aplicar `db/updates/001-farmacia-ayuntamiento-opcional.sql` según `db/README.md`.
- No existen `CHECK` de formato para SOE, CIF/NIF, direcciones o teléfonos.

### 5.2 Validaciones de la aplicación

- Las cadenas obligatorias deben ser texto no vacío tras `trim`; los campos opcionales admiten texto, `null` u omisión.
- `ayuntamiento_id` en POST debe ser un entero positivo compatible con PostgreSQL `INTEGER`; la FK es la garantía final de existencia.
- POST y PUT rechazan propiedades desconocidas. PUT no acepta `ayuntamiento_id`.
- Las consultas usan parámetros. `23505` de `uq_farmacia_soe` se traduce a `409`; una FK de ayuntamiento inexistente se traduce a `400`.
- No se define validación formal de formato para SOE o CIF/NIF.

## 6. Datos actuales, cambios e histórico

- El SOE identifica de forma estable al establecimiento y debe conservarse al cambiar CIF/NIF, denominación u otros datos actuales.
- El CRUD permite actualizar CIF/NIF, denominación, datos de contacto y datos bancarios actuales mediante el PUT completo, manteniendo el mismo SOE y ayuntamiento.
- No se define un historial general de cambios de esos atributos. Los cambios de datos actuales no reescriben los snapshots ya guardados en `detalle_pago_farmacia`.
- Los campos bancarios forman parte del mantenimiento actual de Farmacia y pueden estar incompletos durante ese mantenimiento. Antes de preparar un pago deben estar completos y ser válidos; el proceso de pago y la validación concreta quedan para su módulo.

El modelo de datos no define un proceso separado de cambio legal de titular, ni establece si ese evento debe conservar el SOE actual o requiere otra gestión histórica. La operación actual solo permite corregir o sustituir datos actuales bajo el mismo SOE. Si se necesita registrar formalmente cambios de titular, la regla debe decidirse antes de ampliar este CRUD.

## 7. Pruebas

Las pruebas del módulo cubren validación, CRUD HTTP, unicidad, FK, asociación devuelta e inmutabilidad de la relación en actualización. Toda prueba con escrituras exige `DB_NAME=gestion_facturacion_medicamentos_test` en el proceso y comprueba `SELECT current_database()` antes de escribir. Cada prueba limpia solo los IDs que ella creó, mediante SQL parametrizado.

La presentación de la asociación y los comportamientos de pantalla se especifican en [la interfaz de Farmacias](../interfaz-farmacias/spec.md).

## 8. Decisiones abiertas y dependencias

- **Cambio legal de titular:** no está definido si constituye solo una actualización de atributos actuales o requiere tratamiento e historial separados. No bloquea corregir los datos actuales; sí bloquea añadir un flujo específico de cambio de titular.
- **Validación bancaria para pagos:** el esquema permite datos bancarios incompletos en FARMACIA, mientras `detalle_pago_farmacia` los requiere completos. El módulo de pagos deberá concretar formatos y validaciones antes de generar el snapshot; esto no bloquea el CRUD actual.

## 9. Fuera de alcance

Medicamentos, entregas, precintos, facturación, cobros y pagos, autenticación, baja lógica, borrado físico, filtros avanzados, paginación, `PATCH`, reasignación de ayuntamiento e historial general de los datos actuales de FARMACIA.
