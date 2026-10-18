import { normalizarDecimal, formatoMonetario, configurarCampoMonetario } from './decimales.js';
import {
  actualizarMedicamento,
  crearMedicamento,
  listarMedicamentos,
  obtenerMedicamento,
} from './medicamentos-api.js';

const camposEditables = [
  'codigo_nacional', 'descripcion', 'precio', 'estado', 'situacion_comercial',
  'tipo_facturacion', 'grupo_terapeutico', 'codigo_laboratorio', 'gtatc',
  'nombre_grupo', 'anexo',
];
const camposOpcionales = new Set([
  'grupo_terapeutico', 'codigo_laboratorio', 'gtatc', 'nombre_grupo', 'anexo',
]);
const camposListado = [
  'codigo_nacional', 'descripcion', 'precio', 'estado', 'situacion_comercial',
  'tipo_facturacion',
];
const etiquetasListado = {
  codigo_nacional: 'Código nacional',
  descripcion: 'Descripción',
  precio: 'Precio',
  estado: 'Autorización general',
  situacion_comercial: 'Situación comercial',
  tipo_facturacion: 'Tipo',
};
const idCampo = (campo) => `campo-${campo.replaceAll('_', '-')}`;

const crearFila = (documento, medicamento, alEditar) => {
  const fila = documento.createElement('tr');
  fila.setAttribute('role', 'row');
  for (const campo of camposListado) {
    const celda = documento.createElement('td');
    celda.setAttribute('role', 'cell');
    celda.setAttribute('data-label', etiquetasListado[campo]);
    celda.textContent = medicamento[campo] ?? '';
    fila.append(celda);
  }

  const celdaAcciones = documento.createElement('td');
  celdaAcciones.className = 'medicamentos-actions-cell';
  celdaAcciones.setAttribute('role', 'cell');
  celdaAcciones.setAttribute('data-label', 'Acciones');
  const botonEditar = documento.createElement('button');
  botonEditar.type = 'button';
  botonEditar.className = 'button button-secondary';
  botonEditar.textContent = 'Ver/Editar';
  botonEditar.setAttribute('aria-label', `Ver o editar medicamento ${medicamento.codigo_nacional}`);
  botonEditar.addEventListener('click', () => alEditar(medicamento.id, botonEditar));
  celdaAcciones.append(botonEditar);
  fila.append(celdaAcciones);
  return fila;
};

export const iniciarInterfaz = ({ documento = document, api = {
  actualizarMedicamento, crearMedicamento, listarMedicamentos, obtenerMedicamento,
} } = {}) => {
  const $ = (id) => documento.getElementById(id);
  configurarCampoMonetario($('campo-precio'), { recortar: true });
  const seccionFormulario = $('seccion-formulario');
  const seccionListado = $('seccion-listado');
  const formulario = $('formulario-medicamento');
  const tabla = $('tabla-medicamentos');
  const filas = $('filas-medicamentos');
  const botonGuardar = $('guardar-medicamento');
  const botonCancelar = $('cancelar-formulario');
  const botonNuevo = $('nuevo-medicamento');
  const estadoFormulario = $('estado-formulario');
  const estadoListado = $('estado-listado');
  const mensajeOperacion = $('mensaje-operacion');
  let modo = null;
  let idEnEdicion = null;
  let botonQueAbrio = botonNuevo;
  let enviando = false;
  let generacion = 0;

  const mostrarEstadoFormulario = (mensaje, error = false) => {
    estadoFormulario.textContent = mensaje;
    estadoFormulario.className = error ? 'form-status message-error' : 'form-status';
    estadoFormulario.setAttribute('role', error ? 'alert' : 'status');
    estadoFormulario.setAttribute('aria-live', error ? 'assertive' : 'polite');
  };

  const mostrarOperacion = (mensaje, error = false) => {
    mensajeOperacion.textContent = mensaje;
    mensajeOperacion.hidden = false;
    mensajeOperacion.className = `operation-message message-${error ? 'error' : 'success'}`;
    mensajeOperacion.setAttribute('role', error ? 'alert' : 'status');
    mensajeOperacion.setAttribute('aria-live', error ? 'assertive' : 'polite');
  };

  const bloquear = (valor) => {
    for (const campo of camposEditables) $(idCampo(campo)).disabled = valor;
    botonGuardar.disabled = valor;
    botonCancelar.disabled = valor;
    botonNuevo.disabled = valor;
    const inicio = $('volver-inicio');
    if (inicio) { inicio.setAttribute('aria-disabled', String(enviando)); inicio.tabIndex = enviando ? -1 : 0; }
  };

  const limpiarFormulario = () => {
    formulario.reset();
    for (const campo of camposOpcionales) $(idCampo(campo)).value = '';
    $('campo-estado').value = 'ACTIVO';
    $('campo-situacion-comercial').value = 'ALTA';
    $('campo-tipo-facturacion').value = 'TD';
  };

  const cargarListado = async () => {
    seccionListado.setAttribute('aria-busy', 'true');
    estadoListado.textContent = 'Cargando medicamentos…';
    estadoListado.className = 'list-status';
    estadoListado.setAttribute('role', 'status');
    estadoListado.setAttribute('aria-live', 'polite');
    $('reintentar-listado').hidden = true;
    tabla.hidden = true;
    filas.replaceChildren();
    try {
      const medicamentos = await api.listarMedicamentos();
      if (!Array.isArray(medicamentos)) throw new Error('La API devolvió un listado no válido.');
      if (medicamentos.length === 0) {
        estadoListado.textContent = 'No hay medicamentos registrados.';
        return;
      }
      filas.replaceChildren(...medicamentos.map((medicamento) => crearFila(documento, medicamento, abrirEdicion)));
      tabla.hidden = false;
      estadoListado.textContent = `Se han cargado ${medicamentos.length} medicamentos.`;
    } catch (error) {
      estadoListado.textContent = `No se pudo cargar el listado. ${error.message}`;
      estadoListado.className = 'list-status message-error';
      estadoListado.setAttribute('role', 'alert');
      estadoListado.setAttribute('aria-live', 'assertive');
      $('reintentar-listado').hidden = false;
    } finally {
      seccionListado.setAttribute('aria-busy', 'false');
    }
  };

  const abrirAlta = () => {
    if (enviando) return;
    generacion += 1;
    modo = 'alta';
    idEnEdicion = null;
    botonQueAbrio = botonNuevo;
    limpiarFormulario();
    mostrarEstadoFormulario('');
    $('titulo-formulario').textContent = 'Nuevo medicamento';
    botonGuardar.textContent = 'Crear medicamento';
    bloquear(false);
    seccionFormulario.hidden = false;
    seccionListado.hidden = true;
    botonCancelar.textContent = 'Cancelar y volver al listado';
    $('campo-codigo-nacional').focus();
  };

  async function abrirEdicion(id, botonOrigen) {
    if (enviando) return;
    const actual = ++generacion;
    modo = 'edicion';
    idEnEdicion = id;
    botonQueAbrio = botonOrigen ?? botonNuevo;
    limpiarFormulario();
    $('titulo-formulario').textContent = 'Ver/Editar medicamento';
    botonGuardar.textContent = 'Guardar cambios';
    mostrarEstadoFormulario('Cargando datos del medicamento…');
    seccionFormulario.hidden = false;
    seccionListado.hidden = true;
    botonCancelar.textContent = 'Cancelar y volver al listado';
    bloquear(true);
    botonCancelar.disabled = false;
    try {
      const medicamento = await api.obtenerMedicamento(id);
      if (actual !== generacion) return;
      for (const campo of camposEditables) $(idCampo(campo)).value = campo === 'precio' ? formatoMonetario(medicamento.precio) : medicamento[campo] ?? '';
      mostrarEstadoFormulario('');
      bloquear(false);
      $('campo-codigo-nacional').focus();
    } catch (error) {
      if (actual !== generacion) return;
      mostrarEstadoFormulario(`No se pudo cargar el medicamento. ${error.message}`, true);
      botonGuardar.disabled = true;
      for (const campo of camposEditables) $(idCampo(campo)).disabled = true;
      botonCancelar.disabled = false;
    }
  }

  const construirDatos = () => Object.fromEntries(camposEditables.map((campo) => {
    const valor = campo === 'precio'
      ? normalizarDecimal($(idCampo(campo)).value, { decimales: 2, cifrasEnteras: 10, recortar: true })
      : $(idCampo(campo)).value;
    return [campo, camposOpcionales.has(campo) && valor.trim() === '' ? null : valor];
  }));

  const cerrarFormulario = () => {
    if (enviando) return;
    generacion += 1;
    modo = null;
    idEnEdicion = null;
    seccionFormulario.hidden = true;
    seccionListado.hidden = false;
    mostrarEstadoFormulario('');
    limpiarFormulario();
    bloquear(false);
    botonQueAbrio?.focus();
    botonQueAbrio = botonNuevo;
  };

  botonNuevo.addEventListener('click', abrirAlta);
  $('volver-inicio')?.addEventListener('click', (evento) => { if (enviando) evento.preventDefault(); });
  $('reintentar-listado').addEventListener('click', cargarListado);
  botonCancelar.addEventListener('click', cerrarFormulario);
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (enviando || modo === null) return;
    enviando = true;
    bloquear(true);
    mostrarEstadoFormulario('Guardando medicamento…');
    try {
      const datos = construirDatos();
      if (modo === 'alta') {
        await api.crearMedicamento(datos);
        mostrarOperacion('Medicamento creado correctamente.');
      } else {
        await api.actualizarMedicamento(idEnEdicion, datos);
        mostrarOperacion('Medicamento actualizado correctamente.');
      }
      seccionFormulario.hidden = true;
      seccionListado.hidden = false;
      modo = null;
      await cargarListado();
      botonNuevo.focus();
    } catch (error) {
      mostrarEstadoFormulario(`No se pudo guardar el medicamento. ${error.message}`, true);
    } finally {
      enviando = false;
      bloquear(false);
      if (seccionFormulario.hidden) botonNuevo.focus();
    }
  });

  seccionFormulario.hidden = true;
  seccionListado.hidden = false;
  void cargarListado();
};

if (typeof document !== 'undefined') iniciarInterfaz();
