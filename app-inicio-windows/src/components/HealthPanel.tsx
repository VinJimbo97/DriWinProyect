import { useEffect, useState } from 'react';
import { desktop, type DriverBackupResult, type GhostDevice, type GhostRemovalResult } from '../desktop/bridge';
import type { MessageKey } from '../i18n/translate';
import { useSettings } from '../settings/settingsContext';
import type { PremiumFeature } from '../settings/settings';
import { HelpTip } from './HelpTip';

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

/** Nombre legible de la clase de dispositivo de Windows. */
const CLASS_KEYS: Record<string, MessageKey> = {
  usb: 'health.class.usb',
  usbdevice: 'health.class.usb',
  hidclass: 'health.class.input',
  mouse: 'health.class.input',
  keyboard: 'health.class.input',
  bluetooth: 'health.class.bluetooth',
  net: 'health.class.net',
  monitor: 'health.class.monitor',
  diskdrive: 'health.class.disk',
  wpd: 'health.class.phone',
  image: 'health.class.camera',
  camera: 'health.class.camera',
  media: 'health.class.audio',
  audioendpoint: 'health.class.audio',
  ports: 'health.class.ports',
  printer: 'health.class.printer',
  smartcardreader: 'health.class.smartcard',
};

/** Aviso de función bloqueada (sin Premium o desactivada en Configuración). */
function useLock(feature: PremiumFeature): string | null {
  const { t, premiumActive, isFeatureEnabled } = useSettings();
  if (!desktop) return t('health.desktopOnly');
  if (!premiumActive) return `🔒 ${t('settings.premium.locked')}`;
  if (!isFeatureEnabled(feature)) return t('premium.disabledInSettings');
  return null;
}

function DriverBackupCard() {
  const { t } = useSettings();
  const lock = useLock('driverBackup');
  const [folder, setFolder] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DriverBackupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void desktop?.getBackupDefaultFolder().then(setFolder).catch(() => {});
  }, []);

  const choose = async () => {
    const chosen = await desktop?.chooseBackupFolder().catch(() => null);
    if (chosen) setFolder(chosen);
  };

  const run = async () => {
    if (!desktop || !folder) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await desktop.backupDrivers(folder));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`settings-card health-card ${lock ? 'locked' : ''}`}>
      <h3>
        {t('premium.feature.driverBackup')}
        <HelpTip title={t('premium.feature.driverBackup')}>{t('health.backup.help')}</HelpTip>
        {lock && <span className="lock-badge">{lock}</span>}
      </h3>
      <p className="settings-hint">{t('premium.feature.driverBackup.desc')}</p>
      <div className="health-folder">
        <span className="health-folder__path" title={folder ?? ''}>{folder ?? '…'}</span>
        <button type="button" className="btn-action" disabled={Boolean(lock) || busy} onClick={() => void choose()}>
          {t('health.backup.change')}
        </button>
      </div>
      <div className="health-actions">
        <button type="button" className="btn-action btn-premium" disabled={Boolean(lock) || busy || !folder} onClick={() => void run()}>
          {busy ? t('health.backup.running') : t('health.backup.run')}
        </button>
        {busy && <span className="settings-note" style={{ margin: 0 }}>{t('health.uacNote')}</span>}
      </div>
      {result?.ok && (
        <div className="bloat-empty health-result" role="status">
          {t('health.backup.done', { count: result.driverCount })}
          <button type="button" className="link-button" onClick={() => void desktop?.openBackupFolder().catch(() => {})}>
            {t('health.backup.open')}
          </button>
        </div>
      )}
      {result && !result.ok && <p className="form-error" role="alert">{result.message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}

function GhostDevicesCard() {
  const { t } = useSettings();
  const lock = useLock('removeGhostDevices');
  const [devices, setDevices] = useState<GhostDevice[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<'scan' | 'remove' | null>(null);
  const [result, setResult] = useState<GhostRemovalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = async () => {
    if (!desktop) return;
    setBusy('scan');
    setError(null);
    try {
      const found = await desktop.detectGhostDevices();
      setDevices(found);
      setSelected(new Set(found.map((device) => device.instanceId)));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!desktop) return;
    setBusy('remove');
    setError(null);
    setResult(null);
    try {
      setResult(await desktop.removeGhostDevices([...selected]));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
    await scan();
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className={`settings-card health-card ${lock ? 'locked' : ''}`}>
      <h3>
        {t('premium.feature.removeGhostDevices')}
        <HelpTip title={t('premium.feature.removeGhostDevices')}>{t('health.ghost.help')}</HelpTip>
        {lock && <span className="lock-badge">{lock}</span>}
      </h3>
      <p className="settings-hint">{t('premium.feature.removeGhostDevices.desc')}</p>
      <div className="health-actions">
        <button type="button" className="btn-action" disabled={Boolean(lock) || busy !== null} onClick={() => void scan()}>
          {busy === 'scan' ? t('health.ghost.scanning') : devices ? t('health.ghost.rescan') : t('health.ghost.scan')}
        </button>
      </div>

      {result?.ok && (
        <div className="bloat-empty health-result" role="status">
          {t('health.ghost.done', { removed: result.removed })}
          {result.failed > 0 && ` ${t('health.ghost.someFailed', { failed: result.failed })}`}
        </div>
      )}
      {result && !result.ok && <p className="form-error" role="alert">{result.message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      {devices && devices.length === 0 && <div className="bloat-empty">{t('health.ghost.none')}</div>}
      {devices && devices.length > 0 && (
        <>
          <ul className="queue-list">
            {devices.map((device) => (
              <li key={device.instanceId} className="queue-list__item">
                <input
                  type="checkbox"
                  checked={selected.has(device.instanceId)}
                  disabled={Boolean(lock) || busy !== null}
                  aria-label={device.name}
                  onChange={() => toggle(device.instanceId)}
                />
                <div className="queue-list__info">
                  <strong>{device.name}</strong>
                  <div className="settings-note" style={{ margin: 0 }}>
                    {CLASS_KEYS[device.deviceClass.toLowerCase()] ? t(CLASS_KEYS[device.deviceClass.toLowerCase()]) : device.deviceClass}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="health-actions">
            <button
              type="button"
              className="btn-action btn-premium"
              disabled={Boolean(lock) || busy !== null || selected.size === 0}
              onClick={() => void remove()}
            >
              {busy === 'remove' ? t('health.ghost.removing') : t('health.ghost.remove', { count: selected.size })}
            </button>
            {busy === 'remove' && <span className="settings-note" style={{ margin: 0 }}>{t('health.uacNote')}</span>}
          </div>
        </>
      )}
    </section>
  );
}

/** Pestaña "Chequeo de salud" (Premium): respaldo de drivers y dispositivos desconectados. */
export function HealthPanel({ onSeePlans }: { onSeePlans: () => void }) {
  const { t, premiumActive } = useSettings();
  return (
    <div className="settings-content" style={{ flex: 1 }}>
      <h2>👑 {t('health.title')}</h2>
      <p className="settings-hint" style={{ maxWidth: 720 }}>{t('health.intro')}</p>
      {!premiumActive && (
        <div className="account-warning" style={{ maxWidth: 720 }}>
          <p style={{ margin: 0 }}>{t('health.locked')}</p>
          <button type="button" className="btn-action btn-premium" onClick={onSeePlans}>{t('settings.premium.seePlans')}</button>
        </div>
      )}
      <DriverBackupCard />
      <GhostDevicesCard />
    </div>
  );
}
