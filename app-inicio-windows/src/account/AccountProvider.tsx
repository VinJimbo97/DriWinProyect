import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as accountApi from '../api/account';
import type { AccountStatus } from '../api/account';
import { ApiRequestError } from '../api/client';
import { desktop } from '../desktop/bridge';
import { AccountContext, type AccountContextValue, type AccountPhase } from './accountContext';

const BROWSER_DEVICE_KEY = 'driwin_device_id';

/**
 * Identificador aleatorio del equipo. En el .exe lo guarda Electron; en el
 * navegador (desarrollo) se guarda en localStorage.
 */
async function getDeviceId(): Promise<string> {
  if (desktop) {
    return desktop.getDeviceId();
  }
  try {
    const saved = localStorage.getItem(BROWSER_DEVICE_KEY);
    if (saved) {
      return saved;
    }
    const created = crypto.randomUUID();
    localStorage.setItem(BROWSER_DEVICE_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

const isUnauthorized = (error: unknown) => error instanceof ApiRequestError && error.status === 401;

/**
 * Sesión de la cuenta DriWin para toda la app.
 * - Al abrir, recupera la sesión guardada (cifrada por Windows) y pide el estado.
 * - Si el servidor responde 401 (sesión vencida, cerrada o equipo quitado),
 *   borra la sesión local y vuelve a "sin cuenta".
 * - En el navegador la sesión vive sólo en memoria (nunca en localStorage).
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<AccountPhase>('loading');
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [sessionPersisted, setSessionPersisted] = useState(true);
  const tokenRef = useRef<string | null>(null);

  const forget = useCallback(async () => {
    tokenRef.current = null;
    setStatus(null);
    setPhase('signedOut');
    await desktop?.clearSession().catch(() => {});
  }, []);

  // Recuperar la sesión guardada al abrir la app.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = desktop ? await desktop.loadSession().catch(() => null) : null;
      if (!token) {
        if (!cancelled) setPhase('signedOut');
        return;
      }
      try {
        const current = await accountApi.getAccountStatus(token);
        if (!cancelled) {
          tokenRef.current = token;
          setStatus(current);
          setPhase('signedIn');
        }
      } catch (error) {
        if (cancelled) return;
        if (isUnauthorized(error)) {
          await forget();
        } else {
          // Sin conexión: se conserva la sesión guardada y se trata como gratis por ahora.
          tokenRef.current = token;
          setPhase('signedOut');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [forget]);

  /** Ejecuta una acción con la sesión; ante 401 cierra la sesión local. */
  const withSession = useCallback(
    async <T,>(action: (token: string) => Promise<T>): Promise<T> => {
      const token = tokenRef.current;
      if (!token) {
        throw new ApiRequestError(401, 'UNAUTHORIZED', 'Inicia sesión en tu cuenta DriWin.');
      }
      try {
        return await action(token);
      } catch (error) {
        if (isUnauthorized(error)) {
          await forget();
        }
        throw error;
      }
    },
    [forget],
  );

  const signIn = useCallback(async (mode: 'login' | 'register', email: string, password: string) => {
    const deviceId = await getDeviceId();
    const session =
      mode === 'login'
        ? await accountApi.login(email, password, deviceId)
        : await accountApi.register(email, password, deviceId);
    tokenRef.current = session.token;
    setStatus(session.account);
    setPhase('signedIn');
    // En el navegador (desarrollo) la sesión vive en memoria a propósito: no se avisa nada.
    const persisted = desktop ? await desktop.saveSession(session.token).catch(() => false) : true;
    setSessionPersisted(persisted);
  }, []);

  const signOut = useCallback(async () => {
    const token = tokenRef.current;
    await forget();
    if (token) {
      // Si falla (sin internet), la sesión vence sola en el servidor.
      await accountApi.logout(token).catch(() => {});
    }
  }, [forget]);

  const update = useCallback(
    async (action: (token: string) => Promise<AccountStatus>) => {
      const next = await withSession(action);
      setStatus(next);
      setPhase('signedIn');
    },
    [withSession],
  );

  const value = useMemo<AccountContextValue>(
    () => ({
      phase,
      status,
      premiumActive: phase === 'signedIn' && status?.premium_active === true,
      sessionPersisted,
      signIn,
      signOut,
      refresh: () => update(accountApi.getAccountStatus),
      purchase: (years) => update((token) => accountApi.purchasePlan(token, years)),
      registerThisDevice: () => update(accountApi.registerThisDevice),
      removeDevice: (deviceId) => update((token) => accountApi.removeDevice(token, deviceId)),
      deleteAccount: async (password) => {
        await withSession((token) => accountApi.deleteAccount(token, password));
        await forget();
      },
      acceptPrivacy: () => update(accountApi.acceptPrivacy),
      exportData: () => withSession(accountApi.exportAccountData),
      sendSupportTicket: (subject, message) =>
        withSession((token) => accountApi.createSupportTicket(token, subject, message)),
    }),
    [phase, status, sessionPersisted, signIn, signOut, update, withSession, forget],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
