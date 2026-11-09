import type { NextFunction, Request, Response } from 'express';
import { getValidated } from '../middlewares/validate.js';
import type {
  DeleteAccountBody,
  LoginBody,
  PurchaseBody,
  RegisterBody,
  SupportTicketBody,
} from '../schemas/account.schema.js';
import { AccountService } from '../services/account.service.js';

/** Capa 2 — sólo HTTP: lee lo validado, llama al servicio y responde. */

function session(req: Request) {
  // requireSession garantiza que existe.
  return req.accountSession as NonNullable<Request['accountSession']>;
}

/** Respuestas con token o datos de la cuenta: nunca se guardan en caché. */
function noStore(res: Response) {
  res.setHeader('Cache-Control', 'no-store');
}

export class AccountController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, device_id } = getValidated<RegisterBody>(req, 'body');
      const result = await AccountService.register(email, password, device_id);
      noStore(res);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, device_id } = getValidated<LoginBody>(req, 'body');
      const result = await AccountService.login(email, password, device_id);
      noStore(res);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await AccountService.logout(session(req).sessionId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  static async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId, deviceHash } = session(req);
      const status = await AccountService.status(accountId, deviceHash);
      noStore(res);
      res.status(200).json({ data: status });
    } catch (error) {
      next(error);
    }
  }

  static async registerDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId, deviceHash } = session(req);
      const status = await AccountService.registerDevice(accountId, deviceHash);
      noStore(res);
      res.status(200).json({ data: status });
    } catch (error) {
      next(error);
    }
  }

  static async removeDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId, deviceHash } = session(req);
      const { id } = getValidated<{ id: number }>(req, 'params');
      const status = await AccountService.removeDevice(accountId, id, deviceHash);
      noStore(res);
      res.status(200).json({ data: status });
    } catch (error) {
      next(error);
    }
  }

  static async purchase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId, deviceHash } = session(req);
      const { plan_years } = getValidated<PurchaseBody>(req, 'body');
      const status = await AccountService.purchase(accountId, plan_years, deviceHash);
      noStore(res);
      res.status(201).json({ data: status });
    } catch (error) {
      next(error);
    }
  }

  static async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { password } = getValidated<DeleteAccountBody>(req, 'body');
      await AccountService.deleteAccount(session(req).accountId, password);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  static async createSupportTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId, deviceHash } = session(req);
      const { subject, message } = getValidated<SupportTicketBody>(req, 'body');
      const ticket = await AccountService.createSupportTicket(accountId, deviceHash, subject, message);
      res.status(201).json({ data: ticket });
    } catch (error) {
      next(error);
    }
  }
}
