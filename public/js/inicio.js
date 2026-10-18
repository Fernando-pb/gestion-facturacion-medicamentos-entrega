export const iniciarInicio = ({ documento = document } = {}) => {
  const nombres = ['diaria', 'maestros', 'informes', 'configuracion'];
  const botones = nombres.map((nombre) => documento.getElementById(`tab-${nombre}`));
  const seleccionar = (indice, enfocar = false) => {
    nombres.forEach((nombre, posicion) => {
      const activa = posicion === indice;
      botones[posicion].setAttribute('aria-selected', String(activa));
      botones[posicion].tabIndex = activa ? 0 : -1;
      documento.getElementById(`panel-${nombre}`).hidden = !activa;
    });
    if (enfocar) botones[indice].focus();
  };
  botones.forEach((boton, indice) => {
    boton.addEventListener('click', () => seleccionar(indice));
    boton.addEventListener('keydown', (evento) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(evento.key)) return;
      evento.preventDefault();
      const siguiente = evento.key === 'Home' ? 0 : evento.key === 'End' ? nombres.length - 1
        : (indice + (evento.key === 'ArrowRight' ? 1 : nombres.length - 1)) % nombres.length;
      seleccionar(siguiente, true);
    });
  });
  seleccionar(0);
};
if (typeof document !== 'undefined') iniciarInicio();
