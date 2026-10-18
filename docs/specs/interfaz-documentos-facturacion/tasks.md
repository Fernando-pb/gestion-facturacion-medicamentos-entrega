# Tareas de interfaz

- [x] Revisar navegación y patrones de pantallas existentes.
- [x] Proponer acceso por referencia, vistas separadas y CSS de impresión.
- [x] Recibir las cuatro plantillas de documentos.
- [x] Aclarar presidente del Colegio emisor mostrado junto al sello.
- [x] Aprobar solución documental.
- [x] Implementar pantalla documental y configuración del emisor/logo.
- [x] Añadir enlaces de acceso y mensajes de errores/disponibilidad.
- [x] Añadir pruebas Vitest de contenido, acciones independientes y salto entre facturas.
- [x] Revisar escritorio, móvil e impresión con tablas largas y números oficiales extensos.
- [x] Ejecutar pruebas dirigidas y suite completa; documentar evidencia real.

Implementación completada; revisión visual con datos ficticios y pruebas automatizadas.

## Evidencia final — 11 de octubre de 2026

- Pruebas dirigidas: 98 aprobadas en 5 archivos (documentos, emisión, interfaces de emisión/cobros y recursos estáticos).
- Suite completa: 1124 aprobadas en 42 archivos, 14,03 s; sin desactivar pruebas.
- Sintaxis comprobada en documentos.js, documentos-plantillas.js, configuracion-documentos.js y documentos.validation.js.
- Revisión visual: ambas facturas con estilos de impresión a ancho A4, salto calculado de segunda factura = page; informes y configuración a 375 px. Corregido desbordamiento heredado de tabla; ancho final de página 375 px y tabla de 520 px con scroll propio.
- Fixtures visuales ficticios en memoria, sin escritura financiera. Archivo temporal eliminado y servidor detenido. No se exportó PDF ni se realizó impresión física; no se acredita aquí paginación física de informes largos ni lector de pantalla.
- Auditoría final de base de pruebas: cero facturaciones, facturas, cobros, pagos y configuraciones documentales. Solo se limpiaron los registros de las pruebas.
- Sin dependencias nuevas ni operaciones Git.
# Localización de emisiones desde Inicio (2026-10-11)

- [x] Comprobar A1/09-2026 en desarrollo mediante SELECT: referencia 2 EMITIDA, par de facturas guardado, sin cobros; ninguna escritura financiera.
- [x] Añadir selección Ayuntamiento/periodo en documentos, GET de búsqueda sin mutaciones y enlace descriptivo de Inicio. Mantener referencias desde emisión/cobros e impresión independiente/conjunta.
- [x] Añadir pruebas de navegación, catálogos, estados no imprimibles, errores/validación y cliente GET; integración de localización/consulta documental con snapshot de facturas y cobros.
- [x] Verificar apertura automática por referencia y las cuatro vistas, además de ambas facturas; 97/97 pruebas dirigidas en documentos-busqueda, documentos, facturacion-emision y facturacion-municipal-interfaz. Sin Git ni escrituras en desarrollo.

# Acción de impresión (2026-10-11)

- [x] Destacar acción Imprimir / Guardar como PDF y explicar activación/selección; aria-pressed en opciones, guard sin selección y estilo común de retorno.
- [x] Comprobar llamada predeterminada window.print, refresco/decode antes de imprimir, selección única y reinicio; conservar impresión conjunta con salto.
- [x] Pruebas dirigidas finales: 20/20 en documentos y documentos-busqueda; sintaxis de controlador cliente correcta.
- [x] Navegador con datos ficticios en memoria, sin guardar configuración ni tocar facturación: vista normal y aplicación de reglas CSS print, una factura sin controles, ambas con dos hojas y break-before page. Intento window.print bloqueó la interacción; diálogo nativo no inspeccionable con esta herramienta, sin impresión física ni PDF guardado. Fixture/pestañas retirados.

# Claridad del campo de consulta alternativa (2026-10-11)

- [x] Revisar interfaz, GET documental, repositorio y modelo: corresponde a FACTURACION.id.
- [x] Etiqueta ID interno de la facturación, ayuda vinculada con aria-describedby y ejemplo 2; consulta alternativa opcional plegada y búsqueda principal Ayuntamiento/periodo conservada.
- [x] Comprobar etiqueta/ayuda/ejemplo, apartado cerrado, orden principal, envío exacto del ID y error comprensible; 21/21 dirigidas en documentos/documentos-busqueda. Sin cambios de API/esquema/datos/números ni Git.

# Retirar consulta manual por ID (2026-10-11)

- [x] Eliminar sección/campo/formulario y conservar acceso a configurar emisor. Ayuntamiento + periodo es la única búsqueda visible.
- [x] Desvincular carga automática del formulario retirado: enlaces internos desde búsqueda/Facturación/Cobros consultan directamente GET documental. Sin API nueva, cálculos ni reemisión.
- [x] Actualizar pruebas de carga/impresión/errores y añadir flujo unido de selección Ayuntamiento/periodo → búsqueda → apertura de cuatro documentos, sin entrada manual de referencia.
- [x] Pruebas dirigidas finales: 22/22 en documentos y documentos-busqueda. Sin modificaciones financieras/API ni operaciones Git.

# Apertura directa desde el listado (2026-10-11)

- [x] Revisar GET automático existente: eliminar búsqueda visible/carga de catálogos duplicada cuando el enlace contiene facturacion_id.
- [x] Mostrar contexto de Ayuntamiento y periodo desde cabecera documental; conservar acceso a configurar emisor y opciones de impresión, sin ID visible.
- [x] Enlaces y retorno preservan filtros descriptivos; listado restaura filtros desde dirección y conserva Atrás mediante history.replaceState.
- [x] Pruebas de consulta correcta sin segunda búsqueda ni catálogos, contexto seguro, retorno y restauración; 48/48 dirigidas en documentos, documentos-busqueda, facturacion-listado-interfaz y facturacion-municipal-interfaz. Sin backend/esquema/cambios financieros/Git.

