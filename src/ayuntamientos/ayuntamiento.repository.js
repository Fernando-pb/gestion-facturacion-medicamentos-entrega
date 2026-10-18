import pool from '../db.js';

const obtenerValoresAyuntamiento = (datos) => [
  datos.cif,
  datos.denominacion,
  datos.direccion,
  datos.codigo_postal,
  datos.localidad,
  datos.provincia,
  datos.telefono ?? null,
  datos.movil ?? null,
  datos.persona_responsable ?? null,
  datos.persona_contacto ?? null,
  datos.alcalde ?? null,
  datos.estado,
  datos.tipo_lista_medicamentos,
];

export const crearAyuntamiento = async (datos) => {
  const resultado = await pool.query(
    `
      INSERT INTO ayuntamiento (
        cif,
        denominacion,
        direccion,
        codigo_postal,
        localidad,
        provincia,
        telefono,
        movil,
        persona_responsable,
        persona_contacto,
        alcalde,
        estado,
        tipo_lista_medicamentos
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING
        id,
        cif,
        denominacion,
        direccion,
        codigo_postal,
        localidad,
        provincia,
        telefono,
        movil,
        persona_responsable,
        persona_contacto,
        alcalde,
        estado,
        tipo_lista_medicamentos;
    `,
    obtenerValoresAyuntamiento(datos),
  );

  return resultado.rows[0];
};

export const listarAyuntamientos = async () => {
  const resultado = await pool.query(`
    SELECT
      id,
      cif,
      denominacion,
      direccion,
      codigo_postal,
      localidad,
      provincia,
      telefono,
      movil,
      persona_responsable,
      persona_contacto,
      alcalde,
      estado,
      tipo_lista_medicamentos
    FROM ayuntamiento
    ORDER BY id ASC;
  `);

  return resultado.rows;
};

export const buscarAyuntamientoPorId = async (id) => {
  const resultado = await pool.query(
    `
      SELECT
        id,
        cif,
        denominacion,
        direccion,
        codigo_postal,
        localidad,
        provincia,
        telefono,
        movil,
        persona_responsable,
        persona_contacto,
        alcalde,
        estado,
        tipo_lista_medicamentos
      FROM ayuntamiento
      WHERE id = $1;
    `,
    [id],
  );

  return resultado.rows[0] ?? null;
};

export const actualizarAyuntamiento = async (id, datos) => {
  const resultado = await pool.query(
    `
      UPDATE ayuntamiento
      SET
        cif = $1,
        denominacion = $2,
        direccion = $3,
        codigo_postal = $4,
        localidad = $5,
        provincia = $6,
        telefono = $7,
        movil = $8,
        persona_responsable = $9,
        persona_contacto = $10,
        alcalde = $11,
        estado = $12,
        tipo_lista_medicamentos = $13
      WHERE id = $14
      RETURNING
        id,
        cif,
        denominacion,
        direccion,
        codigo_postal,
        localidad,
        provincia,
        telefono,
        movil,
        persona_responsable,
        persona_contacto,
        alcalde,
        estado,
        tipo_lista_medicamentos;
    `,
    [...obtenerValoresAyuntamiento(datos), id],
  );

  return resultado.rows[0] ?? null;
};
