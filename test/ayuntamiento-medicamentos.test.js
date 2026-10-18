import { randomUUID, randomInt } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import pool from '../src/db.js';

const clave = () => `TEST-${randomUUID()}`;
let ayuntamientos;
let medicamentos;
let operativos;
const datosMedicamento = (cambios = {}) => ({ codigo_nacional: clave(), descripcion: 'Medicamento ficticio', precio: '12.34', estado: 'ACTIVO', situacion_comercial: 'ALTA', tipo_facturacion: 'TD', grupo_terapeutico: null, codigo_laboratorio: null, gtatc: null, nombre_grupo: null, anexo: null, ...cambios });
const crearAyuntamiento = async (modalidad = 'ESPECIFICA') => {
  const row = (await pool.query(`INSERT INTO ayuntamiento
    (cif, denominacion, direccion, codigo_postal, localidad, provincia, estado, tipo_lista_medicamentos)
    VALUES ($1, 'Ayuntamiento ficticio', 'Calle', '28001', 'Villa', 'Madrid', 'ACTIVO', $2) RETURNING *;`, [clave(), modalidad])).rows[0];
  ayuntamientos.push(row); return row;
};
const crearMedicamento = async (cambios = {}) => {
  const respuesta = await request(app).post('/medicamentos').send(datosMedicamento(cambios));
  expect(respuesta.status).toBe(201);
  medicamentos.push(respuesta.body); return respuesta.body;
};
const ruta = (id) => `/ayuntamientos/${id}/medicamentos`;
const listar = (id) => request(app).get(ruta(id));
const asociar = (id, medicamentoId) => request(app).post(ruta(id)).send({ medicamento_id: medicamentoId });
const retirar = (id, medicamentoId) => request(app).delete(`${ruta(id)}/${medicamentoId}`);
const buscar = (parametros) => request(app).get('/medicamentos').query(parametros);
const ids = (respuesta) => respuesta.body.map((m) => m.id);
const comprobarProyeccion = (respuesta) => {
  expect(respuesta.status).toBe(200);
  for (const row of respuesta.body) expect(Object.keys(row).sort()).toEqual(['id','codigo_nacional','descripcion','estado','situacion_comercial'].sort());
};
const comprobarRelacion = (respuesta, ayuntamiento, medicamento) => {
  expect(respuesta).toMatchObject({ id: expect.any(Number), ayuntamiento_id: ayuntamiento.id, medicamento_id: medicamento.id, codigo_nacional: medicamento.codigo_nacional, descripcion: medicamento.descripcion, estado: medicamento.estado, situacion_comercial: medicamento.situacion_comercial, tipo_lista_medicamentos: ayuntamiento.tipo_lista_medicamentos, lista_especifica_aplicable: ayuntamiento.tipo_lista_medicamentos === 'ESPECIFICA', aviso: ayuntamiento.tipo_lista_medicamentos === 'GENERAL' ? 'No se aplica mientras se utiliza la lista general' : null });
};
const esperarBloqueados = async (pid, numero = 1) => {
  const fin = Date.now() + 5000;
  while (Date.now() < fin) {
    const consulta = await pool.query('SELECT count(*)::integer AS n FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid));', [pid]);
    if (consulta.rows[0].n >= numero) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('No se observaron las peticiones concurrentes bloqueadas en PostgreSQL.');
};
beforeAll(async () => {
  if (process.env.DB_NAME !== 'gestion_facturacion_medicamentos_test') throw new Error('Estas pruebas requieren la base dedicada.');
  expect((await pool.query('SELECT current_database() AS nombre;')).rows[0].nombre).toBe('gestion_facturacion_medicamentos_test');
});
beforeEach(() => { ayuntamientos=[]; medicamentos=[]; operativos={precintos:[],entregas:[],farmacias:[],periodos:[]}; });
afterEach(async () => {
  for (const id of operativos.precintos) await pool.query('DELETE FROM precinto WHERE id=$1;', [id]);
  for (const id of operativos.entregas) await pool.query('DELETE FROM entrega_farmacia_periodo WHERE id=$1;', [id]);
  for (const id of operativos.farmacias) await pool.query('DELETE FROM farmacia WHERE id=$1;', [id]);
  for (const id of operativos.periodos) await pool.query('DELETE FROM periodo WHERE id=$1;', [id]);
  for (const row of ayuntamientos) await pool.query('DELETE FROM ayuntamiento_medicamento WHERE ayuntamiento_id = $1;', [row.id]);
  for (const row of medicamentos) await pool.query('DELETE FROM medicamento WHERE id = $1;', [row.id]);
  for (const row of ayuntamientos) await pool.query('DELETE FROM ayuntamiento WHERE id = $1;', [row.id]);
});
afterAll(async () => pool.end());

describe('lista específica municipal de Medicamentos', () => {
  it('lista asociaciones y maestros actuales solo del Ayuntamiento seleccionado', async () => {
    const town=await crearAyuntamiento(); const otro=await crearAyuntamiento();
    const primero=await crearMedicamento(); const segundo=await crearMedicamento();
    const a=await asociar(town.id, primero.id); const b=await asociar(town.id,segundo.id);
    await asociar(otro.id,primero.id);
    const actualizado={...primero, descripcion:'Descripción actual', estado:'INACTIVO', situacion_comercial:'BAJA'};
    const {id,...cuerpo}=actualizado;
    expect((await request(app).put(`/medicamentos/${id}`).send(cuerpo)).status).toBe(200);
    const respuesta=await listar(town.id); expect(respuesta.status).toBe(200);
    expect(respuesta.body.map((r)=>r.id)).toEqual([a.body.id,b.body.id]);
    comprobarRelacion(respuesta.body[0],town,actualizado);
    comprobarRelacion(respuesta.body[1],town,segundo);
    expect(respuesta.body[0]).not.toHaveProperty('precio');
  });
  it.each(['GENERAL','ESPECIFICA'])('lista vacía conserva modalidad %s sin reinterpretarla', async (modalidad) => {
    const town=await crearAyuntamiento(modalidad);
    expect((await listar(town.id)).body).toEqual([]);
    expect((await request(app).get(`/ayuntamientos/${town.id}`)).body.tipo_lista_medicamentos).toBe(modalidad);
  });
  it.each(['ACTIVO','INACTIVO'].flatMap((estado)=>['ALTA','BAJA'].map((situacion)=>[estado,situacion])))('permite asociar %s/%s y mantiene los conceptos separados', async (estado,situacion_comercial) => {
    const town=await crearAyuntamiento(); const medicamento=await crearMedicamento({estado,situacion_comercial});
    const respuesta=await asociar(town.id,medicamento.id);
    expect(respuesta.status).toBe(201); comprobarRelacion(respuesta.body,town,medicamento);
    expect((await request(app).get(`/medicamentos/${medicamento.id}`)).body).toEqual(medicamento);
  });
  it('rechaza duplicado, conserva asociación y permite pareja en otro Ayuntamiento', async () => {
    const town=await crearAyuntamiento(); const otro=await crearAyuntamiento(); const m=await crearMedicamento();
    const primera=await asociar(town.id,m.id); const segunda=await asociar(town.id,m.id);
    expect(segunda.status).toBe(409); expect(segunda.body).toEqual({error:'El medicamento ya está asociado a este Ayuntamiento.'});
    expect((await listar(town.id)).body).toEqual([primera.body]);
    expect((await asociar(otro.id,m.id)).status).toBe(201);
  });
  it('retira solo la relación, conserva maestro y asociación de otro Ayuntamiento', async () => {
    const town=await crearAyuntamiento(); const otro=await crearAyuntamiento(); const m=await crearMedicamento();
    await asociar(town.id,m.id); const otra=await asociar(otro.id,m.id);
    const respuesta=await retirar(town.id,m.id); expect(respuesta.status).toBe(204); expect(respuesta.text).toBe('');
    expect((await listar(town.id)).body).toEqual([]);
    expect((await listar(otro.id)).body).toEqual([otra.body]);
    expect((await request(app).get(`/medicamentos/${m.id}`)).body).toEqual(m);
    expect((await retirar(town.id,m.id)).status).toBe(404);
  });
  it('retirar autorización específica conserva el precinto aceptado y su precio aplicado', async () => {
    const town=await crearAyuntamiento(); const m=await crearMedicamento(); await asociar(town.id,m.id);
    const f=(await pool.query(`INSERT INTO farmacia (soe,cif_nif,denominacion,direccion,codigo_postal,localidad,provincia,ayuntamiento_id)
      VALUES ($1,'TEST-CIF-0001','Farmacia ficticia','Calle','28001','Villa','Madrid',$2) RETURNING id;`,[clave(),town.id])).rows[0].id;
    operativos.farmacias.push(f);
    const p=(await pool.query('INSERT INTO periodo (mes,anio) VALUES (1,$1) RETURNING id;',[randomInt(100000,2000000000)])).rows[0].id;
    operativos.periodos.push(p);
    const entrega=(await pool.query(`INSERT INTO entrega_farmacia_periodo
      (farmacia_id,periodo_id,denominacion_farmacia,cif_nif_farmacia)
      VALUES ($1,$2,'Farmacia ficticia','TEST-CIF-0001') RETURNING id;`,[f,p])).rows[0].id;
    operativos.entregas.push(entrega);
    const precinto=(await pool.query(`INSERT INTO precinto (entrega_id,numero_paquete,posicion_paquete,codigo_barras_original,codigo_nacional,medicamento_id,precio_aplicado, precio_referencia)
      VALUES ($1,1,1,'FICTICIO',$2,$3,9.99, 9.99) RETURNING *;`,[entrega,m.codigo_nacional,m.id])).rows[0];
    operativos.precintos.push(precinto.id);
    expect((await retirar(town.id,m.id)).status).toBe(204);
    expect((await pool.query('SELECT * FROM precinto WHERE id=$1;',[precinto.id])).rows[0]).toEqual(precinto);
    expect((await request(app).get(`/medicamentos/${m.id}`)).body).toEqual(m);
  });
  it('retirada de pareja inexistente informa 404 sin borrar maestros', async () => {
    const town=await crearAyuntamiento(); const m=await crearMedicamento();
    expect((await retirar(town.id,m.id)).body).toEqual({error:'El medicamento no está asociado al Ayuntamiento indicado.'});
    expect((await request(app).get(`/medicamentos/${m.id}`)).status).toBe(200);
  });
  it('Ayuntamiento inexistente responde 404 en las tres operaciones', async () => {
    const m=await crearMedicamento();
    for (const r of [await listar(2147483647),await asociar(2147483647,m.id),await retirar(2147483647,m.id)]) {
      expect(r.status).toBe(404); expect(r.body).toEqual({error:'Ayuntamiento no encontrado.'});
    }
  });
  it('medicamento inexistente responde 404 en asociación/retirada', async () => {
    const town=await crearAyuntamiento();
    for (const r of [await asociar(town.id,2147483647),await retirar(town.id,2147483647)]) {
      expect(r.status).toBe(404);expect(r.body).toEqual({error:'Medicamento no encontrado.'});
    }
  });
  it.each(['no','0','-1','1.2','2147483648'])('rechaza ID de ruta inválido %s', async (id) => {
    for (const r of [await listar(id),await asociar(id,1),await retirar(id,1),await retirar(1,id)]) {
      expect(r.status).toBe(400);expect(r.body).toHaveProperty('error');
    }
  });
  it.each([{}, {medicamento_id:null},{medicamento_id:'1'},{medicamento_id:0},{medicamento_id:-1},{medicamento_id:1.5},{medicamento_id:2147483648},{medicamento_id:1,estado:'ACTIVO'}])('rechaza cuerpo inválido %j antes de consultar maestros', async (cuerpo) => {
    const respuesta=await request(app).post(ruta(1)).send(cuerpo);expect(respuesta.status).toBe(400);expect(respuesta.body).toHaveProperty('error');
  });
  it('rechaza filtros no contratados en lista específica', async () => {
    expect((await request(app).get(ruta(1)).query({estado:'ACTIVO'})).status).toBe(400);
  });
  it('conserva parejas al cambiar GENERAL/ESPECIFICA e informa aplicabilidad y estados', async () => {
    const town=await crearAyuntamiento('GENERAL'); const m=await crearMedicamento({estado:'INACTIVO',situacion_comercial:'BAJA'});
    const asociacion=await asociar(town.id,m.id); comprobarRelacion(asociacion.body,town,m);
    const {id,...cuerpo}=town;
    for (const modalidad of ['ESPECIFICA','GENERAL','ESPECIFICA']) {
      expect((await request(app).put(`/ayuntamientos/${id}`).send({...cuerpo,tipo_lista_medicamentos:modalidad})).status).toBe(200);
      const resultado=await listar(id); expect(resultado.body).toHaveLength(1);expect(resultado.body[0].id).toBe(asociacion.body.id);
      comprobarRelacion(resultado.body[0],{...town,tipo_lista_medicamentos:modalidad},m);
    }
  });
  it('dos altas concurrentes reales producen 201/409 y una única pareja', async () => {
    const town=await crearAyuntamiento(); const m=await crearMedicamento(); const gate=await pool.connect(); let solicitudes=[];
    try {
      await gate.query('BEGIN');
      await gate.query('SELECT id FROM medicamento WHERE id=$1 FOR UPDATE;', [m.id]);
      const pid=(await gate.query('SELECT pg_backend_pid() AS pid;')).rows[0].pid;
      solicitudes=[asociar(town.id,m.id).then(r=>r),asociar(town.id,m.id).then(r=>r)];
      await esperarBloqueados(pid,2); await gate.query('COMMIT');
      const resultados=await Promise.all(solicitudes);expect(resultados.map(r=>r.status).sort()).toEqual([201,409]);
      expect(resultados.find(r=>r.status===409).body.error).toBe('El medicamento ya está asociado a este Ayuntamiento.');
      expect((await listar(town.id)).body).toHaveLength(1);
    } finally { await gate.query('ROLLBACK');gate.release();await Promise.allSettled(solicitudes); }
  });
  it.each(['COMMIT','ROLLBACK'])('INSERT concurrente pendiente: espera al UNIQUE y resuelve tras %s', async (fin) => {
    const town=await crearAyuntamiento();const m=await crearMedicamento();const gate=await pool.connect();let solicitud;
    try {
      await gate.query('BEGIN');
      await gate.query('INSERT INTO ayuntamiento_medicamento (ayuntamiento_id,medicamento_id) VALUES ($1,$2);',[town.id,m.id]);
      const pid=(await gate.query('SELECT pg_backend_pid() AS pid;')).rows[0].pid;
      solicitud=asociar(town.id,m.id).then(r=>r);await esperarBloqueados(pid);await gate.query(fin);
      const resultado=await solicitud;expect(resultado.status).toBe(fin==='COMMIT'?409:201);
      expect((await listar(town.id)).body).toHaveLength(1);
    } finally { await gate.query('ROLLBACK');gate.release(); if(solicitud) await Promise.allSettled([solicitud]); }
  });
});

describe('búsqueda de Medicamentos sin cambiar el catálogo CRUD', () => {
  it.each(['codigo_nacional','descripcion'].flatMap((campo)=>['exacto','prefijo','contiene'].map((modo)=>[campo,modo])))('busca por %s / %s sin filtrar estados', async (campo,modo) => {
    const token=clave();const m=await crearMedicamento({[campo]:token,estado:'INACTIVO',situacion_comercial:'BAJA'});
    const q=modo==='exacto'?token:modo==='prefijo'?token.slice(0,-3):token.slice(2,-2);
    const respuesta=await buscar({campo,modo,q:`  ${q.toLowerCase()}  `});comprobarProyeccion(respuesta);
    expect(ids(respuesta)).toEqual([m.id]);expect(respuesta.body[0]).toMatchObject({estado:'INACTIVO',situacion_comercial:'BAJA'});
  });
  it.each(['codigo_nacional','descripcion'])('ordena por %s y desempata por ID', async (campo) => {
    const token=clave();const otro=campo==='codigo_nacional'?'descripcion':'codigo_nacional';
    const z=await crearMedicamento({[campo]:`${token} Z`,[otro]:`${token} A`});
    const a=await crearMedicamento({[campo]:`${token} A`,[otro]:`${token} Z`});
    const respuesta=await buscar({campo,modo:'prefijo',q:token});expect(ids(respuesta)).toEqual([a.id,z.id]);
    if(campo==='descripcion') {
      const igual=await crearMedicamento({descripcion:`${token} A`});
      expect(ids(await buscar({campo,modo:'prefijo',q:token}))).toEqual([a.id,igual.id,z.id]);
    }
  });
  it('devuelve [] sin resultados', async () => {
    const respuesta=await buscar({campo:'codigo_nacional',modo:'exacto',q:clave()});expect(respuesta.status).toBe(200);expect(respuesta.body).toEqual([]);
  });
  it.each([{}, {campo:'soe',modo:'exacto',q:'x'}, {campo:'descripcion',modo:'otro',q:'x'}, {campo:'descripcion'}, {modo:'exacto',q:'x'}, {campo:'descripcion',modo:'exacto'}, {campo:'descripcion',modo:'exacto',q:''}, {campo:'descripcion',modo:'exacto',q:'   '}, {campo:'descripcion',modo:'exacto',q:'x'.repeat(201)}, {campo:'descripcion',modo:'exacto',q:'a\0'}, {campo:['descripcion','codigo_nacional'],modo:'exacto',q:'x'}, {campo:'descripcion',modo:['exacto','contiene'],q:'x'}, {campo:'descripcion',modo:'exacto',q:['x','y']}, {campo:'descripcion',modo:'exacto',q:'x',limite:'1'}].slice(1))('rechaza parámetros inválidos %j', async (parametros) => {
    const respuesta=await buscar(parametros);expect(respuesta.status).toBe(400);expect(respuesta.body).toEqual({error:'Parámetros de búsqueda no válidos.'});
  });
  it.each(['codigo_nacional','descripcion'])('trata caracteres especiales como literales en %s para todos los modos', async (campo) => {
    const token=clave();const especial=await crearMedicamento({[campo]:`${token}%_!\\`});
    await crearMedicamento({[campo]:`${token}XYZ!\\`});
    for (const modo of ['exacto','prefijo','contiene']) {
      const respuesta=await buscar({campo,modo,q:especial[campo]});expect(ids(respuesta)).toEqual([especial.id]);
    }
  });
  it('acepta 200 caracteres, conserva espacios interiores y distingue acentos', async () => {
    const texto='á'.repeat(200);const a=await crearMedicamento({descripcion:texto});
    expect(ids(await buscar({campo:'descripcion',modo:'exacto',q:` ${texto} `}))).toEqual([a.id]);
    const nombre=`${clave()}  árbol`;const b=await crearMedicamento({descripcion:nombre});
    expect(ids(await buscar({campo:'descripcion',modo:'exacto',q:nombre.toUpperCase()}))).toEqual([b.id]);
    expect((await buscar({campo:'descripcion',modo:'exacto',q:nombre.replace('  ',' ')})).body).toEqual([]);
    expect((await buscar({campo:'descripcion',modo:'exacto',q:nombre.replace('á','a')})).body).toEqual([]);
  });
  it('busca texto similar a SQL literalmente sin alterar datos', async () => {
    const texto=`${clave()} ' OR 1=1 --`;const m=await crearMedicamento({descripcion:texto});
    expect(ids(await buscar({campo:'descripcion',modo:'exacto',q:texto}))).toEqual([m.id]);
    expect((await request(app).get(`/medicamentos/${m.id}`)).body).toEqual(m);
  });
  it('GET sin parámetros conserva todos los campos y orden de ID; detalle y PUT siguen funcionando', async () => {
    const a=await crearMedicamento({descripcion:'Z'});const b=await crearMedicamento({descripcion:'A'});
    const lista=await request(app).get('/medicamentos');expect(lista.status).toBe(200);
    const propios=lista.body.filter((m)=>[a.id,b.id].includes(m.id));expect(propios).toEqual([a,b]);
    const {id,...cuerpo}=a;const actualizado=await request(app).put(`/medicamentos/${id}`).send({...cuerpo,precio:'19.99'});
    expect(actualizado.status).toBe(200);expect((await request(app).get(`/medicamentos/${id}`)).body.precio).toBe('19.99');
  });
});
