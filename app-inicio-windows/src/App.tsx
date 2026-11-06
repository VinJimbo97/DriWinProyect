import { useState } from 'react';
import type { ApiRequestError } from './api/client';
import type { ProfileName } from './api/types';
import { useBloatwareRules } from './hooks/useBloatwareRules';
import { useDriverInstall } from './hooks/useDriverInstall';
import { useDriverRecommendations } from './hooks/useDriverRecommendations';
import { useHardwareScan } from './hooks/useHardwareScan';
import { useRecommendedApps } from './hooks/useRecommendedApps';
import { desktop } from './desktop/bridge';
import { DEFAULT_SOURCE_ID, NATIVE_SOURCE_ID, SCAN_SOURCES } from './scanner';
import { driverUpdateState } from './scanner/driverVersion';
import './styles/theme.css';

// Tipos según diagrama de flujo
type TabType = 'driwin' | 'apps' | 'optimizar' | 'configuracion' | 'premium';

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
 * Opciones del cuestionario. `id` es el nombre exacto en user_profiles
 * (lo que viaja a la API); `label` es lo que ve el usuario.
 */
const PROFILE_OPTIONS: { id: ProfileName; label: string; title: string; hint: string }[] = [
  { id: 'Gamer', label: 'Gamer', title: '🎮 Uso este equipo para jugar (Gamer)', hint: 'Prioridad a drivers Game Ready y baja latencia' },
  { id: 'Developer', label: 'Desarrollador', title: '💻 Uso este equipo para programar (Desarrollador)', hint: 'Drivers de virtualización y puertos seriales COM/UART' },
  { id: 'Creator', label: 'Creador', title: '🎨 Apps de Edición e Ilustración (Creador)', hint: 'Drivers NVIDIA Studio y perfiles de color estables' },
  { id: 'Office', label: 'Oficinista', title: '🏢 Máxima Seguridad y Estabilidad (Oficinista)', hint: 'Drivers WHQL certificados y ahorro energético' },
];

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
    return PROFILE_OPTIONS.map((option) => option.id).filter((id) => parsed.includes(id));
  } catch {
    return null;
  }
}

function profilesTitle(profiles: ProfileName[]): string {
  if (profiles.length === 0) {
    return 'Usuario Estándar';
  }
  return PROFILE_OPTIONS.filter((option) => profiles.includes(option.id))
    .map((option) => option.label)
    .join(' & ');
}

/** Mensaje de carga / error con botón de reintento para los datos de la API. */
function ApiStatus({ status, error, onRetry }: { status: string; error: ApiRequestError | null; onRetry: () => void }) {
  if (status === 'loading') {
    return <p style={{ opacity: 0.7 }}>Cargando desde el servidor...</p>;
  }
  if (status === 'error' && error) {
    return (
      <div style={{ border: '1px solid var(--danger-color)', borderRadius: '8px', padding: '12px', marginTop: '15px' }}>
        <p style={{ margin: 0, color: 'var(--danger-color)' }}>{error.message}</p>
        <p style={{ margin: '4px 0 10px 0', fontSize: '0.75rem', opacity: 0.6 }}>
          Código: {error.code}{error.requestId ? ` · requestId: ${error.requestId}` : ''}
        </p>
        <button className="btn-action" onClick={onRetry}>Reintentar</button>
      </div>
    );
  }
  return null;
}

export default function App() {
  // Estado de arranque (Onboarding)
  // Sesión previa guardada en localStorage (null = usuario nuevo)
  const [savedProfiles] = useState<ProfileName[] | null>(loadSavedProfiles);
  const isNewUser = savedProfiles === null;
  const [showQuiz, setShowQuiz] = useState<boolean>(isNewUser);

  // Perfiles marcados en el cuestionario (borrador) y perfiles ya confirmados
  const [selectedProfiles, setSelectedProfiles] = useState<ProfileName[]>(savedProfiles ?? []);
  const [activeProfiles, setActiveProfiles] = useState<ProfileName[]>(savedProfiles ?? []);
  const activeProfileTitle = profilesTitle(activeProfiles);

  // Navegación de pestañas
  const [activeTab, setActiveTab] = useState<TabType>('driwin');

  // Equipo simulado (Hardware Mock Fixture) que "escanea" la app
  const [fixtureId, setFixtureId] = useState<string>(loadSavedFixture);

  // Escaneo de hardware: arranca al abrir la app, en paralelo al cuestionario
  const scan = useHardwareScan(fixtureId);
  const parallelScanDone = scan.status === 'success';

  // Datos traídos desde server-api mediante hooks
  const driverRecs = useDriverRecommendations(scan.data, activeProfiles);
  const bloatware = useBloatwareRules();
  const apps = useRecommendedApps(activeProfiles);

  // Instalación real de drivers: sólo en la app de escritorio y sobre el equipo real
  const driverInstall = useDriverInstall();
  const canInstallDrivers = desktop !== undefined && fixtureId === NATIVE_SOURCE_ID;

  // Reglas de bloatware que el usuario marcó para eliminar (por bloatware_id)
  const [selectedBloatware, setSelectedBloatware] = useState<Set<number>>(new Set());

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

  const toggleBloatware = (id: number) => {
    setSelectedBloatware(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="window-container">
      
      {/* Modal Onboarding: Cuestionario de Perfil con Shell en Paralelo */}
      {showQuiz && (
        <div className="overlay-modal">
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>Cuestionario de Perfil</h2>
              <span style={{ fontSize: '0.8rem', color: parallelScanDone ? '#2ed573' : 'var(--primary-color)' }}>
                {parallelScanDone ? '● Hardware Escaneado (En Paralelo)' : '○ Escaneando IDs VEN/DEV...'}
              </span>
            </div>
            <p style={{ opacity: 0.8, fontSize: '0.9rem', marginBottom: '20px' }}>
              Selecciona las actividades prioritarias de tu equipo para sugerir los controladores ideales:
            </p>

            {PROFILE_OPTIONS.map(option => (
              <div key={option.id} className="quiz-option" onClick={() => handleProfileToggle(option.id)}>
                <div>
                  <strong>{option.title}</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', opacity: 0.75 }}>{option.hint}</p>
                </div>
                <input type="checkbox" checked={selectedProfiles.includes(option.id)} readOnly />
              </div>
            ))}

            <button 
              className="btn-action" 
              style={{ width: '100%', marginTop: '15px', padding: '12px', background: 'var(--primary-color)', color: '#222831' }}
              onClick={completeQuiz}
            >
              Confirmar y Entrar a DriWin
            </button>
          </div>
        </div>
      )}

      {/* --- BARRA SUPERIOR (HEADER) --- */}
      <div className="titlebar">
        <div className="nav-tabs">
          <button className={`tab-btn ${activeTab === 'driwin' ? 'active' : ''}`} onClick={() => setActiveTab('driwin')}>
            ⚡ DriWin
          </button>
          <button className={`tab-btn ${activeTab === 'apps' ? 'active' : ''}`} onClick={() => setActiveTab('apps')}>
            📦 Apps
          </button>
          <button className={`tab-btn ${activeTab === 'optimizar' ? 'active' : ''}`} onClick={() => setActiveTab('optimizar')}>
            🧹 Optimizar Windows
          </button>
        </div>

        <div className="window-controls">
          <button className="win-btn" title="Minimizar" onClick={() => desktop?.minimizeWindow()}>─</button>
          <button className="win-btn" title="Maximizar" onClick={() => desktop?.toggleMaximizeWindow()}>□</button>
          <button
            className="win-btn close"
            title="Cerrar"
            onClick={() => (desktop ? desktop.closeWindow() : alert('Cerrando DriWin...'))}
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
              <h2 style={{ borderBottom: '1px solid rgba(0,173,181,0.3)', paddingBottom: '10px' }}>Drivers Actuales</h2>
              {scan.status === 'loading' && <p style={{ opacity: 0.7 }}>Escaneando IDs VEN/DEV del equipo...</p>}
              {scan.status === 'error' && <ApiStatus status={scan.status} error={scan.error} onRetry={scan.reload} />}
              {scan.status === 'success' && (
                <div style={{ marginTop: '15px' }}>
                  {scan.data.devices.map(device => (
                    <div key={device.instance_id} className="driver-row">
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{device.name}</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Versión instalada: {device.current_version}</div>
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
                Drivers a Actualizar
                <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 'normal', marginTop: '4px' }}>
                  Según tu perfil: {activeProfileTitle}
                </span>
              </h2>

              {scan.status === 'success' && driverRecs.status === 'idle' && (
                <p style={{ opacity: 0.7 }}>Completa el cuestionario de perfil para ver los drivers recomendados.</p>
              )}
              {scan.status === 'loading' && <p style={{ opacity: 0.7 }}>Esperando el escaneo de hardware...</p>}
              <ApiStatus status={driverRecs.status} error={driverRecs.error} onRetry={driverRecs.reload} />

              {driverRecs.status === 'success' && (
                <div style={{ marginTop: '15px' }}>
                  {driverRecs.data.map(item => {
                    if (!item.ok) {
                      return (
                        <div key={item.device.instance_id} className="driver-row" style={{ opacity: 0.55 }}>
                          <div>
                            <div style={{ fontWeight: 'bold' }}>{item.device.name}</div>
                            <div style={{ fontSize: '0.8rem' }}>
                              {item.error.status === 404 ? 'Hardware no catalogado en DriWin' : 'Sin driver publicado para tu perfil o versión de Windows'}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const { recommendation } = item.recommendation;
                    const updateState = driverUpdateState(item.device.ven_id, item.device.current_version, recommendation.version_number);
                    const install = driverInstall.states[recommendation.driver_id];
                    const working = install !== undefined && ['downloading', 'verifying', 'installing'].includes(install.stage);
                    const done = install?.stage === 'done';

                    let buttonLabel = 'Instalar';
                    if (updateState === 'current') {
                      buttonLabel = '✓ Al día';
                    } else if (install?.stage === 'done') {
                      buttonLabel = '✓ Instalado';
                    } else if (install?.stage === 'downloading') {
                      buttonLabel = install.percent === null ? 'Descargando...' : `Descargando ${install.percent}%`;
                    } else if (install?.stage === 'verifying') {
                      buttonLabel = 'Verificando...';
                    } else if (install?.stage === 'installing') {
                      buttonLabel = 'Instalando...';
                    } else if (install?.stage === 'error') {
                      buttonLabel = 'Reintentar';
                    }

                    let note: string | null = null;
                    if (install?.stage === 'error') {
                      note = install.message;
                    } else if (install?.stage === 'done' && install.rebootRequired) {
                      note = 'Reinicia el equipo para terminar la instalación.';
                    } else if (updateState !== 'current' && !done && !working) {
                      if (!canInstallDrivers) {
                        note = 'La instalación solo está disponible en la app de escritorio, con el equipo real.';
                      } else if (!recommendation.sha256) {
                        note = 'Pendiente de verificación de seguridad.';
                      } else if (updateState === 'unknown') {
                        note = 'No se pudo comparar con tu versión instalada; revísala antes de instalar.';
                      }
                    }

                    const installDisabled =
                      updateState === 'current' || done || working || driverInstall.busy || !canInstallDrivers || !recommendation.sha256;

                    return (
                      <div key={item.device.instance_id} className="driver-row">
                        <div>
                          <div style={{ fontWeight: 'bold' }}>{item.device.name}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--primary-color)' }}>
                            {recommendation.edition_name} {recommendation.version_number}
                          </div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                            Perfil {recommendation.profile_name} · {recommendation.file_size_mb} MB{recommendation.is_whql_certified ? ' · WHQL' : ''}
                          </div>
                          {note && (
                            <div style={{ fontSize: '0.75rem', marginTop: '4px', color: install?.stage === 'error' ? 'var(--danger-color)' : undefined, opacity: install?.stage === 'error' ? 1 : 0.75 }}>
                              {note}
                            </div>
                          )}
                        </div>
                        <button
                          className={`btn-action ${updateState === 'current' || done ? 'installed' : ''}`}
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
            <h2>Instalador de Software</h2>
            <p style={{ opacity: 0.8 }}>Aplicaciones recomendadas para tu entorno configurado ({activeProfileTitle}):</p>

            {apps.status === 'idle' && (
              <p style={{ opacity: 0.7 }}>Completa el cuestionario de perfil para ver aplicaciones recomendadas.</p>
            )}
            <ApiStatus status={apps.status} error={apps.error} onRetry={apps.reload} />

            {apps.status === 'success' && (
              <>
                <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                  {apps.data.meta.total} aplicaciones · {apps.data.meta.total_size_mb} MB en total
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px', marginTop: '20px' }}>
                  {apps.data.data.map(app => (
                    <div key={app.app_id} className="driver-row">
                      <div>
                        <strong>{app.app_name}</strong>
                        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>
                          {app.category} · v{app.version_number} · {app.file_size_mb} MB
                        </p>
                      </div>
                      <button className="btn-action">Instalar</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* PESTAÑA 3: OPTIMIZAR WINDOWS (LIMPIEZA DE BLOATWARE) */}
        {activeTab === 'optimizar' && (
          <div className="column-panel" style={{ width: '100%' }}>
            <h2>Limpieza de Bloatware</h2>
            <p style={{ opacity: 0.8 }}>Desactiva o elimina componentes preinstalados de Windows que saturan la memoria en segundo plano:</p>
            
            <ApiStatus status={bloatware.status} error={bloatware.error} onRetry={bloatware.reload} />

            {bloatware.status === 'success' && (
              <div style={{ marginTop: '20px' }}>
                {bloatware.data.data.map(rule => (
                  <div key={rule.bloatware_id} className="quiz-option" onClick={() => toggleBloatware(rule.bloatware_id)}>
                    <div>
                      <strong>{rule.app_display_name}</strong>
                      <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: rule.risk_level === 'ALTO' ? 'var(--danger-color)' : rule.risk_level === 'MEDIO' ? 'var(--warning-color)' : 'var(--primary-color)' }}>
                        Riesgo {rule.risk_level}
                      </span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', opacity: 0.75 }}>{rule.description}</p>
                    </div>
                    <input type="checkbox" checked={selectedBloatware.has(rule.bloatware_id)} readOnly />
                  </div>
                ))}
              </div>
            )}

            <button
              className="btn-action"
              style={{ background: 'var(--danger-color)', borderColor: 'var(--danger-color)', color: '#fff', padding: '12px 24px', marginTop: '15px' }}
              disabled={selectedBloatware.size === 0}
              onClick={() => alert(`Eliminando ${selectedBloatware.size} componentes seleccionados...`)}
            >
              Ejecutar Limpieza Instantánea
            </button>
          </div>
        )}

        {/* PESTAÑA 4: CONFIGURACIÓN Y PERFIL */}
        {activeTab === 'configuracion' && (
          <div className="column-panel" style={{ width: '100%' }}>
            <h2>Configuración y Perfil</h2>
            <div style={{ backgroundColor: 'var(--surface-color)', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
              <p><strong>Perfil activo:</strong> {activeProfileTitle}</p>
              <p><strong>Permisos de Administrador:</strong> se piden solo al instalar, con el aviso de Windows.</p>
              <button className="btn-action" onClick={() => setShowQuiz(true)} style={{ marginTop: '10px' }}>
                Reconfigurar Cuestionario Inicial
              </button>
            </div>

            <div style={{ backgroundColor: 'var(--surface-color)', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
              <p style={{ marginTop: 0 }}><strong>Origen del escaneo de hardware</strong></p>
              <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                {desktop
                  ? 'En la app de escritorio se lee el hardware real; los equipos simulados sirven para probar otros escenarios.'
                  : 'En el navegador no se puede leer el hardware: se usan equipos simulados (Hardware Mock Fixture).'}
              </p>
              {SCAN_SOURCES.map(source => (
                <div key={source.id} className="quiz-option" onClick={() => changeFixture(source.id)}>
                  <div>
                    <strong>{source.label}</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', opacity: 0.75 }}>{source.description}</p>
                  </div>
                  <input type="radio" checked={source.id === fixtureId} readOnly />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PESTAÑA 5: PLAN PREMIUM */}
        {activeTab === 'premium' && (
          <div className="column-panel" style={{ width: '100%', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--warning-color)' }}>👑 DriWin Premium</h2>
            <p style={{ opacity: 0.85, maxWidth: '500px', margin: '0 auto' }}>
              Desbloquea optimización térmica avanzada para GPU de portátiles, copias de seguridad de drivers y acceso a catálogos históricos.
            </p>
            <div style={{ padding: '20px', border: '1px solid var(--warning-color)', borderRadius: '8px', maxWidth: '350px', margin: '30px auto' }}>
              <h3>Licencia Pro / Anual</h3>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>$9.99 USD</p>
              <button className="btn-action" style={{ background: 'var(--warning-color)', color: '#222831', width: '100%' }}>
                Actualizar Ahora
              </button>
            </div>
          </div>
        )}

        {/* DOCK INFERIOR IZQUIERDO (Engranaje y Corona) */}
        <div className="bottom-dock">
          <button 
            className={`dock-btn ${activeTab === 'configuracion' ? 'active' : ''}`} 
            title="Configuración"
            onClick={() => setActiveTab('configuracion')}
          >
            ⚙
          </button>
          <button 
            className={`dock-btn premium ${activeTab === 'premium' ? 'active' : ''}`} 
            title="Upgrade / Premium"
            onClick={() => setActiveTab('premium')}
          >
            👑
          </button>
        </div>

      </div>
    </div>
  );
}