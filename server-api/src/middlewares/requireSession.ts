import type { RequestHandler } from 'express';
import { ApiError, ErrorCode } from '../domain/errors.js';
import { AccountRepository } from '../repositories/account.repository.js';
import { SESSION_TOKEN_PREFIX, sha256 } from '../security/crypto.js';

const missingSession = () =>
  new ApiError(
    401,
    ErrorCode.UNAUTHORIZED,
    'Inicia sesión en tu cuenta DriWin.',
    undefined,
    'Envíe Authorization: Bearer <token de sesión>.',
  );

/**
 * Exige una sesión válida de cuenta DriWin (Authorization: Bearer dws_...).
 * El token nunca se guarda: se busca por su SHA-256 y debe estar vigente.
 */
export const requireSession: RequestHandler = async (req, _res, next) => {
  try {
    const authorization = req.header('Authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
    if (!token.startsWith(SESSION_TOKEN_PREFIX) || token.length > 100) {
      next(missingSession());
      return;
    }
    const session = await AccountRepository.findActiveSession(sha256(token));
    if (!session) {
      next(new ApiError(401, ErrorCode.UNAUTHORIZED, 'Tu sesión venció o se cerró.', undefined, 'Inicia sesión de nuevo.'));
      return;
    }
    req.accountSession = {
      sessionId: session.session_id,
      accountId: session.account_id,
      deviceHash: Buffer.from(session.device_hash),
    };
    next();
  } catch (error) {
    next(error);
  }
};
