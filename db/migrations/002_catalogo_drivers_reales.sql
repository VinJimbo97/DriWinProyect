-- ============================================================================
-- MIGRACIÓN 002 — CATÁLOGO DE DRIVERS REALES (Azure Blob Storage)
-- Motor: PostgreSQL 16 (driwin_catalog)
--
-- Para bases YA creadas con la versión anterior de db/init.sql (12 drivers de
-- ejemplo cuyas URLs daban 404). Deja el catálogo idéntico al init.sql actual:
--   - 6 componentes: AMD, NVIDIA RTX 30/40, MediaTek, Intel Gráficos/Wi-Fi/BT
--   - 9 driver_packages, todos con instalador real en el contenedor drivers/
--
-- Corrige el script original de la guía: el componente 2 (NVIDIA) pasa de
-- DEV_2504 a DEV_2684; sin ese UPDATE, los 4 drivers NVIDIA nunca coincidían
-- con el hardware escaneado.
--
-- Idempotente: puede ejecutarse varias veces con el mismo resultado.
-- ATENCIÓN: borra TODOS los driver_packages actuales y los componentes con
-- component_id >= 4 (incluidos los creados a mano con Postman).
-- No toca perfiles, apps, bloatware, planes ni usuarios sintéticos.
--
-- Ejecutar:
--   psql "<cadena de conexión>" -v ON_ERROR_STOP=1 -f db/migrations/002_catalogo_drivers_reales.sql
-- ============================================================================

BEGIN;

-- 1. Retirar los paquetes de ejemplo y los componentes que se reemplazan
--    (Realtek y cualquier componente agregado después del id 3).
DELETE FROM driver_packages;
DELETE FROM hardware_components WHERE component_id >= 4;

-- 2. NVIDIA: firma alineada con el instalador real (RTX 30/40, DEV_2684).
UPDATE hardware_components
SET dev_id = '2684',
    commercial_name = 'NVIDIA GeForce RTX 30/40 Series'
WHERE component_id = 2;

-- 3. Componentes Intel nuevos (IDs fijos 4, 5 y 6, como en init.sql).
INSERT INTO hardware_components (component_id, ven_id, dev_id, subsys_id, commercial_name, category) VALUES
(4, '8086', 'A780', 'GENERIC', 'Intel Iris Xe / UHD Graphics (Gen 11 a 14)', 'GPU'),
(5, '8086', '51F0', 'GENERIC', 'Intel Wi-Fi 6/6E Wireless Adapter (Gen 11 a 14)', 'Network'),
(6, '8087', '0033', 'GENERIC', 'Intel Wireless Bluetooth para Windows 10 y 11', 'Bluetooth');

-- 4. Los 9 paquetes reales (IDs 1..9, mismo orden que init.sql).
INSERT INTO driver_packages
(driver_id, component_id, profile_id, os_environment, edition_name, version_number, release_date, download_url, file_size_mb, silent_install_flags, is_whql_certified)
VALUES
(1, 1, 1, 'Win11_x64', 'AMD Software: Adrenalin Edition WHQL', '24.9.1', '2026-09-15', 'https://driwinstorage.blob.core.windows.net/drivers/whql-amd-software-adrenalin-edition-24.9.1-win10-win11-sep-rdna.exe', 726, '-install -noreboot', TRUE),
(2, 2, 1, 'Win11_x64', 'NVIDIA GeForce Game Ready Package Launcher', '561.09', '2026-09-11', 'https://driwinstorage.blob.core.windows.net/drivers/NvidiaDriverGamerPackageLauncher.exe', 945, '-s -noreboot', TRUE),
(3, 2, 2, 'Win11_x64', 'NVIDIA Studio Driver Creador Package Launcher', '561.09', '2026-09-11', 'https://driwinstorage.blob.core.windows.net/drivers/NvidiaDriverCreadorPackageLauncher.exe', 945, '-s -noreboot', TRUE),
(4, 2, 3, 'Win11_x64', 'NVIDIA Standard DCH Display Driver', '555.85', '2026-05-20', 'https://driwinstorage.blob.core.windows.net/drivers/NVIDIA%20GeForce%20v555.85%20(DCH).exe', 629, '-s -noreboot', TRUE),
(5, 2, 4, 'Win11_x64', 'NVIDIA GeForce DCH Developer Driver', '561.09', '2026-09-18', 'https://driwinstorage.blob.core.windows.net/drivers/NVIDIA%20GeForce%20v561.09%20(DCH).exe', 659, '-s -noreboot', TRUE),
(6, 3, 1, 'Win11_x64', 'MediaTek Wireless LAN WHQL Driver', '3.4.0.1023', '2026-08-01', 'https://driwinstorage.blob.core.windows.net/drivers/MediaTek_WLAN_r2cmw13w.exe', 9, '/S /v/qn', TRUE),
(7, 4, 3, 'Win11_x64', 'Intel Processor Graphics Driver (Gen 11-14)', '31.0.101.5522', '2026-10-01', 'https://driwinstorage.blob.core.windows.net/drivers/DriverProcesadorGen11%20a%2014%20Graphics.exe', 745, '--silent --no-reboot', TRUE),
(8, 5, 3, 'Win11_x64', 'Intel Wireless Wi-Fi Driver (Gen 11-14)', '23.40.0', '2026-10-01', 'https://driwinstorage.blob.core.windows.net/drivers/DriverWifiGen11a14.exe', 72, '-q -norestart', TRUE),
(9, 6, 3, 'Win11_x64', 'Intel Wireless Bluetooth Driver (Win 10/11)', '23.40.0', '2026-10-01', 'https://driwinstorage.blob.core.windows.net/drivers/DriverBluetoothtWin10y11.exe', 61, '/quiet /norestart', TRUE);

-- 5. Sincronizar las secuencias SERIAL para que los próximos POST no choquen.
SELECT setval(pg_get_serial_sequence('hardware_components', 'component_id'), (SELECT MAX(component_id) FROM hardware_components));
SELECT setval(pg_get_serial_sequence('driver_packages', 'driver_id'), (SELECT MAX(driver_id) FROM driver_packages));

COMMIT;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (debe devolver 9 filas, todas con URL real):
--
-- SELECT dp.driver_id, hc.ven_id, hc.dev_id, hc.commercial_name, up.profile_name,
--        dp.edition_name, dp.version_number, dp.file_size_mb
-- FROM driver_packages dp
-- JOIN hardware_components hc ON hc.component_id = dp.component_id
-- JOIN user_profiles up       ON up.profile_id   = dp.profile_id
-- ORDER BY dp.driver_id;
-- ----------------------------------------------------------------------------
