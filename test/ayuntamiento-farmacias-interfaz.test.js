import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID, randomInt } from 'node:crypto';
import request from 'supertest';
import app from '../src/app.js';
import pool from '../src/db.js';
import * as clienteMunicipal from '../public/js/ayuntamientos-api.js';
import { iniciarFarmaciasMunicipales } from '../public/js/ayuntamiento-farmacias.js';

class Elemento {
  constructor() { this.children = []; this.listeners = {}; this.attributes = {}; this.value = ''; }
  set textContent(valor) { this.texto = String(valor); this.children = []; }
  get textContent() { return (this.texto ?? '') + this.children.map((hijo) => hijo.textContent).join(''); }
  set innerHTML(_valor) { throw new Error('HTML de datos no permitido'); }
  append(...hijos) { this.children.push(...hijos); }
  replaceChildren(...hijos) { this.texto = ''; this.children = hijos; }
  setAttribute(nombre, valor) { this.attributes[nombre] = valor; }
  addEventListener(nombre, listener) { this.listeners[nombre] = listener; }
  focus() { this.focused = true; }
  async click() { await this.listeners.click({ preventDefault() {} }); }
  async submit() { await this.listeners.submit({ preventDefault() {} }); }
}
const ciudad = { id: 1, denominacion: 'Ayuntamiento Destino' };
const farmacia = (cambios = {}) => ({ farmacia_id: 11, soe: 'SOE 11', denominacion: 'Farmacia Ficticia', localidad: 'Villa', cuenta_bancaria_enmascarada: '•••• 1234', ayuntamiento_id: null, ayuntamiento_denominacion: null, ...cambios });
const pendiente = () => { let resolve; let reject; const promesa = new Promise((a,b) => { resolve=a; reject=b; }); return { promesa, resolve, reject }; };
const preparar = (cliente = null) => {
  const nodos = {};
  const documento = { getElementById: (id) => nodos[id] ??= new Elemento(), createElement: () => new Elemento() };
  const api = cliente ?? { listarFarmaciasAsociadas: vi.fn().mockResolvedValue([]), buscarFarmacias: vi.fn().mockResolvedValue([farmacia()]), asignarFarmacia: vi.fn().mockResolvedValue({}), quitarFarmacia: vi.fn().mockResolvedValue(null) };
  const ui = iniciarFarmaciasMunicipales({ documento, api });
  const el = documento.getElementById;
  const buscar = async (q='Ficticia', campo='denominacion', modo='contiene') => {
await el('abrir-busqueda-farmacias').click();     el('farmacias-q').value = q; el('farmacias-campo').value = campo; el('farmacias-modo').value = modo;
    await el('buscar-farmacias').submit();
  };
  const boton = (busqueda=true, indice=0) => el(busqueda ? 'filas-busqueda-farmacias' : 'filas-asociadas').children[indice].children.at(-1).children[0];
  return { ui, el, api, buscar, boton };
};

describe('apartado municipal de Farmacias', () => {
  it('abre/cierra búsqueda conservando filtros y descarta la respuesta que llega después de cerrar', async () => {
    const { ui, el, api, buscar } = preparar();
    await ui.abrir(ciudad);
    expect(el('panel-busqueda-farmacias').hidden).toBe(true);
    expect(api.buscarFarmacias).not.toHaveBeenCalled();
    const espera = pendiente(); api.buscarFarmacias.mockReturnValueOnce(espera.promesa);
    const consulta = buscar('Filtro conservado', 'denominacion', 'prefijo');
    await el('cerrar-busqueda-farmacias').click();
    expect(el('abrir-busqueda-farmacias').focused).toBe(true);
    espera.resolve([farmacia()]); await consulta;
    expect(el('filas-busqueda-farmacias').children).toHaveLength(0);
    await el('abrir-busqueda-farmacias').click();
    expect(el('farmacias-q').value).toBe('Filtro conservado');
    expect(el('farmacias-modo').value).toBe('prefijo');
    expect(el('farmacias-q').focused).toBe(true);
  });
  it.each([null, 2, 1])('resultados de origen %s muestran acción directa o texto informativo', async (origen) => {
    const { ui, el, api, buscar, boton } = preparar();
    api.buscarFarmacias.mockResolvedValue([farmacia({ ayuntamiento_id: origen })]);
    await ui.abrir(ciudad); await buscar();
    const celda = el('filas-busqueda-farmacias').children[0].children.at(-1);
    expect(celda.textContent).toBe(origen === 1 ? 'Ya asociada' : origen === null ? 'Asignar' : 'Trasladar');
    expect(celda.children).toHaveLength(origen === 1 ? 0 : 1);
    expect(el('confirmacion-farmacia').hidden).toBe(true);
    expect(api.asignarFarmacia).not.toHaveBeenCalled();
  });
  it('abre la ficha, carga lista vacía y devuelve foco al cerrar', async () => {
    const {ui,el,api}=preparar(); const origen=new Elemento();
    await ui.abrir(ciudad, origen);
    expect(api.listarFarmaciasAsociadas).toHaveBeenCalledWith(1);
    expect(el('estado-asociadas').textContent).toContain('No hay farmacias');
    expect(el('cerrar-ficha').focused).toBe(true);
    await el('cerrar-ficha').click();
    expect(el('ficha-ayuntamiento').hidden).toBe(true); expect(origen.focused).toBe(true);
  });
  it.each(['soe','denominacion'].flatMap((campo)=>['exacto','prefijo','contiene'].map((modo)=>[campo,modo])))('busca %s en modo %s sin alterar el orden API', async (campo,modo) => {
    const {ui,el,api,buscar}=preparar();
    api.buscarFarmacias.mockResolvedValue([farmacia({soe:'Z'}),farmacia({farmacia_id:12,soe:'A'})]);
    await ui.abrir(ciudad); await buscar('  Villa  ',campo,modo);
    expect(api.buscarFarmacias).toHaveBeenCalledWith(1,{campo,modo,q:'Villa'});
    expect(el('filas-busqueda-farmacias').children.map((fila)=>fila.children[0].textContent)).toEqual(['Z','A']);
  });
  it('muestra solo proyección segura, null y texto literal', async () => {
    const {ui,el,api,buscar}=preparar();
    api.buscarFarmacias.mockResolvedValue([farmacia({denominacion:'<img onerror=alert(1)>', cuenta_bancaria_enmascarada:null, cuenta_bancaria:'CUENTA COMPLETA', banco:'SECRETO'})]);
    await ui.abrir(ciudad); await buscar();
    const texto=el('filas-busqueda-farmacias').textContent;
    expect(texto).toContain('<img onerror=alert(1)>'); expect(texto).toContain('Sin Ayuntamiento'); expect(texto).toContain('No consta');
    expect(texto).not.toContain('CUENTA COMPLETA'); expect(texto).not.toContain('SECRETO');
  });
  it.each([null,2])('asigna directamente o confirma traslado con origen observado %s y actualiza lista', async (origen) => {
    const {ui,el,api,buscar,boton}=preparar();
    api.buscarFarmacias.mockResolvedValue([farmacia({ayuntamiento_id:origen,ayuntamiento_denominacion:origen===null?null:'Ayuntamiento Origen'})]);
    await ui.abrir(ciudad); await buscar();
    api.listarFarmaciasAsociadas.mockResolvedValue([farmacia({ayuntamiento_id:1})]);
    await boton().click();
    if (origen !== null) {
    expect(el('texto-confirmacion-farmacia').textContent).toContain('Ayuntamiento Destino');
    expect(el('panel-busqueda-farmacias').hidden).toBe(true);
    expect(el('texto-confirmacion-farmacia').textContent).toContain('Ayuntamiento Origen');
    expect(el('texto-confirmacion-farmacia').textContent).toContain('Farmacia Ficticia');
    expect(api.asignarFarmacia).not.toHaveBeenCalled();
    api.buscarFarmacias.mockResolvedValue([farmacia({ayuntamiento_id:1,ayuntamiento_denominacion:ciudad.denominacion})]);
    await el('confirmar-farmacia').click();
    }
    expect(api.asignarFarmacia).toHaveBeenCalledWith(1,{farmacia_id:11,ayuntamiento_origen_id:origen});
    expect(el('filas-asociadas').children).toHaveLength(1);
    expect(el('panel-busqueda-farmacias').hidden).toBe(true);
    expect(el('confirmacion-farmacia').hidden).toBe(true);
    expect(el('lista-farmacias').hidden).toBe(false);
    expect(el('mensaje-farmacias').textContent).toContain('Farmacia asociada correctamente');
  });
  it('quita tras confirmar, conserva el maestro y actualiza resultado a sin Ayuntamiento', async () => {
    const {ui,el,api,buscar,boton}=preparar();
    api.listarFarmaciasAsociadas.mockResolvedValue([farmacia({ayuntamiento_id:1})]);
    await ui.abrir(ciudad); await buscar(); await boton(false).click();
    expect(el('texto-confirmacion-farmacia').textContent).toContain('Se conserva la farmacia y queda sin Ayuntamiento');
    api.listarFarmaciasAsociadas.mockResolvedValue([]);
    await el('confirmar-farmacia').click();
    expect(api.quitarFarmacia).toHaveBeenCalledWith(1,11);
    expect(el('tabla-asociadas').hidden).toBe(true);
    await buscar(); expect(el('filas-busqueda-farmacias').textContent).toContain('Sin Ayuntamiento');
  });
  it.each([false,true])('cancelar traslado/retirada (%s) no modifica y restaura foco', async (retirar) => {
    const {ui,el,api,buscar,boton}=preparar();
    api.listarFarmaciasAsociadas.mockResolvedValue([farmacia({ayuntamiento_id:1})]);
    api.buscarFarmacias.mockResolvedValue([farmacia({ayuntamiento_id:2,ayuntamiento_denominacion:'Origen'})]);
    await ui.abrir(ciudad); await buscar(); const origen=boton(!retirar); await origen.click();
    await el('cancelar-farmacia').click(); await el('confirmar-farmacia').click();
    expect(api.asignarFarmacia).not.toHaveBeenCalled(); expect(api.quitarFarmacia).not.toHaveBeenCalled();
    expect(retirar ? origen.focused : el('abrir-busqueda-farmacias').focused).toBe(true); expect(el('confirmacion-farmacia').hidden).toBe(true);
  });
  it('informa de duplicado observado sin enviar otra asignación', async () => {
    const {ui,el,api,buscar,boton}=preparar();
    api.buscarFarmacias.mockResolvedValue([farmacia({ayuntamiento_id:1})]);
    await ui.abrir(ciudad); await buscar();
    expect(el('filas-busqueda-farmacias').children[0].children.at(-1).textContent).toBe('Ya asociada');
    expect(boton()).toBeUndefined(); expect(api.asignarFarmacia).not.toHaveBeenCalled();
  });
  it.each(['La farmacia ya está asociada a este Ayuntamiento.', 'No se puede cambiar ni quitar la asignación: la farmacia tiene entregas o precintos registrados.', 'La asignación de origen ha cambiado. Consulta la farmacia de nuevo antes de continuar.'])('comunica error API y refresca el origen observado: %s', async (texto) => {
    const {ui,el,api,buscar,boton}=preparar();
    await ui.abrir(ciudad); await buscar();
    api.asignarFarmacia.mockRejectedValue(Object.assign(new Error(texto),{status:409}));
    await boton().click();
    expect(el('mensaje-farmacias').textContent).toContain(texto); expect(el('mensaje-farmacias').attributes.role).toBe('alert');
    expect(api.buscarFarmacias).toHaveBeenCalledTimes(2); expect(el('confirmacion-farmacia').hidden).toBe(true);
    await el('confirmar-farmacia').click(); expect(api.asignarFarmacia).toHaveBeenCalledTimes(1);
  });
  it('rechazo de retirada mantiene lista y permite recargar', async () => {
    const {ui,el,api,boton}=preparar(); api.listarFarmaciasAsociadas.mockResolvedValue([farmacia({ayuntamiento_id:1})]);
    await ui.abrir(ciudad); await boton(false).click(); api.quitarFarmacia.mockRejectedValue(new Error('Actividad registrada'));
    await el('confirmar-farmacia').click(); expect(el('filas-asociadas').children).toHaveLength(1);
    expect(el('mensaje-farmacias').textContent).toContain('Actividad registrada');
  });
  it('bloquea doble envío, búsquedas, cancelación y cierre durante operación', async () => {
    const {ui,el,api,buscar,boton}=preparar(); const espera=pendiente();
    await ui.abrir(ciudad); await buscar(); api.asignarFarmacia.mockReturnValue(espera.promesa);
    const accion = boton(); const envio=accion.click();
    expect(ui.ocupada).toBe(true); expect(el('confirmar-farmacia').disabled).toBe(true); expect(boton().disabled).toBe(true);
    await accion.click(); await el('confirmar-farmacia').click(); await buscar(); await el('cancelar-farmacia').click(); await el('cerrar-ficha').click();
    expect(api.asignarFarmacia).toHaveBeenCalledTimes(1); expect(api.buscarFarmacias).toHaveBeenCalledTimes(1);
    espera.resolve({}); await envio; expect(ui.ocupada).toBe(false); expect(el('buscar-farmacias-boton').disabled).toBe(false);
  });
  it('descarta resultados y errores de búsquedas anteriores', async () => {
    const {ui,el,api,buscar}=preparar(); const viejo=pendiente(); await ui.abrir(ciudad);
    api.buscarFarmacias.mockReturnValueOnce(viejo.promesa); const primero=buscar('viejo');
    api.buscarFarmacias.mockResolvedValue([farmacia({denominacion:'Nuevo'})]); await buscar('nuevo');
    viejo.resolve([farmacia({denominacion:'Viejo'})]); await primero;
    expect(el('filas-busqueda-farmacias').textContent).toContain('Nuevo'); expect(el('filas-busqueda-farmacias').textContent).not.toContain('Viejo');
    const errorViejo=pendiente(); api.buscarFarmacias.mockReturnValueOnce(errorViejo.promesa); const siguiente=buscar('lento'); await buscar('actual');
    errorViejo.reject(new Error('Error antiguo')); await siguiente; expect(el('estado-busqueda-farmacias').textContent).not.toContain('Error antiguo');
  });
  it('invalida lecturas al cambiar Ayuntamiento o cerrar', async () => {
    const {ui,el,api}=preparar(); const espera=pendiente(); api.listarFarmaciasAsociadas.mockReturnValueOnce(espera.promesa);
    const primero=ui.abrir(ciudad); await ui.abrir({id:2,denominacion:'Otro'}); espera.resolve([farmacia()]); await primero;
    expect(el('nombre-ficha').textContent).toBe('Otro'); expect(el('tabla-asociadas').hidden).toBe(true);
  });
  it('carga, vacío y errores de lista/búsqueda con reintento', async () => {
    const {ui,el,api,buscar}=preparar(); const espera=pendiente(); api.listarFarmaciasAsociadas.mockReturnValueOnce(espera.promesa);
    const apertura=ui.abrir(ciudad); expect(el('estado-asociadas').textContent).toContain('Cargando'); espera.reject(new Error('Sin conexión')); await apertura;
    expect(el('estado-asociadas').attributes.role).toBe('alert'); await el('recargar-farmacias').click(); expect(el('estado-asociadas').textContent).toContain('No hay');
    api.buscarFarmacias.mockResolvedValue([]); await buscar(); expect(el('estado-busqueda-farmacias').textContent).toContain('No se encontraron');
    api.buscarFarmacias.mockRejectedValue(new Error('Fallo búsqueda')); await buscar(); expect(el('estado-busqueda-farmacias').textContent).toContain('Fallo búsqueda');
  });
  it.each(['   ','x'.repeat(201),'a\0'])('rechaza término inválido sin petición', async (q) => {
    const {ui,el,api,buscar}=preparar(); await ui.abrir(ciudad); await buscar(q);
    expect(api.buscarFarmacias).not.toHaveBeenCalled(); expect(el('estado-busqueda-farmacias').attributes.role).toBe('alert');
  });
});

describe('recorrido del cliente municipal con API real y PostgreSQL', () => {
  beforeAll(async () => {
    if (process.env.DB_NAME !== 'gestion_facturacion_medicamentos_test') throw new Error('Se requiere la base dedicada de pruebas.');
    expect((await pool.query('SELECT current_database() AS nombre')).rows[0].nombre)
      .toBe('gestion_facturacion_medicamentos_test');
  });
  afterAll(async () => pool.end());

  it.each([false, true])('conserva el origen NULL y respeta el bloqueo por entrega vacía: %s', async (conEntrega) => {
    const token = `TEST-CLIENTE-${randomUUID()}`;
    let town; let farm; let mes; let entrega;
    const peticiones = [];
    // Solo adapta el transporte relativo del navegador: Express, validación, servicio y SQL son reales.
    const transporte = vi.spyOn(globalThis, 'fetch').mockImplementation(async (ruta, opciones = {}) => {
      const metodo = opciones.method ?? 'GET';
      const peticion = request(app)[metodo.toLowerCase()](ruta);
      if (opciones.headers) peticion.set(opciones.headers);
      if (opciones.body) peticion.send(JSON.parse(opciones.body));
      const respuesta = await peticion;
      peticiones.push({ ruta, metodo, cuerpo: opciones.body, estado: respuesta.status, datos: respuesta.body });
      return new Response(respuesta.text, { status: respuesta.status, headers: respuesta.headers });
    });
    try {
      town = (await pool.query(`INSERT INTO ayuntamiento
        (cif, denominacion, direccion, codigo_postal, localidad, provincia, estado, tipo_lista_medicamentos)
        VALUES ($1, 'Ayuntamiento Cliente Ficticio', 'Calle', '28001', 'Villa', 'Madrid', 'ACTIVO', 'GENERAL') RETURNING *`, [token])).rows[0];
      farm = (await pool.query(`INSERT INTO farmacia
        (soe, cif_nif, denominacion, direccion, codigo_postal, localidad, provincia, ayuntamiento_id)
        VALUES ($1, 'FICTICIO', 'Farmacia Cliente Ficticia', 'Calle', '28001', 'Villa', 'Madrid', NULL) RETURNING *`, [token])).rows[0];
      if (conEntrega) {
        mes = (await pool.query('INSERT INTO periodo (mes, anio) VALUES (1, $1) RETURNING id', [randomInt(100000, 2000000000)])).rows[0];
        entrega = (await pool.query(`INSERT INTO entrega_farmacia_periodo
          (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia)
          VALUES ($1, $2, $3, $4) RETURNING *`, [farm.id, mes.id, farm.denominacion, farm.cif_nif])).rows[0];
      }
      const { ui, el, buscar, boton } = preparar(clienteMunicipal);
      await ui.abrir(town);
      await buscar(token, 'soe', 'exacto');
      const resultado = peticiones.find((p) => p.ruta.includes('/busqueda')).datos[0];
      expect(resultado.ayuntamiento_id).toBeNull();
      expect(el('filas-busqueda-farmacias').textContent).toContain('Sin Ayuntamiento');
      expect(boton().textContent).toBe('Asignar');
      await boton().click();
      expect(el('confirmacion-farmacia').hidden).toBe(true);
      const envio = peticiones.find((p) => p.metodo === 'POST');
      expect(JSON.parse(envio.cuerpo)).toEqual({ farmacia_id: farm.id, ayuntamiento_origen_id: null });
      expect(envio.estado).toBe(conEntrega ? 409 : 200);
      const actual = (await pool.query('SELECT * FROM farmacia WHERE id = $1', [farm.id])).rows[0];
      expect(actual).toEqual({ ...farm, ayuntamiento_id: conEntrega ? null : town.id });
      if (conEntrega) {
        expect(el('mensaje-farmacias').textContent).toContain(envio.datos.error);
        expect(el('mensaje-farmacias').textContent).toContain('entregas o precintos');
        expect((await pool.query('SELECT * FROM entrega_farmacia_periodo WHERE id=$1', [entrega.id])).rows[0]).toEqual(entrega);
      } else {
        expect(el('mensaje-farmacias').textContent).toContain('Farmacia asociada correctamente');
        expect(el('lista-farmacias').hidden).toBe(false);
        expect(el('panel-busqueda-farmacias').hidden).toBe(true);
        expect(el('filas-asociadas').textContent).toContain(farm.denominacion);
      }
    } finally {
      transporte.mockRestore();
      if (entrega) await pool.query('DELETE FROM entrega_farmacia_periodo WHERE id=$1', [entrega.id]);
      if (mes) await pool.query('DELETE FROM periodo WHERE id=$1', [mes.id]);
      if (farm) await pool.query('DELETE FROM farmacia WHERE id=$1 AND soe=$2', [farm.id, token]);
      if (town) await pool.query('DELETE FROM ayuntamiento WHERE id=$1 AND cif=$2', [town.id, token]);
    }
  });
});
