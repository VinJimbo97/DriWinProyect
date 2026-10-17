-- ============================================================================
-- SCRIPT DE CREACIÓN Y SEMILLA REPRODUCIBLE - PROYECTO DRIWIN (HITO 2)
-- Motor: PostgreSQL 16 (Azure Database for PostgreSQL Flexible Server)
-- ============================================================================

-- Limpieza previa para garantizar reproducibilidad en pruebas del evaluador
DROP TABLE IF EXISTS driver_packages CASCADE;
DROP TABLE IF EXISTS hardware_components CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- 1. TABLA DE PERFILES DE INTENCIÓN
CREATE TABLE user_profiles (
    profile_id SERIAL PRIMARY KEY,
    profile_name VARCHAR(50) NOT NULL UNIQUE, -- Ej: 'Gamer', 'Creator', 'Office'
    optimization_focus VARCHAR(100) NOT NULL, -- Ej: 'Alto Rendimiento', 'Estabilidad WHQL'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA DE COMPONENTES DE HARDWARE (Recurso Principal 1 para CRUD)
CREATE TABLE hardware_components (
    component_id SERIAL PRIMARY KEY,
    ven_id VARCHAR(10) NOT NULL,              -- Ej: '1002' (AMD), '10DE' (NVIDIA)
    dev_id VARCHAR(10) NOT NULL,              -- Ej: '1638' (Radeon Vega / Cezanne)
    subsys_id VARCHAR(20) DEFAULT 'GENERIC',  -- Identificador OEM opcional
    commercial_name VARCHAR(150) NOT NULL,    -- Nombre amigable para la capa de presentación
    category VARCHAR(50) NOT NULL,            -- Ej: 'GPU', 'Network', 'Audio'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Restricción única: No pueden existir dos componentes con el mismo VEN, DEV y SUBSYS
    CONSTRAINT uq_hardware_signature UNIQUE (ven_id, dev_id, subsys_id)
);

-- Índice para acelerar la búsqueda del Paso 2 del Caso de Uso
CREATE INDEX idx_hardware_lookup ON hardware_components (ven_id, dev_id);

-- 3. TABLA DE PAQUETES DE CONTROLADORES (Recurso Principal 2 para CRUD)
CREATE TABLE driver_packages (
    driver_id SERIAL PRIMARY KEY,
    component_id INT NOT NULL,
    profile_id INT NOT NULL,
    os_environment VARCHAR(30) NOT NULL,      -- Ej: 'Win11_x64', 'Win10_x64'
    edition_name VARCHAR(120) NOT NULL,       -- Ej: 'AMD Software: Adrenalin Edition'
    version_number VARCHAR(40) NOT NULL,      -- Ej: '24.8.1'
    release_date DATE NOT NULL,
    download_url TEXT NOT NULL,               -- URL hacia Azure Blob Storage (Offloading)
    file_size_mb INT NOT NULL,                -- Ej: 520 (MB)
    silent_install_flags VARCHAR(50) DEFAULT '/S', -- Parámetro para el Paso 5 (Instalación Silenciosa)
    is_whql_certified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Llaves Foráneas (Integridad Referencial exigida en Criterio B4)
    CONSTRAINT fk_driver_component 
        FOREIGN KEY (component_id) REFERENCES hardware_components(component_id) ON DELETE CASCADE,
    CONSTRAINT fk_driver_profile 
        FOREIGN KEY (profile_id) REFERENCES user_profiles(profile_id) ON DELETE RESTRICT,

    -- Garantiza un único driver recomendado por componente, perfil y sistema operativo
    CONSTRAINT uq_driver_recommendation UNIQUE (component_id, profile_id, os_environment)
);

-- ============================================================================
-- POBLADO MANUAL REPRESENTATIVO (CATÁLOGO SEMILLA)
-- Incluye exactamente el caso de uso de Javier (Gamer - VEN_1002 & DEV_1638)
-- ============================================================================

-- Insertar Perfiles
INSERT INTO user_profiles (profile_name, optimization_focus) VALUES
('Gamer', 'Máximo rendimiento gráfico, fotogramas por segundo y baja latencia'),
('Creator', 'Estabilidad en renderizado, precisión de color y flujos de edición (Studio)'),
('Office', 'Estabilidad absoluta del sistema, bajo consumo energético y certificación WHQL');

-- Insertar Componentes de Hardware Representativos
INSERT INTO hardware_components (ven_id, dev_id, subsys_id, commercial_name, category) VALUES
('1002', '1638', 'GENERIC', 'AMD Radeon(TM) Graphics (Vega Integrated)', 'GPU'),
('10DE', '2504', 'GENERIC', 'NVIDIA GeForce RTX 3060', 'GPU'),
('14C3', '7961', 'GENERIC', 'MediaTek Wi-Fi 6 MT7921 Wireless LAN Card', 'Network'),
('10EC', '0256', 'GENERIC', 'Realtek High Definition Audio (ALC256)', 'Audio');

-- Insertar Paquetes de Controladores diferenciados estrictamente por Perfil
INSERT INTO driver_packages 
(component_id, profile_id, os_environment, edition_name, version_number, release_date, download_url, file_size_mb, silent_install_flags, is_whql_certified) 
VALUES
-- 1. CASO DE USO JAVIER: AMD Radeon (VEN_1002, DEV_1638) -> Gamer vs Office vs Creator
(1, 1, 'Win11_x64', 'AMD Software: Adrenalin Edition', '24.9.1', '2026-09-15', 'https://driwinstorage.blob.core.windows.net/drivers/amd-adrenalin-24.9.1-win11-64bit.exe', 540, '-install', TRUE),
(1, 2, 'Win11_x64', 'AMD Software: PRO Edition', '24.Q3', '2026-08-20', 'https://driwinstorage.blob.core.windows.net/drivers/amd-pro-edition-24q3-win11-64bit.exe', 510, '-install', TRUE),
(1, 3, 'Win11_x64', 'AMD Base Display Driver (WHQL Minimal)', '31.0.21912', '2026-07-10', 'https://driwinstorage.blob.core.windows.net/drivers/amd-whql-minimal-1638.cab', 120, 'pnputil /add-driver', TRUE),

-- 2. NVIDIA RTX 3060 (VEN_10DE, DEV_2504) -> Gamer (Game Ready) vs Creator (Studio) vs Office
(2, 1, 'Win11_x64', 'NVIDIA GeForce Game Ready Driver', '561.09', '2026-09-11', 'https://driwinstorage.blob.core.windows.net/drivers/nvidia-gameready-561.09-win11.exe', 685, '/s /n', TRUE),
(2, 2, 'Win11_x64', 'NVIDIA Studio Driver', '561.09', '2026-09-11', 'https://driwinstorage.blob.core.windows.net/drivers/nvidia-studio-561.09-win11.exe', 680, '/s /n', TRUE),
(2, 3, 'Win11_x64', 'NVIDIA Standard DCH Display Driver', '555.85', '2026-05-20', 'https://driwinstorage.blob.core.windows.net/drivers/nvidia-dch-office-555.85.exe', 410, '/s /n', TRUE),

-- 3. MediaTek Wi-Fi 6 (VEN_14C3, DEV_7961) -> Gamer (Baja latencia) vs Office (Estabilidad)
(3, 1, 'Win11_x64', 'MediaTek MT7921 Gaming Low-Latency WLAN Driver', '3.4.0.1023', '2026-08-01', 'https://driwinstorage.blob.core.windows.net/drivers/mt7921-gaming-wlan.exe', 45, '/S', TRUE),
(3, 3, 'Win11_x64', 'MediaTek Wireless LAN WHQL Base Driver', '3.0.1.1300', '2026-03-15', 'https://driwinstorage.blob.core.windows.net/drivers/mt7921-office-whql.cab', 18, 'pnputil /add-driver', TRUE);