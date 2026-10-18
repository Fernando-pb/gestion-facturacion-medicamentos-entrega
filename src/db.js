import pg from 'pg';

const { Pool } = pg;

const port = Number.parseInt(process.env.DB_PORT ?? '5432', 10);

const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port,
  database: process.env.DB_NAME ?? 'gestion_facturacion_medicamentos',
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
});

export default pool;
