import { useAccount } from '../account/accountContext';
import type { MessageKey } from '../i18n/translate';
import { FEATURED_PLAN_YEARS, formatClp, monthlyEquivalent, PREMIUM_PLANS, savingsVsYearly } from '../premium/plans';
import { useSettings } from '../settings/settingsContext';
import { PREMIUM_FEATURES } from '../settings/settings';

/**
 * Pestaña Premium: los tres planes de suscripción y lo que incluyen.
 * Elegir un plan pide iniciar sesión (si hace falta) y abre el pago simulado.
 */
export function PremiumPanel({ onChoosePlan }: { onChoosePlan: (years: 1 | 2 | 3) => void }) {
  const { t, settings } = useSettings();
  const { status, premiumActive, phase } = useAccount();

  const includes: MessageKey[] = [
    ...PREMIUM_FEATURES.map((feature) => `premium.feature.${feature}` as const),
    'premium.includes.support',
    'premium.includes.devices',
  ];

  const subscription = status?.subscription?.active ? status.subscription : null;
  const endDate = subscription
    ? new Intl.DateTimeFormat(settings.language === 'es' ? 'es-CL' : 'en-US', { dateStyle: 'long' }).format(
        new Date(subscription.ends_at),
      )
    : null;

  return (
    <div className="premium-page">
      <h2>{t('premium.title')}</h2>
      <p className="premium-subtitle">{t('premium.subtitle')}</p>

      {subscription && (
        <div className={`premium-current ${premiumActive ? '' : 'warning'}`} role="status">
          {premiumActive
            ? t('premium.current.active', { plan: subscription.plan, date: endDate ?? '' })
            : t('premium.current.notThisDevice', { plan: subscription.plan })}
        </div>
      )}

      <div className="plan-grid">
        {PREMIUM_PLANS.map((plan) => {
          const savings = savingsVsYearly(plan);
          const featured = plan.years === FEATURED_PLAN_YEARS;
          return (
            <div key={plan.years} className={`plan-card ${featured ? 'featured' : ''}`}>
              {featured && <span className="plan-card__tag">{t('premium.plan.popular')}</span>}
              <h3>{t(`premium.plan.years${plan.years}`)}</h3>
              <p className="plan-card__price">{formatClp(plan.priceClp)}</p>
              <p className="plan-card__detail">
                {t('premium.plan.perMonth', { price: formatClp(monthlyEquivalent(plan)) })}
              </p>
              <p className="plan-card__save">{savings > 0 ? t('premium.plan.save', { price: formatClp(savings) }) : ''}</p>
              <button
                type="button"
                className={`btn-action ${featured ? 'btn-premium' : ''}`}
                disabled={phase === 'loading'}
                title={phase === 'signedIn' ? t('premium.plan.chooseHint') : t('premium.plan.loginHint')}
                onClick={() => onChoosePlan(plan.years)}
              >
                {subscription ? t('premium.plan.extend') : t('premium.plan.choose')}
              </button>
            </div>
          );
        })}
      </div>
      <p className="settings-note" style={{ textAlign: 'center' }}>{t('premium.plan.simulatedNote')}</p>

      <div className="premium-includes">
        <h3>{t('premium.includes')}</h3>
        <ul>
          {includes.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
