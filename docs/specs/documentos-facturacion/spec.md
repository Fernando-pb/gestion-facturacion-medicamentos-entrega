# Documentos de facturación municipal — implementación aprobada

## Estado y fuentes

Propuesta aprobada e implementada, 11 de octubre de 2026. Fuentes: solicitud adjunta del usuario, AGENTS.md, README.md, MEMORY.md, modelo conceptual y lógico, db/schema.sql, guía canónica C.10–C.11, facturacion-municipal/spec y pantallas de emisión/cobros. Esquema y API documentales adaptados con autorización expresa; Cobros mantiene su funcionalidad.

La petición actual prevalece sobre C.10–C.11: relación agregada por farmacia sin detalle de cada precinto; gastos globales sin reparto por farmacia; logo y emisor actuales en reimpresiones. Aclaración expresa del usuario: el presidente histórico es el del Colegio emisor. Su nombre actual procede de configuracion_documentos.nombre_presidente; el alcalde municipal no interviene.

## Protección de la configuración documental — 17 de octubre de 2026

GET y PUT `/configuracion-documentos` requieren la misma sesión que las demás API privadas. La sesión se comprueba antes de entrar en el router y en su parser JSON específico. Sin sesión y con origen admitido, la respuesta es 401 JSON; PUT conserva además el control global de Origin (403 si falta o no coincide), previo a la sesión. Al aplicar el middleware sobre una ruta montada, el rechazo identifica la API mediante baseUrl y path.

El router permanece antes del parser JSON general: mantiene su límite de `1500kb` para aceptar el logo PNG/JPEG de hasta 1 MiB codificado en Base64. Las validaciones del emisor y logo siguen vigentes. Un cuerpo que supera ese límite recibe 413 JSON con el mensaje existente; el rechazo no cambia la configuración guardada.

## Documentos solicitados

- Factura PRECINTOS: número oficial, fecha funcional y periodo, cantidad e importe total guardados en FACTURA.
- Factura COMISIÓN: número oficial, base, tasas, comisión, IVA y total guardados en FACTURA. No invoca previsualización ni cálculo de emisión.
- Relación global: total municipal superior y filas con SOE, denominación y CIF históricos B, recuento por entrega e importe guardado de participación. Sin gastos por farmacia.
- Gastos globales: total de COMISIÓN superior, base PVP, tasas, comisión, IVA y total de la factura guardada. Sin filas de farmacia. El importe es el mismo consultado en Cobros.

Las facturas se imprimen individualmente o juntas, con salto de página entre ellas; los informes por separado. Consultar/imprimir no emite, cobra, paga ni escribe datos.

### Listado de emisiones guardadas

GET /facturaciones/emitidas, sin parámetros ni cuerpo (400 si se aportan), devuelve una lista de facturacion_id, ayuntamiento (denominación), mes, anio, importe_precintos e importe_comision como cadenas decimales. Un SELECT enlaza FACTURACION, AYUNTAMIENTO, PERIODO y las dos FACTURA por tipo; solo EMITIDA/TD. Orden por año/mes descendente y lower(denominación), denominación e ID ascendente. Importes persistidos, sin joins con precintos/cobros ni recálculos/escrituras. REVISION y REABIERTA no se listan. Entrada única desde Inicio a Facturación municipal; cada fila abre el servicio documental existente. Sin cambios de esquema.

### Localización por Ayuntamiento y periodo

GET /facturaciones/busqueda?ayuntamiento_id=<id>&periodo_id=<id> valida ambos identificadores positivos de PostgreSQL y rechaza claves adicionales (400). Reutiliza la consulta parametrizada de la cabecera TD existente para el Ayuntamiento y periodo; devuelve facturacion_id y estado (200), o ausencia (404). Es un SELECT sin bloqueos de escritura, sin crear cabecera, calcular, emitir, asignar números ni tocar cobros. La interfaz abre los documentos solo para EMITIDA, manteniendo la consulta documental histórica existente y sus restricciones. No requiere cambios de esquema.

## Datos existentes y límites

FACTURA conserva importes, números, cantidad municipal y porcentajes; PARTICIPACION_FACTURACION conserva B e importe. El recuento por farmacia se obtiene exclusivamente de los precintos de su entrega, sin joins con incidencias, pagos o cobros que multipliquen filas. EMITIDA bloquea correcciones; REABIERTA puede tener actividad e importes pendientes de reemisión. No se generan documentos en REVISION ni REABIERTA, avisando de la corrección pendiente.

FACTURACION no conserva presidente; AYUNTAMIENTO tiene alcalde opcional. CONFIGURACION_DOCUMENTOS contiene logo_personalizado y nombre_presidente global, firma y mostrar_firma, sin servicio ni interfaz. No hay campos de emisor ni archivos de logo en el repositorio inspeccionado. El usuario ha facilitado las cuatro referencias visuales indicadas abajo.

## Referencias visuales recibidas

El usuario aportó factura gastos.png, factura precintos.png, resumen global precintos.png y ejemplo resumen global.png (archivos de su Desktop, adjuntos en la conversación). Son referencias de presentación; sus textos, datos tapados, tipos IVA y fechas de ejemplo no introducen reglas de negocio ni valores que deban copiarse.

- Facturas: A4 vertical, logo arriba a la izquierda, número y periodo a la derecha, destinatario en recuadro, concepto, importes y zona inferior de presidente/firma y pie del emisor.
- Relación: cabecera municipal/periodo, tabla SOE/farmacia/precintos/PVP y bloque de totales. Se mantienen B/CIF y total superior pedidos aunque no aparezcan igual en el ejemplo.
- Gastos: referencia de resumen global con base, comisión, IVA y total conjunto. Se adapta al documento global solicitado sin repetir filas de farmacia; se distingue claramente total COMISIÓN del total conjunto PRECINTOS + COMISIÓN.
- Firma: las referencias muestran una imagen/sello, pero su edición y almacenamiento no forman parte del alcance autorizado actual; no se copiará la imagen institucional ni se inventará una firma.

El usuario confirmó que «EL PRESIDENTE» corresponde al Colegio emisor. El nombre debe conservarse como histórico al emitir; modificar después la configuración no lo sustituye en reimpresiones.

## Cambios aprobados e implementados

1. Añadir facturacion.nombre_presidente_historico TEXT nullable. Capturar configuracion_documentos.nombre_presidente (presidente del Colegio emisor) en la primera emisión, en la misma transacción; conservarlo en reapertura/reemisión. Incluir la edición del nombre actual del presidente en la configuración documental. No copiar retrospectivamente el nombre actual a procesos antiguos. Tratamiento aprobado para registros anteriores sin fuente: mostrar «No consta el presidente histórico» y advertencia; no se inventa un nombre histórico.
2. Extender configuracion_documentos con datos_emisor JSONB validado por claves (denominacion, cif, direccion y contacto opcional), solo configuración actual. Garantizar una configuración única después de inspeccionar las filas existentes; nunca borrar ni elegir arbitrariamente entre configuraciones incompatibles.
3. Reutilizar logo_personalizado TEXT para una imagen PNG/JPEG codificada como data URL y validada en servidor: base64 estricto, máximo 1 MiB decodificado y firma binaria concordante con MIME. Sin SVG/HTML, referencias externas ni rutas suministradas por usuario. El logo se guarda junto a la configuración en PostgreSQL, sin carpetas públicas ni dependencias nuevas. El límite JSON ampliado se aplica solo a la ruta de configuración, no globalmente. Se verifican estructura de chunks/cabecera/final PNG y segmentos/dimensiones/final JPEG; el navegador decodifica el logo antes de imprimir.
4. GET /facturaciones/:id/documentos como contrato nuevo de lectura consistente REPEATABLE READ READ ONLY: cabecera, Ayuntamiento/periodo, presidente histórico, facturas, participaciones y configuración actual. Comprobar cuadre exacto de participaciones/cantidad con PRECINTOS y comisión+IVA con total guardado, sin recalcular porcentajes. Rechazar inconsistencias sin cambiar importes.
5. GET/PUT /configuracion-documentos como contratos nuevos para la configuración actual, con validación estricta y escritura atómica. No ampliar COBRO ni sus rutas.

Adaptación directa autorizada y aplicada a gestion_facturacion_medicamentos y gestion_facturacion_medicamentos_test: nombres/host verificados y configuración bloqueada durante inspección/ALTER; ambas tenían cero configuraciones y cero facturaciones. Sin borrados ni migración versionada. Otras instalaciones necesitan adaptación explícita preservando sus datos.

## Impresión propuesta

HTML con CSS de impresión A4 y diálogo del navegador (permite guardar PDF), sin motor PDF ni dependencia nueva. Ocultar navegación/acciones al imprimir, encabezados de tablas repetibles y filas sin cortes cuando quepan. Dos facturas conjuntas en páginas separadas; informes largos con paginación natural. Salida aprobada: HTML imprimible y guardar PDF mediante el navegador. No se genera un PDF en el servidor.

## Contratos y limitaciones implementados

GET /facturaciones/:id/documentos: ID estricto, sin body/query, 200 con cabecera municipal/periodo/presidente, ambas facturas, participaciones B, configuración actual y advertencias; 400 inválido, 404 ausente, 409 estado distinto de EMITIDA o cuadre inconsistente. Sin escrituras, consultas de catálogo ni cálculo alternativo de comisión/IVA. Direcciones y datos del Ayuntamiento son los del maestro existente; no se ha añadido otro snapshot municipal fuera de la propuesta.

GET /configuracion-documentos y PUT /configuracion-documentos: objeto estricto nombre_presidente nullable, logo_personalizado nullable, datos_emisor con denominacion/cif/direccion y contacto opcional nullable; textos 1–500 tras trim, sin controles. Logo máximo 1 MiB/4096 por eje; JSON máximo 1500 KiB solo en esta ruta, exceso 413. Una configuración actual como máximo mediante índice único y guardado transaccional. No se acepta una ruta o URL de archivo; referencias antiguas inválidas se omiten en las consultas. No se incorpora gestión de firmas.

El presidente existente en configuración se captura en primera emisión dentro de la transacción del par de facturas; sin configuración/nombre queda NULL y se advierte, como los históricos sin fuente. Reemisión conserva el snapshot. No se inventan ni sustituyen presidentes antiguos. Para imprimir se exige emisor configurado; el botón consulta nuevamente todos los datos y espera a que el logo se decodifique. Sin logo configurado se muestra marcador textual del emisor.

Revisión visual con datos ficticios en memoria, sin escrituras financieras: cuatro vistas, anchos de impresión/móvil y salto CSS explícito entre facturas. El resultado físico/PDF depende del diálogo del navegador; no se ha ejecutado una impresión física ni exportado un PDF en esta comprobación.
