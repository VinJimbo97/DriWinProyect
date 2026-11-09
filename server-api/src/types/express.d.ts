import type { ApiRole } from '../middlewares/authenticate.js';
import type { RequestPart } from '../middlewares/validate.js';

/**
 * Extensión tipada de Express: datos que el servidor agrega a la petición
 * después de validar (nunca provienen directamente del cliente sin sanear).
 */
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      apiRole?: ApiRole;
      validated?: Partial<Record<RequestPart, unknown>>;
      /** Sesión de una cuenta DriWin (middleware requireSession). */
      accountSession?: { sessionId: number; accountId: number; deviceHash: Buffer };
    }
  }
}

export {};
