import { describe, expect, it, vi } from 'vitest';
import { iniciarMedicamentosMunicipales } from '../public/js/ayuntamiento-medicamentos.js';
import { iniciarFarmaciasMunicipales } from '../public/js/ayuntamiento-farmacias.js';

class Elemento {
  constructor() { this.children=[]; this.listeners={}; this.attributes={}; this.value=''; }
  set textContent(valor) { this.texto=String(valor);this.children=[]; }
  get textContent() { return (this.texto??'')+this.children.map(h=>h.textContent).join(''); }
  set innerHTML(_valor) { throw new Error('No interpretar HTML de datos'); }
  append(...hijos) { this.children.push(...hijos); }
  replaceChildren(...hijos) { this.texto='';this.children=hijos; }
  setAttribute(nombre,valor) { this.attributes[nombre]=valor; }
  addEventListener(nombre,listener) { this.listeners[nombre]=listener; }
  focus() { this.focused=true; }
  async click() { return this.listeners.click({preventDefault(){}}); }
  async submit() { return this.listeners.submit({preventDefault(){}}); }
}
const pendiente=()=>{let resolve,reject;const promesa=new Promise((a,b)=>{resolve=a;reject=b;});return{promesa,resolve,reject};};
const ciudad={id:1,denominacion:'Ayuntamiento Ficticio',tipo_lista_medicamentos:'GENERAL'};
const medicamento=(cambios={})=>({id:11,codigo_nacional:'000011',descripcion:'Medicamento Ficticio',situacion_comercial:'ALTA',estado:'ACTIVO',...cambios});
const asociacion=(cambios={})=>({...medicamento(),id:101,medicamento_id:11,ayuntamiento_id:1,...cambios});
const preparar=()=>{
  const nodos={};const documento={getElementById:(id)=>nodos[id]??=new Elemento(),createElement:()=>new Elemento()};
  const el=documento.getElementById;
  const api={obtenerAyuntamiento:vi.fn().mockResolvedValue(ciudad),listarMedicamentosAdmitidos:vi.fn().mockResolvedValue([]),buscarMedicamentos:vi.fn().mockResolvedValue([medicamento()]),asociarMedicamento:vi.fn().mockResolvedValue(asociacion()),quitarMedicamento:vi.fn().mockResolvedValue(null)};
  const ui=iniciarMedicamentosMunicipales({documento,api});
  const buscar=async(q='Ficticio',campo='descripcion',modo='contiene')=>{await el('abrir-busqueda-medicamentos').click(); el('medicamentos-q').value=q;el('medicamentos-campo').value=campo;el('medicamentos-modo').value=modo;await el('buscar-medicamentos').submit();};
  const boton=(busqueda=true,indice=0)=>el(busqueda?'filas-busqueda-medicamentos':'filas-medicamentos-admitidos').children[indice].children.at(-1).children[0];
  return{ui,el,api,buscar,boton,documento};
};
describe('Medicamentos admitidos con API simulada',()=>{
  it('abre búsqueda solo al pedir añadir, conserva filtros al cerrar e invalida respuestas pendientes', async () => {
    const { ui, el, api, buscar } = preparar(); await ui.abrir(ciudad);
    expect(el('panel-busqueda-medicamentos').hidden).toBe(true);
    expect(api.buscarMedicamentos).not.toHaveBeenCalled();
    const espera = pendiente(); api.buscarMedicamentos.mockReturnValueOnce(espera.promesa);
    const consulta = buscar('Mi filtro', 'descripcion', 'prefijo');
    await el('cerrar-busqueda-medicamentos').click();
    espera.resolve([medicamento()]); await consulta;
    expect(el('filas-busqueda-medicamentos').children).toHaveLength(0);
    expect(el('abrir-busqueda-medicamentos').focused).toBe(true);
    await el('abrir-busqueda-medicamentos').click();
    expect(el('medicamentos-q').value).toBe('Mi filtro');
    expect(el('medicamentos-modo').value).toBe('prefijo');
    expect(el('medicamentos-q').focused).toBe(true);
  });
  it.each([false, true])('seleccionar asociado %s muestra únicamente la acción correspondiente', async (asociado) => {
    const { ui, el, api, buscar, boton } = preparar();
    if (asociado) api.listarMedicamentosAdmitidos.mockResolvedValue([asociacion()]);
    await ui.abrir(ciudad); await buscar(); await boton().click();
    expect(boton().textContent).toBe('Seleccionar');
    expect(el('seleccion-medicamentos').hidden).toBe(false);
    expect(el('accion-seleccion-medicamentos').hidden).toBe(asociado);
    expect(el('texto-seleccion-medicamentos').textContent).toContain(asociado ? 'ya está asociado' : 'Situación comercial: ALTA');
    expect(api.asociarMedicamento).not.toHaveBeenCalled();
    if (!asociado) {
      await el('accion-seleccion-medicamentos').click();
      expect(el('panel-busqueda-medicamentos').hidden).toBe(true);expect(el('lista-medicamentos').hidden).toBe(false);
      expect(el('seleccion-medicamentos').hidden).toBe(true);
    }
  });
  it.each(['GENERAL','ESPECIFICA'])('muestra modalidad %s incluso con lista vacía',async(modalidad)=>{
    const{ui,el,api}=preparar();api.obtenerAyuntamiento.mockResolvedValue({...ciudad,tipo_lista_medicamentos:modalidad});await ui.abrir(ciudad);
    expect(api.obtenerAyuntamiento).toHaveBeenCalledWith(1);expect(el('estado-medicamentos-admitidos').textContent).toContain('lista específica está vacía');
    expect(el('modalidad-medicamentos').textContent).toContain(modalidad==='GENERAL'?'GENERAL':'ESPECÍFICA');
    expect(el('aviso-modalidad-medicamentos').hidden).toBe(modalidad !== 'GENERAL');
    if (modalidad === 'GENERAL') {
      expect(el('aviso-modalidad-medicamentos').textContent).toContain('No se aplica mientras se utiliza la lista general');
      expect(el('aviso-modalidad-medicamentos').textContent).toContain('lista específica del Ayuntamiento');
    } else {
      expect(el('aviso-modalidad-medicamentos').textContent).toBe('');
      expect(el('modalidad-medicamentos').textContent).toContain('condiciones generales de autorización');
    }
  });
  it('conserva lista específica al activar GENERAL/ESPECIFICA sin refresco manual',async()=>{
    const{ui,el,api}=preparar();api.listarMedicamentosAdmitidos.mockResolvedValue([asociacion()]);await ui.abrir(ciudad);
    for(const modalidad of ['ESPECIFICA','GENERAL']){
      api.obtenerAyuntamiento.mockResolvedValue({...ciudad,tipo_lista_medicamentos:modalidad});await ui.activar();
      expect(el('filas-medicamentos-admitidos').children).toHaveLength(1);expect(el('tabla-medicamentos-admitidos').hidden).toBe(false);
      expect(el('aviso-modalidad-medicamentos').hidden).toBe(modalidad !== 'GENERAL');
    }
    expect(el('recargar-medicamentos').hidden).toBe(true);
    expect(api.asociarMedicamento).not.toHaveBeenCalled();expect(api.quitarMedicamento).not.toHaveBeenCalled();
  });
  it.each(['codigo_nacional','descripcion'].flatMap(campo=>['exacto','prefijo','contiene'].map(modo=>[campo,modo])))('busca %s / %s y conserva orden API',async(campo,modo)=>{
    const{ui,el,api,buscar}=preparar();api.buscarMedicamentos.mockResolvedValue([medicamento({codigo_nacional:'Z'}),medicamento({id:12,codigo_nacional:'A'})]);await ui.abrir(ciudad);await buscar('  Literal%_!  ',campo,modo);
    expect(api.buscarMedicamentos).toHaveBeenCalledWith({campo,modo,q:'Literal%_!'});
    expect(el('filas-busqueda-medicamentos').children.map(f=>f.children[0].textContent)).toEqual(['Z','A']);
  });
  it.each(['ACTIVO','INACTIVO'].flatMap(estado=>['ALTA','BAJA'].map(situacion=>[estado,situacion])))('añade %s/%s sin confundir asociación y facturabilidad',async(estado,situacion_comercial)=>{
    const{ui,el,api,buscar,boton}=preparar();api.buscarMedicamentos.mockResolvedValue([medicamento({estado,situacion_comercial})]);await ui.abrir(ciudad);await buscar();
    const celdas=el('filas-busqueda-medicamentos').children[0].children;expect(celdas[2].textContent).toBe(situacion_comercial);expect(celdas[3].textContent).toBe(estado);
    api.listarMedicamentosAdmitidos.mockResolvedValue([asociacion({estado,situacion_comercial})]);await boton().click(); await el('accion-seleccion-medicamentos').click();
    expect(api.asociarMedicamento).toHaveBeenCalledWith(1,11);expect(el('mensaje-medicamentos').textContent).toContain('no implica ser facturable');
    expect(el('filas-medicamentos-admitidos').children).toHaveLength(1);expect(api.buscarMedicamentos).toHaveBeenCalledTimes(1);
  });
  it('duplicado observado informa sin reenviar; duplicado del servidor conserva mensaje y refresca',async()=>{
    const{ui,el,api,buscar,boton}=preparar();api.listarMedicamentosAdmitidos.mockResolvedValue([asociacion()]);await ui.abrir(ciudad);await buscar();await boton().click(); await el('accion-seleccion-medicamentos').click();
    expect(el('texto-seleccion-medicamentos').textContent).toContain('ya está asociado');expect(api.asociarMedicamento).not.toHaveBeenCalled();
    api.listarMedicamentosAdmitidos.mockResolvedValue([]);await el('recargar-medicamentos').click();
    api.asociarMedicamento.mockRejectedValue(new Error('El medicamento ya está asociado a este Ayuntamiento.'));await boton().click(); await el('accion-seleccion-medicamentos').click();
    expect(el('mensaje-medicamentos').textContent).toContain('ya está asociado');expect(el('mensaje-medicamentos').attributes.role).toBe('alert');
  });
  it('retira usando medicamento_id, confirma conservación del catálogo y actualiza resultados',async()=>{
    const{ui,el,api,buscar,boton}=preparar();api.listarMedicamentosAdmitidos.mockResolvedValue([asociacion()]);await ui.abrir(ciudad);await buscar();await boton(false).click();
    expect(el('texto-confirmacion-medicamento').textContent).toContain('000011');expect(el('texto-confirmacion-medicamento').textContent).toContain(ciudad.denominacion);expect(el('texto-confirmacion-medicamento').textContent).toContain('se conserva en el catálogo');expect(api.quitarMedicamento).not.toHaveBeenCalled();
    api.listarMedicamentosAdmitidos.mockResolvedValue([]);await el('confirmar-medicamento').click();
    expect(api.quitarMedicamento).toHaveBeenCalledWith(1,11);expect(el('tabla-medicamentos-admitidos').hidden).toBe(true);await buscar();expect(el('filas-busqueda-medicamentos').children).toHaveLength(1);
    expect(el('confirmacion-medicamento').hidden).toBe(true);expect(el('mensaje-medicamentos').focused).toBe(true);
  });
  it('cancelar retirada no envía y restaura foco',async()=>{
    const{ui,el,api,boton}=preparar();api.listarMedicamentosAdmitidos.mockResolvedValue([asociacion()]);await ui.abrir(ciudad);const origen=boton(false);await origen.click();await el('cancelar-medicamento').click();await el('confirmar-medicamento').click();
    expect(api.quitarMedicamento).not.toHaveBeenCalled();expect(origen.focused).toBe(true);expect(el('confirmacion-medicamento').hidden).toBe(true);
  });
  it('comunica rechazo de retirada y conserva lista',async()=>{
    const{ui,el,api,boton}=preparar();api.listarMedicamentosAdmitidos.mockResolvedValue([asociacion()]);api.quitarMedicamento.mockRejectedValue(new Error('La asociación no existe.'));await ui.abrir(ciudad);await boton(false).click();await el('confirmar-medicamento').click();
    expect(el('mensaje-medicamentos').textContent).toContain('La asociación no existe');expect(el('filas-medicamentos-admitidos').children).toHaveLength(1);
  });
  it('descarta búsquedas anteriores y errores antiguos',async()=>{
    const{ui,el,api,buscar}=preparar();await ui.abrir(ciudad);const vieja=pendiente();api.buscarMedicamentos.mockReturnValueOnce(vieja.promesa);const p=buscar('vieja');api.buscarMedicamentos.mockResolvedValue([medicamento({descripcion:'Nueva'})]);await buscar('nueva');vieja.resolve([medicamento({descripcion:'Vieja'})]);await p;expect(el('filas-busqueda-medicamentos').textContent).toContain('Nueva');expect(el('filas-busqueda-medicamentos').textContent).not.toContain('Vieja');
    const error=pendiente();api.buscarMedicamentos.mockReturnValueOnce(error.promesa);const q=buscar('error viejo');await buscar('actual');error.reject(new Error('Error antiguo'));await q;expect(el('estado-busqueda-medicamentos').textContent).not.toContain('Error antiguo');
  });
  it('descarta lista, modalidad y búsqueda de otra ficha o cerrada',async()=>{
    const{ui,el,api,buscar}=preparar();const lista=pendiente();api.obtenerAyuntamiento.mockReturnValueOnce(lista.promesa);const apertura=ui.abrir(ciudad);
    api.obtenerAyuntamiento.mockResolvedValue({...ciudad,id:2,tipo_lista_medicamentos:'ESPECIFICA'});await ui.abrir({...ciudad,id:2});lista.resolve(ciudad);await apertura;expect(el('modalidad-medicamentos').textContent).toContain('ESPECÍFICA');
    const vieja=pendiente();api.buscarMedicamentos.mockReturnValueOnce(vieja.promesa);const p=buscar('vieja');ui.cerrar();vieja.resolve([medicamento()]);await p;expect(el('apartado-medicamentos').hidden).toBe(true);expect(el('filas-busqueda-medicamentos').children).toHaveLength(0);
  });
  it('bloquea doble envío y edición/búsqueda/cierre mientras añade',async()=>{
    const{ui,el,api,buscar,boton,editar}=preparar();await ui.abrir(ciudad);await buscar();const espera=pendiente();api.asociarMedicamento.mockReturnValue(espera.promesa);await boton().click();const envio=el('accion-seleccion-medicamentos').click();expect(ui.ocupada).toBe(true);expect(el('editar-modalidad').disabled).toBe(true);await boton().click(); await el('accion-seleccion-medicamentos').click();await buscar();ui.cerrar();expect(api.asociarMedicamento).toHaveBeenCalledTimes(1);espera.resolve(asociacion());await envio;expect(ui.ocupada).toBe(false);
  });
  it('carga, vacío y fallos de lista/modalidad/búsqueda con reintento',async()=>{
    const{ui,el,api,buscar}=preparar();const espera=pendiente();api.obtenerAyuntamiento.mockReturnValueOnce(espera.promesa);const p=ui.abrir(ciudad);expect(el('estado-medicamentos-admitidos').textContent).toContain('Cargando');espera.reject(new Error('Fallo modalidad'));await p;expect(el('modalidad-medicamentos').textContent).toContain('no disponible');expect(el('estado-medicamentos-admitidos').attributes.role).toBe('alert');await el('recargar-medicamentos').click();api.buscarMedicamentos.mockResolvedValue([]);await buscar();expect(el('estado-busqueda-medicamentos').textContent).toContain('No se encontraron');api.buscarMedicamentos.mockRejectedValue(new Error('Sin conexión'));await buscar();expect(el('estado-busqueda-medicamentos').textContent).toContain('Sin conexión');
  });
  it.each(['   ','x'.repeat(201),'a\0'])('rechaza término inválido %s',async(q)=>{
    const{ui,el,api,buscar}=preparar();await ui.abrir(ciudad);await buscar(q);expect(api.buscarMedicamentos).not.toHaveBeenCalled();expect(el('estado-busqueda-medicamentos').attributes.role).toBe('alert');
  });
  it('renderiza texto de datos como texto seguro',async()=>{
    const{ui,el,api,buscar}=preparar();api.buscarMedicamentos.mockResolvedValue([medicamento({descripcion:'<img onerror=alert(1)>'})]);await ui.abrir(ciudad);await buscar();expect(el('filas-busqueda-medicamentos').textContent).toContain('<img onerror=alert(1)>');
  });
  it('coordina bloqueo mutuo y cierre con Farmacias sin modificar sus operaciones',async()=>{
    const{documento,el,api}=preparar();let meds;const apiFarmacias={listarFarmaciasAsociadas:vi.fn().mockResolvedValue([]),buscarFarmacias:vi.fn().mockResolvedValue([])};
    const farms=iniciarFarmaciasMunicipales({documento,api:apiFarmacias,alCerrar:()=>meds.cerrar(),alIniciarTarea:()=>meds.cerrarTarea(),alCambiarBloqueo:v=>meds.bloquearExterno(v)});
    meds=iniciarMedicamentosMunicipales({documento,api,alIniciarTarea:()=>farms.cerrarTarea(),alCambiarBloqueo:v=>farms.bloquearExterno(v)});
    await farms.abrir(ciudad);await meds.abrir(ciudad);
    await el('abrir-busqueda-farmacias').click();expect(el('panel-busqueda-farmacias').hidden).toBe(false);await el('abrir-busqueda-medicamentos').click();expect(el('panel-busqueda-farmacias').hidden).toBe(true);
    await el('abrir-busqueda-medicamentos').click();el('medicamentos-q').value='Ficticio';el('medicamentos-campo').value='descripcion';el('medicamentos-modo').value='contiene';await el('buscar-medicamentos').submit();
    const espera=pendiente();api.asociarMedicamento.mockReturnValue(espera.promesa);const b=el('filas-busqueda-medicamentos').children[0].children.at(-1).children[0];await b.click();const envio=el('accion-seleccion-medicamentos').click();
    expect(farms.ocupada).toBe(true);expect(el('cerrar-ficha').disabled).toBe(true);expect(el('buscar-farmacias-boton').disabled).toBe(true);await el('cerrar-ficha').click();expect(el('apartado-medicamentos').hidden).toBe(false);
    espera.resolve(asociacion());await envio;expect(farms.ocupada).toBe(false);await el('cerrar-ficha').click();expect(el('apartado-medicamentos').hidden).toBe(true);expect(el('ficha-ayuntamiento').hidden).toBe(true);
  });
});
