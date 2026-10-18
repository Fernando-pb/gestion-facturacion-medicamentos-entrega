# Plan

## Estado de cobro por factura — 17 de octubre de 2026

1. Ampliar la consulta de emitidas con dos EXISTS individuales, conservando el indicador conjunto y el contrato restante.
2. Mostrar el estado bajo cada importe y añadir dos selectores locales combinados con Ayuntamiento/periodo, sin alterar orden ni reglas financieras.
3. Conservar los cuatro filtros en URL, navegación documental y restauración; mantener bloqueos y actualizar etiquetas al confirmar cobros concurrentes.
4. Probar combinaciones de cobro, importe cero, filtros, retorno, carga fallida y regresiones de emisión/cobros/reapertura; documentar resultados y memoria.

## Acceso explícito de reapertura — 12 de octubre de 2026

1. Incorporar `tiene_cobros` a la consulta de emitidas y una acción por facturación completa, con motivo y confirmación; reutilizar POST existente.
2. Reconsultar estado, bloquear cobros/doble envío y recuperar incertidumbre por GET. Conectar el ID reabierto con revisión/previsualización/reemisión existentes.
3. Adaptar listado móvil, comprobar teclado/controles y probar servidor, interfaz y suite completa. Sin cambios financieros, esquema ni nuevas acciones por factura individual.

## Selección pendiente y reapertura confirmada — 12 de octubre de 2026

1. Retirar la restricción contradictoria de número oficial/envío en la especificación, por decisión expresa del usuario; conservar motivo, cobros y par original.
2. Añadir GET de parejas pendientes calculadas en servidor, sin esquema/cálculos nuevos. Selectores dependientes y refresco al volver; retirar acceso de configuración de emisión.
3. Probar aptos/vacíos/estados/cobros, pareja inválida, continuación de cabecera, reemisión conjunta y recursos de configuración. Revisar navegador a 898/375 px y suite completa. Pasos anteriores conservados como histórico.

1. Documentar flujo y contratos actuales sin ampliar backend.
2. Añadir pantalla, CSS y cliente API; tres vistas excluyentes y formulario B dedicado.
3. Implementar revisión final con previsualización, números textuales, confirmación conjunta y recuperación de resultado incierto.
4. Añadir pruebas de flujo, errores, validaciones, bloqueos, advertencia y recursos; ejecutar dirigidas y suite completa.
5. Revisar cambios y actualizar documentación y memoria.

## Navegación unificada

1. Usar facturacion-municipal.html como listado de emitidas; mantener el proceso existente en facturacion-emision.html.
2. Incorporar un GET específico de solo lectura porque consulta por ID o búsqueda Ayuntamiento/periodo no proporcionan el listado global. Reutilizar tablas y facturas guardadas, sin esquema ni recálculos.
3. Inicio con un único módulo, enlaces de filas a documentos y retornos coherentes al listado; preservar impresión y enlaces desde Cobros.
4. Probar orden SQL, estados, importes históricos, navegación y flujo de emisión existente; ejecutar dirigidas y suite completa.

## Simplificación del listado y filtros

1. Retirar actualización manual y enlace de tasas del listado; mantener la configuración en Inicio.
2. Filtrar las filas recibidas por descripción municipal y periodo sin cambiar API/orden/importes.
3. Carga inicial y retorno normal automáticos; recargar en pageshow persisted para Atrás. Reintento visible solo ante error.
4. Comprobar navegación/filtros/carga/errores y ausencia de acciones de reapertura con pruebas dirigidas.
