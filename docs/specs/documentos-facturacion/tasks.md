# Tareas

## Sesión en configuración documental — 17 de octubre de 2026

- [x] Proteger GET/PUT con el middleware de sesión existente antes del router/parser; conservar Origin y parser de `1500kb`.
- [x] Mantener 401 JSON para la API montada, reconstruyendo prefijo/ruta en el rechazo de autenticación.
- [x] Probar GET/PUT anónimos con rechazo previo a cualquier conexión de datos y PUT de origen ausente/null/externo rechazado aun con sesión válida.
- [x] Probar GET/PUT autenticados en PostgreSQL local dedicado, validaciones previas y lectura del PNG sintético de exactamente 1 MiB; exceso devuelve 413 JSON y conserva los datos guardados.
- [x] Resultados locales: 37/37 pruebas de auth y 2/2 casos documentales seleccionados de facturacion-emision (67 casos ajenos no ejecutados). El caso combinado inicial agotó 5 s; separado el caso de cargas grandes con margen específico de 15 s, ambos casos pasaron en 1,38 s de ejecución total. Sin llamadas a Render, producción, Git o despliegue.

- [x] Inspección de esquema, emisión, participaciones, cobros y configuración existente.
- [x] Documentar propuesta concreta y diferencias con C.10–C.11.
- [x] Confirmar presidente del Colegio emisor; fuente propuesta en configuración documental existente.
- [x] Aprobar política histórica y cambios de esquema/API.
- [x] Recibir las cuatro plantillas visuales y documentar su correspondencia y diferencias con los requisitos.
- [x] Concretar maquetación tras las aprobaciones pendientes.
- [x] Adaptar las bases autorizadas sin borrar datos.
- [x] Implementar snapshot de presidente y configuración segura.
- [x] Implementar consulta documental sin escrituras ni cálculo alternativo.
- [x] Probar disponibilidad, B histórico, presidente congelado tras cambio/reemisión, reimpresión con logo/emisor actuales y cuadre de totales.
- [x] Probar imágenes inválidas, exceso de tamaño, rutas arbitrarias, validación/configuración y errores.
- [x] Probar que consultas/impresión no cambian facturas, estados, cobros ni pagos.
- [x] Ejecutar pruebas dirigidas y suite completa tras implementación.

Implementación completada; evidencia y límites abajo.


## Evidencia final — 11 de octubre de 2026

- Pruebas dirigidas: 98 aprobadas en 5 archivos (documentos, emisión, interfaces de emisión/cobros y recursos estáticos).
- Suite completa: 1124 aprobadas en 42 archivos, 14,03 s; sin desactivar pruebas.
- Sintaxis comprobada en documentos.js, documentos-plantillas.js, configuracion-documentos.js y documentos.validation.js.
- Revisión visual: ambas facturas con estilos de impresión a ancho A4, salto calculado de segunda factura = page; informes y configuración a 375 px. Corregido desbordamiento heredado de tabla; ancho final de página 375 px y tabla de 520 px con scroll propio.
- Fixtures visuales ficticios en memoria, sin escritura financiera. Archivo temporal eliminado y servidor detenido. No se exportó PDF ni se realizó impresión física; no se acredita aquí paginación física de informes largos ni lector de pantalla.
- Auditoría final de base de pruebas: cero facturaciones, facturas, cobros, pagos y configuraciones documentales. Solo se limpiaron los registros de las pruebas.
- Sin dependencias nuevas ni operaciones Git.
