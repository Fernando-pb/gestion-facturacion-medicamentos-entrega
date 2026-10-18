import { randomUUID } from 'node:crypto';

import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import app from '../src/app.js';
import pool from '../src/db.js';

const TEST_DATABASE = 'gestion_facturacion_medicamentos_test';

const camposObligatorios = [
  'cif', 'denominacion', 'direccion', 'codigo_postal', 'localidad', 'provincia',
  'estado', 'tipo_lista_medicamentos',
];
const cadenasObligatorias = camposObligatorios.slice(0, 6);
const camposOpcionales = [
  'telefono', 'movil', 'persona_responsable', 'persona_contacto', 'alcalde',
];

let idsCreados;

const crearCuerpoAyuntamiento = (cambios = {}) => ({
  cif: `TEST-${randomUUID().replaceAll('-', '').slice(0, 12)}`,
  denominacion: 'Ayuntamiento ficticio',
  direccion: 'Calle de Prueba 1',
  codigo_postal: '28001',
  localidad: 'Localidad de Prueba',
  provincia: 'Provincia de Prueba',
  estado: 'ACTIVO',
  tipo_lista_medicamentos: 'GENERAL',
  ...cambios,
});

const registrarIdCreado = (respuesta) => {
  const id = respuesta.body?.id;

  if (Number.isInteger(id)) {
    idsCreados.add(id);
  }

  return id;
};

const enviarCreacion = async (datos) => {
  const respuesta = await request(app).post('/ayuntamientos').send(datos);
  registrarIdCreado(respuesta);
  return respuesta;
};

beforeAll(async () => {
  const resultado = await pool.query('SELECT current_database() AS nombre;');

  expect(resultado.rows[0].nombre).toBe(TEST_DATABASE);
});

beforeEach(() => {
  idsCreados = new Set();
});

afterEach(async () => {
  try {
    for (const id of idsCreados) {
      await pool.query('DELETE FROM ayuntamiento WHERE id = $1;', [id]);
    }
  } finally {
    idsCreados.clear();
  }
});

afterAll(async () => {
  await pool.end();
});

describe('API de ayuntamientos', () => {
  it('crea un ayuntamiento con 201 y devuelve los campos obligatorios', async () => {
    const datos = crearCuerpoAyuntamiento();
    const respuesta = await enviarCreacion(datos);
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.id).toEqual(expect.any(Number));
    expect(respuesta.body).toMatchObject({ ...datos, cif: datos.cif.toUpperCase() });
  });

  it('devuelve y almacena el CIF recortado y en mayusculas', async () => {
    const cif = crearCuerpoAyuntamiento().cif.toLowerCase();
    const respuesta = await enviarCreacion(crearCuerpoAyuntamiento({ cif: `  ${cif}  ` }));
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.cif).toBe(cif.toUpperCase());

    const resultado = await pool.query('SELECT cif FROM ayuntamiento WHERE id = $1;', [respuesta.body.id]);
    expect(resultado.rows[0].cif).toBe(cif.toUpperCase());
  });

  it('devuelve null para todos los campos opcionales omitidos', async () => {
    const respuesta = await enviarCreacion(crearCuerpoAyuntamiento());
    expect(respuesta.status).toBe(201);
    for (const campo of camposOpcionales) {
      expect(respuesta.body[campo]).toBeNull();
    }
  });

  it.each(camposObligatorios)('rechaza la ausencia de %s con 400', async (campo) => {
    const datos = crearCuerpoAyuntamiento();
    delete datos[campo];
    const respuesta = await enviarCreacion(datos);
    expect(respuesta.status).toBe(400);
  });

  it.each(cadenasObligatorias.flatMap((campo) => ['', '   '].map((valor) => [campo, valor])))(
    'rechaza %s con valor vacio %j',
    async (campo, valor) => {
      const respuesta = await enviarCreacion(crearCuerpoAyuntamiento({ [campo]: valor }));
      expect(respuesta.status).toBe(400);
    },
  );

  it.each([...camposObligatorios, ...camposOpcionales])(
    'rechaza un tipo numerico incorrecto en %s',
    async (campo) => {
      const respuesta = await enviarCreacion(crearCuerpoAyuntamiento({ [campo]: 123 }));
      expect(respuesta.status).toBe(400);
    },
  );

  it('rechaza un estado no permitido', async () => {
    const respuesta = await enviarCreacion(crearCuerpoAyuntamiento({ estado: 'PENDIENTE' }));
    expect(respuesta.status).toBe(400);
  });

  it('rechaza un tipo de lista no permitido', async () => {
    const respuesta = await enviarCreacion(crearCuerpoAyuntamiento({ tipo_lista_medicamentos: 'OTRA' }));
    expect(respuesta.status).toBe(400);
  });

  it('rechaza campos desconocidos', async () => {
    const respuesta = await enviarCreacion(crearCuerpoAyuntamiento({ id: 42 }));
    expect(respuesta.status).toBe(400);
  });

  it.each(['igual', 'minusculas'])('rechaza un CIF duplicado con 409 (%s)', async (variante) => {
    const datos = crearCuerpoAyuntamiento();
    const cif = datos.cif.toUpperCase();
    const primera = await enviarCreacion({ ...datos, cif: variante === 'minusculas' ? ` ${cif.toLowerCase()} ` : cif });
    expect(primera.status).toBe(201);

    const segunda = await enviarCreacion(crearCuerpoAyuntamiento({ cif }));
    expect(segunda.status).toBe(409);
    expect(segunda.body).toEqual({ error: 'El CIF ya está registrado.' });

    const resultado = await pool.query('SELECT id FROM ayuntamiento WHERE cif = $1;', [cif]);
    expect(resultado.rows).toEqual([{ id: primera.body.id }]);
  });
});

describe('Listado y detalle de ayuntamientos', () => {
  it('devuelve 200 y un array en el listado', async () => {
    const respuesta = await request(app).get('/ayuntamientos');

    expect(respuesta.status).toBe(200);
    expect(Array.isArray(respuesta.body)).toBe(true);
  });

  it('incluye ayuntamientos activos e inactivos', async () => {
    const activo = await enviarCreacion(crearCuerpoAyuntamiento({ estado: 'ACTIVO' }));
    const inactivo = await enviarCreacion(crearCuerpoAyuntamiento({ estado: 'INACTIVO' }));
    expect(activo.status).toBe(201);
    expect(inactivo.status).toBe(201);

    const respuesta = await request(app).get('/ayuntamientos');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: activo.body.id, estado: 'ACTIVO' }),
      expect.objectContaining({ id: inactivo.body.id, estado: 'INACTIVO' }),
    ]));
  });

  it('ordena por id ASC los registros propios aunque existan otros', async () => {
    const idsPropios = [];
    for (let indice = 0; indice < 3; indice += 1) {
      const creacion = await enviarCreacion(crearCuerpoAyuntamiento());
      expect(creacion.status).toBe(201);
      idsPropios.push(creacion.body.id);
    }

    const respuesta = await request(app).get('/ayuntamientos');
    expect(respuesta.status).toBe(200);

    const idsEnListado = respuesta.body
      .filter((registro) => idsPropios.includes(registro.id))
      .map((registro) => registro.id);

    expect(idsEnListado).toEqual([...idsPropios].sort((a, b) => a - b));
  });

  it('devuelve 200 y el registro completo para un id existente', async () => {
    const creacion = await enviarCreacion(crearCuerpoAyuntamiento());
    expect(creacion.status).toBe(201);

    const respuesta = await request(app).get(`/ayuntamientos/${creacion.body.id}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual(creacion.body);
  });

  it('devuelve 404 para un id valido inexistente', async () => {
    const creacion = await enviarCreacion(crearCuerpoAyuntamiento());
    expect(creacion.status).toBe(201);
    await pool.query('DELETE FROM ayuntamiento WHERE id = $1;', [creacion.body.id]);

    const respuesta = await request(app).get(`/ayuntamientos/${creacion.body.id}`);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ error: 'Ayuntamiento no encontrado.' });
  });

  it.each(['texto', '0', '-1', '1.5', '2147483648'])(
    'devuelve 400 para el id invalido %s',
    async (id) => {
      const respuesta = await request(app).get(`/ayuntamientos/${id}`);

      expect(respuesta.status).toBe(400);
      expect(respuesta.body).toEqual({ error: 'Identificador no válido.' });
    },
  );

  it('acepta un id existente con ceros iniciales', async () => {
    const creacion = await enviarCreacion(crearCuerpoAyuntamiento());
    expect(creacion.status).toBe(201);

    const respuesta = await request(app).get(`/ayuntamientos/00${creacion.body.id}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual(creacion.body);
    expect(respuesta.body.id).toBe(creacion.body.id);
  });
});

describe('Modificación completa de ayuntamientos', () => {
  it('actualiza todos los campos, normaliza el CIF y persiste los valores', async () => {
    const creacion = await enviarCreacion(crearCuerpoAyuntamiento());
    expect(creacion.status).toBe(201);
    const id = creacion.body.id;
    const cifActualizado = `  ${crearCuerpoAyuntamiento().cif.toLowerCase()}  `;
    const datosActualizados = crearCuerpoAyuntamiento({
      cif: cifActualizado,
      denominacion: 'Ayuntamiento actualizado',
      direccion: 'Avenida Ficticia 25',
      codigo_postal: '08001',
      localidad: 'Localidad Actualizada',
      provincia: 'Provincia Actualizada',
      telefono: 'TEST-TELEFONO-001',
      movil: 'TEST-TELEFONO-002',
      persona_responsable: 'Responsable Ficticio',
      persona_contacto: 'Contacto Ficticio',
      alcalde: 'Alcalde Ficticio',
      estado: 'INACTIVO',
      tipo_lista_medicamentos: 'ESPECIFICA',
    });

    const respuesta = await request(app).put(`/ayuntamientos/${id}`).send(datosActualizados);
    const valoresEsperados = {
      ...datosActualizados,
      cif: cifActualizado.trim().toUpperCase(),
    };

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.id).toBe(id);
    expect(respuesta.body).toMatchObject(valoresEsperados);

    const consulta = await request(app).get(`/ayuntamientos/${id}`);
    expect(consulta.status).toBe(200);
    expect(consulta.body).toEqual(respuesta.body);
  });

  it('permite conservar el CIF propio, cambiar el estado y actualizar opcionales a null', async () => {
    const creacion = await enviarCreacion(crearCuerpoAyuntamiento({ estado: 'INACTIVO' }));
    expect(creacion.status).toBe(201);
    const id = creacion.body.id;
    const datosActualizados = crearCuerpoAyuntamiento({
      cif: creacion.body.cif,
      estado: 'ACTIVO',
      telefono: null,
      movil: null,
      persona_responsable: null,
      persona_contacto: null,
      alcalde: null,
    });

    const respuesta = await request(app).put(`/ayuntamientos/${id}`).send(datosActualizados);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.id).toBe(id);
    expect(respuesta.body.cif).toBe(creacion.body.cif);
    expect(respuesta.body.estado).toBe('ACTIVO');
    for (const campo of camposOpcionales) {
      expect(respuesta.body[campo]).toBeNull();
    }
  });

  it('devuelve 404 para un id válido inexistente', async () => {
    const creacion = await enviarCreacion(crearCuerpoAyuntamiento());
    expect(creacion.status).toBe(201);
    const id = creacion.body.id;
    await pool.query('DELETE FROM ayuntamiento WHERE id = $1;', [id]);

    const respuesta = await request(app)
      .put(`/ayuntamientos/${id}`)
      .send(crearCuerpoAyuntamiento());

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ error: 'Ayuntamiento no encontrado.' });
  });

  it.each(['texto', '0', '-1', '1.5', '2147483648'])(
    'devuelve 400 para el id inválido %s',
    async (id) => {
      const respuesta = await request(app)
        .put(`/ayuntamientos/${id}`)
        .send(crearCuerpoAyuntamiento());

      expect(respuesta.status).toBe(400);
      expect(respuesta.body).toEqual({ error: 'Identificador no válido.' });
    },
  );

  it.each(camposObligatorios)('requiere %s en el cuerpo completo de PUT', async (campo) => {
    const creacion = await enviarCreacion(crearCuerpoAyuntamiento());
    expect(creacion.status).toBe(201);
    const datos = crearCuerpoAyuntamiento();
    delete datos[campo];

    const respuesta = await request(app).put(`/ayuntamientos/${creacion.body.id}`).send(datos);

    expect(respuesta.status).toBe(400);
  });

  it.each(cadenasObligatorias.flatMap((campo) => ['', '   '].map((valor) => [campo, valor])))(
    'devuelve 400 si %s está vacío (%j)',
    async (campo, valor) => {
      const creacion = await enviarCreacion(crearCuerpoAyuntamiento());
      expect(creacion.status).toBe(201);

      const respuesta = await request(app)
        .put(`/ayuntamientos/${creacion.body.id}`)
        .send(crearCuerpoAyuntamiento({ [campo]: valor }));

      expect(respuesta.status).toBe(400);
    },
  );

  it.each([...camposObligatorios, ...camposOpcionales])(
    'devuelve 400 si %s tiene un tipo incorrecto',
    async (campo) => {
      const creacion = await enviarCreacion(crearCuerpoAyuntamiento());
      expect(creacion.status).toBe(201);

      const respuesta = await request(app)
        .put(`/ayuntamientos/${creacion.body.id}`)
        .send(crearCuerpoAyuntamiento({ [campo]: 123 }));

      expect(respuesta.status).toBe(400);
    },
  );

  it.each([
    ['estado', 'PENDIENTE'],
    ['tipo_lista_medicamentos', 'OTRA'],
  ])('devuelve 400 para %s no permitido', async (campo, valor) => {
    const creacion = await enviarCreacion(crearCuerpoAyuntamiento());
    expect(creacion.status).toBe(201);

    const respuesta = await request(app)
      .put(`/ayuntamientos/${creacion.body.id}`)
      .send(crearCuerpoAyuntamiento({ [campo]: valor }));

    expect(respuesta.status).toBe(400);
  });

  it('devuelve 400 si el cuerpo contiene campos desconocidos', async () => {
    const creacion = await enviarCreacion(crearCuerpoAyuntamiento());
    expect(creacion.status).toBe(201);

    const respuesta = await request(app)
      .put(`/ayuntamientos/${creacion.body.id}`)
      .send(crearCuerpoAyuntamiento({ campo_desconocido: 'valor ficticio' }));

    expect(respuesta.status).toBe(400);
  });

  it.each(['igual', 'minusculas'])(
    'devuelve 409 si se intenta usar el CIF de otro ayuntamiento (%s)',
    async (variante) => {
      const primero = await enviarCreacion(crearCuerpoAyuntamiento());
      expect(primero.status).toBe(201);
      const segundo = await enviarCreacion(crearCuerpoAyuntamiento());
      expect(segundo.status).toBe(201);
      const cifDuplicado = variante === 'minusculas'
        ? ` ${primero.body.cif.toLowerCase()} `
        : primero.body.cif;

      const respuesta = await request(app)
        .put(`/ayuntamientos/${segundo.body.id}`)
        .send(crearCuerpoAyuntamiento({ cif: cifDuplicado }));

      expect(respuesta.status).toBe(409);
      expect(respuesta.body).toEqual({ error: 'El CIF ya está registrado.' });

      const segundoSinCambios = await request(app).get(`/ayuntamientos/${segundo.body.id}`);
      expect(segundoSinCambios.status).toBe(200);
      expect(segundoSinCambios.body.cif).toBe(segundo.body.cif);
    },
  );
});
