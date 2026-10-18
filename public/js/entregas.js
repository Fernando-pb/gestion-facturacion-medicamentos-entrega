import * as entregasApi from './entregas-api.js';
import { normalizarDecimal, formatoMonetario, configurarCampoMonetario } from './decimales.js';
import { iniciarLecturas } from './entregas-lecturas.js';
import { iniciarListado } from './entregas-listado.js';

export const leerDeclarados = (cantidad, importe) => {
  if (cantidad !== '' && (!/^\d+$/.test(cantidad) || Number(cantidad) > 2147483647)) {
    throw new Error('La cantidad debe ser un entero entre 0 y 2147483647, o quedar vacía.');
  }
  const importeNormalizado = normalizarDecimal(importe, { decimales: 2, cifrasEnteras: 10, nullable: true });
  return { precintos_informados: cantidad === '' ? null : Number(cantidad), importe_informado: importeNormalizado };
};

export const iniciarInterfaz = ({ api = entregasApi } = {}) => {
  const $ = (id) => document.getElementById(id);
  for (const id of ['importe-inicial', 'importe-editado']) configurarCampoMonetario($(id), { nullable: true });
  let seleccionada = null, farmaciaAnteriorSelector = null, resultados = [], entrega = null, pareja = null;
  let ocupado = false, incierto = false, lecturaBloqueada = false, generacion = 0, resumenGeneracion = 0, buscando = false, temporizador, activo = -1;
  const mostrar = (texto, error = false) => {
    $('estado').textContent = texto;
    $('estado').className = `operation-message${error ? ' message-error' : ''}`;
    $('estado').setAttribute('role', error ? 'alert' : 'status');
  };
  const errorTexto = (error) => error.estado === 409 ? `Conflicto: ${error.message}`
    : error.estado === 400 ? `Datos no válidos: ${error.message}` : error.message;
  const farmaciaActual = () => seleccionada;
  const fechaValida = () => /^\d+$/.test($('mes').value) && Number($('mes').value) >= 1 && Number($('mes').value) <= 12
    && /^\d+$/.test($('anio').value) && Number($('anio').value) >= 1 && Number($('anio').value) <= 2147483647;
  const bloquear = () => {
    for (const id of ['mes', 'anio', 'busqueda', 'seleccionar-farmacia', 'cancelar-selector-farmacias', 'cantidad-inicial', 'importe-inicial',
      'cantidad-editada', 'importe-editado', 'volver-seleccion', 'editar', 'cancelar-edicion', 'reintentar-resumen', 'reintentar-carga', 'consultar-guardado']) $(id).disabled = ocupado;
    for (const id of ['crear-entrega', 'cancelar-alta', 'periodo-listado', 'actualizar-listado']) $(id).disabled = ocupado || incierto || lecturaBloqueada;
    for (const id of ['mes', 'anio', 'busqueda', 'seleccionar-farmacia', 'cancelar-selector-farmacias']) $(id).disabled = ocupado || incierto;
    for (const id of ['volver-seleccion', 'editar']) $(id).disabled = ocupado || incierto;
    $('reintentar-carga').disabled = ocupado || incierto;
    const farmacia = farmaciaActual();
    const sinAyuntamiento = Boolean(farmacia && !farmacia.ayuntamiento_id);
    $('aviso-ayuntamiento').hidden = !sinAyuntamiento;
    $('aviso-ayuntamiento').textContent = sinAyuntamiento
      ? 'Esta farmacia no tiene Ayuntamiento asignado. Debes asignarlo desde la gestión de Ayuntamientos antes de abrir una entrega' : '';
    const motivo = ocupado ? 'Hay una operación en curso. Espera a que termine.'
        : incierto ? 'Consulta el resultado del guardado antes de repetir.'
            : !fechaValida() ? 'Selecciona un mes entre 1 y 12 y un año entero entre 1 y 2147483647.'
              : !farmacia ? 'Selecciona una farmacia del listado de resultados.'
                : !farmacia.ayuntamiento_id ? 'Esta farmacia no tiene Ayuntamiento. Asígnalo desde Ayuntamientos antes de abrir una entrega.' : '';
    $('abrir').disabled = motivo !== '';
    $('abrir').setAttribute('aria-busy', String(ocupado));
    $('estado-apertura').textContent = sinAyuntamiento && !ocupado && !incierto ? ''
      : motivo || 'Puedes abrir la entrega. Si el periodo no existe, se creará al abrirla.';
    $('guardar').disabled = ocupado || incierto;
    $('registrar-precintos').disabled = ocupado || incierto || lecturaBloqueada;
    $('seleccion').setAttribute('aria-busy', String(ocupado));
    $('detalle').setAttribute('aria-busy', String(ocupado));
  };
  const cambioSeleccion = () => {
    if (ocupado) return;
    const farm = farmaciaActual();
    $('farmacia-vacia').hidden = Boolean(farm);
    $('seleccionar-farmacia').textContent = farm ? 'Cambiar farmacia' : 'Seleccionar farmacia';
    $('aviso-periodo').textContent = fechaValida() ? 'El periodo se crea al abrir la entrega si todavía no existe.' : 'Selecciona un mes entre 1 y 12 y un año entero entre 1 y 2147483647.';
    bloquear();
  };
  const cerrarResultados = () => {
    $('resultados-farmacias').hidden = true; $('busqueda').setAttribute('aria-expanded', 'false');
    $('busqueda').setAttribute('aria-activedescendant', ''); activo = -1;
  };
  const seleccionar = (farmacia) => {
    if (ocupado || incierto) return;
    ++generacion; clearTimeout(temporizador); buscando = false; seleccionada = farmacia;
    farmaciaAnteriorSelector = null;
    $('farmacia-seleccionada').textContent = `SOE ${farmacia.soe} — ${farmacia.denominacion}${farmacia.ayuntamiento_id ? ` · Ayuntamiento: ${farmacia.ayuntamiento_denominacion}` : ''}`;
    $('farmacia-seleccionada').hidden = false;
    $('estado-busqueda').textContent = 'Farmacia seleccionada.';
    $('reintentar-carga').hidden = true; cerrarResultados();
    $('selector-farmacias').hidden = true; $('seleccion').hidden = false;
    cambioSeleccion(); $('titulo-seleccion').focus();
  };
  const buscar = async (exacto = false) => {
    if (ocupado || incierto) return;
    clearTimeout(temporizador);
    const texto = $('busqueda').value.trim(), actual = ++generacion;
    cerrarResultados(); resultados = []; buscando = false;
    if (!texto) { $('estado-busqueda').textContent = 'Escribe un SOE o nombre.'; return; }
    buscando = true; $('estado-busqueda').textContent = 'Buscando farmacias…'; $('reintentar-carga').hidden = true;
    try {
      const lista = await api.buscarFarmacias(texto);
      if (actual !== generacion) return;
      resultados = [...new Map(lista.map((farmacia) => [farmacia.id, farmacia])).values()];
      const coincidencias = resultados.filter((farmacia) => farmacia.soe.toLocaleLowerCase('es') === texto.toLocaleLowerCase('es'));
      if (exacto && coincidencias.length === 1) { seleccionar(coincidencias[0]); return; }
      $('resultados-farmacias').replaceChildren(...resultados.map((farmacia, index) => {
        const li = document.createElement('li'); li.id = `farmacia-resultado-${index}`;
        li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false');
        li.textContent = `${farmacia.soe} — ${farmacia.denominacion} · ${farmacia.localidad} · ${farmacia.ayuntamiento_denominacion ?? 'Sin Ayuntamiento'}`;
        li.addEventListener('click', () => seleccionar(farmacia)); return li;
      }));
      $('resultados-farmacias').hidden = resultados.length === 0;
      $('busqueda').setAttribute('aria-expanded', String(resultados.length > 0));
      $('estado-busqueda').textContent = resultados.length ? `${resultados.length} coincidencias. Selecciona una con clic o flechas y Enter.` : 'Sin coincidencias.';
    } catch (error) {
      if (actual !== generacion) return;
      $('estado-busqueda').textContent = `No se pudo buscar. ${errorTexto(error)}`; $('reintentar-carga').hidden = false;
    } finally { if (actual === generacion) buscando = false; }
  };
  const invalidar = () => {
    ++generacion; clearTimeout(temporizador); buscando = false; seleccionada = null; resultados = [];
    $('farmacia-seleccionada').hidden = true; $('farmacia-seleccionada').textContent = '';
    $('reintentar-carga').hidden = true;
    cerrarResultados(); cambioSeleccion();
  };
  $('busqueda').addEventListener('input', () => {
    if (ocupado || incierto) return;
    ++generacion; clearTimeout(temporizador); resultados = []; $('resultados-farmacias').replaceChildren();
    $('estado-busqueda').textContent = $('busqueda').value.trim() ? 'Esperando para buscar…' : 'Escribe un SOE o nombre.';
    if ($('busqueda').value.trim()) temporizador = setTimeout(() => void buscar(), 250);
  });
  $('busqueda').addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault(); event.stopPropagation?.();
      if (ocupado || incierto) return;
      if (activo >= 0 && !$('resultados-farmacias').hidden) seleccionar(resultados[activo]);
      else await buscar(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!resultados.length || buscando || ocupado || incierto) return;
      $('resultados-farmacias').hidden = false; $('busqueda').setAttribute('aria-expanded', 'true');
      activo = event.key === 'ArrowDown' ? (activo + 1) % resultados.length : (activo <= 0 ? resultados.length - 1 : activo - 1);
      for (let i = 0; i < $('resultados-farmacias').children.length; i++) $('resultados-farmacias').children[i].setAttribute('aria-selected', String(i === activo));
      $('busqueda').setAttribute('aria-activedescendant', `farmacia-resultado-${activo}`);
      $('resultados-farmacias').children[activo].scrollIntoView?.({ block: 'nearest' });
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      ++generacion; clearTimeout(temporizador); buscando = false; cerrarResultados();
    }
  });
  const abrirSelectorFarmacias = () => {
    if (ocupado || incierto) return;
    farmaciaAnteriorSelector = seleccionada; seleccionada = null;
    ++generacion; clearTimeout(temporizador); buscando = false; resultados = [];
    $('busqueda').value = ''; $('resultados-farmacias').replaceChildren(); $('reintentar-carga').hidden = true;
    cerrarResultados(); $('estado-busqueda').textContent = 'Escribe un SOE o nombre.';
    $('seleccion').hidden = true; $('selector-farmacias').hidden = false;
    $('volver-inicio').hidden = true; cambioSeleccion(); $('titulo-selector-farmacias').focus(); $('busqueda').focus();
  };
  $('seleccionar-farmacia').addEventListener('click', abrirSelectorFarmacias);
  $('cancelar-selector-farmacias').addEventListener('click', () => {
    ++generacion; clearTimeout(temporizador); buscando = false; cerrarResultados();
    seleccionada = farmaciaAnteriorSelector; farmaciaAnteriorSelector = null;
    $('selector-farmacias').hidden = true; $('seleccion').hidden = false;
    cambioSeleccion(); $('seleccionar-farmacia').focus();
  });
  const renderEntrega = () => {
    $('contexto').textContent = `Periodo ${String(entrega.mes).padStart(2, '0')}/${entrega.anio} · SOE ${farmaciaActual()?.soe ?? 'No disponible'} · Farmacia #${entrega.farmacia_id}: ${entrega.denominacion_farmacia} · Ayuntamiento: ${entrega.ayuntamiento_denominacion ?? 'Sin Ayuntamiento'}`;
    $('nombre-historico').textContent = entrega.denominacion_farmacia;
    $('cif-historico').textContent = entrega.cif_nif_farmacia;
    $('cantidad-guardada').textContent = entrega.precintos_informados ?? 'Sin informar';
    $('importe-guardado').textContent = entrega.importe_informado ?? 'Sin informar';
  };
  const refrescar = async () => {
    if (!entrega) return;
    const actual = ++resumenGeneracion, id = entrega.id;
    $('estado-resumen').textContent = 'Cargando resumen…'; $('reintentar-resumen').hidden = true;
    // No presentar totales anteriores como si correspondieran a esta consulta.
    $('totales').replaceChildren(); $('paquetes').replaceChildren(); $('sin-paquetes').hidden = true; $('tabla-paquetes').hidden = true;
    try {
      const r = await api.consultarResumen(id);
      if (actual !== resumenGeneracion || entrega?.id !== id) return;
      $('aptos-entrega').textContent = r.admitidos;
      $('importe-entrega').textContent = `${formatoMonetario(r.subtotal_facturable)} €`;
      const campos = [ ['Incidencias', r.incidencias], ['Total registrado', r.total_registrado],
        ['Importe facturable (€)', r.subtotal_facturable], ['Diferencia de cantidad (registrado − declarado)', r.diferencia_cantidad],
        ['Diferencia de importe (€; facturable − declarado)', r.diferencia_importe] ];
      $('totales').replaceChildren(...campos.map(([label, value]) => {
        const div = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = label; dd.textContent = value ?? 'Sin informar'; div.append(dt, dd); return div;
      }));
      $('paquetes').replaceChildren(...r.paquetes.map((p) => {
        const tr = document.createElement('tr');
        for (const value of [p.numero_paquete, p.precintos, p.subtotal_facturable]) {
          const td = document.createElement('td'); td.textContent = value; tr.append(td);
        } return tr;
      }));
      $('tabla-paquetes').hidden = !(r.admitidos > 0);
      $('sin-paquetes').hidden = r.admitidos !== 0; $('estado-resumen').textContent = ''; $('reintentar-resumen').hidden = true;
    } catch (error) {
      if (actual !== resumenGeneracion || entrega?.id !== id) return;
      $('estado-resumen').textContent = `No se pudo obtener el resumen. ${errorTexto(error)}`; $('reintentar-resumen').hidden = false;
    }
  };
  const abrirDetalle = () => {
    $('volver-inicio').hidden = true;
    $('listado-entregas').hidden = true;
    $('seleccion').hidden = true; $('detalle').hidden = false; $('formulario-declarados').hidden = true;
    $('control-entrega').open = false;
    renderEntrega(); $('titulo-detalle').focus();
  };
  const editar = (valores = entrega) => {
    $('control-entrega').open = true;
    $('cantidad-editada').value = valores.precintos_informados === null ? '' : String(valores.precintos_informados);
    $('importe-editado').value = formatoMonetario(valores.importe_informado);
    $('formulario-declarados').hidden = false; $('cantidad-editada').focus();
  };
  const falloEscritura = (error) => {
    incierto = error.incierto === true || error.estado >= 500;
    $('consultar-guardado').hidden = !incierto;
    mostrar(`${errorTexto(error)}${incierto ? ' El guardado pudo completarse. Consulta antes de repetir; no se reintentará automáticamente.' : ''}`, true);
  };
  $('formulario-seleccion').addEventListener('submit', async (event) => {
    event.preventDefault(); if (event.target === $('busqueda') || event.submitter == null && document.activeElement === $('busqueda') || $('abrir').disabled || ocupado) return;
    let declarados;
    try { declarados = leerDeclarados($('cantidad-inicial').value, $('importe-inicial').value); }
    catch (error) { mostrar(error.message, true); return; }
    pareja = { farmacia_id: farmaciaActual().id, mes: Number($('mes').value), anio: Number($('anio').value) };
    entrega = null;
    ocupado = true; bloquear(); mostrar('Guardando… Creando entrega.');
    try {
      const respuesta = await api.abrirEntrega(pareja);
      entrega = respuesta.datos; abrirDetalle();
      if (respuesta.estado === 201) {
        // PUT separado: nunca aplicado automáticamente a una entrega recuperada.
        editar(declarados); mostrar('Entrega creada. Guardando… Declarados iniciales.');
        entrega = await api.guardarDeclarados(entrega.id, declarados);
        renderEntrega(); $('formulario-declarados').hidden = true;
      }
      mostrar(respuesta.estado === 201 ? 'Guardado. Entrega creada y declarados guardados.' : 'La entrega ya existía. Se muestran sus valores guardados; no se ha creado otra ni guardado los datos iniciales.');
      $('titulo-detalle').focus();
      await refrescar();
    } catch (error) { falloEscritura(error); if (entrega) { mostrar(`Entrega creada. ${$('estado').textContent}`, true); await refrescar(); } }
    finally { ocupado = false; bloquear(); }
  });
  $('formulario-declarados').addEventListener('submit', async (event) => {
    event.preventDefault(); if (ocupado || incierto || !entrega) return;
    let valores;
    try { valores = leerDeclarados($('cantidad-editada').value, $('importe-editado').value); }
    catch (error) { mostrar(error.message, true); return; }
    ocupado = true; bloquear(); ++resumenGeneracion; mostrar('Guardando… Declarados.');
    try {
      entrega = await api.guardarDeclarados(entrega.id, valores); renderEntrega();
      $('formulario-declarados').hidden = true; mostrar('Guardado. Declarados guardados.');
      await refrescar();
    } catch (error) { falloEscritura(error); }
    finally { ocupado = false; bloquear(); if ($('formulario-declarados').hidden) $('editar').focus(); }
  });
  $('consultar-guardado').addEventListener('click', async () => {
    if (ocupado || !pareja) return;
    ocupado = true; bloquear(); mostrar('Consultando datos guardados…');
    try {
      const recuperada = await api.consultarEntrega(pareja);
      const yaDetalle = !$('detalle').hidden;
      entrega = recuperada;
      if (!yaDetalle) abrirDetalle(); else renderEntrega();
      incierto = false; $('consultar-guardado').hidden = true;
      mostrar('Datos guardados consultados. Revisa los valores antes de decidir si necesitas editar.');
      await refrescar();
    } catch (error) {
      if (error.estado === 404) { incierto = false; $('consultar-guardado').hidden = true; mostrar('No existe una entrega para esta selección. Puedes volver a abrirla.'); }
      else mostrar(errorTexto(error), true);
    } finally { ocupado = false; bloquear(); }
  });
  $('editar').addEventListener('click', () => { if (!ocupado && !incierto) editar(); });
  $('cancelar-edicion').addEventListener('click', () => { if (!ocupado) { $('formulario-declarados').hidden = true; $('editar').focus(); } });
  $('volver-seleccion').addEventListener('click', () => {
    if (ocupado || incierto) return;
    return volverListado();
  });
  const puedeNavegar = () => !ocupado && !incierto && !lecturaBloqueada;
  const listado = iniciarListado({ api, puedeNavegar, alAbrir: async (fila) => {
    pareja = { farmacia_id: fila.farmacia_id, periodo_id: fila.periodo_id };
    ocupado = true; bloquear(); mostrar('Consultando entrega…');
    try {
      const recuperada = await api.consultarEntrega(pareja);
      seleccionada = { soe: fila.soe }; entrega = recuperada;
      abrirDetalle(); mostrar(''); await refrescar();
    } catch (error) { mostrar(errorTexto(error), true); }
    finally { ocupado = false; bloquear(); }
  } });
  const volverListado = async () => {
    ++resumenGeneracion; entrega = null; $('detalle').hidden = true; $('seleccion').hidden = true; $('selector-farmacias').hidden = true;
    $('listado-entregas').hidden = false; $('volver-inicio').hidden = false;
    mostrar(''); bloquear(); $('titulo-listado-entregas').focus(); await listado.cargar();
  };
  $('cancelar-alta').addEventListener('click', () => { if (puedeNavegar()) return volverListado(); });
  $('crear-entrega').addEventListener('click', () => {
    if (!puedeNavegar()) return;
    entrega = null; pareja = null; invalidar(); $('busqueda').value = '';
    $('cantidad-inicial').value = ''; $('importe-inicial').value = '';
    $('volver-inicio').hidden = true;
    $('detalle').hidden = true; $('listado-entregas').hidden = true; $('selector-farmacias').hidden = true; $('seleccion').hidden = false;
    mostrar('Datos iniciales sin guardar. Pulsa «Crear entrega» para guardarlos.'); $('titulo-seleccion').focus();
  });
  const lecturas = iniciarLecturas({ api,
    alBloquear: (valor) => { lecturaBloqueada = valor; bloquear(); },
    alVolver: async () => { abrirDetalle(); await refrescar(); },
  });
  $('registrar-precintos').addEventListener('click', () => {
    if (ocupado || incierto || lecturaBloqueada || !entrega) return;
    mostrar('');
    return lecturas.abrir({ ...entrega, soe: farmaciaActual()?.soe ?? 'No disponible' });
  });
  globalThis.addEventListener?.('beforeunload', (event) => { if (ocupado || lecturaBloqueada) { event.preventDefault(); event.returnValue = ''; } });
  for (const id of ['mes', 'anio']) $(id).addEventListener('change', cambioSeleccion);
  $('anio').addEventListener('input', cambioSeleccion);
  $('reintentar-carga').addEventListener('click', () => buscar());
  $('reintentar-resumen').addEventListener('click', () => { if (!ocupado) return refrescar(); });
  $('mes').value = String(new Date().getMonth() + 1); $('anio').value = String(new Date().getFullYear());
  cambioSeleccion();
  $('seleccion').hidden = true;
  void listado.cargar();
};

if (typeof document !== 'undefined') iniciarInterfaz();
