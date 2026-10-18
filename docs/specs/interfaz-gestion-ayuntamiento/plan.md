# Plan de interfaz: gestión de medicamentos y farmacias del Ayuntamiento

## 1. Punto de partida

Las interfaces existentes usan HTML/CSS/JS modular, `fetch` mediante clientes del mismo origen, renderizado seguro con APIs DOM de texto y mensajes accesibles. La pantalla de Ayuntamientos dispone de ficha separada con los dos apartados municipales. El CRUD actual de Farmacias asigna Ayuntamiento en alta y no permite cambiarlo en edición; la gestión municipal permite la asociación y su corrección sin crear ni editar el maestro. La interfaz de Medicamentos mantiene los maestros, pero excluye autorizaciones específicas.

## 2. Propuesta visual

Al abrir la gestión de un Ayuntamiento, separar visualmente «Medicamentos admitidos» de «Farmacias asociadas». Para medicamentos, incluir control de campo (código/descripción), modo de coincidencia, caja de término, resultados consultables y lista actual. No mezclar `estado` general con `situacion_comercial`. En `GENERAL`, aplicar solo la lista general y mostrar las asociaciones específicas conservadas con el aviso exacto aprobado; en `ESPECIFICA`, volver a aplicar esas asociaciones junto con `estado = ACTIVO`. Los cambios de modalidad no borran asociaciones y `situacion_comercial = ALTA` conserva su regla vigente para nuevas lecturas facturables.

La ficha del Ayuntamiento contiene los apartados «Medicamentos admitidos» y «Farmacias asociadas», construidos con el patrón visual y componentes existentes. Para farmacias, permitir buscar todos los maestros por SOE o denominación, incluidos los no asignados y los asociados a otros Ayuntamientos; mostrar la asignación actual y datos mínimos. La API devuelve únicamente los últimos cuatro dígitos enmascarados (`•••• 1234`) o `null`, nunca el número completo. Asociar, reasignar o quitar solo si no hay entregas ni precintos. Cualquier entrega bloquea, aunque esté vacía; las incidencias quedan cubiertas por la entrega. Mostrar el motivo del bloqueo y pedir confirmación antes de reasignar (Ayuntamiento actual y nuevo) o quitar (asignación que se eliminará). Quitar conserva el maestro y requiere que el esquema permita `ayuntamiento_id = NULL`. No ofrecer edición del maestro.

## 3. Contrato y privacidad de cuenta

El contrato está documentado en [la especificación funcional §11](../gestion-ayuntamiento/spec.md#11-contrato-api-propuesto-para-implementación) y resumido en la [especificación de interfaz §5](spec.md#5-contrato-de-api-para-la-interfaz). La vista no usa directamente `GET /farmacias`, que devuelve la cuenta completa. Se mantiene la regla confirmada de no requerir control independiente de facturación por farmacia. Las mutaciones de asignación/quita comprueban actividad y cambian la relación atómicamente.

La confirmación para retirar medicamento identificará ayuntamiento y medicamento. La confirmación de reasignación identificará Ayuntamiento actual y nuevo; la de quitar indicará qué asignación se eliminará. Botones inequívocos para continuar/cancelar. Mensajes duplicados, bloqueos, errores de red y respuestas vacías deben ser claros y accesibles.

## 4. Pruebas visuales y automatizadas previstas

- Pruebas UI de búsqueda por campo/modo, orden correspondiente, consulta de resultados, alta/duplicado, confirmación/cancelación de retirada.
- Verificar que `estado` y `situacion_comercial` no se confunden y que las listas recargan datos maestros actuales tras una operación.
- Probar ambos modos: conservación, aviso y no aplicación de asociaciones específicas en `GENERAL`; restauración de su aplicación en `ESPECIFICA`; ningún borrado automático al cambiar modalidad.
- Pruebas de tabla Farmacias: orden según búsqueda, campos visibles correctos y ausencia de cuenta completa en DOM/respuesta seleccionada para la vista.
- Pruebas con teclado, mensajes `status`/`alert`, etiquetas, foco, ancho reducido y valores de catálogo potencialmente no confiables insertados como texto.
- Farmacia: probar búsqueda inclusiva, asignación, reasignación y quitar cuando no hay entregas ni precintos; bloqueo por entrega (también vacía) y por precinto; confirmación/cancelación, conservación del maestro y carreras entre chequeo/guardado. Verificar que quitar deja la farmacia visible y seleccionable sin Ayuntamiento, y que ninguna operación modifica registros históricos. No se exige control de facturación para esta regla.
- Probar la validación del futuro registro de entrega en servidor: solo admite farmacia asignada al Ayuntamiento seleccionado y usa el ID interno.
- Verificar que las consultas/listados de Farmacias mantienen las no asignadas (por ejemplo, mediante `LEFT JOIN` donde corresponda) tras admitir `ayuntamiento_id = NULL`.
- Probar rutas y contratos: `400` para parámetros/cuerpos/IDs inválidos, `404` para Ayuntamiento o maestro inexistente, `409` para duplicado o bloqueo por entregas/precintos y propiedad `{ error }`; probar respuestas `200`, `201`, `204` y arrays vacíos según la operación.
- Verificar por prueba de API que las respuestas de búsqueda/lista municipal contienen `cuenta_bancaria_enmascarada` y no contienen `cuenta_bancaria` ni sus componentes.

## 5. Secuencia

1. Alinear la guía TFM y los modelos conceptual/lógico con la asignación, reasignación y ausencia de Ayuntamiento permitidas antes de actividad; después, aprobar y cambiar en tarea separada la nulabilidad de `farmacia.ayuntamiento_id`.
2. Actualizar validaciones y consultas del módulo Farmacias que hoy presuponen Ayuntamiento obligatorio; comprobar que los maestros no asignados siguen apareciendo donde corresponda.
3. Implementar el contrato documentado, incluida la proyección de cuenta enmascarada, búsqueda parametrizada y respuestas de error según las convenciones actuales.
4. Diseñar el flujo municipal en las páginas existentes con la menor extensión posible y coordinar el bloqueo concurrente con la futura creación de entregas.
5. Implementar y probar clientes UI, mensajes y renderizado seguro; verificar explícitamente que no se exige comprobar facturación por farmacia.
6. Verificar accesibilidad manual con teclado/lector de pantalla y en pantalla estrecha siguiendo evidencia documentada en las interfaces existentes.

Ambos apartados están implementados y verificados; la revisión manual con lector de pantalla sigue pendiente.

## Backend de Farmacias disponible

GET de lista asociada y búsqueda, POST y DELETE ya están implementados y probados. Usar las consultas seguras y los criterios técnicos de la especificación funcional §11 al implementar los controles de Farmacias. Evidencia de backend: 41 pruebas nuevas de consulta y suite de 320 pruebas aprobadas; ambos apartados están implementados y verificados.

## Implementación del apartado de Farmacias

`public/ayuntamientos.html` contiene panel/tablas/formulario de búsqueda y confirmación. `ayuntamientos.js` incorpora «Ficha» sin sustituir el CRUD; `ayuntamiento-farmacias.js` gestiona el apartado y permite inyectar el cliente para pruebas. `ayuntamientos-api.js` reutiliza errores y transporte existentes con las rutas municipales y soporte 204. CSS comparte paneles, formularios, botones y tablas con scroll; ajustes locales evitan solapamientos y mantienen las acciones del listado accesibles.

Estado por contexto y generaciones de lectura para descartar respuestas antiguas; las mutaciones no se duplican y refrescan lista/resultados. El POST conserva el origen observado, y cualquier rechazo cierra la confirmación y recarga resultados actuales; Asignar es directo y Trasladar requiere nueva confirmación. Evidencia: tareas de interfaz; suite de 354 pruebas aprobada.

API e interfaz de Medicamentos disponibles y verificadas; criterios concretos de búsqueda/proyección en spec funcional §11. La modalidad procede del GET del Ayuntamiento, incluso con lista vacía. Estados comercial/general se presentan por separado.

## Interfaz de Medicamentos implementada

El módulo public/js/ayuntamiento-medicamentos.js gestiona lista, búsqueda, incorporación y confirmación de retirada con el cliente municipal existente. public/js/gestion-municipal-ui.js comparte mensajes accesibles, celdas seguras y validación del término con Farmacias; HTML/CSS reutilizan sus componentes. ayuntamientos.js coordina el bloqueo de ambos apartados y el retorno desde la edición existente para cambiar modalidad. La modalidad se consulta por GET incluso sin asociaciones. No se cambia contrato, backend ni esquema. Evidencia: 34 pruebas nuevas y suite completa de 446 aprobada; revisión visual separada con API real a 1280/375 px, detallada en las tareas de interfaz.

## Navegación progresiva implementada

ayuntamientos.js alterna listado/formulario/ficha mediante hidden, preservando controles y retorno de edición. Los módulos de ambos apartados usan iniciarPanelBusqueda en gestion-municipal-ui.js para apertura, cierre, selección, suspensión y foco. Conservan por separado sus consultas y reglas; alIniciarTarea cierra la búsqueda/confirmación del otro apartado. El HTML incorpora paneles etiquetados; Medicamentos conserva selección y acción fuera de tabla, mientras Farmacias ofrece Asignar/Trasladar directamente por fila o Ya asociada sin botón; CSS utiliza paneles/colores y adaptación existentes. Cerrar invalida lecturas pendientes; cancelar traslado vuelve a lista conservando filtros. Pruebas y límites de verificación en tasks.md.

## Pestañas y tareas excluyentes implementadas

ayuntamientos.js coordina ficha/edición y las tres pestañas, carga Datos por el GET existente y vuelve a Datos después de editar. iniciarPestanasMunicipales comparte selección ARIA, índice de tabulación, flechas/Home/End y bloqueo durante escritura. Los módulos de asociaciones preparan contexto sin cargar al entrar en ficha y exponen activar/desactivar: cargan solo al seleccionar su pestaña, invalidan lecturas al dejarla y conservan filtros.

iniciarPanelBusqueda alterna lista y resultados en Farmacias (conSeleccion=false); Medicamentos conserva además su selección; suspende tareas durante confirmación y vuelve a la lista después de incorporar. El retorno interno a lista admite la escritura en curso sin habilitar acciones: los controles siguen bloqueados hasta acabar el refresco y comunicar resultado. Reintento se muestra solo tras fallar una carga. HTML usa tabpanels ocultos, paneles de tarea y ayuda desplegable; CSS reutiliza botones, rejilla, paneles y scroll de tablas. No se añaden rutas ni dependencias. Evidencia y límites en tasks.md.

## Presentación común implementada (7 de octubre de 2026)

El aviso GENERAL usa `.informative-notice` de la hoja existente, contexto textual de lista específica y `hidden` en ESPECIFICA. Las condiciones ACTIVO/ALTA permanecen en el texto de modalidad ESPECÍFICA. `ayuntamientos.js` conserva filtros de búsqueda al regresar de la edición de la misma ficha. Reutilizar las convenciones comunes de interfaz-ayuntamientos/spec.md; no cambiar reglas, rutas ni proyecciones. Pruebas de modalidad/retorno y evidencia visual en tasks.md.
