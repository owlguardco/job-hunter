/**
 * Job Hunter — Entry Point
 *
 * Controls which server starts based on environment.
 *
 * START_COMMERCIAL=true  → commercial server (Clerk + Stripe + Postgres)
 * START_COMMERCIAL unset → open source server (users bring own API key)
 *
 * Usage:
 *   node start.js               (open source)
 *   START_COMMERCIAL=true node start.js  (commercial)
 *   npm start                   (open source)
 *   npm run commercial          (commercial)
 */

if (process.env.START_COMMERCIAL === 'true') {
  console.log('Starting commercial server...');
  require('./commercial/server/index.js');
} else {
  console.log('Starting open source server...');
  require('./server.js');
}
