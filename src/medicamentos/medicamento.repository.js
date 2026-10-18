import { construirPatronLiteral } from '../busqueda.js';
import pool from '../db.js';

const columnasMedicamento = `
  id,
  codigo_nacional,
  descripcion,
  precio,
  estado,
  situacion_comercial,
  tipo_facturacion,
  grupo_terapeutico,
  codigo_laboratorio,
  gtatc,
  nombre_grupo,
  anexo
`;

const camposEditables = [
  'codigo_nacional', 'descripcion', 'precio', 'estado', 'situacion_comercial',
  'tipo_facturacion', 'grupo_terapeutico', 'codigo_laboratorio', 'gtatc',
  'nombre_grupo', 'anexo',
];

const obtenerValores = (datos) => camposEditables.map((campo) => datos[campo] ?? null);

export const crearMedicamento = async (datos) => {
  const resultado = await pool.query(
    `
      INSERT INTO medicamento (
        codigo_nacional, descripcion, precio, estado, situacion_comercial,
        tipo_facturacion, grupo_terapeutico, codigo_laboratorio, gtatc,
        nombre_grupo, anexo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING ${columnasMedicamento};
    `,
    obtenerValores(datos),
  );

  return resultado.rows[0];
};

export const listarMedicamentos = async () => {
  const resultado = await pool.query(`
    SELECT ${columnasMedicamento}
    FROM medicamento
    ORDER BY id ASC;
  `);

  return resultado.rows;
};

export const buscarMedicamentoPorId = async (id) => {
  const resultado = await pool.query(
    `SELECT ${columnasMedicamento} FROM medicamento WHERE id = $1;`,
    [id],
  );

  return resultado.rows[0] ?? null;
};

export const actualizarMedicamento = async (id, datos) => {
  const assignments = camposEditables.map((campo, indice) => `${campo} = $${indice + 1}`);
  const resultado = await pool.query(
    `
      UPDATE medicamento
      SET ${assignments.join(', ')}
      WHERE id = $${camposEditables.length + 1}
      RETURNING ${columnasMedicamento};
    `,
    [...obtenerValores(datos), id],
  );

  return resultado.rows[0] ?? null;
};

export const buscarMedicamentos = async ({campo, modo, q}) => {
  const columnas = { codigo_nacional: 'codigo_nacional', descripcion: 'descripcion' };
  const columna = columnas[campo];
  const resultado = await pool.query(`
    SELECT id, codigo_nacional, descripcion, estado, situacion_comercial FROM medicamento
    WHERE ${columna} ILIKE $1 ESCAPE '!'
    ORDER BY ${columna} ASC, id ASC;`, [construirPatronLiteral(q, modo)]);
  return resultado.rows;
};
