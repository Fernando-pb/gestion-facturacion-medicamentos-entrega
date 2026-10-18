# Especificación de interfaz: gestión de medicamentos y farmacias del Ayuntamiento

## 1. Objetivo y navegación

Definir la interfaz accesible para gestionar autorizaciones específicas de medicamentos y asignaciones de Farmacia desde el contexto de la ficha de Ayuntamiento. El proyecto usa HTML, CSS y JavaScript modular servidos por Express, sin framework nuevo (convención de `docs/specs/interfaz-ayuntamientos/spec.md`).

La gestión se ubica en la ficha del Ayuntamiento, organizada en tres pestañas: «Datos», «Farmacias» y «Medicamentos». Las dos pestañas de asociaciones conservan sus encabezados «Farmacias asociadas» y «Medicamentos admitidos». La UI conserva listado y formulario común de alta/edición y ofrece acceso «Ficha», separado de la edición de maestros.

## 2. Medicamentos admitidos

El aviso de modalidad `GENERAL` se presenta como información destacada: «Aviso sobre la lista específica del Ayuntamiento: No se aplica mientras se utiliza la lista general». Reutiliza `.informative-notice`, con fondo suave, borde, espacio interior y texto legible; el significado no depende del color. Se oculta en `ESPECIFICA`, donde el texto de modalidad conserva las condiciones generales de autorización. Cambiar la presentación no elimina ni modifica asociaciones.

- Ofrece búsqueda en el catálogo general por código nacional o descripción, con selector de coincidencia exacta, empieza por o contiene.
- Los resultados permiten consultar los datos actuales del medicamento antes de asociarlo. No se ofrecen controles de alta o edición del medicamento.
- La lista del Ayuntamiento muestra al menos código nacional, descripción y `situacion_comercial` actual (`ALTA`/`BAJA`). La interfaz distingue ese dato del `estado` (`ACTIVO`/`INACTIVO`) del registro; no presenta uno como sustituto del otro.
- La modalidad de listas se representa desde `ayuntamiento.tipo_lista_medicamentos`. En `GENERAL` se aplica únicamente la lista general (`estado = ACTIVO`), sin exigir asociación específica; las asociaciones específicas existentes se conservan y se muestran con el aviso «No se aplica mientras se utiliza la lista general». En `ESPECIFICA`, la asociación específica vuelve a aplicarse junto con la autorización general (`estado = ACTIVO`). La condición comercial `situacion_comercial = ALTA` para nuevas lecturas facturables sigue aplicándose según las reglas vigentes, separada de la modalidad. Una lista específica vacía no equivale a `GENERAL`. Cambiar modalidad no elimina asociaciones automáticamente. La modalidad se cambia mediante el formulario de edición existente, accesible desde la ficha; no se crea otro mecanismo.
- Acción «Añadir» sobre medicamento existente; si ya está asociado, mensaje accesible y sin duplicación.
- Acción «Quitar» solicita confirmación con denominación municipal, código y descripción; cancelar no modifica datos. Confirmar elimina solo la relación específica, no el maestro.
- La UI presenta ambos estados del medicamento como valores actuales. No afirma que el estado actual reconstruya la elegibilidad histórica.

Los modos y rutas de búsqueda, parámetros, proyecciones y errores están definidos en §5 y en la especificación funcional §11. Las consultas y mutaciones API de Farmacias están implementadas; La API de Medicamentos está implementada; su interfaz está implementada. La interfaz de Farmacias está implementada.

## 3. Farmacias asociadas

- Permite buscar todas las farmacias existentes por SOE o denominación, incluidas las no asignadas y las asignadas a otro Ayuntamiento, con modos exacto, empieza por y contiene. Si se busca por SOE, ordena por SOE; si se busca por denominación, ordena por denominación.
- Muestra SOE, denominación, localidad, asignación actual y cuenta bancaria enmascarada, nunca completa. Solo se muestran los últimos cuatro dígitos, por ejemplo `•••• 1234`; si no hay cuenta, se indica que no consta.
- Permite incorporar una farmacia existente mediante la acción del resultado. Si ya pertenece al actual, informa y evita duplicado. Si no tiene asignación o pertenece a otro Ayuntamiento, el servidor comprueba entregas/precintos: sin actividad permite asignar directamente desde el resultado o reasignar tras confirmación; si existe al menos una entrega —aunque esté vacía— o precinto, explica el bloqueo.
- Si la farmacia ya pertenece al Ayuntamiento actual, informa que ya está asociada y no crea una relación repetida.
- Permite quitar la asignación únicamente si no existen entregas ni precintos de la farmacia. La confirmación identifica la asignación que se eliminará definitivamente y permite cancelar. Quitar no elimina ni edita el maestro; la farmacia queda sin Ayuntamiento (`ayuntamiento_id = NULL`) una vez actualizado el esquema.
- No proporciona alta ni edición de datos maestros de Farmacia. La reasignación desde esta gestión es una operación específica y no habilita `ayuntamiento_id` en el formulario CRUD general.
- El esquema nuevo ya admite `ayuntamiento_id = NULL`; las bases existentes deben aplicar `db/updates/001-farmacia-ayuntamiento-opcional.sql`. El CRUD muestra «Sin Ayuntamiento» y permite editar el maestro conservando su asignación nula. Las operaciones de Farmacias de esta ficha están implementadas. No se exige control independiente de facturación por Farmacia; su trazabilidad queda para el módulo financiero.

### Dependencia del futuro registro de entregas/precintos

Al registrar una entrega, el usuario selecciona primero Ayuntamiento y después el sistema ofrece solo farmacias actualmente asignadas a ese Ayuntamiento. El servidor vuelve a validar la pertenencia usando el ID interno de Farmacia; no basta filtrar el selector. Una farmacia con `ayuntamiento_id = NULL` o asignada a otro Ayuntamiento se rechaza. La asociación se identifica por `farmacia.id`, nunca por SOE.

## 4. Estados, accesibilidad y seguridad

- Se aplica la convención común de `../interfaz-ayuntamientos/spec.md`. Guardar/cancelar la edición desde la ficha vuelve a Datos de esa ficha y conserva los filtros de búsqueda de ambas pestañas. Se mantienen las pestañas y los flujos de incorporación vigentes, sin cambiar los contratos.

- La ficha tiene un margen interior común para cabecera, pestañas, paneles, títulos y acciones (1.5rem en escritorio y 1rem en móvil). Los componentes internos no acumulan márgenes horizontales; búsqueda sin tarjeta adicional, selección/confirmación con un único fondo contextual. Texto alineado a la izquierda, separación vertical compacta y tablas con desplazamiento contenido.

- Mostrar carga, resultados, resultado vacío, error y confirmación con regiones accesibles (`status`/`alert`), etiquetas claras, orden de teclado lógico y foco visible, siguiendo las interfaces existentes.
- Insertar valores de API como texto seguro; no interpretar datos maestros como HTML.
- El número completo de cuenta no debe llegar a esta vista ni aparecer en tabla, detalle de búsqueda, mensajes, atributos DOM ni logs de UI. El contrato de búsqueda/listado devuelve solo `cuenta_bancaria_enmascarada` (últimos cuatro dígitos o `null`); no reutiliza la respuesta del GET general de Farmacias, que incluye la cuenta completa.
- Confirmar explícitamente antes de reasignar y antes de quitar una asignación; en reasignación identificar Ayuntamiento actual y nuevo, y en quitado identificar la asignación eliminada. Ofrecer cancelar accesible. Los errores del servidor deben comunicarse y permitir reintentar cuando corresponda.

## 5. Contrato de API para la interfaz

El contrato y sus proyecciones están definidos en [la especificación funcional §11](../gestion-ayuntamiento/spec.md#11-contrato-api-propuesto-para-implementación). GET de lista/búsqueda y POST/DELETE de Farmacias ya están implementados; las rutas de Medicamentos están implementadas; su interfaz está implementada. Se usan IDs internos y errores JSON `{ error }`. El CRUD general de maestros sigue separado.

| Acción de interfaz | Método y ruta | Resultado principal |
|---|---|---|
| Buscar medicamentos | `GET /medicamentos?campo=…&modo=…&q=…` (`campo`: `codigo_nacional`/`descripcion`) | `200` con catálogo coincidente y datos actuales. |
| Consultar medicamentos admitidos | `GET /ayuntamientos/:id/medicamentos` | `200` con array, incluso vacío. |
| Añadir medicamento existente | `POST /ayuntamientos/:id/medicamentos` con `medicamento_id` | `201`; `409` si ya estaba asociado. |
| Retirar medicamento | `DELETE /ayuntamientos/:id/medicamentos/:medicamentoId` | `204`; retira solo la relación. |
| Consultar farmacias asociadas | `GET /ayuntamientos/:id/farmacias` | `200` con la asignación actual y cuenta enmascarada. |
| Buscar farmacias existentes | `GET /ayuntamientos/:id/farmacias/busqueda?campo=…&modo=…&q=…` (`campo`: `soe`/`denominacion`) | `200` con resultados de todas las asignaciones y cuenta enmascarada. |
| Asociar/reasignar farmacia | `POST /ayuntamientos/:id/farmacias` con `farmacia_id` y `ayuntamiento_origen_id` (ID observado o `null`, obligatorio) | `200`; `409` por duplicado, actividad u origen desactualizado. Ante cambio de origen, recargar los datos y confirmar de nuevo antes de reintentar. |
| Quitar asignación | `DELETE /ayuntamientos/:id/farmacias/:farmaciaId` | `204`; `409` si hay entregas/precintos. |

Los parámetros de búsqueda admiten `campo=codigo_nacional` o `descripcion` para Medicamentos, `campo=soe` o `denominacion` para Farmacias, `modo=exacto|prefijo|contiene` y término no vacío `q`; en búsquedas deben enviarse los tres parámetros juntos. Las respuestas bancarias usan los últimos cuatro dígitos numéricos con máscara (`•••• 1234`), solo máscara si hay cuatro o menos, o `null` si no hay cuenta. Las entradas inválidas producen `400`; Ayuntamiento/maestro/relación inexistentes, `404`; duplicados y bloqueos por actividad, `409` con explicación en `error`. Las rutas mantienen validación por esquema Zod como en los módulos actuales; no se fija todavía un formato global de error distinto de la propiedad existente `error`.

## 6. Criterios de aceptación

1. Desde el contexto municipal se localizan y consultan medicamentos existentes con los tres modos solicitados.
2. Se añaden medicamentos existentes, se detectan duplicados y se muestran en lista con estados actuales claramente diferenciados.
3. Quitar medicamento requiere confirmación identificable y solo retira la relación.
4. La lista de farmacias presenta SOE, denominación, localidad y cuenta enmascarada; búsquedas y orden coinciden con el campo usado.
5. La cuenta completa nunca se representa en esta vista.
6. No se crean/editan maestros desde este flujo.
7. Se puede asignar una farmacia sin Ayuntamiento directamente desde el resultado («Asignar»), sin selección ni confirmación adicional. «Trasladar» exige confirmar farmacia, origen y destino. Ambas operaciones requieren ausencia de entregas/precintos; los casos bloqueados explican el motivo. Los resultados ya asociados muestran «Ya asociada» sin botón.
8. Quitar solo se ofrece si no existen entregas ni precintos, confirma la asignación concreta y conserva el maestro; usa `ayuntamiento_id = NULL` tras el cambio de esquema.
9. Ninguna relación con Farmacia usa SOE como identificador.
10. El futuro registro de entregas ofrece farmacias del Ayuntamiento seleccionado y el servidor rechaza una farmacia no asignada a ese Ayuntamiento o sin asignación.
11. No se añade comprobación independiente de facturación por Farmacia.
12. En modalidad `GENERAL`, solo se aplica la lista general; las asociaciones específicas existentes se conservan, se muestran con el aviso acordado y no se aplican; al volver a `ESPECIFICA`, vuelven a aplicarse junto con `estado = ACTIVO`.
13. Cambiar la modalidad no elimina asociaciones específicas automáticamente.
14. La gestión está en la ficha municipal con tres pestañas, un solo panel activo y componentes existentes.
15. El cliente de esta vista nunca recibe la cuenta completa: recibe solo los últimos cuatro dígitos enmascarados o `null`.
16. Todas las cargas, errores, resultados vacíos, éxitos y confirmaciones son utilizables con teclado y anunciados de manera accesible.

## 7. Fuera de alcance

Crear/editar los datos maestros; introducir permisos/autenticación no definidos; rediseño general del CRUD; ejecutar cambios de esquema en esta especificación; un mecanismo alternativo de cambio de modalidad; reasignar Farmacias con actividad; mostrar o enviar cuenta bancaria completa; implementar el flujo de precintos/facturación (se documenta su regla de selección como dependencia).

Consultas utilizadas por la interfaz: las consultas de Farmacias recortan espacios exteriores, conservan espacios interiores/acentos y buscan sin distinguir mayúsculas con los tres modos. `q` admite 1–200 caracteres; parámetros inválidos o repetidos producen 400. Véase la especificación funcional §11 para orden, escape literal y proyección. El apartado de Farmacias está implementado; la interfaz de Medicamentos está implementada.

Implementación de Farmacias vigente: cada resultado muestra «Asignar» (origen NULL), «Trasladar» (otro Ayuntamiento) o «Ya asociada» sin botón (Ayuntamiento actual). Asignar envía directamente el origen observado, incluido null; trasladar abre confirmación con farmacia/origen/destino y enfoca Confirmar. Se elimina la fase Seleccionar, el panel de farmacia seleccionada y Volver a resultados. Cancelar traslado vuelve a la lista sin envío. Quitar mantiene confirmación y conservación del maestro. Éxito vuelve a la lista actualizada y enfoca el mensaje; mutación/refresco bloquean controles, navegación y envíos duplicados. Errores API se conservan y los datos se recargan para reintentar usando el origen actual. Las generaciones descartan respuestas antiguas. Este flujo sustituye al anterior, según decisión del usuario; no había fallo de asignación, sino exceso de pasos.

La interfaz de Medicamentos usa la proyección de asociaciones documentada en la especificación funcional §11: `medicamento_id` es el ID del maestro y `id` el de la pareja; la retirada usa el ID del maestro en la ruta. Presenta `estado` y `situacion_comercial` separados. Obtiene la modalidad del GET existente del Ayuntamiento, incluso con lista vacía, y muestra el aviso acordado en GENERAL. `lista_especifica_aplicable` expresa modalidad, sin sustituir la futura validación de precintos. Backend e interfaz probados; evidencia en tasks.md.

«Editar Ayuntamiento», dentro de «Datos», abre el formulario de edición existente. Guardar o cancelar vuelve a la ficha en «Datos»; cada pestaña consulta sus datos al activarse; no se añade una operación alternativa para cambiar modalidad. «Añadir» acepta INACTIVO o BAJA: la asociación no expresa facturabilidad. «Quitar» confirma código, descripción y Ayuntamiento y explica la conservación del catálogo; cancelar no llama a la API. Las operaciones bloquean ambos apartados mientras mutan/refrescan. Generaciones de consulta y contexto descartan respuestas antiguas, también sus errores, sin reordenar resultados en cliente.

## Navegación con pestañas y una sola tarea

Solo se muestra listado, formulario o ficha. La ficha presenta nombre municipal, «Volver al listado» y pestañas «Datos», «Farmacias» y «Medicamentos». Abre en «Datos», obtiene datos actuales y ofrece «Editar Ayuntamiento»; guardar o cancelar vuelve a esa ficha en «Datos». La edición reutiliza el formulario y PUT existentes. El listado conserva sus controles y no incorpora filtros nuevos.

Solo el tabpanel activo es visible. Las pestañas usan tablist/tab, aria-selected, aria-controls y paneles con aria-labelledby. El tab seleccionado tiene tabindex=0 y los demás -1; flechas izquierda/derecha activan circularmente, Home/End activan primero/último. Tab entra en el panel activo. hidden retira paneles/tareas ocultos de la tabulación. Durante escritura se bloquean pestañas, edición, retorno, otras operaciones y navegación interna al inicio hasta comunicar el resultado.

Al activar Farmacias o Medicamentos se cargan sus asociaciones automáticamente. Una sola tarea ocupa el panel:

1. Lista actual y «Añadir…».
2. Añadir oculta lista/botón y muestra filtros, Buscar y Cancelar.
3. En Farmacias, los resultados ofrecen directamente Asignar/Trasladar o el texto Ya asociada. En Medicamentos se conserva la selección con datos actuales, acción pertinente y Volver a resultados.
4. Asignar farmacia se ejecuta sin confirmación adicional. Trasladar y retirar Farmacia mantienen confirmación; cancelar vuelve a la lista y restaura foco. Medicamentos conserva su flujo actual de incorporación y confirmación de retirada.
5. Incorporación correcta regresa a lista actualizada. Cancelar búsqueda/selección vuelve a lista sin escrituras. Un rechazo conserva el error visible y refresca datos; un traslado requiere nueva acción sobre el resultado actualizado y confirmación del origen observado.

Cambiar pestaña cierra la tarea y limpia selección/resultados temporales; conserva filtros dentro de la misma ficha. Cada otra ficha empieza con filtros iniciales. Contexto/generaciones invalidan cargas y búsquedas antiguas, también errores; solo el panel activo recibe sus resultados. Cancelar o incorporar enfoca «Añadir…» o el mensaje de resultado; en Medicamentos, seleccionar enfoca acción/aviso y volver a resultados enfoca la fila elegida. En Farmacias, las acciones están en los resultados; traslado/retirada enfocan Confirmar.

Se retiran actualizaciones manuales: la carga es automática al abrir pestaña y tras mutaciones. «Reintentar» solo aparece ante fallo de carga y se oculta durante reintento/éxito. Datos fallidos no presentan valores anteriores. Explicaciones extensas usan ayuda details/summary. En Medicamentos permanecen visibles modalidad/aviso GENERAL exacto o condiciones ESPECIFICA, y los estados comercial/general diferenciados en lista/selección; asociar INACTIVO/BAJA no expresa facturabilidad. Farmacias usa exclusivamente proyección bancaria enmascarada. No cambian reglas, API, backend, esquema ni dependencias.
