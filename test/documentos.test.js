import { readFile } from 'node:fs/promises';
import { afterEach,describe,it,expect,vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { logoValido,configuracionSchema } from '../src/documentos/documentos.validation.js';
import { generarDocumento } from '../public/js/documentos-plantillas.js';
import { iniciarDocumentos } from '../public/js/documentos.js';
import { iniciarBusquedaDocumentos } from '../public/js/documentos-busqueda.js';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
const datos=()=>({cabecera:{denominacion:'Villa <script>',cif:'P000',direccion:'Calle',codigo_postal:'00000',localidad:'Villa',provincia:'Provincia',mes:12,anio:2026,fecha_factura:'2026-12-31',nombre_presidente_historico:'Histórico'},
  configuracion:{logo_personalizado:png,datos_emisor:{denominacion:'Colegio',cif:'G000',direccion:'Dirección actual'}},advertencias:[],
  facturas:[{tipo:'PRECINTOS',numero_factura:'001-A',numero_precintos:2,importe_total:'156.71'}, {tipo:'COMISION',numero_factura:'GEN-001',base_calculo:'156.71',porcentaje_comision:'2.7000',importe_comision:'4.23',porcentaje_iva:'21.0000',importe_iva:'0.89',importe_total:'5.12'}],
  participaciones:[{soe_b:'0001',denominacion_b:'B original',cif_b:'B000',cantidad_precintos:2,importe_precintos:'156.71'}]});
describe('plantillas independientes',()=>{
  it('configuración asocia quitar logo con su etiqueta y agrupa carga, retirada y vista previa',async()=>{
    const html=(await request(app).get('/configuracion-documentos.html')).text;
    expect(html).toContain('<label for="nombre_presidente">Presidente</label><input id="nombre_presidente" maxlength="500">');
    expect(html).not.toContain('<label for="nombre_presidente">Presidente del Colegio emisor</label>');
    expect(html).toMatch(/<label class="quitar-logo" for="quitar-logo"><input id="quitar-logo" type="checkbox"><span>Quitar logo personalizado<\/span><\/label>/);
    expect(html).toMatch(/class="form-field form-field-wide opciones-logo"[\s\S]*id="logo"[\s\S]*id="quitar-logo"[\s\S]*id="vista-logo"[\s\S]*<\/div><\/div><div class="form-actions">/);
    expect(html.match(/id="vista-logo"/g)).toHaveLength(1);
    expect(html).toContain('id="guardar-configuracion" class="button button-primary"');
  });
  it('configuración usa retorno secundario en cabecera y estilos locales adaptables para la casilla',async()=>{
    const html=(await request(app).get('/configuracion-documentos.html')).text;
    expect(html).toContain('<header class="page-header page-header-with-link"><div><h1>Configuración de documentos</h1></div><a class="button button-secondary" href="/documentos-facturacion.html">Volver a documentos</a></header>');
    expect(html).toContain('href="/css/configuracion-documentos.css"');
    const respuesta=await request(app).get('/css/configuracion-documentos.css');expect(respuesta.status).toBe(200);
    expect(respuesta.text).toContain('display:flex;align-items:center;gap:0.65rem');
    expect(respuesta.text).toContain('input[type="checkbox"] {flex:0 0 auto;width:1.1rem;height:1.1rem;min-height:0');
    expect(respuesta.text).toContain('@media(max-width:40rem)');expect(respuesta.text).toContain('padding:1rem');
    const comun=await readFile(new URL('../public/css/ayuntamientos.css',import.meta.url),'utf8');
    expect(comun).toMatch(/@media \(max-width: 40rem\)[\s\S]*\.page-header-with-link\s*\{\s*flex-direction: column;/);
  });
  it.each(['precintos','comision','relacion','gastos'])('%s muestra total superior, logo actual, presidente histórico y texto escapado',tipo=>{
    const html=generarDocumento(datos(),tipo); expect(html).toContain('Total del Ayuntamiento'); expect(html).toContain(png);
    expect(html).toContain('Histórico'); expect(html).toContain('Villa &lt;script&gt;');expect(html).not.toContain('<script>');
    expect(html.indexOf('total-superior')).toBeLessThan(html.indexOf('presidente'));
  });
  it('separa facturas y guarda diferencias entre los dos informes',()=>{
    const d=datos(); const ambas=generarDocumento(d,'ambas');expect(ambas.match(/class="hoja factura"/g)).toHaveLength(2);
    expect(ambas).toContain('001-A');expect(ambas).toContain('GEN-001');
    const relacion=generarDocumento(d,'relacion');expect(relacion).toContain('B original');expect(relacion).toContain('B000');expect(relacion).not.toContain('Gastos de facturación');
    const gastos=generarDocumento(d,'gastos');expect(gastos).not.toContain('B original');expect(gastos).toContain('5,12 €');expect(gastos).toContain('161,83 €');expect(gastos).toContain('0,89 €');
  });
  it('valida estructura/tipo/tamaño del logo, valores de emisor y claves extra',()=>{
    expect(logoValido(png)).toBe(true);expect(logoValido(null)).toBe(true);
    for(const s of ['https://example.com/logo.png','../logo.png','data:image/png;base64,YWJj',png.slice(0,-10),'data:image/png;base64,'+'A'.repeat(1400000)]) expect(logoValido(s)).toBe(false);
    expect(configuracionSchema.safeParse({...datos().configuracion,nombre_presidente:'P'}).success).toBe(true);
    expect(configuracionSchema.safeParse({...datos().configuracion,nombre_presidente:'P',extra:true}).success).toBe(false);
  });
  it('sirve pantallas y garantiza salto de página e impresión sin controles',async()=>{
    for(const ruta of ['/documentos-facturacion.html','/configuracion-documentos.html','/js/documentos.js','/css/documentos.css']) expect((await request(app).get(ruta)).status).toBe(200);
    const css=await readFile(new URL('../public/css/documentos.css',import.meta.url),'utf8');expect(css).toContain('break-before:page');expect(css).toContain('display:none!important');expect(css).toContain('table-header-group');
    const html=(await request(app).get('/documentos-facturacion.html')).text;
    expect(html).toContain('id="volver-facturaciones" class="button button-secondary" href="/facturacion-municipal.html">Volver a Facturación municipal</a>');
    expect(html).toContain('Imprimir / Guardar como PDF');expect(html).toContain('Selecciona un documento arriba para habilitar la impresión.');
    expect(css).toContain('main>.page-header,.controles-documentos {display:none!important;}');
  });
});
class Elemento {
  constructor(){this.listeners={};this.value='';this.dataset={};this.disabled=false;}
  addEventListener(n,f){this.listeners[n]=f;}
  dispatch(n){return this.listeners[n]({preventDefault(){}});}
  replaceChildren(){this.innerHTML='';}
  querySelectorAll(){return [];}
  setAttribute(n,v){this[n]=v;}
}
const preparar=async(api,usarImpresionNativa=false,referencia="3",esperarCarga=true)=>{
  const html=await readFile(new URL('../public/documentos-facturacion.html',import.meta.url),'utf8');
  const nodos=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Elemento()]));
  const botones=['precintos','comision','ambas','relacion','gastos'].map(tipo=>{const b=new Elemento();b.dataset.documento=tipo;return b;});
  const documento={getElementById:id=>nodos.get(id),querySelectorAll:s=>s==='[data-documento]'?botones:[...nodos.values(),...botones]};
  vi.stubGlobal('location',{search:referencia===null?'':`?facturacion_id=${referencia}`});
  const imprimir=vi.fn();const carga=iniciarDocumentos({documento,api,...(usarImpresionNativa?{}:{imprimir})});if(esperarCarga)await carga;
  return {$:id=>nodos.get(id),botones,imprimir,carga,documento};
};
afterEach(()=>vi.unstubAllGlobals());
describe('flujo de impresión',()=>{
  it('un enlace de fila abre la facturación correcta, muestra Ayuntamiento/periodo y no inicia una segunda búsqueda',async()=>{
    const api={consultar:vi.fn().mockResolvedValue(datos()),listarAyuntamientos:vi.fn(),listarPeriodos:vi.fn(),buscar:vi.fn()};
    const {$,documento}=await preparar(api,false,'2&ayuntamiento_filtro=Villa&periodo_filtro=2026-12&precintos_cobro_filtro=cobrada&comision_cobro_filtro=pendiente');
    await iniciarBusquedaDocumentos({documento,api});
    expect(api.consultar).toHaveBeenCalledExactlyOnceWith('2');
    expect(api.listarAyuntamientos).not.toHaveBeenCalled();expect(api.listarPeriodos).not.toHaveBeenCalled();expect(api.buscar).not.toHaveBeenCalled();
    expect($('consulta-ayuntamiento-periodo').hidden).toBe(true);
    expect($('ayuntamiento-consultado').textContent).toBe('Ayuntamiento: Villa <script>');
    expect($('periodo-consultado').textContent).toBe('Periodo facturado: 12/2026');
    expect($('contexto-documentos').hidden).toBe(false);expect($('seleccion-documentos').hidden).toBe(false);
    expect($('volver-facturaciones').href).toBe('/facturacion-municipal.html?ayuntamiento_filtro=Villa&periodo_filtro=2026-12&precintos_cobro_filtro=cobrada&comision_cobro_filtro=pendiente');
  });
  it('Ayuntamiento y periodo localizan una emisión y abren sus cuatro documentos sin campo de referencia',async()=>{
    const api={consultar:vi.fn().mockResolvedValue(datos()),
      listarAyuntamientos:vi.fn().mockResolvedValue([{id:2,denominacion:'A1'}]),
      listarPeriodos:vi.fn().mockResolvedValue([{id:9,mes:9,anio:2026}]),
      buscar:vi.fn().mockResolvedValue({facturacion_id:2,estado:'EMITIDA'})};
    const {$,botones,imprimir,documento}=await preparar(api,false,null);
    documento.createElement=()=>new Elemento();let apertura;
    await iniciarBusquedaDocumentos({documento,api,navegar:(url)=>{
      vi.stubGlobal('location',{search:new URL(url,'http://localhost').search});
      apertura=iniciarDocumentos({documento,api,imprimir});
    }});
    $('ayuntamiento-documentos').value='2';$('periodo-documentos').value='9';
    expect($('referencia')).toBeUndefined();expect(api.consultar).not.toHaveBeenCalled();
    await $('busqueda-documentos').dispatch('submit');await apertura;
    expect(api.buscar).toHaveBeenCalledExactlyOnceWith('2','9');expect(api.consultar).toHaveBeenCalledExactlyOnceWith('2');
    expect($('seleccion-documentos').hidden).toBe(false);
    for(const boton of botones){await boton.dispatch('click');expect($('vista-documentos').innerHTML).toContain('Total del Ayuntamiento');}
    expect(imprimir).not.toHaveBeenCalled();
  });
  it('solo ofrece Ayuntamiento y periodo y no contiene entrada manual ni referencia interna',async()=>{
    const html=(await request(app).get('/documentos-facturacion.html')).text;
    expect(html).toContain('id="busqueda-documentos"');expect(html).toContain('id="ayuntamiento-documentos"');expect(html).toContain('id="periodo-documentos"');
    expect(html).not.toMatch(/id="(?:referencia|consulta-documentos|ayuda-referencia)"|ID interno|Referencia de facturación|Consulta alternativa/);
    expect(html).toContain('/configuracion-documentos.html');
    const api={consultar:vi.fn()};const {$,imprimir}=await preparar(api,false,null);
    expect(api.consultar).not.toHaveBeenCalled();expect($('imprimir-documentos').disabled).toBe(true);
    await $('imprimir-documentos').dispatch('click');expect(imprimir).not.toHaveBeenCalled();
  });
  it('el controlador predeterminado llama a window.print tras refrescar el documento',async()=>{
    const print=vi.fn();vi.stubGlobal('window',{print});
    const api={consultar:vi.fn().mockResolvedValue(datos())};const {$,botones}=await preparar(api,true);
    await botones[0].dispatch('click');
    const decode=vi.fn().mockResolvedValue();$('vista-documentos').querySelectorAll=()=>[{decode}];
    await $('imprimir-documentos').dispatch('click');expect(decode).toHaveBeenCalledOnce();expect(print).toHaveBeenCalledOnce();
    expect(api.consultar).toHaveBeenCalledTimes(2);
  });
  it('explica y bloquea impresión sin selección, indica selección y solo imprime el documento elegido',async()=>{
    const api={consultar:vi.fn().mockResolvedValue(datos())};const {$,botones,imprimir}=await preparar(api);
    expect($('imprimir-documentos').disabled).toBe(true);expect($('ayuda-impresion').textContent).toContain('Selecciona un documento');
    await $('imprimir-documentos').dispatch('click');expect(api.consultar).toHaveBeenCalledOnce();expect(imprimir).not.toHaveBeenCalled();
    expect($('imprimir-documentos').disabled).toBe(true);
    await botones[0].dispatch('click');expect($('imprimir-documentos').disabled).toBe(false);
    expect($('ayuda-impresion').textContent).toContain('Factura de PRECINTOS');expect(botones[0]['aria-pressed']).toBe('true');
    await botones[1].dispatch('click');expect(botones[0]['aria-pressed']).toBe('false');expect(botones[1]['aria-pressed']).toBe('true');
    await $('imprimir-documentos').dispatch('click');expect(imprimir).toHaveBeenCalledOnce();
    expect($('vista-documentos').innerHTML).toContain('GEN-001');expect($('vista-documentos').innerHTML).not.toContain('001-A');
    expect($('vista-documentos').innerHTML).not.toMatch(/<button|<input|<select/);
    const nueva=await preparar(api);expect(nueva.$('imprimir-documentos').disabled).toBe(true);expect(nueva.$('ayuda-impresion').textContent).toContain('Selecciona un documento');
  });
  it('abre automáticamente la referencia localizada y permite consultar los cuatro documentos y ambas facturas',async()=>{
    const api={consultar:vi.fn().mockResolvedValue(datos())};const {$,botones,imprimir}=await preparar(api,false,'2');
    expect(api.consultar).toHaveBeenCalledExactlyOnceWith('2');expect($('seleccion-documentos').hidden).toBe(false);
    for(const boton of botones){await boton.dispatch('click');expect($('vista-documentos').innerHTML).toContain('Total del Ayuntamiento');}
    expect($('imprimir-documentos').disabled).toBe(false);expect(imprimir).not.toHaveBeenCalled();
    expect(api.consultar).toHaveBeenCalledOnce();
  });
  it('consulta y selecciona sin imprimir, refresca configuración antes de imprimir sin operaciones financieras',async()=>{
    const api={consultar:vi.fn().mockResolvedValue(datos())};const {$,botones,imprimir}=await preparar(api);
     await botones[2].dispatch('click');expect(imprimir).not.toHaveBeenCalled();
    const actual=datos();actual.configuracion.datos_emisor.denominacion='Nuevo emisor';api.consultar.mockResolvedValue(actual);
    await $('imprimir-documentos').dispatch('click');expect(imprimir).toHaveBeenCalledOnce();expect(api.consultar).toHaveBeenCalledTimes(2);
    expect($('vista-documentos').innerHTML).toContain('Nuevo emisor');
  });
  it('enlaces inválidos orientan a Ayuntamiento/periodo y un fallo de consulta impide imprimir',async()=>{
    const api={consultar:vi.fn().mockRejectedValue(new Error('Corrección pendiente'))};
    const invalida=await preparar(api,false,'abc');expect(api.consultar).not.toHaveBeenCalled();
    expect(invalida.$('error-documentos').textContent).toContain('Busca por Ayuntamiento y periodo');
    const {$,imprimir}=await preparar(api);expect($('error-documentos').textContent).toBe('Corrección pendiente');expect($('imprimir-documentos').disabled).toBe(true);expect(imprimir).not.toHaveBeenCalled();
  });
  it('bloquea impresión durante la carga e impide imprimir si falla la actualización previa',async()=>{
    let resolver;const api={consultar:vi.fn().mockImplementationOnce(()=>new Promise(r=>{resolver=r;}))};
    const {$,botones,imprimir,carga}=await preparar(api,false,'3',false);
    await $('imprimir-documentos').dispatch('click');expect(api.consultar).toHaveBeenCalledOnce();expect($('imprimir-documentos').disabled).toBe(true);
    resolver(datos());await carga;await botones[0].dispatch('click');api.consultar.mockRejectedValue(new Error('Error de consulta'));
    await $('imprimir-documentos').dispatch('click');expect(imprimir).not.toHaveBeenCalled();expect($('vista-documentos').innerHTML).toBe('');expect($('imprimir-documentos').disabled).toBe(true);
  });
});
