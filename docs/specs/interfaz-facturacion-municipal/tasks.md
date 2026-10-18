# Tareas

## Estado de cobro y filtros por factura — 17 de octubre de 2026

- [x] Revisar listado, consulta SQL y estados existentes; obtener confirmación de la propuesta antes de implementar.
- [x] Mostrar Pendiente/Cobrada bajo cada importe y añadir dos selectores Todos/Pendiente/Cobrada combinados con Ayuntamiento/periodo, conservando orden y contador.
- [x] Conservar filtros en URL, enlaces documentales, retorno y pageshow; mantener bloqueos y actualizar estados ante cobros confirmados al consultar reapertura.
- [x] Cubrir nueve combinaciones de filtros, cero coincidencias, importes cero, URL inválida, carga incompleta/reintento, navegación y cobros concurrentes. API cubre ninguna, una u ambas facturas cobradas.
- [x] Pruebas relacionadas: 215/215 aprobadas en siete archivos (facturacion-emision, facturacion-listado-interfaz, documentos, documentos-busqueda, facturacion-cobros, cobros-municipales-interfaz y facturacion-municipal-interfaz), PostgreSQL local dedicado y --no-file-parallelism. Primera ejecución: 213/214, timeout en el caso preexistente del logo; repetición completa de dirigidas tras añadir una prueba de URL inválida: 215/215.

Archivos funcionales: public/facturacion-municipal.html, public/css/facturacion-municipal.css, public/js/facturacion-listado.js, public/js/documentos.js y src/facturacion/facturacion.repository.js. Pruebas modificadas: facturacion-emision, facturacion-listado-interfaz y documentos. Documentación: spec/plan/tasks de esta interfaz, spec/tasks de facturación, spec de interfaz documental y MEMORY.md. Sin esquema, dependencias, comandos Git ni commits. No se realizó inspección visual en navegador; se conservan las celdas y fichas móviles existentes.

## Dos regresiones de recuperación de reapertura — 13 de octubre de 2026

- [x] Inspeccionar 409: el endpoint actual devuelve mensaje genérico para estado incompatible o cobros, sin discriminador. Tras cualquier 409 consultar cabecera; confirmar cobros antes de actualizar fila/cerrar formulario/bloquear Confirmar. Conservar mensaje del servidor. Sin cobros, exigir nueva confirmación; GET fallido bloquea POST hasta consultar, sin repetición automática.
- [x] Separar POST aceptado de recuperación por GET. En recuperación usar únicamente motivo de la respuesta, si existe; el contrato actual no lo devuelve y se informa que el motivo registrado no pudo confirmarse. Nunca tomar el texto local como motivo persistido durante recuperación. No cambiar API/persistencia ni lógica financiera.
- [x] Seis regresiones: cobro concurrente de cada factura, 409 sin cobros, fallo del GET posterior, recuperación con motivo del servidor y sin motivo. Verificar que la casilla no rehabilita Confirmar con cobros/estado desconocido y que no se repite POST.
- [x] 70/70 dirigidas en facturacion-listado-interfaz, facturacion-municipal-interfaz y facturacion-cobros. Después suite completa 1299/1299 en 48 archivos, base dedicada de pruebas. Sin cambios de diseño; no se repite comprobación visual.

Archivos: public/js/facturacion-listado.js, test/facturacion-listado-interfaz.test.js, spec/tasks de esta interfaz y MEMORY.md. Sin cambios financieros, API, esquema, dependencias o Git. Historial anterior conservado.

## Reapertura visible de la facturación completa — 12 de octubre de 2026

- [x] Inspeccionar listado/API: una fila agrupa importes de las dos facturas. Añadir única acción Reabrir facturación en Acciones; nunca en cada factura. GET emitidas incorpora tiene_cobros con EXISTS en el mismo SELECT, sin cálculos ni escrituras.
- [x] Confirmación identifica Ayuntamiento/periodo y ambos números, motivo 1–500 caracteres y casilla. Cancelar devuelve foco. Cobros bloquean con explicación accesible; GET previo detecta cobro posterior a carga y deshabilita acción. POST existente revalida estados/cobros/motivo bajo transacción. Bloquear doble envío/navegación y recuperar respuesta incierta por GET sin repetir POST.
- [x] Éxito informa REABIERTA/motivo, retira fila emitida y ofrece enlace con ID a revisión existente. Carga directa no crea cabecera, conserva B/números, usa previsualización y confirmación conjunta existentes. No se modifica código financiero de reapertura/emisión.
- [x] Pruebas de visibilidad, un botón común, bloqueo/explicación, motivo/confirmación, cancelación, GET de cobro reciente, rechazo del servidor, doble envío/recuperación y continuación directa hasta emisión conjunta. Flag de cobros probado en PostgreSQL para ambas facturas. 126/126 dirigidas iniciales en cuatro archivos; suite final 1293/1293 en 48, incluida regresión de CSS móvil/accesibilidad añadida tras revisión visual.
- [x] Navegador con fixture en memoria: 898×900 y 375×812. Región de tabla/región 801/801 y 306/306, sin horizontal de página. Corregir nowrap heredado municipal que invadía importe; columnas 12/26/14/18/30%, acciones completas. Móvil en fichas etiquetadas, formulario 306 px y textarea 272 px, motivo/casilla/botones completos. Reapertura ficticia confirmada, estado/motivo/link visibles y foco en continuación; mismo ID cargado en revisión y previa con números 000P/000C readOnly. No emisión ni escrituras financieras en desarrollo; sin prueba de lector de pantalla.

Archivos: public/facturacion-municipal.html, public/css/facturacion-municipal.css, public/js/facturacion-listado.js y API, facturacion-municipal.js y API; src/facturacion/facturacion.repository.js. Pruebas: facturacion-listado-interfaz, facturacion-municipal-interfaz, facturacion-emision, facturacion-cobros. Documentos: spec/plan/tasks de esta interfaz, spec/tasks financiero y MEMORY. Capturas reapertura-898.png, reapertura-formulario-375.png, reapertura-resultado-375.png y reapertura-previa-375.png fuera del repositorio. Fixture/servidor/pestaña retirados, viewport restaurado. Sin esquema, dependencias ni Git. Apartados anteriores conservados como histórico.

## Pendientes y continuación de facturación — 12 de octubre de 2026

- [x] Resolver primero la contradicción documental por autorización expresa: número oficial/envío a Contabilidad no bloquean reapertura; mantener ausencia de cobros, motivo obligatorio, cabecera, B, números y par original. No añadir acción visual de reapertura ni cambiar código financiero.
- [x] Consultar GET /facturaciones/pendientes calculado en SQL, sin catálogos globales; periodos dependientes, etiquetas REVISION/REABIERTA, pareja válida obligatoria, vacío/error/reintento y refresco al volver. POST existente revalida bajo bloqueo y reutiliza cabecera. Retirar acceso de tasas únicamente en emisión; configuración sigue en Inicio.
- [x] Nuevas pruebas de parejas aptas/vacías/emitidas, cero con aptos, cobros, continuación de cabecera, preparación sin facturas, rutas inválidas, selección municipal dependiente y retirada tras emisión. Pruebas existentes de par original, reemisión, B, cobros independientes y concurrencia conservadas. 144/144 dirigidas en cinco archivos; suite final 1285/1285 en 48. Primera suite falló únicamente por expectativa antigua del enlace, adaptada para comprobar retirada y conservación en Inicio/recursos.
- [x] Navegador con fixture en memoria a 898×600 (ancho de captura) y 375×812: campos de 400/321 px, texto 16 px, dos columnas/apilado, sin horizontal de página. Revisión existente etiquetada y botón habilitado al elegir pareja; cambiar a otro municipio limpia periodo y ofrece su reabierta, botón bloqueado hasta seleccionarla. Botón de configuración ausente. No escrituras financieras de desarrollo ni prueba de lector de pantalla.

Archivos de producto: public/facturacion-emision.html; public/js/facturacion-municipal.js y su API; repository/service/controller/routes de src/facturacion. Pruebas: facturacion-municipal-interfaz, facturacion-participaciones y configuracion-facturacion-interfaz. Documentos: spec/plan/tasks de esta interfaz, spec/tasks financiero, spec de configuración y MEMORY. Capturas pendientes-898.png/pendientes-375.png fuera del repositorio. Fixture/servidor/pestaña retirados y viewport restaurado; sin dependencias, esquema ni Git. Registros anteriores se conservan como histórico.

- [x] Revisar documentación, pantallas y contratos; especificar flujo.
- [x] Pantalla/API/CSS y acceso desde Inicio. Tres pasos excluyentes, formulario B dedicado, importes solo desde previsualización y números oficiales textuales. Reemisión de una revisión ya reabierta conserva B/números; sin acción de reapertura nueva.
- [x] 15 pruebas nuevas: flujo completo, selección/B/números/confirmación, sin aptos y aptos cero, errores de catálogo/cálculo/B/previa/emisión, recuperación de respuestas inciertas, respuesta incompleta, bloqueos, navegación, reabierta, contratos/recursos y texto seguro.
- [x] Dirigidas finales: 89/89 en cuatro archivos; suite completa: 1092/1092 en 40 archivos. Primer intento sin permiso de conexiones HTTP devolvió EACCES; repetición autorizada correcta. Sintaxis correcta de cliente/pantalla/pruebas.
- [x] Navegador a 1280 y 375 px con API ficticia en memoria: selección, tabla, corrección B y previsualización/números. Sin desplazamiento horizontal de página; tabla con scroll propio. Tras observar anchuras heredadas del maestro municipal, se definieron columnas específicas con prioridad a denominación y SOE/CIF sin partir. Confirmación visible y deshabilitada hasta revisión explícita. No se emitieron facturas en desarrollo. Fixture visual temporal eliminado, viewport restaurado, pestaña/servidor cerrados. Lector de pantalla pendiente.
- [x] Actualizar memoria, guía y estado documental del módulo. Sin backend/esquema/dependencias ni Git.

Una repetición intermedia completa tuvo 39 timeouts en cinco archivos de integración PostgreSQL preexistentes (Ayuntamientos, Farmacias/asignaciones y participaciones), incluidos hooks de limpieza; las 15 pruebas de interfaz pasaron. Tras detener la espera y repetir, suite final 1092/1092 en 40 archivos (14 s). No se modificaron pruebas ni backend para ocultar el fallo. Registrado como incidente intermitente de ejecución concurrente; causa exacta no determinada.

Comprobación final de solo lectura en gestion_facturacion_medicamentos_test: cero facturaciones, facturas, cobros y pagos. No hubo borrado adicional de datos ni cambios en desarrollo.

## Ajuste de terminología (2026-10-11)

- [x] Sustituir B visible por datos de la farmacia en revisión, corrección, confirmación y avisos; encabezados SOE/Denominación/CIF, acción Corregir farmacia y columna ID farmacia para farmacia_id. Mantener campos y contratos internos B. Presentar el mensaje de bloqueo existente con terminología comprensible sin modificar la API.
- [x] Ampliar las comprobaciones de interfaz: etiquetas, encabezados, ID, acción y nombre accesible, título, validación, guardado, error y recuperación; comprobar payload B e importes originales en el flujo existente.
- [x] Pruebas dirigidas: facturacion-municipal-interfaz y static-files, 23/23 correctas. Primer intento bloqueado por aislamiento HTTP local EACCES; repetición autorizada correcta. Sin cambios de esquema/API/importes ni Git.

## Comprobación de la casilla de confirmación (2026-10-11)

- [x] Revisar enlace input → actualizarControles y control nativo dentro de label. Comportamiento existente correcto; sin cambios de pantalla, reglas, importes ni API.
- [x] Añadir dos pruebas de marcado/desmarcado, estado inicial, emisión tras marcar, envío sin marcar, números obligatorios y bloqueo durante envío; comprobar HTML nativo y asociación a etiqueta. DOM simulado para eventos input, sin prueba de interacción en navegador real.
- [x] Ejecutar facturacion-municipal-interfaz: 17/17 correctas. Sin operaciones Git.
# Navegación unificada (2026-10-11)

- [x] Inspeccionar patrón de listado/alta de Entregas, emisión y documentos; explicar necesidad del GET de listado y archivos afectados.
- [x] Entrada única en Inicio a Facturación municipal; listado emitido por periodo descendente/Ayuntamiento alfabético, enlace documental por fila y Nueva facturación al proceso existente en facturacion-emision.html.
- [x] Documentos y emisión vuelven al listado; accesos desde Cobros/emisión y cuatro vistas/impresión conjunta conservados. Sin esquema, cálculos de consulta, mutaciones financieras ni Git.
- [x] Pruebas de orden SQL/estados/importes históricos, snapshots sin mutaciones, enlaces, nueva emisión, recursos, listado vacío/refresco/errores y GET. Actualizar pruebas de accesos de pantallas trasladadas.
- [x] Dirigidas finales 142/142 en 8 archivos; suite completa 1168/1168 en 45 archivos. Primer intento completo detectó una prueba de Cobros que seguía buscando el enlace en la página antigua de emisión: actualizada a facturacion-emision.html y suite repetida correcta. Sintaxis y unicidad de factura por tipo revisadas; documentación y memoria actualizadas.

# Simplificación y filtros del listado (2026-10-11)

- [x] Revisar carga y accesos; explicar ajuste antes de editar. Retirar Actualizar listado y Gestionar comisión e IVA del listado, manteniendo configuración en Inicio.
- [x] Filtros descriptivos por Ayuntamiento y periodo, combinables sobre filas cargadas, preservando orden/importes/enlaces. Sin petición de ID ni cambios API/esquema.
- [x] Carga automática en entrada/retorno desde emisión y pageshow persisted; reintento solo por error. Revisión de pantallas relacionadas sin acción de reapertura, no añadir ninguna; futura anulación/rectificación pendiente de reglas aprobadas.
- [x] Dirigidas: 118/118 en seis archivos, incluidas carga/restauración, filtros, estados de error/vacío, configuración accesible y documentos, más orden SQL/snapshot financiero existente.

