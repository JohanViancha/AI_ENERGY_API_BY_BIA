/**
 * Falla el arranque si falta configuración crítica, en vez de descubrirlo en el primer request.
 * @throws Error listando las variables faltantes o inválidas.
 */
export function validateEnv(config: Record<string, unknown>) {
  const required = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
  ];
  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  const port = config.PORT;
  if (port !== undefined && !Number.isInteger(Number(port))) {
    throw new Error('PORT must be an integer');
  }

  if (config.NODE_ENV === 'production' && !config.CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN is required when NODE_ENV=production');
  }

  return config;
}
