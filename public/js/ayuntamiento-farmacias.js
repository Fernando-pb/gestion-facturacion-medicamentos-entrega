import { mostrarMensaje, agregarCeldas, terminoBusquedaValido, iniciarPanelBusqueda } from './gestion-municipal-ui.js';
import * as apiMunicipal from './ayuntamientos-api.js';

// Solo consume la proyección municipal: no consulta maestros de Farmacias.
export const iniciarFarmaciasMunicipales = ({ documento, api = apiMunicipal, alCerrar = () => {}, alVolverListado, alCambiarBloqueo = () => {}, alIniciarTarea = () => {} }) => {
  const el = (id) => documento.getElementById(id);
  const ficha = el('ficha-ayuntamiento');
  let municipio = null;
  let contexto = 0;
  let lecturaLista = 0;
  let lecturaBusqueda = 0;
  let enviando = false;
  let bloqueoExterno = false;
  const ocupada = () => enviando || bloqueoExterno;
  let parametrosBusqueda = null;
  let seleccion = null;
  let panelBusqueda;
  let origenFoco = null;
  let focoSeleccion = null;
  const botonesFilas = { lista: [], busqueda: [] };
  const controles = ['cerrar-ficha', 'recargar-farmacias', 'farmacias-campo', 'farmacias-modo',
    'farmacias-q', 'buscar-farmacias-boton', 'confirmar-farmacia', 'cancelar-farmacia',
    'abrir-busqueda-farmacias', 'cerrar-busqueda-farmacias'];

  const mensaje = (id, texto, error = false) => {
    mostrarMensaje(el(id), texto, { error, clase: id === 'mensaje-farmacias' ? 'form-status' : 'list-status' });
  };
  const cancelar = (restaurar = true) => {
    seleccion = null;
    el('confirmacion-farmacia').hidden = true;
    panelBusqueda?.reanudar();
    if (restaurar) focoSeleccion?.focus();
  };
  const actualizarControles = () => {
    const valor = ocupada();
    for (const id of controles) el(id).disabled = valor;
    for (const boton of [...botonesFilas.lista, ...botonesFilas.busqueda]) boton.disabled = valor;
    el('confirmacion-farmacia').setAttribute('aria-busy', String(valor));
  };
  const bloquear = (valor) => {
    enviando = valor;
    actualizarControles();
    alCambiarBloqueo(valor);
  };
  const bloquearExterno = (valor) => { bloqueoExterno = valor; actualizarControles(); };
  const seleccionar = (farmacia, retirar, boton) => {
    if (ocupada()) return;
    alIniciarTarea();
    if (retirar) panelBusqueda.cerrar(false);
    cancelar(false);
    if (!retirar && farmacia.ayuntamiento_id === municipio.id) {
      mensaje('mensaje-farmacias', 'La farmacia ya está asociada a este Ayuntamiento.');
      return;
    }
    mensaje('mensaje-farmacias', '');
    seleccion = { farmacia, retirar };
    focoSeleccion = boton;
    const nombre = `${farmacia.denominacion} (SOE ${farmacia.soe})`;
    el('texto-confirmacion-farmacia').textContent = retirar
      ? `Quitar definitivamente la asignación de ${nombre} a ${municipio.denominacion}. Se conserva la farmacia y queda sin Ayuntamiento. Puedes cancelar.`
      : `Trasladar ${nombre} desde ${farmacia.ayuntamiento_denominacion} a ${municipio.denominacion}. Puedes cancelar.`;
    el('confirmacion-farmacia').hidden = false;
    panelBusqueda.suspender();
    el('confirmar-farmacia').focus();
  };
  const crearFila = (farmacia, busqueda) => {
    const fila = documento.createElement('tr');
    const campos = ['soe', 'denominacion', 'localidad', 'cuenta_bancaria_enmascarada'];
    agregarCeldas(documento, fila, farmacia, campos);
    if (busqueda) {
      const celda = documento.createElement('td');
      celda.textContent = farmacia.ayuntamiento_denominacion ?? 'Sin Ayuntamiento';
      fila.append(celda);
    }
    const acciones = documento.createElement('td');
    if (busqueda && farmacia.ayuntamiento_id === municipio.id) {
      acciones.textContent = 'Ya asociada';
      fila.append(acciones);
      return fila;
    }
    const boton = documento.createElement('button');
    boton.type = 'button';
    boton.className = 'button button-secondary';
    boton.textContent = busqueda ? farmacia.ayuntamiento_id === null ? 'Asignar' : 'Trasladar' : 'Quitar';
    boton.disabled = ocupada();
    boton.setAttribute('aria-label', `${boton.textContent} ${farmacia.denominacion} (SOE ${farmacia.soe})`);
    boton.addEventListener('click', () => {
      if (ocupada()) return;
      if (busqueda && farmacia.ayuntamiento_id === null) return ejecutarOperacion(farmacia, false);
      seleccionar(farmacia, !busqueda, boton);
    });
    botonesFilas[busqueda ? 'busqueda' : 'lista'].push(boton);
    acciones.append(boton);
    fila.append(acciones);
    return fila;
  };
  const pintar = (datos, busqueda) => {
    if (!Array.isArray(datos)) throw new Error('La API devolvió un listado no válido.');
    botonesFilas[busqueda ? 'busqueda' : 'lista'] = [];
    const tabla = el(busqueda ? 'tabla-busqueda-farmacias' : 'tabla-asociadas');
    el(busqueda ? 'filas-busqueda-farmacias' : 'filas-asociadas').replaceChildren(
      ...datos.map((farmacia) => crearFila(farmacia, busqueda)),
    );
    tabla.hidden = datos.length === 0;
    mensaje(busqueda ? 'estado-busqueda-farmacias' : 'estado-asociadas', datos.length
      ? `${datos.length} farmacias ${busqueda ? 'encontradas' : 'asociadas'}.`
      : busqueda ? 'No se encontraron farmacias.' : 'No hay farmacias asociadas a este Ayuntamiento.');
  };
  const cargarLista = async () => {
    const actual = contexto;
    const lectura = ++lecturaLista;
    el('recargar-farmacias').hidden = true;
    const tabla = el('tabla-asociadas');
    tabla.hidden = true;
    tabla.setAttribute('aria-busy', 'true');
    el('filas-asociadas').replaceChildren();
    mensaje('estado-asociadas', 'Cargando farmacias asociadas…');
    try {
      const datos = await api.listarFarmaciasAsociadas(municipio.id);
      if (actual !== contexto || lectura !== lecturaLista) return;
      pintar(datos, false);
    } catch (error) {
      if (actual === contexto && lectura === lecturaLista) { el('recargar-farmacias').hidden = false; mensaje('estado-asociadas', `No se pudo cargar la lista. ${error.message}`, true); }
    } finally {
      if (actual === contexto && lectura === lecturaLista) tabla.setAttribute('aria-busy', 'false');
    }
  };
  const buscar = async (parametros) => {
    const actual = contexto;
    const lectura = ++lecturaBusqueda;
    parametrosBusqueda = { ...parametros };
    panelBusqueda.limpiarSeleccion();
    cancelar(false);
    const tabla = el('tabla-busqueda-farmacias');
    tabla.hidden = true;
    tabla.setAttribute('aria-busy', 'true');
    el('filas-busqueda-farmacias').replaceChildren();
    mensaje('estado-busqueda-farmacias', 'Buscando farmacias…');
    try {
      const datos = await api.buscarFarmacias(municipio.id, parametros);
      if (actual !== contexto || lectura !== lecturaBusqueda) return;
      pintar(datos, true);
    } catch (error) {
      if (actual === contexto && lectura === lecturaBusqueda) mensaje('estado-busqueda-farmacias', `No se pudo buscar. ${error.message}`, true);
    } finally {
      if (actual === contexto && lectura === lecturaBusqueda) tabla.setAttribute('aria-busy', 'false');
    }
  };
  const refrescar = async () => {
    await Promise.all([cargarLista(), parametrosBusqueda ? buscar(parametrosBusqueda) : Promise.resolve()]);
  };
  panelBusqueda = iniciarPanelBusqueda({ documento, tipo: 'farmacias', ocupada, conSeleccion: false,
    alAbrir: () => { alIniciarTarea(); cancelar(false); mensaje('mensaje-farmacias', ''); },
    alCerrar: () => {
      ++lecturaBusqueda;
      parametrosBusqueda = null;
      cancelar(false);
      el('tabla-busqueda-farmacias').hidden = true;
      el('tabla-busqueda-farmacias').setAttribute('aria-busy', 'false');
      el('filas-busqueda-farmacias').replaceChildren();
      mensaje('estado-busqueda-farmacias', 'Busca por SOE o denominación.');
    },
  });
  const cerrarTarea = () => { if (!ocupada()) { panelBusqueda.cerrar(false); cancelar(false); } };
  el('buscar-farmacias').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (ocupada() || !municipio || !panelBusqueda.abierta) return;
    mensaje('mensaje-farmacias', '');
    const q = el('farmacias-q').value.trim();
    if (!terminoBusquedaValido(q)) {
      panelBusqueda.limpiarSeleccion();
      ++lecturaBusqueda;
      cancelar(false);
      parametrosBusqueda = null;
      el('tabla-busqueda-farmacias').hidden = true;
      el('tabla-busqueda-farmacias').setAttribute('aria-busy', 'false');
      el('filas-busqueda-farmacias').replaceChildren();
      mensaje('estado-busqueda-farmacias', 'Introduce un término de entre 1 y 200 caracteres.', true);
      return;
    }
    await buscar({ campo: el('farmacias-campo').value, modo: el('farmacias-modo').value, q });
  });
  const ejecutarOperacion = async (farmacia, retirar) => {
    if (ocupada()) return;
    // Invalida lecturas pendientes antes de modificar y conserva el origen observado.
    ++lecturaLista;
    ++lecturaBusqueda;
    bloquear(true);
    mensaje('mensaje-farmacias', 'Guardando asignación…');
    try {
      if (retirar) await api.quitarFarmacia(municipio.id, farmacia.farmacia_id);
      else await api.asignarFarmacia(municipio.id, {
        farmacia_id: farmacia.farmacia_id, ayuntamiento_origen_id: farmacia.ayuntamiento_id,
      });
      cancelar(false);
      mensaje('mensaje-farmacias', retirar ? 'Asignación retirada. La farmacia se conserva sin Ayuntamiento.' : 'Farmacia asociada correctamente.');
      panelBusqueda.volverLista();
      await cargarLista();
    } catch (error) {
      cancelar(false);
      mensaje('mensaje-farmacias', `${error.message} Consulta los resultados actualizados antes de volver a intentarlo.`, true);
      // También refresca ante rechazo: un conflicto no se reintenta con un origen antiguo.
      await refrescar();
    } finally {
      bloquear(false);
      el('mensaje-farmacias').focus();
    }
  };
  el('confirmar-farmacia').addEventListener('click', () => {
    if (ocupada() || !seleccion) return;
    return ejecutarOperacion(seleccion.farmacia, seleccion.retirar);
  });
  el('cancelar-farmacia').addEventListener('click', () => {
    if (ocupada()) return;
    const retirar = seleccion?.retirar;
    cancelar(false);
    panelBusqueda.cerrar(false);
    if (retirar) focoSeleccion?.focus();
    else el('abrir-busqueda-farmacias').focus();
  });
  el('recargar-farmacias').addEventListener('click', async () => {
    if (!ocupada()) { cancelar(false); await refrescar(); }
  });
  const cerrar = () => {
    if (ocupada()) return;
    ++contexto;
    cerrarTarea();
    cancelar(false);
    municipio = null;
    ficha.hidden = true;
    alCerrar();
  };
  el('cerrar-ficha').addEventListener('click', () => {
    if (ocupada()) return;
    cerrar();
    if (alVolverListado) alVolverListado();
    else origenFoco?.focus();
  });
  const abrir = async (ayuntamiento, boton, { cargar = true } = {}) => {
    if (ocupada()) return;
    ++contexto;
    cerrarTarea();
    municipio = ayuntamiento;
    origenFoco = boton;
    parametrosBusqueda = null;
    botonesFilas.lista = [];
    botonesFilas.busqueda = [];
    cancelar(false);
    mensaje('mensaje-farmacias', '');
    mensaje('estado-busqueda-farmacias', 'Busca por SOE o denominación.');
    el('tabla-busqueda-farmacias').hidden = true;
    el('filas-busqueda-farmacias').replaceChildren();
    el('farmacias-q').value = '';
    el('farmacias-campo').value = 'soe';
    el('farmacias-modo').value = 'exacto';
    el('nombre-ficha').textContent = ayuntamiento.denominacion;
    ficha.hidden = false;
    el('cerrar-ficha').focus();
    if (cargar) await cargarLista();
  };
  const desactivar = () => {
    if (ocupada()) return;
    ++contexto;
    ++lecturaLista;
    cerrarTarea();
  };
  const activar = async () => {
    if (ocupada() || !municipio) return;
    cerrarTarea();
    await cargarLista();
  };
  return { abrir, cerrar, activar, desactivar, cerrarTarea, bloquearExterno, get ocupada() { return ocupada(); } };
};
