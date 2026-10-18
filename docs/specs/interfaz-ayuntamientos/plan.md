# Plan técnico: interfaz de Ayuntamientos

## 1. Punto de partida

`src/app.js` configura Express, JSON y las rutas de API bajo `/ayuntamientos`; `src/server.js` inicia esa aplicación. El backend ya expone POST, GET de listado, GET de detalle y PUT. `package.json` ya incluye Express, Vitest y Supertest; no hay framework de interfaz ni middleware de archivos estáticos configurado.

## 2. Ubicación y servicio de archivos

Propuesta: guardar los recursos del navegador en `public/`, por ejemplo `public/ayuntamientos.html`, `public/css/ayuntamientos.css` y `public/js/` para los módulos. Configurar `express.static` en `src/app.js` con una ruta absoluta basada en la ubicación del módulo, de modo que funcione independientemente del directorio desde el que se inicia Node. El punto de entrada de la página será `/ayuntamientos.html`; así queda libre `/ayuntamientos` para el endpoint GET existente.

La estructura y la ruta de entrada son una propuesta para la implementación. Si al implementar aparece una necesidad de producto para usar otra URL, deberá decidirse antes de cambiar las rutas existentes.

## 3. JavaScript del navegador y API

Usar módulos ES nativos del navegador. Mantener la comunicación HTTP en un módulo pequeño (por ejemplo, `api.js`) y el comportamiento del formulario/listado en otro módulo (por ejemplo, `ayuntamientos.js`). La capa API centraliza `fetch`, JSON y la traducción de errores; la pantalla gestiona estados, eventos y renderizado.

Las peticiones se harán con rutas relativas del mismo origen (`/ayuntamientos` y `/ayuntamientos/:id`), `Content-Type: application/json` en POST/PUT, y los cuerpos completos definidos por el contrato actual. No se configura CORS ni se almacena una URL de backend separada.

Al renderizar datos externos, crear nodos y asignar valores mediante APIs de texto/propiedades DOM; no interpolar respuestas dentro de `innerHTML`.

## 4. Pruebas y comprobación manual

Vitest y Supertest ya están instalados. En la implementación se pueden añadir pruebas de API estática a través de Supertest para comprobar que Express sirve el HTML y los recursos; la lógica de presentación debe mantenerse pequeña y verificarse manualmente en navegador, sin instalar una herramienta de DOM o navegador.

Prueba manual prevista: ejecutar la aplicación configurada para usar exclusivamente `gestion_facturacion_medicamentos_test` y datos ficticios; abrir `/ayuntamientos.html`; comprobar listado vacío/no vacío, carga y errores, alta, detalle, modificación, activación/desactivación, validaciones y navegación por teclado. Confirmar que los datos se reflejan tras volver a cargar la lista. No utilizar datos empresariales reales.

No iniciar el servidor ni acceder a PostgreSQL durante esta tarea de documentación.

## 5. Decisiones pendientes

- Confirmar durante la implementación si `/ayuntamientos.html` es una ruta de entrada adecuada o si se requiere otra URL visible; cualquier alternativa debe conservar el contrato API actual.
- Determinar si basta con una prueba Supertest de entrega de archivos y comprobación manual de interacciones. Las dependencias actuales no incluyen una herramienta de pruebas DOM o navegador; no se añadirá una sin aprobación.

## Convención compartida (7 de octubre de 2026)

Documentar el patrón común en spec.md, referencia ya usada por las otras interfaces. Reutilizar `.button`/`.button-secondary` de la hoja compartida; mantener enlaces a `/` y foco visible. `ayuntamientos.js` conserva los filtros de búsqueda municipal al volver de su edición, además del retorno ya existente a la ficha. Pruebas de retorno guardado/cancelado y revisión real en ambos anchos, con evidencia en tasks.md.

## Actualización de navegación implementada

El módulo existente ayuntamientos.js controla hidden en seccion-listado, seccion-formulario y ficha-ayuntamiento. Mantiene el retorno al origen del formulario, consulta datos actuales al regresar a ficha y conserva los controles del listado. No crea rutas ni dependencias. Las pruebas de listado/CRUD verifican visibilidad y retorno tras guardar/cancelar; los módulos de gestión municipal verifican apertura/cierre de tareas y respuestas tardías. Evidencia actual en ../interfaz-gestion-ayuntamiento/tasks.md.

## Pestañas y tareas excluyentes implementadas

ayuntamientos.js coordina ficha/edición y las tres pestañas, carga Datos por el GET existente y vuelve a Datos después de editar. iniciarPestanasMunicipales comparte selección ARIA, índice de tabulación, flechas/Home/End y bloqueo durante escritura. Los módulos de asociaciones preparan contexto sin cargar al entrar en ficha y exponen activar/desactivar: cargan solo al seleccionar su pestaña, invalidan lecturas al dejarla y conservan filtros.

iniciarPanelBusqueda alterna lista y resultados en Farmacias (conSeleccion=false); Medicamentos conserva además su selección; suspende tareas durante confirmación y vuelve a la lista después de incorporar. El retorno interno a lista admite la escritura en curso sin habilitar acciones: los controles siguen bloqueados hasta acabar el refresco y comunicar resultado. Reintento se muestra solo tras fallar una carga. HTML usa tabpanels ocultos, paneles de tarea y ayuda desplegable; CSS reutiliza botones, rejilla, paneles y scroll de tablas. No se añaden rutas ni dependencias. Evidencia y límites en tasks.md.
