import { useState, useEffect } from 'react';
import './styles/theme.css';

// Tipos según diagrama de flujo
type TabType = 'driwin' | 'apps' | 'optimizar' | 'configuracion' | 'premium';

interface DriverItem {
  device: string;
  currentVer: string;
  newVer?: string;
  actionRequired: boolean;
  installed?: boolean;
}

interface BloatwareItem {
  id: string;
  name: string;
  description: string;
  selected: boolean;
}

export default function App() {
  // Estados de arranque y seguridad (UAC y Onboarding)
  const [hasAdminRights, setHasAdminRights] = useState<boolean | null>(null);
  const [isNewUser, setIsNewUser] = useState<boolean>(true);
  const [showQuiz, setShowQuiz] = useState<boolean>(false);
  
  // Perfiles seleccionados en Onboarding
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [activeProfileTitle, setActiveProfileTitle] = useState<string>('Gamer');

  // Estado de procesamiento paralelo (simulación Shell VEN/DEV)
  const [parallelScanDone, setParallelScanDone] = useState<boolean>(false);

  // Navegación de pestañas
  const [activeTab, setActiveTab] = useState<TabType>('driwin');

  // Datos de controladores
  const [drivers, setDrivers] = useState<DriverItem[]>([
    { device: 'Sonido Realtek HD', currentVer: '6.0.9239.1', actionRequired: false },
    { device: 'NVIDIA RTX 3060 Laptop', currentVer: '512.15', newVer: '551.76 (Game Ready)', actionRequired: true, installed: false },
    { device: 'Intel Iris Xe Graphics', currentVer: '30.0.101', newVer: '31.0.101.4575', actionRequired: true, installed: false },
    { device: 'Controlador USB xHCI', currentVer: '10.0.22621', actionRequired: false },
    { device: 'Bluetooth Device (RFCOMM)', currentVer: '22.110.0', actionRequired: false },
    { device: 'Intel Wi-Fi 6 AX201', currentVer: '22.150.0.3', newVer: '23.30.0.6', actionRequired: true, installed: false },
  ]);

  // Lista para el panel de Limpieza de Bloatware
  const [bloatwareList, setBloatwareList] = useState<BloatwareItem[]>([
    { id: 'onedrive', name: 'Microsoft OneDrive', description: 'Consumo constante de red y disco en segundo plano', selected: true },
    { id: 'gamebar', name: 'Xbox Game Bar', description: 'Superposiciones gráficas y servicios de captura innecesarios', selected: true },
    { id: 'cortana', name: 'Cortana / Asistente', description: 'Telemetría obsoleta de búsqueda', selected: true },
    { id: 'clipchamp', name: 'Microsoft Clipchamp', description: 'Editor web preinstalado en Windows 11', selected: false },
  ]);

  // 1. Verificación inicial de UAC (Permisos de Administrador)
  useEffect(() => {
    // Al abrir la app, evaluamos permisos
    const checkSavedSession = localStorage.getItem('driwin_profile');
    if (checkSavedSession) {
      setIsNewUser(false);
      setActiveProfileTitle(checkSavedSession);
    }
  }, []);

  // Simulación de ejecución en paralelo del Shell mientras el usuario responde
  useEffect(() => {
    if (showQuiz) {
      const scanTimer = setTimeout(() => {
        setParallelScanDone(true);
      }, 2000);
      return () => clearTimeout(scanTimer);
    }
  }, [showQuiz]);

  const handleGrantUAC = () => {
    setHasAdminRights(true);
    if (isNewUser) {
      setShowQuiz(true);
    }
  };

  const handleProfileToggle = (profile: string) => {
    if (selectedProfiles.includes(profile)) {
      setSelectedProfiles(selectedProfiles.filter(p => p !== profile));
    } else {
      setSelectedProfiles([...selectedProfiles, profile]);
    }
  };

  const completeQuiz = () => {
    const mainProfile = selectedProfiles.length > 0 ? selectedProfiles.join(' & ') : 'Usuario Estándar';
    setActiveProfileTitle(mainProfile);
    localStorage.setItem('driwin_profile', mainProfile);
    setShowQuiz(false);
  };

  const installDriver = (deviceName: string) => {
    setDrivers(prev => prev.map(d => d.device === deviceName ? { ...d, installed: true } : d));
  };

  const toggleBloatware = (id: string) => {
    setBloatwareList(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  return (
    <div className="window-container">
      
      {/* 1. Modal UAC (Control de Cuentas de Usuario) */}
      {hasAdminRights === null && (
        <div className="overlay-modal">
          <div className="modal-box" style={{ textAlign: 'center' }}>
            <h2 style={{ color: 'var(--primary-color)', margin: '0 0 10px 0' }}>Intervención de Seguridad (UAC)</h2>
            <p style={{ opacity: 0.85, lineHeight: '1.6' }}>
              DriWin requiere privilegios de administrador para comunicarse con los controladores de hardware e interactuar con el sistema operativo sin restricciones.
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '25px' }}>
              <button className="btn-action" style={{ background: 'var(--primary-color)', color: '#222831' }} onClick={handleGrantUAC}>
                Conceder Permisos de Administrador
              </button>
              <button className="btn-action" onClick={() => alert('La aplicación no puede continuar sin permisos.')}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Onboarding: Cuestionario de Perfil con Shell en Paralelo */}
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

            <div className="quiz-option" onClick={() => handleProfileToggle('Gamer')}>
              <div>
                <strong>🎮 Uso este equipo para jugar (Gamer)</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', opacity: 0.75 }}>Prioridad a drivers Game Ready y baja latencia</p>
              </div>
              <input type="checkbox" checked={selectedProfiles.includes('Gamer')} readOnly />
            </div>

            <div className="quiz-option" onClick={() => handleProfileToggle('Desarrollador')}>
              <div>
                <strong>💻 Uso este equipo para programar (Desarrollador)</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', opacity: 0.75 }}>Drivers de virtualización y puertos seriales COM/UART</p>
              </div>
              <input type="checkbox" checked={selectedProfiles.includes('Desarrollador')} readOnly />
            </div>

            <div className="quiz-option" onClick={() => handleProfileToggle('Creador')}>
              <div>
                <strong>🎨 Apps de Edición e Ilustración (Creador)</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', opacity: 0.75 }}>Drivers NVIDIA Studio y perfiles de color estables</p>
              </div>
              <input type="checkbox" checked={selectedProfiles.includes('Creador')} readOnly />
            </div>

            <div className="quiz-option" onClick={() => handleProfileToggle('Oficinista / Thin Clients')}>
              <div>
                <strong>🏢 Máxima Seguridad y Estabilidad (Oficinista)</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', opacity: 0.75 }}>Drivers WHQL certificados y ahorro energético</p>
              </div>
              <input type="checkbox" checked={selectedProfiles.includes('Oficinista / Thin Clients')} readOnly />
            </div>

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
          <button className="win-btn" title="Minimizar">─</button>
          <button className="win-btn" title="Maximizar">□</button>
          <button className="win-btn close" title="Cerrar" onClick={() => alert('Cerrando DriWin...')}>✕</button>
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
              <div style={{ marginTop: '15px' }}>
                {drivers.map(item => (
                  <div key={item.device} className="driver-row">
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{item.device}</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Versión instalada: {item.currentVer}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Columna Derecha: Drivers Actualizar según perfil */}
            <div className="column-panel">
              <h2 style={{ borderBottom: '1px solid rgba(0,173,181,0.3)', paddingBottom: '10px' }}>
                Drivers a Actualizar
                <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 'normal', marginTop: '4px' }}>
                  Según tu perfil: {activeProfileTitle}
                </span>
              </h2>

              <div style={{ marginTop: '15px' }}>
                {drivers.filter(d => d.actionRequired).map(item => (
                  <div key={item.device} className="driver-row">
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{item.device}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--primary-color)' }}>{item.newVer}</div>
                    </div>
                    <button 
                      className={`btn-action ${item.installed ? 'installed' : ''}`}
                      onClick={() => installDriver(item.device)}
                      disabled={item.installed}
                    >
                      {item.installed ? '✓ Instalado' : 'Install'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: INSTALADOR DE APPS */}
        {activeTab === 'apps' && (
          <div className="column-panel" style={{ width: '100%' }}>
            <h2>Instalador de Software</h2>
            <p style={{ opacity: 0.8 }}>Aplicaciones recomendadas para tu entorno configurado ({activeProfileTitle}):</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px', marginTop: '20px' }}>
              <div className="driver-row">
                <div><strong>Steam</strong><p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Plataforma de videojuegos</p></div>
                <button className="btn-action">Instalar</button>
              </div>
              <div className="driver-row">
                <div><strong>Visual Studio Code</strong><p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Editor de código</p></div>
                <button className="btn-action">Instalar</button>
              </div>
              <div className="driver-row">
                <div><strong>Discord</strong><p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Comunidad y llamadas</p></div>
                <button className="btn-action">Instalar</button>
              </div>
              <div className="driver-row">
                <div><strong>Git</strong><p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Control de versiones</p></div>
                <button className="btn-action">Instalar</button>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 3: OPTIMIZAR WINDOWS (LIMPIEZA DE BLOATWARE) */}
        {activeTab === 'optimizar' && (
          <div className="column-panel" style={{ width: '100%' }}>
            <h2>Limpieza de Bloatware</h2>
            <p style={{ opacity: 0.8 }}>Desactiva o elimina componentes preinstalados de Windows que saturan la memoria en segundo plano:</p>
            
            <div style={{ marginTop: '20px' }}>
              {bloatwareList.map(item => (
                <div key={item.id} className="quiz-option" onClick={() => toggleBloatware(item.id)}>
                  <div>
                    <strong>{item.name}</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', opacity: 0.75 }}>{item.description}</p>
                  </div>
                  <input type="checkbox" checked={item.selected} readOnly />
                </div>
              ))}
            </div>

            <button 
              className="btn-action" 
              style={{ background: 'var(--danger-color)', borderColor: 'var(--danger-color)', color: '#fff', padding: '12px 24px', marginTop: '15px' }}
              onClick={() => alert('Eliminando servicios y aplicaciones seleccionadas...')}
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
              <p><strong>Permisos de Administrador:</strong> {hasAdminRights ? 'Activos (Elevados)' : 'Inactivos'}</p>
              <button className="btn-action" onClick={() => setShowQuiz(true)} style={{ marginTop: '10px' }}>
                Reconfigurar Cuestionario Inicial
              </button>
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