# Modelo de datos

## Revisión documental para entrega — 18 de octubre de 2026

Contraste con `db/schema.sql`, rutas, servicios e interfaces actuales, sin modificar el esquema ni ejecutar migraciones. Diagrama vigente **v2**: [PNG](modelo-entidad-relacion-v2-2026-10-18.png), [SVG](modelo-entidad-relacion-v2-2026-10-18.svg) y [fuente DOT editable](modelo-entidad-relacion-v2-2026-10-18.dot). [Evolución, garantías SQL/servicios y comprobaciones](revision-documental-v2-2026-10-18.md). La v1 se conserva como histórico; su fecha no acredita cuándo se implementó cada función.

Los apartados expresamente históricos conservan el estado de su momento. Alcance actual en el [README](../../README.md): reapertura visual, cobros, liquidación, documentos e informe anual implementados. No se han vuelto a verificar bases ni resultados de pruebas anteriores.

## Regla vigente de lecturas y precios — v26, 12 de octubre de 2026

Cada precinto conserva referencia y aplicado propios. Corregir por ID afecta solo esa fila, nunca maestro ni lecturas del mismo código/farmacia/periodo. Nuevas lecturas toman el maestro vigente; guardadas no cambian al editarlo. SIN_FACTURAR (sin cabecera TD), REVISION y REABIERTA sin cobros permiten añadir/corregir, sin preparar revisión. EMITIDA bloquea hasta reapertura controlada; cualquier cobro bloquea escritura y reapertura. El permiso es del Ayuntamiento/periodo/TD, no de una etiqueta de entrega pendiente ni del historial. B permanece congelado tras emisión; facturas originales se conservan hasta reemisión conjunta.

005 rellena solo referencias NULL con el aplicado conservado al migrar, sin modificar aplicado ni sobrescribir referencias existentes; cobertura y restricciones verificadas antes de activar corrección. Para históricos no garantiza el precio original del catálogo. Nuevas lecturas capturan ambos precios; corregir conserva referencia. No existe auditoría de valores intermedios, autor/fecha/motivo de cada corrección: los dos precios no equivalen a ese historial. Reapertura sí guarda fecha automática y motivo obligatorio.

Las adendas fechadas de 8 de octubre se conservan como historial de implementación; sus pendientes, bloqueo provisional por cabecera y liberación antigua de claves no son reglas vigentes. Para contratos actuales consultar Entregas §17–§18 y su apartado de corrección individual, y Facturación municipal §13–§15.

## Objetivo

El modelo soporta la gestión de ayuntamientos, farmacias, medicamentos, precintos, incidencias, facturación, cobros y pagos a farmacias, preservando la trazabilidad histórica de la información financiera.

Este documento recoge el modelo conceptual completo validado. Los tipos, restricciones e índices concretos de PostgreSQL están documentados en `modelo-logico-postgresql.md`.

## Entidades

- **AYUNTAMIENTO**: administra la información de cada ayuntamiento y su relación con farmacias, medicamentos y facturaciones.
- **FARMACIA**: identifica cada establecimiento y su asignación municipal opcional, incluida su referencia SOE.
- **MEDICAMENTO**: contiene el catálogo de medicamentos, su código nacional, estado y precio vigente.
- **AYUNTAMIENTO_MEDICAMENTO**: vincula los medicamentos autorizados o específicos de un ayuntamiento.
- **PERIODO**: representa el mes y año de operación.
- **ENTREGA_FARMACIA_PERIODO**: agrupa la entrega de una farmacia en un periodo concreto.
- **PRECINTO**: registra los precintos válidos, su medicamento, precio aplicado y posición dentro del paquete.
- **INCIDENCIA**: registra anomalías asociadas a una entrega que no constituyen precintos válidos.
- **OPERACION_LECTURA**: recibo técnico por entrega/UUID o clave retirada sin contenido; no es historial de lecturas eliminadas.
- **FACTURACION**: representa el proceso de facturación de un ayuntamiento para un periodo y tipo de facturación.
- **PARTICIPACION_FACTURACION**: representa la participación única de una entrega en la facturación municipal y conserva la identidad B y el importe de sus precintos aptos.
- **FACTURA**: representa cada una de las dos facturas asociadas a una facturación: PRECINTOS y COMISION.
- **COBRO**: registra el cobro completo de una factura.
- **REAPERTURA_FACTURACION**: registra la reapertura de una facturación y su motivo.
- **PAGO_FARMACIAS**: representa el pago a las farmacias derivado de una facturación.
- **DETALLE_PAGO_FARMACIA**: conserva el importe y los datos históricos de cada farmacia incluidos en un pago.
- **CONFIGURACION_FACTURACION**: define los parámetros de comisión e IVA empleados al generar las facturas.
- **CONFIGURACION_DOCUMENTOS**: contiene la configuración necesaria para la emisión de documentos.

## Detalle de entidades

### AYUNTAMIENTO

Administra los datos identificativos y de contacto del ayuntamiento, su disponibilidad para nuevas operaciones y el tipo de lista de medicamentos que utiliza.

| Campo | Utilidad |
|---|---|
| `id` | Identificador interno y estable. |
| `cif` | Identificador fiscal. |
| `denominacion` | Nombre oficial. |
| `direccion` | Dirección postal. |
| `codigo_postal` | Código postal. |
| `localidad` | Localidad. |
| `provincia` | Provincia. |
| `telefono` | Teléfono de contacto. |
| `movil` | Teléfono móvil de contacto. |
| `persona_responsable` | Persona responsable. |
| `persona_contacto` | Persona de contacto. |
| `alcalde` | Nombre del alcalde. |
| `estado` | Situación activa o inactiva. |
| `tipo_lista_medicamentos` | Uso de la lista general o de una lista específica. |

Reglas:

- `cif` es obligatorio y único.
- `estado` admite `ACTIVO` o `INACTIVO`.
- `tipo_lista_medicamentos` admite `GENERAL` o `ESPECIFICA`.
- El CIF puede corregirse manteniendo la unicidad.
- El `id` interno permanece estable.
- No se elimina físicamente información histórica relevante.

### FARMACIA

Identifica el establecimiento, su asignación municipal actual (opcional) y sus datos fiscales, de contacto y bancarios actuales.

| Campo | Utilidad |
|---|---|
| `id` | Identificador interno. |
| `soe` | Identificador estable del establecimiento. |
| `cif_nif` | Identificador fiscal actual. |
| `denominacion` | Denominación actual. |
| `direccion` | Dirección postal. |
| `codigo_postal` | Código postal. |
| `localidad` | Localidad. |
| `provincia` | Provincia. |
| `telefono` | Teléfono de contacto. |
| `ayuntamiento_id` | Ayuntamiento actual al que está asignada; opcional en el modelo objetivo (`NULL` significa sin asignación). |
| `pais_control_iban` | Componente de país y control del IBAN actual. |
| `entidad_bancaria` | Código de entidad bancaria actual. |
| `sucursal_bancaria` | Código de sucursal bancaria actual. |
| `digito_control_bancario` | Dígitos de control bancario actuales. |
| `cuenta_bancaria` | Número de cuenta bancaria actual. |

Reglas:

- `soe` es obligatorio y único.
- El SOE identifica de forma estable al establecimiento.
- Una farmacia puede pertenecer a cero o un ayuntamiento a la vez; varios registros FARMACIA pueden referirse al mismo ayuntamiento.
- Las relaciones operativas con FARMACIA usan `farmacia.id`, nunca `soe`. El SOE es un identificador de negocio único, pero no una clave foránea.
- Se permite asignar, reasignar o quitar el ayuntamiento únicamente cuando no existen entregas ni precintos asociados. La comprobación de actividad y la modificación deben ser atómicas.
- No se exige un control independiente de facturación para cambiar la asignación. La asignación municipal no se cambia después de que exista actividad, y no traslada ni modifica precintos, entregas ni facturaciones cerradas.
- Una farmacia sin ayuntamiento no puede registrar entregas ni precintos. Al registrar una entrega/precinto, la farmacia debe estar asignada al ayuntamiento seleccionado.
- CIF/NIF, denominación y otros datos de la farmacia pueden cambiar manteniendo el mismo SOE.
- La identidad de quien entrega, de quien participa como titular en la facturación municipal y de quien recibe la liquidación son hechos distintos. Para un mismo establecimiento/SOE puede darse A → B → C: A presenta la entrega, B es titular cuando el Colegio factura al Ayuntamiento y C es titular destinatario al liquidar. Cambios posteriores del catálogo no deben reescribir la identidad registrada en esas operaciones.
- El catálogo local contiene farmacias actuales y se actualiza manualmente con datos ficticios. El MVP no gestiona histórico de titulares ni traspasos, no integra la aplicación corporativa que los gestiona y no resuelve titularidades anteriores automáticamente. Los snapshots conservan lo registrado, pero no certifican que el catálogo estuviera actualizado al capturarlos.
- No se crea historial de asignaciones, tabla de vigencias ni snapshot adicional del ayuntamiento para las entregas.
- No existe estado ACTIVA/INACTIVA en el MVP.
- La ausencia de precintos en un periodo no significa que la farmacia esté inactiva.
- Los datos bancarios de FARMACIA representan la cuenta actual.

**Alcance de identidad histórica:** la relación con `farmacia.id` y el SOE identifican el establecimiento del catálogo, no necesariamente a su titular en cada fecha. La entrega conserva denominación y CIF/NIF del catálogo al crearla; esos datos identifican a quien figura en la entrega, no necesariamente al participante de una factura o al destinatario de un pago posterior. No existe historial de titulares ni una fuente para reconstruirlo.

`ayuntamiento_id` es una FK opcional ya reflejada en `db/schema.sql`. Las instalaciones existentes requieren verificar su adaptación según `db/README.md`; esta revisión no comprueba ninguna base. El CRUD conserva alta con Ayuntamiento y PUT sin modificación de asignación. POST/DELETE municipales aplican la regla de ausencia de actividad y origen esperado; Entregas/lecturas comparten bloqueo municipal y revalidan asociación. La FK sola garantiza existencia, no ese protocolo de negocio.

### MEDICAMENTO

Contiene la identificación, clasificación, precio, pertenencia a la lista general de medicamentos autorizados y situación comercial de cada medicamento. La pertenencia/autorización y la situación comercial son conceptos independientes.

| Campo | Utilidad |
|---|---|
| `id` | Identificador interno. |
| `codigo_nacional` | Código nacional identificativo. |
| `descripcion` | Descripción del medicamento. |
| `precio` | Precio actual. |
| `estado` | Situación `ACTIVO` o `INACTIVO` utilizada para representar la pertenencia a la lista general/autorización general; no representa la baja comercial. |
| `situacion_comercial` | Situación comercial obligatoria e independiente: `ALTA` o `BAJA`, sin valor por defecto. |
| `tipo_facturacion` | Tipo de convenio o facturación al que pertenece. |
| `grupo_terapeutico` | Grupo terapéutico. |
| `codigo_laboratorio` | Código del laboratorio. |
| `gtatc` | Clasificación GTATC. |
| `nombre_grupo` | Nombre del grupo asociado. |
| `anexo` | Información opcional utilizada para información y filtrado; no representa convenios o anexos estructurados. |

Reglas:

- `codigo_nacional` es obligatorio y único.
- `precio` representa el precio actual.
- `estado` admite `ACTIVO` o `INACTIVO`.
- `estado` mantiene su significado actual respecto de la lista general y la autorización; no debe utilizarse para representar la situación comercial.
- La situación comercial es independiente: `ALTA` o `BAJA`. Una BAJA autorizada y ACTIVO requiere elegir explícitamente admitir o apartar; INACTIVO nunca se admite.
- La aceptación exige ACTIVO, autorizaciones aplicables y ALTA o admisión explícita de BAJA, conforme al flujo posterior de Entregas implementado en `precinto.admision.js` y `lectura.service.js`. Cambios posteriores no invalidan precintos aceptados.
- La situación comercial se almacena en `situacion_comercial`, aprobada e incorporada a `db/schema.sql`; el modelo lógico, sección 4.3, define su tipo y restricciones. No se infiere de `estado` ni se asigna automáticamente a registros existentes.
- Corrección acordada el 5 de octubre de 2026, recogida en la guía canónica v5, A.5 y A.7: sustituye la regla anterior que no distinguía la baja comercial al registrar de los cambios posteriores.
- `tipo_facturacion` tiene el valor `TD` en el MVP.
- El diseño debe permitir futuros tipos de facturación.
- No existe histórico independiente de precios en el MVP.
- El precio histórico realmente usado se conserva en `PRECINTO.precio_aplicado`.

### AYUNTAMIENTO_MEDICAMENTO

Representa exclusivamente la autorización específica de un medicamento para un ayuntamiento.

| Campo | Utilidad |
|---|---|
| `id` | Identificador interno de la relación. |
| `ayuntamiento_id` | Ayuntamiento que autoriza el medicamento. |
| `medicamento_id` | Medicamento autorizado. |

Reglas:

- La combinación ayuntamiento + medicamento es única.
- No duplica código nacional, descripción ni precio.

### PERIODO

Representa el mes y año de operación.

| Campo | Utilidad |
|---|---|
| `id` | Identificador interno. |
| `mes` | Mes del periodo. |
| `anio` | Año del periodo. |

Reglas:

- Mes + año es único.
- No tiene estado ABIERTO/CERRADO.

### ENTREGA_FARMACIA_PERIODO

Agrupa la entrega de una farmacia en un periodo y conserva los totales informados por ella.

| Campo | Utilidad |
|---|---|
| `id` | Identificador interno. |
| `farmacia_id` | Farmacia que realiza la entrega. |
| `periodo_id` | Periodo de la entrega. |
| `denominacion_farmacia` | Snapshot A de la denominación al crear la entrega. |
| `cif_nif_farmacia` | Snapshot A del CIF/NIF al crear la entrega. |
| `precintos_informados` | Cantidad de precintos informada. |
| `importe_informado` | Importe informado. |

Reglas:

- Farmacia + periodo es único.
- Existe una única entrega por farmacia y periodo.
- `precintos_informados` e `importe_informado` son informativos.
- `precintos_informados` es opcional y puede ser `NULL`.
- `importe_informado` es opcional y puede ser `NULL`.
- En ambos campos, `NULL` significa que el dato no fue informado y cero significa que fue informado con valor cero.
- Las diferencias entre lo informado y lo calculado no bloquean automáticamente la facturación.

### PRECINTO

Registra un precinto válido, el medicamento identificado, el precio aplicado y su posición dentro del paquete.

| Campo | Utilidad |
|---|---|
| `id` | Identificador interno. |
| `entrega_id` | Entrega a la que pertenece. |
| `numero_paquete` | Número de paquete calculado dentro de la entrega. |
| `posicion_paquete` | Posición dentro del paquete. |
| `codigo_barras_original` | Contenido original leído o introducido. |
| `codigo_nacional` | Código nacional obtenido del precinto. |
| `medicamento_id` | Medicamento identificado. |
| `precio_aplicado` | Precio utilizado para ese precinto concreto. |
| `precio_referencia` | Referencia conservada separadamente: catálogo observado al admitir nuevas lecturas; en las anteriores a 005, valor aplicado conservado al migrar, sin garantía de coincidencia con el catálogo original. No cambia durante correcciones. |

Reglas:

- Un registro PRECINTO representa siempre un precinto válido.
- Su elegibilidad se determina al registrar: ACTIVO y autorizado, de ALTA o BAJA con admisión explícita; en lista específica se exige además la relación municipal.
- La facturación usa los precintos aceptados para el periodo mensual de su entrega sin reevaluar los estados ni listas actuales, aunque después cambien. No se posponen a meses posteriores.
- El registro válido conserva el resultado de aceptación; `precio_aplicado` conserva su importe y `entrega_id` vincula el periodo mediante ENTREGA_FARMACIA_PERIODO. No conserva por sí solo los estados y autorizaciones observados al aceptar; la necesidad y representación de esa evidencia histórica quedan pendientes.
- Un precinto válido equivale a una receta.
- El mismo código nacional puede aparecer varias veces.
- `precio_aplicado` se copia desde el precio actual del medicamento al registrar el precinto.
- Regla vigente v26 (12 de octubre): corregir precio_aplicado cambia únicamente el precinto seleccionado por su ID, conservando su precio_referencia. No altera otras lecturas ni maestro. SIN_FACTURAR, REVISION y REABIERTA sin cobros permiten nuevas lecturas y corrección; EMITIDA bloquea ambas hasta reapertura permitida; cualquier cobro bloquea ambas y también impide reabrir. No requiere cabecera/participación preparada; recalcula la participación existente si la hay y mantiene documentos originales hasta reemitir. Sustituye la regla agrupada anterior del mismo día.
- Cambiar posteriormente `MEDICAMENTO.precio` no modifica los precintos anteriores.
- No se guarda el origen escáner/manual.
- No se guarda un orden global de lectura.
- Los paquetes no son una entidad independiente.
- Cada paquete contiene como máximo 15 precintos.
- `numero_paquete` y `posicion_paquete` se gestionan automáticamente.
- Si se elimina un precinto válido mientras la facturación es editable, se reorganizan los paquetes y posiciones.

### INCIDENCIA

Registra una anomalía asociada a una entrega que no constituye un precinto válido.

| Campo | Utilidad |
|---|---|
| `id` | Identificador interno. |
| `entrega_id` | Entrega en la que se produjo. |
| `codigo_barras_original` | Contenido original leído o introducido. |
| `codigo_nacional` | Código nacional identificado, cuando corresponda. |
| `motivo` | Motivo de la incidencia. |
| `observaciones` | Información adicional opcional. |

Motivos implementados:

- `MEDICAMENTO_DESCONOCIDO`.
- `MEDICAMENTO_NO_AUTORIZADO`.
- `MEDICAMENTO_INACTIVO`.
- `BAJA_COMERCIAL_RECHAZADA_USUARIO`.

Reglas:

- No es un precinto válido.
- No pertenece a ningún paquete.
- No tiene precio aplicado.
- No entra en facturación.
- «NO ESTÁ» describe ausencia de autorización, no un estado de MEDICAMENTO. Apartar una BAJA elegible usa `BAJA_COMERCIAL_RECHAZADA_USUARIO`.
- `observaciones` es opcional.
- Puede eliminarse mientras la facturación sea editable.

### OPERACION_LECTURA

Entidad técnica implementada: `id` entero autogenerado; `entrega_id` obligatorio; `clave` UUID obligatorio; `solicitud` JSONB opcional; `retirada` booleano obligatorio con valor inicial FALSE; `precinto_id` e `incidencia_id` opcionales.

- UNIQUE de `(entrega_id, clave)` y de cada destino por separado. Cada lectura puede tener cero o un recibo; las anteriores pueden carecer de clave.
- Activa: solicitud objeto JSON y exactamente un destino. Retirada: solicitud y ambos destinos NULL. Los CHECK garantizan estas alternativas.
- Las FK compuestas `(precinto_id, entrega_id)` y `(incidencia_id, entrega_id)` garantizan que el destino pertenezca a la misma entrega. Tienen `ON DELETE CASCADE`; la FK directa a la entrega usa RESTRICT.
- El servicio guarda lectura/recibo conjuntamente. Antes de borrar una lectura purga solicitud y referencias y conserva entrega/clave/marcador para impedir recrearla por reenvío tardío. SQL directo que omita ese protocolo podría activar la cascada. No conserva contenido eliminado ni fecha de borrado y no es auditoría completa.

### FACTURACION

Representa el proceso de facturación de un ayuntamiento para un periodo y un tipo de convenio o facturación.

| Campo | Utilidad |
|---|---|
| `id` | Identificador interno. |
| `ayuntamiento_id` | Ayuntamiento facturado. |
| `periodo_id` | Periodo facturado. |
| `tipo_facturacion` | Tipo de convenio o conjunto de medicamentos facturado. |
| `fecha_factura` | Fecha común de facturación. |
| `nombre_presidente_historico` | Presidente del Colegio emisor copiado desde la configuración actual en primera emisión, conservado tras reemisión. Si falta, se advierte y el documento muestra «No consta el presidente histórico». |
| `estado` | REVISION inicial, EMITIDA o REABIERTA correctiva. |

Reglas:

- Ayuntamiento + periodo + `tipo_facturacion` es único.
- `tipo_facturacion` tiene el valor `TD` en el MVP y representa el tipo de convenio o facturación, no el tipo de factura.
- `fecha_factura` es el último día del periodo.
- Desde el bloque aprobado del 11 de octubre de 2026, la cabecera en REVISION permite corregir entregas y B, sin emitir ninguna factura. La mera existencia de cabecera no cierra las entregas.
- EMITIDA bloquea entregas y congela B; si ninguna factura tiene cobro puede pasar a REABIERTA, registrando fecha/motivo. REABIERTA permite corregir las entregas, manteniendo B y las participaciones ya emitidas.
- Si alguna factura está cobrada, no puede reabrirse.
- Cada PARTICIPACION_FACTURACION enlaza una facturación con una entrega y conserva la identidad B al emitir; B no se infiere de la identidad A de la entrega ni de una consulta posterior del catálogo.
- El informe anual operativo de precintos se agrupa por trimestre del periodo facturado, suma los precios aplicados de los precintos aptos y excluye COMISION. No es una declaración ni un informe fiscal.

### PARTICIPACION_FACTURACION

Representa la contribución de una entrega de farmacia y periodo a la facturación municipal y conserva el snapshot B de quien figura al emitir.

| Campo | Utilidad |
|---|---|
| `id` | Identificador interno. |
| `facturacion_id` | Facturación municipal a la que contribuye la entrega. |
| `entrega_id` | Entrega única de farmacia y periodo que aporta los precintos. |
| `soe_b` | SOE conservado como parte de la identidad B al emitir. |
| `denominacion_b` | Denominación conservada como parte de B al emitir. |
| `cif_b` | CIF conservado como parte de B al emitir. |
| `importe_precintos` | Suma de `precio_aplicado` de los precintos aptos de la entrega, contados una sola vez. |

Reglas:

- Una entrega se incorpora una sola vez a la facturación que le corresponde; la participación no duplica ni crea precintos.
- En revisión inicial solo una entrega con uno o más precintos aptos genera participación; si pierde todos los aptos se retira ese borrador. Una participación ya emitida se conserva en reapertura aunque su corrección deje cantidad/importe cero. Si no hay aptos se muestra advertencia, sin crear participaciones ni facturas nuevas.
- Los precintos aptos se alcanzan por la relación con su entrega. Las incidencias no forman parte del importe.
- B puede corregirse antes de emitir y queda congelado al emitir. Una reapertura permitida recalcula la participación y actualiza las facturas existentes si cambia el importe; conserva B y los números oficiales originales.
- La relación estructural con la farmacia se obtiene desde la entrega. `soe_b` es un snapshot histórico, no una FK ni sustituto del identificador de la entrega.

### FACTURA

Representa cada uno de los dos documentos económicos asociados a una facturación: PRECINTOS y COMISION.

| Campo | Utilidad |
|---|---|
| `id` | Identificador interno. |
| `facturacion_id` | Facturación a la que pertenece. |
| `tipo` | Identifica si es de precintos o de comisión. |
| `numero_factura` | Número oficial introducido manualmente. |
| `numero_precintos` | Cantidad de precintos válidos facturados. |
| `importe_total` | Importe total de la factura. |
| `base_calculo` | Importe utilizado como base para calcular la comisión. |
| `porcentaje_comision` | Porcentaje de comisión aplicado y conservado como histórico. |
| `importe_comision` | Importe de comisión calculado. |
| `porcentaje_iva` | Porcentaje de IVA aplicado y conservado como histórico. |
| `importe_iva` | Importe de IVA calculado. |
| `configuracion_facturacion_id` | Configuración usada para calcular la factura de comisión. |

Reglas:

- `tipo` admite `PRECINTOS` o `COMISION`.
- Facturación + tipo es único.
- `numero_factura` es obligatorio, manual y único dentro de su tipo/serie en todos los periodos.
- Es el único dato económico o documental introducido manualmente por el usuario en la factura.
- Una FACTURACION genera conjuntamente una factura PRECINTOS y una factura COMISION.
- Antes de generar las dos facturas, el usuario debe conocer e introducir ambos números oficiales proporcionados por Contabilidad.
- Si falta cualquiera de los dos números, no se completa la generación de la facturación.
- Las filas FACTURA se crean con `numero_factura` ya informado, que es obligatorio desde el momento de su creación.
- No existen facturas borrador sin número en el MVP.
- Los números oficiales de PRECINTOS y COMISION pueden coincidir entre series distintas; ningún número se repite dentro de una misma serie, tampoco en periodos diferentes.
- La fecha se obtiene desde FACTURACION.
- En PRECINTOS:
  - `numero_precintos` es la cantidad de precintos válidos.
  - `importe_total` es la suma de `precio_aplicado`.
- En COMISION:
  - `base_calculo` es el `importe_total` de PRECINTOS.
  - `porcentaje_comision` se obtiene de la configuración vigente.
  - `importe_comision` se calcula automáticamente.
  - `porcentaje_iva` se obtiene de la configuración vigente.
  - `importe_iva` se calcula automáticamente.
  - `importe_total` es la suma de la comisión y el IVA.
- La factura de COMISION se calcula en esta secuencia:
  1. Obtener `base_calculo`.
  2. Calcular `importe_comision`.
  3. Redondear `importe_comision` a dos decimales.
  4. Calcular el IVA sobre el `importe_comision` ya redondeado.
  5. Redondear `importe_iva` a dos decimales.
  6. Calcular `importe_total = importe_comision + importe_iva`.
  7. Redondear `importe_total` a dos decimales.
- Los porcentajes aplicados se guardan en FACTURA como histórico.
- `configuracion_facturacion_id` referencia la configuración usada por la factura de COMISION.
- El tipo y la precisión concretos de PostgreSQL se especifican en `modelo-logico-postgresql.md`.

### COBRO

Registra el cobro completo de una factura.

| Campo | Utilidad |
|---|---|
| `id` | Identificador interno. |
| `factura_id` | Factura cobrada. |
| `fecha_cobro` | Fecha del cobro. |
| `importe_cobrado` | Importe cobrado. |
| `justificante` | Referencia al justificante bancario. |

Reglas:

- Cada factura puede tener como máximo un cobro.
- No existen cobros parciales en el MVP.
- `importe_cobrado` debe coincidir con `FACTURA.importe_total`.
- PRECINTOS y COMISION se cobran independientemente.
- `justificante` representa la referencia al justificante bancario.
- Si existe cobro en cualquiera de las dos facturas, la facturación no puede reabrirse.

### REAPERTURA_FACTURACION

Registra cada reapertura de una facturación y su motivo.

| Campo | Utilidad |
|---|---|
| `id` | Identificador interno. |
| `facturacion_id` | Facturación reabierta. |
| `fecha_reapertura` | Fecha y momento de la reapertura. |
| `motivo` | Justificación de la reapertura. |

Reglas:

- Una facturación puede tener varias reaperturas.
- `motivo` es obligatorio.
- `fecha_reapertura` se asigna automáticamente.
- Solo puede reabrirse si ninguna factura tiene cobro.
- Al reabrir pueden modificarse precintos, incidencias y precios aplicados.
- Si una reapertura correctiva previa a cualquier cobro cambia los importes, solo al reemitir conjuntamente se actualiza la factura existente con el importe recalculado y se conservan los números oficiales originales de PRECINTOS y COMISION; no se asignan números nuevos.
- Cada reapertura registra automáticamente su fecha y el motivo obligatorio.
- No se crea una segunda facturación del mismo ayuntamiento, periodo y tipo.
- No se implementa un histórico complejo de versiones de cada precinto.

### PAGO_FARMACIAS

Representa el pago conjunto a las farmacias derivado de una facturación.

| Campo | Utilidad |
|---|---|
| `id` | Identificador interno. |
| `facturacion_id` | Facturación que origina el pago. |
| `fecha_pago` | Fecha común del pago a las farmacias participantes. |

Reglas:

- Una facturación puede tener como máximo un PAGO_FARMACIAS.
- Solo puede prepararse después del cobro de la factura de PRECINTOS.
- `fecha_pago` es común a todas las farmacias participantes.
- La aplicación puede sugerir el siguiente día laborable de lunes a viernes, pero el usuario puede confirmarlo o modificarlo.

### DETALLE_PAGO_FARMACIA

Conserva como snapshot el importe y los datos de cada farmacia incluidos en un pago.

| Campo | Utilidad |
|---|---|
| `id` | Identificador interno. |
| `pago_farmacias_id` | Pago al que pertenece. |
| `participacion_facturacion_id` | Participación cuyo importe y titular se liquidan. |
| `soe` | SOE utilizado al preparar el pago. |
| `denominacion_farmacia` | Denominación utilizada al preparar el pago. |
| `cif_nif` | Identificador fiscal utilizado para el pago. |
| `importe` | Importe calculado para la farmacia. |
| `pais_control_iban` | Componente de país y control del IBAN utilizado. |
| `entidad_bancaria` | Código de entidad bancaria utilizado. |
| `sucursal_bancaria` | Código de sucursal bancaria utilizado. |
| `digito_control_bancario` | Dígitos de control utilizados. |
| `cuenta_bancaria` | Número de cuenta utilizado. |

Reglas:

- Cada participación puede tener como máximo un detalle de pago.
- Cada detalle se enlaza con una participación y una participación solo puede liquidarse una vez.
- No se guarda `farmacia_id`.
- Es un snapshot histórico de los datos revisados usados al confirmar la liquidación, sin ejecutar transferencias.
- El SOE de este snapshot es un dato copiado, no una relación. La relación histórica del detalle se establece con PARTICIPACION_FACTURACION.
- C y cuenta se proponen desde FARMACIA actual al preparar; pueden revisarse y corregirse antes de confirmar. La propuesta no persiste pagos/borradores. La confirmación guarda los datos explícitamente revisados y el importe completo como snapshots, junto con la fecha elegida, en una sola transacción.
- El detalle representa un snapshot del destinatario y los datos revisados al confirmar la liquidación. La preparación los propone desde el catálogo actual y la confirmación conserva los valores explícitamente revisados; no existe historial de titulares ni garantía de catálogo actualizado. En A → B → C, representa a C y no prueba que C fuera quien figuraba en la factura municipal (B).
- Una modificación posterior de FARMACIA no altera el histórico del pago.
- `importe` se calcula a partir de los precintos válidos de esa farmacia.
- La suma de los detalles debe coincidir con el total de la factura de PRECINTOS.
- Solo se incluyen farmacias que participaron realmente en la facturación.
- La participación conserva B; el detalle conserva C y la cuenta realmente utilizada. Son snapshots separados aunque sus datos coincidan.

### CONFIGURACION_FACTURACION

Define los porcentajes de comisión e IVA aplicables durante un intervalo de vigencia.

| Campo | Utilidad |
|---|---|
| `id` | Identificador interno. |
| `porcentaje_comision` | Porcentaje de comisión aplicable. |
| `porcentaje_iva` | Porcentaje de IVA aplicable. |
| `fecha_inicio` | Comienzo de la vigencia. |
| `fecha_fin` | Final opcional de la vigencia. |

Reglas:

- Permite histórico por vigencia.
- `fecha_inicio` es obligatoria.
- `fecha_fin` puede estar vacía para la configuración vigente.
- Los periodos de vigencia no pueden solaparse.
- La configuración aplicable se selecciona según `FACTURACION.fecha_factura`.
- Una nueva configuración no sobrescribe la anterior.
- Los porcentajes realmente utilizados se copian además a FACTURA.

### CONFIGURACION_DOCUMENTOS

Contiene la configuración visual actual utilizada para emitir documentos.

| Campo | Utilidad |
|---|---|
| `id` | Identificador interno. |
| `logo_personalizado` | Referencia al logo personalizado. |
| `nombre_presidente` | Nombre actual configurable del presidente del Colegio emisor; se copia a FACTURACION en la primera emisión. |
| `firma` | Referencia opcional a la firma. |
| `mostrar_firma` | Indica si la firma debe aparecer. |
| `datos_emisor` | Datos actuales del emisor para el pie de las facturas; JSONB con denominación, CIF, dirección y contacto opcional. |

Reglas:

- Existe una configuración documental actual.
- Si no existe logo personalizado, se utiliza el logo general del proyecto.
- `nombre_presidente` es el nombre actual configurable; cambiarlo o dejarlo vacío no modifica ni completa retrospectivamente `FACTURACION.nombre_presidente_historico`, tampoco al reemitir.
- `firma` es opcional.
- `mostrar_firma` controla si aparece.
- No necesita histórico de vigencia en el MVP.
- No se relaciona directamente con FACTURA.
- Se generan HTML imprimible y Excel XML desde los datos almacenados. Guardar PDF depende del navegador, sin motor PDF en el servidor.
- Los documentos históricos pueden regenerarse con la configuración visual vigente sin alterar los datos económicos históricos.
- Documentos implementados según documentos-facturacion/spec: configuración única actual, logo PNG/JPEG base64 validado en PostgreSQL, sin referencias arbitrarias de archivos. Logo y emisor actuales se usan en reimpresiones. El presidente es el del Colegio emisor: FACTURACION.nombre_presidente_historico lo captura en primera emisión, conservándolo tras reapertura/reemisión. Si falta ese histórico, el servicio devuelve una advertencia y las plantillas de las cuatro vistas muestran «No consta el presidente histórico»; no se omite simplemente ni se sustituye por el nombre actual. No se implementa imagen de firma en este alcance.

## Relaciones principales

- AYUNTAMIENTO 0:N FARMACIA; cada FARMACIA se relaciona con 0:1 AYUNTAMIENTO.
- FARMACIA 1:0..N ENTREGA_FARMACIA_PERIODO; cada entrega tiene exactamente una farmacia.
- PERIODO 1:0..N ENTREGA_FARMACIA_PERIODO; cada entrega tiene exactamente un periodo (no es N:M).
- ENTREGA_FARMACIA_PERIODO 1:0..N PRECINTO.
- ENTREGA_FARMACIA_PERIODO 1:0..N INCIDENCIA.
- MEDICAMENTO 1:0..N PRECINTO.
- AYUNTAMIENTO N:M MEDICAMENTO mediante AYUNTAMIENTO_MEDICAMENTO.
- AYUNTAMIENTO 1:0..N FACTURACION.
- PERIODO 1:0..N FACTURACION.
- FACTURACION 1:0..2 FACTURA en SQL; en REVISION no hay facturas y el servicio de emisión crea exactamente dos conjuntamente.
- FACTURACION emitida 1:1..N PARTICIPACION_FACTURACION; no se emite una facturación vacía.
- ENTREGA_FARMACIA_PERIODO 1:0..1 PARTICIPACION_FACTURACION; cada participación corresponde a exactamente una entrega.
- PARTICIPACION_FACTURACION alcanza 0..N PRECINTO de su entrega mediante ENTREGA_FARMACIA_PERIODO, sin FK directa. En primera emisión tiene aptos; tras corrección en REABIERTA puede quedar a cero sin perder B.
- FACTURA 1:0..1 COBRO.
- FACTURACION 1:0..N REAPERTURA_FACTURACION.
- FACTURACION 1:0..1 PAGO_FARMACIAS.
- PAGO_FARMACIAS 1:0..N DETALLE_PAGO_FARMACIA en SQL; el servicio confirma el lote completo con uno o más detalles.
- PARTICIPACION_FACTURACION 1:0..1 DETALLE_PAGO_FARMACIA.
- CONFIGURACION_FACTURACION 1:0..N FACTURA de tipo COMISION; PRECINTOS carece de esa FK por CHECK.
- ENTREGA_FARMACIA_PERIODO 1:0..N OPERACION_LECTURA; cada operación activa referencia un PRECINTO o una INCIDENCIA de su entrega, cada lectura admite 0..1 recibo. Retirada no referencia ninguna lectura.
- CONFIGURACION_DOCUMENTOS admite 0..1 fila global por índice único, sin FK documental.

El diagrama v2 muestra cardinalidades SQL. Los mínimos al emitir/confirmar, la igualdad municipal/periodo de participación y el bloqueo de reapertura tras cobros son reglas de servicio; véase el registro de revisión.

## Diferencia entre tipo de facturación y tipo de factura

- `FACTURACION.tipo_facturacion` identifica el tipo de convenio o conjunto de medicamentos facturados. En el MVP su valor es `TD`.
- `FACTURA.tipo` identifica cuál de los dos documentos económicos es: `PRECINTOS` o `COMISION`.

Ambos conceptos tienen propósitos distintos y no deben confundirse.

La relación entre el tipo de facturación y los precintos se rige por estas reglas:

- Una FACTURACION solo puede incluir precintos válidos cuyo medicamento tenga el mismo `tipo_facturacion` que la facturación.
- En el MVP, `MEDICAMENTO.tipo_facturacion = TD` y `FACTURACION.tipo_facturacion = TD`.
- La correspondencia entre ambos valores debe mantenerse conceptualmente cuando se incorporen futuros tipos de facturación.

## Listas de medicamentos

- La lista general se representa mediante MEDICAMENTO con `estado = ACTIVO`.
- Si `AYUNTAMIENTO.tipo_lista_medicamentos = GENERAL`, estar ACTIVO basta para la autorización general; la aceptación del precinto exige además `ALTA` al registrar.
- Si `AYUNTAMIENTO.tipo_lista_medicamentos = ESPECIFICA`, el medicamento debe estar ACTIVO y existir además en AYUNTAMIENTO_MEDICAMENTO.
- En modalidad `GENERAL`, AYUNTAMIENTO_MEDICAMENTO se conserva, pero no se aplica. La ficha muestra las asociaciones específicas existentes con el aviso «No se aplica mientras se utiliza la lista general».
- Al volver a modalidad `ESPECIFICA`, las asociaciones específicas conservadas vuelven a aplicarse junto con la autorización general `ACTIVO`; la condición comercial `ALTA` para aceptar nuevas lecturas se mantiene según las reglas vigentes.
- Cambiar `tipo_lista_medicamentos` no elimina automáticamente asociaciones. No se crea un histórico de cambios de listas.
- La lista específica es adicional a la lista general; pertenecer a la lista específica no sustituye la pertenencia a la general. Una lista específica vacía no convierte la modalidad del ayuntamiento en GENERAL.
- Un medicamento INACTIVO no autoriza nuevas lecturas aunque permanezca relacionado con AYUNTAMIENTO_MEDICAMENTO. No invalida las lecturas aceptadas previamente.
- ALTA/BAJA no modifica la autorización. BAJA elegible exige elección explícita; listas y estados se comprueban al registrar, sin reevaluarlos al facturar aceptados.
- El esquema almacena la situación comercial por separado en `situacion_comercial`. Según la confirmación del autor, el cambio se aplicó a `gestion_facturacion_medicamentos_test` con la tabla `medicamento` vacía; la base de desarrollo no se modificó. Esto no implica que otras instalaciones estén migradas.

## Reglas de integridad

- `AYUNTAMIENTO.cif` es obligatorio y único.
- `FARMACIA.soe` es único.
- En el modelo objetivo, `FARMACIA.ayuntamiento_id` es una FK opcional a `AYUNTAMIENTO.id`; su nulabilidad no cambia la identidad interna `FARMACIA.id`.
- `MEDICAMENTO.codigo_nacional` es único.
- `PERIODO` debe ser único por mes y año.
- `ENTREGA_FARMACIA_PERIODO` debe ser única por farmacia y periodo.
- `AYUNTAMIENTO_MEDICAMENTO` debe ser único por ayuntamiento y medicamento.
- `FACTURACION` debe ser única por ayuntamiento, periodo y tipo_facturacion.
- `FACTURA` debe ser única por facturacion y tipo.
- `FACTURA` es única por `(tipo, numero_factura)` en todos los periodos; el tipo identifica la serie oficial.
- `db/schema.sql` aplica unicidad de factura por `(tipo, numero_factura)`; la restricción global se retiró del esquema.
- Cada entrega se incorpora como máximo a una participación, y cada participación pertenece a una facturación y una entrega.
- `COBRO` solo puede existir una vez por factura.
- `PAGO_FARMACIAS` solo puede existir una vez por facturación.
- `DETALLE_PAGO_FARMACIA` debe tener una única participación; una participación puede tener como máximo un detalle.

## Reglas de negocio

- Un precinto válido pertenece a una entrega, tiene medicamento y `precio_aplicado` y entra en facturación.
- Una incidencia no es un precinto válido, no ocupa paquete y no entra en facturación.
- Los paquetes no son una entidad propia; se representan mediante `numero_paquete` y `posicion_paquete` en PRECINTO.
- El importe de la factura de PRECINTOS es la suma de `precio_aplicado` de los precintos válidos.
- El número de precintos facturados se obtiene del número de precintos válidos.
- La base de la factura de COMISION es el importe total de la factura de PRECINTOS.
- El porcentaje de comisión y el IVA se obtienen de CONFIGURACION_FACTURACION y se copian a FACTURA como histórico.
- La fecha de facturación es el último día del periodo y se guarda en FACTURACION.
- No hay cobros parciales en el MVP.
- Si alguna factura tiene cobro, la facturación no puede reabrirse.
- La reapertura requiere motivo.
- PAGO_FARMACIAS solo se genera después del cobro de la factura de PRECINTOS.
- DETALLE_PAGO_FARMACIA guarda una foto histórica de SOE, denominación, CIF/NIF, cuenta bancaria e importe.
- HTML imprimible y Excel XML se generan desde los datos almacenados; no son entidades. El PDF lo guarda el navegador.
- La lista general de medicamentos se representa mediante MEDICAMENTO con estado ACTIVO. Este `estado` representa pertenencia/autorización general y no situación comercial.
- Si un ayuntamiento usa lista específica, el medicamento debe estar ACTIVO y además existir en AYUNTAMIENTO_MEDICAMENTO.
- Al registrar se exige ACTIVO y autorización aplicable; BAJA elegible requiere admitir/apartar explícitamente. Las lecturas aceptadas se facturan en su periodo sin reevaluar estados ni listas actuales.
- El precio actual se guarda en MEDICAMENTO y el precio realmente aplicado se conserva en `PRECINTO.precio_aplicado`.
- Todos los importes monetarios se expresan con dos decimales.
- Todos los cálculos monetarios intermedios se redondean a dos decimales.
- El redondeo se decide a partir del tercer decimal.
- El total final también se redondea a dos decimales.
- Los valores históricos almacenados conservan los importes ya redondeados.

## Decisiones de diseño

- **PAQUETE no es una entidad** porque no aporta un ciclo de vida ni atributos propios que requieran persistencia independiente; su composición se determina con `numero_paquete` y `posicion_paquete` en los precintos.
- **PRECINTO guarda `precio_aplicado`** para conservar el precio utilizado en ese precinto y evitar que cambios posteriores en `MEDICAMENTO.precio` modifiquen automáticamente la facturación.
- **PARTICIPACION_FACTURACION conserva B y el importe de una entrega** para atribuir el total al titular correcto al emitir, enlazarlo con la actividad original y actualizar la misma participación si una reapertura pre-cobro modifica el cálculo.
- **DETALLE_PAGO_FARMACIA conserva datos duplicados como snapshot histórico** de SOE, denominación, CIF/NIF, cuenta bancaria e importe utilizados para preparar el pago, incluso si posteriormente cambian los datos maestros de la farmacia.
- **FACTURACION y FACTURA son entidades separadas** porque la primera representa el proceso agregado por ayuntamiento, periodo y tipo, mientras que la segunda representa cada documento económico resultante, incluidos PRECINTOS y COMISION.
- **Algunos estados se deducen de los datos en lugar de almacenarse** para evitar inconsistencias: por ejemplo, la posibilidad de reapertura o la situación de cobro se infieren de la existencia de cobros, facturas y registros relacionados.
- **La asignación municipal de Farmacia es actual y opcional:** `NULL` representa ausencia de Ayuntamiento. Solo se cambia antes de la primera entrega o precinto y no se conserva historial de asignaciones. `db/schema.sql` ya admite NULL conservando la FK y el índice. Una base existente que todavía conserve `NOT NULL` debe aplicar `db/updates/001-farmacia-ayuntamiento-opcional.sql` según `db/README.md`; la actualización solo se ha verificado en la base dedicada de pruebas, no en todas las instalaciones.

## Datos derivados e históricos

### Datos calculables que no necesitan entidad o tabla adicional

- Estados deducibles de los cobros.
- Documentos PDF y Excel.
- La agrupación en paquetes se representa mediante `PRECINTO.numero_paquete` y `PRECINTO.posicion_paquete`; PAQUETE no es una entidad independiente.

### Datos que se congelan por trazabilidad

- `PRECINTO.precio_aplicado`.
- Porcentajes aplicados en FACTURA.
- Importes finales almacenados en FACTURA.
- Datos de DETALLE_PAGO_FARMACIA.
- Registros de COBRO.
- Registros de REAPERTURA_FACTURACION.

## Informe anual operativo de precintos

- Consulta implementada según facturación municipal spec §17. Solo participaciones EMITIDAS con factura PRECINTOS; REVISION se excluye. Decisión expresa del usuario: REABIERTA se excluye temporalmente y se advierte de las correcciones pendientes hasta reemitir. Agrupación por Ayuntamiento y farmacia estable de la entrega, conservando identidades B históricas sin atribuirlas al catálogo actual.

- El informe se agrupa por trimestre del periodo facturado, independientemente de las fechas de cobro municipal y pago a farmacias.
- Incluye el importe de PRECINTOS, calculado como suma de `precio_aplicado` de precintos aptos, y excluye COMISION.
- Puede mostrar el detalle mensual dentro de cada trimestre y total anual.
- Es un informe operativo del proyecto, no una declaración ni un informe fiscal.
- La identidad del participante en la factura municipal (B) y la del destinatario de la liquidación (C) pueden diferir y deben conservarse como hechos separados.

## Decisiones todavía abiertas

Los tipos, precisión, restricciones, acciones de claves foráneas e índices definidos se recogen en `modelo-logico-postgresql.md`. Siguen sin resolver:

- El contenido y formato funcional exactos de `MEDICAMENTO.anexo`.
- Si se necesita reconstruir exactamente las condiciones históricas de aceptación de un precinto y, en ese caso, qué evidencia adicional conservar.
- Los detalles técnicos de captura. Para BAJA elegible se mantiene elección explícita aceptar/apartar sin marca histórica adicional en el MVP; evidencia adicional como mejora futura, sin bloquear implementación. La clasificación de incidencia ya queda aprobada en la adenda.
- Timestamps técnicos de creación o modificación, si fueran necesarios.

## Histórico aprobado: objetivo de Entregas y precintos (8 de octubre de 2026)

Esta adenda conserva el objetivo aprobado entonces para ENTREGA_FARMACIA_PERIODO, PRECINTO e INCIDENCIA; las reglas posteriores de precios/estados y la revisión de entrega prevalecen. La adaptación de las columnas snapshot y los motivos ya está en `db/schema.sql`; la actualización incremental se aplicó a las bases local y de pruebas identificadas el 8 de octubre de 2026. La revisión documental v2 enlazada al principio representa el esquema actual con fuente editable; v1 permanece como histórico.

### ENTREGA_FARMACIA_PERIODO

Se mantiene la identidad por farmacia y periodo y la unicidad de esa pareja. Al objetivo se añaden `denominacion_farmacia TEXT NOT NULL` y `cif_nif_farmacia TEXT NOT NULL`, copiados desde FARMACIA al crear y congelados durante la vida de la entrega. `farmacia_id` sigue siendo relación estable. El usuario selecciona periodo y farmacia; el sistema obtiene y muestra el Ayuntamiento asociado, sin exigir su selección previa. El servidor comprueba la asociación municipal vigente mediante el protocolo de bloqueo existente; una farmacia sin Ayuntamiento no registra. La llegada física no cambia el periodo de imputación. Los datos declarados se conservan y pueden editarse mientras la facturación esté editable. PERIODO no tiene estado de apertura o cierre.

### PRECINTO

Cada fila representa un precinto admitido. Guardar el precinto 15 completa el paquete, pero no crea otro vacío. El siguiente precinto admitido materializa el siguiente paquete automáticamente si el último está completo, o por decisión expresa si está incompleto. El número nuevo es el mayor existente más uno (o 1 si no hay paquetes); solo se materializa al insertar su primer precinto. Las incidencias no crean paquetes ni se rellenan paquetes previos. Una corrección elimina físicamente una entrada errónea mientras la facturación sea editable, conserva el ID de las lecturas restantes y renumera solo posiciones del paquete afectado; si queda vacío, desaparece. Los demás paquetes no cambian. `precio_aplicado` conserva el precio de catálogo vigente al admitir; cambios futuros no reescriben el valor. No se aprueba motor o importación automática de precios.

La admisión exige reglas generales y, en modalidad ESPECIFICA, autorización municipal específica. GENERAL conserva asociaciones específicas sin aplicarlas; lista específica vacía no es GENERAL. `INACTIVO` siempre genera incidencia. `ACTIVO` autorizado `BAJA` requiere decisión del usuario: admitir o apartar; la aceptación no elude otra condición. Decisión aprobada: no añadir marca histórica de aceptación BAJA al MVP; evidencia adicional como mejora futura, sin bloquear implementación. Cambios posteriores de estado/listas no invalidan filas aceptadas. Requiere revisión cualquier propuesta histórica de corrección excepcional de precios.

### INCIDENCIA

Sigue relacionada directamente con ENTREGA_FARMACIA_PERIODO, sin paquete ni precio facturable. Motivos aprobados objetivo: `MEDICAMENTO_DESCONOCIDO`, `MEDICAMENTO_NO_AUTORIZADO`, `MEDICAMENTO_INACTIVO`, `BAJA_COMERCIAL_RECHAZADA_USUARIO`. Código desconocido puede carecer de código nacional y medicamento asociado. No se implementa resolución/reincorporación. Cada aviso requiere confirmación para continuar; confirmar no autoriza el medicamento.

### Regla de entrada y agregados

EAN-13 prefijo `847000`: extraer seis dígitos de posiciones 7–12; entrada manual de seis dígitos. Códigos se conservan como texto, se preserva entrada original y el dígito de control no se valida hasta aprobación. Un evento de lectura genera una operación por precinto; códigos nacionales repetidos son admisibles. Total registrado = admitidos + incidencias; subtotal facturable = suma de `precio_aplicado` de admitidos. Diferencias contra declarados son informativas y no bloquean.

### Diferencia con esquema y cuestiones abiertas

`db/schema.sql` incorpora los dos snapshots obligatorios y los cuatro motivos de INCIDENCIA. La actualización incremental 002 se aplicó y verificó en las bases locales indicadas en `db/README.md`; otras instalaciones requieren comprobación individual, sin recrear bases ni rellenar snapshots históricos desde el maestro actual. La API captura los snapshots desde la farmacia bloqueada y conserva los existentes; declarados, lecturas, consultas, eliminación permitida e interfaces están implementados según `docs/specs/entregas-precintos/` y `docs/specs/interfaz-entregas-precintos/`. La falta de respuesta de guardado se resuelve mediante idempotencia y consulta de operación; el uso con hardware físico del lector y la validación del dígito de control EAN-13 siguen fuera de la implementación verificada. La evidencia adicional de aceptación BAJA es una mejora futura, sin marca histórica ni bloqueo del flujo actual.

## Diagrama entidad-relación

Las fechas de las notas históricas siguientes identifican los hitos documentados originalmente. Sus aclaraciones de estado vigente se contrastan en esta revisión documental del 18 de octubre de 2026, sin fechar de nuevo las implementaciones ni repetir las verificaciones de bases indicadas en `db/README.md`.

### Histórico de implementación: protección de operaciones de lectura (8 de octubre de 2026; estado documental actualizado)

El backend de Entregas guarda precintos admitidos/incidencias confirmadas y asigna paquetes según spec §17. La entidad técnica OPERACION_LECTURA identifica una petición completada por UUID dentro de una entrega y enlaza exactamente un PRECINTO o una INCIDENCIA de esa misma entrega. Guarda la petición normalizada para detectar cambio de contenido/decisión, sin duplicar datos de lectura ni convertir decisiones BAJA en historial adicional. Precio aplicado procede del catálogo revalidado, con locks hasta commit. Lectura y protección se guardan en una sola transacción; pendientes no consumen clave y operaciones completadas no se reevalúan.

GET por entrega/clave resuelve respuesta perdida; misma clave/contenido recupera una lectura, distinto contenido es conflicto y distintas claves permiten códigos repetidos. La captura visual mediante teclado/Enter, la reconciliación por clave, la idempotencia y los permisos vigentes están implementados; la validación con lector físico real y la del dígito de control EAN-13 siguen pendientes; la reapertura controlada también está disponible según facturación municipal. El borrado conserva la clave retirada sin contenido conforme a la actualización 004; una nueva lectura legítima usa otra clave. No se añade entidad PAQUETE. Datos anteriores se conservan sin claves inventadas; 003 y 004 están aplicados y verificados en las bases locales indicadas en db README. Esta nota histórica no sustituye los contratos vigentes de las especificaciones de módulo.

### Histórico de implementación: consultas, eliminación y claves retiradas (8 de octubre de 2026)

Política aprobada expresamente por el usuario: la eliminación física conserva únicamente entrega/clave/marcador de retirada (más ID técnico), sin solicitud, código, precio, motivo, decisión ni referencias a la lectura. Sustituye la propuesta previa de liberar la clave por cascada; una repetición tardía debe rechazarse sin recrear contenido. OPERACION_LECTURA activa sigue enlazada a exactamente una lectura; retirada exige solicitud y ambas referencias NULL. No se guarda historial del contenido eliminado, ni fecha de borrado. Una nueva lectura legítima usa otra clave; no hay purga automática de claves retiradas.

Consultas de precintos, incidencias y resumen implementadas según spec §18, con precio aplicado histórico y totales NUMERIC exactos, diferencias NULL para declarados ausentes. DELETE está protegido por los permisos financieros vigentes y el protocolo común; retira la clave, elimina y renumera solo posiciones del paquete afectado en una transacción. Mantiene IDs y otros paquetes; vacío desaparece, siguiente nuevo MAX + 1 o 1. Repetición de operación activa devuelve posición vigente; retirada se identifica sin recuperar contenido. 004 está aplicado y verificado en las bases locales según db README. El registro, consulta y corrección de lecturas y los flujos financieros del MVP están implementados con los límites descritos en el README, sin ejecución bancaria de transferencias. La actualización del SVG v1 procedente de main se conserva; el diagrama vigente para la entrega es v2.

Diagrama vigente: [v2 PNG](modelo-entidad-relacion-v2-2026-10-18.png), [v2 SVG](modelo-entidad-relacion-v2-2026-10-18.svg) y [DOT editable](modelo-entidad-relacion-v2-2026-10-18.dot), revisión documental del 18 de octubre de 2026, sin migración. La versión anterior se mantiene como referencia: el [SVG v1](modelo-entidad-relacion-v1-2026-10-02.svg) incorpora la revisión procedente de main y el [PNG v1](modelo-entidad-relacion-v1-2026-10-02.png) se conserva como referencia visual histórica; no se ha regenerado ese PNG durante esta resolución. Este Markdown sigue siendo la fuente descriptiva principal; el [registro de revisión v2](revision-documental-v2-2026-10-18.md) documenta su preparación sin atribuir fechas de implementación.

La conservación intacta de v1 descrita en ese registro corresponde al estado previo a incorporar la revisión de su SVG procedente de main; esta integración mantiene dicha actualización y conserva v2 como diagrama de entrega.


