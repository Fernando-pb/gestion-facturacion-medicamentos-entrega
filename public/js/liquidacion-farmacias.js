import { ErrorFacturacion } from './facturacion-municipal-api.js';
// Revisión del lote; importes y requisitos se verifican siempre en la API.
export const iniciarLiquidacion = ({ api, ejecutar, bloquear, controles, fechaValida }) => {
  const $ = (id) => document.getElementById(id);
  const crear = (tag, texto) => { const e = document.createElement(tag); if (texto !== undefined) e.textContent = texto; return e; };
  const campos = [
    ['denominacion_farmacia', 'Titular destinatario'], ['cif_nif', 'CIF/NIF del titular'],
    ['pais_control_iban', 'País y control IBAN (ES00)'], ['entidad_bancaria', 'Entidad (4 dígitos)'],
    ['sucursal_bancaria', 'Oficina (4 dígitos)'], ['digito_control_bancario', 'Control nacional (2 dígitos)'],
    ['cuenta_bancaria', 'Cuenta (10 dígitos)'],
  ];
  const cuenta = (d) => ['pais_control_iban', 'entidad_bancaria', 'sucursal_bancaria', 'digito_control_bancario', 'cuenta_bancaria'].map((k) => d[k] ?? '').join('');
  const moneda = (s) => `${s.replace('.', ',')} €`;
  const centimos = (s) => BigInt(s.replace('.', ''));
  let proceso, propuesta = null, entradas = [], conocido = false, confirmado = false;
  const eligible = () => proceso?.estado === 'EMITIDA' && proceso.facturas.some((f) => f.tipo === 'PRECINTOS'
    && proceso.cobros.some((c) => c.factura_id === f.id && c.importe_cobrado === f.importe_total));
  const validar = (d, historico = false) => {
    const total = proceso.facturas.find((f) => f.tipo === 'PRECINTOS')?.importe_total;
    if (!d || d.facturacion_id !== proceso.facturacion_id || !fechaValida(d.fecha_pago)
      || d.importe_total !== total || !Array.isArray(d.detalles) || !d.detalles.length
      || new Set(d.detalles.map((p) => p.participacion_facturacion_id)).size !== d.detalles.length
      || !d.detalles.every((p) => Number.isInteger(p.participacion_facturacion_id) && p.participacion_facturacion_id > 0
        && typeof p.soe === 'string' && typeof p.denominacion_farmacia === 'string' && typeof p.cif_nif === 'string'
        && typeof p.importe === 'string' && /^(0|[1-9]\d*)\.\d{2}$/.test(p.importe))
      || d.detalles.reduce((s, p) => s + centimos(p.importe), 0n) !== centimos(total)
      || (historico && d.cuadra !== true)) throw new ErrorFacturacion('La respuesta de liquidación no pudo verificarse.');
    return d;
  };
  const actualizarControles = (bloqueado) => {
    $('preparar-liquidacion').disabled = bloqueado || !conocido || confirmado || !eligible();
    $('guardar-liquidacion').disabled = bloqueado || !propuesta || !$('confirmacion-liquidacion').checked || !fechaValida($('fecha-liquidacion').value);
    $('exportar-liquidacion').hidden = !confirmado;
  };
  const limpiar = () => {
    propuesta = null; entradas = []; conocido = false; confirmado = false;
    $('formulario-liquidacion').hidden = true; $('liquidacion-confirmada').hidden = true;
    $('exportar-liquidacion').hidden = true; $('preparar-liquidacion').hidden = true;
    $('confirmacion-liquidacion').checked = false;
  };
  const renderConfirmada = (d) => {
    validar(d, true); limpiar(); conocido = true; confirmado = true;
    $('estado-liquidacion').textContent = `Liquidación confirmada · Fecha: ${d.fecha_pago} · Total: ${moneda(d.importe_total)}`;
    $('liquidacion-confirmada').hidden = false;
    $('liquidacion-confirmada').replaceChildren(...d.detalles.map((p) => {
      const seccion = crear('section');
      seccion.append(crear('h3', `${p.soe} · ${p.denominacion_farmacia}`), crear('p', `CIF/NIF: ${p.cif_nif}`),
        crear('p', `Cuenta utilizada: ${cuenta(p)}`), crear('p', `Importe completo: ${moneda(p.importe)}`));
      return seccion;
    }));
    $('exportar-liquidacion').href = `/facturaciones/${proceso.facturacion_id}/liquidacion/contabilidad`;
    $('exportar-liquidacion').hidden = false;
  };
  const cargar = async (datos) => {
    proceso = datos; limpiar(); $('estado-liquidacion').textContent = 'Consultando liquidación…';
    try { renderConfirmada(await api.consultarLiquidacion(proceso.facturacion_id)); }
    catch (e) {
      if (e.estado !== 404 || e.message !== 'Liquidación confirmada no encontrada.') {
        $('estado-liquidacion').textContent = `No se pudo consultar la liquidación: ${e.message} Pulsa «Consultar estado antes de continuar» para volver a consultar.`;
        throw e;
      }
      conocido = true;
      $('estado-liquidacion').textContent = eligible() ? 'Sin liquidación confirmada. Puedes preparar el lote completo de farmacias.'
        : 'Se requiere el cobro completo de PRECINTOS para preparar la liquidación. El cobro de GASTOS/COMISIÓN no sustituye este requisito.';
      $('preparar-liquidacion').hidden = !eligible();
    }
  };
  const renderPropuesta = (d) => {
    propuesta = validar(d); entradas = [];
    $('preparar-liquidacion').hidden = true; $('formulario-liquidacion').hidden = false;
    $('fecha-liquidacion').value = d.fecha_pago; $('confirmacion-liquidacion').checked = false;
    $('estado-liquidacion').textContent = `Revisión del lote completo · Total: ${moneda(d.importe_total)}. Corrige el titular y la cuenta antes de confirmar.`;
    $('detalles-liquidacion').replaceChildren(...d.detalles.map((p, indice) => {
      const grupo = crear('fieldset'), rejilla = crear('div'); rejilla.className = 'form-grid';
      grupo.append(crear('legend', `Farmacia · SOE ${p.soe}`), crear('p', `Importe completo: ${moneda(p.importe)}`));
      const fila = {};
      for (const [campo, titulo] of campos) {
        const celda = crear('div'), etiqueta = crear('label', titulo), input = crear('input');
        celda.className = 'form-field'; input.type = 'text'; input.id = `liquidacion-${indice}-${campo}`;
        etiqueta.setAttribute('for', input.id); input.value = p[campo] ?? ''; input.required = true;
        if (campo === 'pais_control_iban') input.pattern = 'ES[0-9]{2}';
        if (campo.endsWith('bancaria') || campo === 'digito_control_bancario') {
          const longitud = campo === 'cuenta_bancaria' ? 10 : campo === 'digito_control_bancario' ? 2 : 4;
          input.pattern = `[0-9]{${longitud}}`; input.inputMode = 'numeric';
        }
        input.addEventListener('input', () => { $('confirmacion-liquidacion').checked = false; controles(); });
        fila[campo] = input; celda.append(etiqueta, input); rejilla.append(celda);
      }
      entradas.push(fila); grupo.append(rejilla); return grupo;
    }));
    $('fecha-liquidacion').focus();
  };
  $('preparar-liquidacion').addEventListener('click', () => {
    if (!conocido || confirmado || !eligible()) return;
    return ejecutar('Preparando liquidación conjunta…', async () => renderPropuesta(await api.prepararLiquidacion(proceso.facturacion_id)));
  });
  $('fecha-liquidacion').addEventListener('input', () => { $('confirmacion-liquidacion').checked = false; controles(); });
  $('confirmacion-liquidacion').addEventListener('input', controles);
  $('cancelar-liquidacion').addEventListener('click', () => ejecutar('Revisión cancelada. No se ha confirmado ninguna liquidación.', async () => cargar(proceso)));
  $('formulario-liquidacion').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!propuesta || !$('confirmacion-liquidacion').checked || !fechaValida($('fecha-liquidacion').value)) return;
    const detalles = propuesta.detalles.map((p, i) => ({ participacion_facturacion_id: p.participacion_facturacion_id,
      soe: p.soe, importe: p.importe, ...Object.fromEntries(campos.map(([k]) => [k, entradas[i][k].value.trim()])) }));
    if (detalles.some((p) => campos.some(([k]) => !p[k]))) return ejecutar('', async () => { throw new Error('Completa los titulares y las cuentas de todas las farmacias.'); });
    return ejecutar('Confirmando liquidación conjunta…', async () => {
      try {
        const d = await api.confirmarLiquidacion(proceso.facturacion_id, { fecha_pago: $('fecha-liquidacion').value, detalles });
        validar(d, true);
        if (d.fecha_pago !== $('fecha-liquidacion').value || detalles.some((p) => {
          const guardado = d.detalles.find((r) => r.participacion_facturacion_id === p.participacion_facturacion_id);
          return !guardado || Object.keys(p).some((k) => guardado[k] !== p[k]);
        })) throw new ErrorFacturacion('La confirmación de los datos revisados no pudo verificarse.');
        renderConfirmada(d);
      } catch (err) {
        if (err.incierto || err.estado === 409) bloquear();
        throw err;
      }
    });
  });
  return { cargar, actualizarControles };
};
