# Interfaz del informe anual operativo

## Alcance aprobado

Pantalla específica public/informe-anual.html, accesible desde Inicio. Fuentes: AGENTS, facturación municipal §17/§18, modelo e interfaz existente. No existía pantalla previa. Solo consulta/exportación, sin mutaciones financieras.

Formulario con año (1–9999), Ayuntamiento opcional (incluidos inactivos) y «Incluir desglose por mes» opcional. Dos acciones independientes: Ver informe y Exportar a Excel; ayuda indica archivo XML compatible con Excel. Exportar no exige haber consultado ni renderizado el informe y usa los filtros actuales. Errores visibles y controles deshabilitados durante la petición; cambio de filtros retira resultados anteriores para evitar confusión. Año inicial del dispositivo del usuario; puede editarse. Volver al inicio usa el botón secundario común y conserva destino /.

Ver informe: total anual, trimestres, grupos municipales y una fila por farmacia estable con SOE, denominación y CIF históricos B, T1–T4 y anual. Si existen varios B, mostrar los triples en líneas separadas alineadas, sin dividir/importar otra vez la actividad ni elegir titular actual. Opcionalmente mostrar meses dentro de cada trimestre. Avisar de REABIERTA excluida; año sin actividad se indica y permite descargar totales cero.

Exportación: descarga XML nativo de Excel desde el backend, con hoja Resumen anual y columnas AYUNTAMIENTO, SOE, DENOMINACIÓN, CIF, TRIMESTRE 1–4, TOTAL ANUAL. Subtotales municipales y total general. Si se pide meses, segunda hoja de detalle. Mantener advertencia de reaperturas en archivo y pantalla. No fórmulas: texto escapado, datos B/SOE/CIF como texto y dinero numérico con dos decimales. Accesibilidad: labels, foco visible, región de estado/error, scroll de tablas con nombre accesible.

Cabeceras visibles del resumen y desglose: SOE, Denominación y CIF, sin B; se conservan los campos históricos internos. Clase resumen-anual limita la columna fija/separador a Total anual, después de T4, en cabecera, cuerpo y subtotal; se anula la fijación/sombra de la séptima columna heredada del CSS común. El desglose mensual no usa estos estilos. Importes y agrupación por periodo facturado intactos, sin COMISIÓN ni cambios financieros.

Cabecera con page-header-with-link: título/descripción a la izquierda y retorno secundario a la derecha en escritorio; el CSS común apila título y retorno en móvil, manteniendo destino /. Resumen con table-layout fixed y T1–T4 de ancho idéntico (11 % cada una), encabezados/importes/subtotales alineados a la derecha. Anchos específicos neutralizan los del CSS común. El separador permanece en Total anual; scroll horizontal contenido en table-scroll, sin cambiar filtros, contenido o exportación.
