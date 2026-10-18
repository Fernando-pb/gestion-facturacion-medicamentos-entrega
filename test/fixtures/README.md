# Datos preparados exclusivamente para pruebas

Revisión del árbol de trabajo del 18 de octubre de 2026, previa a una futura copia pública. No modifica el historial privado ni acredita que el resto del repositorio esté libre de datos reales. El agente no ha leído ni cargado `.env`; la ejecución posterior del autor se registra más abajo.

## Procedencia y reproducción

- Los 19 identificadores fiscales de procedencia no confirmada se han sustituido en sus 108 apariciones de 31 archivos por etiquetas `TEST-CIF-0001` a `TEST-CIF-0019`. Se generaron numerando correlativamente las identidades distintas, conservando igualdad, diferencias, espacios y variantes en minúsculas entre fixtures y expectativas. No se conserva una tabla de correspondencias con los datos anteriores. Para nuevos fixtures, usar `TEST-CIF-` más un índice de cuatro cifras; no son NIF/CIF oficiales. Los validadores actuales de estos campos comprueban texto, no un control fiscal.
- Los teléfonos de texto se han sustituido por `TEST-TELEFONO-001`, `TEST-TELEFONO-002` y `TEST-TELEFONO-003`. El caso que rechaza un teléfono numérico usa el entero corto `123`: mantiene el error de tipo, sin simular un número de contacto. Los campos nulos y vacíos permanecen como casos propios.
- [datos-test.js](datos-test.js) genera los componentes bancarios a partir de una semilla entera: entidad y sucursal de cuatro ceros, número de cuenta igual a la semilla rellenada con ceros hasta diez cifras, controles CCC calculados con pesos y módulo 11, y control español de IBAN por módulo 97. La semilla predeterminada es `101`; `202` representa una cuenta corregida diferente. Se obtiene un objeto nuevo por llamada. No se han usado datos de personas, de la aplicación real ni de un catálogo de cuentas.
- Los titulares de los cuatro fixtures bancarios se identifican como `TEST` o ficticios. Las respuestas simuladas, campos editados, snapshots y expectativas de exportación usan los mismos datos sustitutos. La edición de cuenta en Cobros cambia también sus controles para conservar un caso válido completo.

**Uso exclusivo de prueba. Los controles matemáticos correctos no garantizan que un IBAN no esté asignado a una cuenta real.** Los componentes de ceros son una elección reproducible del fixture, no una afirmación sobre la existencia o asignación de entidades/cuentas. No usar estas cuentas para pagos, transferencias, demostraciones con dinero ni configuración real.

## Cobertura conservada

Los cuatro archivos bancarios son [Cobros en interfaz](../cobros-municipales-interfaz.test.js), [esquema](../facturacion-esquema.test.js), [informe anual](../facturacion-informe-anual.test.js) y [liquidación](../facturacion-liquidacion.test.js). Los dos últimos comparten el generador en lugar de mantener copias con un número literal.

Se conservan importes, fechas, estados, duplicados, distinción entre identidades actuales e históricas, rechazos y comprobaciones XML. La prueba de esquema sigue verificando relaciones y unicidad por SQL; sus componentes deliberadamente mal formados no representan una cuenta válida ni prueban controles bancarios. Los casos inválidos de liquidación conservan sus mutaciones y su resultado esperado: IBAN erróneo, país distinto, entidad no numérica, longitudes incorrectas y CCC erróneo, además de los casos no bancarios.

[datos-test.test.js](../datos-test.test.js) comprueba con el validador funcional actual que ambas semillas son aceptadas y que se rechaza cada control por separado: IBAN alterado con CCC correcto y CCC alterado con IBAN recalculado y resto correcto. No se han modificado validaciones funcionales, SQL de la aplicación ni dependencias.

Además de los cuatro archivos bancarios, las sustituciones alcanzan fixtures fiscales de autenticación, Ayuntamientos, Farmacias, Medicamentos, Entregas, facturación e informe anual. Los teléfonos se revisaron en `ayuntamientos.test.js`, `ayuntamientos-listado.test.js` y `ayuntamiento.validation.test.js`: en total, 32 archivos existentes de pruebas modificados, más la utilidad y su nueva prueba.

## Verificación realizada

277 pruebas aprobadas en 11 archivos (Vitest instalado en este repositorio). El primer intento dentro del entorno restringido falló por conexiones HTTP locales rechazadas y acceso a temporales; la repetición autorizada fuera de ese entorno pasó. Se desactivó explícitamente la carga de archivos de entorno de Vite con `envDir: false`, sin cambiar la configuración del proyecto. En esa fase, el agente no ejecutó la suite completa ni los 22 archivos de integración afectados; la verificación posterior del autor figura a continuación.

Diff revisado sin reproducir los valores anteriores; `git diff --check` sin incidencias. Comprobadas la sintaxis de los 34 archivos JavaScript afectados/nuevos, su UTF-8 junto con la documentación modificada, siete enlaces locales y los espacios finales de los archivos nuevos. En 25 archivos, una comparación que normaliza los finales de línea confirma que solo cambian los identificadores fiscales; el resto se revisó por sus cambios de datos bancarios/teléfonos y expectativas. Un barrido de 241 rutas textuales versionadas no encontró más literales con los patrones de NIF/CIF o IBAN completo revisados; esa búsqueda limitada no acredita ausencia de otros datos reales ni sustituye la revisión visual.

Comando PowerShell utilizado para las pruebas sin PostgreSQL (autenticación simula el acceso a datos):

```powershell
@'
import { startVitest } from 'vitest/node';
const files = [
  'test/datos-test.test.js', 'test/auth.test.js',
  'test/ayuntamiento.validation.test.js', 'test/ayuntamientos-api.test.js',
  'test/ayuntamientos-listado.test.js', 'test/cobros-municipales-interfaz.test.js',
  'test/entregas-interfaz.test.js', 'test/facturacion-municipal-interfaz.test.js',
  'test/farmacia.validation.test.js', 'test/farmacias-interfaz.test.js',
  'test/informe-anual-interfaz.test.js',
];
await startVitest('test', files,
  { watch: false, fileParallelism: false, config: false },
  { envDir: false, configFile: false });
'@ | node --input-type=module
```

## Verificación posterior comunicada por el autor

El autor comunica la siguiente ejecución del 18/10/2026:

- Base local: `gestion_facturacion_medicamentos_test`.
- Resultado: **50 archivos y 1374 pruebas aprobados**.
- Comando ejecutado por el autor:

```powershell
node --env-file=.env node_modules/vitest/vitest.mjs run --no-file-parallelism
```

Esta verificación de la suite completa sustituye la indicación de los 22 archivos de integración pendientes de esta tarea. El resultado se registra como verificación realizada y comunicada por el autor; el agente no ha repetido las pruebas ni ha leído el archivo de entorno.

Antes de preparar la copia pública quedan pendientes una revisión final del árbol que se vaya a publicar y la revisión visual de imágenes/documentos y de futuros recursos de entrega. Esta tarea no sustituye una auditoría completa, no elimina los valores antiguos del historial privado y no crea todavía una copia pública.
