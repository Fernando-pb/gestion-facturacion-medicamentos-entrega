# Tareas

- [x] Inspección: desarrollo sin filas, sin API ni pantalla previas; fecha_factura selecciona vigencia.
- [x] Implementar lista, alta y corrección segura, sin esquema/borrado.
- [x] Probar precisión, límites inclusivos, rangos abiertos, solapamiento concurrente y conservación de factura.
- [x] Ejecutar pruebas dirigidas y suite completa, actualizar memoria.

## Evidencia de cierre

### Ajustes visuales — 2026-10-11

- [x] Retirar consulta redundante y acceso a Facturación; conservar alta, corrección y retorno.
- [x] Presentar porcentajes sin ceros finales y fechas españolas, conservando precisión e ISO en formulario/API.
- [x] Evitar foco inicial del encabezado y usar contorno común al navegar entre listado y formulario.
- [x] Mensaje «Vigencias cargadas» y recuperación excepcional ante carga fallida/guardado incierto.
- [x] 23/23 pruebas dirigidas de interfaz y recursos estáticos. Navegador real a 1280 y 375 px: formatos, botones, espaciado, foco azul, retorno con Enter y scroll de tabla contenido; ancho de página igual al viewport. Sin guardar datos en la revisión visual.

Pruebas dirigidas: 93/93 en 4 archivos (interfaz-configuración, emisión, interfaz municipal y recursos estáticos). Suite completa: 1147/1147 en 43 archivos, 14,63 s. Sintaxis de servicio/repositorio/cliente UI comprobada. Pruebas reales PostgreSQL: ausencia y resolución, copia de tasas/importes, corrección no usada, protección de utilizada, cierre sin excluir fechas emitidas, solapamiento inclusivo/abierto, altas simultáneas y espera ante SHARE de emisión. UI: formulario separado, precisión/errores/duplicación/incertidumbre, accesos y retorno con clase común. Sin esquema, dependencias ni Git; desarrollo no recibe configuraciones automáticas.
