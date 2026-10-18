# Especificación funcional: Facturación municipal y participación de farmacias

### Fecha prevista de liquidación en listados — 17 de octubre de 2026

GET `/facturaciones/emitidas` incorpora `fecha_prevista_liquidacion`, obtenida de `pago_farmacias.fecha_pago` mediante LEFT JOIN por facturación; cuando no hay registro devuelve null. Es la fecha que el sistema conserva para la liquidación a farmacias, no evidencia de una transferencia ejecutada ni estado real de pago. No se añaden entidades, columnas o escrituras.

## 1. Objetivo y alcance

### Números oficiales en el listado de cobros — 17 de octubre de 2026

GET `/facturaciones/emitidas` incluye `numero_factura_precintos` y `numero_factura_comision`, leídos respectivamente de las dos FACTURA existentes en el mismo SELECT del listado. Se devuelven como texto, sin transformar ceros, formato o numeración. No se generan números, actualizan facturas ni cambian importes, estados, filtros o selección. La interfaz de Cobros identifica cada factura mediante su número oficial, junto a importe y estado; presenta «Sin número» si no consta una referencia textual no vacía.

### Estado de cobro por factura en el listado — 17 de octubre de 2026

GET `/facturaciones/emitidas` añade los booleanos `factura_precintos_cobrada` y `factura_comision_cobrada`. Cada uno se obtiene con EXISTS sobre COBRO para la factura correspondiente en el mismo SELECT del listado. `tiene_cobros` conserva su significado conjunto. Un cobro registrado implica Cobrada; su ausencia implica Pendiente, incluso para facturas de importe cero. Son etiquetas de consulta, sin columnas ni estados nuevos, escrituras, recálculos o cambios de las reglas de cobro y reapertura. El endpoint sigue sin admitir query/cuerpo y conserva selección, orden e importes históricos.

### Acceso visual a reapertura — 12 de octubre de 2026

GET `/facturaciones/emitidas` incorpora `tiene_cobros` booleano, mediante EXISTS sobre las dos facturas y sus cobros en el mismo SELECT del listado. Es solo lectura; no modifica importes o estados. El listado utiliza ese dato para informar el bloqueo y consulta la cabecera antes de solicitar reapertura. POST `/facturaciones/:id/reapertura` mantiene contrato, motivo obligatorio, transacción/bloqueos y rechazo por cualquier cobro; no se cambia su código financiero. Tras éxito, el enlace por ID vuelve a la misma revisión y a la reemisión conjunta de §14. Interfaz y recuperación de resultados inciertos en interfaz-facturacion-municipal/spec.

### Consulta de combinaciones pendientes — 12 de octubre de 2026

GET `/facturaciones/pendientes`, sin query ni cuerpo, devuelve 200 con una lista de `{ ayuntamiento_id, denominacion, periodo_id, mes, anio, facturacion_id, estado }`. `facturacion_id` es null y `estado` SIN_FACTURAR cuando no hay cabecera TD. Selección SQL por existencia de lecturas aptas (también precio cero), ausencia de emisión y de cualquier cobro en las dos facturas; incluye REVISION y REABIERTA. Excluye entregas vacías, solo incidencias/declarados y EMITIDA. Una fila por pareja; orden municipal alfabético y periodo descendente. Query/cuerpo rechazados con 400. No crea ni recalcula registros. POST de cálculo conserva la validación/transacción existente y reutiliza cabeceras; la consulta no reserva opciones frente a cambios concurrentes.

Reapertura confirmada por el usuario: numeración oficial o envío a Contabilidad no son bloqueos adicionales. Se exige motivo y ausencia de cobros; revisión, previsualización y reemisión conjunta actualizan el par original según §14. No hay un atributo de envío a Contabilidad en el esquema; no se añade. El acceso de configuración se conserva en Inicio, retirado de Nueva facturación municipal.

Corrección individual vigente v26 (12 de octubre de 2026): Entregas corrige únicamente el precinto seleccionado, manteniendo referencia/maestro y todas las demás lecturas. SIN_FACTURAR sin cabecera, REVISION y REABIERTA sin cobros permiten añadir/corregir; no exige revisión/participación preparada. Si existe participación, recalcula su suma en la misma transacción; no crea cabeceras/participaciones ni modifica B. EMITIDA o cualquier cobro bloquean escrituras. Conserva el bloqueo municipal común y la reemisión de §14 para documentos/números/porcentajes históricos. Sustituye la regla agrupada anterior del mismo día.

Especificar el cálculo y registro de la facturación que el Colegio emite al Ayuntamiento, la identidad histórica de cada farmacia participante y el vínculo posterior con la liquidación a farmacias. El Colegio factura al Ayuntamiento y distribuye entre las farmacias participantes el importe de los medicamentos.

Este documento describe reglas funcionales. `db/schema.sql` incluye las claves y restricciones físicas para participaciones y numeración por serie. Los flujos de cálculo/revisión, emisión, cobro y preparación/confirmación de liquidación están implementados conforme a este contrato; la aplicación no ejecuta transferencias bancarias.

## 2. Fuentes y precedencia

- Decisiones confirmadas en esta conversación: cada lectura aceptada es un precinto individual; varias lecturas pueden tener el mismo código nacional y cada registro distinto se cuenta una vez. A, B y C son identidades separadas; B se puede corregir antes de emitir, C y la cuenta antes de pagar, y cada snapshot queda congelado al emitir/pagar. La reapertura correctiva anterior a cualquier cobro no reemplaza B. Hay una serie por tipo de factura; Contabilidad proporciona cada número oficial, normalmente guardado como texto, y la unicidad funcional se exige dentro de cada serie. La fecha sugerida para liquidar es el siguiente día laborable y el usuario puede cambiarla antes de confirmar el pago. El informe anual operativo se agrupa por trimestre del periodo facturado, incluye PRECINTOS y excluye COMISION; no es una declaración ni un informe fiscal.
- Reglas vigentes del modelo conceptual y `docs/guia-contexto-tfm.md`, apartados C.5–C.14 y reglas de facturación: dos facturas conjuntas, comisión del 2,7 %, IVA del 21 % sujeto a la referencia temporal documentada, cobros municipales independientes sin parcialidad en el MVP y bloqueo de reapertura al existir cualquier cobro.
- `docs/specs/entregas-precintos/spec.md`: una entrega lógica por farmacia/periodo, precintos aceptados y precio histórico; las incidencias no se facturan.
- `db/schema.sql` y modelo lógico: describen relaciones actuales del modelo objetivo; no sustituyen validación de estado implementado.
- El diagrama ER de fuente SVG se contrasta con el esquema vigente; cuando una etiqueta del diagrama quede desactualizada, prevalecen el modelo escrito y `db/schema.sql`.

No se encontró otra especificación de facturación municipal o liquidaciones en `docs/specs/`.

## 3. Estado real: implementado, esquema y documentación

| Estado | Alcance comprobado |
|---|---|
| Implementado | Entregas, cálculo/revisión persistidos de participaciones, corrección/congelación de B, emisión conjunta, actualización correctiva sin cobros y registro de cobros independientes completos (§13–§15). Estados REVISION/EMITIDA/REABIERTA; primer cobro bloquea reapertura, con control de concurrencia. Preparación/confirmación de liquidación y Excel XML implementados (§16). Informe anual operativo por periodo, trimestres y meses opcionales implementado (§17), con pantalla ver/exportar y Excel XML (§18). |
| Presente en esquema/documentación | Proceso municipal por Ayuntamiento, periodo y tipo; documentos PRECINTOS/COMISION; cobros por factura; reaperturas; pago conjunto y detalle de pago con SOE, denominación, CIF/NIF, importe y datos bancarios históricos. |
| Alcance no implementado | Ejecución o confirmación bancaria de transferencias, fuera del MVP. Las pantallas de revisión/emisión y Cobros y liquidaciones están implementadas según sus especificaciones de interfaz. |

El esquema actual relaciona cada entrega con `farmacia.id` y contiene snapshots A. `participacion_facturacion` relaciona facturación y entrega, conserva B e importe; `detalle_pago_farmacia` tiene FK única a una participación. `COBRO` apunta a una factura. Emisión y cobros están implementados según los bloques autorizados; la liquidación está implementada según §16, sin ejecutar transferencias.

## 4. Regla de identidad: A → B → C

**Decisiones acordadas:** A, B y C corresponden a la misma actividad de precintos de una farmacia/establecimiento identificado por SOE, periodo y Ayuntamiento. No son tres actividades ni tres lotes. Los precintos se registran una sola vez; la participación facturada y el detalle liquidado referencian esa misma actividad y sus importes, sin copiar ni volver a sumar los precintos como operaciones nuevas.

Para esa actividad se distinguen:

- **A, entrega:** datos capturados del catálogo local al crear la entrega. Es la identidad registrada para quien presenta la entrega. Esa captura está implementada.
- **B, factura municipal:** titular registrado cuando el Colegio emite la factura al Ayuntamiento. La identidad queda conservada con la participación y no se sustituye por cambios posteriores del catálogo. Si se reabre la facturación para corregir registros o cálculo, se actualiza la misma participación y se recalcula su importe; no se crea otra participación ni una versión nueva, no se cambia B y no se vuelve a consultar el catálogo actual.
- **C, pago a la farmacia:** titular y cuenta bancaria vigentes cuando el Colegio realiza el pago. El pago de esa participación se hace una sola vez a una cuenta vigente; los datos de C y la cuenta utilizados quedan congelados en el detalle pagado. La preparación propone C/cuenta actuales y permite corregirlos; al confirmar se guardan como snapshots, según §16.

El detalle pagado enlaza explícitamente con la participación facturada. Desde la participación se llega a la entrega de origen y a sus precintos; el SOE del detalle es solo un snapshot y no es una relación entre registros históricos.

Ejemplo: A presenta la actividad de 10 precintos por 100,00 € para SOE 123, Ayuntamiento X y periodo P. El Colegio registra una sola vez esos 10 precintos y, al emitir la factura, conserva que B es el titular participante. Cuando realiza el pago correspondiente, registra una sola liquidación de esa participación a la cuenta entonces vigente de C. La participación de factura y el detalle de pago apuntan a la misma actividad de precintos; ninguno vuelve a crear ni sumar otros 10 precintos. La consulta histórica obtiene B de la participación, C y la cuenta del pago, y la fuente de actividad/periodo/Ayuntamiento de la entrega relacionada. No consulta el titular actual para sustituir esos snapshots. Los snapshots conservan lo registrado y no prueban que el catálogo local estuviera actualizado.

El catálogo local contiene solo farmacias actuales, se actualiza manualmente con datos ficticios y no modela titulares/vigencias. La otra aplicación de traspasos queda fuera del TFM. No hay resolución automática de titularidades pasadas ni sincronización externa.

## 5. Flujo funcional propuesto

1. Seleccionar Ayuntamiento, periodo mensual y tipo de facturación soportado (`TD` en MVP). La fecha funcional de factura es el último día del periodo, según el modelo vigente.
2. Reunir las entregas de ese Ayuntamiento y periodo conforme a la asociación municipal validada al registrar. Considerar exclusivamente precintos válidos persistidos, no incidencias, no declarados informativos y sin reevaluar estados/listas actuales. El precio de cada registro es `PRECINTO.precio_aplicado`.
3. Para cada farmacia, calcular su importe como la suma de `precio_aplicado` de sus precintos aptos en la entrega del periodo. Cada precinto existente se registra y cuenta una sola vez. Incidencias y cantidades/importes declarados no participan en este cálculo.
4. Antes de emitir, permitir corregir B en la participación. Al emitir la factura al Ayuntamiento, conservar el B confirmado para esa misma actividad junto con la participación facturada; desde ese momento queda congelado. Un establecimiento sin precintos aptos no participa ni genera importe.
5. Si no existe ningún precinto apto para el Ayuntamiento y periodo, no emitir PRECINTOS ni COMISION y mostrar una advertencia. Si otras farmacias sí tienen precintos aptos, continuar e incluir únicamente esas farmacias. Calcular el importe PRECINTOS como la suma de sus participaciones y crear conjuntamente PRECINTOS y COMISION. Contabilidad proporciona el número oficial de cada documento; normalmente se conserva como texto. Hay una serie por tipo de factura y no se repite un número dentro de la misma serie. No se guarda borrador sin ambos números.
6. Para COMISION, base = total PRECINTOS; comisión = 2,7 %; IVA del 21 % se aplica al importe de comisión ya redondeado, con el porcentaje de IVA conservado como histórico. Secuencia y redondeo monetario se mantienen según el modelo conceptual: comisión a dos decimales; IVA sobre comisión redondeada a dos; total suma comisión e IVA a dos. La fecha de factura determina el tipo IVA aplicable conforme a la regla temporal documentada; cualquier cambio normativo futuro deberá reflejarse en la configuración sin alterar facturas ya emitidas.
7. Registrar el cobro del Ayuntamiento por factura y de forma independiente para cada una de las dos facturas. En MVP no hay cobros parciales; el importe cobrado debe corresponder al total de la factura. El cobro acredita el pago municipal al Colegio, no el reparto a farmacias.
8. Después del cobro de PRECINTOS, pagar a cada farmacia el importe de sus propios precintos aptos. Sugerir como fecha de liquidación el siguiente día de lunes a viernes posterior al cobro; el MVP no tiene en cuenta festivos. Permitir al usuario cambiar la fecha sugerida antes de confirmar el pago y guardar la fecha elegida al confirmar. Antes de confirmar, permitir corregir C y la cuenta bancaria; al pagar, ambos datos quedan congelados en el snapshot. Efectuar un único pago completo a una cuenta para esa participación. Relacionar explícitamente el detalle pagado con la participación B y con la entrega del mismo SOE, periodo y Ayuntamiento. Incidencias y declarados no participan en el importe pagado. Preparar el Excel para Contabilidad; el sistema no ejecuta transferencias.

Antes de emitir, B puede corregirse y la emisión congela el valor confirmado en la participación. Una facturación emitida puede reabrirse para corregir registros de esa misma participación y recalcular su importe solo si ninguna de sus facturas tiene cobro. Si cambia el importe, se actualiza la factura existente con el importe recalculado y se conservan los números oficiales originales de PRECINTOS y COMISION, sin asignar números nuevos. La reapertura registra su fecha y motivo; no crea otra participación ni una nueva versión, conserva B de la participación emitida y no vuelve a consultar el catálogo actual. Después de cualquier cobro, no se puede reabrir. C y la cuenta pueden corregirse hasta confirmar el pago; al pagar quedan congelados. Los cambios posteriores del catálogo, por sí solos, nunca modifican precintos ni snapshots históricos.

## 6. Modelo conceptual mínimo propuesto (sin nombres físicos)

- **Proceso de facturación municipal:** Ayuntamiento, periodo, tipo, fecha y vínculo con un conjunto de participaciones.
- **Factura emitida al Ayuntamiento:** pertenece al proceso; dos documentos económicos PRECINTOS y COMISION, con número oficial, cálculo e importes históricos.
- **Participación de farmacia:** pertenece a una facturación y a una única entrega de farmacia/periodo; cada entrega se factura una sola vez en la facturación que le corresponde. Conserva B al emitir mediante snapshots de SOE, denominación y CIF. El importe suma una vez los `precio_aplicado` de los precintos aptos alcanzados mediante esa entrega; no se duplican precintos ni se necesita un vínculo separado a cada precinto. El detalle pagado enlaza con esta misma participación; su SOE es un snapshot, no una relación.
- **Cobro municipal:** registro independiente por factura emitida, con fecha, importe completo y justificante opcional. No se mezcla con una participación de farmacia.
- **Liquidación a farmacias:** pertenece al proceso y se permite cuando la factura PRECINTOS está cobrada. Para cada participación, paga el importe de los precintos aptos propios de esa farmacia mediante un único pago (no fraccionado) a una cuenta vigente; el detalle conserva snapshot de C y de la cuenta realmente usada, importe pagado y vínculo explícito a la participación B y a la actividad/entrega de origen.

Las identidades B y C son snapshots distintos aunque coincidan. Las relaciones deben permitir navegar desde una factura municipal a sus participaciones/importes y desde cada pago a la misma participación y entrega, sin consultar el titular actual para reconstruir el pasado. Una facturación emitida tiene una o más participaciones; sin precintos aptos en todo el Ayuntamiento/periodo no se emite y se muestra una advertencia. Cada participación pertenece a una facturación y una entrega; una entrega participa como máximo una vez; una participación puede tener como máximo un detalle de pago. No se fijan nombres de tablas o columnas ni migraciones en esta especificación.

## 7. Reglas heredadas que se preservan

- Factura PRECINTOS = suma de precios aplicados de precintos válidos del Ayuntamiento/periodo/tipo.
- Importe por farmacia = suma de `precio_aplicado` de sus precintos aptos en la entrega del periodo. Importe total de PRECINTOS municipal = suma de los importes por farmacia de las entregas de ese Ayuntamiento y periodo. Cada farmacia recibe el importe de sus propios precintos aptos.
- Incidencias y cantidades/importes declarados no intervienen en el importe por farmacia, en el total de PRECINTOS ni en el pago a la farmacia.
- Factura COMISION = comisión del 2,7 % más IVA del 21 %, calculada y redondeada en la secuencia ya definida; valores y porcentajes aplicados quedan históricos.
- Facturación + tipo permite como máximo un proceso; se generan conjuntamente factura PRECINTOS y COMISION, cada una con el número oficial textual (normalmente) proporcionado por Contabilidad en su propia serie. La unicidad funcional se aplica dentro de cada serie.
- Los cobros de ambas facturas son independientes; no existen cobros parciales en el MVP.
- Una factura cobrada no se modifica. Si cualquiera de las dos facturas está cobrada, no se puede reabrir el proceso.
- Si se reabre antes de cualquier cobro para corregir registros de una participación, se actualiza esa misma participación y se recalcula su importe; no se crea otra participación ni una versión nueva, y B se conserva sin consultar el catálogo actual.
- Después de cualquier cobro, no se puede reabrir la facturación.
- La liquidación solo se prepara después del cobro de PRECINTOS; su fecha es distinta de la fecha de abono municipal. Se sugiere el siguiente día de lunes a viernes posterior al cobro, sin considerar festivos en el MVP. El usuario puede modificar la sugerencia antes de confirmar y la fecha elegida queda guardada al confirmar el pago. A cada participación corresponde un único pago completo a una cuenta bancaria vigente al realizarlo.
- La suma de los pagos a farmacias corresponde a la suma de sus importes individuales y al total de la factura de PRECINTOS, porque ambos proceden de los mismos precintos aptos contabilizados una sola vez.
- Los datos bancarios son sensibles, se validan antes de preparar el fichero y solo se conservan los necesarios para justificar el pago.

## 8. Informes e identidad histórica

Una consulta histórica que una precintos/entregas con `FARMACIA` y agrupe por denominación o CIF/NIF actual puede atribuir operaciones antiguas al titular actual. Agrupar por SOE identifica el establecimiento, no a B ni a C en una fecha pasada. Los datos históricos del pago identifican a C y no sustituyen la identidad B conservada en la participación.

El informe anual operativo del proyecto agrupa los importes por trimestre del periodo facturado, no por fecha de cobro municipal ni de pago a farmacias. Puede mostrar el detalle mensual dentro de cada trimestre. Incluye exclusivamente los importes de PRECINTOS calculados con `precio_aplicado` de los precintos aptos y excluye COMISION. No es una declaración ni un informe fiscal.

## 9. Decisiones abiertas que requieren confirmación

| Decisión | Alternativas o cuestión | Fuente/impacto |
|---|---|---|
| Catálogo desactualizado | Decidido: B puede corregirse antes de emitir y C/cuenta antes de confirmar el pago. La emisión congela B y el pago congela C/cuenta. Reabrir antes del cobro para corregir precintos o cálculo no reemplaza B. | Usuario; no resuelve titulares anteriores ni incorpora sincronización automática. |
| Excepciones de cuenta | La cuenta del pago es la vigente cuando se realiza el pago y sus datos se congelan en el snapshot. Falta confirmar si hay excepciones operativas a esa regla y cómo autorizarlas. | Usuario/Contabilidad; cualquier excepción debe quedar trazable y no alterar C en pagos anteriores. |

La unicidad funcional por serie está decidida: cada tipo tiene una serie y el número no se repite dentro de esa serie en ningún periodo. `db/schema.sql` aplica `UNIQUE(tipo, numero_factura)`, por lo que el mismo texto puede usarse en tipos distintos.

## 10. Fuera del MVP

- Histórico general de titulares, gestión de traspasos y resolución automática de quién era titular en fechas anteriores.
- Integración o sincronización con la aplicación corporativa de traspasos.
- Ejecución de transferencias, conexión bancaria, eFactura o comunicación con ERP/Contabilidad.
- Versionado general de precintos y reconstrucción automática de titulares pasados.

## 11. Criterios de aceptación para una futura implementación

- Una factura municipal incluye solo precintos válidos de las entregas del Ayuntamiento/periodo/tipo; incidencias y declarados no alteran el importe.
- Si no hay ningún precinto apto en el Ayuntamiento/periodo, no se emite ninguna factura y se muestra una advertencia; si solo algunas farmacias tienen aptos, se factura únicamente a través de sus participaciones.
- Dos lecturas aptas distintas con el mismo código nacional cuentan como dos precintos; cada lectura se cuenta exactamente una vez y no se deduplica por código nacional.
- La participación, la factura y el pago corresponden a la misma actividad de SOE, periodo y Ayuntamiento; cada precinto se registra una sola vez y no se vuelve a sumar como duplicado.
- Cada entrega de farmacia/periodo se asocia como máximo a una participación en la facturación que le corresponde; la participación queda vinculada a la entrega y suma una vez sus precintos aptos por medio de esa entrega.
- La participación conserva SOE, denominación y CIF de B al emitir; el detalle de pago referencia esa participación y conserva C/cuenta, mientras que su SOE se trata solo como snapshot.
- El importe de cada farmacia es la suma de los `precio_aplicado` de sus precintos aptos; el total de PRECINTOS es la suma de esos importes por farmacia para el Ayuntamiento/periodo. Incidencias y declarados se excluyen y no se duplican precintos.
- Cada farmacia recibe el importe de sus propios precintos aptos, relacionado con la misma participación facturada.
- B se puede corregir antes de emitir y queda congelado en la participación al emitir. Una reapertura sin cobros corrige los registros de esa misma participación y recalcula su importe; si cambia, actualiza la factura existente, conserva los números oficiales originales y registra fecha y motivo, sin crear otra participación ni versión, cambiar B ni consultar FARMACIA actual. Después de cualquier cobro no se reabre. C y cuenta se pueden corregir antes de pagar y quedan congelados al confirmar.
- Facturas PRECINTOS/COMISION se crean atómicamente con sus números oficiales, normalmente texto, proporcionados por Contabilidad; el mismo número puede usarse en series distintas y se rechaza su repetición dentro de la misma serie.
- Cobros independientes se relacionan con sus respectivas facturas y bloquean reapertura según la regla vigente.
- Una reapertura correctiva previa a cualquier cobro modifica los registros de la participación existente y recalcula su importe; cuando cambia, actualiza la factura existente y conserva los números oficiales originales, sin asignar otros. Registra fecha y motivo. No crea participación/versión nueva, no cambia B ni consulta el catálogo actual. Si existe cualquier cobro, la reapertura se rechaza.
- La liquidación solo se prepara tras el cobro completo de PRECINTOS; se sugiere el siguiente día de lunes a viernes posterior al cobro, sin tener en cuenta festivos en el MVP. La fecha puede cambiarse antes de confirmar y queda guardada al confirmar. Cada detalle paga el importe completo una sola vez, enlaza la participación y entrega del mismo SOE, periodo y Ayuntamiento, y conserva C/cuenta realmente usados. El SOE por sí solo no sirve de vínculo histórico.
- El informe anual operativo agrupa por trimestre del periodo facturado, no por fecha de cobro/pago; puede mostrar detalle mensual dentro de cada trimestre. Suma `precio_aplicado` de precintos aptos, incluye PRECINTOS y excluye COMISION. No es una declaración ni un informe fiscal.
- Cambio posterior del catálogo no altera A, B o C ya registrados. El ejemplo A → B → C se recupera sin consultar titular actual.
- Casos límite y decisiones aún abiertas quedan resueltos antes de implementar el comportamiento que dependan de ellas.

## 12. Pruebas de aceptación derivadas

- **Lecturas y cálculo:** registrar dos lecturas aptas distintas con el mismo código nacional y precios aplicados conocidos; comprobar recuento dos y suma una vez por registro. Cambiar el precio actual del catálogo y verificar que el total no cambia. Añadir incidencia y declarados y comprobar que no afectan el total facturable.

### Lecturas: estados y conservación histórica vigentes v26

| Facturación Ayuntamiento/periodo/TD | Cobros en cualquiera de las dos facturas | Añadir lecturas / corregir un precio individual |
|---|---|---|
| Sin cabecera (SIN_FACTURAR, estado derivado) | No existen facturas de ese proceso | Permitido, sin preparar revisión |
| REVISION | Ninguno | Permitido |
| EMITIDA | Ninguno | Bloqueado hasta reapertura controlada |
| REABIERTA | Ninguno | Permitido |
| Cualquier estado con cobro | Alguno | Bloqueado; tampoco se permite reabrir |

El servidor consulta estado y cobros después de adquirir los bloqueos compartidos con emisión, preparación, reapertura y cobro. El listado neutral de entregas no devuelve ese permiso; se obtiene del contexto financiero de la entrega. Un historial de reapertura no sustituye el estado actual. SIN_FACTURAR no es una columna ni un estado nuevo de FACTURACION o PERIODO.

La corrección por ID no cambia B, el maestro ni lecturas hermanas. La referencia de registros anteriores a 005 conserva el aplicado al migrar, sin garantía de precio original; aplicado no cambia en el backfill y la referencia no cambia al corregir. Corregir actualiza el total de entrega y la participación si existe, nunca crea una revisión. Añadir lecturas puede dejar la revisión pendiente de recálculo; no crea participaciones desde el registro. En REABIERTA se admiten nuevas lecturas bajo el permiso financiero, pero la reemisión solo incluye las participaciones originales: no equivale a admitir nuevas farmacias en el conjunto emitido. Los documentos FACTURA solo se actualizan al reemitir conjuntamente (§14). El registro de reapertura guarda fecha/motivo; no existe historial de cada corrección individual.

## 13. Bloque aprobado: cálculo/revisión y editabilidad (11 de octubre de 2026)

Registro histórico del bloque inicial de backend para TD. El cálculo/revisión, emisión conjunta, reapertura correctiva, cobros y preparación/confirmación de liquidaciones están implementados en los apartados vigentes §13–§16 y en sus especificaciones de interfaz; la ejecución de transferencias queda fuera del MVP.

### Estado y persistencia

- `facturacion.estado`: TEXT NOT NULL, DEFAULT `REVISION`, CHECK `REVISION`/`EMITIDA`/`REABIERTA`. `REVISION` permite corregir entregas y B. `EMITIDA` bloquea ambas. La reapertura sin ningún cobro cambia a `REABIERTA`, registra fecha automática y motivo obligatorio, permite corregir entregas y mantiene B congelado.
- Primer cálculo con aptos crea una cabecera en revisión, con fecha funcional del último día del periodo, y una participación por entrega con al menos un precinto. No crea FACTURA. La fecha todavía no representa una emisión.
- B inicial procede del catálogo actual al preparar por primera vez cada participación, como propuesta editable; no se utiliza el snapshot A para atribuir B ni se intenta resolver titulares pasados. Un recálculo conserva las correcciones de B y los IDs existentes. SOE B es un snapshot, no una clave para agrupar precintos.
- Cada fila PRECINTO cuenta una vez. SQL agrupa exclusivamente sus precios aplicados por entrega y suma importes con NUMERIC; cantidades son recuentos de filas. No se unen incidencias ni se filtran listas/estado/precios actuales del catálogo. Los precintos de precio cero sí participan.
- En revisión, una entrega que pierde todos sus aptos deja de tener participación. Sin aptos en todo el municipio/periodo se devuelve advertencia, sin crear cabecera nueva, participaciones ni facturas; una cabecera de revisión previa puede permanecer vacía.
- En reapertura se recalculan solo las participaciones ya emitidas, conservando B y el ID incluso si quedan a cero. Se rechaza incorporar nuevas participaciones. Esta conservación histórica tiene prioridad sobre la retirada de borradores vacíos. La emisión/actualización de las dos facturas se implementa en §14.
- Un cobro de cualquiera de las dos facturas impide reabrir, recalcular, corregir B y modificar las entregas, incluso ante un estado incoherente introducido por SQL externo.
- Cantidades no se duplican en la tabla de participación. Los importes por participación respetan NUMERIC(12,2); un exceso devuelve 409 y revierte la transacción. El total municipal se suma sin limitarlo artificialmente a la precisión de una participación.

### Contrato API

| Operación | Entrada | Resultado |
|---|---|---|
| POST `/facturaciones/calculo` | `{ ayuntamiento_id, periodo_id }`, IDs numéricos enteros positivos PostgreSQL | 200 con cálculo persistido; 404 destino inexistente; 409 emitida/con cobros/conflicto o capacidad monetaria excedida. |
| GET `/facturaciones/:id` | ID, sin query | 200 con revisión y totales, sin escrituras; 404 ausente. |
| PUT `/facturaciones/:id/participaciones/:participacionId/b` | `{ soe_b, denominacion_b, cif_b }`, textos no vacíos tras trim, máximos técnicos 100/250/50 | 200 con B corregido; 404 si no pertenece; 409 B congelado. Nunca permite editar importes. |
| POST `/facturaciones/:id/reapertura` | `{ motivo }`, texto no vacío tras trim, máximo técnico 500 | 200 estado REABIERTA y registro de fecha/motivo; 404 ausente; 409 si no está emitida o tiene cobros. |

Se rechazan IDs, tipos, campos extra y queries no admitidos con 400. Los importes JSON son texto decimal exacto. Resumen: `facturacion_id`, `estado`, `participaciones`, `cantidad_precintos`, `importe_total` guardado, `importe_actual` de los precintos vigentes y `requiere_recalculo`. Cada participación muestra ID, entrega/farmacia, B, cantidad de aptos, importe guardado y actual. Tras corregir entregas, GET identifica diferencias de importe y participantes aún no incorporados; POST actualiza los importes. No se interpreta un importe guardado como una factura emitida. La advertencia por ausencia de aptos se basa en el recuento, nunca en que el importe sea cero.

### Concurrencia y adaptación local

Las mutaciones bloquean Ayuntamiento antes de Facturación bajo READ COMMITTED; Entregas comparte el bloqueo municipal antes de crear/corregir/guardar/borrar. Se reconsulta estado tras esperar. B se corrige dentro de ese protocolo. Reapertura y control de cobros son atómicos respecto a operaciones financieras que respeten el mismo protocolo, exigido para su futura implementación. GET utiliza un snapshot REPEATABLE READ de solo lectura.

Actualización directa autorizada en `gestion_facturacion_medicamentos` y `gestion_facturacion_medicamentos_test`: nombres/host verificados, bloqueo de tabla y recuento cero antes del ALTER; añadida columna/DEFAULT/CHECK sin borrar filas. Sin migración versionada ni cambios de datos no afectados. Otras instalaciones deben verificar su estado y datos antes de adaptar; no se asignan estados a registros financieros históricos por inferencia automática. El [diagrama v2 y su revisión documental](../../modelo-datos/revision-documental-v2-2026-10-18.md) reflejan ahora el esquema actual; su fecha no acredita otra migración ni una repetición de estas verificaciones.

### Casos de aceptación para fases posteriores

- **Sin aptos o con aptos parciales:** con cero precintos aptos en Ayuntamiento/periodo, comprobar la advertencia y que no se emite PRECINTOS ni COMISION. Con varias farmacias y aptos solo en algunas, comprobar la emisión conjunta y que solo estas tienen participación y se incluyen en la suma de PRECINTOS.
- **B y reapertura:** corregir B antes de emitir y comprobar que la emisión lo conserva en la participación. Reabrir sin cobros, corregir registros de esa misma participación y comprobar que se recalcula el importe, al reemitir se actualiza la factura existente si este cambia, se registran fecha y motivo, no se crea otra participación ni versión, B no cambia y no se consulta FARMACIA actual. Verificar que B no es editable después de emitir.
- **Reapertura bloqueada:** registrar un cobro para cualquiera de las facturas y comprobar que no se reabre ni se modifican registros o importes de la participación.
- **Factura y números tras recálculo:** emitir PRECINTOS y COMISION con sus números oficiales, reabrir antes de cualquier cobro y corregir registros de forma que cambien los importes. Comprobar que solo al reemitir se actualizan las facturas existentes con los importes recalculados, que ambas conservan exactamente sus números oficiales originales y que no se asignan números nuevos. Verificar también el registro de la fecha y el motivo de la reapertura.
- **Participación y pago:** asociar una entrega una sola vez a su facturación; con varios precintos aptos e incidencias, verificar la suma única de `precio_aplicado`, el snapshot B de SOE/denominación/CIF y el vínculo del detalle de pago a esa participación. Confirmar que el SOE del detalle no se usa como FK y que C/cuenta quedan como snapshots del pago.
- **Series y cobros:** aceptar el mismo número de texto en tipos/series distintos y rechazar su repetición dentro del mismo tipo aunque la factura corresponda a otro periodo. Comprobar el almacenamiento por tipo y verificar cobro independiente de cada factura, rechazo de parcialidad y bloqueo de reapertura tras cobrar cualquiera.
- **Liquidación:** impedir pago antes del cobro de PRECINTOS. Comprobar que un cobro en viernes sugiere el lunes siguiente y un cobro en sábado o domingo sugiere el lunes siguiente, sin consultar festivos. Cambiar la fecha sugerida antes de confirmar y verificar que la fecha elegida queda guardada y no cambia al volver a consultar el pago. Comprobar también la corrección de C/cuenta antes de confirmar y su congelación posterior, un único pago completo por farmacia y cuadre con PRECINTOS.
- **Informe anual:** usar periodos situados en distintos trimestres, asignar cada importe al trimestre/año del periodo facturado aunque las fechas de cobro municipal y pago a farmacias caigan en otros trimestres; sumar los importes de PRECINTOS basados en precios aplicados de precintos aptos, excluir COMISION, permitir el detalle mensual dentro de cada trimestre y comprobar que los subtotales trimestrales suman el total anual. El informe es operativo, no una declaración ni un informe fiscal.

## 14. Emisión conjunta aprobada (11 de octubre de 2026)

POST `/facturaciones/:id/emision`, sin query. Primera emisión: body `{ numero_factura_precintos, numero_factura_comision }`, ambos textos oficiales obligatorios, trim exterior, 1–200 caracteres; no se generan números ni se convierten a números. Unicidad exacta por tipo/serie en todos los periodos, protegida también por UNIQUE para peticiones concurrentes. El mismo texto es válido en series distintas; ceros iniciales y caracteres internos se conservan.

Primera emisión requiere REVISION con participaciones recalculadas/revisadas y una única configuración vigente en `fecha_factura` (último día del periodo, extremos inclusivos). Ausencia/solapamiento de configuración devuelve 409 sin emitir; no se inventa ni inserta una configuración. Los porcentajes se obtienen de esa configuración y quedan copiados como históricos junto con su FK. Comisión vigente aprobada 2,7 % e IVA 21 %, configurables por fecha. Cálculo SQL NUMERIC: PRECINTOS suma los importes de participación; COMISION redondea HALF_UP a dos decimales la base por porcentaje, calcula/redondea IVA sobre esa comisión redondeada y redondea su suma final. Cantidad cuenta cada precinto de las entregas participantes, sin deduplicar códigos.

Administración de vigencias implementada en configuracion-facturacion/spec: acceso desde Inicio y Facturación municipal. El error de ausencia/ambigüedad explica la fecha funcional y dirige a «Gestionar comisión e IVA» para crear/corregir la vigencia. No se relaja el bloqueo ni se añade cálculo alternativo de gastos. Configuración documental del logo/emisor sigue independiente.

Se guarda el par y el estado EMITIDA en una sola transacción, con el mismo bloqueo Ayuntamiento → Facturación del cálculo/Entregas. B confirmado ya está guardado en la participación: se congela con el cambio de estado, sin recapturarlo del catálogo. Estado emitido o cualquier cobro rechazan modificaciones con 409. Si falla cualquier factura, se revierte el par, importes/estado y cualquier recálculo de esa transacción. Una repetición de emisión ya confirmada devuelve 409, sin duplicar documentos.

En REABIERTA sin cobros, se permite body `{}` (no necesita números nuevos) o los dos números originales; se rechaza sustituirlos. Se exigen las dos facturas existentes y se recalculan las mismas participaciones, manteniendo B e IDs. Se actualizan las filas de ambas facturas, conservando números, IDs, porcentajes históricos y FK de configuración; vuelve a EMITIDA. No se vuelve a seleccionar configuración actual ni se incorporan otras participaciones.

Sin aptos actuales se devuelve 200 con la advertencia de §13; no se crean ni actualizan facturas y el estado permanece editable. En reapertura se conservan los documentos originales hasta una corrección que permita emitir; no se elimina historial. Precio cero con cantidad positiva sí permite emitir. Una revisión desactualizada devuelve 409 para recalcular/revisar antes de la primera emisión; destinos ausentes, 404; datos/números inválidos, 400; conflictos de numeración/configuración/estado y desbordamientos monetarios, 409.

Éxito inicial 201, actualización correctiva 200, respuesta `{ facturacion_id, estado: 'EMITIDA', facturas }`; importes/porcentajes como cadenas decimales exactas. Sin cambios de esquema, dependencias, cobros/pagos ni interfaz financiera.

GET `/facturaciones/:id` incluye también `facturas` cuando el estado es EMITIDA o REABIERTA, dentro del mismo snapshot de solo lectura, para recuperar documentos y números tras emitir o perder la respuesta. En REVISION conserva su contrato previo.

### Previsualización anterior a la emisión

GET `/facturaciones/:id/previsualizacion`, ID positivo, sin query ni cuerpo. Consulta en REPEATABLE READ READ ONLY; no emite, asigna números, recalcula participaciones persistidas ni congela B. REVISION exige participaciones actualizadas y configuración única vigente por fecha de factura. REABIERTA sin cobros usa los importes actuales de las participaciones originales y los porcentajes históricos; no incorpora participantes nuevos. EMITIDA o cualquier cobro devuelve 409; ID ausente 404; formato/query/cuerpo inválido 400.

Respuesta 200: facturacion_id, estado, cantidad_precintos, importe_precintos, base_calculo, porcentaje_comision, importe_comision, porcentaje_iva, importe_iva, importe_total_comision e importe_total_conjunto. Dinero/porcentajes son cadenas exactas; comisión e IVA reutilizan la función SQL NUMERIC de emisión y su secuencia HALF_UP. El total conjunto suma PRECINTOS y COMISION con céntimos exactos. Sin aptos devuelve el resumen y advertencia de §13, sin importes de emisión ni exigir configuración. Precio cero con aptos sí devuelve la previsualización completa. La consulta no reserva datos: la emisión revalida todo y puede rechazar cambios posteriores.

## 15. Registro de cobros municipales (bloque autorizado, 11 de octubre de 2026)

- POST `/facturaciones/:id/facturas/:facturaId/cobro`: registra un cobro completo de una factura perteneciente a esa facturación EMITIDA. PRECINTOS y COMISION son independientes, sin imponer orden.
- Cuerpo estricto: `fecha_cobro` (fecha real YYYY-MM-DD, años 0001–9999), `importe_cobrado` (cadena decimal no negativa, máximo diez dígitos enteros y dos decimales, sin exponente ni redondeo), `justificante` (referencia bancaria textual opcional o null; se recortan extremos, no se admiten cadenas vacías). No añade límites cronológicos no acordados ni carga de archivos.
- 201 devuelve el registro COBRO: id, factura_id, fecha_cobro, importe_cobrado con dos decimales y justificante. 400: formato/identificadores/query/campos inválidos. 404: facturación o factura ajena/inexistente. 409: estado distinto de EMITIDA, factura ya cobrada o importe distinto del total. Cero es admisible únicamente para una factura de importe cero.
- GET existente incluye `cobros` en facturaciones emitidas/reabiertas; se consulta en el mismo snapshot que cabecera y facturas.
- Comparación monetaria NUMERIC exacta. No se admiten cobros parciales ni superiores. Un único INSERT, protegido además por UNIQUE(factura_id) ya existente; sin modificar esquema.
- Registro y reapertura usan transacción READ COMMITTED y bloqueos Ayuntamiento → Facturación → Factura. Tras esperar se relee el estado; si gana el cobro, cualquier reapertura falla; si gana la reapertura, el cobro falla hasta reemitir. La presencia de cualquier cobro sigue bloqueando toda corrección/reapertura de la facturación.
- El bloque backend no incluye pagos, modificaciones ni eliminaciones de cobros. Interfaz de consulta/registro implementada posteriormente según docs/specs/interfaz-cobros-municipales/, con ambas facturas independientes, importe completo fijo y bloqueo de reapertura visible.

## 16. Preparación y confirmación de liquidación (bloque autorizado, 11 de octubre de 2026)

- POST `/facturaciones/:id/liquidacion/preparacion`, cuerpo `{}`: únicamente para EMITIDA con cobro completo de PRECINTOS, sin exigir COMISION. Devuelve propuesta sin escribir pagos ni borradores: facturacion_id, fecha_pago sugerida, importe_total y detalles. Cada detalle contiene participacion_facturacion_id, soe, denominacion_farmacia, cif_nif, importe y los cinco componentes bancarios existentes. C se propone desde FARMACIA actual; B permanece intacto. La propuesta puede contener cuenta incompleta para corregirla antes de confirmar.
- POST `/facturaciones/:id/liquidacion/confirmacion`: recibe fecha_pago real YYYY-MM-DD y la lista completa de detalles de la propuesta, revisada/corregida por el usuario. Debe incluir exactamente una vez cada participación, su importe completo y el SOE del establecimiento. No permite omisiones, participantes ajenos, duplicados ni importes menores/mayores. La suma NUMERIC debe cuadrar con factura y cobro PRECINTOS; nunca se usa Number para dinero ni se vuelve a sumar precintos.
- Preparación no tiene persistencia ni implica reserva: una nueva preparación obtiene el catálogo vigente; la confirmación conserva los datos C/cuenta explícitamente revisados, sin sustituirlos por el catálogo. Se persisten PAGO_FARMACIAS y todos los DETALLE_PAGO_FARMACIA en una única transacción. Sus UNIQUE ya existentes protegen pago por facturación y detalle por participación. No añade estados ni tablas.
- Fecha sugerida: siguiente lunes–viernes estrictamente posterior al cobro PRECINTOS, sin festivos, calculada sobre DATE PostgreSQL. La fecha editada (incluidos fines de semana) se guarda tal cual; no se inventan restricciones cronológicas.
- Validación bancaria del modelo de componentes español: ES + dos controles, entidad/oficina de cuatro dígitos, dos controles nacionales, cuenta de diez dígitos, conservando ceros. Antes de confirmar/exportar se validan los controles nacionales y el IBAN por módulo 97. Fuente de estructura: [Banco de España](https://clientebancario.bde.es/pcb/es/blog/que-se-esconde-tras-los-numeros-de-tu-cuenta-corriente-.html). El modelo actual no representa otros formatos nacionales; no se implementan excepciones de cuenta.
- GET `/facturaciones/:id/liquidacion` devuelve cabecera y detalles históricos confirmados. No consulta FARMACIA para sustituir snapshots; no hay rutas de modificación o borrado. Preparar/confirmar de nuevo devuelve 409, sin duplicar ni alterar datos.
- GET `/facturaciones/:id/liquidacion/contabilidad` recupera archivo Excel XML 2003 (.xml), sin nuevas dependencias, desde snapshots confirmados. Columnas mínimas C.13: SOE, TITULAR, CUENTA DESTINO, IMPORTE, TIPO TRANSFERENCIA=SEPA, CONCEPTO uniforme `Precintos - Ayuntamiento - MM/AAAA`, fecha elegida y total. Cuenta/SOE son texto y los importes celdas numéricas sin fórmulas; se escapa XML. No se persiste un archivo ni se ejecutan transferencias. Formato Excel XML aprobado por el usuario; plantilla corporativa no definida.
- Respuestas: 400 formato/cuerpo/IDs/query/cuenta inválidos; 404 proceso o pago no existente; 409 requisito previo, importes/cobertura/total incorrectos o liquidación ya existente; preparación/consulta/archivo 200 y confirmación 201.
- Misma transacción y orden de locks Ayuntamiento → Facturación que emisión/cobros/reapertura; comprobaciones después del lock. Consulta y exportación usan snapshot REPEATABLE READ READ ONLY. Interfaz posterior en docs/specs/interfaz-cobros-municipales/: listado/detalle de «Cobros y liquidaciones», revisión y confirmación del lote usando estas operaciones, sin modificar su contrato. El lote se presenta como «Liquidación confirmada»; no acredita ejecución bancaria.


## 17. Informe anual operativo por trimestres (bloque autorizado, 11 de octubre de 2026)

- GET `/facturaciones/informe-anual?anio=2026`, query estricta: anio obligatorio (entero decimal 1–9999), detalle_mensual opcional (`true`/`false`, defecto false), ayuntamiento_id opcional (ID positivo). Sin filtro incluye todos los Ayuntamientos con actividad emitida; filtro inexistente devuelve 404; formato/query inválidos 400.
- Año y trimestre proceden exclusivamente de PERIODO.anio/mes de FACTURACION. Se incluyen participaciones de EMITIDA con factura PRECINTOS existente. REVISION no entra. Criterio confirmado por el usuario: REABIERTA se excluye temporalmente y se devuelve advertencia y lista de procesos pendientes; al reemitir vuelve a entrar con los importes corregidos.
- Fuente: cada fila PRECINTO de cada entrega participante, precio_aplicado NUMERIC, incluida cantidad/precio cero; no se deduplica por código nacional ni por importe. No se unen incidencias, declarados, cobros o pagos ni se filtra el catálogo actual. Una factura PRECINTOS se comprueba mediante EXISTS para no multiplicar precintos; COMISION no entra.
- Respuesta: anio, detalle_mensual, total_anual, cuatro trimestres (trimestre, importe_total) y ayuntamientos (ayuntamiento_id, denominacion, total_anual, trimestres, farmacias). Cada farmacia se agrupa por ID estable de la entrega; devuelve farmacia_id, identidades_b (SOE/denominación/CIF históricos distintos), total_anual y trimestres. No se atribuye la actividad al titular actual ni a C. Si se pide detalle_mensual, cada trimestre de todos los niveles incluye sus tres meses (mes, importe_total), incluidos ceros. Sin actividad, total 0.00 y cuatro trimestres a cero.
- Todos los importes son cadenas con dos decimales. SQL suma NUMERIC por participación/mes; los agregados de respuesta usan céntimos BigInt, sin Number monetario ni redondeos nuevos. Subtotales trimestrales/mensuales/municipales y total anual cuadran exactamente.
- Lectura REPEATABLE READ READ ONLY: actividad y advertencias comparten snapshot, sin bloquear ni modificar facturación/cobros/pagos. La advertencia solo se refiere al año/filtro consultados.
- Es un informe operativo, no una declaración/informe fiscal. La consulta JSON, la pantalla y la exportación Excel XML están implementadas; no requieren cambios de esquema ni dependencias.


## 18. Exportación anual Excel XML y pantalla (11 de octubre de 2026)

GET `/facturaciones/informe-anual/excel` con la misma query estricta y servicio de §17; descarga `informe-anual-AAAA.xml`, application/xml. No requiere consulta previa. Reutiliza primitivas SpreadsheetML 2003 de liquidación; sin dependencias, cálculos nuevos ni cambios SQL. Hoja Resumen anual: Ayuntamiento, SOE, denominación, CIF, T1–T4, total anual; etiquetas visibles sin B, conservando identidades históricas B internas. Una fila por farmacia estable, subtotales municipales y general. Varios B históricos se conservan alineados en líneas dentro de sus celdas, sin multiplicar filas/importes. Hoja Detalle mensual opcional. Advertencia de reaperturas también en el archivo. Textos literales sin fórmulas, importes numéricos exactos y ceros conservados. Pantalla y aceptación en docs/specs/interfaz-informe-anual/; opción Ver informe conservada y exportación independiente de renderización.

