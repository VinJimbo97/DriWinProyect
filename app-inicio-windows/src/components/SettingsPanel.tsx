import { useState } from 'react';
import { useAccount } from '../account/accountContext';
import { desktop } from '../desktop/bridge';
import type { MessageKey } from '../i18n/translate';
import { SCAN_SOURCES } from '../scanner';
import { useSettings } from '../settings/settingsContext';
import { LANGUAGES, THEME_PREFERENCES, type PremiumFeature } from '../settings/settings';

type Section = 'general' | 'profile' | 'premium' | 'advanced';

const SECTIONS: Section[] = ['general', 'profile', 'premium', 'advanced'];

/** Funciones Premium agrupadas como se muestran en Configuración → Premium. */
const FEATURE_GROUPS: { title: MessageKey; features: PremiumFeature[] }[] = [
  { title: 'settings.premium.group.install', features: ['installAll'] },
  { title: 'settings.premium.group.optimize', features: ['highRiskCleanup'] },
  {
    title: 'settings.premium.group.health',
    features: ['driverBackup', 'removeGhostDevices'],
  },
];

interface Props {
  profileTitle: string;
  onRetakeQuiz: () => void;
  fixtureId: string;
  onChangeFixture: (id: string) => void;
  onSeePlans: () => void;
  onOpenAccount: () => void;
}

/** Pestaña de Configuración: menú de apartados a la izquierda y su contenido a la derecha. */
export function SettingsPanel({ profileTitle, onRetakeQuiz, fixtureId, onChangeFixture, onSeePlans, onOpenAccount }: Props) {
  const { t, settings, setLanguage, setTheme, setPremiumFeature, premiumActive } = useSettings();
  const { phase, status } = useAccount();
  const subscription = status?.subscription?.active ? status.subscription : null;
  const endDate = subscription
    ? new Intl.DateTimeFormat(settings.language === 'es' ? 'es-CL' : 'en-US', { dateStyle: 'long' }).format(
        new Date(subscription.ends_at),
      )
    : null;
  const [section, setSection] = useState<Section>('general');

  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label={t('settings.title')}>
        <h2>{t('settings.title')}</h2>
        {SECTIONS.map((id) => (
          <button
            key={id}
            type="button"
            className={`settings-nav__item ${section === id ? 'active' : ''} ${id === 'premium' ? 'premium' : ''}`}
            aria-current={section === id ? 'page' : undefined}
            onClick={() => setSection(id)}
          >
            {t(`settings.section.${id}`)}
            {id === 'premium' && <span aria-hidden="true">👑</span>}
          </button>
        ))}
      </nav>

      <div className="settings-content">
        {section === 'general' && (
          <>
            <h2>{t('settings.section.general')}</h2>
            <div className="settings-card">
              <h3>{t('settings.language')}</h3>
              <p className="settings-hint">{t('settings.languageHint')}</p>
              <div className="segmented" role="radiogroup" aria-label={t('settings.language')}>
                {LANGUAGES.map((language) => (
                  <button
                    key={language}
                    type="button"
                    role="radio"
                    aria-checked={settings.language === language}
                    lang={language}
                    onClick={() => setLanguage(language)}
                  >
                    {t(`settings.language.${language}`)}
                  </button>
                ))}
              </div>
              <p className="settings-note">{t('settings.languageNote')}</p>
            </div>

            <div className="settings-card">
              <h3>{t('settings.theme')}</h3>
              <p className="settings-hint">{t('settings.themeHint')}</p>
              <div className="segmented" role="radiogroup" aria-label={t('settings.theme')}>
                {THEME_PREFERENCES.map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    role="radio"
                    aria-checked={settings.theme === theme}
                    onClick={() => setTheme(theme)}
                  >
                    {t(`settings.theme.${theme}`)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {section === 'profile' && (
          <>
            <h2>{t('settings.section.profile')}</h2>
            <div className="settings-card">
              <h3>{t('settings.activeProfile')}</h3>
              <p className="settings-hint" style={{ fontSize: '0.95rem', opacity: 1, color: 'var(--primary-color)' }}>
                {profileTitle}
              </p>
              <button type="button" className="btn-action" onClick={onRetakeQuiz}>
                {t('settings.retakeQuiz')}
              </button>
              <p className="settings-note">{t('settings.adminNote')}</p>
            </div>
          </>
        )}

        {section === 'premium' && (
          <>
            <h2>{t('settings.section.premium')}</h2>
            <div className="settings-card plan-status">
              <div>
                <h3>{t('settings.premium.statusTitle')}</h3>
                <span className={`plan-badge ${premiumActive ? 'active' : 'free'}`}>
                  {premiumActive && subscription ? `👑 ${subscription.plan}` : t('settings.premium.statusFree')}
                </span>
                <p className="settings-note" style={{ marginTop: 10 }}>
                  {premiumActive && endDate
                    ? `${t('account.plan.until', { date: endDate })} · ${t('settings.premium.activeNote')}`
                    : subscription
                      ? t('premium.current.notThisDevice', { plan: subscription.plan })
                      : t('settings.premium.freeNote')}
                </p>
              </div>
              <div className="plan-status__actions">
                {!premiumActive && (
                  <button type="button" className="btn-action btn-premium" onClick={onSeePlans}>
                    {t('settings.premium.seePlans')}
                  </button>
                )}
                <button type="button" className="btn-action" onClick={onOpenAccount}>
                  {phase === 'signedIn' ? t('account.myAccount') : t('account.login.tab')}
                </button>
              </div>
            </div>

            {FEATURE_GROUPS.map((group) => (
              <section key={group.title}>
                <h3 className="feature-group-title">{t(group.title)}</h3>
                {group.features.map((feature) => {
                  const enabled = settings.premiumFeatures[feature];
                  const labelId = `feature-${feature}`;
                  return (
                    <div key={feature} className={`feature-row ${premiumActive ? '' : 'locked'}`}>
                      <div className="feature-row__info">
                        <strong id={labelId}>{t(`premium.feature.${feature}`)}</strong>
                        {!premiumActive && <span className="lock-badge">🔒 {t('settings.premium.locked')}</span>}
                        <div className="feature-row__desc">{t(`premium.feature.${feature}.desc`)}</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        className="switch"
                        aria-checked={premiumActive && enabled}
                        aria-labelledby={labelId}
                        disabled={!premiumActive}
                        onClick={() => setPremiumFeature(feature, !enabled)}
                      />
                    </div>
                  );
                })}
              </section>
            ))}
          </>
        )}

        {section === 'advanced' && (
          <>
            <h2>{t('settings.section.advanced')}</h2>
            <div className="settings-card">
              <h3>{t('settings.scanSource')}</h3>
              <p className="settings-hint">
                {desktop ? t('settings.scanSourceDesktop') : t('settings.scanSourceBrowser')}
              </p>
              {SCAN_SOURCES.map((source) => (
                <div key={source.id} className="quiz-option" onClick={() => onChangeFixture(source.id)}>
                  <div>
                    <strong>{source.label}</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', opacity: 0.75 }}>{source.description}</p>
                  </div>
                  <input type="radio" checked={source.id === fixtureId} readOnly />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
