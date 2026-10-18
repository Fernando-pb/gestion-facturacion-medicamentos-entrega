# Plan técnico: interfaz de Farmacias

## 1. Punto de partida

El backend de Farmacias y Ayuntamientos ya está montado en `src/app.js`. Express sirve los recursos de `public/` y entrega `public/index.html` en `/`. Las páginas de Ayuntamientos y Farmacias comparten `public/css/ayuntamientos.css`; el inicio añade `public/css/inicio.css`.

La interfaz de Ayuntamientos sirve como referencia para mensajes, tabla, formularios, foco, uso de DOM seguro y rutas del mismo origen. Las reglas de datos y la inmutabilidad de `ayuntamiento_id` pertenecen a [la especificación del módulo de Farmacias](../farmacias/spec.md).

## 2. Archivos y responsabilidades

- `public/farmacias.html`: estructura del formulario, mensajes y tabla accesible.
- `public/js/farmacias-api.js`: peticiones HTTP de Farmacias y reutilización del cliente de Ayuntamientos para cargar el selector.
- `public/js/farmacias.js`: carga de lista/detalle, alta, edición y renderizado de filas.
- `public/index.html`: pantalla principal con enlaces a las páginas existentes.
- `public/css/ayuntamientos.css`: estilos compartidos para páginas de gestión, botones, foco visible y tabla adaptable dentro de su contenedor.
- `public/css/inicio.css`: presentación adaptable de los enlaces de la pantalla principal.
- `public/ayuntamientos.html`: enlace de retorno a `/`, compartiendo el mismo patrón de cabecera que Farmacias.

No se modifica el montaje de Express, la API, el esquema ni la base de datos para este alcance de interfaz.

## 3. Flujo de listado, alta y edición

Al iniciar la página, `farmacias.js` solicita `GET /farmacias`, genera celdas de texto y anuncia carga, resultado vacío o error. El nombre y el CIF del ayuntamiento se toman de `ayuntamiento_denominacion` y `ayuntamiento_cif` de cada fila de API.

Al iniciar un alta, la interfaz solicita `GET /ayuntamientos` y crea opciones de texto. En el envío agrega el ID seleccionado al objeto del formulario y usa el cliente para `POST /farmacias`.

En edición, solicita `GET /farmacias/:id`, rellena los campos editables y presenta el Ayuntamiento devuelto en un selector deshabilitado, o «Sin Ayuntamiento». No solicita el listado de Ayuntamientos, que solo se necesita en alta. `dataFromForm` contiene solo campos editables; el PUT no incluye la asignación, tampoco si es NULL. Tras el éxito se oculta el formulario y se actualiza la lista.

## 4. Navegación, adaptación y accesibilidad

El middleware estático actual permite servir el `index.html` en `/`. El inicio enlaza a los dos módulos implementados. Cada página de gestión incluye un enlace de retorno a `/` en la cabecera.

Las páginas reutilizan reglas de foco visible, etiquetas, botones, tabla con caption/headers, mensajes vivos y `textContent`. La tabla puede desplazarse dentro de `.table-scroll`; el inicio cambia su cuadrícula a una columna bajo el breakpoint compartido. La cabecera de las páginas de gestión alinea el retorno a la derecha en ancho amplio y lo apila bajo el título en pantallas estrechas.

## 5. Pruebas y comprobación

- `test/farmacias-interfaz.test.js` comprueba la estructura, la presencia del nombre/CIF en la fila, alta con ayuntamiento y bloqueo de la relación durante edición.
- `test/static-files.test.js` comprueba que `/`, las dos páginas y sus recursos se sirven; comprueba los destinos de navegación y reglas responsive de cabecera.
- La prueba de interacción de Farmacias usa una API simulada; no escribe en PostgreSQL. Las pruebas reales de API e integración pertenecen a `docs/specs/farmacias/`.

Las comprobaciones automatizadas no sustituyen una revisión visual en navegador de los anchos estrechos ni una comprobación manual completa con teclado. No se requieren cambios de base de datos para estas pruebas.

## Navegación uniforme implementada (7 de octubre de 2026)

`farmacias.js` alterna listado/formulario mediante `hidden`, restaura foco, conserva entradas ante error y bloquea escritura doble/salida. Una generación de lectura invalida cargas canceladas. El enlace al inicio usa estilos comunes y un ID para bloquearlo durante escritura; no cambia su destino. Reutilizar la convención de interfaz-ayuntamientos/spec.md y verificar el CRUD existente; evidencia en tasks.md.
