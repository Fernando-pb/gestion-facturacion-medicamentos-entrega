import * as api from './documentos-api.js';
const el=id=>document.getElementById(id);
let logo=null, ocupado=false, cargado=false;
const bloquear=()=>{for(const b of document.querySelectorAll('input,button')) b.disabled=ocupado || (!cargado && b.id!=='reintentar-configuracion');};
const cargar=async()=>{
  if(ocupado) return; ocupado=true; bloquear();
  try {
    const d=await api.configuracion(); logo=/^data:image\/(png|jpeg);base64,/.test(d.logo_personalizado ?? '') ? d.logo_personalizado : null;
    for(const k of ['denominacion','cif','direccion','contacto']) el(k).value=d.datos_emisor?.[k] ?? '';
    el('nombre_presidente').value=d.nombre_presidente ?? ''; el('vista-logo').hidden=!logo;
    if(logo) el('vista-logo').src=logo;
    el('error-configuracion').textContent=''; cargado=true; el('reintentar-configuracion').hidden=true;
  } catch(e) { el('error-configuracion').textContent=e.message; el('reintentar-configuracion').hidden=false; }
  finally {ocupado=false;bloquear();}
};
el('reintentar-configuracion').addEventListener('click',cargar);
el('formulario-configuracion').addEventListener('submit',async e=>{
  e.preventDefault(); if(ocupado || !cargado) return; ocupado=true; bloquear(); el('error-configuracion').textContent=''; el('estado-configuracion').textContent='Guardando…';
  try {
    let nuevo=logo; const archivo=el('logo').files[0];
    if(archivo && el('quitar-logo').checked) throw new Error('Elige sustituir o quitar el logo.');
    if(archivo) {
      if(!['image/png','image/jpeg'].includes(archivo.type) || archivo.size>1048576) throw new Error('Logo PNG/JPEG de hasta 1 MiB.');
      nuevo=await new Promise((resolve,reject)=>{const lector=new FileReader();lector.onload=()=>resolve(lector.result);lector.onerror=()=>reject(new Error('No se pudo leer el logo.'));lector.readAsDataURL(archivo);});
    }
    if(el('quitar-logo').checked) nuevo=null;
    const datos_emisor=Object.fromEntries(['denominacion','cif','direccion','contacto'].map(k=>[k,el(k).value.trim() || null]));
    const d=await api.guardar({datos_emisor,logo_personalizado:nuevo,nombre_presidente:el('nombre_presidente').value.trim() || null});
    logo=d.logo_personalizado; el('vista-logo').hidden=!logo; if(logo) el('vista-logo').src=logo;
    el('logo').value=''; el('quitar-logo').checked=false; el('estado-configuracion').textContent='Configuración guardada.';
  } catch(e) {el('error-configuracion').textContent=`${e.message} Si se perdió la respuesta, consulta de nuevo la configuración antes de repetir.`;el('estado-configuracion').textContent='';}
  finally {ocupado=false;bloquear();}
});
cargar();
