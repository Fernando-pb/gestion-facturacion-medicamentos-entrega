# Plan técnico: gestión de medicamentos y farmacias del Ayuntamiento

## 1. Punto de partida

La aplicación tiene interfaces y API separadas para Ayuntamientos, Farmacias y Medicamentos. El catálogo general usa `GET /medicamentos` (orden `id ASC`) y detalle por ID; Farmacias ofrece listado/detalle y su respuesta contiene datos actuales, incluida cuenta bancaria. El backend municipal de Farmacias ofrece consulta, búsqueda y mutaciones; el apartado de Farmacias de la ficha está implementado; las operaciones API y la interfaz de Medicamentos están implementadas.

El esquema contiene `ayuntamiento_medicamento` con PK, dos FK y UNIQUE. `farmacia.ayuntamiento_id` ya admite NULL y conserva su FK/índice; las bases existentes requieren el script descrito en `db/README.md`, aplicado solo en pruebas. Farmacia se identifica por ID interno, nunca SOE. El CRUD compatible y las mutaciones municipales POST/DELETE están implementados; consultas y búsquedas municipales de Farmacias también están implementadas; interfaz de Farmacias implementada; API e interfaz de Medicamentos implementadas.

## 2. Separación de responsabilidades propuesta

- Mantener Ayuntamientos como punto de entrada de navegación y contexto municipal.
- Tratar autorizaciones específicas como operaciones sobre la relación existente, nunca como creación/edición del medicamento.
- Aplicar solo la lista general cuando `tipo_lista_medicamentos = GENERAL`; conservar y mostrar las asociaciones específicas con «No se aplica mientras se utiliza la lista general». En `ESPECIFICA`, volver a aplicar asociación específica junto con `estado = ACTIVO`; `situacion_comercial = ALTA` conserva su regla vigente para nuevas lecturas. Un cambio de modalidad nunca borra asociaciones.
- Mantener el CRUD actual de Farmacias: el alta asigna Ayuntamiento y el PUT de Farmacia no lo actualiza. Reutilizar esa identidad y validaciones al crear el flujo de Ayuntamientos, con operaciones de relación separadas de la edición del maestro.
- La búsqueda en esta ficha incluye todas las farmacias existentes, tanto sin asignación como asignadas a este u otro Ayuntamiento. Si ya pertenece al seleccionado, informar y no duplicar.
- La asignación y las entregas usan `farmacia.id`. Una corrección de `soe` no afecta las relaciones; no habilitar edición de datos maestros desde la ficha de Ayuntamiento.
- Para quitar la asignación, dejar `farmacia.ayuntamiento_id = NULL` tras el cambio de esquema aprobado. No sustituirlo por borrado del maestro.
- Consultar siempre valores maestros actuales. Para la UI, escapar/renderizar datos como texto, conservar mensajes de estado accesibles y adaptar el diseño al patrón actual HTML/CSS/JS modular.
- Mantener consultas parametrizadas y usar restricciones únicas/FK existentes como garantía de integridad.

## 3. Contrato API propuesto

El contrato está especificado en [spec.md §11](spec.md#11-contrato-api-propuesto-para-implementación). Las cuatro rutas municipales de Farmacias están implementadas, separadas del CRUD maestro y con IDs internos. Las búsquedas, listas y asociaciones de medicamentos bajo los prefijos existentes también están implementadas.

La búsqueda de Farmacias usa una ruta propia de proyección segura; no reutiliza `GET /farmacias`, que devuelve la cuenta completa. La respuesta lleva solo `cuenta_bancaria_enmascarada` con los últimos cuatro dígitos (`•••• 1234`) o `null`. Las respuestas de error siguen `{ error }` y estados ya usados: `400` entrada inválida, `404` recurso/relación inexistente, `409` duplicado o bloqueo por actividad. Las búsquedas se validan con el patrón Zod y usan SQL parametrizado.

La lógica implementada en `src/ayuntamientos/ayuntamiento-farmacia.service.js` usa un cliente de `pool.connect()` y `BEGIN ISOLATION LEVEL READ COMMITTED`: protege la existencia del Ayuntamiento con FOR KEY SHARE, bloquea la Farmacia con FOR UPDATE, comprueba pertenencia/duplicado/origen esperado, consulta entregas y precintos, actualiza solo `ayuntamiento_id` y hace commit. Cualquier rechazo hace rollback; el cliente se libera también ante error. El repositorio contiene consultas parametrizadas y la proyección segura; el controlador valida IDs reutilizados y el cuerpo estricto de `ayuntamiento-farmacia.validation.js`. Las nuevas rutas se montan en `ayuntamiento.routes.js` sin cambiar las rutas del maestro. La coordinación con entregas se detalla en §6.

Antes de reasignar Farmacia, confirmar mostrando Ayuntamiento actual y nuevo. Antes de quitar, confirmar la asignación exacta que se eliminará; si hay actividad, bloquear con explicación. La interfaz no debe permitir cambio/quitado cuando los datos de actividad no pueden comprobarse. La salida de API/UI nunca debe incluir `cuenta_bancaria` completa en respuestas destinadas a la ficha.

## 4. Ubicación funcional y archivos candidatos

La decisión funcional sitúa la gestión en la ficha del Ayuntamiento con «Medicamentos admitidos» y «Farmacias asociadas». El código visual conserva listado/formulario CRUD y añade la ficha con ambos apartados y confirmaciones. Las mutaciones backend usan los nuevos archivos `src/ayuntamientos/ayuntamiento-farmacia.*.js` y las rutas del router existente; el bloque de interfaz utiliza los archivos públicos descritos al final del plan.

## 5. Impacto del esquema actual y del CRUD de Farmacias

`farmacia.ayuntamiento_id` admite NULL; el script 001 conserva filas, FK e índice en bases existentes. Las lecturas del maestro usan LEFT JOIN y mantienen las farmacias no asignadas; su interfaz muestra «Sin Ayuntamiento». POST general exige Ayuntamiento y PUT rechaza la asignación, también con actividad. Las mutaciones municipales implementan su propio control atómico y no modifican los datos maestros ni los registros operativos.

El CRUD Farmacias actual requiere Ayuntamiento al crear y no lo actualiza en PUT; mantener esa separación. La nueva operación de gestión municipal usa `farmacia.id` y comprueba actividad; no acepta SOE como clave de relación. La discrepancia detectada: el modelo declara SOE estable, pero el PUT actual sí permite modificarlo. Las relaciones existentes usan el ID, así que la corrección del SOE no debe romperlas.

## 6. Registro futuro de entregas y coordinación atómica

El futuro módulo exige selección ordenada: primero Ayuntamiento, después farmacias cuyo `ayuntamiento_id` actual coincide. El servidor valida de nuevo esa pertenencia usando IDs internos antes de insertar entrega/precinto; farmacia sin Ayuntamiento o de otro Ayuntamiento se rechaza aunque el cliente haya filtrado correctamente.

La asignación/quita toma FOR UPDATE, no FOR NO KEY UPDATE: este último sería compatible con el FOR KEY SHARE que la FK de una entrega toma sobre Farmacia. Si una entrega ya se insertó sin commit, su KEY SHARE hace esperar a la API. En READ COMMITTED, la consulta separada de actividad posterior a adquirir el bloqueo ve esa entrega si se confirmó y rechaza el cambio. La transacción también serializa dos asignaciones; la segunda compara el origen esperado contra el estado confirmado por la primera.

El futuro módulo de entregas debe usar una única conexión y transacción READ COMMITTED: `SELECT id, ayuntamiento_id FROM farmacia WHERE id = $1 FOR SHARE`, validar en servidor que no sea NULL y coincida con el Ayuntamiento seleccionado, insertar la entrega con `farmacia.id` y conservar el bloqueo hasta COMMIT; ROLLBACK ante rechazo/error. FOR SHARE es compatible entre registros de entregas y conflictivo con FOR UPDATE. Si el registro gana primero y confirma la entrega, la mutación posterior se bloquea por actividad; si gana la mutación, la lectura bloqueada obtiene la nueva asignación y rechaza el Ayuntamiento antiguo antes de insertar. Para precintos se valida la farmacia de su entrega y la pertenencia seleccionada; la existencia de esa entrega ya impide reasignar.

**Límite verificado:** un INSERT directo que solo confía en la FK también espera al FOR UPDATE, pero después puede continuar bajo la nueva asignación. ENTREGA no almacena un Ayuntamiento seleccionado; la FK garantiza únicamente que existe `farmacia.id`, no que pertenezca al Ayuntamiento observado previamente ni que esté asignada. El esquema no tiene un trigger de esta regla. La validación bajo bloqueo del futuro registro es obligatoria y no se da por implementada. No se añaden triggers, tablas ni migraciones en este bloque; el código actual no ofrece rutas de creación de entregas.

**Evidencia:** `test/ayuntamiento-farmacias.test.js` usa conexiones reales y `pg_blocking_pids()` para observar esperas sin mocks. Comprueba entrega sin commit que gana primero (POST y DELETE terminan en 409), protocolo futuro FOR SHARE encolado tras la mutación (ve el nuevo Ayuntamiento o NULL y no inserta bajo el antiguo) y el límite del INSERT directo con FK. Las pruebas del futuro módulo completo siguen pendientes cuando exista.

## 7. Pruebas previstas

Actualización del registro de Entregas: la selección vigente exige periodo/farmacia y deriva el Ayuntamiento, según `docs/specs/entregas-precintos/spec.md` §3 y §14. La API POST/GET `/entregas` ya mantiene FOR SHARE y valida la relación no NULL; después de una reasignación confirmada utiliza el nuevo Ayuntamiento, sin exigir un Ayuntamiento seleccionado anteriormente. Las descripciones anteriores de comparación con Ayuntamiento seleccionado corresponden a la selección previa sustituida. No cambia el protocolo de bloqueo de las mutaciones municipales ni el límite de la FK sola. Evidencia de carreras reales en `test/entregas-api.test.js`; precintos siguen pendientes.

- API/integración: búsquedas por campo/modo, orden correcto, duplicados, asignación/reasignación/quitar sin actividad, bloqueos por entrega vacía/con precintos, validación de relación, maestro conservado y cancelación sin cambios.
- Farmacia sin asignación: GET/listados conservan el maestro y muestran ausencia de Ayuntamiento; `LEFT JOIN` no excluye esa fila. Verificar alta/edición existente y restantes operaciones del CRUD.
- Registro: farmacia sin Ayuntamiento no puede recibir entrega/precinto; una farmacia no asignada al Ayuntamiento elegido se rechaza en servidor.
- Concurrencia: forzar carrera entre reasignación y creación de entrega, y verificar que solo una operación continúa según el orden de locks y que nunca se crea entrega bajo asignación antigua.
- Seguridad API/UI: la proyección de búsqueda/listado entrega únicamente `cuenta_bancaria_enmascarada` con los últimos cuatro dígitos (`•••• 1234`) o `null`; comprobar que la cuenta completa no llega a la vista ni aparece en DOM/logs.
- Facturación: no se añade comprobación independiente por Farmacia para esta operación; su trazabilidad se aborda en el módulo financiero futuro.
- UI: consulta de datos actuales, estados generales/comerciales distintos, confirmación y cancelación, estados de carga/vacío/error/éxito accesibles, datos insertados como texto, cuenta siempre enmascarada y sin exposición de valor completo.
- Modalidad de lista: con asociaciones específicas persistidas, probar `GENERAL` (solo lista general aplicable, aviso visible) y volver a `ESPECIFICA` (relaciones vuelven a aplicarse junto a `ACTIVO`); verificar que cambiar de modalidad no elimina relaciones.
- Histórico: sin historial de listas ni tablas nuevas. Al implementar precintos, revisar qué información existente conserva el modelo sobre admisión y precio aplicado; registrarlo como comprobación futura sin inventar campos. Mantener las reglas de conservación de facturaciones cerradas.
- Farmacia: probar búsqueda en el catálogo completo, aviso sin duplicar cuando ya pertenece al Ayuntamiento actual, asignación/reasignación/quitar solo sin entregas ni precintos, bloqueos y confirmación. Probar farmacia sin Ayuntamiento y conservar maestro.

Bloque API verificado el 6 de octubre de 2026: 36 pruebas nuevas, incluidas cinco de concurrencia PostgreSQL; suite completa de 279 pruebas en 13 archivos aprobada. El bloque de consulta añade 41 pruebas reales en `test/ayuntamiento-farmacias-consulta.test.js`; suite completa de 320 pruebas en 14 archivos aprobada. Los bloques posteriores completaron interfaz de Farmacias y API de Medicamentos; interfaz de Medicamentos completada; registro de entregas pendiente.

## 8. Secuencia propuesta

1. Completado: guía/modelos alineados con asignación opcional y cambio solo antes de actividad.
2. Completado: esquema nullable, actualización SQL y compatibilidad de lectura/edición del CRUD verificadas. Aplicar el script a las instalaciones pendientes antes de usar esta versión.
3. Implementar el contrato documentado en `spec.md §11`, incluidos validaciones, proyecciones seguras y errores.
4. Completado: POST/DELETE de asignación/reasignación/retirada con bloqueo, comprobación de actividad y origen esperado. Completado también: GET de asociaciones y búsqueda del catálogo completo con proyección segura.
5. Implementar en el futuro módulo de entregas la selección por ID de farmacia y validación servidor de la pertenencia al Ayuntamiento, coordinada por lock.
6. Añadir pruebas de integración/API y UI de las situaciones listadas en `tasks.md`.
7. Verificar regresiones del CRUD existente, privacidad de cuenta, accesibilidad y `git diff --check`.

## 9. Riesgos y límites

- Interpretar `estado` como `ALTA/BAJA` confundiría autorización general con situación comercial; son columnas independientes.
- Quitar un medicamento cambia la autorización actual, pero el modelo no conserva una fotografía de la autorización comprobada para cada PRECINTO.
- Las bases que no apliquen la actualización SQL siguen con NOT NULL; el esquema nuevo no actualiza automáticamente instalaciones existentes. El procedimiento está en `db/README.md`.
- Las mutaciones municipales están implementadas; el futuro registro de entregas debe usar el protocolo §6. La FK y un INSERT directo no sustituyen esa validación. PUT general continúa rechazando cualquier cambio de asignación.
- La guía pide datos históricos de farmacia al facturar; hoy el snapshot verificable es el detalle del pago. La fase de facturación debe contrastar y resolver la diferencia, sin cargar esa decisión al módulo de listas.
- El GET actual de Farmacias devuelve la cuenta completa; la búsqueda/lista de la ficha debe usar la proyección enmascarada del contrato nuevo, no reutilizar ese payload.

## 10. Consulta municipal de Farmacias implementada

Se reutilizan router, controlador, validación y repositorio `ayuntamiento-farmacia.*`; la selección SQL segura se comparte entre GET y POST. Los GET son lecturas normales mediante `pool.query`, sin cambiar la transacción ni los bloqueos de las mutaciones. La asignación devuelta es actual al consultar; el origen esperado del POST sigue protegiendo frente a cambios posteriores.

Los criterios de mayúsculas, espacios, acentos, límite de término, orden y escape literal están definidos en spec §11. Se elige `ILIKE`, término de hasta 200 caracteres y colación existente para mantener una solución sencilla; no hay paginación ni truncado de resultados. No se modifica el esquema ni se cambian respuestas del CRUD maestro.

Verificación: 89 pruebas dirigidas (consultas, mutaciones y API Farmacias), 320 pruebas de suite completa en PostgreSQL y sintaxis de los cinco JS afectados aprobadas. Ese bloque previo dejó pendiente la ficha; su apartado de Farmacias y confirmaciones ya están implementados. La API de Medicamentos está implementada; su interfaz está implementada.

Bloque de interfaz de Farmacias completado en los archivos `public/ayuntamientos.html`, `public/js/ayuntamientos.js`, `public/js/ayuntamientos-api.js`, nuevo `public/js/ayuntamiento-farmacias.js` y CSS compartido. Evidencia: 34 pruebas añadidas y suite de 354 aprobada; revisión visual con datos ficticios en memoria documentada en las tareas de interfaz. Los apartados anteriores que describen interfaz futura se refieren ahora al trabajo pendiente del registro de entregas.

## 11. API de Medicamentos implementada

Se amplía GET del catálogo conservando el comportamiento sin query. Validación y consultas de búsqueda en los archivos actuales `src/medicamentos/medicamento.{validation,controller,repository}.js`. `src/busqueda.js` comparte exclusivamente la construcción del patrón literal entre Farmacias y Medicamentos; la regresión de Farmacias está probada.

La gestión de parejas usa cuatro archivos `src/ayuntamientos/ayuntamiento-medicamento.*.js` y el router municipal existente. Servicio READ COMMITTED, un cliente, maestros bloqueados FOR KEY SHARE para preservar existencia, inserción y lectura de proyección antes del commit; rollback ante rechazo/error y release en finally. El INSERT usa `ON CONFLICT ON CONSTRAINT uq_ayuntamiento_medicamento DO NOTHING RETURNING id`. La restricción UNIQUE decide duplicados también frente a concurrencia; ausencia de RETURNING se traduce en 409, sin error SQL interno. DELETE parametrizado retira solo la pareja y devuelve 404 cuando no existe. No se altera medicamento, precinto ni modalidad.

Aplicabilidad y aviso se proyectan desde el Ayuntamiento con JOIN; no son campos persistidos ni validación de precintos. Detalle del contrato y significado de identificadores en spec §11. Sin cambio de modelo/esquema ni actualización SQL adicional: se reutilizan PK/FK/UNIQUE existentes. Las instalaciones deben tener el esquema vigente, incluida situación comercial ya aprobada; esta tarea no migra ni clasifica datos antiguos.

Evidencia: 58 pruebas nuevas; 122 dirigidas antes de añadir conservación histórica; suite completa final de 412 en 16 archivos aprobada. Tres casos de concurrencia real con conexiones independientes, espera observada mediante `pg_blocking_pids()`: dos POST en vuelo (201/409), INSERT pendiente confirmado (409), INSERT pendiente revertido (201). La interfaz de Medicamentos admitidos está implementada; evidencia en las tareas de interfaz.

## Interfaz de Medicamentos implementada

El módulo public/js/ayuntamiento-medicamentos.js gestiona lista, búsqueda, incorporación y confirmación de retirada con el cliente municipal existente. public/js/gestion-municipal-ui.js comparte mensajes accesibles, celdas seguras y validación del término con Farmacias; HTML/CSS reutilizan sus componentes. ayuntamientos.js coordina el bloqueo de ambos apartados y el retorno desde la edición existente para cambiar modalidad. La modalidad se consulta por GET incluso sin asociaciones. No se cambia contrato, backend ni esquema. Evidencia: 34 pruebas nuevas y suite completa de 446 aprobada; revisión visual separada con API real a 1280/375 px, detallada en las tareas de interfaz.
