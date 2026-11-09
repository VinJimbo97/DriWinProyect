import { Router } from 'express';
import { AccountController } from '../controllers/account.controller.js';
import { authRateLimiter } from '../middlewares/rateLimit.js';
import { requireSession } from '../middlewares/requireSession.js';
import { validate } from '../middlewares/validate.js';
import {
  deleteAccountSchema,
  deviceIdParamSchema,
  loginSchema,
  purchaseSchema,
  registerSchema,
  supportTicketSchema,
} from '../schemas/account.schema.js';

/**
 * Capa 3 — Cuentas DriWin (Premium).
 *   /auth/*            registro, inicio y cierre de sesión
 *   /account/*         estado, equipos (máx. 3), compra simulada y borrado de datos
 *   /support-tickets   consultas al soporte técnico (Premium)
 */
export const authRouter = Router();
authRouter.post('/register', authRateLimiter, validate({ body: registerSchema }), AccountController.register);
authRouter.post('/login', authRateLimiter, validate({ body: loginSchema }), AccountController.login);
authRouter.post('/logout', requireSession, AccountController.logout);

export const accountRouter = Router();
accountRouter.use(requireSession);
accountRouter.get('/', AccountController.getStatus);
accountRouter.post('/devices', AccountController.registerDevice);
accountRouter.delete('/devices/:id', validate({ params: deviceIdParamSchema }), AccountController.removeDevice);
accountRouter.post('/subscription', validate({ body: purchaseSchema }), AccountController.purchase);
// POST (y no DELETE) porque lleva la contraseña en el cuerpo para confirmar.
accountRouter.post('/delete', authRateLimiter, validate({ body: deleteAccountSchema }), AccountController.deleteAccount);

export const supportRouter = Router();
supportRouter.post('/', requireSession, validate({ body: supportTicketSchema }), AccountController.createSupportTicket);
