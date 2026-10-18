# Tareas: interfaz de Medicamentos

La implementación del listado, estados de pantalla, alta, consulta y edición está hecha y cubierta por pruebas automatizadas. La revisión manual de la tarea 5 está completada con el alcance descrito abajo.

## 1. Concretar presentación y navegación del catálogo

- [x] **Objetivo:** concretar presentación, campos y ruta de entrada para las operaciones confirmadas: crear, listar, consultar y editar, incluidos ambos estados, sin borrado físico.
- **Dependencia:** revisión de `../medicamentos/spec.md`.
- **Comprobación:** presentación inicial y ruta `/medicamentos.html` reflejadas en la especificación; precio en cadena decimal, `TD` solo lectura y `anexo` editable sin filtro.

## 2. Registrar el contrato HTTP aprobado

- [x] **Decidido por el usuario:** POST `201` y objeto JSON creado con `id`; GET colección `200`, array JSON, `[]` vacío y orden `id ASC`; GET por ID `200` o `400` ID inválido/`404` inexistente; PUT reemplazo completo `200`, conserva `id` y admite cambio de `codigo_nacional`; datos inválidos `400`, duplicado `409` al crear/actualizar, error funcional JSON con `error`; no hay `PATCH` ni `DELETE`.
- **Comprobación documental:** contrato reflejado en ambas especificaciones. Esto no marca la implementación como completada.

## 2a. Registrar respuesta de PUT ante IDs no resolubles

- [x] **Decidido por el usuario:** `PUT /medicamentos/:id` responde `400 Bad Request` para ID inválido y `404 Not Found` para ID válido sin medicamento correspondiente.
- **Dependencia:** especificación del módulo Medicamentos.
- **Comprobación documental:** decisión reflejada en las especificaciones del módulo y de interfaz; no acredita implementación ni pruebas.

## 2b. Registrar presencia y tratamiento de campos en POST/PUT

- [x] **Decidido por el usuario:** POST exige los campos obligatorios del modelo y permite omitir o enviar como `null` los cinco opcionales, que son texto cuando tienen valor. PUT exige todos los campos editables, incluidos opcionales como texto o `null`; omitir cualquiera responde `400`. `id` no va en el cuerpo; propiedades desconocidas se rechazan.
- **Comprobación documental:** decisión reflejada en las especificaciones y planes del módulo y de interfaz; no acredita implementación ni pruebas.

## 2c. Registrar valor admitido de `tipo_facturacion` en los cuerpos

- [x] **Decidido por el usuario:** en el MVP el cliente envía `tipo_facturacion: "TD"` en POST y PUT, y la API exige y valida ese único valor. No quedan definidos tipos ni reglas futuros para vacunas, leche u otros productos.
- **Comprobación documental:** decisión reflejada en las especificaciones y planes; no acredita implementación ni pruebas.

## 2d. Registrar normalización de texto en POST/PUT

- [x] **Decidido por el usuario:** recortar espacios extremos en campos de texto; rechazar obligatorios vacíos tras el recorte y convertir opcionales vacíos o de solo espacios a `null`; preservar `codigo_nacional` como texto con ceros iniciales y capitalización; validar valores exactos de las tres enumeraciones sin cambiar su capitalización.
- **Comprobación documental:** regla reflejada en las especificaciones y planes; no acredita implementación ni pruebas.

## 2e. Registrar representación y precisión decimal de `precio` en JSON

- [x] **Decidido por el usuario:** precio como cadena decimal en peticiones y respuestas JSON; rango `0`–`9999999999.99`, cero, uno o dos dígitos decimales con punto; rechazar negativos, importes mayores o más de dos decimales, sin redondeo silencioso. PostgreSQL almacena `NUMERIC(12,2)`.
- **Comprobación documental:** decisión reflejada en las especificaciones y planes; no acredita implementación ni pruebas.

## 2f. Registrar alcance del filtrado por `anexo` en el catálogo

- [x] **Decidido por el usuario:** `anexo` es opcional, informativo y editable; el MVP no implementa su filtro en la API ni en la interfaz. El posible filtrado se reconsiderará al especificar el flujo que lo necesite. La guía describe el uso actual en el proceso existente.
- **Comprobación documental:** decisión reflejada en las especificaciones y planes; no acredita implementación.

## 3. Implementar listado y estados de pantalla

- [x] **Objetivo:** presentar catálogo, carga, error y resultado vacío.
- **Dependencias:** tareas 1, 2, 2a, 2b, 2c, 2d, 2e y 2f.
- **Comprobación:** prueba de entrega estática e inspección del DOM creado con texto seguro.

## 4. Implementar alta, consulta y edición

- [x] **Objetivo:** conectar alta, consulta y edición con el contrato aprobado y presentar errores/resultados, permitiendo cambiar ambos estados y sin acción de borrado físico ni administración de autorizaciones.
- **Dependencias:** tareas 1, 2, 2a, 2b, 2c, 2d, 2e y 2f.
- **Comprobación:** flujos con datos ficticios, campos y enumeraciones validados por el servidor.

## 5. Revisar accesibilidad y adaptación

- [x] **Objetivo:** verificar etiquetas, mensajes anunciables, foco, teclado y viewport estrecho.
- **Dependencia:** interfaz implementada.
- [x] **Revisión visual:** navegador a 1280 px y 375 px; no hay desplazamiento horizontal general, código nacional y descripción no se solapan y las acciones quedan visibles.
- [x] **Teclado y foco:** la navegación con Tab sigue un orden lógico y el foco es visible.
- [x] **Tecnología de asistencia:** Narrador anunció las etiquetas y el mensaje de validación.
- **Formulario y estados comprobados:** se confirmó que el formulario es correcto; «Estado» solo ofrece `ACTIVO` e `INACTIVO`, y «Situación comercial» ofrece `ALTA` y `BAJA`. «NO ESTÁ» no aparece como estado.
- [x] **Alta manual:** se creó en `gestion_facturacion_medicamentos_test` el medicamento ficticio `codigo_nacional` `123456`, precio `1.23`, `estado = ACTIVO`, `situacion_comercial = ALTA` y `tipo_facturacion = TD`.
- [x] **Edición y limpieza manual:** se editó el medicamento ficticio `codigo_nacional` `20261005` (ID 83), guardando `estado = INACTIVO` y `situacion_comercial = BAJA`. La conexión confirmó `gestion_facturacion_medicamentos_test`; se eliminaron exclusivamente los registros ficticios IDs 83 y 84 y se verificó que ambos ya no existen.
- **Comprobación automatizada:** las 3 pruebas de interfaz pasaron; `node --check` y `git diff --check` pasaron.

## Decisiones pendientes

- [x] Verificar los estados del formulario: «Estado» ofrece solo `ACTIVO`/`INACTIVO`, «Situación comercial» ofrece `ALTA`/`BAJA` y «NO ESTÁ» no aparece como estado; el formulario se confirmó correcto (evidencia detallada en la tarea 5).
- [x] Aclaración del listado: el usuario confirmó que «Grupo ATC» no aparecía. La tabla está vacía porque se retiraron los registros ficticios; la revisión anterior retiró la columna «Grupo terapéutico», cuya etiqueta es distinta. `gtatc` se conserva en el formulario y la API.

- Ruta, campos visibles y presentación inicial concretados en `spec.md`: precio como cadena decimal, `TD` de solo lectura y `anexo` editable sin filtro.
- Revisión manual de la tarea 5 completada según la evidencia registrada arriba.
- No hay operación `PATCH`/`DELETE`, borrado físico ni administración de autorizaciones dentro del catálogo.
- Ubicación y operaciones de autorizaciones específicas resueltas fuera del catálogo: ficha municipal (`../interfaz-gestion-ayuntamiento/`).
- Mantener pendientes las migraciones con datos sin clasificar, sin inferir ni asignar valores automáticamente. El flujo consumidor BAJA sigue pendiente de implementación: elección explícita aceptar/apartar sin marca histórica adicional en el MVP; evidencia adicional como mejora futura, sin bloquear implementación.

## Navegación uniforme (7 de octubre de 2026)

- [x] Listado inicial; crear y consultar/editar lo ocultan con sus acciones. Guardar/cancelar vuelve al listado; «Nuevo» se habilita antes de recuperar el foco. Un error mantiene el formulario y los valores; bloqueo de doble envío/salida conservado.
- [x] Una prueba nueva con DOM/API simulados cubre vistas excluyentes, validación fallida, cancelación, edición guardada y nueva alta después de guardar. Pruebas anteriores conservadas.
- [x] Revisión visual independiente con API real a 1280/375 px: alta/cancelación, consulta/edición/cancelación, guardado y regreso al listado, enlace real al inicio. En móvil se provocó un duplicado 409: mensaje y datos conservados; corregir código permitió guardar. Fixtures propios limpiados. Evidencia compartida y límites en `../interfaz-ayuntamientos/tasks.md`, bloque del 7 de octubre; no se repitió Narrador en esta tarea.
- [x] Suite final 465/17 aprobada; sintaxis y diff correctos, incluidos archivos sin seguimiento. Detalle de comandos y alcance en las tareas compartidas anteriores.

## Convención común de campos monetarios — 2026-10-08

- [x] Inventario de todas las pantallas: precio de Medicamentos y ambos importes de Entregas; ningún otro decimal editable existente.
- [x] Utilidad y CSS comunes; coma/punto normalizados como cadena, límites/NULL/cero preservados; € fuera del valor editable y etiqueta euros. Formato coma/dos decimales al cargar/blur válido, sin redondeo ni pérdida ante error.
- [x] 83 dirigidas / 3 archivos y suite completa 858 / 29 aprobadas; base dedicada local verificada, limpieza propia. Sintaxis y diff incluidos archivos nuevos comprobados.
- [x] Visual real a 1280×1000 y 375×900 en ambos formularios, solo GET y edición sin guardar; sin desbordamiento. Ayuntamiento y doble envío conservados con regresiones.
- [ ] Revisión con lector de pantalla y visual del formulario de declarados sobre una entrega guardada; integración de edición cubierta con DOM/API simulados.

Inventario, contrato y evidencias detallados en [convención común](../../convencion-campos-decimales.md). Sin cambios de backend, esquema, dependencias o cálculos ni escrituras en desarrollo en este bloque.
