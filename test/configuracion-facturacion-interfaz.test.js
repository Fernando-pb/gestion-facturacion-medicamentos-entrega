import {readFile} from 'node:fs/promises';
import {describe,it,expect,vi} from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import {iniciarTasas} from '../public/js/configuracion-facturacion.js';
import {ErrorFacturacion} from '../public/js/facturacion-municipal-api.js';
class Elemento{
  constructor(){this.value='';this.children=[];this.listeners={};this.hidden=false;}
  addEventListener(n,f){this.listeners[n]=f;}
  dispatch(n){return this.listeners[n]({preventDefault(){}});}
  append(...n){this.children.push(...n);}
  replaceChildren(...n){this.children=n;}
  setAttribute(){}
  focus(){this.focused=true;}
}
const fila={id:5,porcentaje_comision:'2.7000',porcentaje_iva:'21.0000',fecha_inicio:'2026-01-01',fecha_fin:null,utilizada:false};
const preparar=async(overrides={})=>{
  const html=await readFile(new URL('../public/configuracion-facturacion.html',import.meta.url),'utf8');
  const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],Object.assign(new Elemento(),{id:m[1]})]));
  nodes.get('edicion-tasas').hidden=true;
  const documento={getElementById:id=>nodes.get(id),createElement:()=>new Elemento(),querySelectorAll:()=>[...nodes.values()]};
  const api={listar:vi.fn().mockResolvedValue([]),guardar:vi.fn().mockResolvedValue(fila),...overrides};
  await iniciarTasas({documento,api});return {$:id=>nodes.get(id),api};
};
const completar=($)=>{$('comision-tasa').value='2,7000';$('iva-tasa').value='21';$('inicio-tasa').value='2026-01-01';$('fin-tasa').value='';};
describe('configuración de tasas en pantalla',()=>{
  it('presenta porcentajes y fechas españoles sin modificar datos ni valores del formulario',async()=>{
    const datos=[{...fila,fecha_inicio:'2020-01-01'}, {...fila,id:6,porcentaje_comision:'2.7010',porcentaje_iva:'0.0001',fecha_inicio:'0001-01-01',fecha_fin:'2026-12-31'}];
    const original=structuredClone(datos);
    const {$,api}=await preparar({listar:vi.fn().mockResolvedValue(datos)});
    const celdas=i=>$('filas-tasas').children[i].children.slice(0,5).map(n=>n.textContent);
    expect(celdas(0)).toEqual(['2,7 %','21 %','01/01/2020','Sin fin','Sin utilizar']);
    expect(celdas(1)).toEqual(['2,701 %','0,0001 %','01/01/0001','31/12/2026','Sin utilizar']);
    expect(datos).toEqual(original);expect(api.guardar).not.toHaveBeenCalled();
    await $('filas-tasas').children[0].children[5].children[0].dispatch('click');
    expect($('comision-tasa').value).toBe('2,7000');expect($('iva-tasa').value).toBe('21,0000');expect($('inicio-tasa').value).toBe('2020-01-01');
  });
  it.each(['0.0000','100.0000'])('presenta %s sin ceros decimales',async valor=>{
    const {$}=await preparar({listar:vi.fn().mockResolvedValue([{...fila,porcentaje_comision:valor}])});
    expect($('filas-tasas').children[0].children[0].textContent).toBe(`${valor.split('.')[0]} %`);
  });
  it('no enfoca el título al cargar; conserva foco de navegación al editar y volver',async()=>{
    const {$}=await preparar();expect($('titulo-lista-tasas').focused).not.toBe(true);
    expect($('estado-tasas').textContent).toBe('Vigencias cargadas.');expect($('recuperar-tasas').hidden).toBe(true);
    await $('nueva-tasa').dispatch('click');expect($('titulo-edicion-tasas').focused).toBe(true);
    await $('cancelar-tasa').dispatch('click');expect($('titulo-lista-tasas').focused).toBe(true);
    const css=await readFile(new URL('../public/css/configuracion-facturacion.css',import.meta.url),'utf8');
    expect(css).toContain('h2[tabindex="-1"]:focus {outline:3px solid #1468b3;outline-offset:3px;}');
  });
  it('permite reintentar una carga fallida sin guardar y retira el reintento tras obtener datos',async()=>{
    const {$,api}=await preparar({listar:vi.fn().mockRejectedValueOnce(new Error('No se pudieron cargar las vigencias.')).mockResolvedValueOnce([fila])});
    expect($('estado-tasas').textContent).toBe('');expect($('error-tasas').textContent).toBe('No se pudieron cargar las vigencias.');
    expect($('nueva-tasa').disabled).toBe(true);expect($('recuperar-tasas').hidden).toBe(false);expect($('recuperar-tasas').disabled).toBe(false);
    expect($('recuperar-tasas').textContent).toBe('Reintentar carga de vigencias');
    await $('recuperar-tasas').dispatch('click');expect(api.listar).toHaveBeenCalledTimes(2);expect(api.guardar).not.toHaveBeenCalled();
    expect($('estado-tasas').textContent).toBe('Vigencias cargadas.');expect($('error-tasas').hidden).toBe(true);expect($('recuperar-tasas').hidden).toBe(true);expect($('nueva-tasa').disabled).toBe(false);
  });
  it('retira accesos redundantes y mantiene nueva vigencia y retorno secundario a Inicio',async()=>{
    const html=await readFile(new URL('../public/configuracion-facturacion.html',import.meta.url),'utf8');
    expect(html).not.toContain('id="actualizar-tasas"');expect(html).not.toContain('Ir a Facturación municipal');
    expect(html).toContain('id="nueva-tasa" class="button button-primary"');expect(html).toContain('id="inicio-tasas" class="button button-secondary" href="/"');
  });
  it('muestra vacío sin inventar tasas y crea vigencia abierta con decimales exactos',async()=>{
    const {$,api}=await preparar();expect($('vacio-tasas').hidden).toBe(false);await $('nueva-tasa').dispatch('click');
    expect($('comision-tasa').value).toBe('');completar($);await $('formulario-tasas').dispatch('submit');
    expect(api.guardar).toHaveBeenCalledWith(null,{porcentaje_comision:'2.7000',porcentaje_iva:'21',fecha_inicio:'2026-01-01',fecha_fin:null});
    expect($('estado-tasas').textContent).toBe('Vigencia guardada.');
  });
  it('configuración utilizada muestra tasas/inicio fijos y permite revisar fin',async()=>{
    const {$,api}=await preparar({listar:vi.fn().mockResolvedValue([{...fila,utilizada:true}])});
    await $('filas-tasas').children[0].children[5].children[0].dispatch('click');
    expect($('comision-tasa').readOnly).toBe(true);expect($('inicio-tasa').readOnly).toBe(true);expect($('fin-tasa').readOnly).toBe(false);
    $('fin-tasa').value='2026-12-31';await $('formulario-tasas').dispatch('submit');expect(api.guardar).toHaveBeenCalledWith(5,expect.objectContaining({fecha_fin:'2026-12-31'}));
  });
  it.each(['100,0001','2,12345','-1','1e2'])('rechaza porcentaje %s sin escribir',async valor=>{
    const {$,api}=await preparar();await $('nueva-tasa').dispatch('click');completar($);$('comision-tasa').value=valor;
    await $('formulario-tasas').dispatch('submit');expect(api.guardar).not.toHaveBeenCalled();expect($('error-tasas').hidden).toBe(false);
  });
  it('error de solapamiento conserva campos; incertidumbre obliga a consultar antes de repetir',async()=>{
    const {$,api}=await preparar({guardar:vi.fn().mockRejectedValueOnce(new ErrorFacturacion('Vigencia solapada',409)).mockRejectedValueOnce(new ErrorFacturacion('Conexión perdida'))});
    await $('nueva-tasa').dispatch('click');completar($);await $('formulario-tasas').dispatch('submit');expect($('comision-tasa').value).toBe('2,7000');expect($('guardar-tasa').disabled).toBe(false);
    await $('formulario-tasas').dispatch('submit');expect($('recuperar-tasas').hidden).toBe(false);await $('formulario-tasas').dispatch('submit');expect(api.guardar).toHaveBeenCalledTimes(2);
    await $('recuperar-tasas').dispatch('click');expect($('recuperar-tasas').hidden).toBe(true);expect($('lista-tasas').hidden).toBe(false);
  });
  it('evita guardar dos veces mientras espera y rechaza fin anterior',async()=>{
    let resolver;const {$,api}=await preparar({guardar:vi.fn().mockImplementation(()=>new Promise(r=>{resolver=r;}))});
    await $('nueva-tasa').dispatch('click');completar($);$('fin-tasa').value='2025-12-31';await $('formulario-tasas').dispatch('submit');expect(api.guardar).not.toHaveBeenCalled();
    $('fin-tasa').value='';const p=$('formulario-tasas').dispatch('submit');await $('formulario-tasas').dispatch('submit');expect(api.guardar).toHaveBeenCalledOnce();resolver(fila);await p;
  });
  it('mantiene configuración en Inicio y recursos, retira su acceso de emisión y conserva retorno municipal',async()=>{
    const html=(await request(app).get('/facturacion-emision.html')).text;
    expect(html).toContain('id="inicio-facturacion" class="button button-secondary" href="/facturacion-municipal.html"');
    expect(html).not.toContain('href="/configuracion-facturacion.html"');
    expect((await request(app).get('/')).text).toContain('href="/configuracion-facturacion.html"');
    for(const ruta of ['/configuracion-facturacion.html','/css/configuracion-facturacion.css','/js/configuracion-facturacion.js','/js/configuracion-facturacion-api.js'])expect((await request(app).get(ruta)).status).toBe(200);
  });
});
