# Tareas

## Posición del retorno y alineación trimestral (11 de octubre de 2026)

- [x] Cabecera con el mismo patrón page-header-with-link de Facturación municipal: título/descripción antes del retorno secundario, destino / intacto y apilado móvil común.
- [x] Tabla fija con anchos explícitos y T1–T4 iguales/alineadas a la derecha en encabezados, filas y subtotal; separador después de T4 intacto. Sin tocar controlador, filtros, cálculo ni exportación.
- [x] Ajustadas dos comprobaciones existentes de interfaz (cabecera y CSS). 16/16 pruebas de interfaz y estáticos aprobadas.
- [x] Navegador real, escritorio 1280 y móvil 375: T1–T4 de 131,3125 px y 107,90625 px respectivamente, iguales en las tres secciones; cabecera derecha/apilada. Sin desbordamiento horizontal de página: scroll de tabla contenido (960 px de contenido en región móvil de 306 px). Capturas de navegador y estilos/geometría revisados; captura fullPage no disponible en esta sesión. Tamaño restablecido y pestaña temporal cerrada.
- [x] Solo consultas GET; sin cambios de datos/API/esquema ni operaciones Git.

## Claridad visual (11 de octubre de 2026)

- [x] Cabeceras visibles SOE/Denominación/CIF en resumen y desglose, manteniendo campos históricos internos. Cabeceras del XML coherentes.
- [x] Volver al inicio con botón secundario; «Incluir desglose por mes» y «Exportar a Excel» con ayuda XML compatible, sin cambiar eventos/filtros/descarga independiente.
- [x] Anular columna fija/sombra heredada en T4 y trasladarla a Total anual mediante clase exclusiva del resumen (cabecera/cuerpo/subtotal), sin afectar tabla mensual.
- [x] 34/34 dirigidas en interfaz, integración del informe/exportación y estáticos. Cabeceras, clases, columnas, histórico, sumas, periodos, COMISIÓN y descarga directa comprobados.
- [x] Navegador real en localhost existente, consultas GET sin escrituras: T4 static/sin sombra, Total anual sticky con borde/sombra; captura visual con subtotales. Descarga directa validada por parser XML .NET, namespace SpreadsheetML y nueve cabeceras nuevas. Pestaña temporal cerrada. No se abrió Excel de escritorio.
- [x] Sin cambios en cálculos, reglas, esquema ni datos financieros; sin operaciones Git.

- [x] Compartir primitivas SpreadsheetML con liquidación y descarga anual desde el mismo servicio/snapshot/validación de §17; sin dependencias.
- [x] Pantalla con acceso desde Inicio, filtros año/Ayuntamiento/mensual, ver/exportar independientes, errores/reintento, bloqueo durante peticiones y retirada de resultados al cambiar filtros. Tabla por municipio/farmacia con B histórico y meses opcionales.
- [x] Dirigidas 64/64 en cuatro archivos; suite 1061/1061 en 39 archivos. Integración: una fila por farmacia, varios B históricos, años consecutivos y T1–T4, subtotales/anual, exportación sin consulta previa, COMISION y fechas de cobro/pago excluidas, advertencias/filtros. Seis pruebas de interfaz/API/recursos. Documentación/memoria actualizadas.

- [x] Navegador real: pantalla a 1280 px, exportación directa antes de ver, descarga informe-anual-2026.xml; Ver informe después conserva total/trimestres y estado sin actividad. Archivo descargado validado con parser XML .NET: hoja Resumen anual, nueve columnas y sin fórmulas. Datos del navegador exclusivamente base local dedicada; sin escrituras financieras.
- [x] Sin cambios de esquema, migraciones, dependencias ni Git.
- [x] Suite final 1061/1061 tras revisión visual. Base dedicada sin facturaciones, facturas, cobros, pagos ni detalles de pago; fixtures propios limpiados. Servidor y pestaña temporales cerrados; .env y desarrollo intactos. Sintaxis correcta y revisión manual sin Git.
