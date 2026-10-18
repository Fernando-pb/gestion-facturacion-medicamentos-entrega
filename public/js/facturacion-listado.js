import * as apiActual from './facturacion-listado-api.js';

export const iniciarListadoFacturacion = ({ documento = document, api = apiActual } = {}) => {
  const el = (id) => documento.getElementById(id);
  const crear = (tag, texto) => { const e = documento.createElement(tag); if (texto !== undefined) e.textContent = texto; return e; };
  const parametros = new URLSearchParams(globalThis.location?.search);
  const filtrosCobro = ['precintos-cobro-filtro', 'comision-cobro-filtro'];
  const filtros = ['ayuntamiento-filtro', 'periodo-filtro', ...filtrosCobro];
  el('ayuntamiento-filtro').value = parametros.get('ayuntamiento_filtro') ?? '';
  el('periodo-filtro').value = parametros.get('periodo_filtro') ?? '';
  for (const id of filtrosCobro) {
    const valor = parametros.get(id.replaceAll('-', '_'));
    el(id).value = ['pendiente', 'cobrada'].includes(valor) ? valor : '';
  }
  const parametrosFiltros = () => {
    const p = new URLSearchParams();
    if (el('ayuntamiento-filtro').value) p.set('ayuntamiento_filtro', el('ayuntamiento-filtro').value);
    if (el('periodo-filtro').value) p.set('periodo_filtro', el('periodo-filtro').value);
    for (const id of filtrosCobro) if (el(id).value) p.set(id.replaceAll('-', '_'), el(id).value);
    return p;
  };
  const conservarFiltros = () => {
    const p = parametrosFiltros();
    globalThis.history?.replaceState?.(null, '', `/facturacion-municipal.html${p.size ? '?'+p : ''}`);
  };
  let ocupado = false, cargado = false, filas = [];
  let seleccionada = null, botonOrigen = null, pendiente = false;
  const botonesReapertura = [];
  const bloquear = () => {
    for (const id of filtros) el(id).disabled = ocupado || pendiente || !!seleccionada || !cargado;
    el('reintentar-listado').disabled = ocupado || pendiente || !!seleccionada;
    for (const id of ['motivo-reapertura', 'confirmacion-reapertura', 'cancelar-reapertura']) el(id).disabled = ocupado || pendiente;
    for (const [boton, fila] of botonesReapertura) boton.disabled = ocupado || pendiente || !!seleccionada || fila.tiene_cobros !== false;
    el('confirmar-reapertura').disabled = ocupado || pendiente || !seleccionada
      || !el('motivo-reapertura').value.trim() || el('motivo-reapertura').value.trim().length > 500 || !el('confirmacion-reapertura').checked;
    el('consultar-reapertura').hidden = !pendiente;
    el('consultar-reapertura').disabled = ocupado;
  };
  const clavePeriodo = (f) => `${f.anio}-${String(f.mes).padStart(2, '0')}`;
  const normalizar = (texto) => texto.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const render = () => {
      const nombre = normalizar(el('ayuntamiento-filtro').value), periodo = el('periodo-filtro').value;
      const coincideCobro = (id, cobrada) => !el(id).value || cobrada === (el(id).value === 'cobrada');
      const visibles = filas.filter((f) => (!nombre || normalizar(f.ayuntamiento).includes(nombre)) && (!periodo || clavePeriodo(f) === periodo)
        && coincideCobro('precintos-cobro-filtro', f.factura_precintos_cobrada)
        && coincideCobro('comision-cobro-filtro', f.factura_comision_cobrada));
      el('filas-facturaciones').replaceChildren();
      botonesReapertura.length = 0;
      for (const f of visibles) {
        const tr = crear('tr'); tr.setAttribute('role', 'row');
        for (const texto of [`${String(f.mes).padStart(2, '0')}/${f.anio}`, f.ayuntamiento,
          `${f.importe_precintos.replace('.', ',')} €`, `${f.importe_comision.replace('.', ',')} €`]) {
          const td = crear('td', texto); td.setAttribute('role', 'cell');
          td.setAttribute('data-label', ['Periodo facturado', 'Ayuntamiento', 'PRECINTOS', 'GASTOS/COMISIÓN'][tr.children.length]); tr.append(td);
        }
        for (const [indice, cobrada] of [[2, f.factura_precintos_cobrada], [3, f.factura_comision_cobrada]]) {
          const estado = crear('span', cobrada ? 'Cobrada' : 'Pendiente'); estado.className = 'estado-cobro';
          tr.children[indice].append(estado);
        }
        const td = crear('td'), enlace = crear('a', 'Ver documentos');
        td.setAttribute('role', 'cell'); td.setAttribute('data-label', 'Acciones'); td.className = 'acciones-facturacion';
        enlace.className = 'button button-secondary';
        const consulta = new URLSearchParams({ facturacion_id: f.facturacion_id });
        for (const [campo,valor] of parametrosFiltros()) consulta.set(campo,valor);
        enlace.href = `/documentos-facturacion.html?${consulta}`;
        enlace.setAttribute('aria-label', `Ver documentos de ${f.ayuntamiento}, ${String(f.mes).padStart(2, '0')}/${f.anio}`);
        enlace.addEventListener('click', (e) => { if (ocupado || pendiente) e.preventDefault(); });
        const boton = crear('button', 'Reabrir facturación'); boton.type = 'button'; boton.className = 'button button-secondary';
        boton.setAttribute('aria-label', `Reabrir facturación de ${f.ayuntamiento}, ${String(f.mes).padStart(2, '0')}/${f.anio}`);
        boton.disabled = f.tiene_cobros !== false;
        boton.addEventListener('click', () => abrirReapertura(f, boton)); botonesReapertura.push([boton, f]);
        td.append(enlace, boton);
        if (f.tiene_cobros !== false) {
          const aviso = crear('p', f.tiene_cobros ? 'No se puede reabrir: alguna de las dos facturas tiene cobros.' : 'No se ha podido confirmar la ausencia de cobros.');
          aviso.id = `bloqueo-reapertura-${f.facturacion_id}`; boton.setAttribute('aria-describedby', aviso.id); td.append(aviso);
        }
        tr.append(td); el('filas-facturaciones').append(tr);
      }
      el('tabla-facturaciones').hidden = visibles.length === 0;
      el('estado-listado-facturaciones').textContent = !filas.length ? 'Todavía no hay facturaciones emitidas. Puedes iniciar una nueva facturación.'
        : visibles.length ? `${visibles.length} de ${filas.length} facturaciones emitidas.` : 'No hay facturaciones emitidas que coincidan con los filtros.';
      bloquear();
  };
  const comprobar = (datos) => {
    if (datos.estado !== 'EMITIDA') throw new Error('Esta facturación ya no está emitida. Consulta el listado actual.');
    if (!Array.isArray(datos.cobros) || !Array.isArray(datos.facturas) || datos.facturas.length !== 2
      || !['PRECINTOS', 'COMISION'].every(t => datos.facturas.some(f => f.tipo === t))) throw new Error('No se puede confirmar el estado de las dos facturas.');
    if (datos.cobros.length) throw new Error('No se puede reabrir: alguna de las dos facturas tiene cobros.');
  };
  const actualizarCobros = (fila, datos) => {
    for (const [tipo, campo] of [['PRECINTOS', 'factura_precintos_cobrada'], ['COMISION', 'factura_comision_cobrada']]) {
      const factura = datos.facturas?.find(f => f.tipo === tipo);
      if (factura && Array.isArray(datos.cobros)) fila[campo] = datos.cobros.some(c => c.factura_id === factura.id);
    }
    fila.tiene_cobros = true;
  };
  const abrirReapertura = async (fila, boton) => {
    if (ocupado || pendiente || seleccionada || fila.tiene_cobros !== false) return;
    ocupado = true; bloquear(); el('error-reapertura').textContent = ''; el('estado-reapertura').textContent = 'Comprobando las dos facturas…';
    el('continuar-reapertura').hidden = true;
    try {
      const datos = await api.consultar(fila.facturacion_id);
      if (datos.cobros?.length) { actualizarCobros(fila, datos); render(); }
      comprobar(datos);
      seleccionada = fila; botonOrigen = boton;
      el('contexto-reapertura').textContent = `${fila.ayuntamiento} · ${String(fila.mes).padStart(2, '0')}/${fila.anio} · ${datos.facturas.map(f => `${f.tipo}: ${f.numero_factura}`).join(' · ')}`;
      el('motivo-reapertura').value = ''; el('confirmacion-reapertura').checked = false;
      el('formulario-reapertura').hidden = false; el('estado-reapertura').textContent = '';
      el('titulo-reapertura').focus();
    } catch (e) { el('error-reapertura').textContent = e.message; el('estado-reapertura').textContent = ''; }
    finally { ocupado = false; bloquear(); }
  };
  const confirmada = (datos, motivoAceptado = '') => {
    const f = seleccionada;
    // El POST confirmado acredita el motivo enviado. Recuperar solo el estado
    // no acredita que ganase nuestra petición frente a la de otro operador.
    const motivoConfirmado = typeof datos.motivo === 'string' ? datos.motivo.trim() : motivoAceptado;
    const mensajeMotivo = motivoConfirmado ? `Motivo: ${motivoConfirmado}.`
      : 'La reapertura está confirmada, pero el servidor no ha devuelto el motivo registrado; el motivo introducido localmente no está confirmado.';
    el('estado-reapertura').textContent = `${f.ayuntamiento} · ${String(f.mes).padStart(2, '0')}/${f.anio}: REABIERTA. ${mensajeMotivo} Se conservan las dos facturas originales hasta reemitir conjuntamente.`;
    el('continuar-reapertura').href = `/facturacion-emision.html?facturacion_id=${f.facturacion_id}`;
    el('continuar-reapertura').hidden = false; el('formulario-reapertura').hidden = true;
    filas = filas.filter(fila => fila.facturacion_id !== f.facturacion_id);
    seleccionada = null; pendiente = false; render(); el('continuar-reapertura').focus();
  };
  const consultarEstadoReapertura = async () => {
    const datos = await api.consultar(seleccionada.facturacion_id);
    if (datos.estado === 'REABIERTA') confirmada(datos);
    else if (datos.estado === 'EMITIDA' && Array.isArray(datos.cobros) && datos.cobros.length) {
      actualizarCobros(seleccionada, datos); seleccionada = null; pendiente = false;
      el('formulario-reapertura').hidden = true; render();
      el('estado-reapertura').textContent = 'EMITIDA. No se puede reabrir: alguna de las dos facturas tiene cobros.';
    } else {
      comprobar(datos); pendiente = false;
      el('estado-reapertura').textContent = 'Sigue EMITIDA sin cobros. Revisa el motivo y confirma de nuevo antes de repetir.';
    }
  };
  el('motivo-reapertura').addEventListener('input', () => { el('confirmacion-reapertura').checked = false; bloquear(); });
  el('confirmacion-reapertura').addEventListener('input', bloquear);
  el('cancelar-reapertura').addEventListener('click', () => {
    if (ocupado || pendiente) return;
    seleccionada = null; el('formulario-reapertura').hidden = true; el('error-reapertura').textContent = ''; bloquear(); botonOrigen?.focus();
  });
  el('formulario-reapertura').addEventListener('submit', async (e) => {
    e.preventDefault(); if (ocupado || pendiente || !seleccionada) return;
    const motivo = el('motivo-reapertura').value.trim();
    if (!motivo || motivo.length > 500 || !el('confirmacion-reapertura').checked) { el('error-reapertura').textContent = 'Introduce el motivo y confirma reabrir la facturación y sus dos facturas.'; return; }
    ocupado = true; bloquear(); el('error-reapertura').textContent = ''; el('estado-reapertura').textContent = 'Reabriendo la facturación completa…';
    try {
      const datos = await api.reabrir(seleccionada.facturacion_id, motivo);
      if (datos.estado !== 'REABIERTA' || datos.facturacion_id !== seleccionada.facturacion_id) throw Object.assign(new Error('No se pudo confirmar la reapertura.'), { incierto: true });
      confirmada(datos, motivo);
    } catch (err) {
      el('error-reapertura').textContent = err.message;
      pendiente = !!err.incierto; el('confirmacion-reapertura').checked = false;
      el('estado-reapertura').textContent = pendiente ? 'Resultado pendiente. Consulta antes de repetir la reapertura.' : 'No se ha confirmado la reapertura. Revisa el estado antes de volver a intentarlo.';
      if (err.estado === 409) {
        // El 409 no distingue cobro de otros conflictos. Confirmar por GET;
        // si falla, conservar el bloqueo y ofrecer solo consulta, nunca POST.
        pendiente = true;
        try { await consultarEstadoReapertura(); }
        catch (consultaError) {
          el('error-reapertura').textContent = `${err.message} No se pudo actualizar el estado: ${consultaError.message}`;
          el('estado-reapertura').textContent = 'Estado pendiente de consultar. La confirmación permanece bloqueada.';
        }
      }
    } finally { ocupado = false; bloquear(); }
  });
  el('consultar-reapertura').addEventListener('click', async () => {
    if (ocupado || !pendiente) return;
    ocupado = true; bloquear(); el('error-reapertura').textContent = '';
    try {
      await consultarEstadoReapertura();
    } catch (e) { el('error-reapertura').textContent = e.message; }
    finally { ocupado = false; bloquear(); }
  });
  for (const enlace of documento.querySelectorAll?.('a') ?? []) enlace.addEventListener('click', (e) => { if (ocupado || pendiente) e.preventDefault(); });
  globalThis.addEventListener?.('beforeunload', (e) => { if (ocupado || pendiente) { e.preventDefault(); e.returnValue = ''; } });
  const cargar = async () => {
    if (ocupado || pendiente || seleccionada) return;
    ocupado = true; cargado = false;
    for (const id of [...filtros, 'reintentar-listado']) el(id).disabled = true;
    el('reintentar-listado').hidden = true;
    el('estado-listado-facturaciones').textContent = 'Consultando facturaciones emitidas…';
    el('error-listado-facturaciones').textContent = ''; el('filas-facturaciones').replaceChildren();
    try {
      filas = await api.listarEmitidas();
      if (!Array.isArray(filas) || !filas.every(f => typeof f.factura_precintos_cobrada === 'boolean' && typeof f.factura_comision_cobrada === 'boolean')) {
        throw new Error('No se pudo verificar el estado de cobro de las dos facturas.');
      }
      cargado = true;
      const periodoActual = el('periodo-filtro').value;
      const todas = crear('option', 'Todos los periodos'); todas.value = '';
      const periodos = [...new Map(filas.map((f) => [clavePeriodo(f), f])).values()];
      el('periodo-filtro').replaceChildren(todas, ...periodos.map((f) => {
        const opcion = crear('option', `${String(f.mes).padStart(2, '0')}/${f.anio}`); opcion.value = clavePeriodo(f); return opcion;
      }));
      el('periodo-filtro').value = periodos.some((f) => clavePeriodo(f) === periodoActual) ? periodoActual : '';
      render();
    } catch (e) {
      filas = []; cargado = false;
      el('tabla-facturaciones').hidden = true; el('estado-listado-facturaciones').textContent = '';
      el('error-listado-facturaciones').textContent = `${e.message} Pulsa «Reintentar carga».`;
      el('reintentar-listado').hidden = false;
    } finally {
      ocupado = false;
      for (const id of filtros) el(id).disabled = !cargado;
      el('reintentar-listado').disabled = false;
      bloquear();
    }
  };
  el('ayuntamiento-filtro').addEventListener('input', () => { if (!ocupado && cargado) { conservarFiltros(); render(); } });
  el('periodo-filtro').addEventListener('change', () => { if (!ocupado && cargado) { conservarFiltros(); render(); } });
  for (const id of filtrosCobro) el(id).addEventListener('change', () => { if (!ocupado && !pendiente && !seleccionada && cargado) { conservarFiltros(); render(); } });
  el('reintentar-listado').addEventListener('click', cargar);
  globalThis.addEventListener?.('pageshow', (e) => { if (e.persisted) return cargar(); });
  return cargar();
};
if (typeof document !== 'undefined') void iniciarListadoFacturacion();
