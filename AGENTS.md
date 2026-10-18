# AGENTS.md — Gestión de facturación de medicamentos

> Guía de trabajo para agentes de IA que intervengan en este repositorio.
>
> Este archivo complementa `README.md`.
> Antes de realizar cambios, el agente debe leer las instrucciones aplicables y la documentación relacionada con la tarea.
>
> Las instrucciones explícitas dadas por el usuario en la conversación tienen prioridad sobre este documento.

---

## 1. Objetivo del proyecto

Este repositorio contiene el Proyecto Final de Máster para modernizar una aplicación interna actualmente gestionada mediante Microsoft Access.

La aplicación permitirá gestionar la facturación de medicamentos dispensados por farmacias a distintos ayuntamientos.

El proyecto debe ser:

- funcional;
- sencillo de mantener;
- comprensible por su autor;
- correctamente probado;
- documentado;
- demostrable y defendible académicamente.

No se busca construir una plataforma empresarial sobredimensionada.

Se prioriza un MVP completo, coherente y probado frente a muchas funcionalidades incompletas.

---

## 2. Estado actual

El modelo conceptual y lógico está documentado. Están implementados los mantenimientos, Entregas/precintos, facturación municipal con reapertura visual, cobros/liquidación, documentos, configuración e informe anual, con sus límites recogidos en `README.md` y `docs/specs/`.

El modelo conceptual de datos está documentado en:

`docs/modelo-datos/modelo-datos.md`

El diagrama entidad-relación está en:

`docs/modelo-datos/modelo-entidad-relacion-v2-2026-10-18.png`

Fuente editable DOT y SVG con el mismo nombre base. v2 es una revisión documental del esquema actual, no una migración; v1 se conserva como histórico. Contraste y evolución: `docs/modelo-datos/revision-documental-v2-2026-10-18.md`.

Antes de modificar el modelo de datos, ambos documentos deben ser revisados.

La documentación escrita en `modelo-datos.md` tiene prioridad sobre el diagrama cuando exista alguna diferencia.

---

## 3. Stack previsto

La arquitectura prevista para el MVP utiliza:

- JavaScript.
- Node.js.
- Express.
- PostgreSQL.
- Acceso explícito a PostgreSQL mediante `pg`.
- Zod para validación cuando corresponda.
- Vitest para pruebas.
- Supertest para pruebas de API.
- Git y GitHub para control de versiones.

Inicialmente:

- no introducir TypeScript;
- no introducir ORM;
- no introducir Docker;
- no introducir CI/CD;
- no añadir infraestructura innecesaria.

Estas decisiones podrán revisarse posteriormente, pero no deben cambiarse por iniciativa del agente.

---

## 4. Principios de arquitectura

Priorizar siempre:

1. simplicidad;
2. mantenibilidad;
3. separación clara de responsabilidades;
4. validación de datos;
5. integridad de la información;
6. trazabilidad;
7. código fácil de comprender y explicar.

Evitar sobrearquitectura.

No introducir patrones, capas, abstracciones o dependencias únicamente porque sean habituales en proyectos grandes.

La aplicación se planteará como un monolito modular.

Cuando exista código previo, seguir su estructura y convenciones antes de proponer una reorganización.

---

## 5. Forma obligatoria de trabajar

Antes de realizar un cambio importante:

1. analizar la implementación existente;
2. identificar los archivos afectados;
3. explicar qué se pretende modificar;
4. explicar por qué es necesario;
5. realizar el cambio mínimo que resuelva la tarea.

No realizar cambios masivos sin advertir previamente de su impacto.

No sustituir una implementación existente sin analizarla primero.

No crear archivos, módulos, tablas, campos, endpoints o funciones sin una razón concreta.

Cuando una tarea pueda dividirse en pasos pequeños, trabajar de forma incremental.

### Inicio de un módulo nuevo

Antes de implementar un módulo, consultar `README.md`, `AGENTS.md`, `MEMORY.md`, el modelo conceptual y lógico, `db/schema.sql`, la guía de contexto TFM vigente en `docs/guia-contexto-tfm.md` y las especificaciones de módulos relacionados. Ese archivo es la única guía canónica; su versión y fecha se actualizan dentro del documento, sin crear copias fechadas. Derivar de esas fuentes los campos, tipos, relaciones, reglas y restricciones; no inventarlos.

Crear primero `spec.md`, `plan.md` y `tasks.md` en `docs/specs/<modulo>/`. Si el módulo incluye interfaz, crear además los tres documentos correspondientes en `docs/specs/interfaz-<modulo>/`. Registrar las decisiones abiertas con sus fuentes. Si una contradicción o decisión pendiente impide una parte del alcance, señalarla y detener solo el trabajo que dependa de ella. Iniciar la implementación cuando la especificación y el plan estén disponibles para revisión.

---

## 6. Reglas de negocio y modelo de datos

La fuente principal para el modelo conceptual es:

`docs/modelo-datos/modelo-datos.md`

No inventar entidades, relaciones, campos ni reglas de negocio que contradigan ese documento.

Si una nueva necesidad requiere modificar el modelo:

1. explicar primero el cambio;
2. identificar las entidades afectadas;
3. valorar el impacto sobre datos históricos;
4. obtener aprobación antes de modificar el esquema;
5. actualizar posteriormente la documentación.

Reglas especialmente importantes:

- preservar la trazabilidad de facturación, cobros y pagos;
- no eliminar información financiera histórica necesaria para auditoría o seguimiento;
- diferenciar datos actuales de datos históricos;
- los precintos válidos son la fuente de los importes facturados;
- `PRECINTO.precio_aplicado` conserva el precio utilizado en ese registro;
- la corrección manual afecta únicamente al precinto seleccionado, conserva `precio_referencia` y no cambia el maestro; sin cabecera TD, en `REVISION` o `REABIERTA` se permite si no hay cobros, sin exigir preparar revisión;
- las incidencias no forman parte de los precintos facturables;
- los paquetes no constituyen una entidad propia;
- no duplicar datos calculables salvo que exista una necesidad histórica justificada;
- los datos guardados en `DETALLE_PAGO_FARMACIA` constituyen un snapshot histórico del pago;
- no existen cobros parciales en el MVP;
- una facturación con alguna factura cobrada no puede reabrirse.
- `REVISION` permite corregir entregas y B; `EMITIDA` bloquea ambas; `REABIERTA` permite corregir entregas sin ningún cobro y conserva B congelado. La mera existencia de una cabecera de revisión no cierra las entregas.

---

## 7. Base de datos

La base de datos será PostgreSQL.

Cuando se implemente el esquema:

- utilizar claves primarias explícitas;
- utilizar claves foráneas para proteger relaciones;
- utilizar restricciones `UNIQUE` cuando correspondan;
- utilizar restricciones `CHECK` cuando aporten integridad real;
- evitar depender únicamente de validaciones de la aplicación cuando la base de datos pueda proteger una regla estructural;
- utilizar consultas SQL parametrizadas;
- nunca construir SQL concatenando directamente valores procedentes del usuario.

Las operaciones financieras que necesiten modificar varios registros relacionados deberán valorar el uso de transacciones.

No ejecutar operaciones destructivas sobre datos históricos sin autorización explícita.

No introducir un ORM sin aprobación previa.

---

## 8. API y lógica de negocio

Cuando se implemente la API REST:

- mantener rutas, controladores, servicios y acceso a datos con responsabilidades claras;
- evitar introducir lógica de negocio compleja directamente en las rutas;
- validar los datos recibidos;
- devolver errores comprensibles y consistentes;
- no ocultar errores mediante `catch` vacíos;
- mantener los endpoints pequeños y fáciles de probar.

No crear endpoints que no correspondan a un requisito real del proyecto.

---

## 9. Pruebas

Las pruebas forman parte del proyecto y del aprendizaje.

Herramientas previstas:

- Vitest;
- Supertest para API.

Toda funcionalidad nueva debe valorar qué pruebas necesita.

Distinguir cuando corresponda entre:

- pruebas unitarias;
- pruebas de integración;
- pruebas de API.

Las pruebas deben comprobar comportamiento real del sistema.

Evitar pruebas artificiales que únicamente demuestren que la herramienta de testing funciona.

Siempre que sea posible:

- cada prueba debe ser independiente;
- una prueba no debe depender de que otra se ejecute antes;
- preparar los datos que necesite cada prueba;
- comprobar tanto casos válidos como inválidos;
- no desactivar pruebas para conseguir que la suite pase.

Cuando exista una suite de pruebas, ejecutarla antes de considerar terminada una modificación.

---

## 10. Seguridad y datos

Nunca:

- guardar contraseñas o tokens en el repositorio;
- incluir secretos en código fuente;
- subir archivos `.env` con credenciales;
- utilizar datos personales o financieros reales para el TFM;
- registrar información sensible innecesariamente en logs.

El proyecto utilizará datos ficticios para desarrollo, pruebas y demostración.

Las entradas de usuario deberán validarse.

Las consultas SQL deberán ser parametrizadas.

---

## 11. Git

Trabajar mediante cambios pequeños y comprensibles.

Cuando una funcionalidad tenga entidad suficiente, utilizar una rama específica, por ejemplo:

`feature/ayuntamientos`

`feature/modelo-datos`

`fix/validacion-medicamento`

Antes de realizar un commit:

1. revisar `git status`;
2. revisar `git diff`;
3. ejecutar las pruebas aplicables;
4. comprobar que no existen archivos temporales o secretos;
5. actualizar documentación si el cambio modifica una decisión relevante.

Los mensajes de commit deben describir claramente el cambio.

Ejemplos:

`docs: documentar modelo conceptual de datos`

`feat: añadir mantenimiento de ayuntamientos`

`test: añadir pruebas de validación de medicamentos`

`fix: corregir cálculo de comisión`

No realizar `git push --force` sobre ramas compartidas.

El agente no debe hacer commits ni push salvo que el usuario lo solicite expresamente.

---

## 12. Documentación del TFM

La documentación forma parte del desarrollo.

Cuando una modificación introduzca una decisión importante, valorar si debe quedar documentada como:

- requisito funcional;
- requisito no funcional;
- regla de negocio;
- decisión arquitectónica;
- caso de uso;
- prueba;
- riesgo;
- limitación del MVP;
- mejora futura.

No esperar al final del proyecto para reconstruir las decisiones.

Actualizar la documentación correspondiente cuando cambie el comportamiento real del sistema.

---

## 13. Uso de IA en el proyecto

La IA ayuda a desarrollar el proyecto, pero el autor debe poder comprender y defender el resultado.

Por tanto, el agente debe:

- explicar brevemente los cambios realizados;
- evitar generar grandes cantidades de código sin necesidad;
- utilizar soluciones comprensibles;
- señalar decisiones técnicas relevantes;
- indicar alternativas cuando exista una decisión importante;
- evitar complejidad que no aporte valor al MVP.

Ante un error, no limitarse a aplicar una corrección.

Siempre que sea razonable, indicar:

1. qué está fallando;
2. dónde ocurre;
3. por qué ocurre;
4. cómo comprobarlo;
5. qué se modifica para solucionarlo.

---

## 14. Límites del agente

### Siempre

- Leer primero el código y documentación existentes relacionados con la tarea.
- Seguir los patrones existentes cuando sean razonables.
- Realizar el cambio mínimo necesario.
- Preservar trazabilidad e integridad.
- Explicar brevemente qué se cambió y por qué.
- Ejecutar las pruebas aplicables antes de terminar una implementación.
- Actualizar `MEMORY.md` al terminar cada tarea relevante.

### Solicitar aprobación antes de

- añadir o eliminar dependencias;
- cambiar tecnologías principales;
- modificar el esquema de base de datos;
- crear o modificar contratos importantes de API;
- realizar refactorizaciones grandes;
- reorganizar de forma importante la estructura del repositorio;
- introducir Docker, ORM, TypeScript, CI/CD u otras herramientas no previstas;
- eliminar información histórica.

### Nunca

- inventar requisitos de negocio;
- modificar silenciosamente reglas documentadas;
- eliminar tests para hacer pasar la suite;
- ocultar errores;
- introducir secretos;
- utilizar datos reales del entorno empresarial;
- realizar operaciones Git destructivas;
- añadir complejidad sin justificarla.

---

## 15. Definición de tarea terminada

Una tarea de implementación se considera terminada cuando:

- el comportamiento solicitado está implementado;
- el código es comprensible;
- las validaciones necesarias están aplicadas;
- las pruebas correspondientes pasan;
- no se han roto pruebas existentes;
- se ha revisado el cambio realizado;
- la documentación está actualizada si corresponde;
- el usuario puede explicar qué se ha construido y por qué.

---

## 16. Referencias del repositorio

- Introducción al proyecto: `README.md`
- Guía de contexto TFM vigente y canónica: `docs/guia-contexto-tfm.md`
- Modelo conceptual: `docs/modelo-datos/modelo-datos.md`
- Modelo lógico PostgreSQL: `docs/modelo-datos/modelo-logico-postgresql.md`
- Diagrama ER vigente: `docs/modelo-datos/modelo-entidad-relacion-v2-2026-10-18.png` (fuentes DOT y SVG contiguas; v1 histórico conservado).
- Especificaciones de módulos e interfaces: `docs/specs/`

Este archivo debe mantenerse actualizado a medida que se definan la estructura real del proyecto, los comandos de desarrollo, los scripts de base de datos y la estrategia de pruebas.

## 17. Memoria de trabajo

- Al comenzar una tarea, leer `MEMORY.md` para conocer el estado actual del proyecto, las decisiones recientes y los próximos pasos.
- Al finalizar una tarea relevante, actualizar `MEMORY.md` si ha cambiado el estado del proyecto, se ha tomado una decisión importante o se ha identificado un error que conviene evitar.
- Mantener `MEMORY.md` breve y orientado al estado actual; no duplicar documentación detallada que ya exista en `docs/`.
- Si una decisión se convierte en una regla permanente del proyecto, trasladarla o incorporarla a `AGENTS.md`.
- Si una decisión necesita explicación técnica detallada, documentarla en `docs/` y dejar en `MEMORY.md` solo una referencia breve.
- No guardar nunca secretos, tokens, contraseñas, datos personales ni datos empresariales reales.
