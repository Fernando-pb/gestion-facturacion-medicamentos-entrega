import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app, { createApp } from '../src/app.js';
import pool from '../src/db.js';

let ids, verificada = false;
const tablas = ['cobro', 'reapertura_facturacion', 'factura', 'participacion_facturacion', 'pago_farmacias', 'facturacion',
  'operacion_lectura', 'precinto', 'incidencia', 'entrega_farmacia_periodo', 'farmacia', 'ayuntamiento', 'periodo', 'medicamento', 'configuracion_facturacion', 'configuracion_documentos'];
const insertar = async (tabla, sql, valores = []) => {
  const row = (await pool.query(sql, valores)).rows[0]; ids[tabla].push(row.id); return row;
};
const preparar = async (precios = ['100.00'], mesExistente = null) => {
  const town = await insertar('ayuntamiento', `INSERT INTO ayuntamiento
    (cif, denominacion, direccion, codigo_postal, localidad, provincia, estado, tipo_lista_medicamentos)
    VALUES ($1, 'Municipio ficticio emisión', 'Calle', '28001', 'Villa', 'Madrid', 'ACTIVO', 'GENERAL') RETURNING *`, [randomUUID()]);
  const farm = await insertar('farmacia', `INSERT INTO farmacia
    (soe, denominacion, cif_nif, direccion, codigo_postal, localidad, provincia, ayuntamiento_id)
    VALUES ($1, 'Titular B emisión', 'TEST-CIF-0001', 'Calle', '28001', 'Villa', 'Madrid', $2) RETURNING *`, [randomUUID(), town.id]);
  let mes = mesExistente;
  while (!mes) {
    // Periodos ficticios anteriores a las vigencias de otros tests; sin tocar
    // configuraciones ajenas. Cada configuración propia limita ambas fechas.
    mes = (await pool.query(`INSERT INTO periodo (anio, mes) VALUES ($1, $2)
      ON CONFLICT (mes, anio) DO NOTHING RETURNING *`, [randomInt(100, 1900), randomInt(1, 13)])).rows[0];
    if (mes) ids.periodo.push(mes.id);
  }
  const entrega = await insertar('entrega_farmacia_periodo', `INSERT INTO entrega_farmacia_periodo
    (farmacia_id, periodo_id, denominacion_farmacia, cif_nif_farmacia, precintos_informados, importe_informado)
    VALUES ($1, $2, 'Titular A entrega', 'TEST-CIF-0014', 999, 99999.99) RETURNING *`, [farm.id, mes.id]);
  let med;
  while (!med) {
    med = (await pool.query(`INSERT INTO medicamento (codigo_nacional, descripcion, precio, estado, situacion_comercial, tipo_facturacion)
      VALUES ($1, 'Medicamento ficticio emisión', 999.99, 'ACTIVO', 'ALTA', 'TD')
      ON CONFLICT (codigo_nacional) DO NOTHING RETURNING *`, [String(randomInt(0, 1000000)).padStart(6, '0')])).rows[0];
    if (med) ids.medicamento.push(med.id);
  }
  for (const [index, precio] of precios.entries()) await insertar('precinto', `INSERT INTO precinto
    (entrega_id, numero_paquete, posicion_paquete, medicamento_id, codigo_barras_original, codigo_nacional, precio_aplicado, precio_referencia)
    VALUES ($1, 1, $2, $3, $4, $4, $5, $5) RETURNING *`, [entrega.id, index + 1, med.id, med.codigo_nacional, precio]);
  const r = await request(app).post('/facturaciones/calculo').send({ ayuntamiento_id: town.id, periodo_id: mes.id });
  expect(r.status).toBe(200);
  return { town, farm, mes, entrega, med, f: r.body.facturacion_id, p: r.body.participaciones[0]?.id };
};
const configuracion = (c, comision = '2.7', iva = '21') => insertar('configuracion_facturacion', `INSERT INTO configuracion_facturacion
  (fecha_inicio, fecha_fin, porcentaje_comision, porcentaje_iva)
  SELECT fecha_factura, fecha_factura, $2, $3 FROM facturacion WHERE id = $1 RETURNING *`, [c.f, comision, iva]);
const numeros = () => ({ numero_factura_precintos: 'P-' + randomUUID(), numero_factura_comision: 'C-' + randomUUID() });
const emitir = (c, datos = numeros()) => request(app).post(`/facturaciones/${c.f}/emision`).send(datos);
const facturas = (c) => pool.query('SELECT * FROM factura WHERE facturacion_id = $1 ORDER BY tipo', [c.f]).then((r) => r.rows);
const estado = (c) => pool.query('SELECT estado FROM facturacion WHERE id=$1', [c.f]).then((r) => r.rows[0].estado);
const previa = (c) => request(app).get(`/facturaciones/${c.f}/previsualizacion`);
const snapshot = async (c) => (await pool.query(`SELECT
  (SELECT row_to_json(f) FROM facturacion f WHERE id=$1) AS cabecera,
  (SELECT json_agg(p ORDER BY p.id) FROM participacion_facturacion p WHERE facturacion_id=$1) AS participaciones,
  (SELECT json_agg(f ORDER BY f.id) FROM factura f WHERE facturacion_id=$1) AS facturas`, [c.f])).rows[0];
const reabrir = (c) => request(app).post(`/facturaciones/${c.f}/reapertura`).send({ motivo: 'Corrección ficticia emisión' });
const modificarB = (c, denominacion = 'B confirmado') => request(app).put(`/facturaciones/${c.f}/participaciones/${c.p}/b`)
  .send({ soe_b: c.farm.soe, denominacion_b: denominacion, cif_b: 'TEST-CIF-0008' });
const esperar = (pid) => vi.waitFor(async () => {
  expect((await pool.query('SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))', [pid])).rowCount).toBeGreaterThan(0);
}, { timeout: 4000, interval: 20 });

beforeAll(async () => {
  if (process.env.DB_NAME !== 'gestion_facturacion_medicamentos_test'
    || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST ?? 'localhost')) throw new Error('Base dedicada local obligatoria.');
  expect((await pool.query('SELECT current_database() AS db')).rows[0].db).toBe('gestion_facturacion_medicamentos_test'); verificada = true;
});
beforeEach(() => { ids = Object.fromEntries(tablas.map((t) => [t, []])); });
afterEach(async () => {
  if (!verificada) return;
  const procesos = (await pool.query('SELECT id FROM facturacion WHERE ayuntamiento_id = ANY($1::int[])', [ids.ayuntamiento])).rows.map((r) => r.id);
  for (const tabla of ['cobro']) await pool.query(`DELETE FROM ${tabla} WHERE factura_id IN (SELECT id FROM factura WHERE facturacion_id = ANY($1::int[]))`, [procesos]);
  for (const tabla of ['reapertura_facturacion', 'factura', 'participacion_facturacion']) await pool.query(`DELETE FROM ${tabla} WHERE facturacion_id = ANY($1::int[])`, [procesos]);
  ids.facturacion = procesos;
  for (const tabla of ['operacion_lectura', 'precinto', 'incidencia']) await pool.query(`DELETE FROM ${tabla} WHERE entrega_id = ANY($1::int[])`, [ids.entrega_farmacia_periodo]);
  for (const tabla of tablas) await pool.query(`DELETE FROM ${tabla} WHERE id = ANY($1::int[])`, [ids[tabla]]);
});
afterAll(() => pool.end());

describe('emisión conjunta y reglas de cálculo', () => {
  it.each([[false,false],[true,false],[false,true],[true,true]])
    ('lista cobros por factura (Precintos=%s, Comisión=%s) sin confundir importe cero ni alterar datos',async(precintos,comision)=>{
      const ns={numero_factura_precintos:'00001-'+randomUUID(),numero_factura_comision:'GEN-00002-'+randomUUID()};
      const c=await preparar(['0.00']);await configuracion(c);expect((await emitir(c,ns)).status).toBe(201);
      const emitidas=await facturas(c);
      for(const [tipo,cobrada] of [['PRECINTOS',precintos],['COMISION',comision]]) {
        if(!cobrada) continue;
        const factura=emitidas.find(f=>f.tipo===tipo);
        const r=await request(app).post(`/facturaciones/${c.f}/facturas/${factura.id}/cobro`)
          .send({fecha_cobro:'2026-10-17',importe_cobrado:factura.importe_total});
        expect(r.status).toBe(201);
      }
      const antes=await snapshot(c);
      const cobrosAntes=(await pool.query('SELECT * FROM cobro WHERE factura_id=ANY($1::int[]) ORDER BY id',[emitidas.map(f=>f.id)])).rows;
      const r=await request(app).get('/facturaciones/emitidas');expect(r.status).toBe(200);
      expect(r.body.find(f=>f.facturacion_id===c.f)).toMatchObject({factura_precintos_cobrada:precintos,factura_comision_cobrada:comision,tiene_cobros:precintos||comision});
      expect(r.body.find(f=>f.facturacion_id===c.f)).toMatchObject(ns);
      expect(r.body.find(f=>f.facturacion_id===c.f).fecha_prevista_liquidacion).toBeNull();
      expect(await snapshot(c)).toEqual(antes);
      expect((await pool.query('SELECT * FROM cobro WHERE factura_id=ANY($1::int[]) ORDER BY id',[emitidas.map(f=>f.id)])).rows).toEqual(cobrosAntes);
    });
  it('lista solo emitidas por periodo descendente y Ayuntamiento alfabético, con importes guardados y sin mutaciones', async () => {
    const z = await preparar(['25.00']); await configuracion(z);
    const a = await preparar(['10.00'], z.mes);
    const otro = await preparar(['30.00']); await configuracion(otro);
    const revision = await preparar(['5.00']);
    for (const [c,nombre] of [[z,'Zeta listado'],[a,'alfa listado'],[otro,'Otro listado']]) {
      await pool.query('UPDATE ayuntamiento SET denominacion=$1 WHERE id=$2',[nombre,c.town.id]);
      expect((await emitir(c)).status).toBe(201);
    }
    const antes = await snapshot(z);
    const r = await request(app).get('/facturaciones/emitidas'); expect(r.status).toBe(200);
    const propios = r.body.filter(f=>[z.f,a.f,otro.f,revision.f].includes(f.facturacion_id));
    const esperados = [z,a,otro].sort((x,y)=>y.mes.anio-x.mes.anio || y.mes.mes-x.mes.mes || (x.f===a.f?-1:y.f===a.f?1:0));
    expect(propios.map(f=>f.facturacion_id)).toEqual(esperados.map(c=>c.f));
    expect(propios.find(f=>f.facturacion_id===z.f).importe_precintos).toBe('25.00');
    expect(propios.find(f=>f.facturacion_id===z.f).tiene_cobros).toBe(false);
    expect((await request(app).get(`/facturaciones/${z.f}/documentos`)).status).toBe(200);
    expect(await snapshot(z)).toEqual(antes);
    expect((await request(app).get('/facturaciones/emitidas?extra=1')).status).toBe(400);
    expect((await reabrir(z)).status).toBe(200);
    expect((await request(app).get('/facturaciones/emitidas')).body.some(f=>f.facturacion_id===z.f)).toBe(false);
  });
  it('incluye la fecha prevista registrada en PAGO_FARMACIAS en el listado', async () => {
    const c = await preparar(); await configuracion(c); expect((await emitir(c)).status).toBe(201);
    await insertar('pago_farmacias', `INSERT INTO pago_farmacias (facturacion_id, fecha_pago) VALUES ($1, $2) RETURNING *`, [c.f, '2026-10-20']);
    const fila = (await request(app).get('/facturaciones/emitidas')).body.find((f) => f.facturacion_id === c.f);
    expect(fila.fecha_prevista_liquidacion).toBe('2026-10-20');
  });
  it('una emisión se localiza por Ayuntamiento/periodo y abre documentos sin alterar facturas ni cobros', async () => {
    const c = await preparar(); await configuracion(c); expect((await emitir(c)).status).toBe(201);
    const antes = await snapshot(c);
    const cobrosAntes = (await pool.query('SELECT * FROM cobro WHERE factura_id IN (SELECT id FROM factura WHERE facturacion_id=$1)', [c.f])).rows;
    const localizada = await request(app).get('/facturaciones/busqueda').query({ ayuntamiento_id: c.town.id, periodo_id: c.mes.id });
    expect(localizada.status).toBe(200); expect(localizada.body).toEqual({ facturacion_id: c.f, estado: 'EMITIDA' });
    const documentos = await request(app).get(`/facturaciones/${localizada.body.facturacion_id}/documentos`);
    expect(documentos.status).toBe(200); expect(documentos.body.facturas).toHaveLength(2);
    expect(await snapshot(c)).toEqual(antes);
    expect((await pool.query('SELECT * FROM cobro WHERE factura_id IN (SELECT id FROM factura WHERE facturacion_id=$1)', [c.f])).rows).toEqual(cobrosAntes);
    expect((await request(app).get('/facturaciones/busqueda').query({ ayuntamiento_id: c.town.id, periodo_id: 2147483647 })).status).toBe(404);
    for (const q of [{}, { ayuntamiento_id: 'abc', periodo_id: c.mes.id }, { ayuntamiento_id: c.town.id, periodo_id: c.mes.id, extra: 'x' }]) {
      expect((await request(app).get('/facturaciones/busqueda').query(q)).status).toBe(400);
    }
  });

  it('emite ambos documentos, suma participaciones y códigos repetidos, ignora incidencias/declarados y congela B confirmado', async () => {
    const c = await preparar(['25.00', '25.00']), config = await configuracion(c), ns = numeros();
    const otra = await insertar('farmacia', `INSERT INTO farmacia (soe,denominacion,cif_nif,direccion,codigo_postal,localidad,provincia,ayuntamiento_id)
      VALUES ($1,'Otra ficticia emisión','TEST-CIF-0010','Calle','28001','Villa','Madrid',$2) RETURNING *`, [randomUUID(),c.town.id]);
    const otraEntrega = await insertar('entrega_farmacia_periodo', `INSERT INTO entrega_farmacia_periodo (farmacia_id,periodo_id,denominacion_farmacia,cif_nif_farmacia)
      VALUES ($1,$2,'Otra ficticia emisión','TEST-CIF-0010') RETURNING *`, [otra.id,c.mes.id]);
    await insertar('precinto', `INSERT INTO precinto (entrega_id,numero_paquete,posicion_paquete,medicamento_id,codigo_barras_original,codigo_nacional,precio_aplicado, precio_referencia)
      VALUES ($1,1,1,$2,$3,$3,50.00, 50.00) RETURNING *`, [otraEntrega.id,c.med.id,c.med.codigo_nacional]);
    await request(app).post('/facturaciones/calculo').send({ ayuntamiento_id:c.town.id,periodo_id:c.mes.id });
    await insertar('incidencia', `INSERT INTO incidencia (entrega_id, codigo_barras_original, motivo)
      VALUES ($1, '000000', 'MEDICAMENTO_DESCONOCIDO') RETURNING *`, [c.entrega.id]);
    expect((await modificarB(c)).status).toBe(200);
    await pool.query("UPDATE farmacia SET denominacion='Catálogo posterior', cif_nif='TEST-CIF-0010' WHERE id=$1", [c.farm.id]);
    const r = await emitir(c, ns); expect(r.status).toBe(201); expect(r.body.estado).toBe('EMITIDA');
    expect(r.body.facturas).toHaveLength(2);
    const consulta = await request(app).get(`/facturaciones/${c.f}`);
    expect(consulta.status).toBe(200); expect(consulta.body.facturas).toEqual(r.body.facturas);
    expect(r.body.facturas.find((f) => f.tipo === 'PRECINTOS')).toMatchObject({ numero_factura: ns.numero_factura_precintos, numero_precintos: 3, importe_total: '100.00' });
    expect(r.body.facturas.find((f) => f.tipo === 'COMISION')).toMatchObject({ numero_factura: ns.numero_factura_comision,
      base_calculo: '100.00', porcentaje_comision: '2.7000', importe_comision: '2.70', porcentaje_iva: '21.0000', importe_iva: '0.57', importe_total: '3.27', configuracion_facturacion_id: config.id });
    expect((await modificarB(c)).status).toBe(409);
    const b = (await pool.query('SELECT denominacion_b,cif_b FROM participacion_facturacion WHERE id=$1', [c.p])).rows[0];
    expect(b).toEqual({ denominacion_b: 'B confirmado', cif_b: 'TEST-CIF-0008' });
    expect((await emitir(c, ns)).status).toBe(409); expect(await facturas(c)).toHaveLength(2);
  });

  it.each([
    ['0.18', '0.00', '0.00', '0.00'], ['5.00', '0.14', '0.03', '0.17'], ['5.02', '0.14', '0.03', '0.17'],
    ['0.89', '0.02', '0.00', '0.02'], ['9.26', '0.25', '0.05', '0.30'], ['18.52', '0.50', '0.11', '0.61'], ['0.00', '0.00', '0.00', '0.00'],
  ])('HALF_UP y secuencia comisión/IVA para base %s', async (base, comision, iva, total) => {
    const c = await preparar([base]); await configuracion(c); const r = await emitir(c); expect(r.status).toBe(201);
    expect(r.body.facturas.find((f) => f.tipo === 'COMISION')).toMatchObject({ importe_comision: comision, importe_iva: iva, importe_total: total });
    expect(r.body.facturas.find((f) => f.tipo === 'PRECINTOS').numero_precintos).toBe(1);
  });

  it('aplica configuración por fecha inclusiva; sin configuración o con solapamiento rechaza sin insertar', async () => {
    const c = await preparar(); expect((await emitir(c)).status).toBe(409); expect(await facturas(c)).toEqual([]);
    const cfg = await configuracion(c); await configuracion(c); expect((await emitir(c)).status).toBe(409);
    await pool.query('DELETE FROM configuracion_facturacion WHERE id=$1', [ids.configuracion_facturacion[1]]);
    expect((await emitir(c)).status).toBe(201);
    expect((await facturas(c)).find((f) => f.tipo === 'COMISION').configuracion_facturacion_id).toBe(cfg.id);
  });

  it('no emite con cero aptos y conserva revisión y B; exige recalcular una revisión desactualizada', async () => {
    const c = await preparar(); await configuracion(c);
    await pool.query('UPDATE precinto SET precio_aplicado=200.00 WHERE entrega_id=$1', [c.entrega.id]);
    expect((await emitir(c)).status).toBe(409); expect(await estado(c)).toBe('REVISION'); expect(await facturas(c)).toEqual([]);
    await pool.query('DELETE FROM precinto WHERE entrega_id=$1', [c.entrega.id]);
    const r = await emitir(c); expect(r.status).toBe(200); expect(r.body.advertencia).toMatch(/No hay precintos aptos/);
    expect(await facturas(c)).toEqual([]); expect(await estado(c)).toBe('REVISION');
  });

  it('desbordamiento del total municipal revierte la emisión sin cambiar B/estado', async () => {
    const c = await preparar(['9999999999.99']); await configuracion(c);
    const f = await insertar('farmacia', `INSERT INTO farmacia (soe,denominacion,cif_nif,direccion,codigo_postal,localidad,provincia,ayuntamiento_id)
      VALUES ($1,'Otra ficticia','TEST-CIF-0010','Calle','28001','Villa','Madrid',$2) RETURNING *`, [randomUUID(), c.town.id]);
    const e = await insertar('entrega_farmacia_periodo', `INSERT INTO entrega_farmacia_periodo (farmacia_id,periodo_id,denominacion_farmacia,cif_nif_farmacia)
      VALUES ($1,$2,'Otra ficticia','TEST-CIF-0010') RETURNING *`, [f.id,c.mes.id]);
    await insertar('precinto', `INSERT INTO precinto (entrega_id,numero_paquete,posicion_paquete,medicamento_id,codigo_barras_original,codigo_nacional,precio_aplicado, precio_referencia)
      VALUES ($1,1,1,$2,$3,$3,0.01, 0.01) RETURNING *`, [e.id,c.med.id,c.med.codigo_nacional]);
    await request(app).post('/facturaciones/calculo').send({ ayuntamiento_id:c.town.id,periodo_id:c.mes.id });
    expect((await emitir(c)).status).toBe(409); expect(await facturas(c)).toEqual([]); expect(await estado(c)).toBe('REVISION');
  });
});

describe('numeración oficial y atomicidad', () => {
  it('permite el mismo texto en las dos series y conserva ceros iniciales', async () => {
    const c = await preparar(); await configuracion(c); const n = '0000-' + randomUUID();
    const r = await emitir(c, { numero_factura_precintos: '  ' + n + '  ', numero_factura_comision: n });
    expect(r.status).toBe(201); expect(r.body.facturas.map((f) => f.numero_factura)).toEqual([n, n]);
  });

  it.each(['numero_factura_precintos', 'numero_factura_comision'])('rechaza repetir %s en otro periodo y revierte el par', async (campo) => {
    const a = await preparar(); await configuracion(a); const ns = numeros(); expect((await emitir(a, ns)).status).toBe(201);
    const b = await preparar(); await configuracion(b); expect(b.mes.id).not.toBe(a.mes.id);
    const r = await emitir(b, { ...numeros(), [campo]: ns[campo] }); expect(r.status).toBe(409);
    expect(await facturas(b)).toEqual([]); expect(await estado(b)).toBe('REVISION');
  });

  it('un conflicto tardío en COMISION revierte PRECINTOS ya insertada en esa transacción', async () => {
    const c = await preparar(), cfg = await configuracion(c), ancla = await preparar(), ns = numeros();
    const actor = await pool.connect(); let pendiente;
    try {
      await actor.query('BEGIN'); const pid = (await actor.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await actor.query(`INSERT INTO factura (facturacion_id,tipo,numero_factura,base_calculo,porcentaje_comision,
        importe_comision,porcentaje_iva,importe_iva,importe_total,configuracion_facturacion_id)
        VALUES ($1,'COMISION',$2,100.00,2.7,2.70,21,0.57,3.27,$3)`, [ancla.f, ns.numero_factura_comision, cfg.id]);
      pendiente = emitir(c, ns).then((r) => r); await esperar(pid);
      const bloqueada = (await pool.query('SELECT query FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))', [pid])).rows;
      expect(bloqueada.some((fila) => /INSERT INTO factura/.test(fila.query) && fila.query.includes("'COMISION'"))).toBe(true);
      await actor.query('COMMIT'); const r = await pendiente; expect(r.status).toBe(409);
    } finally { await actor.query('ROLLBACK'); actor.release(); if (pendiente) await pendiente; }
    expect(await facturas(c)).toEqual([]); expect(await estado(c)).toBe('REVISION');
    expect((await modificarB(c)).status).toBe(200);
  });

  it('dos emisiones simultáneas del mismo proceso guardan exactamente un par', async () => {
    const c = await preparar(); await configuracion(c); const ns = numeros();
    const rs = await Promise.all([emitir(c,ns), emitir(c,ns)]);
    expect(rs.map((r) => r.status).sort()).toEqual([201,409]); expect(await facturas(c)).toHaveLength(2);
  });
});

describe('reemisión correctiva', () => {
  it('recalcula tras corregir lecturas, actualiza el mismo par y conserva B, números e históricos frente a cambios actuales', async () => {
    const c = await preparar(['5.00']), cfg = await configuracion(c), ns = numeros(); await modificarB(c);
    const inicial = await emitir(c,ns); expect(inicial.status).toBe(201); expect((await reabrir(c)).status).toBe(200);
    await pool.query("UPDATE farmacia SET denominacion='Titular posterior' WHERE id=$1", [c.farm.id]);
    await pool.query('UPDATE configuracion_facturacion SET porcentaje_iva=10 WHERE id=$1', [cfg.id]);
    await configuracion(c); // Solapamiento actual no sustituye el snapshot ya emitido.
    await pool.query('UPDATE medicamento SET precio=100.00 WHERE id=$1', [c.med.id]);
    expect((await request(app).post(`/entregas/${c.entrega.id}/lecturas`).send({ codigo_barras_original:c.med.codigo_nacional, clave_operacion:randomUUID() })).status).toBe(201);
    const r = await emitir(c,{}); expect(r.status).toBe(200); expect(r.body.estado).toBe('EMITIDA');
    expect(r.body.facturas.map((f) => f.id)).toEqual(inicial.body.facturas.map((f) => f.id));
    expect(r.body.facturas.find((f) => f.tipo==='PRECINTOS')).toMatchObject({ numero_factura:ns.numero_factura_precintos, numero_precintos:2, importe_total:'105.00' });
    expect(r.body.facturas.find((f) => f.tipo==='COMISION')).toMatchObject({ numero_factura:ns.numero_factura_comision,
      base_calculo:'105.00', importe_comision:'2.84', importe_iva:'0.60', importe_total:'3.44', porcentaje_iva:'21.0000', configuracion_facturacion_id:cfg.id });
    expect((await pool.query('SELECT denominacion_b FROM participacion_facturacion WHERE id=$1',[c.p])).rows[0].denominacion_b).toBe('B confirmado');
    expect((await modificarB(c)).status).toBe(409);
  });

  it('rechaza números sustitutos y conserva originales cuando no quedan aptos', async () => {
    const c = await preparar(); await configuracion(c); const ns = numeros(); await emitir(c,ns); await reabrir(c);
    const antes = await facturas(c); expect((await emitir(c,numeros())).status).toBe(409); expect(await facturas(c)).toEqual(antes);
    await pool.query('DELETE FROM precinto WHERE entrega_id=$1',[c.entrega.id]);
    const r = await emitir(c,{}); expect(r.body.advertencia).toBeTruthy(); expect(await estado(c)).toBe('REABIERTA');
    expect(await facturas(c)).toEqual(antes);
  });

  it.each(['PRECINTOS','COMISION'])('cobro de %s impide cualquier emisión/actualización', async (tipo) => {
    const c = await preparar(); await configuracion(c); await emitir(c); const antes = await facturas(c);
    const f = antes.find((f) => f.tipo===tipo);
    await insertar('cobro', `INSERT INTO cobro (factura_id,fecha_cobro,importe_cobrado) VALUES ($1,CURRENT_DATE,$2) RETURNING *`,[f.id,f.importe_total]);
    await pool.query("UPDATE facturacion SET estado='REABIERTA' WHERE id=$1",[c.f]);
    expect((await emitir(c,{})).status).toBe(409); expect(await facturas(c)).toEqual(antes);
  });
});

describe('validación de emisión', () => {
  it.each([{}, {numero_factura_precintos:'Solo uno'}, {numero_factura_precintos:12,numero_factura_comision:'C'},
    {numero_factura_precintos:' ',numero_factura_comision:'C'}, {numero_factura_precintos:'P',numero_factura_comision:'C',importe_total:'1'},
    {numero_factura_precintos:'P'.repeat(201),numero_factura_comision:'C'}])('rechaza números/datos %j en primera emisión sin escribir', async (body) => {
    const c = await preparar(); expect((await emitir(c,body)).status).toBe(400); expect(await facturas(c)).toEqual([]); expect(await estado(c)).toBe('REVISION');
  });
  it('404 para destino inexistente y 400 para ID/query inválidos', async () => {
    expect((await emitir({f:2147483647})).status).toBe(404);
    expect((await emitir({f:'1e2'})).status).toBe(400);
    expect((await request(app).post('/facturaciones/1/emision?extra=1').send(numeros())).status).toBe(400);
  });
});

describe('previsualización de solo lectura', () => {
  it.each(['100.00', '0.18', '5.00', '5.02', '0.89', '9.26', '18.52', '0.00'])
  ('coincide con la emisión y no modifica revisión, B ni facturas para %s', async (base) => {
    const c = await preparar([base]); await configuracion(c); await modificarB(c);
    const antes = await snapshot(c), r = await previa(c);
    expect(r.status).toBe(200); expect(await snapshot(c)).toEqual(antes);
    expect(await facturas(c)).toEqual([]); expect(await estado(c)).toBe('REVISION');
    expect((await previa(c)).body).toEqual(r.body);
    const emision = await emitir(c); expect(emision.status).toBe(201);
    const p = emision.body.facturas.find((f) => f.tipo === 'PRECINTOS');
    const com = emision.body.facturas.find((f) => f.tipo === 'COMISION');
    expect(r.body).toMatchObject({ importe_precintos: p.importe_total, cantidad_precintos: p.numero_precintos,
      base_calculo: com.base_calculo, porcentaje_comision: com.porcentaje_comision,
      importe_comision: com.importe_comision, porcentaje_iva: com.porcentaje_iva,
      importe_iva: com.importe_iva, importe_total_comision: com.importe_total });
    const centimos = (s) => BigInt(s.replace('.', ''));
    expect(centimos(r.body.importe_total_conjunto)).toBe(centimos(p.importe_total) + centimos(com.importe_total));
    expect(r.body).not.toHaveProperty('numero_factura');
  });

  it('suma cada precinto repetido por precio aplicado y usa porcentajes configurados por periodo', async () => {
    const c = await preparar(['25.00', '25.00']); await configuracion(c, '3.5', '10');
    const r = await previa(c); expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ cantidad_precintos: 2, importe_precintos: '50.00', base_calculo: '50.00',
      porcentaje_comision: '3.5000', porcentaje_iva: '10.0000', importe_comision: '1.75',
      importe_iva: '0.18', importe_total_comision: '1.93', importe_total_conjunto: '51.93' });
    const e = await emitir(c); expect(e.status).toBe(201);
    expect(e.body.facturas.find((f) => f.tipo === 'COMISION').importe_total).toBe(r.body.importe_total_comision);
  });

  it('rechaza configuración ausente/solapada y revisión desactualizada sin escribir', async () => {
    const c = await preparar(); const antes = await snapshot(c);
    expect((await previa(c)).status).toBe(409); await configuracion(c); await configuracion(c);
    expect((await previa(c)).status).toBe(409);
    await pool.query('DELETE FROM configuracion_facturacion WHERE id=$1', [ids.configuracion_facturacion[1]]);
    await pool.query('UPDATE precinto SET precio_aplicado=5 WHERE entrega_id=$1', [c.entrega.id]);
    expect((await previa(c)).status).toBe(409); expect(await snapshot(c)).toEqual(antes);
  });

  it('sin aptos advierte antes de exigir configuración y no altera una revisión existente', async () => {
    const c = await preparar(); await pool.query('DELETE FROM precinto WHERE entrega_id=$1', [c.entrega.id]);
    const antes = await snapshot(c), r = await previa(c);
    expect(r.status).toBe(200); expect(r.body.advertencia).toBe('No hay precintos aptos para este Ayuntamiento y periodo.');
    expect(r.body.cantidad_precintos).toBe(0); expect(r.body).not.toHaveProperty('importe_total_comision');
    expect(await snapshot(c)).toEqual(antes);
  });

  it('reabierta usa importes actuales sin persistir y porcentajes históricos; coincide al reemitir', async () => {
    const c = await preparar(['5.00']), cfg = await configuracion(c); await emitir(c); await reabrir(c);
    await pool.query('UPDATE precinto SET precio_aplicado=18.52 WHERE entrega_id=$1', [c.entrega.id]);
    await pool.query('UPDATE configuracion_facturacion SET porcentaje_iva=10 WHERE id=$1', [cfg.id]);
    await configuracion(c); // El solapamiento actual no sustituye los porcentajes originales.
    const antes = await snapshot(c), r = await previa(c);
    expect(r.status).toBe(200); expect(await snapshot(c)).toEqual(antes);
    expect(r.body).toMatchObject({ estado: 'REABIERTA', importe_precintos: '18.52', porcentaje_iva: '21.0000',
      importe_comision: '0.50', importe_iva: '0.11', importe_total_comision: '0.61', importe_total_conjunto: '19.13' });
    const e = await emitir(c, {}); expect(e.status).toBe(200);
    expect(e.body.facturas.find((f) => f.tipo === 'COMISION').importe_total).toBe(r.body.importe_total_comision);
    expect(e.body.facturas.find((f) => f.tipo === 'PRECINTOS').importe_total).toBe(r.body.importe_precintos);
  });

  it('rechaza emitida o con cobros, preservando los documentos', async () => {
    const c = await preparar(); await configuracion(c); await emitir(c);
    const antes = await snapshot(c); expect((await previa(c)).status).toBe(409);
    expect(await snapshot(c)).toEqual(antes);
    const f = (await facturas(c))[0];
    await insertar('cobro', 'INSERT INTO cobro (factura_id,fecha_cobro,importe_cobrado) VALUES ($1,CURRENT_DATE,$2) RETURNING *', [f.id, f.importe_total]);
    await pool.query("UPDATE facturacion SET estado='REABIERTA' WHERE id=$1", [c.f]);
    const cobrada = await snapshot(c); expect((await previa(c)).status).toBe(409);
    expect(await snapshot(c)).toEqual(cobrada);
  });

  it('valida ID, query y cuerpo sin escrituras', async () => {
    expect((await previa({ f: 2147483647 })).status).toBe(404);
    for (const id of ['0', '1e2', '2147483648']) expect((await previa({ f: id })).status).toBe(400);
    expect((await request(app).get('/facturaciones/1/previsualizacion?extra=1')).status).toBe(400);
    expect((await request(app).get('/facturaciones/1/previsualizacion').send({})).status).toBe(400);
  });

  it('mantiene exacto el total conjunto aunque supere la capacidad de una factura', async () => {
    const c = await preparar(['9999999999.99']); await configuracion(c);
    const antes = await snapshot(c), r = await previa(c);
    expect(r.status).toBe(200); expect(await snapshot(c)).toEqual(antes);
    expect(r.body).toMatchObject({ importe_precintos: '9999999999.99', importe_comision: '270000000.00',
      importe_iva: '56700000.00', importe_total_comision: '326700000.00', importe_total_conjunto: '10326699999.99' });
    expect((await emitir(c)).status).toBe(201);
  });

  it('rechaza una comisión que no se podría guardar, sin emitir ni cambiar el estado', async () => {
    const c = await preparar(['9999999999.99']); await configuracion(c, '100', '21');
    const antes = await snapshot(c), r = await previa(c);
    expect(r.status).toBe(409); expect(r.body.error).toMatch(/capacidad monetaria/);
    expect(await snapshot(c)).toEqual(antes); expect((await emitir(c)).status).toBe(409);
  });
});

describe('documentos históricos de facturación', () => {
  const emisor = { denominacion:'Colegio ficticio', cif:'TEST-CIF-0016', direccion:'Calle ficticia', contacto:null };
  it('captura presidente, conserva B/importes y consulta configuración actual sin alterar facturas ni cobros', async () => {
    const c=await preparar(['25.00','25.00']); await configuracion(c);
    const config=await insertar('configuracion_documentos', `INSERT INTO configuracion_documentos(nombre_presidente,datos_emisor)
      VALUES ('Presidente original',$1) RETURNING *`,[emisor]);
    await modificarB(c,'B histórico'); const emitida=await emitir(c); expect(emitida.status).toBe(201);
    await pool.query("UPDATE configuracion_documentos SET nombre_presidente='Presidente posterior', datos_emisor=$2 WHERE id=$1",[config.id,{...emisor,denominacion:'Emisor actual'}]);
    await pool.query("UPDATE farmacia SET denominacion='Maestro posterior' WHERE id=$1",[c.farm.id]);
    await pool.query('UPDATE medicamento SET precio=1 WHERE id=$1',[c.med.id]);
    const factura=emitida.body.facturas.find(f=>f.tipo==='COMISION');
    expect((await request(app).post(`/facturaciones/${c.f}/facturas/${factura.id}/cobro`).send({fecha_cobro:'2026-10-11',importe_cobrado:factura.importe_total})).status).toBe(201);
    const antes=await snapshot(c), cobrosAntes=(await pool.query('SELECT * FROM cobro WHERE factura_id=$1',[factura.id])).rows;
    const r=await request(app).get(`/facturaciones/${c.f}/documentos`);
    expect(r.status).toBe(200); expect(r.body.cabecera.nombre_presidente_historico).toBe('Presidente original');
    expect(r.body.configuracion.datos_emisor.denominacion).toBe('Emisor actual');
    expect(r.body.participaciones[0]).toMatchObject({denominacion_b:'B histórico',cantidad_precintos:2,importe_precintos:'50.00'});
    expect(r.body.facturas).toEqual(emitida.body.facturas); expect(await snapshot(c)).toEqual(antes);
    expect((await pool.query('SELECT * FROM cobro WHERE factura_id=$1',[factura.id])).rows).toEqual(cobrosAntes);
  });
  it('impide revisión/reapertura y conserva presidente original al reemitir', async()=>{
    const c=await preparar(); await configuracion(c);
    const config=await insertar('configuracion_documentos',`INSERT INTO configuracion_documentos(nombre_presidente,datos_emisor) VALUES ('Original',$1) RETURNING *`,[emisor]);
    expect((await request(app).get(`/facturaciones/${c.f}/documentos`)).status).toBe(409);
    await emitir(c); await reabrir(c);
    expect((await request(app).get(`/facturaciones/${c.f}/documentos`)).status).toBe(409);
    await pool.query("UPDATE configuracion_documentos SET nombre_presidente='Nuevo' WHERE id=$1",[config.id]);
    expect((await emitir(c,{})).status).toBe(200);
    expect((await request(app).get(`/facturaciones/${c.f}/documentos`)).body.cabecera.nombre_presidente_historico).toBe('Original');
  });
  it('advierte si falta presidente y rechaza datos históricos que no cuadran',async()=>{
    const c=await preparar(); await configuracion(c); await emitir(c);
    const r=await request(app).get(`/facturaciones/${c.f}/documentos`); expect(r.status).toBe(200);
    expect(r.body.advertencias).toContain('No consta el presidente histórico.');
    await pool.query('UPDATE participacion_facturacion SET importe_precintos=1 WHERE id=$1',[c.p]);
    expect((await request(app).get(`/facturaciones/${c.f}/documentos`)).status).toBe(409);
  });
  it('con sesión valida configuración, conserva una fila y no expone rutas arbitrarias',async()=>{
    const origin='http://localhost:3000';
    const credentials={username:randomUUID(),password:randomUUID()};
    const sesion=request.agent(createApp({authConfig:{...credentials,expectedOrigin:origin,secureCookie:false}}));
    expect((await sesion.post('/auth/login').set('Origin',origin).send(credentials)).status).toBe(200);
    const guardar=(datos)=>sesion.put('/configuracion-documentos').set('Origin',origin).send(datos);
    const c=await preparar(); await configuracion(c); await emitir(c);
    const config=await insertar('configuracion_documentos',`INSERT INTO configuracion_documentos(nombre_presidente) VALUES (NULL) RETURNING *`);
    const d={nombre_presidente:'Presidente',datos_emisor:emisor,logo_personalizado:null};
    expect((await guardar(d)).status).toBe(200);
    const consulta=await sesion.get('/configuracion-documentos');
    expect(consulta.status).toBe(200); expect(consulta.body).toEqual(d);
    const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
    expect((await guardar({...d,logo_personalizado:png})).status).toBe(200);
    expect((await request(app).get(`/facturaciones/${c.f}/documentos`)).body.configuracion.logo_personalizado).toBe(png);
    expect((await pool.query('SELECT id FROM configuracion_documentos')).rows).toEqual([{id:config.id}]);
    for(const logo of ['../../secret','data:image/svg+xml;base64,PHN2Zy8+','data:image/png;base64,YWJj']) {
      expect((await guardar({...d,logo_personalizado:logo})).status).toBe(400);
    }
    expect((await guardar({...d,inventado:true})).status).toBe(400);
    expect((await request(app).get('/facturaciones/invalido/documentos')).status).toBe(400);
    expect((await request(app).get('/facturaciones/2147483647/documentos')).status).toBe(404);
    await pool.query("UPDATE configuracion_documentos SET logo_personalizado='C:/secret' WHERE id=$1",[config.id]);
    expect((await sesion.get('/configuracion-documentos')).body.logo_personalizado).toBeNull();
    expect((await request(app).get(`/facturaciones/${c.f}/documentos`)).body.configuracion.logo_personalizado).toBeNull();
  });

  it('con sesión guarda PNG de 1 MiB y conserva lo guardado tras rechazar un cuerpo excesivo con 413 JSON',async()=>{
    const origin='http://localhost:3000';
    const credentials={username:randomUUID(),password:randomUUID()};
    const sesion=request.agent(createApp({authConfig:{...credentials,expectedOrigin:origin,secureCookie:false}}));
    expect((await sesion.post('/auth/login').set('Origin',origin).send(credentials)).status).toBe(200);
    const guardar=(datos)=>sesion.put('/configuracion-documentos').set('Origin',origin).send(datos);
    const config=await insertar('configuracion_documentos',`INSERT INTO configuracion_documentos(nombre_presidente) VALUES (NULL) RETURNING *`);
    const chunk=(tipo,contenido)=>{const cabecera=Buffer.alloc(8);cabecera.writeUInt32BE(contenido.length);cabecera.write(tipo,4);return Buffer.concat([cabecera,contenido,Buffer.alloc(4)]);};
    const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(1,0);ihdr.writeUInt32BE(1,4);
    const pngDeUnMiB=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',Buffer.alloc(1048519)),chunk('IEND',Buffer.alloc(0))]);
    expect(pngDeUnMiB.length).toBe(1048576);
    const logoMaximo=`data:image/png;base64,${pngDeUnMiB.toString('base64')}`;
    const d={nombre_presidente:'Presidente ficticio',datos_emisor:emisor,logo_personalizado:logoMaximo};
    expect((await guardar(d)).status).toBe(200);
    const consulta=await sesion.get('/configuracion-documentos');
    expect(consulta.status).toBe(200); expect(consulta.body).toEqual(d);
    const demasiadoGrande=await guardar({...d,logo_personalizado:'data:image/png;base64,'+'A'.repeat(1600000)});
    expect(demasiadoGrande.status).toBe(413);
    expect(demasiadoGrande.headers['content-type']).toMatch(/application\/json/);
    expect(demasiadoGrande.body).toEqual({error:'El logo supera el tamaño permitido.'});
    expect((await sesion.get('/configuracion-documentos')).body).toEqual(d);
    expect((await pool.query('SELECT id FROM configuracion_documentos')).rows).toEqual([{id:config.id}]);
    // Las transferencias Base64 de ida y vuelta son mayores de 1 MiB; margen local específico.
  },15000);
});

describe('administración de configuración de comisión e IVA',()=>{
  const datosPara=async(c)=>{
    const fila=(await pool.query("SELECT to_char(fecha_factura,'YYYY-MM-DD') AS fecha FROM facturacion WHERE id=$1",[c.f])).rows[0];
    return {porcentaje_comision:'2.7000',porcentaje_iva:'21',fecha_inicio:fila.fecha,fecha_fin:fila.fecha};
  };
  const alta=async(d)=>{const r=await request(app).post('/configuracion-facturacion').send(d);if(r.status===201)ids.configuracion_facturacion.push(r.body.id);return r;};
  it('resuelve ausencia de configuración, lista y conserva tasas e importes históricos al emitir',async()=>{
    const c=await preparar(['100.00']);expect((await previa(c)).body.error).toContain('Gestionar comisión e IVA');
    expect((await emitir(c)).status).toBe(409);expect(await facturas(c)).toHaveLength(0);
    const d=await datosPara(c),r=await alta(d);expect(r.status).toBe(201);expect(r.body.utilizada).toBe(false);
    expect((await request(app).get('/configuracion-facturacion')).body).toContainEqual(r.body);
    const e=await emitir(c);expect(e.status).toBe(201);
    const comision=e.body.facturas.find(f=>f.tipo==='COMISION');expect(comision).toMatchObject({porcentaje_comision:'2.7000',porcentaje_iva:'21.0000',importe_total:'3.27',configuracion_facturacion_id:r.body.id});
    const antes=await snapshot(c);
    expect((await request(app).put(`/configuracion-facturacion/${r.body.id}`).send({...d,porcentaje_iva:'16'})).status).toBe(409);
    expect((await request(app).put(`/configuracion-facturacion/${r.body.id}`).send({...d,porcentaje_comision:'2.7'})).status).toBe(200);
    expect(await snapshot(c)).toEqual(antes);
  });
  it('corrige vigencia no usada y rechaza duplicados, extremos inclusivos y rangos abiertos solapados',async()=>{
    const c=await preparar(),d=await datosPara(c),r=await alta(d);expect(r.status).toBe(201);
    expect((await alta(d)).status).toBe(409);
    expect((await alta({...d,fecha_fin:null})).status).toBe(409);
    const corregida=await request(app).put(`/configuracion-facturacion/${r.body.id}`).send({...d,porcentaje_comision:'0.1234',porcentaje_iva:'100'});
    expect(corregida.status).toBe(200);expect(corregida.body.porcentaje_comision).toBe('0.1234');
    expect((await pool.query('SELECT count(*)::int AS n FROM configuracion_facturacion WHERE id=$1',[r.body.id])).rows[0].n).toBe(1);
  });
  it('permite cerrar una configuración utilizada sin excluir fechas facturadas y conserva reemisión',async()=>{
    const c=await preparar(),d=await datosPara(c);
    const anterior=(await pool.query("SELECT to_char(fecha_factura-1,'YYYY-MM-DD') AS fecha FROM facturacion WHERE id=$1",[c.f])).rows[0].fecha;
    const r=await alta({...d,fecha_inicio:anterior});expect(r.status).toBe(201);await emitir(c);
    expect((await request(app).put(`/configuracion-facturacion/${r.body.id}`).send({...d,fecha_inicio:anterior,fecha_fin:anterior})).status).toBe(409);
    expect((await request(app).put(`/configuracion-facturacion/${r.body.id}`).send({...d,fecha_inicio:anterior})).status).toBe(200);
    await reabrir(c);expect((await emitir(c,{})).status).toBe(200);
    expect((await facturas(c)).find(f=>f.tipo==='COMISION').porcentaje_comision).toBe('2.7000');
  });
  it('serializa dos altas concurrentes y permite solo una vigencia',async()=>{
    const c=await preparar(),d=await datosPara(c),rs=await Promise.all([alta(d),alta(d)]);
    expect(rs.map(r=>r.status).sort()).toEqual([201,409]);
    expect((await previa(c)).status).toBe(200);
  });
  it('la escritura de configuración espera al bloqueo SHARE usado por emisión',async()=>{
    const c=await preparar(),d=await datosPara(c),client=await pool.connect();let solicitud;
    try{
      await client.query('BEGIN');await client.query('LOCK TABLE configuracion_facturacion IN SHARE MODE');
      const pid=(await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      solicitud=alta(d);await esperar(pid);await client.query('COMMIT');expect((await solicitud).status).toBe(201);
    }finally{await client.query('ROLLBACK');client.release();if(solicitud)await solicitud;}
  });
  it.each([{porcentaje_comision:'100.0001'},{porcentaje_iva:'-1'},{porcentaje_iva:'2.12345'},{porcentaje_comision:2.7},{fecha_inicio:'2026-02-30'},{fecha_inicio:'0000-01-01'},{fecha_fin:'2025-12-31'},{otro:1}])('rechaza configuración inválida %j',async cambio=>{
    expect((await request(app).post('/configuracion-facturacion').send({porcentaje_comision:'2.7',porcentaje_iva:'21',fecha_inicio:'2026-01-01',fecha_fin:null,...cambio})).status).toBe(400);
  });
  it('valida consultas e IDs sin introducir permisos de borrado',async()=>{
    expect((await request(app).get('/configuracion-facturacion?otro=1')).status).toBe(400);
    const d={porcentaje_comision:'2.7',porcentaje_iva:'21',fecha_inicio:'2026-01-01',fecha_fin:null};
    expect((await request(app).put('/configuracion-facturacion/no').send(d)).status).toBe(400);
    expect((await request(app).put('/configuracion-facturacion/2147483647').send(d)).status).toBe(404);
  });
});
