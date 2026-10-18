# Inicio por secciones

## Alcance aprobado

Reorganización de los ocho accesos existentes de Inicio, sin modificar textos de tarjetas, destinos, comportamiento de módulos, API, esquema ni datos. Fuentes: petición del usuario, AGENTS.md y patrón de pestañas de la ficha municipal.

Barra seleccionable: Gestión diaria (Entregas y precintos, Facturación municipal, Cobros y liquidaciones); Datos maestros (Ayuntamientos, Farmacias, Medicamentos); Informes (Informe anual de precintos); Configuración (Comisión e IVA). Cada acceso existe una sola vez.

Al cargar Inicio se selecciona Gestión diaria y solo su panel es visible. Cambiar pestaña oculta los demás paneles mediante hidden, sin sustituir ni regenerar enlaces. No se guarda selección previa.

Roles tablist/tab/tabpanel; aria-selected, aria-controls y aria-labelledby enlazan cada pestaña y panel. Una pestaña tiene tabindex 0; el resto -1. Flechas izquierda/derecha cambian y enfocan la selección con recorrido circular; Inicio/Fin van a primera/última; Enter/Espacio activan botones nativos. Tab accede al panel/enlaces visibles. Sin desplegable.

Estilos existentes de tarjetas y botones. Barra en cuatro columnas en escritorio y dos en móvil, con etiquetas completas y sin desbordamiento horizontal. Foco visible común y estado activo según municipal-tabs. Paneles accesibles con teclado.

En el CSS exclusivo de Inicio se anula el mínimo de ancho del cuerpo heredado (320 px) para evitar desbordamiento con barra vertical a 320 px. Botones móviles con texto de 0,875 rem, menor padding y altura mínima de 44 px; todas las secciones permanecen visibles.

Verificar selección inicial, composición exacta, destinos/textos, alternancia, teclado, recursos y presentación escritorio/móvil.
