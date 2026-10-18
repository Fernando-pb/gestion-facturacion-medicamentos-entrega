# Especificación funcional: interfaz de Farmacias

## 1. Objetivo y alcance

Definir la pantalla web para consultar y mantener los datos actuales de Farmacias mediante la API existente. La interfaz utiliza HTML, CSS y JavaScript modular del navegador, sin framework ni dependencias nuevas.

Incluye listado, alta y edición de farmacias, visualización de su ayuntamiento asociado y navegación entre las funciones disponibles y la pantalla principal. La consulta individual se realiza desde el flujo de edición, cargando los datos actuales antes de mostrar el formulario.

## 2. Navegación

- La pantalla principal se sirve en `/` desde `public/index.html` y ofrece enlaces a las funciones disponibles: `/ayuntamientos.html`, `/farmacias.html` y `/medicamentos.html`.
- La página de Farmacias incluye «Volver al inicio», enlazado a `/`.
- Ayuntamientos también ofrece regreso a `/`, para permitir el tránsito entre ambas funciones a través del inicio.
- Las rutas se sirven desde el mismo origen. La navegación no introduce destinos para módulos que todavía no existen.

## 3. Listado

La tabla muestra SOE, CIF/NIF, denominación, localidad, provincia, ayuntamiento asociado y acciones. En la columna del ayuntamiento se presenta su denominación y, si la API lo devuelve, el CIF; sin asignación se muestra «Sin Ayuntamiento». Cada fila ofrece «Ver/Editar».

Al cargar se anuncia el estado de espera. Si no hay registros, se presenta un mensaje de lista vacía. Si falla la carga, se comunica el error y se ofrece reintentar. Después de una creación o edición correcta, la pantalla vuelve a cargar el listado para reflejar los datos actuales.

## 4. Alta y edición

El formulario incluye los datos de farmacia contemplados por la API. Son obligatorios SOE, CIF/NIF, denominación, dirección, código postal, localidad, provincia y ayuntamiento; teléfono y los componentes bancarios son opcionales. Los detalles de obligatoriedad, unicidad y tipos pertenecen al [contrato del módulo de Farmacias](../farmacias/spec.md).

En el alta, el selector se carga desde los ayuntamientos existentes y el usuario debe escoger uno. Si no se pueden cargar, se comunica el error y no se puede enviar el alta.

En la edición, la pantalla carga el detalle de la farmacia y conserva los datos actuales. El ayuntamiento se muestra en el selector deshabilitado con su denominación y CIF, o «Sin Ayuntamiento». No necesita cargar el catálogo de Ayuntamientos para editar. El cuerpo de actualización no incluye `ayuntamiento_id`; permite editar un maestro desasignado sin asignarlo. La interfaz no permite reasignar la farmacia.

Los campos opcionales vacíos se envían como `null`. El servidor sigue siendo la autoridad para validar los datos.

## 5. Mensajes y contrato consumido

La interfaz usa el cliente HTTP del mismo origen y estas operaciones existentes:

| Acción de pantalla | Petición |
|---|---|
| Cargar listado | `GET /farmacias` |
| Abrir una farmacia | `GET /farmacias/:id` |
| Cargar ayuntamientos del selector | `GET /ayuntamientos` |
| Crear | `POST /farmacias` |
| Guardar cambios | `PUT /farmacias/:id` |

Se anuncian la carga del formulario y del listado, el resultado vacío, los errores al cargar o guardar y el éxito de las operaciones. Cuando la API devuelve un error comprensible, se muestra su mensaje; los fallos de red o las respuestas no válidas también producen un mensaje entendible.

## 6. Accesibilidad y seguridad de presentación

- El documento declara idioma español, tiene un título principal y organiza el listado mediante secciones, tabla con caption y encabezados de columna.
- Los controles tienen etiquetas asociadas; el selector indica que el ayuntamiento es obligatorio en el alta y que permanece bloqueado en edición.
- Los mensajes de estado se exponen mediante regiones `status` o `alert` con anuncios accesibles.
- Los enlaces y botones son utilizables con teclado y conservan el indicador de foco visible de los estilos compartidos.
- El diseño se adapta a pantallas estrechas. La tabla conserva su contenedor con desplazamiento horizontal propio cuando su ancho mínimo lo requiere.
- Los valores procedentes de la API se añaden mediante APIs DOM de texto; no se interpretan como HTML.

## 7. Criterios de aceptación

1. La tabla presenta cada farmacia y el nombre de su ayuntamiento asociado; muestra su CIF cuando está disponible.
2. El alta permite elegir un ayuntamiento existente y envía su ID junto con los campos de farmacia.
3. La edición muestra la relación actual deshabilitada y no la incluye en el `PUT`.
4. Carga, lista vacía, error, éxito y errores de formulario se comunican de forma accesible.
5. Desde el inicio se accede a los tres módulos implementados, y sus páginas permiten volver al inicio.
6. La navegación y la disposición siguen siendo utilizables con teclado y en pantallas estrechas.

## 8. Fuera de alcance

Cambios de API o de esquema, cambio de ayuntamiento asociado, borrado, filtros, búsqueda, paginación, autenticación, páginas de otros módulos y dependencias de interfaz nuevas.

## Navegación uniforme (7 de octubre de 2026)

Se aplica la [convención común de interfaz](../interfaz-ayuntamientos/spec.md#convenciones-comunes-de-interfaz-7-de-octubre-de-2026). El listado es inicial; alta y consulta/edición lo ocultan junto con sus acciones. Guardar o «Cancelar y volver al listado» restaura el listado y el foco visible. La consulta conserva el formulario Ver/Editar existente. Un error al guardar conserva los valores introducidos. Cancelar una carga invalida su respuesta, sin abrir de nuevo el formulario; durante la escritura se bloquean cancelación y navegación al inicio. No se añaden filtros de listado ni cambia el bloqueo de Ayuntamiento en edición.
