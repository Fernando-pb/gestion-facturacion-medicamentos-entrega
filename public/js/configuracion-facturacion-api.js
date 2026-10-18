import { ErrorFacturacion } from './facturacion-municipal-api.js';
const solicitar=async(ruta,method='GET',body)=>{
  let r,d;
  try{r=await fetch(ruta,{method,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});}
  catch{throw new ErrorFacturacion('No se pudo conectar con la API.');}
  try{d=await r.json();}catch{throw new ErrorFacturacion('La respuesta no pudo confirmarse.');}
  if(!r.ok)throw new ErrorFacturacion(d.error ?? 'La petición falló.',r.status);
  return d;
};
export const listar=()=>solicitar('/configuracion-facturacion');
export const guardar=(id,d)=>solicitar(id===null?'/configuracion-facturacion':`/configuracion-facturacion/${id}`,id===null?'POST':'PUT',d);
