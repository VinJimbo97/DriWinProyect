import { useState, useEffect } from 'react';
import './styles/theme.css';

// Tipos para nuestro flujo
type AppView = 
  | 'evaluacion' | 'confirmacion' | 'quiz' | 'perfil_resultado' 
  | 'busqueda' | 'choques' | 'descarga' | 'reinicio'
  | 'inicio_app' | 'control_drivers' | 'busqueda_apps' | 'configuracion';

export default function App() {
  const [view, setView] = useState<AppView>('evaluacion');
  
  // Estados de datos
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [finalProfile, setFinalProfile] = useState<string>('');
  const [conflictResolved, setConflictResolved] = useState(false);

  // Simulación de análisis inicial
  useEffect(() => {
    if (view === 'evaluacion') {
      setIsAnalyzing(true);
      const timer = setTimeout(() => {
        setIsAnalyzing(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [view]);

  // Manejador del Quiz
  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const processQuiz = () => {
    if (selectedInterests.includes('Juegos') && selectedInterests.includes('Programación')) {
      setFinalProfile('Gamer Híbrido / Desarrollador');
    } else if (selectedInterests.includes('Juegos')) {
      setFinalProfile('Gamer Puro');
    } else if (selectedInterests.includes('Programación')) {
      setFinalProfile('Desarrollador');
    } else {
      setFinalProfile('Usuario Estándar');
    }
    setView('perfil_resultado');
  };

  // --- COMPONENTE DE NAVEGACIÓN SUPERIOR (BARRA FIJA) ---
  const renderNavBar = () => {
    const navItems: { id: AppView; label: string }[] = [
      { id: 'inicio_app', label: '🏠 Inicio' },
      { id: 'control_drivers', label: '⚙️ Drivers' },
      { id: 'busqueda_apps', label: '📦 Apps' },
      { id: 'configuracion', label: '🔧 Config.' }
    ];

    return (
      <nav style={{ 
        display: 'flex', justifyContent: 'space-around', 
        borderBottom: '1px solid var(--primary-color)', 
        paddingBottom: '10px', marginBottom: '20px' 
      }}>
        {navItems.map(item => (
          <button 
            key={item.id}
            onClick={() => setView(item.id)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: view === item.id ? '3px solid var(--primary-color)' : '3px solid transparent',
              color: view === item.id ? 'var(--primary-color)' : 'var(--text-color)',
              fontWeight: view === item.id ? 'bold' : 'normal',
              padding: '10px', cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
    );
  };

  // ==========================================
  // FASE 1: ONBOARDING (Sin Navbar)
  // ==========================================
  
  if (view === 'evaluacion') {
    return (
      <div className="card text-center" style={{ textAlign: 'center' }}>
        <h2>Evaluación de Hardware</h2>
        <div style={{ margin: '40px 0' }}>
          {isAnalyzing ? <div className="spinner"></div> : <p style={{ color: 'var(--primary-color)', fontSize: '2rem' }}>✓</p>}
        </div>
        <p>{isAnalyzing ? 'Analizando componentes físicos y arquitectura del sistema...' : 'Análisis completado exitosamente.'}</p>
        {!isAnalyzing && <button className="btn-primary" onClick={() => setView('confirmacion')}>Siguiente</button>}
      </div>
    );
  }

  if (view === 'confirmacion') {
    return (
      <div className="card text-center">
        <h2>Confirmación de Hardware</h2>
        <div style={{ margin: '20px 0', padding: '15px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px', textAlign: 'left' }}>
          <p><strong>Tipo:</strong> Notebook</p>
          <p><strong>Modelo exacto:</strong> ASUS TUF Dash F15 (2022)</p>
          <p><strong>CPU:</strong> Intel Core i5</p>
          <p><strong>GPU:</strong> NVIDIA GeForce RTX 3060</p>
          <p><strong>Almacenamiento:</strong> SSD 512GB (Estado: Óptimo)</p>
        </div>
        <p style={{ opacity: 0.8 }}>¿Este es tu equipo? Confirmar nos permite buscar los parámetros térmicos y controladores exactos.</p>
        <button className="btn-primary" onClick={() => setView('quiz')}>Sí, es mi equipo</button>
      </div>
    );
  }

  if (view === 'quiz') {
    return (
      <div className="card text-center">
        <h2>Cuestionario de Ambiente</h2>
        <p style={{ opacity: 0.8, marginBottom: '20px' }}>¿Qué usos principales le darás a este equipo? (Selecciona una o varias)</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
          {['Juegos', 'Programación', 'Creación de Contenido', 'Ofimática'].map(interest => (
            <button 
              key={interest}
              className={`btn-primary ${selectedInterests.includes(interest) ? '' : 'btn-outline'}`} 
              onClick={() => toggleInterest(interest)}
              style={{ width: '80%' }}
            >
              {selectedInterests.includes(interest) ? '✓ ' : ''} {interest}
            </button>
          ))}
        </div>
        <button 
          className="btn-primary" 
          disabled={selectedInterests.length === 0}
          onClick={processQuiz} 
          style={{ marginTop: '20px', backgroundColor: selectedInterests.length > 0 ? 'var(--primary-color)' : 'gray' }}
        >
          Generar Perfil
        </button>
      </div>
    );
  }

  if (view === 'perfil_resultado') {
    return (
      <div className="card text-center">
        <h2>Establecimiento de Perfil</h2>
        <p>Según tus respuestas, hemos diseñado el siguiente perfil para tu PC:</p>
        <div style={{ padding: '20px', border: '1px solid var(--primary-color)', borderRadius: '8px', margin: '20px 0', color: 'var(--primary-color)', fontSize: '1.2rem', fontWeight: 'bold' }}>
          {finalProfile}
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button className="btn-primary btn-outline" onClick={() => setView('quiz')}>Rehacer Quiz</button>
          <button className="btn-primary" onClick={() => setView('busqueda')}>Confirmar Perfil</button>
        </div>
      </div>
    );
  }

  if (view === 'busqueda') {
    return (
      <div className="card text-center">
        <h2>Búsqueda de Drivers y Sugerencias</h2>
        <div style={{ margin: '30px 0' }}><div className="spinner"></div></div>
        <p style={{ opacity: 0.9 }}>Buscando los mejores controladores para tu ASUS TUF adaptados al perfil <strong>{finalProfile}</strong>...</p>
        <button className="btn-primary" onClick={() => setView('choques')} style={{ marginTop: '20px' }}>Simular Término de Búsqueda</button>
      </div>
    );
  }

  if (view === 'choques') {
    return (
      <div className="card">
        <h2 style={{ textAlign: 'center' }}>Revisión de posibles choques</h2>
        <p style={{ fontSize: '0.9rem', opacity: 0.9 }}>Hemos detectado un conflicto entre los requisitos de tus preferencias.</p>
        
        <div style={{ borderLeft: '4px solid #ff4757', padding: '15px', backgroundColor: 'rgba(255, 71, 87, 0.1)', marginBottom: '20px' }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>Conflicto: Gestión de Energía USB vs Latencia</p>
          <p style={{ fontSize: '0.85rem' }}>El driver estándar ahorra batería desconectando puertos, pero puede causar input-lag al usar un mando por varias horas seguidas. El driver de alto rendimiento mantiene el polling rate constante pero gasta más batería.</p>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <button className={`btn-primary ${conflictResolved ? 'btn-outline' : ''}`} onClick={() => setConflictResolved(true)} style={{ flex: 1, fontSize: '0.8rem' }}>
              Instalar Driver Estandar (Batería)
            </button>
            <button className={`btn-primary ${!conflictResolved ? 'btn-outline' : ''}`} onClick={() => setConflictResolved(true)} style={{ flex: 1, fontSize: '0.8rem' }}>
              Instalar Driver Rendimiento (Mandos)
            </button>
          </div>
        </div>
        <button className="btn-primary" disabled={!conflictResolved} onClick={() => setView('descarga')} style={{ width: '100%', opacity: conflictResolved ? 1 : 0.5 }}>
          Continuar con Descarga
        </button>
      </div>
    );
  }

  if (view === 'descarga') {
    return (
      <div className="card text-center">
        <h2>Descarga e Instalación</h2>
        <p>Aplicando configuraciones y descargando paquetes...</p>
        <div style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', height: '20px', borderRadius: '10px', margin: '30px 0', overflow: 'hidden' }}>
          <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--primary-color)', animation: 'progress 3s ease forwards' }}></div>
        </div>
        <button className="btn-primary" onClick={() => setView('reinicio')}>Siguiente</button>
      </div>
    );
  }

  if (view === 'reinicio') {
    return (
      <div className="card text-center">
        <h2>Reinicio Necesario</h2>
        <p>Los drivers base se han instalado. Para que el control térmico de la GPU funcione correctamente, es necesario reiniciar el sistema.</p>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px' }}>
          <button className="btn-primary" style={{ backgroundColor: '#ff4757' }}>Reiniciar Ahora</button>
          <button className="btn-primary btn-outline" onClick={() => setView('inicio_app')}>Entrar a la App (Reiniciar después)</button>
        </div>
      </div>
    );
  }

  // ==========================================
  // FASE 2: APLICACIÓN PRINCIPAL (Con Navbar)
  // ==========================================

  return (
    <div className="card" style={{ padding: '20px', minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
      {renderNavBar()}

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
        
        {view === 'inicio_app' && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <h2>Bienvenido a tu Sistema Optimizado</h2>
            <p>Tu equipo está funcionando bajo el perfil: <strong style={{ color: 'var(--primary-color)' }}>{finalProfile}</strong></p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '30px' }}>
              <div style={{ padding: '20px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                <h3>🌡️ Sistema</h3>
                <p style={{ fontSize: '0.9rem' }}>Temperatura GPU: 45°C<br/>Límite térmico: Activo (80°C Max)</p>
              </div>
              <div style={{ padding: '20px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                <h3>🛡️ Seguridad</h3>
                <p style={{ fontSize: '0.9rem' }}>Todos los controladores están en su última versión estable.</p>
              </div>
            </div>
          </div>
        )}

        {view === 'control_drivers' && (
          <div>
            <h2>Control de Drivers</h2>
            <div style={{ borderBottom: '1px solid gray', paddingBottom: '10px', marginBottom: '10px' }}>
              <h4>Componentes Internos</h4>
              <ul style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                <li><strong>GPU NVIDIA RTX 3060:</strong> v531.79 <span style={{ color: 'var(--primary-color)', fontSize: '0.8rem' }}>(Actualizado)</span></li>
                <li><strong>Intel Wi-Fi 6 AX201:</strong> v22.160.0.4 <span style={{ color: '#ff4757', fontSize: '0.8rem' }}>(Actualización disponible)</span></li>
              </ul>
            </div>
            <div style={{ borderBottom: '1px solid gray', paddingBottom: '10px', marginBottom: '10px' }}>
              <h4>Dispositivos Externos (Detectados)</h4>
              <ul style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                <li>Receptor Mando Inalámbrico - <em>Driver genérico (Requiere optimización)</em></li>
              </ul>
            </div>
            <div>
              <h4>Historial y Catálogo Histórico</h4>
              <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>Explora versiones antiguas de placas y componentes. <em>Nota: El sistema alertará si intentas instalar un driver incompatible.</em></p>
              <button className="btn-primary btn-outline" style={{ width: '100%' }}>Abrir Catálogo Completo</button>
            </div>
          </div>
        )}

        {view === 'busqueda_apps' && (
          <div>
            <h2>Descarga de Aplicaciones</h2>
            <p style={{ fontSize: '0.9rem', marginBottom: '20px' }}>Sugerencias seleccionadas para: <strong>{finalProfile}</strong></p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {/* Apps dinámicas simuladas según perfil */}
              {finalProfile.includes('Gamer') && (
                <>
                  <div style={{ border: '1px solid var(--primary-color)', padding: '10px', borderRadius: '6px' }}><input type="checkbox" defaultChecked /> Steam</div>
                  <div style={{ border: '1px solid var(--primary-color)', padding: '10px', borderRadius: '6px' }}><input type="checkbox" defaultChecked /> Discord</div>
                </>
              )}
              {finalProfile.includes('Desarrollador') && (
                <>
                  <div style={{ border: '1px solid var(--primary-color)', padding: '10px', borderRadius: '6px' }}><input type="checkbox" defaultChecked /> Visual Studio Code</div>
                  <div style={{ border: '1px solid var(--primary-color)', padding: '10px', borderRadius: '6px' }}><input type="checkbox" defaultChecked /> Arduino IDE (Entorno C++)</div>
                  <div style={{ border: '1px solid var(--primary-color)', padding: '10px', borderRadius: '6px' }}><input type="checkbox" defaultChecked /> Git</div>
                </>
              )}
              {finalProfile === 'Usuario Estándar' && (
                <>
                  <div style={{ border: '1px solid var(--primary-color)', padding: '10px', borderRadius: '6px' }}><input type="checkbox" defaultChecked /> Google Chrome</div>
                  <div style={{ border: '1px solid var(--primary-color)', padding: '10px', borderRadius: '6px' }}><input type="checkbox" defaultChecked /> VLC Player</div>
                </>
              )}
            </div>
            <button className="btn-primary" style={{ marginTop: '20px', width: '100%' }}>Descargar Apps Seleccionadas</button>
          </div>
        )}

        {view === 'configuracion' && (
          <div>
            <h2>Configuración del Sistema</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              <div style={{ padding: '15px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0' }}>Configuración General</h4>
                <p style={{ fontSize: '0.85rem', margin: '5px 0' }}><strong>Directorio de descargas:</strong> C:/Usuarios/TUF/Descargas/AppInicio</p>
                <div style={{ marginTop: '10px' }}>
                  <label style={{ fontSize: '0.9rem', marginRight: '10px' }}>Idioma:</label>
                  <select style={{ padding: '5px', borderRadius: '4px', background: 'var(--surface-color)', color: 'var(--text-color)', border: '1px solid var(--primary-color)' }}>
                    <option>Español</option>
                    <option>Inglés</option>
                  </select>
                </div>
              </div>

              <div style={{ padding: '15px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0' }}>Soporte y Ayuda</h4>
                <p style={{ fontSize: '0.85rem' }}>¿Encontraste un error de compatibilidad o necesitas ayuda técnica?</p>
                <button className="btn-primary btn-outline" style={{ marginTop: '5px' }}>Contactar Soporte / Reportar Error</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}