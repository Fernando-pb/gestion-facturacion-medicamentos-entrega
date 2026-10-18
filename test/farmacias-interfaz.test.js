import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { iniciarInterfaz } from '../public/js/farmacias.js';

const pagina = new URL('../public/farmacias.html', import.meta.url);

class ElementoFalso {
  constructor(id = '') {
    this.id = id;
    this.children = [];
    this.listeners = new Map();
    this.attributes = {};
    this.value = '';
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.className = '';
    this.isConnected = true;
  }

  addEventListener(name, callback) {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push(callback);
    this.listeners.set(name, listeners);
  }

  async dispatch(name, event = {}) {
    for (const callback of this.listeners.get(name) ?? []) await callback(event);
  }

  append(...elements) {
    this.children.push(...elements);
  }

  replaceChildren(...elements) {
    this.children = elements;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  focus() {
    this.focused = true;
  }

  reset() {}

  querySelector(selector) {
    const value = selector.match(/\[value="(.+)"\]/)?.[1];
    return this.children.find((child) => child.value === value) ?? null;
  }
}

const crearDocumento = () => {
  const ids = [
    'seccion-formulario', 'formulario-farmacia', 'estado-formulario', 'estado-listado',
    'tabla-farmacias', 'filas-farmacias', 'guardar-farmacia', 'cancelar-formulario',
    'campo-ayuntamiento-id', 'seccion-listado', 'nuevo-farmacia', 'reintentar-listado',
    'titulo-formulario', 'mensaje-operacion',
    ...['soe', 'cif-nif', 'denominacion', 'direccion', 'codigo-postal', 'localidad',
      'provincia', 'telefono', 'pais-control-iban', 'entidad-bancaria',
      'sucursal-bancaria', 'digito-control-bancario', 'cuenta-bancaria']
      .map((name) => `campo-${name}`),
  ];
  const elementos = new Map(ids.map((id) => [id, new ElementoFalso(id)]));
  return {
    elementos,
    getElementById: (id) => elementos.get(id),
    createElement: (tag) => Object.assign(new ElementoFalso(), { tagName: tag }),
  };
};

afterEach(() => vi.unstubAllGlobals());

describe('interfaz de Farmacias', () => {
  it('publica el selector etiquetado y una tabla accesible con el ayuntamiento', async () => {
    const html = await readFile(pagina, 'utf8');
    expect(html).toContain('for="campo-ayuntamiento-id"');
    expect(html).toContain('id="campo-ayuntamiento-id" required');
    expect(html).toContain('<caption class="visually-hidden">Farmacias registradas y ayuntamientos asociados</caption>');
    expect(html).toContain('<th scope="col">Ayuntamiento</th>');
    expect(html).toContain('/css/ayuntamientos.css');
  });

  it('muestra el nombre del ayuntamiento asociado en la fila y añade su CIF', async () => {
    const documento = crearDocumento();
    vi.stubGlobal('document', documento);
    const farmacia = {
      id: 31,
      soe: 'SOE-31',
      cif_nif: 'TEST-CIF-0009',
      denominacion: 'Farmacia Ficticia',
      localidad: 'Villa',
      provincia: 'Madrid',
      ayuntamiento_id: 12,
      ayuntamiento_denominacion: 'Ayuntamiento de Villa',
      ayuntamiento_cif: 'TEST-CIF-0018',
    };
    const api = {
      listarFarmacias: vi.fn().mockResolvedValue([farmacia]),
      listarAyuntamientosParaFarmacia: vi.fn().mockResolvedValue([]),
      obtenerFarmacia: vi.fn(),
      crearFarmacia: vi.fn(),
      actualizarFarmacia: vi.fn(),
    };

    iniciarInterfaz({ api });
    await vi.waitFor(() => expect(documento.elementos.get('tabla-farmacias').hidden).toBe(false));

    const celdaAyuntamiento = documento.elementos.get('filas-farmacias').children[0].children[5];
    expect(celdaAyuntamiento.textContent).toBe('Ayuntamiento de Villa');
    expect(celdaAyuntamiento.children[1].textContent).toBe('CIF: TEST-CIF-0018');
  });

  it('muestra Sin Ayuntamiento y permite editar el maestro sin pedir ni enviar una asignación', async () => {
    const documento = crearDocumento();
    vi.stubGlobal('document', documento);
    const pharmacy = {
      id: 7, soe: 'SOE-7', cif_nif: 'TEST-CIF-0009', denominacion: 'Farmacia Sin Asignación',
      direccion: 'Calle 1', codigo_postal: '28001', localidad: 'Villa', provincia: 'Madrid',
      ayuntamiento_id: null, ayuntamiento_denominacion: null, ayuntamiento_cif: null,
    };
    const api = {
      listarFarmacias: vi.fn().mockResolvedValue([pharmacy]),
      listarAyuntamientosParaFarmacia: vi.fn().mockRejectedValue(new Error('No disponible')),
      obtenerFarmacia: vi.fn().mockResolvedValue(pharmacy),
      crearFarmacia: vi.fn(),
      actualizarFarmacia: vi.fn().mockResolvedValue(pharmacy),
    };
    iniciarInterfaz({ api });
    await vi.waitFor(() => expect(documento.elementos.get('tabla-farmacias').hidden).toBe(false));
    const row = documento.elementos.get('filas-farmacias').children[0];
    expect(row.children[5].textContent).toBe('Sin Ayuntamiento');
    expect(row.children[5].children).toHaveLength(0);
    await row.children[6].children[0].dispatch('click');
    await vi.waitFor(() => expect(documento.elementos.get('guardar-farmacia').disabled).toBe(false));
    const relation = documento.elementos.get('campo-ayuntamiento-id');
    expect(relation.disabled).toBe(true);
    expect(relation.required).toBe(false);
    expect(relation.value).toBe('');
    expect(relation.children[0].textContent).toBe('Sin Ayuntamiento');
    expect(api.listarAyuntamientosParaFarmacia).not.toHaveBeenCalled();
    await documento.elementos.get('formulario-farmacia').dispatch('submit', { preventDefault() {} });
    expect(api.actualizarFarmacia).toHaveBeenCalledOnce();
    expect(api.actualizarFarmacia.mock.calls[0][1]).not.toHaveProperty('ayuntamiento_id');
  });

  it('carga el ayuntamiento para alta y bloquea su cambio en edición sin enviarlo en PUT', async () => {
    const documento = crearDocumento();
    vi.stubGlobal('document', documento);
    const town = { id: 9, cif: 'TEST-CIF-0017', denominacion: 'Ayuntamiento Seguro' };
    const pharmacy = {
      id: 4, soe: 'SOE-4', cif_nif: 'TEST-CIF-0009', denominacion: 'Farmacia Ficticia',
      direccion: 'Calle 1', codigo_postal: '28001', localidad: 'Villa', provincia: 'Madrid',
      telefono: null, ayuntamiento_id: town.id,
      ayuntamiento_denominacion: town.denominacion, ayuntamiento_cif: town.cif,
      pais_control_iban: null, entidad_bancaria: null, sucursal_bancaria: null,
      digito_control_bancario: null, cuenta_bancaria: null,
    };
    const api = {
      listarFarmacias: vi.fn().mockResolvedValue([]),
      listarAyuntamientosParaFarmacia: vi.fn().mockResolvedValue([town]),
      obtenerFarmacia: vi.fn().mockResolvedValue(pharmacy),
      crearFarmacia: vi.fn().mockResolvedValue({ id: 5 }),
      actualizarFarmacia: vi.fn().mockResolvedValue(pharmacy),
    };

    iniciarInterfaz({ api });
    await vi.waitFor(() => expect(documento.elementos.get('estado-listado').textContent)
      .toBe('No hay farmacias registradas.'));
    await documento.elementos.get('nuevo-farmacia').dispatch('click');
    await vi.waitFor(() => expect(api.listarAyuntamientosParaFarmacia).toHaveBeenCalledOnce());
    const relation = documento.elementos.get('campo-ayuntamiento-id');
    expect(relation.children[1].textContent).toBe('Ayuntamiento Seguro (TEST-CIF-0017)');
    relation.value = String(town.id);

    for (const [name, value] of Object.entries({
      soe: 'SOE-NUEVO', cif_nif: 'TEST-CIF-0014', denominacion: 'Farmacia Nueva',
      direccion: 'Calle 2', codigo_postal: '28002', localidad: 'Villa', provincia: 'Madrid',
    })) documento.elementos.get(`campo-${name.replaceAll('_', '-')}`).value = value;
    await documento.elementos.get('formulario-farmacia').dispatch('submit', { preventDefault() {} });
    expect(api.crearFarmacia).toHaveBeenCalledWith(expect.objectContaining({ ayuntamiento_id: town.id }));

    await documento.elementos.get('filas-farmacias');
    expect(documento.elementos.get('tabla-farmacias').hidden).toBe(true);
    await api.listarFarmacias.mock.results[1]?.value;

    // Abrir el registro ficticio y comprobar que el formulario completo mantiene bloqueada la relación.
    await documento.elementos.get('nuevo-farmacia').dispatch('click');
    await documento.elementos.get('cancelar-formulario').dispatch('click');
    const apiListado = api.listarFarmacias;
    apiListado.mockResolvedValueOnce([pharmacy]);
    await documento.elementos.get('reintentar-listado').dispatch('click');
    await vi.waitFor(() => expect(documento.elementos.get('tabla-farmacias').hidden).toBe(false));
    const editButton = documento.elementos.get('filas-farmacias').children[0].children[6].children[0];
    await editButton.dispatch('click');
    await vi.waitFor(() => expect(documento.elementos.get('campo-ayuntamiento-id').disabled).toBe(true));
    expect(documento.elementos.get('campo-ayuntamiento-id').value).toBe(String(town.id));
    await documento.elementos.get('formulario-farmacia').dispatch('submit', { preventDefault() {} });
    expect(api.actualizarFarmacia).toHaveBeenCalledWith(pharmacy.id, expect.not.objectContaining({ ayuntamiento_id: expect.anything() }));
  });
});


describe('navegación uniforme de Farmacias', () => {
  it('alterna listado/alta/detalle, conserva datos ante rechazo y cancela sin guardar', async () => {
    const documento=crearDocumento(); vi.stubGlobal('document',documento); const el=(id)=>documento.elementos.get(id);
    const farm={id:7,soe:'TEST',denominacion:'Ficticia',ayuntamiento_id:null};
    const api={listarFarmacias:vi.fn().mockResolvedValue([farm]),listarAyuntamientosParaFarmacia:vi.fn().mockResolvedValue([]),obtenerFarmacia:vi.fn().mockResolvedValue(farm),crearFarmacia:vi.fn().mockRejectedValue(new Error('Datos inválidos')),actualizarFarmacia:vi.fn().mockResolvedValue(farm)};
    iniciarInterfaz({api}); await vi.waitFor(()=>expect(el('tabla-farmacias').hidden).toBe(false));
    expect(el('seccion-formulario').hidden).toBe(true);expect(el('seccion-listado').hidden).toBe(false);
    await el('nuevo-farmacia').dispatch('click');expect(el('seccion-listado').hidden).toBe(true);
    el('campo-denominacion').value='Datos conservados';await el('formulario-farmacia').dispatch('submit',{preventDefault(){}});
    expect(el('campo-denominacion').value).toBe('Datos conservados');expect(el('estado-formulario').textContent).toContain('Datos inválidos');expect(el('seccion-listado').hidden).toBe(true);
    await el('cancelar-formulario').dispatch('click');expect(el('seccion-listado').hidden).toBe(false);expect(el('seccion-formulario').hidden).toBe(true);
    await el('filas-farmacias').children[0].children[6].children[0].dispatch('click');expect(el('seccion-listado').hidden).toBe(true);expect(el('campo-soe').value).toBe('TEST');
    await el('formulario-farmacia').dispatch('submit',{preventDefault(){}});expect(el('seccion-listado').hidden).toBe(false);expect(el('seccion-formulario').hidden).toBe(true);
  });
  it('cancelar invalida una consulta de detalle pendiente',async()=>{
    const documento=crearDocumento();vi.stubGlobal('document',documento);const el=(id)=>documento.elementos.get(id);let resolver;
    const api={listarFarmacias:vi.fn().mockResolvedValue([{id:1,denominacion:'Ficticia'}]),obtenerFarmacia:vi.fn().mockReturnValue(new Promise(r=>{resolver=r;}))};
    iniciarInterfaz({api});await vi.waitFor(()=>expect(el('tabla-farmacias').hidden).toBe(false));const carga=el('filas-farmacias').children[0].children[6].children[0].dispatch('click');await el('cancelar-formulario').dispatch('click');resolver({soe:'Datos antiguos',ayuntamiento_id:null});await carga;
    expect(el('seccion-listado').hidden).toBe(false);expect(el('seccion-formulario').hidden).toBe(true);expect(el('campo-soe').value).not.toBe('Datos antiguos');
  });
});
