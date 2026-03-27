const { Client } = require('pg');

const password = '123@Mudrek!';
const user = 'postgres';

async function setupDatabase() {
  const client = new Client({
    user,
    password,
    host: 'localhost',
    port: 5432,
    database: 'postgres' // Connect to default DB first to issue CREATE DATABASE
  });

  try {
    await client.connect();
    console.log('Successfully connected to PostgreSQL!');
    
    // Check if database exists
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname='mudrek_db'");
    if (res.rowCount === 0) {
      console.log('Database mudrek_db does not exist. Creating...');
      await client.query('CREATE DATABASE mudrek_db');
      console.log('Database mudrek_db created successfully!');
    } else {
      console.log('Database mudrek_db already exists.');
    }
    
    await client.end();
  } catch (err) {
    console.error('Error connecting to PostgreSQL:', err.message);
    await client.end();
    process.exit(1);
  }
}

setupDatabase();
