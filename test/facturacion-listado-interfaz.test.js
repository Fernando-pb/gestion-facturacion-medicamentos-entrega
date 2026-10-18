import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { iniciarListadoFacturacion } from '../public/js/facturacion-listado.js';
import { listarEmitidas, reabrir } from '../public/js/facturacion-listado-api.js';
class Elemento {
  constructor(tag='') { this.tag=tag;this.children=[];this.listeners={};this.value=''; }
  append(...n) { this.children.push(...n); }
  replaceChildren(...n) { this.children=n; }
  addEventListener(n,f) { this.listeners[n]=f; }
  dispatch(n,event={preventDefault(){}}) { return this.listeners[n](event); }
  focus() { this.focused=true; }
  setAttribute(n,v) { this[n]=v; }
}
const filas=()=>[
  {facturacion_id:8,mes:1,anio:2027,ayuntamiento:'Alfa',importe_precintos:'12.34',importe_comision:'0.40',tiene_cobros:false,factura_precintos_cobrada:false,factura_comision_cobrada:false},
  {facturacion_id:9,mes:1,anio:2027,ayuntamiento:'Zeta',importe_precintos:'0.00',importe_comision:'0.00',tiene_cobros:true,factura_precintos_cobrada:true,factura_comision_cobrada:true},
  {facturacion_id:2,mes:12,anio:2026,ayuntamiento:'<Ayuntamiento>',importe_precintos:'6.00',importe_comision:'0.19',tiene_cobros:false,factura_precintos_cobrada:false,factura_comision_cobrada:false},
];
const preparar=async(api)=>{
  const html=await readFile(new URL('../public/facturacion-municipal.html',import.meta.url),'utf8');
  const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Elemento()]));
  const $=id=>nodes.get(id);await iniciarListadoFacturacion({documento:{getElementById:$,createElement:tag=>new Elemento(tag)},api});return $;
};
afterEach(()=>vi.unstubAllGlobals());
const procesoEmitido=()=>({facturacion_id:8,estado:'EMITIDA',cobros:[],facturas:[
  {id:81,tipo:'PRECINTOS',numero_factura:'000P'}, {id:82,tipo:'COMISION',numero_factura:'000C'}]});
describe('reapertura de facturación completa',()=>{
  it.each([81,82])('reconsulta tras 409 por cobro concurrente en factura %s y no permite rehabilitar Confirmar',async(facturaId)=>{
    const mensaje='Solo se puede reabrir una facturación emitida sin cobros.';
    const api={listarEmitidas:vi.fn().mockResolvedValue(filas()),consultar:vi.fn().mockResolvedValueOnce(procesoEmitido()).mockResolvedValue({...procesoEmitido(),cobros:[{factura_id:facturaId}]}),reabrir:vi.fn().mockRejectedValue(Object.assign(new Error(mensaje),{estado:409}))};
    const $=await preparar(api); await $('filas-facturaciones').children[0].children[4].children[1].dispatch('click');
    $('motivo-reapertura').value='Corrección local'; $('confirmacion-reapertura').checked=true;
    await $('formulario-reapertura').dispatch('submit');
    expect(api.consultar).toHaveBeenCalledTimes(2); expect(api.consultar).toHaveBeenLastCalledWith(8);
    expect($('error-reapertura').textContent).toBe(mensaje); expect($('estado-reapertura').textContent).toContain('tiene cobros');
    expect($('formulario-reapertura').hidden).toBe(true); expect($('filas-facturaciones').children[0].children[4].children[1].disabled).toBe(true);
    expect($('filas-facturaciones').children[0].children[2].children[0].textContent).toBe(facturaId===81?'Cobrada':'Pendiente');
    expect($('filas-facturaciones').children[0].children[3].children[0].textContent).toBe(facturaId===82?'Cobrada':'Pendiente');
    $('confirmacion-reapertura').checked=true; await $('confirmacion-reapertura').dispatch('input');
    expect($('confirmar-reapertura').disabled).toBe(true); await $('formulario-reapertura').dispatch('submit'); expect(api.reabrir).toHaveBeenCalledOnce();
  });
  it('un 409 sin cobros no se interpreta como cobro y exige una nueva confirmación explícita',async()=>{
    const api={listarEmitidas:vi.fn().mockResolvedValue(filas()),consultar:vi.fn().mockResolvedValue(procesoEmitido()),reabrir:vi.fn().mockRejectedValue(Object.assign(new Error('Conflicto de estado'),{estado:409}))};
    const $=await preparar(api); await $('filas-facturaciones').children[0].children[4].children[1].dispatch('click');
    $('motivo-reapertura').value='Corrección'; $('confirmacion-reapertura').checked=true; await $('formulario-reapertura').dispatch('submit');
    expect(api.consultar).toHaveBeenCalledTimes(2); expect($('estado-reapertura').textContent).toContain('EMITIDA sin cobros');
    expect($('confirmacion-reapertura').checked).toBe(false); expect($('confirmar-reapertura').disabled).toBe(true);
    $('confirmacion-reapertura').checked=true; await $('confirmacion-reapertura').dispatch('input'); expect($('confirmar-reapertura').disabled).toBe(false);
  });
  it('si falla el GET tras 409 conserva el bloqueo hasta confirmar el estado sin repetir POST',async()=>{
    const api={listarEmitidas:vi.fn().mockResolvedValue(filas()),consultar:vi.fn().mockResolvedValueOnce(procesoEmitido()).mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue({...procesoEmitido(),cobros:[{factura_id:81}]}),reabrir:vi.fn().mockRejectedValue(Object.assign(new Error('Conflicto'),{estado:409}))};
    const $=await preparar(api); await $('filas-facturaciones').children[0].children[4].children[1].dispatch('click');
    $('motivo-reapertura').value='Corrección'; $('confirmacion-reapertura').checked=true; await $('formulario-reapertura').dispatch('submit');
    expect($('consultar-reapertura').hidden).toBe(false); expect($('error-reapertura').textContent).toContain('Conflicto');
    $('confirmacion-reapertura').checked=true; await $('confirmacion-reapertura').dispatch('input'); expect($('confirmar-reapertura').disabled).toBe(true);
    await $('consultar-reapertura').dispatch('click'); expect($('estado-reapertura').textContent).toContain('tiene cobros'); expect(api.reabrir).toHaveBeenCalledOnce();
  });
  it.each([undefined,'Motivo persistido por otro operador'])('recuperar REABIERTA usa solo motivo del servidor (%s), nunca el formulario local',async(motivo)=>{
    const api={listarEmitidas:vi.fn().mockResolvedValue(filas()),consultar:vi.fn().mockResolvedValueOnce(procesoEmitido()).mockResolvedValue({...procesoEmitido(),estado:'REABIERTA',...(motivo?{motivo}:{})}),reabrir:vi.fn().mockRejectedValue(Object.assign(new Error('Respuesta perdida'),{incierto:true}))};
    const $=await preparar(api); await $('filas-facturaciones').children[0].children[4].children[1].dispatch('click');
    $('motivo-reapertura').value='Texto local que no consta confirmado'; $('confirmacion-reapertura').checked=true;
    await $('formulario-reapertura').dispatch('submit'); await $('consultar-reapertura').dispatch('click');
    const mensaje=$('estado-reapertura').textContent;
    expect(mensaje).toContain('REABIERTA'); expect(mensaje).not.toContain('Texto local que no consta confirmado');
    if(motivo) expect(mensaje).toContain(`Motivo: ${motivo}`);
    else { expect(mensaje).not.toContain('Motivo:'); expect(mensaje).toContain('no ha devuelto el motivo registrado'); }
    expect(api.reabrir).toHaveBeenCalledOnce(); expect($('continuar-reapertura').href).toContain('facturacion_id=8');
  });
  it('adapta listado y acciones a fichas móviles sin heredar anchos mínimos ni texto sin envolver',async()=>{
    const css=await readFile(new URL('../public/css/facturacion-municipal.css',import.meta.url),'utf8');
    expect(css).toContain('.paso .tabla-facturaciones { min-width: 0; width: 100%; table-layout: fixed; }');
    expect(css).toContain('width: auto; white-space: normal; overflow-wrap: anywhere;');
    expect(css).toContain('.tabla-facturaciones, .tabla-facturaciones tbody { display: block; }');
    expect(css).toContain('content: attr(data-label)');
    expect(css).toContain('display: block; width: auto; padding: .5rem; white-space: normal; border: 0;');
  });
  it('una acción por facturación y bloqueo explicado si cualquiera de sus dos facturas tiene cobros',async()=>{
    const api={listarEmitidas:vi.fn().mockResolvedValue(filas()),consultar:vi.fn()}; const $=await preparar(api);
    const rows=$('filas-facturaciones').children;
    expect(rows.map(r=>r.children[4].children.filter(e=>e.tag==='button').length)).toEqual([1,1,1]);
    expect(rows[0].children[4].children[1].disabled).toBe(false);
    expect(rows[1].children[4].children[1].disabled).toBe(true);
    expect(rows[1].children[4].children[1]['aria-describedby']).toBe('bloqueo-reapertura-9');
    expect(rows[1].children[4].children[2].textContent).toContain('alguna de las dos facturas tiene cobros');
    await rows[1].children[4].children[1].dispatch('click'); expect(api.consultar).not.toHaveBeenCalled();
  });
  it('confirma el par, exige motivo, conserva motivo y ofrece continuar el mismo ID tras reapertura',async()=>{
    const api={listarEmitidas:vi.fn().mockResolvedValue(filas()),consultar:vi.fn().mockResolvedValue(procesoEmitido()),reabrir:vi.fn().mockResolvedValue({facturacion_id:8,estado:'REABIERTA'})};
    const $=await preparar(api), boton=$('filas-facturaciones').children[0].children[4].children[1];
    await boton.dispatch('click'); expect($('formulario-reapertura').hidden).toBe(false);
    expect($('contexto-reapertura').textContent).toContain('PRECINTOS: 000P'); expect($('contexto-reapertura').textContent).toContain('COMISION: 000C');
    $('motivo-reapertura').value='   '; $('confirmacion-reapertura').checked=true;
    await $('formulario-reapertura').dispatch('submit'); expect(api.reabrir).not.toHaveBeenCalled();
    $('motivo-reapertura').value=' Corrección ficticia '; await $('motivo-reapertura').dispatch('input');
    expect($('confirmacion-reapertura').checked).toBe(false); expect($('confirmar-reapertura').disabled).toBe(true);
    await $('formulario-reapertura').dispatch('submit'); expect(api.reabrir).not.toHaveBeenCalled();
    $('confirmacion-reapertura').checked=true; await $('confirmacion-reapertura').dispatch('input'); expect($('confirmar-reapertura').disabled).toBe(false);
    await $('formulario-reapertura').dispatch('submit');
    expect(api.reabrir).toHaveBeenCalledExactlyOnceWith(8,'Corrección ficticia');
    expect($('estado-reapertura').textContent).toContain('REABIERTA'); expect($('estado-reapertura').textContent).toContain('Motivo: Corrección ficticia');
    expect($('continuar-reapertura').href).toBe('/facturacion-emision.html?facturacion_id=8'); expect($('continuar-reapertura').focused).toBe(true);
    expect($('filas-facturaciones').children).toHaveLength(2);
  });
  it('reconsulta el estado y rechaza cobro posterior a la carga del listado',async()=>{
    const api={listarEmitidas:vi.fn().mockResolvedValue(filas()),consultar:vi.fn().mockResolvedValue({...procesoEmitido(),cobros:[{factura_id:82}]}),reabrir:vi.fn()};
    const $=await preparar(api); await $('filas-facturaciones').children[0].children[4].children[1].dispatch('click');
    expect($('error-reapertura').textContent).toContain('tiene cobros'); expect($('formulario-reapertura').hidden).not.toBe(false); expect(api.reabrir).not.toHaveBeenCalled();
    expect($('filas-facturaciones').children[0].children[4].children[1].disabled).toBe(true);
  });
  it('cancelar no escribe y devuelve foco; POST rechazado por servidor no anuncia reapertura',async()=>{
    const api={listarEmitidas:vi.fn().mockResolvedValue(filas()),consultar:vi.fn().mockResolvedValue(procesoEmitido()),reabrir:vi.fn().mockRejectedValue(Object.assign(new Error('Solo se puede reabrir sin cobros.'),{estado:409}))};
    const $=await preparar(api), boton=$('filas-facturaciones').children[0].children[4].children[1]; await boton.dispatch('click');
    await $('cancelar-reapertura').dispatch('click'); expect(api.reabrir).not.toHaveBeenCalled(); expect(boton.focused).toBe(true);
    await boton.dispatch('click'); $('motivo-reapertura').value='Corrección'; $('confirmacion-reapertura').checked=true; await $('formulario-reapertura').dispatch('submit');
    expect($('error-reapertura').textContent).toContain('sin cobros'); expect($('continuar-reapertura').hidden).toBe(true); expect($('confirmacion-reapertura').checked).toBe(false);
  });
  it('bloquea doble envío y recupera respuesta perdida por GET sin repetir POST',async()=>{
    let resolver; const api={listarEmitidas:vi.fn().mockResolvedValue(filas()),consultar:vi.fn().mockResolvedValue(procesoEmitido()),reabrir:vi.fn().mockImplementation(()=>new Promise((resolve,reject)=>{resolver=()=>reject(Object.assign(new Error('Sin respuesta'),{incierto:true}));}))};
    const $=await preparar(api); await $('filas-facturaciones').children[0].children[4].children[1].dispatch('click');
    $('motivo-reapertura').value='Corrección'; $('confirmacion-reapertura').checked=true;
    const envio=$('formulario-reapertura').dispatch('submit'); await $('formulario-reapertura').dispatch('submit'); expect(api.reabrir).toHaveBeenCalledOnce();
    resolver(); await envio; expect($('consultar-reapertura').hidden).toBe(false); expect($('cancelar-reapertura').disabled).toBe(true);
    api.consultar.mockResolvedValue({...procesoEmitido(),estado:'REABIERTA'}); await $('consultar-reapertura').dispatch('click');
    expect($('estado-reapertura').textContent).toContain('REABIERTA'); expect(api.reabrir).toHaveBeenCalledOnce();
  });
  it('cliente envía el motivo al endpoint de la facturación, no al de una factura',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({facturacion_id:8,estado:'REABIERTA'})}));
    await reabrir(8,'Corrección'); expect(fetch).toHaveBeenCalledWith('/facturaciones/8/reapertura', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({motivo:'Corrección'})});
  });
});
describe('entrada unificada de facturación municipal',()=>{
  it('muestra el estado de cada factura debajo de su importe, incluidos importes cero',async()=>{
    const api={listarEmitidas:vi.fn().mockResolvedValue(filas())};const $=await preparar(api);
    const rows=$('filas-facturaciones').children;
    expect(rows.map(r=>[r.children[2].children[0].textContent,r.children[3].children[0].textContent]))
      .toEqual([['Pendiente','Pendiente'],['Cobrada','Cobrada'],['Pendiente','Pendiente']]);
    expect(rows[1].children[2].textContent).toBe('0,00 €');
  });
  it.each(['','pendiente','cobrada'].flatMap(p=>['','pendiente','cobrada'].map(c=>[p,c])))
    ('combina filtros de cobro de Precintos (%s) y Comisión (%s) con Ayuntamiento y periodo',async(p,c)=>{
      const combinaciones=[[false,false],[true,false],[false,true],[true,true]];
      const datos=combinaciones.map(([precintos,comision],i)=>({...filas()[0],facturacion_id:i+20,
        factura_precintos_cobrada:precintos,factura_comision_cobrada:comision,tiene_cobros:precintos||comision}));
      const api={listarEmitidas:vi.fn().mockResolvedValue([...datos,filas()[1],{...datos[0],mes:12,anio:2026}])};
      const $=await preparar(api);
      $('ayuntamiento-filtro').value='  ÁLF  ';await $('ayuntamiento-filtro').dispatch('input');
      $('periodo-filtro').value='2027-01';await $('periodo-filtro').dispatch('change');
      $('precintos-cobro-filtro').value=p;await $('precintos-cobro-filtro').dispatch('change');
      $('comision-cobro-filtro').value=c;await $('comision-cobro-filtro').dispatch('change');
      const esperados=datos.filter(f=>(!p||f.factura_precintos_cobrada===(p==='cobrada'))&&(!c||f.factura_comision_cobrada===(c==='cobrada')));
      const rows=$('filas-facturaciones').children;
      expect(rows.map(r=>new URL(r.children[4].children[0].href,'http://localhost').searchParams.get('facturacion_id')))
        .toEqual(esperados.map(f=>String(f.facturacion_id)));
      expect($('estado-listado-facturaciones').textContent).toContain(`${esperados.length} de 6`);
      expect(api.listarEmitidas).toHaveBeenCalledOnce();
    });
  it('conserva filtros de cobro en URL, documentos y recarga, y comunica cero coincidencias',async()=>{
    const replaceState=vi.fn();vi.stubGlobal('history',{replaceState});
    vi.stubGlobal('location',{search:'?ayuntamiento_filtro=Alfa&periodo_filtro=2027-01&precintos_cobro_filtro=pendiente&comision_cobro_filtro=pendiente'});
    const api={listarEmitidas:vi.fn().mockResolvedValue(filas())};const $=await preparar(api);
    expect($('precintos-cobro-filtro').value).toBe('pendiente');expect($('comision-cobro-filtro').value).toBe('pendiente');
    const enlace=new URL($('filas-facturaciones').children[0].children[4].children[0].href,'http://localhost');
    expect(enlace.searchParams.get('precintos_cobro_filtro')).toBe('pendiente');expect(enlace.searchParams.get('comision_cobro_filtro')).toBe('pendiente');
    $('comision-cobro-filtro').value='cobrada';await $('comision-cobro-filtro').dispatch('change');
    expect(replaceState).toHaveBeenLastCalledWith(null,'','/facturacion-municipal.html?ayuntamiento_filtro=Alfa&periodo_filtro=2027-01&precintos_cobro_filtro=pendiente&comision_cobro_filtro=cobrada');
    expect($('tabla-facturaciones').hidden).toBe(true);expect($('estado-listado-facturaciones').textContent).toContain('coincidan con los filtros');
  });
  it('bloquea los filtros nuevos al fallar la carga y rechaza estados de cobro no verificados',async()=>{
    const incompleta={...filas()[0]};delete incompleta.factura_comision_cobrada;
    const api={listarEmitidas:vi.fn().mockResolvedValueOnce([incompleta]).mockResolvedValue(filas())};const $=await preparar(api);
    expect($('error-listado-facturaciones').textContent).toContain('verificar el estado de cobro');
    expect($('precintos-cobro-filtro').disabled).toBe(true);expect($('comision-cobro-filtro').disabled).toBe(true);
    await $('reintentar-listado').dispatch('click');
    expect($('precintos-cobro-filtro').disabled).toBe(false);expect($('comision-cobro-filtro').disabled).toBe(false);
  });
  it('restaura Todos ante valores de filtro de cobro desconocidos en la URL',async()=>{
    vi.stubGlobal('location',{search:'?precintos_cobro_filtro=otro&comision_cobro_filtro=true'});
    const $=await preparar({listarEmitidas:vi.fn().mockResolvedValue(filas())});
    expect($('precintos-cobro-filtro').value).toBe('');expect($('comision-cobro-filtro').value).toBe('');
    expect($('filas-facturaciones').children).toHaveLength(3);
  });
  it('Inicio ofrece un único módulo; nueva facturación abre el proceso existente y documentos vuelve al listado',async()=>{
    const inicio=(await request(app).get('/')).text;
    expect(inicio).toContain('href="/facturacion-municipal.html"');expect(inicio).not.toContain('href="/documentos-facturacion.html"');
    const pagina=(await request(app).get('/facturacion-municipal.html')).text;
    expect(pagina).toContain('Facturaciones emitidas');expect(pagina).toContain('id="nueva-facturacion" class="button button-primary" href="/facturacion-emision.html"');
    expect(pagina).not.toContain('Actualizar listado');expect(pagina).not.toContain('/configuracion-facturacion.html');
    expect(pagina).toContain('Confirmar reapertura');expect(pagina).toContain('Motivo de reapertura');expect(pagina).not.toContain('ID interno');
    expect(inicio).toContain('href="/configuracion-facturacion.html"');
    const emision=(await request(app).get('/facturacion-emision.html')).text;
    expect(emision).toContain('1. Seleccionar Ayuntamiento y periodo');expect(emision).toContain('src="/js/facturacion-municipal.js"');expect(emision).toContain('href="/facturacion-municipal.html">Volver al listado');
    expect((await request(app).get('/documentos-facturacion.html')).text).toContain('href="/facturacion-municipal.html">Volver a Facturación municipal');
  });
  it('presenta orden recibido, importes históricos y enlaces de cada fila sin cálculo ni emisión',async()=>{
    const api={listarEmitidas:vi.fn().mockResolvedValue(filas())};const $=await preparar(api);
    const rows=$('filas-facturaciones').children;
    expect(rows.map(r=>r.children[0].textContent)).toEqual(['01/2027','01/2027','12/2026']);
    expect(rows.map(r=>r.children[1].textContent)).toEqual(['Alfa','Zeta','<Ayuntamiento>']);
    expect(rows[0].children[2].textContent).toBe('12,34 €');
    expect(rows.map(r=>r.children[4].children[0].href)).toEqual([8,9,2].map(id=>`/documentos-facturacion.html?facturacion_id=${id}`));
    expect(api.listarEmitidas).toHaveBeenCalledOnce();expect($('tabla-facturaciones').hidden).toBe(false);
  });
  it('carga automáticamente al entrar y vuelve a cargar al regresar tras una nueva emisión',async()=>{
    const api={listarEmitidas:vi.fn().mockResolvedValueOnce([]).mockResolvedValue(filas())};const $=await preparar(api);
    expect($('tabla-facturaciones').hidden).toBe(true);expect($('estado-listado-facturaciones').textContent).toContain('Todavía no hay');
    expect($('reintentar-listado').hidden).toBe(true);expect(api.listarEmitidas).toHaveBeenCalledOnce();
    const vuelta=await preparar(api);expect(vuelta('filas-facturaciones').children).toHaveLength(3);expect(api.listarEmitidas).toHaveBeenCalledTimes(2);
  });
  it('solo ofrece reintento si falla la carga; una consulta correcta retira esa acción',async()=>{
    const api={listarEmitidas:vi.fn().mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue(filas())};const $=await preparar(api);
    expect($('tabla-facturaciones').hidden).toBe(true);expect($('error-listado-facturaciones').textContent).toContain('Reintentar carga');
    expect($('reintentar-listado').hidden).toBe(false);expect($('ayuntamiento-filtro').disabled).toBe(true);
    await $('reintentar-listado').dispatch('click');expect($('error-listado-facturaciones').textContent).toBe('');
    expect($('reintentar-listado').hidden).toBe(true);expect($('ayuntamiento-filtro').disabled).toBe(false);
  });
  it('filtra Ayuntamiento por descripción y periodo, combina filtros y mantiene el orden y acceso documental',async()=>{
    const api={listarEmitidas:vi.fn().mockResolvedValue(filas())};const $=await preparar(api);
    expect($('periodo-filtro').children.map(o=>o.textContent)).toEqual(['Todos los periodos','01/2027','12/2026']);
    $('periodo-filtro').value='2027-01';await $('periodo-filtro').dispatch('change');
    expect($('filas-facturaciones').children.map(r=>r.children[1].textContent)).toEqual(['Alfa','Zeta']);
    $('ayuntamiento-filtro').value='  ÁLF  ';await $('ayuntamiento-filtro').dispatch('input');
    expect($('filas-facturaciones').children).toHaveLength(1);
    const enlace=new URL($('filas-facturaciones').children[0].children[4].children[0].href,'http://localhost');
    expect(enlace.searchParams.get('facturacion_id')).toBe('8');
    expect(enlace.searchParams.get('ayuntamiento_filtro')).toBe('  ÁLF  ');expect(enlace.searchParams.get('periodo_filtro')).toBe('2027-01');
    $('periodo-filtro').value='2026-12';await $('periodo-filtro').dispatch('change');
    expect($('tabla-facturaciones').hidden).toBe(true);expect($('estado-listado-facturaciones').textContent).toContain('coincidan con los filtros');
    $('periodo-filtro').value='';$('ayuntamiento-filtro').value='';await $('ayuntamiento-filtro').dispatch('input');
    expect($('filas-facturaciones').children).toHaveLength(3);expect(api.listarEmitidas).toHaveBeenCalledOnce();
  });
  it('volver con Atrás restaura datos mediante GET y preserva filtros sin duplicar la carga inicial',async()=>{
    const eventos=new Map();vi.stubGlobal('addEventListener',vi.fn((n,f)=>eventos.set(n,f)));
    const nueva={...filas()[0],facturacion_id:10,mes:2,importe_precintos:'4.00',importe_comision:'0.13'};
    const api={listarEmitidas:vi.fn().mockResolvedValueOnce(filas()).mockResolvedValue([nueva,...filas()])};const $=await preparar(api);
    await eventos.get('pageshow')({persisted:false});expect(api.listarEmitidas).toHaveBeenCalledOnce();
    $('ayuntamiento-filtro').value='Alfa';await $('ayuntamiento-filtro').dispatch('input');
    $('precintos-cobro-filtro').value='pendiente';await $('precintos-cobro-filtro').dispatch('change');
    $('comision-cobro-filtro').value='pendiente';await $('comision-cobro-filtro').dispatch('change');
    await eventos.get('pageshow')({persisted:true});expect(api.listarEmitidas).toHaveBeenCalledTimes(2);
    expect($('filas-facturaciones').children.map(r=>r.children[0].textContent)).toEqual(['02/2027','01/2027']);
    expect($('ayuntamiento-filtro').value).toBe('Alfa');expect($('reintentar-listado').hidden).toBe(true);
    expect($('precintos-cobro-filtro').value).toBe('pendiente');expect($('comision-cobro-filtro').value).toBe('pendiente');
  });
  it('cliente utiliza solo GET',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>filas()}));expect(await listarEmitidas()).toEqual(filas());
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/facturaciones/emitidas',{method:'GET'});
  });
  it('conserva filtros en la navegación y los restaura al volver a cargar el listado',async()=>{
    const replaceState=vi.fn();vi.stubGlobal('history',{replaceState});
    const api={listarEmitidas:vi.fn().mockResolvedValue(filas())};const $=await preparar(api);
    $('ayuntamiento-filtro').value='Alfa';await $('ayuntamiento-filtro').dispatch('input');
    $('periodo-filtro').value='2027-01';await $('periodo-filtro').dispatch('change');
    expect(replaceState).toHaveBeenLastCalledWith(null,'','/facturacion-municipal.html?ayuntamiento_filtro=Alfa&periodo_filtro=2027-01');
    vi.stubGlobal('location',{search:'?ayuntamiento_filtro=Alfa&periodo_filtro=2027-01'});
    const vuelta=await preparar(api);
    expect(vuelta('ayuntamiento-filtro').value).toBe('Alfa');expect(vuelta('periodo-filtro').value).toBe('2027-01');
    expect(vuelta('filas-facturaciones').children).toHaveLength(1);
    expect(vuelta('filas-facturaciones').children[0].children[1].textContent).toBe('Alfa');
  });
});
