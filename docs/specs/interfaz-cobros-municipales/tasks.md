# Tareas

## Números oficiales en Cobros — 17 de octubre de 2026

- [x] Añadir al SELECT de emitidas los dos números existentes, sin escritura ni renumeración.
- [x] Mostrar cada número bajo su factura y antes de importe/estado, con «Sin número» para ausencia/null/vacío/espacios.
- [x] Permitir ajuste de números largos y conservar filtros, fecha prevista y diseño adaptable.
- [x] 48/48 pruebas de interfaz: asociación de números a factura, ceros iniciales, ausencia y combinación de filtros.
- [x] 4/4 casos seleccionados `lista cobros por factura` de facturacion-emision: números originales y estados, snapshot y cobros intactos tras consultar; 65 casos ajenos no ejecutados. Solo base local dedicada de pruebas.
- [x] Prueba real en Edge aprobada a 1280/1024/800/768/600/390/375/320 px: números de 200 caracteres completos, sin solapamientos, recortes ni desplazamiento horizontal. Listado ficticio en memoria, sin acceso a base.
- [x] Sin comandos Git, producción ni despliegue. Primera ejecución aislada de interfaz falló al abrir un socket local (EACCES); repetida con acceso local permitido y aprobada.

## Solapamiento de nombres e importes — 17 de octubre de 2026

- [x] Apilar nombre y detalle en todos los tamaños; mantener GASTOS/COMISIÓN íntegro.
- [x] Dar todo el ancho de la celda móvil al bloque de facturas y contar relleno/bordes dentro del ancho de la ficha.
- [x] Añadir `test/browser/cobros-municipales-layout.mjs`: sirve HTML/CSS/JS reales con listado ficticio, sin base de datos. Mide rectángulos de texto para detectar solapamiento, etiquetas partidas, recorte de nombres/importes y botones fuera de celda; comprueba ausencia de desplazamiento horizontal de página/tabla.
- [x] Comprobación en Edge a 1280, 1024, 800, 768, 600, 390, 375 y 320 px aprobada. Incluye importes máximos y denominación municipal larga. La primera ejecución detectó el ancho adicional del relleno móvil; corregido y repetición aprobada.
- [x] Pruebas de interfaz Vitest: 44/44 aprobadas tras adaptar la comprobación anterior de estilos.

Ejecutar la comprobación de diseño con `node test/browser/cobros-municipales-layout.mjs`. Usa Playwright ya disponible: si no está en la resolución habitual de Node, `PLAYWRIGHT_MODULE` debe contener la URL de su módulo (p. ej. el del runtime de Codex). `PLAYWRIGHT_CHANNEL` permite seleccionar un canal instalado, por defecto `msedge`. No requiere instalar dependencias en el proyecto. Esta comprobación con navegador es independiente de la suite Vitest con DOM simulado.

## Estados de cobro y fecha prevista en listado (17 de octubre de 2026)

- [x] Mostrar estado individual de PRECINTOS y GASTOS/COMISIÓN y estado conjunto Pendiente/Parcial/Cobrada.
- [x] Añadir filtro conjunto combinable con Ayuntamiento y periodo y conservarlo en URL.
- [x] Mostrar fecha registrada de PAGO_FARMACIAS como prevista o «Sin fecha prevista»; no se representa ejecución/confirmación bancaria.
- [x] Añadir pruebas de estados/filtro/fecha a interfaz y de lectura de fecha registrada/ausente en integración del listado. Dirigidas: 112/112; suite completa: 1359/1359 en 49 archivos. Primera ejecución completa tuvo un timeout puntual en una prueba existente de documentos históricos (1358/1359); repetición completa aprobada.

## Simplificación del detalle (11 de octubre de 2026)

- [x] Retirar acceso documental de Cobros y refresco manual ordinario; conservar acceso a documentos en listado independiente de Facturación.
- [x] Actualización automática de entrada, cobro y confirmación de lote; recuperación GET solo ante fallos/conflictos/resultados inciertos.
- [x] Comprobar recuperación de consulta inicial fallida y consulta posterior a cobro confirmado, sin repetir POST; actualizar prueba de restauración del navegador.
- [x] 48/48 pruebas de interfaz en dos archivos; sintaxis JS correcta. DOM simulado, sin cambios financieros/backend/esquema ni operaciones Git.

## Rediseño aprobado: Cobros y liquidaciones (11 de octubre de 2026)

- [x] Listado automático, orden, filtros sin referencias internas, detalle directo y retorno conservando filtros.
- [x] Inicio renombrado; cobros independientes e importes completos, sin reapertura.
- [x] Liquidación conjunta mediante API existente: requisito de PRECINTOS, revisión de titular/cuenta/fecha, confirmación y snapshots de solo lectura.
- [x] Exportación Excel XML desde lote confirmado, sin ejecución ni acreditación de transferencias.
- [x] Recuperación de conflictos/resultados inciertos y protección frente a doble envío.
- [x] 116/116 dirigidas en cinco archivos (interfaz, listado, cobros/liquidaciones integración y estáticos); 1193/1193 suite en 45 archivos. Base dedicada local de pruebas y conexiones Supertest fuera del aislamiento, sin consultar/escribir datos financieros de desarrollo.
- [x] Revisión de flujos, sintaxis JS y estilos adaptables; pruebas de interfaz con DOM simulado (sin navegador real ni transferencias). README, especificación municipal y MEMORY actualizados. Sin cambios backend/esquema/dependencias ni operaciones Git.

## Implementación anterior (histórico; sustituida la consulta manual)

- [x] Revisar contratos/documentación y especificar alcance.
- [x] Pantalla y acceso desde emisión/Inicio. Consulta por referencia del proceso, sin API de búsqueda/listado; no se usa cálculo para consultar emitidas.
- [x] 18 casos nuevos de interfaz: ambos órdenes de cobros independientes, referencia/fecha/confirmación, importe fijo y manipulación/importe cero, justificante opcional, ya cobrada, REVISION/REABIERTA, errores definitivos/conflictos/incertidumbre, recuperación y refresco, respuesta incompleta, duplicación, navegación y API/recursos. Enlace y referencia añadidos al resultado de emisión con regresión.
- [x] Pruebas dirigidas 70/70 en cuatro archivos; suite completa 1110/1110 en 41 archivos (15 s), incluida concurrencia real cobro/reapertura del backend vigente. Sintaxis de pantalla/cliente/facturación y prueba correcta. Sin cambios backend ni esquema.
- [x] Navegador a 1280/375 px con API ficticia en memoria: tarjetas separadas, importe fijo, fecha local/editable, justificante, confirmación y resultado PRECINTOS cobrada/COMISIÓN pendiente sin segundo botón PRECINTOS. Bloqueo de reapertura visible; ancho de página 360 con viewport 375, sin scroll horizontal. Márgenes de tarjetas/formulario revisados. No se registraron cobros reales en desarrollo. Fixture temporal eliminado, servidor/pestaña cerrados y viewport restaurado. Lector de pantalla pendiente.
- [x] Revisión, documentación municipal, guía v21 y memoria actualizadas. Sin backend/esquema/dependencias/Git. No se añade acción de reapertura ni interfaz de pagos.

Comprobación final de solo lectura: gestion_facturacion_medicamentos_test sin facturaciones, facturas, cobros ni pagos. Limpieza financiera de fixtures correcta, sin borrados adicionales.
