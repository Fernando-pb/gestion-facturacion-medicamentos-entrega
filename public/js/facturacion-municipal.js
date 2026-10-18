import * as apiDefecto from './facturacion-municipal-api.js';

export const iniciarFacturacion = ({ api = apiDefecto } = {}) => {
  const $ = (id) => document.getElementById(id);
  const crear = (tag, texto) => { const e = document.createElement(tag); if (texto !== undefined) e.textContent = texto; return e; };
  const moneda = (valor) => `${valor.replace('.', ',')} €`;
  const idValido = (valor) => /^\d+$/.test(valor) && Number(valor) > 0 && Number(valor) <= 2147483647;
  let ocupado = false, cargado = false, revision = null, previa = null, editando = null, pendiente = null;
  let paso = 'seleccion', municipios = [], periodos = [], combinaciones = [], seleccion = null;
  const error = (texto) => {
    // Presentación del mensaje existente de la API; el contrato de B se conserva.
    const mensaje = texto === 'B está congelado desde la emisión, también durante una reapertura.'
      ? 'Los datos de la farmacia quedan fijados desde la emisión, también durante una reapertura.' : texto;
    $('error-facturacion').textContent = mensaje; $('error-facturacion').hidden = !mensaje;
  };
  const controles = () => $('pantalla-facturacion').querySelectorAll('button, input, select');
  const numerosValidos = () => ['numero-precintos', 'numero-comision'].every((id) => {
    const v = $(id).value.trim(); return v.length > 0 && v.length <= 200;
  });
  const actualizarControles = () => {
    controles().forEach((e) => { e.disabled = ocupado || !!pendiente; });
    $('recuperar-facturacion').disabled = ocupado;
    $('recuperar-facturacion').hidden = !pendiente;
    $('ayuntamiento-facturacion').disabled = ocupado || !!pendiente || !cargado;
    $('periodo-facturacion').disabled = ocupado || !!pendiente || !cargado || !periodos.length;
    $('preparar-facturacion').disabled = ocupado || !!pendiente || !cargado
      || !combinaciones.some((c) => String(c.ayuntamiento_id) === $('ayuntamiento-facturacion').value
        && String(c.periodo_id) === $('periodo-facturacion').value);
    $('confirmar-emision').disabled = ocupado || !!pendiente || !previa || !numerosValidos() || !$('confirmacion-emision').checked;
    $('pantalla-facturacion').setAttribute('aria-busy', String(ocupado));
  };
  const mostrar = (nombre) => {
    paso = nombre;
    for (const p of ['seleccion', 'revision', 'emision', 'resultado']) $(`paso-${p}`).hidden = p !== nombre;
    $(`titulo-${nombre}`).focus();
  };
  const operar = async (mensaje, accion) => {
    if (ocupado || pendiente) return;
    ocupado = true; error(''); $('estado-facturacion').textContent = mensaje; actualizarControles();
    try { await accion(); }
    catch (e) { error(e.message); $('estado-facturacion').textContent = ''; }
    finally { ocupado = false; actualizarControles(); }
  };
  const cerrarB = () => { editando = null; $('formulario-b').hidden = true; $('acciones-revision').hidden = false; $('lista-participaciones').hidden = false; };
  const renderRevision = (datos) => {
    revision = datos; previa = null; cerrarB();
    $('total-participaciones').textContent = `${datos.cantidad_precintos} precintos aptos · Total PRECINTOS: ${moneda(datos.importe_total)}`;
    $('advertencia-facturacion').hidden = datos.cantidad_precintos !== 0;
    $('advertencia-facturacion').textContent = datos.advertencia || (datos.cantidad_precintos === 0 ? 'No hay precintos aptos para este Ayuntamiento y periodo.' : '');
    $('continuar-emision').hidden = datos.cantidad_precintos === 0 || datos.estado === 'EMITIDA';
    const region = crear('div'); region.className = 'table-scroll'; region.tabIndex = 0;
    region.setAttribute('role', 'region'); region.setAttribute('aria-label', 'Participaciones de farmacias');
    const table = crear('table'), head = crear('thead'), filaHead = crear('tr'), body = crear('tbody');
    ['ID farmacia', 'SOE', 'Denominación', 'CIF', 'Precintos aptos', 'Importe', 'Revisión'].forEach((v) => {
      const th = crear('th', v); th.setAttribute('scope', 'col'); filaHead.append(th);
    }); head.append(filaHead);
    for (const p of datos.participaciones) {
      const tr = crear('tr');
      [String(p.farmacia_id), p.soe_b, p.denominacion_b, p.cif_b, String(p.cantidad_precintos), moneda(p.importe_precintos)].forEach((v, i) => {
        const td = crear('td', v); if (i >= 4) td.className = 'numero'; tr.append(td);
      });
      const td = crear('td');
      if (datos.estado === 'REVISION') {
        const boton = crear('button', 'Corregir farmacia'); boton.type = 'button'; boton.className = 'button button-secondary';
        boton.setAttribute('aria-label', `Corregir farmacia ${p.soe_b} ${p.denominacion_b}`);
        boton.addEventListener('click', () => {
          if (ocupado || pendiente || paso !== 'revision') return;
          editando = p; $('soe-b').value = p.soe_b; $('denominacion-b').value = p.denominacion_b; $('cif-b').value = p.cif_b;
          $('formulario-b').hidden = false; $('acciones-revision').hidden = true; $('lista-participaciones').hidden = true;
          error(''); $('titulo-b').textContent = `Corregir farmacia · ID ${p.farmacia_id}`; $('titulo-b').focus();
        }); td.append(boton);
      } else td.textContent = 'Datos de farmacia fijados';
      tr.append(td); body.append(tr);
    }
    table.append(head, body); region.append(table); $('lista-participaciones').replaceChildren(region);
    mostrar('revision');
  };
  const renderResultado = (datos) => {
    if (datos.estado !== 'EMITIDA' || datos.facturas?.length !== 2
      || !['PRECINTOS', 'COMISION'].every((tipo) => datos.facturas.some((f) => f.tipo === tipo))
      || !datos.facturas.every((f) => typeof f.numero_factura === 'string'
        && typeof f.importe_total === 'string' && /^\d+\.\d{2}$/.test(f.importe_total))) {
      throw new apiDefecto.ErrorFacturacion('La respuesta de emisión no pudo confirmarse.');
    }
    previa = null;
    $('referencia-emitida').textContent = `Referencia de facturación: ${datos.facturacion_id}`;
    $('enlace-documentos').href = `/documentos-facturacion.html?facturacion_id=${datos.facturacion_id}`;
    $('enlace-cobros').href = `/cobros-municipales.html?${new URLSearchParams({ facturacion_id: datos.facturacion_id })}`;
    $('facturas-emitidas').replaceChildren(...datos.facturas.map((f) => crear('p', `${f.tipo === 'COMISION' ? 'COMISIÓN' : f.tipo} · Número ${f.numero_factura} · ${moneda(f.importe_total)}`)));
    mostrar('resultado'); $('estado-facturacion').textContent = 'Emisión conjunta confirmada.';
  };
  const preparar = async () => {
    const datos = await api.calcular(seleccion);
    if (datos.estado === 'REABIERTA') renderRevision(await api.consultar(datos.facturacion_id));
    else renderRevision(datos);
    $('estado-facturacion').textContent = revision.estado === 'REABIERTA'
      ? 'Revisión correctiva preparada. Se conservan los datos de las farmacias y los números originales.'
      : 'Revisión preparada. Todavía no se han emitido facturas.';
  };
  const cargarPrevia = async () => {
    previa = null; $('formulario-emision').hidden = true; $('resumen-emision').replaceChildren();
    $('reintentar-previa').hidden = false; $('confirmacion-emision').checked = false; mostrar('emision');
    const datos = await api.previsualizar(revision.facturacion_id);
    if (datos.cantidad_precintos === 0) { renderRevision(datos); $('estado-facturacion').textContent = 'No hay precintos aptos para emitir.'; return; }
    const campos = ['importe_precintos', 'base_calculo', 'importe_comision', 'importe_iva', 'importe_total_comision', 'importe_total_conjunto'];
    if (!campos.every((c) => typeof datos[c] === 'string' && /^\d+\.\d{2}$/.test(datos[c]))) throw new Error('La previsualización no contiene todos los importes.');
    const dl = crear('dl');
    const etiquetas = ['PRECINTOS', 'Base de COMISIÓN', `Comisión (${datos.porcentaje_comision.replace('.', ',')} %)`,
      `IVA (${datos.porcentaje_iva.replace('.', ',')} %)`, 'Total COMISIÓN', 'Total conjunto'];
    campos.forEach((c, i) => dl.append(crear('dt', etiquetas[i]), crear('dd', moneda(datos[c]))));
    $('resumen-emision').append(dl);
    const reabierta = revision.estado === 'REABIERTA';
    for (const [id, tipo] of [['numero-precintos', 'PRECINTOS'], ['numero-comision', 'COMISION']]) {
      $(id).readOnly = reabierta;
      if (reabierta) $(id).value = revision.facturas.find((f) => f.tipo === tipo).numero_factura;
    }
    previa = datos; $('nota-numeros').hidden = !reabierta; $('formulario-emision').hidden = false;
    $('reintentar-previa').hidden = true; $('estado-facturacion').textContent = 'Importes consultados. Revisa los números antes de confirmar.';
  };
  $('inicio-facturacion').addEventListener('click', (e) => { if (ocupado || pendiente) e.preventDefault(); });
  globalThis.addEventListener?.('beforeunload', (e) => { if (ocupado || pendiente) { e.preventDefault(); e.returnValue = ''; } });
  $('formulario-seleccion').addEventListener('submit', (e) => {
    e.preventDefault(); if (ocupado || pendiente || !cargado || paso !== 'seleccion') return;
    const town = $('ayuntamiento-facturacion').value, periodo = $('periodo-facturacion').value;
    if (!idValido(town) || !idValido(periodo) || !combinaciones.some((c) => String(c.ayuntamiento_id) === town && String(c.periodo_id) === periodo)) {
      error('Selecciona un Ayuntamiento y un periodo disponibles.'); return;
    }
    seleccion = { ayuntamiento_id: Number(town), periodo_id: Number(periodo) };
    const p = periodos.find((p) => String(p.id) === periodo);
    $('contexto-facturacion').textContent = `${municipios.find((m) => String(m.id) === town).denominacion} · ${String(p.mes).padStart(2, '0')}/${p.anio}`;
    $('numero-precintos').value = ''; $('numero-comision').value = '';
    return operar('Preparando revisión…', preparar);
  });
  $('volver-seleccion').addEventListener('click', () => { if (!ocupado && !pendiente) { error(''); mostrar('seleccion'); return cargarCatalogos(); } });
  $('otra-facturacion').addEventListener('click', () => { if (!ocupado && !pendiente) { revision = null; previa = null; error(''); mostrar('seleccion'); return cargarCatalogos(); } });
  $('recalcular-facturacion').addEventListener('click', () => operar('Recalculando participaciones…', preparar));
  $('cancelar-b').addEventListener('click', () => { if (!ocupado && !pendiente) { cerrarB(); error(''); $('titulo-revision').focus(); } });
  $('formulario-b').addEventListener('submit', (e) => {
    e.preventDefault(); if (ocupado || pendiente || !editando) return;
    const datos = { soe_b: $('soe-b').value.trim(), denominacion_b: $('denominacion-b').value.trim(), cif_b: $('cif-b').value.trim() };
    if (!Object.entries(datos).every(([c, v]) => v.length > 0 && v.length <= ({ soe_b: 100, denominacion_b: 250, cif_b: 50 })[c])) {
      error('Completa SOE, denominación y CIF de la farmacia dentro de las longitudes permitidas.'); return;
    }
    return operar('Guardando datos de la farmacia…', async () => {
      try {
        const guardada = await api.corregirB(revision.facturacion_id, editando.id, datos);
        const datosRevision = { ...revision, participaciones: revision.participaciones.map((p) => p.id === editando.id ? { ...p, ...guardada } : p) };
        renderRevision(datosRevision); $('estado-facturacion').textContent = 'Datos de la farmacia guardados. Todavía pueden revisarse antes de emitir.';
      } catch (err) {
        if (err.incierto) { pendiente = 'b'; $('estado-facturacion').textContent = 'Corrección de farmacia pendiente de confirmar. Consulta antes de repetir.'; error(err.message); }
        else throw err;
      }
    });
  });
  $('continuar-emision').addEventListener('click', () => { if (revision?.cantidad_precintos > 0 && !editando) return operar('Consultando importes…', cargarPrevia); });
  $('reintentar-previa').addEventListener('click', () => operar('Consultando importes…', cargarPrevia));
  $('volver-revision').addEventListener('click', () => { if (!ocupado && !pendiente) {
    previa = null; error(''); renderRevision(revision); $('estado-facturacion').textContent = 'Revisa las participaciones antes de continuar.'; actualizarControles();
  } });
  for (const id of ['numero-precintos', 'numero-comision']) $(id).addEventListener('input', () => {
    $('confirmacion-emision').checked = false; actualizarControles();
  });
  $('confirmacion-emision').addEventListener('input', actualizarControles);
  $('formulario-emision').addEventListener('submit', (e) => {
    e.preventDefault(); if (ocupado || pendiente || paso !== 'emision' || !previa) return;
    if (!numerosValidos() || !$('confirmacion-emision').checked) { error('Introduce ambos números oficiales y confirma que has revisado los datos.'); return; }
    const datos = revision.estado === 'REABIERTA' ? {} : {
      numero_factura_precintos: $('numero-precintos').value.trim(), numero_factura_comision: $('numero-comision').value.trim(),
    };
    return operar('Emitiendo ambas facturas…', async () => {
      try {
        const emitida = await api.emitir(revision.facturacion_id, datos);
        if (emitida.advertencia && emitida.cantidad_precintos === 0) {
          renderRevision(emitida); $('estado-facturacion').textContent = emitida.estado === 'REABIERTA'
            ? 'No se han actualizado las facturas: no hay precintos aptos.' : 'No se han emitido facturas: no hay precintos aptos.';
        }
        else renderResultado(emitida);
      } catch (err) {
        previa = null;
        if (err.incierto) { pendiente = 'emision'; $('estado-facturacion').textContent = 'Emisión pendiente de confirmar. Consulta el resultado antes de repetir.'; error(err.message); }
        else { $('formulario-emision').hidden = true; $('reintentar-previa').hidden = false; throw err; }
      }
    });
  });
  $('recuperar-facturacion').addEventListener('click', async () => {
    if (ocupado || !pendiente) return;
    ocupado = true; actualizarControles(); error(''); $('estado-facturacion').textContent = 'Consultando resultado…';
    try {
      const datos = await api.consultar(revision.facturacion_id);
      if (datos.estado === 'EMITIDA') renderResultado(datos);
      else { renderRevision(datos); $('estado-facturacion').textContent = 'Estado consultado. Revisa los datos antes de continuar.'; }
      pendiente = null;
    } catch (err) { error(err.message); $('estado-facturacion').textContent = 'Resultado todavía pendiente de confirmar.'; }
    finally { ocupado = false; actualizarControles(); }
  });
  const llenar = (id, filas, etiqueta, valor = '') => {
    const vacio = crear('option', 'Selecciona una opción'); vacio.value = '';
    $(id).replaceChildren(vacio, ...filas.map((f) => { const opt = crear('option', etiqueta(f)); opt.value = String(f.id); return opt; }));
    $(id).value = filas.some((f) => String(f.id) === valor) ? valor : '';
  };
  const actualizarPeriodos = (valor = '') => {
    periodos = combinaciones.filter((c) => String(c.ayuntamiento_id) === $('ayuntamiento-facturacion').value)
      .map((c) => ({ id: c.periodo_id, mes: c.mes, anio: c.anio, estado: c.estado }));
    llenar('periodo-facturacion', periodos, (p) => `${String(p.mes).padStart(2, '0')}/${p.anio}${p.estado === 'REVISION' ? ' · Revisión en curso' : p.estado === 'REABIERTA' ? ' · Reabierta' : ''}`, valor);
    actualizarControles();
  };
  $('ayuntamiento-facturacion').addEventListener('change', () => { if (!ocupado && !pendiente) actualizarPeriodos(); });
  $('periodo-facturacion').addEventListener('change', actualizarControles);
  const cargarCatalogos = () => operar('Cargando combinaciones pendientes…', async () => {
    const townAnterior = $('ayuntamiento-facturacion').value, periodoAnterior = $('periodo-facturacion').value;
    cargado = false; $('reintentar-catalogos').hidden = false;
    combinaciones = await api.listarPendientes();
    municipios = [...new Map(combinaciones.map((c) => [c.ayuntamiento_id, { id: c.ayuntamiento_id, denominacion: c.denominacion }])).values()];
    llenar('ayuntamiento-facturacion', municipios, (m) => m.denominacion, townAnterior);
    cargado = combinaciones.length > 0;
    actualizarPeriodos(periodoAnterior); $('reintentar-catalogos').hidden = true;
    $('estado-facturacion').textContent = cargado ? 'Selecciona Ayuntamiento y periodo pendientes. Puedes continuar una revisión o una facturación reabierta.'
      : 'No hay combinaciones Ayuntamiento–periodo pendientes con precintos aptos para facturar.';
  });
  $('reintentar-catalogos').addEventListener('click', cargarCatalogos);
  return (async () => {
    await cargarCatalogos();
    const id = new URLSearchParams(globalThis.location?.search).get('facturacion_id');
    if (id === null) return;
    if (!idValido(id)) { error('Referencia de facturación no válida.'); return; }
    return operar('Consultando facturación para continuar…', async () => {
      const datos = await api.consultar(Number(id));
      if (!['REVISION', 'REABIERTA'].includes(datos.estado) || datos.cobros?.length) throw new Error('Solo puede continuarse una revisión o reapertura sin cobros.');
      const pareja = combinaciones.find(c => c.facturacion_id === Number(id));
      if (!pareja) throw new Error('No hay precintos aptos pendientes para esta facturación. Revisa sus entregas antes de continuar.');
      seleccion = { ayuntamiento_id: pareja.ayuntamiento_id, periodo_id: pareja.periodo_id };
      $('ayuntamiento-facturacion').value = String(pareja.ayuntamiento_id); actualizarPeriodos(String(pareja.periodo_id));
      $('contexto-facturacion').textContent = `${pareja.denominacion} · ${String(pareja.mes).padStart(2, '0')}/${pareja.anio}`;
      renderRevision(datos);
      $('estado-facturacion').textContent = datos.estado === 'REABIERTA'
        ? 'REABIERTA. Revisa y previsualiza antes de reemitir conjuntamente las dos facturas originales.' : 'Revisión existente cargada. Todavía no se han emitido facturas.';
    });
  })();
};
if (typeof document !== 'undefined') void iniciarFacturacion();
