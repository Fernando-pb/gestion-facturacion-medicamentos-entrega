# Plan técnico: interfaz de Medicamentos

## 1. Punto de partida

Express ya sirve recursos estáticos y existen pantallas para Ayuntamientos y Farmacias con HTML, CSS y módulos ES del navegador. El cliente HTTP usa el mismo origen y las respuestas se renderizan con APIs DOM de texto.

## 2. Estructura implementada

La implementación añade `/medicamentos.html` y módulos JavaScript bajo `public/`, reutilizando los estilos de gestión existentes y el patrón de cliente API. El contrato aprobado: POST devuelve `201` con el objeto creado e `id`; GET de colección devuelve `200` y un array JSON ordenado por `id ASC` (vacío como `[]`); GET por ID devuelve `200`, `400` para ID inválido o `404` si no existe; PUT reemplaza el registro completo y devuelve `200`, conserva `id` y permite cambiar `codigo_nacional`, `400` para ID inválido y `404` para ID válido sin medicamento correspondiente. Datos inválidos devuelven `400`; código nacional duplicado en POST/PUT devuelve `409`; errores funcionales usan JSON con `error`, sin textos fijados. No hay `PATCH` ni `DELETE`. El módulo permite crear, listar, consultar y editar incluidos ambos estados, sin borrado físico ni administración de autorizaciones específicas. No se añaden frameworks ni dependencias.

La ruta de interfaz inicial es `/medicamentos.html`, enlazada desde inicio. Las operaciones de `fetch` usan los endpoints y respuestas aprobados.

Los cuerpos aprobados requieren los campos obligatorios del modelo en POST; los cinco opcionales pueden omitirse o enviarse como `null` y, si tienen valor, son texto. `tipo_facturacion` debe enviarse como `TD` en POST y PUT, y la API valida ese único valor para el MVP. PUT envía todos los campos editables, también los opcionales (texto o `null`); omitir uno invalida el cuerpo. No enviar `id` y rechazar propiedades desconocidas. En los campos de texto, recortar espacios iniciales/finales, rechazar obligatorios vacíos tras el recorte y convertir opcionales vacíos o compuestos solo por espacios a `null`. Conservar `codigo_nacional` como texto, con ceros iniciales y capitalización original; validar los valores exactos de las enumeraciones sin cambiar capitalización. `precio` viaja como cadena decimal en peticiones/respuestas JSON; rango `0`–`9999999999.99`, cero, uno o dos decimales, punto decimal y rechazo de negativos, valores mayores y más de dos decimales, sin redondeo silencioso. La base sigue almacenándolo en `NUMERIC(12,2)`. La presentación del formulario aplica la convención común de campos decimales: coma/punto de entrada, coma y dos decimales al cargar/blur y € separado; JSON con punto. No se definen reglas para posibles tipos futuros como vacunas o leche.

## 3. Comprobaciones

Las pruebas automatizadas verifican la entrega estática, el renderizado seguro, los estados de pantalla y los flujos de alta/consulta/edición. La revisión manual del listado, formulario, errores, teclado, foco y viewport estrecho está completada; la evidencia consta en `tasks.md`, tarea 5.

## 4. Dependencias y asuntos abiertos

- El contrato HTTP está aprobado, incluidos códigos, formatos JSON, orden del listado, posibilidad de cambiar `codigo_nacional` en PUT, `tipo_facturacion = TD` y precio decimal como cadena en los cuerpos POST/PUT. El formulario utiliza la utilidad/estilos comunes de campos decimales para el precio, manteniendo el contrato como cadena con punto; `TD` como solo lectura y `anexo` como campo opcional editable.
- `anexo` es opcional, informativo y editable en esta interfaz. La guía, apéndice C.3, describe su uso actual para información y filtrado en el proceso existente; no se implementa filtro por `anexo` en la API ni la interfaz del MVP. El posible filtrado se reconsiderará al especificar el flujo que lo necesite. La gestión estructurada de convenios/anexos queda fuera del MVP.
- Para un ayuntamiento con lista específica, la pertenencia a esa lista se suma a la general, y una lista específica vacía no equivale a la general (guía canónica, A.5). El contrato/UI que administra la relación está implementado aparte del catálogo, en la ficha municipal; fuentes en `../gestion-ayuntamiento/` y `../interfaz-gestion-ayuntamiento/`.
- La decisión vigente comprueba `ACTIVO` y `ALTA` al registrar, más autorización específica cuando corresponda. La pantalla muestra datos actuales; sus cambios no revalidan ni invalidan precintos aceptados, que siguen facturándose en su periodo. `situacion_comercial` ya es `TEXT NOT NULL`, sin default y con CHECK para `ALTA`/`BAJA`, en `db/schema.sql`. «NO ESTÁ» pertenece a incidencias de lectura, nunca al selector de estados. Su clasificación por `BAJA` sigue pendiente en el módulo consumidor.
- Según la confirmación del autor, el campo se aplicó únicamente a `gestion_facturacion_medicamentos_test` con cero medicamentos. Desarrollo no se modificó y otras instalaciones no se consideran migradas. Cualquier migración con datos sin clasificar sigue pendiente, sin inferir ni asignar valores automáticamente.
- No se presenta acción de borrado físico, incluso sin referencias. El esquema protege además las referencias con `ON DELETE RESTRICT`.

## Navegación uniforme implementada (7 de octubre de 2026)

`medicamentos.js` reutiliza su formulario y generaciones de lectura: listado/formulario excluyentes, retorno al listado, entradas conservadas tras error y bloqueo durante escritura. Desbloquear «Nuevo» antes de restaurar el foco después del guardado. El enlace al inicio conserva `/` y usa los botones compartidos. Convención en interfaz-ayuntamientos/spec.md; evidencia automatizada y visual separada en tasks.md.
