import * as apiDefecto from './configuracion-facturacion-api.js';
import { normalizarDecimal } from './decimales.js';
const porcentajeVisible=valor=>{
  const [entero,decimal='']=valor.split('.'),fraccion=decimal.replace(/0+$/,'');
  return `${entero}${fraccion ? ','+fraccion : ''} %`;
};
const fechaVisible=valor=>valor.split('-').reverse().join('/');
export const iniciarTasas=({documento=document,api=apiDefecto}={})=>{
  const el=id=>documento.getElementById(id),crear=(tag,texto)=>{const n=documento.createElement(tag);n.textContent=texto;return n;};
  let filas=[],seleccionada=null,ocupado=false,pendiente=false,cargado=false;
  const error=s=>{el('error-tasas').textContent=s;el('error-tasas').hidden=!s;};
  const bloqueo=()=>{
    for(const n of documento.querySelectorAll('button,input'))n.disabled=ocupado || pendiente || (!cargado && n.id!=='recuperar-tasas');
    el('recuperar-tasas').hidden=!pendiente && (cargado || ocupado);
    el('recuperar-tasas').textContent=pendiente?'Consultar vigencias antes de continuar':'Reintentar carga de vigencias';el('recuperar-tasas').disabled=ocupado;
    el('pantalla-configuracion-tasas').setAttribute('aria-busy',String(ocupado));
  };
  const mostrar=(editar,enfocar=true)=>{el('lista-tasas').hidden=editar;el('edicion-tasas').hidden=!editar;if(enfocar)el(editar?'titulo-edicion-tasas':'titulo-lista-tasas').focus();};
  const editar=f=>{
    if(ocupado || pendiente || !cargado)return;
    seleccionada=f;for(const [id,key] of [['comision-tasa','porcentaje_comision'],['iva-tasa','porcentaje_iva'],['inicio-tasa','fecha_inicio'],['fin-tasa','fecha_fin']]){
      el(id).value=f?.[key]?.replace('.',',') ?? '';el(id).readOnly=!!f?.utilizada && id!=='fin-tasa';
    }
    el('nota-historica-tasas').hidden=!f?.utilizada;el('titulo-edicion-tasas').textContent=f?'Corregir vigencia':'Nueva vigencia';error('');mostrar(true);
  };
  const cargar=async()=>{
    if(ocupado)return;const volverDeEdicion=!el('edicion-tasas').hidden;ocupado=true;bloqueo();error('');el('estado-tasas').textContent='Consultando vigencias…';
    try{
      filas=await api.listar();if(!Array.isArray(filas))throw new Error('La consulta no pudo verificarse.');
      el('filas-tasas').replaceChildren();
      for(const f of filas){const tr=crear('tr','');for(const v of [porcentajeVisible(f.porcentaje_comision),porcentajeVisible(f.porcentaje_iva),fechaVisible(f.fecha_inicio),f.fecha_fin ? fechaVisible(f.fecha_fin) : 'Sin fin',f.utilizada?'Utilizada':'Sin utilizar'])tr.append(crear('td',v));
        const celda=crear('td',''),b=crear('button',f.utilizada?'Ajustar fin':'Corregir');b.type='button';b.className='button button-secondary';b.addEventListener('click',()=>editar(f));celda.append(b);tr.append(celda);el('filas-tasas').append(tr);
      }
      el('vacio-tasas').hidden=filas.length!==0;cargado=true;pendiente=false;seleccionada=null;mostrar(false,volverDeEdicion);el('estado-tasas').textContent='Vigencias cargadas.';
    }catch(e){cargado=false;error(e.message);el('estado-tasas').textContent='';}
    finally{ocupado=false;bloqueo();}
  };
  el('nueva-tasa').addEventListener('click',()=>editar(null));el('recuperar-tasas').addEventListener('click',cargar);
  el('cancelar-tasa').addEventListener('click',()=>{if(!ocupado && !pendiente){seleccionada=null;mostrar(false);error('');}});
  el('inicio-tasas').addEventListener('click',e=>{if(ocupado || pendiente)e.preventDefault();});
  globalThis.addEventListener?.('beforeunload',e=>{if(ocupado || pendiente){e.preventDefault();e.returnValue='';}});
  el('formulario-tasas').addEventListener('submit',async e=>{
    e.preventDefault();if(ocupado || pendiente || !cargado)return;
    let d;
    try{
      const porcentaje=id=>{const s=normalizarDecimal(el(id).value,{decimales:4,cifrasEnteras:3,recortar:true});const [entero,frac='']=s.split('.');if(BigInt(entero)*10000n+BigInt(frac.padEnd(4,'0'))>1000000n)throw new Error('Los porcentajes deben estar entre 0 y 100.');return s;};
      d={porcentaje_comision:porcentaje('comision-tasa'),porcentaje_iva:porcentaje('iva-tasa'),fecha_inicio:el('inicio-tasa').value,fecha_fin:el('fin-tasa').value || null};
      if(!d.fecha_inicio || (d.fecha_fin && d.fecha_fin<d.fecha_inicio))throw new Error('Introduce inicio y un fin igual o posterior, o deja el fin vacío.');
    }catch(e){error(e.message);return;}
    ocupado=true;bloqueo();error('');el('estado-tasas').textContent='Guardando vigencia…';
    try{const r=await api.guardar(seleccionada?.id ?? null,d);if(!r?.id)throw Object.assign(new Error('Resultado pendiente de confirmar.'),{incierto:true});
      ocupado=false;await cargar();if(cargado)el('estado-tasas').textContent='Vigencia guardada.';
    }catch(e){error(e.message);pendiente=e.incierto===true;el('estado-tasas').textContent=pendiente?'Consulta las vigencias antes de repetir. No se reenviará automáticamente.':'';}
    finally{ocupado=false;bloqueo();}
  });
  return cargar();
};
if(typeof document!=='undefined')iniciarTasas();
