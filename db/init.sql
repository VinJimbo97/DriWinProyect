-- ============================================================================
-- SCRIPT DE CREACIÓN Y SEMILLA REPRODUCIBLE - PROYECTO DRIWIN (HITO 2)
-- Motor: PostgreSQL 16 (Azure Database for PostgreSQL Flexible Server)
-- Alcance: Modelo relacional expandido sin romper la compatibilidad con las
--          tablas base (user_profiles, hardware_components, driver_packages).
--          Se agregan: apps recomendadas por perfil, reglas de bloatware,
--          matriz de financiamiento (suscripciones) y usuarios sintéticos.
-- Idempotencia: el script puede ejecutarse N veces seguidas; siempre parte
--          de una base limpia gracias a los DROP ... IF EXISTS ... CASCADE
--          ejecutados en el orden correcto de llaves foráneas (hijas -> padres).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. LIMPIEZA PREVIA (orden de dependencia: tablas hijas primero)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS bloatware_profile_policy CASCADE; -- FK -> bloatware_rules, user_profiles
DROP TABLE IF EXISTS profile_apps CASCADE;        -- FK -> user_profiles, recommended_apps
DROP TABLE IF EXISTS synthetic_users CASCADE;     -- FK -> subscription_tiers
DROP TABLE IF EXISTS driver_packages CASCADE;     -- FK -> hardware_components, user_profiles
DROP TABLE IF EXISTS recommended_apps CASCADE;    -- Catálogo de aplicaciones
DROP TABLE IF EXISTS bloatware_rules CASCADE;     -- Catálogo de reglas de limpieza
DROP TABLE IF EXISTS subscription_tiers CASCADE;  -- Catálogo comercial (planes)
DROP TABLE IF EXISTS hardware_components CASCADE; -- Catálogo de hardware
DROP TABLE IF EXISTS user_profiles CASCADE;       -- Raíz del modelo de perfiles

-- ============================================================================
-- PARTE A: CREACIÓN DE TABLAS (ESQUEMA RELACIONAL DEL HITO 2)
-- ============================================================================

-- 1. TABLA DE PERFILES DE INTENCIÓN (compatibilidad: misma estructura base)
--    - Gamer (1): máximo rendimiento gráfico, FPS y baja latencia.
--    - Creator (2): estabilidad de renderizado, precisión de color y Studio.
--    - Office (3): estabilidad absoluta, bajo consumo y certificación WHQL.
--      (Abarca: Usuario Oficinista, Técnico Armador e Instituciones).
--    - Developer (4): compilación, virtualización, contenedores y devtools.
CREATE TABLE user_profiles (
    profile_id SERIAL PRIMARY KEY,
    profile_name VARCHAR(50) NOT NULL UNIQUE, -- Ej: 'Gamer', 'Creator', 'Office', 'Developer'
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
    sha256 VARCHAR(64),                       -- Huella del instalador; sin ella la app no lo instala
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_driver_sha256 CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'),

    -- Llaves Foráneas (Integridad Referencial exigida en Criterio B4)
    CONSTRAINT fk_driver_component
        FOREIGN KEY (component_id) REFERENCES hardware_components(component_id) ON DELETE CASCADE,
    CONSTRAINT fk_driver_profile
        FOREIGN KEY (profile_id) REFERENCES user_profiles(profile_id) ON DELETE RESTRICT,

    -- Garantiza un único driver recomendado por componente, perfil y sistema operativo
    CONSTRAINT uq_driver_recommendation UNIQUE (component_id, profile_id, os_environment)
);

-- Índice para acelerar la consulta de drivers por perfil (unión de perfiles)
CREATE INDEX idx_driver_profile ON driver_packages (profile_id);

-- 4. CATÁLOGO DE APLICACIONES RECOMENDADAS POR PERFIL (Hito 2)
CREATE TABLE recommended_apps (
    app_id SERIAL PRIMARY KEY,
    app_name VARCHAR(120) NOT NULL UNIQUE,    -- Ej: 'Steam', 'Blender', 'Visual Studio Code'
    category VARCHAR(60) NOT NULL,            -- Ej: 'Gaming', 'Creatividad', 'Desarrollo'
    version_number VARCHAR(40) NOT NULL,      -- Ej: '5.2.6'
    download_url TEXT NOT NULL,               -- URL sintética hacia Azure Blob Storage (Offloading)
    file_size_mb INT NOT NULL,                -- Tamaño del instalador en MB
    silent_install_flags VARCHAR(80) NOT NULL, -- Flags para instalación silenciosa (Paso 5)
    winget_id VARCHAR(100),                   -- Id exacto en winget (migración 006): la app instala con winget
    official_url TEXT,                        -- Página oficial si la app no está en winget
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_app_size CHECK (file_size_mb > 0),
    CONSTRAINT chk_app_winget_id CHECK (winget_id IS NULL OR winget_id ~ '^[A-Za-z0-9][A-Za-z0-9.+_-]{1,99}$'),
    CONSTRAINT chk_app_official_url CHECK (official_url IS NULL OR official_url ~ '^https://[^\s]+$')
    -- chk_app_install_source se agrega en B.5, después de asignar el origen de cada app.
);

-- 4.1 TABLA PIVOTE PERFIL <-> APLICACIÓN
--     PK compuesta (profile_id, app_id): un usuario que selecciona varios
--     perfiles (ej. Gamer + Creator) recibe la UNIÓN de aplicaciones sin
--     duplicados a nivel de relación, porque el par (perfil, app) sólo
--     puede existir una vez.
CREATE TABLE profile_apps (
    profile_id INT NOT NULL,
    app_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_profile_apps PRIMARY KEY (profile_id, app_id),
    CONSTRAINT fk_pa_profile
        FOREIGN KEY (profile_id) REFERENCES user_profiles(profile_id) ON DELETE CASCADE,
    CONSTRAINT fk_pa_app
        FOREIGN KEY (app_id) REFERENCES recommended_apps(app_id) ON DELETE CASCADE
);

-- Índice inverso: "¿qué perfiles recomiendan esta app?"
CREATE INDEX idx_profile_apps_app ON profile_apps (app_id);

-- 5. TABLA DE DETECCIÓN Y LIMPIEZA DE BLOATWARE (Hito 2)
CREATE TABLE bloatware_rules (
    bloatware_id SERIAL PRIMARY KEY,
    app_display_name VARCHAR(150) NOT NULL,        -- Nombre visible para la UI
    package_signature VARCHAR(150) NOT NULL,       -- Comodín de coincidencia de paquete (ej: *XboxGamingOverlay*)
    detection_powershell_cmd TEXT NOT NULL,        -- Inspección: registro de desinstalación + Get-AppxPackage
    removal_powershell_cmd TEXT NOT NULL,          -- Desinstalación silenciosa
    risk_level VARCHAR(10) NOT NULL DEFAULT 'BAJO',
    description TEXT NOT NULL,
    package_names TEXT[] NOT NULL DEFAULT '{}',    -- Nombres exactos de paquetes de la Store (Get-AppxPackage -Name)
    help_text TEXT NOT NULL DEFAULT '',            -- Explicación simple para el botón "?" de la UI
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_bloatware_risk CHECK (risk_level IN ('BAJO', 'MEDIO', 'ALTO')),
    CONSTRAINT uq_bloatware_signature UNIQUE (package_signature),
    -- Sin comillas, espacios ni ; → no se puede inyectar nada en PowerShell
    CONSTRAINT ck_bloatware_package_names
        CHECK (array_to_string(package_names, ',') ~ '^([A-Za-z0-9][A-Za-z0-9._*-]{1,99}(,|$))*$')
);

-- 5.1 POLÍTICA DE BLOATWARE POR PERFIL (migración 004)
--     SUGERIDO = aparece marcada · OPCIONAL = sin marcar · PROTEGIDO = no aparece
CREATE TABLE bloatware_profile_policy (
    bloatware_id INT NOT NULL,
    profile_id INT NOT NULL,
    policy VARCHAR(10) NOT NULL,
    CONSTRAINT pk_bloatware_profile_policy PRIMARY KEY (bloatware_id, profile_id),
    CONSTRAINT ck_bloatware_policy CHECK (policy IN ('SUGERIDO', 'OPCIONAL', 'PROTEGIDO')),
    CONSTRAINT fk_bpp_rule
        FOREIGN KEY (bloatware_id) REFERENCES bloatware_rules(bloatware_id) ON DELETE CASCADE,
    CONSTRAINT fk_bpp_profile
        FOREIGN KEY (profile_id) REFERENCES user_profiles(profile_id) ON DELETE CASCADE
);

-- 6. MATRIZ DE FINANCIAMIENTO / SUSCRIPCIONES (Hito 2)
--    1) Pase Mensual .......... B2C, $5.000 CLP, límite 3 PCs.
--    2) Compra Única .......... B2C, $30.000 CLP, 1 PC fijo, vitalicio.
--    3) Builder Pro ........... Técnico Armador / Oficinista, tarifa plana,
--                               PCs ilimitados rotativos.
--    4) Pack por Volumen ...... Instituciones B2B / Oficinista, $1.500.000 CLP,
--                               lote de 100 PCs.
--    5) Alianza OEM ........... Retail PC Factory, convenio B2B, preinstalado
--                               de fábrica.
CREATE TABLE subscription_tiers (
    tier_id SERIAL PRIMARY KEY,
    tier_name VARCHAR(80) NOT NULL UNIQUE,   -- Ej: 'Pase Mensual'
    target_persona VARCHAR(80) NOT NULL,     -- Segmento comercial receptor
    pricing_model VARCHAR(40) NOT NULL,      -- Ej: 'Mensual', 'Única', 'Tarifa Plana'
    price_clp NUMERIC(12,2),                 -- CLP; NULL cuando es tarifa plana / convenio
    max_devices INT,                         -- NULL = dispositivos ilimitados
    device_scope VARCHAR(60) NOT NULL,       -- Etiqueta legible del límite
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_tier_price CHECK (price_clp IS NULL OR price_clp >= 0),
    CONSTRAINT ck_tier_devices CHECK (max_devices IS NULL OR max_devices > 0)
);

-- 7. USUARIOS SINTÉTICOS (casos de prueba cubriendo toda la matriz)
CREATE TABLE synthetic_users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    user_role_type VARCHAR(60) NOT NULL,     -- Ej: 'Gamer', 'Técnico Armador'
    tier_id INT NOT NULL,
    selected_profiles_array TEXT[] NOT NULL, -- Nombres de perfil seleccionados
    active_devices_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_tier
        FOREIGN KEY (tier_id) REFERENCES subscription_tiers(tier_id) ON DELETE RESTRICT,
    CONSTRAINT ck_active_devices CHECK (active_devices_count >= 0),
    CONSTRAINT ck_profiles_not_empty CHECK (cardinality(selected_profiles_array) >= 1)
);

-- Índice GIN para consultas rápidas sobre el array de perfiles seleccionados
CREATE INDEX idx_synthetic_users_profiles ON synthetic_users USING GIN (selected_profiles_array);

-- ============================================================================
-- PARTE B: POBLADO MANUAL REPRESENTATIVO (CATÁLOGO SEMILLA)
-- Incluye el caso de uso de Javier (Gamer - VEN_1002 & DEV_1638)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- B.1 Insertar Perfiles de Intención (IDs deterministas: 1..4 por orden)
-- ----------------------------------------------------------------------------
INSERT INTO user_profiles (profile_name, optimization_focus) VALUES
('Gamer',     'Máximo rendimiento gráfico, fotogramas por segundo y baja latencia'),
('Creator',   'Estabilidad en renderizado, precisión de color y flujos de edición (Studio)'),
('Office',    'Estabilidad absoluta del sistema, bajo consumo energético y certificación WHQL'),
('Developer', 'Entornos de compilación, virtualización, contenedores y herramientas de desarrollo');

-- ----------------------------------------------------------------------------
-- B.2 Insertar Componentes de Hardware (IDs 1..6)
--     Catálogo alineado con los 9 instaladores REALES subidos a Azure Blob
--     Storage (contenedor drivers/). Realtek se retiró por no tener instalador.
-- ----------------------------------------------------------------------------
INSERT INTO hardware_components (ven_id, dev_id, subsys_id, commercial_name, category) VALUES
('1002', '1638', 'GENERIC', 'AMD Radeon(TM) Graphics (Vega Integrated)', 'GPU'),
('10DE', '2684', 'GENERIC', 'NVIDIA GeForce RTX 30/40 Series', 'GPU'),
('14C3', '7961', 'GENERIC', 'MediaTek Wi-Fi 6 MT7921 Wireless LAN Card', 'Network'),
('8086', 'A780', 'GENERIC', 'Intel Iris Xe / UHD Graphics (Gen 11 a 14)', 'GPU'),
('8086', '51F0', 'GENERIC', 'Intel Wi-Fi 6/6E Wireless Adapter (Gen 11 a 14)', 'Network'),
('8087', '0033', 'GENERIC', 'Intel Wireless Bluetooth para Windows 10 y 11', 'Bluetooth');

-- ----------------------------------------------------------------------------
-- B.3 Insertar Paquetes de Controladores (9 instaladores reales en Azure Blob)
--     Perfiles: 1=Gamer, 2=Creator, 3=Office, 4=Developer
--     Componentes: 1=AMD Vega, 2=NVIDIA RTX 30/40, 3=MediaTek Wi-Fi,
--                  4=Intel Gráficos, 5=Intel Wi-Fi, 6=Intel Bluetooth
--     Nota: silent_install_flags aún NO verificados contra cada instalador;
--     deben probarse antes de habilitar la instalación silenciosa real.
-- ----------------------------------------------------------------------------
INSERT INTO driver_packages
(component_id, profile_id, os_environment, edition_name, version_number, release_date, download_url, file_size_mb, silent_install_flags, is_whql_certified)
VALUES
-- 1. CASO DE USO JAVIER: AMD Radeon (VEN_1002, DEV_1638) -> Gamer
(1, 1, 'Win11_x64', 'AMD Software: Adrenalin Edition WHQL', '24.9.1', '2026-09-15', 'https://driwinstorage.blob.core.windows.net/drivers/whql-amd-software-adrenalin-edition-24.9.1-win10-win11-sep-rdna.exe', 726, '-install -noreboot', TRUE),

-- 2. NVIDIA RTX 30/40 (VEN_10DE, DEV_2684) -> Gamer (Game Ready) vs Creator (Studio) vs Office (DCH 555) vs Developer (DCH 561)
(2, 1, 'Win11_x64', 'NVIDIA GeForce Game Ready Package Launcher', '561.09', '2026-09-11', 'https://driwinstorage.blob.core.windows.net/drivers/NvidiaDriverGamerPackageLauncher.exe', 945, '-s -noreboot', TRUE),
(2, 2, 'Win11_x64', 'NVIDIA Studio Driver Creador Package Launcher', '561.09', '2026-09-11', 'https://driwinstorage.blob.core.windows.net/drivers/NvidiaDriverCreadorPackageLauncher.exe', 945, '-s -noreboot', TRUE),
(2, 3, 'Win11_x64', 'NVIDIA Standard DCH Display Driver', '555.85', '2026-05-20', 'https://driwinstorage.blob.core.windows.net/drivers/NVIDIA%20GeForce%20v555.85%20(DCH).exe', 629, '-s -noreboot', TRUE),
(2, 4, 'Win11_x64', 'NVIDIA GeForce DCH Developer Driver', '561.09', '2026-09-18', 'https://driwinstorage.blob.core.windows.net/drivers/NVIDIA%20GeForce%20v561.09%20(DCH).exe', 659, '-s -noreboot', TRUE),

-- 3. MediaTek Wi-Fi 6 (VEN_14C3, DEV_7961) -> Gamer
(3, 1, 'Win11_x64', 'MediaTek Wireless LAN WHQL Driver', '3.4.0.1023', '2026-08-01', 'https://driwinstorage.blob.core.windows.net/drivers/MediaTek_WLAN_r2cmw13w.exe', 9, '/S /v/qn', TRUE),

-- 4-6. Intel Gen 11-14 (Gráficos VEN_8086/DEV_A780, Wi-Fi VEN_8086/DEV_51F0, Bluetooth VID_8087/PID_0033) -> Office
(4, 3, 'Win11_x64', 'Intel Processor Graphics Driver (Gen 11-14)', '31.0.101.5522', '2026-10-01', 'https://driwinstorage.blob.core.windows.net/drivers/DriverProcesadorGen11%20a%2014%20Graphics.exe', 745, '--silent --no-reboot', TRUE),
(5, 3, 'Win11_x64', 'Intel Wireless Wi-Fi Driver (Gen 11-14)', '24.80.0.2', '2026-10-01', 'https://driwinstorage.blob.core.windows.net/drivers/WiFi-24.80.0-Driver64-Win10-Win11.exe', 72, '-q -norestart', TRUE),
(6, 3, 'Win11_x64', 'Intel Wireless Bluetooth Driver (Win 10/11)', '23.40.0', '2026-10-01', 'https://driwinstorage.blob.core.windows.net/drivers/DriverBluetoothtWin10y11.exe', 61, '/quiet /norestart', TRUE);

-- Huellas verificadas de los instaladores (ver db/migrations/003_huella_instaladores.sql)
UPDATE driver_packages SET sha256 = '511e01a35f8b6bddb6463c74062467f69d08e0662059abc515f879dfe2675724'
WHERE download_url = 'https://driwinstorage.blob.core.windows.net/drivers/DriverBluetoothtWin10y11.exe';
UPDATE driver_packages SET sha256 = '40d2f714830b406ccc1f9c00547ad6090f164f928748e38f27a1c7c0ef5ed5ea'
WHERE download_url = 'https://driwinstorage.blob.core.windows.net/drivers/WiFi-24.80.0-Driver64-Win10-Win11.exe';
UPDATE driver_packages SET sha256 = '325047b5c9a06559cb6c2136e7aba1b9059aebed90826cd12526063514750366'
WHERE download_url = 'https://driwinstorage.blob.core.windows.net/drivers/NVIDIA%20GeForce%20v555.85%20(DCH).exe';
UPDATE driver_packages SET sha256 = 'dae9e8d239d2dc40e2c3315c1893adcc4937139f91314d522ca0eaec16d43018'
WHERE download_url = 'https://driwinstorage.blob.core.windows.net/drivers/NVIDIA%20GeForce%20v561.09%20(DCH).exe';
UPDATE driver_packages SET sha256 = 'bd223efb880d6533178a7aaf6834e471083e4d24306451730f015c0121ef5c07'
WHERE download_url = 'https://driwinstorage.blob.core.windows.net/drivers/whql-amd-software-adrenalin-edition-24.9.1-win10-win11-sep-rdna.exe';
UPDATE driver_packages SET sha256 = '9643cc60a899ceadf65df2ec80c17cdb69daeb41cdb2c9ccde0d214a79f968f8'
WHERE download_url = 'https://driwinstorage.blob.core.windows.net/drivers/DriverProcesadorGen11%20a%2014%20Graphics.exe';
UPDATE driver_packages SET sha256 = 'f115c92760f1d677ae88f7ee114be20c10ef28a9e725736821a08218054867ca'
WHERE download_url = 'https://driwinstorage.blob.core.windows.net/drivers/NvidiaDriverGamerPackageLauncher.exe';
UPDATE driver_packages SET sha256 = 'd929d8b4587cc49717357b7ef3f60582304568c198f90f8263e1177a8c963b2f'
WHERE download_url = 'https://driwinstorage.blob.core.windows.net/drivers/NvidiaDriverCreadorPackageLauncher.exe';
UPDATE driver_packages SET sha256 = '298645a3728834766935b8d8d2e301be233a69bc389736acafd4b2b33ce91025'
WHERE download_url = 'https://driwinstorage.blob.core.windows.net/drivers/MediaTek_WLAN_r2cmw13w.exe';

-- Drivers del PC de muestra (ver db/migrations/005_drivers_pc_muestra.sql).
-- Video, Wi-Fi y Bluetooth no dependen del uso del PC: se publican para los cuatro perfiles.
INSERT INTO hardware_components (ven_id, dev_id, subsys_id, commercial_name, category) VALUES
('10DE', '2520', 'GENERIC', 'NVIDIA GeForce RTX 3060 Laptop GPU', 'GPU'),
('8086', '46A3', 'GENERIC', 'Intel UHD Graphics (12.ª generación)', 'GPU');

INSERT INTO driver_packages
(component_id, profile_id, os_environment, edition_name, version_number, release_date,
 download_url, file_size_mb, silent_install_flags, is_whql_certified, sha256)
SELECT h.component_id, p.profile_id, 'Win11_x64', d.edition_name, d.version_number, d.release_date::date,
       d.download_url, d.file_size_mb, d.silent_install_flags, TRUE, d.sha256
FROM (VALUES
  ('10DE', '2520', 'NVIDIA GeForce Game Ready Driver (Notebook)', '621.14', '2026-11-04',
   'https://driwinstorage.blob.core.windows.net/drivers/621.14-notebook-win10-win11-64bit-international-dch-whql-g.exe',
   804, '-s -noreboot', '8fe6e0fd85345462ddbeb5996903b5853c18d34a21d2357d859bb744af9262f6'),
  ('8086', '46A3', 'Intel Arc & Iris Xe Graphics Driver', '32.0.101.9175', '2026-11-07',
   'https://driwinstorage.blob.core.windows.net/drivers/gfx_win_101.9175.exe',
   863, '--silent', '707dfead0486e77b635eba606508eaa2fc9c972f6cca2484914dcfcfc906447d')
) AS d(ven_id, dev_id, edition_name, version_number, release_date, download_url, file_size_mb, silent_install_flags, sha256)
JOIN hardware_components h ON h.ven_id = d.ven_id AND h.dev_id = d.dev_id AND h.subsys_id = 'GENERIC'
CROSS JOIN user_profiles p;

INSERT INTO driver_packages
(component_id, profile_id, os_environment, edition_name, version_number, release_date,
 download_url, file_size_mb, silent_install_flags, is_whql_certified, sha256)
SELECT d.component_id, p.profile_id, d.os_environment, d.edition_name, d.version_number, d.release_date,
       d.download_url, d.file_size_mb, d.silent_install_flags, d.is_whql_certified, d.sha256
FROM driver_packages d
CROSS JOIN user_profiles p
WHERE d.download_url IN (
  'https://driwinstorage.blob.core.windows.net/drivers/WiFi-24.80.0-Driver64-Win10-Win11.exe',
  'https://driwinstorage.blob.core.windows.net/drivers/DriverBluetoothtWin10y11.exe'
)
ON CONFLICT (component_id, profile_id, os_environment) DO NOTHING;

-- ----------------------------------------------------------------------------
-- B.4 Insertar Aplicaciones Recomendadas (5 por perfil, 20 en total)
-- ----------------------------------------------------------------------------
INSERT INTO recommended_apps (app_name, category, version_number, download_url, file_size_mb, silent_install_flags) VALUES
-- Perfil Gamer (profile_id = 1)
('Steam',                  'Gaming',           '3.0.10.91',        'https://driwinstorage.blob.core.windows.net/apps/steam-setup-3.0.10.91.exe',            65,  '/S'),
('Epic Games Launcher',    'Gaming',           '17.2.1',           'https://driwinstorage.blob.core.windows.net/apps/epic-games-launcher-17.2.1.exe',       55,  '/S'),
('Discord',                'Comunicación',     '1.0.9231',         'https://driwinstorage.blob.core.windows.net/apps/discord-setup-1.0.9231.exe',          90,  '-s'),
('G-Helper',               'Utilidades',       '0.21.0',           'https://driwinstorage.blob.core.windows.net/apps/g-helper-0.21.0-portable.zip',         5,  'PORTABLE'),
('Opera GX',               'Navegador Gaming', '117.0.1433.1',     'https://driwinstorage.blob.core.windows.net/apps/opera-gx-117.0.1433.1-setup.exe',      120, '/S /silent'),

-- Perfil Creator (profile_id = 2)
('Krita',                  'Creatividad (Dibujo)',      '5.2.6',        'https://driwinstorage.blob.core.windows.net/apps/krita-5.2.6-setup.exe',              210, '/S'),
('Blender',                'Creatividad (3D)',          '4.2.3 LTS',    'https://driwinstorage.blob.core.windows.net/apps/blender-4.2.3-windows-x64.msi',      350, '/qn /norestart'),
('Clip Studio Paint',      'Creatividad (Ilustración)', '3.1.4',        'https://driwinstorage.blob.core.windows.net/apps/clip-studio-paint-3.1.4-setup.exe',  380, '/S'),
('MakeHuman',              'Creatividad (Modelado 3D)', '1.7.3',        'https://driwinstorage.blob.core.windows.net/apps/makehuman-1.7.3-win64.exe',          120, '/S'),
('DaVinci Resolve',        'Creatividad (Video)',       '19.1.2',       'https://driwinstorage.blob.core.windows.net/apps/davinci-resolve-19.1.2-windows.exe', 2900, '/S /norestart'),

-- Perfil Developer (profile_id = 4)
('Visual Studio Code',     'Desarrollo (Editor)',        '1.97.2',       'https://driwinstorage.blob.core.windows.net/apps/vscode-setup-1.97.2-x64.exe',        105, '/VERYSILENT /NORESTART /MERGETASKS=!runcode'),
('Git for Windows',        'Desarrollo (Control de Versiones)', '2.47.1', 'https://driwinstorage.blob.core.windows.net/apps/git-2.47.1-64-bit.exe',              65,  '/VERYSILENT /NORESTART'),
('Docker Desktop',         'Desarrollo (Contenedores)',  '4.37.1',       'https://driwinstorage.blob.core.windows.net/apps/docker-desktop-4.37.1-setup.exe',    620, 'install --quiet --accept-license'),
('Postman',                'Desarrollo (API)',           '11.30.5',      'https://driwinstorage.blob.core.windows.net/apps/postman-win64-11.30.5-setup.exe',    150, '/S'),
('Node.js LTS',            'Desarrollo (Runtime)',       '22.13.0 LTS',  'https://driwinstorage.blob.core.windows.net/apps/node-v22.13.0-x64.msi',             80,  '/qn /norestart'),

-- Perfil Office (profile_id = 3): Oficinista / Técnico Armador / Instituciones
('LibreOffice',            'Productividad (Ofimática)',  '25.2.1',       'https://driwinstorage.blob.core.windows.net/apps/libreoffice-25.2.1-x64.msi',        380, '/qn /norestart'),
('7-Zip',                  'Utilidades (Compresión)',    '24.09',        'https://driwinstorage.blob.core.windows.net/apps/7zip-24.09-x64.exe',                2,   '/S'),
('Adobe Acrobat Reader',   'Productividad (PDF)',        '25.001.20432', 'https://driwinstorage.blob.core.windows.net/apps/acrobat-reader-25.001.20432.exe',   430, '/sAll /rs /rps /msi EULA_ACCEPT=YES'),
('VLC Media Player',       'Multimedia',                 '3.0.21',       'https://driwinstorage.blob.core.windows.net/apps/vlc-3.0.21-win64.exe',              42,  '/S'),
('SumatraPDF',             'Utilidades (Lector PDF)',    '3.5.2',        'https://driwinstorage.blob.core.windows.net/apps/sumatrapdf-3.5.2-64-install.exe',   6,   '/S');

-- ----------------------------------------------------------------------------
-- B.5 Insertar relación PERFIL <-> APLICACIÓN (union-by-profile, sin duplicados)
--     Se resuelve por nombre de perfil / app para no depender de IDs explícitos.
-- ----------------------------------------------------------------------------
INSERT INTO profile_apps (profile_id, app_id)
SELECT p.profile_id, a.app_id
FROM (VALUES
    ('Gamer', 'Steam'),
    ('Gamer', 'Epic Games Launcher'),
    ('Gamer', 'Discord'),
    ('Gamer', 'G-Helper'),
    ('Gamer', 'Opera GX'),
    ('Creator', 'Krita'),
    ('Creator', 'Blender'),
    ('Creator', 'Clip Studio Paint'),
    ('Creator', 'MakeHuman'),
    ('Creator', 'DaVinci Resolve'),
    ('Developer', 'Visual Studio Code'),
    ('Developer', 'Git for Windows'),
    ('Developer', 'Docker Desktop'),
    ('Developer', 'Postman'),
    ('Developer', 'Node.js LTS'),
    ('Office', 'LibreOffice'),
    ('Office', '7-Zip'),
    ('Office', 'Adobe Acrobat Reader'),
    ('Office', 'VLC Media Player'),
    ('Office', 'SumatraPDF')
) AS v(profile_name, app_name)
INNER JOIN user_profiles p      ON p.profile_name  = v.profile_name
INNER JOIN recommended_apps a   ON a.app_name      = v.app_name;

-- Origen de instalación de cada app (ver db/migrations/006_apps_winget.sql).
UPDATE recommended_apps a
SET winget_id = v.winget_id, official_url = v.official_url
FROM (VALUES
  ('Steam',                'Valve.Steam',                       NULL),
  ('Epic Games Launcher',  'EpicGames.EpicGamesLauncher',       NULL),
  ('Discord',              'Discord.Discord',                   NULL),
  ('G-Helper',             'seerge.g-helper',                   NULL),
  ('Opera GX',             'Opera.OperaGX',                     NULL),
  ('Krita',                'KDE.Krita',                         NULL),
  ('Blender',              'BlenderFoundation.Blender',         NULL),
  ('Clip Studio Paint',    'Celsys.ClipStudioPaint',            NULL),
  ('MakeHuman',            NULL, 'https://static.makehumancommunity.org/makehuman.html'),
  ('DaVinci Resolve',      NULL, 'https://www.blackmagicdesign.com/products/davinciresolve'),
  ('Visual Studio Code',   'Microsoft.VisualStudioCode',        NULL),
  ('Git for Windows',      'Git.Git',                           NULL),
  ('Docker Desktop',       'Docker.DockerDesktop',              NULL),
  ('Postman',              'Postman.Postman',                   NULL),
  ('Node.js LTS',          'OpenJS.NodeJS.LTS',                 NULL),
  ('LibreOffice',          'TheDocumentFoundation.LibreOffice', NULL),
  ('7-Zip',                '7zip.7zip',                         NULL),
  ('Adobe Acrobat Reader', 'Adobe.Acrobat.Reader.64-bit',       NULL),
  ('VLC Media Player',     'VideoLAN.VLC',                      NULL),
  ('SumatraPDF',           'SumatraPDF.SumatraPDF',             NULL)
) AS v(app_name, winget_id, official_url)
WHERE a.app_name = v.app_name;

ALTER TABLE recommended_apps ADD CONSTRAINT chk_app_install_source
  CHECK (winget_id IS NOT NULL OR official_url IS NOT NULL);

-- ----------------------------------------------------------------------------
-- B.6 Insertar Reglas de Bloatware (20 de riesgo BAJO/MEDIO) y su política por perfil (= migración 004)
--     detection: inspección en el registro de desinstalación (HKLM) + Get-AppxPackage
--     removal:   desinstalación silenciosa por comodín de paquete
-- ----------------------------------------------------------------------------
INSERT INTO bloatware_rules
  (app_display_name, package_signature, package_names, detection_powershell_cmd,
   removal_powershell_cmd, risk_level, description, help_text)
SELECT v.name, v.signature, v.packages,
       'Get-AppxPackage -Name ' || array_to_string(v.packages, ', ') || ' | Select-Object Name, Version, PackageFullName',
       'Get-AppxPackage -Name ' || array_to_string(v.packages, ', ') || ' | Remove-AppxPackage',
       v.risk, v.description, v.help
FROM (VALUES
  -- ===================== RIESGO BAJO =====================
  ('Microsoft Bing News & Weather', '*BingNews* / *BingWeather*',
   ARRAY['Microsoft.BingNews', 'Microsoft.BingWeather'], 'BAJO',
   'Apps de noticias y clima que se actualizan en segundo plano.',
   'Son las apps "Noticias" y "El tiempo" que trae Windows. Se conectan a internet en segundo plano para actualizar titulares y pronósticos. Si las quitas, el clima de la barra de tareas puede seguir apareciendo (es parte de Widgets) y siempre puedes verlo en el navegador.'),
  ('Microsoft Solitaire Collection & Casual Games', '*MicrosoftSolitaireCollection*',
   ARRAY['Microsoft.MicrosoftSolitaireCollection'], 'BAJO',
   'Juegos de cartas preinstalados con publicidad.',
   'Es la colección de Solitario, Spider y FreeCell que viene con Windows. Muestra anuncios y ocupa espacio. Quitarlo no afecta a ningún otro juego ni programa.'),
  ('Juegos promocionados (Candy Crush y similares)', 'king.com.*',
   ARRAY['king.com.*'], 'BAJO',
   'Juegos que Windows instala como publicidad.',
   'Windows instala por su cuenta algunos juegos como Candy Crush o Bubble Witch para promocionarlos. Si nunca los abriste, solo ocupan espacio en el menú Inicio. Quitarlos borra también tu progreso en esos juegos.'),
  ('Obtener ayuda y Consejos', '*GetHelp* / *Getstarted*',
   ARRAY['Microsoft.GetHelp', 'Microsoft.Getstarted'], 'BAJO',
   'Apps de tutoriales y asistencia de Microsoft.',
   '"Obtener ayuda" abre un chat de soporte de Microsoft y "Consejos" muestra tutoriales de Windows. Si no las usas, se pueden quitar: la ayuda sigue disponible en support.microsoft.com.'),
  ('Centro de opiniones', '*WindowsFeedbackHub*',
   ARRAY['Microsoft.WindowsFeedbackHub'], 'BAJO',
   'App para enviar comentarios a Microsoft.',
   'Sirve para enviar sugerencias o reportar errores a Microsoft. Quitarla no cambia cómo funciona Windows ni deja de enviar los datos de diagnóstico (eso se configura aparte).'),
  ('Mapas de Windows', '*WindowsMaps*',
   ARRAY['Microsoft.WindowsMaps'], 'BAJO',
   'App de mapas que descarga datos en segundo plano.',
   'Es la app de mapas de Microsoft. Puede descargar y actualizar mapas sin que lo notes. La mayoría usa Google Maps en el navegador; quitarla no afecta la ubicación de otras apps.'),
  ('Películas y TV', '*ZuneVideo*',
   ARRAY['Microsoft.ZuneVideo'], 'BAJO',
   'Reproductor y tienda de películas de Microsoft.',
   'Es el reproductor de video "Películas y TV". Si lo quitas, tus videos se abrirán con otro reproductor (por ejemplo VLC o el Reproductor multimedia). Las películas compradas en la tienda de Microsoft dejarán de verse aquí.'),
  ('Contactos y Skype', '*People* / *SkypeApp*',
   ARRAY['Microsoft.People', 'Microsoft.SkypeApp'], 'BAJO',
   'Agenda de contactos y Skype preinstalado.',
   '"Contactos" es una agenda que casi nadie usa y Skype es la app de videollamadas que Microsoft ya reemplazó por Teams. Si usas Skype para trabajar, desmárcalo.'),
  ('Visor 3D y Mixed Reality', '*Microsoft3DViewer* / *MixedReality.Portal*',
   ARRAY['Microsoft.Microsoft3DViewer', 'Microsoft.MixedReality.Portal'], 'BAJO',
   'Visor de modelos 3D y portal para lentes de realidad virtual.',
   'El Visor 3D abre modelos en 3D y el Portal de realidad mixta sirve para lentes de realidad virtual de Windows. Si no tienes lentes ni trabajas con modelos 3D, no los necesitas. (Vienen en Windows 10.)'),
  ('Clipchamp', '*Clipchamp*',
   ARRAY['Clipchamp.Clipchamp'], 'BAJO',
   'Editor de video básico de Microsoft.',
   'Clipchamp es un editor de video sencillo que trae Windows 11. Si editas video con otro programa (DaVinci, Premiere) o no editas, puedes quitarlo.'),
  ('Dev Home', '*Windows.DevHome*',
   ARRAY['Microsoft.Windows.DevHome'], 'BAJO',
   'Panel para programadores que Microsoft ya dejó de desarrollar.',
   'Dev Home es un panel para organizar proyectos de programación. Microsoft anunció que lo dejará de lado. Si no programas, no lo necesitas.'),
  -- ===================== RIESGO MEDIO =====================
  ('Xbox app y Game Bar', '*XboxGamingOverlay*',
   ARRAY['Microsoft.XboxGamingOverlay', 'Microsoft.GamingApp', 'Microsoft.XboxApp'], 'MEDIO',
   'App de Xbox y la barra de juegos (Win+G).',
   'La app de Xbox sirve para Game Pass y la Game Bar (Win+G) para grabar pantalla y ver el rendimiento al jugar. Si la quitas dejarán de funcionar Win+G, las grabaciones de Xbox y los juegos de Game Pass para PC. No afecta a Steam ni Epic Games.'),
  ('Copilot', '*Microsoft.Copilot*',
   ARRAY['Microsoft.Copilot'], 'MEDIO',
   'Asistente de inteligencia artificial de Microsoft.',
   'Copilot es el asistente con IA de Microsoft. Si no lo usas, quitarlo libera el botón y la app. Siempre puedes usarlo desde copilot.microsoft.com o reinstalarlo desde la Microsoft Store.'),
  ('Teams (personal)', '*MicrosoftTeams* / *MSTeams*',
   ARRAY['MicrosoftTeams', 'MSTeams'], 'MEDIO',
   'Chat y videollamadas de Microsoft Teams.',
   'Teams es la app de chat y videollamadas de Microsoft. Si tu colegio o trabajo lo usa para clases o reuniones, desmárcalo. Si no, se puede quitar y reinstalar cuando lo necesites.'),
  ('Outlook nuevo y Microsoft To Do', '*OutlookForWindows* / *Todos*',
   ARRAY['Microsoft.OutlookForWindows', 'Microsoft.Todos'], 'MEDIO',
   'Correo Outlook y lista de tareas To Do.',
   'Es el nuevo Outlook (correo y calendario) y la app de tareas To Do. Si revisas tu correo aquí o tienes tareas guardadas, desmárcalo. Tus correos y tareas viven en tu cuenta Microsoft, así que no se pierden al quitar las apps.'),
  ('App Microsoft 365 (Office)', '*MicrosoftOfficeHub*',
   ARRAY['Microsoft.MicrosoftOfficeHub'], 'MEDIO',
   'Acceso directo a Office que promociona la suscripción.',
   'Esta app es solo un acceso directo que promociona Microsoft 365. Quitarla NO desinstala Word, Excel ni PowerPoint si los tienes instalados.'),
  ('Vincular teléfono (Phone Link)', '*YourPhone*',
   ARRAY['Microsoft.YourPhone'], 'MEDIO',
   'Conecta tu celular para ver mensajes y fotos en el PC.',
   'Phone Link conecta tu celular para ver notificaciones, mensajes y fotos en el computador. Si nunca lo configuraste, puedes quitarlo. Si lo usas a diario, desmárcalo.'),
  ('Power Automate', '*PowerAutomateDesktop*',
   ARRAY['Microsoft.PowerAutomateDesktop'], 'MEDIO',
   'Herramienta para automatizar tareas repetitivas.',
   'Power Automate permite crear "robots" que repiten tareas en el PC (copiar datos, abrir programas). Si no creaste ninguna automatización, puedes quitarlo.'),
  ('Asistencia rápida (Quick Assist)', '*QuickAssist*',
   ARRAY['MicrosoftCorporationII.QuickAssist'], 'MEDIO',
   'Permite que alguien te ayude conectándose a tu PC.',
   'Asistencia rápida permite que un técnico o familiar vea y controle tu pantalla para ayudarte. Si nadie te da soporte remoto, puedes quitarla; si tu empresa la usa, desmárcala.'),
  ('Reproductor multimedia', '*ZuneMusic*',
   ARRAY['Microsoft.ZuneMusic'], 'MEDIO',
   'Reproductor de música y video por defecto de Windows.',
   'Es el reproductor que abre tu música y videos por defecto. Si lo quitas, necesitarás otro reproductor (por ejemplo VLC). Tus archivos de música no se borran.')
) AS v(name, signature, packages, risk, description, help)
ON CONFLICT (package_signature) DO UPDATE SET
  app_display_name         = EXCLUDED.app_display_name,
  package_names            = EXCLUDED.package_names,
  detection_powershell_cmd = EXCLUDED.detection_powershell_cmd,
  removal_powershell_cmd   = EXCLUDED.removal_powershell_cmd,
  risk_level               = EXCLUDED.risk_level,
  description              = EXCLUDED.description,
  help_text                = EXCLUDED.help_text;

-- ----------------------------------------------------------------------------
-- Política por perfil (S = SUGERIDO, O = OPCIONAL, P = PROTEGIDO)
-- ----------------------------------------------------------------------------
INSERT INTO bloatware_profile_policy (bloatware_id, profile_id, policy)
SELECT r.bloatware_id, p.profile_id,
       CASE x.code WHEN 'S' THEN 'SUGERIDO' WHEN 'O' THEN 'OPCIONAL' ELSE 'PROTEGIDO' END
FROM (VALUES
  --  package_signature                                   Gamer Developer Creator Office
  ('*BingNews* / *BingWeather*',                          'S', 'S', 'S', 'S'),
  ('*MicrosoftSolitaireCollection*',                      'S', 'S', 'S', 'S'),
  ('king.com.*',                                          'S', 'S', 'S', 'S'),
  ('*GetHelp* / *Getstarted*',                            'S', 'S', 'S', 'S'),
  ('*WindowsFeedbackHub*',                                'S', 'S', 'S', 'S'),
  ('*WindowsMaps*',                                       'S', 'S', 'S', 'S'),
  ('*ZuneVideo*',                                         'S', 'S', 'O', 'S'),
  ('*People* / *SkypeApp*',                               'S', 'S', 'S', 'O'),
  ('*Microsoft3DViewer* / *MixedReality.Portal*',         'S', 'S', 'O', 'S'),
  ('*Clipchamp*',                                         'S', 'S', 'P', 'S'),
  ('*Windows.DevHome*',                                   'S', 'P', 'S', 'S'),
  ('*XboxGamingOverlay*',                                 'P', 'O', 'O', 'S'),
  ('*Microsoft.Copilot*',                                 'O', 'O', 'O', 'O'),
  ('*MicrosoftTeams* / *MSTeams*',                        'S', 'O', 'S', 'P'),
  ('*OutlookForWindows* / *Todos*',                       'O', 'O', 'O', 'P'),
  ('*MicrosoftOfficeHub*',                                'S', 'O', 'O', 'P'),
  ('*YourPhone*',                                         'O', 'O', 'O', 'O'),
  ('*PowerAutomateDesktop*',                              'S', 'P', 'S', 'O'),
  ('*QuickAssist*',                                       'O', 'O', 'O', 'P'),
  ('*ZuneMusic*',                                         'O', 'O', 'P', 'O')
) AS v(signature, gamer, developer, creator, office)
CROSS JOIN LATERAL (VALUES
  ('Gamer', v.gamer), ('Developer', v.developer), ('Creator', v.creator), ('Office', v.office)
) AS x(profile_name, code)
INNER JOIN bloatware_rules r ON r.package_signature = v.signature
INNER JOIN user_profiles p   ON p.profile_name      = x.profile_name
ON CONFLICT (bloatware_id, profile_id) DO UPDATE SET policy = EXCLUDED.policy;

-- ----------------------------------------------------------------------------
-- B.7 Insertar Matriz de Financiamiento (5 planes comerciales)
-- ----------------------------------------------------------------------------
INSERT INTO subscription_tiers
(tier_name, target_persona, pricing_model, price_clp, max_devices, device_scope, description)
VALUES
('Pase Mensual', 'Usuario Normal B2C', 'Mensual', 5000.00, 3, '3 PCs',
 'Suscripción mensual de DriWin para usuarios normales: hasta 3 PCs por suscripción, renovación mensual en pesos chilenos.'),
('Compra Única Vitalicia', 'Usuario Normal B2C', 'Única', 30000.00, 1, '1 PC fijo',
 'Licencia vitalicia de pago único asociada de forma permanente a un solo PC (ligada al hardware activo).'),
('Plan Builder Pro', 'Técnico Armador / Oficinista', 'Tarifa Plana', NULL, NULL, 'PCs Ilimitados Rotativos',
 'Tarifa plana para técnicos armadores y perfil Office: PCs ilimitados en esquema rotativo (se liberan al concluir cada equipo).'),
('Pack por Volumen', 'Instituciones B2B / Oficinista', 'Lote', 1500000.00, 100, 'Lote de 100 PCs',
 'Pack institucional B2B por lote de 100 PCs (ej. colegios y municipalidades) bajo perfil Office.'),
('Alianza OEM / Certificado', 'Retail PC Factory (OEM)', 'Convenio B2B', NULL, NULL, 'Preinstalado de fábrica',
 'Convenio B2B con ensambladores retail: DriWin preinstalado y certificado de fábrica, sin lista de precios pública.');

-- ----------------------------------------------------------------------------
-- B.8 Insertar Usuarios Sintéticos (6 casos que cubren toda la matriz)
--     tier_id: 1=Pase Mensual, 2=Compra Única, 3=Builder Pro, 4=Pack Volumen, 5=OEM
-- ----------------------------------------------------------------------------
INSERT INTO synthetic_users
(full_name, email, user_role_type, tier_id, selected_profiles_array, active_devices_count)
VALUES
('Javier Rodríguez',        'javier.rodriguez@correo-driwin.cl',     'Gamer',                  1, ARRAY['Gamer'],                 2),
('Camila Rojas',            'camila.rojas@correo-driwin.cl',         'Creator',                2, ARRAY['Creator'],               1),
('Diego Salazar',           'diego.salazar@correo-driwin.cl',        'Híbrido Gamer + Creator', 1, ARRAY['Gamer', 'Creator'],      3),
('Valentina Muñoz',         'valentina.munoz@correo-driwin.cl',      'Developer',              2, ARRAY['Developer'],             1),
('Rodrigo Contreras',       'rodrigo.contreras@correo-driwin.cl',    'Técnico Armador',        3, ARRAY['Office'],               12),
('Institución Educativa Municipal Los Alerces', 'sistemas@iec-alerces.cl', 'Institución Educativa', 4, ARRAY['Office'],         100);

-- ============================================================================
-- CONSULTAS SQL DE PRUEBA (HITO 2) - DEMOSTRACIÓN DE APLICACIONES COMBINADAS
-- ============================================================================
--
-- 1) CASO GAMER + CREATOR: obtener la UNIÓN de aplicaciones cuando un usuario
--    selecciona múltiples perfiles. Usuario de ejemplo: Diego Salazar
--    (user_id = 3, selected_profiles_array = ARRAY['Gamer','Creator']).
--    El DISTINCT garantiza cero duplicados aunque dos perfiles recomienden
--    la misma aplicación.
--
-- SELECT DISTINCT a.app_id, a.app_name, a.category, a.version_number,
--        a.download_url, a.file_size_mb, a.silent_install_flags
-- FROM synthetic_users u
-- CROSS JOIN LATERAL unnest(u.selected_profiles_array) AS sel(profile_name)
-- INNER JOIN user_profiles p        ON p.profile_name = sel.profile_name
-- INNER JOIN profile_apps pa        ON pa.profile_id  = p.profile_id
-- INNER JOIN recommended_apps a     ON a.app_id       = pa.app_id
-- WHERE u.user_id = 3
-- ORDER BY a.category, a.app_name;
--
-- Esperado: 10 filas (5 de Gamer + 5 de Creator) sin duplicados.
--
-- 2) VARIANTE TRAZABLE: misma unión pero mostrando el perfil de origen de
--    cada recomendación (útil para explicar en la UI "por qué te sugiero X"):
--
-- SELECT p.profile_name, a.app_name, a.category, a.silent_install_flags
-- FROM synthetic_users u
-- CROSS JOIN LATERAL unnest(u.selected_profiles_array) AS sel(profile_name)
-- INNER JOIN user_profiles p        ON p.profile_name = sel.profile_name
-- INNER JOIN profile_apps pa        ON pa.profile_id  = p.profile_id
-- INNER JOIN recommended_apps a     ON a.app_id       = pa.app_id
-- WHERE u.user_id = 3
-- ORDER BY p.profile_name, a.app_name;
--
-- 3) VARIANTE SIN USUARIO: elección directa de perfiles (Gamer + Creator),
--    equivalente al Onboarding del frontend antes de registrar al usuario:
--
-- SELECT DISTINCT a.app_name, a.category, a.download_url, a.silent_install_flags
-- FROM user_profiles p
-- INNER JOIN profile_apps pa        ON pa.profile_id = p.profile_id
-- INNER JOIN recommended_apps a     ON a.app_id      = pa.app_id
-- WHERE p.profile_name IN ('Gamer', 'Creator')
-- ORDER BY a.app_name;
--
-- 4) VERIFICACIÓN DE SEMILLA: debe entregar 5 apps por perfil y 20 en total
--    (incluye al perfil Developer):
--
-- SELECT p.profile_name, COUNT(*) AS total_apps
-- FROM profile_apps pa
-- INNER JOIN user_profiles p ON p.profile_id = pa.profile_id
-- GROUP BY p.profile_name
-- ORDER BY p.profile_name;
--
-- 5) VERIFICACIÓN DE INTEGRIDAD: la PK compuesta de profile_apps impide
--    duplicados; esta consulta debe retornar SIEMPRE 0 filas:
--
-- SELECT profile_id, app_id, COUNT(*) AS repeticiones
-- FROM profile_apps
-- GROUP BY profile_id, app_id
-- HAVING COUNT(*) > 1;
--
-- 6) VERIFICACIÓN DE FINANCIAMIENTO: usuarios que exceden el límite de PCs
--    de su plan; debe retornar 0 filas (los límites se respetan):
--
-- SELECT u.full_name, u.active_devices_count, t.tier_name, t.max_devices
-- FROM synthetic_users u
-- INNER JOIN subscription_tiers t ON t.tier_id = u.tier_id
-- WHERE t.max_devices IS NOT NULL AND u.active_devices_count > t.max_devices;
--
-- 7) RESUMEN DE USUARIOS SINTÉTICOS CONTRA LA MATRIZ COMERCIAL:
--
-- SELECT u.full_name, u.user_role_type, t.tier_name, t.pricing_model,
--        t.price_clp, t.device_scope, u.selected_profiles_array,
--        u.active_devices_count
-- FROM synthetic_users u
-- INNER JOIN subscription_tiers t ON t.tier_id = u.tier_id
-- ORDER BY u.user_id;
--
-- 8) CASO JAVIER (Gamer, VEN_1002 / DEV_1638): driver recomendado del
--    primer paso del flujo DriWin:
--
-- SELECT h.ven_id, h.dev_id, h.commercial_name, d.edition_name,
--        d.version_number, d.download_url, d.silent_install_flags
-- FROM driver_packages d
-- INNER JOIN user_profiles p          ON p.profile_id     = d.profile_id
-- INNER JOIN hardware_components h    ON h.component_id   = d.component_id
-- WHERE p.profile_name = 'Gamer' AND h.ven_id = '1002' AND h.dev_id = '1638';
--
-- 9) DRIVERS POR PERFIL (incluye los paquetes sintéticos de Developer):
--
-- SELECT p.profile_name, h.commercial_name, d.edition_name, d.version_number
-- FROM driver_packages d
-- INNER JOIN user_profiles p          ON p.profile_id   = d.profile_id
-- INNER JOIN hardware_components h    ON h.component_id = d.component_id
-- ORDER BY p.profile_id, h.component_id;
-- ============================================================================
