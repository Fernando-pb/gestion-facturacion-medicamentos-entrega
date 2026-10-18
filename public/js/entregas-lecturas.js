import { formatoMonetario, normalizarDecimal, configurarCampoMonetario } from './decimales.js';

// Una petición retenida es también la identidad de cualquier repetición explícita.
export const iniciarLecturas = ({ api, alBloquear = () => {}, alVolver = () => {},
  crearClave = () => globalThis.crypto.randomUUID() }) => {
  const $ = (id) => document.getElementById(id);
  let entrega = null, ocupado = false, solicitud = null, evaluacion = null;
  let incierto = false, repetible = false, nuevoPaquete = false, datosVigentes = false, ocupacionPaquete = null;
  let precintos = [], ultimaId = null;
  let contextoPrecios = null, seleccionPrecio = null, precioIncierto = false;
  let seleccionBorrado = null, borradoIncierto = false;
  const botonesPrecio = [];
  const botonesBorrado = [];
  configurarCampoMonetario($('precio-corregido'));
  const descripciones = new Map();
  const mensaje = (texto, error = false) => {
    $('estado-lectura').textContent = texto;
    $('estado-lectura').className = `operation-message${error ? ' message-error' : ''}`;
    $('estado-lectura').setAttribute('role', error ? 'alert' : 'status');
  };
  const errorTexto = (error) => error.estado === 409 ? `Conflicto: ${error.message}` : error.message;
  const bloquear = () => {
    const pendiente = solicitud !== null;
    const corrigiendo = seleccionPrecio !== null || seleccionBorrado !== null;
    const editable = contextoPrecios?.permite_correccion === true;
    $('codigo-lectura').disabled = ocupado || pendiente || corrigiendo || !datosVigentes || !editable;
    $('evaluar-lectura').disabled = ocupado || pendiente || corrigiendo || !datosVigentes || !editable;
    $('nuevo-paquete-lectura').disabled = ocupado || pendiente || corrigiendo || !datosVigentes || !editable;
    for (const id of ['confirmar-incidencia', 'aceptar-baja', 'apartar-baja', 'cancelar-lectura']) $(id).disabled = ocupado || incierto;
    $('volver-detalle').disabled = ocupado || pendiente || corrigiendo;
    $('reintentar-lecturas').disabled = ocupado || pendiente || corrigiendo;
    $('reconsultar-precios').hidden = ocupado || corrigiendo || (datosVigentes && contextoPrecios?.permite_correccion === true);
    $('reconsultar-precios').disabled = ocupado || pendiente || corrigiendo;
    for (const boton of [...botonesPrecio, ...botonesBorrado]) boton.disabled = ocupado || pendiente || corrigiendo || !datosVigentes || !contextoPrecios?.permite_correccion;
    $('confirmar-eliminar').disabled = ocupado || borradoIncierto || !datosVigentes || !contextoPrecios?.permite_correccion || !$('confirmacion-eliminar').checked;
    $('confirmacion-eliminar').disabled = ocupado || borradoIncierto;
    $('cancelar-eliminar').disabled = ocupado || borradoIncierto;
    $('consultar-eliminacion').hidden = !borradoIncierto;
    $('consultar-eliminacion').disabled = ocupado;
    $('guardar-precio').disabled = ocupado || precioIncierto || !datosVigentes || !contextoPrecios?.permite_correccion || !$('confirmacion-precio').checked;
    $('precio-corregido').disabled = ocupado || precioIncierto;
    $('confirmacion-precio').disabled = ocupado || precioIncierto;
    $('cancelar-precio').disabled = ocupado || precioIncierto;
    $('consultar-precio').hidden = !precioIncierto;
    $('consultar-precio').disabled = ocupado;
    $('consultar-operacion-lectura').hidden = !incierto;
    $('consultar-operacion-lectura').disabled = ocupado;
    $('repetir-operacion-lectura').hidden = !incierto || !repetible;
    $('repetir-operacion-lectura').disabled = ocupado;
    $('lecturas').setAttribute('aria-busy', String(ocupado));
    alBloquear(ocupado || pendiente || corrigiendo);
  };
  const paquete = () => {
    $('nuevo-paquete-lectura').setAttribute('aria-pressed', String(nuevoPaquete));
    const explicacion = nuevoPaquete
      ? 'Se iniciará otro paquete con el próximo precinto apto; el servidor asignará el número y la posición.'
      : 'El servidor asigna paquete y posición y abre otro al completar 15 aptos. Usa esta opción si el paquete actual sigue incompleto y necesitas comenzar otro.';
    let ocupacion = '';
    if (ocupacionPaquete) {
      const { numero_paquete: numero, precintos } = ocupacionPaquete;
      ocupacion = precintos === 15
        ? ` Último paquete completo: ${numero}, 15/15 aptos; el servidor asignará el siguiente al registrar otro apto.`
        : nuevoPaquete
          ? ` Último paquete registrado: ${numero}, ${precintos}/15 aptos.`
          : ` Ocupación del paquete actual: ${numero}, ${precintos}/15 aptos.`;
    }
    $('estado-paquete-lectura').textContent = `${explicacion}${ocupacion}`;
  };
  const mostrarEstadoRegistro = (resumen) => {
    const { admitidos, incidencias, total_registrado: total } = resumen;
    const valido = [admitidos, incidencias, total].every((n) => Number.isInteger(n) && n >= 0)
      && total === admitidos + incidencias;
    if (!valido) {
      $('sin-precintos-lecturas').textContent = 'El servidor no proporcionó datos suficientes para determinar el estado del registro.';
      $('sin-precintos-lecturas').hidden = precintos.length > 0;
      return 'Estado del registro no disponible: conteos incoherentes.';
    }
    if (total === 0) {
      $('sin-precintos-lecturas').textContent = 'Todavía no se ha registrado ningún precinto.';
      $('sin-precintos-lecturas').hidden = false;
      return '';
    }
    if (admitidos === 0 && incidencias > 0) {
      $('sin-precintos-lecturas').textContent = `Se han registrado ${total} precintos y ninguno es apto.`;
      $('sin-precintos-lecturas').hidden = false;
      return '';
    }
    $('sin-precintos-lecturas').hidden = true;
    return '';
  };
  const renderPrecintos = (mostrarUltima = false) => {
    botonesPrecio.length = 0;
    botonesBorrado.length = 0;
    let ultimaFila = null;
    const ordenados = [...precintos].sort((a, b) => a.numero_paquete - b.numero_paquete || a.posicion_paquete - b.posicion_paquete);
    $('precintos-lecturas').replaceChildren(...ordenados.map((p) => {
      const tr = document.createElement('tr');
      tr.setAttribute('role', 'row');
      if (p.id === ultimaId) { ultimaFila = tr; tr.className = 'ultima-lectura'; tr.setAttribute('aria-label', 'Último precinto guardado'); }
      const etiquetas = ['Paquete', 'Posición', 'Código leído', 'Código nacional', 'Precio aplicado (€)'];
      for (const [indice, valor] of [p.numero_paquete, p.posicion_paquete, p.codigo_barras_original, p.codigo_nacional,
        formatoMonetario(p.precio_aplicado)].entries()) {
        const td = document.createElement('td'); td.textContent = valor;
        td.setAttribute('role', 'cell'); td.setAttribute('data-label', etiquetas[indice]); tr.append(td);
      }
      const boton = document.createElement('button');
      boton.type = 'button'; boton.className = 'button button-secondary corregir-precio'; boton.textContent = 'Corregir precio';
      boton.setAttribute('aria-label', `Corregir precio del código ${p.codigo_nacional}, paquete ${p.numero_paquete}, posición ${p.posicion_paquete}`);
      boton.setAttribute('aria-describedby', 'estado-precios');
      boton.addEventListener('click', () => abrirPrecio(p));
      const acciones = document.createElement('div'); acciones.className = 'acciones-precio';
      acciones.append(boton); botonesPrecio.push(boton);
      const eliminar = document.createElement('button'), icono = document.createElement('span');
      eliminar.type = 'button'; eliminar.className = 'button button-secondary eliminar-precinto';
      const nombre = `Eliminar precinto del código ${p.codigo_nacional}, paquete ${p.numero_paquete}, posición ${p.posicion_paquete}, precio ${formatoMonetario(p.precio_aplicado)} euros`;
      eliminar.setAttribute('aria-label', nombre); eliminar.setAttribute('title', nombre);
      eliminar.setAttribute('aria-describedby', 'estado-precios');
      icono.textContent = '🗑'; icono.setAttribute('aria-hidden', 'true'); eliminar.append(icono);
      eliminar.addEventListener('click', () => abrirBorrado(p));
      const celdaAcciones = document.createElement('td');
      celdaAcciones.textContent = ''; celdaAcciones.setAttribute('role', 'cell'); celdaAcciones.setAttribute('data-label', 'Acciones');
      acciones.append(eliminar); celdaAcciones.append(acciones); tr.append(celdaAcciones); botonesBorrado.push(eliminar);
      return tr;
    }));
    if (mostrarUltima && ultimaFila) {
      // Desplazar solo la tabla: conservar el foco del lector y el orden del servidor.
      const contenedor = $('lista-precintos'), fila = ultimaFila.getBoundingClientRect(), region = contenedor.getBoundingClientRect();
      if (fila.bottom > region.bottom) contenedor.scrollTop += fila.bottom - region.bottom;
      else if (fila.top < region.top) contenedor.scrollTop += fila.top - region.top;
      const precio = ultimaFila.children[4].getBoundingClientRect();
      if (precio.right > region.right) contenedor.scrollLeft += precio.right - region.right;
      else if (precio.left < region.left) contenedor.scrollLeft += precio.left - region.left;
    }
    $('descripciones-lecturas').replaceChildren(...ordenados.filter((p) => descripciones.has(p.id)).map((p) => {
      const li = document.createElement('li');
      li.textContent = `Paquete ${p.numero_paquete}, posición ${p.posicion_paquete}, código nacional ${p.codigo_nacional}: ${descripciones.get(p.id)}`;
      return li;
    }));
    bloquear();
    if (precintos.length > 0) $('sin-precintos-lecturas').hidden = true;
  };
  const actualizar = async (mostrarUltima = false) => {
    datosVigentes = false;
    contextoPrecios = null;
    $('estado-precios').textContent = 'Consultando estado de la facturación…';
    ocupacionPaquete = null; paquete();
    $('reintentar-lecturas').hidden = true;
    $('sin-precintos-lecturas').hidden = true;
    $('estado-totales-lecturas').textContent = 'Cargando totales, precintos e incidencias del servidor…';
    try {
      const resultados = await Promise.allSettled([
        api.consultarResumen(entrega.id), api.consultarPrecintos(entrega.id), api.consultarIncidencias(entrega.id), api.consultarContextoPrecios(entrega.id),
      ]);
      const fallido = resultados.find((r) => r.status === 'rejected');
      const [rResumen, rPrecintos, rIncidencias] = resultados;
      if (resultados[3].status === 'fulfilled') {
        contextoPrecios = resultados[3].value;
        $('estado-precios').textContent = contextoPrecios.permite_correccion
          ? contextoPrecios.facturacion_id === null
            ? 'Entrega sin facturar. Puedes añadir lecturas y corregir el precio de cada precinto sin preparar una revisión.'
            : `Facturación ${contextoPrecios.estado === 'REABIERTA' ? 'reabierta' : 'en revisión'} sin cobros. Puedes añadir lecturas y corregir cada precinto individualmente.`
          : contextoPrecios.motivo_bloqueo;
      } else $('estado-precios').textContent = `No se pudo comprobar el estado de la facturación. ${errorTexto(resultados[3].reason)} Comprueba el estado antes de corregir precios.`;
      const resumen = rResumen.status === 'fulfilled' ? rResumen.value : null;
      const lista = rPrecintos.status === 'fulfilled' ? rPrecintos.value : null;
      const incidencias = rIncidencias.status === 'fulfilled' ? rIncidencias.value : null;
      if (resumen) {
      $('aptos-lecturas').textContent = resumen.admitidos;
      $('importe-lecturas').textContent = `${formatoMonetario(resumen.subtotal_facturable)} €`;
      const paquetes = resumen.paquetes;
      const ultimo = Array.isArray(paquetes) ? paquetes.at(-1) : null;
      ocupacionPaquete = ultimo && Number.isInteger(ultimo.numero_paquete) && ultimo.numero_paquete > 0
        && Number.isInteger(ultimo.precintos) && ultimo.precintos > 0 && ultimo.precintos <= 15
        ? { numero_paquete: ultimo.numero_paquete, precintos: ultimo.precintos } : null;
      paquete();
      const controles = [['Incidencias', resumen.incidencias], ['Total registrado', resumen.total_registrado],
        ['Diferencia de cantidad', resumen.diferencia_cantidad], ['Diferencia de importe (€)', resumen.diferencia_importe]];
      $('controles-lecturas').replaceChildren(...controles.map(([nombre, valor]) => {
        const div = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = nombre; dd.textContent = valor ?? 'Sin informar'; div.append(dt, dd); return div;
      }));
      }
      if (lista) { precintos = lista; renderPrecintos(mostrarUltima); }
      if (incidencias) {
      $('incidencias-lecturas').replaceChildren(...incidencias.map((i) => {
        const li = document.createElement('li'); li.textContent = `${i.codigo_barras_original} · ${i.codigo_nacional ?? 'Sin código nacional'} · ${i.motivo}`;
        return li;
      }));
      }
      if (fallido) throw fallido.reason;
      if (resumen.admitidos !== lista.length || resumen.incidencias !== incidencias.length) {
        throw new Error('El resumen y el listado consultados no coinciden.');
      }
      datosVigentes = true;
      const estadoRegistro = mostrarEstadoRegistro(resumen);
      $('estado-totales-lecturas').textContent = estadoRegistro
        ? `Datos confirmados por el servidor. ${estadoRegistro}` : 'Datos confirmados por el servidor.';
    } catch (error) {
      $('sin-precintos-lecturas').hidden = true;
      $('estado-totales-lecturas').textContent = `No se pudieron cargar todos los datos. ${errorTexto(error)}`;
      $('reintentar-lecturas').hidden = false;
    }
  };
  const mensajePrecio = (texto, error = false) => {
    $('mensaje-precio').textContent = texto;
    $('mensaje-precio').setAttribute('role', error ? 'alert' : 'status');
  };
  const abrirPrecio = (p) => {
    if (ocupado || solicitud || seleccionPrecio || seleccionBorrado || !datosVigentes || !contextoPrecios?.permite_correccion) return;
    seleccionPrecio = { id: p.id };
    $('alcance-precio').textContent = `Solo este precinto: paquete ${p.numero_paquete}, posición ${p.posicion_paquete}, código nacional ${p.codigo_nacional}. ${$('contexto-lecturas').textContent}`;
    $('referencia-precio').textContent = `Precio de referencia conservado: ${formatoMonetario(p.precio_referencia)} €. Las demás lecturas permanecen iguales.`;
    $('precio-corregido').value = formatoMonetario(p.precio_aplicado);
    $('confirmacion-precio').checked = false; precioIncierto = false;
    mensajePrecio(''); $('formulario-precio').hidden = false; bloquear(); $('titulo-correccion-precio').focus();
  };
  const cerrarPrecio = () => {
    seleccionPrecio = null; precioIncierto = false; $('formulario-precio').hidden = true; bloquear();
  };
  $('confirmacion-precio').addEventListener('input', bloquear);
  $('cancelar-precio').addEventListener('click', () => {
    if (ocupado || precioIncierto) return;
    cerrarPrecio(); $('codigo-lectura').focus();
  });
  $('formulario-precio').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (ocupado || precioIncierto || !seleccionPrecio || !datosVigentes || !contextoPrecios?.permite_correccion || !$('confirmacion-precio').checked) return;
    let precio;
    try { precio = normalizarDecimal($('precio-corregido').value); }
    catch (error) { mensajePrecio(error.message, true); $('precio-corregido').focus(); return; }
    ocupado = true; bloquear(); mensajePrecio('Guardando corrección…');
    try {
      const r = await api.corregirPrecio(entrega.id, seleccionPrecio.id, { precio_aplicado: precio });
      precintos = precintos.map((p) => p.id === r.lectura.id ? r.lectura : p); renderPrecintos();
      $('importe-lecturas').textContent = `${formatoMonetario(r.subtotal_facturable)} €`;
      mensaje('Precio del precinto corregido. Importe de la entrega actualizado.');
      cerrarPrecio(); await actualizar();
    } catch (error) {
      precioIncierto = error.incierto || error.estado == null || error.estado >= 500;
      $('confirmacion-precio').checked = false;
      mensajePrecio(precioIncierto ? `${errorTexto(error)} Resultado incierto: consulta antes de enviar otra corrección.` : errorTexto(error), true);
      if (!precioIncierto) await actualizar();
    } finally { ocupado = false; bloquear(); if (!seleccionPrecio && datosVigentes) $('codigo-lectura').focus(); }
  });
  $('consultar-precio').addEventListener('click', async () => {
    if (ocupado || !precioIncierto) return;
    ocupado = true; bloquear(); await actualizar(); ocupado = false;
    if (datosVigentes) {
      precioIncierto = false; $('confirmacion-precio').checked = false;
      const lectura = precintos.find((p) => p.id === seleccionPrecio.id);
      mensajePrecio(lectura
        ? `Precio aplicado actual del precinto seleccionado: ${formatoMonetario(lectura.precio_aplicado)} €. Revisa el resultado antes de una nueva corrección.`
        : 'El precinto seleccionado ya no está en la entrega. Cancela esta corrección.');
    }
    bloquear();
  });
  const mensajeBorrado = (texto, error = false) => {
    $('mensaje-eliminar').textContent = texto;
    $('mensaje-eliminar').setAttribute('role', error ? 'alert' : 'status');
  };
  const abrirBorrado = (p) => {
    if (ocupado || solicitud || seleccionPrecio || seleccionBorrado || !datosVigentes || !contextoPrecios?.permite_correccion) return;
    seleccionBorrado = { id: p.id };
    borradoIncierto = false; $('confirmacion-eliminar').checked = false;
    $('identidad-eliminar').textContent = `Código nacional ${p.codigo_nacional} · Paquete ${p.numero_paquete} · Posición ${p.posicion_paquete} · Precio aplicado ${formatoMonetario(p.precio_aplicado)} €. ${$('contexto-lecturas').textContent}`;
    mensajeBorrado(''); $('formulario-eliminar').hidden = false; bloquear(); $('titulo-eliminar').focus();
  };
  const cerrarBorrado = () => {
    seleccionBorrado = null; borradoIncierto = false; $('formulario-eliminar').hidden = true;
  };
  const confirmarBorrado = (id, totalesConfirmados = false) => {
    precintos = precintos.filter((p) => p.id !== id); descripciones.delete(id);
    if (ultimaId === id) ultimaId = null;
    cerrarBorrado(); renderPrecintos();
    if (!totalesConfirmados) { $('aptos-lecturas').textContent = '—'; $('importe-lecturas').textContent = '—'; }
    mensaje('Precinto eliminado. Se actualizarán las posiciones de su paquete y los totales.');
  };
  $('confirmacion-eliminar').addEventListener('input', bloquear);
  $('cancelar-eliminar').addEventListener('click', () => {
    if (ocupado || borradoIncierto) return;
    cerrarBorrado(); bloquear(); $('codigo-lectura').focus();
  });
  $('formulario-eliminar').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (ocupado || borradoIncierto || !seleccionBorrado || !datosVigentes || !contextoPrecios?.permite_correccion || !$('confirmacion-eliminar').checked) return;
    const id = seleccionBorrado.id;
    const region = $('lista-precintos'), scroll = { top: region.scrollTop, left: region.scrollLeft };
    ocupado = true; bloquear(); mensajeBorrado('Eliminando precinto…');
    try {
      await api.eliminarPrecinto(entrega.id, id);
      confirmarBorrado(id); await actualizar();
      if (datosVigentes) mensaje('Precinto eliminado. Posiciones de su paquete y totales actualizados.');
      else mensaje('Precinto eliminado. No se pudieron confirmar los totales y posiciones; reintenta la consulta.', true);
    } catch (error) {
      borradoIncierto = error.incierto || error.estado == null || error.estado >= 500;
      $('confirmacion-eliminar').checked = false;
      mensajeBorrado(borradoIncierto ? `${errorTexto(error)} Resultado incierto: consulta antes de otra eliminación.` : errorTexto(error), true);
      if (!borradoIncierto) await actualizar();
    } finally {
      region.scrollTop = scroll.top; region.scrollLeft = scroll.left;
      ocupado = false; bloquear(); if (!seleccionBorrado && datosVigentes) $('codigo-lectura').focus();
    }
  });
  $('consultar-eliminacion').addEventListener('click', async () => {
    if (ocupado || !borradoIncierto || !seleccionBorrado) return;
    const id = seleccionBorrado.id;
    ocupado = true; bloquear(); await actualizar();
    if (datosVigentes) {
      if (!precintos.some((p) => p.id === id)) {
        confirmarBorrado(id, true); mensaje('El precinto ya no está en la entrega. Tabla y totales actualizados.');
      } else {
        // La petición original podría seguir en curso: no reenviar automáticamente.
        borradoIncierto = false; $('confirmacion-eliminar').checked = false;
        mensajeBorrado('El precinto sigue en la entrega. La petición anterior podría seguir en curso; revisa y confirma de nuevo solo si quieres eliminar este mismo ID.');
      }
    } else mensajeBorrado('No se pudo confirmar la eliminación. Consulta de nuevo antes de continuar.', true);
    ocupado = false; bloquear(); if (!seleccionBorrado && datosVigentes) $('codigo-lectura').focus();
  });
  const liberarSolicitud = () => {
    solicitud = null; evaluacion = null; incierto = false; repetible = false; $('decision-lectura').hidden = true;
  };
  const decidir = (resultado) => {
    evaluacion = resultado;
    $('decision-lectura').hidden = false;
    const baja = resultado.resultado === 'PENDIENTE_DECISION_BAJA';
    $('confirmar-incidencia').hidden = baja;
    $('aceptar-baja').hidden = !baja; $('apartar-baja').hidden = !baja;
    $('resultado-lectura').textContent = baja
      ? 'Medicamento en BAJA: elige aceptar el precinto o apartarlo como incidencia.'
      : `Incidencia: ${resultado.motivo}. Confirma para registrarla o cancela esta lectura.`;
    mensaje('Evaluación terminada. Se requiere una decisión explícita.');
  };
  const completada = async (respuesta) => {
    const lectura = respuesta.lectura;
    if (respuesta.tipo === 'PRECINTO') {
      ultimaId = lectura.id;
      if (evaluacion?.medicamento?.id === lectura.medicamento_id) descripciones.set(lectura.id, evaluacion.medicamento.descripcion);
      precintos = [...precintos.filter((p) => p.id !== lectura.id), lectura]; renderPrecintos();
      nuevoPaquete = false; paquete();
      mensaje('Precinto guardado.');
    } else mensaje('Incidencia registrada.');
    liberarSolicitud(); $('codigo-lectura').value = '';
    await actualizar(respuesta.tipo === 'PRECINTO');
  };
  const guardar = async () => {
    ocupado = true; bloquear(); mensaje('Guardando…');
    try {
      const respuesta = await api.guardarLectura(entrega.id, solicitud);
      if (respuesta.resultado === 'DECISION_PENDIENTE') {
        solicitud = { ...solicitud, decision: null }; decidir(respuesta.evaluacion);
      } else if (['GUARDADO', 'RECUPERADO'].includes(respuesta.resultado)) await completada(respuesta);
      else throw new Error('Respuesta de guardado no reconocida.');
    } catch (error) {
      // Un fallo de transporte/servidor puede ocultar un COMMIT ya completado.
      if (error.incierto || error.estado == null || error.estado >= 500) {
        incierto = true; repetible = false; $('decision-lectura').hidden = true;
        mensaje(`${errorTexto(error)} El resultado es incierto. Consulta la operación antes de repetir.`, true);
      } else {
        liberarSolicitud(); mensaje(`${errorTexto(error)} El código se conserva. Evalúa de nuevo antes de guardar.`, true);
        if (error.estado === 409) await actualizar();
      }
    } finally {
      ocupado = false; bloquear();
      if (!solicitud && datosVigentes) $('codigo-lectura').focus();
      else if (!incierto) (evaluacion?.resultado === 'PENDIENTE_DECISION_BAJA' ? $('aceptar-baja') : $('confirmar-incidencia')).focus();
    }
  };
  $('formulario-lectura').addEventListener('submit', async (event) => {
    event.preventDefault(); if (ocupado || solicitud || seleccionPrecio || seleccionBorrado || !datosVigentes || !entrega || !contextoPrecios?.permite_correccion) return;
    const codigo = $('codigo-lectura').value;
    ocupado = true; bloquear(); mensaje('Evaluando código…');
    try {
      evaluacion = await api.evaluarLectura(entrega.id, codigo);
      solicitud = { codigo_barras_original: codigo, clave_operacion: crearClave(), decision: null, nuevo_paquete: nuevoPaquete };
      if (evaluacion.resultado === 'ADMITIDO') {
        mensaje('Guardando…'); await guardar();
      } else if (['INCIDENCIA', 'PENDIENTE_DECISION_BAJA'].includes(evaluacion.resultado)) decidir(evaluacion);
      else { liberarSolicitud(); mensaje('Evaluación no reconocida. El código se conserva.', true); }
    } catch (error) { liberarSolicitud(); mensaje(errorTexto(error), true); }
    finally {
      ocupado = false; bloquear();
      if (!solicitud) $('codigo-lectura').focus();
      else if (!incierto) (evaluacion?.resultado === 'PENDIENTE_DECISION_BAJA' ? $('aceptar-baja') : $('confirmar-incidencia')).focus();
    }
  });
  for (const [id, tipo] of [['confirmar-incidencia', 'CONFIRMAR_INCIDENCIA'], ['aceptar-baja', 'ACEPTAR_BAJA'], ['apartar-baja', 'APARTAR_BAJA']]) {
    $(id).addEventListener('click', () => {
      if (ocupado || incierto || !solicitud) return;
      if (tipo === 'CONFIRMAR_INCIDENCIA' && evaluacion.resultado !== 'INCIDENCIA'
        || tipo !== 'CONFIRMAR_INCIDENCIA' && evaluacion.resultado !== 'PENDIENTE_DECISION_BAJA') return;
      solicitud = { ...solicitud, decision: tipo === 'CONFIRMAR_INCIDENCIA' ? { tipo, motivo: evaluacion.motivo } : { tipo } };
      return guardar();
    });
  }
  $('cancelar-lectura').addEventListener('click', () => {
    if (ocupado || incierto) return;
    liberarSolicitud(); bloquear(); mensaje('Lectura cancelada sin guardar; el código se conserva.'); $('codigo-lectura').focus();
  });
  $('consultar-operacion-lectura').addEventListener('click', async () => {
    if (ocupado || !incierto || !solicitud) return;
    ocupado = true; repetible = false; bloquear(); mensaje('Consultando operación…');
    try { await completada(await api.consultarOperacion(entrega.id, solicitud.clave_operacion)); }
    catch (error) {
      if (error.estado === 404) {
        repetible = true;
        mensaje('La operación aún no es visible; la petición original puede seguir en curso. Puedes consultar otra vez o repetir explícitamente la misma operación, con la misma clave y contenido.', true);
      } else if (error.estado === 410) {
        liberarSolicitud(); mensaje('La operación fue retirada. No se recreará automáticamente; el código se conserva.', true);
        await actualizar();
      } else mensaje(`No se pudo confirmar el resultado. ${errorTexto(error)}`, true);
    } finally { ocupado = false; bloquear(); if (!solicitud && datosVigentes) $('codigo-lectura').focus(); }
  });
  $('repetir-operacion-lectura').addEventListener('click', () => {
    if (ocupado || !incierto || !repetible) return;
    incierto = false; repetible = false; return guardar();
  });
  $('nuevo-paquete-lectura').addEventListener('click', () => {
    if (ocupado || solicitud || seleccionPrecio || seleccionBorrado || !datosVigentes || !contextoPrecios?.permite_correccion) return;
    nuevoPaquete = !nuevoPaquete; paquete(); $('codigo-lectura').focus();
  });
  $('reintentar-lecturas').addEventListener('click', async () => {
    if (ocupado || solicitud || seleccionPrecio || seleccionBorrado) return;
    ocupado = true; bloquear(); await actualizar(); ocupado = false; bloquear();
    if (datosVigentes) $('codigo-lectura').focus();
  });
  $('reconsultar-precios').addEventListener('click', async () => {
    if (ocupado || solicitud || seleccionPrecio || seleccionBorrado) return;
    ocupado = true; bloquear(); await actualizar(); ocupado = false; bloquear();
  });
  $('volver-detalle').addEventListener('click', async () => {
    if (ocupado || solicitud || seleccionPrecio || seleccionBorrado) return;
    $('lecturas').hidden = true; await alVolver();
  });
  return { abrir: async (contexto) => {
    if (ocupado || solicitud || seleccionPrecio || seleccionBorrado) return;
    $('formulario-precio').hidden = true;
    if (entrega?.id !== contexto.id) { descripciones.clear(); ultimaId = null; }
    entrega = contexto; nuevoPaquete = false; precintos = []; paquete(); renderPrecintos();
    $('aptos-lecturas').textContent = '—'; $('importe-lecturas').textContent = '—';
    $('contexto-lecturas').textContent = `Periodo ${String(contexto.mes).padStart(2, '0')}/${contexto.anio} · SOE ${contexto.soe} · ${contexto.denominacion_farmacia} · Ayuntamiento: ${contexto.ayuntamiento_denominacion}`;
    $('codigo-lectura').value = ''; $('decision-lectura').hidden = true; mensaje('');
    $('detalle').hidden = true; $('lecturas').hidden = false;
    ocupado = true; bloquear(); await actualizar(); ocupado = false; bloquear();
    if (datosVigentes) $('codigo-lectura').focus();
  } };
};
