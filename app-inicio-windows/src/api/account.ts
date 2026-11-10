import { apiPost, apiWithSession } from './client';

/**
 * Cuentas DriWin (server-api/src/routes/account.routes.ts).
 * Los tipos replican AccountStatusDto y AccountSessionDto del backend.
 */

export interface AccountDevice {
  device_id: number;
  registered_at: string;
  last_seen_at: string;
  /** true = es este equipo. */
  current: boolean;
}

export interface AccountSubscription {
  plan: string;
  years: number;
  starts_at: string;
  ends_at: string;
  active: boolean;
  /** 'SIM-...' = pago simulado. */
  payment_reference: string;
}

export interface AccountStatus {
  email: string;
  created_at: string;
  /** Suscripción vigente Y este equipo registrado (dentro de los 3). */
  premium_active: boolean;
  subscription: AccountSubscription | null;
  this_device: { registered: boolean };
  devices: AccountDevice[];
  max_devices: number;
}

export interface AccountSession {
  token: string;
  expires_at: string;
  account: AccountStatus;
}

export interface SupportTicketResult {
  ticket_id: number;
  created_at: string;
  /** Correo de respuesta, parcialmente oculto. */
  reply_to: string;
}

type Data<T> = { data: T };

export async function register(email: string, password: string, deviceId: string): Promise<AccountSession> {
  return (await apiPost<Data<AccountSession>>('/auth/register', { email, password, device_id: deviceId })).data;
}

export async function login(email: string, password: string, deviceId: string): Promise<AccountSession> {
  return (await apiPost<Data<AccountSession>>('/auth/login', { email, password, device_id: deviceId })).data;
}

export function logout(token: string): Promise<void> {
  return apiWithSession<void>('POST', '/auth/logout', token);
}

export async function getAccountStatus(token: string): Promise<AccountStatus> {
  return (await apiWithSession<Data<AccountStatus>>('GET', '/account', token)).data;
}

export async function registerThisDevice(token: string): Promise<AccountStatus> {
  return (await apiWithSession<Data<AccountStatus>>('POST', '/account/devices', token)).data;
}

export async function removeDevice(token: string, deviceId: number): Promise<AccountStatus> {
  return (await apiWithSession<Data<AccountStatus>>('DELETE', `/account/devices/${deviceId}`, token)).data;
}

/** Compra simulada: no hay cobro real en esta versión. */
export async function purchasePlan(token: string, years: 1 | 2 | 3): Promise<AccountStatus> {
  return (await apiWithSession<Data<AccountStatus>>('POST', '/account/subscription', token, { plan_years: years })).data;
}

export function deleteAccount(token: string, password: string): Promise<void> {
  return apiWithSession<void>('POST', '/account/delete', token, { password });
}

export async function createSupportTicket(token: string, subject: string, message: string): Promise<SupportTicketResult> {
  return (await apiWithSession<Data<SupportTicketResult>>('POST', '/support-tickets', token, { subject, message })).data;
}
