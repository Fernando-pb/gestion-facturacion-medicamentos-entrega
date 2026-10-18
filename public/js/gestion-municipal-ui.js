export const mostrarMensaje = (nodo, texto, { error = false, clase = 'list-status' } = {}) => {
  nodo.textContent = texto;
  nodo.className = `${clase}${error ? ' message-error' : ''}`;
  nodo.setAttribute('role', error ? 'alert' : 'status');
  nodo.setAttribute('aria-live', error ? 'assertive' : 'polite');
};
export const agregarCeldas = (documento, fila, datos, campos) => {
  for (const campo of campos) {
    const celda = documento.createElement('td');
    celda.textContent = datos[campo] ?? 'No consta';
    fila.append(celda);
  }
};
export const terminoBusquedaValido = (q) => Boolean(q) && q.length <= 200 && !q.includes('\0');

// Comportamiento visual común; cada módulo conserva sus consultas y reglas.
export const iniciarPanelBusqueda = ({ documento, tipo, ocupada, alAbrir, alCerrar, conSeleccion = true }) => {
  const el = (nombre) => documento.getElementById(`${nombre}-${tipo}`);
  let abierta = false;
  let focoResultado = null;
  const limpiarSeleccion = () => { if (conSeleccion) el('seleccion').hidden = true; el('resultados').hidden = false; };
  const cerrar = (restaurarFoco = true, interna = false) => {
    if (ocupada() && !interna) return;
    abierta = false;
    el('panel-busqueda').hidden = true;
    el('lista').hidden = false;
    el('abrir-busqueda').setAttribute('aria-expanded', 'false');
    limpiarSeleccion();
    alCerrar();
    if (restaurarFoco) el('abrir-busqueda').focus();
  };
  const abrir = () => {
    if (ocupada()) return;
    alAbrir();
    abierta = true;
    el('lista').hidden = true;
    el('panel-busqueda').hidden = false;
    el('abrir-busqueda').setAttribute('aria-expanded', 'true');
    documento.getElementById(`${tipo}-q`).focus();
  };
  const mostrarSeleccion = (texto, accion, botonOrigen) => {
    focoResultado = botonOrigen;
    el('resultados').hidden = true;
    el('texto-seleccion').textContent = texto;
    el('accion-seleccion').textContent = accion ?? '';
    el('accion-seleccion').hidden = !accion;
    el('seleccion').hidden = false;
    (accion ? el('accion-seleccion') : el('texto-seleccion')).focus();
  };
  const suspender = () => {
    el('lista').hidden = true;
    el('panel-busqueda').hidden = true;
    el('abrir-busqueda').setAttribute('aria-expanded', 'false');
  };
  const reanudar = () => {
    el('lista').hidden = abierta;
    if (abierta) {
      el('panel-busqueda').hidden = false;
      el('abrir-busqueda').setAttribute('aria-expanded', 'true');
    }
  };
  el('abrir-busqueda').addEventListener('click', abrir);
  el('cerrar-busqueda').addEventListener('click', () => cerrar());
  if (conSeleccion) el('volver-resultados').addEventListener('click', () => {
    if (ocupada()) return;
    limpiarSeleccion();
    focoResultado?.focus();
  });
  cerrar(false);
  return { abrir, cerrar, volverLista: () => cerrar(false, true), suspender, reanudar, limpiarSeleccion, mostrarSeleccion, get abierta() { return abierta; } };
};

export const iniciarPestanasMunicipales = ({ documento, ocupada, alSeleccionar }) => {
  const nombres = ['datos', 'farmacias', 'medicamentos'];
  const botones = nombres.map((nombre) => documento.getElementById(`tab-${nombre}`));
  const seleccionar = async (nombre, enfocar = false) => {
    if (ocupada()) return;
    for (let indice = 0; indice < nombres.length; indice++) {
      const activa = nombres[indice] === nombre;
      botones[indice].setAttribute('aria-selected', String(activa));
      botones[indice].tabIndex = activa ? 0 : -1;
      documento.getElementById(`apartado-${nombres[indice]}`).hidden = !activa;
    }
    if (enfocar) botones[nombres.indexOf(nombre)].focus();
    await alSeleccionar(nombre);
  };
  botones.forEach((boton, indice) => {
    boton.addEventListener('click', () => seleccionar(nombres[indice]));
    boton.addEventListener('keydown', (evento) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(evento.key)) return;
      evento.preventDefault();
      const siguiente = evento.key === 'Home' ? 0 : evento.key === 'End' ? 2
        : (indice + (evento.key === 'ArrowRight' ? 1 : 2)) % 3;
      return seleccionar(nombres[siguiente], true);
    });
  });
  return { seleccionar, bloquear: (valor) => { for (const boton of botones) boton.disabled = valor; } };
};
