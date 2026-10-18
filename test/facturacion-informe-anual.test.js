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

const periodoInforme = async (anio, mes) => {
  const creado=(await pool.query(`INSERT INTO periodo (anio,mes) VALUES ($1,$2)
    ON CONFLICT (mes,anio) DO NOTHING RETURNING *`,[anio,mes])).rows[0];
  if(creado){ids.periodo.push(creado.id);return creado;}
  return (await pool.query('SELECT * FROM periodo WHERE anio=$1 AND mes=$2',[anio,mes])).rows[0];
};
const base = async (anio, mes, precios=['0.10','0.10']) => preparar(precios,await periodoInforme(anio,mes));
const emitirPeriodo = async (c) => {
  // Configuración global por fecha: dos municipios del mismo mes la comparten.
  const existentes=await pool.query(`SELECT cfg.id FROM configuracion_facturacion cfg JOIN facturacion f ON f.id=$1
    WHERE cfg.fecha_inicio<=f.fecha_factura AND (cfg.fecha_fin IS NULL OR f.fecha_factura<=cfg.fecha_fin)`,[c.f]);
  if(!existentes.rowCount)await configuracion(c);
  const r=await emitir(c);expect(r.status).toBe(201);return r.body.facturas;
};
const otraEntrega = async (c, farm, anio, mes, precios) => {
  const pe=await periodoInforme(anio,mes);
  const e=await insertar('entrega_farmacia_periodo',`INSERT INTO entrega_farmacia_periodo
    (farmacia_id,periodo_id,denominacion_farmacia,cif_nif_farmacia,precintos_informados,importe_informado)
    VALUES ($1,$2,'A ficticio','TEST-CIF-0008',999,99999.99) RETURNING *`,[farm.id,pe.id]);
  for(const [i,precio] of precios.entries()) await insertar('precinto',`INSERT INTO precinto
    (entrega_id,numero_paquete,posicion_paquete,medicamento_id,codigo_barras_original,codigo_nacional,precio_aplicado, precio_referencia)
    VALUES ($1,1,$2,$3,$4,$4,$5, $5) RETURNING *`,[e.id,i+1,c.med.id,c.med.codigo_nacional,precio]);
  const r=await request(app).post('/facturaciones/calculo').send({ayuntamiento_id:c.town.id,periodo_id:pe.id});
  expect(r.status).toBe(200);return {...c,f:r.body.facturacion_id,entrega:e,mes:pe};
};
const informe = (anio, town, mensual=false) => request(app).get('/facturaciones/informe-anual')
  .query({anio, ...(town?{ayuntamiento_id:town.id}:{}),detalle_mensual:String(mensual)});
const sumar = (importes) => {
  const total=importes.reduce((sum,v)=>sum+BigInt(v.replace('.','')),0n);
  return `${total/100n}.${String(total%100n).padStart(2,'0')}`;
};
const comprobarCuadre = (r) => {
  expect(sumar(r.trimestres.map((t)=>t.importe_total))).toBe(r.total_anual);
  for(const t of r.trimestres) if(t.meses) expect(sumar(t.meses.map((m)=>m.importe_total))).toBe(t.importe_total);
};

describe('informe anual operativo por periodo facturado',()=>{
  it('suma dos farmacias en una misma facturación sin multiplicar importes entre participaciones',async()=>{
    const anio=randomInt(20,80),c=await base(anio,1,['0.10','0.10']);
    const segunda=await insertar('farmacia',`INSERT INTO farmacia (soe,denominacion,cif_nif,direccion,codigo_postal,localidad,provincia,ayuntamiento_id)
      VALUES ($1,'B segunda ficticia','TEST-CIF-0010','Calle','28001','Villa','Madrid',$2) RETURNING *`,[randomUUID(),c.town.id]);
    await otraEntrega(c,segunda,anio,1,['0.10','0.10']);await emitirPeriodo(c);
    const r=await informe(anio,c.town,true),m=r.body.ayuntamientos[0];
    expect(r.status).toBe(200);expect(r.body.total_anual).toBe('0.40');expect(m.farmacias).toHaveLength(2);
    expect(m.farmacias.map((f)=>f.total_anual)).toEqual(['0.20','0.20']);
    expect(sumar(m.farmacias.map((f)=>f.total_anual))).toBe(m.total_anual);
    for(const f of m.farmacias)comprobarCuadre(f);
  });
  it('separa diciembre/enero de años consecutivos y evita duplicar códigos y precios repetidos',async()=>{
    const anio=randomInt(20,80),c=await base(anio,12,['12.34','12.34']);await emitirPeriodo(c);
    const enero=await otraEntrega(c,c.farm,anio+1,1,['0.01','0.02']);await emitirPeriodo(enero);
    const r=await informe(anio,c.town,true);expect(r.status).toBe(200);
    expect(r.body.total_anual).toBe('24.68');expect(r.body.trimestres.map((t)=>t.importe_total)).toEqual(['0.00','0.00','0.00','24.68']);
    expect(r.body.trimestres[3].meses).toEqual([{mes:10,importe_total:'0.00'},{mes:11,importe_total:'0.00'},{mes:12,importe_total:'24.68'}]);
    const siguiente=await informe(anio+1,c.town,true);expect(siguiente.body.total_anual).toBe('0.03');
    expect(siguiente.body.trimestres[0].meses[0]).toEqual({mes:1,importe_total:'0.03'});
    comprobarCuadre(r.body);comprobarCuadre(siguiente.body);
  });

  it('agrupa doce meses/cuatro trimestres por farmacia y Ayuntamiento y hace cuadrar todos los niveles',async()=>{
    const anio=randomInt(20,80),c=await base(anio,1,['0.01']);await emitirPeriodo(c);
    for(let mes=2;mes<=12;mes++)await emitirPeriodo(await otraEntrega(c,c.farm,anio,mes,[`0.${String(mes).padStart(2,'0')}`]));
    const otra=await insertar('farmacia',`INSERT INTO farmacia (soe,denominacion,cif_nif,direccion,codigo_postal,localidad,provincia,ayuntamiento_id)
      VALUES ($1,'B segunda ficticia','TEST-CIF-0010','Calle','28001','Villa','Madrid',$2) RETURNING *`,[randomUUID(),c.town.id]);
    // Reabrir abril para añadir actividad solo de la farmacia ya participante no sería válido:
    // segundo establecimiento se incluye en un periodo aún en revisión del otro municipio.
    const b=await base(anio,4,['1.00']);
    await otraEntrega(b,b.farm,anio,5,['2.00']);
    const abrilFacturas=await emitirPeriodo(b);
    const mayo=(await pool.query('SELECT id FROM facturacion WHERE ayuntamiento_id=$1 AND periodo_id=(SELECT id FROM periodo WHERE anio=$2 AND mes=5)',[b.town.id,anio])).rows[0];
    await emitirPeriodo({...b,f:mayo.id});
    // Añadir segunda farmacia al primer municipio en enero del año siguiente no afecta a este año.
    await otraEntrega(c,otra,anio+1,1,['999.00']);
    const r=await informe(anio,null,true);expect(r.status).toBe(200);
    const a=r.body.ayuntamientos.find((a)=>a.ayuntamiento_id===c.town.id);
    expect(a.total_anual).toBe('0.78');expect(a.trimestres.map((t)=>t.importe_total)).toEqual(['0.06','0.15','0.24','0.33']);
    expect(a.farmacias).toHaveLength(1);comprobarCuadre(a);comprobarCuadre(a.farmacias[0]);
    const otro=r.body.ayuntamientos.find((a)=>a.ayuntamiento_id===b.town.id);expect(otro.total_anual).toBe('3.00');comprobarCuadre(otro);
    expect(abrilFacturas.find((f)=>f.tipo==='COMISION').importe_total).not.toBe('0.00');
    expect(sumar(r.body.ayuntamientos.map((a)=>a.total_anual))).toBe(r.body.total_anual);comprobarCuadre(r.body);
    const resumido=await informe(anio,c.town);expect(resumido.body.total_anual).toBe(a.total_anual);
    expect(resumido.body.trimestres.every((t)=>!('meses' in t))).toBe(true);
    expect(resumido.body.ayuntamientos[0].farmacias[0].trimestres.every((t)=>!('meses' in t))).toBe(true);
  });

  it('ignora fechas de cobro/pago de otros trimestres/años y excluye COMISION, incidencias y declarados',async()=>{
    const anio=randomInt(20,80),c=await base(anio,3,['100.00']);await asignarCuenta(c.farm);const fs=await emitirPeriodo(c);
    await insertar('incidencia',`INSERT INTO incidencia (entrega_id,codigo_barras_original,motivo)
      VALUES ($1,'000000','MEDICAMENTO_DESCONOCIDO') RETURNING *`,[c.entrega.id]);
    const cobroFecha=`${String(anio+1).padStart(4,'0')}-07-10`;
    for(const f of fs)expect((await request(app).post(`/facturaciones/${c.f}/facturas/${f.id}/cobro`)
      .send({fecha_cobro:cobroFecha,importe_cobrado:f.importe_total})).status).toBe(201);
    const propuesta=(await request(app).post(`/facturaciones/${c.f}/liquidacion/preparacion`).send({})).body;
    const pagoFecha=`${String(anio+2).padStart(4,'0')}-10-20`;
    expect((await request(app).post(`/facturaciones/${c.f}/liquidacion/confirmacion`)
      .send({fecha_pago:pagoFecha,detalles:propuesta.detalles})).status).toBe(201);
    const r=await informe(anio,c.town,true);expect(r.body.total_anual).toBe('100.00');
    expect(r.body.trimestres.map((t)=>t.importe_total)).toEqual(['100.00','0.00','0.00','0.00']);
    expect((await informe(anio+1,c.town)).body.total_anual).toBe('0.00');
    expect((await informe(anio+2,c.town)).body.total_anual).toBe('0.00');
    const xml=await request(app).get('/facturaciones/informe-anual/excel').query({anio,ayuntamiento_id:c.town.id});
    expect(xml.status).toBe(200);
    expect(xml.text).toContain('<Data ss:Type="Number">100.00</Data>');
    expect(xml.text).not.toContain('<Data ss:Type="Number">3.27</Data>');
    // Catálogo posterior no cambia precios aplicados ni identidad B.
    await pool.query("UPDATE medicamento SET precio=999.00,estado='INACTIVO',situacion_comercial='BAJA' WHERE id=$1",[c.med.id]);
    await pool.query("UPDATE farmacia SET denominacion='C actual distinta',cif_nif='TEST-CIF-0014' WHERE id=$1",[c.farm.id]);
    expect((await informe(anio,c.town,true)).body).toEqual(r.body);
    expect(r.body.ayuntamientos[0].farmacias[0].identidades_b).toEqual([{soe_b:c.farm.soe,denominacion_b:c.farm.denominacion,cif_b:c.farm.cif_nif}]);
  });

  it('excluye revisiones y reaperturas con advertencia limitada al año/filtro; reemisión incorpora la corrección una vez',async()=>{
    const anio=randomInt(20,80),c=await base(anio,1,['1.00']);await emitirPeriodo(c);
    const revision=await otraEntrega(c,c.farm,anio,4,['99.00']);
    expect((await informe(anio,c.town)).body.total_anual).toBe('1.00');
    expect((await reabrir(c)).status).toBe(200);
    await pool.query('UPDATE precinto SET precio_aplicado=2.00 WHERE entrega_id=$1',[c.entrega.id]);
    const r=await informe(anio,c.town);expect(r.body.total_anual).toBe('0.00');expect(r.body.advertencia).toMatch(/reabiertas/);
    expect(r.body.facturaciones_pendientes).toEqual([{facturacion_id:c.f,ayuntamiento_id:c.town.id,mes:1}]);
    expect((await informe(anio+1,c.town)).body.advertencia).toBeUndefined();
    const otro=await base(anio,7,['3.00']);await emitirPeriodo(otro);
    expect((await informe(anio,otro.town)).body.advertencia).toBeUndefined();
    expect((await emitir(c,{})).status).toBe(200);
    const final=await informe(anio,c.town);expect(final.body.total_anual).toBe('2.00');expect(final.body.advertencia).toBeUndefined();
    expect(await estado(revision)).toBe('REVISION');
  });

  it('incluye un precinto de precio cero y distingue identidades B históricas sin agrupar por titular actual',async()=>{
    const anio=randomInt(20,80),c=await base(anio,1,['0.00']);await emitirPeriodo(c);
    await pool.query("UPDATE farmacia SET denominacion='B distinto febrero',cif_nif='TEST-CIF-0010' WHERE id=$1",[c.farm.id]);
    const febrero=await otraEntrega(c,c.farm,anio,2,['0.01']);await emitirPeriodo(febrero);
    const r=await informe(anio,c.town,true),f=r.body.ayuntamientos[0].farmacias[0];
    expect(f.total_anual).toBe('0.01');expect(f.identidades_b).toHaveLength(2);
    expect(f.trimestres[0].meses[0]).toEqual({mes:1,importe_total:'0.00'});
  });

  it('total anual superior al límite de una factura se agrega exactamente sin desbordamiento',async()=>{
    const anio=randomInt(20,80),c=await base(anio,1,['9999999999.99']);await emitirPeriodo(c);
    await emitirPeriodo(await otraEntrega(c,c.farm,anio,2,['9999999999.99']));
    const r=await informe(anio,c.town);expect(r.status).toBe(200);expect(r.body.total_anual).toBe('19999999999.98');comprobarCuadre(r.body);
  });

  it.each(['','0','-1','10000','2026.5','1e3','texto'])('rechaza año inválido %s',async(anio)=>{
    expect((await request(app).get('/facturaciones/informe-anual').query({anio})).status).toBe(400);
  });

  it('valida query y municipio; año vacío devuelve cuatro trimestres y meses cero sin escribir',async()=>{
    const anio=randomInt(20,80),c=await base(anio,1);
    const r=await informe(anio,c.town,true);expect(r.status).toBe(200);expect(r.body.total_anual).toBe('0.00');expect(r.body.ayuntamientos).toEqual([]);
    expect(r.body.trimestres).toHaveLength(4);comprobarCuadre(r.body);
    expect((await request(app).get('/facturaciones/informe-anual')).status).toBe(400);
    for(const query of [{anio,extra:'1'},{anio,detalle_mensual:'1'},{anio,ayuntamiento_id:'0'},
      {anio,ayuntamiento_id:'2147483648'},{anio,detalle_mensual:['true','false']}]) {
      expect((await request(app).get('/facturaciones/informe-anual').query(query)).status).toBe(400);
    }
    expect((await informe(anio,{id:2147483647})).status).toBe(404);
    expect(await estado(c)).toBe('REVISION');
  });
});

const exportarAnual = (anio,town,mensual=false) => request(app).get('/facturaciones/informe-anual/excel')
  .query({anio,...(town?{ayuntamiento_id:town.id}:{}),detalle_mensual:String(mensual)});
const filasResumen = (xml) => {
  const hoja=xml.match(/<Worksheet ss:Name="Resumen anual">([\s\S]*?)<\/Worksheet>/)[1];
  return [...hoja.matchAll(/<Row>([\s\S]*?)<\/Row>/g)].map((r)=>[...r[1].matchAll(/<Data ss:Type="(String|Number)">([\s\S]*?)<\/Data>/g)]
    .map((c)=>({tipo:c[1],valor:c[2].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'")})));
};
describe('Excel XML del informe anual',()=>{
  it('exporta directamente una fila por farmacia con T1–T4, total y snapshots B; separa años y excluye COMISION',async()=>{
    const anio=randomInt(20,80),c=await base(anio,1,['0.10','0.10']);
    expect((await request(app).put(`/facturaciones/${c.f}/participaciones/${c.p}/b`)
      .send({soe_b:'0007',denominacion_b:'=B & <histórico>',cif_b:'TEST-CIF-0007'})).status).toBe(200);
    const otra=await insertar('farmacia',`INSERT INTO farmacia (soe,denominacion,cif_nif,direccion,codigo_postal,localidad,provincia,ayuntamiento_id)
      VALUES ($1,'B segunda','TEST-CIF-0010','Calle','28001','Villa','Madrid',$2) RETURNING *`,[randomUUID(),c.town.id]);
    await otraEntrega(c,otra,anio,1,['5.00']);await emitirPeriodo(c);
    for(const [mes,importe] of [[3,'10.01'],[4,'2.02'],[7,'3.03'],[12,'4.04']])await emitirPeriodo(await otraEntrega(c,c.farm,anio,mes,[importe]));
    await emitirPeriodo(await otraEntrega(c,c.farm,anio+1,1,['999.99']));
    await pool.query("UPDATE farmacia SET denominacion='Nombre actual ajeno',cif_nif='TEST-CIF-0014' WHERE id=$1",[c.farm.id]);
    // No se ha llamado a la consulta JSON: la descarga no necesita sesión previa.
    const r=await exportarAnual(anio,c.town);expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/application\/xml/);expect(r.headers['content-disposition']).toContain(`informe-anual-${anio}.xml`);
    const filas=filasResumen(r.text),farmacias=filas.filter((f)=>f.length===9&&f[1].valor!=='SOE'&&f[1].valor!=='');
    expect(filas[0].map((c)=>c.valor)).toEqual(['AYUNTAMIENTO','SOE','DENOMINACIÓN','CIF','TRIMESTRE 1','TRIMESTRE 2','TRIMESTRE 3','TRIMESTRE 4','TOTAL ANUAL']);
    expect(farmacias).toHaveLength(2);
    const primera=farmacias.find((f)=>f[1].valor.includes('0007'));
    expect(primera[1].tipo).toBe('String');expect(primera[2].valor).toContain('=B & <histórico>');expect(primera[3].valor).toContain('TEST-CIF-0007');
    expect(primera.slice(4).map((c)=>c.valor)).toEqual(['10.21','2.02','3.03','4.04','19.30']);
    expect(primera.slice(4).every((c)=>c.tipo==='Number')).toBe(true);
    expect(farmacias.find((f)=>f!==primera).slice(4).map((c)=>c.valor)).toEqual(['5.00','0.00','0.00','0.00','5.00']);
    expect(filas.find((f)=>f[0].valor===`TOTAL ${anio}`).slice(4).map((c)=>c.valor)).toEqual(['15.21','2.02','3.03','4.04','24.30']);
    expect(r.text).not.toContain('ss:Formula');expect(r.text).not.toContain('Nombre actual ajeno');expect(r.text).not.toContain('999.99');
    const siguiente=await exportarAnual(anio+1,c.town);
    expect(filasResumen(siguiente.text).find((f)=>f[0].valor===`TOTAL ${anio+1}`).slice(4).map((c)=>c.valor))
      .toEqual(['999.99','0.00','0.00','0.00','999.99']);
  });

  it('agrupa Ayuntamientos y añade detalle mensual opcional con totales iguales a JSON',async()=>{
    const anio=randomInt(20,80),a=await base(anio,12,['1.23']),b=await base(anio,1,['4.56']);
    await emitirPeriodo(a);await emitirPeriodo(b);
    const r=await exportarAnual(anio,null,true),json=(await informe(anio,null,true)).body;
    expect(r.status).toBe(200);expect(r.text).toContain('ss:Name="Detalle mensual"');
    const filas=filasResumen(r.text),total=filas.find((f)=>f[0].valor===`TOTAL ${anio}`);
    expect(total[8].valor).toBe(json.total_anual);
    for(const m of json.ayuntamientos) {
      const subtotal=filas.filter((f)=>f[0].valor===`SUBTOTAL ${m.denominacion}`);
      expect(subtotal.some((f)=>f[8].valor===m.total_anual)).toBe(true);
    }
    expect((await exportarAnual(anio,a.town)).text).not.toContain('ss:Name="Detalle mensual"');
  });

  it('exporta cero y advertencia de reapertura, valida filtros sin crear datos',async()=>{
    const anio=randomInt(20,80),c=await base(anio,1,['100.00']);await emitirPeriodo(c);
    expect((await reabrir(c)).status).toBe(200);
    const r=await exportarAnual(anio,c.town);expect(r.status).toBe(200);
    expect(r.text).toContain('reabiertas excluidas temporalmente');expect(r.text).toContain(`facturación ${c.f}`);
    expect(filasResumen(r.text).find((f)=>f[0].valor===`TOTAL ${anio}`)[8].valor).toBe('0.00');
    expect((await exportarAnual('x',c.town)).status).toBe(400);
    expect((await exportarAnual(anio,{id:2147483647})).status).toBe(404);
    expect((await request(app).get('/facturaciones/informe-anual/excel').query({anio,extra:'1'})).status).toBe(400);
    expect(await estado(c)).toBe('REABIERTA');
  });
});
