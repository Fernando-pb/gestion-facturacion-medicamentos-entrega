# Tareas: Medicamentos

La API y la interfaz del catálogo están implementadas y verificadas automáticamente. La revisión manual de la interfaz descrita en `../interfaz-medicamentos/tasks.md`, tarea 5, está completada. Las migraciones con datos sin clasificar y la definición de autorizaciones específicas siguen pendientes.

## 1. Concretar la presentación del catálogo confirmado

- [x] **Objetivo:** concretar la presentación de los campos y el formulario para crear, listar, consultar y editar medicamentos.
- **Fuentes:** `docs/specs/medicamentos/spec.md`, modelo conceptual, modelo lógico y esquema actual.
- **Confirmado por el usuario:** crear, listar, consultar y editar, incluidos `estado` y `situacion_comercial`; sin borrado físico. La columna comercial está aprobada e incluida en `db/schema.sql` (guía canónica vigente v7, A.7 y A.7.1).
- **Presentación inicial:** interfaz concreta documentada en `docs/specs/interfaz-medicamentos/spec.md`; precio como cadena decimal, `TD` solo lectura y `anexo` opcional editable sin filtro.
- **Comprobación:** campos y presentación están definidos en las especificaciones; la revisión visual manual está registrada en `../interfaz-medicamentos/tasks.md`, tarea 5.

## 2. Registrar el contrato HTTP aprobado

- [x] **Decidido por el usuario:** POST crea con `201` y devuelve el medicamento JSON con `id`; GET de colección devuelve `200` y array JSON, vacío como `[]`, ordenado por `id ASC`; GET por ID devuelve `200`, `400` para ID inválido y `404` si no existe; PUT reemplaza el registro completo, devuelve `200`, conserva `id` y permite cambiar `codigo_nacional`. Datos inválidos: `400`; código nacional duplicado en POST/PUT: `409`; errores funcionales: JSON con `error`, sin textos literales fijados. No hay PATCH ni DELETE.
- **Alcance de esta decisión:** solo contrato documentado; no representa implementación ni pruebas ejecutadas.
- **Fuente:** decisión del usuario registrada en `docs/specs/medicamentos/spec.md`.

## 2a. Registrar respuesta de PUT ante IDs no resolubles

- [x] **Decidido por el usuario:** `PUT /medicamentos/:id` responde `400 Bad Request` para ID inválido y `404 Not Found` para ID válido sin medicamento correspondiente.
- **Dependencia:** tarea 1.
- **Comprobación documental:** decisión reflejada en `spec.md` y `plan.md`; no acredita implementación ni pruebas.

## 2b. Registrar presencia y tratamiento de campos en POST/PUT

- [x] **Decidido por el usuario:** POST exige los campos obligatorios del modelo; los cinco opcionales pueden omitirse o ser `null` y son texto cuando tienen valor. PUT exige todos los campos editables, incluidos los opcionales, que deben ser texto o `null`; si falta cualquier campo editable, responde `400`. `id` no va en el cuerpo y se toma de la ruta en PUT. Se rechazan propiedades desconocidas.
- **Comprobación documental:** decisión reflejada en `spec.md` y `plan.md`; no acredita implementación ni pruebas.

## 2c. Registrar valor admitido de `tipo_facturacion` en los cuerpos

- [x] **Decidido por el usuario:** en el MVP POST y PUT incluyen `tipo_facturacion`; el cliente envía `TD` y la API exige y valida ese único valor. Esta decisión no define tipos ni reglas futuros para vacunas, leche u otros productos.
- **Comprobación documental:** decisión reflejada en `spec.md` y `plan.md`; no acredita implementación ni pruebas.

## 2d. Registrar normalización de texto en POST/PUT

- [x] **Decidido por el usuario:** recortar espacios extremos en campos de texto; rechazar obligatorios vacíos tras el recorte y convertir opcionales vacíos o de solo espacios a `null`; preservar `codigo_nacional` como texto con ceros iniciales y capitalización; validar exactamente `estado`, `situacion_comercial` y `tipo_facturacion`, sin cambio automático de capitalización.
- **Comprobación documental:** regla reflejada en `spec.md` y `plan.md`; no acredita implementación ni pruebas.

## 2e. Registrar representación y precisión decimal de `precio` en JSON

- [x] **Decidido por el usuario:** precio como cadena decimal en peticiones y respuestas JSON; aceptar `0`–`9999999999.99`, con cero, uno o dos decimales y punto decimal; rechazar negativos, valores mayores y más de dos decimales, sin redondeo silencioso. PostgreSQL lo almacena en `NUMERIC(12,2)`.
- **Comprobación documental:** decisión reflejada en `spec.md` y `plan.md`; no acredita implementación ni pruebas.

## 2f. Registrar alcance del filtrado por `anexo` en el catálogo

- [x] **Decidido por el usuario:** `anexo` es opcional, informativo y editable. No habrá filtro por `anexo` en la API ni en la interfaz del MVP; se reconsiderará al especificar el flujo que lo necesite. El uso actual descrito por la guía corresponde al proceso existente.
- **Comprobación documental:** decisión reflejada en `spec.md` y `plan.md`; no acredita implementación.

## 3. Decidir el alcance de autorizaciones específicas

- [ ] **Objetivo:** ubicar el mantenimiento de `AYUNTAMIENTO_MEDICAMENTO` y determinar las operaciones permitidas.
- **Fuentes:** reglas de listas general/específica y tabla de relación existente.
- **Resuelto:** la gestión queda fuera del catálogo y se definirá aparte. Un medicamento inactivo no autoriza nuevas lecturas aunque la relación permanezca, sin invalidar las aceptadas antes (`modelo-datos.md`, Listas de medicamentos; guía canónica vigente v7, A.5 y A.7.1). **Pendiente:** ubicación y operaciones del flujo separado.
- **Comprobación:** decisión documentada; hasta entonces, no implementar esa gestión.

## 3a. Verificar restricciones del almacenamiento aprobado

- [x] **Objetivo:** verificar mediante pruebas las restricciones de `situacion_comercial` ya aprobadas.
- **Confirmado por el usuario:** `TEXT NOT NULL`, sin `DEFAULT`, CHECK para `ALTA`/`BAJA`, incluida en `db/schema.sql` y aplicada únicamente a `gestion_facturacion_medicamentos_test` con cero medicamentos. Desarrollo no se modificó y otras instalaciones no se consideran migradas.
- **Regla vigente:** se comprueban `ACTIVO` y `ALTA` al registrar; `INACTIVO` o `BAJA` impiden nuevas aceptaciones sin invalidar las anteriores (guía canónica vigente v7, A.5 y A.7).
- **Pendiente:** cualquier migración con datos sin clasificar, sin inferir ni asignar valores automáticamente; requiere tratar cada base afectada por separado.
- **Comprobación:** la prueba de integración verifica obligatoriedad, ausencia de default y rechazo de valores distintos de `ALTA`/`BAJA` en la base de pruebas exacta.

## 4. Implementar el catálogo API

- [x] **Objetivo:** implementar únicamente el contrato aprobado, con validación y consultas parametrizadas.
- **Dependencias:** tareas 1, 2, 2a, 2b, 2c, 2d, 2e y 2f.
- **Comprobación:** pruebas unitarias/de API e integración acordes a comportamiento real y uso seguro de la base de pruebas.

## 5. Implementar la interfaz de Medicamentos

- [x] **Objetivo:** proporcionar mantenimiento de catálogo coherente con las interfaces existentes.
- **Dependencias:** presentación concretada en tarea 1 y contrato documentado en tareas 2 y 2a.
- **Comprobación:** pruebas automatizadas de carga, vacío, error y éxito y renderizado seguro. La navegación con Tab, el foco visible, Narrador, alta/edición manual y adaptación a 1280 px/375 px se comprobaron; el detalle está en `../interfaz-medicamentos/tasks.md`, tarea 5.

## 6. Verificar precio vigente e histórico

- [x] **Objetivo:** comprobar que editar `MEDICAMENTO.precio` no altera `PRECINTO.precio_aplicado` ya registrado.
- **Dependencia:** implementación del catálogo y disponibilidad del flujo de precintos o un caso de integración acotado.
- **Comprobación:** prueba de integración crea un precinto de prueba, actualiza el medicamento y confirma que su `precio_aplicado` persistido no cambia.

## Decisiones para revisión

- [ ] Verificar que un precinto aceptado se factura en su periodo aunque después cambie el estado del medicamento o su autorización específica; comprobar que las nuevas lecturas inválidas generan incidencia.
- [ ] Implementar en el módulo consumidor el flujo BAJA conforme a Entregas: elección explícita aceptar/apartar y motivo aprobado, sin marca histórica adicional en el MVP. Evidencia adicional como mejora futura, sin bloquear implementación.

- La API y la interfaz se implementaron y verificaron; la presentación inicial muestra el precio como cadena decimal, `TD` solo lectura y `anexo` editable sin filtro. La revisión manual está documentada en `../interfaz-medicamentos/tasks.md`, tarea 5. El usuario confirmó que «Grupo ATC» no aparecía; el listado está vacío tras retirar los registros ficticios. La modificación previa retiró la columna rotulada «Grupo terapéutico»; `gtatc` permanece en el formulario y la API.
- La autorización y la situación comercial permanecen separadas en el almacenamiento y la edición del catálogo; la elegibilidad de lecturas corresponde al módulo consumidor.
- Ubicar aparte la administración de autorizaciones por ayuntamiento y planificar migraciones con datos sin clasificar.
