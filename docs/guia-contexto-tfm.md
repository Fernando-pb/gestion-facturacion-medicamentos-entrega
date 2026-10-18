# Guía y contexto del Proyecto Final de Máster

> Versión vigente: v26 — actualizada el 12 de octubre de 2026.
> Única guía canónica: `docs/guia-contexto-tfm.md`.
> Revisión documental de v26: 12 de octubre de 2026; regla funcional sin cambios. Los apartados A.6, A.13 y A.14 y la matriz siguiente prevalecen sobre hipótesis anteriores conservadas como histórico. No se crean copias fechadas de esta guía.

## 1. Propósito del documento

Este documento es la referencia general para desarrollar el Proyecto
Final de Máster. Resume el contexto, el alcance, las herramientas, las
reglas de negocio, el método de trabajo, las pruebas y los entregables
oficiales.

Debe actualizarse cuando cambie una decisión importante. No sustituye al
`README.md` final: sirve como guía interna para construirlo
progresivamente.

------------------------------------------------------------------------

## 2. Objetivo académico

El Proyecto Final debe ser una aplicación real adaptada a los
conocimientos y experiencia del alumno. Debe demostrar lo aprendido
durante el máster, aportar valor y poder explicarse con claridad.

El máster no impone un lenguaje ni un tipo concreto de software. La
elección tecnológica debe poder justificarse.

### Aplicación al proyecto

El proyecto moderniza una aplicación interna desarrollada actualmente en
Microsoft Access. La nueva aplicación web gestionará la facturación
mensual de medicamentos dispensados por farmacias a distintos
ayuntamientos.

Su valor consiste en:

-   resolver un proceso empresarial real;
-   mejorar la trazabilidad;
-   conservar la información histórica;
-   reducir errores manuales;
-   separar correctamente facturas, cobros y pagos;
-   transformar una aplicación de escritorio en una aplicación web
    mantenible;
-   incorporar pruebas automatizadas.

------------------------------------------------------------------------

## 3. Descripción general

### 3.1 Recepción y lectura de los precintos

Cada mes se reciben precintos de medicamentos presentados por las
farmacias. La farmacia puede informar del número total de precintos y de
su importe total. Estos dos valores se guardan como referencia
informativa para compararlos con los resultados obtenidos por la
aplicación.

Durante la lectura, los precintos se organizan internamente en paquetes
numerados correlativamente desde `1`. Cada paquete contiene un máximo de
15 precintos y el último puede contener menos. Esta agrupación es una
norma interna de control y no una obligación impuesta a la farmacia.

Cada precinto incluye un código de barras que contiene el código
nacional del medicamento. El código nacional identifica el medicamento,
no de forma única el precinto físico, por lo que puede repetirse en
distintas lecturas. Cada lectura genera un registro interno
independiente.

El código nacional se comprueba contra la lista de medicamentos
autorizados:

-   al registrar, el precinto solo se acepta como facturable si el medicamento
    está `ACTIVO`, de `ALTA` y cumple las autorizaciones aplicables;
-   si no está autorizado, se registra una incidencia;
-   el precinto con incidencia se conserva y no se factura mientras no
    se resuelva.

La aplicación calcula el número total de precintos registrados y el
importe total registrado para compararlos con la información facilitada
por la farmacia. Las diferencias mostradas son informativas y no
bloquean automáticamente la lectura ni la facturación.

### 3.2 Facturación del ayuntamiento

Una vez introducidos los precintos de todas las farmacias pertenecientes
al ayuntamiento, se realiza la facturación mensual del ayuntamiento.

La facturación genera dos facturas independientes:

1.  **Factura principal de medicamentos:** recoge el importe de los
    precintos facturables y no lleva IVA.
2.  **Factura de comisión del Colegio:** corresponde a la comisión del
    2,7 % calculada sobre el total de la factura principal y lleva el
    IVA vigente.

Las dos facturas tienen numeración, importe, estado y seguimiento de
cobro independientes.

### 3.3 Información general que debe conservarse

-   Ayuntamiento facturado.
-   Mes y año del periodo.
-   Fecha de factura.
-   Farmacias incluidas.
-   Número total de recetas.
-   Número de precintos informado por la farmacia.
-   Importe informado por la farmacia.
-   Paquetes internos de 15 precintos.
-   Número total de precintos registrados.
-   Número total de precintos facturables.
-   Número de precintos con incidencia.
-   Importe total registrado.
-   Diferencias informativas respecto a los datos de la farmacia.
-   Total de la factura principal.
-   Datos de la factura de comisión.
-   Estado y fecha de cobro de cada factura.
-   Desglose correspondiente a cada farmacia.
-   Cantidad que debe pagarse a cada farmacia.
-   Datos identificativos históricos de cada farmacia.
-   Cuenta bancaria prevista y cuenta utilizada realmente en el pago.

------------------------------------------------------------------------

## 4. Objetivos del proyecto

### Objetivo general

Desarrollar una aplicación web funcional, comprensible y demostrable que
gestione el registro de precintos, la facturación mensual de los
ayuntamientos, el cobro de las dos facturas y los pagos posteriores a
las farmacias.

### Objetivos específicos

1.  Gestionar ayuntamientos.
2.  Gestionar farmacias y su asociación con ayuntamientos.
3.  Mantener los medicamentos autorizados y sus precios.
4.  Registrar periodos por mes y año.
5.  Registrar los totales informados por la farmacia.
6.  Organizar internamente los precintos en paquetes de 15.
7.  Introducir y validar precintos, permitiendo códigos nacionales
    repetidos.
8.  Registrar incidencias de medicamentos no autorizados.
9.  Mostrar los totales registrados y su comparación informativa.
10. Calcular el importe correspondiente a cada farmacia.
11. Calcular el total facturable del ayuntamiento.
12. Generar la factura principal de medicamentos sin IVA.
13. Calcular la comisión del 2,7 %.
14. Calcular el IVA vigente sobre la comisión.
15. Generar la factura independiente de comisión del Colegio.
16. Aplicar una regla uniforme de redondeo monetario.
17. Registrar las numeraciones proporcionadas por Contabilidad.
18. Registrar una única fecha oficial de factura.
19. Gestionar por separado el cobro de ambas facturas.
20. Generar la cantidad debida a cada farmacia.
21. Conservar los datos históricos de cada farmacia al facturar.
22. Conservar la cuenta bancaria prevista para el pago.
23. Registrar el pago realizado a cada farmacia.
24. Conservar la cuenta bancaria utilizada realmente.
25. Consultar deudas de ayuntamientos y pagos pendientes a farmacias.
26. Consultar el informe anual operativo de precintos agrupado por trimestre.
27. Garantizar la trazabilidad financiera.
28. Incorporar pruebas automatizadas.

------------------------------------------------------------------------

## 5. Alcance del MVP

### Incluido

-   [ ] Gestión de ayuntamientos.
-   [ ] Gestión de farmacias y sus cuentas bancarias.
-   [ ] Asociación entre ayuntamientos y farmacias.
-   [ ] Gestión de medicamentos autorizados y precios.
-   [ ] Creación de periodos mensuales.
-   [ ] Registro del número de precintos y el importe informados por la
    farmacia.
-   [ ] Organización interna en paquetes numerados de un máximo de 15
    precintos.
-   [ ] Registro y validación de precintos.
-   [ ] Admisión de códigos nacionales repetidos en lecturas
    independientes.
-   [ ] Registro y consulta de incidencias.
-   [ ] Cálculo y visualización de totales registrados y facturables.
-   [ ] Comparación informativa con los datos facilitados por la
    farmacia.
-   [ ] Cálculo del importe por farmacia.
-   [ ] Cálculo del total del ayuntamiento.
-   [ ] Generación de la factura principal sin IVA.
-   [ ] Cálculo de la comisión del 2,7 %.
-   [ ] Cálculo del IVA vigente.
-   [ ] Generación de la factura de comisión del Colegio.
-   [ ] Aplicación del redondeo establecido.
-   [ ] Registro de numeraciones y fecha de factura.
-   [ ] Gestión independiente del cobro de las dos facturas.
-   [ ] Generación de la cantidad debida a cada farmacia.
-   [ ] Conservación de los datos históricos de las farmacias.
-   [ ] Conservación de las cuentas bancarias previstas.
-   [ ] Registro de pagos a farmacias y cuentas utilizadas.
-   [ ] Informe anual operativo de precintos agrupado por trimestre del periodo facturado.
-   [ ] Pruebas automatizadas.
-   [ ] Documentación y despliegue demostrable.

### Fuera del MVP

-   Integración automática con eFactura.
-   Integración directa con entidades bancarias.
-   Generación automática de transferencias o ficheros bancarios.
-   Importación masiva avanzada desde Access.
-   Lectura de códigos mediante cámara.
-   Notificaciones automáticas.
-   Cuadros de mando avanzados.
-   Firma electrónica.
-   Aplicación móvil.

------------------------------------------------------------------------

## 6. Stack tecnológico

  -----------------------------------------------------------------------
  Necesidad               Herramienta             Justificación
  ----------------------- ----------------------- -----------------------
  Editor                  Visual Studio Code      Entorno conocido y con
                                                  terminal integrada.

  Lenguaje                JavaScript              Curva de aprendizaje
                                                  razonable.

  Ejecución               Node.js                 Adecuado para
                                                  desarrollar una API
                                                  REST.

  Framework               Express                 Sencillo, maduro y
                                                  fácil de explicar.

  Base de datos           PostgreSQL              Ofrece integridad,
                                                  relaciones y
                                                  trazabilidad.

  Acceso a datos          `pg`                    Permite utilizar SQL
                                                  explícito.

  Validación              Zod                     Centraliza las
                                                  validaciones de
                                                  entrada.

  Pruebas                 Vitest y Supertest      Permiten probar lógica
                                                  y endpoints.

  Repositorio             Git y GitHub            Control de versiones y
                                                  entrega del código.

  Asistente principal     Codex                   Análisis,
                                                  implementación, pruebas
                                                  y documentación.

  Revisión secundaria     OpenCode                Segunda revisión
                                                  puntual.

  Consola                 Terminal integrada de   Punto único para
                          VS Code                 ejecutar comandos.
  -----------------------------------------------------------------------

### Decisiones de simplificación

-   Se utilizará JavaScript inicialmente, no TypeScript.
-   Se construirá una aplicación modular única, sin microservicios.
-   No se incorporarán inicialmente Docker, ORM ni CI/CD.
-   La aplicación registrará los pagos, pero no ejecutará transferencias
    bancarias.
-   En pruebas y demostraciones solo se utilizarán datos ficticios.

------------------------------------------------------------------------

## 7. Arquitectura inicial

La aplicación tendrá una arquitectura por capas:

1.  **Rutas:** definen los endpoints.
2.  **Controladores:** reciben peticiones y generan respuestas.
3.  **Servicios:** contienen las reglas de negocio y los cálculos.
4.  **Repositorios:** ejecutan consultas SQL.
5.  **Base de datos:** conserva los datos y aplica restricciones.

### Principios

-   separación de responsabilidades;
-   validación de datos;
-   reglas y cálculos económicos centralizados;
-   consultas parametrizadas;
-   transacciones para operaciones financieras;
-   restricciones de integridad en PostgreSQL;
-   conservación del histórico;
-   protección de información bancaria;
-   errores HTTP coherentes;
-   código sencillo de probar y explicar.

------------------------------------------------------------------------

## 8. Reglas de negocio esenciales

### 8.1 Precintos y medicamentos

1.  Al registrar, un precinto solo se acepta como facturable si su código
    corresponde a un medicamento `ACTIVO`, de `ALTA` y autorizado para
    la lista aplicable, incluida la relación específica si corresponde.
2.  Un precinto no autorizado debe conservarse como incidencia.
3.  Los precintos con incidencias no se facturan mientras no se
    resuelvan.
4.  El código nacional identifica el medicamento y puede repetirse en
    distintos precintos.
5.  El precio aplicado a cada precinto debe conservarse históricamente.
6.  Un cambio posterior del precio no modifica facturas anteriores.

La aceptación se conserva aunque después cambien estados o listas. La
facturación utiliza los precintos aceptados en el periodo mensual de su
entrega, sin reevaluar las condiciones actuales ni posponerlos a otros meses.
Los detalles se recogen en A.4, A.5 y A.7.

Cada lectura debe generar un identificador interno propio y conservar el
código leído, el código nacional, el paquete, la posición, el
medicamento identificado, el precio aplicado, el resultado de la
validación y la incidencia, cuando exista.

Como el código nacional no identifica de forma única el precinto físico,
no se aplicará una restricción de unicidad sobre este código. El control
de la lectura se apoyará en los paquetes y en los recuentos mostrados al
usuario.

### 8.1.1 Paquetes internos

-   Los precintos se agrupan internamente en paquetes de un máximo de
    15.
-   Los paquetes se numeran correlativamente desde `1` dentro de cada
    farmacia y periodo.
-   Cuando un paquete alcanza 15 precintos, se cierra y se continúa con
    el siguiente.
-   El último paquete puede contener menos de 15 precintos.
-   Cada precinto pertenece a un único paquete.
-   Cada paquete pertenece a una única farmacia y periodo.
-   La agrupación es una medida interna de control y no una obligación
    de la farmacia.
-   Un paquete incluido en una facturación no puede modificarse.

Ejemplo para 37 precintos:

      Paquete   Precintos
  ----------- -----------
            1          15
            2          15
            3           7
    **Total**      **37**

Cada paquete conservará su identificador, número, farmacia,
ayuntamiento, periodo, número de lecturas, estado y las marcas técnicas
necesarias para auditoría.

Estados iniciales propuestos:

-   `ABIERTO`: admite nuevas lecturas.
-   `CERRADO`: se completó o se cerró manualmente.
-   `FACTURADO`: sus precintos se incluyeron en una facturación.

### 8.1.2 Totales y comparación informativa

La aplicación puede registrar como referencia los datos facilitados por
la farmacia:

-   número de precintos informado;
-   importe total informado.

Durante la lectura calculará y mostrará:

-   precintos registrados;
-   precintos facturables;
-   precintos con incidencia;
-   importe total registrado;
-   importe total facturable.

``` text
Total de precintos registrados = suma de las lecturas de todos los paquetes
Importe facturable = suma de los precios de los precintos válidos
```

La comparación entre la información facilitada por la farmacia y los
valores calculados es informativa. Una diferencia no bloquea
automáticamente la lectura, el cierre de paquetes ni la facturación. El
usuario decide si debe revisarla.

  Comparación                       Indicador posible
  --------------------------------- -------------------------------
  Los valores coinciden             Coincide
  Existen diferencias               Revisar
  La farmacia no facilitó el dato   Sin información para comparar

### 8.2 Fecha de factura

7.  Cada facturación mensual tendrá una única fecha oficial de factura.
8.  La fecha de factura corresponderá normalmente al último día del mes
    facturado.
9.  Las dos facturas generadas para el ayuntamiento utilizarán esa fecha
    de factura.
10. Una marca técnica como `created_at` puede indicar cuándo se creó el
    registro en la aplicación, pero no constituye una segunda fecha de
    facturación.

Ejemplos:

  Periodo           Fecha normal de factura
  ----------------- -------------------------
  Enero de 2026     31/01/2026
  Febrero de 2026   28/02/2026
  Marzo de 2026     31/03/2026
  Abril de 2026     30/04/2026

### 8.3 Dos facturas independientes

11. La facturación mensual de un ayuntamiento genera dos facturas
    independientes:
    -   factura principal de medicamentos;
    -   factura de comisión del Colegio.
12. Cada factura tiene código o número, importe, estado y seguimiento de
    cobro propios.
13. El pago de una factura no implica el pago automático de la otra.

  Factura principal   Factura de comisión
  ------------------- ---------------------
  Pagada              Pendiente
  Pendiente           Pagada
  Pagada              Pagada
  Pendiente           Pendiente

### 8.4 Factura principal de medicamentos

14. La factura principal agrupa los precintos facturables de todas las
    farmacias del ayuntamiento durante el periodo.
15. Debe conservar el número total de recetas y el número total de
    precintos.
16. Su importe es la suma de los precios aplicados a los precintos
    facturables.
17. La factura principal no lleva IVA.

``` text
Total factura principal = suma de los precintos facturables
IVA factura principal = 0,00 €
```

18. La suma de los importes correspondientes a las farmacias debe
    coincidir con el total de la factura principal.

``` text
Total factura principal = suma de las cantidades debidas a las farmacias
```

### 8.5 Factura de comisión del Colegio

19. La factura de comisión es independiente de la factura principal.
20. Su base de cálculo es el total de la factura principal del
    ayuntamiento.
21. La comisión actual es el 2,7 % de esa base.

``` text
Base de la comisión = total factura principal
Comisión = base de la comisión × 2,7 %
```

22. El porcentaje aplicado debe guardarse históricamente.
23. Un cambio futuro del porcentaje no modifica facturas anteriores.

### 8.6 IVA de la comisión

24. A la comisión se le aplica actualmente el tipo general de IVA del 21
    %.
25. El porcentaje estará sujeto a la legislación vigente en la fecha de
    factura.
26. El tipo de IVA debe ser configurable o tener fechas de vigencia.
27. El porcentaje aplicado debe guardarse en la factura.
28. Un cambio posterior del IVA no modifica facturas anteriores.

``` text
IVA de la comisión = comisión redondeada × IVA vigente
Total factura del Colegio = comisión redondeada + IVA redondeado
```

### 8.7 Regla de redondeo

29. Los importes monetarios se redondean a dos decimales.
30. Se examina el tercer decimal:
    -   si es menor que `5`, se mantienen los dos primeros decimales;
    -   si es igual o mayor que `5`, se incrementa el segundo decimal.
31. Esta regla corresponde al redondeo `ROUND_HALF_UP`.

    Importe calculado   Resultado
  ------------------- -----------
             10,123 €     10,12 €
             10,124 €     10,12 €
             10,125 €     10,13 €
             10,126 €     10,13 €
             10,999 €     11,00 €

### 8.8 Orden de cálculo

32. El cálculo se realiza en este orden:
    1.  obtener el total de la factura principal;
    2.  calcular el 2,7 % de comisión;
    3.  redondear la comisión a dos decimales;
    4.  calcular el IVA sobre la comisión redondeada;
    5.  redondear el IVA a dos decimales;
    6.  sumar la comisión y el IVA redondeados.

Ejemplo:

``` text
Factura principal:             1.000,00 €
IVA factura principal:             0,00 €

Comisión del 2,7 %:               27,00 €
IVA del 21 %:                       5,67 €
Total factura del Colegio:         32,67 €
```

### 8.9 Desglose e histórico de las farmacias

33. La facturación debe conservar el desglose correspondiente a cada
    farmacia incluida.
34. Para cada farmacia debe registrarse:
    -   identificador interno;
    -   nombre o razón social;
    -   NIF o CIF;
    -   dirección;
    -   municipio;
    -   datos de contacto necesarios;
    -   cuenta bancaria prevista;
    -   número de recetas;
    -   número de precintos facturables;
    -   importe correspondiente;
    -   cantidad que debe pagarse a la farmacia.
35. Estos datos forman una fotografía histórica y no cambian si se
    modifica posteriormente la ficha de la farmacia.
36. Los nuevos datos se utilizarán únicamente en futuras facturaciones.

### 8.10 Cuentas bancarias y pagos a farmacias

37. La cuenta prevista será la registrada y validada en el momento de
    facturar.
38. Un cambio posterior de cuenta no modifica facturaciones anteriores.
39. Antes de pagar una cantidad pendiente debe comprobarse que la cuenta
    prevista continúa siendo válida.
40. Al realizar el pago se registran:
    -   importe pagado;
    -   fecha del pago;
    -   estado;
    -   cuenta utilizada realmente;
    -   referencia o justificante, cuando exista.
41. Si se utiliza una cuenta diferente, se conservan tanto la prevista
    al facturar como la utilizada al pagar.
42. En listados generales, el IBAN se muestra parcialmente oculto, por
    ejemplo `ES12 **** **** **** 1234`.
43. Solo los usuarios autorizados pueden consultar o modificar datos
    bancarios.

### 8.11 Trazabilidad

44. La factura principal debe conservar:
    -   código o número;
    -   fecha de factura;
    -   periodo;
    -   ayuntamiento;
    -   número total de recetas;
    -   número total de precintos;
    -   importe total;
    -   IVA igual a cero;
    -   estado y fecha de cobro;
    -   desglose por farmacia.
45. La factura del Colegio debe conservar:
    -   código o número;
    -   fecha de factura;
    -   periodo;
    -   ayuntamiento;
    -   base de cálculo;
    -   porcentaje e importe de comisión;
    -   porcentaje e importe de IVA;
    -   importe total;
    -   estado y fecha de cobro.
46. La información financiera necesaria para auditoría no debe
    eliminarse físicamente.
47. Debe poder conocerse qué ocurrió, cuándo y con qué datos.

------------------------------------------------------------------------

## 9. Información actual e histórica

  Información actual                 Información histórica
  ---------------------------------- ---------------------------------
  Datos actuales de la farmacia      Datos utilizados al facturar
  Precio actual                      Precio aplicado al precinto
  Cuenta bancaria activa             Cuenta prevista al facturar
  Comisión vigente                   Comisión aplicada en la factura
  IVA vigente                        IVA aplicado en la factura
  Puede modificarse                  No debe modificarse
  Se utiliza en operaciones nuevas   Se conserva para auditoría

Pueden existir tres referencias bancarias:

1.  Cuenta actual de la farmacia.
2.  Cuenta prevista cuando se generó la cantidad debida.
3.  Cuenta utilizada realmente al efectuar el pago.

------------------------------------------------------------------------

## 10. Plan de desarrollo

### Fase 0. Preparación

-   [ ] Revisar el repositorio existente.
-   [ ] Confirmar versiones de Node.js y PostgreSQL.
-   [ ] Configurar variables de entorno.
-   [ ] Preparar scripts de ejecución y pruebas.
-   [ ] Crear una prueba inicial.

### Fase 1. Modelo de datos

-   [ ] Definir entidades, relaciones y estados.
-   [ ] Diseñar entregas, paquetes y lecturas de precintos.
-   [ ] Diseñar las dos facturas independientes.
-   [ ] Diseñar el desglose por farmacia.
-   [ ] Diseñar los históricos de precios, porcentajes y farmacias.
-   [ ] Diseñar cuentas bancarias y pagos.
-   [ ] Crear el esquema de PostgreSQL.
-   [ ] Documentar las decisiones.

### Fase 2. Datos maestros

-   [ ] Implementar ayuntamientos.
-   [ ] Implementar farmacias y asociaciones.
-   [ ] Implementar cuentas bancarias.
-   [ ] Implementar medicamentos y precios.
-   [ ] Implementar porcentajes con vigencia.
-   [ ] Añadir pruebas.

### Fase 3. Periodos y precintos

-   [ ] Crear periodos.
-   [ ] Registrar los datos informativos de la farmacia.
-   [ ] Crear y numerar paquetes de 15 precintos.
-   [ ] Registrar precintos.
-   [ ] Permitir códigos nacionales repetidos en registros
    independientes.
-   [ ] Validar medicamentos.
-   [ ] Registrar incidencias.
-   [ ] Calcular totales registrados y facturables.
-   [ ] Mostrar la comparación informativa.
-   [ ] Probar casos válidos e inválidos.

### Fase 4. Facturación

-   [ ] Calcular los importes de las farmacias.
-   [ ] Calcular el total del ayuntamiento.
-   [ ] Generar la factura principal sin IVA.
-   [ ] Calcular y redondear la comisión.
-   [ ] Calcular y redondear el IVA.
-   [ ] Generar la factura del Colegio.
-   [ ] Registrar numeraciones y fecha de factura.
-   [ ] Guardar porcentajes y datos históricos.
-   [ ] Generar las cantidades debidas a farmacias.
-   [ ] Crear pruebas de cálculos y transacciones.

### Fase 5. Cobros, pagos e informes

-   [ ] Gestionar independientemente el cobro de ambas facturas.
-   [ ] Consultar facturas pendientes.
-   [ ] Registrar pagos a farmacias.
-   [ ] Guardar las cuentas utilizadas.
-   [ ] Consultar cantidades pendientes.
-   [ ] Generar el informe anual operativo de precintos.

### Fase 6. Cierre

-   [ ] Completar el `README.md`.
-   [ ] Preparar datos ficticios.
-   [ ] Desplegar la aplicación.
-   [ ] Crear las slides.
-   [ ] Grabar el vídeo.
-   [ ] Ensayar la defensa.
-   [ ] Comprobar los enlaces de entrega.

------------------------------------------------------------------------

## 11. Método de trabajo

Para cada funcionalidad:

1.  Definir el caso de uso y sus criterios de aceptación.
2.  Revisar la implementación existente.
3.  Crear una rama Git.
4.  Identificar archivos, tablas y endpoints afectados.
5.  Explicar el cambio antes de implementarlo.
6.  Implementar una parte pequeña.
7.  Añadir pruebas.
8.  Ejecutar todas las pruebas.
9.  Revisar `git diff`.
10. Probar manualmente.
11. Actualizar la documentación.
12. Crear un commit claro.

Ejemplo:

``` text
Rama: feature/paquetes-precintos
Commit: feat: organizar precintos en paquetes de quince
```

### Uso de IA

-   Codex será el asistente principal.
-   OpenCode se utilizará como segunda revisión puntual.
-   Los dos asistentes no modificarán simultáneamente los mismos
    archivos.
-   Todo cambio generado se revisará y probará.
-   Se solicitarán explicaciones del código no comprendido.
-   El uso de IA y su validación se documentarán en la memoria.

------------------------------------------------------------------------

## 12. Estrategia de pruebas

### Pruebas unitarias

-   límite de 15 precintos por paquete;
-   numeración correlativa de paquetes;
-   admisión de códigos nacionales repetidos;
-   cálculo de recuentos e importes informativos;
-   suma de importes de precintos;
-   cálculo del importe por farmacia;
-   factura principal sin IVA;
-   comisión del 2,7 %;
-   IVA vigente;
-   total de la factura del Colegio;
-   redondeo con tercer decimal menor, igual o mayor que `5`;
-   ocultación parcial del IBAN.

### Pruebas de integración

-   relación entre farmacia, periodo, paquetes y precintos;
-   varios paquetes para una misma entrega;
-   comparación no bloqueante de los totales;
-   generación de las dos facturas;
-   numeraciones y estados independientes;
-   cobros independientes;
-   desglose por farmacia;
-   conservación de precios y porcentajes;
-   fotografía histórica de la farmacia;
-   conservación de cuentas bancarias;
-   registro de pagos.

### Pruebas de API

-   creación y consulta de la facturación;
-   validación de entradas;
-   códigos HTTP;
-   recursos inexistentes;
-   operaciones incoherentes;
-   registro independiente de cobros;
-   registro de pagos a farmacias;
-   protección de información bancaria.

### Casos históricos imprescindibles

1.  El primer paquete recibe el número `1`.
2.  Un paquete no admite más de 15 precintos.
3.  El último paquete puede contener menos de 15.
4.  Varias lecturas pueden tener el mismo código nacional.
5.  Cada lectura obtiene un identificador interno distinto.
6.  Las diferencias informativas no bloquean la facturación.
7.  Cambiar un precio no modifica facturas anteriores.
8.  Cambiar datos de una farmacia no modifica su fotografía histórica.
9.  Cambiar el IBAN no modifica la cuenta prevista en operaciones
    anteriores.
10. Pagar en otra cuenta conserva ambas referencias.
11. Cambiar la comisión o el IVA no modifica facturas anteriores.
12. Pagar una factura no cambia el estado de la otra.
13. La factura principal conserva siempre IVA igual a cero.
14. La suma del desglose de farmacias coincide con el total principal.

Cada prueba debe preparar sus propios datos y no depender del orden de
ejecución.

------------------------------------------------------------------------

## 13. Requisitos oficiales de entrega

### README.md

-   [ ] Descripción general.
-   [ ] Stack tecnológico.
-   [ ] Instalación y ejecución.
-   [ ] Estructura del proyecto.
-   [ ] Funcionalidades principales.
-   [ ] Credenciales de prueba, si existe login.
-   [ ] URL del despliegue.
-   [ ] Enlace a las slides.
-   [ ] Enlace al vídeo.

### Código fuente

-   [ ] Repositorio público en GitHub.
-   [ ] Justificación y acceso de evaluación si es privado.

### Despliegue

-   [ ] Aplicación publicada cuando sea posible.
-   [ ] URL incluida en el `README.md`.
-   [ ] Uso exclusivo de datos ficticios.
-   [ ] Ninguna cuenta bancaria real.

### Presentación y vídeo

-   [ ] Slides con enlace público o archivo adjunto.
-   [ ] Vídeo con explicación personal y captura obligatoria de
    pantalla.
-   [ ] Enlaces incluidos en el `README.md`.
-   [ ] Ningún dato bancario real visible.

------------------------------------------------------------------------

## 14. Formulario de entrega

-   [ ] Nombre completo.
-   [ ] Correo utilizado en la inscripción.
-   [ ] URL del repositorio.
-   [ ] URL del despliegue, si existe.
-   [ ] URL de las slides.
-   [ ] URL del vídeo.
-   [ ] Credenciales de prueba, si existen.

La documentación facilitada indica la fecha **20/07/2026**. Debe
confirmarse en el temario o canal oficial vigente, ya que puede
corresponder a una convocatoria concreta.

------------------------------------------------------------------------

## 15. Documentación durante el desarrollo

  -----------------------------------------------------------------------
  Tipo                                Ejemplo
  ----------------------------------- -----------------------------------
  Requisito funcional                 Generar dos facturas independientes
                                      por ayuntamiento y periodo.

  Requisito funcional                 Organizar los precintos en paquetes
                                      internos de 15.

  Requisito no funcional              Mantener la trazabilidad
                                      financiera.

  Regla de negocio                    Los códigos nacionales pueden
                                      repetirse en lecturas
                                      independientes.

  Regla de negocio                    La comparación con los datos de la
                                      farmacia es informativa y no
                                      bloqueante.

  Regla de negocio                    La factura principal no lleva IVA.

  Regla de negocio                    La comisión del 2,7 % lleva el IVA
                                      vigente.

  Regla de negocio                    La fecha de factura suele ser el
                                      último día del periodo.

  Decisión arquitectónica             Guardar fotografías históricas.

  Prueba                              Pagar una factura no altera el
                                      estado de la otra.

  Prueba                              Un paquete no admite más de 15
                                      precintos.

  Riesgo                              Utilizar una cuenta bancaria
                                      desactualizada.

  Mejora futura                       Integración automática con
                                      eFactura.
  -----------------------------------------------------------------------

Para cada decisión se documentarán el problema, las alternativas, la
solución, la justificación, sus consecuencias y las pruebas.

------------------------------------------------------------------------

## 16. Riesgos y medidas preventivas

  -----------------------------------------------------------------------
  Riesgo                              Medida preventiva
  ----------------------------------- -----------------------------------
  Lectura física repetida no          Utilizar paquetes, posiciones y
  detectable por código nacional      recuentos como control interno.

  Diferencias con la información de   Mostrar una comparación informativa
  la farmacia                         para revisión del usuario.

  Más de 15 lecturas en un paquete    Aplicar una validación automática
                                      del límite.

  Confundir las dos facturas          Utilizar números, importes y
                                      estados separados.

  Aplicar IVA a la factura principal  Probar que su IVA es siempre cero.

  Omitir el IVA de la comisión        Validar el cálculo de la factura
                                      del Colegio.

  Errores de redondeo                 Centralizar el cálculo y usar
                                      precisión decimal.

  Cambios de precio o porcentajes     Guardar los valores aplicados.

  Cambios en una farmacia             Guardar una fotografía histórica.

  Cambio de cuenta bancaria           Conservar la cuenta prevista y la
                                      utilizada.

  Pago a una cuenta antigua           Verificar la cuenta antes del pago.

  Exposición de datos bancarios       Restringir acceso y ocultar
                                      parcialmente el IBAN.

  Datos reales en pruebas             Utilizar información ficticia.

  Alcance excesivo                    Priorizar el MVP.

  Falta de tiempo                     Completar primero el flujo
                                      principal.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 17. Definición de terminado

Una funcionalidad estará terminada cuando:

-   [ ] cumpla sus criterios de aceptación;
-   [ ] valide los datos;
-   [ ] mantenga la integridad;
-   [ ] conserve el histórico;
-   [ ] proteja los datos sensibles;
-   [ ] gestione los errores;
-   [ ] tenga pruebas que pasen;
-   [ ] se haya probado manualmente;
-   [ ] pueda explicarse;
-   [ ] esté documentada;
-   [ ] tenga un commit claro.

------------------------------------------------------------------------

## 18. Preguntas posibles del tribunal

1.  ¿Por qué se organizan internamente los precintos en paquetes de 15?
2.  ¿Por qué pueden repetirse los códigos nacionales?
3.  ¿Cómo se reduce el riesgo de repetir una lectura física?
4.  ¿Por qué las diferencias con los datos de la farmacia son
    informativas?
5.  ¿Por qué existen dos facturas independientes?
6.  ¿Por qué la factura principal no lleva IVA?
7.  ¿Por qué la comisión tiene IVA?
8.  ¿Cómo se gestionan los cobros independientes?
9.  ¿Cómo se calcula y redondea la comisión?
10. ¿Cómo se gestiona un cambio legislativo del IVA?
11. ¿Por qué se conserva el desglose por farmacia?
12. ¿Qué ocurre si cambia una farmacia o su cuenta bancaria?
13. ¿Cómo se protegen los datos bancarios?
14. ¿Qué pruebas garantizan la integridad financiera?
15. ¿Qué parte pertenece al MVP?
16. ¿Cómo se utilizó y validó la IA?

------------------------------------------------------------------------

## 19. Próximos pasos

1.  Confirmar el estado del repositorio.
2.  Diseñar el modelo entidad-relación.
3.  Definir las entidades de entrega, paquete y lectura de precinto.
4.  Definir las entidades de facturación y su desglose por farmacia.
5.  Confirmar si las dos facturas utilizan series de numeración
    diferentes.
6.  Confirmar si se permiten pagos parciales de ayuntamientos y
    farmacias.
7.  Definir los estados de paquetes, facturas, cobros y pagos.
8.  Diseñar los tipos de IVA con fecha de vigencia.
9.  Centralizar los cálculos y el redondeo.
10. Ordenar el backlog.
11. Implementar el primer caso de uso completo.
12. Actualizar progresivamente el `README.md`.

------------------------------------------------------------------------

## 20. Criterio general para tomar decisiones

Se elegirá la alternativa que permita:

1.  completar el flujo de negocio;
2.  separar correctamente ambas facturas;
3.  conservar el desglose y la información histórica;
4.  aplicar cálculos reproducibles;
5.  proteger los datos financieros;
6.  escribir pruebas útiles;
7.  mantener una estructura sencilla;
8.  comprender y explicar la solución;
9.  terminar y demostrar el proyecto.

------------------------------------------------------------------------

# Actualización funcional --- 28/09/2026

> **Esta sección forma parte de la versión 3 de la guía.** En caso de
> contradicción con apartados anteriores de la versión 2, prevalecen las
> decisiones confirmadas en esta actualización. En una revisión
> posterior se integrarán estas reglas dentro de cada capítulo para
> evitar duplicidades.

## A. Decisiones funcionales confirmadas

### A.1 Ayuntamientos y farmacias

-   Cada ayuntamiento tendrá un identificador interno.
-   El CIF del ayuntamiento es obligatorio y único.
-   Un ayuntamiento puede estar **ACTIVO** o **INACTIVO**.
-   Un ayuntamiento inactivo conserva todo su histórico, no debe
    utilizarse para nuevas facturaciones y puede volver a activarse.
-   Para el MVP se mantienen los datos de ayuntamiento ya identificados:
    CIF, denominación, dirección, código postal, localidad, provincia,
    teléfono, móvil, persona responsable, persona de contacto y alcalde.
-   Todos los datos utilizados en desarrollo, pruebas, demostraciones y
    documentación serán ficticios.
-   El **SOE** identifica oficialmente al establecimiento farmacéutico y
    permanece aunque cambie el titular.
-   La farmacia tendrá un identificador interno y el SOE será
    obligatorio y único.
-   Una farmacia puede pertenecer a cero o un ayuntamiento a la vez. Las relaciones usan el identificador interno estable de FARMACIA, nunca el SOE.
-   El modelo y `db/schema.sql` admiten `farmacia.ayuntamiento_id = NULL`. Para bases existentes se aplica el script 001 según `db/README.md`, conservando filas, FK e índice; solo se verificó en la base de pruebas. El CRUD lee/edita maestros desasignados, conserva alta con Ayuntamiento y PUT sin cambio de asignación. POST/DELETE municipales ya aplican control atómico de actividad y origen esperado. El futuro registro de entregas deberá compartir el protocolo de bloqueo/validación de `docs/specs/gestion-ayuntamiento/plan.md`, §6; la FK por sí sola no garantiza la pertenencia seleccionada. Búsquedas, listas e interfaz municipal siguen pendientes.
-   Se puede asignar, reasignar o dejar sin ayuntamiento una farmacia solo si no existen entregas ni precintos asociados. La comprobación y el cambio deben ser atómicos; no se exige un control independiente de facturación para esta operación.
-   La farmacia sin ayuntamiento asignado no puede registrar entregas ni recibir precintos. Al registrar, además, debe comprobarse que la farmacia pertenece al ayuntamiento seleccionado.
-   No se crea historial de cambios de asignación. La reasignación no traslada ni modifica entregas, precintos ni facturación cerrada; como el cambio se bloquea tras la primera entrega, los registros operativos siguen correspondiendo al ayuntamiento vigente.
-   Las farmacias registradas pueden presentar precintos. Que una
    farmacia no presente precintos durante un periodo no significa que
    esté inactiva.
-   La participación de una farmacia en un periodo depende de que haya
    presentado/registrado precintos en ese periodo.

### A.2 Selección de farmacia e introducción de precintos

-   Antes de comenzar a leer precintos, el usuario selecciona el
    **periodo, ayuntamiento y farmacia**.
-   La selección de farmacia se limita a las farmacias actualmente asociadas al ayuntamiento seleccionado. El servidor valida la relación usando el identificador interno y rechaza una farmacia sin ayuntamiento o asignada a otro.
-   Una asignación solo puede cambiarse antes de que exista cualquier entrega o precinto de esa farmacia; una entrega bloquea aunque no contenga precintos. El cambio de asignación y la creación de entregas deben coordinarse atómicamente para impedir carreras.
-   El precinto **no identifica la farmacia**. La farmacia viene
    determinada por la selección previa del usuario.
-   Cada lectura representa exactamente **un precinto**.
-   Para este proyecto se adopta la equivalencia **1 precinto = 1
    receta**.
-   La cantidad de una lectura es implícitamente `1`. Los recuentos de
    códigos iguales se obtienen agrupando lecturas.
-   El código nacional identifica el medicamento, no el precinto físico,
    por lo que puede repetirse legítimamente.
-   Cada lectura tendrá su propio identificador interno.
-   El usuario puede dar por terminada temporalmente la introducción de
    una farmacia, seleccionar otra y posteriormente volver a la anterior
    mientras la facturación siga editable.
-   "Terminar la introducción" de una farmacia no supone bloquearla ni
    cerrar la facturación del ayuntamiento.

### A.3 Paquetes

-   Los paquetes son una agrupación interna de control.
-   Cada paquete admite un máximo de **15 precintos**.
-   La aplicación crea y numera los paquetes automáticamente.
-   Las lecturas 1--15 pertenecen al paquete 1, las 16--30 al paquete 2,
    etc.
-   El último paquete puede contener menos de 15 precintos.
-   El usuario no necesita iniciar manualmente un nuevo paquete.

### A.4 Periodo de los precintos recibidos con retraso

-   Una farmacia puede presentar con retraso precintos correspondientes
    operativamente a meses anteriores.
-   Los precintos pueden llegar mezclados y físicamente no existe
    información suficiente para determinar a qué mes anterior pertenece
    cada uno.
-   Por tanto, **no se almacenará un "periodo de origen" inventado por
    precinto**.
-   Los precintos se imputan al periodo de facturación en el que se
    presentan y procesan.

### A.5 Medicamentos autorizados e incidencias

-   `MEDICAMENTO.estado` admite `ACTIVO` e `INACTIVO` y representa pertenencia
    a la lista general autorizada, no la situación comercial. `INACTIVO`
    impide nuevas aceptaciones sin invalidar las anteriores.
-   Existe una **lista general de medicamentos autorizados por
    convenio**.
-   Un ayuntamiento puede utilizar esa lista general o disponer de una
    lista específica.
-   Con modalidad `GENERAL` se aplica únicamente la lista general. Las
    asociaciones específicas existentes se conservan y se muestran con
    el aviso «No se aplica mientras se utiliza la lista general», pero
    no se aplican mientras rige esa modalidad.
-   Al volver a `ESPECIFICA`, las asociaciones conservadas vuelven a
    aplicarse junto con las condiciones de autorización general y
    situación comercial ya documentadas. Cambiar de modalidad no borra
    asociaciones automáticamente.
-   La gestión municipal no crea un histórico de listas ni tablas de
    historial. Los precintos ya aceptados y las facturaciones cerradas
    conservan las reglas históricas vigentes.
-   Si un ayuntamiento utiliza lista específica, al registrar debe comprobarse
    pertenencia a la lista general y autorización mediante
    `AYUNTAMIENTO_MEDICAMENTO`, además de la situación comercial `ALTA`.
-   El sistema deberá distinguir expresamente entre "usa lista general"
    y "usa lista específica"; una lista específica vacía no debe
    interpretarse automáticamente como lista general.
-   Un medicamento no autorizado genera una incidencia y su precinto no
    se factura.
-   «NO ESTÁ» describe la incidencia de un precinto cuyo código no figura
    en la lista autorizada aplicable; no es un estado de MEDICAMENTO ni
    introduce un nuevo valor de motivo en el esquema.
-   La elegibilidad se determina al registrar. Un precinto aceptado sigue
    siendo facturable aunque después cambien el estado del medicamento o
    las listas aplicables. La facturación no reevalúa la autorización actual.
-   Los precintos aceptados se facturan en el periodo mensual de su entrega,
    conforme a A.4; no se trasladan a meses posteriores por esos cambios.
-   La incidencia se conserva; no se elimina la lectura.
-   Para el MVP no se implementará un flujo complejo para resolver y
    reincorporar una incidencia a la misma facturación.
-   El motivo inicial de incidencia puede estructurarse como
    `MEDICAMENTO_NO_AUTORIZADO`.
-   Los códigos desconocidos/no autorizados se conservarán para poder
    estudiar su frecuencia.
-   Si posteriormente se decide admitir uno de esos medicamentos, se
    incorporará a la lista general y, cuando corresponda, a la lista
    específica del ayuntamiento. Esto no modificará facturaciones
    históricas ya cerradas.

### A.6 Precios

| Facturación Ayuntamiento/periodo/TD | Cobros en cualquiera de las dos facturas | Añadir lecturas / corregir un precio individual |
|---|---|---|
| Sin cabecera (SIN_FACTURAR, estado derivado) | No existen facturas de ese proceso | Permitido, sin preparar revisión |
| REVISION | Ninguno | Permitido |
| EMITIDA | Ninguno | Bloqueado hasta reapertura controlada |
| REABIERTA | Ninguno | Permitido |
| Cualquier estado con cobro | Alguno | Bloqueado; tampoco se permite reabrir |

El servidor consulta estado y cobros después de adquirir los bloqueos compartidos con emisión, preparación, reapertura y cobro. El listado neutral de entregas no devuelve ese permiso; se obtiene del contexto financiero de la entrega. Un historial de reapertura no sustituye el estado actual. SIN_FACTURAR no es una columna ni un estado nuevo de FACTURACION o PERIODO.

-   El precio del medicamento puede cambiar entre periodos.
-   El catálogo maestro puede prepararse a partir de otra base de datos existente. En esta implementación, la referencia de una nueva lectura es el precio maestro vigente observado y revalidado por el servidor al guardarla; no se consulta una fuente externa al corregirla.
-   El precio aplicado a cada precinto debe conservarse históricamente.
-   Un cambio posterior del precio no altera facturaciones anteriores.
-   Antes del cierre, el usuario puede realizar una corrección
    excepcional del precio.
-   Regla vigente concretada el 12 de octubre: cada precinto conserva su propio aplicado y la corrección modifica únicamente el ID seleccionado, sin afectar otras lecturas del mismo código, farmacia o periodo. Sustituye la corrección por grupo documentada anteriormente.
-   La corrección no modifica el precio maestro ni las lecturas de otras
    farmacias.
-   Se conservan separadamente el precio de referencia y el finalmente aplicado. Nueva lectura captura el precio de catálogo observado por el servidor en ambos campos. La corrección posterior mantiene la referencia individual.
-   Para lecturas anteriores a la actualización 005, la referencia representa el precio aplicado conservado al migrar, por aprobación expresa del usuario; no se puede garantizar que coincida con el precio original del catálogo. La migración no cambia el aplicado ni reemplaza referencias existentes.
-   No se exige preparar revisión para corregir: ausencia de cabecera TD (SIN_FACTURAR) o REVISION permiten añadir y corregir. EMITIDA bloquea ambas hasta reapertura controlada; REABIERTA sin cobros vuelve a permitirlas. Cualquier cobro impide corregir/añadir/reabrir. La API no crea cabeceras ni participaciones; recalcula la existente cuando la hay. Documentos emitidos se actualizan solo mediante reemisión conjunta.

### A.7 Tipos de facturación y estado comercial

-   El MVP implementará únicamente **Tarjeta Dorada (TD)**.
-   El diseño quedará preparado para registrar otros tipos futuros, como
    vacunas o leches, sin construir ahora un motor genérico de
    facturación.
-   En el alcance actual, cada medicamento pertenece a un único tipo de
    facturación.
-   Registrar un nuevo tipo en el futuro no implica que su lógica
    específica quede implementada automáticamente.
-   La situación comercial admite `ALTA` y `BAJA` y es independiente de
    `MEDICAMENTO.estado` y de las autorizaciones específicas.
-   La baja comercial no elimina la autorización. Al registrar, `BAJA` o
    `INACTIVO` impiden aceptar el precinto como facturable; se requiere
    `ACTIVO`, `ALTA` y las autorizaciones aplicables.
-   Pasar después a `BAJA` o `INACTIVO` no invalida los precintos aceptados:
    siguen siendo facturables en su periodo, sin reevaluar los estados actuales.
-   Está aprobada e incorporada a `db/schema.sql` la columna
    `situacion_comercial TEXT NOT NULL`, sin `DEFAULT`, con la restricción
    `ck_medicamento_situacion_comercial` para `ALTA`/`BAJA`.
-   Según la confirmación del autor, se aplicó únicamente a
    `gestion_facturacion_medicamentos_test`, donde `medicamento` tenía cero
    filas. No se aplicó a desarrollo ni se afirma que otras instalaciones
    estén migradas. Sigue pendiente cualquier migración de bases con datos
    sin clasificar: no inferir la situación de `estado` ni asignarla automáticamente.

### A.7.1 Alcance confirmado del catálogo de Medicamentos

-   El catálogo permite crear, listar, consultar y editar medicamentos,
    incluidos los cambios de `estado` (`ACTIVO`/`INACTIVO`) y
    `situacion_comercial` (`ALTA`/`BAJA`).
-   No ofrece borrado físico, incluso para medicamentos sin referencias;
    se conservan los registros y la información histórica existente. Esto no
    introduce un histórico de versiones de cada modificación del catálogo.
-   La gestión de autorizaciones específicas mediante
    `AYUNTAMIENTO_MEDICAMENTO` queda fuera de este catálogo y se definirá
    aparte. Su ubicación y operaciones siguen pendientes; la comprobación
    de esas autorizaciones al registrar precintos se mantiene.
-   El contrato API del catálogo está decidido y documentado en
    `docs/specs/medicamentos/spec.md` y en las especificaciones de su
    interfaz. Permanecen abiertas para la interfaz la presentación de
    `anexo` y `TD`; también siguen pendientes la clasificación de lecturas
    rechazadas por `BAJA`. La decisión vigente de A.14 mantiene elección
    explícita aceptar/apartar sin marca histórica BAJA en el MVP;
    evidencia adicional como mejora futura, sin bloquear implementación.

### A.8 Totales informados y calculados

La farmacia puede facilitar como referencia:

-   número de precintos informado;
-   importe total informado.

La aplicación calcula de forma independiente:

-   precintos registrados;
-   precintos facturables;
-   incidencias;
-   importe registrado;
-   importe facturable.

Las diferencias son informativas y no bloquean automáticamente el
proceso. No debe suponerse que el recuento o importe facilitado por la
farmacia es necesariamente correcto.

### A.9 Farmacias sin precintos

-   Una farmacia puede pertenecer al ayuntamiento y no presentar
    precintos en un periodo.
-   Durante la introducción no es necesario marcar previamente cada
    farmacia como "sin facturación".
-   Cuando el usuario decide preparar/cerrar la facturación del
    ayuntamiento, la aplicación debe identificar las farmacias asociadas
    que no tienen precintos registrados.
-   Debe mostrarse un aviso antes de continuar.
-   La existencia de farmacias sin precintos **no bloquea** la
    facturación; el usuario puede confirmar que desea continuar.
-   Esto permite distinguir una farmacia perteneciente al ayuntamiento
    pero sin actividad en el periodo de una farmacia inexistente o no
    asociada.

### A.10 Facturación, números y cierre

-   La facturación puede calcularse y recalcularse tantas veces como sea
    necesario mientras permanezca editable.
-   El usuario puede corregir precintos y precios antes del cierre.
-   Contabilidad proporciona dos números oficiales distintos:
    -   número de factura de precintos;
    -   número de factura de gastos/comisión.
-   Los números se almacenarán como texto; no se generarán
    automáticamente.
-   Formatos aproximados observados: `NNNNN-A` para precintos y
    `GEN-NNNNNNNN` para gastos. No deben imponerse reglas rígidas de
    formato sin necesidad.
-   La facturación **no puede cerrarse si falta alguno de los dos
    números**.
-   Las dos facturas se cierran conjuntamente: o se cierran las dos o no
    se cierra ninguna.
-   El cierre conjunto no significa que sus cobros sean conjuntos.

### A.11 Cobros independientes

Después del cierre, cada factura mantiene su propio estado de cobro:

-   factura de precintos: pendiente o cobrada;
-   factura de gastos/comisión: pendiente o cobrada.

El ayuntamiento puede pagar una antes que la otra.

Para el MVP se trabajará con pago completo/pendiente. Los pagos
parciales no forman parte del flujo principal.

La factura principal es cobrada por el Colegio y posteriormente el
Colegio distribuye a las farmacias los importes que les corresponden.
Para el MVP:

-   se conserva el desglose económico por farmacia;
-   se registra la fecha de cobro de la factura principal;
-   se registra la fecha general en que la administración del Colegio
    realiza la distribución a las farmacias;
-   no se necesita registrar individualmente cada transferencia bancaria
    a cada farmacia;
-   el ERP gestiona el resto del proceso contable.

Para la factura de gastos/comisión basta con registrar cuándo la paga el
ayuntamiento; el resto del proceso se gestiona en el ERP.

### A.12 Fecha oficial de factura

-   La fecha oficial de factura corresponde al último día del periodo
    facturado.
-   Las dos facturas comparten esa fecha oficial.
-   Ejemplo: periodo septiembre de 2026 → fecha oficial `30/09/2026`.
-   Las fechas técnicas de creación/modificación son distintas y no
    sustituyen a la fecha oficial.

### A.13 Reapertura y corrección de una facturación cerrada

-   Puede ocurrir que una facturación cerrada esté mal realizada y
    necesite corregirse.
-   Lo habitual es detectar el problema **antes de que el ayuntamiento
    haya pagado**.
-   La aplicación permitirá reabrir de forma controlada la facturación
    completa.
-   Al reabrir sin cobros, pueden añadirse lecturas y corregirse precios individuales. La apertura por sí sola no modifica lecturas ni documentos oficiales.
-   Se recalculan los importes y posteriormente se vuelven a cerrar las
    dos facturas conjuntamente.
-   Regla vigente de facturación municipal §14: al reabrir/reemitir se conservan los números oficiales de ambas facturas, sus IDs, los porcentajes/configuración históricos y B. No se permiten números diferentes ni nueva participación/versionado en este flujo. La fecha y el motivo de reapertura se registran; cualquier cobro de cualquiera de las dos facturas impide la reapertura.
-   La reapertura no crea automáticamente una segunda facturación del
    mismo ayuntamiento, periodo y tipo.
-   La aplicación debe conservar trazabilidad suficiente de la
    reapertura/corrección; no se debe hacer desaparecer sin rastro
    información financiera relevante. Se conservan referencia/aplicado, registro de fecha/motivo de reapertura, B y números/IDs/tasas de ambas facturas. Esto no implica un historial de cada valor intermedio del precio: no se guarda en el MVP un registro de autor, fecha o motivo de cada corrección individual.
-   El tratamiento de una rectificación **después del cobro** queda
    fuera del flujo principal del MVP y se considera un punto
    excepcional pendiente.

## B. Ajustes respecto a hipótesis anteriores de la guía

Las siguientes hipótesis de la versión 2 quedan sustituidas:

1.  No es obligatorio que todas las farmacias del ayuntamiento presenten
    precintos para poder facturar.
2.  No se almacenará un mes original por cada precinto recibido con
    retraso, porque ese dato no puede conocerse físicamente.
3.  No se necesita un sistema de pagos parciales para el MVP.
4.  No se necesita registrar cada transferencia individual realizada a
    cada farmacia.
5.  No se necesita un flujo de resolución/reincorporación de incidencias
    dentro del MVP.
6.  "Terminar una farmacia" no la bloquea; el usuario puede volver a
    ella mientras la facturación sea editable.
7.  Una facturación cerrada no es absolutamente inmutable: puede
    reabrirse de forma controlada únicamente si ninguna de sus dos facturas tiene cobros.
8.  `total_recetas` y `total_precintos` no representan magnitudes
    independientes en este proyecto: **1 precinto = 1 receta**.
9.  La cantidad de cada lectura no se utiliza para introducir varias
    unidades de golpe: cada escaneo registra una unidad.
10. El estado de participación mensual de una farmacia no debe
    confundirse con un estado general de activa/inactiva.

### A.14 Decisiones aprobadas para Entregas y precintos — 8 de octubre de 2026

Esta sección y `docs/specs/entregas-precintos/spec.md` sustituyen, exclusivamente para Entregas y precintos, las afirmaciones incompatibles anteriores de A.2–A.8 y sus pruebas derivadas. La aprobación define el modelo objetivo; no significa que `db/schema.sql` ni las bases instaladas estén adaptadas.

- Existe una entrega lógica por `(farmacia_id, periodo_id)`. El usuario selecciona periodo y farmacia; el sistema obtiene y muestra el Ayuntamiento asociado, sin exigir seleccionarlo previamente. El servidor valida la asociación municipal vigente conforme al protocolo existente; farmacia sin asignación no registra. La fecha física de llegada no determina el periodo: bolsas de septiembre leídas en octubre se imputan a septiembre. Al crear se copian `farmacia.denominacion` y `farmacia.cif_nif` a `denominacion_farmacia` y `cif_nif_farmacia`, snapshots `TEXT NOT NULL`; no se sustituyen al continuar ni al editar Farmacia. Cantidad e importe declarados se conservan y pueden corregirse mientras la facturación esté editable. PERIODO no tiene estado propio de apertura/cierre. Salir de lectura no cierra facturación.
- Se admite código de barras de 13 dígitos con prefijo `847000`; se extrae el código nacional de posiciones 7–12 (1-based). Manualmente se acepta código de seis dígitos. Se conserva como texto y se guarda la entrada original; formato distinto requiere revisión, no extracción arbitraria. Validar dígito EAN-13 no está aprobado. Cada lectura es un precinto y códigos repetidos son lecturas independientes.
- Guardado inmediato tras admisión o incidencia confirmada; en éxito actualizar totales/lista, limpiar y enfocar entrada. En error conservar entrada y no reintentar automáticamente. Idempotencia y reconciliación backend implementadas según spec §17; evento del lector y escaneos durante guardado requieren concreción; la falta de respuesta no prueba que no se guardó.
- `GENERAL` usa autorización general y conserva sin aplicar asociaciones específicas. `ESPECIFICA` requiere autorización general y pertenencia específica; lista vacía no equivale a GENERAL. MVP `TD`. Desconocido, no autorizado e `INACTIVO` son incidencias; `INACTIVO` nunca se admite en ALTA/BAJA y no borra historial. `ACTIVO` autorizado `ALTA` se admite; `ACTIVO` autorizado `BAJA` exige decisión aceptar/apartar. Aceptar BAJA no omite autorizaciones. Cambios posteriores no invalidan admisiones ya registradas.
- Cada lectura admitida toma el precio maestro vigente y conserva referencia/aplicado. Cambios futuros del maestro no reescriben lecturas; corrección individual no cambia el maestro ni futuras lecturas. Decisión vigente v26: SIN_FACTURAR/REVISION/REABIERTA sin cobros permiten añadir/corregir, sin preparar revisión; EMITIDA o cualquier cobro bloquean. Nueva admisión queda al final y la tabla se desplaza/resalta para comprobar su precio; totales exactos se actualizan después de lectura/corrección. Sustituye la regla agrupada anterior del mismo día. Contrato en Entregas; migración 005 y reglas B/números/reemisión intactas. Importación, automatización y motor de precios siguen fuera de alcance.
- Las incidencias pertenecen directamente a la entrega, se apartan físicamente, están fuera de paquetes y carecen de precio facturable. Motivos aprobados: `MEDICAMENTO_DESCONOCIDO`, `MEDICAMENTO_NO_AUTORIZADO`, `MEDICAMENTO_INACTIVO`, `BAJA_COMERCIAL_RECHAZADA_USUARIO`. Confirmar aviso no autoriza. No hay resolución/reincorporación.
- Los paquetes solo contienen admitidos, máximo 15. Se representan con `numero_paquete`/`posicion_paquete`, sin tabla ni contador histórico. Posición 1..cantidad actual. Guardar el precinto 15 completa el paquete, sin crear otro vacío. El siguiente precinto admitido materializa el siguiente automáticamente si el último está completo, o por decisión expresa si está incompleto. Su número es el mayor existente + 1 (o 1 si no hay); solo se materializa al guardar el admitido. Las incidencias no crean paquetes ni se rellenan paquetes anteriores.
- Borrar entrada errónea físicamente mientras editable; recalcular, renumerar solo posiciones del paquete afectado conservando IDs; los otros paquetes permanecen intactos y el vacío desaparece. El siguiente número depende del máximo conservado. Precinto real rechazado permanece como incidencia. EMITIDA requiere reapertura controlada sin ningún cobro. En pantalla, papelera compacta dentro de Precio aplicado elimina únicamente el apto seleccionado tras confirmar código nacional/paquete/posición/precio; refresca totales/tabla sin perder contexto. Incidencias no tienen esta acción visual.
- Resumen: declarados, admitidos, subtotal de precios aplicados, incidencias, total registrado, paquete/avance y diferencias. Total registrado = admitidos + incidencias; diferencia de cantidad = registrados − declarados; diferencia importe = subtotal − declarado. Diferencias informativas; incidencias no reciben importes ficticios.
- Requisitos de interfaz y aceptación están en `docs/specs/entregas-precintos/spec.md` §10. BAJA elegible mantiene elección explícita aceptar/apartar, sin marca histórica adicional en el MVP; esa evidencia es mejora futura y no bloquea implementación. Evento lector, escaneos concurrentes y dígito de control EAN-13 siguen pendientes. Reconciliación backend por clave implementada según spec §17.
- Actualización de esquema realizada el 8 de octubre de 2026: `db/schema.sql` contiene snapshots históricos `TEXT NOT NULL` y los cuatro motivos. El script incremental 002 se aplicó a las bases local y dedicada de pruebas; ambas se verificaron mediante `current_database()` y tenían cero entregas antes y después. Para cualquier otra instalación hay que verificar destino y contenido antes de aplicar; no recrear base. Los fixtures de pruebas existentes fueron adaptados.
- API de creación/recuperación implementada: POST/GET `/entregas` reciben farmacia y periodo, derivan Ayuntamiento bajo bloqueo y conservan snapshots capturados al crear. Contrato en spec §14 y pruebas en tasks; declarados y nuevas lecturas aplican ausencia provisional de facturación (§15–§17). Guardado, paquetes y GET operación implementados con esquema 003, verificado en local/pruebas. Consultas, totales y eliminación backend implementados en §18; 004 conserva claves retiradas sin contenido según aprobación expresa. Selección visual, lector e interfaz pendientes.

## C. Consolidación funcional — 1 de octubre de 2026

Esta sección sustituye, cuando exista contradicción, a los puntos pendientes de la versión 3. Cierra la especificación funcional básica antes de iniciar el modelo conceptual de datos.

### C.1 Datos informados por la farmacia
La farmacia facilita, junto con los precintos del periodo, el número total de precintos y el importe total que declara. El usuario dispone de ambos datos al iniciar el registro. Se conservan como referencia informativa y se comparan con los totales calculados por la aplicación; las diferencias no bloquean automáticamente la facturación.

### C.2 Farmacia, SOE y cambio de titular
El SOE identifica de forma estable al establecimiento farmacéutico. Si cambia el titular, el SOE se mantiene, pero pueden cambiar CIF/NIF, denominación y otros datos actuales. Los datos se actualizan cuando se comunica el cambio; el proceso actual no exige registrar una fecha jurídica efectiva. Para el MVP no se requiere una entidad compleja de histórico de titulares: las facturaciones cerradas conservarán la fotografía histórica necesaria para no alterar el pasado.

### C.3 Campos del medicamento
- `grupoTerapeutico`: grupo terapéutico; opcional.
- `codigoLaboratorio`: código del laboratorio cuando se conoce; opcional.
- `GTATC`: código ATC.
- `nombreGrupo`: nombre del grupo asociado al código ATC.
- `anexo`: dato opcional utilizado actualmente para información y filtrado.

La gestión estructurada de nuevos convenios y sus anexos queda fuera del MVP y se estudiará como posible evolución. La ausencia de campos opcionales no impide por sí sola que un medicamento autorizado sea facturable.

### C.4 Cuenta bancaria de la farmacia
Cada farmacia dispone de una única cuenta bancaria vigente para recibir transferencias y puede actualizarla. La cuenta se utiliza para preparar la información enviada a Contabilidad; la aplicación no ejecuta transferencias.

Como criterio habitual, al preparar un pago se utiliza la cuenta vigente en ese momento, aunque sea distinta de la existente al facturar. Este criterio queda **PENDIENTE DE VALIDACIÓN** para posibles excepciones.

### C.5 Comisión e IVA
Administración implementada v23: Inicio y Facturación municipal → Comisión e IVA. Tabla existente configuracion_facturacion con vigencias inclusivas; sin otros conceptos de gastos ni tasas automáticas. Lista, alta y corrección sin solapamientos, escritura coordinada con emisión. Una configuración utilizada conserva tasas/inicio; ajustar fin no puede excluir fechas emitidas. Facturas conservan importes y porcentajes históricos. Contratos en docs/specs/configuracion-facturacion/ e interfaz-configuracion-facturacion/.

La comisión se mantiene actualmente en el `2,7 %` del importe facturable de precintos. El IVA no quedará fijado permanentemente en el código: se aplicará el tipo general vigente y se conservará en cada facturación el porcentaje efectivamente aplicado. La fecha oficial de factura —último día del periodo facturado— será la referencia funcional para determinar el tipo vigente, salvo que durante la implementación se detecte una exigencia normativa distinta.

### C.6 Relación con Contabilidad y numeración
No se registrará una fecha específica de comunicación de los números de factura porque esa gestión queda en el ERP. El usuario introducirá los dos números proporcionados por Contabilidad —factura de precintos y factura de comisión— y ambos serán obligatorios para cerrar la facturación.

### C.7 Informe rápido de deuda
El sistema permitirá seleccionar un ayuntamiento y consultar rápidamente los periodos pendientes. No se requiere inicialmente detalle por farmacia. El listado diferenciará ambas facturas y, como mínimo, periodo, número, importe y estado de cobro de cada una.

### C.8 Informe anual operativo de precintos
El usuario seleccionará un año completo, de enero a diciembre. El informe asignará cada precinto al trimestre correspondiente a su periodo facturado, con independencia de las fechas de cobro municipal y de pago a farmacias. Utilizará exclusivamente importes de precintos aptos calculados con el precio aplicado en cada precinto; COMISION queda excluida. La salida se organizará por ayuntamiento y farmacia, con subtotal trimestral y total anual; puede mostrar el detalle mensual dentro de cada trimestre y exportarse a Excel (`.xlsx`). Es un informe operativo del proyecto, no una declaración ni un informe fiscal.

### C.9 Reapertura y cobro
Una facturación cerrada podrá reabrirse únicamente mientras ninguna de sus dos facturas haya sido cobrada. Una factura cobrada no se modifica. Como la reapertura afecta al conjunto, el cobro de cualquiera de las dos bloquea la reapertura completa. Los cobros siguen siendo independientes: cobrar una factura no marca automáticamente la otra como cobrada.

### C.10 Documentos PDF de facturación
Actualización implementada v22: documentos-facturacion/spec e interfaz-documentos-facturacion/spec prevalecen sobre el alcance anterior de este apartado. Cuatro documentos HTML imprimibles (guardar PDF con navegador): facturas PRECINTOS y GASTOS/COMISIÓN individuales o juntas con salto entre ellas; resumen global por farmacia B sin detalle de lecturas; gastos globales sin reparto por farmacia. Solo EMITIDA; totales municipales arriba, importes emitidos guardados, sin registrar cobros al imprimir.

Por cada ayuntamiento, mes y año, una facturación cerrada podrá producir:
1. factura de precintos en PDF individual;
2. factura de comisión del `2,7 %` más IVA en PDF individual;
3. opcionalmente, un PDF conjunto con ambas facturas, solo si pertenecen al mismo ayuntamiento y periodo; unirlas documentalmente no las convierte en una única factura;
4. relación de precintos en un PDF independiente.

La relación de precintos incluirá únicamente las farmacias del ayuntamiento que hayan presentado precintos facturados en ese periodo. Se agrupará por farmacia y mostrará al menos ayuntamiento, mes/año, farmacia, número total de precintos, importe total y detalle de cada precinto con código nacional y PVP histórico utilizado. Tendrá paginación cuando sea necesaria.

### C.11 Configuración corporativa de los PDF
Actualización aprobada v22: logo y datos del emisor actuales también en reimpresiones. Presidente del Colegio emisor capturado históricamente al emitir, conservado tras reemisión; no corresponde al alcalde municipal. Configuración documental única editable desde la aplicación, PNG/JPEG máximo 1 MiB y 4096 píxeles por eje, almacenado en PostgreSQL; sin rutas arbitrarias ni dependencias. Imagen de firma fuera de este bloque. El texto siguiente conserva el planteamiento anterior, sustituido por esta decisión.

Los elementos variables no quedarán codificados en la plantilla. Como mínimo serán configurables el logotipo corporativo, el nombre del presidente, la imagen de su firma y la opción de mostrar u ocultar dicha imagen. Los cambios se aplicarán a documentos nuevos y no deben alterar documentación histórica cerrada. Durante la implementación se revisará si otros datos de encabezado o pie deben ser configurables.

### C.12 Cobro de precintos y fecha de pago a farmacias
Cuando el ayuntamiento abona la factura de precintos, Contabilidad remite un justificante y el usuario registra la fecha de abono. El sistema propondrá como fecha de pago a farmacias el siguiente día hábil; será una sugerencia que el usuario deberá confirmar y podrá modificar.

Para el MVP, el siguiente día hábil puede considerar inicialmente lunes a viernes. La gestión completa de festivos queda como mejora futura salvo necesidad posterior. `fecha_abono_ayuntamiento` y `fecha_pago_farmacias` serán datos independientes.

### C.13 Excel de pagos a farmacias para Contabilidad
Tras registrar el cobro de la factura de precintos, la aplicación permitirá generar un Excel con la información necesaria para las transferencias a las farmacias participantes. Incluirá como mínimo:
- `SOE`;
- `TITULAR`;
- `CUENTA DESTINO`;
- `IMPORTE`;
- `TIPO TRANSFERENCIA`;
- `CONCEPTO`.

Para el MVP, `TIPO TRANSFERENCIA` será `SEPA`. El `CONCEPTO` se generará automáticamente mediante una regla uniforme basada en ayuntamiento, mes y año. El fichero incluirá el total de importes y la suma destinada a las farmacias deberá cuadrar con el importe de precintos correspondiente antes de considerarlo válido para Contabilidad. La aplicación prepara la información, pero no ejecuta las transferencias.

### C.14 Cuestiones abiertas que no bloquean el diseño conceptual
1. **Cuenta destino en casos excepcionales:** validar cuándo no debe utilizarse la cuenta bancaria vigente al preparar el pago.
2. **Estados:** facturación usa REVISION, EMITIDA y REABIERTA según spec de facturación municipal §13; definir el futuro flujo de emisión/cobros.
3. **Entregas físicas:** confirmar si puede haber varias entregas físicas de una farmacia en el mismo periodo o una única entrega lógica ampliable.
4. **Usuarios y permisos:** definir autenticación y roles mínimos del MVP.
6. **Maquetación final:** concretar detalles visuales exactos de PDF y Excel durante su implementación.

Estas cuestiones no impiden iniciar el modelo conceptual de datos.

## D. Pruebas derivadas de las decisiones confirmadas
Además de las ya definidas en la versión anterior, deberán contemplarse pruebas para comprobar que:
- la lectura 16 crea automáticamente el paquete 2;
- códigos nacionales iguales generan lecturas independientes;
- un medicamento no autorizado genera incidencia y no incrementa el importe facturable;
- no se puede cerrar si falta uno de los dos números de factura;
- las dos facturas se cierran conjuntamente y sus cobros son independientes;
- no se puede reabrir si cualquiera de las dos facturas está cobrada;
- el IVA aplicado queda conservado históricamente;
- el informe anual asigna los importes al trimestre del periodo facturado, con independencia de cobros y pagos, suma precios aplicados de precintos aptos, excluye COMISION y hace cuadrar subtotales trimestrales con el total anual por farmacia;
- solo pueden unirse en un PDF las dos facturas del mismo ayuntamiento y periodo;
- la relación PDF contiene únicamente farmacias con precintos facturados y utiliza los PVP históricos;
- al registrar un abono se propone el siguiente día hábil y el usuario puede modificarlo;
- el Excel de pagos contiene SOE, titular, cuenta destino, importe, SEPA y concepto automático;
- la suma de importes del Excel cuadra con el importe de precintos correspondiente.

## E. Nota para la memoria y defensa del TFM
Esta consolidación permite documentar como **requisitos funcionales** la generación de PDF, relación de precintos, exportaciones Excel, informe de deuda, informe anual operativo de precintos y preparación de pagos; como **reglas de negocio** el cierre conjunto, cobros independientes, bloqueo de reapertura tras el cobro y propuesta de fecha de pago; y como **decisiones arquitectónicas** la conservación histórica, separación respecto al ERP/Contabilidad y configuración corporativa.

También aporta casos claros para justificar **trazabilidad**, **integridad financiera**, **mantenibilidad**, protección de datos bancarios y pruebas automatizadas. Quedan como mejoras o validaciones futuras la gestión estructurada de convenios/anexos, calendario completo de festivos, nuevos formatos bancarios y excepciones de cuenta destino.

## F. Línea base funcional del MVP
Con fecha **1 de octubre de 2026**, las especificaciones funcionales básicas se consideran suficientemente consolidadas para iniciar el **modelo conceptual de datos**.

A partir de este punto no se ampliarán requisitos generales de forma preventiva. Las nuevas dudas se resolverán cuando afecten a una entidad, relación, regla de negocio, caso de uso o implementación concreta.

## Historial de cambios

- **v26 — 12 de octubre de 2026, revisión documental:** corrección individual de un precinto sin preparar revisión; SIN_FACTURAR/REVISION/REABIERTA sin cobros permiten añadir/corregir y EMITIDA/cobros bloquean. Nueva última fila visible/resaltada y total actualizado. Sustituye agrupación y bloqueo por mera cabecera. Referencia histórica de 005 = aplicado conservado al migrar, sin garantía de catálogo original; referencia inmutable al corregir. Documentos cambian solo al reemitir; se aclara el límite de auditoría de correcciones. Versiones anteriores conservadas como antecedentes, sin atribuirles retroactivamente esta decisión.

- **v21 — 11 de octubre de 2026:** interfaz de cobros municipales con consulta por referencia conocida y acceso desde emisión/Inicio, tarjetas independientes PRECINTOS/COMISIÓN, formulario dedicado con importe completo fijo, fecha/justificante y aviso explícito de bloqueo de reapertura. Facturas cobradas sin segundo registro; errores/concurrencia requieren consulta y recuperación antes de repetir. API existente, sin backend/esquema/dependencias. Contrato/evidencia en interfaz-cobros-municipales; pagos y acción visual de reapertura pendientes.

- **v20 — 11 de octubre de 2026:** interfaz de revisión/emisión municipal en tres pasos, selección de Ayuntamiento/periodo, participaciones y corrección B, previsualización exacta del servidor, números oficiales textuales y confirmación conjunta. Recuperación por consulta ante emisión/B inciertos, advertencia sin aptos y B/números originales conservados en revisión ya reabierta. Usa contratos existentes sin cambios backend/esquema; cobros, pagos y reapertura visual pendientes. Especificación/evidencia en interfaz-facturacion-municipal.

- **v19 — 11 de octubre de 2026:** pantalla del informe anual y exportación directa a Excel XML implementadas (facturación municipal §18, interfaz-informe-anual). Conserva Ver informe; exportar usa filtros actuales sin consulta previa. Hoja resumen por Ayuntamiento/farmacia, una fila por farmacia con SOE/denominación/CIF B históricos, T1–T4 y anual, subtotales/total; varios B se conservan alineados en las celdas sin duplicar importes. Mensual opcional y advertencia de reaperturas. Mismo cálculo/snapshot de §17 y primitivas SpreadsheetML de liquidación, sin dependencias ni cambios SQL. El formato XML solicitado sustituye .xlsx previsto en la guía para esta salida.

- **v18 — 11 de octubre de 2026:** consulta backend del informe anual operativo implementada (spec §17). Año/trimestre exclusivamente por periodo facturado; precios aplicados de precintos de participaciones emitidas una vez, sin COMISION, cobros/pagos/declarados ni catálogo actual. Agrupación por Ayuntamiento/farmacia, identidades B históricas, subtotales trimestrales, total anual y detalle mensual opcional, con NUMERIC/céntimos BigInt exactos. Criterio aprobado: excluir temporalmente REABIERTA y advertir hasta reemitir. Sin interfaz, exportación, esquema ni dependencias nuevas; informe operativo sin alcance fiscal.

- **v17 — 11 de octubre de 2026:** preparación y confirmación de liquidación a farmacias implementadas (spec §16). Requiere cobro completo PRECINTOS; propuesta C/cuenta sin persistencia, con fecha sugerida del siguiente lunes–viernes. Confirmación atómica del pago completo de todas las participaciones, sin duplicados, conservando C/cuenta corregidos y fecha elegida. Consulta y Excel XML 2003 aprobado para Contabilidad desde snapshots, total que cuadra con PRECINTOS, SEPA y concepto uniforme. Controles bancarios validados antes de confirmar/exportar. Sin nuevas dependencias, esquema, transferencias ni interfaz.

- **v16 — 11 de octubre de 2026:** registro de cobros municipales implementado en backend (spec §15). PRECINTOS/COMISION independientes, un cobro completo por factura, comparación NUMERIC exacta y referencia bancaria opcional. Cobro y reapertura comparten transacción y bloqueos municipales/de cabecera: el primero confirmado impide la operación incompatible. Consulta recupera cobros en snapshot consistente. Sin cambios SQL, pagos ni interfaz financiera.

- **v15 — 11 de octubre de 2026:** emisión conjunta PRECINTOS/COMISION y actualización correctiva implementadas en backend (facturación municipal spec §14). Números oficiales de Contabilidad con UNIQUE por serie; NUMERIC/HALF_UP en secuencia comisión → IVA sobre comisión redondeada → total. Primera emisión usa configuración única vigente por fecha y congela B confirmado; reapertura sin cobros conserva B, números, IDs y porcentajes históricos. Par/estado/recálculos atómicos, incluso ante conflictos tardíos. Consulta recupera documentos emitidos. Sin cambios de esquema, cobros, pagos ni interfaz financiera.

- **v14 — 11 de octubre de 2026:** cálculo/revisión persistidos de participaciones y reapertura correctiva implementados en backend. NUMERIC exacto por cada fila PRECINTO, sin incidencias/declarados ni reevaluación del catálogo; ausencia de aptos advierte sin nuevas participaciones/facturas. REVISION permite corregir entregas/B; EMITIDA bloquea; REABIERTA solo sin cobros, con fecha/motivo y B congelado. Estado añadido directamente a las bases locales verificadas, sin migración versionada ni borrado de datos. Sustituye el bloqueo provisional por existencia de FACTURACION. API y límites en `docs/specs/facturacion-municipal/spec.md` §13; emisión, ajuste de documentos tras reapertura, cobros, pagos e interfaz financiera siguen pendientes.

- **v13 — 8 de octubre de 2026:** consultas de lecturas/resumen y eliminación backend implementadas (spec §18). Totales históricos exactos y renumeración local conservando IDs. Política de clave retirada aprobada expresamente: conservar únicamente entrega/clave/marcador sin contenido para rechazar repetición tardía, sustituyendo la propuesta inicial de liberación por cascada. 004 aplicada y verificada en desarrollo/pruebas locales. Interfaz, lector, precios y módulo financiero pendientes.

- **v12 — 8 de octubre de 2026:** guardado backend de precintos/incidencias confirmadas, decisión BAJA, paquetes automáticos/expresos y reconciliación por clave de operación persistente implementados (spec §17). Actualización 003 aplicada y verificada en las bases locales desarrollo/pruebas, sin claves inventadas para registros previos. Transacción y protocolo municipal compartidos; eliminación, totales, lector/interfaz y módulo financiero pendientes.

- **v11 — 8 de octubre de 2026:** incorpora el alcance aprobado de Entregas y precintos en A.14 y sus especificaciones. Sustituye para este módulo reglas anteriores sobre paquetes, BAJA/INACTIVO, incidencias, correcciones y snapshots. El modelo objetivo todavía no está aplicado a `db/schema.sql`; actualización incremental pendiente, previa comprobación de cada base y revisión de fixtures. No se ejecutó SQL ni se implementó código.

- **v10 — 6 de octubre de 2026:** registra la implementación de POST/DELETE municipales de Farmacias, origen esperado obligatorio en POST y control atómico de actividad. Las pruebas con PostgreSQL verifican las esperas entre mutaciones y entregas y el límite de la FK sola; el futuro módulo de entregas debe bloquear y validar antes de insertar. No se modifica el modelo ni el esquema; búsquedas e interfaz continúan pendientes.
- **v9 — 6 de octubre de 2026:** registra la compatibilidad del esquema y CRUD con farmacias sin Ayuntamiento: FK nullable, actualización SQL no destructiva para instalaciones existentes, consultas con LEFT JOIN y presentación de ausencia de asignación. Mantiene el alta con Ayuntamiento y la exclusión de la asignación en PUT. Actualización y pruebas verificadas solo en la base dedicada de pruebas; la asignación municipal controlada sigue pendiente.
- **v7 — 5 de octubre de 2026:** registra que el contrato API del catálogo de Medicamentos está decidido y documentado en sus especificaciones. Mantiene abiertas la presentación de `anexo` y `TD` en la interfaz, la clasificación de lecturas rechazadas por `BAJA` y la necesidad de evidencia histórica exacta de aceptación.
- **v8 — 6 de octubre de 2026:** actualiza la asignación de Farmacias a cero o un Ayuntamiento, condiciona asignar/reasignar/quitar a ausencia de entregas y precintos, exige validar la pertenencia al Ayuntamiento al registrar y alinea las reglas `GENERAL`/`ESPECIFICA` sin borrar asociaciones. Esta versión distingue el modelo objetivo nullable del esquema actual todavía `NOT NULL`.
- **v6 — 5 de octubre de 2026:** registra la aprobación de `situacion_comercial TEXT NOT NULL`, sin `DEFAULT`, con CHECK para `ALTA`/`BAJA`, incorporada al esquema y aplicada únicamente a la base de pruebas con la tabla vacía, según confirmación del autor. Confirma crear, listar, consultar y editar el catálogo y ambos estados; excluye el borrado físico y la gestión de autorizaciones específicas. El contrato API, la clasificación del rechazo por `BAJA`, la ubicación de autorizaciones y las migraciones con datos sin clasificar siguen pendientes. Sustituye las referencias activas a aprobación SQL pendiente de v5; se conserva esta como antecedente histórico.
- **v5 — 5 de octubre de 2026:** incorpora las decisiones del autor sobre autorización general (`ACTIVO`/`INACTIVO`), situación comercial independiente (`ALTA`/`BAJA`), evaluación al registro, autorización específica y conservación de precintos aceptados en su periodo mensual. «NO ESTÁ» es una incidencia. Corrige expresamente la regla de v4, A.7, que permitía facturar pese a la baja comercial sin distinguir el momento del registro: esa afirmación queda sustituida por las reglas de A.5 y A.7 de v5. No aprueba almacenamiento SQL, contrato API ni operaciones de mantenimiento.






Navegación municipal implementada v24: Inicio → Facturación municipal abre el listado de EMITIDA, ordenado por periodo facturado descendente y denominación municipal alfabética. GET /facturaciones/emitidas es un SELECT de cabeceras y facturas históricas, sin recálculo ni cobros. Ver documentos en cada fila abre las cuatro vistas y la impresión independiente/conjunta. Nueva facturación abre el proceso anterior en facturacion-emision.html; documentos/emisión vuelven al listado. Sin acceso separado de Documentos en Inicio ni entrada manual de IDs. Contrato en interfaz-facturacion-municipal/spec y documentos-facturacion/spec.
