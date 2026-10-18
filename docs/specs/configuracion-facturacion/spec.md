# Administración de comisión e IVA

Acceso vigente (12 de octubre de 2026): se conserva en Inicio. Nueva facturación municipal retira exclusivamente su enlace «Gestionar comisión e IVA», sin cambiar configuración, recursos, datos ni validación de vigencias. Sustituye las referencias anteriores a un acceso desde emisión.

Fuentes: solicitud del usuario, AGENTS.md, modelo CONFIGURACION_FACTURACION, esquema y facturación municipal §14. Alcance autorizado: gestionar la tabla existente, sin nuevos conceptos de gasto, esquema ni cambios al cálculo/históricos.

GET /configuracion-facturacion lista vigencias ordenadas, porcentajes como cadenas, fechas ISO y utilizada (EXISTS de factura). POST crea y PUT /:id corrige. Body estricto: porcentaje_comision/porcentaje_iva cadenas decimales entre 0 y 100, máximo cuatro decimales; fecha_inicio real 0001–9999, fecha_fin real nullable y no anterior. Fechas inclusivas, fin null abierto. Sin borrado. No crear valores automáticamente.

Las escrituras bloquean CONFIGURACION_FACTURACION en SHARE ROW EXCLUSIVE, compatible con lectores y excluyente con otras escrituras y el SHARE de emisión. SQL NUMERIC exacto compara porcentajes y rangos; rechaza solapamientos incluso en extremos inclusivos. Configuración utilizada conserva porcentajes e inicio; se puede ajustar su fin siempre que continúe cubriendo las fechas de todas las facturas relacionadas. Para nuevas tasas, cerrar la vigencia anterior y crear otra. Una corrección no cambia FACTURA ni sus importes/tasas históricas; reapertura conserva sus porcentajes originales.

400 entrada inválida, 404 ID ausente, 409 solapamiento/modificación histórica incompatible. Emisión/previsualización continúan rechazando ausencia/ambigüedad con explicación y enlace a la pantalla. No se precargan porcentajes ni vigencias en desarrollo.

## Presentación de la pantalla

Las vigencias se cargan al entrar; el mensaje de éxito es «Vigencias cargadas». El listado ofrece «Nueva vigencia» y las acciones de cada fila, sin consulta manual redundante ni enlace directo a Facturación. El retorno a Inicio conserva el botón secundario común. Solo se ofrece recuperación ante fallo de carga o guardado incierto, mediante consulta sin repetir la escritura.

Los porcentajes del listado usan coma, símbolo % y omiten únicamente ceros decimales finales (2.7000 → 2,7 %; 21.0000 → 21 %). Las fechas se muestran DD/MM/YYYY y el fin abierto como «Sin fin». Se mantienen las cadenas decimales exactas y fechas ISO al editar/guardar; no cambia el cálculo ni los históricos.

La carga inicial no enfoca el título. Al abrir el formulario o regresar al listado se enfoca su encabezado para orientar la navegación accesible, con contorno azul de 3 px y separación de 3 px, igual que los botones comunes. La tabla conserva su desplazamiento horizontal dentro del panel en pantallas estrechas.
