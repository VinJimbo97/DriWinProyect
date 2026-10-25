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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_app_size CHECK (file_size_mb > 0)
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_bloatware_risk CHECK (risk_level IN ('BAJO', 'MEDIO', 'ALTO')),
    CONSTRAINT uq_bloatware_signature UNIQUE (package_signature)
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
(5, 3, 'Win11_x64', 'Intel Wireless Wi-Fi Driver (Gen 11-14)', '23.40.0', '2026-10-01', 'https://driwinstorage.blob.core.windows.net/drivers/DriverWifiGen11a14.exe', 72, '-q -norestart', TRUE),
(6, 3, 'Win11_x64', 'Intel Wireless Bluetooth Driver (Win 10/11)', '23.40.0', '2026-10-01', 'https://driwinstorage.blob.core.windows.net/drivers/DriverBluetoothtWin10y11.exe', 61, '/quiet /norestart', TRUE);

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

-- ----------------------------------------------------------------------------
-- B.6 Insertar Reglas de Bloatware Nativo de Windows (3 representativas)
--     detection: inspección en el registro de desinstalación (HKLM) + Get-AppxPackage
--     removal:   desinstalación silenciosa por comodín de paquete
-- ----------------------------------------------------------------------------
INSERT INTO bloatware_rules
(app_display_name, package_signature, detection_powershell_cmd, removal_powershell_cmd, risk_level, description)
VALUES
(
    'Microsoft Bing News & Weather',
    '*BingNews* / *BingWeather*',
    'Get-ItemProperty HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*, HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* | Where-Object {$_.DisplayName -like "*BingNews*" -or $_.DisplayName -like "*BingWeather*"} | Select-Object DisplayName, DisplayVersion; Get-AppxPackage -Name *BingNews*, *BingWeather* | Select-Object Name, Version, PackageFullName',
    'Get-AppxPackage -Name *BingNews* | Remove-AppxPackage; Get-AppxPackage -Name *BingWeather* | Remove-AppxPackage',
    'BAJO',
    'Aplicaciones de noticias y clima preinstaladas que consumen ancho de banda y CPU en segundo plano sin aportar valor funcional a DriWin.'
),
(
    'Xbox Gaming Overlay / Game Bar',
    '*XboxGamingOverlay*',
    'Get-ItemProperty HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*, HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* | Where-Object {$_.DisplayName -like "*XboxGamingOverlay*"} | Select-Object DisplayName, DisplayVersion; Get-AppxPackage -Name *XboxGamingOverlay* | Select-Object Name, Version, PackageFullName',
    'Get-AppxPackage -Name *XboxGamingOverlay* | Remove-AppxPackage',
    'MEDIO',
    'Superposición de captura y overlay de Xbox. Se marca como MEDIO porque su eliminación desactiva la combinación Win+G; DriWin omite esta limpieza automática cuando el usuario mantiene el perfil Gamer.'
),
(
    'Microsoft Solitaire Collection & Casual Games',
    '*MicrosoftSolitaireCollection*',
    'Get-ItemProperty HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*, HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* | Where-Object {$_.DisplayName -like "*MicrosoftSolitaireCollection*"} | Select-Object DisplayName, DisplayVersion; Get-AppxPackage -Name *MicrosoftSolitaireCollection* | Select-Object Name, Version, PackageFullName',
    'Get-AppxPackage -Name *MicrosoftSolitaireCollection* | Remove-AppxPackage',
    'BAJO',
    'Juegos casuales preinstalados de Microsoft Store que ocupan espacio en disco y ejecutan procesos en segundo plano; remoción segura en todos los perfiles.'
);

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
