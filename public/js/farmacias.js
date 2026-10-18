import {
  actualizarFarmacia,
  crearFarmacia,
  listarAyuntamientosParaFarmacia,
  listarFarmacias,
  obtenerFarmacia,
} from './farmacias-api.js';

const campos = [
  'soe', 'cif_nif', 'denominacion', 'direccion', 'codigo_postal', 'localidad',
  'provincia', 'telefono', 'pais_control_iban', 'entidad_bancaria',
  'sucursal_bancaria', 'digito_control_bancario', 'cuenta_bancaria',
];
const opcionales = new Set([
  'telefono', 'pais_control_iban', 'entidad_bancaria', 'sucursal_bancaria',
  'digito_control_bancario', 'cuenta_bancaria',
]);
const control = (name) => document.getElementById(`campo-${name.replaceAll('_', '-')}`);

export const iniciarInterfaz = ({ api = {
  actualizarFarmacia, crearFarmacia, listarAyuntamientosParaFarmacia, listarFarmacias, obtenerFarmacia,
} } = {}) => {
  const $ = (id) => document.getElementById(id);
  const formSection = $('seccion-formulario');
  const form = $('formulario-farmacia');
  const status = $('estado-formulario');
  const listStatus = $('estado-listado');
  const table = $('tabla-farmacias');
  const rows = $('filas-farmacias');
  const submit = $('guardar-farmacia');
  const cancel = $('cancelar-formulario');
  const relation = $('campo-ayuntamiento-id');
  let mode = null;
  let editingId = null;
  let enviando = false;
  let generacion = 0;
  let botonQueAbrio = $('nuevo-farmacia');
  const bloquear = (valor) => {
    for (const name of campos) control(name).disabled = valor;
    relation.disabled = valor || mode === 'edit';
    submit.disabled = valor;
    cancel.disabled = valor;
    const inicio = $('volver-inicio');
    if (inicio) { inicio.setAttribute('aria-disabled', String(enviando)); inicio.tabIndex = enviando ? -1 : 0; }
  };

  const showFormStatus = (message, error = false) => {
    status.textContent = message;
    status.className = error ? 'form-status message-error' : 'form-status';
    status.setAttribute('role', error ? 'alert' : 'status');
    status.setAttribute('aria-live', error ? 'assertive' : 'polite');
  };
  const showOperation = (message, error = false) => {
    const node = $('mensaje-operacion');
    node.textContent = message;
    node.hidden = false;
    node.className = `operation-message message-${error ? 'error' : 'success'}`;
    node.setAttribute('role', error ? 'alert' : 'status');
  };
  const renderRows = (farmacias) => {
    rows.replaceChildren(...farmacias.map((farmacia) => {
      const row = document.createElement('tr');
      for (const value of [farmacia.soe, farmacia.cif_nif, farmacia.denominacion,
        farmacia.localidad, farmacia.provincia]) {
        const cell = document.createElement('td');
        cell.textContent = value ?? '';
        row.append(cell);
      }
      const ayuntamientoCell = document.createElement('td');
      ayuntamientoCell.textContent = farmacia.ayuntamiento_denominacion ?? 'Sin Ayuntamiento';
      if (farmacia.ayuntamiento_cif) {
        const cif = document.createElement('small');
        cif.textContent = `CIF: ${farmacia.ayuntamiento_cif}`;
        ayuntamientoCell.append(document.createElement('br'), cif);
      }
      row.append(ayuntamientoCell);
      const cell = document.createElement('td');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button button-secondary';
      button.textContent = 'Ver/Editar';
      button.setAttribute('aria-label', `Ver o editar ${farmacia.denominacion || `farmacia ${farmacia.soe}`}`);
      button.addEventListener('click', () => openEdit(farmacia.id, button));
      cell.append(button);
      row.append(cell);
      return row;
    }));
  };
  const loadList = async () => {
    $('seccion-listado').setAttribute('aria-busy', 'true');
    listStatus.textContent = 'Cargando farmacias…';
    table.hidden = true;
    try {
      const data = await api.listarFarmacias();
      if (!Array.isArray(data)) throw new Error('La API devolvió un listado no válido.');
      if (data.length === 0) {
        listStatus.textContent = 'No hay farmacias registradas.';
        return;
      }
      renderRows(data);
      table.hidden = false;
      listStatus.textContent = `Se han cargado ${data.length} farmacias.`;
    } catch (error) {
      listStatus.textContent = `No se pudo cargar el listado. ${error.message}`;
      listStatus.className = 'list-status message-error';
      listStatus.setAttribute('role', 'alert');
      $('reintentar-listado').hidden = false;
    } finally {
      $('seccion-listado').setAttribute('aria-busy', 'false');
    }
  };
  const loadTownOptions = async (selectedId = '', actual = generacion) => {
    const towns = await api.listarAyuntamientosParaFarmacia();
    if (actual !== generacion) return;
    relation.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecciona un ayuntamiento';
    relation.append(placeholder);
    for (const town of towns) {
      const option = document.createElement('option');
      option.value = String(town.id);
      option.textContent = `${town.denominacion} (${town.cif})`;
      relation.append(option);
    }
    relation.value = String(selectedId);
  };
  const resetForm = () => {
    form.reset();
    relation.disabled = false;
    relation.required = true;
    for (const name of opcionales) control(name).value = '';
  };
  const openCreate = async () => {
    if (enviando) return;
    const actual = ++generacion;
    botonQueAbrio = $('nuevo-farmacia');
    mode = 'create';
    editingId = null;
    resetForm();
    $('titulo-formulario').textContent = 'Nueva farmacia';
    submit.textContent = 'Crear farmacia';
    formSection.hidden = false;
    $('seccion-listado').hidden = true;
    cancel.textContent = 'Cancelar y volver al listado';
    bloquear(true);
    cancel.disabled = false;
    showFormStatus('Cargando ayuntamientos…');
    try {
      await loadTownOptions('', actual);
      if (actual !== generacion) return;
      bloquear(false);
      showFormStatus('');
      control('soe').focus();
    } catch (error) {
      if (actual !== generacion) return;
      showFormStatus(`No se pudieron cargar los ayuntamientos. ${error.message}`, true);
      submit.disabled = true;
    }
  };
  const openEdit = async (id, botonOrigen) => {
    if (enviando) return;
    const actual = ++generacion;
    botonQueAbrio = botonOrigen ?? $('nuevo-farmacia');
    mode = 'edit';
    editingId = id;
    resetForm();
    $('titulo-formulario').textContent = 'Ver/Editar farmacia';
    submit.textContent = 'Guardar cambios';
    formSection.hidden = false;
    $('seccion-listado').hidden = true;
    cancel.textContent = 'Cancelar y volver al listado';
    bloquear(true);
    cancel.disabled = false;
    showFormStatus('Cargando datos de la farmacia…');
    submit.disabled = true;
    try {
      const pharmacy = await api.obtenerFarmacia(id);
      if (actual !== generacion) return;
      for (const name of campos) control(name).value = pharmacy[name] ?? '';
      const option = document.createElement('option');
      option.value = pharmacy.ayuntamiento_id === null ? '' : String(pharmacy.ayuntamiento_id);
      option.textContent = pharmacy.ayuntamiento_id === null
        ? 'Sin Ayuntamiento'
        : `${pharmacy.ayuntamiento_denominacion} (${pharmacy.ayuntamiento_cif})`;
      relation.replaceChildren(option);
      relation.value = option.value;
      relation.disabled = true;
      relation.required = false;
      showFormStatus('La asignación de Ayuntamiento no se puede cambiar desde este formulario.');
      submit.disabled = false;
      bloquear(false);
      control('soe').focus();
    } catch (error) {
      if (actual !== generacion) return;
      showFormStatus(`No se pudo cargar la farmacia. ${error.message}`, true);
    }
  };
  const dataFromForm = () => Object.fromEntries(campos.map((name) => {
    const value = control(name).value;
    return [name, opcionales.has(name) && value.trim() === '' ? null : value];
  }));

  $('nuevo-farmacia').addEventListener('click', openCreate);
  $('volver-inicio')?.addEventListener('click', (evento) => { if (enviando) evento.preventDefault(); });
  $('reintentar-listado').addEventListener('click', () => void loadList());
  cancel.addEventListener('click', () => {
    if (enviando) return;
    ++generacion;
    formSection.hidden = true;
    $('seccion-listado').hidden = false;
    mode = null;
    resetForm();
    bloquear(false);
    (botonQueAbrio?.isConnected === false ? $('nuevo-farmacia') : botonQueAbrio)?.focus();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (mode === null || enviando || submit.disabled) return;
    enviando = true;
    bloquear(true);
    showFormStatus('Guardando farmacia…');
    try {
      const data = dataFromForm();
      if (mode === 'create') {
        data.ayuntamiento_id = Number(relation.value);
        await api.crearFarmacia(data);
        showOperation('Farmacia creada correctamente.');
      } else {
        await api.actualizarFarmacia(editingId, data);
        showOperation('Farmacia actualizada correctamente.');
      }
      formSection.hidden = true;
      $('seccion-listado').hidden = false;
      mode = null;
      await loadList();
      $('nuevo-farmacia').focus();
    } catch (error) {
      showFormStatus(`No se pudo guardar la farmacia. ${error.message}`, true);
    } finally {
      enviando = false;
      bloquear(false);
    }
  });
  formSection.hidden = true;
  $('seccion-listado').hidden = false;
  void loadList();
};

if (typeof document !== 'undefined') iniciarInterfaz();
