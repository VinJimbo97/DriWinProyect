import type { MessageKey } from '../i18n/translate';
import { FEATURED_PLAN_YEARS, formatClp, monthlyEquivalent, PREMIUM_PLANS, savingsVsYearly } from '../premium/plans';
import { useSettings } from '../settings/settingsContext';
import { PREMIUM_FEATURES } from '../settings/settings';

/**
 * Pestaña Premium: los tres planes de suscripción y lo que incluyen.
 * La compra todavía no existe (falta la cuenta DriWin): el botón queda deshabilitado.
 */
export function PremiumPanel() {
  const { t } = useSettings();

  const includes: MessageKey[] = [
    ...PREMIUM_FEATURES.map((feature) => `premium.feature.${feature}` as const),
    'premium.includes.support',
    'premium.includes.devices',
  ];

  return (
    <div className="premium-page">
      <h2>{t('premium.title')}</h2>
      <p className="premium-subtitle">{t('premium.subtitle')}</p>

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
              <button type="button" className={`btn-action ${featured ? 'btn-premium' : ''}`} disabled>
                {t('premium.plan.soon')}
              </button>
            </div>
          );
        })}
      </div>
      <p className="settings-note" style={{ textAlign: 'center' }}>{t('premium.plan.soonNote')}</p>

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
