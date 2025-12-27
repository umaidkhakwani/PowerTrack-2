import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const createDatabaseAndTables = async () => {
  // 1. Connect to default 'postgres' database to check/create target DB
  const rootPool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres', // Connect to default DB
  });

  try {
    const client = await rootPool.connect();
    const dbName = process.env.DB_NAME;

    console.log(`Checking if database '${dbName}' exists...`);
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);

    if (res.rowCount === 0) {
      console.log(`Database '${dbName}' not found. Creating...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database '${dbName}' created successfully.`);
    } else {
      console.log(`Database '${dbName}' already exists.`);
    }
    client.release();
  } catch (error) {
    console.error('Error creating database:', error);
    await rootPool.end();
    return;
  } finally {
    await rootPool.end();
  }

  // 2. Connect to the target database to create tables
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const client = await pool.connect();
    console.log('Creating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Creating properties table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        userId uuid REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Creating consumption table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS consumption (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        propertyId uuid REFERENCES properties(id) ON DELETE CASCADE,
        date TIMESTAMP NOT NULL,
        type VARCHAR(50) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Tables created successfully.');
    client.release();
  } catch (error) {
    console.error('Error creating tables:', error);
  } finally {
    await pool.end();
  }
};

createDatabaseAndTables();
