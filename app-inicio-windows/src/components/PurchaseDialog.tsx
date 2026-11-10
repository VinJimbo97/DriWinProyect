import { useEffect, useState } from 'react';
import { useAccount } from '../account/accountContext';
import { ApiRequestError } from '../api/client';
import { formatClp, PREMIUM_PLANS } from '../premium/plans';
import { useSettings } from '../settings/settingsContext';

/**
 * Confirmación de compra con PAGO SIMULADO: no se cobra nada ni se piden datos
 * de tarjeta. El servidor crea la suscripción con una referencia "SIM-...".
 */
export function PurchaseDialog({ years, onClose }: { years: 1 | 2 | 3; onClose: () => void }) {
  const { purchase, status } = useAccount();
  const { t, settings } = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const plan = PREMIUM_PLANS.find((candidate) => candidate.years === years);
  if (!plan) {
    return null;
  }

  const extending = status?.subscription?.active === true;
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(settings.language === 'es' ? 'es-CL' : 'en-US', { dateStyle: 'long' }).format(new Date(iso));

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await purchase(years);
      setDone(true);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : t('account.error.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay-modal" onMouseDown={() => !busy && onClose()}>
      <div
        className="modal-box account-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {done && status?.subscription ? (
          <>
            <h2 id="purchase-title" style={{ marginTop: 0, color: 'var(--success-color)' }}>{t('purchase.done.title')}</h2>
            <p>{t('purchase.done.text', { plan: status.subscription.plan, date: formatDate(status.subscription.ends_at) })}</p>
            {!status.premium_active && <p className="account-warning">{t('purchase.done.deviceNotRegistered')}</p>}
            <p className="settings-note" style={{ marginBottom: 16 }}>{t('account.plan.reference', { ref: status.subscription.payment_reference })}</p>
            <button type="button" className="btn-action btn-primary-fill" onClick={onClose} autoFocus>
              {t('purchase.done.close')}
            </button>
          </>
        ) : (
          <>
            <h2 id="purchase-title" style={{ marginTop: 0 }}>{t('purchase.title')}</h2>
            <div className="settings-card purchase-summary">
              <div>
                <strong>{t(`premium.plan.years${years}`)}</strong>
                <div className="settings-note" style={{ margin: 0 }}>{t('premium.includes.devices')}</div>
              </div>
              <span className="plan-card__price" style={{ margin: 0 }}>{formatClp(plan.priceClp)}</span>
            </div>
            {extending && status?.subscription && (
              <p className="settings-hint">{t('purchase.extends', { date: formatDate(status.subscription.ends_at) })}</p>
            )}
            <div className="account-warning">
              <p style={{ margin: 0 }}>🧪 {t('purchase.simulated')}</p>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn-action" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
              <button type="button" className="btn-action btn-premium" disabled={busy} onClick={() => void confirm()} autoFocus>
                {busy ? t('account.working') : t('purchase.confirm')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
