/**
 * Entorno mínimo para pruebas: nunca usa credenciales reales.
 * Se ejecuta antes de importar los módulos de la aplicación.
 */
process.env.NODE_ENV = 'test';
process.env.PORT = '3999';
process.env.API_KEY = 'test_api_key_1234567890abcdef';
process.env.API_KEY_READ_ONLY = 'test_read_only_key_1234567890';
process.env.DATABASE_URL =
  'postgresql://driwin_test:test@127.0.0.1:5432/driwin_catalog?sslmode=require';
process.env.AZURE_BLOB_ENDPOINT = 'https://driwinstorage.blob.core.windows.net';
process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
// Clave de prueba (no es la de producción).
process.env.DATA_ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
// Las pruebas hacen muchos inicios de sesión seguidos desde la misma IP.
process.env.AUTH_RATE_LIMIT_MAX = '1000';
