import { useEffect, useState } from 'react';
import type { DriverInstallRequest, QueueItem } from '../desktop/bridge';
import { useInstallQueue } from '../hooks/useInstallQueue';
import type { MessageKey } from '../i18n/translate';
import { useSettings } from '../settings/settingsContext';

export interface QueueCandidate {
  kind: 'driver' | 'app';
  /** driverId o id de winget (igual que en la cola de Electron). */
  id: string;
  name: string;
  detail: string;
  driver?: DriverInstallRequest;
}

const STATUS_KEY: Record<QueueItem['status'], MessageKey> = {
  pending: 'installAll.status.pending',
  downloading: 'installAll.status.downloading',
  verifying: 'installAll.status.verifying',
  ready: 'installAll.status.ready',
  installing: 'installAll.status.installing',
  done: 'installAll.status.done',
  failed: 'installAll.status.failed',
};

/**
 * "Instalar todo" (Premium): elige qué drivers y apps instalar, pide UN permiso
 * de administrador y abre los instaladores uno tras otro.
 */
export function InstallAllDialog({ candidates, onClose }: { candidates: QueueCandidate[]; onClose: () => void }) {
  const { t } = useSettings();
  const queue = useInstallQueue();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(candidates.map((c) => `${c.kind}:${c.id}`)));

  const running = queue.phase === 'running';
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !running && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, onClose]);

  const key = (candidate: { kind: string; id: string }) => `${candidate.kind}:${candidate.id}`;
  const chosen = candidates.filter((candidate) => selected.has(key(candidate)));

  const start = () => {
    void queue.run({
      drivers: chosen.filter((c) => c.kind === 'driver' && c.driver).map((c) => c.driver as DriverInstallRequest),
      apps: chosen.filter((c) => c.kind === 'app').map((c) => c.id),
    });
  };

  const statusOf = (candidate: QueueCandidate) => queue.items.find((item) => key(item) === key(candidate));
  const done = queue.items.filter((item) => item.status === 'done').length;
  const failed = queue.items.filter((item) => item.status === 'failed').length;
  const reboot = queue.items.some((item) => item.rebootRequired);
  const visible = queue.phase === 'idle' ? candidates : chosen;

  return (
    <div className="overlay-modal" onMouseDown={() => !running && onClose()}>
      <div
        className="modal-box account-dialog install-all-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-all-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {!running && (
          <button type="button" className="dialog-close" aria-label={t('common.close')} title={t('common.close')} onClick={onClose}>
            ✕
          </button>
        )}
        <h2 id="install-all-title" style={{ marginTop: 0 }}>👑 {t('installAll.title')}</h2>

        {queue.phase === 'idle' && (
          <>
            <p className="settings-hint">{t('installAll.intro')}</p>
            {candidates.length === 0 && <div className="bloat-empty">{t('installAll.nothing')}</div>}
          </>
        )}
        {running && <div className="account-warning"><p style={{ margin: 0 }}>{t('installAll.runningNote')}</p></div>}
        {queue.phase === 'finished' && (
          <div className={failed > 0 ? 'account-warning' : 'bloat-empty'} role="status">
            <div>
              <div>{queue.error ?? t('installAll.summary', { done, failed })}</div>
              {reboot && <div style={{ marginTop: 4, fontWeight: 600 }}>{t('installAll.reboot')}</div>}
            </div>
          </div>
        )}

        <ul className="queue-list">
          {visible.map((candidate) => {
            const item = statusOf(candidate);
            return (
              <li key={key(candidate)} className={`queue-list__item ${item ? `is-${item.status}` : ''}`}>
                {queue.phase === 'idle' ? (
                  <input
                    type="checkbox"
                    checked={selected.has(key(candidate))}
                    aria-label={candidate.name}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(key(candidate))) next.delete(key(candidate));
                        else next.add(key(candidate));
                        return next;
                      })
                    }
                  />
                ) : (
                  <span className="queue-list__icon" aria-hidden="true">
                    {item?.status === 'done' ? '✓' : item?.status === 'failed' ? '✗' : '•'}
                  </span>
                )}
                <div className="queue-list__info">
                  <strong>{candidate.name}</strong>
                  <div className="settings-note" style={{ margin: 0 }}>
                    {candidate.kind === 'driver' ? t('installAll.kind.driver') : t('installAll.kind.app')} · {candidate.detail}
                  </div>
                  {item?.message && <div className="bloat-row__error">{item.message}</div>}
                </div>
                {item && (
                  <span className="queue-list__status">
                    {item.status === 'downloading' && item.percent !== null
                      ? t('drivers.downloadingPercent', { percent: item.percent })
                      : t(STATUS_KEY[item.status])}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
          {queue.phase === 'idle' && (
            <>
              <button type="button" className="btn-action" onClick={onClose}>{t('common.cancel')}</button>
              <button type="button" className="btn-action btn-premium" disabled={chosen.length === 0} onClick={start}>
                {t('installAll.start', { count: chosen.length })}
              </button>
            </>
          )}
          {queue.phase === 'finished' && (
            <button type="button" className="btn-action btn-primary-fill" style={{ width: 'auto' }} onClick={onClose} autoFocus>
              {t('installAll.close')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
