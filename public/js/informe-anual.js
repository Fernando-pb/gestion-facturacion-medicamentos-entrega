import * as apiDefecto from './informe-anual-api.js';

export const iniciarInforme = ({ api = apiDefecto, descargar = apiDefecto.descargarExcel } = {}) => {
  const $ = (id) => document.getElementById(id);
  let ocupado = false;
  const crear = (tag, texto) => { const e = document.createElement(tag); if (texto !== undefined) e.textContent = texto; return e; };
  const moneda = (valor) => `${valor.replace('.', ',')} €`;
  const valoresB = (f) => ['soe_b', 'denominacion_b', 'cif_b'].map((campo) => f.identidades_b.map((b) => b[campo]).join('\n'));
  const importes = (grupo) => [...grupo.trimestres.map((t) => moneda(t.importe_total)), moneda(grupo.total_anual)];
  const tabla = (titulo, encabezados, filas, pie) => {
    const scroll = crear('div'); scroll.className = 'table-scroll'; scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', titulo);
    const table = crear('table'), caption = crear('caption', titulo), head = crear('thead'), tr = crear('tr');
    if (pie) table.className = 'resumen-anual';
    encabezados.forEach((texto) => { const th = crear('th', texto); th.setAttribute('scope', 'col'); tr.append(th); });
    head.append(tr); const body = crear('tbody');
    const fila = (valores) => { const tr = crear('tr'); valores.forEach((v, i) => { const td = crear('td', v); if (i >= 3) td.className = 'numero'; tr.append(td); }); return tr; };
    filas.forEach((v) => body.append(fila(v))); table.append(caption, head, body);
    if (pie) { const foot = crear('tfoot'); foot.append(fila(pie)); table.append(foot); }
    scroll.append(table); return scroll;
  };
  const render = (informe) => {
    $('titulo-informe').textContent = `Informe anual ${informe.anio}`;
    $('advertencia-informe').hidden = !informe.advertencia;
    $('advertencia-informe').textContent = informe.advertencia ?? '';
    $('total-informe').textContent = `Total anual: ${moneda(informe.total_anual)}. ${informe.trimestres.map((t) => `T${t.trimestre}: ${moneda(t.importe_total)}`).join(' · ')}`;
    $('sin-actividad-informe').hidden = informe.ayuntamientos.length !== 0;
    $('grupos-informe').replaceChildren(...informe.ayuntamientos.map((m) => {
      const grupo = crear('section'); grupo.append(crear('h3', m.denominacion));
      grupo.append(tabla(`Resumen de ${m.denominacion}`, ['SOE', 'Denominación', 'CIF', 'T1', 'T2', 'T3', 'T4', 'Total anual'],
        m.farmacias.map((f) => [...valoresB(f), ...importes(f)]), ['Subtotal', '', '', ...importes(m)]));
      if (informe.detalle_mensual) {
        const detalle = crear('details'); detalle.append(crear('summary', 'Desglose por mes y trimestre'));
        detalle.append(tabla(`Detalle mensual de ${m.denominacion}`, ['SOE', 'Denominación', 'CIF', 'Trimestre', 'Mes', 'Importe'],
          m.farmacias.flatMap((f) => f.trimestres.flatMap((t) => t.meses.map((mes) => [...valoresB(f), `T${t.trimestre}`, mes.mes, moneda(mes.importe_total)])))));
        grupo.append(detalle);
      }
      return grupo;
    }));
    $('resultado-informe').hidden = false; $('titulo-informe').focus();
  };
  const controles = ['anio-informe', 'ayuntamiento-informe', 'mensual-informe', 'ver-informe', 'exportar-informe'];
  const limpiar = () => { $('resultado-informe').hidden = true; $('grupos-informe').replaceChildren(); $('estado-informe').textContent = ''; $('error-informe').hidden = true; };
  for (const id of controles.slice(0, 3)) $(id).addEventListener('change', limpiar);
  $('anio-informe').addEventListener('input', limpiar);
  $('anio-informe').value = String(new Date().getFullYear());
  $('formulario-informe').addEventListener('submit', async (event) => {
    event.preventDefault(); if (ocupado) return;
    const anio = $('anio-informe').value, municipio = $('ayuntamiento-informe').value;
    $('error-informe').hidden = true;
    if (!/^\d+$/.test(anio) || Number(anio) < 1 || Number(anio) > 9999) {
      $('error-informe').textContent = 'Introduce un año entre 1 y 9999.'; $('error-informe').hidden = false; return;
    }
    const filtros = { anio, detalle_mensual: String($('mensual-informe').checked), ...(municipio ? { ayuntamiento_id: municipio } : {}) };
    const exportar = event.submitter?.id === 'exportar-informe';
    ocupado = true; controles.forEach((id) => { $(id).disabled = true; });
    $('formulario-informe').setAttribute('aria-busy', 'true');
    $('estado-informe').textContent = exportar ? 'Preparando archivo para Excel…' : 'Consultando informe…';
    try {
      if (exportar) { const blob = await api.exportarInforme(filtros); descargar(blob, `informe-anual-${Number(anio)}.xml`); $('estado-informe').textContent = 'Archivo XML compatible con Excel preparado para descargar.'; }
      else { render(await api.verInforme(filtros)); $('estado-informe').textContent = 'Informe consultado.'; }
    } catch (error) { $('error-informe').textContent = error.message; $('error-informe').hidden = false; $('estado-informe').textContent = ''; }
    finally { ocupado = false; controles.forEach((id) => { $(id).disabled = false; }); $('formulario-informe').setAttribute('aria-busy', 'false'); }
  });
  return api.listarAyuntamientos().then((municipios) => {
    $('ayuntamiento-informe').append(...municipios.map((m) => { const e = crear('option', m.denominacion); e.value = String(m.id); return e; }));
  }).catch(() => { $('error-informe').textContent = 'No se pudo cargar la lista de Ayuntamientos. Inténtalo recargando la página.'; $('error-informe').hidden = false; });
};
if (typeof document !== 'undefined') void iniciarInforme();
