-- ============================================================================
-- MIGRACIÓN 003 — HUELLA SHA-256 DE LOS INSTALADORES DE DRIVERS
-- Motor: PostgreSQL 16 (driwin_catalog)
--
-- La app de escritorio sólo instala un driver si lo descargado coincide con
-- esta huella. Mientras un driver no la tenga, la app no lo instala.
--
-- Aplicar ANTES de publicar la versión de server-api que lee la columna.
-- Idempotente: puede ejecutarse varias veces con el mismo resultado.
-- ============================================================================
BEGIN;

ALTER TABLE driver_packages ADD COLUMN IF NOT EXISTS sha256 VARCHAR(64);

ALTER TABLE driver_packages DROP CONSTRAINT IF EXISTS chk_driver_sha256;
ALTER TABLE driver_packages ADD CONSTRAINT chk_driver_sha256
  CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$');

UPDATE driver_packages SET sha256 = '511e01a35f8b6bddb6463c74062467f69d08e0662059abc515f879dfe2675724'
WHERE download_url = 'https://driwinstorage.blob.core.windows.net/drivers/DriverBluetoothtWin10y11.exe';
UPDATE driver_packages SET sha256 = '40d2f714830b406ccc1f9c00547ad6090f164f928748e38f27a1c7c0ef5ed5ea'
WHERE download_url = 'https://driwinstorage.blob.core.windows.net/drivers/DriverWifiGen11a14.exe';
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

COMMIT;
