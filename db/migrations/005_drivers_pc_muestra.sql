-- ============================================================================
-- MIGRACIÓN 005 — DRIVERS DEL PC DE MUESTRA (ASUS, i5-12450H + RTX 3060 Laptop)
-- Motor: PostgreSQL 16 (driwin_catalog)
--
-- 1. Registra la RTX 3060 Laptop (10DE:2520) y la Intel UHD de 12.ª gen (8086:46A3).
-- 2. Publica sus drivers oficiales, ya subidos al contenedor drivers/, con su
--    huella SHA-256. El .inf de NVIDIA incluye este modelo exacto
--    (DEV_2520&SUBSYS_1C6C1043); Intel declara soporte para la 12.ª generación.
-- 3. Corrige la versión del Wi-Fi Intel (su .inf dice 24.80.0.2, no 23.40.0)
--    y lo apunta al mismo instalador con su nombre oficial de Intel (misma huella).
-- 4. Los drivers de este hardware (video, Wi-Fi y Bluetooth) no dependen del
--    uso del PC, así que se publican para los cuatro perfiles.
--
-- No cambia la estructura de las tablas ni requiere publicar la API.
-- Idempotente: puede ejecutarse varias veces con el mismo resultado.
-- ============================================================================
BEGIN;

INSERT INTO hardware_components (ven_id, dev_id, subsys_id, commercial_name, category) VALUES
('10DE', '2520', 'GENERIC', 'NVIDIA GeForce RTX 3060 Laptop GPU', 'GPU'),
('8086', '46A3', 'GENERIC', 'Intel UHD Graphics (12.ª generación)', 'GPU')
ON CONFLICT (ven_id, dev_id, subsys_id) DO NOTHING;

-- Un registro por perfil: el driver es el mismo para Gamer, Creator, Office y Developer.
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
CROSS JOIN user_profiles p
ON CONFLICT (component_id, profile_id, os_environment) DO NOTHING;

UPDATE driver_packages
SET version_number = '24.80.0.2',
    download_url = 'https://driwinstorage.blob.core.windows.net/drivers/WiFi-24.80.0-Driver64-Win10-Win11.exe'
WHERE download_url = 'https://driwinstorage.blob.core.windows.net/drivers/DriverWifiGen11a14.exe';

-- Wi-Fi y Bluetooth Intel estaban sólo en Office: se copian a los demás perfiles.
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

COMMIT;
