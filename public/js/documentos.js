import * as apiActual from './documentos-api.js';
import { generarDocumento } from './documentos-plantillas.js';
export const iniciarDocumentos = ({documento=document,api=apiActual,imprimir=()=>window.print()}={}) => {
  const el=id=>documento.getElementById(id);
  const parametros=new URLSearchParams(globalThis.location?.search);
  const filtros=new URLSearchParams();
  for(const campo of ['ayuntamiento_filtro','periodo_filtro','precintos_cobro_filtro','comision_cobro_filtro']) { const valor=parametros.get(campo); if(valor) filtros.set(campo,valor); }
  el('volver-facturaciones').href=`/facturacion-municipal.html${filtros.size?'?'+filtros:''}`;
  let id=null, datos=null, tipo=null, ocupado=false;
  const nombres={precintos:'Factura de PRECINTOS',comision:'Factura de GASTOS/COMISIÓN',ambas:'Ambas facturas, cada una en una hoja',relacion:'Resumen global de precintos',gastos:'Detalle global de gastos'};
  const actualizarSeleccion=()=>{
    el('ayuda-impresion').textContent=tipo ? `Documento seleccionado: ${nombres[tipo]}. Pulsa «Imprimir / Guardar como PDF».` : 'Selecciona un documento arriba para habilitar la impresión.';
    for(const b of documento.querySelectorAll('[data-documento]')) b.setAttribute('aria-pressed',String(b.dataset.documento===tipo));
    el('imprimir-documentos').disabled=ocupado || !tipo;
  };
  const operar=async (fn)=>{
    if(ocupado) return;
    ocupado=true; el('error-documentos').textContent=''; el('estado-documentos').textContent='Consultando…';
    for(const b of documento.querySelectorAll('button,input')) b.disabled=true;
    try { await fn(); el('estado-documentos').textContent=datos?.advertencias.join(' ') ?? ''; }
    catch(e) { el('error-documentos').textContent=e.message; el('vista-documentos').replaceChildren(); datos=null; tipo=null; el('seleccion-documentos').hidden=true; el('estado-documentos').textContent=''; }
    finally { ocupado=false; for(const b of documento.querySelectorAll('button,input')) b.disabled=false; actualizarSeleccion(); }
  };
  for(const b of documento.querySelectorAll('[data-documento]')) b.addEventListener('click',()=>{
    if(ocupado || !datos) return;
    tipo=b.dataset.documento; el('vista-documentos').innerHTML=generarDocumento(datos,tipo);
    actualizarSeleccion();
  });
  el('imprimir-documentos').addEventListener('click',()=>{
    if(ocupado || !datos || !tipo) { if(!ocupado) actualizarSeleccion(); return; }
    return operar(async()=>{
    datos=await api.consultar(id);
    if(!datos.configuracion.datos_emisor) throw new Error('Configura los datos del emisor antes de imprimir.');
    el('vista-documentos').innerHTML=generarDocumento(datos,tipo);
    await Promise.all(Array.from(el('vista-documentos').querySelectorAll('img')).map(img=>img.decode()));
    imprimir();
    });
  });
  actualizarSeleccion();
  const referencia=parametros.get('facturacion_id');
  if(parametros.has('facturacion_id')) {
    el('consulta-ayuntamiento-periodo').hidden=true;
    if(!/^[1-9]\d*$/.test(referencia) || BigInt(referencia)>2147483647n) {
      el('error-documentos').textContent='El enlace de consulta no es válido. Busca por Ayuntamiento y periodo.'; return;
    }
    return operar(async()=>{
      id=referencia; datos=await api.consultar(id);
      el('ayuntamiento-consultado').textContent=`Ayuntamiento: ${datos.cabecera.denominacion}`;
      el('periodo-consultado').textContent=`Periodo facturado: ${String(datos.cabecera.mes).padStart(2,'0')}/${datos.cabecera.anio}`;
      el('contexto-documentos').hidden=false; el('seleccion-documentos').hidden=false;
    });
  }
};
if(typeof document!=='undefined') iniciarDocumentos();
