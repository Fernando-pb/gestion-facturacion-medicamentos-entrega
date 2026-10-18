# Interfaz de Cobros y liquidaciones

## Alcance aprobado (11 de octubre de 2026)

Fuentes: petición/propuesta aprobada, AGENTS.md, facturacion-municipal/spec §15–16, modelo COBRO/PAGO_FARMACIAS/DETALLE_PAGO_FARMACIA y patrones de Entregas y Facturación municipal. Inicio ofrece «Cobros y liquidaciones» en /cobros-municipales.html. Sin cambios API/esquema/reglas financieras; sin transferencias, justificantes nuevos, correcciones de lotes confirmados ni reapertura.

## Listado y navegación

Cada bloque de «Facturas municipales» muestra el nombre completo (PRECINTOS o GASTOS/COMISIÓN), debajo «Número oficial: …» y después el importe y estado de esa misma factura. Usa `numero_factura_precintos` y `numero_factura_comision` del listado, procedentes de FACTURA; conserva formato, ceros iniciales y contenido literal mediante textContent. Si falta el campo, es null, vacío o solo contiene espacios, muestra «Sin número»; no genera numeración. Los números largos admiten salto de línea dentro de su bloque sin truncarse, sin solaparse con otros datos ni ensanchar la tabla. Se mantiene el diseño de fichas móviles, los filtros combinados y la fecha prevista de liquidación.

GET /facturaciones/emitidas carga automáticamente las emisiones. Orden año/mes del periodo descendente y descripción del Ayuntamiento alfabética. Muestra periodo, Ayuntamiento, importes históricos PRECINTOS y GASTOS/COMISIÓN, estado de cobro individual de ambas facturas y estado conjunto: Pendiente (ninguna cobrada), Parcial (una cobrada) o Cobrada (ambas cobradas). Filtros locales por descripción (sin distinguir mayúsculas/tildes), periodo y estado conjunto; son combinables y se conservan en URL/retorno. Muestra aparte la fecha registrada en PAGO_FARMACIAS como fecha prevista de liquidación a farmacias, o «Sin fecha prevista». La fecha solo registra la previsión; la aplicación no ejecuta ni confirma la transferencia y no representa un estado de pago real. No pide ni muestra IDs.

Abrir detalle consulta directamente GET /facturaciones/:id y GET /facturaciones/:id/liquidacion. Contexto Ayuntamiento/periodo desde la fila. Enlaces existentes con facturacion_id abren tras localizar el contexto en listado, sin segunda búsqueda. Filtros conservados en URL mediante history.replaceState y al volver al listado, que se recarga. pageshow persisted actualiza listado/detalle. Errores ofrecen reintento, sin invocar cálculo/emisión.

El detalle no ofrece documentos ni refresco manual ordinario: los documentos se consultan desde el listado independiente de Facturación municipal. Cobros se actualizan tras registrar con la respuesta confirmada y consulta de liquidación; el lote se actualiza con los snapshots devueltos al confirmar. «Consultar estado antes de continuar» aparece solo ante una consulta fallida, conflicto o resultado incierto, para recuperar ambos estados mediante GET sin repetir escrituras.

## Cobros del Ayuntamiento

Tarjetas independientes PRECINTOS y GASTOS/COMISIÓN: número textual, importe exacto, Pendiente de cobro/Cobrada, fecha/importe/justificante históricos. Solo EMITIDA sin cobro ofrece registro, sin segundo cobro ni orden impuesto.

Formulario separado: importe completo fijo, fecha real YYYY-MM-DD 0001–9999 (hoy local editable sin restricciones cronológicas nuevas), justificante textual opcional. Confirmación explícita de cobro completo y bloqueo de reapertura. POST existente recibe importe exacto; justificante vacío pasa a null. Un cobro no prepara/confirma automáticamente liquidaciones.

Respuesta confirmada actualiza tarjetas con COBRO devuelto. Un fallo posterior de consulta de liquidación no deshace el cobro. No hay acción de reapertura, incluso sin cobros.

## Liquidación a farmacias

Sección independiente de ingresos. Preparación disponible solo para EMITIDA y PRECINTOS cobrada íntegramente; COMISIÓN no es necesaria ni suficiente. API revalida requisitos, cobertura y concurrencia.

POST /facturaciones/:id/liquidacion/preparacion con {} devuelve lote completo sin persistirlo. Cada SOE e importe completo son de solo lectura; titular destinatario (C interno), CIF/NIF y cinco componentes bancarios son revisables. Cuenta española, dígitos/ceros conservados como texto; API valida controles nacionales/módulo 97 sin lógica bancaria alternativa en pantalla.

Fecha común sugerida por servidor: siguiente lunes–viernes después del cobro PRECINTOS, sin festivos. Editable, incluidos fines de semana, sin restricciones temporales nuevas. Cambiar fecha/titular/cuenta invalida confirmación. Cancelar descarta propuesta sin escribir.

POST /facturaciones/:id/liquidacion/confirmacion recibe todas las participaciones exactamente una vez, importes completos originales, SOE, datos revisados y fecha elegida. Dinero como cadenas, sumas de comprobación en céntimos BigInt sin redondeo. API conserva transacciones/UNIQUE/validaciones.

Lote existente: «Liquidación confirmada», fecha, total y snapshots históricos de titulares/cuentas/importes, sin edición ni duplicados. No implica pago bancario acreditado. GET /facturaciones/:id/liquidacion/contabilidad descarga Excel XML desde snapshots; no ejecuta/comprueba transferencias.

## Errores, concurrencia y diseño

Solo 404 «Liquidación confirmada no encontrada.» tras verificar facturación representa ausencia. Red/servidor/respuesta incoherente impide preparación hasta nueva consulta.

Errores definitivos conservan entradas. Envío doble/navegación bloqueados durante operación. 409/respuesta incierta exige GET de facturación y liquidación antes de otro POST. No se repiten POST automáticamente; GET fallido mantiene bloqueo. Recuperación muestra registro confirmado o permite nueva revisión explícita si no existe.

Márgenes de 1,5 rem (1 rem en pantallas estrechas), tarjetas adaptables, campos agrupados por farmacia y formulario separado. Tabla de escritorio ocupa el ancho disponible sin mínimo horizontal. En «Facturas municipales» cada factura forma un bloque vertical: nombre completo sin cortes arriba e importe/estado debajo, en todos los tamaños. En pantallas estrechas cada fila se presenta como ficha etiquetada; el bloque de facturas ocupa el ancho completo de su celda y el botón queda dentro de la columna. El ancho de las fichas incluye relleno y bordes. Botones comunes, texto seguro textContent, etiquetas, role status/alert y foco. No se mezclan ingresos con liquidaciones.

## Fuera de alcance

Transferencias ejecutadas/rechazadas, justificantes del lote/farmacia, correcciones y estados bancarios requieren reglas/autorización independientes. No se deduce «pagado» de liquidaciones históricas.
