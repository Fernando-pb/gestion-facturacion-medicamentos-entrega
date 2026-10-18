# Especificación funcional: Entregas y precintos

## 1. Objetivo y alcance

Definir la entrega mensual de una farmacia, el registro asistido de precintos, sus incidencias, paquetes y correcciones. Esta especificación incorpora las reglas aprobadas el 8 de octubre de 2026 y sustituye, para este módulo, las reglas anteriores incompatibles de la guía canónica y los modelos. La adaptación del esquema está aplicada en las dos bases verificadas (§11). Creación/recuperación, snapshots, declarados, evaluación y guardado de lecturas con protección persistente implementados (§14–§17); consultas/totales/eliminación y lector/interfaz implementados (§18 y especificación de interfaz). 003 aplicado en las bases verificadas según db README.

Incluye creación/recuperación de entrega, edición de datos declarados mientras la facturación sea editable, validación/admisión, incidencias, paquetes, correcciones, totales, requisitos de interfaz y pruebas futuras. Excluye cierre de facturación, resolución/reincorporación de incidencias, actualización/importación automática de precios y procesos financieros.

Actualización de editabilidad (11 de octubre de 2026): `facturacion.estado` distingue REVISION, EMITIDA y REABIERTA, según facturación municipal spec §13. Creación de entrega, declarados, guardado y borrado de lecturas se permiten en revisión y reapertura sin cobros; se bloquean en emitida o si existe cualquier cobro. Esta regla sustituye la ausencia provisional de facturación descrita históricamente en §15–§18. Un registro histórico en `reapertura_facturacion` por sí solo no abre nada: manda el estado actual. B permanece congelado después de emitir, también durante reapertura. Consultas y recuperación de operaciones completadas conservan su comportamiento.

## Corrección individual de precio — regla vigente del 12 de octubre de 2026

Decisión explícita del usuario: cada precinto conserva su propio aplicado. Esta regla sustituye la corrección por código/farmacia/facturación y el requisito de preparar revisión que se documentaron previamente el mismo día. Corregir cambia solamente el precio aplicado del ID de precinto seleccionado, dentro de su entrega. Conserva referencia, maestro, todas las demás lecturas (también códigos repetidos), IDs, posiciones y declarados.

El estado se obtiene de la facturación del Ayuntamiento/periodo/TD de la entrega, sin deducirlo de conteos ni de etiquetas del listado. Ausencia de cabecera = SIN_FACTURAR: permite nuevas lecturas y corrección sin preparar revisión. REVISION aún no está facturada y también permite ambas. EMITIDA bloquea ambas hasta la reapertura controlada. REABIERTA sin cobros vuelve a permitirlas. Cualquier cobro de cualquiera de las dos facturas bloquea corrección, nuevas lecturas y reapertura, incluso con estado incoherente. El historial de reapertura no sustituye el estado actual. B y números oficiales siguen congelados tras emitir.

GET /entregas/:id/precios devuelve facturacion_id, estado real (NULL si no existe), estado_entrega derivado (SIN_FACTURAR/REVISION/EMITIDA/REABIERTA), participacion_id, tiene_cobros, permite_correccion y motivo_bloqueo. PUT /entregas/:id/precintos/:lecturaId/precio recibe únicamente { precio_aplicado }, cadena decimal con punto, no negativa, hasta diez cifras enteras y dos decimales, sin redondeo ni query. IDs positivos y pertenencia a la entrega validados en servidor. La ruta anterior por código nacional se retira; no se mantiene una operación de actualización por grupo. 200 devuelve entrega/facturación, lectura completa con ambos precios, lecturas_actualizadas: 1, subtotal_facturable exacto e importe_precintos de participación (NULL si no existe). 400 entrada inválida, 404 entrega/precinto ausentes o ajenos, 409 estado/cobros/identidad o desbordamiento.

Transacción READ COMMITTED: observar entrega → Ayuntamiento FOR UPDATE → Farmacia FOR SHARE/asociación revalidada → Periodo FOR KEY SHARE → Entrega FOR UPDATE/identidad revalidada → bloquear facturación si existe → consultar estado/cobros actuales → UPDATE por entrega_id e id de precinto → recalcular participación existente y resumen mediante NUMERIC → COMMIT. Sin cabecera/participación no crea ninguna. Las condiciones se revalidan después de esperar; comparte el bloqueo municipal con preparación, emisión, reapertura y cobro. Error/desbordamiento revierte toda la corrección. El guardado de nuevas lecturas conserva su protocolo actual.

Cada nueva lectura toma el maestro vigente al admitir bajo el bloqueo de Medicamento y captura referencia/aplicado iguales. Modificar el maestro no cambia lecturas previas; corregir un precinto no fija un precio para lecturas futuras. Tras guardar, se recalcula/muestra el total de entrega. Orden por paquete/posición conservado; nuevas admisiones quedan al final según el asignador actual, sin nuevos contadores ni cambios de almacenamiento. La UI resalta y desplaza solo la tabla hasta la fila confirmada y su precio, manteniendo el foco del lector.

Si existe participación, la corrección recalcula su suma en la misma transacción sin alterar B. En REABIERTA, documentos originales permanecen hasta reemisión conjunta según facturación municipal §14, conservando números, IDs y porcentajes históricos; no se incorporan participaciones nuevas desde la API de precios.

La adaptación 005 permanece intacta: precio_referencia NUMERIC(12,2) NOT NULL, CHECK no negativo y sin DEFAULT. En registros anteriores representa el aplicado conservado al migrar, sin garantía de coincidencia con catálogo original. El backfill aprobado no modifica aplicado ni reemplaza referencias existentes. Correcciones individuales posteriores conservan referencia; consultas y recuperación de UUID devuelven ambos valores vigentes sin deshacer una corrección.

### Matriz vigente de editabilidad

| Facturación Ayuntamiento/periodo/TD | Cobros en cualquiera de las dos facturas | Añadir lecturas / corregir un precio individual |
|---|---|---|
| Sin cabecera (SIN_FACTURAR, estado derivado) | No existen facturas de ese proceso | Permitido, sin preparar revisión |
| REVISION | Ninguno | Permitido |
| EMITIDA | Ninguno | Bloqueado hasta reapertura controlada |
| REABIERTA | Ninguno | Permitido |
| Cualquier estado con cobro | Alguno | Bloqueado; tampoco se permite reabrir |

El servidor consulta estado y cobros después de adquirir los bloqueos compartidos con emisión, preparación, reapertura y cobro. El listado neutral de entregas no devuelve ese permiso; se obtiene del contexto financiero de la entrega. Un historial de reapertura no sustituye el estado actual. SIN_FACTURAR no es una columna ni un estado nuevo de FACTURACION o PERIODO.

### Trazabilidad y límites de auditoría

La referencia y el aplicado permiten distinguir el valor conservado y el valor final actual. No existe un historial de cada modificación individual ni campos de autor/fecha/motivo para ella; no atribuir al MVP esa auditoría. El registro de reapertura sí conserva fecha automática y motivo obligatorio. Los documentos originales se mantienen hasta reemisión conjunta; B, IDs, números y tasas históricas se conservan. La migración 005 se verifica con cobertura completa de referencias antes de habilitar correcciones; es transaccional e idempotente, solo rellena NULL y no modifica aplicado ni referencias existentes.

## 2. Fuentes y precedencia

Se contrastaron `AGENTS.md`, `MEMORY.md`, `docs/guia-contexto-tfm.md`, ambos modelos de `docs/modelo-datos/`, el diagrama mantenido y `db/schema.sql`, además de las especificaciones de Farmacias y gestión municipal. Las reglas de este documento reflejan decisiones aprobadas por el usuario. La guía canónica y los modelos contienen reglas históricas incompatibles; el apartado A.14 de la guía y las adendas de los modelos las identifican expresamente como sustituidas para este alcance. El diagrama disponible es PNG; no se encontró fuente editable.

## 3. Entrega y datos declarados

- Hay como máximo una entrega por farmacia y periodo mensual. La clave natural es `(farmacia_id, periodo_id)`.
- El periodo se elige por mes/año de imputación, no por fecha de recepción: bolsas recibidas en octubre pueden pertenecer a septiembre.
- El usuario selecciona periodo y farmacia. El sistema obtiene y muestra el Ayuntamiento asociado; no se exige seleccionar el Ayuntamiento previamente. El servidor comprueba la asociación municipal vigente conforme al protocolo existente. Una farmacia sin ayuntamiento no registra entregas.
- Al crear, el servidor copia `farmacia.denominacion` a `denominacion_farmacia` y `farmacia.cif_nif` a `cif_nif_farmacia`. Ambos snapshots son `TEXT NOT NULL`; continuar una entrega o editar el maestro no los reemplaza.
- Se conserva `farmacia_id` como relación estable.
- Identidad histórica: estos snapshots representan a quien figura en la entrega (A). No determinan al titular que debe figurar cuando el Colegio factura al Ayuntamiento (B) ni al destinatario de la liquidación (C). Para un mismo establecimiento/SOE puede darse A → B → C; cada operación financiera debe conservar su propia identidad y los cambios del catálogo no deben alterarla.
- Alcance: catálogo local de farmacias actuales, actualizado manualmente con datos ficticios. No incluye histórico de titulares, gestión de traspasos, integración con la aplicación corporativa ni resolución automática de titularidades anteriores. Los snapshots preservan lo capturado, pero no garantizan que el catálogo estuviera actualizado.
- En el esquema, `detalle_pago_farmacia` contiene un snapshot previsto de la identidad y datos bancarios usados para el pago; no equivale a la identidad participante en la factura municipal. La ampliación de facturación debe conservar la identidad correspondiente a cada participación y vincularla al cálculo derivado de las entregas, sin reutilizar el snapshot de entrega o pago. La ampliación de liquidaciones debe capturar el destinatario por separado. La especificación financiera vigente está en `docs/specs/facturacion-municipal/spec.md`.
- El informe anual operativo usa el periodo facturado y los precios aplicados de precintos aptos; es independiente de los datos del destinatario del pago y no tiene alcance fiscal.
- La cantidad e importe declarados por la farmacia son informativos y corregibles mientras la facturación esté editable. Su corrección no altera lecturas ni precios.
- Salir o terminar la sesión de lectura no cierra la facturación. La existencia de entrega vacía bloquea cambios de asignación municipal de acuerdo con el protocolo existente.
- El autor confirmó que la tabla de entregas de su base local está vacía. Antes de cualquier futura actualización de esa base deberá comprobarse otra vez; no recrear la base ni ejecutar SQL como parte de esta especificación.

## 4. Entrada, validación y guardado

- El campo compartido admite código de barras de 13 dígitos con prefijo `847000`; extrae los dígitos 7–12 (base 1). Ejemplo: `8470006772911` → `677291`.
- Interpretación implementada como función pura `interpretarCodigoPrecinto` en `src/entregas/precinto.validation.js`: solo texto con exactamente 6 dígitos ASCII o 13 dígitos ASCII y prefijo `847000`. Rechaza espacios exteriores/interiores, terminadores y caracteres adicionales; no hace trim, limpieza ni conversión numérica. Devuelve `{ codigo_barras_original, codigo_nacional }`; formato/tipo inválido lanza `TypeError`. No consulta medicamentos ni registra incidencias/lecturas; el evento del lector se tratará fuera de la función.
- También admite manualmente un código nacional de seis dígitos. Los códigos se tratan como texto para conservar ceros iniciales.
- Se conserva el contenido original leído o tecleado. Formato/prefijo distinto produce aviso y revisión; no se extrae arbitrariamente. La validación del dígito de control EAN-13 no está aprobada.
- Cada lectura representa un precinto. Códigos nacionales repetidos son registros independientes.
- El evento de finalización del lector inicia validación y guardado; el evento concreto se verificará con el dispositivo en implementación. Entrada manual se confirma con Enter.
- Cada admisión o incidencia confirmada se persiste inmediatamente. Tras confirmar guardado: actualizar lista/totales, conservar la nueva admisión al final por paquete/posición, resaltarla y desplazar la tabla hasta ella y su precio, limpiar entrada y devolver foco. Mientras guarda se muestra «Guardando…» y se bloquea doble envío.
- En error se conserva la entrada y se explica el problema. No hay reintentos automáticos. Sin respuesta no se puede inferir que no hubo guardado: consultar la clave conforme a §17; integración visual pendiente.
- No se aceptan nuevas decisiones de lectura mientras haya un aviso pendiente. No perder silenciosamente escaneos recibidos durante una operación; estrategia sencilla pendiente de concretar.
- Evitar duplicar una misma operación ante eventos repetidos, sin deduplicar por código nacional. Protección persistente por entrega y UUID implementada en §17; evento del lector e integración visual pendientes.

## 5. Reglas de autorización y admisión

- `GENERAL`: aplica autorización general; las asociaciones municipales específicas se conservan pero no se aplican.
- `ESPECIFICA`: exige autorización general y pertenencia a la lista específica municipal. Una lista específica vacía no equivale a `GENERAL`.
- El MVP contempla `TD` (Tarjeta Dorada).
- Medicamento desconocido, no autorizado o `INACTIVO` genera incidencia. `INACTIVO` nunca puede admitirse, en ALTA ni en BAJA. Es una anulación para nuevas admisiones; no borra el medicamento ni modifica historial.
- `ACTIVO` + autorizado + `ALTA`: se admite.
- `ACTIVO` + autorizado + `BAJA`: detener la lectura y pedir elección entre admitir y apartar como incidencia. Aceptar BAJA no omite ninguna otra condición de autorización.
- Decisión aprobada: no añadir al MVP una marca histórica de aceptación BAJA. Mantener elección explícita aceptar/apartar; la evidencia histórica adicional es mejora futura y no bloquea implementar esta elección.
- Cambios posteriores en listas/estado/situación no invalidan precintos ya aceptados.
- Se conserva el precio vigente preparado en catálogo en `precio_aplicado`. Cambios futuros de catálogo no alteran el snapshot. La actualización controlada de precios de medicamentos en ALTA debe preceder al registro; mecanismo pendiente de mejora. No se implementan importación, automatización ni motor de precios.

## 6. Incidencias

Incidencia ligada directamente a la entrega, apartada físicamente, fuera de paquetes y sin importe facturable. Confirmar un aviso permite continuar la sesión, pero no autoriza el medicamento. Motivos iniciales:

- `MEDICAMENTO_DESCONOCIDO` (puede no tener medicamento asociado ni código nacional identificable).
- `MEDICAMENTO_NO_AUTORIZADO`.
- `MEDICAMENTO_INACTIVO`.
- `BAJA_COMERCIAL_RECHAZADA_USUARIO`.

Ampliar motivos exige cambios explícitos en restricciones, validaciones y mensajes. No se implementa resolución o reincorporación de incidencias.

## 7. Paquetes

- Solo contienen precintos admitidos; máximo 15. `numero_paquete` y `posicion_paquete` siguen siendo la representación; no hay entidad PAQUETE ni contador histórico.
- Posiciones desde 1 hasta el número actual. Guardar el precinto 15 completa el paquete, pero no crea otro vacío. El próximo precinto admitido materializa el siguiente paquete: automáticamente si el último está completo, o por decisión expresa del usuario si está incompleto.
- El número nuevo es el mayor existente más uno, o 1 si no existe ningún paquete. No se materializan paquetes vacíos: nace al guardar su primer admitido. Las incidencias no crean paquetes.
- Al recuperar entrega se presentan los paquetes existentes y se permite continuar el último incompleto o iniciar otro expresamente. Nunca se rellenan paquetes anteriores ni se trasladan lecturas entre ellos.

## 8. Correcciones

- Una lectura errónea se elimina físicamente sin historial de anulación mientras la facturación sea editable. Un precinto real rechazado sigue siendo incidencia conservada.
- Al borrar, recalcular recuento/subtotal y renumerar solo las posiciones del paquete afectado, manteniendo IDs internos. Otros paquetes conservan número y composición; paquete corregido puede quedar incompleto y desaparece si queda vacío.
- El siguiente número siempre es el máximo existente más uno: borrar paquete 2 dejando 1 y 3 → siguiente 4; borrar 3 dejando 1 y 2 → siguiente 3.
- Una facturación cerrada requiere el flujo previsto de reapertura; esta especificación no lo altera.

## 9. Resumen de control

Mostrar cantidad e importe declarados, admitidos, subtotal facturable, incidencias, total registrado, paquete actual/avance y diferencias. Definiciones:

```text
total registrado = admitidos + incidencias
subtotal facturable = suma de precio_aplicado de admitidos
diferencia cantidad = registrados − declarados
diferencia importe = subtotal facturable − importe declarado
```

Las diferencias son informativas y no bloquean registro ni facturación por sí solas. No se asignan importes ficticios a incidencias.

## 10. Requisitos de interfaz y aceptación

Seguir las convenciones existentes de navegación, botones, mensajes y foco. Selección de entrega y lectura son pantallas/estados separados. En lectura se mantienen visibles periodo, farmacia, ayuntamiento, campo de entrada, paquete actual/recuento, subtotal y resumen. El mismo campo sirve para escáner y entrada manual con etiqueta/ayuda clara. Teclado permite leer, introducir y resolver avisos; después del guardado se limpia el campo y vuelve el foco. Identificar la última lectura. Durante guardado: «Guardando…» y bloqueo de duplicados. No perder silenciosamente escaneos durante espera; concretar estrategia sin cola compleja. Distinguir error de entrada, incidencia y aviso BAJA sin depender solo del color. Para BAJA ofrecer «Aceptar precinto» y «Apartar como incidencia». Eliminar requiere mostrar paquete, línea, código y descripción disponible y confirmación. Iniciar paquete informa si el actual está incompleto. Consultar paquetes/incidencias conserva contexto. Controles etiquetados, foco visible y mensajes comprensibles. Priorizar escritorio con lector y diseño adaptable sin scroll horizontal de página.

Criterios verificables: contexto siempre visible; flujos completos solo con teclado; foco recuperado; feedback de guardado/error accesible; confirmación BAJA distinta de rechazo; eliminación identificable y confirmada; navegar paquetes/incidencias no pierde entrega; layout estrecho no desplaza la página horizontalmente. No se define maquetación ni prototipo en esta tarea.

## 11. Adaptación del esquema y estado de aplicación

`db/schema.sql` y la actualización incremental `db/updates/002-entregas-precintos-snapshots-incidencias.sql` incorporan los dos snapshots `TEXT NOT NULL` y los cuatro motivos aprobados. La actualización se aplicó y verificó en `gestion_facturacion_medicamentos_test` y `gestion_facturacion_medicamentos`, ambas con cero entregas antes y después. Las bases adicionales, si existen, siguen pendientes de comprobación individual. `precinto.medicamento_id` continúa obligatorio; incidencia no depende de FK de medicamento. Declarados implementados en §15 y protección persistente de operaciones/consulta en §17, con esquema incremental 003 verificado en db README. No se propone tabla de paquetes ni cambio de relación farmacia-periodo.

Para aplicar 002 en otra instalación: comprobar explícitamente el destino real, la definición y el contenido de la tabla de entregas. Si faltan los snapshots y existen entregas, abortar sin rellenarlos desde el maestro ni borrar datos. Seguir `db/README.md`, sin recrear la base ni ejecutar `db/schema.sql` sobre una instalación existente.

## 12. Plan de pruebas futuro

Unitarias: extracción/preservación de códigos, reglas GENERAL/ESPECIFICA, INACTIVO, BAJA, cálculos y selección de paquete. API/integración: entrega única, asociación municipal válida y concurrencia con cambios de asignación, snapshots de nombre/CIF, precio aplicado, repetición de códigos, incidencias fuera de paquetes, límite 15/apertura manual, recuperación, borrado/renumeración/paquetes vacíos y totales. Revisar fixtures que insertan entregas por nuevos NOT NULL. Interfaz/manual: lecturas consecutivas sin ratón, avisos/teclado/foco, error conservando entrada, escaneos durante guardado y respuesta perdida sin pérdida/duplicación. Reutilizar protocolo de bloqueo/validación de farmacia en `docs/specs/gestion-ayuntamiento/plan.md` §6.

## 13. Decisiones pendientes

La política de claves retiradas fue aprobada en este bloque: conservar únicamente entrega/clave y marcador, sin contenido, para rechazar repeticiones tardías. Sustituye la propuesta de desaparición de la clave de §17; implementación y contrato vigentes en §18.

- Evento concreto del lector de códigos.
- Estrategia para escaneos durante operaciones pendientes.
- Integración visual de la consulta de operación ante respuesta perdida (§17).
- Aprobación o no de validar dígito de control EAN-13.
- La corrección individual está implementada según el apartado vigente inicial; las propuestas agrupadas anteriores quedan como histórico.
- Integración con el lector de la clave de operación persistente y consulta de resultados (§17).

## 14. Contrato API de creación y recuperación

### Consulta neutral del listado (implementada)

`GET /entregas/registradas` devuelve un array de entregas existentes. Solo acepta el filtro opcional `periodo_id` como cadena decimal de ID positivo INTEGER; vacío, repetido, inválido o campos desconocidos devuelven 400. Sin filtro incluye todos los periodos; filtro válido sin coincidencias devuelve 200 con array vacío. No crea, recupera por POST ni modifica datos.

Proyección: campos de la respuesta de entrega detallada más `soe`, `admitidos` (número de aptos) y `subtotal_facturable` (suma de `precio_aplicado` en cadena decimal). Una sola sentencia parametrizada agrega únicamente precintos de cada entrega, evitando multiplicaciones por incidencias. Sin aptos devuelve 0 y `0.00`; ni declarados ni precios actuales intervienen. Denominación/CIF-NIF proceden de snapshots de entrega; SOE y asociación/nombre municipal del catálogo actual. LEFT JOIN municipal mantiene visible una entrega sin Ayuntamiento, sin conceder permisos de escritura. No incluye bancos, lecturas individuales, estados, permisos ni clasificación de facturación.

Orden: denominación municipal ascendente, NULL al final, ID municipal para grupos homónimos, SOE textual ascendente, año/mes descendentes, ID de entrega como desempate. La ruta está registrada antes de las rutas con ID. El listado utiliza el esquema actual; no añade tablas, campos ni migraciones. El listado neutral no proyecta el estado financiero ni la participación emitida: no denominar estas filas pendientes o facturadas por deducción de la mera existencia de un proceso municipal. Facturación/participación están implementadas en su módulo.

- `POST /entregas`: alternativas estrictas `{ farmacia_id, mes, anio }` o `{ farmacia_id, periodo_id }`; se rechazan mezclas, campos adicionales y fechas incompletas. IDs y año son enteros positivos hasta 2147483647; mes entero 1–12. Sin límites relativos al pasado/futuro. Busca mes/año y reutiliza o crea el periodo dentro de la transacción de entrega. Devuelve 201 al crear entrega y 200 al recuperarla sin modificarla.
- `GET /entregas?farmacia_id=…&mes=…&anio=…` o `?farmacia_id=…&periodo_id=…`: mismas alternativas exclusivas en cadenas decimales; 200 al recuperar, 404 si falta periodo/entrega. Nunca crea datos. Permite consultar una apertura incierta sin conocer todavía periodo_id.
- Respuesta: `id`, `farmacia_id`, `periodo_id`, `denominacion_farmacia`, `cif_nif_farmacia`, `precintos_informados`, `importe_informado`, `mes`, `anio`, `ayuntamiento_id`, `ayuntamiento_denominacion`. Snapshots históricos del registro y Ayuntamiento vigente derivado del maestro. No se proyectan datos bancarios. Los declarados son NULL al crear; el importe NUMERIC existente se devuelve como cadena, según `pg`.
- 400 por datos inválidos o campos adicionales (incluidos snapshots, Ayuntamiento o declarados enviados por el cliente); 404 por farmacia, periodo o entrega inexistentes; 409 si la farmacia carece de Ayuntamiento.
- Cada operación utiliza una conexión y transacción READ COMMITTED. GET mantiene Farmacia `FOR SHARE` y Periodo `FOR KEY SHARE`; POST que encuentra una entrega existente la devuelve sin actualizarla ni exigir ausencia de facturación. Si necesita crear, utiliza el protocolo de escritura de §15. Los snapshots se copian desde la farmacia revalidada y bloqueada; los existentes nunca se reemplazan.
- Apertura por fecha: primero consulta sin locks para recuperar una entrega existente. Si falta, valida asociación y bloquea Ayuntamiento → Farmacia antes de resolver periodo. SELECT por mes/año, INSERT con `ON CONFLICT ON CONSTRAINT uq_periodo_mes_anio DO NOTHING` y consulta separada READ COMMITTED tras esperar al ganador. Después Periodo FOR KEY SHARE, reconsulta entrega y comprueba facturación antes del INSERT con unicidad farmacia/periodo. Un rechazo o fallo revierte también cualquier periodo creado por esa operación. No se adquieren locks municipales/farmacias nuevos después de esperar por periodo; distintas municipalidades pueden compartirlo sin invertir el protocolo. Recuperar existentes conserva snapshots/declarados y sigue permitido con facturación.
- `/entregas.html` permite seleccionar mes/año aunque no exista periodo; no consulta el listado para habilitar apertura. GET `/entregas/periodos` se conserva como consulta compatible (sin parámetros; 400 si los hay), devuelve `{id, mes, anio}` ordenados y no crea datos. Sin pantalla de gestión de periodos, estados nuevos ni cambios de esquema. El flujo visual para lector de teclado y entrada manual está implementado y se especifica en `../interfaz-entregas-precintos/`; la verificación con hardware físico sigue pendiente.

## 15. Corrección de declarados y protección provisional de escrituras

`PUT /entregas/:id/declarados` reemplaza la representación completa de los dos declarados, conforme a los PUT existentes del proyecto. Ambos campos son obligatorios; omitir cualquiera devuelve 400 y conserva los datos previos. No se trata de una actualización parcial. Solo acepta:

| Campo | Contrato |
|---|---|
| `precintos_informados` | Entero JSON de 0 a 2147483647, o `null`. |
| `importe_informado` | Cadena decimal no negativa, de 0 a 9999999999.99, hasta dos decimales con punto, o `null`; se recortan espacios exteriores. No admite números JSON, exponentes, comas ni redondeo silencioso. |

NULL significa ausencia de dato declarado; cero es un valor informado. Respuesta 200 con la proyección de §14; el importe se devuelve como cadena decimal de `pg` o NULL. El ID de ruta es un entero decimal positivo hasta 2147483647. Campos desconocidos, identidad, farmacia, periodo, Ayuntamiento y snapshots se rechazan con 400. Entrega inexistente devuelve 404. La corrección actualiza exclusivamente ambos declarados: preserva snapshots, identidad, precintos, incidencias y precios.

**Regla vigente:** creación y edición de entregas usan la facturación del Ayuntamiento vigente de la farmacia, periodo y tipo TD. Sin cabecera, en REVISION o REABIERTA sin cobros se permiten escrituras; EMITIDA o cualquier cobro devuelven 409. La mera cabecera no bloquea ni se exige crear una revisión para leer/corregir. El historial no prueba reapertura vigente y PERIODO no tiene estado ABIERTO/CERRADO. GET y POST que recupera una entrega existente siguen disponibles sin modificarla. El bloqueo provisional por existencia de cabecera pertenece al diseño anterior y queda sustituido por facturación municipal §13.

**Protocolo de escritura:** lectura inicial sin bloqueo para conocer el Ayuntamiento → Ayuntamiento `FOR UPDATE` → Farmacia `FOR SHARE` y revalidación de su asociación → Periodo `FOR KEY SHARE` → Entrega `FOR UPDATE` en correcciones. Si la asociación cambió desde la lectura inicial se devuelve 409 y se requiere consultar de nuevo; no se adquiere un segundo lock municipal reteniendo el de Farmacia. El estado de facturación y los cobros se consultan en una sentencia posterior al lock municipal bajo READ COMMITTED. Los bloqueos se mantienen hasta COMMIT; errores/rechazos hacen rollback. Una farmacia sin Ayuntamiento no permite escritura.

El bloqueo común existe aun cuando todavía no hay facturación y serializa escrituras del mismo Ayuntamiento, incluso de periodos distintos. La emisión implementada adquiere ese mismo `FOR UPDATE` antes de leer, calcular y guardar. No se garantiza exclusión frente a un cierre o SQL directo que ignore el protocolo; la protección no es un trigger ni una restricción nueva de base de datos.

## 16. Contrato de evaluación informativa de código

`POST /entregas/:id/evaluacion` consulta una entrega existente. El ID debe ser entero positivo dentro del rango INTEGER. Cuerpo estricto: `{ "codigo_barras_original": "8470006772911" }`; no admite otras propiedades. Reutiliza la interpretación estricta: seis dígitos manuales o trece con prefijo 847000, sin espacios, conservando original y ceros; no valida el dígito de control.

Respuesta HTTP 200: `{ "codigo_barras_original": "8470006772911", "codigo_nacional": "677291", "resultado": "ADMITIDO", "medicamento": { "id": 1, "descripcion": "Medicamento ficticio", "precio": "12.34", "estado": "ACTIVO", "situacion_comercial": "ALTA", "tipo_facturacion": "TD" } }`. El ID del ejemplo es ilustrativo. Precio conservado como cadena decimal de PostgreSQL, sin conversión a coma flotante.

Los otros resultados válidos son `INCIDENCIA` con `motivo` y `PENDIENTE_DECISION_BAJA` sin motivo. Medicamento desconocido devuelve `medicamento: null` y `MEDICAMENTO_DESCONOCIDO`. INACTIVO tiene prioridad en ALTA y BAJA; GENERAL ignora asociaciones específicas; ESPECIFICA exige medicamento ACTIVO TD y pertenencia municipal, y si falta esta última devuelve `MEDICAMENTO_NO_AUTORIZADO`. Solo BAJA ACTIVO autorizado requiere decisión. La función pura existente decide estas reglas; no hay aceptación/rechazo BAJA en este endpoint.

Errores: 400 para ID/cuerpo/formato inválido, 404 para entrega inexistente. Si una entrega existente ha quedado sin Ayuntamiento asociado a su farmacia, 409, siguiendo el error de asociación existente; la API municipal impide esa retirada con entregas, pero la consulta detecta datos inconsistentes introducidos fuera de ese protocolo. No expone datos bancarios, identificadores municipales ni datos adicionales de Farmacia.

Entrega, Farmacia, Ayuntamiento, medicamento y pertenencia se obtienen mediante una única sentencia SELECT parametrizada, con LEFT JOIN para medicamento desconocido y Ayuntamiento ausente. No adquiere bloqueos exclusivos ni comprueba ausencia de facturación: consultar con facturación existente sigue permitido. Aunque usa POST para transportar el código, no crea ni modifica entregas, precintos, incidencias ni otros registros, y no deduplica códigos.

La evaluación utiliza los datos actuales: no reserva precio ni garantiza admisión futura. El guardado de §17 comprueba otra vez autorización, precio y editabilidad mediante su protocolo de escritura. La interfaz usa este contrato en el flujo asistido; la comprobación con hardware lector físico queda pendiente.

## 17. Guardado de lecturas y recuperación por clave de operación

### Petición y validación

`POST /entregas/:id/lecturas`, ID INTEGER positivo. Cuerpo estricto:

```json
{
  "codigo_barras_original": "8470006772911",
  "clave_operacion": "b5918e5b-a4df-40b5-82eb-735530972683",
  "decision": null,
  "nuevo_paquete": false
}
```

La clave usa formato UUID hexadecimal 8-4-4-4-12, sin espacios; mayúsculas normalizadas a minúsculas. No se impone versión de UUID; generar una clave nueva por operación. Su unicidad es `(entrega_id, clave)`. Código usa la interpretación existente. `decision` omitida equivale a NULL; `nuevo_paquete` omitido equivale a false. No acepta precio, medicamento, posición, paquete numérico ni motivos fuera de una confirmación; todos se obtienen del servidor. No admite propiedades adicionales ni categorías/tipos inválidos.

Decisiones admitidas:

- `{"tipo":"CONFIRMAR_INCIDENCIA","motivo":"MEDICAMENTO_INACTIVO"}`; motivo observado DESCONOCIDO, INACTIVO o NO_AUTORIZADO, comparado con el calculado por el servidor. El motivo enviado expresa lo que se confirma, nunca sustituye la regla.
- `{"tipo":"ACEPTAR_BAJA"}` o `{"tipo":"APARTAR_BAJA"}`, únicamente para ACTIVO TD autorizado BAJA.

ALTA autorizado sin decisión guarda precinto. Una incidencia exige confirmación coincidente; BAJA elegible exige aceptar/apartar, sin marca histórica adicional. BAJA apartada guarda `BAJA_COMERCIAL_RECHAZADA_USUARIO`; aceptar no puede eludir estado/autorización. Si una decisión deja de corresponder al resultado actual (incluido cambio de motivo o BAJA→ALTA), 409 `CONFLICTO_CONDICIONES` con evaluación actual; no transforma la decisión ni consume la clave. Cambios de precio con admisión todavía aplicable usan el precio actual, sin reserva previa.

### Respuestas

| HTTP | `resultado` | Efecto |
|---|---|---|
| 201 | `GUARDADO` | Una lectura y su protección confirmadas en la misma transacción. |
| 200 | `RECUPERADO` | Resultado de operación ya completada, sin reevaluar ni escribir. |
| 200 | `DECISION_PENDIENTE` | Incluye `evaluacion` con códigos, resultado y motivo cuando procede; sin lectura ni clave consumida. |
| 409 | `CONFLICTO_CLAVE` | La clave completada tiene diferente código original, decisión o petición de paquete; sin escritura. |
| 409 | `CONFLICTO_CONDICIONES` | Decisión incompatible con condiciones actuales, revisar evaluación; sin escritura. |
| 409 | `BLOQUEADA_FACTURACION` | Nueva operación con facturación Ayuntamiento-periodo-TD EMITIDA o cualquier cobro; sin escritura. |
| 400 | — | ID, cuerpo, clave o código inválidos. |
| 404 | — | Entrega inexistente. |

Los errores de asociación/identidad conservan 409 y mensajes del protocolo existente. Respuesta guardada/recuperada: `clave_operacion`, `tipo` PRECINTO/INCIDENCIA y `lectura`. Ambas lecturas incluyen `id`, `entrega_id`, `codigo_barras_original`, `codigo_nacional`; PRECINTO añade `medicamento_id`, `precio_referencia` y `precio_aplicado` como cadenas decimales, `numero_paquete`, `posicion_paquete`; INCIDENCIA añade `motivo`, sin precio ni posición. No devuelve datos bancarios, estados actuales o descripción cambiante del catálogo como resultado histórico.

### Repeticiones, consulta y borrado futuro

`GET /entregas/:id/operaciones/:clave`, sin parámetros adicionales, no escribe. 200 `RECUPERADO` con la misma lectura; 404 si no existe entrega/operación, 400 si ID/clave/query inválidos. Para respuesta perdida, consultar la clave; 404 significa no visible en ese instante, puede existir una petición original todavía en curso. Si se repite explícitamente, conservar la misma clave y contenido; no hay reintento automático.

Una operación completada se recupera antes de comprobar catálogo/facturación y se vuelve a consultar después de esperar los bloqueos; el resultado persiste aunque cambie precio, estado o exista facturación posterior. Misma clave con diferente contenido/decisión/nuevo paquete es conflicto. Dos claves distintas con el mismo código son lecturas independientes. Se compara la petición normalizada (defaults y UUID), conservando literalmente el código original; código manual y barras son contenidos distintos aunque extraigan el mismo nacional. Una petición pendiente permite completar esa clave con la decisión necesaria porque todavía no hay operación persistida.

`operacion_lectura` es protección técnica, con una única referencia a PRECINTO o INCIDENCIA y petición JSONB para verificar repeticiones. No almacena evaluaciones, avisos, copias del precio, historial de aceptación BAJA ni registros de anulación. La decisión de la petición se conserva únicamente para detectar conflicto de repetición mientras exista la lectura; no es una marca adicional en PRECINTO ni historial separado. FK compuestas aseguran que la lectura pertenece a la entrega, UNIQUE impide varias claves para una misma lectura y CHECK exige exactamente un destino. Lecturas anteriores permanecen intactas y sin claves inventadas.

La propuesta inicial de eliminación por cascada queda sustituida por la política aprobada de §18: al eliminar una lectura, retirar y purgar su operación antes del DELETE; la clave permanece sin contenido para impedir recreación tardía. La eliminación y renumeración están implementadas según §18. Cascadas existentes no sustituyen el protocolo de eliminación API.

### Transacción, catálogo y paquetes

READ COMMITTED: consultar operación existente → observar entrega → Ayuntamiento FOR UPDATE → Farmacia FOR SHARE revalidada → Periodo FOR KEY SHARE → Entrega FOR UPDATE revalidada → volver a consultar operación → comprobar facturación → Medicamento FOR SHARE por código → SELECT coherente de modalidad, medicamento y pertenencia → evaluar → INSERT lectura y protección → COMMIT. Rechazos/pendientes/errores hacen rollback; conexión liberada siempre. Serializa posiciones y claves dentro de la entrega y, por el bloqueo municipal, también escrituras de distintos periodos del mismo Ayuntamiento.

El bloqueo municipal estabiliza modalidad y listas: las mutaciones municipales toman Ayuntamiento FOR KEY SHARE antes de Farmacia/Medicamento y quedan coordinadas. Medicamento FOR SHARE impide actualizar precio/estado/situación/código hasta commit; el CRUD de Medicamentos actual solo modifica su fila, sin adquirir después bloqueos municipales. Tras esperar un medicamento, se consulta en una sentencia nueva para usar su versión confirmada. Si entre búsqueda y SELECT aparece otro ID para el código, se repite la adquisición y consulta hasta coincidir. Para desconocido, la decisión se toma en el snapshot del SELECT final; una incorporación posterior no reescribe la incidencia. SQL directo que omita el protocolo municipal puede romper esta coordinación; no se introduce un trigger para las listas. La emisión actual bloquea Ayuntamiento antes de leer/calcular/guardar; comparte el protocolo con las lecturas.

Solo precintos usan posiciones. Bajo el lock de Entrega se obtiene el paquete con mayor número y su última posición: sin paquetes, 1/1; incompleto, posición siguiente; completo (15) o `nuevo_paquete:true`, máximo número + 1 / posición 1. El precinto 15 no crea paquete vacío ni contador. Incidencias ignoran `nuevo_paquete` y no avanzan posiciones. No se rellenan anteriores ni se actualizan declarados/precios guardados.

## 18. Consultas, totales y eliminación de entradas erróneas

### Consultas sin escritura

- `GET /entregas/:id/precintos`: array ordenado por `numero_paquete`, `posicion_paquete`, con `id`, `entrega_id`, ambos códigos históricos, `medicamento_id`, `precio_referencia` conservado y `precio_aplicado` vigente como cadenas decimales y posiciones vigentes. No incluye descripción del catálogo ni datos bancarios.
- `GET /entregas/:id/incidencias`: array independiente ordenado por ID, con `id`, `entrega_id`, ambos códigos guardados (nacional puede ser NULL), `motivo` y `observaciones`; sin precio ni posiciones.
- `GET /entregas/:id/resumen`: objeto con entrega/declarados, `admitidos`, `incidencias`, `total_registrado`, `subtotal_facturable`, `diferencia_cantidad`, `diferencia_importe` y array `paquetes`, ordenado por número. Cada paquete devuelve `numero_paquete`, `precintos`, `subtotal_facturable`.

Todos validan ID positivo INTEGER y rechazan parámetros adicionales: 400 por entrada inválida, 404 por entrega inexistente, 200 con listas vacías para una entrega sin lecturas. Disponibles con facturación existente, sin bloqueo exclusivo ni validación de editabilidad. Cada respuesta procede de una única sentencia parametrizada; resumen agrega precintos por paquete e incidencias aparte antes de combinar, sin multiplicar filas y con un snapshot coherente ante escrituras concurrentes.

Monetarios calculados con NUMERIC en PostgreSQL y convertidos a TEXT antes de construir JSON, nunca sumados en JavaScript. Admitidos/incidencias/recuento por paquete son números JSON. Total registrado suma ambas cantidades; subtotal facturable suma precios aplicados. Diferencia de cantidad = registrado − declarado; diferencia de importe = subtotal − importe declarado. Declarado NULL produce diferencia NULL; cero se calcula normalmente. Vacía: recuentos 0, subtotal `"0.00"`, paquetes `[]`. No reserva condiciones ni precio actual del catálogo.

### DELETE y renumeración

`DELETE /entregas/:id/precintos/:lecturaId` y `DELETE /entregas/:id/incidencias/:lecturaId`. Sin cuerpo (se admite objeto vacío) ni query adicionales. 204 sin contenido al eliminar, 400 por IDs/entrada inválidos, 404 si entrega/lectura no existe o la lectura pertenece a otra entrega, 409 si la facturación aplicable bloquea escritura o falla asociación/identidad. Se comprueba primero la editabilidad bajo el protocolo común; EMITIDA o cualquier cobro devuelve 409 antes de buscar la lectura. Sin cabecera, REVISION o REABIERTA sin cobros permiten eliminar; el servidor valida tras los locks.

Transacción READ COMMITTED: observar entrega → Ayuntamiento FOR UPDATE → Farmacia FOR SHARE y asociación revalidada → Periodo FOR KEY SHARE → Entrega FOR UPDATE e identidad revalidada → comprobar facturación Ayuntamiento-periodo-TD → comprobar pertenencia → retirar/purgar operación asociada → DELETE físico → renumerar paquete afectado → COMMIT. Sin operación (lectura anterior a 003), simplemente elimina; no inventa una clave. Todos los cambios revierten ante fallo, incluida la retirada de clave. Guardado, borrados y emisión quedan coordinados por los locks comunes. SQL directo que los omita no tiene esa garantía.

Al borrar un precinto, ordenar restantes del mismo paquete por posición y actualizar de menor a mayor a 1…N. El destino nunca supera la posición anterior y aprovecha el hueco ya libre: no colisiona con UNIQUE `(entrega_id, numero_paquete, posicion_paquete)`, sin desactivar ni diferir restricciones. Conserva IDs, número de paquete, precio y códigos de restantes; otros paquetes intactos. Paquete vacío desaparece de consultas sin entidad ni contador; el siguiente expreso usa MAX conservado + 1, o 1 sin paquetes. Incidencia eliminada no altera posiciones. Totales se recalculan al consultar. La pantalla de lectura ofrece eliminación de aptos por ID, confirmación identificada y refresco inmediato de tabla/resumen; incidencias no tienen esa acción visual. No actualiza directamente FACTURA: revisión/reemisión conserva el protocolo financiero. GET operación/repetición reconstruyen posiciones actuales, sin devolver un snapshot obsoleto.

### Política de clave retirada aprobada

El usuario aprobó conservar únicamente la entrega, la clave UUID y el marcador `retirada`; el ID técnico del recibo se conserva sin información del contenido. En la misma transacción del borrado, `solicitud`, `precinto_id` e `incidencia_id` se ponen a NULL. No se conservan código, motivo, decisión, precio, posición, descripción, ID de lectura ni fecha de borrado. CHECK obliga a purgar todo contenido para una retirada y exige un único destino/solicitud para una operación activa. UNIQUE entrega/clave permanece; sin expiración o purga automática que habilite repetición tardía.

POST tardío con la clave retirada: 409 `{ "resultado": "OPERACION_RETIRADA", "clave_operacion": "…" }`, antes de comprobar catálogo/facturación; nunca recrea la lectura. GET operación retirada: 410 con el mismo objeto, sin contenido antiguo. Una nueva lectura legítima necesita nueva clave. Ejemplo: guardar operación K, borrar su precinto, recibir después otra vez POST K → OPERACION_RETIRADA sin lectura nueva. No hay historial del contenido borrado; solo protección técnica de clave, aprobada expresamente.

004 mantiene claves/solicitudes activas existentes, añade `retirada BOOLEAN NOT NULL DEFAULT FALSE`, permite solicitud NULL exclusivamente cuando retirada y adapta ambos CHECK. `schema.sql` crea la misma definición. 003 permanece como actualización histórica; no repetir su verificador antiguo después de 004. Bases verificadas y procedimiento en db README. Eliminación/renumeración backend completadas; interfaz, lector, precios y módulo financiero fuera de alcance.
