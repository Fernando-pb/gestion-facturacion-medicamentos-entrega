# Modelo lógico PostgreSQL

## Revisión documental para entrega — 18 de octubre de 2026

Contraste con el esquema actual, sin migraciones ni consultas a bases. Diagrama vigente [v2 PNG](modelo-entidad-relacion-v2-2026-10-18.png), [SVG](modelo-entidad-relacion-v2-2026-10-18.svg) y [DOT editable](modelo-entidad-relacion-v2-2026-10-18.dot); [evolución y distinción SQL/servicios](revision-documental-v2-2026-10-18.md). La fecha es de revisión documental. Los apartados históricos conservan estados anteriores; para alcance actual véanse README y contratos vigentes.

## Regla vigente de lecturas y precios — v26, 12 de octubre de 2026

Cada precinto conserva referencia y aplicado propios. Corregir por ID afecta solo esa fila, nunca maestro ni lecturas del mismo código/farmacia/periodo. Nuevas lecturas toman el maestro vigente; guardadas no cambian al editarlo. SIN_FACTURAR (sin cabecera TD), REVISION y REABIERTA sin cobros permiten añadir/corregir, sin preparar revisión. EMITIDA bloquea hasta reapertura controlada; cualquier cobro bloquea escritura y reapertura. El permiso es del Ayuntamiento/periodo/TD, no de una etiqueta de entrega pendiente ni del historial. B permanece congelado tras emisión; facturas originales se conservan hasta reemisión conjunta.

005 rellena solo referencias NULL con el aplicado conservado al migrar, sin modificar aplicado ni sobrescribir referencias existentes; cobertura y restricciones verificadas antes de activar corrección. Para históricos no garantiza el precio original del catálogo. Nuevas lecturas capturan ambos precios; corregir conserva referencia. No existe auditoría de valores intermedios, autor/fecha/motivo de cada corrección: los dos precios no equivalen a ese historial. Reapertura sí guarda fecha automática y motivo obligatorio.

Las adendas fechadas de 8 de octubre se conservan como historial de implementación; sus pendientes, bloqueo provisional por cabecera y liberación antigua de claves no son reglas vigentes. Para contratos actuales consultar Entregas §17–§18 y su apartado de corrección individual, y Facturación municipal §13–§15.

## 1. Objetivo y alcance

Este documento traduce a un modelo lógico PostgreSQL las entidades, campos, relaciones y reglas definidas en [modelo-datos.md](modelo-datos.md).

El modelo conceptual continúa siendo la fuente de las reglas de negocio. Este documento concreta nombres de tablas y columnas, tipos PostgreSQL, nulabilidad, claves y restricciones, pero no contiene sentencias `CREATE TABLE` ni sustituye al esquema actual `db/schema.sql`.

El alcance corresponde al MVP. No se añaden entidades ni campos distintos de los definidos en el modelo conceptual.

## 2. Convenciones generales

### 2.1 Nombres

- Tablas y columnas en `snake_case`.
- Tablas en singular.
- Clave primaria denominada `id`.
- Claves foráneas denominadas `<entidad>_id`, respetando los nombres ya definidos en el modelo conceptual.
- Los nombres de restricciones deberán ser descriptivos cuando se escriba el esquema SQL.

### 2.2 Identificadores

- Todas las claves primarias usan `INTEGER`.
- Se generan mediante `GENERATED ALWAYS AS IDENTITY`.
- Las PK no utilizan UUID ni BIGINT. `operacion_lectura.clave` sí usa UUID como clave técnica de idempotencia, distinta de su PK entera.

### 2.3 Texto y códigos

- Se usa `TEXT` mientras no exista una longitud máxima funcional explícita.
- CIF/NIF, SOE, códigos nacionales, códigos postales, teléfonos y componentes bancarios se tratan como texto, no como números, para conservar ceros iniciales y formatos significativos.
- Los valores obligatorios deben validarse también en la aplicación para evitar cadenas vacías o compuestas solo por espacios.

### 2.4 Importes y porcentajes

- Los importes monetarios usan `NUMERIC(12,2)`.
- No se utilizan `FLOAT` ni `REAL` para valores económicos.
- Los porcentajes usan `NUMERIC(7,4)` y se almacenan en puntos porcentuales: 2,7 % se representa como `2.7000` y 21 % como `21.0000`.
- Todos los cálculos monetarios intermedios y finales se redondean a dos decimales.
- Para redondear se examina el tercer decimal: si está entre 0 y 4, se mantiene el segundo decimal; si está entre 5 y 9, se incrementa el segundo decimal en una unidad.
- Ejemplos: `10,124` se redondea a `10,12`; `10,125`, a `10,13`; y `10,126`, a `10,13`.
- Los importes históricos se almacenan ya redondeados.

La factura de COMISION aplica el redondeo en esta secuencia:

1. Calcular `importe_comision`.
2. Redondear `importe_comision` a dos decimales.
3. Calcular el IVA sobre la comisión ya redondeada.
4. Redondear `importe_iva` a dos decimales.
5. Sumar `importe_comision` e `importe_iva`.
6. Redondear `importe_total` a dos decimales.

### 2.5 Fechas

- Las fechas de negocio sin hora usan `DATE`.
- Los eventos que requieren un instante exacto usan `TIMESTAMP WITH TIME ZONE`.
- `FACTURACION.fecha_factura`, `COBRO.fecha_cobro`, `PAGO_FARMACIAS.fecha_pago`, `CONFIGURACION_FACTURACION.fecha_inicio` y `fecha_fin` usan `DATE`.
- `REAPERTURA_FACTURACION.fecha_reapertura` usa `TIMESTAMP WITH TIME ZONE`.
- No se añaden `created_at` ni `updated_at` de forma general.

### 2.6 Valores categóricos

- Se representan mediante `TEXT` y restricciones `CHECK`.
- No se utilizan tipos PostgreSQL `ENUM` en el MVP.
- La ampliación futura de valores se realizará modificando de forma explícita la restricción correspondiente.

### 2.7 Claves foráneas y borrado

- Política general: `ON DELETE RESTRICT` y `ON UPDATE NO ACTION`.
- Excepción: las dos FK compuestas de OPERACION_LECTURA a PRECINTO/INCIDENCIA usan ON DELETE CASCADE. La API retira/purga el recibo antes de borrar una lectura; la cascada por sí sola no garantiza conservar la clave retirada.
- Se prioriza impedir el borrado accidental de datos relacionados y preservar el histórico financiero.
- Los identificadores internos son estables y no deben actualizarse.

### 2.8 Nulabilidad y valores por defecto

- Las claves primarias, claves foráneas estructurales y datos expresamente obligatorios son `NOT NULL`.
- Un campo opcional admite `NULL`; no se sustituye la ausencia de dato por una cadena vacía o un cero.
- Solo se asignan valores por defecto cuando el modelo define un valor automático o existe un comportamiento inequívoco.
- `NULL` y cero conservan significados diferentes en los datos informados de una entrega.

## 3. Resumen de tablas

| Tabla | Finalidad |
|---|---|
| `ayuntamiento` | Datos del ayuntamiento y modalidad de lista de medicamentos. |
| `farmacia` | Datos actuales de la farmacia y su asignación municipal actual, que puede estar ausente. |
| `medicamento` | Catálogo actual de medicamentos, precios y clasificación. |
| `ayuntamiento_medicamento` | Autorización específica de medicamentos por ayuntamiento. |
| `periodo` | Mes y año de operación. |
| `entrega_farmacia_periodo` | Entrega de una farmacia en un periodo. |
| `precinto` | Precinto válido, medicamento, precio aplicado y posición. |
| `incidencia` | Lectura anómala que no constituye un precinto válido. |
| `operacion_lectura` | Recibo por entrega/UUID o clave retirada sin contenido. |
| `configuracion_facturacion` | Porcentajes de comisión e IVA vigentes por fechas. |
| `configuracion_documentos` | Configuración visual actual de documentos. |
| `facturacion` | Proceso de facturación de un ayuntamiento, periodo y tipo. |
| `participacion_facturacion` | Entrega, snapshot B e importe que contribuyen a la facturación; implementada en `db/schema.sql`. |
| `factura` | Documento económico de PRECINTOS o COMISION. |
| `cobro` | Cobro completo de una factura. |
| `reapertura_facturacion` | Registro de cada reapertura y su motivo. |
| `pago_farmacias` | Pago conjunto a farmacias derivado de una facturación. |
| `detalle_pago_farmacia` | Snapshot histórico de cada farmacia incluida en un pago. |

## 4. Definición de tablas

### 4.1 `ayuntamiento`

| Campo | Tipo PostgreSQL | Obligatorio | Default | Descripción |
|---|---|---:|---|---|
| `id` | `INTEGER` | Sí | `GENERATED ALWAYS AS IDENTITY` | Identificador interno estable. |
| `cif` | `TEXT` | Sí | — | Identificador fiscal. |
| `denominacion` | `TEXT` | Sí | — | Nombre oficial. |
| `direccion` | `TEXT` | Sí | — | Dirección postal. |
| `codigo_postal` | `TEXT` | Sí | — | Código postal. |
| `localidad` | `TEXT` | Sí | — | Localidad. |
| `provincia` | `TEXT` | Sí | — | Provincia. |
| `telefono` | `TEXT` | No | — | Teléfono de contacto. |
| `movil` | `TEXT` | No | — | Teléfono móvil. |
| `persona_responsable` | `TEXT` | No | — | Persona responsable. |
| `persona_contacto` | `TEXT` | No | — | Persona de contacto. |
| `alcalde` | `TEXT` | No | — | Nombre del alcalde. |
| `estado` | `TEXT` | Sí | — | Situación actual. |
| `tipo_lista_medicamentos` | `TEXT` | Sí | — | Modalidad de lista de medicamentos. |

- **PK:** `id`.
- **FK:** ninguna.
- **UNIQUE:** `cif`.
- **CHECK:** `estado` en `ACTIVO`, `INACTIVO`; `tipo_lista_medicamentos` en `GENERAL`, `ESPECIFICA`.
- **Decisiones relevantes:** el CIF puede corregirse sin cambiar `id`; los registros con histórico relacionado no se eliminan físicamente.

### 4.2 `farmacia`

| Campo | Tipo PostgreSQL | Obligatorio | Default | Descripción |
|---|---|---:|---|---|
| `id` | `INTEGER` | Sí | `GENERATED ALWAYS AS IDENTITY` | Identificador interno. |
| `soe` | `TEXT` | Sí | — | Identificador estable del establecimiento. |
| `cif_nif` | `TEXT` | Sí | — | Identificador fiscal actual. |
| `denominacion` | `TEXT` | Sí | — | Denominación actual. |
| `direccion` | `TEXT` | Sí | — | Dirección postal. |
| `codigo_postal` | `TEXT` | Sí | — | Código postal. |
| `localidad` | `TEXT` | Sí | — | Localidad. |
| `provincia` | `TEXT` | Sí | — | Provincia. |
| `telefono` | `TEXT` | No | — | Teléfono de contacto. |
| `ayuntamiento_id` | `INTEGER` | No | — | Ayuntamiento actual al que está asignada; `NULL` significa sin Ayuntamiento en el modelo objetivo. |
| `pais_control_iban` | `TEXT` | No | — | País y control del IBAN actual. |
| `entidad_bancaria` | `TEXT` | No | — | Entidad bancaria actual. |
| `sucursal_bancaria` | `TEXT` | No | — | Sucursal bancaria actual. |
| `digito_control_bancario` | `TEXT` | No | — | Dígitos de control actuales. |
| `cuenta_bancaria` | `TEXT` | No | — | Cuenta bancaria actual. |

- **PK:** `id`.
- **FK:** `ayuntamiento_id` → `ayuntamiento.id`, opcional, con la política general.
- **UNIQUE:** `soe`.
- **CHECK:** no se define estado ACTIVA/INACTIVA.
- **Decisiones relevantes:** una farmacia puede estar asignada a cero o un ayuntamiento. Se asigna, reasigna o desasigna solo sin entregas ni precintos; no se exige control independiente de facturación. SOE permanece estable como dato de negocio, pero las relaciones usan `farmacia.id`. Los datos bancarios pueden estar incompletos durante el mantenimiento, pero deben validarse antes de preparar un pago.
- **Alcance de identidad:** el catálogo local representa farmacias actuales, se actualiza manualmente con datos ficticios y no gestiona titulares históricos ni traspasos. No se integra con la aplicación corporativa ni se resuelven automáticamente titularidades anteriores. Un snapshot conserva lo capturado, pero no garantiza que el catálogo estuviera actualizado.

**Estado del esquema:** `db/schema.sql` permite NULL en `farmacia.ayuntamiento_id` conservando FK/índice. Para instalaciones existentes revisar `db/README.md`; esta revisión no verifica bases. Asignación municipal y registro de entregas/lecturas ya comparten bloqueo y revalidación de asociación; la FK garantiza existencia, no pertenencia municipal.

### 4.3 `medicamento`

| Campo | Tipo PostgreSQL | Obligatorio | Default | Descripción |
|---|---|---:|---|---|
| `id` | `INTEGER` | Sí | `GENERATED ALWAYS AS IDENTITY` | Identificador interno. |
| `codigo_nacional` | `TEXT` | Sí | — | Código nacional. |
| `descripcion` | `TEXT` | Sí | — | Descripción. |
| `precio` | `NUMERIC(12,2)` | Sí | — | Precio actual. |
| `estado` | `TEXT` | Sí | — | Pertenencia/autorización en la lista general (`ACTIVO`/`INACTIVO`); no representa situación comercial. |
| `situacion_comercial` | `TEXT` | Sí (`NOT NULL`) | Sin `DEFAULT` | Situación comercial independiente: `ALTA` o `BAJA`. |
| `tipo_facturacion` | `TEXT` | Sí | — | Tipo de convenio o facturación. |
| `grupo_terapeutico` | `TEXT` | No | — | Grupo terapéutico. |
| `codigo_laboratorio` | `TEXT` | No | — | Código del laboratorio. |
| `gtatc` | `TEXT` | No | — | Clasificación GTATC. |
| `nombre_grupo` | `TEXT` | No | — | Nombre del grupo. |
| `anexo` | `TEXT` | No | — | Dato opcional usado para información y filtrado; no es una entidad estructurada de convenio/anexo. |

- **PK:** `id`.
- **FK:** ninguna.
- **UNIQUE:** `codigo_nacional`.
- **CHECK:** `precio >= 0`; `estado` en `ACTIVO`, `INACTIVO`; `ck_medicamento_situacion_comercial`: `CHECK (situacion_comercial IN ('ALTA', 'BAJA'))`; `tipo_facturacion` en `TD` para el MVP.
- **Decisiones relevantes:** `precio` es el precio vigente; el precio histórico usado se conserva en `precinto.precio_aplicado`.
- **Separación de conceptos:** estado representa autorización general y situacion_comercial ALTA/BAJA. La regla posterior de Entregas exige ACTIVO/autorización y, para BAJA elegible, elección explícita admitir/apartar. INACTIVO nunca admite nuevas lecturas. Cambios posteriores no invalidan las aceptadas. La columna y sus CHECK figuran en `db/schema.sql`; esta revisión no verifica instalaciones.
- **`anexo`:** texto opcional usado para información y filtrado. La gestión estructurada de convenios/anexos queda fuera del MVP; el modo concreto de filtrado no está fijado.

#### Estado de aplicación del almacenamiento comercial

Según la confirmación del autor, la columna y su CHECK se aplicaron a `gestion_facturacion_medicamentos_test`, cuya tabla `medicamento` estaba vacía. No fue necesario clasificar registros existentes. La base de desarrollo no se modificó; no se afirma que otras instalaciones estén migradas.

`estado` y su restricción se mantienen. En instalaciones con medicamentos existentes, la migración deberá determinar explícitamente la situación comercial de cada fila antes de imponer `NOT NULL`; no deducirla de `estado` ni asignar `ALTA` automáticamente. No se requiere otra tabla ni un indicador duplicado de facturabilidad para conservar el resultado de aceptación.

La columna y su CHECK protegen valores comerciales, pero no garantizan elegibilidad entre tablas. Entregas ya comprueba las condiciones al registrar, bajo bloqueos, y solicita decisión ante BAJA elegible. Facturación usa los precintos aceptados del periodo sin reevaluar estados ni listas actuales.

### 4.4 `ayuntamiento_medicamento`

| Campo | Tipo PostgreSQL | Obligatorio | Default | Descripción |
|---|---|---:|---|---|
| `id` | `INTEGER` | Sí | `GENERATED ALWAYS AS IDENTITY` | Identificador interno. |
| `ayuntamiento_id` | `INTEGER` | Sí | — | Ayuntamiento que autoriza. |
| `medicamento_id` | `INTEGER` | Sí | — | Medicamento autorizado. |

- **PK:** `id`.
- **FK:** `ayuntamiento_id` → `ayuntamiento.id`; `medicamento_id` → `medicamento.id`.
- **UNIQUE:** `(ayuntamiento_id, medicamento_id)`.
- **CHECK:** ninguno adicional.
- **Decisiones relevantes:** solo representa autorización; no duplica datos del medicamento.

### 4.5 `periodo`

| Campo | Tipo PostgreSQL | Obligatorio | Default | Descripción |
|---|---|---:|---|---|
| `id` | `INTEGER` | Sí | `GENERATED ALWAYS AS IDENTITY` | Identificador interno. |
| `mes` | `SMALLINT` | Sí | — | Mes de operación. |
| `anio` | `INTEGER` | Sí | — | Año de operación. |

- **PK:** `id`.
- **FK:** ninguna.
- **UNIQUE:** `(mes, anio)`.
- **CHECK:** `mes BETWEEN 1 AND 12`.
- **Decisiones relevantes:** no almacena estado ABIERTO/CERRADO.

### 4.6 `entrega_farmacia_periodo`

| Campo | Tipo PostgreSQL | Obligatorio | Default | Descripción |
|---|---|---:|---|---|
| `id` | `INTEGER` | Sí | `GENERATED ALWAYS AS IDENTITY` | Identificador interno. |
| `farmacia_id` | `INTEGER` | Sí | — | Farmacia de la entrega. |
| `periodo_id` | `INTEGER` | Sí | — | Periodo de la entrega. |
| `denominacion_farmacia` | `TEXT` | Sí | — | Snapshot de la denominación actual al crear la entrega. |
| `cif_nif_farmacia` | `TEXT` | Sí | — | Snapshot del CIF/NIF actual al crear la entrega. |
| `precintos_informados` | `INTEGER` | No | — | Cantidad informada; `NULL` significa no informada. |
| `importe_informado` | `NUMERIC(12,2)` | No | — | Importe informado; `NULL` significa no informado. |

- **PK:** `id`.
- **FK:** `farmacia_id` → `farmacia.id`; `periodo_id` → `periodo.id`.
- **UNIQUE:** `(farmacia_id, periodo_id)`.
- **Snapshot:** denominación y CIF/NIF se copian al crear la entrega y no se sustituyen al recuperarla o editar el catálogo. Representan los datos registrados para quien entrega (A), no necesariamente al titular que participará en la factura municipal (B) o recibirá la liquidación (C).
- **CHECK:** `precintos_informados >= 0` cuando no sea nulo; `importe_informado >= 0` cuando no sea nulo.
- **Decisiones relevantes:** cero representa un dato informado con valor cero. Las diferencias con los totales calculados no bloquean automáticamente la facturación.

### 4.7 `precinto`

| Campo | Tipo PostgreSQL | Obligatorio | Default | Descripción |
|---|---|---:|---|---|
| `id` | `INTEGER` | Sí | `GENERATED ALWAYS AS IDENTITY` | Identificador interno. |
| `entrega_id` | `INTEGER` | Sí | — | Entrega a la que pertenece. |
| `numero_paquete` | `INTEGER` | Sí | — | Número de paquete dentro de la entrega. |
| `posicion_paquete` | `SMALLINT` | Sí | — | Posición dentro del paquete. |
| `codigo_barras_original` | `TEXT` | Sí | — | Contenido original leído o introducido. |
| `codigo_nacional` | `TEXT` | Sí | — | Código nacional obtenido. |
| `medicamento_id` | `INTEGER` | Sí | — | Medicamento identificado. |
| `precio_aplicado` | `NUMERIC(12,2)` | Sí | — | Precio histórico aplicado. |
| `precio_referencia` | `NUMERIC(12,2)` | Sí | — | Referencia conservada al admitir; registros anteriores a 005 conservan el aplicado al migrar, sin atribuirlo al catálogo original. Inalterable en la API de corrección. |

- **PK:** `id`.
- **FK:** `entrega_id` → `entrega_farmacia_periodo.id`; `medicamento_id` → `medicamento.id`.
- **UNIQUE:** `(entrega_id, numero_paquete, posicion_paquete)` y `(id, entrega_id)`; esta última soporta la FK compuesta de operación de lectura.
- **CHECK:** `numero_paquete >= 1`; `posicion_paquete BETWEEN 1 AND 15`; `precio_aplicado >= 0`; `precio_referencia >= 0`.
- **Decisiones relevantes:** cada fila es un precinto válido y equivale a una receta. El código nacional puede repetirse. PAQUETE no es una tabla independiente.
- **Aceptación histórica:** comprobar ACTIVO y autorización; BAJA elegible requiere admisión explícita. La fila aceptada mantiene su facturabilidad ante cambios posteriores de estados/listas y se factura en el periodo vinculado mediante `entrega_id` → `entrega_farmacia_periodo.periodo_id`, sin trasladarla a otros meses ni reevaluar condiciones actuales.
- **Evidencia disponible:** la fila válida conserva el resultado, la lectura, la referencia al medicamento, el precio aplicado y la entrega/periodo. No guarda el instante de evaluación ni los estados, modalidad y pertenencia específica observados; reconstruir exactamente esas condiciones requeriría evidencia histórica adicional cuya necesidad y diseño no están aprobados.

### 4.8 `incidencia`

| Campo | Tipo PostgreSQL | Obligatorio | Default | Descripción |
|---|---|---:|---|---|
| `id` | `INTEGER` | Sí | `GENERATED ALWAYS AS IDENTITY` | Identificador interno. |
| `entrega_id` | `INTEGER` | Sí | — | Entrega en la que se produjo. |
| `codigo_barras_original` | `TEXT` | Sí | — | Contenido original leído o introducido. |
| `codigo_nacional` | `TEXT` | No | — | Código nacional, si pudo identificarse. |
| `motivo` | `TEXT` | Sí | — | Motivo de la incidencia. |
| `observaciones` | `TEXT` | No | — | Información adicional. |

- **PK:** `id`.
- **FK:** `entrega_id` → `entrega_farmacia_periodo.id`.
- **UNIQUE:** `(id, entrega_id)`, soporte de la FK compuesta de operación de lectura.
- **CHECK:** `motivo` en `MEDICAMENTO_DESCONOCIDO`, `MEDICAMENTO_NO_AUTORIZADO`, `MEDICAMENTO_INACTIVO`, `BAJA_COMERCIAL_RECHAZADA_USUARIO`.
- **Decisiones relevantes:** no tiene medicamento asociado mediante FK, precio ni posición de paquete, y no entra en facturación.
- «NO ESTÁ» describe ausencia de autorización, no un estado de medicamento. Apartar BAJA elegible usa el motivo específico implementado.

### 4.8.1 `operacion_lectura` — definición actual

| Campo | Tipo PostgreSQL | Obligatorio | Default |
|---|---|---|---|
| `id` | INTEGER | Sí, PK | GENERATED ALWAYS AS IDENTITY |
| `entrega_id` | INTEGER | Sí, FK | — |
| `clave` | UUID | Sí | — |
| `solicitud` | JSONB | No | — |
| `retirada` | BOOLEAN | Sí | FALSE |
| `precinto_id` | INTEGER | No, FK | — |
| `incidencia_id` | INTEGER | No, FK | — |

UNIQUE: `(entrega_id, clave)`, `precinto_id` e `incidencia_id` por separado. FK directa a entrega con RESTRICT y FK compuestas `(precinto_id, entrega_id)` → PRECINTO `(id, entrega_id)` y `(incidencia_id, entrega_id)` → INCIDENCIA `(id, entrega_id)` con CASCADE. Las tablas destino tienen UNIQUE de esa pareja.

CHECK: activa (`NOT retirada`) exige solicitud no nula y exactamente un destino; retirada exige solicitud y ambos destinos NULL. Si existe solicitud, debe ser objeto JSON. Guardado atómico, igualdad del reenvío y retirada/purga previa al borrado corresponden al servicio. No es historial del contenido eliminado; las lecturas anteriores pueden no tener recibo. Esta definición actual prevalece sobre el estado anterior a 004 conservado en las adendas históricas.

### 4.9 `configuracion_facturacion`

| Campo | Tipo PostgreSQL | Obligatorio | Default | Descripción |
|---|---|---:|---|---|
| `id` | `INTEGER` | Sí | `GENERATED ALWAYS AS IDENTITY` | Identificador interno. |
| `porcentaje_comision` | `NUMERIC(7,4)` | Sí | — | Comisión en puntos porcentuales. |
| `porcentaje_iva` | `NUMERIC(7,4)` | Sí | — | IVA en puntos porcentuales. |
| `fecha_inicio` | `DATE` | Sí | — | Inicio de vigencia. |
| `fecha_fin` | `DATE` | No | — | Fin inclusivo de vigencia; `NULL` indica vigencia abierta. |

- **PK:** `id`.
- **FK:** ninguna.
- **UNIQUE:** ninguna definida por el modelo conceptual.
- **CHECK:** porcentajes entre 0 y 100; `fecha_fin` nula o `fecha_fin >= fecha_inicio`.
- **Decisiones relevantes:** no se sobrescriben configuraciones anteriores. `fecha_fin` es inclusiva: una configuración es aplicable cuando `fecha_inicio <= fecha_factura` y, además, `fecha_fin` es `NULL` o `fecha_factura <= fecha_fin`. Por ejemplo, una vigencia del 01/01/2026 al 31/12/2026 sigue siendo aplicable el 31/12/2026. La ausencia de solapamientos requiere validación entre filas y no un `CHECK` simple.
- Administración implementada: configuracion-facturacion/spec. POST/PUT serializan la validación de solapamientos y se coordinan con el SHARE de emisión. Configuración no utilizada corregible; utilizada conserva tasas/inicio y admite cierre solo si cubre todas las fechas facturadas. No cambia esquema ni facturas existentes.

### 4.10 `configuracion_documentos`

| Campo | Tipo PostgreSQL | Obligatorio | Default | Descripción |
|---|---|---:|---|---|
| `id` | `INTEGER` | Sí | `GENERATED ALWAYS AS IDENTITY` | Identificador interno. |
| `logo_personalizado` | `TEXT` | No | — | PNG/JPEG como data URL validada por la API; no ruta arbitraria. |
| `nombre_presidente` | `TEXT` | No | — | Nombre actual del presidente del Colegio emisor; se copia a `facturacion.nombre_presidente_historico` en la primera emisión. |
| `firma` | `TEXT` | No | — | Referencia a la firma. |
| `mostrar_firma` | `BOOLEAN` | Sí | `FALSE` | Indica si la firma debe mostrarse. |
| `datos_emisor` | `JSONB` | No | — | Configuración actual del pie: denominación, CIF, dirección y contacto opcional. |

- **PK:** `id`.
- **FK:** ninguna.
- **UNIQUE documental:** índice uq_configuracion_documentos_unica sobre constante true limita CONFIGURACION_DOCUMENTOS a una fila actual (documentos-facturacion/spec). No afecta a otras tablas.
- **CHECK:** si `mostrar_firma` es verdadero, `firma` no debe ser nula.
- **Decisiones relevantes:** representa la configuración actual, sin histórico de vigencia y sin relación directa con FACTURA. Cambiar o dejar vacío `nombre_presidente` no modifica ni completa retrospectivamente el presidente histórico ya capturado, tampoco al reemitir. Los documentos utilizan `facturacion.nombre_presidente_historico`; si falta, el servicio devuelve una advertencia y las plantillas muestran «No consta el presidente histórico».

### 4.11 `facturacion`

| Campo | Tipo PostgreSQL | Obligatorio | Default | Descripción |
|---|---|---:|---|---|
| `id` | `INTEGER` | Sí | `GENERATED ALWAYS AS IDENTITY` | Identificador interno. |
| `ayuntamiento_id` | `INTEGER` | Sí | — | Ayuntamiento facturado. |
| `periodo_id` | `INTEGER` | Sí | — | Periodo facturado. |
| `tipo_facturacion` | `TEXT` | Sí | — | Tipo de convenio o facturación. |
| `fecha_factura` | `DATE` | Sí | — | Último día del periodo. |
| `nombre_presidente_historico` | `TEXT` | No | — | Presidente del Colegio emisor copiado desde la configuración actual en primera emisión y preservado en reemisiones. Si es NULL, se advierte y el documento muestra «No consta el presidente histórico». |
| `estado` | `TEXT` | Sí | `REVISION` | REVISION inicial, EMITIDA o REABIERTA correctiva. |

- **PK:** `id`.
- **FK:** `ayuntamiento_id` → `ayuntamiento.id`; `periodo_id` → `periodo.id`.
- **UNIQUE:** `(ayuntamiento_id, periodo_id, tipo_facturacion)`.
- **CHECK:** `tipo_facturacion` en `TD` para el MVP.
- **Estado vigente:** CHECK `REVISION`, `EMITIDA`, `REABIERTA`. REVISION sin cobros permite añadir lecturas y corregir entregas/B; EMITIDA bloquea; REABIERTA conserva B congelado y permite añadir/corregir lecturas únicamente sin cobros. Sin cabecera también se permite registrar/corregir, sin preparar revisión. Reapertura con fecha automática/motivo obligatorio. Contratos implementados en facturación municipal §13–§16; la fecha de una cabecera en revisión es funcional y no acredita emisión.

### 4.11.1 `participacion_facturacion`

Una fila representa una entrega de farmacia/periodo incorporada una sola vez a la facturación municipal correspondiente. La relación con la entrega permite alcanzar sus precintos aptos sin duplicarlos.

| Campo | Tipo PostgreSQL | Obligatorio | Default | Descripción |
|---|---|---:|---|---|
| `id` | `INTEGER` | Sí | `GENERATED ALWAYS AS IDENTITY` | Identificador interno. |
| `facturacion_id` | `INTEGER` | Sí | — | Proceso municipal al que contribuye. |
| `entrega_id` | `INTEGER` | Sí | — | Entrega única de farmacia y periodo que aporta los precintos. |
| `soe_b` | `TEXT` | Sí | — | SOE conservado en el snapshot de identidad B al emitir. |
| `denominacion_b` | `TEXT` | Sí | — | Denominación conservada en B al emitir. |
| `cif_b` | `TEXT` | Sí | — | CIF conservado en B al emitir. |
| `importe_precintos` | `NUMERIC(12,2)` | Sí | — | Suma vigente de los precios aplicados de los precintos aptos de la entrega. |

- **PK:** `id`.
- **FK:** `facturacion_id` → `facturacion.id`; `entrega_id` → `entrega_farmacia_periodo.id`.
- **UNIQUE:** `entrega_id`, para impedir que la misma entrega se facture más de una vez.
- **CHECK:** `importe_precintos >= 0`.
- **Relación con farmacia:** se obtiene por `entrega_id` → `entrega_farmacia_periodo.farmacia_id`; `soe_b` es snapshot, no FK.
- **Relación con precintos:** una participación corresponde a una entrega y sus precintos aptos se obtienen por `precinto.entrega_id`. No se crea una tabla puente mientras se incluyan todos los precintos aptos de la entrega.
- **Snapshot B:** se prepara como propuesta editable desde el catálogo actual al crear cada participación en REVISION. Recálculos conservan B e ID. Queda congelado desde EMITIDA, también en REABIERTA; no se reconstruye a partir de A ni se reemplaza por cambios del catálogo.
- **Importe:** se obtiene sumando una vez `precinto.precio_aplicado` por cada precinto apto. Se recalcula al preparar revisión o reemitir; la corrección individual actualiza su suma en la misma transacción si ya existe participación. No requiere reapertura antes de la primera emisión.
- **Cardinalidades:** una facturación emitida tiene una o más participaciones; una entrega tiene cero o una participación; cada participación tiene exactamente una facturación y una entrega. En revisión inicial solo se conservan participaciones con aptos. Una participación ya emitida se conserva tras corregir todos sus precintos en reapertura, con importe cero; no se borra su identidad histórica ni se crean otras participaciones.
- **Regla de emisión:** si no hay precintos aptos en todo el Ayuntamiento/periodo, no se emiten PRECINTOS ni COMISION y se muestra una advertencia. Si solo algunas farmacias tienen aptos, el par de facturas incluye exclusivamente esas farmacias.
- **Validación transaccional:** facturación y entrega deben coincidir en Ayuntamiento y periodo y en el tipo aplicable. Estas igualdades entre tablas no quedan cubiertas por las FK simples descritas.
- Tabla y restricciones implementadas en `db/schema.sql`; el cálculo/revisión, emisión y reapertura correctiva están implementados en los servicios de Facturación y su interfaz, según el [contrato vigente](../specs/facturacion-municipal/spec.md).

### 4.12 `factura`

| Campo | Tipo PostgreSQL | Obligatorio | Default | Descripción |
|---|---|---:|---|---|
| `id` | `INTEGER` | Sí | `GENERATED ALWAYS AS IDENTITY` | Identificador interno. |
| `facturacion_id` | `INTEGER` | Sí | — | Facturación a la que pertenece. |
| `tipo` | `TEXT` | Sí | — | PRECINTOS o COMISION. |
| `numero_factura` | `TEXT` | Sí | — | Número oficial asignado por Contabilidad. |
| `numero_precintos` | `INTEGER` | Condicional | — | Obligatorio en PRECINTOS; nulo en COMISION. |
| `importe_total` | `NUMERIC(12,2)` | Sí | — | Total histórico de la factura. |
| `base_calculo` | `NUMERIC(12,2)` | Condicional | — | Obligatorio en COMISION; nulo en PRECINTOS. |
| `porcentaje_comision` | `NUMERIC(7,4)` | Condicional | — | Obligatorio en COMISION; nulo en PRECINTOS. |
| `importe_comision` | `NUMERIC(12,2)` | Condicional | — | Obligatorio en COMISION; nulo en PRECINTOS. |
| `porcentaje_iva` | `NUMERIC(7,4)` | Condicional | — | Obligatorio en COMISION; nulo en PRECINTOS. |
| `importe_iva` | `NUMERIC(12,2)` | Condicional | — | Obligatorio en COMISION; nulo en PRECINTOS. |
| `configuracion_facturacion_id` | `INTEGER` | Condicional | — | Obligatorio en COMISION; nulo en PRECINTOS. |

- **PK:** `id`.
- **FK:** `facturacion_id` → `facturacion.id`; `configuracion_facturacion_id` → `configuracion_facturacion.id`.
- **UNIQUE:** `(facturacion_id, tipo)` y `(tipo, numero_factura)` en todos los periodos; `tipo` identifica la serie oficial.
- **CHECK generales:** `tipo` en `PRECINTOS`, `COMISION`; `importe_total >= 0`; cantidades e importes, cuando existan, no negativos; porcentajes entre 0 y 100.
- **CHECK para PRECINTOS:** `numero_precintos` no nulo y no negativo; `base_calculo`, porcentajes, importes de comisión e IVA y `configuracion_facturacion_id` nulos.
- **CHECK para COMISION:** `numero_precintos` nulo; `base_calculo`, porcentajes, importes de comisión e IVA y `configuracion_facturacion_id` no nulos.
- **Decisiones relevantes:** las dos facturas se crean conjuntamente, con números oficiales obligatorios y ya informados. La numeración es única por tipo/serie en todos los periodos, aunque el mismo texto exista en tipos distintos. No existen facturas borrador sin número. Los cálculos y redondeos se realizan antes de persistir los importes históricos. Si una reapertura sin cobros permite corregir importes, solo al reemitir conjuntamente se actualizan las filas de las facturas existentes; conservan sus números oficiales originales y no se asignan otros.

### 4.13 `cobro`

| Campo | Tipo PostgreSQL | Obligatorio | Default | Descripción |
|---|---|---:|---|---|
| `id` | `INTEGER` | Sí | `GENERATED ALWAYS AS IDENTITY` | Identificador interno. |
| `factura_id` | `INTEGER` | Sí | — | Factura cobrada. |
| `fecha_cobro` | `DATE` | Sí | — | Fecha del cobro. |
| `importe_cobrado` | `NUMERIC(12,2)` | Sí | — | Importe completo cobrado. |
| `justificante` | `TEXT` | No | — | Referencia opcional al justificante bancario. |

- **PK:** `id`.
- **FK:** `factura_id` → `factura.id`.
- **UNIQUE:** `factura_id`.
- **CHECK:** `importe_cobrado >= 0`.
- **Decisiones relevantes:** no hay cobros parciales. La igualdad con `factura.importe_total` se valida entre tablas. El cobro puede registrarse con justificante nulo. La API actual solo registra/consulta cobros; no ofrece una operación posterior para editar ese justificante.

### 4.14 `reapertura_facturacion`

| Campo | Tipo PostgreSQL | Obligatorio | Default | Descripción |
|---|---|---:|---|---|
| `id` | `INTEGER` | Sí | `GENERATED ALWAYS AS IDENTITY` | Identificador interno. |
| `facturacion_id` | `INTEGER` | Sí | — | Facturación reabierta. |
| `fecha_reapertura` | `TIMESTAMP WITH TIME ZONE` | Sí | `CURRENT_TIMESTAMP` | Instante automático de reapertura. |
| `motivo` | `TEXT` | Sí | — | Justificación obligatoria. |

- **PK:** `id`.
- **FK:** `facturacion_id` → `facturacion.id`.
- **UNIQUE:** ninguna.
- **CHECK:** ninguno adicional.
- **Decisiones relevantes:** una facturación puede tener varias reaperturas si no existe cobro en ninguna de sus facturas; esta condición se comprueba transaccionalmente. La reapertura correctiva actualiza los registros de la participación existente y recalcula su importe; conserva el snapshot B emitido y los números oficiales, solo al reemitir conjuntamente actualiza las facturas existentes si cambia el cálculo, no crea otra participación ni versión y no vuelve a consultar el catálogo actual.

### 4.15 `pago_farmacias`

| Campo | Tipo PostgreSQL | Obligatorio | Default | Descripción |
|---|---|---:|---|---|
| `id` | `INTEGER` | Sí | `GENERATED ALWAYS AS IDENTITY` | Identificador interno. |
| `facturacion_id` | `INTEGER` | Sí | — | Facturación que origina el pago. |
| `fecha_pago` | `DATE` | Sí | — | Fecha común confirmada por el usuario. |

- **PK:** `id`.
- **FK:** `facturacion_id` → `facturacion.id`.
- **UNIQUE:** `facturacion_id`.
- **CHECK:** ninguno adicional.
- **Decisiones relevantes:** solo se prepara después del cobro de PRECINTOS. La sugerencia de día laborable pertenece a la aplicación.

### 4.16 `detalle_pago_farmacia`

| Campo | Tipo PostgreSQL | Obligatorio | Default | Descripción |
|---|---|---:|---|---|
| `id` | `INTEGER` | Sí | `GENERATED ALWAYS AS IDENTITY` | Identificador interno. |
| `pago_farmacias_id` | `INTEGER` | Sí | — | Pago al que pertenece. |
| `participacion_facturacion_id` | `INTEGER` | Sí | — | Participación a la que corresponde el pago. |
| `soe` | `TEXT` | Sí | — | SOE copiado al preparar el pago. |
| `denominacion_farmacia` | `TEXT` | Sí | — | Denominación histórica del pago. |
| `cif_nif` | `TEXT` | Sí | — | Identificador fiscal histórico del pago. |
| `importe` | `NUMERIC(12,2)` | Sí | — | Importe histórico pagado a la farmacia. |
| `pais_control_iban` | `TEXT` | Sí | — | País y control del IBAN usado. |
| `entidad_bancaria` | `TEXT` | Sí | — | Entidad bancaria usada. |
| `sucursal_bancaria` | `TEXT` | Sí | — | Sucursal bancaria usada. |
| `digito_control_bancario` | `TEXT` | Sí | — | Dígitos de control usados. |
| `cuenta_bancaria` | `TEXT` | Sí | — | Cuenta bancaria usada. |

- **PK:** `id`.
- **FK:** `pago_farmacias_id` → `pago_farmacias.id`; `participacion_facturacion_id` → `participacion_facturacion.id`.
- **UNIQUE:** `participacion_facturacion_id` (una participación se liquida como máximo una vez).
- **CHECK:** `importe >= 0`.
- **Decisiones relevantes:** no contiene `farmacia_id`; queda vinculado a la farmacia por la participación y su entrega. `soe` es solo un snapshot del pago, no una relación. El detalle conserva C, la cuenta utilizada y el importe pagado; no es fuente del informe anual operativo de precintos.
- En el flujo implementado, el catálogo propone los datos al preparar sin persistir; la confirmación guarda los datos de destinatario y cuenta explícitamente revisados por el usuario. Representa a C en A → B → C; no demuestra quién figuraba como titular participante en la factura municipal (B). Ambas identidades deben conservarse por separado.

## 5. Reglas que no se implementan mediante un CHECK simple

Estas reglas requieren lógica de aplicación y, cuando modifican varias filas relacionadas, una transacción:

- **Creación atómica de las dos facturas:** PRECINTOS y COMISION deben crearse juntas.
- **Números oficiales:** antes de emitir deben estar informados ambos números oficiales. La unicidad funcional y física es `(tipo, numero_factura)` en todos los periodos. Si una reapertura sin cobros permite corregir el importe, solo al reemitir conjuntamente se actualizan las facturas existentes; conservan sus números oficiales y no se asignan números nuevos.
- **Participación:** una entrega puede incorporarse como máximo a una facturación; facturación y entrega deben coincidir en Ayuntamiento, periodo y tipo aplicable.
- **Emisión no vacía:** las facturas PRECINTOS y COMISION solo se crean conjuntamente si hay al menos un precinto apto en Ayuntamiento/periodo. En otro caso no se emiten y se presenta una advertencia; con aptos parciales solo las entregas participantes generan participación.
- **Importe de participación:** sumar una sola vez `precio_aplicado` de cada precinto apto de la entrega; la corrección individual recalcula el mismo importe si existe participación; las facturas existentes se actualizan solo al reemitir conjuntamente.
- **Factura de PRECINTOS:** `numero_precintos` e `importe_total` se calculan agregando los precintos válidos correspondientes.
- **Factura de COMISION:** depende del total de PRECINTOS y de la configuración vigente.
- **Redondeo:** cada cálculo monetario intermedio y final se redondea a dos decimales siguiendo la secuencia conceptual aprobada.
- **Reapertura:** debe comprobarse que ninguna de las dos facturas tenga COBRO.
- **Corrección tras reapertura:** actualizar la participación existente y recalcular su importe, conservando B, sin crear participación/versión nueva ni consultar FARMACIA actual.
- **Pago a farmacias:** solo puede generarse después del cobro de la factura de PRECINTOS.
- **Importe cobrado:** `cobro.importe_cobrado` debe coincidir con `factura.importe_total`.
- **Detalles del pago:** cada detalle debe apuntar a una participación, esa participación solo puede pagarse una vez y su importe debe coincidir con el importe de la participación. La suma debe coincidir con el total de PRECINTOS.
- **Autorización de medicamentos:** depende del `estado` de pertenencia a la lista general, de la modalidad GENERAL/ESPECIFICA y, cuando proceda, de AYUNTAMIENTO_MEDICAMENTO. En modalidad específica, el medicamento debe pertenecer además a la lista general; una lista específica vacía no equivale a modalidad general.
- **Aplicación de listas:** en modalidad GENERAL se aplica solo la lista general; las asociaciones AYUNTAMIENTO_MEDICAMENTO se conservan y no se aplican. En modalidad ESPECIFICA, vuelven a aplicarse junto con la autorización general. El cambio de modalidad no elimina asociaciones y no se crea historial de listas.
- **Farmacia y Ayuntamiento al registrar:** una farmacia con `ayuntamiento_id IS NULL` no puede tener entrega ni precinto. El servidor debe validar que `farmacia.ayuntamiento_id` coincide con el Ayuntamiento elegido; las relaciones estructurales usan `farmacia.id`, no SOE.
- **Cambio de asignación:** asignar, reasignar o desasignar requiere ausencia de filas de ENTREGA_FARMACIA_PERIODO y PRECINTO. Comprobación y actualización se hacen atómicamente y coordinadas con la creación de entregas. No hay control de facturación independiente para esta operación.
- **Elegibilidad al registrar:** exige ACTIVO y autorización específica cuando proceda. ALTA admite; BAJA elegible requiere elegir admitir/apartar; INACTIVO nunca admite.
- **Facturación de precintos aceptados:** conserva su elegibilidad en el periodo de su entrega aunque cambien después estados o listas. No se reevalúan las condiciones actuales ni se trasladan lecturas a meses posteriores.
- **Tipo de facturación:** los medicamentos de los precintos deben tener el mismo `tipo_facturacion` que FACTURACION.
- **Configuración vigente:** se selecciona según `facturacion.fecha_factura`; `fecha_inicio <= fecha_factura` y `fecha_fin` es `NULL` o `fecha_factura <= fecha_fin`.
- **Vigencias sin solapamientos:** se comparan varias filas de CONFIGURACION_FACTURACION y deben validarse al insertar o modificar una configuración.
- **Fecha de factura:** debe ser el último día del PERIODO relacionado.
- **Paquetes:** el servicio renumera solo las posiciones del paquete afectado, conservando IDs y otros paquetes; si queda vacío desaparece. SQL solo protege rango y unicidad.
- **Datos bancarios:** deben estar completos y ser válidos antes de generar PAGO_FARMACIAS y sus detalles.
- **Inmutabilidad histórica:** cobros, pagos, importes facturados y snapshots no deben modificarse mediante operaciones que destruyan la trazabilidad.

## 6. Índices

### 6.1 Índices creados por PK y UNIQUE

PostgreSQL crea automáticamente índices para todas las claves primarias y restricciones `UNIQUE` documentadas. No deben duplicarse con índices manuales.

Esto cubre, entre otras, las búsquedas por:

- `ayuntamiento.cif`;
- `farmacia.soe`;
- `medicamento.codigo_nacional`;
- periodo por mes y año;
- entrega por farmacia y periodo;
- autorización por ayuntamiento y medicamento;
- facturación por ayuntamiento, periodo y tipo;
- factura por facturación y tipo;
- participación por entrega; facturacion_id dispone de índice adicional no único;
- unicidad de serie `factura(tipo, numero_factura)`;
- cobro por factura;
- pago por facturación;
- detalle de pago por participación; no hay UNIQUE por pago/SOE;
- posición de un precinto dentro de una entrega y paquete.

### 6.2 Índices adicionales para claves foráneas

PostgreSQL no crea automáticamente índices para las claves foráneas. Se consideran necesarios o útiles:

- `farmacia(ayuntamiento_id)`;
- `ayuntamiento_medicamento(medicamento_id)`, porque el UNIQUE ya comienza por `ayuntamiento_id`;
- `entrega_farmacia_periodo(periodo_id)`, porque el UNIQUE ya comienza por `farmacia_id`;
- `precinto(medicamento_id)`;
- `incidencia(entrega_id)`;
- `facturacion(periodo_id)`, porque el UNIQUE ya comienza por `ayuntamiento_id`;
- `factura(configuracion_facturacion_id)`;
- `reapertura_facturacion(facturacion_id)`;
- `participacion_facturacion(facturacion_id)`, ya incluido en schema.sql.

No se añade otro índice para estas FK porque ya son el primer campo de un índice UNIQUE:

- `precinto.entrega_id`;
- `factura.facturacion_id`;
- `cobro.factura_id`;
- `pago_farmacias.facturacion_id`;
- `operacion_lectura.entrega_id`, cubierto por UNIQUE (entrega_id, clave).

`detalle_pago_farmacia.pago_farmacias_id` no tiene índice propio ni cobertura inicial por PK/UNIQUE en el esquema actual; la FK no crea un índice automáticamente. Es un hallazgo de rendimiento potencial, sin impacto medido ni cambios SQL en esta revisión.

### 6.3 Índices futuros

Los índices para informes, deuda, búsquedas por fechas o agregaciones anuales se añadirán únicamente cuando existan consultas reales y puedan revisarse sus planes de ejecución.

En particular:

- no se crea un índice sobre una categoría de baja cardinalidad sin una consulta que lo justifique;
- no se crean índices redundantes con PK o UNIQUE;
- no se justifica ningún índice de DETALLE_PAGO_FARMACIA para el informe anual operativo, que se calcula desde los precintos y sus entregas;
- la relación PRECINTO → ENTREGA_FARMACIA_PERIODO → FARMACIA permite obtener importes por establecimiento; la titularidad B al emitir se obtiene del snapshot en PARTICIPACION_FACTURACION.

## 7. Decisiones funcionales cerradas

- Una farmacia pertenece a cero o un Ayuntamiento a la vez; su asignación solo cambia si no hay entregas ni precintos. La FK opcional permite `NULL` en el modelo y en `db/schema.sql`; las instalaciones previas requieren la actualización SQL documentada.
- Las relaciones operativas con Farmacia llegan por su ID interno estable a través de ENTREGA_FARMACIA_PERIODO. Los SOE de B y C son snapshots, no claves relacionales: B se conserva en PARTICIPACION_FACTURACION y C en DETALLE_PAGO_FARMACIA.
- Las listas específicas se conservan, pero no se aplican en modalidad GENERAL; en ESPECIFICA vuelven a aplicarse junto con la autorización general. Cambiar de modalidad no borra asociaciones ni crea historial de listas.
- El SOE permanece estable aunque cambien CIF/NIF, denominación u otros datos actuales.
- FACTURA nace con `numero_factura` oficial y obligatorio.
- Las facturas PRECINTOS y COMISION se crean conjuntamente.
- No existen facturas borrador sin número.
- Cada tipo de factura tiene su propia serie; el número oficial, normalmente guardado como texto, es único dentro de esa serie en todos los periodos. `db/schema.sql` aplica `UNIQUE(tipo, numero_factura)`.
- Si una corrección tras reapertura sin cobros cambia el importe, solo al reemitir conjuntamente se actualiza la factura existente con el importe recalculado; conserva los números oficiales originales de PRECINTOS y COMISION y no se asignan números nuevos.
- Todos los cálculos monetarios intermedios y finales se redondean a dos decimales.
- El redondeo mantiene el segundo decimal cuando el tercero está entre 0 y 4, y lo incrementa cuando está entre 5 y 9.
- `cobro.justificante` es opcional al registrar; no existe edición posterior en el contrato implementado.
- `configuracion_documentos.nombre_presidente` es el nombre actual opcional; los documentos muestran el histórico de FACTURACION. Si falta este último, se devuelve una advertencia y se muestra «No consta el presidente histórico», sin sustituirlo por la configuración actual.
- `configuracion_facturacion.fecha_fin` es inclusiva.
- El informe anual operativo utiliza los precintos aptos y sus precios aplicados, no los destinatarios ni las fechas de sus pagos.
- Una consulta histórica que agrupe entregas/precintos por denominación o CIF/NIF actuales de FARMACIA puede atribuir registros al titular actual; agrupar por SOE identifica el establecimiento, no a su titular anterior. Usar DETALLE_PAGO_FARMACIA para una atribución fiscal puede atribuirlos a C en lugar de B.
- No se implementa resolución automática de titulares anteriores. La sincronización con la aplicación corporativa de titulares es una mejora futura.

## 8. Decisiones todavía abiertas

Siguen sin resolver:

- El contenido y formato funcional exactos de `medicamento.anexo`.
- Decidir si se exige reconstruir las condiciones exactas de aceptación y, en ese caso, aprobar la evidencia histórica adicional. El resultado válido y su periodo ya se representan mediante PRECINTO y su entrega.
- La validación del flujo con lector físico real y la definición de la validación del dígito de control EAN-13.

La unicidad global de CONFIGURACION_DOCUMENTOS ya está resuelta por el índice único sobre constante true; permite cero o una fila sin imponer que exista.

La integración visual de captura y la reconciliación por clave ya están implementadas. BAJA elegible mantiene elección explícita aceptar/apartar y los motivos de rechazo están definidos. La evidencia histórica adicional de esa decisión sigue como mejora futura, sin marca específica en el MVP ni bloqueo de la implementación actual.

Las tablas financieras, incluida la participación, están en `db/schema.sql`. Los flujos de facturación, cobros municipales y preparación/confirmación de liquidaciones están implementados; la aplicación no ejecuta transferencias bancarias. El [contrato vigente](../specs/facturacion-municipal/spec.md) y el [registro de revisión v2](revision-documental-v2-2026-10-18.md) recogen el alcance contrastado con rutas, servicios e interfaces.

## Histórico aprobado: objetivo lógico de Entregas y precintos (8 de octubre de 2026)

Esta adenda prevalece sobre descripciones incompatibles de las secciones 4.6–4.8. El modelo objetivo se incorporó a `db/schema.sql` y la actualización incremental 002 se aplicó a `gestion_facturacion_medicamentos` y `gestion_facturacion_medicamentos_test` el 8 de octubre de 2026. Otras instalaciones requieren verificación y aplicación individual.

### `entrega_farmacia_periodo` — ampliación objetivo

Añadir dos columnas obligatorias, sin valor por defecto funcional:

| Campo | Tipo objetivo | Obligatorio | Descripción |
|---|---|---:|---|
| `denominacion_farmacia` | `TEXT` | Sí (`NOT NULL`) | Snapshot de `farmacia.denominacion` al crear entrega. |
| `cif_nif_farmacia` | `TEXT` | Sí (`NOT NULL`) | Snapshot de `farmacia.cif_nif` al crear entrega. |

Se conservan PK/FK/UNIQUE actuales, incluidos `(farmacia_id, periodo_id)`. Los dos valores no se actualizan al recuperar entrega ni al editar FARMACIA. El usuario selecciona periodo y farmacia; el sistema obtiene y muestra el Ayuntamiento asociado sin exigir su selección previa. La comprobación de asignación municipal vigente debe coordinarse transaccionalmente con cambios municipales usando el protocolo existente. Una farmacia sin Ayuntamiento no registra. `precintos_informados` e `importe_informado` se conservan y son editables mientras la facturación esté editable; no afectan lecturas. PERIODO no tiene estado propio de apertura/cierre.

### `precinto` y `incidencia` — reglas objetivo

Las columnas actuales de PRECINTO conservan su forma: código original/nacional como TEXT, posiciones de paquete y precio aplicado. No hay UNIQUE de código nacional ni tabla PAQUETE. El precinto 15 completa el paquete sin crear otro vacío. El siguiente precinto admitido materializa otro automáticamente si el último está completo, o por decisión expresa si está incompleto. Su número es el mayor existente + 1 (o 1 si no hay); incidencias no crean paquetes. Borrar error físico mientras la facturación esté editable renumera únicamente posiciones de su paquete, preserva IDs y elimina paquete vacío. `precio_aplicado` copia el precio del catálogo al admitir y queda estable.

El CHECK objetivo de `incidencia.motivo` debe aceptar `MEDICAMENTO_DESCONOCIDO`, `MEDICAMENTO_NO_AUTORIZADO`, `MEDICAMENTO_INACTIVO` y `BAJA_COMERCIAL_RECHAZADA_USUARIO`. Incidencia continúa sin FK medicamento, paquete ni precio; código nacional puede ser NULL. Confirmación de aviso no altera autorización. No se añade flujo de resolución.

Autorización GENERAL conserva asociaciones específicas sin aplicarlas; ESPECIFICA requiere autorización general y específica. INACTIVO nunca admite nuevas lecturas; ACTIVO/ALTA elegible se admite; ACTIVO/BAJA elegible requiere elección. El registro conserva elegibilidad por existir como PRECINTO, y snapshots de autorización detallada no se agregan en esta aprobación. Cambio de catálogo/listas no reevalúa aceptados.

### Diferencia respecto de `db/schema.sql`

La actualización 002 aborta ante entregas existentes si faltan los snapshots; no realiza backfill. Antes de aplicarla a otra base, comprobar su identidad y contenido y seguir `db/README.md`. Los fixtures existentes que insertaban entregas fueron adaptados para enviar valores coherentes con sus farmacias ficticias.

Pendiente de definición antes de implementación: evento de lector, escaneos durante operaciones, reconciliación de resultado incierto, idempotencia de operación y validación del dígito EAN-13. BAJA conserva elección explícita aceptar/apartar sin marca histórica adicional en el MVP; esa evidencia es mejora futura y no bloquea implementación. Ver `docs/specs/entregas-precintos/spec.md` y `plan.md`.

Estado de aplicación de la entrega: POST/GET `/entregas` crean/recuperan por farmacia-periodo, derivan Ayuntamiento de la farmacia bloqueada y capturan ambos snapshots únicamente al crear. No hay campos nuevos ni cambios SQL en este bloque API. Contrato en spec §14; edición de declarados pendiente de concretar el control de facturación editable, sin estado de Periodo.

## Histórico de implementación: operación técnica de lectura (8 de octubre de 2026)

Guardado/reconciliación backend implementados según spec §17; declarados implementados con criterio provisional de ausencia de facturación (§15). Esta adenda sustituye los pendientes anteriores de esos bloques; evento lector e interfaz pendientes. Actualización 003 aplicada/verificada en ambas bases locales descritas en db README, conservando lecturas anteriores sin backfill. Esquema de nuevas instalaciones equivalente.

| Campo de `operacion_lectura` | Tipo | Nulabilidad |
|---|---|---|
| `id` | INTEGER GENERATED ALWAYS AS IDENTITY | NOT NULL, PK explícita |
| `entrega_id` | INTEGER | NOT NULL, FK entrega RESTRICT |
| `clave` | UUID | NOT NULL, UNIQUE junto con entrega |
| `solicitud` | JSONB | NOT NULL, CHECK objeto; petición normalizada para detectar conflictos |
| `precinto_id` | INTEGER | NULL si incidencia |
| `incidencia_id` | INTEGER | NULL si precinto |

CHECK `num_nonnulls(precinto_id, incidencia_id) = 1`. Cada FK de lectura incluye `entrega_id`, con referencia `(id, entrega_id)` y ON DELETE CASCADE; ambas tablas de lectura incorporan UNIQUE de esa pareja sin alterar filas. Cada lectura referenciada es UNIQUE en la tabla técnica. Un recibo no puede pertenecer a otra entrega ni existir sin una lectura. El guardado API inserta ambas filas en la misma transacción; las lecturas anteriores no necesitan recibo. No hay timestamps, snapshot de evaluación, histórico adicional BAJA, tabla PAQUETE ni contador.

La respuesta recuperada se reconstruye únicamente de la lectura guardada, con precio NUMERIC como cadena, sin unir catálogo actual. Decisión retenida en la petición solo para igualdad de repetición mientras existe la lectura. Borrado físico futuro elimina también la clave por cascada: no conserva historial de entrada errónea y la interfaz descartará esa operación, usando clave nueva para otra lectura. Reenvío de clave borrada puede crear una nueva operación; no implementar borrado en este bloque.

Orden de escritura: Ayuntamiento FOR UPDATE → Farmacia FOR SHARE revalidada → Periodo FOR KEY SHARE → Entrega FOR UPDATE → Medicamento FOR SHARE → consulta coherente de modalidad/pertenencia y evaluación. El bloqueo municipal coordina listas/escrituras y futuro cierre; comprobación de facturación en sentencia posterior READ COMMITTED. Códigos repetidos con claves distintas son independientes. Lectura/recibo se confirman juntos, pendientes/rechazos/errores revierten y no consumen clave.

## Histórico de implementación: retirada técnica sin contenido (8 de octubre de 2026)

Política aprobada por el usuario; sustituye la liberación de claves por cascada descrita en la adenda anterior. `operacion_lectura.retirada BOOLEAN NOT NULL DEFAULT FALSE` y solicitud JSONB nullable. CHECK destino: activa exige solicitud y exactamente un destino; retirada exige solicitud/precinto_id/incidencia_id NULL. CHECK JSON exige objeto cuando existe solicitud. Conserva PK/UNIQUE/FK; la API desvincula y purga antes de DELETE para evitar que CASCADE quite la protección. Solo quedan ID técnico, entrega, UUID y marcador, sin fecha ni contenido histórico de lectura. Repetición tardía rechazada, sin purga automática/expiración; nuevas lecturas usan nuevas claves. Migración 004 preserva recibos activos y se aplica tras 003; preparada, aplicada y verificada en desarrollo y pruebas locales según db README.

GET precintos/incidencias y resumen agregado de spec §18 usan una sentencia por consulta, NUMERIC/TEXT, sin convertir importes a coma flotante ni multiplicar filas. No incluye descripción actual del catálogo como snapshot. DELETE comparte Ayuntamiento→Farmacia→Periodo→Entrega FOR UPDATE con guardado, comprueba facturación y pertenencia, purga operación/elimina/renumera en una transacción. Actualizaciones ascendentes 1…N solo en paquete afectado no colisionan con UNIQUE y conservan IDs/precios; otros paquetes intactos. GET operación activa y repetición reconstruyen posición actual; retirada devuelve solo su clave/estado. No hay nueva entidad PAQUETE ni contador.


Regla vigente de precio individual (v26, 12 de octubre de 2026): PUT de precio identifica precinto y entrega, actualiza únicamente precio_aplicado y conserva precio_referencia. Sin cabecera TD se permite corregir/añadir (SIN_FACTURAR); REVISION y REABIERTA sin cobros también permiten ambas. EMITIDA o cualquier cobro bloquean. Sin cambios de esquema ni de la migración 005; toda lectura futura captura el maestro vigente. Contrato en Entregas.
