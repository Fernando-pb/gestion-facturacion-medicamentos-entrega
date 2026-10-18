# Tareas de interfaz: gestión de medicamentos y farmacias del Ayuntamiento

La ficha municipal implementa «Farmacias asociadas» y «Medicamentos admitidos». El bloque previo de compatibilidad del CRUD de Farmacias con maestros sin Ayuntamiento está implementado y probado; no implica completar los flujos de esta ficha.

## Cambios previos y trabajo acordado

- [x] Alinear guía/modelos y permitir NULL en el esquema. Evidencia: documentos canónicos, `db/schema.sql` y script de actualización probado únicamente en la base dedicada; aplicación a otras instalaciones pendiente según `db/README.md`.
- [x] Revisar validaciones y actualizar consultas/presentación del CRUD para farmacias sin Ayuntamiento. Evidencia: LEFT JOIN, «Sin Ayuntamiento» y pruebas API/UI. POST conserva Ayuntamiento obligatorio y PUT excluye la asignación; no se amplió el contrato de alta. Las 23 pruebas de Farmacias y la suite completa de 243 pruebas pasaron.
- [x] Implementar el backend de comprobación atómica de actividad y mutaciones; evidencia: POST/DELETE y 36 pruebas reales, incluidas cinco de concurrencia. La UI de Farmacias está implementada y usa ese control del servidor. El POST exige `ayuntamiento_origen_id` observado, incluido NULL; la interfaz recarga ante conflicto de origen y exige nueva selección/confirmación.
- [x] Implementar la ficha de Ayuntamiento con apartados «Medicamentos admitidos» y «Farmacias asociadas», siguiendo los componentes existentes.
- [x] Implementar las rutas y respuestas documentadas en `../gestion-ayuntamiento/spec.md §11`; validar parámetros/cuerpos con el patrón actual, usar IDs internos y devolver errores `{ error }` con `400`, `404` y `409` según el caso.
- [x] Crear una proyección de búsqueda/listado de Farmacias que devuelva solo `cuenta_bancaria_enmascarada` con los últimos cuatro dígitos (`•••• 1234`) o `null`, sin incluir cuenta completa ni componentes.

## Implementación y verificación pendientes

- [x] Implementar controles de búsqueda exacta/prefijo/contiene por código nacional y descripción.
- [x] Implementar consulta/lista actual de autorizaciones específicas y estados separados.
- [x] Probar que en modalidad `GENERAL` las asociaciones específicas se conservan y muestran con «No se aplica mientras se utiliza la lista general», que se identifican como no aplicables y que al regresar a `ESPECIFICA` la interfaz muestra su aplicación junto con las condiciones generales. La validación efectiva al registrar precintos queda pendiente.
- [x] Implementar agregar, duplicidad visible, confirmación, cancelación y retirada de medicamento.
- [x] Mostrar farmacias vinculadas con orden API y enmascaramiento validado. Evidencia: pruebas de módulo y revisión visual.
- [x] Implementar búsqueda/selección de farmacia existente y mostrar su asignación actual. Evidencia: seis combinaciones de campo/modo, orden API y estados NULL/otro Ayuntamiento en pruebas.
- [x] Implementar reasignación solo cuando no existan entregas ni precintos, con confirmación de Ayuntamiento anterior/nuevo y explicación del bloqueo en caso contrario.
- [x] Implementar quitar bajo la misma condición, confirmar la asignación, dejar `ayuntamiento_id` nulo y conservar el maestro.
- [x] Añadir pruebas UI de Farmacias para vacío, carga, error, éxito, duplicado, confirmación y cancelación; descarte de búsquedas antiguas y bloqueo de doble envío. Medicamentos completado; evidencia abajo.
- [x] Verificar teclado y foco en confirmación/cancelación, anchura reducida y texto seguro de Farmacias. El módulo solo solicita la proyección municipal enmascarada; no usa el GET maestro ni registra datos en logs. Evidencia: pruebas de cliente/módulo y revisión a 375 px.
- [ ] Completar revisión manual con lector de pantalla de la ficha municipal.
- [ ] Probar ausencia/presencia de entregas y precintos, confirmación/cancelación, conservación del maestro y concurrencia del control.
- [ ] No añadir un control independiente de facturación por farmacia a esta operación: las fuentes disponibles no permiten detectarla de forma fiable y la regla confirmada se basa en entregas y precintos. Resolver la trazabilidad directa de facturación por farmacia, si se necesita, en el alcance del módulo financiero.
- [ ] Validar en el futuro flujo de entregas, en servidor, que la farmacia seleccionada sigue asignada al Ayuntamiento elegido y usar su ID interno.
- [ ] Al abordar el módulo de precintos, comprobar y documentar qué información conserva el modelo sobre admisión y precio aplicado; no crear historial de listas ni tablas para esta gestión. Mantener conservación de facturaciones cerradas.

Backend de consulta disponible: GET de asociaciones y búsqueda del catálogo completo, 41 pruebas nuevas y suite de 320 pruebas aprobadas. Criterios técnicos en la especificación funcional §11. La dependencia de proyección segura está completa; el bloque de interfaz de Farmacias se acredita abajo.

## Evidencia de interfaz de Farmacias (6 de octubre de 2026)

- [x] Añadir acción «Ficha» al listado y panel de Farmacias separado del formulario maestro, reutilizando componentes/estilos. La ficha con ambos apartados se completó en el bloque de Medicamentos.
- [x] Implementar cliente de las cuatro rutas municipales; DELETE acepta 204 sin intentar leer JSON. POST envía `farmacia_id` y `ayuntamiento_origen_id` observado, incluido NULL.
- [x] Confirmar asignación/traslado con origen/destino y retirada conservando maestro; cancelar no envía solicitudes. Rechazos muestran el mensaje API y recargan sin reintentar con el origen antiguo.
- [x] Proteger respuestas por generación de búsqueda/lista y contexto; deshabilitar controles y acciones durante mutación/refresco.
- [x] Pruebas automatizadas: 25 del módulo, 7 nuevas del cliente y 2 nuevas de entrada a ficha/recursos (34 añadidas). Suite completa: 354 pruebas en 15 archivos aprobadas contra la base dedicada; conserva CRUD, API y concurrencia existentes. `node --check` correcto en los siete JS afectados.
- [x] Revisión visual en navegador a 1280×900 y 375×812 con dos Ayuntamientos y cuatro farmacias ficticias servidas por API en memoria, sin escrituras PostgreSQL: listado, búsqueda por nombre/contiene y SOE/prefijo, selección, cancelación, asignación desde NULL, traslado, retirada, actualización y bloqueo por actividad; en móvil, asignación/retirada, bloqueo y cancelación con Tab/Enter. Sin desbordamiento horizontal de página; tablas con scroll propio. Corregidos solapamiento de columna municipal y foco tras operación. Ausencia de resultados comprobada. No se verificó lector de pantalla ni conflicto desactualizado visualmente; este último sí tiene prueba automatizada.

Comprobación manual: arrancar el servidor con una base compatible con el script 001, abrir `/ayuntamientos.html`, pulsar «Ficha», buscar por campo/modo, seleccionar y cancelar/confirmar. Probar farmacia libre, de otro Ayuntamiento y asociada; quitar y comprobar que sigue en resultados sin Ayuntamiento. Comprobar bloqueo con actividad y repetir a anchura móvil usando el scroll de las tablas.

- [x] Revisión final de diff/status, `git diff --check` y archivos sin seguimiento sin errores de espacios. Sin staging, commit, push ni cambio de rama. Servidor visual temporal cerrado al terminar.

Backend de Medicamentos disponible: búsqueda en GET del catálogo y GET/POST/DELETE de lista específica, proyección actual y aviso por modalidad, 58 pruebas nuevas y suite de 412 aprobada. La interfaz de Medicamentos se completó en el bloque posterior documentado abajo. El usuario comprobó manualmente el apartado de Farmacias asociadas y confirmó que funciona.

## Evidencia de interfaz de Medicamentos (6 de octubre de 2026)

- [x] Ficha con ambos apartados; búsqueda por los dos campos y tres modos, orden API, incorporación de INACTIVO/BAJA, duplicados y retirada confirmable conservando el catálogo. Columnas comerciales y generales separadas; asociar no significa ser facturable.
- [x] Modalidad consultada incluso con lista vacía; aviso GENERAL exacto y condiciones ESPECIFICA visibles. «Editar Ayuntamiento / modalidad» reutiliza el formulario/PUT existentes y vuelve a la ficha al guardar/cancelar. Las asociaciones se conservan. La validación de autorización al registrar precintos sigue pendiente; no se acredita por estas pruebas de presentación.
- [x] Carga, vacíos, errores API, mensajes status/alert y texto seguro. Generaciones por consulta/contexto descartan respuestas y errores antiguos; las mutaciones bloquean envíos y ambos apartados durante el refresco. Utilidades de mensajes/celdas/validación y CSS compartidos con Farmacias.
- [x] 34 pruebas añadidas: 26 del módulo con API simulada, seis del cliente, una de integración de ficha/edición y una de recursos servidos por Express. Suite completa: **446 pruebas en 17 archivos aprobadas**, incluidas API/PostgreSQL y regresiones CRUD/Farmacias. Las pruebas de interfaz usan DOM y API simulados; no son pruebas de navegador contra la API real.
- [x] Comprobación visual separada en navegador con API real y PostgreSQL dedicado a pruebas, a 1280×900 y 375×812: GENERAL vacío, búsqueda por descripción/contiene, asociación INACTIVO/BAJA, duplicado, cambio a ESPECIFICA conservando la asociación, retirada cancelada y confirmada, lista específica vacía sin inferir GENERAL y catálogo conservado al volver a buscar. Farmacias permanece visible con cuenta enmascarada. En móvil, controles apilados, confirmación legible y tablas con scroll propio; ancho de página 360 px dentro de viewport 375 px. No se verificaron visualmente todos los errores ni respuestas antiguas; sí tienen pruebas automatizadas. Lector de pantalla pendiente.
- [x] Datos ficticios propios limpiados: Ayuntamiento 2359, farmacia 900 y medicamentos 393/394, ausencia verificada; servidor temporal cerrado. No se modificó esquema, modelo, backend ni reglas de negocio.

Comprobación manual: arrancar con una base compatible, abrir /ayuntamientos.html → «Ficha» → buscar medicamento por campo/modo → «Añadir». Comprobar estados separados y duplicado, editar modalidad mediante el formulario existente y volver a la ficha. Pulsar «Quitar», cancelar y después confirmar; el medicamento debe seguir disponible en búsqueda. Repetir a anchura móvil usando el scroll de las tablas y comprobar Farmacias asociadas.

- [x] Controles finales: `node --check` correcto en los nueve JS de este bloque; revisión de cambios y `git diff --check`, incluidos archivos sin seguimiento, sin errores de espacios. Sin staging, commit, push ni cambio de rama.


## Usabilidad y navegación progresiva (6 de octubre de 2026)

- [x] Listado/formulario/ficha excluyentes, regreso al listado y retorno a ficha tras guardar/cancelar su edición. Controles del listado conservados; no hay filtros del listado implementados y no se añadieron nuevos.
- [x] Ambos apartados empiezan con asociaciones y «Añadir…». Búsqueda cerrable, filtros conservados dentro de la ficha, selección sin envío y acción pertinente fuera de cada fila; asociados informativos sin acción de incorporación. Avisos de modalidad y estados se mantienen.
- [x] Confirmación de asignación/traslado suspende búsqueda; cancelar vuelve al elemento seleccionado. Retirada cierra búsqueda y confirma conservación del maestro. Éxito refresca listas/resultados; la incorporación permite seguir añadiendo. Abrir tarea cierra la del otro apartado, manteniendo bloqueo durante operaciones y descarte de respuestas antiguas.
- [x] Pruebas de interfaz con DOM/API simulados: siete casos nuevos de panel/filtros/respuesta tardía/acción pertinente, pruebas anteriores adaptadas a selección + acción y comprobaciones de navegación/retorno, confirmaciones y cierre mutuo. Suite completa: **453 pruebas en 17 archivos aprobadas** contra el entorno existente, incluidas API real/PostgreSQL y regresiones CRUD. Recursos HTML también verificados mediante Supertest.
- [x] Comprobación visual separada con API real en gestion_facturacion_medicamentos_test: 1280×900 y 375×812. Alta cancelada, ficha sin listado, búsqueda/selección/traslado cancelado y confirmado, duplicado de Farmacia, incorporación y duplicado INACTIVO/BAJA, retirada de Medicamento cancelada/confirmada; en móvil, asignación de Farmacia desde NULL y retirada cancelada/confirmada, conservación de filtros entre tareas, edición a ESPECIFICA guardada/cancelada y vuelta al listado con foco visible. Ancho de página 360 dentro de viewport 375; tablas con scroll propio y panel seleccionado legible. No se repitieron visualmente todos los errores/carreras; permanecen cubiertos por pruebas simuladas/API. Lector de pantalla pendiente.
- [x] Cleanup propio verificado: Ayuntamientos 2658/2659, Farmacias 1128/1129 y Medicamento 511; quedan cero de esos registros. Servidor y pestaña temporales cerrados. Sin modificaciones de backend, esquema, contrato ni dependencias.

Comprobación manual: listado → Nuevo/Editar → cancelar/guardar → listado; Ficha → editar modalidad → cancelar/guardar → misma ficha. En ambos apartados: Añadir → buscar → Seleccionar → acción correspondiente → confirmar/cancelar cuando corresponda. Probar asociado, continuar añadiendo, cerrar/reabrir filtros, abrir tarea del otro apartado y quitar asociación. Terminar con «Volver al listado» y repetir en móvil.

- [x] Controles finales: sintaxis correcta en los ocho JS afectados; revisión de cambios y `git diff --check`, incluidos archivos sin seguimiento, sin errores. Sin staging, commit, push ni cambio de rama.

## Ficha con pestañas y una sola tarea (6 de octubre de 2026)

- [x] Cabecera/nombre/retorno y tres pestañas; Datos inicial con GET actual y edición existente. Solo panel activo visible; retorno tras guardar/cancelar en Datos.
- [x] Lista → búsqueda → selección → confirmación, una tarea visible. Volver a resultados y cancelar restauran foco; incorporar vuelve a lista actualizada. Duplicados sin botón de incorporación; estados/avisos conservados y ayuda desplegable.
- [x] Carga automática al activar pestaña; reintento solo ante fallo. Cambio de pestaña cierra tarea y conserva filtros, invalidando cargas/respuestas/error tardíos. Escritura bloquea navegación y otras operaciones hasta comunicar resultado.
- [x] Cinco pruebas nuevas de ficha completa con API/DOM simulados: panel inicial/carga, flechas/Home/End, edición/regreso, lectura tardía/filtros, escritura/salida, retorno a lista y reintento de Datos/asociaciones. Regresiones de ambos apartados adaptadas; recursos ARIA/ayuda y ausencia de actualización manual verificados por Supertest. Suite final: **458 pruebas en 17 archivos aprobadas**, incluidas API/PostgreSQL existentes.
- [x] Verificación visual separada con API real y PostgreSQL dedicado, a 1280×900 y 375×812: Datos inicial, flecha a Farmacias y Home a Datos, Tab al panel activo, búsqueda que sustituye lista, selección que sustituye resultados y regreso a resultados, traslado cancelado/confirmado y retorno automático a lista, incorporación INACTIVO/BAJA, duplicado informativo, retirada de medicamento cancelada/confirmada, asignación desde NULL y retirada de farmacia cancelada/confirmada. Edición a ESPECIFICA conservando asociación y retorno tras guardar/cancelar. En móvil, un solo panel/tarea, confirmación legible, página de 360 px dentro de viewport 375 y scroll propio de tablas. No se forzaron fallos de red/reintentos ni carreras visuales; tienen pruebas automatizadas. Lector de pantalla pendiente.
- [x] Fixtures propios limpiados y ausencia comprobada: Ayuntamientos 3107/3108, Farmacias 1469/1470, Medicamento 686. Servidor/pestaña temporales cerrados; sin cambios de backend/esquema/contrato/dependencias ni operaciones Git de escritura.

Comprobación manual: Ficha abre Datos; usar flechas/Home/End y Tab. Editar y guardar/cancelar vuelve a Datos. Farmacias/Medicamentos: Añadir → buscar → seleccionar → volver a resultados o realizar acción → lista actualizada. Cancelar no cambia asociaciones. Cambiar pestaña durante búsqueda y reutilizar filtros; probar duplicado y retirada con cancelación. Revisar ayuda, avisos y versión móvil; volver al listado.

- [x] Comprobación visual final de Cancelar asignación: vuelve a lista, cierra búsqueda/confirmación y enfoca Añadir. API real verificó que farmacia 1697 siguió sin Ayuntamiento; fixtures 1697/3407 limpiados y ausencia comprobada.

## Diagnóstico de asignación NULL y alineación (6 de octubre de 2026)

- [x] Reproducción completa en navegador con API real y PostgreSQL de pruebas: Ayuntamiento 3408 y farmacia ficticia 1698 (SOE DIAG-NULL-20261006), sin entregas ni precintos. Búsqueda devuelve ayuntamiento_id y denominación municipal NULL; selección muestra «Sin Ayuntamiento». Confirmar envía exactamente `{farmacia_id:1698, ayuntamiento_origen_id:null}`; el servidor responde 200, la interfaz comunica «Farmacia asociada correctamente» y vuelve a la lista actualizada. Repetido en móvil tras retirar la asignación. PostgreSQL confirmó ayuntamiento_id=3408.
- [x] No se reprodujo el fallo comunicado: no se encontró conversión de NULL a 0/texto/undefined en este flujo. Validación Zod nullable y comparación estricta del origen correctas; no se cambió backend, contrato, actividad ni protocolo de concurrencia. «Asignar farmacia» abre confirmación; solo «Confirmar» envía POST.
- [x] El usuario confirmó después que no había fallo de asignación, sino exceso de pasos. Diagnóstico cerrado; la simplificación vigente se acredita abajo.
- [x] Dos pruebas de recorrido añadidas en ayuntamiento-farmacias-interfaz.test.js: DOM simulado, módulo y cliente reales, transporte relativo adaptado a Supertest, API/SQL reales. Acreditan NULL explícito, asignación/refresco y rechazo 409 con entrega vacía, mensaje real y conservación de maestro/entrega. No son pruebas automatizadas de navegador. Suite completa: **460 pruebas en 17 archivos aprobadas**, incluidas regresiones y concurrencia PostgreSQL existentes.
- [x] Causa visual: padding repartido entre componentes, sin margen común de la ficha. CSS limitado a #ficha-ayuntamiento: margen uniforme (24px escritorio/16px móvil), encabezados/pestañas/Datos/acciones alineados, búsqueda sin borde adicional, confirmación/selección con fondo único, estados vacíos sin espacio y separación vertical reducida. Pestañas, móvil y scroll de tablas conservados.
- [x] Revisión visual separada con API real a 1280×900 y 375×812: Datos, listas/búsquedas de Farmacias y búsqueda de Medicamentos con avisos GENERAL, selección y confirmación de Farmacia. Alineación izquierda medida en Datos: 57px escritorio y 27px móvil para cabecera, pestaña, panel, datos y Editar. Página sin desbordamiento horizontal (1280/1280 y 360/360 dentro del viewport 375). No se repitieron todos los errores visuales ni flujos de Medicamentos; sus regresiones automatizadas pasan.
- [x] Limpieza de los dos fixtures propios y ausencia verificada (cero registros); servidor/pestaña temporales cerrados. Se conservaron los datos preexistentes. Sin actualización SQL ni operaciones Git de escritura.
- [x] Sintaxis del test correcta; revisión de cambios y git diff --check, incluidos documentos sin seguimiento, sin errores de espacios (solo avisos de normalización LF/CRLF).
- [x] Controles finales: sintaxis de ocho JS correcta; revisión de cambios y `git diff --check`, incluidos archivos sin seguimiento, sin errores. Sin staging, commit, push ni cambio de rama.

## Incorporación directa de Farmacias (6 de octubre de 2026)

Este flujo sustituye las fases de selección y confirmación de asignación documentadas en bloques anteriores. Medicamentos conserva su flujo.

- [x] Resultado sin Ayuntamiento: Asignar ejecuta POST directo con origen observado null, sin selección ni confirmación adicional. Otro Ayuntamiento: Trasladar abre confirmación con farmacia/origen/destino. Ayuntamiento actual: Ya asociada sin botón. Retirada conserva confirmación/cancelación y maestro.
- [x] Eliminados panel de Farmacia seleccionada y Volver a resultados del HTML y módulo. Utilidad compartida admite conSeleccion=false para Farmacias; valor predeterminado y apartado de Medicamentos sin cambios. Éxito vuelve a lista actualizada y enfoca mensaje. Bloqueo durante operación/refresco, errores API, origen observado y descarte de lecturas antiguas conservados.
- [x] Pruebas adaptadas sin reducir casos: 31 de Farmacias (29 DOM/API simulados y dos cliente/API/PostgreSQL real), incluyendo asignación directa, traslado/retirada confirmables y cancelables, asociados sin botón, errores, doble envío y refresco. Supertest verifica ausencia de los tres controles eliminados. 93 pruebas dirigidas y suite completa de **460 en 17 archivos aprobadas**, incluidas Medicamentos y concurrencia existentes.
- [x] Verificación visual separada con API real a 1280×900 y 375×812: resultados con las tres variantes y cuenta enmascarada, asignación directa desde NULL en ambas anchuras, retorno automático a lista con mensaje, traslado cancelado en escritorio y confirmado en móvil; retirada cancelada y confirmada en móvil. Filtros conservados al reabrir. Página móvil 360px/scroll360 dentro del viewport375; tabla con scroll propio. No se forzaron visualmente errores/carreras ni lector de pantalla; comportamiento cubierto por pruebas donde corresponde.
- [x] PostgreSQL confirmó las tres farmacias ficticias asociadas al destino tras las operaciones. Fixtures propios: Ayuntamientos 3564/3565, Farmacias 1818/1819/1820; limpiados y ausencia verificada. Servidor/pestaña temporales cerrados. Sin cambios de backend, contrato, esquema ni Medicamentos.

Comprobación manual: Ficha → Farmacias → Añadir farmacia → buscar. Pulsar Asignar sobre una sin Ayuntamiento: debe volver directamente a lista y mostrar éxito. Para otra asignación, pulsar Trasladar y cancelar/confirmar identificando origen y destino. Comprobar Ya asociada sin botón. Quitar debe seguir confirmando y permitir cancelar. Repetir en móvil, usando el scroll propio de la tabla.

- [x] Sintaxis de los cuatro JS modificados correcta; revisión de cambios y git diff --check, incluidos archivos sin seguimiento, sin errores. Sin staging, commit, push ni cambio de rama.

## Aviso y navegación comunes (7 de octubre de 2026)

- [x] GENERAL muestra «Aviso sobre la lista específica del Ayuntamiento: No se aplica mientras se utiliza la lista general», con fondo suave, borde y espacio interior. ESPECIFICA oculta ese aviso y mantiene las condiciones generales en el texto de modalidad. Asociaciones y reglas conservadas.
- [x] Edición desde ficha vuelve a Datos y conserva filtros de Farmacias/Medicamentos al guardar o cancelar. Pestañas y operaciones directas de Farmacias conservadas; no se cambia backend, contrato, esquema ni dependencias.
- [x] Pruebas DOM/API simuladas de ambas modalidades adaptadas para comprobar texto/visibilidad y conservación de asociaciones; dos pruebas nuevas de filtros y retorno desde edición. Supertest comprueba aviso oculto inicial y estilos compartidos con foco visible.
- [x] Verificación visual separada con API real en 1280×900/375×812: aviso GENERAL con contexto legible y espacio/borde; ocultación en ESPECIFICA, vuelta a ficha al guardar/cancelar y reutilización de filtros. Creación/edición/navegación de los tres módulos también comprobadas. Evidencia de fixtures, limpieza y límites en `../interfaz-ayuntamientos/tasks.md`, bloque del 7 de octubre. Lector de pantalla y fallos de red visuales no se repitieron.
- [x] Suite final 465/17 aprobada; sintaxis y diff correctos, incluidos archivos sin seguimiento. Detalle de comandos y alcance en las tareas compartidas anteriores.
