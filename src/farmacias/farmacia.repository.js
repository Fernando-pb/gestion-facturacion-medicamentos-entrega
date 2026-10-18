import pool from '../db.js';

const columnasFarmacia = `
  farmacia.id,
  farmacia.soe,
  farmacia.cif_nif,
  farmacia.denominacion,
  farmacia.direccion,
  farmacia.codigo_postal,
  farmacia.localidad,
  farmacia.provincia,
  farmacia.telefono,
  farmacia.ayuntamiento_id,
  ayuntamiento.denominacion AS ayuntamiento_denominacion,
  ayuntamiento.cif AS ayuntamiento_cif,
  farmacia.pais_control_iban,
  farmacia.entidad_bancaria,
  farmacia.sucursal_bancaria,
  farmacia.digito_control_bancario,
  farmacia.cuenta_bancaria
`;

const camposEditables = [
  'soe', 'cif_nif', 'denominacion', 'direccion', 'codigo_postal', 'localidad',
  'provincia', 'telefono', 'pais_control_iban', 'entidad_bancaria',
  'sucursal_bancaria', 'digito_control_bancario', 'cuenta_bancaria',
];

const obtenerValores = (datos) => camposEditables.map((campo) => datos[campo] ?? null);

export const crearFarmacia = async (datos) => {
  const resultado = await pool.query(
    `
      INSERT INTO farmacia (
        soe, cif_nif, denominacion, direccion, codigo_postal, localidad,
        provincia, telefono, ayuntamiento_id, pais_control_iban,
        entidad_bancaria, sucursal_bancaria, digito_control_bancario,
        cuenta_bancaria
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id;
    `,
    [
      datos.soe, datos.cif_nif, datos.denominacion, datos.direccion,
      datos.codigo_postal, datos.localidad, datos.provincia,
      datos.telefono ?? null, datos.ayuntamiento_id,
      datos.pais_control_iban ?? null, datos.entidad_bancaria ?? null,
      datos.sucursal_bancaria ?? null, datos.digito_control_bancario ?? null,
      datos.cuenta_bancaria ?? null,
    ],
  );

  return buscarFarmaciaPorId(resultado.rows[0].id);
};

export const listarFarmacias = async () => {
  const resultado = await pool.query(`
    SELECT ${columnasFarmacia}
    FROM farmacia
    LEFT JOIN ayuntamiento ON ayuntamiento.id = farmacia.ayuntamiento_id
    ORDER BY farmacia.id ASC;
  `);
  return resultado.rows;
};

export const buscarFarmaciaPorId = async (id) => {
  const resultado = await pool.query(
    `
      SELECT ${columnasFarmacia}
      FROM farmacia
      LEFT JOIN ayuntamiento ON ayuntamiento.id = farmacia.ayuntamiento_id
      WHERE farmacia.id = $1;
    `,
    [id],
  );
  return resultado.rows[0] ?? null;
};

export const actualizarFarmacia = async (id, datos) => {
  const assignments = camposEditables.map((campo, indice) => `${campo} = $${indice + 1}`);
  const resultado = await pool.query(
    `
      UPDATE farmacia
      SET ${assignments.join(', ')}
      WHERE id = $${camposEditables.length + 1}
      RETURNING id;
    `,
    [...obtenerValores(datos), id],
  );

  if (resultado.rows.length === 0) return null;
  return buscarFarmaciaPorId(resultado.rows[0].id);
};
