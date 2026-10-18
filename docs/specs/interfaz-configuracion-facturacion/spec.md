# Pantalla de comisión e IVA

Accesible desde Inicio y Facturación municipal, independiente de logo/emisor. Lista de vigencias y formulario de alta/edición separados; explica último día del periodo, fechas inclusivas, gastos = comisión + IVA, sin conceptos adicionales. No propone automáticamente tasas o fechas. Tasas aceptan coma/punto como texto, máximo cuatro decimales sin redondear. Fin opcional abierto. Configuración utilizada muestra tasas/inicio como solo lectura; fin editable según revalidación del servidor.

Conserva entradas ante error, bloquea dobles envíos/navegación durante escritura. Ante transporte/5xx exige consultar lista antes de repetir, nunca reintenta POST automáticamente. Márgenes interiores 1,5rem/1rem en móvil, tabla con scroll propio, anuncios/foco y retorno con button button-secondary. El retorno de Facturación municipal sigue apuntando a /; vínculo de configuración respeta bloqueo de envío existente.
