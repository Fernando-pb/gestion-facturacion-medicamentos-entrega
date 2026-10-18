# Gestión de facturación de medicamentos

Proyecto Final de Máster para modernizar una aplicación interna desarrollada en **Microsoft Access**. El proceso consiste en recibir los precintos presentados por farmacias, comprobar los medicamentos admitidos, facturar mensualmente a los ayuntamientos, registrar sus cobros y preparar la liquidación a las farmacias.

La aplicación web organiza ese recorrido en módulos y separa los datos actuales de los importes e identidades que deben conservarse. Se prioriza un MVP comprensible, mantenible y demostrable con datos ficticios. No incluye una importación automática de Access ni una conexión con la aplicación corporativa.

Estado contrastado con el código y `db/schema.sql` del repositorio actual el **18 de octubre de 2026**. Esta fecha corresponde a una revisión documental, no a una migración ni a una nueva ejecución de pruebas funcionales.

## Funcionalidades implementadas

| Área | Funciones disponibles en API e interfaz |
|---|---|
| Ayuntamientos | Alta, consulta, edición y activación/inactivación; modalidad general o específica de medicamentos; gestión de medicamentos asociados y asignación municipal de farmacias. |
| Farmacias | Alta, consulta, búsqueda y edición de datos actuales. Consulta de farmacias sin Ayuntamiento; asignación, reasignación o retirada desde la gestión municipal solo sin actividad. El alta exige Ayuntamiento y la edición general no cambia la asignación. |
| Medicamentos | Alta, listado, consulta y edición de código nacional, precio, autorización general (`ACTIVO`/`INACTIVO`), situación comercial (`ALTA`/`BAJA`) y clasificación. Tipo de facturación limitado a `TD`. |
| Entregas y precintos | Apertura/recuperación por farmacia y mes/año, listado de entregas registradas, declarados opcionales, lecturas, decisión ante baja comercial, incidencias, paquetes de hasta 15 aptos, totales y diferencias. Eliminación de lecturas erróneas y corrección individual de precio cuando el estado financiero lo permite. |
| Facturación municipal | Selección de parejas Ayuntamiento/periodo pendientes, revisión de participantes, corrección de identidad antes de emitir, previsualización y emisión conjunta de PRECINTOS y GASTOS/COMISIÓN. Listado de emisiones, filtros de cobro y **reapertura visual** controlada desde el listado. |
| Cobros y liquidaciones | Cobro completo e independiente de cada factura; estados individuales y conjunto. Preparación, revisión y confirmación del lote completo a farmacias tras cobrar PRECINTOS; consulta histórica y exportación XML compatible con Excel para Contabilidad. |
| Documentos | Facturas de PRECINTOS y COMISIÓN, relación agregada por farmacia y gastos globales. Impresión individual o conjunta de facturas y guardado como PDF desde el navegador. Configuración del emisor, logo y presidente desde la pantalla documental. |
| Configuración e informes | Vigencias de comisión e IVA. Informe anual operativo por Ayuntamiento/farmacia y trimestre del periodo facturado, con meses opcionales y exportación XML compatible con Excel. |
| Acceso | Cuenta única de demostración, inicio/cierre de sesión, protección de páginas/API privadas y control de origen en escrituras. |

Inicio agrupa los accesos en Gestión diaria, Datos maestros, Informes y Configuración. Contratos y evidencias por módulo: [docs/specs](docs/specs/).

En Cobros y liquidaciones, las emisiones se ordenan por periodo descendente y Ayuntamiento alfabético. El listado muestra números oficiales, importes y estados de PRECINTOS y GASTOS/COMISIÓN, el estado conjunto Pendiente/Parcial/Cobrada y la fecha prevista de liquidación o «Sin fecha prevista». Los filtros por Ayuntamiento, periodo y estado conjunto se combinan; al abrir el detalle y volver se conservan. Esa fecha y la liquidación confirmada no acreditan una transferencia bancaria.

## Límites del MVP

- Solo se implementa el tipo `TD`; no hay cobros parciales ni liquidaciones parciales del lote. «Parcial» en Cobros significa que una de las dos facturas está cobrada; cada factura se cobra íntegramente.
- La liquidación confirmada conserva los datos revisados y una fecha prevista. **No ejecuta ni verifica transferencias bancarias**, ni acredita un pago real.
- Los documentos son HTML imprimible. No existe generación de PDF en el servidor. Las exportaciones son Excel XML, no archivos `.xlsx` ni remesas bancarias.
- El informe anual es operativo: no implementa el Modelo 347 ni una declaración fiscal. No hay informe de deuda independiente; los filtros y estados de cobro permiten consultar facturas pendientes.
- Se conservan snapshots financieros y fecha/motivo de reapertura, pero no existe auditoría completa de cada edición, valor intermedio, autor o decisión histórica de admisión. No hay historial general de titulares, asignaciones ni precios del catálogo.
- No se incluyen administración de usuarios/roles, recuperación de contraseña, gestión de firmas, importaciones automáticas, resolución/reincorporación de incidencias ni borrado de entregas completas. La separación visual de entregas pendientes/facturadas y el buscador financiero histórico específico siguen fuera del alcance implementado.
- El control del dígito EAN-13 y la validación con lector físico real siguen pendientes. Se admite entrada manual de seis dígitos o trece con prefijo `847000`, según el contrato actual.

## Tecnologías y arquitectura

JavaScript con módulos ES, **Node.js 24 o superior** (requisito de `package.json`), Express 5, PostgreSQL y SQL explícito mediante `pg`. Zod valida entradas; Vitest y Supertest soportan las pruebas. Los rangos declarados están en [package.json](package.json) y [package-lock.json](package-lock.json) fija la instalación reproducible.

Es un **monolito modular**: Express sirve la API REST y los HTML, CSS y módulos JavaScript de `public/`. Las rutas derivan a controladores, los servicios coordinan reglas/transacciones cuando son necesarios y los repositorios contienen SQL parametrizado. Los mantenimientos sencillos siguen sus controladores y repositorios existentes. No hay compilación del frontend.

PostgreSQL protege claves, referencias, unicidades y restricciones de fila. Los servicios verifican reglas entre tablas y estados financieros dentro de transacciones, compartiendo el bloqueo municipal con Entregas. Los importes se almacenan como `NUMERIC`; la API usa cadenas decimales para conservar precisión. No se utilizan ORM, TypeScript ni Docker.

## Requisitos e instalación desde una base vacía

Se necesitan Node.js compatible con el requisito anterior, npm, PostgreSQL en ejecución, herramientas `psql`/`createdb`, un usuario con permisos sobre la base y un navegador. **La versión mínima de PostgreSQL y la versión concreta usada para la evaluación están pendientes de verificar**; no se deducen del esquema.

Desde la raíz de una copia del repositorio:

```powershell
npm ci
```

Crear una base **nueva y vacía** y cargar el esquema completo. Estos comandos son instrucciones para quien instala; no se han ejecutado durante esta revisión. Sustituir host, puerto y usuario cuando corresponda; las herramientas solicitarán la contraseña si es necesaria.

```powershell
createdb -h localhost -p 5432 -U postgres gestion_facturacion_medicamentos
psql -h localhost -p 5432 -U postgres -d gestion_facturacion_medicamentos -v ON_ERROR_STOP=1 -f db/schema.sql
```

[db/schema.sql](db/schema.sql) crea la estructura actual; no carga datos de demostración, porcentajes ni usuarios. Preparar maestros/configuración desde la aplicación con datos ficticios. Una base nueva no necesita ejecutar después los archivos `db/updates/`.

**Instalaciones existentes:** no volver a cargar `schema.sql`. Consultar [db/README.md](db/README.md), revisar estructura/datos y planificar la adaptación individual. Los scripts incrementales no cubren todas las adaptaciones históricas documentadas; no ejecutarlos indiscriminadamente.

## Configuración sin secretos publicados

En una instalación local nueva, copiar [.env.example](.env.example) a un archivo local `.env` y completar sus valores en privado. No sobrescribir una configuración existente. `.env` está excluido del repositorio. No incorporar contraseñas, tokens ni datos reales a documentos, capturas o pruebas.

| Variable | Uso y ejemplo no sensible |
|---|---|
| `PORT` | Puerto HTTP; predeterminado `3000`. |
| `TRUST_PROXY_HOPS` | `0` por defecto: acceso directo, sin confiar en cabeceras reenviadas. `1`: confiar solo en el proxy inmediato del despliegue descrito abajo. Otros valores se rechazan al arrancar. |
| `DB_HOST` | Servidor PostgreSQL; ejemplo `localhost`. |
| `DB_PORT` | Puerto PostgreSQL; predeterminado `5432`. |
| `DB_NAME` | Base de desarrollo; ejemplo `gestion_facturacion_medicamentos`. |
| `DB_USER` | Usuario PostgreSQL autorizado; ejemplo local `postgres`. |
| `DB_PASSWORD` | Contraseña privada de PostgreSQL; completar localmente, sin publicarla. |
| `DB_SSL` | Solo el texto `true` activa TLS con validación de certificado (`rejectUnauthorized: true`); ejemplo local `false`. |
| `DEMO_USERNAME` | Nombre de la cuenta de demostración; elegir y comunicar en privado. |
| `DEMO_PASSWORD` | Contraseña privada, aleatoria y de al menos 12 caracteres. |
| `APP_ORIGIN` | Origen exacto del navegador; ejemplo `http://localhost:3000`, sin ruta ni barra final. |
| `NODE_ENV` | No figura en el ejemplo. `production` en despliegue HTTPS; `test` reservado a pruebas y rechazado por el servidor al arrancar. |

El servidor no arranca si faltan las credenciales de demostración, la contraseña es demasiado corta o el origen es inválido. `APP_ORIGIN` debe coincidir con la URL usada, incluido puerto/esquema: si se cambia a `127.0.0.1` o a otro puerto, ajustar esa variable. Con proxy se utiliza el origen HTTPS externo; no se deduce de `Host` ni de cabeceras del proxy.

Las escrituras, login y logout exigen `Origin` igual a `APP_ORIGIN` (403 si es externa, ausente o `null`). El navegador lo envía en las peticiones actuales; otros clientes HTTP deben incluirlo explícitamente. GET, HEAD y OPTIONS no lo requieren.

La sesión opaca vive en memoria hasta ocho horas; cerrar sesión la invalida. La cookie incluye `HttpOnly` y `SameSite=Lax`, además de `Secure` en producción. El control de intentos limita cinco fallos por IP en 15 minutos, reservando también plazas para verificaciones pendientes. Node.js deriva y verifica la contraseña con `scrypt`. Reiniciar el proceso invalida sesiones y reinicia el limitador: este diseño presupone una sola instancia de demostración.

La cookie se marca `Secure` por la configuración de producción, incluso si la conexión interna del proxy a Node es HTTP; no se retira ese atributo por cabeceras del cliente. `trust proxy` permite interpretar `request.secure` y obtener la IP para el limitador cuando se habilita explícitamente. En desarrollo local HTTP mantener `TRUST_PROXY_HOPS=0` y `NODE_ENV=development`: las cabeceras reenviadas se ignoran y la cookie no lleva `Secure`. `APP_ORIGIN` siempre se compara con el valor configurado, sin reconstruirlo a partir del proxy.

Los errores inesperados de las rutas, incluido el login, devuelven **500 JSON** con `Error interno del servidor.`, sin mensaje original ni traza. El registro del servidor conserva método, módulo, plantilla de ruta, tipo conocido y código técnico acotado; no incluye mensajes arbitrarios, SQL, trazas, URL/query, cuerpos, cabeceras, cookies ni credenciales. Las respuestas funcionales conservan sus mensajes y estados. JSON mal formado devuelve 400; cuerpo excesivo, 413; codificación no admitida, 415, con mensajes genéricos. La configuración documental conserva su mensaje específico de límite de logo. Si una respuesta ya empezó, se cierra la conexión sin añadir detalles internos.

## Ejecución local y conexión

```powershell
npm run db:check
npm run dev
```

`db:check` carga la configuración local y consulta conexión y ciertas estructuras financieras/estado/precio de referencia. Su éxito no certifica todo el esquema ni las reglas de negocio. Revisar el nombre de base mostrado. [src/check-db.js](src/check-db.js) detalla el alcance.

`npm run dev` usa `node --watch`; `npm start` ejecuta una vez. Ambos cargan el entorno local si existe. Abrir [Inicio local](http://localhost:3000/) e iniciar sesión. [GET /health local](http://localhost:3000/health) devuelve `{"status":"ok"}` si Express responde; **no comprueba PostgreSQL**. Son URLs del puerto local de ejemplo.

Mantener una sola instancia por puerto. Ante `EADDRINUSE`, detener con Ctrl+C la instancia anterior de este proyecto y volver a arrancar; el servidor no elige otro puerto ni detiene procesos. No detener procesos ajenos.

## Base dedicada de pruebas

Las pruebas de integración/API escriben y limpian datos ficticios; algunas prueban SQL en esquemas temporales. Usar exclusivamente una base local dedicada llamada **`gestion_facturacion_medicamentos_test`**, nunca desarrollo ni despliegue. Los tests comprueban ese nombre y varios exigen también host local.

Preparación inicial, solo si esa base todavía no existe:

```powershell
createdb -h localhost -p 5432 -U postgres gestion_facturacion_medicamentos_test
psql -h localhost -p 5432 -U postgres -d gestion_facturacion_medicamentos_test -v ON_ERROR_STOP=1 -f db/schema.sql
```

En **otra terminal PowerShell**, desde la raíz y con las credenciales locales configuradas, fijar el destino antes de ejecutar. Las variables del proceso prevalecen sobre las cargadas por `--env-file`:

```powershell
$env:DB_HOST = 'localhost'
$env:DB_PORT = '5432'
$env:DB_NAME = 'gestion_facturacion_medicamentos_test'
$env:DB_SSL = 'false'
$env:NODE_ENV = 'test'
$env:TRUST_PROXY_HOPS = '0'
npm run db:check
node --env-file=.env node_modules/vitest/vitest.mjs run --no-file-parallelism
```

Confirmar el nombre mostrado por `db:check` antes de continuar. El comando directo carga el entorno explícitamente: `npm test` ejecuta `vitest run` y **no carga `.env` por sí solo**. Si las variables de conexión ya están exportadas, el equivalente es `npm test -- --no-file-parallelism`. Se evita el paralelismo entre archivos porque hay pruebas con tablas/consultas globales compartidas. Cerrar esta terminal al terminar evita reutilizar su entorno para desarrollo.

No se ha ejecutado la suite ni consultado bases durante esta tarea documental. Las evidencias previas en los `tasks.md` no constituyen una nueva validación de esta copia. Las comprobaciones de esta tarea están en [la revisión documental](docs/modelo-datos/revision-documental-v2-2026-10-18.md).

## Estructura del repositorio

```text
public/                         HTML y recursos CSS/JavaScript de las pantallas
src/
  app.js                        API, autenticación y archivos estáticos
  server.js                     Validación de acceso y arranque HTTP
  db.js, check-db.js             Pool PostgreSQL y comprobación de estructura
  auth/                         Cuenta y sesiones de demostración
  ayuntamientos/                Maestro, farmacias y medicamentos asociados
  farmacias/, medicamentos/     Catálogos
  entregas/                     Entregas, admisión, lecturas y precios
  facturacion/                  Revisión, emisión, cobros, liquidación e informe anual
  configuracion-facturacion/    Vigencias de comisión e IVA
  documentos/                   Configuración y consulta documental
db/                            Esquema, updates SQL y README de instalación
test/                          Pruebas unitarias, API, integración e interfaz
  browser/                     Comprobación visual de Cobros
docs/
  guia-contexto-tfm.md          Guía canónica de contexto y decisiones
  modelo-datos/                Modelos, diagramas e histórico de revisión
  specs/                       spec.md, plan.md y tasks.md por módulo/interfaz
AGENTS.md, MEMORY.md             Instrucciones y memoria de trabajo
package.json, package-lock.json Scripts y dependencias
.env.example                    Nombres y ejemplos de configuración sin credenciales
```

## Reglas financieras y conservación histórica

1. Una farmacia tiene cero o un Ayuntamiento actual. La asignación solo cambia sin entregas ni precintos; sin asignación no abre entregas. Cada entrega pertenece a una farmacia y un periodo mensual, con unicidad de esa pareja.
2. Cada precinto admitido se factura una vez en el periodo de su entrega. Incidencias fuera del cálculo y paquetes; declarados/diferencias informativos. La autorización se comprueba al registrar: `ACTIVO`, lista aplicable y situación comercial. Una `BAJA` autorizada exige elegir admitir o apartar; `INACTIVO` nunca se admite. Cambios posteriores del catálogo no invalidan lecturas aceptadas.
3. Cada nueva lectura captura `precio_referencia` y `precio_aplicado` desde el maestro. Corregir precio cambia solo el aplicado de esa lectura, sin alterar referencia, maestro ni otras filas. Para datos anteriores a 005, la referencia es el aplicado conservado al migrar, sin garantía del precio original de catálogo.
4. Sin cabecera TD (`SIN_FACTURAR`, estado deducido), en `REVISION` y en `REABIERTA` sin cobros se permiten correcciones de entregas/lecturas sin exigir preparar revisión. `EMITIDA` bloquea. B solo es editable en `REVISION` y queda congelado desde la primera emisión.
5. La emisión crea conjuntamente PRECINTOS y COMISIÓN y marca `EMITIDA`. Exige aptos, revisión actualizada, dos números oficiales aportados por el usuario y una única vigencia para el último día del periodo. Números únicos por tipo/serie, sin generación automática. La comisión se calcula sobre PRECINTOS y el IVA sobre la comisión redondeada, con cálculos a dos decimales y tasas conservadas.
6. **Reabrir facturación** está disponible en el listado municipal para una emisión sin cobros, con motivo y confirmación. Guarda fecha/motivo y conserva cabecera, participaciones, B y números. La reemisión conjunta actualiza las dos facturas originales con sus tasas históricas, sin crear una nueva versión. En `REABIERTA` no se imprimen documentos y el informe anual la excluye con advertencia.
7. PRECINTOS y COMISIÓN se cobran independientemente, una sola vez por su total. Cualquier cobro bloquea reapertura/correcciones. El justificante es una referencia textual opcional, no un archivo bancario verificado.
8. Solo el cobro íntegro de PRECINTOS permite preparar la liquidación completa; COMISIÓN no es requisito. Preparar propone datos actuales sin persistir lote. Antes de confirmar se revisan destinatarios, componentes de cuenta española y fecha común; se validan controles bancarios. La fecha sugerida es el siguiente lunes–viernes, sin festivos. Confirmar guarda un lote y un detalle por participación en transacción, sin ejecución bancaria ni edición posterior.
9. A es denominación/CIF al crear la entrega; B, identidad de la participación al emitir; C, destinatario y cuenta revisados al confirmar liquidación. El detalle se enlaza a la participación, esta a la entrega y esta a la farmacia por ID; los SOE históricos no son FK. Cambios del catálogo no reescriben estos snapshots.
10. El presidente se captura en la primera emisión; logo, emisor y datos municipales proceden de configuración/maestros actuales al reimprimir. No todo el documento es una fotografía histórica inmutable. Las FK restringen borrados relacionados; la conservación y las transiciones financieras también dependen de los servicios.

El [modelo conceptual](docs/modelo-datos/modelo-datos.md), el [modelo lógico](docs/modelo-datos/modelo-logico-postgresql.md) y la [revisión del diagrama](docs/modelo-datos/revision-documental-v2-2026-10-18.md) distinguen garantías SQL y reglas de aplicación.

## Recorrido breve de demostración

Usar datos ficticios en una instalación preparada para demostrar, no la base dedicada de tests:

1. Iniciar sesión. En Datos maestros, crear Ayuntamiento, farmacia asignada y medicamento `ACTIVO`/`ALTA`/`TD` con código manual de seis dígitos. Si la lista es específica, asociarlo al Ayuntamiento.
2. En Configuración → Comisión e IVA, crear una vigencia que cubra el último día del mes elegido con los porcentajes de demostración acordados; no se precargan.
3. **Antes de la primera emisión**, abrir Configuración de documentos (`/configuracion-documentos.html`) y guardar los datos del centro emisor, el presidente y el logo de demostración.
4. En Entregas, abrir farmacia/mes/año, informar declarados si procede, registrar lecturas y mostrar paquetes, totales e incidencias. Corregir un precio y comprobar que no cambia el maestro.
5. En Facturación municipal → Nueva facturación, seleccionar la pareja pendiente, revisar datos de farmacias, previsualizar e introducir dos números oficiales ficticios para emitir. Opcionalmente, **antes de cobrar**, reabrir con motivo, corregir y reemitir conservando números.
6. Abrir Ver documentos y consultar las cuatro vistas: factura de PRECINTOS, factura de GASTOS/COMISIÓN, resumen global de precintos y detalle global de gastos. Mostrar la impresión individual o conjunta de las facturas y el guardado como PDF desde el navegador.
7. En Cobros y liquidaciones, cobrar PRECINTOS por su total; preparar/revisar titulares y cuentas ficticias válidas y fecha, confirmar y descargar XML. Mostrar cobro independiente de COMISIÓN y bloqueo de reapertura tras cualquier cobro.
8. Consultar el informe anual y exportar trimestres con o sin meses. Explicar su carácter operativo y la ausencia de conexión bancaria.

El presidente histórico se captura en la primera emisión. Cambiar después el presidente en la configuración no modifica ni completa retrospectivamente ese dato en una factura ya emitida, tampoco al reemitirla.

## Despliegue y acceso para evaluación

El autor confirma que la aplicación está desplegada en **Render**. **URL pública exacta: pendiente de confirmar e incorporar antes de la entrega.** En esta revisión no se ha comprobado el despliegue, su disponibilidad, sus datos ni sus condiciones de acceso.

El proceso previsto es `npm start` con dependencias instaladas y PostgreSQL preparado. Configurar las variables mediante el gestor privado del alojamiento, `NODE_ENV=production`, `APP_ORIGIN` con el origen HTTPS público exacto y la conexión/TLS exigidos por el proveedor. No hay un procedimiento automatizado de despliegue en el repositorio. La sesión en memoria presupone una instancia y pierde sesiones al reiniciarse; no se afirma qué configuración tiene el servicio actual.

**Proxy de Render:** habilitar `TRUST_PROXY_HOPS=1` para el servicio accesible únicamente mediante el proxy inmediato de Render, que termina TLS y reenvía HTTP al proceso. Esta configuración sigue el ejemplo oficial de [autenticación de Render](https://render.com/articles/how-to-implement-authentication-and-authorization) y su [descripción del acceso a Web Services](https://render.com/docs/web-services). No se habilita automáticamente por `NODE_ENV` ni se usa `trust proxy=true`: solo se toma el salto inmediato, ignorando los prefijos adicionales de `X-Forwarded-For`. Según [Express](https://expressjs.com/en/guide/behind-proxies/), el proxy debe gestionar las cabeceras reenviadas y no puede haber una ruta pública directa al proceso que evite ese salto. Si se añade otro proxy/CDN o cambia esa topología, revisar el límite de confianza antes de habilitarlo; no ampliar el número de saltos por tanteo. En esta revisión no se ha inspeccionado la topología ni las cabeceras reales del servicio.

**Comprobación manual tras desplegar por el autor:** confirmar una sola instancia, las tres variables `NODE_ENV`, `APP_ORIGIN` y `TRUST_PROXY_HOPS`, y el acceso público exclusivamente mediante el proxy esperado. Desde la URL HTTPS, iniciar sesión, abrir una página y una API privadas, recargar y cerrar sesión; comprobar en las herramientas del navegador los atributos `Secure`, `HttpOnly` y `SameSite=Lax` sin copiar el valor de la cookie. Con la cuenta de demostración y tráfico de prueba, verificar desde dos clientes con IP públicas distintas que el bloqueo por cinco fallos de uno no bloquea al otro y que añadir prefijos a `X-Forwarded-For` no lo evita. Confirmar también el rechazo de un `Origin` ajeno; el origen ausente o `null` ya se comprueba en las pruebas locales. No provocar fallos de infraestructura ni interrupciones de la base de producción para comprobar errores: esos casos se cubren con fallos simulados locales. Las pruebas automatizadas del proxy son locales y no certifican Render.

Las **credenciales de evaluación se facilitarán mediante el formulario de entrega o un canal privado**. No se publican contraseñas. Antes de entregar, verificar URL, login, conexión de la aplicación, recorrido de demostración y descarga/impresión en el despliegue, sin suponer condiciones de disponibilidad no comprobadas.

## Documentación y recursos de entrega

- [Guía de contexto TFM vigente](docs/guia-contexto-tfm.md).
- [Modelo conceptual](docs/modelo-datos/modelo-datos.md) y [modelo lógico PostgreSQL](docs/modelo-datos/modelo-logico-postgresql.md).
- Diagrama vigente **v2 — revisión documental 18/10/2026**: [PNG](docs/modelo-datos/modelo-entidad-relacion-v2-2026-10-18.png), [SVG vectorial](docs/modelo-datos/modelo-entidad-relacion-v2-2026-10-18.svg) y [fuente DOT editable](docs/modelo-datos/modelo-entidad-relacion-v2-2026-10-18.dot).
- [Cambios respecto a v1, garantías y comprobaciones](docs/modelo-datos/revision-documental-v2-2026-10-18.md). [Diagrama v1 histórico](docs/modelo-datos/modelo-entidad-relacion-v1-2026-10-02.png) conservado.
- [Instalación/adaptaciones de base de datos](db/README.md) y [convención de campos decimales](docs/convencion-campos-decimales.md).
- Especificaciones: [Entregas](docs/specs/entregas-precintos/spec.md), [Facturación](docs/specs/facturacion-municipal/spec.md), [su interfaz y reapertura](docs/specs/interfaz-facturacion-municipal/spec.md), [Cobros y liquidaciones](docs/specs/interfaz-cobros-municipales/spec.md), [Documentos](docs/specs/documentos-facturacion/spec.md) e [Informe anual](docs/specs/interfaz-informe-anual/spec.md).
- **Presentación: pendiente de preparar y enlazar antes de la entrega.**
- **Vídeo: pendiente de preparar y enlazar antes de la entrega.**
- **URL de evaluación: pendiente de confirmar e incorporar.**

## Uso de IA

Se utiliza IA como apoyo al análisis, programación, pruebas y revisión documental, bajo revisión del autor, que debe comprender y defender decisiones y código. Esto describe el desarrollo. La aplicación implementada no incorpora un modelo ni llamadas a una API de IA para admitir medicamentos, calcular facturas o liquidar pagos: esas operaciones siguen reglas explícitas del código y PostgreSQL.
