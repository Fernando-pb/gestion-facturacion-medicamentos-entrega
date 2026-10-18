import * as apiMunicipal from './ayuntamientos-api.js';
import { mostrarMensaje, agregarCeldas, terminoBusquedaValido, iniciarPanelBusqueda } from './gestion-municipal-ui.js';

export const iniciarMedicamentosMunicipales = ({ documento, api = apiMunicipal, alCambiarBloqueo = () => {}, alIniciarTarea = () => {} }) => {
  const el = (id) => documento.getElementById(id);
  let municipio = null;
  let contexto = 0;
  let lecturaLista = 0;
  let lecturaBusqueda = 0;
  let enviando = false;
  let bloqueoExterno = false;
  let parametrosBusqueda = null;
  let seleccion = null;
  let resultadoSeleccionado = null;
  let panelBusqueda;
  let focoSeleccion = null;
  const botones = { lista: [], busqueda: [] };
  const asociados = new Set();
  const ocupada = () => enviando || bloqueoExterno;
  const controles = ['editar-modalidad', 'recargar-medicamentos', 'medicamentos-campo', 'medicamentos-modo',
    'medicamentos-q', 'buscar-medicamentos-boton', 'confirmar-medicamento', 'cancelar-medicamento',
    'abrir-busqueda-medicamentos', 'cerrar-busqueda-medicamentos', 'accion-seleccion-medicamentos', 'volver-resultados-medicamentos'];
  const mensaje = (id, texto, error = false) => mostrarMensaje(el(id), texto, {
    error, clase: id === 'mensaje-medicamentos' ? 'form-status' : 'list-status',
  });
  const actualizarControles = () => {
    for (const id of controles) el(id).disabled = ocupada();
    for (const boton of [...botones.lista, ...botones.busqueda]) boton.disabled = ocupada();
    el('confirmacion-medicamento').setAttribute('aria-busy', String(enviando));
  };
  const bloquearExterno = (valor) => { bloqueoExterno = valor; actualizarControles(); };
  const bloquear = (valor) => { enviando = valor; actualizarControles(); alCambiarBloqueo(valor); };
  const cancelar = (restaurar = true) => {
    seleccion = null;
    el('confirmacion-medicamento').hidden = true;
    panelBusqueda?.reanudar();
    if (restaurar) focoSeleccion?.focus();
  };
  const mostrarModalidad = (ayuntamiento) => {
    const modalidad = ayuntamiento.tipo_lista_medicamentos;
    if (!['GENERAL', 'ESPECIFICA'].includes(modalidad)) throw new Error('La API devolvió una modalidad no válida.');
    el('modalidad-medicamentos').textContent = modalidad === 'GENERAL' ? 'Modalidad actual: GENERAL'
      : 'Modalidad actual: ESPECÍFICA. La lista específica se aplica junto con las condiciones generales de autorización (ACTIVO y ALTA para nuevas lecturas).';
    el('aviso-modalidad-medicamentos').hidden = modalidad !== 'GENERAL';
    el('aviso-modalidad-medicamentos').textContent = modalidad === 'GENERAL'
      ? 'Aviso sobre la lista específica del Ayuntamiento: No se aplica mientras se utiliza la lista general'
      : '';
  };
  const confirmarRetirada = (medicamento, boton) => {
    if (ocupada()) return;
    alIniciarTarea();
    panelBusqueda.cerrar(false);
    seleccion = medicamento;
    focoSeleccion = boton;
    mensaje('mensaje-medicamentos', '');
    el('texto-confirmacion-medicamento').textContent = `Quitar la asociación de ${medicamento.codigo_nacional} — ${medicamento.descripcion} con ${municipio.denominacion}. El medicamento se conserva en el catálogo general. Puedes cancelar.`;
    el('confirmacion-medicamento').hidden = false;
    panelBusqueda.suspender();
    el('confirmar-medicamento').focus();
  };
  const seleccionarResultado = (medicamento, boton) => {
    if (ocupada()) return;
    cancelar(false);
    resultadoSeleccionado = medicamento;
    const duplicado = asociados.has(medicamento.id);
    panelBusqueda.mostrarSeleccion(`${medicamento.codigo_nacional} — ${medicamento.descripcion}. Situación comercial: ${medicamento.situacion_comercial}. Estado general: ${medicamento.estado}. ${duplicado ? 'El medicamento ya está asociado a este Ayuntamiento.' : 'Asociar no implica que sea facturable.'}`, duplicado ? null : 'Añadir medicamento seleccionado', boton);
  };
  const crearFila = (medicamento, busqueda) => {
    const fila = documento.createElement('tr');
    agregarCeldas(documento, fila, medicamento, ['codigo_nacional', 'descripcion', 'situacion_comercial', 'estado']);
    const celda = documento.createElement('td');
    const boton = documento.createElement('button');
    boton.type = 'button';
    boton.className = 'button button-secondary';
    boton.textContent = busqueda ? 'Seleccionar' : 'Quitar';
    boton.setAttribute('aria-label', `${boton.textContent} ${medicamento.codigo_nacional} — ${medicamento.descripcion}`);
    boton.disabled = ocupada();
    boton.addEventListener('click', () => busqueda ? seleccionarResultado(medicamento, boton) : confirmarRetirada(medicamento, boton));
    botones[busqueda ? 'busqueda' : 'lista'].push(boton);
    celda.append(boton);
    fila.append(celda);
    return fila;
  };
  const pintar = (datos, busqueda) => {
    if (!Array.isArray(datos)) throw new Error('La API devolvió un listado no válido.');
    botones[busqueda ? 'busqueda' : 'lista'] = [];
    if (!busqueda) {
      asociados.clear();
      for (const medicamento of datos) asociados.add(medicamento.medicamento_id);
    }
    el(busqueda ? 'filas-busqueda-medicamentos' : 'filas-medicamentos-admitidos').replaceChildren(...datos.map((m) => crearFila(m, busqueda)));
    el(busqueda ? 'tabla-busqueda-medicamentos' : 'tabla-medicamentos-admitidos').hidden = datos.length === 0;
    mensaje(busqueda ? 'estado-busqueda-medicamentos' : 'estado-medicamentos-admitidos', datos.length
      ? `${datos.length} medicamentos ${busqueda ? 'encontrados' : 'en la lista específica'}.`
      : busqueda ? 'No se encontraron medicamentos.' : 'La lista específica está vacía.');
  };
  const cargarLista = async () => {
    const actual = contexto;
    const lectura = ++lecturaLista;
    el('recargar-medicamentos').hidden = true;
    const id = municipio.id;
    el('tabla-medicamentos-admitidos').hidden = true;
    el('filas-medicamentos-admitidos').replaceChildren();
    el('apartado-medicamentos').setAttribute('aria-busy', 'true');
    mensaje('estado-medicamentos-admitidos', 'Cargando medicamentos admitidos…');
    el('modalidad-medicamentos').textContent = 'Consultando modalidad actual…';
    el('aviso-modalidad-medicamentos').textContent = '';
    el('aviso-modalidad-medicamentos').hidden = true;
    asociados.clear();
    try {
      // Consultar el Ayuntamiento incluso con lista vacía; no deducir modalidad de las filas.
      const [ayuntamiento, datos] = await Promise.all([api.obtenerAyuntamiento(id), api.listarMedicamentosAdmitidos(id)]);
      if (actual !== contexto || lectura !== lecturaLista) return;
      mostrarModalidad(ayuntamiento);
      municipio = ayuntamiento;
      pintar(datos, false);
    } catch (error) {
      if (actual === contexto && lectura === lecturaLista) {
        el('recargar-medicamentos').hidden = false;
        el('modalidad-medicamentos').textContent = 'Modalidad no disponible.';
        mensaje('estado-medicamentos-admitidos', `No se pudo cargar la lista. ${error.message}`, true);
      }
    } finally {
      if (actual === contexto && lectura === lecturaLista) el('apartado-medicamentos').setAttribute('aria-busy', 'false');
    }
  };
  const buscar = async (parametros) => {
    const actual = contexto;
    const lectura = ++lecturaBusqueda;
    parametrosBusqueda = { ...parametros };
    resultadoSeleccionado = null;
    panelBusqueda.limpiarSeleccion();
    cancelar(false);
    el('tabla-busqueda-medicamentos').hidden = true;
    el('filas-busqueda-medicamentos').replaceChildren();
    el('tabla-busqueda-medicamentos').setAttribute('aria-busy', 'true');
    mensaje('estado-busqueda-medicamentos', 'Buscando medicamentos…');
    try {
      const datos = await api.buscarMedicamentos(parametros);
      if (actual !== contexto || lectura !== lecturaBusqueda) return;
      pintar(datos, true);
    } catch (error) {
      if (actual === contexto && lectura === lecturaBusqueda) mensaje('estado-busqueda-medicamentos', `No se pudo buscar. ${error.message}`, true);
    } finally {
      if (actual === contexto && lectura === lecturaBusqueda) el('tabla-busqueda-medicamentos').setAttribute('aria-busy', 'false');
    }
  };
  const refrescar = () => Promise.all([cargarLista(), parametrosBusqueda ? buscar(parametrosBusqueda) : Promise.resolve()]);
  const operar = async (medicamentoId, retirar) => {
    if (ocupada() || !municipio) return;
    ++lecturaLista;
    ++lecturaBusqueda;
    cancelar(false);
    bloquear(true);
    mensaje('mensaje-medicamentos', retirar ? 'Quitando asociación…' : 'Añadiendo medicamento…');
    try {
      if (retirar) await api.quitarMedicamento(municipio.id, medicamentoId);
      else await api.asociarMedicamento(municipio.id, medicamentoId);
      mensaje('mensaje-medicamentos', retirar ? 'Asociación retirada. El medicamento se conserva en el catálogo.' : 'Medicamento añadido a la lista específica. Estar asociado no implica ser facturable.');
      panelBusqueda.volverLista();
      await cargarLista();
    } catch (error) {
      mensaje('mensaje-medicamentos', error.message, true);
      await refrescar();
    } finally {
      bloquear(false);
      el('mensaje-medicamentos').focus();
    }
  };
  const incorporar = async (medicamento) => {
    if (ocupada()) return;
    cancelar(false);
    if (asociados.has(medicamento.id)) {
      mensaje('mensaje-medicamentos', 'El medicamento ya está asociado a este Ayuntamiento.');
      el('mensaje-medicamentos').focus();
      return;
    }
    await operar(medicamento.id, false);
  };
  panelBusqueda = iniciarPanelBusqueda({ documento, tipo: 'medicamentos', ocupada,
    alAbrir: () => { alIniciarTarea(); cancelar(false); mensaje('mensaje-medicamentos', ''); },
    alCerrar: () => {
      ++lecturaBusqueda;
      parametrosBusqueda = null;
      resultadoSeleccionado = null;
      cancelar(false);
      el('tabla-busqueda-medicamentos').hidden = true;
      el('tabla-busqueda-medicamentos').setAttribute('aria-busy', 'false');
      el('filas-busqueda-medicamentos').replaceChildren();
      mensaje('estado-busqueda-medicamentos', 'Busca por código nacional o descripción.');
    },
  });
  const cerrarTarea = () => { if (!ocupada()) { panelBusqueda.cerrar(false); cancelar(false); } };
  el('accion-seleccion-medicamentos').addEventListener('click', async () => {
    if (!ocupada() && resultadoSeleccionado && !el('accion-seleccion-medicamentos').hidden) await incorporar(resultadoSeleccionado);
  });
  el('buscar-medicamentos').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (ocupada() || !municipio || !panelBusqueda.abierta) return;
    mensaje('mensaje-medicamentos', '');
    const q = el('medicamentos-q').value.trim();
    if (!terminoBusquedaValido(q)) {
      resultadoSeleccionado = null;
      panelBusqueda.limpiarSeleccion();
      ++lecturaBusqueda;
      parametrosBusqueda = null;
      cancelar(false);
      el('tabla-busqueda-medicamentos').hidden = true;
      el('filas-busqueda-medicamentos').replaceChildren();
      el('tabla-busqueda-medicamentos').setAttribute('aria-busy', 'false');
      mensaje('estado-busqueda-medicamentos', 'Introduce un término de entre 1 y 200 caracteres.', true);
      return;
    }
    await buscar({ campo: el('medicamentos-campo').value, modo: el('medicamentos-modo').value, q });
  });
  el('confirmar-medicamento').addEventListener('click', async () => {
    if (!ocupada() && seleccion) await operar(seleccion.medicamento_id, true);
  });
  el('cancelar-medicamento').addEventListener('click', () => { if (!ocupada()) cancelar(); });
  el('recargar-medicamentos').addEventListener('click', async () => {
    if (!ocupada()) { cancelar(false); await refrescar(); }
  });
  const cerrar = () => {
    if (ocupada()) return;
    ++contexto;
    cerrarTarea();
    cancelar(false);
    municipio = null;
    el('apartado-medicamentos').hidden = true;
  };
  const abrir = async (ayuntamiento, { cargar = true } = {}) => {
    if (ocupada()) return;
    ++contexto;
    cerrarTarea();
    municipio = ayuntamiento;
    parametrosBusqueda = null;
    botones.lista = [];
    botones.busqueda = [];
    asociados.clear();
    cancelar(false);
    mensaje('mensaje-medicamentos', '');
    mensaje('estado-busqueda-medicamentos', 'Busca por código nacional o descripción.');
    el('tabla-busqueda-medicamentos').hidden = true;
    el('filas-busqueda-medicamentos').replaceChildren();
    el('medicamentos-q').value = '';
    el('medicamentos-campo').value = 'codigo_nacional';
    el('medicamentos-modo').value = 'exacto';
    el('apartado-medicamentos').hidden = false;
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
