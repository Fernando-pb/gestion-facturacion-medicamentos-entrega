# Plan de documentos municipales

1. Revisar fuentes, datos guardados y navegación; documentar propuesta y resolver presidente, configuración y ejemplos.
2. Tras aprobación, adaptar modelo/esquema y bases autorizadas preservando datos; capturar el presidente solo en la primera emisión.
3. Crear configuración documental siguiendo rutas/controlador/servicio/repositorio y validación Zod. Validar imágenes sin dependencias nuevas.
4. Crear consulta documental de solo lectura reutilizando facturas y participaciones, con comprobaciones de cuadre decimal exacto.
5. Implementar pantalla, configuración y plantillas según el plan de interfaz; revisar impresión individual/conjunta y paginación.
6. Pruebas dirigidas de API, integración e interfaz; suite completa. Actualizar modelos, guía canónica y MEMORY con comportamiento y evidencia reales.

Archivos afectados propuestos: db/schema.sql y modelos; src/facturacion/facturacion.repository.js y service.js para snapshot de primera emisión; nuevo módulo src/documentos para consulta/configuración; src/app.js para montarlo; nuevas pantallas/recursos public y enlaces en Inicio/emisión/cobros; test y documentación. No cambios al registro de cobros ni al cálculo financiero.

