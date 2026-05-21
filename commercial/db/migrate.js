#!/usr/bin/env node
/**
 * Run database migrations
 * Usage: node commercial/db/migrate.js
 * Or:    npm run db:migrate (from commercial/)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Add it to your .env file.');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();
    console.log('Connected to database');

    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('✓ Schema applied');

    await client.end();
    console.log('Migration complete');
  } catch (err) {
    console.error('Migration failed:', err.message);
    await client.end();
    process.exit(1);
  }
}

migrate();
