import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import { iniciarInterfaz } from '../public/js/ayuntamientos.js';

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

class ElementoSimulado {
  constructor(etiqueta) {
    this.etiqueta = etiqueta;
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.valorTexto = '';
  }

  set textContent(valor) {
    this.valorTexto = String(valor);
    this.children = [];
  }

  get textContent() {
    return this.valorTexto + this.children.map((hijo) => hijo.textContent).join('');
  }

  set innerHTML(_valor) {
    throw new Error('No se debe insertar contenido recibido mediante innerHTML.');
  }

  append(...elementos) {
    this.children.push(...elementos);
  }

  replaceChildren(...elementos) {
    this.children = [...elementos];
    this.valorTexto = '';
  }

  setAttribute(nombre, valor) {
    this.attributes[nombre] = valor;
  }

  addEventListener(evento, listener) {
    this.listeners[evento] = listener;
  }

  focus() {
    this.focused = true;
  }

  async click() {
    await this.listeners.click({ preventDefault() {} });
  }

  async submit() {
    await this.listeners.submit({ preventDefault() {} });
  }
}

const crearDocumentoSimulado = () => {
  const elementos = {
    'seccion-listado': new ElementoSimulado('section'),
    'estado-listado': new ElementoSimulado('p'),
    'reintentar-listado': new ElementoSimulado('button'),
    'tabla-ayuntamientos': new ElementoSimulado('table'),
    'filas-ayuntamientos': new ElementoSimulado('tbody'),
    'nuevo-ayuntamiento': new ElementoSimulado('button'),
    'seccion-formulario': new ElementoSimulado('section'),
    'titulo-formulario': new ElementoSimulado('h2'),
    'formulario-ayuntamiento': new ElementoSimulado('form'),
    'estado-formulario': new ElementoSimulado('p'),
    'guardar-ayuntamiento': new ElementoSimulado('button'),
    'cancelar-formulario': new ElementoSimulado('button'),
    'mensaje-operacion': new ElementoSimulado('p'),
  };

  for (const campo of camposEditables) {
    elementos[`campo-${campo.replaceAll('_', '-')}`] = new ElementoSimulado(
      campo === 'estado' || campo === 'tipo_lista_medicamentos' ? 'select' : 'input',
    );
  }

  elementos['seccion-formulario'].hidden = true;
  elementos['tabla-ayuntamientos'].hidden = true;
  elementos['reintentar-listado'].hidden = true;
  elementos['mensaje-operacion'].hidden = true;
  elementos['campo-estado'].value = 'ACTIVO';
  elementos['campo-tipo-lista-medicamentos'].value = 'GENERAL';

  return {
    elementos,
    documento: {
      getElementById: (id) => elementos[id],
      createElement: (etiqueta) => new ElementoSimulado(etiqueta),
    },
  };
};

const crearAyuntamiento = (cambios = {}) => ({
  id: 41,
  cif: 'TEST-CIF-0009',
  denominacion: 'Ayuntamiento de Prueba',
  direccion: 'Calle Ficticia 1',
  codigo_postal: '28001',
  localidad: 'Localidad de Prueba',
  provincia: 'Provincia de Prueba',
  telefono: null,
  movil: null,
  persona_responsable: null,
  persona_contacto: null,
  alcalde: null,
  estado: 'ACTIVO',
  tipo_lista_medicamentos: 'GENERAL',
  ...cambios,
});

const crearApiSimulada = (listado = []) => ({
  actualizarAyuntamiento: vi.fn().mockResolvedValue({}),
  crearAyuntamiento: vi.fn().mockResolvedValue({ id: 52 }),
  listarAyuntamientos: vi.fn().mockResolvedValue(listado),
  obtenerAyuntamiento: vi.fn().mockResolvedValue(crearAyuntamiento()),
});

const obtenerControl = (elementos, campo) =>
  elementos[`campo-${campo.replaceAll('_', '-')}`];

const rellenarObligatorios = (elementos, cambios = {}) => {
  const valores = {
    cif: 'TEST-CIF-0013',
    denominacion: 'Ayuntamiento Nuevo',
    direccion: 'Avenida Ficticia 9',
    codigo_postal: '28002',
    localidad: 'Localidad Nueva',
    provincia: 'Provincia Nueva',
    ...cambios,
  };

  for (const [campo, valor] of Object.entries(valores)) {
    obtenerControl(elementos, campo).value = valor;
  }
};

const esperarListado = async (elementos) => {
  await vi.waitFor(() => {
    expect(elementos['estado-listado'].textContent).not.toBe('Cargando ayuntamientos…');
  });
};

describe('listado de ayuntamientos', () => {
  it('muestra los campos solicitados en el orden recibido como texto seguro', async () => {
    const { documento, elementos } = crearDocumentoSimulado();
    const api = crearApiSimulada([
      crearAyuntamiento({ cif: '<img src=x onerror=alert(1)>' }),
      crearAyuntamiento({ id: 42, denominacion: 'Ayuntamiento B', estado: 'INACTIVO' }),
    ]);

    iniciarInterfaz({ documento, api });
    await vi.waitFor(() => expect(elementos['tabla-ayuntamientos'].hidden).toBe(false));

    expect(api.listarAyuntamientos).toHaveBeenCalledOnce();
    expect(elementos['filas-ayuntamientos'].children).toHaveLength(2);
    expect(elementos['filas-ayuntamientos'].children[0].children.slice(0, 6).map((celda) => celda.textContent))
      .toEqual([
        '<img src=x onerror=alert(1)>',
        'Ayuntamiento de Prueba',
        'Localidad de Prueba',
        'Provincia de Prueba',
        'ACTIVO',
        'GENERAL',
      ]);
    expect(elementos['filas-ayuntamientos'].children[1].children[4].textContent).toBe('INACTIVO');
    const accionesPrimeraFila = elementos['filas-ayuntamientos'].children[0].children[6].children[0].children;
    const accionesSegundaFila = elementos['filas-ayuntamientos'].children[1].children[6].children[0].children;
    expect(accionesPrimeraFila[0].attributes['aria-label'])
      .toBe('Ver o editar Ayuntamiento de Prueba');
    expect(accionesPrimeraFila[1].attributes['aria-label'])
      .toBe('Desactivar Ayuntamiento de Prueba');
    expect(accionesSegundaFila[1].attributes['aria-label'])
      .toBe('Activar Ayuntamiento B');
  });

  it('presenta el estado de carga mientras espera la respuesta', () => {
    const { documento, elementos } = crearDocumentoSimulado();
    const api = crearApiSimulada();
    api.listarAyuntamientos.mockImplementation(() => new Promise(() => {}));

    iniciarInterfaz({ documento, api });

    expect(elementos['estado-listado'].textContent).toBe('Cargando ayuntamientos…');
    expect(elementos['seccion-listado'].attributes['aria-busy']).toBe('true');
    expect(elementos['tabla-ayuntamientos'].hidden).toBe(true);
  });

  it('presenta la lista vacía cuando la API no devuelve registros', async () => {
    const { documento, elementos } = crearDocumentoSimulado();

    iniciarInterfaz({ documento, api: crearApiSimulada([]) });
    await vi.waitFor(() =>
      expect(elementos['estado-listado'].textContent).toBe('No hay ayuntamientos registrados.'),
    );

    expect(elementos['tabla-ayuntamientos'].hidden).toBe(true);
    expect(elementos['reintentar-listado'].hidden).toBe(true);
  });

  it('muestra un error comprensible y permite reintentar', async () => {
    const { documento, elementos } = crearDocumentoSimulado();
    const api = crearApiSimulada();
    api.listarAyuntamientos
      .mockRejectedValueOnce(new Error('Error de red'))
      .mockResolvedValueOnce([crearAyuntamiento()]);

    iniciarInterfaz({ documento, api });
    await vi.waitFor(() => expect(elementos['reintentar-listado'].hidden).toBe(false));

    expect(elementos['estado-listado'].textContent).toBe('No se pudo cargar el listado. Error de red');
    expect(elementos['estado-listado'].className).toBe('list-status message-error');
    expect(elementos['estado-listado'].attributes.role).toBe('alert');
    await elementos['reintentar-listado'].click();
    await vi.waitFor(() => expect(elementos['tabla-ayuntamientos'].hidden).toBe(false));
    expect(api.listarAyuntamientos).toHaveBeenCalledTimes(2);
  });
});

describe('formulario y acciones de ayuntamientos', () => {
  it('abre el alta, convierte opcionales vacíos a null y envía POST', async () => {
    const { documento, elementos } = crearDocumentoSimulado();
    const api = crearApiSimulada([]);
    api.listarAyuntamientos
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([crearAyuntamiento({
        id: 52,
        cif: 'TEST-CIF-0013',
        denominacion: 'Ayuntamiento Nuevo',
      })]);
    iniciarInterfaz({ documento, api });
    await esperarListado(elementos);

    await elementos['nuevo-ayuntamiento'].click();
    expect(elementos['seccion-listado'].hidden).toBe(true);
    rellenarObligatorios(elementos);
    await elementos['formulario-ayuntamiento'].submit();
    await vi.waitFor(() => expect(api.crearAyuntamiento).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(api.listarAyuntamientos).toHaveBeenCalledTimes(2));

    expect(api.crearAyuntamiento).toHaveBeenCalledWith({
      cif: 'TEST-CIF-0013',
      denominacion: 'Ayuntamiento Nuevo',
      direccion: 'Avenida Ficticia 9',
      codigo_postal: '28002',
      localidad: 'Localidad Nueva',
      provincia: 'Provincia Nueva',
      telefono: null,
      movil: null,
      persona_responsable: null,
      persona_contacto: null,
      alcalde: null,
      estado: 'ACTIVO',
      tipo_lista_medicamentos: 'GENERAL',
    });
    expect(elementos['seccion-formulario'].hidden).toBe(true);
    expect(elementos['seccion-listado'].hidden).toBe(!elementos['ficha-ayuntamiento']?.hidden && Boolean(elementos['ficha-ayuntamiento']));
    expect(elementos['mensaje-operacion'].textContent).toBe('Ayuntamiento creado correctamente.');
    expect(elementos['mensaje-operacion'].className)
      .toBe('operation-message message-success');
    expect(elementos['mensaje-operacion'].attributes.role).toBe('status');
    expect(elementos['filas-ayuntamientos'].children[0].children[1].textContent)
      .toBe('Ayuntamiento Nuevo');
  });

  it('consulta antes de editar y guarda todos los campos con el ID de la ruta', async () => {
    const registro = crearAyuntamiento();
    const { documento, elementos } = crearDocumentoSimulado();
    const api = crearApiSimulada([registro]);
    api.obtenerAyuntamiento.mockResolvedValue(registro);
    api.listarAyuntamientos
      .mockResolvedValueOnce([registro])
      .mockResolvedValueOnce([
        { ...registro, denominacion: 'Denominación actualizada' },
      ]);
    iniciarInterfaz({ documento, api });
    await vi.waitFor(() => expect(elementos['tabla-ayuntamientos'].hidden).toBe(false));

    const botones = elementos['filas-ayuntamientos'].children[0].children[6].children[0].children;
    await botones[0].click();
    expect(api.obtenerAyuntamiento).toHaveBeenCalledWith(registro.id);
    expect(obtenerControl(elementos, 'denominacion').value).toBe(registro.denominacion);

    obtenerControl(elementos, 'denominacion').value = 'Denominación actualizada';
    await elementos['formulario-ayuntamiento'].submit();
    await vi.waitFor(() => expect(api.actualizarAyuntamiento).toHaveBeenCalledOnce());

    expect(api.actualizarAyuntamiento).toHaveBeenCalledWith(registro.id, {
      ...Object.fromEntries(camposEditables.map((campo) => [campo, registro[campo]])),
      denominacion: 'Denominación actualizada',
    });
    expect(api.listarAyuntamientos).toHaveBeenCalledTimes(2);
    expect(elementos['mensaje-operacion'].textContent).toBe('Ayuntamiento actualizado correctamente.');
    expect(elementos['mensaje-operacion'].className)
      .toBe('operation-message message-success');
    expect(elementos['filas-ayuntamientos'].children[0].children[1].textContent)
      .toBe('Denominación actualizada');
    expect(elementos['nuevo-ayuntamiento'].focused).toBe(true);
  });

  it('permite actualizar el registro TEST-CIF-0019 conservando su propio CIF', async () => {
    const gfdf = crearAyuntamiento({ id: 41, cif: 'GFDF', denominacion: 'Ayuntamiento GFDF' });
    const qRegistro = crearAyuntamiento({ id: 42, cif: 'TEST-CIF-0019', denominacion: 'Ayuntamiento Q' });
    const { documento, elementos } = crearDocumentoSimulado();
    const api = crearApiSimulada([gfdf, qRegistro]);
    api.obtenerAyuntamiento.mockResolvedValue(qRegistro);
    api.listarAyuntamientos
      .mockResolvedValueOnce([gfdf, qRegistro])
      .mockResolvedValueOnce([gfdf, qRegistro]);
    iniciarInterfaz({ documento, api });
    await vi.waitFor(() => expect(elementos['tabla-ayuntamientos'].hidden).toBe(false));

    const botonesQ = elementos['filas-ayuntamientos'].children[1].children[6].children[0].children;
    await botonesQ[0].click();
    expect(obtenerControl(elementos, 'cif').value).toBe('TEST-CIF-0019');
    await elementos['formulario-ayuntamiento'].submit();

    await vi.waitFor(() => expect(api.actualizarAyuntamiento).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(api.listarAyuntamientos).toHaveBeenCalledTimes(2));
    expect(api.actualizarAyuntamiento).toHaveBeenCalledWith(
      qRegistro.id,
      expect.objectContaining({ cif: 'TEST-CIF-0019' }),
    );
    expect(elementos['seccion-formulario'].hidden).toBe(true);
    expect(elementos['mensaje-operacion'].className)
      .toBe('operation-message message-success');
  });

  it('presenta el conflicto 409 y conserva la tabla al asignar a GFDF el CIF de TEST-CIF-0019', async () => {
    const gfdf = crearAyuntamiento({ id: 41, cif: 'GFDF', denominacion: 'Ayuntamiento GFDF' });
    const qRegistro = crearAyuntamiento({ id: 42, cif: 'TEST-CIF-0019', denominacion: 'Ayuntamiento Q' });
    const { documento, elementos } = crearDocumentoSimulado();
    const api = crearApiSimulada([gfdf, qRegistro]);
    api.obtenerAyuntamiento.mockResolvedValue(gfdf);
    api.actualizarAyuntamiento.mockRejectedValue(new Error('El CIF ya está registrado.'));
    iniciarInterfaz({ documento, api });
    await vi.waitFor(() => expect(elementos['tabla-ayuntamientos'].hidden).toBe(false));

    const botonesGfdf = elementos['filas-ayuntamientos'].children[0].children[6].children[0].children;
    await botonesGfdf[0].click();
    obtenerControl(elementos, 'cif').value = 'TEST-CIF-0019';
    await elementos['formulario-ayuntamiento'].submit();

    await vi.waitFor(() =>
      expect(elementos['estado-formulario'].textContent)
        .toContain('El CIF ya está registrado.'),
    );
    expect(api.actualizarAyuntamiento).toHaveBeenCalledWith(
      gfdf.id,
      expect.objectContaining({ cif: 'TEST-CIF-0019' }),
    );
    expect(api.listarAyuntamientos).toHaveBeenCalledOnce();
    expect(elementos['filas-ayuntamientos'].children.map((fila) => fila.children[0].textContent))
      .toEqual(['GFDF', 'TEST-CIF-0019']);
    expect(elementos['estado-formulario'].className).toBe('form-status message-error');
    expect(elementos['estado-formulario'].attributes.role).toBe('alert');
    expect(elementos['estado-formulario'].attributes['aria-live']).toBe('assertive');
    expect(elementos['seccion-formulario'].hidden).toBe(false);
  });

  it('cancelar oculta y limpia los valores antes de iniciar una nueva alta', async () => {
    const { documento, elementos } = crearDocumentoSimulado();
    const api = crearApiSimulada([]);
    iniciarInterfaz({ documento, api });
    await esperarListado(elementos);

    await elementos['nuevo-ayuntamiento'].click();
    rellenarObligatorios(elementos);
    obtenerControl(elementos, 'telefono').value = 'TEST-TELEFONO-003';
    elementos['nuevo-ayuntamiento'].focused = false;
    await elementos['cancelar-formulario'].click();
    expect(elementos['seccion-formulario'].hidden).toBe(true);
    expect(elementos['nuevo-ayuntamiento'].focused).toBe(true);

    await elementos['nuevo-ayuntamiento'].click();
    expect(obtenerControl(elementos, 'cif').value).toBe('');
    expect(obtenerControl(elementos, 'denominacion').value).toBe('');
    expect(obtenerControl(elementos, 'telefono').value).toBe('');
    expect(obtenerControl(elementos, 'estado').value).toBe('ACTIVO');
    expect(obtenerControl(elementos, 'tipo_lista_medicamentos').value).toBe('GENERAL');
  });

  it('devuelve el foco al botón de edición de la fila cuando se cancela', async () => {
    const registro = crearAyuntamiento();
    const { documento, elementos } = crearDocumentoSimulado();
    const api = crearApiSimulada([registro]);
    api.obtenerAyuntamiento.mockResolvedValue(registro);
    iniciarInterfaz({ documento, api });
    await vi.waitFor(() => expect(elementos['tabla-ayuntamientos'].hidden).toBe(false));

    const botonEditar = elementos['filas-ayuntamientos'].children[0].children[6].children[0].children[0];
    await botonEditar.click();
    expect(obtenerControl(elementos, 'cif').focused).toBe(true);
    botonEditar.focused = false;
    await elementos['cancelar-formulario'].click();

    expect(elementos['seccion-formulario'].hidden).toBe(true);
    expect(botonEditar.focused).toBe(true);
  });

  it.each([
    ['ACTIVO', 'INACTIVO', 'Desactivar'],
    ['INACTIVO', 'ACTIVO', 'Activar'],
  ])('cambia estado de %s a %s mediante PUT completo', async (estadoActual, estadoNuevo, etiqueta) => {
    const registro = crearAyuntamiento({ estado: estadoActual });
    const { documento, elementos } = crearDocumentoSimulado();
    const api = crearApiSimulada([registro]);
    api.obtenerAyuntamiento.mockResolvedValue(registro);
    api.listarAyuntamientos
      .mockResolvedValueOnce([registro])
      .mockResolvedValueOnce([{ ...registro, estado: estadoNuevo }]);
    iniciarInterfaz({ documento, api });
    await vi.waitFor(() => expect(elementos['tabla-ayuntamientos'].hidden).toBe(false));

    const botones = elementos['filas-ayuntamientos'].children[0].children[6].children[0].children;
    expect(botones[1].textContent).toBe(etiqueta);
    await botones[1].click();
    await vi.waitFor(() => expect(api.actualizarAyuntamiento).toHaveBeenCalledOnce());

    expect(api.obtenerAyuntamiento).toHaveBeenCalledWith(registro.id);
    expect(api.actualizarAyuntamiento).toHaveBeenCalledWith(registro.id, {
      ...Object.fromEntries(camposEditables.map((campo) => [campo, registro[campo]])),
      estado: estadoNuevo,
    });
    expect(api.listarAyuntamientos).toHaveBeenCalledTimes(2);
    expect(elementos['filas-ayuntamientos'].children[0].children[4].textContent)
      .toBe(estadoNuevo);
  });

  it.each([
    [400, 'Datos de ayuntamiento no válidos.'],
    [409, 'El CIF ya está registrado.'],
    [500, 'La API respondió con estado 500 y un cuerpo no JSON válido.'],
  ])('presenta errores de guardado con estado %s', async (_status, mensaje) => {
    const { documento, elementos } = crearDocumentoSimulado();
    const api = crearApiSimulada([]);
    api.crearAyuntamiento.mockRejectedValue(new Error(mensaje));
    iniciarInterfaz({ documento, api });
    await esperarListado(elementos);
    await elementos['nuevo-ayuntamiento'].click();
    rellenarObligatorios(elementos);

    await elementos['formulario-ayuntamiento'].submit();
    await vi.waitFor(() => expect(elementos['estado-formulario'].textContent).toContain(mensaje));

    expect(elementos['seccion-formulario'].hidden).toBe(false);
    expect(elementos['estado-formulario'].className).toBe('form-status message-error');
    expect(elementos['estado-formulario'].attributes.role).toBe('alert');
    expect(elementos['estado-formulario'].attributes['aria-live']).toBe('assertive');
  });

  it('presenta el error 404 al consultar un ayuntamiento que ya no existe', async () => {
    const { documento, elementos } = crearDocumentoSimulado();
    const api = crearApiSimulada([crearAyuntamiento()]);
    api.obtenerAyuntamiento.mockRejectedValue(new Error('Ayuntamiento no encontrado.'));
    iniciarInterfaz({ documento, api });
    await vi.waitFor(() => expect(elementos['tabla-ayuntamientos'].hidden).toBe(false));

    const botones = elementos['filas-ayuntamientos'].children[0].children[6].children[0].children;
    await botones[0].click();

    expect(elementos['estado-formulario'].textContent)
      .toContain('Ayuntamiento no encontrado.');
    expect(elementos['guardar-ayuntamiento'].disabled).toBe(true);
  });

  it('presenta errores de red al cambiar el estado', async () => {
    const { documento, elementos } = crearDocumentoSimulado();
    const api = crearApiSimulada([crearAyuntamiento()]);
    api.obtenerAyuntamiento.mockRejectedValue(new TypeError('fetch failed'));
    iniciarInterfaz({ documento, api });
    await vi.waitFor(() => expect(elementos['tabla-ayuntamientos'].hidden).toBe(false));

    const botones = elementos['filas-ayuntamientos'].children[0].children[6].children[0].children;
    await botones[1].click();

    expect(elementos['mensaje-operacion'].textContent)
      .toBe('No se pudo cambiar el estado. fetch failed');
    expect(elementos['mensaje-operacion'].className)
      .toBe('operation-message message-error');
    expect(elementos['mensaje-operacion'].attributes.role).toBe('alert');
  });

  it('impide un segundo envío mientras el primero continúa en curso', async () => {
    const { documento, elementos } = crearDocumentoSimulado();
    const api = crearApiSimulada([]);
    let resolverCreacion;
    api.crearAyuntamiento.mockImplementation(
      () => new Promise((resolve) => { resolverCreacion = resolve; }),
    );
    iniciarInterfaz({ documento, api });
    await esperarListado(elementos);
    await elementos['nuevo-ayuntamiento'].click();
    rellenarObligatorios(elementos);

    const primerEnvio = elementos['formulario-ayuntamiento'].submit();
    const segundoEnvio = elementos['formulario-ayuntamiento'].submit();
    await segundoEnvio;
    expect(api.crearAyuntamiento).toHaveBeenCalledOnce();
    expect(elementos['guardar-ayuntamiento'].disabled).toBe(true);

    resolverCreacion({ id: 52 });
    await primerEnvio;
    expect(api.listarAyuntamientos).toHaveBeenCalledTimes(2);
  });
});

 describe('entrada a la ficha municipal', () => {
  it('abre Farmacias asociadas desde Ficha y permite seguir con el CRUD', async () => {
    const {documento,elementos}=crearDocumentoSimulado();
    for (const id of ['lista-farmacias','resultados-farmacias','volver-resultados-farmacias','abrir-busqueda-farmacias','cerrar-busqueda-farmacias','panel-busqueda-farmacias','seleccion-farmacias','texto-seleccion-farmacias','accion-seleccion-farmacias','ficha-ayuntamiento','cerrar-ficha','recargar-farmacias','farmacias-campo','farmacias-modo','farmacias-q','buscar-farmacias-boton','confirmar-farmacia','cancelar-farmacia','confirmacion-farmacia','mensaje-farmacias','buscar-farmacias','nombre-ficha','estado-busqueda-farmacias','tabla-busqueda-farmacias','filas-busqueda-farmacias','tabla-asociadas','filas-asociadas','estado-asociadas','texto-confirmacion-farmacia']) elementos[id]=new ElementoSimulado('div');
    const ayuntamiento=crearAyuntamiento(); const api=crearApiSimulada([ayuntamiento]);
    const apiFarmacias={listarFarmaciasAsociadas:vi.fn().mockResolvedValue([])};
    iniciarInterfaz({documento,api,apiFarmacias});
    await Promise.resolve(); await Promise.resolve();
    const acciones=elementos['filas-ayuntamientos'].children[0].children.at(-1).children[0].children;
    await acciones[2].click();
    expect(elementos['nombre-ficha'].textContent).toBe(ayuntamiento.denominacion);
    expect(elementos['seccion-formulario'].hidden).toBe(true);
    expect(apiFarmacias.listarFarmaciasAsociadas).toHaveBeenCalledWith(ayuntamiento.id);
    await acciones[0].click();
    expect(elementos['ficha-ayuntamiento'].hidden).toBe(true);
    expect(elementos['campo-cif'].value).toBe(ayuntamiento.cif);
    await elementos['nuevo-ayuntamiento'].click();
    expect(elementos['titulo-formulario'].textContent).toBe('Nuevo ayuntamiento');
  });
 });

 describe('modalidad desde la ficha municipal', () => {
  it('reutiliza el PUT completo y vuelve a ambos apartados tras guardar o cancelar', async () => {
    const {documento,elementos}=crearDocumentoSimulado();
    const ids=['ficha-ayuntamiento','cerrar-ficha','recargar-farmacias','farmacias-campo','farmacias-modo','farmacias-q','buscar-farmacias-boton','confirmar-farmacia','cancelar-farmacia','confirmacion-farmacia','mensaje-farmacias','buscar-farmacias','nombre-ficha','estado-busqueda-farmacias','tabla-busqueda-farmacias','filas-busqueda-farmacias','tabla-asociadas','filas-asociadas','estado-asociadas','texto-confirmacion-farmacia','apartado-medicamentos','editar-modalidad','recargar-medicamentos','medicamentos-campo','medicamentos-modo','medicamentos-q','buscar-medicamentos-boton','confirmar-medicamento','cancelar-medicamento','confirmacion-medicamento','mensaje-medicamentos','buscar-medicamentos','modalidad-medicamentos','aviso-modalidad-medicamentos','estado-medicamentos-admitidos','tabla-medicamentos-admitidos','filas-medicamentos-admitidos','estado-busqueda-medicamentos','tabla-busqueda-medicamentos','filas-busqueda-medicamentos','texto-confirmacion-medicamento'];
    for(const id of [...ids,...['farmacias','medicamentos'].flatMap(tipo=>['abrir-busqueda','cerrar-busqueda','panel-busqueda','seleccion','texto-seleccion','accion-seleccion','lista','resultados','volver-resultados'].map(prefijo=>`${prefijo}-${tipo}`))]) elementos[id]=new ElementoSimulado('div');
    let ciudad=crearAyuntamiento();const api=crearApiSimulada([ciudad]);api.obtenerAyuntamiento.mockImplementation(async()=>ciudad);
    api.actualizarAyuntamiento.mockImplementation(async(id,datos)=>{ciudad={id,...datos};return ciudad;});
    const apiFarmacias={listarFarmaciasAsociadas:vi.fn().mockResolvedValue([])};
    const apiMedicamentos={obtenerAyuntamiento:api.obtenerAyuntamiento,listarMedicamentosAdmitidos:vi.fn().mockResolvedValue([{id:101,medicamento_id:11,codigo_nacional:'11',descripcion:'Ficticio',estado:'INACTIVO',situacion_comercial:'BAJA'}])};
    iniciarInterfaz({documento,api,apiFarmacias,apiMedicamentos});await Promise.resolve();await Promise.resolve();
    const ficha=elementos['filas-ayuntamientos'].children[0].children.at(-1).children[0].children[2];await ficha.click();expect(elementos['seccion-listado'].hidden).toBe(true);
    for(const modalidad of ['ESPECIFICA','GENERAL']){
      await elementos['editar-modalidad'].click();expect(elementos['seccion-formulario'].hidden).toBe(false);expect(elementos['ficha-ayuntamiento'].hidden).toBe(true);
      elementos['campo-tipo-lista-medicamentos'].value=modalidad;await elementos['formulario-ayuntamiento'].submit();
      expect(elementos['ficha-ayuntamiento'].hidden).toBe(false);expect(elementos['seccion-listado'].hidden).toBe(true);expect(elementos['apartado-medicamentos'].hidden).toBe(false);
      expect(elementos['modalidad-medicamentos'].textContent).toContain(modalidad==='GENERAL'?'GENERAL':'ESPECÍFICA');expect(elementos['filas-medicamentos-admitidos'].children).toHaveLength(1);
    }
    expect(api.actualizarAyuntamiento).toHaveBeenCalledTimes(2);expect(apiFarmacias.listarFarmaciasAsociadas).toHaveBeenCalledTimes(3);
    await elementos['editar-modalidad'].click();elementos['campo-tipo-lista-medicamentos'].value='ESPECIFICA';await elementos['cancelar-formulario'].click();
    expect(api.actualizarAyuntamiento).toHaveBeenCalledTimes(2);expect(elementos['modalidad-medicamentos'].textContent).toContain('GENERAL');
    expect(elementos['seccion-listado'].hidden).toBe(true);await elementos['cerrar-ficha'].click();expect(elementos['seccion-listado'].hidden).toBe(false);expect(elementos['nuevo-ayuntamiento'].focused).toBe(true);
  });
 });

const prepararFichaCompleta = () => {
  const { documento, elementos } = crearDocumentoSimulado();
  for (const [, id] of readFileSync(new URL('../public/ayuntamientos.html', import.meta.url), 'utf8').matchAll(/id="([^"]+)"/g)) {
    elementos[id] ??= new ElementoSimulado('div');
  }
  const ciudad = crearAyuntamiento();
  const api = crearApiSimulada([ciudad]);
  const apiFarmacias = { listarFarmaciasAsociadas: vi.fn().mockResolvedValue([]), buscarFarmacias: vi.fn().mockResolvedValue([]) };
  const apiMedicamentos = { obtenerAyuntamiento: api.obtenerAyuntamiento, listarMedicamentosAdmitidos: vi.fn().mockResolvedValue([]), buscarMedicamentos: vi.fn().mockResolvedValue([{ id: 11, codigo_nacional: '11', descripcion: 'Ficticio', estado: 'INACTIVO', situacion_comercial: 'BAJA' }]), asociarMedicamento: vi.fn().mockResolvedValue({}) };
  iniciarInterfaz({ documento, api, apiFarmacias, apiMedicamentos });
  const abrir = async () => { await esperarListado(elementos); await elementos['filas-ayuntamientos'].children[0].children.at(-1).children[0].children[2].click(); };
  const tecla = (id, key) => elementos[id].listeners.keydown({ key, preventDefault() {} });
  return { elementos, api, apiFarmacias, apiMedicamentos, ciudad, abrir, tecla };
};
describe('pestañas y tareas municipales', () => {
  it.each([false, true])('bloquea ficha/edición durante un PUT de estado retrasado y libera al terminar; error=%s', async (fallar) => {
    const { elementos: el, api, ciudad } = prepararFichaCompleta();
    await esperarListado(el);
    let resolver;
    let rechazar;
    api.actualizarAyuntamiento.mockImplementationOnce(() => new Promise((resolve, reject) => {
      resolver = resolve;
      rechazar = reject;
    }));
    const botones = el['filas-ayuntamientos'].children[0].children.at(-1).children[0].children;
    const envio = botones[1].click();
    await vi.waitFor(() => expect(api.actualizarAyuntamiento).toHaveBeenCalledOnce());
    expect(botones.every((boton) => boton.disabled)).toBe(true);
    expect(el['nuevo-ayuntamiento'].disabled).toBe(true);
    expect(el['volver-inicio'].attributes['aria-disabled']).toBe('true');
    expect(el['mensaje-operacion'].textContent).toContain('Guardando estado');
    const lecturas = api.obtenerAyuntamiento.mock.calls.length;
    // Invocar también los handlers: la bandera protege aunque se intente saltar el disabled.
    await botones[2].click();
    await botones[0].click();
    await el['editar-modalidad'].click();
    await el['nuevo-ayuntamiento'].click();
    await botones[1].click();
    await el['formulario-ayuntamiento'].submit();
    let impedida = false;
    el['volver-inicio'].listeners.click({ preventDefault() { impedida = true; } });
    expect(impedida).toBe(true);
    expect(api.obtenerAyuntamiento).toHaveBeenCalledTimes(lecturas);
    expect(api.actualizarAyuntamiento).toHaveBeenCalledOnce();
    expect(api.crearAyuntamiento).not.toHaveBeenCalled();
    expect(el['seccion-listado'].hidden).toBe(false);
    expect(el['seccion-formulario'].hidden).toBe(true);
    if (fallar) rechazar(new Error('PUT rechazado')); else resolver({ ...ciudad, estado: 'INACTIVO' });
    await envio;
    expect(el['nuevo-ayuntamiento'].disabled).toBe(false);
    expect(el['volver-inicio'].attributes['aria-disabled']).toBe('false');
    expect(el['mensaje-operacion'].textContent).toContain(fallar ? 'No se pudo cambiar el estado. PUT rechazado' : 'Ayuntamiento desactivado correctamente.');
    expect(el['mensaje-operacion'].attributes.role).toBe(fallar ? 'alert' : 'status');
    const actuales = el['filas-ayuntamientos'].children[0].children.at(-1).children[0].children;
    expect(actuales.every((boton) => !boton.disabled)).toBe(true);
    await actuales[2].click();
    await el['editar-modalidad'].click();
    expect(el['seccion-formulario'].hidden).toBe(false);
    el['campo-tipo-lista-medicamentos'].value = 'ESPECIFICA';
    await el['formulario-ayuntamiento'].submit();
    expect(api.actualizarAyuntamiento).toHaveBeenCalledTimes(2);
    expect(api.actualizarAyuntamiento.mock.calls[1][1].tipo_lista_medicamentos).toBe('ESPECIFICA');
  });

  it.each([false, true])('conserva los filtros al volver de edición municipal; guardar=%s', async (guardar) => {
    const { elementos: el, abrir } = prepararFichaCompleta(); await abrir();
    el['farmacias-q'].value = 'Filtro farmacia'; el['farmacias-modo'].value = 'contiene';
    el['medicamentos-q'].value = 'Filtro medicamento'; el['medicamentos-campo'].value = 'descripcion';
    await el['editar-modalidad'].click();
    expect(el['seccion-listado'].hidden).toBe(true); expect(el['ficha-ayuntamiento'].hidden).toBe(true);
    if (guardar) await el['formulario-ayuntamiento'].submit(); else await el['cancelar-formulario'].click();
    expect(el['seccion-formulario'].hidden).toBe(true); expect(el['seccion-listado'].hidden).toBe(true);
    expect(el['ficha-ayuntamiento'].hidden).toBe(false);
    expect(el['farmacias-q'].value).toBe('Filtro farmacia'); expect(el['farmacias-modo'].value).toBe('contiene');
    expect(el['medicamentos-q'].value).toBe('Filtro medicamento'); expect(el['medicamentos-campo'].value).toBe('descripcion');
  });
  it('abre Datos, solo carga el panel activo y permite flechas, Home y End', async () => {
    const { elementos: el, apiFarmacias: f, apiMedicamentos: m, abrir, tecla } = prepararFichaCompleta();
    await abrir();
    expect(el['tab-datos'].attributes['aria-selected']).toBe('true');
    expect(el['apartado-datos'].hidden).toBe(false); expect(el['apartado-farmacias'].hidden).toBe(true); expect(el['apartado-medicamentos'].hidden).toBe(true);
    expect(f.listarFarmaciasAsociadas).not.toHaveBeenCalled(); expect(m.listarMedicamentosAdmitidos).not.toHaveBeenCalled();
    await tecla('tab-datos', 'ArrowRight'); expect(f.listarFarmaciasAsociadas).toHaveBeenCalledOnce(); expect(el['tab-farmacias'].tabIndex).toBe(0);
    await tecla('tab-farmacias', 'End'); expect(m.listarMedicamentosAdmitidos).toHaveBeenCalledOnce(); expect(el['apartado-farmacias'].hidden).toBe(true);
    await tecla('tab-medicamentos', 'Home'); expect(el['apartado-datos'].hidden).toBe(false);
    await tecla('tab-datos', 'ArrowLeft'); expect(el['tab-medicamentos'].attributes['aria-selected']).toBe('true');
    await el['tab-datos'].click();
    await el['editar-modalidad'].click(); expect(el['ficha-ayuntamiento'].hidden).toBe(true);
    await el['cancelar-formulario'].click(); expect(el['tab-datos'].attributes['aria-selected']).toBe('true'); expect(el['seccion-listado'].hidden).toBe(true);
  });
  it('cambiar pestaña descarta una carga tardía y conserva filtros de búsqueda', async () => {
    const { elementos: el, apiFarmacias: f, abrir } = prepararFichaCompleta(); await abrir();
    let resolver; f.listarFarmaciasAsociadas.mockReturnValueOnce(new Promise(r => { resolver = r; }));
    const anterior = el['tab-farmacias'].click(); await el['tab-medicamentos'].click();
    resolver([{ farmacia_id: 11, denominacion: 'Antigua' }]); await anterior;
    expect(el['filas-asociadas'].children).toHaveLength(0);
    await el['tab-farmacias'].click(); await el['abrir-busqueda-farmacias'].click(); el['farmacias-q'].value = 'Filtro';
    await el['tab-datos'].click(); expect(el['panel-busqueda-farmacias'].hidden).toBe(true);
    await el['tab-farmacias'].click(); await el['abrir-busqueda-farmacias'].click(); expect(el['farmacias-q'].value).toBe('Filtro');
  });
  it('bloquea pestañas, edición y salida durante escritura y vuelve a la lista tras incorporar', async () => {
    const { elementos: el, apiMedicamentos: m, abrir, tecla } = prepararFichaCompleta(); await abrir(); await el['tab-medicamentos'].click();
    await el['abrir-busqueda-medicamentos'].click(); expect(el['lista-medicamentos'].hidden).toBe(true);
    el['medicamentos-q'].value = 'Ficticio'; await el['buscar-medicamentos'].submit();
    await el['filas-busqueda-medicamentos'].children[0].children.at(-1).children[0].click();
    expect(el['resultados-medicamentos'].hidden).toBe(true);
    let resolver; m.asociarMedicamento.mockReturnValueOnce(new Promise(r => { resolver = r; }));
    const envio = el['accion-seleccion-medicamentos'].click(); expect(el['tab-datos'].disabled).toBe(true); expect(el['cerrar-ficha'].disabled).toBe(true);
    await tecla('tab-medicamentos', 'Home'); await el['cerrar-ficha'].click(); expect(el['apartado-medicamentos'].hidden).toBe(false);
    let impedida = false; el['volver-inicio'].listeners.click({ preventDefault() { impedida = true; } }); expect(impedida).toBe(true);
    resolver({}); await envio; expect(el['lista-medicamentos'].hidden).toBe(false); expect(el['panel-busqueda-medicamentos'].hidden).toBe(true); expect(el['tab-datos'].disabled).toBe(false);
  });
  it('solo ofrece reintento tras fallos de carga y lo oculta al recuperarse', async () => {
    const { elementos: el, apiFarmacias: f, abrir } = prepararFichaCompleta(); await abrir();
    f.listarFarmaciasAsociadas.mockRejectedValueOnce(new Error('Carga fallida')); await el['tab-farmacias'].click();
    expect(el['recargar-farmacias'].hidden).toBe(false); expect(el['estado-asociadas'].textContent).toContain('Carga fallida');
    await el['recargar-farmacias'].click(); expect(el['recargar-farmacias'].hidden).toBe(true);
  });
  it('Datos permite reintentar sin mostrar los valores de una carga fallida', async () => {
    const { elementos: el, api, abrir } = prepararFichaCompleta();
    api.obtenerAyuntamiento.mockRejectedValueOnce(new Error('Datos no disponibles'));
    await abrir();
    expect(el['datos-ficha'].hidden).toBe(true); expect(el['editar-modalidad'].hidden).toBe(true);
    expect(el['reintentar-datos'].hidden).toBe(false);
    await el['reintentar-datos'].click();
    expect(el['datos-ficha'].hidden).toBe(false); expect(el['reintentar-datos'].hidden).toBe(true);
  });
});
