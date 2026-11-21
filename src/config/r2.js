function parsePositiveInteger(value, name, maximum = Number.MAX_SAFE_INTEGER) {
  if (!/^\d+$/.test(String(value || '')) || Number(value) <= 0 || Number(value) > maximum) {
    throw new Error(`La variable ${name} debe ser un entero positivo.`);
  }
  return Number(value);
}

function requiredValue(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Falta la variable de entorno obligatoria: ${name}.`);
  return value;
}

function parseR2Config(env) {
  const accountId = requiredValue(env, 'R2_ACCOUNT_ID');
  if (!/^[A-Za-z0-9-]+$/.test(accountId)) throw new Error('La variable R2_ACCOUNT_ID tiene un formato inválido.');
  return {
    accountId,
    accessKeyId: requiredValue(env, 'R2_ACCESS_KEY_ID'),
    secretAccessKey: requiredValue(env, 'R2_SECRET_ACCESS_KEY'),
    bucketName: requiredValue(env, 'R2_BUCKET_NAME'),
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: 'auto',
    signedUploadTtlSeconds: parsePositiveInteger(env.R2_SIGNED_UPLOAD_TTL_SECONDS || '300', 'R2_SIGNED_UPLOAD_TTL_SECONDS', 604800),
    signedDownloadTtlSeconds: parsePositiveInteger(env.R2_SIGNED_DOWNLOAD_TTL_SECONDS || '3600', 'R2_SIGNED_DOWNLOAD_TTL_SECONDS', 604800),
    maxFileSizeBytes: parsePositiveInteger(env.R2_MAX_FILE_SIZE_BYTES || '10485760', 'R2_MAX_FILE_SIZE_BYTES'),
  };
}

function createR2Config(env = process.env) {
  let config;
  return () => {
    if (!config) config = parseR2Config(env);
    return config;
  };
}

module.exports = { createR2Config, parseR2Config };
