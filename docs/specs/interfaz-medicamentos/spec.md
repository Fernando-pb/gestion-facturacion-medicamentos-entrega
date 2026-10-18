# Especificación funcional: interfaz de Medicamentos

## 1. Objetivo y alcance del catálogo confirmado

Documentar una pantalla web para el catálogo actual de medicamentos, siguiendo la interfaz sencilla ya usada por Ayuntamientos y Farmacias. Las operaciones confirmadas por el usuario son crear, listar, consultar y editar medicamentos, incluidos `estado` (`ACTIVO`/`INACTIVO`) y `situacion_comercial` (`ALTA`/`BAJA`). No se ofrece borrado físico, incluso sin referencias; se conservan registros e información histórica existente sin introducir versiones de cada edición (guía canónica v7, A.7.1).

La pantalla está disponible en `/medicamentos.html` y enlazada desde inicio. El listado muestra código nacional, descripción, precio vigente, autorización general, situación comercial y tipo de facturación, además de la acción para abrir el formulario. No muestra una columna «Grupo ATC» ni «Grupo terapéutico». El formulario permite editar los campos del modelo y presenta `estado` y `situacion_comercial` en controles separados, `tipo_facturacion` como `TD` de solo lectura y `anexo` como dato opcional editable e informativo. El listado conserva la cadena recibida; el formulario monetario admite coma/punto, presenta coma y dos decimales y separa el símbolo € del valor editable. No se ofrece filtro por `anexo`.

La página sigue el patrón existente: enlace de retorno, estados accesibles de carga/error/vacío/guardado, tabla desplazable en pantallas estrechas y datos recibidos insertados como texto. El usuario aprobó estos endpoints para el catálogo:

| Método y ruta | Operación |
|---|---|
| `POST /medicamentos` | Crear; responde `201` con el medicamento JSON creado, incluido `id`. |
| `GET /medicamentos` | Listar; responde `200` con un array JSON, `[]` si está vacío, ordenado por `id ASC`. |
| `GET /medicamentos/:id` | Consultar; responde `200` con el medicamento, `400` si el ID es inválido y `404` si es válido pero no existe. |
| `PUT /medicamentos/:id` | Reemplazar el registro completo, incluidos ambos estados; responde `200` con el medicamento actualizado, conserva `id` y puede cambiar `codigo_nacional`; responde `400` para ID inválido y `404` para ID válido sin medicamento correspondiente. |

No existen `PATCH` ni `DELETE`. Los datos inválidos responden `400`; `codigo_nacional` duplicado responde `409` al crear o actualizar. Los errores funcionales usan JSON con la propiedad `error`, sin textos literales fijados. La gestión de autorizaciones específicas queda fuera de este catálogo y está implementada en la ficha municipal, según `../interfaz-gestion-ayuntamiento/spec.md`.

En POST son obligatorios `codigo_nacional`, `descripcion`, `precio`, `estado`, `situacion_comercial` y `tipo_facturacion`; en el MVP el cliente envía `tipo_facturacion: "TD"` y la API valida ese único valor. Los opcionales `grupo_terapeutico`, `codigo_laboratorio`, `gtatc`, `nombre_grupo` y `anexo` pueden omitirse o enviarse como `null`, y se envían como texto cuando tienen valor. En PUT se envían los once campos editables, incluidos los cinco opcionales; cada opcional se representa como texto o `null`, y si falta cualquier campo editable el cuerpo es inválido (`400`). El cliente también incluye `tipo_facturacion: "TD"` en PUT y la API lo valida. `id` no se envía: se toma de la ruta en PUT y lo genera/devuelve el sistema. Se rechazan propiedades desconocidas.

En todos los campos de texto se recortan los espacios iniciales y finales. Los campos obligatorios que queden vacíos tras el recorte se rechazan; en opcionales, una cadena vacía o de solo espacios se convierte en `null`. `codigo_nacional` se conserva como texto, con ceros iniciales y capitalización original; no se convierte a número ni se cambia su capitalización. `estado`, `situacion_comercial` y `tipo_facturacion` se validan contra sus valores exactos, sin conversión automática de capitalización. La decisión sobre `TD` no define cómo se facturarían vacunas, leche u otros tipos futuros.

`precio` se intercambia como cadena decimal en peticiones y respuestas JSON. Se aceptan importes entre `0` y `9999999999.99`, con cero, uno o dos dígitos decimales y punto como separador; se rechazan negativos, superiores al máximo o con más de dos decimales, sin redondeo silencioso. El almacenamiento sigue siendo `NUMERIC(12,2)`. El contrato JSON conserva el punto; el formulario aplica la [convención común de campos decimales](../../convencion-campos-decimales.md), sin redondeo.

## 2. Contenido y formulario propuestos

El listado implementado muestra código nacional, descripción, precio vigente, pertenencia/autorización general (`estado`), `situacion_comercial` y tipo de facturación; no incluye columnas «Grupo ATC» ni «Grupo terapéutico». El formulario contempla los campos del modelo y permite cambiar ambos estados de forma independiente. La columna comercial ya está aprobada e incorporada al esquema. `anexo` es un campo opcional, informativo y editable; no se ofrece filtro por `anexo` en la API ni en la interfaz de este MVP. La guía vigente v7, apéndice C.3, describe el uso actual de información y filtrado en el proceso existente. El posible filtrado se reconsiderará al especificar el flujo que lo necesite; los convenios y anexos estructurados quedan fuera del MVP.

Según la confirmación del autor, `situacion_comercial TEXT NOT NULL`, sin `DEFAULT` y con CHECK para `ALTA`/`BAJA`, se aplicó únicamente a `gestion_facturacion_medicamentos_test` con cero filas en `medicamento`. Desarrollo no se modificó y otras instalaciones no se consideran migradas; cualquier migración con datos sin clasificar sigue pendiente y no puede inferir ni asignar valores automáticamente.

`id` es interno y no editable. Los opcionales se presentan conforme a su obligatoriedad en el modelo lógico. `tipo_facturacion` es fijo en `TD` para el MVP y el cliente debe incluirlo en ambos cuerpos; la presentación inicial lo muestra como solo lectura. `anexo` se presenta como campo de texto opcional editable; su semántica y formato funcional exactos siguen pendientes según `docs/modelo-datos/modelo-logico-postgresql.md`, sección 8.

## 3. Reglas visibles

- El código nacional es obligatorio y único.
- El precio representa el valor actual y debe ser no negativo.
- El estado solo admite `ACTIVO` o `INACTIVO`.
- El tipo de facturación del MVP es `TD`.
- No hay acción de borrado físico, incluso para medicamentos sin referencias, por decisión del usuario. El esquema protege además las referencias desde autorizaciones y precintos con `ON DELETE RESTRICT`.
- La lista específica de un ayuntamiento es adicional a la lista general: al registrar una lectura facturable se exige pertenencia a ambas, además de `ALTA`; una lista específica vacía no equivale a usar la general. Esa comprobación no se repite al facturar lecturas ya aceptadas (`docs/guia-contexto-tfm.md`, v7, apéndices A.5 y A.7).
- La ausencia de un dato opcional no impide por sí sola facturar un medicamento autorizado (`docs/guia-contexto-tfm.md`, apéndice C.3).
- La autorización (`ACTIVO`/`INACTIVO`) y la situación comercial (`ALTA`/`BAJA`) son conceptos independientes. La decisión vigente requiere `ACTIVO` y `ALTA` al registrar una lectura facturable, más autorización específica cuando corresponda. Cambiar después a `INACTIVO` o `BAJA` no invalida precintos aceptados ni cambia su periodo mensual.
- «NO ESTÁ» describe una incidencia del precinto cuando el código no figura en la lista autorizada aplicable; nunca es una opción del estado de MEDICAMENTO. El mantenimiento del catálogo no reclasifica automáticamente lecturas anteriores.
- `estado` conserva los valores `ACTIVO`/`INACTIVO` y su uso para pertenencia a la lista general; `INACTIVO` impide nuevas aceptaciones, sin invalidar las anteriores (`docs/modelo-datos/modelo-datos.md`, sección Listas de medicamentos). `situacion_comercial` admite exclusivamente `ALTA`/`BAJA`, es obligatoria y carece de default según el modelo lógico, 4.3, y `db/schema.sql`. El contrato aprobado incluye ambos datos en el reemplazo completo PUT.
- No se presentan ni editan snapshots históricos `PRECINTO.precio_aplicado`.
- La pantalla del catálogo no gestiona autorizaciones específicas; esa gestión está en la ficha municipal. La regla de pertenencia general + específica al registrar sí está definida en A.5 de la guía.

La API sigue siendo autoridad para validar. La interfaz presenta los errores funcionales devueltos con la propiedad JSON `error`; los textos concretos no están fijados.

## 4. Estados y accesibilidad

Se propone comunicar carga, error, lista vacía y resultado de guardar; asociar etiquetas a controles, permitir uso con teclado, mantener foco visible y exponer mensajes a tecnologías de asistencia. Los datos recibidos se representarán como texto, no como HTML.

## 5. Criterios de aceptación propuestos

1. El usuario puede crear, listar, consultar y editar medicamentos y distinguir y cambiar autorización general (`estado`) y situación comercial, con sus valores admitidos.
2. La pantalla limita sus datos a los campos del modelo y permite distinguir obligatorios de opcionales; presenta el precio editable con coma y dos decimales y € separado; envía una cadena con punto.
3. El formulario comunica errores de validación y resultados de forma comprensible y accesible, y envía los campos conforme a las reglas de presencia de POST/PUT descritas arriba.
4. No presenta ni edita el precio histórico aplicado a precintos. No ofrece borrado físico ni administración de autorizaciones específicas.
5. Los valores recibidos de la API se muestran como texto seguro.

## 6. Fuera de alcance

Gestión estructurada de convenios y anexos, asignación/revocación de autorizaciones por ayuntamiento, operaciones de precintos, filtros de listado (incluido `anexo`), búsqueda general, paginación, importación y otras funciones no establecidas en las fuentes. El posible filtrado por `anexo` se reconsiderará al especificar el flujo que lo necesite.

## 7. Decisiones pendientes

- El formulario muestra el precio con coma y dos decimales, € separado del valor editable y normalización a cadena con punto para la API; `TD` como solo lectura y `anexo` como campo opcional editable; se podrá revisar al evaluar la interfaz. No hay filtro por `anexo` en la interfaz/API de este MVP; reconsiderarlo al especificar el flujo que lo necesite.
- La ruta inicial es `/medicamentos.html`, enlazada desde la pantalla de inicio.
- La gestión de autorizaciones específicas está resuelta en un flujo separado del catálogo: ficha municipal, pestaña Medicamentos (`../interfaz-gestion-ayuntamiento/`).
- Planificar cualquier migración con medicamentos sin situación comercial clasificada; la columna ya está aprobada e incluida en el esquema.
- El flujo consumidor BAJA sigue pendiente de implementación conforme a Entregas: elección explícita aceptar/apartar, sin marca histórica adicional en el MVP; evidencia adicional como mejora futura, sin bloquear implementación.

## 8. Fuentes

Consultar las fuentes enumeradas en [la especificación del módulo](../medicamentos/spec.md), en particular el modelo conceptual y el lógico. Las interfaces existentes de Ayuntamientos y Farmacias respaldan el patrón visual, no requisitos específicos de interacción para Medicamentos.

## 9. Navegación uniforme (7 de octubre de 2026)

Se aplica la [convención común de interfaz](../interfaz-ayuntamientos/spec.md#convenciones-comunes-de-interfaz-7-de-octubre-de-2026). El listado es inicial; crear y consultar/editar ocultan su listado y acciones. Guardar o «Cancelar y volver al listado» restaura la lista; tras guardar se habilita «Nuevo medicamento» antes de enfocarlo. La consulta usa Ver/Editar, sin otra pantalla. Errores de validación conservan datos y formulario. Se descartan cargas canceladas y se bloquean doble envío, cancelación y salida durante la escritura. No se añaden filtros de listado ni cambia ningún campo o estado.
