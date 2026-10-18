# Plan técnico: Entregas y precintos

Estado vigente: creación/recuperación, declarados, evaluación y guardado de lecturas, consultas/resumen, eliminación de lecturas, corrección individual de precio y sus interfaces están implementados. La facturación municipal, cobros y liquidaciones se desarrollan en `../facturacion-municipal/`; no son trabajo pendiente de este módulo. La comprobación con hardware lector físico sigue pendiente.

## Corrección individual — plan vigente del 12 de octubre de 2026

1. Sustituir regla agrupada/preparación obligatoria por la decisión individual del usuario; alinear guía v26, modelos y especificaciones. Conservar migración 005.
2. Cambiar ruta PUT a precinto por ID/entrega y aceptar solo precio_aplicado. Guardar únicamente esa fila, con referencia intacta, bajo el protocolo municipal actual. Permitir ausencia de cabecera y revisión/reapertura sin cobros; bloquear emitida/cobros y revalidar tras esperar.
3. Recalcular participación solo si existe, sin crear cabeceras/participaciones; devolver lectura y subtotal NUMERIC. Mantener documentos originales hasta reemisión.
4. Formulario individual, nueva última fila resaltada/visible mediante scroll de tabla y total actualizado. Bloquear también entrada de nuevas lecturas en emitida/cobros.
5. Adaptar integración/interfaz para individualidad, ausencia de preparación, maestro/futuras lecturas, totales, cierre/reapertura/cobros y concurrencia con preparación inicial/emisión; ejecutar dirigidas y suite.

## Estado y límites

Adaptación de esquema y fixtures realizada mediante 002, verificada en las bases local y dedicada de pruebas; evidencias en `tasks.md`. API de creación/recuperación, snapshots, declarados, evaluación y guardado con clave persistente implementados (§17); consultas/totales/eliminación implementados (§18); interfaz de lectura implementada y detallada en `../interfaz-entregas-precintos/`. JavaScript, Express, PostgreSQL/`pg`, validación existente y patrones del repositorio, sin nuevas tecnologías ni infraestructura. La API mantiene la protección municipal de Farmacia y añade el bloqueo común de Ayuntamiento para escrituras según spec §15.

## Bloque 1. Ajustes del esquema y alineación documental

1. Verificar tabla de entregas vacía/ocupada en cada base antes de diseñar su actualización; la confirmación de base local vacía es antecedente, no verificación futura.
2. Aplicar la migración incremental 002 (sin recrear base) para snapshots históricos `denominacion_farmacia` y `cif_nif_farmacia` obligatorios, y restricciones de motivos de incidencia. Si faltan los snapshots y existen filas, abortar sin cambios; no rellenar desde el maestro actual ni eliminar filas.
3. Revisar protección de una operación repetida y el estado incierto sin deduplicar códigos nacionales; no inventar mecanismo hasta análisis concreto.
4. Alinear documentación canónica/modelos/especificaciones y diagrama si se encuentra fuente. Revisar fixtures de entregas en pruebas para los campos obligatorios.
5. Comprobar esquema/migración: preservación de filas, FK/UNIQUE/checks y snapshots. Pruebas afectadas y suite completa ejecutadas; aborto con entrega sin snapshots y repetición sobre esquema actualizado comprobados. Consultar resultados reales en `tasks.md`.

## Bloque 2. Crear/recuperar entrega y editar declarados

1. El usuario selecciona periodo y farmacia; el sistema obtiene y muestra su Ayuntamiento asociado. No se requiere seleccionar el Ayuntamiento previamente. Validar en el servidor que la asociación municipal sigue siendo válida.
2. En creación, coordinar con cambios de asignación mediante protocolo compartido; copiar denominación/CIF actuales a snapshot.
3. Recuperar entrega única por farmacia-periodo; no sobrescribir snapshots.
4. Editar cantidad/importe declarados mientras sea editable, sin mutar lecturas/precios. Salir no cierra facturación.
5. Pruebas unitarias/API/PG: unicidad, recuperación, snapshot estable ante edición de Farmacia, Ayuntamiento faltante/incorrecto y carrera con cambio de asignación.

Creación/recuperación y declarados implementados en `src/entregas/entrega.{routes,controller,validation,service,repository}.js`, registradas en `src/app.js`; contratos en spec §14–§15. POST que encuentra entrega la devuelve sin escribir ni verificar editabilidad; si no existe, prepara una escritura. GET conserva su protocolo de consulta. PUT reemplaza exclusivamente ambos declarados, exige los dos campos y rechaza propiedades adicionales. El INSERT conserva UNIQUE con `ON CONFLICT DO NOTHING`, seguido de una consulta separada READ COMMITTED para ver una creación concurrente confirmada. El servicio revierte rechazos/errores y libera el cliente en finally.

**Orden contrastado con código municipal:** `cambiarAsignacionFarmacia` adquiere Ayuntamiento destino `FOR KEY SHARE` y después Farmacia `FOR UPDATE`; DELETE toma el Ayuntamiento del que retira. Entregas no puede adquirir Ayuntamiento reteniendo antes un lock de Farmacia: podría cerrar un ciclo con DELETE que ya retiene el Ayuntamiento. Por eso las escrituras leen primero sin lock y luego adquieren Ayuntamiento `FOR UPDATE`, Farmacia `FOR SHARE` (revalidando asociación), Periodo `FOR KEY SHARE` y Entrega `FOR UPDATE` al editar. Si cambió la asociación se rechaza con 409 y rollback; no se encadenan locks de Ayuntamientos distintos. La consulta GET no adquiere el lock municipal y el POST de recuperación existente solo lee. En creación se vuelve a buscar la pareja bajo los locks; si otra petición la creó, se devuelve sin sobrescribirla.

**Control vigente:** tras el lock municipal se consulta estado/cobros de facturación Ayuntamiento/periodo/TD. Sin cabecera, REVISION y REABIERTA sin cobros permiten; EMITIDA o cualquier cobro bloquean escrituras con 409. No se exige preparar revisión para lecturas/precios. La reapertura está implementada en backend con fecha/motivo y ausencia de cobros, conservando B; el historial no habilita por sí solo. Emisión/reapertura/cobro comparten el protocolo municipal, sin protección frente a SQL directo que lo omita. SIN_FACTURAR es derivado y PERIODO no tiene estado propio. El criterio anterior por mera existencia de cabecera queda sustituido por spec municipal §13.

Pruebas con conexiones independientes observan bloqueos mediante `pg_blocking_pids()`. Un cierre simulado es únicamente un fixture: inserta la facturación aplicable bajo el bloqueo común, sin implementar cálculos ni generación de facturas. Se prueban ambos órdenes: cierre primero rechaza la escritura tras commit; escritura primero hace esperar al cierre, que lee su resultado confirmado y bloquea nuevas escrituras después.

## Bloque 3. Validar, admitir e incidencias

Guardado backend implementado en `lectura.{repository,service,controller}.js`, registrado en las rutas de Entregas y con validación estricta compartida. POST lecturas y GET operación según spec §17. Transacción READ COMMITTED, protocolo existente de `prepararEscritura` reutilizado, Entrega FOR UPDATE para serializar posiciones y repetición, relectura de operación antes de editabilidad, medicamento FOR SHARE y evaluación coherente. El bloqueo municipal coordina listas/asignación; se revisaron sus órdenes reales y el CRUD de catálogo. Sin tabla PAQUETE ni contador. Operación persistida con petición normalizada y FK a exactamente una lectura; retirada/purga aprobada en §18 conserva solo la clave sin contenido y evita repetición tardía. 003 conserva registros anteriores sin claves inventadas; ver estado y evidencias en tasks/db README. Consultas/eliminación/totales incorporados después (§18); interfaz y módulo financiero pendientes.

Evaluación informativa implementada mediante POST `/entregas/:id/evaluacion` en las capas existentes de Entregas. Validación estricta de ID/cuerpo y reutilización de `interpretarCodigoPrecinto` y `evaluarAdmisionMedicamento`. El repositorio obtiene contexto y medicamento en un SELECT parametrizado sin locks exclusivos; el servicio proyecta únicamente los campos del contrato puro y devuelve los seis campos mínimos del medicamento, con precio en cadena o medicamento NULL. No consulta editabilidad ni escribe: disponible con facturación existente. Consulta actual sin reserva; futuro guardado debe revalidar autorización/precio/editabilidad. Contrato detallado en spec, apartado de evaluación informativa.

1. Interpretación implementada en `src/entregas/precinto.validation.js` como función pura sin dependencias ni acceso a datos; seis dígitos manuales o trece con prefijo 847000 y extracción mediante slice(6, 12). Tipo/formato inválido lanza TypeError; sin trim ni caracteres adicionales. El último dígito se conserva sin validar control EAN-13. Integrada en evaluación/guardado; evento lector pendiente.
2. Aplicar GENERAL/ESPECIFICA y TD; validar autorización general, específica, estado y situación en una operación coherente.
3. Admitir ALTA elegible; INACTIVO siempre incidencia; BAJA elegible requiere decisión explícita aceptar/apartar. Decisión aprobada: no añadir marca histórica de aceptación BAJA al MVP. Evidencia adicional como mejora futura, sin bloquear implementación; no se implementa la elección en el bloque de interpretación.
4. Guardar incidencia confirmada directamente en entrega, fuera de paquetes/sumas monetarias.
5. Guardar inmediatamente, sin reintentos automáticos; definir control de operación repetida y reconciliación incierta antes de envío repetido.
6. Pruebas unitarias/API de evaluación/guardado aprobadas; pendientes elección visual BAJA y pruebas de lector. Alcance: códigos inválidos, ceros iniciales, desconocido, autorización GENERAL/ESPECIFICA vacía, INACTIVO ALTA/BAJA, BAJA aceptar/apartar, cambios posteriores y códigos repetidos independientes.

## Bloque 4. Paquetes, correcciones y totales

Consultas/resumen y DELETE implementados en las capas `lectura.*` existentes y rutas de Entregas, sin nuevas dependencias. Una sentencia por consulta, agregados separados y NUMERIC/TEXT preservan coherencia/exactitud (§18). DELETE comparte protocolo municipal/Entrega FOR UPDATE con guardado y renumera ascendentemente solo el paquete afectado aprovechando el hueco libre, sin tocar UNIQUE. Política aprobada: conservar clave retirada sin contenido; actualización 004 permite NULL en solicitud y CHECK activo/retirada, con purga antes de eliminar en la misma transacción. Repetición tardía 409, GET retirada 410. Sustituye la propuesta inicial de cascada que liberaba claves; no se introduce historial del contenido borrado. Aplicación/evidencias en db README/tasks. Interfaz implementada; verificación con hardware lector físico pendiente.

1. Guardar el precinto 15 completa el paquete sin crear otro. El siguiente precinto admitido materializa el siguiente paquete automáticamente si el anterior está completo, o tras decisión expresa si está incompleto. Numerar por mayor existente + 1 (o 1) y materializar solo al insertar el precinto; incidencias no crean paquetes.
2. Borrar lectura errónea mientras editable; renumerar posiciones solo en paquete afectado, quitar paquete vacío, preservar IDs y otros paquetes.
3. Conservar `precio_aplicado`; no actualizar automáticamente lecturas por cambio de catálogo.
4. Calcular admitidos, subtotal, incidencias, total y diferencias; ninguna diferencia bloquea por sí sola.
5. Pruebas de límite 15, inicio manual, recuperación, numeración MAX+1, borrado/renumeración/vacío, precio snapshot y exactitud de totales.

## Bloque 5. Interfaz y comprobación con lector

1. Separar selección de entrega y espacio de lectura conforme a convenciones existentes, sin decidir ahora una maqueta detallada.
2. Proporcionar entrada escáner/manual, resumen y teclado; estados accesibles de guardado, error, BAJA e incidencia; foco tras guardado.
3. Probar con lector físico el evento de finalización. Concretar y probar qué pasa con escaneos durante guardado y respuesta perdida antes de repetir.
4. Pruebas UI y manuales de teclado, mensajes, foco, lectura consecutiva, avisos, paquetes/incidencias con contexto y adaptación móvil sin scroll de página.

## Dependencias y límites

La adaptación de esquema y fixtures y las pruebas de integración están completadas. La resolución de incidencias y la actualización/importación automática de precios no forman parte del MVP. Facturación, cobros, liquidaciones y reapertura están implementados en el módulo financiero; la corrección individual vigente está implementada y los planes agrupados anteriores se conservan únicamente como histórico.
