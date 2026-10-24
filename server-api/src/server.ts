import { app } from './app.js';
import { closePool } from './config/db.js';
import { env } from './config/env.js';
import { API_VERSION } from './config/version.js';

const server = app.listen(env.PORT, () => {
  console.log(
    `[driwin-api] v${API_VERSION} escuchando en http://localhost:${env.PORT}${env.API_BASE_PATH} (${env.NODE_ENV})`,
  );
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  console.log(`[driwin-api] ${signal} recibido: cerrando servidor y pool de conexiones...`);

  const forceExit = setTimeout(() => {
    console.error('[driwin-api] Cierre forzado tras 10 s.');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async (error) => {
    if (error) {
      console.error('[driwin-api] Error al cerrar el servidor HTTP:', error.message);
    }
    try {
      await closePool();
    } catch (poolError) {
      console.error('[driwin-api] Error al cerrar el pool:', (poolError as Error).message);
    }
    process.exit(error ? 1 : 0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[driwin-api] Promesa rechazada sin manejar:', reason instanceof Error ? reason.message : 'motivo desconocido');
});

process.on('uncaughtException', (error) => {
  console.error('[driwin-api] Excepción no controlada:', error.message);
  void shutdown('uncaughtException');
});
