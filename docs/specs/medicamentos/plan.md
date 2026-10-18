# Plan técnico: Medicamentos

## 1. Punto de partida

Ayuntamientos y Farmacias cuentan con API e interfaz. La aplicación usa JavaScript, Express, PostgreSQL mediante `pg`, Zod, Vitest y Supertest. El esquema ya contiene `medicamento` y `ayuntamiento_medicamento`; este trabajo de análisis no requiere cambios de esquema.

`medicamento` tiene clave interna, código nacional único, descripción, precio actual, `estado`, `situacion_comercial`, tipo de facturación y cinco atributos opcionales. La columna comercial aprobada es `TEXT NOT NULL`, sin `DEFAULT`, con CHECK para `ALTA`/`BAJA`, ya incluida en `db/schema.sql`. Según la confirmación del autor, se aplicó únicamente a `gestion_facturacion_medicamentos_test` con cero medicamentos; desarrollo no se modificó y otras instalaciones no se consideran migradas. Las migraciones con datos sin clasificar siguen pendientes.

El alcance confirmado permite crear, listar, consultar y editar medicamentos, incluidos ambos estados. No ofrece borrado físico. La gestión de `ayuntamiento_medicamento` se definirá aparte del catálogo; su ubicación y operaciones quedan abiertas. Fuente: guía canónica vigente v7, A.7 y A.7.1.

## 2. Separación de responsabilidades propuesta

Seguir la estructura existente de los módulos: rutas pequeñas, validación de entrada, lógica de persistencia parametrizada con `pg` y pruebas con Vitest/Supertest. No añadir dependencias ni capas sin necesidad. La API no debe duplicar como dato el precio histórico; ese snapshot pertenece a `precinto.precio_aplicado` al registrar cada precinto. No diseñar operaciones de borrado físico ni de administración de autorizaciones dentro del catálogo.

El usuario aprobó el contrato HTTP: POST responde `201` con el objeto creado e `id`; GET de colección responde `200` con array JSON (`[]` si está vacío), ordenado por `id ASC`; GET por ID responde `200`, o `400` con ID inválido y `404` si no existe; PUT reemplaza el registro completo y responde `200` con el objeto actualizado, conserva el `id` y puede cambiar `codigo_nacional`. PUT responde `400` si el ID es inválido y `404` si es válido pero no existe. Datos inválidos responden `400`, `codigo_nacional` duplicado responde `409` en POST y PUT, y los errores funcionales usan JSON con `error` sin texto literal fijado. No hay `PATCH` ni `DELETE`; respetar la aprobación previa de contratos importantes de `AGENTS.md`, sección 14.

La regla aprobada para los cuerpos exige en POST los seis campos obligatorios del modelo (`codigo_nacional`, `descripcion`, `precio`, `estado`, `situacion_comercial`, `tipo_facturacion`); los cinco opcionales pueden omitirse o ser `null` y, si tienen valor, son texto. En el MVP el cliente incluye `tipo_facturacion: "TD"` en POST y PUT y la API valida ese único valor. PUT exige la presencia de los once campos editables: los mismos seis obligatorios y los cinco opcionales, que aceptan texto o `null`; omitir cualquier campo editable produce `400`. `id` queda fuera del cuerpo y procede de la ruta en PUT; propiedades desconocidas se rechazan. En campos de texto se recortan los espacios extremos; los obligatorios vacíos después del recorte se rechazan y los opcionales vacíos se convierten en `null`. `codigo_nacional` conserva los ceros iniciales y su capitalización, sin conversión numérica ni cambio de mayúsculas/minúsculas. Las enumeraciones `estado`, `situacion_comercial` y `tipo_facturacion` se validan contra valores exactos, sin normalizar capitalización. `precio` viaja como cadena decimal en peticiones/respuestas JSON: rango `0`–`9999999999.99`, cero, uno o dos decimales y punto como separador; se rechazan negativos, importes mayores o más de dos decimales, sin redondeo silencioso. PostgreSQL conserva `NUMERIC(12,2)`. La presentación visual/localización del precio sigue pendiente. La decisión sobre el precio no define cómo se facturarían vacunas, leche u otros tipos futuros.

## 3. Interfaz implementada

La interfaz reutiliza el patrón existente: recursos estáticos servidos por Express, módulos ES del navegador, cliente HTTP del mismo origen y renderizado de datos de API mediante APIs DOM de texto. Permite crear, listar, consultar y editar, incluidos ambos estados, y presenta carga, vacío, error y confirmación de operación. No incluye borrado físico ni administración de autorizaciones específicas, que se definirá aparte.

La implementación inicial usa `/medicamentos.html`, enlazada desde inicio; el formulario presenta todos los campos del modelo, ambos estados en controles separados, `TD` como solo lectura, `anexo` editable y precio como cadena decimal recibida. Las operaciones siguen el contrato HTTP aprobado. No se incorporan nuevas dependencias.

## 4. Pruebas previstas para la implementación

- Pruebas automatizadas verifican presencia de campos por método, `tipo_facturacion = TD`, normalización de texto aprobada, precio como cadena decimal con rango y precisión aprobados, opcionales omitidos/nulos en POST, todos presentes en PUT, rechazo de propiedades desconocidas y enumeraciones exactas.
- Integración con PostgreSQL de prueba para código nacional duplicado, límites de `precio`, precisión decimal, rechazo sin redondeo y persistencia de los valores admitidos.
- La implementación y las pruebas de `POST /medicamentos`, `GET /medicamentos`, `GET /medicamentos/:id` y `PUT /medicamentos/:id` verifican respuestas y errores aprobados, orden `id ASC`, reemplazo completo, ausencia de `PATCH`/`DELETE` y ausencia de gestión de autorizaciones específicas.
- Una prueba de integración verifica que un cambio de precio del medicamento no actualiza `PRECINTO.precio_aplicado`.
- En los módulos consumidores: pruebas de aceptación con `ACTIVO`/`ALTA` y rechazo con `INACTIVO` o `BAJA` al registrar; verificar autorización específica cuando corresponda. El almacenamiento comercial ya está definido.
- Pruebas de autorización: `ACTIVO` pertenece a la lista general; `INACTIVO` no; para lista específica se exige pertenencia general y relación; una lista específica vacía no equivale a general.
- Interfaz: pruebas automatizadas de estructura y operaciones conectadas completadas. La comprobación manual de teclado, mensajes accesibles y ancho reducido está completada; la evidencia consta en `../interfaz-medicamentos/tasks.md`, tarea 5.

Las pruebas que escriban en la base deben usar únicamente `gestion_facturacion_medicamentos_test`, comprobar `current_database()` antes de escribir y limpiar exclusivamente registros creados por la prueba, siguiendo la especificación de Farmacias.

### Pruebas pendientes para el esquema aprobado y futuras migraciones

- Añadir pruebas de esquema para obligatoriedad, ausencia de default y aceptación exclusiva de `ALTA`/`BAJA`; comprobar rechazo de `NULL`, otros valores e inserción sin situación explícita. La aplicación a la base de pruebas vacía fue confirmada por el autor; esta documentación no acredita la ejecución de esas pruebas.
- Incluir el dato comercial obligatorio y explícito en futuras fixtures e inserciones de Medicamento para pruebas de integración de Medicamentos, precintos y facturación.
- Para cualquier base existente con datos sin clasificar, planificar por separado su migración y comprobaciones antes de aplicar `NOT NULL`; no inferir la situación comercial de `estado` ni asignar un valor automáticamente.
- Añadir casos que registren un precinto aceptado, cambien después el medicamento a `INACTIVO`/`BAJA` y verifiquen que sigue incluido en la facturación de su periodo. Comprobar rechazo de nuevas lecturas en esos estados y ausencia de traslado al mes siguiente.
- La prueba de integración del catálogo verifica que editar el precio actual no altera `PRECINTO.precio_aplicado`; no implementa ni evalúa el flujo de registro de precintos.

## 5. Decisiones que bloquean partes del plan

- El contrato HTTP está aprobado.
- `anexo` es opcional, informativo y editable en el catálogo. La guía, apéndice C.3, describe su uso actual para información y filtrado en el proceso existente; esto no incorpora filtro por `anexo` en la API ni en la interfaz de este MVP. El posible filtrado se reconsiderará al especificar el flujo que lo necesite. La gestión estructurada de convenios/anexos queda fuera del MVP.
- La pertenencia a la lista general y específica está definida en `docs/guia-contexto-tfm.md`, apéndice A.5, y `docs/modelo-datos/modelo-datos.md`, sección Listas de medicamentos: la lista específica es adicional a la general y una lista específica vacía no equivale a usar la general.
- Autorización y situación comercial son independientes; la aceptación requiere `ACTIVO` y `ALTA` al registrar. La guía canónica vigente v7, A.5 y A.7, y los modelos reflejan la decisión. La columna está aprobada e incorporada al esquema; las migraciones con registros sin clasificar siguen pendientes para cada base afectada.
- El contrato API define el reemplazo completo en PUT, códigos, formatos JSON, orden `id ASC`, cambio posible de `codigo_nacional` y respuestas `400`/`404` para ID inválido/inexistente.
- No se ofrece borrado físico, incluso sin referencias. El esquema protege además las referencias desde `AYUNTAMIENTO_MEDICAMENTO` y `PRECINTO` con `ON DELETE RESTRICT`.
- La administración de autorizaciones específicas queda fuera del catálogo; se definirá aparte y su ubicación sigue abierta.

## 6. Límites

### Registro y facturación previstos

1. Consultar de manera consistente el medicamento, su situación comercial y la modalidad/lista del ayuntamiento durante el registro. Valorar transacción y coordinación con las modificaciones del catálogo para evitar aceptar usando condiciones mezcladas de momentos distintos; la estrategia concreta queda pendiente.
2. Persistir la lectura aceptada como `PRECINTO` con los campos existentes, incluido `precio_aplicado` y el vínculo `entrega_id`; guardar las lecturas no facturables como `INCIDENCIA` con los motivos existentes aplicables. «NO ESTÁ» es una descripción visible, no un estado nuevo ni un motivo SQL añadido.
3. Obtener los precintos válidos del periodo mediante `PRECINTO → ENTREGA_FARMACIA_PERIODO → PERIODO` y sumar sus precios aplicados al facturar. Evitar condiciones sobre el `estado` comercial o de autorización actual que excluyan lecturas ya aceptadas, así como comprobaciones de lista específica actual que invaliden su aceptación previa.
4. El registro válido conserva el resultado de elegibilidad sin requerir por ello un booleano adicional. Para BAJA elegible, mantener elección explícita aceptar/apartar sin marca histórica adicional en el MVP. Reproducir las condiciones históricas observadas queda como mejora futura; no bloquea implementar el flujo aprobado de BAJA.

Quedan pendientes las migraciones de bases con datos sin clasificar y la implementación del flujo consumidor de `BAJA`. La evidencia histórica adicional queda como mejora futura sin marca BAJA en el MVP ni bloqueo de implementación. Las pruebas previstas incluyen cambios de estado/lista posteriores, periodo mensual, mensajes de incidencia y preservación de precios; no se han ejecutado en esta revisión.

Esta revisión es documental: no ejecuta cambios de esquema ni implementación. No añade dependencias, tecnologías ni histórico de versiones o precios. Las reglas de registro/facturación anteriores son dependencias funcionales para los módulos consumidores. Se conserva la información histórica existente y no se ofrece borrado físico del catálogo.
