import { readFile } from 'node:fs/promises';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import { iniciarInforme } from '../public/js/informe-anual.js';
import { exportarInforme, verInforme } from '../public/js/informe-anual-api.js';
class Elemento {
  constructor(){this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.children=[];this.listeners=new Map();this.attributes={};}
  addEventListener(n,f){this.listeners.set(n,[...(this.listeners.get(n)??[]),f]);}
  async dispatch(n,event={preventDefault(){}}){for(const f of this.listeners.get(n)??[])await f(event);}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(n,v){this.attributes[n]=v;}
  focus(){this.focused=true;}
}
const trimestres=()=>[1,2,3,4].map((trimestre)=>({trimestre,importe_total:trimestre===1?'19999999999.98':'0.00'}));
const datos={anio:2026,detalle_mensual:false,total_anual:'19999999999.98',trimestres:trimestres(),
  ayuntamientos:[{ayuntamiento_id:1,denominacion:'Villa',total_anual:'19999999999.98',trimestres:trimestres(),
    farmacias:[{farmacia_id:2,total_anual:'19999999999.98',trimestres:trimestres(),
      identidades_b:[{soe_b:'0002',denominacion_b:'<B histórico>',cif_b:'TEST-CIF-0003'},{soe_b:'0002',denominacion_b:'Otro B',cif_b:'TEST-CIF-0011'}]}]}]};
const preparar=async(overrides={})=>{
  const html=await readFile(new URL('../public/informe-anual.html',import.meta.url),'utf8');
  const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map((m)=>[m[1],new Elemento()]));const $=(id)=>nodes.get(id);
  $('resultado-informe').hidden=true;
  vi.stubGlobal('document',{getElementById:$,createElement:()=>new Elemento()});
  const api={listarAyuntamientos:vi.fn().mockResolvedValue([{id:1,denominacion:'Villa'}]),verInforme:vi.fn().mockResolvedValue(datos),
    exportarInforme:vi.fn().mockResolvedValue(new Blob(['<Workbook/>'],{type:'application/xml'})),...overrides};
  const descargar=vi.fn();await iniciarInforme({api,descargar});$('anio-informe').value='2026';
  return {$,api,descargar};
};
const enviar=($,boton)=>$('formulario-informe').dispatch('submit',{preventDefault(){},submitter:{id:boton}});
const textos=(n)=>[n.textContent,...n.children.flatMap(textos)].filter((v)=>v!==undefined);
afterEach(()=>vi.unstubAllGlobals());
describe('pantalla del informe anual',()=>{
  it('exporta antes de ver con filtros actuales y permite consultar después',async()=>{
    const {$,api,descargar}=await preparar();$('ayuntamiento-informe').value='1';$('mensual-informe').checked=true;
    await enviar($,'exportar-informe');expect(api.verInforme).not.toHaveBeenCalled();
    expect(api.exportarInforme).toHaveBeenCalledWith({anio:'2026',ayuntamiento_id:'1',detalle_mensual:'true'});
    expect(descargar).toHaveBeenCalledWith(expect.any(Blob),'informe-anual-2026.xml');
    expect($('resultado-informe').hidden).toBe(true);expect($('exportar-informe').disabled).toBe(false);
    $('mensual-informe').checked=false;await enviar($,'ver-informe');expect(api.verInforme).toHaveBeenCalledOnce();
    expect($('resultado-informe').hidden).toBe(false);expect($('titulo-informe').focused).toBe(true);
    const t=textos($('grupos-informe'));expect(t).toContain('0002\n0002');expect(t).toContain('<B histórico>\nOtro B');
    expect(t).toContain('19999999999,98 €');
  });
  it('retira resultados al cambiar filtros y exporta el nuevo año sin reutilizar consulta',async()=>{
    const {$,api}=await preparar();await enviar($,'ver-informe');$('anio-informe').value='2027';await $('anio-informe').dispatch('input');
    expect($('resultado-informe').hidden).toBe(true);await enviar($,'exportar-informe');
    expect(api.exportarInforme).toHaveBeenCalledWith({anio:'2027',detalle_mensual:'false'});expect(api.verInforme).toHaveBeenCalledOnce();
  });
  it('resumen y desglose usan etiquetas claras y conservan identidades, columnas y subtotales',async()=>{
    const informe=structuredClone(datos);informe.detalle_mensual=true;
    for(const m of informe.ayuntamientos)for(const f of m.farmacias)for(const t of f.trimestres)t.meses=[{mes:(t.trimestre-1)*3+1,importe_total:t.importe_total}];
    const {$}=await preparar({verInforme:vi.fn().mockResolvedValue(informe)});
    $('mensual-informe').checked=true;await enviar($,'ver-informe');
    const grupo=$('grupos-informe').children[0],resumen=grupo.children[1].children[0],mensual=grupo.children[2].children[1].children[0];
    const cabeceras=(tabla)=>tabla.children[1].children[0].children.map((c)=>c.textContent);
    expect(cabeceras(resumen)).toEqual(['SOE','Denominación','CIF','T1','T2','T3','T4','Total anual']);
    expect(cabeceras(mensual)).toEqual(['SOE','Denominación','CIF','Trimestre','Mes','Importe']);
    expect(resumen.className).toBe('resumen-anual');expect(mensual.className).not.toBe('resumen-anual');
    expect(resumen.children[2].children).toHaveLength(1);
    expect(resumen.children[2].children[0].children.slice(3).map((c)=>c.textContent)).toEqual(['19999999999,98 €','0,00 €','0,00 €','0,00 €','19999999999,98 €']);
    expect(resumen.children[3].children[0].children.slice(3).map((c)=>c.textContent)).toEqual(['19999999999,98 €','0,00 €','0,00 €','0,00 €','19999999999,98 €']);
    expect(textos(grupo)).not.toContain('SOE B');expect(textos(grupo)).not.toContain('Denominación B');expect(textos(grupo)).not.toContain('CIF B');
  });
  it('limita el separador a la última columna del resumen y elimina la fijación de T4',async()=>{
    const css=await readFile(new URL('../public/css/informe-anual.css',import.meta.url),'utf8');
    expect(css).toMatch(/\.resumen-anual th:nth-child\(7\),\s*#resultado-informe \.resumen-anual td:nth-child\(7\)\s*\{[^}]*position: static;[^}]*box-shadow: none;/);
    expect(css).toMatch(/\.resumen-anual th:last-child,\s*#resultado-informe \.resumen-anual td:last-child\s*\{[^}]*position: sticky;[^}]*border-left: 1px/);
    expect(css).toContain('.resumen-anual { table-layout: fixed; }');
    expect(css).toMatch(/\.resumen-anual th:nth-child\(n\+4\):nth-child\(-n\+7\),\s*#resultado-informe \.resumen-anual td:nth-child\(n\+4\):nth-child\(-n\+7\)\s*\{\s*width: 11%; text-align: right; white-space: nowrap;/);
  });
  it('muestra errores de descarga, recupera controles y permite reintentar',async()=>{
    const {$,api,descargar}=await preparar({exportarInforme:vi.fn().mockRejectedValueOnce(new Error('Error de descarga')).mockResolvedValue(new Blob(['xml']))});
    await enviar($,'exportar-informe');expect($('error-informe').hidden).toBe(false);expect($('error-informe').textContent).toBe('Error de descarga');
    expect(descargar).not.toHaveBeenCalled();expect($('ver-informe').disabled).toBe(false);
    await enviar($,'exportar-informe');expect(api.exportarInforme).toHaveBeenCalledTimes(2);expect(descargar).toHaveBeenCalledOnce();
  });
  it('evita solicitudes simultáneas y rechaza año inválido',async()=>{
    let resolver;const pendiente=new Promise((r)=>{resolver=r;});const {$,api}=await preparar({exportarInforme:vi.fn().mockReturnValue(pendiente)});
    const primero=enviar($,'exportar-informe');expect($('ver-informe').disabled).toBe(true);
    await enviar($,'ver-informe');expect(api.verInforme).not.toHaveBeenCalled();resolver(new Blob(['xml']));await primero;
    $('anio-informe').value='0';await enviar($,'exportar-informe');expect(api.exportarInforme).toHaveBeenCalledOnce();expect($('error-informe').hidden).toBe(false);
  });
  it('sirve pantalla, recursos y acceso desde Inicio',async()=>{
    const html=await request(app).get('/informe-anual.html');expect(html.status).toBe(200);
    expect(html.text).toContain('Ver informe');expect(html.text).toContain('Exportar a Excel');
    expect(html.text).toContain('Incluir desglose por mes');expect(html.text).toContain('archivo XML compatible con Excel');
    expect(html.text).toContain('class="button button-secondary" href="/">Volver al inicio');
    expect(html.text).toMatch(/<header class="page-header page-header-with-link"><div><h1>Informe anual de precintos<\/h1>[\s\S]*?<\/div>\s*<a class="button button-secondary" href="\/">Volver al inicio<\/a><\/header>/);
    expect(html.text).not.toContain('Incluir detalle mensual');expect(html.text).not.toContain('Exportar Excel XML');
    expect((await request(app).get('/')).text).toContain('/informe-anual.html');
    for(const path of ['/js/informe-anual.js','/js/informe-anual-api.js','/css/informe-anual.css'])expect((await request(app).get(path)).status).toBe(200);
  });
  it('API usa descarga directa, devuelve blob y expone errores sin descargarlos',async()=>{
    const blob=new Blob(['xml']);vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,headers:new Headers({'content-type':'application/xml'}),blob:()=>Promise.resolve(blob)}));
    expect(await exportarInforme({anio:'2026',detalle_mensual:'false'})).toBe(blob);
    expect(fetch).toHaveBeenCalledWith('/facturaciones/informe-anual/excel?anio=2026&detalle_mensual=false');
    fetch.mockResolvedValue({ok:false,json:async()=>({error:'Año inválido'})});await expect(exportarInforme({anio:'x'})).rejects.toThrow('Año inválido');
    fetch.mockResolvedValue({ok:true,json:async()=>datos});expect(await verInforme({anio:'2026'})).toEqual(datos);
  });
});
