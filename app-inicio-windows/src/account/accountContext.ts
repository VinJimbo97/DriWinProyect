import { createContext, useContext } from 'react';
import type { AccountStatus, SupportTicketResult } from '../api/account';

export type AccountPhase = 'loading' | 'signedOut' | 'signedIn';

export interface AccountContextValue {
  phase: AccountPhase;
  /** Estado de la cuenta (null sin sesión). */
  status: AccountStatus | null;
  /** true si la suscripción está vigente y este equipo es uno de los 3. */
  premiumActive: boolean;
  /** false si Windows no permitió guardar la sesión cifrada (dura sólo esta vez). */
  sessionPersisted: boolean;
  signIn(mode: 'login' | 'register', email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
  purchase(years: 1 | 2 | 3): Promise<void>;
  registerThisDevice(): Promise<void>;
  removeDevice(deviceId: number): Promise<void>;
  deleteAccount(password: string): Promise<void>;
  /** Acepta el aviso de privacidad vigente. */
  acceptPrivacy(): Promise<void>;
  /** "Descargar mis datos": devuelve el JSON con todo lo que guarda la API. */
  exportData(): Promise<unknown>;
  sendSupportTicket(subject: string, message: string): Promise<SupportTicketResult>;
}

export const AccountContext = createContext<AccountContextValue | null>(null);

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) {
    throw new Error('useAccount debe usarse dentro de <AccountProvider>.');
  }
  return value;
}
