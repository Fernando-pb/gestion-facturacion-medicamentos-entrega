# Especificación funcional: gestión de medicamentos y farmacias del Ayuntamiento

## 1. Objetivo y alcance

Especificar, desde la gestión de un Ayuntamiento, la consulta y mantenimiento de su autorización específica de medicamentos y la consulta de las farmacias que le pertenecen. Se usan registros maestros existentes. Esta especificación no amplía el catálogo CRUD de Medicamentos ni el CRUD de Farmacias.

La gestión de medicamentos específicos se apoya en `AYUNTAMIENTO_MEDICAMENTO`. La asignación de Farmacia se almacena en `FARMACIA.ayuntamiento_id`. Asignar, reasignar o quitar requiere ausencia de entregas y precintos. El modelo y `db/schema.sql` ya permiten NULL; las bases existentes requieren el script documentado en `db/README.md`, aplicado solo a la base de pruebas. El CRUD conserva maestros desasignados en lectura/edición; POST general sigue asignando Ayuntamiento y PUT no lo cambia. Las cuatro operaciones municipales de Farmacias (GET de lista y búsqueda, POST y DELETE) están implementadas y probadas; el apartado de interfaz de Farmacias también está implementado; la API de medicamentos admitidos está implementada; su interfaz está implementada.

## 2. Fuentes y alcance comprobado

- Guía canónica vigente, apéndices A.1, A.2, A.5, A.7.1 y A.9: asignación opcional antes de actividad, selección para precintos, autorización y conservación histórica. La versión v9 registra la compatibilidad implementada del CRUD/esquema.
- Modelo conceptual, secciones FARMACIA, MEDICAMENTO, AYUNTAMIENTO_MEDICAMENTO, ENTREGA_FARMACIA_PERIODO, PRECINTO, FACTURACION, DETALLE_PAGO_FARMACIA y «Listas de medicamentos»: atributos, semántica, relaciones e histórico. FARMACIA permite cero o un Ayuntamiento y cambios solo sin entregas/precintos, sin historial adicional.
- Modelo lógico PostgreSQL, §§4.2–4.4, 4.6–4.7, 4.12, 4.15 y reglas globales: tipos, nulabilidad, FK/UNIQUE y alcance de snapshots.
- `db/schema.sql`: tablas `ayuntamiento`, `farmacia`, `medicamento`, `ayuntamiento_medicamento`, `entrega_farmacia_periodo`, `precinto`, `facturacion`, `factura` y `detalle_pago_farmacia`; `farmacia.ayuntamiento_id` admite NULL con FK y `entrega_farmacia_periodo.farmacia_id` referencia `farmacia.id`. Para instalaciones previas, aplicar `db/updates/001-farmacia-ayuntamiento-opcional.sql`.
- Especificaciones existentes: `../ayuntamientos/spec.md`, `../farmacias/spec.md`, `../medicamentos/spec.md` y las tres especificaciones de interfaz correspondientes.
- Implementación revisada: repositorios y validaciones de Farmacias/Ayuntamientos, `src/app.js` y pruebas existentes. `src/ayuntamientos/ayuntamiento-farmacia.*.js` y sus rutas implementan las mutaciones municipales, verificadas en `test/ayuntamiento-farmacias.test.js`. Las consultas de Farmacias se verifican en `test/ayuntamiento-farmacias-consulta.test.js`. Los módulos de Entregas/precintos y facturación están implementados según sus especificaciones; las operaciones municipales de Farmacias y Medicamentos y sus interfaces también están implementadas.

La documentación del modelo tiene prioridad sobre el diagrama ER (`AGENTS.md`, §2). No se modifica el esquema; las operaciones API implementadas se documentan en §11.

## 3. Datos que se muestran

### 3.1 Medicamentos

Los campos maestros verificados son `medicamento.codigo_nacional`, `descripcion`, `estado` (`ACTIVO`/`INACTIVO`) y `situacion_comercial` (`ALTA`/`BAJA`), entre otros. `estado` representa pertenencia/autorización general; no equivale a situación comercial. La lista municipal específica representa solo la autorización específica y no duplica código, descripción o precio.

La lista asociada mostrará código nacional, descripción y situación comercial actual (`ALTA`/`BAJA`), junto con `estado` general (`ACTIVO`/`INACTIVO`) en columna separada. Son conceptos y campos distintos; ambos se muestran como datos actuales del medicamento, no como estados de la relación.

### 3.2 Farmacias

Los nombres reales comprobados son `farmacia.soe`, `denominacion`, `localidad`, `cuenta_bancaria` y `ayuntamiento_id`. No existe un campo separado llamado nombre; la denominación es el equivalente respaldado. `cuenta_bancaria` es texto opcional y actual. La pantalla muestra SOE, denominación, localidad y solo los últimos cuatro dígitos, por ejemplo `•••• 1234`. El contrato de esta vista entrega únicamente el valor enmascarado, nunca el número completo; cuando no haya cuenta, devuelve `null` y la UI indica que no consta.

## 4. Casos de uso: medicamentos admitidos

1. Desde el detalle/área de un Ayuntamiento se busca en el catálogo existente por código nacional o descripción.
2. La búsqueda permite los modos exacto, comienza por y contiene. La implementación usa los criterios documentados en §11: modo explícito, comparación sin distinguir mayúsculas/minúsculas, recorte de espacios exteriores y caracteres especiales literales; no altera el código nacional almacenado.
3. Los resultados consultan datos actuales del catálogo. Seleccionar un resultado permite consultar sus datos actuales antes de asociarlo.
4. El usuario puede asociar un medicamento ya registrado con el Ayuntamiento. La operación verifica antes la pareja. Si ya existe, informa claramente que ya está asociado y no crea duplicado.
5. La lista muestra los medicamentos relacionados y sus datos maestros actuales. Añadir/quitar relación no crea ni edita el maestro.
6. Quitar solicita confirmación identificando Ayuntamiento, código nacional y descripción, permite cancelar y, si se confirma, elimina únicamente la relación. No elimina el medicamento maestro.

En modalidad `GENERAL` se aplica únicamente la lista general de medicamentos autorizados (`estado = ACTIVO`), sin exigir asociación específica. Las asociaciones específicas que ya existan se conservan y se muestran en la ficha con el aviso «No se aplica mientras se utiliza la lista general». En modalidad `ESPECIFICA`, la asociación específica vuelve a aplicarse junto con la autorización general (`estado = ACTIVO`). La condición comercial `situacion_comercial = ALTA` para nuevas lecturas facturables sigue aplicándose según las reglas vigentes, separada de la modalidad de lista. Una lista específica vacía no equivale a `GENERAL`. La gestión muestra la modalidad y sus efectos, pero no la cambia desde el apartado de asociaciones.

Representación confirmada de listas: la lista general se deriva de `medicamento.estado = ACTIVO`; la modalidad seleccionada se conserva en `ayuntamiento.tipo_lista_medicamentos`; `AYUNTAMIENTO_MEDICAMENTO` conserva las asociaciones específicas. La ficha hace visible la modalidad y, en `GENERAL`, muestra las asociaciones específicas conservadas con el aviso acordado. Cambiar modalidad no elimina asociaciones automáticamente.

## 5. Casos de uso: farmacias asociadas

1. Desde la ficha del Ayuntamiento se muestra la asignación actual y se puede buscar en el catálogo de todas las farmacias existentes, incluidas las no asignadas y las asignadas a otro Ayuntamiento, para elegir una existente.
2. Se puede buscar por SOE o denominación con modos exacto, comienza por y contiene. Si la búsqueda es por SOE, el orden es SOE; si es por denominación, el orden es denominación.
3. La lista y los resultados de búsqueda muestran SOE, denominación, localidad, cuenta enmascarada y asignación municipal actual. Nunca reciben ni muestran la cuenta completa; se muestran solo sus últimos cuatro dígitos, por ejemplo `•••• 1234`.
4. Si ya pertenece al Ayuntamiento actual, se informa y no se crea una asociación duplicada. Si está asignada a otro Ayuntamiento, solo se permite reasignar cuando no existan entregas ni precintos; si existe cualquiera, se bloquea y se explica el motivo. Una entrega vacía también bloquea.
5. Antes de reasignar, se confirma indicando Ayuntamiento de origen y destino; cancelar conserva la asignación. Antes de quitar, se confirma qué asignación se eliminará definitivamente y se permite cancelar. Quitar elimina solo la asignación, conserva la farmacia y deja `ayuntamiento_id` sin valor.
6. Todas las relaciones operativas con Farmacia usan su identificador interno `farmacia.id`, no el SOE. `entrega_farmacia_periodo.farmacia_id` ya referencia ese ID. Corregir SOE no rompe la identidad interna ni habilita su edición desde esta ficha.
7. No se crean ni editan datos maestros de Farmacia desde esta gestión. Se conserva el CRUD existente: el alta actual asigna `ayuntamiento_id`, y el PUT general no lo actualiza; la gestión municipal será el único flujo de asignación controlada.
8. La representación de una farmacia sin Ayuntamiento es `farmacia.ayuntamiento_id = NULL`, admitida en el esquema nuevo y en las bases que apliquen la actualización SQL. Listado/detalle conservan esas filas; la edición del maestro conserva NULL sin incluir la asignación en PUT. El POST existente sigue requiriendo Ayuntamiento.
9. Cambiar o quitar asignación no traslada ni modifica entregas, incidencias, precintos ni información financiera histórica. La comprobación y el cambio deben ser atómicos y coordinarse con el registro de entregas.

La participación en un periodo no se determina por una baja de farmacia: depende de que registre precintos. Una farmacia asociada sin precintos debe poder seguir diferenciándose de una farmacia inexistente/no asociada (guía, A.9).

## 6. Búsqueda, duplicados y eliminación

- Cada alta comprueba primero existencia de la asociación. Para medicamentos, `UNIQUE (ayuntamiento_id, medicamento_id)` ya protege la unicidad y la aplicación deberá traducir la repetición a mensaje comprensible. No se añade una segunda relación ni se duplica información.
- El esquema no posee tabla de relación separada para Farmacia: `farmacia.ayuntamiento_id` es la asignación actual. `UNIQUE (soe)` identifica el código operativo, no la relación; las referencias usan el ID interno.
- Los modos de búsqueda y orden solicitados son requisitos funcionales; la búsqueda municipal de Farmacias está implementada; la búsqueda de Medicamentos también está implementada en el GET existente. Las colecciones actuales devuelven todos los registros ordenados por `id ASC`.
- Cada eliminación confirmada afecta solamente a la asignación de Farmacia, no se mapea a `DELETE /farmacias` y solo se permite sin entregas ni precintos.

## 7. Actividad, relaciones e histórico

### Detección de actividad

- La existencia de entregas se comprueba de forma fiable por `entrega_farmacia_periodo.farmacia_id`; los precintos se comprueban por `precinto.entrega_id → entrega_farmacia_periodo.id → entrega_farmacia_periodo.farmacia_id`. La condición confirmada bloquea si existe cualquiera de esas filas. Toda incidencia requiere una entrega y, por tanto, también queda bloqueada. Un dato informado de cero no elimina la fila de entrega y sigue bloqueando.
- No existe relación directa `FACTURA`/`FACTURACION → FARMACIA`. `FACTURACION` identifica Ayuntamiento, periodo y tipo; por decisión confirmada no se exige un control independiente de facturación por farmacia para reasignar/quitar. Una factura municipal de otras farmacias no bloquea a una farmacia sin entregas ni precintos.
- `DETALLE_PAGO_FARMACIA` conserva un snapshot histórico por SOE, denominación y datos bancarios, sin FK `farmacia_id`. Es un snapshot, no una relación operativa. La trazabilidad directa de facturación por Farmacia se especificará en el futuro módulo financiero; no afecta el control confirmado de entregas/precintos.

### Asignación y conservación histórica

El esquema no guarda una copia del Ayuntamiento en entrega/precinto. Si se cambiara la asignación después de existir entregas, informes que obtengan el Ayuntamiento mediante `FARMACIA` podrían presentar registros antiguos bajo el nuevo Ayuntamiento. La regla confirmada bloquea cualquier entrega o precinto y evita este caso si el control se aplica atómicamente. No se crea historial de asignaciones porque la decisión aprobada limita los cambios a antes de la primera entrega.

Las listas municipales siguen mostrando los datos maestros actuales y no registran historial de cambios de asignación. El modelo de Medicamento conserva el precio actual en `medicamento.precio`, mientras `precinto.precio_aplicado` conserva el precio de cada lectura. Las condiciones exactas de autorización observadas al aceptar un precinto no se reconstruyen con el esquema actual (modelo lógico §4.7); esto es independiente de la asignación de Farmacia.

La guía, §8.9, exige conservar la identidad histórica de las farmacias participantes en la facturación. `participacion_facturacion` vincula cada entrega participante con `facturacion` y conserva el snapshot B; `detalle_pago_farmacia` conserva el snapshot del destinatario C y referencia una participación. La emisión y liquidación están implementadas según `docs/specs/facturacion-municipal/spec.md`.

## 8. Decisiones confirmadas, cuestión restante y recomendaciones

### Decisiones confirmadas

1. **Cuenta bancaria:** la vista recibe y muestra solo los últimos cuatro dígitos; no necesita recibir la cuenta completa.
2. **Histórico de autorizaciones:** no se crea historial de listas ni nuevas tablas para esta gestión. Al abordar precintos se inspeccionará expresamente qué evidencia de admisión y precio aplicado conserva el modelo; se documentará entonces cualquier limitación, sin inventar campos ni modificar ahora el modelo. Se mantienen los requisitos vigentes de conservar facturaciones cerradas.
3. **Ubicación:** ficha del Ayuntamiento con apartados «Medicamentos admitidos» y «Farmacias asociadas», siguiendo los componentes y estilo existentes.
4. **Contrato API:** está definido en §11 e implementado para listas, búsquedas y mutaciones de Farmacias y Medicamentos, conforme a rutas, validaciones, respuestas y errores existentes. La evidencia está en `tasks.md`.

### Recomendaciones sencillas, no aprobaciones implícitas

- La transacción de asignación/quitar debe bloquear la fila de FARMACIA, comprobar ausencia de filas en ENTREGA_FARMACIA_PERIODO y PRECINTO, cambiar `ayuntamiento_id` y confirmar. El futuro alta de entrega debe bloquear/validar esa misma fila y volver a comprobar que la farmacia sigue asignada al Ayuntamiento seleccionado antes de insertar, evitando carreras.
- Para quitar, permitir `NULL` en la FK existente es la representación mínima recomendada; no borrar el maestro ni modificar registros operativos.
- No añadir control independiente de facturación por farmacia a esta gestión: decisión confirmada. Mantener como tarea futura la trazabilidad directa en el módulo financiero.
- En medicamentos, conservar la asociación específica al cambiar el maestro a `INACTIVO` o `BAJA`; mostrar ambos estados actuales por separado. La lectura nueva se rechaza según reglas vigentes, mientras las ya aceptadas y las facturaciones cerradas conservan el tratamiento histórico definido por sus fuentes.
- Enmascarar la cuenta en el servidor para el contrato de la ficha; no reutilizar la respuesta completa del GET general de Farmacias.
- Las búsquedas usarán parámetros validados y consultas SQL parametrizadas; los modos exacto/prefijo/contiene no se concatenarán con entradas del usuario.

## 9. Fuera de alcance y dependencias

Las mutaciones municipales no crean/editan maestros, cambian modalidad, alteran precintos/facturas ni crean historial de asignaciones/listas. Las API e interfaces municipales de Farmacias y Medicamentos están implementadas; su alcance y evidencia constan en `tasks.md` y `../interfaz-gestion-ayuntamiento/`. Entregas/precintos, facturación, cobros y liquidaciones también están implementados en sus módulos relacionados. `db/schema.sql` admite la asignación nula; las bases existentes aún no actualizadas deben aplicar el script 001 según `db/README.md`. Este bloque no necesita otro cambio de esquema. El contrato API implementado está documentado en §11.

## 10. Fuentes no verificadas

El modelo escrito tiene prioridad sobre el diagrama. Las mutaciones municipales y los bloqueos se verificaron con PostgreSQL en la base dedicada, incluidas conexiones concurrentes; el apartado de Farmacias de la ficha está implementado; la interfaz municipal de Medicamentos está implementada; el módulo de entregas/precintos no está implementado. No existe código de facturación. No se requiere resolver una relación factura-farmacia para estas operaciones.

## 11. Contrato API propuesto para implementación

Los prefijos corresponden al montaje actual de Express (`/ayuntamientos`, `/medicamentos`, `/farmacias`). Se mantienen IDs enteros positivos, `400` para entrada inválida, `404` para recursos inexistentes, `409` para conflictos, JSON `{ "error": "…" }` y consultas parametrizadas. GET de lista y búsqueda y POST/DELETE de Farmacias están implementados; los contratos municipales de Medicamentos también están implementados; su interfaz está implementada.

| Método y ruta | Entrada y resultado correcto | Errores funcionales |
|---|---|---|
| `GET /medicamentos?campo=…&modo=…&q=…` | Busca medicamentos existentes; `200` con array de proyección actual (`id`, `codigo_nacional`, `descripcion`, `estado`, `situacion_comercial`). Sin parámetros de búsqueda conserva el listado actual. | `400` por campo/modo/consulta inválidos. |
| `GET /ayuntamientos/:id/medicamentos` | Lista las asociaciones específicas actuales con IDs internos y datos actuales de los medicamentos; `200` y `[]` si no hay asociaciones. | `400` ID inválido; `404` Ayuntamiento inexistente. |
| `POST /ayuntamientos/:id/medicamentos` | JSON `{ "medicamento_id": number }`; asocia el maestro existente; `201` con la relación y los datos actuales proyectados. | `400` ID/cuerpo inválidos; `404` Ayuntamiento o medicamento inexistente; `409` si ya está asociado. |
| `DELETE /ayuntamientos/:id/medicamentos/:medicamentoId` | Elimina solo la relación específica; `204` sin cuerpo. | `400` ID inválido; `404` Ayuntamiento, medicamento o asociación inexistente. |
| `GET /ayuntamientos/:id/farmacias` | Lista la asignación actual del Ayuntamiento; `200` con `[]` si está vacía. Solo incluye `farmacia_id`, SOE, denominación, localidad, `ayuntamiento_id`, denominación del Ayuntamiento y `cuenta_bancaria_enmascarada` (`•••• 1234`, `••••` o `null`). | `400` ID inválido; `404` Ayuntamiento inexistente. |
| `GET /ayuntamientos/:id/farmacias/busqueda?campo=…&modo=…&q=…` | Busca el catálogo completo, incluidos no asignados y asignados a otro Ayuntamiento; `200` con la misma proyección segura y asignación actual. Ordena por el campo buscado. No devuelve `cuenta_bancaria` ni componentes de cuenta. | `400` ID/campo/modo/consulta inválidos; `404` Ayuntamiento inexistente. |
| `POST /ayuntamientos/:id/farmacias` | JSON `{ "farmacia_id": number, "ayuntamiento_origen_id": number \| null }`, ambos obligatorios; asocia/reasigna atómicamente; `200` con `farmacia_id`, `soe`, `denominacion`, `localidad`, `ayuntamiento_id`, `ayuntamiento_denominacion` y `cuenta_bancaria_enmascarada`. | `400` IDs/cuerpo inválidos o origen omitido; `404` Ayuntamiento de destino o farmacia inexistente; `409` por duplicado, origen desactualizado o entrega/precinto. |
| `DELETE /ayuntamientos/:id/farmacias/:farmaciaId` | Quita únicamente la asignación, conserva el maestro y deja `ayuntamiento_id = NULL`; `204` sin cuerpo. | `400` ID inválido; `404` Ayuntamiento/farmacia/asignación inexistente; `409` si existe alguna entrega/precinto (mensaje explicativo). |

Los valores de `campo` son `codigo_nacional` o `descripcion` para Medicamentos, y `soe` o `denominacion` para Farmacias. Los valores de `modo` son `exacto`, `prefijo` o `contiene`; `q` es obligatorio y no vacío cuando se realiza una búsqueda. Si se usa búsqueda, se envían los tres parámetros juntos; su ausencia completa conserva el listado general actual solo en `GET /medicamentos`. La cuenta se transforma en servidor: se devuelven los últimos cuatro dígitos numéricos con máscara (`•••• 1234`) cuando hay más de cuatro; si hay cuatro o menos se devuelve solo `••••`, para evitar entregar el valor completo. Todas las relaciones y rutas de Farmacia usan `farmacia.id`; medicamento usa `medicamento.id`. `POST` de reasignación debe comprobar actividad y mutar en una transacción con bloqueo de fila como se describe en §7 y plan §3. Respuestas 409 por actividad deben distinguirse de duplicado mediante el texto de `{error}` según el estilo actual; si una capa común de errores se define antes, conservar la semántica y los estados HTTP aquí especificados. La confirmación/cancelación es responsabilidad de la UI y la API solo recibe la acción confirmada.

### Precondición de origen y errores implementados

La regla confirmada de rechazar peticiones desactualizadas amplía la entrada de POST con `ayuntamiento_origen_id`. Es un dato de control de la petición, no una columna nueva. Se envía `null` al asignar una farmacia que se observó sin Ayuntamiento, o el ID interno del origen observado al reasignar. Zod rechaza omisión, valores inválidos y propiedades extra. Después del bloqueo se compara con la asignación actual: si ya pertenece al destino, se devuelve primero el duplicado `409` («La farmacia ya está asociada a este Ayuntamiento.»); en otro caso, un origen diferente produce `409` («La asignación de origen ha cambiado. Consulta la farmacia de nuevo antes de continuar.»). Se compara el valor actual, sin crear un historial ni un contador de versiones.

DELETE obtiene su origen esperado del Ayuntamiento de la ruta: una farmacia asignada a otro o sin asignación produce `404` («La farmacia no está asociada al Ayuntamiento indicado.»). La actividad produce `409` («No se puede cambiar ni quitar la asignación: la farmacia tiene entregas o precintos registrados.»). Ningún rechazo altera maestros ni registros operativos. El PUT general permanece excluido de cualquier cambio de asignación. La proyección segura se genera dentro de la misma transacción; no se reutiliza el GET maestro que entrega la cuenta completa.

La protección y sus límites están descritos en plan §6: no basta un INSERT directo con FK para validar el Ayuntamiento seleccionado. El futuro registro debe compartir el protocolo de bloqueo/validación antes de insertar. No hay migración adicional en este bloque; se reutiliza la nulabilidad ya implementada.

### Criterios técnicos implementados para consultar Farmacias

- `GET /ayuntamientos/:id/farmacias` no admite parámetros de consulta y ordena por `farmacia.id ASC`. Devuelve `200` con un array, incluido `[]` cuando no hay asociaciones.
- La búsqueda exige exactamente `campo`, `modo` y `q`, sin parámetros adicionales ni repetidos. Recorta espacios exteriores; admite entre 1 y 200 caracteres después del recorte y rechaza NUL. Una consulta vacía o inválida devuelve `400`; no se trunca el término. El límite evita términos desproporcionados sin añadir paginación.
- Coincidencia sin distinguir mayúsculas/minúsculas mediante `ILIKE` de PostgreSQL. Conserva espacios interiores y acentos; no añade búsqueda fonética ni elimina diacríticos. Ordena por el campo solicitado ASC según la colación de PostgreSQL y por ID ASC para desempatar.
- Los caracteres `%`, `_`, `!` y la barra inversa se buscan literalmente. El patrón usa un parámetro SQL y `ESCAPE '!'`; solo el modo añade los comodines necesarios. La columna procede de una lista interna de constantes validada por Zod.
- Devuelve todos los resultados coincidentes, sin truncado silencioso ni límite de filas no documentado; una paginación futura requerirá ampliar el contrato. Incluye farmacias sin asignación y de cualquier Ayuntamiento. Ambos GET validan el Ayuntamiento contextual: `404` si no existe; `400` para ID inválido.
- Proyección compartida con POST: `farmacia_id`, `soe`, `denominacion`, `localidad`, `ayuntamiento_id`, `ayuntamiento_denominacion`, `cuenta_bancaria_enmascarada`. Los datos municipales son NULL si no hay asignación. Se utiliza `ayuntamiento_id` como origen observado al enviar `ayuntamiento_origen_id`. El CRUD general de Farmacias conserva sus respuestas actuales.
- Evidencia: 41 pruebas reales de consulta y búsqueda; suite completa de 320 pruebas en 14 archivos aprobada en la base dedicada de pruebas. No se modifica esquema ni interfaz.

### Contrato implementado de Medicamentos (6 de octubre de 2026)

- `GET /medicamentos` sin parámetros mantiene los campos completos y orden `id ASC` del CRUD. Con búsqueda exige exactamente `campo=codigo_nacional|descripcion`, `modo=exacto|prefijo|contiene` y `q`; devuelve la proyección de cinco campos del contrato. Cualquier conjunto incompleto, parámetro adicional/repetido, modo/campo inválido o término inválido produce 400 con `{error}`.
- Reutiliza los criterios de Farmacias: ILIKE sin distinguir mayúsculas, trim exterior, espacios interiores/acentos conservados, término de 1–200 caracteres sin NUL; patrón parametrizado con escape literal compartido (`src/busqueda.js`), columna elegida solo de constantes internas. Orden ASC del campo solicitado según colación PostgreSQL e ID como desempate, sin paginación/truncado.
- GET municipal devuelve array de asociaciones en orden de ID de relación, incluido `[]`. Cada objeto contiene `id` de la relación, `ayuntamiento_id`, `medicamento_id` del maestro, `codigo_nacional`, `descripcion`, `estado`, `situacion_comercial`, `tipo_lista_medicamentos`, `lista_especifica_aplicable` y `aviso`. POST devuelve esa misma proyección con 201. Todos son valores actuales derivados de las tablas existentes; no se añaden columnas ni historial.
- `lista_especifica_aplicable` indica solo que la modalidad es ESPECIFICA, no que el medicamento cumpla los requisitos para aceptar precintos. En GENERAL es false y `aviso` contiene «No se aplica mientras se utiliza la lista general»; en ESPECIFICA es true y el aviso es null. `estado` y `situacion_comercial` permanecen separados; la futura aceptación exige las condiciones ya documentadas.
- Una lista vacía mantiene `[]`; su modalidad se consulta mediante el GET existente del Ayuntamiento, incluso cuando no hay filas donde incluirla. Nunca se interpreta como GENERAL. Cambiar la modalidad mediante PUT conserva las asociaciones; no hay otra ruta ni operación de modalidad.
- Se permite mantener/asociar cualquier medicamento existente, incluidos INACTIVO/BAJA, también en GENERAL. Las fuentes condicionan las lecturas futuras y no documentan un bloqueo de mantenimiento por esos estados. No se filtran silenciosamente en búsquedas/listas.
- POST exige solo `medicamento_id` numérico entero positivo dentro del rango INTEGER, rechaza propiedades extra y usa IDs de ruta validados existentes. Duplicado: 409 «El medicamento ya está asociado a este Ayuntamiento.». DELETE: 204 sin cuerpo; relación inexistente: 404 «El medicamento no está asociado al Ayuntamiento indicado.». Maestro/Ayuntamiento inexistente: 404 «Medicamento no encontrado.»/«Ayuntamiento no encontrado.». GET municipal rechaza filtros no contratados con 400.
- Evidencia: `test/ayuntamiento-medicamentos.test.js`, 58 pruebas reales; suite de 412 pruebas en 16 archivos aprobada. Incluye datos actuales, las cuatro combinaciones de estado/comercial, preservación de asociaciones al cambiar modalidad y conservación de un precinto previo tras retirada. Interfaz de Medicamentos implementada; validación del registro pendiente.

Interfaz de ambos apartados implementada: consulta, búsqueda y mutaciones sobre los contratos anteriores; cambio de modalidad mediante edición existente. Evidencia y límites de pruebas/visión en ../interfaz-gestion-ayuntamiento/tasks.md. La autorización de precintos y el módulo de facturación siguen fuera de esta implementación.
