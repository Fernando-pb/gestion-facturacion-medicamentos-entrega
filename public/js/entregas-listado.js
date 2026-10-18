import { formatoMonetario } from './decimales.js';

export const iniciarListado = ({ api, alAbrir, puedeNavegar }) => {
  const $ = (id) => document.getElementById(id);
  let generacion = 0, cargando = false, filasPeriodo = [], municipios = new Map();
  const render = (filas) => {
    const grupos = new Map();
    for (const fila of filas) {
      const clave = fila.ayuntamiento_id;
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(fila);
    }
    $('grupos-entregas').replaceChildren(...[...grupos.values()].map((grupo) => {
      const section = document.createElement('section'), titulo = document.createElement('h3');
      titulo.id = `ayuntamiento-entregas-${grupo[0].ayuntamiento_id ?? 'sin'}`;
      titulo.textContent = grupo[0].ayuntamiento_denominacion ?? 'Sin Ayuntamiento';
      const scroll = document.createElement('div'); scroll.className = 'table-scroll'; scroll.tabIndex = 0;
      scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-labelledby', titulo.id);
      const tabla = document.createElement('table'); tabla.setAttribute('aria-labelledby', titulo.id);
      const head = document.createElement('thead'), encabezado = document.createElement('tr');
      for (const texto of ['SOE', 'Farmacia (nombre histórico)', 'Precintos aptos', 'Importe aptos (€)', 'Acción']) {
        const th = document.createElement('th'); th.textContent = texto; th.setAttribute('scope', 'col'); encabezado.append(th);
      }
      head.append(encabezado); const body = document.createElement('tbody');
      for (const fila of grupo) {
        const tr = document.createElement('tr');
        for (const valor of [fila.soe, fila.denominacion_farmacia, fila.admitidos, formatoMonetario(fila.subtotal_facturable)]) {
          const td = document.createElement('td'); td.textContent = valor; tr.append(td);
        }
        const td = document.createElement('td'), abrir = document.createElement('button');
        abrir.type = 'button'; abrir.className = 'button button-secondary'; abrir.textContent = 'Continuar entrega';
        abrir.setAttribute('aria-label', `Continuar entrega SOE ${fila.soe}, ${fila.mes}/${fila.anio}`);
        abrir.addEventListener('click', () => { if (!cargando && puedeNavegar()) return alAbrir(fila); });
        td.append(abrir); tr.append(td); body.append(tr);
      }
      tabla.append(head, body); scroll.append(tabla); section.append(titulo, scroll); return section;
    }));
  };
  const periodoDeFilaMasReciente = (filas) => [...filas].sort((a, b) =>
    b.anio - a.anio || b.mes - a.mes || b.periodo_id - a.periodo_id)[0]?.periodo_id;
  const actualizarPeriodos = (periodos, filas, seleccionado) => {
    const ordenados = [...periodos].sort((a, b) => b.anio - a.anio || b.mes - a.mes || b.id - a.id);
    const opciones = ordenados.map((p) => {
      const option = document.createElement('option'); option.value = String(p.id);
      option.textContent = `${String(p.mes).padStart(2, '0')}/${p.anio}`; return option;
    });
    if (opciones.length === 0) {
      const vacio = document.createElement('option'); vacio.value = ''; vacio.textContent = 'No hay periodos disponibles'; vacio.disabled = true;
      $('periodo-listado').replaceChildren(vacio); $('periodo-listado').value = '';
      return '';
    }
    $('periodo-listado').replaceChildren(...opciones);
    const existeSeleccionado = ordenados.some((p) => String(p.id) === seleccionado);
    const inicial = existeSeleccionado ? seleccionado
      : String(periodoDeFilaMasReciente(filas) ?? ordenados[0].id);
    $('periodo-listado').value = inicial;
    return inicial;
  };
  const actualizarMunicipios = (filas) => {
    for (const fila of filas) {
      const key = fila.ayuntamiento_id == null ? '__sin_ayuntamiento__' : String(fila.ayuntamiento_id);
      if (!municipios.has(key)) municipios.set(key, { key, id: fila.ayuntamiento_id, nombre: fila.ayuntamiento_denominacion ?? 'Sin Ayuntamiento' });
    }
    const lista = [...municipios.values()];
    const nombres = new Map();
    for (const municipio of lista) nombres.set(municipio.nombre, (nombres.get(municipio.nombre) ?? 0) + 1);
    const seleccionado = $('ayuntamiento-listado').value;
    const opciones = lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || String(a.id).localeCompare(String(b.id)))
      .map((municipio) => {
        const option = document.createElement('option'); option.value = municipio.key;
        option.textContent = nombres.get(municipio.nombre) > 1 && municipio.id != null
          ? `${municipio.nombre} (ID ${municipio.id})` : municipio.nombre;
        return option;
      });
    const todas = document.createElement('option'); todas.value = ''; todas.textContent = 'Todos los Ayuntamientos';
    $('ayuntamiento-listado').replaceChildren(todas, ...opciones);
    $('ayuntamiento-listado').value = seleccionado;
  };
  const mostrarFilas = () => {
    const municipioSeleccionado = $('ayuntamiento-listado').value;
    const filas = municipioSeleccionado === '' ? filasPeriodo : filasPeriodo.filter((fila) =>
      (fila.ayuntamiento_id == null ? '__sin_ayuntamiento__' : String(fila.ayuntamiento_id)) === municipioSeleccionado);
    render(filas);
    $('estado-listado').setAttribute('role', 'status'); $('estado-listado').className = 'operation-message';
    if (filas.length) {
      $('estado-listado').textContent = `${filas.length} ${filas.length === 1 ? 'entrega' : 'entregas'}`;
      return;
    }
    const periodo = $('periodo-listado').selectedOptions?.[0]?.textContent
      ?? $('periodo-listado').children.find((o) => o.value === $('periodo-listado').value)?.textContent;
    if (municipioSeleccionado !== '') {
      const municipio = municipios.get(municipioSeleccionado)?.nombre ?? 'el Ayuntamiento seleccionado';
      $('estado-listado').textContent = `No hay entregas registradas para ${municipio} en el periodo ${periodo ?? 'seleccionado'}.`;
    } else if ($('periodo-listado').value) {
      $('estado-listado').textContent = `No hay entregas registradas para el periodo ${periodo ?? 'seleccionado'}.`;
    } else {
      $('estado-listado').textContent = 'No hay entregas registradas.';
    }
  };
  const cargar = async () => {
    const actual = ++generacion, filtro = $('periodo-listado').value;
    cargando = true; $('estado-listado').textContent = 'Cargando entregas…';
    $('estado-listado').setAttribute('role', 'status');
    $('estado-listado').className = 'operation-message';
    $('actualizar-listado').hidden = true;
    $('actualizar-listado').disabled = true;
    $('grupos-entregas').replaceChildren(); $('listado-entregas').setAttribute('aria-busy', 'true');
    try {
      const [periodos, filas] = await Promise.all([api.listarPeriodos(), api.listarEntregas(filtro)]);
      if (actual !== generacion) return;
      const periodoSeleccionado = actualizarPeriodos(periodos, filas, filtro);
      actualizarMunicipios(filas);
      filasPeriodo = filtro && String(periodoSeleccionado) === filtro
        ? filas : filas.filter((fila) => String(fila.periodo_id) === String(periodoSeleccionado));
      // El GET inicial sin periodo entrega la lista neutral completa y permite elegir
      // el periodo más reciente que realmente tiene entregas, sin inferir facturación.
      mostrarFilas();
    } catch (error) {
      if (actual === generacion) {
        $('estado-listado').textContent = `No se pudo cargar el listado. ${error.message}`;
        $('estado-listado').setAttribute('role', 'alert'); $('estado-listado').className = 'operation-message message-error';
        $('actualizar-listado').hidden = false;
      }
    } finally {
      if (actual === generacion) { cargando = false; $('listado-entregas').setAttribute('aria-busy', 'false'); $('actualizar-listado').disabled = !puedeNavegar(); }
    }
  };
  $('periodo-listado').addEventListener('change', () => { if (puedeNavegar()) return cargar(); });
  $('ayuntamiento-listado').addEventListener('change', () => { if (!cargando && puedeNavegar()) mostrarFilas(); });
  $('actualizar-listado').addEventListener('click', () => { if (!cargando && !$('actualizar-listado').hidden && puedeNavegar()) return cargar(); });
  return { cargar };
};
