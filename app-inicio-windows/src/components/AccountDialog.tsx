import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useAccount } from '../account/accountContext';
import { ApiRequestError } from '../api/client';
import type { AccountStatus } from '../api/account';
import { desktop } from '../desktop/bridge';
import { SUPPORT_EMAIL } from '../privacy/notice';
import { useSettings } from '../settings/settingsContext';
import { HelpTip } from './HelpTip';
import { PrivacyNotice } from './PrivacyNotice';

export type AccountView = 'auth' | 'summary' | 'support' | 'delete' | 'privacy';

interface Props {
  initialView?: AccountView;
  /**
   * Pestaña inicial del formulario. Quien llega desde "Elegir plan" sin sesión casi
   * siempre es una persona nueva: abrir en "Crear cuenta" ahorra un clic (mapa de
   * navegación, docs/qa/navegacion).
   */
  initialAuthMode?: 'login' | 'register';
  onClose: () => void;
  /** Se llama después de iniciar sesión o crear la cuenta. */
  onSignedIn?: () => void;
  onSeePlans: () => void;
}

/** Errores de la API: mensaje general + mensajes por campo (validación del servidor). */
function readError(error: unknown, fallback: string): { message: string; fields: Record<string, string> } {
  if (error instanceof ApiRequestError) {
    const fields: Record<string, string> = {};
    for (const detail of error.details ?? []) {
      fields[detail.field] ??= detail.issue;
    }
    return { message: error.message, fields };
  }
  return { message: fallback, fields: {} };
}

function useDateFormat() {
  const { settings } = useSettings();
  const formatter = new Intl.DateTimeFormat(settings.language === 'es' ? 'es-CL' : 'en-US', { dateStyle: 'medium' });
  return (iso: string) => formatter.format(new Date(iso));
}

/**
 * Recuadro de la cuenta DriWin (ícono de usuario de la barra superior):
 * iniciar sesión / crear cuenta, resumen con plan y equipos, soporte técnico
 * y "Borrar mis datos".
 */
export function AccountDialog({ initialView, initialAuthMode = 'login', onClose, onSignedIn, onSeePlans }: Props) {
  const { phase } = useAccount();
  const { t } = useSettings();
  const [view, setView] = useState<AccountView>(initialView ?? (phase === 'signedIn' ? 'summary' : 'auth'));

  // Esc cierra el recuadro.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const signedIn = phase === 'signedIn';
  const current: AccountView = !signedIn ? 'auth' : view === 'auth' ? 'summary' : view;

  return (
    <div className="overlay-modal" onMouseDown={onClose}>
      <div
        className="modal-box account-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="dialog-close" aria-label={t('common.close')} title={t('common.close')} onClick={onClose}>
          ✕
        </button>
        {phase === 'loading' && <p>{t('account.loading')}</p>}
        {phase !== 'loading' && current === 'auth' && (
          <AuthForm
            initialMode={initialAuthMode}
            onDone={() => {
              setView('summary');
              onSignedIn?.();
            }}
          />
        )}
        {signedIn && current === 'summary' && (
          <AccountSummary
            onSupport={() => setView('support')}
            onDelete={() => setView('delete')}
            onPrivacy={() => setView('privacy')}
            onSeePlans={onSeePlans}
          />
        )}
        {signedIn && current === 'privacy' && <PrivacyConsentView onBack={() => setView('summary')} />}
        {signedIn && current === 'support' && <SupportForm onBack={() => setView('summary')} onSeePlans={onSeePlans} />}
        {signedIn && current === 'delete' && <DeleteAccountForm onBack={() => setView('summary')} onDeleted={onClose} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Iniciar sesión / crear cuenta
// ---------------------------------------------------------------------------

function Field({
  id,
  label,
  error,
  help,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  help?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="form-field">
      <label htmlFor={id} className="form-field__label">
        {label}
        {help}
      </label>
      {children}
      {error && (
        <span className="form-field__error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function AuthForm({ onDone, initialMode }: { onDone: () => void; initialMode: 'login' | 'register' }) {
  const { signIn } = useAccount();
  const { t } = useSettings();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Consentimiento: la casilla parte SIN marcar (Ley 21.719: consentimiento explícito).
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [readingNotice, setReadingNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null);

  const passwordTooShort = mode === 'register' && password.length > 0 && password.length < 10;
  const missingConsent = mode === 'register' && !privacyAccepted;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(mode, email, password);
      setPassword('');
      onDone();
    } catch (caught) {
      setError(readError(caught, t('account.error.generic')));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setError(null);
  };

  // Leer el aviso sin perder lo escrito: el formulario sigue montado en memoria.
  if (readingNotice) {
    return (
      <div>
        <button type="button" className="link-button" onClick={() => setReadingNotice(false)}>← {t('account.back')}</button>
        <div style={{ marginTop: 8 }}>
          <PrivacyNotice headingId="account-dialog-title" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-action btn-primary-fill"
            onClick={() => {
              setPrivacyAccepted(true);
              setReadingNotice(false);
            }}
          >
            {t('privacy.outdated.accept')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <h2 id="account-dialog-title" style={{ marginTop: 0 }}>
        {mode === 'login' ? t('account.login.title') : t('account.register.title')}
      </h2>
      <div className="segmented account-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'login'} aria-checked={mode === 'login'} onClick={() => switchMode('login')}>
          {t('account.login.tab')}
        </button>
        <button type="button" role="tab" aria-selected={mode === 'register'} aria-checked={mode === 'register'} onClick={() => switchMode('register')}>
          {t('account.register.tab')}
        </button>
      </div>
      <p className="settings-hint" style={{ marginTop: 12 }}>{t('account.freeNote')}</p>

      <Field id="account-email" label={t('account.email')} error={error?.fields.email}>
        <input
          id="account-email"
          className="text-input"
          type="email"
          autoComplete="email"
          value={email}
          maxLength={160}
          placeholder="nombre@correo.cl"
          aria-invalid={Boolean(error?.fields.email)}
          aria-describedby={error?.fields.email ? 'account-email-error' : undefined}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoFocus
        />
      </Field>

      <Field
        id="account-password"
        label={t('account.password')}
        error={error?.fields.password ?? (passwordTooShort ? t('account.password.tooShort') : undefined)}
        help={
          mode === 'register' ? (
            <HelpTip title={t('account.password')}>{t('account.password.help')}</HelpTip>
          ) : undefined
        }
      >
        <div className="password-input">
          <input
            id="account-password"
            className="text-input"
            type={showPassword ? 'text' : 'password'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            maxLength={128}
            aria-invalid={Boolean(error?.fields.password) || passwordTooShort}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button
            type="button"
            className="password-toggle"
            title={showPassword ? t('account.password.hide') : t('account.password.show')}
            aria-label={showPassword ? t('account.password.hide') : t('account.password.show')}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? t('account.password.hideShort') : t('account.password.showShort')}
          </button>
        </div>
      </Field>

      {mode === 'register' && (
        <div className="consent-check">
          <input
            id="account-privacy"
            type="checkbox"
            checked={privacyAccepted}
            onChange={(event) => setPrivacyAccepted(event.target.checked)}
            aria-describedby={error?.fields.privacy_accepted ? 'account-privacy-error' : undefined}
          />
          <div>
            <label htmlFor="account-privacy">{t('privacy.consent')}</label>{' '}
            <button type="button" className="link-button" onClick={() => setReadingNotice(true)}>
              ({t('privacy.read')})
            </button>
            {(error?.fields.privacy_accepted ?? error?.fields.privacy_version) && (
              <span className="form-field__error" id="account-privacy-error" role="alert" style={{ display: 'block' }}>
                {error?.fields.privacy_accepted ?? error?.fields.privacy_version}
              </span>
            )}
          </div>
        </div>
      )}

      {error && Object.keys(error.fields).length === 0 && (
        <p className="form-error" role="alert">{error.message}</p>
      )}

      <button
        type="submit"
        className="btn-action btn-primary-fill"
        disabled={busy || email.trim() === '' || password === '' || passwordTooShort || missingConsent}
        title={missingConsent ? t('privacy.consent.required') : undefined}
      >
        {busy ? t('account.working') : mode === 'login' ? t('account.login.submit') : t('account.register.submit')}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Resumen: plan, equipos y acciones
// ---------------------------------------------------------------------------

function PlanSummary({ status, onSeePlans }: { status: AccountStatus; onSeePlans: () => void }) {
  const { t } = useSettings();
  const formatDate = useDateFormat();
  const subscription = status.subscription;

  if (!subscription || !subscription.active) {
    return (
      <div className="settings-card plan-status">
        <div>
          <h3>{t('settings.premium.statusTitle')}</h3>
          <span className="plan-badge free">{t('settings.premium.statusFree')}</span>
          {subscription && (
            <p className="settings-note">{t('account.plan.expired', { date: formatDate(subscription.ends_at) })}</p>
          )}
        </div>
        <button type="button" className="btn-action btn-premium" onClick={onSeePlans}>
          {t('settings.premium.seePlans')}
        </button>
      </div>
    );
  }

  return (
    <div className="settings-card">
      <h3>{t('settings.premium.statusTitle')}</h3>
      <span className="plan-badge active">👑 {subscription.plan}</span>
      <p className="settings-note">
        {t('account.plan.until', { date: formatDate(subscription.ends_at) })} · {t('account.plan.reference', { ref: subscription.payment_reference })}
      </p>
    </div>
  );
}

function DeviceList({ status }: { status: AccountStatus }) {
  const { removeDevice, registerThisDevice } = useAccount();
  const { t } = useSettings();
  const formatDate = useDateFormat();
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setConfirming(null);
    } catch (caught) {
      setError(readError(caught, t('account.error.generic')).message);
    } finally {
      setBusy(false);
    }
  };

  const full = status.devices.length >= status.max_devices;

  return (
    <div className="settings-card">
      <h3>
        {t('account.devices.title', { count: status.devices.length, max: status.max_devices })}
        <HelpTip title={t('account.devices.title', { count: status.devices.length, max: status.max_devices })}>
          {t('account.devices.help')}
        </HelpTip>
      </h3>

      {!status.this_device.registered && (
        <div className="account-warning">
          <p style={{ margin: 0 }}>{full ? t('account.devices.thisNotRegisteredFull') : t('account.devices.thisNotRegistered')}</p>
          {!full && (
            <button type="button" className="btn-action" disabled={busy} onClick={() => void run(registerThisDevice)}>
              {t('account.devices.registerThis')}
            </button>
          )}
        </div>
      )}

      <ul className="device-list">
        {status.devices.map((device, index) => (
          <li key={device.device_id} className="device-list__item">
            <div>
              <strong>
                {t('account.devices.name', { n: index + 1 })}
                {device.current && <span className="device-list__current">{t('account.devices.current')}</span>}
              </strong>
              <div className="settings-note" style={{ margin: 0 }}>
                {t('account.devices.dates', { registered: formatDate(device.registered_at), seen: formatDate(device.last_seen_at) })}
              </div>
            </div>
            {confirming === device.device_id ? (
              <span className="device-list__confirm">
                <button type="button" className="btn-action btn-danger-outline" disabled={busy} onClick={() => void run(() => removeDevice(device.device_id))}>
                  {t('account.devices.confirmRemove')}
                </button>
                <button type="button" className="btn-action" disabled={busy} onClick={() => setConfirming(null)}>
                  {t('common.cancel')}
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn-action"
                title={device.current ? t('account.devices.removeCurrentHint') : t('account.devices.removeHint')}
                disabled={busy}
                onClick={() => setConfirming(device.device_id)}
              >
                {t('account.devices.remove')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

/** Descarga del JSON: en el .exe, diálogo "Guardar como"; en el navegador (dev), descarga normal. */
async function saveExport(data: unknown): Promise<{ ok: true; path: string } | { ok: false; cancelled: boolean; message?: string }> {
  const json = JSON.stringify(data, null, 2);
  if (desktop) {
    const result = await desktop.saveAccountExport(json);
    return result.ok ? result : { ok: false, cancelled: result.code === 'CANCELLED', message: result.message };
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'driwin-mis-datos.json';
  link.click();
  URL.revokeObjectURL(url);
  return { ok: true, path: link.download };
}

function ExportDataButton() {
  const { exportData } = useAccount();
  const { t } = useSettings();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const run = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await saveExport(await exportData());
      if (result.ok) {
        setMessage({ text: t('account.export.saved', { path: result.path }), error: false });
      } else {
        setMessage({ text: result.cancelled ? t('account.export.cancelled') : (result.message ?? t('account.error.generic')), error: !result.cancelled });
      }
    } catch (caught) {
      setMessage({ text: readError(caught, t('account.error.generic')).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="btn-action" disabled={busy} title={t('account.export.hint')} onClick={() => void run()}>
        {busy ? t('account.export.working') : t('account.export.open')}
      </button>
      {message && (
        <p className={message.error ? 'form-error' : 'settings-note'} role={message.error ? 'alert' : 'status'} style={{ flexBasis: '100%', margin: 0 }}>
          {message.text}
        </p>
      )}
    </>
  );
}

/** Aviso de privacidad dentro de "Mi cuenta": aceptar la versión vigente si falta. */
function PrivacyConsentView({ onBack }: { onBack: () => void }) {
  const { status, acceptPrivacy } = useAccount();
  const { t } = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = status ? !status.privacy.up_to_date : false;

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await acceptPrivacy();
      onBack();
    } catch (caught) {
      setError(readError(caught, t('account.error.generic')).message);
      setBusy(false);
    }
  };

  return (
    <div>
      <button type="button" className="link-button" onClick={onBack}>← {t('account.back')}</button>
      <div style={{ marginTop: 8 }}>
        <PrivacyNotice headingId="account-dialog-title" />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {pending && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-action btn-primary-fill" disabled={busy} onClick={() => void accept()}>
            {busy ? t('account.working') : t('privacy.outdated.accept')}
          </button>
        </div>
      )}
    </div>
  );
}

function AccountSummary({
  onSupport,
  onDelete,
  onPrivacy,
  onSeePlans,
}: {
  onSupport: () => void;
  onDelete: () => void;
  onPrivacy: () => void;
  onSeePlans: () => void;
}) {
  const { status, signOut, premiumActive, sessionPersisted } = useAccount();
  const { t } = useSettings();
  const formatDate = useDateFormat();
  const [busy, setBusy] = useState(false);
  if (!status) {
    return null;
  }

  return (
    <div>
      <h2 id="account-dialog-title" style={{ margin: '0 0 2px 0' }}>{t('account.summary.title')}</h2>
      <p className="settings-hint" style={{ fontSize: '0.9rem' }}>{status.email}</p>
      {!sessionPersisted && <p className="settings-note">{t('account.sessionNotSaved')}</p>}

      {!status.privacy.up_to_date && (
        <div className="account-warning" role="status">
          <div>
            <strong>{t('privacy.outdated.title')}</strong>
            <p style={{ margin: '2px 0 0 0' }}>{t('privacy.outdated.body')}</p>
          </div>
          <button type="button" className="btn-action btn-primary-fill" onClick={onPrivacy}>
            {t('privacy.read')}
          </button>
        </div>
      )}

      <PlanSummary status={status} onSeePlans={onSeePlans} />
      <DeviceList status={status} />

      <div className="account-actions">
        <button
          type="button"
          className="btn-action"
          onClick={onSupport}
          title={premiumActive ? t('account.support.title') : t('settings.premium.locked')}
        >
          {premiumActive ? '' : '🔒 '}
          {t('account.support.open')}
        </button>
        <button
          type="button"
          className="btn-action"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await signOut();
          }}
        >
          {t('account.signOut')}
        </button>
        <ExportDataButton />
        <button type="button" className="btn-action btn-danger-outline" onClick={onDelete}>
          {t('account.delete.open')}
        </button>
      </div>

      <p className="settings-note" style={{ marginTop: 12 }}>
        {status.privacy.accepted_version && status.privacy.accepted_at
          ? t('privacy.acceptedOn', { version: status.privacy.accepted_version, date: formatDate(status.privacy.accepted_at) })
          : ''}{' '}
        <button type="button" className="link-button" onClick={onPrivacy}>
          {t('privacy.open')}
        </button>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Soporte técnico (Premium)
// ---------------------------------------------------------------------------

function SupportForm({ onBack, onSeePlans }: { onBack: () => void; onSeePlans: () => void }) {
  const { premiumActive, sendSupportTicket } = useAccount();
  const { t } = useSettings();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null);
  const [sent, setSent] = useState<{ id: number; replyTo: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const ticket = await sendSupportTicket(subject, message);
      setSent({ id: ticket.ticket_id, replyTo: ticket.reply_to });
    } catch (caught) {
      setError(readError(caught, t('account.error.generic')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button type="button" className="link-button" onClick={onBack}>← {t('account.back')}</button>
      <h2 id="account-dialog-title" style={{ marginTop: 8 }}>{t('account.support.title')}</h2>
      <p className="settings-hint">{t('account.support.intro', { email: SUPPORT_EMAIL })}</p>

      {!premiumActive && (
        <div className="account-warning">
          <p style={{ margin: 0 }}>🔒 {t('account.support.locked')}</p>
          <button type="button" className="btn-action btn-premium" onClick={onSeePlans}>{t('settings.premium.seePlans')}</button>
        </div>
      )}

      {sent ? (
        <div className="bloat-empty" role="status">
          {t('account.support.sent', { id: sent.id, email: sent.replyTo })}
        </div>
      ) : (
        premiumActive && (
          <form onSubmit={(event) => void submit(event)} noValidate>
            <Field id="support-subject" label={t('account.support.subject')} error={error?.fields.subject}>
              <input
                id="support-subject"
                className="text-input"
                value={subject}
                maxLength={120}
                placeholder={t('account.support.subjectPlaceholder')}
                onChange={(event) => setSubject(event.target.value)}
                autoFocus
              />
            </Field>
            <Field id="support-message" label={t('account.support.message')} error={error?.fields.message}>
              <textarea
                id="support-message"
                className="text-input"
                rows={6}
                value={message}
                maxLength={2000}
                placeholder={t('account.support.messagePlaceholder')}
                onChange={(event) => setMessage(event.target.value)}
              />
              <span className="settings-note" style={{ margin: 0, textAlign: 'right' }}>{message.length} / 2000</span>
            </Field>
            {error && Object.keys(error.fields).length === 0 && <p className="form-error" role="alert">{error.message}</p>}
            <button
              type="submit"
              className="btn-action btn-primary-fill"
              disabled={busy || subject.trim().length < 5 || message.trim().length < 10}
            >
              {busy ? t('account.working') : t('account.support.send')}
            </button>
          </form>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Borrar mis datos (Ley 21.719)
// ---------------------------------------------------------------------------

function DeleteAccountForm({ onBack, onDeleted }: { onBack: () => void; onDeleted: () => void }) {
  const { deleteAccount } = useAccount();
  const { t } = useSettings();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
      onDeleted();
    } catch (caught) {
      setError(readError(caught, t('account.error.generic')).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <button type="button" className="link-button" onClick={onBack}>← {t('account.back')}</button>
      <h2 id="account-dialog-title" style={{ marginTop: 8, color: 'var(--danger-color)' }}>{t('account.delete.title')}</h2>
      <ul className="account-delete-list">
        <li>{t('account.delete.item.account')}</li>
        <li>{t('account.delete.item.devices')}</li>
        <li>{t('account.delete.item.support')}</li>
        <li>{t('account.delete.item.sales')}</li>
      </ul>
      <p className="settings-note">{t('account.delete.local')}</p>
      <Field id="delete-password" label={t('account.delete.password')} error={error ?? undefined}>
        <input
          id="delete-password"
          className="text-input"
          type="password"
          autoComplete="current-password"
          value={password}
          maxLength={128}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
        />
      </Field>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" className="btn-action" onClick={onBack}>{t('common.cancel')}</button>
        <button type="submit" className="btn-action btn-danger" disabled={busy || password === ''}>
          {busy ? t('account.working') : t('account.delete.submit')}
        </button>
      </div>
    </form>
  );
}
