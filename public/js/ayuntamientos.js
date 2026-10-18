import { iniciarMedicamentosMunicipales } from './ayuntamiento-medicamentos.js';
import { iniciarFarmaciasMunicipales } from './ayuntamiento-farmacias.js';
import { iniciarPestanasMunicipales, mostrarMensaje } from './gestion-municipal-ui.js';
import {
  actualizarAyuntamiento,
  crearAyuntamiento,
  listarAyuntamientos,
  obtenerAyuntamiento,
} from './ayuntamientos-api.js';

const camposEditables = [
  'cif',
  'denominacion',
  'direccion',
  'codigo_postal',
  'localidad',
  'provincia',
  'telefono',
  'movil',
  'persona_responsable',
  'persona_contacto',
  'alcalde',
  'estado',
  'tipo_lista_medicamentos',
];

const camposOpcionales = new Set([
  'telefono',
  'movil',
  'persona_responsable',
  'persona_contacto',
  'alcalde',
]);

const camposListado = [
  'cif',
  'denominacion',
  'localidad',
  'provincia',
  'estado',
  'tipo_lista_medicamentos',
];

const idCampo = (nombre) => `campo-${nombre.replaceAll('_', '-')}`;

const crearDatosEditables = (ayuntamiento) =>
  Object.fromEntries(
    camposEditables.map((campo) => [campo, ayuntamiento[campo] ?? (camposOpcionales.has(campo) ? null : '')]),
  );

const crearFila = (documento, ayuntamiento, alEditar, alCambiarEstado, alAbrirFicha) => {
  const fila = documento.createElement('tr');

  for (const campo of camposListado) {
    const celda = documento.createElement('td');
    celda.textContent = ayuntamiento[campo] ?? '';
    fila.append(celda);
  }

  const celdaAcciones = documento.createElement('td');
  const acciones = documento.createElement('div');
  acciones.className = 'row-actions';

  const botonEditar = documento.createElement('button');
  botonEditar.className = 'button button-secondary';
  botonEditar.type = 'button';
  botonEditar.textContent = 'Ver/Editar';
  const nombreAccesible = typeof ayuntamiento.denominacion === 'string'
    && ayuntamiento.denominacion.trim() !== ''
    ? ayuntamiento.denominacion
    : `ayuntamiento con CIF ${ayuntamiento.cif ?? ayuntamiento.id}`;
  botonEditar.setAttribute('aria-label', `Ver o editar ${nombreAccesible}`);
  botonEditar.addEventListener('click', () => alEditar(ayuntamiento.id, botonEditar));

  const botonEstado = documento.createElement('button');
  botonEstado.className = 'button button-secondary';
  botonEstado.type = 'button';
  botonEstado.textContent = ayuntamiento.estado === 'ACTIVO' ? 'Desactivar' : 'Activar';
  botonEstado.setAttribute('aria-label', `${botonEstado.textContent} ${nombreAccesible}`);
  botonEstado.addEventListener('click', () =>
    alCambiarEstado(ayuntamiento.id, botonEditar, botonEstado, botonFicha),
  );

  acciones.append(botonEditar, botonEstado);
  const botonFicha = documento.createElement('button');
  botonFicha.type = 'button';
  botonFicha.className = 'button button-secondary';
  botonFicha.textContent = 'Ficha';
  botonFicha.setAttribute('aria-label', `Abrir ficha de ${nombreAccesible}`);
  botonFicha.addEventListener('click', () => alAbrirFicha(ayuntamiento, botonFicha));
  acciones.append(botonFicha);
  celdaAcciones.append(acciones);
  fila.append(celdaAcciones);

  return fila;
};

export const iniciarInterfaz = ({
  documento = document,
  apiFarmacias,
  apiMedicamentos,
  api = {
    actualizarAyuntamiento,
    crearAyuntamiento,
    listarAyuntamientos,
    obtenerAyuntamiento,
  },
} = {}) => {
  let medicamentosMunicipales = null;
  let retornoFicha = null;
  let ayuntamientoFicha = null;
  let lecturaFicha = 0;
  const ocupadaFicha = () => envioEnCurso || Boolean(farmaciasMunicipales?.ocupada || medicamentosMunicipales?.ocupada);
  const bloquearFicha = () => {
    const valor = ocupadaFicha();
    pestanas?.bloquear(valor);
    const editar = documento.getElementById('editar-modalidad');
    if (editar) editar.disabled = valor;
    const inicio = documento.getElementById('volver-inicio');
    if (inicio) { inicio.setAttribute('aria-disabled', String(valor)); inicio.tabIndex = valor ? -1 : 0; }
  };
  const farmaciasMunicipales = documento.getElementById('ficha-ayuntamiento')
    ? iniciarFarmaciasMunicipales({ documento, api: apiFarmacias,
      alCerrar: () => { ++lecturaFicha; medicamentosMunicipales?.cerrar(); seccionListado.hidden = false; },
      alVolverListado: () => botonNuevo.focus(),
      alIniciarTarea: () => medicamentosMunicipales?.cerrarTarea(),
      alCambiarBloqueo: (valor) => { medicamentosMunicipales?.bloquearExterno(valor); bloquearFicha(); },
    }) : null;
  medicamentosMunicipales = documento.getElementById('apartado-medicamentos')
    ? iniciarMedicamentosMunicipales({ documento, api: apiMedicamentos,
      alIniciarTarea: () => farmaciasMunicipales?.cerrarTarea(),
      alCambiarBloqueo: (valor) => { farmaciasMunicipales?.bloquearExterno(valor); bloquearFicha(); },
    }) : null;
  const pestanas = documento.getElementById('tab-datos') ? iniciarPestanasMunicipales({ documento,
    ocupada: ocupadaFicha,
    alSeleccionar: async (nombre) => {
      ++lecturaFicha;
      farmaciasMunicipales?.desactivar();
      medicamentosMunicipales?.desactivar();
      if (nombre === 'datos') await cargarDatosFicha();
      if (nombre === 'farmacias') await farmaciasMunicipales?.activar();
      if (nombre === 'medicamentos') await medicamentosMunicipales?.activar();
    },
  }) : null;
  const pintarDatosFicha = (ayuntamiento) => {
    const datos = documento.getElementById('datos-ficha');
    if (!datos) return;
    datos.replaceChildren(...camposEditables.map((campo) => {
      const grupo = documento.createElement('div');
      const etiqueta = documento.createElement('dt');
      etiqueta.textContent = documento.getElementById(idCampo(campo)).labels?.[0]?.textContent?.replace('*', '').trim()
        ?? campo.replaceAll('_', ' ');
      const valor = documento.createElement('dd');
      valor.textContent = ayuntamiento[campo] ?? 'No consta';
      grupo.append(etiqueta, valor);
      return grupo;
    }));
  };
  const cargarDatosFicha = async () => {
    const lectura = ++lecturaFicha;
    const id = ayuntamientoFicha.id;
    const estado = documento.getElementById('estado-datos-ficha');
    const editar = documento.getElementById('editar-modalidad');
    const reintentar = documento.getElementById('reintentar-datos');
    reintentar.hidden = true;
    editar.hidden = true;
    documento.getElementById('datos-ficha').hidden = true;
    mostrarMensaje(estado, 'Cargando datos…');
    try {
      const datos = await api.obtenerAyuntamiento(id);
      if (lectura !== lecturaFicha) return;
      ayuntamientoFicha = datos;
      pintarDatosFicha(datos);
      documento.getElementById('datos-ficha').hidden = false;
      documento.getElementById('nombre-ficha').textContent = datos.denominacion;
      editar.hidden = false;
      mostrarMensaje(estado, '');
    } catch (error) {
      if (lectura !== lecturaFicha) return;
      mostrarMensaje(estado, `No se pudieron cargar los datos. ${error.message}`, { error: true });
      reintentar.hidden = false;
    }
  };
  const abrirFicha = async (ayuntamiento, boton) => {
    if (envioEnCurso || farmaciasMunicipales?.ocupada) return;
    ocultarFormulario({ restaurarFoco: false });
    seccionListado.hidden = true;
    ayuntamientoFicha = ayuntamiento;
    pintarDatosFicha(ayuntamiento);
    await Promise.all([farmaciasMunicipales?.abrir(ayuntamiento, boton, { cargar: !pestanas }), medicamentosMunicipales?.abrir(ayuntamiento, { cargar: !pestanas })]);
    await pestanas?.seleccionar('datos');
  };
  const seccionListado = documento.getElementById('seccion-listado');
  const estadoListado = documento.getElementById('estado-listado');
  const botonReintentar = documento.getElementById('reintentar-listado');
  const tabla = documento.getElementById('tabla-ayuntamientos');
  const filas = documento.getElementById('filas-ayuntamientos');
  const botonNuevo = documento.getElementById('nuevo-ayuntamiento');
  const seccionFormulario = documento.getElementById('seccion-formulario');
  const tituloFormulario = documento.getElementById('titulo-formulario');
  const formulario = documento.getElementById('formulario-ayuntamiento');
  const estadoFormulario = documento.getElementById('estado-formulario');
  const botonGuardar = documento.getElementById('guardar-ayuntamiento');
  const botonCancelar = documento.getElementById('cancelar-formulario');
  const mensajeOperacion = documento.getElementById('mensaje-operacion');
  const controlesFormulario = camposEditables.map((campo) =>
    documento.getElementById(idCampo(campo)),
  );

  let modoFormulario = null;
  let idEnEdicion = null;
  let generacionFormulario = 0;
  let envioEnCurso = false;
  let controlQueAbreFormulario = botonNuevo;
  documento.getElementById('volver-inicio')?.addEventListener('click', (evento) => { if (ocupadaFicha()) evento.preventDefault(); });
  documento.getElementById('reintentar-datos')?.addEventListener('click', () => { if (!ocupadaFicha()) return cargarDatosFicha(); });
  documento.getElementById('editar-modalidad')?.addEventListener('click', () => {
    if (!ocupadaFicha() && ayuntamientoFicha) return abrirEdicion(ayuntamientoFicha.id, documento.getElementById('editar-modalidad'), true);
  });

  const mostrarEstadoFormulario = (mensaje, tipo = '') => {
    estadoFormulario.textContent = mensaje;
    estadoFormulario.className = tipo ? `form-status message-${tipo}` : 'form-status';
    estadoFormulario.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    estadoFormulario.setAttribute('aria-live', tipo === 'error' ? 'assertive' : 'polite');
  };

  const mostrarMensajeOperacion = (mensaje, esError = false) => {
    mensajeOperacion.textContent = mensaje;
    mensajeOperacion.hidden = false;
    mensajeOperacion.className = `operation-message message-${esError ? 'error' : 'success'}`;
    mensajeOperacion.setAttribute('role', esError ? 'alert' : 'status');
    mensajeOperacion.setAttribute('aria-live', esError ? 'assertive' : 'polite');
  };

  const limpiarMensajeOperacion = () => {
    mensajeOperacion.textContent = '';
    mensajeOperacion.hidden = true;
    mensajeOperacion.className = 'operation-message';
  };

  const limpiarCampos = () => {
    for (const campo of camposEditables) {
      const control = documento.getElementById(idCampo(campo));
      control.value = campo === 'estado' ? 'ACTIVO' : '';
      if (campo === 'tipo_lista_medicamentos') {
        control.value = 'GENERAL';
      }
    }
  };

  const rellenarCampos = (ayuntamiento) => {
    for (const campo of camposEditables) {
      documento.getElementById(idCampo(campo)).value = ayuntamiento[campo] ?? '';
    }
  };

  const bloquearFormulario = (bloquear) => {
    for (const control of controlesFormulario) {
      control.disabled = bloquear;
    }
    botonGuardar.disabled = bloquear;
    botonCancelar.disabled = bloquear;
    botonNuevo.disabled = bloquear;
  };

  const ocultarFormulario = ({ restaurarFoco = true } = {}) => {
    const focoDestino = controlQueAbreFormulario?.isConnected === false
      ? botonNuevo
      : controlQueAbreFormulario;
    generacionFormulario += 1;
    modoFormulario = null;
    idEnEdicion = null;
    seccionFormulario.hidden = true;
    seccionListado.hidden = false;
    mostrarEstadoFormulario('');
    limpiarCampos();
    bloquearFormulario(false);
    if (restaurarFoco) focoDestino?.focus();
    controlQueAbreFormulario = botonNuevo;
  };

  const abrirAlta = () => {
    if (envioEnCurso || farmaciasMunicipales?.ocupada) return;
    generacionFormulario += 1;
    farmaciasMunicipales?.cerrar();
    retornoFicha = null;
    modoFormulario = 'alta';
    idEnEdicion = null;
    controlQueAbreFormulario = botonNuevo;
    limpiarMensajeOperacion();
    mostrarEstadoFormulario('');
    limpiarCampos();
    tituloFormulario.textContent = 'Nuevo ayuntamiento';
    botonCancelar.textContent = 'Cancelar y volver al listado';
    botonGuardar.textContent = 'Crear ayuntamiento';
    bloquearFormulario(false);
    seccionFormulario.hidden = false;
    seccionListado.hidden = true;
    documento.getElementById(idCampo('cif')).focus();
  };

  const abrirEdicion = async (id, botonOrigen, desdeFicha = false) => {
    if (envioEnCurso || farmaciasMunicipales?.ocupada) return;
    const generacion = ++generacionFormulario;
    farmaciasMunicipales?.cerrar();
    const filtros = ['farmacias', 'medicamentos'].flatMap((tipo) => ['campo', 'modo', 'q']
      .map((campo) => `${tipo}-${campo}`)).map((nombre) => [nombre, documento.getElementById(nombre)?.value]);
    retornoFicha = desdeFicha ? { id, botonOrigen, filtros } : null;
    modoFormulario = 'edicion';
    idEnEdicion = id;
    controlQueAbreFormulario = botonOrigen ?? botonNuevo;
    limpiarMensajeOperacion();
    limpiarCampos();
    tituloFormulario.textContent = 'Ver/Editar ayuntamiento';
    botonCancelar.textContent = desdeFicha ? 'Cancelar y volver a la ficha' : 'Cancelar y volver al listado';
    botonGuardar.textContent = 'Guardar cambios';
    mostrarEstadoFormulario('Cargando datos del ayuntamiento…');
    seccionFormulario.hidden = false;
    seccionListado.hidden = true;
    bloquearFormulario(true);
    botonCancelar.disabled = false;

    try {
      const ayuntamiento = await api.obtenerAyuntamiento(id);
      if (generacion !== generacionFormulario) return;

      rellenarCampos(ayuntamiento);
      mostrarEstadoFormulario('');
      bloquearFormulario(false);
      documento.getElementById(idCampo('cif')).focus();
    } catch (error) {
      if (generacion !== generacionFormulario) return;
      mostrarEstadoFormulario(`No se pudo cargar el ayuntamiento. ${error.message}`, 'error');
      botonGuardar.disabled = true;
      for (const control of controlesFormulario) {
        control.disabled = true;
      }
      botonCancelar.disabled = false;
      botonNuevo.disabled = false;
    }
  };

  const mostrarErrorListado = (error) => {
    const mensaje = error instanceof Error && error.message
      ? error.message
      : 'Se produjo un error inesperado.';
    estadoListado.textContent = `No se pudo cargar el listado. ${mensaje}`;
    estadoListado.className = 'list-status message-error';
    estadoListado.setAttribute('role', 'alert');
    estadoListado.setAttribute('aria-live', 'assertive');
    botonReintentar.hidden = false;
  };

  const cargarListado = async () => {
    seccionListado.setAttribute('aria-busy', 'true');
    estadoListado.textContent = 'Cargando ayuntamientos…';
    estadoListado.className = 'list-status';
    estadoListado.setAttribute('role', 'status');
    estadoListado.setAttribute('aria-live', 'polite');
    botonReintentar.hidden = true;
    tabla.hidden = true;
    filas.replaceChildren();

    try {
      const ayuntamientos = await api.listarAyuntamientos();
      if (!Array.isArray(ayuntamientos)) {
        throw new Error('La API devolvió un listado no válido.');
      }

      if (ayuntamientos.length === 0) {
        estadoListado.textContent = 'No hay ayuntamientos registrados.';
        return;
      }

      filas.replaceChildren(
        ...ayuntamientos.map((ayuntamiento) =>
          crearFila(documento, ayuntamiento, abrirEdicion, cambiarEstado, abrirFicha),
        ),
      );
      tabla.hidden = false;
      estadoListado.textContent = `Se han cargado ${ayuntamientos.length} ayuntamientos.`;
    } catch (error) {
      mostrarErrorListado(error);
    } finally {
      seccionListado.setAttribute('aria-busy', 'false');
    }
  };

  const construirDatosFormulario = () =>
    Object.fromEntries(
      camposEditables.map((campo) => {
        const valor = documento.getElementById(idCampo(campo)).value;
        return [
          campo,
          camposOpcionales.has(campo) && valor.trim() === '' ? null : valor,
        ];
      }),
    );

  const cambiarEstado = async (id, ...botones) => {
    if (envioEnCurso || farmaciasMunicipales?.ocupada) return;
    envioEnCurso = true;
    bloquearFicha();
    bloquearFormulario(true);
    for (const boton of botones) boton.disabled = true;
    mostrarMensajeOperacion('Guardando estado del Ayuntamiento…');

    try {
      const ayuntamientoActual = await api.obtenerAyuntamiento(id);
      const datos = crearDatosEditables(ayuntamientoActual);
      datos.estado = ayuntamientoActual.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
      await api.actualizarAyuntamiento(id, datos);

      mostrarMensajeOperacion(
        datos.estado === 'ACTIVO'
          ? 'Ayuntamiento activado correctamente.'
          : 'Ayuntamiento desactivado correctamente.',
      );
      await cargarListado();
    } catch (error) {
      const mensaje = error instanceof Error && error.message
        ? error.message
        : 'Se produjo un error inesperado.';
      mostrarMensajeOperacion(`No se pudo cambiar el estado. ${mensaje}`, true);
    } finally {
      envioEnCurso = false;
      bloquearFicha();
      bloquearFormulario(false);
      for (const boton of botones) boton.disabled = false;
    }
  };

  botonNuevo.addEventListener('click', abrirAlta);
  botonCancelar.addEventListener('click', async () => {
    if (envioEnCurso) return;
    const retorno = retornoFicha;
    retornoFicha = null;
    ocultarFormulario({ restaurarFoco: !retorno });
    if (retorno) {
      seccionListado.hidden = true;
      try {
        await abrirFicha(await api.obtenerAyuntamiento(retorno.id), retorno.botonOrigen);
        for (const [nombre, valor] of retorno.filtros) if (documento.getElementById(nombre)) documento.getElementById(nombre).value = valor;
      }
      catch (error) { seccionListado.hidden = false; botonNuevo.focus(); mostrarMensajeOperacion(`No se pudo volver a la ficha. ${error.message}`, true); }
    }
  });
  botonReintentar.addEventListener('click', cargarListado);

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (envioEnCurso || modoFormulario === null) return;

    envioEnCurso = true;
    bloquearFicha();
    bloquearFormulario(true);
    mostrarEstadoFormulario('Guardando ayuntamiento…');

    try {
      const retorno = retornoFicha;
      let actualizado;
      const datos = construirDatosFormulario();
      if (modoFormulario === 'alta') {
        await api.crearAyuntamiento(datos);
        mostrarMensajeOperacion('Ayuntamiento creado correctamente.');
      } else {
        actualizado = await api.actualizarAyuntamiento(idEnEdicion, datos);
        mostrarMensajeOperacion('Ayuntamiento actualizado correctamente.');
      }

      ocultarFormulario({ restaurarFoco: false });
      seccionListado.hidden = Boolean(retorno);
      await cargarListado();
      retornoFicha = null;
      if (retorno) {
        envioEnCurso = false;
        await abrirFicha(actualizado ?? { ...datos, id: retorno.id }, retorno.botonOrigen);
        for (const [nombre, valor] of retorno.filtros) if (documento.getElementById(nombre)) documento.getElementById(nombre).value = valor;
      } else botonNuevo.focus();
    } catch (error) {
      const mensaje = error instanceof Error && error.message
        ? error.message
        : 'Se produjo un error inesperado.';
      mostrarEstadoFormulario(`No se pudo guardar el ayuntamiento. ${mensaje}`, 'error');
    } finally {
      envioEnCurso = false;
      bloquearFicha();
      if (!seccionFormulario.hidden) bloquearFormulario(false);
    }
  });

  void cargarListado();
};

if (typeof document !== 'undefined') {
  iniciarInterfaz();
}
