const app = require('./routes/app');
const env = require('./config/env');
const pool = require('./config/database');

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Conexión a MySQL OK');
    app.listen(env.port, () => {
      console.log(`🚀 Servidor en http://localhost:${env.port}/api/v1`);
    });
  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
    process.exit(1);
  }
}

start();