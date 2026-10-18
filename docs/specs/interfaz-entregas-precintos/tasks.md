# Tareas — interfaz de Entregas y precintos

## Resumen interior compartido con detalle — 12 de octubre de 2026

- [x] Comparar HTML/CSS de ambos resúmenes. Aplicar la clase existente .resumen-entrega al resumen de lectura; retirar franja, wrapper .indicadores-lecturas, máximo de 40 rem y overrides de relleno/tamaño. No duplicar estilos. Conservar IDs, aria-live, Reintentar y estado confirmado; aviso de facturación fuera del resumen.
- [x] Adaptar regresión de estructura/estilos compartidos y valores confirmados: 136/136 pruebas aprobadas en entregas-lecturas-interfaz, entregas-interfaz y static-files.
- [x] Revisar ambas vistas con datos ficticios en navegador a 1060×886 y 375×812: margen CSS bilateral 24 px (25 px desde borde exterior de tarjeta), relleno 20 px, separación 12/24 px y borde redondeado idénticos. En escritorio, columnas iguales de 440,2 px en detalle y 426,1 px en lectura; la diferencia corresponde al gutter de documento existente. A 375 px, una columna de 236/221 px respectivamente; texto y confirmación completos, sin horizontal de página. Estado de facturación independiente.

Archivos: public/entregas.html, public/css/entregas.css, test/entregas-lecturas-interfaz.test.js, spec/tasks y MEMORY.md. Capturas resumen-detalle-1060/375.png y resumen-registro-1060/375.png fuera del repositorio. Fixture/servidor/pestaña retirados y viewport restaurado. Sin cambios funcionales, datos ni Git. Bloques siguientes conservan el histórico de diseños sustituidos.

## Cuadrícula de indicadores de lectura — 12 de octubre de 2026

- [x] Inspeccionar .resumen-principal: las dos columnas ocupaban toda la banda y desplazaban el importe hacia la mitad de la tarjeta. Agrupar únicamente los indicadores en una cuadrícula de máximo 40 rem, dos columnas iguales y gap 1 rem. Mantener el margen interior compartido, estado/Reintentar y aria-live; apilar hasta 40 rem sin reducir texto.
- [x] Regresión de estructura/CSS y valores confirmados; 136/136 pruebas aprobadas en entregas-lecturas-interfaz, entregas-interfaz y static-files. Sin cambios de JS, API, datos o lógica.
- [x] Navegador con fixture ficticio en memoria a 1060×886: columnas 312/312 px, separación 16 px, indicadores en la misma línea y guía izquierda x=67,5 compartida con encabezado y tabla. Padding bilateral 20,6 px. A 375×812: indicadores apilados de 287 px, guía común x=44, separación 16 px y padding bilateral 12 px. Valores a 32 px; sin desbordamiento horizontal de página.

Archivos: public/entregas.html, public/css/entregas.css, test/entregas-lecturas-interfaz.test.js, spec/tasks de esta interfaz y MEMORY.md. Capturas indicadores-1060.png e indicadores-375.png fuera del repositorio. Fixture, servidor y pestaña retirados; viewport restaurado. Sin Git. Bloques siguientes conservados como histórico.

## Contenedor común y espacio interior de tabla — 12 de octubre de 2026

- [x] Identificar causas: main de lectura casi completo con límite de 96 rem; page-header sin el espaciado interior de tarjeta; tabla sin margen propio. Al introducir margen, medición detectó además width 100% heredado de .table-scroll, que provocaba sobresalir el borde derecho. Corregido por width auto, no mediante ocultación o compensaciones de captura.
- [x] Body .entregas-page y un único main centrado (máximo 72 rem), variables de margen exterior/interior fluidas con clamp. Retirar reglas de ensanchamiento condicional/márgenes móviles duplicadas. Título alineado al contenido de tarjeta/entrada/región mediante el mismo espacio más su borde de 1 px. Tabla con margen bilateral y gutter interno estable.
- [x] Mantener seis columnas, Acciones completas y thead fijo en la misma tabla. Caption móvil fijo; max-height 24 rem permite caption de dos líneas y fila de 303 px sin ocultar el comienzo. Scroll-padding compartido de 80 px protege foco ante caption de 58 px. Sin cambios de JS/API/persistencia o reglas.
- [x] Finales 135/135 pruebas en tres archivos de interfaz/recursos. Regresiones de clase/contenedor, variables comunes, tabla width auto, cabecera fija y flujos existentes. Sin repetir suite financiera en tarea de presentación.
- [x] Navegador con fixture en memoria a 1060×886 (captura) y 375×812: márgenes exteriores 45,91/45,91 y 31/31 px; guía de h1/encabezado de tarjeta/label de entrada/región x=67,5 y x=44; márgenes interiores de tabla 21,59/21,59 y 13/13. Tabla/región 910/910 y 272/272 px, sin desbordamiento de página. En escritorio, botones quedan a más de 53 px del borde de tarjeta. Tras PageDown: cabecera offset 0, x/ancho de seis th/td coinciden, botones de filas completas sin superposición comprobados con elementFromPoint/contains.
- [x] En móvil, foco de papelera debajo del caption y dentro de región; nueva última lectura completa bajo cabecera, ambos botones completos y foco vuelve a la entrada. Total confirmado 100,02 tras tres lecturas ficticias de 12,34 sobre total inicial 63,00. Datos a 16 px. No hardware/lector de pantalla ni escrituras de desarrollo.

Archivos: public/entregas.html, public/css/entregas.css, test/entregas-lecturas-interfaz.test.js, esta spec/tasks y MEMORY. Capturas lecturas-espaciado-1060.png y lecturas-espaciado-375.png fuera del repositorio. Servidor/fixture/pestaña retirados y viewport restaurado. Sin dependencias, esquema, lógica funcional ni operaciones Git. Bloques siguientes conservados como histórico.


## Márgenes simétricos y cabecera fija — 12 de octubre de 2026

- [x] Inspeccionar HTML/CSS existentes: mantener una sola tabla/colgroup y seis columnas independientes, sin Descripción observada, código 10 rem, Paquete/Posición 4 rem y Acciones 13 rem; sin alterar el controlador ni API.
- [x] Reservar gutter vertical en ambos bordes y centrar main solo en lectura; min-width local de body permite ventana estrecha. Título y tarjeta alineados con márgenes físicos iguales.
- [x] Thead sticky a top 0 con fondo opaco/z-index/sombra dentro de la región, conservando flujo/ancho compartido con tbody; scroll-padding para foco. En móvil, caption sticky y campos etiquetados independientes. La cabecera contextual no cubre la tabla.
- [x] Regresión de CSS/estructura y contratos de interfaz existentes: finales 135/135 en tres archivos (lecturas/interfaz, Entregas/interfaz y recursos). No se repite suite financiera en una tarea sin cambios de lógica.
- [x] Navegador real con 32 lecturas iniciales ficticias, 752×745 y 375×812: márgenes 23/23 px, h1 y tarjeta en x=23; tabla/región 689/689 y 312/312, sin scroll horizontal de tabla/página. Código sigue completo y texto 16 px. Tras PageDown, cabecera de escritorio pasa de offset 21 a 0 respecto a región y permanece visible; diferencias de x/ancho entre seis th/td = 0. Filas completas 4/5/6 y sus botones comprobados por geometría y elementFromPoint (incluido span decorativo de papelera), sin ocultación por cabecera.
- [x] Nueva lectura 33 visible completa bajo thead, total 77,84 y foco en entrada. Nueva lectura 34 en móvil, encabezado fijo visible y fila completa debajo con ambos botones, total 90,18 y foco intacto. Solo fixture en memoria; no hardware/lector de pantalla ni escrituras de desarrollo.

Archivos: public/css/entregas.css, test/entregas-lecturas-interfaz.test.js, esta spec/tasks y MEMORY. HTML/JS/API/persistencia intactos. Capturas lecturas-cabecera-752.png y lecturas-cabecera-375.png fuera del repositorio; servidor, script y pestaña retirados, viewport restaurado. Sin dependencias, esquema, reglas ni operaciones Git. Bloques siguientes conservados como histórico.


## Código acotado y Acciones independiente — 12 de octubre de 2026

- [x] Mantener Paquete, Posición, Código leído y Código nacional en celdas separadas; precio solo y nueva columna Acciones. Descripción sigue únicamente en detalle, sin reintroducirla.
- [x] Colgroup: 4/4/10 rem para Paquete/Posición/Código leído, 13 rem para Acciones; nacional/precio reparten restante. Código nacional alineado a izquierda y precio a derecha. Botones en flex sin envoltura con align-self center local, sin reducir texto.
- [x] En móvil cada campo mantiene su propia celda/etiqueta; espaciado vertical compacto y región de hasta 22 rem para que quepan fila completa y caption, con controles íntegros en una fila.
- [x] Actualizar pruebas de seis columnas/roles/etiquetas y celda precio sin botones, mover acciones al índice 5 sin modificar solicitudes, permisos, foco, orden, totales ni confirmaciones. Regresiones de CSS de código acotado, acciones alineadas y alto móvil. Finales 134/134 en tres archivos (lecturas/interfaz, Entregas/interfaz, recursos estáticos); no se ejecuta de nuevo la suite financiera en esta tarea de presentación.
- [x] Navegador con API ficticia: 752×745, tabla/región 704/704 px y columnas 64/64/160/104/104/208; 375×812, tabla/región 327/327, texto 16 px, fila 303 px dentro de región 352. Botones completos en una fila y con mismo centro vertical; confirmaciones de precio/borrado y cancelación por ID intactas. Sin desbordamiento horizontal de tabla/página. Sin lector físico/lector de pantalla.

Archivos: public/entregas.html, public/css/entregas.css, public/js/entregas-lecturas.js, test/entregas-lecturas-interfaz.test.js, esta spec/tasks y MEMORY. Capturas lecturas-acciones-752.png y lecturas-acciones-375.png fuera del repositorio; pestaña/servidor/script retirados y viewport restaurado. Sin backend, contratos, esquema, datos de desarrollo ni Git. El bloque siguiente conserva como histórico la presentación previa de cinco columnas.


## Ancho útil y tabla sin scroll horizontal — 12 de octubre de 2026

- [x] Inspeccionar HTML/CSS: mínimo común 74 rem y móvil 42 rem, porcentajes ajenos y columna de descripción causaban scroll/controles partidos. Sustituir exclusivamente en la tabla de lectura.
- [x] Ampliar contenedor al registrar, márgenes 1/0,75 rem, cinco columnas con Paquete/Posición compactas, código original flexible y espacio fijo suficiente para precio/acciones. Mantener fuente de datos 16 px, Corregir precio en una línea y papelera 40 px.
- [x] Hasta 44 rem, filas como bloques etiquetados con roles explícitos y cabeceras conservadas accesibles; sin ocultar horizontal ni reducir fuente. Descripciones de sesión trasladadas al detalle plegable, sin datos de catálogo nuevos ni cambios de API.
- [x] Adaptar índices/expectativas y añadir dos regresiones de cinco celdas/etiquetas/roles/controles y conservación de descripción en detalles tras lectura/borrado. Pruebas dirigidas 134/134 en tres archivos; suite completa 1279/1279 en 48 con base dedicada verificada. Primer pase detectó colgroup colocado en tabla de paquetes por reemplazo demasiado amplio; corregido en HTML y repetidas pruebas, sin cambiar reglas/expectativas para ocultarlo.
- [x] Navegador con API ficticia en memoria: 752×745 y 375×812. A 752 tabla/region 704/704 px, columnas 72/72/224/112/224; a 375 tabla/region 327/327 px. Sin desbordamiento horizontal de tabla o página, botones completos (Corregir 135 px, papelera 40 px), texto 16 px. Corregir 3,50→4,00 actualiza 10,50→11,00; borrar esa fila deja 7,00; nueva lectura 12,34 deja 19,34, última visible/resaltada y foco en lector. Descripción queda en detalle. Sin lector físico/lector de pantalla.

Archivos: public/entregas.html, public/css/entregas.css, public/js/entregas-lecturas.js, test/entregas-lecturas-interfaz.test.js, esta spec/tasks y MEMORY. Capturas lecturas-sin-scroll-752.png y lecturas-sin-scroll-375.png fuera del repositorio. Sin backend, esquema, dependencias, datos de desarrollo ni operaciones Git. Servidor, script y pestaña temporales retirados; viewport restaurado. Los bloques anteriores se conservan como histórico de la distribución con scroll horizontal.


## Eliminación visual de aptos — 12 de octubre de 2026

- [x] Contrastar guía v26, spec §8/§18 de Entregas, interfaz/plan, AGENTS y memoria con DELETE/servicio/repositorio y protección técnica existente.
- [x] Papelera de 40 px junto a Corregir precio en la misma celda, seis columnas intactas; acciones se envuelven cuando falta espacio sin aumentar mínimos 74/42 rem. Nombre accesible y title por lectura; icono aria-hidden. Descripción envuelve sin solapar precio; cabecera estable cuando hay acciones para no taparlas ni mover el objetivo durante clic/foco.
- [x] Confirmación propia con código nacional, paquete, posición, precio y contexto; cancelación sin escritura, doble envío/navegación/lecturas/precio bloqueados. Acción exclusiva de aptos.
- [x] DELETE existente y 204 sin JSON; mensaje financiero comprensible en servidor. Refresco de tabla/resumen/estado y conservación de entrada/contexto/scroll/foco. Incertidumbre exige consulta; no se repite automáticamente. Fallo después de 204 conserva resultado y ofrece consulta, con totales no confirmados en lugar del anterior.
- [x] API financiera real: sin preparación/REVISION permiten borrado; EMITIDA rechaza, reapertura sin cobros permite, cualquier cobro de PRECINTOS o COMISION bloquea aun con REABIERTA incoherente. IDs restantes y otros paquetes/precios conservados; documentos originales hasta reemisión.

Pruebas: dirigidas 194/194 en cinco archivos; suite completa final 1277/1277 en 48; tras CSS final 132/132 en tres archivos. 17 casos añadidos: 12 de interfaz/transporte y 5 de estados financieros. Tests existentes de consultas cubren posiciones inicial/intermedia/final, paquete vacío/MAX+1, retirada de claves, pertenencia/validación, rollback y concurrencia real con guardado/borrados/cierre. Base dedicada local verificada y fixtures propios limpiados. El primer intento dentro del aislamiento falló por PostgreSQL EACCES/temporales Vitest; ejecuciones autorizadas correctas. Sintaxis JS correcta.

Navegador real con fixture en memoria: 752 px (captura) y 375 px (estrecho), papelera accesible por Tab y confirmación completa sin desbordamiento de página. Tabla conserva mínimos existentes (1184/672 px); botones juntos en escritorio, envueltos en móvil. Eliminar lectura ficticia de 3,50 reduce aptos 5→4 y total 10,50→7,00; posiciones del paquete 1 renumeradas y paquete 2 intacto. No lector físico/lector de pantalla. Capturas eliminar-precinto-752.png y eliminar-precinto-375.png fuera del repositorio; servidor/fixture/pestaña retirados.

Archivos de esta tarea: public/entregas.html, public/css/entregas.css, public/js/entregas-lecturas.js, public/js/entregas-api.js; src/entregas/lectura.service.js (mensaje de rechazo); test/entregas-lecturas-interfaz.test.js y test/entregas-precios.test.js; guía v26, spec de Entregas e interfaz, plan/tasks de interfaz, tasks de Entregas y MEMORY. No esquema, dependencias, datos de desarrollo ni operaciones Git.


## Corrección individual vigente — 12 de octubre de 2026

- [x] Habilitar registro/corrección desde el permiso financiero real, también sin cabecera TD; bloquear durante consulta fallida, edición, envío e incertidumbre.
- [x] Formulario por ID/paquete/posición; confirmación de un solo precinto, referencia inmutable y recuperación por ID ante respuesta incierta.
- [x] Desplazar el contenedor vertical y horizontalmente hasta la nueva última fila y su precio, sin cambiar orden; destacar fila y mantener foco del lector. La cabecera deja de ser fija cuando taparía la última fila o el formulario.
- [x] Mostrar inmediatamente el total confirmado por servidor y conservarlo ante fallo de refresco posterior.
- [x] Suite completa 1260/1260 en 48 archivos; últimas dirigidas tras CSS 120/120 en 3. Navegador con 32 lecturas ficticias: última fila y precio visibles, corrección individual 0,10 frente a anterior 12,34, total 382,64 €. Captura `precinto-individual.png` fuera del repositorio; fixture/pestaña retirados. No se probó lector físico ni lector de pantalla.

Inventario completo de esta adaptación en `../entregas-precintos/tasks.md`. Los bloques siguientes son historial bajo la regla anterior: sus requisitos de agrupación/preparación ya no están vigentes.

## Histórico: diagnóstico de botones deshabilitados — 12 de octubre de 2026

- [x] Consultar desarrollo solo mediante SELECT y GET, sin corregir precios ni preparar/emitir/reabrir facturaciones: A1/10-2026, entrega 7, Ayuntamiento 2, periodo 1, TD sin cabecera (`facturacion_id`, estado y participación NULL), sin cobros y permiso false. Tres lecturas. No es una facturación REVISION ni EMITIDA. La API real HTTP 200 coincide con la consulta PostgreSQL.
- [x] Comprobar también Q1/09-2026: entrega 2, facturación 1 REVISION, participación existente, sin cobros y permiso true. En navegador real sus dos botones quedan habilitados, sin ejecutar correcciones.
- [x] Revisar condición exacta del cliente: `ocupado || solicitud !== null || seleccionPrecio !== null || !datosVigentes || !contextoPrecios?.permite_correccion`. No hay un bloqueo permanente por defecto; la carga y cualquier consulta no confirmada mantienen fail-closed. `permite_correccion` procede de la API, que consulta Ayuntamiento/periodo/TD, participación y cobros de cualquier factura.
- [x] Hacer visible el motivo antes de las lecturas, distinguir ausencia de cabecera de falta de participación, dar pasos concretos de preparación, mantener error de API visible y añadir consulta de recuperación con bloqueo de doble acción. No se cambian permisos, esquema ni contratos de respuesta.
- [x] Añadir dos regresiones de interfaz (sin preparación → consulta REVISION habilita todas las filas; fallo de API → consulta REABIERTA habilita) y ampliar integración de API (ausencia/cálculo/transición y mensajes). Ejecutadas **143/143 en 4 archivos**: entregas-precios, entregas-lecturas-interfaz, entregas-interfaz y static-files, con la base dedicada local verificada. Navegador real comprobó A1/10-2026 bloqueado con el aviso nuevo y Q1/09-2026 habilitado; sin escrituras en desarrollo. El primer intento HTTP dio reset/refused transitorios; la comprobación posterior devolvió 200 coincidente para las siete entregas. No se detuvo el servidor del usuario.

Cambios: `src/entregas/precio.service.js` (solo motivos), `public/entregas.html`, `public/css/entregas.css`, `public/js/entregas-lecturas.js`, `test/entregas-precios.test.js`, `test/entregas-lecturas-interfaz.test.js`, esta spec/tasks y MEMORY. Diagnóstico temporal retirado y pestaña de comprobación cerrada. Sin operaciones Git.

## Histórico: corrección agrupada de precios — 12 de octubre de 2026

- [x] Analizar tabla actual (precio solo como texto) y separar estado financiero de conteos/listado neutral.
- [x] Implementar formulario accesible, referencia conservada, alcance de grupo y confirmación.
- [x] Consultar estado real y mostrar motivos de bloqueo/reapertura/cobros.
- [x] Conservar entradas ante errores, impedir doble envío y recuperar incertidumbre por consulta.
- [x] Añadir/ejecutar pruebas relevantes y registrar evidencia.

37 pruebas de lecturas/interfaz, incluidas 12 del precio; suite completa 1255/1255 en 48 archivos y dirigidas posteriores al ajuste de foco 117/117 en 3 archivos. Navegador real con fixtures en memoria, sin PostgreSQL: formulario identifica las dos lecturas, referencia 12,34 y aplicado inicial 12,34; confirmar 0,10 actualiza ambas filas y total 0,20, y al abrir de nuevo conserva referencia 12,34. Comprobados mensajes y botones deshabilitados de EMITIDA sin cobros y con un cobro. Ajuste visual: la cabecera deja de ser fija mientras el formulario está abierto y el foco va a su título, para no tapar alcance/referencia. No se probó lector físico ni lector de pantalla. Evidencia PNG fuera del repositorio en el directorio de visualizaciones de la sesión; pestañas/servidores y scripts de fixture retirados.

## Filtros del listado — 2026-10-09

- [x] Selector de periodo concreto sin «Todos los periodos»; mantiene todos los periodos de la API, incluidos los vacíos. Inicial: periodo más reciente con entregas; si no hay entregas, periodo más reciente disponible.
- [x] Filtro de Ayuntamiento combinable, derivado de IDs/nombres actuales de las filas existentes. Resultado vacío para una combinación se anuncia como estado normal y no expone reintento.
- [x] Limitación documentada: el modelo actual no vincula de forma fiable emisión/participación facturada con entrega. Se elige provisionalmente periodo reciente con entregas, sin clasificarlo como pendiente ni cambiar esquema/API.
- [x] Pruebas de filtros combinados, selección inicial pese a periodo más reciente vacío, periodos consultables, vacío municipal y error/reintento. 63 pruebas dirigidas aprobadas; sin integración de base de datos.

## Selector independiente de farmacia en el alta — 2026-10-09

- [x] «Seleccionar farmacia» abre una vista de búsqueda dentro de Entregas; deja periodo/declarados fuera de la vista y preservados. Elegir por clic o teclado regresa al formulario sin confirmación adicional; cancelar mantiene selección anterior y datos.
- [x] Formulario muestra SOE, nombre y Ayuntamiento o «Sin Ayuntamiento»; cambiar vuelve a abrir el selector. La búsqueda y su error/reintento se presentan en la vista independiente.
- [x] No se crea entrega ni periodo hasta pulsar «Crear entrega»; se conserva la validación actual para farmacia sin Ayuntamiento.
- [x] Pruebas de interfaz dirigidas: 64/64 aprobadas, incluidos selección, cambio, cancelación, conservación de valores, búsqueda fallida/reintento, teclado y ratón. No se ejecutaron pruebas de integración ni hubo escrituras de base de datos.

## Presentación del Ayuntamiento y márgenes del selector — 2026-10-09

- [x] Ayuntamiento asociado aparece solo junto al nombre/SOE de farmacia; se elimina el recuadro azul redundante. Sin asignación, queda un único aviso en la zona de farmacia.
- [x] Búsqueda, etiqueta, ayuda, resultados y reintento se alinean con margen interior de 1,5 rem; elementos limitados al ancho disponible para evitar desbordamientos estrechos.
- [x] Regresión de presentación y reglas CSS; 65 pruebas dirigidas aprobadas. No se hicieron escrituras de base de datos ni acciones Git.

## Indicador de retorno al listado — 2026-10-09

- [x] Se eliminó el resaltado verde de «fila consultada» del listado. La confirmación de guardado sigue siendo el mensaje específico de cada operación.
- [x] Regresión abre una entrega, vuelve al listado y cambia filtro de Ayuntamiento y periodo; comprueba ausencia de resaltado en retorno, filtrado inmediato y recarga automática. Suite de interfaz dirigida: 66/66 aprobadas.

## Navegación del listado y pantallas secundarias — 2026-10-09

- [x] Cabecera Entregas alineada con Farmacias; «Volver al inicio» en el encabezado y visible solo con «Entregas registradas». «Volver al listado» y «Volver al detalle» se mantienen en sus vistas.
- [x] Prueba separa marcado de cabecera/listado/detalle/registro y comprueba cambios listado → detalle → registro → detalle → listado. El menú principal conserva acceso a Entregas.

## Registro funcional de precintos — 2026-10-09

- [x] «Actualizar datos» retirado del uso normal. Tras abrir y cada operación confirmada se consultan resumen/listado/incidencias; «Reintentar» aparece solo si falla una carga y bloquea nuevas lecturas hasta confirmar datos actuales.
- [x] Estados vacíos diferenciados usando `admitidos`, `incidencias` y `total_registrado` del resumen. Se valida que sean enteros no negativos y consistentes; si faltan o no cuadran, no se infiere el estado.
- [x] Enter, lector que envía Enter y botón de ratón conservan el envío nativo común; estados de evaluación, decisión, guardado confirmado y error visibles, código conservado ante fallo, clave consultada ante incertidumbre/5xx y doble envío bloqueado.
- [x] Se conserva inicio manual de paquete únicamente para la decisión expresa de comenzar otro mientras el actual sigue incompleto, conforme a la regla existente. El servidor conserva asignación de paquete/posición y apertura automática al completar 15 aptos.
- [x] Tabla identifica claramente el valor leído/escaneado original y mantiene paquete, posición, código nacional, incidencias y controles.
- [x] 22 pruebas DOM/API simulada aprobadas; sintaxis JS correcta. Integración de precintos **37/37 aprobada** con `DB_NAME` fijado y `current_database()` verificado como `gestion_facturacion_medicamentos_test` antes de fixtures, que se limpiaron según la prueba. Primer intento dentro del sandbox recibió `EACCES` sin conectar ni escribir; el segundo, con acceso local aprobado, terminó correctamente. Ninguna prueba apuntó a desarrollo.

## Simplificación del listado y eliminación bloqueada — 2026-10-09

Verificación final: **904 pruebas/32 archivos aprobadas** en base de pruebas local verificada y con limpieza propia. Sintaxis de los tres JS de este bloque y `git diff --check` correctos (avisos LF/CRLF únicamente); módulo nuevo de listado revisado también individualmente. Revisión del diff documental realizada. Pestaña y servidor ficticios cerrados; helper retirado.

- [x] Un único título municipal visible, tabla etiquetada por ese título, recuento singular/plural/cero y sin «Actualizar listado». Error anunciado y «Reintentar» junto a él; carga automática conservada.
- [x] Región de tabla con Tab y desplazamiento horizontal en ventana estrecha; agrupación Ayuntamiento/SOE, totales servidor y ceros conservados.
- [x] Dos regresiones añadidas de presentación accesible y vacío/filtro automático; prueba existente de error ajustada para pulsar Reintentar realmente. Continuación HTTP/PostgreSQL adaptada a la tabla sin caption y sin escrituras de apertura.
- [x] 114 pruebas dirigidas/4 archivos aprobadas, incluida integración en test local verificado antes de fixtures ficticios y limpieza propia. Estados de guardado, continuación sin POST/PUT ni sobrescritura y lectura con incertidumbre cubiertos por regresiones existentes.
- [x] Navegador real con API ficticia en memoria sin base: listado de dos filas, ceros, un título, Enter en Continuar/Volver y valores guardados; filtro con error, Enter en Reintentar, vacío y recuperación. A 375×812: ancho de página 360, sin desbordamiento global; Tab alcanza región de tabla. Revisión visual también en escritorio. Servidor temporal detenido y helper retirado.
- [x] Revisar esquema y bloqueo servidor: sin relación participación facturada/entrega, sin DELETE de entrega y con referencias RESTRICT de precintos, incidencias y operaciones incluidas retiradas. No habilitar borrado inseguro.
- [ ] Acordar relación/criterio financiero fiable, política de claves de lectura y contrato de eliminación; después confirmación/cancelación, transacción y rechazo concurrente de facturadas/vinculadas. Ninguna eliminación de entrega realizada ni probada como implementada.
- [ ] Verificación con lector de pantalla y dispositivos reales; la revisión de teclado/navegador no la sustituye.

Archivos de este bloque: HTML, CSS, entregas-listado.js, pruebas de interfaz e integración de continuación, spec/plan/tasks de interfaz y MEMORY.md. Cambios previos preservados. Sin backend/esquema/dependencias/Git de modificación ni escrituras en desarrollo. El filtro conserva periodos vacíos por contrato existente.

## Listado neutral y alta independiente — implementado 2026-10-09

Verificación final: **902 pruebas/32 archivos aprobadas**, incluida la integración nueva de continuación desde listado, con base dedicada local verificada y limpieza propia. `node --check` de diez JS y `git diff --check` correctos (solo avisos de conversión LF/CRLF). Archivo nuevo del listado revisado individualmente; los comandos Git usados son únicamente de consulta, sin modificación. Revisión manual visual de este bloque pendiente.

- [x] Revisión de código/modelo: facturacion municipal y factura presentes en esquema; emisión y participación vinculada a entrega no implementadas. Clasificación no fiable, por lo que se utiliza «Entregas registradas» sin afirmar pendientes/facturadas.
- [x] GET `/entregas/registradas` de solo lectura, filtro opcional `periodo_id`, validación estricta, consulta parametrizada única y totales exactos de precintos; incluye vacías/solo incidencias como cero. Sin schema/migraciones ni bancos/estados financieros.
- [x] Presentación agrupada por Ayuntamiento, orden municipal/SOE textual; periodos más recientes primero en filtro y desempate de filas por fecha/ID. (La selección histórica «Todos los periodos» fue sustituida en la tarea de filtros anterior; hoy se mantiene un periodo concreto.) Filtro conservado al volver; se retiró el resaltado verde porque podía confundirse con un guardado.
- [x] Abrir/continuar mediante GET y resumen, con snapshots/declarados guardados, sin iniciales ni POST/PUT. Alta independiente utiliza POST existente y PUT inicial solo tras 201; 200 muestra existente y comunica que no creó ni sobrescribió.
- [x] Mensajes Guardando…/Guardado confirmado/error, conservación de entradas, distinción entre POST terminado y PUT pendiente/fallido, refresco separado y consulta ante resultado incierto/5xx. Precintos mantienen decisiones BAJA, incidencias, claves/paquetes, fórmulas/decimales y bloqueo vigente.
- [x] 17 regresiones añadidas: nueve API de listado, siete de interfaz/transporte y una de frontend/HTTP/PostgreSQL reales para continuar desde fila. 112 dirigidas/4 archivos aprobadas. Integración exclusivamente en base local dedicada verificada con current_database() antes de fixtures ficticios y limpieza propia; sin escrituras en desarrollo.
- [x] Suite completa antes de la última integración: 901/32 aprobadas; verificación final indicada abajo. Primer dirigido detectó conteo de GET iniciales en aserciones del autocompletado: se comprueban ambos GET del listado y se separan de la medición posterior de la búsqueda; repetición aprobada, sin desactivar casos.
- [ ] Separación financiera y buscador de facturadas: requieren emisión/participación fiable y decisiones documentadas, no deducir por cobro, estado inventado o fila municipal.
- [ ] Revisión visual manual de esta presentación nueva y con lector de pantalla. No se reutiliza la evidencia visual del registro de precintos como prueba del listado nuevo.

Archivos de interfaz: HTML/CSS, entregas.js, entregas-api.js y nuevo entregas-listado.js. Backend: rutas, controlador, repositorio y validación de Entregas. Pruebas: entregas-consultas, entregas-interfaz y entregas-busqueda-integracion. Especificación backend e interfaz, plan y memoria actualizados. Cambios previos de lecturas preservados; sin dependencias, esquema, cambios de reglas ni acciones Git de modificación.

## Diseño de presentación separada — 2026-10-09

- [x] Revisar HTML, módulos de interfaz/transporte, rutas/controlador/validaciones/repositorio de Entregas, esquema y especificación financiera actuales. La pantalla vigente combina creación/recuperación; no hay listado de entregas ni búsqueda de facturadas en la API.
- [x] Documentar tres accesos objetivo: Pendientes agrupadas por Ayuntamiento/SOE, buscador separado de Facturadas y Crear entrega nueva independiente. Clasificaciones financieras y flujos de consulta diferenciados del guardado.
- [x] Separar funcionalidades actuales reutilizables, consultas faltantes y dependencias de emisión/participación/reapertura. Registrar decisiones abiertas sin añadir estados ni campos.
- [x] Documentar mensajes por operación, 201/200, alta y declarados en dos pasos, resultado incierto y guardado confirmado con refresco fallido.
- [x] Revisar cambios documentales y espacios, conservando evidencias y tareas previas. Solo documentación; sin suite, código, esquema, datos ni acciones Git.
- [ ] Confirmar criterio provisional de pendientes y presentación definitiva al existir participación facturada; tratamiento de procesos sin emisión/reaperturas y entregas sin aptos.
- [ ] Acordar periodos incluidos, orden temporal/desempates y comparación del SOE; filtros y alcance del buscador histórico.
- [ ] Implementar primer bloque: alta separada de consulta/continuación concreta, contratos actuales y mensajes precisos; 200 ofrece continuar sin alta ni PUT inicial.
- [ ] Especificar/aprobar contrato mínimo de listado operativo; implementar pendientes una vez confirmado el criterio. No hay endpoint disponible ahora.
- [ ] Especificar/aprobar búsqueda histórica e implementar Facturadas tras emisión y relación participación/entrega; preservar snapshots A/B/C.
- [ ] Regresiones futuras: abrir/continuar solo consulta, alta 201, existente 200 sin sobrescritura, POST confirmado/PUT fallido, entradas sin guardar, consulta incierta sin reintento, refresco fallido tras guardado, agrupación/orden, vacías/incidencias, origen/filtros conservados y conflicto por cierre concurrente. Para búsqueda histórica: identidad actual distinta de snapshots y permisos de reapertura/cobro.

La revisión documental no marca esta evolución como implementada. La evidencia de 885 pruebas corresponde al registro de precintos del bloque anterior; no verifica listados ni buscador aún inexistentes. Detalle del diseño y decisiones en spec.md; secuencia en plan.md.

## Registro de precintos — 2026-10-09

- [x] Acción desde detalle, vista exclusiva con periodo/SOE/farmacia/Ayuntamiento y retorno a la misma entrega con resumen actualizado.
- [x] Resumen principal fijo de aptos/importe exacto servidor, lista aptos ordenada bajo resumen y controles secundarios plegables; precio histórico y descripción observada solo cuando disponible.
- [x] Entrada manual/teclado con Enter, evaluación existente, aptos automáticos, incidencias confirmables y ambas decisiones BAJA.
- [x] Clave UUID por operación; doble envío/navegación bloqueados, código conservado ante error, consulta obligada de resultado incierto y repetición explícita con igual clave/contenido tras 404; 410 sin recreación automática.
- [x] Nuevo paquete explícito sin escritura ni paquete vacío; incidencia no consume intención; paquete/posición del servidor y actualización tras cada guardado.
- [x] 18 regresiones añadidas: 17 de lecturas/transporte y una de navegación integrada con el detalle. API existente reutilizada sin cambios.
- [x] 165 pruebas dirigidas/6 archivos y suite completa 885/32 aprobadas. Pruebas de integración en `gestion_facturacion_medicamentos_test` local, con guardas de destino/current_database() antes de fixtures ficticios propios y limpieza. Primer intento aislado falló por sockets PostgreSQL/Supertest y temporales Vitest; ejecución autorizada fuera del aislamiento aprobada.
- [x] Sintaxis y revisión de parches/espacios de archivos afectados, sin ejecutar acciones Git.
- [x] Navegador real 1280×1000 y 375×900, con API temporal ficticia en memoria sin PostgreSQL: abrir entrega existente → registrar → Enter → aptos 1 a 2 e importe 12,34 a 24,68 → fila/posición 2 → volver al mismo detalle actualizado. En estrecho scrollWidth 360 para viewport 375; scroll horizontal limitado a tabla. Contexto/resumen visibles y foco en código. No equivale a integración manual con PostgreSQL. Servidor temporal detenido y helper retirado.
- [ ] Comprobación con lector físico y lector de pantalla, BAJA/incidencias/errores de red visuales y listas largas en dispositivos reales. Casos funcionales cubiertos por pruebas DOM/API simuladas y backend real por las pruebas existentes.

## Usabilidad de Registrar precintos — 2026-10-09

### Alineación de la tarjeta de registro

- [x] Margen horizontal común de 1,5 rem en escritorio / 1 rem en móvil para cabecera, resumen, estado vacío, campo, ayuda, acciones, mensajes y detalles; retirado doble sangrado de controles desplegados. Tabla de ancho completo y relleno de celdas conservados.
- [x] 91/91 pruebas de interfaz en `entregas-lecturas-interfaz` y `entregas-interfaz`, incluida regresión de márgenes. Primer intento bloqueado por archivos temporales de Vitest en aislamiento; repetición fuera del aislamiento aprobada.
- [x] Navegador real a 1280 px y 375 px con archivos actuales y API ficticia en memoria, sin DB: estado vacío y una lectura, detalles cerrados/abiertos. Cabecera/campo/resumen/detalles alineados (x=49,5 / x=27); ancho documental igual al disponible (1265 / 360 px, descontando barra vertical). Botones dentro del contenido y scroll horizontal exclusivo de tabla. Servidor temporal detenido.
- [x] Solo estilos de espaciado/alineación, pruebas y documentación; sin cambios de flujo, reglas, API, esquema o acciones Git.

- [x] Foco inicial en el código cuando la vista está lista y retorno del foco tras confirmar; no se fuerza el foco cuando se requiere una decisión.
- [x] Ayuda breve y misma acción por Enter/lector/botón; estado «Guardando…» y confirmación breve sin repetir el recuento apto bajo el resumen.
- [x] Acción de nuevo paquete con menor peso visual y explicación adyacente. Ocupación del paquete más reciente se presenta desde `paquetes[].precintos` del resumen; si está completo se indica la asignación automática posterior, sin inventar paquete vacío/current field.
- [x] «Ver más detalles: incidencias y controles» cerrado inicialmente, contenido intacto; márgenes verticales compactos y tipografía/scroll ajustados para escritorio y móvil.
- [x] Pruebas dirigidas de interfaz: 24/24 aprobadas; foco, decisión pendiente, estados de guardado, resumen sin recuento duplicado, sección cerrada, ocupación server-side y reglas de legibilidad/scroll móvil cubiertos. Sin integración ni escritura de base de datos.

Se conservan fórmulas financieras, snapshots y bloqueo por facturación. Sin backend/esquema/dependencias/Git ni escrituras en desarrollo. Sin eliminación visual ni listados financieros. Las claves inciertas no persisten tras una recarga forzada; antes de abandonar se muestra el aviso nativo.

## Autocompletado de farmacia

- [x] Campo único, resultados filtrados SOE prefijo/nombre contiene con debounce 250 ms y deduplicación ID.
- [x] Reutilizar validación/consulta existentes mediante ruta global GET `/farmacias/busqueda`, sin cuentas bancarias ni Ayuntamiento previo.
- [x] Clic, flechas/Enter, SOE exacto único; Escape/Tab sin seleccionar, Enter sin apertura.
- [x] Cambio de farmacia conserva periodo/declarados; edición invalida y respuestas antiguas se descartan.
- [x] Aviso municipal y protecciones de apertura conservados; pruebas anteriores adaptadas al nuevo flujo.
- [x] Verificación completa, visual y diff finales.

Primer pase dirigido: 117 pruebas/2 archivos aprobados en test local verificado. Las pruebas antiguas de carga de catálogo se adaptaron a búsqueda/reintento; no se descargan todas las farmacias. Regresiones de declarados, snapshots, mes/año, bloqueo municipal y doble envío conservadas. Resultado final se registra al terminar.

Suite completa: 826 pruebas/28 archivos aprobadas. Búsqueda nueva probada en PostgreSQL dedicado local verificado antes de escrituras y limpieza propia: SOE alfanumérico con ceros, nombre, parámetros inválidos y proyección sin bancos. Visual real de navegador con API ficticia en memoria a 1280×1050 y 375×900: nombre y dos coincidencias, flechas/Enter, SOE exacto alfanumérico, clic, Cambiar, Ayuntamiento y falta de asociación; sin desbordamiento (scrollWidth 360 para ancho 375). Captura fuera del repositorio. Lector de pantalla pendiente. En servidor del usuario localhost:3000 la ruta nueva requiere reiniciar backend (versión anterior respondió identificador inválido a /farmacias/busqueda); solo consultas, ninguna escritura en desarrollo. Servidor ficticio cerrado y fuente retirada.

Suite final repetida tras revisión de teclado y scroll de opción activa: 826/28 aprobadas. node --check de seis JS modificados y diff incluidos nuevos sin errores (solo LF/CRLF). Sin esquema ni dependencias. Selección final conservada para volver desde detalle; GET por fecha y escritura transaccional sin cambios en este bloque.

## Investigación del botón «Abrir entrega»

### Mejora de visibilidad del Ayuntamiento

- [x] Contexto municipal destacado junto a farmacia y aviso persistente antes de Abrir.
- [x] Actualización al cambiar/limpiar farmacia sin datos residuales.
- [x] Comprobar ambos casos en escritorio y móvil con API real sin escrituras.

41 pruebas dirigidas aprobadas. Regresión nueva comprueba texto literal, posición antes del botón, persistencia con año inválido y limpieza al cambiar/retirar selección. Revisión visual real en localhost:3000 a 1280×1050 y 375×900 con las dos farmacias disponibles: sin Ayuntamiento bloquea y destaca aviso; asociada muestra nombre municipal y habilita botón. Estilo informative-notice existente, borde y énfasis además del color. Capturas escritorio/móvil fuera del repositorio. No se envió POST ni se escribió en desarrollo; lector de pantalla pendiente.

Suite completa final: 814 pruebas/28 archivos aprobados en la base dedicada local verificada con fixtures propios y cleanup. Sintaxis de ambos JS y diff incluidos archivos nuevos correctos (avisos LF/CRLF únicamente).

- [x] Reproducir el síntoma con API real local, sin escrituras.
- [x] Corregir cursor engañoso y explicar el requisito junto al botón.
- [x] Regresión de farmacia sin Ayuntamiento, recuperación de errores y doble envío.
- [x] Suite final, sintaxis y diff de esta corrección.

Evidencia: `http://localhost:3000/entregas.html` cargó dos farmacias; selección vacía y primera farmacia sin Ayuntamiento daban disabled=true/cursor=wait, sin petición de apertura. Segunda farmacia con Ayuntamiento: disabled=false/cursor=pointer. Causa reproducida: CSS compartido `.button:disabled { cursor: wait; }`, independiente de actividad. Sin error JavaScript porque era un bloqueo normal por requisito. No se encontró condición antigua de periodo existente ni periodo_id en la habilitación; eventos actualizan el botón. Código de apertura libera ocupado en finally y conserva los valores ante errores. GET de catálogo terminó; ningún POST manual a la base de desarrollo.

Corrección mínima en HTML/JS/CSS de Entregas: motivo accesible junto al botón; cursor not-allowed cuando falta requisito y wait solo con aria-busy por carga/operación real. Confirmado con API real tras recargar: primera farmacia false busy/not-allowed; segunda false busy/pointer/habilitada. Botón comprobado visible mediante teclado y elementFromPoint: sin superposición. Apertura con API real comprobada por las pruebas existentes en la base dedicada, no mediante escritura manual en desarrollo. Pruebas dirigidas finales: 40 aprobadas, incluidas fechas válidas sin consultar periodos, falta de Ayuntamiento, carga fallida/reintento, apertura fallida/reintento, doble envío y respuestas antiguas.

Suite final: 813 pruebas/28 archivos aprobados en base dedicada local verificada, con fixtures propios y limpieza. node --check de ambos JS modificados y git diff --check incluidos archivos nuevos sin errores; avisos LF/CRLF habituales. Captura de la selección válida con API real guardada fuera del repositorio; pestaña temporal cerrada. No hubo revisión visual de POST real porque el servidor del usuario puede usar desarrollo; flujo cubierto por Supertest en test. Sin esquema/dependencias, escaneo ni acciones Git de modificación. Comprobación con lector de pantalla pendiente.

- [x] Consulta de periodos existentes.
- [x] Acceso desde Inicio, selección y detalle.
- [x] Declarados, resumen y protección frente a errores.
- [x] Pruebas dirigidas, suite completa, sintaxis y diff.
- [x] Revisión visual escritorio y estrecho.
- [ ] Comprobación con lector de pantalla.

La entrada de códigos, lector, lecturas y eliminación de lecturas quedan fuera de este bloque.

## Evidencias — 8 de octubre de 2026

30 pruebas de interfaz/transporte y 39 API (dos nuevas para periodos): 69 dirigidas aprobadas. Primer intento PostgreSQL bloqueado por sandbox EACCES, repetido autorizado con guardas de DB_NAME, host local y current_database() antes de fixtures propios. Primera suite completa: 778/28 aprobadas. Suite final tras corrección de foco y aislamiento del test de periodos: 778 pruebas/28 archivos aprobadas. El test compara su propio periodo, evitando contar globalmente fixtures de suites concurrentes. Siete archivos JavaScript comprobados con node --check; git diff --check y comprobación individual de los ocho archivos nuevos sin errores (solo avisos LF/CRLF). Servidor temporal cerrado y archivo eliminado. Ningún cambio en esquema, dependencias ni acciones Git de modificación; sin escritura en desarrollo. Las suites verifican destino y limpian únicamente fixtures propios.

Revisión en navegador real de selección/detalle a 1280×900 y 375×900, apertura, retorno y edición de cero/0.00. API temporal ficticia en memoria, sin conexión a PostgreSQL; no equivale a una comprobación manual integrada con PostgreSQL. scrollWidth 1265/360 frente a viewport 1280/375: sin desbordamiento horizontal de página. Capturas escritorio/estrecho guardadas fuera del repositorio. Herramientas de accesibilidad mostraron etiquetas y foco inicial en título; lector de pantalla no ejecutado. Revisión detectó foco tras guardar intentado mientras el botón estaba deshabilitado: corregido para restaurarlo después de liberar el bloqueo.

Límite histórico del primer bloque: solo periodos registrados; sustituido por la regla aprobada de apertura mes/año descrita abajo. La creación de entrega y declarados consta de POST y PUT separados; un fallo del segundo no revierte el primero. Consulta tras respuesta incierta no reenvía ni sobrescribe automáticamente.

## Corrección de apertura por mes/año

- [x] Año introducido libremente y doce meses, sin depender de listado existente.
- [x] POST por mes/año con alternativa exclusiva periodo_id; GET por fecha sin creación.
- [x] Periodo/entrega atómicos, unicidad y protocolo municipal conservados.
- [x] Verificación final dirigida/completa, sintaxis, diff y visual de esta corrección.

145 pruebas dirigidas/3 archivos y suite completa 810/28 aprobadas en `gestion_facturacion_medicamentos_test`, con host local/current_database() verificados antes de fixtures propios y cleanup. Incluyen fechas/contratos ambiguos, GET sin creación, snapshots/declarados preservados, farmacia inválida/sin asociación, fallo ficticio del INSERT entrega con rollback del periodo, concurrencia de misma farmacia y diferentes farmacias en mismo/distinto Ayuntamiento, facturación y consultas. Interfaz: periodo vacío sin consulta, año inválido, entradas conservadas y doble envío.

Revisión visual real 1280×900 y 375×900 con API ficticia temporal en memoria y listado vacío: selección febrero/2035, apertura y retorno conservado. scrollWidth 1265/360 frente a viewport 1280/375. Sin escritura manual PostgreSQL, comprobación con lector de pantalla pendiente. Servidor temporal cerrado, fuente retirada y captura guardada fuera del repositorio. Sintaxis de los seis JS modificados y diff incluidos archivos nuevos sin errores; solo avisos LF/CRLF. Sin esquema/dependencias, escaneo ni acciones Git de modificación; ninguna comprobación escribe en desarrollo.

## Convención común de campos monetarios — 2026-10-08

- [x] Inventario de todas las pantallas: precio de Medicamentos y ambos importes de Entregas; ningún otro decimal editable existente.
- [x] Utilidad y CSS comunes; coma/punto normalizados como cadena, límites/NULL/cero preservados; € fuera del valor editable y etiqueta euros. Formato coma/dos decimales al cargar/blur válido, sin redondeo ni pérdida ante error.
- [x] 83 dirigidas / 3 archivos y suite completa 858 / 29 aprobadas; base dedicada local verificada, limpieza propia. Sintaxis y diff incluidos archivos nuevos comprobados.
- [x] Visual real a 1280×1000 y 375×900 en ambos formularios, solo GET y edición sin guardar; sin desbordamiento. Ayuntamiento y doble envío conservados con regresiones.
- [ ] Revisión con lector de pantalla y visual del formulario de declarados sobre una entrega guardada; integración de edición cubierta con DOM/API simulados.

Inventario, contrato y evidencias detallados en [convención común](../../convencion-campos-decimales.md). Sin cambios de backend, esquema, dependencias o cálculos ni escrituras en desarrollo en este bloque.

## Búsqueda contra API real y servidor desactualizado — 2026-10-08

- [x] Causa reproducida: localhost:3000 devolvía 400 Identificador no válido para ambos GET /farmacias/busqueda. El backend PID 25816 se inició a las 22:28:59; la ruta actual se modificó a las 23:12:58. El proceso conservaba el router anterior y /:id capturaba busqueda, mientras Express servía el frontend actual desde disco.
- [x] Contraste con código cargado de nuevo y PostgreSQL dedicado verificado: ambas consultas respondieron 200. Ruta/parametrización, array proyectado, SOE textual, debounce 250 ms, errores y selección del frontend son coherentes; no fue necesario cambiar implementación ni contrato.
- [x] Reiniciado exclusivamente el proceso de este proyecto después de comprobar PID, comando y coincidencia del HTML servido con el archivo local. Backend actual en puerto 3000; GET SOE/prefijo y denominación/contiene devuelven 200 y coincidencias. Sin escrituras de comprobación en desarrollo.
- [x] Nueva regresión test/entregas-busqueda-integracion.test.js: DOM simulado con módulos reales de interfaz/transporte y HTTP/PostgreSQL reales; nombre, SOE con ceros/letras, selección clic/teclado, Enter sin POST, Ayuntamiento, declarados conservados. Servidor antiguo reproducido con router /:id y controlador real: su 400 muestra error, nunca Sin coincidencias.
- [x] 88 dirigidas / 3 archivos y suite completa 862 / 30 aprobadas en gestion_facturacion_medicamentos_test local, current_database() comprobado antes de fixtures ficticios y limpieza por IDs propios. Sintaxis y diff incluidos nuevos correctos.
- [x] Navegador real localhost:3000: nombre muestra dos coincidencias, clic sobre farmacia sin Ayuntamiento conserva aviso; SOE 2 + Enter selecciona farmacia asociada y habilita Abrir sin crear entrega; Cambiar conserva importe 12,34. Solo GET. Captura busqueda-api-real.jpg fuera del repositorio.

Las pruebas previas con API ficticia siguen cubriendo respuestas antiguas, errores de red, ambigüedad y doble envío. La nueva prueba verifica el contrato frontend/backend con transporte y catálogo reales; la simulación del router antiguo no se confunde con la reproducción inicial en el servidor del usuario. No se modifican esquema, dependencias, reglas ni las mejoras monetarias. Para futuras modificaciones del backend arrancado con npm start, detenerlo con Ctrl+C y volver a npm start (o usar npm run dev para recarga automática); Ctrl+F5 solo recarga el navegador, no las rutas de Node.

## Mensajes municipales y verificación completa de apertura — 2026-10-08

- [x] Aclaración inicial eliminada del HTML y de cambioSeleccion(): contexto oculto/vacío sin farmacia; nombre junto a farmacia con Ayuntamiento; sin Ayuntamiento solo aviso cerca de Abrir, sin texto duplicado. Cambio invalida/limpia el contexto anterior; no se eliminan validaciones ni protecciones. Regresión de estados y HTML añadida.
- [x] Investigación real localhost:3000: HTML/entregas.js/entregas-api.js coinciden con archivos locales; Cache-Control public,max-age=0; ruta búsqueda 200 con id, ayuntamiento_id y ayuntamiento_denominacion reales. Proceso actual PID 10172, node --env-file-if-exists=.env src/server.js, distinto del anterior; no se detienen procesos. SOE 2, mes 10/año 2026 y selección Enter habilitan botón, aria-busy=false; sin condición antigua periodo_id. No hay evidencia de caché o backend antiguo en esta reproducción.
- [x] Dos integraciones nuevas: módulos frontend reales + DOM simulado + HTTP/PostgreSQL reales, selección clic/Enter → botón habilitado → POST por mes/año → PUT declarados → resumen; periodo inicialmente inexistente, snapshot y 0/12.34 verificados. Solo base dedicada local comprobada con current_database(), cleanup por IDs propios y año propio no existente al preparar.
- [x] Navegador real en servidor temporal 127.0.0.1:3108 conectado a gestion_facturacion_medicamentos_test verificada: mes 2/año ficticio, búsqueda → clic con Ayuntamiento → botón habilitado → apertura creada/declarados guardados/resumen actualizado. Después Enter para farmacia sin Ayuntamiento muestra únicamente aviso, sin contexto ni duplicado, importe 12,34 conservado. No es API ficticia. Fixtures limpiados (cero farmacias propias restantes), servidor cerrado y helper retirado; captura apertura-entrega-api-real.jpg fuera del repo. Sin escrituras en desarrollo.
- [x] 125 dirigidas/3 y suite 867/31 aprobadas. Primer pase detectó una aserción del aviso en su ubicación anterior; se ajustó para comprobar el texto de bloqueo vigente. Sintaxis/diff incluidos nuevos correctos. Mejoras monetarias/autocompletado y esquema/dependencias intactos.
- [ ] Reproducir el bloqueo concreto comunicado por el usuario: con selección válida el botón se habilita en ambas reproducciones reales. Se solicitó SOE y texto bajo Abrir mediante pregunta; no se atribuye causa no confirmada ni se marca como resuelto ese caso particular.
# Simplificación del detalle de entrega — 2026-10-09

## Integración de búsqueda adaptada a la interfaz vigente — 2026-10-09

- [x] Reproducción inicial: 4/7 fallos por referencias al recuadro eliminado `ayuntamiento`, al antiguo botón `cambiar-farmacia` y a reemplazar el texto buscado por SOE al seleccionar mediante flechas.
- [x] Solo prueba corregida: abrir la vista con `seleccionar-farmacia`, verificar SOE/nombre/Ayuntamiento en la línea de selección y ausencia del recuadro duplicado, aviso único y bloqueo sin Ayuntamiento, regreso automático, cambio/cancelación conservando periodo y declarados. Comprobar GET sin escritura antes de Crear entrega y ausencia de periodo/entrega en la base para esa selección.
- [x] Primero prueba dirigida 7/7 y después suite completa 925/925 en 32 archivos. `DB_NAME` sobrescrito exclusivamente para cada comando a `gestion_facturacion_medicamentos_test`; host local y `current_database()` comprobados antes de las integraciones. `.env` intacto. Ejecución fuera del aislamiento por bloqueo de conexión local/temporales.
- [x] Sin cambios de producción, API, esquema ni reglas; sin acciones Git.

## Tabla y alineación de Entregas registradas — 2026-10-09

- [x] Retirada columna Periodo; cinco columnas con nombre histórico más amplio, aptos/importe destacados y acción accesible. Periodo conservado en filtro y nombre accesible del botón. Sin cambios a filtros, agrupación, orden ni reglas.
- [x] Margen común de 1,5 rem / 1 rem móvil para filtros, cabecera, mensaje, encabezados municipales y regiones desplazables; grupos separados y ancho mínimo de tabla 56 rem con scroll propio.
- [x] 97/97 pruebas de interfaz (72 Entregas, 25 registro), incluyendo cinco encabezados/celdas por grupo, importe grande, acción, estilos delimitados y regresiones de filtros/navegación. Adaptadas posiciones de celdas en la prueba de integración existente, sin ejecutarla ni acceder a DB.
- [x] Navegador real con API ficticia en memoria: 1280 y 375 px, nombres largos e importe 9999999999,99 completo, «Volver al inicio» visible, alineación x=49,5 / x=27 y sin desbordamiento de página. Tab en región desplaza hasta acción, que queda visible y envuelve el texto en móvil. Servidor temporal detenido; sin acciones Git.

## Paquetes vacíos y final de consulta — 2026-10-09

- [x] Caption, tabla y contenedor de scroll ocultos sin aptos; con `admitidos === 0`, única frase «Todavía no hay precintos aptos en esta entrega». Sin inferir cero cuando falta el recuento o falla la consulta.
- [x] Retirada de «Consultando entrega…» después del GET correcto; carga/error del resumen independientes. «Información de control» plegada en cada apertura; edición explícita conserva su despliegue.
- [x] 95/95 pruebas de interfaz dirigidas (70 de Entregas y 25 de lecturas): estados vacío/solo incidencias/con aptos, carga/fallo/reintento, consulta pendiente y completada, regreso y reapertura plegada. Ejecución fuera del aislamiento por error de acceso a temporales de Vitest; sin conexión ni escritura DB.
- [x] Sin cambios en cálculos, reglas, API, esquema ni acciones Git.

- [x] Navegación única «Volver al listado» en el detalle; «Registrar precintos» destacado y «Editar declarados» dentro de «Información de control», plegable por defecto.
- [x] Resumen automático prioriza aptos e importe facturable. El control secundario agrupa incidencias, total registrado, declarados, diferencias, snapshots históricos de farmacia y paquetes. Reintentar solo aparece junto al error de carga; eliminado aviso persistente al consultar una entrega.
- [x] Se conserva contexto histórico municipal/periodo/SOE y la tabla de precintos con paquete, posición, códigos y precio aplicado. Guardados mantienen estados visibles; refresco posterior es automático.
- [x] Pruebas de interfaz: prioridad y controles visibles, acción principal, carga/reintento automático, resumen y actualización automática tras edición, confirmación/pendiente/fallo de guardado. 60 pruebas dirigidas aprobadas; sin cambios de esquema, reglas, dependencias ni escrituras en bases.
