# Tareas: Entregas y precintos

## Borrado apto desde pantalla — 12 de octubre de 2026

- [x] Reutilizar DELETE físico y transacción/bloqueos/renumeración/retirada de claves existentes; mejorar mensaje de rechazo por EMITIDA/cobros. Sin nueva ruta, contrato o esquema.
- [x] Conectar papelera individual con confirmación/consulta ante incertidumbre y refresco del resumen exacto; incidencias fuera de la acción visual.
- [x] Añadir cinco casos de API con estados financieros reales y conservar integración de consultas/renumeración/paquetes/rollback/concurrencia. Suite completa final 1277/1277 en 48 archivos, interfaz final 132/132 en tres. Inventario y comprobación 752/375 en ../interfaz-entregas-precintos/tasks.md. Sin Git ni escrituras de comprobación en desarrollo.


## Revisión documental de v26 — 12 de octubre de 2026

- [x] Localizar única guía canónica, AGENTS, memoria, modelos, db README y spec/plan/tasks activos de Entregas, interfaz y Facturación municipal. No se encontró otra guía canónica o copia archivada en el inventario; historial de versiones/adendas/tareas conservado.
- [x] Corregir en especificaciones activas el bloqueo provisional por mera cabecera, el precio no editable y la omisión de referencia en respuestas. Matriz uniforme: SIN_FACTURAR/REVISION/REABIERTA sin cobros permiten registro/corrección individual; EMITIDA o cualquier cobro bloquean.
- [x] Aclarar actualización de documentos solo al reemitir, sin cambiar B/IDs/números/tasas; añadir lecturas en reapertura no amplía las participaciones emitidas.
- [x] Aclarar referencia migrada, backfill solo NULL/cobertura previa y límite de auditoría: dos precios no acreditan historial de cada modificación. AGENTS ya es coherente; sus instrucciones de prioridad del usuario, documentación previa e historia conservada se aplican sin cambiar reglas.
- [x] Revisar por lectura/búsquedas y contraste puntual con repositorios/servicios/005 existentes; sin ejecutar pruebas, SQL ni Git, sin modificar código/pruebas/esquema. Las cifras de pruebas de bloques previos son evidencia histórica, no ejecuciones de esta tarea.

Documentos actualizados: guía v26; spec de Entregas, interfaz y Facturación municipal; plan de Entregas e interfaz; ambos modelos escritos; db README; MEMORY y este registro. Los documentos archivados y las descripciones de pruebas previas no se reescriben como si hubieran seguido siempre la regla individual.

## Corrección individual vigente — 12 de octubre de 2026

- [x] Sustituir la corrección agrupada por actualización de un único ID de precinto y entrega. Retirar la ruta agrupada y el requisito de preparar revisión/participación.
- [x] Permitir SIN_FACTURAR (sin cabecera TD), REVISION y REABIERTA sin cobros; revalidar en servidor bajo los bloqueos existentes. EMITIDA y cualquier cobro bloquean registro/corrección.
- [x] Conservar referencia migrada y maestro; nuevas lecturas toman el maestro vigente. Recalcular total exacto y participación solo si existe, sin crear revisión.
- [x] Mostrar nueva fila al final, resaltada y visible con su precio, conservando orden y foco del lector; actualizar total tras registro/corrección.
- [x] Probar aislamiento individual, referencia/maestro/lecturas futuras, estados, reapertura, cobros, rollback y concurrencia real, incluida preparación inicial frente a corrección sin cabecera.

Resultados: **1260/1260 en 48 archivos** en base dedicada local verificada; tras el último ajuste CSS, **120/120 en 3 archivos** de interfaz/recursos. API de precios: 26 casos; interfaz de lecturas: 40 casos. Navegador con API ficticia en memoria: 32 filas, última visible/resaltada; corregir solo la última de 12,34 a 0,10 conserva la anterior en 12,34 y actualiza el total de 394,88 a 382,64 €. No se modificaron precios en desarrollo ni esquema/migración, dependencias o Git.

Archivos modificados en esta adaptación:

- Servidor: `src/entregas/entrega.validation.js`, `entrega.routes.js`, `precio.controller.js`, `precio.service.js`, `precio.repository.js`.
- Pantalla: `public/entregas.html`, `public/js/entregas-api.js`, `public/js/entregas-lecturas.js`, `public/css/entregas.css`.
- Pruebas: `test/entregas-precios.test.js`, `test/entregas-lecturas-interfaz.test.js`, `test/entregas-interfaz.test.js`.
- Documentación: `README.md`, `AGENTS.md`, `MEMORY.md`, guía canónica v26, ambos modelos escritos y spec/plan/tasks de entregas-precintos, interfaz-entregas-precintos y facturacion-municipal.

Los bloques anteriores siguientes son historial: la corrección agrupada y la obligación de preparar revisión quedaron sustituidas por la regla individual acordada. La reapertura controlada conserva su API existente; sus documentos oficiales se actualizan al reemitir.

## Histórico: corrección manual agrupada — 12 de octubre de 2026

- [x] Contrastar guía v24 A.6/A.14, modelos, esquema, UI y protocolos financieros; especificar el alcance requerido por el usuario.
- [x] Referencia histórica resuelta por aprobación expresa: valor conservado al migrar, sin garantizar el catálogo original. 005 aplicada y repetida en desarrollo (7 lecturas) y aplicada en pruebas (0 iniciales); aplicado conservado y cero referencias ausentes en ambos destinos.
- [x] Capturar referencia y aplicado en nuevas lecturas; consultar ambos sin cambiar recibos/paquetes.
- [x] Validar/corregir el grupo por farmacia/facturación/código bajo bloqueo compartido y recalcular la participación afectada atómicamente.
- [x] Mostrar estado real, corrección y referencias en pantalla, con recuperación y mensajes de bloqueo.
- [x] Probar estados, cobros de ambas facturas, aislamiento, trazabilidad, recálculo, reemisión y concurrencia real; ejecutar pruebas y registrar resultados.
- [x] Alinear documentación final y actualizar MEMORY.md.

Evidencia: suite completa ejecutada en la base dedicada local: **1255/1255 en 48 archivos**. Tras el ajuste visual final del foco/cabecera, **117/117** de interfaz de lecturas, Entregas y recursos estáticos. Los primeros intentos dentro del sandbox bloquearon sockets/archivos temporales; las ejecuciones válidas se hicieron fuera del sandbox con destino verificado. Primera ejecución dirigida: 198/201; tres expectativas del formulario bloqueado fallaban porque el DOM simulado no aplicaba hidden inicial; apertura reinicia explícitamente el formulario, y la suite completa pasó. Migración: 6 pruebas con esquemas propios y rollback (backfill, parcial, repetición tras corrección, incompatibilidades, restricciones y nueva instalación). API: 24 pruebas en entregas-precios, incluyendo esperas reales observadas con pg_blocking_pids y conexiones independientes para emisión en ambos órdenes, reapertura y cobro. Sintaxis de los JS principales comprobada con node --check.

Archivos de implementación: `src/entregas/precio.{controller,service,repository}.js`, `entrega.routes.js`, `entrega.validation.js`, `lectura.repository.js`, `src/check-db.js`, `db/schema.sql`, `db/updates/005-precio-referencia.sql`, `public/entregas.html`, `public/js/entregas-api.js`, `public/js/entregas-lecturas.js`, `public/css/entregas.css`. Pruebas nuevas: `test/entregas-precios.test.js`, `test/precio-referencia-migracion.test.js`; ampliadas ambas interfaces de Entregas y lectura. Se adaptaron únicamente INSERT de fixtures de los archivos existentes que creaban precintos sin la nueva referencia obligatoria: ayuntamiento-farmacias, ayuntamiento-medicamentos, claves-retiradas-migracion, entregas-consultas, entregas-declarados, entregas-evaluacion, entregas-lecturas, facturacion-cobros, facturacion-emision, facturacion-informe-anual, facturacion-liquidacion, facturacion-participaciones, farmacias, lecturas-migracion y medicamentos-api. Documentación: spec/plan/tasks de Entregas e interfaz, spec/plan/tasks de Facturación, guía canónica v25, ambos modelos escritos, db README, README y MEMORY. No se ejecutaron operaciones Git. Scripts/servidores temporales retirados.

Límites: requiere revisión/participación preparada; la reapertura conserva su API existente, sin añadir acción visual municipal (pendiente del alcance de esa interfaz). En REABIERTA el precio/participación se corrige y los documentos oficiales se actualizan solo al reemitir conjuntamente. El diagrama ER sigue siendo histórico; los modelos escritos describen la referencia añadida.

Estado: esquema y fixtures adaptados; API de creación/recuperación, snapshots, declarados, evaluación, guardado, consulta de lecturas/resumen y eliminación implementadas. Paquetes automáticos/expresos, renumeración local y claves retiradas sin contenido disponibles. Escrituras protegidas por ausencia de facturación y bloqueo municipal. Primer bloque de interfaz implementado: selección, detalle, declarados y resumen; reapertura vigente, lector e interfaz de lecturas pendientes.

## Bloque 1. Ajustes del esquema y alineación documental

- [x] Comprobar antes de aplicar que `current_database()` coincide con cada destino autorizado y que la tabla de entregas estaba vacía en ambas bases: `gestion_facturacion_medicamentos` (local, 0) y `gestion_facturacion_medicamentos_test` (pruebas, 0). Repetir verificación en otros destinos.
- [x] Crear actualización incremental 002 para snapshots `denominacion_farmacia` y `cif_nif_farmacia` (`TEXT NOT NULL`, sin DEFAULT/backfill) y los motivos aprobados. Bloquea la tabla antes de comprobar filas; aborta ante datos existentes sin snapshots, estado parcial o definición inesperada.
- [x] Revisar protección de operación repetida y resultado incierto sin unicidad de código nacional: tabla técnica 003 y consulta por clave (§17).
- [x] Actualizar `db/schema.sql` y `db/README.md`; mantener diferenciados el esquema preparado y las bases realmente migradas.
- [x] Identificar y adaptar todos los fixtures de pruebas que insertan entregas; los snapshots usan valores de sus farmacias ficticias.
- [x] Aplicar/verificar 002 en local y pruebas, ambas con cero entregas antes/después; comprobar columnas, CHECK y restricciones mediante pruebas transaccionales con rollback.

## Bloque 2. Crear/recuperar entrega y datos declarados

- [x] Permitir seleccionar mes/año aunque no exista periodo y farmacia; mostrar Ayuntamiento y validar asociación en servidor. POST resuelve periodo/entrega transaccionalmente; alternativa periodo_id conservada. Evidencias en `../interfaz-entregas-precintos/`.
- [x] Crear entrega única por farmacia-periodo usando transacción y protocolo común de bloqueo/validación de asignación.
- [x] Capturar snapshots de denominación y CIF/NIF al crear; preservar al recuperar y ante cambios del maestro.
- [x] Permitir edición de declarados con el criterio provisional aprobado de ausencia de facturación aplicable, sin modificar precintos/precios.
- [x] Añadir pruebas de asociación válida, desasignación/carrera, unicidad, recuperación y snapshots.

La selección visual, detalle, declarados y resumen están implementados en el primer bloque de interfaz; lectura visual sigue pendiente. La API recibe farmacia/periodo y devuelve el Ayuntamiento derivado. El control actual bloquea escritura ante cualquier facturación aplicable. Una reapertura actualmente vigente todavía no se representa en el esquema y su habilitación de escrituras sigue pendiente.

- [x] Proteger nuevas entregas y correcciones con Ayuntamiento FOR UPDATE antes de Farmacia, revalidación y consulta financiera posterior READ COMMITTED.
- [x] Mantener GET y POST de recuperación existentes con facturación sin actualizar datos.
- [x] Documentar contrato PUT de declarados, campos obligatorios/NULL/cero, límites de concurrencia y obligación del futuro cierre.

## Bloque 3. Validación, admisión e incidencias

- [x] Implementar interpretación estricta de código y entrada manual, conservando ceros y original, sin validar dígito EAN-13; función pura reutilizada por evaluación y guardado. Evento lector pendiente.
- [x] Evaluar autorización GENERAL/ESPECIFICA y TD en función pura con pertenencia explícita proporcionada.
- [x] Evaluar INACTIVO en ALTA y BAJA con prioridad y devolver motivo de incidencia, sin persistir.
- [x] Integrar evaluación con datos reales de medicamento/modalidad/pertenencia, incluidas listas específicas vacías, en el servicio de guardado.
- [x] Evaluar informativamente mediante POST `/entregas/:id/evaluacion`, sin guardar; guardado revalida aparte (§17).
- [x] Implementar decisión explícita aceptar/apartar BAJA elegible en backend sin omitir autorización. Sin marca histórica adicional; interfaz pendiente.
- [x] Persistir incidencias confirmadas directamente en entrega con los cuatro motivos aprobados, sin paquete/precio.
- [x] Resolver idempotencia y resultado incierto en backend mediante clave por entrega y GET operación; sin deduplicar por código ni reintentar automáticamente. Integración visual pendiente.
- [x] Probar desconocido, no autorizado, repetidos independientes, estados, cambios posteriores y autorización por modalidad.

Decisión aprobada: el MVP mantiene la elección explícita aceptar/apartar para BAJA elegible, sin marca histórica adicional de aceptación. Esa evidencia es mejora futura; no es requisito pendiente para implementar la elección.

## Bloque 4. Paquetes, correcciones y totales

- [x] Continuar último incompleto o iniciar uno explícitamente en backend; el precinto 15 completa sin crear paquete vacío y el siguiente admitido crea el nuevo (automático si el previo está completo, expreso si está incompleto).
- [x] No guardar paquetes vacíos ni rellenar anteriores; numerar nuevo como MAX existente + 1, con Entrega FOR UPDATE.
- [x] Eliminar lectura errónea con ausencia provisional de facturación; renumerar únicamente líneas del paquete y conservar IDs, en transacción común con retirada/purga de clave aprobada.
- [x] Desaparecer de consultas el paquete que queda vacío y conservar números/composición de los restantes.
- [x] Calcular totales/diferencias con precio aplicado histórico y sin importes ficticios de incidencias, exactos en PostgreSQL; declarados NULL/cero diferenciados.
- [x] Probar límite/apertura, recuperación, borrados, numeración, subtotal y diferencias informativas en backend; interfaz pendiente.
- [x] Probar guardado inicial, posiciones 1–15, apertura automática/expresa y MAX sin rellenar anteriores.
- [x] Consultar precintos/incidencias separados y resumen coherente, sin escritura y disponible con facturación.
- [x] Con aprobación expresa del usuario, conservar solo entrega/clave retirada sin contenido; adaptar esquema/004/recuperación y rechazar recreación tardía.

## Bloque backend de clave persistente — completado

- [x] Actualizar esquema inicial, crear 003 y verificar preservación/migración/repetición/definición incompatible con datos ficticios propios y rollback.
- [x] Aplicar/verificar 003 en desarrollo y test locales inequívocos; no adaptar lecturas antiguas ni explorar otras bases.
- [x] Guardar lectura y protección en transacción común; conflictos por contenido/decisión/paquete, repetición concurrente y recuperación sin reevaluar.
- [x] Consulta GET sin escritura para resultado incierto; no reintentos automáticos ni deduplicación de código nacional.
- [x] Documentar formato/alcance de clave; la propuesta inicial de desaparición de protección queda sustituida por clave retirada sin contenido aprobada en §18.
- [x] Comprobar regresiones, suite completa, sintaxis, diff y todos los archivos nuevos; evidencias al final.

## Bloque 5. Interfaz y comprobación con lector

- [ ] Separar selección y lectura; mantener periodo, farmacia y Ayuntamiento siempre identificados.
- [ ] Implementar estado «Guardando…», bloqueo de doble envío, error con entrada conservada y foco al campo tras éxito.
- [ ] Hacer accesibles avisos de incidencia/BAJA, opciones por teclado y confirmación identificable al borrar.
- [ ] Probar lector físico y su evento de finalización.
- [ ] Concretar y verificar escaneos durante petición y respuesta perdida; no perderlos silenciosamente ni duplicar una operación.
- [ ] Verificar consulta de paquetes/incidencias conservando contexto, foco visible, etiquetas, mensajes y ancho adaptable.
- [ ] Realizar pruebas manuales de varias lecturas consecutivas sin ratón y decisiones de avisos con teclado.

## Verificación global futura

- [ ] Ejecutar pruebas unitarias, API/integración y UI pertinentes con fixtures independientes.
- [ ] Revisar `git status`, diff, nuevos archivos y `git diff --check`.
- [ ] Confirmar que no se alteran facturaciones cerradas ni se implementan alcance financiero o mejoras futuras.

## Evidencia del bloque de esquema (8 de octubre de 2026)

- `gestion_facturacion_medicamentos_test`: destino y `current_database()` coincidentes; 0 entregas antes y después. Script aplicado y vuelto a ejecutar sobre el esquema ya actualizado; ambos snapshots son TEXT/NOT NULL/sin DEFAULT y el CHECK contiene exactamente los cuatro motivos.
- `gestion_facturacion_medicamentos`: destino local y `current_database()` coincidentes; 0 entregas antes y después. Script aplicado y verificado con la misma definición objetivo.
- `test/entregas-esquema.test.js` comprueba omisión de snapshots (rechazada), los cuatro motivos (aceptados), motivo desconocido (rechazado), FK de entrega, unicidad farmacia-periodo y CHECK de cantidad/importe; rollback elimina todos sus datos ficticios.
- Pruebas afectadas: 162 aprobadas en 6 archivos. Suite completa: 468 aprobadas en 18 archivos, ambas contra la base dedicada. `git diff --check` se revisó al finalizar.
- Guardia de 002 comprobada en la base dedicada: simulación del esquema sin snapshots con una entrega ficticia dentro de una transacción; aborto SQLSTATE `P0001`, rollback y definición/recuentos anteriores restaurados. La repetición sobre el esquema actualizado emitió los dos avisos de definición verificada, sin cambios. Comprobación posterior: cero entregas y ningún resto de la simulación en ambas bases.
- La actualización no rellena filas, no recrea bases y no ejecuta `db/schema.sql` sobre instalaciones existentes. API, captura automática de snapshots, comportamiento de lector e interfaz continúan pendientes.

## Evidencia de creación/recuperación (8 de octubre de 2026)

- Cinco archivos `src/entregas/entrega.*.js` y registro en `src/app.js`. POST crea (201) o recupera (200); GET recupera sin insertar. Contrato y límites en spec §14.
- `test/entregas-api.test.js`: 37 pruebas de API/integración con datos ficticios propios y limpieza por IDs. Guarda de DB_NAME y `current_database()` igual a `gestion_facturacion_medicamentos_test`, host local y sin desactivar las protecciones existentes.
- Verificados Ayuntamiento derivado, rechazo sin asignación, maestros/periodo inexistentes, IDs/campos extra inválidos, conservación de snapshots/declarados, independencia entre parejas y rechazo de mutaciones municipales tras entrega vacía.
- Ocho casos de concurrencia: POST simultáneos, INSERT pendiente con commit/rollback, FOR UPDATE con retirada/traslado/edición de maestro y registro que obtiene FOR SHARE antes de la mutación municipal (POST/DELETE reales). Las esperas se observan mediante `pg_blocking_pids()`, sin pausas arbitrarias.
- 73 pruebas dirigidas aprobadas (Entregas y asignación municipal); suite completa: 505 pruebas en 19 archivos aprobadas. El primer intento en sandbox falló por EACCES de conexión; ejecución con permiso contra PostgreSQL local aprobada.
- Consulta posterior de limpieza en `gestion_facturacion_medicamentos_test`: cero farmacias con SOE `TEST-ENTREGA-%` y cero ayuntamientos con CIF `TEST-ENTREGA-%`. Diff revisado y `git diff --check` sin errores, incluidos los seis archivos nuevos mediante `git diff --no-index --check`.
- Sin actualización SQL ni escrituras en desarrollo. Edición de declarados pendiente del control de facturación editable; selección visual, precintos, incidencias, paquetes e interfaz no implementados en este bloque.

## Evidencia de declarados y exclusión de escrituras (8 de octubre de 2026)

- PUT `/entregas/:id/declarados` implementado en los cinco archivos existentes de Entregas; reemplazo completo de los dos declarados, validación estricta y proyección existente. Contrato/NULL/cero/omisiones en spec §15.
- Regla provisional aplicada a correcciones y creación nueva: cualquier fila financiera aplicable bloquea con 409. POST de recuperación y GET conservados. La reapertura histórica no acredita vigencia ni habilita escrituras.
- Protocolo municipal contrastado con código real: Ayuntamiento antes de Farmacia, asociación revalidada y consulta financiera posterior READ COMMITTED. La carrera de traslado en las pruebas existentes ahora exige 409 para la petición que observó otro Ayuntamiento; una nueva petición deriva el destino vigente y crea correctamente. Las pruebas de unicidad, snapshots y mutaciones municipales se conservan.
- `test/entregas-declarados.test.js`: 44 pruebas nuevas, incluidos cuatro casos con conexiones independientes de cierre simulado bajo lock común y ambos órdenes de ejecución. Se observan esperas mediante `pg_blocking_pids()`, sin sleeps; el fixture no implementa el módulo financiero. También comprueba ausencia de facturación, bloqueos con reapertura histórica, consultas disponibles, otro Ayuntamiento/periodo, valores inválidos, identidad y lecturas/precios inalterados.
- Ejecución dirigida: 117 pruebas aprobadas en tres archivos (declarados, creación/recuperación y asignación municipal). Suite completa: 549 pruebas aprobadas en 20 archivos. Primer intento sandbox sin conexión por EACCES; ejecución autorizada contra la base dedicada local con verificaciones DB_NAME/current_database() y sin desactivar protecciones.
- Cleanup final comprobado por consulta en `gestion_facturacion_medicamentos_test`: cero farmacias/ayuntamientos `TEST-DECLARADOS-%` o `TEST-ENTREGA-%` y cero medicamentos `TEST-DECLARADOS-%`. Las pruebas limpian únicamente sus propios IDs y dependencias.
- Sintaxis de los siete JS afectados comprobada con `node --check`; diff revisado y sin errores de espacios, incluido el nuevo archivo mediante `git diff --no-index --check`. Sin cambio de esquema/dependencias, escritura en desarrollo ni acciones Git de modificación. Lecturas, interfaz y reapertura vigente continúan pendientes.

## Evidencia de interpretación de código

- Función pura `interpretarCodigoPrecinto` en `src/entregas/precinto.validation.js`, sin importar acceso a datos. Retorna `codigo_barras_original` y `codigo_nacional`; entrada inválida lanza TypeError con mensaje fijo, sin crear incidencia/registro. Contrato en spec §4 y plan bloque 3.
- `test/precinto.validation.test.js`: 61 pruebas unitarias aprobadas mediante `node ./node_modules/vitest/vitest.mjs run test/precinto.validation.test.js`. Ejemplo, manual, ceros iniciales, tipos inválidos, ASCII estricto, prefijo/longitud, espacios y terminadores adicionales, diez últimos dígitos sin control EAN-13 y llamadas repetidas válidas.
- Sintaxis de los dos archivos nuevos comprobada con `node --check`. Sin integración, endpoints, consultas/escrituras SQL ni cambios de esquema/dependencias. La suite completa no se repite por el alcance aislado autorizado; admisión, elección BAJA, idempotencia, lector e interfaz siguen sin implementarse.
- Diff documental revisado y `git diff --check` correcto; ambos archivos nuevos comprobados mediante `git diff --no-index --check`. Referencias vigentes de evidencia BAJA alineadas en guía/modelos y especificaciones de Entregas, Medicamentos e interfaz de Medicamentos; historial de versiones conservado.

## Evidencia de evaluación pura de admisión

- `evaluarAdmisionMedicamento` en `src/entregas/precinto.admision.js`, con Zod ya existente para validar el contrato. Sin acceso a datos, integración con código interpretado, endpoints ni persistencia.
- Entrada estricta `{ medicamento, tipo_lista_medicamentos, pertenece_lista_especifica }`: medicamento NULL (ausente) o proyección con exactamente `estado` ACTIVO/INACTIVO, `situacion_comercial` ALTA/BAJA y `tipo_facturacion` TD; modalidad GENERAL/ESPECIFICA y pertenencia booleana obligatorias. No normaliza categorías ni acepta un `autorizado` opaco. Medicamento ausente con pertenencia true es contradictorio. Omitir campos, tipos/categorías inválidos, propiedades adicionales o tipos de facturación no soportados lanza TypeError antes de evaluar reglas; no genera una incidencia nueva.
- Tres resultados sin textos de interfaz: `{ resultado: 'ADMITIDO' }`, `{ resultado: 'INCIDENCIA', motivo }` y `{ resultado: 'PENDIENTE_DECISION_BAJA' }`. La prioridad, tras validar la entrada, es ausente → MEDICAMENTO_DESCONOCIDO; INACTIVO → MEDICAMENTO_INACTIVO; ACTIVO ESPECIFICA sin pertenencia → MEDICAMENTO_NO_AUTORIZADO; ACTIVO autorizado ALTA → admitido, BAJA → pendiente. GENERAL ignora la pertenencia específica válida. BAJA pendiente no admite/rechaza automáticamente ni registra marca histórica.
- `test/precinto.admision.test.js`: 36 pruebas nuevas de prioridad, modalidades, decisión BAJA, errores/contradicciones y argumentos inmutables. Junto a `test/precinto.validation.test.js`: 97 pruebas aprobadas en dos archivos mediante `node ./node_modules/vitest/vitest.mjs run test/precinto.admision.test.js test/precinto.validation.test.js`.
- Sintaxis de ambos archivos nuevos comprobada con `node --check`; función de interpretación existente sin modificaciones. Suite completa no repetida por el alcance aislado autorizado. Integración, aceptación/rechazo BAJA, lecturas, incidencias persistidas y paquetes siguen pendientes; no hay acceso a bases ni cambios de esquema/dependencias.
- Diff revisado y `git diff --check` correcto; ambos archivos nuevos comprobados también mediante `git diff --no-index --check`, sin errores de espacios.

## Evidencia de evaluación informativa con PostgreSQL

- POST `/entregas/:id/evaluacion` implementado en las cinco capas existentes. Cuerpo estricto `codigo_barras_original`; ID/cuerpo/formato inválido 400, entrega ausente 404, asociación municipal ausente 409. Incidencia y BAJA pendiente devuelven 200. Contrato en spec §16; sin datos bancarios y con precio NUMERIC como cadena.
- Una única sentencia SELECT parametrizada obtiene entrega/Farmacia/Ayuntamiento, medicamento actual y pertenencia; reutiliza interpretación y admisión puras sin modificarlas. Sin locks exclusivos, reserva de precio, deduplicación ni escrituras. Facturación existente no impide evaluar; guardado futuro deberá revalidar autorización, precio y editabilidad.
- `test/entregas-evaluacion.test.js`: 31 pruebas nuevas de API/integración, incluyendo manual/barras con ceros, desconocido NULL, INACTIVO ALTA/BAJA, GENERAL y ESPECIFICA vacía/con pertenencia/otro Ayuntamiento, BAJA autorizada/no autorizada, errores, proyección mínima y catálogo/modalidad actualizados. Comprueban registros preservados y repetición con facturación existente, además de ausencia de lecturas para desconocido y BAJA pendiente.
- Pruebas dirigidas: 128 aprobadas en tres archivos (evaluación y ambas funciones puras). Suite completa: 677 aprobadas en 23 archivos. Primer intento sandbox falló por ENOENT de temporales de Vitest; ejecución autorizada fuera del sandbox correcta. DB_NAME/localidad y current_database() verificados antes de fixtures; escrituras solo en `gestion_facturacion_medicamentos_test`, sin desactivar protecciones.
- Limpieza posterior verificada mediante SELECT: cero Farmacias SOE, Ayuntamientos CIF y Medicamentos descripción `TEST-EVALUACION-%`. Limpieza por IDs propios y dependencias. Sintaxis de seis JS correcta; diff revisado incluyendo archivo nuevo mediante `git diff --no-index --check`; corregida línea vacía adicional al final de spec.
- Sin cambios de esquema/dependencias, escrituras en desarrollo ni acciones Git de modificación. Guardado de precintos/incidencias, elección BAJA, paquetes, interfaz y módulo financiero pendientes.

## Evidencia del guardado backend con clave persistente

- Nuevos `src/entregas/lectura.{controller,service,repository}.js`; validación/rutas y exportación del protocolo existente modificadas. Contratos POST lecturas / GET operación en spec §17: GUARDADO 201, RECUPERADO 200, DECISION_PENDIENTE 200 sin clave consumida, conflictos de clave/condiciones y facturación 409, inválidos 400, entrega/operación ausentes 404. Código original literal, UUID normalizado, decisiones/paquete por servidor, precio decimal en cadena, sin datos bancarios.
- `operacion_lectura`: petición JSONB y referencia exclusiva a precinto/incidencia de la misma entrega mediante FK compuestas; UNIQUE por entrega/clave y por lectura. Sin backfill, evaluaciones persistidas, entidad paquete, contador, timestamp ni historial adicional BAJA. Futura eliminación física hará cascada del recibo: descartar su clave, no mantener tombstone; borrado/renumeración fuera de este bloque.
- 003 preparada y aplicada realmente en `gestion_facturacion_medicamentos` y `gestion_facturacion_medicamentos_test`: ambas identificadas por configuración local y current_database(); 0 entregas/precintos/incidencias antes y después, 0 operaciones después. Repetición verifica definición en ambas. Desarrollo únicamente recibió DDL autorizado; no fixtures ni lecturas. Otros destinos no explorados. Primer acceso sandbox EACCES; operaciones autorizadas fuera del sandbox.
- `test/entregas-lecturas.test.js`: 37 pruebas de guardado real, cuatro motivos, confirmaciones, BAJA aceptar/apartar/inelegible, pendientes sin consumo, cambios posteriores, precio servidor, claves iguales/distintas/alcance por entrega/contenido distinto, consulta, facturación, rollback entre lectura y recibo, posiciones 1–15, MAX, apertura automática/expresa e incidencias sin posiciones. Conexiones independientes con pg_blocking_pids/vi.waitFor, sin sleeps: misma clave concurrente, distintas posiciones, cierre en ambos órdenes, catálogo, retirada específica y operaciones municipales sin interbloqueo.
- `test/lecturas-migracion.test.js`: 5 pruebas, esquema propio ficticio en la base dedicada y rollback; datos anteriores intactos sin claves, nueva instalación equivalente, repetición, columnas/restricciones incompatibles, CHECK/FK/UNIQUE y cascadas de ambos destinos. El fixture de array JSON inválido se corrigió para enviar texto JSON explícito, porque pg serializa arrays JS como arrays PostgreSQL.
- Dirigidas: 251 aprobadas en 7 archivos (guardado, migración, entregas API/declarados/evaluación y ambas funciones puras). Primer pase completo: 718 aprobadas y 1 timeout en prueba previa de FK/asignación municipal, más timeouts de cleanup/end del mismo archivo. No reproducido: archivo municipal aislado 36/36 aprobado y repetición completa 719/719 en 25 archivos; no se redujeron comprobaciones ni se alteró esa prueba. No se afirma una causa corregida que no se ha demostrado.
- Verificación posterior por SELECT en la base dedicada: cero Farmacias/Ayuntamientos/Medicamentos TEST-LECTURAS-%, cero esquemas test_lecturas_% y cero operaciones restantes. Limpieza por IDs propios/cascadas, sin borrar datos ajenos. Sintaxis de ocho JS comprobada; diff revisado y git diff --check correcto, incluidos los seis archivos nuevos mediante git diff --no-index --check.
- Documentación alineada en spec/plan/tasks, ambos modelos, guía canónica v12, db README y MEMORY. Sin dependencias nuevas ni acciones Git de modificación. Interfaz, lector, eliminación, totales, precios, cierre/cobros/reapertura no implementados. Futuro cierre y SQL municipal deben respetar el protocolo común; no se introduce trigger para proteger cambios que lo omitan.

## Evidencia de consultas, totales y eliminación backend

- Rutas GET precintos/incidencias/resumen y DELETE de ambos tipos en las capas existentes lectura.*; contrato §18. Listas históricas ordenadas/separadas, sin descripción del catálogo ni datos bancarios; una sentencia por consulta y resumen con agregados independientes, NUMERIC/TEXT exacto y snapshot coherente. Declarados NULL/cero y diferencias positivas/negativas verificados.
- Política aprobada expresamente por el usuario mediante respuesta a la pregunta de este bloque: conservar solo entrega/UUID/marcador de retirada sin contenido. Se purgan solicitud y ambos IDs de lectura en la transacción de borrado; ID técnico conservado, sin código/precio/motivo/decisión/fecha. POST tardío 409 OPERACION_RETIRADA, GET 410; operaciones activas recuperan posición vigente. Sin purga automática ni liberación de claves retiradas. Se sustituye la propuesta previa de cascada que permitía recreación tardía; ninguna prueba de esta política se implementó antes de su aprobación.
- DELETE bajo Ayuntamiento→Farmacia revalidada→Periodo→Entrega FOR UPDATE, comprobación financiera posterior READ COMMITTED y pertenencia por ID/entrega. Purga/borrado/renumeración atomizados; restantes del mismo paquete actualizados en orden ascendente a 1…N sin colisiones con UNIQUE ni cambios de IDs/precios/otros paquetes. Incidencias no alteran posiciones; vacío desaparece y nuevo número usa MAX conservado+1 o 1.
- 004 preparada, aplicada y repetida/verificada en gestion_facturacion_medicamentos y gestion_facturacion_medicamentos_test, configuración local/current_database() inequívocos. Ambas con 0 entregas/precintos/incidencias/operaciones antes; 0 precintos/incidencias/operaciones después. No se recrea base ni ejecuta esquema inicial sobre instalaciones existentes. Desarrollo solo recibe DDL aprobado; fixtures exclusivamente en base dedicada. Recibos previos preservados en pruebas de migración con rollback; otros destinos no explorados.
- test/entregas-consultas.test.js: 22 pruebas nuevas de consultas/exactitud/borrado/retirada, con inicial-intermedio-final, paquetes vaciados, IDs, precios históricos, pertenencia, bloqueo financiero, rollback y concurrencia. Conexiones independientes y pg_blocking_pids/vi.waitFor, sin sleeps: resumen antes/después de commit, guardado/borrado en ambos órdenes, dos borrados del mismo paquete y cierre simulado en ambos órdenes. Repetición activa comprueba posición actual y retirada no recrea contenido.
- test/claves-retiradas-migracion.test.js: 5 pruebas nuevas con esquema ficticio propio/rollback. Preserva recibos activos, prueba purga/CHECK y definición equivalente de instalación nueva; rechaza versión previa incompatible, pérdida de unicidad y columna inesperada. Prueba de nueva instalación en lecturas-migracion.test.js adaptada al verificador 004; restantes pruebas de 003 conservadas como comprobación histórica de esa migración.
- Dirigidas finales: 181 aprobadas en 7 archivos. Suite completa: 746 aprobadas en 27 archivos. Primer pase dirigido: aserciones del borrado correctas pero 8 cleanup fallidos por claves retiradas que ya no desaparecen en cascada. Cleanup adaptado a eliminar operaciones solo de IDs de entregas ficticias propias; restos de 8 farmacias ficticias de esta ejecución limpiados transaccionalmente en test, sin datos ajenos. Repetición dirigida y suite completa correctas.
- SELECT posterior en base dedicada: cero fixtures TEST-CONSULTAS-% de Farmacia/Ayuntamiento/Medicamento, cero esquemas test_retired_%/test_lecturas_%, cero operaciones (incluidas retiradas), precintos e incidencias. Sintaxis de siete JS correcta, diff revisado y git diff --check correcto; tres archivos nuevos también con git diff --no-index --check.
- Contratos/plan/tasks/MEMORY, ambos modelos, guía v13 y db README actualizados. Sin dependencias nuevas, acciones Git de modificación, interfaz, lector físico, cambios de precios ni módulo financiero. Futuro cierre/SQL municipal siguen obligados al protocolo común; no se afirma protección frente a SQL directo que lo omita.
