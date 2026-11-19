const dotenv = require('dotenv');
dotenv.config();

const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Falta variable de entorno: ${key}`);
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  auth: {
    issuer: requireValue('AUTH_JWT_ISSUER'),
    audience: requireValue('AUTH_JWT_AUDIENCE'),
    activeKid: requireValue('AUTH_JWT_ACTIVE_KID'),
    keyRing: requireValue('AUTH_JWT_KEY_RING'),
  },
};

function requireValue(key) {
  if (!process.env[key]) throw new Error(`Falta la variable de entorno obligatoria: ${key}`);
  return process.env[key];
}
