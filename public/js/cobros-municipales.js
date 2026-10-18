import * as apiDefecto from './facturacion-municipal-api.js';
import { iniciarLiquidacion } from './liquidacion-farmacias.js';

const idValido = (valor) => /^\d+$/.test(String(valor)) && Number(valor) > 0 && Number(valor) <= 2147483647;
const importeValido = (valor) => typeof valor === 'string' && /^(0|[1-9]\d{0,9})\.\d{2}$/.test(valor);
export const fechaCobroValida = (fecha) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const bisiesto = anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0);
  return anio >= 1 && mes >= 1 && mes <= 12 && dia >= 1
    && dia <= [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
};
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const tipoVisible = (tipo) => tipo === 'COMISION' ? 'GASTOS/COMISIÓN' : 'PRECINTOS';

export const iniciarCobros = ({ api = apiDefecto,
  referencia = new URLSearchParams(globalThis.location?.search ?? '').get('facturacion_id') } = {}) => {
  const $ = (id) => document.getElementById(id);
  const crear = (tag, texto) => { const e = document.createElement(tag); if (texto !== undefined) e.textContent = texto; return e; };
  const moneda = (valor) => `${valor.replace('.', ',')} €`;
  let proceso = null, seleccionada = null, ocupado = false, pendiente = false, paso = 'consulta';
  let filas = [], filaActual = null;
  const parametros = new URLSearchParams(globalThis.location?.search ?? '');
  $('ayuntamiento-filtro').value = parametros.get('ayuntamiento_filtro') ?? '';
  $('periodo-filtro').value = parametros.get('periodo_filtro') ?? '';
  $('estado-cobro-filtro').value = ['pendiente', 'parcial', 'cobrada'].includes(parametros.get('estado_cobro_filtro')) ? parametros.get('estado_cobro_filtro') : '';
  const filtros = () => {
    const p = new URLSearchParams();
    if ($('ayuntamiento-filtro').value) p.set('ayuntamiento_filtro', $('ayuntamiento-filtro').value);
    if ($('periodo-filtro').value) p.set('periodo_filtro', $('periodo-filtro').value);
    if ($('estado-cobro-filtro').value) p.set('estado_cobro_filtro', $('estado-cobro-filtro').value);
    return p;
  };
  const conservar = (id) => {
    const p = filtros(); if (id != null) p.set('facturacion_id', id);
    globalThis.history?.replaceState?.(null, '', `/cobros-municipales.html${p.size ? '?' + p : ''}`);
  };
  const cobrada = (id) => proceso.cobros.some((c) => c.factura_id === id);
  const error = (texto) => { $('error-cobros').textContent = texto; $('error-cobros').hidden = !texto; };
  const controles = () => {
    $('pantalla-cobros').querySelectorAll('button, input, select').forEach((e) => { e.disabled = ocupado || pendiente; });
    $('recuperar-cobro').hidden = !pendiente; $('recuperar-cobro').disabled = ocupado;
    $('guardar-cobro').disabled = ocupado || pendiente || !seleccionada || !$('confirmacion-cobro').checked || !fechaCobroValida($('fecha-cobro').value);
    $('pantalla-cobros').setAttribute('aria-busy', String(ocupado));
    liquidacion.actualizarControles(ocupado || pendiente);
  };
  const mostrar = (nombre) => {
    paso = nombre;
    for (const p of ['consulta', 'facturas', 'registro']) $(`paso-${p}`).hidden = nombre !== p;
    $('seccion-liquidacion').hidden = nombre !== 'facturas';
    $(`titulo-${nombre}`).focus();
  };
  const validarProceso = (datos, id) => {
    if (datos.facturacion_id !== Number(id) || !['REVISION', 'EMITIDA', 'REABIERTA'].includes(datos.estado)) throw new Error('La consulta de facturación no pudo verificarse.');
    if (datos.estado === 'REVISION') return { ...datos, facturas: [], cobros: [] };
    if (!Array.isArray(datos.facturas) || datos.facturas.length !== 2 || !Array.isArray(datos.cobros)
      || !['PRECINTOS', 'COMISION'].every((tipo) => datos.facturas.some((f) => f.tipo === tipo))
      || new Set(datos.facturas.map((f) => f.id)).size !== 2
      || !datos.facturas.every((f) => idValido(f.id) && typeof f.numero_factura === 'string' && importeValido(f.importe_total))
      || new Set(datos.cobros.map((c) => c.factura_id)).size !== datos.cobros.length
      || !datos.cobros.every((c) => datos.facturas.some((f) => f.id === c.factura_id && f.importe_total === c.importe_cobrado)
        && fechaCobroValida(c.fecha_cobro) && (c.justificante == null || typeof c.justificante === 'string'))) {
      throw new Error('Los datos de facturas y cobros no son coherentes. Consulta de nuevo antes de registrar.');
    }
    return datos;
  };
  const render = (datos) => {
    proceso = datos;
    $('contexto-cobros').textContent = filaActual ? `${filaActual.ayuntamiento} · Periodo facturado: ${String(filaActual.mes).padStart(2, '0')}/${filaActual.anio}` : '';
    $('bloqueo-reapertura').textContent = datos.cobros.length
      ? 'Reapertura bloqueada: existe un cobro registrado en esta facturación.'
      : 'Registrar cualquier cobro bloqueará la reapertura de toda esta facturación.';
    $('tarjetas-facturas').replaceChildren(...['PRECINTOS', 'COMISION'].flatMap((tipo) => {
      const f = datos.facturas.find((f) => f.tipo === tipo); if (!f) return [];
      const tarjeta = crear('section'); tarjeta.className = 'tarjeta-factura';
      tarjeta.setAttribute('aria-label', `Factura ${tipoVisible(tipo)}`);
      tarjeta.append(crear('h3', tipoVisible(tipo)), crear('p', `Número oficial: ${f.numero_factura}`), crear('p', `Importe total: ${moneda(f.importe_total)}`));
      const c = datos.cobros.find((c) => c.factura_id === f.id);
      tarjeta.append(crear('p', c ? 'Estado: Cobrada' : 'Estado: Pendiente de cobro'));
      if (c) tarjeta.append(crear('p', `Fecha de cobro: ${c.fecha_cobro}`), crear('p', `Importe cobrado: ${moneda(c.importe_cobrado)}`), crear('p', `Justificante: ${c.justificante ?? 'Sin referencia'}`));
      else if (datos.estado === 'EMITIDA') {
        const boton = crear('button', `Registrar cobro de ${tipoVisible(tipo)}`); boton.type = 'button'; boton.className = 'button button-primary';
        boton.addEventListener('click', () => {
          if (ocupado || pendiente || paso !== 'facturas' || cobrada(f.id)) return;
          if (seleccionada?.id !== f.id) { $('fecha-cobro').value = hoy(); $('justificante-cobro').value = ''; }
          seleccionada = f; $('importe-cobro').value = f.importe_total.replace('.', ','); $('confirmacion-cobro').checked = false;
          $('factura-seleccionada-cobro').textContent = `${tipoVisible(f.tipo)} · Número ${f.numero_factura} · ${moneda(f.importe_total)}`;
          error(''); $('estado-cobros').textContent = 'Revisa la fecha y el justificante antes de registrar.'; mostrar('registro'); controles();
        }); tarjeta.append(boton);
      } else tarjeta.append(crear('p', 'Facturación reabierta: debe reemitirse antes de registrar cobros.'));
      return [tarjeta];
    }));
    if (!datos.facturas.length) $('tarjetas-facturas').append(crear('p', 'La facturación está en revisión. Todavía no hay facturas emitidas para cobrar.'));
    if (seleccionada && cobrada(seleccionada.id)) seleccionada = null;
    mostrar('facturas');
  };
  const consultar = async (id) => {
    try {
      render(validarProceso(await api.consultar(id), id));
      await liquidacion.cargar(proceso);
    } catch (e) {
      // Solo ante error: recuperar por GET antes de usar un detalle incompleto o antiguo.
      if (proceso) pendiente = true;
      throw e;
    }
  };
  const operar = async (texto, accion) => {
    if (ocupado || pendiente) return;
    ocupado = true; error(''); $('estado-cobros').textContent = texto; controles();
    try { await accion(); }
    catch (e) { error(e.message); $('estado-cobros').textContent = ''; }
    finally { ocupado = false; controles(); }
  };
  const liquidacion = iniciarLiquidacion({ api, ejecutar: operar, controles, fechaValida: fechaCobroValida,
    bloquear: () => { pendiente = true; $('estado-cobros').textContent = 'Resultado de liquidación pendiente de confirmar. Consulta antes de continuar.'; } });
  $('inicio-cobros').addEventListener('click', (e) => { if (ocupado || pendiente) e.preventDefault(); });
  globalThis.addEventListener?.('beforeunload', (e) => { if (ocupado || pendiente) { e.preventDefault(); e.returnValue = ''; } });
  const abrirFila = (fila) => {
    if (ocupado || pendiente) return;
    const id = fila.facturacion_id;
    if (!idValido(id)) { error('No se pudo localizar la facturación seleccionada.'); return; }
    return operar('Consultando facturas y cobros…', async () => {
      filaActual = fila;
      seleccionada = null; proceso = null; mostrar('consulta'); $('contexto-cobros').textContent = '';
      await consultar(Number(id)); conservar(id); $('estado-cobros').textContent = 'Facturas, cobros y liquidación consultados.';
    });
  };
  const clavePeriodo = (f) => `${f.anio}-${String(f.mes).padStart(2, '0')}`;
  const estadoConjunto = (f) => f.factura_precintos_cobrada && f.factura_comision_cobrada ? 'cobrada'
    : f.factura_precintos_cobrada || f.factura_comision_cobrada ? 'parcial' : 'pendiente';
  const normalizar = (s) => s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const renderListado = () => {
    const nombre = normalizar($('ayuntamiento-filtro').value), periodo = $('periodo-filtro').value;
    const estado = $('estado-cobro-filtro').value;
    const visibles = filas.filter((f) => (!nombre || normalizar(f.ayuntamiento).includes(nombre)) && (!periodo || clavePeriodo(f) === periodo)
      && (!estado || estadoConjunto(f) === estado));
    $('filas-cobros').replaceChildren(...visibles.map((f) => {
      const tr = crear('tr');
      const estadoPrecintos = f.factura_precintos_cobrada ? 'Cobrada' : 'Pendiente';
      const estadoComision = f.factura_comision_cobrada ? 'Cobrada' : 'Pendiente';
      for (const [etiqueta, texto] of [['Periodo facturado', `${String(f.mes).padStart(2, '0')}/${f.anio}`], ['Ayuntamiento', f.ayuntamiento]]) {
        const td = crear('td', texto); td.setAttribute('data-label', etiqueta); tr.append(td);
      }
      const facturas = crear('td'); facturas.setAttribute('data-label', 'Facturas municipales');
      const resumenFacturas = crear('div'); resumenFacturas.className = 'facturas-municipales';
      for (const [nombre, numero, importe, estado] of [['PRECINTOS', f.numero_factura_precintos, f.importe_precintos, estadoPrecintos],
        ['GASTOS/COMISIÓN', f.numero_factura_comision, f.importe_comision, estadoComision]]) {
        const linea = crear('p'), titulo = crear('strong', nombre), detalle = crear('span', `${moneda(importe)} · ${estado}`);
        const referencia = crear('span', typeof numero === 'string' && numero.trim() ? `Número oficial: ${numero}` : 'Sin número');
        referencia.className = 'numero-factura'; detalle.className = 'detalle-factura';
        linea.append(titulo, referencia, detalle); resumenFacturas.append(linea);
      }
      facturas.append(resumenFacturas); tr.append(facturas);
      for (const [etiqueta, texto] of [['Estado conjunto del cobro', ({ pendiente: 'Pendiente', parcial: 'Parcial', cobrada: 'Cobrada' })[estadoConjunto(f)]],
        ['Fecha prevista de liquidación a farmacias', f.fecha_prevista_liquidacion ?? 'Sin fecha prevista']]) {
        const td = crear('td', texto); td.setAttribute('data-label', etiqueta); tr.append(td);
      }
      const td = crear('td'), boton = crear('button', 'Abrir detalle'); boton.type = 'button'; boton.className = 'button button-secondary';
      td.setAttribute('data-label', 'Acción');
      boton.setAttribute('aria-label', `Abrir detalle de ${f.ayuntamiento}, ${String(f.mes).padStart(2, '0')}/${f.anio}`);
      boton.addEventListener('click', () => abrirFila(f)); td.append(boton); tr.append(td); return tr;
    }));
    $('tabla-cobros').hidden = !visibles.length;
    $('estado-listado').textContent = !filas.length ? 'Todavía no hay facturaciones emitidas.' : visibles.length
      ? `${visibles.length} de ${filas.length} facturaciones emitidas.` : 'No hay facturaciones emitidas que coincidan con los filtros.';
  };
  const cargarListado = async () => {
    $('reintentar-listado').hidden = true; $('estado-listado').textContent = 'Consultando facturaciones emitidas…';
    try {
      const datos = await api.listarEmitidas();
      if (!Array.isArray(datos) || !datos.every((f) => idValido(f.facturacion_id) && typeof f.ayuntamiento === 'string'
        && Number.isInteger(f.anio) && Number.isInteger(f.mes) && f.mes >= 1 && f.mes <= 12
        && importeValido(f.importe_precintos) && importeValido(f.importe_comision)
        && typeof f.factura_precintos_cobrada === 'boolean' && typeof f.factura_comision_cobrada === 'boolean'
        && [f.numero_factura_precintos, f.numero_factura_comision].every((n) => n == null || typeof n === 'string')
        && (f.fecha_prevista_liquidacion == null || fechaCobroValida(f.fecha_prevista_liquidacion)))) throw new Error('El listado no pudo verificarse.');
      filas = [...datos].sort((a, b) => b.anio - a.anio || b.mes - a.mes || a.ayuntamiento.toLocaleLowerCase('es').localeCompare(b.ayuntamiento.toLocaleLowerCase('es'), 'es') || a.facturacion_id - b.facturacion_id);
      const seleccionado = $('periodo-filtro').value, todos = crear('option', 'Todos los periodos'); todos.value = '';
      $('periodo-filtro').replaceChildren(todos, ...[...new Map(filas.map((f) => [clavePeriodo(f), f])).values()].map((f) => {
        const opcion = crear('option', `${String(f.mes).padStart(2, '0')}/${f.anio}`); opcion.value = clavePeriodo(f); return opcion;
      }));
      $('periodo-filtro').value = seleccionado; renderListado();
    } catch (e) { filas = []; $('filas-cobros').replaceChildren(); $('tabla-cobros').hidden = true; $('reintentar-listado').hidden = false; throw e; }
  };
  $('reintentar-listado').addEventListener('click', () => operar('Consultando listado…', cargarListado));
  for (const [id, evento] of [['ayuntamiento-filtro', 'input'], ['periodo-filtro', 'change'], ['estado-cobro-filtro', 'change']]) $(id).addEventListener(evento, () => {
    if (!ocupado && !pendiente) { conservar(); renderListado(); }
  });
  $('cambiar-facturacion-cobros').addEventListener('click', () => operar('Consultando listado…', async () => {
    mostrar('consulta'); $('contexto-cobros').textContent = ''; conservar(); await cargarListado();
  }));
  $('cancelar-cobro').addEventListener('click', () => { if (!ocupado && !pendiente) { error(''); mostrar('facturas'); $('estado-cobros').textContent = 'Cobro no enviado.'; } });
  for (const id of ['fecha-cobro', 'justificante-cobro']) $(id).addEventListener('input', () => { $('confirmacion-cobro').checked = false; controles(); });
  $('confirmacion-cobro').addEventListener('input', controles);
  $('formulario-registro-cobro').addEventListener('submit', (e) => {
    e.preventDefault(); if (ocupado || pendiente || paso !== 'registro' || !seleccionada) return;
    if (proceso.estado !== 'EMITIDA' || cobrada(seleccionada.id)) { error('Esta factura no admite otro cobro.'); return; }
    if ($('importe-cobro').value !== seleccionada.importe_total.replace('.', ',')) { error('El importe debe coincidir con el total de la factura.'); return; }
    if (!fechaCobroValida($('fecha-cobro').value) || !$('confirmacion-cobro').checked) { error('Introduce una fecha válida y confirma el cobro completo.'); return; }
    const datos = { fecha_cobro: $('fecha-cobro').value, importe_cobrado: seleccionada.importe_total,
      justificante: $('justificante-cobro').value.trim() || null };
    return operar('Registrando cobro completo…', async () => {
      try {
        const c = await api.cobrar(proceso.facturacion_id, seleccionada.id, datos);
        if (!c || !idValido(c.id) || c.factura_id !== seleccionada.id || c.importe_cobrado !== datos.importe_cobrado
          || c.fecha_cobro !== datos.fecha_cobro || (c.justificante != null && typeof c.justificante !== 'string')) {
          throw new apiDefecto.ErrorFacturacion('La respuesta del cobro no pudo confirmarse.');
        }
        render({ ...proceso, cobros: [...proceso.cobros, c] });
        $('estado-cobros').textContent = 'Cobro completo registrado. La reapertura de toda la facturación queda bloqueada.';
        // El cobro ya está confirmado; un fallo de esta consulta no lo deshace.
        try { await liquidacion.cargar(proceso); } catch (e) { pendiente = true; error(e.message); }
      } catch (err) {
        if (err.incierto || err.estado === 409) {
          pendiente = true; error(err.message); $('estado-cobros').textContent = err.incierto
            ? 'Resultado del cobro pendiente de confirmar. Consulta antes de repetir.' : 'El estado ha cambiado. Consulta antes de continuar.';
        } else throw err;
      }
    });
  });
  $('recuperar-cobro').addEventListener('click', async () => {
    if (ocupado || !pendiente) return;
    ocupado = true; error(''); controles(); $('estado-cobros').textContent = 'Consultando estado de cobros y liquidación…';
    try {
      await consultar(proceso.facturacion_id); pendiente = false;
      $('estado-cobros').textContent = 'Estado consultado. Revisa los cobros y la liquidación antes de continuar.';
    } catch (e) { error(e.message); $('estado-cobros').textContent = 'Estado todavía pendiente de confirmar.'; }
    finally { ocupado = false; controles(); }
  });
  controles();
  globalThis.addEventListener?.('pageshow', (e) => { if (e.persisted) return operar('Consultando estado actual…', async () => {
    try { await cargarListado(); if (paso !== 'consulta' && proceso) await consultar(proceso.facturacion_id); }
    catch (e) { if (paso !== 'consulta' && proceso) pendiente = true; throw e; }
  }); });
  return operar('Consultando facturaciones emitidas…', async () => {
    await cargarListado();
    if (referencia != null) {
      const fila = filas.find((f) => f.facturacion_id === Number(referencia));
      if (!fila) throw new Error('La facturación no figura entre las emitidas. Selecciona una facturación del listado.');
      filaActual = fila; await consultar(fila.facturacion_id); conservar(fila.facturacion_id);
    }
  });
};
if (typeof document !== 'undefined') void iniciarCobros();
