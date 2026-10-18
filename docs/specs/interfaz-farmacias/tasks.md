# Tareas: interfaz de Farmacias

Las tareas reflejan la implementación actual. Se marcan completas cuando el comportamiento aparece en el código y existe una comprobación correspondiente.

## 1. Servir y estructurar la página

- [x] **Objetivo:** ofrecer una página estática para el listado y el formulario de Farmacias.
- **Archivos:** `public/farmacias.html`, `public/js/farmacias.js`.
- **Comprobación:** `test/static-files.test.js` verifica la entrega de la página y `test/farmacias-interfaz.test.js` comprueba su estructura etiquetada.

## 2. Mostrar el listado y la asociación

- [x] **Objetivo:** presentar farmacias y el ayuntamiento asociado de forma clara.
- **Archivos:** `public/js/farmacias.js`.
- **Comportamiento esperado:** SOE, CIF/NIF, denominación, localidad, provincia, nombre del ayuntamiento y su CIF cuando esté disponible; carga, error y lista vacía con opción de reintento en caso de error.
- **Comprobación:** la prueba de interfaz comprueba nombre y CIF en la celda; el código crea contenido con APIs DOM de texto.

## 3. Implementar alta y edición en pantalla

- [x] **Objetivo:** proporcionar los formularios conectados a las operaciones existentes.
- **Archivos:** `public/farmacias.html`, `public/js/farmacias.js`, `public/js/farmacias-api.js`.
- **Comportamiento esperado:** seleccionar ayuntamiento en alta; en edición mostrar el asociado deshabilitado y omitirlo del `PUT`; actualizar la lista tras el éxito.
- **Comprobación:** pruebas de interfaz verifican que el alta envía el ID seleccionado y que la edición no permite cambiarlo ni lo manda en la actualización.

## 4. Añadir navegación de entrada y retorno

- [x] **Objetivo:** permitir llegar a las funciones existentes desde `/` y regresar al inicio.
- **Archivos:** `public/index.html`, `public/ayuntamientos.html`, `public/farmacias.html`.
- **Comportamiento esperado:** enlaces solo a Ayuntamientos y Farmacias, más un enlace de vuelta a `/` desde cada página.
- **Comprobación:** `test/static-files.test.js` solicita `/` y ambas páginas y confirma sus destinos.

## 5. Verificar mensajes, accesibilidad y adaptación

- [x] **Objetivo:** conservar una interfaz utilizable con teclado, lectores de pantalla y pantallas estrechas.
- **Archivos:** HTML y hojas CSS bajo `public/`.
- **Comprobación automatizada:** inspección de etiquetas, regiones `status`/`alert`, nombres accesibles y texto seguro en código; prueba estática de estilos de cabecera, foco visible y breakpoint móvil.
- **Comprobación manual:** se verificó foco visible en botones y campos al usar Tab, orden de navegación y etiquetas comprensibles, anuncio de botones y campos por el Narrador de Windows y presentación a 375 px sin desplazamiento horizontal general. No se modificaron registros.

## 6. Comprobación manual de presentación

- [x] **Objetivo:** confirmar en navegador que la navegación y las pantallas siguen siendo cómodas con teclado y en viewport estrecho.
- **Comprobación manual:** en navegador se comprobó que `/` muestra los enlaces a Ayuntamientos y Farmacias, ambas páginas abren y permiten volver al inicio, y los enlaces de navegación y retorno funcionan con teclado. A 375 px, cabeceras y tablas de Ayuntamientos y Farmacias y cabecera y enlaces del inicio se ven completos, sin desplazamiento horizontal general.

## Fuera de alcance

Cambios en API, esquema o base de datos; reasignar una farmacia; implementar pantallas de otros módulos; incorporar dependencias nuevas.

## Compatibilidad con farmacias desasignadas (6 de octubre de 2026)

- [x] Mostrar «Sin Ayuntamiento» en listado y selector de edición cuando la API devuelve NULL.
- [x] Permitir editar el maestro desasignado sin cargar el catálogo de Ayuntamientos, con selector deshabilitado y sin enviar `ayuntamiento_id` en PUT.
- **Evidencia:** `test/farmacias-interfaz.test.js` comprueba estos comportamientos con catálogo no disponible y conserva las pruebas de alta con Ayuntamiento y edición asignada. Las cuatro pruebas de interfaz pasaron; suite completa: 243 pruebas. No se realizó una nueva revisión visual manual en esta tarea.
- **Pendiente:** ficha municipal, búsquedas, confirmaciones y operaciones de asignación controlada, especificadas en `../interfaz-gestion-ayuntamiento/`.

## Navegación uniforme (7 de octubre de 2026)

La ficha municipal y las asignaciones del bloque anterior ya están implementadas; su evidencia vigente permanece en `../interfaz-gestion-ayuntamiento/tasks.md`.

- [x] Listado inicial; alta y consulta/edición ocultan listado y acciones. Guardar/cancelar vuelve al listado y restaura foco. Validación fallida conserva entradas; se descarta detalle recibido tras cancelar y se bloquea salida/doble envío durante escritura.
- [x] Dos pruebas nuevas con DOM/API simulados cubren navegación, error, retorno guardado/cancelado y detalle tardío. Alta/asignación obligatoria y edición con relación deshabilitada conservadas.
- [x] Revisión visual separada con API real en escritorio y móvil: Nuevo/cancelar, alta, consulta/edición/cancelar y guardado con retorno, enlace real al inicio; móvil sin desbordamiento de página y botón Inicio 44px. Fixtures propios limpiados. Evidencia compartida y límites en `../interfaz-ayuntamientos/tasks.md`, bloque del 7 de octubre.
- [x] Suite final 465/17 aprobada; sintaxis y diff correctos, incluidos archivos sin seguimiento. Detalle de comandos y alcance en las tareas compartidas anteriores.
