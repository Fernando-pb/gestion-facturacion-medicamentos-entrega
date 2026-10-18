# Plan — interfaz de Entregas y precintos

## Eliminación visual de aptos — implementada, 12 de octubre de 2026

Reutilizar DELETE por entrega/ID y validación transaccional vigente; no ampliar contrato/esquema. Papelera compacta en la celda del precio con nombre accesible/tooltip y confirmación identificada; sin columna adicional. Compartir bloqueo de lecturas/precios/navegación durante confirmación/envío. Manejar 204 sin JSON y respuesta incierta por consulta de ID antes de cualquier nueva confirmación. Refrescar tabla/resumen/contexto, conservar entrada, scroll y foco; no mostrar total anterior si falla refresco tras borrado confirmado. Verificar ancho 752/375, teclado, estados y concurrencia con pruebas existentes/ampliadas. Evidencia en tasks.md.


## Corrección de precios — 12 de octubre de 2026

Formulario por ID del precinto: mostrar solo su referencia y aplicado, confirmar esta lectura y refrescar total. SIN_FACTURAR/REVISION/REABIERTA sin cobros habilitan lectura y corrección, sin preparación previa; EMITIDA/cobros/error de contexto bloquean ambas. Al admitir, resaltar y desplazar la tabla hasta fila/precio conservando orden y foco. Mantener recuperación por consulta del ID ante respuesta incierta. Pruebas de flujo individual, totales, última fila visible y bloqueo financiero. Sustituye el plan agrupado anterior.

## Filtros de periodo y Ayuntamiento — 2026-10-09

El endpoint neutral existente admite lista completa o `periodo_id` e incluye `periodo_id`, fechas y `ayuntamiento_id`/denominación actuales. El listado usa la respuesta completa al inicio para elegir el periodo más reciente con entregas y para poblar Ayuntamientos; el selector mantiene todos los periodos concretos. Cambiar periodo recarga automáticamente mediante el filtro existente; cambiar Ayuntamiento filtra las filas cargadas del periodo. Un resultado combinado vacío es un estado normal. El listado neutral no proyecta la relación implementada de emisión/participación/entrega ni su permiso financiero: el periodo inicial es provisional por fecha reciente, no se muestra como pendiente de facturar y no se altera el contrato ni esquema.

## Simplificación del listado y revisión de eliminación — 2026-10-09

Simplificación implementada: un título por Ayuntamiento, recuento breve, reintento solo tras error, carga automática y tabla desplazable accesible por teclado. Se conservan agrupación/orden, continuación mediante GET, totales exactos y estados de guardado. El filtro mantiene todos los periodos existentes, también vacíos, conforme al endpoint actual.

Eliminación detenida por la condición explícita del usuario: falta vínculo fiable entre participación facturada y entrega, y política para las claves de operaciones de lectura que impiden borrar la entrega y preservan retiradas. No se añade botón/API, cascadas ni esquema. Siguiente bloque: resolver esos requisitos y aprobar el contrato; después implementar eliminación transaccional y revalidación concurrente, confirmación identificada/cantidades y regresiones de cancelación, éxito y rechazo financiero. Detalle en spec.md.

1. Resolver mes/año en POST existente de forma transaccional; conservar consulta de periodos por compatibilidad.
2. Crear página HTML, CSS propio y cliente HTTP; reutilizar estilos y listado de Farmacias.
3. Selección, contexto municipal y apertura protegida; distinguir 200/201.
4. Detalle, resumen servidor, edición explícita y consulta tras respuesta incierta.
5. Pruebas dirigidas/completas, sintaxis, diff y revisión visual cuando sea posible.

Selección simplificada: reemplazar búsqueda local/listado por autocompletado filtrado con debounce, ruta global mínima reutilizada, selección explícita/Enter SOE exacto y accesibilidad de teclado; mantener todos los avisos y bloqueos de apertura existentes.

6. Registro desde detalle en vista dedicada: contexto y totales principales fijos, lista de aptos y controles secundarios plegables; entrada teclado/Enter.
7. Reutilizar evaluación, guardado, consulta por clave y consultas de lecturas/resumen existentes; decisiones explícitas, paquetes y recuperación de resultado incierto sin reintentos automáticos.
8. Regresiones de interfaz y API existentes, suite completa por cambios compartidos y presentación escritorio/estrecho con API ficticia sin base de datos.

Sin esquema, dependencias, integración específica de hardware, facturación ni acciones Git. Eliminación visual de lecturas y recuperación persistente de operaciones tras recarga quedan pendientes.

## Trabajo diferido — clasificación y búsqueda financiera

El listado neutral «Entregas registradas», el alta separada, continuación, filtro por periodo y filtro municipal están implementados; la pantalla no clasifica entregas como pendientes de facturar o facturadas. La clasificación y el buscador separado de entregas facturadas quedan diferidos y no deben presentarse como entregados. Evidencia del listado disponible en tasks.md.

Al retomarse este trabajo diferido, especificar primero el criterio basado en la participación realmente emitida, el tratamiento de entregas sin aptos o con facturación en revisión/reabierta, los filtros históricos y la navegación. La pantalla financiera ya dispone del vínculo participación/entrega y del flujo de reapertura; la vista de Entregas aún no los proyecta para clasificar o buscar. No inferir clasificación por cobro, estado de cabecera o periodo compartido.

Este apartado describe únicamente trabajo diferido; no afirma que la clasificación o el buscador estén implementados. La separación alta/consulta neutral sí está disponible.
