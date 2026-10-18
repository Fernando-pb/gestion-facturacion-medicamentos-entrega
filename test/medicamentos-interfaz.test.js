import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { iniciarInterfaz } from '../public/js/medicamentos.js';

const pagina = new URL('../public/medicamentos.html', import.meta.url);
const campos = [
  'codigo_nacional', 'descripcion', 'precio', 'estado', 'situacion_comercial',
  'tipo_facturacion', 'grupo_terapeutico', 'codigo_laboratorio', 'gtatc',
  'nombre_grupo', 'anexo',
];

class ElementoFalso {
  constructor() {
    this.children = [];
    this.listeners = new Map();
    this.attributes = {};
    this.value = '';
    this.text = '';
    this.hidden = false;
    this.disabled = false;
    this.isConnected = true;
    this.className = '';
  }

  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text + this.children.map((child) => child.textContent).join(''); }
  set innerHTML(_value) { throw new Error('No se debe insertar contenido de la API como HTML.'); }
  addEventListener(name, callback) {
    const callbacks = this.listeners.get(name) ?? [];
    callbacks.push(callback);
    this.listeners.set(name, callbacks);
  }
  async dispatch(name, event = {}) {
    for (const callback of this.listeners.get(name) ?? []) await callback(event);
  }
  append(...elements) { this.children.push(...elements); }
  replaceChildren(...elements) { this.children = elements; this.text = ''; }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() { this.focused = true; }
  reset() {}
}

const crearDocumento = () => {
  const ids = [
    'seccion-formulario', 'seccion-listado', 'formulario-medicamento', 'tabla-medicamentos',
    'filas-medicamentos', 'guardar-medicamento', 'cancelar-formulario', 'nuevo-medicamento',
    'estado-formulario', 'estado-listado', 'mensaje-operacion', 'reintentar-listado', 'titulo-formulario',
    ...campos.map((campo) => `campo-${campo.replaceAll('_', '-')}`),
  ];
  const elementos = new Map(ids.map((id) => [id, new ElementoFalso()]));
  return {
    elementos,
    getElementById: (id) => elementos.get(id),
    createElement: (tagName) => Object.assign(new ElementoFalso(), { tagName }),
  };
};

afterEach(() => vi.unstubAllGlobals());

describe('interfaz de Medicamentos', () => {
  it('normaliza precio en alta, conserva errores y separa euros del valor editable', async () => {
    const documento = crearDocumento(), el = (id) => documento.elementos.get(id);
    const api = { listarMedicamentos: vi.fn().mockResolvedValue([]), crearMedicamento: vi.fn().mockRejectedValue(new Error('Fallo de red')) };
    iniciarInterfaz({ documento, api });
    await el('nuevo-medicamento').dispatch('click');
    el('campo-precio').value = '9999999999,99';
    await el('formulario-medicamento').dispatch('submit', { preventDefault() {} });
    expect(api.crearMedicamento).toHaveBeenCalledWith(expect.objectContaining({ precio: '9999999999.99' }));
    expect(el('campo-precio').value).toBe('9999999999,99');
    api.crearMedicamento.mockClear(); el('campo-precio').value = '1,234';
    await el('campo-precio').dispatch('blur');
    await el('formulario-medicamento').dispatch('submit', { preventDefault() {} });
    expect(api.crearMedicamento).not.toHaveBeenCalled(); expect(el('campo-precio').value).toBe('1,234');
    el('campo-precio').value = '0'; await el('campo-precio').dispatch('blur');
    expect(el('campo-precio').value).toBe('0,00');
    const html = await readFile(pagina, 'utf8');
    expect(html).toContain('Precio (euros)');
    expect(html).toMatch(/class="campo-monetario"><input id="campo-precio"[^>]*inputmode="decimal"[^>]*><span aria-hidden="true">€<\/span>/);
  });
  it('incluye enlace desde inicio, formulario etiquetado, ambos estados y anexo sin filtro', async () => {
    const [html, inicio] = await Promise.all([
      readFile(pagina, 'utf8'),
      readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    ]);
    expect(inicio).toContain('href="/medicamentos.html"');
    expect(html).toContain('for="campo-estado"');
    expect(html).toContain('for="campo-situacion-comercial"');
    expect(html).toContain('for="campo-anexo"');
    expect(html).toContain('name="gtatc"');
    const cabeceras = [...html.matchAll(/<th\b[^>]*>(.*?)<\/th>/gs)].map(([, texto]) => texto.trim());
    expect(cabeceras).not.toContain('Grupo ATC');
    expect(cabeceras).not.toContain('Grupo terapéutico');
    expect(cabeceras).toContain('Acciones');
    expect(html).toContain('value="TD" readonly');
    expect(html).not.toMatch(/filtro|filtrar/i);
    expect(html).not.toMatch(/type="submit"[^>]*>Eliminar/i);
  });

  it('presenta lista vacía y crea con todos los campos, TD y opcionales nulos', async () => {
    const documento = crearDocumento();
    const lista = [];
    const api = {
      listarMedicamentos: vi.fn().mockImplementation(async () => lista),
      obtenerMedicamento: vi.fn(),
      crearMedicamento: vi.fn().mockImplementation(async (datos) => {
        lista.push({ id: 8, ...datos });
        return lista[0];
      }),
      actualizarMedicamento: vi.fn(),
    };
    iniciarInterfaz({ documento, api });
    await vi.waitFor(() => expect(documento.elementos.get('estado-listado').textContent)
      .toBe('No hay medicamentos registrados.'));

    await documento.elementos.get('nuevo-medicamento').dispatch('click');
    const valores = {
      codigo_nacional: '000123', descripcion: 'Medicamento nuevo', precio: '123.4',
      estado: 'ACTIVO', situacion_comercial: 'ALTA', tipo_facturacion: 'TD',
    };
    for (const [campo, valor] of Object.entries(valores)) {
      documento.elementos.get(`campo-${campo.replaceAll('_', '-')}`).value = valor;
    }
    await documento.elementos.get('formulario-medicamento').dispatch('submit', { preventDefault() {} });

    expect(api.crearMedicamento).toHaveBeenCalledWith(expect.objectContaining({
      ...valores,
      grupo_terapeutico: null,
      codigo_laboratorio: null,
      gtatc: null,
      nombre_grupo: null,
      anexo: null,
    }));
    expect(documento.elementos.get('tabla-medicamentos').hidden).toBe(false);
  });

  it('mantiene acciones en el listado sin columna de grupo y edita el cuerpo completo', async () => {
    const documento = crearDocumento();
    const medicamento = {
      id: 27, codigo_nacional: '00027', descripcion: '<texto seguro>', precio: '5.00',
      estado: 'ACTIVO', situacion_comercial: 'ALTA', tipo_facturacion: 'TD',
      grupo_terapeutico: null, codigo_laboratorio: null, gtatc: null,
      nombre_grupo: null, anexo: null,
    };
    const api = {
      listarMedicamentos: vi.fn().mockResolvedValue([medicamento]),
      obtenerMedicamento: vi.fn().mockResolvedValue(medicamento),
      crearMedicamento: vi.fn(),
      actualizarMedicamento: vi.fn().mockResolvedValue({ ...medicamento, estado: 'INACTIVO', situacion_comercial: 'BAJA' }),
    };
    vi.stubGlobal('document', documento);
    iniciarInterfaz({ documento, api });
    await vi.waitFor(() => expect(documento.elementos.get('tabla-medicamentos').hidden).toBe(false));
    const filas = documento.elementos.get('filas-medicamentos');
    expect(filas.children[0].children).toHaveLength(7);
    expect(filas.children[0].attributes.role).toBe('row');
    expect(filas.children[0].children.at(-1).attributes.role).toBe('cell');
    expect(filas.children[0].children.at(-1).attributes['data-label']).toBe('Acciones');
    expect(filas.children[0].children.at(-1).children[0].textContent).toBe('Ver/Editar');
    expect(filas.children[0].children.at(-1).children[0].attributes['aria-label'])
      .toBe('Ver o editar medicamento 00027');
    expect(filas.children[0].children[1].textContent).toBe('<texto seguro>');
    await filas.children[0].children[6].children[0].dispatch('click');
    expect(api.obtenerMedicamento).toHaveBeenCalledWith(medicamento.id);
    documento.elementos.get('campo-estado').value = 'INACTIVO';
    documento.elementos.get('campo-situacion-comercial').value = 'BAJA';
    await documento.elementos.get('formulario-medicamento').dispatch('submit', { preventDefault() {} });
    const [id, cuerpo] = api.actualizarMedicamento.mock.calls[0];
    expect(id).toBe(27);
    expect(Object.keys(cuerpo)).toEqual(campos);
    expect(cuerpo).not.toHaveProperty('id');
    expect(cuerpo.estado).toBe('INACTIVO');
    expect(cuerpo.situacion_comercial).toBe('BAJA');
    expect(cuerpo.tipo_facturacion).toBe('TD');
  });
});


describe('navegación uniforme de Medicamentos',()=>{
  it('alterna vistas y conserva el formulario tras validación fallida',async()=>{
    const documento=crearDocumento();const el=(id)=>documento.elementos.get(id);const med={id:1,codigo_nacional:'TEST',descripcion:'Ficticio',precio:'1.00',estado:'ACTIVO',situacion_comercial:'ALTA',tipo_facturacion:'TD'};
    const api={listarMedicamentos:vi.fn().mockResolvedValue([med]),obtenerMedicamento:vi.fn().mockResolvedValue(med),crearMedicamento:vi.fn().mockRejectedValue(new Error('Datos inválidos')),actualizarMedicamento:vi.fn().mockResolvedValue(med)};
    iniciarInterfaz({documento,api});await vi.waitFor(()=>expect(el('tabla-medicamentos').hidden).toBe(false));expect(el('seccion-formulario').hidden).toBe(true);
    await el('nuevo-medicamento').dispatch('click');expect(el('seccion-listado').hidden).toBe(true);el('campo-descripcion').value='Datos conservados';el('campo-precio').value='1,00';await el('formulario-medicamento').dispatch('submit',{preventDefault(){}});
    expect(el('campo-descripcion').value).toBe('Datos conservados');expect(el('estado-formulario').textContent).toContain('Datos inválidos');expect(el('seccion-listado').hidden).toBe(true);
    await el('cancelar-formulario').dispatch('click');expect(el('seccion-listado').hidden).toBe(false);
    await el('filas-medicamentos').children[0].children[6].children[0].dispatch('click');expect(el('seccion-listado').hidden).toBe(true);expect(el('campo-codigo-nacional').value).toBe('TEST');
    await el('formulario-medicamento').dispatch('submit',{preventDefault(){}});expect(el('seccion-listado').hidden).toBe(false);expect(el('seccion-formulario').hidden).toBe(true);
    await el('nuevo-medicamento').dispatch('click');expect(el('guardar-medicamento').disabled).toBe(false);await el('cancelar-formulario').dispatch('click');expect(el('seccion-listado').hidden).toBe(false);
  });
});
