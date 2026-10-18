# Tareas: Facturación municipal y liquidaciones

## Indicadores individuales de cobro en emitidas — 17 de octubre de 2026

- [x] Añadir `factura_precintos_cobrada` y `factura_comision_cobrada` mediante EXISTS en el SELECT existente; conservar `tiene_cobros`, orden, importes y selección EMITIDA/TD.
- [x] Comprobar mediante API las cuatro combinaciones de cobro y facturas de importe cero; verificar que consultar no modifica cabecera, facturas, participaciones ni cobros.
- [x] Dirigidas finales: 215/215 en siete archivos, incluida la integración financiera y sus regresiones. Detalles de interfaz y primera ejecución con timeout intermitente del logo en interfaz-facturacion-municipal/tasks.md. Sin cambios de esquema ni reglas de cobro/reapertura.

## Acceso a reapertura existente — 12 de octubre de 2026

- [x] Incorporar booleano tiene_cobros al SELECT de emitidas para bloquear acción común en interfaz. Reutilizar GET/POST de cabecera y reapertura; no cambiar servicio financiero, esquema, numeración ni reemisión.
- [x] PostgreSQL verifica flag sin cobros y con cobro de cualquiera de las dos facturas. Pruebas financieras existentes de motivo, registro, bloqueo, conservación del par original y concurrencia pasan. Suite final 1293/1293 en 48 archivos. Evidencia visual y detalle en interfaz-facturacion-municipal/tasks.

## Consulta de pendientes — 12 de octubre de 2026

- [x] GET de solo lectura con una fila por Ayuntamiento/periodo TD con aptos y sin emisión/cobros. Incluye ausencia de cabecera, revisión y reabierta; excluye vacías/incidencias y emitidas. Precio cero no excluye actividad. Contrato en spec, sin cambios de esquema o cálculo.
- [x] Integración de selección, reutilización de revisión sin duplicar, ausencia de documentos al preparar, reapertura con números y filtrado por cualquier cobro. Flujos financieros y concurrencia existentes intactos; suite final 1285/1285 en 48 archivos. Evidencia visual/inventario en interfaz-facturacion-municipal/tasks.
- [x] Decisión expresa elimina restricción adicional de numeración/envío documental. Motivo obligatorio y ausencia de cobros conservados; envío a Contabilidad no es un atributo del modelo y no se simula un historial que no existe.

## Integración individual vigente — 12 de octubre de 2026

- [x] Corregir un único precinto sin exigir cabecera/participación; actualizar la suma de participación solo cuando existe.
- [x] Mantener REVISION/REABIERTA sin cobros editables y EMITIDA bloqueada; cualquier cobro impide reapertura y escrituras. Bloqueos municipales, B congelado, números y reemisión intactos.
- [x] Concurrencia real de corrección con preparación inicial, emisión en ambos órdenes, reapertura y cobro; suite completa 1260/1260 en 48 archivos. Inventario y evidencia en entregas-precintos/tasks.

El bloque siguiente conserva el historial de la corrección agrupada anterior, sustituida por la regla individual vigente.

## Histórico: integración de corrección agrupada — 12 de octubre de 2026

- [x] Alinear el contrato financiero con la corrección por código/farmacia/facturación de Entregas; usar estados y bloqueo municipal actuales.
- [x] Verificar recalculado atómico de participación, B congelado, referencias conservadas, documentos originales hasta reemisión y números/porcentajes históricos intactos.
- [x] Verificar API real de rechazo en EMITIDA, reapertura bloqueada por cobro en cada factura, desbordamiento/rollback y carreras reales con emisión, reapertura y cobro. Evidencia en entregas-precios.test y tareas de Entregas; suite completa 1255/1255 en 48 archivos.

Estado: cálculo/revisión, emisión conjunta y reapertura correctiva implementados en backend (spec §13–§14). Cobros, pagos e interfaz financiera pendientes. Las secciones anteriores conservan el historial de cada bloque.

- [x] Actualizar el esquema físico con la participación única por entrega, el vínculo único de detalle de pago a participación y numeración oficial única por tipo/serie; no se implementaron flujos de facturación, cobro ni pago.
- [x] Añadir comprobaciones de restricciones del esquema y ampliar `db:check` para detectar instalaciones desactualizadas.

## Revisión de fuentes

- [x] Leer `MEMORY.md`, `README.md`, `db/schema.sql`, ambos modelos de datos, guía canónica y especificaciones relacionadas.
- [x] Distinguir API de Entregas implementada de las estructuras financieras presentes solo en esquema/documentación.
- [x] Contrastar las decisiones confirmadas con especificación vigente, guía y restricción física de numeración.

## Especificación conceptual

- [x] Precisar que cada lectura es un precinto individual; permitir códigos nacionales repetidos y contar cada lectura distinta una sola vez.
- [x] Mantener A→B→C: B corregible antes de emitir y congelado al emitir; reapertura correctiva antes de cobro no reemplaza B; C/cuenta corregibles antes del pago y congelados al confirmar.
- [x] Especificar que la reapertura pre-cobro corrige la participación existente y recalcula su importe, sin crear otra participación/versión ni consultar el catálogo actual; después de cualquier cobro queda bloqueada.
- [x] Especificar que si el recálculo pre-cobro cambia importes, se actualiza la factura existente; PRECINTOS y COMISION mantienen sus números oficiales originales y no se asignan números nuevos.
- [x] Especificar que cada reapertura registra automáticamente su fecha y requiere un motivo.
- [x] Registrar una serie por tipo de factura, números oficiales de Contabilidad normalmente como texto y unicidad funcional dentro de cada serie.
- [x] Aplicar al esquema unicidad por tipo/serie a través de los periodos y probar números repetidos entre series y dentro de una misma serie.
- [x] Definir documentalmente PARTICIPACION_FACTURACION: una entrega por participación, snapshots B de SOE/denominación/CIF e importe calculado desde sus precintos aptos a través de la entrega.
- [x] Definir cardinalidades de participación y el vínculo de DETALLE_PAGO_FARMACIA a la participación; el SOE del pago se mantiene como snapshot.
- [x] Mantener cobros independientes completos, sin parcialidad, y bloqueo de reapertura tras cualquier cobro.
- [x] Mantener liquidación completa por farmacia solo después del cobro de PRECINTOS y con vínculo a participación/entrega.
- [x] Especificar sugerencia del siguiente día de lunes a viernes posterior al cobro de PRECINTOS, sin considerar festivos en el MVP; permitir editar antes de confirmar y guardar la fecha elegida al confirmar.
- [x] Especificar informe anual operativo por trimestre del periodo facturado, no por fecha de cobro/pago; permitir detalle mensual dentro de cada trimestre, sumar precios aplicados de precintos aptos, incluir PRECINTOS y excluir COMISION. No es una declaración ni un informe fiscal.
- [x] Derivar criterios de aceptación y pruebas para lecturas repetidas, congelación de snapshots, series/cobros, liquidación y resumen anual.
- [x] Decidir que sin precintos aptos para el Ayuntamiento/periodo no se emiten facturas y se muestra advertencia; con aptos parciales solo participan las farmacias que los tienen.

## Contradicciones y cuestiones pendientes

- [x] Resolver la discrepancia entre unicidad global y unicidad por tipo: el esquema aplica `(tipo, numero_factura)` y la prueba permite repetir el texto entre series y lo rechaza dentro de una serie.

## Pendiente para implementar los flujos financieros

- [ ] Preparar especificación API/UI, migración y pruebas detalladas; no inferir titulares pasados del maestro actual.

## Criterios y casos documentales de participación

- [x] Criterio: cada participación corresponde a una entrega farmacia/periodo y esa entrega solo se factura una vez en su facturación correspondiente.
- [x] Criterio: el importe de participación suma cada `precio_aplicado` de los precintos aptos de la entrega una sola vez; las incidencias se excluyen y no hay relación duplicada a los precintos.
- [x] Criterio: al emitir se conserva B con SOE, denominación y CIF; la reapertura permitida recalcula la participación sin cambiar B ni crear otra versión.
- [x] Criterio: el detalle del pago referencia la participación, conserva C y la cuenta efectivamente usados; su SOE es un snapshot, no una clave relacional.
- [x] Caso de prueba documental: incluir una entrega con varios precintos aptos y una incidencia; comprobar que existe una sola participación, ligada a su entrega, que el importe suma cada precio aplicado apto una vez y que B queda guardado al emitir. Confirmar un pago y comprobar el vínculo de su detalle con esa participación y la conservación de C/cuenta, independientemente del valor copiado en SOE.
- [x] Criterio: sin ningún precinto apto para el Ayuntamiento/periodo, no emitir PRECINTOS ni COMISION y mostrar una advertencia; con aptos solo en algunas farmacias, incluir únicamente estas en la facturación.
- [x] Caso de prueba documental: para un Ayuntamiento/periodo sin aptos, verificar advertencia y ausencia de ambas facturas. Con varias farmacias y aptos solo para algunas, verificar la emisión conjunta, la exclusión de farmacias sin aptos y que el total PRECINTOS suma una vez los precios aplicados participantes.

## Criterios y casos de prueba documentales del informe anual

- [x] Criterio: trimestre/año se determina por el periodo facturado de los precintos, nunca por la fecha del cobro municipal ni del pago a farmacias.
- [x] Criterio: sumar `precio_aplicado` de cada precinto apto una vez; incluir PRECINTOS, excluir COMISION y cuadrar subtotales trimestrales con el total anual.
- [x] Criterio: se permite mostrar detalle mensual dentro de cada trimestre; el informe es operativo, no fiscal.
- [x] Caso de prueba previsto: combinar periodos de distintos años, incluidos diciembre de un año y enero del siguiente, con fechas de cobro municipal y pago a farmacias situadas en otros trimestres. Verificar que cada importe se asigna al trimestre y año de su periodo facturado, independientemente de las fechas de cobro y pago; comprobar el total anual correspondiente a cada año y que COMISION queda excluida.

## Criterios y casos de prueba documentales de la fecha de liquidación

- [x] Criterio: tras el cobro de PRECINTOS, sugerir el siguiente día de lunes a viernes; el MVP ignora festivos. El usuario puede editar la sugerencia antes de confirmar y la fecha elegida se guarda al confirmar el pago.
- [x] Caso de prueba previsto: cobro en viernes propone el lunes siguiente; cobro en sábado y cobro en domingo proponen el lunes siguiente. No se consulta ni aplica calendario de festivos.
- [x] Caso de prueba previsto: editar la fecha sugerida antes de confirmar el pago y verificar que la fecha elegida queda persistida en el pago confirmado y se muestra al volver a consultarlo.

## Criterios y casos de prueba documentales de reapertura correctiva

- [x] Criterio: sin cobros, la reapertura corrige los registros de la participación existente y recalcula su importe; conserva su B y no crea otra participación o versión ni consulta FARMACIA actual.
- [x] Criterio: si el recálculo modifica los importes antes de cualquier cobro, se actualiza la factura existente con el nuevo importe; PRECINTOS y COMISION conservan sus números oficiales originales y no se asignan números nuevos.
- [x] Criterio: la reapertura conserva su trazabilidad mediante la fecha registrada automáticamente y el motivo obligatorio.
- [x] Criterio: la existencia de cualquier cobro impide reabrir la facturación.
- [x] Caso de prueba previsto: emitir con participación B, reabrir antes de cobros, corregir registros y verificar el importe recalculado, la misma participación, B sin cambios y ausencia de consulta al catálogo. Repetir con un cobro registrado y verificar rechazo de la reapertura y ausencia de cambios.
- [x] Caso de prueba previsto: emitir PRECINTOS y COMISION con números oficiales, reabrir sin cobros y modificar registros para cambiar los importes recalculados. Verificar que se actualizan las facturas existentes con los importes nuevos, cada una conserva exactamente su número oficial original, no se asignan números nuevos y la reapertura registra fecha y motivo.

## Fuera del bloque documental anterior

- [x] Sin cambios de código, esquema, migraciones o datos.
- [x] Sin pruebas ejecutadas: cambio exclusivamente documental.
- [x] Sin acciones Git.
- [x] La nota de alcance refleja que la revisión documental previa también modificó archivos fuera de `docs/specs/facturacion-municipal/`.

## Implementación de cálculo/revisión autorizada (11 de octubre de 2026)

- [x] Revisar instrucciones/memoria, modelos escritos/ER, guía, esquema, spec/plan/tasks e implementación de Entregas y precintos antes de completar el bloque.
- [x] Añadir estado REVISION/EMITIDA/REABIERTA y adaptar directamente las dos bases locales, verificando nombre/host y ausencia de registros financieros. Sin migración versionada ni borrado de datos; script temporal eliminado.
- [x] Crear cálculo persistido, consulta, corrección de B y reapertura con fecha/motivo. Seguir rutas/controladores/servicios/repositorio/validación existentes, sin dependencias nuevas.
- [x] Sumar NUMERIC exacto por cada fila PRECINTO/entrega; permitir códigos repetidos y cero. Excluir incidencias/declarados/estados actuales. Total municipal sin coma flotante.
- [x] Conservar B/IDs al recalcular; quitar solo borradores sin aptos; conservar participaciones históricas a cero tras reapertura sin sustituir B ni crear versiones/participaciones nuevas.
- [x] Ajustar editabilidad de creación, declarados, registro y borrado de Entregas; estado emitido o cualquier cobro bloquean. Revisión no congela B; reapertura lo conserva congelado.
- [x] Añadir integración PostgreSQL real y esperas concurrentes; adaptar fixtures antiguos de cierre a EMITIDA explícito, sin quitar ni desactivar pruebas.
- [x] Pruebas dirigidas finales: 237/237 en siete archivos aprobadas (incluidos esquema y regresiones de Entregas). DB_NAME fijado exclusivamente a `gestion_facturacion_medicamentos_test`, host local y current_database verificados antes de escribir; limpieza solo de fixtures propios.
- [x] Sintaxis de los cinco archivos del módulo, app, repositorio de Entregas, comprobador de esquema y prueba nueva correcta.
- [x] Suite completa: 949/949 pruebas en 34 archivos aprobadas, exclusivamente en la base dedicada local. `db:check` correcto en desarrollo/pruebas; columna TEXT NOT NULL DEFAULT REVISION y CHECK de los tres estados verificados. Cero facturaciones, participaciones, facturas, cobros y reaperturas al terminar en ambas bases; cero medicamentos/municipios propios de esta prueba. Scripts temporales retirados.
- [x] Documentar contrato y límites en spec §13, modelos, guía canónica v14, db README y AGENTS. Memoria se actualiza al cierre.
- [x] Sin acciones Git, emisión, cobros, pagos ni interfaz financiera. Estados emitidos y cobros de ambas facturas se preparan exclusivamente mediante fixtures SQL en pruebas.

## Emisión conjunta autorizada (11 de octubre de 2026)

- [x] Revisar AGENTS, memoria, spec/plan/tasks, esquema, modelos, vigencia inclusiva y HALF_UP de guía, y código de cálculo/revisión.
- [x] Documentar contrato incremental y plan antes de validar implementación: spec §14.
- [x] Implementar emisión/actualización del par con transacción, control municipal, números oficiales por serie, configuración temporal y congelación/conservación de B. GET emitida/reabierta recupera documentos en snapshot consistente.
- [x] Integración real: varias farmacias, códigos repetidos, exclusión incidencias/declarados, redondeo por debajo/en/por encima de mitad y del IVA sobre comisión redondeada (base 0.89), precio cero, configuración ausente/solapada y vigencia inclusiva, desbordamiento y revisión desactualizada.
- [x] Numeración: textos/ceros iniciales, mismo texto entre series, duplicados en cada serie entre periodos, números inválidos, estado emitido repetido y emisiones concurrentes.
- [x] Atomicidad: conflicto tardío real en COMISION tras INSERT de PRECINTOS, controlando espera PostgreSQL contra un registro concurrente aún no confirmado; rollback total del par/estado y B todavía editable. Sin mocks de SQL ni triggers de prueba.
- [x] Reapertura: mismo par/IDs/B/números originales, recálculo automático, porcentajes históricos conservados ante cambios de catálogo/configuración; rechazo de nuevos números y cualquier cobro. Cero aptos conserva documentos/estado con advertencia.
- [x] Dirigidas: 51/51 en tres archivos; suite completa final 976/976 en 35 archivos. Base local dedicada verificada antes de fixtures, DB_NAME sobrescrito para cada ejecución sin modificar .env. Limpieza limitada a registros propios; comprobación posterior con cero procesos, participaciones, facturas, cobros y reaperturas. Sintaxis de los cinco archivos del módulo y la nueva prueba correcta; revisión manual sin comandos Git.
- [x] Actualizar contrato/plan, guía canónica v15, db README y memoria. Sin esquema/migraciones, escrituras en desarrollo, dependencias, cobros, pagos, interfaz ni Git.

## Registro de cobros municipales autorizado (11 de octubre de 2026)

- [x] Revisar instrucciones, memoria, spec/plan/modelos, esquema COBRO y código de emisión/reapertura. Reutilizar tabla, campos y UNIQUE existentes sin cambios SQL.
- [x] Validar fecha real, importe decimal exacto y justificante opcional; comprobar pertenencia, estado emitido, importe total y cobro único. Registrar y recuperar mediante GET existente.
- [x] Reutilizar transacción READ COMMITTED y orden de locks municipal/cabecera/factura; mantener reapertura atómica con su comprobación de cualquier cobro.
- [x] Integración: registro completo y recuperación, fecha/justificante, ausencia de mutación de facturas, importes menores/mayores/cero incorrecto, ambas órdenes de cobros independientes, duplicado secuencial/concurrente, facturas cero, formato/fechas inválidas, pertenencia y reemisión correctiva seguida de cobro recalculado.
- [x] Dos solicitudes API reales en cola PostgreSQL, verificando pg_blocking_pids antes de liberar: cobro primero impide reapertura sin registrar historial; reapertura primero impide cobro sin registrar ninguno. Sin mocks SQL.
- [x] Pruebas dirigidas: 79/79 en tres archivos; suite completa: 1005/1005 en 36 archivos. Exclusivamente en base dedicada local, verificando host y current_database antes de fixtures; limpieza limitada a registros propios. Sintaxis correcta y revisión manual sin Git.
- [x] Actualizar spec §15, plan, guía canónica v16, db README y memoria. Sin pagos, interfaz, dependencias, cambios SQL ni Git.
- [x] Comprobación posterior de solo lectura: base dedicada con cero facturaciones, participaciones, facturas, cobros y reaperturas.

## Liquidación autorizada (11 de octubre de 2026)

- [x] Propuesta revisable y confirmación atómica desde cobro completo PRECINTOS. Sin borradores persistidos ni cambios de esquema.
- [x] Integración de cobertura/importes, snapshots, fechas y unicidad/concurrencia. Cobro COMISION y cobro PRECINTOS parcial preparados como fixtures no habilitan liquidación. Correcciones de C/cuenta, cambio posterior de catálogo, importe cero, omisiones/duplicados/ajenos, IBAN y controles inválidos.
- [x] Excel XML 2003 aprobado por el usuario, desde snapshots: C.13, total, SEPA, concepto municipal/periodo, fecha editada, ceros preservados y cadenas escapadas como texto sin fórmulas. Parser .NET confirma XML bien formado. Sin transferencias ni interfaz.
- [x] Dirigidas 111/111 en cuatro archivos; suite completa 1037/1037 en 37 archivos. Base dedicada local verificada antes de fixtures; limpieza limitada a registros propios. Documentación/modelo/memoria actualizados. Sin Git.

- [x] Fechas: siete días semanales, fin de año/mes bisiesto y ausencia de festivos; sugerida/editada conservadas en consulta/exportación. Sin imponer nuevas restricciones a la fecha editada.
- [x] Dos confirmaciones API simultáneas crean un pago único; conflicto UNIQUE tardío en segundo detalle contra actor SQL no confirmado revierte cabecera/primer detalle, comprobando espera PostgreSQL real. Sin mocks SQL ni triggers de prueba.
- [x] Comprobación final de solo lectura: base dedicada sin facturaciones, facturas, cobros, pagos ni detalles de pago al terminar. Sintaxis de los seis archivos del módulo y la prueba correcta; revisión manual sin comandos Git. .env y base de desarrollo intactos.

## Informe anual autorizado (11 de octubre de 2026)

- [x] Consulta anual por periodo, grupos municipales/farmacia y detalle mensual opcional. NUMERIC por participación y agregados en céntimos BigInt; snapshot REPEATABLE READ READ ONLY.
- [x] Exclusión REABIERTA con advertencia según decisión expresa del usuario; revisión/COMISION excluidas. Reemisión incorpora correcciones una vez y retira advertencia; año/filtro delimitan pendientes.
- [x] Integración 15 casos nuevos: años/diciembre/enero, doce meses/cuatro trimestres, varias farmacias/municipios, cobro/pago en otros trimestres/años, códigos/precios repetidos, incidencias/declarados excluidos, precio cero, catálogo/identidad histórica, total anual superior al límite de una factura y validación/filtros. Dirigidas 74/74 en tres archivos; suite completa 1052/1052 en 38 archivos. Documentación, modelo y memoria actualizados.

- [x] Fixture corregido para compartir la configuración global por fecha entre municipios del mismo mes: no duplicar vigencias ni modificar configuración ajena.
- [x] Sintaxis de los seis archivos del módulo y la prueba correcta; revisión manual sin Git. Sin esquema, dependencias, interfaz ni exportación.
- [x] Comprobación final de solo lectura: base dedicada sin facturaciones, participaciones, facturas, cobros, pagos ni detalles de pago. Fixtures propios limpiados; base de desarrollo y .env intactos. No se ejecutó Git.

## Exportación anual y pantalla autorizadas (11 de octubre de 2026)

- [x] Descarga anual XML nativa Excel con query/servicio/snapshot existentes. Primitivas compartidas con liquidación, sin dependencias. Resumen de nueve columnas, fila única por farmacia con todos los B históricos, T1–T4 y total, subtotales municipales y general; mensual opcional y advertencia de reaperturas.
- [x] Pantalla y acceso Inicio, Ver informe/Exportar Excel XML independientes. Pruebas de exportación antes de consulta, filtros actuales, reintento, validación/concurrencia UI, importes anuales grandes y recursos.
- [x] Integración con periodos de años distintos, códigos/precios repetidos, varios B y farmacias, agrupación y cuadre, COMISION excluida, cobro/pago en otros años y snapshots frente a catálogo posterior. Sin cambios del cálculo ni esquema.
- [x] Dirigidas 64/64 en cuatro archivos; suite completa 1061/1061 en 39 archivos. Navegador real y descarga antes de ver verificados; parser .NET confirma XML bien formado y nueve columnas sin fórmulas. Detalle en interfaz-informe-anual/tasks.
- [x] Documentar contrato §18 y nueva interfaz spec/plan/tasks, actualizar guía/memoria. Sin dependencias ni Git.

## Previsualización autorizada (11 de octubre de 2026)

- [x] GET /facturaciones/:id/previsualizacion en snapshot READ ONLY. Reutiliza cálculo y selección temporal de emisión, sin números, facturas, recálculo persistido ni cambio de estado/B.
- [x] Integración: ocho bases con HALF_UP y precio cero, precios/códigos repetidos, tasas configuradas, configuración ausente/solapada, revisión desactualizada, advertencia sin aptos, reapertura con precios corregidos y tasas históricas, emitida/cobro, ID/query/cuerpo, total conjunto grande y desbordamiento de comisión. Snapshots completos antes/después de consultar; comparación con documentos emitidos reales.
- [x] Dirigidas finales: 66/66 en dos archivos; suite completa: 1077/1077 en 39 archivos. Sintaxis de cuatro archivos backend y prueba correcta. Fixtures exclusivamente en base local dedicada verificada, con limpieza propia. Primer intento dirigido sin permisos: PostgreSQL EACCES; repetición autorizada correcta.
- [x] Especificación, plan y memoria actualizados. Sin interfaz, dependencias, esquema ni Git.
