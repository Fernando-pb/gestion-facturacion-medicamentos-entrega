# Convención de campos editables monetarios y decimales

## Inventario vigente (2026-10-08)

Revisados los inputs de todas las pantallas actuales y las validaciones de servidor.

| Pantalla / campo | Contrato existente | Validación conservada |
|---|---|---|
| Medicamentos / `precio` | Cadena con punto, obligatorio | 0–9999999999.99, hasta 2 decimales; recorte de espacios exteriores conforme al servidor |
| Entregas / `importe-inicial` | `importe_informado`: cadena con punto o NULL | Mismo rango/precisión; vacío → NULL; cero informado; espacios rechazados como en la interfaz previa |
| Entregas / `importe-editado` | Mismo contrato PUT de declarados | Mismas reglas; no altera snapshots ni declarados al recuperar |

No existen otras cantidades decimales editables en las pantallas implementadas. Códigos, teléfonos y datos bancarios son texto; año y número de precintos siguen siendo enteros. No se añaden controles para módulos financieros pendientes ni se alteran importes de lectura o cálculos de resumen.

## Entrada, presentación y transporte

- Se acepta coma o punto decimal, un único separador y dígitos ASCII. Se rechazan agrupaciones de miles, separadores mixtos, signos y notación exponencial. En estos campos, `1,234` y `1.234` son inválidos por exceso de precisión; nunca se interpretan como miles ni se redondean.
- `public/js/decimales.js` normaliza cadenas sustituyendo únicamente la coma por punto, valida longitud de parte entera sin ceros iniciales y longitud de fracción. No convierte importes a Number. La precisión y las cifras enteras son configurables; la normalización no añade ceros ni unidades a cantidades no monetarias.
- Los tres inputs usan `inputmode="decimal"`, etiqueta con «euros» y un span € fijo, aria-hidden, fuera del valor editable dentro del marco compartido de `public/css/campos-decimales.css`.
- Al cargar una edición o abandonar un input monetario válido, se muestra coma y dos decimales mediante cadenas. Vacío permanece vacío; NULL solo se envía donde lo permite el contrato. Se preservan ceros iniciales.
- Blur inválido conserva la entrada y marca aria-invalid con explicación en title; al intentar enviar, el mensaje de formulario explica el error. Una corrección válida libera la marca. Errores de red/servidor conservan datos y las protecciones de envío existentes.
- Los contratos HTTP, validaciones del servidor, esquema y cálculos financieros no cambian. El listado de precios y los resúmenes de solo lectura mantienen su presentación previa.

## Evidencias y límites

83 pruebas dirigidas (utilidad, Medicamentos y Entregas) y suite completa de 858 pruebas / 29 archivos aprobadas. La suite verifica `current_database()` y usa únicamente `gestion_facturacion_medicamentos_test`, local, con fixtures y limpieza propios. Primer pase detectó un formulario simulado con precio obligatorio vacío: se completó ese fixture para conservar su comprobación del error de API. El aislamiento de Windows produjo ENOENT de temporales de Vitest; la repetición autorizada fuera del aislamiento pasó.

Revisión visual en localhost:3000, API real solo mediante GET: Medicamentos editado en pantalla sin guardar, y selección de Entregas, a 1280×1000 y 375×900. € separado, coma/dos decimales, inválidos conservados y sin desbordamiento horizontal. No se enviaron formularios ni se escribió en desarrollo. La edición de declarados está cubierta con DOM/API simulados; su revisión visual sobre una entrega guardada y lector de pantalla quedan pendientes. Los avisos municipales y la habilitación del botón permanecen cubiertos por regresiones de interfaz. La nueva búsqueda de farmacias requiere reiniciar el backend antiguo si sigue en ejecución, como ya se documentó en el bloque previo.
