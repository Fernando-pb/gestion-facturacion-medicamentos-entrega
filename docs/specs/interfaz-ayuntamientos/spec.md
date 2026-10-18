# Especificación funcional: interfaz de Ayuntamientos

## 1. Objetivo y alcance

Definir una página web sencilla para consultar y mantener ayuntamientos mediante la API existente. La interfaz será HTML, CSS y JavaScript modular servidos por Express, sin framework ni dependencias nuevas.

Incluye listado, alta, consulta, modificación y activación/desactivación. No incluye borrado físico, filtros, búsqueda, paginación, autenticación ni otros módulos del sistema.

## 2. Listado

La tabla presenta CIF, denominación, localidad, provincia, estado, tipo de lista de medicamentos y acciones. Incluye tanto ayuntamientos `ACTIVO` como `INACTIVO`; la API los devuelve ordenados por `id ASC`.

La pantalla comunica de forma visible los estados de carga, error y lista vacía. Cada fila permite consultar/editar y cambiar el estado. Tras una operación correcta, se vuelve a cargar el listado para reflejar el resultado persistido.

## 3. Alta, consulta y modificación

Un formulario común sirve para crear y editar. En edición, primero obtiene los datos actuales con `GET /ayuntamientos/:id`. El formulario contiene todos los campos aceptados por el contrato:

| Campo | Regla del servidor |
|---|---|
| `cif` | Obligatorio; se recorta y convierte a mayúsculas. No se valida formalmente su formato. |
| `denominacion` | Obligatorio; cadena no vacía tras recortar espacios. |
| `direccion` | Obligatorio; cadena no vacía tras recortar espacios. |
| `codigo_postal` | Obligatorio; cadena no vacía tras recortar espacios. |
| `localidad` | Obligatorio; cadena no vacía tras recortar espacios. |
| `provincia` | Obligatorio; cadena no vacía tras recortar espacios. |
| `telefono` | Opcional; cadena, `null` o ausente. |
| `movil` | Opcional; cadena, `null` o ausente. |
| `persona_responsable` | Opcional; cadena, `null` o ausente. |
| `persona_contacto` | Opcional; cadena, `null` o ausente. |
| `alcalde` | Opcional; cadena, `null` o ausente. |
| `estado` | Obligatorio: `ACTIVO` o `INACTIVO`. |
| `tipo_lista_medicamentos` | Obligatorio: `GENERAL` o `ESPECIFICA`. |

Los campos opcionales vacíos se envían como `null`. El cliente puede ayudar a detectar campos obligatorios vacíos y opciones fuera de catálogo, pero el servidor es la autoridad de validación. El cuerpo incluye todos los campos editables: `POST /ayuntamientos` crea y `PUT /ayuntamientos/:id` reemplaza los datos editables completos.

La activación y desactivación cambia `estado` mediante el mismo `PUT` completo, incluyendo los demás valores actuales. No se elimina el registro.

## 4. Contrato HTTP y errores

La interfaz usa rutas del mismo origen y `fetch()`:

| Operación | Petición | Respuesta correcta |
|---|---|---|
| Listar | `GET /ayuntamientos` | `200`, array de registros |
| Consultar | `GET /ayuntamientos/:id` | `200`, registro |
| Crear | `POST /ayuntamientos` | `201`, registro creado |
| Actualizar/estado | `PUT /ayuntamientos/:id` | `200`, registro actualizado |

Para los errores funcionales conocidos, el servidor responde JSON con la propiedad `error`:

- `400`: datos no válidos (`Datos de ayuntamiento no válidos.`) o identificador inválido (`Identificador no válido.`).
- `404`: ayuntamiento inexistente (`Ayuntamiento no encontrado.`).
- `409`: CIF duplicado (`El CIF ya está registrado.`).

La interfaz presenta ese mensaje cuando está disponible. Los errores de red, respuestas no JSON y errores inesperados muestran un mensaje genérico comprensible y permiten reintentar; el manejador predeterminado de Express no garantiza un formato JSON común para errores inesperados.

## 5. Accesibilidad y seguridad de presentación

- Cada control tiene una etiqueta asociada; los botones describen claramente su acción.
- Toda operación se puede realizar con teclado y el foco visible no se elimina.
- Los estados de carga, error, éxito y lista vacía se exponen como mensajes perceptibles por tecnologías de asistencia.
- Los valores devueltos por la API se insertan como texto (por ejemplo, `textContent`), no como HTML sin escapar.

## 6. Criterios de aceptación

1. Se listan los ayuntamientos activos e inactivos y se muestran claramente carga, error y ausencia de resultados.
2. Crear envía los trece campos al endpoint acordado, convierte opcionales vacíos en `null` y refleja el alta en la tabla.
3. Editar carga primero el registro mediante GET; guardar y cambiar el estado usan PUT completo y actualizan la tabla tras éxito.
4. Los errores `400`, `404` y `409`, además de red o servidor, tienen una presentación comprensible.
5. Se cumplen los criterios básicos de teclado, etiquetas, foco y texto seguro.

## 7. Fuera de alcance

React, TypeScript, nuevas dependencias, endpoints nuevos, borrado, autenticación, validación formal del CIF, filtros, búsqueda, paginación, farmacias y medicamentos.

## Navegación entre vistas (actualización de usabilidad)

Listado, formulario y ficha municipal son vistas excluyentes: crear/editar/abrir ficha oculta el listado con sus controles. Cancelar o guardar desde el listado vuelve a él; editar Ayuntamiento/modalidad desde la ficha vuelve a esa ficha después de guardar o cancelar. «Volver al listado» cierra la ficha y enfoca un control visible del listado. Los controles del listado no se reinician al ocultarlo; esta versión no dispone de filtros y no los incorpora. La ficha y sus paneles progresivos se especifican en ../interfaz-gestion-ayuntamiento/spec.md. Se mantienen campos, validación y contratos CRUD.

La ficha municipal usa tres pestañas (Datos, Farmacias, Medicamentos), abre Datos y presenta una única tarea visible. Editar se ofrece en Datos; guardar/cancelar vuelve allí. Pestañas con teclado y carga automática; descripción vigente y pruebas en ../interfaz-gestion-ayuntamiento/spec.md y tasks.md.

## Convenciones comunes de interfaz (7 de octubre de 2026)

Esta sección es la referencia mínima para los módulos actuales y nuevos: se mantiene aquí porque esta especificación ya es la referencia de presentación de las otras interfaces. No se añade una arquitectura ni un documento paralelo.

- El listado es la vista inicial. Crear, consultar/editar o abrir una ficha oculta el listado y sus acciones mediante `hidden`; solo se muestra la tarea actual. En los CRUD de Farmacias y Medicamentos, la consulta usa el formulario existente «Ver/Editar», sin una página adicional.
- Guardar correctamente o cancelar devuelve al origen. Desde el listado vuelve al listado; desde la ficha municipal vuelve a Datos de esa ficha. Un error de validación mantiene formulario, valores introducidos y mensaje visible.
- Ocultar una vista no reinicia sus filtros. Los tres listados CRUD actuales no tienen filtros; los de búsqueda municipal se conservan entre pestañas y también al guardar/cancelar la edición de esa ficha. Abrir otra ficha inicia su propio contexto.
- «Cancelar y volver al listado», «Cancelar y volver a la ficha» y «Volver al listado» explican su destino. «Volver al inicio» sigue siendo un enlace a `/`, no una acción de cierre o sesión.
- Reutilizar `.button` y `.button-secondary` de `public/css/ayuntamientos.css`: tipografía, espacio interior y altura mínima de 2.75rem comunes, sin subrayado en enlaces ni estiramiento vertical en cabecera. Mantener foco visible, controles etiquetados y tablas con desplazamiento contenido en móvil.
- Restaurar el foco a un control visible al volver; después de guardar, habilitarlo antes de enfocarlo. Durante una escritura, impedir doble envío y navegación que oculte su resultado. Las respuestas de cargas canceladas no deben reabrir formularios ni sustituir datos de otra tarea.
- Los avisos informativos usan texto explícito además de fondo suave, borde y espacio interior (`.informative-notice`). La modalidad y los estados siguen siendo conceptos distintos; su presentación no cambia reglas de negocio.

La verificación distingue pruebas DOM/API simuladas de la revisión visual con API real; evidencia por módulo en `tasks.md`.

Activar/Desactivar usa también `envioEnCurso`, desde la consulta del registro actual hasta comunicar el resultado y refrescar el listado. Durante ese intervalo no se abre ficha/edición/alta ni se inicia otra escritura; se bloquean los controles de la fila, «Nuevo» y la salida al inicio. `finally` restaura los controles tanto ante éxito como ante error, conservando el mensaje de resultado. No modifica el contrato PUT completo.
