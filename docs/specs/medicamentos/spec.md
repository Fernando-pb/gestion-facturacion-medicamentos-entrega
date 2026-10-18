# Especificación funcional: Medicamentos

## 1. Objetivo y alcance

Definir el mantenimiento del catálogo actual de medicamentos utilizado por el sistema. El catálogo identifica cada medicamento por su código nacional y conserva sus datos actuales de descripción, precio, estado y clasificación.

El alcance confirmado por el usuario comprende crear, listar, consultar y editar medicamentos, incluidos `estado` (`ACTIVO`/`INACTIVO`) y `situacion_comercial` (`ALTA`/`BAJA`). No se ofrece borrado físico, tengan o no referencias: se conservan los registros y la información histórica existente, sin introducir un historial de versiones de cada edición. Fuente: decisión del autor, recogida en la guía canónica vigente v7, A.7.1.

Autorización y situación comercial son independientes, pero ambas se comprueban al registrar cada precinto: se requiere `ACTIVO` y `ALTA`, además de autorización específica cuando corresponda. La baja comercial no elimina la autorización; impide aceptar nuevas lecturas facturables mientras exista. Los cambios posteriores no invalidan precintos ya aceptados.

La columna `situacion_comercial TEXT NOT NULL`, sin `DEFAULT` y con CHECK para `ALTA`/`BAJA`, está aprobada e incorporada a `db/schema.sql` y al modelo lógico, 4.3. Según la confirmación del autor, se aplicó únicamente a `gestion_facturacion_medicamentos_test`, cuya tabla `medicamento` tenía cero filas. Desarrollo no se modificó; otras instalaciones no se consideran migradas. Sigue pendiente cualquier migración con medicamentos sin situación comercial clasificada, sin inferir ni asignar automáticamente valores.

La relación `AYUNTAMIENTO_MEDICAMENTO` representa exclusivamente la autorización específica de un medicamento para un ayuntamiento. Su gestión queda fuera de este catálogo y se definirá aparte; siguen pendientes la ubicación y el flujo para asignar o retirar autorizaciones. La comprobación de esas autorizaciones al registrar precintos se mantiene.

## 2. Campos derivados del modelo

| Campo | Obligatorio | Regla respaldada por las fuentes |
|---|---:|---|
| `id` | Sí, generado | Identificador interno estable. |
| `codigo_nacional` | Sí | Código nacional identificativo y único. |
| `descripcion` | Sí | Descripción del medicamento. |
| `precio` | Sí | Precio actual, no negativo. |
| `estado` | Sí | `ACTIVO` o `INACTIVO`. |
| `situacion_comercial` | Sí | `TEXT NOT NULL`, sin `DEFAULT`; `CHECK (situacion_comercial IN ('ALTA', 'BAJA'))`. |
| `tipo_facturacion` | Sí | En el MVP, solo `TD`; la API lo exige y valida. No se definen valores ni reglas para posibles tipos futuros. |
| `grupo_terapeutico` | No | Grupo terapéutico. |
| `codigo_laboratorio` | No | Código del laboratorio. |
| `gtatc` | No | Clasificación GTATC. |
| `nombre_grupo` | No | Nombre del grupo asociado. |
| `anexo` | No | Dato de texto opcional, informativo y editable. No representa una entidad estructurada de convenios/anexos. |

La obligatoriedad y los tipos anteriores siguen el modelo lógico PostgreSQL y `db/schema.sql`. No se añaden campos de auditoría ni histórico de precios.

La guía vigente, apéndice C.3, describe el uso actual de `anexo` para información y filtrado en el proceso existente. Ese uso actual no implica un filtro en la nueva API o interfaz de Medicamentos: en este MVP `anexo` es opcional, informativo y editable, sin filtro; el posible filtrado se reconsiderará al especificar el flujo que lo necesite.

## 3. Reglas de negocio

1. `codigo_nacional` es obligatorio y único.
2. `precio` es el precio vigente y no puede ser negativo.
3. En el MVP, el cliente envía `tipo_facturacion: "TD"` en POST y PUT, y la API valida que sea el único valor permitido. No se definen valores ni reglas para vacunas, leche u otros tipos futuros. (Fuente: decisión del usuario; modelo conceptual, sección MEDICAMENTO; modelo lógico, §4.3; `db/schema.sql`, `ck_medicamento_tipo_facturacion`).
4. El precio aplicado históricamente a un precinto se conserva en `PRECINTO.precio_aplicado`; cambiar el precio actual no modifica precintos previos.
5. No existe histórico independiente de precios en el MVP.
6. La lista general consiste en los medicamentos `ACTIVO`.
7. El modelo conceptual representa la lista general mediante medicamentos con `estado = ACTIVO`. Para un ayuntamiento con lista `GENERAL`, esa pertenencia basta para la autorización; la elegibilidad exige además `ALTA` al registrar. Para uno con lista `ESPECIFICA`, el medicamento debe pertenecer también a la lista general y estar relacionado con el ayuntamiento mediante `AYUNTAMIENTO_MEDICAMENTO`. (Fuentes: `docs/modelo-datos/modelo-datos.md`, secciones MEDICAMENTO y Listas de medicamentos; `docs/guia-contexto-tfm.md`, apéndice A.5; `db/schema.sql`, `ayuntamiento_medicamento`).
   Una lista específica vacía no se interpreta automáticamente como lista general (`docs/guia-contexto-tfm.md`, apéndice A.5).
8. La elegibilidad se decide al registrar el precinto: debe corresponder a un medicamento `ACTIVO` y de `ALTA`. Si el ayuntamiento usa lista específica, también se comprueba su autorización en `AYUNTAMIENTO_MEDICAMENTO` en ese momento. Un medicamento `INACTIVO` o de `BAJA` no permite aceptar esa lectura como facturable. `ALTA`/`BAJA` se almacenan en la columna aprobada `situacion_comercial`.
9. La autorización específica no duplica campos del medicamento y la combinación ayuntamiento/medicamento es única.

Estas reglas describen la comprobación durante el registro. No especifican la pantalla o contrato para mantener `AYUNTAMIENTO_MEDICAMENTO`.

### Elegibilidad conservada y periodo mensual

- Un precinto aceptado con medicamento `ACTIVO` y de `ALTA` conserva su facturabilidad aunque después el medicamento pase a `INACTIVO` o `BAJA`. Facturar no implica volver a evaluar esos estados actuales ni la lista específica actual para invalidar la aceptación previa.
- Se factura dentro del periodo mensual de la entrega a la que pertenece el precinto; no se pospone a un mes posterior por un cambio de estado del medicamento.
- «NO ESTÁ» describe una incidencia de la lectura cuando el código no figura en la lista autorizada aplicable. No es un estado de MEDICAMENTO ni un nuevo valor SQL de `INCIDENCIA.motivo`.
- El modelo distingue `MEDICAMENTO_DESCONOCIDO` y `MEDICAMENTO_NO_AUTORIZADO`; la correspondencia de los mensajes visibles con esos motivos debe respetar la diferencia entre código desconocido y medicamento conocido sin autorización aplicable. La clasificación de una lectura rechazada por `BAJA` sigue pendiente; no se añade un motivo nuevo.

### Información que debe conservarse

El resultado de aceptación debe persistir por lectura. El modelo existente puede representarlo mediante un registro en `PRECINTO`, que siempre es válido, frente a `INCIDENCIA`, que no es facturable. Conservar `id`, `medicamento_id`, `codigo_nacional`, `codigo_barras_original`, `precio_aplicado` y `entrega_id` mantiene identidad, medicamento, lectura original, importe histórico y vínculo con farmacia/periodo. El periodo se obtiene por `ENTREGA_FARMACIA_PERIODO.periodo_id`; no se inventa otro periodo ni un indicador de facturabilidad duplicado.

Estos datos conservan el resultado, pero no reproducen por sí solos el instante de evaluación, los estados `ACTIVO`/`ALTA`, el ayuntamiento/modalidad aplicables y la pertenencia específica observados al aceptar. Si se necesita demostrar esas condiciones históricas, deberá definirse qué evidencia conservar y su representación; el modelo actual no contiene esa fotografía. Esa decisión de trazabilidad sigue pendiente, sin añadir campos.

### Contraste con fuentes vigentes

La guía canónica vigente v7, A.4, respalda imputar las lecturas al periodo en que se presentan/procesan; A.5 y A.7 definen autorización general/específica, situación comercial y evaluación al registro. A.7.1 confirma el alcance del catálogo. El modelo conceptual, MEDICAMENTO, PRECINTO, INCIDENCIA y Listas de medicamentos, y el lógico, 4.3, 4.7 y 4.8, reflejan esas reglas y conservan el resultado de aceptación y `precio_aplicado`.

Corrección del 5 de octubre de 2026: la decisión del autor sustituye la regla anterior de la guía v4, A.7, y de los modelos sobre baja comercial. `BAJA` impide nuevas aceptaciones, sin invalidar las anteriores. La guía canónica vigente v7 y los modelos quedan alineados; `db/schema.sql` incorpora la columna comercial aprobada, pero sus restricciones no garantizan por sí solas la elegibilidad entre tablas al registrar. El contrato API aprobado se documenta en la sección 4.
La guía indica que la ausencia de campos opcionales no impide por sí sola que un medicamento autorizado sea facturable (`docs/guia-contexto-tfm.md`, apéndice C.3).

## 4. Interfaz y operaciones

La interfaz implementada está disponible en `/medicamentos.html`, enlazada desde inicio, y contempla crear, listar, consultar y editar siguiendo el patrón de Ayuntamientos y Farmacias. Muestra y permite cambiar ambos estados de forma independiente. El precio se presenta como cadena decimal sin localización visual; `TD` aparece como solo lectura y `anexo` como campo opcional editable, sin filtro. No se ofrece borrado físico ni gestión de autorizaciones específicas. La edición del precio afecta al valor vigente; la interfaz no presenta ni modifica precios históricos de precintos.

### Contrato API aprobado

| Método y ruta | Operación |
|---|---|
| `POST /medicamentos` | Crear un medicamento; responde `201` con el medicamento creado como JSON, incluido `id`. |
| `GET /medicamentos` | Listar medicamentos; responde `200` con un array JSON, `[]` si no hay resultados, ordenado por `id ASC`. |
| `GET /medicamentos/:id` | Consultar un medicamento; responde `200` con el medicamento, `400` si el ID es inválido y `404` si es válido pero no existe. |
| `PUT /medicamentos/:id` | Reemplazar el registro completo, incluidos `estado` y `situacion_comercial`; responde `200` con el medicamento actualizado y conserva el `id`. Si el ID es inválido responde `400`; si es válido pero no existe responde `404`. Puede cambiar `codigo_nacional`. |

No hay operaciones `PATCH` ni `DELETE`. La aprobación del usuario determina estos métodos y rutas; las especificaciones de Ayuntamientos y Farmacias sirven de referencia de estilo, no como origen de este contrato. `GET /medicamentos` no incorpora filtro por `anexo` en el MVP.

Los datos inválidos responden `400`. Un `codigo_nacional` duplicado responde `409` tanto al crear como al actualizar. Los errores funcionales se devuelven como JSON con la propiedad `error`; no se fijan textos literales.

#### Cuerpos de creación y sustitución

`id` no se envía en el cuerpo: el sistema lo genera y lo devuelve en las respuestas; en `PUT` se toma de la ruta. Ambos cuerpos rechazan propiedades desconocidas.

`POST /medicamentos` exige los campos obligatorios del modelo: `codigo_nacional`, `descripcion`, `precio`, `estado`, `situacion_comercial` y `tipo_facturacion`. En el MVP el cliente envía `tipo_facturacion: "TD"` y la API valida ese único valor admitido. Los cinco campos opcionales —`grupo_terapeutico`, `codigo_laboratorio`, `gtatc`, `nombre_grupo` y `anexo`— pueden omitirse o enviarse como `null`; cuando se envían con valor, su tipo es texto conforme al modelo.

`PUT /medicamentos/:id` sustituye el registro completo y exige todos los campos editables: los seis obligatorios anteriores y los cinco opcionales. Cada campo opcional debe enviarse como texto o `null`; omitir cualquier campo editable hace inválido el cuerpo y responde `400`. El cliente envía `tipo_facturacion: "TD"` y la API lo valida también en PUT. Las restricciones de tipo, obligatoriedad y valores del modelo aplican también a los campos obligatorios.

En todos los campos de texto se recortan los espacios al principio y al final. Tras el recorte, un campo obligatorio vacío se rechaza; un campo opcional vacío o compuesto solo por espacios se convierte en `null`. `codigo_nacional` permanece como texto, incluidos sus ceros iniciales: no se convierte a número ni se cambia su capitalización. `estado`, `situacion_comercial` y `tipo_facturacion` se validan contra sus valores permitidos exactos después del recorte, sin normalizar mayúsculas/minúsculas.

El precio se representa como cadena decimal en las peticiones y respuestas JSON. La API acepta importes desde `0` hasta `9999999999.99`, con cero, uno o dos dígitos decimales y punto como separador. Rechaza valores negativos, superiores al máximo o con más de dos decimales; no redondea silenciosamente. PostgreSQL lo almacena en `NUMERIC(12,2)`.

Estas reglas fijan la representación y precisión decimal de la API. La interfaz muestra directamente esa cadena decimal.

## 5. Criterios de aceptación

1. Se acepta como facturable una lectura con medicamento `ACTIVO` y de `ALTA`, con autorización específica si procede; se rechaza si está `INACTIVO` o de `BAJA` al registrarla.
2. Los datos mantenidos se limitan a los campos de `MEDICAMENTO` enumerados en esta especificación.
3. Se rechazan código nacional ausente o duplicado, precio fuera del rango/formato decimal aprobado, estados fuera de sus conjuntos admitidos, situación comercial ausente y tipo de facturación distinto de `TD` en el MVP.
4. En POST los opcionales pueden omitirse o enviarse como `null`; en PUT todos los campos editables deben estar presentes, y los opcionales aceptan texto o `null`. Se rechazan propiedades desconocidas. El texto se normaliza conforme a la regla de recorte y vacíos descrita en el contrato API; los valores de enumeración conservan capitalización exacta.
5. Modificar el precio vigente no altera `PRECINTO.precio_aplicado` ya almacenado.
6. El catálogo no ofrece borrado físico de ningún medicamento, incluso sin referencias, por decisión del usuario. Las FKs `fk_ayuntamiento_medicamento_medicamento` y `fk_precinto_medicamento` de `db/schema.sql` protegen además los referenciados mediante `ON DELETE RESTRICT`; no prohíben por sí solas todos los borrados SQL directos.
7. Una lectura aceptada mantiene su facturabilidad en su periodo aunque el medicamento cambie después a `INACTIVO` o `BAJA`; no se traslada al siguiente mes ni se reevalúa contra el catálogo actual.
8. «NO ESTÁ» aparece como información de incidencia del precinto, nunca como estado del medicamento.

Crear, listar, consultar y editar, incluidos ambos estados y ausencia de borrado físico, son alcance confirmado por el usuario. La API y la interfaz del catálogo están implementadas y cubiertas por pruebas automatizadas; las comprobaciones de registro y facturación pertenecen a los módulos consumidores.

## 6. Fuera de alcance

- Histórico independiente de precios.
- Modificación de precintos o de sus precios históricos desde el catálogo.
- Definición de otros tipos de facturación en el MVP.
- Gestión de entregas, precintos, incidencias o facturación.
- Borrado físico de medicamentos, incluidos los que no tienen referencias.
- Gestión de autorizaciones específicas por ayuntamiento: se definirá aparte; ubicación y operaciones pendientes.
- Filtros en la API o interfaz del catálogo, incluido el posible filtro por `anexo`; este se reconsiderará al especificar el flujo que lo necesite.

## 7. Decisiones pendientes para revisión

- La presentación inicial muestra el precio como cadena decimal, `tipo_facturacion` como `TD` de solo lectura y `anexo` como campo opcional informativo y editable. No hay filtro por `anexo` en el MVP; un flujo futuro que lo necesite deberá especificarlo aparte.
- Para BAJA elegible, mantener elección explícita aceptar/apartar sin marca histórica adicional en el MVP. Esa evidencia es mejora futura y no bloquea implementación; el flujo corresponde a Entregas según su especificación vigente.
- Ubicar y definir aparte la gestión de `AYUNTAMIENTO_MEDICAMENTO`, excluida del catálogo.
- La revisión manual de navegación, mensajes accesibles, teclado, foco y adaptación a viewport estrecho está completada según `../interfaz-medicamentos/tasks.md`, tarea 5. Los campos `estado` y `situacion_comercial`, así como su edición, están implementados.
- Planificar cualquier migración de bases existentes con medicamentos sin situación comercial clasificada. La aprobación de la columna no autoriza inferir ni asignar valores automáticamente.

## 8. Fuentes

- `AGENTS.md`, secciones 5–8: especificación previa, derivación estricta del modelo y restricciones de API/esquema.
- `README.md`: medicamentos autorizados y validación de precintos por código nacional como alcance principal del producto.
- `MEMORY.md`: la API y la interfaz de Medicamentos están implementadas; la revisión manual está registrada en las tareas de interfaz.
- `docs/modelo-datos/modelo-datos.md`, secciones MEDICAMENTO, AYUNTAMIENTO_MEDICAMENTO, listas de medicamentos y reglas de integridad.
- `docs/modelo-datos/modelo-logico-postgresql.md`, secciones 4.3, 4.4 y decisiones pendientes.
- `docs/modelo-datos/modelo-logico-postgresql.md`, sección 8: contenido/formato funcional de `medicamento.anexo` pendiente.
- `docs/guia-contexto-tfm.md`, versión canónica vigente v7 (5 de octubre de 2026), apéndices A.4, A.5, A.7, A.7.1 y C.3: periodo, listas aplicables, campo comercial aprobado, alcance confirmado, conservación de aceptación y uso informativo/de filtrado de `anexo`.
- Decisión vigente del usuario: elegibilidad al registrar (`ACTIVO` y `ALTA`, más lista específica cuando proceda), conservación de lecturas aceptadas ante cambios posteriores, facturación en su periodo mensual y «NO ESTÁ» como incidencia del precinto.
- `db/schema.sql`, definiciones de `medicamento` y `ayuntamiento_medicamento`.
- `docs/specs/ayuntamientos/` y `docs/specs/farmacias/`: estilo y nivel de detalle de las especificaciones funcionales existentes.
- `docs/specs/interfaz-ayuntamientos/` y `docs/specs/interfaz-farmacias/`: patrón de interfaz existente.

Extensión del 6 de octubre de 2026: GET del catálogo admite búsqueda opcional por código nacional/descripción y modos exacto/prefijo/contiene; sin parámetros mantiene el listado CRUD anterior. Contrato, validación/proyección y operaciones de lista específica implementadas en `../gestion-ayuntamiento/spec.md §11`. La interfaz general no incorpora esos controles; la interfaz municipal de Medicamentos está implementada en la ficha del Ayuntamiento, según `../interfaz-gestion-ayuntamiento/spec.md`, con evidencia en sus tareas.
