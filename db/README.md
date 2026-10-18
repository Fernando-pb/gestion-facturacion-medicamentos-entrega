# Instalación y actualización de PostgreSQL

## Lectura para una instalación nueva — revisión documental 18/10/2026

La [instalación desde una base vacía y la preparación de tests](../README.md) se describen en el README principal. Crear expresamente las bases de desarrollo y pruebas y cargar `db/schema.sql` una sola vez en cada base nueva vacía. No cargar después los updates en una instalación nueva: el esquema completo ya contiene su estado objetivo y los scripts históricos tienen verificadores propios.

Este documento conserva evidencias históricas, no certifica el estado actual de ninguna instalación. En esta revisión no se han consultado bases ni ejecutado comandos SQL. Las adaptaciones directas de estados, estructura financiera y configuración documental descritas abajo no tienen todas un script incremental versionado; ejecutar 001–005 no garantiza adaptar cualquier base antigua. Revisar cada destino antes de planificar cambios; no aplicar el esquema completo sobre datos existentes ni reconstruir snapshots desde maestros actuales.

Modelo/diagrama contrastados con el SQL: [revisión v2](../docs/modelo-datos/revision-documental-v2-2026-10-18.md). La fecha es documental y no corresponde a una migración. Los flujos actuales de facturación, cobros y liquidación están implementados en los servicios e interfaces; la existencia de tablas por sí sola no demuestra esos flujos.

## Actualización 005: referencia de precio separada

`db/updates/005-precio-referencia.sql` añade `precinto.precio_referencia NUMERIC(12,2) NOT NULL`, CHECK no negativo y sin DEFAULT. Aprobación expresa del 12 de octubre: para lecturas históricas copia el valor conservado de `precio_aplicado`, sin modificarlo ni consultar el catálogo actual. Esa referencia histórica representa el valor al migrar; no garantiza el precio original del catálogo. En lecturas nuevas el servidor captura ambos precios al admitir. La corrección posterior cambia únicamente el aplicado del precinto seleccionado por ID; conserva referencia y todas las otras lecturas. No exige preparar revisión: ausencia de cabecera TD, REVISION y REABIERTA sin cobros permiten registro/corrección; EMITIDA o cualquier cobro bloquean.

Migración transaccional con ACCESS EXCLUSIVE sobre PRECINTO; completa únicamente referencias NULL, conserva valores existentes en adaptaciones parciales/repetidas, verifica tipo/check/cobertura y aplica NOT NULL antes de activar edición. Rechaza incompatibilidades sin borrar datos. Nuevas instalaciones: schema.sql incluye la definición; no cargarlo sobre bases existentes. Comprobar nombre/host y aplicar 005 a cada destino explícito antes de usar el servidor nuevo; `npm run db:check` detecta su ausencia.

```powershell
psql -h localhost -U postgres -d gestion_facturacion_medicamentos -v ON_ERROR_STOP=1 -f db/updates/005-precio-referencia.sql
```

Para pruebas usar gestion_facturacion_medicamentos_test. Verificar `SELECT current_database()`, conteos y conservación del aplicado antes/después, `SELECT count(*) FROM precinto WHERE precio_referencia IS NULL` (debe dar cero), tipo/NOT NULL/check y repetición. No actualizar referencias desde MEDICAMENTO ni sustituirlas con el precio corregido.

Aplicada/verificada el 12 de octubre de 2026 en las dos bases locales con nombre/host comprobados: desarrollo, 7 lecturas antes/después, huella del aplicado idéntica, cero referencias ausentes; segunda aplicación conserva la misma huella y cobertura. Pruebas, 0 lecturas iniciales, cobertura completa; pruebas de migración con esquemas ficticios/rollback verifican la repetición y conservación de referencias ya distintas del aplicado. `db:check` de desarrollo correcto. No se modificaron facturas/cobros/pagos ni se ejecutaron correcciones de precios en desarrollo. Otras instalaciones requieren aplicar/verificar 005 individualmente.

## Estado de facturación: adaptación local del 11 de octubre de 2026

Cambio autorizado sin migración versionada: `facturacion.estado TEXT NOT NULL DEFAULT 'REVISION'` y `ck_facturacion_estado` para REVISION/EMITIDA/REABIERTA. Aplicado directamente en `gestion_facturacion_medicamentos` y `gestion_facturacion_medicamentos_test`, con host y `current_database()` verificados, bloqueo ACCESS EXCLUSIVE y cero filas financieras antes del ALTER. Columna/DEFAULT/NOT NULL verificados después. Ningún dato borrado; las tablas y los datos no afectados se conservan. Script temporal de adaptación retirado.

`db/schema.sql` incorpora la misma definición y `npm run db:check` detecta la ausencia del estado. Para otras instalaciones, verificar individualmente estructura y contenido antes de adaptar; no asignar estados a facturaciones históricas por inferencia ni cargar schema.sql sobre una base existente. Los estados gobiernan correcciones de Entregas y B según `docs/specs/facturacion-municipal/spec.md` §13; emisión/actualización conjunta implementadas según §14, sin nueva adaptación SQL. Se requiere configuración única vigente por fecha de factura; la API no inventa configuraciones. Registro de cobros completos por factura implementado según §15, reutilizando COBRO y su UNIQUE existente, sin adaptación SQL. Comparación NUMERIC y bloqueos compartidos con reapertura; Liquidación confirmada y Excel XML implementados según §16, reutilizando PAGO_FARMACIAS/DETALLE_PAGO_FARMACIA y sus UNIQUE sin cambios SQL. Preparación sin persistencia; al confirmar se guardan fecha elegida, importes completos y C/cuenta revisados.

## Actualización 004: claves retiradas sin contenido

Política aprobada en conversación: la eliminación física API retira la clave antes de borrar la lectura, purga solicitud/referencias y conserva solo entrega/clave/marcador (más ID técnico). Impide recreación por una petición retrasada sin conservar historial del contenido descartado. Requiere `retirada BOOLEAN NOT NULL DEFAULT FALSE`, solicitud JSONB nullable y CHECK de operación activa frente a retirada. PK/UNIQUE/FK conservadas; no modifica lecturas ni recibos activos existentes. La cascada de 003 sigue en las FK, pero la API desvincula/purga antes de DELETE para conservar la clave. SQL directo que omita el protocolo no está autorizado por esta garantía.

Aplicar 004 después de 003, en transacción y con destino verificado mediante configuración local y current_database(). El script bloquea operacion_lectura ACCESS EXCLUSIVE, verifica versión previa o actual y rechaza diferencias de columnas, claves, FK y CHECK sin ocultarlas. Una segunda aplicación verifica definición; no repetir 003 después de 004 porque su verificador corresponde al esquema anterior. Nuevas instalaciones: schema.sql ya incorpora 004; no cargarlo sobre una base existente.

```powershell
psql -h localhost -U postgres -d gestion_facturacion_medicamentos -v ON_ERROR_STOP=1 -f db/updates/004-claves-retiradas.sql
```

Para pruebas sustituir por gestion_facturacion_medicamentos_test; verificar primero destino y recuentos. Aplicada y repetida con verificación el 8 de octubre de 2026 en ambas bases locales: 0 entregas/precintos/incidencias/operaciones antes, 0 precintos/incidencias/operaciones después. Ninguna otra base explorada; sin fixtures en desarrollo. Datos previos y recibos activos preservados en pruebas de esquema ficticio dedicado con rollback.

```sql
SELECT current_database();
SELECT retirada, count(*) FROM operacion_lectura GROUP BY retirada;
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.operacion_lectura'::regclass ORDER BY conname;
```

## Actualización 003: clave persistente de lectura

`db/updates/003-operacion-lectura.sql` añade `operacion_lectura` y UNIQUE `(id, entrega_id)` a PRECINTO e INCIDENCIA para FK compuestas. Guarda la petición JSONB normalizada, UUID con unicidad por entrega y referencia exclusiva a una lectura. No completa ni modifica lecturas antiguas; siguen sin clave. La FK de lectura usa ON DELETE CASCADE para eliminar su protección junto con una futura entrada errónea borrada, sin historial permanente. No crea paquetes ni altera reglas financieras.

Antes de aplicar: comprobar configuración local y `SELECT current_database()` explícitamente para cada destino; contar entregas/precintos/incidencias. Ejecutar después en orden tras 001/002:

```powershell
psql -h localhost -U postgres -d gestion_facturacion_medicamentos -v ON_ERROR_STOP=1 -f db/updates/003-operacion-lectura.sql
```

Para pruebas sustituir el destino por `gestion_facturacion_medicamentos_test`. No ejecutar `schema.sql` sobre una instalación existente. 003 usa transacción y ACCESS EXCLUSIVE en entrega/precinto/incidencia (y operación existente); puede esperar o bloquear temporalmente consultas. Una repetición verifica columnas, identidad y las nueve restricciones exactas antes de comunicar que ya existe; aborta y revierte ante diferencias. Sin IF NOT EXISTS indiscriminado ni backfill. En nuevas instalaciones `schema.sql` crea la misma definición.

Aplicada y verificada el 8 de octubre de 2026 en `gestion_facturacion_medicamentos` y `gestion_facturacion_medicamentos_test`: destinos locales confirmados por configuración/current_database(); 0 entregas, 0 precintos y 0 incidencias antes/después, 0 operaciones después. Segunda ejecución verificó definición compatible en ambas. Otras bases no exploradas ni actualizadas. Pruebas de preservación con filas anteriores en esquema ficticio de la base dedicada, siempre rollback; evidencias en tareas de Entregas.

Verificar individualmente en otras instalaciones:

```sql
SELECT current_database();
SELECT count(*) FROM operacion_lectura;
SELECT column_name, data_type, is_nullable, is_identity
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'operacion_lectura'
ORDER BY ordinal_position;
SELECT conname, pg_get_constraintdef(oid), convalidated
FROM pg_constraint WHERE conrelid = 'public.operacion_lectura'::regclass
ORDER BY conname;
```

Para una base nueva vacía, cargar `db/schema.sql`. No volver a cargar ese archivo en una base ya creada: contiene sentencias `CREATE TABLE`, no actualizaciones. Las tablas financieras incluyen `participacion_facturacion`, vínculo único de cada entrega, detalle de pago único por participación y numeración única por `(tipo, numero_factura)`. Las estructuras por sí solas no implementan flujos; los servicios e interfaces actuales sí incluyen facturación, cobros y liquidación, con el alcance del README principal. El cambio estructural se aplicó en las bases locales de desarrollo y pruebas, tras confirmar que sus tablas financieras estaban vacías; no se creó una migración incremental. `npm run db:check` comprueba además estas estructuras y señala si falta actualizar el esquema.

El proyecto aplica cambios mediante SQL explícito, sin herramienta de migraciones. Para una base existente, identificar primero qué adaptaciones requiere; los archivos de `db/updates/` no cubren todos los cambios históricos. Ejecutar solo los aplicables y en su orden, seleccionando expresamente el destino y usando credenciales locales. Desde la raíz del repositorio:

```powershell
psql -h localhost -U postgres -d gestion_facturacion_medicamentos -v ON_ERROR_STOP=1 -f db/updates/001-farmacia-ayuntamiento-opcional.sql
```

La actualización `002-entregas-precintos-snapshots-incidencias.sql` añade `denominacion_farmacia TEXT NOT NULL` y `cif_nif_farmacia TEXT NOT NULL` a `entrega_farmacia_periodo`, sin DEFAULT ni backfill, y amplía `ck_incidencia_motivo` con `MEDICAMENTO_INACTIVO` y `BAJA_COMERCIAL_RECHAZADA_USUARIO`. Conserva las claves y demás restricciones. Antes de ejecutarla, conectarse al destino explícito, comprobar `SELECT current_database()` y contar las filas de `entrega_farmacia_periodo`. Si faltan los snapshots, la tabla debe estar vacía; el script bloquea la tabla en modo exclusivo antes de comprobarlo, por lo que las inserciones concurrentes esperan a que termine. Si existen filas, el script aborta sin cambios y no copia datos actuales de FARMACIA. También aborta ante columnas parciales/incompatibles o una definición inesperada del CHECK. Si el objetivo ya está aplicado, verifica las definiciones esperadas y no las reemplaza. No cargar `schema.sql` sobre una base existente.

Ejemplo, solo después de verificar el destino y el recuento:

```powershell
psql -h localhost -U postgres -d gestion_facturacion_medicamentos -v ON_ERROR_STOP=1 -f db/updates/002-entregas-precintos-snapshots-incidencias.sql
```

Para la base de pruebas, sustituir el nombre por `gestion_facturacion_medicamentos_test` y conservar la verificación de destino exigida por las pruebas. En instalaciones nuevas, `db/schema.sql` ya crea las columnas y restricciones objetivo.

002 ejecuta todos los cambios en una transacción y bloquea tanto `entrega_farmacia_periodo` como `incidencia` en modo `ACCESS EXCLUSIVE`. Puede esperar a operaciones activas y bloquear temporalmente otras consultas; aplicarlo sin operaciones largas. La comprobación del objetivo exige columnas ordinarias TEXT NOT NULL sin DEFAULT y un CHECK validado con exactamente los cuatro motivos. Si ya coinciden, emite avisos de definición verificada. Después de aplicar, comprobar el destino, el recuento y las definiciones:

```sql
SELECT current_database();
SELECT count(*) FROM public.entrega_farmacia_periodo;
SELECT column_name, data_type, is_nullable, column_default, is_generated
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'entrega_farmacia_periodo'
  AND column_name IN ('denominacion_farmacia', 'cif_nif_farmacia');
SELECT pg_get_constraintdef(oid), convalidated
FROM pg_constraint
WHERE conrelid = 'public.incidencia'::regclass
  AND conname = 'ck_incidencia_motivo';
```

Sustituir host, usuario y nombre de base según la instalación. Para pruebas, usar `gestion_facturacion_medicamentos_test`. El script `001` es transaccional y repetible: únicamente retira `NOT NULL` de `farmacia.ayuntamiento_id`; conserva las filas, las asignaciones existentes, `fk_farmacia_ayuntamiento` y `ix_farmacia_ayuntamiento_id`. No necesita backfill ni reinicio. Puede esperar brevemente a operaciones concurrentes por el bloqueo de `ALTER TABLE`; aplicarlo en un momento sin operaciones largas.

Comprobar después:

```sql
SELECT is_nullable FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'farmacia'
  AND column_name = 'ayuntamiento_id'; -- YES

SELECT conname FROM pg_constraint
WHERE conrelid = 'public.farmacia'::regclass
  AND conname = 'fk_farmacia_ayuntamiento';

SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'farmacia'
  AND indexname = 'ix_farmacia_ayuntamiento_id';
```

El alta actual sigue exigiendo un Ayuntamiento existente y el PUT general no acepta `ayuntamiento_id`. POST/DELETE municipales ya implementan asignación/reasignación/retirada con control atómico de actividad y origen esperado; no requieren otra actualización SQL. Entregas ya comparte el protocolo de bloqueo/validación documentado en `docs/specs/gestion-ayuntamiento/plan.md`, §6: la FK de entrega por sí sola no valida la pertenencia municipal. No realizar cambios manuales de asignación saltándose la regla de actividad.



## Adaptación documental local autorizada (11 de octubre de 2026)

Se verificaron host local, nombres gestion_facturacion_medicamentos y gestion_facturacion_medicamentos_test y cero filas de configuracion_documentos/facturacion. En transacción, con configuración bloqueada, se añadieron facturacion.nombre_presidente_historico TEXT nullable, configuracion_documentos.datos_emisor JSONB nullable e índice único uq_configuracion_documentos_unica ON configuracion_documentos ((true)). Sin migración versionada ni borrados. db/schema.sql recoge esos cambios para instalaciones nuevas. En otras bases revisar filas existentes antes de crear el índice: no eliminar configuraciones ni inventar presidentes históricos. La aplicación permite ausencia de presidente con advertencia y no rellena registros emitidos retrospectivamente.
