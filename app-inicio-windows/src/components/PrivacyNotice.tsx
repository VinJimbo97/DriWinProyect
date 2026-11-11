import { useEffect } from 'react';
import { PRIVACY_NOTICE_VERSION, PRIVACY_SECTIONS, SUPPORT_EMAIL } from '../privacy/notice';
import { useSettings } from '../settings/settingsContext';

/**
 * Texto del aviso de privacidad (Ley 19.628 / Ley 21.719), por secciones.
 * Se muestra dentro de "Mi cuenta" (al crear la cuenta o al aceptar una versión
 * nueva) y como ventana propia desde Configuración → General, sin cuenta.
 */
export function PrivacyNotice({ headingId }: { headingId?: string }) {
  const { t } = useSettings();
  return (
    <div className="privacy-notice">
      <h2 id={headingId} style={{ margin: '0 0 2px 0' }}>{t('privacy.title')}</h2>
      <p className="privacy-notice__version">{t('privacy.version', { version: PRIVACY_NOTICE_VERSION })}</p>
      <section>
        <p>{t('privacy.intro')}</p>
      </section>
      {PRIVACY_SECTIONS.map((id) => (
        <section key={id}>
          <h3>{t(`privacy.${id}.title`)}</h3>
          <p>{t(`privacy.${id}.body`, { email: SUPPORT_EMAIL })}</p>
        </section>
      ))}
    </div>
  );
}

/** Ventana independiente (Configuración → General → Aviso de privacidad). */
export function PrivacyNoticeDialog({ onClose }: { onClose: () => void }) {
  const { t } = useSettings();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay-modal" onMouseDown={onClose}>
      <div
        className="modal-box privacy-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="dialog-close" aria-label={t('common.close')} title={t('common.close')} onClick={onClose}>
          ✕
        </button>
        <PrivacyNotice headingId="privacy-dialog-title" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-action" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
