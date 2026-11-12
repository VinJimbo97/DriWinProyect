import { useEffect, useState } from 'react';
import type { ApiRequestError } from './api/client';
import { useAccount } from './account/accountContext';
import { AccountDialog, type AccountView } from './components/AccountDialog';
import { CrownIcon, DeviceIcon, GearIcon, UserIcon } from './components/DeviceIcon';
import { PurchaseDialog } from './components/PurchaseDialog';
import { HealthPanel } from './components/HealthPanel';
import { InstallAllDialog, type QueueCandidate } from './components/InstallAllDialog';
import { deviceKind } from './components/deviceKind';
import { AppIcon } from './components/AppIcon';
import type { ProfileName } from './api/types';
import { BloatwarePanel } from './components/BloatwarePanel';
import { PremiumPanel } from './components/PremiumPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { useAppInstall } from './hooks/useAppInstall';
import { useDriverInstall } from './hooks/useDriverInstall';
import { useDriverRecommendations } from './hooks/useDriverRecommendations';
import { useHardwareScan } from './hooks/useHardwareScan';
import { useRecommendedApps } from './hooks/useRecommendedApps';
import { desktop } from './desktop/bridge';
import type { Translate } from './i18n/translate';
import { DEFAULT_SOURCE_ID, NATIVE_SOURCE_ID, SCAN_SOURCES } from './scanner';
import { driverUpdateState } from './scanner/driverVersion';
import { useSettings } from './settings/settingsContext';
import './styles/theme.css';

// Tipos según diagrama de flujo
type TabType = 'driwin' | 'apps' | 'optimizar' | 'salud' | 'configuracion' | 'premium';

const FIXTURE_STORAGE_KEY = 'driwin_fixture';

function loadSavedFixture(): string {
  try {
    const saved = localStorage.getItem(FIXTURE_STORAGE_KEY);
    return SCAN_SOURCES.some((source) => source.id === saved) ? (saved as string) : DEFAULT_SOURCE_ID;
  } catch {
    return DEFAULT_SOURCE_ID;
  }
}

/**
 * Opciones del cuestionario, en orden. Cada id es el nombre exacto en
 * user_profiles (lo que viaja a la API); los textos salen del diccionario
 * (profile.<id>.label / title / hint).
 */
const PROFILE_IDS: ProfileName[] = ['Gamer', 'Developer', 'Creator', 'Office'];

const PROFILES_STORAGE_KEY = 'driwin_profiles';

function loadSavedProfiles(): ProfileName[] | null {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return PROFILE_IDS.filter((id) => parsed.includes(id));
  } catch {
    return null;
  }
}

function profilesTitle(profiles: ProfileName[], t: Translate): string {
  if (profiles.length === 0) {
    return t('profile.standard');
  }
  return PROFILE_IDS.filter((id) => profiles.includes(id))
    .map((id) => t(`profile.${id}.label`))
    .join(' & ');
}

/** Segundos de carga tras los cuales se explica que el servidor puede estar despertando. */
const SLOW_LOADING_MS = 5_000;

/**
 * "Cargando..." que, si tarda, explica por qué: el servidor (App Service F1) se
 * suspende sin uso y tardó ~54 s en despertar (medido). Sin esta nota la persona
 * ve casi un minuto de espera sin explicación y cree que la app se colgó.
 */
function LoadingServer() {
  const { t } = useSettings();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_LOADING_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div role="status" aria-live="polite">
      <p style={{ opacity: 0.7, marginBottom: 4 }}>{t('common.loadingServer')}</p>
      {slow && <p className="settings-note" style={{ marginTop: 0 }}>{t('common.loadingSlow')}</p>}
    </div>
  );
}

/** Mensaje de carga / error con botón de reintento para los datos de la API. */
function ApiStatus({ status, error, onRetry }: { status: string; error: ApiRequestError | null; onRetry: () => void }) {
  const { t } = useSettings();
  if (status === 'loading') {
    return <LoadingServer />;
  }
  if (status === 'error' && error) {
    return (
      <div style={{ border: '1px solid var(--danger-color)', borderRadius: '8px', padding: '12px', marginTop: '15px' }}>
        <p style={{ margin: 0, color: 'var(--danger-color)' }}>{error.message}</p>
        <p style={{ margin: '4px 0 10px 0', fontSize: '0.75rem', opacity: 0.6 }}>
          {t('common.errorCode', { code: error.code })}{error.requestId ? ` · requestId: ${error.requestId}` : ''}
        </p>
        <button className="btn-action" onClick={onRetry}>{t('common.retry')}</button>
      </div>
    );
  }
  return null;
}

export default function App() {
  const { t, premiumActive, isFeatureEnabled } = useSettings();
  const account = useAccount();

  // Cuenta: recuadro de la cuenta, plan elegido antes de iniciar sesión y compra en curso.
  const [accountDialog, setAccountDialog] = useState<AccountView | 'default' | null>(null);
  const [pendingPlan, setPendingPlan] = useState<1 | 2 | 3 | null>(null);
  const [purchaseYears, setPurchaseYears] = useState<1 | 2 | 3 | null>(null);
  const [installAllOpen, setInstallAllOpen] = useState(false);

  const choosePlan = (years: 1 | 2 | 3) => {
    if (account.phase === 'signedIn') {
      setPurchaseYears(years);
    } else {
      setPendingPlan(years);
      setAccountDialog('auth');
    }
  };

  // Estado de arranque (Onboarding)
  // Sesión previa guardada en localStorage (null = usuario nuevo)
  const [savedProfiles] = useState<ProfileName[] | null>(loadSavedProfiles);
  const isNewUser = savedProfiles === null;
  const [showQuiz, setShowQuiz] = useState<boolean>(isNewUser);

  // Perfiles marcados en el cuestionario (borrador) y perfiles ya confirmados
  const [selectedProfiles, setSelectedProfiles] = useState<ProfileName[]>(savedProfiles ?? []);
  const [activeProfiles, setActiveProfiles] = useState<ProfileName[]>(savedProfiles ?? []);
  const activeProfileTitle = profilesTitle(activeProfiles, t);

  // Navegación de pestañas
  const [activeTab, setActiveTab] = useState<TabType>('driwin');

  // Equipo simulado (Hardware Mock Fixture) que "escanea" la app
  const [fixtureId, setFixtureId] = useState<string>(loadSavedFixture);

  // Escaneo de hardware: arranca al abrir la app, en paralelo al cuestionario
  const scan = useHardwareScan(fixtureId);
  const parallelScanDone = scan.status === 'success';

  // Datos traídos desde server-api mediante hooks
  const driverRecs = useDriverRecommendations(scan.data, activeProfiles);
  const apps = useRecommendedApps(activeProfiles);
  const appInstall = useAppInstall(apps.status === 'success' ? apps.data.data : undefined);

  // Instalación real de drivers: sólo en la app de escritorio y sobre el equipo real
  const driverInstall = useDriverInstall();
  const canInstallDrivers = desktop !== undefined && fixtureId === NATIVE_SOURCE_ID;

  // "Instalar todo" (Premium): drivers por actualizar con huella + apps que faltan.
  const queueCandidates: QueueCandidate[] = [];
  if (canInstallDrivers && driverRecs.status === 'success') {
    const seen = new Set<number>();
    for (const item of driverRecs.data) {
      if (!item.ok) continue;
      const { recommendation } = item.recommendation;
      const state = driverUpdateState(item.device.ven_id, item.device.current_version, recommendation.version_number);
      if (state === 'current' || !recommendation.sha256 || seen.has(recommendation.driver_id)) continue;
      seen.add(recommendation.driver_id);
      queueCandidates.push({
        kind: 'driver',
        id: String(recommendation.driver_id),
        name: item.device.name,
        detail: `${recommendation.edition_name} ${recommendation.version_number} · ${recommendation.file_size_mb} MB`,
        driver: { driverId: recommendation.driver_id, downloadUrl: recommendation.download_url, sha256: recommendation.sha256 },
      });
    }
  }
  if (appInstall.available && apps.status === 'success') {
    for (const app of apps.data.data) {
      const id = app.winget_id;
      if (!id || appInstall.installed[id] === true || appInstall.unsupported.has(id)) continue;
      queueCandidates.push({ kind: 'app', id, name: app.app_name, detail: app.category });
    }
  }
  const installAllLock = !desktop
    ? t('installAll.desktopOnly')
    : !premiumActive
      ? t('settings.premium.locked')
      : !isFeatureEnabled('installAll')
        ? t('premium.disabledInSettings')
        : null;

  const handleProfileToggle = (profile: ProfileName) => {
    if (selectedProfiles.includes(profile)) {
      setSelectedProfiles(selectedProfiles.filter(p => p !== profile));
    } else {
      setSelectedProfiles([...selectedProfiles, profile]);
    }
  };

  const completeQuiz = () => {
    setActiveProfiles(selectedProfiles);
    try {
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(selectedProfiles));
    } catch {
      /* sin almacenamiento local el perfil dura sólo esta sesión */
    }
    setShowQuiz(false);
  };

  const changeFixture = (id: string) => {
    setFixtureId(id);
    try {
      localStorage.setItem(FIXTURE_STORAGE_KEY, id);
    } catch {
      /* sin almacenamiento local el equipo elegido dura sólo esta sesión */
    }
  };

  return (
    <div className="window-container">

      {/* Modal Onboarding: Cuestionario de Perfil con Shell en Paralelo */}
      {showQuiz && (
        <div className="overlay-modal">
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>{t('quiz.title')}</h2>
              <span style={{ fontSize: '0.8rem', color: parallelScanDone ? 'var(--success-color)' : 'var(--primary-color)' }}>
                {parallelScanDone ? t('quiz.scanDone') : t('quiz.scanning')}
              </span>
            </div>
            <p style={{ opacity: 0.8, fontSize: '0.9rem', marginBottom: '20px' }}>
              {t('quiz.intro')}
            </p>

            {PROFILE_IDS.map(id => (
              <div key={id} className="quiz-option" onClick={() => handleProfileToggle(id)}>
                <div>
                  <strong>{t(`profile.${id}.title`)}</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', opacity: 0.75 }}>{t(`profile.${id}.hint`)}</p>
                </div>
                <input type="checkbox" checked={selectedProfiles.includes(id)} readOnly />
              </div>
            ))}

            <button
              className="btn-action"
              style={{ width: '100%', marginTop: '15px', padding: '12px', background: 'var(--primary-color)', color: 'var(--on-primary)' }}
              onClick={completeQuiz}
            >
              {t('quiz.confirm')}
            </button>
          </div>
        </div>
      )}

      {/* --- BARRA SUPERIOR (HEADER) --- */}
      <div className="titlebar">
        <div className="nav-tabs">
          <button className={`tab-btn ${activeTab === 'driwin' ? 'active' : ''}`} onClick={() => setActiveTab('driwin')}>
            {t('tabs.driwin')}
          </button>
          <button className={`tab-btn ${activeTab === 'apps' ? 'active' : ''}`} onClick={() => setActiveTab('apps')}>
            {t('tabs.apps')}
          </button>
          <button className={`tab-btn ${activeTab === 'optimizar' ? 'active' : ''}`} onClick={() => setActiveTab('optimizar')}>
            {t('tabs.optimize')}
          </button>
          <button
            className={`tab-btn ${activeTab === 'salud' ? 'active' : ''}`}
            title={t('health.title')}
            onClick={() => setActiveTab('salud')}
          >
            {t('tabs.health')}
            <span className="tab-crown" aria-hidden="true">👑</span>
          </button>
        </div>

        <div className="window-controls">
          {/* Cuenta, Configuración y Premium, junto a los controles de ventana */}
          <button
            className={`bar-btn account-btn ${accountDialog ? 'active' : ''}`}
            title={account.phase === 'signedIn' && account.status ? `${t('account.myAccount')} · ${account.status.email}` : t('account.login.tab')}
            aria-label={account.phase === 'signedIn' ? t('account.myAccount') : t('account.login.tab')}
            onClick={() => setAccountDialog('default')}
          >
            <UserIcon />
            {account.phase === 'signedIn' && (
              <span className={`account-dot ${account.premiumActive ? 'premium' : ''}`} aria-hidden="true" />
            )}
          </button>
          <button
            className={`bar-btn ${activeTab === 'configuracion' ? 'active' : ''}`}
            title={t('bar.settings')}
            aria-label={t('bar.settings')}
            onClick={() => setActiveTab('configuracion')}
          >
            <GearIcon />
          </button>
          <button
            className={`bar-btn premium ${activeTab === 'premium' ? 'active' : ''}`}
            title={t('bar.premiumTitle')}
            onClick={() => setActiveTab('premium')}
          >
            <CrownIcon />
            <span>{t('bar.premium')}</span>
          </button>
          <span className="bar-divider" />
          <button className="win-btn" title={t('window.minimize')} onClick={() => desktop?.minimizeWindow()}>─</button>
          <button className="win-btn" title={t('window.maximize')} onClick={() => desktop?.toggleMaximizeWindow()}>□</button>
          <button
            className="win-btn close"
            title={t('window.close')}
            onClick={() => (desktop ? desktop.closeWindow() : alert(t('window.closingBrowser')))}
          >
            ✕
          </button>
        </div>
      </div>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <div className="content-area">

        {/* PESTAÑA 1: DASHBOARD DE DRIVERS (Según tu boceto) */}
        {activeTab === 'driwin' && (
          <div className="split-view">
            {/* Columna Izquierda: Drivers Actuales */}
            <div className="column-panel">
              <h2 style={{ borderBottom: '1px solid rgba(0,173,181,0.3)', paddingBottom: '10px' }}>{t('drivers.currentTitle')}</h2>
              {scan.status === 'loading' && <p style={{ opacity: 0.7 }}>{t('drivers.scanning')}</p>}
              {scan.status === 'error' && <ApiStatus status={scan.status} error={scan.error} onRetry={scan.reload} />}
              {scan.status === 'success' && (
                <div style={{ marginTop: '15px' }}>
                  {scan.data.devices.map(device => (
                    <div key={device.instance_id} className="driver-row">
                      <DeviceIcon kind={deviceKind(device.category, device.name)} />
                      <div className="driver-info">
                        <div style={{ fontWeight: 'bold' }}>{device.name}</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{t('drivers.installedVersion', { version: device.current_version })}</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{device.category} · VEN_{device.ven_id} DEV_{device.dev_id}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Columna Derecha: Drivers Actualizar según perfil */}
            <div className="column-panel">
              <h2 style={{ borderBottom: '1px solid rgba(0,173,181,0.3)', paddingBottom: '10px' }}>
                {t('drivers.updateTitle')}
                <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 'normal', marginTop: '4px' }}>
                  {t('drivers.byProfile', { profile: activeProfileTitle })}
                </span>
              </h2>

              <div className="install-all-bar">
                <button
                  type="button"
                  className="btn-action btn-premium"
                  title={installAllLock ?? t('installAll.hint')}
                  disabled={desktop !== undefined && premiumActive && !isFeatureEnabled('installAll')}
                  onClick={() => (premiumActive ? setInstallAllOpen(true) : setActiveTab('premium'))}
                >
                  {premiumActive ? '👑' : '🔒'} {t('installAll.title')}
                </button>
                <span className="settings-note" style={{ margin: 0 }}>
                  {installAllLock ?? t('installAll.hint')}
                </span>
              </div>

              {scan.status === 'success' && driverRecs.status === 'idle' && (
                <p style={{ opacity: 0.7 }}>{t('drivers.needQuiz')}</p>
              )}
              {scan.status === 'loading' && <p style={{ opacity: 0.7 }}>{t('drivers.waitingScan')}</p>}
              <ApiStatus status={driverRecs.status} error={driverRecs.error} onRetry={driverRecs.reload} />

              {driverRecs.status === 'success' && (
                <div style={{ marginTop: '15px' }}>
                  {driverRecs.data.map(item => {
                    if (!item.ok) {
                      return (
                        <div key={item.device.instance_id} className="driver-row" style={{ opacity: 0.55 }}>
                          <DeviceIcon kind={deviceKind(item.device.category, item.device.name)} muted />
                          <div className="driver-info">
                            <div style={{ fontWeight: 'bold' }}>{item.device.name}</div>
                            <div style={{ fontSize: '0.8rem' }}>
                              {item.error.status === 404 ? t('drivers.notCataloged') : t('drivers.noDriver')}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const { recommendation } = item.recommendation;
                    const updateState = driverUpdateState(item.device.ven_id, item.device.current_version, recommendation.version_number);
                    const install = driverInstall.states[recommendation.driver_id];
                    const working = install !== undefined && ['downloading', 'verifying', 'installing'].includes(install.stage);

                    let buttonLabel = t('drivers.install');
                    if (updateState === 'current') {
                      buttonLabel = t('drivers.upToDate');
                    } else if (install?.stage === 'done') {
                      buttonLabel = t('drivers.installAgain');
                    } else if (install?.stage === 'downloading') {
                      buttonLabel = install.percent === null
                        ? t('drivers.downloading')
                        : t('drivers.downloadingPercent', { percent: install.percent });
                    } else if (install?.stage === 'verifying') {
                      buttonLabel = t('drivers.verifying');
                    } else if (install?.stage === 'installing') {
                      buttonLabel = t('drivers.installerOpen');
                    } else if (install?.stage === 'error') {
                      buttonLabel = t('common.retry');
                    }

                    let note: string | null = null;
                    if (install?.stage === 'error') {
                      note = install.message;
                    } else if (install?.stage === 'installing') {
                      note = t('drivers.noteInstalling');
                    } else if (install?.stage === 'done') {
                      note = install.rebootRequired ? t('drivers.noteReboot') : t('drivers.noteDone');
                    } else if (updateState !== 'current' && !working) {
                      if (!canInstallDrivers) {
                        note = t('drivers.noteDesktopOnly');
                      } else if (!recommendation.sha256) {
                        note = t('drivers.notePendingVerification');
                      } else if (updateState === 'unknown') {
                        note = t('drivers.noteUnknownVersion');
                      }
                    }

                    const installDisabled =
                      updateState === 'current' || working || driverInstall.busy || !canInstallDrivers || !recommendation.sha256;

                    return (
                      <div key={item.device.instance_id} className="driver-row">
                        <DeviceIcon kind={deviceKind(item.device.category, item.device.name)} />
                        <div className="driver-info">
                          <div style={{ fontWeight: 'bold' }}>{item.device.name}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--primary-color)' }}>
                            {recommendation.edition_name} {recommendation.version_number}
                          </div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                            {t('drivers.profileLine', { profile: recommendation.profile_name, size: recommendation.file_size_mb })}
                            {recommendation.is_whql_certified ? ' · WHQL' : ''}
                          </div>
                          {note && (
                            <div style={{ fontSize: '0.75rem', marginTop: '4px', color: install?.stage === 'error' ? 'var(--danger-color)' : undefined, opacity: install?.stage === 'error' ? 1 : 0.75 }}>
                              {note}
                            </div>
                          )}
                        </div>
                        <button
                          className={`btn-action ${updateState === 'current' ? 'installed' : ''}`}
                          onClick={() => void driverInstall.install(recommendation)}
                          disabled={installDisabled}
                        >
                          {buttonLabel}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA 2: INSTALADOR DE APPS */}
        {activeTab === 'apps' && (
          <div className="column-panel" style={{ width: '100%' }}>
            <h2>{t('apps.title')}</h2>
            <p style={{ opacity: 0.8 }}>{t('apps.subtitle', { profile: activeProfileTitle })}</p>

            {apps.status === 'idle' && (
              <p style={{ opacity: 0.7 }}>{t('apps.needQuiz')}</p>
            )}
            <ApiStatus status={apps.status} error={apps.error} onRetry={apps.reload} />

            {apps.status === 'success' && (
              <>
                <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                  {t('apps.count', { count: apps.data.meta.total })}
                  {appInstall.detecting && t('apps.checkingSuffix')}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px', marginTop: '20px' }}>
                  {apps.data.data.map(app => {
                    const wingetId = app.winget_id;
                    const install = wingetId ? appInstall.states[wingetId] : undefined;
                    const isInstalled = wingetId !== null && appInstall.installed[wingetId] === true;
                    const isUnsupported = wingetId !== null && appInstall.unsupported.has(wingetId);
                    const working = install?.stage === 'installing';

                    let buttonLabel = t('apps.install');
                    let note: string | null = null;
                    let disabled = !appInstall.available || appInstall.busy;
                    let onClick: (() => void) | undefined;

                    if (!wingetId && app.official_url) {
                      const url = app.official_url;
                      buttonLabel = t('apps.officialSite');
                      note = t('apps.noteNotInWinget');
                      disabled = !appInstall.available;
                      onClick = () => appInstall.openOfficialPage(url);
                    } else if (!wingetId || isUnsupported) {
                      buttonLabel = t('apps.notAvailable');
                      note = t('apps.noteUnsupported');
                      disabled = true;
                    } else if (working) {
                      buttonLabel = t('apps.installing');
                      note = t('apps.noteFollowInstaller');
                    } else if (install?.stage === 'error') {
                      buttonLabel = t('common.retry');
                      note = install.message;
                      onClick = () => void appInstall.install(wingetId);
                    } else if (isInstalled) {
                      buttonLabel = t('apps.installed');
                      note = install?.stage === 'done' && install.rebootRequired ? t('apps.noteReboot') : null;
                      disabled = true;
                    } else if (appInstall.detecting) {
                      buttonLabel = t('apps.checking');
                      disabled = true;
                    } else {
                      onClick = () => void appInstall.install(wingetId);
                    }

                    if (!appInstall.available && !note) {
                      note = t('apps.noteDesktopOnly');
                    }

                    return (
                      <div key={app.app_id} className="driver-row">
                        <AppIcon name={app.app_name} />
                        <div className="driver-info">
                          <strong>{app.app_name}</strong>
                          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>
                            {t(wingetId ? 'apps.viaWinget' : 'apps.viaOfficial', { category: app.category })}
                          </p>
                          {note && (
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: install?.stage === 'error' ? 'var(--danger-color)' : undefined, opacity: install?.stage === 'error' ? 1 : 0.75 }}>
                              {note}
                            </p>
                          )}
                        </div>
                        <button
                          className={`btn-action ${isInstalled ? 'installed' : ''}`}
                          onClick={onClick}
                          disabled={disabled || !onClick}
                        >
                          {buttonLabel}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* PESTAÑA 3: OPTIMIZAR WINDOWS (LIMPIEZA DE BLOATWARE) */}
        {activeTab === 'optimizar' && (
          <BloatwarePanel
            key={[...activeProfiles].sort().join(',')}
            profiles={activeProfiles}
            profileTitle={activeProfileTitle}
            renderApiError={(error, onRetry) => <ApiStatus status="error" error={error} onRetry={onRetry} />}
          />
        )}

        {/* PESTAÑA PREMIUM: CHEQUEO DE SALUD */}
        {activeTab === 'salud' && <HealthPanel onSeePlans={() => setActiveTab('premium')} />}

        {/* PESTAÑA 4: CONFIGURACIÓN (apartados: General, Perfil, Premium, Avanzado) */}
        {activeTab === 'configuracion' && (
          <SettingsPanel
            profileTitle={activeProfileTitle}
            onRetakeQuiz={() => setShowQuiz(true)}
            fixtureId={fixtureId}
            onChangeFixture={changeFixture}
            onSeePlans={() => setActiveTab('premium')}
            onOpenAccount={() => setAccountDialog('default')}
          />
        )}

        {/* PESTAÑA 5: PLANES PREMIUM */}
        {activeTab === 'premium' && <PremiumPanel onChoosePlan={choosePlan} />}

      </div>

      {accountDialog && (
        <AccountDialog
          initialView={accountDialog === 'default' ? undefined : accountDialog}
          initialAuthMode={pendingPlan ? 'register' : 'login'}
          onClose={() => {
            setAccountDialog(null);
            setPendingPlan(null);
          }}
          onSignedIn={() => {
            // Si eligió un plan antes de iniciar sesión, sigue directo al pago simulado.
            if (pendingPlan) {
              setAccountDialog(null);
              setPurchaseYears(pendingPlan);
              setPendingPlan(null);
            }
          }}
          onSeePlans={() => {
            setAccountDialog(null);
            setActiveTab('premium');
          }}
        />
      )}

      {purchaseYears && <PurchaseDialog years={purchaseYears} onClose={() => setPurchaseYears(null)} />}

      {installAllOpen && <InstallAllDialog candidates={queueCandidates} onClose={() => setInstallAllOpen(false)} />}
    </div>
  );
}
