-- ============================================================================
-- MIGRACIÓN 010 — CONSENTIMIENTO DEL AVISO DE PRIVACIDAD
-- Motor: PostgreSQL 16+ (driwin_catalog). Requiere 007 (roles) y 008 (cuentas).
--
-- Ley 19.628 / Ley 21.719: el consentimiento debe ser previo, informado y
-- explícito, y el responsable debe poder DEMOSTRAR que lo obtuvo. Por eso cada
-- cuenta guarda qué versión del aviso aceptó y cuándo.
--
--   * privacy_version     versión del aviso aceptada (ej. '2026-11-10').
--   * privacy_accepted_at fecha y hora de la aceptación.
--
-- Las cuentas creadas antes de esta migración quedan con ambos en NULL: la app
-- les pide aceptar el aviso vigente la próxima vez que abran "Mi cuenta".
-- Si el aviso cambia de versión, se vuelve a pedir la aceptación.
--
-- Orden de despliegue: aplicar ESTA migración ANTES de publicar la API nueva
-- (la API lee y escribe estas columnas).
--
-- Permisos: driwin_api ya tiene SELECT/INSERT/UPDATE sobre la TABLA accounts
-- (migración 008); un permiso de tabla cubre también las columnas nuevas.
--
-- Idempotente: puede ejecutarse varias veces con el mismo resultado.
-- ============================================================================
BEGIN;

SET ROLE driwin_owner;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS privacy_version VARCHAR(20);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;

-- Las dos van juntas: o hay aceptación completa (versión + fecha) o no hay ninguna.
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS ck_account_privacy;
ALTER TABLE accounts ADD CONSTRAINT ck_account_privacy
  CHECK ((privacy_version IS NULL) = (privacy_accepted_at IS NULL));

RESET ROLE;

COMMIT;
