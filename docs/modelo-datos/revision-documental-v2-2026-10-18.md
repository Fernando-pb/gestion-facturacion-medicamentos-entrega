# Revisión documental del modelo y la entrega — v2

**Fecha: 18 de octubre de 2026.** Es la fecha de contraste y revisión documental del repositorio actual, no una fecha de implementación, despliegue ni migración. No se ha modificado ni ejecutado SQL ni accedido a bases de datos. No se han leído archivos locales de secretos.

## Fuentes y alcance

Se han contrastado [AGENTS](../../AGENTS.md), [MEMORY](../../MEMORY.md), [README](../../README.md), [package.json](../../package.json), [.env.example](../../.env.example), [schema.sql](../../db/schema.sql), [db/README](../../db/README.md), los [modelos escritos](modelo-datos.md), el [modelo lógico](modelo-logico-postgresql.md), la [guía canónica](../guia-contexto-tfm.md) y las especificaciones relacionadas de [docs/specs](../specs/).

El alcance funcional se ha comprobado por lectura de [montaje Express](../../src/app.js), [arranque](../../src/server.js), [autenticación](../../src/auth/demo-auth.js), rutas y controladores de los módulos, servicios/repositorios de [Entregas](../../src/entregas/), [Facturación](../../src/facturacion/), [Documentos](../../src/documentos/) y [Configuración](../../src/configuracion-facturacion/), así como pantallas/controladores de [public](../../public/). Las pruebas se han consultado para documentar sus requisitos de entorno; no se han ejecutado.

Las adendas antiguas que registran pendientes o bloqueos provisionales se conservan como histórico. El README resume el estado actual; para contratos detallados prevalecen los apartados vigentes de cada especificación y sus correcciones posteriores.

## Diagrama vigente y fuente editable

- [v2 PNG](modelo-entidad-relacion-v2-2026-10-18.png), imagen de alta resolución para consulta con zoom.
- [v2 SVG](modelo-entidad-relacion-v2-2026-10-18.svg), vectorial, con texto y tablas editables; no contiene una captura incrustada.
- [v2 DOT](modelo-entidad-relacion-v2-2026-10-18.dot), fuente textual editable de entidades, campos y relaciones. El SVG/PNG proceden de esta misma fuente mediante Graphviz; el PNG se rasteriza a partir del SVG. No se añaden dependencias al proyecto.
- Histórico intacto: [v1 PNG](modelo-entidad-relacion-v1-2026-10-02.png) y [v1 SVG](modelo-entidad-relacion-v1-2026-10-02.svg).

Para futuras revisiones, editar DOT y volver a generar ambos formatos con Graphviz (`dot -Tsvg fuente.dot -o salida.svg`) y un rasterizador SVG. Estas herramientas son de documentación, no requisitos de ejecución de la aplicación. El diagrama completo requiere zoom; no está diseñado para reducir sus 18 tablas a una sola página A4. Los tipos y nombres se corresponden con el SQL; `TIMESTAMPTZ` abrevia `TIMESTAMP WITH TIME ZONE`. `?` indica nulabilidad estructural, aunque un CHECK puede exigir un valor según el tipo de fila.

## Evolución respecto al diagrama v1

La fecha del nombre v1 se conserva; no se usa para fechar las implementaciones. El SVG v1 reutiliza una imagen base y superpone una propuesta de participación. V2 reconstruye el conjunto desde el esquema actual:

| Elemento | Corrección o aclaración documental |
|---|---|
| Farmacia–Ayuntamiento | Se explicita la asignación opcional: cada farmacia tiene 0..1 Ayuntamiento y cada Ayuntamiento 0..N farmacias. La obligatoriedad del alta API no equivale a NOT NULL SQL. |
| Entrega–Periodo | Se corrige la representación N:M de v1: cada entrega tiene exactamente una farmacia y un periodo; cada uno admite 0..N entregas. UNIQUE de farmacia/periodo. |
| Entrega | Se incorporan `denominacion_farmacia` y `cif_nif_farmacia`, snapshots A existentes. |
| Medicamento | Se incorpora `situacion_comercial` independiente de `estado`; la admisión de BAJA autorizada exige decisión, conforme al servicio actual de Entregas. |
| Precinto | Se añade `precio_referencia` junto al aplicado y se muestran unicidades de posición y pareja id/entrega. No existe tabla PAQUETE. |
| Participación | Deja de presentarse como propuesta: tabla real con ID, FK a facturación/entrega, entrega única, B e importe. Su acceso a precintos pasa por la entrega, sin FK directa a cada precinto. |
| Detalle de liquidación | Incluye `participacion_facturacion_id` obligatorio y único. No enlaza directamente con farmacia ni utiliza SOE como FK; conserva C/cuenta/importe. |
| Operación de lectura | Se añade la entidad técnica con UUID, solicitud, retirada y referencias alternativas; se distinguen FK compuestas y conservación de claves sin contenido. |
| Facturación | Se añaden `estado` y `nombre_presidente_historico`; se distingue SIN_FACTURAR deducido de los tres estados almacenados. |
| Facturas | Se explicita UNIQUE por facturación/tipo y por tipo/número oficial, y el carácter condicional de los campos de comisión. |
| Configuración documental | Se incorpora `datos_emisor`; el índice sobre constante limita a 0..1 fila, sin FK a facturación. Firma/mostrar_firma existen en SQL, pero su gestión no está implementada en el alcance documental actual. |
| Cardinalidades y presentación | Se muestran mínimos SQL cero para colecciones sin obligatoriedad de hijos. Se separan los mínimos de emisión/confirmación de las garantías estructurales; tablas completas sin el recorte inferior ni superposiciones de v1. |

## Relaciones: SQL frente a reglas del servicio

En la tabla, «1 → 0..N» significa que cada hijo tiene exactamente un padre y que el padre puede tener cero o más hijos. Los extremos opcionales se explicitan. Las FK garantizan existencia y las UNIQUE los máximos indicados; no obligan a crear hijos.

| Relación | Garantía estructural de `schema.sql` | Regla adicional implementada en servicios |
|---|---|---|
| Ayuntamiento–Farmacia | 0..1 Ayuntamiento por farmacia; 0..N farmacias por Ayuntamiento. | Cambiar asignación solo sin actividad; Entregas revalida asociación bajo bloqueo municipal. |
| Ayuntamiento/Medicamento–asociación | Cada asociación tiene uno de cada; pareja única. | GENERAL conserva asociaciones sin aplicarlas; ESPECIFICA exige también autorización general. |
| Farmacia/Periodo–Entrega | Cada entrega tiene una farmacia y un periodo; pareja única; ambos padres tienen 0..N entregas. | Sin farmacia asignada no se crea entrega; A se captura solo al crear. |
| Entrega/Medicamento–Precinto | Cada precinto tiene una entrega y un medicamento; padres con 0..N; posición única y 1–15. | Comprobar admisión al guardar; asignar paquetes y conservar precios propios; al borrar solo se renumeran posiciones del paquete afectado. |
| Entrega–Incidencia | 1 → 0..N, cuatro motivos por CHECK; sin FK a medicamento. | Confirmar/apartar según evaluación; no entra en paquetes ni importes facturados. |
| Entrega–Operación | 1 → 0..N; UNIQUE entrega/UUID. | Guardado atómico de lectura y recibo; reenvío igual recupera sin duplicar, contenido distinto entra en conflicto. |
| Precinto/Incidencia–Operación | Cada destino tiene 0..1 recibo; cada referencia es opcional y compuesta con entrega. Activa exige exactamente un destino; retirada ninguno. | Retirar/purgar antes del borrado para conservar clave e impedir recreación tardía. La cascada SQL sola no realiza este protocolo. |
| Ayuntamiento/Periodo–Facturación | Cada cabecera tiene uno de cada; UNIQUE Ayuntamiento/periodo/tipo; tipo TD y tres estados válidos. | Último día del periodo como fecha funcional y transiciones con validación financiera. |
| Facturación/Entrega–Participación | Cada participación tiene una cabecera y una entrega; entrega única; cabecera con 0..N y entrega con 0..1 participación. | Coincidencia municipal/periodo, aptos y sumas; primera emisión con ≥1 participante. B congelado tras emitir; reapertura conserva participantes/B incluso si alguno queda a cero. |
| Facturación–Factura | 1 → 0..2 por CHECK de tipo y UNIQUE cabecera/tipo. | Crear ambas conjuntamente, solo con aptos; reemitir actualiza las mismas filas y conserva números/tasas. SQL por sí solo permite solo una. |
| Configuración de facturación–Factura | Configuración con 0..N facturas; FK obligatoria para COMISION y nula para PRECINTOS por CHECK. | Vigencia única para la fecha funcional; serialización contra solapamientos; tasas históricas no sustituidas en reemisión. |
| Factura–Cobro | 1 → 0..1 por UNIQUE factura; importe no negativo. | Estado EMITIDA e importe igual al total; cobro completo e independiente de cada factura. |
| Facturación–Reapertura | 1 → 0..N; fecha automática y motivo TEXT NOT NULL. | Motivo no vacío, límite de longitud y ausencia de cualquier cobro; transición de EMITIDA a REABIERTA. |
| Facturación–Pago | 1 → 0..1 por UNIQUE facturación. | Solo después del cobro íntegro de PRECINTOS, sin exigir COMISION. Confirmación de lote, no transferencia acreditada. |
| Pago/Participación–Detalle | Cada detalle tiene uno de cada; pago con 0..N y participación con 0..1 detalle por UNIQUE. | Participaciones del mismo proceso, cobertura completa una vez, ≥1 detalle, importe completo y suma igual a PRECINTOS; datos C/cuenta revisados y validación bancaria. |
| Configuración documental | 0..1 fila global por índice único; sin FK a documentos/facturas. | Validación de emisor/logo; captura del presidente en primera emisión; configuración visual actual en reimpresión. |

No hay triggers que impongan estas transiciones ni un historial automático de todas las escrituras. CHECK/NOT NULL no garantizan textos no vacíos ni la inmutabilidad de snapshots: esas reglas dependen también de validación y del protocolo de servicios.

## Estados e histórico

- `SIN_FACTURAR`: ausencia de cabecera TD, no valor permitido por el CHECK de FACTURACION.
- `REVISION`: entrega y B editables sin cobros; preparar revisión no emite facturas.
- `EMITIDA`: bloquea entregas/B; par de facturas guardado. Reapertura visual con motivo solo si no hay cobros.
- `REABIERTA`: permite correcciones sin cobros; conserva B, participantes y números. Solo reemisión conjunta actualiza las facturas, con las tasas históricas. No permite agregar nuevas participaciones. Cero aptos impide reemitir aunque se conserven documentos anteriores.

A (entrega), B (participación) y C/cuenta (detalle) son hechos distintos. Los importes/tasas de factura, el presidente de primera emisión y los cobros se conservan; el maestro actual no los sustituye. Los dos precios del precinto no registran todas las correcciones intermedias ni su autor/fecha. Para filas históricas adaptadas por 005, referencia = aplicado conservado al migrar, sin garantía de catálogo original. Logo/emisor y datos municipales de reimpresión son actuales: no se promete una copia inmutable completa del documento.

## Hallazgos técnicos separados, sin corregir código ni SQL

1. **Actualización de bases antiguas incompleta como secuencia automatizable.** `db/README.md` registra adaptaciones directas sin migración versionada para estados y configuración documental; los archivos 001–005 no reconstruyen necesariamente todas las estructuras desde cualquier instalación antigua. Alcance: reproducibilidad de actualizaciones, no alteración de datos observada. La instalación desde base vacía utiliza el esquema completo. Queda para otra tarea verificar cada destino y planificar su adaptación.
2. **`db:check` es parcial.** `src/check-db.js` verifica conexión y ciertas estructuras financieras/estado/referencia; no comprueba íntegramente las 18 tablas ni toda la configuración documental/lecturas. Por lectura estática, su éxito no acredita compatibilidad completa. No se ha ejecutado ni reproducido un fallo en una base.
3. **FK de detalle sin índice por lote.** `detalle_pago_farmacia.pago_farmacias_id` tiene FK, pero ningún índice propio ni PK/UNIQUE que empiece por esa columna en `schema.sql`. La consulta del lote en `facturacion.repository.js` filtra por ella. Es una posible cuestión de rendimiento a medir con volumen/planes; no demuestra error funcional ni justifica cambiar SQL en esta tarea.

## Comprobaciones de esta revisión

- Contraste estático entre alcance del README, configuración de ejemplo, scripts y código actual; comandos de instalación/tests documentados, sin ejecutarlos ni conectarse a PostgreSQL.
- Comprobación de **72 enlaces locales en los nueve Markdown afectados**: destinos existentes. Las URLs locales son ejemplos de arranque, no comprobaciones HTTP; la URL desplegada, presentación y vídeo siguen pendientes.
- Comparación de las **18 tablas, 137 columnas y 22 FK** del SQL con la fuente DOT, incluidas nulabilidad y referencias. Revisión manual de cardinalidades, unicidades, estados y reglas entre tablas.
- Regeneración del SVG desde DOT y del PNG desde SVG: igualdad binaria con los archivos entregados. PNG de **5839 × 7345 px**; SVG vectorial sin imágenes incrustadas.
- Inspección visual del conjunto y de cuatro recortes ampliados (cabecera, lecturas, bloque financiero y parte inferior). Comprobación geométrica del SVG en Edge sin interfaz: 18 tablas, cero textos fuera de sus tablas, cero tablas solapadas y cero elementos fuera del lienzo. El rasterizador muestra correctamente los caracteres; el generador informa un aviso de métricas de fuente para caracteres no ASCII, sin cortes detectados en la salida final.
- Revisión del diff documental y `git diff --check`; comprobación adicional de espacios en archivos nuevos, que no aparecen en un diff ordinario mientras no estén añadidos. No se hacen commits, cambios de rama ni operaciones Git de escritura.
- No se ejecuta la suite por ser un cambio exclusivamente documental. No se ejecutan migraciones ni consultas ni escrituras en bases; no se lee el archivo local de secretos. No se atribuyen a esta tarea resultados de suites citados en MEMORY ni en tareas históricas.

Archivos modificados: `README.md`, `AGENTS.md`, `MEMORY.md`, `db/README.md`, los dos modelos escritos y las especificaciones `facturacion-municipal/spec.md` e `interfaz-entregas-precintos/spec.md` (solo referencias/afirmaciones documentales obsoletas). Archivos nuevos: este registro y el diagrama v2 en DOT/SVG/PNG. V1 queda intacto. No se modifican código funcional, contratos, SQL, dependencias ni configuración de ejecución/despliegue.

## Pendientes de entrega

Confirmado por el autor en esta conversación: alojamiento en Render; URL pública exacta pendiente de confirmar. Presentación y vídeo pendientes de preparar y enlazar. Credenciales mediante formulario de entrega o canal privado, sin publicarlas.

Pendientes: verificar versión PostgreSQL del destino y compatibilidad mínima; comprobar URL, login, conexión, demostración e impresión/descargas en el despliegue. No se afirman disponibilidad, permanencia ni condiciones de alojamiento no comprobadas. Estas carencias impiden declarar completa la entrega académica.
