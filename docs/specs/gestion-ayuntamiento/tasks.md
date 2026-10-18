# Tareas: gestión de medicamentos y farmacias del Ayuntamiento

Bloques implementados el 6 de octubre de 2026: compatibilidad con farmacias sin Ayuntamiento y API de asignación/reasignación/retirada. Consulta y búsqueda municipal de Farmacias también implementadas. Ficha de Farmacias implementada; API e interfaz de medicamentos implementadas. La evidencia de cada tarea completada se indica abajo.

## Prerrequisitos documentales y de esquema

- [x] Actualizar la guía TFM canónica: reemplazar la asignación permanente por la regla confirmada de asignar/reasignar/quitar solo sin entregas ni precintos; documentar el selector dependiente Ayuntamiento → Farmacia en el futuro registro. Evidencia: guía vigente y alineación documental previa.
- [x] Actualizar el modelo conceptual FARMACIA y las reglas de integridad: permitir sin asignación, permitir corregir antes de actividad, conservar el maestro y no crear historial de asignación. Evidencia: modelo y diagrama canónicos.
- [x] Actualizar el modelo lógico: `farmacia.ayuntamiento_id` nullable y reglas de consulta/relaciones por `farmacia.id`. Evidencia: modelo lógico §4.2 y reglas globales.
- [x] Aprobar y modificar el esquema PostgreSQL para permitir NULL en `farmacia.ayuntamiento_id`; sin backfill. Evidencia: `db/schema.sql`, actualización `db/updates/001-farmacia-ayuntamiento-opcional.sql` y pruebas de conservación de filas/FK/índice y esquema nuevo en `test/farmacias.test.js`. Solo se aplicó a la base de pruebas; el procedimiento para otras instalaciones está en `db/README.md`.
- [x] Revisar validaciones y adaptar consultas, interfaz y pruebas del CRUD Farmacias para leer/editar un maestro sin asignación. Evidencia: LEFT JOIN, presentación «Sin Ayuntamiento» y 23 pruebas de Farmacias aprobadas. Se conserva POST con Ayuntamiento obligatorio y PUT sin `ayuntamiento_id`; se probó su rechazo también con entrega vacía o precinto, sin habilitar mutaciones de asignación.
- [x] Implementar transacción de asignación/quitar con FOR UPDATE y documentar el protocolo FOR SHARE/validación para el futuro registro. Evidencia: servicio transaccional y cinco pruebas de concurrencia PostgreSQL. La implementación del módulo de entregas sigue pendiente.
- [x] Implementar la ficha del Ayuntamiento con los apartados «Medicamentos admitidos» y «Farmacias asociadas», reutilizando componentes y estilos existentes.
- [x] Implementar el contrato API definido en `spec.md §11`, incluyendo búsqueda validada, consultas de listas, asociaciones/retiradas y estados/mensajes para inválidos, inexistentes, duplicados y bloqueos por actividad.
- [x] Asegurar que la búsqueda/lista de Farmacias entrega solo los últimos cuatro dígitos de la cuenta (`•••• 1234`) o `null`; no enviar cuenta completa a esta vista.

## Implementación pendiente tras las decisiones

- [x] Implementar búsqueda de medicamento por código nacional/descripción y modos exacto, prefijo y contiene. Evidencia: seis combinaciones, orden, literales y validación en pruebas reales.
- [x] Mostrar detalle actual de medicamento y lista específica con `codigo_nacional`, `descripcion`, `situacion_comercial` y `estado` general en campos separados.
- [x] Añadir API de asociación existente con mensaje de duplicado; impedir duplicado concurrente mediante UNIQUE/ON CONFLICT. Evidencia: tres pruebas concurrentes reales. Acción UI implementada; evidencia del bloque de interfaz abajo.
- [x] Implementar DELETE que quita únicamente la asociación, conserva maestro y lecturas aceptadas. Evidencia: pruebas de retirada, otra pareja y snapshot de precinto/precio conservados.
- [x] Implementar confirmación/cancelación identificable de retirada de Medicamentos en UI.
- [x] Implementar API de listado asociado y búsqueda de todas las farmacias por SOE o denominación, los tres modos, orden y proyección segura. Evidencia: 41 pruebas de consulta PostgreSQL, incluidas asignaciones NULL/otras, caracteres especiales y ausencia de datos bancarios completos. La visualización UI de Farmacias está implementada; evidencia en las tareas de interfaz.
- [x] Implementar POST de asignación/reasignación solo sin entregas/precintos, comprobando origen esperado bajo bloqueo. Evidencia: pruebas de asignación desde NULL, cambio de origen, duplicado, bloqueo y conservación del maestro.
- [x] Implementar confirmación UI de Ayuntamiento actual/nuevo antes de llamar al POST. Evidencia: pruebas de selección, origen NULL/otro Ayuntamiento, confirmación/cancelación.
- [x] Informar mediante 409 de asociación duplicada sin modificar registros, incluso con actividad. Evidencia: pruebas API de duplicado y entrega/precinto/incidencia.
- [x] Implementar DELETE que valida pertenencia al Ayuntamiento, comprueba actividad, deja NULL y conserva el maestro. Evidencia: retirada con 204 sin cuerpo, asociación incorrecta con 404 y bloqueo con 409.
- [x] Implementar confirmación/cancelación UI de retirada conservando maestro. Evidencia: módulo y revisión visual.
- [x] Añadir acción «Ficha» al listado, sin operaciones de edición de Farmacias desde el apartado. Evidencia: prueba de entrada y regresiones CRUD.

## Verificación pendiente

Evidencia actual: `test/ayuntamiento-farmacias.test.js` tiene 36 pruebas aprobadas; suite completa de 279 pruebas en 13 archivos contra `gestion_facturacion_medicamentos_test`. Incluye validación, inexistentes, origen desactualizado, maestros y actividad conservados, proyección bancaria segura, rechazo del PUT general y cinco casos de concurrencia real. La consulta y búsqueda de Farmacias añade 41 pruebas aprobadas; suite actual completa: 320 pruebas en 14 archivos. La UI de Farmacias está implementada y probada (suite actual: 354 pruebas en 15 archivos). La API de Medicamentos está implementada; su interfaz está implementada; registro de entregas pendiente.

- [x] Comprobar sintaxis con `node --check` en los seis JS nuevos/modificados; revisar diff/status y `git diff --check`, incluidos archivos sin seguimiento.
- [x] Verificar datos inválidos/inexistentes, duplicado, retirada desde otro Ayuntamiento, origen desactualizado y ausencia de cambios tras rechazos.
- [x] Verificar que la respuesta POST entrega solo cuenta enmascarada y nunca componentes bancarios completos. La proyección compartida de búsqueda/listado municipal se verificó en las 41 pruebas nuevas.

- [x] Añadir pruebas de integración de búsqueda, orden, asociaciones repetidas, retirada/cancelación y conservación de maestros.
- [x] Añadir pruebas API de búsqueda/IDs/cuerpos inválidos, recursos inexistentes y duplicados de Medicamentos. Estados y propiedad `{error}` verificados; el bloqueo por actividad corresponde solo a Farmacias y está probado en su bloque.
- [x] Probar que en modalidad `GENERAL` se conservan y muestran asociaciones específicas con el aviso acordado, que se identifican como no aplicables y que al volver a `ESPECIFICA` la interfaz muestra su aplicación junto con los requisitos generales. La validación efectiva al registrar precintos queda pendiente.
- [x] Añadir pruebas UI de mensajes accesibles, renderizado seguro, lista vacía/error y enmascaramiento de cuenta.
- [x] Verificar que las respuestas de Farmacias destinadas a la ficha contienen solo `cuenta_bancaria_enmascarada` y no contienen cuenta bancaria ni componentes bancarios completos.
- [ ] Al abordar precintos, comprobar qué información conserva el modelo vigente sobre admisión y precio aplicado, sin añadir historial de listas/tablas ni inventar campos; mantener los requisitos existentes de conservación de facturaciones cerradas.
- [x] Probar bloqueo por entrega vacía, precinto e incidencia; confirmar conservación íntegra de maestros y filas operativas tras rechazos. Evidencia: snapshots de filas antes/después en pruebas reales.
- [x] No comprobar facturación como condición independiente. Evidencia: consultas de actividad solo sobre entregas/precintos y prueba de reasignación con factura municipal que se conserva.
- [x] Probar concurrencia entre actividad y mutaciones, así como dos reasignaciones de mismo origen. Evidencia: conexiones PostgreSQL independientes y espera observada con `pg_blocking_pids()`. El caso de FK sola también prueba su límite; módulo de entregas futuro pendiente.
- [x] Ejecutar suite completa y `git diff --check` tras la implementación; comprobar que no se expone cuenta bancaria completa.
- [ ] Documentar para el futuro módulo financiero la trazabilidad directa de facturación por Farmacia, sin añadir un control de facturación a esta operación de asignación.
- [ ] Implementar para entregas la selección en dos pasos (Ayuntamiento, después farmacia asociada) y validar en servidor que el `farmacia.id` pertenece al Ayuntamiento elegido y no está sin asignación.

## Evidencia del bloque de consulta (6 de octubre de 2026)

- [x] Validar Ayuntamiento, campos/modos/término, límite de 200 caracteres, vacíos, parámetros extra/repetidos y caracteres literales. Evidencia: `test/ayuntamiento-farmacias-consulta.test.js`, 41 pruebas reales.
- [x] Verificar orden, listas vacías, catálogo completo y uso del origen observado en POST/DELETE; mantener el CRUD general y las mutaciones existentes. Evidencia: 89 pruebas dirigidas aprobadas.
- [x] Ejecutar suite completa: 320 pruebas en 14 archivos aprobadas contra `gestion_facturacion_medicamentos_test`; sintaxis correcta con `node --check` en los cinco JS afectados.

La integración/API y la interfaz de ambos apartados están acreditadas por los bloques de evidencia.

Verificación documental del bloque de consulta: `git diff --check` y comprobación de archivos sin seguimiento sin errores de espacios.

## Bloque de interfaz de Farmacias

Apartado disponible desde «Ficha» en el listado. Evidencia: 34 pruebas añadidas de módulo/cliente/entrada/recursos y revisión visual separada con API ficticia a 1280 y 375 px; detalles y límites en `../interfaz-gestion-ayuntamiento/tasks.md`. La ficha y UI de Medicamentos se completaron en el bloque posterior documentado abajo. No se cambia modelo, esquema ni reglas de negocio.

## Evidencia del bloque API de Medicamentos

- [x] GET municipal y POST proyectan relación, datos maestros actuales y aviso/aplicabilidad por modalidad. Sin asociaciones devuelve []; GET existente del Ayuntamiento mantiene la modalidad.
- [x] Verificar mantenimiento sin restricciones inventadas por INACTIVO/BAJA; estados independientes y cambio de modalidad sin borrar parejas. La validación de precintos no está implementada.
- [x] Verificar DELETE 204, asociación ausente 404, maestros inexistentes 404 y duplicado 409; preservar catálogo, otras asociaciones y precinto aceptado.
- [x] Comprobar concurrencia con PostgreSQL y esperas reales: dos altas, conflicto confirmado y conflicto revertido. Sin mocks de base de datos.
- [x] 58 pruebas nuevas, suite completa de 412 pruebas en 16 archivos aprobada contra `gestion_facturacion_medicamentos_test`; cleanup limitado a fixtures propios. Sin actualización SQL.

Integración, modalidad visible y detalle/confirmaciones de Medicamentos completados en el bloque de interfaz posterior. El usuario comprobó manualmente Farmacias asociadas y confirmó que funciona (confirmación recibida en esta tarea).

- [x] Revisar diff/status, sintaxis con `node --check` en los 11 JS nuevos/modificados y `git diff --check`, incluidos archivos sin seguimiento: sin errores. No se realizaron operaciones de Git de escritura.

## Evidencia de interfaz de Medicamentos (6 de octubre de 2026)

- [x] Ficha con ambos apartados; búsqueda por los dos campos y tres modos, orden API, incorporación de INACTIVO/BAJA, duplicados y retirada confirmable conservando el catálogo. Columnas comerciales y generales separadas; asociar no significa ser facturable.
- [x] Modalidad consultada incluso con lista vacía; aviso GENERAL exacto y condiciones ESPECIFICA visibles. «Editar Ayuntamiento / modalidad» reutiliza el formulario/PUT existentes y vuelve a la ficha al guardar/cancelar. Las asociaciones se conservan. La validación de autorización al registrar precintos sigue pendiente; no se acredita por estas pruebas de presentación.
- [x] Carga, vacíos, errores API, mensajes status/alert y texto seguro. Generaciones por consulta/contexto descartan respuestas y errores antiguos; las mutaciones bloquean envíos y ambos apartados durante el refresco. Utilidades de mensajes/celdas/validación y CSS compartidos con Farmacias.
- [x] 34 pruebas añadidas: 26 del módulo con API simulada, seis del cliente, una de integración de ficha/edición y una de recursos servidos por Express. Suite completa: **446 pruebas en 17 archivos aprobadas**, incluidas API/PostgreSQL y regresiones CRUD/Farmacias. Las pruebas de interfaz usan DOM y API simulados; no son pruebas de navegador contra la API real.
- [x] Comprobación visual separada en navegador con API real y PostgreSQL dedicado a pruebas, a 1280×900 y 375×812: GENERAL vacío, búsqueda por descripción/contiene, asociación INACTIVO/BAJA, duplicado, cambio a ESPECIFICA conservando la asociación, retirada cancelada y confirmada, lista específica vacía sin inferir GENERAL y catálogo conservado al volver a buscar. Farmacias permanece visible con cuenta enmascarada. En móvil, controles apilados, confirmación legible y tablas con scroll propio; ancho de página 360 px dentro de viewport 375 px. No se verificaron visualmente todos los errores ni respuestas antiguas; sí tienen pruebas automatizadas. Lector de pantalla pendiente.
- [x] Datos ficticios propios limpiados: Ayuntamiento 2359, farmacia 900 y medicamentos 393/394, ausencia verificada; servidor temporal cerrado. No se modificó esquema, modelo, backend ni reglas de negocio.

Comprobación manual: arrancar con una base compatible, abrir /ayuntamientos.html → «Ficha» → buscar medicamento por campo/modo → «Añadir». Comprobar estados separados y duplicado, editar modalidad mediante el formulario existente y volver a la ficha. Pulsar «Quitar», cancelar y después confirmar; el medicamento debe seguir disponible en búsqueda. Repetir a anchura móvil usando el scroll de las tablas y comprobar Farmacias asociadas.

- [x] Controles finales: `node --check` correcto en los nueve JS de este bloque; revisión de cambios y `git diff --check`, incluidos archivos sin seguimiento, sin errores de espacios. Sin staging, commit, push ni cambio de rama.

Mejora de usabilidad completada sin cambios de reglas/API: vistas excluyentes, búsqueda progresiva y selección/acción fuera de fila. Evidencia actual (453 pruebas y revisión visual real a 1280/375 px) en ../interfaz-gestion-ayuntamiento/tasks.md.

## Alineación tras revisión previa al commit (7 de octubre de 2026)

- [x] Corregidas referencias obsoletas del modelo conceptual y de las especificaciones funcionales: esquema del repositorio nullable e interfaces municipales implementadas. Bases existentes todavía sin actualizar requieren script 001; no se afirma que todas estén migradas. Referencias relacionadas de Farmacias alineadas, sin cambiar requisitos ni contratos.
- [x] Comprobada correspondencia con `db/schema.sql`, script 001, modelo lógico y módulos municipales actuales. Corrección del bloqueo de estado y sus pruebas en `../interfaz-ayuntamientos/tasks.md`: suite completa 467/17 aprobada. No hay modificación SQL, de backend ni de reglas de negocio en esta tarea.
