import pg from 'pg';

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../../.env') });

const { Client } = pg;

export async function bdHomologacion() {
  
  console.log('Variables DB_* encontradas:');
  Object.keys(process.env)
    .filter(key => key.startsWith('DB_'))
    .forEach(key => {
      console.log(`${key}: ${process.env[key] ? '✅ Definida' : '❌ Undefined'}`);
    });

  const requiredVars = ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_NAME'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Variables de entorno faltantes:', missingVars);
    throw new Error(`Variables de entorno faltantes: ${missingVars.join(', ')}`);
  }

  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
      rejectUnauthorized: false,
    },
    connectTimeout: 30000,
    query_timeout: 30000,
  };

  console.log('Configuración de conexión:', {
    host: config.host,
    port: config.port,
    user: config.user,
    database: config.database,
  });

  const client = new Client(config);

  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL con SSL');
    return client;
  } catch (error: any) {
    console.error('❌ Error detallado de conexión:');
    console.error('- Código:', error.code);
    console.error('- Mensaje:', error.message);
    console.error('- Host:', config.host);
    console.error('- Usuario:', config.user);
    console.error('- Base de datos:', config.database);
    throw error;
  }
}

bdHomologacion()