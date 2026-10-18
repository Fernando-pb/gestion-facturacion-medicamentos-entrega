import { cuentaBancariaTest as cuenta } from './fixtures/datos-test.js';
import { randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import pool from '../src/db.js';

let ids, verificada = false;
const tablas = ['cobro', 'reapertura_facturacion', 'factura', 'participacion_facturacion', 'facturacion',
  'operacion_lectura', 'precinto', 'incidencia', 'entrega_farmacia_periodo', 'farmacia', 'ayuntamiento', 'periodo', 'medicamento', 'configuracion_facturacion'];
const insertar = async (tabla, sql, valores = []) => {
  const row = (await pool.query(sql, valores)).rows[0]; ids[tabla].push(row.id); return row;
};
const preparar = async (precios = ['100.00'], mesExistente = null) => {
  const town = await insertar('ayuntamiento', `INSERT INTO ayuntamiento
    (cif, denominacion, direccion, codigo_postal, localidad, provincia, estado, tipo_lista_medicamentos)
    VALUES ($1, 'Municipio ficticio emisión', 'Calle', '28001', 'Villa', 'Madrid', 'ACTIVO', 'GENERAL') RETURNING *`, [randomUUID()]);
  const farm = await insertar('farmacia', `INSERT INTO farmacia
    (soe, denominacion, cif_nif, direccion, codigo_postal, localidad, provincia, ayuntamiento_id)
    VALUES ($1, 'Titular TEST B emisión', 'TEST-CIF-0001', 'Calle', '28001', 'Villa', 'Madrid', $2) RETURNING *`, [randomUUID(), town.id]);
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
    VALUES ($1, $2, 'Titular TEST A entrega', 'TEST-CIF-0014', 999, 99999.99) RETURNING *`, [farm.id, mes.id]);
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
const reabrir = (c) => request(app).post(`/facturaciones/${c.f}/reapertura`).send({ motivo: 'Corrección ficticia emisión' });
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
  await pool.query('DELETE FROM detalle_pago_farmacia WHERE pago_farmacias_id IN (SELECT id FROM pago_farmacias WHERE facturacion_id = ANY($1::int[]))', [procesos]);
  await pool.query('DELETE FROM pago_farmacias WHERE facturacion_id = ANY($1::int[])', [procesos]);
  for (const tabla of ['cobro']) await pool.query(`DELETE FROM ${tabla} WHERE factura_id IN (SELECT id FROM factura WHERE facturacion_id = ANY($1::int[]))`, [procesos]);
  for (const tabla of ['reapertura_facturacion', 'factura', 'participacion_facturacion']) await pool.query(`DELETE FROM ${tabla} WHERE facturacion_id = ANY($1::int[])`, [procesos]);
  ids.facturacion = procesos;
  for (const tabla of ['operacion_lectura', 'precinto', 'incidencia']) await pool.query(`DELETE FROM ${tabla} WHERE entrega_id = ANY($1::int[])`, [ids.entrega_farmacia_periodo]);
  for (const tabla of tablas) await pool.query(`DELETE FROM ${tabla} WHERE id = ANY($1::int[])`, [ids[tabla]]);
});
afterAll(() => pool.end());



const asignarCuenta = (farm) => {
  const d = cuenta();
  return pool.query(`UPDATE farmacia SET pais_control_iban=$2,entidad_bancaria=$3,sucursal_bancaria=$4,
    digito_control_bancario=$5,cuenta_bancaria=$6 WHERE id=$1`, [farm.id,...Object.values(d)]);
};
const contexto = async (fecha = '2026-10-09', varios = false, precios = ['100.00']) => {
  const c = await preparar(precios); await asignarCuenta(c.farm);
  if (varios) {
    const otra = await insertar('farmacia', `INSERT INTO farmacia (soe,denominacion,cif_nif,direccion,codigo_postal,localidad,provincia,ayuntamiento_id)
      VALUES ($1,'C segunda ficticia','TEST-CIF-0010','Calle','28001','Villa','Madrid',$2) RETURNING *`, [randomUUID(),c.town.id]);
    await asignarCuenta(otra);
    const entrega = await insertar('entrega_farmacia_periodo', `INSERT INTO entrega_farmacia_periodo
      (farmacia_id,periodo_id,denominacion_farmacia,cif_nif_farmacia) VALUES ($1,$2,'Otra','TEST-CIF-0010') RETURNING *`, [otra.id,c.mes.id]);
    await insertar('precinto', `INSERT INTO precinto (entrega_id,numero_paquete,posicion_paquete,medicamento_id,codigo_barras_original,codigo_nacional,precio_aplicado, precio_referencia)
      VALUES ($1,1,1,$2,$3,$3,50.01, 50.01) RETURNING *`, [entrega.id,c.med.id,c.med.codigo_nacional]);
    await request(app).post('/facturaciones/calculo').send({ ayuntamiento_id:c.town.id,periodo_id:c.mes.id });
  }
  await configuracion(c); const r = await emitir(c); expect(r.status).toBe(201); c.facturas = r.body.facturas;
  if (fecha) {
    const f = c.facturas.find((f) => f.tipo === 'PRECINTOS');
    expect((await request(app).post(`/facturaciones/${c.f}/facturas/${f.id}/cobro`)
      .send({ fecha_cobro:fecha, importe_cobrado:f.importe_total })).status).toBe(201);
  }
  return c;
};
const proponer = (c) => request(app).post(`/facturaciones/${c.f}/liquidacion/preparacion`).send({});
const propuesta = async (c) => { const r = await proponer(c); expect(r.status).toBe(200); return { fecha_pago:r.body.fecha_pago, detalles:r.body.detalles }; };
const confirmar = (c, datos) => request(app).post(`/facturaciones/${c.f}/liquidacion/confirmacion`).send(datos);
const consultar = (c) => request(app).get(`/facturaciones/${c.f}/liquidacion`);
const excel = (c) => request(app).get(`/facturaciones/${c.f}/liquidacion/contabilidad`);
const pagos = (c) => pool.query('SELECT * FROM pago_farmacias WHERE facturacion_id=$1',[c.f]).then((r) => r.rows);

describe('preparación y confirmación de liquidación a farmacias', () => {
  it('exige PRECINTOS completo, COMISION por sí sola no basta ni permite confirmar', async () => {
    const c = await contexto(null);
    expect((await proponer(c)).status).toBe(409);
    const f = c.facturas.find((f) => f.tipo === 'COMISION');
    expect((await request(app).post(`/facturaciones/${c.f}/facturas/${f.id}/cobro`)
      .send({ fecha_cobro:'2026-10-09',importe_cobrado:f.importe_total })).status).toBe(201);
    expect((await proponer(c)).status).toBe(409);
    const datos = { fecha_pago:'2026-10-12', detalles:[{ participacion_facturacion_id:c.p, soe:c.farm.soe,
      denominacion_farmacia:'C ficticio',cif_nif:'TEST-CIF-0008',importe:'100.00',...cuenta() }] };
    expect((await confirmar(c,datos)).status).toBe(409); expect(await pagos(c)).toEqual([]);
    const precintos = c.facturas.find((f) => f.tipo === 'PRECINTOS');
    // Fixture SQL de cobro parcial para demostrar que existencia no basta.
    await insertar('cobro', `INSERT INTO cobro (factura_id,fecha_cobro,importe_cobrado)
      VALUES ($1,'2026-10-09',99.99) RETURNING *`,[precintos.id]);
    expect((await proponer(c)).status).toBe(409); expect((await confirmar(c,datos)).status).toBe(409);
  });

  it('la propuesta es editable sin persistir y confirma pagos completos de todas las participaciones sin exigir COMISION', async () => {
    const c = await contexto('2026-10-09', true), p = await propuesta(c);
    expect(p.fecha_pago).toBe('2026-10-12'); expect(p.detalles).toHaveLength(2);
    expect(p.detalles.map((d) => d.importe).sort()).toEqual(['100.00','50.01']); expect(await pagos(c)).toEqual([]);
    expect((await proponer(c)).status).toBe(200); expect((await excel(c)).status).toBe(404);
    p.detalles[0] = { ...p.detalles[0], denominacion_farmacia:'Titular TEST C corregido',cif_nif:'TEST-CIF-0011',...cuenta(202) };
    p.fecha_pago = '2026-10-17';
    const r = await confirmar(c,p); expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ facturacion_id:c.f, fecha_pago:'2026-10-17',importe_total:'150.01',cuadra:true });
    expect(r.body.detalles).toHaveLength(2);
    for (const d of p.detalles) expect(r.body.detalles.find((r) => r.participacion_facturacion_id===d.participacion_facturacion_id)).toMatchObject(d);
    const original = (await consultar(c)).body;
    await pool.query(`UPDATE farmacia SET denominacion='Cambio posterior',cif_nif='TEST-CIF-0012',cuenta_bancaria=NULL
      WHERE id=ANY($1::int[])`,[ids.farmacia]);
    expect((await consultar(c)).body).toEqual(original);
    expect((await confirmar(c,p)).status).toBe(409); expect((await proponer(c)).status).toBe(409);
    expect(await pagos(c)).toHaveLength(1);
    expect((await pool.query('SELECT denominacion_b FROM participacion_facturacion WHERE id=$1',[c.p])).rows[0].denominacion_b).toBe(c.farm.denominacion);
    expect((await reabrir(c)).status).toBe(409);
  });

  it.each([
    ['2026-10-05','2026-10-06'],['2026-10-06','2026-10-07'],['2026-10-07','2026-10-08'],
    ['2026-10-08','2026-10-09'],['2026-10-09','2026-10-12'],['2026-10-10','2026-10-12'],['2026-10-11','2026-10-12'],
    ['2026-12-31','2027-01-01'],['2024-02-28','2024-02-29'],['2024-02-29','2024-03-01'],
  ])('desde cobro %s sugiere %s sin festivos ni zona horaria', async (fecha,sugerida) => {
    const c=await contexto(fecha),p=await propuesta(c); expect(p.fecha_pago).toBe(sugerida);
    const r=await confirmar(c,p); expect(r.status).toBe(201); expect(r.body.fecha_pago).toBe(sugerida);
  });

  it('permite corregir cuentas incompletas antes de confirmar, conservando propuesta revisada frente a cambios del catálogo', async () => {
    const c=await contexto(); await pool.query('UPDATE farmacia SET cuenta_bancaria=NULL WHERE id=$1',[c.farm.id]);
    const p=await propuesta(c); expect(p.detalles[0].cuenta_bancaria).toBeNull();
    expect((await confirmar(c,p)).status).toBe(400); expect(await pagos(c)).toEqual([]);
    p.detalles[0]={...p.detalles[0],...cuenta(),denominacion_farmacia:'Titular TEST revisado antes de confirmar'};
    await pool.query("UPDATE farmacia SET denominacion='Catálogo distinto' WHERE id=$1",[c.farm.id]);
    expect((await confirmar(c,p)).body.detalles[0].denominacion_farmacia).toBe('Titular TEST revisado antes de confirmar');
  });

  it.each(['99.99','100.01'])('rechaza importe %s y no crea pagos', async (importe) => {
    const c=await contexto(),p=await propuesta(c);p.detalles[0].importe=importe;
    expect((await confirmar(c,p)).status).toBe(409);expect(await pagos(c)).toEqual([]);
  });

  it('rechaza participación omitida, duplicada, ajena y SOE sustituido', async () => {
    const c=await contexto('2026-10-09',true),p=await propuesta(c), otra=await contexto(),ajena=await propuesta(otra);
    for (const detalles of [[p.detalles[0]],[p.detalles[0],p.detalles[0]],[p.detalles[0],ajena.detalles[0]],
      [{...p.detalles[0],soe:'Otro SOE'},p.detalles[1]]]) {
      expect((await confirmar(c,{...p,detalles})).status).toBe(409);expect(await pagos(c)).toEqual([]);
    }
  });

  it.each([
    { pais_control_iban:'ES00' },{ pais_control_iban:'FR76' },{ entidad_bancaria:'xxx' },
    { sucursal_bancaria:'12345' },{ digito_control_bancario:'99' },{ cuenta_bancaria:'123' },
    { denominacion_farmacia:'\u0000' },{ denominacion_farmacia:' ' },{ importe:100 },{ importe:'100.001' },{ extra:true },
  ])('rechaza detalle inválido %j sin escribir', async (datos) => {
    const c=await contexto(),p=await propuesta(c);p.detalles[0]={...p.detalles[0],...datos};
    expect((await confirmar(c,p)).status).toBe(400);expect(await pagos(c)).toEqual([]);
  });

  it('valida fechas, IDs, query y cuerpos, consulta inexistentes y rechaza totales desajustados', async () => {
    const c=await contexto(),p=await propuesta(c);
    expect((await confirmar(c,{...p,fecha_pago:'2026-02-30'})).status).toBe(400);
    expect((await confirmar(c,{...p,fecha_pago:'0000-01-01'})).status).toBe(400);
    expect((await confirmar(c,{...p,detalles:[]})).status).toBe(400);
    expect((await confirmar({f:2147483647},p)).status).toBe(404);
    expect((await proponer({f:0})).status).toBe(400);
    expect((await proponer({f:2147483647})).status).toBe(404);
    expect((await consultar(c)).status).toBe(404);
    expect((await request(app).post(`/facturaciones/${c.f}/liquidacion/preparacion`).send({extra:true})).status).toBe(400);
    expect((await request(app).get(`/facturaciones/${c.f}/liquidacion/contabilidad?extra=1`)).status).toBe(400);
    await pool.query('UPDATE participacion_facturacion SET importe_precintos=99.99 WHERE id=$1',[c.p]);
    expect((await proponer(c)).status).toBe(409);expect((await confirmar(c,p)).status).toBe(409);expect(await pagos(c)).toEqual([]);
  });

  it('dos confirmaciones simultáneas crean un solo pago completo', async () => {
    const c=await contexto('2026-10-09',true),p=await propuesta(c);
    const rs=await Promise.all([confirmar(c,p),confirmar(c,{...p,fecha_pago:'2026-10-13'})]);
    expect(rs.map((r)=>r.status).sort()).toEqual([201,409]);expect(await pagos(c)).toHaveLength(1);
    expect((await consultar(c)).body.detalles).toHaveLength(2);
  });

  it('conserva una participación de importe cero y liquida exactamente su importe', async () => {
    const c=await contexto('2026-10-09',false,['0.00']),p=await propuesta(c);
    expect(p.detalles[0].importe).toBe('0.00');
    const r=await confirmar(c,p);expect(r.status).toBe(201);
    expect(r.body.importe_total).toBe('0.00');expect(r.body.detalles).toHaveLength(1);
  });

  it('un conflicto tardío en el segundo detalle revierte la cabecera y el primer detalle', async () => {
    const c=await contexto('2026-10-09',true),p=await propuesta(c),ancla=await contexto(null);
    const actor=await pool.connect();let pendiente;
    try {
      await actor.query('BEGIN');
      const pid=(await actor.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const pg=(await actor.query(`INSERT INTO pago_farmacias (facturacion_id,fecha_pago)
        VALUES ($1,'2026-10-12') RETURNING id`,[ancla.f])).rows[0];
      // Actor SQL externo: ocupa la participación, todavía invisible al precheck.
      const d=p.detalles[1];
      await actor.query(`INSERT INTO detalle_pago_farmacia (pago_farmacias_id,participacion_facturacion_id,
        soe,denominacion_farmacia,cif_nif,importe,pais_control_iban,entidad_bancaria,sucursal_bancaria,
        digito_control_bancario,cuenta_bancaria) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [pg.id,d.participacion_facturacion_id,d.soe,d.denominacion_farmacia,d.cif_nif,d.importe,
        d.pais_control_iban,d.entidad_bancaria,d.sucursal_bancaria,d.digito_control_bancario,d.cuenta_bancaria]);
      pendiente=confirmar(c,p).then((r)=>r);await esperar(pid);
      const bloqueada=(await pool.query('SELECT query FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))',[pid])).rows;
      expect(bloqueada.some((r)=>r.query.includes('INSERT INTO detalle_pago_farmacia'))).toBe(true);
      await actor.query('COMMIT');expect((await pendiente).status).toBe(409);
    } finally { await actor.query('ROLLBACK');actor.release();if(pendiente) await pendiente; }
    expect(await pagos(c)).toEqual([]);
    expect((await pool.query('SELECT id FROM detalle_pago_farmacia WHERE participacion_facturacion_id=$1',[p.detalles[0].participacion_facturacion_id])).rowCount).toBe(0);
    expect((await consultar(c)).status).toBe(404);
  });

  it('exporta Excel XML de snapshots con total, ceros, SEPA, concepto uniforme, fecha elegida y texto escapado sin fórmulas', async () => {
    const c=await contexto(),p=await propuesta(c);
    p.detalles[0].denominacion_farmacia='=1+1 & <C> "ficticio"';p.fecha_pago='2026-10-19';
    expect((await confirmar(c,p)).status).toBe(201);
    await pool.query("UPDATE farmacia SET denominacion='Después',cuenta_bancaria=NULL WHERE id=$1",[c.farm.id]);
    const r=await excel(c);expect(r.status).toBe(200);expect(r.headers['content-type']).toMatch(/application\/xml/);
    expect(r.headers['content-disposition']).toContain(`liquidacion-${c.f}.xml`);
    const xml=r.text;
    for (const encabezado of ['SOE','TITULAR','CUENTA DESTINO','IMPORTE','TIPO TRANSFERENCIA','CONCEPTO','FECHA PAGO','TOTAL']) expect(xml).toContain(encabezado);
    expect(xml).toContain('=1+1 &amp; &lt;C&gt; &quot;ficticio&quot;');expect(xml).not.toContain('ss:Formula');
    expect(xml).toContain('SEPA');expect(xml).toContain('19-10-2026');expect(xml).not.toContain('2026-10-19');
    expect(xml).toContain(Object.values(cuenta()).join(''));
    expect(xml).toContain(`Precintos - Municipio ficticio emisión - ${String(c.mes.mes).padStart(2,'0')}/${String(c.mes.anio).padStart(4,'0')}`);
    expect(xml.match(/ss:Type="Number">100.00/g)).toHaveLength(2);
    expect((await excel(c)).text).toBe(xml);
  });
});
