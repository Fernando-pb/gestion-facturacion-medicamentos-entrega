import * as apiActual from './documentos-api.js';

export const iniciarBusquedaDocumentos = ({ documento = document, api = apiActual,
  navegar = (url) => window.location.assign(url) } = {}) => {
  if (new URLSearchParams(globalThis.location?.search).has('facturacion_id')) return;
  const el = (id) => documento.getElementById(id);
  el('consulta-ayuntamiento-periodo').hidden = false;
  let ocupado = false, cargado = false, ayuntamientos = [], periodos = [];
  const controles = () => {
    el('buscar-documentos').disabled = ocupado || !cargado;
    for (const id of ['ayuntamiento-documentos', 'periodo-documentos', 'reintentar-busqueda']) el(id).disabled = ocupado;
  };
  const cargar = async () => {
    if (ocupado) return;
    ocupado = true; cargado = false; controles();
    el('error-busqueda').textContent = ''; el('estado-busqueda').textContent = 'Cargando Ayuntamientos y periodos…';
    try {
      [ayuntamientos, periodos] = await Promise.all([api.listarAyuntamientos(), api.listarPeriodos()]);
      const llenar = (id, filas, etiqueta) => {
        const opciones = [{ id: '', texto: 'Selecciona una opción' }, ...filas.map((f) => ({ id: f.id, texto: etiqueta(f) }))];
        el(id).replaceChildren(...opciones.map((f) => {
          const opcion = documento.createElement('option'); opcion.value = String(f.id); opcion.textContent = f.texto; return opcion;
        }));
      };
      llenar('ayuntamiento-documentos', ayuntamientos, (a) => a.denominacion);
      llenar('periodo-documentos', periodos, (p) => `${String(p.mes).padStart(2, '0')}/${p.anio}`);
      cargado = ayuntamientos.length > 0 && periodos.length > 0;
      el('reintentar-busqueda').hidden = true;
      el('estado-busqueda').textContent = cargado ? 'Selecciona Ayuntamiento y periodo.' : 'No hay Ayuntamientos o periodos disponibles.';
    } catch (e) {
      el('error-busqueda').textContent = e.message; el('estado-busqueda').textContent = '';
      el('reintentar-busqueda').hidden = false;
    } finally { ocupado = false; controles(); }
  };
  el('reintentar-busqueda').addEventListener('click', cargar);
  el('busqueda-documentos').addEventListener('submit', async (e) => {
    e.preventDefault(); if (ocupado || !cargado) return;
    const ayuntamiento = el('ayuntamiento-documentos').value, periodo = el('periodo-documentos').value;
    el('error-busqueda').textContent = '';
    if (!ayuntamientos.some((a) => String(a.id) === ayuntamiento) || !periodos.some((p) => String(p.id) === periodo)) {
      el('error-busqueda').textContent = 'Selecciona un Ayuntamiento y periodo de la lista.'; return;
    }
    ocupado = true; controles(); el('estado-busqueda').textContent = 'Buscando facturación guardada…';
    try {
      const datos = await api.buscar(ayuntamiento, periodo);
      if (datos.estado !== 'EMITIDA') throw new Error(datos.estado === 'REABIERTA'
        ? 'La facturación está reabierta y tiene una corrección pendiente. Sus documentos estarán disponibles tras la reemisión.'
        : 'La facturación está en revisión; todavía no tiene documentos emitidos.');
      if (!Number.isInteger(datos.facturacion_id) || datos.facturacion_id < 1 || datos.facturacion_id > 2147483647) throw new Error('La consulta no devolvió una referencia válida.');
      navegar(`/documentos-facturacion.html?${new URLSearchParams({ facturacion_id: datos.facturacion_id })}`);
      el('estado-busqueda').textContent = 'Facturación emitida localizada.';
    } catch (e) { el('error-busqueda').textContent = e.message; el('estado-busqueda').textContent = ''; }
    finally { ocupado = false; controles(); }
  });
  return cargar();
};
if (typeof document !== 'undefined') void iniciarBusquedaDocumentos();
