# Plan: Facturación municipal y liquidaciones

## Integración de precios — 12 de octubre de 2026

La corrección individual de Entregas comparte bloqueo municipal con preparación/emisión/reapertura/cobro, permite ausencia de cabecera y recalcula únicamente la participación existente, sin crearla ni cambiar B. Mantener reemisión de §14 y números/porcentajes históricos. EMITIDA y cualquier cobro bloquean correcciones y nuevas lecturas. Pruebas reales en entregas-precios.test; contrato individual sustituye el agrupado anterior.

## Estado

El cálculo/revisión y reapertura correctiva están implementados según spec §13; emisión conjunta/actualización correctiva según §14. Cobros completos independientes implementados según §15; preparación/confirmación de liquidación y Excel XML según §16. La pantalla de Cobros y liquidaciones conserva la fecha prevista y no acredita una transferencia. El informe anual operativo por periodo, con trimestres, meses opcionales, pantalla y exportación Excel XML, está implementado según §17–§18. La ejecución bancaria de transferencias queda fuera del MVP.

## Bloque de implementación aprobado el 11 de octubre de 2026

1. Añadir estado REVISION/EMITIDA/REABIERTA al esquema vigente y adaptar directamente las dos bases locales vacías financieramente, sin migración versionada; conservar todos los datos.
2. Calcular con SQL parametrizado y NUMERIC, una participación por entrega con aptos, cantidad por fila PRECINTO y total municipal exacto. Sin incidencias/declarados ni reevaluación del catálogo.
3. Persistir revisión; inicializar B como propuesta actual editable y conservarla al recalcular. En ausencia de aptos advertir sin crear facturas/participaciones nuevas.
4. Coordinar con el bloqueo municipal de Entregas. Permitir correcciones en REVISION/REABIERTA sin cobros; congelar B en EMITIDA/REABIERTA. Reapertura atómica con fecha/motivo.
5. Exponer cálculo, consulta, corrección de B y reapertura; no añadir interfaz ni operaciones de emisión/cobro/pago. La consulta distingue importes guardados y actuales.
6. Probar integración PostgreSQL real, códigos repetidos, exactitud, vacíos/cero, conservación histórica, estados/cobros y esperas concurrentes. Adaptar fixtures de cierre anteriores a EMITIDA explícito y ejecutar la suite completa.
7. Actualizar modelos escritos, guía, comprobador de esquema, db README y memoria con alcance/evidencia.

## Fases propuestas

Bloque de emisión autorizado: extender el módulo actual con POST emision, validación de los dos números, selección única de configuración por fecha y cálculos NUMERIC/round en la secuencia aprobada. Insertar ambas facturas/estado o actualizar ambas tras reapertura en una sola transacción municipal; conservar B/números/porcentajes históricos. Probar atomicidad incluso ante conflicto tardío de numeración, ceros, redondeo, estados, vigencias y concurrencia, sin modificar esquema. Contrato en spec §14.

1. Cerrar el diseño funcional detallado con la especificación vigente: lectura individual por precinto aunque se repita el código nacional; importe por `precio_aplicado`; series oficiales independientes con unicidad en todos los periodos por tipo; estados de edición y congelación de B/C; cobros independientes completos y pago completo por farmacia posterior al cobro de PRECINTOS.
2. Diseñar la sugerencia de fecha como el siguiente día de lunes a viernes después del cobro de PRECINTOS, sin tratamiento de festivos en el MVP. Permitir cambiar la fecha antes de confirmar y persistir la fecha elegida con el pago confirmado.
3. El esquema físico ya representa la serie por tipo con unicidad `(tipo, numero_factura)` y las relaciones de participación/pago previstas. Mantener la revisión de estas claves en las pruebas de esquema; no implementar en este bloque los flujos financieros.
4. Diseñar el flujo de revisión y emisión: B editable antes de emitir y congelado en la participación al emitir; una reapertura pre-cobro corrige los registros de la participación existente y recalcula su importe. Si cambia, actualiza la factura existente; conserva los números oficiales originales de PRECINTOS y COMISION sin asignar números nuevos, y registra fecha y motivo. No crear otra participación/versión ni consultar el catálogo actual. Después de cualquier cobro, bloquear reapertura. Diseñar también C/cuenta editables hasta confirmar el pago y congelados después.
5. Mantener el modelo documental de participación: una fila por entrega facturada, snapshot B y suma de sus precintos aptos por la entrega; cada detalle de pago enlaza la participación y conserva C/cuenta. Antes de implementar, diseñar restricciones físicas y migración que preserven trazabilidad y datos existentes.
6. Diseñar cobros independientes por factura, completos y no parciales; bloquear reapertura si existe cualquier cobro. Habilitar liquidación completa por farmacia únicamente tras cobro completo de PRECINTOS, sin ejecutar transferencias.
7. Diseñar el informe anual operativo por trimestre del periodo facturado, no por fecha de cobro municipal o pago a farmacias. Sumar `precio_aplicado` de precintos aptos, incluir PRECINTOS, excluir COMISION y permitir detalle mensual dentro de cada trimestre. El informe no es una declaración ni un informe fiscal.
8. Diseñar la ausencia de precintos aptos: si no existen en el Ayuntamiento/periodo, no emitir facturas y mostrar advertencia; si solo algunas farmacias tienen aptos, incluir únicamente esas farmacias en la emisión conjunta.
9. Preparar especificación API/UI, plan de migración independiente y pruebas de aceptación. La migración deberá preservar datos existentes y no rellenar titulares históricos desde el catálogo actual.
10. Implementar incrementalmente: persistencia de participaciones y sus vínculos a entregas; cálculo/revisión de importes; emisión conjunta PRECINTOS/COMISION; cobros independientes; detalles de pago enlazados a participaciones; resumen anual. Para cada fase, probar límites, transacciones y concurrencia según las decisiones aprobadas.

## Contradicciones y dependencias

- El esquema y las pruebas verifican `UNIQUE(tipo, numero_factura)`: mismo texto permitido entre series distintas y rechazado si se repite dentro de la misma serie.
- Para numeración, prever en las pruebas de diseño/implementación que el mismo número textual se acepte en dos series diferentes y se rechace dentro de una misma serie.

## Dependencias y límites

- Entregas, cálculo/revisión, emisión y reapertura correctiva están implementados; registro de cobros implementado; liquidación y Excel XML implementados.
- No usar el catálogo actual para reconstruir titulares históricos.
- La regla de fecha del MVP no requiere calendario territorial de festivos: cuenta únicamente los días de lunes a viernes.
- El bloque de spec §13 está autorizado e implementado. Los bloques §14 (emisión) y §15 (cobros) también están implementados; resolver las decisiones y contratos pendientes antes de ampliar a interfaz financiera.
- Mantener la política municipal de locks compartidos descrita en la especificación de Entregas al coordinar cierre con nuevas escrituras.
- No ejecutar transferencias; el informe anual es operativo y no tiene alcance fiscal.

## Registro de cobros autorizado (11 de octubre de 2026)

1. Reutilizar el esquema COBRO y la transacción/bloqueo de cabecera del módulo.
2. Validar fecha, importe decimal y referencia opcional; comprobar pertenencia, estado, total y unicidad antes del INSERT.
3. Exponer registro por factura y recuperar cobros mediante GET existente.
4. Integración real: importes correctos/incorrectos, independencia, duplicados, validación, reapertura y concurrencia en ambos órdenes; ejecutar dirigidas y suite completa.
5. Evidencia e implementación de los cobros: véase `tasks.md` y la especificación de interfaz correspondiente. Este plan conserva los pasos como registro del bloque autorizado; ya no representan trabajo pendiente.


## Liquidación autorizada (11 de octubre de 2026)

1. Propuesta sin persistencia desde C/cuenta actuales y fecha DATE del cobro completo PRECINTOS.
2. Validar cobertura exacta, importes completos, C/cuenta y fecha elegida; guardar cabecera y snapshots en transacción con UNIQUE y locks existentes.
3. Recuperar snapshots y exportar Excel para Contabilidad, sin transferencias ni dependencias nuevas.
4. Integración: requisito previo, fecha por día semanal/mes/año, correcciones, importes/participantes, congelación, duplicados y concurrencia; validar salida y ejecutar suite completa.


## Informe anual operativo autorizado (11 de octubre de 2026)

1. Consulta parametrizada por año y filtro municipal opcional, con periodo como única dimensión temporal.
2. Sumar precios aplicados por participación emitida, sin joins de cobros/pagos/COMISION que multipliquen actividad; excluir reaperturas pendientes con advertencia según decisión del usuario.
3. Agregar céntimos exactos por farmacia/Ayuntamiento/trimestre/año y detalle mensual opcional, preservando referencias B históricas.
4. Integración real: diferentes años/diciembre/enero, los doce meses/cuatro límites de trimestre, cobro/pago fuera del periodo, repetición de códigos/precios, exclusiones y cuadre; ejecutar dirigidas y suite completa.


## Exportación anual y pantalla autorizadas (11 de octubre de 2026)

1. Extraer primitivas SpreadsheetML existentes y reutilizar cálculo anual sin nuevas consultas ni sumas.
2. Endpoint Excel XML con hoja resumen por Ayuntamiento/farmacia, identidades B históricas alineadas, T1–T4/anual, subtotales y detalle mensual opcional.
3. Pantalla dedicada porque solo existía backend: ver/exportar independientes con filtros actuales; no exige renderizar para descargar.
4. Validar integración, interfaz, navegador y XML, ejecutar suite y documentar en interfaz-informe-anual.

## Previsualización autorizada (11 de octubre de 2026)

1. Añadir GET por facturación con validación estricta y snapshot REPEATABLE READ READ ONLY.
2. Compartir selección de configuración por fecha, omitiendo el lock SHARE usado durante la emisión en esta consulta de solo lectura; reutilizar cálculo SQL NUMERIC de emisión.
3. En reapertura, sumar precios aplicados de las participaciones existentes sin persistir el recálculo y usar porcentajes históricos. Aplicar advertencia, actualización requerida y límites monetarios.
4. Comparar con emisión real, verificar ausencia de mutaciones y ejecutar integración dirigida y suite completa. Interfaz permanece pendiente.
